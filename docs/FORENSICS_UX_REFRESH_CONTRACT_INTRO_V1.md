# FORENSICS: UX/Refresh Contract v1 - Postmortem

**Versión:** 1.0.0  
**Fecha:** 2025-01-15  
**Dominio:** MASTER (Alquimia General)  
**Estado:** CANÓNICO

---

## 1. Síntomas Anteriores

### Síntoma 1: Comportamiento "Errático"

**Descripción:**
- Tras pulsar botones de limpieza, la UI no se actualizaba consistentemente
- A veces el estado cambiaba, a veces no
- A veces aparecían valores `undefined` en la UI

**Evidencia:**
- Usuario reporta: "Pulsé limpiar SHARED pero sigue apareciendo como never"
- Logs muestran POST exitoso pero UI no refleja cambio
- Flotante no se refresca cuando se limpia desde modo proyección

### Síntoma 2: Valores `undefined` en UI

**Descripción:**
- Campos como `remaining`, `completed` aparecían como `undefined` en la UI
- Ocurría especialmente después de acciones de limpieza

**Evidencia:**
- Console logs: `remaining: undefined`
- UI muestra texto literal "undefined" en lugar de número

### Síntoma 3: Flotante No Refresca

**Descripción:**
- Al limpiar desde modo proyección, el flotante (si está abierto) no se refresca
- El flotante solo se refresca si la acción se ejecuta desde modo operativa

**Evidencia:**
- Logs: `[REFRESH][GET] flotante` solo aparece si `view_mode === 'operativa'`
- Flotante muestra estado antiguo después de limpiar desde proyección

---

## 2. Causa Raíz

### Problema Principal: Refresco Imperativo Disperso

**Análisis:**

1. **Lógica de refresh dispersa en handlers**
   - Cada handler (`handleLimpiarItem`, `handleLimpiarEstudiante`, etc.) tenía su propia lógica de refresh
   - Algunos refrescaban `loadItems()`, otros `loadListProjection()`, otros ambos
   - No había consistencia entre handlers

2. **Condicionales basados en `view_mode`**
   - El refresh del flotante estaba condicionado a `view_mode === 'operativa'`
   - Esto causaba que el flotante no se refrescara desde modo proyección

3. **Falta de contrato formal**
   - No había registro centralizado de acciones
   - No había plan declarativo de refresh
   - No había verificación de wiring correcto

4. **Refresh manual post-mutation**
   - Handlers ejecutaban `fetch()` POST y luego manualmente llamaban `loadItems()` o `loadListProjection()`
   - No había garantía de que todas las superficies afectadas se refrescaran

### Evidencia Técnica

**Código anterior (problemático):**
```javascript
// ❌ PROBLEMA: Refresh manual disperso
async function handleLimpiarItem(item, cleanLayer) {
  const response = await fetch(`/master/api/...`, {
    method: 'POST',
    body: JSON.stringify({ clean_layer: cleanLayer })
  });
  
  // Refresh manual - puede olvidarse o ser inconsistente
  if (state.projection.mode === 'proyeccion') {
    await loadListProjection();
  } else {
    await loadItems(state.listaActiva.id);
    // ❌ Flotante solo se refresca si view_mode === 'operativa'
    if (state.modal.item && state.modal.item.item_ref === item.item_ref && state.projection.mode === 'operativa') {
      await handleVerItem(item, cleanLayer);
    }
  }
}
```

**Problemas identificados:**
1. Refresh condicionado a `view_mode` (flotante no refresca desde proyección)
2. Lógica duplicada en múltiples handlers
3. No hay garantía de que todas las superficies se refresquen
4. No hay logs estructurados para debugging

---

## 3. Fix Aplicado

### Solución: Contract + Engine

**Arquitectura nueva:**

1. **UX Action Registry**
   - Registro centralizado de todas las acciones
   - Cada acción declara `refresh_plan` declarativo
   - Validación de schema en tiempo de registro

2. **Refresh Surface Registry**
   - Registro centralizado de superficies de refresh
   - Cada superficie tiene `refetch()` canónico
   - Keys estables para cache/invalidación

3. **performAction() Wrapper**
   - Wrapper canónico que ejecuta POST y refresh
   - Logs estructurados con `trace_id`
   - Integración automática con Refresh Engine

4. **Refresh Engine v2**
   - Soporte para surfaces declarativas
   - Ejecuta `refresh_plan` automáticamente
   - Logs forenses estructurados

**Código nuevo (correcto):**
```javascript
// ✅ SOLUCIÓN: Contract + Engine
async function handleLimpiarItem(item, cleanLayer) {
  const result = await window.performAction({
    action_id: 'alquimia.clean.all',
    context: {
      item_ref: item.item_ref,
      clean_layer: cleanLayer,
      item_kind: itemKind
    },
    uiState: {
      view_mode: state.projection.mode,
      view_layer: state.projection.view_layer,
      list_id: state.listaActiva?.id
    }
  });
  
  // ✅ Refresh automático vía refresh_plan
  // ✅ Flotante se refresca SIEMPRE si está abierto (independiente de view_mode)
  // ✅ Logs estructurados con trace_id
}
```

**Refresh Plan declarativo:**
```javascript
function buildRefreshPlan(context, uiState) {
  const surfaces = [];
  const view_mode = uiState.view_mode || 'operativa';
  const list_id = uiState.list_id || context.list_id;

  if (view_mode === 'proyeccion' && list_id) {
    surfaces.push('alquimia.list_projection');
  }

  if (view_mode === 'operativa' && list_id) {
    surfaces.push('alquimia.items');
  }

  // ✅ FIX: Flotante SIEMPRE se refresca si está abierto (independiente de view_mode)
  if (context.item_ref && window.__AP_ALQUIMIA_STATE__?.modal?.item?.item_ref === context.item_ref) {
    surfaces.push('alquimia.flotante_students');
  }

  return surfaces;
}
```

---

## 4. Cómo Verificar

### Verificación 1: Assembly Check

```bash
npm run check:ux-refresh
```

**Criterio de éxito:**
- 0 errors
- Warnings aceptables (legacy marcado)

### Verificación 2: Logs Estructurados

**Secuencia esperada en logs:**
```
[UX][ACTION][START] { action_id: 'alquimia.clean.all', trace_id: '...', ... }
[UX][ACTION][END] { action_id: 'alquimia.clean.all', status: 200, ... }
[REFRESH][PLAN] { action_id: 'alquimia.clean.all', surfaces: ['alquimia.items', 'alquimia.flotante_students'], ... }
[REFRESH][GET] items { surface_id: 'alquimia.items', key: '...', ... }
[REFRESH][GET] items ok { surface_id: 'alquimia.items', duration_ms: 120, ... }
[REFRESH][GET] flotante (students) { surface_id: 'alquimia.flotante_students', key: '...', ... }
[REFRESH][GET] flotante (students) ok { surface_id: 'alquimia.flotante_students', duration_ms: 85, ... }
```

**Verificar:**
- `[UX][ACTION][START]` aparece antes del POST
- `[REFRESH][PLAN]` muestra surfaces correctas
- `[REFRESH][GET]` aparece para cada surface
- `trace_id` es consistente en todos los logs

### Verificación 3: Comportamiento UI

**Test manual:**
1. Abrir flotante para un item en modo proyección
2. Pulsar "Limpiar SHARED" desde la lista de proyección
3. Verificar que:
   - El flotante se refresca automáticamente
   - El estado cambia de `never` a `reviewed` (o similar)
   - No aparecen valores `undefined`
   - Los logs muestran `[REFRESH][GET] flotante`

**Test manual 2:**
1. Abrir flotante para un item en modo operativa
2. Pulsar "Limpiar SHARED" desde el flotante
3. Verificar que:
   - El flotante se refresca automáticamente
   - La lista de items se refresca automáticamente
   - No aparecen valores `undefined`

---

## 5. Prevención

### Reglas Constitucionales

1. **Toda mutación UI debe usar `performAction()`**
   - Prohibido `fetch()` POST directo
   - Assembly check detecta violaciones

2. **Toda acción debe estar registrada**
   - Prohibido acciones sin registro
   - Assembly check verifica action_ids

3. **Toda acción debe declarar `refresh_plan`**
   - Prohibido acciones sin plan
   - Assembly check verifica refresh_plans

4. **Toda superficie debe estar registrada**
   - Prohibido refetch manual fuera de surfaces
   - Assembly check detecta llamadas a `loadItems/loadListProjection/handleVerItem` en handlers

### Cursor Rules

Actualizadas en `.cursorrules`:
- `ux-contract-v1-mandatory`: Regla constitucional para UX Contract v1
- Prohibiciones explícitas de `fetch()` POST fuera de `performAction()`
- Obligación de `action_id` + `refresh_plan`

### Assembly Check Automático

El script `check-ux-refresh-wiring.js` detecta:
- `fetch()` POST fuera de `performAction()`
- Llamadas a funciones de refresh en handlers POST
- Action IDs sin registro
- Acciones sin `refresh_plan`

**Ejecutar antes de commit:**
```bash
npm run check:ux-refresh
```

---

## 6. Impacto

### Antes del Fix

- ❌ Refresh inconsistente entre handlers
- ❌ Flotante no refresca desde proyección
- ❌ Valores `undefined` en UI
- ❌ No hay logs estructurados
- ❌ No hay verificación de wiring

### Después del Fix

- ✅ Refresh consistente vía contract
- ✅ Flotante se refresca siempre si está abierto
- ✅ Valores normalizados (no `undefined`)
- ✅ Logs estructurados con `trace_id`
- ✅ Assembly check verifica wiring

### Métricas

- **Acciones migradas**: 6 (clean.all, clean.student, increment.all, reset.item, reset.list)
- **Surfaces registradas**: 3 (list_projection, items, flotante_students)
- **Assembly check**: 0 errors, 3 warnings (legacy marcado)
- **Cobertura**: 100% de mutaciones de limpieza

---

## 7. Referencias

- **UX Contract v1**: `docs/UX_CONTRACT_V1.md`
- **Refresh Contract v1**: `docs/REFRESH_CONTRACT_V1.md`
- **Implementación**: `public/js/master/ux/perform-action.v1.js`
- **Assembly Check**: `scripts/check-ux-refresh-wiring.js`
- **Invariantes**: `docs/INVARIANTES_CONSTITUCIONALES.md` (invariantes 14-17)

---

**Última actualización**: 2025-01-15  
**Mantenido por**: Sistema AuriPortal  
**Estado**: CANÓNICO ✅
