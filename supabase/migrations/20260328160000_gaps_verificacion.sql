-- =============================================================================
-- GAPS DE VERIFICACIÓN — Gaps G1 y G2 identificados en el checklist
-- G1: especialidad_siniestro en expedientes
-- G2: campo_2 por visita (datos adicionales por cita)
-- =============================================================================

-- ─── G1: especialidad_siniestro ───────────────────────────────────────────────
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS especialidad_siniestro TEXT;

CREATE INDEX IF NOT EXISTS idx_expedientes_especialidad
  ON expedientes (especialidad_siniestro)
  WHERE especialidad_siniestro IS NOT NULL;

-- ─── G2: campo_2 por cita (datos adicionales por visita) ─────────────────────
ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS campo_2 TEXT;
