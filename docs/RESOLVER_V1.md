# Resolver v1 - Documentación Completa

## 🎯 ¿Qué es Resolver v1?

**Resolver v1** es el motor determinista que toma un `PackageDefinition` + contextos efectivos + mappings y devuelve un `ResolvedPackage` listo para ser consumido por Widgets/Recorridos.

### Principios Fundamentales

- **Determinista**: Mismo input = mismo output (sin aleatoriedad a menos que se configure)
- **Fail-open**: Nunca bloquea por falta de contexto, siempre devuelve algo válido
- **PostgreSQL como fuente de verdad**: Sin migraciones aplicadas = funcionalidad inexistente
- **Sin innerHTML dinámico**: Todo con DOM API (`createElement`, `textContent`, `.value`)

---

## 📋 Contratos

### ResolverDefinition v1

```json
{
  "resolver_key": "string",
  "label": "string",
  "description": "string",
  "status": "draft|published|archived",
  "version": 1,
  "policy": {
    "mode": "per_source",
    "global": {
      "seed": "stable|random",
      "ordering": "canonical|random|priority",
      "default_max_items": null
    },
    "rules": [
      {
        "when": {
          "context": {
            "tipo_limpieza": ["rapida","basica","profunda","maestro"],
            "nivel_efectivo_min": 1,
            "nivel_efectivo_max": 7
          }
        },
        "apply": {
          "sources": {
            "transmutaciones_energeticas": {
              "max_items": 5,
              "prefer_video": false,
              "widget_hint": "checklist",
              "extra": {}
            }
          }
        }
      }
    ]
  },
  "meta": {
    "created_by": "admin",
    "notes": ""
  }
}
```

### ResolvedPackage v1

```json
{
  "ok": true,
  "package_key": "string",
  "resolver_key": "string",
  "effective_context": { "k":"v" },
  "resolved_sources": [
    {
      "source_key": "string",
      "items": [ /* items ya filtrados */ ],
      "meta": { "selected": 10, "total": 50 }
    }
  ],
  "ui_hints": {
    "widgets": [
      { "widget": "checklist", "source_key": "transmutaciones_energeticas" }
    ]
  },
  "warnings": []
}
```

---

## 🗄️ Base de Datos

### Tabla: `pde_resolvers`

Almacena definiciones de resolvers con su política de resolución v1.

**Campos principales:**
- `id` - UUID PK
- `resolver_key` - Clave semántica única (ej: limpieza-rapida-v1)
- `label` - Etiqueta legible
- `description` - Descripción
- `definition` - ResolverDefinition v1 completo (JSONB)
- `status` - Estado: draft/published/archived
- `version` - Versión del resolver
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**Índices:**
- `idx_pde_resolvers_resolver_key` - Búsqueda por key
- `idx_pde_resolvers_status` - Filtrado por status
- `idx_pde_resolvers_definition_gin` - Búsquedas en JSONB

### Tabla: `pde_resolver_audit_log`

Log append-only de todas las acciones sobre resolvers (auditoría completa).

**Campos principales:**
- `id` - UUID PK
- `resolver_id` - FK a pde_resolvers
- `action` - Acción: create/update/publish/archive/delete/restore/duplicate
- `actor` - Quién realizó la acción
- `before` - Estado anterior (JSONB)
- `after` - Estado posterior (JSONB)
- `created_at` - Timestamp

---

## 🔧 API Endpoints

### GET /admin/api/resolvers

Lista todos los resolvers.

**Query params:**
- `includeDeleted` - Incluir borrados (default: false)
- `status` - Filtrar por status (draft/published/archived)

**Respuesta:**
```json
{
  "resolvers": [...]
}
```

### POST /admin/api/resolvers

Crea un nuevo resolver (siempre como draft).

**Body:**
```json
{
  "resolver_key": "limpieza-rapida-v1",
  "label": "Limpieza Rápida",
  "description": "Resolver para limpiezas rápidas",
  "definition": { /* ResolverDefinition v1 */ }
}
```

### GET /admin/api/resolvers/:id

Obtiene un resolver por ID.

### PATCH /admin/api/resolvers/:id

Actualiza un resolver (solo si es draft).

**Error si está published:** Sugiere usar `duplicate()`.

### DELETE /admin/api/resolvers/:id

Soft delete de un resolver.

### POST /admin/api/resolvers/:id/restore

Restaura un resolver borrado.

### POST /admin/api/resolvers/:id/publish

Publica un resolver (cambia status a published y bloquea edición).

### POST /admin/api/resolvers/:id/duplicate

Duplica un resolver (crea nuevo draft con version incrementada).

### POST /admin/api/resolvers/:id/preview

Preview de un resolver sobre un package.

**Body:**
```json
{
  "package_key": "limpieza-package",
  "package_id": "uuid",
  "context_overrides": {
    "tipo_limpieza": "rapida",
    "nivel_efectivo": 3
  }
}
```

**Respuesta:** ResolvedPackage v1

---

## 🎨 UI - Resolvers Studio

**Ruta:** `/admin/resolvers`

**Funcionalidades:**
- Listado de resolvers (tabs: Draft/Published/Archived)
- Editor con tabs:
  - **Básico**: resolver_key, label, description, status
  - **Política**: Editor JSON de policy v1
  - **Preview**: Selecciona package y ejecuta preview
  - **Panel GPT**: Genera prompt para copiar/pegar en GPT personalizado
- Autosave debounced (2s) para drafts
- Botones: Guardar, Publicar, Duplicar, Eliminar

### Panel GPT

Genera un prompt de texto que el usuario puede copiar y pegar en su GPT personalizado.

**Características:**
- Incluye PackageDefinition (o resumen si muy grande)
- Contextos seleccionados + mappings relevantes
- Catálogo/sources disponibles
- Instrucciones: "devuélveme SOLO JSON policy válido"
- Botón "Copiar prompt" con feedback inline (sin modal molesta)

---

## 🔄 Flujo de Resolución

1. **Input**: PackageDefinition + ResolverDefinition + effectiveContext + catalogsSnapshot
2. **Matching de reglas**: Evalúa `when.context` contra `effectiveContext`
3. **Aplicación de límites**: Aplica `max_items` según reglas o global
4. **Ordenamiento**: Aplica `ordering` (canonical/random/priority)
5. **Output**: ResolvedPackage con items recortados y metadatos

### Ejemplo Completo: Limpieza

**Reglas:**
- `rapida` → 5 items
- `basica` → 10 items
- `profunda` → 25 items
- `maestro` → 50 items

**Contexto efectivo:**
```json
{
  "tipo_limpieza": "rapida",
  "nivel_efectivo": 3
}
```

**Resultado:**
- Se aplica regla `rapida`
- Se recortan items a 5
- Se genera UI hint `checklist`

---

## 🧪 Tests

**Archivo:** `tests/resolver-v1.test.js`

**Tests mínimos críticos:**
- ✅ Validación de ResolverDefinition
- ✅ Matching de reglas por enum
- ✅ Matching de reglas por nivel
- ✅ Aplicación de max_items
- ✅ Fallback a global.default_max_items
- ✅ Generación de UI hints
- ✅ Operaciones CRUD del repositorio

---

## 🚀 Uso desde Recorridos/Widgets (Futuro)

```javascript
import { resolvePackage } from '../services/pde-resolver-service.js';

// Obtener resolver
const resolver = await resolversRepo.getByKey('limpieza-rapida-v1');

// Resolver package
const resolved = resolvePackage({
  packageDefinition: package.definition,
  resolverDefinition: resolver.definition,
  effectiveContext: {
    tipo_limpieza: 'rapida',
    nivel_efectivo: student.nivel_efectivo
  },
  catalogsSnapshot: await getCatalogsSnapshot()
});

// Usar resolved_sources en widgets
resolved.resolved_sources.forEach(source => {
  renderWidget(source.ui_hints.widget, source.items);
});
```

---

## 📝 Notas de Implementación

### Política v1 (Mínimo Viable)

- ✅ `rules[]` con `when.context`:
  - Match exact enum arrays
  - Rango nivel (min/max)
- ✅ `apply.sources[source_key].max_items`
- ✅ `ordering`: canonical por defecto
- ✅ Fallback: si no hay rule match, usar `global.default_max_items` si existe

### Hooks para Futuro

```javascript
// En pde-resolver-service.js
resolveSourceItems(source_key, catalogsSnapshot, selection_rules, effectiveContext)
```

**Hoy:** Implementado mínimo con transmutaciones  
**Mañana:** decretos/protecciones/frases sin reescribir el core

---

## 🔍 Verificación

### Ejecutar migración

```bash
node scripts/ejecutar-migracion-v5.28.0.js
```

### Verificar tablas

```sql
SELECT * FROM pde_resolvers;
SELECT * FROM pde_resolver_audit_log;
```

### Verificar en navegador

1. Ir a `/admin/resolvers`
2. Crear un resolver draft
3. Editar policy
4. Ejecutar preview
5. Publicar resolver

---

## 📦 Versión

**v5.28.0-resolver-v1-studio**

**Commit message:**
```
v5.28.0: Resolver v1 (DB+API+Studio+Preview+GPT panel)
```

**Description:**
Se implementa Resolver v1 canónico con tabla pde_resolvers + audit log, servicio determinista resolvePackage, endpoints admin CRUD/publish/preview, UI Resolvers Studio con editor de policy v1, preview sobre packages y panel GPT generador de policy (copy/paste). Sidebar integrado bajo Contextos & Mappings. Tests y docs incluidos. Fail-open y DOM API estrictos.

