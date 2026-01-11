# CONTRATO DE SEÑALES v1

**Versión**: 1.0  
**Fecha**: 2026-01-11  
**Estado**: CANÓNICO

---

## MOTOR ÚNICO

`dispatchSignal()` es el ÚNICO motor de emisión de señales en AuriPortal.

**Ubicación**: `src/core/signals/signal-dispatcher.js`

**API**:
```javascript
import { dispatchSignal } from '../core/signals/signal-dispatcher.js';

await dispatchSignal({
  signal_key: 'student.domain.item.cleaned',
  payload: { student_id, domain_key, item_id, clean_count },
  runtime: { student_id, trace_id },
  context: {}
}, {
  source: { type: 'cleaning_engine', id: 'markClean' }
});
```

---

## REGISTRY OBLIGATORIO

Todas las señales de dominio DEBEN estar registradas en `student-signal-registry.js`.

**Ubicación**: `src/core/student/signals/student-signal-registry.js`

**Reglas**:
- Señales `student.*`, `place.*`, `project.*`, `sponsor.*` requieren registro
- Registry define: `key`, `description`, `category`, `version`, `payload` schema
- Señales no registradas: log WARN + métrica + flag `unregistered: true`

**Verificación**:
```bash
npm run check:signals-registry
```

---

## POLÍTICA FAIL-OPEN ACTUAL

**Capa 1 (Actual)**:
- Validación obligatoria contra registry
- Señales no registradas: **NO bloquean** la emisión
- Log estructurado con contexto completo
- Métrica `signal.unregistered` en DB
- Flag `unregistered: true` en resultado

**Motivo**: Preparación sin romper compatibilidad.

---

## ROADMAP FAIL-HARD

**Sprint 2 (Futuro)**:
- Fail-hard en rutas GOD/Master nuevas
- Señales no registradas: **BLOQUEAN** la emisión
- Error explícito: "Signal not registered in registry"

**Migración**:
- Registrar todas las señales existentes
- Migrar wrappers legacy a `dispatchSignal()`
- Activar fail-hard en nuevos paths

---

## WRAPPERS LEGACY (DEPRECATED)

`emitSignal()` de `pde-signal-emitter.js` es un wrapper legacy.

**Estado**: ⚠️ DEPRECATED

**Migración**:
```javascript
// ❌ ANTES (legacy)
import { emitSignal } from './pde-signal-emitter.js';
await emitSignal('student.domain.item.cleaned', payload, runtime, context, source);

// ✅ DESPUÉS (canónico)
import { dispatchSignal } from '../core/signals/signal-dispatcher.js';
await dispatchSignal({
  signal_key: 'student.domain.item.cleaned',
  payload,
  runtime,
  context
}, { source });
```

**Compatibilidad**: Se mantiene para código legacy, pero NO usar en código nuevo.

---

## EJEMPLOS REALES

### Cleaning Engine
```javascript
await dispatchSignal({
  signal_key: 'student.domain.item.cleaned',
  payload: {
    student_id: studentId,
    domain_key: 'alquimia',
    item_id: itemRef,
    clean_count: 1,
    actor_type: 'master'
  },
  runtime: {
    student_id: studentId,
    trace_id: traceId
  },
  context: {}
}, {
  source: { type: 'cleaning_engine', id: 'markClean' }
});
```

### Place Service
```javascript
await dispatchSignal({
  signal_key: 'place.activated',
  payload: {
    student_id: studentId,
    place_id: placeId,
    place_state_id: placeState.id,
    actor_type: actor
  },
  runtime: {
    student_id: studentId,
    trace_id: traceId
  },
  context: {}
}, {
  source: { type: 'place_service', id: 'activate' }
});
```

---

## OBSERVABILIDAD

Todas las señales:
- Se persisten en `pde_signal_emissions`
- Incluyen `trace_id` para correlación
- Disparan automatizaciones (si está habilitado)
- Aparecen en logs estructurados

**Logs**:
```
[SIGNAL_DISPATCHER] Dispatch signal=student.domain.item.cleaned trace_id=abc123
[SIGNAL_DISPATCHER] Señal persistida: student.domain.item.cleaned signal_id=xyz789
```

**Métricas**:
- `signal.unregistered`: Contador de señales no registradas
- `pde_signal_emissions`: Event log completo

---

## REFERENCIAS

- `src/core/signals/signal-dispatcher.js`: Motor canónico
- `src/core/student/signals/student-signal-registry.js`: Registry
- `src/services/pde-signal-emitter.js`: Wrapper legacy (DEPRECATED)
- `docs/CONSTITUTION_PLATFORM_LAYER1.md`: Capa 1 completa

---

**ESTADO**: ✅ CONTRATO CERRADO (2026-01-11)
