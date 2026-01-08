# MASTER: Cleaning Engine v1 - Diseño As-Built

**Versión:** v5.59.0-master-cleaning-engine-v1  
**Fecha:** 2026-01-08  
**Estado:** ✅ Diseño completo

---

## 1. OBJETIVO

Introducir un Cleaning Engine canónico (single decider) que soporte:
- 2 capas de limpieza (SHARED vs PDE)
- Actores (master/student/automation)
- Exclusión de alumnos en PAUSA
- Integración fina con Alquimia General
- Soporte completo "Una vez" (editar `veces_limpiar`, acciones y modal VER)

---

## 2. ARQUITECTURA

### 2.1. Dos Capas de Limpieza (clean_layer)

- **SHARED**: Visible al alumno, cuenta como "limpio" en su mundo
- **PDE**: Repaso/master-only, NO marca como limpio al alumno

**Regla:** Toda acción declara su capa: `clean_layer = 'shared' | 'pde'`

### 2.2. Actores

- `actor_type`: `'master' | 'student' | 'automation'`
- `actor_ref`: `{ type, id/email/uuid }` (mínimo) o string estable
- `surface`: De dónde vino la acción (ej: `'master.alquimia_general'`, `'student.alquimia'`, `'auto.job'`)

### 2.3. Tipos de Ítem

- **Recurrente**: Estado por tiempo desde "última limpieza" (pero SOLO en la capa que estés mirando)
- **Una vez**: Estado por contador (`required_count / remaining / completed`), pero SOLO en SHARED
  - En PDE, por defecto solo registramos eventos (audit) y opcionalmente un contador PDE separado (NO afecta remaining del alumno)

### 2.4. Exclusión PAUSA

Alumnos en pausa:
- No aparecen en VER
- No entran en clean-all
- No se les modifica estado
- No cuentan en agregados

**Mecanismo canónico:** Usar `getPausaActiva()` de `PausaRepoPg` (tabla `pausas` con `fin IS NULL`)

### 2.5. Integración con Progreso/Niveles

- Cada item tiene un campo `nivel` (numérico)
- El estado SHARED del alumno para un item SOLO "aplica" si `item.nivel <= nivel_efectivo` del alumno (line_key='pde')
- Si NO aplica: no cuenta y, en el modal VER, se muestra en sección colapsable "NO APLICA (nivel)" (sin botones)

---

## 3. TABLAS

### 3.1. cleaning_events (append-only, audit real)

```sql
CREATE TABLE cleaning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trace_id TEXT NOT NULL,
  execution_key TEXT NOT NULL,  -- Para idempotencia por alumno+acción
  student_id INTEGER NOT NULL REFERENCES alumnos(id),
  product_key TEXT NOT NULL DEFAULT 'pde',
  domain_type TEXT NOT NULL,  -- ej: 'transmutation'
  item_ref TEXT NOT NULL,
  clean_layer TEXT NOT NULL CHECK (clean_layer IN ('shared','pde')),
  item_kind TEXT NOT NULL CHECK (item_kind IN ('recurrente','una_vez')),
  action_type TEXT NOT NULL CHECK (action_type IN ('mark_clean','set_remaining')),
  delta_completed INTEGER NULL,  -- Para una_vez mark_clean => +1
  set_remaining INTEGER NULL,    -- Para set_remaining
  actor_type TEXT NOT NULL CHECK (actor_type IN ('master','student','automation')),
  actor_ref TEXT NULL,
  surface_key TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(execution_key, student_id)
);

CREATE INDEX idx_cleaning_events_student_item 
  ON cleaning_events(student_id, product_key, domain_type, item_ref);
CREATE INDEX idx_cleaning_events_item_layer 
  ON cleaning_events(item_ref, clean_layer);
CREATE INDEX idx_cleaning_events_trace 
  ON cleaning_events(trace_id);
```

### 3.2. cleaning_item_state (proyección canónica)

```sql
CREATE TABLE cleaning_item_state (
  student_id INTEGER NOT NULL REFERENCES alumnos(id),
  product_key TEXT NOT NULL DEFAULT 'pde',
  domain_type TEXT NOT NULL,
  item_ref TEXT NOT NULL,
  shared_last_cleaned_at TIMESTAMPTZ NULL,
  pde_last_cleaned_at TIMESTAMPTZ NULL,
  shared_clean_count INTEGER NOT NULL DEFAULT 0,
  pde_clean_count INTEGER NOT NULL DEFAULT 0,
  shared_completed INTEGER NOT NULL DEFAULT 0,  -- Para una_vez
  shared_remaining INTEGER NOT NULL DEFAULT 0,   -- Para una_vez
  pde_completed INTEGER NOT NULL DEFAULT 0,     -- Opcional, no afecta alumno
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, product_key, domain_type, item_ref)
);

CREATE INDEX idx_cleaning_item_state_item_ref 
  ON cleaning_item_state(item_ref);
CREATE INDEX idx_cleaning_item_state_shared_last_cleaned 
  ON cleaning_item_state(shared_last_cleaned_at) 
  WHERE shared_last_cleaned_at IS NOT NULL;
CREATE INDEX idx_cleaning_item_state_pde_last_cleaned 
  ON cleaning_item_state(pde_last_cleaned_at) 
  WHERE pde_last_cleaned_at IS NOT NULL;
```

**Compatibilidad:** Cuando `clean_layer='shared'`, también actualizamos `student_item_state` (last_cleaned_at/clean_count OR remaining/completed) para que lo viejo siga funcionando.

---

## 4. REPOS

### 4.1. CleaningEventsRepo

**Core contract:** `src/core/repos/cleaning/cleaning-events-repo.js`  
**Infra PG:** `src/infra/repos/cleaning/cleaning-events-repo-pg.js`

**Métodos:**
- `insertEvent(event)` - Respeta idempotencia; si duplicate => devolver "already_applied"
- `listEventsForStudentItem({student_id, product_key, domain_type, item_ref, limit})`

### 4.2. CleaningItemStateRepo

**Core contract:** `src/core/repos/cleaning/cleaning-item-state-repo.js`  
**Infra PG:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`

**Métodos:**
- `getState({student_id, product_key, domain_type, item_ref})`
- `upsertApplyRecurrent({ student_id, ..., clean_layer, cleaned_at })`
- `upsertApplyOneTimeIncrementShared({ ..., required_count })` - Decrement remaining con clamp
- `upsertApplyOneTimeSetRemainingShared({ ..., remaining })`
- (Opcional) `applyPdeCounters` para una_vez (solo meta/audit)

---

## 5. SERVICIO CANÓNICO

**Ubicación:** `src/core/master/services/cleaning-engine-service.js`

**Responsabilidades:**
- Validar inputs (item_ref existente, item tipo, required_count para una_vez, etc.)
- Resolver alumno paused (y excluir)
- Insert event (idempotente)
- Aplicar a proyección cleaning_item_state
- Si clean_layer='shared', sincronizar a student_item_state (compat)
- Emitir señales (fail-open)

**Métodos principales:**
- `markCleanStudent({ student_id, item_ref, clean_layer, actor_type, surface_key, ... })`
- `markCleanAllStudents({ item_ref, clean_layer, actor_type, surface_key, ... })`
- `incrementOneTimeShared({ student_id, item_ref, required_count, ... })`
- `setRemainingShared({ student_id, item_ref, remaining, ... })`

---

## 6. INTEGRACIÓN CON ALQUIMIA GENERAL

### 6.1. Refactor en alquimia-general-service.js

Sustituir escritura directa de estado por llamadas al Cleaning Engine:
- `mark-clean-all` => `cleaningEngine.markCleanAllStudents({ item_ref, clean_layer:'shared', actor:'master', surface:'master.alquimia_general' })`
- Botón PDE => misma operación pero `clean_layer:'pde'`
- `mark-clean-student` => `cleaningEngine.markCleanStudent({ student_id, item_ref, clean_layer:'shared', ... })`
- PDE individual => `clean_layer:'pde'`

### 6.2. Lectura del modal VER

- Para recurrentes:
  - Para `clean_layer='shared'`: usa `shared_last_cleaned_at` (y/o compat `student_item_state.last_cleaned_at`)
  - Para `clean_layer='pde'`: usa `pde_last_cleaned_at`
- Aplica regla "NO APLICA por nivel":
  - Obtén `nivel_efectivo` del alumno (Level Engine line_key='pde')
  - Si `item.nivel > nivel_efectivo` => a "NO APLICA (nivel)" y NO cuenta en reviewed/pending/important
- Para una_vez:
  - Usa `shared_remaining/shared_completed` (proyección)
  - "Completado" si `remaining<=0`
  - El botón ✓ en el modal ejecuta "mark_clean" (incrementa completed, decrementa remaining)
  - PDE en una_vez: por defecto solo registra evento y `pde_completed` (no toca remaining del alumno)

### 6.3. Exclusión PAUSA

El listado de alumnos para VER y clean-all debe venir ya filtrado por "no paused".  
Reutilizar `getPausaActiva()` de `PausaRepoPg`.

---

## 7. APIs MASTER

### 7.1. Endpoints existentes (ampliar con clean_layer)

- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all`
  - Body opcional: `{ clean_layer:'shared'|'pde' }` (default 'shared')
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`
  - Body: `{ student_id, clean_layer? }` (default shared)

### 7.2. Completar soporte UNA VEZ

- `GET /master/api/alquimia-general/items/:item_ref/students`
  - Debe devolver también, para una_vez: `remaining/completed + state = completed|pending`
  - Debe aceptar query o body `clean_layer` para ver shared vs pde
- `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`
  - Body opcional: `{ clean_layer:'shared'|'pde' }` (default shared)
  - Para shared => incrementa 1 para cada alumno (no paused) respetando remaining clamp
- `POST /master/api/alquimia-general/items/:item_ref/master/adjust-remaining`
  - Body: `{ student_id, remaining }` (solo shared)
  - Registra `cleaning_events` action_type='set_remaining' (audit)

---

## 8. UI MASTER

### 8.1. Tabla de ITEMS (Una vez)

- Añadir edición de `veces_limpiar` (required_count) por item:
  - Mostrar input numérico en columna correspondiente
  - Al guardar/blur/enter: llamar endpoint de update item (PUT) y persistir `veces_limpiar`
  - Validaciones: int >= 0. Si 0 => se considera "NUNCA/No obligatorio" (solo manual)

### 8.2. Acciones por item (Una vez)

- Mantener VER
- Añadir botón PDE (morado) como en recurrentes:
  - Ejecuta increment-all con `clean_layer='pde'` (o acción equivalente si decides que PDE en una_vez es solo audit)
- (Opcional) Añadir botón "+1" (verde) para increment-all shared

### 8.3. Modal VER

- Debe soportar recurrente y una_vez
- Debe tener toggle simple:
  - "Vista: Alumno (SHARED) | PDE"
  - SHARED = lo que cuenta para el alumno
  - PDE = repaso master-only
- Columnas:
  - Para recurrente: REVISADO / PENDIENTE / IMPORTANTE REVISAR
  - Para una_vez: COMPLETADO / PENDIENTE
- Sección colapsable extra:
  - "NO APLICA (nivel)" con alumnos cuyo `nivel_efectivo < item.nivel` (sin botones)
- En SHARED:
  - ✓ por alumno hace mark_clean_student (o increment 1 en una_vez)
- En PDE:
  - ✓ por alumno registra PDE clean (no toca SHARED)

### 8.4. Exclusión PAUSA

- Los alumnos en pausa no aparecen en el modal (ni en NO APLICA)
- Si intentas limpiar un alumno en pausa (por race): devolver error amable y recargar modal

---

## 9. SEÑALES

Mantener compatibilidad con lo que ya existe (`origin.executed`, `origin.completed`) pero enriquecer payload:
- Incluir `clean_layer`, `actor_type`, `surface_key`, `product_key`, `domain_type`, `item_ref`
- Para una_vez: incluir `remaining/completed` resultante (shared)

**Fail-open:** Si señales fallan, la limpieza NO falla.

---

## 10. IDEMPOTENCIA

- `execution_key`: Formato `{action_type}:{item_ref}:{student_id}:{timestamp_day}` (o similar)
- `UNIQUE(execution_key, student_id)` en `cleaning_events`
- Si duplicate => devolver "already_applied" sin error

---

## 11. CASOS LÍMITE

1. **Alumno en pausa intenta limpiar (race):** Error amable, recargar modal
2. **Item no existe:** Validar antes de insertar evento
3. **required_count no definido (una_vez):** Usar default 1 o error según política
4. **remaining < 0 (clamp):** No permitir negativo, clamp a 0
5. **Nivel no aplica:** Mostrar en sección "NO APLICA" sin botones

---

## 12. VERIFICACIÓN

### Scripts

- `scripts/verify-cleaning-engine-db.js` - Verifica tablas/índices/constraints
- `scripts/verify-cleaning-engine-sample.js` - Crea item de prueba y ejecuta operaciones

### Smoke Tests

- Abrir `/master/templo-luz/alquimia-general`
- Ir a "Una vez"
- Editar `veces_limpiar` de un item y comprobar persistencia
- Abrir VER y hacer ✓ en un alumno => cambia su estado
- Ejecutar PDE y comprobar que NO cambia la vista Alumno (SHARED), pero sí cambia la vista PDE

---

## 13. DOCUMENTACIÓN

- `docs/master/MASTER_CLEANING_ENGINE_V1.md` - Documentación completa
- Actualizar `docs/master/MASTER_ALQUIMIA_GENERAL_V1.md` con sección "Cleaning Engine v1"
- Actualizar `.cursorrules` con reglas constitucionales

---

**Estado:** ✅ Diseño completo, listo para implementación
