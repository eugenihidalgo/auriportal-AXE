# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

---

## [5.47.1] - 2024-12-30

### Fixed
- **Frontend SyntaxError**: Reemplazado template literal con interpolación de datos sin escapar en `admin-assembly-check-ui.js` por DOM API seguro. Los datos ahora se renderizan usando `renderChecksTable()` que crea elementos DOM directamente, evitando SyntaxError por caracteres especiales en `ui_key`, `route_path`, etc.
- **Endpoint 500 `/admin/api/transmutaciones/energeticas`**: Creado handler faltante `admin-api-transmutaciones-energeticas.js` que lista todas las listas activas de transmutaciones energéticas. Añadido al Admin Route Registry y al router resolver.
- **Endpoint 500 `/admin/api/transmutaciones/proyectos`**: Actualizado `getProyectosHandler` para usar `toSuccessResponse` y `toErrorResponse` del error contract canónico, mejorando el manejo de errores y consistencia con otros endpoints.

### Changed
- `src/endpoints/admin-assembly-check-ui.js`: Tabla de checks ahora se renderiza usando DOM API en lugar de template literals con interpolación, eliminando riesgo de SyntaxError.
- `src/endpoints/admin-transmutaciones-proyectos-api.js`: Migrado a usar error contract canónico (`toSuccessResponse`/`toErrorResponse`).

### Added
- `src/endpoints/admin-api-transmutaciones-energeticas.js`: Nuevo handler API para GET `/admin/api/transmutaciones/energeticas`.
- Ruta `api-transmutaciones-energeticas` en `admin-route-registry.js`.
- Handler mapping en `admin-router-resolver.js` para `api-transmutaciones-energeticas`.

---

## [5.47.0] - 2025-01-XX

### Added
- **ACS-R (Assembly Check Runtime Frontend) v1**: Sistema de validación que se ejecuta en el navegador al cargar UIs admin
  - **Runtime Guard**: `src/core/admin/runtime/acs-runtime-guard.js` - Guard que valida runtime frontend antes de permitir interacción
  - **Build Stamp Validation**: Valida coherencia entre BUILD_ID del HTML y del servidor (vía `/__version`)
  - **SyntaxError Detection**: Detecta y bloquea UI si hay errores de parseo JS en el navegador
  - **Missing Handler Detection**: Valida que funciones/handlers requeridos estén presentes en runtime
  - **Endpoint Health Check**: Valida que endpoints críticos respondan correctamente (opcional)
  - **Diagnostic Panel**: Panel overlay visible que bloquea UI y muestra diagnóstico cuando falla
  - **Screen Runtime Contract**: Contrato por pantalla que declara `ui_key`, `required_globals`, `required_endpoints`, `strict_mode`
  - **Endpoint de reporte**: `POST /admin/api/acs/runtime-report` - Recibe reportes de errores desde el navegador (opcional)
  - **Integración en 3 pantallas**: `/admin/system/assembly`, `/admin/pde/transmutaciones-energeticas`, `/admin/pde/transmutaciones-proyectos`
  - **Documentación completa**:
    - `docs/FRONTEND_ROBUSTNESS_INVENTORY.md` - Inventario de mecanismos de robustez existentes
    - `docs/ACS_RUNTIME_FRONTEND_V1.md` - Especificación completa de ACS-R v1
    - `docs/ACS_RUNTIME_FRONTEND_V1_TESTS.md` - Checklist de pruebas obligatorias

### Changed
- **admin-page-renderer.js**: 
  - Añade `window.__BUILD__` con `buildId` y `appVersion` para ACS-R
  - Añade script `acs-runtime-guard.js` automáticamente en todas las pantallas admin
  - Soporte para `acsRuntimeContract` en opciones de `renderAdminPage()`
- **Build stamp**: Ahora se expone en `data-build-id` y `data-app-version` en `<body>`, además de `window.__BUILD__`

### Technical Details
- ACS-R se ejecuta en el navegador (no en servidor)
- Valida parseo JS real del navegador (no solo sintaxis Node.js)
- FAIL-HARD visible: Si JS crítico falla, muestra diagnóstico y bloquea UI
- Prohibido `innerHTML` dinámico (DOM API obligatoria)
- Prohibido JSON embebido en `<script>` (usa `application/json` o inline object seguro)
- Integrado con ACS Backend existente (complementario, no reemplazo)

---

## [5.46.0] - 2025-01-XX

### Added
- **Student Domain UI Integration Closure**: Cierre completo de integración UI-Dominio
  - **Función canónica `resolveTemporalState`**: Resuelve estado temporal (limpio/pendiente/crítico) basado en `last_cleaned_at` y `recurrence_days`
  - **Helper `formatDaysAgo`**: Formatea "Hace X días" de forma humana
  - **Endpoint agregado**: `GET /admin/api/transmutations/:item_ref/students` - Lista todos los alumnos con su estado respecto a un ítem
  - **Modal transmutaciones mejorado**: 
    - Botón ❌ funcional
    - Se cierra con ESC
    - Se cierra al hacer click fuera (backdrop)
    - Conectado al nuevo endpoint canónico
    - Muestra alumnos agrupados por estado temporal
  - **UI Proyectos mejorada**:
    - Columna "Hace X días" añadida
    - Columna "Estado" con badge temporal (limpio/pendiente/crítico)
    - Botón "Editar" en acciones
    - Modal de edición completo (name, description, assigned_person_name, recurrencia)
    - Modal cerrable (ESC, click fuera, botón ❌)

### Changed
- **Modal transmutaciones**: Conectado al nuevo endpoint canónico `/admin/api/transmutations/:item_ref/students`
- **UI Proyectos**: Usa `resolveTemporalState` y `formatDaysAgo` para mostrar estados y fechas
- **Handler proyectos**: Integrado con nuevo sistema cuando está disponible, fallback a legacy

### Technical Details
- `resolveTemporalState` es función única y canónica, no duplicada
- Estados temporales calculados en servidor (no en UI)
- Modales mejorados con UX funcional (cerrables, no bloquean)
- Integración gradual: nuevo sistema cuando disponible, legacy como fallback

---

## [5.45.0] - 2025-01-XX

### Added
- **Student Domain Integration v1**: Integración canónica de dominios (Transmutaciones, Proyectos) con Student SOT v1
  - **Migración v5.45.0**: Ajusta `student_item_state` para soportar `product_key`, `domain_type`, `item_ref`, `active_state`, `clean_state`, `per_item_config`
  - **Student Domain Integration Service**: Servicio canónico para gestionar dominios
    - `listTransmutations()`: Lista transmutaciones del alumno
    - `cleanTransmutation()`: Limpia transmutación (siempre permitido, incluso PAUSED)
    - `listProjects()`: Lista proyectos del alumno
    - `activateProject()`: Activa proyecto (enforce: solo 1 activo)
    - `cleanProject()`: Limpia proyecto
    - `updateProjectMetadata()`: Actualiza metadatos (name, description, assigned_person_name)
  - **Endpoints Alumno** (`/api/me/domains/*`):
    - `GET /api/me/domains/transmutation`: Lista transmutaciones
    - `POST /api/me/domains/transmutation/items/:item_ref/clean`: Limpia transmutación
    - `GET /api/me/domains/projects`: Lista proyectos
    - `POST /api/me/domains/projects/items/:item_ref/activate`: Activa proyecto
    - `POST /api/me/domains/projects/items/:item_ref/clean`: Limpia proyecto
    - `PATCH /api/me/domains/projects/items/:item_ref`: Actualiza metadatos
  - **Endpoints Admin** (`/admin/api/students/:id/domains/*`):
    - `GET /admin/api/students/:id/domains/transmutation`: Lista transmutaciones (Master)
    - `POST /admin/api/students/:id/domains/transmutation/items/:item_ref/clean`: Limpia transmutación (Master)
    - `GET /admin/api/students/:id/domains/projects`: Lista proyectos (Master)
    - `POST /admin/api/students/:id/domains/projects/items/:item_ref/activate`: Activa proyecto (Master)
    - `POST /admin/api/students/:id/domains/projects/items/:item_ref/clean`: Limpia proyecto (Master)
    - `PATCH /admin/api/students/:id/domains/projects/items/:item_ref`: Actualiza metadatos (Master, incluye assigned_person_name)
  - **Capabilities nuevas**:
    - `can_clean_domain_items`: Siempre `true` (incluso en PAUSED)
    - `can_activate_project`: Permite activar proyectos (con enforcement)
    - `can_edit_project_metadata`: Permite editar metadatos de proyectos
  - **Señales nuevas**:
    - `student.domain.item.metadata_updated`: Al actualizar metadatos
    - `student.project.active_changed`: Al cambiar proyecto activo
  - **Backfill script**: `scripts/backfill-student-domain-items-v1.js` para inicializar `student_item_state`
  - **Documentación**: `docs/STUDENT_DOMAIN_INTEGRATION_V1.md`

### Changed
- **Student Capability Resolver**: Actualizado para permitir `can_clean_domain_items` siempre (incluso en PAUSED)
- **Student Capability Registry**: Añadidas 3 nuevas capabilities para operaciones de dominio

### Technical Details
- Migración `v5.45.0-student-domain-integration-v1.sql`: Añade campos flexibles a `student_item_state`
- Constraint UNIQUE actualizado: `(student_id, product_key, domain_type, item_ref)`
- Índices GIN para `per_item_config` (búsquedas en JSONB)
- Transacciones atómicas en servicio
- Auditoría automática en todas las mutaciones
- Emisión de señales registradas

---

## [5.44.0] - 2025-01-XX

### Added
- **Student SOT v1 Robustness Layers**: Capas canónicas de robustez para Student SOT v1
  - **Student Capability Registry v1**: Registry formal y versionado de todas las capabilities del sistema
    - `src/core/student/capabilities/student-capability-registry.js`: Registry canónico
    - `src/core/student/capabilities/student-capability-resolver.js`: Resolver que calcula capabilities desde contexto
    - `docs/STUDENT_CAPABILITY_REGISTRY_V1.md`: Documentación completa
  - **Student Signal Registry v1**: Registry de señales semánticas del dominio Alumno
    - `src/core/student/signals/student-signal-registry.js`: Registry canónico
    - `src/core/student/signals/student-signal-emitter.js`: Emitter wrapper
    - `docs/STUDENT_SIGNAL_REGISTRY_V1.md`: Documentación completa
  - **Student Coherence Checker v1**: Verificador de invariantes y clasificación de coherencia
    - `src/core/student/coherence/student-coherence-checker.js`: Checker con 8+ invariantes
    - `docs/STUDENT_COHERENCE_CHECKER_V1.md`: Documentación de invariantes
  - **Student Context Contract v1**: Contrato estable para consumo por Contextos/Automatizaciones/UI
    - `docs/STUDENT_CONTEXT_CONTRACT_V1.md`: Shape estable del contexto
  - **Student Extension Slots v1**: Slots extensibles (meta, feature_flags, experiments)
    - Migración `v5.44.0-student-extension-slots.sql`: Añade columnas JSONB a `students`
    - Métodos en `student-ontological-repo`: `getMeta/setMeta`, `getFeatureFlags/setFeatureFlags`, `getExperiments/setExperiments`
    - `docs/STUDENT_EXTENSION_SLOTS_V1.md`: Documentación
  - **Student Lifecycle Map v1**: Estados y transiciones del ciclo de vida
    - `src/core/student/lifecycle/student-lifecycle.js`: Constantes y enums
    - `docs/STUDENT_LIFECYCLE_MAP_V1.md`: Documentación de estados y transiciones
  - **Student Projection Plan v1**: Diseño de proyecciones futuras (solo diseño, no implementación)
    - `docs/STUDENT_PROJECTION_PLAN_V1.md`: Plan de proyecciones (summary, streaks, domain_summary)
  - **Student SOT v1 Cursor Rules**: Reglas constitucionales para Cursor
    - `docs/STUDENT_SOT_V1_CURSOR_RULES.md`: 6 nuevas reglas constitucionales

### Changed
- **Student Context Builder**: Integración completa de nuevas capas
  - Usa `resolveStudentCapabilities()` del Capability Resolver
  - Usa `checkStudentCoherence()` del Coherence Checker
  - Añade `contract_version: 'v1'` al contexto
  - Añade `coherence.issues` al contexto
  - Formato de fechas ISO en todos los campos de fecha
  - Shape del contexto alineado con Student Context Contract v1

### Technical Details
- Migración `v5.44.0-student-extension-slots.sql`: Añade `meta`, `feature_flags`, `experiments` (JSONB) a `students`
- Índices GIN para búsquedas eficientes en JSONB
- Repos actualizados: `student-ontological-repo` con métodos de extension slots
- Integración fail-open consciente: contexto siempre se devuelve, incluso con DEGRADED/BROKEN

---

## [5.16.0] - 2025-01-XX

### Added
- **Recorridos Preview Host**: Sistema de preview canónico para el Editor de Recorridos
  - HTML isla canónica (`/admin/recorridos/preview`) sin base.html, sin replace/regex
  - Renderer mínimo de steps (screen_video, screen_choice, placeholder para otros)
  - Listener postMessage con fail-open absoluto
  - Integración en editor con panel preview + iframe
- **Theme Catalog Endpoint**: Endpoint canónico para consumo en editores
  - `GET /admin/api/themes/catalog?include_drafts=0|1`
  - Agrega: Auto, Light Classic, Dark Classic, themes v3 publicados
  - Fail-open: si themes-v3 falla, devuelve solo system/classic
- **Theme Selector Helper**: Helper reutilizable para selector de temas
  - `src/core/ui/theme/theme-selector.js`
  - Persistencia localStorage configurable
  - Integración con Theme Catalog
- **Theme Tokens to CSS**: Helper para convertir tokens a CSS text
  - `src/core/theme/theme-tokens-to-css.js`
  - Soporta Theme Resolver v1 y ThemeDefinition v1

### Changed
- **Editor de Recorridos**: Integración de preview panel con iframe
  - Panel preview toggle ON/OFF
  - Theme selector actualizado con catálogo dinámico
  - postMessage automático con snapshot del recorrido
  - Persistencia de preferencia de tema en localStorage

### Fixed
- **Bug {{SIDEBAR_MENU}}**: Validación post-replace para asegurar que nunca quede sin reemplazar
  - Validación adicional en `admin-navigation-pages.js`
  - Logs de diagnóstico para detectar rutas que escapan

### Technical Details
- `src/endpoints/admin-themes-catalog-api.js`: Endpoint de catálogo de temas
- `src/core/html/admin/recorridos/recorridos-preview.html`: Preview host HTML
- `src/endpoints/admin-recorridos-preview-ui.js`: Handler del preview host
- `src/core/ui/theme/theme-selector.js`: Helper reutilizable
- `src/core/theme/theme-tokens-to-css.js`: Conversión tokens → CSS
- `src/core/admin/admin-route-registry.js`: Rutas nuevas registradas
- `src/router.js`: Enlaces de handlers nuevos
- `docs/RECORRIDOS_PREVIEW_V1.md`: Documentación de arquitectura
- `docs/DIAGNOSTICO_REC_PREVIEW_THEME_BRIDGE.md`: Diagnóstico inicial

### Notes
- Preview Recorridos NO usa portal alumno ni scripts legacy globales
- Theme Studio v3 sigue soberano: no renderiza pantallas reales del alumno
- Fail-open absoluto: tema inválido → fallback automático, preview falla → placeholder + banner
- Admin Route Registry v1 manda: todas las rutas nuevas registradas y validadas

---

## [5.13.0] - 2025-01-XX

### Added
- **Theme Studio v3**: Sistema soberano y desacoplado del runtime para edición de temas
  - UI isla HTML autónoma sin dependencias legacy (NO renderHtml, NO iframe, NO postMessage)
  - Preview Playground canónico con componentes genéricos inline
  - Endpoints `/admin/api/themes-v3/*` (list, create, load, save-draft, publish, duplicate, archive, delete-draft)
  - Estado canónico único (`window.themeState`)
  - Validación ThemeDefinition v1 (schema_version, tokens con keys que empiezan por "--")
  - Integración en admin sidebar como "Theme Studio (v3)"
  - Tests mínimos críticos para validación v1

### Technical Details
- `src/endpoints/admin-themes-v3-api.js`: Endpoints API nuevos (reusan repos y validación existentes)
- `src/endpoints/admin-themes-v3-ui.js`: Handler UI que sirve HTML/CSS/JS estáticos
- `src/admin/theme-studio-v3/`: UI completa (index.html, theme-studio-v3.css, theme-studio-v3.js)
- `src/router.js`: Rutas registradas para `/admin/api/themes-v3/*` y `/admin/themes/studio-v3`
- `docs/THEME_STUDIO_V3_DIAGNOSTICO.md`: Diagnóstico completo del sistema legacy y justificación de v3
- `tests/theme/theme-studio-v3.test.js`: Tests de validación ThemeDefinition v1

### Notes
- Theme Studio v3 NO toca runtime del alumno (no renderiza pantallas reales)
- Reusa tablas PostgreSQL existentes (themes, theme_drafts, theme_versions)
- Mantiene Theme Studio v2 (legacy) sin cambios
- Preview inline sin iframe ni postMessage (CSS variables directas)

---

## [4.8.0] - 2024-12-19

### Changed
- **Normalización definitiva de `fase_efectiva`**: `fase_efectiva` ahora SIEMPRE es un objeto `{id, nombre, reason?}`, nunca un string. Esto garantiza consistencia semántica y elimina condicionales en el código consumidor.
- **Unificación de nomenclatura**: Documentación y comentarios ahora usan `niveles_energeticos` como nombre canónico (el concepto), mientras que la tabla legacy `niveles_fases` se mantiene para compatibilidad.

### Added
- **Documentación de decisión DELETE ALL + INSERT**: El endpoint admin de `niveles_energeticos` ahora documenta explícitamente la decisión arquitectónica de usar reemplazo completo (DELETE ALL + INSERT) en lugar de diff/merge. Incluye ventajas, limitaciones y guía para futuras mejoras (versionado, preview por entorno).
- **Test de humo obligatorio**: Test específico que garantiza que `fase_efectiva` es SIEMPRE un objeto, incluso cuando la configuración es inválida o hay errores.

### Technical Details
- `progress-engine.js`: Todos los fallbacks ahora retornan objeto estructurado `{id, nombre, reason?}` en lugar de strings
- `student-context.js`: Maneja `fase_efectiva` como objeto con compatibilidad hacia atrás para código legacy
- `tests/progress-engine.test.js`: Tests actualizados para verificar contrato de objeto y nuevo test de humo añadido
- `PROGRESO_V4_ENTREGA.md`: Actualizado a v4.8.0 con notas sobre nomenclatura y decisiones arquitectónicas
- `CHANGELOG.md`: Bloque [Unreleased] movido a [4.8.0] - 2024-12-19

### Breaking Changes
- **NINGUNO**: Los cambios son internos y mantienen compatibilidad. `student-context.js` extrae `fase_efectiva.nombre` para código legacy que espera string.

---

## [4.7.0] - 2024-12-XX

### Added
- **UI & Experience System v1**: Sistema completo de UI & Experience con Themes, Screens, Layers y Conversation Scripts
- **Migraciones SQL**: Tablas `ui_themes`, `ui_screens`, `ui_layers`, `ui_conversation_scripts`, `ui_active_config` en PostgreSQL
- **Repositorios UI**: Contratos e implementaciones PostgreSQL para todos los repositorios UI
- **Feature flags UI**: `ui_experience_v1`, `ui_guided_conversation_v1`, `ui_transition_layer_v1`, `ui_custom_extension_v1` (todos en 'off' por defecto)
- **LayerRegistry y ComponentRegistry**: Sistema de extensibilidad que permite registrar nuevos layer_type y component_type sin tocar el engine
- **UI Engine**: Núcleo del sistema con `resolveActiveConfig`, `loadScreen`, `loadTheme`, `applyLayers`, `renderComponents`, `processScreen`
- **Layers v1 mínimas**:
  - `transition_background_v1`: Layer simple de transición de fondo (CSS/HTML)
  - `guided_conversation_v1`: Layer conversacional con Aurelín (overlay con scripts versionados)
  - `custom_extension_v1`: Escape hatch controlado con guardarraíles (CSS/JS/HTML sanitizado)
- **Sistema de hooks**: API de plugins con hooks `beforeRender`, `decorateHtml`, `injectHead`, `injectBodyTop`, `injectBodyBottom`, `onClientBootstrap`
- **Fail-open garantizado**: Si un layer falla, se ignora y se registra log/audit/analytics (no rompe pantallas)
- **Versionado completo**: Todo es versionable, previsualizable y reversible
- **Analytics integrado**: Tracking automático de `screen_viewed` con theme_key, layer_keys y versions
- **Audit integrado**: Registro de activación de `UI_CUSTOM_EXTENSION_ACTIVATED` y errores de layers

### Changed
- **Feature flags**: Añadidos flags UI con estado inicial 'off' (comportamiento actual intacto)
- **Sistema extensible**: El sistema NUNCA se cierra; permite añadir cualquier nueva funcionalidad mediante plugins

### Technical Details
- Migración SQL: `database/migrations/v4.7.0-create-ui-experience-system.sql`
- Tablas con versionado: `theme_key + version`, `screen_key + version`, `layer_key + version`, `script_key + version`
- Configuración por entorno: `ui_active_config` con `env` (dev/beta/prod) para activar themes y layers
- Validación y truncamiento: Todos los repos validan y truncan datos si exceden límites (tokens 64KB, definitions 256KB, configs 128KB)
- Security limits: `custom_extension_v1` tiene límites estrictos (CSS 10KB, JS 5KB, HTML 5KB) y sanitización básica
- Auto-registro de layers: Los layers se auto-registran al importar `src/core/ui-experience/layers/index.js`
- Fail-open en todos los niveles: engine, layers, components, repos

### Security
- Validación estricta de configs en layers
- Sanitización básica de CSS/JS/HTML en `custom_extension_v1`
- Límites de tamaño estrictos para escape hatch
- Audit de activación de custom extensions
- No se permite código peligroso (eval, Function, setTimeout, etc.)

### Extensibility
- **LayerRegistry**: Permite registrar nuevos `layer_type` sin tocar el engine
- **ComponentRegistry**: Permite registrar nuevos `component_type` sin refactor
- **Hooks composables**: Los hooks se ejecutan por priority y son opcionales
- **Escape hatch**: `custom_extension_v1` garantiza que nunca quedes bloqueado (con guardarraíles)

---

## [4.6.0] - 2024-12-XX

### Added
- **Analytics Spine v1**: Sistema de recogida de eventos robusta y reutilizable, preparada para futuros módulos (progreso, prácticas, funnels) y para IA basada en datos
- **Tabla analytics_events**: Tabla append-only en PostgreSQL para eventos de analytics (client y server) con índices optimizados
- **Repositorio de analytics**: Contrato `src/core/repos/analytics-repo.js` e implementación `src/infra/repos/analytics-repo-pg.js`
- **Feature flag analytics_v1**: Control de activación del sistema de analytics (off/beta/on)
- **Helper trackServerEvent**: Función `src/core/analytics/track.js` para tracking de eventos desde el servidor con enriquecimiento automático
- **Endpoint de ingesta cliente**: `POST /analytics/collect` para recibir eventos desde el cliente con validación estricta
- **Admin READ-ONLY de analytics**: Nueva sección `/admin/analytics/events` con últimos N eventos y filtros (event_name, actor_id, session_id, source, date range)
- **Tests unitarios**: Tests para repositorio de analytics y endpoint de ingesta

### Changed
- **Feature flags**: Añadido flag `analytics_v1` con estado inicial 'off' (comportamiento actual intacto)

### Technical Details
- Migración SQL: `database/migrations/v4.6.0-create-analytics-events.sql`
- Tabla `analytics_events` con campos: `event_id` (UUID), `request_id`, `actor_type`, `actor_id`, `session_id`, `source`, `event_name`, `path`, `screen`, `app_version`, `build_id`, `props` (JSONB)
- Índices: `created_at DESC`, `event_name`, `actor_id`, `session_id`, `request_id`, `source`, compuestos para consultas comunes
- Validación estricta: `event_name` solo permite `[a-z0-9_:.-]`, máximo 80 caracteres; `props` máximo 16KB
- Rate limit básico: 100 requests/minuto por IP (TODO: implementar rate limit robusto)
- Fail-open: Si analytics falla, no bloquea UX (responde 204 pero loguea error)
- Sin PII: Prohibido email, nombre, texto libre sin sanitizar en analytics

### Security
- Validación estricta de entrada en endpoint de ingesta
- Sanitización automática de campos de texto
- Truncamiento automático de props si exceden 16KB
- Rate limiting básico por IP para prevenir spam
- No se almacenan datos sensibles (PII) en analytics_events

---

## [4.5.0] - 2024-12-XX

### Added
- **Correlation IDs (Request IDs)**: Sistema de trazabilidad con `src/core/request-id.js` que usa header `x-request-id` si existe, o genera uno seguro
- **Logger estructurado mejorado**: Redaction automática de secretos (authorization, cookie, token, password, secret, apiKey, refreshToken) case-insensitive
- **Audit Log PostgreSQL**: Tabla `audit_log` append-only para eventos de auditoría con índices optimizados
- **Repositorio de auditoría**: Contrato `src/core/repos/audit-repo.js` e implementación `src/infra/repos/audit-repo-pg.js`
- **Integración de auditoría en flujos críticos**:
  - `SUBSCRIPTION_BLOCKED_PRACTICE` y `SUBSCRIPTION_ALLOWED_PRACTICE` en `suscripcion-v4.js`
  - `AUTH_CONTEXT_FAIL` en `auth-context.js` (sin datos sensibles)
  - `FLAG_EVALUATED` en `feature-flags.js` para flags críticos (suscripcion_control_v2)
- **UI de error genérico**: Pantalla `src/core/html/error.html` con requestId visible (sin stacktrace en producción)
- **Admin READ-ONLY de auditoría**: Nueva sección `/admin/auditoria` con últimos 200 eventos y filtros por `event_type` y `actor_id`
- **Tests unitarios**: Tests para redaction del logger y repositorio de auditoría

### Changed
- **`requireStudentContext()` y `requireAdminContext()`**: Ahora incluyen `requestId` en el contexto retornado
- **`server.js`**: Usa `initRequestContextWithId()` para inicializar request context con header `x-request-id`
- **Logger**: Redacta automáticamente campos sensibles antes de loguear
- **Audit events**: Incluyen automáticamente `APP_VERSION` y `BUILD_ID` en el campo `data`

### Technical Details
- Migración SQL: `database/migrations/v4.5.0-create-audit-log.sql`
- Tabla `audit_log` con índices: `created_at DESC`, `event_type`, `actor_id`, `request_id`, `severity`
- Validación y truncamiento automático de datos si exceden 16KB
- Fail-open: Si el audit falla, no bloquea el flujo principal
- Sin exposición de secretos en logs ni eventos de auditoría

### Security
- Redaction automática de secretos en logs
- No se loguean headers completos en producción
- Validación de entrada en repositorio de auditoría
- Tabla audit_log es append-only (no UPDATE ni DELETE)

---

## [4.4.0] - 2024-12-XX

### Added
- **Control real de suscripción en PostgreSQL**: Implementación completa del sistema de control de suscripciones con feature flag `suscripcion_control_v2`
- **Repositorio de suscripciones**: Nuevo repositorio `subscription-repo-pg.js` que encapsula operaciones de suscripciones
- **Lógica de bloqueo**: `gestionarEstadoSuscripcion()` y `puedePracticarHoy()` ahora evalúan estado real desde PostgreSQL y pausas activas
- **UI de bloqueo mejorada**: Pantalla clara cuando la suscripción está pausada, con mensaje explicativo y botón deshabilitado
- **Admin READ-ONLY de suscripciones**: Nueva sección `/admin/suscripciones` para buscar alumno por email y ver estado de suscripción y pausas activas
- **Tests unitarios**: Tests básicos para `suscripcion-v4.js` verificando diferentes estados y compatibilidad con feature flags
- **Observabilidad**: `logWarn` cuando se bloquea práctica por suscripción (código `sub_paused` para métricas futuras)

### Changed
- **Feature flag `suscripcion_control_v2`**: Ahora controla la ejecución de la nueva lógica de suscripciones
  - `off`: Comportamiento actual (permite como antes)
  - `beta`: Usa lógica nueva solo en dev/beta
  - `on`: Usa lógica nueva en todos los entornos
- **`gestionarEstadoSuscripcion()`**: Retorna objeto estructurado con `{ status, pausada, reason, canPractice, effectiveUntil? }`
- **`puedePracticarHoy()`**: Usa nueva lógica cuando el flag está activo, bloquea práctica si `status === 'pausada' || status === 'cancelada' || status === 'past_due'`
- **Pantalla 1**: Mejora visual cuando suscripción está pausada, con mensaje claro y CTA para contactar soporte

### Technical Details
- Usa tabla `alumnos.estado_suscripcion` como fuente de verdad principal
- Integra con tabla `pausas` para evaluar pausas activas
- Crea estado default 'activa' si no existe (sin romper onboarding)
- Operaciones multi-tabla ejecutadas en transacciones cuando aplica
- Sin imports SQLite en runtime (cumple con principios inmutables)

### Security
- No expone secretos en logs
- Validación de entrada en repositorio
- Fail-open en caso de error (permite acceso para no bloquear usuarios)

---

## [4.3.1] - 2024-12-14

### Fixed
- **Runtime blindado**: Ninguna ruta expuesta usa SQLite/legacy (database/db.js)
- **Endpoints legacy delegados**: `/typeform-webhook` legacy ahora delega completamente a v4
- **Endpoints legacy deshabilitados**: `/sync-clickup-sql`, `/sync-all-clickup-sql`, `/sql-admin` responden 410 Gone
- **Migración de módulos**: `limpieza-handler.js` ahora usa `streak-v4.js` en lugar de `streak.js` legacy
- **Auditoría automática**: Script `audit:no-sqlite` previene reintroducción de imports SQLite en rutas runtime

### Added
- Helper `src/core/http/gone.js` para deshabilitar endpoints legacy con 410 Gone
- Script `scripts/audit-no-sqlite.js` para auditoría CI/local anti-SQLite
- Tests de humo para verificar delegación y deshabilitación de endpoints legacy
- NPM script `audit:no-sqlite` para ejecutar auditoría

### Changed
- `typeform-webhook.js` (legacy) ahora delega completamente a `typeform-webhook-v4.js`
- `limpieza-handler.js` migrado de `streak.js` a `streak-v4.js`
- Endpoints de sincronización SQLite deshabilitados con mensajes claros

### Security
- Rutas runtime completamente libres de dependencias SQLite legacy
- Endpoints legacy sin equivalente v4 explícitamente deshabilitados (410 Gone)

---

## [4.3.0] - 2024-12-14

### Added
- Sistema de versionado SemVer implementado
- CI/CD configurado con tests en Node 18.x y 20.x
- Rama main protegida con PRs obligatorios
- Flujo de trabajo Git documentado
- Script automatizado de release (`scripts/release.sh`)
- Documentación completa de versionado (`VERSIONADO_Y_RELEASES.md`)
- Guía rápida de releases (`RELEASE_QUICK_GUIDE.md`)

---

## [4.3.0] - 2024-12-14

### Added
- Sistema de versionado SemVer implementado
- CI/CD configurado con tests en Node 18.x y 20.x
- Rama main protegida con PRs obligatorios
- Flujo de trabajo Git documentado
- Script automatizado de release (`scripts/release.sh`)
- Documentación completa de versionado (`VERSIONADO_Y_RELEASES.md`)
- Guía rápida de releases (`RELEASE_QUICK_GUIDE.md`)

### Changed
- Migración a estructura de proyecto mejorada
- Actualización de dependencias
- Versión actualizada en package.json (4.0.0 → 4.3.0)

---

## [4.0.0] - 2024-01-XX

### Added
- Versión base de AuriPortal v4
- Integración con Kajabi API
- Integración con ClickUp API
- Sistema de sincronización automática
- Gestión de estudiantes y rachas de práctica
- Panel de administración

---

[Unreleased]: https://github.com/TU_USUARIO/auriportal/compare/v4.3.0...HEAD
[4.3.0]: https://github.com/TU_USUARIO/auriportal/compare/v4.0.0...v4.3.0
[4.0.0]: https://github.com/TU_USUARIO/auriportal/releases/tag/v4.0.0


