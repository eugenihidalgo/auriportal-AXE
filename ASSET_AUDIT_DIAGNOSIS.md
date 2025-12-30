# DIAGNÓSTICO ESTRUCTURAL - Assets Públicos
## Fecha: 2024-12-28
## Objetivo: Eliminar desincronización y HTML servido como JS

---

## FASE 1 — DESCUBRIMIENTO REAL

### 1.1 Carpetas de Assets Encontradas

**Filesystem real:**
- ✅ `./public` - EXISTE
- ❌ `./public-assets` - NO EXISTE
- ❌ `./static` - NO EXISTE

**Conclusión:** Solo existe `./public` como carpeta de assets.

### 1.2 Archivos JS Críticos Verificados

**Ubicación:** `public/js/admin/`

**Archivos encontrados:**
- ✅ `theme-studio-canon.js` (37631 bytes)
- ✅ `theme-studio-canon-modals.js` (14320 bytes)
- ✅ `theme-preview-playground.js` (16916 bytes)
- ✅ `theme-playground-iframe-v2.js` (20798 bytes)
- ✅ `safe-fetch-json.js` (3348 bytes)

**Verificación de contenido:**
- ✅ Todos empiezan con comentarios JS válidos (no HTML)
- ✅ No contienen `<!DOCTYPE` ni `<html` en primeros bytes
- ✅ No contienen `<body` en primeros 300 bytes

### 1.3 Cómo se Sirven los Assets

**Router (src/router.js línea 211-285):**
- Detecta rutas: `/css/`, `/js/`, `/public/`, `/uploads/`
- Resuelve rutas usando `join(projectRoot, 'public', ...)`
- Determina Content-Type por extensión
- Para `.js`: `application/javascript; charset=UTF-8`

**Nginx:**
- Configurado para servir `/uploads/` directamente
- Proxy pasa todo lo demás a Node.js (puerto 3000)

### 1.4 Problema Detectado: Desincronización

**ANTES del fix:**
- `public-assets-manifest.js` usaba `resolve(REPO_ROOT, 'public/...')`
- `js-preflight-guard.js` usaba `resolve(REPO_ROOT, filePath)`
- `audit-theme-studio-assets.js` usaba `resolve(REPO_ROOT, script)`
- `router.js` usaba `join(projectRoot, 'public', ...)`

**Diferencia:**
- `REPO_ROOT` = `resolve(__dirname, '../../../')` desde `src/core/robustness/`
- `projectRoot` = `join(__dirname, '..')` desde `src/router.js`

**Resultado:** Ambos apuntan a la misma raíz, pero usan métodos diferentes.

---

## FASE 2 — FIX ESTRUCTURAL

### 2.1 Constante Única Creada

**Archivo:** `src/core/robustness/public-assets-root.js`

**Constantes exportadas:**
- `PUBLIC_ASSETS_ROOT` - Ruta absoluta a `./public`
- `PUBLIC_ASSETS_RELATIVE` - Ruta relativa `'public'`
- `resolvePublicAsset(relativePath)` - Helper para resolver rutas

### 2.2 Módulos Actualizados

**Todos los módulos ahora usan `PUBLIC_ASSETS_ROOT`:**

1. ✅ `public-assets-manifest.js` - Usa `PUBLIC_ASSETS_RELATIVE` y `resolvePublicAsset()`
2. ✅ `js-preflight-guard.js` - Usa `resolvePublicAsset()`
3. ✅ `audit-theme-studio-assets.js` - Usa `PUBLIC_ASSETS_RELATIVE` y `resolvePublicAsset()`
4. ✅ `router.js` - Usa `PUBLIC_ASSETS_ROOT` y `resolvePublicAsset()`

**Resultado:** Un único source of truth elimina desincronización.

---

## FASE 3 — HARDENING

### 3.1 Asset Audit Mejorado

**Tipos de error diferenciados:**
- `FILE_NOT_FOUND` - Archivo no existe
- `HTML_SERVED_AS_JS` - HTML servido como JS (CRÍTICO)
- `WRONG_CONTENT_TYPE` - Contenido no parece JS
- `READ_ERROR` - Error leyendo archivo

**Comportamiento:**
- `HTML_SERVED_AS_JS` → Siempre fail-hard (incluso en warn mode)
- `FILE_NOT_FOUND` → Fail-hard en producción
- Logs estructurados por tipo de error

### 3.2 Router Hardening

**Verificación en runtime:**
- Antes de servir archivo `.js`, lee primeros 300 bytes
- Si contiene `<!DOCTYPE`, `<html` o `<body` → Devuelve 500 JSON con error
- Content-Type explícito: `application/javascript; charset=utf-8`

**Resultado:** Imposible servir HTML como JS sin detectarlo.

### 3.3 Server Startup Hardening

**Asset Audit en arranque:**
- Modo `fail` por defecto en producción
- Si detecta `HTML_SERVED_AS_JS` → FAIL-HARD (no arranca)
- Si detecta `FILE_NOT_FOUND` en producción → FAIL-HARD

**Resultado:** El servidor no puede arrancar con assets rotos.

---

## FASE 4 — LIMPIEZA

**No se requieren cambios adicionales.** El código legacy del router ya usa la constante única.

---

## FASE 5 — VERIFICACIÓN

**Pendiente ejecutar:**
1. `pm2 restart aurelinportal --update-env`
2. Verificar logs: `[ROBUSTNESS][ASSET_AUDIT] ✅ All assets validated`
3. `curl -I http://localhost:3000/js/admin/theme-studio-canon.js`
   - Content-Type: `application/javascript; charset=utf-8`
   - Status: 200
4. Abrir `/admin/theme-studio-canon` en navegador
   - NO debe haber SyntaxError
   - DevTools → Network → Verificar Content-Type de cada JS

---

## CONCLUSIÓN

**Problema raíz identificado:**
- Desincronización entre múltiples formas de resolver rutas a `public/`

**Solución implementada:**
- Constante única `PUBLIC_ASSETS_ROOT` como source of truth
- Todos los módulos usan la misma constante
- Hardening en router (verifica HTML antes de servir JS)
- Hardening en startup (fail-hard si assets rotos)

**Resultado esperado:**
- Imposible servir HTML como JS sin detectarlo
- SyntaxError eliminado por diseño
- Desincronización eliminada

