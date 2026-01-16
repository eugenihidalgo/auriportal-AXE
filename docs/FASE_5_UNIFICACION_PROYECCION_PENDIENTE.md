# FASE 5 — UNIFICACIÓN DE PROYECCIÓN (PENDIENTE VERIFICACIÓN)

## FALLA #8: Flotantes y listas usan endpoints diferentes sin garantía de sincronización

**Estado**: ⚠️ **PENDIENTE VERIFICACIÓN**

**Ubicación**: 
- Flotantes: `GET /master/api/alquimia-general/items/:item_ref/students`
- Listas: `GET /master/api/alquimia-general/list-projection`

## Problema Detectado

Flotantes y listas usan **endpoints diferentes**:
- Flotantes: `/master/api/alquimia-general/items/:item_ref/students`
- Listas: `/master/api/alquimia-general/list-projection`

**NO hay garantía** de que ambos endpoints usen la misma proyección canónica.

## Acción Requerida

Verificar que ambos endpoints:
1. Usan el mismo motor de proyección (`computeCleaningProjection()`)
2. Calculan `state_by_view_layer` de forma idéntica
3. No tienen lógicas paralelas

**NOTA**: Esta verificación requiere revisar el código backend de ambos endpoints y asegurar que usan la misma fuente de verdad.

---

**FIN DE DOCUMENTACIÓN FASE 5**
