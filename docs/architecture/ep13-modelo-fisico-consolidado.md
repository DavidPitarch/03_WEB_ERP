# EP-13 - Modelo fisico consolidado

Objetivo: resumen operativo del modelo fisico vigente tras Sprint 5.5.

## 1. Identidad y seguridad

- `auth.users`
- `roles`
- `user_profiles`
- `user_roles`

Claves:

- la identidad base vive en Supabase Auth
- `user_roles` resuelve autorizacion efectiva por rol
- RLS se apoya en `auth.uid()` y funciones auxiliares de rol/acceso

## 2. Core ERP

- `companias`
- `empresas_facturadoras`
- `asegurados`
- `operarios`
- `peritos`
- `expedientes`
- `citas`
- `comunicaciones`
- `historial_estados`
- `partes_operario`
- `evidencias`
- `documentos`
- `auditoria`
- `eventos_dominio`

Estado oficial de `expedientes.estado`:

- `NUEVO`
- `NO_ASIGNADO`
- `EN_PLANIFICACION`
- `EN_CURSO`
- `PENDIENTE`
- `PENDIENTE_MATERIAL`
- `PENDIENTE_PERITO`
- `PENDIENTE_CLIENTE`
- `FINALIZADO`
- `FACTURADO`
- `COBRADO`
- `CERRADO`
- `CANCELADO`

## 3. Finanzas y logistica

- `series_facturacion`
- `facturas`
- `lineas_factura`
- `pagos`
- `seguimiento_cobro`
- `proveedores`
- `pedidos_material`
- `lineas_pedido`
- `confirmaciones_proveedor`
- `historial_pedido`
- `autofacturas`
- `lineas_autofactura`

## 4. Videoperitacion

- `vp_videoperitaciones`
- `vp_encargos`
- `vp_comunicaciones`
- `vp_intentos_contacto`
- `vp_agenda`
- `vp_sesiones`
- `vp_artefactos`
- `vp_transcripciones`
- `vp_accesos_artefacto`
- `vp_consentimientos`
- `vp_webhook_logs`
- `vp_dictamenes`
- `vp_dictamen_versiones`
- `vp_instrucciones`
- `vp_informes`
- `vp_informe_versiones`
- `vp_valoraciones`
- `vp_valoracion_lineas`
- `vp_documento_final`
- `vp_facturas`
- `vp_envios`

Estado oficial de `vp_videoperitaciones.estado`:

- `encargo_recibido`
- `pendiente_contacto`
- `contactado`
- `agendado`
- `link_enviado`
- `sesion_programada`
- `sesion_en_curso`
- `sesion_finalizada`
- `pendiente_perito`
- `revision_pericial`
- `pendiente_informe`
- `informe_borrador`
- `informe_validado`
- `valoracion_calculada`
- `facturado`
- `enviado`
- `cerrado`
- `cancelado`
- `sesion_fallida`
- `cliente_ausente`

## 5. Buckets privados de Storage

- `documentos`
- `evidencias`
- `vp-artefactos`

Reglas:

1. todos los buckets de Sprint 5.5 son privados
2. acceso de lectura solo por signed URL o backend autenticado
3. `storage_path` debe quedar persistido en tabla de negocio
