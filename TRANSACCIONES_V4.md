# TRANSACCIONES V4 - AURIPORTAL

**Versión:** 4.0  
**Fecha:** 2024  
**Arquitecto:** Infraestructura de Transacciones  
**Objetivo:** Garantizar operaciones atómicas en operaciones críticas

---

## RESUMEN EJECUTIVO

AuriPortal v4 implementa infraestructura mínima de transacciones PostgreSQL para garantizar **atomicidad** en operaciones críticas que modifican múltiples tablas.

**PostgreSQL es la fuente de verdad** y las transacciones aseguran que múltiples operaciones se ejecuten como una unidad: todas se completan o ninguna.

### Estado Actual

- ✅ **Infraestructura de transacciones** implementada (`src/infra/db/tx.js`)
- ✅ **Repositorios actualizados** para aceptar `client` opcional (student, practice, pausa)
- ✅ **2 flujos críticos protegidos** con transacciones:
  - `streak-v4.js` → `checkDailyStreak()` (operaciones atómicas)
  - `suscripcion-v4.js` → `pausarSuscripcion()` / `reactivarSuscripcion()` (operaciones atómicas)
- ✅ **Compatibilidad total** con código existente (llamadas sin `client` siguen funcionando)

---

## INFRAESTRUCTURA DE TRANSACCIONES

### Archivo: `src/infra/db/tx.js`

Proporciona helpers para ejecutar operaciones atómicas en PostgreSQL.

#### `withTransaction(fn, options)`

Ejecuta una función dentro de una transacción PostgreSQL.

**Parámetros:**
- `fn` (Function): Función async que recibe el `client` de PostgreSQL
- `options` (Object, opcional):
  - `domain` (string): Dominio para logging (default: 'tx')
  - `flowName` (string): Nombre del flujo para logging (default: 'transaction')
  - `meta` (Object): Metadatos adicionales para logging

**Comportamiento:**
- Si la función completa exitosamente → `COMMIT`
- Si la función lanza un error → `ROLLBACK` automático
- El `client` siempre se libera al final (en `finally`)

**Ejemplo:**
```javascript
import { withTransaction } from '../infra/db/tx.js';

await withTransaction(async (client) => {
  await studentRepo.create(data, client);
  await practiceRepo.create(practiceData, client);
  // Si algo falla aquí, todo se revierte automáticamente
}, {
  domain: 'streak',
  flowName: 'streak_atomic',
  meta: { alumno_id: 123 }
});
```

#### `withClient(fn, client)`

Ejecuta una función con un client específico (sin transacción). Útil cuando ya estás dentro de una transacción y necesitas pasar el mismo `client` a múltiples operaciones.

**Ejemplo:**
```javascript
await withTransaction(async (client) => {
  await withClient(async (c) => {
    await repo1.create(data, c);
    await repo2.update(id, patch, c);
  }, client);
});
```

---

## REPOSITORIOS Y CLIENT OPCIONAL

Todos los repositorios PostgreSQL (`student-repo-pg.js`, `practice-repo-pg.js`, `pausa-repo-pg.js`) aceptan un parámetro opcional `client` en todos sus métodos.

### Regla de Uso

- **Si se proporciona `client`**: usa `client.query(...)` (dentro de transacción)
- **Si no se proporciona `client`**: usa `query()` del pool por defecto (comportamiento normal)

### Métodos que Aceptan Client Opcional

#### StudentRepoPg
- `getByEmail(email, client)`
- `getById(id, client)`
- `create(data, client)`
- `updateById(id, patch, client)`
- `upsertByEmail(email, data, client)`
- `updateNivel(email, nivel, client)`
- `updateStreak(email, streak, client)`
- `updateUltimaPractica(email, fecha, client)`
- `updateEstadoSuscripcion(email, estado, fechaReactivacion, client)`

#### PracticeRepoPg
- `findByAlumnoId(alumnoId, limit, client)`
- `create(practicaData, client)`
- `existsForDate(alumnoId, fecha, aspectoId, client)`
- `countByAlumnoId(alumnoId, client)`

#### PausaRepoPg
- `findByAlumnoId(alumnoId, client)`
- `getPausaActiva(alumnoId, client)`
- `create(pausaData, client)`
- `cerrarPausa(pausaId, fechaFin, client)`
- `calcularDiasPausados(alumnoId, client)`
- `calcularDiasPausadosHastaFecha(alumnoId, fechaLimite, client)`

### Compatibilidad

**Todas las llamadas existentes sin `client` siguen funcionando** sin cambios. El parámetro `client` es completamente opcional y solo se usa cuando se necesita atomicidad.

---

## FLUJOS CRÍTICOS PROTEGIDOS

### 1. STREAK - `streak-v4.js` → `checkDailyStreak()`

**Operaciones atómicas:**
- `createStudentPractice()` - Crear práctica
- `updateStudentUltimaPractica()` - Actualizar última práctica
- `updateStudentStreak()` - Actualizar streak

**Flujo protegido:**
- Primera práctica (si `forcePractice === true`)
- Incrementar streak (si última práctica fue ayer)
- Reset streak (si racha rota)

**Transacción:**
```javascript
await withTransaction(async (client) => {
  if (student.id) {
    await createStudentPractice(student.id, fechaPractica, 'general', 'portal', null, client);
  }
  await updateStudentUltimaPractica(student.email, fechaPractica, client);
  await updateStudentStreak(student.email, newStreak, client);
}, {
  domain: 'streak',
  flowName: 'streak_atomic',
  meta: { ...extractStudentMeta(student), operacion: 'incrementar_streak' }
});
```

**Garantía:** Si alguna operación falla, todas se revierten. No quedan estados parciales (p.ej. práctica creada pero streak no actualizado).

---

### 2. SUSCRIPCIÓN - `suscripcion-v4.js` → `pausarSuscripcion()` / `reactivarSuscripcion()`

#### Pausar Suscripción

**Operaciones atómicas:**
- `crearPausa()` - Crear registro de pausa
- `updateStudentEstadoSuscripcion()` - Actualizar estado a 'pausada'

**Transacción:**
```javascript
await withTransaction(async (client) => {
  const nuevaPausa = await crearPausa({
    alumno_id: student.id,
    inicio: fechaInicio,
    fin: null
  }, client);
  
  await updateStudentEstadoSuscripcion(student.email, 'pausada', null, client);
}, {
  domain: 'suscripcion',
  flowName: 'suscripcion_atomic',
  meta: { ...extractStudentMeta(student), operacion: 'pausar_suscripcion' }
});
```

#### Reactivar Suscripción

**Operaciones atómicas:**
- `cerrarPausa()` - Cerrar pausa activa (establecer `fin`)
- `updateStudentEstadoSuscripcion()` - Actualizar estado a 'activa' con fecha de reactivación

**Transacción:**
```javascript
await withTransaction(async (client) => {
  if (pausaActiva) {
    await cerrarPausa(pausaActiva.id, fechaFin, client);
  }
  await updateStudentEstadoSuscripcion(student.email, 'activa', fechaReactivacion, client);
}, {
  domain: 'suscripcion',
  flowName: 'suscripcion_atomic',
  meta: { ...extractStudentMeta(student), operacion: 'reactivar_suscripcion' }
});
```

**Garantía:** Si alguna operación falla, todas se revierten. No quedan estados inconsistentes (p.ej. pausa creada pero estado no actualizado).

---

## LOGGING Y DEPURACIÓN

### Logs de Transacciones Exitosas

Las transacciones exitosas **NO generan logs adicionales** para evitar spam. Solo se loguean las operaciones individuales (como antes).

### Logs de Rollbacks

Cuando una transacción hace `ROLLBACK`, se genera un log de error con:

**Dominio:** `tx` (o el dominio especificado en `options.domain`)

**Mensaje:** `"Transacción revertida: {flowName}"`

**Metadatos incluidos:**
- `flow_name`: Nombre del flujo (p.ej. 'streak_atomic', 'suscripcion_atomic')
- `error`: Mensaje del error que causó el rollback
- `error_stack`: Stack trace del error
- Metadatos adicionales de `options.meta` (p.ej. `alumno_id`, `email`, `operacion`)

**Ejemplo de log de rollback:**
```json
{
  "domain": "streak",
  "level": "error",
  "message": "Transacción revertida: streak_atomic",
  "flow_name": "streak_atomic",
  "error": "duplicate key value violates unique constraint",
  "error_stack": "Error: duplicate key...",
  "alumno_id": 123,
  "email": "alumno@example.com",
  "operacion": "incrementar_streak",
  "request_id": "abc-123"
}
```

### Cómo Depurar Rollbacks

1. **Buscar logs con dominio `tx` o el dominio específico** (p.ej. `streak`, `suscripcion`)
2. **Filtrar por `flow_name`** para encontrar el flujo específico
3. **Revisar `error` y `error_stack`** para identificar la causa
4. **Verificar metadatos** (`alumno_id`, `email`, `operacion`) para contexto

**Comando de ejemplo (logs estructurados):**
```bash
# Buscar rollbacks de streak
grep '"flow_name":"streak_atomic"' logs/app.log | grep '"level":"error"'

# Buscar rollbacks de suscripción
grep '"flow_name":"suscripcion_atomic"' logs/app.log | grep '"level":"error"'
```

---

## GARANTÍAS Y COMPORTAMIENTO

### Sin Cambios Funcionales en Éxito

**Las transacciones NO cambian el comportamiento cuando todo va bien.** Los resultados son idénticos a antes, solo que ahora son atómicos.

### En Caso de Error

**Antes (sin transacciones):**
- Si fallaba la segunda operación, la primera ya estaba guardada
- Estados parciales e inconsistentes en la base de datos
- Requería limpieza manual o scripts de reparación

**Ahora (con transacciones):**
- Si falla cualquier operación, todas se revierten automáticamente
- No quedan estados parciales
- La base de datos queda en estado consistente

### Compatibilidad Total

**Todas las llamadas existentes sin `client` siguen funcionando** exactamente igual que antes. El parámetro `client` es opcional y solo se usa cuando se necesita atomicidad.

---

## SIMULADOR DE NIVEL Y SINGLE SOURCE OF TRUTH

### Simulador de Nivel (`nivel-simulator-v4.js`)

El simulador de nivel permite ejecutar la lógica de cálculo de nivel **SIN escribir en PostgreSQL**, útil para comparar resultados actuales vs resultados simulados.

**Endpoint:** `GET /admin/simulations/nivel?email=...` (solo lectura, solo admin)

**Garantías:**
- ✅ **NO llama a `updateStudentNivel()`**
- ✅ **NO ejecuta UPDATE/INSERT/DELETE en PostgreSQL**
- ✅ **SOLO calcula y compara resultados**
- ✅ **100% read-only**

### Single Source of Truth para Thresholds

**Problema resuelto:** El simulador anteriormente duplicaba los thresholds de nivel, lo que podía causar divergencia si los thresholds reales cambiaban.

**Solución implementada (v4.2.0):**

1. **Función pura compartida** (`nivel-v4.js`):
   - `calcularNivelPorDiasActivos(diasActivos)` - Función pura, síncrona, sin DB
   - `getNivelThresholds()` - Devuelve copia de thresholds (evita mutaciones)
   - Ambas funciones son la **única fuente de verdad** para el cálculo de nivel

2. **Simulador refactorizado** (`nivel-simulator-v4.js`):
   - Eliminada duplicación de thresholds
   - Reutiliza `calcularNivelPorDiasActivos()` de `nivel-v4.js`
   - Garantiza consistencia total con la lógica real

**Beneficios:**
- ✅ **Consistencia garantizada**: El simulador siempre usa la misma lógica que producción
- ✅ **Mantenibilidad**: Cambios en thresholds solo requieren modificar `nivel-v4.js`
- ✅ **Sin breaking changes**: Comportamiento funcional idéntico, solo arquitectura mejorada

**Uso:**
```javascript
import { calcularNivelPorDiasActivos } from './nivel-v4.js';

// Calcular nivel para días activos simulados
const nivel = calcularNivelPorDiasActivos(150); // Retorna nivel 6
```

---

## PRÓXIMOS PASOS RECOMENDADOS

### Flujos Candidatos para Transacciones

1. **Nivel automático** (`nivel-v4.js` → `actualizarNivelSiCorresponde()`)
   - Actualizar nivel + registrar cambio histórico (si se implementa)
   
2. **Creación de alumno con datos iniciales**
   - Crear alumno + crear primera práctica + inicializar streak

3. **Operaciones masivas de admin**
   - Actualizaciones en lote que afectan múltiples tablas

### Mejoras Futuras

1. **Retry automático** para errores transitorios (deadlocks, timeouts)
2. **Métricas de transacciones** (duración, tasa de rollbacks)
3. **Alertas** cuando la tasa de rollbacks supera un umbral

---

## REGLAS DE ORO

1. ✅ **Usar transacciones solo en operaciones críticas** que modifican múltiples tablas
2. ✅ **Mantener compatibilidad** con código existente (client opcional)
3. ✅ **Logging estructurado** de rollbacks para depuración
4. ✅ **Sin cambios funcionales** cuando no hay errores
5. ⚠️ **No spamear logs** en transacciones exitosas

---

**Documento generado por:** Infraestructura de Transacciones AuriPortal v4  
**Última actualización:** 2024  
**Versión del documento:** 1.1 (v4.2.0 - Single Source of Truth para simulador)














