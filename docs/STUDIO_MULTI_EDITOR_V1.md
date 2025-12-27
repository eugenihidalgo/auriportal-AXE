# 🎨 AuriPortal Studio - Sistema Multi-Editor v1

## Diseño de Arquitectura para Múltiples Vistas sobre una Fuente de Verdad

**Versión:** 1.0  
**Fecha:** 2025-12-17  
**Autor:** Arquitecto Principal  
**Estado:** Diseño Conceptual (NO implementación aún)

---

## 📋 Resumen Ejecutivo

**AuriPortal Studio** es el sistema que permite editar contenido estructurado (Recorridos, Navegación, configuraciones) desde múltiples vistas simultáneas sobre una **única fuente de verdad**.

### Problema que Resuelve

El sistema actual tiene múltiples tipos de contenido editable:
- **Recorridos**: Editor + templates + publish validation
- **Navegación**: JSON versionado + validator + visibility evaluator
- **Temas**: Theme Resolver v1 con base + overrides

Cada uno tiene su propio flujo de edición, pero comparten patrones similares:
- **Draft/Publish** (inmutabilidad en producción)
- **Validación** (estructura + contrato)
- **Multi-representación** (árbol, grafo, JSON, visual)

**Studio unifica estos patrones** en un modelo que permite múltiples vistas sobre el mismo documento.

---

## 1. Principios Fundamentales

### 1.1. Source of Truth (Fuente de Verdad)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         StudioDocument                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────┐    ┌──────────────────┐                      │
│   │  definition_json │    │   layout_json    │                      │
│   │  (LÓGICA)        │    │   (VISUAL)       │                      │
│   │                  │    │                  │                      │
│   │  - steps/nodes   │    │  - positions     │                      │
│   │  - edges         │    │  - groups        │                      │
│   │  - conditions    │    │  - zoom/pan      │                      │
│   │  - events        │    │  - visual_order  │                      │
│   │  - visibility    │    │  - collapsed     │                      │
│   └──────────────────┘    └──────────────────┘                      │
│                                                                      │
│   ┌──────────────────────────────────────────┐                      │
│   │          theme_binding                    │                      │
│   │  - base_theme_id                         │                      │
│   │  - overrides (patch)                     │                      │
│   │  - preview_mode (dark/light)             │                      │
│   └──────────────────────────────────────────┘                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Regla absoluta**: Todas las vistas leen y escriben sobre el mismo `StudioDocument`. Ninguna vista tiene su propia fuente de datos.

### 1.2. Separación Definition/Layout

| Campo | Contiene | Publicado | Editable por |
|-------|----------|-----------|--------------|
| `definition_json` | Lógica, estructura, contenido | ✅ SÍ | Todas las vistas |
| `layout_json` | Posiciones, grupos visuales | ❌ NO (solo Studio) | Workflow view, Canvas |
| `theme_binding` | Tema base + overrides | ✅ SÍ | Inspector, Theme selector |

**Principio clave**: `definition_json` es lo que el runtime consume. `layout_json` es metadata de edición que NUNCA afecta el runtime.

### 1.3. Publish = Inmutable

```
DRAFT                                    PUBLISHED
├─ Editable                              ├─ Inmutable
├─ Puede tener errores                   ├─ Validado 100%
├─ Múltiples saves/día                   ├─ Versión numerada (1, 2, 3...)
├─ Solo Studio puede leer                ├─ Runtime consume SOLO published
└─ layout_json guardado                  └─ definition_json + theme_binding
```

**Al publicar**:
1. Validación estricta (bloquea si errores)
2. `definition_json` se congela en versión
3. `theme_binding` se congela (tema resuelto)
4. `layout_json` NO se publica (es metadata de Studio)

### 1.4. Fail-Open

```
SI (error en Studio) → NO romper portal cliente
SI (error en vista) → Mostrar fallback, loguear, continuar
SI (layout_json corrupto) → Regenerar desde definition_json
SI (theme_binding inválido) → Usar theme_base del sistema
```

---

## 2. Vistas del Editor

### 2.1. Roadmap de Vistas

| Vista | Versión | Descripción | Capacidades |
|-------|---------|-------------|-------------|
| **Outline/Tree** | v1 | Árbol jerárquico de nodos | CRUD steps, reorder, collapse |
| **Inspector** | v1 | Panel de propiedades | Editar props, theme_binding |
| **Raw JSON** | v1 | Editor JSON directo | Import/export, debugging |
| **Workflow Graph** | v1.5 | Grafo tipo Typeform | Visualizar flujo, editar edges |
| **Spatial Canvas** | v2 | Canvas tipo Figma | Posicionamiento libre, grupos |

### 2.2. Vista: Outline/Tree (v1)

```
┌────────────────────────────────────────┐
│ 📁 Recorrido: Limpieza Diaria          │
│ ├─ 📄 step_intro (screen_text)         │
│ ├─ 📄 step_choice (screen_choice)      │
│ │   ├─ [edge → step_practica]          │
│ │   └─ [edge → step_info]              │
│ ├─ 📄 step_practica (screen_audio)     │
│ └─ 📄 step_fin (screen_text)           │
└────────────────────────────────────────┘
```

**Capacidades**:
- Ver estructura jerárquica de steps
- Crear/eliminar/duplicar steps
- Reordenar (drag & drop)
- Expandir/colapsar (guarda en `layout_json.collapsed[]`)
- Click → selecciona para Inspector

**Qué puede editar**:
- `definition_json.steps` (CRUD)
- `definition_json.edges` (visualiza, no edita directamente)
- `layout_json.visual_order` (orden de visualización)
- `layout_json.collapsed` (estado de colapso)

### 2.3. Vista: Inspector (v1)

```
┌────────────────────────────────────────┐
│ INSPECTOR                              │
│ ────────────────────────────────────── │
│ Step: step_intro                       │
│ Template: screen_text                  │
│                                        │
│ ▼ Propiedades                          │
│   Title: [Bienvenida a la limpieza  ]  │
│   Body:  [Has comenzado un nuevo... ]  │
│   CTA:   [Continuar                 ]  │
│                                        │
│ ▼ Tema                                 │
│   Base: [Aurora Dark ▼]                │
│   Overrides:                           │
│   • --accent-primary: [#ffd86b]        │
│   • [+ Añadir override]                │
│                                        │
│ ▼ Avanzado                             │
│   step_type: [content_display]         │
│   emit: [+ Añadir evento]              │
└────────────────────────────────────────┘
```

**Capacidades**:
- Editar props del step seleccionado
- Cambiar template
- Configurar theme_binding (base + overrides)
- Configurar eventos a emitir

**Qué puede editar**:
- `definition_json.steps[id].props` (edita propiedades)
- `definition_json.steps[id].step_type` (opcional)
- `definition_json.steps[id].emit` (eventos)
- `theme_binding.base_theme_id` (selector)
- `theme_binding.overrides` (patch de variables)

### 2.4. Vista: Raw JSON (v1)

```
┌────────────────────────────────────────┐
│ [Import JSON] [Export JSON] [Validate] │
│ ────────────────────────────────────── │
│ {                                      │
│   "id": "limpieza-diaria",             │
│   "entry_step_id": "step_intro",       │
│   "steps": {                           │
│     "step_intro": {                    │
│       "screen_template_id": "screen_..│
│       ...                              │
│     }                                  │
│   },                                   │
│   "edges": [...]                       │
│ }                                      │
└────────────────────────────────────────┘
```

**Capacidades**:
- Ver/editar JSON directamente
- Importar JSON externo
- Exportar JSON (bundle con definition + layout + theme)
- Validar en tiempo real

**Qué puede editar**:
- `definition_json` (completo, con validación)
- `layout_json` (opcional, en modo avanzado)
- `theme_binding` (opcional, en modo avanzado)

### 2.5. Vista: Workflow Graph (v1.5)

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│   ┌─────────┐                                          │
│   │ Intro   │─────────┐                                │
│   └─────────┘         │                                │
│                       ▼                                │
│               ┌─────────────┐                          │
│               │   Choice    │                          │
│               └──────┬──────┘                          │
│                      │                                 │
│        ┌─────────────┼─────────────┐                   │
│        ▼             ▼             ▼                   │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│   │Práctica │  │  Info   │  │  Skip   │               │
│   └────┬────┘  └────┬────┘  └────┬────┘               │
│        │            │            │                     │
│        └────────────┴────────────┘                     │
│                     │                                  │
│                     ▼                                  │
│               ┌─────────┐                              │
│               │   Fin   │                              │
│               └─────────┘                              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Capacidades**:
- Visualizar flujo completo como grafo
- Crear/eliminar edges con drag & drop
- Mover nodos (guarda posición en `layout_json`)
- Ver condiciones en edges

**Qué puede editar**:
- `definition_json.edges` (conexiones)
- `definition_json.edges[].condition` (condiciones)
- `layout_json.positions` (coordenadas x,y)
- `layout_json.groups` (agrupaciones visuales)

### 2.6. Vista: Spatial Canvas (v2)

```
┌────────────────────────────────────────────────────────────┐
│ [Zoom: 100%] [Pan] [Grid] [Snap] [Group]                   │
│ ────────────────────────────────────────────────────────── │
│                                                            │
│   ╔═════════════════╗        ╔═════════════════╗          │
│   ║   ONBOARDING    ║        ║  PRÁCTICA CORE  ║          │
│   ║ ┌─────────────┐ ║        ║ ┌─────────────┐ ║          │
│   ║ │   Intro     │ ║───────▶║ │  Ejercicio  │ ║          │
│   ║ └─────────────┘ ║        ║ └─────────────┘ ║          │
│   ║ ┌─────────────┐ ║        ║ ┌─────────────┐ ║          │
│   ║ │   Choice    │ ║        ║ │   Audio     │ ║          │
│   ║ └─────────────┘ ║        ║ └─────────────┘ ║          │
│   ╚═════════════════╝        ╚═════════════════╝          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Capacidades** (futuro):
- Posicionamiento libre tipo Figma
- Grupos visuales (frames)
- Zoom infinito
- Multi-selección
- Copiar/pegar entre documentos

**Qué puede editar**:
- Todo lo de Workflow Graph
- `layout_json.groups[]` (frames, agrupaciones)
- `layout_json.zoom` / `layout_json.pan` (viewport)

---

## 3. Capability Model

### 3.1. Matriz de Capacidades por Vista

| Capacidad | Outline | Inspector | Raw JSON | Workflow | Canvas |
|-----------|---------|-----------|----------|----------|--------|
| **CRUD Steps** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Edit Props** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Edit Edges** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Edit Conditions** | ❌ | ✅* | ✅ | ✅ | ✅ |
| **Edit Theme** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Move Positions** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Create Groups** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Import/Export** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Validate** | ❌ | ❌ | ✅ | ❌ | ❌ |

*Inspector edita condiciones del step/edge seleccionado

### 3.2. Operaciones sobre el Documento

```typescript
// Operaciones atómicas que cualquier vista puede invocar
interface StudioOperations {
  // Steps
  createStep(stepId: string, template: string): void;
  updateStep(stepId: string, patch: Partial<StepDefinition>): void;
  deleteStep(stepId: string): void;
  
  // Edges
  createEdge(from: string, to: string, condition?: Condition): void;
  updateEdge(edgeId: string, patch: Partial<EdgeDefinition>): void;
  deleteEdge(edgeId: string): void;
  
  // Layout (no afecta published)
  updatePosition(stepId: string, x: number, y: number): void;
  createGroup(groupId: string, stepIds: string[]): void;
  updateViewport(zoom: number, panX: number, panY: number): void;
  
  // Theme
  setBaseTheme(themeId: string): void;
  setThemeOverride(variable: string, value: string): void;
  removeThemeOverride(variable: string): void;
  
  // Document
  save(): Promise<void>;
  validate(): ValidationResult;
  publish(releaseNotes?: string): Promise<Version>;
}
```

---

## 4. Modelo de Datos: StudioDocument v1

### 4.1. Estructura Conceptual

```json
{
  "document_id": "uuid",
  "document_type": "recorrido | navigation | config",
  "entity_id": "limpieza-diaria",
  
  "definition_json": {
    // Contenido específico del tipo
    // Para recorridos: { id, entry_step_id, steps, edges }
    // Para navigation: { id, version, sections }
  },
  
  "layout_json": {
    "schema_version": "v1",
    "positions": {
      "step_intro": { "x": 100, "y": 50 },
      "step_choice": { "x": 100, "y": 200 }
    },
    "visual_order": ["step_intro", "step_choice", "step_practica"],
    "collapsed": ["step_practica"],
    "groups": [
      {
        "group_id": "onboarding",
        "label": "Onboarding",
        "step_ids": ["step_intro", "step_choice"],
        "color": "#4a90d9"
      }
    ],
    "viewport": {
      "zoom": 1.0,
      "pan_x": 0,
      "pan_y": 0
    }
  },
  
  "theme_binding": {
    "base_theme_id": "aurora-dark",
    "overrides": {
      "--accent-primary": "#ffd86b",
      "--bg-card": "#1a1f2e"
    },
    "preview_mode": "dark"
  },
  
  "metadata": {
    "created_at": "2025-12-17T10:00:00Z",
    "updated_at": "2025-12-17T12:30:00Z",
    "updated_by": "admin@example.com",
    "current_version": null,
    "draft_id": "uuid"
  }
}
```

### 4.2. Esquema: LayoutModel v1

```json
{
  "$schema": "https://auriportal.com/schemas/layout-v1.json",
  "type": "object",
  "properties": {
    "schema_version": {
      "type": "string",
      "const": "v1"
    },
    "positions": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "x": { "type": "number" },
          "y": { "type": "number" }
        },
        "required": ["x", "y"]
      }
    },
    "visual_order": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Orden de steps en vista Outline (top→bottom)"
    },
    "collapsed": {
      "type": "array",
      "items": { "type": "string" },
      "description": "IDs de steps colapsados en Outline"
    },
    "groups": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "group_id": { "type": "string" },
          "label": { "type": "string" },
          "step_ids": { "type": "array", "items": { "type": "string" } },
          "color": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
          "position": {
            "type": "object",
            "properties": {
              "x": { "type": "number" },
              "y": { "type": "number" }
            }
          }
        },
        "required": ["group_id", "step_ids"]
      }
    },
    "viewport": {
      "type": "object",
      "properties": {
        "zoom": { "type": "number", "minimum": 0.1, "maximum": 10 },
        "pan_x": { "type": "number" },
        "pan_y": { "type": "number" }
      }
    }
  }
}
```

### 4.3. Esquema: ThemeBinding v1

```json
{
  "$schema": "https://auriportal.com/schemas/theme-binding-v1.json",
  "type": "object",
  "properties": {
    "base_theme_id": {
      "type": "string",
      "description": "ID del tema base (de theme_definitions)"
    },
    "overrides": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "description": "Patch de variables CSS sobre el tema base"
    },
    "preview_mode": {
      "type": "string",
      "enum": ["light", "dark", "system"],
      "default": "dark"
    }
  },
  "required": ["base_theme_id"]
}
```

---

## 5. Integración con Sistemas Existentes

### 5.1. Integración con Recorridos (Existente)

**Estado actual**:
- Tablas: `recorridos`, `recorrido_drafts`, `recorrido_versions`, `recorrido_audit_log`
- Draft guarda `definition_json` (JSONB)
- Publish crea versión inmutable

**Cambios para Studio**:

```sql
-- OPCIÓN A: Añadir columnas a recorrido_drafts (MÍNIMO)
ALTER TABLE recorrido_drafts 
ADD COLUMN layout_json JSONB DEFAULT '{}',
ADD COLUMN theme_binding JSONB DEFAULT '{}';

-- NO AÑADIR A recorrido_versions (layout no se publica)
-- theme_binding SÍ se publica (añadir si no existe)
ALTER TABLE recorrido_versions
ADD COLUMN IF NOT EXISTS theme_binding JSONB DEFAULT '{}';
```

**Migración de datos existentes**:
```sql
-- Generar layout_json inicial desde definition_json
UPDATE recorrido_drafts
SET layout_json = jsonb_build_object(
  'schema_version', 'v1',
  'positions', '{}',
  'visual_order', (
    SELECT jsonb_agg(key ORDER BY key)
    FROM jsonb_object_keys(definition_json->'steps') AS key
  ),
  'collapsed', '[]',
  'groups', '[]',
  'viewport', '{"zoom": 1.0, "pan_x": 0, "pan_y": 0}'
)
WHERE layout_json IS NULL OR layout_json = '{}';
```

### 5.2. Integración con Navegación (Existente)

**Estado actual**:
- Archivo JSON: `config/navigation/navigation.v1.json`
- Validador: `navigation-validator.js`
- Evaluador: `visibility-evaluator.js`
- Endpoint: `GET /api/navigation`

**Cambios para Studio**:

Para v1, la navegación se sigue editando como archivo JSON.

Para v1.5+, añadir tabla similar a recorridos:

```sql
-- FUTURO (v1.5): Tabla para navegación versionada
CREATE TABLE IF NOT EXISTS navigation_definitions (
  id TEXT PRIMARY KEY DEFAULT 'main-navigation',
  definition_json JSONB NOT NULL,
  layout_json JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  current_version INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS navigation_versions (
  navigation_id TEXT NOT NULL,
  version INT NOT NULL,
  definition_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  PRIMARY KEY (navigation_id, version)
);
```

### 5.3. Integración con Theme System (Theme Resolver v1)

**Estado actual** (de `docs/THEME_RESOLVER_DESIGN.md`):
- `theme_definitions` tabla con temas completos
- `ThemeContext` para resolución
- `ThemeEffective` resultado de resolución
- `applyTheme()` aplica al HTML

**Integración con Studio**:

```javascript
// En Studio, el theme_binding del documento se usa para preview
async function resolveThemeForStudio(document, previewMode) {
  const { base_theme_id, overrides } = document.theme_binding;
  
  // Cargar tema base
  const baseTheme = await themeRepository.getById(base_theme_id);
  if (!baseTheme) {
    return getSystemDefaultTheme();
  }
  
  // Aplicar overrides
  const effectiveValues = {
    ...baseTheme.values,
    ...overrides
  };
  
  return {
    base_theme: baseTheme,
    overrides,
    effective_values: effectiveValues,
    preview_mode: previewMode || document.theme_binding.preview_mode
  };
}
```

**Al publicar**, `theme_binding` se congela:

```javascript
async function publishWithTheme(recorridoId) {
  const draft = await draftRepo.getCurrentDraft(recorridoId);
  
  // Resolver tema y guardar valores efectivos
  const resolvedTheme = await resolveThemeForStudio(draft);
  
  const publishedThemeBinding = {
    base_theme_id: draft.theme_binding.base_theme_id,
    overrides: draft.theme_binding.overrides,
    // Snapshot de valores efectivos en el momento de publish
    effective_values_snapshot: resolvedTheme.effective_values
  };
  
  // Crear versión con tema resuelto
  await versionRepo.createVersion(
    recorridoId,
    nextVersion,
    draft.definition_json,
    publishedThemeBinding,
    adminId
  );
}
```

---

## 6. Endpoints API (Solo Diseño)

### 6.1. Endpoints Studio v1

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/admin/api/studio/:type/:id` | Obtener documento completo (draft) |
| `PATCH` | `/admin/api/studio/:type/:id` | Actualizar documento (definition + layout) |
| `POST` | `/admin/api/studio/:type/:id/validate` | Validar documento |
| `POST` | `/admin/api/studio/:type/:id/publish` | Publicar versión |
| `GET` | `/admin/api/studio/:type/:id/export` | Exportar bundle completo |
| `POST` | `/admin/api/studio/:type/import` | Importar bundle |

**Parámetros**:
- `:type` = `recorrido` | `navigation` | `config`
- `:id` = ID del documento

### 6.2. GET Draft Document

```http
GET /admin/api/studio/recorrido/limpieza-diaria
Authorization: Bearer <admin_token>
```

**Response 200**:
```json
{
  "document_type": "recorrido",
  "entity_id": "limpieza-diaria",
  "draft": {
    "draft_id": "uuid",
    "definition_json": { ... },
    "layout_json": { ... },
    "theme_binding": { ... },
    "updated_at": "2025-12-17T12:30:00Z",
    "updated_by": "admin@example.com"
  },
  "published_version": {
    "version": 3,
    "definition_json": { ... },
    "theme_binding": { ... },
    "created_at": "2025-12-15T10:00:00Z"
  },
  "available_themes": [
    { "id": "aurora-dark", "name": "Aurora Oscuro" },
    { "id": "aurora-light", "name": "Aurora Claro" },
    { "id": "celebration-gold", "name": "Celebración Dorada" }
  ]
}
```

### 6.3. PATCH Document

```http
PATCH /admin/api/studio/recorrido/limpieza-diaria
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "definition_json": { ... },
  "layout_json": { ... },
  "theme_binding": {
    "base_theme_id": "aurora-dark",
    "overrides": {
      "--accent-primary": "#ffd86b"
    }
  }
}
```

**Comportamiento**:
1. Validar `definition_json` con `validateDefinitionForDraft()`
2. Normalizar `definition_json`
3. Validar `layout_json` (esquema LayoutModel v1)
4. Validar `theme_binding` (esquema ThemeBinding v1)
5. Guardar en draft
6. Registrar en audit log

**Response 200**:
```json
{
  "draft_id": "uuid",
  "definition_json": { ... },
  "layout_json": { ... },
  "theme_binding": { ... },
  "updated_at": "2025-12-17T12:35:00Z",
  "validation": {
    "valid": true,
    "warnings": ["Step 'step_info': no tiene step_type definido"]
  }
}
```

### 6.4. POST Validate

```http
POST /admin/api/studio/recorrido/limpieza-diaria/validate
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "mode": "publish"  // "draft" | "publish"
}
```

**Response 200**:
```json
{
  "valid": false,
  "errors": [
    "Step 'step_audio': props.audio_ref es obligatorio para publicar"
  ],
  "warnings": [
    "Step 'step_info': no tiene step_type definido"
  ],
  "can_publish": false
}
```

### 6.5. POST Publish

```http
POST /admin/api/studio/recorrido/limpieza-diaria/publish
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "release_notes": "Añadido nuevo paso de audio"
}
```

**Comportamiento**:
1. Validar con `isPublish: true` (bloquear si errores)
2. Resolver `theme_binding` → snapshot de valores
3. Crear versión inmutable
4. Actualizar `current_published_version`
5. Registrar en audit log

**Response 201**:
```json
{
  "version": 4,
  "status": "published",
  "definition_json": { ... },
  "theme_binding": {
    "base_theme_id": "aurora-dark",
    "overrides": { ... },
    "effective_values_snapshot": { ... }
  },
  "created_at": "2025-12-17T12:40:00Z",
  "validation": {
    "warnings": ["Step 'step_info': no tiene step_type definido"]
  }
}
```

### 6.6. GET Export

```http
GET /admin/api/studio/recorrido/limpieza-diaria/export
Authorization: Bearer <admin_token>
```

**Response 200**:
```json
{
  "export_version": "v1",
  "exported_at": "2025-12-17T12:45:00Z",
  "document_type": "recorrido",
  "entity_id": "limpieza-diaria",
  "draft": {
    "definition_json": { ... },
    "layout_json": { ... },
    "theme_binding": { ... }
  },
  "published_versions": [
    {
      "version": 4,
      "definition_json": { ... },
      "theme_binding": { ... }
    }
  ]
}
```

### 6.7. POST Import

```http
POST /admin/api/studio/recorrido/import
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "export_version": "v1",
  "entity_id": "limpieza-diaria-imported",
  "draft": {
    "definition_json": { ... },
    "layout_json": { ... },
    "theme_binding": { ... }
  }
}
```

**Comportamiento**:
- Si `entity_id` existe → crea nuevo draft (no sobrescribe published)
- Si no existe → crea recorrido + draft

---

## 7. Persistencia: Propuesta Mínima

### 7.1. Cambios a Tablas Existentes

**✅ RECOMENDADO (sin nuevas tablas)**:

```sql
-- Migración v5.3.0: Studio layout + theme binding para drafts
-- Añade campos para soportar múltiples vistas de edición

-- 1. Añadir layout_json a drafts
ALTER TABLE recorrido_drafts
ADD COLUMN IF NOT EXISTS layout_json JSONB DEFAULT '{}';

-- 2. Añadir theme_binding a drafts
ALTER TABLE recorrido_drafts
ADD COLUMN IF NOT EXISTS theme_binding JSONB DEFAULT '{"base_theme_id": "aurora-dark", "overrides": {}, "preview_mode": "dark"}';

-- 3. Añadir theme_binding a versions (se publica con el contenido)
ALTER TABLE recorrido_versions
ADD COLUMN IF NOT EXISTS theme_binding JSONB DEFAULT '{}';

-- 4. Índice para búsqueda por tema
CREATE INDEX IF NOT EXISTS idx_recorrido_drafts_theme
ON recorrido_drafts ((theme_binding->>'base_theme_id'));

-- 5. Comentarios
COMMENT ON COLUMN recorrido_drafts.layout_json IS 
'Metadata visual para Studio: posiciones, grupos, viewport. NO se publica.';

COMMENT ON COLUMN recorrido_drafts.theme_binding IS 
'Binding de tema: base_theme_id + overrides. Se publica con la versión.';

COMMENT ON COLUMN recorrido_versions.theme_binding IS 
'Tema resuelto en el momento de publicación. Inmutable.';
```

### 7.2. Verificación de Tablas Existentes

Antes de aplicar migración:

```sql
-- Verificar que existen las tablas base
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'recorrido_drafts'
);

SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'recorrido_versions'
);

-- Verificar columnas existentes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recorrido_drafts';
```

### 7.3. Justificación: No Crear Nuevas Tablas

**Por qué NO crear `studio_documents`**:

1. **Ya existe el modelo**: `recorrido_drafts` + `recorrido_versions` es exactamente el patrón Studio
2. **Evitar duplicación**: Una tabla "genérica" duplicaría la lógica de recorridos
3. **Simplicidad**: Añadir columnas JSONB es mínimamente invasivo
4. **Regla del proyecto**: "Sin tablas aplicadas = feature inexistente"

**Cuándo SÍ crear nuevas tablas** (v1.5+):
- `navigation_definitions` + `navigation_versions` (cuando navegación sea versionada)
- `config_definitions` + `config_versions` (cuando configs sean versionadas)

---

## 8. Conexión con Theme System

### 8.1. Selector de Tema Base en Editor

```javascript
// Hook para obtener temas disponibles
async function useAvailableThemes() {
  const themes = await fetch('/admin/api/themes?status=active');
  return themes.map(t => ({
    id: t.key,
    name: t.name,
    preview: t.values // Para preview en selector
  }));
}

// Componente selector en Inspector
function ThemeSelector({ currentBinding, onChange }) {
  const themes = useAvailableThemes();
  
  return (
    <Select
      value={currentBinding.base_theme_id}
      onChange={(themeId) => onChange({ 
        ...currentBinding, 
        base_theme_id: themeId 
      })}
    >
      {themes.map(t => (
        <Option key={t.id} value={t.id}>
          <ThemePreviewSwatch values={t.preview} />
          {t.name}
        </Option>
      ))}
    </Select>
  );
}
```

### 8.2. Overrides por Documento

```javascript
// Editor de overrides en Inspector
function ThemeOverridesEditor({ currentBinding, onChange }) {
  const addOverride = (variable, value) => {
    onChange({
      ...currentBinding,
      overrides: {
        ...currentBinding.overrides,
        [variable]: value
      }
    });
  };
  
  const removeOverride = (variable) => {
    const { [variable]: _, ...rest } = currentBinding.overrides;
    onChange({
      ...currentBinding,
      overrides: rest
    });
  };
  
  return (
    <div>
      {Object.entries(currentBinding.overrides).map(([variable, value]) => (
        <OverrideRow 
          key={variable}
          variable={variable}
          value={value}
          onRemove={() => removeOverride(variable)}
        />
      ))}
      <AddOverrideButton 
        availableVariables={THEME_CONTRACT_VARIABLES}
        onAdd={addOverride}
      />
    </div>
  );
}
```

### 8.3. Preview Dark/Light

```javascript
// Toggle de preview mode
function PreviewModeToggle({ currentBinding, onChange }) {
  const modes = ['dark', 'light', 'system'];
  
  return (
    <ToggleGroup
      value={currentBinding.preview_mode}
      onChange={(mode) => onChange({
        ...currentBinding,
        preview_mode: mode
      })}
    >
      <Toggle value="dark" icon="moon" />
      <Toggle value="light" icon="sun" />
      <Toggle value="system" icon="monitor" />
    </ToggleGroup>
  );
}
```

### 8.4. Tokens Canónicos (Sin Hardcode)

**Variables disponibles para overrides** (de Theme Contract v1):

```javascript
// Importar desde contrato (NUNCA hardcodear)
import { THEME_CONTRACT_VARIABLES } from '../core/theme/theme-contract.js';

// Estructura del contrato
const THEME_CONTRACT_VARIABLES = {
  backgrounds: [
    '--bg-main',
    '--bg-card',
    '--bg-panel',
    '--bg-hover',
    '--bg-active'
  ],
  texts: [
    '--text-primary',
    '--text-secondary',
    '--text-muted',
    '--text-accent'
  ],
  accents: [
    '--accent-primary',
    '--accent-secondary',
    '--accent-hover'
  ],
  // ... etc
};
```

---

## 9. Plan de Implementación por Fases

### Fase 1: Fundamentos (v1.0) - 2 semanas

**Objetivo**: Migración de datos + endpoints base

**Tareas**:
1. ✅ Crear migración SQL (layout_json + theme_binding)
2. ✅ Ejecutar migración en dev/staging
3. ⬜ Crear endpoint GET /admin/api/studio/:type/:id
4. ⬜ Crear endpoint PATCH /admin/api/studio/:type/:id
5. ⬜ Adaptar validadores para theme_binding
6. ⬜ Tests de integración

**Entregables**:
- Migración aplicada
- Endpoints funcionando
- Tests pasando

### Fase 2: Vistas Base (v1.0) - 2 semanas

**Objetivo**: Outline + Inspector + Raw JSON funcionando

**Tareas**:
1. ⬜ Implementar StudioController (state management)
2. ⬜ Implementar OutlineView (árbol de steps)
3. ⬜ Implementar InspectorView (panel de props)
4. ⬜ Implementar RawJsonView (import/export)
5. ⬜ Conectar con endpoints
6. ⬜ Añadir selector de tema en Inspector
7. ⬜ Tests E2E

**Entregables**:
- Editor funcional con 3 vistas
- Theme binding editable
- Import/Export funcionando

### Fase 3: Workflow Graph (v1.5) - 3 semanas

**Objetivo**: Vista de grafo tipo Typeform

**Tareas**:
1. ⬜ Implementar WorkflowGraphView
2. ⬜ Layout engine para posicionamiento automático
3. ⬜ Drag & drop para edges
4. ⬜ Guardar posiciones en layout_json
5. ⬜ Visualización de condiciones
6. ⬜ Tests de rendering

**Entregables**:
- Vista de grafo funcional
- Posiciones persistidas
- Edges editables visualmente

### Fase 4: Polish + Canvas Preview (v2.0) - 4 semanas

**Objetivo**: Canvas espacial tipo Figma (preview)

**Tareas**:
1. ⬜ Implementar SpatialCanvasView
2. ⬜ Zoom infinito + pan
3. ⬜ Grupos visuales (frames)
4. ⬜ Multi-selección
5. ⬜ Copiar/pegar
6. ⬜ Performance optimization

**Entregables**:
- Canvas básico funcional
- Grupos persistidos
- Performance aceptable (<100ms render)

---

## 10. Criterios de Éxito

### 10.1. El Diseño es Correcto Si...

- [x] **No limita futuros editores**: Canvas, 3D, VR... cualquier vista puede añadirse
- [x] **Múltiples vistas simultáneas**: Outline + Inspector + Graph abiertos = mismo documento
- [x] **Mantiene contratos existentes**: Recorridos siguen funcionando igual
- [x] **Aísla layout de lógica**: `layout_json` nunca afecta runtime

### 10.2. Validación de Diseño

**Test mental 1**: ¿Puedo añadir una vista "Timeline" sin cambiar el modelo?
- ✅ Sí: Lee `definition_json`, escribe en `layout_json.timeline_positions`

**Test mental 2**: ¿El runtime ignora cambios de layout?
- ✅ Sí: Runtime solo lee `recorrido_versions.definition_json`

**Test mental 3**: ¿Puedo cambiar de tema sin romper el flujo?
- ✅ Sí: `theme_binding` es independiente de `definition_json`

**Test mental 4**: ¿Si Studio falla, el portal sigue funcionando?
- ✅ Sí: Runtime consume versiones publicadas, no drafts

---

## 11. Glosario

| Término | Definición |
|---------|------------|
| **StudioDocument** | Unidad de edición: definition + layout + theme |
| **definition_json** | Estructura lógica (steps, edges, conditions) |
| **layout_json** | Metadata visual (posiciones, grupos, viewport) |
| **theme_binding** | Referencia a tema base + overrides |
| **Vista** | Representación UI del documento (Outline, Graph, etc.) |
| **Capability** | Operación que una vista puede ejecutar |
| **Publish** | Crear versión inmutable validada |
| **Draft** | Versión editable en progreso |

---

## 12. Referencias

### Documentos Relacionados
- `docs/THEME_RESOLVER_DESIGN.md` - Sistema de resolución de temas
- `docs/THEME_CONTRACT.md` - Contrato canónico de variables CSS
- `database/migrations/v5.1.0-create-recorridos-versioning.sql` - Modelo de versionado

### Código Existente
- `src/endpoints/admin-recorridos-api.js` - Endpoints actuales de recorridos
- `src/endpoints/api-navigation.js` - Endpoint de navegación
- `src/core/recorridos/validate-recorrido-definition.js` - Validador de recorridos
- `src/core/navigation/navigation-validator.js` - Validador de navegación

### Esquemas
- `config/navigation/navigation.v1.json` - Ejemplo de NavigationDefinition

---

**FIN DEL DOCUMENTO**

Este diseño permite implementar AuriPortal Studio de forma incremental, manteniendo compatibilidad con todos los sistemas existentes y preparando el terreno para vistas futuras como el canvas espacial tipo Figma.














