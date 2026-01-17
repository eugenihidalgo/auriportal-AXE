# Forensics Summary: Cleaning Engine Canonical v1

## FASE A - DIAGNÓSTICO

### 1. Import roto a `pde-signal-emitter.js`

**Resultado**: ✅ NO se encontró import roto

- Archivo verificado: `src/core/master/services/cleaning-engine-service.js`
- Línea 565: usa `dispatchSignal` desde `../../signals/signal-dispatcher.js`
- El código actual está correcto y usa el sistema canónico

**Nota**: `pde-signal-emitter.js` existe como wrapper LEGACY/DEPRECATED pero internamente usa `dispatchSignal`. El Cleaning Engine NO lo importa directamente.

### 2. Sistema canónico de señales

**Sistema canónico identificado**: `dispatchSignal` desde `src/core/signals/signal-dispatcher.js`

- Ubicación: `src/core/signals/signal-dispatcher.js`
- Uso actual: Línea 565 de `cleaning-engine-service.js` importa correctamente
- Legacy: `pde-signal-emitter.js` es wrapper DEPRECATED que internamente usa `dispatchSignal`

**Decisión**: Crear wrapper canónico `master-cleaning-signal-emitter.js` dentro del dominio MASTER para:
- Centralizar emisión de señales del Cleaning Engine
- Fail-open controlado
- Contrato estable (traceId, student_uuid, item_ref, clean_layer, action, execution_key)

### 3. Ruta `/master/api/alquimia-general/reset-item-all`

**Resultado**: ✅ YA ESTÁ REGISTRADA

- Registry: `src/core/master/registry/master-route-registry.js` línea 146-150
- RouteKey: `master-api-alquimia-reset-item-all`
- Handler: `src/endpoints/master-api-alquimia-general.js` línea 1795-1897
- Mapping: `src/core/master/router/master-router-resolver.js` línea 56

**Estado**: La ruta está correctamente registrada y funcionando.

### 4. Dominio de logs

**Problema identificado**: Inconsistencia en dominios de logs

- Actual: Se usa `'CleaningEngine'`, `'MasterApiAlquimiaGeneral'`, `'[RESET][ITEM][ALL][CANONICAL]'`
- Propuesta: Dominio canónico único `MASTER_CLEANING`

**Ubicaciones a actualizar**:
- `cleaning-engine-service.js`: todos los `logInfo/logWarn/logError` con dominio `'CleaningEngine'`
- Handler: mantener `'MasterApiAlquimiaGeneral'` para handlers API (separación de responsabilidades)

## FASE B - CANONIZACIÓN

### B1) Dominio de logs canónico

**Acción**: Añadir dominio canónico `MASTER_CLEANING` en `cleaning-engine-service.js`

### B2) Señales: wrapper canónico

**Acción**: Crear `src/core/master/services/master-cleaning-signal-emitter.js`

**Contrato**:
```javascript
emitCleaningSignal({
  traceId,
  student_uuid,
  item_ref,
  clean_layer,
  action, // 'mark_clean', 'reset', 'set_remaining'
  execution_key,
  payload_minimo // { item_id, lista_id, item_nivel, ... }
})
```

**Fail-open**: Si falla, log ERROR estructurado pero NO rompe el request principal.

### B3) Rutas MASTER

**Estado**: Ya registrada ✅

### B4) Contrato de respuesta

**Problema**: Endpoints de limpieza deben devolver proyección autoritativa (view)

**Solución**: Añadir campo `view` en respuestas de endpoints que ejecutan acciones:
```javascript
{
  ok: true,
  trace_id,
  action_result: { applied, skipped, ... },
  view: { 
    view_layer,
    list_id?,
    items?,
    students?,
    ...
  }
}
```

### B5) Read-model / Projection

**Acción**: Auditar `cleaning-projection-model.js` y `list-projection-model.js` para:
- Nunca devolver campos `state` undefined
- Normalización de `clean_count` a `Number(...)`
- Normalización de fechas a `null`/ISO

## ARCHIVOS A TOCAR

1. `src/core/master/services/cleaning-engine-service.js` (dominio logs + wrapper señales)
2. `src/core/master/services/master-cleaning-signal-emitter.js` (nuevo)
3. `src/core/master/services/cleaning-projection-model.js` (normalización)
4. `src/core/master/services/list-projection-model.js` (normalización)
5. `src/endpoints/master-api-alquimia-general.js` (contrato respuesta con `view`)
6. `scripts/verify-cleaning-engine-canonical-v1.js` (nuevo)

## VERIFICACIÓN

- [ ] Script verificación ejecuta sin errores
- [ ] curl a `reset-item-all` devuelve 200
- [ ] Limpieza recurrente devuelve `view` autoritativa
- [ ] No aparece "undefined" en UI tras limpieza
- [ ] Dominio logs canónico `MASTER_CLEANING` presente en todos los logs del engine
