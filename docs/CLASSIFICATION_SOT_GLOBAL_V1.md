# CLASSIFICATION SOT GLOBAL v1 - Documentación Canónica

**Versión:** 1.0.0  
**Fecha:** 2025-01-02  
**Estado:** ✅ CERTIFICADO

---

## 🎯 Objetivo

Formalizar `pde_classification_terms` (tipos `'key'` y `'subkey'`) como **CLASSIFICATION SOT GLOBAL v1**, gobernado exclusivamente por el dominio MASTER, alineado 100% con TAG SOT GLOBAL v1.

---

## 📜 Principios Constitucionales

1. **PostgreSQL es el único Source of Truth** de classifications
2. **Classifications solo se crean/modifican desde MASTER**
3. **Classifications nunca se borran** (solo se marcan como deprecated)
4. **Toda relación de classification puede emitir señales**
5. **Classifications se normalizan automáticamente** (lowercase + sin acentos)
6. **Creación inline desde UI es un derecho constitucional** del usuario MASTER

---

## 🗄️ Estructura de Base de Datos

### Tabla: `pde_classification_terms`

**Campos:**
- `id` (UUID, PK)
- `type` (TEXT) - `'key'` para categories, `'subkey'` para subtypes
- `value` (TEXT) - Valor original de la classification
- `normalized` (TEXT) - Valor normalizado (lowercase + sin acentos)
- `status` (TEXT) - `'active'` o `'deprecated'` (v5.49.0+)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Constraints:**
- `UNIQUE (type, normalized)` - Garantiza que no hay duplicados
- `CHECK (status IN ('active', 'deprecated'))` - Solo estados válidos
- `CHECK (type IN ('tag', 'key', 'subkey'))` - Tipo válido

**Índices:**
- `idx_classification_terms_type` - Búsqueda por tipo
- `idx_classification_terms_normalized` - Búsqueda por valor normalizado
- `idx_classification_terms_type_normalized` - Búsqueda compuesta
- `idx_classification_terms_status` - Búsqueda por status
- `idx_classification_terms_type_status` - Búsqueda activos por tipo

**Nomenclatura histórica:**
- `type='key'` → **category** (mantiene compatibilidad)
- `type='subkey'` → **subtype** (mantiene compatibilidad)
- `type='tag'` → **tag** (TAG SOT GLOBAL v1)

---

## 🔧 Helper Canónico: ensureClassificationTerm

**Archivo**: `src/core/classification/ensure-classification-term.js`

Este helper es el **ÚNICO punto de creación** de classification terms en el sistema.

**Reglas:**
- Usa `ensure_classification_term()` de PostgreSQL (idempotente)
- Acepta `type='tag'`, `type='key'` (category), `type='subkey'` (subtype)
- Acepta creación inline desde texto (UI)
- Normalización automática
- Respeta status (active / deprecated)
- Logging estructurado con trace_id

**Uso:**
```javascript
import { ensureClassificationTerm } from '../core/classification/ensure-classification-term.js';

// Crear category
const category = await ensureClassificationTerm(
  { type: 'key', value: 'mi-categoria' },
  { traceId: 'req_xxx' }
);

// Crear subtype
const subtype = await ensureClassificationTerm(
  { type: 'subkey', value: 'mi-subtipo' },
  { traceId: 'req_xxx' }
);
```

**Regla constitucional**: Cualquier endpoint que cree classifications DEBE usar este helper.

---

## 🔌 Endpoints API MASTER

### GET /master/api/classifications

Lista todas las classifications (activas por defecto).

**Query params:**
- `type` (opcional) - `'tag'`, `'key'`, `'subkey'` o null (todos)
- `status` (opcional) - `'active'`, `'deprecated'`, `'all'` (default: `'active'`)
- `search` (opcional) - Búsqueda por valor
- `limit` (opcional) - Límite de resultados (default: 100)

**Respuesta:**
```json
{
  "ok": true,
  "classifications": [
    {
      "id": "uuid",
      "type": "key",
      "value": "mi-categoria",
      "normalized": "mi-categoria",
      "status": "active",
      "created_at": "2025-01-02T...",
      "updated_at": "2025-01-02T..."
    }
  ]
}
```

### POST /master/api/classifications

Crear classification (idempotente).

**Body:**
```json
{
  "type": "key",
  "value": "mi-categoria"
}
```

**Respuesta:**
```json
{
  "ok": true,
  "classification": {
    "id": "uuid",
    "type": "key",
    "value": "mi-categoria",
    "normalized": "mi-categoria",
    "status": "active",
    "created_at": "2025-01-02T...",
    "updated_at": "2025-01-02T..."
  }
}
```

**Señales emitidas:**
- `classification.created`

### PATCH /master/api/classifications/:id

Actualizar classification (solo status por ahora).

**Body:**
```json
{
  "status": "deprecated"
}
```

**Respuesta:**
```json
{
  "ok": true,
  "classification": { ... }
}
```

### POST /master/api/classifications/:id/deprecate

Deprecar classification (nunca se borra).

**Respuesta:**
```json
{
  "ok": true,
  "classification": {
    "status": "deprecated",
    ...
  }
}
```

**Señales emitidas:**
- `classification.deprecated`

---

## 📡 Señales (Obligatorias)

### classification.created

Emitida cuando se crea una classification (idempotente).

**Payload:**
```json
{
  "classification_id": "uuid",
  "classification_type": "key",
  "classification_value": "mi-categoria",
  "classification_normalized": "mi-categoria"
}
```

### classification.deprecated

Emitida cuando se depreca una classification.

**Payload:**
```json
{
  "classification_id": "uuid",
  "classification_type": "key",
  "classification_value": "mi-categoria",
  "classification_normalized": "mi-categoria"
}
```

### classification.attached / classification.detached

Emitidas cuando se asocian/desasocian classifications a entidades (listas, items, etc.).

**Payload:**
```json
{
  "classification_id": "uuid",
  "classification_type": "key",
  "classification_value": "mi-categoria",
  "classification_normalized": "mi-categoria",
  "entity_type": "lista",
  "entity_id": 123
}
```

---

## 🎨 UI MASTER (Alquimia General)

La UI consume exclusivamente `/master/api/classifications` como Source of Truth.

**Componente canónico**: `ClassificationEditableSelector`

- Autocomplete desde SOT
- Escritura libre + Enter crea (via API MASTER)
- Muestra classifications legacy normalizadas
- PROHIBIDO usar `<select>`

**Endpoints consumidos:**
- `GET /master/api/classifications?type=key&status=active` → Categories
- `GET /master/api/classifications?type=subkey&status=active` → Subtypes
- `POST /master/api/classifications` → Crear inline

---

## 🔄 Migración Legacy

Las classifications legacy (en `pde_transmutation_categories` y `pde_transmutation_subtypes`) ya fueron migradas a `pde_classification_terms` en la migración v5.36.0.

**Estado actual:**
- Todas las classifications existentes tienen `status='active'` (v5.49.0)
- Las classifications legacy son visibles en la UI
- No hay duplicados (constraint UNIQUE garantiza)
- Normalización automática aplicada

---

## 🛡️ Reglas Constitucionales

1. **PostgreSQL es el único SOT** - Nunca leer desde otras fuentes en runtime
2. **Solo MASTER puede crear/modificar/deprecar** - requireAdminContext() obligatorio
3. **Nunca se borran físicamente** - Solo deprecated
4. **Helper canónico único** - ensureClassificationTerm() es el único punto de creación
5. **Señales obligatorias** - Toda operación relevante emite señales
6. **UI consume SOT** - No hay cálculo ni inferencia en UI
7. **Creación inline constitucional** - Derecho del usuario MASTER

---

## 📚 Referencias

- **TAG SOT GLOBAL v1**: `docs/TAG_SOT_GLOBAL_V1.md`
- **Helper canónico**: `src/core/classification/ensure-classification-term.js`
- **API endpoint**: `src/endpoints/master-api-classifications.js`
- **Migración**: `database/migrations/v5.49.0-classification-sot-global-v1-certification.sql`

---

## ✅ Certificación

**Versión**: 1.0.0  
**Fecha certificación**: 2025-01-02  
**Estado**: CERTIFICADO

CLASSIFICATION SOT GLOBAL v1 está alineado 100% con TAG SOT GLOBAL v1 y gobernado exclusivamente por el dominio MASTER.
