# FASE 3 — PROYECCIÓN BACKEND (PENDIENTE REVISIÓN MANUAL)

## FALLA #4: Backend NO recalcula proyecciones después de mutaciones

**Estado**: ⚠️ **PENDIENTE REVISIÓN MANUAL**

**Ubicación**: 
- `src/endpoints/master-api-alquimia-general.js` (líneas 1151-1280)
- `src/core/master/services/cleaning-engine-service.js` (función `markCleanStudent`)

## Problema Detectado

Los endpoints POST de limpieza (`mark-clean-student`, `mark-clean-all`) NO recalculan `state_by_view_layer` después de mutar estado.

**Flujo actual**:
1. Endpoint recibe POST
2. Llama a `cleaningMarkClean(options)` 
3. Devuelve `state` (sin `state_by_view_layer`)
4. Frontend hace refresh pero recibe datos viejos

**Flujo esperado**:
1. Endpoint recibe POST
2. Llama a `cleaningMarkClean(options)` 
3. **Recalcula proyección** usando `computeCleaningProjection()`
4. Devuelve `state_by_view_layer` actualizado
5. Frontend hace refresh y recibe datos nuevos

## Acción Requerida

Revisar `cleaning-engine-service.js` y asegurar que:
- Después de `markCleanStudent()`, se recalcula `state_by_view_layer` usando `computeCleaningProjection()`
- El resultado se devuelve en la respuesta del endpoint
- Los endpoints GET siguientes ya devuelven el nuevo estado

**NOTA**: Esta corrección requiere cambios en el Cleaning Engine que pueden afectar otros flujos. Revisar cuidadosamente.

---

**FIN DE DOCUMENTACIÓN FASE 3**
