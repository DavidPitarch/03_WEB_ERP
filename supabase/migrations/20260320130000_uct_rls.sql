-- ============================================================
-- UCT — RLS policies para tablas del módulo
-- ============================================================

-- ─── tramitadores ────────────────────────────────────────────

ALTER TABLE tramitadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tramitadores_staff_all"
  ON tramitadores FOR ALL TO authenticated
  USING (has_any_role(ARRAY['admin', 'supervisor', 'financiero', 'direccion']));

-- Tramitador puede leer su propio registro
CREATE POLICY "tramitadores_self_select"
  ON tramitadores FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── tramitador_reglas_preasignacion ─────────────────────────

ALTER TABLE tramitador_reglas_preasignacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preasig_staff_all"
  ON tramitador_reglas_preasignacion FOR ALL TO authenticated
  USING (has_any_role(ARRAY['admin', 'supervisor', 'direccion']));

-- ─── reglas_reparto ──────────────────────────────────────────

ALTER TABLE reglas_reparto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reglas_reparto_staff_read"
  ON reglas_reparto FOR SELECT TO authenticated
  USING (has_any_role(ARRAY['admin', 'supervisor', 'financiero', 'direccion']));

CREATE POLICY "reglas_reparto_admin_write"
  ON reglas_reparto FOR ALL TO authenticated
  USING (has_any_role(ARRAY['admin', 'supervisor']));

-- ─── historial_asignaciones ──────────────────────────────────

ALTER TABLE historial_asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hist_asig_staff_all"
  ON historial_asignaciones FOR ALL TO authenticated
  USING (has_any_role(ARRAY['admin', 'supervisor', 'direccion']));

-- Tramitador lee solo los registros donde él es el destino
CREATE POLICY "hist_asig_tramitador_own"
  ON historial_asignaciones FOR SELECT TO authenticated
  USING (
    tramitador_nuevo_id IN (
      SELECT id FROM tramitadores WHERE user_id = auth.uid()
    )
  );

-- ─── alertas_carga ───────────────────────────────────────────

ALTER TABLE alertas_carga ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_carga_staff_all"
  ON alertas_carga FOR ALL TO authenticated
  USING (has_any_role(ARRAY['admin', 'supervisor', 'direccion']));

-- ─── expedientes: nueva política para tramitador_id ──────────
-- No se elimina ninguna política existente. Se añaden las
-- políticas de lectura por tramitador_id de forma aditiva.

CREATE POLICY "expedientes_tramitador_own"
  ON expedientes FOR SELECT TO authenticated
  USING (
    tramitador_id IN (
      SELECT id FROM tramitadores WHERE user_id = auth.uid()
    )
  );
