# EP-11B — Flujo funcional completo de videoperitación

## Flujo principal (happy path)

```
1. Recepción encargo VP
   ├── Alta manual (backoffice)
   └── Alta por integración (API/webhook compañía)
        ↓
2. Registro datos
   ├── Vincular/crear expediente
   ├── Hoja de encargo
   ├── Declaración del siniestro
   ├── Asignar perito
   └── Tipificar: motivo, prioridad, deadline
        ↓
3. Contacto con cliente
   ├── Bandeja: pendientes de contactar
   ├── Intentos de contacto (llamada/email/SMS)
   ├── Registro resultado de cada intento
   └── SLA de contacto (máx. 24h desde encargo)
        ↓
4. Agendar videoperitación
   ├── Proponer franja horaria
   ├── Confirmar con cliente
   ├── Reagendar si necesario
   └── SLA de sesión (máx. 72h desde contacto)
        ↓
5. Envío de enlace
   ├── Generar enlace plataforma externa (via adapter)
   ├── Token + caducidad (24h pre-sesión)
   ├── Enviar por email/SMS
   ├── Registrar envío en timeline
   └── Reenviar si necesario (máx. 3 intentos)
        ↓
6. Sesión de videoperitación (plataforma externa)
   ├── Cliente se conecta
   ├── Perito se conecta
   ├── Sesión en curso (duración registrada)
   ├── Captura de evidencias durante sesión
   └── Sesión finalizada (webhook)
        ↓
7. Post-sesión: ingestión de artefactos (Sprint 2)
   ├── Fotos / capturas
   ├── Grabación de vídeo (metadato + ref externa)
   ├── Audio (metadato + ref externa)
   └── Transcripción (texto + resumen + highlights)
        ↓
8. Generación de informe (Sprint 3)
   ├── Borrador auto-generado con datos
   ├── Perito completa/edita
   ├── Revisión interna
   ├── Validación
   └── Versionado
        ↓
9. Valoración económica (Sprint 4)
   ├── Lectura baremo vigente por compañía
   ├── Selección partidas aplicables
   ├── Cálculo automático
   ├── Ajuste manual (si rol permite)
   └── Aprobación económica
        ↓
10. Facturación y envío (Sprint 5)
    ├── Generar factura servicio VP
    ├── Emitir (requiere informe validado)
    ├── Enviar informe + factura
    ├── Registrar acuse
    └── Seguimiento cobro
```

## Flujos alternativos

### Cliente ausente
`agendado → link_enviado → sesion_programada → cliente_ausente`
- Registrar ausencia como intento fallido
- Proponer reagendado (máx. 2 intentos)
- Si 2 ausencias: escalar a supervisor

### Sesión fallida (técnica)
`sesion_en_curso → sesion_fallida`
- Registrar incidencia técnica
- Reagendar automáticamente

### Cancelación
Posible desde cualquier estado pre-sesión:
- `pendiente_contacto → cancelado`
- `contactado → cancelado`
- `agendado → cancelado`
- Motivo obligatorio
- Si ya hay artefactos: soft-cancel (mantener datos)

### Reagendado
`agendado → pendiente_contacto` (si cliente solicita cambio)
`agendado → agendado` (cambio de franja sin reset)

## Comunicaciones

### Canales
| Canal | Entrante | Saliente |
|---|---|---|
| Llamada telefónica | Registrar resultado | Registrar intento |
| Email | Recibir (webhook futuro) | Enviar (Resend) |
| SMS | No soportado v1 | Futuro |
| Nota interna | N/A | Registrar |
| Sistema | Automático | Automático |

### Modelo de comunicación VP
Cada comunicación registra:
- tipo: llamada_entrante, llamada_saliente, email_entrante, email_saliente, nota_interna, sistema
- emisor_tipo: oficina, cliente, compania, perito
- resultado: contactado, no_contesta, buzon_voz, ocupado, email_enviado, email_rebotado
- contenido: texto libre
- adjuntos: referencia a storage
- registrado en timeline del expediente

## Roles y permisos VP

| Acción | admin | supervisor | tramitador | perito | financiero |
|---|---|---|---|---|---|
| Crear encargo VP | x | x | x | | |
| Ver VP asignadas | x | x | x | solo suyas | |
| Registrar comunicación | x | x | x | solo suyas | |
| Agendar | x | x | x | solo suyas | |
| Enviar enlace | x | x | x | | |
| Ver grabación/audio | x | x | | solo suyas | |
| Generar informe | x | | | solo suyas | |
| Validar informe | x | x | | | |
| Calcular valoración | x | x | | | x |
| Emitir factura VP | x | | | | x |
| Enviar informe final | x | x | | | |
