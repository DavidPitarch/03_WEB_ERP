# Contrato Económico EP-08 — Facturación, Cobro y Tesorería

## 1. Series de Facturación

| Campo | Descripción |
|-------|-------------|
| codigo | Identificador corto (ej: "F", "R", "A") |
| nombre | Nombre descriptivo |
| prefijo | Prefijo en numero_factura (ej: "F-2026-") |
| empresa_facturadora_id | Empresa emisora vinculada |
| contador_actual | Último número emitido |
| activa | Si admite nuevas facturas |
| tipo | ordinaria, rectificativa, abono |

**Formato numeración:** `{prefijo}{año}-{secuencial_5_digitos}`
Ejemplo: `F-2026-00001`, `R-2026-00001`

## 2. Estados de Factura

```
borrador → emitida → enviada → cobrada
                  ↘ anulada
            enviada → cobrada
                   ↘ anulada
```

| Estado | Descripción | Editable |
|--------|-------------|----------|
| borrador | Creada, no emitida. Editable | Si |
| emitida | Emitida formalmente. Bloqueada | No |
| enviada | Enviada al pagador por canal | No |
| cobrada | Pago registrado | No |
| anulada | Anulada (requiere motivo) | No |

## 3. Estados de Cobro

| Estado | Descripción |
|--------|-------------|
| pendiente | Factura emitida, no vencida |
| vencida | Fecha vencimiento superada sin cobro |
| reclamada | Se ha realizado gestión de reclamación |
| cobrada | Pago confirmado |
| incobrable | Declarada incobrable (excepcional) |

## 4. Campos de Factura

### Obligatorios
- numero_factura (auto-generado desde serie)
- serie_id
- expediente_id
- presupuesto_id
- empresa_facturadora_id
- compania_id (pagador)
- fecha_emision
- fecha_vencimiento (default: emision + dias_vencimiento de compañía)
- base_imponible
- iva_porcentaje
- iva_importe
- total
- estado
- estado_cobro

### Calculados
- base_imponible = SUM(lineas.importe)
- iva_importe = base_imponible * iva_porcentaje / 100
- total = base_imponible + iva_importe
- dias_hasta_vencimiento = fecha_vencimiento - hoy

### Opcionales
- forma_pago
- cuenta_bancaria
- notas
- pdf_storage_path
- enviada_at
- enviada_por
- canal_envio (email, api, portal, manual)
- envio_resultado
- envio_error

## 5. Validaciones de Emisión

| Regla | Descripción |
|-------|-------------|
| V1 | Expediente debe estar en FINALIZADO |
| V2 | Presupuesto debe existir y estar aprobado |
| V3 | Presupuesto debe tener al menos 1 línea |
| V4 | Empresa facturadora debe tener CIF |
| V5 | Compañía pagadora debe existir |
| V6 | Serie de facturación debe estar activa |
| V7 | No puede existir otra factura no anulada para mismo expediente+serie |

## 6. Permisos por Rol

| Acción | admin | supervisor | tramitador | financiero |
|--------|-------|------------|------------|------------|
| Ver facturas | Si | Si | Solo sus exp. | Si |
| Emitir factura | Si | Si | No | Si |
| Enviar factura | Si | Si | No | Si |
| Registrar cobro | Si | No | No | Si |
| Anular factura | Si | No | No | Si |
| Exportar | Si | Si | No | Si |
| Config. series | Si | No | No | No |

## 7. Bandejas Operativas

### Pendientes de facturar
- Expedientes en FINALIZADO con presupuesto aprobado y sin factura no-anulada
- Filtros: compañía, empresa, fecha finalización, tipo siniestro

### Facturas caducadas (vencidas)
- Facturas con fecha_vencimiento < hoy AND estado_cobro NOT IN (cobrada, incobrable)
- Filtros: compañía, empresa, serie, antigüedad, estado_cobro

## 8. Protocolo de Envío por Compañía

Parametrizado en `companias.config` JSONB:
```json
{
  "facturacion": {
    "canal_envio": "email",
    "email_facturacion": "facturas@compania.com",
    "dias_vencimiento": 60,
    "forma_pago": "transferencia",
    "plantilla_email": "default",
    "reintentos_max": 3
  }
}
```

## 9. Seguimiento de Cobro / Reclamaciones

Tabla `seguimiento_cobro`:
- factura_id
- tipo: reclamacion, nota, contacto, gestion
- contenido
- proximo_contacto (fecha)
- actor_id
- created_at

## 10. Exportación Contable

Formato CSV con columnas:
serie, numero_factura, fecha_emision, fecha_vencimiento, empresa_cif, empresa_nombre, compania_nombre, base_imponible, iva_porcentaje, iva_importe, total, estado, estado_cobro, fecha_cobro, expediente_numero

Filtros: empresa, compañía, serie, estado, estado_cobro, fecha_desde, fecha_hasta
