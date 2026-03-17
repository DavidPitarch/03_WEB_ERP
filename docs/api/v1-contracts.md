# API v1 — Contratos completos (R1)

Base: `/api/v1`
Auth: `Authorization: Bearer <supabase_jwt>`

---

## Expedientes

### `GET /expedientes`
Listado paginado con filtros.

Query params: `page`, `per_page` (max 100), `estado`, `compania_id`, `operario_id`, `prioridad`, `search`, `fecha_desde`, `fecha_hasta`.

Response: `{ data: PaginatedResult<Expediente>, error: null }`

### `GET /expedientes/:id`
Detalle completo con joins: compania, asegurado, operario, perito, empresa_facturadora.

### `POST /expedientes`
Crear expediente. Soporta asegurado existente o nuevo.

Body:
```json
{
  "compania_id": "uuid",
  "empresa_facturadora_id": "uuid",
  "tipo_siniestro": "agua",
  "descripcion": "...",
  "direccion_siniestro": "...",
  "codigo_postal": "08001",
  "localidad": "Barcelona",
  "provincia": "Barcelona",
  "numero_poliza?": "...",
  "numero_siniestro_cia?": "...",
  "prioridad?": "media",
  "fecha_limite_sla?": "ISO",
  "origen?": "manual",
  "referencia_externa?": "...",
  "asegurado_id?": "uuid",
  "asegurado_nuevo?": {
    "nombre": "...", "apellidos": "...", "telefono": "...",
    "direccion": "...", "codigo_postal": "...", "localidad": "...", "provincia": "..."
  }
}
```

Validaciones: campos obligatorios, debe indicar `asegurado_id` o `asegurado_nuevo`.
Side effects: auditoría + historial_estados + evento ExpedienteCreado.

### `POST /expedientes/:id/transicion`
Transición de estado validada contra máquina de estados.

Body: `{ "estado_nuevo": "EN_PLANIFICACION", "motivo?": "..." }`

Precondiciones: FINALIZADO requiere parte validado.
Side effects: auditoría + historial_estados + evento.

### `GET /expedientes/:id/timeline`
Timeline unificada: comunicaciones + historial_estados + citas, desc.

### `GET /expedientes/:id/historial`
Historial de estados del expediente.

---

## Ingesta (Intake)

### `POST /intake/claims`
Ingesta estructurada de siniestros desde sistemas externos.

Body: `IntakeClaimRequest` (ver @erp/types)

Deduplicación por: `referencia_externa`, `numero_siniestro_cia`, `poliza + telefono`.

Response:
```json
{
  "data": {
    "status": "created | duplicate_detected | validation_error",
    "expediente_id?": "uuid",
    "numero_expediente?": "EXP-2026-00001",
    "duplicate_of?": "EXP-2026-00005",
    "errors?": ["campo requerido"]
  }
}
```

---

## Citas

### `POST /citas`
Body: `{ expediente_id, operario_id, fecha, franja_inicio, franja_fin, notas? }`

Validaciones: expediente en estado permitido, operario activo, franja válida.

### `GET /citas?expediente_id=uuid`

---

## Comunicaciones

### `POST /comunicaciones`
Body: `{ expediente_id, tipo?: "nota_interna", asunto?, contenido }`

Tipos: `nota_interna`, `email_saliente`, `llamada`, `sms`.

### `GET /comunicaciones?expediente_id=uuid`

---

## Maestros

### Compañías
- `GET /masters/companias?activa=true`
- `POST /masters/companias` — `{ nombre, codigo, cif?, activa? }`
- `PUT /masters/companias/:id`

### Operarios
- `GET /masters/operarios?activo=true&gremio=fontaneria`
- `POST /masters/operarios` — `{ nombre, apellidos, telefono, email?, gremios?, zonas_cp? }`
- `PUT /masters/operarios/:id`

### Empresas facturadoras
- `GET /masters/empresas-facturadoras`

### Asegurados
- `GET /masters/asegurados?search=term`
- `POST /masters/asegurados`

### Catálogos
- `GET /masters/catalogos?tipo=tipo_siniestro`

---

## Bandejas

### `GET /bandejas/contadores`
Response: `{ data: { "NUEVO": 3, "EN_CURSO": 12, ... } }`

### `GET /bandejas/informes-caducados`
Citas pasadas sin parte de operario recibido.

---

## Búsqueda

### `GET /search?q=term`
Búsqueda universal en expedientes y asegurados.

Busca en: numero_expediente, descripcion, poliza, siniestro_cia, referencia_externa, nombre/apellidos/telefono/nif.

---

## Operator (PWA)

Todos los endpoints requieren usuario autenticado con operario activo vinculado.

### `GET /operator/me/agenda`
Agenda del operario autenticado. Query: `fecha_desde`, `fecha_fin`.
Response: `{ data: AgendaItem[] }` — citas con datos de expediente y asegurado.

### `GET /operator/claims/:id`
Detalle restringido del expediente (solo si asignado al operario).
Joins: asegurado, compañía, citas del operario, partes.

### `GET /operator/claims/:id/timeline`
Timeline reducida del expediente.

### `POST /operator/claims/:id/parts`
Enviar parte de operario.
Body:
```json
{
  "cita_id": "uuid",
  "resultado": "completada | pendiente | ausente | requiere_material",
  "trabajos_realizados": "...",
  "trabajos_pendientes?": "...",
  "materiales_utilizados?": "...",
  "observaciones?": "...",
  "requiere_nueva_visita?": false,
  "firma_storage_path?": "..."
}
```
Side effects: auditoría + evento ParteRecibido.

### `POST /operator/uploads/init`
Solicitar signed URL para subir evidencia.
Body: `{ expediente_id, filename, content_type }`
Response: `{ data: { path, signed_url, token } }`

### `POST /operator/uploads/complete`
Registrar evidencia subida.
Body: `{ expediente_id, cita_id?, storage_path, tipo, clasificacion?, descripcion? }`

### `GET /operator/claims/:id/evidencias`
Listar evidencias del expediente.

### `GET /expedientes/:id/partes`
Partes de operario del expediente (backoffice). Joins: operario, evidencias count.

---

## Formato

Éxito: `{ "data": {...}, "error": null }`
Error: `{ "data": null, "error": { "code": "...", "message": "..." } }`

Códigos: UNAUTHORIZED, NOT_FOUND, VALIDATION, INVALID_TRANSITION, INVALID_STATE, PRECONDITION_FAILED, DB_ERROR.

## Realtime

Tablas en `supabase_realtime`: expedientes, citas, comunicaciones, historial_estados.
Frontend subscribe vía `supabase.channel()`.
