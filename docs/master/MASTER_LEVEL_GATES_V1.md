# MASTER LEVEL GATES v1

**Versión:** v1  
**Fecha:** 2025-01-XX  
**Estado:** Implementado, migrado, verificado  
**Feature Flag:** `level_gates_v1` (OFF por defecto)

---

## Resumen Ejecutivo

Level Gates v1 es el sistema canónico de bloqueo declarativo de niveles en AuriPortal. Permite definir condiciones que deben cumplirse antes de que un alumno pueda subir de nivel, incluso si ya cumple los días mínimos requeridos.

**Principios Fundamentales:**
- Gates son **multi-línea** (por `line_key`, no por producto)
- Gates **NO congelan días** (solo bloquean upgrade)
- Gates se evalúan **SOLO cuando** `computed_days >= min_days` del siguiente nivel
- Evaluación usa **Condition Engine v1** (sin eval(), sin Function())
- Feature flag `level_gates_v1` controla activación

---

## Arquitectura

### Componentes

1. **Condition Engine v1**
   - Contrato canónico de condiciones declarativas
   - Evaluador seguro (sin eval(), sin Function())
   - Soporta: `all`, `any`, operadores (`==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `contains`, `exists`, `truthy`)

2. **Level Engine (modificado)**
   - Aplica gates cuando flag está ON
   - Evalúa gates con Condition Engine
   - Actualiza `upgrade_status` y `pending_requirements`

3. **APIs MASTER**
   - `GET /master/api/levels/lines/:line_key/gates` - Listar gates
   - `POST /master/api/levels/lines/:line_key/gates` - Crear gate
   - `PUT /master/api/levels/gates/:gate_id` - Actualizar gate
   - `POST /master/api/levels/gates/:gate_id/deprecate` - Deprecar gate

4. **UI MASTER**
   - `/master/alumnos/:student_uuid/progreso` - Progreso del alumno
   - `/master/systema/levels/gates` - Gestión global de gates

---

## Condition Engine v1

### Contrato Canónico

```json
{
  "all": [
    { "path": "level.computed_days", "op": ">=", "value": 30 },
    { "path": "student.email", "op": "contains", "value": "@example.com" }
  ]
}
```

O:

```json
{
  "any": [
    { "path": "level.computed_days", "op": ">=", "value": 60 },
    { "path": "student.created_at", "op": "<", "value": "2024-01-01T00:00:00Z" }
  ]
}
```

### Operadores Soportados

- `==` - Igualdad (con coerción de tipos)
- `!=` - Desigualdad
- `>` - Mayor que (numérico)
- `>=` - Mayor o igual (numérico)
- `<` - Menor que (numérico)
- `<=` - Menor o igual (numérico)
- `in` - Contenido en array
- `contains` - String o array contiene valor
- `exists` - Path existe (no requiere `value`)
- `truthy` - Valor es truthy (no requiere `value`)

### Contexto de Evaluación

```javascript
{
  now_iso: "2025-01-XXT...",
  student: {
    id: "uuid",
    uuid: "uuid",
    email: "...",
    apodo: "...",
    created_at: "..."
  },
  line: {
    line_key: "pde"
  },
  level: {
    started_at: "...",
    frozen_seconds: 0,
    computed_days: 45,
    current_level_number: 2,
    next_level_number: 3,
    next_level_min_days: 60
  }
}
```

---

## Level Engine - Aplicación de Gates

### Lógica de Evaluación

1. Si no hay siguiente nivel → `upgrade_status = 'ok'`
2. Si `computed_days < min_days` siguiente → `upgrade_status = 'ok'`
3. Si `computed_days >= min_days`:
   - Flag OFF → `upgrade_status = 'pending_requirements'`
   - Flag ON:
     - Obtener gates activos para `next_level_number`
     - Evaluar cada gate con Condition Engine
     - Si algún gate falla → `upgrade_status = 'locked'`, `pending_requirements` poblado
     - Si todos OK → `upgrade_status = 'pending_requirements'`

### Persistencia

- `upgrade_status` se persiste en `student_level_state`
- `pending_requirements` contiene información de gates fallidos
- Historial se registra en `student_level_history`

---

## Señales

### Señales Genéricas (Obligatorias)

- `student.level.changed` - Cambio de nivel (genérica)
- `student.level.phase.changed` - Cambio de fase (genérica)
- `student.level.upgrade.pending` - Upgrade pendiente (genérica)
- `student.level.upgrade.locked` - Upgrade bloqueado (genérica)

### Backward Compat

Si `line_key === 'pde'`, se emiten TAMBIÉN:
- `student.pde.level.changed`
- `student.pde.phase.changed`
- `student.pde.upgrade.pending`
- `student.pde.upgrade.locked`

---

## Migración SQL

**Archivo:** `database/migrations/v5.58.0-level-gates-v1.sql`

**Cambios:**
- Añade `display_name TEXT` a `level_gates`
- Añade `description TEXT` a `level_gates`
- Crea índices: `idx_level_gates_line_level_status`, `idx_level_gates_line_status`

**Aplicación:**
```bash
psql -d aurelinportal -f database/migrations/v5.58.0-level-gates-v1.sql
```

---

## Verificación

```bash
npm run verify:level-gates
```

Scripts:
- `scripts/verify-level-gates-db.js` - Verifica estructura de BD
- `scripts/verify-level-gates-sample.js` - Verifica funcionalidad

---

## Feature Flag

**Key:** `level_gates_v1`  
**Tipo:** `runtime`  
**Scope:** `system`  
**Default:** `false` (OFF)

**Comportamiento:**
- OFF: Level Engine ignora gates, sistema se comporta como antes
- ON: Gates activos pueden bloquear upgrade, `upgrade_status = 'locked'` cuando fallan

---

## APIs MASTER

### GET /master/api/levels/lines/:line_key/gates

Lista todos los gates activos de una línea.

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "line_key": "pde",
    "gates": [
      {
        "id": "uuid",
        "target_level_number": 3,
        "gate_key": "questionnaire_1",
        "display_name": "Cuestionario Inicial",
        "description": "Debe completar el cuestionario inicial",
        "definition": { "all": [...] },
        "status": "active"
      }
    ]
  },
  "trace_id": "..."
}
```

### POST /master/api/levels/lines/:line_key/gates

Crea un nuevo gate.

**Body:**
```json
{
  "target_level_number": 3,
  "gate_key": "questionnaire_1",
  "display_name": "Cuestionario Inicial",
  "description": "Debe completar el cuestionario inicial",
  "definition": {
    "all": [
      { "path": "level.computed_days", "op": ">=", "value": 30 }
    ]
  }
}
```

### PUT /master/api/levels/gates/:gate_id

Actualiza un gate existente.

### POST /master/api/levels/gates/:gate_id/deprecate

Depreca (desactiva) un gate.

---

## UI MASTER

### Progreso del Alumno

**Ruta:** `/master/alumnos/:student_uuid/progreso`

Muestra:
- Estados de nivel por línea
- Fases actuales
- Gates bloqueantes
- Historial de cambios
- Diagnóstico técnico

### Gestión Global de Gates

**Ruta:** `/master/systema/levels/gates`

Permite:
- Listar líneas y gates
- Crear gate (JSON editor)
- Editar gate
- Deprecar gate

---

## Observabilidad

### Logs Estructurados

Prefijo: `[LevelEngine]`

Ejemplos:
- `[LevelEngine] Gate evaluado` - Gate evaluado con resultado
- `[LevelEngine] Error evaluando gate` - Error en evaluación (fail-safe)

### Trace ID

Todas las operaciones incluyen `trace_id` para correlación.

---

## Integración con Otros Dominios

### Futuro: Policies / Capabilities

Level Gates v1 prepara el terreno para:
- Policies declarativas (reglas de negocio)
- Capabilities dinámicas (permisos basados en condiciones)
- Evaluación reutilizable en otros contextos

---

## Referencias

- `docs/master/MASTER_LEVEL_ENGINE_PDE_V1.md` - Level Engine base
- `src/core/conditions/condition-contract-v1.js` - Contrato de condiciones
- `src/core/conditions/condition-evaluator.js` - Evaluador de condiciones
- `src/core/master/services/level-engine-service.js` - Servicio canónico
- `src/endpoints/master-api-level-gates.js` - APIs MASTER

---

## Changelog

**v5.58.0** (2025-01-XX)
- Implementación inicial de Level Gates v1
- Condition Engine v1
- APIs MASTER de gestión
- UI MASTER de progreso y gestión
- Feature flag `level_gates_v1`
