# CONTRATO CANÓNICO — OVERRIDES v1

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Estado:** Canónico  
**Dominio:** MASTER / Alquimia General

---

## DEFINICIÓN ONTOLÓGICA

### ¿Qué es Override?

**Override es un mecanismo de configuración personalizada** que permite modificar valores efectivos de campos de estudiante o configuración de items para un estudiante específico, **sin modificar el valor base ni el estado persistido**.

**Semántica:**
- Override es una **capa de lectura** que modifica cómo se calculan proyecciones
- Override NO es mutación (no modifica valor base ni estado persistido)
- Override solo afecta a **lectura efectiva** (CPM, LPM)
- Override es **auditable y reversible** (se almacena en tablas separadas)

**Propósito único:** Permitir que MASTER personalice configuración de items para estudiantes específicos sin modificar el catálogo base ni el estado de limpieza.

**NO es:**
- ❌ Una mutación (no modifica valor base ni estado persistido)
- ❌ Un reset (no modifica `effective_since`)
- ❌ Un seed (no crea estados iniciales)
- ❌ Una limpieza (no modifica `last_cleaned_at` ni `clean_count`)

---

## QUÉ ES / QUÉ NO ES

### ✅ QUÉ ES

1. **Capa de lectura efectiva:**
   - Modifica cómo se calculan proyecciones (CPM, LPM)
   - NO modifica valores base del catálogo
   - NO modifica estado persistido en `cleaning_item_state`
   - Solo afecta a cálculo de estados visibles

2. **Configuración personalizada por estudiante:**
   - Override de campos de estudiante: `nivel`, `fecha_creacion`, `apodo`
   - Override de configuración de item: `required_count`, `threshold_days`, `nivel`, `descripcion`
   - Override de nivel item: `nivel` (permite cambiar nivel aplicable)
   - Override de descripción item: `descripcion` (permite personalizar texto)

3. **Solo scope=student:**
   - Override SOLO se aplica en `scope='student'` (LPM, Megalist)
   - Override NUNCA se aplica en `scope='all'` (agregado sin personalizaciones)
   - Guard explícito que rechaza overrides en `scope='all'`

4. **UUID-only:**
   - Acepta EXCLUSIVAMENTE `student_uuid` (UUID canónico)
   - Rechaza `legacy_alumno_id` explícitamente
   - PostgreSQL es Source of Truth

5. **Validado y seguro:**
   - Valida valores antes de aplicar (required_count >= 1, threshold_days >= 1, etc.)
   - Overrides inválidos se ignoran con WARN (no rompen cálculo)
   - Fallback seguro si override es inválido

---

### ❌ QUÉ NO ES

1. **NO es mutación:**
   - ❌ NO modifica valores base del catálogo (`items_transmutaciones`, `listas_transmutaciones`)
   - ❌ NO modifica estado persistido (`cleaning_item_state`, `cleaning_events`)
   - ❌ NO escribe en tablas de estado
   - ❌ Solo afecta a lectura efectiva

2. **NO es reset:**
   - ❌ NO modifica `effective_since`
   - ❌ NO marca inicio de nuevo ciclo
   - ❌ NO afecta a eventos históricos
   - ❌ Override y reset son independientes

3. **NO es seed:**
   - ❌ NO crea estados iniciales
   - ❌ NO inserta en `cleaning_item_state`
   - ❌ NO afecta a existencia de estados
   - ❌ Override y seed son independientes

4. **NO afecta scope=all:**
   - ❌ Override NUNCA se aplica en `scope='all'`
   - ❌ Agregado siempre usa valores base (sin personalizaciones)
   - ❌ Guard explícito que rechaza overrides en `scope='all'`

5. **NO modifica eventos históricos:**
   - ❌ Override NO afecta a eventos previos
   - ❌ Override NO afecta a `cleaning_events`
   - ❌ Override solo afecta a proyección futura

---

## ORDEN DE APLICACIÓN

### ✅ Orden Canónico

1. **ANTES de CPM (Cleaning Projection Model):**
   - Override se aplica ANTES de calcular proyección
   - CPM recibe `item_config` efectivo con overrides aplicados
   - CPM calcula estados usando configuración efectiva

2. **NUNCA después de CPM:**
   - Override NO se aplica después de calcular proyección
   - Override NO modifica estados calculados por CPM
   - Override solo modifica inputs de CPM (config)

3. **NUNCA en LPM ALL:**
   - Override NO se aplica en `scope='all'` (agregado)
   - LPM ALL siempre usa valores base (sin personalizaciones)
   - Guard explícito que rechaza overrides en `scope='all'`

---

### Pipeline Canónico

```
1. Leer valores base del item (catálogo)
   ↓
2. Resolver overrides para estudiante (resolveEffectiveItemConfigForStudent)
   ↓
3. Validar valores efectivos (required_count >= 1, threshold_days >= 1, etc.)
   ↓
4. Si override inválido → Ignorar con WARN, usar valor base
   ↓
5. Construir config efectiva (base + overrides validados)
   ↓
6. Pasar config efectiva a CPM
   ↓
7. CPM calcula estados usando config efectiva
   ↓
8. LPM usa estados calculados por CPM
```

---

## PRECEDENCIAS

### Precedencia de Overrides

**Regla:** Override > Valor base (para campo específico)

**Aplicación:**
- Si existe override para `required_count` → usar override
- Si NO existe override para `required_count` → usar valor base
- Override prevalece sobre valor base solo si existe y es válido

**Validación:**
- Override inválido (required_count < 1, threshold_days < 1, etc.) → Ignorar, usar valor base
- Override válido → Usar override, ignorar valor base

---

### Precedencia con Reset

**Regla:** Override y Reset son **independientes**

**Aplicación:**
- Reset establece `effective_since` (inicio de ciclo)
- Override modifica `threshold_days`, `required_count`, etc. (configuración)
- Reset NO prevalece sobre override (son independientes)
- Override NO prevalece sobre reset (reset establece ciclo, override configura)

**Ejemplo:**
- Reset establece `effective_since = '2026-01-01'` (inicio de ciclo)
- Override establece `threshold_days = 14` (personalizado)
- CPM calcula estado usando `effective_since` (del reset) y `threshold_days = 14` (del override)

---

### Precedencia con Seed

**Regla:** Override y Seed son **independientes**

**Aplicación:**
- Seed crea estados iniciales "never" en `cleaning_item_state`
- Override modifica cómo se calculan estados desde estados seedeados
- Seed NO prevalece sobre override (son independientes)
- Override NO prevalece sobre seed (seed crea estado, override configura cálculo)

**Ejemplo:**
- Seed crea estado inicial con `shared_completed = 0`, `shared_remaining = 3` (base)
- Override establece `required_count = 5` (personalizado)
- CPM calcula estado usando `shared_completed = 0` (del seed) y `required_count = 5` (del override)

---

### Precedencia con Clean

**Regla:** Override y Clean son **independientes**

**Aplicación:**
- Clean modifica `last_cleaned_at`, `clean_count` (estado persistido)
- Override modifica `threshold_days`, `required_count` (configuración)
- Clean NO prevalece sobre override (son independientes)
- Override NO prevalece sobre clean (clean actualiza estado, override configura cálculo)

**Ejemplo:**
- Clean actualiza `last_cleaned_at = '2026-01-10'` (estado persistido)
- Override establece `threshold_days = 14` (personalizado)
- CPM calcula estado usando `last_cleaned_at = '2026-01-10'` (del clean) y `threshold_days = 14` (del override)

---

## RELACIÓN CON OTROS SISTEMAS

### Reset (resetStudentItemProgress)

**Relación:**
- Override y Reset son **independientes**
- Reset establece `effective_since` (inicio de ciclo)
- Override modifica configuración efectiva (threshold_days, required_count, etc.)

**Contrato:**
- Reset NO modifica overrides
- Override NO modifica `effective_since`
- Override se aplica ANTES de CPM, reset se aplica en estado persistido

**Precedencia:**
- Reset establece ciclo (effective_since)
- Override configura cálculo (threshold_days, required_count)
- Ambos se usan en CPM: `effective_since` (del reset) + `threshold_days` (del override)

**Referencias:** `docs/contracts/RESET_CONTRACT_V1.md`

---

### Seed (Cleaning State Seed)

**Relación:**
- Override y Seed son **independientes**
- Seed crea estados iniciales "never" en `cleaning_item_state`
- Override modifica cómo se calculan estados desde estados seedeados

**Contrato:**
- Seed NO modifica overrides
- Override NO crea estados iniciales
- Override se aplica ANTES de CPM, seed crea estados antes de CPM

**Precedencia:**
- Seed crea estado (cleaning_item_state)
- Override configura cálculo (threshold_days, required_count)
- Ambos se usan en CPM: estado (del seed) + config efectiva (del override)

**Referencias:** `docs/contracts/SEED_CONTRACT_V1.md`

---

### CPM (Cleaning Projection Model)

**Relación:**
- CPM recibe `item_config` efectivo con overrides aplicados
- CPM calcula estados usando configuración efectiva
- CPM NO aplica overrides directamente (recibe config efectiva)

**Contrato:**
- Override se aplica ANTES de CPM (no dentro de CPM)
- CPM usa `item_config` efectivo (base + overrides validados)
- CPM NO valida overrides (validación previa)

**Orden:**
1. Resolver overrides → `item_config` efectivo
2. Validar overrides → ignorar inválidos con WARN
3. Pasar `item_config` efectivo a CPM
4. CPM calcula estados usando config efectiva

**Referencias:** `src/core/master/services/cleaning-projection-model.js:40-78`

---

### LPM (List Projection Model)

**Relación:**
- LPM aplica overrides SOLO en `scope='student'`
- LPM NUNCA aplica overrides en `scope='all'`
- LPM usa CPM para calcular estados (CPM recibe config efectiva)

**Contrato:**
- Override se aplica ANTES de CPM (en LPM)
- LPM tiene guard explícito que rechaza overrides en `scope='all'`
- LPM pasa config efectiva a CPM solo si `scope='student'`

**scope='student':**
- LPM aplica overrides antes de CPM
- LPM pasa config efectiva a CPM
- CPM calcula estados usando config efectiva

**scope='all':**
- LPM NO aplica overrides (guard explícito)
- LPM usa valores base (sin personalizaciones)
- CPM calcula estados usando valores base

**Referencias:** `src/core/master/services/list-projection-model.js:790-812`

---

### Megalist (Alquimia Alumno Megalist Service)

**Relación:**
- Megalist debe aplicar overrides igual que LPM
- Megalist usa CPM para calcular estados (CPM recibe config efectiva)
- Megalist SOLO se usa para `scope='student'` (no tiene scope='all')

**Contrato:**
- Megalist debe aplicar overrides ANTES de CPM
- Megalist debe usar `resolveEffectiveItemConfigForStudent()` (función centralizada)
- Megalist debe validar overrides antes de aplicar

**⚠️ PROBLEMA ACTUAL:**
- Megalist NO aplica overrides (solo usa valores base)
- Inconsistencia con LPM que SÍ aplica overrides
- Debe aplicarse igual que LPM

**Referencias:** `src/core/master/services/alquimia-alumno-megalist-service.js:448-453`

---

## SCOPE RULES

### ✅ scope='student' (Permitido)

**Regla:** Override SOLO se aplica en `scope='student'`

**Aplicación:**
- LPM con `scope='student'` → Aplicar overrides
- Megalist (implícitamente `scope='student'`) → Aplicar overrides
- Cualquier proyección individual → Aplicar overrides

**Guard:**
```javascript
if (scope === 'student' && studentId) {
  // Aplicar overrides de configuración de item
  effectiveConfig = await resolveEffectiveItemConfigForStudent(
    effectiveConfig,
    studentId,
    item.item_ref
  );
}
```

---

### ❌ scope='all' (Prohibido)

**Regla:** Override NUNCA se aplica en `scope='all'`

**Aplicación:**
- LPM con `scope='all'` → NO aplicar overrides (guard explícito)
- Agregado siempre usa valores base (sin personalizaciones)
- Proyección agregada → NO aplicar overrides

**Guard:**
```javascript
if (scope === 'all') {
  // En scope='all', usar valores base (sin overrides)
  // Esto es constitucional: ALL muestra estado agregado sin personalizaciones
}
```

**Razón:**
- Agregado debe mostrar estado real sin personalizaciones
- Personalizaciones solo aplican a vista individual
- Consistencia: todos los estudiantes ven mismo agregado

---

## VALIDACIÓN DE OVERRIDES

### ✅ Validaciones Obligatorias

1. **required_count:**
   - Debe ser `>= 1` (número entero)
   - Si inválido → Ignorar override, usar valor base, log WARN

2. **threshold_days:**
   - Debe ser `>= 1` (número entero)
   - Si inválido → Ignorar override, usar valor base, log WARN

3. **critical_multiplier:**
   - Debe ser `>= 1.0` (número decimal)
   - Si inválido → Ignorar override, usar valor base, log WARN

4. **nivel:**
   - Debe ser `>= 0` (número entero, puede ser NULL)
   - Si inválido (< 0) → Ignorar override, usar valor base, log WARN

5. **descripcion:**
   - Debe ser string (puede ser vacío)
   - Si inválido (no string) → Ignorar override, usar valor base, log WARN

---

### Política de Overrides Inválidos

**Comportamiento:**
- Override inválido → Ignorar override, usar valor base
- Log WARN estructurado con prefijo `[OVERRIDE][VALIDATION]`
- NO rompe cálculo (fallback seguro)
- NO lanza error (fail-open)

**Razón:**
- Override es capa de lectura (no crítica)
- Fallback seguro garantiza que cálculo continúa
- WARN permite detectar overrides inválidos en producción

**Obligatorio:**
- Log estructurado con prefijo `[OVERRIDE][VALIDATION]`
- Incluir trace_id en todos los logs
- Incluir valor inválido y razón de invalidación

---

## POLÍTICA DE FALLOS

### Fail-Open Robusto

**Comportamiento:**
- Si override inválido → Ignorar override, usar valor base, log WARN
- Si resolución falla → Usar valor base, log WARN
- Si validación falla → Usar valor base, log WARN
- NO rompe cálculo (fallback seguro)

**Razón:**
- Override es capa de lectura (no crítica)
- Fallback seguro garantiza que cálculo continúa
- WARN permite detectar problemas en producción

**Obligatorio:**
- Log estructurado con prefijos canónicos
- Incluir trace_id en todos los logs
- Incluir error.message y error.code en logs

---

### Fail-Hard en Validaciones Críticas

**Hard-fail:**
1. `student_uuid` faltante → Error explícito (no fail-open)
2. `student_uuid` formato inválido → Error explícito
3. `item_ref` faltante → Error explícito

**Fail-open:**
- Override inválido → Log WARN y usar valor base
- Resolución falla → Log WARN y usar valor base
- Validación falla → Log WARN y usar valor base

---

## INVARIANTES CONSTITUCIONALES

### 1. Override NO modifica estado persistido

**Invariante:**
- Override NO modifica valores base del catálogo
- Override NO modifica estado persistido en `cleaning_item_state`
- Override NO modifica eventos en `cleaning_events`
- Override solo afecta a lectura efectiva (CPM, LPM)

**Verificación:**
- Test que verifica que override NO modifica valores base
- Test que verifica que override NO modifica estado persistido
- Test que verifica que override solo afecta a cálculo de estados

---

### 2. Override SOLO se aplica en scope='student'

**Invariante:**
- Override NUNCA se aplica en `scope='all'`
- LPM tiene guard explícito que rechaza overrides en `scope='all'`
- Agregado siempre usa valores base (sin personalizaciones)

**Verificación:**
- Test que verifica que override NO se aplica en `scope='all'`
- Test que verifica que guard rechaza overrides en `scope='all'`
- Test que verifica que agregado usa valores base

---

### 3. Override se aplica ANTES de CPM

**Invariante:**
- Override se aplica ANTES de calcular proyección
- CPM recibe `item_config` efectivo con overrides aplicados
- Override NUNCA se aplica después de CPM

**Verificación:**
- Test que verifica que override se aplica antes de CPM
- Test que verifica que CPM recibe config efectiva
- Test que verifica que override NO modifica estados calculados

---

### 4. Override y Reset son independientes

**Invariante:**
- Override NO modifica `effective_since`
- Reset NO modifica overrides
- Ambos se usan en CPM de forma independiente

**Verificación:**
- Test que verifica que override NO modifica `effective_since`
- Test que verifica que reset NO modifica overrides
- Test que verifica que ambos se usan correctamente en CPM

---

### 5. Override y Seed son independientes

**Invariante:**
- Override NO crea estados iniciales
- Seed NO modifica overrides
- Seed crea estado, override configura cálculo

**Verificación:**
- Test que verifica que override NO crea estados iniciales
- Test que verifica que seed NO modifica overrides
- Test que verifica que ambos se usan correctamente en CPM

---

### 6. Override validado antes de aplicar

**Invariante:**
- Override se valida antes de aplicar
- Override inválido se ignora con WARN
- Fallback seguro si override es inválido

**Verificación:**
- Test que verifica que override se valida antes de aplicar
- Test que verifica que override inválido se ignora con WARN
- Test que verifica que fallback seguro funciona

---

### 7. UUID-only

**Invariante:**
- Override acepta EXCLUSIVAMENTE `student_uuid` (UUID canónico)
- Rechaza `legacy_alumno_id` explícitamente
- PostgreSQL es Source of Truth

**Verificación:**
- Guard explícito que rechaza `legacy_alumno_id`
- Validación de formato UUID antes de aplicar

---

### 8. Función centralizada de resolución

**Invariante:**
- Override se resuelve mediante `resolveEffectiveItemConfigForStudent()`
- Función centralizada con validación integrada
- NO hay múltiples formas de resolver overrides

**Verificación:**
- Test que verifica que función centralizada se usa
- Test que verifica que validación está integrada
- Test que verifica que NO hay resolución duplicada

---

## COMPORTAMIENTOS LEGACY (DEPRECATED)

### 1. Overrides NO aplicados en Megalist

**DEPRECATED:**
```javascript
// ❌ LEGACY: Megalist NO aplica overrides
const config = itemKind === 'recurrente' ? {
  threshold_days: item.frecuencia_dias || 7,
  critical_multiplier: item.critical_multiplier || 2.0
} : {
  required_count: item.veces_limpiar || 1
};
```

**Canónico:**
```javascript
// ✅ CANÓNICO: Megalist aplica overrides igual que LPM
let effectiveConfig = {
  threshold_days: item.frecuencia_dias || 7,
  critical_multiplier: 2.0,
  required_count: item.veces_limpiar || 1,
  nivel: item.nivel || null,
  descripcion: item.descripcion || null
};

effectiveConfig = await resolveEffectiveItemConfigForStudent(
  effectiveConfig,
  student_uuid,
  item.item_ref
);

// Validar valores efectivos
effectiveConfig = validateEffectiveConfig(effectiveConfig, item_ref, student_uuid);
```

**Referencia:** `src/core/master/services/alquimia-alumno-megalist-service.js:448-453`

---

### 2. Overrides NO validados

**DEPRECATED:**
```javascript
// ❌ LEGACY: Override NO se valida antes de aplicar
if (override_key === 'required_count') {
  const value = typeof override_value === 'number' ? override_value : Number(override_value);
  effectiveConfig.required_count = value;
  // NO valida que value >= 1
}
```

**Canónico:**
```javascript
// ✅ CANÓNICO: Override se valida antes de aplicar
if (override_key === 'required_count') {
  const value = typeof override_value === 'number' ? override_value : Number(override_value);
  if (value < 1) {
    logWarn('OverrideResolution', 'Override required_count inválido', {
      student_uuid,
      item_ref,
      override_value: value,
      reason: 'required_count debe ser >= 1'
    });
    // Ignorar override, usar valor base
    return itemConfig;
  }
  effectiveConfig.required_count = value;
}
```

**Referencia:** `src/core/master/services/override-resolution-service.js:120-131`

---

### 3. Resolución NO centralizada

**DEPRECATED:**
```javascript
// ❌ LEGACY: Múltiples lugares resuelven overrides de forma diferente
// LPM: resolveItemConfigForStudent() (con validación parcial)
// Megalist: NO aplica overrides
// CPM: NO aplica overrides (recibe config efectiva)
```

**Canónico:**
```javascript
// ✅ CANÓNICO: Función centralizada con validación integrada
effectiveConfig = await resolveEffectiveItemConfigForStudent(
  effectiveConfig,
  student_uuid,
  item.item_ref
);
// Función incluye validación automática
```

**Referencia:** `src/core/master/services/override-resolution-service.js:95-179`

---

## FIRMA DE FUNCIÓN CANÓNICA

```javascript
/**
 * Resuelve configuración efectiva de item para estudiante con overrides aplicados.
 * 
 * UUID-ONLY: Acepta student_uuid (UUID canónico)
 * 
 * @param {Object} itemConfig - Configuración base del item
 * @param {string} student_uuid - UUID canónico del estudiante (OBLIGATORIO)
 * @param {string} item_ref - Referencia del item (OBLIGATORIO)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Configuración efectiva con overrides aplicados y validados
 */
async function resolveEffectiveItemConfigForStudent(itemConfig, student_uuid, item_ref, client = null)
```

**Cambios canónicos:**
- ✅ Nombre: `resolveEffectiveItemConfigForStudent` (más explícito)
- ✅ Validación integrada (required_count >= 1, threshold_days >= 1, etc.)
- ✅ Overrides inválidos se ignoran con WARN (no rompen cálculo)
- ✅ Fallback seguro si override es inválido

---

## VERIFICACIÓN Y TESTS

### Tests Obligatorios

1. **Test de No Modificación de Estado:**
   - Crear override de `required_count`
   - Verificar que override NO modifica valores base del catálogo
   - Verificar que override NO modifica estado persistido

2. **Test de Aplicación en scope='student':**
   - Crear override de `threshold_days`
   - Ejecutar LPM con `scope='student'`
   - Verificar que override se aplica correctamente

3. **Test de NO Aplicación en scope='all':**
   - Crear override de `threshold_days`
   - Ejecutar LPM con `scope='all'`
   - Verificar que override NO se aplica (valores base)

4. **Test de Validación de Overrides:**
   - Crear override inválido (`required_count = 0`)
   - Verificar que override se ignora con WARN
   - Verificar que cálculo continúa con valor base

5. **Test de Aplicación en Megalist:**
   - Crear override de `required_count`
   - Ejecutar Megalist
   - Verificar que override se aplica correctamente

6. **Test de Independencia con Reset:**
   - Crear override de `threshold_days`
   - Ejecutar reset
   - Verificar que override NO modifica `effective_since`
   - Verificar que ambos se usan correctamente en CPM

7. **Test de Independencia con Seed:**
   - Crear override de `required_count`
   - Ejecutar seed
   - Verificar que override NO crea estados iniciales
   - Verificar que ambos se usan correctamente en CPM

8. **Test de Orden de Aplicación:**
   - Crear override de `threshold_days`
   - Ejecutar CPM
   - Verificar que override se aplica ANTES de CPM
   - Verificar que CPM recibe config efectiva

---

## REFERENCIAS

- **Diagnóstico FASE 0:** `docs/DIAGNOSTICO_OVERRIDES_FASE0.md`
- **Servicio actual:** `src/core/master/services/override-resolution-service.js`
- **LPM:** `src/core/master/services/list-projection-model.js:790-812`
- **Megalist:** `src/core/master/services/alquimia-alumno-megalist-service.js:448-453`
- **CPM:** `src/core/master/services/cleaning-projection-model.js:40-78`
- **Reset Contract:** `docs/contracts/RESET_CONTRACT_V1.md`
- **Seed Contract:** `docs/contracts/SEED_CONTRACT_V1.md`

---

**FIN DEL CONTRATO CANÓNICO OVERRIDES v1**
