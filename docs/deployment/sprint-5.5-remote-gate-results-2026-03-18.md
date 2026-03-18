# Sprint 5.5 Remote Gate Results

Fecha de ejecucion: 2026-03-18
Proyecto remoto: `noskdlxrprinfwosjebw`
Estado EP-12: cerrado

## 1. Estado del bootstrap remoto

Bootstrap remoto minimo completado sobre el proyecto objetivo.

- Buckets privados creados:
  - `documentos`
  - `evidencias`
  - `vp-artefactos`
- Usuarios auth creados o actualizados:
  - `admin.gate@erp.local`
  - `supervisor.gate@erp.local`
  - `tramitador.gate@erp.local`
  - `financiero.gate@erp.local`
  - `operario.gate@erp.local`
- Seed minima operativa ejecutada:
  - `compania_id = c0000001-0000-0000-0000-000000000001`
  - `empresa_facturadora_id = e0000001-0000-0000-0000-000000000001`
  - `operario_id = f0000001-0000-0000-0000-000000000001`

Validacion remota de disponibilidad:

- `auth_status = 200`
- `companias_status = 200`
- `storage_bucket_names = [documentos, evidencias, vp-artefactos]`
- Los RPCs core ya no devuelven `404`; responden como funciones activas y validan reglas/datos.

## 2. Evidencias de ejecucion remota

### Buckets

- `documentos` creado como bucket privado
- `evidencias` creado como bucket privado
- `vp-artefactos` creado como bucket privado

### Seed minima

Confirmado en remoto:

- 1 compania operativa
- 1 empresa facturadora operativa
- 1 usuario interno valido por rol (`admin`, `supervisor`, `tramitador`, `financiero`)
- 1 operario activo ligado a `user_id`
- `user_profiles` y `user_roles` cargados para los 5 usuarios bootstrap

## 3. Resultados del core transaccional

Expediente de validacion principal:

- `expediente_id = b845ec05-3bce-44f3-8693-7ab5af6f94aa`
- `numero_expediente = EXP-2026-00001`
- estado inicial confirmado: `NUEVO`

Pruebas ejecutadas:

1. `erp_create_expediente`
- OK
- `historial_estados`: 1 fila inicial `NULL -> NUEVO`
- `auditoria`: 1 fila inicial en `expedientes`
- `eventos_dominio`: 1 evento `ExpedienteCreado`

2. `erp_transition_expediente`
- OK `NUEVO -> NO_ASIGNADO`
- OK `NO_ASIGNADO -> EN_PLANIFICACION`
- OK `EN_PLANIFICACION -> EN_CURSO`
- Regla de negocio validada:
  - `EN_CURSO -> FINALIZADO` falla con `PRECONDITION_FAILED`
  - detalle: `No se puede finalizar sin parte validado`

3. `erp_create_cita`
- OK
- `cita_id = c2ff4db6-fcbb-489c-a688-d17ea1a95c8c`
- `auditoria`: 1 fila en `citas`
- `eventos_dominio`: 1 evento `CitaAgendada`
- `expedientes.operario_id` actualizado correctamente

4. Rollback
- `erp_create_expediente` con `compania_id` invalido:
  - falla con `23503`
  - `asegurados` antes = 0
  - `asegurados` despues = 0
  - no quedan huerfanos
- `erp_create_cita` con franja invalida:
  - falla con `VALIDATION`
  - `citas` antes = 1
  - `citas` despues = 1
  - no inserta cita

5. Concurrencia basica
- Expedientes creados en paralelo:
  - `EXP-2026-00002`
  - `EXP-2026-00003`
- numeros distintos y secuenciales
- `historial_estados` inicial: 1 fila por expediente

## 4. Resultados de RLS por rol

Fixtures usadas para RLS:

- `parte_id = 93be6919-0545-445a-a081-dd1782460f16`
- `evidencia_id = e4039c5e-d36c-4730-bebe-5a934dfe6d9f`
- `documento_id = 0998fdb1-fd5a-4b25-9e95-dda532264657`
- `factura_id = a3d33fd8-601a-4961-be4a-dd8d9aa41b3c`
- `pago_id = 3655fcf1-0b28-434f-a53d-8577bc256dd9`

Resultados:

- `admin`
  - `expedientes_visible = 1`
  - `auditoria_visible = 5`
  - `eventos_visible = 5`

- `supervisor`
  - `expedientes_visible = 1`

- `financiero`
  - `facturas_visible = 1`
  - `pagos_visible = 1`
  - intento de update directo sobre `expedientes`: `0 rows`
  - la descripcion del expediente no cambia

- `operario`
  - `expedientes_visible = 1`
  - `citas_visible = 1`
  - `partes_visible = 1`
  - `evidencias_visible = 1`
  - `documentos_visible = 0`
  - `facturas_visible = 0`
  - `pagos_visible = 0`
  - `auditoria_visible = 0`
  - `eventos_visible = 0`
  - `vp_documento_final_visible = 0`
  - `vp_informes_visible = 0`

Nota:

- El esquema usa `vp_informes`, no `vp_informes_valoracion`.

## 5. Validacion de acceso documental firmado

Artefacto privado de prueba subido a:

- bucket: `vp-artefactos`
- path: `b845ec05-3bce-44f3-8693-7ab5af6f94aa/vp-artefacto-1773861919360-912453.txt`

Resultados:

- Signed URL generada con contexto de backend/service role:
  - descarga OK
  - `signed_url_status = 200`
- Acceso publico directo al bucket privado:
  - bloqueado
  - `direct_public_status = 400`
- Acceso autenticado directo al objeto sin signed URL:
  - `admin_direct_authenticated_status = 400`
  - `operario_direct_authenticated_status = 400`
- Generacion directa de signed URL por `operario`:
  - denegada
  - respuesta observada: `Object not found`

Lectura operativa:

- el acceso real al artefacto queda controlado por signed URL emitida con privilegio backend
- el acceso directo desde cliente autenticado no puenteara el bucket privado

## 6. Incidencias encontradas y correcciones aplicadas

### Incidencia 1. Seed RPC rota en remoto

Problema:

- `erp_phase0_seed_minimo` declaraba `v_operario_id = 'o0000001-...'`
- ese literal no es UUID valido
- el bootstrap fallaba al ejecutar la seed

Correccion aplicada:

- se fijo la seed local en `supabase/seed/003_phase0_remote_min_seed.sql`
- se aplico migracion correctiva remota:
  - `supabase/migrations/20260318183000_fix_phase0_seed_rpc_uuid.sql`

### Incidencia 2. RLS core de `expedientes` rota por cadena `peritos -> auth.users`

Problema:

- lectura directa de `expedientes` con JWT devolvia:
  - `42501 permission denied for table users`
- causa raiz:
  - policy heredada de `expedientes` subconsultaba `peritos`
  - la RLS de `peritos` arrastraba acceso a `auth.users`

Correccion aplicada:

- migracion correctiva remota:
  - `supabase/migrations/20260318190000_fix_expedientes_core_rls.sql`
- `expedientes_operario_select` pasa a usar `public.current_operario_id()`
- `expedientes_perito_select` pasa a usar `public.current_perito_id()`

## 7. Checklist GO / NO-GO

Estado actual: `NO-GO condicionado`

Checklist:

- [x] migraciones remotas aplicadas y proyecto no vacio
- [x] buckets privados creados
- [x] bootstrap auth completado
- [x] seed minima operativa completada
- [x] `erp_create_expediente` validado en remoto
- [x] `erp_create_cita` validado en remoto
- [x] `erp_transition_expediente` validado en remoto
- [x] rollback validado
- [x] concurrencia basica validada
- [x] RLS core por rol validada con datos reales
- [x] acceso firmado sobre bucket privado validado
- [x] acceso directo no autorizado a finanzas/documentos bloqueado para operario
- [ ] validacion E2E del flujo signed URL via endpoint backend remoto desplegado
- [ ] validacion positiva de tablas VP con dataset VP real en remoto

Riesgos abiertos:

1. El flujo signed URL esta validado a nivel Supabase/backend-service-role, pero no contra un endpoint remoto desplegado del worker.
2. La validacion de VP es negativa para `operario` y estructural para oficina; no se ha sembrado una videoperitacion real para probar acceso positivo por alcance VP.

## 8. Confirmacion explicita sobre EP-12

EP-12 sigue cerrado.
