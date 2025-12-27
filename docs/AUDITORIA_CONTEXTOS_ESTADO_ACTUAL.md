# AUDITORÍA GLOBAL DE CONTEXTOS — AURIPORTAL
**Estado Actual + Preparación de Robustización**

**Fecha**: 2025-01-XX  
**Objetivo**: Mapear exhaustivamente TODO lo que actúa como "contexto" en AuriPortal, tanto explícito como implícito, técnico como semántico.

---

## ÍNDICE

1. [Contextos Detectados (Explícitos e Implícitos)](#1-contextos-detectados-explícitos-e-implícitos)
2. [Dónde Viven y Cómo Se Usan](#2-dónde-viven-y-cómo-se-usan)
3. [Relación con Source of Truth](#3-relación-con-source-of-truth)
4. [Relación con Paquetes](#4-relación-con-paquetes)
5. [Relación con Automatizaciones](#5-relación-con-automatizaciones)
6. [Relación con Widgets y UI](#6-relación-con-widgets-y-ui)
7. [Relación con Temas](#7-relación-con-temas)
8. [Vacíos Estructurales](#8-vacíos-estructurales)
9. [Deuda Técnica Relacionada con Contextos](#9-deuda-técnica-relacionada-con-contextos)

---

## 1. CONTEXTOS DETECTADOS (EXPLÍCITOS E IMPLÍCITOS)

### 1.1 Contextos Explícitos (Registrados en Base de Datos)

#### 1.1.1 Contextos PDE (`pde_contexts`)

**Tabla**: `pde_contexts` (Migración v5.17.0)  
**Ubicación**: PostgreSQL  
**Estado**: Activo (con extensiones v5.25.0, v5.24.0)

**Estructura**:
- `context_key` (TEXT, UNIQUE): Clave única del contexto (slug)
- `label` (TEXT): Nombre legible
- `definition` (JSONB): Definición canónica con:
  - `type`: "string" | "number" | "boolean" | "enum" | "json"
  - `allowed_values`: Array (solo si type="enum")
  - `default_value`: Valor por defecto
  - `scope`: "global" | "workflow" | "step"
  - `origin`: "system" | "user_choice" | "derived"
- `scope` (ENUM): "system" | "structural" | "personal" | "package"
- `kind` (ENUM): "normal" | "level"
- `injected` (BOOLEAN): Si el runtime lo inyecta automáticamente
- `type` (ENUM): Tipo de dato extraído del JSON
- `allowed_values` (JSONB): Valores permitidos (solo para enum)
- `default_value` (JSONB): Valor por defecto
- `status` (TEXT): "active" | "archived"
- `deleted_at` (TIMESTAMPTZ): Soft delete

**Contextos conocidos**:
- `nivel_pde`: Nivel PDE del alumno (structural, level, injected)
- `temporada`: Temporada actual del sistema (system, normal, injected)
- `tipo_limpieza`: Tipo de limpieza energética (package, normal, no injected)

**Uso**: Variables semánticas para Paquetes PDE y Editor tipo Typeform.

---

#### 1.1.2 StudentContext (`buildStudentContext`)

**Archivo**: `src/core/student-context.js`  
**Tipo**: Contexto construido en runtime  
**Estado**: Activo (contrato único estable)

**Estructura**:
```javascript
{
  student: Object,              // Objeto student "source of truth"
  email: string,                // Email normalizado
  isAuthenticated: boolean,     // Siempre true si ok:true
  estadoSuscripcion: Object,    // Estado de suscripción (pausada, reactivada, etc.)
  puedePracticar: boolean,      // Si puede practicar hoy
  streakInfo: Object,           // Información de racha normalizada
  nivelInfo: Object,            // Información de nivel/fase calculada
  nivelInfoUX: Object,          // Capa UX derivada
  frase: string,                // Frase motivacional elegida
  todayPracticed: boolean,      // Si ya practicó hoy
  bloqueHito: string,           // Mensaje de hito si aplica
  signals: Object,              // Señales post-práctica (AUTO-2A)
  patterns: Object              // Patrones derivados de señales (AUTO-2B)
}
```

**Construcción**: Única fuente de verdad para el estado del estudiante en `/enter`.

**Dependencias**:
- `requireStudentContext()` (auth-context.js)
- `gestionarEstadoSuscripcion()`
- `computeStreakFromPracticas()` (streak-engine.js)
- `computeProgress()` (progress-engine.js)
- `getFrasePorNivel()`
- `getAggregatesForAlumno()` (señales)
- `getActivePatternsForAlumno()` (patrones)

---

#### 1.1.3 AuthContext (`requireStudentContext`, `requireAdminContext`)

**Archivo**: `src/core/auth-context.js`  
**Tipo**: Contexto de autenticación  
**Estado**: Activo

**Variantes**:
1. **StudentContext** (`requireStudentContext`):
   - Devuelve: `{ user: student, isAdmin: false, isAuthenticated: true, request, requestId }`
   - O `Response` (pantalla0) si no autenticado
   - Verifica cookie → PostgreSQL

2. **AdminContext** (`requireAdminContext`):
   - Devuelve: `{ user: { isAdmin: true }, isAdmin: true, isAuthenticated: true, request, requestId }`
   - O `Response` (login admin) si no autenticado
   - Valida sesión admin con `validateAdminSession()`

---

### 1.2 Contextos Implícitos (No Registrados como Entidad)

#### 1.2.1 Environment (Entorno)

**Dónde se usa**:
- Theme System: `ctx.environment` ('admin' | 'student')
- Sidebar/Navigation: Determinado por ruta (`/admin/*` vs rutas estudiante)
- Feature Flags: `APP_ENV` ('dev' | 'beta' | 'prod')

**Estado**: Implícito, determinado por ruta y headers.

---

#### 1.2.2 Screen (Pantalla)

**Dónde se usa**:
- Theme System: `ctx.screen` (ej: 'admin/tecnicas-limpieza')
- Navigation: Determina items visibles (`visibility.min_nivel_efectivo`)
- Enter Handler: Determina qué pantalla renderizar (Pantalla0, 1, 2, 3, 4)

**Pantallas identificadas**:
- `Pantalla0`: Recuperación de sesión (sin cookie)
- `Pantalla1`: No ha practicado hoy
- `Pantalla2`: Ya practicó hoy
- `Pantalla3`: Vista de tema individual
- `Pantalla4`: Lista de temas

**Estado**: Implícito, determinado por URL y lógica en endpoints.

---

#### 1.2.3 Editor

**Dónde se usa**:
- Theme System: `ctx.editor` (ej: 'nav-editor', 'recorridos-editor')
- Theme Layers: Resolución de temas por capa

**Estado**: Implícito, determinado por ruta admin.

---

#### 1.2.4 Nivel Efectivo

**Dónde se usa**:
- `buildStudentContext`: `nivelInfo.nivel_efectivo` (calculado por `computeProgress()`)
- Navigation: `visibility.min_nivel_efectivo` (filtra items)
- Progress Engine: `nivel_efectivo` puede tener overrides del Master
- Paquetes PDE: Filtrado por nivel (`filter_by_nivel`)

**Cálculo**:
- Base: Días desde inscripción → `nivel_base`
- Efectivo: `nivel_base` + overrides del Master → `nivel_efectivo`
- Fase: Sanación (1-9) o Canalización (10-15)

**Estado**: Calculado en runtime, parte de StudentContext.

---

#### 1.2.5 Estado del Alumno

**Estados identificados**:

1. **Suscripción**:
   - `pausada` (boolean): Si la suscripción está pausada
   - `reactivada` (boolean): Si se reactivó recientemente
   - Ubicación: `estadoSuscripcion` en StudentContext
   - Fuente: `gestionarEstadoSuscripcion()` (actualmente siempre `false`)

2. **Práctica**:
   - `todayPracticed` (boolean): Si ya practicó hoy
   - `streak` (number): Racha actual
   - `hoy_practicado` (boolean): Del motor canónico de rachas
   - `congelada_por_pausa` (boolean): Si la racha está congelada
   - Ubicación: `streakInfo` en StudentContext

3. **Progreso**:
   - `nivel_efectivo` (number): Nivel efectivo
   - `fase_efectiva` (object): {id, nombre, reason}
   - `overrides_aplicados` (array): Overrides del Master aplicados
   - Ubicación: `nivelInfo` en StudentContext

4. **Tema Actual**:
   - `topicId` (string): ID del tema activo
   - Ubicación: URL (`/topic/{topicId}`)
   - Estado del tema: `getTemaState(student, topicId)`

**Estado**: Distribuido entre StudentContext y lógica de endpoints.

---

#### 1.2.6 Sidebar Context

**Dónde se usa**:
- `determineSidebarContext(pathname)`: Determina contexto del sidebar
- Valores: `'home' | 'practica' | 'personal'`

**Lógica**:
- `'practica'`: Rutas con `/practicar`, `/practica`, `/topic/`, `/topics`, `/aprender`
- `'personal'`: Rutas con `/perfil-personal`, `/personal`, `/mi-universo`
- `'home'`: Por defecto

**Estado**: Implícito, determinado por pathname.

---

#### 1.2.7 Navigation Zone

**Dónde se usa**:
- `getNavigationItemsForStudent()`: Filtra items por zone
- Valores: `'home' | 'practica' | 'personal' | 'sidebar'`

**Lógica**:
- Nodos tienen `meta.zone` (string o array)
- Fallback: `layout_hint` mapea a zones (legacy)

**Estado**: Definido en NavigationDefinition JSON, evaluado en runtime.

---

#### 1.2.8 Feature Flags

**Archivo**: `src/core/flags/feature-flags.js`  
**Tipo**: Flags hardcodeados en código  
**Estado**: Activo (sistema V4)

**Flags identificados** (ejemplos):
- `progress_v4`
- `dias_activos_v2`
- `nivel_calculo_v2`
- `streak_calculo_v2`
- `suscripcion_control_v2`
- `analytics_v1`
- `ui_experience_v1`
- `automations_beta`
- `AUTOMATIONS_ENGINE_ENABLED`
- `recorridos_registry_v1`
- `navigation_editor_v1`
- `energy_transmutations_v1`
- Y muchos más...

**Estados**: `'on' | 'beta' | 'off'`  
**Determinación**: Según `APP_ENV` ('dev' | 'beta' | 'prod')

**Uso**: Condicionan ejecución de código (actúan como contexto).

---

#### 1.2.9 Query Parameters

**Ejemplos**:
- `?practico=si`: Fuerza práctica (forcePractice: true)
- `?practicar=si`: Incrementa contador de tema
- `?password=...`: Password admin (si no hay IP whitelist)

**Estado**: Implícito, leído desde URL.

---

#### 1.2.10 Fecha/Tiempo

**Dónde se usa**:
- Cálculo de nivel: Días desde `fecha_inscripcion`
- Cálculo de racha: Comparación con `ultimo_dia_con_practica`
- Hitos: Días de racha (25, 50, 75, 100, 150, 200, 365)
- Práctica diaria: Comparación con fecha actual
- Idempotencia de automatizaciones: `day_key` (YYYY-MM-DD)

**Estado**: Implícito, determinado por `new Date()`.

---

#### 1.2.11 Tema Activo (Topic)

**Dónde se usa**:
- `topic-screen.js`: `topicId` desde URL
- `getTemaState()`: Estado del tema (contador, objetivo)
- `incrementarTema()`: Mutación del contador

**Temas hardcodeados**:
- `tema1`: Limpieza de mis canales perceptivos
- `tema2`: Abundancia
- `tema3`: Salud física

**Estado**: Hardcodeado en `src/modules/tema.js` (TOPIC_FIELDS).

---

#### 1.2.12 System Mode

**Archivo**: `src/core/system/system-modes.js` (probable)  
**Tipo**: Modo del sistema  
**Valores**: `NORMAL | DEGRADED | BROKEN` (según reglas constitucionales)

**Estado**: Implícito (según reglas constitucionales, escrituras bloqueadas en BROKEN).

---

## 2. DÓNDE VIVEN Y CÓMO SE USAN

### 2.1 Base de Datos (PostgreSQL)

**Tablas relacionadas con contextos**:

1. **`pde_contexts`**:
   - Contextos explícitos registrados
   - Campos: `context_key`, `definition`, `scope`, `kind`, `injected`, etc.
   - Audit log: `pde_context_audit_log`

2. **`context_mappings`** (v5.24.0):
   - Mappings de valores enum a parámetros derivados
   - Campos: `context_key`, `mapping_key`, `mapping_data`

3. **`pde_packages`**:
   - `definition.context_contract`: Contrato de contextos del paquete
   - `definition.context_rules`: Reglas condicionales según contexto

4. **`pde_automations`**:
   - `definition.conditions`: Condiciones que pueden usar contexto
   - `resolved_context` (en executions): Contexto resuelto al ejecutar

5. **`pde_widgets`**:
   - `prompt_context_json.inputs`: Inputs que pueden incluir contextos

6. **`theme_bindings`**:
   - Bindings de temas por scope: `scope_type`, `scope_key`
   - Scopes: `'global' | 'environment' | 'editor' | 'screen' | 'user'`

7. **`alumnos`** (PostgreSQL):
   - `nivel_actual`: Nivel del alumno (puede tener overrides)
   - `fecha_inscripcion`: Para cálculo de nivel base
   - `estado_suscripcion`: Estado de suscripción (pausada/activa)

8. **`practicas`** (PostgreSQL):
   - `fecha`: Para cálculo de racha y práctica diaria
   - `alumno_id`: Para agregación por alumno

---

### 2.2 Código JavaScript

**Archivos clave**:

1. **`src/core/student-context.js`**:
   - Construye StudentContext (contexto principal del estudiante)
   - Único punto de construcción de estado del estudiante

2. **`src/core/auth-context.js`**:
   - Construye AuthContext (student/admin)
   - Verifica autenticación y sesión

3. **`src/core/theme-system/theme-system-v1.js`**:
   - Resuelve tema efectivo según contexto (`ctx.environment`, `ctx.screen`, `ctx.editor`)

4. **`src/core/theme/theme-layers-v1.js`**:
   - Resuelve tema por capas (user → screen → editor → environment → global)

5. **`src/core/navigation/navigation-renderer.js`**:
   - Filtra items de navegación según `studentCtx.nivelInfo.nivel`
   - Evalúa `visibility.min_nivel_efectivo`

6. **`src/core/navigation/sidebar-renderer.js`**:
   - Determina contexto del sidebar (`determineSidebarContext()`)
   - Filtra items por contexto (`'home' | 'practica' | 'personal'`)

7. **`src/endpoints/enter.js`**:
   - Usa StudentContext para determinar qué pantalla mostrar
   - Evalúa `todayPracticed`, `estadoSuscripcion.pausada`, `streakInfo`

8. **`src/modules/nivel.js`**:
   - Hardcodea thresholds de niveles (NIVEL_THRESHOLDS)
   - Calcula nivel automático (deshabilitado/legacy)

9. **`src/modules/tema.js`**:
   - Hardcodea temas (TOPIC_FIELDS)
   - Gestiona estado de temas (contador, objetivo)

10. **`src/core/flags/feature-flags.js`**:
    - Hardcodea todos los feature flags
    - Evalúa según `APP_ENV`

---

### 2.3 Lógica Condicional en Templates/HTML

**Archivos HTML**:
- `src/core/html/pantalla1.html`, `pantalla2.html`, etc.
- Reciben `ctx` con StudentContext
- Renderizan condicionalmente según `todayPracticed`, `estadoSuscripcion`, `streakInfo`, `nivelInfo`

**Ejemplo**: Si `ctx.estadoSuscripcion.pausada`, muestra mensaje especial.

---

## 3. RELACIÓN CON SOURCE OF TRUTH

### 3.1 Source of Truth Canónico (PostgreSQL)

**Principio Constitucional**: PostgreSQL es el ÚNICO Source of Truth del Alumno.

**Tablas SOT relacionadas con contextos**:

1. **`alumnos`**:
   - `nivel_actual`: Nivel efectivo (puede tener overrides)
   - `fecha_inscripcion`: Para cálculo de nivel base
   - `estado_suscripcion`: Estado de suscripción

2. **`practicas`**:
   - `fecha`: Para cálculo de racha y práctica diaria
   - `alumno_id`: Para agregación

3. **`pde_contexts`**:
   - Definiciones canónicas de contextos
   - Source of Truth para contextos PDE

4. **`theme_bindings`**:
   - Source of Truth para bindings de temas por scope

5. **`pde_packages`**:
   - Source of Truth para paquetes y sus contratos de contexto

---

### 3.2 Estados No Persistidos (Calculados en Runtime)

**Estados calculados**:
- `streakInfo`: Calculado desde `practicas` (motor canónico)
- `nivelInfo`: Calculado desde `fecha_inscripcion` + overrides
- `todayPracticed`: Calculado comparando fecha actual con última práctica
- `estadoSuscripcion.pausada`: Actualmente hardcodeado a `false`

**Problema**: Algunos estados son calculados, no persistidos, lo que puede generar inconsistencias.

---

### 3.3 Hardcoded como Autoridad (Violación Constitucional)

**Ejemplos**:

1. **Niveles** (`src/modules/nivel.js`):
   - `NIVEL_THRESHOLDS`: Array hardcodeado con thresholds
   - Violación: "Prohibido hardcoded como autoridad de negocio"

2. **Temas** (`src/modules/tema.js`):
   - `TOPIC_FIELDS`: Mapa hardcodeado de temas
   - Violación: "Prohibido hardcoded como autoridad de negocio"

3. **Feature Flags** (`src/core/flags/feature-flags.js`):
   - `FEATURE_FLAGS`: Objeto hardcodeado
   - Nota: Temporalmente aceptable según reglas, pero debería migrarse a BD

---

## 4. RELACIÓN CON PAQUETES

### 4.1 Paquetes PDE (`pde_packages`)

**Estructura**:
- `definition.context_contract`: Contrato de contextos del paquete
  - `inputs`: Contextos que el paquete espera
  - `outputs`: Contextos que el paquete produce
- `definition.context_rules`: Reglas condicionales según contexto
  - `when`: Condición sobre contexto
  - `limits`: Límites según contexto

**Ejemplo** (hipotético):
```json
{
  "context_contract": {
    "inputs": [
      {
        "key": "nivel_pde",
        "type": "number",
        "default": 1
      },
      {
        "key": "tipo_limpieza",
        "type": "enum",
        "values": ["rapida", "completa"],
        "default": "rapida"
      }
    ]
  },
  "context_rules": [
    {
      "when": { "nivel_pde": 1 },
      "limits": { "source_key": 10 }
    }
  ]
}
```

**Estado**: Sistema diseñado pero relación con contextos canónicos no está clara.

---

### 4.2 Activación de Paquetes

**Cómo se activan**: No claro en el código actual (necesita investigación en `package-engine.js`).

**Condiciones**:
- Probablemente según nivel efectivo (`filter_by_nivel`)
- Probablemente según contextos resueltos

**Estado**: Requiere más investigación.

---

## 5. RELACIÓN CON AUTOMATIZACIONES

### 5.1 Automatizaciones (`pde_automations`)

**Estructura**:
- `trigger_signal_key`: Señal que dispara la automatización
- `definition.conditions`: Condiciones que pueden usar contexto
  - `source`: "payload" | "context" | "runtime"
  - `path`: Path al valor
  - `op`: Operador
  - `value`: Valor esperado

**Ejemplo** (hipotético):
```json
{
  "conditions": [
    {
      "source": "context",
      "path": "nivel_efectivo",
      "op": ">=",
      "value": 5
    }
  ]
}
```

**Ejecuciones** (`pde_automation_executions`):
- `resolved_context` (JSONB): Contexto resuelto al momento de ejecutar
- `payload` (JSONB): Payload de la señal

**Estado**: Sistema diseñado para usar contextos, pero relación con contextos canónicos no está clara.

---

### 5.2 Condiciones en Automatizaciones

**Tipos de condiciones identificados**:
- Basadas en payload de señal
- Basadas en contexto resuelto
- Basadas en runtime (ej: `student_id`, `day_key`)

**Problema**: No hay claridad sobre qué contextos están disponibles en `resolved_context`.

---

## 6. RELACIÓN CON WIDGETS Y UI

### 6.1 Widgets PDE (`pde_widgets`)

**Estructura**:
- `prompt_context_json.inputs`: Inputs que pueden incluir contextos
  - `key`: Clave del input
  - `type`: Tipo de dato
  - `values`: Valores permitidos (si enum)
  - `default`: Valor por defecto
  - `required`: Si es obligatorio

**Estado**: Sistema diseñado pero relación con contextos canónicos no está clara.

---

### 6.2 Render Condicional en UI

**Pantallas**:
- `Pantalla1`: Condicionada por `todayPracticed`, `estadoSuscripcion.pausada`
- `Pantalla2`: Condicionada por `todayPracticed`, hitos de racha
- `Pantalla3`: Condicionada por estado del tema (contador, objetivo cumplido)

**Navegación**:
- Items filtrados por `visibility.min_nivel_efectivo`
- Items filtrados por `meta.zone`

**Sidebar**:
- Items filtrados por contexto (`'home' | 'practica' | 'personal'`)

**Estado**: Lógica condicional dispersa, no centralizada.

---

### 6.3 Lógica de Visibilidad

**Dónde se evalúa**:
- `evaluateNavigationForStudent()`: Evalúa visibilidad de items de navegación
- `getNavigationItemsForStudent()`: Filtra por zone y visibilidad
- Templates HTML: Render condicional según `ctx`

**Problema**: Lógica de visibilidad no está centralizada ni documentada como sistema de contextos.

---

## 7. RELACIÓN CON TEMAS

### 7.1 Theme System v1

**Resolución por capas** (`resolveThemeByLayers`):
1. User override (`ctx.student`)
2. Screen override (`ctx.screen`)
3. Editor override (`ctx.editor`)
4. Environment override (`ctx.environment`)
5. Global default

**Scopes** (`theme_bindings`):
- `scope_type`: `'global' | 'environment' | 'editor' | 'screen' | 'user'`
- `scope_key`: Clave del scope (ej: `'admin'`, `'student'`, `'admin/tecnicas-limpieza'`)

**Estado**: Sistema funcional, usa contextos implícitos (environment, screen, editor).

---

### 7.2 Contextos Usados por Temas

**Contextos identificados**:
- `environment`: 'admin' | 'student' (implícito)
- `screen`: Pantalla actual (implícito)
- `editor`: Editor actual (implícito)
- `student`: Objeto estudiante (para user override, implícito)

**Problema**: No hay mapeo claro entre contextos canónicos (pde_contexts) y scopes de temas.

---

### 7.3 Intención Futura

**Según documentación** (THEME_SYSTEM_V1.md, probable):
- Posible uso de estados/contextos adicionales
- Actualmente solo usa scopes básicos (environment, screen, editor, user)

**Estado**: Sistema funcional pero limitado a scopes básicos.

---

## 8. VACÍOS ESTRUCTURALES

### 8.1 Inexistente pero Necesario

1. **Registry de Contextos Canónicos**:
   - `pde_contexts` existe pero no hay sistema claro de registro/discovery
   - No hay API clara para consultar contextos disponibles

2. **Resolución Centralizada de Contextos**:
   - No hay función única que resuelva TODOS los contextos para un estudiante/situación
   - Contextos se resuelven ad-hoc en diferentes lugares

3. **Mapeo Contextos → Temas**:
   - No hay mapeo claro entre contextos canónicos y scopes de temas
   - Temas solo usan scopes básicos (environment, screen, editor)

4. **Contextos de Estado del Alumno**:
   - Estados como "pausado", "activo", "intensivo" no están explícitos como contextos
   - Solo existen implícitamente en `estadoSuscripcion.pausada`

5. **Contextos Temporales/Transitorios**:
   - No hay sistema para contextos que existen solo durante una sesión/workflow
   - Ejemplo: "tema_actual", "pantalla_actual"

6. **Contextos Globales del Sistema**:
   - "temporada", "system_mode" mencionados pero no claros cómo se usan
   - No hay registry centralizado

---

### 8.2 Implícito / Frágil

1. **Environment**:
   - Determinado por ruta (`/admin/*` vs rutas estudiante)
   - No está registrado como contexto canónico

2. **Screen**:
   - Determinado por URL
   - No está registrado como contexto canónico

3. **Editor**:
   - Determinado por ruta admin
   - No está registrado como contexto canónico

4. **Sidebar Context**:
   - Determinado por `determineSidebarContext(pathname)`
   - Lógica hardcodeada, no configurable

5. **Navigation Zone**:
   - Definido en NavigationDefinition JSON
   - No hay validación ni registry

6. **Estados del Alumno**:
   - Distribuidos entre StudentContext y lógica de endpoints
   - No hay entidad explícita que represente "estado actual del alumno"

---

### 8.3 Duplicado / Inconsistente

1. **Nivel Efectivo**:
   - Calculado en múltiples lugares (progress-engine, nivel.js legacy)
   - Algunos lugares usan `nivelInfo.nivel`, otros `nivelInfo.nivel_efectivo`

2. **Estado de Práctica**:
   - `todayPracticed` en StudentContext
   - `hoy_practicado` en streakResult (motor canónico)
   - Posible inconsistencia

3. **Estado de Suscripción**:
   - `gestionarEstadoSuscripcion()` siempre devuelve `{ pausada: false }`
   - Lógica legacy en `verificarSiEstaPausada()` (no usada)

4. **Temas**:
   - Hardcodeados en `TOPIC_FIELDS`
   - No están en Source of Truth

---

### 8.4 Hardcodeado

1. **NIVEL_THRESHOLDS** (`src/modules/nivel.js`):
   - Array hardcodeado con thresholds de niveles
   - Debería estar en PostgreSQL como Source of Truth

2. **TOPIC_FIELDS** (`src/modules/tema.js`):
   - Mapa hardcodeado de temas
   - Debería estar en PostgreSQL como Source of Truth

3. **Feature Flags** (`src/core/flags/feature-flags.js`):
   - Objeto hardcodeado
   - Temporalmente aceptable pero debería migrarse a BD

4. **Sidebar Context Logic** (`determineSidebarContext()`):
   - Lógica hardcodeada para determinar contexto
   - Debería ser configurable

---

## 9. DEUDA TÉCNICA RELACIONADA CON CONTEXTOS

### 9.1 Deuda Estructural

1. **Falta de Sistema Unificado**:
   - No hay sistema único que unifique contextos explícitos e implícitos
   - Cada sistema (temas, navegación, paquetes, automatizaciones) resuelve contextos de forma independiente

2. **Falta de Contrato Formal**:
   - No hay contrato claro sobre qué contextos están disponibles en cada situación
   - No hay documentación de qué contextos puede usar cada sistema

3. **Falta de Validación**:
   - No hay validación de que contextos requeridos estén disponibles
   - No hay validación de tipos/valores de contextos

4. **Falta de Observabilidad**:
   - No hay logging claro de qué contextos se usan en cada request
   - No hay tracing de resolución de contextos

---

### 9.2 Deuda de Implementación

1. **Hardcoded como Autoridad**:
   - NIVEL_THRESHOLDS, TOPIC_FIELDS deberían estar en PostgreSQL
   - Feature Flags deberían migrarse a BD (con plan explícito)

2. **Estados No Persistidos**:
   - Algunos estados son calculados, no persistidos
   - Puede generar inconsistencias si se calculan en diferentes momentos

3. **Lógica Dispersa**:
   - Lógica de resolución de contextos está dispersa
   - No hay función centralizada que resuelva todos los contextos

4. **Falta de Migración**:
   - Contextos implícitos no están migrados a sistema canónico
   - No hay plan claro para migración

---

### 9.3 Deuda de Diseño

1. **Scope vs Contexto**:
   - Temas usan "scopes" (environment, screen, editor)
   - Paquetes usan "contextos" (pde_contexts)
   - No hay claridad sobre la relación

2. **Contextos de Sistema vs Contextos de Usuario**:
   - No hay distinción clara entre contextos del sistema (environment, screen) y contextos del usuario (nivel, estado)
   - `pde_contexts.scope` tiene valores pero no está claro cómo se usan

3. **Contextos Temporales vs Persistentes**:
   - No hay distinción entre contextos que persisten (nivel) y contextos temporales (pantalla actual)
   - No hay sistema para gestionar contextos temporales

---

### 9.4 Deuda de Documentación

1. **Falta de Documentación**:
   - No hay documentación clara de qué contextos existen
   - No hay documentación de cómo usar contextos en cada sistema

2. **Falta de Ejemplos**:
   - No hay ejemplos claros de cómo usar contextos en paquetes, automatizaciones, widgets

3. **Falta de Contratos**:
   - No hay contratos formales documentados para cada tipo de contexto

---

## RESUMEN EJECUTIVO

### Contextos Detectados

**Explícitos (Registrados)**:
- `pde_contexts`: Contextos PDE registrados en BD
- `StudentContext`: Contexto construido en runtime (student-context.js)
- `AuthContext`: Contexto de autenticación (auth-context.js)

**Implícitos (No Registrados)**:
- Environment (admin/student)
- Screen (pantalla actual)
- Editor (editor actual)
- Nivel efectivo (calculado)
- Estado del alumno (suscripción, práctica, progreso)
- Sidebar context (home/practica/personal)
- Navigation zone (home/practica/personal/sidebar)
- Feature flags (hardcodeados)
- Query parameters
- Fecha/tiempo
- Tema activo (hardcodeado)
- System mode (implícito)

### Dónde Viven

- **PostgreSQL**: `pde_contexts`, `context_mappings`, `pde_packages`, `pde_automations`, `pde_widgets`, `theme_bindings`, `alumnos`, `practicas`
- **Código JavaScript**: Múltiples archivos en `src/core/`, `src/modules/`, `src/endpoints/`
- **Templates HTML**: Lógica condicional en templates

### Relación con Sistemas

- **Paquetes**: Usan `context_contract` y `context_rules` (diseñado pero relación no clara)
- **Automatizaciones**: Usan `conditions` con contexto (diseñado pero relación no clara)
- **Widgets**: Usan `inputs` que pueden incluir contextos (diseñado pero relación no clara)
- **Temas**: Usan scopes (environment, screen, editor, user) (funcional pero limitado)
- **UI**: Render condicional disperso, no centralizado

### Vacíos

- Registry centralizado de contextos
- Resolución centralizada de contextos
- Mapeo contextos → temas
- Contextos de estado del alumno explícitos
- Contextos temporales/transitorios
- Contextos globales del sistema

### Deuda Técnica

- Falta de sistema unificado
- Falta de contrato formal
- Hardcoded como autoridad (niveles, temas)
- Estados no persistidos (calculados)
- Lógica dispersa
- Falta de documentación

---

**FIN DEL INFORME**

Este documento es la base para diseñar el Sistema de Contextos canónico. No propone soluciones, solo documenta el estado actual.

