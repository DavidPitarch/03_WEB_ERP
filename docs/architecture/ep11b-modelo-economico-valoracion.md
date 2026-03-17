# EP-11B — Modelo económico: valoración y facturación del servicio VP

## Concepto

El servicio de videoperitación tiene un coste económico que debe:
1. Valorarse según baremos de la compañía aseguradora
2. Presupuestarse con desglose de líneas
3. Facturarse como servicio independiente o incluido en factura del expediente

## Componentes de la valoración

| Concepto | Fuente | Cálculo |
|---|---|---|
| Servicio VP base | Baremo compañía, partida "VP-BASE" | Precio fijo por sesión |
| Tiempo perito | Baremo compañía, partida "VP-HORA" | Duración sesión × precio/hora |
| Informe pericial | Baremo compañía, partida "VP-INFORME" | Precio fijo |
| Desplazamiento virtual | Baremo, si aplica | Fijo o 0 |
| Urgencia | Baremo, recargo si < 24h | % sobre base |
| Segundo intento | Baremo, si cliente_ausente + reagendado | Fijo |

## Flujo de valoración (Sprint 4)

```
1. Informe validado
2. Leer baremo vigente de la compañía del expediente
3. Seleccionar partidas VP aplicables automáticamente
4. Calcular importes por línea
5. Sumar base imponible
6. Aplicar IVA
7. Generar vp_valoracion con líneas
8. Revisar/ajustar (si rol lo permite)
9. Aprobar valoración
```

## Facturación del servicio (Sprint 5)

Opciones:
- **A) Factura independiente**: la VP se factura como servicio aparte con serie específica
- **B) Incluida en factura expediente**: las líneas VP se añaden a la factura general

Recomendación: **Opción A por defecto**, configurable por compañía.

### Reglas de facturación VP
- No emitir factura si informe no está en estado `validado` o superior
- Serie de facturación: VP-{year}-{seq} (serie dedicada)
- Empresa emisora: misma que el expediente
- Pagador: compañía aseguradora
- Vencimiento: según configuración compañía (default 30 días)

## Modelo de datos (Sprint 4-5)

```sql
-- Valoración
CREATE TABLE vp_valoraciones (
  id uuid PRIMARY KEY,
  videoperitacion_id uuid REFERENCES vp_videoperitaciones(id),
  baremo_id uuid REFERENCES baremos(id),
  baremo_version integer,
  base_imponible numeric DEFAULT 0,
  iva_porcentaje numeric DEFAULT 21,
  iva_importe numeric DEFAULT 0,
  total numeric DEFAULT 0,
  estado text DEFAULT 'borrador', -- borrador, aprobada, facturada
  aprobada_por uuid,
  aprobada_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Líneas de valoración
CREATE TABLE vp_valoracion_lineas (
  id uuid PRIMARY KEY,
  valoracion_id uuid REFERENCES vp_valoraciones(id) ON DELETE CASCADE,
  partida_baremo_id uuid REFERENCES partidas_baremo(id),
  concepto text NOT NULL,
  cantidad numeric DEFAULT 1,
  precio_unitario numeric NOT NULL,
  importe numeric NOT NULL,
  notas text,
  created_at timestamptz DEFAULT now()
);

-- Facturación VP (extiende factura existente)
-- La factura se crea en la tabla `facturas` existente con referencia:
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS videoperitacion_id uuid REFERENCES vp_videoperitaciones(id);
```
