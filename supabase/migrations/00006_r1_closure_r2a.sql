-- ============================================================
-- R1 Closure + R2-A: Validación técnica, tareas, PDF pipeline
-- ============================================================

-- ─── Enum para estado de validación del parte ───
CREATE TYPE parte_validacion_estado AS ENUM ('pendiente', 'validado', 'rechazado');

-- ─── Ampliar partes_operario con estado de validación ───
ALTER TABLE partes_operario ADD COLUMN IF NOT EXISTS validacion_estado parte_validacion_estado DEFAULT 'pendiente';
ALTER TABLE partes_operario ADD COLUMN IF NOT EXISTS validacion_comentario TEXT;

-- ─── Enum para causa de pendiente ───
CREATE TYPE causa_pendiente AS ENUM (
  'material', 'perito', 'cliente_ausente', 'cliente_rechaza',
  'acceso_impedido', 'condiciones_meteorologicas', 'otra'
);

-- ─── Ampliar expedientes con causa de pendiente tipificada ───
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS causa_pendiente causa_pendiente;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS causa_pendiente_detalle TEXT;

-- ─── Tareas internas: RLS ───
ALTER TABLE tareas_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tareas_staff_select ON tareas_internas FOR SELECT
  USING (auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

CREATE POLICY tareas_staff_insert ON tareas_internas FOR INSERT
  WITH CHECK (auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

CREATE POLICY tareas_staff_update ON tareas_internas FOR UPDATE
  USING (auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

-- ─── Documentos: campos para pipeline PDF ───
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'pendiente';
-- estados: 'pendiente', 'procesando', 'completado', 'error'
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS parte_id UUID REFERENCES partes_operario(id);
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS generado_por UUID REFERENCES auth.users(id);

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY documentos_staff_select ON documentos FOR SELECT
  USING (auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

CREATE POLICY documentos_service_insert ON documentos FOR INSERT
  WITH CHECK (current_setting('role') = 'service_role' OR auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

CREATE POLICY documentos_service_update ON documentos FOR UPDATE
  USING (current_setting('role') = 'service_role' OR auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']);

-- ─── Vista: partes pendientes de validación ───
CREATE OR REPLACE VIEW v_partes_pendientes_validacion AS
SELECT
  p.id,
  p.expediente_id,
  p.operario_id,
  p.cita_id,
  p.resultado,
  p.trabajos_realizados,
  p.trabajos_pendientes,
  p.observaciones,
  p.requiere_nueva_visita,
  p.firma_storage_path,
  p.validacion_estado,
  p.validacion_comentario,
  p.created_at,
  e.numero_expediente,
  e.tipo_siniestro,
  e.direccion_siniestro,
  e.localidad,
  o.nombre AS operario_nombre,
  o.apellidos AS operario_apellidos,
  (SELECT count(*) FROM evidencias ev WHERE ev.parte_id = p.id) AS num_evidencias
FROM partes_operario p
JOIN expedientes e ON e.id = p.expediente_id
JOIN operarios o ON o.id = p.operario_id
WHERE p.validacion_estado = 'pendiente'
ORDER BY p.created_at ASC;

-- ─── Vista: informes caducados mejorada con filtros ───
CREATE OR REPLACE VIEW v_informes_caducados AS
SELECT
  c.id as cita_id,
  c.expediente_id,
  c.operario_id,
  c.fecha,
  c.franja_inicio,
  c.franja_fin,
  e.numero_expediente,
  e.estado as estado_expediente,
  e.tipo_siniestro,
  o.nombre as operario_nombre,
  o.apellidos as operario_apellidos,
  o.gremios as operario_gremios,
  (CURRENT_DATE - c.fecha) as dias_retraso
FROM citas c
JOIN expedientes e ON e.id = c.expediente_id
JOIN operarios o ON o.id = c.operario_id
WHERE c.fecha < CURRENT_DATE
  AND c.estado IN ('realizada', 'programada', 'confirmada')
  AND NOT EXISTS (SELECT 1 FROM partes_operario p WHERE p.cita_id = c.id)
  AND e.estado NOT IN ('CERRADO', 'CANCELADO', 'FINALIZADO', 'FACTURADO', 'COBRADO')
ORDER BY c.fecha ASC;

-- ─── Índices para performance ───
CREATE INDEX IF NOT EXISTS idx_partes_validacion ON partes_operario(validacion_estado) WHERE validacion_estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_tareas_asignado ON tareas_internas(asignado_a) WHERE completada = false;
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos(estado) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_documentos_parte ON documentos(parte_id);

-- ─── Realtime: añadir tablas nuevas ───
ALTER PUBLICATION supabase_realtime ADD TABLE tareas_internas;
ALTER PUBLICATION supabase_realtime ADD TABLE documentos;
ALTER PUBLICATION supabase_realtime ADD TABLE partes_operario;
