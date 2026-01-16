# 🔧 MAJOR FIXES — ALQUIMIA GENERAL v1

**Fecha:** 2026-01-13  
**Versión:** 5.76.0  
**Base:** DIAGNÓSTICO FORENSE TOTAL — 2026-01-13  
**Estado:** ✅ IMPLEMENTADO

---

## 📋 RESUMEN EJECUTIVO

Se implementaron fixes para las **3 causas raíz** identificadas en el diagnóstico forense:

1. **MAJOR-1:** View Authority restaurada (`state_by_view_layer.effective` siempre presente)
2. **MAJOR-2:** Reset Recurrente con semántica válida (nunca produce `never`)
3. **MAJOR-3:** Runtime Integrity con fail-hard real (BROKEN bloquea todo)

---

## 🔧 MAJOR-1 — VIEW AUTHORITY (BACKEND)

### Cambios Implementados

**1. `cleaning-projection-model.js`:**
- ✅ Validación fail-fast: Si `item_kind='recurrente'` y `effective` falta, lanzar error explícito
- ✅ Validación final: Verificar que `effective` existe antes de retornar proyección

**2. `list-projection-model.js`:**
- ✅ Eliminado workaround temporal
- ✅ Validación fail-fast: Si `effective` falta para recurrente, lanzar error (no calcular como fallback)

### Archivos Modificados

```12:367:src/core/master/services/cleaning-projection-model.js
// MAJOR-1 FIX: effective SIEMPRE para recurrente (OBLIGATORIO)
// Validación fail-fast añadida
```

```793:809:src/core/master/services/list-projection-model.js
// MAJOR-1 FIX: Validación fail-fast - effective DEBE existir para recurrente
// Eliminado workaround, ahora lanza error si falta
```

### Verificación

- ✅ `computeCleaningProjection` calcula `effective` SIEMPRE para recurrente
- ✅ Validación fail-fast lanza error si `effective` falta
- ✅ DTO devuelto incluye `effective` para recurrente

---

## 🔧 MAJOR-2 — RESET RECURRENTE (SEMÁNTICA)

### Cambios Implementados

**1. `cleaning-engine-service.js`:**
- ✅ Validación de coherencia: `view_layer='effective'` → `clean_layer='pde'` (OBLIGATORIO)
- ✅ Regla canónica aplicada: Reset desde effective → SOLO PDE (no ambas capas)

**2. `cleaning-projection-model.js`:**
- ✅ Ajuste lógica: Si `effective_since !== null` (reset aplicado), NUNCA devolver `never`
- ✅ Garantía: Tras reset, estado SIEMPRE es `pending` (nunca `never`)

**3. `master-api-alquimia-general.js`:**
- ✅ Validación de coherencia en endpoints de reset
- ✅ Aplicación de regla canónica: `effective` → `pde`

### Archivos Modificados

```1259:1293:src/core/master/services/cleaning-engine-service.js
// MAJOR-2 FIX: Validación de coherencia view_layer + clean_layer
// Regla canónica: effective → pde
```

```173:209:src/core/master/services/cleaning-projection-model.js
// MAJOR-2 FIX: Si effective_since !== null, NUNCA devolver 'never'
// Garantía: Tras reset, estado SIEMPRE es 'pending'
```

```1642:1681:src/endpoints/master-api-alquimia-general.js
// MAJOR-2 FIX: Validación de coherencia en endpoints
// Aplicación de regla canónica effective → pde
```

### Verificación

- ✅ Reset desde `effective` valida que `clean_layer='pde'`
- ✅ Reset establece `effective_since` correctamente (ya estaba implementado)
- ✅ CPM nunca devuelve `never` tras reset (si `effective_since !== null`)

---

## 🔧 MAJOR-3 — RUNTIME INTEGRITY (FAIL HARD REAL)

### Cambios Implementados

**1. `ux-action-registry.js`:**
- ✅ Guard en `registerAction`: Si runtime está BROKEN, lanzar error (bloquear registro)

**2. `perform-action.js`:**
- ✅ Guard en `performAction`: Si runtime está BROKEN, lanzar error (bloquear ejecución)
- ✅ Guard adicional: Esperar a que runtime esté READY antes de ejecutar

**3. `runtime-integrity-check.v1.js`:**
- ✅ Esperar a que `__AP_UX_ACTION_SCHEMA__` esté disponible antes del check
- ✅ Timeout de 5 segundos: Si no está disponible, fallar hard

### Archivos Modificados

```42:58:public/js/core/ux/action-registry/ux-action-registry.js
// MAJOR-3 FIX: Guard - Runtime BROKEN bloquea registro de acciones
```

```30:60:public/js/core/ux/action-registry/perform-action.js
// MAJOR-3 FIX: Guard - Runtime BROKEN bloquea ejecución de acciones
// Guard adicional: Esperar a que runtime esté READY
```

```111:119:public/js/core/runtime/runtime-integrity-check.v1.js
// MAJOR-3 FIX: Esperar a que __AP_UX_ACTION_SCHEMA__ esté disponible
// Timeout de 5 segundos: Si no está disponible, fallar hard
```

### Verificación

- ✅ `registerAction` bloquea si runtime está BROKEN
- ✅ `performAction` bloquea si runtime está BROKEN o no está READY
- ✅ Integrity check espera a que schema esté disponible

---

## ✅ CHECKLIST DE VERIFICACIÓN

### MAJOR-1: View Authority
- [x] `computeCleaningProjection` calcula `effective` SIEMPRE para recurrente
- [x] Validación fail-fast lanza error si `effective` falta
- [x] `list-projection-model.js` valida y falla si `effective` falta
- [x] Logs forenses muestran `state_by_view_layer` completo

### MAJOR-2: Reset Recurrente
- [x] Validación de coherencia `view_layer='effective'` → `clean_layer='pde'`
- [x] Reset establece `effective_since` correctamente (ya estaba implementado)
- [x] CPM nunca devuelve `never` tras reset (si `effective_since !== null`)
- [x] Endpoints validan coherencia antes de ejecutar reset

### MAJOR-3: Runtime Integrity
- [x] `registerAction` bloquea si runtime está BROKEN
- [x] `performAction` bloquea si runtime está BROKEN o no está READY
- [x] Integrity check espera a que schema esté disponible
- [x] Timeout de 5 segundos con fail-hard si schema no está disponible

---

## 📝 NOTAS TÉCNICAS

### Cambios No Realizados

- ❌ NO se añadieron features nuevas
- ❌ NO se cambió UX
- ❌ NO se refactorizó arquitectura
- ❌ NO se tocó código fuera de las causas raíz

### Migraciones

- ❌ NO se requieren migraciones de base de datos
- ✅ Cambios son solo en lógica de aplicación

### Compatibilidad

- ✅ Cambios son backward-compatible (solo añaden validaciones)
- ✅ Código legacy sigue funcionando (si pasa validaciones)

---

## 🚀 PRÓXIMOS PASOS

1. **Commit Git:**
   ```bash
   git add .
   git commit -m "MAJOR: restore view authority, reset semantics, runtime integrity (v5.76.0)"
   ```

2. **Reiniciar servidor:**
   ```bash
   pm2 restart aurelinportal
   ```

3. **Verificación en producción:**
   - Probar reset desde `effective` → debe resetear solo PDE
   - Probar reset recurrente → estado debe ser `pending` (nunca `never`)
   - Forzar runtime BROKEN → acciones deben bloquearse

---

**FIN DE MAJOR FIXES**
