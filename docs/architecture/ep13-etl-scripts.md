# EP13 — ETL Scripts: Proceso de Migracion Reproducible

> Migracion PWGS -> ERP (Supabase/PostgreSQL)
> Version: 1.0 | Fecha: 2026-03-15

---

## 1. Arquitectura General del ETL

```
PWGS (MySQL/origen) --> STAGING (PostgreSQL) --> TRANSFORM + DEDUP --> ERP (Supabase)
                         stg_*                    migration_errors
```

El proceso se ejecuta en tres fases:

1. **Extract**: Volcado de tablas PWGS a tablas staging (`stg_*`) en PostgreSQL.
2. **Transform + Load**: INSERT INTO tablas ERP desde staging con mapeo de columnas, deduplicacion y validacion.
3. **Post-load**: Reset de secuencias, verificacion de integridad, log de errores.

Cada fase es idempotente: se puede re-ejecutar sin duplicar datos gracias a `ON CONFLICT` y truncado previo de staging.

---

## 2. Tabla de Errores de Migracion

Crear antes de cualquier otra operacion:

```sql
CREATE TABLE IF NOT EXISTS migration_errors (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fase            TEXT NOT NULL,          -- 'extract', 'transform', 'post-load'
    tabla_origen    TEXT NOT NULL,
    tabla_destino   TEXT,
    registro_id     TEXT,                   -- PK del registro que fallo
    error_code      TEXT,
    error_message   TEXT,
    datos_raw       JSONB,                  -- fila completa serializada
    resuelto        BOOLEAN NOT NULL DEFAULT false,
    resuelto_at     TIMESTAMPTZ,
    notas           TEXT
);

CREATE INDEX idx_migration_errors_fase ON migration_errors(fase);
CREATE INDEX idx_migration_errors_tabla ON migration_errors(tabla_origen);
CREATE INDEX idx_migration_errors_resuelto ON migration_errors(resuelto) WHERE NOT resuelto;
```

---

## 3. Tablas Staging

### 3.1 `stg_siniestros`

```sql
CREATE TABLE stg_siniestros (
    id_origen           TEXT NOT NULL,
    numero_expediente   TEXT,
    fecha_apertura      TEXT,
    fecha_cierre        TEXT,
    estado              TEXT,
    tipo_siniestro      TEXT,
    descripcion         TEXT,
    direccion           TEXT,
    codigo_postal       TEXT,
    poblacion           TEXT,
    provincia           TEXT,
    id_asegurado        TEXT,
    id_compania         TEXT,
    referencia_compania TEXT,
    importe_estimado    TEXT,
    prioridad           TEXT,
    observaciones       TEXT,
    datos_extra         JSONB,
    _loaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_origen)
);
```

### 3.2 `stg_asegurados`

```sql
CREATE TABLE stg_asegurados (
    id_origen       TEXT NOT NULL,
    nombre          TEXT,
    apellidos       TEXT,
    nif_cif         TEXT,
    telefono        TEXT,
    telefono2       TEXT,
    email           TEXT,
    direccion       TEXT,
    codigo_postal   TEXT,
    poblacion       TEXT,
    provincia       TEXT,
    numero_poliza   TEXT,
    datos_extra     JSONB,
    _loaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_origen)
);
```

### 3.3 `stg_companias`

```sql
CREATE TABLE stg_companias (
    id_origen           TEXT NOT NULL,
    nombre              TEXT,
    cif                 TEXT,
    direccion           TEXT,
    codigo_postal       TEXT,
    poblacion           TEXT,
    provincia           TEXT,
    telefono            TEXT,
    email               TEXT,
    persona_contacto    TEXT,
    condiciones_pago    TEXT,
    datos_extra         JSONB,
    _loaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_origen)
);
```

### 3.4 `stg_operarios`

```sql
CREATE TABLE stg_operarios (
    id_origen       TEXT NOT NULL,
    nombre          TEXT,
    apellidos       TEXT,
    nif             TEXT,
    telefono        TEXT,
    email           TEXT,
    especialidad    TEXT,
    tarifa_hora     TEXT,
    activo          TEXT,
    datos_extra     JSONB,
    _loaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_origen)
);
```

### 3.5 `stg_facturas`

```sql
CREATE TABLE stg_facturas (
    id_origen           TEXT NOT NULL,
    numero_factura      TEXT,
    id_expediente       TEXT,
    id_compania         TEXT,
    fecha_emision       TEXT,
    fecha_vencimiento   TEXT,
    base_imponible      TEXT,
    iva_porcentaje      TEXT,
    iva_importe         TEXT,
    irpf_porcentaje     TEXT,
    irpf_importe        TEXT,
    total               TEXT,
    estado              TEXT,
    forma_pago          TEXT,
    observaciones       TEXT,
    lineas              JSONB,          -- array de lineas de factura
    datos_extra         JSONB,
    _loaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_origen)
);
```

### 3.6 `stg_partes`

```sql
CREATE TABLE stg_partes (
    id_origen           TEXT NOT NULL,
    id_expediente       TEXT,
    id_operario         TEXT,
    fecha               TEXT,
    hora_inicio         TEXT,
    hora_fin            TEXT,
    horas_trabajadas    TEXT,
    descripcion_trabajo TEXT,
    materiales          TEXT,
    importe             TEXT,
    firmado             TEXT,
    datos_extra         JSONB,
    _loaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_origen)
);
```

### 3.7 `stg_proveedores`

```sql
CREATE TABLE stg_proveedores (
    id_origen       TEXT NOT NULL,
    nombre          TEXT,
    cif             TEXT,
    direccion       TEXT,
    codigo_postal   TEXT,
    poblacion       TEXT,
    provincia       TEXT,
    telefono        TEXT,
    email           TEXT,
    persona_contacto TEXT,
    categoria       TEXT,
    datos_extra     JSONB,
    _loaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_origen)
);
```

### 3.8 `stg_pedidos`

```sql
CREATE TABLE stg_pedidos (
    id_origen           TEXT NOT NULL,
    numero_pedido       TEXT,
    id_expediente       TEXT,
    id_proveedor        TEXT,
    fecha_pedido        TEXT,
    fecha_entrega_est   TEXT,
    fecha_entrega_real  TEXT,
    estado              TEXT,
    importe_total       TEXT,
    observaciones       TEXT,
    lineas              JSONB,          -- array de lineas de pedido
    datos_extra         JSONB,
    _loaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_origen)
);
```

---

## 4. Extract: Carga desde PWGS a Staging

Antes de cada carga se truncan las tablas staging para garantizar idempotencia:

```sql
TRUNCATE stg_siniestros, stg_asegurados, stg_companias, stg_operarios,
         stg_facturas, stg_partes, stg_proveedores, stg_pedidos;
```

La extraccion se realiza mediante `INSERT INTO stg_* SELECT ... FROM dblink(pwgs_connection, query)` o volcado CSV + `COPY`. Ejemplo con dblink:

```sql
-- Ejemplo: extraccion de siniestros
INSERT INTO stg_siniestros (
    id_origen, numero_expediente, fecha_apertura, fecha_cierre,
    estado, tipo_siniestro, descripcion, direccion, codigo_postal,
    poblacion, provincia, id_asegurado, id_compania,
    referencia_compania, importe_estimado, prioridad, observaciones
)
SELECT
    CAST(s.id AS TEXT),
    s.numero,
    CAST(s.fecha_apertura AS TEXT),
    CAST(s.fecha_cierre AS TEXT),
    s.estado,
    s.tipo,
    s.descripcion,
    s.direccion,
    s.cp,
    s.poblacion,
    s.provincia,
    CAST(s.id_asegurado AS TEXT),
    CAST(s.id_cia AS TEXT),
    s.referencia_cia,
    CAST(s.importe_estimado AS TEXT),
    s.prioridad,
    s.observaciones
FROM dblink('pwgs_conn',
    'SELECT id, numero, fecha_apertura, fecha_cierre, estado, tipo,
            descripcion, direccion, cp, poblacion, provincia,
            id_asegurado, id_cia, referencia_cia, importe_estimado,
            prioridad, observaciones
     FROM siniestros'
) AS s(
    id INT, numero VARCHAR, fecha_apertura DATE, fecha_cierre DATE,
    estado VARCHAR, tipo VARCHAR, descripcion TEXT, direccion VARCHAR,
    cp VARCHAR, poblacion VARCHAR, provincia VARCHAR,
    id_asegurado INT, id_cia INT, referencia_cia VARCHAR,
    importe_estimado DECIMAL, prioridad VARCHAR, observaciones TEXT
);
```

> Repetir patron analogo para las restantes 7 tablas staging.

---

## 5. Transform + Load: Staging a ERP

### 5.1 Estrategia General

- Cada bloque usa `BEGIN` / `SAVEPOINT` / `RELEASE` / `ROLLBACK TO`.
- Se procesa en orden de dependencias: companias -> asegurados -> proveedores -> operarios -> expedientes -> facturas -> lineas_factura -> partes -> pedidos -> lineas_pedido.
- Las filas que fallan se capturan en `migration_errors` y no detienen la migracion.

### 5.2 Mapeo: Companias Aseguradoras

```sql
BEGIN;
SAVEPOINT sp_companias;

INSERT INTO companias_aseguradoras (
    nombre, cif, direccion, codigo_postal,
    poblacion, provincia, telefono, email,
    persona_contacto, condiciones_pago,
    pwgs_id, created_at, updated_at
)
SELECT
    COALESCE(NULLIF(TRIM(c.nombre), ''), '[Sin nombre]'),
    NULLIF(TRIM(c.cif), ''),
    NULLIF(TRIM(c.direccion), ''),
    NULLIF(TRIM(c.codigo_postal), ''),
    NULLIF(TRIM(c.poblacion), ''),
    NULLIF(TRIM(c.provincia), ''),
    NULLIF(TRIM(c.telefono), ''),
    NULLIF(TRIM(c.email), ''),
    NULLIF(TRIM(c.persona_contacto), ''),
    NULLIF(TRIM(c.condiciones_pago), ''),
    c.id_origen,
    now(),
    now()
FROM stg_companias c
WHERE NOT EXISTS (
    SELECT 1 FROM companias_aseguradoras ca WHERE ca.pwgs_id = c.id_origen
)
ON CONFLICT (pwgs_id) DO NOTHING;

RELEASE SAVEPOINT sp_companias;
COMMIT;
```

### 5.3 Mapeo: Asegurados

```sql
BEGIN;
SAVEPOINT sp_asegurados;

INSERT INTO asegurados (
    nombre, apellidos, nif_cif, telefono, telefono2,
    email, direccion, codigo_postal, poblacion, provincia,
    numero_poliza, pwgs_id, created_at, updated_at
)
SELECT
    COALESCE(NULLIF(TRIM(a.nombre), ''), '[Sin nombre]'),
    NULLIF(TRIM(a.apellidos), ''),
    NULLIF(TRIM(a.nif_cif), ''),
    NULLIF(TRIM(a.telefono), ''),
    NULLIF(TRIM(a.telefono2), ''),
    NULLIF(TRIM(a.email), ''),
    NULLIF(TRIM(a.direccion), ''),
    NULLIF(TRIM(a.codigo_postal), ''),
    NULLIF(TRIM(a.poblacion), ''),
    NULLIF(TRIM(a.provincia), ''),
    NULLIF(TRIM(a.numero_poliza), ''),
    a.id_origen,
    now(),
    now()
FROM stg_asegurados a
WHERE NOT EXISTS (
    SELECT 1 FROM asegurados aa WHERE aa.pwgs_id = a.id_origen
)
ON CONFLICT (pwgs_id) DO NOTHING;

RELEASE SAVEPOINT sp_asegurados;
COMMIT;
```

### 5.4 Mapeo: Proveedores

```sql
BEGIN;
SAVEPOINT sp_proveedores;

INSERT INTO proveedores (
    nombre, cif, direccion, codigo_postal,
    poblacion, provincia, telefono, email,
    persona_contacto, categoria,
    pwgs_id, created_at, updated_at
)
SELECT
    COALESCE(NULLIF(TRIM(p.nombre), ''), '[Sin nombre]'),
    NULLIF(TRIM(p.cif), ''),
    NULLIF(TRIM(p.direccion), ''),
    NULLIF(TRIM(p.codigo_postal), ''),
    NULLIF(TRIM(p.poblacion), ''),
    NULLIF(TRIM(p.provincia), ''),
    NULLIF(TRIM(p.telefono), ''),
    NULLIF(TRIM(p.email), ''),
    NULLIF(TRIM(p.persona_contacto), ''),
    NULLIF(TRIM(p.categoria), ''),
    p.id_origen,
    now(),
    now()
FROM stg_proveedores p
WHERE NOT EXISTS (
    SELECT 1 FROM proveedores pp WHERE pp.pwgs_id = p.id_origen
)
ON CONFLICT (pwgs_id) DO NOTHING;

RELEASE SAVEPOINT sp_proveedores;
COMMIT;
```

### 5.5 Mapeo: Operarios

```sql
BEGIN;
SAVEPOINT sp_operarios;

INSERT INTO operarios (
    nombre, apellidos, nif, telefono, email,
    especialidad, tarifa_hora, activo,
    pwgs_id, created_at, updated_at
)
SELECT
    COALESCE(NULLIF(TRIM(o.nombre), ''), '[Sin nombre]'),
    NULLIF(TRIM(o.apellidos), ''),
    NULLIF(TRIM(o.nif), ''),
    NULLIF(TRIM(o.telefono), ''),
    NULLIF(TRIM(o.email), ''),
    NULLIF(TRIM(o.especialidad), ''),
    CASE
        WHEN o.tarifa_hora ~ '^\d+(\.\d+)?$' THEN o.tarifa_hora::NUMERIC
        ELSE NULL
    END,
    CASE UPPER(TRIM(o.activo))
        WHEN 'S' THEN true
        WHEN 'SI' THEN true
        WHEN '1' THEN true
        ELSE false
    END,
    o.id_origen,
    now(),
    now()
FROM stg_operarios o
WHERE NOT EXISTS (
    SELECT 1 FROM operarios oo WHERE oo.pwgs_id = o.id_origen
)
ON CONFLICT (pwgs_id) DO NOTHING;

RELEASE SAVEPOINT sp_operarios;
COMMIT;
```

### 5.6 Mapeo: Expedientes (desde siniestros)

```sql
BEGIN;
SAVEPOINT sp_expedientes;

INSERT INTO expedientes (
    numero_expediente, fecha_apertura, fecha_cierre,
    estado, tipo_siniestro, descripcion,
    direccion, codigo_postal, poblacion, provincia,
    asegurado_id, compania_aseguradora_id,
    referencia_compania, importe_estimado, prioridad,
    observaciones, pwgs_id, created_at, updated_at
)
SELECT
    s.numero_expediente,
    CASE WHEN s.fecha_apertura ~ '^\d{4}-\d{2}-\d{2}' THEN s.fecha_apertura::DATE ELSE NULL END,
    CASE WHEN s.fecha_cierre ~ '^\d{4}-\d{2}-\d{2}' THEN s.fecha_cierre::DATE ELSE NULL END,
    COALESCE(NULLIF(TRIM(s.estado), ''), 'pendiente'),
    NULLIF(TRIM(s.tipo_siniestro), ''),
    NULLIF(TRIM(s.descripcion), ''),
    NULLIF(TRIM(s.direccion), ''),
    NULLIF(TRIM(s.codigo_postal), ''),
    NULLIF(TRIM(s.poblacion), ''),
    NULLIF(TRIM(s.provincia), ''),
    a.id,
    ca.id,
    NULLIF(TRIM(s.referencia_compania), ''),
    CASE WHEN s.importe_estimado ~ '^\d+(\.\d+)?$' THEN s.importe_estimado::NUMERIC ELSE NULL END,
    NULLIF(TRIM(s.prioridad), ''),
    NULLIF(TRIM(s.observaciones), ''),
    s.id_origen,
    now(),
    now()
FROM stg_siniestros s
LEFT JOIN asegurados a ON a.pwgs_id = s.id_asegurado
LEFT JOIN companias_aseguradoras ca ON ca.pwgs_id = s.id_compania
WHERE NOT EXISTS (
    SELECT 1 FROM expedientes e WHERE e.pwgs_id = s.id_origen
)
ON CONFLICT (pwgs_id) DO NOTHING;

-- Registrar siniestros sin asegurado vinculado
INSERT INTO migration_errors (fase, tabla_origen, tabla_destino, registro_id, error_code, error_message, datos_raw)
SELECT
    'transform', 'stg_siniestros', 'expedientes',
    s.id_origen, 'ORPHAN_ASEGURADO',
    'Siniestro referencia asegurado ' || s.id_asegurado || ' que no existe en ERP',
    to_jsonb(s)
FROM stg_siniestros s
LEFT JOIN asegurados a ON a.pwgs_id = s.id_asegurado
WHERE s.id_asegurado IS NOT NULL
  AND a.id IS NULL;

RELEASE SAVEPOINT sp_expedientes;
COMMIT;
```

### 5.7 Mapeo: Facturas + Lineas de Factura

```sql
BEGIN;
SAVEPOINT sp_facturas;

-- Facturas cabecera
INSERT INTO facturas (
    numero_factura, expediente_id, compania_aseguradora_id,
    fecha_emision, fecha_vencimiento,
    base_imponible, iva_porcentaje, iva_importe,
    irpf_porcentaje, irpf_importe, total,
    estado, forma_pago, observaciones,
    pwgs_id, created_at, updated_at
)
SELECT
    f.numero_factura,
    e.id,
    ca.id,
    CASE WHEN f.fecha_emision ~ '^\d{4}-\d{2}-\d{2}' THEN f.fecha_emision::DATE ELSE NULL END,
    CASE WHEN f.fecha_vencimiento ~ '^\d{4}-\d{2}-\d{2}' THEN f.fecha_vencimiento::DATE ELSE NULL END,
    CASE WHEN f.base_imponible ~ '^\-?\d+(\.\d+)?$' THEN f.base_imponible::NUMERIC ELSE 0 END,
    CASE WHEN f.iva_porcentaje ~ '^\d+(\.\d+)?$' THEN f.iva_porcentaje::NUMERIC ELSE 21 END,
    CASE WHEN f.iva_importe ~ '^\-?\d+(\.\d+)?$' THEN f.iva_importe::NUMERIC ELSE 0 END,
    CASE WHEN f.irpf_porcentaje ~ '^\d+(\.\d+)?$' THEN f.irpf_porcentaje::NUMERIC ELSE 0 END,
    CASE WHEN f.irpf_importe ~ '^\-?\d+(\.\d+)?$' THEN f.irpf_importe::NUMERIC ELSE 0 END,
    CASE WHEN f.total ~ '^\-?\d+(\.\d+)?$' THEN f.total::NUMERIC ELSE 0 END,
    COALESCE(NULLIF(TRIM(f.estado), ''), 'borrador'),
    NULLIF(TRIM(f.forma_pago), ''),
    NULLIF(TRIM(f.observaciones), ''),
    f.id_origen,
    now(),
    now()
FROM stg_facturas f
LEFT JOIN expedientes e ON e.pwgs_id = f.id_expediente
LEFT JOIN companias_aseguradoras ca ON ca.pwgs_id = f.id_compania
WHERE NOT EXISTS (
    SELECT 1 FROM facturas ff WHERE ff.pwgs_id = f.id_origen
)
ON CONFLICT (pwgs_id) DO NOTHING;

-- Lineas de factura (desde JSONB embebido en stg_facturas.lineas)
INSERT INTO lineas_factura (
    factura_id, descripcion, cantidad, precio_unitario,
    importe, created_at, updated_at
)
SELECT
    ff.id,
    COALESCE(l->>'descripcion', ''),
    COALESCE((l->>'cantidad')::NUMERIC, 1),
    COALESCE((l->>'precio_unitario')::NUMERIC, 0),
    COALESCE((l->>'importe')::NUMERIC, 0),
    now(),
    now()
FROM stg_facturas f
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(f.lineas, '[]'::JSONB)) AS l
JOIN facturas ff ON ff.pwgs_id = f.id_origen
WHERE f.lineas IS NOT NULL
  AND jsonb_typeof(f.lineas) = 'array';

-- Log facturas huerfanas (sin expediente)
INSERT INTO migration_errors (fase, tabla_origen, tabla_destino, registro_id, error_code, error_message)
SELECT
    'transform', 'stg_facturas', 'facturas',
    f.id_origen, 'ORPHAN_EXPEDIENTE',
    'Factura referencia expediente ' || f.id_expediente || ' inexistente'
FROM stg_facturas f
LEFT JOIN expedientes e ON e.pwgs_id = f.id_expediente
WHERE f.id_expediente IS NOT NULL
  AND e.id IS NULL;

RELEASE SAVEPOINT sp_facturas;
COMMIT;
```

### 5.8 Mapeo: Partes de Operario

```sql
BEGIN;
SAVEPOINT sp_partes;

INSERT INTO partes_operario (
    expediente_id, operario_id, fecha,
    hora_inicio, hora_fin, horas_trabajadas,
    descripcion_trabajo, materiales, importe, firmado,
    pwgs_id, created_at, updated_at
)
SELECT
    e.id,
    o.id,
    CASE WHEN p.fecha ~ '^\d{4}-\d{2}-\d{2}' THEN p.fecha::DATE ELSE NULL END,
    CASE WHEN p.hora_inicio ~ '^\d{2}:\d{2}' THEN p.hora_inicio::TIME ELSE NULL END,
    CASE WHEN p.hora_fin ~ '^\d{2}:\d{2}' THEN p.hora_fin::TIME ELSE NULL END,
    CASE WHEN p.horas_trabajadas ~ '^\d+(\.\d+)?$' THEN p.horas_trabajadas::NUMERIC ELSE NULL END,
    NULLIF(TRIM(p.descripcion_trabajo), ''),
    NULLIF(TRIM(p.materiales), ''),
    CASE WHEN p.importe ~ '^\-?\d+(\.\d+)?$' THEN p.importe::NUMERIC ELSE NULL END,
    CASE UPPER(TRIM(p.firmado))
        WHEN 'S' THEN true WHEN 'SI' THEN true WHEN '1' THEN true
        ELSE false
    END,
    p.id_origen,
    now(),
    now()
FROM stg_partes p
LEFT JOIN expedientes e ON e.pwgs_id = p.id_expediente
LEFT JOIN operarios o ON o.pwgs_id = p.id_operario
WHERE NOT EXISTS (
    SELECT 1 FROM partes_operario pp WHERE pp.pwgs_id = p.id_origen
)
ON CONFLICT (pwgs_id) DO NOTHING;

RELEASE SAVEPOINT sp_partes;
COMMIT;
```

### 5.9 Mapeo: Pedidos de Material + Lineas

```sql
BEGIN;
SAVEPOINT sp_pedidos;

INSERT INTO pedidos_material (
    numero_pedido, expediente_id, proveedor_id,
    fecha_pedido, fecha_entrega_estimada, fecha_entrega_real,
    estado, importe_total, observaciones,
    pwgs_id, created_at, updated_at
)
SELECT
    pd.numero_pedido,
    e.id,
    pr.id,
    CASE WHEN pd.fecha_pedido ~ '^\d{4}-\d{2}-\d{2}' THEN pd.fecha_pedido::DATE ELSE NULL END,
    CASE WHEN pd.fecha_entrega_est ~ '^\d{4}-\d{2}-\d{2}' THEN pd.fecha_entrega_est::DATE ELSE NULL END,
    CASE WHEN pd.fecha_entrega_real ~ '^\d{4}-\d{2}-\d{2}' THEN pd.fecha_entrega_real::DATE ELSE NULL END,
    COALESCE(NULLIF(TRIM(pd.estado), ''), 'pendiente'),
    CASE WHEN pd.importe_total ~ '^\-?\d+(\.\d+)?$' THEN pd.importe_total::NUMERIC ELSE 0 END,
    NULLIF(TRIM(pd.observaciones), ''),
    pd.id_origen,
    now(),
    now()
FROM stg_pedidos pd
LEFT JOIN expedientes e ON e.pwgs_id = pd.id_expediente
LEFT JOIN proveedores pr ON pr.pwgs_id = pd.id_proveedor
WHERE NOT EXISTS (
    SELECT 1 FROM pedidos_material pm WHERE pm.pwgs_id = pd.id_origen
)
ON CONFLICT (pwgs_id) DO NOTHING;

-- Lineas de pedido
INSERT INTO lineas_pedido (
    pedido_material_id, descripcion, cantidad,
    precio_unitario, importe, created_at, updated_at
)
SELECT
    pm.id,
    COALESCE(l->>'descripcion', ''),
    COALESCE((l->>'cantidad')::NUMERIC, 1),
    COALESCE((l->>'precio_unitario')::NUMERIC, 0),
    COALESCE((l->>'importe')::NUMERIC, 0),
    now(),
    now()
FROM stg_pedidos pd
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pd.lineas, '[]'::JSONB)) AS l
JOIN pedidos_material pm ON pm.pwgs_id = pd.id_origen
WHERE pd.lineas IS NOT NULL
  AND jsonb_typeof(pd.lineas) = 'array';

RELEASE SAVEPOINT sp_pedidos;
COMMIT;
```

---

## 6. Deduplicacion

Logica aplicada **dentro** de cada INSERT (ya incluida arriba via `WHERE NOT EXISTS` y `ON CONFLICT`). Adicionalmente, antes de la carga se pueden eliminar duplicados en staging:

```sql
-- Eliminar duplicados en staging por id_origen (mantener el mas reciente)
DELETE FROM stg_asegurados a
USING stg_asegurados b
WHERE a.id_origen = b.id_origen
  AND a._loaded_at < b._loaded_at;

-- Deduplicacion por NIF/CIF en asegurados (mantener el primer registro)
WITH duplicados AS (
    SELECT id_origen,
           ROW_NUMBER() OVER (PARTITION BY UPPER(TRIM(nif_cif)) ORDER BY id_origen) AS rn
    FROM stg_asegurados
    WHERE nif_cif IS NOT NULL AND TRIM(nif_cif) <> ''
)
INSERT INTO migration_errors (fase, tabla_origen, registro_id, error_code, error_message)
SELECT 'dedup', 'stg_asegurados', id_origen, 'DUPLICATE_NIF',
       'Asegurado duplicado por NIF, descartado'
FROM duplicados WHERE rn > 1;

DELETE FROM stg_asegurados
WHERE id_origen IN (
    SELECT id_origen FROM migration_errors
    WHERE tabla_origen = 'stg_asegurados' AND error_code = 'DUPLICATE_NIF'
);
```

---

## 7. Reset de Secuencias Post-Migracion

Despues de cargar datos con IDs historicos, las secuencias de PostgreSQL deben avanzar para evitar colisiones:

```sql
-- numero_expediente: buscar el maximo numerico y configurar secuencia
DO $$
DECLARE
    max_num BIGINT;
BEGIN
    SELECT COALESCE(
        MAX(
            CASE WHEN numero_expediente ~ '^\d+$'
                 THEN numero_expediente::BIGINT
                 ELSE 0
            END
        ), 0
    ) INTO max_num FROM expedientes;

    PERFORM setval('expedientes_numero_seq', max_num + 1, false);
    RAISE NOTICE 'Secuencia expedientes reseteada a %', max_num + 1;
END $$;

-- numero_factura
DO $$
DECLARE
    max_num BIGINT;
BEGIN
    SELECT COALESCE(
        MAX(
            CASE WHEN numero_factura ~ '^\d+$'
                 THEN numero_factura::BIGINT
                 ELSE 0
            END
        ), 0
    ) INTO max_num FROM facturas;

    PERFORM setval('facturas_numero_seq', max_num + 1, false);
    RAISE NOTICE 'Secuencia facturas reseteada a %', max_num + 1;
END $$;

-- numero_pedido
DO $$
DECLARE
    max_num BIGINT;
BEGIN
    SELECT COALESCE(
        MAX(
            CASE WHEN numero_pedido ~ '^\d+$'
                 THEN numero_pedido::BIGINT
                 ELSE 0
            END
        ), 0
    ) INTO max_num FROM pedidos_material;

    PERFORM setval('pedidos_numero_seq', max_num + 1, false);
    RAISE NOTICE 'Secuencia pedidos reseteada a %', max_num + 1;
END $$;

-- Reset de secuencias de IDs (SERIAL/BIGSERIAL) para todas las tablas migradas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            t.table_name,
            pg_get_serial_sequence(t.table_name, 'id') AS seq_name
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_name IN (
              'expedientes', 'asegurados', 'companias_aseguradoras',
              'operarios', 'facturas', 'lineas_factura', 'partes_operario',
              'proveedores', 'pedidos_material', 'lineas_pedido',
              'pagos', 'presupuestos', 'lineas_presupuesto'
          )
    LOOP
        IF r.seq_name IS NOT NULL THEN
            EXECUTE format(
                'SELECT setval(%L, COALESCE(MAX(id), 0) + 1, false) FROM %I',
                r.seq_name, r.table_name
            );
            RAISE NOTICE 'Secuencia % reseteada para tabla %', r.seq_name, r.table_name;
        END IF;
    END LOOP;
END $$;
```

---

## 8. Error Handling con Funciones Wrapper

Para capturar errores fila a fila sin detener la migracion:

```sql
CREATE OR REPLACE FUNCTION migrate_row_safe(
    p_tabla_origen TEXT,
    p_tabla_destino TEXT,
    p_registro_id TEXT,
    p_sql TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    EXECUTE p_sql;
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO migration_errors (fase, tabla_origen, tabla_destino, registro_id, error_code, error_message)
    VALUES ('transform', p_tabla_origen, p_tabla_destino, p_registro_id, SQLSTATE, SQLERRM);
    RETURN false;
END;
$$ LANGUAGE plpgsql;
```

---

## 9. Rollback Strategy

### 9.1 Rollback parcial (por entidad)

Cada bloque de transformacion usa transacciones y savepoints. Si falla un bloque:

```sql
ROLLBACK TO SAVEPOINT sp_facturas;
-- Corregir datos en staging y reintentar
```

### 9.2 Rollback completo

En caso de necesitar revertir toda la migracion:

```sql
-- ATENCION: Esto borra TODOS los datos migrados
BEGIN;

-- Orden inverso de dependencias
DELETE FROM lineas_pedido WHERE pedido_material_id IN (SELECT id FROM pedidos_material WHERE pwgs_id IS NOT NULL);
DELETE FROM pedidos_material WHERE pwgs_id IS NOT NULL;
DELETE FROM partes_operario WHERE pwgs_id IS NOT NULL;
DELETE FROM lineas_factura WHERE factura_id IN (SELECT id FROM facturas WHERE pwgs_id IS NOT NULL);
DELETE FROM facturas WHERE pwgs_id IS NOT NULL;
DELETE FROM expedientes WHERE pwgs_id IS NOT NULL;
DELETE FROM operarios WHERE pwgs_id IS NOT NULL;
DELETE FROM proveedores WHERE pwgs_id IS NOT NULL;
DELETE FROM asegurados WHERE pwgs_id IS NOT NULL;
DELETE FROM companias_aseguradoras WHERE pwgs_id IS NOT NULL;

-- Re-reset secuencias
-- (ejecutar bloque de seccion 7)

COMMIT;
```

La columna `pwgs_id` en cada tabla ERP permite identificar de forma inequivoca los registros migrados vs. los creados nativamente en el ERP.

### 9.3 Puntos de control

Despues de cada fase se registra un checkpoint:

```sql
CREATE TABLE IF NOT EXISTS migration_checkpoints (
    id          SERIAL PRIMARY KEY,
    fase        TEXT NOT NULL,
    tabla       TEXT NOT NULL,
    registros   INTEGER NOT NULL,
    errores     INTEGER NOT NULL DEFAULT 0,
    started_at  TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status      TEXT NOT NULL DEFAULT 'OK'  -- 'OK', 'PARTIAL', 'FAILED'
);

-- Ejemplo de registro de checkpoint
INSERT INTO migration_checkpoints (fase, tabla, registros, errores, started_at, status)
VALUES (
    'transform',
    'expedientes',
    (SELECT COUNT(*) FROM expedientes WHERE pwgs_id IS NOT NULL),
    (SELECT COUNT(*) FROM migration_errors WHERE tabla_destino = 'expedientes'),
    '2026-03-15 10:00:00+01',
    CASE
        WHEN (SELECT COUNT(*) FROM migration_errors WHERE tabla_destino = 'expedientes') = 0 THEN 'OK'
        WHEN (SELECT COUNT(*) FROM migration_errors WHERE tabla_destino = 'expedientes') < 10 THEN 'PARTIAL'
        ELSE 'FAILED'
    END
);
```

---

## 10. Script Master de Ejecucion

Orden de ejecucion recomendado:

```bash
#!/bin/bash
set -euo pipefail

DB_URL="${ERP_DATABASE_URL}"

echo "=== MIGRACION PWGS -> ERP ==="
echo "Inicio: $(date -Iseconds)"

# 1. Crear infraestructura
psql "$DB_URL" -f 00_create_migration_errors.sql
psql "$DB_URL" -f 00_create_staging_tables.sql

# 2. Extract
psql "$DB_URL" -f 01_truncate_staging.sql
psql "$DB_URL" -f 02_extract_pwgs.sql

# 3. Deduplicacion en staging
psql "$DB_URL" -f 03_dedup_staging.sql

# 4. Transform + Load (orden de dependencias)
psql "$DB_URL" -f 04_load_companias.sql
psql "$DB_URL" -f 05_load_asegurados.sql
psql "$DB_URL" -f 06_load_proveedores.sql
psql "$DB_URL" -f 07_load_operarios.sql
psql "$DB_URL" -f 08_load_expedientes.sql
psql "$DB_URL" -f 09_load_facturas.sql
psql "$DB_URL" -f 10_load_partes.sql
psql "$DB_URL" -f 11_load_pedidos.sql

# 5. Post-load
psql "$DB_URL" -f 12_reset_sequences.sql

# 6. Validacion
psql "$DB_URL" -f 13_validate.sql

# 7. Reporte
echo ""
echo "=== RESUMEN ==="
psql "$DB_URL" -c "SELECT tabla_destino, COUNT(*) as errores FROM migration_errors GROUP BY tabla_destino ORDER BY errores DESC;"
psql "$DB_URL" -c "SELECT * FROM migration_checkpoints ORDER BY id;"

echo "Fin: $(date -Iseconds)"
```

---

## Apendice: Columna `pwgs_id`

Cada tabla ERP destino debe tener una columna `pwgs_id` (TEXT, UNIQUE, NULLABLE) que almacena el ID original de PWGS. Esto permite:

- Trazabilidad origen-destino
- Rollback selectivo (`DELETE WHERE pwgs_id IS NOT NULL`)
- Deduplicacion en cargas repetidas (`ON CONFLICT (pwgs_id)`)
- Validacion cruzada post-migracion

```sql
-- Ejemplo de ALTER para tablas existentes
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS pwgs_id TEXT UNIQUE;
ALTER TABLE asegurados ADD COLUMN IF NOT EXISTS pwgs_id TEXT UNIQUE;
ALTER TABLE companias_aseguradoras ADD COLUMN IF NOT EXISTS pwgs_id TEXT UNIQUE;
ALTER TABLE operarios ADD COLUMN IF NOT EXISTS pwgs_id TEXT UNIQUE;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS pwgs_id TEXT UNIQUE;
ALTER TABLE partes_operario ADD COLUMN IF NOT EXISTS pwgs_id TEXT UNIQUE;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS pwgs_id TEXT UNIQUE;
ALTER TABLE pedidos_material ADD COLUMN IF NOT EXISTS pwgs_id TEXT UNIQUE;
```
