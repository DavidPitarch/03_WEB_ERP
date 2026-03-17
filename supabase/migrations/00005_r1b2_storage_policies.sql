-- ============================================================
-- R1-B.2: Storage bucket policies y ajustes operario
-- ============================================================

-- ─── Storage bucket para evidencias ───
-- Nota: En Supabase, los buckets se crean vía Dashboard o CLI.
-- Este SQL documenta la configuración esperada:
--
-- Bucket: "evidencias"
--   - Privado (no público)
--   - Signed URLs con duración: 3600s (1h) para descarga
--   - Upload vía signed URL generada por el backend
--   - Path convention: evidencias/{expediente_id}/{upload_id}.{ext}
--
-- Storage policies (se aplican vía supabase dashboard o storage API):
-- 1. INSERT: solo service_role (backend genera signed URLs)
-- 2. SELECT: service_role + usuarios con rol admin/supervisor/tramitador/operario
-- 3. UPDATE: solo service_role
-- 4. DELETE: solo service_role

-- ─── Índice para búsqueda rápida de partes por cita ───
CREATE INDEX IF NOT EXISTS idx_partes_cita ON partes_operario(cita_id);

-- ─── Vista: partes con detalles para backoffice ───
CREATE OR REPLACE VIEW v_partes_backoffice AS
SELECT
  p.id,
  p.expediente_id,
  p.operario_id,
  p.cita_id,
  p.trabajos_realizados,
  p.trabajos_pendientes,
  p.materiales_utilizados,
  p.observaciones,
  p.resultado,
  p.motivo_resultado,
  p.requiere_nueva_visita,
  p.firma_cliente_url,
  p.firma_storage_path,
  p.validado,
  p.validado_por,
  p.validado_at,
  p.created_at,
  o.nombre AS operario_nombre,
  o.apellidos AS operario_apellidos,
  o.telefono AS operario_telefono,
  c.fecha AS cita_fecha,
  c.franja_inicio AS cita_franja_inicio,
  c.franja_fin AS cita_franja_fin,
  (SELECT count(*) FROM evidencias ev WHERE ev.parte_id = p.id) AS num_evidencias,
  (p.firma_storage_path IS NOT NULL) AS tiene_firma
FROM partes_operario p
JOIN operarios o ON o.id = p.operario_id
LEFT JOIN citas c ON c.id = p.cita_id;

-- ─── RLS: operario puede leer sus propios partes ───
CREATE POLICY IF NOT EXISTS partes_operario_select ON partes_operario FOR SELECT
  USING (
    operario_id IN (SELECT id FROM operarios WHERE user_id = auth.uid())
    OR auth.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']
    OR current_setting('role') = 'service_role'
  );
