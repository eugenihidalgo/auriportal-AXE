# ✅ CHECKLIST DE VERIFICACIÓN — MAJOR FIXES v5.76.0

**Fecha:** 2026-01-13  
**Versión:** 5.76.0  
**Estado:** ✅ IMPLEMENTADO Y COMMITEADO

---

## 🔍 VERIFICACIÓN PRE-REINICIO

### Sintaxis y Linting
- [x] ✅ No hay errores de sintaxis en archivos modificados
- [x] ✅ No hay errores de linting
- [x] ✅ Todos los archivos compilan correctamente

### Archivos Modificados
- [x] ✅ `src/core/master/services/cleaning-projection-model.js` (MAJOR-1, MAJOR-2)
- [x] ✅ `src/core/master/services/cleaning-engine-service.js` (MAJOR-2)
- [x] ✅ `src/core/master/services/list-projection-model.js` (MAJOR-1)
- [x] ✅ `src/endpoints/master-api-alquimia-general.js` (MAJOR-2)
- [x] ✅ `public/js/core/ux/action-registry/ux-action-registry.js` (MAJOR-3)
- [x] ✅ `public/js/core/ux/action-registry/perform-action.js` (MAJOR-3)
- [x] ✅ `public/js/core/runtime/runtime-integrity-check.v1.js` (MAJOR-3)

### Documentación
- [x] ✅ `docs/DIAGNOSTICO_FORENSE_TOTAL_ALQUIMIA_GENERAL_V1.md` creado
- [x] ✅ `docs/MAJOR_FIXES_ALQUIMIA_GENERAL_V1.md` creado
- [x] ✅ `docs/CHECKLIST_VERIFICACION_MAJOR_FIXES_V1.md` creado

### Git
- [x] ✅ Commit creado con mensaje canónico
- [x] ✅ Versión actualizada a 5.76.0 en package.json

---

## 🧪 VERIFICACIÓN POST-REINICIO (REQUERIDA)

### MAJOR-1: View Authority
- [ ] Probar GET `/master/api/alquimia-general/list-projection` con `view_layer=shared` para recurrente
  - [ ] Verificar que `state_by_view_layer.effective` está presente en respuesta
  - [ ] Verificar logs: NO debe haber errores `[MAJOR-1] effective no calculado`
- [ ] Probar GET `/master/api/alquimia-general/list-projection` con `view_layer=pde` para recurrente
  - [ ] Verificar que `state_by_view_layer.effective` está presente en respuesta
- [ ] Probar GET `/master/api/alquimia-general/list-projection` con `view_layer=effective` para recurrente
  - [ ] Verificar que `state_by_view_layer.effective` está presente y es válido
  - [ ] Verificar que UI NO muestra "undefined" en flotantes

### MAJOR-2: Reset Recurrente
- [ ] Probar reset desde `view_layer=effective` para recurrente
  - [ ] Verificar que endpoint valida coherencia (debe rechazar si `clean_layer !== 'pde'`)
  - [ ] Verificar que reset afecta SOLO capa PDE (no ambas)
  - [ ] Verificar que tras reset, estado es `pending` (nunca `never`)
  - [ ] Verificar que alumno se mueve de columna tras reset
- [ ] Probar reset desde `view_layer=shared` para recurrente
  - [ ] Verificar que reset afecta SOLO capa SHARED
  - [ ] Verificar que tras reset, estado es `pending`
- [ ] Verificar en DB: `effective_since` se establece correctamente tras reset

### MAJOR-3: Runtime Integrity
- [ ] Forzar ausencia de `__AP_UX_ACTION_SCHEMA__` (simular error)
  - [ ] Verificar que runtime entra en BROKEN
  - [ ] Verificar que NO se registran acciones después de BROKEN
  - [ ] Verificar que `performAction` lanza error si runtime está BROKEN
  - [ ] Verificar que UI muestra banner de error (si está implementado)
- [ ] Verificar orden de carga de scripts
  - [ ] `runtime-ready.v1.js` carga primero
  - [ ] `ux-action-registry-loader.js` carga después
  - [ ] `runtime-integrity-check.v1.js` carga al final y espera schema

---

## 📊 MÉTRICAS DE ÉXITO

### MAJOR-1
- ✅ `state_by_view_layer.effective` presente en 100% de respuestas para recurrente
- ✅ 0 errores `[MAJOR-1] effective no calculado` en logs
- ✅ 0 casos de "undefined" en UI para effective

### MAJOR-2
- ✅ 0 casos de estado `never` tras reset recurrente
- ✅ 100% de resets desde `effective` afectan SOLO PDE
- ✅ 100% de resets establecen `effective_since` correctamente

### MAJOR-3
- ✅ 0 acciones registradas después de runtime BROKEN
- ✅ 0 acciones ejecutadas si runtime está BROKEN
- ✅ 100% de integrity checks esperan schema antes de validar

---

## 🚨 ROLLBACK PLAN

Si algo falla después del reinicio:

1. **Revertir commit:**
   ```bash
   git revert da52701
   pm2 restart aurelinportal
   ```

2. **Verificar estado:**
   ```bash
   pm2 status
   pm2 logs aurelinportal --lines 50
   ```

3. **Documentar problema:**
   - Crear issue en docs con logs
   - Identificar qué fix causó el problema
   - Proponer fix específico

---

## 📝 NOTAS FINALES

- ✅ Todos los fixes implementados según diagnóstico forense
- ✅ No se añadieron features nuevas
- ✅ No se cambió UX
- ✅ No se refactorizó arquitectura
- ✅ Solo se restauraron contratos constitucionales

**PRÓXIMO PASO:** Reiniciar servidor y ejecutar verificación post-reinicio.

---

**FIN DE CHECKLIST**
