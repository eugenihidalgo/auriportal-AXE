# FASE D - FASE 6: ALCANCE ADMIN UI
## AuriPortal - Automatizaciones Canónicas

**Versión**: 1.0  
**Fecha**: 2025-01-XX  
**Estado**: 📋 DOCUMENTACIÓN (NO IMPLEMENTADA)  
**Alcance**: Definición del alcance exacto de la Fase 6 (Admin UI)

---

## PROPÓSITO

Este documento define el alcance EXACTO de la Fase 6 (Admin UI) para automatizaciones canónicas.

**IMPORTANTE**: Esta fase es SOLO de visualización e inspección. NO permite crear, editar ni ejecutar automatizaciones.

---

## ENTIDADES CANÓNICAS EXISTENTES

### 1. automation_definitions

**Propósito**: Almacena definiciones de automatizaciones (reglas Señal → Acciones)

**Source of Truth**: PostgreSQL (`automation_definitions`)

**Quién Escribe**:
- ❌ NO se escribe desde Admin UI en Fase 6
- ✅ Se escribe manualmente en PostgreSQL (futuro: Fase 7+)

**Quién Lee**:
- ✅ Admin UI (Fase 6): Solo lectura
- ✅ Automation Engine v2: Lee para ejecutar automatizaciones activas

**Cuándo se Crea**:
- Manualmente en PostgreSQL (INSERT directo)
- Futuro: Desde Admin UI (Fase 7+)

**Cuándo se Actualiza**:
- Manualmente en PostgreSQL (UPDATE directo)
- Futuro: Desde Admin UI (Fase 7+)

**Cuándo NO se Toca**:
- ❌ NO desde Admin UI en Fase 6
- ❌ NO desde Automation Engine (solo lee)
- ❌ NO desde Signal Dispatcher (solo emite señales)

---

### 2. automation_runs

**Propósito**: Registro de ejecuciones de automatizaciones

**Source of Truth**: PostgreSQL (`automation_runs`)

**Quién Escribe**:
- ✅ Automation Engine v2: Crea y actualiza runs
- ❌ NO se escribe desde Admin UI

**Quién Lee**:
- ✅ Admin UI (Fase 6): Solo lectura para inspección

**Cuándo se Crea**:
- Cuando Automation Engine v2 ejecuta una automatización

**Cuándo se Actualiza**:
- Cuando Automation Engine v2 finaliza una ejecución (success/failed/skipped)

**Cuándo NO se Toca**:
- ❌ NO desde Admin UI
- ❌ NO desde Signal Dispatcher
- ❌ NO manualmente (solo Automation Engine)

---

### 3. automation_run_steps

**Propósito**: Registro de pasos individuales dentro de ejecuciones

**Source of Truth**: PostgreSQL (`automation_run_steps`)

**Quién Escribe**:
- ✅ Automation Engine v2: Crea y actualiza steps
- ❌ NO se escribe desde Admin UI

**Quién Lee**:
- ✅ Admin UI (Fase 6): Solo lectura para inspección

**Cuándo se Crea**:
- Cuando Automation Engine v2 ejecuta un step de una automatización

**Cuándo se Actualiza**:
- Cuando Automation Engine v2 finaliza un step (success/failed/skipped)

**Cuándo NO se Toca**:
- ❌ NO desde Admin UI
- ❌ NO desde Signal Dispatcher
- ❌ NO manualmente (solo Automation Engine)

---

### 4. automation_dedup

**Propósito**: Tabla de deduplicación para idempotencia

**Source of Truth**: PostgreSQL (`automation_dedup`)

**Quién Escribe**:
- ✅ Automation Engine v2: Registra dedupe keys
- ❌ NO se escribe desde Admin UI

**Quién Lee**:
- ✅ Automation Engine v2: Verifica dedupe antes de ejecutar
- ✅ Admin UI (Fase 6): Solo lectura para inspección

**Cuándo se Crea**:
- Cuando Automation Engine v2 ejecuta exitosamente una automatización

**Cuándo se Actualiza**:
- ❌ NO se actualiza (solo INSERT)

**Cuándo NO se Toca**:
- ❌ NO desde Admin UI
- ❌ NO desde Signal Dispatcher
- ❌ NO manualmente (solo Automation Engine)

---

## ESTADOS CANÓNICOS

### automation_definitions.status

**Valores Válidos**:
- `draft`: Borrador, no se ejecuta
- `active`: Activa, se ejecuta cuando se emite señal
- `deprecated`: Deshabilitada pero mantenida para histórico
- `broken`: Rota, requiere atención

**Reglas Obligatorias**:
- ✅ Solo automatizaciones con `status = 'active'` se ejecutan
- ✅ UI NO puede forzar ejecución de automatizaciones con `status != 'active'`
- ✅ UI NO puede saltarse el status (no puede ejecutar draft/deprecated/broken)
- ✅ El Automation Engine v2 respeta el status (solo ejecuta 'active')

**En Fase 6**:
- ✅ UI puede LEER el status
- ✅ UI puede MOSTRAR el status
- ❌ UI NO puede CAMBIAR el status
- ❌ UI NO puede EJECUTAR automatizaciones

---

### automation_runs.status

**Valores Válidos**:
- `running`: En ejecución
- `success`: Completada exitosamente
- `failed`: Falló
- `skipped`: Saltada (dedupe o condición no cumplida)

**Reglas Obligatorias**:
- ✅ Solo Automation Engine v2 puede cambiar el status
- ✅ UI NO puede modificar el status
- ✅ UI solo puede LEER y MOSTRAR el status

**En Fase 6**:
- ✅ UI puede LEER el status
- ✅ UI puede MOSTRAR el status
- ❌ UI NO puede CAMBIAR el status
- ❌ UI NO puede RE-EJECUTAR runs

---

### automation_run_steps.status

**Valores Válidos**:
- `running`: En ejecución
- `success`: Completado exitosamente
- `failed`: Falló
- `skipped`: Saltado (onError = 'skip')

**Reglas Obligatorias**:
- ✅ Solo Automation Engine v2 puede cambiar el status
- ✅ UI NO puede modificar el status
- ✅ UI solo puede LEER y MOSTRAR el status

**En Fase 6**:
- ✅ UI puede LEER el status
- ✅ UI puede MOSTRAR el status
- ❌ UI NO puede CAMBIAR el status
- ❌ UI NO puede RE-EJECUTAR steps

---

## OPERACIONES PERMITIDAS EN FASE 6

### ✅ PERMITIDO

1. **Listar Definitions**:
   - Listar todas las automatizaciones definidas
   - Filtrar por status (draft, active, deprecated, broken)
   - Ordenar por nombre, fecha, status

2. **Leer Definition JSON**:
   - Ver el JSON completo de una definición
   - Ver estructura: trigger, steps, parallel_groups
   - Ver metadata: name, description, version

3. **Listar Runs**:
   - Listar todas las ejecuciones
   - Filtrar por automation_key, signal_type, status
   - Ordenar por fecha (más recientes primero)

4. **Leer Steps**:
   - Ver todos los steps de un run
   - Ver input, output, error de cada step
   - Ver timestamps (started_at, finished_at)

5. **Inspeccionar Errores**:
   - Ver errores de runs fallidos
   - Ver errores de steps fallidos
   - Ver stack traces si están disponibles

6. **Ver Dedupe**:
   - Ver dedupe keys registrados
   - Ver cuándo se registró cada dedupe
   - Filtrar por automation_key o signal_id

---

## OPERACIONES PROHIBIDAS EN FASE 6

### ❌ PROHIBIDO

1. **Crear Automatizaciones**:
   - ❌ NO crear nuevas definiciones
   - ❌ NO insertar en `automation_definitions`
   - ❌ NO validar JSON de definiciones

2. **Editar Automatizaciones**:
   - ❌ NO modificar definiciones existentes
   - ❌ NO actualizar JSON de definiciones
   - ❌ NO cambiar metadata (name, description)

3. **Activar/Desactivar Automatizaciones**:
   - ❌ NO cambiar status de `draft` → `active`
   - ❌ NO cambiar status de `active` → `deprecated`
   - ❌ NO cambiar status de `broken` → `active`

4. **Ejecutar Automatizaciones Manualmente**:
   - ❌ NO llamar `runAutomationsForSignal()` desde UI
   - ❌ NO emitir señales desde UI
   - ❌ NO forzar ejecución de automatizaciones

5. **Emitir Señales**:
   - ❌ NO llamar `dispatchSignal()` desde UI
   - ❌ NO crear señales artificiales
   - ❌ NO simular eventos

6. **Tocar Feature Flags**:
   - ❌ NO activar `AUTOMATIONS_ENGINE_ENABLED` desde UI
   - ❌ NO modificar flags desde UI
   - ❌ NO cambiar configuración de flags

7. **Modificar Runs/Steps**:
   - ❌ NO actualizar status de runs
   - ❌ NO actualizar status de steps
   - ❌ NO modificar errores o outputs

8. **Modificar Dedupe**:
   - ❌ NO eliminar dedupe keys
   - ❌ NO modificar dedupe keys
   - ❌ NO limpiar dedupe manualmente

---

## ALCANCE EXACTO DE FASE 6

### Pantallas a Implementar

1. **Lista de Automatizaciones** (`/admin/automations`):
   - Tabla con: automation_key, name, status, version, created_at
   - Filtros: status (draft, active, deprecated, broken)
   - Ordenamiento: nombre, fecha, status
   - Acción: Ver detalle (solo lectura)

2. **Detalle de Automatización** (`/admin/automations/:id`):
   - Mostrar: name, description, status, version
   - Mostrar: JSON completo de definition (read-only)
   - Mostrar: metadata (created_at, updated_at, created_by, updated_by)
   - Acciones: NINGUNA (solo lectura)

3. **Lista de Ejecuciones** (`/admin/automations/runs`):
   - Tabla con: automation_key, signal_type, status, started_at, finished_at
   - Filtros: automation_key, signal_type, status
   - Ordenamiento: fecha (más recientes primero)
   - Acción: Ver detalle (solo lectura)

4. **Detalle de Ejecución** (`/admin/automations/runs/:id`):
   - Mostrar: automation_key, signal_id, signal_type, status
   - Mostrar: timestamps (started_at, finished_at)
   - Mostrar: error (si falló)
   - Mostrar: lista de steps con detalles
   - Acciones: NINGUNA (solo lectura)

5. **Detalle de Step** (`/admin/automations/runs/:runId/steps/:stepId`):
   - Mostrar: action_key, status, input, output, error
   - Mostrar: timestamps (started_at, finished_at)
   - Acciones: NINGUNA (solo lectura)

---

## ENDPOINTS REQUERIDOS (Fase 7)

**NOTA**: Los endpoints se implementarán en Fase 7, pero se documentan aquí para claridad.

### Endpoints de Lectura (Fase 6)

- `GET /admin/api/automations` - Listar definitions
- `GET /admin/api/automations/:id` - Obtener definition
- `GET /admin/api/automation-runs` - Listar runs
- `GET /admin/api/automation-runs/:id` - Obtener run
- `GET /admin/api/automation-runs/:id/steps` - Listar steps de un run
- `GET /admin/api/automation-runs/:runId/steps/:stepId` - Obtener step

### Endpoints de Escritura (Fase 7+)

- `POST /admin/api/automations` - Crear definition (Fase 7+)
- `PUT /admin/api/automations/:id` - Actualizar definition (Fase 7+)
- `POST /admin/api/automations/:id/activate` - Activar (Fase 7+)
- `POST /admin/api/automations/:id/deactivate` - Desactivar (Fase 7+)

---

## RELACIÓN CON CONTRATOS

### Contrato D (Automatizaciones Canónicas)

**Obligación**:
- Las automatizaciones consumen señales emitidas
- Las automatizaciones ejecutan acciones registradas
- Solo automatizaciones con status 'active' se ejecutan

**Relación con Fase 6**:
- UI NO puede crear automatizaciones (Fase 7+)
- UI NO puede activar automatizaciones (Fase 7+)
- UI solo puede INSPECCIONAR el estado actual

### Contrato C (Señales Canónicas)

**Obligación**:
- Las señales se emiten desde signal-dispatcher
- Las señales NO se emiten desde servicios canónicos

**Relación con Fase 6**:
- UI NO puede emitir señales
- UI solo puede VER señales que ya fueron emitidas (en runs)

---

## PROHIBICIONES ABSOLUTAS

### Está PROHIBIDO en Fase 6

1. ❌ Crear automatizaciones
2. ❌ Editar automatizaciones
3. ❌ Activar/desactivar automatizaciones
4. ❌ Ejecutar automatizaciones manualmente
5. ❌ Emitir señales
6. ❌ Tocar feature flags
7. ❌ Modificar runs/steps
8. ❌ Modificar dedupe

### Está PERMITIDO en Fase 6

1. ✅ Listar definitions
2. ✅ Leer definition JSON
3. ✅ Listar runs
4. ✅ Leer steps
5. ✅ Inspeccionar errores
6. ✅ Ver dedupe

---

## ESTADO ACTUAL

**Fase 6 (Admin UI)**: ⏳ **PENDIENTE DE IMPLEMENTACIÓN**

**Documentación**: ✅ **COMPLETADA Y CERTIFICADA**

**Próximo Paso**: Implementar pantallas de solo lectura (Fase 6)

---

## CONCLUSIÓN

Este documento define el alcance EXACTO de la Fase 6 (Admin UI).

**Principio Fundamental**:
> La Fase 6 es SOLO de visualización e inspección. NO permite crear, editar ni ejecutar automatizaciones.

**Base Sólida**:
- Entidades documentadas
- Estados canónicos definidos
- Operaciones permitidas/prohibidas explícitas
- Listo para implementar UI sin riesgo

---

**FIN DEL DOCUMENTO**










