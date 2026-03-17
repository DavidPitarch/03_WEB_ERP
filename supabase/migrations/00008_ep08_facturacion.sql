-- Migration: 00008_ep08_facturacion.sql
-- Episodio 08: Facturación - tablas, extensiones, vistas, índices, RLS, realtime y seed data

-- ============================================================================
-- 1. Nueva tabla: series_facturacion
-- ============================================================================
CREATE TABLE IF NOT EXISTS series_facturacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(10) UNIQUE NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  prefijo VARCHAR(20) NOT NULL,
  empresa_facturadora_id UUID NOT NULL REFERENCES empresas_facturadoras(id),
  tipo VARCHAR(30) NOT NULL DEFAULT 'ordinaria' CHECK (tipo IN ('ordinaria', 'rectificativa', 'abono')),
  contador_actual INT NOT NULL DEFAULT 0,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Nueva tabla: seguimiento_cobro
-- ============================================================================
CREATE TABLE IF NOT EXISTS seguimiento_cobro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id UUID NOT NULL REFERENCES facturas(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('reclamacion', 'nota', 'contacto', 'gestion')),
  contenido TEXT NOT NULL,
  proximo_contacto DATE,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Extender facturas
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'serie_id') THEN
    ALTER TABLE facturas ADD COLUMN serie_id UUID REFERENCES series_facturacion(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'compania_id') THEN
    ALTER TABLE facturas ADD COLUMN compania_id UUID REFERENCES companias(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'estado_cobro') THEN
    ALTER TABLE facturas ADD COLUMN estado_cobro VARCHAR(30) DEFAULT 'pendiente' CHECK (estado_cobro IN ('pendiente', 'vencida', 'reclamada', 'cobrada', 'incobrable'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'forma_pago') THEN
    ALTER TABLE facturas ADD COLUMN forma_pago VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'cuenta_bancaria') THEN
    ALTER TABLE facturas ADD COLUMN cuenta_bancaria VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'notas') THEN
    ALTER TABLE facturas ADD COLUMN notas TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'canal_envio') THEN
    ALTER TABLE facturas ADD COLUMN canal_envio VARCHAR(30) CHECK (canal_envio IN ('email', 'api', 'portal', 'manual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'enviada_at') THEN
    ALTER TABLE facturas ADD COLUMN enviada_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'enviada_por') THEN
    ALTER TABLE facturas ADD COLUMN enviada_por UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'envio_resultado') THEN
    ALTER TABLE facturas ADD COLUMN envio_resultado TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'envio_error') THEN
    ALTER TABLE facturas ADD COLUMN envio_error TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'envio_intentos') THEN
    ALTER TABLE facturas ADD COLUMN envio_intentos INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'emitida_por') THEN
    ALTER TABLE facturas ADD COLUMN emitida_por UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'anulada_at') THEN
    ALTER TABLE facturas ADD COLUMN anulada_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'anulada_por') THEN
    ALTER TABLE facturas ADD COLUMN anulada_por UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'anulada_motivo') THEN
    ALTER TABLE facturas ADD COLUMN anulada_motivo TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'cobrada_at') THEN
    ALTER TABLE facturas ADD COLUMN cobrada_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'facturas' AND column_name = 'updated_at') THEN
    ALTER TABLE facturas ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- 4. Extender lineas_factura
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lineas_factura' AND column_name = 'partida_baremo_id') THEN
    ALTER TABLE lineas_factura ADD COLUMN partida_baremo_id UUID REFERENCES partidas_baremo(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lineas_factura' AND column_name = 'linea_presupuesto_id') THEN
    ALTER TABLE lineas_factura ADD COLUMN linea_presupuesto_id UUID REFERENCES lineas_presupuesto(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lineas_factura' AND column_name = 'descuento_porcentaje') THEN
    ALTER TABLE lineas_factura ADD COLUMN descuento_porcentaje NUMERIC(5,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lineas_factura' AND column_name = 'iva_porcentaje') THEN
    ALTER TABLE lineas_factura ADD COLUMN iva_porcentaje NUMERIC(5,2) DEFAULT 21;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lineas_factura' AND column_name = 'subtotal') THEN
    ALTER TABLE lineas_factura ADD COLUMN subtotal NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- 5. Extender pagos
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'actor_id') THEN
    ALTER TABLE pagos ADD COLUMN actor_id UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'tipo') THEN
    ALTER TABLE pagos ADD COLUMN tipo VARCHAR(30) DEFAULT 'cobro' CHECK (tipo IN ('cobro', 'devolucion', 'parcial'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'conciliacion_ref') THEN
    ALTER TABLE pagos ADD COLUMN conciliacion_ref VARCHAR(200);
  END IF;
END $$;

-- ============================================================================
-- 6. Vistas
-- ============================================================================
CREATE OR REPLACE VIEW v_pendientes_facturar AS
SELECT e.id as expediente_id, e.numero_expediente, e.estado, e.tipo_siniestro,
  e.compania_id, c.nombre as compania_nombre,
  e.empresa_facturadora_id, ef.nombre as empresa_nombre, ef.cif as empresa_cif,
  e.localidad, e.provincia,
  p.id as presupuesto_id, p.numero as presupuesto_numero,
  p.importe_total, p.aprobado, p.margen_previsto,
  e.updated_at as fecha_finalizacion
FROM expedientes e
JOIN empresas_facturadoras ef ON ef.id = e.empresa_facturadora_id
LEFT JOIN companias c ON c.id = e.compania_id
LEFT JOIN presupuestos p ON p.expediente_id = e.id AND p.aprobado = true
WHERE e.estado = 'FINALIZADO'
  AND NOT EXISTS (
    SELECT 1 FROM facturas f
    WHERE f.expediente_id = e.id AND f.estado != 'anulada'
  )
ORDER BY e.updated_at ASC;

CREATE OR REPLACE VIEW v_facturas_caducadas AS
SELECT f.*,
  e.numero_expediente, e.tipo_siniestro,
  c.nombre as compania_nombre,
  ef.nombre as empresa_nombre, ef.cif as empresa_cif,
  s.codigo as serie_codigo, s.nombre as serie_nombre,
  (CURRENT_DATE - f.fecha_vencimiento) as dias_vencida,
  (SELECT MAX(sc.created_at) FROM seguimiento_cobro sc WHERE sc.factura_id = f.id) as ultimo_seguimiento,
  (SELECT sc.proximo_contacto FROM seguimiento_cobro sc WHERE sc.factura_id = f.id ORDER BY sc.created_at DESC LIMIT 1) as proximo_contacto
FROM facturas f
JOIN expedientes e ON e.id = f.expediente_id
LEFT JOIN companias c ON c.id = f.compania_id
LEFT JOIN empresas_facturadoras ef ON ef.id = f.empresa_facturadora_id
LEFT JOIN series_facturacion s ON s.id = f.serie_id
WHERE f.fecha_vencimiento < CURRENT_DATE
  AND f.estado_cobro NOT IN ('cobrada', 'incobrable')
  AND f.estado != 'anulada'
ORDER BY f.fecha_vencimiento ASC;

CREATE OR REPLACE VIEW v_facturas_listado AS
SELECT f.*,
  e.numero_expediente,
  c.nombre as compania_nombre,
  ef.nombre as empresa_nombre,
  s.codigo as serie_codigo,
  (SELECT COALESCE(SUM(pg.importe), 0) FROM pagos pg WHERE pg.factura_id = f.id) as total_cobrado
FROM facturas f
JOIN expedientes e ON e.id = f.expediente_id
LEFT JOIN companias c ON c.id = f.compania_id
LEFT JOIN empresas_facturadoras ef ON ef.id = f.empresa_facturadora_id
LEFT JOIN series_facturacion s ON s.id = f.serie_id
ORDER BY f.created_at DESC;

-- ============================================================================
-- 7. Índices
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_facturas_expediente ON facturas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON facturas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_estado_cobro ON facturas(estado_cobro);
CREATE INDEX IF NOT EXISTS idx_facturas_vencimiento ON facturas(fecha_vencimiento) WHERE estado != 'anulada';
CREATE INDEX IF NOT EXISTS idx_facturas_compania ON facturas(compania_id);
CREATE INDEX IF NOT EXISTS idx_facturas_serie ON facturas(serie_id);
CREATE INDEX IF NOT EXISTS idx_seguimiento_factura ON seguimiento_cobro(factura_id);
CREATE INDEX IF NOT EXISTS idx_pagos_factura ON pagos(factura_id);
CREATE INDEX IF NOT EXISTS idx_lineas_factura_factura ON lineas_factura(factura_id);

-- ============================================================================
-- 8. RLS
-- ============================================================================
ALTER TABLE series_facturacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguimiento_cobro ENABLE ROW LEVEL SECURITY;

-- series_facturacion: staff can read
CREATE POLICY "staff_read_series" ON series_facturacion
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'supervisor', 'financiero', 'direccion')
    )
  );

-- series_facturacion: admin/financiero can insert/update
CREATE POLICY "admin_financiero_manage_series" ON series_facturacion
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'financiero')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'financiero')
    )
  );

-- seguimiento_cobro: staff can read
CREATE POLICY "staff_read_seguimiento" ON seguimiento_cobro
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'supervisor', 'financiero', 'direccion')
    )
  );

-- seguimiento_cobro: admin/financiero can insert/update
CREATE POLICY "admin_financiero_manage_seguimiento" ON seguimiento_cobro
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'financiero')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'financiero')
    )
  );

-- facturas RLS: staff can read all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facturas' AND policyname = 'staff_read_facturas') THEN
    CREATE POLICY "staff_read_facturas" ON facturas
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'supervisor', 'financiero', 'direccion')
        )
      );
  END IF;
END $$;

-- facturas: admin/financiero can insert/update
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facturas' AND policyname = 'admin_financiero_manage_facturas') THEN
    CREATE POLICY "admin_financiero_manage_facturas" ON facturas
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'financiero')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'financiero')
        )
      );
  END IF;
END $$;

-- pagos RLS: staff can read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pagos' AND policyname = 'staff_read_pagos') THEN
    CREATE POLICY "staff_read_pagos" ON pagos
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'supervisor', 'financiero', 'direccion')
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 9. Realtime
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE facturas, seguimiento_cobro;

-- ============================================================================
-- 10. Seed data
-- ============================================================================

-- Series de facturación
INSERT INTO series_facturacion (codigo, nombre, prefijo, empresa_facturadora_id, tipo, contador_actual, activa)
VALUES
  ('F', 'Facturas ordinarias', 'F-', (SELECT id FROM empresas_facturadoras LIMIT 1), 'ordinaria', 0, true),
  ('R', 'Rectificativas', 'R-', (SELECT id FROM empresas_facturadoras LIMIT 1), 'rectificativa', 0, true)
ON CONFLICT (codigo) DO NOTHING;

-- Calendario laboral 2026 - festivos nacionales España
INSERT INTO calendario_laboral (fecha, descripcion) VALUES
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-06', 'Reyes'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Dia del Trabajo'),
  ('2026-08-15', 'Asuncion'),
  ('2026-10-12', 'Fiesta Nacional'),
  ('2026-11-02', 'Todos los Santos'),
  ('2026-12-07', 'Constitucion'),
  ('2026-12-08', 'Inmaculada'),
  ('2026-12-25', 'Navidad')
ON CONFLICT DO NOTHING;
