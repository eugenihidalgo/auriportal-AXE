# UTE CORE v1 - Auditoría Forense Previa

**Fecha:** 2025-01-XX  
**Versión:** v5.53.0-ute-core-v1  
**Objetivo:** Documentar sistema existente antes de implementar núcleo canónico UTE (Limpiezas/Deberes)

---

## 1. TABLAS EXISTENTES RELACIONADAS

### 1.1. `energy_events` (v5.0.0)
**Ubicación:** `database/migrations/v5.0.0-create-energy-events.sql`

**Propósito:** Tabla append-only para eventos energéticos del sistema.

**Relevancia para UTE:**
- ✅ **REUTILIZABLE:** Patrón append-only es perfecto para `ute_executions`
- ✅ **REUTILIZABLE:** Estructura de `actor_type`, `actor_id`, `alumno_id`, `occurred_at`
- ⚠️ **NO REUTILIZAR:** `energy_events` es genérico (limpiezas, iluminaciones, etc.)
- ✅ **PATRÓN:** UTE debe tener su propia tabla `ute_executions` siguiendo el mismo patrón

**Campos clave:**
- `id` (BIGSERIAL)
- `occurred_at` (TIMESTAMPTZ)
- `actor_type`, `actor_id` (ejecutado por)
- `alumno_id` (alumno afectado)
- `event_type` (tipo de evento)
- `metadata` (JSONB)

### 1.2. `energy_subject_state` (v5.0.2)
**Ubicación:** `database/migrations/v5.0.2-create-energy-projections.sql`

**Propósito:** Proyección (read model) del estado actual de sujetos energéticos.

**Relevancia para UTE:**
- ✅ **REUTILIZABLE:** Patrón de proyección es perfecto para `ute_student_state`
- ✅ **REUTILIZABLE:** Estructura de `last_event_at`, `last_event_id` para backfill
- ⚠️ **NO REUTILIZAR:** `energy_subject_state` es para sujetos (lugar, proyecto), no para UTE
- ✅ **PATRÓN:** UTE debe tener su propia tabla `ute_student_state` siguiendo el mismo patrón

### 1.3. `student_item_state` (existente)
**Ubicación:** `src/infra/repos/student-item-state-repo-pg.js`

**Propósito:** Estado de ítems por alumno (domain_key, item_id).

**Relevancia para UTE:**
- ⚠️ **LEGACY:** Parece ser sistema anterior para tracking de limpiezas
- ⚠️ **NO REUTILIZAR:** UTE debe ser sistema canónico nuevo, no extender legacy
- ✅ **REFERENCIA:** Ver estructura para entender patrones existentes, pero NO depender de ella

**Campos clave:**
- `student_id`, `domain_key`, `item_id`
- `is_active`, `is_clean`
- `clean_count`, `last_cleaned_at`

### 1.4. `pde_signals` (existente)
**Ubicación:** `src/infra/repos/pde-signals-repo-pg.js`

**Propósito:** Registry canónico de señales del sistema.

**Relevancia para UTE:**
- ✅ **REUTILIZABLE:** Sistema de señales existente para registrar señales UTE
- ✅ **PATRÓN:** Registrar señales `ute.*` en `pde_signals`
- ✅ **EMITIR:** Usar el sistema de señales para emitir eventos UTE

---

## 2. ENDPOINTS EXISTENTES RELACIONADOS

### 2.1. `/master/api/alquimia-general/items/:item_ref/master/mark-clean-all` (POST)
**Ubicación:** `src/endpoints/master-api-alquimia-general.js`

**Propósito:** Marcar todos los ítems de una lista como limpios (ejecución global).

**Relevancia para UTE:**
- ✅ **REFERENCIA:** Patrón de ejecución global para todos los alumnos
- ⚠️ **NO REUTILIZAR:** Es específico de alquimia-general, no UTE
- ✅ **PATRÓN:** UTE debe tener endpoint similar `/master/api/ute/:ute_id/execute_global`

### 2.2. `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student` (POST)
**Ubicación:** `src/endpoints/master-api-alquimia-general.js`

**Propósito:** Marcar un ítem como limpio para un alumno específico.

**Relevancia para UTE:**
- ✅ **REFERENCIA:** Patrón de ejecución individual
- ⚠️ **NO REUTILIZAR:** Es específico de alquimia-general, no UTE
- ✅ **PATRÓN:** UTE debe tener endpoint similar `/master/api/ute/:ute_id/execute`

---

## 3. REPOSITORIOS Y SERVICIOS EXISTENTES

### 3.1. `student-item-state-repo-pg.js`
**Ubicación:** `src/infra/repos/student-item-state-repo-pg.js`

**Relevancia:**
- ⚠️ **LEGACY:** Sistema anterior, no reutilizar directamente
- ✅ **PATRÓN:** Ver estructura de repos PostgreSQL para seguir el mismo patrón

### 3.2. `pde-signals-repo-pg.js`
**Ubicación:** `src/infra/repos/pde-signals-repo-pg.js`

**Relevancia:**
- ✅ **REUTILIZABLE:** Sistema de señales para registrar y emitir señales UTE
- ✅ **MÉTODOS:** `list()`, `getByKey()`, `create()`, `update()`, `emit()`

---

## 4. DECISIONES DE DISEÑO

### 4.1. Nombres Canónicos de Tablas

**Tablas nuevas a crear:**
1. `ute_definitions` - Definiciones de UTE (qué es una limpieza/deber)
2. `ute_executions` - Ejecuciones append-only (event sourcing)
3. `ute_student_state` - Proyección del estado por alumno
4. `ute_assignments` - Asignaciones de UTE a targets (alumnos, grupos, etc.)

**Evitar colisiones:**
- ✅ `ute_*` es namespace único (no existe en el sistema)
- ✅ No colisiona con `energy_*` (sistema diferente)
- ✅ No colisiona con `student_item_state` (legacy, no se usa)

### 4.2. Qué Reutilizar

**✅ REUTILIZAR:**
- Patrón append-only de `energy_events` → `ute_executions`
- Patrón de proyección de `energy_subject_state` → `ute_student_state`
- Sistema de señales `pde_signals` → registrar señales `ute.*`
- Estructura de repos PostgreSQL (contratos + implementaciones)
- Patrón de migraciones con CHECK constraints y comentarios constitucionales

**❌ NO REUTILIZAR:**
- `energy_events` directamente (sistema diferente)
- `energy_subject_state` directamente (sistema diferente)
- `student_item_state` (legacy, no extender)
- Endpoints de alquimia-general (sistema diferente)

### 4.3. Legacy a Evitar

**Legacy identificado:**
- `student_item_state` - Sistema anterior, no extender
- Cualquier referencia a "limpiezas" en código legacy (SQLite, ClickUp como SOT)

**Regla:** UTE es sistema canónico nuevo, PostgreSQL como único SOT.

---

## 5. ESTRUCTURA DE MIGRACIÓN

**Patrón observado en migraciones recientes:**
- Versión: `v5.X.X-nombre-descriptivo.sql`
- CHECK constraints para enums
- Comentarios constitucionales en SQL
- Verificaciones post-migración con DO $$
- Índices optimizados para consultas comunes
- Soft delete con `deleted_at` (excepto en append-only)

**Migración a crear:**
- `v5.53.0-ute-core-v1.sql`
- Tablas: `ute_definitions`, `ute_executions`, `ute_student_state`, `ute_assignments`
- CHECK constraints: `mode`, `status`, `executed_by`, `state`
- Índices: por `ute_id`, `student_id`, `executed_at`, `state`

---

## 6. SISTEMA DE SEÑALES

**Sistema existente:**
- Tabla: `pde_signals` (registry canónico)
- Repo: `pde-signals-repo-pg.js`
- Métodos: `getByKey()`, `emit()`

**Señales UTE a registrar:**
- `ute.created` - UTE definition creada
- `ute.assigned` - UTE asignada a target
- `ute.executed` - UTE ejecutada (individual)
- `ute.executed.global` - UTE ejecutada para todos (global)
- `ute.state.changed` - Estado de alumno cambió (opcional, si recálculo detecta cambio)

**Estrategia:**
- Registrar señales en `pde_signals` (si no existen, crearlas)
- Emitir señales desde el servicio `ute-core-service.js`
- Usar `trace_id` para correlación

---

## 7. MASTER API PATTERN

**Patrón observado:**
1. Registrar ruta en `master-route-registry.js` con `type: 'api'`
2. Mapear en `MASTER_HANDLER_MAP` en `master-router-resolver.js`
3. Crear handler en `src/endpoints/master-api-*.js`
4. Handler debe exportar función por defecto
5. Usar `requireAdminContext()` para autenticación

**Endpoints UTE a crear:**
- `GET /master/api/ute/definitions`
- `POST /master/api/ute/definitions`
- `GET /master/api/ute/:ute_id/states`
- `POST /master/api/ute/:ute_id/execute`
- `POST /master/api/ute/:ute_id/execute_global`
- `POST /master/api/ute/:ute_id/recompute`

---

## 8. CONCLUSIÓN

**Resumen:**
- ✅ No existe sistema UTE previo (namespace `ute_*` está libre)
- ✅ Existen patrones reutilizables (append-only, proyecciones, señales)
- ✅ Existe legacy a evitar (`student_item_state`)
- ✅ Estructura clara de migraciones, repos, servicios, APIs

**Próximos pasos:**
1. Crear migración `v5.53.0-ute-core-v1.sql`
2. Crear repos (contratos + implementaciones PostgreSQL)
3. Crear servicio canónico `ute-core-service.js`
4. Registrar señales en `pde_signals`
5. Crear endpoints `/master/api/ute/**`
6. Documentar en `docs/UTE_CORE_V1.md`

---

**Estado:** ✅ Auditoría completada - Listo para implementación
