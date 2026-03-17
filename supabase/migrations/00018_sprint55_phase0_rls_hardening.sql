-- ============================================================
-- Sprint 5.5 Phase 0: RLS hardening for core, VP and finance
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION auth.has_any_role(required_roles text[])
RETURNS boolean AS $$
  SELECT COALESCE(auth.user_roles() && required_roles, false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.current_operario_id()
RETURNS uuid AS $$
  SELECT o.id
  FROM operarios o
  WHERE o.user_id = auth.uid()
    AND o.activo = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.current_perito_id()
RETURNS uuid AS $$
  SELECT p.id
  FROM peritos p
  WHERE p.user_id = auth.uid()
    AND COALESCE(p.activo, true) = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.can_access_vp(vp_id uuid)
RETURNS boolean AS $$
  SELECT
    auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
    OR EXISTS (
      SELECT 1
      FROM vp_videoperitaciones vp
      WHERE vp.id = vp_id
        AND vp.perito_id = auth.current_perito_id()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.can_access_vp_artifact(artefacto_id uuid)
RETURNS boolean AS $$
  SELECT
    auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
    OR EXISTS (
      SELECT 1
      FROM vp_artefactos art
      JOIN vp_videoperitaciones vp ON vp.id = art.videoperitacion_id
      WHERE art.id = artefacto_id
        AND vp.perito_id = auth.current_perito_id()
        AND art.visibility_scope IN ('perito', 'all')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS expedientes_insert ON expedientes;
DROP POLICY IF EXISTS expedientes_update ON expedientes;
DROP POLICY IF EXISTS documentos_service_insert ON documentos;
DROP POLICY IF EXISTS documentos_service_update ON documentos;
DROP POLICY IF EXISTS staff_read_series ON series_facturacion;
DROP POLICY IF EXISTS admin_financiero_manage_series ON series_facturacion;
DROP POLICY IF EXISTS staff_read_seguimiento ON seguimiento_cobro;
DROP POLICY IF EXISTS admin_financiero_manage_seguimiento ON seguimiento_cobro;
DROP POLICY IF EXISTS staff_read_facturas ON facturas;
DROP POLICY IF EXISTS admin_financiero_manage_facturas ON facturas;
DROP POLICY IF EXISTS staff_read_pagos ON pagos;

DROP POLICY IF EXISTS vp_videoperitaciones_office_select ON vp_videoperitaciones;
DROP POLICY IF EXISTS vp_videoperitaciones_office_insert ON vp_videoperitaciones;
DROP POLICY IF EXISTS vp_videoperitaciones_office_update ON vp_videoperitaciones;
DROP POLICY IF EXISTS vp_encargos_office_all ON vp_encargos;
DROP POLICY IF EXISTS vp_comunicaciones_office_all ON vp_comunicaciones;
DROP POLICY IF EXISTS vp_intentos_contacto_office_all ON vp_intentos_contacto;
DROP POLICY IF EXISTS vp_agenda_office_all ON vp_agenda;
DROP POLICY IF EXISTS vp_sesiones_office_all ON vp_sesiones;
DROP POLICY IF EXISTS vp_consentimientos_office_all ON vp_consentimientos;
DROP POLICY IF EXISTS vp_webhook_logs_office_all ON vp_webhook_logs;
DROP POLICY IF EXISTS vp_artefactos_office_all ON vp_artefactos;
DROP POLICY IF EXISTS vp_accesos_artefacto_admin_select ON vp_accesos_artefacto;
DROP POLICY IF EXISTS vp_accesos_artefacto_admin_insert ON vp_accesos_artefacto;
DROP POLICY IF EXISTS vp_transcripciones_office_all ON vp_transcripciones;

DROP POLICY IF EXISTS vp_informes_select ON vp_informes;
DROP POLICY IF EXISTS vp_informes_insert ON vp_informes;
DROP POLICY IF EXISTS vp_informes_update ON vp_informes;
DROP POLICY IF EXISTS vp_informe_versiones_select ON vp_informe_versiones;
DROP POLICY IF EXISTS vp_informe_versiones_insert ON vp_informe_versiones;
DROP POLICY IF EXISTS vp_valoraciones_select ON vp_valoraciones;
DROP POLICY IF EXISTS vp_valoraciones_insert ON vp_valoraciones;
DROP POLICY IF EXISTS vp_valoraciones_update ON vp_valoraciones;
DROP POLICY IF EXISTS vp_valoracion_lineas_select ON vp_valoracion_lineas;
DROP POLICY IF EXISTS vp_valoracion_lineas_insert ON vp_valoracion_lineas;
DROP POLICY IF EXISTS vp_valoracion_lineas_update ON vp_valoracion_lineas;
DROP POLICY IF EXISTS vp_valoracion_lineas_delete ON vp_valoracion_lineas;

DROP POLICY IF EXISTS vp_documento_final_select ON vp_documento_final;
DROP POLICY IF EXISTS vp_documento_final_insert ON vp_documento_final;
DROP POLICY IF EXISTS vp_documento_final_update ON vp_documento_final;
DROP POLICY IF EXISTS vp_facturas_select ON vp_facturas;
DROP POLICY IF EXISTS vp_facturas_insert ON vp_facturas;
DROP POLICY IF EXISTS vp_envios_select ON vp_envios;
DROP POLICY IF EXISTS vp_envios_insert ON vp_envios;
DROP POLICY IF EXISTS vp_envios_update ON vp_envios;

ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_factura ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_dominio ENABLE ROW LEVEL SECURITY;

CREATE POLICY documentos_staff_select ON documentos FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY series_facturacion_staff_select ON series_facturacion FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'financiero', 'direccion']));

CREATE POLICY series_facturacion_finance_manage ON series_facturacion FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'financiero']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'financiero']));

CREATE POLICY seguimiento_cobro_staff_select ON seguimiento_cobro FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'financiero', 'direccion']));

CREATE POLICY seguimiento_cobro_finance_manage ON seguimiento_cobro FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'financiero']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'financiero']));

CREATE POLICY facturas_staff_select ON facturas FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY facturas_finance_manage ON facturas FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'financiero']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'financiero']));

CREATE POLICY lineas_factura_staff_select ON lineas_factura FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM facturas f
      WHERE f.id = lineas_factura.factura_id
        AND auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
    )
  );

CREATE POLICY lineas_factura_finance_manage ON lineas_factura FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM facturas f
      WHERE f.id = lineas_factura.factura_id
        AND auth.has_any_role(ARRAY['admin', 'financiero'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM facturas f
      WHERE f.id = lineas_factura.factura_id
        AND auth.has_any_role(ARRAY['admin', 'financiero'])
    )
  );

CREATE POLICY pagos_staff_select ON pagos FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'financiero', 'direccion']));

CREATE POLICY pagos_finance_manage ON pagos FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'financiero']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'financiero']));

CREATE POLICY auditoria_staff_select ON auditoria FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'direccion']));

CREATE POLICY eventos_dominio_staff_select ON eventos_dominio FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'direccion']));

CREATE POLICY vp_videoperitaciones_office_all ON vp_videoperitaciones FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_encargos_office_all ON vp_encargos FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_comunicaciones_office_all ON vp_comunicaciones FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_intentos_contacto_office_all ON vp_intentos_contacto FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_agenda_office_all ON vp_agenda FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_sesiones_office_all ON vp_sesiones FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_consentimientos_office_all ON vp_consentimientos FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_webhook_logs_admin_all ON vp_webhook_logs FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor']));

CREATE POLICY vp_artefactos_office_all ON vp_artefactos FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_artefactos_perito_select ON vp_artefactos FOR SELECT
  USING (auth.can_access_vp_artifact(id));

CREATE POLICY vp_transcripciones_office_all ON vp_transcripciones FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_transcripciones_perito_select ON vp_transcripciones FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM vp_artefactos art
      WHERE art.id = vp_transcripciones.artefacto_id
        AND auth.can_access_vp_artifact(art.id)
    )
  );

CREATE POLICY vp_accesos_artefacto_staff_select ON vp_accesos_artefacto FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'direccion']));

CREATE POLICY vp_accesos_artefacto_allowed_insert ON vp_accesos_artefacto FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
      OR auth.can_access_vp_artifact(artefacto_id)
    )
  );

CREATE POLICY vp_informes_office_select ON vp_informes FOR SELECT
  USING (auth.can_access_vp(videoperitacion_id));

CREATE POLICY vp_informes_edit_own_scope ON vp_informes FOR INSERT
  WITH CHECK (auth.can_access_vp(videoperitacion_id));

CREATE POLICY vp_informes_update_own_scope ON vp_informes FOR UPDATE
  USING (auth.can_access_vp(videoperitacion_id))
  WITH CHECK (auth.can_access_vp(videoperitacion_id));

CREATE POLICY vp_informe_versiones_select_scoped ON vp_informe_versiones FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM vp_informes i
      WHERE i.id = vp_informe_versiones.informe_id
        AND auth.can_access_vp(i.videoperitacion_id)
    )
  );

CREATE POLICY vp_informe_versiones_insert_scoped ON vp_informe_versiones FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM vp_informes i
      WHERE i.id = vp_informe_versiones.informe_id
        AND auth.can_access_vp(i.videoperitacion_id)
    )
  );

CREATE POLICY vp_valoraciones_office_select ON vp_valoraciones FOR SELECT
  USING (auth.can_access_vp(videoperitacion_id));

CREATE POLICY vp_valoraciones_office_manage ON vp_valoraciones FOR ALL
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_valoracion_lineas_select_scoped ON vp_valoracion_lineas FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM vp_valoraciones v
      WHERE v.id = vp_valoracion_lineas.valoracion_id
        AND auth.can_access_vp(v.videoperitacion_id)
    )
  );

CREATE POLICY vp_valoracion_lineas_manage_scoped ON vp_valoracion_lineas FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM vp_valoraciones v
      WHERE v.id = vp_valoracion_lineas.valoracion_id
        AND auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM vp_valoraciones v
      WHERE v.id = vp_valoracion_lineas.valoracion_id
        AND auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'])
    )
  );

CREATE POLICY vp_documento_final_select_scoped ON vp_documento_final FOR SELECT
  USING (
    auth.can_access_vp(videoperitacion_id)
    OR auth.has_any_role(ARRAY['admin', 'supervisor', 'financiero', 'direccion'])
  );

CREATE POLICY vp_documento_final_manage_scoped ON vp_documento_final FOR INSERT
  WITH CHECK (
    auth.has_any_role(ARRAY['admin', 'supervisor', 'perito'])
    AND auth.can_access_vp(videoperitacion_id)
  );

CREATE POLICY vp_documento_final_update_scoped ON vp_documento_final FOR UPDATE
  USING (
    auth.has_any_role(ARRAY['admin', 'supervisor', 'perito'])
    AND auth.can_access_vp(videoperitacion_id)
  )
  WITH CHECK (
    auth.has_any_role(ARRAY['admin', 'supervisor', 'perito'])
    AND auth.can_access_vp(videoperitacion_id)
  );

CREATE POLICY vp_facturas_staff_select ON vp_facturas FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_facturas_finance_insert ON vp_facturas FOR INSERT
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'financiero']));

CREATE POLICY vp_envios_staff_select ON vp_envios FOR SELECT
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']));

CREATE POLICY vp_envios_finance_insert ON vp_envios FOR INSERT
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'financiero']));

CREATE POLICY vp_envios_finance_update ON vp_envios FOR UPDATE
  USING (auth.has_any_role(ARRAY['admin', 'supervisor', 'financiero']))
  WITH CHECK (auth.has_any_role(ARRAY['admin', 'supervisor', 'financiero']));

COMMIT;
