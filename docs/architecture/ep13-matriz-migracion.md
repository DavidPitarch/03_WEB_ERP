# EP-13 - Matriz de migracion PWGS -> ERP

Estado: vigente
Objetivo: mapear origen legacy a esquema ERP real, sin nombres ni estados obsoletos.

## 1. Entidades principales

| PWGS origen | ERP destino | Transformacion | Regla de control |
|---|---|---|---|
| `siniestros` | `expedientes` | normalizar claves, generar `numero_expediente` y mapear relacion con compania/asegurado | no cargar si faltan claves maestras |
| `siniestros.estado` | `expedientes.estado` | tabla de equivalencia controlada | solo estados del enum vigente |
| `companias` | `companias` | limpieza de codigo y CIF | deduplicar por codigo/CIF |
| `empresas` de facturacion | `empresas_facturadoras` | normalizar CIF y direccion | una fila activa por CIF valido |
| `clientes/asegurados` | `asegurados` | split nombre/apellidos, normalizar telefonos | deduplicar por NIF y contacto |
| `operarios` | `operarios` | mapear gremios, zonas y `user_id` cuando exista | no activar sin usuario operativo si requiere login |
| `peritos` | `peritos` | mapear especialidades y `compania_ids` | validar `user_id` y asignacion |
| `citas` | `citas` | mapear agenda y operario | expediente ya migrado |
| `partes` | `partes_operario` | mapear trabajo, resultado, pendientes | cita y expediente deben existir |
| `adjuntos` | `evidencias`, `documentos`, `vp_artefactos` | mover binarios a Storage y persistir `storage_path` | sin bucket no hay cutover |
| `facturas` | `facturas`, `lineas_factura` | respetar serie y numero si aplica | reconciliacion con total legacy |
| `cobros/pagos` | `pagos` | mapear fecha, importe y referencia | factura migrada obligatoria |
| `proveedores` | `proveedores` | limpieza CIF y canal preferido | deduplicacion por CIF/email |
| `pedidos` | `pedidos_material`, `lineas_pedido` | normalizar estado e historial | proveedor y expediente obligatorios |

## 2. Equivalencia de estados de expediente

| PWGS estado | ERP estado |
|---|---|
| `nuevo`, `registrado` | `NUEVO` |
| `pendiente_asignacion` | `NO_ASIGNADO` |
| `planificando`, `citando` | `EN_PLANIFICACION` |
| `en_curso`, `activo` | `EN_CURSO` |
| `pendiente` | `PENDIENTE` |
| `pend_material` | `PENDIENTE_MATERIAL` |
| `pend_perito` | `PENDIENTE_PERITO` |
| `pend_cliente`, `cliente_ausente` | `PENDIENTE_CLIENTE` |
| `finalizado` | `FINALIZADO` |
| `facturado` | `FACTURADO` |
| `cobrado` | `COBRADO` |
| `cerrado` | `CERRADO` |
| `cancelado`, `anulado` | `CANCELADO` |

## 3. Secuencia operativa de migracion

1. cargar extractos PWGS en staging `stg_*`
2. ejecutar limpieza y deduplicacion
3. resolver maestros: companias, empresas facturadoras, asegurados, operarios, peritos, proveedores
4. cargar `expedientes`
5. cargar `citas`, `partes_operario`, `comunicaciones`, `historial_estados`
6. cargar finanzas y logistica
7. mover binarios a buckets privados y actualizar `storage_path`
8. ejecutar reconciliacion de conteos y muestreo

## 4. Reglas de rechazo

- registro sin clave de negocio util
- expediente sin compania o empresa facturadora resoluble
- adjunto sin destino documental claro
- factura sin cuadratura entre base, IVA y total
- operario o perito sin correspondencia de identidad cuando el flujo requiera login
