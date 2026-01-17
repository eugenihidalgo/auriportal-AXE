# DIAGNÓSTICO FASE 0 — CLEANING STATE SEED
## Análisis del Sistema Real Antes de Implementar Contrato Canónico

**Fecha:** 2026-01-13  
**Objetivo:** Localizar TODOS los lugares donde se ejecuta el seed y detectar problemas antes de implementar contrato canónico

---

## 1) LUGARES DONDE SE EJECUTA EL SEED

### Lugar #1: GET /master/api/alquimia-alumno/megalist

**Archivo:** `src/endpoints/master-api-alquimia-alumno.js:178`

**Contexto:** GET request (lectura)

**Parámetros recibidos:**
- `student_uuid` (desde query params)
- `level_cap` (opcional, desde query params o null)
- `product_key = 'pde'` (hardcodeado)
- `domain_type = 'transmutation'` (hardcodeado)

**Código real:**
```javascript
const seedResult = await ensureCleaningItemStateSeedForStudent({
  student_uuid: studentUuid,
  product_key: 'pde',
  domain_type: 'transmutation',
  level_cap: levelCap
});
```

**⚠️ PROBLEMA DETECTADO:** 
- Seed se ejecuta SIEMPRE en GET (operación de lectura)
- No hay guard que evite ejecución automática
- Puede causar lentitud en primera carga

**Cuándo se ejecuta:**
- SIEMPRE que se llama GET /megalist
- ANTES de construir megalist
- No hay opción para saltarlo

---

### Lugar #2: POST /master/api/alquimia-alumno/clean

**Archivo:** `src/endpoints/master-api-alquimia-alumno.js:311`

**Contexto:** POST request (escritura)

**Parámetros recibidos:**
- `student_uuid` (desde body)
- `level_cap_override` (opcional, desde body o null)
- `product_key = 'pde'` (hardcodeado)
- `domain_type = 'transmutation'` (hardcodeado)

**Código real:**
```javascript
// Si no existe estado, intentar seed primero
await ensureCleaningItemStateSeedForStudent({
  student_uuid: student_uuid,
  product_key,
  domain_type,
  level_cap: levelCapOverride
});
```

**Cuándo se ejecuta:**
- Solo si estado NO existe para el item específico
- ANTES de intentar limpiar
- Condicional (no siempre)

**⚠️ PROBLEMA DETECTADO:**
- Seed se ejecuta condicionalmente en POST
- Puede causar doble seed si se ejecuta POST sin GET previo
- No hay coordinación entre GET y POST

---

## 2) PARÁMETROS QUE RECIBE EL SEED

### Función: `ensureCleaningItemStateSeedForStudent(options, client)`

**Archivo:** `src/core/master/services/cleaning-state-seed-service.js:27`

**Parámetros:**
1. **`student_uuid`** (OBLIGATORIO)
   - Tipo: string (UUID)
   - Validación: Se lanza error si falta

2. **`product_key`** (opcional, default: 'pde')
   - Tipo: string
   - Hardcodeado en llamadas

3. **`domain_type`** (opcional, default: 'transmutation')
   - Tipo: string
   - Hardcodeado en llamadas

4. **`level_cap`** (opcional, default: null)
   - Tipo: number | null
   - **⚠️ PROBLEMA CRÍTICO:** Si `null`, usa `nivel_efectivo` del estudiante
   - Si viene explícito, lo usa directamente
   - **Inconsistencia:** GET puede usar `level_cap` explícito, POST puede usar `level_cap_override` o `null`

5. **`client`** (opcional, default: null)
   - Tipo: PostgreSQL client (para transacciones)
   - No se usa en las llamadas actuales

---

## 3) EJECUCIONES AUTOMÁTICAS EN GET

**✅ CONFIRMADO:** Seed se ejecuta AUTOMÁTICAMENTE en GET /megalist

**Impacto:**
- TODA llamada a GET /megalist ejecuta seed ANTES de leer
- Si el estudiante tiene muchos items aplicables, seed puede ser lento
- No hay forma de saltar el seed en GET

**Riesgos:**
- Lentitud en primera carga
- Carga innecesaria si estado ya está completo
- No hay guard que evite ejecución automática

---

## 4) VERIFICACIÓN DE COMPORTAMIENTOS

### ¿Modifica estados existentes?

**✅ NO modifica estados existentes**

**Evidencia:**
```sql
ON CONFLICT (student_id, product_key, domain_type, item_ref) DO NOTHING
```

**Comportamiento:**
- Si la fila ya existe → NO hace nada (idempotente)
- Solo inserta filas NUEVAS
- ✅ CUMPLE: No modifica estados existentes

---

### ¿Depende de level_cap mutable?

**⚠️ SÍ depende de level_cap mutable**

**Problemas detectados:**

1. **level_cap cambia entre ejecuciones:**
   - Primera ejecución: `level_cap = 5` → seedea items nivel 1-5
   - Segunda ejecución: `level_cap = 10` → NO seedea items nivel 6-10 (conflict idempotente)
   - **Resultado:** Items nivel 6-10 quedan sin seed

2. **level_cap por defecto (null):**
   - Si `level_cap = null`, usa `nivel_efectivo` del estudiante
   - Si `nivel_efectivo` cambia, seed no se re-ejecuta automáticamente
   - **Resultado:** Items nuevos niveles quedan sin seed hasta que se ejecute seed explícitamente

3. **level_cap diferente entre GET y POST:**
   - GET puede usar `level_cap` explícito
   - POST puede usar `level_cap_override` o `null`
   - **Resultado:** Inconsistencia en qué items se seedean

**⚠️ PROBLEMA CRÍTICO:** Seed NO garantiza coherencia con level_cap mutable.

---

### ¿Inserta más de lo estrictamente necesario?

**⚠️ SÍ inserta más de lo estrictamente necesario**

**Problemas detectados:**

1. **Items sin nivel siempre aplicables:**
   ```sql
   AND (i.nivel IS NULL OR i.nivel <= $4::integer)
   ```
   - Items con `nivel IS NULL` SIEMPRE se seedean
   - Incluso si `level_cap = 1`
   - **Resultado:** Items sin nivel se seedean aunque no sean aplicables

2. **Seed en GET seedea TODOS los items aplicables:**
   - GET /megalist seedea TODOS los items aplicables
   - No solo los que se van a mostrar en megalist
   - **Resultado:** Seed masivo aunque solo se necesiten algunos items

3. **No hay filtro por lista_tipo:**
   - Seed seedea items de TODAS las listas
   - Aunque megalist solo muestra una lista_tipo específica
   - **Resultado:** Seed innecesario de items no mostrados

**⚠️ PROBLEMA:** Seed puede insertar más de lo necesario.

---

## 5) PROBLEMAS ADICIONALES DETECTADOS

### Cálculo de `skipped` puede ser negativo

**Código real:**
```javascript
const skipped = existing - (total_applicable - inserted);
```

**Problema:**
- Si `total_applicable` cambia entre ejecuciones (items nuevos en catálogo)
- `skipped` puede ser negativo
- **Ejemplo:**
  - Primera ejecución: `existing = 50`, `total_applicable = 100`, `inserted = 50` → `skipped = 50 - (100 - 50) = 0` ✅
  - Segunda ejecución (nuevos items): `existing = 50`, `total_applicable = 150`, `inserted = 0` → `skipped = 50 - (150 - 0) = -100` ❌

**⚠️ PROBLEMA:** Cálculo de `skipped` no es robusto.

---

### Fail-open silencioso

**Código real:**
```javascript
catch (error) {
  logWarn('SEED_CLEAN_STATE', 'Error en seed (fail-open)', {...});
  return {
    inserted: 0,
    skipped: 0,
    total_applicable: 0,
    total_existing: 0,
    error: error.message
  };
}
```

**Problema:**
- Si seed falla, retorna `{ inserted: 0, ... }` sin lanzar error
- GET /megalist continúa aunque seed haya fallado
- **Resultado:** Megalist puede construirse sin estados completos, sin que el usuario lo sepa

**⚠️ PROBLEMA:** Fail-open puede ocultar problemas.

---

### No hay señal técnica

**Problema:**
- Seed NO emite señal cuando inserta estados
- No hay forma de saber si seed se ejecutó exitosamente
- No hay forma de auditar cuándo se crearon estados

**⚠️ PROBLEMA:** Seed no es observable.

---

## 6) RESUMEN DE PROBLEMAS

### Problemas Críticos:

1. **Seed en GET automático:**
   - ❌ Ejecuta seed SIEMPRE en GET /megalist
   - ❌ Puede causar lentitud
   - ❌ No hay guard

2. **Depende de level_cap mutable:**
   - ❌ Seed NO garantiza coherencia con level_cap cambiante
   - ❌ Items nuevos niveles quedan sin seed

3. **Inserta más de lo necesario:**
   - ❌ Seed seedea TODOS los items aplicables
   - ❌ No filtra por lista_tipo o items mostrados

### Problemas Menores:

4. **Cálculo de `skipped` puede ser negativo**
5. **Fail-open silencioso puede ocultar problemas**
6. **No hay señal técnica**

---

## 7) REQUISITOS PARA CONTRATO CANÓNICO

Basado en el diagnóstico, el contrato canónico debe:

1. ✅ **NO ejecutarse automáticamente en GET** (solo cuando sea crítico)
2. ✅ **NO depender de level_cap mutable** (usar level_cap observado, no efectivo)
3. ✅ **NO insertar más de lo necesario** (solo estados faltantes)
4. ✅ **Ser idempotente estricto** (ON CONFLICT DO NOTHING)
5. ✅ **Tener guards explícitos** (warn en GET no crítico)
6. ✅ **Emitir señal técnica** (solo si inserted > 0)
7. ✅ **Fail-open robusto** (con logs adecuados)

---

**FIN DEL DIAGNÓSTICO FASE 0**
