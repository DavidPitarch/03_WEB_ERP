-- ============================================================
-- R1: Mejoras para núcleo transaccional
-- ============================================================

-- ─── Origen del expediente ───
CREATE TYPE expediente_origen AS ENUM ('manual', 'api', 'webhook', 'email', 'import');

ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS origen expediente_origen NOT NULL DEFAULT 'manual';
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS referencia_externa VARCHAR(100);
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS datos_origen JSONB DEFAULT '{}';

CREATE UNIQUE INDEX idx_expedientes_ref_externa ON expedientes(referencia_externa) WHERE referencia_externa IS NOT NULL;

-- ─── Índices para búsqueda universal ───
CREATE INDEX idx_asegurados_telefono ON asegurados(telefono);
CREATE INDEX idx_asegurados_nombre ON asegurados(nombre, apellidos);
CREATE INDEX idx_expedientes_poliza ON expedientes(numero_poliza) WHERE numero_poliza IS NOT NULL;
CREATE INDEX idx_expedientes_siniestro_cia ON expedientes(numero_siniestro_cia) WHERE numero_siniestro_cia IS NOT NULL;

-- ─── Full-text search en expedientes ───
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION expedientes_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish',
    coalesce(NEW.numero_expediente, '') || ' ' ||
    coalesce(NEW.descripcion, '') || ' ' ||
    coalesce(NEW.numero_poliza, '') || ' ' ||
    coalesce(NEW.numero_siniestro_cia, '') || ' ' ||
    coalesce(NEW.direccion_siniestro, '') || ' ' ||
    coalesce(NEW.localidad, '') || ' ' ||
    coalesce(NEW.referencia_externa, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expedientes_search BEFORE INSERT OR UPDATE ON expedientes
  FOR EACH ROW EXECUTE FUNCTION expedientes_search_update();

CREATE INDEX idx_expedientes_search ON expedientes USING gin(search_vector);

-- ─── Vista: contadores por estado ───
CREATE OR REPLACE VIEW v_expedientes_contadores AS
SELECT
  estado,
  COUNT(*) as total
FROM expedientes
GROUP BY estado;

-- ─── Vista: informes caducados (citas pasadas sin parte) ───
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
  o.nombre as operario_nombre,
  o.apellidos as operario_apellidos
FROM citas c
JOIN expedientes e ON e.id = c.expediente_id
JOIN operarios o ON o.id = c.operario_id
LEFT JOIN partes_operario p ON p.cita_id = c.id
WHERE c.estado IN ('realizada', 'programada', 'confirmada')
  AND c.fecha < CURRENT_DATE
  AND p.id IS NULL
  AND e.estado NOT IN ('CERRADO', 'CANCELADO', 'FINALIZADO', 'FACTURADO', 'COBRADO')
ORDER BY c.fecha ASC;

-- ─── Habilitar Realtime en tablas clave ───
ALTER PUBLICATION supabase_realtime ADD TABLE expedientes;
ALTER PUBLICATION supabase_realtime ADD TABLE citas;
ALTER PUBLICATION supabase_realtime ADD TABLE comunicaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE historial_estados;
