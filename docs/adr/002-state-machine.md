# ADR-002: Máquina de estados del expediente

## Estado: Aceptado

## Contexto
El expediente tiene un ciclo de vida complejo con múltiples estados y transiciones condicionadas. Debemos impedir saltos arbitrarios y garantizar trazabilidad.

## Decisión
Implementar una máquina de estados estricta en el paquete `@erp/domain`. Las transiciones permitidas se definen como mapa estático. Toda transición se valida en backend (edge-api) antes de persistir. Cada transición inserta en `historial_estados` y `auditoria`.

## Estados

NUEVO → NO_ASIGNADO → EN_PLANIFICACION → EN_CURSO → FINALIZADO → FACTURADO → COBRADO → CERRADO

Ramas: PENDIENTE, PENDIENTE_MATERIAL, PENDIENTE_PERITO, PENDIENTE_CLIENTE, CANCELADO.

## Reglas
- FINALIZADO requiere parte validado.
- FACTURADO requiere FINALIZADO previo.
- COBRADO requiere FACTURADO previo.
- CANCELADO accesible desde cualquier estado pre-FACTURADO.

## Consecuencias
- El frontend solo solicita transiciones; nunca las ejecuta.
- Toda transición genera evento de dominio.
