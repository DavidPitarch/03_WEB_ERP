# EP-13 — Reglas de deduplicación y normalización

## Asegurados

### Clave de deduplicación
1. **DNI/NIE exacto** (prioridad máxima): si coincide, merge
2. **Nombre + teléfono**: normalizar nombre (trim, uppercase, quitar acentos) + teléfono (solo dígitos, +34 prefix)
3. **Nombre + dirección**: fuzzy match nombre (Levenshtein ≤ 2) + dirección normalizada

### Normalización
- Nombre: `TRIM(UPPER(UNACCENT(nombre)))`, eliminar títulos (D., Dña., Sr.)
- DNI: quitar espacios, guiones; uppercase letra final
- Teléfono: solo dígitos, quitar prefijo +34/0034 si 9 dígitos resultantes
- Email: lowercase, trim

### Conflictos
- Si 2+ registros PWGS matchean al mismo asegurado ERP: merge conservando dato más reciente (por fecha)
- Log de merges para auditoría

## Compañías aseguradoras

### Clave de deduplicación
1. **CIF exacto** (normalizado: sin espacios ni guiones, uppercase)
2. **Nombre fuzzy** (Levenshtein ≤ 3 sobre nombre normalizado)

### Normalización
- CIF: `UPPER(REPLACE(REPLACE(cif, '-', ''), ' ', ''))`
- Nombre: eliminar sufijos (S.A., S.L., SLU, etc.), UPPER, UNACCENT

## Proveedores

### Clave de deduplicación
1. **CIF exacto**
2. **Nombre + ciudad** (fuzzy)

## Operarios

### Clave de deduplicación
1. **CIF/NIF exacto** (si existe)
2. **Nombre + teléfono**

### Normalización
- Gremios: mapear nombres legacy → códigos catálogo ERP
- es_subcontratado: derivar de tipo_contrato PWGS (autónomo/empresa → true)

## Expedientes

### Clave de deduplicación
- **referencia_externa** (número siniestro compañía): unique por compañía
- Si referencia_externa duplicada para misma compañía → posible duplicado, flag para revisión manual

## Reglas generales

1. Todos los campos texto: TRIM antes de comparar
2. Campos NULL no participan en match (no se deduplica por NULL = NULL)
3. Log detallado de todas las decisiones de merge/dedup
4. Tabla `migration_conflicts` para casos que requieren intervención manual
5. Dry-run obligatorio antes de migración real
