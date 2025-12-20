# Editor de Navegación v1 - Resumen de Implementación

> **Sprint:** NAVEGACIÓN v1  
> **Fecha:** 2025-12-17  
> **Estado:** Backend implementado, UI pendiente (siguiente sprint)

## Objetivo

Implementar el sistema de navegación versionado para AuriPortal, siguiendo el mismo paradigma de Draft/Publish inmutable que los Recorridos versionados.

## Principios

1. **Arquitectura incremental, reversible, auditable**
2. **Draft/Publish inmutable** - Las versiones publicadas nunca cambian
3. **Audit append-only** - Todas las acciones se registran
4. **Desacople total** - NavigationDefinition es declarativo, sin lógica runtime
5. **Validación estricta para publish** - Draft permite más flexibilidad

---

## Contrato JSON: NavigationDefinition v1

### Estructura Principal

```json
{
  "navigation_id": "main-sidebar",
  "name": "Sidebar Principal",
  "description": "Menú principal del portal",
  "entry_node_id": "root",
  "nodes": {
    "root": { ... },
    "item1": { ... }
  },
  "edges": [
    { "from": "root", "to": "item1", "kind": "child" }
  ],
  "meta": {
    "created_by": "admin@example.com",
    "created_at": "2025-12-17T10:00:00Z"
  }
}
```

### NodeDefinition v1

```json
{
  "id": "node-id",
  "kind": "section|group|item|hub|external_link|system_entry",
  "label": "Texto visible",
  "subtitle": "Subtítulo opcional",
  "icon": "icon-name",
  "art_ref": "art-reference",
  "layout_hint": "list|grid|map|cards|tree",
  "order": 0,
  "visibility": {
    "min_nivel_efectivo": 3,
    "feature_flag": "feature_name",
    "requires": ["permission1", "permission2"]
  },
  "target": {
    "type": "recorrido|pde_catalog|screen|url|admin_tool",
    "ref": "slug-o-url",
    "params": {}
  }
}
```

### EdgeDefinition v1

```json
{
  "from": "node-origen",
  "to": "node-destino",
  "kind": "child|link"
}
```

### Tipos de Nodos (kind)

| Kind | Descripción | Requiere Target |
|------|-------------|-----------------|
| `section` | Sección contenedora | No |
| `group` | Grupo de items | No |
| `item` | Item navegable | **Sí** |
| `hub` | Hub de navegación | **Sí** |
| `external_link` | Link externo | **Sí** (type: url) |
| `system_entry` | Entrada del sistema | **Sí** |

### Tipos de Target (type)

| Type | Descripción | Formato de ref |
|------|-------------|----------------|
| `recorrido` | Recorrido interno | slug del recorrido |
| `pde_catalog` | Catálogo PDE | id del catálogo |
| `screen` | Pantalla interna | ruta (ej: /practicar) |
| `url` | URL externa | URL absoluta http/https |
| `admin_tool` | Herramienta admin | id de la herramienta |

---

## Reglas de Validación

### Errores (bloquean publish)

| Error | Descripción |
|-------|-------------|
| `navigation_id vacío` | ID es requerido |
| `navigation_id formato inválido` | Solo letras minúsculas, números, guiones |
| `entry_node_id no existe` | Debe referenciar un nodo válido |
| `nodes vacío` | Debe tener al menos un nodo |
| `IDs duplicados` | Cada nodo debe tener ID único |
| `node.id no coincide con key` | La key del mapa debe coincidir con node.id |
| `edge from/to no existe` | Los edges deben referenciar nodos válidos |
| `nodos huérfanos` | Todos los nodos deben ser alcanzables desde entry |
| `target inválido` | Nodos que requieren target deben tenerlo válido |
| `target.ref URL inválida` | Para type:url, debe ser URL absoluta |
| `nodes > 2000` | Límite de seguridad |

### Warnings (no bloquean publish)

| Warning | Descripción |
|---------|-------------|
| `ciclos detectados` | Se permiten en v1, pero se informa |
| `edges duplicados` | Se deduplicarán en normalización |
| `order faltante` | Se usará auto-orden |
| `layout_hint no estándar` | Valores no reconocidos |

### Modos de Validación

```javascript
// Modo draft (tolerante)
validateNavigationDraft(definition)
// - Huérfanos → warning
// - Orden faltante → warning
// - Devuelve normalizedDef aunque haya warnings

// Modo publish (estricto)
validateNavigationPublish(definition)
// - Huérfanos → error
// - Target faltante → error
// - Bloquea si hay errores
```

---

## Base de Datos

### Migración

**Archivo:** `database/migrations/v5.5.0-navigation-versioning-v1.sql`

### Tablas

#### navigation_definitions
```sql
CREATE TABLE navigation_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navigation_id TEXT UNIQUE NOT NULL,
    name TEXT,
    description TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);
```

#### navigation_drafts
```sql
CREATE TABLE navigation_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navigation_id TEXT NOT NULL REFERENCES navigation_definitions(navigation_id),
    draft_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT
);
```

#### navigation_versions (inmutable)
```sql
CREATE TABLE navigation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navigation_id TEXT NOT NULL REFERENCES navigation_definitions(navigation_id),
    version INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published', -- 'published' | 'archived'
    definition_json JSONB NOT NULL,           -- INMUTABLE
    checksum TEXT NOT NULL,                   -- SHA256 hex
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_by TEXT,
    UNIQUE (navigation_id, version)
);
```

#### navigation_audit_log (append-only)
```sql
CREATE TABLE navigation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navigation_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'create_draft'|'update_draft'|'validate'|'publish'|'archive'|'import'|'export'
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT
);
```

### Triggers

- `updated_at` automático en `navigation_definitions` y `navigation_drafts`

---

## Endpoints Admin

**Base URL:** `/admin/navigation`  
**Feature Flag:** `navigation_editor_v1` (estado: `beta`)

### Resumen de Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/navigation` | Lista navegaciones |
| POST | `/admin/navigation` | Crea navegación + draft inicial |
| GET | `/admin/navigation/:navId/draft` | Obtiene draft actual |
| POST | `/admin/navigation/:navId/draft` | Crea/actualiza draft |
| POST | `/admin/navigation/:navId/validate` | Valida draft |
| POST | `/admin/navigation/:navId/publish` | Publica versión |
| GET | `/admin/navigation/:navId/published` | Última versión publicada |
| GET | `/admin/navigation/:navId/export` | Exporta JSON |
| POST | `/admin/navigation/:navId/import` | Importa JSON como draft |

### Formato de Respuestas

**Éxito:**
```json
{
  "ok": true,
  "data": { ... },
  "warnings": [ ... ]  // opcional
}
```

**Error:**
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensaje descriptivo",
    "details": { ... }  // opcional
  }
}
```

### Ejemplos curl

#### Crear navegación
```bash
curl -X POST http://localhost:3000/admin/navigation \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{
    "navigation_id": "main-sidebar",
    "name": "Sidebar Principal"
  }'
```

#### Actualizar draft
```bash
curl -X POST http://localhost:3000/admin/navigation/main-sidebar/draft \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{
    "draft_json": {
      "navigation_id": "main-sidebar",
      "name": "Sidebar Principal",
      "entry_node_id": "root",
      "nodes": {
        "root": { "id": "root", "kind": "section", "label": "Inicio", "order": 0 },
        "practicar": { "id": "practicar", "kind": "item", "label": "Practicar", "order": 1, "target": { "type": "screen", "ref": "/practicar" } }
      },
      "edges": [
        { "from": "root", "to": "practicar" }
      ]
    }
  }'
```

#### Validar draft
```bash
curl -X POST http://localhost:3000/admin/navigation/main-sidebar/validate \
  -H "Cookie: admin_session=..."
```

#### Publicar
```bash
curl -X POST http://localhost:3000/admin/navigation/main-sidebar/publish \
  -H "Cookie: admin_session=..."
```

#### Obtener publicada
```bash
curl http://localhost:3000/admin/navigation/main-sidebar/published \
  -H "Cookie: admin_session=..."
```

#### Exportar
```bash
curl http://localhost:3000/admin/navigation/main-sidebar/export \
  -H "Cookie: admin_session=..."
```

---

## Feature Flag

```javascript
// src/core/flags/feature-flags.js
navigation_editor_v1: 'beta',  // Disponible en dev/beta

// Uso
if (isFeatureEnabled('navigation_editor_v1')) {
  // Endpoints habilitados
}
```

---

## Archivos Creados/Modificados

### Nuevos
```
database/migrations/v5.5.0-navigation-versioning-v1.sql
src/core/navigation/navigation-constants.js
src/core/navigation/navigation-definition-v1.js
src/core/navigation/validate-navigation-definition-v1.js
src/core/repos/navigation-repo.js
src/infra/repos/navigation-repo-pg.js
src/endpoints/admin-navigation-api.js
tests/navigation/navigation-validate.test.js
tests/navigation/navigation-repo-publish.test.js
docs/NAVIGATION_EDITOR_V1_RESUMEN.md
```

### Modificados
```
src/core/flags/feature-flags.js  (añadido navigation_editor_v1)
src/router.js                     (añadidas rutas /admin/navigation)
```

---

## Verificación

### 1. Aplicar Migración

```bash
# Conectar a PostgreSQL
psql -U postgres -d aurelinportal

# Ejecutar migración
\i /var/www/aurelinportal/database/migrations/v5.5.0-navigation-versioning-v1.sql

# Verificar tablas
\dt navigation_*
```

**Salida esperada:**
```
              List of relations
 Schema |          Name           | Type  
--------+-------------------------+-------
 public | navigation_audit_log    | table
 public | navigation_definitions  | table
 public | navigation_drafts       | table
 public | navigation_versions     | table
```

### 2. Ejecutar Tests

```bash
cd /var/www/aurelinportal

# Tests de validación (no requieren BD)
npm test -- tests/navigation/navigation-validate.test.js

# Tests de repositorio (requieren BD)
npm test -- tests/navigation/navigation-repo-publish.test.js
```

### 3. Probar Endpoints

```bash
# Asegurarse de que el servidor está corriendo
pm2 restart aurelinportal

# Probar endpoint (requiere sesión admin)
curl http://localhost:3000/admin/navigation
```

---

## Decisiones de Diseño v1

| Decisión | Valor | Razón |
|----------|-------|-------|
| Huérfanos en publish | **Error** | Garantiza navegación completa |
| Ciclos | **Warning** | Permitir estructuras complejas |
| Edges duplicados | **Normalizar** | Limpieza automática |
| Formato ID | `^[a-z][a-z0-9_-]*$` | Consistencia con slugs |
| Límite nodos | 2000 | Evitar bombas |
| Checksum | SHA256 | Integridad de versiones |

---

## Próximos Pasos (Siguiente Sprint)

1. **UI Admin** - Editor visual de navegación
2. **Runtime API** - Endpoint para clientes (`GET /api/navigation`)
3. **Visibility Evaluator** - Filtrar nodos según contexto del usuario
4. **Integración con sidebar** - Usar navegación publicada en sidebar

---

## Compatibilidad

- ✅ Compatible con PM2 + Nginx multi-entorno
- ✅ No toca código existente (aditivo)
- ✅ No rompe PDE ni Recorridos
- ✅ Feature flag controla activación
- ✅ Migración reversible (DROP tables si necesario)








