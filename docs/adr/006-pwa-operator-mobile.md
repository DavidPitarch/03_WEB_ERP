# ADR-006: PWA para la app móvil del operario

## Estado
Aceptado

## Contexto
Los operarios de campo necesitan una aplicación móvil para gestionar su agenda, capturar evidencias fotográficas, recoger firmas y enviar partes de intervención. Las opciones evaluadas fueron:

1. **App nativa** (React Native / Flutter)
2. **PWA** (Progressive Web App con React + Vite)
3. **Hybrid** (Capacitor / Cordova wrapping PWA)

## Decisión
PWA con React + Vite + vite-plugin-pwa (Workbox).

## Razones
- **Sin fricción de distribución**: no requiere App Store/Play Store, acceso directo por URL
- **Stack unificado**: mismo React/TypeScript/Vite que el backoffice, reutiliza `@erp/types` y `@erp/domain`
- **Capacidades suficientes**: cámara (input file + capture), geolocation, canvas para firma, localStorage para offline queue, Service Worker para caching
- **Coste de mantenimiento**: un solo equipo mantiene web + PWA sin necesidad de conocimientos nativos
- **Iteración rápida**: deploy instantáneo sin revisión de app stores
- **Offline-first razonable**: Service Worker con NetworkFirst para datos, localStorage para borradores y cola de envío

## Consecuencias
- No acceso a push notifications nativas en iOS (limitación Safari/WebKit) — aceptable, usamos polling + email
- Cámara limitada a lo que ofrece `<input type="file" capture>` — suficiente para fotos de evidencia
- Sin acceso a NFC, Bluetooth u otros sensores nativos — no necesarios para el caso de uso
- Si en el futuro se requieren capacidades nativas, se puede wrappear con Capacitor sin reescribir

## Storage y seguridad
- Bucket `evidencias` privado en Supabase Storage
- Uploads via signed URLs (duración 1h) generadas por backend
- Path convention: `evidencias/{expediente_id}/{upload_id}.{ext}`
- Firma almacenada como imagen PNG en el mismo bucket
- No se exponen URLs públicas permanentes
