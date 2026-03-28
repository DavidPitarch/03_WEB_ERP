-- ─── Auto-numeración de expedientes por compañía ────────────────────────────
-- Cada compañía puede tener su propio contador y prefijo:
--   config->>'autonumero_expediente'         BOOLEAN  -- activar/desactivar
--   config->>'autonumero_expediente_prefijo'  TEXT     -- p.ej. "ALL", "GEN", "MAP"
-- Formato generado: PREFIJO_NNN_PROV  (ej: ALL_021_BAR)
-- Si el usuario introduce un numero_expediente manual en el payload, se usa directamente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabla de contadores por compañía (independiente de la global por año)
CREATE TABLE IF NOT EXISTS expediente_counters_compania (
  compania_id UUID    PRIMARY KEY REFERENCES companias(id) ON DELETE CASCADE,
  last_value  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Función auxiliar: nombre de provincia → abreviatura 3 letras ─────────────

CREATE OR REPLACE FUNCTION erp_get_provincia_abrev(p_provincia TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_norm TEXT;
BEGIN
  -- Normalizar: minúsculas + quitar acentos comunes
  v_norm := lower(trim(p_provincia));
  v_norm := replace(replace(replace(replace(v_norm, 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o');
  v_norm := replace(replace(v_norm, 'ú', 'u'), 'ü', 'u');

  RETURN CASE v_norm
    WHEN 'alava'                  THEN 'ALA'
    WHEN 'araba'                  THEN 'ALA'
    WHEN 'albacete'               THEN 'ALB'
    WHEN 'alicante'               THEN 'ALI'
    WHEN 'almeria'                THEN 'ALM'
    WHEN 'asturias'               THEN 'AST'
    WHEN 'avila'                  THEN 'AVI'
    WHEN 'badajoz'                THEN 'BAD'
    WHEN 'barcelona'              THEN 'BAR'
    WHEN 'burgos'                 THEN 'BUR'
    WHEN 'caceres'                THEN 'CAC'
    WHEN 'cadiz'                  THEN 'CAD'
    WHEN 'cantabria'              THEN 'CNT'
    WHEN 'castellon'              THEN 'CAS'
    WHEN 'castellon de la plana'  THEN 'CAS'
    WHEN 'ciudad real'            THEN 'CRE'
    WHEN 'cordoba'                THEN 'COR'
    WHEN 'a coruna'               THEN 'ACO'
    WHEN 'la coruna'              THEN 'ACO'
    WHEN 'cuenca'                 THEN 'CUE'
    WHEN 'girona'                 THEN 'GIR'
    WHEN 'gerona'                 THEN 'GIR'
    WHEN 'granada'                THEN 'GRA'
    WHEN 'guadalajara'            THEN 'GUA'
    WHEN 'gipuzkoa'               THEN 'GUI'
    WHEN 'guipuzcoa'              THEN 'GUI'
    WHEN 'huelva'                 THEN 'HUE'
    WHEN 'huesca'                 THEN 'HUS'
    WHEN 'jaen'                   THEN 'JAE'
    WHEN 'leon'                   THEN 'LEO'
    WHEN 'lleida'                 THEN 'LLE'
    WHEN 'lerida'                 THEN 'LLE'
    WHEN 'la rioja'               THEN 'RIO'
    WHEN 'rioja'                  THEN 'RIO'
    WHEN 'lugo'                   THEN 'LUG'
    WHEN 'madrid'                 THEN 'MAD'
    WHEN 'malaga'                 THEN 'MAL'
    WHEN 'murcia'                 THEN 'MUR'
    WHEN 'navarra'                THEN 'NAV'
    WHEN 'ourense'                THEN 'OUR'
    WHEN 'orense'                 THEN 'OUR'
    WHEN 'palencia'               THEN 'PAL'
    WHEN 'las palmas'             THEN 'LPA'
    WHEN 'pontevedra'             THEN 'PON'
    WHEN 'salamanca'              THEN 'SAL'
    WHEN 'santa cruz de tenerife' THEN 'SCT'
    WHEN 'tenerife'               THEN 'SCT'
    WHEN 'segovia'                THEN 'SEG'
    WHEN 'sevilla'                THEN 'SEV'
    WHEN 'soria'                  THEN 'SOR'
    WHEN 'tarragona'              THEN 'TAR'
    WHEN 'teruel'                 THEN 'TER'
    WHEN 'toledo'                 THEN 'TOL'
    WHEN 'valencia'               THEN 'VAL'
    WHEN 'valladolid'             THEN 'VLL'
    WHEN 'vizcaya'                THEN 'VIZ'
    WHEN 'bizkaia'                THEN 'VIZ'
    WHEN 'zamora'                 THEN 'ZAM'
    WHEN 'zaragoza'               THEN 'ZAR'
    WHEN 'illes balears'          THEN 'BAL'
    WHEN 'baleares'               THEN 'BAL'
    WHEN 'mallorca'               THEN 'BAL'
    WHEN 'ceuta'                  THEN 'CEU'
    WHEN 'melilla'                THEN 'MEL'
    ELSE upper(left(trim(p_provincia), 3))  -- fallback: primeras 3 letras
  END;
END;
$$;

-- ─── Preview: siguiente número sugerido SIN incrementar el contador ───────────
-- Usado por el frontend para mostrar la sugerencia antes de crear el expediente.

CREATE OR REPLACE FUNCTION erp_preview_expediente_numero_compania(
  p_compania_id UUID,
  p_provincia   TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config  JSONB;
  v_prefijo TEXT;
  v_seq     INTEGER;
  v_abrev   TEXT;
BEGIN
  SELECT config INTO v_config FROM companias WHERE id = p_compania_id;
  v_prefijo := upper(trim(COALESCE(NULLIF(v_config->>'autonumero_expediente_prefijo', ''), 'EXP')));

  SELECT COALESCE(last_value, 0) + 1
  INTO v_seq
  FROM expediente_counters_compania
  WHERE compania_id = p_compania_id;

  IF v_seq IS NULL THEN v_seq := 1; END IF;

  v_abrev := erp_get_provincia_abrev(COALESCE(NULLIF(trim(p_provincia), ''), '---'));

  RETURN format('%s_%s_%s', v_prefijo, lpad(v_seq::TEXT, 3, '0'), v_abrev);
END;
$$;

-- ─── Creación real: siguiente número incrementando el contador ────────────────

CREATE OR REPLACE FUNCTION erp_next_expediente_numero_compania(
  p_compania_id UUID,
  p_provincia   TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config  JSONB;
  v_prefijo TEXT;
  v_seq     INTEGER;
  v_abrev   TEXT;
BEGIN
  SELECT config INTO v_config FROM companias WHERE id = p_compania_id;
  v_prefijo := upper(trim(COALESCE(NULLIF(v_config->>'autonumero_expediente_prefijo', ''), 'EXP')));

  INSERT INTO expediente_counters_compania (compania_id, last_value, updated_at)
  VALUES (p_compania_id, 1, NOW())
  ON CONFLICT (compania_id) DO UPDATE
    SET last_value = expediente_counters_compania.last_value + 1,
        updated_at = NOW()
  RETURNING last_value INTO v_seq;

  v_abrev := erp_get_provincia_abrev(COALESCE(NULLIF(trim(p_provincia), ''), '---'));

  RETURN format('%s_%s_%s', v_prefijo, lpad(v_seq::TEXT, 3, '0'), v_abrev);
END;
$$;

-- ─── Actualizar erp_create_expediente ─────────────────────────────────────────
-- Lógica de numeración (por orden de prioridad):
--   1. Si el payload incluye `numero_expediente` → usarlo directamente (manual)
--   2. Si la compañía tiene autonumero_expediente=true en config → formato compañía
--   3. En caso contrario → formato global EXP-YYYY-#####

CREATE OR REPLACE FUNCTION erp_create_expediente(
  p_payload        JSONB,
  p_actor_id       UUID,
  p_ip             INET DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload            JSONB        := COALESCE(p_payload, '{}'::JSONB);
  v_asegurado_payload  JSONB        := v_payload->'asegurado_nuevo';
  v_asegurado_id       UUID;
  v_numero             TEXT;
  v_fecha_encargo      TIMESTAMPTZ  := COALESCE((v_payload->>'fecha_encargo')::TIMESTAMPTZ, NOW());
  v_compania_config    JSONB;
  v_autonumero         BOOLEAN;
  v_expediente         expedientes%ROWTYPE;
BEGIN
  -- ── 1. Asegurado: existente o nuevo ─────────────────────────────────────────
  IF NULLIF(trim(v_payload->>'asegurado_id'), '') IS NOT NULL THEN
    v_asegurado_id := (v_payload->>'asegurado_id')::UUID;
  ELSIF jsonb_typeof(v_asegurado_payload) = 'object' THEN
    INSERT INTO asegurados (
      nombre, apellidos, telefono, telefono2,
      email, nif, direccion, codigo_postal, localidad, provincia
    )
    VALUES (
      v_asegurado_payload->>'nombre',
      v_asegurado_payload->>'apellidos',
      v_asegurado_payload->>'telefono',
      NULLIF(v_asegurado_payload->>'telefono2', ''),
      NULLIF(v_asegurado_payload->>'email', ''),
      NULLIF(v_asegurado_payload->>'nif', ''),
      v_asegurado_payload->>'direccion',
      v_asegurado_payload->>'codigo_postal',
      v_asegurado_payload->>'localidad',
      v_asegurado_payload->>'provincia'
    )
    RETURNING id INTO v_asegurado_id;
  ELSE
    PERFORM erp_raise_business_error('VALIDATION', 'Debe indicar asegurado_id o asegurado_nuevo');
  END IF;

  -- ── 2. Número de expediente ──────────────────────────────────────────────────
  IF NULLIF(trim(v_payload->>'numero_expediente'), '') IS NOT NULL THEN
    -- Manual: usar el número facilitado directamente
    v_numero := trim(v_payload->>'numero_expediente');
  ELSE
    -- Comprobar configuración de auto-numeración de la compañía
    SELECT config INTO v_compania_config
      FROM companias WHERE id = (v_payload->>'compania_id')::UUID;

    v_autonumero := COALESCE((v_compania_config->>'autonumero_expediente')::BOOLEAN, false);

    IF v_autonumero THEN
      v_numero := erp_next_expediente_numero_compania(
        (v_payload->>'compania_id')::UUID,
        COALESCE(v_payload->>'provincia', '')
      );
    ELSE
      v_numero := erp_next_expediente_numero(v_fecha_encargo);
    END IF;
  END IF;

  -- ── 3. Insertar expediente ───────────────────────────────────────────────────
  INSERT INTO expedientes (
    numero_expediente,
    estado,
    compania_id,
    empresa_facturadora_id,
    asegurado_id,
    tipo_siniestro,
    descripcion,
    declaracion_siniestro,
    direccion_siniestro,
    codigo_postal,
    localidad,
    provincia,
    numero_poliza,
    numero_siniestro_cia,
    prioridad,
    fecha_encargo,
    fecha_limite_sla,
    origen,
    referencia_externa,
    datos_origen
  )
  VALUES (
    v_numero,
    'NUEVO',
    (v_payload->>'compania_id')::UUID,
    (v_payload->>'empresa_facturadora_id')::UUID,
    v_asegurado_id,
    v_payload->>'tipo_siniestro',
    v_payload->>'descripcion',
    NULLIF(v_payload->>'declaracion_siniestro', ''),
    v_payload->>'direccion_siniestro',
    v_payload->>'codigo_postal',
    v_payload->>'localidad',
    v_payload->>'provincia',
    NULLIF(v_payload->>'numero_poliza', ''),
    NULLIF(v_payload->>'numero_siniestro_cia', ''),
    COALESCE((v_payload->>'prioridad')::prioridad, 'media'::prioridad),
    v_fecha_encargo,
    (v_payload->>'fecha_limite_sla')::TIMESTAMPTZ,
    COALESCE((v_payload->>'origen')::expediente_origen, 'manual'::expediente_origen),
    NULLIF(v_payload->>'referencia_externa', ''),
    COALESCE(v_payload->'datos_origen', '{}'::JSONB)
  )
  RETURNING * INTO v_expediente;

  PERFORM erp_insert_historial_estado(v_expediente.id, NULL, 'NUEVO', NULL, p_actor_id);

  PERFORM erp_insert_auditoria(
    'expedientes',
    v_expediente.id,
    'INSERT',
    p_actor_id,
    jsonb_build_object(
      'numero_expediente',      v_expediente.numero_expediente,
      'estado',                 v_expediente.estado,
      'compania_id',            v_expediente.compania_id,
      'empresa_facturadora_id', v_expediente.empresa_facturadora_id,
      'asegurado_id',           v_expediente.asegurado_id,
      'tipo_siniestro',         v_expediente.tipo_siniestro,
      'descripcion',            v_expediente.descripcion,
      'declaracion_siniestro',  v_expediente.declaracion_siniestro,
      'direccion_siniestro',    v_expediente.direccion_siniestro,
      'codigo_postal',          v_expediente.codigo_postal,
      'localidad',              v_expediente.localidad,
      'provincia',              v_expediente.provincia,
      'numero_poliza',          v_expediente.numero_poliza,
      'numero_siniestro_cia',   v_expediente.numero_siniestro_cia,
      'prioridad',              v_expediente.prioridad,
      'fecha_limite_sla',       v_expediente.fecha_limite_sla,
      'origen',                 v_expediente.origen,
      'referencia_externa',     v_expediente.referencia_externa
    ),
    p_ip
  );

  PERFORM erp_insert_evento_dominio(
    v_expediente.id,
    'expediente',
    'ExpedienteCreado',
    jsonb_build_object(
      'numero_expediente',  v_expediente.numero_expediente,
      'tipo_siniestro',     v_expediente.tipo_siniestro,
      'origen',             v_expediente.origen,
      'referencia_externa', v_expediente.referencia_externa
    ),
    p_actor_id,
    p_correlation_id,
    NULL
  );

  RETURN to_jsonb(v_expediente);

EXCEPTION
  WHEN unique_violation THEN
    IF sqlerrm ILIKE '%numero_expediente%' THEN
      PERFORM erp_raise_business_error('CONFLICT', format(
        'Ya existe un expediente con el número «%s». Introduce un número diferente.',
        v_numero
      ));
    ELSIF sqlerrm ILIKE '%referencia_externa%' THEN
      PERFORM erp_raise_business_error('CONFLICT', 'Ya existe un expediente con esa referencia externa');
    END IF;
    RAISE;
END;
$$;
