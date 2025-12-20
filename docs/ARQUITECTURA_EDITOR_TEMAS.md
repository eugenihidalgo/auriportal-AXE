# 🎨 Arquitectura del Editor de Temas - AuriPortal

**Versión:** 1.0  
**Fecha:** 2025-01-XX  
**Autor:** Arquitecto de Sistemas Senior  
**Estado:** Diseño Conceptual (No Implementado)

---

## 📋 Resumen Ejecutivo

Este documento define la arquitectura completa del **Editor de Temas del AuriPortal**, un sistema robusto para gestionar conjuntos de valores del Theme Contract v1 sin modificar el runtime cliente ni el CSS real.

### Objetivos Principales

1. **Gestionar múltiples temas visuales** (no solo dark/light)
2. **Versionar y auditar** todos los cambios de tema
3. **Asignar temas** por estudiante, estado, fase, nivel o práctica
4. **Automatizar cambios** de tema mediante reglas
5. **Garantizar reversibilidad** y fail-open en caso de errores

### Principios Fundamentales

- ✅ **Theme Contract es canónico**: Solo se pueden asignar valores a variables existentes
- ✅ **Separación total**: Definición → Resolución → Aplicación (este diseño solo cubre definición y gestión)
- ✅ **Auditable y versionable**: Todo cambio queda registrado
- ✅ **Preparado para crecimiento**: Arquitectura extensible sin rediseñar

---

## 1. Modelo de Datos de Tema

### 1.1 Esquema Lógico

Un **Theme Definition** es un conjunto de valores asignados a las variables del Theme Contract v1.

#### Estructura JSON de Ejemplo

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "dark-classic",
  "name": "Oscuro Clásico",
  "description": "Tema oscuro estándar con colores tradicionales",
  "scope": "client",
  "status": "active",
  "version": 3,
  "parent_theme_id": null,
  "variables": {
    "--bg-main": "#0a0e1a",
    "--bg-primary": "#0a0e1a",
    "--bg-panel": "#1a1f2e",
    "--bg-card": "#252b3a",
    "--bg-card-active": "#2d3444",
    "--bg-secondary": "#1a1f2e",
    "--bg-elevated": "#2d3444",
    "--bg-section": "#1a1f2e",
    "--bg-warning": "#3d2a1a",
    "--bg-error": "#2a1a1a",
    "--bg-success": "#1a2a1a",
    "--bg-info": "#1a1f2e",
    "--bg-muted": "#0f1419",
    "--text-primary": "#f1f5f9",
    "--text-secondary": "#cbd5e1",
    "--text-muted": "#94a3b8",
    "--text-accent": "#ffd86b",
    "--text-streak": "#ffd86b",
    "--text-danger": "#ef4444",
    "--text-success": "#22c55e",
    "--text-warning": "#f59e0b",
    "--border-soft": "#1a1f2e",
    "--border-strong": "#2d3444",
    "--border-color": "#1a1f2e",
    "--border-accent": "#ffd86b",
    "--border-focus": "#ffd86b",
    "--border-subtle": "#0f1419",
    "--accent-primary": "#ffd86b",
    "--accent-secondary": "#fbbf24",
    "--accent-hover": "#fcd34d",
    "--accent-warning": "#f59e0b",
    "--accent-error": "#ef4444",
    "--accent-success": "#22c55e",
    "--accent-danger": "#ef4444",
    "--shadow-sm": "0 2px 4px rgba(0, 0, 0, 0.3)",
    "--shadow-md": "0 4px 8px rgba(0, 0, 0, 0.4)",
    "--shadow-lg": "0 8px 16px rgba(0, 0, 0, 0.5)",
    "--shadow-xl": "0 16px 32px rgba(0, 0, 0, 0.6)",
    "--shadow-soft": "0 2px 8px rgba(0, 0, 0, 0.2)",
    "--gradient-primary": "linear-gradient(135deg, #ffd86b 0%, #fbbf24 100%)",
    "--gradient-hover": "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)",
    "--gradient-header": "linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 100%)",
    "--header-bg": "linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 100%)",
    "--aura-gradient": "radial-gradient(circle, rgba(255, 216, 107, 0.3) 0%, rgba(255, 216, 107, 0) 70%)",
    "--gradient-accordion": "linear-gradient(135deg, #1a1f2e 0%, #252b3a 100%)",
    "--gradient-accordion-hover": "linear-gradient(135deg, #252b3a 0%, #2d3444 100%)",
    "--gradient-success": "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    "--gradient-error": "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    "--badge-bg-active": "#ffd86b",
    "--badge-text-active": "#0a0e1a",
    "--badge-bg-pending": "#3d2a1a",
    "--badge-text-pending": "#f59e0b",
    "--badge-bg-obligatory": "#2a1a1a",
    "--badge-text-obligatory": "#ef4444",
    "--input-bg": "#1a1f2e",
    "--input-border": "#2d3444",
    "--input-text": "#f1f5f9",
    "--input-focus-border": "#ffd86b",
    "--button-text-color": "#0a0e1a",
    "--radius-sm": "12px",
    "--radius-md": "16px",
    "--radius-lg": "20px",
    "--radius-xl": "24px",
    "--radius-full": "9999px"
  },
  "metadata": {
    "created_by": "admin@auriportal.com",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_by": "admin@auriportal.com",
    "updated_at": "2025-01-20T14:22:00Z",
    "tags": ["dark", "classic", "default"],
    "preview_image_url": null,
    "notes": "Tema base oscuro usado por defecto"
  },
  "validation": {
    "contract_version": "1.0",
    "variables_count": 67,
    "missing_variables": [],
    "invalid_variables": [],
    "last_validated_at": "2025-01-20T14:22:00Z"
  }
}
```

### 1.2 Propuesta de Tablas PostgreSQL

#### Tabla: `theme_definitions`

Almacena las definiciones de temas (versiones actuales).

```sql
CREATE TABLE IF NOT EXISTS theme_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL, -- Identificador único (ej: 'dark-classic', 'light-warm')
    name TEXT NOT NULL, -- Nombre legible
    description TEXT, -- Descripción opcional
    scope TEXT NOT NULL DEFAULT 'client', -- 'client' | 'admin' | 'future'
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'archived'
    version INTEGER NOT NULL DEFAULT 1, -- Versión actual del tema
    parent_theme_id UUID REFERENCES theme_definitions(id), -- Tema del que se duplicó (nullable)
    variables JSONB NOT NULL DEFAULT '{}'::jsonb, -- Mapa de variable → valor
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Metadatos adicionales
    validation JSONB NOT NULL DEFAULT '{}'::jsonb, -- Resultado de validación
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT, -- Email o ID del creador
    updated_by TEXT -- Email o ID del último editor
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_theme_definitions_key ON theme_definitions(key);
CREATE INDEX IF NOT EXISTS idx_theme_definitions_status ON theme_definitions(status);
CREATE INDEX IF NOT EXISTS idx_theme_definitions_scope ON theme_definitions(scope);
CREATE INDEX IF NOT EXISTS idx_theme_definitions_status_scope ON theme_definitions(status, scope) WHERE status = 'active';
```

#### Tabla: `theme_versions`

Almacena el historial completo de versiones de cada tema.

```sql
CREATE TABLE IF NOT EXISTS theme_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID NOT NULL REFERENCES theme_definitions(id) ON DELETE CASCADE,
    version INTEGER NOT NULL, -- Número de versión
    variables JSONB NOT NULL DEFAULT '{}'::jsonb, -- Snapshot de variables en esta versión
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Snapshot de metadata
    validation JSONB NOT NULL DEFAULT '{}'::jsonb, -- Snapshot de validación
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT, -- Email o ID del creador
    change_summary TEXT, -- Resumen del cambio (opcional)
    UNIQUE(theme_id, version)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_theme_versions_theme_id ON theme_versions(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_versions_theme_version ON theme_versions(theme_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_theme_versions_created_at ON theme_versions(created_at DESC);
```

#### Tabla: `theme_assignments`

Almacena las asignaciones activas de temas (quién/qué tiene qué tema).

```sql
CREATE TABLE IF NOT EXISTS theme_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID NOT NULL REFERENCES theme_definitions(id) ON DELETE RESTRICT,
    assignment_type TEXT NOT NULL, -- 'default' | 'student' | 'level' | 'phase' | 'practice' | 'mode' | 'temporary'
    target_id TEXT, -- ID del target (alumno_id, level_id, etc.) - nullable para 'default'
    target_value TEXT, -- Valor del target (ej: 'nivel_5', 'fase_sanacion') - nullable
    priority INTEGER NOT NULL DEFAULT 0, -- Prioridad de resolución (mayor = primero)
    starts_at TIMESTAMPTZ, -- Cuándo empieza (nullable = inmediato)
    ends_at TIMESTAMPTZ, -- Cuándo termina (nullable = indefinido)
    active BOOLEAN NOT NULL DEFAULT TRUE, -- Si está activo actualmente
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Metadatos adicionales
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT, -- Email o ID del creador
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_theme_assignments_theme_id ON theme_assignments(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_assignments_type ON theme_assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_theme_assignments_target_id ON theme_assignments(target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_theme_assignments_active ON theme_assignments(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_theme_assignments_priority ON theme_theme_assignments(priority DESC);
CREATE INDEX IF NOT EXISTS idx_theme_assignments_type_target ON theme_assignments(assignment_type, target_id, active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_theme_assignments_ends_at ON theme_assignments(ends_at) WHERE ends_at IS NOT NULL;
```

### 1.3 Campos Clave Explicados

#### `scope`
- **`client`**: Tema para el cliente (pantallas de práctica)
- **`admin`**: Tema para el panel de administración (futuro)
- **`future`**: Reservado para futuros usos

#### `status`
- **`draft`**: En edición, no se puede usar aún
- **`active`**: Disponible para asignación
- **`archived`**: Archivado, no se puede usar pero se mantiene para historial

#### `assignment_type`
- **`default`**: Tema por defecto del sistema (solo uno activo)
- **`student`**: Tema específico para un estudiante (`target_id` = `alumno_id`)
- **`level`**: Tema para un nivel específico (`target_value` = `nivel_5`)
- **`phase`**: Tema para una fase (ej: `fase_sanacion`, `fase_canalizacion`)
- **`practice`**: Tema durante una práctica específica (`target_id` = `practice_id`)
- **`mode`**: Tema para un modo temporal (`target_value` = `mode_key` de `student_modes`)
- **`temporary`**: Tema temporal con fecha de fin (`starts_at` / `ends_at`)

---

## 2. Versionado y Auditoría

### 2.1 Estrategia de Versionado

#### Creación de Nueva Versión

Cada vez que se modifica un tema:

1. **Validar** que todas las variables existen en el Theme Contract
2. **Crear snapshot** en `theme_versions` con la versión anterior
3. **Incrementar** `version` en `theme_definitions`
4. **Actualizar** `variables`, `metadata`, `validation` en `theme_definitions`
5. **Registrar** evento en `audit_events`

#### Duplicación de Tema

Al duplicar un tema:

1. **Crear** nuevo `theme_definition` con `parent_theme_id` apuntando al original
2. **Copiar** todas las variables del tema padre
3. **Inicializar** `version = 1`
4. **Registrar** evento en `audit_events`

#### Rollback

Para hacer rollback a una versión anterior:

1. **Validar** que la versión objetivo existe en `theme_versions`
2. **Crear snapshot** de la versión actual en `theme_versions` (si no existe)
3. **Restaurar** variables, metadata y validation de la versión objetivo
4. **Incrementar** `version` en `theme_definitions` (nueva versión con valores antiguos)
5. **Registrar** evento en `audit_events`

### 2.2 Integración con `audit_events`

Todos los cambios de tema se registran en `audit_events`:

```json
{
  "actor_type": "admin",
  "actor_id": "admin@auriportal.com",
  "alumno_id": null,
  "action": "theme_update",
  "entity_type": "theme",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "theme_key": "dark-classic",
    "version_before": 2,
    "version_after": 3,
    "changed_variables": ["--bg-main", "--text-primary"],
    "change_type": "update"
  }
}
```

**Acciones registradas:**
- `theme_create`: Creación de nuevo tema
- `theme_update`: Actualización de tema existente
- `theme_duplicate`: Duplicación de tema
- `theme_archive`: Archivado de tema
- `theme_restore`: Restauración de tema archivado
- `theme_rollback`: Rollback a versión anterior
- `theme_assign`: Asignación de tema
- `theme_unassign`: Desasignación de tema
- `theme_validate`: Validación de tema

### 2.3 Historial de Activación

Para saber qué tema estuvo activo cuándo:

1. **Consultar** `theme_assignments` con `active = TRUE` y fechas
2. **Consultar** `audit_events` con `action = 'theme_assign'` o `'theme_unassign'`
3. **Reconstruir** timeline combinando ambas fuentes

**Ejemplo de consulta:**

```sql
-- Tema activo para un estudiante en un momento dado
SELECT ta.*, td.name, td.key
FROM theme_assignments ta
JOIN theme_definitions td ON ta.theme_id = td.id
WHERE ta.assignment_type = 'student'
  AND ta.target_id = '123'
  AND ta.active = TRUE
  AND (ta.starts_at IS NULL OR ta.starts_at <= NOW())
  AND (ta.ends_at IS NULL OR ta.ends_at >= NOW())
ORDER BY ta.priority DESC
LIMIT 1;
```

---

## 3. Activación y Resolución de Temas

### 3.1 Concepto de Theme Assignment

Un **Theme Assignment** es una regla que asigna un tema a un contexto específico. El sistema de resolución evalúa todas las asignaciones activas y selecciona la de mayor prioridad.

### 3.2 Reglas de Precedencia

El sistema resuelve el tema en este orden (de mayor a menor prioridad):

1. **Tema temporal** (`assignment_type = 'temporary'` con `starts_at` / `ends_at`)
2. **Tema por práctica** (`assignment_type = 'practice'`)
3. **Tema por modo** (`assignment_type = 'mode'` vinculado a `student_modes`)
4. **Tema por estudiante** (`assignment_type = 'student'`)
5. **Tema por nivel** (`assignment_type = 'level'`)
6. **Tema por fase** (`assignment_type = 'phase'`)
7. **Tema por defecto** (`assignment_type = 'default'`)

**Dentro de cada tipo**, se usa el campo `priority` (mayor = primero).

### 3.3 Diagrama Lógico de Resolución

```
┌─────────────────────────────────────────────────────────────┐
│  RESOLUCIÓN DE TEMA PARA UN ESTUDIANTE                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Contexto del Estudiante          │
        │  - alumno_id                      │
        │  - nivel actual                   │
        │  - fase actual                    │
        │  - práctica actual (si existe)    │
        │  - modos activos (student_modes)   │
        │  - fecha/hora actual             │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Consultar theme_assignments      │
        │  WHERE active = TRUE              │
        │  AND (starts_at IS NULL OR        │
        │       starts_at <= NOW())         │
        │  AND (ends_at IS NULL OR          │
        │       ends_at >= NOW())           │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Filtrar por tipo y target        │
        │  - temporary (si aplica)           │
        │  - practice (si aplica)            │
        │  - mode (si aplica)               │
        │  - student (si aplica)            │
        │  - level (si aplica)              │
        │  - phase (si aplica)              │
        │  - default (siempre disponible)   │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Ordenar por precedencia y         │
        │  priority DESC                     │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Seleccionar el primero            │
        │  (mayor prioridad)                 │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Obtener theme_definition         │
        │  con variables                    │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Retornar tema resuelto            │
        └───────────────────────────────────┘
```

### 3.4 Ejemplos de Precedencia

#### Ejemplo 1: Estudiante con tema personalizado

```
Asignaciones activas:
1. default → 'dark-classic' (priority: 0)
2. student (alumno_id: 123) → 'light-warm' (priority: 10)

Resultado: 'light-warm' (mayor prioridad)
```

#### Ejemplo 2: Estudiante en práctica con tema temporal

```
Asignaciones activas:
1. default → 'dark-classic' (priority: 0)
2. student (alumno_id: 123) → 'light-warm' (priority: 10)
3. practice (practice_id: 456) → 'dark-deep' (priority: 20)
4. temporary (ends_at: 2025-01-25) → 'navidad-theme' (priority: 30)

Resultado: 'navidad-theme' (temporal tiene mayor precedencia)
```

#### Ejemplo 3: Estudiante con modo activo

```
Asignaciones activas:
1. default → 'dark-classic' (priority: 0)
2. mode (mode_key: 'navidad') → 'navidad-theme' (priority: 15)
3. level (target_value: 'nivel_5') → 'nivel-5-theme' (priority: 5)

Resultado: 'navidad-theme' (modo tiene mayor precedencia que nivel)
```

### 3.5 Conflictos y Resolución

#### Conflicto: Múltiples asignaciones del mismo tipo

**Solución**: Usar `priority` (mayor = primero). Si hay empate, usar `created_at` (más reciente = primero).

#### Conflicto: Tema no existe o está archivado

**Solución**: Fall-open al siguiente en la cadena de precedencia. Si no hay ningún tema válido, usar tema hardcodeado de emergencia.

#### Conflicto: Variables faltantes en tema resuelto

**Solución**: Merge con tema por defecto. Variables faltantes se toman del tema por defecto.

---

## 4. Integración con Automatizaciones

### 4.1 Eventos de Automatización

El sistema de temas se integra con el motor de automatizaciones (AUTO-1) mediante eventos y acciones.

#### Eventos que Pueden Disparar Cambios de Tema

1. **Eventos de `audit_events`**:
   - `practice_start`: Inicio de práctica
   - `practice_end`: Fin de práctica
   - `level_up`: Subida de nivel
   - `mode_activate`: Activación de modo (ej: navidad)
   - `mode_deactivate`: Desactivación de modo

2. **Eventos de estado**:
   - `friction_high`: Fricción alta detectada
   - `streak_milestone`: Alcanzó hito de racha (25, 50, 100 días)
   - `phase_change`: Cambio de fase (sanación → canalización)

### 4.2 Acción: `theme_set`

Nueva acción para el motor de automatizaciones:

```json
{
  "step_key": "theme_set",
  "payload": {
    "theme_key": "dark-deep",
    "assignment_type": "temporary",
    "target_id": null,
    "target_value": null,
    "priority": 20,
    "ends_at": "2025-01-25T23:59:59Z",
    "metadata": {
      "reason": "Práctica profunda detectada",
      "source": "automation"
    }
  }
}
```

**Parámetros:**
- `theme_key`: Clave del tema a asignar (requerido)
- `assignment_type`: Tipo de asignación (requerido)
- `target_id`: ID del target (opcional, según tipo)
- `target_value`: Valor del target (opcional, según tipo)
- `priority`: Prioridad de la asignación (opcional, default: 0)
- `starts_at`: Cuándo empieza (opcional, default: ahora)
- `ends_at`: Cuándo termina (opcional, default: indefinido)
- `metadata`: Metadatos adicionales (opcional)

### 4.3 Acción: `theme_unset`

Acción para desasignar un tema:

```json
{
  "step_key": "theme_unset",
  "payload": {
    "assignment_type": "temporary",
    "target_id": null,
    "target_value": null,
    "metadata": {
      "reason": "Fin de práctica profunda",
      "source": "automation"
    }
  }
}
```

**Parámetros:**
- `assignment_type`: Tipo de asignación a desactivar (requerido)
- `target_id`: ID del target (opcional, según tipo)
- `target_value`: Valor del target (opcional, según tipo)
- `metadata`: Metadatos adicionales (opcional)

### 4.4 Ejemplos de Reglas de Automatización

#### Regla 1: Tema oscuro durante práctica profunda

```json
{
  "key": "theme_deep_practice",
  "status": "on",
  "trigger_type": "event",
  "trigger_def": {
    "event": "practice_start",
    "conditions": {
      "practice_type": "deep"
    }
  },
  "guards": [],
  "actions": [
    {
      "step_key": "theme_set",
      "payload": {
        "theme_key": "dark-deep",
        "assignment_type": "practice",
        "target_id": "{{practice_id}}",
        "priority": 20,
        "ends_at": "{{practice_end_time}}",
        "metadata": {
          "reason": "Práctica profunda",
          "source": "automation"
        }
      }
    }
  ],
  "priority": 10
}
```

#### Regla 2: Tema navideño durante modo navidad

```json
{
  "key": "theme_navidad_mode",
  "status": "on",
  "trigger_type": "event",
  "trigger_def": {
    "event": "mode_activate",
    "conditions": {
      "mode_key": "navidad"
    }
  },
  "guards": [],
  "actions": [
    {
      "step_key": "theme_set",
      "payload": {
        "theme_key": "navidad-theme",
        "assignment_type": "mode",
        "target_value": "navidad",
        "priority": 15,
        "metadata": {
          "reason": "Modo navidad activado",
          "source": "automation"
        }
      }
    }
  ],
  "priority": 10
}
```

#### Regla 3: Tema calmado si fricción alta

```json
{
  "key": "theme_calm_high_friction",
  "status": "beta",
  "trigger_type": "state",
  "trigger_def": {
    "state_check": "friction_level",
    "operator": ">=",
    "value": 0.7
  },
  "guards": [
    {
      "type": "cooldown",
      "days": 1
    }
  ],
  "actions": [
    {
      "step_key": "theme_set",
      "payload": {
        "theme_key": "calm-theme",
        "assignment_type": "temporary",
        "priority": 25,
        "ends_at": "{{now_plus_24h}}",
        "metadata": {
          "reason": "Fricción alta detectada",
          "source": "automation"
        }
      }
    }
  ],
  "priority": 10,
  "cooldown_days": 1
}
```

### 4.5 Relación con AUTO-1 y AUTO-2

- **AUTO-1 (Motor de Automatizaciones)**: Ejecuta las reglas que contienen acciones `theme_set` / `theme_unset`
- **AUTO-2 (Futuro)**: Puede usar temas como parte de experiencias más complejas (flujos, secuencias, etc.)

---

## 5. UX Conceptual del Editor de Temas (Admin)

### 5.1 Pantallas Necesarias

#### Pantalla 1: Lista de Temas

**Ruta**: `/admin/themes`

**Contenido:**
- Tabla/grid de todos los temas
- Filtros: status, scope, tags
- Búsqueda por nombre/key
- Acciones: crear, editar, duplicar, archivar, previsualizar

**Información mostrada:**
- Key, nombre, descripción
- Status (draft/active/archived)
- Scope (client/admin/future)
- Versión actual
- Última actualización
- Número de asignaciones activas

#### Pantalla 2: Editor de Tema

**Ruta**: `/admin/themes/:key/edit`

**Contenido:**
- Formulario de metadatos (nombre, descripción, tags)
- Editor de variables (grupos por semántica):
  - Fondos (--bg-*)
  - Textos (--text-*)
  - Bordes (--border-*)
  - Acentos (--accent-*)
  - Sombras (--shadow-*)
  - Gradientes (--gradient-*)
  - Radios (--radius-*)
  - Badges (--badge-*)
  - Inputs (--input-*)
  - Botones (--button-*)
- Validación en tiempo real
- Previsualización en iframe
- Historial de versiones
- Botones: guardar, guardar como nueva versión, duplicar, cancelar

#### Pantalla 3: Asignaciones de Tema

**Ruta**: `/admin/themes/:key/assignments`

**Contenido:**
- Lista de asignaciones activas del tema
- Crear nueva asignación
- Editar/eliminar asignaciones existentes
- Ver conflictos de precedencia

#### Pantalla 4: Historial de Versiones

**Ruta**: `/admin/themes/:key/versions`

**Contenido:**
- Timeline de versiones
- Comparación entre versiones
- Rollback a versión anterior
- Ver cambios (diff de variables)

#### Pantalla 5: Previsualización

**Ruta**: `/admin/themes/:key/preview`

**Contenido:**
- Iframe con tema aplicado
- Selector de pantalla de ejemplo (pantalla1, pantalla2, pantalla3, pantalla4)
- Toggle modo oscuro/claro (si aplica)

### 5.2 Flujo Típico: Crear Tema

```
1. Admin va a /admin/themes
2. Clic en "Crear nuevo tema"
3. Completa metadatos básicos:
   - Key (único)
   - Nombre
   - Descripción
   - Scope (client/admin/future)
4. Editor de variables:
   - Puede empezar desde tema existente (duplicar)
   - O empezar desde cero (todas las variables vacías)
5. Asigna valores a variables (validación en tiempo real)
6. Previsualiza en iframe
7. Guarda como draft
8. Valida tema completo
9. Cambia status a "active"
10. Opcionalmente crea asignación
```

### 5.3 Flujo Típico: Duplicar Tema

```
1. Admin va a /admin/themes
2. Clic en "Duplicar" en un tema existente
3. Sistema crea nuevo tema con:
   - Nuevo key (sugerido: original-key-copy)
   - Mismas variables
   - parent_theme_id = tema original
   - status = "draft"
   - version = 1
4. Admin edita variables según necesidad
5. Guarda y activa
```

### 5.4 Flujo Típico: Asignar Tema

```
1. Admin va a /admin/themes/:key/assignments
2. Clic en "Nueva asignación"
3. Selecciona tipo de asignación:
   - Default (solo uno puede estar activo)
   - Student (seleccionar estudiante)
   - Level (seleccionar nivel)
   - Phase (seleccionar fase)
   - Practice (seleccionar práctica)
   - Mode (seleccionar modo)
   - Temporary (definir fechas)
4. Completa campos según tipo
5. Define prioridad (opcional)
6. Define fechas de inicio/fin (opcional)
7. Guarda asignación
8. Sistema valida conflictos y muestra advertencias
```

### 5.5 Flujo Típico: Automatizar Cambio de Tema

```
1. Admin va a /admin/automations (sistema existente)
2. Crea nueva regla de automatización
3. Define trigger (evento o estado)
4. Añade acción "theme_set" o "theme_unset"
5. Configura payload de la acción
6. Activa regla
7. Sistema ejecuta automáticamente cuando se cumple trigger
```

### 5.6 Acciones Disponibles

**Por tema:**
- Crear
- Editar
- Duplicar
- Archivar / Restaurar
- Eliminar (solo si no tiene asignaciones activas)
- Previsualizar
- Validar
- Ver historial
- Rollback

**Por asignación:**
- Crear
- Editar
- Desactivar / Activar
- Eliminar
- Ver conflictos

---

## 6. Guardarraíles y Errores

### 6.1 Errores Posibles

#### Error 1: Variable Faltante en Tema

**Situación**: Un tema no define todas las variables del Theme Contract.

**Mitigación**:
- **Validación previa**: No permitir guardar tema con variables faltantes (modo estricto) o mostrar advertencia (modo permisivo)
- **Runtime**: Merge con tema por defecto. Variables faltantes se toman del tema por defecto.
- **Logging**: Registrar en `audit_events` qué variables se tomaron del tema por defecto

#### Error 2: Valor Inválido de Variable

**Situación**: Un valor no es un color válido, gradiente válido, etc.

**Mitigación**:
- **Validación previa**: Validar formato de valores antes de guardar
  - Colores: hex, rgb, rgba, hsl, hsla, nombres CSS válidos
  - Gradientes: `linear-gradient(...)`, `radial-gradient(...)`
  - Sombras: formato CSS válido
  - Radios: px, em, rem, %, o valores especiales como `9999px`
- **Runtime**: Si valor inválido, usar valor del tema por defecto
- **Logging**: Registrar en `audit_events` qué valores se reemplazaron

#### Error 3: Tema No Existe o Está Archivado

**Situación**: Una asignación apunta a un tema que no existe o está archivado.

**Mitigación**:
- **Validación previa**: No permitir crear asignación a tema archivado
- **Runtime**: Fall-open al siguiente en cadena de precedencia. Si no hay ningún tema válido, usar tema hardcodeado de emergencia (`dark-classic` o `light-classic`)
- **Logging**: Registrar en `audit_events` que se usó fallback

#### Error 4: Tema Sin Asignaciones Válidas

**Situación**: No hay ningún tema asignado para un estudiante (ni default ni específico).

**Mitigación**:
- **Validación previa**: Garantizar que siempre hay un tema `default` activo
- **Runtime**: Usar tema hardcodeado de emergencia
- **Logging**: Registrar en `audit_events` que se usó tema de emergencia

#### Error 5: Conflicto de Precedencia

**Situación**: Múltiples asignaciones del mismo tipo con misma prioridad.

**Mitigación**:
- **Validación previa**: Mostrar advertencia al crear asignación con prioridad duplicada
- **Runtime**: Usar `created_at` (más reciente = primero)
- **Logging**: Registrar en `audit_events` que hubo conflicto resuelto

#### Error 6: Tema Roto por Cambio de Contract

**Situación**: El Theme Contract se actualiza y un tema tiene variables que ya no existen.

**Mitigación**:
- **Validación previa**: Ejecutar validación periódica de todos los temas activos contra el Contract actual
- **Runtime**: Ignorar variables que no existen en el Contract (no rompen el tema)
- **Logging**: Registrar en `audit_events` qué variables se ignoraron

### 6.2 Estrategias de Fail-Open

#### Nivel 1: Merge con Tema por Defecto

Si un tema tiene variables faltantes, se hace merge con el tema por defecto.

#### Nivel 2: Fallback a Tema Hardcodeado

Si no hay ningún tema válido, se usa un tema hardcodeado de emergencia (definido en código, no en BD).

#### Nivel 3: Tema Mínimo

Si incluso el tema hardcodeado falla, se aplica un tema mínimo con solo las variables críticas (fondos y textos básicos).

### 6.3 Validación de Tema

**Validación previa al guardar:**

1. **Variables existentes**: Todas las variables deben existir en el Theme Contract
2. **Valores válidos**: Todos los valores deben tener formato válido
3. **Variables requeridas**: Verificar si hay variables requeridas (opcional, según política)
4. **Contraste**: Validar contraste de texto sobre fondo (opcional, según política)

**Validación en runtime:**

1. **Tema existe**: Verificar que el tema existe y está activo
2. **Variables completas**: Merge con tema por defecto si faltan variables
3. **Valores válidos**: Reemplazar valores inválidos con valores del tema por defecto

### 6.4 Monitoreo y Alertas

**Métricas a monitorear:**

- Número de temas activos
- Número de asignaciones activas
- Frecuencia de fallbacks a tema por defecto
- Frecuencia de uso de tema de emergencia
- Errores de validación en runtime

**Alertas:**

- Si un tema tiene > 10% de variables faltantes
- Si se usa tema de emergencia > 5 veces en 1 hora
- Si un tema no se puede resolver para un estudiante

---

## 7. Próximos Pasos Sugeridos

### Fase 1: Fundación (MVP)

1. **Crear tablas** en PostgreSQL (`theme_definitions`, `theme_versions`, `theme_assignments`)
2. **Implementar validación** de Theme Contract
3. **Crear API básica** para CRUD de temas
4. **Implementar resolución** de temas (sin automatizaciones aún)
5. **Integrar con `applyTheme()`** para usar temas resueltos

### Fase 2: Editor Admin

6. **Crear pantallas** del editor (lista, editor, asignaciones)
7. **Implementar previsualización** en iframe
8. **Implementar versionado** y rollback
9. **Implementar duplicación** de temas

### Fase 3: Automatizaciones

10. **Implementar acciones** `theme_set` y `theme_unset` en motor de automatizaciones
11. **Crear reglas** de ejemplo (práctica profunda, modo navidad, etc.)
12. **Probar integración** con AUTO-1

### Fase 4: Mejoras

13. **Implementar validación** de contraste
14. **Implementar generación** automática de temas (a partir de colores base)
15. **Implementar exportación/importación** de temas (JSON)
16. **Implementar analytics** de uso de temas

### Fase 5: Escalabilidad

17. **Optimizar consultas** de resolución (caché, índices)
18. **Implementar CDN** para temas (si aplica)
19. **Implementar temas** para admin panel (scope: admin)

---

## 8. Consideraciones Técnicas

### 8.1 Performance

**Caché de Resolución:**
- Cachear tema resuelto por estudiante (TTL: 5 minutos)
- Invalidar caché cuando cambia asignación activa

**Índices:**
- Índices en `theme_assignments` para consultas rápidas por tipo, target, active
- Índices en `theme_definitions` para búsquedas por key, status, scope

### 8.2 Seguridad

**Validación de Input:**
- Sanitizar valores de variables (prevenir XSS en CSS)
- Validar formato de colores, gradientes, sombras
- Limitar tamaño de JSONB (variables, metadata)

**Autorización:**
- Solo admins pueden crear/editar temas
- Solo admins pueden crear asignaciones
- Estudiantes no pueden modificar temas (solo el sistema puede asignar)

### 8.3 Compatibilidad

**Theme Contract v1:**
- Este diseño asume Theme Contract v1
- Si el Contract se actualiza a v2, se necesitará migración de temas
- Mantener compatibilidad hacia atrás (temas v1 siguen funcionando)

**Navegadores:**
- Variables CSS son compatibles con navegadores modernos
- Fallback para navegadores antiguos (no crítico, AuriPortal es moderno)

---

## 9. Glosario

- **Theme Contract**: Contrato canónico de variables CSS (`public/css/theme-contract.css`)
- **Theme Definition**: Definición de un tema (conjunto de valores de variables)
- **Theme Assignment**: Asignación de un tema a un contexto (estudiante, nivel, etc.)
- **Theme Resolution**: Proceso de determinar qué tema usar para un estudiante
- **Scope**: Alcance del tema (client/admin/future)
- **Status**: Estado del tema (draft/active/archived)
- **Precedence**: Orden de prioridad en resolución de temas
- **Fail-open**: Estrategia de fallback cuando algo falla (no romper el cliente)

---

## 10. Referencias

- `public/css/theme-contract.css` - Theme Contract v1 canónico
- `docs/THEME_CONTRACT.md` - Documentación del Theme Contract
- `src/core/responses.js` - Función `applyTheme()`
- `database/migrations/v4.9.0-create-automation-engine.sql` - Motor de automatizaciones
- `database/migrations/v4.8.0-create-audit-events.sql` - Sistema de auditoría
- `database/migrations/v4.10.1-create-student-modes.sql` - Sistema de modos

---

**FIN DEL DOCUMENTO**










