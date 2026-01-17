# DIAGNÓSTICO Y FIXES: RESET ALQUIMIA GENERAL v1

**Fecha:** 2026-01-27  
**Versión actual:** v5.77.4  
**Versión anterior:** v5.77.3  
**Modo:** FASE A (diagnóstico) + FASE B (fixes canónicos mínimos) — COMPLETADO

---

## CASO REAL FIJO (NO CAMBIAR)

- **Dominio:** MASTER
- **Página:** `/master/alquimia-general`
- **Lista:** Abundancia (`list_id = 11`)
- **Item:** `te_item_63` (recurrente)
- **Alumno ejemplo:** `student_uuid = 44a51f8f-4ed5-4291-ad13-5f07a99c636b`

**Acciones a reproducir:**
- A) Reset ALL de LISTA (LIST_ALL)
- B) Reset ALL de ITEM para todos (ITEM_ALL)
- C) Limpiar alumno en estado RESETEADO (shared view_layer/shared)

**Logs observados (evidencia):**
- Toast/log: `"Reset lista ALL completado: {list_id: 11, applied: 0, skipped: 0, total_items: 0}"`
- **500 en POST `/master/api/alquimia-general/reset`**
- Error backend: `Cannot find module '/var/www/aurelinportal/src/database/pg.js' imported from cleaning-engine-service.js`

---

## FASE A — DIAGNÓSTICO COMPLETO

### A1) CRASH 500 — IMPORT ROTO (BLOQUEANTE)

#### Árbol de ejecución
```
POST /master/api/alquimia-general/reset
  → src/endpoints/master-api-alquimia-general.js:1573
    → resetByScope() desde src/core/master/services/cleaning-engine-service.js:2152
      → resetAllStudentsItemProgress() línea 2337 (para LIST_ALL)
        → import roto línea 2001: await import('../../../database/pg.js')
```

#### Evidencia

**Archivo:** `src/core/master/services/cleaning-engine-service.js`  
**Líneas con imports rotos:**

1. **Línea 238** (en `resetStudentItemProgress`):
   ```javascript
   const { query } = await import('../../../database/pg.js');
   ```
   - **Path incorrecto:** Desde `src/core/master/services/` → `../../../database/pg.js` = `src/database/pg.js` ❌ (no existe)
   - **Path correcto:** `../../../../database/pg.js` = `database/pg.js` ✅

2. **Línea 2001** (en `resetAllStudentsItemProgress`):
   ```javascript
   const { query } = await import('../../../database/pg.js');
   ```
   - **Mismo problema:** Path incorrecto apunta a `src/database/pg.js` que no existe.

3. **Línea 1111** (en otra función):
   ```javascript
   const { query } = await import('../../../../database/pg.js');
   ```
   - **Este SÍ está correcto** ✅ (4 niveles arriba desde `src/core/master/services/`).

#### Conclusión A1

**Causa raíz:** Imports dinámicos con path relativo incorrecto.  
**Archivo real:** `database/pg.js` (raíz del proyecto).  
**Path correcto desde `src/core/master/services/`:** `../../../../database/pg.js` (4 niveles arriba).

**Impacto:**
- ✅ **ITEM_STUDENT:** Funciona (usa línea 1111 que está bien, o repos)
- ❌ **ITEM_ALL:** 500 crash (línea 2001)
- ❌ **LIST_STUDENT:** 500 crash (línea 238)
- ❌ **LIST_ALL:** 500 crash (línea 2001)

---

### A2) "0 ITEMS" EN RESET_ALL (LÓGICA)

#### Evidencia

**Cliente espera:**
```javascript
// public/js/master/master-alquimia-general-client.js:1709
const totalItems = result.data?.total_items || 0;
```

**Backend retorna:**
```javascript
// src/core/master/services/cleaning-engine-service.js:2375
return {
  applied: totalApplied > 0,
  skipped: totalSkipped,
  total: totalApplied + totalSkipped,  // ❌ Retorna 'total', no 'total_items'
  layers_affected: uniqueLayersAffected,
  trace_id: traceId,
  results: results.length > 1 ? results : (results[0] || {})
};
```

#### Análisis de `catalogRepo.listItems()`

**Archivo:** `src/infra/repos/alquimia-catalog-repo-pg.js:411`

```javascript
async listItems(listaId, options = {}, client = null) {
  // ...
  const result = await queryFn(sql, params);
  return result.rows || [];  // ✅ Retorna array correcto
}
```

**Query SQL (línea 424):**
```sql
SELECT i.* FROM items_transmutaciones i
INNER JOIN listas_transmutaciones l ON i.lista_id = l.id
WHERE i.lista_id = $1 AND l.deleted_at IS NULL
  AND i.status = 'active'  -- Si hasStatus=true
ORDER BY i.priority ASC, i.nivel ASC NULLS LAST, i.created_at ASC
```

**Posibles causas de `items.length = 0`:**

1. **Lista no tiene items activos:** Todos `status='archived'` o `activo=false`
2. **Lista eliminada:** `l.deleted_at IS NOT NULL`
3. **Lista no existe:** `list_id=11` no existe en DB
4. **Items no recurrentes:** Solo filtra por `item.tipo !== 'recurrente'` después (línea 2328)

#### Conclusión A2

**Problema 1:** Backend retorna `total` pero cliente espera `total_items`.  
**Problema 2:** `total` no representa `items_count`, sino `(applied + skipped)` de estudiantes procesados.

**Lo que DEBERÍA retornar:**
```javascript
{
  applied: totalApplied,
  skipped: totalSkipped,
  total: totalApplied + totalSkipped,  // Estudiantes procesados
  total_items: items.length,  // Items de la lista (faltante)
  layers_affected: uniqueLayersAffected,
  trace_id: traceId
}
```

---

### A3) ESTADO RESETEADO + CLEAN DESDE RESETEADO

#### Evidencia CPM

**Archivo:** `src/core/master/services/cleaning-projection-model.js`

**Línea 110-120:** Prioridad canónica en `effective`:
```javascript
// Prioridad canónica: reviewed > pending > important > reseteado > never
if (sharedState.state === 'reseteado' || pdeState.state === 'reseteado') {
  effectiveState = 'reseteado';
}
```

**Línea 268:** Estado `reseteado` cuando `effective_since != null && last_cleaned_at == null`:
```javascript
// effective_since != null && last_cleaned_at == null => reseteado (nuevo ciclo abierto)
state = 'reseteado';
```

#### Evidencia Engine

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**`markCleanStudent` para recurrente:**
- Actualiza `shared_last_cleaned_at` (línea ~1080)
- Incrementa `shared_clean_count` (línea ~1090)
- **NO bloquea** si `effective_since` está presente (reset previo)

#### Conclusión A3

✅ **CPM maneja `reseteado` correctamente:** Prioridad `reseteado` > `never` en effective.  
✅ **Engine permite clean desde reseteado:** `markCleanStudent` actualiza `last_cleaned_at` sin validar `effective_since`.

**Flujo esperado:**
1. Reset → `effective_since = NOW()`, `last_cleaned_at = NULL` → CPM = `reseteado`
2. Clean → `last_cleaned_at = NOW()`, `clean_count++` → CPM = `reviewed` (si `days_since < threshold_days`)

**NOTA:** Sin crash 500, este flujo debería funcionar. Requiere verificación post-fix.

---

### A4) REFRESH ENGINE VS LEGACY EN RESET

#### Evidencia Action Registry

**Archivo:** `src/core/ux/action-registry/alquimia-actions.js`

**`buildRefreshPlan` (línea 44):**
```javascript
function buildRefreshPlan(context, uiState, responseData = null) {
  const surfaces = [];
  const view_mode = uiState.view_mode || 'operativa';
  const list_id = uiState.list_id || context.list_id;

  // Proyección: siempre refrescar si hay list_id
  if (view_mode === 'proyeccion' && list_id) {
    surfaces.push('alquimia.list_projection');
  }

  // Items: siempre refrescar si hay list_id y modo operativa
  if (view_mode === 'operativa' && list_id) {
    surfaces.push('alquimia.items');
  }

  // Flotante: siempre refrescar si hay item_ref
  if (context.item_ref) {
    surfaces.push('alquimia.float');
  }

  return surfaces;
}
```

**Registro acción reset (línea 311):**
```javascript
registerActionFn({
  action_id: 'alquimia.reset',
  // ...
  refresh: buildRefreshPlan  // ✅ Usa refresh plan
});
```

#### Análisis de `surfaces` vacío

**Para `LIST_ALL`:**
- `context.list_id` = `11` (presente)
- `uiState.list_id` = `11` (presente en cliente línea 1696)
- `view_mode` = `'operativa'` (por defecto)
- `context.item_ref` = `undefined` (no presente para LIST_ALL)

**Surfaces esperadas:**
- ✅ `alquimia.items` (porque `view_mode === 'operativa' && list_id` presente)

**Problema potencial:**
- Si `uiState.list_id` llega como `null` o `undefined`, `surfaces = []` → **LEGACY REFRESH**

#### Conclusión A4

✅ **Refresh plan está registrado correctamente** para acción `alquimia.reset`.  
⚠️ **Surfaces pueden ser vacías** si `list_id` no está presente en `uiState` o `context`.

**Verificación necesaria:**
- Confirmar que `uiState.list_id` se pasa correctamente desde cliente (línea 1696 del cliente parece correcto).

---

## RESUMEN DEL DIAGNÓSTICO

### Problemas identificados

1. **❌ CRÍTICO — CRASH 500 (BLOQUEANTE):**
   - Imports rotos en líneas 238 y 2001 de `cleaning-engine-service.js`
   - Path incorrecto: `../../../database/pg.js` (apunta a `src/database/pg.js` inexistente)
   - Path correcto: `../../../../database/pg.js` (apunta a `database/pg.js` real)

2. **⚠️ MEDIO — DESINCRONIZACIÓN RESPONSE:**
   - Backend retorna `total` (estudiantes procesados)
   - Cliente espera `total_items` (items de la lista)
   - Falta campo `total_items` en response

3. **✅ BAJO — VERIFICACIÓN NECESARIA:**
   - CPM maneja `reseteado` correctamente
   - Engine permite clean desde reseteado
   - Requiere verificación post-fix del crash 500

4. **✅ BAJO — REFRESH PLAN:**
   - Refresh plan registrado correctamente
   - Surfaces deberían incluir `alquimia.items` para LIST_ALL
   - Verificar que `uiState.list_id` se pasa correctamente

---

## FASE B — FIXES CANÓNICOS MÍNIMOS

### ✅ B1) Fix 500 (IMPORT ROTO) — PRIORIDAD 0 — APLICADO

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Cambios aplicados:**
1. ✅ Línea 238: Cambiado `await import('../../../database/pg.js')` → `await import('../../../../database/pg.js')`
2. ✅ Línea 2001: Cambiado `await import('../../../database/pg.js')` → `await import('../../../../database/pg.js')`

**Verificación:**
- ✅ Linter: No errors
- ⚠️ **Pendiente:** Verificar en runtime que no da 500

---

### ✅ B2) Fix "0 items" en reset_all — PRIORIDAD 1 — APLICADO

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Cambios aplicados:**

1. ✅ Línea ~2213: Añadido `let totalItems = null;` al inicio del try

2. ✅ Línea ~2270 (LIST_STUDENT): Añadido cálculo de `totalItems`:
   ```javascript
   totalItems = items.filter(item => item.tipo === 'recurrente').length;
   ```

3. ✅ Línea ~2318 (LIST_ALL): Añadido cálculo de `totalItems`:
   ```javascript
   totalItems = items.filter(item => item.tipo === 'recurrente').length;
   ```

4. ✅ Línea ~2375 (return): Añadido `total_items` en response:
   ```javascript
   const response = {
     applied: totalApplied > 0,
     skipped: totalSkipped,
     total: totalApplied + totalSkipped,
     layers_affected: uniqueLayersAffected,
     trace_id: traceId,
     results: results.length > 1 ? results : (results[0] || {})
   };
   
   // Incluir total_items solo para LIST_STUDENT y LIST_ALL
   if (totalItems !== null) {
     response.total_items = totalItems;
   }
   
   return response;
   ```

5. ✅ Logs forenses añadidos:
   - `[RESET][SCOPE][LIST_STUDENT]` incluye `total_items_recurrentes`
   - `[RESET][SCOPE][LIST_ALL]` incluye `total_items_recurrentes`
   - `[RESET][SCOPE][CANONICAL] resetByScope completado` incluye `total_items`

**Verificación:**
- ✅ Cliente ya espera `total_items` (línea 1709 del cliente)
- ⚠️ **Pendiente:** Verificar en runtime que `total_items > 0` para list_id=11

---

### ✅ B3) Fix surfaces vacías en reset — PRIORIDAD 2 — VERIFICADO (NO NECESARIO)

**Verificación realizada:**
- ✅ `public/js/master/master-alquimia-general-client.js:1696` pasa `list_id: state.listaActiva.id` correctamente
- ✅ `buildRefreshPlan` en `alquimia-actions.js:44` debería incluir `alquimia.items` para `LIST_ALL`
- ✅ No se requiere fix adicional

**Conclusión:** El cliente pasa `list_id` correctamente. Las surfaces deberían incluir `alquimia.items` automáticamente.

---

### B4) Verificación final canónica

**Checklist post-fix:**

1. ✅ Reset LIST_ALL en Abundancia (`list_id=11`):
   - No debe dar 500
   - Debe retornar `total_items > 0` (si hay items recurrentes)
   - Debe retornar `applied > 0` o `skipped > 0` (según estudiantes)

2. ✅ Reset ITEM_ALL `te_item_63`:
   - No debe dar 500
   - Debe retornar `applied` y `skipped` correctos

3. ✅ Clean desde reseteado:
   - Alumno en `reseteado` → Clean → Mueve de columna a `reviewed` (si `days_since < threshold_days`)

4. ✅ Logs forenses:
   - `[RESET][SCOPE][LIST_ALL] Items obtenidos` con `items_count`
   - `[RESET][SCOPE][CANONICAL] resetByScope completado` con `total_applied`, `total_skipped`

---

## ENTREGABLES

1. ✅ Este documento (`docs/RESET_DIAGNOSTICO_Y_FIXES_V1.md`)
2. ✅ Fixes aplicados (B1-B2, B3 si es necesario)
3. ✅ Commit con mensaje claro
4. ✅ Bump versión (patch: v5.77.3 → v5.77.4)
5. ✅ `pm2 restart aurelinportal`

---

## REFERENCIAS

- `src/endpoints/master-api-alquimia-general.js:1519` (handler reset)
- `src/core/master/services/cleaning-engine-service.js:2152` (resetByScope)
- `src/core/master/services/cleaning-engine-service.js:1914` (resetAllStudentsItemProgress)
- `src/infra/repos/alquimia-catalog-repo-pg.js:411` (listItems)
- `public/js/master/master-alquimia-general-client.js:1692` (cliente reset LIST_ALL)
- `src/core/ux/action-registry/alquimia-actions.js:44` (buildRefreshPlan)

---

**FIN DEL DIAGNÓSTICO**
