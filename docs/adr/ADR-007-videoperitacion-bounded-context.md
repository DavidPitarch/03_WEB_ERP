# ADR-007: Videoperitación como bounded context propio

## Estado
Aceptado (2026-03-15)

## Contexto
Gerencia ha solicitado que la videoperitación se trate como un módulo completo del ERP, no como una simple extensión del portal de peritos. El flujo cubre desde la recepción del encargo hasta la facturación del servicio, pasando por comunicaciones, agenda, sesión externa, evidencias, informe y valoración económica.

## Decisión
Modelar la videoperitación como un **bounded context propio** dentro del ERP con:
- Entidades independientes (videoperitaciones, sesiones, artefactos, comunicaciones VP, etc.)
- Relaciones explícitas con expediente, perito, compañía, baremo, factura
- Eventos de dominio específicos
- Adapter pattern para la plataforma externa de vídeo (vendor-agnostic)

## Alternativas descartadas
1. **Extensión directa del portal de peritos**: Insuficiente — el flujo VP tiene entidades, estados y reglas propias que no encajan en dictamenes_periciales.
2. **Módulo externo separado**: Excesivo — la VP necesita integración profunda con expedientes, baremos y facturación del ERP.

## Consecuencias
- Nuevo prefijo de tablas: `vp_*`
- Nuevo router: `/videoperitaciones`
- Nuevos eventos de dominio: `Videoperitacion*`
- El ERP NO construye videollamada nativa; integra plataforma externa via adapter
- Grabaciones y transcripciones se referencian por metadato; almacenamiento físico en proveedor externo con réplica opcional diferida
- Consentimiento modelado explícitamente (RGPD)

## Modelo de integración
```
ERP (orquestador) ←→ Adapter ←→ Plataforma externa de vídeo
                                    ↓
                              Webhooks → ERP
```

El adapter abstrae: crear sesión, generar enlace, recibir webhooks, consultar grabaciones/transcripciones. Cambiar de proveedor = cambiar adapter, no el dominio.
