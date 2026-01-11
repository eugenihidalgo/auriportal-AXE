# FORENSICS GOD READINESS AUDIT v1
## Diagnóstico Total "GOD Readiness" (AuriPortal/Aurelín)

**Fecha de Auditoría**: 2026-01-11T13:30:33Z  
**Branch**: master  
**Commit**: 00656b305c538459be75e2c8e2f26de253b743ac  
**APP_VERSION**: 5.65.2  
**BUILD_ID**: unknown (se lee de process.env.BUILD_ID, fallback: 'unknown')  
**Node.js**: v20.19.6  
**PM2 Status**: aurelinportal online (v5.65.2, uptime: 7m, restarts: 342)

---

## OBJETIVO

Inventariar TODO el sistema actual y producir un reporte forense definitivo para:
- Aislar y retirar ADMIN legacy
- Aislar y retirar CLIENT legacy
- Consolidar MASTER canónico
- Diseñar el nuevo dominio GOD (alumno) reutilizando la misma estructura canónica (router, contratos, señales, identidad)

**MODO**: SOLO DIAGNÓSTICO. PROHIBIDO IMPLEMENTAR / MODIFICAR DATOS / MIGRAR / REFACTORIZAR.

---

## A) METADATA SNAPSHOT

### Estado del Repositorio
- **Branch**: master
- **Commits ahead**: 93 commits ahead of origin/master
- **Untracked files**: 
  - `docs/FORENSICS_PLATFORM_CONSISTENCY_AUDIT_V1.md`
  - `docs/REPORTE_FORENSE_ALQUIMIA_V1.md`

### Versión y Build
- **APP_VERSION**: 5.65.2 (desde package.json)
- **BUILD_ID**: Se lee de `process.env.BUILD_ID`, fallback: 'unknown' o `Date.now()`
- **Inyección en HTML**: `window.__AP_APP_VERSION__` y `window.__AP_BUILD_ID__`

### Runtime
- **PM2 Process**: aurelinportal (online, v5.65.2, PID: 3173847, uptime: 7m, restarts: 342)
- **Memoria**: 128.3mb
- **CPU**: 0%

---

## B) DB TRUTH AUDIT (POSTGRESQL)

### 1. Inventario de Tablas

**Total de tablas**: 223 tablas en schema `public`

**Tablas clave identificadas**:
- `alumnos` (17 registros)
- `students` (5 registros)
- `cleaning_events` (149 eventos, 17 estudiantes distintos)
- `cleaning_item_state` (503 estados, 16 estudiantes distintos)
- `student_item_state` (existe)
- `student_item_state_audit` (existe)
- `student_place_state` (existe)
- `student_project_state` (existe)
- `sponsor_student_links` (existe)
- `sponsors_catalog` (existe)
- `student_level_state` (existe)
- `student_level_history` (existe)
- `student_operational_state` (existe)
- `ute_executions` (existe)
- `ute_student_state` (existe)
- `pde_signal_emissions` (existe)

**Evidencia**: `docs/forensics/god_readiness_v1/db/tables.json`

### 2. Columnas de Identidad

**Total de columnas con identidad**: 85 columnas encontradas

**Columnas encontradas**:
- `student_id`: Presente en múltiples tablas
- `alumno_id`: Presente en tablas legacy
- `legacy_alumno_id`: Presente en tabla `students`

**Evidencia**: `docs/forensics/god_readiness_v1/db/identity_columns.json`

### 3. Foreign Keys

**Total de FKs**: 83 foreign keys encontradas

**FKs que referencian `alumnos(id)`**:
- `altares.alumno_id → alumnos.id`
- `altares_items.alumno_id → alumnos.id`
- `alumnos_apadrinados.alumno_id → alumnos.id`
- `alumnos_disponibilidad.alumno_id → alumnos.id`
- ... (múltiples tablas legacy)

**FKs que referencian `students(id)`**:
- Se requiere análisis más profundo (ver `fk_map.json`)

**Evidencia**: `docs/forensics/god_readiness_v1/db/fk_map.json`

### 4. Mapeo alumnos <-> students

**✅ CONFIRMADO**: Existe columna `students.legacy_alumno_id`

**Estadísticas**:
- `alumnos`: 17 registros
- `students`: 5 registros
- `students` con `legacy_alumno_id`: 5 (100%)
- `students` sin `legacy_alumno_id`: 0
- `alumnos` sin `students` mapeado: 12 (70.6%)
- `students` sin `alumnos` correspondiente: 0
- Duplicados: 0

**⚠️ RIESGO CRÍTICO**: 
- 12 alumnos (70.6%) NO tienen mapeo a `students`
- Esto indica que la migración de `alumnos` → `students` está incompleta
- Las FKs legacy apuntan a `alumnos.id`, no a `students.id`

**Evidencia**: `docs/forensics/god_readiness_v1/db/identity_mapping.json`

### 5. Estructura de Tablas Clave

**Tablas analizadas**: 16 tablas clave

**Estructura confirmada para**:
- `alumnos`, `students`
- `cleaning_events`, `cleaning_item_state`
- `student_item_state`, `student_item_state_audit`
- `student_place_state`, `student_project_state`
- `sponsor_student_links`, `sponsors_catalog`
- `student_level_state`, `student_level_history`
- `student_operational_state`
- `ute_executions`, `ute_student_state`
- `pde_signal_emissions`

**Evidencia**: `docs/forensics/god_readiness_v1/db/table_structures.json`

### 6. Contadores Básicos

**Tablas con datos**:
- `alumnos`: 17
- `students`: 5
- `cleaning_events`: 149
- `cleaning_item_state`: 503
- `audit_log`: 1220
- `assembly_check_results`: 525
- `automation_definitions`: 8
- ... (ver `counts.json` para lista completa)

**Evidencia**: `docs/forensics/god_readiness_v1/db/counts.json`

---

## C) ROUTERS + DOMINIOS + ENTRY GATES

### 1. MASTER (Canónico)

**Router**: `src/core/master/router/master-router-resolver.js`  
**Registry**: `src/core/master/registry/master-route-registry.js`

**Rutas totales**: 111
- **API**: 87 rutas
- **Island (UI)**: 24 rutas

**Características**:
- ✅ Registry canónico como Source of Truth
- ✅ Validación al arranque (fail-fast)
- ✅ Separación estricta API/Island
- ✅ Handlers explícitos en `MASTER_HANDLER_MAP`

**Evidencia**: `docs/forensics/god_readiness_v1/routes/master_routes.json`

### 2. ADMIN (Legacy Operativo)

**Router**: `src/core/admin/admin-router-resolver.js`  
**Registry**: `src/core/admin/admin-route-registry.js`

**Rutas totales**: 168
- **API**: 79 rutas
- **Island**: 36 rutas
- **Legacy**: 53 rutas (catch-all)

**Características**:
- ⚠️ Mezcla de registry canónico y legacy
- ⚠️ Catch-all para rutas no registradas
- ⚠️ Auditoría de handlers al arranque (warn mode)

**Evidencia**: `docs/forensics/god_readiness_v1/routes/admin_routes.json`

### 3. CLIENT (Legacy)

**Router**: `src/router.js` (legacy, sin registry canónico)

**Rutas principales**: 7
- `/` → `enterHandler`
- `/enter` → `enterHandler`
- `/onboarding-complete` → `onboardingCompleteHandler`
- `/typeform-webhook` → `typeformWebhookHandler`
- `/topics` → `topicListHandler`
- `/topic/:id` → `topicScreenHandler`
- `/aprender` → `aprenderHandler`

**Características**:
- ❌ NO tiene registry canónico
- ❌ NO tiene router resolver dedicado
- ❌ Manejo directo en `router.js`

**Evidencia**: `docs/forensics/god_readiness_v1/routes/client_routes.json`

### 4. Entry Gates / Inyección de Contexto

**Sistema de Contexto**: `src/core/entry-gate/entry-context-resolver.js`

**Contextos canónicos**:
- `STUDENT`: Portal del alumno (`pdeeugenihidalgo.org`)
- `MASTER`: Dominio canónico Master (`master.pdeeugenihidalgo.org`)
- `ADMIN_LEGACY`: Admin legacy operativo (`admin.pdeeugenihidalgo.org`)

**Entry Gates**:

1. **MASTER**:
   - Archivo: `public/js/master/inject_master.js`
   - Guard: `window.__AP_CONTEXT__ === 'MASTER'`
   - Descripción: Entry gate canónico para MASTER

2. **CLIENT**:
   - Archivo: `public/js/inject_main.js`
   - Guard: `window.__AP_CONTEXT__ !== 'MASTER'` (previene ejecución en MASTER)
   - Descripción: Entry gate legacy para CLIENT

3. **ADMIN**:
   - Archivo: N/A (no existe `inject_admin.js`)
   - Descripción: Admin usa `admin-panel-v4.js` directamente

**Inyección de Contexto**:
- Backend inyecta `window.__AP_CONTEXT__` en HTML antes de cargar scripts
- Entry gates verifican contexto antes de ejecutar
- ✅ Aislamiento constitucional: `inject_main.js` NO se ejecuta en MASTER

**Evidencia**: `docs/forensics/god_readiness_v1/routes/entry_gates_map.json`, `docs/forensics/god_readiness_v1/routes/entry_context.json`

### 5. Tabla: Dominios Reales Hoy

| Dominio | Estado | Rutas | Registry | Router | Entry Gate |
|---------|--------|-------|----------|--------|------------|
| **MASTER** | ✅ Canónico | 111 (87 API, 24 Island) | ✅ Canónico | ✅ Resolver dedicado | ✅ `inject_master.js` |
| **ADMIN** | ⚠️ Legacy Operativo | 168 (79 API, 36 Island, 53 Legacy) | ⚠️ Parcial | ✅ Resolver dedicado | ❌ Directo |
| **CLIENT** | ❌ Legacy | 7 (sin registry) | ❌ No existe | ❌ `router.js` legacy | ⚠️ `inject_main.js` (con guard) |
| **GOD** (propuesto) | 🔮 Diseño | - | - | - | - |

---

## D) SEÑALES — UNIFICACIÓN Y DIVERGENCIAS

### 1. Registry Canónico

**Archivo**: `src/core/student/signals/student-signal-registry.js`

**Total de señales registradas**: 45
- **Domain**: 41 señales
- **Observability**: 4 señales

**Categorías principales**:
- `student.*`: Señales del dominio Alumno
- `place.*`: Señales del dominio Lugares
- `project.*`: Señales del dominio Proyectos
- `sponsor.*`: Señales del dominio Apadrinados
- `student.level.*`: Señales de niveles (genéricas con backward compat)
- `student.pde.*`: Señales PDE (backward compat si `line_key === 'pde'`)

**Evidencia**: `docs/forensics/god_readiness_v1/signals/registry_keys.txt`, `docs/forensics/god_readiness_v1/signals/registry_summary.json`

### 2. Sistemas de Emisión (3 Sistemas)

#### Sistema 1: `emitStudentSignal` (Canónico para dominio Alumno)
- **Archivo**: `src/core/student/signals/student-signal-emitter.js`
- **Descripción**: Sistema canónico para señales del dominio Alumno
- **Uso**:
  - `src/core/student/domains/student-domain-integration-service.js`
  - `src/core/student/coherence/student-coherence-checker.js`
- **Características**: Valida contra registry, registra en `student_signal_audit`

#### Sistema 2: `dispatchSignal` (Dispatcher genérico)
- **Archivo**: `src/core/signals/signal-dispatcher.js`
- **Descripción**: Dispatcher genérico para señales
- **Uso extensivo**:
  - `src/core/master/services/level-engine-service.js`
  - `src/services/tags-sot-service.js`
  - `src/services/ute-core-service.js`
  - `src/endpoints/master-api-classifications.js`
  - `src/endpoints/master-api-tags.js`
  - `src/core/automations/automation-execution-service.js`
  - `src/core/master/services/sponsor-service.js`
  - `src/services/project-service.js`
  - `src/services/place-service.js`
- **Características**: Dispatcher centralizado, puede emitir señales no registradas

#### Sistema 3: `emitSignal` (PDE Signal Emitter)
- **Archivo**: `src/services/pde-signal-emitter.js`
- **Descripción**: Emisor PDE (wrapper sobre `dispatchSignal`)
- **Uso**:
  - `src/services/alquimia-general-service.js`
  - `src/core/master/services/cleaning-engine-service.js`
  - `src/core/packages/package-engine.js`
  - `src/endpoints/admin-signals-api.js`
- **Características**: Wrapper sobre `dispatchSignal`, registra en `pde_signal_emissions`

**Evidencia**: `docs/forensics/god_readiness_v1/signals/emissions_map.json`

### 3. Comparación: Registry vs Emisiones

**Análisis**:
- ✅ `emitStudentSignal`: Valida contra registry (fail-hard si no está registrada)
- ⚠️ `dispatchSignal`: NO valida contra registry (puede emitir señales no registradas)
- ⚠️ `emitSignal` (PDE): NO valida contra registry (wrapper sobre `dispatchSignal`)

**Riesgo**: Señales no registradas pueden emitirse vía `dispatchSignal` o `emitSignal`

**Evidencia**: Análisis de código (grep de llamadas)

### 4. Persistencia

**Tablas de persistencia**:
1. **`pde_signal_emissions`**: 
   - Tabla principal de emisiones de señales PDE
   - Usada por `pde-signal-emitter.js`

2. **`student_signal_audit`**:
   - Auditoría de señales del dominio Alumno
   - Usada por `student-signal-emitter.js`

**Evidencia**: `docs/forensics/god_readiness_v1/signals/persistence_map.json`

---

## E) CONTRATO HTTP / ENVELOPES / HEADERS

### 1. Dialectos HTTP Identificados

#### Master API
- **Envelope**: `jsonSuccess` / `jsonError` (helpers canónicos)
- **Headers**: 
  - `Content-Type: application/json`
  - `X-Trace-Id` (opcional)
- **Formato Success**: `{ success: true, data: {} }`
- **Formato Error**: `{ success: false, error: 'message' }`
- **Endpoints**: 21 archivos `master-api-*.js`

#### Admin API
- **Envelope**: `jsonSuccess` / `jsonError` (helpers canónicos)
- **Headers**: 
  - `Content-Type: application/json`
  - `X-Trace-Id` (opcional)
- **Formato Success**: `{ success: true, data: {} }`
- **Formato Error**: `{ success: false, error: 'message' }`
- **Endpoints**: 5 archivos `admin-api-*.js`

#### Client (Legacy)
- **Envelope**: HTML Response directo
- **Headers**: `Content-Type: text/html`
- **Formato**: HTML completo
- **Endpoints**: `enter.js` y otros handlers legacy

### 2. Helpers Canónicos

- **`jsonSuccess`**: `src/core/http/json-success.js`
- **`jsonError`**: `src/core/http/json-error.js`
- **`htmlResponse`**: `src/core/html-response.js`

**Evidencia**: `docs/forensics/god_readiness_v1/http/dialects.json`, `docs/forensics/god_readiness_v1/http/http_dialects_report.md`

---

## F) ATOMICIDAD / TRANSACCIONES

### Servicios Auditados

#### 1. Cleaning Engine Service
- **Path**: `src/core/master/services/cleaning-engine-service.js`
- **Operaciones críticas**: `markCleanStudent`, `markCleanAllStudents`, `setRemainingShared`
- **Pasos persistentes**: evento → proyección → sync `student_item_state`
- **Transacciones**: Requiere análisis de código (no confirmado)

#### 2. Place Service
- **Path**: `src/services/place-service.js`
- **Operaciones críticas**: `activate`, `deactivate`, `clean`, `cleanBulk`, `cleanAll`
- **Pasos persistentes**: evento → proyección state
- **Transacciones**: Requiere análisis de código (no confirmado)

#### 3. Project Service
- **Path**: `src/services/project-service.js`
- **Operaciones críticas**: `activate`, `deactivate`, `clean`, `cleanBulk`, `cleanAll`
- **Pasos persistentes**: evento → proyección state
- **Transacciones**: Requiere análisis de código (no confirmado)

#### 4. Sponsor Service
- **Path**: `src/core/master/services/sponsor-service.js`
- **Operaciones críticas**: `link`, `unlink`, `care`, `extendCare`, `endCare`
- **Pasos persistentes**: evento → proyección state
- **Transacciones**: Requiere análisis de código (no confirmado)

#### 5. Level Engine Service
- **Path**: `src/core/master/services/level-engine-service.js`
- **Operaciones críticas**: `recomputeLevel`, `recomputePhase`
- **Pasos persistentes**: cálculo → actualización state → emisión señal
- **Transacciones**: Requiere análisis de código (no confirmado)

#### 6. Student Domain Integration Service
- **Path**: `src/core/student/domains/student-domain-integration-service.js`
- **Operaciones críticas**: `activateItem`, `deactivateItem`, `cleanItem`, `updateMetadata`
- **Pasos persistentes**: evento → proyección → señal
- **Transacciones**: Requiere análisis de código (no confirmado)

**Nota**: Este es un análisis preliminar. Se requiere análisis de código para confirmar uso de `BEGIN`/`COMMIT`/`ROLLBACK` o helpers transaccionales.

**Evidencia**: `docs/forensics/god_readiness_v1/runtime/atomicity_map.json`, `docs/forensics/god_readiness_v1/runtime/atomicity_map.md`

---

## G) LEGACY ERADICATION MAP (ADMIN/CLIENT)

### 1. ADMIN Legacy

**Tablas que parecen admin-only**:
- `admin_favoritos` (1 registro)
- Tablas de configuración/admin (requiere análisis más profundo)

**Rutas `/admin` usadas en código**:
- 168 rutas registradas en `admin-route-registry.js`
- 79 rutas API
- 36 rutas Island
- 53 rutas Legacy (catch-all)

**Dependencias**:
- Admin usa `admin-router-resolver.js` (canónico)
- Admin tiene registry parcial (mejora sobre CLIENT)
- Admin NO tiene entry gate dedicado (usa `admin-panel-v4.js` directamente)

**Riesgos de retirada**:
- ⚠️ Funcionalidades operativas pueden depender de rutas legacy
- ⚠️ Tablas legacy pueden tener datos activos
- ⚠️ FKs legacy apuntan a `alumnos.id`, no a `students.id`

### 2. CLIENT Legacy

**Assets legacy**:
- `public/js/inject_main.js` (entry gate con guard para MASTER)
- Handlers en `src/endpoints/enter.js`, `topic-list.js`, `topic-screen.js`, etc.

**Pantallas legacy**:
- `/` (pantalla principal)
- `/enter` (autenticación)
- `/topics` (lista de temas)
- `/topic/:id` (pantalla de tema)
- `/aprender` (redirección)

**Dependencias**:
- ❌ NO tiene registry canónico
- ❌ NO tiene router resolver dedicado
- ❌ Manejo directo en `router.js` legacy

**Riesgos de retirada**:
- 🔴 CRÍTICO: Portal del alumno está en CLIENT legacy
- 🔴 CRÍTICO: Autenticación (`/enter`) está en CLIENT legacy
- 🔴 CRÍTICO: Flujo de onboarding está en CLIENT legacy

### 3. Checklist de Retirada (DISEÑO, NO EJECUTAR)

#### Fase 1: Preparación
- [ ] Migrar todos los `alumnos` a `students` (12 alumnos sin mapeo)
- [ ] Migrar todas las FKs de `alumnos.id` a `students.id`
- [ ] Crear registry canónico para CLIENT (o migrar a GOD)
- [ ] Auditar todas las rutas ADMIN legacy (53 rutas catch-all)

#### Fase 2: Migración CLIENT → GOD
- [ ] Diseñar dominio GOD (alumno) con estructura canónica
- [ ] Crear `god-router-resolver.js` (similar a master-router-resolver)
- [ ] Crear `god-route-registry.js` (similar a master-route-registry)
- [ ] Migrar handlers de CLIENT a GOD
- [ ] Crear entry gate `inject_god.js` (similar a inject_master.js)
- [ ] Migrar autenticación a GOD
- [ ] Migrar onboarding a GOD

#### Fase 3: Aislamiento ADMIN
- [ ] Identificar rutas ADMIN realmente usadas
- [ ] Migrar funcionalidades críticas a MASTER (si aplica)
- [ ] Deprecar rutas ADMIN no usadas
- [ ] Aislar tablas ADMIN legacy

#### Fase 4: Retirada
- [ ] Retirar `router.js` legacy
- [ ] Retirar handlers CLIENT legacy
- [ ] Retirar `inject_main.js` (reemplazado por `inject_god.js`)
- [ ] Retirar rutas ADMIN legacy no usadas
- [ ] Retirar tablas `alumnos` (si ya migrado a `students`)

**Evidencia**: `docs/forensics/god_readiness_v1/summary/legacy_retirement_plan_v0.md` (generar si necesario)

---

## H) RECOMENDACIONES DE CIERRE CONSTITUCIONAL

### 1. Consolidación MASTER

**Estado actual**: ✅ MASTER está canónico y bien estructurado
- Registry canónico
- Router resolver dedicado
- Entry gate dedicado
- Separación API/Island estricta

**Recomendación**: Mantener MASTER como está, usar como modelo para GOD

### 2. Diseño GOD (Alumno)

**Propuesta**: Reutilizar estructura canónica de MASTER

**Componentes necesarios**:
1. **Router**: `src/core/god/router/god-router-resolver.js`
   - Similar a `master-router-resolver.js`
   - Registry canónico como Source of Truth

2. **Registry**: `src/core/god/registry/god-route-registry.js`
   - Similar a `master-route-registry.js`
   - Rutas: `/god/*` (o `/alumno/*`)

3. **Entry Gate**: `public/js/god/inject_god.js`
   - Similar a `inject_master.js`
   - Guard: `window.__AP_CONTEXT__ === 'GOD'`

4. **Layout**: `src/core/god/layout/god-layout-v1.html`
   - Similar a `master-layout-v1.html`
   - Renderer: `god-page-renderer.js`

5. **Señales**: Reutilizar `student-signal-registry.js` (ya existe)

6. **Identidad**: Usar `students.id` como Source of Truth (NO `alumnos.id`)

### 3. Migración CLIENT → GOD

**Pasos**:
1. Crear estructura GOD (router, registry, layout, entry gate)
2. Migrar handlers de CLIENT a GOD
3. Migrar autenticación (`/enter`) a GOD
4. Migrar onboarding a GOD
5. Retirar `router.js` legacy
6. Retirar `inject_main.js`

### 4. Aislamiento ADMIN

**Pasos**:
1. Auditar rutas ADMIN legacy (53 rutas catch-all)
2. Identificar rutas realmente usadas
3. Migrar funcionalidades críticas a MASTER (si aplica)
4. Deprecar rutas no usadas
5. Aislar tablas ADMIN legacy

### 5. Migración alumnos → students

**Pasos**:
1. Migrar 12 alumnos sin mapeo a `students`
2. Migrar todas las FKs de `alumnos.id` a `students.id`
3. Retirar tabla `alumnos` (si ya migrado completamente)

---

## I) RULES FALTANTES (PROPUESTA, NO IMPLEMENTAR)

### Rules para GOD

1. **`god-is-canonical-domain`**: GOD es el dominio canónico del alumno (similar a `master-is-canonical-domain`)
2. **`god-render-contract`**: Contrato de renderizado GOD obligatorio (similar a `master-render-contract`)
3. **`god-router-single-entry`**: Entrada única al GOD Router (similar a `master-router-single-entry`)
4. **`ui-god-registry-sot`**: UI GOD Registry como Source of Truth absoluto
5. **`god-sidebar-dom-api-only`**: GOD Sidebar solo con DOM API
6. **`god-ui-factory-mandatory`**: UI GOD Factory v1 obligatorio
7. **`god-api-strict-resolution-v1`**: GOD API Strict Resolution v1

### Rules para Retirada Legacy

1. **`client-legacy-deprecated`**: CLIENT legacy está deprecado, migrar a GOD
2. **`admin-legacy-operational-only`**: ADMIN legacy es solo operativo, no añadir features
3. **`alumnos-table-deprecated`**: Tabla `alumnos` está deprecada, usar `students`
4. **`students-sovereign-identity`**: `students.id` es la identidad soberana del alumno

---

## J) ARCHIVOS DE EVIDENCIA

Todos los dumps y evidencia están en: `docs/forensics/god_readiness_v1/`

### Estructura de Evidencia

```
docs/forensics/god_readiness_v1/
├── db/
│   ├── tables.json (223 tablas)
│   ├── identity_columns.json (85 columnas)
│   ├── fk_map.json (83 FKs)
│   ├── table_structures.json (16 tablas clave)
│   ├── identity_mapping.json (mapeo alumnos/students)
│   └── counts.json (contadores básicos)
├── code/
│   └── (pendiente: entry_gates_map.md)
├── routes/
│   ├── master_routes.json (111 rutas)
│   ├── admin_routes.json (168 rutas)
│   ├── client_routes.json (7 rutas)
│   ├── entry_context.json (contextos canónicos)
│   └── entry_gates_map.json (entry gates)
├── signals/
│   ├── registry_keys.txt (45 señales)
│   ├── registry_summary.json (registry completo)
│   ├── emissions_map.json (3 sistemas)
│   └── persistence_map.json (2 tablas)
├── http/
│   ├── dialects.json (dialectos HTTP)
│   └── http_dialects_report.md (reporte)
├── runtime/
│   ├── atomicity_map.json (6 servicios)
│   └── atomicity_map.md (reporte)
└── summary/
    └── (pendiente: legacy_retirement_plan_v0.md)
```

---

## K) CONCLUSIÓN

### Estado Actual

1. **MASTER**: ✅ Canónico, bien estructurado, listo para usar como modelo
2. **ADMIN**: ⚠️ Legacy operativo, parcialmente canónico, requiere aislamiento
3. **CLIENT**: ❌ Legacy completo, sin registry, requiere migración a GOD
4. **Identidad**: ⚠️ Divergencia `alumnos`/`students`, 70.6% de alumnos sin mapeo

### Próximos Pasos (DISEÑO)

1. **Fase 1**: Migrar `alumnos` → `students` (12 alumnos sin mapeo)
2. **Fase 2**: Diseñar y crear estructura GOD (router, registry, layout, entry gate)
3. **Fase 3**: Migrar CLIENT → GOD (autenticación, onboarding, pantallas)
4. **Fase 4**: Aislar ADMIN legacy (auditar rutas, deprecar no usadas)
5. **Fase 5**: Retirar legacy (router.js, inject_main.js, tablas alumnos)

### Riesgos Identificados

1. 🔴 **CRÍTICO**: 12 alumnos (70.6%) sin mapeo a `students`
2. 🔴 **CRÍTICO**: Portal del alumno está en CLIENT legacy
3. ⚠️ **ALTO**: FKs legacy apuntan a `alumnos.id`, no a `students.id`
4. ⚠️ **MEDIO**: 53 rutas ADMIN legacy (catch-all) sin auditoría

### Recomendación Final

**Usar MASTER como modelo canónico para diseñar GOD**. La estructura de MASTER (router, registry, layout, entry gate) es sólida y puede replicarse para GOD con mínimas modificaciones.

---

**FIN DEL REPORTE**
