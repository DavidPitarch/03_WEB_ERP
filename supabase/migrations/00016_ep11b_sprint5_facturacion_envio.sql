-- ============================================================
-- EP-11B Sprint 5: Facturación VP + Envío Informe + Documento Final
-- ============================================================

-- ─── 1. vp_documento_final ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vp_documento_final (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id UUID NOT NULL REFERENCES vp_videoperitaciones(id),
  informe_id UUID NOT NULL REFERENCES vp_informes(id),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  version INT NOT NULL DEFAULT 1,
  estado VARCHAR(30) NOT NULL DEFAULT 'generado'
    CHECK (estado IN ('generando','generado','firmado','enviado','error')),

  -- Document data
  contenido_json JSONB NOT NULL DEFAULT '{}',
  storage_path TEXT,
  nombre_archivo VARCHAR(300),
  formato VARCHAR(20) DEFAULT 'json',
  tamano_bytes BIGINT,

  -- Branding
  config_branding JSONB DEFAULT '{}',

  -- Metadata
  generado_por UUID NOT NULL REFERENCES auth.users(id),
  generado_at TIMESTAMPTZ DEFAULT NOW(),
  firmado_at TIMESTAMPTZ,
  error_detalle TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. vp_facturas (bridge VP → facturas ERP) ─────────────────────

CREATE TABLE IF NOT EXISTS vp_facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id UUID NOT NULL REFERENCES vp_videoperitaciones(id),
  factura_id UUID NOT NULL REFERENCES facturas(id),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  valoracion_id UUID REFERENCES vp_valoraciones(id),
  informe_id UUID REFERENCES vp_informes(id),

  -- Snapshot at emission time
  importe_valoracion NUMERIC(12,2),
  baremo_id UUID,
  baremo_version INT,

  emitida_por UUID NOT NULL REFERENCES auth.users(id),
  emitida_at TIMESTAMPTZ DEFAULT NOW(),
  notas TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. vp_envios ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vp_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id UUID NOT NULL REFERENCES vp_videoperitaciones(id),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  documento_final_id UUID REFERENCES vp_documento_final(id),
  factura_id UUID REFERENCES facturas(id),

  -- Channel & target
  canal VARCHAR(30) NOT NULL DEFAULT 'email'
    CHECK (canal IN ('email','api','portal','manual')),
  destinatario_email VARCHAR(250),
  destinatario_nombre VARCHAR(200),

  -- Result
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','enviando','enviado','error','acusado')),
  intento_numero INT NOT NULL DEFAULT 1,
  enviado_at TIMESTAMPTZ,
  error_detalle TEXT,

  -- Acknowledgement
  acuse_at TIMESTAMPTZ,
  acuse_detalle TEXT,

  -- Metadata
  enviado_por UUID NOT NULL REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. Indexes ────────────────────────────────────────────────────

CREATE INDEX idx_vp_documento_final_vp ON vp_documento_final(videoperitacion_id);
CREATE INDEX idx_vp_documento_final_informe ON vp_documento_final(informe_id);
CREATE INDEX idx_vp_facturas_vp ON vp_facturas(videoperitacion_id);
CREATE INDEX idx_vp_facturas_factura ON vp_facturas(factura_id);
CREATE INDEX idx_vp_envios_vp ON vp_envios(videoperitacion_id);
CREATE INDEX idx_vp_envios_estado ON vp_envios(estado);

-- ─── 5. RLS ────────────────────────────────────────────────────────

ALTER TABLE vp_documento_final ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY vp_documento_final_select ON vp_documento_final FOR SELECT TO authenticated USING (true);
CREATE POLICY vp_documento_final_insert ON vp_documento_final FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vp_documento_final_update ON vp_documento_final FOR UPDATE TO authenticated USING (true);

CREATE POLICY vp_facturas_select ON vp_facturas FOR SELECT TO authenticated USING (true);
CREATE POLICY vp_facturas_insert ON vp_facturas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY vp_envios_select ON vp_envios FOR SELECT TO authenticated USING (true);
CREATE POLICY vp_envios_insert ON vp_envios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vp_envios_update ON vp_envios FOR UPDATE TO authenticated USING (true);

-- ─── 6. Realtime ───────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE vp_envios;

-- ─── 7. Updated_at triggers ────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vp_documento_final_updated_at') THEN
    CREATE TRIGGER trg_vp_documento_final_updated_at
      BEFORE UPDATE ON vp_documento_final
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vp_envios_updated_at') THEN
    CREATE TRIGGER trg_vp_envios_updated_at
      BEFORE UPDATE ON vp_envios
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── 8. Add missing columns to Factura TS type (DB already has them) ──
-- These columns exist from EP-08 but ensure they're present:
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facturas' AND column_name = 'origen'
  ) THEN
    ALTER TABLE facturas ADD COLUMN origen VARCHAR(30) DEFAULT 'expediente'
      CHECK (origen IN ('expediente','videoperitacion','manual'));
  END IF;
END $$;

-- ─── 9. VP estado CHECK — ensure 'facturado' and 'enviado' are present
-- (Already present from migration 00015, no change needed)
