# 🎨 Diseño Conceptual: Sistema de Resolución de Temas (Theme Resolver)
## AuriPortal - Arquitectura de Dominio

**Versión:** 1.0  
**Fecha:** 2024-12-19  
**Autor:** Arquitecto de Dominio Senior  
**Estado:** Diseño Conceptual (NO implementación)

---

## 📋 Resumen Ejecutivo

El **Theme Resolver** es el sistema que determina **qué tema efectivo se aplica** a un alumno en un momento dado, resolviendo conflictos entre múltiples fuentes de tema mediante reglas de precedencia claras y deterministas.

### Principios Fundamentales

1. **Determinismo**: Mismo contexto → mismo tema efectivo (siempre)
2. **Auditabilidad**: Todos los cambios son rastreables y reversibles
3. **Fail-open**: Si algo falla, el sistema nunca rompe el cliente
4. **Extensibilidad**: Nuevas fuentes de tema se integran sin romper lo existente
5. **Separación de responsabilidades**: Resolución vs. Aplicación vs. Edición

### Alcance

- ✅ **SÍ**: Lógica de resolución, precedencia, conflictos
- ✅ **SÍ**: Modelo de datos conceptual
- ✅ **SÍ**: Integración con automatizaciones
- ❌ **NO**: Implementación de código
- ❌ **NO**: Diseño de UI/Editor
- ❌ **NO**: Runtime de aplicación de CSS

---

## 1. Entidades Conceptuales

### 1.1. ThemeDefinition

**Definición**: Un conjunto completo de valores para todas las variables del Theme Contract v1.

**Características**:
- Identificador único (`theme_id`)
- Nombre descriptivo (`name`)
- Versión del contrato que cumple (`contract_version: "v1"`)
- Valores completos para todas las variables CSS canónicas
- Metadatos: creado por, fecha creación, estado (activo/archivado)

**Ejemplo conceptual**:
```
ThemeDefinition {
  theme_id: "aurora-dark",
  name: "Aurora Oscuro",
  contract_version: "v1",
  values: {
    "--bg-main": "#0a0e1a",
    "--text-primary": "#f1f5f9",
    "--accent-primary": "#ffd86b",
    // ... todas las variables del contrato
  },
  metadata: {
    created_by: "system",
    created_at: "2024-01-01T00:00:00Z",
    status: "active"
  }
}
```

**Nota**: Los valores deben cumplir el Theme Contract v1 completo. Si falta una variable, el tema es inválido.

---

### 1.2. ThemeAssignment

**Definición**: Una asignación de un tema a un contexto específico (alumno, nivel, práctica, etc.).

**Características**:
- Identificador único (`assignment_id`)
- Tipo de asignación (`assignment_type`)
- Contexto objetivo (`target_context`)
- Tema asignado (`theme_id`)
- Prioridad/orden (`priority`)
- Fecha de creación y vigencia (`valid_from`, `valid_until`)
- Estado (activo/inactivo)

**Tipos de asignación**:
- `student_default`: Tema por defecto del alumno
- `student_preference`: Preferencia explícita del alumno
- `level_based`: Tema por nivel (ej. nivel 1-9 = tema A, nivel 10-15 = tema B)
- `practice_active`: Tema activo durante práctica específica
- `automation_triggered`: Tema activado por automatización
- `temporary_session`: Tema temporal solo para esta sesión
- `master_override`: Override manual del Master

**Ejemplo conceptual**:
```
ThemeAssignment {
  assignment_id: "asg_123",
  assignment_type: "student_preference",
  target_context: {
    student_email: "alumno@example.com"
  },
  theme_id: "aurora-dark",
  priority: 50,
  valid_from: "2024-01-01T00:00:00Z",
  valid_until: null, // indefinido
  status: "active"
}
```

---

### 1.3. ThemeOverride

**Definición**: Una modificación parcial de variables CSS sobre un tema base.

**Características**:
- Identificador único (`override_id`)
- Tema base afectado (`base_theme_id` o `assignment_id`)
- Variables modificadas (`overrides`: objeto parcial de variables)
- Contexto de aplicación (`target_context`)
- Prioridad (`priority`)
- Origen (`source`: "master", "automation", "student")
- Fecha de creación y vigencia
- Estado (activo/inactivo)

**Diferencia con ThemeAssignment**:
- `ThemeAssignment` asigna un tema **completo**
- `ThemeOverride` modifica **parcialmente** un tema existente

**Ejemplo conceptual**:
```
ThemeOverride {
  override_id: "ovr_456",
  base_assignment_id: "asg_123",
  overrides: {
    "--accent-primary": "#ff6b6b", // solo cambia esta variable
    "--text-accent": "#ff6b6b"
  },
  target_context: {
    student_email: "alumno@example.com"
  },
  priority: 100, // más alta que la asignación base
  source: "master",
  valid_from: "2024-12-19T10:00:00Z",
  valid_until: null,
  status: "active"
}
```

---

### 1.4. ThemeContext

**Definición**: El conjunto de datos de entrada que el resolver necesita para determinar el tema efectivo.

**Características**:
- Datos del alumno (`student`)
- Contexto de la sesión (`session`)
- Estado actual del sistema (`system_state`)
- Timestamp de resolución (`resolved_at`)

**Estructura conceptual**:
```
ThemeContext {
  student: {
    email: "alumno@example.com",
    nivel: 5,
    fecha_inscripcion: "2024-01-01",
    suscripcion_activa: true,
    // ... otros datos del estudiante
  },
  session: {
    session_id: "sess_789",
    practice_active: {
      practice_id: "prac_123",
      practice_type: "tema_1"
    },
    timestamp: "2024-12-19T10:30:00Z"
  },
  system_state: {
    current_date: "2024-12-19",
    time_of_day: "morning", // opcional
    // ... otros estados del sistema
  },
  resolved_at: "2024-12-19T10:30:00Z"
}
```

**Nota**: El resolver es una función pura: mismo `ThemeContext` → mismo resultado.

---

## 2. Fuentes de Tema (Inputs)

### 2.1. Lista Completa de Fuentes

El sistema debe considerar **TODAS** estas fuentes potenciales (ordenadas por precedencia conceptual, no definitiva):

#### **Nivel 1: Overrides del Master (Máxima Precedencia)**
- `master_override_global`: Override global del Master (aplica a todos)
- `master_override_student`: Override específico para un alumno
- `master_override_temporary`: Override temporal con fecha de expiración

#### **Nivel 2: Automatizaciones**
- `automation_achievement`: Tema activado por logro (ej. "100 días de racha")
- `automation_level_up`: Tema por subida de nivel
- `automation_practice_completion`: Tema tras completar práctica específica
- `automation_objective_met`: Tema cuando se cumple objetivo de tema
- `automation_time_based`: Tema por hora del día, día de la semana, estación

#### **Nivel 3: Contexto de Práctica**
- `practice_active_theme`: Tema activo durante práctica específica
- `practice_type_theme`: Tema según tipo de práctica (tema_1, tema_2, tema_3)
- `practice_preparation_theme`: Tema durante preparación de práctica

#### **Nivel 4: Nivel del Alumno**
- `level_based_theme`: Tema según nivel actual (1-9 = Sanación, 10-15 = Canalización)
- `level_category_theme`: Tema por categoría (Sanación vs Canalización)

#### **Nivel 5: Preferencias del Alumno**
- `student_preference`: Tema elegido explícitamente por el alumno
- `student_default`: Tema por defecto asignado al alumno

#### **Nivel 6: Sistema**
- `system_default`: Tema por defecto del sistema (fallback final)
- `contract_default`: Valores por defecto del Theme Contract v1

### 2.2. Extensibilidad

**Nueva fuente de tema**: Se añade un nuevo `assignment_type` y se integra en la precedencia sin romper lo existente.

**Ejemplo futuro**: `seasonal_theme` (tema según estación del año) se añade como `automation_time_based` con lógica específica.

---

## 3. Precedencia y Resolución

### 3.1. Orden de Precedencia (Definitivo)

El resolver evalúa las fuentes en este orden **estricto** (de mayor a menor precedencia):

```
1. master_override_temporary (si está vigente)
2. master_override_student
3. master_override_global
4. automation_achievement (más reciente)
5. automation_level_up (más reciente)
6. automation_practice_completion (más reciente)
7. automation_objective_met (más reciente)
8. automation_time_based (si aplica ahora)
9. practice_active_theme (si hay práctica activa)
10. practice_type_theme (si hay práctica activa)
11. level_based_theme (según nivel actual)
12. student_preference
13. student_default
14. system_default
15. contract_default (valores canónicos del contrato)
```

### 3.2. Reglas de Combinación

#### **Regla 1: Sustitución Completa (por defecto)**
Si una fuente tiene precedencia, **sustituye completamente** el tema de menor precedencia.

**Excepción**: Si la fuente es un `ThemeOverride`, se combina con el tema base.

#### **Regla 2: Combinación de Overrides**
Si hay múltiples `ThemeOverride` activos:
1. Se ordenan por `priority` (mayor = más importante)
2. Se aplican secuencialmente sobre el tema base
3. Si hay conflicto (misma variable), gana el override de mayor `priority`

#### **Regla 3: Valores Faltantes**
Si un tema no define una variable:
1. Se busca en el tema de menor precedencia
2. Si tampoco la tiene, se busca en `contract_default`
3. Si aún falta, se usa el valor canónico del Theme Contract v1

**Nunca se deja una variable sin valor** → siempre hay fallback.

### 3.3. Ejemplo Concreto Paso a Paso

**Contexto**:
```
ThemeContext {
  student: {
    email: "maria@example.com",
    nivel: 7,
    suscripcion_activa: true
  },
  session: {
    practice_active: {
      practice_id: "prac_tema_1",
      practice_type: "tema_1"
    }
  },
  system_state: {
    current_date: "2024-12-19",
    time_of_day: "evening"
  }
}
```

**Fuentes activas** (en orden de precedencia):

1. ✅ `master_override_student` (priority: 100)
   - `theme_id: "aurora-dark"`
   - `overrides: { "--accent-primary": "#ff6b6b" }`

2. ✅ `automation_achievement` (priority: 80)
   - `theme_id: "celebration-gold"`
   - `valid_until: "2024-12-20T00:00:00Z"` (temporal)

3. ✅ `practice_active_theme` (priority: 50)
   - `theme_id: "tema-1-special"`

4. ✅ `level_based_theme` (priority: 30)
   - `theme_id: "sanacion-theme"` (nivel 7 = Sanación)

5. ✅ `student_preference` (priority: 20)
   - `theme_id: "aurora-light"`

6. ✅ `system_default` (priority: 10)
   - `theme_id: "aurora-dark"`

**Proceso de resolución**:

**Paso 1**: Evaluar `master_override_student`
- ✅ Está activo y vigente
- Tema base: `"aurora-dark"`
- Override: `{ "--accent-primary": "#ff6b6b" }`
- **Resultado parcial**: `aurora-dark` + override de `--accent-primary`

**Paso 2**: Evaluar `automation_achievement`
- ✅ Está activo y vigente (hasta mañana)
- Tema: `"celebration-gold"`
- **Pero**: `master_override_student` tiene mayor precedencia
- **Resultado**: Se mantiene `aurora-dark` + override

**Paso 3**: Evaluar `practice_active_theme`
- ✅ Hay práctica activa
- Tema: `"tema-1-special"`
- **Pero**: `master_override_student` tiene mayor precedencia
- **Resultado**: Se mantiene `aurora-dark` + override

**Paso 4-6**: Las demás fuentes se ignoran (menor precedencia)

**Tema efectivo final**:
```
{
  base_theme: "aurora-dark",
  overrides: {
    "--accent-primary": "#ff6b6b"
  },
  resolved_from: [
    { source: "master_override_student", priority: 100 },
    { source: "system_default", priority: 10 } // para variables faltantes
  ]
}
```

**Nota**: Si `master_override_student` no existiera, ganaría `automation_achievement` (tema `"celebration-gold"`).

---

## 4. Modelo de "Tema Efectivo"

### 4.1. Conceptos Fundamentales

#### **theme_base**
El tema completo que sirve como base. Siempre es un `ThemeDefinition` completo (todas las variables definidas).

**Origen**: La fuente de mayor precedencia que proporciona un tema completo (no solo overrides).

#### **theme_overrides**
Conjunto de modificaciones parciales aplicadas sobre `theme_base`.

**Origen**: Todas las fuentes de tipo `ThemeOverride` que tienen precedencia, ordenadas por `priority` y combinadas.

#### **theme_effective**
El resultado final después de aplicar `theme_overrides` sobre `theme_base`.

**Características**:
- Siempre es un tema **completo** (todas las variables definidas)
- Es determinista (mismo contexto → mismo resultado)
- Es auditado (se registra cómo se resolvió)

### 4.2. Diagrama Lógico

```
┌─────────────────────────────────────────────────────────────┐
│                    Theme Resolver                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │     ThemeContext (Input)          │
        │  - student                        │
        │  - session                        │
        │  - system_state                   │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │   Recopilar Fuentes Activas       │
        │  - ThemeAssignments               │
        │  - ThemeOverrides                 │
        │  - Ordenar por precedencia        │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │   Determinar theme_base            │
        │  - Primera fuente con tema completo│
        │  - Si ninguna: system_default     │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │   Recopilar theme_overrides       │
        │  - Filtrar overrides activos      │
        │  - Ordenar por priority           │
        │  - Combinar secuencialmente       │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │   Calcular theme_effective         │
        │  - Aplicar overrides sobre base   │
        │  - Rellenar variables faltantes   │
        │  - Validar completitud            │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │   ThemeEffective (Output)         │
        │  - theme_base: "aurora-dark"      │
        │  - overrides: {...}               │
        │  - effective_values: {...}        │
        │  - resolved_from: [...]           │
        │  - resolved_at: timestamp         │
        └───────────────────────────────────┘
```

### 4.3. Inspiración del Sistema de Progreso

**Paralelismo con niveles**:
- `nivel_base` = Nivel calculado automáticamente (días desde inscripción)
- `nivel_efectivo` = Nivel actual (puede tener override manual del Master)
- **Regla**: Solo se actualiza si `nivel_base > nivel_efectivo` (respeta cambios manuales)

**Aplicación a temas**:
- `theme_base` = Tema determinado por precedencia automática
- `theme_effective` = Tema final después de overrides
- **Regla**: Overrides del Master siempre ganan (como cambios manuales en niveles)

### 4.4. Estructura de ThemeEffective

```
ThemeEffective {
  // Tema base
  theme_base: {
    theme_id: "aurora-dark",
    values: { /* todas las variables */ }
  },
  
  // Overrides aplicados
  theme_overrides: [
    {
      override_id: "ovr_456",
      source: "master_override_student",
      priority: 100,
      overrides: {
        "--accent-primary": "#ff6b6b"
      }
    }
  ],
  
  // Valores efectivos finales
  effective_values: {
    "--bg-main": "#0a0e1a",        // de theme_base
    "--text-primary": "#f1f5f9",   // de theme_base
    "--accent-primary": "#ff6b6b", // de override (gana)
    // ... todas las variables
  },
  
  // Trazabilidad
  resolved_from: [
    {
      source: "master_override_student",
      assignment_id: "asg_123",
      priority: 100,
      applied: true
    },
    {
      source: "automation_achievement",
      assignment_id: "asg_456",
      priority: 80,
      applied: false, // no aplicado por menor precedencia
      reason: "overridden_by_higher_priority"
    },
    {
      source: "system_default",
      assignment_id: "asg_sys",
      priority: 10,
      applied: true, // para variables faltantes
      reason: "fallback_for_missing_variables"
    }
  ],
  
  // Metadatos
  resolved_at: "2024-12-19T10:30:00Z",
  resolved_by: "theme_resolver_v1",
  contract_version: "v1",
  
  // Validación
  is_complete: true, // todas las variables definidas
  is_valid: true     // cumple Theme Contract v1
}
```

---

## 5. Relación con Automatizaciones

### 5.1. Eventos de Automatización

Las automatizaciones emiten eventos que el Theme Resolver consume:

#### **theme.set**
Activa un tema completo.

**Estructura**:
```
{
  event_type: "theme.set",
  event_id: "evt_789",
  timestamp: "2024-12-19T10:00:00Z",
  context: {
    student_email: "maria@example.com",
    automation_id: "auto_achievement_100_days"
  },
  payload: {
    theme_id: "celebration-gold",
    assignment_type: "automation_achievement",
    priority: 80,
    valid_until: "2024-12-20T00:00:00Z" // opcional, temporal
  }
}
```

**Efecto**: Crea un `ThemeAssignment` de tipo `automation_achievement`.

#### **theme.override.add**
Añade un override parcial.

**Estructura**:
```
{
  event_type: "theme.override.add",
  event_id: "evt_790",
  timestamp: "2024-12-19T10:05:00Z",
  context: {
    student_email: "maria@example.com",
    automation_id: "auto_level_up"
  },
  payload: {
    base_assignment_id: "asg_123", // opcional, si no se aplica al tema activo
    overrides: {
      "--accent-primary": "#00ff00",
      "--text-accent": "#00ff00"
    },
    priority: 75,
    valid_until: null // permanente hasta que se revierta
  }
}
```

**Efecto**: Crea un `ThemeOverride` activo.

#### **theme.override.remove**
Elimina un override específico.

**Estructura**:
```
{
  event_type: "theme.override.remove",
  event_id: "evt_791",
  timestamp: "2024-12-19T11:00:00Z",
  context: {
    student_email: "maria@example.com",
    automation_id: "auto_level_up"
  },
  payload: {
    override_id: "ovr_456" // o criteria para encontrar overrides
  }
}
```

**Efecto**: Marca el `ThemeOverride` como inactivo.

#### **theme.revert**
Revierte a un tema anterior (elimina asignaciones/overrides).

**Estructura**:
```
{
  event_type: "theme.revert",
  event_id: "evt_792",
  timestamp: "2024-12-19T12:00:00Z",
  context: {
    student_email: "maria@example.com",
    automation_id: "auto_achievement_expired"
  },
  payload: {
    assignment_id: "asg_456", // o criteria
    revert_to: "previous" // o "system_default"
  }
}
```

**Efecto**: Desactiva el `ThemeAssignment`/`ThemeOverride` y vuelve a resolver.

### 5.2. Relación con AUTO-1 / AUTO-2

**AUTO-1** (Automatizaciones de Logros):
- Emite `theme.set` cuando se cumple un logro (ej. 100 días de racha)
- Tema temporal (ej. 24 horas)
- Prioridad media-alta (80)

**AUTO-2** (Automatizaciones de Progreso):
- Emite `theme.override.add` cuando sube de nivel
- Override permanente hasta siguiente nivel
- Prioridad media (60)

**Ejemplo de flujo**:
1. Alumno cumple 100 días de racha
2. AUTO-1 emite `theme.set` → tema `"celebration-gold"` por 24h
3. Alumno sube a nivel 8
4. AUTO-2 emite `theme.override.add` → override de `--accent-primary` a verde
5. Resolver combina: `celebration-gold` + override verde
6. Pasadas 24h, AUTO-1 emite `theme.revert` → se elimina `celebration-gold`
7. Resolver recalcula: tema base anterior + override verde

### 5.3. Event Sourcing

**Inspiración**: Sistema de `energy_events` del AuriPortal.

**Tabla conceptual**: `theme_events`
- Registra todos los eventos `theme.*`
- Idempotencia por `request_id`
- Proyecciones a `theme_assignments` y `theme_overrides`
- Permite reconstruir estado histórico

**Ventajas**:
- Auditoría completa
- Reversión de cambios
- Debugging de temas
- Análisis de uso

---

## 6. Fail-Open y Seguridad

### 6.1. Estrategias Fail-Open

#### **Escenario 1: Resolver Falla**
**Situación**: Error al ejecutar el resolver (excepción, timeout, etc.)

**Estrategia**:
1. Capturar error y loguear
2. Retornar `system_default` (tema seguro conocido)
3. **Nunca** retornar error al cliente
4. Notificar al sistema de monitoreo (opcional)

**Resultado**: El cliente siempre recibe un tema válido, aunque no sea el óptimo.

---

#### **Escenario 2: Tema Inválido**
**Situación**: Un `ThemeDefinition` no cumple el Theme Contract v1 (faltan variables, valores inválidos)

**Estrategia**:
1. Validar tema antes de usarlo
2. Si es inválido, marcarlo como `invalid` en metadatos
3. Saltar a siguiente fuente de menor precedencia
4. Si todas son inválidas, usar `contract_default` (valores canónicos del contrato)

**Resultado**: El sistema nunca usa un tema roto.

---

#### **Escenario 3: Variables Faltantes**
**Situación**: Un tema no define todas las variables requeridas

**Estrategia**:
1. Detectar variables faltantes
2. Buscar en tema de menor precedencia
3. Si tampoco las tiene, buscar en `contract_default`
4. Si aún faltan, usar valores canónicos del Theme Contract v1
5. **Nunca** dejar una variable sin valor

**Resultado**: El tema efectivo siempre es completo.

---

#### **Escenario 4: Fuentes Contradictorias**
**Situación**: Múltiples fuentes activas con precedencia igual

**Estrategia**:
1. Ordenar por `priority` (mayor = gana)
2. Si `priority` es igual, ordenar por `created_at` (más reciente = gana)
3. Si aún hay empate, usar `assignment_id` (lexicográficamente)
4. **Siempre** hay un ganador determinista

**Resultado**: No hay ambigüedad en la resolución.

---

#### **Escenario 5: Contexto Incompleto**
**Situación**: `ThemeContext` no tiene todos los datos necesarios (ej. `student` es `null`)

**Estrategia**:
1. Validar contexto mínimo requerido
2. Si falta `student.email`, usar `system_default`
3. Si falta `student.nivel`, asumir `nivel: 1`
4. Si falta `session`, asumir `session: null` (sin práctica activa)
5. **Nunca** fallar por contexto incompleto

**Resultado**: El resolver funciona incluso con datos parciales.

---

#### **Escenario 6: Override Inválido**
**Situación**: Un `ThemeOverride` tiene variables que no existen en el contrato

**Estrategia**:
1. Validar que todas las variables del override existen en Theme Contract v1
2. Si hay variables inválidas, ignorarlas (no fallar)
3. Aplicar solo las variables válidas
4. Loguear advertencia

**Resultado**: Overrides parcialmente inválidos no rompen el sistema.

---

### 6.2. Validación de Tema Efectivo

Antes de retornar `ThemeEffective`, el resolver debe validar:

1. ✅ Todas las variables del Theme Contract v1 están definidas
2. ✅ Todos los valores son válidos (formato CSS correcto)
3. ✅ No hay referencias circulares
4. ✅ El tema es renderizable (no rompe el cliente)

Si falla la validación:
- Usar `contract_default` (valores canónicos)
- Loguear error crítico
- Notificar al sistema de monitoreo

---

### 6.3. Garantías del Sistema

**Garantía 1**: El cliente **nunca** recibe un tema inválido o incompleto.

**Garantía 2**: Si algo falla, el sistema **siempre** tiene un fallback seguro.

**Garantía 3**: El resolver **nunca** lanza excepciones no capturadas.

**Garantía 4**: El tema efectivo es **siempre** determinista (mismo contexto → mismo resultado).

**Garantía 5**: El sistema es **auditable** (se puede rastrear por qué se aplicó un tema).

---

## 7. Notas de Implementación Futura

### 7.1. Almacenamiento

**Opciones conceptuales**:
- **ClickUp**: `ThemeAssignments` y `ThemeOverrides` como campos personalizados o tareas
- **SQLite**: Tablas `theme_definitions`, `theme_assignments`, `theme_overrides`, `theme_events`
- **Híbrido**: Definiciones en SQLite (caché), asignaciones en ClickUp (fuente de verdad)

**Recomendación**: Similar al sistema de estudiantes (ClickUp = fuente de verdad, SQLite = caché).

---

### 7.2. Caché

**Estrategia**:
- Cachear `ThemeEffective` por `student_email` + `session_id`
- Invalidar cuando:
  - Se emite evento `theme.*`
  - Cambia `student.nivel`
  - Cambia `session.practice_active`
  - Expira `valid_until` de una asignación

**TTL sugerido**: 5 minutos (balance entre frescura y rendimiento).

---

### 7.3. Integración con applyTheme()

**Flujo actual**:
```javascript
const html = renderHtml(template, { student });
const htmlConTema = applyTheme(html, student);
```

**Flujo futuro**:
```javascript
const themeContext = buildThemeContext(student, session, systemState);
const themeEffective = resolveTheme(themeContext);
const html = renderHtml(template, { student, theme: themeEffective });
const htmlConTema = applyTheme(html, themeEffective);
```

**Cambio**: `applyTheme()` recibe `ThemeEffective` en lugar de solo `student.tema_preferido`.

---

### 7.4. Editor de Temas

**No es responsabilidad del Theme Resolver**, pero debe considerar:

- El editor crea `ThemeDefinition` (valores completos)
- El editor valida contra Theme Contract v1
- El editor puede previsualizar `ThemeEffective` (resolver en tiempo real)

---

### 7.5. Migración desde Sistema Actual

**Estado actual**:
- `student.tema_preferido` (string: "dark" | "light")
- `applyTheme()` usa directamente este valor

**Migración**:
1. Crear `ThemeDefinition` para "dark" y "light" (valores actuales)
2. Crear `ThemeAssignment` de tipo `student_preference` para cada alumno
3. Migrar `student.tema_preferido` → `ThemeAssignment`
4. Actualizar `applyTheme()` para usar `resolveTheme()`
5. Mantener compatibilidad hacia atrás durante transición

---

## 8. Criterios de Éxito

Un desarrollador distinto debe poder implementar el Theme Resolver siguiendo este diseño **SIN tomar decisiones ambiguas** sobre:

- ✅ Qué entidades crear y cómo estructurarlas
- ✅ Qué fuentes de tema considerar y en qué orden
- ✅ Cómo resolver conflictos entre fuentes
- ✅ Qué hacer cuando algo falla
- ✅ Cómo integrar con automatizaciones
- ✅ Cómo garantizar que nunca se rompe el cliente

---

## 9. Glosario

- **Theme Contract v1**: Contrato canónico de variables CSS (ver `THEME_CONTRACT.md`)
- **Theme Resolver**: Sistema que determina el tema efectivo
- **Theme Effective**: Tema final aplicado al cliente
- **Precedencia**: Orden de prioridad de fuentes de tema
- **Override**: Modificación parcial de un tema
- **Assignment**: Asignación completa de un tema
- **Fail-open**: Estrategia que garantiza funcionamiento incluso ante errores

---

## 10. Referencias

- `docs/THEME_CONTRACT.md` - Contrato canónico de temas
- `public/css/theme-contract.css` - Variables CSS canónicas
- `src/core/responses.js` - Función `applyTheme()` actual
- `ENERGY_SYSTEM_STATUS.md` - Sistema de event sourcing (inspiración)
- `src/modules/nivel.js` - Sistema de niveles (inspiración para overrides)

---

**FIN DEL DOCUMENTO**

Este diseño es **conceptual** y **no incluye código de implementación**. Un desarrollador debe poder implementarlo siguiendo estas especificaciones sin ambigüedades.







