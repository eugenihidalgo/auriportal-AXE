# Editor de Recorridos - Cómo Funciona (Fuente de Verdad)

**Versión:** 1.0.0  
**Fecha:** 2025-12-17  
**Estado:** PRODUCCIÓN

---

## 🎯 Resumen Ejecutivo

El **Editor de Recorridos** de AuriPortal es un sistema de authoring que permite crear, editar, validar y publicar flujos pedagógicos (recorridos) que los alumnos ejecutan en runtime.

### Principios Arquitectónicos

1. **Draft/Publish**: Los drafts son editables; las versiones publicadas son INMUTABLES
2. **Validación Progresiva**: Draft permite errores; Publish bloquea si hay errores
3. **Auditoría Completa**: Todas las acciones quedan registradas
4. **Registry-Driven**: Templates, condiciones y eventos vienen de registries centralizados
5. **Fail-Open**: El sistema nunca bloquea al alumno si algo falla

---

## 📁 Arquitectura de Archivos

```
src/
├── core/
│   ├── recorridos/
│   │   ├── validate-recorrido-definition.js   # Validador principal
│   │   ├── normalize-recorrido-definition.js  # Normalización de definiciones
│   │   ├── step-types.js                      # Tipos de step válidos
│   │   ├── runtime/
│   │   │   └── recorrido-runtime.js           # Motor de ejecución
│   │   └── step-handlers/
│   │       ├── selection-handler.js           # Handler genérico selección
│   │       ├── practice-timer-handler.js      # Handler timer
│   │       └── limpieza-energetica-handler.js # Handler específico racha
│   ├── registry/
│   │   ├── screen-template-registry.js        # Templates de pantalla
│   │   ├── step-type-registry.js              # Tipos de step
│   │   ├── condition-registry.js              # Condiciones para edges
│   │   ├── event-registry.js                  # Eventos de dominio
│   │   └── pde-resource-registry.js           # Recursos PDE
│   └── repos/
│       ├── recorrido-repo.js                  # Contrato: recorridos
│       ├── recorrido-draft-repo.js            # Contrato: drafts
│       ├── recorrido-version-repo.js          # Contrato: versiones
│       └── recorrido-audit-repo.js            # Contrato: auditoría
├── infra/
│   └── repos/
│       ├── recorrido-repo-pg.js               # Implementación PostgreSQL
│       ├── recorrido-draft-repo-pg.js
│       ├── recorrido-version-repo-pg.js
│       └── recorrido-audit-repo-pg.js
├── endpoints/
│   ├── admin-recorridos.js                    # UI admin HTML
│   ├── admin-recorridos-api.js                # API REST JSON
│   └── recorridos-runtime.js                  # API runtime para alumnos
└── html/
    └── admin/
        └── recorridos/
            ├── recorridos-listado.html
            └── recorridos-editor.html

database/
└── migrations/
    ├── v5.1.0-create-recorridos-versioning.sql  # Tablas principales
    └── v5.2.0-create-recorrido-runtime.sql      # Tablas de runtime
```

---

## 🗄️ Modelo de Datos (PostgreSQL)

### Tabla: `recorridos`

```sql
CREATE TABLE recorridos (
    id TEXT PRIMARY KEY,                    -- Slug técnico (ej: "limpieza-diaria")
    name TEXT NOT NULL,                     -- Nombre legible
    status TEXT DEFAULT 'draft',            -- draft|published|deprecated|archived
    current_draft_id UUID,                  -- FK al draft actual
    current_published_version INT,          -- Versión publicada más reciente
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `recorrido_drafts`

```sql
CREATE TABLE recorrido_drafts (
    draft_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorrido_id TEXT NOT NULL REFERENCES recorridos(id),
    definition_json JSONB NOT NULL,         -- RecorridoDefinition completa
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT                         -- Admin que editó
);
```

### Tabla: `recorrido_versions`

```sql
CREATE TABLE recorrido_versions (
    recorrido_id TEXT NOT NULL REFERENCES recorridos(id),
    version INT NOT NULL,                   -- 1, 2, 3, ...
    status TEXT DEFAULT 'published',        -- published|deprecated
    definition_json JSONB NOT NULL,         -- INMUTABLE después de publicar
    release_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    PRIMARY KEY (recorrido_id, version)
);
```

### Tabla: `recorrido_audit_log`

```sql
CREATE TABLE recorrido_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorrido_id TEXT NOT NULL,
    draft_id UUID,
    action TEXT NOT NULL,                   -- create_recorrido|update_draft|validate_draft|publish_version|...
    details_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);
```

---

## 📋 Contrato: RecorridoDefinition

```json
{
  "id": "limpieza_energetica_diaria_v1",
  "name": "Limpieza Energética Diaria",
  "description": "Recorrido diario de limpieza...",
  "entry_step_id": "step_seleccion_tipo",
  "steps": {
    "step_seleccion_tipo": {
      "screen_template_id": "screen_choice",
      "step_type": "decision",
      "props": {
        "question": "¿Qué tipo de limpieza quieres hacer hoy?",
        "choices": [
          { "choice_id": "rapida", "label": "Limpieza Rápida", "estimated_minutes": 5 },
          { "choice_id": "basica", "label": "Limpieza Básica", "estimated_minutes": 15 },
          { "choice_id": "profunda", "label": "Limpieza Profunda", "estimated_minutes": 30 },
          { "choice_id": "maestro", "label": "Limpieza Maestro", "estimated_minutes": 60 }
        ]
      },
      "capture": {
        "tipo_limpieza": "choice_id"
      }
    },
    "step_preparacion_seleccion": {
      "screen_template_id": "screen_toggle_resources",
      "step_type": "selection",
      "props": {
        "title": "Selecciona tus preparaciones",
        "selection_source": "preparacion"
      }
    }
  },
  "edges": [
    {
      "from_step_id": "step_seleccion_tipo",
      "to_step_id": "step_preparacion_seleccion",
      "condition": { "type": "always" }
    }
  ]
}
```

### Campos Obligatorios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | Slug técnico único |
| `entry_step_id` | string | ID del primer step |
| `steps` | object | Mapa de step_id → step_definition |
| `edges` | array | Lista de transiciones entre steps |

### Campos Opcionales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre legible |
| `description` | string | Descripción |
| `metadata` | object | Metadatos adicionales |

---

## 🖥️ Screen Templates Disponibles

Desde `src/core/registry/screen-template-registry.js`:

| Template ID | Nombre | publish_required |
|-------------|--------|------------------|
| `screen_text` | Texto | `body` |
| `screen_intro_centered` | Intro Centrada | `title`, `subtitle` |
| `screen_choice_cards` | Tarjetas de Elección | `title`, `choices` |
| `screen_choice` | Elecciones | `question`, `choices` |
| `screen_scale_1_5` | Escala 1-5 | `title`, `question` |
| `screen_input_short` | Input Corto | `title`, `placeholder` |
| `screen_practice_timer` | Timer de Práctica | `title`, `duration_seconds` |
| `screen_toggle_resources` | Toggle Recursos | `title`, `resources` |
| `screen_outro_summary` | Resumen Final | `title` |
| `screen_audio` | Audio | `audio_source`, `audio_ref` |
| `screen_video` | Vídeo | `video_source`, `video_ref` |
| `screen_media_embed` | Media Embed (beta) | `title`, `media_url`, `media_type` |

### Regla publish_required

Los campos listados en `publish_required` son:
- **Opcionales en DRAFT**: Puedes guardar sin ellos
- **Obligatorios en PUBLISH**: No puedes publicar sin ellos

---

## ✅ Reglas de Validación

### Validación de Estructura (`validateStructure`)

```javascript
// Errores si:
- definition no es objeto
- falta id o no es string
- falta entry_step_id o no es string
- falta steps o no es objeto
- steps está vacío
- falta edges o no es array
```

### Validación de Steps (`validateStep`)

```javascript
// Por cada step:
- screen_template_id debe existir en registry
- props debe validar contra props_schema del template
- En PUBLISH: campos publish_required deben estar completos
- Si tiene step_type, validar contra step-types.js (warning, no error)
- Si tiene resource_id, validar contra pde-resource-registry
- Si tiene emit[], validar event_types contra event-registry
```

### Validación de Edges (`validateEdge`)

```javascript
// Por cada edge:
- from_step_id debe existir en steps
- to_step_id debe existir en steps
- condition.type debe existir en condition-registry
- condition.params debe validar contra params_schema
```

### Validación específica screen_choice (PUBLISH)

```javascript
// Para screen_choice:
- choices debe tener al menos 1 opción
- Cada choice.choice_id debe ser slug válido (/^[a-z][a-z0-9_]*$/)
- choice_id no puede repetirse
- Cada choice.label es obligatorio
```

---

## 🔌 API Endpoints Admin

Base: `/admin/api/recorridos`

### GET /admin/api/recorridos
Lista todos los recorridos.

**Response:**
```json
{
  "recorridos": [
    {
      "id": "limpieza-diaria",
      "name": "Limpieza Diaria",
      "status": "published",
      "current_published_version": 2,
      "updated_at": "2025-12-17T10:00:00Z"
    }
  ]
}
```

### POST /admin/api/recorridos
Crea recorrido + draft inicial.

**Request:**
```json
{
  "id": "nuevo-recorrido",
  "name": "Nuevo Recorrido"
}
```

**Validación:** `id` debe ser slug técnico válido.

### GET /admin/api/recorridos/:id
Obtiene meta + draft actual + versión publicada.

### PUT /admin/api/recorridos/:id/draft
Actualiza el draft.

**Request:**
```json
{
  "definition_json": { ... }
}
```

**Validación:** Se valida con `validateDefinitionForDraft()` ANTES de guardar.

### POST /admin/api/recorridos/:id/validate
Valida el draft actual (sin guardar).

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": ["Step 'step1': no tiene step_type definido"]
}
```

### POST /admin/api/recorridos/:id/publish
Publica una nueva versión desde el draft.

**Request (opcional):**
```json
{
  "release_notes": "Versión inicial"
}
```

**Validación:** Se valida con `isPublish: true` (bloquea si hay errores).

### POST /admin/api/recorridos/:id/status
Cambia el status global.

**Request:**
```json
{
  "status": "deprecated"
}
```

### GET /admin/api/recorridos/:id/export
Exporta bundle JSON completo.

### POST /admin/api/recorridos/import
Importa bundle JSON.

---

## 🔄 Flujo de Trabajo Típico

```
1. CREAR RECORRIDO
   POST /admin/api/recorridos { id, name }
   → Crea recorrido (status='draft')
   → Crea draft inicial con definition mínima
   → Audit log: action='create_recorrido'

2. EDITAR DRAFT
   PUT /admin/api/recorridos/:id/draft { definition_json }
   → Valida estructura básica
   → Normaliza definición
   → Guarda draft
   → Audit log: action='update_draft'

3. VALIDAR DRAFT
   POST /admin/api/recorridos/:id/validate
   → Valida con isPublish=false
   → Retorna errors + warnings
   → Audit log: action='validate_draft'

4. PUBLICAR VERSIÓN
   POST /admin/api/recorridos/:id/publish { release_notes }
   → Valida con isPublish=true (bloquea si invalid)
   → Calcula next_version
   → INSERT en recorrido_versions (INMUTABLE)
   → UPDATE recorridos.current_published_version
   → UPDATE recorridos.status='published'
   → Audit log: action='publish_version'
```

---

## 🎮 UI Admin

### Listado (`/admin/recorridos`)

- Tabla con: ID, Nombre, Estado, Versión Publicada, Actualizado, Acciones
- Acciones: Editar, Duplicar, Exportar
- Botón "Nuevo recorrido"

### Editor (`/admin/recorridos/:id/edit`)

El editor es un archivo HTML de ~3600 líneas que incluye:

1. **Panel Lateral Izquierdo**: Lista de steps (drag & drop para reordenar)
2. **Panel Central**: Editor del step seleccionado
   - Props según screen_template_id
   - Capture declarativo
   - Emit de eventos
3. **Panel Lateral Derecho**: Vista de flujo (árbol de edges)
4. **Toolbar Superior**: 
   - Guardar (actualiza draft)
   - Validar
   - Publicar
   - Exportar

### Preview (Propuesto)

Actualmente NO existe preview. Para implementarlo:

1. Crear endpoint `/admin/api/recorridos/:id/preview-step?step_id=xxx`
2. Usar `buildRenderSpec()` del runtime
3. Renderizar en iframe o modal
4. Sin tocar datos de PROD (solo lectura)

---

## 🔧 Handlers Específicos

### selection_handler_v1

**Archivo:** `src/core/recorridos/step-handlers/selection-handler.js`

**Steps que maneja:**
- `preparacion_seleccion` → source: `preparacion`
- `protecciones_energeticas` → source: `protecciones`
- `post_limpieza_seleccion` → source: `post_limpieza`

**Responsabilidades:**
- Carga items desde catálogos PDE
- Filtra por nivel del alumno
- Enriquece renderSpec con `selection_items`
- Captura `selected_items[]` en state

**Input:** `{ selected_items: ["id_1", "id_2", ...] }`

### practice_timer_handler_v1

**Archivo:** `src/core/recorridos/step-handlers/practice-timer-handler.js`

**Steps que maneja:**
- `preparacion_practica`
- `post_limpieza_practica`

**Responsabilidades:**
- Lee items seleccionados del state anterior
- Suma `declared_duration_minutes`
- Enriquece renderSpec con `duration_seconds` y `practices[]`

**Input:** `{ practice_completed: true, duration_real_minutes: 5.5 }`

### limpieza_energetica_handler

**Archivo:** `src/core/recorridos/step-handlers/limpieza-energetica-handler.js`

**Steps que maneja:**
- `limpieza_energetica` (único punto de racha)

**Responsabilidades:**
- Resuelve bundle de transmutaciones según modo
- Enriquece renderSpec con `transmutation_bundle`
- **EJECUTA `checkDailyStreak()`** si limpieza_completada=true

**Input:** 
```json
{
  "limpieza_completada": true,
  "transmutations_done": ["trans_1", "trans_2"],
  "mode_id": "basica"
}
```

---

## 📦 Export/Import

### Estructura del Bundle

```json
{
  "recorrido": {
    "id": "limpieza-diaria",
    "name": "Limpieza Diaria",
    "status": "published",
    "current_published_version": 2
  },
  "draft": {
    "draft_id": "uuid...",
    "definition_json": { ... }
  },
  "published_versions": [
    {
      "version": 2,
      "status": "published",
      "definition_json": { ... },
      "release_notes": "...",
      "created_at": "..."
    }
  ],
  "exported_at": "2025-12-17T10:00:00Z"
}
```

### Import Strategy: "Safe"

- Si el recorrido NO existe: crea nuevo + draft
- Si el recorrido YA existe: crea NUEVO draft (no toca published)

---

## 🔍 Condiciones (Edges)

Desde `src/core/registry/condition-registry.js`:

| Condition Type | Params | Descripción |
|----------------|--------|-------------|
| `always` | ninguno | Siempre true |
| `field_exists` | `{ field: "campo" }` | True si el campo existe en state |
| `field_equals` | `{ field: "campo", value: "valor" }` | True si campo == valor |

### Ejemplo de Branching

```json
{
  "edges": [
    {
      "from_step_id": "step_eleccion",
      "to_step_id": "step_rama_a",
      "condition": {
        "type": "field_equals",
        "params": { "field": "tipo_limpieza", "value": "rapida" }
      }
    },
    {
      "from_step_id": "step_eleccion",
      "to_step_id": "step_rama_b",
      "condition": { "type": "always" }
    }
  ]
}
```

**Regla:** Los edges se evalúan en orden de definición. El primero que matchea gana.

---

## 🎪 Eventos de Dominio

Desde `src/core/registry/event-registry.js`:

| Event Type | Descripción |
|------------|-------------|
| `recorrido_started` | Alumno inicia un recorrido |
| `step_viewed` | Alumno ve un step |
| `step_completed` | Alumno completa un step |
| `recorrido_completed` | Alumno completa el recorrido |
| `recorrido_abandoned` | Alumno abandona el recorrido |
| `practice_completed` | Práctica completada |

### Declaración en Steps

```json
{
  "step_practica": {
    "emit": [
      {
        "event_type": "practice_completed",
        "payload_template": {
          "recorrido_id": "{{recorrido_id}}",
          "step_id": "{{step_id}}",
          "user_id": "{{user_id}}",
          "duration_seconds": 300
        }
      }
    ]
  }
}
```

**Variables disponibles:** `{{user_id}}`, `{{run_id}}`, `{{step_id}}`, `{{recorrido_id}}`, `{{state.xxx}}`

---

## 🔒 Checklist para Clonar a Editor de Navegación

Para crear el Editor de Navegación basándose en este sistema:

1. **Tablas:** Crear `navigations`, `navigation_drafts`, `navigation_versions`, `navigation_audit_log`
2. **Repos:** Crear contratos en `src/core/repos/navigation-*-repo.js` e implementaciones en `src/infra/repos/`
3. **Validador:** Crear `validate-navigation-definition.js` con reglas específicas de navegación
4. **Registry:** Crear registry de tipos de nodo de navegación
5. **API:** Crear endpoints en `/admin/api/navigations`
6. **UI:** Clonar HTML del editor adaptando campos

---

## 📚 Referencias

- **Migración SQL:** `database/migrations/v5.1.0-create-recorridos-versioning.sql`
- **Migración Runtime:** `database/migrations/v5.2.0-create-recorrido-runtime.sql`
- **Validador:** `src/core/recorridos/validate-recorrido-definition.js`
- **Runtime:** `src/core/recorridos/runtime/recorrido-runtime.js`
- **API:** `src/endpoints/admin-recorridos-api.js`
- **Registry Templates:** `src/core/registry/screen-template-registry.js`

---

**Documento generado:** 2025-12-17  
**Autor:** Sistema AuriPortal







