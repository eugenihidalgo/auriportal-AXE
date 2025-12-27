# DIAGNÓSTICO: Recorridos Preview + Theme Bridge (v5.16.0)

**Fecha:** 2025-01-XX  
**Sprint:** Theme Studio v3 ↔ Editores + Preview "Superguau" en Recorridos

---

## 1. RUTAS ACTUALES DEL ADMIN

### Router Principal
- **Archivo:** `src/router.js`
- **Handler principal admin:** `adminPanelHandler` → `src/endpoints/admin-panel.js`
- **Catch-all legacy:** `admin-panel-v4.js` (línea 713)

### Rutas Island (handlers específicos antes del catch-all)
- `/admin/themes/studio-v3` → `admin-themes-v3-ui.js`
- `/admin/themes/studio` → `admin-themes-studio-ui.js`
- `/admin/navigation` → `admin-navigation-pages.js` (línea 676)
- `/admin/pde/catalog-registry` → `admin-catalog-registry.js`

### Rutas API
- `/admin/api/themes-v3` → `admin-themes-v3-api.js`
- `/admin/api/themes` → `admin-themes.js`
- `/admin/api/navigation` → (separado, no en router principal)
- `/admin/api/recorridos` → (probablemente en admin-panel-v4)

### Rutas Legacy (catch-all)
- Todas las demás rutas `/admin/*` van a `admin-panel-v4.js`

---

## 2. PUNTO EXACTO DEL BUG {{SIDEBAR_MENU}}

### Ubicación del Bug
**Archivo:** `src/endpoints/admin-navigation-pages.js`

### Análisis
1. **Handler correcto:** `admin-navigation-pages.js` maneja `/admin/navigation/*`
2. **Función `replace()`:** Líneas 155-187
   - Genera `SIDEBAR_MENU` automáticamente si no está en placeholders (línea 160)
   - Reemplaza placeholders con regex (línea 174)
3. **Uso de `base.html`:** Línea 20 - carga template base
4. **Pipeline:** `replace()` → `renderHtml()` (línea 242, 300)

### Problema Detectado
El handler `admin-navigation-pages.js` SÍ genera el sidebar correctamente. El bug puede estar en:
- Rutas subpaths que no pasan por este handler
- Alguna ruta que escapa al catch-all sin pasar por el pipeline completo
- Rutas que no usan `base.html` pero tienen el placeholder

### Estrategia de Fix
1. Asegurar que TODAS las rutas `/admin/navigation/*` pasan por `admin-navigation-pages.js`
2. Verificar que `replace()` siempre genera `SIDEBAR_MENU` antes de reemplazar
3. Añadir validación post-replace para detectar placeholders sin reemplazar
4. Logs de diagnóstico en producción para detectar rutas que escapan

---

## 3. EDITOR DE RECORRIDOS

### Ubicación
- **HTML:** `src/core/html/admin/recorridos/recorridos-editor.html`
- **Handler:** Probablemente en `admin-panel-v4.js` (ruta legacy `/admin/recorridos`)

### Estado Actual
- Editor tiene drafts/versions/audit
- Tiene `validateRecorridoDefinition()`
- Tiene selector de tema básico (líneas 46-53) con solo Dark/Light Classic
- Tiene botón "Preview" (línea 58) pero probablemente no funcional

### Necesidades
1. Panel Preview grande con iframe
2. Theme selector completo (Auto/Classic/Themes v3)
3. Integración postMessage con preview host
4. Persistencia localStorage de preferencia de tema

---

## 4. THEME RESOLVER V1

### Ubicación
- **Archivo:** `src/core/theme/theme-resolver.js`
- **Función principal:** `resolveTheme({ student, theme_id })`
- **Temas del sistema:** `dark-classic`, `light-classic` (vía `SYSTEM_DEFAULT`)

### Funcionalidad
- Resuelve tema determinista
- Fail-open absoluto
- Soporta `theme_id` explícito (v1.1)
- Devuelve `ThemeEffective` con tokens CSS

---

## 5. THEME STUDIO V3

### Endpoints API
- **Archivo:** `src/endpoints/admin-themes-v3-api.js`
- **Rutas:**
  - `GET /admin/api/themes-v3/list` - Lista temas
  - `GET /admin/api/themes-v3/:id` - Obtiene tema
  - `GET /admin/api/themes-v3/:id/versions` - Versiones publicadas

### Estructura de Datos
- ThemeDefinition v1: `{ schema_version: 1, id, name, tokens: { "--bg-main": "...", ... }, meta: {} }`
- Temas tienen `status` (draft, published)
- Versiones publicadas tienen `version` number

---

## 6. ESTRATEGIA FINAL

### FASE 1: Theme Catalog
- Endpoint: `GET /admin/api/themes/catalog?include_drafts=0|1`
- Agregar: Auto, Light Classic, Dark Classic, themes v3 publicados
- Fail-open: si themes-v3 falla, devolver solo system/classic

### FASE 2: Preview Host
- Ruta: `/admin/recorridos/preview` (type: island)
- HTML canónico sin base.html
- Renderer mínimo de steps
- Listener postMessage con fail-open

### FASE 3: Integración Editor
- Panel Preview con iframe
- Theme selector reutilizable
- postMessage con snapshot + theme tokens
- Persistencia localStorage

### FASE 4: Fix SIDEBAR_MENU
- Validar que todas las rutas `/admin/navigation/*` usan pipeline completo
- Añadir validación post-replace
- Logs de diagnóstico

---

## 7. ARCHIVOS A CREAR/MODIFICAR

### Nuevos
- `src/endpoints/admin-themes-catalog-api.js` - Theme Catalog endpoint
- `src/core/html/admin/recorridos/recorridos-preview.html` - Preview host HTML
- `src/endpoints/admin-recorridos-preview-ui.js` - Preview handler
- `src/core/ui/theme/theme-selector.js` - Helper reutilizable
- `src/core/theme/theme-tokens-to-css.js` - Convertir tokens a CSS

### Modificar
- `src/core/admin/admin-route-registry.js` - Añadir rutas nuevas
- `src/router.js` - Enlazar handlers nuevos
- `src/core/html/admin/recorridos/recorridos-editor.html` - Integrar preview panel
- `src/endpoints/admin-navigation-pages.js` - Validación adicional SIDEBAR_MENU

### Documentación
- `docs/RECORRIDOS_PREVIEW_V1.md` - Arquitectura
- `CHANGELOG.md` - v5.16.0

---

## 8. LOGS ESPERADOS

- `[AXE][THEME_CATALOG]` - Theme catalog requests
- `[AXE][REC_PREVIEW]` - Preview host messages
- `[AXE][SIDEBAR_FIX]` - Validación SIDEBAR_MENU

---

**Diagnóstico completado. Listo para implementación.**











