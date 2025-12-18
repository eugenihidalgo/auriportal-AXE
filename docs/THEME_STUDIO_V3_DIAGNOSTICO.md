# THEME STUDIO V3 — DIAGNÓSTICO COMPLETO

**Fecha:** 2025-01-XX  
**Objetivo:** Documentar estado actual del sistema de temas y justificar arquitectura v3

---

## 📋 RESUMEN EJECUTIVO

Theme Studio v3 es un sistema **SOBERANO y DESACOPLADO** del runtime real del alumno. No renderiza pantallas reales, no usa pipelines legacy (renderHtml, replace, regex), y produce artefactos válidos ThemeDefinition v1.

**Decisión estratégica:** v3 es una "isla técnica" autenticada que NO toca el runtime del alumno.

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS (POSTGRESQL)

### Tablas Existentes

**Migración:** `database/migrations/v5.2.0-create-themes-versioning.sql`

#### 1. `themes` (Tabla Principal)
- `id` TEXT PRIMARY KEY (slug técnico: "dark-classic", "light-classic")
- `name` TEXT NOT NULL (nombre legible)
- `status` TEXT NOT NULL DEFAULT 'draft' (draft/published/deprecated/archived)
- `current_draft_id` UUID (referencia al draft actual)
- `current_published_version` INT (versión publicada más reciente)
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**Índices:**
- `idx_themes_status` (búsqueda por status)

#### 2. `theme_drafts` (Drafts Editables)
- `draft_id` UUID PRIMARY KEY
- `theme_id` TEXT NOT NULL (FK a themes)
- `definition_json` JSONB NOT NULL (ThemeDefinition completa)
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- `updated_by` TEXT (auditoría)

**Índices:**
- `idx_theme_drafts_theme_id`
- `idx_theme_drafts_definition_gin` (GIN para búsquedas JSONB)

#### 3. `theme_versions` (Versiones Inmutables)
- `theme_id` TEXT NOT NULL
- `version` INT NOT NULL
- `status` TEXT NOT NULL DEFAULT 'published' (published/deprecated)
- `definition_json` JSONB NOT NULL (INMUTABLE)
- `release_notes` TEXT
- `created_at` TIMESTAMPTZ
- `created_by` TEXT (auditoría)
- PRIMARY KEY (theme_id, version)

**Índices:**
- `idx_theme_versions_theme_version`
- `idx_theme_versions_status`

#### 4. `theme_audit_log` (Auditoría)
- `id` UUID PRIMARY KEY
- `theme_id` TEXT NOT NULL
- `draft_id` UUID
- `action` TEXT NOT NULL (create_theme, update_draft, publish_version, etc.)
- `details_json` JSONB
- `created_at` TIMESTAMPTZ
- `created_by` TEXT

**Índices:**
- `idx_theme_audit_log_theme_id`
- `idx_theme_audit_log_action`
- `idx_theme_audit_log_created_at`

**Conclusión:** Las tablas están bien estructuradas y NO necesitan cambios para v3.

---

## 🔌 ENDPOINTS EXISTENTES (LEGACY)

### Endpoints API (`/admin/api/themes/*`)

**Archivo:** `src/endpoints/admin-themes-api.js`  
**Autenticación:** `requireAdminContext()`

#### 1. `GET /admin/api/themes`
- **Función:** `handleListThemes()`
- **Respuesta:** `{ themes: [{id, name, status, current_published_version, updated_at}] }`
- **Estado:** ✅ Funcional, puede reusarse

#### 2. `POST /admin/api/themes`
- **Función:** `handleCreateTheme()`
- **Body:** `{ id, name }`
- **Respuesta:** `{ theme: {...}, draft: {...} }`
- **Estado:** ✅ Funcional, puede reusarse

#### 3. `GET /admin/api/themes/:id`
- **Función:** `handleGetTheme()`
- **Respuesta:** `{ theme: {...}, draft: {...}, published_version: {...} }`
- **Estado:** ✅ Funcional, puede reusarse

#### 4. `PUT /admin/api/themes/:id/draft`
- **Función:** `handleUpdateDraft()`
- **Body:** `{ definition_json }`
- **Validación:** `validateThemeDefinitionDraft()` (tolerante)
- **Estado:** ✅ Funcional, puede reusarse

#### 5. `POST /admin/api/themes/:id/publish`
- **Función:** `handlePublish()`
- **Body:** `{ release_notes? }`
- **Validación:** `validateThemeDefinition()` (estricta)
- **Estado:** ✅ Funcional, puede reusarse

#### 6. `POST /admin/api/themes/:id/preview`
- **Función:** `handlePreview()`
- **Problema:** ❌ Usa `renderHtml()` y pipelines legacy (renderiza pantallas reales)
- **Estado:** ⚠️ NO se usará en v3

### Endpoints UI (`/admin/themes/*`)

**Archivo:** `src/endpoints/admin-themes.js`  
**Autenticación:** `requireAdminAuth()` (legacy)

#### 1. `GET /admin/themes`
- **Función:** Listado de temas (HTML)
- **Estado:** ⚠️ Legacy, NO se usará en v3

#### 2. `GET /admin/themes/:id/edit`
- **Función:** Editor HTML con iframe y postMessage
- **Archivo:** `src/core/html/admin/themes/themes-editor.html`
- **Problema:** ❌ Usa iframe + postMessage, depende de preview legacy
- **Estado:** ⚠️ NO se usará en v3

#### 3. `GET /admin/themes/preview`
- **Función:** Preview con parámetros (theme_id, screen, theme_draft)
- **Problema:** ❌ Renderiza pantallas reales del alumno
- **Estado:** ⚠️ NO se usará en v3

#### 4. `GET /admin/themes/preview-canonical`
- **Función:** Preview canónico (componentes genéricos)
- **Archivo:** `src/core/html/theme-preview-canonical.html`
- **Estado:** ✅ Puede reusarse como referencia visual, pero v3 tendrá su propio preview inline

### Theme Studio v2 (`/admin/themes/studio`)

**Archivo:** `src/endpoints/admin-themes-studio-ui.js`  
**Autenticación:** `requireAdminContext()`

- **Problema:** ❌ Usa `renderHtml()`, iframe, postMessage, pantallas reales
- **Estado:** ⚠️ NO se usará en v3

---

## 🐛 PROBLEMAS IDENTIFICADOS (LEGACY)

### 1. **Errores 500 Intermitentes**
- **Causa:** Pipelines legacy (renderHtml, replace, regex) fallan con tokens inválidos
- **Ubicación:** `src/endpoints/admin-themes.js`, `src/endpoints/admin-themes-studio-ui.js`
- **Solución v3:** NO usar renderHtml ni pipelines legacy

### 2. **Errores de RegExp**
- **Causa:** Reemplazos de tokens con regex complejos que fallan con valores inesperados
- **Ubicación:** Pipelines de renderizado legacy
- **Solución v3:** NO usar regex para tokens; usar CSS variables directamente

### 3. **Previews No Confiables**
- **Causa:** Previews renderizan pantallas reales del alumno (topic-screen, etc.) que dependen de datos reales
- **Ubicación:** `/admin/themes/preview?screen=...`
- **Solución v3:** Preview Playground CANÓNICO con componentes genéricos (no pantallas reales)

### 4. **Acoplamiento con Runtime**
- **Causa:** Editor legacy usa `renderHtml()`, `inject_main.js`, `typeform`, pantallas reales
- **Ubicación:** Múltiples archivos
- **Solución v3:** Isla HTML autónoma sin dependencias del runtime

---

## ✅ COMPONENTES REUSABLES (PARA V3)

### 1. **Repositorios PostgreSQL**
- ✅ `src/infra/repos/theme-repo-pg.js` (ThemeRepoPg)
- ✅ `src/infra/repos/theme-draft-repo-pg.js` (ThemeDraftRepoPg)
- ✅ `src/infra/repos/theme-version-repo-pg.js` (ThemeVersionRepoPg)
- **Estado:** Reusables sin cambios

### 2. **Validación**
- ✅ `src/core/theme/theme-definition-contract.js` (validateThemeDefinition, validateThemeDefinitionDraft)
- ✅ `src/core/theme/theme-contract.js` (validateThemeValues, getAllContractVariables)
- ✅ `src/core/theme/theme-defaults.js` (CONTRACT_DEFAULT, SYSTEM_DEFAULT)
- **Estado:** Reusables sin cambios

### 3. **Autenticación**
- ✅ `src/core/auth-context.js` (requireAdminContext)
- **Estado:** Reusable sin cambios

### 4. **Endpoints API**
- ✅ `GET /admin/api/themes` (listar)
- ✅ `POST /admin/api/themes` (crear)
- ✅ `GET /admin/api/themes/:id` (obtener)
- ✅ `PUT /admin/api/themes/:id/draft` (guardar draft)
- ✅ `POST /admin/api/themes/:id/publish` (publicar)
- **Estado:** Reusables, pero v3 creará endpoints nuevos `/admin/api/themes-v3/*` para claridad

---

## 🚫 COMPONENTES QUE NO SE USARÁN EN V3

### 1. **Renderizado Legacy**
- ❌ `renderHtml()` (src/core/responses.js)
- ❌ Pipelines de replace/regex para tokens
- ❌ `inject_main.js`
- ❌ Typeform integration en previews

### 2. **Endpoints Legacy**
- ❌ `GET /admin/themes/preview` (renderiza pantallas reales)
- ❌ `POST /admin/api/themes/:id/preview` (usa renderHtml)
- ❌ `GET /admin/themes/:id/edit` (editor legacy con iframe)

### 3. **UI Legacy**
- ❌ `src/core/html/admin/themes/themes-editor.html` (iframe + postMessage)
- ❌ `src/endpoints/admin-themes-studio-ui.js` (renderHtml, pantallas reales)

---

## 📐 ARQUITECTURA V3 (NUEVA)

### Principios
1. **Isla Soberana:** HTML autónomo sin dependencias del runtime
2. **Preview Canónico:** Componentes genéricos (card, button, input, etc.) NO pantallas reales
3. **CSS Directo:** Tokens inyectados en `<style id="ap-theme-tokens">` sin regex
4. **Estado Canónico:** `window.themeState` único y centralizado
5. **Fail-Open:** Errores no tumban el editor, solo muestran mensajes

### Endpoints Nuevos (`/admin/api/themes-v3/*`)
- `GET /admin/api/themes-v3/list` → Lista temas
- `POST /admin/api/themes-v3/create` → Crea tema + draft
- `GET /admin/api/themes-v3/:themeId/load` → Carga draft/published/default
- `POST /admin/api/themes-v3/:themeId/save-draft` → Guarda draft
- `POST /admin/api/themes-v3/:themeId/publish` → Publica versión
- `POST /admin/api/themes-v3/:themeId/duplicate` → Duplica tema
- `POST /admin/api/themes-v3/:themeId/archive` → Archiva tema
- `DELETE /admin/api/themes-v3/:themeId/draft` → Elimina draft

### UI Nueva (`/admin/themes/studio-v3`)
- **Archivo:** `src/admin/theme-studio-v3/index.html` (HTML5 limpio)
- **JS:** `src/admin/theme-studio-v3/theme-studio-v3.js`
- **CSS:** `src/admin/theme-studio-v3/theme-studio-v3.css`
- **Layout:** 3 columnas (Librería | Preview | Controles)
- **Preview:** Componentes genéricos inline (NO iframe, NO postMessage)

---

## 🔍 VALIDACIÓN ThemeDefinition v1

### Contrato Mínimo
```json
{
  "schema_version": 1,
  "tokens": {
    "--bg-main": "#...",
    "--bg-card": "#...",
    "--text-primary": "#...",
    ...
  }
}
```

### Reglas de Validación
- `schema_version === 1` (requerido)
- `tokens` es objeto (requerido)
- Keys deben empezar por `"--"` (requerido)
- Values son string no vacía (requerido)
- NO regex rara: usar `startsWith()`, `typeof`, validaciones simples

### Validación Existente
- ✅ `validateThemeDefinition()` (estricta, para publish)
- ✅ `validateThemeDefinitionDraft()` (tolerante, para drafts)
- **Estado:** Reusable sin cambios

---

## 📊 ESTADO ACTUAL DE TABLAS

### Verificación Requerida
```sql
-- Verificar estructura de themes
\d themes

-- Verificar estructura de theme_drafts
\d theme_drafts

-- Verificar estructura de theme_versions
\d theme_versions

-- Verificar índices
\di
```

**Nota:** Si las tablas ya existen y tienen la estructura correcta, NO se necesita migración nueva.

---

## 🎯 DECISIONES ESTRATÉGICAS (FIJAS)

1. **v3 NO toca runtime del alumno:** No renderiza pantallas reales
2. **v3 NO usa pipelines legacy:** No renderHtml, no replace, no regex
3. **v3 es isla HTML autónoma:** Sin base.html legacy, sin inject_main.js
4. **v3 reusa backend:** Mismas tablas, mismos repos, pero endpoints nuevos para claridad
5. **v3 preview canónico:** Componentes genéricos inline, NO iframe

---

## 📝 NOTAS FINALES

- **Migración:** Si las tablas ya existen, NO crear migración nueva
- **Endpoints:** Crear `/admin/api/themes-v3/*` nuevos para claridad (pero reusar lógica de backend)
- **UI:** Crear completamente nueva en `src/admin/theme-studio-v3/`
- **Preview:** Inline en la misma página, NO iframe, NO postMessage
- **Validación:** Reusar funciones existentes sin cambios

---

**Siguiente paso:** Implementar FASE 1 (verificación de tablas) y FASE 2 (endpoints v3).

