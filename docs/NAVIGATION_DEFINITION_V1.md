# NavigationDefinition v1 - Contrato Formal

**Versión**: 1.0  
**Fecha**: 2025-01-XX  
**Estado**: Estable

---

## Propósito

Este documento define el contrato formal de `NavigationDefinition v1`, la estructura JSON que representa una navegación completa en AuriPortal.

**Principios**:
- **Inmutabilidad**: Las versiones publicadas nunca cambian
- **Normalización**: Orden determinista para checksums
- **Compatibilidad forward**: Campos desconocidos se conservan en `meta`
- **Validación estricta**: Publish requiere validación completa
- **Sin evaluación**: v1 NO evalúa `visibility_rules` ni ejecuta runtime

---

## Estructura JSON

### NavigationDefinition (Raíz)

```json
{
  "navigation_id": "main-sidebar",
  "name": "Menú Principal",
  "description": "Navegación principal del portal",
  "type": "global",
  "context_key": null,
  "entry_node_id": "home",
  "nodes": {
    "home": { ... },
    "section-1": { ... }
  },
  "edges": [
    { "from": "home", "to": "section-1", "kind": "child" }
  ],
  "meta": {
    "created_by": "admin@example.com",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

#### Campos Obligatorios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `navigation_id` | `string` | ID único de la navegación (formato: `[a-z][a-z0-9_-]*`) |
| `entry_node_id` | `string` | ID del nodo de entrada (debe existir en `nodes`) |
| `nodes` | `object` | Mapa de nodos por ID (al menos 1 nodo) |

#### Campos Opcionales

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `name` | `string` | - | Nombre legible (recomendado) |
| `description` | `string` | - | Descripción opcional |
| `type` | `"global" \| "contextual"` | `"global"` | Tipo de navegación |
| `context_key` | `string \| null` | `null` | Clave de contexto (obligatorio si `type === "contextual"`) |
| `edges` | `Edge[]` | `[]` | Lista de edges (opcional si se usan `children`) |
| `meta` | `object` | `{}` | Metadatos opcionales (campos desconocidos se conservan aquí) |

---

### Node (Nodo)

```json
{
  "id": "home",
  "kind": "section",
  "type": "home",
  "label": "Inicio",
  "subtitle": "Página principal",
  "icon": "🏠",
  "art_ref": "art/home-bg",
  "layout_hint": "list",
  "order": 0,
  "position": { "x": 100, "y": 200 },
  "visibility_rules": {
    "min_level": 1,
    "max_level": 10,
    "flags": ["feature_x"],
    "products": ["mundo_de_luz"]
  },
  "target": {
    "type": "screen",
    "ref": "/",
    "params": {}
  },
  "meta": {}
}
```

#### Campos Obligatorios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único del nodo (debe coincidir con la key en `nodes`) |
| `kind` | `string` | Tipo de nodo (ver `NODE_KINDS`) |
| `label` | `string` | Etiqueta visible (máx. 200 caracteres) |

**Target requerido** para: `item`, `hub`, `external_link`, `system_entry`, `view`, `external`

#### Campos Opcionales

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `type` | `string` | - | Tipo semántico: `home`, `section`, `view`, `external`, `overlay`, `return` |
| `subtitle` | `string` | - | Subtítulo (máx. 500 caracteres) |
| `icon` | `string` | - | Icono (emoji o referencia) |
| `art_ref` | `string` | - | Referencia a arte |
| `layout_hint` | `string` | `"list"` | Hint de layout: `list`, `grid`, `map`, `cards`, `tree` |
| `order` | `number` | `0` | Orden de renderizado |
| `position` | `{x: number, y: number}` | - | Posición en canvas (solo editor) |
| `visibility_rules` | `VisibilityRules` | - | Reglas de visibilidad (pasivo, no evaluado en v1) |
| `target` | `TargetConfig` | - | Configuración de target (requerido para ciertos kinds) |
| `children` | `string[]` | - | IDs de nodos hijos (alternativa a edges, se normaliza) |
| `meta` | `object` | `{}` | Metadatos opcionales |

#### Tipos de Nodos (`kind`)

- `section`: Sección contenedora (puede tener hijos)
- `group`: Grupo de items (puede tener hijos)
- `item`: Item navegable (requiere `target`)
- `hub`: Hub de navegación (requiere `target`)
- `external_link`: Link externo (requiere `target.type === "url"`)
- `system_entry`: Entrada del sistema (requiere `target`)

---

### Edge (Arista)

```json
{
  "from": "home",
  "to": "section-1",
  "kind": "child"
}
```

#### Campos Obligatorios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `from` | `string` | ID del nodo origen (debe existir en `nodes`) |
| `to` | `string` | ID del nodo destino (debe existir en `nodes`) |

#### Campos Opcionales

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `kind` | `string` | `"child"` | Tipo de edge: `child` (jerárquico) o `link` (no jerárquico) |
| `meta` | `object` | `{}` | Metadatos opcionales |

**Restricciones**:
- No se permiten edges duplicados exactos (`from`, `to`, `kind`)
- `from` y `to` deben existir en `nodes`

---

### VisibilityRules (Reglas de Visibilidad)

```json
{
  "min_level": 1,
  "max_level": 10,
  "flags": ["feature_x", "feature_y"],
  "products": ["mundo_de_luz"]
}
```

**IMPORTANTE**: En v1, `visibility_rules` es **pasivo** (solo estructura JSON). NO se evalúa en runtime.

#### Campos Opcionales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `min_level` | `number` | Nivel mínimo requerido |
| `max_level` | `number` | Nivel máximo permitido |
| `flags` | `string[]` | Feature flags requeridas |
| `products` | `string[]` | Productos requeridos |

---

### TargetConfig (Configuración de Target)

```json
{
  "type": "recorrido",
  "ref": "sanacion-inicial",
  "params": {
    "mode": "practice"
  }
}
```

#### Campos Obligatorios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `type` | `string` | Tipo de target: `recorrido`, `pde_catalog`, `screen`, `url`, `admin_tool` |
| `ref` | `string` | Referencia al target (slug, ID, URL, ruta, etc.) |

#### Campos Opcionales

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `params` | `object` | `{}` | Parámetros adicionales |

#### Tipos de Target

- `recorrido`: Recorrido interno (`ref` = slug del recorrido)
- `pde_catalog`: Catálogo PDE (`ref` = ID del catálogo)
- `screen`: Pantalla interna (`ref` = ruta interna, ej: `/topics`)
- `url`: URL externa (`ref` = URL absoluta, ej: `https://example.com`)
- `admin_tool`: Herramienta admin (`ref` = ID de la herramienta)

---

## Defaults

### NavigationDefinition

```json
{
  "type": "global",
  "context_key": null,
  "edges": [],
  "meta": {}
}
```

### Node

```json
{
  "kind": "section",
  "layout_hint": "list",
  "order": 0,
  "meta": {}
}
```

### Edge

```json
{
  "kind": "child"
}
```

---

## Normalización

La normalización garantiza un orden determinista para checksums:

1. **Nodos**: Ordenados por `id` (alfabético)
2. **Edges**: Ordenados por `from`, luego `to`, luego `kind`
3. **Children**: Convertidos a edges (si existen)
4. **Deduplicación**: Edges duplicados se eliminan
5. **IDs**: `node.id` debe coincidir con la key en `nodes`

**Ejemplo**:

```json
// Antes (con children)
{
  "nodes": {
    "home": {
      "id": "home",
      "children": ["section-1", "section-2"]
    }
  }
}

// Después (normalizado)
{
  "nodes": {
    "home": {
      "id": "home"
    }
  },
  "edges": [
    { "from": "home", "to": "section-1", "kind": "child" },
    { "from": "home", "to": "section-2", "kind": "child" }
  ]
}
```

---

## Validación Estricta (Publish)

Para publicar una navegación, se requiere validación estricta:

### Errores Bloqueantes

1. **Estructura base**:
   - `navigation_id` vacío o inválido
   - `entry_node_id` no existe en `nodes`
   - `nodes` vacío o no es objeto
   - `nodes` excede límite (2000 nodos)

2. **Nodos**:
   - `node.id` no coincide con la key
   - IDs duplicados
   - `kind` inválido o faltante
   - `label` faltante o inválido
   - `target` faltante para kinds que lo requieren
   - `target.type` o `target.ref` inválidos

3. **Edges**:
   - `from` o `to` no existen en `nodes`
   - Edges duplicados exactos (se normalizan, pero error si persisten)

4. **Grafo**:
   - **Nodos huérfanos**: Nodos inalcanzables desde `entry_node_id` (error estricto)
   - Ciclos detectados (warning, no bloquea)

5. **Límites**:
   - Excede `MAX_NODES` (2000)
   - Excede `MAX_EDGES` (5000)
   - Labels/refs exceden límites de longitud

### Warnings (No Bloquean)

- Ciclos detectados
- Edges duplicados (se normalizan)
- `order` faltante
- `layout_hint` faltante
- `name` faltante (recomendado)

---

## Compatibilidad Forward

**Principio**: Campos desconocidos se conservan en `meta`.

```json
{
  "navigation_id": "main-sidebar",
  "nodes": { ... },
  "meta": {
    "custom_field": "value",  // ✅ Se conserva
    "future_feature": { ... }  // ✅ Se conserva
  }
}
```

Al normalizar, los campos desconocidos en la raíz se mueven a `meta`:

```json
// Antes
{
  "navigation_id": "main-sidebar",
  "unknown_field": "value"
}

// Después (normalizado)
{
  "navigation_id": "main-sidebar",
  "meta": {
    "unknown_field": "value"
  }
}
```

---

## Qué NO Hace v1

1. **NO evalúa `visibility_rules`**: Solo valida estructura JSON
2. **NO ejecuta runtime**: No resuelve navegación efectiva
3. **NO valida referencias**: No verifica que `target.ref` exista
4. **NO renderiza**: No genera UI
5. **NO evalúa feature flags**: Solo valida que sean strings

---

## Ejemplo Completo

```json
{
  "navigation_id": "main-sidebar",
  "name": "Menú Principal",
  "description": "Navegación principal del portal",
  "type": "global",
  "entry_node_id": "home",
  "nodes": {
    "home": {
      "id": "home",
      "kind": "section",
      "type": "home",
      "label": "Inicio",
      "order": 0
    },
    "topics": {
      "id": "topics",
      "kind": "item",
      "type": "view",
      "label": "Temas",
      "target": {
        "type": "screen",
        "ref": "/topics"
      },
      "order": 1
    }
  },
  "edges": [
    {
      "from": "home",
      "to": "topics",
      "kind": "child"
    }
  ],
  "meta": {
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

## Checksum

El checksum se calcula sobre la definición **normalizada** y **canonicalizada**:

1. Normalizar (orden determinista)
2. Canonicalizar (JSON.stringify con keys ordenadas)
3. SHA256 del JSON canonicalizado

**Ejemplo**:

```javascript
const normalized = normalizeNavigationDefinition(def);
const canonical = JSON.stringify(normalized, Object.keys(normalized).sort(), 0);
const checksum = sha256(canonical);
```

---

## Formato de Export

Al exportar una navegación publicada, el formato es:

```json
{
  "ok": true,
  "format": "auriportal.navigation.v1",
  "exported_at": "2025-01-01T00:00:00Z",
  "navigation_id": "main-sidebar",
  "version": 1,
  "checksum": "abc123...",
  "navigation": {
    "navigation_id": "main-sidebar",
    "name": "Menú Principal",
    "entry_node_id": "home",
    "nodes": { ... },
    "edges": [ ... ]
  }
}
```

**Campos obligatorios en export**:
- `format`: `"auriportal.navigation.v1"`
- `exported_at`: ISO 8601 timestamp
- `navigation_id`: ID de la navegación
- `version`: Número de versión publicada
- `checksum`: SHA256 de la definición normalizada
- `navigation`: NavigationDefinition completa

---

## Migración y Versionado

- **Draft**: Editable, puede tener errores
- **Published**: Inmutable, validado, versionado
- **Versiones**: Numeradas secuencialmente (1, 2, 3, ...)
- **Checksum**: Verifica integridad de versiones publicadas

---

## Referencias

- Implementación: `src/core/navigation/navigation-definition-v1.js`
- Validación: `src/core/navigation/validate-navigation-definition-v1.js`
- Constantes: `src/core/navigation/navigation-constants.js`
- Repositorio: `src/infra/repos/navigation-repo-pg.js`

---

**FIN DEL CONTRATO**



