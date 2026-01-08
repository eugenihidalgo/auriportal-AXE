# DIAGNÓSTICO DE REALIDAD — CLEANING ENGINE Y LIMPIEZAS
## AuriPortal / Dominio MASTER
**Fecha:** 2026-01-XX  
**Modo:** DIAGNÓSTICO PURO (sin implementación)

---

## 📦 BLOQUE A — TABLAS Y SOURCE OF TRUTH

### Tablas Relacionadas con Limpiezas

#### 1. `cleaning_events` (append-only, audit real)
**Ubicación:** `database/migrations/v5.59.0-cleaning-engine-v1.sql`  
**Propósito:** Event log canónico de todas las limpiezas ejecutadas

**Columnas relevantes:**
- `id` (UUID, PK)
- `created_at` (TIMESTAMPTZ) — timestamp del evento
- `trace_id` (TEXT) — para correlación
- `execution_key` (TEXT) — para idempotencia (formato: `{action_type}:{item_ref}:{student_id}:{timestamp_day}`)
- `student_id` (INTEGER, FK a alumnos)
- `product_key` (TEXT, default: 'pde')
- `domain_type` (TEXT, ej: 'transmutation')
- `item_ref` (TEXT) — referencia del item
- `clean_layer` (TEXT, CHECK: 'shared' | 'pde')
- `item_kind` (TEXT, CHECK: 'recurrente' | 'una_vez')
- `action_type` (TEXT, CHECK: 'mark_clean' | 'set_remaining')
- `delta_completed` (INTEGER, nullable) — para una_vez mark_clean => +1
- `set_remaining` (INTEGER, nullable) — para set_remaining
- `actor_type` (TEXT, CHECK: 'master' | 'student' | 'automation')
- `actor_ref` (TEXT, nullable) — referencia del actor
- `surface_key` (TEXT, nullable) — superficie de origen (ej: 'master.alquimia_general')
- `meta` (JSONB) — metadatos adicionales

**Características:**
- ✅ Append-only (no se modifica ni elimina)
- ✅ Idempotencia vía constraint único en `(execution_key, student_id)`
- ✅ Índices para búsqueda por student/item/layer/trace
- ✅ SOT canónico del historial de limpiezas

**Relaciones:**
- FK a `alumnos(id)` ON DELETE CASCADE

---

#### 2. `cleaning_item_state` (proyección canónica)
**Ubicación:** `database/migrations/v5.59.0-cleaning-engine-v1.sql`  
**Propósito:** Proyección optimizada para lecturas rápidas del estado actual

**Columnas relevantes:**
- `student_id` (INTEGER, FK a alumnos)
- `product_key` (TEXT, default: 'pde')
- `domain_type` (TEXT)
- `item_ref` (TEXT)
- `shared_last_cleaned_at` (TIMESTAMPTZ, nullable) — última limpieza SHARED
- `pde_last_cleaned_at` (TIMESTAMPTZ, nullable) — última limpieza PDE
- `shared_clean_count` (INTEGER, default: 0) — contador SHARED
- `pde_clean_count` (INTEGER, default: 0) — contador PDE
- `shared_completed` (INTEGER, default: 0) — para una_vez SHARED
- `shared_remaining` (INTEGER, default: 0) — para una_vez SHARED
- `pde_completed` (INTEGER, default: 0) — para una_vez PDE (solo audit)
- `meta` (JSONB)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Características:**
- ✅ Mutable (se actualiza con cada evento)
- ✅ Proyección derivada de `cleaning_events`
- ✅ Separación por capa (shared/pde)
- ✅ PK compuesta: `(student_id, product_key, domain_type, item_ref)`

**Relaciones:**
- FK a `alumnos(id)` ON DELETE CASCADE

---

#### 3. `student_item_state` (compatibilidad legacy)
**Ubicación:** `database/migrations/v5.42.0-student-sot-v1.sql`  
**Propósito:** Estado personal del alumno por ítem y dominio (legacy, sincronizado desde SHARED)

**Columnas relevantes:**
- `student_id` (INTEGER, FK a alumnos)
- `domain_key` (TEXT) — ej: 'transmutaciones_energeticas'
- `item_id` (INTEGER) — ID del item en catálogo (NO item_ref)
- `is_active` (BOOLEAN)
- `is_clean` (BOOLEAN)
- `clean_count` (INTEGER)
- `last_cleaned_at` (TIMESTAMPTZ)
- `recommended_recurrence_days` (INTEGER)
- `student_recurrence_days` (INTEGER)
- `meta` (JSONB)

**Características:**
- ✅ Mutable
- ✅ Sincronizado desde `cleaning_item_state` cuando `clean_layer='shared'`
- ⚠️ Usa `item_id` (no `item_ref`) — requiere resolución
- ⚠️ Solo para capa SHARED (PDE no afecta esta tabla)

**Relaciones:**
- FK a `alumnos(id)` ON DELETE CASCADE

---

#### 4. `student_item_state_audit` (auditoría append-only)
**Ubicación:** `database/migrations/v5.42.0-student-sot-v1.sql`  
**Propósito:** Auditoría de cambios en `student_item_state`

**Columnas relevantes:**
- `id` (UUID, PK)
- `student_id` (INTEGER, FK a alumnos)
- `domain_key` (TEXT)
- `item_id` (INTEGER)
- `action` (TEXT) — 'ACTIVATE', 'DEACTIVATE', 'CLEAN', 'SET_RECURRENCE', 'BULK_CLEAN', etc.
- `actor_type` (TEXT, CHECK: 'master' | 'student' | 'system')
- `actor_id` (TEXT, nullable)
- `before` (JSONB) — snapshot antes
- `after` (JSONB) — snapshot después
- `trace_id` (TEXT)
- `created_at` (TIMESTAMPTZ)

**Características:**
- ✅ Append-only
- ✅ Snapshot completo (before/after)
- ⚠️ NO es el SOT de limpiezas (es auditoría de `student_item_state`)

---

### Resumen de Tablas

| Tabla | Tipo | Propósito | SOT o Proyección | Append-only |
|-------|------|-----------|------------------|-------------|
| `cleaning_events` | Event log | Historial completo de limpiezas | ✅ SOT | ✅ Sí |
| `cleaning_item_state` | Proyección | Estado actual por capa | Proyección | ❌ No |
| `student_item_state` | Estado legacy | Estado personal (compat) | Proyección sincronizada | ❌ No |
| `student_item_state_audit` | Auditoría | Cambios en student_item_state | Auditoría | ✅ Sí |

---

## 📦 BLOQUE B — CLEAN ENGINE (REAL)

### Servicio Canónico
**Ubicación:** `src/core/master/services/cleaning-engine-service.js`

### Funciones Principales

#### 1. `markCleanStudent(options, client)`
**Qué hace:**
- Valida que el alumno NO esté en pausa
- Obtiene item desde catálogo (valida existencia)
- Verifica nivel efectivo (si item.nivel > nivel_efectivo, retorna null)
- Determina `item_kind` desde lista (recurrente/una_vez)
- Genera `execution_key` para idempotencia
- Inserta evento en `cleaning_events`
- Aplica a proyección `cleaning_item_state`:
  - Recurrente: actualiza `last_cleaned_at` y `clean_count` por capa
  - Una_vez: incrementa `completed` y decrementa `remaining` (SHARED)
- Si `clean_layer='shared'`, sincroniza a `student_item_state` (compat)
- Emite señal `clean.executed` (fail-open)

**Parámetros:**
- `student_id` (INTEGER) — ID del alumno (legacy alumnos.id)
- `item_ref` (TEXT) — referencia del item
- `clean_layer` ('shared' | 'pde', default: 'shared')
- `product_key` (default: 'pde')
- `domain_type` (default: 'transmutation')
- `actor_type` ('master' | 'student' | 'automation')
- `actor_ref` (opcional)
- `surface_key` (opcional, ej: 'master.alquimia_general')
- `meta` (opcional)

**Qué escribe:**
- ✅ `cleaning_events` (1 evento)
- ✅ `cleaning_item_state` (upsert)
- ✅ `student_item_state` (si clean_layer='shared', sincronización parcial)

**Qué NO escribe:**
- ❌ No escribe directamente en `student_item_state` (solo sincroniza vía función `syncToStudentItemState` que está parcialmente implementada)

---

#### 2. `markCleanAllStudents(options, client)`
**Qué hace:**
- Obtiene item y lista desde catálogo
- Obtiene todos los alumnos (SELECT id FROM alumnos)
- Filtra alumnos NO pausados
- Para cada alumno activo:
  - Verifica nivel efectivo (si item.nivel > nivel_efectivo, skip)
  - Llama a `markCleanStudent`
- Retorna breakdown: `{ updated, skipped, total, skipped_breakdown }`

**Parámetros:**
- Similar a `markCleanStudent` pero sin `student_id`
- `item_ref` (requerido)

**Qué escribe:**
- ✅ Múltiples eventos en `cleaning_events` (1 por alumno)
- ✅ Múltiples actualizaciones en `cleaning_item_state`
- ✅ Múltiples sincronizaciones a `student_item_state` (si clean_layer='shared')

---

#### 3. `setRemainingShared(options, client)`
**Qué hace:**
- Establece `remaining` directamente para una_vez (solo SHARED)
- Valida que el item sea una_vez
- Genera `execution_key` para idempotencia
- Inserta evento con `action_type='set_remaining'`
- Actualiza `cleaning_item_state.shared_remaining`
- Sincroniza a `student_item_state` (compat)

**Parámetros:**
- `student_id` (INTEGER)
- `item_ref` (TEXT)
- `remaining` (INTEGER) — nuevo valor
- `actor_type`, `actor_ref`, `surface_key`, `meta` (opcionales)

**Qué escribe:**
- ✅ `cleaning_events` (1 evento con `action_type='set_remaining'`)
- ✅ `cleaning_item_state.shared_remaining`
- ✅ `student_item_state` (sincronización parcial)

---

### Diferencia Real entre SHARED y PDE

**SHARED:**
- ✅ Visible para el alumno
- ✅ Sincroniza con `student_item_state` (compatibilidad)
- ✅ Afecta `shared_last_cleaned_at`, `shared_clean_count`, `shared_completed`, `shared_remaining`
- ✅ Emite señales

**PDE:**
- ✅ Solo master (no visible para alumno)
- ❌ NO sincroniza con `student_item_state`
- ✅ Afecta `pde_last_cleaned_at`, `pde_clean_count`, `pde_completed`
- ✅ Emite señales
- ✅ Solo auditoría (no afecta estado del alumno)

---

### Dónde se Guarda

**Autor (actor):**
- ✅ `cleaning_events.actor_type` ('master' | 'student' | 'automation')
- ✅ `cleaning_events.actor_ref` (referencia del actor, opcional)
- ✅ `cleaning_events.surface_key` (superficie de origen, ej: 'master.alquimia_general')

**Timestamp:**
- ✅ `cleaning_events.created_at` (timestamp del evento)
- ✅ `cleaning_item_state.shared_last_cleaned_at` o `pde_last_cleaned_at` (según capa)

**Item:**
- ✅ `cleaning_events.item_ref` (referencia del item)
- ✅ `cleaning_events.meta.item_id` (ID del item, en meta)
- ✅ `cleaning_item_state.item_ref` (en proyección)

**Lista:**
- ✅ `cleaning_events.meta.lista_id` (en meta)
- ❌ NO se guarda directamente en `cleaning_events` (solo en meta)

**Visibilidad al alumno:**
- ✅ Implícita por `clean_layer`:
  - `clean_layer='shared'` → visible para alumno
  - `clean_layer='pde'` → solo master

---

## 📦 BLOQUE C — SEÑALES Y EVENTOS

### Señal `clean.executed`

**¿Existe?**
- ✅ SÍ existe y se emite

**Dónde se emite:**
1. `src/core/master/services/cleaning-engine-service.js` (línea 323) — desde `markCleanStudent`
2. `src/services/alquimia-general-service.js` (línea 1044) — desde `markPdeCleanAll` (legacy)

**Payload REAL:**
```javascript
{
  signal: 'clean.executed',
  scope: 'student', // o 'pde_daily' en legacy
  student_id: INTEGER, // o null en legacy
  item_id: INTEGER,
  item_ref: TEXT,
  domain: TEXT, // ej: 'transmutation'
  product_key: TEXT, // default: 'pde'
  source: TEXT, // 'master' | 'student' | 'automation'
  clean_layer: TEXT, // 'shared' | 'pde'
  executed_at: TEXT // ISO string
}
```

**Campos incluidos:**
- ✅ `signal`, `scope`, `student_id`, `item_id`, `item_ref`, `domain`, `product_key`, `source`, `clean_layer`, `executed_at`

**Campos que NO están:**
- ❌ `lista_id` (no está en payload)
- ❌ `lista_tipo` (no está en payload)
- ❌ `actor_ref` (no está en payload)
- ❌ `surface_key` (no está en payload)
- ❌ `trace_id` (va en metadatos del emisor, no en payload)

**¿Está registrada en Student Signal Registry?**
- ❌ NO. La señal `clean.executed` NO aparece en `src/core/student/signals/student-signal-registry.js`
- ⚠️ Se emite vía `pde-signal-emitter.js` (sistema legacy)
- ⚠️ NO es una señal canónica del dominio Alumno

**Señales registradas relacionadas:**
- ✅ `student.domain.item.cleaned` — registrada en registry (línea 106)
- ✅ `student.domain.bulk_cleaned` — registrada en registry (línea 121)

**Quién la consume:**
- ❓ NO se encontró código que consuma `clean.executed`
- ⚠️ Posiblemente se almacena en `pde_signals` (tabla legacy) pero no se procesa

---

## 📦 BLOQUE D — CONTRATOS CANÓNICOS EXISTENTES

### 1. Contrato de Cleaning Engine Service
**Ubicación:** `src/core/master/services/cleaning-engine-service.js`

**Qué garantiza:**
- ✅ Single decider (único decisor de estado de limpieza)
- ✅ Exclusión automática de alumnos pausados
- ✅ Idempotencia vía `execution_key`
- ✅ Validación de nivel efectivo (items no aplicables)
- ✅ Separación de capas (SHARED vs PDE)
- ✅ Sincronización SHARED → `student_item_state` (parcial)

**Qué NO garantiza:**
- ❌ Sincronización completa a `student_item_state` (función `syncToStudentItemState` está parcialmente implementada, solo loguea)
- ❌ Reconstrucción de estados desde eventos (no hay función de replay)
- ❌ Agregación de eventos por sesión (no hay concepto de "sesión")

**Estabilidad:**
- ✅ Estable (v1 implementado y en uso)

---

### 2. Contrato de Repositorios

#### CleaningEventsRepo
**Ubicación:** `src/infra/repos/cleaning/cleaning-events-repo-pg.js`

**Métodos:**
- ✅ `insertEvent(event, client)` — inserta con idempotencia
- ✅ `listEventsForStudentItem(options, client)` — lista eventos por student+item

**Qué garantiza:**
- ✅ Idempotencia (retorna 'already_applied' si duplicado)
- ✅ Append-only (no hay métodos de update/delete)

**Qué NO garantiza:**
- ❌ Listado por rango de fechas (no hay método)
- ❌ Listado por sesión (no hay concepto de sesión)
- ❌ Agregación de eventos (no hay métodos de agregación)

**Estabilidad:**
- ✅ Estable (implementación básica completa)

---

#### CleaningItemStateRepo
**Ubicación:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`

**Métodos:**
- ✅ `getState(options, client)` — obtiene estado actual
- ✅ `upsertApplyRecurrent(options, client)` — aplica limpieza recurrente
- ✅ `upsertApplyOneTimeIncrementShared(options, client)` — incrementa una_vez SHARED
- ✅ `upsertApplyOneTimeSetRemainingShared(options, client)` — establece remaining SHARED

**Qué garantiza:**
- ✅ Proyección consistente del estado actual
- ✅ Separación por capa (shared/pde)

**Qué NO garantiza:**
- ❌ Listado de estados por alumno (no hay método `listStatesForStudent`)
- ❌ Listado de estados por item (no hay método `listStatesForItem`)
- ❌ Agregación de estados (no hay métodos de agregación)

**Estabilidad:**
- ✅ Estable (implementación básica completa)

---

### 3. Contrato de Señales

**Registry canónico:**
- ✅ `src/core/student/signals/student-signal-registry.js` — registry canónico

**Señales registradas relacionadas:**
- ✅ `student.domain.item.cleaned` — registrada (línea 106)
- ✅ `student.domain.bulk_cleaned` — registrada (línea 121)

**Señales NO registradas:**
- ❌ `clean.executed` — NO está en registry (se emite vía sistema legacy)

**Qué garantiza:**
- ✅ Solo se pueden emitir señales registradas (regla constitucional)
- ✅ Versionado y deprecación de señales

**Qué NO garantiza:**
- ❌ Que todas las señales emitidas estén registradas (hay señales legacy como `clean.executed`)

**Estabilidad:**
- ✅ Estable (registry v1 implementado)

---

### 4. Contrato de Contexto MASTER

**No se encontró contrato explícito de contexto MASTER para limpiezas.**

**Lo que existe:**
- ✅ Endpoints MASTER en `src/endpoints/master-api-alquimia-general.js`
- ✅ UI MASTER en `public/js/master/master-alquimia-general-client.js`
- ✅ Servicio en `src/services/alquimia-general-service.js`

**Qué garantiza:**
- ✅ Endpoints registrados en `master-route-registry.js`
- ✅ Handlers mapeados en `MASTER_HANDLER_MAP`

**Qué NO garantiza:**
- ❌ Contrato formal de contexto (no hay schema de contexto)
- ❌ Validación de contexto (no hay validadores)

**Estabilidad:**
- ⚠️ Difuso (existe pero sin contrato formal)

---

## 📦 BLOQUE E — HISTORIAL E INFORMES

### ¿Existe un SOT explícito de historial de limpiezas?

**✅ SÍ: `cleaning_events`**

**Características:**
- ✅ Append-only (no se modifica ni elimina)
- ✅ Event log completo con todos los campos necesarios
- ✅ Idempotencia garantizada
- ✅ Trazabilidad completa (trace_id, actor, surface_key, meta)

**Limitaciones:**
- ⚠️ NO hay concepto de "sesión" (no hay campo `session_id` o similar)
- ⚠️ NO hay agregación por sesión (no hay métodos para agrupar eventos por sesión)
- ⚠️ NO hay concepto de "informe" (no hay estructura para generar informes automáticos)

---

### ¿El historial está implícito/disperso?

**NO.** El historial está centralizado en `cleaning_events`.

**Lo que SÍ está disperso:**
- ⚠️ Estado actual en `cleaning_item_state` (proyección)
- ⚠️ Estado legacy en `student_item_state` (compatibilidad)
- ⚠️ Auditoría de `student_item_state` en `student_item_state_audit` (separada)

---

### ¿Se puede reconstruir un informe solo con lo existente?

**✅ SÍ, parcialmente.**

**Lo que SÍ se puede:**
- ✅ Listar todas las limpiezas de un alumno por item (`listEventsForStudentItem`)
- ✅ Obtener estado actual de un alumno por item (`getState`)
- ✅ Filtrar por `clean_layer` (shared/pde)
- ✅ Filtrar por `actor_type` (master/student/automation)
- ✅ Filtrar por rango de fechas (usando `created_at` en SQL directo)

**Lo que NO se puede (sin código adicional):**
- ❌ Agrupar limpiezas por "sesión" (no hay concepto de sesión)
- ❌ Generar informe automático por sesión (no hay estructura de sesión)
- ❌ Agregar limpiezas por día/semana/mes (no hay métodos de agregación)
- ❌ Obtener resumen de limpiezas de un alumno (no hay método `getStudentCleaningSummary`)

---

### ¿Qué datos faltan para generar un informe automático por sesión?

**Faltan:**
1. ❌ Concepto de "sesión" (no hay campo `session_id` en `cleaning_events`)
2. ❌ Agrupación de eventos por sesión (no hay métodos para agrupar)
3. ❌ Metadatos de sesión (no hay tabla `cleaning_sessions` o similar)
4. ❌ Resumen de sesión (no hay estructura para almacenar resumen)

**Lo que SÍ existe:**
- ✅ `trace_id` (puede usarse para correlación, pero no es lo mismo que sesión)
- ✅ `surface_key` (puede indicar origen, pero no agrupa por sesión)
- ✅ `created_at` (timestamp, puede usarse para agrupar por tiempo)

---

## 📦 BLOQUE F — GAPS Y PUNTOS CIEGOS

### Cosas que NO existen

1. ❌ **Concepto de "sesión" de limpieza**
   - No hay campo `session_id` en `cleaning_events`
   - No hay tabla `cleaning_sessions`
   - No hay métodos para agrupar eventos por sesión

2. ❌ **Sistema de informes automáticos**
   - No hay estructura para generar informes por sesión
   - No hay métodos de agregación de eventos
   - No hay resumen de limpiezas por alumno

3. ❌ **Señal `clean.executed` registrada**
   - Se emite pero NO está en Student Signal Registry
   - No es canónica del dominio Alumno

4. ❌ **Sincronización completa a `student_item_state`**
   - Función `syncToStudentItemState` está parcialmente implementada (solo loguea)
   - No escribe realmente en `student_item_state`

5. ❌ **Métodos de listado/agregación en repositorios**
   - `CleaningEventsRepo` solo tiene `listEventsForStudentItem` (por student+item)
   - No hay métodos para listar por alumno, por item, por rango de fechas, por sesión
   - `CleaningItemStateRepo` solo tiene `getState` (por student+item)
   - No hay métodos para listar estados por alumno o por item

6. ❌ **Contrato formal de contexto MASTER**
   - No hay schema de contexto para limpiezas
   - No hay validadores de contexto

---

### Cosas que existen pero no son suficientes

1. ⚠️ **Historial en `cleaning_events`**
   - ✅ Existe y es completo
   - ❌ No tiene concepto de sesión
   - ❌ No tiene métodos de agregación

2. ⚠️ **Señales emitidas**
   - ✅ Se emite `clean.executed`
   - ❌ NO está registrada en registry
   - ❌ No hay consumidores conocidos

3. ⚠️ **Estado actual en `cleaning_item_state`**
   - ✅ Existe y es completo
   - ❌ No tiene métodos de listado/agregación
   - ❌ No tiene resumen por alumno

4. ⚠️ **Sincronización SHARED → `student_item_state`**
   - ✅ Existe función `syncToStudentItemState`
   - ❌ Está parcialmente implementada (solo loguea, no escribe)

---

### Ambigüedades contractuales

1. ⚠️ **Señal `clean.executed` vs `student.domain.item.cleaned`**
   - Se emiten dos señales diferentes para lo mismo
   - `clean.executed` no está registrada
   - `student.domain.item.cleaned` está registrada pero no se emite desde Cleaning Engine

2. ⚠️ **Sincronización a `student_item_state`**
   - El contrato dice que SHARED sincroniza, pero la implementación solo loguea
   - No está claro si debe sincronizarse o no

3. ⚠️ **Concepto de "sesión"**
   - No existe en el sistema actual
   - No está claro si debe existir o no

---

### Riesgos si se implementa el panel sin cerrar esto antes

1. 🔴 **Riesgo ALTO: Informes por sesión**
   - Si el panel necesita mostrar "limpiezas de esta sesión", no hay datos para hacerlo
   - Requiere añadir concepto de sesión antes de implementar

2. 🟡 **Riesgo MEDIO: Sincronización incompleta**
   - Si el panel lee desde `student_item_state`, puede estar desincronizado
   - Requiere completar sincronización o leer desde `cleaning_item_state`

3. 🟡 **Riesgo MEDIO: Señales no registradas**
   - Si el panel necesita consumir señales, `clean.executed` no es canónica
   - Requiere registrar señal o usar `student.domain.item.cleaned`

4. 🟢 **Riesgo BAJO: Métodos de listado**
   - Si el panel necesita listar estados, puede hacer queries directas
   - No es crítico pero sería mejor tener métodos en repositorios

---

## 📦 BLOQUE G — RESUMEN EJECUTIVO

### 1. Qué partes del diseño técnico del panel YA están soportadas

✅ **Historial completo de limpiezas**
- Tabla `cleaning_events` con todos los datos necesarios
- Append-only, idempotente, trazable

✅ **Estado actual por alumno/item**
- Tabla `cleaning_item_state` con proyección completa
- Separación por capa (shared/pde)

✅ **Operaciones de limpieza**
- Cleaning Engine v1 implementado y funcional
- Funciones `markCleanStudent`, `markCleanAllStudents`, `setRemainingShared`
- Validación de pausados, nivel efectivo, idempotencia

✅ **Señales emitidas**
- Se emite `clean.executed` (aunque no registrada)
- Se puede consumir para automatizaciones

✅ **Repositorios básicos**
- `CleaningEventsRepo` con `insertEvent` y `listEventsForStudentItem`
- `CleaningItemStateRepo` con `getState` y métodos de actualización

---

### 2. Qué partes NO están soportadas todavía

❌ **Concepto de "sesión"**
- No hay campo `session_id` en eventos
- No hay tabla `cleaning_sessions`
- No hay métodos para agrupar eventos por sesión

❌ **Sistema de informes automáticos**
- No hay estructura para generar informes por sesión
- No hay métodos de agregación de eventos
- No hay resumen de limpiezas por alumno

❌ **Métodos de listado/agregación**
- No hay métodos para listar eventos por alumno (solo por student+item)
- No hay métodos para listar estados por alumno o por item
- No hay métodos de agregación (por día/semana/mes)

❌ **Sincronización completa**
- Función `syncToStudentItemState` solo loguea, no escribe
- Si el panel lee desde `student_item_state`, puede estar desincronizado

❌ **Señal canónica**
- `clean.executed` no está registrada en Student Signal Registry
- No es canónica del dominio Alumno

---

### 3. Qué es reutilizable sin tocar nada

✅ **Tablas existentes**
- `cleaning_events` — puede leerse directamente
- `cleaning_item_state` — puede leerse directamente
- `student_item_state` — puede leerse (pero puede estar desincronizado)

✅ **Cleaning Engine Service**
- Funciones `markCleanStudent`, `markCleanAllStudents`, `setRemainingShared`
- Pueden usarse tal cual para ejecutar limpiezas

✅ **Repositorios básicos**
- `CleaningEventsRepo.listEventsForStudentItem` — puede usarse para historial por item
- `CleaningItemStateRepo.getState` — puede usarse para estado actual

✅ **Estructura de datos**
- Payload de señales (aunque no registrada)
- Estructura de eventos en `cleaning_events`
- Estructura de estado en `cleaning_item_state`

---

### 4. Qué requiere diseño adicional antes de implementar

🔴 **CRÍTICO: Concepto de "sesión"**
- Si el panel necesita mostrar "limpiezas de esta sesión", requiere:
  - Añadir campo `session_id` a `cleaning_events` (migración)
  - Crear tabla `cleaning_sessions` (migración)
  - Modificar Cleaning Engine para generar/recibir `session_id`
  - Añadir métodos en repositorios para agrupar por sesión

🟡 **IMPORTANTE: Métodos de listado/agregación**
- Si el panel necesita listar estados/eventos, requiere:
  - Añadir métodos en `CleaningEventsRepo`: `listEventsForStudent`, `listEventsForItem`, `listEventsByDateRange`
  - Añadir métodos en `CleaningItemStateRepo`: `listStatesForStudent`, `listStatesForItem`
  - Añadir métodos de agregación: `getStudentCleaningSummary`, `getItemCleaningSummary`

🟡 **IMPORTANTE: Sincronización completa**
- Si el panel lee desde `student_item_state`, requiere:
  - Completar función `syncToStudentItemState` en Cleaning Engine
  - O cambiar el panel para leer desde `cleaning_item_state`

🟢 **OPCIONAL: Señal canónica**
- Si el panel necesita consumir señales, requiere:
  - Registrar `clean.executed` en Student Signal Registry
  - O usar `student.domain.item.cleaned` (ya registrada)

🟢 **OPCIONAL: Contrato de contexto**
- Si se quiere validación formal, requiere:
  - Crear schema de contexto MASTER para limpiezas
  - Crear validadores de contexto

---

## 🎯 CONCLUSIÓN

El sistema actual tiene una **base sólida** para el Panel de Alquimia del Alumno:

✅ **Historial completo** en `cleaning_events`  
✅ **Estado actual** en `cleaning_item_state`  
✅ **Operaciones funcionales** en Cleaning Engine  
✅ **Repositorios básicos** implementados

Sin embargo, **faltan piezas críticas** para informes automáticos por sesión:

❌ **Concepto de sesión** (no existe)  
❌ **Métodos de agregación** (no existen)  
❌ **Sincronización completa** (parcial)

**Recomendación:**
- Si el panel solo necesita mostrar estado actual e historial básico → **puede implementarse ahora**
- Si el panel necesita informes por sesión → **requiere diseño adicional primero**

---

**FIN DEL DIAGNÓSTICO**
