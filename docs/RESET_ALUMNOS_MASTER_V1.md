# RESET ALUMNOS MASTER v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Versión:** 1.0.0  
**Fecha:** 2026-01-13  
**Estado:** CANÓNICO  
**Commit:** (pendiente - v5.69.0-reset-alumnos-fix-logger)

---

## PROPÓSITO

Documentación canónica del reset total y definitivo de alumnos legacy en dominio MASTER.

Este documento refleja **EXACTAMENTE** la ejecución del reset canónico que elimina todos los alumnos legacy del sistema para preparar la creación canónica UUID-first.

**OBLIGATORIO:** Cualquier referencia a estado previo de alumnos debe citar este documento.

---

## 1) MOTIVO DEL RESET

**Decisión canónica explícita:**

Se decide eliminar **TODOS** los alumnos existentes del sistema.

**Razones:**
- Los alumnos provienen de importaciones legacy (ClickUp)
- NO deben formar parte del sistema canónico
- El sistema debe empezar limpio para creación canónica UUID-first
- Reset consciente y definitivo (no migración, no soft delete)

**Estado objetivo:**
- `students`: VACÍA (0 registros)
- `alumnos`: VACÍA (0 registros)
- Sin alumnos activos en ninguna UI MASTER
- Lista de alumnos vacía en todas las pantallas
- Sistema preparado para crear alumnos canónicamente después

---

## 2) DECISIÓN DE HARD DELETE

**Tipo de eliminación:** HARD DELETE (no soft delete)

**Justificación:**
- Reset consciente y definitivo
- No dejar restos huérfanos
- Preparación para creación canónica UUID-first
- Sistema debe empezar desde cero

**NO es:**
- ❌ Soft delete (no se usa `deleted_at`)
- ❌ Migración (no se preservan datos)
- ❌ Backup (no se guardan copias)
- ❌ Reversible (no se puede deshacer)

---

## 3) TABLAS AFECTADAS

### 3.1 Orden de Eliminación (por FK)

**PASO 1: Eliminar tablas dependientes**

1. `student_item_state` (FK a `alumnos.id`)
2. `cleaning_events` (FK a `alumnos.id` como `student_id`)
3. `cleaning_item_state` (FK a `alumnos.id` como `student_id`)
4. `practicas` (FK a `alumnos.id`)
5. `pausas` (FK a `alumnos.id`)
6. `pde_signal_emissions` (registros con `scope = 'student'`)
7. `student_signal_audit` (si existe, FK relacionada)
8. `energy_events` (si existe, FK relacionada)

**PASO 2: Eliminar tablas principales**

9. `students` (UUID canónico)
10. `alumnos` (legacy)

### 3.2 Script SQL Ejecutado

**Archivo:** `database/reset-alumnos-master-v1.sql`

**Comando:**
```sql
BEGIN;
DELETE FROM student_item_state;
DELETE FROM cleaning_events;
DELETE FROM cleaning_item_state;
DELETE FROM practicas;
DELETE FROM pausas;
DELETE FROM students;
DELETE FROM alumnos;
COMMIT;
```

**Verificación:**
```sql
SELECT count(*) FROM students; → 0
SELECT count(*) FROM alumnos; → 0
SELECT count(*) FROM pausas; → 0
SELECT count(*) FROM student_item_state; → 0
```

---

## 4) FECHA Y VERSIÓN

**Fecha de ejecución:** 2026-01-13  
**Versión:** v5.69.0-reset-alumnos-fix-logger  
**Commit:** (pendiente)

**Ejecutado por:** Sistema canónico  
**Autorizado por:** Decisión canónica explícita

---

## 5) ADVERTENCIA IMPORTANTE

**⚠️ SISTEMA VACÍO HASTA CREACIÓN DE NUEVOS ALUMNOS CANÓNICOS**

**Estado actual:**
- ✅ Sistema limpio (sin alumnos legacy)
- ✅ Preparado para creación canónica UUID-first
- ⚠️ **NO hay alumnos activos** en ninguna UI MASTER
- ⚠️ Selectores de alumnos **vacíos** en todas las pantallas
- ⚠️ **NO avanzar a crear alumnos nuevos** hasta confirmar este estado limpio

**Próximos pasos:**
1. Verificar estado limpio del sistema
2. Confirmar que no hay errores en logs
3. Crear alumnos canónicamente vía `/master/alumnos/crear`
4. Verificar integración con Alquimia

---

## 6) INTEGRACIÓN CON CREACIÓN CANÓNICA

**Relación con:** `IDENTIDAD_ALUMNOS_CANONICA_V1.md`

**Flujo recomendado:**
1. ✅ Reset total ejecutado (este documento)
2. ⏳ Verificar estado limpio
3. ⏳ Crear alumnos canónicamente vía `POST /master/api/students`
4. ⏳ Verificar integración con Alquimia

**Creación canónica:**
- Endpoint: `POST /master/api/students`
- UI: `/master/alumnos/crear`
- Servicio: `StudentCreationService`
- UUID-first desde el momento de creación

---

## 7) VERIFICACIÓN POST-RESET

### 7.1 Verificaciones Obligatorias

- [x] `students` vacía (count = 0)
- [x] `alumnos` vacía (count = 0)
- [x] `pausas` vacía (count = 0)
- [x] `student_item_state` vacía (count = 0)
- [x] `cleaning_events` vacía (count = 0)
- [x] `cleaning_item_state` vacía (count = 0)

### 7.2 Verificaciones UI

- [ ] `/master/alumnos` → No aparece ningún alumno
- [ ] Alquimia General → No hay error de logger
- [ ] Alquimia General → No hay alumnos en selector
- [ ] Alquimia General → No warnings técnicos visibles
- [ ] Alquimia Alumno → Selector vacío
- [ ] Alquimia Alumno → Sin errores en consola

### 7.3 Verificaciones Logs

- [ ] PM2 logs → Sin stacktrace de logger
- [ ] PM2 logs → Sin errores de import
- [ ] PM2 logs → Reset registrado conscientemente

---

## 8) REFERENCIAS

- **Documentación Identidad:** `docs/IDENTIDAD_ALUMNOS_CANONICA_V1.md`
- **Script SQL:** `database/reset-alumnos-master-v1.sql`
- **Servicio Creación:** `src/core/master/services/student-creation-service.js`
- **UI Creación:** `/master/alumnos/crear`

---

## 9) CIERRE CANÓNICO

**Reset canónico de alumnos legacy en dominio MASTER: EJECUTADO**

**Estado final:**
- Sistema vacío (0 alumnos)
- Preparado para creación canónica UUID-first
- Sin restos legacy

**Siguiente paso:**
Crear alumnos canónicamente vía `/master/alumnos/crear` después de verificar estado limpio.

---

**ESTADO:** CANÓNICO  
**REFERENCIA:** OBLIGATORIA
