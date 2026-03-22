-- Migration: 20260319140000_ep13_bancos_cobro.sql
-- Módulo "Bancos y Cobro" — Sprint 1
-- Tablas: cuentas_bancarias, perfiles_cobro, contadores_referencias,
--         remesas_cobro, referencias_cobro, movimientos_bancarios,
--         apuntes_conciliacion, reglas_conciliacion, links_pago
-- Extensión: facturas (cuenta_cobro_id, perfil_cobro_id, referencia_cobro_id)
--            pagos (movimiento_bancario_id)

SET search_path = public;

-- ============================================================================
-- 1. cuentas_bancarias
--    Una cuenta bancaria por empresa facturadora. Una sola puede ser principal.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id       UUID NOT NULL REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  alias            VARCHAR(100) NOT NULL,
  entidad          VARCHAR(100) NOT NULL,
  iban             VARCHAR(34)  NOT NULL,
  bic_swift        VARCHAR(11),
  moneda           CHAR(3)      NOT NULL DEFAULT 'EUR',
  es_principal     BOOLEAN      NOT NULL DEFAULT false,
  activa           BOOLEAN      NOT NULL DEFAULT true,
  -- Metadatos para futuras integraciones bancarias (conector plug-in)
  connector_id     VARCHAR(50),                -- NULL = sin integración (MVP)
  connector_cfg    JSONB,                      -- cifrado en reposo por Supabase
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW(),
  CONSTRAINT uq_cuenta_iban UNIQUE (empresa_id, iban)
);

-- Solo una cuenta principal activa por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_cuenta_principal
  ON cuentas_bancarias(empresa_id)
  WHERE es_principal = true AND activa = true;

-- ============================================================================
-- 2. perfiles_cobro
--    Condiciones de pago negociadas con cada compañía aseguradora.
-- ============================================================================
CREATE TABLE IF NOT EXISTS perfiles_cobro (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compania_id         UUID NOT NULL REFERENCES companias(id),
  empresa_id          UUID NOT NULL REFERENCES empresas_facturadoras(id),
  cuenta_bancaria_id  UUID REFERENCES cuentas_bancarias(id),
  forma_pago          VARCHAR(30) NOT NULL DEFAULT 'transferencia'
    CHECK (forma_pago IN ('transferencia','domiciliacion','cheque','confirming','otro')),
  dias_pago           INT  NOT NULL DEFAULT 30 CHECK (dias_pago >= 0),
  -- Nulo = calcular desde fecha emisión; valor = forzar ese día del mes siguiente
  dia_fijo_mes        INT  CHECK (dia_fijo_mes BETWEEN 1 AND 31),
  descuento_pp_pct    NUMERIC(5,2) DEFAULT 0 CHECK (descuento_pp_pct >= 0),
  recargo_mora_pct    NUMERIC(5,2) DEFAULT 0 CHECK (recargo_mora_pct >= 0),
  referencia_mandato  VARCHAR(35),             -- Mandato SEPA (domiciliación)
  activo              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_perfil_cobro UNIQUE (compania_id, empresa_id)
);

-- ============================================================================
-- 3. contadores_referencias
--    Contador atómico por empresa para generar referencias de cobro únicas.
--    Patrón idéntico a series_facturacion.contador_actual.
-- ============================================================================
CREATE TABLE IF NOT EXISTS contadores_referencias (
  empresa_id  UUID PRIMARY KEY REFERENCES empresas_facturadoras(id) ON DELETE CASCADE,
  contador    INT  NOT NULL DEFAULT 0
);

-- ============================================================================
-- 4. remesas_cobro
--    Agrupación de múltiples facturas en un único envío (SEPA, confirming…).
--    Debe existir antes que referencias_cobro (FK).
-- ============================================================================
CREATE TABLE IF NOT EXISTS remesas_cobro (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id       UUID NOT NULL REFERENCES empresas_facturadoras(id),
  cuenta_origen_id UUID REFERENCES cuentas_bancarias(id),
  nombre           VARCHAR(200) NOT NULL,
  tipo             VARCHAR(30)  NOT NULL DEFAULT 'transferencia_masiva'
    CHECK (tipo IN ('sepa_dd','confirming','transferencia_masiva')),
  importe_total    NUMERIC(12,2) NOT NULL DEFAULT 0,
  num_operaciones  INT           NOT NULL DEFAULT 0,
  estado           VARCHAR(30)   NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','generada','enviada','procesada','parcial','rechazada')),
  fichero_url      TEXT,
  fecha_cargo      DATE,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  enviada_at       TIMESTAMPTZ,
  procesada_at     TIMESTAMPTZ
);

-- ============================================================================
-- 5. referencias_cobro
--    Una referencia por factura (o remesa). Identificador del cobro esperado.
-- ============================================================================
CREATE TABLE IF NOT EXISTS referencias_cobro (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Origen: XOR entre factura_id y remesa_id
  factura_id        UUID REFERENCES facturas(id),
  remesa_id         UUID REFERENCES remesas_cobro(id),
  empresa_id        UUID NOT NULL REFERENCES empresas_facturadoras(id),
  compania_id       UUID NOT NULL REFERENCES companias(id),
  referencia        VARCHAR(50)   NOT NULL,
  concepto          VARCHAR(500)  NOT NULL,
  importe           NUMERIC(12,2) NOT NULL,
  moneda            CHAR(3)       NOT NULL DEFAULT 'EUR',
  fecha_vencimiento DATE          NOT NULL,
  estado            VARCHAR(30)   NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','enviada','cobrada','devuelta','anulada')),
  canal_cobro       VARCHAR(30),
  link_pago         TEXT,
  link_expira_at    TIMESTAMPTZ,
  pagada_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_referencia_cobro UNIQUE (referencia),
  CONSTRAINT chk_ref_origen CHECK (
    (factura_id IS NOT NULL AND remesa_id IS NULL)
    OR
    (factura_id IS NULL AND remesa_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ref_cobro_referencia
  ON referencias_cobro(referencia);
CREATE INDEX IF NOT EXISTS idx_ref_cobro_empresa_estado
  ON referencias_cobro(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_ref_cobro_factura
  ON referencias_cobro(factura_id);
CREATE INDEX IF NOT EXISTS idx_ref_cobro_vencimiento
  ON referencias_cobro(fecha_vencimiento)
  WHERE estado NOT IN ('cobrada','anulada');

-- ============================================================================
-- 6. movimientos_bancarios
--    Líneas de extracto bancario importadas (CSV, OFX) o sincronizadas (API).
-- ============================================================================
CREATE TABLE IF NOT EXISTS movimientos_bancarios (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuenta_id        UUID NOT NULL REFERENCES cuentas_bancarias(id),
  fecha_operacion  DATE          NOT NULL,
  fecha_valor      DATE          NOT NULL,
  concepto_banco   TEXT          NOT NULL,
  importe          NUMERIC(12,2) NOT NULL,    -- (+) ingreso / (-) gasto
  saldo            NUMERIC(12,2),
  referencia_banco VARCHAR(200),
  estado_concil    VARCHAR(20)   NOT NULL DEFAULT 'pendiente'
    CHECK (estado_concil IN ('pendiente','conciliado','ignorado','parcial')),
  importado_via    VARCHAR(30)   NOT NULL DEFAULT 'manual'
    CHECK (importado_via IN ('manual','csv','ofx','api_bbva','api_caixabank','api_santander','webhook')),
  origen_raw       JSONB,                     -- Payload original del banco/fichero
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  -- Deduplicación: mismo cuenta + fecha + importe + ref bancaria
  CONSTRAINT uq_movimiento UNIQUE (cuenta_id, fecha_operacion, importe, referencia_banco)
);

CREATE INDEX IF NOT EXISTS idx_mov_banco_cuenta_fecha
  ON movimientos_bancarios(cuenta_id, fecha_operacion);
CREATE INDEX IF NOT EXISTS idx_mov_banco_pendiente
  ON movimientos_bancarios(estado_concil)
  WHERE estado_concil = 'pendiente';

-- ============================================================================
-- 7. apuntes_conciliacion
--    Relación N:M entre movimientos y referencias. Permite conciliación parcial.
-- ============================================================================
CREATE TABLE IF NOT EXISTS apuntes_conciliacion (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  movimiento_id       UUID NOT NULL REFERENCES movimientos_bancarios(id),
  referencia_cobro_id UUID REFERENCES referencias_cobro(id),
  pago_id             UUID REFERENCES pagos(id),
  importe_aplicado    NUMERIC(12,2) NOT NULL,
  tipo                VARCHAR(30)   NOT NULL DEFAULT 'manual'
    CHECK (tipo IN ('automatico','manual','sugerido_aceptado')),
  conciliado_by       UUID REFERENCES auth.users(id),
  notas               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. reglas_conciliacion
--    Configuración del motor de matching automático.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reglas_conciliacion (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id       UUID NOT NULL REFERENCES empresas_facturadoras(id),
  nombre           VARCHAR(200) NOT NULL,
  prioridad        INT  NOT NULL DEFAULT 100,
  activa           BOOLEAN NOT NULL DEFAULT true,
  match_referencia BOOLEAN NOT NULL DEFAULT true,   -- Busca referencia en concepto_banco
  match_importe    BOOLEAN NOT NULL DEFAULT true,
  tolerancia_eur   NUMERIC(8,2) NOT NULL DEFAULT 0, -- Margen de diferencia aceptable (€)
  match_compania   BOOLEAN NOT NULL DEFAULT false,
  accion           VARCHAR(30) NOT NULL DEFAULT 'sugerir'
    CHECK (accion IN ('sugerir','aplicar_automatico')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. links_pago
--    Enlace de pago B2C generado vía proveedor PSP (Stripe, Redsys, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS links_pago (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referencia_id UUID NOT NULL REFERENCES referencias_cobro(id),
  proveedor     VARCHAR(30) NOT NULL
    CHECK (proveedor IN ('stripe','redsys','bizum','paycomet','otro')),
  proveedor_cfg JSONB,                       -- session_id, order_id, etc.
  url_publica   TEXT NOT NULL,
  url_exito     TEXT,
  url_cancel    TEXT,
  importe       NUMERIC(12,2) NOT NULL,
  moneda        CHAR(3)       NOT NULL DEFAULT 'EUR',
  estado        VARCHAR(20)   NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo','pagado','expirado','cancelado')),
  expira_at     TIMESTAMPTZ,
  pagado_at     TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. Extender facturas con campos del módulo Bancos
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='facturas' AND column_name='cuenta_cobro_id') THEN
    ALTER TABLE facturas ADD COLUMN cuenta_cobro_id UUID REFERENCES cuentas_bancarias(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='facturas' AND column_name='perfil_cobro_id') THEN
    ALTER TABLE facturas ADD COLUMN perfil_cobro_id UUID REFERENCES perfiles_cobro(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='facturas' AND column_name='referencia_cobro_id') THEN
    ALTER TABLE facturas ADD COLUMN referencia_cobro_id UUID REFERENCES referencias_cobro(id);
  END IF;
END $$;

-- ============================================================================
-- 11. Extender pagos con traza al movimiento bancario
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='pagos' AND column_name='movimiento_bancario_id') THEN
    ALTER TABLE pagos ADD COLUMN movimiento_bancario_id UUID REFERENCES movimientos_bancarios(id);
  END IF;
END $$;

-- ============================================================================
-- 12. Función atómica: genera la siguiente referencia de cobro por empresa
--     SECURITY DEFINER para que bypass RLS del contador interno.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_next_referencia_cobro(p_empresa_id UUID)
RETURNS TABLE(referencia TEXT, contador INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contador INT;
  v_year     TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
BEGIN
  -- INSERT ... ON CONFLICT DO UPDATE es atómico en PostgreSQL
  INSERT INTO contadores_referencias (empresa_id, contador)
  VALUES (p_empresa_id, 1)
  ON CONFLICT (empresa_id) DO UPDATE
    SET contador = contadores_referencias.contador + 1
  RETURNING contadores_referencias.contador INTO v_contador;

  RETURN QUERY SELECT
    ('REF-' || v_year || '-' || LPAD(v_contador::TEXT, 6, '0'))::TEXT,
    v_contador;
END;
$$;

-- ============================================================================
-- 13. Trigger: inicializar contador cuando se crea una nueva empresa facturadora
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_init_contador_referencias()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO contadores_referencias (empresa_id, contador)
  VALUES (NEW.id, 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_contador_referencias ON empresas_facturadoras;
CREATE TRIGGER trg_init_contador_referencias
  AFTER INSERT ON empresas_facturadoras
  FOR EACH ROW EXECUTE FUNCTION fn_init_contador_referencias();

-- ============================================================================
-- 14. Vista: cobros pendientes con aging report
-- ============================================================================
CREATE OR REPLACE VIEW v_cobros_pendientes AS
SELECT
  rc.id,
  rc.referencia,
  rc.concepto,
  rc.importe,
  rc.moneda,
  rc.fecha_vencimiento,
  rc.estado,
  rc.canal_cobro,
  (CURRENT_DATE - rc.fecha_vencimiento) AS dias_vencida,
  rc.empresa_id,
  ef.nombre  AS empresa_nombre,
  rc.compania_id,
  c.nombre   AS compania_nombre,
  rc.factura_id,
  f.numero_factura,
  CASE
    WHEN rc.fecha_vencimiento >= CURRENT_DATE          THEN 'vigente'
    WHEN (CURRENT_DATE - rc.fecha_vencimiento) <= 30  THEN '1-30'
    WHEN (CURRENT_DATE - rc.fecha_vencimiento) <= 60  THEN '31-60'
    WHEN (CURRENT_DATE - rc.fecha_vencimiento) <= 90  THEN '61-90'
    ELSE '+90'
  END AS bucket_aging
FROM referencias_cobro rc
JOIN empresas_facturadoras ef ON ef.id = rc.empresa_id
JOIN companias c              ON c.id  = rc.compania_id
LEFT JOIN facturas f          ON f.id  = rc.factura_id
WHERE rc.estado IN ('pendiente','enviada','devuelta')
ORDER BY rc.fecha_vencimiento ASC;

-- ============================================================================
-- 15. Vista: movimientos sin conciliar
-- ============================================================================
CREATE OR REPLACE VIEW v_movimientos_sin_conciliar AS
SELECT
  mb.id,
  mb.cuenta_id,
  cb.alias   AS cuenta_alias,
  cb.entidad AS cuenta_entidad,
  ef.id      AS empresa_id,
  ef.nombre  AS empresa_nombre,
  mb.fecha_operacion,
  mb.fecha_valor,
  mb.concepto_banco,
  mb.importe,
  mb.referencia_banco,
  mb.importado_via,
  (CURRENT_DATE - mb.fecha_operacion) AS dias_pendiente
FROM movimientos_bancarios mb
JOIN cuentas_bancarias     cb ON cb.id = mb.cuenta_id
JOIN empresas_facturadoras ef ON ef.id = cb.empresa_id
WHERE mb.estado_concil = 'pendiente'
ORDER BY mb.fecha_operacion DESC;

-- ============================================================================
-- 16. Actualizar v_facturas_listado para incluir referencia de cobro
-- ============================================================================
CREATE OR REPLACE VIEW v_facturas_listado AS
SELECT
  f.*,
  e.numero_expediente,
  c.nombre  AS compania_nombre,
  ef.nombre AS empresa_nombre,
  s.codigo  AS serie_codigo,
  (SELECT COALESCE(SUM(pg.importe), 0)
   FROM pagos pg WHERE pg.factura_id = f.id) AS total_cobrado,
  rc.referencia   AS ref_cobro,
  rc.estado       AS ref_cobro_estado,
  rc.fecha_vencimiento AS ref_cobro_vencimiento
FROM facturas f
JOIN expedientes e               ON e.id  = f.expediente_id
LEFT JOIN companias c            ON c.id  = f.compania_id
LEFT JOIN empresas_facturadoras ef ON ef.id = f.empresa_facturadora_id
LEFT JOIN series_facturacion s   ON s.id  = f.serie_id
LEFT JOIN referencias_cobro rc   ON rc.id = f.referencia_cobro_id
ORDER BY f.created_at DESC;

-- ============================================================================
-- 17. Índices adicionales
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_perfiles_cobro_lookup
  ON perfiles_cobro(compania_id, empresa_id) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_remesas_empresa
  ON remesas_cobro(empresa_id);
CREATE INDEX IF NOT EXISTS idx_links_pago_referencia
  ON links_pago(referencia_id);
CREATE INDEX IF NOT EXISTS idx_apuntes_movimiento
  ON apuntes_conciliacion(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_facturas_referencia_cobro
  ON facturas(referencia_cobro_id);

-- ============================================================================
-- 18. RLS
-- ============================================================================
ALTER TABLE cuentas_bancarias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_cobro         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contadores_referencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE remesas_cobro          ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencias_cobro      ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_bancarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE apuntes_conciliacion    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglas_conciliacion     ENABLE ROW LEVEL SECURITY;
ALTER TABLE links_pago              ENABLE ROW LEVEL SECURITY;

-- cuentas_bancarias
CREATE POLICY "financiero_read_cuentas" ON cuentas_bancarias
  FOR SELECT USING (public.user_roles() && ARRAY['admin','financiero','supervisor','direccion']);
CREATE POLICY "financiero_manage_cuentas" ON cuentas_bancarias
  FOR ALL
  USING (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- perfiles_cobro
CREATE POLICY "staff_read_perfiles" ON perfiles_cobro
  FOR SELECT USING (public.user_roles() && ARRAY['admin','financiero','supervisor','tramitador','direccion']);
CREATE POLICY "financiero_manage_perfiles" ON perfiles_cobro
  FOR ALL
  USING (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- contadores_referencias: gestionado únicamente por la función fn_next_referencia_cobro (SECURITY DEFINER)
CREATE POLICY "deny_direct_access_contadores" ON contadores_referencias
  FOR ALL USING (false);

-- remesas_cobro
CREATE POLICY "financiero_read_remesas" ON remesas_cobro
  FOR SELECT USING (public.user_roles() && ARRAY['admin','financiero','supervisor','direccion']);
CREATE POLICY "financiero_manage_remesas" ON remesas_cobro
  FOR ALL
  USING (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- referencias_cobro
CREATE POLICY "staff_read_referencias" ON referencias_cobro
  FOR SELECT USING (public.user_roles() && ARRAY['admin','financiero','supervisor','tramitador','direccion']);
CREATE POLICY "financiero_manage_referencias" ON referencias_cobro
  FOR ALL
  USING (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- movimientos_bancarios
CREATE POLICY "financiero_read_movimientos" ON movimientos_bancarios
  FOR SELECT USING (public.user_roles() && ARRAY['admin','financiero','supervisor','direccion']);
CREATE POLICY "financiero_manage_movimientos" ON movimientos_bancarios
  FOR ALL
  USING (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- apuntes_conciliacion
CREATE POLICY "financiero_read_apuntes" ON apuntes_conciliacion
  FOR SELECT USING (public.user_roles() && ARRAY['admin','financiero','supervisor','direccion']);
CREATE POLICY "financiero_manage_apuntes" ON apuntes_conciliacion
  FOR ALL
  USING (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- reglas_conciliacion
CREATE POLICY "financiero_read_reglas" ON reglas_conciliacion
  FOR SELECT USING (public.user_roles() && ARRAY['admin','financiero','supervisor','direccion']);
CREATE POLICY "admin_manage_reglas" ON reglas_conciliacion
  FOR ALL
  USING (public.user_roles() && ARRAY['admin'])
  WITH CHECK (public.user_roles() && ARRAY['admin']);

-- links_pago
CREATE POLICY "financiero_read_links" ON links_pago
  FOR SELECT USING (public.user_roles() && ARRAY['admin','financiero','supervisor','direccion']);
CREATE POLICY "financiero_manage_links" ON links_pago
  FOR ALL
  USING (public.user_roles() && ARRAY['admin','financiero'])
  WITH CHECK (public.user_roles() && ARRAY['admin','financiero']);

-- ============================================================================
-- 19. Realtime
-- ============================================================================
ALTER PUBLICATION supabase_realtime
  ADD TABLE referencias_cobro, movimientos_bancarios, apuntes_conciliacion;

-- ============================================================================
-- 20. Seed: reglas de conciliación por defecto + inicializar contadores
-- ============================================================================

-- Regla 1: match por referencia exacta → aplicar automáticamente
INSERT INTO reglas_conciliacion
  (empresa_id, nombre, prioridad, activa, match_referencia, match_importe, tolerancia_eur, accion)
SELECT
  id,
  'Match por referencia exacta',
  1, true, true, true, 0,
  'aplicar_automatico'
FROM empresas_facturadoras
ON CONFLICT DO NOTHING;

-- Regla 2: match por importe (tolerancia 1€) → sugerir
INSERT INTO reglas_conciliacion
  (empresa_id, nombre, prioridad, activa, match_referencia, match_importe, tolerancia_eur, accion)
SELECT
  id,
  'Match por importe (tolerancia 1€)',
  10, true, false, true, 1.00,
  'sugerir'
FROM empresas_facturadoras
ON CONFLICT DO NOTHING;

-- Inicializar contadores para empresas ya existentes
INSERT INTO contadores_referencias (empresa_id, contador)
SELECT id, 0 FROM empresas_facturadoras
ON CONFLICT DO NOTHING;
