-- Migration 00007: EP-06 (Task Manager, Alerts, SLA) & EP-07 (Baremos & Presupuestos Enhancement)
-- =============================================================================

-- ============================================================
-- EP-06: Extend tareas_internas
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tareas_internas' AND column_name='estado') THEN
    ALTER TABLE tareas_internas ADD COLUMN estado VARCHAR(30) DEFAULT 'pendiente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tareas_internas' AND column_name='fecha_pospuesta') THEN
    ALTER TABLE tareas_internas ADD COLUMN fecha_pospuesta TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tareas_internas' AND column_name='motivo_posposicion') THEN
    ALTER TABLE tareas_internas ADD COLUMN motivo_posposicion TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tareas_internas' AND column_name='resolucion') THEN
    ALTER TABLE tareas_internas ADD COLUMN resolucion TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tareas_internas' AND column_name='resuelta_por') THEN
    ALTER TABLE tareas_internas ADD COLUMN resuelta_por UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tareas_internas' AND column_name='resuelta_at') THEN
    ALTER TABLE tareas_internas ADD COLUMN resuelta_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tareas_internas' AND column_name='updated_at') THEN
    ALTER TABLE tareas_internas ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================
-- EP-06: comentarios_tarea
-- ============================================================
CREATE TABLE IF NOT EXISTS comentarios_tarea (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas_internas(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id),
  contenido TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EP-06: alertas
-- ============================================================
CREATE TABLE IF NOT EXISTS alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(300) NOT NULL,
  mensaje TEXT,
  expediente_id UUID REFERENCES expedientes(id),
  tarea_id UUID REFERENCES tareas_internas(id),
  prioridad prioridad DEFAULT 'media',
  estado VARCHAR(30) DEFAULT 'activa',
  pospuesta_hasta TIMESTAMPTZ,
  destinatario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resuelta_at TIMESTAMPTZ
);

-- ============================================================
-- EP-06: sla_pausas
-- ============================================================
CREATE TABLE IF NOT EXISTS sla_pausas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id),
  estado_pausa expediente_estado NOT NULL,
  inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fin TIMESTAMPTZ,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EP-06: Add fecha_revision_pendiente to expedientes
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expedientes' AND column_name='fecha_revision_pendiente') THEN
    ALTER TABLE expedientes ADD COLUMN fecha_revision_pendiente TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================
-- EP-06: calendario_laboral
-- ============================================================
CREATE TABLE IF NOT EXISTS calendario_laboral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  tipo VARCHAR(30) NOT NULL,
  descripcion VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EP-07: Extend partidas_baremo
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidas_baremo' AND column_name='especialidad') THEN
    ALTER TABLE partidas_baremo ADD COLUMN especialidad VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidas_baremo' AND column_name='precio_operario') THEN
    ALTER TABLE partidas_baremo ADD COLUMN precio_operario NUMERIC(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidas_baremo' AND column_name='activa') THEN
    ALTER TABLE partidas_baremo ADD COLUMN activa BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- ============================================================
-- EP-07: Extend baremos
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='baremos' AND column_name='tipo') THEN
    ALTER TABLE baremos ADD COLUMN tipo VARCHAR(30) DEFAULT 'compania';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='baremos' AND column_name='operario_id') THEN
    ALTER TABLE baremos ADD COLUMN operario_id UUID REFERENCES operarios(id);
  END IF;
END $$;

-- ============================================================
-- EP-07: Extend lineas_presupuesto
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lineas_presupuesto' AND column_name='precio_operario') THEN
    ALTER TABLE lineas_presupuesto ADD COLUMN precio_operario NUMERIC(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lineas_presupuesto' AND column_name='descuento_porcentaje') THEN
    ALTER TABLE lineas_presupuesto ADD COLUMN descuento_porcentaje NUMERIC(5,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lineas_presupuesto' AND column_name='iva_porcentaje') THEN
    ALTER TABLE lineas_presupuesto ADD COLUMN iva_porcentaje NUMERIC(5,2) DEFAULT 21;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lineas_presupuesto' AND column_name='subtotal') THEN
    ALTER TABLE lineas_presupuesto ADD COLUMN subtotal NUMERIC(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lineas_presupuesto' AND column_name='parte_id') THEN
    ALTER TABLE lineas_presupuesto ADD COLUMN parte_id UUID REFERENCES partes_operario(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lineas_presupuesto' AND column_name='expediente_id') THEN
    ALTER TABLE lineas_presupuesto ADD COLUMN expediente_id UUID REFERENCES expedientes(id);
  END IF;
END $$;

-- ============================================================
-- EP-07: Extend presupuestos
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='presupuestos' AND column_name='parte_id') THEN
    ALTER TABLE presupuestos ADD COLUMN parte_id UUID REFERENCES partes_operario(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='presupuestos' AND column_name='margen_previsto') THEN
    ALTER TABLE presupuestos ADD COLUMN margen_previsto NUMERIC(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='presupuestos' AND column_name='coste_estimado') THEN
    ALTER TABLE presupuestos ADD COLUMN coste_estimado NUMERIC(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='presupuestos' AND column_name='ingreso_estimado') THEN
    ALTER TABLE presupuestos ADD COLUMN ingreso_estimado NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- Views
-- ============================================================

CREATE OR REPLACE VIEW v_alertas_activas AS
SELECT
  a.*,
  e.numero_expediente,
  e.direccion_siniestro,
  t.titulo AS tarea_titulo,
  t.fecha_limite AS tarea_fecha_limite
FROM alertas a
LEFT JOIN expedientes e ON e.id = a.expediente_id
LEFT JOIN tareas_internas t ON t.id = a.tarea_id
WHERE a.estado = 'activa'
   OR (a.estado = 'pospuesta' AND a.pospuesta_hasta <= NOW());

CREATE OR REPLACE VIEW v_tareas_dashboard AS
SELECT
  ti.*,
  e.numero_expediente,
  (ti.fecha_limite IS NOT NULL AND ti.fecha_limite < NOW() AND ti.completada = false) AS is_vencida
FROM tareas_internas ti
LEFT JOIN expedientes e ON e.id = ti.expediente_id;

CREATE OR REPLACE VIEW v_presupuesto_margen AS
SELECT
  p.id,
  p.expediente_id,
  p.numero,
  p.estado,
  p.ingreso_estimado,
  p.coste_estimado,
  (p.ingreso_estimado - p.coste_estimado) AS margen,
  p.importe_total,
  p.created_at
FROM presupuestos p;

-- ============================================================
-- Indices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_alertas_destinatario_estado ON alertas(destinatario_id, estado);
CREATE INDEX IF NOT EXISTS idx_alertas_estado ON alertas(estado);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas_internas(estado) WHERE completada = false;
CREATE INDEX IF NOT EXISTS idx_tareas_asignado ON tareas_internas(asignado_a) WHERE completada = false;
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_limite ON tareas_internas(fecha_limite) WHERE completada = false;
CREATE INDEX IF NOT EXISTS idx_partidas_baremo_especialidad ON partidas_baremo(especialidad);
CREATE INDEX IF NOT EXISTS idx_sla_pausas_expediente ON sla_pausas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_tarea ON comentarios_tarea(tarea_id);
CREATE INDEX IF NOT EXISTS idx_lineas_presupuesto_expediente ON lineas_presupuesto(expediente_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE comentarios_tarea ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_pausas ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendario_laboral ENABLE ROW LEVEL SECURITY;

-- comentarios_tarea: staff read/write
CREATE POLICY "Staff can read comentarios_tarea"
  ON comentarios_tarea FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can insert comentarios_tarea"
  ON comentarios_tarea FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Staff can update comentarios_tarea"
  ON comentarios_tarea FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can delete comentarios_tarea"
  ON comentarios_tarea FOR DELETE
  USING (auth.role() = 'authenticated');

-- alertas: staff read/write
CREATE POLICY "Staff can read alertas"
  ON alertas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can insert alertas"
  ON alertas FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Staff can update alertas"
  ON alertas FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can delete alertas"
  ON alertas FOR DELETE
  USING (auth.role() = 'authenticated');

-- calendario_laboral: service role and staff can read
CREATE POLICY "Staff can read calendario_laboral"
  ON calendario_laboral FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage calendario_laboral"
  ON calendario_laboral FOR ALL
  USING (auth.role() = 'service_role');

-- sla_pausas: staff can read
CREATE POLICY "Staff can read sla_pausas"
  ON sla_pausas FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- Realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE alertas, comentarios_tarea;
