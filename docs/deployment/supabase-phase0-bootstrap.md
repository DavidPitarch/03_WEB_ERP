# Supabase Bootstrap - Sprint 5.5 Phase 0

## Estado actual

- El proyecto `noskdlxrprinfwosjebw` existe y responde en `auth/v1/settings`.
- El esquema ERP no esta desplegado todavia.
- `companias` y los RPCs `erp_create_expediente`, `erp_create_cita`, `erp_transition_expediente` deben devolver `404` hasta aplicar las migraciones.

## Credenciales necesarias para aplicar migraciones

Las claves `anon`, `publishable`, `secret` y `service_role` permiten validar el Data API, pero no bastan para aplicar SQL estructural sobre un proyecto vacio.

Para desplegar el esquema completo hace falta una de estas dos opciones:

1. acceso CLI ya enlazado al proyecto con `supabase link`
2. cadena de conexion Postgres o password del rol `postgres`

## Secuencia de bootstrap

1. Enlazar el proyecto con Supabase CLI o abrir conexion SQL al proyecto objetivo.
2. Aplicar `supabase/migrations` en orden.
3. Cargar seed minima operativa: roles, user_roles, companias, empresas_facturadoras, operarios, peritos y usuarios internos.
4. Ejecutar el script de validacion:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role>"
node apps/edge-api/scripts/validate-supabase-phase0.mjs --expect-ready
```

## Validacion del proyecto vacio

Mientras el proyecto siga vacio, la comprobacion correcta es:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role>"
$env:SUPABASE_ANON_KEY = "<anon-key>"
node apps/edge-api/scripts/validate-supabase-phase0.mjs --expect-empty
```

Resultado esperado:

- `auth_status = 200`
- `companias_status = 404`
- `rpc_create_expediente_status = 404`

## Gate antes de abrir validacion transaccional

- `00017_r3a_transactional_core.sql` aplicada en remoto
- roles y usuarios internos cargados
- al menos una `compania`, una `empresa_facturadora`, un `operario` activo y un usuario interno presentes
- buckets privados creados: `documentos`, `evidencias`, `vp-artefactos`
