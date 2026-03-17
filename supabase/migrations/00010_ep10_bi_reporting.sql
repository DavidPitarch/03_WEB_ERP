-- ============================================================================
-- Migration 00010: EP-10 BI / Reporting + Autofacturas
-- Idempotent: uses IF NOT EXISTS, CREATE OR REPLACE VIEW, DO $$ blocks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role_name
  FROM (
    SELECT
      r.nombre AS role_name,
      CASE r.nombre
        WHEN 'admin' THEN 1
        WHEN 'supervisor' THEN 2
        WHEN 'direccion' THEN 3
        WHEN 'financiero' THEN 4
        WHEN 'tramitador' THEN 5
        WHEN 'perito' THEN 6
        WHEN 'operario' THEN 7
        WHEN 'proveedor' THEN 8
        WHEN 'cliente_final' THEN 9
        ELSE 99
      END AS role_priority
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
  ) ranked_roles
  ORDER BY role_priority
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- 1. TABLE: autofacturas
-- ============================================================================
CREATE TABLE IF NOT EXISTS autofacturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operario_id UUID NOT NULL REFERENCES operarios(id),
    periodo_desde DATE NOT NULL,
    periodo_hasta DATE NOT NULL,
    numero_autofactura TEXT UNIQUE,
    estado TEXT NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador','revisada','emitida','anulada')),
    base_imponible NUMERIC(12,2) DEFAULT 0,
    iva_porcentaje NUMERIC(5,2) DEFAULT 21,
    iva_importe NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    datos_fiscales JSONB,
    cuenta_bancaria TEXT,
    notas TEXT,
    emitida_por UUID,
    emitida_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. TABLE: lineas_autofactura
-- ============================================================================
CREATE TABLE IF NOT EXISTS lineas_autofactura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    autofactura_id UUID NOT NULL REFERENCES autofacturas(id) ON DELETE CASCADE,
    expediente_id UUID REFERENCES expedientes(id),
    parte_id UUID REFERENCES partes_operario(id),
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(10,2) DEFAULT 1,
    precio_unitario NUMERIC(12,2) NOT NULL,
    importe NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. EXTEND operarios TABLE
-- ============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operarios' AND column_name = 'es_subcontratado') THEN
        ALTER TABLE operarios ADD COLUMN es_subcontratado BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operarios' AND column_name = 'cif') THEN
        ALTER TABLE operarios ADD COLUMN cif TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operarios' AND column_name = 'datos_fiscales') THEN
        ALTER TABLE operarios ADD COLUMN datos_fiscales JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operarios' AND column_name = 'cuenta_bancaria') THEN
        ALTER TABLE operarios ADD COLUMN cuenta_bancaria TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operarios' AND column_name = 'prefijo_autofactura') THEN
        ALTER TABLE operarios ADD COLUMN prefijo_autofactura TEXT DEFAULT 'AF';
    END IF;
END $$;

-- ============================================================================
-- 4. ANALYTICS VIEWS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 4.1 v_dashboard_kpis — single-row summary for main dashboard
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
    -- Expedientes
    (SELECT COUNT(*) FROM expedientes)::BIGINT
        AS total_expedientes,
    (SELECT COUNT(*) FROM expedientes WHERE estado IN ('EN_CURSO','EN_PLANIFICACION'))::BIGINT
        AS exp_en_curso,
    (SELECT COUNT(*) FROM expedientes WHERE estado::TEXT LIKE 'PENDIENTE%')::BIGINT
        AS exp_pendientes,
    (SELECT COUNT(*) FROM expedientes e
     WHERE e.estado = 'FINALIZADO'
       AND NOT EXISTS (
           SELECT 1 FROM facturas f
           WHERE f.expediente_id = e.id AND f.estado != 'anulada'
       ))::BIGINT
        AS exp_finalizados_sin_factura,
    (SELECT COUNT(*) FROM expedientes e
     WHERE e.estado::TEXT NOT IN ('NUEVO','CANCELADO','CERRADO')
       AND NOT EXISTS (
           SELECT 1 FROM presupuestos p WHERE p.expediente_id = e.id
       ))::BIGINT
        AS exp_sin_presupuesto,
    -- Facturación
    (SELECT COUNT(*) FROM facturas WHERE estado != 'anulada')::BIGINT
        AS total_facturas_emitidas,
    COALESCE((SELECT SUM(total) FROM facturas WHERE estado NOT IN ('anulada','borrador')), 0)
        AS total_facturado,
    COALESCE((SELECT SUM(importe) FROM pagos), 0)
        AS total_cobrado,
    COALESCE((SELECT SUM(total) FROM facturas WHERE estado NOT IN ('anulada','borrador')), 0)
      - COALESCE((SELECT SUM(importe) FROM pagos), 0)
        AS total_pendiente_cobro,
    (SELECT COUNT(*) FROM facturas WHERE estado_cobro = 'vencida')::BIGINT
        AS facturas_vencidas,
    -- Logística
    (SELECT COUNT(*) FROM pedidos_material WHERE estado = 'caducado')::BIGINT
        AS pedidos_caducados,
    (SELECT COUNT(*) FROM v_informes_caducados)::BIGINT
        AS informes_caducados,
    -- SLA placeholder
    0::NUMERIC AS sla_promedio_pct;

-- --------------------------------------------------------------------------
-- 4.2 v_expedientes_rentabilidad — per-expediente profitability
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_expedientes_rentabilidad AS
SELECT
    e.id                    AS expediente_id,
    e.numero_expediente,
    e.estado,
    e.compania_id,
    e.tipo_siniestro,
    COALESCE(pres.ingreso_estimado, 0)  AS ingreso_estimado,
    COALESCE(pres.coste_estimado, 0)    AS coste_estimado,
    COALESCE(pres.ingreso_estimado, 0)
      - COALESCE(pres.coste_estimado, 0) AS margen_previsto,
    COALESCE(fac.total_facturado, 0)    AS total_facturado,
    COALESCE(cobr.total_cobrado, 0)     AS total_cobrado,
    COALESCE(cobr.total_cobrado, 0)
      - COALESCE(pres.coste_estimado, 0) AS margen_real,
    (COALESCE(cobr.total_cobrado, 0) - COALESCE(pres.coste_estimado, 0))
      - (COALESCE(pres.ingreso_estimado, 0) - COALESCE(pres.coste_estimado, 0))
        AS desviacion,
    (COALESCE(pres.ingreso_estimado, 0) - COALESCE(pres.coste_estimado, 0) < 0)
      OR (COALESCE(cobr.total_cobrado, 0) - COALESCE(pres.coste_estimado, 0) < 0)
        AS es_deficitario
FROM expedientes e
LEFT JOIN LATERAL (
    SELECT
        SUM(lp.importe) AS ingreso_estimado,
        SUM(lp.precio_operario * lp.cantidad) AS coste_estimado
    FROM presupuestos p
    JOIN lineas_presupuesto lp ON lp.presupuesto_id = p.id
    WHERE p.expediente_id = e.id
) pres ON true
LEFT JOIN LATERAL (
    SELECT SUM(f.total) AS total_facturado
    FROM facturas f
    WHERE f.expediente_id = e.id AND f.estado != 'anulada'
) fac ON true
LEFT JOIN LATERAL (
    SELECT SUM(pg.importe) AS total_cobrado
    FROM facturas f
    JOIN pagos pg ON pg.factura_id = f.id
    WHERE f.expediente_id = e.id
) cobr ON true;

-- --------------------------------------------------------------------------
-- 4.3 v_rentabilidad_por_compania
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_rentabilidad_por_compania AS
SELECT
    c.id                    AS compania_id,
    c.nombre                AS compania_nombre,
    COUNT(DISTINCT r.expediente_id)::BIGINT AS num_expedientes,
    COALESCE(SUM(r.ingreso_estimado), 0) AS ingreso_total,
    COALESCE(SUM(r.coste_estimado), 0)   AS coste_total,
    COALESCE(SUM(r.margen_previsto), 0)  AS margen_total,
    COALESCE(SUM(r.total_facturado), 0)  AS facturado_total,
    COALESCE(SUM(r.total_cobrado), 0)    AS cobrado_total,
    CASE
        WHEN SUM(r.ingreso_estimado) > 0
        THEN ROUND(SUM(r.margen_previsto) / SUM(r.ingreso_estimado) * 100, 2)
        ELSE 0
    END AS margen_medio_pct,
    COUNT(*) FILTER (WHERE r.es_deficitario)::BIGINT AS expedientes_deficitarios
FROM companias c
LEFT JOIN v_expedientes_rentabilidad r ON r.compania_id = c.id
GROUP BY c.id, c.nombre;

-- --------------------------------------------------------------------------
-- 4.4 v_rentabilidad_por_operario
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_rentabilidad_por_operario AS
SELECT
    o.id                    AS operario_id,
    o.nombre || ' ' || o.apellidos AS operario_nombre,
    COUNT(DISTINCT e.id)::BIGINT   AS num_expedientes,
    COUNT(DISTINCT po.id)::BIGINT  AS num_partes,
    COALESCE(SUM(lp.precio_operario * lp.cantidad), 0) AS coste_total,
    AVG(
        EXTRACT(EPOCH FROM (h.finalizado_at - e.created_at)) / 86400.0
    )::NUMERIC(10,2) AS tiempo_medio_resolucion_dias
FROM operarios o
LEFT JOIN expedientes e ON e.operario_id = o.id
LEFT JOIN partes_operario po ON po.operario_id = o.id
LEFT JOIN presupuestos p ON p.expediente_id = e.id
LEFT JOIN lineas_presupuesto lp ON lp.presupuesto_id = p.id
LEFT JOIN LATERAL (
    SELECT MIN(he.created_at) AS finalizado_at
    FROM historial_estados he
    WHERE he.expediente_id = e.id
      AND he.estado_nuevo::TEXT = 'FINALIZADO'
) h ON true
GROUP BY o.id, o.nombre, o.apellidos;

-- --------------------------------------------------------------------------
-- 4.5 v_productividad_operarios
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_productividad_operarios AS
SELECT
    o.id                    AS operario_id,
    o.nombre,
    o.apellidos,
    COUNT(DISTINCT ci.id)::BIGINT  AS total_citas,
    COUNT(DISTINCT ci.id) FILTER (WHERE ci.estado = 'realizada')::BIGINT
        AS citas_realizadas,
    COUNT(DISTINCT po.id)::BIGINT  AS partes_enviados,
    COUNT(DISTINCT po.id) FILTER (WHERE po.validado = true)::BIGINT
        AS partes_validados,
    CASE
        WHEN COUNT(DISTINCT po.id) > 0
        THEN ROUND(
            COUNT(DISTINCT po.id) FILTER (WHERE po.validado = true)::NUMERIC
            / COUNT(DISTINCT po.id) * 100, 2)
        ELSE 0
    END AS tasa_validacion,
    (SELECT COUNT(*)
     FROM v_informes_caducados ic
     WHERE ic.operario_id = o.id
    )::BIGINT AS informes_caducados
FROM operarios o
LEFT JOIN citas ci ON ci.operario_id = o.id
LEFT JOIN partes_operario po ON po.operario_id = o.id
GROUP BY o.id, o.nombre, o.apellidos;

-- --------------------------------------------------------------------------
-- 4.6 v_facturacion_detallada
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_facturacion_detallada AS
SELECT
    f.*,
    c.nombre                AS compania_nombre,
    ef.nombre               AS empresa_nombre,
    e.numero_expediente     AS expediente_numero,
    f.fecha_vencimiento - CURRENT_DATE AS dias_hasta_vencimiento,
    CASE
        WHEN f.fecha_vencimiento < CURRENT_DATE AND f.estado_cobro NOT IN ('cobrada','incobrable')
        THEN CURRENT_DATE - f.fecha_vencimiento
        ELSE NULL
    END AS dias_vencida,
    COALESCE(pag.total_cobrado_factura, 0) AS total_cobrado_factura,
    f.total - COALESCE(pag.total_cobrado_factura, 0) AS pendiente_cobro
FROM facturas f
JOIN expedientes e ON e.id = f.expediente_id
LEFT JOIN companias c ON c.id = f.compania_id
LEFT JOIN empresas_facturadoras ef ON ef.id = f.empresa_facturadora_id
LEFT JOIN LATERAL (
    SELECT SUM(pg.importe) AS total_cobrado_factura
    FROM pagos pg
    WHERE pg.factura_id = f.id
) pag ON true;

-- --------------------------------------------------------------------------
-- 4.7 v_operarios_liquidables — subcontracted operators ready for autofactura
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_operarios_liquidables AS
SELECT
    o.id                    AS operario_id,
    o.nombre,
    o.apellidos,
    o.cif,
    o.cuenta_bancaria,
    o.datos_fiscales,
    COUNT(DISTINCT po.id)::BIGINT AS num_partes_periodo,
    COALESCE(SUM(lp.precio_operario * lp.cantidad), 0) AS importe_estimado
FROM operarios o
JOIN partes_operario po ON po.operario_id = o.id AND po.validado = true
JOIN expedientes e ON e.id = po.expediente_id
JOIN presupuestos pr ON pr.expediente_id = e.id
JOIN lineas_presupuesto lp ON lp.presupuesto_id = pr.id
WHERE o.es_subcontratado = true
  AND NOT EXISTS (
      SELECT 1 FROM lineas_autofactura la
      WHERE la.parte_id = po.id
  )
GROUP BY o.id, o.nombre, o.apellidos, o.cif, o.cuenta_bancaria, o.datos_fiscales;

-- ============================================================================
-- 5. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_autofacturas_operario     ON autofacturas(operario_id);
CREATE INDEX IF NOT EXISTS idx_autofacturas_estado       ON autofacturas(estado);
CREATE INDEX IF NOT EXISTS idx_autofacturas_periodo      ON autofacturas(periodo_desde, periodo_hasta);
CREATE INDEX IF NOT EXISTS idx_lineas_autofactura_af     ON lineas_autofactura(autofactura_id);
CREATE INDEX IF NOT EXISTS idx_lineas_autofactura_exp    ON lineas_autofactura(expediente_id);

-- ============================================================================
-- 6. RLS
-- ============================================================================
ALTER TABLE autofacturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_autofactura ENABLE ROW LEVEL SECURITY;

-- Autofacturas policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'autofacturas_select_staff' AND tablename = 'autofacturas') THEN
        CREATE POLICY autofacturas_select_staff ON autofacturas
            FOR SELECT USING (
                public.get_my_role() IN ('admin','supervisor','financiero')
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'autofacturas_insert_finance' AND tablename = 'autofacturas') THEN
        CREATE POLICY autofacturas_insert_finance ON autofacturas
            FOR INSERT WITH CHECK (
                public.get_my_role() IN ('admin','financiero')
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'autofacturas_update_finance' AND tablename = 'autofacturas') THEN
        CREATE POLICY autofacturas_update_finance ON autofacturas
            FOR UPDATE USING (
                public.get_my_role() IN ('admin','financiero')
            );
    END IF;
END $$;

-- Lineas autofactura policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'lineas_af_select_staff' AND tablename = 'lineas_autofactura') THEN
        CREATE POLICY lineas_af_select_staff ON lineas_autofactura
            FOR SELECT USING (
                public.get_my_role() IN ('admin','supervisor','financiero')
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'lineas_af_insert_finance' AND tablename = 'lineas_autofactura') THEN
        CREATE POLICY lineas_af_insert_finance ON lineas_autofactura
            FOR INSERT WITH CHECK (
                public.get_my_role() IN ('admin','financiero')
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'lineas_af_update_finance' AND tablename = 'lineas_autofactura') THEN
        CREATE POLICY lineas_af_update_finance ON lineas_autofactura
            FOR UPDATE USING (
                public.get_my_role() IN ('admin','financiero')
            );
    END IF;
END $$;

-- ============================================================================
-- 7. REALTIME
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE autofacturas;
