# CONTEXT SNAPSHOT V1 — DISEÑO CANÓNICO
**AuriPortal · Sistema Unificado de Contexto**

**Fecha**: 2025-01-XX  
**Versión**: 1.0.1  
**Estado**: Diseño (No Implementado)  
**Última actualización**: v1.0.1 - Mejoras documentales y fix de validación

---

## ÍNDICE

1. [Objetivo y Principios](#objetivo-y-principios)
2. [Estructura del Context Snapshot](#estructura-del-context-snapshot)
3. [Campos y Orígenes](#campos-y-orígenes)
4. [Permisos de Lectura](#permisos-de-lectura)
5. [Función de Construcción](#función-de-construcción)
6. [Contrato y Reglas](#contrato-y-reglas)
7. [Ejemplos](#ejemplos)
8. [Impactos Futuros](#impactos-futuros)

---

## OBJETIVO Y PRINCIPIOS

### Objetivo

**Context Snapshot v1** es un snapshot inmutable del contexto completo del sistema en un momento determinado. Proporciona una vista unificada y canónica de todo lo que puede condicionar el comportamiento del sistema (identidad, entorno, tiempo, estado del alumno, contextos PDE, flags, UI).

### Principios Fundamentales

1. **Inmutabilidad**: El snapshot es `Object.freeze()`, nunca se modifica después de construido.
2. **Solo Lectura**: El snapshot es SOLO lectura, no permite mutaciones.
3. **Source of Truth**: PostgreSQL sigue siendo el Source of Truth. El snapshot es una proyección.
4. **Fail-Open**: Si algo falla al construir, devolver valores por defecto seguros (nunca null/undefined donde sea crítico).
5. **Sin Side-Effects**: La construcción del snapshot NO muta estado ni ejecuta lógica de negocio.
6. **Contrato Formal**: Toda función que usa el snapshot debe documentar qué campos necesita y por qué.

---

## ESTRUCTURA DEL CONTEXT SNAPSHOT

```typescript
interface ContextSnapshotV1 {
  // ========================================================================
  // IDENTIDAD (OBLIGATORIO)
  // ========================================================================
  identity: {
    actorType: 'student' | 'admin' | 'anonymous' | 'system';
    actorId: string | null;                    // UUID del alumno SOLO si actorType === 'student', null para admin/anonymous/system (NO es identificador universal)
    email: string | null;                      // Email normalizado, null si no aplica
    isAuthenticated: boolean;
    requestId: string;                         // Trace ID para observabilidad
  };

  // ========================================================================
  // ENTORNO (OBLIGATORIO)
  // ========================================================================
  environment: {
    env: 'dev' | 'beta' | 'prod';             // APP_ENV
    context: 'admin' | 'student' | 'anonymous'; // admin/student según ruta
    screen: string | null;                     // Pantalla actual (ej: 'admin/tecnicas-limpieza', '/enter')
    editor: string | null;                     // Editor actual (ej: 'nav-editor', 'recorridos-editor')
    sidebarContext: 'home' | 'practica' | 'personal' | null; // Contexto del sidebar (solo student)
    navigationZone: 'home' | 'practica' | 'personal' | 'sidebar' | null; // Zone de navegación
  };

  // ========================================================================
  // TIEMPO (OBLIGATORIO)
  // ========================================================================
  time: {
    now: Date;                                 // Timestamp actual
    dayKey: string;                            // YYYY-MM-DD para idempotencia
    timestamp: number;                         // Unix timestamp (ms)
  };

  // ========================================================================
  // ALUMNO (OPCIONAL - solo si actorType === 'student')
  // ========================================================================
  student?: {
    // Identidad
    id: string;                                // UUID del alumno (PostgreSQL)
    email: string;                             // Email normalizado
    
    // Progreso
    nivelEfectivo: number;                     // Nivel efectivo (puede tener overrides)
    nivelBase: number;                         // Nivel base (calculado desde fecha_inscripcion)
    faseEfectiva: {
      id: string;                              // 'sanacion' | 'canalizacion'
      nombre: string;                          // 'Sanación' | 'Canalización'
      reason: string;                          // 'auto' | 'override' | 'fallback'
    };
    nombreNivel: string;                       // Nombre del nivel (ej: 'Sanación - Inicial')
    tieneOverrides: boolean;                   // Si tiene overrides del Master
    
    // Práctica
    streak: number;                            // Racha actual
    todayPracticed: boolean;                   // Si ya practicó hoy
    ultimoDiaConPractica: string | null;      // YYYY-MM-DD o null
    congeladaPorPausa: boolean;                // Si la racha está congelada
    diasCongelados: number;                    // Días congelados
    
    // Suscripción
    suscripcionPausada: boolean;               // Si la suscripción está pausada
    puedePracticar: boolean;                   // Si puede practicar hoy
    
    // Estado adicional (derivado - UX, NO AUTORIDAD)
    // NOTA: Estos campos son DERIVADOS UX y NO deben usarse para lógica de negocio
    // Solo para render, feedback y experiencia de usuario
    fraseMotivacional: string;                 // Frase del sistema con variables dinámicas (DERIVADO UX)
    bloqueHito: string | null;                 // Mensaje de hito si aplica (25, 50, 75, 100, etc.) (DERIVADO UX)
  };

  // ========================================================================
  // CONTEXTOS PDE EXPLÍCITOS (OPCIONAL)
  // ========================================================================
  pdeContexts?: {
    [contextKey: string]: {                    // Clave del contexto (ej: 'nivel_pde', 'tipo_limpieza')
      value: any;                              // Valor según tipo (string | number | boolean | enum | json)
                                                  // NOTA: value debe coincidir SIEMPRE con type. La validación de tipo NO ocurre en el snapshot.
                                                  // Será responsabilidad del futuro Context Registry / Context Resolver.
      type: 'string' | 'number' | 'boolean' | 'enum' | 'json';
      scope: 'system' | 'structural' | 'personal' | 'package';
      kind: 'normal' | 'level';
      injected: boolean;                       // Si el runtime lo inyecta automáticamente
    };
  };

  // ========================================================================
  // FLAGS (OBLIGATORIO)
  // ========================================================================
  flags: {
    [flagName: string]: boolean;               // Estado activo del flag según APP_ENV
  };

  // ========================================================================
  // UI / NAVEGACIÓN (OPCIONAL)
  // ========================================================================
  ui?: {
    currentPath: string;                       // Ruta actual (pathname)
    queryParams: Record<string, string>;       // Query parameters
    sidebarContext: 'home' | 'practica' | 'personal' | null; // Contexto del sidebar (duplicado para conveniencia)
    navigationZone: 'home' | 'practica' | 'personal' | 'sidebar' | null; // Zone de navegación (duplicado)
  };

  // ========================================================================
  // METADATOS (OBLIGATORIO)
  // ========================================================================
  meta: {
    version: '1.0.1';                          // Versión del contrato
    createdAt: Date;                           // Timestamp de creación
    sources: string[];                         // Fuentes de datos usadas (ej: ['PostgreSQL', 'calculate', 'request'])
  };
}
```

---

## CAMPOS Y ORÍGENES

### Campos Obligatorios

| Campo | Origen | Fallback |
|-------|--------|----------|
| `identity.actorType` | `authContext.isAdmin` → 'admin' : 'student' | 'anonymous' |
| `identity.actorId` | `authContext.user.id` (SOLO si actorType === 'student') | `null` (para admin/anonymous/system) |
| `identity.email` | `authContext.user.email` (si student) | `null` |
| `identity.isAuthenticated` | `authContext.isAuthenticated` | `false` |
| `identity.requestId` | `getRequestId()` | `generateUUID()` |
| `environment.env` | `process.env.APP_ENV` | `'prod'` |
| `environment.context` | Ruta (`/admin/*` → 'admin', resto → 'student') | 'anonymous' |
| `environment.screen` | URL pathname (debe estar normalizado: sin query params, sin trailing slash, sin IDs dinámicos, en lowercase) | `null` |
| `environment.editor` | Ruta admin (ej: `/admin/navigation` → 'nav-editor') | `null` |
| `time.now` | `new Date()` | `new Date()` |
| `time.dayKey` | `YYYY-MM-DD` desde `now` | `YYYY-MM-DD` desde `now` |
| `time.timestamp` | `Date.now()` | `Date.now()` |
| `flags.*` | `isFeatureEnabled()` según `APP_ENV` | `false` (seguro por defecto) |
| `meta.version` | Constante `'1.0.1'` | `'1.0.1'` |
| `meta.createdAt` | `new Date()` | `new Date()` |
| `meta.sources` | Array de strings según qué se consultó | `[]` |

### Campos Opcionales

| Campo | Condición | Origen | Fallback |
|-------|-----------|--------|----------|
| `student.*` | `identity.actorType === 'student'` | `studentContext` + cálculos | No incluir si no es student |
| `pdeContexts.*` | Si hay contextos PDE activos | `pde_contexts` (PostgreSQL) | `undefined` (no incluir) |
| `ui.*` | Si se requiere información de UI | `request.url` | `undefined` (no incluir) |
| `environment.sidebarContext` | `identity.actorType === 'student'` | `determineSidebarContext(pathname)` | `null` |
| `environment.navigationZone` | Si se requiere | NavigationDefinition o lógica | `null` |

---

## PERMISOS DE LECTURA

### Regla General

**Todos los campos del snapshot son de SOLO LECTURA**. No hay campos "privados" o "restringidos" en el snapshot mismo. Sin embargo, la **construcción** del snapshot debe respetar permisos:

### Quién Puede Leer Qué

| Consumidor | Puede Leer | No Puede Leer |
|------------|------------|---------------|
| **Endpoints** | Todo el snapshot | N/A (tienen acceso completo) |
| **Paquetes PDE** | `identity.*`, `environment.*`, `time.*`, `pdeContexts.*`, `flags.*` | `student.*` (debe venir como input explícito), acceso directo a PostgreSQL |
| **Automatizaciones** | Todo el snapshot (resuelto en `resolved_context`) | N/A (tienen acceso completo al snapshot resuelto) |
| **Widgets** | `identity.*`, `environment.*`, `time.*`, `pdeContexts.*`, `flags.*`, `ui.*` | `student.*` (debe venir como input explícito), acceso directo a PostgreSQL |
| **Temas (Theme System)** | `identity.*`, `environment.*` (para scopes) | `student.*` (solo si es necesario para user override) |
| **Navegación** | `identity.*`, `student.nivelEfectivo` (si student), `environment.*` | Resto de `student.*` (no necesario) |
| **UI Templates** | Todo el snapshot (para render condicional) | N/A (tienen acceso completo) |

### Principio de Menor Privilegio

- **Paquetes y Widgets NO deben tener acceso directo a PostgreSQL**. Deben recibir datos a través del snapshot o como inputs explícitos.
- **El snapshot es el contrato**: Si un sistema necesita datos, debe venir en el snapshot o ser un input explícito.

---

## FUNCIÓN DE CONSTRUCCIÓN

### Signature

```javascript
/**
 * Construye el Context Snapshot v1 canónico
 * 
 * PRINCIPIOS:
 * - Inmutable (Object.freeze)
 * - Solo lectura (no muta estado)
 * - Fail-open (valores por defecto seguros)
 * - Sin side-effects (no ejecuta lógica de negocio)
 * 
 * @param {Object} params - Parámetros
 * @param {Object} params.authContext - AuthContext (de requireStudentContext/requireAdminContext)
 * @param {Object} [params.studentContext] - StudentContext (de buildStudentContext, solo si student)
 * @param {Request} params.request - Request object (para URL, headers)
 * @param {Object} params.env - Variables de entorno
 * @param {Object} [params.opts] - Opciones
 * @param {boolean} [params.opts.includeUI=false] - Si incluir información de UI
 * @param {boolean} [params.opts.includePDEContexts=false] - Si incluir contextos PDE
 * @returns {Promise<ContextSnapshotV1>} Snapshot inmutable
 */
export async function buildContextSnapshotV1({
  authContext,
  studentContext = null,
  request,
  env,
  opts = {}
}) {
  // ... implementación
}
```

### Implementación Propuesta

```javascript
// src/core/context-snapshot-v1.js

import { getRequestId } from './observability/request-context.js';
import { isFeatureEnabled, getAllFeatureFlags } from './flags/feature-flags.js';
import { determineSidebarContext } from './navigation/sidebar-renderer.js';

/**
 * Construye el Context Snapshot v1 canónico
 */
export async function buildContextSnapshotV1({
  authContext,
  studentContext = null,
  request,
  env,
  opts = {}
}) {
  const { includeUI = false, includePDEContexts = false } = opts;
  
  // Validar authContext
  if (!authContext || typeof authContext.isAuthenticated !== 'boolean') {
    throw new Error('buildContextSnapshotV1: authContext inválido (isAuthenticated requerido)');
  }
  
  // 1. IDENTIDAD
  const actorType = authContext.isAdmin ? 'admin' : 
                   (authContext.isAuthenticated ? 'student' : 'anonymous');
  
  // Construir identity
  // NOTA: actorId SOLO representa ID de alumno si actorType === 'student'
  // Para admin, anonymous y system debe ser null
  // actorId NO es un identificador universal de actor
  const identity = {
    actorType,
    actorId: actorType === 'student' ? (authContext.user?.id || null) : null,
    email: authContext.user?.email || null,
    isAuthenticated: authContext.isAuthenticated || false,
    requestId: authContext.requestId || getRequestId() || generateRequestId()
  };
  
  // 2. ENTORNO
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Determinar context (admin/student)
  const context = pathname.startsWith('/admin') ? 'admin' : 
                 (identity.isAuthenticated ? 'student' : 'anonymous');
  
  // Determinar screen (pathname normalizado)
  // REGLA CONSTITUCIONAL: screen debe estar normalizado (sin query params, sin trailing slash, sin IDs dinámicos, en lowercase)
  // NOTA: La normalización NO se implementa todavía en esta fase. Solo se documenta la regla.
  // Ejemplo futuro: /admin/navigation/:id → 'admin/navigation'
  const screen = pathname === '/' ? null : pathname;
  
  // Determinar editor (solo admin)
  let editor = null;
  if (context === 'admin') {
    if (pathname.includes('/navigation')) editor = 'nav-editor';
    else if (pathname.includes('/recorridos')) editor = 'recorridos-editor';
    else if (pathname.includes('/themes')) editor = 'theme-editor';
    // ... más editors
  }
  
  // Sidebar context (solo student)
  let sidebarContext = null;
  let navigationZone = null;
  if (identity.actorType === 'student') {
    sidebarContext = determineSidebarContext(pathname);
    // navigationZone se determina desde NavigationDefinition (por ahora null)
  }
  
  const environment = {
    env: (process.env.APP_ENV || 'prod'),
    context,
    screen,
    editor,
    sidebarContext,
    navigationZone
  };
  
  // 3. TIEMPO
  const now = new Date();
  const dayKey = now.toISOString().substring(0, 10); // YYYY-MM-DD
  
  const time = {
    now,
    dayKey,
    timestamp: now.getTime()
  };
  
  // 4. ALUMNO (solo si es student y hay studentContext)
  let student = undefined;
  if (identity.actorType === 'student' && studentContext) {
    student = {
      id: studentContext.student?.id || identity.actorId,
      email: identity.email || studentContext.email,
      nivelEfectivo: studentContext.nivelInfo?.nivel_efectivo || studentContext.nivelInfo?.nivel || 1,
      nivelBase: studentContext.nivelInfo?.nivel_base || studentContext.nivelInfo?.nivelAutomatico || 1,
      faseEfectiva: studentContext.nivelInfo?.fase_efectiva || {
        id: 'sanacion',
        nombre: 'Sanación',
        reason: 'fallback'
      },
      nombreNivel: studentContext.nivelInfo?.nombre || 'Sanación - Inicial',
      tieneOverrides: (studentContext.nivelInfo?.overrides_aplicados?.length || 0) > 0,
      streak: studentContext.streakInfo?.streak || 0,
      todayPracticed: studentContext.todayPracticed || studentContext.streakInfo?.todayPracticed || false,
      ultimoDiaConPractica: studentContext.streakInfo?.ultimo_dia_con_practica || null,
      congeladaPorPausa: studentContext.streakInfo?.congelada_por_pausa || false,
      diasCongelados: studentContext.streakInfo?.dias_congelados || 0,
      suscripcionPausada: studentContext.estadoSuscripcion?.pausada || false,
      puedePracticar: studentContext.puedePracticar !== false, // Default true
      fraseMotivacional: studentContext.frase || studentContext.streakInfo?.fraseNivel || '',
      bloqueHito: studentContext.bloqueHito || null
    };
  }
  
  // 5. CONTEXTOS PDE (opcional, solo si se solicita)
  let pdeContexts = undefined;
  if (includePDEContexts) {
    // TODO: Cargar contextos PDE desde PostgreSQL (pde_contexts)
    // Por ahora, vacío
    pdeContexts = {};
  }
  
  // 6. FLAGS
  const allFlags = getAllFeatureFlags();
  const flags = {};
  for (const flagName in allFlags) {
    flags[flagName] = allFlags[flagName].activo; // activo ya está calculado según APP_ENV
  }
  
  // 7. UI (opcional)
  let ui = undefined;
  if (includeUI) {
    const queryParams = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    
    ui = {
      currentPath: pathname,
      queryParams,
      sidebarContext, // Duplicado para conveniencia
      navigationZone // Duplicado
    };
  }
  
  // 8. METADATOS
  const sources = [];
  if (identity.actorType === 'student') sources.push('studentContext');
  if (includePDEContexts) sources.push('PostgreSQL');
  sources.push('calculate'); // Flags, time, etc.
  sources.push('request'); // URL, headers
  
  const meta = {
    version: '1.0.1',
    createdAt: new Date(),
    sources
  };
  
  // Construir snapshot
  const snapshot = {
    identity,
    environment,
    time,
    ...(student && { student }),
    ...(pdeContexts && { pdeContexts }),
    flags,
    ...(ui && { ui }),
    meta
  };
  
  // Hacer inmutable
  return Object.freeze(deepFreeze(snapshot));
}

/**
 * Deep freeze helper
 */
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.keys(obj).forEach(key => {
    if (obj[key] !== null && typeof obj[key] === 'object' && !Object.isFrozen(obj[key])) {
      deepFreeze(obj[key]);
    }
  });
  return obj;
}

/**
 * Generate request ID fallback
 * 
 * NOTA: Uso solo como fallback extremo cuando getRequestId() no está disponible.
 * Math.random() nunca afecta lógica de negocio y no se propaga fuera del snapshot.
 * Este ID es solo para observabilidad interna del snapshot.
 */
function generateRequestId() {
  return `snapshot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
```

---

## CONTRATO Y REGLAS

### Contrato del Context Snapshot

1. **Inmutabilidad**: El snapshot es `Object.freeze()`. Cualquier intento de modificación fallará silenciosamente (en strict mode lanzará error).

2. **Versionado**: El campo `meta.version` identifica la versión del contrato. Cambios breaking requieren nueva versión.

3. **Fail-Open**: Si algo falla al construir, usar valores por defecto seguros. Nunca lanzar error (a menos que sea crítico como falta de `authContext`).

4. **Sin Side-Effects**: La construcción NO debe:
   - Mutar estado
   - Ejecutar lógica de negocio (solo lectura/agregación)
   - Hacer llamadas a APIs externas (solo PostgreSQL si es necesario)

5. **Source of Truth**: PostgreSQL es el Source of Truth. El snapshot es una proyección/agregación, no autoridad.

### Reglas Constitucionales

1. **PostgreSQL es Soberano**: El snapshot lee de PostgreSQL, nunca escribe.
2. **Sin Hardcoded como Autoridad**: Valores hardcodeados solo para fallbacks, nunca como autoridad de negocio.
3. **Observabilidad Obligatoria**: El `requestId` debe propagarse para tracing.
4. **Fail-Open Absoluto**: Si algo falla, continuar con valores por defecto seguros.
5. **Semántica de actorId**: `identity.actorId` SOLO representa ID de alumno si `actorType === 'student'`. Para admin, anonymous y system debe ser `null`. No es un identificador universal de actor.
6. **Normalización de screen**: `environment.screen` debe estar normalizado (sin query params, sin trailing slash, sin IDs dinámicos, en lowercase). La normalización se implementará en fases futuras.
7. **Campos UX Derivados**: Los campos `student.fraseMotivacional` y `student.bloqueHito` son DERIVADOS UX y NO deben usarse para lógica de negocio. Solo para render, feedback y experiencia de usuario.

---

## EJEMPLOS

### Ejemplo 1: Snapshot para Student en /enter

```javascript
{
  identity: {
    actorType: 'student',
    actorId: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alumno@ejemplo.com',
    isAuthenticated: true,
    requestId: 'req-1234567890-abc'
  },
  environment: {
    env: 'prod',
    context: 'student',
    screen: '/enter',
    editor: null,
    sidebarContext: 'home',
    navigationZone: null
  },
  time: {
    now: new Date('2025-01-20T10:30:00.000Z'),
    dayKey: '2025-01-20',
    timestamp: 1737367800000
  },
  student: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alumno@ejemplo.com',
    nivelEfectivo: 5,
    nivelBase: 5,
    faseEfectiva: {
      id: 'sanacion',
      nombre: 'Sanación',
      reason: 'auto'
    },
    nombreNivel: 'Sanación - Nivel 5',
    tieneOverrides: false,
    streak: 42,
    todayPracticed: false,
    ultimoDiaConPractica: '2025-01-19',
    congeladaPorPausa: false,
    diasCongelados: 0,
    suscripcionPausada: false,
    puedePracticar: true,
    fraseMotivacional: 'Tu energía ya sostiene un ritmo sagrado.',
    bloqueHito: null
  },
  flags: {
    progress_v4: false,
    dias_activos_v2: true,
    nivel_calculo_v2: false,
    // ... más flags
  },
  meta: {
    version: '1.0.0',
    createdAt: new Date('2025-01-20T10:30:00.000Z'),
    sources: ['studentContext', 'calculate', 'request']
  }
}
```

### Ejemplo 2: Snapshot para Admin en /admin/navigation

```javascript
{
  identity: {
    actorType: 'admin',
    actorId: null,
    email: null,
    isAuthenticated: true,
    requestId: 'req-1234567891-def'
  },
  environment: {
    env: 'prod',
    context: 'admin',
    screen: '/admin/navigation',
    editor: 'nav-editor',
    sidebarContext: null,
    navigationZone: null
  },
  time: {
    now: new Date('2025-01-20T10:31:00.000Z'),
    dayKey: '2025-01-20',
    timestamp: 1737367860000
  },
  flags: {
    progress_v4: false,
    dias_activos_v2: true,
    navigation_editor_v1: true,
    // ... más flags
  },
  meta: {
    version: '1.0.0',
    createdAt: new Date('2025-01-20T10:31:00.000Z'),
    sources: ['calculate', 'request']
  }
}
```

### Ejemplo 3: Snapshot para Anonymous (sin autenticación)

```javascript
{
  identity: {
    actorType: 'anonymous',
    actorId: null,
    email: null,
    isAuthenticated: false,
    requestId: 'req-1234567892-ghi'
  },
  environment: {
    env: 'prod',
    context: 'anonymous',
    screen: '/',
    editor: null,
    sidebarContext: null,
    navigationZone: null
  },
  time: {
    now: new Date('2025-01-20T10:32:00.000Z'),
    dayKey: '2025-01-20',
    timestamp: 1737367920000
  },
  flags: {
    progress_v4: false,
    dias_activos_v2: true,
    // ... más flags
  },
  meta: {
    version: '1.0.0',
    createdAt: new Date('2025-01-20T10:32:00.000Z'),
    sources: ['calculate', 'request']
  }
}
```

---

## IMPACTOS FUTUROS

### Sistemas que Usarán el Snapshot

1. **Paquetes PDE**:
   - Recibirán snapshot como input
   - Podrán leer `identity.*`, `environment.*`, `time.*`, `pdeContexts.*`, `flags.*`
   - NO tendrán acceso directo a `student.*` (debe venir como input explícito si necesario)

2. **Automatizaciones**:
   - El `resolved_context` en ejecuciones será el snapshot
   - Condiciones podrán evaluar cualquier campo del snapshot

3. **Widgets**:
   - Recibirán snapshot como input
   - Similar a paquetes, sin acceso directo a PostgreSQL

4. **Temas (Theme System)**:
   - Usarán `environment.*` para scopes
   - Podrán usar `identity.*` para user override

5. **Navegación**:
   - Usarán `student.nivelEfectivo` para filtrar items
   - Usarán `environment.navigationZone` para filtrar por zone

6. **UI Templates**:
   - Recibirán snapshot completo para render condicional
   - Reemplazará pasar `ctx` disperso

### Migraciones Futuras (NO Implementar Ahora)

1. **Refactorizar `buildStudentContext`**:
   - `buildStudentContext` debería usar `buildContextSnapshotV1` internamente
   - Mantener compatibilidad hacia atrás

2. **Refactorizar Endpoints**:
   - Endpoints deberían recibir snapshot en lugar de `authContext` + `studentContext` dispersos
   - Migración gradual

3. **Refactorizar Paquetes**:
   - Paquetes deberían recibir snapshot como input estándar
   - Remover acceso directo a PostgreSQL

4. **Refactorizar Widgets**:
   - Similar a paquetes

5. **Refactorizar Automatizaciones**:
   - `resolved_context` debería ser siempre un snapshot completo

### Deuda Técnica a Resolver

1. **Contextos PDE No Cargados**:
   - `includePDEContexts` está implementado pero no carga contextos reales
   - Necesita integración con `pde_contexts` (PostgreSQL)

2. **Navigation Zone No Determinado**:
   - `navigationZone` está como `null`
   - Necesita integración con NavigationDefinition

3. **Editor Detection Limitado**:
   - Solo detecta algunos editors
   - Necesita registry completo de editors

4. **StudentContext Duplicación**:
   - El snapshot duplica datos de StudentContext
   - Migración futura: StudentContext debería usar snapshot internamente

---

## NOTAS DE IMPLEMENTACIÓN

### Orden de Implementación Recomendado

1. **Fase 1: Implementar función base** (sin contextos PDE ni UI opcionales)
   - Función `buildContextSnapshotV1()`
   - Tests unitarios
   - Documentación

2. **Fase 2: Integrar contextos PDE** (opcional)
   - Cargar desde `pde_contexts` (PostgreSQL)
   - Tests de integración

3. **Fase 3: Integrar UI opcional**
   - Añadir `includeUI` opción
   - Tests

4. **Fase 4: Usar en sistemas nuevos** (sin refactorizar existentes)
   - Paquetes nuevos usan snapshot
   - Widgets nuevos usan snapshot
   - Automatizaciones nuevas usan snapshot

5. **Fase 5: Migración gradual** (futuro)
   - Refactorizar sistemas existentes para usar snapshot
   - Mantener compatibilidad hacia atrás

### Testing

```javascript
// Ejemplo de test
describe('buildContextSnapshotV1', () => {
  it('debe crear snapshot inmutable para student', async () => {
    const authContext = { isAdmin: false, isAuthenticated: true, user: { id: '123', email: 'test@test.com' }, requestId: 'req-1' };
    const studentContext = { /* ... */ };
    const request = new Request('https://example.com/enter');
    
    const snapshot = await buildContextSnapshotV1({ authContext, studentContext, request, env: {} });
    
    // Verificar inmutabilidad
    expect(() => { snapshot.identity.actorType = 'admin'; }).toThrow();
    
    // Verificar estructura
    expect(snapshot.identity.actorType).toBe('student');
    expect(snapshot.student).toBeDefined();
    expect(snapshot.meta.version).toBe('1.0.0');
  });
});
```

---

**FIN DEL DISEÑO**

Este documento define el contrato canónico del Context Snapshot v1. La implementación debe seguir este diseño exactamente.
