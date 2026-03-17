# EP-13 — Matriz de migración PWGS → ERP

## Entidades principales

| PWGS (origen) | ERP (destino) | Transformación | Notas |
|---|---|---|---|
| `siniestros` | `expedientes` | Map campos + generar numero_expediente | Estado inicial = NUEVO |
| `siniestros.estado` | `expedientes.estado` | Tabla equivalencia estados | Ver sección estados |
| `asegurados` | `asegurados` | Dedup por DNI/NIE + normalización nombre | Split nombre completo → nombre + apellidos |
| `companias` | `companias_aseguradoras` | 1:1 con limpieza CIF | Verificar duplicados por CIF |
| `operarios` | `operarios` | Map gremios → array gremios[] | es_subcontratado desde tipo_contrato |
| `citas` | `citas` | Map fecha + operario | Vincular a expediente migrado |
| `partes` | `partes_operario` | Map resultado + trabajos | Evidencias como referencias Storage |
| `facturas` | `facturas` | Map serie + numeración | Respetar numeración original |
| `lineas_factura` | `lineas_factura` | 1:1 | Recalcular subtotales |
| `cobros/pagos` | `pagos` | Map fecha + importe | Vincular a factura migrada |
| `proveedores` | `proveedores` | Dedup por CIF | Normalizar datos contacto |
| `pedidos_material` | `pedidos_material` | Map estado + líneas | Generar numero_pedido |
| `presupuestos` | `presupuestos` | Map líneas + totales | Recalcular margen |
| `baremos` | `baremos` + `partidas_baremo` | Split header/líneas | Tipo = compania por defecto |
| `tareas` | `tareas_internas` | Map prioridad + estado | Vincular a expediente |
| `documentos` | `documentos` | Map tipo + Storage ref | Migrar archivos a Supabase Storage |

## Equivalencia de estados expediente

| PWGS estado | ERP estado | Condición |
|---|---|---|
| `nuevo`, `registrado` | `NUEVO` | |
| `asignado` | `ASIGNADO` | Si tiene operario |
| `en_curso`, `activo` | `EN_CURSO` | |
| `pend_informe` | `PENDIENTE_INFORME` | |
| `pend_perito` | `PENDIENTE_PERITAJE` | |
| `pend_material` | `PENDIENTE_MATERIAL` | |
| `finalizado` | `FINALIZADO` | Si tiene parte validado |
| `facturado` | `FACTURADO` | Si tiene factura emitida |
| `cobrado` | `COBRADO` | Si tiene pago registrado |
| `cerrado` | `CERRADO` | |
| `anulado` | `ANULADO` | |
| `rehusado` | `REHUSADO` | |
| `revisado` | `EN_REVISION` | |

## Estrategia de migración

1. **Staging**: cargar datos PWGS en tablas `stg_*` temporales
2. **Validación**: verificar integridad referencial, detectar huérfanos
3. **Deduplicación**: aplicar reglas (ver ep13-deduplicacion.md)
4. **Transformación**: scripts SQL que mapean stg → tablas ERP
5. **Verificación**: conteos, checksums, muestreo aleatorio
6. **Cutover**: ventana de mantenimiento, migración final, verificación

## Riesgos

- Datos PWGS sin CIF/DNI impiden deduplicación → requiere limpieza manual previa
- Estados PWGS no normalizados → posible pérdida de granularidad
- Archivos en filesystem PWGS → migrar a Supabase Storage (batch upload)
- Numeración facturas: respetar series existentes para continuidad fiscal
