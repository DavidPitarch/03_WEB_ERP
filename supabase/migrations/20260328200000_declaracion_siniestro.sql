-- ─── Declaración de siniestro ────────────────────────────────────────────────
-- Añade el campo `declaracion_siniestro` a la tabla `expedientes`.
-- Es el texto libre enviado por la compañía/tramitador en la apertura
-- describiendo lo ocurrido desde el punto de vista del asegurado.
-- Se muestra justo debajo de la cabecera del expediente en el backoffice.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS declaracion_siniestro TEXT;

-- Actualizar la función de creación para que reciba y persista el campo
CREATE OR REPLACE FUNCTION erp_create_expediente(
  p_payload       JSONB,
  p_actor_id      UUID,
  p_ip            INET DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload            JSONB := COALESCE(p_payload, '{}'::JSONB);
  v_asegurado_payload  JSONB := v_payload->'asegurado_nuevo';
  v_asegurado_id       UUID;
  v_numero             TEXT;
  v_fecha_encargo      TIMESTAMPTZ := COALESCE((v_payload->>'fecha_encargo')::TIMESTAMPTZ, NOW());
  v_expediente         expedientes%ROWTYPE;
BEGIN
  -- Asegurado: existente o nuevo
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

  v_numero := erp_next_expediente_numero(v_fecha_encargo);

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
      'numero_expediente',    v_expediente.numero_expediente,
      'estado',               v_expediente.estado,
      'compania_id',          v_expediente.compania_id,
      'empresa_facturadora_id', v_expediente.empresa_facturadora_id,
      'asegurado_id',         v_expediente.asegurado_id,
      'tipo_siniestro',       v_expediente.tipo_siniestro,
      'descripcion',          v_expediente.descripcion,
      'declaracion_siniestro', v_expediente.declaracion_siniestro,
      'direccion_siniestro',  v_expediente.direccion_siniestro,
      'codigo_postal',        v_expediente.codigo_postal,
      'localidad',            v_expediente.localidad,
      'provincia',            v_expediente.provincia,
      'numero_poliza',        v_expediente.numero_poliza,
      'numero_siniestro_cia', v_expediente.numero_siniestro_cia,
      'prioridad',            v_expediente.prioridad,
      'fecha_limite_sla',     v_expediente.fecha_limite_sla,
      'origen',               v_expediente.origen,
      'referencia_externa',   v_expediente.referencia_externa
    ),
    p_ip
  );

  PERFORM erp_insert_evento_dominio(
    v_expediente.id,
    'expediente',
    'ExpedienteCreado',
    jsonb_build_object(
      'numero_expediente', v_expediente.numero_expediente,
      'tipo_siniestro',    v_expediente.tipo_siniestro,
      'origen',            v_expediente.origen,
      'referencia_externa', v_expediente.referencia_externa
    ),
    p_actor_id,
    p_correlation_id,
    NULL
  );

  RETURN to_jsonb(v_expediente);
EXCEPTION
  WHEN unique_violation THEN
    IF sqlerrm ILIKE '%referencia_externa%' THEN
      PERFORM erp_raise_business_error('CONFLICT', 'Ya existe un expediente con esa referencia externa');
    END IF;
    RAISE;
END;
$$;
