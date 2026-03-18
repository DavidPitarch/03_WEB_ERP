# EP-13 - Plan de pruebas funcionales y de datos

Objetivo: paquete minimo para QA, validacion de cutover y gate final.

## 1. Bloques funcionales

| Bloque | Alcance | Evidencia minima |
|---|---|---|
| F1 Core ERP | alta expediente, cita, transicion, rollback, concurrencia | resultados RPC y trazabilidad en `historial_estados` |
| F2 Seguridad | RLS por rol, acceso documental, signed URL, acceso directo denegado | matriz por rol y capturas/logs |
| F3 Videoperitacion | encargo, agenda, artefactos, informe, valoracion, documento final, envio, reintento, acuse | datos `vp_*`, timeline y auditoria |
| F4 Finanzas y logistica | factura, pago, pedido, cron de caducados/vencidas | registros y cambios de estado |
| D1 Migracion de datos | staging, deduplicacion, conteos, muestreo | reconciliacion origen/destino |
| O1 Operacion remota | worker, storage, runbooks, cron/watchdogs | logs y checklist GO/NO-GO |

## 2. Datasets obligatorios

| Dataset | Contenido minimo | Estado Sprint 5.5 |
|---|---|---|
| Bootstrap remoto | 1 compania, 1 empresa facturadora, usuarios auth, 1 operario activo | cerrado |
| Core transaccional | expediente, cita, parte, evidencia, documento, factura, pago | cerrado |
| VP positivo | VP con artefactos, informe validado, valoracion, documento final, envio real, acuse | pendiente parcial |
| PWGS extract | muestra anonimizda para matriz de migracion | pendiente de negocio |

## 3. Casos obligatorios

1. crear expediente remoto y verificar numeracion, auditoria y evento de dominio
2. crear cita remota y verificar reglas de estado
3. intentar acceso indebido a `facturas`, `pagos`, `documentos`, `vp_documento_final`
4. generar signed URL valida y comprobar denegacion de acceso directo
5. generar documento final VP con informe validado
6. enviar informe VP con canal valido y registrar intento
7. reintentar envio fallido y registrar `intento_numero`
8. registrar acuse y comprobar `acuse_at` + `acuse_detalle`
9. ejecutar watchdogs y verificar cambios en pedidos/facturas/alertas
10. reconciliar conteos de migracion entre staging y destino

## 4. Criterios de cierre

- sin errores P0 abiertos en core, seguridad o trazabilidad
- RLS validada por rol real
- acceso documental firmado validado
- artefactos EP-13 publicados
- checklist GO/NO-GO emitida
