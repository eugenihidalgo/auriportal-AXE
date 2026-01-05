# UTE CORE v1 - Sistema Canónico de Limpiezas/Deberes

**Versión:** v5.53.0-ute-core-v1  
**Fecha:** 2025-01-XX  
**Estado:** ✅ Implementado (sin UI)

---

## 1. RESUMEN

Sistema canónico UTE (Limpiezas/Deberes) con:
- ✅ Event sourcing append-only para ejecuciones
- ✅ Proyecciones recalculables para estados
- ✅ Asignaciones flexibles (alumnos, grupos, universos)
- ✅ Estados: never, pending, reviewed, critical, completed
- ✅ Modos: recurrent (threshold_days) y one_time_count (required_count)
- ✅ Señales registradas y emitidas
- ✅ APIs MASTER completas

---

## 2. MODELO DE DATOS

### 2.1. Tablas

#### `ute_definitions`
Definiciones de UTE (qué es una limpieza/deber).

**Campos clave:**
- `id` (UUID) - PK
- `ute_key` (TEXT, UNIQUE) - Clave canónica
- `name` (TEXT) - Nombre legible
- `mode` (TEXT) - 'recurrent' o 'one_time_count'
- `threshold_days` (INTEGER) - Para mode='recurrent'
- `critical_multiplier` (NUMERIC, default 2.0) - Para mode='recurrent'
- `required_count` (INTEGER) - Para mode='one_time_count'
- `status` (TEXT) - 'active', 'archived', 'draft'
- `deleted_at` (TIMESTAMPTZ) - Soft delete

#### `ute_executions`
Ejecuciones append-only (event sourcing, INMUTABLE).

**Campos clave:**
- `id` (BIGSERIAL) - PK
- `ute_id` (UUID) - FK a ute_definitions
- `student_id` (INTEGER) - ID del alumno
- `executed_by` (TEXT) - 'student', 'master', 'system'
- `actor_id` (TEXT) - ID del actor
- `executed_at` (TIMESTAMPTZ) - Timestamp de ejecución
- `origin` (TEXT) - Origen: 'web_portal', 'master_panel', 'api', 'cron', 'migration'
- `trace_id` (TEXT) - Correlation ID

#### `ute_student_state`
Proyección del estado por alumno (read model, recalculable).

**Campos clave:**
- `id` (BIGSERIAL) - PK
- `ute_id` (UUID) - FK a ute_definitions
- `student_id` (INTEGER) - ID del alumno
- `state` (TEXT) - 'never', 'pending', 'reviewed', 'critical', 'completed'
- `last_executed_at` (TIMESTAMPTZ) - Última ejecución
- `count_executed` (INTEGER) - Contador de ejecuciones
- `days_since_last_execution` (INTEGER) - Días desde última ejecución
- `days_until_critical` (INTEGER) - Días hasta critical (recurrent)
- `remaining_count` (INTEGER) - Ejecuciones restantes (one_time_count)
- `last_execution_id` (BIGINT) - ID de última ejecución procesada
- `computed_at` (TIMESTAMPTZ) - Timestamp del último cálculo

#### `ute_assignments`
Asignaciones de UTE a targets.

**Campos clave:**
- `id` (BIGSERIAL) - PK
- `ute_id` (UUID) - FK a ute_definitions
- `target_type` (TEXT) - 'student', 'group', 'universe', 'all'
- `target_ref` (TEXT) - ID del target (null si target_type='all')
- `status` (TEXT) - 'active', 'archived'
- `deleted_at` (TIMESTAMPTZ) - Soft delete

---

## 3. CÁLCULO DE ESTADOS

### 3.1. Modo Recurrent

**Parámetros:**
- `threshold_days`: Días entre ejecuciones antes de pasar a "reviewed"
- `critical_multiplier`: Multiplicador para calcular días críticos (default 2.0)

**Estados:**
- `never`: Nunca ha ejecutado
- `pending`: `days_since_last_execution < threshold_days`
- `reviewed`: `threshold_days <= days_since_last_execution < threshold_days * critical_multiplier`
- `critical`: `days_since_last_execution >= threshold_days * critical_multiplier`

**Ejemplo:**
- `threshold_days = 7`, `critical_multiplier = 2.0`
- `pending`: 0-6 días
- `reviewed`: 7-13 días
- `critical`: 14+ días

### 3.2. Modo One Time Count

**Parámetros:**
- `required_count`: Número de ejecuciones requeridas para completar

**Estados:**
- `never`: Nunca ha ejecutado
- `pending`: `count_executed < required_count`
- `completed`: `count_executed >= required_count`

---

## 4. SEÑALES

### 4.1. Señales a Registrar

Las siguientes señales deben estar registradas en `pde_signals`:

#### `ute.created`
**Payload:**
```json
{
  "ute_id": "uuid",
  "ute_key": "string",
  "mode": "recurrent|one_time_count",
  "created_by": "string"
}
```

#### `ute.assigned`
**Payload:**
```json
{
  "ute_id": "uuid",
  "target_type": "student|group|universe|all",
  "target_ref": "string|null",
  "assigned_by": "string"
}
```

#### `ute.executed`
**Payload:**
```json
{
  "ute_id": "uuid",
  "student_id": "integer",
  "executed_by": "student|master|system",
  "executed_at": "timestamp"
}
```

#### `ute.executed.global`
**Payload:**
```json
{
  "ute_id": "uuid",
  "executed_by": "student|master|system",
  "students_count": "integer",
  "executed_at": "timestamp"
}
```

#### `ute.state.changed`
**Payload:**
```json
{
  "ute_id": "uuid",
  "student_id": "integer",
  "previous_state": "never|pending|reviewed|critical|completed",
  "new_state": "never|pending|reviewed|critical|completed"
}
```

### 4.2. Registro de Señales

Las señales se emiten automáticamente desde el servicio `ute-core-service.js` usando `dispatchSignal()`.

Si las señales no existen en `pde_signals`, deben crearse manualmente o mediante script de migración.

---

## 5. ENDPOINTS MASTER API

### 5.1. GET /master/api/ute/definitions

Lista definiciones UTE.

**Query params:**
- `status` (opcional): 'active', 'archived', 'draft'
- `mode` (opcional): 'recurrent', 'one_time_count'

**Respuesta:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "ute_key": "string",
      "name": "string",
      "mode": "recurrent",
      "threshold_days": 7,
      "critical_multiplier": 2.0,
      ...
    }
  ],
  "trace_id": "string"
}
```

### 5.2. POST /master/api/ute/definitions

Crea una definición UTE.

**Body:**
```json
{
  "ute_key": "limpieza_energetica_diaria",
  "name": "Limpieza Energética Diaria",
  "description": "Limpieza energética diaria",
  "mode": "recurrent",
  "threshold_days": 7,
  "critical_multiplier": 2.0,
  "metadata": {}
}
```

**Respuesta:**
```json
{
  "ok": true,
  "data": { ... },
  "trace_id": "string"
}
```

### 5.3. GET /master/api/ute/:ute_id/states

Lista alumnos agrupados por estado.

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "never": [],
    "pending": [],
    "reviewed": [],
    "critical": [],
    "completed": []
  },
  "trace_id": "string"
}
```

### 5.4. POST /master/api/ute/:ute_id/execute

Ejecuta UTE para 1 alumno.

**Body:**
```json
{
  "student_id": 123,
  "executed_by": "master",
  "actor_id": "master_id",
  "executed_at": "2025-01-XXT...",
  "origin": "master_panel",
  "notes": "Ejecución manual"
}
```

### 5.5. POST /master/api/ute/:ute_id/execute_global

Ejecuta UTE para todos los alumnos asignados.

**Body:**
```json
{
  "executed_by": "master",
  "actor_id": "master_id",
  "executed_at": "2025-01-XXT...",
  "origin": "master_panel"
}
```

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "executions_count": 50,
    "executions": [...]
  },
  "trace_id": "string"
}
```

### 5.6. POST /master/api/ute/:ute_id/recompute

Recalcula estados de todos los alumnos.

**Body:**
```json
{
  "dry_run": true,
  "apply": false
}
```

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "total": 50,
    "processed": 50,
    "updated": 0,
    "errors": 0,
    "states": {
      "never": 5,
      "pending": 30,
      "reviewed": 10,
      "critical": 5,
      "completed": 0
    },
    "changes": [...]
  },
  "trace_id": "string"
}
```

---

## 6. SERVICIOS

### 6.1. `ute-core-service.js`

Servicio canónico con lógica de negocio:

- `createUteDefinition()` - Crea definición
- `listUteDefinitions()` - Lista definiciones
- `recordExecution()` - Registra ejecución (append-only)
- `computeStudentUteState()` - Calcula estado
- `recomputeUteStatesForAllStudents()` - Recalcula estados (dry-run + apply)
- `getUteStudentsByState()` - Obtiene alumnos por estado
- `executeGlobal()` - Ejecuta para todos

---

## 7. REPOSITORIOS

### 7.1. Contratos (`src/core/repos/`)
- `ute-repo.js` - Definitions y Assignments
- `ute-executions-repo.js` - Executions (append-only)
- `ute-state-repo.js` - Student State (proyección)

### 7.2. Implementaciones (`src/infra/repos/`)
- `ute-repo-pg.js` - PostgreSQL
- `ute-executions-repo-pg.js` - PostgreSQL
- `ute-state-repo-pg.js` - PostgreSQL

---

## 8. VERIFICACIÓN

### 8.1. Verificar Migración

```sql
SELECT * FROM ute_definitions;
SELECT * FROM ute_executions LIMIT 10;
SELECT * FROM ute_student_state LIMIT 10;
SELECT * FROM ute_assignments;
```

### 8.2. Verificar Endpoints

```bash
# Listar definiciones
curl -i http://localhost:3000/master/api/ute/definitions

# Crear definición
curl -i -X POST http://localhost:3000/master/api/ute/definitions \
  -H "Content-Type: application/json" \
  -d '{
    "ute_key": "test_limpieza",
    "name": "Test Limpieza",
    "mode": "recurrent",
    "threshold_days": 7
  }'
```

### 8.3. Assembly Checks

```bash
npm run check:master-api
```

---

## 9. PRÓXIMOS PASOS

1. ✅ Migración aplicada
2. ✅ Repos y servicios creados
3. ✅ Endpoints MASTER API creados
4. ⏳ Registrar señales en `pde_signals` (manual o script)
5. ⏳ Crear UI (futuro)
6. ⏳ Tests (futuro)

---

## 10. NOTAS

- **PostgreSQL es el único Source of Truth**
- **Executions son INMUTABLES (append-only)**
- **Estados son recalculables desde cero**
- **Señales se emiten automáticamente**
- **Logs estructurados con trace_id**

---

**Estado:** ✅ Núcleo canónico implementado (sin UI)
