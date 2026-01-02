# CLASSIFICATION LIST ATTACHMENT v1

**Versión:** 1.0.0  
**Fecha:** 2025-01-02  
**Estado:** ✅ IMPLEMENTADO

---

## 🎯 Objetivo

Documentar el sistema canónico de asociación de clasificaciones (categories, subtypes, tags) a listas de transmutaciones, garantizando persistencia y proyección consistente usando el SOT global.

---

## 📜 Principios Constitucionales

1. **PostgreSQL es el único Source of Truth** para todas las clasificaciones.
2. **Toda asociación se persiste en `transmutacion_lista_classifications`** (tabla de relación).
3. **Toda lectura debe proyectar desde la tabla de relación** con JOINs canónicos.
4. **UI no confía en estado local**; siempre re-fetch tras mutaciones.
5. **Cualquier cambio de clasificación debe escribir en tabla relación y verificarse por GET**.

---

## 🗄️ Estructura de Base de Datos

### Tabla: `transmutacion_lista_classifications`

Tabla de relación many-to-many entre `listas_transmutaciones` y `pde_classification_terms`.

**Campos:**
- `lista_id` (INTEGER, PK, FK) - ID de la lista
- `classification_term_id` (UUID, PK, FK) - ID del término en SOT
- `created_at` (TIMESTAMPTZ) - Timestamp de creación

**Constraints:**
- `PRIMARY KEY (lista_id, classification_term_id)` - Evita duplicados
- `FOREIGN KEY (lista_id) REFERENCES listas_transmutaciones(id) ON DELETE CASCADE`
- `FOREIGN KEY (classification_term_id) REFERENCES pde_classification_terms(id) ON DELETE CASCADE`

**Índices:**
- `idx_transmutacion_lista_classifications_lista` - Búsqueda por lista_id
- `idx_transmutacion_lista_classifications_term` - Búsqueda por classification_term_id

---

## 🔧 Flujo de Escritura (Update)

### Función: `updateListClassification`

**Archivo**: `src/services/pde-transmutaciones-classification-service.js`

**Flujo:**
1. **Asegurar términos en SOT**: Para cada `category_key`, `subtype_key`, y cada tag en `tags[]`, usar `ensureClassificationTerm` para crear/obtener el término en `pde_classification_terms`.
2. **Eliminar relaciones existentes**: Para category/subtype (type='key'/'subkey'), eliminar todas las relaciones existentes para esta lista. Para tags (type='tag'), eliminar todas las relaciones de tags.
3. **Insertar nuevas relaciones**: Insertar en `transmutacion_lista_classifications` las nuevas relaciones (category, subtype, tags).
4. **Compatibilidad legacy**: Por compatibilidad, también actualizar columnas directas en `listas_transmutaciones` (`category_key`, `subtype_key`, `tags`).

**Logs estructurados:**
- `[CLASSIFICATION][ATTACH] lista_id=.. type=key term_id=.. key=..`
- `[CLASSIFICATION][ATTACH] lista_id=.. type=subkey term_id=.. key=..`
- `[CLASSIFICATION][ATTACH] tags lista_id=.. tags_count=..`

---

## 🔍 Flujo de Lectura (GET)

### Función: `getListWithClassification`

**Archivo**: `src/infra/repos/pde-transmutation-classification-repo-pg.js`

**Query canónica:**
```sql
SELECT 
  l.id,
  l.nombre,
  l.tipo,
  l.descripcion,
  l.activo,
  l.orden,
  l.created_at,
  l.updated_at,
  -- Category (type='key')
  (SELECT ct.value
   FROM transmutacion_lista_classifications tlc
   INNER JOIN pde_classification_terms ct ON tlc.classification_term_id = ct.id
   WHERE tlc.lista_id = l.id AND ct.type = 'key' AND ct.status = 'active'
   LIMIT 1) as category_key,
  -- Subtype (type='subkey')
  (SELECT ct.value
   FROM transmutacion_lista_classifications tlc
   INNER JOIN pde_classification_terms ct ON tlc.classification_term_id = ct.id
   WHERE tlc.lista_id = l.id AND ct.type = 'subkey' AND ct.status = 'active'
   LIMIT 1) as subtype_key,
  -- Tags (type='tag') - array
  COALESCE(
    (SELECT json_agg(ct.value ORDER BY ct.value)
     FROM transmutacion_lista_classifications tlc
     INNER JOIN pde_classification_terms ct ON tlc.classification_term_id = ct.id
     WHERE tlc.lista_id = l.id AND ct.type = 'tag' AND ct.status = 'active'),
    '[]'::json
  ) as tags
FROM listas_transmutaciones l
WHERE l.id = $1
```

**Características:**
- JOINs con `transmutacion_lista_classifications` y `pde_classification_terms`
- Filtrado por `status='active'` en términos
- Category/subtype: un único valor (LIMIT 1)
- Tags: array JSON de valores

---

## 🌐 UI MASTER (Alquimia General)

### Flujo de Mutación

1. **Usuario selecciona/crea clasificación**: En `ClassificationEditableSelector`, el handler `onSelect` llama a `updateLista` con `{ classification: { category_key: value } }` o similar.
2. **Actualización**: `updateLista` hace `PUT /master/api/alquimia-general/listas/:id` con el patch.
3. **Backend procesa**: El endpoint llama a `updateListClassification`, que persiste en `transmutacion_lista_classifications`.
4. **Refetch obligatorio**: `updateLista` llama a `loadListas()` y `setListaActivaAndRender()` para re-cargar desde el backend.
5. **Proyección**: `getListWithClassification` proyecta desde `transmutacion_lista_classifications`, garantizando consistencia.

**Logs forenses:**
- `[FORENSIC][AlquimiaGeneral] classification update category_key: ...`
- `[FORENSIC][AlquimiaGeneral] classification update ok, refetching lista { listaId }`
- `[FORENSIC][AlquimiaGeneral] lista reloaded with classification { category, subtype, tags }`

---

## 🛡️ Reglas Constitucionales

1. **UI no confía en estado local**: Siempre re-fetch tras mutaciones.
2. **Cualquier cambio de clasificación debe escribir en tabla relación y verificarse por GET**.
3. **Nunca asumir que "ya está"**: Siempre verificar con GET después de UPDATE.
4. **Logs estructurados obligatorios**: Toda mutación debe emitir logs claros.

---

## 🔗 Referencias

- **TAG SOT GLOBAL v1**: `docs/TAG_SOT_GLOBAL_V1.md`
- **CLASSIFICATION SOT GLOBAL v1**: `docs/CLASSIFICATION_SOT_GLOBAL_V1.md`
- **Migración v5.36.0**: `database/migrations/v5.36.0-classification-terms-canonical.sql`
- **Service**: `src/services/pde-transmutaciones-classification-service.js`
- **Repository**: `src/infra/repos/pde-transmutation-classification-repo-pg.js`
- **UI Client**: `public/js/master/master-alquimia-general-client.js`
