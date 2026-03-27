-- ============================================================
-- UCT — Módulo Usuarios y Cargas de Trabajo
-- Sprint UCT-1: Schema principal
-- ============================================================

-- ─── TRAMITADORES ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tramitadores (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_facturadora_id     UUID REFERENCES empresas_facturadoras(id) ON DELETE SET NULL,
  nombre                     VARCHAR(100) NOT NULL,
  apellidos                  VARCHAR(150) NOT NULL,
  email                      VARCHAR(254) NOT NULL,
  telefono                   VARCHAR(20),
  nivel                      TEXT NOT NULL DEFAULT 'junior'
                             CHECK (nivel IN ('junior', 'senior', 'especialista', 'supervisor')),
  -- Capacidad
  max_expedientes_activos    INTEGER NOT NULL DEFAULT 30
                             CHECK (max_expedientes_activos BETWEEN 1 AND 500),
  max_urgentes               INTEGER NOT NULL DEFAULT 5,
  max_por_compania           INTEGER DEFAULT NULL,
  umbral_alerta_pct          SMALLINT NOT NULL DEFAULT 90
                             CHECK (umbral_alerta_pct BETWEEN 10 AND 100),
  -- Especialización
  especialidades_siniestro   TEXT[] NOT NULL DEFAULT '{}',
  companias_preferentes      UUID[] NOT NULL DEFAULT '{}',
  zonas_cp                   TEXT[] NOT NULL DEFAULT '{}',
  -- Estado
  activo                     BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_alta                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_baja                 TIMESTAMPTZ,
  metadata                   JSONB NOT NULL DEFAULT '{}',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_tramitadores_user_id    ON tramitadores(user_id);
CREATE INDEX IF NOT EXISTS idx_tramitadores_empresa    ON tramitadores(empresa_facturadora_id);
CREATE INDEX IF NOT EXISTS idx_tramitadores_activo     ON tramitadores(activo) WHERE activo = TRUE;

DROP TRIGGER IF EXISTS trg_tramitadores_updated_at ON tramitadores;
CREATE TRIGGER trg_tramitadores_updated_at
  BEFORE UPDATE ON tramitadores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── EXPEDIENTES: añadir tramitador_id ──────────────────────

ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS tramitador_id             UUID REFERENCES tramitadores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_asignacion_tramitador TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_expedientes_tramitador_id
  ON expedientes(tramitador_id)
  WHERE tramitador_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expedientes_tramitador_estado
  ON expedientes(tramitador_id, estado)
  WHERE tramitador_id IS NOT NULL
    AND estado NOT IN ('CERRADO', 'CANCELADO', 'COBRADO', 'FACTURADO');

-- ─── REGLAS DE PREASIGNACIÓN ────────────────────────────────

CREATE TABLE IF NOT EXISTS tramitador_reglas_preasignacion (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tramitador_id          UUID NOT NULL REFERENCES tramitadores(id) ON DELETE CASCADE,
  empresa_facturadora_id UUID REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  compania_id            UUID REFERENCES companias(id) ON DELETE CASCADE,
  tipo_siniestro         TEXT,
  zona_cp_patron         TEXT,
  prioridad              TEXT CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  peso                   INTEGER NOT NULL DEFAULT 100 CHECK (peso BETWEEN 1 AND 1000),
  activa                 BOOLEAN NOT NULL DEFAULT TRUE,
  descripcion            TEXT,
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preasig_tramitador ON tramitador_reglas_preasignacion(tramitador_id, activa);
CREATE INDEX IF NOT EXISTS idx_preasig_compania   ON tramitador_reglas_preasignacion(compania_id)
  WHERE compania_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_preasig_empresa    ON tramitador_reglas_preasignacion(empresa_facturadora_id);

DROP TRIGGER IF EXISTS trg_preasig_updated_at ON tramitador_reglas_preasignacion;
CREATE TRIGGER trg_preasig_updated_at
  BEFORE UPDATE ON tramitador_reglas_preasignacion
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── REGLAS DE REPARTO ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS reglas_reparto (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_facturadora_id UUID REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  nombre                 VARCHAR(200) NOT NULL,
  descripcion            TEXT,
  tipo                   TEXT NOT NULL
                         CHECK (tipo IN ('manual', 'round_robin', 'weighted', 'rule_based', 'sla_priority')),
  activa                 BOOLEAN NOT NULL DEFAULT FALSE,
  prioridad_orden        INTEGER NOT NULL DEFAULT 0,
  config                 JSONB NOT NULL DEFAULT '{}',
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo 1 regla activa por empresa (NULL = global)
CREATE UNIQUE INDEX idx_reglas_reparto_unica_activa
  ON reglas_reparto(COALESCE(empresa_facturadora_id, '00000000-0000-0000-0000-000000000000'::UUID), activa)
  WHERE activa = TRUE;

DROP TRIGGER IF EXISTS trg_reglas_reparto_updated_at ON reglas_reparto;
CREATE TRIGGER trg_reglas_reparto_updated_at
  BEFORE UPDATE ON reglas_reparto
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── HISTORIAL DE ASIGNACIONES ──────────────────────────────

CREATE TABLE IF NOT EXISTS historial_asignaciones (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id           UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  tramitador_anterior_id  UUID REFERENCES tramitadores(id) ON DELETE SET NULL,
  tramitador_nuevo_id     UUID REFERENCES tramitadores(id) ON DELETE SET NULL,
  tipo                    TEXT NOT NULL CHECK (tipo IN (
                            'asignacion_inicial',
                            'reasignacion_manual',
                            'reasignacion_automatica',
                            'reasignacion_masiva',
                            'desasignacion'
                          )),
  motivo                  TEXT,
  motivo_codigo           TEXT,
  actor_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_tipo              TEXT NOT NULL DEFAULT 'usuario'
                          CHECK (actor_tipo IN ('usuario', 'sistema')),
  batch_id                UUID,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hist_asig_expediente  ON historial_asignaciones(expediente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hist_asig_nuevo       ON historial_asignaciones(tramitador_nuevo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hist_asig_anterior    ON historial_asignaciones(tramitador_anterior_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hist_asig_batch       ON historial_asignaciones(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hist_asig_fecha       ON historial_asignaciones(created_at DESC);

-- ─── ALERTAS DE CARGA ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alertas_carga (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tramitador_id   UUID REFERENCES tramitadores(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN (
                    'umbral_carga',
                    'carga_maxima',
                    'sla_vencidos',
                    'sin_tramitador',
                    'expedientes_bloqueados'
                  )),
  severidad       TEXT NOT NULL DEFAULT 'warning'
                  CHECK (severidad IN ('info', 'warning', 'critical')),
  mensaje         TEXT NOT NULL,
  valor_umbral    NUMERIC,
  valor_actual    NUMERIC,
  resuelta        BOOLEAN NOT NULL DEFAULT FALSE,
  resuelta_at     TIMESTAMPTZ,
  resuelta_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_carga_activas
  ON alertas_carga(tramitador_id, resuelta)
  WHERE resuelta = FALSE;
CREATE INDEX IF NOT EXISTS idx_alertas_carga_tipo
  ON alertas_carga(tipo, resuelta)
  WHERE resuelta = FALSE;

-- ─── VISTA MATERIALIZADA: carga por tramitador ──────────────

DROP MATERIALIZED VIEW IF EXISTS v_carga_tramitadores CASCADE;
CREATE MATERIALIZED VIEW v_carga_tramitadores AS
SELECT
  t.id                                              AS tramitador_id,
  t.nombre || ' ' || t.apellidos                   AS nombre_completo,
  t.nombre,
  t.apellidos,
  t.empresa_facturadora_id,
  t.activo,
  t.nivel,
  t.max_expedientes_activos,
  t.max_urgentes,
  t.umbral_alerta_pct,
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
  -- Semáforo de estado
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
  t.id, t.nombre, t.apellidos, t.empresa_facturadora_id,
  t.activo, t.nivel, t.max_expedientes_activos, t.max_urgentes, t.umbral_alerta_pct;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_carga_tramitador ON v_carga_tramitadores(tramitador_id);
CREATE INDEX IF NOT EXISTS idx_v_carga_empresa ON v_carga_tramitadores(empresa_facturadora_id);
CREATE INDEX IF NOT EXISTS idx_v_carga_semaforo ON v_carga_tramitadores(semaforo, activo);

-- ─── RPC: asignar tramitador a expediente ────────────────────

CREATE OR REPLACE FUNCTION erp_asignar_tramitador(
  p_expediente_id      UUID,
  p_tramitador_id      UUID,
  p_motivo             TEXT    DEFAULT NULL,
  p_motivo_codigo      TEXT    DEFAULT NULL,
  p_actor_id           UUID    DEFAULT auth.uid(),
  p_force              BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exp          RECORD;
  v_tram         RECORD;
  v_carga        RECORD;
  v_anterior_id  UUID;
  v_tipo_hist    TEXT;
BEGIN
  -- Bloquear registro
  SELECT id, estado, tramitador_id
    INTO v_exp
    FROM expedientes
   WHERE id = p_expediente_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'expediente_not_found';
  END IF;

  IF v_exp.estado IN ('CERRADO', 'CANCELADO') THEN
    RAISE EXCEPTION 'expediente_terminal_state';
  END IF;

  SELECT id, activo INTO v_tram FROM tramitadores WHERE id = p_tramitador_id;
  IF NOT FOUND OR NOT v_tram.activo THEN
    RAISE EXCEPTION 'tramitador_not_found_or_inactive';
  END IF;

  -- Verificar capacidad (salvo force)
  SELECT total_activos, max_expedientes_activos, semaforo
    INTO v_carga
    FROM v_carga_tramitadores
   WHERE tramitador_id = p_tramitador_id;

  IF v_carga.semaforo = 'rojo' AND NOT p_force THEN
    RAISE EXCEPTION 'tramitador_at_capacity:%/%',
      v_carga.total_activos, v_carga.max_expedientes_activos;
  END IF;

  v_anterior_id := v_exp.tramitador_id;
  v_tipo_hist   := CASE
    WHEN v_anterior_id IS NULL THEN 'asignacion_inicial'
    ELSE 'reasignacion_manual'
  END;

  -- Actualizar expediente
  UPDATE expedientes SET
    tramitador_id                  = p_tramitador_id,
    fecha_asignacion_tramitador    = NOW(),
    updated_at                     = NOW()
  WHERE id = p_expediente_id;

  -- Historial
  INSERT INTO historial_asignaciones (
    expediente_id, tramitador_anterior_id, tramitador_nuevo_id,
    tipo, motivo, motivo_codigo, actor_id, actor_tipo
  ) VALUES (
    p_expediente_id, v_anterior_id, p_tramitador_id,
    v_tipo_hist, p_motivo, p_motivo_codigo, p_actor_id, 'usuario'
  );

  -- Auditoría
  INSERT INTO auditoria (tabla, registro_id, accion, actor_id, cambios)
  VALUES (
    'expedientes', p_expediente_id, 'UPDATE', p_actor_id,
    jsonb_build_object(
      'tramitador_id', jsonb_build_object('anterior', v_anterior_id, 'nuevo', p_tramitador_id),
      'motivo', p_motivo,
      'force', p_force
    )
  );

  -- Notificar refresh de vista (procesado de forma asíncrona)
  PERFORM pg_notify('refresh_carga', p_tramitador_id::TEXT);
  IF v_anterior_id IS NOT NULL THEN
    PERFORM pg_notify('refresh_carga', v_anterior_id::TEXT);
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'tramitador_id', p_tramitador_id,
    'tramitador_anterior_id', v_anterior_id,
    'tipo', v_tipo_hist
  );
END;
$$;

-- ─── RPC: reasignación masiva ────────────────────────────────

CREATE OR REPLACE FUNCTION erp_reasignacion_masiva(
  p_tramitador_origen_id  UUID,
  p_tramitador_destino_id UUID,
  p_expediente_ids        UUID[],
  p_motivo                TEXT,
  p_motivo_codigo         TEXT    DEFAULT NULL,
  p_actor_id              UUID    DEFAULT auth.uid()
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_batch_id   UUID    := gen_random_uuid();
  v_count      INTEGER := 0;
  v_failed     UUID[]  := '{}';
  v_exp_id     UUID;
  v_exp        RECORD;
  v_tram       RECORD;
BEGIN
  -- Validar destino
  SELECT id, activo INTO v_tram FROM tramitadores WHERE id = p_tramitador_destino_id;
  IF NOT FOUND OR NOT v_tram.activo THEN
    RAISE EXCEPTION 'tramitador_destino_not_found_or_inactive';
  END IF;

  IF p_motivo IS NULL OR TRIM(p_motivo) = '' THEN
    RAISE EXCEPTION 'motivo_requerido_en_reasignacion_masiva';
  END IF;

  FOREACH v_exp_id IN ARRAY p_expediente_ids LOOP
    BEGIN
      SELECT id, estado, tramitador_id INTO v_exp
        FROM expedientes WHERE id = v_exp_id FOR UPDATE;

      IF NOT FOUND THEN CONTINUE; END IF;
      IF v_exp.estado IN ('CERRADO', 'CANCELADO') THEN
        v_failed := array_append(v_failed, v_exp_id);
        CONTINUE;
      END IF;

      UPDATE expedientes SET
        tramitador_id                = p_tramitador_destino_id,
        fecha_asignacion_tramitador  = NOW(),
        updated_at                   = NOW()
      WHERE id = v_exp_id;

      INSERT INTO historial_asignaciones (
        expediente_id, tramitador_anterior_id, tramitador_nuevo_id,
        tipo, motivo, motivo_codigo, actor_id, actor_tipo, batch_id
      ) VALUES (
        v_exp_id, v_exp.tramitador_id, p_tramitador_destino_id,
        'reasignacion_masiva', p_motivo, p_motivo_codigo, p_actor_id, 'usuario', v_batch_id
      );

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := array_append(v_failed, v_exp_id);
    END;
  END LOOP;

  -- Auditoría del lote
  INSERT INTO auditoria (tabla, registro_id, accion, actor_id, cambios)
  VALUES (
    'historial_asignaciones', v_batch_id, 'INSERT', p_actor_id,
    jsonb_build_object(
      'batch_id', v_batch_id,
      'origen', p_tramitador_origen_id,
      'destino', p_tramitador_destino_id,
      'total', array_length(p_expediente_ids, 1),
      'asignados', v_count,
      'fallidos', v_failed,
      'motivo', p_motivo
    )
  );

  PERFORM pg_notify('refresh_carga', p_tramitador_origen_id::TEXT);
  PERFORM pg_notify('refresh_carga', p_tramitador_destino_id::TEXT);

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'total',    array_length(p_expediente_ids, 1),
    'asignados', v_count,
    'fallidos',  v_failed
  );
END;
$$;

-- ─── CATÁLOGO: motivos de reasignación ───────────────────────

INSERT INTO catalogos (tipo, codigo, valor, orden) VALUES
  ('motivo_reasignacion', 'baja_tramitador',    'Baja del tramitador',           1),
  ('motivo_reasignacion', 'exceso_carga',       'Exceso de carga de trabajo',    2),
  ('motivo_reasignacion', 'especializacion',    'Requiere especialización',      3),
  ('motivo_reasignacion', 'conflicto_interes',  'Conflicto de interés',          4),
  ('motivo_reasignacion', 'vacaciones',         'Vacaciones / ausencia',         5),
  ('motivo_reasignacion', 'solicitud_compania', 'Solicitud de la compañía',      6),
  ('motivo_reasignacion', 'reorg_interna',      'Reorganización interna',        7),
  ('motivo_reasignacion', 'otro',               'Otro (especificar en motivo)', 99)
ON CONFLICT DO NOTHING;

-- ─── PERMISOS: nuevos códigos UCT ────────────────────────────

INSERT INTO permissions (codigo, descripcion) VALUES
  ('usuarios.read',          'Ver lista de usuarios internos'),
  ('usuarios.create',        'Crear usuarios internos'),
  ('usuarios.update',        'Editar perfil de usuario'),
  ('usuarios.deactivate',    'Activar/desactivar usuarios'),
  ('usuarios.assign_roles',  'Asignar y revocar roles (solo admin)'),
  ('cargas.read',            'Ver dashboard de cargas propio'),
  ('cargas.read_all',        'Ver cargas de todos los tramitadores'),
  ('cargas.update_capacity', 'Modificar límites de capacidad'),
  ('asignaciones.read',      'Ver historial de asignaciones propio'),
  ('asignaciones.read_all',  'Ver historial de asignaciones completo'),
  ('asignaciones.create',    'Asignar tramitador a expediente'),
  ('asignaciones.masiva',    'Reasignación masiva'),
  ('reglas_reparto.read',    'Ver reglas de reparto'),
  ('reglas_reparto.update',  'Crear/editar reglas de reparto'),
  ('preasignaciones.update', 'Gestionar preasignaciones')
ON CONFLICT (codigo) DO NOTHING;

-- ─── RPC: refresh manual de la vista materializada ────────────
-- Llamada síncrona desde la API tras cada asignación.
-- En producción se puede sustituir por un trigger o pg_cron.

CREATE OR REPLACE FUNCTION refresh_carga_tramitadores_sync()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_carga_tramitadores;
EXCEPTION WHEN OTHERS THEN
  -- No propagar el error al caller; la vista se refrescará en el próximo cron
  NULL;
END;
$$;
