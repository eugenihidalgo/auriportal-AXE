# DIAGNÓSTICO CANÓNICO COMPLETO
## Alquimia General MASTER — Ítems, Proyección, Sincronización y Tendencias

**Fecha:** 2026-01-13  
**Sistema:** AuriPortal / Aurelín  
**Dominio:** MASTER  
**Pantalla:** `/master/templo-luz/alquimia-general`

---

## A) CONTEXTO DEL PROBLEMA (VALIDADO)

### Problemas reportados:

1. **Crear / eliminar ítems NO se refleja inmediatamente en UI**
   - Requiere refresh manual
   - A veces da error y luego "aparece bien" tras reload

2. **En proyección "ALL":**
   - Si algún alumno tiene un ítem revisado, se marca como revisado
   - Aunque otros alumnos NO lo tengan trabajado
   - **Regla esperada:** Un ítem en proyección ALL debe mostrar SIEMPRE el estado MENOS trabajado del grupo

3. **Cambio de lista superior:**
   - Si estoy en lista A (ej. Abundancia)
   - En tab "Proyección" / "Operativa"
   - Con view_layer (shared / pde / combo / effective)
   - Y con scope (all / student)
   - **Al cambiar a lista B (ej. Anatomía)**
   - **DEBE mantenerse exactamente el mismo estado de vista**
   - No resetear tabs ni modos

4. **Sensación general:**
   - No hay certeza de si el estado mostrado es correcto
   - Falta inmediatez
   - Falta coherencia visual tras acciones

---

## B) DIAGNÓSTICO 1 — CREACIÓN DE ÍTEMS (UNA_VEZ / RECURRENTE)

### Objetivo
Entender por qué crear ítems NO actualiza la UI inmediatamente.

### Localización de código

**Frontend - Función de creación:**
- **Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Función:** `handleCrearItem()` (línea 1627)
- **Función alternativa:** `handleCrearItemInline()` (línea 3752)

**Backend - Endpoint:**
- **Archivo:** `src/endpoints/master-api-alquimia-general.js`
- **Endpoint:** `POST /master/api/alquimia-general/items` (línea 726)
- **Servicio:** `createItem()` desde `alquimia-general-service.js`

### Evidencia de código

**1) Función `handleCrearItem()` (línea 1627-1663):**
```1627:1663:public/js/master/master-alquimia-general-client.js
  async function handleCrearItem(listaId) {
    const nombre = prompt('Nombre del item:');
    if (!nombre || !nombre.trim()) {
      return;
    }

    try {
      const response = await fetch('/master/api/alquimia-general/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lista_id: listaId,
          nombre: nombre.trim(),
          descripcion: '',
          nivel: 9,
          priority: 10,
          days: 20
        })
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error creando item');
      }

      console.log('[MasterAlquimiaGeneral] Item creado:', result.item);
      
      // Recargar items
      await loadItems(listaId);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error creando item:', error);
      showToastError(`Error creando item: ${error.message}`);
    }
  }
```

**2) Función `handleCrearItemInline()` (línea 3752-3798):**
```3752:3798:public/js/master/master-alquimia-general-client.js
  async function handleCrearItemInline(nombreInput, descInput, nivelInput, diasInput, vecesInput) {
    const nombre = nombreInput.value.trim();
    if (!nombre) {
      showWarning('El nombre es requerido');
      return;
    }

    try {
      const body = {
        lista_id: state.listaActiva.id,
        nombre,
        descripcion: descInput.value.trim() || null,
        nivel: parseInt(nivelInput.value) || 9
      };

      if (state.listaActiva.tipo === 'recurrente') {
        body.frecuencia_dias = diasInput ? (parseInt(diasInput.value) || 7) : 7;
      } else {
        body.veces_limpiar = vecesInput ? (parseInt(vecesInput.value) || 1) : 1;
      }

      const response = await fetch('/master/api/alquimia-general/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error creando item');
      }

      // Limpiar inputs
      nombreInput.value = '';
      descInput.value = '';
      nivelInput.value = '9';
      if (diasInput) diasInput.value = '7';
      if (vecesInput) vecesInput.value = '1';

      // Refetch items
      await loadItems(state.listaActiva.id);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error creando item inline:', error);
      showWarning(`Error: ${error.message}`);
    }
  }
```

**3) Función `loadItems()` (línea 1016-1039):**
```1016:1039:public/js/master/master-alquimia-general-client.js
  async function loadItems(listaId) {
    try {
      const response = await fetch(`/master/api/alquimia-general/listas/${listaId}/items`);
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[MasterAlquimiaGeneral] Error cargando items:', result.error);
        return;
      }

      // FIX: El endpoint devuelve { ok: true, items: [...] }, no { data: [...] }
      state.items = result.items || result.data || [];
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error cargando items:', error);
      
      // ERROR HANDLING: Pintar error visible
      if (listaContent) {
        const errorBox = document.createElement('div');
        errorBox.style.cssText = 'background: #fbbf24; color: #000; padding: 0.75rem; margin: 1rem 0; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;';
        errorBox.textContent = `⚠️ Error cargando items: ${error.message || 'Error desconocido'}`;
        listaContent.appendChild(errorBox);
      }
    }
  }
```

### Análisis del flujo

**Flujo actual:**
1. Usuario crea ítem → `handleCrearItem()` o `handleCrearItemInline()`
2. POST a `/master/api/alquimia-general/items`
3. Backend crea ítem y devuelve `{ ok: true, data: { item } }`
4. Frontend llama `loadItems(listaId)` → actualiza `state.items`
5. **PROBLEMA:** `loadItems()` NO llama a `renderView()`

### Hallazgo crítico

**PROBLEMA IDENTIFICADO:**
- `loadItems()` actualiza `state.items` pero **NO dispara re-render**
- `renderView()` solo se llama desde:
  - `selectListAndRender()` (línea 975)
  - `loadListProjection()` (línea 1344)
  - Cambios de tabs/modos

**Evidencia:**
- `handleCrearItem()` línea 1658: `await loadItems(listaId);` → **NO llama `renderView()`**
- `handleCrearItemInline()` línea 3793: `await loadItems(state.listaActiva.id);` → **NO llama `renderView()`**

### Respuesta al diagnóstico

**¿La UI confía en estado local?**
- ✅ SÍ: `state.items` se actualiza con `loadItems()`
- ❌ NO: La UI NO se re-renderiza automáticamente

**¿O depende de reload completo?**
- ❌ NO depende de reload completo
- ❌ PERO requiere acción manual (cambiar tab, cambiar lista, etc.) para que `renderView()` se ejecute

**Causa raíz:**
- Falta llamada a `renderView()` después de `loadItems()` en funciones de creación

---

## C) DIAGNÓSTICO 2 — ELIMINACIÓN DE ÍTEMS

### Objetivo
Entender por qué eliminar ítems NO se refleja inmediatamente.

### Localización de código

**Frontend - Función de eliminación:**
- **Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Función:** `handleEliminarItem()` (línea 4108)

**Backend - Endpoint:**
- **Archivo:** `src/endpoints/master-api-alquimia-general.js`
- **Endpoint:** `DELETE /master/api/alquimia-general/items/:id` (línea 896)
- **Servicio:** `archiveItem()` desde `alquimia-general-service.js`

### Evidencia de código

**1) Función `handleEliminarItem()` (línea 4108-4133):**
```4108:4133:public/js/master/master-alquimia-general-client.js
  async function handleEliminarItem(item) {
    if (!item || !item.id) {
      console.error('[MasterAlquimiaGeneral] Item sin id:', item);
      return;
    }

    // Sin confirmación (UX sin fricción, acción reversible)

    try {
      const response = await fetch(`/master/api/alquimia-general/items/${item.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error eliminando item');
      }

      // Refetch items
      await loadItems(state.listaActiva.id);
    } catch (error) {
      console.error('[MasterAlquimiaGeneral] Error eliminando item:', error);
      showWarning(`Error: ${error.message}`);
    }
  }
```

**2) Endpoint backend DELETE (línea 896-906):**
```896:906:src/endpoints/master-api-alquimia-general.js
    // DELETE /master/api/alquimia-general/items/:id (soft delete)
    if (path.match(/^\/master\/api\/alquimia-general\/items\/([^\/]+)$/) && method === 'DELETE') {
      const params = extractRouteParams(path, '/master/api/alquimia-general/items/:id');
      const id = params.id;

      const archived = await archiveItem(id);
      if (!archived) {
        return jsonError('Item no encontrado', 'ITEM_NOT_FOUND', 404, traceId);
      }

      return jsonSuccess({ item: archived }, traceId);
    }
```

### Análisis del flujo

**Flujo actual:**
1. Usuario elimina ítem → `handleEliminarItem()`
2. DELETE a `/master/api/alquimia-general/items/:id`
3. Backend hace soft delete (`status='archived'`) y devuelve `{ ok: true, item: {...} }`
4. Frontend llama `loadItems(state.listaActiva.id)` → actualiza `state.items`
5. **PROBLEMA:** `loadItems()` NO llama a `renderView()`

### Hallazgo crítico

**PROBLEMA IDENTIFICADO:**
- Mismo problema que creación: `loadItems()` actualiza `state.items` pero **NO dispara re-render**
- `handleEliminarItem()` línea 4128: `await loadItems(state.listaActiva.id);` → **NO llama `renderView()`**

### Respuesta al diagnóstico

**¿Se elimina del estado local?**
- ✅ SÍ: `state.items` se actualiza con `loadItems()` (el backend filtra `status='archived'`)

**¿Se vuelve a pedir la lista?**
- ✅ SÍ: `loadItems()` hace GET a `/master/api/alquimia-general/listas/:id/items`

**¿Se vuelve a renderizar?**
- ❌ NO: Falta llamada a `renderView()`

**Causa raíz:**
- Falta llamada a `renderView()` después de `loadItems()` en función de eliminación

---

## D) DIAGNÓSTICO 3 — PROYECCIÓN ALL (REGLA DEL "MENOS TRABAJADO")

### Objetivo
Verificar si la proyección ALL cumple la regla correcta.

### REGLA CANÓNICA ESPERADA
👉 En proyección ALL, un ítem debe reflejar el estado **MÁS BAJO** entre todos los alumnos (el menos trabajado).

### Localización de código

**Backend - Cálculo de proyección:**
- **Archivo:** `src/core/master/services/list-projection-model.js`
- **Función:** `getCleaningStatesForItems()` (línea 121)
- **Función principal:** `computeListProjection()` (línea 271)

### Evidencia de código

**1) Función `getCleaningStatesForItems()` - scope='all' (línea 193-249):**
```193:249:src/core/master/services/list-projection-model.js
  } else {
    // scope='all': obtener estados agregados (mejor estado entre todos los estudiantes)
    // Por ahora, v1: obtenemos el estado "más reciente" o "mejor" entre todos
    // Esto es una simplificación; en v2 podríamos calcular agregaciones más sofisticadas
    
    const result = await query(`
      SELECT 
        item_ref,
        -- Agregar: mejor estado shared (más reciente last_cleaned_at)
        MAX(shared_last_cleaned_at) as shared_last_cleaned_at,
        MAX(pde_last_cleaned_at) as pde_last_cleaned_at,
        -- Calcular days_since_last_clean desde el más reciente
        CASE 
          WHEN MAX(shared_last_cleaned_at) IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - MAX(shared_last_cleaned_at))) / 86400
          ELSE NULL
        END::integer as shared_days_since_last_clean,
        CASE 
          WHEN MAX(pde_last_cleaned_at) IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - MAX(pde_last_cleaned_at))) / 86400
          ELSE NULL
        END::integer as pde_days_since_last_clean,
        -- Para una_vez: sumar clean_count
        SUM(shared_clean_count) as shared_clean_count,
        SUM(pde_clean_count) as pde_clean_count
      FROM cleaning_item_state
      WHERE product_key = 'pde'
        AND domain_type = 'transmutation'
        AND item_ref = ANY($1::text[])
        AND student_id IN (
          SELECT legacy_alumno_id FROM students WHERE deleted_at IS NULL
        )
      GROUP BY item_ref
    `, [itemRefs]);
    
    const statesMap = {};
    result.rows.forEach(row => {
      statesMap[row.item_ref] = {
        shared: {
          clean_count: row.shared_clean_count || 0,
          days_since_last_clean: row.shared_days_since_last_clean,
          remaining: null, // No aplica en agregación
          completed: false, // No aplica en agregación
          last_cleaned_at: row.shared_last_cleaned_at
        },
        pde: {
          clean_count: row.pde_clean_count || 0,
          days_since_last_clean: row.pde_days_since_last_clean,
          remaining: null, // No aplica en agregación
          completed: false, // No aplica en agregación
          last_cleaned_at: row.pde_last_cleaned_at
        }
      };
    });
    
    return statesMap;
  }
```

### Análisis del algoritmo

**Algoritmo actual (scope='all'):**
1. Usa `MAX(shared_last_cleaned_at)` → **toma el MÁS RECIENTE** (mejor estado)
2. Usa `MAX(pde_last_cleaned_at)` → **toma el MÁS RECIENTE** (mejor estado)
3. Calcula `days_since_last_clean` desde el más reciente
4. Suma `clean_count` (para una_vez)

**Problema identificado:**
- ❌ **INCORRECTO:** Usa `MAX()` que toma el **MEJOR** estado (más reciente)
- ✅ **ESPERADO:** Debería usar `MIN()` o lógica que tome el **PEOR** estado (menos trabajado)

### Ejemplo real

**Escenario:**
- Alumno A: ítem revisado (shared_last_cleaned_at = 2026-01-10)
- Alumno B: ítem nunca trabajado (shared_last_cleaned_at = NULL)

**Resultado actual:**
- `MAX(shared_last_cleaned_at)` = 2026-01-10 → **revisado** ❌

**Resultado esperado:**
- Debería considerar el peor estado → **never** ✅

### Respuesta al diagnóstico

**¿El algoritmo actual es incorrecto según la regla?**
- ✅ **SÍ:** El algoritmo usa `MAX()` que toma el mejor estado, cuando debería tomar el peor

**¿Dónde se produce la decisión errónea?**
- **Archivo:** `src/core/master/services/list-projection-model.js`
- **Función:** `getCleaningStatesForItems()` (línea 198-226)
- **Línea específica:** Línea 202-203: `MAX(shared_last_cleaned_at)`, `MAX(pde_last_cleaned_at)`

**Comentario en código:**
- Línea 195: `// scope='all': obtener estados agregados (mejor estado entre todos los estudiantes)`
- Línea 196: `// Por ahora, v1: obtenemos el estado "más reciente" o "mejor" entre todos`
- **Este comentario confirma que el algoritmo está diseñado para tomar el MEJOR, no el PEOR**

---

## E) DIAGNÓSTICO 4 — SINCRONIZACIÓN DE PROYECCIÓN (ALL / STUDENT)

### Objetivo
Entificar por qué al cambiar filtros o listas hay que refrescar.

### Localización de código

**Frontend - Carga de proyección:**
- **Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Función:** `loadListProjection()` (línea 1271)

### Evidencia de código

**1) Función `loadListProjection()` (línea 1271-1356):**
```1271:1356:public/js/master/master-alquimia-general-client.js
  async function loadListProjection() {
    if (!state.listaActiva) return;
    
    const itemKind = getItemKindExplicit(null, state.listaActiva) || state.listaActiva.tipo;
    if (!itemKind) {
      console.warn('[MasterAlquimiaGeneral][LPM] No se pudo determinar item_kind');
      return;
    }
    
    // GATE: Validar que si scope='student', student_uuid esté presente
    if (state.projection.scope === 'student' && !state.projection.student_uuid) {
      console.warn('[LPM][GATE] scope=student sin student_uuid. Esperando selección de alumno.');
      
      // Renderizar estado de espera en UI
      if (listaContent) {
        // Limpiar contenido previo de proyección
        const existingProjection = listaContent.querySelector('[data-projection-content]');
        if (existingProjection) {
          existingProjection.remove();
        }
        
        const waitingContainer = document.createElement('div');
        waitingContainer.setAttribute('data-projection-content', 'true');
        waitingContainer.style.cssText = 'padding: 2rem; text-align: center; color: #94a3b8; font-style: italic;';
        
        const waitingMsg = document.createElement('div');
        waitingMsg.textContent = 'Selecciona un alumno para ver la proyección';
        waitingMsg.style.cssText = 'font-size: 1rem; margin-bottom: 0.5rem;';
        waitingContainer.appendChild(waitingMsg);
        
        listaContent.appendChild(waitingContainer);
      }
      
      state.projection.loading = false;
      return;
    }
    
    state.projection.loading = true;
    
    try {
      const params = new URLSearchParams({
        list_id: state.listaActiva.id,
        item_kind: itemKind,
        view_layer: state.projection.view_layer,
        scope: state.projection.scope
      });
      
      if (state.projection.scope === 'student' && state.projection.student_uuid) {
        params.append('student_uuid', state.projection.student_uuid);
      }
      
      console.log('[UI][LPM] fetch', {
        list_id: state.listaActiva.id,
        item_kind: itemKind,
        view_layer: state.projection.view_layer,
        scope: state.projection.scope,
        student_uuid: state.projection.student_uuid
      });
      
      const response = await fetch(`/master/api/alquimia-general/list-projection?${params.toString()}`);
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Error cargando proyección');
      }
      
      state.projection.data = result.data;
      
      console.log('[UI][LPM] render', {
        counts: result.data.metrics.by_state_counts,
        reviewed_pct: result.data.metrics.reviewed_pct
      });
      
      renderView(); // Re-renderizar con datos de proyección
    } catch (error) {
      console.error('[MasterAlquimiaGeneral][LPM] Error cargando proyección:', error);
      
      // Mostrar error visible
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'background: #fbbf24; color: #000; padding: 0.75rem; margin: 1rem 0; border-radius: 0.5rem; font-family: monospace; font-size: 0.875rem;';
      errorBox.textContent = `⚠️ Error cargando proyección: ${error.message || 'Error desconocido'}`;
      listaContent.appendChild(errorBox);
    } finally {
      state.projection.loading = false;
    }
  }
```

### Análisis del flujo

**Cuándo se llama `loadListProjection()`:**
1. Cambio de view_layer (línea 1387)
2. Cambio de scope (línea 1410, 1421)
3. Cambio de student_uuid (línea 1466, 1471)
4. Cambio de tab a "Proyección" (línea 1159)
5. Cambio de lista (línea 290) → **PERO solo si ya está en modo proyección**

### Hallazgo crítico

**PROBLEMA IDENTIFICADO:**
- `loadListProjection()` se llama cuando cambia scope/view_layer/student
- **PERO:** Al cambiar de lista, `selectListAndRender()` (línea 959) NO llama a `loadListProjection()` si el modo es "proyección"
- `selectListAndRender()` solo llama a `loadLista()` y `renderView()`, pero `renderView()` NO recarga proyección automáticamente

**Evidencia:**
- `selectListAndRender()` línea 966: `await loadLista(listId);` → carga lista + items
- `selectListAndRender()` línea 975: `renderView();` → renderiza vista
- **NO hay llamada a `loadListProjection()` si `state.projection.mode === 'proyeccion'`**

### Respuesta al diagnóstico

**¿Cuándo se llama a `loadListProjection()`?**
- ✅ Al cambiar view_layer
- ✅ Al cambiar scope
- ✅ Al cambiar student_uuid
- ❌ **NO se llama automáticamente al cambiar lista** (solo si se cambia manualmente scope/view_layer después)

**¿Se vuelve a llamar al cambiar lista?**
- ❌ NO: `selectListAndRender()` NO llama a `loadListProjection()`

**Causa raíz:**
- Falta lógica en `selectListAndRender()` para detectar si está en modo "proyección" y recargar proyección

---

## F) DIAGNÓSTICO 5 — PERSISTENCIA DE ESTADO DE VISTA ENTRE LISTAS

### Objetivo
Confirmar si el comportamiento actual respeta continuidad.

### Comportamiento esperado
- Cambio de lista → misma vista:
  - Operativa / Proyección
  - view_layer (shared/pde/combo/effective)
  - scope (all/student)

### Localización de código

**Frontend - Cambio de lista:**
- **Archivo:** `public/js/master/master-alquimia-general-client.js`
- **Función:** `selectListAndRender()` (línea 959)
- **Función:** `updateViewState()` (línea 138)

### Evidencia de código

**1) Función `selectListAndRender()` (línea 959-976):**
```959:976:public/js/master/master-alquimia-general-client.js
  async function selectListAndRender(listId) {
    console.log('[ACTION][selectListAndRender] start', { listId });
    
    // Set estado intencional
    updateViewState({ list_id: listId });
    
    // Await datos (loadLista ya carga lista + items internamente)
    await loadLista(listId);
    
    console.log('[ACTION][selectListAndRender] data_ready', {
      listId,
      listaActivaId: state.listaActiva?.id || null,
      itemsLen: state.items?.length || 0
    });
    
    // Render FINAL cuando datos están listos
    renderView();
  }
```

**2) Función `updateViewState()` (línea 138-200):**
```138:200:public/js/master/master-alquimia-general-client.js
  function updateViewState(updates) {
    const oldViewState = getViewState();
    
    // Aplicar actualizaciones
    if (updates.item_kind !== undefined) {
      state.tipoActivo = updates.item_kind;
      // REGLA D: Cambio de item_kind limpia list_id
      if (updates.item_kind !== oldViewState.item_kind) {
        state.list_id = null;
        state.listaActiva = null; // Dato derivado se limpia también
        console.log('[UI][VIEW_STATE_CHANGE] item_kind changed, list_id cleared', {
          old: oldViewState.item_kind,
          new: updates.item_kind
        });
      }
    }
    
    if (updates.list_id !== undefined) {
      // ACTUALIZAR estado intencional PRIMERO
      state.list_id = updates.list_id;
      // LUEGO actualizar dato derivado (búsqueda en listas)
      const lista = state.listas.find(l => l.id === updates.list_id);
      state.listaActiva = lista || null;
      console.log('[UI][VIEW_STATE_CHANGE] list_id changed', {
        old: oldViewState.list_id,
        new: updates.list_id
      });
    }
    
    if (updates.viewMode !== undefined) {
      state.projection.mode = updates.viewMode;
      console.log('[UI][VIEW_STATE_CHANGE] viewMode changed', {
        old: oldViewState.viewMode,
        new: updates.viewMode
      });
    }
    
    if (updates.view_layer !== undefined) {
      state.projection.view_layer = updates.view_layer;
      console.log('[UI][VIEW_STATE_CHANGE] view_layer changed', {
        old: oldViewState.view_layer,
        new: updates.view_layer
      });
    }
    
    if (updates.scope !== undefined) {
      state.projection.scope = updates.scope;
      console.log('[UI][VIEW_STATE_CHANGE] scope changed', {
        old: oldViewState.scope,
        new: updates.scope
      });
    }
    
    if (updates.student_uuid !== undefined) {
      state.projection.student_uuid = updates.student_uuid;
      console.log('[UI][VIEW_STATE_CHANGE] student_uuid changed', {
        old: oldViewState.student_uuid,
        new: updates.student_uuid
      });
    }
    
    const newViewState = getViewState();
    console.log('[UI][VIEW_STATE_CHANGE] viewState', {
```

**3) Estado de proyección (línea 102-109):**
```102:109:public/js/master/master-alquimia-general-client.js
    // LPM v1: Estado de proyección
    projection: {
      mode: 'operativa', // 'operativa' | 'proyeccion'
      view_layer: 'shared', // 'shared' | 'pde' | 'combo' | 'effective'
      scope: 'all', // 'all' | 'student'
      student_uuid: null, // UUID del estudiante si scope='student'
      data: null, // Datos de proyección desde endpoint
      loading: false
    },
```

### Análisis del comportamiento

**Comportamiento actual:**
1. `selectListAndRender()` actualiza `state.list_id` vía `updateViewState()`
2. `updateViewState()` **NO modifica** `state.projection.mode`, `state.projection.view_layer`, `state.projection.scope`
3. **PERO:** `selectListAndRender()` NO recarga proyección si `mode === 'proyeccion'`
4. `renderView()` renderiza según `state.projection.mode`, pero si no hay datos de proyección, puede mostrar vista incorrecta

### Hallazgo crítico

**PROBLEMA IDENTIFICADO:**
- ✅ El estado de vista (mode, view_layer, scope) **SÍ se preserva** en `state.projection`
- ❌ **PERO:** Al cambiar lista, `selectListAndRender()` NO recarga proyección si está en modo "proyección"
- ❌ `renderView()` puede renderizar vista de proyección con datos stale de la lista anterior

### Respuesta al diagnóstico

**¿Dónde se guarda este estado?**
- ✅ `state.projection.mode` (línea 103)
- ✅ `state.projection.view_layer` (línea 104)
- ✅ `state.projection.scope` (línea 105)
- ✅ `state.projection.student_uuid` (línea 106)

**¿Se resetea al cambiar lista?**
- ❌ NO: `updateViewState({ list_id })` NO modifica `state.projection.*`
- ✅ El estado se preserva

**¿Se ignora parcialmente?**
- ✅ SÍ: El estado se preserva pero NO se recarga la proyección
- ❌ `selectListAndRender()` NO llama a `loadListProjection()` si `mode === 'proyeccion'`

**Causa raíz:**
- Falta lógica en `selectListAndRender()` para detectar modo "proyección" y recargar proyección con nueva lista

---

## G) MATRIZ DE CAUSAS

| Problema | Backend | Frontend | Proyección | Estado | Evidencia |
|----------|---------|----------|------------|--------|-----------|
| Crear ítem no actualiza UI | ✅ OK | ❌ `loadItems()` no llama `renderView()` | N/A | `state.items` actualizado pero UI no re-renderiza | `handleCrearItem()` línea 1658 |
| Eliminar ítem no actualiza UI | ✅ OK | ❌ `loadItems()` no llama `renderView()` | N/A | `state.items` actualizado pero UI no re-renderiza | `handleEliminarItem()` línea 4128 |
| Proyección ALL muestra mejor estado | ❌ Usa `MAX()` en lugar de `MIN()` | N/A | ❌ Algoritmo incorrecto | Toma mejor estado en lugar de peor | `list-projection-model.js` línea 202-203 |
| Cambio de lista no recarga proyección | N/A | ❌ `selectListAndRender()` no llama `loadListProjection()` | N/A | Estado preservado pero datos stale | `selectListAndRender()` línea 959-976 |
| Estado de vista no se mantiene | N/A | ✅ Estado se preserva | ❌ No se recarga | `state.projection.*` preservado pero no se usa | `selectListAndRender()` línea 963 |

---

## H) CONCLUSIÓN DEL DIAGNÓSTICO

### 1) ¿Cuántos problemas reales hay?
**5 problemas reales identificados:**
1. Crear ítem no actualiza UI (frontend)
2. Eliminar ítem no actualiza UI (frontend)
3. Proyección ALL muestra mejor estado en lugar de peor (backend/proyección)
4. Cambio de lista no recarga proyección (frontend)
5. Estado de vista preservado pero no utilizado (frontend)

### 2) ¿Cuáles son de backend?
**1 problema de backend:**
- Proyección ALL usa `MAX()` en lugar de `MIN()` (algoritmo incorrecto)

### 3) ¿Cuáles son de frontend?
**4 problemas de frontend:**
- Crear ítem no actualiza UI
- Eliminar ítem no actualiza UI
- Cambio de lista no recarga proyección
- Estado de vista preservado pero no utilizado

### 4) ¿Cuáles son de proyección / algoritmo?
**1 problema de proyección:**
- Algoritmo de proyección ALL usa `MAX()` (mejor estado) en lugar de lógica que tome el peor estado

### 5) ¿Cuáles son solo de UX / sincronización?
**4 problemas de UX/sincronización:**
- Crear ítem no actualiza UI (sincronización)
- Eliminar ítem no actualiza UI (sincronización)
- Cambio de lista no recarga proyección (sincronización)
- Estado de vista preservado pero no utilizado (UX)

---

## I) CHECKLIST FINAL

- ❌ Crear ítem actualiza UI inmediatamente
- ❌ Eliminar ítem actualiza UI inmediatamente
- ❌ Proyección ALL muestra el estado menos trabajado
- ❌ Cambiar lista mantiene vista activa (preserva estado pero no recarga datos)
- ❌ No hace falta refresh manual
- ❌ El estado mostrado es confiable (proyección ALL incorrecta)

---

## J) RESUMEN EJECUTIVO

### Problemas críticos identificados

1. **Frontend - Falta re-render tras mutaciones:**
   - `loadItems()` actualiza `state.items` pero NO llama a `renderView()`
   - Afecta: creación y eliminación de ítems
   - **Fix requerido:** Añadir `renderView()` después de `loadItems()` en `handleCrearItem()` y `handleEliminarItem()`

2. **Backend - Algoritmo de proyección ALL incorrecto:**
   - Usa `MAX(shared_last_cleaned_at)` que toma el mejor estado
   - Debería tomar el peor estado (menos trabajado)
   - **Fix requerido:** Cambiar lógica en `getCleaningStatesForItems()` para scope='all'

3. **Frontend - Cambio de lista no recarga proyección:**
   - `selectListAndRender()` NO llama a `loadListProjection()` si está en modo "proyección"
   - Estado se preserva pero datos quedan stale
   - **Fix requerido:** Añadir lógica en `selectListAndRender()` para detectar modo "proyección" y recargar

### Evidencias documentadas

- ✅ Código exacto con líneas de archivo
- ✅ Flujos de ejecución identificados
- ✅ Problemas específicos localizados
- ✅ Causas raíz confirmadas

---

## J) REFERENCIA A FIXES APLICADOS

**Fixes frontend aplicados:**
- Ver documentación: `docs/MASTER_ALQUIMIA_GENERAL_FRONTEND_SYNC_FIX_V1.md`
- Commit: `5c7551c` - `fix(master-alquimia): immediate ui updates + projection sync on list change`

**Estado:**
- ✅ Fixes de inmediatez UI aplicados (crear/eliminar ítems)
- ✅ Fix de sincronización proyección aplicado (cambio de lista)
- ⏳ Pendiente: Rediseño algoritmo backend proyección ALL (peor estado)

---

**Fin del diagnóstico canónico.**
