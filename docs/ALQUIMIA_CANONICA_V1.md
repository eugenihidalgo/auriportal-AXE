# ALQUIMIA CANÓNICA v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Versión:** 1.0.0  
**Fecha:** 2026-01-12  
**Estado:** CANÓNICO  
**Commit:** 69b8a97 (v5.67.1-alquimia-canonic-fix)

---

## PROPÓSITO

Documentación canónica del sistema de Alquimia (Transmutaciones Energéticas) en AuriPortal.

Este documento refleja **EXACTAMENTE** la implementación canónica después de las correcciones de bugs v5.67.1. Es la referencia definitiva para:
- Entender qué es Alquimia y cómo funciona
- Implementar nuevas funcionalidades relacionadas
- Mantener coherencia con el diseño canónico
- Verificar comportamientos esperados

**OBLIGATORIO:** Cualquier cambio en Alquimia debe actualizar este documento.

---

## 1) QUÉ ES ALQUIMIA (DEFINICIÓN ONTOLÓGICA)

**Alquimia** es el sistema de gestión y aplicación de operaciones de limpieza sobre ítems de transmutaciones energéticas.

### Componentes Principales

1. **Alquimia General** (`/master/templo-luz/alquimia-general`)
   - Panel de control maestro para gestionar listas e ítems
   - Permite aplicar limpiezas masivas o individuales
   - **REGLA:** Ignora nivel del alumno (Master puede limpiar cualquier item a cualquier alumno)

2. **Alquimia Alumno** (`/master/templo-luz/alquimia-alumno`)
   - Vista específica del estado de limpieza de un estudiante individual
   - Permite ver historial y aplicar limpiezas individuales
   - **REGLA:** Respeta nivel del alumno (filtra items no aplicables)

### Entidades

- **Listas:** Agrupaciones de ítems (ej. "Limpieza Energética", "Sanación")
- **Ítems:** Elementos individuales de transmutación (ej. "Limpieza de chakras")
- **Estados de Limpieza:** Proyección del estado actual de cada ítem por alumno
- **Eventos de Limpieza:** Log append-only de todas las acciones de limpieza

---

## 2) CLEANING ENGINE COMO MOTOR ÚNICO

**Cleaning Engine v1** (`src/core/master/services/cleaning-engine-service.js`) es el **ÚNICO decisor canónico** de estados de limpieza.

### Responsabilidades

1. **Validación de inputs:**
   - Verificar que `item_ref` existe y no está archivado
   - Validar `item_kind` (recurrente/una_vez)
   - Verificar campos requeridos según Contrato Limpieza v1

2. **Exclusión de alumnos pausados:**
   - Consultar `pausa_repo` para verificar si el alumno está en pausa
   - Excluir automáticamente de todas las operaciones de limpieza

3. **Inserción de eventos (idempotente):**
   - Generar `execution_key` único por día/alumno/item
   - Insertar en `cleaning_events` (append-only)
   - Manejar idempotencia: si ya existe, devolver `'already_applied'`

4. **Aplicación a proyección:**
   - Actualizar `cleaning_item_state` (proyección materializada)
   - Sincronizar a `student_item_state` si `clean_layer='shared'` (compatibilidad legacy)

5. **Emisión de señales:**
   - Emitir `clean.executed` (fail-open, no bloquea operación)

### Reglas Constitucionales

- **PROHIBIDO:** Calcular estados de limpieza fuera del Cleaning Engine
- **PROHIBIDO:** Escribir directamente en `student_item_state` sin pasar por Cleaning Engine
- **PROHIBIDO:** Duplicar lógica de limpieza en handlers o servicios
- **OBLIGATORIO:** Toda mutación de estado de limpieza pasa por `CleaningEngineService`

---

## 3) SOURCE OF TRUTH

### 3.1 cleaning_events (Event Log Append-Only)

**Tabla:** `public.cleaning_events`  
**Propósito:** Log inmutable de todos los eventos de limpieza (event sourcing)

**Columnas Clave:**
- `id` (UUID PK)
- `created_at` (timestamp)
- `trace_id` (string, para observabilidad)
- `execution_key` (string, para idempotencia)
- `student_id` (FK a `alumnos.id`)
- `product_key` (default: 'pde')
- `domain_type` (default: 'transmutation')
- `item_ref` (string, referencia del ítem)
- `clean_layer` ('shared' | 'pde')
- `item_kind` ('recurrente' | 'una_vez')
- `action_type` ('mark_clean' | 'set_remaining')
- `delta_completed` (integer, para una_vez)
- `set_remaining` (integer, para set_remaining)
- `actor_type` ('master' | 'student' | 'automation')
- `actor_ref` (string | null)
- `surface_key` (string, ej. 'master.alquimia_general')
- `meta` (JSONB, metadatos adicionales)

**Constraints:**
- `UNIQUE (execution_key, student_id)` → `idx_cleaning_events_execution_student`
- `FK student_id REFERENCES alumnos(id) ON DELETE CASCADE`
- `CHECK` en `action_type`, `actor_type`, `clean_layer`, `item_kind`

**Reglas:**
- **PROHIBIDO:** Modificar o eliminar eventos históricos
- **OBLIGATORIO:** Todo cambio de estado genera evento
- **Idempotencia:** Mismo `execution_key` + `student_id` = mismo resultado (devuelve `'already_applied'`)

### 3.2 cleaning_item_state (Proyección Materializada)

**Tabla:** `public.cleaning_item_state`  
**Propósito:** Proyección optimizada del estado actual de limpieza por ítem y alumno

**Columnas Clave:**
- `student_id` (PK compuesto)
- `product_key` (PK compuesto)
- `domain_type` (PK compuesto)
- `item_ref` (PK compuesto)
- `shared_last_cleaned_at` (timestamp | null)
- `pde_last_cleaned_at` (timestamp | null)
- `shared_clean_count` (integer, default: 0)
- `pde_clean_count` (integer, default: 0)
- `shared_completed` (integer, para una_vez)
- `shared_remaining` (integer, para una_vez)
- `pde_completed` (integer, para una_vez)
- `meta` (JSONB)
- `created_at`, `updated_at` (timestamps)

**Constraints:**
- `PK (student_id, product_key, domain_type, item_ref)`
- `FK student_id REFERENCES alumnos(id) ON DELETE CASCADE`
- Trigger: `trigger_update_cleaning_item_state_updated_at`

**Reglas:**
- **PROHIBIDO:** Escribir directamente sin pasar por Cleaning Engine
- **OBLIGATORIO:** Se actualiza automáticamente tras insertar evento en `cleaning_events`
- **Separación por capa:** `shared` y `pde` son independientes

### 3.3 student_item_state (Legacy - Compatibilidad)

**Tabla:** `public.student_item_state`  
**Propósito:** Tabla legacy para compatibilidad con sistemas antiguos

**Estado:** Se sincroniza desde `cleaning_item_state` cuando `clean_layer='shared'`

**Reglas:**
- **PROHIBIDO:** Usar como decisor de estado
- **PROHIBIDO:** Consultar para estado canónico
- **OBLIGATORIO:** Sincronización automática desde Cleaning Engine (función `syncToStudentItemState`)
- **Futuro:** Eliminación planificada cuando no haya dependencias

---

## 4) TIPOS DE LIMPIEZA

### 4.1 recurrente

**Definición:** Ítems que se limpian periódicamente (basados en tiempo)

**Estado:**
- `last_cleaned_at` (timestamp de última limpieza)
- `clean_count` (número de veces limpiado)

**Cálculo de estados (UI):**
- `reviewed`: `days_since_last_clean < threshold_days`
- `pending`: `threshold_days <= days_since_last_clean < threshold_days * critical_multiplier`
- `important`: `days_since_last_clean >= threshold_days * critical_multiplier`
- `never`: `last_cleaned_at IS NULL`

**Filtro por nivel:**
- **Alquimia General:** NO aplica (Master puede limpiar cualquier item)
- **Alquimia Alumno:** SÍ aplica (items con `nivel > nivel_efectivo` no aplican)

### 4.2 una_vez

**Definición:** Ítems que tienen un número finito de "veces a limpiar" (basados en contador)

**Estado:**
- `completed` (número de veces completadas)
- `remaining` (número de veces restantes)
- `required_count` (número total requerido, desde catálogo)

**Cálculo:**
- `remaining = max(required_count - completed, 0)`
- `completed` se incrementa con `delta_completed` en cada limpieza

**Filtro por nivel:**
- **Alquimia General:** NO aplica (incluso para "+1 para todos")
- **Alquimia Alumno:** SÍ aplica (items con `nivel > nivel_efectivo` no aplican)

**Acción "+1 para todos":**
- Incrementa `completed` en 1 para todos los alumnos activos (no pausados)
- **REGLA:** `skip_level_filter: true` por defecto en `incrementAllStudents()`

---

## 5) IDEMPOTENCIA BENEVOLENTE

### Mecanismo

1. **Generación de `execution_key`:**
   ```javascript
   generateExecutionKey(actionType, itemRef, studentId)
   // Formato: `${actionType}_${itemRef}_${studentId}_${YYYY-MM-DD}`
   ```

2. **Inserción en `cleaning_events`:**
   - Intento de INSERT con `execution_key` y `student_id`
   - Si viola constraint único (`23505` + `idx_cleaning_events_execution_student`):
     - Repositorio devuelve `'already_applied'` (no lanza error)
     - Cleaning Engine detecta `'already_applied'` y devuelve estado actual

3. **Resultado:**
   - **Primer click:** Inserta evento, actualiza estado, devuelve estado nuevo
   - **Clicks subsecuentes:** Devuelve `'already_applied'`, devuelve estado actual (200 OK)
   - **NUNCA:** Error 500 por idempotencia

### Implementación

**Repositorio** (`src/infra/repos/cleaning/cleaning-events-repo-pg.js`):
```javascript
if (error.code === '23505' && error.constraint === 'idx_cleaning_events_execution_student') {
  return 'already_applied';
}
```

**Cleaning Engine** (`src/core/master/services/cleaning-engine-service.js`):
```javascript
if (eventResult === 'already_applied') {
  // Devolver estado actual (no error)
  return await stateRepo.getState({...}, client);
}
```

### Casos Cubiertos

- ✅ Doble click rápido
- ✅ Retries automáticos
- ✅ Automatizaciones que re-ejecutan
- ✅ Múltiples requests simultáneos

---

## 6) PAUSA COMO EXCLUSIÓN TOTAL

### Regla Constitucional

**Estudiantes pausados DEBEN ser excluidos de TODAS las operaciones de limpieza.**

### Implementación

1. **Verificación en Cleaning Engine:**
   ```javascript
   const isPaused = await pausaRepo.isStudentPaused(studentId);
   if (isPaused) {
     return null; // Excluir sin error
   }
   ```

2. **Exclusión en operaciones masivas:**
   - `markCleanAllStudents()` excluye alumnos pausados antes de procesar
   - `incrementAllStudents()` excluye alumnos pausados antes de procesar

3. **UI:**
   - Flotantes NO muestran alumnos pausados
   - Conteos NO incluyen alumnos pausados
   - "clean all" solo afecta alumnos activos

### Prohibiciones

- ❌ Incluir estudiantes pausados en modales
- ❌ Permitir limpieza manual de pausados
- ❌ Procesar limpiezas para estudiantes pausados

---

## 7) NIVEL: ALQUIMIA GENERAL vs ALQUIMIA ALUMNO

### Alquimia General (Ignora Nivel)

**Intención:** Master puede limpiar cualquier item a cualquier alumno (override de nivel)

**Implementación:**
- Endpoint `GET /master/api/alquimia-general/items/:item_ref/students` pasa `skip_level_filter: true`
- Servicio `getStudentsForItem()` respeta `skip_level_filter: true` y NO filtra por nivel
- `incrementAllStudents()` pasa `skip_level_filter: true` por defecto

**Código:**
```javascript
// cleaning-engine-service.js::incrementAllStudents()
return await markCleanAllStudents({
  ...options,
  skip_level_filter: options.skip_level_filter !== undefined 
    ? options.skip_level_filter 
    : true // Por defecto true para incrementAll
}, client);
```

### Alquimia Alumno (Respeta Nivel)

**Intención:** Mostrar solo items aplicables al nivel del alumno

**Implementación:**
- Endpoint `GET /master/api/alquimia-alumno/megalist` NO pasa `skip_level_filter`
- Servicio filtra items con `nivel > nivel_efectivo` como "NO APLICA (nivel)"
- UI muestra sección colapsable para items no aplicables

**Regla:**
- Items con `nivel > nivel_efectivo` NO se muestran como "nunca trabajados"
- Se muestran en sección separada "NO APLICA (nivel)"

---

## 8) "+1 PARA TODOS" (UNA_VEZ)

### Intención

Incrementar `completed` en 1 para todos los alumnos activos (no pausados) de un item `una_vez`.

### Implementación

**Endpoint:** `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`

**Flujo:**
1. Frontend envía `{ clean_layer: 'shared' }`
2. Endpoint llama `alquimia-general-service.js::incrementAll()`
3. Servicio llama `cleaning-engine-service.js::incrementAllStudents()`
4. `incrementAllStudents()` pasa `skip_level_filter: true` por defecto
5. `markCleanAllStudents()` procesa todos los alumnos activos (sin filtrar por nivel)

**Código clave:**
```javascript
// cleaning-engine-service.js::incrementAllStudents()
skip_level_filter: options.skip_level_filter !== undefined 
  ? options.skip_level_filter 
  : true // Por defecto true para incrementAll (Alquimia General ignora nivel)
```

### Casos Límite

1. **Alumno en pausa:**
   - ✅ Excluido automáticamente (no se procesa)

2. **Alumno con `remaining = 0`:**
   - ✅ Se procesa igual (el acto se registra)
   - ✅ `completed` puede exceder `required_count` (no hay validación)

3. **Item con `nivel > nivel_efectivo` del alumno:**
   - ✅ Se procesa igual (Alquimia General ignora nivel)

4. **Idempotencia:**
   - ✅ Múltiples clicks devuelven `'already_applied'` (no error)

### Respuesta

```json
{
  "ok": true,
  "data": {
    "updated": 15,
    "skipped": 2,
    "total": 17,
    "skipped_breakdown": {
      "paused": 2,
      "not_applicable_level": 0,
      "already_clean": 0,
      "missing_item": 0,
      "no_change": 0,
      "error": 0,
      "other": 0
    }
  },
  "trace_id": "..."
}
```

---

## 9) SEÑALES

### clean.executed

**Registry:** `src/core/student/signals/student-signal-registry.js`

**Definición:**
```javascript
'clean.executed': {
  key: 'clean.executed',
  description: 'Se emite cuando se ejecuta una limpieza (mark_clean) desde Cleaning Engine',
  category: 'domain',
  version: 'v1',
  deprecated: null,
  payload: {
    student_id: 'ID legacy del alumno (legacy_alumno_id)',
    item_ref: 'Referencia del ítem',
    domain: 'Tipo de dominio (transmutation, etc.)',
    product_key: 'Clave del producto (pde, etc.)',
    clean_layer: 'Capa de limpieza (shared, pde)',
    actor_type: 'Tipo de actor (master, student, automation)',
    trace_id: 'ID de traza'
  }
}
```

**Emisión:**
- **Origen:** `cleaning-engine-service.js::markCleanStudent()` (línea ~395)
- **Momento:** Después de insertar evento y actualizar estado
- **Fail-open:** Si falla, se logea warning pero no bloquea operación

**Payload Ejemplo:**
```javascript
{
  signal: 'clean.executed',
  scope: 'student',
  student_id: 123,
  item_id: 456,
  item_ref: 'te_item_1',
  domain: 'transmutation',
  product_key: 'pde',
  source: 'master',
  clean_layer: 'shared',
  executed_at: '2026-01-12T04:46:38.235Z'
}
```

**Consumidores:**
- Automatizaciones (futuro)
- Analíticas (futuro)
- Observabilidad (logs estructurados)

---

## 10) CONTRATO UI (display_name)

### Regla Constitucional

**Backend SIEMPRE entrega `display_name` en respuestas de limpieza.**

### Implementación

**Endpoint** (`src/endpoints/master-api-alquimia-general.js`):
```javascript
// Calcular display_name del estudiante para el toast
let displayName = null;
try {
  const { calculateStudentDisplayName } = await import('../core/helpers/student-display-name-helper.js');
  const { query } = await import('../../database/pg.js');
  const studentResult = await query(
    'SELECT id, apodo, nombre_completo, email FROM alumnos WHERE id = $1 LIMIT 1',
    [studentId]
  );
  if (studentResult.rows[0]) {
    displayName = await calculateStudentDisplayName(studentResult.rows[0]);
  }
} catch (nameError) {
  logWarn('MasterApiAlquimiaGeneral', 'Error calculando display_name (fail-open)', {...});
}

return jsonSuccess({ 
  state,
  student: {
    student_id: studentId,
    display_name: displayName
  }
}, traceId);
```

**Respuesta JSON:**
```json
{
  "ok": true,
  "data": {
    "state": { /* estado de limpieza */ },
    "student": {
      "student_id": 123,
      "display_name": "Juan Pérez"
    }
  },
  "trace_id": "..."
}
```

**UI** (`public/js/master/master-alquimia-general-client.js`):
```javascript
// CONTRATO: Backend SIEMPRE entrega display_name en result.student.display_name
const displayName = result.data?.student?.display_name 
  || student.display_name 
  || student.student_name 
  || student.email 
  || 'Alumno';
showToastSuccess(`✓ ${displayName} limpiado`);
```

### Prioridad de Fallback

1. `result.data.student.display_name` (canónico, desde backend)
2. `student.display_name` (del objeto local)
3. `student.student_name` (legacy)
4. `student.email` (último recurso)
5. `'Alumno'` (fallback final)

---

## 11) ESTATUTO DE LEGACY (student_item_state)

### Estado Actual

**Tabla:** `public.student_item_state`  
**Rol:** Legacy, mantenida solo por compatibilidad

### Sincronización

**Función:** `cleaning-engine-service.js::syncToStudentItemState()` (líneas ~109-159)

**Cuándo se sincroniza:**
- Solo cuando `clean_layer='shared'`
- Después de actualizar `cleaning_item_state`
- En la misma transacción (atómico)

**Qué se sincroniza:**
- `last_cleaned_at` → `last_cleaned_at`
- `shared_clean_count` → `clean_count`
- `shared_completed` → `completed`
- `shared_remaining` → `remaining`

### Reglas

- **PROHIBIDO:** Usar como decisor de estado
- **PROHIBIDO:** Consultar para estado canónico
- **PROHIBIDO:** Escribir directamente sin pasar por Cleaning Engine
- **OBLIGATORIO:** Sincronización automática desde Cleaning Engine
- **Futuro:** Eliminación planificada cuando no haya dependencias

### Migración

**Source of Truth canónico:** `cleaning_events` + `cleaning_item_state`  
**Legacy:** `student_item_state` (solo lectura para compatibilidad)

---

## 12) BUGS HISTÓRICOS CERRADOS

### BUG A: "+1 para todos" devuelve 0 alumnos

**Síntoma:** Al hacer "+1 para todos" en un item `una_vez`, el toast mostraba "Item incrementado para 0 alumnos".

**Causa:** `incrementAllStudents()` no pasaba `skip_level_filter: true` a `markCleanAllStudents()`, causando que se filtraran alumnos por nivel.

**Solución:** `incrementAllStudents()` ahora pasa `skip_level_filter: true` por defecto.

**Commit:** 69b8a97 (v5.67.1-alquimia-canonic-fix)  
**Archivo:** `src/core/master/services/cleaning-engine-service.js` (línea ~658)

### BUG B: Toast "undefined limpiado"

**Síntoma:** Al limpiar un estudiante individual, el toast mostraba "✓ undefined limpiado".

**Causa:** El objeto `student` en el frontend no tenía `display_name` calculado, y el endpoint no lo devolvía.

**Solución:**
1. Endpoint calcula y devuelve `display_name` en `result.student.display_name`
2. UI usa `result.data.student.display_name` con fallbacks

**Commit:** 69b8a97 (v5.67.1-alquimia-canonic-fix)  
**Archivos:**
- `src/endpoints/master-api-alquimia-general.js` (líneas ~964-990)
- `public/js/master/master-alquimia-general-client.js` (línea ~1389)

### BUG C: Doble click (primer POST 500)

**Síntoma:** Al hacer doble click rápido en "limpiar estudiante", el primer POST devolvía 500 (UNIQUE constraint violation), y el segundo devolvía 200 OK.

**Causa:** El repositorio no manejaba la violación de constraint único como idempotencia, permitiendo que la excepción se propagara.

**Solución:** Ya estaba implementado correctamente:
- Repositorio devuelve `'already_applied'` para constraint único
- Cleaning Engine maneja `'already_applied'` y devuelve estado actual

**Estado:** Verificado como correcto en commit 69b8a97  
**Archivos:**
- `src/infra/repos/cleaning/cleaning-events-repo-pg.js` (líneas ~76-81)
- `src/core/master/services/cleaning-engine-service.js` (líneas ~339-354)

---

## 13) CHECKLIST DE VERIFICACIÓN FUTURA

### Al Implementar Nueva Funcionalidad de Limpieza

- [ ] ¿Pasa por Cleaning Engine?
- [ ] ¿Respeta idempotencia (`execution_key`)?
- [ ] ¿Excluye alumnos pausados?
- [ ] ¿Emite señal `clean.executed`?
- [ ] ¿Devuelve `display_name` en respuesta?
- [ ] ¿Respeta `skip_level_filter` según superficie (General vs Alumno)?
- [ ] ¿Maneja `'already_applied'` correctamente (no 500)?

### Al Modificar Cleaning Engine

- [ ] ¿Se actualiza este documento?
- [ ] ¿Se mantiene idempotencia?
- [ ] ¿Se mantiene exclusión de pausados?
- [ ] ¿Se mantiene sincronización legacy (`student_item_state`)?
- [ ] ¿Se mantiene emisión de señales?

### Al Agregar Nuevo Tipo de Limpieza

- [ ] ¿Se documenta en este documento?
- [ ] ¿Se actualiza `item_kind` en Contrato Limpieza v1?
- [ ] ¿Se actualiza `cleaning_events` schema si es necesario?
- [ ] ¿Se actualiza `cleaning_item_state` schema si es necesario?

### Al Modificar UI de Alquimia

- [ ] ¿Usa `display_name` del backend (no calcula localmente)?
- [ ] ¿Respeta DOM API ONLY (sin `innerHTML` dinámico)?
- [ ] ¿Hace refetch después de mutaciones?
- [ ] ¿Muestra toasts con `display_name` correcto?

---

## REFERENCIAS

- **Contrato Limpieza v1:** `docs/CONTRATO_LIMPIEZA_V1.md`
- **Reporte Forense:** `docs/REPORTE_FORENSE_ALQUIMIA_V1_20260112.md`
- **Cleaning Engine Service:** `src/core/master/services/cleaning-engine-service.js`
- **Signal Registry:** `src/core/student/signals/student-signal-registry.js`
- **Migración Cleaning Engine:** `database/migrations/v5.59.0-cleaning-engine-v1.sql`

---

**FIN DEL DOCUMENTO**
