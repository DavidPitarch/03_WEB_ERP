-- ============================================================
-- EP13 — Módulo Clientes e Intervinientes
-- Fecha: 2026-03-19
-- Principio: IDENTIDAD · ROL · PARTICIPACIÓN separados
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── ENUMs (idempotentes) ────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE interaction_channel AS ENUM (
    'call_inbound','call_outbound',
    'email_sent','email_received',
    'sms_sent','sms_received',
    'whatsapp_sent','whatsapp_received',
    'video_call','visit_in_person',
    'letter_sent','letter_received',
    'portal_access','note_internal','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE interaction_outcome AS ENUM (
    'completed','no_answer','voicemail','busy',
    'wrong_number','bounced','failed','pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_status AS ENUM ('granted','withdrawn','pending','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_source AS ENUM (
    'web_form','phone','paper','email','portal','api','imported'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE legal_basis_type AS ENUM (
    'consent','contract','legal_obligation','legitimate_interest','vital_interests'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─── 1. CATÁLOGO DE TIPOS DE ROL ─────────────────────────────

CREATE TABLE IF NOT EXISTS party_role_types (
  code                    VARCHAR(50) PRIMARY KEY,
  label                   VARCHAR(100) NOT NULL,
  description             TEXT,
  -- 'person' | 'organization' | null = cualquiera
  party_type_constraint   VARCHAR(20) CHECK (party_type_constraint IN ('person','organization')),
  is_expediente_role      BOOLEAN NOT NULL DEFAULT FALSE,
  is_system_role          BOOLEAN NOT NULL DEFAULT FALSE,
  display_order           SMALLINT DEFAULT 99,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO party_role_types (code, label, party_type_constraint, is_expediente_role, is_system_role, display_order)
VALUES
  -- Roles en expediente
  ('asegurado',         'Asegurado',            'person',       TRUE,  FALSE, 1),
  ('tomador',           'Tomador de póliza',     NULL,           TRUE,  FALSE, 2),
  ('perjudicado',       'Perjudicado',           'person',       TRUE,  FALSE, 3),
  ('inquilino',         'Inquilino',             'person',       TRUE,  FALSE, 4),
  ('propietario',       'Propietario',           NULL,           TRUE,  FALSE, 5),
  ('testigo',           'Testigo',               'person',       TRUE,  FALSE, 6),
  ('representante',     'Representante legal',   'person',       TRUE,  FALSE, 7),
  -- Roles de sistema
  ('perito',            'Perito',                'person',       FALSE, TRUE,  10),
  ('proveedor',         'Proveedor / Taller',    'organization', FALSE, TRUE,  11),
  ('operario',          'Operario',              'person',       FALSE, TRUE,  12),
  ('contacto_compania', 'Contacto de compañía',  'person',       FALSE, TRUE,  13),
  -- Roles CRM
  ('cliente_b2c',       'Cliente B2C',           'person',       FALSE, FALSE, 20),
  ('cliente_b2b',       'Cliente B2B',           'organization', FALSE, FALSE, 21)
ON CONFLICT (code) DO NOTHING;


-- ─── 2. TABLA CANÓNICA DE PARTIES ────────────────────────────

CREATE TABLE IF NOT EXISTS parties (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type          VARCHAR(20) NOT NULL CHECK (party_type IN ('person', 'organization')),

  -- Persona física
  first_name          VARCHAR(100),
  last_name           VARCHAR(150),
  second_last_name    VARCHAR(150),
  birth_date          DATE,
  gender              VARCHAR(20) CHECK (gender IN ('male','female','other','unknown')),

  -- Persona jurídica
  legal_name          VARCHAR(200),
  trade_name          VARCHAR(200),

  -- Nombre de visualización (calculado por trigger o puesto manual)
  display_name        VARCHAR(300) NOT NULL,

  preferred_language  VARCHAR(10) DEFAULT 'es',
  notes               TEXT,
  tags                TEXT[] DEFAULT '{}',

  -- Deduplicación: merged_into_id → superviviente tras fusión
  merged_into_id      UUID REFERENCES parties(id),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),
  updated_by          UUID REFERENCES auth.users(id),

  search_vector       TSVECTOR,

  CONSTRAINT chk_person_has_name CHECK (
    party_type = 'organization' OR (first_name IS NOT NULL OR last_name IS NOT NULL)
  ),
  CONSTRAINT chk_org_has_name CHECK (
    party_type = 'person' OR legal_name IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_parties_search_vector ON parties USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_parties_display_trgm  ON parties USING GIN(display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parties_active        ON parties(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_parties_type          ON parties(party_type);
CREATE INDEX IF NOT EXISTS idx_parties_merged        ON parties(merged_into_id) WHERE merged_into_id IS NOT NULL;

-- Trigger: mantener search_vector y display_name

CREATE OR REPLACE FUNCTION parties_before_save()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.party_type = 'person' THEN
    NEW.display_name := TRIM(
      COALESCE(NEW.first_name,'') || ' ' ||
      COALESCE(NEW.last_name,'') || ' ' ||
      COALESCE(NEW.second_last_name,'')
    );
  ELSE
    NEW.display_name := COALESCE(NEW.trade_name, NEW.legal_name, '');
  END IF;

  NEW.search_vector :=
    setweight(to_tsvector('spanish', unaccent(COALESCE(NEW.display_name,''))), 'A') ||
    setweight(to_tsvector('spanish', unaccent(COALESCE(NEW.notes,''))), 'D');

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parties_before_save ON parties;
CREATE TRIGGER trg_parties_before_save
  BEFORE INSERT OR UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION parties_before_save();


-- ─── 3. IDENTIFICADORES (DNI / NIE / CIF …) ──────────────────

CREATE TABLE IF NOT EXISTS party_identifiers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id     UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  id_type      VARCHAR(30) NOT NULL
                 CHECK (id_type IN ('dni','nie','cif','passport','other')),
  id_value     VARCHAR(50) NOT NULL,
  country      VARCHAR(3) DEFAULT 'ESP',
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at  TIMESTAMPTZ,
  verified_by  UUID REFERENCES auth.users(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id_type, id_value, country)
);

CREATE INDEX IF NOT EXISTS idx_party_identifiers_party  ON party_identifiers(party_id);
CREATE INDEX IF NOT EXISTS idx_party_identifiers_value  ON party_identifiers(id_value);
CREATE INDEX IF NOT EXISTS idx_party_identifiers_trgm   ON party_identifiers USING GIN(id_value gin_trgm_ops);


-- ─── 4. TELÉFONOS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS party_phones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id         UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  phone_type       VARCHAR(20) DEFAULT 'mobile'
                     CHECK (phone_type IN ('mobile','home','work','fax','other')),
  country_code     VARCHAR(5) DEFAULT '+34',
  number           VARCHAR(20) NOT NULL,
  extension        VARCHAR(10),
  label            VARCHAR(100),
  is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified      BOOLEAN DEFAULT FALSE,
  opt_out_sms      BOOLEAN DEFAULT FALSE,
  opt_out_calls    BOOLEAN DEFAULT FALSE,
  valid_to         DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Columna calculada para deduplicación (solo dígitos)
DO $$ BEGIN
  ALTER TABLE party_phones ADD COLUMN number_normalized VARCHAR(20)
    GENERATED ALWAYS AS (REGEXP_REPLACE(number, '[^0-9]', '', 'g')) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_party_phones_party    ON party_phones(party_id);
CREATE INDEX IF NOT EXISTS idx_party_phones_number   ON party_phones(number_normalized);


-- ─── 5. EMAILS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS party_emails (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id       UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  email          VARCHAR(254) NOT NULL,
  email_type     VARCHAR(20) DEFAULT 'personal'
                   CHECK (email_type IN ('personal','work','other')),
  label          VARCHAR(100),
  is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified    BOOLEAN DEFAULT FALSE,
  opt_out        BOOLEAN DEFAULT FALSE,
  bounced        BOOLEAN DEFAULT FALSE,
  bounced_at     TIMESTAMPTZ,
  valid_to       DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (party_id, email)
);

CREATE INDEX IF NOT EXISTS idx_party_emails_party ON party_emails(party_id);
CREATE INDEX IF NOT EXISTS idx_party_emails_email ON party_emails(LOWER(email));


-- ─── 6. DIRECCIONES ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS party_addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id      UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  address_type  VARCHAR(30) DEFAULT 'home'
                  CHECK (address_type IN (
                    'home','work','billing','shipping','risk_location','postal','other'
                  )),
  label         VARCHAR(100),
  street_line1  VARCHAR(200),
  street_line2  VARCHAR(200),
  postal_code   VARCHAR(10),
  city          VARCHAR(100),
  province      VARCHAR(100),
  country       VARCHAR(3) DEFAULT 'ESP',
  lat           NUMERIC(9,6),
  lng           NUMERIC(9,6),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  valid_to      DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_addresses_party ON party_addresses(party_id);
CREATE INDEX IF NOT EXISTS idx_party_addresses_cp    ON party_addresses(postal_code);


-- ─── 7. ROLES PERSISTENTES DEL SISTEMA ───────────────────────

CREATE TABLE IF NOT EXISTS party_system_roles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id            UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  role_code           VARCHAR(50) NOT NULL REFERENCES party_role_types(code),
  compania_id         UUID REFERENCES companias(id),
  -- Puentes a tablas legacy durante la migración
  legacy_perito_id    UUID,
  legacy_operario_id  UUID,
  legacy_proveedor_id UUID,
  valid_from          DATE DEFAULT CURRENT_DATE,
  valid_to            DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),
  UNIQUE (party_id, role_code)
);

CREATE INDEX IF NOT EXISTS idx_party_system_roles_party ON party_system_roles(party_id);
CREATE INDEX IF NOT EXISTS idx_party_system_roles_code  ON party_system_roles(role_code);


-- ─── 8. PARTICIPANTES EN EXPEDIENTE ──────────────────────────

CREATE TABLE IF NOT EXISTS expediente_participants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  party_id       UUID NOT NULL REFERENCES parties(id),
  role_code      VARCHAR(50) NOT NULL REFERENCES party_role_types(code),

  -- ¿Interviniente principal de este rol en el expediente?
  is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
  order_index    SMALLINT DEFAULT 0,

  -- Atributos por rol (rellenar solo los relevantes)
  poliza_numero           VARCHAR(50),
  cobertura               VARCHAR(100),
  numero_riesgo           VARCHAR(50),
  importe_franquicia      NUMERIC(10,2),
  tipo_dano               TEXT[],          -- perjudicado: ['material','personal']
  importe_reclamado       NUMERIC(10,2),
  contrato_arrendamiento  VARCHAR(100),    -- inquilino/propietario

  notes          TEXT,
  valid_from     DATE DEFAULT CURRENT_DATE,
  valid_to       DATE,

  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id),

  UNIQUE (expediente_id, party_id, role_code)
);

CREATE INDEX IF NOT EXISTS idx_ep_part_expediente ON expediente_participants(expediente_id);
CREATE INDEX IF NOT EXISTS idx_ep_part_party      ON expediente_participants(party_id);
CREATE INDEX IF NOT EXISTS idx_ep_part_role       ON expediente_participants(role_code);


-- ─── 9. HISTORIAL DE INTERACCIONES ───────────────────────────

CREATE TABLE IF NOT EXISTS party_interactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id          UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  expediente_id     UUID REFERENCES expedientes(id),
  interaction_type  interaction_channel NOT NULL,
  direction         VARCHAR(10) CHECK (direction IN ('inbound','outbound','n_a')),
  subject           VARCHAR(500),
  body              TEXT,
  outcome           interaction_outcome DEFAULT 'completed',
  duration_seconds  INTEGER,
  channel_ref       VARCHAR(254),   -- número o email usado
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at      TIMESTAMPTZ,
  agent_id          UUID REFERENCES auth.users(id),
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  attachments       JSONB DEFAULT '[]',
  metadata          JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_interactions_party      ON party_interactions(party_id);
CREATE INDEX IF NOT EXISTS idx_interactions_expediente ON party_interactions(expediente_id);
CREATE INDEX IF NOT EXISTS idx_interactions_occurred   ON party_interactions(occurred_at DESC);


-- ─── 10. CONSENTIMIENTOS (RGPD) ──────────────────────────────

CREATE TABLE IF NOT EXISTS party_consents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id          UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  consent_type      VARCHAR(50) NOT NULL CHECK (consent_type IN (
    'marketing_email','marketing_sms','marketing_push',
    'data_processing','third_party_sharing',
    'profiling','portal_access','cookies'
  )),
  status            consent_status NOT NULL DEFAULT 'pending',
  source            consent_source NOT NULL,
  legal_basis       legal_basis_type NOT NULL DEFAULT 'consent',
  granted_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  withdrawn_at      TIMESTAMPTZ,
  withdrawal_reason TEXT,
  ip_address        INET,
  user_agent        TEXT,
  document_ref      TEXT,
  form_version      VARCHAR(20),
  collected_by      UUID REFERENCES auth.users(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (party_id, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_consents_party  ON party_consents(party_id);
CREATE INDEX IF NOT EXISTS idx_consents_status ON party_consents(status);


-- ─── 11. RELACIONES ENTRE PARTIES ────────────────────────────

CREATE TABLE IF NOT EXISTS party_relationships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_a_id        UUID NOT NULL REFERENCES parties(id),
  party_b_id        UUID NOT NULL REFERENCES parties(id),
  relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN (
    'subsidiary_of','employee_of','parent_of',
    'spouse','partner','sibling',
    'owns_property','rents_property',
    'insures','represents','other'
  )),
  notes             TEXT,
  valid_from        DATE DEFAULT CURRENT_DATE,
  valid_to          DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id),
  CONSTRAINT no_self_relation CHECK (party_a_id <> party_b_id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_a ON party_relationships(party_a_id);
CREATE INDEX IF NOT EXISTS idx_relationships_b ON party_relationships(party_b_id);


-- ─── 12. DEDUPLICACIÓN ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS party_duplicate_candidates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_a_id       UUID NOT NULL REFERENCES parties(id),
  party_b_id       UUID NOT NULL REFERENCES parties(id),
  confidence_score NUMERIC(4,3) NOT NULL,
  match_signals    JSONB NOT NULL DEFAULT '{}',
  status           VARCHAR(25) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed_duplicate','confirmed_different','merged')),
  reviewed_by      UUID REFERENCES auth.users(id),
  reviewed_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_candidate CHECK (party_a_id <> party_b_id)
);

CREATE INDEX IF NOT EXISTS idx_dedup_status ON party_duplicate_candidates(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_dedup_score  ON party_duplicate_candidates(confidence_score DESC);

CREATE TABLE IF NOT EXISTS party_merge_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id      UUID NOT NULL REFERENCES parties(id),
  merged_id        UUID NOT NULL,          -- ya inactivo; no FK para preservar histórico
  merge_reason     TEXT,
  merge_type       VARCHAR(20) CHECK (merge_type IN ('manual','auto_confirmed')),
  confidence_score NUMERIC(4,3),
  merged_by        UUID REFERENCES auth.users(id),
  merged_at        TIMESTAMPTZ DEFAULT NOW(),
  snapshot_before  JSONB NOT NULL
);


-- ─── 13. TRAZABILIDAD DE CAMBIOS ─────────────────────────────

CREATE TABLE IF NOT EXISTS party_audit_log (
  id             BIGSERIAL PRIMARY KEY,
  table_name     VARCHAR(100) NOT NULL,
  record_id      UUID NOT NULL,
  operation      auditoria_accion NOT NULL,
  old_data       JSONB,
  new_data       JSONB,
  changed_fields TEXT[],
  changed_by     UUID REFERENCES auth.users(id),
  changed_at     TIMESTAMPTZ DEFAULT NOW(),
  correlation_id TEXT,
  ip_address     INET
);

CREATE INDEX IF NOT EXISTS idx_audit_record  ON party_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_time    ON party_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON party_audit_log(changed_by);

-- Función de auditoría genérica
CREATE OR REPLACE FUNCTION party_audit_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_changed_fields TEXT[];
  v_old JSONB := to_jsonb(OLD);
  v_new JSONB := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT ARRAY_AGG(k) INTO v_changed_fields
    FROM jsonb_each(v_old) o(k,v)
    WHERE v_old->k IS DISTINCT FROM v_new->k;
  END IF;

  INSERT INTO party_audit_log(
    table_name, record_id, operation, old_data, new_data, changed_fields, changed_by, correlation_id
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE((v_new->>'id')::UUID, (v_old->>'id')::UUID),
    TG_OP::auditoria_accion,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN v_old END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN v_new END,
    v_changed_fields,
    auth.uid(),
    current_setting('request.headers', TRUE)::jsonb->>'x-correlation-id'
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar auditoría a tablas clave
DROP TRIGGER IF EXISTS audit_parties ON parties;
CREATE TRIGGER audit_parties
  AFTER INSERT OR UPDATE OR DELETE ON parties
  FOR EACH ROW EXECUTE FUNCTION party_audit_fn();

DROP TRIGGER IF EXISTS audit_ep_participants ON expediente_participants;
CREATE TRIGGER audit_ep_participants
  AFTER INSERT OR UPDATE OR DELETE ON expediente_participants
  FOR EACH ROW EXECUTE FUNCTION party_audit_fn();

DROP TRIGGER IF EXISTS audit_party_consents ON party_consents;
CREATE TRIGGER audit_party_consents
  AFTER INSERT OR UPDATE OR DELETE ON party_consents
  FOR EACH ROW EXECUTE FUNCTION party_audit_fn();


-- ─── 14. FUNCIÓN: search_parties (RPC) ───────────────────────

CREATE OR REPLACE FUNCTION search_parties(
  p_query      TEXT,
  p_role_code  VARCHAR(50) DEFAULT NULL,
  p_limit      INT DEFAULT 20,
  p_offset     INT DEFAULT 0
)
RETURNS TABLE (
  party_id       UUID,
  party_type     TEXT,
  display_name   TEXT,
  primary_phone  TEXT,
  primary_email  TEXT,
  primary_id     TEXT,
  system_roles   TEXT[],
  match_rank     REAL
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.party_type,
    p.display_name,
    ph.number,
    em.email,
    pi_doc.id_value,
    ARRAY(
      SELECT psr.role_code FROM party_system_roles psr
      WHERE psr.party_id = p.id
        AND (psr.valid_to IS NULL OR psr.valid_to > CURRENT_DATE)
    ),
    (
      ts_rank(p.search_vector, websearch_to_tsquery('spanish', unaccent(p_query))) +
      similarity(p.display_name, p_query)
    )::REAL AS rank
  FROM parties p
  LEFT JOIN LATERAL (
    SELECT number FROM party_phones WHERE party_id = p.id AND is_primary LIMIT 1
  ) ph ON TRUE
  LEFT JOIN LATERAL (
    SELECT email FROM party_emails WHERE party_id = p.id AND is_primary LIMIT 1
  ) em ON TRUE
  LEFT JOIN LATERAL (
    SELECT id_value FROM party_identifiers WHERE party_id = p.id AND is_primary LIMIT 1
  ) pi_doc ON TRUE
  WHERE
    p.is_active = TRUE
    AND p.merged_into_id IS NULL
    AND (
      p_role_code IS NULL
      OR EXISTS (
        SELECT 1 FROM party_system_roles psr2
        WHERE psr2.party_id = p.id AND psr2.role_code = p_role_code
      )
    )
    AND (
      p.search_vector @@ websearch_to_tsquery('spanish', unaccent(p_query))
      OR p.display_name % p_query
      OR EXISTS (
        SELECT 1 FROM party_identifiers pi2
        WHERE pi2.party_id = p.id AND pi2.id_value ILIKE p_query || '%'
      )
      OR EXISTS (
        SELECT 1 FROM party_phones ph2
        WHERE ph2.party_id = p.id
          AND ph2.number_normalized LIKE '%' || REGEXP_REPLACE(p_query,'[^0-9]','','g') || '%'
          AND LENGTH(REGEXP_REPLACE(p_query,'[^0-9]','','g')) >= 6
      )
      OR EXISTS (
        SELECT 1 FROM party_emails em2
        WHERE em2.party_id = p.id AND em2.email ILIKE '%' || p_query || '%'
      )
    )
  ORDER BY rank DESC
  LIMIT p_limit OFFSET p_offset;
$$;


-- ─── 15. FUNCIÓN: merge_parties ───────────────────────────────

CREATE OR REPLACE FUNCTION merge_parties(
  p_survivor UUID,
  p_merged   UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Solo admin puede fusionar
  IF get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: Solo administradores pueden fusionar parties';
  END IF;

  IF p_survivor = p_merged THEN
    RAISE EXCEPTION 'INVALID_ARGS: survivor y merged no pueden ser el mismo party';
  END IF;

  -- Reasignar sub-tablas al superviviente
  UPDATE party_phones      SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_emails      SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_addresses   SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_identifiers SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_system_roles SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_interactions SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_relationships
    SET party_a_id = p_survivor WHERE party_a_id = p_merged;
  UPDATE party_relationships
    SET party_b_id = p_survivor WHERE party_b_id = p_merged;
  UPDATE expediente_participants
    SET party_id = p_survivor
    WHERE party_id = p_merged;

  -- Snapshot + log
  INSERT INTO party_merge_log (
    survivor_id, merged_id, merge_type, merged_by, snapshot_before
  )
  SELECT p_survivor, p_merged, 'manual', auth.uid(), to_jsonb(p.*)
  FROM parties p WHERE p.id = p_merged;

  -- Marcar como fusionado e inactivo
  UPDATE parties
  SET merged_into_id = p_survivor, is_active = FALSE, updated_at = NOW()
  WHERE id = p_merged;

  -- Cerrar candidatos de duplicado
  UPDATE party_duplicate_candidates
  SET status = 'merged', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE (party_a_id = p_survivor AND party_b_id = p_merged)
     OR (party_a_id = p_merged  AND party_b_id = p_survivor);
END;
$$;


-- ─── 16. RLS ─────────────────────────────────────────────────

ALTER TABLE parties                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_identifiers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_phones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_emails            ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_addresses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_system_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expediente_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_interactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_consents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_relationships     ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_audit_log         ENABLE ROW LEVEL SECURITY;

-- ── parties ──

DO $$ BEGIN DROP POLICY IF EXISTS "parties_office_all" ON parties; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "parties_office_all" ON parties
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']))
  WITH CHECK (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']));

DO $$ BEGIN DROP POLICY IF EXISTS "parties_perito_select" ON parties; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "parties_perito_select" ON parties
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'perito'
    AND EXISTS (
      SELECT 1 FROM expediente_participants ep
      JOIN expedientes e ON e.id = ep.expediente_id
      WHERE ep.party_id = parties.id
        AND e.perito_id IN (
          SELECT p2.id FROM peritos p2 WHERE p2.user_id = auth.uid()
        )
    )
  );

DO $$ BEGIN DROP POLICY IF EXISTS "parties_operario_select" ON parties; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "parties_operario_select" ON parties
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'operario'
    AND EXISTS (
      SELECT 1 FROM expediente_participants ep
      JOIN visitas v ON v.expediente_id = ep.expediente_id
      WHERE ep.party_id = parties.id
        AND v.operario_id IN (
          SELECT o.id FROM operarios o WHERE o.user_id = auth.uid()
        )
    )
  );

-- ── sub-tablas: misma visibilidad que parties ──

DO $$ BEGIN DROP POLICY IF EXISTS "party_phones_office" ON party_phones; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "party_phones_office" ON party_phones
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']));

DO $$ BEGIN DROP POLICY IF EXISTS "party_emails_office" ON party_emails; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "party_emails_office" ON party_emails
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']));

DO $$ BEGIN DROP POLICY IF EXISTS "party_addresses_office" ON party_addresses; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "party_addresses_office" ON party_addresses
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']));

DO $$ BEGIN DROP POLICY IF EXISTS "party_identifiers_office" ON party_identifiers; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "party_identifiers_office" ON party_identifiers
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']));

-- ── expediente_participants: office + perito (sus expedientes) ──

DO $$ BEGIN DROP POLICY IF EXISTS "ep_part_office" ON expediente_participants; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "ep_part_office" ON expediente_participants
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']));

DO $$ BEGIN DROP POLICY IF EXISTS "ep_part_perito" ON expediente_participants; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "ep_part_perito" ON expediente_participants
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'perito'
    AND EXISTS (
      SELECT 1 FROM expedientes e
      JOIN peritos p ON p.id = e.perito_id
      WHERE e.id = expediente_participants.expediente_id
        AND p.user_id = auth.uid()
    )
  );

-- ── interactions: office ──

DO $$ BEGIN DROP POLICY IF EXISTS "interactions_office" ON party_interactions; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "interactions_office" ON party_interactions
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']));

-- ── consents: solo admin y dpo ──

DO $$ BEGIN DROP POLICY IF EXISTS "consents_admin" ON party_consents; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "consents_admin" ON party_consents
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','dpo']));

-- ── dedup candidates: admin y supervisor ──

DO $$ BEGIN DROP POLICY IF EXISTS "dedup_admin_supervisor" ON party_duplicate_candidates; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "dedup_admin_supervisor" ON party_duplicate_candidates
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor']));

-- ── audit log: solo admin ──

DO $$ BEGIN DROP POLICY IF EXISTS "audit_admin_only" ON party_audit_log; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "audit_admin_only" ON party_audit_log
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- ── system_roles y relationships: office ──

DO $$ BEGIN DROP POLICY IF EXISTS "system_roles_office" ON party_system_roles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "system_roles_office" ON party_system_roles
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']));

DO $$ BEGIN DROP POLICY IF EXISTS "relationships_office" ON party_relationships; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "relationships_office" ON party_relationships
  FOR ALL TO authenticated
  USING (get_my_role() = ANY(ARRAY['admin','supervisor','tramitador','financiero','direccion']));


-- ─── 17. REALTIME ────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE parties;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE expediente_participants;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
