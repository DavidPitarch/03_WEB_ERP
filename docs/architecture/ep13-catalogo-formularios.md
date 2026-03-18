# EP-13 - Catalogo de formularios

Objetivo: inventario accionable de formularios, origen UI, destino de datos y validaciones minimas.

| Formulario | UI principal | Rol | Destino | Mutacion / flujo | Validaciones minimas |
|---|---|---|---|---|---|
| Login backoffice | `apps/backoffice-web/src/pages/LoginPage.tsx` | office | Auth | login Supabase | email valido, password obligatoria |
| Nuevo expediente | `apps/backoffice-web/src/pages/NuevoExpedientePage.tsx` | admin, supervisor, tramitador | `expedientes`, `asegurados` | `erp_create_expediente` | compania, empresa facturadora, direccion, asegurado y tipo siniestro obligatorios |
| Nueva cita | `apps/backoffice-web/src/components/NuevaCitaModal.tsx` | admin, supervisor, tramitador | `citas` | `erp_create_cita` | expediente en estado valido, operario activo, fecha y franja obligatorias |
| Gestion expediente | `apps/backoffice-web/src/pages/ExpedienteDetailPage.tsx` | office | `comunicaciones`, `historial_estados`, tablas vinculadas | RPC y endpoints de backoffice | no saltar estados, actor identificado, contenido trazable |
| Login operario | `apps/operator-pwa/src/pages/LoginPage.tsx` | operario | Auth | login Supabase | credenciales validas |
| Agenda operario | `apps/operator-pwa/src/pages/AgendaPage.tsx` | operario | lectura `citas`, `expedientes` | endpoints `/operator` | solo citas propias |
| Parte de operario | `apps/operator-pwa/src/pages/PartFormPage.tsx` | operario | `partes_operario` | endpoint `/partes` | expediente y cita propios, resultado y trabajos obligatorios |
| Subida de evidencias | `apps/operator-pwa/src/components/EvidenceUploader.tsx` | operario | `evidencias`, Storage | signed URL + confirmacion | bucket privado, clasificacion valida, mime/tamano informados |
| Firma cliente | `apps/operator-pwa/src/components/SignaturePad.tsx` | operario | `partes_operario`, Storage | parte + adjunto | no guardar firma sin parte asociado |
| Bandeja VP | `apps/backoffice-web/src/pages/VideoperitacionesPage.tsx` | office | `vp_videoperitaciones` | endpoints VP | filtros por estado, prioridad y perito |
| Detalle VP | `apps/backoffice-web/src/pages/VideoperitacionDetailPage.tsx` | office, perito | tablas `vp_*` | endpoints VP | permisos por rol, precondiciones por estado |
| Dictamen pericial | `apps/backoffice-web/src/pages/DictamenDetailPage.tsx` | perito, office | `vp_dictamenes`, `vp_dictamen_versiones` | endpoints dictamen | versionado, cambios auditables, no emitir sin datos minimos |
| Facturacion VP | `apps/backoffice-web/src/pages/VideoperitacionDetailPage.tsx` | admin, supervisor, financiero | `facturas`, `vp_facturas` | endpoint emitir factura VP | informe validado, valoracion calculada o validada |
| Documento final VP | `apps/backoffice-web/src/pages/VideoperitacionDetailPage.tsx` | perito, admin, supervisor | `vp_documento_final` | `POST /videoperitaciones/:id/documento-final/generar` | informe validado, branding disponible si aplica |
| Envio VP | `apps/backoffice-web/src/pages/VideoperitacionDetailPage.tsx` | admin, supervisor, financiero | `vp_envios` | `POST /videoperitaciones/:id/enviar-informe` | canal soportado, email obligatorio si canal `email` |

Notas operativas:

- Los formularios criticos no deben mutar tablas sensibles desde frontend; toda mutacion pasa por backend o RPC.
- EP-12 no forma parte de este catalogo porque sigue cerrado.
