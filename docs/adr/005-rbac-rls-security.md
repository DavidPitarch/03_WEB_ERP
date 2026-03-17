# ADR-005: Seguridad — RBAC + RLS

## Estado: Aceptado

## Contexto
Múltiples roles con niveles de acceso muy distintos. Datos sensibles de asegurados.

## Decisión
- RBAC con tablas `roles`, `permissions`, `user_roles`.
- RLS en Supabase para tablas sensibles (expedientes, asegurados, documentos).
- JWT de Supabase Auth con claims de rol.
- Edge API valida permisos antes de ejecutar casos de uso.
- Storage con buckets privados y signed URLs temporales (max 15 min).

## Consecuencias
- Doble barrera: RLS en DB + validación en API.
- Portales externos ven mínimo de datos.
- Auditoría de accesos.
