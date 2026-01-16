# 🔍 AUDITORÍA FUNCIONAL EXTREMA — ALQUIMIA GENERAL v1
## (POST RUNTIME CORE v1 / UX ACTION REGISTRY v1)

**Fecha:** 2026-01-13  
**Modo:** AUDITORÍA + DISEÑO CANÓNICO  
**Estado:** ❌ NO IMPLEMENTADO (solo diagnóstico y diseño)

---

## 📋 LISTADO DE PROBLEMAS

### 🔴 BUG-018: Agregación de Estado ALL Incorrecta en RECURRENTE (BLOCKER)

**Contexto:** `recurrente` / `proyección ALL`  
**Ubicación:** Backend (proyección ALL) + Frontend (renderizado)

**Qué pasa ahora:**
- En proyección ALL, el backend agrega estados de múltiples estudiantes para un mismo item
- La prioridad de agregación NO está definida canónicamente
- El frontend ordena items por estado individual (`state_by_view_layer[view_layer].state`), pero NO hay campo agregado para el estado ALL
- Si hay mezcla de estados (ej: algunos estudiantes en `never`, otros en `pending`), el item puede aparecer en posición incorrecta

**Por qué está mal:**
- **Contrato violado:** View Authority v1 exige que el backend decida el estado agregado
- **Inconsistencia semántica:** El estado mostrado en ALL no refleja la prioridad canónica
- **Prioridad no definida:** No hay función canónica que defina qué estado tiene prioridad cuando hay mezcla

**Evidencia:**
- Línea ~1840: Frontend ordena por `item.state_by_view_layer[viewLayer].state` (estado individual, no agregado)
- No existe campo `aggregated_state` o `all_state` en la respuesta del backend para proyección ALL

---

### 🔴 BUG-019: Reset ALL No Existe para RECURRENTE (CRITICAL)

**Contexto:** `recurrente` / `proyección ALL`  
**Ubicación:** Frontend (botones) + Backend (endpoint)

**Qué pasa ahora:**
- En proyección ALL, NO existe botón "Reset lista" para resetear TODOS los estudiantes
- Solo existe "Reset lista" en `scope='student'` (línea ~1611-1683)
- No hay acción UX registrada para reset ALL

**Por qué está mal:**
- **Funcionalidad faltante:** Master necesita poder resetear progreso de todos los estudiantes de una vez
- **Inconsistencia:** Existe reset por estudiante, pero no reset masivo
- **Contrato violado:** No hay acción UX registrada para esta operación

**Evidencia:**
- Línea ~1611: Botón "Reset lista" solo visible si `scope === 'student'`
- No existe `alquimia.reset.all` en `alquimia-actions.js`

---

### 🔴 BUG-020: EFFECTIVE No Devuelve state_by_view_layer.effective (BLOCKER)

**Contexto:** `recurrente` / `view_layer='effective'`  
**Ubicación:** Backend (endpoint de proyección/flotante)

**Qué pasa ahora:**
- Cuando se selecciona `view_layer='effective'` en recurrente, el backend NO devuelve `state_by_view_layer.effective`
- El frontend intenta acceder a `student.state_by_view_layer?.effective` (línea ~3093, ~3346)
- Esto causa error o estado "no disponible"

**Por qué está mal:**
- **Contrato violado:** View Authority v1 exige que el backend devuelva `state_by_view_layer` para TODAS las view_layers válidas
- **Error silencioso:** El frontend puede fallar sin mostrar error visible
- **Combinación inválida:** El backend no calcula effective cuando debería

**Evidencia:**
- Línea ~3093: `const effectiveStateData = student.state_by_view_layer?.effective;` (puede ser undefined)
- Línea ~3346: Mismo acceso a `effective` que puede fallar
- No hay validación que bloquee render si `effective` falta

---

### 🔴 BUG-021: Reset en EFFECTIVE Actúa Sobre Capa Incorrecta (CRITICAL)

**Contexto:** `recurrente` / `view_layer='effective'` / `reset`  
**Ubicación:** Frontend (botones reset) + Backend (endpoint reset)

**Qué pasa ahora:**
- En vista EFFECTIVE, si se ejecuta reset, el código actual puede usar `cleanLayer` como fallback (BUG-016 ya corregido parcialmente)
- Reset en EFFECTIVE debería actuar SOLO sobre PDE (regla canónica), pero el código actual puede resetear SHARED o ambas

**Por qué está mal:**
- **Regla canónica violada:** EFFECTIVE es proyección, reset debe actuar sobre PDE únicamente
- **Comportamiento inconsistente:** Reset desde EFFECTIVE no debería afectar SHARED
- **Separación violada:** Mezcla clean_layer con view_layer

**Evidencia:**
- Línea ~1630: `resetStudentListProgress` usa `viewLayer` pero no valida que EFFECTIVE → PDE
- No hay validación explícita que fuerce `clean_layer='pde'` cuando `view_layer='effective'`

---

### 🔴 BUG-022: Botones Incorrectos en UNA_VEZ Proyección por Alumno (CRITICAL)

**Contexto:** `una_vez` / `proyección scope='student'`  
**Ubicación:** Frontend (renderizado de botones en proyección)

**Qué pasa ahora:**
- En proyección por alumno (`scope='student'`), para items `una_vez`, se muestran 4 botones:
  1. "Reset progreso" (❌ NO debería existir para una_vez)
  2. "Limpiar" (❌ NO debería existir, debería ser "+1")
  3. "Limpiar interno" (❌ NO debería existir, debería ser "+1 PDE")
  4. Posiblemente otros botones incorrectos

**Por qué está mal:**
- **Contrato violado:** `una_vez` NO tiene reset (BUG-001 ya corregido parcialmente)
- **Botones incorrectos:** `una_vez` solo debe tener "+1" (shared) y "+1 PDE" (pde)
- **Mezcla de conceptos:** "Limpiar" es concepto de `recurrente`, no de `una_vez`

**Evidencia:**
- Línea ~4734-4742: Botones de limpieza individual se renderizan sin validar `item_kind` explícitamente
- Línea ~4646-4697: "Reset progreso" se renderiza pero BUG-001 ya valida `item_kind`, pero puede haber otros botones

---

### 🔴 BUG-023: Error "vecesLimpiar is not defined" (CRITICAL)

**Contexto:** `una_vez` / cualquier vista  
**Ubicación:** Frontend (cálculos de estado/display)

**Qué pasa ahora:**
- En algún lugar del código se intenta acceder a `vecesLimpiar` (camelCase) en lugar de `veces_limpiar` (snake_case)
- Esto causa `ReferenceError: vecesLimpiar is not defined`
- El error puede estar en cálculos de estado, display de información, o validaciones

**Por qué está mal:**
- **Error de runtime:** El código falla en ejecución
- **Inconsistencia de naming:** Mezcla camelCase y snake_case
- **Contrato roto:** El backend devuelve `veces_limpiar` o `required_count`, no `vecesLimpiar`

**Evidencia:**
- Búsqueda de `vecesLimpiar` no encontró resultados (puede estar en código dinámico o template)
- Línea ~3124, ~3193, ~3228: Se usa `veces_limpiar` correctamente, pero puede haber otro lugar con error

---

### 🔴 BUG-024: Errores Visibles Sin Mensajes Canónicos (MAJOR)

**Contexto:** Todos los contextos  
**Ubicación:** Frontend (renderizado de errores)

**Qué pasa ahora:**
- Cuando `state_by_view_layer` falta, se muestra error genérico "Estado no disponible" o similar
- Los mensajes de error NO son canónicos ni informativos
- No se diferencia entre "backend no devolvió datos" vs "datos inconsistentes" vs "item_kind inválido"

**Por qué está mal:**
- **UX pobre:** El usuario no sabe qué pasó ni cómo solucionarlo
- **Debugging difícil:** Los logs pueden no ser suficientes
- **Mensajes inconsistentes:** Diferentes partes del código muestran errores diferentes

**Evidencia:**
- Línea ~2838: `errorDesc.textContent = '${studentsByState._error.length} estudiante(s) con datos inconsistentes...'`
- Línea ~3155: `stateDiv.textContent = 'Estado no disponible';`
- No hay mensajes canónicos definidos

---

## 🧭 DISEÑO CANÓNICO DE COMPORTAMIENTO

### BUG-018: Agregación de Estado ALL Canónica

**Comportamiento esperado:**
1. **Backend calcula estado agregado** para proyección ALL usando función canónica:
   ```javascript
   function aggregateStateForAll(students) {
     // Prioridad canónica (de mayor a menor):
     // 1. NUNCA (si ALGÚN estudiante está en never)
     // 2. IMPORTANTE_REVISAR (si ALGÚN estudiante está en important)
     // 3. PENDIENTE (si ALGÚN estudiante está en pending)
     // 4. REVISADO (solo si TODOS están en reviewed)
     
     const states = students.map(s => s.state_by_view_layer[view_layer].state);
     if (states.includes('never')) return 'never';
     if (states.includes('important')) return 'important';
     if (states.includes('pending')) return 'pending';
     if (states.every(s => s === 'reviewed')) return 'reviewed';
     return 'pending'; // Fallback seguro
   }
   ```

2. **Backend devuelve campo agregado:**
   ```json
   {
     "item_ref": "...",
     "state_by_view_layer": {
       "shared": { "state": "pending", ... },
       "pde": { "state": "reviewed", ... }
     },
     "aggregated_state_all": {
       "shared": "pending",  // Estado agregado para ALL
       "pde": "reviewed"
     }
   }
   ```

3. **Frontend consume `aggregated_state_all[view_layer]`** para ordenar items en proyección ALL

**Responsable:**
- **Backend:** Calcular y devolver `aggregated_state_all`
- **Frontend:** Consumir `aggregated_state_all[view_layer]` para ordenar

**Campos implicados:**
- `aggregated_state_all[view_layer]` (nuevo campo en respuesta)
- `state_by_view_layer[view_layer].state` (mantener para compatibilidad)

---

### BUG-019: Reset ALL Canónico

**Comportamiento esperado:**
1. **Botón visible solo si:**
   - `item_kind === 'recurrente'`
   - `scope === 'all'`
   - `view_mode === 'proyeccion'`

2. **Botón "Reset lista ALL":**
   - Texto: "Reset lista ALL"
   - Color: Rojo (#ef4444)
   - Ubicación: Header de proyección (junto a selector de scope)

3. **Acción ejecutada:**
   - Resetear progreso de TODOS los estudiantes para TODOS los items de la lista
   - `clean_layer` afectado: según `view_layer` activo (shared/pde/effective → pde)
   - Resultado: Todos los estudiantes → estado `pending`

**Responsable:**
- **Backend:** Endpoint que resetea masivamente
- **Frontend:** Renderizar botón y llamar acción UX

**Campos implicados:**
- `list_id` (obligatorio)
- `item_kind` (debe ser 'recurrente')
- `clean_layer` (derivado de view_layer: effective → pde, shared → shared, pde → pde)
- `scope: 'all'` (implícito)

---

### BUG-020: EFFECTIVE Canónico

**Comportamiento esperado:**
1. **Backend SIEMPRE calcula effective** cuando:
   - `item_kind === 'recurrente'`
   - `view_layer === 'effective'` o se solicita proyección completa

2. **Backend devuelve:**
   ```json
   {
     "state_by_view_layer": {
       "shared": { "state": "pending", ... },
       "pde": { "state": "reviewed", ... },
       "effective": {
         "state": "pending",  // Proyección: min(shared.state, pde.state)
         "effective_sources": {
           "shared": false,  // ¿Shared contribuye al effective?
           "pde": true       // ¿PDE contribuye al effective?
         },
         "computed_state": {
           "color": "#f59e0b",
           "state_display": "Pendiente"
         }
       }
     }
   }
   ```

3. **Si effective NO está disponible:**
   - Frontend BLOQUEA render y muestra error visible:
     ```
     ❌ ERROR: state_by_view_layer.effective no disponible
     El backend no calculó la vista effective para este item.
     ```

**Responsable:**
- **Backend:** Calcular y devolver `state_by_view_layer.effective` siempre para recurrente
- **Frontend:** Validar que existe antes de renderizar, bloquear si falta

**Campos implicados:**
- `state_by_view_layer.effective` (obligatorio para recurrente)
- `state_by_view_layer.effective.effective_sources` (obligatorio)
- `state_by_view_layer.effective.computed_state` (obligatorio)

---

### BUG-021: Reset en EFFECTIVE Canónico

**Comportamiento esperado:**
1. **Regla canónica:**
   - Reset desde EFFECTIVE → SIEMPRE actúa sobre `clean_layer='pde'`
   - NUNCA actúa sobre SHARED desde EFFECTIVE
   - EFFECTIVE es proyección, reset es escritura → PDE

2. **Validación explícita:**
   ```javascript
   function getCleanLayerForReset(view_layer, item_kind) {
     if (view_layer === 'effective' && item_kind === 'recurrente') {
       return 'pde'; // Regla canónica: effective → pde
     }
     if (view_layer === 'shared') return 'shared';
     if (view_layer === 'pde') return 'pde';
     throw new Error(`view_layer inválido para reset: ${view_layer}`);
   }
   ```

3. **Backend valida:**
   - Si `view_layer='effective'` y `clean_layer !== 'pde'` → Error 400

**Responsable:**
- **Frontend:** Usar función canónica para determinar `clean_layer`
- **Backend:** Validar que `clean_layer='pde'` cuando `view_layer='effective'`

**Campos implicados:**
- `view_layer` (input)
- `clean_layer` (output: effective → pde)

---

### BUG-022: Botones UNA_VEZ Canónicos

**Comportamiento esperado:**
1. **Botones permitidos en proyección por alumno (`scope='student'`):**
   - ✅ "+1" (shared) → `alquimia.clean` con `item_kind='una_vez'`, `clean_layer='shared'`
   - ✅ "+1 PDE" (pde) → `alquimia.clean` con `item_kind='una_vez'`, `clean_layer='pde'`
   - ❌ NO "Reset progreso" (solo recurrente)
   - ❌ NO "Limpiar" (solo recurrente)
   - ❌ NO "Limpiar interno" (debe ser "+1 PDE")

2. **Validación explícita:**
   ```javascript
   function getButtonsForItem(item, item_kind, scope) {
     if (item_kind === 'una_vez' && scope === 'student') {
       return [
         { text: '+1', action: 'alquimia.clean', clean_layer: 'shared' },
         { text: '+1 PDE', action: 'alquimia.clean', clean_layer: 'pde' }
       ];
     }
     // ... otros casos
   }
   ```

**Responsable:**
- **Frontend:** Validar `item_kind` antes de renderizar botones
- **Backend:** Validar `item_kind` en acciones UX

**Campos implicados:**
- `item_kind` (obligatorio para decidir botones)
- `scope` (obligatorio: 'student' vs 'all')

---

### BUG-023: Error vecesLimpiar Canónico

**Comportamiento esperado:**
1. **Backend SIEMPRE devuelve:**
   - `veces_limpiar` (snake_case, campo base)
   - `required_count` (snake_case, valor efectivo con overrides)

2. **Frontend SIEMPRE consume:**
   - `item.veces_limpiar` (base)
   - `item.required_count` (efectivo)
   - NUNCA `vecesLimpiar` (camelCase)

3. **Si falta `required_count`:**
   - Usar `veces_limpiar` como fallback
   - Log warning si falta ambos

**Responsable:**
- **Backend:** Garantizar que siempre devuelve `veces_limpiar` y `required_count`
- **Frontend:** Buscar y eliminar cualquier referencia a `vecesLimpiar` (camelCase)

**Campos implicados:**
- `veces_limpiar` (obligatorio en backend)
- `required_count` (obligatorio en backend, puede ser igual a `veces_limpiar`)

---

### BUG-024: Mensajes de Error Canónicos

**Comportamiento esperado:**
1. **Mensajes canónicos definidos:**
   ```javascript
   const ERROR_MESSAGES = {
     STATE_BY_VIEW_LAYER_MISSING: (view_layer, item_ref) => 
       `❌ ERROR: state_by_view_layer.${view_layer} no disponible para item ${item_ref}. El backend no calculó el estado para esta vista.`,
     
     ITEM_KIND_INVALID: (item_kind, item_ref) =>
       `❌ ERROR: item_kind inválido "${item_kind}" para item ${item_ref}. Debe ser 'recurrente' o 'una_vez'.`,
     
     EFFECTIVE_NOT_AVAILABLE: (item_ref) =>
       `❌ ERROR: Vista effective no disponible para item ${item_ref}. Solo disponible para items recurrentes.`,
     
     BACKEND_DATA_INCONSISTENT: (count) =>
       `❌ ERROR: ${count} estudiante(s) con datos inconsistentes. El backend no devolvió state_by_view_layer.`,
     
     REQUIRED_COUNT_MISSING: (item_ref) =>
       `⚠️ ADVERTENCIA: required_count no disponible para item ${item_ref}. Usando veces_limpiar como fallback.`
   };
   ```

2. **Frontend usa mensajes canónicos:**
   - NO hardcodear mensajes de error
   - Usar constantes canónicas
   - Incluir contexto (item_ref, view_layer, etc.)

**Responsable:**
- **Frontend:** Usar mensajes canónicos, no hardcodear
- **Backend:** Devolver errores estructurados con códigos

**Campos implicados:**
- `error_code` (nuevo campo en respuestas de error)
- `error_message` (mensaje canónico)

---

## 🧱 ACCIONES UX NECESARIAS

### 1. `alquimia.reset.all`
- **action_id:** `alquimia.reset.all`
- **scope:** `'all'` (implícito)
- **item_kind:** `'recurrente'` (obligatorio)
- **clean_layer:** Derivado de `view_layer` (effective → pde, shared → shared, pde → pde)
- **endpoint:** `POST /master/api/alquimia-general/listas/:list_id/reset-all`
- **payload:** `{ item_kind: 'recurrente', clean_layer: 'shared' | 'pde', view_layer: 'shared' | 'pde' | 'effective' }`
- **refresh_plan:** `['alquimia.list_projection']`

---

## 🔁 REFRESH SURFACES REQUERIDAS

### Para BUG-018 (Agregación ALL):
- **Surface:** `alquimia.list_projection`
- **Cuándo:** Después de cualquier mutación que afecte estado de estudiantes
- **Por qué:** El estado agregado puede cambiar si algún estudiante cambia de estado

### Para BUG-019 (Reset ALL):
- **Surface:** `alquimia.list_projection`
- **Cuándo:** Después de `alquimia.reset.all`
- **Por qué:** Todos los estados cambian, proyección debe refrescarse completamente

### Para BUG-020 (EFFECTIVE):
- **Surface:** `alquimia.flotante_students`
- **Cuándo:** Después de cambiar a `view_layer='effective'` o después de limpieza en effective
- **Por qué:** El estado effective debe recalcularse y mostrarse

### Para BUG-021 (Reset EFFECTIVE):
- **Surface:** `alquimia.list_projection` + `alquimia.flotante_students` (si está abierto)
- **Cuándo:** Después de reset desde EFFECTIVE
- **Por qué:** El estado effective cambia, ambas superficies deben actualizarse

### Para BUG-022 (Botones UNA_VEZ):
- **Surface:** `alquimia.list_projection` (si está en proyección)
- **Cuándo:** Después de cualquier acción de limpieza en una_vez
- **Por qué:** Los contadores cambian, la proyección debe refrescarse

---

## 🚦 CLASIFICACIÓN DE PRIORIDAD

### 🔴 BLOCKER (3)
- **BUG-018:** Agregación de Estado ALL Incorrecta (rompe ordenamiento y visualización)
- **BUG-020:** EFFECTIVE No Devuelve state_by_view_layer (rompe vista effective completamente)
- **BUG-023:** Error "vecesLimpiar is not defined" (rompe ejecución)

### 🟠 CRITICAL (4)
- **BUG-019:** Reset ALL No Existe (funcionalidad faltante crítica)
- **BUG-021:** Reset en EFFECTIVE Actúa Sobre Capa Incorrecta (viola regla canónica)
- **BUG-022:** Botones Incorrectos en UNA_VEZ (UX confusa, puede causar errores)

### 🟡 MAJOR (1)
- **BUG-024:** Errores Visibles Sin Mensajes Canónicos (UX pobre, debugging difícil)

---

## 📝 NOTAS ADICIONALES

### Sobre BUG-018:
- La función de agregación debe ser **determinista** y **idempotente**
- La prioridad canónica es **constitucional** y NO debe cambiarse sin aprobación

### Sobre BUG-019:
- Reset ALL es **operación masiva** que puede afectar muchos estudiantes
- Debe tener **confirmación explícita** antes de ejecutar
- Debe generar **logs forenses** de la operación

### Sobre BUG-020:
- EFFECTIVE es **solo proyección**, nunca escritura
- El backend debe calcular effective **siempre** para recurrente, incluso si no se solicita explícitamente

### Sobre BUG-021:
- La regla "effective → pde" es **constitucional** y NO negociable
- El backend debe **validar** esta regla y rechazar requests incorrectos

### Sobre BUG-022:
- Los botones deben validarse **explícitamente** por `item_kind`
- NO confiar en `listaActiva.tipo` sin validar `item.item_kind`

### Sobre BUG-023:
- Buscar **todos los lugares** donde se use `vecesLimpiar` (camelCase)
- Reemplazar por `veces_limpiar` o `required_count` según corresponda

### Sobre BUG-024:
- Los mensajes de error deben ser **localizables** (preparar para i18n)
- Deben incluir **códigos de error** para debugging automatizado

---

**FIN DE AUDITORÍA FUNCIONAL EXTREMA**

**Próximo paso:** Implementar fixes en orden de prioridad (BLOCKER → CRITICAL → MAJOR)
