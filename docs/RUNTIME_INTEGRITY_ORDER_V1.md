# RUNTIME INTEGRITY ORDER v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-XX  
**Dominio**: CORE  
**Componente**: Runtime Integrity Check

---

## 📋 RESUMEN EJECUTIVO

Este contrato define el orden de ejecución correcto del Runtime Integrity Check. El check debe ejecutarse **DESPUÉS** de que todos los scripts estén cargados, no inmediatamente (IIFE).

---

## 🎯 REGLAS CONSTITUCIONALES

### Regla 1: Ejecución Después de Scripts Cargados

**EL Runtime Integrity Check debe**:

1. ✅ Esperar a `DOMContentLoaded` (si aún no ocurrió)
2. ✅ Si DOM ya está cargado, ejecutar inmediatamente
3. ✅ **NO** ejecutarse antes de que scripts críticos estén cargados

**PROHIBIDO**: Ejecutar el check inmediatamente (IIFE) sin verificar que scripts están cargados.

### Regla 2: Verificación de Componentes Críticos

**EL Runtime Integrity Check debe verificar**:

1. ✅ `__AP_RUNTIME_READY__` existe y `state='booting'`
2. ✅ `__AP_UX_ACTION_REGISTRY_CORE__` existe y tiene métodos críticos
3. ✅ `__AP_UX_ACTION_SCHEMA__` existe y tiene métodos críticos
4. ✅ `__AP_REFRESH_SURFACE_REGISTRY__` existe (opcional pero recomendado)

---

## 🔧 IMPLEMENTACIÓN

### Función: `runIntegrityCheck`

**Archivo**: `public/js/core/runtime/runtime-integrity-check.v1.js`

**Estructura**:

```javascript
(function() {
  'use strict';

  function runIntegrityCheck() {
    // Verificaciones de integridad
    // ...
    
    if (errors.length > 0) {
      window.__AP_RUNTIME_READY__.failHard(error);
      return;
    }
    
    window.__AP_RUNTIME_READY__.resolveReady();
  }

  // FIX MAJOR: Esperar a DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runIntegrityCheck);
  } else {
    runIntegrityCheck();
  }
})();
```

**Flujo**:

1. Script se carga (IIFE se ejecuta)
2. **VERIFICAR**: `document.readyState`
   - Si `'loading'`: Esperar a `DOMContentLoaded`
   - Si `'interactive'` o `'complete'`: Ejecutar inmediatamente
3. Ejecutar `runIntegrityCheck()`
4. Verificar componentes críticos
5. Si todo ok: `resolveReady()`
6. Si falla: `failHard(error)`

---

## 📊 ORDEN DE EJECUCIÓN ESPERADO

### Secuencia Correcta

```
1. Página carga
2. Scripts se cargan en orden:
   - runtime-ready.v1.js
   - ux-action-registry-loader.js
   - ux-action-schema.js
   - runtime-integrity-check.v1.js (se carga)
3. runtime-integrity-check.v1.js:
   - Verifica document.readyState
   - Si 'loading': Espera DOMContentLoaded
   - Si 'interactive'/'complete': Ejecuta runIntegrityCheck()
4. runIntegrityCheck():
   - Verifica __AP_RUNTIME_READY__ existe
   - Verifica __AP_UX_ACTION_REGISTRY_CORE__ existe
   - Verifica __AP_UX_ACTION_SCHEMA__ existe
   - Si todo ok: resolveReady()
   - Si falla: failHard(error)
```

### Secuencia Incorrecta (ANTES DEL FIX)

```
1. Página carga
2. Scripts se cargan:
   - runtime-ready.v1.js
   - runtime-integrity-check.v1.js (se carga e INMEDIATAMENTE ejecuta)
   - ❌ ERROR: ux-action-registry-loader.js aún no se cargó
3. runtime-integrity-check.v1.js:
   - Verifica __AP_UX_ACTION_REGISTRY_CORE__
   - ❌ FALLA: No existe (aún no cargado)
   - failHard(error)
```

---

## 🔍 LOGS ESPERADOS

### Antes del Fix

```
[RuntimeIntegrityCheck] start
[RuntimeIntegrityCheck] ❌ Integridad fallida: __AP_UX_ACTION_REGISTRY_CORE__ no existe
```

### Después del Fix

```
[RuntimeIntegrityCheck] start
[RuntimeIntegrityCheck] ✅ Integridad verificada - todos los componentes críticos disponibles
```

**NOTA**: Si `DOMContentLoaded` aún no ocurrió, el check espera silenciosamente (no hay log de espera).

---

## ✅ VERIFICACIÓN

### Assembly Check

```bash
# Verificar que no hay errores de sintaxis
npm run check:runtime-core
```

### Tests Manuales

1. Abrir `/master/*` (cualquier ruta Master)
2. Abrir consola del navegador
3. Verificar orden de logs:
   - `[RuntimeIntegrityCheck] start` debe aparecer
   - `[RuntimeIntegrityCheck] ✅` debe aparecer **DESPUÉS** de scripts cargados
4. Verificar que runtime está `ready`:
   ```javascript
   window.__AP_RUNTIME_READY__.state() // Debe ser 'ready'
   ```

---

## 🚫 PROHIBICIONES

### Prohibido 1: Ejecutar inmediatamente (IIFE)

**REGLA**: El check **NUNCA** debe ejecutarse inmediatamente sin verificar `document.readyState`.

**RAZÓN**: Los scripts pueden no estar cargados aún, causando falsos negativos.

### Prohibido 2: Validar contra scripts no cargados

**REGLA**: El check **NUNCA** debe validar componentes que aún no están cargados.

**RAZÓN**: Causa `failHard` innecesario cuando scripts están cargándose normalmente.

---

## 📚 REFERENCIAS

- `docs/DIAGNOSTICO_CONTRATOS_ROTOS_ALQUIMIA_GENERAL_V2.md` (diagnóstico inicial)
- `public/js/core/runtime/runtime-integrity-check.v1.js` (implementación)
- `public/js/core/runtime/runtime-ready.v1.js` (Runtime Ready Gate)

---

**FIN DEL CONTRATO**
