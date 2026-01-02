# TAG SOT GLOBAL v1 - Documentación Canónica

**Versión:** 1.0.0  
**Fecha:** 2025-01-02  
**Estado:** ✅ EN IMPLEMENTACIÓN

---

## 🎯 Objetivo

Formalizar `pde_classification_terms` (tipo `'tag'`) como **TAG SOT GLOBAL v1**, gobernado exclusivamente por el dominio MASTER.

---

## 📜 Principios Constitucionales

1. **PostgreSQL es el único Source of Truth** de tags
2. **Tags solo se crean/modifican desde MASTER**
3. **Tags nunca se borran** (solo se marcan como deprecated)
4. **Toda relación de tag puede emitir señales**
5. **Tags se normalizan automáticamente** (lowercase + sin acentos)

---

## 🗄️ Estructura de Base de Datos

### Tabla: `pde_classification_terms`

**Campos:**
- `id` (UUID, PK)
- `type` (TEXT) - `'tag'` para tags
- `value` (TEXT) - Valor original del tag
- `normalized` (TEXT) - Valor normalizado (lowercase + sin acentos)
- `status` (TEXT) - `'active'` o `'deprecated'` (v5.48.0+)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Constraints:**
- `UNIQUE (type, normalized)` - Garantiza que no hay duplicados
- `CHECK (status IN ('active', 'deprecated'))` - Solo estados válidos
- `CHECK (type IN ('key', 'subkey', 'tag'))` - Tipo válido

**Índices:**
- `idx_classification_terms_type` - Búsqueda por tipo
- `idx_classification_terms_normalized` - Búsqueda por valor normalizado
- `idx_classification_terms_type_normalized` - Búsqueda compuesta
- `idx_classification_terms_status` - Búsqueda por status (v5.48.0+)
- `idx_classification_terms_type_status` - Búsqueda activos por tipo (v5.48.0+)

---

## 🔌 Endpoints API MASTER

### GET /master/api/tags

Lista todos los tags (activos por defecto).

**Query params:**
- `search` (opcional) - Búsqueda por valor
- `status` (opcional) - `'active'` o `'deprecated'` (default: `'active'`)
- `limit` (opcional) - Límite de resultados (default: 50)

**Response:**
```json
{
  "ok": true,
  "tags": [
    {
      "id": "uuid",
      "value": "Energía Indeseable",
      "normalized": "energia indeseable",
      "status": "active",
      "created_at": "2025-01-02T10:00:00Z"
    }
  ]
}
```

### POST /master/api/tags

Crea un nuevo tag (idempotente).

**Body:**
```json
{
  "value": "Nuevo Tag"
}
```

**Response:**
```json
{
  "ok": true,
  "tag": {
    "id": "uuid",
    "value": "Nuevo Tag",
    "normalized": "nuevo tag",
    "status": "active",
    "created_at": "2025-01-02T10:00:00Z"
  }
}
```

### PATCH /master/api/tags/:id

Edita un tag (solo value, no puede cambiar key/normalized).

**Body:**
```json
{
  "value": "Tag Actualizado"
}
```

**Response:**
```json
{
  "ok": true,
  "tag": {
    "id": "uuid",
    "value": "Tag Actualizado",
    "normalized": "tag actualizado",
    "status": "active",
    "updated_at": "2025-01-02T10:00:00Z"
  }
}
```

### POST /master/api/tags/:id/deprecate

Marca un tag como deprecated (no se elimina).

**Response:**
```json
{
  "ok": true,
  "tag": {
    "id": "uuid",
    "value": "Tag",
    "status": "deprecated",
    "updated_at": "2025-01-02T10:00:00Z"
  }
}
```

---

## 📡 Señales

Todas las operaciones de tags emiten señales:

- `tag.created` - Cuando se crea un tag
- `tag.deprecated` - Cuando se marca como deprecated
- `tag.attached` - Cuando se asocia a una entidad (lista, etc.)
- `tag.detached` - Cuando se desasocia de una entidad
- `tag.used` - Cuando una entidad activa contiene el tag

**Payload canónico:**
```json
{
  "tag_id": "uuid",
  "tag_value": "Energía Indeseable",
  "tag_normalized": "energia indeseable",
  "entity_type": "lista",
  "entity_id": 123
}
```

---

## 🔒 Autenticación

Todos los endpoints requieren autenticación MASTER usando `requireAdminContext()` (comparte sistema de sesión con Admin).

---

## 📚 Referencias

- **Migración:** `database/migrations/v5.48.0-tag-sot-global-v1-status.sql`
- **Repositorio:** `src/infra/repos/pde-classification-terms-repo-pg.js`
- **Servicios:** `src/services/pde-transmutaciones-classification-service.js`
- **Registry:** `src/core/master/registry/master-route-registry.js`

---

**Última actualización:** 2025-01-02
