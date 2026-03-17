-- ============================================================
-- R1-B: Soporte para operator-pwa y flujo de partes
-- ============================================================

-- ─── Estado de resultado de visita ───
CREATE TYPE resultado_visita AS ENUM (
  'completada', 'pendiente', 'ausente', 'requiere_material'
);

-- ─── Ampliar partes_operario ───
ALTER TABLE partes_operario ADD COLUMN IF NOT EXISTS resultado resultado_visita;
ALTER TABLE partes_operario ADD COLUMN IF NOT EXISTS motivo_resultado TEXT;
ALTER TABLE partes_operario ADD COLUMN IF NOT EXISTS firma_storage_path TEXT;
ALTER TABLE partes_operario ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';
ALTER TABLE partes_operario ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TRIGGER trg_partes_updated BEFORE UPDATE ON partes_operario
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Ampliar evidencias con clasificación ───
ALTER TABLE evidencias ADD COLUMN IF NOT EXISTS clasificacion VARCHAR(20) DEFAULT 'general';
-- valores: 'antes', 'durante', 'despues', 'general'
ALTER TABLE evidencias ADD COLUMN IF NOT EXISTS cita_id UUID REFERENCES citas(id);

CREATE INDEX IF NOT EXISTS idx_evidencias_expediente ON evidencias(expediente_id);
CREATE INDEX IF NOT EXISTS idx_evidencias_parte ON evidencias(parte_id);

-- ─── Índices para agenda del operario ───
CREATE INDEX IF NOT EXISTS idx_citas_operario_estado ON citas(operario_id, estado, fecha);
CREATE INDEX IF NOT EXISTS idx_partes_expediente ON partes_operario(expediente_id);
CREATE INDEX IF NOT EXISTS idx_partes_operario ON partes_operario(operario_id);

-- ─── RLS: operario puede INSERT partes y evidencias ───
-- Partes: el operario puede crear partes de expedientes asignados a él
CREATE POLICY partes_operario_insert ON partes_operario FOR INSERT
  WITH CHECK (
    operario_id IN (SELECT id FROM operarios WHERE user_id = auth.uid())
    OR current_setting('role') = 'service_role'
  );

-- Evidencias: el operario puede subir evidencias de sus expedientes
ALTER TABLE evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY evidencias_staff_select ON evidencias FOR SELECT
  USING (auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

CREATE POLICY evidencias_operario_select ON evidencias FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR expediente_id IN (
      SELECT e.id FROM expedientes e
      JOIN operarios o ON o.id = e.operario_id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY evidencias_insert ON evidencias FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    OR current_setting('role') = 'service_role'
  );

-- ─── Vista: agenda del operario ───
CREATE OR REPLACE VIEW v_agenda_operario AS
SELECT
  c.id as cita_id,
  c.expediente_id,
  c.operario_id,
  c.fecha,
  c.franja_inicio,
  c.franja_fin,
  c.estado as cita_estado,
  c.notas as cita_notas,
  e.numero_expediente,
  e.estado as expediente_estado,
  e.tipo_siniestro,
  e.descripcion,
  e.direccion_siniestro,
  e.codigo_postal,
  e.localidad,
  e.provincia,
  e.prioridad,
  a.nombre as asegurado_nombre,
  a.apellidos as asegurado_apellidos,
  a.telefono as asegurado_telefono,
  a.telefono2 as asegurado_telefono2,
  EXISTS(
    SELECT 1 FROM partes_operario p WHERE p.cita_id = c.id
  ) as tiene_parte
FROM citas c
JOIN expedientes e ON e.id = c.expediente_id
JOIN asegurados a ON a.id = e.asegurado_id
WHERE e.estado NOT IN ('CERRADO', 'CANCELADO')
ORDER BY c.fecha ASC, c.franja_inicio ASC;
