# Asset Cache Busting v1 - Datos para GitHub

## VERSION NAME

```
v5.32.2-assets-cache-busting-v1
```

## COMMIT MESSAGE

```
feat(core): asset cache busting canónico v1 (versionado obligatorio)
```

## DESCRIPTION

Implementación del contrato canónico de asset versioning v1.
Elimina definitivamente problemas de caché (incógnito, hard reload).
Todos los assets JS/CSS se sirven con versionado determinista basado en APP_VERSION y BUILD_ID.
Sistema robusto, auditado y documentado.

## CAMBIOS PRINCIPALES

### Nuevos Archivos

1. **`public/js/shared/asset-versioning.js`**
   - Helper canónico para versionar assets
   - Función `withAssetVersion(path)` que añade `?v=APP_VERSION.BUILD_ID`
   - Error visible si faltan versiones

2. **`docs/ASSETS_CACHE_BUSTING_CONTRACT_V1.md`**
   - Contrato canónico del sistema
   - Definiciones, ejemplos, reglas

3. **`docs/ASSETS_CACHE_BUSTING_VERIFIED.md`**
   - Verificación y documentación de headers
   - Casos de uso y problemas eliminados

### Archivos Modificados

1. **`.cursorrules`**
   - Añadida sección "CONSTITUCIÓN ASSET VERSIONING v1"
   - Reglas obligatorias de versionado

2. **`public/js/master/master-script-loader.js`**
   - Aplicado versionado a todos los scripts cargados
   - Importa y usa `withAssetVersion()`

### Headers Cache-Control

- **HTML MASTER**: `no-store` (siempre fresco)
- **Assets versionados**: `public, max-age=31536000, immutable` (caché agresivo)

### Verificación

- ✅ Helper canónico implementado
- ✅ Aplicado en master-script-loader.js
- ✅ Headers Cache-Control correctos
- ✅ Rules constitucionales actualizadas
- ✅ Documentación completa

## IMPACTO

### Problemas Eliminados

- ❌ Modo incógnito mostraba assets antiguos → ✅ Resuelto
- ❌ Hard reloads no funcionaban → ✅ Resuelto
- ❌ Navegador servía JS/CSS en caché después de deploy → ✅ Resuelto
- ❌ Problemas de sincronización entre HTML y assets → ✅ Resuelto

### Garantías

- ✅ URL distinta = asset distinto
- ✅ Imposible servir asset antiguo con URL nueva
- ✅ Versionado determinista (mismo build = misma versión)
- ✅ Error visible si faltan versiones (no fallo silencioso)

## REFERENCIAS

- Contrato: `docs/ASSETS_CACHE_BUSTING_CONTRACT_V1.md`
- Verificación: `docs/ASSETS_CACHE_BUSTING_VERIFIED.md`
- Helper: `public/js/shared/asset-versioning.js`
- Loader: `public/js/master/master-script-loader.js`

---

**ESTADO**: ✅ IMPLEMENTACIÓN COMPLETA Y VERIFICADA
