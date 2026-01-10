# DIAGNÓSTICO FORENSE UI/CONTRATO — ALQUIMIA UNA_VEZ (MASTER)
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-09  
**Objetivo:** Diagnosticar por qué Alquimia UNA_VEZ NO funciona de forma consistente  
**Modo:** DIAGNÓSTICO FORENSE (NO IMPLEMENTAR, SOLO DOCUMENTAR)

---

## RESUMEN EJECUTIVO

**Hallazgos Críticos:**
1. ❌ **NO EXISTE** tab UNA_VEZ real en la UI
2. ❌ **"+1 para todos" filtra por nivel** (viola regla `alquimia-flotante-no-filter-level`)
3. ❌ **Toast "undefined limpiado"** por campo incorrecto en objeto student
4. ❌ **Cálculo de aplicabilidad heredado de recurrentes** (incompatible con UNA_VEZ)
5. ⚠️ **Payloads frontend inconsistentes** entre Alquimia Alumno y Alquimia General

---

## FASE 1 — MAPA REAL DE UI

### 1.1 Alquimia Alumno (`/master/alumnos/:student_uuid/alquimia`)

**Archivos involucrados:**
- `public/js/master/master-alquimia-alumno-client.js` (1,493 líneas)
- `src/core/master/services/alquimia-alumno-megalist-service.js`
- Endpoint: `POST /master/api/alquimia-alumno/clean`

**Render:**
- Handler: `handleCleanItem(item)` (línea 805)
- Renderiza megalist con items agrupados por listas
- Muestra items recurrentes y UNA_VEZ en la misma vista
- **NO hay separación por tipo** (todo mezclado)

**Flujo de limpieza:**
1. Usuario selecciona alumno → carga megalist
2. Usuario hace click en botón "Limpiar" o "Marcar como revisado"
3. Se ejecuta `handleCleanItem(item)` (línea 805)
4. Envía payload a `/master/api/alquimia-alumno/clean`
5. Payload incluye `item.lista_tipo` pero **NO se envía explícitamente** como `item_kind`

**Código relevante:**
```829:835:public/js/master/master-alquimia-alumno-client.js
item_kind: item.lista_tipo || 'recurrente', // REQUERIDO (ya disponible en megalist)
```

✅ **VERIFICADO:** `item.lista_tipo` SÍ está disponible en el objeto `item` del megalist  
❌ **PROBLEMA:** Backend NO recibe `item_kind` explícitamente, lo infiere desde lista

---

### 1.2 Alquimia General — Flotante VER (`/master/alquimia-general`)

**Archivos involucrados:**
- `public/js/master/master-alquimia-general-client.js` (2,675 líneas)
- `src/services/alquimia-general-service.js`
- Endpoint: `GET /master/api/alquimia-general/items/:item_ref/students`
- Endpoint: `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`
- Endpoint: `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`

**Render:**
- Handler: `handleVerItem(item, cleanLayer)` (línea 831)
- Abre modal flotante con estudiantes agrupados por estado
- **Renderiza diferente según tipo:**
  - **Recurrentes:** 4 columnas (REVISADO, PENDIENTE, IMPORTANTE, NUNCA)
  - **UNA_VEZ:** 2 columnas (COMPLETADO, PENDIENTE)

**Flujo de limpieza desde flotante:**
1. Usuario hace click en "VER" en un item → abre flotante
2. Flotante muestra estudiantes agrupados por estado según `tipo`
3. Usuario hace click en botón "✓" junto a un estudiante
4. Se ejecuta `handleLimpiarEstudiante(student, item, cleanLayer, tipo)` (línea 1353)
5. Envía payload a `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student`
6. Payload incluye `item_kind: tipo` explícitamente ✅

**Código relevante:**
```1363:1372:public/js/master/master-alquimia-general-client.js
const payload = {
  student_id: student.student_id,
  item_ref: item.item_ref,
  item_kind: tipo, // 'recurrente' | 'una_vez' - REQUERIDO
  domain_type: 'transmutation',
  clean_layer: cleanLayer,
  actor_type: 'master',
  surface_key: 'master.alquimia_general'
};
```

✅ **VERIFICADO:** Alquimia General SÍ envía `item_kind` explícitamente

---

### 1.3 "+1 para todos" (`handleIncrementAllItem`)

**Ubicación:** `public/js/master/master-alquimia-general-client.js:2180`

**Flujo:**
1. Usuario hace click en botón "+1" en un item UNA_VEZ
2. Se ejecuta `handleIncrementAllItem(item)` (línea 2180)
3. Envía POST a `/master/api/alquimia-general/items/:item_ref/master/increment-all`
4. Payload: `{ clean_layer: 'shared' }` (solo esto)
5. Backend llama `incrementAll(itemRef, productKey, cleanLayer)` (alquimia-general-service.js:862)
6. Servicio llama `incrementAllStudents()` del Cleaning Engine
7. Cleaning Engine llama `markCleanAllStudents()` **CON FILTRO POR NIVEL** ❌

**Código relevante:**
```2187:2195:public/js/master/master-alquimia-general-client.js
const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/increment-all`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clean_layer: 'shared'
  })
});
```

❌ **PROBLEMA:** Payload NO incluye `item_kind`, backend lo fuerza a 'una_vez' (fallback legacy)

---

### 1.4 ¿Existe Tab UNA_VEZ Separado?

**RESPUESTA:** ❌ **NO EXISTE**

**Evidencia:**
- Busqueda en código: `grep -r "tab.*una_vez\|una_vez.*tab" public/js/master` → Sin resultados
- Busqueda en código: `grep -r "UNA_VEZ\|UNA VEZ" public/js/master/master-alquimia-general-client.js` → Solo referencias a `tipo === 'una_vez'` en lógica condicional
- UI renderiza items de ambos tipos en la misma vista
- Separación solo visual (columnas diferentes en flotante)

**Conclusión:** No hay tab UNA_VEZ real. La separación es lógica (renderiza diferente según `tipo`) pero no hay UI dedicada.

---

## FASE 2 — PAYLOADS FRONTEND

### 2.1 Limpieza desde Alquimia Alumno

**Función:** `handleCleanItem(item)` (línea 805)

**Payload enviado:**
```javascript
{
  student_id: state.selectedStudentId,
  item_ref: item.item_ref,
  item_kind: item.lista_tipo || 'recurrente', // ✅ Disponible pero con fallback
  actor_type: 'master',
  surface_key: 'master.alquimia_alumno',
  clean_layer: 'shared',
  domain_type: 'transmutation',
  product_key: 'pde'
}
```

**Código exacto:**
```826:835:public/js/master/master-alquimia-alumno-client.js
const body = {
  student_id: state.selectedStudentId,
  item_ref: item.item_ref,
  item_kind: item.lista_tipo || 'recurrente', // REQUERIDO (ya disponible en megalist)
  actor_type: 'master', // REQUERIDO
  surface_key: 'master.alquimia_alumno', // REQUERIDO
  clean_layer: 'shared', // REQUERIDO
  domain_type: 'transmutation',
  product_key: 'pde'
};
```

✅ **CORRECTO:** Payload completo y explícito (después de fixes previos)

---

### 2.2 Limpieza desde Flotante (Alquimia General)

**Función:** `handleLimpiarEstudiante(student, item, cleanLayer, tipo)` (línea 1353)

**Payload enviado:**
```javascript
{
  student_id: student.student_id,
  item_ref: item.item_ref,
  item_kind: tipo, // ✅ Explícito desde parámetro
  domain_type: 'transmutation',
  clean_layer: cleanLayer, // 'shared' | 'pde'
  actor_type: 'master',
  surface_key: 'master.alquimia_general'
}
```

✅ **CORRECTO:** Payload completo y explícito

---

### 2.3 "+1 para todos" (increment-all)

**Función:** `handleIncrementAllItem(item)` (línea 2180)

**Payload enviado:**
```javascript
{
  clean_layer: 'shared' // ❌ SOLO ESTO
}
```

**Código exacto:**
```2187:2195:public/js/master/master-alquimia-general-client.js
const response = await fetch(`/master/api/alquimia-general/items/${item.item_ref}/master/increment-all`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clean_layer: 'shared'
  })
});
```

❌ **PROBLEMA:** Payload incompleto. NO incluye `item_kind` (backend lo fuerza con fallback legacy)

**Backend (incrementAll):**
```862:883:src/services/alquimia-general-service.js
export async function incrementAll(itemRef, productKey = 'pde', cleanLayer = 'shared') {
  // ...
  const result = await cleaningIncrementAll({
    item_ref: itemRef,
    item_kind: 'una_vez', // ✅ Hardcodeado aquí (correcto)
    clean_layer: cleanLayer,
    product_key: productKey,
    domain_type: 'transmutation',
    actor_type: 'master',
    surface_key: 'master.alquimia_general',
    meta: {
      source: 'alquimia-general-service'
    }
  });
```

✅ **Backend correcto:** `item_kind: 'una_vez'` hardcodeado (esperado para increment-all)

---

## FASE 3 — BACKEND RECEPTION

### 3.1 Endpoint: `POST /master/api/alquimia-alumno/clean`

**Handler:** `src/endpoints/master-api-alquimia-alumno.js` (línea 159)

**Payload recibido:**
```javascript
{
  student_id: number,
  item_ref: string,
  item_kind?: 'recurrente' | 'una_vez', // ✅ Viene del frontend (después de fixes)
  actor_type?: 'master',
  surface_key?: 'master.alquimia_alumno',
  clean_layer?: 'shared',
  domain_type?: 'transmutation',
  product_key?: 'pde'
}
```

**Validación:**
- Valida `student_id`, `item_ref` (requeridos)
- `item_kind` viene del frontend pero backend NO lo valida como requerido
- Backend NO fuerza campos (ya vienen del frontend después de fixes)

✅ **CORRECTO:** Backend recibe payload completo

---

### 3.2 Endpoint: `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student`

**Handler:** `src/endpoints/master-api-alquimia-general.js` (línea 900)

**Payload recibido:**
```javascript
{
  student_id: number,
  item_ref: string, // También en URL path
  item_kind: 'recurrente' | 'una_vez', // ✅ REQUERIDO y validado
  domain_type?: 'transmutation',
  clean_layer?: 'shared' | 'pde',
  actor_type?: 'master',
  surface_key?: 'master.alquimia_general'
}
```

**Validación:**
```919:921:src/endpoints/master-api-alquimia-general.js
if (!body.item_kind || (body.item_kind !== 'recurrente' && body.item_kind !== 'una_vez')) {
  return jsonError('item_kind es requerido y debe ser "recurrente" o "una_vez"', 'INVALID_ITEM_KIND', 400, traceId);
}
```

✅ **CORRECTO:** Backend valida `item_kind` como requerido

---

### 3.3 Endpoint: `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`

**Handler:** `src/endpoints/master-api-alquimia-general.js` (línea 995)

**Payload recibido:**
```javascript
{
  clean_layer?: 'shared' | 'pde' // Solo esto viene del frontend
}
```

**Backend construye:**
```1008:1011:src/endpoints/master-api-alquimia-general.js
const cleanLayer = body.clean_layer || url.searchParams.get('clean_layer') || 'shared';

const result = await incrementAll(itemRef, productKey, cleanLayer);
```

**Servicio `incrementAll`:**
```862:883:src/services/alquimia-general-service.js
const result = await cleaningIncrementAll({
  item_ref: itemRef,
  item_kind: 'una_vez', // ✅ Hardcodeado correctamente
  clean_layer: cleanLayer,
  product_key: productKey,
  domain_type: 'transmutation',
  actor_type: 'master',
  surface_key: 'master.alquimia_general',
  meta: {
    source: 'alquimia-general-service'
  }
});
```

✅ **CORRECTO:** Backend fuerza `item_kind: 'una_vez'` correctamente (esperado para increment-all)

---

## FASE 4 — CÁLCULO DE APLICABILIDAD

### 4.1 "+1 para todos" — ¿Por qué devuelve 0 alumnos en UNA_VEZ?

**Flujo completo:**
1. Frontend llama `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`
2. Backend llama `incrementAll(itemRef, productKey, cleanLayer)`
3. Servicio llama `incrementAllStudents({ item_kind: 'una_vez', ... })`
4. Cleaning Engine llama `markCleanAllStudents({ item_kind: 'una_vez', ... })`

**Problema crítico en `markCleanAllStudents`:**

```544:553:src/core/master/services/cleaning-engine-service.js
for (const studentId of activeStudentIds) {
  try {
    // Verificar si aplica por nivel antes de limpiar
    const nivelEfectivo = await getStudentEffectiveLevel(studentId, product_key);
    
    if (nivelEfectivo < itemNivel) {
      skipped++;
      skippedBreakdown.not_applicable_level++;
      continue; // ❌ FILTRA POR NIVEL AQUÍ
    }
```

❌ **PROBLEMA:** `markCleanAllStudents` **SIEMPRE filtra por nivel**, incluso para UNA_VEZ

**Regla constitucional violada:**
- `alquimia-flotante-no-filter-level`: "En flotantes de Alquimia General NO se filtra por nivel"
- Esta regla aplica a GET students, pero `markCleanAllStudents` (usado por increment-all) **SÍ filtra**

**Código que debería aplicar la regla:**
```546:553:src/core/master/services/cleaning-engine-service.js
// Verificar si aplica por nivel antes de limpiar
const nivelEfectivo = await getStudentEffectiveLevel(studentId, product_key);

if (nivelEfectivo < itemNivel) {
  skipped++;
  skippedBreakdown.not_applicable_level++;
  continue; // ❌ ESTO VIOLA LA REGLA CONSTITUCIONAL
}
```

**Impacto:**
- Si item tiene `nivel: 5` y hay 10 alumnos, pero solo 2 tienen `nivel_efectivo >= 5`
- `markCleanAllStudents` procesará solo 2 alumnos
- `updated` será máximo 2 (o 0 si ya estaban completos)
- Toast mostrará: "Item incrementado para 0 alumnos" ❌

---

### 4.2 GET Students para Flotante — ¿Respetan la regla?

**Endpoint:** `GET /master/api/alquimia-general/items/:item_ref/students`

**Handler:** `src/endpoints/master-api-alquimia-general.js` (línea 814)

**Código:**
```817:824:src/endpoints/master-api-alquimia-general.js
result = await getStudentsForItem(itemRef, tipo, productKey, { 
  clean_layer: cleanLayer,
  skip_level_filter: true // ✅ Master puede limpiar cualquier item a cualquier alumno
});
```

✅ **CORRECTO:** GET students SÍ respeta la regla (`skip_level_filter: true`)

**Servicio `getStudentsForItem`:**
```516:541:src/services/alquimia-general-service.js
// REGLA MASTER: Flotante Master NUNCA filtra por nivel (bypass si skip_level_filter=true)
const skipLevelFilter = options.skip_level_filter === true; // Para contexto Master
const studentsFiltered = [];
const studentsNoAplica = []; // Alumnos cuyo nivel no aplica

for (const student of rawResult.students) {
  // ...
  
  // Verificar nivel efectivo (SKIP si es Master desde alquimia_general)
  const nivelEfectivo = await getStudentEffectiveLevel(student.student_id);
  if (!skipLevelFilter && item.nivel && item.nivel > nivelEfectivo) {
    // No aplica por nivel (solo si NO es Master)
    studentsNoAplica.push({
      ...student,
      nivel_efectivo: nivelEfectivo,
      item_nivel: item.nivel,
      no_aplica: true
    });
    continue;
  }
```

✅ **CORRECTO:** GET students respeta `skip_level_filter: true`

❌ **PROBLEMA:** `markCleanAllStudents` (usado por increment-all) **NO respeta esta regla**

---

### 4.3 ¿Es lógica heredada de recurrentes?

**Análisis:**
- `markCleanAllStudents` se usa tanto para recurrentes como para UNA_VEZ
- La lógica de filtro por nivel es la misma para ambos
- Para recurrentes, el filtro tiene sentido (no limpiar items no aplicables)
- Para UNA_VEZ, el filtro **NO tiene sentido** (Master puede limpiar cualquier item a cualquier alumno)

**Conclusión:** ✅ **SÍ**, es lógica heredada de recurrentes aplicada incorrectamente a UNA_VEZ

---

## FASE 5 — TOASTS Y MENSAJES

### 5.1 "undefined limpiado" — ¿Dónde se genera?

**Ubicación:** `public/js/master/master-alquimia-general-client.js:1389`

**Código:**
```1389:1389:public/js/master/master-alquimia-general-client.js
showToastSuccess(`✓ ${student.nombre || student.email} limpiado`);
```

❌ **PROBLEMA:** `student.nombre` NO existe en el objeto student del flotante

**Objeto student en flotante (después de `calculateStudentDisplayNames`):**
```javascript
{
  student_id: number,
  display_name: string, // ✅ Campo correcto
  student_name: string, // ✅ Alternativa
  student_email: string, // ✅ Alternativa
  email: string, // ✅ Alternativa
  // NO existe student.nombre ❌
}
```

**Código que calcula display_name:**
```558:558:src/services/alquimia-general-service.js
const studentsWithState = await calculateStudentDisplayNames(studentsFiltered);
```

**Fix requerido:**
```javascript
// ❌ Actual:
showToastSuccess(`✓ ${student.nombre || student.email} limpiado`);

// ✅ Correcto:
showToastSuccess(`✓ ${student.display_name || student.student_name || student.email} limpiado`);
```

---

### 5.2 Otros toasts — ¿Están correctos?

**"+1 para todos" (increment-all):**
```2204:2204:public/js/master/master-alquimia-general-client.js
showToastSuccess(`Item incrementado para ${result.data?.updated || result.updated || 0} alumnos`);
```

✅ **CORRECTO:** Muestra número de alumnos actualizados

**"Limpiar para todos" (mark-clean-all):**
```948:961:public/js/master/master-alquimia-general-client.js
let message = `✅ Item limpiado para ${updated} alumnos`;
if (updated === 0 && skipped > 0) {
  const reasons = [];
  if (breakdown.paused > 0) reasons.push(`${breakdown.paused} pausados`);
  if (breakdown.not_applicable_level > 0) reasons.push(`${breakdown.not_applicable_level} no aplican (nivel)`);
  if (breakdown.no_change > 0) reasons.push(`${breakdown.no_change} ya limpios`);
  if (breakdown.error > 0) reasons.push(`${breakdown.error} errores`);
  if (reasons.length > 0) {
    message = `⚠️ 0 actualizados; ${reasons.join(', ')}`;
  } else {
    message = `⚠️ 0 actualizados; ${skipped} omitidos`;
  }
}
```

✅ **CORRECTO:** Muestra breakdown de razones cuando `updated = 0`

---

## FASE 6 — ESTADOS Y EVENTOS

### 6.1 ¿Son deterministas?

**Recurrentes:**
- Estado calculado desde `last_cleaned_at`, `threshold_days`, `critical_multiplier`
- ✅ Determinista (mismo input = mismo estado)

**UNA_VEZ:**
- Estado calculado desde `completed`, `remaining`, `required_count`
- ✅ Determinista (mismo input = mismo estado)

**Eventos:**
- Todos los eventos se registran en `cleaning_events` con `execution_key` para idempotencia
- ✅ Determinista (mismo execution_key = mismo resultado)

---

### 6.2 ¿Hay estados intermedios creados tras error 500?

**Análisis del código:**
- `markCleanStudent` usa transacciones implícitas (no explícitas)
- Si falla en medio, puede dejar estados parciales
- `execution_key` previene duplicados, pero no previene estados parciales

**Riesgo:** ⚠️ **MEDIO** — Posibles estados parciales si falla en medio de transacción

---

## FASE 7 — RESUMEN DE PROBLEMAS

### 7.1 Problemas Críticos

1. **"+1 para todos" filtra por nivel** ❌
   - **Ubicación:** `src/core/master/services/cleaning-engine-service.js:546-553`
   - **Impacto:** Devuelve 0 alumnos si item tiene nivel > nivel_efectivo de alumnos
   - **Violación:** Regla `alquimia-flotante-no-filter-level`
   - **Fix requerido:** Añadir opción `skip_level_filter` a `markCleanAllStudents`

2. **Toast "undefined limpiado"** ❌
   - **Ubicación:** `public/js/master/master-alquimia-general-client.js:1389`
   - **Impacto:** UX confusa (muestra "undefined limpiado")
   - **Fix requerido:** Usar `student.display_name` en lugar de `student.nombre`

3. **NO EXISTE tab UNA_VEZ** ⚠️
   - **Impacto:** No es un problema funcional, solo documentación
   - **Conclusión:** La separación es lógica, no visual

---

### 7.2 Problemas Menores

1. **Payload incompleto en increment-all** ⚠️
   - **Impacto:** Bajo (backend lo fuerza correctamente)
   - **Fix opcional:** Añadir `item_kind: 'una_vez'` explícitamente en frontend (mejora claridad)

2. **Estados parciales posibles** ⚠️
   - **Impacto:** Medio (poco probable pero posible)
   - **Fix opcional:** Usar transacciones explícitas en `markCleanStudent`

---

## FASE 8 — QUÉ HAY QUE IMPLEMENTAR DESPUÉS

### 8.1 Fixes Requeridos (ALTA PRIORIDAD)

1. **Añadir `skip_level_filter` a `markCleanAllStudents`**
   - **Archivo:** `src/core/master/services/cleaning-engine-service.js`
   - **Función:** `markCleanAllStudents(options, client)`
   - **Cambio:** Añadir `options.skip_level_filter` y respetarlo en filtro de nivel
   - **Referencia:** Línea 546-553

2. **Fix toast "undefined limpiado"**
   - **Archivo:** `public/js/master/master-alquimia-general-client.js`
   - **Función:** `handleLimpiarEstudiante` (línea 1389)
   - **Cambio:** Usar `student.display_name || student.student_name || student.email`

3. **Pasar `skip_level_filter: true` desde increment-all**
   - **Archivo:** `src/services/alquimia-general-service.js`
   - **Función:** `incrementAll` (línea 862)
   - **Cambio:** Añadir `skip_level_filter: true` en opciones a `incrementAllStudents`

---

### 8.2 Mejoras Opcionales (BAJA PRIORIDAD)

1. **Añadir `item_kind` explícito en payload increment-all (frontend)**
   - **Archivo:** `public/js/master/master-alquimia-general-client.js`
   - **Función:** `handleIncrementAllItem` (línea 2180)
   - **Cambio:** Añadir `item_kind: 'una_vez'` en payload (aunque backend lo fuerza)

2. **Transacciones explícitas en `markCleanStudent`**
   - **Archivo:** `src/core/master/services/cleaning-engine-service.js`
   - **Función:** `markCleanStudent`
   - **Cambio:** Usar transacciones explícitas para prevenir estados parciales

---

## FASE 9 — CHECKLIST DE VERIFICACIÓN

### 9.1 Después de Implementar Fixes

- [ ] Verificar que "+1 para todos" NO filtra por nivel
- [ ] Verificar que toast muestra nombre correcto (no "undefined")
- [ ] Verificar que `markCleanAllStudents` acepta `skip_level_filter`
- [ ] Verificar que `incrementAll` pasa `skip_level_filter: true`
- [ ] Probar con item nivel 5 y alumnos nivel 1-10 (debe procesar todos)
- [ ] Verificar logs: NO debe haber `skipped_breakdown.not_applicable_level > 0` en increment-all UNA_VEZ

---

## CONCLUSIÓN FINAL

**Estado Actual:**
- ✅ Payloads frontend correctos (después de fixes previos)
- ✅ Backend valida campos requeridos
- ❌ **"+1 para todos" filtra por nivel** (viola regla constitucional)
- ❌ **Toast "undefined limpiado"** (campo incorrecto)
- ⚠️ **NO EXISTE tab UNA_VEZ** (no es problema, solo documentación)

**Causa Raíz:**
- Lógica de filtro por nivel heredada de recurrentes aplicada incorrectamente a UNA_VEZ
- Campo `student.nombre` inexistente usado en toast

**Prioridad de Fixes:**
1. **ALTA:** Fix filtro por nivel en `markCleanAllStudents`
2. **ALTA:** Fix toast "undefined limpiado"
3. **MEDIA:** Añadir `skip_level_filter` a opciones de `incrementAllStudents`

---

**FIN DEL DIAGNÓSTICO**
