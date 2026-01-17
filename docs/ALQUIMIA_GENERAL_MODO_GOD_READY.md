# 🏛️ Alquimia General - Modo GOD Ready

**Fecha:** 2025-01-27  
**Versión:** 5.78.0  
**Estado:** CERRADO ONTOLÓGICAMENTE

---

## Estatuto

Este documento describe las **garantías constitucionales** implementadas en Alquimia General que preparan el sistema para **MODO GOD** (cerrado ontológicamente, sin fallbacks ocultos, sistema que NO MIENTE).

---

## ✅ Garantías Implementadas

### 1. state_by_view_layer → FAIL-HARD (A1)

**Regla Constitucional:** Si falta `state_by_view_layer[view_layer]`:
- ❌ NO renderizar columnas
- ❌ NO fallback
- ❌ NO continuar
- ✅ Lanzar error visible: `[INVARIANT_BROKEN][STATE_BY_VIEW_LAYER_MISSING]`

**Implementación:**
- Backend valida fail-hard en `list-projection-model.js` (líneas 857-898)
- Backend valida fail-hard en `alquimia-general-service.js` (líneas 883-928, 1017-1056)
- Frontend valida fail-hard en `master-alquimia-general-client.js` (líneas 2780-2804)
- Logs forenses obligatorios: `[CPM_V2][OUTPUT][STATE_BY_VIEW_LAYER_OK]`

**Archivos:**
- `src/core/master/services/list-projection-model.js`
- `src/services/alquimia-general-service.js`
- `public/js/master/master-alquimia-general-client.js`

---

### 2. Refresh Engine → Surface Obligatoria (A2)

**Regla Constitucional:** `buildRefreshPlan()` NUNCA puede devolver `[]`.

Si ocurre:
- ✅ Inyectar forzosamente `alquimia.list_projection`
- ❌ El fallback legacy queda prohibido

**Implementación:**
- `buildRefreshPlan()` blindado en `alquimia-actions.js` (líneas 73-81)
- Refresh Engine elimina fallback legacy en `master-alquimia-general-client.js` (líneas 6524-6580)
- Si surfaces está vacío → ERROR fail-hard, no ejecutar refresh
- Si registry no disponible → ERROR fail-hard

**Archivos:**
- `src/core/ux/action-registry/alquimia-actions.js`
- `public/js/master/master-alquimia-general-client.js`

---

### 3. UX Reset/Clean con applied = 0 (A3)

**Regla Constitucional:** `applied = 0` NO es éxito.

**Implementación:**
- Validación condicional: `if (applied === 0) { showToastWarning(...) }`
- Mensaje claro: "No se aplicaron cambios (acción idempotente o sin efecto)"
- Aplicado en:
  - Reset individual (línea 1642)
  - Reset lista ALL (línea 1718)
  - Reset ALL flotante (línea 4809)
  - Reset individual flotante (línea 4929)

**Archivos:**
- `public/js/master/master-alquimia-general-client.js`
- `public/js/master/ui/toast.js` (añadido `showToastWarning`)

---

### 4. Fallback Legacy Eliminado (A4)

**Regla Constitucional:** `student.state` NO SE USA.

Si falta `state_by_view_layer`:
- ✅ Error
- ❌ No render
- ❌ No columnas

**Implementación:**
- Eliminado fallback a `student.state` en `master-alquimia-general-client.js` (líneas 2780-2804)
- Eliminada columna `_error` (líneas 2897-2910 eliminadas)
- Fail-hard inmediato si falta `state_by_view_layer[view_layer]`

**Archivos:**
- `public/js/master/master-alquimia-general-client.js`

---

## 🛡️ Qué Ya No Puede Romperse

### Columnas Incorrectas
- **Antes:** Fallback a `student.state` podía desincronizar
- **Ahora:** Fail-hard si falta `state_by_view_layer` → columnas siempre correctas

### Refresh Sin Efecto
- **Antes:** Fallback legacy podía no refrescar superficies correctas
- **Ahora:** Surfaces obligatorias → refresh siempre ejecuta superficies declarativas

### Éxito Falso
- **Antes:** UI mostraba éxito aunque `applied=0`
- **Ahora:** Warning amarillo si `applied=0` → usuario ve la verdad

### Estado Desincronizado
- **Antes:** `state_by_view_layer` podía faltar sin detección
- **Ahora:** Validación fail-hard en backend y frontend → estado siempre coherente

---

## 🔍 Qué Errores Ahora Son Visibles

### Errores Constitucionales (Fail-Hard)

1. **`[INVARIANT_BROKEN][STATE_BY_VIEW_LAYER_MISSING]`**
   - **Cuándo:** Backend o frontend detecta falta de `state_by_view_layer[view_layer]`
   - **Dónde:** Logs estructurados + throw error
   - **Efecto:** No render, error visible

2. **`[INVARIANT_BROKEN][REFRESH_SURFACE_EMPTY]`**
   - **Cuándo:** `buildRefreshPlan()` retorna `[]` (no debería ocurrir con blindaje)
   - **Dónde:** Refresh Engine v2
   - **Efecto:** No ejecutar refresh, error visible

3. **`[INVARIANT_BROKEN][REFRESH_SURFACE_REGISTRY_MISSING]`**
   - **Cuándo:** Refresh Surface Registry no está disponible
   - **Dónde:** Refresh Engine v2
   - **Efecto:** No ejecutar refresh, error visible

### Advertencias (No Bloqueantes)

1. **Toast Warning: "No se aplicaron cambios"**
   - **Cuándo:** `applied=0` en reset/clean
   - **Dónde:** UI toast amarillo
   - **Efecto:** Usuario ve que acción no tuvo efecto

---

## 📋 Checklist de Verificación

Para verificar que el sistema está en MODO GOD:

- [ ] Backend valida fail-hard si falta `state_by_view_layer`
- [ ] Frontend valida fail-hard si falta `state_by_view_layer[view_layer]`
- [ ] `buildRefreshPlan()` nunca retorna `[]`
- [ ] No existe `[LEGACY_REFRESH]` en logs
- [ ] UI muestra warning si `applied=0`
- [ ] No existe fallback a `student.state`
- [ ] No existe columna `_error`
- [ ] Logs forenses `[CPM_V2][OUTPUT][STATE_BY_VIEW_LAYER_OK]` presentes

---

## 🎯 Resultado Final

**Alquimia General NO MIENTE:**
- Las columnas son verdad (fuente única canónica)
- El sistema está cerrado ontológicamente (sin fallbacks ocultos)
- Los errores son visibles (fail-hard, no silenciosos)
- El usuario ve la verdad (no "éxito falso")

**Preparado para MODO GOD:** ✅

---

**Referencias:**
- `docs/INVARIANTES_CONSTITUCIONALES.md` (Invariantes 13, 14, 15)
- `docs/diagnosticos/alqg_total_v1_runtime/` (Auditoría forense completa)
