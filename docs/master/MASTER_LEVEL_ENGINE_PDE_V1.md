# MASTER: Level Engine PDE v1
## AuriPortal / Aurelín
**Fecha:** 2025-01-XX  
**Versión:** v5.57.0  
**Feature Flag:** `level_engine_pde_v1` (OFF por defecto)

---

## ═══════════════════════════════════════════════════════════════
## RESUMEN EJECUTIVO
## ═══════════════════════════════════════════════════════════════

El **Level Engine PDE v1** es el sistema canónico de cálculo y persistencia de niveles y fases PDE (Progreso de Despertar Espiritual) en AuriPortal.

**Principios fundamentales:**
1. **PostgreSQL es el único SOT** de niveles y fases PDE
2. **Level Engine es el único decisor** de nivel/fase PDE
3. **Señales canónicas** para cambios de nivel/fase
4. **Soporta alumnos sin PDE** (línea ausente/inactiva)
5. **Congela conteo en pausas** (PAUSED/SUSPENDED)
6. **Feature flag**: `level_engine_pde_v1` (OFF por defecto)

**Estado actual:**
- ✅ Migración SQL creada (`v5.57.0-level-engine-pde-v1.sql`)
- ✅ Repos core + infra PostgreSQL implementados
- ✅ Servicio canónico `level-engine-service.js` operativo
- ✅ Señales registradas y emitidas
- ✅ Endpoints MASTER `/master/api/levels/*` y `/master/api/students/:uuid/levels`
- ✅ Scripts de verificación (`verify-level-engine-db.js`, `verify-level-engine-sample.js`)
- ⚠️ **Feature flag OFF** (APIs responden con datos mínimos o 404)
- 📝 Documentación canónica (este documento)

---

## ═══════════════════════════════════════════════════════════════
## ARQUITECTURA
## ═══════════════════════════════════════════════════════════════

### Componentes Principales

1. **Source of Truth (PostgreSQL)**
   - `level_lines`: Líneas de progreso (p.ej. PDE, Canalización)
   - `level_definitions`: Definiciones de niveles por días
   - `phase_definitions`: Agrupaciones de niveles en fases
   - `level_gates`: Bloqueos futuros (estructura preparada)
   - `student_level_state`: Estado actual por alumno/línea
   - `student_level_history`: Historial auditado de cambios

2. **Repositorios (Core + Infra)**
   - `LevelLinesRepo`: Gestión de líneas
   - `LevelDefinitionsRepo`: Definiciones de niveles
   - `PhaseDefinitionsRepo`: Definiciones de fases
   - `LevelGatesRepo`: Bloqueos (futuro)
   - `StudentLevelStateRepo`: Estado del alumno
   - `StudentLevelHistoryRepo`: Historial auditado

3. **Servicio Canónico**
   - `level-engine-service.js`: Lógica de cómputo y persistencia
   - `computeAndPersist()`: Calcula y persiste estado
   - `ensureLineStarted()`: Inicializa línea si no existe
   - `getStudentLevels()`: Obtiene estados del alumno
   - `recomputeStudent()`: Fuerza recálculo

4. **Endpoints MASTER**
   - `GET /master/api/levels/lines`: Lista líneas activas
   - `GET /master/api/levels/lines/:line_key/definitions`: Definiciones de línea
   - `GET /master/api/students/:student_uuid/levels`: Estado del alumno
   - `POST /master/api/levels/recompute/:student_uuid`: Recalcular estado

5. **Señales**
   - `student.pde.level.changed`: Cambio de nivel
   - `student.pde.phase.changed`: Cambio de fase
   - `student.pde.upgrade.pending`: Actualización pendiente
   - `student.pde.upgrade.locked`: Bloqueo de actualización

---

## ═══════════════════════════════════════════════════════════════
## MODELO DE DATOS
## ═══════════════════════════════════════════════════════════════

### `level_lines` (Líneas de Nivel)

```sql
CREATE TABLE level_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Seed inicial:**
- `line_key: 'pde'`, `display_name: 'PDE (Progreso de Despertar Espiritual)'`

**Uso:** Define las líneas de progreso disponibles (p.ej. PDE, Canalización).

---

### `level_definitions` (Definiciones de Niveles)

```sql
CREATE TABLE level_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_key TEXT NOT NULL REFERENCES level_lines(line_key) ON DELETE CASCADE,
  level_number INT NOT NULL,
  min_days INT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(line_key, level_number),
  UNIQUE(line_key, min_days)
);
```

**Seed inicial:**
- `line_key: 'pde'`, `level_number: 1`, `min_days: 0`, `title: 'Nivel 1'`
- `line_key: 'pde'`, `level_number: 2`, `min_days: 30`, `title: 'Nivel 2'`
- `line_key: 'pde'`, `level_number: 3`, `min_days: 60`, `title: 'Nivel 3'`

**Uso:** Define los niveles por días transcurridos desde inicio.

---

### `phase_definitions` (Definiciones de Fases)

```sql
CREATE TABLE phase_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_key TEXT NOT NULL REFERENCES level_lines(line_key) ON DELETE CASCADE,
  phase_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  min_days INT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(line_key, phase_key)
);
```

**Seed inicial:**
- `line_key: 'pde'`, `phase_key: 'inicio'`, `display_name: 'Inicio'`, `min_days: 0`
- `line_key: 'pde'`, `phase_key: 'sanacion_avanzada'`, `display_name: 'Sanación Avanzada'`, `min_days: 60`

**Uso:** Agrupa niveles en fases semánticas.

---

### `level_gates` (Bloqueos Futuros)

```sql
CREATE TABLE level_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_key TEXT NOT NULL REFERENCES level_lines(line_key) ON DELETE CASCADE,
  target_level_number INT NOT NULL,
  gate_key TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(line_key, target_level_number, gate_key)
);
```

**Estado:** Estructura preparada para bloqueos futuros. Por ahora, todos los niveles son accesibles sin gates.

---

### `student_level_state` (Estado del Alumno)

```sql
CREATE TABLE student_level_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  line_key TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  frozen_seconds BIGINT NOT NULL DEFAULT 0,
  computed_days INT NOT NULL DEFAULT 0,
  current_level_number INT,
  current_phase_key TEXT,
  upgrade_status TEXT NOT NULL DEFAULT 'available' CHECK (upgrade_status IN ('available', 'pending', 'locked')),
  pending_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, line_key)
);
```

**Campos clave:**
- `started_at`: Fecha de inicio de la línea (p.ej. alta en AuriPortal para PDE)
- `frozen_seconds`: Segundos congelados por pausas (PAUSED/SUSPENDED)
- `computed_days`: Días transcurridos efectivos (considerando pausas)
- `current_level_number`: Nivel actual según `computed_days`
- `current_phase_key`: Fase actual según `computed_days`
- `upgrade_status`: Estado de actualización (`available`, `pending`, `locked`)

**Uso:** Estado actualizado del alumno para cada línea.

---

### `student_level_history` (Historial Auditado)

```sql
CREATE TABLE student_level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  line_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  before JSONB NOT NULL DEFAULT '{}'::jsonb,
  after JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_type TEXT,
  actor_id TEXT,
  trace_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Eventos:**
- `level_started`: Inicio de línea
- `level_computed`: Recalculo de nivel/fase
- `level_changed`: Cambio de nivel
- `phase_changed`: Cambio de fase
- `upgrade_status_changed`: Cambio de estado de actualización

**Uso:** Auditoría completa de cambios para forensics.

---

## ═══════════════════════════════════════════════════════════════
## LÓGICA DE CÓMPUTO
## ═══════════════════════════════════════════════════════════════

### Resolución de Fecha de Inicio

Para la línea 'pde', la fecha de inicio se resuelve así:

1. **Prioridad 1:** `students.created_at` (fecha alta en AuriPortal)
2. **Prioridad 2:** `alumnos.fecha_inscripcion` (legacy, si existe link `legacy_alumno_id`)
3. **Fallback:** `now()` (se registra en `meta` para revisión manual)

**Función:** `resolveStudentStartDate(student_uuid, line_key)`

---

### Cálculo de Días Congelados

Los días se congelan cuando el alumno está en estado operativo `PAUSED` o `SUSPENDED`.

**Función:** `computeFrozenSeconds(student_uuid, started_at, now)`

**Lógica:**
1. Consulta `student_operational_state` para obtener estados `PAUSED`/`SUSPENDED`
2. Suma todos los segundos dentro del rango `[started_at, now]` donde el estado fue `PAUSED` o `SUSPENDED`
3. Retorna total de segundos congelados

**Ejemplo:**
- Alumno alta: `2025-01-01 00:00:00`
- Pausa: `2025-01-10 00:00:00` → `2025-01-20 00:00:00` (10 días = 864000 segundos)
- Ahora: `2025-01-31 00:00:00`
- Días totales: 30 días
- Días congelados: 10 días
- `computed_days`: 20 días

---

### Cálculo de Nivel Actual

**Función:** `computeCurrentLevel(line_key, computed_days)`

**Lógica:**
1. Consulta `level_definitions` para `line_key` con `status='active'`
2. Filtra niveles donde `min_days <= computed_days`
3. Ordena por `level_number DESC`
4. Retorna el nivel con mayor `level_number` que cumple `min_days <= computed_days`

**Ejemplo:**
- `computed_days: 45`
- Niveles: `1 (0 días)`, `2 (30 días)`, `3 (60 días)`
- Nivel actual: `2` (cumple `30 <= 45`, pero `3` requiere `60 > 45`)

---

### Cálculo de Fase Actual

**Función:** `computeCurrentPhase(line_key, computed_days)`

**Lógica:**
1. Consulta `phase_definitions` para `line_key` con `status='active'`
2. Filtra fases donde `min_days <= computed_days`
3. Ordena por `min_days DESC`
4. Retorna la fase con mayor `min_days` que cumple `min_days <= computed_days`

**Ejemplo:**
- `computed_days: 75`
- Fases: `inicio (0 días)`, `sanacion_avanzada (60 días)`
- Fase actual: `sanacion_avanzada` (cumple `60 <= 75`)

---

### Estado de Actualización (Upgrade Status)

**Función:** `computeUpgradeStatus(line_key, current_level_number, computed_days)`

**Lógica:**
1. Consulta `level_definitions` para obtener siguiente nivel (`level_number + 1`)
2. Si no existe siguiente nivel: `upgrade_status = 'available'` (está en máximo nivel)
3. Si existe siguiente nivel: calcula días restantes hasta `min_days` del siguiente nivel
4. Si días restantes <= 0: `upgrade_status = 'pending'` (puede subir nivel)
5. Si días restantes > 0: `upgrade_status = 'available'` (aún no puede subir)
6. Si existen `level_gates` activos: `upgrade_status = 'locked'` (bloqueado por gates)

**Por ahora:** Gates no están implementados, así que solo `available` o `pending`.

---

## ═══════════════════════════════════════════════════════════════
## SERVICIO CANÓNICO
## ═══════════════════════════════════════════════════════════════

### `level-engine-service.js`

**Ubicación:** `src/core/master/services/level-engine-service.js`

**Métodos principales:**

#### `ensureLineStarted(student_uuid, line_key)`

Inicializa el estado de una línea si no existe.

**Lógica:**
1. Verifica si existe `student_level_state` para `(student_uuid, line_key)`
2. Si no existe:
   - Resuelve `started_at` usando `resolveStudentStartDate()`
   - Crea entrada en `student_level_state` con `computed_days=0`, `current_level_number=NULL`, etc.
   - Emite evento `level_started` en `student_level_history`
3. Retorna estado (existente o nuevo)

---

#### `computeAndPersist(student_uuid, line_key, now = new Date())`

Calcula y persiste el estado actual del alumno.

**Lógica:**
1. Asegura que la línea esté inicializada (`ensureLineStarted()`)
2. Obtiene `started_at` de `student_level_state`
3. Calcula `frozen_seconds` usando `computeFrozenSeconds()`
4. Calcula `computed_days` = `Math.floor((now - started_at) / 86400) - Math.floor(frozen_seconds / 86400)`
5. Calcula `current_level_number` usando `computeCurrentLevel()`
6. Calcula `current_phase_key` usando `computeCurrentPhase()`
7. Calcula `upgrade_status` y `pending_requirements` usando `computeUpgradeStatus()`
8. Compara con estado anterior (`student_level_state`)
9. Si hay cambios:
   - Actualiza `student_level_state`
   - Emite eventos en `student_level_history` (`level_changed`, `phase_changed`, etc.)
   - **Emite señales** (`student.pde.level.changed`, `student.pde.phase.changed`, etc.)
10. Retorna estado actualizado

---

#### `getStudentLevels(student_uuid)`

Obtiene todos los estados de nivel del alumno.

**Retorna:**
```json
{
  "student_id": "uuid",
  "levels": [
    {
      "line_key": "pde",
      "started_at": "2025-01-01T00:00:00Z",
      "computed_days": 45,
      "current_level_number": 2,
      "current_level_title": "Nivel 2",
      "current_phase_key": "inicio",
      "current_phase_name": "Inicio",
      "upgrade_status": "available",
      "pending_requirements": [],
      "last_computed_at": "2025-01-31T12:00:00Z"
    }
  ]
}
```

---

#### `recomputeStudent(student_uuid, line_key = null)`

Fuerza recálculo del estado.

**Lógica:**
- Si `line_key` es `null`: recalcula todas las líneas del alumno
- Si `line_key` es especificado: recalcula solo esa línea
- Usa `computeAndPersist()` internamente

---

## ═══════════════════════════════════════════════════════════════
## SEÑALES
## ═══════════════════════════════════════════════════════════════

### Registro

**Ubicación:** `src/core/student/signals/student-signal-registry.js`

**Señales registradas:**

1. **`student.pde.level.changed`**
   - **Payload:**
     ```json
     {
       "student_id": "uuid",
       "line_key": "pde",
       "before": { "level_number": 1, "level_title": "Nivel 1" },
       "after": { "level_number": 2, "level_title": "Nivel 2" },
       "computed_days": 35,
       "trace_id": "uuid"
     }
     ```
   - **Emisión:** Cuando `current_level_number` cambia en `computeAndPersist()`

2. **`student.pde.phase.changed`**
   - **Payload:**
     ```json
     {
       "student_id": "uuid",
       "line_key": "pde",
       "before": { "phase_key": "inicio", "phase_name": "Inicio" },
       "after": { "phase_key": "sanacion_avanzada", "phase_name": "Sanación Avanzada" },
       "computed_days": 65,
       "trace_id": "uuid"
     }
     ```
   - **Emisión:** Cuando `current_phase_key` cambia en `computeAndPersist()`

3. **`student.pde.upgrade.pending`**
   - **Payload:**
     ```json
     {
       "student_id": "uuid",
       "line_key": "pde",
       "current_level_number": 2,
       "next_level_number": 3,
       "computed_days": 60,
       "trace_id": "uuid"
     }
     ```
   - **Emisión:** Cuando `upgrade_status` cambia a `'pending'` en `computeAndPersist()`

4. **`student.pde.upgrade.locked`**
   - **Payload:**
     ```json
     {
       "student_id": "uuid",
       "line_key": "pde",
       "current_level_number": 2,
       "target_level_number": 3,
       "gate_key": "gate_example",
       "pending_requirements": [],
       "trace_id": "uuid"
     }
     ```
   - **Emisión:** Cuando `upgrade_status` cambia a `'locked'` (futuro, cuando gates estén implementados)

---

### Emisión

**Función:** `dispatchSignal(signalKey, payload, options)`

**Ubicación:** `src/core/signals/signal-dispatcher.js`

**Características:**
- **Fail-open:** Si la emisión falla, no bloquea el flujo principal
- **Trace ID:** Incluye `trace_id` del request actual o genera uno nuevo
- **Estructurado:** Logs estructurados con prefijo `[LevelEngine]`

---

## ═══════════════════════════════════════════════════════════════
## ENDPOINTS MASTER
## ═══════════════════════════════════════════════════════════════

### Registro de Rutas

**Ubicación:** `src/core/master/registry/master-route-registry.js`

**Rutas registradas:**
- `master-api-levels-lines`: `GET /master/api/levels/lines`
- `master-api-levels-line-definitions`: `GET /master/api/levels/lines/:line_key/definitions`
- `master-api-students-levels`: `GET /master/api/students/:student_uuid/levels`
- `master-api-levels-recompute-student`: `POST /master/api/levels/recompute/:student_uuid`

---

### Handler: `master-api-levels.js`

**Ubicación:** `src/endpoints/master-api-levels.js`

#### `GET /master/api/levels/lines`

Lista todas las líneas activas.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "line_key": "pde",
      "display_name": "PDE (Progreso de Despertar Espiritual)",
      "status": "active"
    }
  ],
  "trace_id": "uuid"
}
```

**Feature Flag:** Si `level_engine_pde_v1` está OFF, retorna `404 Not Found`.

---

#### `GET /master/api/levels/lines/:line_key/definitions`

Obtiene definiciones (niveles + fases) de una línea.

**Response:**
```json
{
  "ok": true,
  "data": {
    "line_key": "pde",
    "display_name": "PDE (Progreso de Despertar Espiritual)",
    "levels": [
      {
        "level_number": 1,
        "min_days": 0,
        "title": "Nivel 1",
        "status": "active"
      },
      {
        "level_number": 2,
        "min_days": 30,
        "title": "Nivel 2",
        "status": "active"
      }
    ],
    "phases": [
      {
        "phase_key": "inicio",
        "display_name": "Inicio",
        "min_days": 0,
        "status": "active"
      }
    ]
  },
  "trace_id": "uuid"
}
```

**Feature Flag:** Si `level_engine_pde_v1` está OFF, retorna `404 Not Found`.

---

### Handler: `master-api-student-levels.js`

**Ubicación:** `src/endpoints/master-api-student-levels.js`

#### `GET /master/api/students/:student_uuid/levels`

Obtiene estados de nivel del alumno.

**Auth:** Requiere `requireAdminContext()` (solo Master puede consultar).

**Response:**
```json
{
  "ok": true,
  "data": {
    "student_id": "uuid",
    "levels": [
      {
        "line_key": "pde",
        "started_at": "2025-01-01T00:00:00Z",
        "computed_days": 45,
        "current_level_number": 2,
        "current_level_title": "Nivel 2",
        "current_phase_key": "inicio",
        "current_phase_name": "Inicio",
        "upgrade_status": "available",
        "pending_requirements": [],
        "last_computed_at": "2025-01-31T12:00:00Z"
      }
    ]
  },
  "trace_id": "uuid"
}
```

**Feature Flag:** Si `level_engine_pde_v1` está OFF, retorna `404 Not Found`.

**Headers anti-cache:**
- `Cache-Control: no-store, no-cache, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

---

#### `POST /master/api/levels/recompute/:student_uuid`

Fuerza recálculo del estado del alumno.

**Auth:** Requiere `requireAdminContext()` (solo Master puede forzar recálculo).

**Query params:**
- `line_key` (opcional): Si se especifica, recalcula solo esa línea. Si no, recalcula todas.

**Response:**
```json
{
  "ok": true,
  "data": {
    "student_id": "uuid",
    "lines_recomputed": ["pde"],
    "levels": [
      {
        "line_key": "pde",
        "started_at": "2025-01-01T00:00:00Z",
        "computed_days": 45,
        "current_level_number": 2,
        "current_level_title": "Nivel 2",
        "current_phase_key": "inicio",
        "current_phase_name": "Inicio",
        "upgrade_status": "available",
        "pending_requirements": [],
        "last_computed_at": "2025-01-31T12:00:00Z"
      }
    ]
  },
  "trace_id": "uuid"
}
```

**Feature Flag:** Si `level_engine_pde_v1` está OFF, retorna `404 Not Found`.

**Headers anti-cache:**
- `Cache-Control: no-store, no-cache, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

---

## ═══════════════════════════════════════════════════════════════
## FEATURE FLAG
## ═══════════════════════════════════════════════════════════════

### `level_engine_pde_v1`

**Ubicación:** `src/core/feature-flags/feature-flag-registry.js`

**Configuración:**
```javascript
{
  key: 'level_engine_pde_v1',
  description: 'Habilita el Level Engine PDE v1 como autoridad de niveles y fases',
  type: 'runtime',
  scope: 'system',
  default: false,
  irreversible: false
}
```

**Estado actual:** `OFF` (por defecto)

**Comportamiento cuando OFF:**
- Endpoints retornan `404 Not Found`
- Servicio no realiza cálculos (retorna early)
- Señales no se emiten

**Comportamiento cuando ON:**
- Endpoints funcionan normalmente
- Servicio calcula y persiste estados
- Señales se emiten cuando hay cambios

---

## ═══════════════════════════════════════════════════════════════
## VERIFICACIÓN Y TESTING
## ═══════════════════════════════════════════════════════════════

### Scripts de Verificación

#### `verify-level-engine-db.js`

**Ubicación:** `scripts/verify-level-engine-db.js`

**Qué verifica:**
1. Existencia de tablas (`level_lines`, `level_definitions`, `phase_definitions`, etc.)
2. Constraints (UNIQUE, FOREIGN KEY, CHECK)
3. Índices
4. Seed data (línea 'pde', niveles iniciales, fases iniciales)

**Ejecución:**
```bash
npm run verify:levels
# o directamente:
node scripts/verify-level-engine-db.js
```

---

#### `verify-level-engine-sample.js`

**Ubicación:** `scripts/verify-level-engine-sample.js`

**Qué verifica:**
1. Creación de estado para alumno de prueba
2. Cálculo de `computed_days` con pausas
3. Cálculo de nivel/fase
4. Persistencia en `student_level_state`
5. Eventos en `student_level_history`
6. Emisión de señales (mock)

**Ejecución:**
```bash
npm run verify:levels
# o directamente:
node scripts/verify-level-engine-sample.js
```

---

### Testing Manual

**Prerequisitos:**
1. Aplicar migración SQL: `psql -d aurelinportal -f database/migrations/v5.57.0-level-engine-pde-v1.sql`
2. Activar feature flag: `level_engine_pde_v1 = true` (vía UI Admin o DB directo)

**Tests:**

1. **Listar líneas:**
   ```bash
   curl -i http://localhost:3000/master/api/levels/lines
   ```

2. **Obtener definiciones:**
   ```bash
   curl -i http://localhost:3000/master/api/levels/lines/pde/definitions
   ```

3. **Consultar estado del alumno:**
   ```bash
   curl -i -H "Cookie: ..." http://localhost:3000/master/api/students/{student_uuid}/levels
   ```

4. **Forzar recálculo:**
   ```bash
   curl -i -X POST -H "Cookie: ..." http://localhost:3000/master/api/levels/recompute/{student_uuid}
   ```

---

## ═══════════════════════════════════════════════════════════════
## OBSERVABILIDAD
## ═══════════════════════════════════════════════════════════════

### Logging Estructurado

**Prefijo:** `[LevelEngine]`

**Ejemplos:**
```
[LevelEngine] computeAndPersist iniciado: { student_id: 'uuid', line_key: 'pde' }
[LevelEngine] Nivel calculado: { computed_days: 45, current_level: 2 }
[LevelEngine] Señal emitida: student.pde.level.changed
```

**Funciones:**
- `logInfo('LevelEngine', message, context)`
- `logWarn('LevelEngine', message, context)`
- `logError('LevelEngine', message, context, error)`

**Ubicación:** `src/core/observability/logger.js`

---

### Trace ID

Todas las operaciones incluyen `trace_id`:
- Extraído del request actual (`getRequestId()`)
- Si no existe, se genera uno nuevo (`randomUUID()`)
- Incluido en logs, señales, y respuestas API

---

### Forensics

**Tabla:** `student_level_history`

**Consultas útiles:**

1. **Cambios de nivel de un alumno:**
   ```sql
   SELECT * FROM student_level_history
   WHERE student_id = 'uuid' AND event_type = 'level_changed'
   ORDER BY at DESC;
   ```

2. **Cambios de fase:**
   ```sql
   SELECT * FROM student_level_history
   WHERE student_id = 'uuid' AND event_type = 'phase_changed'
   ORDER BY at DESC;
   ```

3. **Eventos por trace_id:**
   ```sql
   SELECT * FROM student_level_history
   WHERE trace_id = 'uuid'
   ORDER BY at ASC;
   ```

---

## ═══════════════════════════════════════════════════════════════
## INTEGRACIÓN CON OTROS DOMINIOS
## ═══════════════════════════════════════════════════════════════

### Regla Constitucional

**Orden Pipeline:**
> "Las pantallas de dominios (alquimia, lugares, proyectos, apadrinados) NO deben introducir lógica de nivel. Deben consultar al Level Engine para obtener nivel/fase actual."

**Implementación futura:**
- Pantallas consultan `GET /master/api/students/:student_uuid/levels` (o helper JS)
- Level Engine emite señales para automatizaciones
- Automatizaciones escuchan `student.pde.level.changed`, `student.pde.phase.changed`, etc.

---

### Señales para Automatizaciones

**Ejemplo:**
```javascript
// Automatización escucha señal
onSignal('student.pde.level.changed', (payload) => {
  if (payload.after.level_number === 3) {
    // Enviar email de bienvenida al nivel 3
    sendEmail(payload.student_id, 'nivel3-welcome');
  }
});
```

---

## ═══════════════════════════════════════════════════════════════
## FUTURO
## ═══════════════════════════════════════════════════════════════

### Gates (Bloqueos)

**Estado:** Estructura preparada (`level_gates`), lógica pendiente.

**Uso futuro:**
- Bloquear subida de nivel si faltan requisitos (p.ej. completar transmutación, proyecto, etc.)
- `upgrade_status = 'locked'` cuando hay gates activos
- Señal `student.pde.upgrade.locked` cuando se detecta bloqueo

---

### Líneas Adicionales

**Estado:** Sistema preparado para múltiples líneas.

**Ejemplos futuros:**
- `line_key: 'canalizacion'`: Línea de canalización
- `line_key: 'creacion'`: Línea de creación
- Cada línea con sus propias definiciones de niveles/fases

---

### UI Master

**Estado:** Endpoints listos, UI pendiente.

**Planes futuros:**
- Pantalla `/master/system/levels` para ver todos los alumnos y sus niveles
- Pantalla `/master/system/levels/:line_key` para ver alumnos de una línea específica
- Visualización de historial de cambios

---

## ═══════════════════════════════════════════════════════════════
## REFERENCIAS
## ═══════════════════════════════════════════════════════════════

### Archivos Clave

- **Migración SQL:** `database/migrations/v5.57.0-level-engine-pde-v1.sql`
- **Servicio:** `src/core/master/services/level-engine-service.js`
- **Repos Core:** `src/core/repos/levels/*`
- **Repos Infra:** `src/infra/repos/levels/*`
- **Endpoints:** `src/endpoints/master-api-levels.js`, `src/endpoints/master-api-student-levels.js`
- **Señales:** `src/core/student/signals/student-signal-registry.js`
- **Feature Flag:** `src/core/feature-flags/feature-flag-registry.js`
- **Routes:** `src/core/master/registry/master-route-registry.js`
- **Router:** `src/core/master/router/master-router-resolver.js`
- **Scripts:** `scripts/verify-level-engine-db.js`, `scripts/verify-level-engine-sample.js`

### Documentación Relacionada

- `docs/master/MASTER_DIAGNOSTIC_STUDENTS_SPONSORS_V1.md`: Diagnóstico de estudiantes y sponsors
- `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`: Principios de Source of Truth
- `.cursorrules`: Reglas canónicas del proyecto (incluye reglas del Level Engine)

---

**Fin del documento**
