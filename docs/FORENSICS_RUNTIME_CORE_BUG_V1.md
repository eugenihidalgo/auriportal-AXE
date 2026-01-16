# FORENSICS: Runtime Core Bug v1 - Error de Exportación

## RESUMEN EJECUTIVO
**Error**: `SyntaxError: './ux-action-schema.js' does not provide an export named 'getActionOrFail'`  
**Causa raíz**: Import incorrecto en `public/js/core/ux/action-registry/perform-action.js` línea 18  
**Impacto**: Botones fallan con "[PerformActionV1] UX Action Registry no disponible..."

## RUTAS EXACTAS

### Archivo con el bug
- **Ruta**: `public/js/core/ux/action-registry/perform-action.js`
- **Línea**: 18
- **Código problemático**:
```javascript
import { getActionOrFail, validatePayload, logContractViolation } from './ux-action-schema.js';
```

### Archivo que exporta correctamente
- **Ruta**: `public/js/core/ux/action-registry/ux-action-registry.js`
- **Línea**: 174
- **Export correcto**:
```javascript
export function getActionOrFail(action_id) {
  return validateActionExists(action_id, {
    get: (id) => actions.get(id)
  });
}
```

### Archivo que NO exporta getActionOrFail
- **Ruta**: `public/js/core/ux/action-registry/ux-action-schema.js`
- **Exports reales**:
  - `validateActionPayload`
  - `validateActionExists`
  - `logContractViolation`
- **NO exporta**: `getActionOrFail`

## ANÁLISIS

### ¿Existe getActionOrFail en ux-action-schema.js?
**NO**. El archivo `ux-action-schema.js` solo exporta funciones de validación de schema, no funciones de acceso al registry.

### ¿El import está mal?
**SÍ**. El import en `perform-action.js` línea 18 intenta importar `getActionOrFail` desde `ux-action-schema.js`, pero debería importarlo desde `ux-action-registry.js` o usar `validateActionExists` directamente.

### ¿Hay mezcla ESM/CJS o export default vs named export?
**NO**. Todos los archivos usan ES modules con named exports. El problema es simplemente un import desde el archivo incorrecto.

### ¿Archivo duplicado?
**SÍ**. Hay dos versiones de `perform-action.js`:
1. `public/js/core/ux/action-registry/perform-action.js` (core, tiene el bug)
2. `public/js/master/ux/perform-action.v1.js` (wrapper MASTER, funciona correctamente)

El loader en `ux-action-registry-loader.js` línea 60 importa el core `perform-action.js`, que tiene el bug.

## CAUSA RAÍZ (1 FRASE)
El archivo `public/js/core/ux/action-registry/perform-action.js` importa `getActionOrFail` desde `ux-action-schema.js` (que no lo exporta) en lugar de importarlo desde `ux-action-registry.js` o usar `validateActionExists` directamente.

## FLUJO DEL ERROR

1. `ux-action-registry-loader.js` se carga
2. Línea 60: `await import('/js/core/ux/action-registry/perform-action.js')`
3. `perform-action.js` línea 18 intenta importar `getActionOrFail` desde `ux-action-schema.js`
4. **ERROR**: `ux-action-schema.js` no exporta `getActionOrFail`
5. El loader falla silenciosamente (catch en línea 75-83)
6. `window.__AP_UX_ACTION_REGISTRY_CORE__` no se crea correctamente
7. `perform-action.v1.js` no encuentra el registry
8. Botones fallan con "UX Action Registry no disponible"

## FIX REQUERIDO

### Opción 1: Corregir el import
Cambiar línea 18 de `perform-action.js`:
```javascript
// ANTES (incorrecto)
import { getActionOrFail, validatePayload, logContractViolation } from './ux-action-schema.js';

// DESPUÉS (correcto)
import { validateActionExists, logContractViolation } from './ux-action-schema.js';
import { getActionOrFail } from './ux-action-registry.js';
```

### Opción 2: Usar validateActionExists directamente
Reemplazar `getActionOrFail` con `validateActionExists` en el código.

## NOTA ADICIONAL
El loader actualmente resuelve la promesa incluso en error (línea 80), lo que permite que el código continúe en "modo degradado". Esto viola el principio de fail-hard y debe corregirse en el sprint.

---
**Fecha**: 2025-01-27  
**Autor**: Forensics Runtime Core v1  
**Estado**: CAUSA RAÍZ IDENTIFICADA
