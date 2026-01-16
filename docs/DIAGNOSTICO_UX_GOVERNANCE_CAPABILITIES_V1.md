# DIAGNÓSTICO CANÓNICO — UX GOVERNANCE / CAPABILITIES v1

**Fecha**: 2024  
**Estado**: DIAGNÓSTICO (NO IMPLEMENTACIÓN)  
**Contexto**: Post-cierre UX Action Registry v1 como pieza constitucional

---

## 🎯 OBJETIVO DEL DIAGNÓSTICO

Realizar un diagnóstico exhaustivo del estado actual del sistema de gobernanza UX en AuriPortal, identificando:
- Qué está implementado
- Qué está implícito
- Qué es canónico
- Qué es legacy tolerado
- Qué falta realmente (si falta algo)

**PROHIBIDO EN ESTE TURNO**: Implementar código, refactorizar, crear nuevos registries, "arreglar" nada, hacer propuestas de features nuevas.

---

## FASE 1 — INVENTARIO DE REGISTRIES EXISTENTES

### 1.1 Registries Explícitos (Canónicos)

#### A) UX Action Registry v1 (CANÓNICO)
- **Archivos**:
  - `src/core/ux/ux-action-registry.v1.js` (core backend)
  - `src/core/ux/action-registry/ux-action-registry.js` (core con validación dura)
  - `public/js/core/ux/ux-action-registry.v1.js` (frontend)
- **Propósito**: Registry canónico de acciones UX con contratos formales. ÚNICA puerta de intención de usuario.
- **Estado**: ✅ CANÓNICO
- **Características**:
  - Registro de acciones con `action_id`, `domain`, `description`
  - Validación dura: `allowed_item_kinds`, `allowed_layers`, `allowed_scopes`
  - Handler con `endpointBuilder` y `buildPayload`
  - `refresh_plan` declarativo (función o array de `surface_ids`)
  - Telemetría configurable
- **Dominios soportados**: `master`, `god`, `admin_legacy`
- **Validación**: Assembly check obligatorio (`npm run check:ux-action-registry`)

#### B) Refresh Surface Registry v1 (CANÓNICO)
- **Archivos**:
  - `src/core/ux/refresh-surface-registry.v1.js` (core backend)
  - `public/js/core/ux/refresh-surface-registry.v1.js` (frontend)
- **Propósito**: Registry canónico de superficies de refresh con adapters.
- **Estado**: ✅ CANÓNICO
- **Características**:
  - Registro de superficies con `surface_id`, `buildKey`, `refetch`, `forensicsLabel`
  - Refetch canónico delegado a funciones existentes
  - Logs forenses estructurados
- **Integración**: Usado por Refresh Engine v2 para ejecutar refresh declarativo

#### C) Master Route Registry (CANÓNICO)
- **Archivo**: `src/core/master/registry/master-route-registry.js`
- **Propósito**: Registry canónico de rutas del dominio MASTER (fuente de verdad única).
- **Estado**: ✅ CANÓNICO
- **Características**:
  - Rutas API (`type: 'api'`) y Islands (`type: 'island'`)
  - Validación al arrancar servidor (fail-fast)
  - PROHIBIDO reutilizar rutas Admin o handlers Admin
- **Integración**: Usado por `master-router-resolver.js`

#### D) Admin Route Registry (CANÓNICO)
- **Archivo**: `src/core/admin/admin-route-registry.js`
- **Propósito**: Registry canónico de rutas del dominio ADMIN (legacy).
- **Estado**: ✅ CANÓNICO (pero dominio legacy)
- **Nota**: Dominio legacy, no aplica Action Registry aún según reglas constitucionales

#### E) God Route Registry (CANÓNICO)
- **Archivo**: `src/core/god/registry/god-route-registry.js`
- **Propósito**: Registry canónico de rutas del dominio GOD.
- **Estado**: ✅ CANÓNICO
- **Integración**: Usado por `god-router-resolver.js`

#### F) Student Capability Registry (CANÓNICO)
- **Archivo**: `src/core/student/capabilities/student-capability-registry.js`
- **Propósito**: Registry canónico de capabilities permitidas del sistema (versión formal y versionada).
- **Estado**: ✅ CANÓNICO
- **Características**:
  - Definiciones con `key`, `description`, `default`, `version`, `deprecated`, `category`
  - Categorías: `progress`, `automation`, `context`, `access`, `write`, `admin`
  - Funciones: `getCapabilityDefinition()`, `listActiveCapabilities()`, `isValidCapability()`
- **Capabilities registradas**:
  - `can_progress`, `can_compute_level`, `can_update_streaks`
  - `can_trigger_automations`
  - `can_activate_contexts`, `can_run_resolvers`
  - `can_access_student_portal`, `can_receive_notifications`
  - `can_write_domain_state`, `can_master_override`
  - `can_clean_domain_items`, `can_activate_project`, `can_edit_project_metadata`

#### G) Student Signal Registry (CANÓNICO)
- **Archivo**: `src/core/student/signals/student-signal-registry.js`
- **Propósito**: Registry canónico de señales del sistema (eventos de cambio).
- **Estado**: ✅ CANÓNICO
- **Integración**: Usado por Level Engine y automatizaciones

### 1.2 Registries Implícitos (No Explícitos como Registry)

#### A) Entry Context Resolver (IMPLÍCITO)
- **Archivo**: `src/core/entry-gate/entry-context-resolver.js`
- **Propósito**: Resuelve contexto de entrada (`MASTER`, `GOD`, `ADMIN_LEGACY`, `STUDENT`).
- **Estado**: ⚠️ IMPLÍCITO (no es registry formal, pero actúa como decisor)
- **Funciones**: `resolveEntryContext()`, `isMasterContext()`, `isGodContext()`, etc.
- **Nota**: No es un registry explícito, pero actúa como fuente de verdad para contexto de dominio

#### B) Feature Flag Registry (IMPLÍCITO)
- **Archivo**: `src/core/feature-flags/feature-flag-registry.js`
- **Propósito**: Registry de feature flags del sistema.
- **Estado**: ⚠️ IMPLÍCITO (existe pero no se usa para gobernanza UX)

#### C) Theme Capability Registry (IMPLÍCITO)
- **Archivos**:
  - `src/core/theme/theme-capability-registry.js`
  - `src/core/theme/theme-capability-registry-v2.js`
- **Propósito**: Registry de capabilities de temas.
- **Estado**: ⚠️ IMPLÍCITO (no relacionado con gobernanza UX de acciones)

### 1.3 Registries Legacy o Mixtos

#### A) Admin Sidebar Registry (LEGACY)
- **Archivo**: `src/core/admin/sidebar-registry.js`
- **Propósito**: Registry de items del sidebar ADMIN.
- **Estado**: ⚠️ LEGACY (dominio legacy, no aplica Action Registry)

#### B) Master Sidebar Registry (CANÓNICO)
- **Archivo**: `src/core/master/registry/master-sidebar-registry.js`
- **Propósito**: Registry canónico de items del sidebar MASTER.
- **Estado**: ✅ CANÓNICO (pero no relacionado con gobernanza UX de acciones)

---

## FASE 2 — DIAGNÓSTICO DE CAPABILITIES ACTUALES

### 2.1 Capabilities Explícitas (Registradas)

#### A) Student Capability Registry
- **Ubicación**: `src/core/student/capabilities/student-capability-registry.js`
- **Estado**: ✅ CANÓNICO
- **Capabilities registradas**: 15 capabilities activas
- **Categorías**:
  - `progress`: `can_progress`, `can_compute_level`, `can_update_streaks`
  - `automation`: `can_trigger_automations`
  - `context`: `can_activate_contexts`, `can_run_resolvers`
  - `access`: `can_access_student_portal`, `can_receive_notifications`
  - `write`: `can_write_domain_state`, `can_clean_domain_items`, `can_activate_project`, `can_edit_project_metadata`
  - `admin`: `can_master_override`
- **Validación**: `isValidCapability()` verifica existencia y estado activo
- **Uso actual**: No se verifica explícitamente en `performAction()` ni en handlers MASTER

### 2.2 Capabilities Implícitas (No Registradas)

#### A) Validación de `allowed_item_kinds` (IMPLÍCITA en Action Registry)
- **Ubicación**: Validación en `ux-action-registry.js` y `perform-action.v1.js`
- **Estado**: ⚠️ IMPLÍCITA (parte del schema de acción, no capability explícita)
- **Valores**: `['recurrente', 'una_vez']` o `null`
- **Validación**: `performAction()` valida que `payload.item_kind` esté en `allowed_item_kinds`
- **Problema**: No es una capability explícita, es parte del schema de validación de acción

#### B) Validación de `allowed_layers` (IMPLÍCITA en Action Registry)
- **Ubicación**: Validación en `ux-action-registry.js` y `perform-action.v1.js`
- **Estado**: ⚠️ IMPLÍCITA (parte del schema de acción, no capability explícita)
- **Valores**: `['shared', 'pde']` o `null`
- **Validación**: `performAction()` valida que `payload.clean_layer` esté en `allowed_layers`
- **Problema**: No es una capability explícita, es parte del schema de validación de acción

#### C) Validación de `allowed_scopes` (IMPLÍCITA en Action Registry)
- **Ubicación**: Validación en `ux-action-registry.js` y `perform-action.v1.js`
- **Estado**: ⚠️ IMPLÍCITA (parte del schema de acción, no capability explícita)
- **Valores**: `['item', 'student', 'all']` o `null`
- **Validación**: `performAction()` valida que `payload.scope` esté en `allowed_scopes`
- **Problema**: No es una capability explícita, es parte del schema de validación de acción

#### D) Validación de Dominio (IMPLÍCITA en Entry Context)
- **Ubicación**: `entry-context-resolver.js` y validación en `perform-action.v1.js`
- **Estado**: ⚠️ IMPLÍCITA (resuelta por contexto de entrada, no capability explícita)
- **Valores**: `MASTER`, `GOD`, `ADMIN_LEGACY`, `STUDENT`
- **Validación**: `performAction()` verifica que `actionDef.domain` coincida con contexto
- **Problema**: No es una capability explícita, es parte del contexto de dominio

### 2.3 Capabilities Dispersas (Sin Centralización)

#### A) Validación de Acceso Admin (DISPERSO)
- **Ubicación**: `src/endpoints/admin-panel.js` → `verificarAccesoAdmin()`
- **Estado**: ⚠️ DISPERSO (validación ad-hoc, no capability explícita)
- **Validación**: IP autorizada o password correcto
- **Problema**: No está en ningún registry de capabilities, es validación ad-hoc

#### B) Validación de Acceso Kajabi (DISPERSO)
- **Ubicación**: Múltiples lugares (`enter.js`, `kajabi-sync-sql.js`, etc.)
- **Estado**: ⚠️ DISPERSO (validación ad-hoc, no capability explícita)
- **Validación**: Verifica que tenga compra de "Mundo de Luz"
- **Problema**: No está en ningún registry de capabilities, es validación ad-hoc

### 2.4 Duplicación de Validaciones

#### A) Validación de `item_kind` (DUPLICADA)
- **Ubicación 1**: `ux-action-registry.js` → validación en `registerAction()`
- **Ubicación 2**: `perform-action.v1.js` → validación en runtime
- **Ubicación 3**: `alquimia-actions.js` → validación en `buildCleanPayload()`
- **Estado**: ⚠️ DUPLICADA (validación en múltiples capas)
- **Problema**: Misma validación en registro, runtime y construcción de payload

#### B) Validación de `clean_layer` (DUPLICADA)
- **Ubicación 1**: `ux-action-registry.js` → validación en `registerAction()`
- **Ubicación 2**: `perform-action.v1.js` → validación en runtime
- **Ubicación 3**: `alquimia-actions.js` → validación en `buildCleanPayload()`
- **Estado**: ⚠️ DUPLICADA (validación en múltiples capas)
- **Problema**: Misma validación en registro, runtime y construcción de payload

### 2.5 Incoherencias Detectadas

#### A) Student Capability Registry No Se Usa en performAction()
- **Problema**: `performAction()` NO valida capabilities del `Student Capability Registry`
- **Evidencia**: `perform-action.v1.js` no importa ni usa `student-capability-registry.js`
- **Impacto**: Las capabilities registradas no se validan en runtime de acciones UX
- **Estado**: ⚠️ INCOHERENCIA (registry existe pero no se usa)

#### B) Validación de Dominio No Es Capability Explícita
- **Problema**: La validación de dominio (`master`, `god`, `admin_legacy`) no es una capability explícita
- **Evidencia**: Se valida en `performAction()` pero no está en ningún registry de capabilities
- **Impacto**: No hay forma declarativa de definir "quién puede ejecutar acciones en qué dominio"
- **Estado**: ⚠️ INCOHERENCIA (validación implícita, no explícita)

---

## FASE 3 — GOBERNANZA UX ACTUAL

### 3.1 Flujo Canónico de Acción (UI → Dominio)

```
1. UI declara intención
   └─> performAction({ action_id, payload, context, uiState })
       │
2. performAction() resuelve actionDef
   └─> window.__AP_UX_ACTION_REGISTRY_CORE__.get(action_id)
       │
3. Validación dura de acción
   └─> Si no existe → ERROR HARD
       │
4. Validación de payload (schema)
   └─> validateActionPayload(action, payload, context)
       │
       ├─> allowed_item_kinds: payload.item_kind debe estar en allowed_item_kinds
       ├─> allowed_layers: payload.clean_layer debe estar en allowed_layers
       └─> allowed_scopes: payload.scope debe estar en allowed_scopes
       │
5. Construcción de endpoint y payload
   └─> endpoint = actionDef.handler.endpointBuilder(context)
   └─> finalPayload = actionDef.handler.buildPayload(uiState, context)
       │
6. Ejecución de fetch
   └─> fetch(endpoint, { method, headers, body: JSON.stringify(finalPayload) })
       │
7. Verificación de respuesta
   └─> Si !response.ok → ERROR
   └─> Si !responseData.ok → ERROR
       │
8. Ejecución de refresh plan
   └─> refreshEngine.afterMutationV2() o afterMutation()
       │
       └─> Resolver refresh_plan (función o array)
           │
           └─> refetchSurface(surface_id, context, uiState)
               │
               └─> Refresh Surface Registry → refetch()
                   │
                   └─> Re-renderizar UI
```

### 3.2 Puntos de Validación

#### A) Validación de Acción (Hard Fail)
- **Ubicación**: `perform-action.v1.js` línea 56-73
- **Tipo**: Validación dura (error explícito si acción no existe)
- **Estado**: ✅ FUNCIONANDO

#### B) Validación de Schema (Hard Fail)
- **Ubicación**: `ux-action-schema.js` (importado en `ux-action-registry.js`)
- **Tipo**: Validación dura de `allowed_item_kinds`, `allowed_layers`, `allowed_scopes`
- **Estado**: ✅ FUNCIONANDO (pero no se usa explícitamente en `perform-action.v1.js`)

#### C) Validación de Dominio (Implícita)
- **Ubicación**: `perform-action.v1.js` (no explícita, pero `actionDef.domain` debe coincidir)
- **Tipo**: Validación implícita (no hay check explícito de dominio en `performAction()`)
- **Estado**: ⚠️ IMPLÍCITA (no hay validación dura de dominio en runtime)

#### D) Validación de Capabilities (NO EXISTE)
- **Ubicación**: NO EXISTE
- **Tipo**: NO SE VALIDA
- **Estado**: ❌ NO IMPLEMENTADO (Student Capability Registry no se usa en `performAction()`)

### 3.3 Puntos de Bloqueo

#### A) Bloqueo por Acción No Registrada
- **Ubicación**: `perform-action.v1.js` línea 71
- **Tipo**: ERROR HARD
- **Estado**: ✅ FUNCIONANDO

#### B) Bloqueo por Schema Inválido
- **Ubicación**: `ux-action-schema.js` (pero no se llama explícitamente en `perform-action.v1.js`)
- **Tipo**: ERROR HARD (pero no se ejecuta en runtime actual)
- **Estado**: ⚠️ NO SE EJECUTA (validación existe pero no se usa en `performAction()`)

#### C) Bloqueo por Dominio Incorrecto
- **Ubicación**: NO EXISTE
- **Tipo**: NO SE BLOQUEA
- **Estado**: ❌ NO IMPLEMENTADO (no hay validación de dominio en `performAction()`)

#### D) Bloqueo por Capability Faltante
- **Ubicación**: NO EXISTE
- **Tipo**: NO SE BLOQUEA
- **Estado**: ❌ NO IMPLEMENTADO (Student Capability Registry no se usa)

### 3.4 Puntos de Refresh

#### A) Refresh Plan Declarativo
- **Ubicación**: `actionDef.refresh` o `actionDef.refresh_plan`
- **Tipo**: Función o array de `surface_ids`
- **Estado**: ✅ FUNCIONANDO

#### B) Refresh Engine v2
- **Ubicación**: `window.MasterRefreshEngineV1.afterMutationV2()`
- **Tipo**: Ejecuta refresh plan vía Refresh Surface Registry
- **Estado**: ✅ FUNCIONANDO

#### C) Refresh Surface Registry
- **Ubicación**: `refresh-surface-registry.v1.js`
- **Tipo**: Registry canónico de superficies con adapters
- **Estado**: ✅ FUNCIONANDO

### 3.5 Confirmación: UX Action Registry como Núcleo

#### ✅ CONFIRMADO: UX Action Registry es el Núcleo de Wiring
- **Evidencia**: `performAction()` es la ÚNICA forma válida de ejecutar mutaciones UI
- **Evidencia**: Assembly check (`check-ux-action-registry.js`) bloquea `fetch()` directo
- **Evidencia**: Contrato constitucional documentado en `UX_ACTION_REGISTRY_CONTRACT_V1.md`
- **Estado**: ✅ CANÓNICO

#### ⚠️ BYPASSES TOLERADOS (Legacy)
- **Evidencia**: 3 archivos con `[LEGACY_REFRESH_CALL]`:
  - `master-alquimia-general-client.js` (líneas 1874, 1922)
  - `master-alquimia-alumno-client.js` (línea 1109)
- **Estado**: ⚠️ LEGACY TOLERADO (marcado explícitamente, aceptable temporalmente)
- **Razón**: Acciones de creación/eliminación fuera del scope actual de Action Registry

#### ⚠️ PUNTOS DÉBILES DETECTADOS

1. **Validación de Schema No Se Ejecuta en Runtime**
   - **Problema**: `validateActionPayload()` existe pero no se llama en `perform-action.v1.js`
   - **Impacto**: Validación de `allowed_item_kinds`, `allowed_layers`, `allowed_scopes` no se ejecuta
   - **Estado**: ⚠️ PUNTO DÉBIL

2. **Validación de Dominio No Existe**
   - **Problema**: No hay validación explícita de que `actionDef.domain` coincida con contexto actual
   - **Impacto**: Acciones de dominio incorrecto podrían ejecutarse
   - **Estado**: ⚠️ PUNTO DÉBIL

3. **Student Capability Registry No Se Usa**
   - **Problema**: Registry existe pero no se valida en `performAction()`
   - **Impacto**: Capabilities registradas no se aplican en runtime
   - **Estado**: ⚠️ PUNTO DÉBIL

---

## FASE 4 — LEGACY Y TOLERANCIAS

### 4.1 Acciones Legacy Aún Permitidas

#### A) `handleCrearLista` (LEGACY)
- **Archivo**: `public/js/master/master-alquimia-general-client.js` línea 1874
- **Marcador**: `[LEGACY_REFRESH_CALL]`
- **Razón**: Acción de creación, fuera del scope actual de Action Registry
- **Estado**: ⚠️ LEGACY TOLERADO (marcado explícitamente)
- **Migración futura**: Cuando se registre acción de creación en Action Registry

#### B) `handleCrearItem` (LEGACY)
- **Archivo**: `public/js/master/master-alquimia-general-client.js` línea 1922
- **Marcador**: `[LEGACY_REFRESH_CALL]`
- **Razón**: Acción de creación, fuera del scope actual de Action Registry
- **Estado**: ⚠️ LEGACY TOLERADO (marcado explícitamente)
- **Migración futura**: Cuando se registre acción de creación en Action Registry

#### C) `handleCleanItem` (LEGACY)
- **Archivo**: `public/js/master/master-alquimia-alumno-client.js` línea 1109
- **Marcador**: `[LEGACY_REFRESH_CALL]`
- **Razón**: Acción de limpieza, debe migrarse a `performAction("alquimia.clean")`
- **Estado**: ⚠️ LEGACY TOLERADO (marcado explícitamente)
- **Migración futura**: Usar `performAction({ action_id: 'alquimia.clean', scope: 'student' })`

### 4.2 Checks Legacy

#### A) Validación de Schema No Se Ejecuta
- **Ubicación**: `ux-action-schema.js` existe pero no se usa en `perform-action.v1.js`
- **Estado**: ⚠️ DEUDA TÉCNICA (validación existe pero no se ejecuta)
- **Impacto**: Validación de `allowed_item_kinds`, `allowed_layers`, `allowed_scopes` no funciona

#### B) Validación de Dominio No Existe
- **Ubicación**: NO EXISTE
- **Estado**: ⚠️ DEUDA TÉCNICA (validación necesaria pero no implementada)
- **Impacto**: Acciones de dominio incorrecto podrían ejecutarse

### 4.3 Bypasses Tolerados Temporalmente

#### A) `[LEGACY_REFRESH_CALL]` (BYPASS EXPLÍCITO)
- **Ubicación**: 3 archivos marcados
- **Estado**: ✅ ACEPTABLE TEMPORALMENTE (marcado explícitamente, assembly check lo detecta como WARNING)
- **Regla**: Legacy NO puede crecer, solo decrecer

#### B) Validación de Schema No Se Ejecuta (BYPASS IMPLÍCITO)
- **Ubicación**: `perform-action.v1.js` no llama `validateActionPayload()`
- **Estado**: ⚠️ DEUDA TÉCNICA (bypass implícito, no marcado)
- **Impacto**: Validación existe pero no se aplica

### 4.4 Violaciones Constitucionales Pendientes

#### A) Student Capability Registry No Se Usa
- **Problema**: Registry existe pero no se valida en `performAction()`
- **Estado**: ⚠️ VIOLACIÓN CONSTITUCIONAL PENDIENTE (registry existe pero no se aplica)
- **Impacto**: Capabilities registradas no se validan en runtime

#### B) Validación de Dominio No Existe
- **Problema**: No hay validación explícita de dominio en `performAction()`
- **Estado**: ⚠️ VIOLACIÓN CONSTITUCIONAL PENDIENTE (validación necesaria pero no implementada)
- **Impacto**: Acciones de dominio incorrecto podrían ejecutarse

---

## FASE 5 — CONCLUSIÓN (SIN IMPLEMENTAR)

### 5.1 ¿Es Necesario un Capability Registry Explícito?

#### ✅ CONCLUSIÓN: SÍ, PERO PARCIALMENTE YA EXISTE

**Evidencia**:
1. **Student Capability Registry YA EXISTE** (`student-capability-registry.js`)
   - 15 capabilities registradas
   - Categorías: `progress`, `automation`, `context`, `access`, `write`, `admin`
   - Funciones de validación: `isValidCapability()`, `getCapabilityDefinition()`

2. **PERO NO SE USA EN `performAction()`**
   - Registry existe pero no se valida en runtime
   - No hay integración entre Action Registry y Capability Registry

3. **VALIDACIONES IMPLÍCITAS EN ACTION REGISTRY**
   - `allowed_item_kinds`, `allowed_layers`, `allowed_scopes` son validaciones de schema
   - No son capabilities explícitas, son restricciones de acción

**Conclusión**: El sistema actual **YA TIENE** un Capability Registry (Student Capability Registry), pero **NO SE USA** en el flujo de gobernanza UX. Las validaciones actuales (`allowed_item_kinds`, `allowed_layers`, `allowed_scopes`) son **validaciones de schema**, no capabilities explícitas.

### 5.2 ¿El Sistema Actual Ya Lo Cubre Parcialmente?

#### ✅ SÍ, PERO CON GAPS SIGNIFICATIVOS

**Lo que SÍ cubre**:
1. ✅ **UX Action Registry** como núcleo de wiring (canónico)
2. ✅ **Refresh Surface Registry** para refresh declarativo (canónico)
3. ✅ **Student Capability Registry** como registry explícito (existe pero no se usa)
4. ✅ **Validación de schema** (`allowed_item_kinds`, `allowed_layers`, `allowed_scopes`) en registro
5. ✅ **Assembly check** que bloquea violaciones constitucionales

**Lo que NO cubre**:
1. ❌ **Validación de capabilities en runtime** (Student Capability Registry no se usa)
2. ❌ **Validación de dominio en runtime** (no existe validación explícita)
3. ❌ **Validación de schema en runtime** (`validateActionPayload()` existe pero no se ejecuta)
4. ❌ **Integración entre Action Registry y Capability Registry** (no hay conexión)

**Gaps detectados**:
- **Gap 1**: Student Capability Registry existe pero no se valida en `performAction()`
- **Gap 2**: Validación de dominio no existe (no hay check explícito)
- **Gap 3**: Validación de schema no se ejecuta en runtime (existe pero no se usa)
- **Gap 4**: No hay forma declarativa de definir "quién puede ejecutar qué acción en qué dominio"

### 5.3 Siguiente Paso LÓGICO (Solo Diseño, No Implementación)

#### OPCIÓN A: Integrar Student Capability Registry en performAction() (RECOMENDADO)

**Diseño**:
1. **Añadir validación de capabilities en `performAction()`**
   - Antes de ejecutar fetch, validar que el estudiante tenga las capabilities necesarias
   - Usar `Student Capability Registry` para obtener definiciones
   - Validar contra contexto del estudiante (si está disponible)

2. **Añadir campo `required_capabilities` en Action Registry**
   - Cada acción puede declarar qué capabilities requiere
   - Ejemplo: `required_capabilities: ['can_write_domain_state', 'can_clean_domain_items']`

3. **Validación en runtime**
   - `performAction()` valida capabilities antes de ejecutar acción
   - Si falta capability → ERROR HARD con mensaje explícito

**Ventajas**:
- Reutiliza Student Capability Registry existente
- Añade validación de capabilities sin crear nuevo registry
- Integra capabilities en flujo de gobernanza UX

**Desventajas**:
- Requiere definir `required_capabilities` para cada acción
- Requiere contexto de estudiante en `performAction()` (puede no estar disponible)

#### OPCIÓN B: Crear Capability Registry Explícito para Acciones (ALTERNATIVA)

**Diseño**:
1. **Crear `Action Capability Registry`**
   - Registry explícito que mapea `action_id` → capabilities requeridas
   - Separado de Student Capability Registry (diferente propósito)

2. **Validación en runtime**
   - `performAction()` consulta Action Capability Registry
   - Valida contra Student Capability Registry
   - Si falta capability → ERROR HARD

**Ventajas**:
- Separación clara de responsabilidades
- Registry específico para acciones UX

**Desventajas**:
- Duplica información (capabilities ya están en Student Capability Registry)
- Requiere mantener dos registries sincronizados

#### OPCIÓN C: Añadir Validación de Dominio y Schema en Runtime (MÍNIMO)

**Diseño**:
1. **Añadir validación de dominio en `performAction()`**
   - Verificar que `actionDef.domain` coincida con contexto actual
   - Si no coincide → ERROR HARD

2. **Ejecutar validación de schema en runtime**
   - Llamar `validateActionPayload()` en `performAction()`
   - Validar `allowed_item_kinds`, `allowed_layers`, `allowed_scopes`

**Ventajas**:
- Cierra gaps detectados sin crear nuevos registries
- Reutiliza validaciones existentes

**Desventajas**:
- No integra capabilities (solo valida schema y dominio)

### 5.4 Recomendación Final

#### RECOMENDACIÓN: OPCIÓN A (Integrar Student Capability Registry)

**Razones**:
1. **Reutiliza infraestructura existente** (Student Capability Registry ya existe)
2. **Cierra gaps sin crear nuevos registries** (integra capabilities en flujo actual)
3. **Mantiene coherencia** (capabilities ya están registradas, solo falta usarlas)
4. **Escalable** (permite añadir más capabilities sin cambiar arquitectura)

**Pasos de diseño** (NO implementación):
1. Definir schema de `required_capabilities` en Action Registry
2. Diseñar validación de capabilities en `performAction()`
3. Diseñar integración con contexto de estudiante (si está disponible)
4. Diseñar fallback si contexto no está disponible (¿permitir o bloquear?)

**Próximo paso lógico**: Diseñar integración de Student Capability Registry en `performAction()` sin implementar código.

---

## RESUMEN EJECUTIVO

### ✅ Lo que ESTÁ implementado (Canónico)
- UX Action Registry v1 (núcleo de wiring)
- Refresh Surface Registry v1 (refresh declarativo)
- Student Capability Registry (existe pero no se usa)
- Master/Admin/God Route Registries (rutas canónicas)
- Assembly check (`check-ux-action-registry.js`)

### ⚠️ Lo que ESTÁ implícito (No explícito)
- Validación de schema (`allowed_item_kinds`, `allowed_layers`, `allowed_scopes`) existe pero no se ejecuta en runtime
- Validación de dominio no existe (no hay check explícito)
- Entry Context Resolver (no es registry formal pero actúa como decisor)

### ⚠️ Lo que ES legacy tolerado
- 3 archivos con `[LEGACY_REFRESH_CALL]` (marcados explícitamente)
- Validación de schema no se ejecuta (deuda técnica)

### ❌ Lo que FALTA realmente
- Integración de Student Capability Registry en `performAction()`
- Validación de dominio en runtime
- Ejecución de validación de schema en runtime

### 🎯 Conclusión
El sistema **YA TIENE** un Capability Registry (Student Capability Registry), pero **NO SE USA** en el flujo de gobernanza UX. Las validaciones actuales son **validaciones de schema**, no capabilities explícitas. El siguiente paso lógico es **integrar Student Capability Registry en `performAction()`** sin crear nuevos registries.

---

**FIN DEL DIAGNÓSTICO**
