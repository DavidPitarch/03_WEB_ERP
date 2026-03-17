-- ============================================================
-- R1-B.2: Storage bucket policies y ajustes operario
-- ============================================================

-- â”€â”€â”€ Storage bucket para evidencias â”€â”€â”€
-- Nota: En Supabase, los buckets se crean vÃ­a Dashboard o CLI.
-- Este SQL documenta la configuraciÃ³n esperada:
--
-- Bucket: "evidencias"
--   - Privado (no pÃºblico)
--   - Signed URLs con duraciÃ³n: 3600s (1h) para descarga
--   - Upload vÃ­a signed URL generada por el backend
--   - Path convention: evidencias/{expediente_id}/{upload_id}.{ext}
--
-- Storage policies (se aplican vÃ­a supabase dashboard o storage API):
-- 1. INSERT: solo service_role (backend genera signed URLs)
-- 2. SELECT: service_role + usuarios con rol admin/supervisor/tramitador/operario
-- 3. UPDATE: solo service_role
-- 4. DELETE: solo service_role

-- â”€â”€â”€ Ãndice para bÃºsqueda rÃ¡pida de partes por cita â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_partes_cita ON partes_operario(cita_id);

-- â”€â”€â”€ Vista: partes con detalles para backoffice â”€â”€â”€
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

-- â”€â”€â”€ RLS: operario puede leer sus propios partes â”€â”€â”€
DROP POLICY IF EXISTS partes_operario_select ON partes_operario;

CREATE POLICY partes_operario_select ON partes_operario FOR SELECT
  USING (
    operario_id IN (SELECT id FROM operarios WHERE user_id = auth.uid())
    OR public.user_roles() && ARRAY['admin', 'supervisor', 'tramitador']
  );
