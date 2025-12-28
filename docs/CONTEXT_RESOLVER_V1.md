# CONTEXT RESOLVER V1 — DISEÑO CANÓNICO
**AuriPortal · Sistema de Resolución de Contextos**

**Fecha**: 2025-01-XX  
**Versión**: 1.0.0  
**Estado**: Diseño (No Implementado)

---

## ÍNDICE

1. [Definición del Context Resolver](#1-definición-del-context-resolver)
2. [Concepto Clave: ExecutionContext](#2-concepto-clave-executioncontext)
3. [Precedencia Canónica](#3-precedencia-canónica)
4. [Contrato de Resolución: ContextRequest](#4-contrato-de-resolución-contextrequest)
5. [Salida: ResolvedContext + Provenance](#5-salida-resolvedcontext--provenance)
6. [Validación](#6-validación)
7. [Accesos y Permisos](#7-accesos-y-permisos)
8. [Integración con Paquetes PDE](#8-integración-con-paquetes-pde)
9. [Integración con Automatizaciones](#9-integración-con-automatizaciones)
10. [Modo Debug](#10-modo-debug)
11. [Fuera de Scope](#11-fuera-de-scope)

---

## 1. DEFINICIÓN DEL CONTEXT RESOLVER

### 1.1 ¿Qué es el Context Resolver?

El **Context Resolver v1** es un sistema que **resuelve (calcula/proporciona) los valores de los contextos** para una ejecución concreta de un paquete, widget o automatización.

**Produce**: Un objeto `resolved_context` que es un mapa final de contextos "usables" para esa ejecución específica.

**Características**:
- **Determinista**: Mismo input → mismo output
- **Validado**: Valida contra Context Registry (tipos, enums, existencia)
- **Auditable**: Incluye provenance (de dónde vino cada valor)
- **Observable**: Trazable con requestId
- **Fail-Open**: Nunca falla, siempre devuelve valores seguros

---

### 1.2 ¿Qué NO es el Context Resolver?

El Context Resolver:

- ❌ **NO es autoridad**: PostgreSQL sigue siendo Source of Truth
- ❌ **NO muta estado**: Solo lee y calcula, nunca escribe
- ❌ **NO reemplaza el snapshot**: El snapshot es proyección, el resolver es resolución para ejecución
- ❌ **NO define qué contextos existen**: Eso es el Context Registry
- ❌ **NO es un motor de reglas**: No ejecuta lógica de negocio, solo resuelve valores
- ❌ **NO cachea valores**: Cache es responsabilidad futura (no en esta fase)

---

### 1.3 ¿Por qué existe?

El Context Resolver existe para resolver la pregunta: **"¿Cuándo un paquete (o widget, o automatización) toma un contexto?"**

**Problema sin resolver**:
- Un paquete declara que necesita `nivel_efectivo` y `tipo_limpieza`
- ¿De dónde vienen estos valores?
- ¿Qué pasa si hay conflictos (ej: input del usuario vs snapshot)?
- ¿Cómo se valida que los valores son correctos?

**Solución del resolver**:
- Define precedencia clara (quién gana cuando hay conflicto)
- Valida contra registry
- Proporciona provenance para debugging
- Es determinista y auditable

---

### 1.4 Relación con Otros Sistemas

#### 1.4.1 Context Registry

**Registry define QUÉ existe**:
- Catálogo de contextos disponibles
- Semántica, tipos, valores permitidos
- Autoridad, scope, temporalidad

**Resolver usa Registry para**:
- Validar que contextos existen
- Validar tipos y valores
- Saber de dónde viene cada contexto (source)
- Aplicar defaults

**Relación**: Registry es catálogo, Resolver es motor.

---

#### 1.4.2 Context Snapshot v1

**Snapshot proyecta valores**:
- Proyección inmutable del estado del sistema
- Incluye contextos del alumno, entorno, flags
- Se construye una vez por request

**Resolver usa Snapshot para**:
- Leer valores de contextos que están en el snapshot
- Aplicar precedencia (inputs explícitos ganan sobre snapshot)
- Combinar snapshot + inputs + defaults

**Relación**: Snapshot es proyección, Resolver resuelve para ejecución específica.

---

#### 1.4.3 Paquetes PDE

**Paquetes declaran dependencias**:
- `context_contract.inputs`: Contextos que necesitan
- Pueden tener defaults
- Pueden tener `context_rules` (condiciones)

**Resolver proporciona valores**:
- Resuelve todos los contextos requeridos
- Aplica precedencia (inputs explícitos > defaults > snapshot)
- Valida tipos y valores

**Relación**: Paquetes consumen, Resolver proporciona.

---

#### 1.4.4 Automatizaciones

**Automatizaciones evalúan condiciones**:
- Condiciones usan contextos (ej: `nivel_efectivo >= 5`)
- Necesitan valores resueltos para evaluar

**Resolver proporciona valores**:
- Resuelve contextos usados en condiciones
- Proporciona provenance para auditoría

**Relación**: Automatizaciones evalúan, Resolver resuelve.

---

## 2. CONCEPTO CLAVE: EXECUTIONCONTEXT

### 2.1 ¿Qué es un ExecutionContext?

Un **ExecutionContext** es una entidad conceptual (NO una tabla de BD) que representa una ejecución concreta que necesita contextos resueltos.

**Tipos de ExecutionContext**:

1. **`package_run`**: Ejecución de un paquete PDE
2. **`widget_render`**: Renderizado de un widget
3. **`automation_eval`**: Evaluación de condiciones de una automatización

**Cada ExecutionContext define**:
- `actor`: Quién ejecuta (student/admin/system)
- `target`: Qué se ejecuta (package_key, widget_key, automation_key)
- `inputs`: Inputs explícitos (user inputs, widget props, etc.)
- `snapshot`: Context Snapshot v1 (inmutable)
- `env`: Variables de entorno
- `flags`: Feature flags activos
- `time`: Información temporal

---

### 2.2 Estructura Conceptual del ExecutionContext

```typescript
interface ExecutionContext {
  // ========================================================================
  // IDENTIFICACIÓN
  // ========================================================================
  executionType: 'package_run' | 'widget_render' | 'automation_eval';
  executionId: string;                          // ID único de esta ejecución (UUID)
  requestId: string;                            // Trace ID para observabilidad
  
  // ========================================================================
  // ACTOR
  // ========================================================================
  actor: {
    type: 'student' | 'admin' | 'anonymous' | 'system';
    id: string | null;                          // UUID del alumno si type === 'student'
    email: string | null;                       // Email si aplica
  };
  
  // ========================================================================
  // TARGET (QUÉ SE EJECUTA)
  // ========================================================================
  target: {
    type: 'package' | 'widget' | 'automation';
    key: string;                                // package_key, widget_key, automation_key
    definition?: object;                        // Definición del target (opcional, para validación)
  };
  
  // ========================================================================
  // INPUTS EXPLÍCITOS
  // ========================================================================
  inputs: {
    [context_key: string]: any;                 // Inputs explícitos (user inputs, widget props, etc.)
  };
  
  // ========================================================================
  // SNAPSHOT (INMUTABLE)
  // ========================================================================
  snapshot: ContextSnapshotV1;                  // Snapshot completo (inmutable)
  
  // ========================================================================
  // ENTORNO Y FLAGS
  // ========================================================================
  env: {
    app_env: 'dev' | 'beta' | 'prod';
    // ... más variables de entorno si necesario
  };
  
  flags: {
    [flagName: string]: boolean;                // Feature flags activos
  };
  
  // ========================================================================
  // TIEMPO
  // ========================================================================
  time: {
    now: Date;
    dayKey: string;                             // YYYY-MM-DD
    timestamp: number;
  };
  
  // ========================================================================
  // METADATOS
  // ========================================================================
  meta: {
    createdAt: Date;
    purpose: 'package' | 'widget' | 'automation' | 'theme';
  };
}
```

---

### 2.3 Ejemplos de ExecutionContext

#### Ejemplo 1: Package Run

```javascript
{
  executionType: 'package_run',
  executionId: 'exec-1234567890-abc',
  requestId: 'req-1234567890-xyz',
  actor: {
    type: 'student',
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alumno@ejemplo.com'
  },
  target: {
    type: 'package',
    key: 'tecnicas-limpieza-nivel-5',
    definition: { /* package definition */ }
  },
  inputs: {
    tipo_limpieza: 'completa'  // Input explícito del usuario
  },
  snapshot: { /* Context Snapshot v1 */ },
  env: { app_env: 'prod' },
  flags: { progress_v4: false, /* ... */ },
  time: {
    now: new Date('2025-01-20T10:30:00.000Z'),
    dayKey: '2025-01-20',
    timestamp: 1737367800000
  },
  meta: {
    createdAt: new Date('2025-01-20T10:30:00.000Z'),
    purpose: 'package'
  }
}
```

#### Ejemplo 2: Widget Render

```javascript
{
  executionType: 'widget_render',
  executionId: 'exec-1234567891-def',
  requestId: 'req-1234567890-xyz',
  actor: {
    type: 'student',
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alumno@ejemplo.com'
  },
  target: {
    type: 'widget',
    key: 'widget-tecnicas-lista',
    definition: { /* widget definition */ }
  },
  inputs: {
    tema_id: 'tema1'  // Prop del widget
  },
  snapshot: { /* Context Snapshot v1 */ },
  env: { app_env: 'prod' },
  flags: { /* ... */ },
  time: { /* ... */ },
  meta: {
    createdAt: new Date('2025-01-20T10:31:00.000Z'),
    purpose: 'widget'
  }
}
```

#### Ejemplo 3: Automation Eval

```javascript
{
  executionType: 'automation_eval',
  executionId: 'exec-1234567892-ghi',
  requestId: 'req-1234567890-xyz',
  actor: {
    type: 'system',
    id: null,
    email: null
  },
  target: {
    type: 'automation',
    key: 'streak_milestone_email',
    definition: { /* automation definition */ }
  },
  inputs: {
    // Puede haber inputs si la automatización los requiere
  },
  snapshot: { /* Context Snapshot v1 (con student) */ },
  env: { app_env: 'prod' },
  flags: { /* ... */ },
  time: { /* ... */ },
  meta: {
    createdAt: new Date('2025-01-20T10:32:00.000Z'),
    purpose: 'automation'
  }
}
```

---

## 3. PRECEDENCIA CANÓNICA

### 3.1 Regla Fundamental

La **Precedencia Canónica** define el orden final de resolución de valores cuando hay múltiples fuentes posibles para un contexto.

**Principio**: **Mayor precedencia = mayor prioridad**. Si un contexto tiene valor en un nivel de mayor precedencia, ese valor se usa y se ignora el resto.

---

### 3.2 Orden de Precedencia (Mayor → Menor)

#### Nivel 0: Valores Bloqueados por Seguridad (Si Aplica)

**Precedencia**: **MÁXIMA** (si existe)

**Cuándo aplica**: Solo en casos excepcionales de seguridad.

**Ejemplo**: Si un contexto está bloqueado por política de seguridad, ese valor se usa sin importar nada más.

**Implementación**: Por ahora, no aplica. Dejar el hueco para futuras necesidades.

---

#### Nivel 1: Inputs Explícitos de la Ejecución

**Precedencia**: **MÁXIMA** (normal)

**Fuente**: `executionContext.inputs`

**Ejemplos**:
- Input del usuario en paquete: `{ tipo_limpieza: 'completa' }`
- Props del widget: `{ tema_id: 'tema1' }`
- Inputs de automatización (si los hay)

**Justificación**: El usuario/llamador tiene control explícito sobre estos valores. Deben ganar sobre todo lo demás.

---

#### Nivel 2: Contextos "Package Scope" Declarados en el Contrato del Paquete

**Precedencia**: **ALTA**

**Fuente**: `pde_packages.definition.context_contract.inputs[].default`

**Cuándo aplica**: Solo para paquetes, solo para contextos con `scope: 'package'`.

**Ejemplo**:
```json
{
  "context_contract": {
    "inputs": [
      {
        "key": "tipo_limpieza",
        "default": "rapida"  // ← Este es el default del paquete
      }
    ]
  }
}
```

**Justificación**: El paquete define defaults específicos para su contexto. Estos defaults son más específicos que los defaults globales del registry.

---

#### Nivel 3: PDE Contexts Persistentes (pde_contexts)

**Precedencia**: **MEDIA-ALTA**

**Fuente**: PostgreSQL (`pde_contexts` table) → valores persistentes

**Cuándo aplica**: Solo para contextos que tienen valores almacenados en `pde_contexts`.

**Ejemplo**: Si `temporada` tiene valor 'navidad' en `pde_contexts`, se usa ese valor.

**Justificación**: Estos valores son persistentes y específicos del sistema. Son más específicos que valores del snapshot (que pueden cambiar por request).

**Nota**: Por ahora, `pde_contexts` puede no tener valores almacenados. En ese caso, se salta este nivel.

---

#### Nivel 4: Snapshot Fields (Student, Env, Flags, Identity)

**Precedencia**: **MEDIA**

**Fuente**: `executionContext.snapshot`

**Campos incluidos**:
- `snapshot.identity.*` (actorType, actorId, email, isAuthenticated)
- `snapshot.environment.*` (env, context, screen, editor, etc.)
- `snapshot.student.*` (si `actorType === 'student'`)
- `snapshot.flags.*`
- `snapshot.pdeContexts.*` (si existen)

**Mapeo**: Los campos del snapshot se mapean a `context_key` según el registry.

**Ejemplos**:
- `snapshot.student.nivelEfectivo` → `nivel_efectivo`
- `snapshot.environment.env` → `app_env`
- `snapshot.flags.progress_v4` → `flag_progress_v4`

**Justificación**: El snapshot es una proyección completa del estado del sistema. Es confiable pero puede ser sobrescrito por inputs explícitos.

---

#### Nivel 5: Derived Contexts (Calculados)

**Precedencia**: **MEDIA-BAJA**

**Fuente**: Cálculo desde otros contextos ya resueltos

**Cuándo aplica**: Solo si el contexto está marcado como `authority.derived: true` en el registry.

**Dependencias**: El contexto debe declarar `source.calculation.dependencies` en el registry.

**Ejemplo**:
- `dias_desde_inscripcion`: Calculado desde `fecha_inscripcion` (del snapshot) y `time_now`
- `es_hito`: Calculado desde `streak` (si streak es 25, 50, 75, 100, etc.)

**Justificación**: Los contextos derivados se calculan desde otros contextos. Solo se calculan si no hay valores en niveles superiores.

**Restricción**: Los contextos derivados NO pueden depender de otros contextos derivados (evita ciclos). Se validará en registry.

---

#### Nivel 6: Fallbacks Seguros (Registry Default Value)

**Precedencia**: **BAJA**

**Fuente**: `ContextRegistry[context_key].default_value`

**Cuándo aplica**: Solo si el contexto tiene `default_value` definido en el registry.

**Ejemplo**:
- Si `tipo_limpieza` tiene `default_value: 'rapida'` en el registry, se usa ese valor si no hay nada más.

**Justificación**: El registry define valores por defecto seguros. Son el último recurso antes de fail-open.

---

#### Nivel 7: Fail-Open con Defaults Seguros

**Precedencia**: **MÍNIMA** (solo si todo lo demás falla)

**Cuándo aplica**: Si un contexto requerido no tiene valor en ningún nivel superior.

**Valores por defecto seguros**:
- `string`: `''` (string vacío)
- `number`: `0`
- `boolean`: `false`
- `enum`: Primer valor de `allowed_values` (si existe)
- `json`: `{}` (objeto vacío)

**Warnings**: Se registra warning en provenance indicando que se usó fail-open.

**Justificación**: **Nunca crash en runtime student**. Fail-open absoluto con valores seguros.

**Restricción**: Si un contexto es `required: true` en el contract y no tiene valor, se registra warning pero se usa default seguro (nunca falla).

---

### 3.3 Justificación del Orden (Regla Constitucional)

**Principio**: **Control explícito > Específico > Global > Calculado > Default**

1. **Inputs explícitos (Nivel 1)**: El usuario/llamador tiene control explícito
2. **Defaults de paquete (Nivel 2)**: Específicos del paquete, más específicos que globales
3. **PDE Contexts persistentes (Nivel 3)**: Valores persistentes del sistema
4. **Snapshot (Nivel 4)**: Proyección completa pero genérica
5. **Derivados (Nivel 5)**: Calculados, pueden cambiar
6. **Registry defaults (Nivel 6)**: Defaults globales
7. **Fail-open (Nivel 7)**: Último recurso, nunca falla

**Esta precedencia es CONSTITUCIONAL**: No se puede cambiar sin justificación explícita.

---

## 4. CONTRATO DE RESOLUCIÓN: CONTEXTREQUEST

### 4.1 ¿Qué es un ContextRequest?

Un **ContextRequest** es un objeto conceptual que define qué contextos se necesitan resolver para una ejecución.

**Producido por**: El target (paquete, widget, automatización) que declara qué contextos necesita.

**Consumido por**: El Context Resolver que resuelve los valores.

---

### 4.2 Estructura del ContextRequest

```typescript
interface ContextRequest {
  // ========================================================================
  // CONTEXTOS REQUERIDOS
  // ========================================================================
  required: string[];                            // Array de context_keys requeridos
  
  // ========================================================================
  // CONTEXTOS OPCIONALES
  // ========================================================================
  optional?: string[];                           // Array de context_keys opcionales
  
  // ========================================================================
  // PROPÓSITO
  // ========================================================================
  purpose: 'package' | 'widget' | 'automation' | 'theme';
  
  // ========================================================================
  // RESTRICCIONES DE ACCESO
  // ========================================================================
  include?: {
    snapshotPaths?: string[];                    // Paths del snapshot permitidos (ej: ['student.*', 'environment.*'])
    pdeContexts?: boolean;                       // Si incluir contextos PDE persistentes
    derived?: boolean;                           // Si incluir contextos derivados
    flags?: boolean;                             // Si incluir flags
  };
  
  // ========================================================================
  // METADATOS
  // ========================================================================
  meta: {
    targetKey: string;                           // package_key, widget_key, automation_key
    targetType: 'package' | 'widget' | 'automation' | 'theme';
    requestId: string;                           // Trace ID
  };
}
```

---

### 4.3 Ejemplos de ContextRequest

#### Ejemplo 1: Paquete PDE

```javascript
{
  required: ['nivel_efectivo', 'tipo_limpieza'],
  optional: ['temporada'],
  purpose: 'package',
  include: {
    snapshotPaths: ['student.*', 'environment.*', 'time.*'],
    pdeContexts: true,
    derived: true,
    flags: false
  },
  meta: {
    targetKey: 'tecnicas-limpieza-nivel-5',
    targetType: 'package',
    requestId: 'req-1234567890-xyz'
  }
}
```

#### Ejemplo 2: Widget

```javascript
{
  required: ['alumno_id', 'tema_id'],
  optional: ['nivel_efectivo'],
  purpose: 'widget',
  include: {
    snapshotPaths: ['student.id', 'student.email'],
    pdeContexts: false,
    derived: false,
    flags: true
  },
  meta: {
    targetKey: 'widget-tecnicas-lista',
    targetType: 'widget',
    requestId: 'req-1234567891-abc'
  }
}
```

#### Ejemplo 3: Automatización

```javascript
{
  required: ['nivel_efectivo', 'streak', 'suscripcion_pausada'],
  optional: [],
  purpose: 'automation',
  include: {
    snapshotPaths: ['student.*', 'flags.*'],
    pdeContexts: false,
    derived: true,
    flags: true
  },
  meta: {
    targetKey: 'streak_milestone_email',
    targetType: 'automation',
    requestId: 'req-1234567892-def'
  }
}
```

---

### 4.4 Generación del ContextRequest

**Para Paquetes**:
- Se genera desde `pde_packages.definition.context_contract.inputs`
- `required`: Inputs con `required: true`
- `optional`: Inputs con `required: false` o sin `required`
- `include`: Configurado según permisos del paquete

**Para Widgets**:
- Se genera desde `pde_widgets.prompt_context_json.inputs`
- Similar a paquetes

**Para Automatizaciones**:
- Se genera desde `pde_automations.definition.conditions`
- Extrae todos los `context_key` usados en condiciones
- Todos son `required` (si falta uno, la condición no se puede evaluar)

---

## 5. SALIDA: RESOLVEDCONTEXT + PROVENANCE

### 5.1 Estructura del ResolvedContext

```typescript
interface ResolvedContext {
  // ========================================================================
  // CONTEXTOS RESUELTOS
  // ========================================================================
  resolved: {
    [context_key: string]: any;                  // Valores resueltos según tipo
  };
  
  // ========================================================================
  // METADATOS
  // ========================================================================
  meta: {
    version: '1.0.0';                            // Versión del contrato
    createdAt: Date;                             // Timestamp de resolución
    requestId: string;                           // Trace ID
    executionId: string;                         // ID de la ejecución
    purpose: 'package' | 'widget' | 'automation' | 'theme';
  };
  
  // ========================================================================
  // PROVENANCE (MUY IMPORTANTE)
  // ========================================================================
  provenance: {
    [context_key: string]: {
      source: 'input' | 'package_default' | 'pde_context' | 'snapshot' | 'derived' | 'registry_default' | 'fail_open';
      path?: string;                             // Path específico (ej: 'snapshot.student.nivelEfectivo')
      precedence_level: number;                  // Nivel de precedencia usado (0-7)
      value_before?: any;                        // Valor antes de aplicar esta fuente (para debug)
      notes?: string[];                          // Notas adicionales
      warnings?: string[];                       // Warnings (ej: 'Used fail-open default')
    };
  };
}
```

---

### 5.2 Ejemplo de ResolvedContext

```javascript
{
  resolved: {
    nivel_efectivo: 5,
    tipo_limpieza: 'completa',
    temporada: 'navidad',
    alumno_id: '550e8400-e29b-41d4-a716-446655440000',
    app_env: 'prod'
  },
  meta: {
    version: '1.0.0',
    createdAt: new Date('2025-01-20T10:30:00.000Z'),
    requestId: 'req-1234567890-xyz',
    executionId: 'exec-1234567890-abc',
    purpose: 'package'
  },
  provenance: {
    nivel_efectivo: {
      source: 'snapshot',
      path: 'snapshot.student.nivelEfectivo',
      precedence_level: 4,
      notes: ['Mapped from snapshot.student.nivelEfectivo']
    },
    tipo_limpieza: {
      source: 'input',
      path: 'executionContext.inputs.tipo_limpieza',
      precedence_level: 1,
      value_before: null,
      notes: ['Explicit input from user']
    },
    temporada: {
      source: 'pde_context',
      path: 'pde_contexts.temporada.value',
      precedence_level: 3,
      notes: ['Persistent value from pde_contexts table']
    },
    alumno_id: {
      source: 'snapshot',
      path: 'snapshot.identity.actorId',
      precedence_level: 4,
      notes: ['Mapped from snapshot.identity.actorId (only if actorType === student)']
    },
    app_env: {
      source: 'snapshot',
      path: 'snapshot.environment.env',
      precedence_level: 4,
      notes: ['Mapped from snapshot.environment.env']
    }
  }
}
```

---

### 5.3 Importancia de la Provenance

**La provenance es CRÍTICA porque**:

1. **Debugging**: Permite saber de dónde vino cada valor
2. **Auditoría**: Permite auditar por qué una automatización se disparó
3. **UI Debug**: Permite mostrar en UI de admin "de dónde vino este valor"
4. **Troubleshooting**: Permite diagnosticar problemas de resolución

**Ejemplo de uso futuro**:
- Admin ve: "¿Por qué este paquete usó `tipo_limpieza: 'rapida'`?"
- Sistema muestra: "Provenance: `registry_default`, precedence_level: 6, porque no había input explícito ni valor en snapshot"

---

## 6. VALIDACIÓN

### 6.1 Validaciones Obligatorias

El Context Resolver valida contra el Context Registry:

#### 6.1.1 Existencia de Context Key

**Validación**: El `context_key` debe existir en el registry.

**Si falla**: 
- Warning en provenance
- Usa fail-open default (nunca falla)
- Registra error en logs (no bloquea ejecución)

---

#### 6.1.2 Type Checking

**Validación**: El valor resuelto debe coincidir con `type` del registry.

**Tipos válidos**:
- `string`: typeof value === 'string'
- `number`: typeof value === 'number' && !isNaN(value)
- `boolean`: typeof value === 'boolean'
- `enum`: value está en `allowed_values`
- `json`: typeof value === 'object' (incluye arrays)

**Si falla**:
- Intenta coerción si es seguro (ver 6.2)
- Si no es seguro, warning + fail-open default

---

#### 6.1.3 Enum Allowed Values

**Validación**: Si `type === 'enum'`, el valor debe estar en `allowed_values`.

**Si falla**:
- Warning en provenance
- Usa `default_value` del registry (si existe)
- Si no hay default, usa primer valor de `allowed_values`
- Nunca falla (fail-open)

---

#### 6.1.4 Coerciones Permitidas

**Regla Constitucional**: Las coerciones son PERMITIDAS pero solo si son seguras y explícitas.

**Coerciones permitidas**:
- `"5"` (string) → `5` (number): ✅ SÍ (si type === 'number')
- `"true"` (string) → `true` (boolean): ✅ SÍ (si type === 'boolean')
- `5` (number) → `"5"` (string): ❌ NO (pérdida de información)
- `"rapida"` (string) → `'rapida'` (enum): ✅ SÍ (si está en allowed_values)

**Regla**: Solo coerciones que NO pierden información.

**Nota en provenance**: Si se aplicó coerción, se registra en `notes`.

---

#### 6.1.5 Campos UX: Prohibidos para Decisiones de Negocio

**Validación**: Si `authority.ux: true`, el contexto NO debe usarse en condiciones de automatizaciones.

**Si se viola**:
- Warning en provenance
- Error en logs
- **NO bloquea ejecución** (fail-open)
- Se registra en auditoría

**Justificación**: Los campos UX son solo para display, no para lógica de negocio.

---

#### 6.1.6 Hardcoded Contexts: Warnings Obligatorios

**Validación**: Si `source.hardcoded` está definido, se registra warning obligatorio.

**Warning**: 
```
"Context 'nivel_thresholds' is hardcoded at 'src/modules/nivel.js'. 
Should be migrated to PostgreSQL as Source of Truth. 
See registry notes for migration plan."
```

**No bloquea**: Solo warning, no falla.

---

### 6.2 Validaciones Opcionales (Debug Mode)

En modo debug (futuro), se pueden validar:

- Dependencias de contextos derivados (detectar ciclos)
- Coherencia entre contextos relacionados
- Performance (tiempo de resolución)
- Diferencias vs snapshot (qué cambió)

---

## 7. ACCESOS Y PERMISOS

### 7.1 Principio de Menor Privilegio

**Regla**: Los consumers (paquetes, widgets) solo reciben los contextos que necesitan, no más.

**Razón**: 
- Seguridad (no exponer datos sensibles)
- Claridad (solo datos relevantes)
- Performance (menos datos = más rápido)

---

### 7.2 Views del ResolvedContext

**Conceptualmente** (no implementado todavía), se pueden definir "views" del resolved_context:

#### 7.2.1 resolved_public

**Para**: Widgets públicos, temas

**Incluye**:
- Contextos con `usable_by.widgets: true` o `usable_by.themes: true`
- Contextos sin datos sensibles
- NO incluye: `alumno_id`, `alumno_email` (solo si explícitamente requerido)

---

#### 7.2.2 resolved_internal

**Para**: Paquetes, automatizaciones internas

**Incluye**:
- Contextos con `usable_by.packages: true` o `usable_by.automations: true`
- Contextos del alumno necesarios para la ejecución
- NO incluye: Datos de otros alumnos, datos administrativos

---

#### 7.2.3 resolved_admin_debug

**Para**: UI de admin, debugging

**Incluye**:
- TODO (todos los contextos resueltos)
- Provenance completo
- Warnings y notes completos
- NO debe usarse en runtime de estudiantes

---

### 7.3 Aplicación de Permisos

**En esta fase (diseño)**: Solo se documenta el concepto. No se implementa todavía.

**Futuro**: El resolver puede filtrar el `resolved_context` según la view solicitada en el `ContextRequest`.

---

## 8. INTEGRACIÓN CON PAQUETES PDE

### 8.1 Flujo Completo de Resolución para Paquetes

**Paso 1: Paquete declara dependencias**

El paquete tiene `context_contract.inputs`:

```json
{
  "context_contract": {
    "inputs": [
      {
        "key": "nivel_efectivo",
        "type": "number",
        "required": true
      },
      {
        "key": "tipo_limpieza",
        "type": "enum",
        "values": ["rapida", "completa"],
        "default": "rapida",
        "required": false
      }
    ]
  }
}
```

**Paso 2: Se construye ExecutionContext**

```javascript
const executionContext = {
  executionType: 'package_run',
  target: { type: 'package', key: 'tecnicas-limpieza-nivel-5' },
  inputs: {
    tipo_limpieza: 'completa'  // Input explícito del usuario
  },
  snapshot: { /* Context Snapshot v1 */ },
  // ... resto
};
```

**Paso 3: Se genera ContextRequest**

```javascript
const contextRequest = {
  required: ['nivel_efectivo'],
  optional: ['tipo_limpieza'],
  purpose: 'package',
  include: {
    snapshotPaths: ['student.*', 'environment.*'],
    pdeContexts: true,
    derived: true
  },
  meta: { targetKey: 'tecnicas-limpieza-nivel-5', targetType: 'package' }
};
```

**Paso 4: Resolver resuelve contextos**

```javascript
const resolvedContext = await resolveContexts(contextRequest, executionContext);
// resolvedContext.resolved = {
//   nivel_efectivo: 5,  // De snapshot
//   tipo_limpieza: 'completa'  // De input explícito (precedencia nivel 1)
// }
```

**Paso 5: Paquete ejecuta con resolved_context**

El paquete:
- Recibe `resolvedContext.resolved`
- Usa `nivel_efectivo: 5` para filtrar contenido
- Usa `tipo_limpieza: 'completa'` para ajustar límites
- Agrega datos desde Source of Truth (PostgreSQL)
- Devuelve `package_payload` (datos agregados)

**Paso 6: Widgets consumen package_payload**

Los widgets:
- Reciben `package_payload` (datos agregados)
- NO reciben contextos (los contextos ya se usaron en el paquete)
- Renderizan los datos según su template

---

### 8.2 Aclaraciones Críticas

#### 8.2.1 Paquete NO "Toma un Contexto en Snapshot"

**Concepto incorrecto**: "El paquete lee `snapshot.student.nivelEfectivo`"

**Concepto correcto**: "El paquete recibe `resolvedContext.resolved.nivel_efectivo` que el resolver calculó aplicando precedencia"

**Diferencia**:
- El snapshot es proyección genérica
- El resolved_context es específico para esta ejecución del paquete
- El resolver aplica precedencia (inputs > defaults > snapshot)

---

#### 8.2.2 Paquete "Toma Contexto en Ejecución Mediante Resolver"

**Flujo correcto**:

1. Paquete declara que necesita `nivel_efectivo` y `tipo_limpieza`
2. Resolver resuelve estos contextos aplicando precedencia
3. Paquete recibe `resolved_context` con valores finales
4. Paquete usa valores para filtrar/agregar datos

**El resolver es el intermediario** entre el paquete y las fuentes de datos (snapshot, inputs, defaults).

---

#### 8.2.3 Paquete NO Accede a PostgreSQL Directamente

**Regla**: Los paquetes NO deben acceder a PostgreSQL directamente.

**Flujo correcto**:
1. Paquete recibe `resolved_context` del resolver
2. Paquete recibe datos agregados desde Source of Truth (mediante repos/services)
3. Paquete combina `resolved_context` + datos agregados
4. Paquete devuelve `package_payload`

**El acceso a PostgreSQL es responsabilidad de repos/services**, no del paquete directamente.

---

#### 8.2.4 Paquete Devuelve package_payload, NO Outputs de Contextos

**Regla**: Los paquetes NO generan outputs de contextos.

**El paquete devuelve**:
- Datos agregados desde Source of Truth
- NO contextos resueltos (esos ya se usaron internamente)

**Razón**: Los contextos son inputs para el paquete, no outputs. Los widgets consumen datos agregados, no contextos.

---

## 9. INTEGRACIÓN CON AUTOMATIZACIONES

### 9.1 Flujo de Resolución para Automatizaciones

**Paso 1: Automatización declara condiciones**

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

**Paso 2: Se extraen context_keys necesarios**

- `nivel_efectivo` (required)
- `suscripcion_pausada` (required)

**Paso 3: Se genera ContextRequest**

```javascript
const contextRequest = {
  required: ['nivel_efectivo', 'suscripcion_pausada'],
  optional: [],
  purpose: 'automation',
  include: {
    snapshotPaths: ['student.*'],
    pdeContexts: false,
    derived: true,
    flags: true
  },
  meta: { targetKey: 'streak_milestone_email', targetType: 'automation' }
};
```

**Paso 4: Resolver resuelve contextos**

```javascript
const resolvedContext = await resolveContexts(contextRequest, executionContext);
// resolvedContext.resolved = {
//   nivel_efectivo: 5,
//   suscripcion_pausada: false
// }
```

**Paso 5: Se evalúan condiciones**

```javascript
// condición 1: nivel_efectivo >= 5
if (resolvedContext.resolved.nivel_efectivo >= 5) { /* pasa */ }

// condición 2: suscripcion_pausada == false
if (resolvedContext.resolved.suscripcion_pausada === false) { /* pasa */ }

// Si todas pasan → automatización se ejecuta
```

---

### 9.2 Señales Disparan, Contextos Condicionan

**Diferencia crítica**:

- **Señales (Signals)**: Eventos que ocurren (ej: `practice_completed`)
  - Disparan automatizaciones
  - Son eventos puntuales
  - Se emiten, no se consultan

- **Contextos**: Estado actual (ej: `nivel_efectivo: 5`)
  - Se usan en condiciones
  - Se resuelven para la evaluación
  - Se consultan, no se emiten

**Flujo completo**:

1. Señal `practice_completed` se emite
2. Automatización `streak_milestone_email` se activa (trigger por señal)
3. Resolver resuelve contextos necesarios para condiciones
4. Se evalúan condiciones usando contextos resueltos
5. Si condiciones pasan → automatización ejecuta acciones

---

### 9.3 Provenance Útil para Auditoría

**Ejemplo de auditoría**:

```
Automation: streak_milestone_email
Signal: practice_completed
Contexts resolved:
  - nivel_efectivo: 5 (source: snapshot, precedence: 4)
  - streak: 25 (source: snapshot, precedence: 4)
  - suscripcion_pausada: false (source: snapshot, precedence: 4)
Conditions evaluated:
  - nivel_efectivo >= 5: true
  - streak >= 25: true
  - suscripcion_pausada == false: true
Result: EXECUTED
Actions: [send_email_milestone_25]
```

**La provenance permite auditar**:
- ¿Por qué se ejecutó?
- ¿De dónde vinieron los valores?
- ¿Qué precedencia se aplicó?
- ¿Hubo warnings?

---

## 10. MODO DEBUG

### 10.1 ¿Qué es el Modo Debug?

El **Modo Debug** es un modo conceptual (no implementado todavía) que proporciona información detallada sobre la resolución de contextos.

**Características**:
- Devuelve `resolved_context` + `provenance` completo
- Muestra "diferencias" vs snapshot (qué cambió por inputs)
- Lista warnings y notes
- Sin side-effects (solo lectura)

---

### 10.2 Estructura del Debug Output

```typescript
interface ResolvedContextDebug {
  // ========================================================================
  // RESOLVED CONTEXT (NORMAL)
  // ========================================================================
  resolved: { [context_key: string]: any };
  meta: { /* ... */ };
  provenance: { /* ... */ };
  
  // ========================================================================
  // DEBUG INFO ADICIONAL
  // ========================================================================
  debug: {
    // Diferencias vs snapshot
    snapshotDiff: {
      [context_key: string]: {
        snapshot_value: any;
        resolved_value: any;
        changed: boolean;
        reason: string;
      };
    };
    
    // Warnings acumulados
    warnings: Array<{
      context_key: string;
      level: 'info' | 'warn' | 'error';
      message: string;
      provenance_path?: string;
    }>;
    
    // Performance (futuro)
    performance?: {
      resolution_time_ms: number;
      contexts_resolved: number;
      cache_hits?: number;
    };
    
    // Dependencias resueltas (para contextos derivados)
    dependencies?: {
      [context_key: string]: string[];  // contextos de los que depende
    };
  };
}
```

---

### 10.3 Ejemplo de Debug Output

```javascript
{
  resolved: {
    nivel_efectivo: 5,
    tipo_limpieza: 'completa'
  },
  meta: { /* ... */ },
  provenance: { /* ... */ },
  debug: {
    snapshotDiff: {
      tipo_limpieza: {
        snapshot_value: null,  // No estaba en snapshot
        resolved_value: 'completa',
        changed: true,
        reason: 'Input explícito (precedence level 1)'
      },
      nivel_efectivo: {
        snapshot_value: 5,
        resolved_value: 5,
        changed: false,
        reason: 'Valor del snapshot (precedence level 4)'
      }
    },
    warnings: [
      {
        context_key: 'temporada',
        level: 'warn',
        message: 'Context not found in registry, using fail-open default',
        provenance_path: 'provenance.temporada'
      }
    ],
    performance: {
      resolution_time_ms: 12,
      contexts_resolved: 2
    }
  }
}
```

---

### 10.4 Uso Futuro del Modo Debug

**En UI de Admin**:
- Vista de "¿Por qué este paquete usó estos valores?"
- Vista de provenance completo
- Vista de warnings y errores

**En Logs**:
- Logging estructurado de resolución
- Tracing completo con requestId
- Auditoría de resolución

**En Testing**:
- Validar que resolución es correcta
- Validar que precedencia se aplica correctamente
- Validar que validaciones funcionan

---

## 11. FUERA DE SCOPE

### 11.1 No Define UI

**Este documento NO define**:
- Cómo se muestra el resolved_context en el admin
- Cómo se muestra la provenance en UI
- Cómo se muestra el modo debug en UI

**Eso será el Context Resolver UI (futuro)**.

---

### 11.2 No Define BD

**Este documento NO define**:
- Tablas para almacenar resolved_context (si es necesario)
- Tablas para almacenar provenance (si es necesario)
- Migraciones SQL

**Eso será el Context Resolver Schema (futuro)**.

---

### 11.3 No Define Endpoints

**Este documento NO define**:
- Endpoints para resolver contextos
- Endpoints para modo debug
- APIs REST

**Eso será el Context Resolver API (futuro)**.

---

### 11.4 No Refactoriza buildStudentContext

**Este documento NO define**:
- Cómo refactorizar `buildStudentContext` para usar el resolver
- Cómo integrar el resolver con el snapshot

**Eso será una fase futura de integración**.

---

### 11.5 No Define Optimizaciones / Caching

**Este documento NO define**:
- Cómo cachear resolved_context
- Cómo invalidar cache
- Estrategias de optimización

**Nota**: Se menciona como "futuro" pero no se diseña todavía.

---

## RESUMEN EJECUTIVO

### Qué es el Context Resolver v1

Un sistema que **resuelve (calcula/proporciona) los valores de los contextos** para una ejecución concreta (paquete, widget, automatización).

### Qué NO es

- NO es autoridad (PostgreSQL lo es)
- NO muta estado
- NO reemplaza el snapshot
- NO define qué contextos existen (eso es el registry)

### Por qué existe

Resuelve la pregunta: **"¿Cuándo un paquete (o widget, o automatización) toma un contexto?"**

### Conceptos Clave

1. **ExecutionContext**: Entidad conceptual que representa una ejecución
2. **Precedencia Canónica**: Orden de resolución (inputs > defaults > snapshot > derived > fail-open)
3. **ContextRequest**: Contrato que define qué contextos se necesitan
4. **ResolvedContext**: Salida con valores resueltos + provenance
5. **Provenance**: Metadata sobre de dónde vino cada valor

### Integración con Sistemas

- **Paquetes**: Reciben `resolved_context`, NO toman contextos del snapshot directamente
- **Automatizaciones**: Evalúan condiciones usando `resolved_context`
- **Registry**: Valida existencia, tipos, valores
- **Snapshot**: Proporciona valores base (precedencia nivel 4)

### Reglas Constitucionales

1. Precedencia canónica es CONSTITUCIONAL (no se puede cambiar sin justificación)
2. Fail-open absoluto (nunca crash en runtime student)
3. Determinismo (mismo input → mismo output)
4. Observabilidad obligatoria (requestId, provenance)
5. Validación contra registry (tipos, enums, existencia)
6. Principio de menor privilegio (solo contextos necesarios)

---

**FIN DEL DISEÑO**

Este documento define el Context Resolver v1 canónico. La implementación debe seguir este diseño exactamente.

