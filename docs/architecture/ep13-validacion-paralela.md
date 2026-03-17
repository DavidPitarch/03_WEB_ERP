# EP13 — Validacion Paralela PWGS vs ERP

> Verificacion de integridad post-migracion
> Version: 1.0 | Fecha: 2026-03-15

---

## 1. Objetivo

Ejecutar en paralelo sobre PWGS (origen) y ERP (destino) un conjunto de queries que verifiquen:

1. **Conteo**: misma cantidad de registros por entidad
2. **Checksums**: mismas sumas monetarias
3. **Integridad referencial**: sin huerfanos
4. **Reglas de negocio**: sin datos en estados imposibles
5. **Spot-check**: comparacion aleatoria del 5% de registros

Los resultados se consolidan en una tabla `validation_results` para generar un informe automatico GO/NO-GO.

---

## 2. Infraestructura de Validacion

```sql
CREATE TABLE IF NOT EXISTS validation_results (
    id              SERIAL PRIMARY KEY,
    run_id          UUID NOT NULL DEFAULT gen_random_uuid(),
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    categoria       TEXT NOT NULL,      -- 'conteo', 'checksum', 'integridad', 'negocio', 'spotcheck'
    entidad         TEXT NOT NULL,
    check_name      TEXT NOT NULL,
    valor_pwgs      TEXT,
    valor_erp       TEXT,
    coincide        BOOLEAN,
    diferencia      TEXT,
    severidad       TEXT NOT NULL DEFAULT 'ERROR',  -- 'ERROR', 'WARNING', 'INFO'
    detalle         JSONB
);

CREATE INDEX idx_validation_run ON validation_results(run_id);
CREATE INDEX idx_validation_coincide ON validation_results(coincide) WHERE NOT coincide;
```

---

## 3. Verificacion de Conteo (Count Checks)

Comparar el total de registros por entidad entre PWGS y ERP.

### 3.1 Queries sobre PWGS (ejecutar contra MySQL/origen)

```sql
-- Ejecutar en PWGS y anotar resultados
SELECT 'siniestros' AS entidad, COUNT(*) AS total FROM siniestros;
SELECT 'asegurados' AS entidad, COUNT(*) AS total FROM asegurados;
SELECT 'companias' AS entidad, COUNT(*) AS total FROM companias;
SELECT 'operarios' AS entidad, COUNT(*) AS total FROM operarios;
SELECT 'facturas' AS entidad, COUNT(*) AS total FROM facturas;
SELECT 'lineas_factura' AS entidad, COUNT(*) AS total FROM lineas_factura;
SELECT 'partes' AS entidad, COUNT(*) AS total FROM partes_trabajo;
SELECT 'proveedores' AS entidad, COUNT(*) AS total FROM proveedores;
SELECT 'pedidos' AS entidad, COUNT(*) AS total FROM pedidos;
SELECT 'lineas_pedido' AS entidad, COUNT(*) AS total FROM lineas_pedido;
```

### 3.2 Queries sobre ERP (ejecutar contra PostgreSQL/Supabase)

```sql
SELECT 'expedientes' AS entidad, COUNT(*) AS total FROM expedientes WHERE pwgs_id IS NOT NULL;
SELECT 'asegurados' AS entidad, COUNT(*) AS total FROM asegurados WHERE pwgs_id IS NOT NULL;
SELECT 'companias_aseguradoras' AS entidad, COUNT(*) AS total FROM companias_aseguradoras WHERE pwgs_id IS NOT NULL;
SELECT 'operarios' AS entidad, COUNT(*) AS total FROM operarios WHERE pwgs_id IS NOT NULL;
SELECT 'facturas' AS entidad, COUNT(*) AS total FROM facturas WHERE pwgs_id IS NOT NULL;
SELECT 'lineas_factura' AS entidad, COUNT(*) AS total
    FROM lineas_factura lf
    JOIN facturas f ON f.id = lf.factura_id
    WHERE f.pwgs_id IS NOT NULL;
SELECT 'partes_operario' AS entidad, COUNT(*) AS total FROM partes_operario WHERE pwgs_id IS NOT NULL;
SELECT 'proveedores' AS entidad, COUNT(*) AS total FROM proveedores WHERE pwgs_id IS NOT NULL;
SELECT 'pedidos_material' AS entidad, COUNT(*) AS total FROM pedidos_material WHERE pwgs_id IS NOT NULL;
SELECT 'lineas_pedido' AS entidad, COUNT(*) AS total
    FROM lineas_pedido lp
    JOIN pedidos_material pm ON pm.id = lp.pedido_material_id
    WHERE pm.pwgs_id IS NOT NULL;
```

### 3.3 Registro automatizado de conteo

```sql
-- Insertar comparacion (ejecutar en ERP tras obtener datos de ambos lados)
INSERT INTO validation_results (categoria, entidad, check_name, valor_pwgs, valor_erp, coincide, diferencia, severidad)
VALUES
    ('conteo', 'expedientes',           'total_registros', :pwgs_siniestros,     :erp_expedientes,     :pwgs_siniestros = :erp_expedientes,     (:erp_expedientes::INT - :pwgs_siniestros::INT)::TEXT, 'ERROR'),
    ('conteo', 'asegurados',            'total_registros', :pwgs_asegurados,     :erp_asegurados,      :pwgs_asegurados = :erp_asegurados,      (:erp_asegurados::INT - :pwgs_asegurados::INT)::TEXT,   'ERROR'),
    ('conteo', 'companias_aseguradoras','total_registros', :pwgs_companias,      :erp_companias,       :pwgs_companias = :erp_companias,        (:erp_companias::INT - :pwgs_companias::INT)::TEXT,     'ERROR'),
    ('conteo', 'operarios',             'total_registros', :pwgs_operarios,      :erp_operarios,       :pwgs_operarios = :erp_operarios,        (:erp_operarios::INT - :pwgs_operarios::INT)::TEXT,     'ERROR'),
    ('conteo', 'facturas',              'total_registros', :pwgs_facturas,       :erp_facturas,        :pwgs_facturas = :erp_facturas,          (:erp_facturas::INT - :pwgs_facturas::INT)::TEXT,       'ERROR'),
    ('conteo', 'lineas_factura',        'total_registros', :pwgs_lineas_fact,    :erp_lineas_fact,     :pwgs_lineas_fact = :erp_lineas_fact,    (:erp_lineas_fact::INT - :pwgs_lineas_fact::INT)::TEXT, 'WARNING'),
    ('conteo', 'partes_operario',       'total_registros', :pwgs_partes,         :erp_partes,          :pwgs_partes = :erp_partes,              (:erp_partes::INT - :pwgs_partes::INT)::TEXT,           'ERROR'),
    ('conteo', 'proveedores',           'total_registros', :pwgs_proveedores,    :erp_proveedores,     :pwgs_proveedores = :erp_proveedores,    (:erp_proveedores::INT - :pwgs_proveedores::INT)::TEXT, 'ERROR'),
    ('conteo', 'pedidos_material',      'total_registros', :pwgs_pedidos,        :erp_pedidos,         :pwgs_pedidos = :erp_pedidos,            (:erp_pedidos::INT - :pwgs_pedidos::INT)::TEXT,         'ERROR'),
    ('conteo', 'lineas_pedido',         'total_registros', :pwgs_lineas_ped,     :erp_lineas_ped,      :pwgs_lineas_ped = :erp_lineas_ped,      (:erp_lineas_ped::INT - :pwgs_lineas_ped::INT)::TEXT,   'WARNING');
```

### 3.4 Tolerancia

- Diferencia 0: OK
- Diferencia negativa (ERP < PWGS): indica registros perdidos. Consultar `migration_errors` para detalles.
- Diferencia positiva inesperada: posible duplicacion.
- Tolerancia aceptable: hasta un 0.1% de diferencia por deduplicacion legitima (marcar como WARNING, no ERROR).

---

## 4. Verificacion de Checksums Monetarios

### 4.1 PWGS (origen)

```sql
-- Facturas
SELECT
    COUNT(*) AS num_facturas,
    ROUND(SUM(total), 2) AS sum_total,
    ROUND(SUM(base_imponible), 2) AS sum_base,
    ROUND(SUM(iva_importe), 2) AS sum_iva
FROM facturas;

-- Pagos
SELECT
    COUNT(*) AS num_pagos,
    ROUND(SUM(importe), 2) AS sum_importe
FROM pagos;

-- Presupuestos
SELECT
    COUNT(*) AS num_presupuestos,
    ROUND(SUM(importe_total), 2) AS sum_importe_total
FROM presupuestos;

-- Pedidos
SELECT
    COUNT(*) AS num_pedidos,
    ROUND(SUM(importe_total), 2) AS sum_importe_total
FROM pedidos;

-- Partes (importe)
SELECT
    COUNT(*) AS num_partes,
    ROUND(SUM(importe), 2) AS sum_importe
FROM partes_trabajo;
```

### 4.2 ERP (destino)

```sql
-- Facturas
SELECT
    COUNT(*) AS num_facturas,
    ROUND(SUM(total)::NUMERIC, 2) AS sum_total,
    ROUND(SUM(base_imponible)::NUMERIC, 2) AS sum_base,
    ROUND(SUM(iva_importe)::NUMERIC, 2) AS sum_iva
FROM facturas WHERE pwgs_id IS NOT NULL;

-- Pagos
SELECT
    COUNT(*) AS num_pagos,
    ROUND(SUM(importe)::NUMERIC, 2) AS sum_importe
FROM pagos WHERE pwgs_id IS NOT NULL;

-- Presupuestos
SELECT
    COUNT(*) AS num_presupuestos,
    ROUND(SUM(importe_total)::NUMERIC, 2) AS sum_importe_total
FROM presupuestos WHERE pwgs_id IS NOT NULL;

-- Pedidos
SELECT
    COUNT(*) AS num_pedidos,
    ROUND(SUM(importe_total)::NUMERIC, 2) AS sum_importe_total
FROM pedidos_material WHERE pwgs_id IS NOT NULL;

-- Partes
SELECT
    COUNT(*) AS num_partes,
    ROUND(SUM(importe)::NUMERIC, 2) AS sum_importe
FROM partes_operario WHERE pwgs_id IS NOT NULL;
```

### 4.3 Registro de checksums

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_pwgs, valor_erp, coincide, diferencia, severidad)
VALUES
    ('checksum', 'facturas',        'sum_total',          :pwgs_fact_total,   :erp_fact_total,   :pwgs_fact_total = :erp_fact_total,     ((:erp_fact_total::NUMERIC) - (:pwgs_fact_total::NUMERIC))::TEXT, 'ERROR'),
    ('checksum', 'facturas',        'sum_base_imponible', :pwgs_fact_base,    :erp_fact_base,    :pwgs_fact_base = :erp_fact_base,       ((:erp_fact_base::NUMERIC) - (:pwgs_fact_base::NUMERIC))::TEXT,   'ERROR'),
    ('checksum', 'facturas',        'sum_iva_importe',    :pwgs_fact_iva,     :erp_fact_iva,     :pwgs_fact_iva = :erp_fact_iva,         ((:erp_fact_iva::NUMERIC) - (:pwgs_fact_iva::NUMERIC))::TEXT,     'WARNING'),
    ('checksum', 'pagos',           'sum_importe',        :pwgs_pagos_imp,    :erp_pagos_imp,    :pwgs_pagos_imp = :erp_pagos_imp,       ((:erp_pagos_imp::NUMERIC) - (:pwgs_pagos_imp::NUMERIC))::TEXT,   'ERROR'),
    ('checksum', 'presupuestos',    'sum_importe_total',  :pwgs_pres_total,   :erp_pres_total,   :pwgs_pres_total = :erp_pres_total,     ((:erp_pres_total::NUMERIC) - (:pwgs_pres_total::NUMERIC))::TEXT, 'ERROR'),
    ('checksum', 'pedidos_material','sum_importe_total',  :pwgs_ped_total,    :erp_ped_total,    :pwgs_ped_total = :erp_ped_total,       ((:erp_ped_total::NUMERIC) - (:pwgs_ped_total::NUMERIC))::TEXT,   'WARNING'),
    ('checksum', 'partes_operario', 'sum_importe',        :pwgs_partes_imp,   :erp_partes_imp,   :pwgs_partes_imp = :erp_partes_imp,     ((:erp_partes_imp::NUMERIC) - (:pwgs_partes_imp::NUMERIC))::TEXT, 'WARNING');
```

### 4.4 Tolerancia monetaria

- Diferencia absoluta < 0.01 EUR: OK (redondeo)
- Diferencia < 1.00 EUR: WARNING
- Diferencia >= 1.00 EUR: ERROR, investigar

---

## 5. Integridad Referencial

### 5.1 Expedientes huerfanos (sin asegurado valido)

```sql
-- ERP: expedientes que deberian tener asegurado pero no lo tienen
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'integridad', 'expedientes', 'orphan_asegurado',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING',
    jsonb_agg(jsonb_build_object('expediente_id', e.id, 'pwgs_id', e.pwgs_id))
FROM expedientes e
WHERE e.pwgs_id IS NOT NULL
  AND e.asegurado_id IS NULL;
```

### 5.2 Expedientes sin compania aseguradora

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'integridad', 'expedientes', 'orphan_compania',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING',
    jsonb_agg(jsonb_build_object('expediente_id', e.id, 'pwgs_id', e.pwgs_id))
FROM expedientes e
WHERE e.pwgs_id IS NOT NULL
  AND e.compania_aseguradora_id IS NULL;
```

### 5.3 Facturas sin expediente

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'integridad', 'facturas', 'orphan_expediente',
    COUNT(*)::TEXT, COUNT(*) = 0, 'ERROR',
    jsonb_agg(jsonb_build_object('factura_id', f.id, 'pwgs_id', f.pwgs_id))
FROM facturas f
WHERE f.pwgs_id IS NOT NULL
  AND f.expediente_id IS NULL;
```

### 5.4 Facturas sin lineas

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'integridad', 'facturas', 'sin_lineas',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING',
    jsonb_agg(jsonb_build_object('factura_id', f.id, 'numero', f.numero_factura))
FROM facturas f
LEFT JOIN lineas_factura lf ON lf.factura_id = f.id
WHERE f.pwgs_id IS NOT NULL
  AND lf.id IS NULL;
```

### 5.5 Partes sin expediente

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'integridad', 'partes_operario', 'orphan_expediente',
    COUNT(*)::TEXT, COUNT(*) = 0, 'ERROR',
    jsonb_agg(jsonb_build_object('parte_id', p.id, 'pwgs_id', p.pwgs_id))
FROM partes_operario p
WHERE p.pwgs_id IS NOT NULL
  AND p.expediente_id IS NULL;
```

### 5.6 Partes sin operario

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'integridad', 'partes_operario', 'orphan_operario',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING',
    jsonb_agg(jsonb_build_object('parte_id', p.id, 'pwgs_id', p.pwgs_id))
FROM partes_operario p
WHERE p.pwgs_id IS NOT NULL
  AND p.operario_id IS NULL;
```

### 5.7 Pedidos sin expediente

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'integridad', 'pedidos_material', 'orphan_expediente',
    COUNT(*)::TEXT, COUNT(*) = 0, 'ERROR',
    jsonb_agg(jsonb_build_object('pedido_id', pm.id, 'pwgs_id', pm.pwgs_id))
FROM pedidos_material pm
WHERE pm.pwgs_id IS NOT NULL
  AND pm.expediente_id IS NULL;
```

### 5.8 Pedidos sin proveedor

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'integridad', 'pedidos_material', 'orphan_proveedor',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING',
    jsonb_agg(jsonb_build_object('pedido_id', pm.id, 'pwgs_id', pm.pwgs_id))
FROM pedidos_material pm
WHERE pm.pwgs_id IS NOT NULL
  AND pm.proveedor_id IS NULL;
```

### 5.9 Pedidos sin lineas

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'integridad', 'pedidos_material', 'sin_lineas',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING',
    jsonb_agg(jsonb_build_object('pedido_id', pm.id, 'numero', pm.numero_pedido))
FROM pedidos_material pm
LEFT JOIN lineas_pedido lp ON lp.pedido_material_id = pm.id
WHERE pm.pwgs_id IS NOT NULL
  AND lp.id IS NULL;
```

### 5.10 Lineas de factura huerfanas

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad)
SELECT
    'integridad', 'lineas_factura', 'orphan_factura',
    COUNT(*)::TEXT, COUNT(*) = 0, 'ERROR'
FROM lineas_factura lf
LEFT JOIN facturas f ON f.id = lf.factura_id
WHERE f.id IS NULL;
```

---

## 6. Validacion de Reglas de Negocio

### 6.1 Facturas en estado imposible

```sql
-- Factura pagada con total = 0 o NULL
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad)
SELECT
    'negocio', 'facturas', 'pagada_sin_total',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING'
FROM facturas
WHERE pwgs_id IS NOT NULL
  AND estado = 'pagada'
  AND (total IS NULL OR total = 0);

-- Factura con total negativo (sin ser rectificativa)
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad)
SELECT
    'negocio', 'facturas', 'total_negativo_no_rectificativa',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING'
FROM facturas
WHERE pwgs_id IS NOT NULL
  AND total < 0
  AND estado NOT IN ('rectificativa', 'anulada');

-- Factura emitida sin fecha de emision
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad)
SELECT
    'negocio', 'facturas', 'emitida_sin_fecha',
    COUNT(*)::TEXT, COUNT(*) = 0, 'ERROR'
FROM facturas
WHERE pwgs_id IS NOT NULL
  AND estado IN ('emitida', 'enviada', 'pagada')
  AND fecha_emision IS NULL;

-- Factura con base_imponible + iva - irpf != total (tolerancia 0.02)
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'negocio', 'facturas', 'calculo_total_incorrecto',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING',
    jsonb_agg(jsonb_build_object(
        'id', id, 'base', base_imponible, 'iva', iva_importe,
        'irpf', irpf_importe, 'total', total,
        'calculado', base_imponible + COALESCE(iva_importe,0) - COALESCE(irpf_importe,0)
    ))
FROM facturas
WHERE pwgs_id IS NOT NULL
  AND ABS(total - (base_imponible + COALESCE(iva_importe,0) - COALESCE(irpf_importe,0))) > 0.02;
```

### 6.2 Pedidos sin lineas

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad)
SELECT
    'negocio', 'pedidos_material', 'pedido_sin_lineas',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING'
FROM pedidos_material pm
LEFT JOIN lineas_pedido lp ON lp.pedido_material_id = pm.id
WHERE pm.pwgs_id IS NOT NULL
  AND lp.id IS NULL
  AND pm.estado NOT IN ('anulado', 'borrador');
```

### 6.3 Expedientes cerrados con facturas pendientes

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad, detalle)
SELECT
    'negocio', 'expedientes', 'cerrado_con_facturas_pendientes',
    COUNT(DISTINCT e.id)::TEXT, COUNT(DISTINCT e.id) = 0, 'WARNING',
    jsonb_agg(DISTINCT jsonb_build_object('expediente', e.numero_expediente, 'factura', f.numero_factura))
FROM expedientes e
JOIN facturas f ON f.expediente_id = e.id
WHERE e.pwgs_id IS NOT NULL
  AND e.estado = 'cerrado'
  AND f.estado IN ('borrador', 'pendiente');
```

### 6.4 Partes con horas negativas o > 24

```sql
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad)
SELECT
    'negocio', 'partes_operario', 'horas_invalidas',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING'
FROM partes_operario
WHERE pwgs_id IS NOT NULL
  AND (horas_trabajadas < 0 OR horas_trabajadas > 24);
```

### 6.5 Fechas incoherentes

```sql
-- Expedientes con fecha_cierre < fecha_apertura
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad)
SELECT
    'negocio', 'expedientes', 'fecha_cierre_antes_apertura',
    COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING'
FROM expedientes
WHERE pwgs_id IS NOT NULL
  AND fecha_cierre IS NOT NULL
  AND fecha_cierre < fecha_apertura;

-- Facturas con vencimiento < emision
INSERT INTO validation_results (categoria, entidad, check_name, valor_erp, coincide, severidad)
SELECT
    'negocio', 'facturas', 'vencimiento_antes_emision',
    COUNT(*)::TEXT, COUNT(*) = 0, 'INFO'
FROM facturas
WHERE pwgs_id IS NOT NULL
  AND fecha_vencimiento IS NOT NULL
  AND fecha_emision IS NOT NULL
  AND fecha_vencimiento < fecha_emision;
```

---

## 7. Spot-Check: Comparacion Aleatoria del 5%

### 7.1 Seleccion de muestra

```sql
-- Crear tabla temporal con IDs a verificar
CREATE TEMPORARY TABLE spot_check_ids AS
SELECT pwgs_id, 'expedientes' AS entidad
FROM expedientes
WHERE pwgs_id IS NOT NULL
ORDER BY random()
LIMIT (SELECT CEIL(COUNT(*) * 0.05) FROM expedientes WHERE pwgs_id IS NOT NULL)

UNION ALL

SELECT pwgs_id, 'facturas'
FROM facturas
WHERE pwgs_id IS NOT NULL
ORDER BY random()
LIMIT (SELECT CEIL(COUNT(*) * 0.05) FROM facturas WHERE pwgs_id IS NOT NULL)

UNION ALL

SELECT pwgs_id, 'asegurados'
FROM asegurados
WHERE pwgs_id IS NOT NULL
ORDER BY random()
LIMIT (SELECT CEIL(COUNT(*) * 0.05) FROM asegurados WHERE pwgs_id IS NOT NULL)

UNION ALL

SELECT pwgs_id, 'partes_operario'
FROM partes_operario
WHERE pwgs_id IS NOT NULL
ORDER BY random()
LIMIT (SELECT CEIL(COUNT(*) * 0.05) FROM partes_operario WHERE pwgs_id IS NOT NULL);
```

### 7.2 Query de comparacion campo a campo (expedientes)

```sql
-- Exportar de PWGS los registros seleccionados
-- SELECT * FROM siniestros WHERE id IN (:ids_expedientes);

-- En ERP, comparar campos clave
SELECT
    e.pwgs_id,
    e.numero_expediente,
    e.fecha_apertura,
    e.estado,
    e.descripcion,
    a.nombre AS asegurado_nombre,
    ca.nombre AS compania_nombre
FROM expedientes e
LEFT JOIN asegurados a ON a.id = e.asegurado_id
LEFT JOIN companias_aseguradoras ca ON ca.id = e.compania_aseguradora_id
WHERE e.pwgs_id IN (SELECT pwgs_id FROM spot_check_ids WHERE entidad = 'expedientes')
ORDER BY e.pwgs_id;
```

### 7.3 Query de comparacion campo a campo (facturas)

```sql
SELECT
    f.pwgs_id,
    f.numero_factura,
    f.fecha_emision,
    f.base_imponible,
    f.iva_importe,
    f.total,
    f.estado,
    e.numero_expediente
FROM facturas f
LEFT JOIN expedientes e ON e.id = f.expediente_id
WHERE f.pwgs_id IN (SELECT pwgs_id FROM spot_check_ids WHERE entidad = 'facturas')
ORDER BY f.pwgs_id;
```

### 7.4 Registro de resultados de spot-check

```sql
-- Tras comparar manualmente o por script, registrar
INSERT INTO validation_results (categoria, entidad, check_name, valor_pwgs, valor_erp, coincide, severidad, detalle)
VALUES
    ('spotcheck', 'expedientes', 'muestra_5pct',
     :total_verificados::TEXT, :total_correctos::TEXT,
     :total_verificados = :total_correctos,
     CASE WHEN :total_verificados = :total_correctos THEN 'INFO' ELSE 'ERROR' END,
     :detalle_discrepancias::JSONB);
```

---

## 8. Script Automatizado de Validacion

### 8.1 Script SQL consolidado

```sql
-- ============================================
-- VALIDACION COMPLETA POST-MIGRACION
-- Ejecutar contra la base de datos ERP
-- ============================================

-- Generar un run_id comun
DO $$
DECLARE
    v_run_id UUID := gen_random_uuid();
BEGIN
    RAISE NOTICE 'Validation Run ID: %', v_run_id;

    -- --- CONTEOS ---
    INSERT INTO validation_results (run_id, categoria, entidad, check_name, valor_erp, coincide, severidad)
    SELECT v_run_id, 'conteo', 'expedientes', 'total_migrados',
           COUNT(*)::TEXT, true, 'INFO'
    FROM expedientes WHERE pwgs_id IS NOT NULL;

    INSERT INTO validation_results (run_id, categoria, entidad, check_name, valor_erp, coincide, severidad)
    SELECT v_run_id, 'conteo', 'facturas', 'total_migrados',
           COUNT(*)::TEXT, true, 'INFO'
    FROM facturas WHERE pwgs_id IS NOT NULL;

    -- (anadir para cada entidad...)

    -- --- INTEGRIDAD ---
    INSERT INTO validation_results (run_id, categoria, entidad, check_name, valor_erp, coincide, severidad)
    SELECT v_run_id, 'integridad', 'facturas', 'orphan_expediente',
           COUNT(*)::TEXT, COUNT(*) = 0, 'ERROR'
    FROM facturas WHERE pwgs_id IS NOT NULL AND expediente_id IS NULL;

    INSERT INTO validation_results (run_id, categoria, entidad, check_name, valor_erp, coincide, severidad)
    SELECT v_run_id, 'integridad', 'partes_operario', 'orphan_expediente',
           COUNT(*)::TEXT, COUNT(*) = 0, 'ERROR'
    FROM partes_operario WHERE pwgs_id IS NOT NULL AND expediente_id IS NULL;

    INSERT INTO validation_results (run_id, categoria, entidad, check_name, valor_erp, coincide, severidad)
    SELECT v_run_id, 'integridad', 'pedidos_material', 'orphan_expediente',
           COUNT(*)::TEXT, COUNT(*) = 0, 'ERROR'
    FROM pedidos_material WHERE pwgs_id IS NOT NULL AND expediente_id IS NULL;

    -- --- NEGOCIO ---
    INSERT INTO validation_results (run_id, categoria, entidad, check_name, valor_erp, coincide, severidad)
    SELECT v_run_id, 'negocio', 'facturas', 'emitida_sin_fecha',
           COUNT(*)::TEXT, COUNT(*) = 0, 'ERROR'
    FROM facturas WHERE pwgs_id IS NOT NULL AND estado IN ('emitida','enviada','pagada') AND fecha_emision IS NULL;

    INSERT INTO validation_results (run_id, categoria, entidad, check_name, valor_erp, coincide, severidad)
    SELECT v_run_id, 'negocio', 'partes_operario', 'horas_invalidas',
           COUNT(*)::TEXT, COUNT(*) = 0, 'WARNING'
    FROM partes_operario WHERE pwgs_id IS NOT NULL AND (horas_trabajadas < 0 OR horas_trabajadas > 24);

    -- --- CHECKSUMS ---
    INSERT INTO validation_results (run_id, categoria, entidad, check_name, valor_erp, coincide, severidad)
    SELECT v_run_id, 'checksum', 'facturas', 'sum_total',
           ROUND(SUM(total)::NUMERIC, 2)::TEXT, true, 'INFO'
    FROM facturas WHERE pwgs_id IS NOT NULL;

    INSERT INTO validation_results (run_id, categoria, entidad, check_name, valor_erp, coincide, severidad)
    SELECT v_run_id, 'checksum', 'pagos', 'sum_importe',
           ROUND(SUM(importe)::NUMERIC, 2)::TEXT, true, 'INFO'
    FROM pagos WHERE pwgs_id IS NOT NULL;

END $$;
```

### 8.2 Script bash wrapper

```bash
#!/bin/bash
set -euo pipefail

DB_URL="${ERP_DATABASE_URL}"
REPORT_FILE="validation_report_$(date +%Y%m%d_%H%M%S).txt"

echo "=== VALIDACION PARALELA PWGS vs ERP ===" | tee "$REPORT_FILE"
echo "Inicio: $(date -Iseconds)" | tee -a "$REPORT_FILE"

# Ejecutar validacion completa
psql "$DB_URL" -f validate_all.sql 2>&1 | tee -a "$REPORT_FILE"

# Generar resumen
echo "" | tee -a "$REPORT_FILE"
echo "=== RESUMEN ===" | tee -a "$REPORT_FILE"

psql "$DB_URL" -c "
SELECT
    categoria,
    COUNT(*) FILTER (WHERE coincide) AS ok,
    COUNT(*) FILTER (WHERE NOT coincide AND severidad = 'ERROR') AS errores,
    COUNT(*) FILTER (WHERE NOT coincide AND severidad = 'WARNING') AS warnings,
    COUNT(*) AS total
FROM validation_results
WHERE run_id = (SELECT MAX(run_id) FROM validation_results)
GROUP BY categoria
ORDER BY categoria;
" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo "=== FALLOS DETALLADOS ===" | tee -a "$REPORT_FILE"

psql "$DB_URL" -c "
SELECT
    categoria, entidad, check_name, severidad,
    valor_pwgs, valor_erp, diferencia
FROM validation_results
WHERE run_id = (SELECT MAX(run_id) FROM validation_results)
  AND NOT coincide
ORDER BY
    CASE severidad WHEN 'ERROR' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
    categoria, entidad;
" | tee -a "$REPORT_FILE"

# Determinar GO/NO-GO
ERRORES=$(psql "$DB_URL" -t -c "
SELECT COUNT(*)
FROM validation_results
WHERE run_id = (SELECT MAX(run_id) FROM validation_results)
  AND NOT coincide
  AND severidad = 'ERROR';
")

echo "" | tee -a "$REPORT_FILE"
if [ "$ERRORES" -eq 0 ]; then
    echo "RESULTADO: GO - Sin errores criticos" | tee -a "$REPORT_FILE"
else
    echo "RESULTADO: NO-GO - $ERRORES errores criticos encontrados" | tee -a "$REPORT_FILE"
fi

echo "Fin: $(date -Iseconds)" | tee -a "$REPORT_FILE"
echo "Reporte guardado en: $REPORT_FILE"
```

---

## 9. Criterios GO/NO-GO basados en Validacion

| Criterio | GO | NO-GO |
|---|---|---|
| Conteo registros | Diferencia <= 0.1% | Diferencia > 0.1% en cualquier entidad |
| Checksums monetarios | Diferencia < 1.00 EUR | Diferencia >= 1.00 EUR en facturas o pagos |
| Integridad referencial | 0 errores de severidad ERROR | Cualquier ERROR de integridad |
| Reglas de negocio | 0 errores de severidad ERROR | Cualquier ERROR de negocio |
| Spot-check 5% | >= 99% coincidencia | < 99% coincidencia |
| Migration errors | < 0.5% del total de registros | >= 0.5% del total de registros |

---

## 10. Frecuencia de Ejecucion

| Momento | Tipo de validacion |
|---|---|
| Despues de cada ensayo de migracion | Completa (todas las secciones) |
| T-7 (ensayo general) | Completa + spot-check manual |
| T-1 (pre-cutover) | Completa |
| T0 (post-cutover) | Completa + spot-check ampliado (10%) |
| T+1 | Checksums + integridad |
| T+7 | Conteo + checksums (verificar que no hay deriva) |
