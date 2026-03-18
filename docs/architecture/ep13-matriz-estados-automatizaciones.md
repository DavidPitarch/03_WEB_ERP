# EP-13 - Matriz de estados y automatizaciones

## 1. Expedientes ERP

| Estado origen | Accion | Estado destino | Regla |
|---|---|---|---|
| `NUEVO` | asignar flujo | `NO_ASIGNADO` o `EN_PLANIFICACION` | depende de disponibilidad operativa |
| `NO_ASIGNADO` | planificar | `EN_PLANIFICACION` | requiere operario o siguiente paso definido |
| `EN_PLANIFICACION` | crear cita | `EN_CURSO` o mantiene | `erp_create_cita` valido |
| `EN_CURSO` | registrar parte / avance | mantiene o `PENDIENTE_*` | segun resultado y bloqueo |
| `EN_CURSO` | finalizar trabajo | `FINALIZADO` | requiere cierre operativo |
| `FINALIZADO` | emitir factura | `FACTURADO` | factura valida emitida |
| `FACTURADO` | registrar pago | `COBRADO` | pago conciliado |
| `COBRADO` | cierre administrativo | `CERRADO` | sin pendientes abiertos |
| cualquier activo | cancelacion | `CANCELADO` | motivo obligatorio |

Reglas transaccionales confirmadas:

- `erp_create_expediente` crea expediente con numeracion y trazabilidad
- `erp_create_cita` solo opera en estados permitidos
- `erp_transition_expediente` valida estado actual y registra historial
- rollback no deja huella huerfana en las pruebas remotas validadas

## 2. Videoperitacion

| Estado origen | Accion | Estado destino | Regla |
|---|---|---|---|
| `encargo_recibido` | registrar encargo | `pendiente_contacto` | expediente vinculado |
| `pendiente_contacto` | contacto correcto | `contactado` | intento trazado |
| `contactado` | agendar | `agendado` | agenda valida |
| `agendado` | enviar link | `link_enviado` | link con expiracion |
| `link_enviado` | sesion creada | `sesion_programada` | proveedor o sistema |
| `sesion_programada` | inicio sesion | `sesion_en_curso` | webhook o accion controlada |
| `sesion_en_curso` | fin sesion | `sesion_finalizada` | artefactos esperados |
| `sesion_finalizada` | entrega a perito | `pendiente_perito` | sesion cerrada |
| `pendiente_perito` | revision | `revision_pericial` | perito asignado |
| `revision_pericial` | borrador informe | `pendiente_informe` o `informe_borrador` | versionado |
| `informe_borrador` | validar informe | `informe_validado` | validacion office |
| `informe_validado` | calcular valoracion | `valoracion_calculada` | baremo aplicado |
| `valoracion_calculada` | emitir factura | `facturado` | solo roles finanzas |
| `facturado` | enviar informe | `enviado` | documento final generado |
| `enviado` | cierre manual | `cerrado` | sin pendientes |

## 3. Documento final, envio y acuse

- `vp_documento_final` requiere `vp_informes.estado = validado`
- `vp_envios` registra todos los intentos por `intento_numero`
- reintento solo permitido sobre `vp_envios.estado = error`
- acuse solo permitido sobre `vp_envios.estado = enviado`
- reintento y acuse deben generar `auditoria`, `eventos_dominio` y entrada de timeline

## 4. Watchdogs y jobs

Fuente actual: `apps/edge-api/src/scheduled.ts`

- `generate_alerts_batch` o fallback manual de alertas
- deteccion de `pedidos_material` caducados
- deteccion de `facturas` vencidas
- conteo de `v_informes_caducados`

Trigger configurado en `apps/edge-api/wrangler.toml`:

- `0 7 * * *`
- `0 13 * * *`

Estado de cierre:

- logica implementada localmente
- evidencia remota de ejecucion del worker: pendiente
