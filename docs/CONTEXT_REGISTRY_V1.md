# CONTEXT REGISTRY V1 — DISEÑO CANÓNICO
**AuriPortal · Catálogo Semántico de Contextos**

**Fecha**: 2025-01-XX  
**Versión**: 1.0.0  
**Estado**: Diseño (No Implementado)

---

## ÍNDICE

1. [Definición del Context Registry](#1-definición-del-context-registry)
2. [Modelo Canónico de Contexto](#2-modelo-canónico-de-contexto)
3. [Clasificación de Contextos](#3-clasificación-de-contextos)
4. [Mapeo de Contextos Existentes](#4-mapeo-de-contextos-existentes)
5. [Relación con Context Snapshot v1](#5-relación-con-context-snapshot-v1)
6. [Relación con Paquetes PDE](#6-relación-con-paquetes-pde)
7. [Relación con Automatizaciones](#7-relación-con-automatizaciones)
8. [Relación con Themes](#8-relación-con-themes)
9. [Relación con IA (Ollama)](#9-relación-con-ia-ollama)
10. [Reglas Constitucionales](#10-reglas-constitucionales)
11. [Fuera de Scope](#11-fuera-de-scope)

---

## 1. DEFINICIÓN DEL CONTEXT REGISTRY

### 1.1 ¿Qué es el Context Registry?

El **Context Registry v1** es un **catálogo semántico canónico** que define:

- **Qué contextos existen** en AuriPortal
- **Qué significa cada contexto** (semántica, propósito)
- **De dónde viene** (autoridad, source of truth)
- **Quién puede usarlo** (paquetes, widgets, automatizaciones, themes, etc.)
- **En qué momento existe** (persistente, sesión, request)

### 1.2 ¿Qué NO es el Context Registry?

El Context Registry:

- ❌ **NO ejecuta lógica**: No calcula valores, no resuelve contextos
- ❌ **NO muta estado**: No modifica PostgreSQL ni ningún sistema
- ❌ **NO reemplaza el snapshot**: El snapshot es proyección, el registry es catálogo
- ❌ **NO es una base de datos**: Es un catálogo conceptual (aunque puede tener representación en BD)
- ❌ **NO es un resolver**: No decide valores, solo define qué existe
- ❌ **NO es autoridad**: PostgreSQL sigue siendo el Source of Truth

### 1.3 ¿Por qué existe?

El Context Registry existe para:

1. **Eliminar ambigüedad**: Un contexto tiene un significado único y claro
2. **Permitir descubrimiento**: Los sistemas pueden saber qué contextos están disponibles
3. **Facilitar validación**: Se puede validar que un contexto existe antes de usarlo
4. **Preparar para IA**: Una IA necesita saber qué contextos puede usar
5. **Reducir deuda técnica**: Contextos implícitos y hardcodeados se vuelven explícitos
6. **Escalar con seguridad**: Nuevos sistemas pueden usar contextos sin romper nada

### 1.4 Relación con Otros Sistemas

#### 1.4.1 PostgreSQL (Source of Truth)

- **PostgreSQL es soberano**: El registry NO es autoridad, solo catálogo
- **El registry puede vivir en PostgreSQL**: Como tabla `pde_contexts` (ya existe parcialmente)
- **El registry define qué campos de PostgreSQL son contextos**: Ej: `alumnos.nivel_actual` → contexto `nivel_efectivo`

#### 1.4.2 Context Snapshot v1

- **El snapshot proyecta valores**: El registry define qué contextos pueden estar en el snapshot
- **El snapshot es runtime**: El registry es diseño/catálogo
- **Relación**: El snapshot puede incluir contextos del registry, pero no todos los contextos del registry están en el snapshot

#### 1.4.3 Paquetes PDE

- **Los paquetes declaran dependencias**: El registry permite validar que las dependencias existen
- **Los paquetes NO generan outputs**: El registry ayuda a entender qué contextos pueden leer
- **Relación**: Los paquetes usan el registry para saber qué contextos están disponibles

#### 1.4.4 Automatizaciones

- **Las automatizaciones usan contextos en condiciones**: El registry define qué contextos pueden usar
- **Las automatizaciones usan señales (signals)**: El registry diferencia contextos de señales
- **Relación**: Las automatizaciones consultan el registry para validar condiciones

#### 1.4.5 Themes

- **Los themes usan scopes**: El registry puede extender scopes con contextos canónicos
- **Los themes pueden usar contextos**: Ej: theme por nivel, por temporada
- **Relación**: El registry permite que themes usen contextos semánticos, no solo scopes técnicos

#### 1.4.6 Widgets

- **Los widgets reciben inputs**: El registry define qué contextos pueden ser inputs
- **Los widgets NO acceden a PostgreSQL**: El registry ayuda a entender qué datos pueden recibir
- **Relación**: Los widgets consultan el registry para saber qué contextos pueden usar

---

## 2. MODELO CANÓNICO DE CONTEXTO

### 2.1 Schema Conceptual

Un contexto en el Context Registry tiene la siguiente estructura:

```typescript
interface ContextDefinition {
  // ========================================================================
  // IDENTIFICACIÓN (OBLIGATORIO)
  // ========================================================================
  context_key: string;                          // Clave única (slug, ej: 'nivel_efectivo', 'temporada')
  label: string;                                // Nombre legible (ej: 'Nivel Efectivo', 'Temporada Actual')
  description: string;                          // Descripción semántica del contexto
  
  // ========================================================================
  // TIPO Y VALORES (OBLIGATORIO)
  // ========================================================================
  type: 'string' | 'number' | 'boolean' | 'enum' | 'json';
  allowed_values?: any[];                       // Solo si type === 'enum'
  default_value?: any;                         // Valor por defecto (según type)
  
  // ========================================================================
  // AUTORIDAD (OBLIGATORIO)
  // ========================================================================
  authority: {
    source_of_truth: boolean;                  // Si es Source of Truth (PostgreSQL)
    derived: boolean;                          // Si es derivado (calculado)
    ux: boolean;                               // Si es solo UX (no lógica de negocio)
  };
  
  // ========================================================================
  // ORIGEN (OBLIGATORIO)
  // ========================================================================
  source: {
    database?: {                               // Si viene de PostgreSQL
      table: string;                           // Tabla (ej: 'alumnos')
      column: string;                          // Columna (ej: 'nivel_actual')
    };
    calculation?: {                            // Si es calculado
      function: string;                        // Función que lo calcula (ej: 'computeProgress')
      dependencies: string[];                  // Contextos de los que depende
    };
    snapshot?: {                               // Si viene del snapshot
      path: string;                            // Path en snapshot (ej: 'student.nivelEfectivo')
    };
    request?: {                                // Si viene del request
      header?: string;                         // Header (ej: 'x-user-id')
      query?: string;                          // Query param (ej: 'practico')
      path?: string;                           // Path param
    };
    hardcoded?: {                              // Si es hardcoded (temporal, debe migrarse)
      location: string;                          // Ubicación (ej: 'src/modules/nivel.js')
      note: string;                            // Nota sobre migración futura
    };
  };
  
  // ========================================================================
  // SCOPE (OBLIGATORIO)
  // ========================================================================
  scope: 'system' | 'structural' | 'personal' | 'package';
  // - system: Contexto del sistema (ej: temporada, system_mode)
  // - structural: Contexto estructural del alumno (ej: nivel_efectivo, fase)
  // - personal: Contexto personal del alumno (ej: preferencias, estado)
  // - package: Contexto definido por un paquete (ej: tipo_limpieza)
  
  // ========================================================================
  // TEMPORALIDAD (OBLIGATORIO)
  // ========================================================================
  temporalidad: 'persistente' | 'sesion' | 'request';
  // - persistente: Existe en PostgreSQL, persiste entre requests
  // - sesion: Existe solo durante la sesión del usuario
  // - request: Existe solo durante un request
  
  // ========================================================================
  // DISPONIBILIDAD (OBLIGATORIO)
  // ========================================================================
  availability: {
    snapshot: boolean;                         // Si está disponible en Context Snapshot v1
    resolver: boolean;                         // Si estará disponible en Context Resolver (futuro)
    runtime: boolean;                         // Si está disponible en runtime (directo)
  };
  
  // ========================================================================
  // USABILIDAD (OBLIGATORIO)
  // ========================================================================
  usable_by: {
    packages: boolean;                         // Si los paquetes pueden usarlo
    widgets: boolean;                          // Si los widgets pueden usarlo
    automations: boolean;                      // Si las automatizaciones pueden usarlo
    themes: boolean;                           // Si los themes pueden usarlo
    navigation: boolean;                      // Si la navegación puede usarlo
    ia: boolean;                              // Si la IA puede usarlo (futuro)
  };
  
  // ========================================================================
  // METADATOS (OBLIGATORIO)
  // ========================================================================
  status: 'active' | 'archived' | 'deprecated';
  version: string;                             // Versión del contexto (ej: '1.0.0')
  created_at: Date;
  updated_at: Date;
  
  // ========================================================================
  // NOTAS CONSTITUCIONALES (OPCIONAL)
  // ========================================================================
  notes?: {
    constitutional?: string[];                // Notas sobre reglas constitucionales
    migration?: string;                        // Nota sobre migración futura
    risks?: string[];                          // Riesgos actuales
    examples?: string[];                       // Ejemplos de uso
  };
}
```

### 2.2 Campos Obligatorios vs Opcionales

**Obligatorios**:
- `context_key`, `label`, `description`
- `type`
- `authority` (al menos uno debe ser true)
- `source` (al menos uno debe estar definido)
- `scope`
- `temporalidad`
- `availability` (al menos uno debe ser true)
- `usable_by` (al menos uno debe ser true)
- `status`, `version`, `created_at`, `updated_at`

**Opcionales**:
- `allowed_values` (solo si `type === 'enum'`)
- `default_value`
- `notes`

---

## 3. CLASIFICACIÓN DE CONTEXTOS

### 3.1 Contextos de Sistema

**Definición**: Contextos que pertenecen al sistema global, no a un alumno específico.

**Características**:
- `scope: 'system'`
- `temporalidad: 'persistente'` o `'request'`
- No dependen de un alumno

**Ejemplos**:
- `temporada`: Temporada actual del sistema (ej: 'navidad', 'verano')
- `system_mode`: Modo del sistema (NORMAL, DEGRADED, BROKEN)
- `app_env`: Entorno de la aplicación ('dev', 'beta', 'prod')
- `time_now`: Timestamp actual
- `day_key`: Clave del día (YYYY-MM-DD)

**Autoridad**: Sistema, cálculo, o configuración.

---

### 3.2 Contextos del Alumno (Identidad)

**Definición**: Contextos que identifican o caracterizan al alumno.

**Características**:
- `scope: 'structural'` o `'personal'`
- `temporalidad: 'persistente'`
- Dependen de un alumno específico

**Ejemplos**:
- `alumno_id`: UUID del alumno (PostgreSQL)
- `alumno_email`: Email normalizado del alumno
- `alumno_apodo`: Apodo del alumno
- `alumno_nombre`: Nombre completo del alumno

**Autoridad**: PostgreSQL (`alumnos` table).

---

### 3.3 Contextos de Progreso

**Definición**: Contextos que representan el progreso del alumno en el sistema.

**Características**:
- `scope: 'structural'`
- `temporalidad: 'persistente'`
- Pueden tener overrides del Master

**Ejemplos**:
- `nivel_efectivo`: Nivel efectivo del alumno (puede tener overrides)
- `nivel_base`: Nivel base calculado (sin overrides)
- `fase_efectiva`: Fase efectiva ('sanacion' | 'canalizacion')
- `fase_base`: Fase base calculada
- `nombre_nivel`: Nombre del nivel (ej: 'Sanación - Nivel 5')
- `tiene_overrides`: Si tiene overrides del Master aplicados

**Autoridad**: PostgreSQL (`alumnos.nivel_actual`) + cálculo (`computeProgress()`).

---

### 3.4 Contextos de Práctica

**Definición**: Contextos relacionados con la práctica diaria del alumno.

**Características**:
- `scope: 'structural'`
- `temporalidad: 'persistente'` o `'request'`
- Se calculan desde `practicas` (PostgreSQL)

**Ejemplos**:
- `streak`: Racha actual (días consecutivos)
- `today_practiced`: Si ya practicó hoy
- `ultimo_dia_con_practica`: Último día con práctica (YYYY-MM-DD)
- `congelada_por_pausa`: Si la racha está congelada
- `dias_congelados`: Días congelados acumulados

**Autoridad**: PostgreSQL (`practicas` table) + cálculo (`computeStreakFromPracticas()`).

---

### 3.5 Contextos de Suscripción

**Definición**: Contextos relacionados con el estado de suscripción del alumno.

**Características**:
- `scope: 'structural'`
- `temporalidad: 'persistente'`
- Afectan capacidad de práctica

**Ejemplos**:
- `suscripcion_pausada`: Si la suscripción está pausada
- `puede_practicar`: Si puede practicar hoy (derivado de suscripción)
- `suscripcion_reactivada`: Si se reactivó recientemente

**Autoridad**: PostgreSQL (`alumnos.estado_suscripcion`).

---

### 3.6 Contextos Temporales

**Definición**: Contextos que existen solo durante una sesión o request.

**Características**:
- `temporalidad: 'sesion'` o `'request'`
- No persisten en PostgreSQL
- Se determinan en runtime

**Ejemplos**:
- `environment`: Entorno actual ('admin' | 'student' | 'anonymous')
- `screen`: Pantalla actual (ej: '/enter', 'admin/tecnicas-limpieza')
- `editor`: Editor actual (ej: 'nav-editor', 'recorridos-editor')
- `sidebar_context`: Contexto del sidebar ('home' | 'practica' | 'personal')
- `navigation_zone`: Zone de navegación ('home' | 'practica' | 'personal' | 'sidebar')
- `topic_actual`: Tema actual activo (ej: 'tema1', 'tema2', 'tema3')

**Autoridad**: Request (URL, headers) o sesión.

---

### 3.7 Contextos UX (Derivados)

**Definición**: Contextos que son solo para experiencia de usuario, NO para lógica de negocio.

**Características**:
- `authority.ux: true`
- `authority.source_of_truth: false`
- `authority.derived: true`
- NO deben usarse para decisiones de negocio

**Ejemplos**:
- `frase_motivacional`: Frase del sistema con variables dinámicas
- `bloque_hito`: Mensaje de hito si aplica (25, 50, 75, 100 días)
- `nivel_info_ux`: Capa UX derivada del nivel (para display)

**Autoridad**: Cálculo/derivación desde otros contextos.

---

### 3.8 Contextos Derivados

**Definición**: Contextos calculados a partir de otros contextos.

**Características**:
- `authority.derived: true`
- `source.calculation` definido
- `source.calculation.dependencies` lista contextos de los que depende

**Ejemplos**:
- `dias_desde_inscripcion`: Calculado desde `fecha_inscripcion` y `time_now`
- `dias_sin_practicar`: Calculado desde `ultimo_dia_con_practica` y `day_key`
- `es_hito`: Calculado desde `streak` (true si streak es 25, 50, 75, 100, etc.)

**Autoridad**: Cálculo desde otros contextos.

---

### 3.9 Contextos de Paquetes

**Definición**: Contextos definidos por paquetes PDE.

**Características**:
- `scope: 'package'`
- `temporalidad: 'sesion'` o `'request'`
- Definidos en `pde_packages.definition.context_contract.inputs`

**Ejemplos**:
- `tipo_limpieza`: Tipo de limpieza energética ('rapida' | 'completa')
- `nivel_filtro`: Nivel para filtrar contenido en paquete

**Autoridad**: Input del usuario o paquete.

---

## 4. MAPEO DE CONTEXTOS EXISTENTES

### 4.1 Contextos en `pde_contexts` (PostgreSQL)

| context_key | Estado Actual | context_key Propuesto | Autoridad | Scope | Riesgos | ¿Debe estar en Registry v1? |
|-------------|---------------|----------------------|-----------|-------|---------|----------------------------|
| `nivel_pde` | Explícito (BD) | `nivel_efectivo` | PostgreSQL + cálculo | structural | Ninguno | ✅ SÍ |
| `temporada` | Explícito (BD) | `temporada` | Sistema/config | system | Hardcoded | ✅ SÍ |
| `tipo_limpieza` | Explícito (BD) | `tipo_limpieza` | Input usuario/paquete | package | Ninguno | ✅ SÍ |

**Nota**: `nivel_pde` debería mapearse a `nivel_efectivo` para consistencia con el snapshot.

---

### 4.2 Contextos en StudentContext

| Campo StudentContext | context_key Propuesto | Autoridad | Scope | Temporalidad | Riesgos | ¿Debe estar en Registry v1? |
|---------------------|---------------------|-----------|-------|-------------|---------|----------------------------|
| `student.id` | `alumno_id` | PostgreSQL | structural | persistente | Ninguno | ✅ SÍ |
| `student.email` | `alumno_email` | PostgreSQL | structural | persistente | Ninguno | ✅ SÍ |
| `email` | `alumno_email` (duplicado) | PostgreSQL | structural | persistente | Duplicación | ✅ SÍ (unificar) |
| `estadoSuscripcion.pausada` | `suscripcion_pausada` | PostgreSQL | structural | persistente | Actualmente hardcoded a false | ✅ SÍ |
| `puedePracticar` | `puede_practicar` | Derivado | structural | persistente | Ninguno | ✅ SÍ |
| `streakInfo.streak` | `streak` | PostgreSQL + cálculo | structural | persistente | Ninguno | ✅ SÍ |
| `streakInfo.todayPracticed` | `today_practiced` | PostgreSQL + cálculo | structural | request | Ninguno | ✅ SÍ |
| `streakInfo.ultimo_dia_con_practica` | `ultimo_dia_con_practica` | PostgreSQL | structural | persistente | Ninguno | ✅ SÍ |
| `streakInfo.congelada_por_pausa` | `congelada_por_pausa` | PostgreSQL + cálculo | structural | persistente | Ninguno | ✅ SÍ |
| `streakInfo.dias_congelados` | `dias_congelados` | PostgreSQL + cálculo | structural | persistente | Ninguno | ✅ SÍ |
| `nivelInfo.nivel_efectivo` | `nivel_efectivo` | PostgreSQL + cálculo | structural | persistente | Ninguno | ✅ SÍ |
| `nivelInfo.nivel_base` | `nivel_base` | Cálculo | structural | persistente | Ninguno | ✅ SÍ |
| `nivelInfo.fase_efectiva` | `fase_efectiva` | Cálculo | structural | persistente | Ninguno | ✅ SÍ |
| `nivelInfo.nombre` | `nombre_nivel` | Cálculo | structural | persistente | Ninguno | ✅ SÍ |
| `nivelInfo.tieneOverrides` | `tiene_overrides` | Cálculo | structural | persistente | Ninguno | ✅ SÍ |
| `frase` | `frase_motivacional` | Derivado UX | personal | request | UX usado como autoridad | ✅ SÍ (marcar UX) |
| `bloqueHito` | `bloque_hito` | Derivado UX | personal | request | UX usado como autoridad | ✅ SÍ (marcar UX) |
| `signals` | `signals_aggregates` | PostgreSQL | personal | request | No es contexto, es señal | ❌ NO (es señal) |
| `patterns` | `patterns_active` | PostgreSQL | personal | request | No es contexto, es patrón | ❌ NO (es patrón) |

---

### 4.3 Contextos en AuthContext

| Campo AuthContext | context_key Propuesto | Autoridad | Scope | Temporalidad | Riesgos | ¿Debe estar en Registry v1? |
|------------------|---------------------|-----------|-------|-------------|---------|----------------------------|
| `user.id` (si student) | `alumno_id` | PostgreSQL | structural | persistente | Duplicado con StudentContext | ✅ SÍ (unificar) |
| `user.email` (si student) | `alumno_email` | PostgreSQL | structural | persistente | Duplicado con StudentContext | ✅ SÍ (unificar) |
| `isAdmin` | `actor_type` | Request/sesión | system | request | Implícito | ✅ SÍ |
| `isAuthenticated` | `is_authenticated` | Request/sesión | system | request | Implícito | ✅ SÍ |
| `requestId` | `request_id` | Sistema | system | request | No es contexto, es metadata | ❌ NO (es metadata) |

---

### 4.4 Contextos en Context Snapshot v1

| Campo Snapshot | context_key Propuesto | Autoridad | Scope | Temporalidad | Riesgos | ¿Debe estar en Registry v1? |
|----------------|---------------------|-----------|-------|-------------|---------|----------------------------|
| `identity.actorType` | `actor_type` | Request | system | request | Implícito | ✅ SÍ |
| `identity.actorId` | `alumno_id` (si student) | PostgreSQL | structural | persistente | Solo si student | ✅ SÍ |
| `identity.email` | `alumno_email` (si student) | PostgreSQL | structural | persistente | Solo si student | ✅ SÍ |
| `identity.isAuthenticated` | `is_authenticated` | Request | system | request | Implícito | ✅ SÍ |
| `identity.requestId` | `request_id` | Sistema | system | request | No es contexto, es metadata | ❌ NO (es metadata) |
| `environment.env` | `app_env` | Sistema | system | request | Implícito | ✅ SÍ |
| `environment.context` | `environment` | Request | system | request | Implícito | ✅ SÍ |
| `environment.screen` | `screen` | Request | system | request | Implícito, no normalizado | ✅ SÍ |
| `environment.editor` | `editor` | Request | system | request | Implícito | ✅ SÍ |
| `environment.sidebarContext` | `sidebar_context` | Request | system | request | Implícito | ✅ SÍ |
| `environment.navigationZone` | `navigation_zone` | NavigationDefinition | system | request | Implícito | ✅ SÍ |
| `time.now` | `time_now` | Sistema | system | request | No es contexto, es tiempo | ❌ NO (es tiempo) |
| `time.dayKey` | `day_key` | Sistema | system | request | No es contexto, es tiempo | ❌ NO (es tiempo) |
| `time.timestamp` | `timestamp` | Sistema | system | request | No es contexto, es tiempo | ❌ NO (es tiempo) |
| `student.*` | (ver StudentContext) | (ver StudentContext) | (ver StudentContext) | (ver StudentContext) | (ver StudentContext) | ✅ SÍ (todos) |
| `pdeContexts.*` | (dinámico) | PostgreSQL | (según contexto) | (según contexto) | Ninguno | ✅ SÍ (todos) |
| `flags.*` | `flag_*` | Sistema | system | request | Hardcoded | ✅ SÍ (como grupo) |
| `ui.currentPath` | `current_path` | Request | system | request | No es contexto, es UI | ❌ NO (es UI) |
| `ui.queryParams` | `query_*` | Request | system | request | No es contexto, es UI | ❌ NO (es UI) |
| `meta.*` | - | - | - | - | No es contexto, es metadata | ❌ NO (es metadata) |

---

### 4.5 Contextos en Theme Scopes

| Scope Actual | context_key Propuesto | Autoridad | Scope | Temporalidad | Riesgos | ¿Debe estar en Registry v1? |
|--------------|---------------------|-----------|-------|-------------|---------|----------------------------|
| `environment` | `environment` | Request | system | request | Implícito | ✅ SÍ |
| `screen` | `screen` | Request | system | request | Implícito, no normalizado | ✅ SÍ |
| `editor` | `editor` | Request | system | request | Implícito | ✅ SÍ |
| `user` | `alumno_id` (si student) | PostgreSQL | structural | persistente | Solo si student | ✅ SÍ |
| `global` | - | - | - | - | No es contexto, es scope | ❌ NO (es scope) |

**Nota**: Los scopes de themes son técnicos. El registry permite añadir contextos semánticos (ej: `nivel_efectivo`, `temporada`) para themes futuros.

---

### 4.6 Contextos en Navigation / Sidebar

| Contexto Actual | context_key Propuesto | Autoridad | Scope | Temporalidad | Riesgos | ¿Debe estar en Registry v1? |
|----------------|---------------------|-----------|-------|-------------|---------|----------------------------|
| `sidebarContext` | `sidebar_context` | Request | system | request | Hardcodeado | ✅ SÍ |
| `navigationZone` | `navigation_zone` | NavigationDefinition | system | request | Implícito | ✅ SÍ |
| `visibility.min_nivel_efectivo` | `nivel_efectivo` (usado en condición) | PostgreSQL + cálculo | structural | persistente | Ninguno | ✅ SÍ (ya mapeado) |

---

### 4.7 Feature Flags

| Flag Actual | context_key Propuesto | Autoridad | Scope | Temporalidad | Riesgos | ¿Debe estar en Registry v1? |
|------------|---------------------|-----------|-------|-------------|---------|----------------------------|
| Todos los flags | `flag_*` (grupo) | Sistema (hardcoded) | system | request | Hardcoded como autoridad | ✅ SÍ (como grupo, no individual) |

**Nota**: Los flags individuales NO deben estar en el registry. Solo el concepto de "flags" como grupo de contextos del sistema.

---

### 4.8 Contextos Hardcodeados (Deben Migrarse)

| Ubicación | context_key Propuesto | Autoridad | Scope | Temporalidad | Riesgos | ¿Debe estar en Registry v1? |
|-----------|---------------------|-----------|-------|-------------|---------|----------------------------|
| `src/modules/nivel.js` (NIVEL_THRESHOLDS) | `nivel_thresholds` | Hardcoded | system | persistente | **VIOLACIÓN CONSTITUCIONAL** | ✅ SÍ (marcar para migración) |
| `src/modules/tema.js` (TOPIC_FIELDS) | `temas_disponibles` | Hardcoded | system | persistente | **VIOLACIÓN CONSTITUCIONAL** | ✅ SÍ (marcar para migración) |

**Nota**: Estos contextos deben migrarse a PostgreSQL como Source of Truth.

---

## 5. RELACIÓN CON CONTEXT SNAPSHOT V1

### 5.1 Qué Contextos Viven en el Snapshot

**Contextos que SIEMPRE están en el snapshot** (si aplican):
- `actor_type`
- `is_authenticated`
- `app_env`
- `environment`
- `screen`
- `editor`
- `time_now`, `day_key`, `timestamp` (como tiempo, no como contextos)
- `alumno_id`, `alumno_email` (si `actor_type === 'student'`)
- Todos los contextos de `student.*` (si `actor_type === 'student'`)
- Todos los `flags.*` (como grupo)

**Contextos que PUEDEN estar en el snapshot** (opcionales):
- `pdeContexts.*` (solo si `includePDEContexts: true`)
- `sidebar_context`, `navigation_zone` (solo si `includeUI: true`)

**Contextos que NO están en el snapshot**:
- Contextos de paquetes (solo existen durante ejecución del paquete)
- Contextos temporales de sesión (solo existen en runtime)
- Contextos que aún no se han resuelto

---

### 5.2 Qué Contextos Son Solo Metadata

**Metadata (NO son contextos)**:
- `request_id`: Trace ID para observabilidad
- `meta.version`: Versión del contrato del snapshot
- `meta.createdAt`: Timestamp de creación
- `meta.sources`: Fuentes de datos usadas

**Tiempo (NO son contextos, son primitivos)**:
- `time.now`: Timestamp actual
- `time.dayKey`: Clave del día
- `time.timestamp`: Unix timestamp

**UI (NO son contextos, son información de request)**:
- `ui.currentPath`: Ruta actual
- `ui.queryParams`: Query parameters

---

### 5.3 Qué Contextos Son Relevantes para Decisiones

**Contextos para decisiones de negocio**:
- `nivel_efectivo`: Determina acceso a contenido
- `suscripcion_pausada`: Determina si puede practicar
- `puede_practicar`: Determina si puede practicar
- `streak`: Determina mensajes y hitos
- `today_practiced`: Determina qué pantalla mostrar

**Contextos para decisiones de UX**:
- `frase_motivacional`: Solo para display
- `bloque_hito`: Solo para display
- `sidebar_context`: Solo para navegación

**Contextos para decisiones técnicas**:
- `environment`: Determina qué temas usar
- `screen`: Determina qué temas usar
- `app_env`: Determina qué flags están activos

---

### 5.4 Rol del Snapshot Respecto al Registry

**El Registry define QUÉ existe**:
- Catálogo de contextos disponibles
- Semántica de cada contexto
- Autoridad de cada contexto

**El Snapshot proyecta VALORES**:
- Valores actuales de contextos
- Proyección inmutable en un momento dado
- Solo lectura

**Relación**:
- El snapshot puede incluir contextos del registry
- El snapshot NO define qué contextos existen (eso es el registry)
- El snapshot es una instancia, el registry es el catálogo

---

## 6. RELACIÓN CON PAQUETES PDE

### 6.1 Por Qué los Paquetes NO Generan Outputs

**Principio**: Los paquetes PDE **agregan datos** desde distintos Source of Truth, NO producen outputs.

**Razones**:
1. **Un paquete puede alimentar múltiples widgets**: Si un paquete generara outputs, cada widget necesitaría su propio paquete
2. **Los paquetes son reutilizables**: Un paquete puede usarse en diferentes contextos
3. **Separación de concerns**: El paquete agrega datos, el widget decide cómo mostrarlos
4. **Evita duplicación**: Un paquete puede usarse para múltiples propósitos

**Ejemplo**:
- Paquete "Técnicas de Limpieza Nivel 5" agrega técnicas desde `tecnicas_limpieza` (SOT)
- Widget A muestra técnicas como lista
- Widget B muestra técnicas como tarjetas
- Widget C muestra técnicas como mapa
- Todos usan el mismo paquete, diferentes widgets

---

### 6.2 Qué Contextos Pueden Leer los Paquetes

**Los paquetes PUEDEN leer**:
- `identity.*` (solo lectura, no modificación)
- `environment.*` (para saber dónde se ejecutan)
- `time.*` (para filtros temporales)
- `pdeContexts.*` (contextos explícitos del registry)
- `flags.*` (para feature flags)
- Contextos declarados en `context_contract.inputs` del paquete

**Los paquetes NO PUEDEN leer**:
- `student.*` directamente (deben venir como input explícito si necesario)
- Acceso directo a PostgreSQL (deben recibir datos a través del snapshot o inputs)

---

### 6.3 Qué Contextos NO Deben Leer los Paquetes

**Prohibido**:
- Acceso directo a PostgreSQL (viola principio de separación)
- Contextos que no están en el registry (no existen)
- Contextos UX derivados para lógica de negocio (solo para display)

**Permitido con restricciones**:
- `student.*` solo si viene como input explícito del paquete
- Contextos temporales solo durante ejecución del paquete

---

### 6.4 Cómo se Declaran Dependencias de Contexto

**Conceptualmente** (en `pde_packages.definition.context_contract.inputs`):

```json
{
  "context_contract": {
    "inputs": [
      {
        "key": "nivel_efectivo",
        "type": "number",
        "required": true,
        "source": "snapshot"  // Viene del snapshot
      },
      {
        "key": "tipo_limpieza",
        "type": "enum",
        "values": ["rapida", "completa"],
        "default": "rapida",
        "source": "user_choice"  // Viene de input del usuario
      }
    ]
  }
}
```

**El registry valida**:
- Que `nivel_efectivo` existe en el registry
- Que `tipo_limpieza` existe en el registry
- Que los tipos coinciden
- Que los valores permitidos coinciden (si enum)

---

### 6.5 Por Qué Esto Permite que un Paquete Alimente Múltiples Widgets

**Flujo**:
1. Paquete se ejecuta con contextos del snapshot + inputs
2. Paquete agrega datos desde Source of Truth (ej: `tecnicas_limpieza`)
3. Paquete devuelve datos agregados (NO outputs de contexto)
4. Múltiples widgets pueden usar los mismos datos agregados
5. Cada widget decide cómo mostrar los datos

**Ventajas**:
- Un paquete, múltiples widgets
- Reutilización de lógica de agregación
- Separación de concerns (agregación vs presentación)

---

## 7. RELACIÓN CON AUTOMATIZACIONES

### 7.1 Uso de Contextos en Condiciones

**Las automatizaciones usan contextos en `definition.conditions`**:

```json
{
  "conditions": [
    {
      "source": "context",
      "path": "nivel_efectivo",
      "op": ">=",
      "value": 5
    },
    {
      "source": "context",
      "path": "suscripcion_pausada",
      "op": "==",
      "value": false
    }
  ]
}
```

**El registry valida**:
- Que `nivel_efectivo` existe
- Que `suscripcion_pausada` existe
- Que los tipos son compatibles con las operaciones

---

### 7.2 Diferencia entre Señales (Signals) y Contextos

**Señales (Signals)**:
- Eventos que ocurren (ej: `practice_completed`, `streak_milestone_reached`)
- Disparan automatizaciones
- Son eventos puntuales
- Se emiten, no se consultan

**Contextos**:
- Estado actual del sistema (ej: `nivel_efectivo`, `streak`)
- Se usan en condiciones de automatizaciones
- Son estado persistente o calculado
- Se consultan, no se emiten

**Ejemplo**:
- Señal: `practice_completed` (evento: "el alumno practicó")
- Contexto: `streak` (estado: "la racha actual es 42")
- Automatización: "Si `practice_completed` Y `streak >= 25`, enviar email de hito"

---

### 7.3 Por Qué las Automatizaciones Necesitan un Registry Claro

**Razones**:
1. **Validación**: Las automatizaciones deben validar que los contextos usados existen
2. **Descubrimiento**: Los creadores de automatizaciones deben saber qué contextos pueden usar
3. **Type safety**: El registry define tipos, las automatizaciones pueden validar tipos
4. **Documentación**: El registry documenta qué significa cada contexto
5. **Evolución**: Si un contexto se depreca, las automatizaciones pueden detectarlo

---

## 8. RELACIÓN CON THEMES

### 8.1 Diferencia entre Scopes Actuales y Contextos Canónicos

**Scopes Actuales (Técnicos)**:
- `environment`: 'admin' | 'student' | 'anonymous'
- `screen`: Pantalla actual (ej: 'admin/tecnicas-limpieza')
- `editor`: Editor actual (ej: 'nav-editor')
- `user`: Usuario actual (para user override)

**Contextos Canónicos Futuros (Semánticos)**:
- `nivel_efectivo`: Nivel del alumno (1-15)
- `temporada`: Temporada actual ('navidad', 'verano', etc.)
- `fase_efectiva`: Fase del alumno ('sanacion' | 'canalizacion')
- `streak`: Racha actual
- `suscripcion_pausada`: Estado de suscripción

**Diferencia**:
- Scopes son técnicos (dónde estamos)
- Contextos son semánticos (qué significa el estado)

---

### 8.2 Cómo el Registry Permite Themes Avanzados

**Themes por Nivel**:
- Theme para nivel 1-5: "Sanación Inicial"
- Theme para nivel 6-9: "Sanación Avanzada"
- Theme para nivel 10-15: "Canalización"

**Themes por Estado**:
- Theme si `suscripcion_pausada`: Tema con mensaje de pausa
- Theme si `streak >= 100`: Tema especial de hito

**Themes por Temporada**:
- Theme si `temporada === 'navidad'`: Tema navideño
- Theme si `temporada === 'verano'`: Tema veraniego

**Themes por Tags**:
- Theme si `alumno_tags.includes('premium')`: Tema premium
- Theme si `alumno_tags.includes('beta')`: Tema beta

**El registry permite**:
- Saber qué contextos pueden usar los themes
- Validar que los contextos existen
- Documentar qué contextos afectan qué themes

---

### 8.3 Integración con Theme System v1

**Theme System v1 actual**:
- Usa scopes técnicos (environment, screen, editor, user)
- Resuelve por capas (user → screen → editor → environment → global)

**Con Context Registry**:
- Themes pueden usar contextos semánticos además de scopes técnicos
- Ejemplo: Theme para `nivel_efectivo >= 10` y `environment === 'student'`
- El registry valida que `nivel_efectivo` existe y es de tipo `number`

---

## 9. RELACIÓN CON IA (OLLAMA)

### 9.1 Por Qué una IA NO Puede Generar Temas/Paquetes Sin Registry

**Problema sin registry**:
- IA no sabe qué contextos existen
- IA no sabe qué significa cada contexto
- IA no sabe qué tipos tienen los contextos
- IA puede inventar contextos que no existen
- IA puede usar contextos incorrectamente

**Con registry**:
- IA consulta el registry para saber qué contextos existen
- IA sabe qué significa cada contexto (description)
- IA sabe qué tipos tienen (type, allowed_values)
- IA puede validar que los contextos que usa existen
- IA puede generar código/definiciones válidas

---

### 9.2 Cómo el Context Registry Será Input Semántico para IA

**Ejemplo Conceptual**:

**Prompt de usuario**: "Hazme un tema de navidad para alumnos nivel 5-10"

**IA usa registry para saber**:
1. Qué es `temporada`: Contexto del sistema, tipo 'string', valores posibles incluyen 'navidad'
2. Qué es `nivel_efectivo`: Contexto estructural, tipo 'number', rango 1-15
3. Qué tokens existen: Consulta Theme System para saber tokens disponibles
4. Qué contextos puede usar: Solo contextos con `usable_by.themes: true`

**IA genera**:
```json
{
  "theme_key": "navidad-nivel-5-10",
  "conditions": [
    { "context": "temporada", "op": "==", "value": "navidad" },
    { "context": "nivel_efectivo", "op": ">=", "value": 5 },
    { "context": "nivel_efectivo", "op": "<=", "value": 10 }
  ],
  "tokens": { /* tokens navideños */ }
}
```

**El registry valida**:
- Que `temporada` existe
- Que `nivel_efectivo` existe
- Que los tipos son compatibles
- Que los valores son válidos

---

### 9.3 Cómo el Registry Será Sistema de Validación para IA

**Validación en tiempo de generación**:
- IA consulta registry antes de generar
- IA valida tipos y valores
- IA solo genera código válido

**Validación en tiempo de ejecución**:
- El sistema valida que los contextos usados existen
- El sistema valida que los tipos coinciden
- El sistema rechaza código inválido

**Ejemplo de validación**:
```javascript
// IA genera esto
{ "context": "nivel_efectivo", "op": ">=", "value": "5" }  // ❌ Error: value debe ser number

// Registry valida
if (context.type === 'number' && typeof value !== 'number') {
  throw new Error('Invalid type for nivel_efectivo: expected number');
}
```

---

## 10. REGLAS CONSTITUCIONALES

### 10.1 Ningún Contexto Existe si No Está en el Registry

**Regla**: Si un contexto no está registrado en el Context Registry, NO existe.

**Implicaciones**:
- Contextos implícitos deben migrarse al registry
- Contextos hardcodeados deben migrarse al registry
- No se pueden usar contextos no registrados

**Excepciones** (temporales, durante migración):
- Contextos legacy pueden existir sin registry durante período de migración
- Deben marcarse explícitamente como "legacy" y tener plan de migración

---

### 10.2 Hardcoded ≠ Autoridad

**Regla**: Valores hardcodeados NO son autoridad de negocio.

**Implicaciones**:
- `NIVEL_THRESHOLDS` hardcodeado debe migrarse a PostgreSQL
- `TOPIC_FIELDS` hardcodeado debe migrarse a PostgreSQL
- Feature flags hardcodeados deben migrarse a BD (con plan explícito)

**El registry marca**:
- Contextos hardcodeados con `source.hardcoded`
- Nota de migración futura
- Riesgo de violación constitucional

---

### 10.3 UX ≠ Lógica de Negocio

**Regla**: Contextos UX derivados NO deben usarse para lógica de negocio.

**Implicaciones**:
- `frase_motivacional` es solo para display
- `bloque_hito` es solo para display
- No usar estos contextos en condiciones de automatizaciones
- No usar estos contextos en decisiones de acceso

**El registry marca**:
- Contextos UX con `authority.ux: true`
- `authority.source_of_truth: false`
- Advertencia en `notes.constitutional`

---

### 10.4 El Registry Define Significado, NO Valor

**Regla**: El registry define QUÉ es un contexto, NO su valor actual.

**Implicaciones**:
- El registry no calcula valores
- El registry no resuelve contextos
- El registry es catálogo, no motor

**El resolver (futuro)**:
- Calcula valores
- Resuelve contextos
- Usa el registry para saber qué existe

---

### 10.5 El Resolver Decidirá Valores (Futuro)

**Regla**: El Context Resolver (futuro) será responsable de calcular valores.

**Implicaciones**:
- El registry NO calcula valores
- El snapshot proyecta valores (pero no los calcula)
- El resolver calculará valores según el registry

**Flujo futuro**:
1. Registry define qué contextos existen
2. Resolver calcula valores según registry
3. Snapshot proyecta valores del resolver

---

### 10.6 El Snapshot Solo Proyecta

**Regla**: El snapshot es proyección, NO autoridad.

**Implicaciones**:
- El snapshot lee de PostgreSQL
- El snapshot calcula desde PostgreSQL
- El snapshot NO escribe
- El snapshot es inmutable

**El registry**:
- Define qué contextos pueden estar en el snapshot
- No define valores del snapshot

---

### 10.7 PostgreSQL es Soberano

**Regla**: PostgreSQL es el ÚNICO Source of Truth.

**Implicaciones**:
- Contextos que vienen de PostgreSQL tienen `authority.source_of_truth: true`
- Contextos calculados tienen `authority.derived: true`
- Contextos UX tienen `authority.ux: true`
- Solo contextos con `source_of_truth: true` son autoridad

---

## 11. FUERA DE SCOPE

### 11.1 No Define Resolver

**Este documento NO define**:
- Cómo se calculan valores de contextos
- Cómo se resuelven dependencias entre contextos
- Cómo se cachean valores
- Cómo se invalidan valores

**Eso será el Context Resolver (futuro)**.

---

### 11.2 No Define UI

**Este documento NO define**:
- Cómo se muestra el registry en el admin
- Cómo se crean/editan contextos desde UI
- Cómo se validan contextos desde UI

**Eso será el Context Registry UI (futuro)**.

---

### 11.3 No Define BD

**Este documento NO define**:
- Estructura de tablas (aunque puede referenciar `pde_contexts` existente)
- Migraciones SQL
- Índices
- Constraints

**Eso será el Context Registry Schema (futuro)**.

---

### 11.4 No Define Flujos

**Este documento NO define**:
- Flujo de creación de contextos
- Flujo de validación de contextos
- Flujo de deprecación de contextos

**Eso será el Context Registry Workflow (futuro)**.

---

## RESUMEN EJECUTIVO

### Qué es el Context Registry v1

Un **catálogo semántico canónico** que define qué contextos existen en AuriPortal, su significado, autoridad, y quién puede usarlos.

### Qué NO es

- NO ejecuta lógica
- NO muta estado
- NO reemplaza el snapshot
- NO es autoridad (PostgreSQL lo es)

### Por qué existe

- Eliminar ambigüedad
- Permitir descubrimiento
- Facilitar validación
- Preparar para IA
- Reducir deuda técnica
- Escalar con seguridad

### Relación con Sistemas

- **PostgreSQL**: Registry puede vivir en BD, pero PostgreSQL es autoridad
- **Snapshot**: Snapshot proyecta valores, registry define qué existe
- **Paquetes**: Registry valida dependencias de contextos
- **Automatizaciones**: Registry valida contextos en condiciones
- **Themes**: Registry permite themes por contextos semánticos
- **IA**: Registry es input semántico y sistema de validación

### Reglas Constitucionales

1. Ningún contexto existe si no está en el registry
2. Hardcoded ≠ autoridad
3. UX ≠ lógica de negocio
4. El registry define significado, NO valor
5. El resolver decidirá valores (futuro)
6. El snapshot solo proyecta
7. PostgreSQL es soberano

---

**FIN DEL DISEÑO**

Este documento define el Context Registry v1 canónico. La implementación debe seguir este diseño exactamente.

