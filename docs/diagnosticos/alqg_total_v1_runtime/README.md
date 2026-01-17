# 🔍 DIAGNÓSTICO RUNTIME READ-ONLY - Alquimia General MASTER
## FASE B - Auditoría Activa (SIN FIXES)

**Fecha:** 2025-01-27  
**Versión:** 5.77.7  
**Modo:** READ-ONLY (0 edits, solo evidencia)

---

## 📁 ESTRUCTURA DE EVIDENCIA

```
docs/diagnosticos/alqg_total_v1_runtime/
├── README.md (este archivo)
├── repro_steps.md (pasos de reproducción)
├── summary_findings.md (hallazgos consolidados)
├── CODIGO_BUGS_ENCONTRADOS.md (evidencia código estático)
├── EVIDENCIA_RUNTIME_PENDIENTE.md (verificaciones runtime que requieren auth)
├── RECORDATORIO_EUGENI.md (⚠️ LEER ANTES DE FIXES)
├── payloads/ (payloads de requests POST)
├── responses/ (respuestas JSON de endpoints GET/POST)
├── logs/ (logs PM2 correlados por trace_id)
└── db_dumps/ (dumps DB y queries forenses)
```

---

## ✅ EVIDENCIA COMPLETADA (Análisis Estático)

### BUG-002: Refresh Engine fallback legacy
- **Estado:** ✅ CONFIRMADO
- **Archivo:** `src/core/ux/action-registry/alquimia-actions.js:44-73`
- **Evidencia:** `buildRefreshPlan()` puede retornar `[]` cuando `view_mode` no es 'proyeccion'/'operativa' y no hay `item_ref`
- **Impacto:** Refresh Engine v2 cae a legacy manual (línea 6565 de `master-alquimia-general-client.js`)

### BUG-003: UI éxito verde aunque applied=0
- **Estado:** ✅ CONFIRMADO
- **Archivos:** `master-alquimia-general-client.js:1642, 1718, 4809, 4929`
- **Evidencia:** `showToastSuccess` se ejecuta sin verificar `applied > 0`
- **Impacto:** Usuario ve "completado" aunque `applied=0` (idempotencia u otra razón)

### BUG-004: Fallback legacy student.state
- **Estado:** ✅ CONFIRMADO
- **Archivo:** `master-alquimia-general-client.js:2775-2808`
- **Evidencia:** Fallback a `student.state` si falta `state_by_view_layer`
- **Impacto:** Alumno puede aparecer en columna incorrecta si `student.state` difiere de `state_by_view_layer[view_layer].state`

---

## ⏳ EVIDENCIA PENDIENTE (Runtime con Autenticación)

### BUG-001: state_by_view_layer faltante
- **Estado código:** ✅ Código SÍ asigna `state_by_view_layer`
  - `list-projection-model.js:879` - items tienen `state_by_view_layer`
  - `alquimia-general-service.js:894, 1026` - students tienen `state_by_view_layer`
- **Estado runtime:** ⏳ PENDIENTE verificar JSON real
- **Requiere:** Requests HTTP autenticados

### Logs Runtime
- ⏳ Logs PM2 correlados con trace_id
- ⏳ Confirmar frecuencia de LEGACY_REFRESH
- ⏳ Verificar condiciones exactas de `surfaces = []`

### DB Forense
- ⏳ Script `diagnostico-reset-clean-forense.js` ejecutado
- ⏳ Queries directas a `cleaning_item_state`, `cleaning_events`, `student_item_overrides`

---

## 🎯 PRÓXIMOS PASOS

1. **Ejecutar requests HTTP autenticados** (ver `EVIDENCIA_RUNTIME_PENDIENTE.md`)
2. **Ejecutar acciones UI** y capturar logs runtime
3. **Ejecutar script forense DB** y queries directas
4. **Completar `summary_findings.md`** con evidencia runtime real
5. **Revisar evidencia completa** antes de implementar fixes

---

## ⚠️ IMPORTANTE

**LEER `RECORDATORIO_EUGENI.md` ANTES DE IMPLEMENTAR FIXES**

Esta auditoría es READ-ONLY. Todos los documentos deben guardarse antes de pasar a implementar fixes o MODO GOD.
