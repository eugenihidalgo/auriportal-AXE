# ORIGIN CONTRACT v1 - Sistema Canónico de Orígenes

**Versión:** v1.0  
**Fecha:** 2025-01-XX  
**Estado:** ✅ Implementado (sin UI)

---

## 1. DEFINICIÓN

**Origin** es un sistema canónico para describir "cómo se ejecuta/asigna" cualquier trabajo (UTE, encargos, tareas) sin acoplarlo a un solo Source of Truth.

Un **Origin** define:
- **Qué** se ejecuta (source_selector)
- **Cómo** se ejecuta** (execution mode: recurrent/one_time_count)
- **Quién** puede ejecutarlo (actors)
- **A quién** se asigna (targets)
- **Dónde** se muestra (surfaces)
- **Qué señales** emite (signals)

---

## 2. CONCEPTOS FUNDAMENTALES

### 2.1. Origin Key

**Formato:** `{domain}:{entity}:{action}`

**Ejemplos:**
- `alquimia:limpieza:diaria` - Limpieza diaria de alquimia
- `templo:proyecto:semanal` - Proyecto semanal del templo
- `master:deber:mensual` - Deber mensual del master

**Reglas:**
- Único en el sistema (UNIQUE constraint)
- No puede estar vacío
- Case-sensitive (se normaliza en aplicación si es necesario)

### 2.2. Source Selector

**Tipo:** JSONB

**Propósito:** Describe de dónde viene el trabajo (sin acoplarse a un solo SOT).

**Estructura:**
```json
{
  "type": "single|query|wildcard",
  "source": "string",
  "query": "object (si type=query)",
  "params": "object (opcional)"
}
```

**Tipos:**
- `single`: Un único origen específico (ej: `"source": "lista:123"`)
- `query`: Múltiples orígenes mediante query (ej: `"query": {"domain": "alquimia", "tipo": "limpieza"}`)
- `wildcard`: Todos los orígenes de un tipo (ej: `"source": "lista:*"`)

### 2.3. Execution Mode

**Tipos:**
- `recurrent`: Recurrente con threshold_days
- `one_time_count`: Contador de ejecuciones (one_time = required_count = 1)

**Estructura JSONB:**
```json
{
  "mode": "recurrent|one_time_count",
  "threshold_days": "integer (recurrent)",
  "critical_multiplier": "numeric (recurrent, default 2.0)",
  "required_count": "integer (one_time_count)"
}
```

### 2.4. Precedencia

**Regla:** single > query > wildcard

Si un alumno tiene múltiples Origins asignados, se usa el más específico:
1. `single` (más específico)
2. `query` (medio)
3. `wildcard` (menos específico)

### 2.5. Mapeo Origin → UTE

**Regla:** `ute_key = "ute:" + origin_key`

**Ejemplo:**
- Origin: `alquimia:limpieza:diaria`
- UTE: `ute:alquimia:limpieza:diaria`

**Puente:** El sistema crea automáticamente una UTE definition si el Origin tiene `execution` definido.

---

## 3. ESTRUCTURA DE DATOS

### 3.1. Campos Obligatorios

- `origin_key` (TEXT, UNIQUE, NOT NULL) - Clave canónica
- `status` (TEXT) - 'draft', 'active', 'archived' (default 'active')
- `source_selector` (JSONB, NOT NULL) - Selector de origen
- `execution` (JSONB, NOT NULL) - Configuración de ejecución
- `actors` (JSONB, NOT NULL) - Quién puede ejecutar
- `targets` (JSONB, NOT NULL) - A quién se asigna
- `surfaces` (JSONB, NOT NULL, DEFAULT '[]') - Dónde se muestra
- `signals` (JSONB, NOT NULL, DEFAULT '{}') - Señales a emitir
- `ui` (JSONB, NOT NULL, DEFAULT '{}') - Metadatos UI
- `meta` (JSONB, NOT NULL, DEFAULT '{}') - Metadatos adicionales
- `version` (INTEGER, NOT NULL, DEFAULT 1) - Versión del contrato

### 3.2. Campos de Auditoría

- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `created_by` (TEXT) - Quién creó
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `updated_by` (TEXT) - Quién actualizó
- `deleted_at` (TIMESTAMPTZ) - Soft delete

---

## 4. INVARIANTES

1. **PostgreSQL SOT:** PostgreSQL es el único Source of Truth
2. **Idempotencia:** `createOrigin()` es idempotente por `origin_key`
3. **Auditable:** Todas las operaciones son auditables (audit_log)
4. **Reversible:** Soft delete permite reversión
5. **Sin hardcodes:** No hay arrays/constantes hardcoded como autoridad

---

## 5. EJEMPLOS

### 5.1. Origin Recurrente

```json
{
  "origin_key": "alquimia:limpieza:diaria",
  "status": "active",
  "source_selector": {
    "type": "query",
    "query": {
      "domain": "alquimia",
      "tipo": "limpieza"
    }
  },
  "execution": {
    "mode": "recurrent",
    "threshold_days": 7,
    "critical_multiplier": 2.0
  },
  "actors": {
    "allowed": ["student", "master"],
    "default": "student"
  },
  "targets": {
    "type": "all",
    "filters": {}
  },
  "surfaces": ["master_panel", "student_portal"],
  "signals": {
    "on_execute": "origin.executed",
    "on_complete": "origin.completed"
  },
  "ui": {
    "label": "Limpieza Energética Diaria",
    "description": "Limpieza diaria de espacios energéticos"
  },
  "meta": {}
}
```

### 5.2. Origin One Time

```json
{
  "origin_key": "templo:proyecto:inicial",
  "status": "active",
  "source_selector": {
    "type": "single",
    "source": "proyecto:123"
  },
  "execution": {
    "mode": "one_time_count",
    "required_count": 1
  },
  "actors": {
    "allowed": ["master"],
    "default": "master"
  },
  "targets": {
    "type": "student",
    "student_id": 456
  },
  "surfaces": ["master_panel"],
  "signals": {},
  "ui": {
    "label": "Proyecto Inicial",
    "description": "Proyecto inicial del templo"
  },
  "meta": {}
}
```

---

## 6. INTEGRACIÓN CON UTE

### 6.1. Puente Automático

Si un Origin tiene `execution` definido, el sistema crea automáticamente una UTE definition:

- `ute_key = "ute:" + origin_key`
- `mode = execution.mode`
- `threshold_days = execution.threshold_days` (si recurrent)
- `required_count = execution.required_count` (si one_time_count)

### 6.2. Sincronización

- Al crear Origin → se crea UTE (si aplica)
- Al actualizar Origin → se actualiza UTE (si aplica)
- Al archivar Origin → se archiva UTE (si aplica)

---

## 7. API ENDPOINTS

Ver `docs/ORIGIN_API_V1.md` (si existe) o endpoints en `/master/api/origins/**`

---

## 8. NOTAS

- **Sin UI todavía:** Solo backend/contratos
- **Extensible:** JSONB permite agregar campos sin migraciones
- **Versionado:** Campo `version` permite evolución del contrato
- **Auditable:** Tabla `origin_audit_log` registra todos los cambios

---

**Estado:** ✅ Contrato definido - Listo para implementación
