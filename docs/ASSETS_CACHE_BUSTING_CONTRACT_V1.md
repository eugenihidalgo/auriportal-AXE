# Asset Cache Busting Contract v1 - AuriPortal

## ⚠️ ESTADO: CANÓNICO / CONSTITUCIONAL v1

**Este contrato es CANÓNICO y CONSTITUCIONAL para el dominio MASTER.**

- ✅ Versionado determinista obligatorio
- ✅ Eliminación definitiva de problemas de caché
- ✅ Sistema robusto y auditado

**IMPORTANTE**: Cualquier cambio o extensión requiere una nueva versión (v2, v3, etc.). No se deben alterar los contratos v1 sin versionado explícito.

---

## Objetivo

Eliminar definitivamente problemas de caché (modo incógnito, hard reloads inútiles, assets antiguos) mediante versionado determinista de todos los assets JS/CSS.

**PRINCIPIO FUNDAMENTAL**: URL distinta = asset distinto. El navegador nunca puede servir un asset antiguo si la URL cambió.

---

## ¿Qué es un Asset Versionado?

Un asset versionado es cualquier archivo JS o CSS que se sirve con un parámetro de versión determinista en la URL:

```
/js/master/master-sidebar-client.js?v=4.0.0.abc123
```

Donde:
- `4.0.0` es `APP_VERSION` (versión del proyecto desde `package.json`)
- `abc123` es `BUILD_ID` (commit hash de git o timestamp del arranque)

**Regla absoluta**: Si cambia `APP_VERSION` o `BUILD_ID`, TODAS las URLs de assets cambian, forzando al navegador a descargar la versión nueva.

---

## Uso Obligatorio de APP_VERSION + BUILD_ID

### Source of Truth

- **APP_VERSION**: Se lee de `package.json` al arranque del servidor (`server.js`)
- **BUILD_ID**: Se obtiene de `git rev-parse --short HEAD` o timestamp del arranque (`server.js`)
- **Inyección en HTML**: Se inyectan como `window.__AP_APP_VERSION__` y `window.__AP_BUILD_ID__` en `master-layout-v1.html`

### Formato de Versión

```
?v=${APP_VERSION}.${BUILD_ID}
```

Ejemplos:
- `?v=4.0.0.abc123`
- `?v=4.0.1.def456`
- `?v=4.0.0.1699123456789` (si no hay git)

### Prohibición de Assets Sin Versión

**ESTÁ PROHIBIDO**:
- ❌ Cargar scripts sin `?v=...`
- ❌ Usar timestamps aleatorios o `Date.now()`
- ❌ Hardcodear versiones
- ❌ Omitir versionado "porque funciona en desarrollo"

**ESTÁ OBLIGADO**:
- ✅ TODOS los assets JS/CSS deben usar `withAssetVersion(path)`
- ✅ El helper debe lanzar error visible si faltan APP_VERSION o BUILD_ID
- ✅ El versionado debe ser determinista (mismo build = misma versión)

---

## Relación entre Caché y Versionado

### Headers Cache-Control

#### HTML MASTER
```
Cache-Control: no-store
```
**Razón**: El HTML siempre debe ser fresco para inyectar las versiones correctas de assets.

#### Assets Versionados
```
Cache-Control: public, max-age=31536000, immutable
```
**Razón**: 
- `public`: Puede ser cacheado por proxies/CDN
- `max-age=31536000`: 1 año de caché (seguro porque la URL cambia con cada build)
- `immutable`: El navegador no revalida (la URL ya garantiza unicidad)

### Flujo de Cache Busting

1. **Build nuevo** → `BUILD_ID` cambia → URLs de assets cambian
2. **Navegador carga HTML** → Ve URLs nuevas → Descarga assets nuevos
3. **Assets antiguos** → Quedan en caché pero nunca se usan (URLs diferentes)
4. **Resultado**: Cero problemas de caché, incluso en modo incógnito

---

## Ejemplos Correctos e Incorrectos

### ✅ CORRECTO

```javascript
// Helper canónico
import { withAssetVersion } from '/js/shared/asset-versioning.js';

const scriptPath = '/js/master/master-sidebar-client.js';
const versionedPath = withAssetVersion(scriptPath);
// Resultado: /js/master/master-sidebar-client.js?v=4.0.0.abc123

// Cargar script versionado
const script = document.createElement('script');
script.src = versionedPath;
script.type = 'module';
document.body.appendChild(script);
```

### ❌ INCORRECTO

```javascript
// PROHIBIDO: Sin versionado
const script = document.createElement('script');
script.src = '/js/master/master-sidebar-client.js'; // ❌ Sin ?v=
document.body.appendChild(script);

// PROHIBIDO: Timestamp aleatorio
const timestamp = Date.now();
script.src = `/js/master/master-sidebar-client.js?t=${timestamp}`; // ❌ No determinista

// PROHIBIDO: Versión hardcodeada
script.src = '/js/master/master-sidebar-client.js?v=1.0.0'; // ❌ No cambia automáticamente
```

---

## Regla: "URL Distinta = Asset Distinto"

**Principio fundamental**: Si dos URLs son diferentes, el navegador las trata como assets completamente diferentes, incluso si el contenido es idéntico.

**Implicaciones**:
- ✅ Cambio en `BUILD_ID` → Todas las URLs cambian → Navegador descarga todo de nuevo
- ✅ Mismo `BUILD_ID` → Mismas URLs → Navegador usa caché (correcto)
- ✅ No hay ambigüedad: el navegador nunca puede servir un asset antiguo con una URL nueva

**Garantía**: Con este sistema, es **imposible** que el navegador sirva un asset antiguo después de un deploy.

---

## Implementación

### Helper Canónico

**Ubicación**: `src/core/assets/asset-versioning.js` (o equivalente lógico)

**API mínima**:
```javascript
export function withAssetVersion(path) {
  // Leer APP_VERSION y BUILD_ID desde window.__AP_CONTEXT__ o window.__AP_APP_VERSION__/__AP_BUILD_ID__
  // Lanzar error visible si faltan
  // Devolver: `${path}?v=${APP_VERSION}.${BUILD_ID}`
}
```

### Aplicación en master-script-loader.js

**OBLIGATORIO**: Todos los scripts cargados deben usar `withAssetVersion()`:

```javascript
// ANTES (INCORRECTO)
script.src = scriptDef.path;

// DESPUÉS (CORRECTO)
import { withAssetVersion } from '/js/shared/asset-versioning.js';
script.src = withAssetVersion(scriptDef.path);
```

---

## Verificación

### Test Manual

1. **Cambiar una línea trivial** en `master-sidebar-client.js` (ej: comentario)
2. **Recargar `/master`** en navegador NORMAL (no incógnito)
3. **Confirmar**:
   - ✅ Cambio visible inmediatamente
   - ✅ Network muestra URLs con `?v=APP_VERSION.BUILD_ID`
   - ✅ No hay problemas de caché

### Verificación Automática

- Assembly check debe validar que todos los assets en `required_scripts` usan versionado
- Helper debe lanzar error si faltan `APP_VERSION` o `BUILD_ID`

---

## Referencias

- Helper: `src/core/assets/asset-versioning.js` (o equivalente)
- Loader: `public/js/master/master-script-loader.js`
- Renderer: `src/core/master/layout/master-page-renderer.js`
- Layout: `src/core/master/layout/master-layout-v1.html`
- Server: `server.js` (generación de APP_VERSION y BUILD_ID)

---

## Alcance v1

- ✅ Implementado completo para MASTER (dominio soberano)
- ✅ Versionado determinista obligatorio
- ✅ Eliminación definitiva de problemas de caché
- ⏳ Hooks para ADMIN/CLIENT sin migrar todavía (solo estructura reusable)

---

**ESTADO**: CANÓNICO / CONSTITUCIONAL v1 - NO MODIFICAR SIN VERSIONADO EXPLÍCITO
