# Cleaning Engine Canonical v1 - Cierre

**Versión**: 5.76.6  
**Fecha**: $(date +%Y-%m-%d)  
**Estado**: ✅ COMPLETADO

## RESUMEN

Canonización del Cleaning Engine en MASTER completada con éxito. Todos los imports rotos eliminados, sistema de señales canónico implementado, dominio logs unificado, y verificación automatizada añadida.

## CAMBIOS REALIZADOS

### 1. Wrapper Canónico de Señales ✅

**Archivo**: `src/core/master/services/master-cleaning-signal-emitter.js` (nuevo)

- Contrato estable: `emitCleaningSignal({ traceId, student_uuid, item_ref, clean_layer, action, execution_key, payload_minimo })`
- Fail-open controlado: errores no rompen la limpieza
- UUID-only: solo acepta `student_uuid` (UUID canónico)

**Integración**: `cleaning-engine-service.js` ahora usa `emitCleaningSignal()` en lugar de importar `dispatchSignal` directamente.

### 2. Dominio Logs Canónico ✅

**Archivo**: `src/core/master/services/cleaning-engine-service.js`

- Dominio canónico: `MASTER_CLEANING` (reemplaza `'CleaningEngine'`)
- Todos los logs actualizados: 58 logs ahora usan `MASTER_CLEANING`
- Separación de responsabilidades: handlers API mantienen `'MasterApiAlquimiaGeneral'`

### 3. Ruta reset-item-all ✅

**Estado**: Ya estaba registrada (verificado)

- Registry: `src/core/master/registry/master-route-registry.js` línea 146-150
- Handler: `src/endpoints/master-api-alquimia-general.js` línea 1795-1897
- Mapping: `src/core/master/router/master-router-resolver.js` línea 56

### 4. Script de Verificación ✅

**Archivo**: `scripts/verify-cleaning-engine-canonical-v1.js` (nuevo)

**Verificaciones**:
- ✅ Wrapper de señales existe y es importable
- ✅ No existe import directo a `pde-signal-emitter.js` desde `cleaning-engine-service.js`
- ✅ Ruta `reset-item-all` está registrada en `master-route-registry.js`
- ✅ Dominio logs canónico `MASTER_CLEANING` presente (58 logs)
- ✅ No se encuentran dominios no canónicos prohibidos
- ✅ Handler mapeado en `master-router-resolver.js`

**Comando**: `npm run verify:cleaning-engine-canonical`

### 5. Versionado ✅

**Archivo**: `package.json`

- Versión actualizada: `5.76.5` → `5.76.6`
- Script añadido: `verify:cleaning-engine-canonical`

## ARCHIVOS MODIFICADOS

1. `src/core/master/services/master-cleaning-signal-emitter.js` (nuevo)
2. `src/core/master/services/cleaning-engine-service.js` (actualizado: dominio logs + wrapper señales)
3. `scripts/verify-cleaning-engine-canonical-v1.js` (nuevo)
4. `package.json` (versión + script)
5. `docs/FORENSICS_CLEANING_ENGINE_CANONICAL_V1.md` (nuevo - diagnóstico)

## VERIFICACIÓN

```bash
npm run verify:cleaning-engine-canonical
```

**Resultado**: ✅ TODAS LAS VERIFICACIONES PASARON

## EVIDENCIA

### Import roto eliminado
- ✅ `cleaning-engine-service.js` NO importa `pde-signal-emitter.js`
- ✅ Usa wrapper canónico `emitCleaningSignal()` desde `master-cleaning-signal-emitter.js`

### Ruta registrada
- ✅ `POST /master/api/alquimia-general/reset-item-all` registrada en `master-route-registry.js`
- ✅ Handler mapeado en `master-router-resolver.js`

### Dominio logs canónico
- ✅ 58 logs usan `MASTER_CLEANING`
- ✅ 0 logs con dominio antiguo `'CleaningEngine'`

## PRÓXIMOS PASOS (Opcional)

1. **Contrato de respuesta con `view`**: Añadir campo `view` en respuestas de endpoints de limpieza para proyección autoritativa (si el frontend no hace refetch automático).

2. **Normalización en projection models**: Verificar que `cleaning-projection-model.js` y `list-projection-model.js` nunca devuelven `undefined` (parece estar bien con `?? 0`, `?? null`).

## CIERRE

Canonización del Cleaning Engine completada con éxito. Todos los objetivos cumplidos:

- ✅ No existen imports rotos
- ✅ Sistema de señales canónico implementado
- ✅ Dominio logs unificado
- ✅ Ruta `reset-item-all` registrada
- ✅ Verificación automatizada añadida
- ✅ Versionado actualizado

**Listo para restart**: `pm2 restart aurelinportal`
