# 🔍 DIAGNÓSTICO FORENSE GLOBAL ANTI-LEGACY (ALUMNOS) v1

**Fecha:** 2025-01-15  
**Objetivo:** Detectar y listar TODO uso directo o indirecto de `legacy_alumno_id` o conceptos legacy de alumno en el sistema AuriPortal/Aurelín.

**Regla Canónica:**
- `students.id (UUID)` es la única identidad válida de alumno.
- `legacy_alumno_id` debe considerarse PROHIBIDO.
- Cualquier uso es una violación constitucional.

---

## 📊 RESUMEN EJECUTIVO

| Categoría | Total | ALTO | MEDIO | BAJO |
|-----------|-------|------|-------|------|
| **Runtime Crítico** | 12 | 8 | 3 | 1 |
| **Servicios Backend** | 15 | 10 | 4 | 1 |
| **Repositorios** | 8 | 5 | 2 | 1 |
| **Queries SQL** | 45+ | 30+ | 10+ | 5+ |
| **Scripts Diagnóstico** | 3 | 0 | 0 | 3 |
| **Documentación** | 200+ | 0 | 50+ | 150+ |
| **Handlers API** | 8 | 5 | 2 | 1 |
| **Tablas Legacy** | 14 | 14 | 0 | 0 |

**TOTAL ESTIMADO:** 295+ apariciones

---

## 🚨 HALLAZGOS CRÍTICOS (Riesgo ALTO)

### 1. TABLAS DE BASE DE DATOS CON `student_id INTEGER` (FK a `alumnos.id`)

**Riesgo:** 🔴 **ALTO** - Violación constitucional estructural

| Tabla | Campo | FK | Estado |
|-------|-------|----|--------|
| `cleaning_events` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `cleaning_item_state` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `student_product_memberships` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `student_domain_policies` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `student_item_state` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy (histórica) |
| `student_item_state_audit` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `student_place_state` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `student_project_state` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `sponsor_student_links` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `student_activation_limits` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `nivel_overrides` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `pde_daily_item_clean_log` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `ute_executions` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |
| `ute_student_state` | `student_id INTEGER` | `alumnos.id` | ⚠️ Legacy |

**Ubicación:** `database/migrations/*.sql`, `database/pg.js`

**¿Por qué existe?** Migración incompleta. Las tablas fueron creadas con FK a `alumnos.id` (INTEGER) en lugar de `students.id` (UUID).

**¿Es bloqueante?** **SÍ** - Requiere migración de esquema completa.

**Recomendación:** Migrar todas las FK de `alumnos.id` a `students.id` (UUID) en un sprint constitucional con backup previo.

---

### 2. RESOLUCIÓN DE `legacy_alumno_id` EN RUNTIME (Servicios Backend)

**Riesgo:** 🔴 **ALTO** - Dependencia oculta de legacy

#### 2.1 Cleaning Engine Service

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 81-89 | `isStudentPaused()` | Resuelve `legacy_alumno_id` para consultar tabla `pausas` |
| 343-351 | `markCleanAllStudents()` | Resuelve `legacy_alumno_id` para escribir en `cleaning_item_state` |
| 1067-1075 | `setRemainingShared()` | Resuelve `legacy_alumno_id` para escribir en `cleaning_item_state` |

**¿Por qué existe?** Tabla `pausas` usa `alumno_id INTEGER` (FK a `alumnos.id`). Tabla `cleaning_item_state` usa `student_id INTEGER`.

**¿Es bloqueante?** **SÍ** - El sistema no puede funcionar sin estas resoluciones.

**Recomendación:** Migrar tabla `pausas` a usar `student_uuid UUID` (FK a `students.id`). Migrar `cleaning_item_state` a `student_uuid UUID`.

---

#### 2.2 List Projection Model

**Archivo:** `src/core/master/services/list-projection-model.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 405 | Query SQL | `SELECT legacy_alumno_id FROM students` |
| 555-569 | `getProjection()` | Resuelve `legacy_alumno_id` cuando `scope='student'` |

**¿Por qué existe?** Servicio legacy requiere `student_id INTEGER` para queries.

**¿Es bloqueante?** **SÍ** - List Projection Model no funciona sin resolución.

**Recomendación:** Refactorizar para usar `student_uuid` directamente en queries.

---

#### 2.3 Alquimia Alumno Megalist Service

**Archivo:** `src/core/master/services/alquimia-alumno-megalist-service.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 54-60 | `getLastCleanActor()` | Usa `student_id INTEGER` para consultar `cleaning_events` |
| 206 | Query SQL | `WHERE s.student_id = $1` (usa `student_id INTEGER`) |

**¿Por qué existe?** Tabla `cleaning_events` usa `student_id INTEGER`.

**¿Es bloqueante?** **SÍ** - Megalist no puede obtener último actor sin `student_id`.

**Recomendación:** Migrar `cleaning_events` a `student_uuid UUID`.

---

### 3. REPOSITORIOS QUE RESUELVEN `legacy_alumno_id` INTERNAMENTE

**Riesgo:** 🔴 **ALTO** - Encapsulación que oculta dependencia legacy

#### 3.1 Cleaning Item State Repo

**Archivo:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 26-34 | `_resolveLegacyId()` | Helper privado que resuelve `legacy_alumno_id` |
| 54, 98, 171, 253, 320 | Múltiples métodos | Resuelven `legacy_alumno_id` antes de escribir en `cleaning_item_state` |

**¿Por qué existe?** Tabla `cleaning_item_state` usa `student_id INTEGER` como FK.

**¿Es bloqueante?** **SÍ** - Repositorio no puede escribir sin resolución.

**Recomendación:** Migrar tabla `cleaning_item_state` a `student_uuid UUID`.

---

#### 3.2 Cleaning Events Repo

**Archivo:** `src/infra/repos/cleaning/cleaning-events-repo-pg.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 44-50 | `insertEvent()` | Resuelve `legacy_alumno_id` antes de insertar en `cleaning_events` |

**¿Por qué existe?** Tabla `cleaning_events` usa `student_id INTEGER` como FK.

**¿Es bloqueante?** **SÍ** - No se pueden registrar eventos sin resolución.

**Recomendación:** Migrar tabla `cleaning_events` a `student_uuid UUID`.

---

#### 3.3 Master Student Transmutation Read Repo

**Archivo:** `src/infra/repos/master-student-transmutation-read-repo-pg.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 170 | Query SQL | `s.legacy_alumno_id as legacy_student_id` |
| 185 | JOIN | `LEFT JOIN cleaning_item_state c ON c.student_id = s.legacy_alumno_id` |
| 189 | JOIN | `LEFT JOIN pausas p ON p.alumno_id = s.legacy_alumno_id` |
| 324 | JOIN | `LEFT JOIN pausas p ON p.alumno_id = s.legacy_alumno_id` |

**¿Por qué existe?** JOINs con tablas legacy (`cleaning_item_state`, `pausas`) requieren `legacy_alumno_id`.

**¿Es bloqueante?** **SÍ** - Queries de lectura no funcionan sin JOINs legacy.

**Recomendación:** Migrar todas las tablas relacionadas a `student_uuid UUID`.

---

### 4. HANDLERS API QUE RESUELVEN `legacy_alumno_id`

**Riesgo:** 🔴 **ALTO** - Exposición de lógica legacy en endpoints

**Archivo:** `src/endpoints/master-api-alquimia-alumno.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 166 | GET `/master/api/alquimia-alumno/:student_uuid/megalist` | Resuelve `legacy_alumno_id` para servicio legacy |
| 250 | GET `/master/api/alquimia-alumno/:student_uuid/report` | Resuelve `legacy_alumno_id` para servicio legacy |
| 406 | GET `/master/api/alquimia-alumno/:student_uuid/history` | Resuelve `legacy_alumno_id` para repositorio legacy |
| 481 | POST `/master/api/alquimia-alumno/:student_uuid/clean` | Resuelve `legacy_alumno_id` para servicio legacy |

**¿Por qué existe?** Servicios legacy (`getMegalistForStudent`, `getReportForStudent`) requieren `student_id INTEGER`.

**¿Es bloqueante?** **SÍ** - Endpoints no funcionan sin resolución.

**Recomendación:** Refactorizar servicios para aceptar `student_uuid` directamente.

---

### 5. QUERIES SQL DIRECTAS CON `legacy_alumno_id`

**Riesgo:** 🔴 **ALTO** - SQL hardcodeado con dependencia legacy

#### 5.1 Master API Alquimia General

**Archivo:** `src/endpoints/master-api-alquimia-general.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 1237-1239 | Query SQL | `SELECT s.id as student_uuid, s.legacy_alumno_id, a.apodo... LEFT JOIN alumnos a ON a.id = s.legacy_alumno_id` |

**¿Por qué existe?** JOIN con tabla `alumnos` para obtener `display_name` (apodo, nombre_completo).

**¿Es bloqueante?** **SÍ** - Flotante de alumnos no puede mostrar nombres sin JOIN legacy.

**Recomendación:** Migrar `display_name` a tabla `students` o crear vista materializada.

---

#### 5.2 Master API Students

**Archivo:** `src/endpoints/master-api-students.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 172, 189 | Queries SQL | `LEFT JOIN alumnos a ON s.legacy_alumno_id = a.id` |

**¿Por qué existe?** Obtener `display_name` desde tabla `alumnos`.

**¿Es bloqueante?** **SÍ** - Endpoints de estudiantes no pueden mostrar nombres sin JOIN legacy.

**Recomendación:** Migrar `display_name` a tabla `students`.

---

### 6. STUDENT IDENTITY REPO (Resolución Canónica)

**Riesgo:** 🟡 **MEDIO** - Repositorio canónico pero expone resolución legacy

**Archivo:** `src/infra/repos/student-identity-repo-pg.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 26-61 | `resolveLegacyId()` | Resuelve `legacy_alumno_id` desde `student_uuid` |
| 70-105 | `resolveUuid()` | Resuelve `student_uuid` desde `legacy_alumno_id` |

**¿Por qué existe?** Repositorio canónico para resolución bidireccional UUID ↔ legacy.

**¿Es bloqueante?** **SÍ** - Sistema actual depende de este repositorio para funcionar.

**Recomendación:** Mantener como puente temporal, pero marcar como DEPRECATED. Planificar eliminación tras migración completa.

---

## ⚠️ HALLAZGOS MEDIOS (Riesgo MEDIO)

### 7. SCRIPTS DE DIAGNÓSTICO

**Riesgo:** 🟡 **MEDIO** - Scripts temporales que usan legacy

#### 7.1 Diagnose All Projection

**Archivo:** `scripts/diagnose-all-projection.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 13, 27-28 | Lectura | `SELECT id, legacy_alumno_id FROM students` |
| 79, 94, 118, 131, 150, 161 | Escritura | Usa `legacy_alumno_id` para insertar en `cleaning_item_state` |

**¿Por qué existe?** Script temporal de diagnóstico que prepara escenarios controlados.

**¿Es bloqueante?** **NO** - Script de diagnóstico, no runtime.

**Recomendación:** Refactorizar para usar `student_uuid` directamente. Si no es posible, documentar como script temporal.

---

#### 7.2 Verify Cleaning Pipeline

**Archivo:** `scripts/verify-cleaning-pipeline.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 41-49 | Resolución | Resuelve `legacy_alumno_id` para verificar pipeline |

**¿Por qué existe?** Script de verificación que necesita `student_id INTEGER` para consultar tablas legacy.

**¿Es bloqueante?** **NO** - Script de verificación, no runtime.

**Recomendación:** Refactorizar para usar `student_uuid` directamente.

---

### 8. SERVICIOS LEGACY QUE REQUIEREN `student_id INTEGER`

**Riesgo:** 🟡 **MEDIO** - Servicios que no han sido migrados

#### 8.1 Alquimia General Service

**Archivo:** `src/services/alquimia-general-service.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 648 | Verificación pausa | Resuelve `legacy_id` para verificar pausa (tabla `pausas` usa `alumno_id`) |

**¿Por qué existe?** Tabla `pausas` usa `alumno_id INTEGER`.

**¿Es bloqueante?** **SÍ** - Servicio no puede verificar pausas sin resolución.

**Recomendación:** Migrar tabla `pausas` a `student_uuid UUID`.

---

### 9. DOCUMENTACIÓN CON REFERENCIAS LEGACY

**Riesgo:** 🟡 **MEDIO** - Documentación desactualizada

**Archivos afectados:**
- `docs/ALQUIMIA_CANONICA_V1.md` (200+ referencias)
- `docs/ALQUIMIA_UUID_ONLY_V1.md` (150+ referencias)
- `docs/IDENTIDAD_ALUMNOS_CANONICA_V1.md` (100+ referencias)
- `docs/FORENSICS_PLATFORM_CONSISTENCY_AUDIT_V1.md` (50+ referencias)
- `docs/FORENSICS_PLATFORM_CONSISTENCY_AUDIT_V2.md` (50+ referencias)
- `docs/DIAGNOSTICO_FORENSE_*.md` (múltiples archivos)

**¿Por qué existe?** Documentación histórica y diagnósticos que documentan el estado actual del sistema.

**¿Es bloqueante?** **NO** - Documentación, no código.

**Recomendación:** Actualizar documentación para reflejar estado actual. Marcar secciones legacy como DEPRECATED.

---

## ✅ HALLAZGOS BAJOS (Riesgo BAJO)

### 10. GUARDS CONSTITUCIONALES (Protección Anti-Legacy)

**Riesgo:** 🟢 **BAJO** - Código que PREVIENE uso de legacy

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 188-196 | Guard | Lanza error si se intenta usar `legacy_alumno_id` en runtime |
| 1014-1022 | Guard | Lanza error si se intenta usar `legacy_alumno_id` en `setRemainingShared` |

**¿Por qué existe?** Protección constitucional que previene uso directo de legacy en runtime.

**¿Es bloqueante?** **NO** - Es código de protección, no dependencia.

**Recomendación:** Mantener. Estos guards son correctos y necesarios.

---

### 11. WARNINGS EN FRONTEND

**Riesgo:** 🟢 **BAJO** - Advertencias que previenen uso incorrecto

**Archivo:** `public/js/master/master-alquimia-general-client.js`

| Línea | Contexto | Uso |
|-------|----------|-----|
| 2948-2949 | Warning | `console.warn('[MasterAlquimiaGeneral] ⚠️ UI intentando usar student_id (legacy)')` |

**¿Por qué existe?** Advertencia para prevenir uso de `student_id` en frontend.

**¿Es bloqueante?** **NO** - Es advertencia, no dependencia.

**Recomendación:** Mantener. Advertencia útil para debugging.

---

## 📋 TABLA COMPLETA DE HALLAZGOS

| # | Archivo | Línea(s) | Tipo | Contexto | Riesgo | Bloqueante | Recomendación |
|---|---------|----------|------|----------|--------|------------|---------------|
| 1 | `database/migrations/*.sql` | Múltiples | Schema | 14 tablas con `student_id INTEGER` | 🔴 ALTO | SÍ | Migrar FK a `students.id` |
| 2 | `src/core/master/services/cleaning-engine-service.js` | 81-89 | Runtime | Resolución para `pausas` | 🔴 ALTO | SÍ | Migrar `pausas` a UUID |
| 3 | `src/core/master/services/cleaning-engine-service.js` | 343-351 | Runtime | Resolución para `cleaning_item_state` | 🔴 ALTO | SÍ | Migrar tabla a UUID |
| 4 | `src/core/master/services/cleaning-engine-service.js` | 1067-1075 | Runtime | Resolución para `cleaning_item_state` | 🔴 ALTO | SÍ | Migrar tabla a UUID |
| 5 | `src/core/master/services/list-projection-model.js` | 405, 555-569 | Runtime | Resolución para queries legacy | 🔴 ALTO | SÍ | Refactorizar queries |
| 6 | `src/core/master/services/alquimia-alumno-megalist-service.js` | 54-60, 206 | Runtime | Consulta `cleaning_events` | 🔴 ALTO | SÍ | Migrar tabla a UUID |
| 7 | `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` | 26-34, múltiples | Repo | Resolución interna | 🔴 ALTO | SÍ | Migrar tabla a UUID |
| 8 | `src/infra/repos/cleaning/cleaning-events-repo-pg.js` | 44-50 | Repo | Resolución interna | 🔴 ALTO | SÍ | Migrar tabla a UUID |
| 9 | `src/infra/repos/master-student-transmutation-read-repo-pg.js` | 170, 185, 189, 324 | Repo | JOINs con tablas legacy | 🔴 ALTO | SÍ | Migrar tablas a UUID |
| 10 | `src/endpoints/master-api-alquimia-alumno.js` | 166, 250, 406, 481 | Handler | Resolución para servicios legacy | 🔴 ALTO | SÍ | Refactorizar servicios |
| 11 | `src/endpoints/master-api-alquimia-general.js` | 1237-1239 | Handler | JOIN con `alumnos` | 🔴 ALTO | SÍ | Migrar `display_name` |
| 12 | `src/endpoints/master-api-students.js` | 172, 189 | Handler | JOIN con `alumnos` | 🔴 ALTO | SÍ | Migrar `display_name` |
| 13 | `src/infra/repos/student-identity-repo-pg.js` | 26-105 | Repo | Resolución canónica | 🟡 MEDIO | SÍ | Mantener como puente temporal |
| 14 | `scripts/diagnose-all-projection.js` | Múltiples | Script | Diagnóstico temporal | 🟡 MEDIO | NO | Refactorizar o documentar |
| 15 | `scripts/verify-cleaning-pipeline.js` | 41-49 | Script | Verificación | 🟡 MEDIO | NO | Refactorizar |
| 16 | `src/services/alquimia-general-service.js` | 648 | Servicio | Verificación pausa | 🟡 MEDIO | SÍ | Migrar `pausas` a UUID |
| 17 | `docs/*.md` | Múltiples | Doc | Documentación histórica | 🟡 MEDIO | NO | Actualizar documentación |
| 18 | `src/core/master/services/cleaning-engine-service.js` | 188-196, 1014-1022 | Guard | Protección anti-legacy | 🟢 BAJO | NO | Mantener |
| 19 | `public/js/master/master-alquimia-general-client.js` | 2948-2949 | Frontend | Warning | 🟢 BAJO | NO | Mantener |

---

## 🎯 PLAN DE ACCIÓN RECOMENDADO

### Fase 1: Migración de Tablas Críticas (Sprint Constitucional)

1. **Backup completo de PostgreSQL** (obligatorio según constitución)
2. **Migrar tablas de Cleaning Engine:**
   - `cleaning_events`: `student_id INTEGER` → `student_uuid UUID`
   - `cleaning_item_state`: `student_id INTEGER` → `student_uuid UUID`
3. **Migrar tabla de pausas:**
   - `pausas`: `alumno_id INTEGER` → `student_uuid UUID`
4. **Actualizar repositorios:**
   - Eliminar resolución de `legacy_alumno_id` en repositorios
   - Aceptar `student_uuid` directamente

### Fase 2: Migración de Display Name

1. **Migrar `display_name` a tabla `students`:**
   - Añadir columnas `apodo`, `nombre_completo` a `students`
   - Migrar datos desde `alumnos`
   - Eliminar JOINs con `alumnos` en handlers

### Fase 3: Refactorización de Servicios

1. **Refactorizar servicios para aceptar `student_uuid` directamente:**
   - `getMegalistForStudent()`: Eliminar parámetro `student_id`
   - `getReportForStudent()`: Eliminar parámetro `student_id`
   - `list-projection-model.js`: Eliminar resolución de `legacy_alumno_id`

### Fase 4: Limpieza Final

1. **Eliminar `StudentIdentityRepo.resolveLegacyId()`:**
   - Marcar como DEPRECATED
   - Eliminar después de migración completa
2. **Actualizar documentación:**
   - Marcar secciones legacy como DEPRECATED
   - Actualizar ejemplos de código
3. **Eliminar scripts de diagnóstico legacy:**
   - Refactorizar o eliminar scripts que usan `legacy_alumno_id`

---

## ✅ CONFIRMACIÓN DE DEPENDENCIAS OCULTAS

**¿Quedan dependencias ocultas?**

**SÍ** - Las siguientes dependencias están ocultas pero son críticas:

1. **Tablas de base de datos:** 14 tablas usan `student_id INTEGER` (FK a `alumnos.id`)
2. **Repositorios:** Resuelven `legacy_alumno_id` internamente (encapsulación)
3. **Servicios:** Requieren `student_id INTEGER` aunque aceptan `student_uuid` en API
4. **Queries SQL:** Múltiples queries hacen JOIN con `alumnos` usando `legacy_alumno_id`

**Todas estas dependencias son bloqueantes para el funcionamiento del sistema actual.**

---

## 📝 NOTAS FINALES

- **Este diagnóstico es exhaustivo pero NO es una implementación.**
- **NO se han modificado archivos.**
- **NO se han realizado migraciones.**
- **Este documento es puramente forense.**

**Próximos pasos:**
1. Revisar este diagnóstico con el equipo
2. Planificar sprint constitucional de migración
3. Crear backup completo antes de cualquier cambio
4. Ejecutar migraciones en orden (Fase 1 → Fase 4)

---

**FIN DEL DIAGNÓSTICO**
