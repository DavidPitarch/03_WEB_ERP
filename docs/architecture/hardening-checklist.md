# Hardening Checklist — R3-A

## Email real (Resend)
- [x] `email-sender.ts` con integración Resend API
- [x] Dry-run automático cuando `RESEND_API_KEY` no configurada
- [x] `sendFacturaEmail` — envío factura con audit trail
- [x] `sendPedidoEmail` — envío pedido con magic link
- [ ] Configurar `RESEND_API_KEY` en Cloudflare Worker secrets
- [ ] Configurar `CONFIRM_BASE_URL` en Cloudflare Worker secrets
- [ ] Verificar dominio de envío en Resend dashboard
- [ ] Test E2E envío real a buzón de pruebas

## Cloudflare Scheduled Worker (Cron)
- [x] `scheduled.ts` con función `scheduled()`
- [x] Alertas automáticas: tareas vencidas, partes pendientes >3 días
- [x] Detección pedidos caducados
- [x] Detección facturas vencidas
- [x] Detección informes caducados
- [ ] Añadir `[triggers] crons = ["0 6 * * *"]` en `wrangler.toml`
- [ ] Deploy worker con scheduled trigger habilitado

## RLS
- [x] Tests role isolation: staff vs non-staff para facturas y pedidos
- [x] Tests permisos cobro: solo admin + financiero
- [x] Test confirmación pedido pública (magic link sin auth)
- [ ] Audit RLS policies en Supabase dashboard tras aplicar migración 00010

## UX fixes
- [x] Baremo importer: dropdown compañía en vez de UUID manual
- [x] Navegación actualizada con Dashboard, Rentabilidad, Reporting, Autofacturas

## Pendiente para producción
- [ ] Rate limiting en endpoints públicos (confirm pedido)
- [ ] CORS: reemplazar `erp.tu-dominio.com` por dominio real
- [ ] Monitoring: alertas Cloudflare Workers errores
- [ ] Backup: verificar políticas backup Supabase
- [ ] Secrets rotation plan para RESEND_API_KEY y SUPABASE_SERVICE_ROLE_KEY
