-- EP-11: Portal de peritos (expert surveyor portal)
-- Migration: 00011_ep11_portal_peritos.sql

BEGIN;

-- ─── Tabla peritos ───
CREATE TABLE IF NOT EXISTS peritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  nombre text NOT NULL,
  apellidos text NOT NULL,
  telefono text,
  email text,
  colegiado_numero text,
  especialidades text[] DEFAULT '{}',
  compania_ids uuid[] DEFAULT '{}',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Add perito_id to expedientes ───
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS perito_id uuid REFERENCES peritos(id);

-- ─── Tabla dictamenes_periciales ───
CREATE TABLE IF NOT EXISTS dictamenes_periciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id uuid NOT NULL REFERENCES expedientes(id),
  perito_id uuid NOT NULL REFERENCES peritos(id),
  numero_dictamen text NOT NULL UNIQUE,
  fecha_inspeccion date,
  tipo_dano text,
  causa_dano text,
  valoracion_danos numeric(12,2) DEFAULT 0,
  valoracion_reparacion numeric(12,2) DEFAULT 0,
  cobertura_aplicable text,
  observaciones text,
  recomendaciones text,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'emitido', 'revisado', 'aceptado', 'rechazado')),
  pdf_storage_path text,
  emitido_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Tabla evidencias_dictamen ───
CREATE TABLE IF NOT EXISTS evidencias_dictamen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dictamen_id uuid NOT NULL REFERENCES dictamenes_periciales(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nombre_original text NOT NULL,
  clasificacion text NOT NULL DEFAULT 'contexto'
    CHECK (clasificacion IN ('dano', 'causa', 'contexto', 'detalle')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_dictamenes_expediente ON dictamenes_periciales(expediente_id);
CREATE INDEX IF NOT EXISTS idx_dictamenes_perito ON dictamenes_periciales(perito_id);
CREATE INDEX IF NOT EXISTS idx_dictamenes_estado ON dictamenes_periciales(estado);
CREATE INDEX IF NOT EXISTS idx_expedientes_perito ON expedientes(perito_id);

-- ─── View: v_expedientes_perito ───
CREATE OR REPLACE VIEW v_expedientes_perito AS
SELECT
  e.id,
  e.numero_expediente,
  e.estado,
  e.tipo_siniestro,
  e.descripcion,
  e.direccion_siniestro,
  e.codigo_postal,
  e.localidad,
  e.provincia,
  e.fecha_encargo,
  e.fecha_limite_sla,
  e.prioridad,
  e.perito_id,
  e.compania_id,
  a.nombre AS asegurado_nombre,
  a.apellidos AS asegurado_apellidos,
  a.telefono AS asegurado_telefono,
  c.nombre AS compania_nombre,
  EXISTS (
    SELECT 1 FROM dictamenes_periciales d WHERE d.expediente_id = e.id
  ) AS has_dictamen
FROM expedientes e
LEFT JOIN asegurados a ON a.id = e.asegurado_id
LEFT JOIN companias c ON c.id = e.compania_id
WHERE e.perito_id IS NOT NULL;

-- ─── RLS ───
ALTER TABLE peritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictamenes_periciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias_dictamen ENABLE ROW LEVEL SECURITY;

-- Peritos: can see own row
CREATE POLICY peritos_own ON peritos
  FOR ALL USING (user_id = auth.uid());

-- Admin/service can see all peritos
CREATE POLICY peritos_admin ON peritos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'supervisor')
    )
  );

-- Dictamenes: perito can manage own
CREATE POLICY dictamenes_perito_own ON dictamenes_periciales
  FOR ALL USING (
    perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
  );

-- Dictamenes: admin can see all
CREATE POLICY dictamenes_admin ON dictamenes_periciales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'supervisor')
    )
  );

-- Evidencias: perito can manage own via dictamen
CREATE POLICY evidencias_perito_own ON evidencias_dictamen
  FOR ALL USING (
    dictamen_id IN (
      SELECT id FROM dictamenes_periciales
      WHERE perito_id IN (SELECT id FROM peritos WHERE user_id = auth.uid())
    )
  );

-- Evidencias: admin can see all
CREATE POLICY evidencias_admin ON evidencias_dictamen
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'supervisor')
    )
  );

-- ─── Enable realtime ───
ALTER PUBLICATION supabase_realtime ADD TABLE dictamenes_periciales;

COMMIT;
