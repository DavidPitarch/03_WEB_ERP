# EP-13 - Paquete operativo final

Fecha de cierre: 2026-03-18
Estado: operativo para desarrollo, QA, implantacion y migracion

Este paquete sustituye como referencia operativa a los borradores previos de EP-13. Los documentos historicos se conservan, pero los artefactos vigentes para Sprint 5.5 son:

- `docs/architecture/ep13-matriz-maestra-datos.md`
- `docs/architecture/ep13-catalogo-formularios.md`
- `docs/architecture/ep13-modelo-fisico-consolidado.md`
- `docs/architecture/ep13-matriz-migracion.md`
- `docs/architecture/ep13-matriz-estados-automatizaciones.md`
- `docs/architecture/ep13-catalogo-documental-plantillas.md`
- `docs/architecture/ep13-plan-pruebas-funcionales-datos.md`

Uso por area:

| Area | Artefacto principal | Uso |
|---|---|---|
| Desarrollo | modelo fisico, matriz de estados, catalogo formularios | implementar tablas, endpoints, validaciones y flujos |
| QA | plan de pruebas, catalogo documental, matriz de datos | preparar casos, datasets y evidencias |
| Implantacion | matriz de migracion, matriz de datos | preparar cutover, limpieza y reconciliacion |
| Migracion | matriz de migracion, modelo fisico | mapear PWGS -> ERP y validar cargas |

Decision vigente:

- Sprint 5.5 se cierra con estos artefactos.
- EP-12 sigue cerrado.
