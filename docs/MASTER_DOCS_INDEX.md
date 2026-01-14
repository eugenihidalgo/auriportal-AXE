# 📚 ÍNDICE CANÓNICO DE DOCUMENTACIÓN MASTER / ALQUIMIA / LUGARES / CLASIFICACIÓN

**Fecha de creación:** 2026-01-05  
**Modo:** READ-ONLY (inventario forense)  
**Alcance:** Dominio MASTER, Alquimia General, Lugares, Clasificaciones/Tags

---

## 📋 RESUMEN EJECUTIVO

**Total de documentos encontrados:** 223 archivos `.md` en `/docs`  
**Documentos relevantes catalogados:** ~50 documentos específicos de MASTER/Alquimia/Lugares/Clasificación

### Categorías Principales

- ✅ **MASTER Layout/System:** 15+ documentos
- ✅ **Alquimia General:** 5+ documentos
- ✅ **Lugares:** 3+ documentos
- ✅ **Proyectos:** 3 documentos (sistema completo + forensics + diagnóstico histórico)
- ✅ **Clasificaciones/Tags:** 6+ documentos
- ✅ **Diagnósticos recientes:** 2 documentos principales

---

## 🏗️ SECCIÓN 1: MASTER - LAYOUT, ROUTING, ASSETS

### 1.1 Layout y Renderizado

#### `docs/MASTER_LAYOUT_V1.md`
- **Tipo:** Contrato canónico
- **Contenido:**
  - Sistema completo de renderizado MASTER
  - `renderMasterPage()` como único punto de render
  - Template `master-layout-v1.html`
  - Invariantes obligatorios (dominio, render, router, sidebar, scripts)
  - Prohibiciones absolutas (HTML en JS, innerHTML, reutilizar Admin)
- **Referencias:** `src/core/master/layout/master-page-renderer.js`, `master-layout-v1.html`

#### `docs/MASTER_LAYOUT_V1_VERIFICACION.md`
- **Tipo:** Verificación/Auditoría
- **Contenido:** Checklist de verificación del layout v1

#### `docs/AUDITORIA_MASTER_LAYOUT_V1.md`
- **Tipo:** Auditoría
- **Contenido:** Auditoría completa del sistema de layout MASTER

### 1.2 Routing y Resolución

#### `docs/MASTER_API_CONTRACTS.md`
- **Tipo:** Contrato constitucional
- **Contenido:**
  - Regla MASTER-API-001: Separación absoluta API/Island
  - Registro obligatorio en `master-route-registry.js`
  - Mapeo en `MASTER_HANDLER_MAP`
  - Guards constitucionales en resolver
  - Errores que se producen si se viola
- **Referencias:** `src/core/master/registry/master-route-registry.js`, `src/core/master/router/master-router-resolver.js`

#### `docs/MASTER_API_STRICT_RESOLUTION_V1.md`
- **Tipo:** Contrato de resolución estricta
- **Contenido:** Blindaje absoluto de rutas `/master/api/**`

### 1.3 Assets y Scripts

#### `docs/ASSETS_SYSTEM_V1.md`
- **Tipo:** Sistema canónico
- **Estado:** ✅ CERRADO Y CANÓNICO v1
- **Contenido:**
  - Sistema de assets gobernado por contrato
  - Entry gate único (`inject_master.js`)
  - Loader canónico (`master-script-loader.js`)
  - Preflight validation (anti-fantasma)
  - Asset Runtime Registry (`window.__AP_ASSETS__`)
  - Error visible y forense
  - Assembly checks
- **Referencias:** `public/js/master/master-script-loader.js`, `src/core/master/registry/master-layout-registry.v1.json`

#### `docs/ASSETS_CACHE_BUSTING_CONTRACT_V1.md`
- **Tipo:** Contrato de versionado
- **Contenido:** Versionado determinista de assets (APP_VERSION + BUILD_ID)

#### `docs/ASSETS_CACHE_BUSTING_GITHUB.md`
- **Tipo:** Implementación GitHub
- **Contenido:** Implementación del sistema de cache busting

#### `docs/ASSETS_CACHE_BUSTING_VERIFIED.md`
- **Tipo:** Verificación
- **Contenido:** Verificación del sistema de cache busting

### 1.4 Sidebar

#### `docs/MASTER_SIDEBAR_V1_DELUXE_IMPLEMENTACION.md`
- **Tipo:** Implementación
- **Contenido:** Implementación del sidebar MASTER con features "de lujo"

#### `docs/MASTER_SIDEBAR_V1_1_THEME_READY.md`
- **Tipo:** Mejora (Theme-Ready)
- **Contenido:** CSS variables canónicas, fold/unfold sidebar

#### `docs/MASTER_SIDEBAR_V1_2_CLEANUP.md`
- **Tipo:** Limpieza
- **Contenido:** Limpieza de código del sidebar

#### `docs/MASTER_SIDEBAR_V1_3_LUMINOSIDAD.md`
- **Tipo:** Mejora visual
- **Contenido:** Sistema de luminosidad del sidebar

#### `docs/MASTER_SIDEBAR_V1_4_RESIZE.md`
- **Tipo:** Mejora (Resize)
- **Contenido:** Sistema de redimensionamiento del sidebar

#### `docs/MASTER_SIDEBAR_REGISTRY_CONTRACT.md`
- **Tipo:** Contrato del registry
- **Contenido:** Contrato del registry del sidebar

#### `docs/MASTER_SIDEBAR_LAYOUT_CONTRACT_V1.md`
- **Tipo:** Contrato de layout
- **Contenido:** Contrato de layout del sidebar

#### `docs/MASTER_SIDEBAR_CSS_CONTRACT.md`
- **Tipo:** Contrato CSS
- **Contenido:** Contrato CSS del sidebar

#### `docs/MASTER_SIDEBAR_LIFECYCLE_V1_4_2.md`
- **Tipo:** Lifecycle
- **Contenido:** Lifecycle del sidebar v1.4.2

#### `docs/FORENSE_SIDEBAR_MASTER.md`
- **Tipo:** Análisis forense
- **Contenido:** Análisis forense del sidebar MASTER

#### `docs/FORENSE_SIDEBAR_MASTER_BACKEND.md`
- **Tipo:** Análisis forense backend
- **Contenido:** Análisis forense del backend del sidebar

#### `docs/AUDITORIA_FORENSE_SIDEBAR_MASTER_COMPLETA.md`
- **Tipo:** Auditoría forense completa
- **Contenido:** Auditoría forense completa del sidebar

### 1.5 Entry Gate y Aislamiento

#### `docs/INJECT_MAIN_ISOLATION_FIX_V1_4_3.md`
- **Tipo:** Fix de aislamiento
- **Contenido:** Aislamiento absoluto de `inject_main.js` en MASTER

#### `docs/INJECT_MAIN_ISOLATION_GITHUB.md`
- **Tipo:** Implementación GitHub
- **Contenido:** Implementación del aislamiento de `inject_main.js`

#### `docs/FORENSE_INJECT_MASTER_DIAGNOSTICO.md`
- **Tipo:** Diagnóstico forense
- **Contenido:** Diagnóstico forense del entry gate MASTER

### 1.6 Auth

#### `docs/AUTH_ADMIN_MASTER_V1.md`
- **Tipo:** Sistema de autenticación
- **Contenido:** Sistema de autenticación para Admin y Master

---

## 🔮 SECCIÓN 2: ALQUIMIA GENERAL

### 2.1 Documentación Principal

#### `docs/MASTER_ALQUIMIA_GENERAL_V1.md`
- **Tipo:** Documentación canónica
- **Estado:** ✅ OPERATIVO
- **Contenido:**
  - Sistema canónico para gestión de listas e items de transmutaciones energéticas
  - PostgreSQL como Source of Truth único
  - Esquema de base de datos (tablas: `listas_transmutaciones`, `items_transmutaciones`, `student_item_state`)
  - Endpoints API (`/master/api/alquimia-general/*`)
  - Migraciones aplicadas (v5.34.0, v5.35.0, v5.46.0)
  - Logging estructurado
  - Degradación fail-open
  - Troubleshooting
- **Referencias:** `src/endpoints/master-api-alquimia-general.js`, `src/services/alquimia-general-service.js`

#### `docs/MASTER_ALQUIMIA_GENERAL_ASIS.md`
- **Tipo:** Estado AS-IS
- **Contenido:**
  - Estado real del sistema antes de implementar Alquimia General en MASTER
  - Tablas reales en PostgreSQL
  - Endpoints existentes (Admin legacy vs canónicos)
  - Handler MASTER existente
  - Conclusiones de compatibilidad
  - Decisiones tomadas
  - Plan de acción
- **Tablas documentadas:**
  - `listas_transmutaciones`
  - `items_transmutaciones`
  - `student_item_state`
  - `student_te_recurrent_state` (legacy)
  - `student_te_one_time_state` (legacy)

#### `docs/ALQUIMIA_FLOTANTE_VER_V1.md`
- **Tipo:** Feature específica
- **Contenido:**
  - Sistema canónico para visualizar estado de todos los alumnos respecto a un ítem específico
  - Flotante "VER" en cada fila de ítem
  - Estados: PENDIENTE, REVISADO, CRÍTICO, NUNCA
  - Tipos de listas: Recurrentes, Una sola vez, NUNCA
  - Endpoints: `GET /master/api/alquimia-general/items/:item_ref/students`, `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all`, `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`

#### `docs/DIAGNOSTICO_TRANSMUTACIONES_ENERGETICAS.md`
- **Tipo:** Diagnóstico exhaustivo
- **Contenido:**
  - Documentación exhaustiva del sistema actual de Transmutaciones Energéticas
  - Reconstrucción canónica en dominio MASTER
  - Tablas legacy vs canónicas
  - Endpoints legacy vs canónicos
  - Plan de migración

### 2.2 List Projection Model (LPM)

#### `docs/LPM_ALL_WORST_STATE_V1.md`
- **Tipo:** Documentación canónica constitucional
- **Fecha:** 2026-01-14
- **Estado:** ✅ ENFORCED
- **Contenido:**
  - Fix canónico del bug de "peor estado" en proyección ALL
  - Causa raíz: query solo devolvía students con fila
  - Solución: CROSS JOIN + LEFT JOIN para traer TODOS los estudiantes
  - Cómo se materializa "student sin fila" (NULL para recurrente, clean_count=0 para una_vez)
  - Contrato de salida (no romper)
  - Prueba canónica reproducible (script de diagnóstico)
  - Guards y prevención
  - UUID-only enforcement
- **Referencias:** `src/core/master/services/list-projection-model.js`, `scripts/diagnose-all-projection-uuid-only.js`

#### `docs/CANONICAL_RULES_PROJECTION_ALL_WORST_STATE_V1.md`
- **Tipo:** Reglas canónicas constitucionales
- **Fecha:** 2026-01-13
- **Contenido:** Reglas absolutas de proyección ALL (principio fundamental, definición de "peor estado", etc.)

#### `docs/LIST_PROJECTION_MODEL_V1.md`
- **Tipo:** Documentación canónica completa
- **Contenido:** Documentación completa del List Projection Model (LPM)

### 2.3 Acciones Individuales y Persistencia UI

#### `docs/ALQUIMIA_ITEM_OVERRIDES_V1.md`
- **Tipo:** Documentación canónica
- **Fecha:** 2026-01-13
- **Estado:** ✅ CANÓNICO
- **Contenido:**
  - Botones de limpieza individual por ítem (solo vista ALUMNO)
  - Persistencia del tamaño del flotante (expanded/collapsed)
  - Reglas constitucionales aplicadas (Backend autoridad, UUID-only, etc.)
  - Modelo de datos (tablas existentes: cleaning_item_state, cleaning_events)
  - Contratos API (endpoints implementados: mark-clean-student)
  - LPM/CPM: cálculo de estado (sin overrides)
  - UI: botones y persistencia (implementación actual)
  - Verificación: checklist de pruebas manuales y casos límite
- **Referencias:** `public/js/master/master-alquimia-general-client.js`, `src/core/master/services/cleaning-engine-service.js`

### 2.4 Diagnósticos

#### `docs/MASTER_DIAGNOSTIC_REPORT.md`
- **Tipo:** Reporte de diagnóstico forense
- **Fecha:** 2026-01-05
- **Contenido:**
  - Estado general del sistema MASTER
  - Rutas MASTER inventariadas
  - Scripts cliente inventariados
  - Endpoints Alquimia inventariados
  - Base de datos (tablas `student_item_state`, `alumnos`)
  - Checks (Assembly check de API)
  - Problemas críticos identificados
  - Lista de crashes reproducibles
- **Hallazgos clave:**
  - ✅ Registry y Routing funcional
  - ✅ Endpoints Alquimia registrados y mapeados
  - ⚠️ Host validation bloquea localhost
  - ❌ NO CONSTA: Campo/derivación para "nivel del ítem"

#### `docs/MASTER_BLANCO_DIAGNOSTIC.md`
- **Tipo:** Diagnóstico "por qué está todo en blanco"
- **Fecha:** 2026-01-05
- **Ruta problemática:** `/master/templo-luz/alquimia-general`
- **Contenido:**
  - Inventario de rutas MASTER (UI)
  - Inventario de handlers (server)
  - Inventario del loader MASTER
  - Evidencia "HTML servido"
  - Evidencia "Assets existen"
  - Base de datos (solo confirmar existencia)
  - Conclusión: Causa principal más probable (SCRIPT NO SE EJECUTA)
  - Checklist de verificación
- **Hipótesis principal:** Script `master-alquimia-general-client.js` se carga pero no se ejecuta correctamente

---

## 🏠 SECCIÓN 3: LUGARES

### 3.1 Documentación Principal

#### `docs/master/MASTER_PLACES_SYSTEM_V1.md`
- **Tipo:** Sistema canónico completo
- **Fecha:** 2026-01-03
- **Estado:** ✅ CERRADO Y FUNCIONAL
- **Contenido:**
  - Sistema canónico para gestión de lugares físicos asociados a alumnos
  - Modelo de datos (tablas: `place_categories`, `places_catalog`, `student_place_state`, `student_activation_limits`)
  - Servicios canónicos (`activatePlace`, `deactivatePlace`, `cleanPlace`, `cleanSelectedPlaces`, `cleanAllActivePlaces`, `handleSubscriptionPause`, `updateActivationLimit`)
  - Señales registradas (`place.activated`, `place.deactivated`, `place.cleaned`, etc.)
  - Endpoints API MASTER (`/master/api/places/*`, `/master/api/places-catalog/*`, `/master/api/place-categories/*`)
  - UI MASTER (`/master/templo-luz/lugares`) con 3 tabs:
    - TAB 1: Lugares Activos (ordenación jerárquica por prioridades)
    - TAB 2: Configuración por Alumno (gestión individual)
    - TAB 3: Clasificaciones (CRUD de categorías)
  - Reglas canónicas (límites de activación, salud y limpieza, suscripción pausada)
  - Casos límite documentados
  - Checklist de validación
  - Order Pipeline Contract (ordenación jerárquica)
  - Tab 2 Fields Contract (campos mostrados)
  - Verificación de ejecución real (logs inequívocos, BUILD_STAMP)
  - Correcciones estructurales (diferencia activación MASTER vs alumno, límite infinito explícito, caché y bootstrap)
- **Referencias:** `src/services/place-service.js`, `src/endpoints/master-api-places.js`, `public/js/master/master-lugares-client.js`

#### `docs/master/MASTER_ASSET_EXECUTION_FORENSICS.md`
- **Tipo:** Forensics de ejecución de assets
- **Fecha:** 2026-01-04
- **Contenido:**
  - Verificación forense de que el código nuevo de `master-lugares-client.js` se ejecuta realmente en producción
  - BUILD_STAMP inequívoco (`window.__AP_MASTER_LUGARES_STAMP__`)
  - Procedimiento de verificación
  - Logs inequívocos añadidos
- **Referencias:** `public/js/master/master-lugares-client.js`

#### `docs/VERIFICACION_ALUMNOS_LUGARES.md`
- **Tipo:** Verificación
- **Contenido:** Verificación de alumnos y lugares

---

## 📜 SECCIÓN 3.5: PROYECTOS

### 3.5.1 Documentación Principal

#### `docs/master/MASTER_PROJECTS_SYSTEM_V1.md`
- **Tipo:** Sistema canónico completo
- **Fecha:** 2026-01-05
- **Estado:** ✅ CERRADO Y FUNCIONAL
- **Contenido:**
  - Sistema canónico para gestión de proyectos asociados a alumnos
  - Modelo de datos (tablas: `project_categories`, `projects_catalog`, `student_project_state`, `student_activation_limits`)
  - Servicios canónicos (`activateProject`, `deactivateProject`, `cleanProject`, `cleanSelectedProjects`, `cleanAllActiveProjects`, `handleSubscriptionPauseProjects`, `updateActivationLimit`, `createProjectForStudent`)
  - Señales registradas (`project.activated`, `project.deactivated`, `project.cleaned`, etc.)
  - Endpoints API MASTER (`/master/api/projects/*`, `/master/api/projects-catalog/*`, `/master/api/project-categories/*`)
  - UI MASTER (`/master/templo-luz/proyectos`) con 3 tabs:
    - TAB 1: Proyectos Activos (ordenación jerárquica por prioridades)
    - TAB 2: Configuración por Alumno (gestión individual + crear proyecto)
    - TAB 3: Clasificaciones (CRUD de categorías)
  - Reglas canónicas (límites de activación, salud y limpieza, suscripción pausada)
  - Casos límite documentados
  - Checklist de validación
  - Order Pipeline Contract (ordenación jerárquica)
  - Verificación de ejecución real (BUILD_STAMP)
- **Referencias:** `src/services/project-service.js`, `src/endpoints/master-api-projects.js`, `public/js/master/master-proyectos-client.js`

#### `docs/master/MASTER_PROJECTS_ASSET_EXECUTION_FORENSICS.md`
- **Tipo:** Forensics de ejecución de assets
- **Fecha:** 2026-01-05
- **Contenido:**
  - Verificación forense de que el código de `master-proyectos-client.js` se ejecuta realmente en producción
  - BUILD_STAMP inequívoco (`window.__AP_MASTER_PROYECTOS_STAMP__`)
  - Procedimiento de verificación
  - Debug mode
- **Referencias:** `public/js/master/master-proyectos-client.js`

### 3.5.2 Diagnóstico (Histórico)

#### `docs/master/MASTER_PROJECTS_DIAGNOSTIC.md`
- **Tipo:** Diagnóstico exhaustivo (histórico)
- **Fecha:** 2026-01-05
- **Estado:** ✅ COMPLETADO (mantener como histórico)
- **Contenido:**
  - Resumen ejecutivo: No existe sistema canónico de Proyectos en MASTER
  - Qué EXISTE: Ruta placeholder, soporte en `student_activation_limits`, referencias legacy
  - Qué NO EXISTE: Tablas canónicas, repositorios, servicio, endpoints, señales, UI, documentación
  - Estado de base de datos (tablas existentes vs requeridas)
  - Comparación: Lugares vs Proyectos
  - Recomendación: Crear sistema canónico nuevo espejo de Lugares
  - Checklist de verificación post-implementación
  - Notas técnicas (reutilización de código, aislamiento de legacy)
- **Referencias:** `src/endpoints/master-templo-luz-proyectos.js`, `docs/master/MASTER_PLACES_SYSTEM_V1.md`

---

## 🏷️ SECCIÓN 4: CLASIFICACIONES Y TAGS

### 4.1 Clasificaciones (Categories/Subtypes)

#### `docs/CLASSIFICATION_SOT_GLOBAL_V1.md`
- **Tipo:** Documentación canónica
- **Versión:** 1.0.0
- **Estado:** ✅ CERTIFICADO
- **Contenido:**
  - `pde_classification_terms` (tipos `'key'` y `'subkey'`) como CLASSIFICATION SOT GLOBAL v1
  - Gobernado exclusivamente por dominio MASTER
  - Estructura de base de datos (`pde_classification_terms`)
  - Helper canónico: `ensureClassificationTerm()`
  - Endpoints API MASTER (`GET /master/api/classifications`, `POST /master/api/classifications`, `PATCH /master/api/classifications/:id`, `POST /master/api/classifications/:id/deprecate`)
  - UI MASTER (Alquimia General)
  - Migraciones legacy
- **Referencias:** `src/core/classification/ensure-classification-term.js`

#### `docs/CLASSIFICATION_LIST_ATTACHMENT_V1.md`
- **Tipo:** Persistencia de asociación
- **Contenido:**
  - Persistencia de asociación de clasificaciones (category/subtype/tags) a listas
  - Tabla de relación: `transmutacion_lista_classifications`
  - Endpoints: `PUT /master/api/alquimia-general/listas/:id/classification`
  - UI MASTER (Alquimia General)

### 4.2 Tags

#### `docs/TAG_SOT_GLOBAL_V1.md`
- **Tipo:** Documentación canónica
- **Versión:** 1.0.0
- **Estado:** ✅ EN IMPLEMENTACIÓN
- **Contenido:**
  - `pde_classification_terms` (tipo `'tag'`) como TAG SOT GLOBAL v1
  - Gobernado exclusivamente por dominio MASTER
  - Helper canónico: `ensureClassificationTerm()`
  - Estructura de base de datos (`pde_classification_terms`)
  - Endpoints API MASTER (`GET /master/api/tags`, `POST /master/api/tags`, `PATCH /master/api/tags/:id`, `POST /master/api/tags/:id/deprecate`)
- **Referencias:** `src/core/classification/ensure-classification-term.js`

#### `docs/CLASSIFICATION_TAG_PERSISTENCE_V1.md`
- **Tipo:** Persistencia de tags
- **Contenido:**
  - Persistencia de tags en Alquimia General
  - Problema: Tags desaparecen al recargar
  - Solución: Tabla de relación `transmutacion_lista_classifications`
  - Endpoints: `PUT /master/api/alquimia-general/listas/:id`

#### `docs/TAGS_PERSISTENCE_FIX_V5_53_1.md`
- **Tipo:** Fix de persistencia
- **Contenido:** Fix de persistencia de tags (v5.53.1)

#### `docs/TAGS_SYSTEM_DIAGNOSTIC.md`
- **Tipo:** Diagnóstico del sistema de tags
- **Contenido:** Diagnóstico completo del sistema de tags

---

## 🔍 SECCIÓN 5: DIAGNÓSTICOS Y AUDITORÍAS

### 5.1 Diagnósticos Recientes

#### `docs/MASTER_DIAGNOSTIC_REPORT.md`
- **Véase Sección 2.2**

#### `docs/MASTER_BLANCO_DIAGNOSTIC.md`
- **Véase Sección 2.2**

#### `docs/MASTER_STUDENTS_UI_DIAGNOSTIC_V1.md`
- **Tipo:** Diagnóstico UI de estudiantes
- **Contenido:** Diagnóstico de la UI de estudiantes en MASTER

### 5.2 Auditorías

#### `docs/AUDITORIA_MASTER_LAYOUT_V1.md`
- **Véase Sección 1.1**

#### `docs/AUDITORIA_FORENSE_SIDEBAR_MASTER_COMPLETA.md`
- **Véase Sección 1.4**

---

## 📊 SECCIÓN 6: TABLAS Y ENDPOINTS DOCUMENTADOS

### 6.1 Tablas de Base de Datos

#### Alquimia General
- `listas_transmutaciones` - Catálogo de listas
- `items_transmutaciones` - Catálogo de items
- `student_item_state` - Estado de items por alumno
- `transmutacion_lista_classifications` - Relación many-to-many entre listas y clasificaciones

#### Lugares
- `place_categories` - Clasificaciones de lugares
- `places_catalog` - Catálogo global de lugares
- `student_place_state` - Estado alumno-lugar
- `student_activation_limits` - Límites de activación

#### Clasificaciones/Tags
- `pde_classification_terms` - Source of Truth global de classifications/tags

### 6.2 Endpoints API Documentados

#### Alquimia General
- `GET /master/api/alquimia-general/listas` - Lista listas
- `POST /master/api/alquimia-general/listas` - Crea lista
- `GET /master/api/alquimia-general/listas/:id` - Obtiene lista
- `PUT /master/api/alquimia-general/listas/:id` - Actualiza lista
- `DELETE /master/api/alquimia-general/listas/:id` - Archiva lista (soft)
- `GET /master/api/alquimia-general/listas/:id/items` - Lista items de una lista
- `POST /master/api/alquimia-general/items` - Crea item
- `GET /master/api/alquimia-general/items/:item_ref/students` - Lista alumnos con estado (modal VER)
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all` - Limpia todos (recurrente)
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student` - Limpia alumno (recurrente)
- `PUT /master/api/alquimia-general/listas/:id/classification` - Asocia clasificaciones a lista

#### Lugares
- `GET /master/api/places/active` - Lista lugares activos
- `POST /master/api/places/clean` - Limpia lugar
- `POST /master/api/places/clean-bulk` - Limpieza masiva
- `POST /master/api/places/clean-all` - Limpia todos
- `GET /master/api/places/student/:student_id` - Lugares de alumno
- `POST /master/api/places/activate` - Activa lugar
- `POST /master/api/places/deactivate` - Desactiva lugar
- `PATCH /master/api/places/state/:id` - Actualiza estado
- `POST /master/api/places/limit` - Actualiza límite de activación
- `GET /master/api/places-catalog` - Lista catálogo
- `POST /master/api/places-catalog` - Crea lugar en catálogo
- `GET /master/api/place-categories` - Lista categorías
- `POST /master/api/place-categories` - Crea categoría

#### Clasificaciones
- `GET /master/api/classifications` - Lista classifications
- `POST /master/api/classifications` - Crea classification
- `PATCH /master/api/classifications/:id` - Actualiza classification
- `POST /master/api/classifications/:id/deprecate` - Depreca classification

#### Tags
- `GET /master/api/tags` - Lista tags
- `POST /master/api/tags` - Crea tag
- `PATCH /master/api/tags/:id` - Actualiza tag
- `POST /master/api/tags/:id/deprecate` - Depreca tag

---

## 🚫 SECCIÓN 7: HUECOS DETECTADOS

### 7.1 Documentación Faltante

#### Alquimia General
- ❌ **NO CONSTA:** Documentación específica de cómo se calcula "% por nivel" en alquimia
- ❌ **NO CONSTA:** Documentación de campo/derivación para "nivel del ítem" necesario para % por nivel
- ❌ **NO CONSTA:** Documentación de migración de datos legacy (`student_te_recurrent_state`, `student_te_one_time_state`) a `student_item_state`
- ⚠️ **PARCIAL:** Documentación de endpoints de items (falta documentación completa de CRUD de items)

#### Lugares
- ✅ **COMPLETO:** Sistema completamente documentado

#### Clasificaciones/Tags
- ✅ **COMPLETO:** Sistema completamente documentado

#### MASTER Layout/System
- ❌ **NO CONSTA:** Documentación de cómo se determina `universeId` en handlers
- ❌ **NO CONSTA:** Documentación de cómo se mapean `routeKey` a handlers en `MASTER_HANDLER_MAP`
- ⚠️ **PARCIAL:** Documentación de UI Factory (existe pero podría ser más completa)

### 7.2 Código Faltante (según diagnósticos)

- ❌ **NO CONSTA:** `master-runtime-assembly-check.js` (mencionado en inventario pero no existe)
- ❌ **NO CONSTA:** Checks `check:master-runtime-contract` y `check:master-ui` (mencionados en rules pero no existen en `package.json`)

### 7.3 Verificaciones Faltantes

- ❌ **NO CONSTA:** Verificación en navegador de que scripts cliente se ejecutan correctamente
- ❌ **NO CONSTA:** Verificación de que señales `clean.executed` se registran en signal system
- ❌ **NO CONSTA:** Verificación de que `alumnos.nivel_actual` es suficiente para % por nivel o si se requiere campo adicional

---

## 📝 SECCIÓN 8: REFERENCIAS CRUZADAS

### 8.1 Archivos de Código Referenciados

#### Layout/Routing
- `src/core/master/layout/master-page-renderer.js` - Renderer canónico
- `src/core/master/layout/master-layout-v1.html` - Template único
- `src/core/master/router/master-router-resolver.js` - Resolver de rutas
- `src/core/master/registry/master-route-registry.js` - Registry de rutas
- `src/core/master/registry/master-layout-registry.v1.json` - Registry de layout/scripts
- `src/core/master/registry/master-sidebar-registry.js` - Registry del sidebar

#### Scripts Frontend
- `public/js/master/inject_master.js` - Entry gate canónico
- `public/js/master/master-script-loader.js` - Loader canónico
- `public/js/master/master-sidebar-client.js` - Cliente del sidebar
- `public/js/master/master-alquimia-general-client.js` - Cliente de Alquimia General
- `public/js/master/master-lugares-client.js` - Cliente de Lugares
- `public/js/shared/asset-runtime-registry.js` - Registry runtime de assets

#### Endpoints
- `src/endpoints/master-api-alquimia-general.js` - Endpoints de Alquimia General
- `src/endpoints/master-api-places.js` - Endpoints de Lugares
- `src/endpoints/master-templo-luz-alquimia-general.js` - Handler UI de Alquimia General
- `src/endpoints/master-templo-luz-alquimia-alumno.js` - Handler UI de Alquimia del Alumno

#### Servicios
- `src/services/alquimia-general-service.js` - Servicio de Alquimia General
- `src/services/place-service.js` - Servicio de Lugares
- `src/infra/repos/alquimia-catalog-repo-pg.js` - Repositorio PostgreSQL de Alquimia

#### Clasificaciones
- `src/core/classification/ensure-classification-term.js` - Helper canónico de classifications

### 8.2 Scripts de Verificación

- `scripts/check-master-api-assembly.js` - Check de API MASTER
- `scripts/master-ui-assembly-check.js` - Assembly check de UI MASTER
- `scripts/check-assets-master.js` - Check de assets MASTER

---

## ✅ CONCLUSIÓN

### Estado General

- ✅ **MASTER Layout/System:** Completamente documentado (15+ documentos)
- ✅ **Lugares:** Completamente documentado (3 documentos principales)
- ✅ **Proyectos:** Sistema canónico completo implementado (espejo de Lugares)
- ✅ **Clasificaciones/Tags:** Completamente documentado (6+ documentos)
- ⚠️ **Alquimia General:** Bien documentado pero con algunos huecos (5+ documentos)

### Documentos Más Importantes

1. **`docs/MASTER_LAYOUT_V1.md`** - Contrato canónico del sistema de layout
2. **`docs/MASTER_ALQUIMIA_GENERAL_V1.md`** - Documentación canónica de Alquimia General
3. **`docs/master/MASTER_PLACES_SYSTEM_V1.md`** - Sistema completo de Lugares
4. **`docs/ASSETS_SYSTEM_V1.md`** - Sistema canónico de assets
5. **`docs/MASTER_API_CONTRACTS.md`** - Contratos constitucionales de API
6. **`docs/CLASSIFICATION_SOT_GLOBAL_V1.md`** - Sistema de clasificaciones
7. **`docs/TAG_SOT_GLOBAL_V1.md`** - Sistema de tags

### Próximos Pasos Recomendados

1. Completar documentación de "% por nivel" en Alquimia General
2. Documentar migración de datos legacy a `student_item_state`
3. Crear `master-runtime-assembly-check.js` si es necesario
4. Añadir checks faltantes en `package.json` si son necesarios
5. Verificar en navegador ejecución de scripts cliente

---

**Última actualización:** 2026-01-05  
**Mantenido por:** Sistema de documentación forense
