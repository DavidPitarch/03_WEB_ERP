-- ============================================================
-- R3-A: Comandos transaccionales del core y numeracion segura
-- ============================================================

CREATE TABLE IF NOT EXISTS expediente_counters (
  year INTEGER PRIMARY KEY CHECK (year >= 2000),
  last_value INTEGER NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expediente_counters ENABLE ROW LEVEL SECURITY;

INSERT INTO expediente_counters (year, last_value, updated_at)
SELECT
  substring(numero_expediente from '^EXP-(\d{4})-')::INTEGER AS year,
  max(substring(numero_expediente from '(\d+)$')::INTEGER) AS last_value,
  NOW()
FROM expedientes
WHERE numero_expediente ~ '^EXP-\d{4}-\d+$'
GROUP BY 1
ON CONFLICT (year) DO UPDATE
SET last_value = GREATEST(expediente_counters.last_value, EXCLUDED.last_value),
    updated_at = NOW();

CREATE OR REPLACE FUNCTION erp_raise_business_error(p_code TEXT, p_detail TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = p_code, DETAIL = p_detail;
END;
$$;

CREATE OR REPLACE FUNCTION erp_insert_auditoria(
  p_tabla TEXT,
  p_registro_id UUID,
  p_accion auditoria_accion,
  p_actor_id UUID,
  p_cambios JSONB,
  p_ip INET DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO auditoria (tabla, registro_id, accion, actor_id, cambios, ip)
  VALUES (p_tabla, p_registro_id, p_accion, p_actor_id, COALESCE(p_cambios, '{}'::JSONB), p_ip);
END;
$$;

CREATE OR REPLACE FUNCTION erp_insert_historial_estado(
  p_expediente_id UUID,
  p_estado_anterior expediente_estado,
  p_estado_nuevo expediente_estado,
  p_motivo TEXT,
  p_actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO historial_estados (expediente_id, estado_anterior, estado_nuevo, motivo, actor_id)
  VALUES (p_expediente_id, p_estado_anterior, p_estado_nuevo, p_motivo, p_actor_id);
END;
$$;

CREATE OR REPLACE FUNCTION erp_insert_evento_dominio(
  p_aggregate_id UUID,
  p_aggregate_type TEXT,
  p_event_type TEXT,
  p_payload JSONB,
  p_actor_id UUID,
  p_correlation_id UUID DEFAULT NULL,
  p_causation_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO eventos_dominio (
    aggregate_id,
    aggregate_type,
    event_type,
    payload,
    actor_id,
    correlation_id,
    causation_id
  )
  VALUES (
    p_aggregate_id,
    p_aggregate_type,
    p_event_type,
    COALESCE(p_payload, '{}'::JSONB),
    p_actor_id,
    COALESCE(p_correlation_id, gen_random_uuid()),
    p_causation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION erp_next_expediente_numero(
  p_fecha_encargo TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := extract(year from timezone('UTC', COALESCE(p_fecha_encargo, NOW())))::INTEGER;
  v_seq INTEGER;
BEGIN
  INSERT INTO expediente_counters (year, last_value, updated_at)
  VALUES (v_year, 1, NOW())
  ON CONFLICT (year) DO UPDATE
  SET last_value = expediente_counters.last_value + 1,
      updated_at = NOW()
  RETURNING last_value INTO v_seq;

  RETURN format('EXP-%s-%s', v_year, lpad(v_seq::TEXT, 5, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION erp_is_pending_state(p_estado expediente_estado)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_estado::TEXT LIKE 'PENDIENTE%';
$$;

CREATE OR REPLACE FUNCTION erp_can_transition_expediente(
  p_from expediente_estado,
  p_to expediente_estado
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_from
    WHEN 'NUEVO' THEN p_to = ANY (ARRAY['NO_ASIGNADO', 'CANCELADO']::expediente_estado[])
    WHEN 'NO_ASIGNADO' THEN p_to = ANY (ARRAY['EN_PLANIFICACION', 'CANCELADO']::expediente_estado[])
    WHEN 'EN_PLANIFICACION' THEN p_to = ANY (ARRAY['EN_CURSO', 'PENDIENTE_CLIENTE', 'CANCELADO']::expediente_estado[])
    WHEN 'EN_CURSO' THEN p_to = ANY (ARRAY['FINALIZADO', 'PENDIENTE', 'PENDIENTE_MATERIAL', 'PENDIENTE_PERITO', 'PENDIENTE_CLIENTE', 'CANCELADO']::expediente_estado[])
    WHEN 'PENDIENTE' THEN p_to = ANY (ARRAY['EN_CURSO', 'CANCELADO']::expediente_estado[])
    WHEN 'PENDIENTE_MATERIAL' THEN p_to = ANY (ARRAY['EN_CURSO', 'CANCELADO']::expediente_estado[])
    WHEN 'PENDIENTE_PERITO' THEN p_to = ANY (ARRAY['EN_CURSO', 'CANCELADO']::expediente_estado[])
    WHEN 'PENDIENTE_CLIENTE' THEN p_to = ANY (ARRAY['EN_PLANIFICACION', 'EN_CURSO', 'CANCELADO']::expediente_estado[])
    WHEN 'FINALIZADO' THEN p_to = ANY (ARRAY['FACTURADO', 'EN_CURSO']::expediente_estado[])
    WHEN 'FACTURADO' THEN p_to = ANY (ARRAY['COBRADO']::expediente_estado[])
    WHEN 'COBRADO' THEN p_to = ANY (ARRAY['CERRADO']::expediente_estado[])
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION erp_register_sla_pause(
  p_expediente_id UUID,
  p_estado_pausa expediente_estado,
  p_motivo TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sla_pausas
  SET fin = NOW()
  WHERE expediente_id = p_expediente_id
    AND fin IS NULL;

  INSERT INTO sla_pausas (expediente_id, estado_pausa, inicio, fin, motivo)
  VALUES (p_expediente_id, p_estado_pausa, NOW(), NULL, p_motivo);
END;
$$;

CREATE OR REPLACE FUNCTION erp_close_sla_pause(p_expediente_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed INTEGER;
BEGIN
  UPDATE sla_pausas
  SET fin = NOW()
  WHERE expediente_id = p_expediente_id
    AND fin IS NULL;

  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END;
$$;

CREATE OR REPLACE FUNCTION erp_create_expediente(
  p_payload JSONB,
  p_actor_id UUID,
  p_ip INET DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB := COALESCE(p_payload, '{}'::JSONB);
  v_asegurado_payload JSONB := v_payload->'asegurado_nuevo';
  v_asegurado_id UUID;
  v_numero TEXT;
  v_fecha_encargo TIMESTAMPTZ := COALESCE((v_payload->>'fecha_encargo')::TIMESTAMPTZ, NOW());
  v_expediente expedientes%ROWTYPE;
BEGIN
  IF NULLIF(trim(v_payload->>'asegurado_id'), '') IS NOT NULL THEN
    v_asegurado_id := (v_payload->>'asegurado_id')::UUID;
  ELSIF jsonb_typeof(v_asegurado_payload) = 'object' THEN
    INSERT INTO asegurados (
      nombre,
      apellidos,
      telefono,
      telefono2,
      email,
      nif,
      direccion,
      codigo_postal,
      localidad,
      provincia
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
      'numero_expediente', v_expediente.numero_expediente,
      'estado', v_expediente.estado,
      'compania_id', v_expediente.compania_id,
      'empresa_facturadora_id', v_expediente.empresa_facturadora_id,
      'asegurado_id', v_expediente.asegurado_id,
      'tipo_siniestro', v_expediente.tipo_siniestro,
      'descripcion', v_expediente.descripcion,
      'direccion_siniestro', v_expediente.direccion_siniestro,
      'codigo_postal', v_expediente.codigo_postal,
      'localidad', v_expediente.localidad,
      'provincia', v_expediente.provincia,
      'numero_poliza', v_expediente.numero_poliza,
      'numero_siniestro_cia', v_expediente.numero_siniestro_cia,
      'prioridad', v_expediente.prioridad,
      'fecha_limite_sla', v_expediente.fecha_limite_sla,
      'origen', v_expediente.origen,
      'referencia_externa', v_expediente.referencia_externa
    ),
    p_ip
  );
  PERFORM erp_insert_evento_dominio(
    v_expediente.id,
    'expediente',
    'ExpedienteCreado',
    jsonb_build_object(
      'numero_expediente', v_expediente.numero_expediente,
      'tipo_siniestro', v_expediente.tipo_siniestro,
      'origen', v_expediente.origen,
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

CREATE OR REPLACE FUNCTION erp_create_cita(
  p_payload JSONB,
  p_actor_id UUID,
  p_ip INET DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB := COALESCE(p_payload, '{}'::JSONB);
  v_expediente RECORD;
  v_operario RECORD;
  v_cita citas%ROWTYPE;
  v_rows_updated INTEGER := 0;
BEGIN
  SELECT id, estado, operario_id
  INTO v_expediente
  FROM expedientes
  WHERE id = (v_payload->>'expediente_id')::UUID
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM erp_raise_business_error('NOT_FOUND', 'Expediente no encontrado');
  END IF;

  IF v_expediente.estado NOT IN ('EN_PLANIFICACION', 'EN_CURSO', 'PENDIENTE_CLIENTE') THEN
    PERFORM erp_raise_business_error('INVALID_STATE', format('No se puede crear cita en estado %s', v_expediente.estado));
  END IF;

  SELECT id
  INTO v_operario
  FROM operarios
  WHERE id = (v_payload->>'operario_id')::UUID
    AND activo = TRUE;

  IF NOT FOUND THEN
    PERFORM erp_raise_business_error('NOT_FOUND', 'Operario no encontrado o inactivo');
  END IF;

  IF (v_payload->>'franja_inicio')::TIME >= (v_payload->>'franja_fin')::TIME THEN
    PERFORM erp_raise_business_error('VALIDATION', 'La franja de inicio debe ser anterior a la de fin');
  END IF;

  INSERT INTO citas (
    expediente_id,
    operario_id,
    fecha,
    franja_inicio,
    franja_fin,
    notas
  )
  VALUES (
    (v_payload->>'expediente_id')::UUID,
    (v_payload->>'operario_id')::UUID,
    (v_payload->>'fecha')::DATE,
    (v_payload->>'franja_inicio')::TIME,
    (v_payload->>'franja_fin')::TIME,
    NULLIF(v_payload->>'notas', '')
  )
  RETURNING * INTO v_cita;

  UPDATE expedientes
  SET operario_id = (v_payload->>'operario_id')::UUID
  WHERE id = v_expediente.id
    AND operario_id IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  PERFORM erp_insert_auditoria(
    'citas',
    v_cita.id,
    'INSERT',
    p_actor_id,
    jsonb_build_object(
      'expediente_id', v_cita.expediente_id,
      'operario_id', v_cita.operario_id,
      'fecha', v_cita.fecha,
      'franja_inicio', v_cita.franja_inicio,
      'franja_fin', v_cita.franja_fin,
      'notas', v_cita.notas
    ),
    p_ip
  );

  IF v_rows_updated > 0 THEN
    PERFORM erp_insert_auditoria(
      'expedientes',
      v_expediente.id,
      'UPDATE',
      p_actor_id,
      jsonb_build_object(
        'operario_id', jsonb_build_object(
          'from', NULL,
          'to', (v_payload->>'operario_id')::UUID
        ),
        'origen', 'cita_agendada'
      ),
      p_ip
    );
  END IF;

  PERFORM erp_insert_evento_dominio(
    v_cita.expediente_id,
    'expediente',
    'CitaAgendada',
    jsonb_build_object(
      'cita_id', v_cita.id,
      'operario_id', v_cita.operario_id,
      'fecha', v_cita.fecha,
      'franja_inicio', v_cita.franja_inicio,
      'franja_fin', v_cita.franja_fin
    ),
    p_actor_id,
    p_correlation_id,
    NULL
  );

  RETURN to_jsonb(v_cita);
END;
$$;

CREATE OR REPLACE FUNCTION erp_transition_expediente(
  p_expediente_id UUID,
  p_estado_nuevo expediente_estado,
  p_actor_id UUID,
  p_motivo TEXT DEFAULT NULL,
  p_causa_pendiente causa_pendiente DEFAULT NULL,
  p_causa_pendiente_detalle TEXT DEFAULT NULL,
  p_ip INET DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expediente expedientes%ROWTYPE;
  v_estado_anterior expediente_estado;
  v_tiene_parte BOOLEAN;
  v_tiene_factura BOOLEAN;
  v_tiene_cobro BOOLEAN;
  v_event_type TEXT := 'ExpedienteActualizado';
BEGIN
  SELECT *
  INTO v_expediente
  FROM expedientes
  WHERE id = p_expediente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM erp_raise_business_error('NOT_FOUND', 'Expediente no encontrado');
  END IF;

  v_estado_anterior := v_expediente.estado;

  IF NOT erp_can_transition_expediente(v_estado_anterior, p_estado_nuevo) THEN
    PERFORM erp_raise_business_error(
      'INVALID_TRANSITION',
      format('Transicion no permitida: %s -> %s', v_estado_anterior, p_estado_nuevo)
    );
  END IF;

  IF p_estado_nuevo = 'FINALIZADO' THEN
    SELECT EXISTS (
      SELECT 1
      FROM partes_operario
      WHERE expediente_id = p_expediente_id
        AND validado = TRUE
    )
    INTO v_tiene_parte;

    IF NOT v_tiene_parte THEN
      PERFORM erp_raise_business_error('PRECONDITION_FAILED', 'No se puede finalizar sin parte validado');
    END IF;
    v_event_type := 'ExpedienteFinalizado';
  ELSIF p_estado_nuevo = 'FACTURADO' THEN
    SELECT EXISTS (
      SELECT 1
      FROM facturas
      WHERE expediente_id = p_expediente_id
        AND estado <> 'anulada'
    )
    INTO v_tiene_factura;

    IF NOT v_tiene_factura THEN
      PERFORM erp_raise_business_error('PRECONDITION_FAILED', 'No se puede marcar como facturado sin factura emitida');
    END IF;
  ELSIF p_estado_nuevo = 'COBRADO' THEN
    SELECT EXISTS (
      SELECT 1
      FROM pagos p
      JOIN facturas f ON f.id = p.factura_id
      WHERE f.expediente_id = p_expediente_id
    )
    INTO v_tiene_cobro;

    IF NOT v_tiene_cobro THEN
      PERFORM erp_raise_business_error('PRECONDITION_FAILED', 'No se puede marcar como cobrado sin pago registrado');
    END IF;
  END IF;

  UPDATE expedientes
  SET estado = p_estado_nuevo,
      causa_pendiente = CASE
        WHEN erp_is_pending_state(p_estado_nuevo) THEN p_causa_pendiente
        ELSE NULL
      END,
      causa_pendiente_detalle = CASE
        WHEN erp_is_pending_state(p_estado_nuevo) THEN NULLIF(p_causa_pendiente_detalle, '')
        ELSE NULL
      END
  WHERE id = p_expediente_id
  RETURNING * INTO v_expediente;

  IF erp_is_pending_state(p_estado_nuevo) AND NOT erp_is_pending_state(v_estado_anterior) THEN
    PERFORM erp_register_sla_pause(p_expediente_id, p_estado_nuevo, COALESCE(NULLIF(p_causa_pendiente_detalle, ''), NULLIF(p_motivo, '')));
  ELSIF NOT erp_is_pending_state(p_estado_nuevo) AND erp_is_pending_state(v_estado_anterior) THEN
    PERFORM erp_close_sla_pause(p_expediente_id);
  END IF;

  PERFORM erp_insert_historial_estado(
    p_expediente_id,
    v_estado_anterior,
    p_estado_nuevo,
    p_motivo,
    p_actor_id
  );

  PERFORM erp_insert_auditoria(
    'expedientes',
    p_expediente_id,
    'UPDATE',
    p_actor_id,
    jsonb_build_object(
      'estado', jsonb_build_object(
        'from', v_estado_anterior,
        'to', p_estado_nuevo
      ),
      'motivo', NULLIF(p_motivo, ''),
      'causa_pendiente', CASE
        WHEN erp_is_pending_state(p_estado_nuevo) THEN to_jsonb(p_causa_pendiente)
        ELSE 'null'::JSONB
      END,
      'causa_pendiente_detalle', CASE
        WHEN erp_is_pending_state(p_estado_nuevo) THEN to_jsonb(NULLIF(p_causa_pendiente_detalle, ''))
        ELSE 'null'::JSONB
      END
    ),
    p_ip
  );

  PERFORM erp_insert_evento_dominio(
    p_expediente_id,
    'expediente',
    v_event_type,
    jsonb_build_object(
      'estado_anterior', v_estado_anterior,
      'estado_nuevo', p_estado_nuevo,
      'motivo', NULLIF(p_motivo, ''),
      'causa_pendiente', p_causa_pendiente,
      'causa_pendiente_detalle', NULLIF(p_causa_pendiente_detalle, '')
    ),
    p_actor_id,
    p_correlation_id,
    NULL
  );

  RETURN jsonb_build_object('id', p_expediente_id, 'estado', p_estado_nuevo);
END;
$$;

REVOKE ALL ON TABLE expediente_counters FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION erp_raise_business_error(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_insert_auditoria(TEXT, UUID, auditoria_accion, UUID, JSONB, INET) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_insert_historial_estado(UUID, expediente_estado, expediente_estado, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_insert_evento_dominio(UUID, TEXT, TEXT, JSONB, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_next_expediente_numero(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_is_pending_state(expediente_estado) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_can_transition_expediente(expediente_estado, expediente_estado) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_register_sla_pause(UUID, expediente_estado, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_close_sla_pause(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_create_expediente(JSONB, UUID, INET, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_create_cita(JSONB, UUID, INET, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION erp_transition_expediente(UUID, expediente_estado, UUID, TEXT, causa_pendiente, TEXT, INET, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION erp_create_expediente(JSONB, UUID, INET, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION erp_create_cita(JSONB, UUID, INET, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION erp_transition_expediente(UUID, expediente_estado, UUID, TEXT, causa_pendiente, TEXT, INET, UUID) TO service_role;
