# Sprint 5.5 - Deployment & Security Gate Runbook

> Fecha: 2026-03-17
> Alcance: bootstrap remoto minimo, validacion de `00017`/`00018`, cierre del gate tecnico
> Restriccion vigente: EP-12 Customer Tracking sigue cerrado

## 1. Estado actual confirmado

- El proyecto objetivo `noskdlxrprinfwosjebw` responde en `auth/v1/settings`.
- El proyecto sigue vacio a nivel ERP:
  - `companias` devuelve `404 / PGRST205`
  - `erp_create_expediente` devuelve `404 / PGRST202`
  - `erp_create_cita` devuelve `404 / PGRST202`
  - `erp_transition_expediente` devuelve `404 / PGRST202`
- El repo no tiene `supabase/config.toml`, asi que la ruta CLI requiere `supabase init` antes de `supabase link`.
- La seed actual (`001_roles_catalogos.sql` + `002_demo_data.sql`) no cubre `auth.users`, `user_profiles`, `user_roles` ni `operarios.user_id`.

## 2. Prerrequisitos tecnicos

Necesitas una de estas dos rutas antes de tocar remoto:

1. `supabase` CLI enlazado al proyecto objetivo y password de la base de datos del proyecto.
2. Conexion `psql` o credenciales Postgres equivalentes.

Adicionalmente:

- `psql` disponible en la maquina si se va a ejecutar SQL por linea de comandos.
- `node` disponible para los scripts auxiliares.
- Variables de entorno preparadas:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_DB_URL` o password para `supabase link`

## 3. Plan exacto de aplicacion remota

### Paso 0. Validacion previa del proyecto vacio

```powershell
$env:SUPABASE_URL = "https://noskdlxrprinfwosjebw.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role>"
$env:SUPABASE_ANON_KEY = "<anon-key>"
node apps/edge-api/scripts/validate-supabase-phase0.mjs --expect-empty
```

Resultado esperado:

- `auth_status = 200`
- `companias_status = 404`
- `rpc_create_expediente_status = 404`
- `rpc_create_cita_status = 404`
- `rpc_transition_expediente_status = 404`

### Paso 1A. Ruta recomendada con Supabase CLI

```powershell
supabase init
supabase login
supabase link --project-ref noskdlxrprinfwosjebw
supabase db push
```

Notas:

- `supabase init` es obligatorio porque el repo no incluye `supabase/config.toml`.
- `supabase link` va a pedir el password de la base de datos del proyecto.
- `supabase db push` debe dejar aplicadas las migraciones hasta `00018` incluida.

### Paso 1B. Ruta alternativa con `psql`

Si no hay CLI enlazado pero si `SUPABASE_DB_URL`:

```powershell
Get-ChildItem supabase/migrations/*.sql |
  Sort-Object Name |
  ForEach-Object {
    psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f $_.FullName
  }
```

Esta ruta debe dejar aplicado el mismo estado que `db push`: `00001` .. `00018`.

### Paso 2. Crear buckets privados obligatorios

```powershell
@'
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('documentos', 'documentos', false),
  ('evidencias', 'evidencias', false),
  ('vp-artefactos', 'vp-artefactos', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;
'@ | psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1
```

### Paso 3. Crear usuarios auth minimos

```powershell
$env:SUPABASE_URL = "https://noskdlxrprinfwosjebw.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role>"
$env:ERP_GATE_ADMIN_EMAIL = "admin.gate@tu-dominio.local"
$env:ERP_GATE_SUPERVISOR_EMAIL = "supervisor.gate@tu-dominio.local"
$env:ERP_GATE_TRAMITADOR_EMAIL = "tramitador.gate@tu-dominio.local"
$env:ERP_GATE_FINANCIERO_EMAIL = "financiero.gate@tu-dominio.local"
$env:ERP_GATE_OPERARIO_EMAIL = "operario.gate@tu-dominio.local"
node apps/edge-api/scripts/bootstrap-supabase-auth-users.mjs
```

Salida esperada:

```json
{
  "admin": { "id": "...", "email": "...", "role": "admin" },
  "supervisor": { "id": "...", "email": "...", "role": "supervisor" },
  "tramitador": { "id": "...", "email": "...", "role": "tramitador" },
  "financiero": { "id": "...", "email": "...", "role": "financiero" },
  "operario": { "id": "...", "email": "...", "role": "operario" }
}
```

### Paso 4. Cargar seed minima operativa

Primero define la funcion seed:

```powershell
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/seed/003_phase0_remote_min_seed.sql
```

Despues ejecuta la seed con los UUID devueltos por el paso 3:

```powershell
psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -c "SELECT * FROM public.erp_phase0_seed_minimo('<admin_user_id>', '<supervisor_user_id>', '<tramitador_user_id>', '<financiero_user_id>', '<operario_user_id>', 'operario.gate@tu-dominio.local');"
```

Resultado minimo esperado:

- 1 compania operativa
- 1 empresa facturadora operativa
- 1 operario activo con `user_id`
- `user_profiles` cargado para admin, supervisor, tramitador, financiero y operario
- `user_roles` cargado para esos usuarios

### Paso 5. Validacion de disponibilidad remota

```powershell
$env:SUPABASE_URL = "https://noskdlxrprinfwosjebw.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role>"
$env:SUPABASE_ANON_KEY = "<anon-key>"
node apps/edge-api/scripts/validate-supabase-phase0.mjs --expect-ready
```

Resultado esperado:

- `companias_status != 404`
- `rpc_create_expediente_status != 404`
- `rpc_create_cita_status != 404`
- `rpc_transition_expediente_status != 404`
- `storage_bucket_names` contiene `documentos`, `evidencias` y `vp-artefactos`

## 4. Checklist de validacion remota obligatoria

### A. Transacciones core

- Crear expediente por RPC con `asegurado_nuevo`.
- Verificar `historial_estados` inicial (`NUEVO`).
- Verificar `auditoria` para `expedientes`.
- Verificar `eventos_dominio` con `ExpedienteCreado`.
- Transicionar `NUEVO -> NO_ASIGNADO`.
- Transicionar `NO_ASIGNADO -> EN_PLANIFICACION`.
- Crear cita valida y verificar:
  - fila en `citas`
  - `auditoria` en `citas`
  - `eventos_dominio` con `CitaAgendada`
  - `expedientes.operario_id` actualizado cuando estaba `NULL`

### B. Rollback

- Ejecutar `erp_create_expediente` con `asegurado_nuevo` valido pero `compania_id` invalido.
- Confirmar que no queda asegurado huerfano creado.
- Ejecutar `erp_create_cita` con franja invalida.
- Confirmar que no se inserta cita.

### C. Concurrencia basica

- Lanzar al menos dos `erp_create_expediente` en paralelo.
- Confirmar dos `numero_expediente` distintos y secuenciales.
- Confirmar una sola linea de `historial_estados` inicial por expediente.

### D. RLS por rol

- `admin` y `supervisor` deben leer expedientes del backoffice.
- `financiero` debe leer facturas/pagos pero no escribir expedientes.
- `operario` solo debe ver sus citas, partes y evidencias asignadas.
- Acceso directo a `vp_documento_final`, `vp_informes_valoracion`, `facturas`, `pagos`, `auditoria`, `eventos_dominio` debe respetar RLS segun rol.

### E. Documentos y signed URLs

- Subir un artefacto controlado al bucket `vp-artefactos`.
- Obtener signed URL via backend o flujo previsto.
- Confirmar expiracion corta y acceso auditado.
- Confirmar que un rol no autorizado no obtiene URL valida ni acceso directo.

## 5. Evidencias de ejecucion disponibles hoy

Evidencia ya ejecutada sobre el proyecto objetivo vacio:

- `auth/v1/settings` responde `200`
- `companias` responde `404 / PGRST205`
- `erp_create_expediente` responde `404 / PGRST202`
- `erp_create_cita` responde `404 / PGRST202`
- `erp_transition_expediente` responde `404 / PGRST202`

Eso confirma:

- proyecto correcto alcanzable
- ausencia de esquema remoto ERP
- ausencia de buckets y RPCs del core

## 6. Riesgos abiertos

1. Sin `supabase link` o `SUPABASE_DB_URL` no se puede aplicar SQL real en remoto.
2. Sin usuarios auth reales no se puede verificar RLS por rol ni acceso documental extremo a extremo.
3. Sin bucket privado y artefacto real no se puede cerrar la validacion de signed URLs.
4. Hasta completar esta checklist no debe abrirse hardening final EP-11B ni EP-13 en modo de cierre.

## 7. Criterio de cierre del gate

El gate tecnico solo pasa a `GO` cuando se cumplan todos estos puntos:

1. migraciones `00001` .. `00018` aplicadas
2. buckets privados creados
3. seed minima cargada con usuarios auth enlazados
4. RPCs core validados en remoto
5. rollback y concurrencia validados
6. RLS por rol validada
7. acceso documental signed URL validado extremo a extremo

Hasta entonces, el estado es `NO-GO`.
