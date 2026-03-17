# EP-11B — Política de consentimiento y retención

## Principios

1. **Minimización de datos**: solo recopilar lo necesario para la peritación
2. **Consentimiento informado**: el cliente debe ser informado antes de iniciar la sesión
3. **Base legal**: ejecución de contrato de seguro (RGPD Art. 6.1.b) + interés legítimo para grabación (Art. 6.1.f)
4. **Transparencia**: informar al cliente qué se graba, para qué, cuánto tiempo se conserva

## Consentimientos requeridos

| Tipo | Momento | Obligatorio | Forma |
|---|---|---|---|
| Videoperitación | Al agendar | Sí | Aceptación verbal + registro |
| Grabación vídeo | Pre-sesión | Sí | Banner en plataforma + registro ERP |
| Grabación audio | Pre-sesión | Sí | Banner en plataforma + registro ERP |
| Transcripción | Post-sesión | Informativo | Se deriva del consentimiento audio |
| Uso en informe | Pre-informe | Implícito | Contrato seguro |

## Modelo de datos consentimiento

```sql
CREATE TABLE vp_consentimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  videoperitacion_id uuid REFERENCES vp_videoperitaciones(id),
  tipo text NOT NULL, -- 'videoperitacion', 'grabacion_video', 'grabacion_audio', 'transcripcion'
  estado text NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'otorgado', 'denegado', 'revocado'
  otorgado_por text, -- nombre o identificador del otorgante
  otorgado_at timestamptz,
  canal text, -- 'verbal', 'email', 'plataforma', 'formulario'
  ip text,
  evidencia_ref text, -- referencia a grabación del consentimiento si aplica
  base_legal text DEFAULT 'RGPD Art. 6.1.b - Ejecución contrato',
  notas text,
  created_at timestamptz DEFAULT now()
);
```

## Retención documental

| Activo | Retención | Tras retención |
|---|---|---|
| Datos caso VP | Duración expediente + 5 años | Anonimización |
| Grabación vídeo | 1 año desde sesión o fin reclamación | Eliminación |
| Audio | 1 año desde sesión o fin reclamación | Eliminación |
| Transcripción | Igual que audio | Eliminación |
| Informe pericial | 10 años (obligación fiscal) | Archivado frío |
| Factura VP | 10 años (obligación fiscal) | Archivado frío |
| Comunicaciones | Duración expediente + 2 años | Eliminación |
| Consentimientos | Duración expediente + 6 años | Archivado |
| Webhook logs | 90 días | Eliminación |

## Control de acceso

Acceso a grabaciones, audio y transcripciones restringido a:
- admin
- supervisor
- perito asignado al caso

Acceso denegado a: tramitador, financiero, operario, proveedor, cliente_final.

Cada acceso a grabación/audio/transcripción genera entrada en audit_log con:
- actor_id, tabla, registro_id, accion='ACCESS', timestamp

## Supresión / ejercicio de derechos

Si el asegurado ejerce derecho de supresión (RGPD Art. 17):
1. Verificar si hay base legal que prevalece (obligación fiscal, defensa reclamación)
2. Si no: eliminar datos personales, anonimizar comunicaciones, eliminar grabaciones
3. Registrar ejercicio en audit_log
4. Mantener registro de supresión por 3 años
