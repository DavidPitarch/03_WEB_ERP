-- ═══════════════════════════════════════════════════════════════
--  MÓDULO: CALENDARIO OPERATIVO
--  Gestión de festivos, ausencias, guardias, reglas de disponibilidad
--  y su impacto en agenda, SLA y asignaciones.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── 1. FESTIVOS MULTI-ÁMBITO ────────────────────────────────────────────────
-- Extiende calendario_laboral con soporte jerárquico:
-- nacional → autonómico → provincial → local → empresa

CREATE TABLE IF NOT EXISTS cal_festivos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha              DATE NOT NULL,
  nombre             TEXT NOT NULL,
  ambito             TEXT NOT NULL
    CHECK (ambito IN ('nacional', 'autonomico', 'provincial', 'local', 'empresa')),
  comunidad_autonoma TEXT,   -- código ISO p.ej. 'CAT', 'MAD', 'VAL', 'AND'
  provincia          TEXT,   -- código INE p.ej. '08', '28', '46'
  municipio          TEXT,   -- nombre libre del municipio
  empresa_id         UUID REFERENCES empresas_facturadoras(id) ON DELETE SET NULL,
  activo             BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unicidad por fecha + contexto completo
  UNIQUE NULLS NOT DISTINCT (
    fecha, ambito,
    comunidad_autonoma, provincia, municipio, empresa_id
  )
);

-- ─── 2. AUSENCIAS DE OPERARIO ────────────────────────────────────────────────
-- Vacaciones, bajas médicas, bloqueos, permisos retribuidos, etc.

CREATE TABLE IF NOT EXISTS cal_ausencias (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id            UUID NOT NULL REFERENCES operarios(id) ON DELETE CASCADE,
  tipo                   TEXT NOT NULL
    CHECK (tipo IN ('vacacion','baja_medica','baja_laboral',
                    'asunto_personal','permiso_retribuido','bloqueo')),
  fecha_inicio           DATE NOT NULL,
  fecha_fin              DATE NOT NULL,
  motivo                 TEXT,
  estado                 TEXT NOT NULL DEFAULT 'solicitada'
    CHECK (estado IN ('solicitada','aprobada','rechazada','cancelada')),
  aprobada_por           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobada_at            TIMESTAMPTZ,
  motivo_rechazo         TEXT,
  -- Campos calculados/denormalizados actualizados por trigger
  citas_afectadas_count  INTEGER NOT NULL DEFAULT 0,
  sla_pausado            BOOLEAN NOT NULL DEFAULT FALSE,
  created_by             UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin >= fecha_inicio),
  -- No dos ausencias activas del mismo tipo que se solapen para el mismo operario
  EXCLUDE USING gist (
    operario_id WITH =,
    daterange(fecha_inicio, fecha_fin, '[]') WITH &&
  ) WHERE (estado IN ('solicitada','aprobada'))
);

-- ─── 3. GUARDIAS Y RETENES ──────────────────────────────────────────────────
-- Turnos de guardia, retén, disponibilidad ampliada.
-- Permiten trabajar fuera del horario o zona habituales.

CREATE TABLE IF NOT EXISTS cal_guardias (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id    UUID NOT NULL REFERENCES operarios(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL
    CHECK (tipo IN ('guardia','reten','turno_especial','disponibilidad_ampliada')),
  fecha_inicio   TIMESTAMPTZ NOT NULL,
  fecha_fin      TIMESTAMPTZ NOT NULL,
  zona_cp        TEXT[],          -- CPs o prefijos de CP que cubre
  especialidades TEXT[],          -- gremios habilitados durante la guardia
  observaciones  TEXT,
  activa         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin > fecha_inicio)
);

-- ─── 4. REGLAS DE DISPONIBILIDAD ────────────────────────────────────────────
-- Franjas horarias y días válidos para citas, por empresa/zona/especialidad.

CREATE TABLE IF NOT EXISTS cal_reglas_disponibilidad (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  zona_cp        TEXT,            -- prefijo CP (p.ej. '08', '28') o NULL = todas
  especialidad   TEXT,            -- gremio o NULL = todos
  dias_semana    INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
    -- 0=domingo, 1=lunes … 6=sábado
  hora_inicio    TIME NOT NULL DEFAULT '08:00',
  hora_fin       TIME NOT NULL DEFAULT '18:00',
  vigente_desde  DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta  DATE,
  activa         BOOLEAN NOT NULL DEFAULT TRUE,
  descripcion    TEXT,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (hora_fin > hora_inicio),
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

-- ─── 5. EXCEPCIONES JUSTIFICADAS ────────────────────────────────────────────
-- Permite crear citas en días bloqueados con justificación y aprobación.

CREATE TABLE IF NOT EXISTS cal_excepciones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_excepcion   TEXT NOT NULL
    CHECK (tipo_excepcion IN (
      'cita_en_festivo','cita_en_ausencia',
      'fuera_horario','cita_en_bloqueo')),
  referencia_id    UUID,    -- UUID de cita, ausencia, etc.
  referencia_tabla TEXT,    -- 'citas', 'cal_ausencias', …
  justificacion    TEXT NOT NULL,
  aprobada_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobada_at      TIMESTAMPTZ,
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ÍNDICES ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cal_festivos_fecha        ON cal_festivos (fecha);
CREATE INDEX IF NOT EXISTS idx_cal_festivos_ambito       ON cal_festivos (ambito, activo);
CREATE INDEX IF NOT EXISTS idx_cal_festivos_empresa      ON cal_festivos (empresa_id) WHERE empresa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cal_ausencias_operario    ON cal_ausencias (operario_id, estado);
CREATE INDEX IF NOT EXISTS idx_cal_ausencias_rango       ON cal_ausencias USING gist (daterange(fecha_inicio, fecha_fin, '[]'));
CREATE INDEX IF NOT EXISTS idx_cal_ausencias_estado      ON cal_ausencias (estado);

CREATE INDEX IF NOT EXISTS idx_cal_guardias_operario     ON cal_guardias (operario_id, activa);
CREATE INDEX IF NOT EXISTS idx_cal_guardias_rango        ON cal_guardias (fecha_inicio, fecha_fin);

CREATE INDEX IF NOT EXISTS idx_cal_reglas_empresa        ON cal_reglas_disponibilidad (empresa_id, activa);
CREATE INDEX IF NOT EXISTS idx_cal_excepciones_ref       ON cal_excepciones (referencia_id) WHERE referencia_id IS NOT NULL;

-- ─── TRIGGER updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cal_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cal_ausencias_updated_at
  BEFORE UPDATE ON cal_ausencias
  FOR EACH ROW EXECUTE FUNCTION cal_set_updated_at();

CREATE TRIGGER cal_guardias_updated_at
  BEFORE UPDATE ON cal_guardias
  FOR EACH ROW EXECUTE FUNCTION cal_set_updated_at();

-- ─── FUNCIÓN: COMPROBAR DISPONIBILIDAD DE OPERARIO ──────────────────────────
-- Devuelve un JSON con disponible: bool + lista de motivos de bloqueo.
-- Usado por la API antes de crear/mover una cita.

CREATE OR REPLACE FUNCTION cal_check_operario_disponible(
  p_operario_id  UUID,
  p_fecha        DATE,
  p_franja_ini   TIME,
  p_franja_fin   TIME,
  p_empresa_id   UUID  DEFAULT NULL,
  p_provincia    TEXT  DEFAULT NULL,
  p_comunidad    TEXT  DEFAULT NULL,
  p_excepcion_id UUID  DEFAULT NULL   -- si existe excepción aprobada, omitir bloqueo
)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_dia_semana       INT;
  v_bloqueos         JSONB := '[]'::JSONB;
  v_tiene_guardia    BOOLEAN := FALSE;
  v_ausencia         RECORD;
  v_festivo          RECORD;
  v_regla            RECORD;
  v_excepcion_valida BOOLEAN := FALSE;
BEGIN
  -- Día de la semana (0=domingo … 6=sábado) en UTC
  v_dia_semana := EXTRACT(DOW FROM p_fecha);

  -- Comprobar si hay excepción aprobada para la fecha/operario
  IF p_excepcion_id IS NOT NULL THEN
    SELECT id INTO v_excepcion_valida
    FROM cal_excepciones
    WHERE id = p_excepcion_id
      AND aprobada_por IS NOT NULL
      AND aprobada_at IS NOT NULL;
  END IF;

  -- 1. ¿Tiene ausencia aprobada que cubra esta fecha?
  SELECT id, tipo, motivo INTO v_ausencia
  FROM cal_ausencias
  WHERE operario_id = p_operario_id
    AND estado = 'aprobada'
    AND fecha_inicio <= p_fecha
    AND fecha_fin    >= p_fecha
  LIMIT 1;

  IF FOUND AND NOT v_excepcion_valida THEN
    v_bloqueos := v_bloqueos || jsonb_build_object(
      'tipo', 'ausencia',
      'descripcion', 'Operario con ausencia aprobada: ' || v_ausencia.tipo,
      'referencia_id', v_ausencia.id
    );
  END IF;

  -- 2. ¿Es festivo aplicable?
  SELECT id, nombre, ambito INTO v_festivo
  FROM cal_festivos
  WHERE activo = TRUE
    AND fecha = p_fecha
    AND (
      ambito = 'nacional'
      OR (ambito = 'autonomico'  AND p_comunidad  IS NOT NULL AND comunidad_autonoma = p_comunidad)
      OR (ambito = 'provincial'  AND p_provincia   IS NOT NULL AND provincia = p_provincia)
      OR (ambito = 'empresa'     AND p_empresa_id  IS NOT NULL AND empresa_id = p_empresa_id)
      OR (ambito = 'local')  -- locales siempre aplicables si están activos
    )
  LIMIT 1;

  IF FOUND AND NOT v_excepcion_valida THEN
    v_bloqueos := v_bloqueos || jsonb_build_object(
      'tipo', 'festivo',
      'descripcion', 'Festivo: ' || v_festivo.nombre || ' (' || v_festivo.ambito || ')',
      'referencia_id', v_festivo.id
    );
  END IF;

  -- 3. Verificar reglas de disponibilidad horaria
  SELECT id INTO v_regla
  FROM cal_reglas_disponibilidad
  WHERE activa = TRUE
    AND (empresa_id IS NULL OR empresa_id = p_empresa_id)
    AND (zona_cp    IS NULL OR p_provincia LIKE zona_cp || '%')
    AND vigente_desde <= p_fecha
    AND (vigente_hasta IS NULL OR vigente_hasta >= p_fecha)
    AND v_dia_semana = ANY(dias_semana)
    AND hora_inicio <= p_franja_ini
    AND hora_fin    >= p_franja_fin
  LIMIT 1;

  -- Si no hay ninguna regla que admita esta franja → fuera de horario
  -- (sólo aplica si existen reglas configuradas para esta empresa/zona)
  IF NOT FOUND THEN
    PERFORM id FROM cal_reglas_disponibilidad
    WHERE activa = TRUE
      AND (empresa_id IS NULL OR empresa_id = p_empresa_id)
      AND vigente_desde <= p_fecha
      AND (vigente_hasta IS NULL OR vigente_hasta >= p_fecha);

    IF FOUND AND NOT v_excepcion_valida THEN
      v_bloqueos := v_bloqueos || jsonb_build_object(
        'tipo', 'fuera_horario',
        'descripcion', 'La franja solicitada está fuera del horario operativo configurado',
        'referencia_id', NULL
      );
    END IF;
  END IF;

  -- 4. ¿Tiene guardia activa que amplíe su disponibilidad?
  SELECT EXISTS (
    SELECT 1 FROM cal_guardias
    WHERE operario_id = p_operario_id
      AND activa = TRUE
      AND fecha_inicio <= (p_fecha + p_franja_ini)::TIMESTAMPTZ
      AND fecha_fin    >= (p_fecha + p_franja_fin)::TIMESTAMPTZ
  ) INTO v_tiene_guardia;

  RETURN jsonb_build_object(
    'disponible',      jsonb_array_length(v_bloqueos) = 0,
    'motivos_bloqueo', v_bloqueos,
    'tiene_guardia',   v_tiene_guardia
  );
END;
$$;

-- ─── FUNCIÓN: FESTIVOS APLICABLES PARA UNA FECHA Y CONTEXTO ────────────────

CREATE OR REPLACE FUNCTION cal_get_festivos_fecha(
  p_fecha        DATE,
  p_empresa_id   UUID  DEFAULT NULL,
  p_provincia    TEXT  DEFAULT NULL,
  p_comunidad    TEXT  DEFAULT NULL
)
RETURNS TABLE (id UUID, nombre TEXT, ambito TEXT)
LANGUAGE sql STABLE AS $$
  SELECT id, nombre, ambito
  FROM cal_festivos
  WHERE activo = TRUE
    AND fecha = p_fecha
    AND (
      ambito = 'nacional'
      OR (ambito = 'autonomico' AND comunidad_autonoma = p_comunidad)
      OR (ambito = 'provincial' AND provincia = p_provincia)
      OR (ambito = 'empresa'    AND empresa_id = p_empresa_id)
      OR  ambito = 'local'
    );
$$;

-- ─── FUNCIÓN: APROBACIÓN DE AUSENCIA CON EFECTOS COLATERALES ───────────────
-- Aprueba la ausencia y registra cuántas citas quedan afectadas.
-- El backend decide si pausar SLA (depende del estado del expediente).

CREATE OR REPLACE FUNCTION cal_aprobar_ausencia(
  p_ausencia_id UUID,
  p_actor_id    UUID,
  p_ip          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_ausencia     RECORD;
  v_citas_count  INT;
BEGIN
  SELECT * INTO v_ausencia
  FROM cal_ausencias
  WHERE id = p_ausencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUSENCIA_NOT_FOUND: Ausencia % no encontrada', p_ausencia_id;
  END IF;

  IF v_ausencia.estado NOT IN ('solicitada') THEN
    RAISE EXCEPTION 'AUSENCIA_ESTADO_INVALIDO: Solo se pueden aprobar ausencias en estado solicitada. Estado actual: %', v_ausencia.estado;
  END IF;

  -- Contar citas futuras del operario que caen en el rango
  SELECT COUNT(*) INTO v_citas_count
  FROM citas
  WHERE operario_id = v_ausencia.operario_id
    AND fecha BETWEEN v_ausencia.fecha_inicio AND v_ausencia.fecha_fin
    AND estado IN ('programada','confirmada');

  -- Aprobar
  UPDATE cal_ausencias SET
    estado               = 'aprobada',
    aprobada_por         = p_actor_id,
    aprobada_at          = NOW(),
    citas_afectadas_count = v_citas_count,
    updated_at           = NOW()
  WHERE id = p_ausencia_id;

  -- Emitir evento de dominio para que el backend procese reasignaciones y SLA
  INSERT INTO eventos_dominio (
    aggregate_id, aggregate_type, event_type,
    payload, actor_id, correlation_id
  ) VALUES (
    p_ausencia_id,
    'cal_ausencia',
    'ausencia.aprobada',
    jsonb_build_object(
      'ausencia_id',    p_ausencia_id,
      'operario_id',    v_ausencia.operario_id,
      'fecha_inicio',   v_ausencia.fecha_inicio,
      'fecha_fin',      v_ausencia.fecha_fin,
      'tipo',           v_ausencia.tipo,
      'citas_afectadas', v_citas_count
    ),
    p_actor_id,
    gen_random_uuid()
  );

  RETURN jsonb_build_object(
    'ausencia_id',    p_ausencia_id,
    'estado',         'aprobada',
    'citas_afectadas', v_citas_count
  );
END;
$$;

-- ─── FUNCIÓN: RECHAZO DE AUSENCIA ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cal_rechazar_ausencia(
  p_ausencia_id    UUID,
  p_actor_id       UUID,
  p_motivo_rechazo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE cal_ausencias SET
    estado         = 'rechazada',
    motivo_rechazo = p_motivo_rechazo,
    aprobada_por   = p_actor_id,
    aprobada_at    = NOW(),
    updated_at     = NOW()
  WHERE id = p_ausencia_id
    AND estado = 'solicitada';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUSENCIA_NOT_FOUND_OR_INVALID: Ausencia no encontrada o no está en estado solicitada';
  END IF;

  RETURN jsonb_build_object('ausencia_id', p_ausencia_id, 'estado', 'rechazada');
END;
$$;

-- ─── VISTA: CALENDARIO UNIFICADO (para endpoint de planning) ─────────────────
-- Une festivos, ausencias activas y guardias en una sola vista.

CREATE OR REPLACE VIEW v_calendario_operativo AS
SELECT
  'festivo'::TEXT                AS tipo_evento,
  f.id,
  NULL::UUID                     AS operario_id,
  f.fecha::TIMESTAMPTZ           AS fecha_inicio,
  (f.fecha + INTERVAL '1 day')   AS fecha_fin,
  f.nombre                       AS titulo,
  f.ambito                       AS subtipo,
  f.empresa_id,
  jsonb_build_object(
    'comunidad_autonoma', f.comunidad_autonoma,
    'provincia',          f.provincia,
    'municipio',          f.municipio
  )                              AS metadata
FROM cal_festivos f
WHERE f.activo = TRUE

UNION ALL

SELECT
  'ausencia'::TEXT               AS tipo_evento,
  a.id,
  a.operario_id,
  a.fecha_inicio::TIMESTAMPTZ    AS fecha_inicio,
  (a.fecha_fin + INTERVAL '1 day')::TIMESTAMPTZ AS fecha_fin,
  'Ausencia: ' || a.tipo         AS titulo,
  a.tipo                         AS subtipo,
  NULL::UUID                     AS empresa_id,
  jsonb_build_object(
    'estado',  a.estado,
    'motivo',  a.motivo,
    'sla_pausado', a.sla_pausado
  )                              AS metadata
FROM cal_ausencias a
WHERE a.estado IN ('solicitada','aprobada')

UNION ALL

SELECT
  'guardia'::TEXT                AS tipo_evento,
  g.id,
  g.operario_id,
  g.fecha_inicio,
  g.fecha_fin,
  'Guardia: ' || g.tipo          AS titulo,
  g.tipo                         AS subtipo,
  NULL::UUID                     AS empresa_id,
  jsonb_build_object(
    'zona_cp',       g.zona_cp,
    'especialidades', g.especialidades,
    'observaciones', g.observaciones
  )                              AS metadata
FROM cal_guardias g
WHERE g.activa = TRUE;

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE cal_festivos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cal_ausencias              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cal_guardias               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cal_reglas_disponibilidad  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cal_excepciones            ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado puede leer el calendario
CREATE POLICY cal_festivos_select ON cal_festivos
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY cal_festivos_insert ON cal_festivos
  FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY cal_festivos_delete ON cal_festivos
  FOR DELETE TO authenticated USING (TRUE);

CREATE POLICY cal_ausencias_select ON cal_ausencias
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY cal_ausencias_all ON cal_ausencias
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY cal_guardias_select ON cal_guardias
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY cal_guardias_all ON cal_guardias
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY cal_reglas_select ON cal_reglas_disponibilidad
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY cal_reglas_all ON cal_reglas_disponibilidad
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY cal_excepciones_select ON cal_excepciones
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY cal_excepciones_all ON cal_excepciones
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ─── DATOS SEMILLA: festivos nacionales España 2026 ─────────────────────────

INSERT INTO cal_festivos (fecha, nombre, ambito) VALUES
  ('2026-01-01', 'Año Nuevo',                    'nacional'),
  ('2026-01-06', 'Epifanía del Señor',            'nacional'),
  ('2026-04-02', 'Jueves Santo',                  'nacional'),
  ('2026-04-03', 'Viernes Santo',                 'nacional'),
  ('2026-05-01', 'Fiesta del Trabajo',            'nacional'),
  ('2026-08-15', 'Asunción de la Virgen',         'nacional'),
  ('2026-10-12', 'Fiesta Nacional de España',     'nacional'),
  ('2026-11-01', 'Todos los Santos',              'nacional'),
  ('2026-12-06', 'Día de la Constitución',        'nacional'),
  ('2026-12-08', 'Inmaculada Concepción',         'nacional'),
  ('2026-12-25', 'Navidad',                       'nacional')
ON CONFLICT DO NOTHING;

-- Festivos autonómicos Madrid
INSERT INTO cal_festivos (fecha, nombre, ambito, comunidad_autonoma) VALUES
  ('2026-03-02', 'Lunes de Carnaval',    'autonomico', 'MAD'),
  ('2026-05-02', 'Fiesta de la Comunidad de Madrid', 'autonomico', 'MAD'),
  ('2026-07-25', 'Santiago Apóstol',    'autonomico', 'MAD'),
  ('2026-11-09', 'Almudena',            'autonomico', 'MAD')
ON CONFLICT DO NOTHING;

-- Festivos autonómicos Cataluña
INSERT INTO cal_festivos (fecha, nombre, ambito, comunidad_autonoma) VALUES
  ('2026-04-06', 'Lunes de Pascua',             'autonomico', 'CAT'),
  ('2026-06-24', 'San Juan',                    'autonomico', 'CAT'),
  ('2026-09-11', 'Diada Nacional de Catalunya', 'autonomico', 'CAT'),
  ('2026-12-26', 'San Esteban',                 'autonomico', 'CAT')
ON CONFLICT DO NOTHING;

-- Festivos autonómicos Valencia
INSERT INTO cal_festivos (fecha, nombre, ambito, comunidad_autonoma) VALUES
  ('2026-03-19', 'San José / Fallas',           'autonomico', 'VAL'),
  ('2026-04-06', 'Lunes de Pascua',             'autonomico', 'VAL'),
  ('2026-10-09', 'Día de la Comunitat Valenciana', 'autonomico', 'VAL')
ON CONFLICT DO NOTHING;

-- Regla de disponibilidad por defecto (L-V 08:00-18:00, sin restricción de empresa ni zona)
INSERT INTO cal_reglas_disponibilidad
  (dias_semana, hora_inicio, hora_fin, descripcion)
VALUES
  (ARRAY[1,2,3,4,5], '08:00', '18:00', 'Horario operativo estándar L-V')
ON CONFLICT DO NOTHING;
