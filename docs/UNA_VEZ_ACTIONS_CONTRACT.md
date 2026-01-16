# UNA_VEZ Actions Contract v1

**Versión**: 1.0.0  
**Fecha**: 2024-12-19  
**Estado**: CANÓNICO

---

## Resumen Ejecutivo

Los items `una_vez` tienen un conjunto **muy limitado** de acciones permitidas. Solo pueden incrementar contadores (`+1 SHARED` y `+1 PDE`). **NO tienen reset**.

---

## Reglas Constitucionales

### 1. Solo Incrementos Permitidos

- ✅ **PERMITIDO**: `+1 SHARED` (incrementar contador shared)
- ✅ **PERMITIDO**: `+1 PDE` (incrementar contador pde)
- ❌ **PROHIBIDO**: Reset (cualquier tipo de reset)
- ❌ **PROHIBIDO**: `clean_all` (solo existe para `recurrente`)

### 2. NO Existe Reset para UNA_VEZ

**REGLA DURA**: Reset está **PROHIBIDO** para `una_vez`.

**Razón**: Los items `una_vez` son contadores simples (`completed` / `remaining`). No tienen concepto de "resetear progreso" como los items `recurrente`.

**Error esperado**:
```json
{
  "ok": false,
  "error": "Reset está PROHIBIDO para item_kind=\"una_vez\". UNA_VEZ solo tiene contadores + overrides, no reset.",
  "code": "RESET_UNA_VEZ_FORBIDDEN",
  "status": 400
}
```

### 3. NO Existe EFFECTIVE para UNA_VEZ

- ✅ **PERMITIDO**: `view_layer='shared'` en `una_vez`
- ✅ **PERMITIDO**: `view_layer='pde'` en `una_vez`
- ✅ **PERMITIDO**: `view_layer='combo'` en `una_vez`
- ❌ **PROHIBIDO**: `view_layer='effective'` en `una_vez`

**Error esperado**:
```json
{
  "ok": false,
  "error": "view_layer=\"effective\" solo disponible para item_kind=\"recurrente\"",
  "code": "VIEW_LAYER_ITEM_KIND_MISMATCH",
  "status": 400
}
```

---

## Acciones Permitidas

### 1. Increment SHARED (+1 SHARED)

**Action ID**: `alquimia.increment.all` (con `clean_layer='shared'`)

**Endpoint**: `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`

**Payload**:
```json
{
  "clean_layer": "shared",
  "item_kind": "una_vez"
}
```

**Comportamiento**:
- Incrementa `shared_completed` en 1
- Decrementa `shared_remaining` en 1
- Actualiza `shared_last_cleaned_at` (timestamp actual)

**Validación**: `item_kind` debe ser `'una_vez'`

### 2. Increment PDE (+1 PDE)

**Action ID**: `alquimia.increment.all` (con `clean_layer='pde'`)

**Endpoint**: `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`

**Payload**:
```json
{
  "clean_layer": "pde",
  "item_kind": "una_vez"
}
```

**Comportamiento**:
- Incrementa `pde_completed` en 1
- Decrementa `pde_remaining` en 1 (si aplica)
- Actualiza `pde_last_cleaned_at` (timestamp actual)

**Validación**: `item_kind` debe ser `'una_vez'`

---

## UI: Botones Permitidos

### Proyección Alumno (scope='student', una_vez)

**Botones esperados**:
1. ✅ **+1 SHARED** / "Limpiar" (verde)
2. ✅ **+1 PDE** / "Limpiar interno" (morado)

**Botones PROHIBIDOS**:
- ❌ "Reset progreso"
- ❌ "Reset lista"
- ❌ "Limpiar" (bulk, solo para recurrente)

**Código de validación**:
```javascript
const itemKind = getItemKindExplicit(item, lista);

if (itemKind === 'una_vez') {
  // Solo renderizar botones de incremento
  // NO renderizar botones de reset
}
```

### Proyección ALL (scope='all', una_vez)

**Botones esperados**:
1. ✅ **+1** (verde, increment-all shared)
2. ✅ **Limpiar interno** (morado, increment-all pde)

**Botones PROHIBIDOS**:
- ❌ "Reset ALL"
- ❌ "Reset lista ALL"
- ❌ "Limpiar" (bulk, solo para recurrente)

---

## Estados de UNA_VEZ

### Estados Canónicos

Los items `una_vez` tienen estos estados:

1. `never` (gris) - Nunca trabajado (`completed === 0`)
2. `in_progress` (amarillo) - En proceso (`0 < completed < required_count`)
3. `completed` (verde) - Completado (`completed >= required_count`)
4. `empowered` (dorado) - Muy bien trabajado (`completed > required_count`)

**NOTA**: `important` NO existe para `una_vez`.

### View Layers

#### shared
Muestra estado basado en `shared_completed` y `shared_remaining`.

#### pde
Muestra estado basado en `pde_completed` y `pde_remaining`.

#### combo (default)
Muestra estado basado en `(shared_completed + pde_completed)` vs `required_count`.

**Ejemplo**:
- `required_count = 1`
- `shared_completed = 0`, `pde_completed = 1`
- `combo_state = 'completed'` (porque `0 + 1 >= 1`)

---

## Validaciones Backend

### Cleaning Engine

```javascript
// src/core/master/services/cleaning-engine-service.js

if (item_kind === 'una_vez' && action_type === 'reset') {
  throw new Error('Reset está PROHIBIDO para item_kind="una_vez"');
}
```

### Endpoints

```javascript
// src/endpoints/master-api-alquimia-general.js

// Reset endpoints
if (item_kind === 'una_vez') {
  return jsonError('Reset solo disponible para recurrente', 'ITEM_KIND_ERROR', 400);
}
```

---

## Flotante Students (UNA_VEZ)

### Botones de Layer View

**Permitidos**:
- ✅ **SHARED** (siempre)
- ✅ **PDE** (siempre)
- ✅ **COMBO** (default para una_vez)

**Prohibidos**:
- ❌ **EFFECTIVE** (solo para recurrente)

**Código**:
```javascript
const itemKind = item.item_kind || item.tipo;

// Solo mostrar EFFECTIVE si es recurrente
const showEffectiveButton = itemKind === 'recurrente';

// Solo mostrar COMBO si es una_vez
const showComboButton = itemKind === 'una_vez';
```

---

## Logs Forenses

Todas las acciones en `una_vez` deben emitir logs estructurados:

```
[UNA_VEZ][INCREMENT] Incrementando contador
{
  item_ref: "...",
  clean_layer: "shared",
  item_kind: "una_vez",
  before: { completed: 0, remaining: 1 },
  after: { completed: 1, remaining: 0 }
}
```

**Error si se intenta reset**:
```
[RESET][UNA_VEZ_FORBIDDEN] Intento de reset en UNA_VEZ
{
  item_ref: "...",
  item_kind: "una_vez",
  error: "Reset está PROHIBIDO para item_kind=\"una_vez\""
}
```

---

## Checklist de Verificación

### Backend
- [ ] Reset endpoints rechazan `una_vez` con `RESET_UNA_VEZ_FORBIDDEN`
- [ ] Increment endpoints aceptan `una_vez` correctamente
- [ ] Cleaning Engine valida `item_kind` antes de reset

### Frontend
- [ ] Botones reset NO aparecen para `una_vez`
- [ ] Solo se muestran botones +1 SHARED y +1 PDE
- [ ] Botón EFFECTIVE NO aparece en flotante para `una_vez`
- [ ] Botón COMBO aparece en flotante para `una_vez`

---

## Referencias

- `src/core/master/services/cleaning-engine-service.js` - Validación de reset
- `src/core/master/services/cleaning-projection-model.js` - Cálculo de estados una_vez
- `public/js/master/master-alquimia-general-client.js` - Renderizado de botones
- `docs/ALQUIMIA_CANONICA_V1.md` - Documentación general de Alquimia

---

**Última actualización**: 2024-12-19  
**Mantenido por**: AuriPortal Architecture Team
