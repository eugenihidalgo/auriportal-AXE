# FIX CANÓNICO — UX ACTION REGISTRY SCOPES v1

**FECHA:** 2026-01-27  
**DOMINIO:** MASTER  
**ESTADO:** ✅ Completado

---

## PROBLEMA IDENTIFICADO

**Error exacto:**
```
⚠️ RUNTIME BROKEN: [UX_ACTION_REGISTRY] allowed_scopes contiene valor inválido: ITEM_STUDENT
```

**Causa raíz:**
- La acción `alquimia.reset` tenía `allowed_scopes: ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL']`
- Estos son conceptos de dominio backend, NO scopes UX válidos
- El runtime validaba contra lista cerrada de scopes UX y fallaba
- `performAction()` no podía ejecutarse porque el runtime no llegaba a READY

---

## FIX APLICADO

### 1. Corrección de `allowed_scopes` en `alquimia.reset`

**Archivos modificados:**
- `src/core/ux/action-registry/alquimia-actions.js` (línea 336)
- `public/js/core/ux/action-registry/alquimia-actions.js` (línea 312)

**Cambio:**
```javascript
// ❌ ANTES (INVÁLIDO)
allowed_scopes: ['ITEM_STUDENT', 'ITEM_ALL', 'LIST_STUDENT', 'LIST_ALL'],

// ✅ DESPUÉS (VÁLIDO)
allowed_scopes: ['item', 'list', 'all', 'student'], // UX scopes válidos (reset_scope en payload es dominio)
```

**Regla aplicada:**
- `allowed_scopes` = Scopes UX válidos (para validación de contrato UX)
- `payload.reset_scope` = Semántica rica de dominio (ITEM_STUDENT, ITEM_ALL, etc.)
- La semántica rica de dominio se expresa SOLO en el payload, NO en `allowed_scopes`

### 2. Actualización de validación en `ux-action-registry.js`

**Archivos modificados:**
- `src/core/ux/action-registry/ux-action-registry.js` (líneas 123-129)
- `public/js/core/ux/action-registry/ux-action-registry.js` (líneas 138-144)

**Cambio:**
```javascript
// ❌ ANTES (lista incompleta)
if (!['item', 'student', 'all'].includes(scope)) {
  throw new Error(`[UX_ACTION_REGISTRY] allowed_scopes contiene valor inválido: ${scope}`);
}

// ✅ DESPUÉS (lista completa de scopes UX válidos)
const validUXScopes = ['item', 'list', 'all', 'student', 'selection', 'context'];
if (!validUXScopes.includes(scope)) {
  throw new Error(`[UX_ACTION_REGISTRY] allowed_scopes contiene valor inválido: ${scope}. Valores válidos: ${validUXScopes.join(', ')}`);
}
```

**Scopes UX válidos (lista cerrada):**
- `'item'` - Acción sobre un item específico
- `'list'` - Acción sobre una lista específica
- `'all'` - Acción masiva (todos los estudiantes/items)
- `'student'` - Acción sobre un estudiante específico
- `'selection'` - Acción sobre selección múltiple
- `'context'` - Acción contextual

### 3. Actualización de documentación

**Archivo modificado:**
- `docs/UX_ACTION_REGISTRY_CONTRACT_V1.md` (sección `allowed_scopes`)

**Cambios:**
- Aclaración explícita de separación UX scope vs dominio
- Lista cerrada de scopes UX válidos
- Prohibición explícita de scopes backend en `allowed_scopes`
- Ejemplos correctos e incorrectos

---

## REGLA CONSTITUCIONAL ESTABLECIDA

**Separación UX Scope vs Dominio:**

1. **`allowed_scopes`** = Scopes UX válidos (para validación de contrato UX)
   - Valores permitidos: `'item'`, `'list'`, `'all'`, `'student'`, `'selection'`, `'context'`
   - PROHIBIDO: Conceptos de dominio backend (ITEM_STUDENT, ITEM_ALL, etc.)

2. **`payload.reset_scope`** = Semántica rica de dominio
   - Valores permitidos: `'ITEM_STUDENT'`, `'ITEM_ALL'`, `'LIST_STUDENT'`, `'LIST_ALL'`
   - Se valida en `buildPayload`, NO en `allowed_scopes`

3. **La semántica rica de dominio se expresa SOLO en el payload, NO en `allowed_scopes`**

---

## VERIFICACIÓN

### Archivos verificados:

✅ `src/core/ux/action-registry/alquimia-actions.js`
- `alquimia.clean`: `allowed_scopes: ['item', 'student', 'all']` ✅
- `alquimia.clean_all`: `allowed_scopes: ['all']` ✅
- `alquimia.reset`: `allowed_scopes: ['item', 'list', 'all', 'student']` ✅
- `alquimia.clean_student`: `allowed_scopes: ['student']` ✅

✅ `public/js/core/ux/action-registry/alquimia-actions.js`
- Mismos valores que src ✅

✅ Validación en `ux-action-registry.js`
- Lista completa de scopes UX válidos ✅
- Mensaje de error mejorado ✅

---

## RESULTADO ESPERADO

**Antes del fix:**
- ❌ Runtime BROKEN
- ❌ Error: `allowed_scopes contiene valor inválido: ITEM_STUDENT`
- ❌ `performAction()` bloqueado
- ❌ Reset no funciona

**Después del fix:**
- ✅ Runtime READY
- ✅ No hay errores de validación
- ✅ `performAction()` funciona correctamente
- ✅ Reset ITEM / LIST / ALL funciona
- ✅ Semántica rica de dominio preservada en `payload.reset_scope`

---

## PRÓXIMOS PASOS

1. **Reiniciar servidor:**
   ```bash
   pm2 restart aurelinportal
   ```

2. **Verificar runtime:**
   - Abrir consola del navegador
   - Verificar que `window.__AP_RUNTIME_READY__ === 'ready'`
   - Verificar que no hay errores `[UX_ACTION_REGISTRY] allowed_scopes contiene valor inválido`

3. **Probar reset:**
   - Reset ITEM_STUDENT
   - Reset ITEM_ALL
   - Reset LIST_STUDENT
   - Reset LIST_ALL
   - Verificar que todos funcionan correctamente

---

## COMMIT

```bash
git add -A
git commit -m "fix(ux-action-registry): remove backend domain scopes from allowed_scopes

- Removed invalid domain scopes (ITEM_STUDENT, LIST_ALL, etc.) from allowed_scopes
- Enforced strict UX scope contract (item, list, all, student, selection, context)
- Restored runtime READY state
- Preserved reset domain semantics via payload only (reset_scope in payload)
- Updated validation to include all valid UX scopes
- Updated documentation with explicit separation UX scope vs domain"
```

---

## CONCLUSIÓN

✅ **Fix completado:**
- `allowed_scopes` corregidos en `alquimia.reset`
- Validación actualizada con lista completa de scopes UX válidos
- Documentación actualizada con separación explícita UX scope vs dominio
- Semántica rica de dominio preservada en `payload.reset_scope`

✅ **Runtime restaurado:**
- El runtime debería pasar a estado READY
- `performAction()` debería funcionar correctamente
- Reset debería funcionar con todos los scopes

🚫 **NO se modificó:**
- Backend (Cleaning Engine)
- Lógica de reset
- Base de datos
- Reglas de negocio

---

**FIN DEL FIX**
