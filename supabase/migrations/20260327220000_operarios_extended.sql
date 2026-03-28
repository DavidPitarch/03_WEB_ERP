-- ─── MÓDULO OPERARIOS — Extensión completa de tabla ───────────────────────────
-- Añade campos del formulario completo de operarios (datos personales, bancarios,
-- fiscales, app, acceso intranet) y crea tabla de relación operarios_especialidades.

-- ── Extender operarios con campos adicionales ──────────────────────────────────

ALTER TABLE operarios
  -- Datos personales adicionales
  ADD COLUMN IF NOT EXISTS razon_social          TEXT,
  ADD COLUMN IF NOT EXISTS direccion             TEXT,
  ADD COLUMN IF NOT EXISTS poblacion             TEXT,
  ADD COLUMN IF NOT EXISTS ciudad                TEXT,
  ADD COLUMN IF NOT EXISTS codigo_postal         VARCHAR(10),
  ADD COLUMN IF NOT EXISTS provincia             TEXT,
  ADD COLUMN IF NOT EXISTS telf2                 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fax                   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tipo_identificacion   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nif                   VARCHAR(30),
  ADD COLUMN IF NOT EXISTS persona_contacto      TEXT,
  -- Datos bancarios (IBAN desglosado + CCC)
  ADD COLUMN IF NOT EXISTS iban_1                VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_2                VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_3                VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_4                VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_5                VARCHAR(4),
  ADD COLUMN IF NOT EXISTS iban_6                VARCHAR(10),
  ADD COLUMN IF NOT EXISTS numero_entidad        VARCHAR(4),
  ADD COLUMN IF NOT EXISTS numero_oficina        VARCHAR(4),
  ADD COLUMN IF NOT EXISTS numero_control        VARCHAR(2),
  ADD COLUMN IF NOT EXISTS numero_cuenta         VARCHAR(10),
  -- Datos fiscales / facturación
  ADD COLUMN IF NOT EXISTS subcuenta_operario    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tipo_operario         TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nomina                NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS precio_hora           NUMERIC(10,2),
  -- Configuración financiera
  ADD COLUMN IF NOT EXISTS irpf                  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tipo_descuento        TEXT DEFAULT 'Desc',
  ADD COLUMN IF NOT EXISTS descuento_negociado   NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permitir_incrementos  BOOLEAN DEFAULT FALSE,
  -- Comunicaciones
  ADD COLUMN IF NOT EXISTS automatico_sms        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS automatico_email      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opcion_finaliza_visita BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supervisor            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bloquear_fotos        BOOLEAN DEFAULT FALSE,
  -- APP móvil
  ADD COLUMN IF NOT EXISTS usa_app_movil         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ocultar_baremo_app    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ocultar_precio_baremo BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fichaje_activo        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS horas_convenio_dia    NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS jornada_laboral       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS plataforma_pas        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS app_pwgs              BOOLEAN DEFAULT TRUE,
  -- Opciones generales
  ADD COLUMN IF NOT EXISTS preferente            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS establecer_iva        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS iva_operario          NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS puede_segunda_visita  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS genera_presupuestos   TEXT DEFAULT 'No genera',
  ADD COLUMN IF NOT EXISTS autoaprobado          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mostrar_datos_perito  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS observaciones         TEXT,
  -- Acceso intranet / app
  ADD COLUMN IF NOT EXISTS usuario_intranet      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contrasena_intranet   TEXT,
  ADD COLUMN IF NOT EXISTS email_aplicacion      VARCHAR(150),
  ADD COLUMN IF NOT EXISTS contrasena_email_app  TEXT,
  -- Foto
  ADD COLUMN IF NOT EXISTS foto_path             TEXT,
  -- Tipos de servicio (array de strings)
  ADD COLUMN IF NOT EXISTS tipos_servicio        TEXT[] DEFAULT '{}',
  -- Estado bloqueado (icono ⊘ en listado)
  ADD COLUMN IF NOT EXISTS bloqueado             BOOLEAN DEFAULT FALSE;

-- ── Tabla relación operarios ↔ especialidades ──────────────────────────────────

CREATE TABLE IF NOT EXISTS operarios_especialidades (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  operario_id     UUID        NOT NULL REFERENCES operarios(id) ON DELETE CASCADE,
  especialidad_id UUID        NOT NULL REFERENCES especialidades(id) ON DELETE CASCADE,
  es_principal    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (operario_id, especialidad_id)
);

CREATE INDEX IF NOT EXISTS idx_op_esp_operario     ON operarios_especialidades(operario_id);
CREATE INDEX IF NOT EXISTS idx_op_esp_especialidad ON operarios_especialidades(especialidad_id);

ALTER TABLE operarios_especialidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_esp_select" ON operarios_especialidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "op_esp_insert" ON operarios_especialidades
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "op_esp_update" ON operarios_especialidades
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "op_esp_delete" ON operarios_especialidades
  FOR DELETE TO authenticated USING (true);

-- ── Índice de búsqueda en operarios ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_operarios_nombre    ON operarios(nombre);
CREATE INDEX IF NOT EXISTS idx_operarios_activo    ON operarios(activo);
CREATE INDEX IF NOT EXISTS idx_operarios_cp        ON operarios(codigo_postal);
