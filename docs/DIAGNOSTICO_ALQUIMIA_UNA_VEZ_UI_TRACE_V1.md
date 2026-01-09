# DIAGNÓSTICO ALQUIMIA UNA_VEZ — UI TRACE v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-08  
**Rastreo de endpoints, llamadas API y comportamiento UI**

---

## 4) TRAZA DE API

### 4.1 Megalist (endpoint esperado)

**Endpoint:** `GET /master/api/alquimia-alumno/megalist?student_id=4`

**Handler:** `src/endpoints/master-api-alquimia-alumno.js` (líneas ~150-200)

**Servicio:** `src/core/master/services/alquimia-alumno-megalist-service.js` → `getMegalistForStudent()`

**Flujo:**
1. Verifica auth (requireAdminContext)
2. Extrae `student_id` de query params
3. Opcionalmente ejecuta seed: `ensureCleaningItemStateSeedForStudent()`
4. Llama `getMegalistForStudent()` que:
   - Consulta `cleaning_item_state` para student_id
   - Resuelve catálogo (items + listas) en batch
   - Calcula estado para cada item usando `calculateItemState()`
   - Agrupa por lista y estado

**Estado calculado para `una_vez`:**
- Si `remaining === null && completed === 0` → `'never'`
- Si `remaining <= 0` → `'reviewed'` ← **PROBLEMA: seed inicializa `remaining = 0`**
- Si no → `'pending'`

**Respuesta esperada:**
```json
{
  "ok": true,
  "data": {
    "student": {...},
    "summary": {...},
    "lists": [
      {
        "lista_id": 14,
        "lista_nombre": "Pobreses",
        "lista_tipo": "una_vez",
        "never": [],
        "important": [],
        "pending": [],
        "reviewed_by_student": [/* items con remaining=0 */],
        "reviewed_by_master": []
      }
    ],
    "warnings": []
  }
}
```

**Observación:** Items `una_vez` con `remaining = 0` aparecen en `reviewed_by_*`, NO en `never` o `pending`.

---

### 4.2 Clean (endpoint esperado)

**Endpoint:** `POST /master/api/alquimia-alumno/clean`

**Body esperado:**
```json
{
  "student_id": 4,
  "item_ref": "te_item_114",
  "product_key": "pde",
  "domain_type": "transmutation",
  "surface_key": "master.alquimia_alumno",
  "level_cap": null
}
```

**Handler:** `src/endpoints/master-api-alquimia-alumno.js` (líneas ~200-300)

**Servicio:** `src/core/master/services/cleaning-engine-service.js` → `markCleanStudent()`

**Flujo:**
1. Valida inputs
2. Verifica si alumno está en pausa (excluye si está pausado)
3. Obtiene item del catálogo
4. Verifica nivel (item.nivel <= nivel_efectivo)
5. Obtiene lista para determinar `item_kind` (`una_vez` vs `recurrente`)
6. Genera `execution_key`: `mark_clean:{item_ref}:{student_id}:{YYYY-MM-DD}`
7. Inserta evento (idempotente)
8. Si `item_kind === 'una_vez'`:
   - Llama `upsertApplyOneTimeIncrementShared()` con `required_count = item.veces_limpiar || 1`
   - Incrementa `completed`, decrementa `remaining`

**Respuesta esperada:**
```json
{
  "ok": true,
  "data": {
    "updated_state": {
      "item_ref": "te_item_114",
      "shared_completed": 2,
      "shared_remaining": -1  // clamp a 0
    }
  }
}
```

**Código relevante:** `src/core/master/services/cleaning-engine-service.js` (líneas 332-342)

```javascript
if (itemKind === 'recurrente') {
  // ... lógica recurrente
} else {
  // Una vez: incrementar completed y decrementar remaining
  const requiredCount = item.veces_limpiar || 1;
  state = await stateRepo.upsertApplyOneTimeIncrementShared({
    student_id,
    product_key,
    domain_type,
    item_ref,
    required_count: requiredCount
  }, client);
}
```

---

### 4.3 History y Report (endpoints esperados)

**Endpoints:**
- `GET /master/api/alquimia-alumno/item-history?student_id=4&item_ref=te_item_114`
- `GET /master/api/alquimia-alumno/report?student_id=4&days=90`

**Handlers:** `src/endpoints/master-api-alquimia-alumno.js`

**Servicios:**
- `buildHumanPanelForItemHistory()` → `src/core/master/services/alquimia-history-resolver-service.js`
- `buildAlquimiaReport()` → `src/core/master/services/alquimia-report-service.js`

**Respuestas esperadas:**
- `item-history`: Dos paneles (técnico + humano)
- `report`: Dos paneles (técnico + humano)

**Observación:** Estos endpoints deberían funcionar correctamente para items `una_vez` si el item tiene eventos en `cleaning_events`.

---

## 5) TRAZA DE UI (NAVEGADOR + CÓDIGO)

### 5.1 Decisión de render "limpiable"

**Ubicación:** `public/js/master/master-alquimia-alumno-client.js` (líneas 687-697)

**Código:**
```javascript
// Botón limpiar (solo si NO está revisado)
if (item.state !== 'reviewed') {
  const cleanBtn = document.createElement('button');
  cleanBtn.textContent = 'Marcar como revisado';
  cleanBtn.addEventListener('click', () => {
    if (confirm(`¿Marcar "${item.item_nombre}" como revisado?`)) {
      handleCleanItem(item);
    }
  });
  rightDiv.appendChild(cleanBtn);
}
```

**Condición crítica:** `item.state !== 'reviewed'`

**Problema:** Si `item.state === 'reviewed'` (porque `remaining <= 0` debido al seed incorrecto), NO se renderiza el botón.

---

### 5.2 Condición que decide estado

**Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js` (función `calculateItemState`, líneas 66-80)

**Código para `una_vez`:**
```javascript
} else {
  // una_vez
  const remaining = state?.shared_remaining ?? null;
  const completed = state?.shared_completed ?? 0;
  
  if (remaining === null && completed === 0) {
    return 'never';
  }
  
  if (remaining !== null && remaining <= 0) {  // ← PROBLEMA AQUÍ
    return 'reviewed';
  }
  
  return 'pending';
}
```

**Problema:** 
- Seed inicializa `remaining = 0` (no `null`)
- `remaining <= 0` se cumple
- Retorna `'reviewed'`
- UI no muestra botón

---

### 5.3 Condición que decide "tipo"

**Ubicación:** `src/core/master/services/alquimia-alumno-megalist-service.js` (líneas 407-410)

**Código:**
```javascript
const listaTipo = lista.tipo || 'recurrente';
let itemState;
try {
  itemState = calculateItemState(state, item, listaTipo);
```

**Observación:** El tipo se obtiene de `lista.tipo`, que es correcto.

---

### 5.4 Confirmar DOM API only

**Ubicación:** `public/js/master/master-alquimia-alumno-client.js`

**Búsqueda:** No se encontró `innerHTML =` ni `insertAdjacentHTML` en el archivo.

**Conclusión:** La UI usa DOM API correctamente (createElement, appendChild, textContent, etc.).

---

## 6) FLUJO COMPLETO (End-to-End)

### Flujo actual (ROTO)

1. **Usuario abre:** `/master/templo-luz/alquimia-alumno`
2. **UI carga:** `master-alquimia-alumno-client.js` inicializa
3. **UI llama:** `GET /master/api/alquimia-alumno/megalist?student_id=4`
4. **Backend ejecuta:**
   - Seed (opcional): inicializa `remaining = 0` para todos los items
   - Consulta `cleaning_item_state` para student_id=4
   - Resuelve catálogo (items + listas)
   - Calcula estado: `calculateItemState()` retorna `'reviewed'` para items `una_vez` con `remaining = 0`
   - Agrupa por lista y estado
5. **Backend responde:** Items `una_vez` en `reviewed_by_*`
6. **UI renderiza:** 
   - Items `una_vez` aparecen en sección "Revisados"
   - NO aparece botón "Limpiar" porque `item.state === 'reviewed'`
7. **Resultado:** Items `una_vez` NO son limpiables

---

### Flujo deseado (PROPUESTO)

1. **Usuario abre:** `/master/templo-luz/alquimia-alumno`
2. **UI carga:** `master-alquimia-alumno-client.js` inicializa
3. **UI llama:** `GET /master/api/alquimia-alumno/megalist?student_id=4`
4. **Backend ejecuta:**
   - Seed (opcional): inicializa `remaining = veces_limpiar || 1` para items `una_vez`
   - Consulta `cleaning_item_state` para student_id=4
   - Resuelve catálogo (items + listas)
   - Calcula estado: `calculateItemState()` retorna `'pending'` o `'never'` para items `una_vez` con `remaining > 0`
   - Agrupa por lista y estado
5. **Backend responde:** Items `una_vez` en `pending` o `never`
6. **UI renderiza:**
   - Items `una_vez` aparecen en sección "Pendiente" o "Nunca"
   - SÍ aparece botón "Limpiar" porque `item.state !== 'reviewed'`
7. **Resultado:** Items `una_vez` SÍ son limpiables

---

## 7) ERRORES JS / NETWORK (si existen)

**No se encontraron errores JavaScript en el código analizado.**

**No se pudo ejecutar curl real por limitaciones de red, pero el flujo está documentado arriba.**

---

**FIN DE UI TRACE**
