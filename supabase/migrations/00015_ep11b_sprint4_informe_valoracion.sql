-- ============================================================
-- EP-11B Sprint 4: Informe Técnico + Valoración Económica
-- ============================================================

-- ─── 1. vp_informes ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vp_informes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id UUID NOT NULL REFERENCES vp_videoperitaciones(id),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  estado VARCHAR(30) NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','en_revision','validado','rectificado','enviado')),
  version INT NOT NULL DEFAULT 1,

  -- Content sections
  datos_expediente JSONB DEFAULT '{}',
  datos_encargo JSONB DEFAULT '{}',
  datos_videoperitacion JSONB DEFAULT '{}',
  resumen_sesion JSONB DEFAULT '{}',
  evidencias_principales UUID[] DEFAULT '{}',
  hallazgos JSONB DEFAULT '[]',
  conclusiones TEXT,
  extractos_transcripcion JSONB DEFAULT '[]',
  resolucion_pericial JSONB DEFAULT '{}',
  observaciones_finales TEXT,

  -- References
  dictamen_id UUID REFERENCES vp_dictamenes(id),
  valoracion_id UUID,  -- FK added after vp_valoraciones created

  -- Metadata
  creado_por UUID NOT NULL REFERENCES auth.users(id),
  validado_por UUID REFERENCES auth.users(id),
  validado_at TIMESTAMPTZ,
  enviado_at TIMESTAMPTZ,
  rectificado_at TIMESTAMPTZ,
  rectificado_motivo TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. vp_informe_versiones ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vp_informe_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id UUID NOT NULL REFERENCES vp_informes(id) ON DELETE CASCADE,
  version INT NOT NULL,
  estado_anterior VARCHAR(30),
  estado_nuevo VARCHAR(30),
  contenido_snapshot JSONB NOT NULL,
  creado_por UUID NOT NULL REFERENCES auth.users(id),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. vp_valoraciones ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vp_valoraciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id UUID NOT NULL REFERENCES vp_videoperitaciones(id),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  estado VARCHAR(30) NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','calculada','validada','rectificada')),

  -- Baremo reference (snapshot)
  baremo_id UUID REFERENCES baremos(id),
  baremo_version INT,
  baremo_nombre VARCHAR(200),

  -- Totals
  importe_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  importe_baremo NUMERIC(12,2) NOT NULL DEFAULT 0,
  importe_ajustado NUMERIC(12,2) NOT NULL DEFAULT 0,
  desviacion_total NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Metadata
  calculado_por UUID REFERENCES auth.users(id),
  calculado_at TIMESTAMPTZ,
  validado_por UUID REFERENCES auth.users(id),
  validado_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK from vp_informes to vp_valoraciones
ALTER TABLE vp_informes
  ADD CONSTRAINT fk_vp_informes_valoracion
  FOREIGN KEY (valoracion_id) REFERENCES vp_valoraciones(id);

-- ─── 4. vp_valoracion_lineas ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS vp_valoracion_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valoracion_id UUID NOT NULL REFERENCES vp_valoraciones(id) ON DELETE CASCADE,
  partida_baremo_id UUID REFERENCES partidas_baremo(id),

  -- From baremo (snapshot)
  codigo VARCHAR(30),
  descripcion TEXT NOT NULL,
  especialidad VARCHAR(100),
  unidad VARCHAR(20),
  precio_unitario_baremo NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Applied
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
  precio_unitario_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0,
  importe NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Deviation tracking
  es_ajuste_manual BOOLEAN DEFAULT FALSE,
  ajustado_por UUID REFERENCES auth.users(id),
  motivo_ajuste TEXT,
  fuera_de_baremo BOOLEAN DEFAULT FALSE,

  observaciones TEXT,
  orden INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. Indexes ────────────────────────────────────────────────────

CREATE INDEX idx_vp_informes_videoperitacion ON vp_informes(videoperitacion_id);
CREATE INDEX idx_vp_informes_expediente ON vp_informes(expediente_id);
CREATE INDEX idx_vp_informes_estado ON vp_informes(estado);
CREATE INDEX idx_vp_informe_versiones_informe ON vp_informe_versiones(informe_id, version);
CREATE INDEX idx_vp_valoraciones_videoperitacion ON vp_valoraciones(videoperitacion_id);
CREATE INDEX idx_vp_valoraciones_expediente ON vp_valoraciones(expediente_id);
CREATE INDEX idx_vp_valoracion_lineas_valoracion ON vp_valoracion_lineas(valoracion_id);
CREATE INDEX idx_vp_valoracion_lineas_partida ON vp_valoracion_lineas(partida_baremo_id);

-- ─── 6. RLS ────────────────────────────────────────────────────────

ALTER TABLE vp_informes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_informe_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_valoraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE vp_valoracion_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY vp_informes_select ON vp_informes FOR SELECT TO authenticated USING (true);
CREATE POLICY vp_informes_insert ON vp_informes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vp_informes_update ON vp_informes FOR UPDATE TO authenticated USING (true);

CREATE POLICY vp_informe_versiones_select ON vp_informe_versiones FOR SELECT TO authenticated USING (true);
CREATE POLICY vp_informe_versiones_insert ON vp_informe_versiones FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY vp_valoraciones_select ON vp_valoraciones FOR SELECT TO authenticated USING (true);
CREATE POLICY vp_valoraciones_insert ON vp_valoraciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vp_valoraciones_update ON vp_valoraciones FOR UPDATE TO authenticated USING (true);

CREATE POLICY vp_valoracion_lineas_select ON vp_valoracion_lineas FOR SELECT TO authenticated USING (true);
CREATE POLICY vp_valoracion_lineas_insert ON vp_valoracion_lineas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY vp_valoracion_lineas_update ON vp_valoracion_lineas FOR UPDATE TO authenticated USING (true);
CREATE POLICY vp_valoracion_lineas_delete ON vp_valoracion_lineas FOR DELETE TO authenticated USING (true);

-- ─── 7. Realtime ───────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE vp_informes;
ALTER PUBLICATION supabase_realtime ADD TABLE vp_valoraciones;

-- ─── 8. Updated_at triggers ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vp_informes_updated_at') THEN
    CREATE TRIGGER trg_vp_informes_updated_at
      BEFORE UPDATE ON vp_informes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vp_valoraciones_updated_at') THEN
    CREATE TRIGGER trg_vp_valoraciones_updated_at
      BEFORE UPDATE ON vp_valoraciones
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ─── 9. Webhook hardening columns ──────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vp_webhook_logs' AND column_name = 'payload_schema_version'
  ) THEN
    ALTER TABLE vp_webhook_logs ADD COLUMN payload_schema_version VARCHAR(10);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vp_webhook_logs' AND column_name = 'reprocess_requested_by'
  ) THEN
    ALTER TABLE vp_webhook_logs ADD COLUMN reprocess_requested_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vp_webhook_logs' AND column_name = 'reprocess_motivo'
  ) THEN
    ALTER TABLE vp_webhook_logs ADD COLUMN reprocess_motivo TEXT;
  END IF;
END $$;

-- ─── 10. VP estado CHECK update ────────────────────────────────────
-- Ensure the estado constraint includes all Sprint 4 states
-- Drop and recreate to be safe

DO $$ BEGIN
  ALTER TABLE vp_videoperitaciones DROP CONSTRAINT IF EXISTS vp_videoperitaciones_estado_check;
  ALTER TABLE vp_videoperitaciones ADD CONSTRAINT vp_videoperitaciones_estado_check
    CHECK (estado IN (
      'encargo_recibido','pendiente_contacto','contactado','agendado',
      'link_enviado','sesion_programada','sesion_en_curso','sesion_finalizada',
      'pendiente_perito','revision_pericial',
      'pendiente_informe','informe_borrador','informe_validado',
      'valoracion_calculada','facturado','enviado','cerrado',
      'cancelado','sesion_fallida','cliente_ausente'
    ));
END $$;
