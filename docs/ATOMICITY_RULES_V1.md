# REGLAS DE ATOMICIDAD v1

**Versión**: 1.0  
**Fecha**: 2026-01-11  
**Estado**: CANÓNICO

---

## QUÉ DEBE SER TRANSACCIONAL

Operaciones críticas que modifican múltiples tablas o estados relacionados:

1. **Cleaning Engine**
   - Insertar evento + actualizar estado + sincronizar `student_item_state`
   - Múltiples operaciones deben ser atómicas

2. **Place Service**
   - Activar lugar + desactivar otro (si hay límite)
   - Crear estado + actualizar límites

3. **Project Service**
   - Activar proyecto + desactivar otro (si hay límite)
   - Crear estado + actualizar límites

4. **Sponsor Service**
   - Crear sponsor + vincular estudiantes
   - Actualizar sponsor + cambiar vínculos

---

## QUÉ NO ENTRA EN TRANSACCIÓN

1. **Emisión de señales**
   - Las señales se emiten FUERA de la transacción
   - Motivo: Fail-open (no debe bloquear persistencia)

2. **Logs estructurados**
   - Los logs no requieren transacción
   - Son operaciones de solo escritura, no críticas

3. **Métricas**
   - Las métricas son operaciones de solo escritura
   - No requieren atomicidad con persistencia

---

## HELPER CANÓNICO

**Ubicación**: `database/pg.js`

**API**:
```javascript
import { withTransaction } from '../../database/pg.js';

const result = await withTransaction(async (client) => {
  // Operaciones dentro de transacción
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  return { success: true };
});
```

**Contrato**:
- Obtiene cliente del pool
- Inicia transacción (`BEGIN`)
- Ejecuta función callback con cliente
- Si éxito: `COMMIT`
- Si error: `ROLLBACK`
- Siempre libera cliente al pool

---

## PATRÓN CANÓNICO

### Estructura
```javascript
export async function criticalOperation(studentId, data, options) {
  const traceId = options.traceId || getRequestId();
  
  // 1. Validaciones (fuera de transacción)
  await validateInputs(data);
  
  // 2. Operaciones críticas (dentro de transacción)
  const result = await withTransaction(async (client) => {
    // Persistencia atómica
    const event = await client.query('INSERT INTO events ...');
    await client.query('UPDATE state SET ...');
    return event.rows[0];
  });
  
  // 3. Emisión de señales (fuera de transacción, fail-open)
  await dispatchSignal({
    signal_key: 'operation.completed',
    payload: { student_id: studentId, result_id: result.id },
    runtime: { student_id: studentId, trace_id: traceId },
    context: {}
  }, { source: { type: 'service', id: 'criticalOperation' } }).catch(err => {
    // Fail-open: log pero no fallar
    logWarn('Service', 'Signal dispatch failed (fail-open)', { error: err.message });
  });
  
  return result;
}
```

---

## EJEMPLOS REALES

### Cleaning Engine (Preparación)
```javascript
// Preparación: Identificar operaciones que deben ser transaccionales
export async function markCleanStudent(studentId, itemRef, options) {
  // TODO: Envolver en withTransaction()
  // - Insertar cleaning_event
  // - Actualizar cleaning_item_state
  // - Sincronizar student_item_state (si clean_layer='shared')
  
  // Señales fuera de transacción
  await dispatchSignal({ ... }).catch(() => {});
}
```

### Place Service (Preparación)
```javascript
// Preparación: Identificar operaciones que deben ser transaccionales
export async function activatePlace(studentId, placeId, actor, options) {
  // TODO: Envolver en withTransaction()
  // - Desactivar más antiguo (si hay límite)
  // - Crear/actualizar place_state
  
  // Señales fuera de transacción
  await dispatchSignal({ ... }).catch(() => {});
}
```

---

## REGLAS DE CONSISTENCIA

1. **Persistencia dentro de transacción**
   - Todas las escrituras relacionadas en la misma transacción
   - Garantiza consistencia atómica

2. **Señales fuera de transacción**
   - Las señales no deben bloquear la persistencia
   - Fail-open: si falla señal, no falla persistencia

3. **Idempotencia**
   - Las operaciones deben ser idempotentes
   - `execution_key` para deduplicación

---

## VERIFICACIÓN

**Manual**: Revisar servicios críticos:
- Cleaning Engine
- Place Service
- Project Service
- Sponsor Service

**Check futuro**: Script automatizado para verificar uso de `withTransaction()` en servicios críticos.

---

## REFERENCIAS

- `database/pg.js`: Helper `withTransaction()`
- `docs/CONSTITUTION_PLATFORM_LAYER1.md`: Capa 1 completa

---

**ESTADO**: ✅ REGLAS CERRADAS (2026-01-11)
