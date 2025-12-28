# DIAGNÓSTICO FASE D - AUTOMATIZACIONES CANÓNICAS
## Estado Actual del Sistema

**Fecha**: 2025-01-XX  
**Objetivo**: Documentar código existente antes de implementar Fase D

---

## CÓDIGO EXISTENTE

### 1. Automation Engine

**Archivo**: `src/core/automations/automation-engine.js`

**Funcionalidad**:
- `runAutomationsForSignal()` - Ejecuta automatizaciones para una señal emitida
- `processAutomation()` - Procesa una automatización individual
- Maneja dedupe con fingerprint
- Registra ejecuciones en `pde_automation_executions`

**Estado**: ✅ Funcional pero usa esquema antiguo (`pde_automations`)

---

### 2. Action Registry

**Archivos**:
- `src/core/actions/action-registry.js` - Registry principal de acciones
- `src/core/automations/action-registry.js` - Registry específico de automatizaciones

**Funcionalidad**:
- `getActionCatalog()` - Catálogo de acciones disponibles
- `getActionRunner()` - Ejecutor de acciones
- Acciones registradas: `progress.increment_streak`, `analytics.track`, `energy.append_event`, etc.

**Estado**: ✅ Funcional pero no usa servicios canónicos (Contrato B)

---

### 3. Signal Dispatcher

**Archivo**: `src/core/signals/signal-dispatcher.js`

**Funcionalidad**:
- `dispatchSignal()` - Dispatchea señal y ejecuta automatizaciones
- Persiste emisión en `pde_signal_emissions`
- Llama a `runAutomationsForSignal()` del automation engine

**Estado**: ✅ Funcional, ya integrado con automation engine

---

### 4. Repositorios PostgreSQL

**Archivos**:
- `src/infra/repos/automation-repo-pg.js` - Repositorio de automatizaciones
- `src/infra/repos/automation-executions-repo-pg.js` - Repositorio de ejecuciones
- `src/infra/repos/automation-audit-repo-pg.js` - Repositorio de auditoría

**Estado**: ✅ Funcional pero usa esquema antiguo

---

### 5. Migraciones Existentes

**Archivo**: `database/migrations/v5.19.0-pde-automations-engine-v1.sql`

**Tablas**:
- `pde_automations` - Definiciones de automatizaciones
- `pde_automation_audit_log` - Log de auditoría
- `pde_automation_executions` - Ejecuciones con dedupe

**Estado**: ✅ Aplicada, pero esquema diferente al requerido para Fase D

---

### 6. Admin UI

**Archivos**:
- `src/endpoints/admin-automations-api.js` - API JSON
- `src/endpoints/admin-automations-ui.js` - UI HTML
- `src/endpoints/admin-automations.js` - Handler legacy

**Funcionalidad**:
- Listar automatizaciones
- Crear/editar automatizaciones
- Activar/desactivar automatizaciones
- Ver ejecuciones

**Estado**: ✅ Funcional pero usa esquema antiguo

---

### 7. Feature Flags

**Archivo**: `src/core/flags/feature-flags.js`

**Flag existente**:
- `automations_beta: 'off'` - Controla ejecución de reglas con status 'beta'

**Estado**: ✅ Funcional, pero necesitamos `AUTOMATIONS_ENGINE_ENABLED`

---

## CONEXIONES ACTUALES

### Flujo Actual

1. **Emisión de Señal**: `pde-signal-emitter.js` → `signal-dispatcher.js`
2. **Dispatch**: `signal-dispatcher.js` → `runAutomationsForSignal()`
3. **Engine**: `automation-engine.js` → busca en `pde_automations`
4. **Ejecución**: `action-registry.js` → ejecuta acciones
5. **Registro**: `pde_automation_executions` (dedupe por fingerprint)

---

## DIFERENCIAS CON FASE D

### Esquema de Base de Datos

**Actual**:
- `pde_automations` (automation_key, trigger_signal_key, definition JSONB)
- `pde_automation_executions` (fingerprint único)
- `pde_automation_audit_log`

**Requerido (Fase D)**:
- `automation_definitions` (id uuid, automation_key, definition JSONB, status)
- `automation_runs` (id uuid, automation_id, signal_id, status)
- `automation_run_steps` (id uuid, run_id, step_index, action_key, status)
- `automation_dedup` (dedup_key único)

**Decisión**: Crear nuevo esquema alineado con Contratos A/B/C, mantener antiguo aislado

---

### Action Registry

**Actual**: Acciones ejecutan directamente (no usan servicios canónicos)

**Requerido (Fase D)**: Acciones DEBEN usar `StudentMutationService` (Contrato B)

**Decisión**: Extender action-registry para usar servicios canónicos

---

### Feature Flag

**Actual**: `automations_beta: 'off'`

**Requerido (Fase D)**: `AUTOMATIONS_ENGINE_ENABLED` (OFF → BETA → ON)

**Decisión**: Añadir nuevo flag específico para Fase D

---

## PLAN DE IMPLEMENTACIÓN

### Estrategia

1. **Crear nuevo esquema** sin tocar el antiguo
2. **Aislar código antiguo** bajo feature flag
3. **Implementar Fase D** con nuevo esquema
4. **Migrar gradualmente** del antiguo al nuevo

### Aislamiento

- Código antiguo: seguirá funcionando si `automations_beta: 'on'`
- Código nuevo: solo funciona si `AUTOMATIONS_ENGINE_ENABLED: 'on'` o `'beta'`
- Ambos pueden coexistir durante transición

---

## CONCLUSIÓN

El sistema ya tiene automatizaciones funcionales, pero:
- No están alineadas con Contratos A/B/C
- No usan servicios canónicos para mutaciones
- Esquema de BD diferente al requerido
- No tienen feature flag específico para Fase D

**Acción**: Implementar Fase D como sistema nuevo, paralelo al existente, con migración gradual.

---

**FIN DEL DIAGNÓSTICO**






