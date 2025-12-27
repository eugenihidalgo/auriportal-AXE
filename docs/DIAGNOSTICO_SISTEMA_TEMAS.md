# DIAGNÓSTICO TOTAL DEL SISTEMA DE TEMAS — AURIPORTAL

**Fecha de diagnóstico:** 2025-01-XX  
**Modo:** Arquitectura Forense (Solo Documentación)  
**Alcance:** Sistema completo de temas de AuriPortal

---

## RESUMEN EJECUTIVO

El sistema de temas de AuriPortal presenta una **arquitectura híbrida** con componentes **válidos y aprovechables**, pero también con **ambigüedades estructurales** y **puntos de ruptura** que impiden su consolidación como columna vertebral del producto.

**Estado general:** ⚠️ **AMBIGUO CON RIESGOS**

- ✅ **Válido:** Theme Resolver v1, Theme Contract v1, sistema de versionado (DRAFT/PUBLISH)
- ⚠️ **Ambiguo:** Persistencia dual (2 tablas), aplicación visual parcial, preview inconsistente
- ❌ **Roto:** Editor no garantiza coherencia, falta integración con runtime real, hardcodes residuales

---

## 1) ENTIDAD / CONTRATO

### ¿Existe una entidad clara llamada "Theme"?

**Respuesta:** ✅ **SÍ, pero con ambigüedad estructural**

#### Definición Formal (ThemeDefinition v1)

**Ubicación:** `src/core/theme/theme-definition-contract.js`

```javascript
{
  id: string,           // ID único (ej: 'dark-classic', 'custom-theme-1')
  name: string,         // Nombre legible
  description?: string, // Opcional
  tokens: Object,       // Mapa completo de variables CSS (requerido)
  meta?: Object        // Metadata opcional
}
```

**Validación:**
- `validateThemeDefinition()` - Estricta para publish
- `validateThemeDefinitionDraft()` - Tolerante para drafts
- `normalizeThemeDefinition()` - Normaliza y rellena faltantes

**Estado:** ✔ **VÁLIDO** - Contrato bien definido y validado

#### Contrato de Variables CSS (Theme Contract v1)

**Ubicación:** `src/core/theme/theme-contract.js`

**Variables canónicas:** 102 variables CSS definidas en `CONTRACT_VARIABLES`
- Fondos: `--bg-main`, `--bg-primary`, `--bg-card`, etc. (15 variables)
- Textos: `--text-primary`, `--text-secondary`, etc. (8 variables)
- Bordes: `--border-soft`, `--border-strong`, etc. (6 variables)
- Acentos: `--accent-primary`, `--accent-secondary`, etc. (7 variables)
- Sombras: `--shadow-sm`, `--shadow-md`, etc. (5 variables)
- Gradientes: `--gradient-primary`, `--aura-gradient`, etc. (8 variables)
- Badges: `--badge-bg-active`, `--badge-text-active`, etc. (6 variables)
- Inputs: `--input-bg`, `--input-border`, etc. (4 variables)
- Botones: `--button-text-color` (1 variable)
- Radios: `--radius-sm`, `--radius-md`, etc. (5 variables)
- Compatibilidad: `--card-bg`, `--card-bg-active` (2 variables)

**Estado:** ✔ **VÁLIDO** - Lista canónica completa y verificable

#### Valores por Defecto

**Ubicación:** `src/core/theme/theme-defaults.js`

- `CONTRACT_DEFAULT`: Valores de emergencia (fail-open absoluto)
- `SYSTEM_DEFAULT`: Temas base del sistema (`light-classic`, `dark-classic`)
- `LEGACY_THEME_MAP`: Mapeo `'dark'` → `'dark-classic'`, `'light'` → `'light-classic'`

**Estado:** ✔ **VÁLIDO** - Fallbacks deterministas garantizados

### ¿Dónde está definida?

**Respuesta:** ⚠️ **MÚLTIPLES UBICACIONES (AMBIGUEDAD)**

1. **Contrato formal:** `src/core/theme/theme-definition-contract.js` (ThemeDefinition)
2. **Variables CSS:** `src/core/theme/theme-contract.js` (CONTRACT_VARIABLES)
3. **Valores por defecto:** `src/core/theme/theme-defaults.js` (CONTRACT_DEFAULT, SYSTEM_DEFAULT)
4. **Temas del sistema:** `src/core/theme/system-themes.js` (LIGHT_CLASSIC_DEFINITION, DARK_CLASSIC_DEFINITION, AURI_CLASSIC_DEFINITION)
5. **Registry:** `src/core/theme/theme-registry.js` (cache de temas)

**Problema:** No hay un único punto de verdad. El contrato está disperso.

### ¿Qué campos reales tiene hoy?

**Respuesta:** ✅ **DOCUMENTADO**

**ThemeDefinition (contrato):**
- `id` (string, requerido)
- `name` (string, requerido)
- `description` (string, opcional)
- `tokens` (Object, requerido) - 102 variables CSS
- `meta` (Object, opcional)

**En base de datos (themes):**
- `id` (TEXT, PK)
- `name` (TEXT)
- `status` (TEXT: 'draft', 'published', 'deprecated', 'archived')
- `current_draft_id` (UUID, FK a theme_drafts)
- `current_published_version` (INT)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**En base de datos (theme_drafts):**
- `draft_id` (UUID, PK)
- `theme_id` (TEXT, FK)
- `definition_json` (JSONB) - ThemeDefinition completa
- `updated_at`, `updated_by` (TIMESTAMPTZ, TEXT)

**En base de datos (theme_versions):**
- `theme_id` (TEXT, FK)
- `version` (INT)
- `status` (TEXT: 'published', 'deprecated')
- `definition_json` (JSONB) - ThemeDefinition INMUTABLE
- `release_notes` (TEXT, opcional)
- `created_at`, `created_by` (TIMESTAMPTZ, TEXT)

### ¿Hay un schema explícito o implícito?

**Respuesta:** ✅ **EXPLÍCITO (con validación)**

**Schema explícito:**
- JavaScript: `validateThemeDefinition()` valida estructura
- Base de datos: Migraciones SQL definen estructura (`v5.2.0-create-themes-versioning.sql`)
- TypeScript types: `src/core/theme/theme-types.js` (si existe)

**Validación:**
- Draft: `validateThemeDefinitionDraft()` - Tolerante (solo errores críticos)
- Publish: `validateThemeDefinition()` - Estricta (bloquea si hay errores)

**Estado:** ✔ **VÁLIDO** - Schema explícito y validado

### ¿Qué cosas "forman parte del tema" aunque no estén formalizadas?

**Respuesta:** ⚠️ **AMBIGUO**

**Formalizado:**
- Variables CSS (102 variables en CONTRACT_VARIABLES)
- Metadata (meta object)

**No formalizado pero usado:**
- `data-theme` attribute en HTML (`<html data-theme="dark">`)
- Clase `theme-dark` en `<body>` (para modo oscuro)
- Script inline de activación temprana (en `applyTheme()`)
- Links a CSS: `theme-contract.css`, `theme-variables.css`, `theme-overrides.css`

**Hardcodes residuales:**
- Algunos templates HTML tienen colores directos (no variables)
- `meta name="theme-color"` hardcodeado en algunos templates
- Gradientes inline en algunos componentes

**Estado:** ⚠️ **AMBIGUO** - Hay elementos visuales que "forman parte del tema" pero no están en el contrato

---

## 2) PERSISTENCIA

### ¿Dónde se guardan los temas?

**Respuesta:** ⚠️ **DUAL (AMBIGUEDAD ESTRUCTURAL)**

#### Tabla 1: `theme_definitions` (Legacy v4.13.0)

**Migración:** `v4.13.0-create-theme-definitions.sql`

**Estructura:**
```sql
CREATE TABLE theme_definitions (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  contract_version VARCHAR(10) DEFAULT 'v1',
  values JSONB NOT NULL DEFAULT '{}',
  source VARCHAR(20) DEFAULT 'custom',
  meta JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active'
);
```

**Uso actual:** ⚠️ **NO CLARO** - Tabla existe pero no se usa en el código nuevo

#### Tabla 2: `themes` + `theme_drafts` + `theme_versions` (v5.2.0)

**Migración:** `v5.2.0-create-themes-versioning.sql`

**Estructura:**
- `themes`: Tabla principal (id, name, status, current_draft_id, current_published_version)
- `theme_drafts`: Drafts editables (draft_id, theme_id, definition_json)
- `theme_versions`: Versiones publicadas INMUTABLES (theme_id, version, definition_json)

**Uso actual:** ✅ **ACTIVO** - Sistema nuevo con versionado

**Repositorios:**
- `src/infra/repos/theme-repo-pg.js` - ThemeRepoPg
- `src/infra/repos/theme-draft-repo-pg.js` - ThemeDraftRepoPg
- `src/infra/repos/theme-version-repo-pg.js` - ThemeVersionRepoPg

**Estado:** ⚠️ **AMBIGUO** - Hay 2 sistemas de persistencia. No está claro cuál es la fuente de verdad.

### ¿Qué se guarda EXACTAMENTE al pulsar "guardar" en el editor?

**Respuesta:** ⚠️ **DEPENDE DEL ESTADO**

#### Flujo de Guardado (Editor UI)

**Ubicación:** `src/endpoints/admin-themes-ui.js` (líneas 643-703)

**Proceso:**
1. Usuario edita tema en editor (`/admin/themes/ui`)
2. Al hacer submit, se llama a `guardarTema()`
3. Si `currentTheme.id` existe → `PUT /admin/api/themes/:id` (actualizar)
4. Si no existe → `POST /admin/api/themes` (crear)

#### Endpoint API: Guardar Draft

**Ubicación:** `src/endpoints/admin-themes-api.js` (líneas 292-381)

**Proceso:**
1. `PUT /admin/api/themes/:id/draft` recibe `definition_json`
2. Valida con `validateThemeDefinitionDraft()` (tolerante)
3. Si hay draft existente → `updateDraft()`
4. Si no hay draft → `createDraft()`
5. Guarda en `theme_drafts.definition_json` (JSONB)

**Qué se guarda:**
```json
{
  "id": "custom-theme-1",
  "name": "Tema Personalizado",
  "description": "...",
  "tokens": {
    "--bg-main": "#faf7f2",
    "--text-primary": "#333333",
    // ... todas las 102 variables
  },
  "meta": {}
}
```

**Estado:** ✔ **VÁLIDO** - Guardado claro y validado

### ¿Hay diferencias entre draft / published?

**Respuesta:** ✅ **SÍ, EXPLÍCITO**

**Draft:**
- Tabla: `theme_drafts`
- Editable: ✅ SÍ
- Validación: Tolerante (`validateThemeDefinitionDraft()`)
- Uso en runtime: ❌ NO (no se usa en producción)
- Inmutable: ❌ NO (puede cambiar)

**Published:**
- Tabla: `theme_versions`
- Editable: ❌ NO (INMUTABLE)
- Validación: Estricta (`validateThemeDefinition()`)
- Uso en runtime: ✅ SÍ (usado por Theme Resolver)
- Inmutable: ✅ SÍ (nunca cambia después de publicar)

**Flujo:**
1. Crear/editar draft → `PUT /admin/api/themes/:id/draft`
2. Publicar → `POST /admin/api/themes/:id/publish`
3. Publish valida estrictamente y crea versión inmutable

**Estado:** ✔ **VÁLIDO** - Separación clara y bien implementada

### ¿Hay versionado?

**Respuesta:** ✅ **SÍ, COMPLETO**

**Sistema de versionado:**
- Tabla: `theme_versions`
- Campo: `version` (INT, empieza en 1)
- Inmutabilidad: Versiones publicadas NUNCA cambian
- Historial: `getAllVersions(theme_id)` devuelve todas las versiones

**Flujo:**
1. Primera publicación → version = 1
2. Siguiente publicación → version = latest_version + 1
3. Versiones deprecated: `status = 'deprecated'` (no se usan en runtime)

**Estado:** ✔ **VÁLIDO** - Versionado completo e inmutable

### ¿Hay soft delete?

**Respuesta:** ⚠️ **PARCIAL**

**Soft delete:**
- Campo `status` en `themes`: 'draft', 'published', 'deprecated', 'archived'
- `archived` = soft delete (no se usa pero se mantiene en BD)
- `deprecated` = versión obsoleta (no se usa en runtime)

**Problema:**
- No hay función explícita de "archivar tema"
- El editor tiene botón "Archivar" pero no está claro qué hace

**Estado:** ⚠️ **AMBIGUO** - Existe el concepto pero no está claro el flujo

### ¿Hay migraciones asociadas?

**Respuesta:** ✅ **SÍ**

**Migraciones:**
1. `v4.13.0-create-theme-definitions.sql` - Tabla legacy (2024)
2. `v5.2.0-create-themes-versioning.sql` - Sistema nuevo con versionado (2025)

**Estado:** ✔ **VÁLIDO** - Migraciones documentadas

---

## 3) RUNTIME (FUENTE DE VERDAD)

### ¿Qué función decide el tema final aplicado al usuario?

**Respuesta:** ✅ **Theme Resolver v1**

**Ubicación:** `src/core/theme/theme-resolver.js`

**Función principal:** `resolveTheme({ student, session, systemState, theme_id })`

**Lógica de resolución (orden de prioridad):**
1. Si `theme_id` está especificado → usarlo directamente (v1.1 - preview)
2. Si `student.tema_preferido` existe y es válido → usarlo (mapeando legacy si es necesario)
3. Si no → usar `system_default` ('dark-classic')
4. Intentar obtener tema del Theme Registry v1 (sistema + BD async)
5. Si registry falla o tema no existe → fallback a SYSTEM_DEFAULT
6. Validar que el tema tiene TODAS las variables
7. Si faltan → rellenar desde CONTRACT_DEFAULT
8. Si algo falla → fallback completo a CONTRACT_DEFAULT

**Estado:** ✔ **VÁLIDO** - Resolución determinista y fail-open

### ¿Qué inputs usa?

**Respuesta:** ✅ **DOCUMENTADO**

**Inputs del resolver:**
- `student` (Object|null): Objeto estudiante con `tema_preferido`
- `session` (Object|null): Datos de sesión (reservado para futuro)
- `systemState` (Object|null): Estado del sistema (reservado para futuro)
- `theme_id` (string|null): ID del tema a resolver directamente (v1.1 - preview)

**Mapeo legacy:**
- `student.tema_preferido = 'dark'` → `'dark-classic'`
- `student.tema_preferido = 'light'` → `'light-classic'`

**Estado:** ✔ **VÁLIDO** - Inputs claros y documentados

### ¿Qué ocurre si faltan valores?

**Respuesta:** ✅ **FALLBACK DETERMINISTA**

**Proceso de fallback:**
1. Resolver intenta obtener tema del registry
2. Si tema no existe → usar SYSTEM_DEFAULT[resolvedKey]
3. Si SYSTEM_DEFAULT no existe → usar CONTRACT_DEFAULT
4. Validar que tema tiene todas las variables
5. Si faltan variables → `fillMissingVariables()` desde CONTRACT_DEFAULT
6. Si validación final falla → usar CONTRACT_DEFAULT completo

**Función:** `fillMissingVariables()` en `theme-contract.js`

**Estado:** ✔ **VÁLIDO** - Fail-open absoluto garantizado

### ¿Existe fallback claro y determinista?

**Respuesta:** ✅ **SÍ, ABSOLUTO**

**Jerarquía de fallback:**
1. Tema solicitado (registry o BD)
2. SYSTEM_DEFAULT[resolvedKey]
3. CONTRACT_DEFAULT (valores de emergencia)

**Garantía:** El cliente NUNCA se rompe. Siempre hay un tema válido.

**Estado:** ✔ **VÁLIDO** - Fallback determinista y probado

---

## 4) APLICACIÓN VISUAL

### ¿Cómo se transforman los valores del tema en CSS real?

**Respuesta:** ⚠️ **MÚLTIPLES MECANISMOS (AMBIGUO)**

#### Mecanismo 1: CSS Variables (Inyección en HTML)

**Ubicación:** `src/core/responses.js` (función `applyTheme()`)

**Proceso:**
1. `resolveTheme()` obtiene tema efectivo
2. `applyTheme()` inyecta links a CSS:
   - `/css/theme-contract.css` (definiciones)
   - `/css/theme-variables.css` (valores del tema)
   - `/css/theme-overrides.css` (sobrescrituras)

**Problema:** ⚠️ Los valores del tema NO se inyectan directamente como CSS variables. Se espera que `theme-variables.css` tenga los valores hardcodeados.

**Estado:** ⚠️ **AMBIGUO** - No hay inyección dinámica de variables CSS desde el tema resuelto

#### Mecanismo 2: Script Inline (Activación Temprana)

**Ubicación:** `src/core/responses.js` (líneas 84-152)

**Proceso:**
1. Si tema es 'dark' → añade clase `theme-dark` a `<body>`
2. Script inline se ejecuta ANTES del render para evitar flash
3. Usa MutationObserver + DOMContentLoaded como fallback

**Estado:** ✔ **VÁLIDO** - Funciona pero es específico para dark/light

#### Mecanismo 3: Atributo data-theme

**Ubicación:** `src/core/responses.js` (líneas 72-79)

**Proceso:**
1. Reemplaza `{{TEMA_PREFERIDO}}` en HTML
2. Añade `data-theme="dark"` o `data-theme="light"` a `<html>`

**Problema:** ⚠️ Solo soporta 'dark'/'light', no temas personalizados

**Estado:** ⚠️ **AMBIGUO** - Limitado a temas legacy

### ¿Se usan CSS variables?

**Respuesta:** ✅ **SÍ, PERO NO DINÁMICAS**

**CSS Variables definidas:**
- `public/css/theme-contract.css` - Definiciones (sin valores)
- `public/css/theme-variables.css` - Valores hardcodeados para light/dark
- `public/css/theme-overrides.css` - Sobrescrituras específicas

**Problema:** ❌ Los valores del tema resuelto NO se inyectan como CSS variables dinámicamente. Se espera que `theme-variables.css` tenga los valores predefinidos.

**Estado:** ❌ **ROTO** - No hay conexión entre Theme Resolver y CSS variables dinámicas

### ¿Dónde se inyectan?

**Respuesta:** ⚠️ **PARCIAL**

**Inyección actual:**
- Links a CSS se inyectan en `<head>` (si no existen)
- Script inline se inyecta en `<head>` (para activación temprana)
- Clase `theme-dark` se añade a `<body>`

**Problema:** ❌ Las variables CSS del tema resuelto NO se inyectan. Solo se inyectan links a archivos CSS estáticos.

**Estado:** ❌ **ROTO** - Falta inyección dinámica de variables CSS

### ¿Qué vistas/pantallas NO pasan por el pipeline del tema?

**Respuesta:** ⚠️ **NO CLARO**

**Pantallas que SÍ pasan por `applyTheme()`:**
- `renderPantalla0()` - Pantalla de entrada
- `renderPantalla1()` - Pantalla principal (ritual diario)
- `renderPantalla2()` - Pantalla de hitos
- `renderPantalla3()` - Pantalla de tema específico
- `renderPantalla4()` - Pantalla de lista de temas

**Pantallas que NO están claras:**
- Admin panels (`/admin/*`)
- Editor de temas (`/admin/themes/ui`)
- Screen templates (si usan temas)

**Estado:** ⚠️ **AMBIGUO** - No hay auditoría completa de qué pantallas usan temas

### Identifica hardcodes (colores, fuentes, spacing, etc.)

**Respuesta:** ⚠️ **HARDCODES RESIDUALES**

**Hardcodes encontrados:**

1. **En templates HTML:**
   - `pantalla4.html`: `meta name="theme-color" content="#ffd86b"` (hardcodeado)
   - Algunos gradientes inline en componentes

2. **En CSS estático:**
   - `theme-variables.css` tiene valores hardcodeados (no dinámicos)
   - `theme-overrides.css` puede tener valores específicos

3. **En código JavaScript:**
   - Algunos componentes pueden tener colores directos

**Estado:** ⚠️ **AMBIGUO** - Hay hardcodes pero no hay auditoría completa

---

## 5) EDITOR DE TEMAS (ADMIN)

### ¿El editor edita una entidad real o un híbrido?

**Respuesta:** ⚠️ **HÍBRIDO**

**Editor UI:** `src/endpoints/admin-themes-ui.js`

**Qué edita:**
- Si tema existe → edita `theme_drafts.definition_json`
- Si tema es nuevo → crea tema + draft inicial

**Problema:** ⚠️ El editor muestra campos que pueden no corresponder exactamente con la estructura de BD:
- Muestra `key` (pero en BD es `id`)
- Muestra `values` (pero en BD es `definition_json.tokens`)
- Muestra `source` (pero no está claro si se guarda)

**Estado:** ⚠️ **AMBIGUO** - Editor edita híbrido entre UI y estructura de BD

### ¿Qué valida?

**Respuesta:** ✅ **VALIDACIÓN PARCIAL**

**Validación en editor:**
- Campos requeridos: `name`, `key` (validación HTML5)
- Variables CSS: Todas las 102 variables del contrato

**Validación en API:**
- `PUT /admin/api/themes/:id/draft` → `validateThemeDefinitionDraft()` (tolerante)
- `POST /admin/api/themes/:id/publish` → `validateThemeDefinition()` (estricta)

**Estado:** ✔ **VÁLIDO** - Validación existe pero no está completa en el editor

### ¿Qué NO valida?

**Respuesta:** ⚠️ **VARIOS ASPECTOS**

**No valida:**
- Formato de valores CSS (hex, rgb, etc.)
- Consistencia de colores (contraste, accesibilidad)
- Valores vacíos en variables (solo valida que existan)
- Duplicados de `key`/`id` (se valida en BD pero no en UI)

**Estado:** ⚠️ **AMBIGUO** - Validación básica pero no exhaustiva

### ¿Puede generar temas inválidos?

**Respuesta:** ⚠️ **SÍ, EN DRAFT**

**Draft:**
- Puede tener variables faltantes (se rellenan en runtime)
- Puede tener valores inválidos (no se valida formato)
- Puede tener errores estructurales (solo se valida estructura básica)

**Publish:**
- NO puede publicar si hay errores (validación estricta bloquea)

**Estado:** ⚠️ **AMBIGUO** - Drafts pueden ser inválidos, pero publish está protegido

### ¿Qué campos no tienen correspondencia real en runtime?

**Respuesta:** ⚠️ **VARIOS**

**Campos en editor que no se usan en runtime:**
- `description` - No se usa en runtime (solo metadata)
- `meta` - No se usa en runtime (solo metadata)
- `source` - No se usa en runtime (solo metadata)

**Campos en runtime que no están en editor:**
- `_resolvedKey` - Metadata interna del resolver
- `_resolvedFrom` - Metadata interna del resolver
- `_contractVersion` - Metadata interna del resolver

**Estado:** ⚠️ **AMBIGUO** - Hay campos que no tienen correspondencia clara

---

## 6) PREVIEW

### ¿El preview usa el mismo pipeline que producción?

**Respuesta:** ⚠️ **PARCIAL**

**Preview endpoint:** `POST /admin/api/themes/:id/preview`

**Ubicación:** `src/endpoints/admin-themes-api.js` (líneas 505-697)

**Proceso:**
1. Obtiene definición (draft o published)
2. Construye `mockStudent` con `tema_preferido = themeId`
3. Construye `mockCtx` (contexto mínimo)
4. Llama a `renderPantalla1(mockStudent, mockCtx)`
5. Resuelve tema con `resolveThemeAsync({ theme_id: themeId })`
6. Inyecta variables CSS en `<style>` tag
7. Aplica tema con `applyTheme(html, mockStudent, themeId)`

**Problema:** ⚠️ Preview inyecta variables CSS manualmente, pero producción NO lo hace. Hay diferencia.

**Estado:** ⚠️ **AMBIGUO** - Preview usa pipeline similar pero con inyección manual de CSS

### ¿O es un render paralelo/falso?

**Respuesta:** ✅ **USA PIPELINE REAL**

**Preview usa:**
- `resolveThemeAsync()` - Mismo resolver que producción
- `renderPantalla1()` - Misma función de render que producción
- `applyTheme()` - Misma función de aplicación que producción

**Diferencia:**
- Preview inyecta variables CSS manualmente (producción no)
- Preview usa `mockStudent` y `mockCtx` (producción usa datos reales)

**Estado:** ✔ **VÁLIDO** - Preview usa pipeline real con datos mock

### ¿Qué diferencias hay entre preview y runtime real?

**Respuesta:** ⚠️ **VARIAS DIFERENCIAS**

**Diferencias:**
1. **Inyección CSS:** Preview inyecta variables CSS manualmente, producción no
2. **Datos:** Preview usa `mockStudent` y `mockCtx`, producción usa datos reales
3. **Contexto:** Preview no tiene contexto completo (navegación, sidebar, etc.)
4. **Validación:** Preview no valida acceso, producción sí

**Estado:** ⚠️ **AMBIGUO** - Preview es similar pero no idéntico a producción

---

## 7) FEATURE FLAGS

### ¿Qué partes del sistema de temas están ON / BETA / OFF?

**Respuesta:** ⚠️ **NO HAY FEATURE FLAGS EXPLÍCITOS**

**Búsqueda:** No se encontraron feature flags relacionados con temas

**Estado:** ⚠️ **AMBIGUO** - No hay feature flags, todo está activo o no implementado

### ¿Hay código muerto?

**Respuesta:** ⚠️ **POSIBLE**

**Código potencialmente muerto:**
1. Tabla `theme_definitions` (legacy v4.13.0) - Existe pero no se usa en código nuevo
2. `database/theme-repository.js` - Puede usar tabla legacy
3. Algunos archivos de documentación pueden estar desactualizados

**Estado:** ⚠️ **AMBIGUO** - Hay código que puede estar muerto pero no está claro

### ¿Hay código activo sin flag?

**Respuesta:** ✅ **SÍ**

**Código activo sin flag:**
- Theme Resolver v1 - Activo siempre
- Editor de temas - Activo siempre (requiere admin)
- Sistema de versionado - Activo siempre

**Estado:** ✔ **VÁLIDO** - Código activo sin flags (comportamiento esperado)

---

## 8) IA / FUTURO

### ¿Existe hoy algún contrato que una IA pudiera rellenar?

**Respuesta:** ✅ **SÍ, PARCIAL**

**Contrato para IA:**
- ThemeDefinition tiene estructura clara
- 102 variables CSS bien definidas
- Valores por defecto disponibles

**Generador IA existente:**
- `src/core/theme/theme-ai-generator.js` - Existe pero no se revisó en detalle
- Endpoint: `POST /admin/themes/generate` - Genera propuestas de temas

**Estado:** ✔ **VÁLIDO** - Contrato existe y hay generador IA básico

### ¿Qué falta para que una IA pueda generar un tema válido?

**Respuesta:** ⚠️ **VARIOS ASPECTOS**

**Falta:**
1. Validación de formato de valores CSS (hex, rgb, etc.)
2. Validación de consistencia (contraste, accesibilidad)
3. Documentación de semántica de variables (qué significa cada variable)
4. Ejemplos de temas válidos para entrenamiento
5. Integración con Ollama u otro modelo LLM

**Estado:** ⚠️ **AMBIGUO** - Contrato existe pero falta validación y documentación

### ¿Qué partes del sistema actual bloquean ese futuro?

**Respuesta:** ⚠️ **VARIAS PARTES**

**Bloqueos:**
1. **Inyección CSS:** No hay inyección dinámica de variables CSS (IA no puede ver resultado inmediato)
2. **Validación:** Validación básica no valida formato ni consistencia
3. **Preview:** Preview no es idéntico a producción (IA puede generar temas que no funcionen)
4. **Documentación:** Falta documentación de semántica de variables

**Estado:** ⚠️ **AMBIGUO** - Hay bloqueos pero no son insalvables

---

## RESUMEN EJECUTIVO FINAL

### Estado General: ⚠️ **AMBIGUO CON RIESGOS**

**Componentes Válidos (✔):**
- Theme Resolver v1 (resolución determinista)
- Theme Contract v1 (102 variables bien definidas)
- Sistema de versionado (DRAFT/PUBLISH inmutable)
- Validación de definiciones (estricta para publish)
- Fallbacks deterministas (fail-open absoluto)

**Componentes Ambiguos (⚠️):**
- Persistencia dual (2 tablas, no está claro cuál es fuente de verdad)
- Aplicación visual parcial (no hay inyección dinámica de CSS)
- Preview inconsistente (diferente a producción)
- Editor híbrido (campos que no corresponden exactamente)
- Hardcodes residuales (colores directos en algunos lugares)

**Componentes Rotos (❌):**
- No hay conexión entre Theme Resolver y CSS variables dinámicas
- Preview inyecta CSS manualmente pero producción no
- Falta auditoría de qué pantallas usan temas
- Validación no cubre formato ni consistencia

### Decisiones Pendientes (NO SOLUCIONES)

1. **Persistencia:** ¿Cuál es la fuente de verdad? ¿`theme_definitions` (legacy) o `themes` + `theme_drafts` + `theme_versions` (nuevo)?
2. **Aplicación Visual:** ¿Cómo se inyectan las variables CSS del tema resuelto? ¿Dinámicamente o estáticamente?
3. **Preview:** ¿Cómo hacer que preview sea idéntico a producción?
4. **Validación:** ¿Qué nivel de validación se necesita? ¿Formato CSS? ¿Consistencia? ¿Accesibilidad?
5. **Hardcodes:** ¿Cómo eliminar hardcodes residuales? ¿Auditoría completa?
6. **IA:** ¿Qué validaciones adicionales se necesitan para generación IA confiable?
7. **Feature Flags:** ¿Se necesitan feature flags para partes del sistema de temas?
8. **Documentación:** ¿Qué documentación falta para que el sistema sea mantenible?

### Riesgos si se Continúa sin Cerrar el Sistema

1. **Inconsistencias Visuales:** Temas pueden no aplicarse correctamente en todas las pantallas
2. **Bugs en Producción:** Preview diferente a producción puede generar bugs
3. **Mantenibilidad:** Sistema dual de persistencia dificulta mantenimiento
4. **Escalabilidad:** Falta de inyección dinámica limita temas personalizados
5. **IA No Confiable:** Sin validación completa, IA puede generar temas inválidos
6. **Hardcodes:** Hardcodes residuales pueden romper coherencia visual
7. **Documentación:** Falta de documentación dificulta onboarding de nuevos desarrolladores

---

## ARCHIVOS CLAVE REFERENCIADOS

### Backend
- `src/core/theme/theme-resolver.js` - Resolver principal
- `src/core/theme/theme-contract.js` - Contrato de variables
- `src/core/theme/theme-definition-contract.js` - Contrato de definición
- `src/core/theme/theme-defaults.js` - Valores por defecto
- `src/core/theme/theme-registry.js` - Registry de temas
- `src/core/responses.js` - Aplicación de tema (`applyTheme()`)
- `src/core/html-response.js` - Renderizado HTML con tema
- `src/endpoints/admin-themes-ui.js` - Editor UI
- `src/endpoints/admin-themes-api.js` - API de temas
- `src/infra/repos/theme-repo-pg.js` - Repositorio de temas
- `src/infra/repos/theme-draft-repo-pg.js` - Repositorio de drafts
- `src/infra/repos/theme-version-repo-pg.js` - Repositorio de versiones

### Base de Datos
- `database/migrations/v4.13.0-create-theme-definitions.sql` - Tabla legacy
- `database/migrations/v5.2.0-create-themes-versioning.sql` - Sistema nuevo

### Frontend
- `public/css/theme-contract.css` - Definiciones de variables
- `public/css/theme-variables.css` - Valores hardcodeados
- `public/css/theme-overrides.css` - Sobrescrituras

### Documentación
- `docs/THEME_DEFINITIONS_V1.md` - Documentación de definiciones
- `docs/THEME_RESOLVER_DESIGN.md` - Diseño del resolver
- `docs/THEME_PREVIEW_V1.md` - Documentación de preview
- `docs/ARQUITECTURA_EDITOR_TEMAS.md` - Arquitectura del editor

---

**FIN DEL DIAGNÓSTICO**











