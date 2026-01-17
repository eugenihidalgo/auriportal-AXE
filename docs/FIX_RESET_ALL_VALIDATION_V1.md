# FIX: Validación Action Registry para Reset ALL v1

**FECHA:** 2026-01-27  
**DOMINIO:** MASTER  
**TIPO:** Fix de validación Action Registry

---

## PROBLEMA IDENTIFICADO

El Action Registry estaba invalidando resets ALL porque `buildResetPayload()` exigía siempre `student_uuid`, incluso para `ITEM_ALL` y `LIST_ALL`.

**Error observado:**
```
"student_uuid es obligatorio para acciones de reset"
```

**Impacto:**
- `ITEM_ALL` no funcionaba desde UI
- `LIST_ALL` no funcionaba desde UI
- Ítems quedaban "encallados" aunque la DB estuviera correcta
- Backend funcionaba correctamente, pero frontend bloqueaba la acción

---

## CONTRATO CANÓNICO DE RESET

| reset_scope   | student_uuid | item_ref | list_id | clean_layer |
|--------------|--------------|----------|---------|-------------|
| `ITEM_STUDENT` | **OBLIGATORIO** | **SÍ** | NO | **OBLIGATORIO** |
| `LIST_STUDENT` | **OBLIGATORIO** | NO | **SÍ** | **OBLIGATORIO** |
| `ITEM_ALL` | **PROHIBIDO** | **SÍ** | NO | **OBLIGATORIO** |
| `LIST_ALL` | **PROHIBIDO** | NO | **SÍ** | **OBLIGATORIO** |

**Regla constitucional:**
- `student_uuid` está **PROHIBIDO** en `*_ALL`
- Si se incluye → **FAIL-LOUD** (error explícito)
- NO usar defaults
- NO borrar campos silenciosamente

---

## SOLUCIÓN IMPLEMENTADA

### Validaciones Condicionales por Scope

**Antes (incorrecto):**
```javascript
if (reset_scope === 'ITEM_STUDENT' || reset_scope === 'LIST_STUDENT') {
  if (!student_uuid) {
    throw new Error('student_uuid es obligatorio...');
  }
}
// ❌ No validaba que student_uuid estuviera PROHIBIDO en *_ALL
```

**Después (correcto):**
```javascript
// ITEM_STUDENT: require student_uuid + item_ref
if (reset_scope === 'ITEM_STUDENT') {
  if (!item_ref) {
    throw new Error('item_ref es obligatorio para reset_scope="ITEM_STUDENT"');
  }
  if (!student_uuid) {
    throw new Error('student_uuid es obligatorio para reset_scope="ITEM_STUDENT"');
  }
}

// LIST_STUDENT: require student_uuid + list_id
if (reset_scope === 'LIST_STUDENT') {
  if (!list_id) {
    throw new Error('list_id es obligatorio para reset_scope="LIST_STUDENT"');
  }
  if (!student_uuid) {
    throw new Error('student_uuid es obligatorio para reset_scope="LIST_STUDENT"');
  }
}

// ITEM_ALL: require item_ref, PROHIBIR student_uuid
if (reset_scope === 'ITEM_ALL') {
  if (!item_ref) {
    throw new Error('item_ref es obligatorio para reset_scope="ITEM_ALL"');
  }
  if (student_uuid) {
    throw new Error('student_uuid está PROHIBIDO para reset_scope="ITEM_ALL". Reset ALL no acepta student_uuid.');
  }
}

// LIST_ALL: require list_id, PROHIBIR student_uuid
if (reset_scope === 'LIST_ALL') {
  if (!list_id) {
    throw new Error('list_id es obligatorio para reset_scope="LIST_ALL"');
  }
  if (student_uuid) {
    throw new Error('student_uuid está PROHIBIDO para reset_scope="LIST_ALL". Reset ALL no acepta student_uuid.');
  }
}
```

### Construcción de Payload

**Antes (incorrecto):**
```javascript
if (student_uuid) {
  payload.student_uuid = student_uuid; // ❌ Se incluía siempre si existía
}
```

**Después (correcto):**
```javascript
// REGLA CONSTITUCIONAL: student_uuid SOLO para *_STUDENT, NUNCA para *_ALL
if (reset_scope === 'ITEM_STUDENT' || reset_scope === 'LIST_STUDENT') {
  if (student_uuid) {
    payload.student_uuid = student_uuid;
  }
}
// NOTA: Para *_ALL, student_uuid NO se incluye (ya validado arriba que no existe)
```

---

## ARCHIVOS MODIFICADOS

1. **`src/core/ux/action-registry/alquimia-actions.js`**
   - `buildResetPayload()`: Validaciones condicionales por scope
   - PROHIBIR `student_uuid` en `*_ALL` (fail-loud)
   - Construcción de payload condicional

2. **`public/js/core/ux/action-registry/alquimia-actions.js`**
   - Mismos cambios (consistencia frontend/backend)

3. **`docs/ALQUIMIA_RESET_CANONICAL_V1.md`**
   - Sección "Contrato de Payload Frontend" añadida
   - Explicación de por qué `student_uuid` está PROHIBIDO en `*_ALL`
   - Ejemplos de payload correcto e incorrecto

---

## VERIFICACIÓN

### Casos de Prueba

1. **Reset ITEM_ALL:**
   - ✅ No requiere `student_uuid`
   - ✅ Si se incluye `student_uuid` → Error explícito
   - ✅ Payload NO incluye `student_uuid`

2. **Reset LIST_ALL:**
   - ✅ No requiere `student_uuid`
   - ✅ Si se incluye `student_uuid` → Error explícito
   - ✅ Payload NO incluye `student_uuid`

3. **Reset ITEM_STUDENT:**
   - ✅ Requiere `student_uuid`
   - ✅ Si falta `student_uuid` → Error explícito
   - ✅ Payload incluye `student_uuid`

4. **Reset LIST_STUDENT:**
   - ✅ Requiere `student_uuid`
   - ✅ Si falta `student_uuid` → Error explícito
   - ✅ Payload incluye `student_uuid`

5. **Ítems "encallados":**
   - ✅ Vuelven a ser operables tras fix
   - ✅ Reset ALL funciona correctamente

---

## REGLAS CONSTITUCIONALES RESPETADAS

✅ NO crear nuevas rutas  
✅ NO modificar backend  
✅ NO añadir fallbacks silenciosos  
✅ NO introducir compatibilidad legacy falsa  
✅ PostgreSQL sigue siendo SOT  
✅ execution_key es BACKEND-ONLY  
✅ Reset NO vuelve a NUNCA, vuelve a PENDIENTE  
✅ El reset es una acción histórica visible  
✅ Fail-loud en validaciones  

---

## COMMIT

```
fix(action-registry): prohibit student_uuid in reset ALL scopes

- Added conditional validations by reset_scope in buildResetPayload()
- ITEM_ALL and LIST_ALL now PROHIBIT student_uuid (fail-loud)
- ITEM_STUDENT and LIST_STUDENT require student_uuid
- Payload construction respects scope constraints
- Fixes "encallados" items issue
- Updated documentation with payload contract section
```

---

## REFERENCIAS

- Documentación canónica: `docs/ALQUIMIA_RESET_CANONICAL_V1.md`
- Action Registry: `src/core/ux/action-registry/alquimia-actions.js`
- Resumen implementación: `docs/RESET_CANONICAL_V1_IMPLEMENTATION_SUMMARY.md`

---

**FIN DEL FIX**
