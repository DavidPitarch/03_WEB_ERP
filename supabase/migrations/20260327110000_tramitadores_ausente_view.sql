-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: tramitadores — campo ausente + actualización de vista materializada
--
-- Cambios:
--   1. Añade columna `ausente` a tramitadores.
--   2. Elimina y recrea v_carga_tramitadores incluyendo:
--      user_id, email, ausente, fecha_alta, fecha_baja
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Añadir columna ausente
ALTER TABLE tramitadores
  ADD COLUMN IF NOT EXISTS ausente BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Eliminar vista materializada e índices existentes
DROP MATERIALIZED VIEW IF EXISTS v_carga_tramitadores CASCADE;

-- 3. Recrear vista con campos adicionales
CREATE MATERIALIZED VIEW v_carga_tramitadores AS
SELECT
  t.id                                              AS tramitador_id,
  t.user_id,
  t.nombre || ' ' || t.apellidos                   AS nombre_completo,
  t.nombre,
  t.apellidos,
  t.email,
  t.empresa_facturadora_id,
  t.activo,
  t.ausente,
  t.nivel,
  t.max_expedientes_activos,
  t.max_urgentes,
  t.umbral_alerta_pct,
  t.fecha_alta,
  t.fecha_baja,
  -- Totales
  COUNT(e.id) FILTER (
    WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
  )                                                 AS total_activos,
  COUNT(e.id) FILTER (
    WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
      AND e.prioridad = 'urgente'
  )                                                 AS total_urgentes,
  COUNT(e.id) FILTER (
    WHERE e.fecha_limite_sla < NOW()
      AND e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
  )                                                 AS total_sla_vencidos,
  COUNT(e.id) FILTER (
    WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
      AND NOT EXISTS (
        SELECT 1 FROM citas c
        WHERE c.expediente_id = e.id
          AND c.estado IN ('programada', 'confirmada')
      )
  )                                                 AS total_sin_cita,
  COUNT(e.id) FILTER (
    WHERE e.estado::TEXT LIKE 'PENDIENTE%'
  )                                                 AS total_bloqueados,
  -- Ratio de carga
  ROUND(
    COUNT(e.id) FILTER (
      WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
    )::NUMERIC / NULLIF(t.max_expedientes_activos, 0) * 100,
    1
  )                                                 AS porcentaje_carga,
  -- Semáforo
  CASE
    WHEN COUNT(e.id) FILTER (
      WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
    ) >= t.max_expedientes_activos
      THEN 'rojo'
    WHEN ROUND(
      COUNT(e.id) FILTER (
        WHERE e.estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO')
      )::NUMERIC / NULLIF(t.max_expedientes_activos, 0) * 100,
      1
    ) >= t.umbral_alerta_pct
      THEN 'amarillo'
    ELSE 'verde'
  END                                               AS semaforo,
  NOW()                                             AS last_refresh
FROM tramitadores t
LEFT JOIN expedientes e ON e.tramitador_id = t.id
GROUP BY
  t.id, t.user_id, t.nombre, t.apellidos, t.email,
  t.empresa_facturadora_id, t.activo, t.ausente, t.nivel,
  t.max_expedientes_activos, t.max_urgentes, t.umbral_alerta_pct,
  t.fecha_alta, t.fecha_baja;

-- 4. Recrear índices
CREATE UNIQUE INDEX idx_v_carga_tramitador ON v_carga_tramitadores(tramitador_id);
CREATE INDEX idx_v_carga_empresa          ON v_carga_tramitadores(empresa_facturadora_id);
CREATE INDEX idx_v_carga_semaforo         ON v_carga_tramitadores(semaforo, activo);
CREATE INDEX idx_v_carga_user_id          ON v_carga_tramitadores(user_id);
