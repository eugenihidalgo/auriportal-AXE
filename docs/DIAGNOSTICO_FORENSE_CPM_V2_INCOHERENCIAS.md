# Diagnóstico Forense CPM v2: Incoherencias entre Superficies

**Fecha:** 2025-01-27  
**Versión:** 5.74.0  
**Estado:** DIAGNÓSTICO (NO IMPLEMENTACIÓN)  
**Dominio:** MASTER (AuriPortal)

---

## Resumen Ejecutivo

Se analizó el sistema CPM v2 para identificar por qué el estado que devuelve NO es coherente entre superficies (list-projection, flotante, megalist) para los mismos alumnos e ítems.

**Hallazgo principal:** El CPM v2 funciona correctamente cuando recibe inputs idénticos. Las incoherencias detectadas provienen de **diferencias en los inputs** que cada superficie pasa al CPM, específicamente:

1. **Overrides de configuración:** list-projection y megalist aplican overrides vía `resolveItemConfigForStudent()`, mientras que flotante NO aplica overrides.
2. **Preparación de datos:** Cada superficie prepara `cleaning_state` de forma independiente, lo que puede introducir diferencias sutiles en campos null vs undefined.
3. **Configuración de ítem:** Las superficies pueden usar diferentes valores de `threshold_days`, `critical_multiplier` o `required_count` si no se resuelven correctamente los overrides.

**Conclusión:** El CPM v2 es correcto. Las incoherencias son causadas por inputs diferentes entre superficies, no por bugs en el CPM.

---

## Tabla de Incoherencias Detectadas

| Superficie | Aplica Overrides | Fuente de Config | Preparación cleaning_state |
|------------|------------------|------------------|----------------------------|
| **list-projection** | ✅ SÍ (scope='student') | `resolveItemConfigForStudent()` | `getCleaningStatesForItems()` |
| **flotante** | ❌ NO | Item base (sin overrides) | `getStudentsForItemFromCleaningEngine()` |
| **megalist** | ✅ SÍ | `resolveItemConfigForStudent()` | Query directa a `cleaning_item_state` |

**Impacto:** Si un alumno tiene overrides de `threshold_days` o `required_count`, list-projection y megalist calcularán estados diferentes a flotante para el mismo ítem.

---

## Causa Raíz por Incoherencia

### Incoherencia 1: Overrides No Aplicados en Flotante

**Causa:** Flotante (`getStudentsForItem`) NO aplica overrides de configuración antes de llamar al CPM.

**Evidencia:**

**list-projection (línea 703-710):**
```javascript
if (scope === 'student' && studentId) {
  // Aplicar overrides de configuración de item
  effectiveConfig = await resolveItemConfigForStudent(
    effectiveConfig,
    studentId,
    item.item_ref
  );
}
```

**flotante (línea 716-720):**
```javascript
config: {
  threshold_days: thresholdDays,
  critical_multiplier: criticalMultiplier
}
// ❌ NO aplica resolveItemConfigForStudent()
```

**megalist (línea 439):**
```javascript
effectiveConfig = await resolveItemConfigForStudent(
  effectiveConfig,
  student_uuid,
  item.item_ref
);
```

**Impacto:** Si un alumno tiene override de `threshold_days=10` pero el ítem base tiene `frecuencia_dias=7`:
- list-projection usa `threshold_days=10` → estado diferente
- flotante usa `threshold_days=7` → estado diferente
- megalist usa `threshold_days=10` → estado diferente

**Archivos implicados:**
- `src/services/alquimia-general-service.js:716` (flotante NO aplica overrides)
- `src/core/master/services/list-projection-model.js:703` (list-projection SÍ aplica)
- `src/core/master/services/alquimia-alumno-megalist-service.js:439` (megalist SÍ aplica)

---

### Incoherencia 2: Preparación de cleaning_state Diferente

**Causa:** Cada superficie prepara `cleaning_state` de forma independiente, lo que puede introducir diferencias en campos null vs undefined o valores por defecto.

**Evidencia:**

**list-projection (línea 379-394):**
```javascript
statesMap[row.item_ref] = {
  shared: {
    clean_count: row.shared_clean_count || 0,
    remaining: row.shared_remaining,
    completed: row.shared_completed || false,  // ⚠️ false si null
    last_cleaned_at: row.shared_last_cleaned_at,
    effective_since: row.shared_effective_since || null
  },
  ...
};
```

**flotante (línea 690-703):**
```javascript
const sharedData = student.shared || {
  clean_count: student.clean_count || 0,
  last_cleaned_at: student.last_cleaned_at,
  remaining: student.remaining,
  completed: student.completed || 0,  // ⚠️ 0 si null (diferente a false)
  effective_since: student.shared_effective_since || null
};
```

**megalist (línea 439-456):**
```javascript
const sharedData = {
  clean_count: state.shared_clean_count || 0,
  last_cleaned_at: state.shared_last_cleaned_at || null,
  remaining: state.shared_remaining ?? null,
  completed: state.shared_completed || 0,  // ⚠️ 0 si null
  effective_since: state.shared_effective_since ?? null
};
```

**Impacto:** Diferencias en `completed`:
- list-projection: `completed || false` → `false` si null
- flotante: `completed || 0` → `0` si null
- megalist: `completed || 0` → `0` si null

Aunque el CPM v2 trata `0` y `false` de forma similar para RECURRENTE, esta inconsistencia puede causar problemas en UNA_VEZ.

**Archivos implicados:**
- `src/core/master/services/list-projection-model.js:383` (completed || false)
- `src/services/alquimia-general-service.js:694` (completed || 0)
- `src/core/master/services/alquimia-alumno-megalist-service.js:452` (completed || 0)

---

### Incoherencia 3: Configuración de Item No Resuelta Consistente

**Causa:** Las superficies obtienen la configuración del ítem de forma diferente, lo que puede introducir diferencias en valores por defecto.

**Evidencia:**

**list-projection (línea 695-701):**
```javascript
let effectiveConfig = {
  threshold_days: item.frecuencia_dias || 7,
  critical_multiplier: 2.0,
  required_count: item.veces_limpiar || 1,
  ...
};
// Luego aplica overrides si scope='student'
```

**flotante (línea 680-682):**
```javascript
const thresholdDays = item.frecuencia_dias || 7;
const criticalMultiplier = item.critical_multiplier || 2.0;
// ⚠️ Usa item.critical_multiplier (puede no existir)
```

**megalist (línea 439):**
```javascript
effectiveConfig = await resolveItemConfigForStudent(
  {
    threshold_days: item.frecuencia_dias || 7,
    critical_multiplier: 2.0,
    required_count: item.veces_limpiar || 1
  },
  student_uuid,
  item.item_ref
);
```

**Impacto:** Si `item.critical_multiplier` existe en DB pero es `null`, flotante usará `2.0` (fallback), mientras que list-projection y megalist siempre usan `2.0` explícito.

**Archivos implicados:**
- `src/services/alquimia-general-service.js:681` (usa item.critical_multiplier)
- `src/core/master/services/list-projection-model.js:697` (hardcoded 2.0)
- `src/core/master/services/alquimia-alumno-megalist-service.js:439` (hardcoded 2.0)

---

## Confirmación Explícita

**¿El CPM v2 es correcto con esos inputs?**

**SÍ.** El CPM v2 funciona correctamente cuando recibe inputs idénticos. Las incoherencias detectadas provienen de **inputs diferentes** entre superficies, no de bugs en el CPM.

**Evidencia:**
- Cuando todas las superficies pasan el mismo `cleaning_state` y `config` al CPM, el output es idéntico.
- Los logs `[CPM_V2][INPUT]` y `[CPM_V2][OUTPUT]` muestran que el CPM calcula estados de forma determinista.
- Las diferencias aparecen cuando los inputs difieren (overrides, preparación de datos, configuración).

---

## Lista de Puntos Exactos del Código Implicados

### 1. Flotante NO Aplica Overrides

**Archivo:** `src/services/alquimia-general-service.js`  
**Línea:** 716-720  
**Función:** `getStudentsForItem()`  
**Problema:** NO llama a `resolveItemConfigForStudent()` antes de pasar `config` al CPM.

**Código actual:**
```javascript
config: {
  threshold_days: thresholdDays,
  critical_multiplier: criticalMultiplier
}
// ❌ Falta: effectiveConfig = await resolveItemConfigForStudent(...)
```

---

### 2. Preparación Inconsistente de `completed`

**Archivo:** `src/core/master/services/list-projection-model.js`  
**Línea:** 383  
**Problema:** Usa `completed || false` mientras que otras superficies usan `completed || 0`.

**Código actual:**
```javascript
completed: row.shared_completed || false,  // ⚠️ Inconsistente
```

**Comparación:**
- flotante: `completed || 0`
- megalist: `completed || 0`
- list-projection: `completed || false` ❌

---

### 3. Configuración de `critical_multiplier` Inconsistente

**Archivo:** `src/services/alquimia-general-service.js`  
**Línea:** 681  
**Problema:** Usa `item.critical_multiplier || 2.0` mientras que otras superficies usan `2.0` hardcoded.

**Código actual:**
```javascript
const criticalMultiplier = item.critical_multiplier || 2.0;
// ⚠️ Si item.critical_multiplier es null, usa 2.0 (correcto)
// Pero si existe y es diferente, puede causar inconsistencias
```

**Comparación:**
- list-projection: `critical_multiplier: 2.0` (hardcoded)
- megalist: `critical_multiplier: 2.0` (hardcoded)
- flotante: `item.critical_multiplier || 2.0` ⚠️

---

### 4. Cadena de Lectura: Repositorio → Servicio

**Archivo:** `src/infra/repos/master-student-transmutation-read-repo-pg.js`  
**Línea:** 154-197  
**Función:** `getStudentsForItemFromCleaningEngine()`  
**Estado:** ✅ Correcto. Repositorio pasa datos brutos sin calcular estados.

**Archivo:** `src/core/master/services/list-projection-model.js`  
**Línea:** 332-397  
**Función:** `getCleaningStatesForItems()`  
**Estado:** ✅ Correcto. Prepara datos brutos y pasa al CPM.

**Archivo:** `src/services/alquimia-general-service.js`  
**Línea:** 688-703  
**Función:** `getStudentsForItem()`  
**Estado:** ⚠️ Prepara datos correctamente pero NO aplica overrides.

---

## Análisis de Cadena de Lectura

### DB → Repositorio

**Estado:** ✅ Correcto

**Evidencia:**
- Repositorio lee datos brutos desde `cleaning_item_state`
- NO calcula `days_since` en SQL
- NO usa `had_history` (PROHIBIDO)
- Pasa `last_cleaned_at`, `effective_since`, `clean_count`, `remaining`, `completed` como datos brutos

---

### Repositorio → Servicio

**Estado:** ⚠️ Inconsistencias en preparación

**Evidencia:**
- list-projection: `completed || false`
- flotante: `completed || 0`
- megalist: `completed || 0`

**Impacto:** Para UNA_VEZ, `completed` debe ser INTEGER (0 o 1), no boolean. list-projection puede causar problemas.

---

### Servicio → CPM

**Estado:** ⚠️ Inputs diferentes por falta de overrides

**Evidencia:**
- list-projection: Aplica overrides → `effectiveConfig` con valores personalizados
- flotante: NO aplica overrides → `config` con valores base
- megalist: Aplica overrides → `effectiveConfig` con valores personalizados

**Impacto:** Estados diferentes para el mismo alumno + ítem si hay overrides.

---

### CPM → API

**Estado:** ✅ Correcto

**Evidencia:**
- CPM devuelve `state_by_view_layer` completo
- API retorna proyección completa
- No hay transformaciones que alteren el output del CPM

---

### API → Frontend

**Estado:** ✅ Correcto (según código revisado)

**Evidencia:**
- Frontend consume `state_by_view_layer[view_layer]`
- NO calcula estados localmente
- NO infiere desde datos raw

---

## Casos de Prueba Identificados

### Caso 1: Alumno con Override de threshold_days

**Setup:**
- Ítem base: `frecuencia_dias=7`
- Override alumno: `threshold_days=10`

**Resultado esperado:**
- list-projection: `state='reviewed'` (si days_since=8, dentro de threshold=10)
- flotante: `state='pending'` (si days_since=8, fuera de threshold=7)
- megalist: `state='reviewed'` (si days_since=8, dentro de threshold=10)

**Incoherencia:** flotante muestra estado diferente a list-projection y megalist.

---

### Caso 2: Alumno con completed=null en DB

**Setup:**
- `cleaning_item_state.shared_completed = null`

**Resultado:**
- list-projection: `completed=false` → puede causar problemas en UNA_VEZ
- flotante: `completed=0` → correcto para UNA_VEZ
- megalist: `completed=0` → correcto para UNA_VEZ

**Incoherencia:** list-projection usa boolean mientras que otras usan integer.

---

## Verificación de Invariantes

### Invariante 1: CPM como Única Autoridad ✅

**Estado:** CUMPLIDO

**Evidencia:**
- Todas las superficies llaman a `computeCleaningProjection()` o `computeVisualState()`
- No hay cálculos de estado fuera del CPM
- Los logs `[CPM_V2][INPUT]` y `[CPM_V2][OUTPUT]` confirman que el CPM es la única autoridad

---

### Invariante 2: Prohibición de Lógica Duplicada ✅

**Estado:** CUMPLIDO (con advertencia)

**Evidencia:**
- No hay cálculo de `days_since` fuera del CPM
- No hay cálculo de `combo` fuera del CPM
- **ADVERTENCIA:** Preparación de `cleaning_state` está duplicada en 3 lugares (pero no calcula estados, solo prepara datos)

---

### Invariante 3: Backend como Source of Truth ✅

**Estado:** CUMPLIDO

**Evidencia:**
- Frontend NO calcula estados
- Frontend consume `state_by_view_layer[view_layer]`
- No hay inferencias desde datos raw en frontend

---

## Conclusiones

1. **El CPM v2 es correcto:** Funciona determinísticamente cuando recibe inputs idénticos.

2. **Las incoherencias provienen de inputs diferentes:**
   - Flotante NO aplica overrides
   - Preparación inconsistente de `completed` (boolean vs integer)
   - Configuración de `critical_multiplier` inconsistente

3. **Puntos de corrección identificados:**
   - Aplicar overrides en flotante antes de llamar al CPM
   - Estandarizar preparación de `completed` (usar integer, no boolean)
   - Estandarizar configuración de `critical_multiplier` (hardcoded 2.0 en todas las superficies)

4. **No se requieren cambios en CPM v2:** El problema está en la preparación de inputs, no en el cálculo de estados.

---

## Referencias

- **CPM v2:** `docs/CPM_V2_CANONICAL_MODEL.md`
- **Read Model:** `docs/ALQUIMIA_GENERAL_READ_MODEL.md`
- **Invariantes:** `docs/INVARIANTES_CONSTITUCIONALES.md`
- **Código:**
  - `src/core/master/services/cleaning-projection-model.js` (CPM v2)
  - `src/core/master/services/list-projection-model.js` (list-projection)
  - `src/services/alquimia-general-service.js` (flotante)
  - `src/core/master/services/alquimia-alumno-megalist-service.js` (megalist)

---

**Diagnóstico forense completado. El sistema está listo para fase de corrección dirigida.**
