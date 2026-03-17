# Sprint 5.5 Phase 0 - Production Gate

> Fecha de revision: 2026-03-17
> Estado general: bloqueado por despliegue pendiente en Supabase objetivo
> Decision vigente: EP-12 Customer Tracking sigue cerrado

## 1. Supabase objetivo

- [x] Proyecto objetivo alcanzable
- [x] `auth/v1/settings` responde `200`
- [ ] Esquema ERP desplegado
- [ ] Migracion `00017_r3a_transactional_core.sql` aplicada
- [ ] Migracion `00018_sprint55_phase0_rls_hardening.sql` aplicada
- [ ] Buckets privados creados: `documentos`, `evidencias`, `vp-artefactos`
- [ ] Seed minimo cargado: roles, user_roles, companias, empresas_facturadoras, operarios, usuarios internos

Evidencia remota actual:

- `companias_status = 404` con `PGRST205`
- `erp_create_expediente_status = 404` con `PGRST202`

Conclusion:

- El proyecto existe pero sigue vacio.
- No se puede validar transacciones reales ni RLS remota hasta aplicar migraciones y seed minima.

## 2. Backend y seguridad

- [x] Edge API endurecida por grupos de rol
- [x] Transacciones core encapsuladas en RPCs locales (`00017`)
- [x] Drift de timeline VP corregido en backend
- [x] Acceso a artefactos VP endurecido con verificacion de ambito y TTL de 15 min
- [x] Frontend backoffice consume signed URL via API autenticada
- [x] Tests unitarios del hardening añadidos
- [ ] Smoke test contra Supabase objetivo con esquema desplegado

## 3. RLS y datos sensibles

- [x] Nueva migracion `00018` preparada para rehacer policies de core, VP, finanzas, auditoria y eventos
- [x] Eliminados patrones inseguros en la nueva capa de hardening:
  - `USING (true)` en tablas VP sensibles
  - dependencia de `user_profiles.role`
  - nuevas policies basadas en `raw_user_meta_data`
  - TTL documental de 1 hora para artefactos VP
- [x] Corregido bootstrap SQL para proyecto vacio en `00005_r1b2_storage_policies.sql`
- [ ] Verificacion remota de RLS con usuarios reales y JWT de cada rol

## 4. Validacion tecnica local

- [x] `@erp/edge-api` tests verdes
- [x] `apps/edge-api` typecheck verde
- [x] `apps/backoffice-web` typecheck verde
- [ ] Ejecucion remota de RPCs con rollback y concurrencia sobre Supabase objetivo

## 5. Gate para abrir validacion remota transaccional

Solo se puede ejecutar la validacion de:

- `erp_create_expediente`
- `erp_create_cita`
- `erp_transition_expediente`
- rollback
- concurrencia

si se cumplen antes estos prerrequisitos:

1. migraciones aplicadas hasta `00018`
2. seed minima cargada
3. al menos un usuario interno valido en `auth.users`
4. al menos un `operario` activo con `user_id`
5. al menos una `compania` y una `empresa_facturadora`

## 6. Condicion de apertura de EP-12

EP-12 sigue cerrado mientras cualquiera de estos puntos siga pendiente:

1. esquema remoto no desplegado
2. RPCs core sin validar en remoto
3. RLS remota no verificada por rol
4. acceso documental no validado extremo a extremo
5. production gate de Phase 0 sin cerrar
