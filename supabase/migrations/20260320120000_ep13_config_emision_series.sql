-- Migration: 20260320120000_ep13_config_emision_series.sql
-- Ep-13: Submódulo "Series de Facturación y Configuración de Emisión"
-- Extiende series_facturacion existente y añade reglas, asignaciones,
-- cuentas bancarias, config. de emisión e historial de versiones.

BEGIN;

-- ============================================================================
-- 1. REGLAS DE NUMERACIÓN
--    Plantillas reutilizables de formato de número de documento.
--    empresa_facturadora_id nullable → regla global compartida.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reglas_numeracion (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_facturadora_id  UUID        REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  nombre                  VARCHAR(100) NOT NULL,
  descripcion             TEXT,
  -- Resultado: {prefijo}{sep1}{anio}{sep2}{contador_con_padding}
  separador_prefijo       VARCHAR(5)  NOT NULL DEFAULT '-',
  separador_anio          VARCHAR(5)  NOT NULL DEFAULT '-',
  incluir_anio            BOOLEAN     NOT NULL DEFAULT true,
  formato_anio            VARCHAR(4)  NOT NULL DEFAULT 'YYYY'
                            CHECK (formato_anio IN ('YYYY', 'YY')),
  longitud_contador       SMALLINT    NOT NULL DEFAULT 5
                            CHECK (longitud_contador BETWEEN 1 AND 9),
  reset_anual             BOOLEAN     NOT NULL DEFAULT true,
  activa                  BOOLEAN     NOT NULL DEFAULT true,
  created_by              UUID        REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_facturadora_id, nombre)
);

-- ============================================================================
-- 2. EXTENSIÓN DE series_facturacion
--    Añade columnas nuevas manteniendo compatibilidad hacia atrás.
--    IMPORTANTE: se elimina el UNIQUE simple en código y se añade
--    una restricción compuesta (código + empresa + tipo + ejercicio).
-- ============================================================================

-- 2a. Eliminar UNIQUE columnar legacy en codigo (suele llamarse series_facturacion_codigo_key)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'series_facturacion_codigo_key'
      AND conrelid = 'series_facturacion'::regclass
  ) THEN
    ALTER TABLE series_facturacion DROP CONSTRAINT series_facturacion_codigo_key;
  END IF;
END $$;

-- 2b. Nuevas columnas (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'tipo_documento') THEN
    ALTER TABLE series_facturacion ADD COLUMN tipo_documento VARCHAR(30)
      CHECK (tipo_documento IN ('factura','factura_simplificada','autofactura','abono','rectificativa'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'tipo_tercero') THEN
    ALTER TABLE series_facturacion ADD COLUMN tipo_tercero VARCHAR(30) DEFAULT 'cualquiera'
      CHECK (tipo_tercero IN ('compania','cliente_final','operario_autonomo','proveedor','grupo_empresa','cualquiera'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'flujo_origen') THEN
    ALTER TABLE series_facturacion ADD COLUMN flujo_origen VARCHAR(30) DEFAULT 'cualquiera'
      CHECK (flujo_origen IN ('expediente','videoperitacion','manual','subcontrata','cualquiera'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'regla_numeracion_id') THEN
    ALTER TABLE series_facturacion ADD COLUMN regla_numeracion_id UUID REFERENCES reglas_numeracion(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'forma_pago_default') THEN
    ALTER TABLE series_facturacion ADD COLUMN forma_pago_default VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'vigencia_desde') THEN
    ALTER TABLE series_facturacion ADD COLUMN vigencia_desde DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'vigencia_hasta') THEN
    ALTER TABLE series_facturacion ADD COLUMN vigencia_hasta DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'ejercicio_fiscal') THEN
    ALTER TABLE series_facturacion ADD COLUMN ejercicio_fiscal VARCHAR(4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'version') THEN
    ALTER TABLE series_facturacion ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'notas') THEN
    ALTER TABLE series_facturacion ADD COLUMN notas TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'created_by') THEN
    ALTER TABLE series_facturacion ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'updated_by') THEN
    ALTER TABLE series_facturacion ADD COLUMN updated_by UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'updated_at') THEN
    ALTER TABLE series_facturacion ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- 2c. Migrar tipo_documento desde columna tipo legacy (retrocompatible)
UPDATE series_facturacion
SET tipo_documento = CASE tipo
  WHEN 'ordinaria'    THEN 'factura'
  WHEN 'rectificativa' THEN 'rectificativa'
  WHEN 'abono'        THEN 'abono'
  ELSE 'factura'
END
WHERE tipo_documento IS NULL;

ALTER TABLE series_facturacion ALTER COLUMN tipo_documento SET NOT NULL;

-- 2d. Restricción unicidad compuesta: mismo código + empresa + tipo + ejercicio no puede estar duplicado
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_serie_codigo_empresa_tipo_ejercicio'
      AND conrelid = 'series_facturacion'::regclass
  ) THEN
    ALTER TABLE series_facturacion ADD CONSTRAINT uq_serie_codigo_empresa_tipo_ejercicio
      UNIQUE NULLS NOT DISTINCT (codigo, empresa_facturadora_id, tipo_documento, ejercicio_fiscal);
  END IF;
END $$;

-- ============================================================================
-- 3. CUENTAS BANCARIAS POR EMPRESA
-- ============================================================================
CREATE TABLE IF NOT EXISTS cuentas_bancarias_empresa (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_facturadora_id  UUID        NOT NULL REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  iban                    VARCHAR(34) NOT NULL,
  bic_swift               VARCHAR(11),
  nombre_banco            VARCHAR(100) NOT NULL,
  titular                 VARCHAR(200) NOT NULL,
  moneda                  VARCHAR(3)  NOT NULL DEFAULT 'EUR',
  es_principal            BOOLEAN     NOT NULL DEFAULT false,
  activa                  BOOLEAN     NOT NULL DEFAULT true,
  created_by              UUID        REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_iban_empresa UNIQUE (iban, empresa_facturadora_id)
);

-- Solo una cuenta principal activa por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_cuenta_principal_unica
  ON cuentas_bancarias_empresa (empresa_facturadora_id)
  WHERE es_principal = true AND activa = true;

-- 3b. Añadir FK cuenta_bancaria_id a series_facturacion
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'series_facturacion' AND column_name = 'cuenta_bancaria_id') THEN
    ALTER TABLE series_facturacion ADD COLUMN cuenta_bancaria_id UUID REFERENCES cuentas_bancarias_empresa(id);
  END IF;
END $$;

-- ============================================================================
-- 4. ASIGNACIONES DE SERIE
--    Reglas de resolución automática: dado un contexto de emisión,
--    determina qué serie se debe usar.
-- ============================================================================
CREATE TABLE IF NOT EXISTS asignaciones_serie (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_facturadora_id  UUID        NOT NULL REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  serie_id                UUID        NOT NULL REFERENCES series_facturacion(id) ON DELETE RESTRICT,

  -- Criterios de matching (NULL = comodín / cualquiera)
  tipo_documento          VARCHAR(30) NOT NULL
    CHECK (tipo_documento IN ('factura','factura_simplificada','autofactura','abono','rectificativa')),
  tipo_tercero            VARCHAR(30)
    CHECK (tipo_tercero IN ('compania','cliente_final','operario_autonomo','proveedor','grupo_empresa')),
  flujo_origen            VARCHAR(30)
    CHECK (flujo_origen IN ('expediente','videoperitacion','manual','subcontrata')),
  compania_id             UUID        REFERENCES companias(id),  -- regla específica de compañía

  -- Prioridad: menor número = mayor prioridad
  prioridad               SMALLINT    NOT NULL DEFAULT 100
                            CHECK (prioridad BETWEEN 1 AND 999),

  activa                  BOOLEAN     NOT NULL DEFAULT true,
  notas                   TEXT,
  created_by              UUID        REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No dos asignaciones activas con los mismos criterios exactos
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_asignacion_activa
  ON asignaciones_serie (
    empresa_facturadora_id,
    tipo_documento,
    COALESCE(tipo_tercero, ''),
    COALESCE(flujo_origen, ''),
    COALESCE(compania_id::TEXT, '')
  )
  WHERE activa = true;

-- Índice para resolver asignación eficientemente
CREATE INDEX IF NOT EXISTS idx_asignacion_lookup
  ON asignaciones_serie (empresa_facturadora_id, tipo_documento)
  WHERE activa = true;

-- ============================================================================
-- 5. CONFIGURACIÓN DE EMISIÓN POR EMPRESA
-- ============================================================================
CREATE TABLE IF NOT EXISTS config_emision_empresa (
  id                              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_facturadora_id          UUID        NOT NULL UNIQUE
                                    REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,

  -- Generación de documento
  generar_pdf                     BOOLEAN     NOT NULL DEFAULT true,
  firma_digital                   BOOLEAN     NOT NULL DEFAULT false,
  sistema_fiscal                  VARCHAR(20) NOT NULL DEFAULT 'ninguno'
    CHECK (sistema_fiscal IN ('ninguno','ticketbai','facturae','verifactu')),

  -- Envío automático
  envio_automatico                BOOLEAN     NOT NULL DEFAULT false,
  canal_envio_default             VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (canal_envio_default IN ('email','api','portal','manual')),
  email_remitente                 VARCHAR(200),
  cc_contabilidad                 VARCHAR(200),

  -- Defaults financieros
  dias_vencimiento                SMALLINT    NOT NULL DEFAULT 30,
  iva_porcentaje_default          NUMERIC(5,2) NOT NULL DEFAULT 21.00,
  recargo_equivalencia            NUMERIC(5,2) NOT NULL DEFAULT 0.00,

  -- Cuenta bancaria principal (puede sobreescribirse por serie)
  cuenta_bancaria_id              UUID        REFERENCES cuentas_bancarias_empresa(id),

  -- Apariencia del PDF
  plantilla_pdf                   VARCHAR(50) NOT NULL DEFAULT 'default',
  logo_storage_path               TEXT,
  pie_factura                     TEXT,
  notas_legales                   TEXT,

  -- Reglas documentales
  abono_referencia_obligatoria    BOOLEAN     NOT NULL DEFAULT true,
  autofactura_requiere_aceptacion BOOLEAN     NOT NULL DEFAULT true,

  -- Versionado para concurrencia optimista
  version                         INTEGER     NOT NULL DEFAULT 1,
  updated_by                      UUID        REFERENCES auth.users(id),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. HISTORIAL DE VERSIONES
-- ============================================================================

-- 6a. Historial de series_facturacion
CREATE TABLE IF NOT EXISTS series_facturacion_historial (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  serie_id         UUID        NOT NULL REFERENCES series_facturacion(id) ON DELETE CASCADE,
  version_numero   INTEGER     NOT NULL,
  datos_anteriores JSONB       NOT NULL,
  datos_nuevos     JSONB       NOT NULL,
  motivo_cambio    TEXT,
  actor_id         UUID        REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (serie_id, version_numero)
);

CREATE INDEX IF NOT EXISTS idx_historial_serie_version
  ON series_facturacion_historial (serie_id, version_numero DESC);

-- 6b. Historial de config_emision_empresa
CREATE TABLE IF NOT EXISTS config_emision_historial (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_facturadora_id  UUID        NOT NULL,
  version_numero          INTEGER     NOT NULL,
  datos_anteriores        JSONB       NOT NULL,
  datos_nuevos            JSONB       NOT NULL,
  motivo_cambio           TEXT,
  actor_id                UUID        REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_config_empresa
  ON config_emision_historial (empresa_facturadora_id, version_numero DESC);

-- ============================================================================
-- 7. FUNCIÓN: Resolver serie automáticamente
--    Busca la asignación más específica activa para el contexto dado.
-- ============================================================================
CREATE OR REPLACE FUNCTION resolver_serie(
  p_empresa_id    UUID,
  p_tipo_doc      TEXT,
  p_tipo_tercero  TEXT DEFAULT NULL,
  p_flujo         TEXT DEFAULT NULL,
  p_compania_id   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT a.serie_id
  FROM asignaciones_serie a
  JOIN series_facturacion s ON s.id = a.serie_id
  WHERE a.empresa_facturadora_id = p_empresa_id
    AND a.tipo_documento         = p_tipo_doc
    AND a.activa                 = true
    AND s.activa                 = true
    AND (a.tipo_tercero  IS NULL OR a.tipo_tercero  = p_tipo_tercero)
    AND (a.flujo_origen  IS NULL OR a.flujo_origen  = p_flujo)
    AND (a.compania_id   IS NULL OR a.compania_id   = p_compania_id)
    AND (s.vigencia_desde IS NULL OR s.vigencia_desde <= CURRENT_DATE)
    AND (s.vigencia_hasta IS NULL OR s.vigencia_hasta >= CURRENT_DATE)
  ORDER BY
    a.prioridad ASC,
    -- Regla más específica gana (más criterios NOT NULL = más específica)
    (CASE WHEN a.compania_id   IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN a.tipo_tercero  IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN a.flujo_origen  IS NOT NULL THEN 1 ELSE 0 END) DESC
  LIMIT 1;
$$;

-- ============================================================================
-- 8. FUNCIÓN: Generar siguiente número de factura (atómica)
--    Bloquea la fila de serie para evitar duplicados en concurrencia.
-- ============================================================================
CREATE OR REPLACE FUNCTION siguiente_numero_factura(
  p_serie_id  UUID,
  p_version   INTEGER
)
RETURNS TABLE(numero TEXT, nuevo_contador INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_serie    series_facturacion%ROWTYPE;
  v_regla    reglas_numeracion%ROWTYPE;
  v_anio     TEXT;
  v_contador INTEGER;
  v_numero   TEXT;
BEGIN
  -- Bloqueo pesimista en la fila de la serie
  SELECT * INTO v_serie FROM series_facturacion
  WHERE id = p_serie_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERIE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_serie.version != p_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_serie.activa THEN
    RAISE EXCEPTION 'SERIE_INACTIVA' USING ERRCODE = 'P0003';
  END IF;
  IF v_serie.vigencia_hasta IS NOT NULL AND v_serie.vigencia_hasta < CURRENT_DATE THEN
    RAISE EXCEPTION 'SERIE_CADUCADA' USING ERRCODE = 'P0005';
  END IF;

  -- Obtener regla de numeración si está configurada
  IF v_serie.regla_numeracion_id IS NOT NULL THEN
    SELECT * INTO v_regla FROM reglas_numeracion WHERE id = v_serie.regla_numeracion_id;
  END IF;

  v_contador := v_serie.contador_actual + 1;
  v_anio     := to_char(CURRENT_DATE,
    CASE WHEN v_regla.formato_anio = 'YY' THEN 'YY' ELSE 'YYYY' END);

  -- Construir número según regla (o defaults si no hay regla)
  IF COALESCE(v_regla.incluir_anio, true) THEN
    v_numero := v_serie.prefijo
      || COALESCE(v_regla.separador_prefijo, '-')
      || v_anio
      || COALESCE(v_regla.separador_anio, '-')
      || lpad(v_contador::TEXT, COALESCE(v_regla.longitud_contador, 5), '0');
  ELSE
    v_numero := v_serie.prefijo
      || COALESCE(v_regla.separador_prefijo, '-')
      || lpad(v_contador::TEXT, COALESCE(v_regla.longitud_contador, 5), '0');
  END IF;

  -- Guardia de unicidad global (defensa en profundidad)
  IF EXISTS (SELECT 1 FROM facturas WHERE numero_factura = v_numero) THEN
    RAISE EXCEPTION 'NUMERO_DUPLICADO:%', v_numero USING ERRCODE = 'P0004';
  END IF;

  -- Actualizar contador y versión atómicamente
  UPDATE series_facturacion
  SET contador_actual = v_contador,
      version        = version + 1,
      updated_at     = now()
  WHERE id = p_serie_id;

  RETURN QUERY SELECT v_numero, v_contador;
END;
$$;

-- ============================================================================
-- 9. TRIGGER: Auditoría automática de cambios en series_facturacion
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_fn_series_historial()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
    INSERT INTO series_facturacion_historial
      (serie_id, version_numero, datos_anteriores, datos_nuevos, actor_id)
    VALUES (
      OLD.id,
      OLD.version,
      to_jsonb(OLD) - 'updated_at',
      to_jsonb(NEW) - 'updated_at',
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_series_facturacion_audit ON series_facturacion;
CREATE TRIGGER trg_series_facturacion_audit
  AFTER UPDATE ON series_facturacion
  FOR EACH ROW EXECUTE FUNCTION trg_fn_series_historial();

-- ============================================================================
-- 10. ÍNDICES ADICIONALES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_series_empresa_tipodoc
  ON series_facturacion (empresa_facturadora_id, tipo_documento)
  WHERE activa = true;

CREATE INDEX IF NOT EXISTS idx_series_vigencia
  ON series_facturacion (vigencia_desde, vigencia_hasta)
  WHERE activa = true;

CREATE INDEX IF NOT EXISTS idx_cuentas_empresa_activa
  ON cuentas_bancarias_empresa (empresa_facturadora_id)
  WHERE activa = true;

CREATE INDEX IF NOT EXISTS idx_reglas_empresa_activa
  ON reglas_numeracion (empresa_facturadora_id)
  WHERE activa = true;

-- ============================================================================
-- 11. RLS
-- ============================================================================

-- reglas_numeracion
ALTER TABLE reglas_numeracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_reglas_numeracion" ON reglas_numeracion
  FOR SELECT
  USING (public.user_roles() && ARRAY['admin','supervisor','financiero','tramitador','direccion']);

CREATE POLICY "admin_financiero_manage_reglas_numeracion" ON reglas_numeracion
  FOR ALL
  USING  (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- cuentas_bancarias_empresa
ALTER TABLE cuentas_bancarias_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_cuentas_bancarias" ON cuentas_bancarias_empresa
  FOR SELECT
  USING (public.user_roles() && ARRAY['admin','supervisor','financiero','tramitador','direccion']);

CREATE POLICY "admin_financiero_manage_cuentas_bancarias" ON cuentas_bancarias_empresa
  FOR ALL
  USING  (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- asignaciones_serie
ALTER TABLE asignaciones_serie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_asignaciones_serie" ON asignaciones_serie
  FOR SELECT
  USING (public.user_roles() && ARRAY['admin','supervisor','financiero','tramitador','direccion']);

CREATE POLICY "admin_financiero_manage_asignaciones_serie" ON asignaciones_serie
  FOR ALL
  USING  (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- config_emision_empresa
ALTER TABLE config_emision_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_config_emision" ON config_emision_empresa
  FOR SELECT
  USING (public.user_roles() && ARRAY['admin','supervisor','financiero','direccion']);

CREATE POLICY "admin_financiero_manage_config_emision" ON config_emision_empresa
  FOR ALL
  USING  (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- historial: solo lectura para staff, escritura solo via trigger/función
ALTER TABLE series_facturacion_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_series_historial" ON series_facturacion_historial
  FOR SELECT
  USING (public.user_roles() && ARRAY['admin','supervisor','financiero','direccion']);

ALTER TABLE config_emision_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_config_emision_historial" ON config_emision_historial
  FOR SELECT
  USING (public.user_roles() && ARRAY['admin','supervisor','financiero','direccion']);

COMMIT;
