# EP-13 - Matriz maestra de datos

Objetivo: definir fuente de verdad, ownership, calidad minima y uso de cutover para las entidades activas del ERP.

| Dominio | Tablas | Fuente de verdad | Owner | Claves y relaciones | Minimo de calidad | Uso en cutover |
|---|---|---|---|---|---|---|
| Identidad | `roles`, `user_profiles`, `user_roles`, `auth.users` | Supabase Auth + ERP | Seguridad | `auth.users.id`, `user_roles.user_id`, `user_roles.role_id` | email unico, rol efectivo por usuario, metadatos coherentes | bootstrap obligatorio |
| Catalogos base | `companias`, `empresas_facturadoras`, `baremos`, `partidas_baremo` | ERP | Operaciones + Finanzas | `companias.codigo`, `empresas_facturadoras.cif`, `baremos.compania_id` | compania activa, CIF valido, baremo versionado | seed y migracion |
| Terceros | `asegurados`, `operarios`, `peritos`, `proveedores` | ERP tras depuracion | Operaciones | `asegurados.nif`, `operarios.user_id`, `peritos.user_id`, `proveedores.cif` | sin duplicados por NIF/CIF, `user_id` valido si aplica | migracion con deduplicacion |
| Core ERP | `expedientes`, `citas`, `comunicaciones`, `historial_estados`, `auditoria`, `eventos_dominio` | Base de datos ERP | Backoffice | `expedientes.numero_expediente`, `citas.expediente_id`, `historial_estados.expediente_id` | expediente con compania, empresa facturadora y asegurado; transiciones validas; trazabilidad completa | migracion y operacion diaria |
| Operacion campo | `partes_operario`, `evidencias`, `documentos` | ERP + Storage privado | Operaciones | `partes_operario.cita_id`, `evidencias.storage_path`, `documentos.storage_path` | `storage_path` no nulo, expediente asociado, propietario trazable | migracion de adjuntos y operacion |
| Finanzas | `series_facturacion`, `facturas`, `lineas_factura`, `pagos`, `seguimiento_cobro`, `vp_facturas` | ERP | Finanzas | `facturas.numero_factura`, `pagos.factura_id` | numeracion consistente, importes reconciliados, estado_cobro correcto | migracion contable y validacion |
| Logistica | `pedidos_material`, `lineas_pedido`, `confirmaciones_proveedor`, `historial_pedido` | ERP | Operaciones | `pedidos_material.numero_pedido`, `confirmaciones_proveedor.pedido_id` | proveedor valido, token y caducidad consistentes, historial completo | operacion diaria |
| Videoperitacion | `vp_videoperitaciones`, `vp_encargos`, `vp_comunicaciones`, `vp_intentos_contacto`, `vp_agenda`, `vp_sesiones`, `vp_artefactos`, `vp_transcripciones`, `vp_dictamenes`, `vp_instrucciones`, `vp_informes`, `vp_valoraciones`, `vp_documento_final`, `vp_envios` | ERP | Backoffice + Peritos + Finanzas | `vp_videoperitaciones.numero_caso`, `vp_artefactos.storage_path`, `vp_envios.intento_numero` | perito asignado cuando aplique, artefactos privados, informe validado antes de documento final, envio trazable | validacion positiva previa a GO |

Reglas de calidad obligatorias:

1. No cargar `expedientes` sin `compania_id`, `empresa_facturadora_id` y `asegurado_id`.
2. No activar usuarios operativos sin relacion valida en `operarios` o `peritos`.
3. No migrar adjuntos sin bucket destino y `storage_path` definitivo.
4. No abrir conciliacion financiera hasta cuadrar `facturas.total` vs `pagos.importe`.
5. No cerrar VP sin `vp_documento_final` y `vp_envios` consistentes.
