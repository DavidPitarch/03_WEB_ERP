# EP13 — Plan de Transicion PWGS a ERP

> Cutover plan por perfil, timeline y procedimientos
> Version: 1.0 | Fecha: 2026-03-15

---

## 1. Resumen Ejecutivo

Este documento define el plan completo de transicion del sistema legacy PWGS al nuevo ERP basado en Supabase para la gestion de siniestros. Cubre:

- Timeline detallado desde T-30 hasta T+7
- Impacto y cambios por rol de usuario
- Plan de formacion
- Estrategia de ejecucion en paralelo
- Criterios y procedimientos de rollback
- Plan de comunicacion
- Checklist GO/NO-GO

---

## 2. Timeline de Transicion

### T-30: Preparacion

| Accion | Responsable | Detalle |
|---|---|---|
| Completar migracion de datos (ensayo 1) | Equipo tecnico | ETL completo en entorno staging |
| Ejecutar validacion paralela completa | Equipo tecnico | Ver `ep13-validacion-paralela.md` |
| Configurar entorno de formacion | Administrador | Copia del ERP con datos de prueba |
| Comunicar plan a todos los roles | Direccion | Email + reunion informativa |
| Identificar usuarios piloto por rol | Supervisores | 1-2 personas por perfil |
| Documentar procedimientos criticos actuales en PWGS | Cada area | Para poder replicar en ERP |

### T-14: Formacion y Ensayo General

| Accion | Responsable | Detalle |
|---|---|---|
| Inicio de formacion por rol (ver seccion 5) | Equipo tecnico | Sesiones segun calendario |
| Ensayo de migracion 2 (con datos actualizados) | Equipo tecnico | ETL completo + validacion |
| Usuarios piloto comienzan pruebas en ERP | Usuarios piloto | Tareas reales en entorno de test |
| Recoger feedback y ajustes | Equipo tecnico | Iteracion sobre UX y flujos |
| Probar procedimiento de rollback | Equipo tecnico | Simulacro completo |
| Verificar integraciones externas | Equipo tecnico | APIs de companias, email, etc. |

### T-7: Preparacion Final

| Accion | Responsable | Detalle |
|---|---|---|
| Ensayo general de migracion (ensayo 3 - definitivo) | Equipo tecnico | Datos lo mas recientes posible |
| Validacion paralela completa + spot-check manual | Equipo tecnico + usuarios | 10% de registros |
| Completar formacion de todos los usuarios | Equipo tecnico | Sesiones de refuerzo |
| Distribuir guias rapidas por rol | Equipo tecnico | PDF / enlace a documentacion |
| Confirmar ventana de data freeze | Direccion + equipo tecnico | Acordar fecha y hora exactas |
| Preparar comunicacion de cutover | Direccion | Emails, avisos en PWGS |
| Revisar checklist GO/NO-GO (preliminar) | Comite de migracion | Primera pasada |

### T-1: Vispera del Cutover

| Accion | Responsable | Detalle |
|---|---|---|
| **INICIO DATA FREEZE en PWGS** | Administrador | Solo lectura o restriccion de escritura |
| Comunicar data freeze a todos los usuarios | Direccion | "No introducir datos nuevos en PWGS" |
| Ejecutar ETL definitivo | Equipo tecnico | Migracion final con datos congelados |
| Ejecutar validacion paralela completa | Equipo tecnico | Todos los checks |
| Reunion GO/NO-GO | Comite de migracion | Decision formal |
| Si GO: preparar DNS/URLs, accesos ERP | Administrador | Activar accesos de produccion |
| Si NO-GO: comunicar aplazamiento | Direccion | Plan B con nueva fecha |
| Backup completo de PWGS | Administrador | Snapshot para rollback |
| Backup completo de ERP pre-cutover | Administrador | Punto de restauracion |

### T0: Cutover (Dia de la Migracion)

| Hora (estimada) | Accion | Responsable |
|---|---|---|
| 06:00 | Verificar que data freeze sigue activo | Administrador |
| 06:30 | Ejecutar delta ETL (cambios de ultima hora si los hay) | Equipo tecnico |
| 07:00 | Validacion final post-ETL | Equipo tecnico |
| 07:30 | Activar ERP en produccion | Administrador |
| 07:45 | Desactivar escritura en PWGS (modo solo lectura) | Administrador |
| 08:00 | **Inicio de jornada laboral con ERP** | Todos los usuarios |
| 08:00-10:00 | Soporte presencial/remoto intensivo | Equipo tecnico |
| 10:00 | Primera revision de incidencias | Equipo tecnico |
| 13:00 | Segunda revision | Equipo tecnico |
| 18:00 | Cierre del dia: resumen de incidencias | Equipo tecnico |

### T+1: Primer Dia Completo

| Accion | Responsable | Detalle |
|---|---|---|
| Soporte dedicado (canal prioritario) | Equipo tecnico | Telefono + chat dedicado |
| Validacion de checksums (datos del dia) | Equipo tecnico | Verificar que operaciones nuevas son correctas |
| Recoger incidencias y clasificar | Equipo tecnico | Criticas vs. mejoras |
| Evaluar criterios de rollback | Comite de migracion | Si procede |
| Comunicar estado a direccion | Equipo tecnico | Informe de situacion |

### T+7: Estabilizacion

| Accion | Responsable | Detalle |
|---|---|---|
| Desactivar PWGS completamente (o archivar) | Administrador | Tras confirmar estabilidad |
| Revision final de validacion paralela | Equipo tecnico | Conteos + checksums |
| Cerrar incidencias pendientes | Equipo tecnico | Priorizando criticas |
| Retrospectiva de migracion | Todo el equipo | Lecciones aprendidas |
| Retirar soporte dedicado | Equipo tecnico | Volver a canales normales |
| Documentar configuraciones finales | Equipo tecnico | Estado real post-migracion |

---

## 3. Impacto por Rol

### 3.1 Administrador (Admin)

**Que cambia:**
- Panel de administracion migra de PWGS (PHP) a ERP (interfaz web Supabase-based)
- Gestion de usuarios via Supabase Auth en lugar de sistema propio de PWGS
- Configuracion de companias, baremos y partidas desde nuevas pantallas
- Logs y auditoria ahora en tablas PostgreSQL con RLS (Row Level Security)
- Backups automaticos via Supabase en lugar de mysqldump manual

**Que se mantiene:**
- Misma logica de permisos (admin ve todo)
- Misma estructura de datos de negocio

**Riesgos especificos:**
- Perder acceso a configuraciones avanzadas de PWGS no mapeadas
- RLS mal configurado podria exponer datos entre companias

### 3.2 Supervisor

**Que cambia:**
- Dashboard de seguimiento de expedientes rediseñado
- Asignacion de operarios a expedientes desde nueva interfaz
- Informes y KPIs generados desde PostgreSQL (posibilidad de vistas materializadas)
- Alertas y tareas internas ahora en sistema propio (tabla `alertas`, `tareas_internas`)
- Aprobacion de facturas y presupuestos con nuevo flujo

**Que se mantiene:**
- Puede ver todos los expedientes de su equipo
- Flujo basico: abrir expediente, asignar, supervisar, cerrar

**Riesgos especificos:**
- Informes historicos podrian mostrar datos migrados con formato diferente
- Metricas de rendimiento podrian variar por diferencias en timestamps

### 3.3 Tramitador

**Que cambia:**
- Creacion y edicion de expedientes en nueva interfaz
- Vinculacion con asegurados y companias desde buscador actualizado
- Carga de documentacion (adjuntos) via storage de Supabase
- Gestion de citas con calendario integrado (tabla `citas`)
- Estados de expediente pueden tener nombres ligeramente diferentes
- Busqueda de expedientes por multiples criterios (mas potente que PWGS)

**Que se mantiene:**
- Flujo de trabajo diario: recibir siniestro, crear expediente, gestionar
- Campos principales del expediente

**Riesgos especificos:**
- Curva de aprendizaje en nueva interfaz
- Posible confusion con estados renombrados

### 3.4 Financiero

**Que cambia:**
- Facturacion completa rediseñada (facturas, lineas, autofacturas)
- Pagos con trazabilidad completa (tabla `pagos` vinculada a factura y expediente)
- Presupuestos con lineas desglosadas
- Exportacion contable en nuevos formatos
- Conciliacion bancaria (si se implementa)
- Informes financieros desde vistas PostgreSQL

**Que se mantiene:**
- Conceptos: base imponible, IVA, IRPF, total
- Relacion factura-expediente-compania

**Riesgos especificos:**
- Numeracion de facturas: asegurar continuidad con el ultimo numero de PWGS
- Importes migrados deben cuadrar al centimo
- Periodos contables abiertos en PWGS podrian causar confusion

### 3.5 Operario

**Que cambia:**
- Partes de trabajo desde interfaz movil/web (no desde PWGS)
- Registro de horas, materiales y descripcion en formulario nuevo
- Firma digital de partes (si se implementa)
- Visualizacion de sus expedientes asignados y citas
- Pedidos de material asociados a expediente

**Que se mantiene:**
- Informacion que debe registrar (horas, descripcion, materiales)
- Relacion parte-expediente

**Riesgos especificos:**
- Operarios con menor habilidad tecnologica pueden necesitar mas soporte
- Acceso movil requiere verificar conectividad en campo

---

## 4. Matriz de Cambios Resumida

| Funcionalidad | Admin | Supervisor | Tramitador | Financiero | Operario |
|---|---|---|---|---|---|
| Login / Autenticacion | Cambia | Cambia | Cambia | Cambia | Cambia |
| Gestion de expedientes | Cambia UI | Cambia UI | Cambia UI | Solo lectura | Solo lectura |
| Facturacion | Config | Supervision | Crea borrador | Cambia completamente | No aplica |
| Partes de trabajo | Config | Supervision | Consulta | Consulta importes | Cambia UI |
| Presupuestos | Config | Aprueba | Crea | Revisa | No aplica |
| Pedidos de material | Config | Aprueba | Crea | Paga | Solicita |
| Informes | Todos | Su equipo | Basicos | Financieros | No aplica |
| Alertas/Tareas | Configura | Gestiona | Recibe | Recibe | Recibe |

---

## 5. Plan de Formacion por Rol

### 5.1 Calendario General

| Semana | Lunes | Martes | Miercoles | Jueves | Viernes |
|---|---|---|---|---|---|
| T-14 a T-10 | Admin (4h) | Supervisor (3h) | Financiero (4h) | Tramitador (3h) | Operario (2h) |
| T-10 a T-7 | Practica guiada (todos) | Practica guiada | Dudas Admin+Financ | Dudas Tram+Sup | Dudas Operario |
| T-7 a T-3 | Refuerzo segun necesidad | | | | |

### 5.2 Contenido por Rol

#### Administrador (4 horas)

1. **Sesion 1 (2h)**: Arquitectura del ERP, Supabase dashboard, gestion de usuarios y roles, configuracion de RLS
2. **Sesion 2 (2h)**: Configuracion de companias y baremos, backups, monitorizacion, gestion de errores de migracion

**Material**: Guia de administracion, acceso a Supabase dashboard, procedimientos de backup

#### Supervisor (3 horas)

1. **Sesion 1 (1.5h)**: Dashboard de expedientes, asignacion de operarios, seguimiento de estados, alertas
2. **Sesion 2 (1.5h)**: Informes y KPIs, aprobacion de presupuestos y facturas, gestion de tareas internas

**Material**: Guia de supervision, ejemplos de informes, flujo de aprobacion

#### Tramitador (3 horas)

1. **Sesion 1 (1.5h)**: Creacion de expedientes, busqueda avanzada, vinculacion con asegurados/companias, gestion de citas
2. **Sesion 2 (1.5h)**: Carga de documentacion, creacion de presupuestos y borradores de factura, pedidos de material

**Material**: Guia rapida de tramitacion, video tutoriales de flujos principales

#### Financiero (4 horas)

1. **Sesion 1 (2h)**: Facturacion completa (crear, editar, emitir), lineas de factura, autofacturas, numeracion
2. **Sesion 2 (2h)**: Pagos, conciliacion, presupuestos, exportacion contable, informes financieros

**Material**: Guia financiera, tabla de equivalencias PWGS-ERP para estados y campos, procedimiento de cierre mensual

#### Operario (2 horas)

1. **Sesion unica (2h)**: Acceso al sistema, visualizar expedientes asignados, crear partes de trabajo, registrar horas y materiales, solicitar pedidos de material

**Material**: Guia rapida plastificada (1 pagina), video tutorial de 5 minutos

---

## 6. Estrategia de Ejecucion en Paralelo

### 6.1 Periodo: T0 a T+14 (2 semanas)

Durante las dos primeras semanas post-cutover, PWGS permanece accesible en **modo solo lectura** como referencia.

| Sistema | Estado | Uso |
|---|---|---|
| ERP (Supabase) | **Produccion activa** | Todas las operaciones nuevas |
| PWGS | Solo lectura | Consulta de historico, verificacion |

### 6.2 Reglas del Periodo Paralelo

1. **Toda operacion nueva se realiza en el ERP**. Sin excepciones.
2. PWGS se usa unicamente para consultar datos historicos que no se encuentren en el ERP.
3. Si un usuario detecta una discrepancia entre PWGS y ERP, debe reportarla al equipo tecnico (no corregir en PWGS).
4. Los informes oficiales se generan desde el ERP desde T0.
5. No se permite la doble entrada de datos (introducir en ambos sistemas).

### 6.3 Verificaciones Durante el Paralelo

| Dia | Verificacion |
|---|---|
| T+1 | Conteo de operaciones nuevas en ERP, verificar que no hay escrituras en PWGS |
| T+3 | Checksum de facturas emitidas en los primeros dias |
| T+5 | Revision de incidencias acumuladas, ajustes si es necesario |
| T+7 | Validacion completa (conteo + checksums historicos + nuevos) |
| T+10 | Evaluacion: mantener o retirar acceso a PWGS |
| T+14 | Fin del paralelo: PWGS archivado |

---

## 7. Criterios y Procedimiento de Rollback

### 7.1 Criterios de Rollback (cualquiera de estos activa la evaluacion)

| Criterio | Severidad | Accion |
|---|---|---|
| Perdida de datos confirmada (registros migrados ausentes) | CRITICA | Rollback inmediato |
| Errores de calculo en facturacion (totales incorrectos) | CRITICA | Evaluar alcance, posible rollback |
| Mas del 20% de usuarios no pueden operar | CRITICA | Rollback si no se resuelve en 2h |
| Integraciones externas (APIs companias) no funcionan | ALTA | Rollback si no se resuelve en 4h |
| Incidencias menores generalizadas (UI, lentitud) | MEDIA | No rollback, fix-forward |
| Incidencias aisladas en funcionalidades secundarias | BAJA | No rollback, fix-forward |

### 7.2 Procedimiento de Rollback

**Tiempo estimado: 1-2 horas**

1. **Decision** (Comite de migracion, minimo 2 personas autorizadas)
   - Registrar motivo formal del rollback
   - Comunicar a todos los usuarios: "Volvemos a PWGS temporalmente"

2. **Capturar datos nuevos del ERP**
   ```sql
   -- Exportar operaciones creadas post-cutover (pwgs_id IS NULL)
   COPY (SELECT * FROM expedientes WHERE pwgs_id IS NULL AND created_at >= :cutover_timestamp)
   TO '/tmp/nuevos_expedientes.csv' WITH CSV HEADER;

   COPY (SELECT * FROM facturas WHERE pwgs_id IS NULL AND created_at >= :cutover_timestamp)
   TO '/tmp/nuevas_facturas.csv' WITH CSV HEADER;

   -- Repetir para cada entidad con datos nuevos
   ```

3. **Reactivar PWGS en modo escritura**
   - Restaurar permisos de escritura
   - Verificar que PWGS funciona correctamente

4. **Desactivar ERP**
   - Poner ERP en modo mantenimiento
   - Mantener datos para analisis

5. **Introducir manualmente los datos nuevos en PWGS**
   - Usar los CSVs exportados como referencia
   - Priorizar: facturas emitidas > expedientes nuevos > partes

6. **Comunicar el estado**
   - Email a todos: "PWGS operativo, ERP en pausa"
   - Programar nueva fecha de cutover

7. **Post-mortem**
   - Analizar causa raiz
   - Plan de correccion
   - Nueva fecha tentativa

### 7.3 Punto de No Retorno

Despues de **T+14**, el rollback se considera impracticable por:
- Volumen de datos nuevos introducidos en ERP
- Usuarios adaptados al nuevo sistema
- PWGS archivado sin actualizaciones de 2 semanas

A partir de T+14, la estrategia es exclusivamente **fix-forward**.

---

## 8. Plan de Comunicacion

### 8.1 Canales

| Canal | Uso | Audiencia |
|---|---|---|
| Email corporativo | Comunicaciones formales, fechas clave | Todos |
| Reunion presencial/videoconf | Formacion, GO/NO-GO | Por rol |
| Chat interno (Teams/Slack) | Soporte rapido post-cutover | Todos |
| Canal dedicado #migracion-erp | Incidencias y preguntas | Equipo tecnico + usuarios piloto |
| Telefono de soporte | Incidencias criticas T0-T+7 | Todos |

### 8.2 Calendario de Comunicaciones

| Fecha | Tipo | Emisor | Destinatarios | Contenido |
|---|---|---|---|---|
| T-30 | Email + reunion | Direccion | Todos | Anuncio del plan de migracion, fechas clave, que se espera de cada uno |
| T-14 | Email | Equipo tecnico | Todos | Inicio de formacion, calendario de sesiones, acceso al entorno de pruebas |
| T-7 | Email | Direccion | Todos | Confirmacion de fecha de cutover, recordatorio de data freeze |
| T-3 | Email | Equipo tecnico | Todos | Ultimos preparativos, guias rapidas adjuntas, canal de soporte |
| T-1 | Email + aviso en PWGS | Administrador | Todos | DATA FREEZE activo, no introducir datos nuevos en PWGS |
| T0 (07:30) | Email + chat | Equipo tecnico | Todos | ERP activo, enlaces de acceso, canal de soporte abierto |
| T0 (18:00) | Email | Equipo tecnico | Direccion + supervisores | Resumen del primer dia |
| T+1 | Email | Equipo tecnico | Todos | Estado de la migracion, incidencias conocidas, FAQ |
| T+3 | Email | Equipo tecnico | Direccion | Informe de progreso |
| T+7 | Email | Direccion | Todos | Balance de la primera semana, proximos pasos |
| T+14 | Email | Direccion | Todos | Fin del periodo paralelo, PWGS archivado, ERP es el sistema oficial |

### 8.3 Escalado de Incidencias

```
Nivel 1: Usuario reporta en canal #migracion-erp
    |
    v (si no resuelto en 30 min)
Nivel 2: Equipo tecnico asignado investiga
    |
    v (si afecta operativa o datos)
Nivel 3: Comite de migracion evalua rollback
    |
    v (si se decide rollback)
Nivel 4: Direccion autoriza y comunica
```

---

## 9. Ventana de Data Freeze

### 9.1 Definicion

Periodo en el que **no se introducen datos nuevos en PWGS** para permitir la migracion final sin perder informacion.

### 9.2 Duracion Recomendada

- **Inicio**: T-1 a las 20:00 (fin de jornada laboral)
- **Fin**: T0 a las 08:00 (inicio de operacion en ERP)
- **Duracion total**: ~12 horas (noche)

### 9.3 Implementacion Tecnica

```sql
-- Opcion A: Revocar permisos de escritura en PWGS (MySQL)
REVOKE INSERT, UPDATE, DELETE ON pwgs_database.* FROM 'usuario_app'@'%';
GRANT SELECT ON pwgs_database.* TO 'usuario_app'@'%';
FLUSH PRIVILEGES;

-- Opcion B: Poner la aplicacion PWGS en modo lectura (flag en config)
-- Modificar config de PWGS para mostrar banner "Sistema en modo consulta"
```

### 9.4 Excepciones

Si durante el data freeze surge un siniestro urgente:
1. Se registra en un formulario temporal (Excel/papel)
2. Se introduce en el ERP como primera operacion en T0
3. NO se introduce en PWGS

---

## 10. Checklist GO/NO-GO

Revisar en T-1, despues de la migracion final. Todos los items "Requerido" deben estar en "OK" para proceder.

### 10.1 Datos

| # | Check | Estado | Requerido |
|---|---|---|---|
| D1 | Conteo de registros coincide (tolerancia 0.1%) | [ ] OK / [ ] FAIL | Si |
| D2 | Checksums monetarios coinciden (tolerancia 1 EUR) | [ ] OK / [ ] FAIL | Si |
| D3 | Integridad referencial sin errores criticos | [ ] OK / [ ] FAIL | Si |
| D4 | Reglas de negocio validadas | [ ] OK / [ ] FAIL | Si |
| D5 | Spot-check 5% aprobado (>= 99% correcto) | [ ] OK / [ ] FAIL | Si |
| D6 | Secuencias reseteadas correctamente | [ ] OK / [ ] FAIL | Si |
| D7 | migration_errors < 0.5% del total | [ ] OK / [ ] FAIL | Si |

### 10.2 Sistema

| # | Check | Estado | Requerido |
|---|---|---|---|
| S1 | ERP accesible desde todos los puestos/dispositivos | [ ] OK / [ ] FAIL | Si |
| S2 | Autenticacion funciona para todos los roles | [ ] OK / [ ] FAIL | Si |
| S3 | RLS configurado y verificado | [ ] OK / [ ] FAIL | Si |
| S4 | Rendimiento aceptable (paginas < 3s) | [ ] OK / [ ] FAIL | Si |
| S5 | Backups automaticos configurados | [ ] OK / [ ] FAIL | Si |
| S6 | SSL/HTTPS activo | [ ] OK / [ ] FAIL | Si |
| S7 | Integraciones externas operativas | [ ] OK / [ ] FAIL | Si (si aplica) |

### 10.3 Personas

| # | Check | Estado | Requerido |
|---|---|---|---|
| P1 | Formacion completada para todos los roles | [ ] OK / [ ] FAIL | Si |
| P2 | Guias rapidas distribuidas | [ ] OK / [ ] FAIL | Si |
| P3 | Canal de soporte activado | [ ] OK / [ ] FAIL | Si |
| P4 | Equipo tecnico disponible T0 completo | [ ] OK / [ ] FAIL | Si |
| P5 | Comunicacion de cutover enviada | [ ] OK / [ ] FAIL | Si |
| P6 | Usuarios piloto confirman que pueden operar | [ ] OK / [ ] FAIL | Si |

### 10.4 Rollback

| # | Check | Estado | Requerido |
|---|---|---|---|
| R1 | Backup de PWGS realizado y verificado | [ ] OK / [ ] FAIL | Si |
| R2 | Backup de ERP pre-cutover realizado | [ ] OK / [ ] FAIL | Si |
| R3 | Procedimiento de rollback probado en ensayo | [ ] OK / [ ] FAIL | Si |
| R4 | Scripts de exportacion de datos nuevos preparados | [ ] OK / [ ] FAIL | Si |
| R5 | Personas autorizadas para decidir rollback identificadas | [ ] OK / [ ] FAIL | Si |

### 10.5 Decision

```
SI todos los items "Requerido" estan en OK:
    -> GO: Proceder con cutover segun plan

SI algun item "Requerido" esta en FAIL:
    -> NO-GO: Aplazar cutover
    -> Registrar motivo
    -> Definir acciones correctivas
    -> Programar nueva fecha (minimo T+3 desde correccion)
    -> Comunicar aplazamiento a todos los roles
```

---

## Apendice A: Contactos Clave

| Rol | Nombre | Contacto | Disponibilidad T0 |
|---|---|---|---|
| Responsable de migracion | (por definir) | | Completa |
| DBA / Tecnico Supabase | (por definir) | | Completa |
| Responsable PWGS | (por definir) | | Guardia |
| Direccion (decision rollback) | (por definir) | | Telefono |
| Soporte nivel 1 | (por definir) | | 08:00-20:00 |

---

## Apendice B: Documentos Relacionados

| Documento | Contenido |
|---|---|
| `ep13-etl-scripts.md` | Scripts ETL completos de migracion |
| `ep13-validacion-paralela.md` | Queries y procedimientos de validacion |
| `ep13-diccionario-datos.md` | Diccionario de datos del ERP |
| `ep13-matriz-migracion.md` | Mapeo de campos PWGS a ERP |
| `ep13-deduplicacion.md` | Estrategia de deduplicacion |
