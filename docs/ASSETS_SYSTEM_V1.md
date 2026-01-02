# Sistema de Assets Canónico v1 - AuriPortal

## ⚠️ ESTADO: CERRADO / CANÓNICO v1

**Este sistema está CERRADO y es CANÓNICO para el dominio MASTER.**

- ✅ Implementación completa y verificada
- ✅ Assembly checks pasando (`npm run check:master-ui`, `npm run check:assets-master`)
- ✅ Sistema operativo y en producción

**IMPORTANTE**: Cualquier cambio o extensión requiere una nueva versión (v2, v3, etc.). No se deben alterar los contratos v1 sin versionado explícito.

---

## Objetivo

Convertir assets en un sistema gobernado por contrato, con diagnóstico 100% explícito (sin fallos silenciosos).

**PRINCIPIO FUNDAMENTAL**: Es imposible que un asset crítico falle en silencio.

## Invariantes Canónicos v1

### 1. Contrato de Carga (Load Contract)

- Todo dominio tiene:
  - 1 entry gate único (MASTER: `inject_master.js`)
  - 1 loader por contrato (MASTER loader: `master-script-loader.js`)
  - 1 evento único de "scripts listos" (MASTER: `AP_MASTER_SCRIPTS_READY`)

- El loader es la única autoridad sobre "qué scripts están listos".

### 2. Verificación Anti-fantasma (Preflight)

Antes de ejecutar un script cargado dinámicamente:
- Validar response OK (status 200-299)
- Validar Content-Type (debe ser JS)
- Validar "content sniff": el cuerpo NO puede parecer HTML (no puede empezar por `<`, ni contener `<html`, `<!doctype`, etc. en los primeros N bytes)
- Si falla, abortar y mostrar error visible

### 3. Registro Runtime de Assets (Asset Runtime Registry)

Cada asset cargado se registra con:
- `domain_context` (MASTER/ADMIN/CLIENT/UNKNOWN)
- `asset_url`
- `asset_name` (id lógico)
- `expected_type` (js/css)
- `start_ts` / `end_ts` / `duration_ms`
- `status`: loaded | failed
- `failure_reason` (si aplica)
- `content_type` observado
- `first_bytes_sniff` (string corta, sanitizada)

El registro vive en `window.__AP_ASSETS__` (objeto canónico) y puede imprimirse en diagnóstico.

### 4. Error Visible y Forense

En MASTER, si falla cualquier asset marcado como "critical", debe:
- Renderizar un overlay de error visible (sin dependencias)
- Incluir: asset_name, url, reason, content-type, app_version/build_id, domain_context, trace_id (si existe), timestamp
- Registrar en console con prefijo canónico `[ASSETS][MASTER]` y objeto estructurado

### 5. Assembly Check de Assets (build-time/boot-time)

Un check Node que recorra la lista `required_scripts` y verifique:
- Existen en disco bajo `PUBLIC_ASSETS_ROOT`
- Extensión y ruta correctas
- **El archivo parece JS** (sniff mínimo: no empieza por `<`)
- Si detecta HTML servido como JS en el filesystem, FAIL-HARD en PROD

## Arquitectura

### Componentes Principales

1. **Asset Runtime Registry** (`public/js/shared/asset-runtime-registry.js`)
   - Módulo compartido reutilizable
   - Funciones: `getAssetRegistry()`, `markAssetStart()`, `markAssetSuccess()`, `markAssetFailure()`, `renderAssetFailureOverlay()`
   - Idempotente, sin dependencias, DOM API únicamente

2. **Master Script Loader** (`public/js/master/master-script-loader.js`)
   - Carga scripts desde contrato
   - Preflight validation antes de cargar
   - Integración con Asset Registry
   - Overlay de errores para assets críticos

3. **Contrato Required Scripts** (`src/core/master/registry/master-layout-registry.v1.json`)
   - Array de objetos con metadatos:
     - `id`: ID lógico
     - `path`: Ruta del asset
     - `type`: Tipo (default: 'module')
     - `required`: Si es requerido (default: true)
     - `critical`: Si es crítico (default: false)
     - `phase`: Fase ('core' | 'ui' | 'feature')
     - `name`: Nombre legible

4. **Assembly Checks**
   - `scripts/master-ui-assembly-check.js`: Check integrado que valida required_scripts
   - `scripts/check-assets-master.js`: Check independiente específico de assets
   - Comando: `npm run check:assets-master`

5. **Endpoint de Diagnóstico** (`/master/api/__assets`)
   - GET `/master/api/__assets`
   - Devuelve JSON con: app_version, build_id, domain_context, required_scripts (normalizado), timestamp
   - Permite comparar "contrato" vs "runtime"

## Flujo de Carga

```
1. HTML renderizado con window.__AP_MASTER_REQUIRED_SCRIPTS__ inyectado
2. inject_master.js se ejecuta (entry gate)
3. master-script-loader.js se carga
4. Para cada script en required_scripts:
   a. markAssetStart() registra inicio
   b. preflightAsset() valida (HEAD/GET, Content-Type, HTML sniff)
   c. Si preflight OK → cargar script
   d. Si script carga OK → markAssetSuccess()
   e. Si falla → markAssetFailure() + overlay (si critical)
5. Emitir evento AP_MASTER_SCRIPTS_READY
```

## Cómo Leer Diagnósticos

### En el Navegador (Runtime)

```javascript
// Ver registry completo
console.log(window.__AP_ASSETS__);

// Ver assets cargados
Object.values(window.__AP_ASSETS__.assets).filter(a => a.status === 'loaded');

// Ver assets fallidos
Object.values(window.__AP_ASSETS__.assets).filter(a => a.status === 'failed');
```

### En el Backend (Contrato)

```bash
# Ver contrato actual
cat src/core/master/registry/master-layout-registry.v1.json | jq '.required_scripts'

# Comparar con runtime
curl http://localhost:3000/master/api/__assets | jq
```

### Assembly Checks

```bash
# Check completo (incluye assets)
npm run check:master-ui

# Check específico de assets
npm run check:assets-master
```

## Cómo Actuar Ante un Fallo

1. **Verificar logs en consola del navegador**
   - Buscar prefijo `[ASSETS][MASTER]`
   - Revisar objeto de error estructurado

2. **Revisar `window.__AP_ASSETS__`**
   - Identificar asset fallido
   - Ver `failure_reason`, `content_type`, `first_bytes_sniff`

3. **Verificar overlay de error** (si es crítico)
   - Overlay muestra información completa del fallo

4. **Verificar contrato vs runtime**
   - `GET /master/api/__assets` muestra contrato
   - Comparar con `window.__AP_ASSETS__` en runtime

5. **Verificar filesystem**
   - Ejecutar `npm run check:assets-master`
   - Verificar que el archivo existe y es JS válido

6. **Casos comunes**:
   - **404**: Archivo no existe en `public/`
   - **HTML servido como JS**: Error de configuración del servidor (verificar handlers de assets)
   - **Content-Type incorrecto**: Verificar headers del servidor
   - **Preflight timeout**: Problema de red o servidor lento

## Reglas de Implementación

- ✅ Nada de `innerHTML` dinámico. Overlay se construye con DOM API.
- ✅ No inferir contexto por URL.
- ✅ No timeouts/polling.
- ✅ Logs estructurados, prefijos:
  - `[ASSETS][MASTER]`
  - `[ASSETS][SERVER]`
  - `[ASSETS][CHECK]`
- ✅ Fail-open NO permitido en assets critical de MASTER: debe ser fail-visible.

## Alcance v1

- ✅ Implementado completo para MASTER (dominio soberano)
- ⏳ Hooks para ADMIN/CLIENT sin migrar todavía (solo estructura reusable)
- ⏳ Sin DB en v1 (todo runtime + checks). Persistencia futura en v2.

## Referencias

- Entry gate: `public/js/master/inject_master.js`
- Loader: `public/js/master/master-script-loader.js`
- Registry: `public/js/shared/asset-runtime-registry.js`
- Contrato: `src/core/master/registry/master-layout-registry.v1.json`
- Renderer: `src/core/master/layout/master-page-renderer.js`
- Endpoint: `src/endpoints/master-api-assets.js`
- Checks: `scripts/check-assets-master.js`, `scripts/master-ui-assembly-check.js`

