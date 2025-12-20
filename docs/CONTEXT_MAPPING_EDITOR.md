# Context Mapping Editor v1

## 🎯 Objetivo

El **Context Mapping Editor** es una nueva columna vertebral semántica de AuriPortal, reutilizable por packages, widgets, runtime y GPTs.

## 📋 Definición

Un **Context Mapping** es una configuración declarativa que traduce valores de un contexto (enum) en parámetros derivados reutilizables (ej: minutos, cantidades, límites).

### Características Clave

- ✅ **NO ejecuta lógica**: Solo almacena configuración declarativa
- ✅ **NO decide estado**: No sustituye Context Definitions
- ✅ **Fail-open**: Warnings, no throws
- ✅ **Reutilizable**: Por packages, widgets, runtime y GPTs

## 🏗️ Arquitectura

### Tabla: `context_mappings`

```sql
CREATE TABLE context_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_key TEXT NOT NULL,
    mapping_key TEXT NOT NULL,
    mapping_data JSONB NOT NULL,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT context_mappings_unique UNIQUE (context_key, mapping_key) 
        WHERE deleted_at IS NULL
);
```

**Campos principales:**
- `context_key`: Clave del contexto (semántico, sin FK físico)
- `mapping_key`: Valor del enum (ej: "rapida", "completa")
- `mapping_data`: JSON con parámetros derivados (ej: `{"max_aspects": 5, "minutes": 10}`)
- `sort_order`: Orden de visualización (menor = primero)
- `active`: Estado activo/inactivo

**Índices:**
- `idx_context_mappings_context_key`: Búsqueda rápida por contexto
- `idx_context_mappings_active`: Filtrado por activos
- `idx_context_mappings_sort_order`: Ordenamiento
- `idx_context_mappings_data_gin`: Búsquedas en JSONB

## 🔧 Componentes

### 1. Repositorio

**Interfaz:** `src/core/repos/context-mappings-repo.js`
**Implementación:** `src/infra/repos/context-mappings-repo-pg.js`

**Funciones:**
- `listByContextKey(contextKey)`: Lista mappings por contexto
- `upsertMapping(contextKey, mappingKey, mappingData, options)`: Crea o actualiza
- `softDeleteMapping(id)`: Elimina (soft delete)

### 2. Servicio

**Archivo:** `src/services/context-mappings-service.js`

**Responsabilidades:**
- Validar que `context_key` exista (vía context-definitions)
- Validar que `mapping_key` esté dentro de `allowed_values` (si enum)
- Fail-open: warnings, no throws
- Normalizar `mapping_data` (JSON)

### 3. API Admin

**Endpoints:**
- `GET /admin/api/context-mappings?context_key=` - Lista mappings
- `POST /admin/api/context-mappings` - Crea o actualiza
- `PATCH /admin/api/context-mappings/:id` - Actualiza
- `DELETE /admin/api/context-mappings/:id` - Elimina

**Registro:** `src/core/admin/admin-route-registry.js` y `src/router.js`

### 4. UI Admin

**Ubicación:** Admin → Contextos → pestaña "Mappings"

**Características:**
- Selector de contexto (solo enum)
- Lista de `mapping_key` (uno por valor permitido)
- Editor JSON por `mapping_key`
- Guardado inmediato (auto-save al perder foco)
- Ordenable (sort_order)
- Estado activo/inactivo
- Warnings visuales no bloqueantes

**Reglas UI:**
- DOM API estricta
- Sin innerHTML dinámico
- Fail-open siempre

## 📦 Integración en Packages

Al generar el **Package Prompt Context JSON**, para cada `context_key` seleccionado:

1. Si el input es `enum` y tiene `context_key`
2. Buscar mappings activos del contexto
3. Incluir mappings en el input:

```json
{
  "context_contract": {
    "inputs": [
      {
        "context_key": "tipo_limpieza",
        "type": "enum",
        "allowed_values": ["rapida", "basica", "profunda"],
        "mappings": {
          "rapida": { "max_aspects": 5, "minutes": 10 },
          "basica": { "max_aspects": 10, "minutes": 20 },
          "profunda": { "max_aspects": 20, "minutes": 40 }
        }
      }
    ]
  }
}
```

**Implementación:** `src/core/packages/package-engine.js` → `buildPackageDefinition()` (v3)

## 🔄 Flujo de Uso

### 1. Crear Contexto Enum

1. Ir a Admin → Contextos
2. Crear nuevo contexto con `type: "enum"`
3. Definir `allowed_values` (ej: `["rapida", "basica", "profunda"]`)

### 2. Crear Mappings

1. Ir a pestaña "Mappings"
2. Seleccionar contexto enum
3. Para cada valor permitido:
   - Editar JSON de `mapping_data`
   - Establecer `sort_order`
   - Activar/desactivar

### 3. Usar en Packages

1. En Package Creator, seleccionar contexto enum
2. El Package Prompt Context incluirá automáticamente los mappings
3. Los mappings estarán disponibles en el prompt de GPT

## ⚠️ Reglas Absolutas

1. **PostgreSQL única fuente de verdad**: Todos los mappings se almacenan en PostgreSQL
2. **Sin migración no existe**: La tabla debe existir antes de usar
3. **Nada de lógica runtime**: Los mappings son solo datos, no ejecutan código
4. **Nada de decisiones de alumno**: No sustituyen Context Definitions
5. **Compatibilidad total**: No rompe el sistema actual

## 🧪 Ejemplo Completo

### Contexto Enum

```json
{
  "context_key": "tipo_limpieza",
  "label": "Tipo de Limpieza",
  "definition": {
    "type": "enum",
    "allowed_values": ["rapida", "basica", "profunda", "maestro"],
    "default_value": "basica",
    "scope": "recorrido",
    "origin": "user_choice"
  }
}
```

### Mappings

```json
[
  {
    "context_key": "tipo_limpieza",
    "mapping_key": "rapida",
    "mapping_data": {
      "max_aspects": 5,
      "minutes": 10,
      "intensity": "light"
    },
    "sort_order": 1,
    "active": true
  },
  {
    "context_key": "tipo_limpieza",
    "mapping_key": "basica",
    "mapping_data": {
      "max_aspects": 10,
      "minutes": 20,
      "intensity": "medium"
    },
    "sort_order": 2,
    "active": true
  },
  {
    "context_key": "tipo_limpieza",
    "mapping_key": "profunda",
    "mapping_data": {
      "max_aspects": 20,
      "minutes": 40,
      "intensity": "high"
    },
    "sort_order": 3,
    "active": true
  },
  {
    "context_key": "tipo_limpieza",
    "mapping_key": "maestro",
    "mapping_data": {
      "max_aspects": 50,
      "minutes": 60,
      "intensity": "maximum"
    },
    "sort_order": 4,
    "active": true
  }
]
```

### Package Prompt Context Resultante

```json
{
  "package_key": "limpieza-energetica",
  "context_contract": {
    "inputs": [
      {
        "context_key": "tipo_limpieza",
        "type": "enum",
        "allowed_values": ["rapida", "basica", "profunda", "maestro"],
        "mappings": {
          "rapida": { "max_aspects": 5, "minutes": 10, "intensity": "light" },
          "basica": { "max_aspects": 10, "minutes": 20, "intensity": "medium" },
          "profunda": { "max_aspects": 20, "minutes": 40, "intensity": "high" },
          "maestro": { "max_aspects": 50, "minutes": 60, "intensity": "maximum" }
        }
      }
    ]
  }
}
```

## 🚀 Migración

**Archivo:** `database/migrations/v5.24.0-context-mappings.sql`

**Ejecutar:**
```bash
psql -U postgres -d aurelinportal -f database/migrations/v5.24.0-context-mappings.sql
```

## 📝 Notas de Implementación

- **Fail-open**: Todos los errores se convierten en warnings, nunca bloquean
- **Validación semántica**: `context_key` no tiene FK físico (como signals, sources)
- **Soft delete**: Los mappings eliminados se marcan con `deleted_at`
- **Auto-save**: La UI guarda automáticamente al perder foco
- **Ordenamiento**: Los mappings se ordenan por `sort_order` (menor = primero)

## 🔗 Referencias

- Context Definitions: `src/services/pde-contexts-service.js`
- Package Engine: `src/core/packages/package-engine.js`
- Admin UI: `src/core/html/admin/contexts/contexts-manager.html`

