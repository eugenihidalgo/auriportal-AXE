# 📋 RECORDATORIO CANÓNICO PARA EUGENI

**Fecha:** 2025-01-27  
**Auditoría:** FASE B - Diagnóstico Forense READ-ONLY (SIN FIXES)

---

## ⚠️ GUARDAR DOCUMENTOS ANTES DE IMPLEMENTAR FIXES

**OBLIGATORIO:** Guarda estos documentos de diagnóstico antes de pasar a implementar fixes o MODO GOD:

**Carpeta:** `docs/diagnosticos/alqg_total_v1_runtime/`

**Archivos creados:**
- `repro_steps.md` - Pasos de reproducción (plantilla)
- `summary_findings.md` - Hallazgos consolidados (código estático + evidencia pendiente)
- `CODIGO_BUGS_ENCONTRADOS.md` - Evidencia de código para cada bug
- `EVIDENCIA_RUNTIME_PENDIENTE.md` - Verificaciones runtime que requieren autenticación

---

## 📊 ESTADO ACTUAL DE LA AUDITORÍA

### ✅ COMPLETADO (Análisis Estático)
- ✅ BUG-002: CONFIRMADO - `buildRefreshPlan()` puede retornar `[]` → fallback legacy
- ✅ BUG-003: CONFIRMADO - UI muestra éxito sin verificar `applied > 0`
- ✅ BUG-004: CONFIRMADO - Fallback legacy existe en código

### ⏳ PENDIENTE (Runtime con Autenticación)
- ⏳ BUG-001: Código confirma que SÍ asigna `state_by_view_layer`, pero necesita verificación JSON real
- ⏳ Logs runtime de LEGACY_REFRESH
- ⏳ Script forense DB ejecutado
- ⏳ Queries directas DB (cleaning_item_state, cleaning_events, overrides)

---

## 🎯 PRÓXIMOS PASOS

**Antes de implementar fixes:**
1. Ejecutar requests HTTP autenticados y guardar JSON real
2. Ejecutar acciones UI y capturar logs runtime
3. Ejecutar script forense DB y queries directas
4. Completar `summary_findings.md` con evidencia runtime real

**Después de completar evidencia runtime:**
- Revisar `summary_findings.md` completo
- Priorizar bugs por severidad y evidencia
- Crear plan de reparación (`PLAN_REPARACION_ALQG_V1.md`)
- Implementar fixes siguiendo orden de prioridad

---

**NOTA:** Esta auditoría es READ-ONLY. Todos los cambios deben hacerse en una fase posterior después de revisar la evidencia completa.
