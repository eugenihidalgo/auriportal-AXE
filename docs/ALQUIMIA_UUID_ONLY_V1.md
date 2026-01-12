# ALQUIMIA UUID-ONLY v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Versión:** 1.0.0  
**Fecha:** 2026-01-13  
**Estado:** CANÓNICO  
**Commit:** (pendiente - v5.70.0)

---

## PROPÓSITO

Documentación canónica de la eliminación total del legacy de alumnos en el sistema de Alquimia.

Este documento establece que Alquimia funciona 100% UUID-only, sin dependencias de `legacy_alumno_id`, `student_item_state`, o JOINs con `alumnos` en el motor.

**OBLIGATORIO:** Cualquier código relacionado con Alquimia debe cumplir estas reglas.

---

## 1) QUÉ SIGNIFICA UUID-ONLY

**UUID-only significa:**
- ✅ Alquimia funciona 100% con `student_uuid` (UUID) como identificador primario
- ✅ NO existe `legacy_alumno_id` en runtime de Alquimia
- ✅ NO se escribe ni se lee `student_item_state`
- ✅ NO se hacen JOINs con `alumnos` en el motor
- ✅ Cleaning Engine NO resuelve legacy IDs

**Tablas legacy quedan como HISTÓRICAS:**
- `student_item_state`: Tabla histórica (no usada en runtime)
- `alumnos`: Tabla histórica (no usada en runtime de Alquimia)

---

## 2) TABLAS QUE PARTICIPAN

### 2.1 Tablas Canónicas (UUID-only)

**`cleaning_events`:**
- `student_id` (INTEGER) - **LEGACY**: Los repositorios resuelven internamente
- Event log append-only
- Source of Truth para eventos de limpieza

**`cleaning_item_state`:**
- `student_id` (INTEGER) - **LEGACY**: Los repositorios resuelven internamente
- Proyección optimizada de `cleaning_events`
- Source of Truth para estado de limpieza

**`students`:**
- `id` (UUID) - Identificador canónico
- Source of Truth para identidad de alumnos

### 2.2 Tablas Prohibidas en Runtime

**`student_item_state`:**
- ❌ NO se escribe
- ❌ NO se lee
- ❌ NO se sincroniza
- ✅ Solo histórica

**`alumnos`:**
- ❌ NO se hace JOIN en el motor
- ❌ NO se consulta directamente
- ✅ Solo histórica (para display_name encapsulado)

---

## 3) CLEANING ENGINE UUID-ONLY

### 3.1 Contrato de Entrada

**`markCleanStudent()`:**
- Acepta SOLO `student_uuid` (UUID)
- Si no hay `student_uuid` → error 400
- NO resuelve `legacy_alumno_id`

**`markCleanAllStudents()`:**
- Obtiene estudiantes desde `students` (UUID)
- NO consulta `alumnos`
- NO resuelve `legacy_alumno_id`

### 3.2 Funciones Eliminadas

**`syncToStudentItemState()`:**
- ❌ Eliminada completamente
- ❌ NO se llama desde ningún lugar
- ❌ NO sincroniza a `student_item_state`

**Resolución de `legacy_alumno_id`:**
- ❌ Eliminada de Cleaning Engine
- ❌ NO se importa `StudentIdentityRepo`
- ❌ NO se llama `resolveLegacyId()`

### 3.3 Funciones Actualizadas

**`isStudentPaused()`:**
- Acepta `student_uuid` (UUID)
- El repositorio resuelve internamente `alumno_id` si es necesario

**`getStudentEffectiveLevel()`:**
- Acepta `student_uuid` (UUID) directamente
- NO resuelve `legacy_alumno_id`

---

## 4) REPOSITORIOS UUID-ONLY

### 4.1 Repositorios de Cleaning

**`cleaning-events-repo-pg.js`:**
- Acepta `student_uuid` en la interfaz
- Resuelve internamente `legacy_alumno_id` para escribir en tabla legacy
- NO expone `legacy_alumno_id` en la interfaz

**`cleaning-item-state-repo-pg.js`:**
- Acepta `student_uuid` en la interfaz
- Resuelve internamente `legacy_alumno_id` para escribir en tabla legacy
- NO expone `legacy_alumno_id` en la interfaz

### 4.2 Repositorios Legacy Limpiados

**`master-student-transmutation-read-repo-pg.js`:**
- ❌ Eliminado JOIN con `student_item_state`
- ❌ Eliminado JOIN con `alumnos`
- ✅ Usa SOLO:
  - `cleaning_item_state`
  - `students` (UUID)

---

## 5) SEÑALES UUID-ONLY

### 5.1 Señal `clean.executed`

**Payload canónico:**
```json
{
  "signal": "clean.executed",
  "scope": "student",
  "student_uuid": "UUID canónico",
  "item_ref": "...",
  "domain": "...",
  "product_key": "...",
  "source": "...",
  "clean_layer": "...",
  "executed_at": "..."
}
```

**Eliminado:**
- ❌ `student_id` (legacy INTEGER)
- ❌ `alumno_id` (legacy)
- ❌ Cualquier referencia a `legacy_alumno_id`

---

## 6) BLOQUEO CONSTITUCIONAL

### 6.1 Guard Constitucional

**Si algún código intenta usar `legacy_alumno_id` en runtime de Alquimia:**
- ❌ Throw error explícito
- ❌ Mensaje: `"LEGACY alumno_id is forbidden in UUID-only Alquimia runtime"`
- ❌ Fail-hard (no fail-open)

**Ubicación del guard:**
- Cleaning Engine: Validación en entrada de funciones públicas
- Repositorios: Validación en métodos públicos

---

## 7) CHECKLIST DE NO-REGRESIÓN

### 7.1 Verificaciones Obligatorias

- [ ] ¿Cleaning Engine NO importa `StudentIdentityRepo`?
- [ ] ¿Cleaning Engine NO llama `resolveLegacyId()`?
- [ ] ¿`syncToStudentItemState()` está eliminada?
- [ ] ¿`markCleanStudent()` acepta SOLO `student_uuid`?
- [ ] ¿`markCleanAllStudents()` obtiene estudiantes desde `students` (UUID)?
- [ ] ¿Repositorios NO hacen JOIN con `alumnos`?
- [ ] ¿Repositorios NO hacen JOIN con `student_item_state`?
- [ ] ¿Señales NO incluyen `student_id` (legacy)?
- [ ] ¿Guard constitucional activo?

### 7.2 Verificaciones de Tablas

- [ ] ¿`student_item_state` NO se escribe?
- [ ] ¿`student_item_state` NO se lee?
- [ ] ¿`alumnos` NO se consulta en el motor?
- [ ] ¿`cleaning_events` y `cleaning_item_state` funcionan correctamente?

---

## 8) REFERENCIAS

- **Documentación Alquimia:** `docs/ALQUIMIA_CANONICA_V1.md`
- **Documentación Identidad:** `docs/IDENTIDAD_ALUMNOS_CANONICA_V1.md`
- **Cleaning Engine:** `src/core/master/services/cleaning-engine-service.js`
- **Repositorios Cleaning:** `src/infra/repos/cleaning/`

---

## 9) CIERRE CANÓNICO

**Eliminación total del legacy de alumnos en Alquimia: COMPLETADA**

**Estado:**
- ✅ Alquimia funciona 100% UUID-only
- ✅ NO existe `legacy_alumno_id` en runtime
- ✅ NO se escribe ni se lee `student_item_state`
- ✅ NO se hacen JOINs con `alumnos` en el motor
- ✅ Cleaning Engine NO resuelve legacy IDs

**Tablas legacy:**
- `student_item_state`: Histórica (no usada)
- `alumnos`: Histórica (no usada en runtime de Alquimia)

---

**ESTADO:** CANÓNICO  
**REFERENCIA:** OBLIGATORIA
