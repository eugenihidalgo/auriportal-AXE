# Diagnóstico de Mecanismos Canónicos en MASTER v1

**Fecha:** 2026-01-XX  
**Versión:** 1.0.0  
**Estado:** DIAGNÓSTICO COMPLETO

---

## 🎯 Objetivo

Este documento identifica:
1. **Todos los mecanismos canónicos** que operan en el dominio MASTER
2. **Cuáles tienen contrato documentado** y están formalizados
3. **Cuáles operan sin contrato** y requieren documentación

---

## 📊 Resumen Ejecutivo

### Estadísticas Generales

- **Total de mecanismos identificados:** ~45
- **Con contrato documentado:** ~25 (56%)
- **Sin contrato documentado:** ~20 (44%)
- **Críticos sin contrato:** ~8 (18%)

### Categorías

1. **Routing y Resolución** (5 mecanismos)
   - ✅ Con contrato: 3
   - ❌ Sin contrato: 2

2. **Servicios Core** (17 mecanismos)
   - ✅ Con contrato: 8
   - ❌ Sin contrato: 9

3. **Proyecciones y Modelos** (3 mecanismos)
   - ✅ Con contrato: 3
   - ❌ Sin contrato: 0

4. **UI y Frontend** (12 mecanismos)
   - ✅ Con contrato: 6
   - ❌ Sin contrato: 6

5. **APIs y Endpoints** (8+ mecanismos)
   - ✅ Con contrato: 5
   - ❌ Sin contrato: 3+

---

## 1. ROUTING Y RESOLUCIÓN

### ✅ Con Contrato Documentado

#### 1.1 Master Route Registry v1
- **Ubicación:** `src/core/master/registry/master-route-registry.js`
- **Contrato:** `docs/MASTER_ROUTE_REGISTRY_RULES_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Registry canónico de todas las rutas `/master/*` (API e Island)

#### 1.2 Master Router Resolver v1
- **Ubicación:** `src/core/master/router/master-router-resolver.js`
- **Contrato:** `docs/MASTER_API_CONTRACTS.md` (MASTER-API-001)
- **Estado:** CANÓNICO
- **Descripción:** Resuelve rutas usando el registry, garantiza separación API/Island

#### 1.3 Master API Strict Resolution v1
- **Ubicación:** Implementado en `master-router-resolver.js`
- **Contrato:** `docs/MASTER_API_STRICT_RESOLUTION_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Blindaje absoluto: rutas `/master/api/**` NUNCA se resuelven como island

### ❌ Sin Contrato Documentado

#### 1.4 Master Layout Registry v1
- **Ubicación:** `src/core/master/registry/master-layout-registry.v1.json`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Registry de assets críticos (scripts, CSS) con versionado
- **Riesgo:** MEDIO - Sistema de assets crítico pero sin documentación formal
- **Referencias:** Mencionado en reglas constitucionales pero sin contrato explícito

#### 1.5 Master UI Factory v1
- **Ubicación:** `src/core/master/ui-factory/master-ui-factory.js`
- **Contrato:** ❌ NO DOCUMENTADO (solo mencionado en reglas)
- **Estado:** OPERATIVO
- **Descripción:** Factory que renderiza pantallas Master desde UI Master Registry
- **Riesgo:** MEDIO - Factory crítico para renderizado pero sin contrato explícito
- **Referencias:** Reglas constitucionales mencionan UI Master Factory pero no hay contrato

---

## 2. SERVICIOS CORE

### ✅ Con Contrato Documentado

#### 2.1 Cleaning Engine v1
- **Ubicación:** `src/core/master/services/cleaning-engine-service.js`
- **Contrato:** `docs/ALQUIMIA_CANONICA_V1.md` (sección 2), `docs/master/MASTER_CLEANING_ENGINE_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Único decisor de estados de limpieza, escribe en cleaning_item_state

#### 2.2 Cleaning Projection Model (CPM) v1
- **Ubicación:** `src/core/master/services/cleaning-projection-model.js`
- **Contrato:** `docs/CLEANING_PROJECTION_MODEL_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Función pura que proyecta estados de limpieza por view_layer

#### 2.3 Level Engine PDE v1
- **Ubicación:** `src/core/master/services/level-engine-service.js`
- **Contrato:** `docs/master/MASTER_LEVEL_ENGINE_PDE_V1.md`
- **Estado:** CANÓNICO (con feature flag)
- **Descripción:** Único decisor de nivel/fase PDE, calcula y persiste en PostgreSQL

#### 2.4 List Projection Model (LPM) v1
- **Ubicación:** `src/core/master/services/list-projection-model.js`
- **Contrato:** `docs/LIST_PROJECTION_MODEL_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Proyección de listas con items agrupados por estado

#### 2.5 Override Resolution Service v1
- **Ubicación:** `src/core/master/services/override-resolution-service.js`
- **Contrato:** `docs/OVERRIDES_SYSTEM_V1.md`, `docs/ALQUIMIA_ITEM_OVERRIDES_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Resuelve overrides de configuración de items por estudiante

#### 2.6 Student Creation Service v1
- **Ubicación:** `src/core/master/services/student-creation-service.js`
- **Contrato:** `docs/IDENTIDAD_ALUMNOS_CANONICA_V1.md` (sección 8)
- **Estado:** CANÓNICO
- **Descripción:** Crea estudiantes canónicamente (UUID-only, sin legacy)

#### 2.7 Alquimia Reset Service v1
- **Ubicación:** `src/core/master/services/alquimia-reset-service.js`
- **Contrato:** `docs/ALQUIMIA_RESET_CANONICAL_V1.md`, `docs/CLEANING_RESET_CANONICAL_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Resetea estados de limpieza (ITEM_STUDENT, ITEM_ALL, LIST_STUDENT, LIST_ALL)

#### 2.8 Alquimia Override Reset Service v1
- **Ubicación:** `src/core/master/services/alquimia-override-reset-service.js`
- **Contrato:** `docs/ALQUIMIA_OVERRIDE_RESET_ENDPOINT_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Resetea overrides de configuración (separado de cleaning state)

### ❌ Sin Contrato Documentado

#### 2.9 Alquimia Alumno Megalist Service
- **Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Genera megalist (vista completa) de items de limpieza para un alumno
- **Riesgo:** MEDIO - Servicio crítico para UI de Alquimia Alumno
- **Referencias:** Mencionado en `MASTER_ALQUIMIA_ALUMNO_CONTRACTS_V2.md` pero sin contrato del servicio

#### 2.10 Alquimia Report Service
- **Ubicación:** `src/core/master/services/alquimia-report-service.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Genera reportes de limpieza (panel humano + técnico)
- **Riesgo:** MEDIO - Servicio usado en `/master/api/alquimia-alumno/report`
- **Referencias:** Endpoint documentado pero no el servicio

#### 2.11 Alquimia History Resolver Service
- **Ubicación:** `src/core/master/services/alquimia-history-resolver-service.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Resuelve historial de limpiezas para un item específico
- **Riesgo:** MEDIO - Servicio usado en `/master/api/alquimia-alumno/item-history`
- **Referencias:** Endpoint documentado pero no el servicio

#### 2.12 History Generation Service
- **Ubicación:** `src/core/master/services/history-generation-service.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Genera historial agregado de limpiezas
- **Riesgo:** MEDIO - Servicio usado en `/master/api/history`
- **Referencias:** Endpoint mencionado pero servicio no documentado

#### 2.13 History Aggregation Service
- **Ubicación:** `src/core/master/services/history-aggregation-service.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Agrega eventos de limpieza en reportes
- **Riesgo:** BAJO - Servicio auxiliar

#### 2.14 History Signal Listener
- **Ubicación:** `src/core/master/services/history-signal-listener.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Escucha señales de limpieza y genera historial
- **Riesgo:** MEDIO - Integración con sistema de señales
- **Referencias:** Sistema de señales documentado pero listener no

#### 2.15 Cleaning State Seed Service
- **Ubicación:** `src/core/master/services/cleaning-state-seed-service.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Inicializa estados de limpieza para nuevos items/estudiantes
- **Riesgo:** MEDIO - Servicio crítico para inicialización
- **Referencias:** Mencionado en migraciones pero sin contrato

#### 2.16 Cleaning Layer Constants
- **Ubicación:** `src/core/master/services/cleaning-layer-constants.js`
- **Contrato:** ❌ NO DOCUMENTADO (solo mencionado en reglas)
- **Estado:** OPERATIVO
- **Descripción:** Constantes y validaciones para clean_layer y view_layer
- **Riesgo:** MEDIO - Validaciones críticas sin contrato explícito
- **Referencias:** Usado en múltiples servicios pero sin documentación formal

#### 2.17 Sponsor Service
- **Ubicación:** `src/core/master/services/sponsor-service.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Lógica de negocio para sistema de apadrinados
- **Riesgo:** MEDIO - Servicio crítico para dominio de apadrinados
- **Referencias:** Endpoints documentados pero servicio no

---

## 3. PROYECCIONES Y MODELOS

### ✅ Con Contrato Documentado

#### 3.1 Cleaning Projection Model (CPM) v1
- **Ya listado en 2.2**

#### 3.2 List Projection Model (LPM) v1
- **Ya listado en 2.4**

#### 3.3 View Authority v1
- **Ubicación:** Implementado en múltiples servicios
- **Contrato:** `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Backend es única autoridad de estado, frontend NO calcula

---

## 4. UI Y FRONTEND

### ✅ Con Contrato Documentado

#### 4.1 Master Sidebar v1
- **Ubicación:** `public/js/master/master-sidebar-client.js`
- **Contrato:** `docs/MASTER_SIDEBAR_REGISTRY_CONTRACT.md`, `docs/MASTER_SIDEBAR_LAYOUT_CONTRACT_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Sidebar registry-driven con DOM API only

#### 4.2 Master Script Loader v1
- **Ubicación:** `public/js/master/master-script-loader.js`
- **Contrato:** `docs/ASSETS_SYSTEM_V1.md` (mencionado en reglas constitucionales)
- **Estado:** CANÓNICO
- **Descripción:** Loader canónico de assets críticos con preflight

#### 4.3 UX Action Registry v1
- **Ubicación:** `src/core/ux/action-registry/ux-action-registry.js`
- **Contrato:** `docs/UX_ACTION_REGISTRY_CONTRACT_V1.md`, `docs/UX_CONTRACT_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Registry canónico de acciones UI, única puerta de intención de usuario

#### 4.4 Perform Action v1
- **Ubicación:** `public/js/master/ux/perform-action.v1.js`
- **Contrato:** `docs/UX_CONTRACT_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Wrapper canónico para ejecutar acciones UI registradas

#### 4.5 Refresh Engine v2
- **Ubicación:** `public/js/master/master-refresh-engine-v1.js`, `public/js/master/ux/refresh-engine-v2-adapter.js`
- **Contrato:** `docs/REFRESH_CONTRACT_V1.md`, `docs/REFRESH_PLAN_CONTRACT_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Engine declarativo de refresh post-acción

#### 4.6 Master Theme Resolver v1
- **Ubicación:** `public/js/master/master-theme-resolver.js`
- **Contrato:** `docs/THEME_CONTRACT.md` (mencionado en reglas)
- **Estado:** OPERATIVO
- **Descripción:** Resuelve temas y capabilities para UI

### ❌ Sin Contrato Documentado

#### 4.7 Master Alquimia General Client
- **Ubicación:** `public/js/master/master-alquimia-general-client.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Cliente JavaScript completo para Alquimia General (UI principal)
- **Riesgo:** ALTO - Cliente más complejo del sistema, ~6868 líneas, sin contrato
- **Referencias:** UI documentada en `MASTER_ALQUIMIA_GENERAL_UI_V1.md` pero no el cliente JS

#### 4.8 Master Alquimia Alumno Client
- **Ubicación:** `public/js/master/master-alquimia-alumno-client.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Cliente JavaScript para Alquimia Alumno (megalist, report, history)
- **Riesgo:** ALTO - Cliente crítico para UI de Alquimia Alumno
- **Referencias:** UI documentada en `MASTER_ALQUIMIA_ALUMNO_CONTRACTS_V2.md` pero no el cliente JS

#### 4.9 Master Alumnos Client
- **Ubicación:** `public/js/master/master-alumnos-client.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Cliente JavaScript para gestión de alumnos
- **Riesgo:** MEDIO - Cliente operativo pero sin contrato

#### 4.10 Master Alumnos Crear Client
- **Ubicación:** `public/js/master/master-alumnos-crear-client.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Cliente JavaScript para creación de alumnos
- **Riesgo:** MEDIO - Cliente operativo pero sin contrato

#### 4.11 Master Lugares Client
- **Ubicación:** `public/js/master/master-lugares-client.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Cliente JavaScript para sistema de lugares
- **Riesgo:** MEDIO - Sistema de lugares documentado pero cliente JS no
- **Referencias:** `docs/master/MASTER_PLACES_SYSTEM_V1.md` documenta sistema pero no cliente

#### 4.12 Master Proyectos Client
- **Ubicación:** `public/js/master/master-proyectos-client.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Cliente JavaScript para sistema de proyectos
- **Riesgo:** MEDIO - Sistema de proyectos documentado pero cliente JS no
- **Referencias:** `docs/master/MASTER_PROJECTS_SYSTEM_V1.md` documenta sistema pero no cliente

#### 4.13 Master Apadrinados Client
- **Ubicación:** `public/js/master/master-apadrinados-client.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Cliente JavaScript para sistema de apadrinados
- **Riesgo:** MEDIO - Cliente operativo pero sin contrato

#### 4.14 Master ACS Runtime Guard
- **Ubicación:** `public/js/master/master-acs-runtime-guard.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Guard de runtime para validaciones de acceso/contexto
- **Riesgo:** MEDIO - Guard crítico pero sin contrato

#### 4.15 Master Notes Panel
- **Ubicación:** `public/js/master/master-notes-panel.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Panel de notas para investigación
- **Riesgo:** BAJO - Feature auxiliar

#### 4.16 Master Informes Limpiezas Client
- **Ubicación:** `public/js/master/master-informes-limpiezas-client.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Cliente para informes de limpiezas
- **Riesgo:** MEDIO - Cliente operativo pero sin contrato

#### 4.17 Master Informe Total PDE Client
- **Ubicación:** `public/js/master/master-informe-total-pde-client.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Cliente para informe total PDE
- **Riesgo:** MEDIO - Cliente operativo pero sin contrato

#### 4.18 Master Inject Master
- **Ubicación:** `public/js/master/inject_master.js`
- **Contrato:** ❌ NO DOCUMENTADO (solo mencionado en reglas)
- **Estado:** OPERATIVO
- **Descripción:** Entry gate canónico para dominio MASTER
- **Riesgo:** MEDIO - Entry gate crítico pero sin contrato explícito
- **Referencias:** Reglas constitucionales mencionan entry gate pero no hay contrato

#### 4.19 Toast UI v1
- **Ubicación:** `public/js/master/ui/toast.js`
- **Contrato:** `docs/MASTER_UI_TOAST_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Sistema de toasts no bloqueantes

---

## 5. APIS Y ENDPOINTS

### ✅ Con Contrato Documentado

#### 5.1 Master API Alquimia General
- **Ubicación:** `src/endpoints/master-api-alquimia-general.js`
- **Contrato:** `docs/MASTER_ALQUIMIA_GENERAL_CONTRACTS_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Endpoints unificados para Alquimia General (listas, items, limpiezas, resets)

#### 5.2 Master API Alquimia Alumno
- **Ubicación:** `src/endpoints/master-api-alquimia-alumno.js`
- **Contrato:** `docs/MASTER_ALQUIMIA_ALUMNO_CONTRACTS_V2.md`, `docs/MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Endpoints para Alquimia Alumno (megalist, clean, history, report)

#### 5.3 Master API Students
- **Ubicación:** `src/endpoints/master-api-students.js`
- **Contrato:** `docs/IDENTIDAD_ALUMNOS_CANONICA_V1.md` (sección 8)
- **Estado:** CANÓNICO
- **Descripción:** Endpoints para gestión de estudiantes (UUID-only)

#### 5.4 Master API Levels
- **Ubicación:** `src/endpoints/master-api-levels.js`, `src/endpoints/master-api-student-levels.js`
- **Contrato:** `docs/master/MASTER_LEVEL_ENGINE_PDE_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Endpoints para Level Engine PDE (líneas, definiciones, estado, recompute)

#### 5.5 Master API Level Gates
- **Ubicación:** `src/endpoints/master-api-level-gates.js`
- **Contrato:** `docs/master/MASTER_LEVEL_GATES_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Endpoints para gestión de gates (bloqueos de nivel)

### ❌ Sin Contrato Documentado

#### 5.6 Master API History
- **Ubicación:** `src/endpoints/master-api-history.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para historial agregado de limpiezas
- **Riesgo:** MEDIO - Endpoint operativo pero sin contrato
- **Referencias:** Mencionado en `HISTORIAL_LIMPIEZAS_V1.md` pero sin contrato explícito

#### 5.7 Master API Tags
- **Ubicación:** `src/endpoints/master-api-tags.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para TAG SOT GLOBAL v1
- **Riesgo:** MEDIO - Sistema de tags crítico pero sin contrato
- **Referencias:** Mencionado en registry como "TAG SOT GLOBAL v1" pero sin contrato

#### 5.8 Master API Classifications
- **Ubicación:** `src/endpoints/master-api-classifications.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para CLASSIFICATION SOT GLOBAL v1
- **Riesgo:** MEDIO - Sistema de clasificaciones crítico pero sin contrato
- **Referencias:** Mencionado en registry como "CLASSIFICATION SOT GLOBAL v1" pero sin contrato

#### 5.9 Master API Student Overrides
- **Ubicación:** `src/endpoints/master-api-student-overrides.js`
- **Contrato:** ❌ NO DOCUMENTADO (sistema documentado pero no endpoints)
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para OVERRIDES SYSTEM v1
- **Riesgo:** MEDIO - Sistema documentado pero endpoints no
- **Referencias:** `docs/OVERRIDES_SYSTEM_V1.md` documenta sistema pero no endpoints

#### 5.10 Master API Student Item Overrides
- **Ubicación:** `src/endpoints/master-api-student-item-overrides.js`
- **Contrato:** ❌ NO DOCUMENTADO (sistema documentado pero no endpoints)
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para overrides de items por estudiante
- **Riesgo:** MEDIO - Sistema documentado pero endpoints no
- **Referencias:** `docs/ALQUIMIA_ITEM_OVERRIDES_V1.md` documenta sistema pero no endpoints

#### 5.11 Master API UTE
- **Ubicación:** `src/endpoints/master-api-ute.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para UTE CORE v1 (definitions, states, execute, recompute)
- **Riesgo:** MEDIO - Sistema UTE mencionado pero sin contrato
- **Referencias:** Mencionado en registry como "UTE CORE v1" pero sin contrato

#### 5.12 Master API Origins
- **Ubicación:** `src/endpoints/master-api-origin.js`
- **Contrato:** `docs/ORIGIN_CONTRACT_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Endpoints para ORIGIN CONTRACT v1

#### 5.13 Master API Places
- **Ubicación:** `src/endpoints/master-api-places.js`
- **Contrato:** ❌ NO DOCUMENTADO (sistema documentado pero no endpoints)
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para SISTEMA DE LUGARES v1
- **Riesgo:** MEDIO - Sistema documentado pero endpoints no
- **Referencias:** `docs/master/MASTER_PLACES_SYSTEM_V1.md` documenta sistema pero no endpoints

#### 5.14 Master API Place Categories
- **Ubicación:** `src/endpoints/master-api-place-categories.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para categorías de lugares
- **Riesgo:** BAJO - Endpoint auxiliar

#### 5.15 Master API Places Catalog
- **Ubicación:** `src/endpoints/master-api-places-catalog.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para catálogo de lugares
- **Riesgo:** MEDIO - Endpoint operativo pero sin contrato

#### 5.16 Master API Projects
- **Ubicación:** `src/endpoints/master-api-projects.js`
- **Contrato:** ❌ NO DOCUMENTADO (sistema documentado pero no endpoints)
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para SISTEMA DE PROYECTOS v1
- **Riesgo:** MEDIO - Sistema documentado pero endpoints no
- **Referencias:** `docs/master/MASTER_PROJECTS_SYSTEM_V1.md` documenta sistema pero no endpoints

#### 5.17 Master API Project Categories
- **Ubicación:** `src/endpoints/master-api-project-categories.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para categorías de proyectos
- **Riesgo:** BAJO - Endpoint auxiliar

#### 5.18 Master API Projects Catalog
- **Ubicación:** `src/endpoints/master-api-projects-catalog.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para catálogo de proyectos
- **Riesgo:** MEDIO - Endpoint operativo pero sin contrato

#### 5.19 Master API Sponsors
- **Ubicación:** `src/endpoints/master-api-sponsors.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para SISTEMA DE APADRINADOS v1
- **Riesgo:** MEDIO - Sistema operativo pero sin contrato
- **Referencias:** Mencionado en registry como "SISTEMA DE APADRINADOS v1" pero sin contrato

#### 5.20 Master API Sponsor Care
- **Ubicación:** `src/endpoints/master-api-sponsor-care.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints para gestión de cuidados de apadrinados
- **Riesgo:** MEDIO - Endpoint operativo pero sin contrato

#### 5.21 Master API Assets
- **Ubicación:** `src/endpoints/master-api-assets.js`
- **Contrato:** ❌ NO DOCUMENTADO (sistema documentado pero no endpoint)
- **Estado:** OPERATIVO
- **Descripción:** Endpoint para diagnóstico de assets cargados
- **Riesgo:** BAJO - Endpoint de diagnóstico

#### 5.22 Master API Health / Diagnostics
- **Ubicación:** `src/endpoints/master-api-health.js`, `src/endpoints/master-api-system-diagnostics.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Endpoints de salud y diagnósticos del sistema
- **Riesgo:** BAJO - Endpoints de diagnóstico

---

## 6. REGISTRIES

### ✅ Con Contrato Documentado

#### 6.1 Master Route Registry v1
- **Ya listado en 1.1**

#### 6.2 Master Sidebar Registry v1
- **Ubicación:** `src/core/master/registry/master-sidebar-registry.js`
- **Contrato:** `docs/MASTER_SIDEBAR_REGISTRY_CONTRACT.md`
- **Estado:** CANÓNICO
- **Descripción:** Registry canónico de items del sidebar

#### 6.3 UX Action Registry v1
- **Ya listado en 4.3**

#### 6.4 Refresh Surface Registry v1
- **Ubicación:** `src/core/ux/refresh-surface-registry.v1.js`
- **Contrato:** `docs/REFRESH_CONTRACT_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Registry de superficies refreshables

### ❌ Sin Contrato Documentado

#### 6.5 Master Layout Registry v1
- **Ya listado en 1.4**

#### 6.6 Master UI Schema v1
- **Ubicación:** `src/core/master/registry/master-ui-schema.v1.json`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Schema JSON para validación de pantallas Master
- **Riesgo:** MEDIO - Schema crítico para UI Factory pero sin contrato
- **Referencias:** Usado por UI Factory pero no documentado

#### 6.7 UI Master Registry Runtime
- **Ubicación:** `src/core/master/registry/ui-master-registry.runtime.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Registry runtime de pantallas Master activas
- **Riesgo:** MEDIO - Registry crítico para UI Factory pero sin contrato

---

## 7. SISTEMAS DE DOMINIO

### ✅ Con Contrato Documentado

#### 7.1 Alquimia (Sistema Completo)
- **Contrato:** `docs/ALQUIMIA_CANONICA_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Sistema completo de transmutaciones energéticas

#### 7.2 Level Engine PDE v1
- **Ya listado en 2.3**

#### 7.3 Level Gates v1
- **Contrato:** `docs/master/MASTER_LEVEL_GATES_V1.md`
- **Estado:** CANÓNICO
- **Descripción:** Sistema de bloqueos declarativos de niveles

### ❌ Sin Contrato Documentado

#### 7.4 Sistema de Lugares v1
- **Contrato:** `docs/master/MASTER_PLACES_SYSTEM_V1.md` (sistema documentado)
- **Estado:** OPERATIVO
- **Descripción:** Sistema completo de lugares
- **Riesgo:** MEDIO - Sistema documentado pero endpoints y cliente JS no
- **Gaps:** Endpoints y cliente JS sin contrato (ver 5.13, 4.11)

#### 7.5 Sistema de Proyectos v1
- **Contrato:** `docs/master/MASTER_PROJECTS_SYSTEM_V1.md` (sistema documentado)
- **Estado:** OPERATIVO
- **Descripción:** Sistema completo de proyectos
- **Riesgo:** MEDIO - Sistema documentado pero endpoints y cliente JS no
- **Gaps:** Endpoints y cliente JS sin contrato (ver 5.16, 4.12)

#### 7.6 Sistema de Apadrinados v1
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Sistema completo de apadrinados
- **Riesgo:** ALTO - Sistema crítico completamente sin contrato
- **Gaps:** Servicio, endpoints y cliente JS sin contrato (ver 2.17, 5.19, 4.13)

#### 7.7 TAG SOT GLOBAL v1
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Sistema de tags como Source of Truth global
- **Riesgo:** MEDIO - Sistema crítico sin contrato
- **Gaps:** Endpoints sin contrato (ver 5.7)

#### 7.8 CLASSIFICATION SOT GLOBAL v1
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Sistema de clasificaciones como Source of Truth global
- **Riesgo:** MEDIO - Sistema crítico sin contrato
- **Gaps:** Endpoints sin contrato (ver 5.8)

#### 7.9 UTE CORE v1
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Sistema UTE (Unidades de Trabajo Energético)
- **Riesgo:** MEDIO - Sistema mencionado pero sin contrato
- **Gaps:** Endpoints sin contrato (ver 5.11)
- **Referencias:** `docs/UTE_CORE_V1.md` existe pero no es contrato completo

---

## 8. MECANISMOS AUXILIARES

### ❌ Sin Contrato Documentado

#### 8.1 Master Differential Diagnostics
- **Ubicación:** `src/core/master/diagnostics/master-differential-diagnostics.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Sistema de diagnósticos diferenciales
- **Riesgo:** BAJO - Sistema auxiliar de diagnóstico

#### 8.2 Master Page Renderer
- **Ubicación:** `src/core/master/layout/master-page-renderer.js`
- **Contrato:** ❌ NO DOCUMENTADO
- **Estado:** OPERATIVO
- **Descripción:** Renderer canónico de páginas Master
- **Riesgo:** MEDIO - Renderer crítico pero sin contrato
- **Referencias:** Usado por UI Factory pero no documentado

---

## 📋 RESUMEN DE GAPS CRÍTICOS

### 🔴 ALTA PRIORIDAD (Sin Contrato, Críticos)

1. **Master Alquimia General Client** (4.7)
   - Cliente más complejo del sistema (~6868 líneas)
   - Sin contrato documentado
   - Riesgo: ALTO

2. **Master Alquimia Alumno Client** (4.8)
   - Cliente crítico para UI de Alquimia Alumno
   - Sin contrato documentado
   - Riesgo: ALTO

3. **Sistema de Apadrinados v1** (7.6)
   - Sistema completo sin contrato
   - Servicio, endpoints y cliente JS sin documentar
   - Riesgo: ALTO

### 🟡 MEDIA PRIORIDAD (Sin Contrato, Importantes)

4. **Master Layout Registry v1** (1.4)
   - Sistema de assets crítico
   - Mencionado en reglas pero sin contrato explícito

5. **Master UI Factory v1** (1.5)
   - Factory crítico para renderizado
   - Mencionado en reglas pero sin contrato explícito

6. **Alquimia Alumno Megalist Service** (2.9)
   - Servicio crítico para UI
   - Sin contrato del servicio

7. **Alquimia Report Service** (2.10)
   - Servicio usado en endpoints
   - Sin contrato del servicio

8. **Alquimia History Resolver Service** (2.11)
   - Servicio usado en endpoints
   - Sin contrato del servicio

9. **History Generation Service** (2.12)
   - Servicio usado en endpoints
   - Sin contrato del servicio

10. **Cleaning State Seed Service** (2.15)
    - Servicio crítico para inicialización
    - Sin contrato

11. **Cleaning Layer Constants** (2.16)
    - Validaciones críticas
    - Sin contrato explícito

12. **Sponsor Service** (2.17)
    - Servicio crítico para dominio
    - Sin contrato

13. **Master API Tags** (5.7)
    - Sistema crítico TAG SOT GLOBAL
    - Sin contrato

14. **Master API Classifications** (5.8)
    - Sistema crítico CLASSIFICATION SOT GLOBAL
    - Sin contrato

15. **Master API UTE** (5.11)
    - Sistema UTE CORE v1
    - Sin contrato

16. **Master API Places** (5.13)
    - Sistema documentado pero endpoints no
    - Sin contrato de endpoints

17. **Master API Projects** (5.16)
    - Sistema documentado pero endpoints no
    - Sin contrato de endpoints

18. **Master API Sponsors** (5.19)
    - Sistema operativo pero sin contrato
    - Sin contrato

19. **Master UI Schema v1** (6.6)
    - Schema crítico para UI Factory
    - Sin contrato

20. **UI Master Registry Runtime** (6.7)
    - Registry crítico para UI Factory
    - Sin contrato

21. **Master Page Renderer** (8.2)
    - Renderer crítico
    - Sin contrato

---

## 🎯 RECOMENDACIONES

### Fase 1: Críticos (Alta Prioridad)

1. **Documentar Master Alquimia General Client**
   - Crear `docs/MASTER_ALQUIMIA_GENERAL_CLIENT_CONTRACT_V1.md`
   - Documentar arquitectura, estado, flujos principales

2. **Documentar Master Alquimia Alumno Client**
   - Crear `docs/MASTER_ALQUIMIA_ALUMNO_CLIENT_CONTRACT_V1.md`
   - Documentar megalist, report, history

3. **Documentar Sistema de Apadrinados v1**
   - Crear `docs/MASTER_SPONSORS_SYSTEM_V1.md`
   - Documentar servicio, endpoints y cliente JS

### Fase 2: Importantes (Media Prioridad)

4. **Documentar Master Layout Registry v1**
   - Crear `docs/MASTER_LAYOUT_REGISTRY_CONTRACT_V1.md`
   - Documentar sistema de assets canónico

5. **Documentar Master UI Factory v1**
   - Crear `docs/MASTER_UI_FACTORY_CONTRACT_V1.md`
   - Documentar factory y renderizado

6. **Documentar Servicios de Alquimia**
   - Crear contratos para Megalist, Report, History Resolver, History Generation

7. **Documentar Sistemas SOT Globales**
   - Crear contratos para TAG SOT GLOBAL v1
   - Crear contratos para CLASSIFICATION SOT GLOBAL v1
   - Crear contratos para UTE CORE v1

8. **Documentar Endpoints de Sistemas**
   - Completar contratos de endpoints para Places, Projects, Sponsors

### Fase 3: Auxiliares (Baja Prioridad)

9. **Documentar Mecanismos Auxiliares**
   - Documentar Cleaning State Seed Service
   - Documentar Cleaning Layer Constants
   - Documentar Master Page Renderer
   - Documentar Master UI Schema v1

---

## 📚 Referencias

### Documentos de Contratos Existentes

- `docs/CONTRACT_OF_CONTRACTS.md` - Registry de contratos
- `docs/MASTER_API_CONTRACTS.md` - Contratos de API Master
- `docs/ALQUIMIA_CANONICA_V1.md` - Contrato canónico de Alquimia
- `docs/CLEANING_PROJECTION_MODEL_V1.md` - Contrato de CPM
- `docs/UX_CONTRACT_V1.md` - Contrato de UX Actions
- `docs/REFRESH_CONTRACT_V1.md` - Contrato de Refresh Engine
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - View Authority

### Reglas Constitucionales

- `.cursor/rules/contratos.mdc` - Reglas constitucionales de contratos
- `.cursorrules` - Reglas operativas del proyecto

---

**Última actualización:** 2026-01-XX  
**Próxima revisión:** Después de completar Fase 1
