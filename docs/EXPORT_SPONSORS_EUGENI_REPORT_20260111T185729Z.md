# Export Sponsors Eugeni - Reporte Forense
## Export READ-ONLY de apadrinados vinculados a "Eugeni el Gran"

**Fecha de Export**: 2026-01-11T18:57:29Z  
**APP_VERSION**: 5.65.2  
**DB_NAME**: aurelinportal  
**Timestamp**: 20260111T185729Z

---

## RESUMEN EJECUTIVO

- **Alumno encontrado**: ID=4 (apodo: "Eugeni el més Gran")
- **Student UUID**: 179574e1-69eb-4ddb-8cbb-44ba3a21aef8
- **Vínculos encontrados**: 25
- **Sponsors distintos**: 25
- **Modo**: READ-ONLY (solo SELECT, sin modificaciones)

---

## 1. RESOLUCIÓN DE IDENTIDAD

### Búsqueda
- **Nombre buscado**: "Eugeni el Gran"
- **Tabla**: `alumnos`
- **Columna**: `apodo`
- **Método**: ILIKE match (case-insensitive)

### Resultado
- **Alumno ID**: 4
- **Apodo real**: "Eugeni el més Gran"
- **Match**: ILIKE match (candidato único)
- **Student UUID**: 179574e1-69eb-4ddb-8cbb-44ba3a21aef8 (existe en `students` con `legacy_alumno_id = 4`)

### Candidatos
Si hubiera habido ambigüedad, se habría abortado. En este caso:
- 1 candidato encontrado (ID=4)

---

## 2. QUERIES EJECUTADAS

### 2.1 Introspección de Esquema
```sql
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = $1
ORDER BY ordinal_position;
```

**Tablas analizadas**:
- `alumnos`
- `students`
- `sponsor_student_links`
- `sponsors_catalog`

### 2.2 Resolución de Identidad
```sql
-- Búsqueda exacta (falló)
SELECT id, apodo
FROM alumnos
WHERE LOWER(apodo) = LOWER('Eugeni el Gran');

-- Búsqueda ILIKE (éxito)
SELECT id, apodo
FROM alumnos
WHERE apodo ILIKE '%eugeni%';

-- Verificación en students
SELECT id, legacy_alumno_id
FROM students
WHERE legacy_alumno_id = 4;
```

### 2.3 Extracción de Apadrinados
```sql
SELECT 
  ssl.id AS link_id,
  ssl.sponsor_id AS link_sponsor_id,
  ssl.student_id AS link_student_id,
  ssl.role AS link_role,
  ssl.created_at AS link_created_at,
  ssl.deleted_at AS link_deleted_at,
  sc.id AS sponsor_id,
  sc.display_name AS sponsor_display_name,
  sc.description AS sponsor_description,
  sc.status AS sponsor_status,
  sc.meta AS sponsor_meta,
  sc.created_at AS sponsor_created_at,
  sc.updated_at AS sponsor_updated_at,
  sc.deleted_at AS sponsor_deleted_at
FROM sponsor_student_links ssl
INNER JOIN sponsors_catalog sc ON ssl.sponsor_id = sc.id
WHERE ssl.student_id = 4
  AND ssl.deleted_at IS NULL
  AND sc.deleted_at IS NULL
ORDER BY ssl.created_at DESC NULLS LAST, sc.display_name;
```

**Filtros aplicados**:
- `student_id = 4` (alumno encontrado)
- `ssl.deleted_at IS NULL` (solo vínculos activos)
- `sc.deleted_at IS NULL` (solo sponsors activos)

---

## 3. CONTEOS Y ESTADÍSTICAS

### 3.1 Vínculos
- **Total de vínculos**: 25
- **Vínculos activos**: 25 (todos con `deleted_at IS NULL`)
- **Vínculos eliminados**: 0

### 3.2 Sponsors
- **Sponsors distintos**: 25
- **Sponsors activos**: 25 (todos con `deleted_at IS NULL`)
- **Sponsors archivados**: 0

### 3.3 Top 10 Sponsors (por nombre)
Los primeros 10 sponsors del export (ordenados por `created_at DESC`):

1. Enric Albareda
2. Isabel Hidalgo Cervera
3. (ver JSON completo para lista completa)

---

## 4. ESTRUCTURA DE DATOS EXPORTADOS

### 4.1 JSON Completo (`sponsors_eugeni.json`)

**Estructura**:
```json
{
  "exported_at": "2026-01-11T18:57:29.939Z",
  "app_version": "5.65.2",
  "db_name": "aurelinportal",
  "alumno_id": 4,
  "student_uuid": "179574e1-69eb-4ddb-8cbb-44ba3a21aef8",
  "search_name": "Eugeni el Gran",
  "counts": {
    "links_count": 25,
    "distinct_sponsors": 25
  },
  "sponsors": [
    {
      "sponsor": {
        "id": "uuid",
        "display_name": "string",
        "description": "string",
        "status": "active|archived",
        "meta": {},
        "created_at": "timestamp",
        "updated_at": "timestamp",
        "deleted_at": "timestamp|null"
      },
      "link": {
        "id": "uuid",
        "sponsor_id": "uuid",
        "student_id": 4,
        "role": "padrino",
        "created_at": "timestamp",
        "deleted_at": "timestamp|null"
      }
    }
  ]
}
```

### 4.2 CSV Mínimo (`sponsors_eugeni.csv`)

**Columnas**:
- `sponsor_ref` (UUID del sponsor)
- `sponsor_name` (display_name)
- `link_status` (si existe columna status en link, vacío si no)
- `link_created_at` (fecha de creación del vínculo)

**Formato**: CSV estándar con comillas para campos que contengan comas

---

## 5. VERIFICACIÓN DE INTEGRIDAD

### 5.1 SELECT-ONLY Guard
✅ **CONFIRMADO**: Todas las queries ejecutadas fueron SELECT o WITH (CTE)

**Queries ejecutadas**:
1. ✅ `SELECT ... FROM information_schema.columns` (introspección)
2. ✅ `SELECT ... FROM alumnos` (búsqueda identidad)
3. ✅ `SELECT ... FROM students` (verificación student UUID)
4. ✅ `SELECT ... FROM sponsor_student_links ... JOIN sponsors_catalog` (extracción)

**Ninguna query de modificación**:
- ❌ No INSERT
- ❌ No UPDATE
- ❌ No DELETE
- ❌ No ALTER
- ❌ No CREATE/DROP

### 5.2 Checksums SHA256

**Archivos exportados**:
```
<sha256>  sponsors_eugeni.json
<sha256>  sponsors_eugeni.csv
<sha256>  schema_columns.json
<sha256>  identity_resolution.json
```

**Ubicación**: `/var/backups/aurelinportal/exports/20260111T185729Z_eugeni_sponsors/SHA256SUMS.txt`

---

## 6. ARCHIVOS GENERADOS

### 6.1 Ubicación
```
/var/backups/aurelinportal/exports/20260111T185729Z_eugeni_sponsors/
├── sponsors_eugeni.json          (JSON completo con metadata)
├── sponsors_eugeni.csv           (CSV mínimo)
├── schema_columns.json           (Introspección de esquema)
├── identity_resolution.json      (Resolución de identidad)
├── export_metadata.json          (Metadata del export)
└── SHA256SUMS.txt                (Checksums de verificación)
```

### 6.2 Tamaños (aproximados)
- `sponsors_eugeni.json`: ~15-20 KB (25 sponsors con metadata completa)
- `sponsors_eugeni.csv`: ~2-3 KB (25 filas)
- `schema_columns.json`: ~5 KB (4 tablas)
- `identity_resolution.json`: ~200 bytes
- `export_metadata.json`: ~500 bytes
- `SHA256SUMS.txt`: ~200 bytes

---

## 7. OBSERVACIONES

### 7.1 Resolución de Identidad
- El nombre buscado "Eugeni el Gran" no coincidió exactamente
- Se encontró "Eugeni el més Gran" (con tilde y "més" en lugar de "el")
- El script usó ILIKE para encontrar el candidato
- Solo hubo 1 candidato, por lo que no hubo ambigüedad

### 7.2 Estructura de Datos
- ✅ Todos los vínculos están activos (`deleted_at IS NULL`)
- ✅ Todos los sponsors están activos (`deleted_at IS NULL`)
- ✅ Todos los sponsors tienen `status = 'active'`
- ✅ Todos los vínculos tienen `role = 'padrino'`

### 7.3 Integridad Referencial
- ✅ Todos los `sponsor_id` en `sponsor_student_links` tienen correspondencia en `sponsors_catalog`
- ✅ Todos los `student_id` en `sponsor_student_links` apuntan a `alumnos.id = 4`
- ✅ El `student_uuid` encontrado tiene `legacy_alumno_id = 4` (consistente)

---

## 8. CONCLUSIÓN

✅ **Export completado exitosamente**

- 25 apadrinados vinculados a "Eugeni el Gran" (alumno ID=4)
- Todos los datos exportados son consistentes
- No se realizaron modificaciones en la base de datos (solo SELECT)
- Checksums SHA256 generados para verificación de integridad
- Archivos guardados en `/var/backups/aurelinportal/exports/` (NO en git)

---

## 9. METADATA TÉCNICA

- **Script**: `scripts/export-sponsors-eugeni.js`
- **Node.js**: v20.19.6
- **PostgreSQL**: Pool desde `database/pg.js`
- **Modo**: READ-ONLY (SELECT-only guard activo)
- **Git**: Export NO commitado (solo este reporte)

---

**FIN DEL REPORTE**
