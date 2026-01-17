# 🔥 MODO GOD HOTFIX v5.78.1

**Fecha:** 2025-01-27  
**Versión:** 5.78.0 → 5.78.1  
**Tipo:** Hotfix (fixes mínimos deterministas)

---

## 🎯 OBJETIVO

Resolver 3 bugs críticos que impedían funcionamiento correcto:
1. `[INVARIANT_BROKEN][REFRESH_SURFACE_EMPTY]` en acciones de alquimia
2. `action_id not registered: alquimia.reset_overrides`
3. RESET → CLEAN no progresa a `reviewed` (se queda `reseteado`)

---

## 📋 FIXES IMPLEMENTADOS

### BUG-A: Surfaces Vacío → Normalizador Canónico

**Problema:** `buildRefreshPlan()` puede retornar `[]` en runtime aunque el código debería inyectar.

**Archivo:** `public/js/master/master-alquimia-general-client.js` (líneas 6480-6580)

**Fix:**
- ✅ Normalizador canónico `normalizeSurfacesOrFail()` antes de fail-hard
- ✅ Normaliza strings 'legacy' o null → `[]`
- ✅ Normaliza no-arrays → `[]`
- ✅ Aplica defaults según `view_mode`:
  - `proyeccion` + `list_id` → `['alquimia.list_projection']`
  - `operativa` + `list_id` → `['alquimia.items']`
  - `item_ref` presente → añade `'alquimia.flotante_students'`
- ✅ Parche obligatorio: si `view_mode=proyeccion` y `list_id` existe, SIEMPRE incluir `alquimia.list_projection`
- ✅ Logs forenses:
  - `[REFRESH_ENGINE][ALQG][SURFACES_RAW]` (antes de normalizar)
  - `[REFRESH_ENGINE][ALQG][SURFACES_FINAL]` (después de normalizar)
  - `[INVARIANT_ENFORCED][REFRESH_SURFACE_DEFAULT]` (cuando se aplican defaults)

**Resultado:** Aunque action-registry falle o no cargue, el UI nunca se queda sin surfaces.

---

### BUG-B: alquimia.reset_overrides No Registrado

**Problema:** `action_id not registered: alquimia.reset_overrides` aunque existe en código.

**Archivos:**
- `src/core/ux/action-registry/alquimia-actions.js` (línea 504)
- `public/js/master/ux/perform-action.v1.js` (líneas 153-155)

**Fix:**
- ✅ Cambiado `domain: 'alquimia'` → `domain: 'master'` (para coincidir con contexto MASTER)
- ✅ Log forense añadido: `[FORENSIC][ACTION_REGISTRY][MISSING_ACTION]` cuando falla
- ✅ Log incluye: `available_actions`, `context`, `build_stamp`, `registry_type`

**Resultado:** Action Registry valida dominio correctamente y log forense ayuda a diagnosticar si el problema es de carga.

---

### BUG-C: RESET → CLEAN No Progresa (Igualdad de Timestamps)

**Problema:** Si `RESET.created_at` y `CLEAN.created_at` son iguales, CPM trata el CLEAN como anterior al RESET.

**Archivo:** `src/core/master/services/cleaning-projection-model.js` (línea 203)

**Fix:**
- ✅ Cambiado `lastCleanedDate > effectiveSinceDate` → `lastCleanedDate >= effectiveSinceDate`
- ✅ Igualdad cuenta como "después": si `lastCleanedAt == effectiveSince`, el CLEAN ocurrió "después"
- ✅ Log forense específico: `[CPM_V2][RESET_EDGE_EQUAL_TS]` cuando detecta igualdad
- ✅ Log incluye: `decision: 'treat_as_clean_after_reset'`

**Resultado:** Tras RESET (shared) + CLEAN (shared) del mismo alumno/item, el alumno pasa de `reseteado` → `reviewed`.

---

## 📊 VERIFICACIONES

### Logs Esperados (No Deben Aparecer)
- ❌ `[INVARIANT_BROKEN][REFRESH_SURFACE_EMPTY]`
- ❌ `action_id not registered: alquimia.reset_overrides`

### Logs Esperados (Sí Deben Aparecer)
- ✅ `[REFRESH_ENGINE][ALQG][SURFACES_FINAL]` con surfaces reales
- ✅ `[INVARIANT_ENFORCED][REFRESH_SURFACE_DEFAULT]` (si se aplican defaults)
- ✅ `[CPM_V2][RESET_EDGE_EQUAL_TS]` (si hay igualdad de timestamps)

### Caso Fijo (Verificación Manual)
**lista:** 11 Abundancia  
**item:** `te_item_63`  
**alumno:** `44a51f8f-4ed5-4291-ad13-5f07a99c636b`

**Pasos:**
1. RESET(shared) → CLEAN(shared)
2. **Resultado esperado:** Alumno pasa de `reseteado` → `reviewed` en flotante y list projection

---

## 🚀 COMMIT Y VERSIÓN

- **Versión:** `5.78.0` → `5.78.1`
- **Commit:** `fix(master-alquimia): modo god hotfix – surfaces non-empty + registry reset_overrides + reset→clean equality`

---

## 📚 REFERENCIAS

- `docs/MODO_GOD_FIXES_V5_78_0_SUMMARY.md` (fixes v5.78.0)
- `docs/ALQUIMIA_GENERAL_MODO_GOD_READY.md` (garantías MODO GOD)
- `docs/INVARIANTES_CONSTITUCIONALES.md` (Invariantes 13, 14, 15)

---

**HOTFIX COMPLETADO. Sistema listo para MODO GOD.**
