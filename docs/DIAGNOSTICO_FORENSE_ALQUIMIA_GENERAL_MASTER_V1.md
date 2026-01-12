# 🔍 DIAGNÓSTICO FORENSE FINAL — ALQUIMIA GENERAL MASTER
**AuriPortal / Aurelín — DOMINIO MASTER**  
**Fecha:** 2026-01-13  
**Modo:** SOLO LECTURA — PROHIBIDO IMPLEMENTAR, MODIFICAR O "ARREGLAR"  
**Estado:** DIAGNÓSTICO COMPLETO

---

## A) RESUMEN EJECUTIVO

El sistema de Alquimia General en dominio MASTER está **PARCIALMENTE IMPLEMENTADO** con **MEZCLAS INDEBIDAS** entre ejes ortogonales:

1. **RECURRENTE vs UNA_VEZ**: Distinción funcional correcta en Cleaning Engine, pero UI calcula estados visuales duplicando lógica del backend.
2. **SHARED vs PDE**: Separación simétrica implementada en repositorios y DTOs, pero COMBO (proyección) se calcula en UI en lugar de venir del backend.
3. **COMBO (proyección)**: NO existe como estado persistido (correcto), pero se calcula en múltiples lugares del frontend con lógica duplicada.
4. **Filtros por nivel**: Correctamente omitidos en Alquimia General (`skip_level_filter: true`), pero hay verificaciones redundantes en servicio.
5. **UUID-only**: Implementación correcta en Cleaning Engine y repositorios, pero hay resolución de `legacy_alumno_id` para display_name que debería estar encapsulada.

**Estado general:** Sistema funcional pero con **lógica duplicada FE/BE** y **cálculos de COMBO en UI** que deberían ser proyecciones del backend.

---

## B) ENGINE

### B.1 Funciones Existentes

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Funciones principales:**
- `markCleanStudent(options, client)` - Línea 134
- `markCleanAllStudents(options, client)` - Línea 572
- `incrementAllStudents(options, client)` - Línea 826
- `setRemainingShared(options, client)` - Línea 895
- `getStudentEffectiveLevel(studentUuid, lineKey)` - Línea 87
- `isStudentPaused(studentUuid)` - Línea 51
- `generateExecutionKey(actionType, itemRef, studentUuid, timestamp, executionMode)` - Línea 34

### B.2 Distinción RECURRENTE vs UNA_VEZ

**✅ CUMPLE:**
- `item_kind` es OBLIGATORIO en todas las funciones (líneas 139, 191-193, 602, 611-613)
- Validación explícita: `item_kind !== 'recurrente' && item_kind !== 'una_vez'` → error
- `markCleanStudent` usa métodos diferentes según `itemKind`:
  - RECURRENTE: `upsertApplyRecurrent()` (línea 430)
  - UNA_VEZ: `upsertApplyOneTimeIncrementShared()` o `upsertApplyOneTimeIncrementPde()` (líneas 449, 465)

**❌ ROMPE:**
- Línea 245: Referencia a `student_id` (variable no definida) en log de Master Override. Debería ser `student_uuid`.
- Línea 314: Lógica especial para MASTER UNA_VEZ que convierte `APPLY` → `CERTIFY` automáticamente. Esto mezcla concerns: execution_mode debería venir explícito del frontend, no inferirse.

### B.3 Distinción SHARED vs PDE

**✅ CUMPLE:**
- `clean_layer` es OBLIGATORIO (línea 180: validación de campos requeridos)
- Separación simétrica en proyección:
  - RECURRENTE: `shared_last_cleaned_at` / `pde_last_cleaned_at` (línea 430-437)
  - UNA_VEZ: `shared_clean_count` / `pde_clean_count` (líneas 449, 465)
- No hay mezcla: cada capa se actualiza independientemente

**❌ ROMPE:**
- NO existe función para calcular COMBO (proyección de SHARED + PDE). Esto es correcto según diseño (COMBO no se persiste), pero el backend NO ofrece endpoint que devuelva COMBO calculado, forzando al frontend a calcularlo.

### B.4 COMBO (Proyección)

**✅ CUMPLE:**
- COMBO NO se persiste (correcto según diseño canónico)
- COMBO NO se guarda en `cleaning_item_state` (correcto)

**❌ ROMPE:**
- NO existe endpoint que devuelva COMBO calculado. El frontend debe sumar `shared_clean_count + pde_clean_count` manualmente.
- Esto viola el principio "UI solo muestra, no decide": el cálculo de COMBO debería ser proyección del backend, no del frontend.

### B.5 Responsabilidades Reales

**Cleaning Engine:**
- ✅ Valida inputs (item_ref, item_kind, clean_layer, student_uuid)
- ✅ Excluye alumnos pausados
- ✅ Genera execution_key (idempotente o no según execution_mode)
- ✅ Inserta eventos en `cleaning_events`
- ✅ Actualiza proyección `cleaning_item_state` (SHARED o PDE según clean_layer)
- ✅ Emite señales `clean.executed`
- ❌ NO calcula COMBO (debería ofrecerlo como proyección)

---

## C) REPOS / DB

### C.1 Tablas Usadas

**Tablas principales:**
1. `cleaning_events` - Event log append-only (UUID-only, usa `student_uuid` en metadatos, `student_id` legacy para FK)
2. `cleaning_item_state` - Proyección materializada (UUID-only, usa `student_id` legacy para FK)
3. `students` - Source of Truth UUID (UUID canónico)
4. `alumnos` - Tabla legacy (solo para display_name, no decisor)

**Tablas NO usadas en runtime:**
- `student_item_state` - Tabla histórica (no se escribe ni se lee en MASTER)

### C.2 Columnas Relevantes

**`cleaning_item_state`:**
- `student_id` (FK a `alumnos.id` - legacy, resuelto internamente desde `student_uuid`)
- `product_key` (default: 'pde')
- `domain_type` (default: 'transmutation')
- `item_ref` (string, referencia canónica)
- **SHARED:**
  - `shared_last_cleaned_at` (timestamp | null)
  - `shared_clean_count` (integer, default: 0)
  - `shared_remaining` (integer | null, para UNA_VEZ)
  - `shared_completed` (integer, 0 o 1, para UNA_VEZ)
- **PDE (simétrico):**
  - `pde_last_cleaned_at` (timestamp | null)
  - `pde_clean_count` (integer, default: 0)
  - `pde_remaining` (integer | null, para UNA_VEZ)
  - `pde_completed` (integer, 0 o 1, para UNA_VEZ)

**❌ PROBLEMÁTICO:**
- NO existe columna `combo_clean_count` ni `combo_remaining` (correcto según diseño, pero fuerza cálculo en UI)
- `student_id` es INTEGER legacy, pero repositorios resuelven desde `student_uuid` internamente (correcto, pero hay riesgo de confusión)

### C.3 Representación de Estado COMBO

**Estado actual:**
- COMBO NO se persiste (correcto)
- COMBO se calcula en UI como `shared_clean_count + pde_clean_count` (línea 1202 de `master-alquimia-general-client.js`)
- Esto viola principio "UI solo muestra": el cálculo debería ser proyección del backend

### C.4 Riesgos de Mezcla students.id vs alumnos.id

**✅ CUMPLE:**
- Cleaning Engine acepta SOLO `student_uuid` (UUID canónico)
- Repositorios resuelven `legacy_alumno_id` internamente SOLO para escribir en tablas legacy
- Guards constitucionales lanzan error si se intenta usar `legacy_alumno_id` en runtime (líneas 166-176)

**❌ ROMPE:**
- Repositorio `master-student-transmutation-read-repo-pg.js` hace JOIN con `alumnos` para obtener `display_name` (líneas 218-235). Esto es correcto para display, pero debería estar más encapsulado.

---

## D) ENDPOINTS

### D.1 Endpoint Principal del Flotante

**Ruta:** `GET /master/api/alquimia-general/items/:item_ref/students`  
**Handler:** `src/endpoints/master-api-alquimia-general.js` (línea 766)  
**Servicio:** `src/services/alquimia-general-service.js::getStudentsForItem()` (línea 462)

### D.2 Qué Devuelve Realmente

**DTO simétrico:**
```javascript
{
  ok: true,
  data: {
    item_ref: "...",
    tipo: "recurrente" | "una_vez",
    students: [
      {
        student_uuid: "...",
        display_name: "...",
        // SHARED layer (simétrico)
        shared: {
          clean_count: 0,
          last_cleaned_at: null,
          days_since_last_clean: null,
          remaining: null, // para UNA_VEZ
          completed: 0 // para UNA_VEZ
        },
        // PDE layer (simétrico)
        pde: {
          clean_count: 0,
          last_cleaned_at: null,
          days_since_last_clean: null,
          remaining: null, // para UNA_VEZ
          completed: 0 // para UNA_VEZ
        },
        // Compatibilidad legacy (según clean_layer del request)
        clean_count: 0,
        last_cleaned_at: null,
        days_since_last_clean: null,
        remaining: null,
        completed: 0
      }
    ],
    counts: { ... },
    total: 0,
    threshold_days: 7, // para RECURRENTE
    critical_multiplier: 2.0, // para RECURRENTE
    required_count: 1 // para UNA_VEZ
  }
}
```

**✅ CUMPLE:**
- DTO simétrico con `shared` y `pde` siempre presentes
- `skip_level_filter: true` se pasa correctamente (línea 842)
- `clean_layer` es OBLIGATORIO (validación en servicio, línea 473)

**❌ ROMPE:**
- NO devuelve COMBO calculado. El frontend debe calcular `total = shared.clean_count + pde.clean_count` manualmente (línea 1202 del cliente).

### D.3 Filtros Ilegales

**✅ CUMPLE:**
- NO filtra por nivel en Alquimia General (`skip_level_filter: true` en línea 842)
- Excluye alumnos pausados correctamente (repositorio, línea 191)

**❌ ROMPE:**
- Verificación redundante de pausa en servicio (líneas 533-546 de `alquimia-general-service.js`). El repositorio ya filtra pausados, pero el servicio vuelve a verificar (innecesario pero no ilegal).

### D.4 Lógica Pedagógica o Interpretativa

**✅ CUMPLE:**
- Estados visuales se calculan dinámicamente en servicio (líneas 569-732 de `alquimia-general-service.js`)
- NO hay lógica pedagógica hardcodeada

**❌ ROMPE:**
- Cálculo de estados visuales para UNA_VEZ en servicio (líneas 650-710) duplica lógica que también existe en UI. Debería ser único lugar (backend o frontend, no ambos).

---

## E) UI

### E.1 Renderizado de Columnas

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**RECURRENTE (líneas 1236-1253):**
- ✅ 4 columnas: REVISADO, PENDIENTE, IMPORTANTE, NUNCA
- ✅ Estados se calculan desde `shared` o `pde` según `layerView` (línea 1217)
- ❌ Cálculo de estado duplica lógica del backend (función `calculateStudentState`, línea 1615)

**UNA_VEZ (líneas 1254-1273):**
- ✅ 4 columnas: NUNCA, PENDIENTE, COMPLETADO, MUY BIEN TRABAJADO
- ❌ Estados se calculan usando TOTAL (`shared_clean_count + pde_clean_count`) en UI (línea 1202)
- ❌ Cálculo de TOTAL debería venir del backend como proyección COMBO

### E.2 Cálculo de Estados en Frontend

**❌ PROBLEMÁTICO:**
- Línea 1198-1214: UI calcula estados para UNA_VEZ usando TOTAL (`shared_clean_count + pde_clean_count`)
- Línea 1442-1456: UI calcula COMBO para display en filas de estudiantes
- Línea 1473-1494: UI calcula remaining de COMBO manualmente
- Esto viola principio "UI solo muestra, no decide": el backend debería ofrecer COMBO como proyección

### E.3 Columna "Dorada" en Recurrentes

**Estado:** NO existe columna "dorada" para recurrentes (correcto según diseño). Solo existe para UNA_VEZ como "MUY BIEN TRABAJADO" (línea 1271).

### E.4 Botones SHARED / PDE / COMBO

**Ubicación:** `createStudentRow()` (línea 1411)

**SHARED o PDE (líneas 1593-1604):**
- ✅ Un solo botón según `layerView` ('shared' o 'pde')
- ✅ Botón "+1" para UNA_VEZ, "✓" para RECURRENTE

**COMBO (líneas 1501-1592):**
- ✅ 3 botones: [S +1] [P +1] [S+P] para UNA_VEZ
- ✅ 3 botones: [S ✓] [P ✓] [S+P] para RECURRENTE
- ✅ Botón S+P ejecuta ambas limpiezas secuencialmente (líneas 1523-1545, 1568-1590)
- ❌ Después de S+P, UI recarga flotante pero NO recalcula COMBO desde backend (línea 1542: usa `handleVerItem` que no devuelve COMBO)

### E.5 Errores de Import / SyntaxError

**✅ CUMPLE:**
- No se detectan errores de import en inspección estática
- No hay `SyntaxError: Unexpected identifier` visible

**❌ ROMPE:**
- Línea 245 de `cleaning-engine-service.js`: Referencia a `student_id` no definida (debería ser `student_uuid`). Esto causaría `ReferenceError` en runtime si se ejecuta el log de Master Override.

### E.6 Roturas de Listas Completas

**Estado:** No se detectan roturas evidentes. El endpoint tiene fail-open absoluto (líneas 898-919) que siempre devuelve shape estable incluso con errores.

---

## F) LISTA DE DESVIACIONES DEL DISEÑO CANÓNICO

### F.1 Mezclas Indebidas Detectadas

1. **COMBO calculado en UI en lugar de proyección del backend**
   - **Ubicación:** `master-alquimia-general-client.js` líneas 1202, 1444-1456, 1477-1484
   - **Problema:** UI suma `shared_clean_count + pde_clean_count` manualmente. Debería venir del backend como proyección.
   - **Impacto:** Violación del principio "UI solo muestra, no decide". Si la lógica de COMBO cambia, hay que actualizar múltiples lugares.

2. **Cálculo de estados visuales duplicado FE/BE**
   - **Ubicación:** 
     - Backend: `alquimia-general-service.js` líneas 650-710 (UNA_VEZ)
     - Frontend: `master-alquimia-general-client.js` líneas 1198-1214, 1615-1640
   - **Problema:** Misma lógica de cálculo de estados existe en ambos lados.
   - **Impacto:** Si cambia la lógica, hay que actualizar backend Y frontend. Riesgo de desincronización.

3. **Execution mode inferido en lugar de explícito**
   - **Ubicación:** `cleaning-engine-service.js` líneas 313-329
   - **Problema:** Cleaning Engine convierte automáticamente `APPLY` → `CERTIFY` para MASTER UNA_VEZ. Esto mezcla concerns: execution_mode debería venir explícito del frontend.
   - **Impacto:** Comportamiento no obvio. Si el frontend envía `APPLY`, el backend lo cambia a `CERTIFY` sin avisar explícitamente.

4. **Verificación redundante de pausa en servicio**
   - **Ubicación:** `alquimia-general-service.js` líneas 533-546
   - **Problema:** El repositorio ya filtra pausados (línea 191 de `master-student-transmutation-read-repo-pg.js`), pero el servicio vuelve a verificar.
   - **Impacto:** Ineficiencia menor, pero no es ilegal. Solo redundante.

5. **Referencia a variable no definida en log**
   - **Ubicación:** `cleaning-engine-service.js` línea 245
   - **Problema:** Log usa `student_id` que no está definido en ese scope (debería ser `student_uuid`).
   - **Impacto:** `ReferenceError` en runtime si se ejecuta ese log (Master Override en alquimia_alumno).

6. **JOIN con `alumnos` para display_name en repositorio**
   - **Ubicación:** `master-student-transmutation-read-repo-pg.js` líneas 218-235
   - **Problema:** Repositorio hace JOIN con tabla legacy `alumnos` para obtener `display_name`. Esto es correcto para display, pero debería estar más encapsulado (helper dedicado).
   - **Impacto:** Acoplamiento con tabla legacy. Si `alumnos` cambia, el repositorio se rompe.

### F.2 Estados Incoherentes Potenciales

1. **COMBO desincronizado si backend cambia lógica**
   - Si el backend cambia cómo se calcula COMBO (ej. fórmula diferente), el frontend seguirá calculando con la lógica antigua hasta que se actualice manualmente.

2. **Estados visuales desincronizados FE/BE**
   - Si backend cambia umbrales de estados (ej. `threshold_days`), el frontend puede seguir usando valores hardcodeados (línea 1652: `days < 7` hardcodeado).

### F.3 Bloqueos Indebidos

**Estado:** No se detectan bloqueos indebidos. El sistema permite limpiar incluso si `remaining = 0` (correcto según diseño UNA_VEZ v1).

### F.4 Filtros Ilegales

**Estado:** No se detectan filtros ilegales. `skip_level_filter: true` se pasa correctamente en Alquimia General.

---

## G) CONCLUSIÓN DEL DIAGNÓSTICO

### G.1 Estado Real del Sistema

El sistema de Alquimia General está **FUNCIONAL** pero con **LÓGICA DUPLICADA** entre frontend y backend, especialmente en:

1. **Cálculo de COMBO:** Se hace en UI, debería ser proyección del backend.
2. **Estados visuales:** Se calculan en ambos lados, debería ser único lugar (preferiblemente backend).
3. **Execution mode:** Se infiere en backend, debería ser explícito desde frontend.

### G.2 Piezas que Provocan Inestabilidad

1. **Cálculo de COMBO en UI:** Si cambia la lógica, hay que actualizar frontend manualmente.
2. **Estados visuales duplicados:** Riesgo de desincronización si backend cambia umbrales.
3. **Variable no definida en log:** Puede causar `ReferenceError` en runtime (línea 245 de `cleaning-engine-service.js`).

### G.3 Coherencia con Diseño Canónico

**✅ CUMPLE:**
- Separación SHARED/PDE simétrica
- Distinción RECURRENTE/UNA_VEZ correcta
- UUID-only implementado
- Filtros por nivel omitidos en Alquimia General
- COMBO NO se persiste (correcto)

**❌ ROMPE:**
- COMBO debería ser proyección del backend, no cálculo en UI
- Estados visuales no deberían duplicarse FE/BE
- Execution mode no debería inferirse

---

**FIN DEL DIAGNÓSTICO FORENSE**
