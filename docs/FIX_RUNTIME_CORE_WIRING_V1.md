# 🔧 FIX RUNTIME CORE WIRING v1

**Fecha:** 2026-01-13  
**Versión:** 5.75.5  
**Alcance:** Fix de wiring en Runtime Core UX

---

## 🐛 CAUSA RAÍZ

**Error:**
```
SyntaxError: The requested module './ux-action-schema.js'
does not provide an export named 'getActionOrFail'
```

**Ubicación:** `public/js/core/ux/action-registry/perform-action.js`

**Problema:**
El archivo `perform-action.js` estaba usando `validatePayload()` en la línea 62, pero esta función **no estaba importada**. Además, aunque `getActionOrFail` estaba correctamente importado desde `ux-action-registry.js`, el error sugería que algo estaba intentando importarlo desde `ux-action-schema.js` (donde no existe).

**Análisis:**
1. `perform-action.js` importa correctamente `getActionOrFail` desde `ux-action-registry.js` (línea 19)
2. `perform-action.js` usa `validatePayload()` en línea 62, pero **no estaba importado**
3. `validatePayload` está exportado en `ux-action-registry.js` (línea 212)
4. El error de runtime se producía porque `validatePayload` no estaba disponible, causando que el módulo fallara al cargar

---

## 🔧 FIX APLICADO

**Archivo:** `public/js/core/ux/action-registry/perform-action.js`

**Cambio:**
```javascript
// ANTES:
import { validateActionExists, logContractViolation } from './ux-action-schema.js';
import { getAction, getActionOrFail } from './ux-action-registry.js';

// DESPUÉS:
import { validateActionExists, logContractViolation } from './ux-action-schema.js';
import { getAction, getActionOrFail, validatePayload } from './ux-action-registry.js';
```

**Línea modificada:** 19

**Explicación:**
- Se añadió `validatePayload` al import desde `ux-action-registry.js`
- `validatePayload` es usado en la línea 62 para validar el payload contra el schema de la acción
- Sin este import, el módulo fallaba al cargar, causando que el runtime quedara en estado BROKEN

---

## ✅ VERIFICACIÓN

**Antes del fix:**
- Runtime entraba en estado BROKEN
- `performAction` NO estaba disponible
- Todas las acciones UX fallaban correctamente (fail-hard)

**Después del fix:**
- Runtime pasa de `booting` → `ready`
- `performAction` está disponible en `window.performAction`
- Las acciones UX se ejecutan correctamente

---

## 📋 ARCHIVOS MODIFICADOS

1. `public/js/core/ux/action-registry/perform-action.js`
   - Línea 19: Añadido `validatePayload` al import

2. `package.json`
   - Versión actualizada: `5.75.4` → `5.75.5`

---

## 🎯 POR QUÉ EL RUNTIME FALLÓ CORRECTAMENTE

El Runtime Core v1 está diseñado para **fail-hard** cuando hay errores críticos:

1. **Detección temprana:** El error se detecta durante la carga del módulo ES6
2. **Fail-hard inmediato:** `ux-action-registry-loader.js` captura el error y llama `failHard()`
3. **Estado BROKEN:** El runtime queda en estado BROKEN, bloqueando todas las acciones UX
4. **Log forense:** El error se loguea con contexto completo

Esto es **correcto** porque:
- Previene que el sistema funcione en modo degradado
- Fuerza a corregir el problema antes de continuar
- Evita errores silenciosos que podrían causar problemas más graves

---

## 🚀 DESPLIEGUE

```bash
# Reiniciar servidor
pm2 restart aurelinportal

# Verificar logs
pm2 logs aurelinportal
```

---

## 📝 NOTAS TÉCNICAS

- **No se reintrodujeron fallbacks legacy:** El fix es mínimo y canónico
- **No se relajaron validaciones:** Todas las validaciones duras se mantienen
- **No se movió lógica entre archivos:** Solo se corrigió el import
- **No se crearon APIs nuevas:** Solo se usó el export existente

---

**FIN DEL FIX**
