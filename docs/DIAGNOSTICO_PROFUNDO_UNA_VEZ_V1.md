# DIAGNÓSTICO PROFUNDO — UNA_VEZ (ALQUIMIA GENERAL / MASTER)
**Fecha:** 2026-01-13  
**Modo:** LECTURA Y ANÁLISIS (sin cambios)  
**Alcance:** Alquimia General (MASTER) - Backend - Persistencia - Proyecciones - Flotante

---

## 1) MAPA ACTUAL DEL SISTEMA UNA_VEZ

### A) BACKEND

#### 1.1 Cleaning Engine Service (`cleaning-engine-service.js`)

**Función principal:** `markCleanStudent()` (líneas 134-434)

**Flujo para UNA_VEZ:**
```
markCleanStudent({ item_kind: 'una_vez', ... })
  ↓
1. Validación: item_kind === 'una_vez' (línea 180-182)
2. Obtiene item del catálogo (línea 204)
3. Lee item.veces_limpiar || 1 (línea 370)
4. Genera execution_key (APPLY: idempotente por día, CERTIFY: único) (línea 301)
5. Inserta evento en cleaning_events con:
   - delta_completed: 1 (línea 316)
   - item_kind: 'una_vez' (línea 314)
6. Llama upsertApplyOneTimeIncrementShared() (línea 371-377)
```

**Función:** `markCleanAllStudents()` (líneas 452-628)

**Flujo para UNA_VEZ:**
```
markCleanAllStudents({ item_kind: 'una_vez', ... })
  ↓
1. Obtiene todos los estudiantes activos (no pausados) (líneas 517-533)
2. NO filtra por nivel si item_kind === 'una_vez' (línea 556: condición false)
3. Para cada estudiante, llama markCleanStudent() (línea 566-578)
4. Retorna { updated, skipped, skipped_breakdown }
```

**Función:** `incrementAllStudents()` (líneas 644-668)

**Flujo:**
```
incrementAllStudents({ item_kind: 'una_vez', ... })
  ↓
1. WARNING DEPRECATION si falta item_kind (líneas 649-658)
2. Delega a markCleanAllStudents() con:
   - item_kind: 'una_vez' (hardcodeado)
   - skip_level_filter: true (por defecto) (línea 666)
```

**Punto crítico:** `upsertApplyOneTimeIncrementShared()` (líneas 369-378)

**Código real:**
```javascript
// Línea 370
const requiredCount = item.veces_limpiar || 1;

// Línea 371-377
state = await stateRepo.upsertApplyOneTimeIncrementShared({
  student_uuid,
  product_key,
  domain_type,
  item_ref,
  required_count: requiredCount
}, client);
```

#### 1.2 Repositorio Cleaning Item State (`cleaning-item-state-repo-pg.js`)

**Función:** `upsertApplyOneTimeIncrementShared()` (líneas 161-227)

**SQL ejecutado:**
```sql
INSERT INTO cleaning_item_state (
  student_id, product_key, domain_type, item_ref,
  shared_clean_count, shared_remaining, shared_completed
) VALUES (
  $1, $2, $3, $4, 1, GREATEST(0, $5 - 1), 
  CASE WHEN $5 - 1 <= 0 THEN 1 ELSE 0 END
)
ON CONFLICT (student_id, product_key, domain_type, item_ref)
DO UPDATE SET
  shared_clean_count = cleaning_item_state.shared_clean_count + 1,
  shared_remaining = GREATEST(0, cleaning_item_state.shared_remaining - 1),
  shared_completed = CASE 
    WHEN GREATEST(0, cleaning_item_state.shared_remaining - 1) <= 0 THEN 1 
    ELSE 0 
  END
```

**Observaciones:**
- Incrementa `shared_clean_count` siempre
- Decrementa `shared_remaining` (clamp a 0)
- Recalcula `shared_completed` basado en nuevo `remaining`
- **NO valida si ya está completo** (puede seguir incrementando)

#### 1.3 Repositorio Cleaning Events (`cleaning-events-repo-pg.js`)

**Función:** `insertEvent()` (líneas 34-117)

**Idempotencia:**
- Constraint UNIQUE: `(execution_key, student_id)` (línea 68)
- Si ya existe → retorna `{ already_executed: true }` (línea 95)
- **NO bloquea ejecución**, solo informa

**Campos relevantes para UNA_VEZ:**
- `delta_completed`: 1 (para mark_clean una_vez)
- `item_kind`: 'una_vez'
- `action_type`: 'mark_clean'

### B) BASE DE DATOS

#### 2.1 Tabla `cleaning_events` (append-only)

**Estructura relevante:**
```sql
- execution_key TEXT NOT NULL (idempotencia)
- student_id INTEGER NOT NULL
- item_ref TEXT NOT NULL
- clean_layer TEXT CHECK IN ('shared','pde')
- item_kind TEXT CHECK IN ('recurrente','una_vez')
- action_type TEXT CHECK IN ('mark_clean','set_remaining')
- delta_completed INTEGER NULL (para una_vez: +1)
- set_remaining INTEGER NULL
```

**Constraint de idempotencia:**
```sql
UNIQUE INDEX idx_cleaning_events_execution_student 
  ON cleaning_events(execution_key, student_id)
```

**Formato execution_key:**
- APPLY: `mark_clean:{item_ref}:{student_uuid}:{YYYY-MM-DD}` (idempotente por día)
- CERTIFY: `certify:{item_ref}:{student_uuid}:{timestamp}` (siempre único)

#### 2.2 Tabla `cleaning_item_state` (proyección)

**Estructura relevante para UNA_VEZ:**
```sql
- student_id INTEGER (PK parcial)
- product_key TEXT (PK parcial)
- domain_type TEXT (PK parcial)
- item_ref TEXT (PK parcial)
- shared_clean_count INTEGER DEFAULT 0
- shared_remaining INTEGER DEFAULT 0
- shared_completed INTEGER DEFAULT 0
- pde_completed INTEGER DEFAULT 0 (solo audit, no afecta remaining)
```

**Lógica de campos:**
- `shared_clean_count`: Contador de veces limpiado (siempre incrementa)
- `shared_remaining`: Restantes (decrementa, clamp a 0)
- `shared_completed`: 1 si `remaining <= 0`, 0 si `remaining > 0`

**Observación crítica:** No hay constraint que impida `remaining < 0` o `completed > 1`. El clamp se hace en SQL con `GREATEST(0, ...)`.

#### 2.3 Tabla `items_transmutaciones` (catálogo)

**Campo relevante:**
- `veces_limpiar INTEGER` (puede ser NULL, fallback a 1)

### C) PROYECCIONES Y CONTADORES

#### 3.1 Cálculo en Alquimia General Service (`alquimia-general-service.js`)

**Función:** `getStudentsForItem()` (líneas 462-651)

**Para UNA_VEZ (líneas 621-651):**
```javascript
// Lee desde Cleaning Engine
const rawResult = await repo.getStudentsForItemFromCleaningEngine(...);

// Mapea estados
const studentsWithState = students.map(student => {
  const remaining = student.remaining !== null ? student.remaining : null;
  const completed = student.completed || 0;
  const isComplete = remaining !== null && remaining <= 0;
  
  return {
    ...student,
    state: isComplete ? 'completed' : 'pending',
    remaining,
    completed
  };
});

// Cuenta
const counts = {
  completed: studentsWithState.filter(s => s.state === 'completed').length,
  pending: studentsWithState.filter(s => s.state === 'pending').length
};
```

**Origen de datos:** `getStudentsForItemFromCleaningEngine()` (repositorio)

#### 3.2 Repositorio Master Student Transmutation Read (`master-student-transmutation-read-repo-pg.js`)

**Función:** `getStudentsForItemFromCleaningEngine()` (líneas 154-284)

**SQL para UNA_VEZ:**
```sql
SELECT 
  s.id as student_uuid,
  s.legacy_alumno_id as legacy_student_id,
  c.shared_remaining,
  c.shared_completed,
  c.pde_completed
FROM students s
LEFT JOIN cleaning_item_state c ON c.student_id = s.legacy_alumno_id
  AND c.product_key = $1
  AND c.domain_type = $2
  AND c.item_ref = $3
LEFT JOIN pausas p ON p.alumno_id = s.legacy_alumno_id AND p.fin IS NULL
WHERE s.deleted_at IS NULL
  AND p.id IS NULL
ORDER BY s.id ASC
```

**Mapeo para UNA_VEZ (líneas 244-268):**
```javascript
const remaining = cleanLayer === 'shared' 
  ? (row.shared_remaining !== null ? parseInt(row.shared_remaining, 10) : null)
  : null;
const completed = cleanLayer === 'shared'
  ? (row.shared_completed !== null ? parseInt(row.shared_completed, 10) : 0)
  : (row.pde_completed !== null ? parseInt(row.pde_completed, 10) : 0);
const isComplete = remaining !== null && remaining <= 0;
```

**Observación:** Si `shared_remaining IS NULL`, se trata como `null` (no como 0).

### D) UI / FLOTANTE (LECTURA)

#### 4.1 Frontend Alquimia General (`master-alquimia-general-client.js`)

**Función:** `handleVerItem()` (aproximadamente línea 1200+)

**Llamada API:**
```javascript
GET /master/api/alquimia-general/items/:item_ref/students?clean_layer=shared
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "data": {
    "students": [
      {
        "student_uuid": "...",
        "display_name": "...",
        "remaining": 2,
        "completed": 0,
        "state": "pending"
      }
    ],
    "counts": {
      "completed": 5,
      "pending": 10
    },
    "total": 15
  }
}
```

**Renderizado:** Agrupa estudiantes por `state` ('completed' vs 'pending')

---

## 2) DIFERENCIAS REALES CON RECURRENTES

### A) EN PERSISTENCIA

| Aspecto | RECURRENTES | UNA_VEZ |
|---------|-----------|---------|
| **Tabla de eventos** | `cleaning_events` con `delta_completed: null` | `cleaning_events` con `delta_completed: 1` |
| **Proyección** | `shared_last_cleaned_at`, `shared_clean_count` | `shared_clean_count`, `shared_remaining`, `shared_completed` |
| **Execution key** | `mark_clean:{item_ref}:{uuid}:{day}` | `mark_clean:{item_ref}:{uuid}:{day}` (mismo formato) |
| **Idempotencia** | Por día (mismo día = mismo execution_key) | Por día (mismo día = mismo execution_key) |

### B) EN LÓGICA DE NEGOCIO

| Aspecto | RECURRENTES | UNA_VEZ |
|---------|-----------|---------|
| **Decisión "completo"** | Basado en `last_cleaned_at` + `threshold_days` | Basado en `remaining <= 0` |
| **Bloqueo de ejecución** | NO (siempre puede limpiar) | NO (puede seguir incrementando aunque `remaining = 0`) |
| **Validación de nivel** | Se aplica en `markCleanAllStudents` (línea 556) | NO se aplica (línea 556: condición false) |
| **Función de proyección** | `upsertApplyRecurrent()` | `upsertApplyOneTimeIncrementShared()` |

### C) EN CÁLCULO DE ESTADOS

| Aspecto | RECURRENTES | UNA_VEZ |
|---------|-----------|---------|
| **Estados posibles** | 'never', 'reviewed', 'pending', 'important' | 'pending', 'completed' |
| **Cálculo** | Basado en `days_since_last_clean` vs `threshold_days` | Basado en `remaining <= 0` |
| **Fuente de datos** | `shared_last_cleaned_at` | `shared_remaining`, `shared_completed` |

---

## 3) PUNTOS DE FRICCIÓN / DEBILIDAD

### A) DÓNDE SE BLOQUEA

**NO CONSTA EN EL CÓDIGO que se bloquee la ejecución cuando `remaining = 0`.**

**Evidencia:**
- `upsertApplyOneTimeIncrementShared()` (línea 198): Incrementa `shared_clean_count` siempre
- `upsertApplyOneTimeIncrementShared()` (línea 202): Decrementa `remaining` (puede quedar negativo, clamp a 0)
- No hay validación previa que verifique `remaining > 0` antes de ejecutar

**Consecuencia:** Un item UNA_VEZ puede seguir incrementando `clean_count` aunque `remaining = 0` y `completed = 1`.

### B) DÓNDE SE OMITE

**Idempotencia por execution_key:**
- Si mismo `execution_key` + mismo `student_id` → evento no se inserta (línea 89-95 de `cleaning-events-repo-pg.js`)
- Retorna `{ already_executed: true }` pero **NO bloquea la proyección**
- La proyección (`cleaning_item_state`) se actualiza igual (línea 337-352 de `cleaning-engine-service.js`)

**Consecuencia:** Si se llama `markCleanStudent()` dos veces el mismo día con mismo `execution_key`, el evento no se duplica, pero la proyección podría actualizarse dos veces (depende de si hay transacción).

### C) DÓNDE SE PIERDE INFORMACIÓN

**1. Estado inicial NULL:**
- Si `shared_remaining IS NULL` en DB, se trata como `null` (no como 0)
- Frontend calcula `isComplete = remaining !== null && remaining <= 0`
- Si `remaining === null` → `isComplete = false` → estado 'pending'
- **Pérdida:** No se distingue entre "nunca inicializado" y "pendiente con remaining > 0"

**2. Clean count vs remaining:**
- `shared_clean_count` puede ser > `veces_limpiar` si se sigue limpiando después de completar
- `shared_remaining` se clamp a 0, pero `clean_count` sigue incrementando
- **Pérdida:** No hay relación explícita entre `clean_count` y `remaining` después de completar

**3. Execution mode CERTIFY:**
- CERTIFY genera `execution_key` único (no idempotente)
- Pero la proyección sigue usando misma lógica de incremento
- **Pérdida:** CERTIFY no tiene efecto diferente en la proyección (solo en eventos)

---

## 4) COSAS QUE YA SIRVEN

### A) IDEMPOTENCIA DE EVENTOS

**Funciona correctamente:**
- Constraint UNIQUE en `(execution_key, student_id)` previene duplicados
- Retorna `{ already_executed: true }` cuando ya existe
- Logs estructurados informan cuando se omite

**Evidencia:** `cleaning-events-repo-pg.js` líneas 68, 89-95

### B) PROYECCIÓN INCREMENTAL

**Funciona correctamente:**
- `upsertApplyOneTimeIncrementShared()` actualiza `clean_count`, `remaining`, `completed` en una sola operación
- Clamp de `remaining` a 0 previene valores negativos
- Recalcula `completed` basado en nuevo `remaining`

**Evidencia:** `cleaning-item-state-repo-pg.js` líneas 188-216

### C) LECTURA DESDE CLEANING ENGINE

**Funciona correctamente:**
- `getStudentsForItemFromCleaningEngine()` lee desde `cleaning_item_state` con JOIN correcto
- Filtra estudiantes pausados
- Retorna `remaining` y `completed` para UNA_VEZ

**Evidencia:** `master-student-transmutation-read-repo-pg.js` líneas 154-284

### D) VALIDACIÓN DE ITEM_KIND

**Funciona correctamente:**
- Validación explícita en `markCleanStudent()` (línea 180-182)
- Validación en handlers API (líneas 915-916, 948-949 de `master-api-alquimia-general.js`)
- Fallback legacy con WARNING en `incrementAllStudents()` (líneas 649-658)

**Evidencia:** Múltiples validaciones en cadena

### E) EXCLUSIÓN DE PAUSADOS

**Funciona correctamente:**
- `markCleanAllStudents()` filtra pausados antes de procesar (líneas 524-533)
- `getStudentsForItemFromCleaningEngine()` excluye pausados en SQL (línea 182)
- `markCleanStudent()` retorna `null` si está pausado (líneas 193-200)

**Evidencia:** Filtrado en múltiples capas

---

## 5) COSAS QUE IMPIDEN QUE UNA_VEZ SEA CANÓNICO

### A) FALTA DE VALIDACIÓN DE COMPLETADO

**Problema:** No se valida si `remaining <= 0` antes de ejecutar limpieza.

**Evidencia:**
- `markCleanStudent()` no verifica estado previo (líneas 134-434)
- `upsertApplyOneTimeIncrementShared()` no valida `remaining > 0` (líneas 161-227)

**Impacto:** Permite limpiar items ya completados, incrementando `clean_count` indefinidamente.

### B) INCONSISTENCIA ENTRE CLEAN_COUNT Y REMAINING

**Problema:** `shared_clean_count` puede ser > `veces_limpiar` si se sigue limpiando después de completar.

**Evidencia:**
- `upsertApplyOneTimeIncrementShared()` incrementa `clean_count` siempre (línea 198)
- `remaining` se clamp a 0, pero `clean_count` sigue incrementando

**Impacto:** No hay relación explícita entre `clean_count` y `remaining` después de completar.

### C) ESTADO NULL NO DISTINGUIDO

**Problema:** `shared_remaining IS NULL` se trata igual que `remaining > 0` en algunos lugares.

**Evidencia:**
- `getStudentsForItemFromCleaningEngine()` retorna `null` si no existe estado (línea 246)
- Frontend calcula `isComplete = remaining !== null && remaining <= 0` (línea 629 de `alquimia-general-service.js`)
- Si `remaining === null` → `isComplete = false` → estado 'pending'

**Impacto:** No se distingue entre "nunca inicializado" y "pendiente con remaining > 0".

### D) EXECUTION MODE CERTIFY SIN EFECTO EN PROYECCIÓN

**Problema:** CERTIFY genera `execution_key` único, pero la proyección usa misma lógica que APPLY.

**Evidencia:**
- `generateExecutionKey()` genera key único para CERTIFY (línea 38)
- Pero `upsertApplyOneTimeIncrementShared()` no diferencia entre APPLY y CERTIFY

**Impacto:** CERTIFY no tiene efecto diferente en la proyección (solo en eventos).

### E) FALTA DE VALIDACIÓN DE REQUIRED_COUNT EN PROYECCIÓN

**Problema:** `upsertApplyOneTimeIncrementShared()` recibe `required_count` pero no lo valida contra `veces_limpiar` del catálogo.

**Evidencia:**
- `markCleanStudent()` lee `item.veces_limpiar || 1` (línea 370)
- Pasa `required_count` a `upsertApplyOneTimeIncrementShared()` (línea 376)
- Pero no valida que `required_count` coincida con `veces_limpiar` actual

**Impacto:** Si `veces_limpiar` cambia después de inicializar, `remaining` puede quedar desincronizado.

### F) FALTA DE SEED INICIAL PARA ESTADOS NUEVOS

**Problema:** Si un estudiante nuevo nunca ha limpiado un item UNA_VEZ, `shared_remaining` puede ser NULL.

**Evidencia:**
- `getStudentsForItemFromCleaningEngine()` retorna `remaining: null` si no existe estado (línea 246)
- Frontend trata `null` como 'pending' (línea 629)

**Impacto:** No se distingue entre "nunca inicializado" y "pendiente con remaining > 0".

---

## RESUMEN EJECUTIVO

### Estado Actual

**Funciona:**
- Idempotencia de eventos (constraint UNIQUE)
- Proyección incremental (UPSERT con cálculo)
- Lectura desde Cleaning Engine (JOIN correcto)
- Validación de `item_kind`
- Exclusión de pausados

**No funciona como debería:**
- No valida completado antes de ejecutar
- `clean_count` puede exceder `veces_limpiar`
- Estado NULL no distinguido
- CERTIFY sin efecto en proyección
- Falta validación de `required_count` vs catálogo
- Falta seed inicial para estados nuevos

### Diferencia Principal con Recurrentes

**RECURRENTES:**
- Siempre pueden limpiarse (no hay concepto de "completo")
- Estado basado en tiempo (`last_cleaned_at` vs `threshold_days`)
- Validación de nivel aplicada

**UNA_VEZ:**
- Debería bloquearse cuando `remaining <= 0` (pero NO lo hace)
- Estado basado en contador (`remaining` vs `veces_limpiar`)
- Validación de nivel NO aplicada (by design para Master)

### Punto Crítico

**El sistema UNA_VEZ NO bloquea ejecuciones cuando `remaining = 0`.**

Esto significa que:
1. Un item puede seguir incrementando `clean_count` indefinidamente
2. `remaining` se clamp a 0, pero `clean_count` sigue creciendo
3. No hay relación explícita entre `clean_count` y `remaining` después de completar

---

## NOTAS FINALES

Este diagnóstico se basa EXCLUSIVAMENTE en el código real existente. No se han propuesto soluciones ni cambios. El objetivo es mapear el sistema actual para poder diseñar UNA_VEZ v1 con la misma robustez que recurrentes, sin romper nada existente.

**Próximo paso sugerido:** Diseñar UNA_VEZ v1 canónico basado en este diagnóstico.
