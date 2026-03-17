-- Migration: EP09 Proveedores y Logística
-- Fecha: 2026-03-15

-- ============================================================
-- 1. TABLA: proveedores
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    cif TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    codigo_postal TEXT,
    localidad TEXT,
    provincia TEXT,
    canal_preferido TEXT NOT NULL DEFAULT 'email'
        CHECK (canal_preferido IN ('email','portal','telefono','manual')),
    especialidades TEXT[] DEFAULT '{}',
    activo BOOLEAN DEFAULT true,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedores' AND column_name = 'direccion') THEN
        ALTER TABLE proveedores ADD COLUMN direccion TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedores' AND column_name = 'codigo_postal') THEN
        ALTER TABLE proveedores ADD COLUMN codigo_postal TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedores' AND column_name = 'localidad') THEN
        ALTER TABLE proveedores ADD COLUMN localidad TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedores' AND column_name = 'provincia') THEN
        ALTER TABLE proveedores ADD COLUMN provincia TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedores' AND column_name = 'canal_preferido') THEN
        ALTER TABLE proveedores ADD COLUMN canal_preferido TEXT DEFAULT 'email';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedores' AND column_name = 'especialidades') THEN
        ALTER TABLE proveedores ADD COLUMN especialidades TEXT[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedores' AND column_name = 'notas') THEN
        ALTER TABLE proveedores ADD COLUMN notas TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proveedores' AND column_name = 'updated_at') THEN
        ALTER TABLE proveedores ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- ============================================================
-- 2. TABLA: pedidos_material
-- ============================================================
CREATE TABLE IF NOT EXISTS pedidos_material (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id),
    proveedor_id UUID NOT NULL REFERENCES proveedores(id),
    cita_id UUID REFERENCES citas(id),
    numero_pedido TEXT NOT NULL UNIQUE,
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente','enviado','confirmado','listo_para_recoger','recogido','caducado','cancelado')),
    fecha_limite TIMESTAMPTZ,
    observaciones TEXT,
    enviado_at TIMESTAMPTZ,
    enviado_por UUID,
    envio_error TEXT,
    confirmado_at TIMESTAMPTZ,
    recogido_at TIMESTAMPTZ,
    recogido_por UUID,
    cancelado_at TIMESTAMPTZ,
    cancelado_motivo TEXT,
    caducado_at TIMESTAMPTZ,
    token_confirmacion TEXT UNIQUE,
    token_expira_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'cita_id') THEN
        ALTER TABLE pedidos_material ADD COLUMN cita_id UUID REFERENCES citas(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'numero_pedido') THEN
        ALTER TABLE pedidos_material ADD COLUMN numero_pedido TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'observaciones') THEN
        ALTER TABLE pedidos_material ADD COLUMN observaciones TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'enviado_at') THEN
        ALTER TABLE pedidos_material ADD COLUMN enviado_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'enviado_por') THEN
        ALTER TABLE pedidos_material ADD COLUMN enviado_por UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'envio_error') THEN
        ALTER TABLE pedidos_material ADD COLUMN envio_error TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'confirmado_at') THEN
        ALTER TABLE pedidos_material ADD COLUMN confirmado_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'recogido_at') THEN
        ALTER TABLE pedidos_material ADD COLUMN recogido_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'recogido_por') THEN
        ALTER TABLE pedidos_material ADD COLUMN recogido_por UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'cancelado_at') THEN
        ALTER TABLE pedidos_material ADD COLUMN cancelado_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'cancelado_motivo') THEN
        ALTER TABLE pedidos_material ADD COLUMN cancelado_motivo TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'caducado_at') THEN
        ALTER TABLE pedidos_material ADD COLUMN caducado_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'token_confirmacion') THEN
        ALTER TABLE pedidos_material ADD COLUMN token_confirmacion TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'token_expira_at') THEN
        ALTER TABLE pedidos_material ADD COLUMN token_expira_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_material' AND column_name = 'created_by') THEN
        ALTER TABLE pedidos_material ADD COLUMN created_by UUID;
    END IF;
END $$;

UPDATE pedidos_material
SET numero_pedido = COALESCE(numero_pedido, 'PED-' || to_char(created_at, 'YYYYMMDD') || '-' || substring(id::text, 1, 8)),
    observaciones = COALESCE(observaciones, notas),
    created_by = COALESCE(created_by, solicitado_por)
WHERE numero_pedido IS NULL
   OR observaciones IS NULL
   OR created_by IS NULL;

ALTER TABLE pedidos_material ALTER COLUMN numero_pedido SET NOT NULL;
ALTER TABLE pedidos_material ALTER COLUMN created_by SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_material_numero_pedido_unique ON pedidos_material(numero_pedido);

-- ============================================================
-- 3. TABLA: lineas_pedido
-- ============================================================
CREATE TABLE IF NOT EXISTS lineas_pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES pedidos_material(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
    unidad TEXT DEFAULT 'ud',
    referencia TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lineas_pedido' AND column_name = 'referencia') THEN
        ALTER TABLE lineas_pedido ADD COLUMN referencia TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lineas_pedido' AND column_name = 'notas') THEN
        ALTER TABLE lineas_pedido ADD COLUMN notas TEXT;
    END IF;
END $$;

-- ============================================================
-- 4. TABLA: confirmaciones_proveedor
-- ============================================================
CREATE TABLE IF NOT EXISTS confirmaciones_proveedor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES pedidos_material(id),
    token TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    confirmado_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'confirmaciones_proveedor' AND column_name = 'token') THEN
        ALTER TABLE confirmaciones_proveedor ADD COLUMN token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'confirmaciones_proveedor' AND column_name = 'ip') THEN
        ALTER TABLE confirmaciones_proveedor ADD COLUMN ip TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'confirmaciones_proveedor' AND column_name = 'user_agent') THEN
        ALTER TABLE confirmaciones_proveedor ADD COLUMN user_agent TEXT;
    END IF;
END $$;

-- ============================================================
-- 5. TABLA: historial_pedido
-- ============================================================
CREATE TABLE IF NOT EXISTS historial_pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES pedidos_material(id),
    estado_anterior TEXT,
    estado_nuevo TEXT NOT NULL,
    motivo TEXT,
    actor_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. VISTAS
-- ============================================================
CREATE OR REPLACE VIEW v_pedidos_a_recoger AS
SELECT
    pm.id,
    pm.numero_pedido,
    pm.estado,
    pm.fecha_limite,
    pm.confirmado_at,
    pm.expediente_id,
    e.numero_expediente,
    pm.proveedor_id,
    p.nombre AS proveedor_nombre,
    pm.cita_id,
    pm.observaciones,
    pm.created_at,
    COUNT(lp.id) AS total_lineas
FROM pedidos_material pm
JOIN expedientes e ON e.id = pm.expediente_id
JOIN proveedores p ON p.id = pm.proveedor_id
LEFT JOIN lineas_pedido lp ON lp.pedido_id = pm.id
WHERE pm.estado IN ('confirmado', 'listo_para_recoger')
GROUP BY pm.id, pm.numero_pedido, pm.estado, pm.fecha_limite,
         pm.confirmado_at, pm.expediente_id, e.numero_expediente,
         pm.proveedor_id, p.nombre, pm.cita_id, pm.observaciones, pm.created_at;

CREATE OR REPLACE VIEW v_pedidos_caducados AS
SELECT
    pm.id,
    pm.numero_pedido,
    pm.estado,
    pm.fecha_limite,
    pm.expediente_id,
    e.numero_expediente,
    e.compania_id,
    pm.proveedor_id,
    p.nombre AS proveedor_nombre,
    pm.observaciones,
    pm.created_at,
    EXTRACT(DAY FROM now() - pm.fecha_limite) AS dias_retraso
FROM pedidos_material pm
JOIN expedientes e ON e.id = pm.expediente_id
JOIN proveedores p ON p.id = pm.proveedor_id
WHERE (pm.estado IN ('pendiente', 'enviado') AND pm.fecha_limite < now())
   OR pm.estado = 'caducado';

-- ============================================================
-- 7. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pedidos_material_expediente_id ON pedidos_material(expediente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_material_proveedor_id ON pedidos_material(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_material_estado ON pedidos_material(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_material_fecha_limite ON pedidos_material(fecha_limite)
    WHERE estado IN ('pendiente', 'enviado');
CREATE INDEX IF NOT EXISTS idx_pedidos_material_token ON pedidos_material(token_confirmacion)
    WHERE token_confirmacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lineas_pedido_pedido_id ON lineas_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo);
CREATE INDEX IF NOT EXISTS idx_historial_pedido_pedido_id ON historial_pedido(pedido_id);

-- ============================================================
-- 8. RLS
-- ============================================================
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmaciones_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_pedido ENABLE ROW LEVEL SECURITY;

-- Helper: check staff role
-- (assumes public.get_my_role() already exists from prior migrations)

-- proveedores: staff SELECT
DO $$ BEGIN
    DROP POLICY IF EXISTS "proveedores_select_staff" ON proveedores;
    CREATE POLICY "proveedores_select_staff" ON proveedores
        FOR SELECT USING (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "proveedores_insert_admin" ON proveedores;
    CREATE POLICY "proveedores_insert_admin" ON proveedores
        FOR INSERT WITH CHECK (
            public.get_my_role() = 'admin'
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "proveedores_update_admin" ON proveedores;
    CREATE POLICY "proveedores_update_admin" ON proveedores
        FOR UPDATE USING (
            public.get_my_role() = 'admin'
        ) WITH CHECK (
            public.get_my_role() = 'admin'
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- pedidos_material: staff SELECT, staff INSERT/UPDATE
DO $$ BEGIN
    DROP POLICY IF EXISTS "pedidos_material_select_staff" ON pedidos_material;
    CREATE POLICY "pedidos_material_select_staff" ON pedidos_material
        FOR SELECT USING (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "pedidos_material_insert_staff" ON pedidos_material;
    CREATE POLICY "pedidos_material_insert_staff" ON pedidos_material
        FOR INSERT WITH CHECK (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "pedidos_material_update_staff" ON pedidos_material;
    CREATE POLICY "pedidos_material_update_staff" ON pedidos_material
        FOR UPDATE USING (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        ) WITH CHECK (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- lineas_pedido: staff SELECT/INSERT/UPDATE/DELETE
DO $$ BEGIN
    DROP POLICY IF EXISTS "lineas_pedido_select_staff" ON lineas_pedido;
    CREATE POLICY "lineas_pedido_select_staff" ON lineas_pedido
        FOR SELECT USING (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "lineas_pedido_insert_staff" ON lineas_pedido;
    CREATE POLICY "lineas_pedido_insert_staff" ON lineas_pedido
        FOR INSERT WITH CHECK (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "lineas_pedido_update_staff" ON lineas_pedido;
    CREATE POLICY "lineas_pedido_update_staff" ON lineas_pedido
        FOR UPDATE USING (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        ) WITH CHECK (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "lineas_pedido_delete_staff" ON lineas_pedido;
    CREATE POLICY "lineas_pedido_delete_staff" ON lineas_pedido
        FOR DELETE USING (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- confirmaciones_proveedor: staff SELECT, anyone INSERT (magic link)
DO $$ BEGIN
    DROP POLICY IF EXISTS "confirmaciones_select_staff" ON confirmaciones_proveedor;
    CREATE POLICY "confirmaciones_select_staff" ON confirmaciones_proveedor
        FOR SELECT USING (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "confirmaciones_insert_anyone" ON confirmaciones_proveedor;
    CREATE POLICY "confirmaciones_insert_anyone" ON confirmaciones_proveedor
        FOR INSERT WITH CHECK (true);
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- historial_pedido: staff SELECT
DO $$ BEGIN
    DROP POLICY IF EXISTS "historial_pedido_select_staff" ON historial_pedido;
    CREATE POLICY "historial_pedido_select_staff" ON historial_pedido
        FOR SELECT USING (
            public.get_my_role() IN ('admin','supervisor','tramitador','financiero')
        );
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ============================================================
-- 9. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos_material;
