-- Migration: 20260327230000_baremos_plantilla
-- Módulo de gestión de baremos (tarifas) para tipo Cliente, Operario y Proveedor.
-- Tablas independientes del sistema legacy `baremos` (presupuestos).

-- ─── Tipo de baremo ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE baremo_tipo AS ENUM ('Cliente', 'Operario', 'Proveedor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Tabla principal de baremos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS baremos_plantilla (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  tipo         baremo_tipo NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT baremos_plantilla_fechas_check CHECK (fecha_fin >= fecha_inicio)
);

CREATE OR REPLACE FUNCTION set_baremos_plantilla_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER baremos_plantilla_updated_at
  BEFORE UPDATE ON baremos_plantilla
  FOR EACH ROW EXECUTE FUNCTION set_baremos_plantilla_updated_at();

-- ─── Trabajos / líneas de precio ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS baremos_plantilla_trabajos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baremo_id         UUID NOT NULL REFERENCES baremos_plantilla(id) ON DELETE CASCADE,
  codigo            TEXT,
  codigo_relacion   TEXT,
  nombre            TEXT NOT NULL,
  precio_cliente    NUMERIC(10,2) DEFAULT NULL,   -- solo tipo Cliente
  precio_operario   NUMERIC(10,2) DEFAULT 0,
  precio_libre      BOOLEAN NOT NULL DEFAULT FALSE,
  solo_operario     BOOLEAN NOT NULL DEFAULT FALSE, -- solo tipo Cliente
  cantidad_fija     NUMERIC(10,2) DEFAULT 0,
  especialidad_id   UUID REFERENCES especialidades(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Asignación baremo ↔ compañías (tipo Cliente) ─────────────────────────────
CREATE TABLE IF NOT EXISTS baremos_plantilla_companias (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baremo_id    UUID NOT NULL REFERENCES baremos_plantilla(id) ON DELETE CASCADE,
  compania_id  UUID NOT NULL REFERENCES companias(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (baremo_id, compania_id)
);

-- ─── Asignación baremo ↔ operarios (tipo Operario) ────────────────────────────
CREATE TABLE IF NOT EXISTS baremos_plantilla_operarios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baremo_id    UUID NOT NULL REFERENCES baremos_plantilla(id) ON DELETE CASCADE,
  operario_id  UUID NOT NULL REFERENCES operarios(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (baremo_id, operario_id)
);

-- ─── Asignación compañía-específica a operario dentro de un baremo ────────────
CREATE TABLE IF NOT EXISTS baremos_plantilla_operarios_companias (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baremo_id    UUID NOT NULL REFERENCES baremos_plantilla(id) ON DELETE CASCADE,
  operario_id  UUID NOT NULL REFERENCES operarios(id) ON DELETE CASCADE,
  compania_id  UUID NOT NULL REFERENCES companias(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (baremo_id, operario_id, compania_id)
);

-- ─── Asignación baremo ↔ proveedores (tipo Proveedor) ─────────────────────────
CREATE TABLE IF NOT EXISTS baremos_plantilla_proveedores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baremo_id     UUID NOT NULL REFERENCES baremos_plantilla(id) ON DELETE CASCADE,
  proveedor_id  UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (baremo_id, proveedor_id)
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bplt_tipo          ON baremos_plantilla(tipo);
CREATE INDEX IF NOT EXISTS idx_bplt_fechas        ON baremos_plantilla(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_bplt_trab_baremo   ON baremos_plantilla_trabajos(baremo_id);
CREATE INDEX IF NOT EXISTS idx_bplt_trab_esp      ON baremos_plantilla_trabajos(especialidad_id)
  WHERE especialidad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bplt_comp_baremo   ON baremos_plantilla_companias(baremo_id);
CREATE INDEX IF NOT EXISTS idx_bplt_comp_cia      ON baremos_plantilla_companias(compania_id);
CREATE INDEX IF NOT EXISTS idx_bplt_oper_baremo   ON baremos_plantilla_operarios(baremo_id);
CREATE INDEX IF NOT EXISTS idx_bplt_oper_op       ON baremos_plantilla_operarios(operario_id);
CREATE INDEX IF NOT EXISTS idx_bplt_prov_baremo   ON baremos_plantilla_proveedores(baremo_id);
CREATE INDEX IF NOT EXISTS idx_bplt_prov_prov     ON baremos_plantilla_proveedores(proveedor_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE baremos_plantilla                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE baremos_plantilla_trabajos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE baremos_plantilla_companias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE baremos_plantilla_operarios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE baremos_plantilla_operarios_companias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE baremos_plantilla_proveedores           ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "bplt_select" ON baremos_plantilla FOR SELECT USING (true);
  CREATE POLICY "bplt_all" ON baremos_plantilla FOR ALL
    USING (get_my_role() IN ('admin','supervisor','tramitador','financiero'))
    WITH CHECK (get_my_role() IN ('admin','supervisor','tramitador','financiero'));

  CREATE POLICY "bplt_trab_select" ON baremos_plantilla_trabajos FOR SELECT USING (true);
  CREATE POLICY "bplt_trab_all" ON baremos_plantilla_trabajos FOR ALL
    USING (get_my_role() IN ('admin','supervisor','tramitador','financiero'))
    WITH CHECK (get_my_role() IN ('admin','supervisor','tramitador','financiero'));

  CREATE POLICY "bplt_comp_select" ON baremos_plantilla_companias FOR SELECT USING (true);
  CREATE POLICY "bplt_comp_all" ON baremos_plantilla_companias FOR ALL
    USING (get_my_role() IN ('admin','supervisor'))
    WITH CHECK (get_my_role() IN ('admin','supervisor'));

  CREATE POLICY "bplt_oper_select" ON baremos_plantilla_operarios FOR SELECT USING (true);
  CREATE POLICY "bplt_oper_all" ON baremos_plantilla_operarios FOR ALL
    USING (get_my_role() IN ('admin','supervisor'))
    WITH CHECK (get_my_role() IN ('admin','supervisor'));

  CREATE POLICY "bplt_oc_select" ON baremos_plantilla_operarios_companias FOR SELECT USING (true);
  CREATE POLICY "bplt_oc_all" ON baremos_plantilla_operarios_companias FOR ALL
    USING (get_my_role() IN ('admin','supervisor'))
    WITH CHECK (get_my_role() IN ('admin','supervisor'));

  CREATE POLICY "bplt_prov_select" ON baremos_plantilla_proveedores FOR SELECT USING (true);
  CREATE POLICY "bplt_prov_all" ON baremos_plantilla_proveedores FOR ALL
    USING (get_my_role() IN ('admin','supervisor','tramitador','financiero'))
    WITH CHECK (get_my_role() IN ('admin','supervisor','tramitador','financiero'));
EXCEPTION WHEN duplicate_object OR undefined_function THEN NULL;
END $$;
