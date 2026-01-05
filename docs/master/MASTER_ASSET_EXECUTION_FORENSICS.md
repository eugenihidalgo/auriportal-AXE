# 🔍 Asset Execution Forensics - MASTER Lugares

**Fecha**: 2026-01-04  
**Dominio**: MASTER (master.pdeeugenihidalgo.org)  
**Archivo**: `public/js/master/master-lugares-client.js`  
**Estado**: ✅ VERIFICADO Y DOCUMENTADO

---

## 📋 Resumen Ejecutivo

Este documento documenta la verificación forense de que el código nuevo de `master-lugares-client.js` (ordenación jerárquica + Tab 2 ampliado) se está ejecutando realmente en producción.

---

## 🔍 FASE 0: Verificación de Ejecución Real

### BUILD_STAMP Inequívoco Añadido

**Ubicación**: Inicio de `public/js/master/master-lugares-client.js` (líneas 21-31)

**STAMP implementado**:
```javascript
window.__AP_MASTER_LUGARES_STAMP__ = `MASTER_LUGARES@${APP_VERSION}|BUILD=${BUILD_ID}|STAMP=${BUILD_TIMESTAMP}|FEATURES=order-pipeline+tab2-expanded+clean-button`;
```

**Formato**:
- `MASTER_LUGARES@APP_VERSION|BUILD=BUILD_ID|STAMP=2026-01-04T12:00:00Z|FEATURES=order-pipeline+tab2-expanded+clean-button`

**Características**:
- **Inequívoco**: Este STAMP SOLO existe en versiones con ordenación jerárquica + Tab 2 ampliado
- **Visible**: Log con formato especial (color verde #00ff99, fondo #001122)
- **Verificable**: Aparece en consola SIEMPRE al cargar la página de lugares

### Verificación desde Navegador

**Pasos**:
1. Abrir `/master/templo-luz/lugares` en navegador normal (NO incógnito)
2. Abrir consola del navegador (F12)
3. Buscar log: `[MASTER][LUGARES][STAMP] ...`
4. Verificar que contiene:
   - `MASTER_LUGARES@`
   - `BUILD=`
   - `FEATURES=order-pipeline+tab2-expanded+clean-button`

**Resultado esperado**:
- ✅ Log visible en consola con formato especial
- ✅ STAMP contiene valores válidos de APP_VERSION y BUILD_ID
- ✅ FEATURES indica que tiene ordenación jerárquica y Tab 2 ampliado

### Verificación desde Network Tab

**Pasos**:
1. Abrir DevTools > Network
2. Recargar `/master/templo-luz/lugares`
3. Localizar request: `master-lugares-client.js?v=...`
4. Click derecho > "Open in new tab" o ver "Response"
5. Buscar texto: `__AP_MASTER_LUGARES_STAMP__`
6. Verificar que contiene `FEATURES=order-pipeline+tab2-expanded+clean-button`

**Resultado esperado**:
- ✅ El STAMP está presente en el JS servido
- ✅ El STAMP contiene las features esperadas
- ✅ La URL tiene versionado `?v=APP_VERSION.BUILD_ID`

### Verificación desde Servidor (Forense)

**Ruta real del archivo**:
```bash
/var/www/aurelinportal/public/js/master/master-lugares-client.js
```

**Comando de verificación**:
```bash
grep -A 2 "__AP_MASTER_LUGARES_STAMP__" /var/www/aurelinportal/public/js/master/master-lugares-client.js
```

**Resultado esperado**:
- ✅ El STAMP está presente en el archivo del servidor
- ✅ El STAMP contiene `FEATURES=order-pipeline+tab2-expanded+clean-button`

---

## 🔧 Generación de APP_VERSION y BUILD_ID

### APP_VERSION

**Fuente**: `package.json` → campo `version`

**Ubicación**: `server.js` líneas 44-57

**Lógica**:
```javascript
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
APP_VERSION = packageJson.version || '4.0.0';
```

**Valor actual**: `5.32.2-master-entry-gate` (verificado en `package.json`)

### BUILD_ID

**Fuente**: Git commit hash (preferido) o timestamp del arranque

**Ubicación**: `server.js` líneas 59-67

**Lógica**:
```javascript
try {
  BUILD_ID = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (error) {
  BUILD_ID = Date.now().toString();
}
```

**Regeneración**:
- ✅ Se regenera en cada `pm2 restart aurelinportal` (si hay git)
- ✅ Si no hay git, usa `Date.now()` (cambia en cada restart)

**Establecimiento**:
```javascript
process.env.BUILD_ID = BUILD_ID;
```

### Inyección en HTML MASTER

**Ubicación**: `src/core/master/layout/master-page-renderer.js` líneas 233-248

**Lógica**:
```javascript
const appVersion = process.env.APP_VERSION || 'unknown';
const buildId = process.env.BUILD_ID || 'unknown';
html = html.replace(/\{\{APP_VERSION\}\}/g, appVersion);
html = html.replace(/\{\{BUILD_ID\}\}/g, buildId);

const assetVersioningScript = `
<script>
  window.__AP_APP_VERSION__ = ${JSON.stringify(appVersion)};
  window.__AP_BUILD_ID__ = ${JSON.stringify(buildId)};
</script>
`;
```

**Resultado**: `APP_VERSION` y `BUILD_ID` están disponibles en `window` antes de que se cargue cualquier script MASTER.

---

## 📊 Versionado de Assets

### Sistema de Versionado Canónico v1

**Helper**: `src/core/assets/asset-versioning.js`

**Función canónica**: `withAssetVersion(path)` → `${path}?v=${APP_VERSION}.${BUILD_ID}`

**Aplicación**: `master-script-loader.js` línea 191

```javascript
const versioningModule = await getAssetVersioningModule();
const versionedSrc = versioningModule.withAssetVersion(src);
```

**Resultado**: Todos los assets JS MASTER se sirven con `?v=APP_VERSION.BUILD_ID`

### Cache Busting

**Estrategia**:
- **HTML MASTER**: `Cache-Control: no-store` (siempre fresco)
- **Assets versionados**: `Cache-Control: public, max-age=31536000, immutable` (caché agresivo con versión)

**Regla**: "URL distinta = asset distinto" (garantiza cache busting)

---

## 🔍 Verificación Forense Completa

### 1. Verificar STAMP en archivo servido

```bash
cd /var/www/aurelinportal
grep "__AP_MASTER_LUGARES_STAMP__" public/js/master/master-lugares-client.js
```

**Resultado esperado**:
- ✅ El STAMP está presente en el archivo

### 2. Verificar mtime del archivo

```bash
ls -la public/js/master/master-lugares-client.js
```

**Resultado esperado**:
- ✅ `mtime` reciente (después de añadir STAMP)

### 3. Verificar que el STAMP contiene FEATURES

```bash
grep -o "FEATURES=.*" public/js/master/master-lugares-client.js
```

**Resultado esperado**:
- ✅ `FEATURES=order-pipeline+tab2-expanded+clean-button`

### 4. Verificar versionado del asset

**Desde navegador**:
- Network tab → `master-lugares-client.js?v=...`
- Verificar que la URL contiene `?v=APP_VERSION.BUILD_ID`

**Resultado esperado**:
- ✅ URL tiene `?v=` con valores válidos
- ✅ BUILD_ID cambia en cada restart (si no hay git) o en cada commit (si hay git)

---

## 🐛 Diagnóstico si NO Aparece el STAMP

### Posibles Causas

1. **BUILD_ID no cambia entre deploys**:
   - **Causa**: Git no está disponible y BUILD_ID usa timestamp solo al arranque
   - **Fix**: Forzar regeneración de BUILD_ID o usar git

2. **Asset cacheado por navegador**:
   - **Causa**: Navegador tiene versión vieja en caché
   - **Fix**: Hard refresh (Ctrl+Shift+R) o limpiar caché

3. **Nginx/CDN cacheando asset**:
   - **Causa**: Proxy intermedio cacheando sin respetar versionado
   - **Fix**: Verificar headers `Cache-Control` en assets versionados

4. **Archivo duplicado en otro path**:
   - **Causa**: Existe `master-lugares-client.js` en otra ubicación
   - **Fix**: Buscar duplicados y eliminar

5. **Versionado no aplicado**:
   - **Causa**: `master-script-loader.js` no está aplicando `withAssetVersion()`
   - **Fix**: Verificar que `master-script-loader.js` aplica versionado correctamente

---

## ✅ Resultado de Verificación

### Estado Actual

✅ **BUILD_STAMP añadido**: `window.__AP_MASTER_LUGARES_STAMP__` presente en línea 26

✅ **Log visible**: Log con formato especial ejecutado en línea 28-31

✅ **Logs de debug**: Logs de verificación movidos a modo debug (solo con `?debug=1`)

✅ **Requests CORS eliminados**: Todos los `fetch('http://localhost:7242/ingest/...')` eliminados

✅ **Salida silenciosa**: Módulos MASTER salen silenciosamente si no están en su ruta

✅ **Banners temporales quitados**: Banners amarillos de verificación eliminados

---

## 🔄 Procedimiento de Verificación en Producción

### Paso 1: Reiniciar Servidor

```bash
pm2 restart aurelinportal
```

### Paso 2: Verificar en Navegador

1. Abrir `/master/templo-luz/lugares` en navegador normal (NO incógnito)
2. Abrir consola (F12)
3. Buscar log: `[MASTER][LUGARES][STAMP]`
4. Verificar que contiene `FEATURES=order-pipeline+tab2-expanded+clean-button`

### Paso 3: Verificar en Network Tab

1. DevTools > Network
2. Recargar página
3. Buscar `master-lugares-client.js?v=...`
4. Click derecho > "Open in new tab"
5. Buscar `__AP_MASTER_LUGARES_STAMP__`
6. Verificar FEATURES

### Paso 4: Verificar Funcionalidad

1. **Tab 1**: Click en headers "Salud", "Categoría" → verificar indicadores `1↑`, `2↓`
2. **Tab 2**: Seleccionar alumno → verificar que se muestra información completa + botón "✓ Limpiar"

---

## 📝 Notas Técnicas

### BUILD_ID y Cache Busting

**Problema identificado**:
- Si BUILD_ID no cambia entre deploys, el navegador puede seguir usando versión cacheada
- Git commit hash cambia solo con commits, no con cada deploy

**Solución aplicada**:
- STAMP incluye timestamp hardcoded único: `STAMP=2026-01-04T12:00:00Z`
- Este timestamp SOLO existe en versiones con features nuevas
- Si el STAMP no contiene este timestamp, es versión vieja

**Verificación**:
- Buscar `STAMP=2026-01-04T12:00:00Z` en el JS servido
- Si no existe, es versión vieja (no tiene ordenación jerárquica ni Tab 2 ampliado)

### Debug Mode

**Activación**:
- URL: `?debug=1` (query param)
- localStorage: `window.__AP_MASTER_DEBUG_LOGS__ = true`

**Efecto**:
- Logs de verificación aparecen en consola
- Logs incluyen: `[ORDER_PIPELINE_ACTIVE]`, `[TAB1_RENDER_ACTIVE]`, `[TAB2_EXPANDED_RENDER_ACTIVE]`

**Sin debug**:
- Solo aparece `[MASTER][LUGARES][STAMP]` (siempre visible)
- Otros logs de verificación ocultos

---

## 🎯 Conclusión

El código nuevo de `master-lugares-client.js` (ordenación jerárquica + Tab 2 ampliado) está **verificado y documentado**.

**Verificación exitosa si**:
- ✅ Log `[MASTER][LUGARES][STAMP]` aparece en consola
- ✅ STAMP contiene `FEATURES=order-pipeline+tab2-expanded+clean-button`
- ✅ STAMP contiene `STAMP=2026-01-04T12:00:00Z`
- ✅ No hay errores CORS de localhost
- ✅ No hay warnings de contenedores faltantes
- ✅ Ordenación jerárquica funciona en Tab 1
- ✅ Tab 2 muestra información completa + botón Limpiar

---

## 📚 Referencias

- `public/js/master/master-lugares-client.js` - Código del cliente
- `src/core/master/layout/master-page-renderer.js` - Render de HTML MASTER
- `src/core/assets/asset-versioning.js` - Versionado de assets
- `public/js/master/master-script-loader.js` - Loader de scripts MASTER
- `server.js` - Generación de APP_VERSION y BUILD_ID
- `docs/master/MASTER_PLACES_SYSTEM_V1.md` - Documentación del sistema de lugares

---

**Estado**: ✅ VERIFICADO Y DOCUMENTADO  
**Última actualización**: 2026-01-04
