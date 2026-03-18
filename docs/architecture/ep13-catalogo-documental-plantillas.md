# EP-13 - Catalogo documental y plantillas

## 1. Buckets y tablas documentales

| Bucket / tabla | Uso | Acceso |
|---|---|---|
| `documentos` | documentos ERP y adjuntos generados | bucket privado, signed URL o backend |
| `evidencias` | fotos y adjuntos de operario | bucket privado, upload via signed URL |
| `vp-artefactos` | grabaciones, capturas, adjuntos y artefactos VP | bucket privado, signed URL con TTL corto |
| `documentos` | indice documental ERP | RLS staff |
| `evidencias` | metadatos de evidencia | RLS por expediente/operario |
| `vp_artefactos` | metadatos de artefactos VP | RLS por scope office/perito |
| `vp_documento_final` | documento consolidado VP versionado | RLS endurecida en `00018` |
| `vp_envios` | intentos, errores, acuses y reintentos | RLS staff/finanzas |

## 2. Plantillas y salidas

| Salida | Origen | Formato | Estado |
|---|---|---|---|
| Documento final VP | `POST /videoperitaciones/:id/documento-final/generar` | JSON estructurado | activo |
| Email de envio VP | `POST /videoperitaciones/:id/enviar-informe` | HTML via Resend o dry-run | activo |
| Factura ERP por email | `sendFacturaEmail` | HTML | activo |
| Pedido proveedor por email | `sendPedidoEmail` | HTML con magic link | activo |

## 3. Reglas documentales

1. No exponer buckets como publicos.
2. No servir `storage_path` directo al frontend.
3. No emitir documento final VP sin informe validado.
4. Cada envio y reintento debe dejar rastro en `vp_envios`, `auditoria`, `eventos_dominio` y timeline.
5. Cada acuse debe persistir `acuse_at` y `acuse_detalle`.

## 4. Cierre Sprint 5.5

Cerrado:

- buckets privados creados en remoto
- signed URL validada a nivel Supabase / service role
- endpoint VP endurecido con validacion de canal, reintento trazable y acuse explicito

Pendiente para GO total:

- validacion E2E del flujo signed URL contra backend remoto desplegado
- dataset VP real para validacion positiva completa
