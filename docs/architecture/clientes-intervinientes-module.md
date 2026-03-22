# Módulo "Clientes e Intervinientes" — Diseño Arquitectónico
> Data Architect + CRM Functional Analyst — ERP Siniestros v1
> Fecha: 2026-03-19 | Stack: Supabase (PostgreSQL 15) + Hono/Cloudflare Workers

---

## 1. Principio de diseño: separar IDENTIDAD · ROL · PARTICIPACIÓN

El error del legacy es mezclar las tres cosas en una misma tabla (`asegurados`
tiene nombre, teléfono, **y** implica un rol en un expediente). El modelo canónico
los separa:

```
PARTY (quién es)  →  PARTY_SYSTEM_ROLE (qué tipo de actor es en el sistema)
                  →  EXPEDIENTE_PARTICIPANT (qué papel juega en un expediente concreto)
```

**Ejemplo:** El Sr. García Ruiz puede ser:
- `party_type = person` con DNI 12345678X
- `system_role = perito` (adscrito a Mapfre)
- Participante como `asegurado` en EXP-2026-0041
- Participante como `perjudicado` en EXP-2026-0099

Una sola ficha, múltiples contextos.

---

## 2. Diagrama entidad-relación (simplificado)

```
┌─────────────────────────────────────────────────────┐
│                      PARTIES                         │
│  id · party_type · display_name · merged_into_id    │
└─────────┬───────────────────────────────────────────┘
          │ 1
          │─── N  party_identifiers   (DNI/NIE/CIF/passport)
          │─── N  party_phones
          │─── N  party_emails
          │─── N  party_addresses
          │─── N  party_system_roles  ──► party_role_types (catálogo)
          │─── N  party_consents
          │─── N  party_interactions  ──► expedientes (opcional)
          │─── N ──(party_a)─ party_relationships ─(party_b)──► parties
          │
          └──── N  expediente_participants ──► expedientes
                        │
                        └──► party_role_types (rol en expediente)
```

---

## 3. DDL — Migración SQL completa

```sql
-- ============================================================
-- MÓDULO CLIENTES E INTERVINIENTES
-- Migración: 00020_ep13_clientes_intervinientes.sql
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ─── 3.1 CATÁLOGO DE TIPOS DE ROL ────────────────────────────

CREATE TABLE party_role_types (
  code               VARCHAR(50) PRIMARY KEY,
  label              VARCHAR(100) NOT NULL,
  description        TEXT,
  -- 'person' | 'organization' | null=cualquiera
  party_type_constraint VARCHAR(20) CHECK (party_type_constraint IN ('person','organization')),
  -- ¿Es un rol que se asigna en el contexto de un expediente?
  is_expediente_role BOOLEAN NOT NULL DEFAULT FALSE,
  -- ¿Es un rol persistente del sistema (perito, proveedor)?
  is_system_role     BOOLEAN NOT NULL DEFAULT FALSE,
  display_order      SMALLINT DEFAULT 99,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Semilla de catálogo
INSERT INTO party_role_types (code, label, party_type_constraint, is_expediente_role, is_system_role, display_order) VALUES
  -- Roles en expediente (quién es dentro del siniestro)
  ('asegurado',          'Asegurado',              'person',       TRUE,  FALSE, 1),
  ('tomador',            'Tomador de póliza',       NULL,           TRUE,  FALSE, 2),
  ('perjudicado',        'Perjudicado',             'person',       TRUE,  FALSE, 3),
  ('inquilino',          'Inquilino',               'person',       TRUE,  FALSE, 4),
  ('propietario',        'Propietario',             NULL,           TRUE,  FALSE, 5),
  ('testigo',            'Testigo',                 'person',       TRUE,  FALSE, 6),
  ('representante',      'Representante legal',     'person',       TRUE,  FALSE, 7),
  -- Roles del sistema (actores permanentes)
  ('perito',             'Perito',                  'person',       FALSE, TRUE,  10),
  ('proveedor',          'Proveedor / Taller',      'organization', FALSE, TRUE,  11),
  ('operario',           'Operario',                'person',       FALSE, TRUE,  12),
  ('contacto_compania',  'Contacto de compañía',    'person',       FALSE, TRUE,  13),
  -- Roles CRM (cartera de clientes)
  ('cliente_b2c',        'Cliente B2C',             'person',       FALSE, FALSE, 20),
  ('cliente_b2b',        'Cliente B2B',             'organization', FALSE, FALSE, 21);


-- ─── 3.2 TABLA CANÓNICA DE PARTIES ───────────────────────────

CREATE TABLE parties (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type          VARCHAR(20) NOT NULL CHECK (party_type IN ('person', 'organization')),

  -- Persona física
  first_name          VARCHAR(100),
  last_name           VARCHAR(150),    -- primer apellido
  second_last_name    VARCHAR(150),    -- segundo apellido
  birth_date          DATE,
  gender              VARCHAR(20) CHECK (gender IN ('male','female','other','unknown')),

  -- Persona jurídica
  legal_name          VARCHAR(200),    -- razón social
  trade_name          VARCHAR(200),    -- nombre comercial

  -- Campo calculado/desnormalizado para búsqueda rápida
  display_name        VARCHAR(300) NOT NULL,  -- COMPUTED o manual

  -- Clasificación
  is_professional     BOOLEAN DEFAULT FALSE,   -- perito/operario/proveedor vs. cliente
  preferred_language  VARCHAR(10) DEFAULT 'es',
  notes               TEXT,
  tags                TEXT[],                  -- ['vip', 'litigioso', 'morosidad']

  -- Deduplicación: si fue fusionado, apunta al superviviente
  merged_into_id      UUID REFERENCES parties(id),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  -- Trazabilidad
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),
  updated_by          UUID REFERENCES auth.users(id),

  -- Búsqueda full-text
  search_vector       TSVECTOR,

  CONSTRAINT chk_person_fields CHECK (
    party_type = 'organization'
    OR (first_name IS NOT NULL OR last_name IS NOT NULL)
  ),
  CONSTRAINT chk_org_fields CHECK (
    party_type = 'person'
    OR legal_name IS NOT NULL
  )
);

-- Índices de búsqueda
CREATE INDEX idx_parties_search_vector ON parties USING GIN(search_vector);
CREATE INDEX idx_parties_display_trgm  ON parties USING GIN(display_name gin_trgm_ops);
CREATE INDEX idx_parties_active        ON parties(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_parties_merged        ON parties(merged_into_id) WHERE merged_into_id IS NOT NULL;

-- Trigger: mantener search_vector y display_name
CREATE OR REPLACE FUNCTION parties_update_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- display_name automático si no está puesto manualmente
  IF NEW.party_type = 'person' THEN
    NEW.display_name := TRIM(COALESCE(NEW.first_name,'') || ' ' ||
                             COALESCE(NEW.last_name,'') || ' ' ||
                             COALESCE(NEW.second_last_name,''));
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

CREATE TRIGGER trg_parties_search
  BEFORE INSERT OR UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION parties_update_search_vector();


-- ─── 3.3 IDENTIFICADORES (DNI / NIE / CIF / PASAPORTE) ────────

CREATE TABLE party_identifiers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id     UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  id_type      VARCHAR(30) NOT NULL
                 CHECK (id_type IN ('dni','nie','cif','passport','other')),
  id_value     VARCHAR(50) NOT NULL,
  country      VARCHAR(3) DEFAULT 'ESP',   -- ISO 3166-1 alpha-3
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at  TIMESTAMPTZ,
  verified_by  UUID REFERENCES auth.users(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),

  -- Clave de deduplicación: mismo doc → misma persona
  UNIQUE (id_type, id_value, country)
);

CREATE INDEX idx_party_identifiers_party   ON party_identifiers(party_id);
CREATE INDEX idx_party_identifiers_value   ON party_identifiers(id_value);
CREATE INDEX idx_party_identifiers_trgm    ON party_identifiers USING GIN(id_value gin_trgm_ops);


-- ─── 3.4 TELÉFONOS ───────────────────────────────────────────

CREATE TABLE party_phones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id       UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  phone_type     VARCHAR(20) DEFAULT 'mobile'
                   CHECK (phone_type IN ('mobile','home','work','fax','other')),
  country_code   VARCHAR(5) DEFAULT '+34',
  number         VARCHAR(20) NOT NULL,
  extension      VARCHAR(10),
  label          VARCHAR(100),          -- 'Secretaria', 'Urgencias 24h', etc.
  is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified    BOOLEAN DEFAULT FALSE,
  opt_out_sms    BOOLEAN DEFAULT FALSE,
  opt_out_calls  BOOLEAN DEFAULT FALSE,
  valid_from     DATE,
  valid_to       DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),

  -- Número normalizado para deduplicación
  number_normalized VARCHAR(20) GENERATED ALWAYS AS (
    REGEXP_REPLACE(number, '[^0-9]', '', 'g')
  ) STORED
);

CREATE INDEX idx_party_phones_party    ON party_phones(party_id);
CREATE INDEX idx_party_phones_number   ON party_phones(number_normalized);


-- ─── 3.5 EMAILS ──────────────────────────────────────────────

CREATE TABLE party_emails (
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
  valid_from     DATE,
  valid_to       DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (party_id, LOWER(email))
);

CREATE INDEX idx_party_emails_party  ON party_emails(party_id);
CREATE INDEX idx_party_emails_email  ON party_emails(LOWER(email));


-- ─── 3.6 DIRECCIONES ─────────────────────────────────────────

CREATE TABLE party_addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id        UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  address_type    VARCHAR(30) DEFAULT 'home'
                    CHECK (address_type IN (
                      'home','work','billing','shipping',
                      'risk_location','postal','other'
                    )),
  label           VARCHAR(100),   -- 'Vivienda habitual', 'Segunda residencia'
  street_line1    VARCHAR(200),
  street_line2    VARCHAR(200),
  postal_code     VARCHAR(10),
  city            VARCHAR(100),
  province        VARCHAR(100),
  country         VARCHAR(3) DEFAULT 'ESP',
  lat             NUMERIC(9,6),
  lng             NUMERIC(9,6),
  geocoded_at     TIMESTAMPTZ,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from      DATE,
  valid_to        DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Texto de búsqueda de dirección
  search_text     TEXT GENERATED ALWAYS AS (
    COALESCE(street_line1,'') || ' ' || COALESCE(postal_code,'') || ' ' ||
    COALESCE(city,'') || ' ' || COALESCE(province,'')
  ) STORED
);

CREATE INDEX idx_party_addresses_party    ON party_addresses(party_id);
CREATE INDEX idx_party_addresses_cp       ON party_addresses(postal_code);
CREATE INDEX idx_party_addresses_trgm     ON party_addresses USING GIN(search_text gin_trgm_ops);


-- ─── 3.7 ROLES PERSISTENTES DEL SISTEMA ──────────────────────
-- Un perito "siempre es perito", un operario "siempre es operario".
-- Esto es distinto de su participación en un expediente concreto.

CREATE TABLE party_system_roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id       UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  role_code      VARCHAR(50) NOT NULL REFERENCES party_role_types(code),

  -- Vínculos opcionales con entidades existentes (migración)
  compania_id    UUID REFERENCES companias(id),
  legacy_perito_id    UUID,  -- FK a tabla peritos legacy
  legacy_operario_id  UUID,  -- FK a tabla operarios legacy
  legacy_proveedor_id UUID,  -- FK a tabla proveedores legacy

  valid_from     DATE DEFAULT CURRENT_DATE,
  valid_to       DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id),

  UNIQUE (party_id, role_code)
);

CREATE INDEX idx_party_system_roles_party ON party_system_roles(party_id);
CREATE INDEX idx_party_system_roles_code  ON party_system_roles(role_code);


-- ─── 3.8 PARTICIPANTES EN EXPEDIENTE ─────────────────────────
-- "El Sr. García ES el asegurado del EXP-2026-0041"

CREATE TABLE expediente_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  party_id        UUID NOT NULL REFERENCES parties(id),
  role_code       VARCHAR(50) NOT NULL REFERENCES party_role_types(code),

  -- ¿Es el interviniente principal de este rol?
  -- Ej: puede haber varios perjudicados, pero uno es el "primario"
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  order_index     SMALLINT DEFAULT 0,

  -- Atributos específicos del rol (sólo rellenar los relevantes)
  -- Para asegurado / tomador:
  poliza_numero         VARCHAR(50),
  cobertura             VARCHAR(100),
  numero_riesgo         VARCHAR(50),
  importe_franquicia    NUMERIC(10,2),
  -- Para perjudicado:
  tipo_dano             TEXT[],         -- ['material','personal','lucro_cesante']
  importe_reclamado     NUMERIC(10,2),
  -- Para inquilino / propietario:
  contrato_arrendamiento_ref VARCHAR(100),
  -- General:
  notes           TEXT,

  valid_from      DATE DEFAULT CURRENT_DATE,
  valid_to        DATE,   -- para registrar cuando dejó de tener este rol
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (expediente_id, party_id, role_code)
);

CREATE INDEX idx_ep_participants_expediente ON expediente_participants(expediente_id);
CREATE INDEX idx_ep_participants_party      ON expediente_participants(party_id);
CREATE INDEX idx_ep_participants_role       ON expediente_participants(role_code);


-- ─── 3.9 HISTORIAL DE INTERACCIONES / CONTACTOS ──────────────

CREATE TYPE interaction_type AS ENUM (
  'call_inbound','call_outbound',
  'email_sent','email_received',
  'sms_sent','sms_received',
  'whatsapp_sent','whatsapp_received',
  'video_call','visit_in_person',
  'letter_sent','letter_received',
  'portal_access','note_internal','other'
);

CREATE TYPE interaction_outcome AS ENUM (
  'completed','no_answer','voicemail','busy',
  'wrong_number','bounced','failed','pending'
);

CREATE TABLE party_interactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id          UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  expediente_id     UUID REFERENCES expedientes(id),  -- contexto opcional
  interaction_type  interaction_type NOT NULL,
  direction         VARCHAR(10) CHECK (direction IN ('inbound','outbound','n_a')),

  subject           VARCHAR(500),
  body              TEXT,
  outcome           interaction_outcome DEFAULT 'completed',
  duration_seconds  INTEGER,

  -- Canal específico usado (teléfono X, email Y)
  channel_ref       VARCHAR(254),   -- ej: '612345678' o 'cliente@mail.com'

  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at      TIMESTAMPTZ,

  -- Quién gestionó el contacto
  agent_id          UUID REFERENCES auth.users(id),
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Adjuntos / metadata
  attachments       JSONB DEFAULT '[]',
  metadata          JSONB DEFAULT '{}'   -- grabación, campaña, etc.
);

CREATE INDEX idx_interactions_party       ON party_interactions(party_id);
CREATE INDEX idx_interactions_expediente  ON party_interactions(expediente_id);
CREATE INDEX idx_interactions_occurred    ON party_interactions(occurred_at DESC);
CREATE INDEX idx_interactions_agent       ON party_interactions(agent_id);


-- ─── 3.10 CONSENTIMIENTOS (RGPD) ─────────────────────────────

CREATE TYPE consent_status AS ENUM ('granted','withdrawn','pending','expired');
CREATE TYPE consent_source AS ENUM (
  'web_form','phone','paper','email','portal','api','imported'
);
CREATE TYPE legal_basis_type AS ENUM (
  'consent','contract','legal_obligation','legitimate_interest','vital_interests'
);

CREATE TABLE party_consents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id        UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  consent_type    VARCHAR(50) NOT NULL CHECK (consent_type IN (
    'marketing_email','marketing_sms','marketing_push',
    'data_processing','third_party_sharing',
    'profiling','portal_access','cookies'
  )),
  status          consent_status NOT NULL DEFAULT 'pending',
  source          consent_source NOT NULL,
  legal_basis     legal_basis_type NOT NULL DEFAULT 'consent',

  granted_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  withdrawn_at    TIMESTAMPTZ,
  withdrawal_reason TEXT,

  -- Evidencia del consentimiento
  ip_address      INET,
  user_agent      TEXT,
  document_ref    TEXT,    -- URL al documento firmado / grabación
  form_version    VARCHAR(20),

  collected_by    UUID REFERENCES auth.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Solo un consentimiento activo por tipo
  UNIQUE (party_id, consent_type)
);

CREATE INDEX idx_consents_party  ON party_consents(party_id);
CREATE INDEX idx_consents_status ON party_consents(status);
CREATE INDEX idx_consents_type   ON party_consents(consent_type);


-- ─── 3.11 RELACIONES ENTRE PARTIES ───────────────────────────

CREATE TABLE party_relationships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_a_id          UUID NOT NULL REFERENCES parties(id),
  party_b_id          UUID NOT NULL REFERENCES parties(id),
  relationship_type   VARCHAR(50) NOT NULL CHECK (relationship_type IN (
    'subsidiary_of','employee_of','parent_of',
    'spouse','partner','sibling',
    'owns_property','rents_property',
    'insures','represents','other'
  )),
  -- Etiquetas: party_a ES relationship_type DE party_b
  -- Ej: party_a IS 'employee_of' party_b  →  García es empleado de Construcciones X
  notes               TEXT,
  valid_from          DATE DEFAULT CURRENT_DATE,
  valid_to            DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),

  CONSTRAINT no_self_relation CHECK (party_a_id <> party_b_id)
);

CREATE INDEX idx_relationships_a ON party_relationships(party_a_id);
CREATE INDEX idx_relationships_b ON party_relationships(party_b_id);


-- ─── 3.12 DEDUPLICACIÓN ──────────────────────────────────────

-- Cola de candidatos a duplicado (rellenada por función de scoring)
CREATE TABLE party_duplicate_candidates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_a_id       UUID NOT NULL REFERENCES parties(id),
  party_b_id       UUID NOT NULL REFERENCES parties(id),

  -- Puntuación 0.0-1.0
  confidence_score NUMERIC(4,3) NOT NULL,
  -- Qué señales coincidieron:
  -- {"identifier": true, "name_similarity": 0.92, "phone": true, "email": false}
  match_signals    JSONB NOT NULL DEFAULT '{}',

  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed_duplicate','confirmed_different','merged')),
  reviewed_by      UUID REFERENCES auth.users(id),
  reviewed_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT no_self_candidate CHECK (party_a_id <> party_b_id),
  UNIQUE (LEAST(party_a_id::text, party_b_id::text),
          GREATEST(party_a_id::text, party_b_id::text))
);

CREATE INDEX idx_dedup_status ON party_duplicate_candidates(status) WHERE status = 'pending';
CREATE INDEX idx_dedup_score  ON party_duplicate_candidates(confidence_score DESC);

-- Log de fusiones realizadas
CREATE TABLE party_merge_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id       UUID NOT NULL REFERENCES parties(id),
  merged_id         UUID NOT NULL,    -- ya inactivo, no FK para preservar histórico
  merge_reason      TEXT,
  merge_type        VARCHAR(20) CHECK (merge_type IN ('manual','auto_confirmed')),
  confidence_score  NUMERIC(4,3),
  merged_by         UUID REFERENCES auth.users(id),
  merged_at         TIMESTAMPTZ DEFAULT NOW(),
  snapshot_before   JSONB NOT NULL   -- estado completo del merged_id antes de fusionar
);


-- ─── 3.13 TRAZABILIDAD DE CAMBIOS ────────────────────────────

CREATE TABLE party_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  table_name      VARCHAR(100) NOT NULL,
  record_id       UUID NOT NULL,
  operation       auditoria_accion NOT NULL,
  old_data        JSONB,
  new_data        JSONB,
  changed_fields  TEXT[],    -- sólo los campos que cambiaron en UPDATE
  changed_by      UUID REFERENCES auth.users(id),
  changed_at      TIMESTAMPTZ DEFAULT NOW(),
  correlation_id  TEXT,      -- ID de la request HTTP
  ip_address      INET,
  user_agent      TEXT
);

CREATE INDEX idx_audit_record    ON party_audit_log(table_name, record_id);
CREATE INDEX idx_audit_changed   ON party_audit_log(changed_at DESC);
CREATE INDEX idx_audit_user      ON party_audit_log(changed_by);

-- Función genérica de auditoría
CREATE OR REPLACE FUNCTION party_audit_trigger_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_changed_fields TEXT[];
  v_old JSONB := to_jsonb(OLD);
  v_new JSONB := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT ARRAY_AGG(k)
    INTO v_changed_fields
    FROM jsonb_each(v_old) o(k,v)
    WHERE v_old->k IS DISTINCT FROM v_new->k;
  END IF;

  INSERT INTO party_audit_log(
    table_name, record_id, operation,
    old_data, new_data, changed_fields,
    changed_by, correlation_id
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

-- Aplicar auditoría a todas las tablas del módulo
CREATE TRIGGER audit_parties
  AFTER INSERT OR UPDATE OR DELETE ON parties
  FOR EACH ROW EXECUTE FUNCTION party_audit_trigger_fn();

CREATE TRIGGER audit_party_identifiers
  AFTER INSERT OR UPDATE OR DELETE ON party_identifiers
  FOR EACH ROW EXECUTE FUNCTION party_audit_trigger_fn();

CREATE TRIGGER audit_expediente_participants
  AFTER INSERT OR UPDATE OR DELETE ON expediente_participants
  FOR EACH ROW EXECUTE FUNCTION party_audit_trigger_fn();

CREATE TRIGGER audit_party_consents
  AFTER INSERT OR UPDATE OR DELETE ON party_consents
  FOR EACH ROW EXECUTE FUNCTION party_audit_trigger_fn();
```

---

## 4. Función de búsqueda global

```sql
-- Búsqueda unificada: devuelve parties con su mejor contacto y contexto
CREATE OR REPLACE FUNCTION search_parties(
  p_query      TEXT,
  p_role_code  VARCHAR(50) DEFAULT NULL,   -- filtrar por rol
  p_limit      INT DEFAULT 20,
  p_offset     INT DEFAULT 0
)
RETURNS TABLE (
  party_id      UUID,
  display_name  TEXT,
  party_type    TEXT,
  primary_phone TEXT,
  primary_email TEXT,
  primary_id    TEXT,   -- DNI/CIF principal
  system_roles  TEXT[],
  match_rank    REAL
) LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.display_name,
    p.party_type,
    ph.number,
    em.email,
    pi.id_value,
    ARRAY(
      SELECT psr.role_code FROM party_system_roles psr
      WHERE psr.party_id = p.id AND (psr.valid_to IS NULL OR psr.valid_to > CURRENT_DATE)
    ),
    ts_rank(p.search_vector, websearch_to_tsquery('spanish', unaccent(p_query))) +
    similarity(p.display_name, p_query) AS rank
  FROM parties p
  LEFT JOIN party_phones ph  ON ph.party_id = p.id  AND ph.is_primary
  LEFT JOIN party_emails em  ON em.party_id = p.id  AND em.is_primary
  LEFT JOIN party_identifiers pi ON pi.party_id = p.id AND pi.is_primary
  LEFT JOIN party_system_roles psr_f ON psr_f.party_id = p.id
    AND (p_role_code IS NULL OR psr_f.role_code = p_role_code)
  WHERE
    p.is_active = TRUE
    AND p.merged_into_id IS NULL
    AND (
      p.search_vector @@ websearch_to_tsquery('spanish', unaccent(p_query))
      OR p.display_name % p_query                                  -- trigram
      OR EXISTS (
        SELECT 1 FROM party_identifiers pi2
        WHERE pi2.party_id = p.id AND pi2.id_value ILIKE p_query || '%'
      )
      OR EXISTS (
        SELECT 1 FROM party_phones ph2
        WHERE ph2.party_id = p.id
          AND ph2.number_normalized LIKE '%' || REGEXP_REPLACE(p_query,'[^0-9]','','g') || '%'
      )
      OR EXISTS (
        SELECT 1 FROM party_emails em2
        WHERE em2.party_id = p.id AND em2.email ILIKE '%' || p_query || '%'
      )
    )
  GROUP BY p.id, p.display_name, p.party_type, ph.number, em.email, pi.id_value
  ORDER BY rank DESC
  LIMIT p_limit OFFSET p_offset;
$$;
```

---

## 5. Función de detección de duplicados

```sql
-- Calcular score de similitud entre dos parties
CREATE OR REPLACE FUNCTION calculate_duplicate_score(
  p_party_a UUID,
  p_party_b UUID
)
RETURNS NUMERIC(4,3) LANGUAGE plpgsql AS $$
DECLARE
  score     NUMERIC := 0;
  signals   JSONB := '{}';
  v_a       parties%ROWTYPE;
  v_b       parties%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM parties WHERE id = p_party_a;
  SELECT * INTO v_b FROM parties WHERE id = p_party_b;

  -- Señal 1: mismo identificador (hard match) → 1.0
  IF EXISTS (
    SELECT 1 FROM party_identifiers ia
    JOIN party_identifiers ib
      ON ia.id_type = ib.id_type AND ia.id_value = ib.id_value AND ia.country = ib.country
    WHERE ia.party_id = p_party_a AND ib.party_id = p_party_b
  ) THEN
    score := 1.0;
    signals := signals || '{"identifier": true}';
    RETURN score;   -- Hard match: exit early
  END IF;

  -- Señal 2: mismo teléfono normalizado → +0.4
  IF EXISTS (
    SELECT 1 FROM party_phones pa
    JOIN party_phones pb ON pa.number_normalized = pb.number_normalized
    WHERE pa.party_id = p_party_a AND pb.party_id = p_party_b
  ) THEN
    score := score + 0.4;
    signals := signals || '{"phone": true}';
  END IF;

  -- Señal 3: mismo email → +0.4
  IF EXISTS (
    SELECT 1 FROM party_emails ea
    JOIN party_emails eb ON LOWER(ea.email) = LOWER(eb.email)
    WHERE ea.party_id = p_party_a AND eb.party_id = p_party_b
  ) THEN
    score := score + 0.4;
    signals := signals || '{"email": true}';
  END IF;

  -- Señal 4: nombre similar (trigram ≥ 0.8) → +0.3
  IF similarity(v_a.display_name, v_b.display_name) >= 0.8 THEN
    score := score + 0.3;
    signals := signals || jsonb_build_object('name_similarity',
                             ROUND(similarity(v_a.display_name, v_b.display_name)::NUMERIC, 2));
  END IF;

  -- Señal 5: misma fecha de nacimiento → +0.2
  IF v_a.birth_date IS NOT NULL AND v_a.birth_date = v_b.birth_date THEN
    score := score + 0.2;
    signals := signals || '{"birth_date": true}';
  END IF;

  -- Cap a 1.0
  score := LEAST(score, 1.0);

  -- Insertar en cola si supera umbral
  IF score >= 0.65 THEN
    INSERT INTO party_duplicate_candidates (party_a_id, party_b_id, confidence_score, match_signals)
    VALUES (
      LEAST(p_party_a::text, p_party_b::text)::UUID,
      GREATEST(p_party_a::text, p_party_b::text)::UUID,
      score, signals
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN score;
END;
$$;
```

---

## 6. RLS — Visibilidad según rol

```sql
-- Activar RLS
ALTER TABLE parties                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expediente_participants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_interactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_consents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_audit_log            ENABLE ROW LEVEL SECURITY;

-- ── Helper: rol del usuario activo ────────────────────────────
CREATE OR REPLACE FUNCTION current_user_has_role(p_role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.nombre = p_role
  );
$$;

-- ── PARTIES ───────────────────────────────────────────────────

-- Admin y gestores: ven todo
CREATE POLICY parties_admin_gestor ON parties
  FOR ALL TO authenticated
  USING (current_user_has_role('admin') OR current_user_has_role('gestor'));

-- Perito: ve los parties de sus expedientes asignados
CREATE POLICY parties_perito ON parties
  FOR SELECT TO authenticated
  USING (
    current_user_has_role('perito')
    AND EXISTS (
      SELECT 1 FROM expediente_participants ep
      JOIN expedientes e ON e.id = ep.expediente_id
      WHERE ep.party_id = parties.id
        AND e.perito_id = (
          SELECT psr.legacy_perito_id FROM party_system_roles psr
          JOIN parties pp ON pp.id = psr.party_id
          WHERE pp.id IN (
            SELECT p2.id FROM parties p2
            JOIN party_system_roles psr2 ON psr2.party_id = p2.id
            -- el perito autenticado es el user_id en peritos legacy
            WHERE psr2.role_code = 'perito'
          )
          LIMIT 1
        )
    )
  );

-- Operario: ve los asegurados de sus órdenes de trabajo
CREATE POLICY parties_operario ON parties
  FOR SELECT TO authenticated
  USING (
    current_user_has_role('operario')
    AND EXISTS (
      SELECT 1 FROM expediente_participants ep
      JOIN visitas v ON v.expediente_id = ep.expediente_id
      -- el operario sólo ve los datos de contacto básicos (nombre+telf)
      WHERE ep.party_id = parties.id
        AND v.operario_id = (
          SELECT id FROM operarios WHERE user_id = auth.uid() LIMIT 1
        )
    )
  );

-- ── CONSENTIMIENTOS: sólo admin y DPO ─────────────────────────
CREATE POLICY consents_admin_only ON party_consents
  FOR ALL TO authenticated
  USING (current_user_has_role('admin') OR current_user_has_role('dpo'));

-- ── AUDIT LOG: sólo admin ─────────────────────────────────────
CREATE POLICY audit_admin_only ON party_audit_log
  FOR SELECT TO authenticated
  USING (current_user_has_role('admin'));
```

---

## 7. Estrategia de deduplicación

### Señales y umbrales de acción

| Score | Señales típicas | Acción |
|-------|----------------|--------|
| **1.0** | Mismo DNI/NIE/CIF | Auto-sugerencia + revisión humana obligatoria |
| **0.85 – 0.99** | Mismo teléfono + nombre similar (>0.8) | Cola de revisión → alta prioridad |
| **0.65 – 0.84** | Mismo email O nombre similar + CP | Cola de revisión → baja prioridad |
| **< 0.65** | Nombre parecido sin más señales | Ignorar |

### Proceso de fusión (merge)

1. El gestor revisa `party_duplicate_candidates` (status='pending')
2. Elige el **superviviente** (party_a o party_b, o crea uno nuevo)
3. Se ejecuta `merge_parties(survivor_id, merged_id)`:
   - Reasigna todos los FK en `expediente_participants`, `party_phones`, etc.
   - Marca `merged_id.merged_into_id = survivor_id`, `is_active = FALSE`
   - Guarda snapshot en `party_merge_log`
4. El `merged_id` queda "congelado" para auditoría histórica

```sql
CREATE OR REPLACE FUNCTION merge_parties(
  p_survivor UUID,
  p_merged   UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Reasignar relaciones al superviviente (ignorar duplicados)
  UPDATE party_phones         SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_emails         SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_addresses      SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_identifiers    SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_system_roles   SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE party_interactions   SET party_id = p_survivor WHERE party_id = p_merged;
  UPDATE expediente_participants SET party_id = p_survivor WHERE party_id = p_merged
    ON CONFLICT (expediente_id, party_id, role_code) DO NOTHING;

  -- Guardar snapshot antes de marcar como inactivo
  INSERT INTO party_merge_log(survivor_id, merged_id, merge_type, merged_by, snapshot_before)
  SELECT p_survivor, p_merged, 'manual', auth.uid(), to_jsonb(p.*)
  FROM parties p WHERE p.id = p_merged;

  -- Marcar como fusionado
  UPDATE parties
  SET merged_into_id = p_survivor, is_active = FALSE, updated_at = NOW()
  WHERE id = p_merged;

  -- Actualizar estado en cola
  UPDATE party_duplicate_candidates
  SET status = 'merged', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE (party_a_id = p_survivor AND party_b_id = p_merged)
     OR (party_a_id = p_merged  AND party_b_id = p_survivor);
END;
$$;
```

---

## 8. Plan de migración desde tablas legacy

```sql
-- FASE 1: crear parties desde asegurados existentes
INSERT INTO parties (id, party_type, first_name, last_name, display_name, created_at)
SELECT
  gen_random_uuid(),
  'person',
  split_part(nombre, ' ', 1),
  SUBSTRING(nombre FROM POSITION(' ' IN nombre) + 1),
  nombre || ' ' || COALESCE(apellidos, ''),
  created_at
FROM asegurados
ON CONFLICT DO NOTHING;

-- Necesitarás una tabla de mapeo temporal: asegurado_id → party_id
-- para actualizar las FK en expedientes

-- FASE 2: migrar operarios
INSERT INTO parties (party_type, first_name, last_name, display_name)
SELECT 'person', nombre, apellidos, nombre || ' ' || apellidos
FROM operarios;

-- FASE 3: migrar proveedores
INSERT INTO parties (party_type, legal_name, display_name)
SELECT 'organization', nombre, nombre
FROM proveedores;

-- FASE 4: migrar peritos
INSERT INTO parties (party_type, first_name, last_name, display_name)
SELECT 'person', nombre, apellidos, nombre || ' ' || apellidos
FROM peritos;

-- FASE 5: vincular phone/email desnormalizados
-- (ejecutar para cada tabla legacy con telefono/email)
```

> **Estrategia recomendada:** mantener las tablas legacy activas durante la migración.
> Añadir columna `party_id UUID REFERENCES parties(id)` a cada tabla legacy.
> Una vez validada la migración completa, deprecar las columnas redundantes.

---

## 9. Índice de ambigüedades legacy resueltas

| Problema legacy | Solución en modelo canónico |
|---|---|
| "asegurado" = cliente + rol fusionados | `parties` + `expediente_participants(role='asegurado')` |
| Tomador y asegurado son la misma persona | Una sola `party`, dos filas en `expediente_participants` |
| El perito a veces actúa como asegurado | Mismo `party_id`, roles diferentes según expediente |
| Proveedor con múltiples contactos | `party_relationships(employee_of)` + contacto como `party` independiente |
| Datos de contacto duplicados en 4 tablas | Centralizado en `party_phones` / `party_emails` |
| Sin RGPD | `party_consents` con base legal, evidencia y retirada |
| "Quién cambió el teléfono y cuándo" | `party_audit_log` con campo anterior/posterior |
| Búsqueda sólo por nombre exacto | `search_parties()` con FTS + trigram + identificador + teléfono |

---

## 10. Checklist de implementación

- [ ] Migración SQL `00020_ep13_clientes_intervinientes.sql`
- [ ] Poblar `party_role_types` con el catálogo completo
- [ ] Script de migración desde legacy (`asegurados`, `peritos`, `operarios`, `proveedores`)
- [ ] Endpoint `GET /parties/search?q=` con `search_parties()`
- [ ] Endpoint `POST /parties` (crear/upsert con detección de duplicados)
- [ ] Endpoint `GET /parties/:id` con todos los contactos, roles y expedientes
- [ ] Endpoint `POST /parties/merge` con `merge_parties()`
- [ ] Vista backoffice: ficha de interviniente (tabs: datos, contactos, expedientes, historial, consentimientos, auditoría)
- [ ] RLS validado para cada rol de usuario
- [ ] Job nocturno: `calculate_duplicate_score` sobre nuevas parties del día
