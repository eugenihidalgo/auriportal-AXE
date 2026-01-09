# DIAGNÓSTICO ALQUIMIA UNA_VEZ v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-08  
**Objetivo:** Diagnóstico quirúrgico y 100% factual sobre por qué las listas `tipo='una_vez'` no aparecen como limpiables en Alquimia del Alumno

---

## RESUMEN EJECUTIVO

**HALLAZGO RAÍZ #1:** El seed de estados inicializa `shared_remaining = 0` para TODOS los items (recurrentes y una_vez), sin considerar `veces_limpiar` del catálogo. Esto hace que los items `una_vez` recién seedeados caigan en estado `'reviewed'` (no limpiables) en lugar de `'never'` o `'pending'`.

**HALLAZGO RAÍZ #2:** Existe inconsistencia en los datos del catálogo: items de listas `una_vez` tienen `veces_limpiar = null` pero `frecuencia_dias = 20`, sugiriendo que el modelo de datos no está completamente normalizado.

**HALLAZGO RAÍZ #3:** El cálculo de estado para `una_vez` usa `remaining <= 0` para determinar `'reviewed'`, lo que hace que items seedeados con `remaining = 0` sean considerados completados sin haber sido trabajados.

---

## A) REALIDAD DEL CATÁLOGO

### Datos reales (student_id=4, fecha: 2026-01-08)

**Listas `una_vez` activas:** 4
- id=3: "Registros y Karmas"
- id=4: "Karmas"
- id=9: "Limpiezas del hogar puntuales"
- id=14: "Pobreses" (21 items)

**Items `una_vez` activos:** 24 totales
- Distribución por lista:
  - Lista 3: NO CONSTA (no aparece en query de detalle)
  - Lista 4: 1 item (nivel 9, con `veces_limpiar = 1`)
  - Lista 9: 2 items (nivel 9, con `veces_limpiar = 2`)
  - Lista 14: 21 items (nivel 1, `veces_limpiar = null`, `frecuencia_dias = 20`)

### Campos relevantes

**Inconsistencia detectada:**
- Items de lista "Pobreses" (id=14) tienen:
  - `veces_limpiar: null`
  - `frecuencia_dias: 20`
  
  Esto sugiere que estos items deberían ser recurrentes, pero están en una lista `una_vez`.

**Evidencia:** Query 3.2b muestra que lista 14 tiene 21 items, todos con `frecuencia_dias` pero sin `veces_limpiar`.

---

## B) REALIDAD DEL ESTADO

### Estados materializados para student_id=4

**Total estados `una_vez`:** 24 (coincide con catálogo activo)

**Ejemplos reales (lista "Pobreses"):**
```json
{
  "item_ref": "te_item_114",
  "shared_last_cleaned_at": null,
  "shared_clean_count": 0,
  "shared_completed": 1,
  "shared_remaining": 0
}
```

**Todos los demás items `una_vez` tienen:**
- `shared_completed: 0`
- `shared_remaining: 0`
- `shared_last_cleaned_at: null`

### Análisis del seed

**Ubicación:** `src/core/master/services/cleaning-state-seed-service.js` (líneas 97)

**Código actual:**
```javascript
shared_remaining = 0  // LÍNEA 97: Hardcodeado a 0 para TODOS los items
```

**Problema:** El seed NO considera:
- Si el item es `una_vez` o `recurrente`
- El valor de `veces_limpiar` del catálogo
- Inicializa `remaining = 0` universalmente

**Impacto:** Items `una_vez` seedeados quedan con `remaining = 0`, lo que hace que `calculateItemState()` retorne `'reviewed'` (no limpiable).

---

## C) REALIDAD DE EVENTOS

### Eventos `una_vez` para student_id=4

**Total eventos `una_vez`:** 1 único evento
- `item_ref: "te_item_114"`
- `total_events: 1`
- `first_event: "2026-01-08T18:25:48.590Z"`
- `last_event: "2026-01-08T18:25:48.590Z"`

**Eventos múltiples por día:** NO (array vacío)

### Idempotencia

**Execution key:** Formato `mark_clean:{item_ref}:{student_id}:{YYYY-MM-DD}`

**Evidencia:** `src/core/master/services/cleaning-engine-service.js` (líneas 33-36)

**Conclusión:** La idempotencia funciona por día. Si se intenta limpiar el mismo item dos veces en el mismo día, el segundo intento retorna estado actual sin error.

---

## D) REALIDAD DE API

### Endpoint `/master/api/alquimia-alumno/megalist`

**Evidencia necesaria:** Ejecutar curl (pendiente de ejecución por limitaciones de red)

**Código relevante:** `src/core/master/services/alquimia-alumno-megalist-service.js`

**Función `calculateItemState()` (líneas 28-81):**

```javascript
function calculateItemState(state, item, tipo) {
  const listaTipo = (tipo === 'recurrente' || tipo === 'una_vez') ? tipo : 'recurrente';
  
  if (listaTipo === 'recurrente') {
    // ... lógica para recurrentes
  } else {
    // una_vez
    const remaining = state?.shared_remaining ?? null;
    const completed = state?.shared_completed ?? 0;
    
    if (remaining === null && completed === 0) {
      return 'never';
    }
    
    if (remaining !== null && remaining <= 0) {  // ← AQUÍ ESTÁ EL PROBLEMA
      return 'reviewed';
    }
    
    return 'pending';
  }
}
```

**Problema identificado:**
1. Si `remaining = 0` (seed lo inicializa así), la condición `remaining <= 0` se cumple.
2. Retorna `'reviewed'`.
3. UI no muestra botón "Limpiar" porque `item.state !== 'reviewed'` es `false`.

---

## E) REALIDAD DE UI

### Código de renderizado

**Ubicación:** `public/js/master/master-alquimia-alumno-client.js` (líneas 687-697)

**Código actual:**
```javascript
// Botón limpiar (solo si NO está revisado)
if (item.state !== 'reviewed') {
  const cleanBtn = document.createElement('button');
  cleanBtn.textContent = 'Marcar como revisado';
  // ... renderiza botón
}
```

**Conclusión:** Si `item.state === 'reviewed'`, NO se renderiza el botón. Como el seed inicializa `remaining = 0` → estado `'reviewed'` → NO aparece botón.

### Agrupación por estado

**Función `renderMegalist()` (líneas 583-601):**

La UI agrupa items por:
- `never`
- `important`
- `pending`
- `reviewed_by_student` / `reviewed_by_master`

**Items `una_vez` con `remaining = 0` aparecen en `reviewed_by_*`, no en `never` o `pending`.**

---

## F) GAPS VS MODELO DESEADO

### Gap CRÍTICO #1: Seed no inicializa `remaining` correctamente

**Severidad:** CRÍTICO (impide uso)

**Descripción:** El seed debe inicializar `shared_remaining` con `veces_limpiar` del catálogo para items `una_vez`. Si `veces_limpiar` es `null`, debe usar un valor por defecto (ej: 1 o basado en `frecuencia_dias` si existe).

**Ubicación:** `src/core/master/services/cleaning-state-seed-service.js` (línea 97)

**Impacto:** Items `una_vez` no aparecen como limpiables porque quedan en estado `'reviewed'`.

### Gap ALTO #2: Inconsistencia datos catálogo

**Severidad:** ALTO (rompe semántica)

**Descripción:** Items en listas `una_vez` tienen `frecuencia_dias` pero no `veces_limpiar`. Esto sugiere:
- Migración incompleta
- Error en creación de items
- Modelo de datos ambiguo

**Evidencia:** Lista "Pobreses" (id=14) tiene 21 items con `frecuencia_dias = 20` pero `veces_limpiar = null`.

**Impacto:** El sistema no puede determinar correctamente si un item es "una vez" o "recurrente" basándose solo en el catálogo.

### Gap MEDIO #3: Lógica de cálculo de estado no distingue seed inicial

**Severidad:** MEDIO (UX)

**Descripción:** `calculateItemState()` no distingue entre:
- `remaining = 0` porque está completado (trabajado `veces_limpiar` veces)
- `remaining = 0` porque fue seedeado así (nunca trabajado)

**Impacto:** Items nunca trabajados aparecen como completados en la UI.

### Gap BAJO #4: No hay noción explícita de "trabajado hoy"

**Severidad:** BAJO (cosmético)

**Descripción:** El modelo deseado menciona "pasado trabajado hoy, al día siguiente vuelve a estar disponible", pero el sistema actual:
- No valida "una vez por día"
- No resetea `remaining` automáticamente
- La idempotencia es por día (via `execution_key`), pero no hay reset diario

**Impacto:** UX podría ser más clara si mostrara "trabajado hoy" vs "disponible mañana".

---

## G) RIESGOS SI SE IMPLEMENTA SIN ESTATUTO

### Riesgo #1: Doble limpieza en un día

**Descripción:** La idempotencia vía `execution_key` previene esto, pero si se cambia la lógica sin considerar la idempotencia, podría permitirse múltiples limpiezas.

**Mitigación:** Mantener `execution_key` con formato diario.

### Riesgo #2: Estados inconsistentes

**Descripción:** Si se cambia el seed para inicializar `remaining` correctamente, pero ya hay estados existentes con `remaining = 0`, podría haber inconsistencias.

**Mitigación:** Crear migración que actualice estados existentes:
- Si `completed = 0` y `remaining = 0` → establecer `remaining = veces_limpiar` (o 1 si null)
- Si `completed > 0` → mantener `remaining` actual

### Riesgo #3: Overrides que no se guardan

**Descripción:** El modelo deseado menciona "override por alumno editable", pero NO CONSTA si existe esta funcionalidad actualmente.

**Mitigación:** Verificar si existe tabla/metadata para overrides antes de implementar nueva funcionalidad.

---

## H) ENSAMBLAJE COMPLETO (Catálogo → Estado → Render)

### Flujo actual (ROTO)

1. **Catálogo:** Items `una_vez` con `veces_limpiar` (algunos null)
2. **Seed:** Inicializa `shared_remaining = 0` (universal, incorrecto)
3. **Estado:** `remaining = 0`, `completed = 0`
4. **Cálculo:** `calculateItemState()` retorna `'reviewed'` (porque `remaining <= 0`)
5. **UI:** No renderiza botón "Limpiar" (porque `state === 'reviewed'`)
6. **Resultado:** Items `una_vez` NO aparecen como limpiables

### Flujo deseado (PROPUESTO)

1. **Catálogo:** Items `una_vez` con `veces_limpiar` (o valor por defecto)
2. **Seed:** Inicializa `shared_remaining = veces_limpiar || 1` (para `una_vez`)
3. **Estado:** `remaining = veces_limpiar`, `completed = 0`
4. **Cálculo:** `calculateItemState()` retorna `'pending'` o `'never'` (según `remaining > 0`)
5. **UI:** Renderiza botón "Limpiar" (porque `state !== 'reviewed'`)
6. **Resultado:** Items `una_vez` aparecen como limpiables

---

## I) CLASIFICACIONES Y TAGS

### Listas `una_vez` con clasificaciones

**Evidencia (Query 6.1):** Lista "Pobreses" (id=14) tiene clasificación:
- `type: "key"`
- `value: "Una vez"`

**Conclusión:** Las clasificaciones existen y son correctas. NO es el problema.

---

## J) CLEANING ENGINE — SEMÁNTICA REAL

### Dónde se calcula estado

**Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js` (función `calculateItemState`, líneas 28-81)

**Para `una_vez`:**
- `remaining === null && completed === 0` → `'never'`
- `remaining <= 0` → `'reviewed'`
- Si no → `'pending'`

### Qué significa `shared_remaining` para `una_vez`

**Evidencia:** `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` (función `upsertApplyOneTimeIncrementShared`, líneas 115-157)

**Lógica actual:**
- Al limpiar: `completed++`, `remaining--` (clamp a 0)
- Al seedear: `remaining = 0` (INCORRECTO)

**Semántica esperada:**
- `remaining` = días/veces que faltan por trabajar
- `completed` = días/veces ya trabajados
- `remaining` debería inicializarse con `veces_limpiar` del catálogo

### Si existe "one per day"

**Búsqueda global:** NO se encontró código que valide "una vez por día" explícitamente.

**Evidencia:** La idempotencia vía `execution_key` previene múltiples limpiezas en el mismo día, pero NO hay reset automático de `remaining` al día siguiente.

---

## K) NIVEL EFECTIVO Y FILTROS

### Nivel efectivo student_id=4

**Calculado:** `nivel_efectivo = 1`

### Items `una_vez` no aplicables por nivel

**Evidencia (Query 3.5b):** Lista "Pobreses" tiene nivel 1, por lo que todos los items aplican para student_id=4.

**Listas con nivel > 1:**
- Lista "Karmas" (id=4): nivel 9 → NO aplica para student_id=4
- Lista "Limpiezas del hogar puntuales" (id=9): nivel 9 → NO aplica para student_id=4

**Conclusión:** El filtro por nivel funciona correctamente. Los items no aplicables NO se seedean, por lo que NO aparecen en la megalist.

---

## L) CONCLUSIÓN FINAL

**Problema raíz:** El seed inicializa `shared_remaining = 0` para todos los items, haciendo que los items `una_vez` recién seedeados caigan en estado `'reviewed'` (no limpiable).

**Soluciones propuestas:**
1. Modificar seed para inicializar `remaining = veces_limpiar || 1` para items `una_vez`
2. Crear migración para actualizar estados existentes incorrectos
3. Normalizar datos del catálogo (eliminar `frecuencia_dias` de items `una_vez` o establecer `veces_limpiar`)

**Riesgos:** Bajo (la solución es quirúrgica y no afecta datos existentes que ya fueron trabajados).

---

**FIN DEL DIAGNÓSTICO**
