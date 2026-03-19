# PDF Pipeline — Estado actual: STUB NO OPERATIVO

Fecha: 2026-03-19
Estado: **STUB — No genera PDF real**
Prioridad de remediación: P3.1

---

## Qué hace hoy

La función `enqueuePartePdf()` en `apps/edge-api/src/services/pdf-pipeline.ts`:

1. Crea un registro en la tabla `documentos` con `estado: 'pendiente'`
2. Registra un audit log y un domain event (`DocumentoEncolado`)
3. **NO genera ningún archivo PDF**
4. **NO sube ningún archivo al bucket `documentos`**
5. El campo `_stub: true` en la respuesta señala este estado a los consumidores

## Qué NO hace (y debe quedar claro en demo)

- El `storage_path` registrado en `documentos` apunta a una ruta que **no existe** en el bucket
- No hay worker activo que procese la cola de documentos pendientes
- `processDocumentStub()` solo cambia el estado a `procesando` sin generar archivo

## Impacto en demo

- Al validar un parte de operario, la UI debe mostrar el banner:
  > ⚠️ Generación de PDF pendiente — el documento estará disponible cuando el procesador esté activo.
- **No mostrar ningún link de descarga** mientras `estado === 'pendiente'`
- **No prometer descarga de PDF en la presentación a negocio**

## Qué falta para hacerlo real (P3.1)

1. Decisión tecnológica: Supabase Edge Function con jsPDF / Cloudflare Queue + PDFKit / servicio externo
2. Activar `[[queues]]` en `wrangler.toml` o crear `supabase/functions/generate-pdf/index.ts`
3. Implementar generación real: datos del parte → HTML/JSON → PDF → upload al bucket `documentos`
4. Actualizar `estado` a `completado` con `storage_path` real tras upload exitoso
5. Gestión de errores: `estado: 'error'` + `error_detalle` si falla la generación

## Indicador de remediación

El stub queda cerrado cuando:
- [ ] `GET /storage/v1/object/documentos/{path}` devuelve un PDF real descargable
- [ ] `documentos.estado` = `'completado'` con `storage_path` no nulo
- [ ] La UI muestra el link de descarga en lugar del banner de pendiente
