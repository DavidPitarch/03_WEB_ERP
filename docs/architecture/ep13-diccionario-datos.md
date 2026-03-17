# EP-13 — Diccionario de datos maestros

## Compañías aseguradoras (`companias_aseguradoras`)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | text | Sí | Razón social |
| cif | text | Sí | CIF único |
| email | text | No | Email de contacto principal |
| telefono | text | No | Teléfono contacto |
| direccion | text | No | Dirección fiscal |
| activo | boolean | Sí | Default true |
| created_at | timestamptz | Auto | |

## Operarios (`operarios`)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | text | Sí | Nombre completo |
| telefono | text | No | Móvil de contacto |
| email | text | No | Email |
| gremios | text[] | Sí | Array de especialidades |
| activo | boolean | Sí | Default true |
| es_subcontratado | boolean | Sí | true = genera autofacturas |
| cif | text | No | CIF/NIF para autofacturación |
| datos_fiscales | jsonb | No | {razon_social, direccion, cp, ciudad} |
| cuenta_bancaria | text | No | IBAN para pagos |
| created_at | timestamptz | Auto | |

## Asegurados (`asegurados`)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | text | Sí | |
| apellidos | text | No | |
| dni | text | No | DNI/NIE, índice unique parcial |
| telefono | text | No | |
| email | text | No | |
| direccion | text | No | Dirección del siniestro |
| created_at | timestamptz | Auto | |

## Proveedores (`proveedores`)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | text | Sí | Razón social |
| cif | text | No | CIF, unique parcial |
| email | text | No | Email para pedidos |
| telefono | text | No | |
| direccion | text | No | |
| especialidades | text[] | No | Tipos material que suministra |
| notas | text | No | |
| activo | boolean | Sí | Default true |
| created_at | timestamptz | Auto | |

## Empresas facturadoras (`empresas_facturadoras`)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | text | Sí | Razón social |
| cif | text | Sí | CIF fiscal |
| direccion | text | No | Dirección fiscal |
| activo | boolean | Sí | |

## Catálogos (`catalogos`)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| tipo | text | Sí | Ej: tipo_siniestro, gremio, causa_pendiente |
| codigo | text | Sí | Código interno |
| descripcion | text | Sí | Texto visible |
| activo | boolean | Sí | |

### Tipos de catálogo existentes
- `tipo_siniestro`: agua, fuego, robo, RC, rotura_cristales, otros
- `gremio`: fontaneria, electricidad, albanileria, pintura, cerrajeria, cristaleria, limpieza
- `causa_pendiente`: PENDIENTE_INFORME, PENDIENTE_PERITAJE, PENDIENTE_MATERIAL, PENDIENTE_DOCUMENTACION
