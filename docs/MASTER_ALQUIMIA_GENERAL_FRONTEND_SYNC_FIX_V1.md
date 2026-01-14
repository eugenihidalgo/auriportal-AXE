# MASTER ALQUIMIA GENERAL — FRONTEND SYNC FIX v1
## Inmediatez UI + Sincronización de Proyección

**Versión:** 1.0  
**Fecha:** 2026-01-13  
**Dominio:** MASTER  
**Pantalla:** `/master/templo-luz/alquimia-general`  
**Commit:** `5c7551c`

---

## 1) CONTEXTO

### Problemas Detectados

Durante el diagnóstico canónico completo de Alquimia General MASTER, se identificaron problemas críticos de sincronización frontend que afectaban la experiencia del Master:

1. **Crear ítems NO actualizaba la UI inmediatamente**
   - Tras crear un ítem (una_vez o recurrente), la UI no reflejaba el cambio
   - Requería refresh manual o cambio de tab/lista para ver el nuevo ítem
   - Generaba confusión: "¿Se creó o no?"

2. **Eliminar ítems NO actualizaba la UI inmediatamente**
   - Tras eliminar un ítem (soft delete), permanecía visible en la UI
   - Requería refresh manual para ver la eliminación
   - Generaba incertidumbre: "¿Se eliminó o no?"

3. **Cambio de lista NO recargaba proyección**
   - Si el Master estaba en modo "Proyección" (con view_layer y scope activos)
   - Al cambiar a otra lista, la proyección no se recargaba
   - Mostraba datos stale de la lista anterior
   - El estado de vista (operativa/proyección, scope, view_layer) se preservaba pero no se honraba

### Impacto en UX y Confianza del Master

**Problemas de confianza:**
- El Master no podía confiar en lo que veía en pantalla
- Acciones (crear/eliminar) no tenían feedback visual inmediato
- Requería refresh manual constante para "estar seguro"

**Problemas de eficiencia:**
- Pérdida de tiempo en refreshes manuales
- Incertidumbre sobre el estado real del sistema
- Necesidad de verificar manualmente cada acción

**Problemas de coherencia:**
- Estado de vista preservado pero no ejecutado
- Datos stale al cambiar de lista
- Desincronización entre estado y visualización

---

## 2) PRINCIPIOS CANÓNICOS APLICADOS

### Mutación → Render Inmediato

**Regla absoluta:**
- Toda mutación exitosa (crear/eliminar) DEBE disparar render inmediato
- No hay excepciones: si se modifica el estado, se re-renderiza
- Sin debounce, sin condiciones: render siempre tras mutación

**Justificación:**
- El Master debe ver el resultado de sus acciones inmediatamente
- La UI es la única fuente de verdad visual para el usuario
- Cualquier retraso genera desconfianza

### Estado Preservado Debe Ejecutarse

**Regla absoluta:**
- Si el estado de vista se preserva (mode, view_layer, scope), debe ejecutarse
- No basta con preservar: hay que honrar el estado
- Si estás en modo "proyección", al cambiar lista se recarga proyección

**Justificación:**
- El estado preservado es una promesa al usuario
- Si se preserva pero no se ejecuta, es peor que resetear
- La coherencia visual es fundamental para la confianza

### Proyección Como Autoridad Visual

**Regla absoluta:**
- En modo "proyección", la proyección es la autoridad visual
- Al cambiar lista, la proyección se recarga automáticamente
- No se renderiza vista operativa si el modo es proyección

**Justificación:**
- El modo activo determina qué se muestra
- La proyección tiene su propio ciclo de datos
- No se puede mezclar datos de proyección con vista operativa

---

## 3) FIXES APLICADOS

### Fix 1: Crear Ítem → Render Inmediato

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Función:** `handleCrearItem()` (línea ~1627)

**Cambio:**
```javascript
// ANTES:
await loadItems(listaId);

// DESPUÉS:
await loadItems(listaId);
// FIX: Render inmediato tras crear ítem
renderView();
```

**Función:** `handleCrearItemInline()` (línea ~3752)

**Cambio:**
```javascript
// ANTES:
await loadItems(state.listaActiva.id);

// DESPUÉS:
await loadItems(state.listaActiva.id);
// FIX: Render inmediato tras crear ítem inline
renderView();
```

**Comportamiento:**
- Tras crear ítem (prompt o inline), se recargan items
- Inmediatamente después, se dispara `renderView()`
- El nuevo ítem aparece en la UI sin necesidad de refresh

### Fix 2: Eliminar Ítem → Render Inmediato

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Función:** `handleEliminarItem()` (línea ~4108)

**Cambio:**
```javascript
// ANTES:
await loadItems(state.listaActiva.id);

// DESPUÉS:
await loadItems(state.listaActiva.id);
// FIX: Render inmediato tras eliminar ítem
renderView();
```

**Comportamiento:**
- Tras eliminar ítem (soft delete), se recargan items
- Inmediatamente después, se dispara `renderView()`
- El ítem eliminado desaparece de la UI sin necesidad de refresh

### Fix 3: Cambio de Lista en Modo Proyección → Recarga Automática

**Archivo:** `public/js/master/master-alquimia-general-client.js`  
**Función:** `selectListAndRender()` (línea ~959)

**Cambio:**
```javascript
// ANTES:
async function selectListAndRender(listId) {
  updateViewState({ list_id: listId });
  await loadLista(listId);
  renderView(); // Siempre renderiza vista operativa
}

// DESPUÉS:
async function selectListAndRender(listId) {
  updateViewState({ list_id: listId });
  await loadLista(listId);
  
  // FIX: Si está en modo proyección, recargar proyección antes de renderizar
  if (state.projection.mode === 'proyeccion') {
    await loadListProjection();
  } else {
    // Render FINAL cuando datos están listos (modo operativa)
    renderView();
  }
}
```

**Comportamiento:**
- Al cambiar lista, se detecta el modo activo
- Si `state.projection.mode === 'proyeccion'`, se recarga proyección
- Si modo operativa, se renderiza vista operativa
- El estado de vista (view_layer, scope) se preserva y se honra

---

## 4) ARCHIVOS Y FUNCIONES MODIFICADAS

### Archivo Principal

**`public/js/master/master-alquimia-general-client.js`**

### Funciones Modificadas

1. **`handleCrearItem(listaId)`** (línea ~1627)
   - Añadido: `renderView()` tras `loadItems()`
   - Propósito: Render inmediato tras crear ítem vía prompt

2. **`handleCrearItemInline(...)`** (línea ~3752)
   - Añadido: `renderView()` tras `loadItems()`
   - Propósito: Render inmediato tras crear ítem inline

3. **`handleEliminarItem(item)`** (línea ~4108)
   - Añadido: `renderView()` tras `loadItems()`
   - Propósito: Render inmediato tras eliminar ítem

4. **`selectListAndRender(listId)`** (línea ~959)
   - Modificado: Lógica condicional para detectar modo proyección
   - Añadido: `await loadListProjection()` si modo es proyección
   - Propósito: Recargar proyección automáticamente al cambiar lista

### Líneas Modificadas

- Línea ~1658: Añadido `renderView()` en `handleCrearItem()`
- Línea ~3793: Añadido `renderView()` en `handleCrearItemInline()`
- Línea ~4128: Añadido `renderView()` en `handleEliminarItem()`
- Líneas ~974-976: Lógica condicional en `selectListAndRender()`

---

## 5) COMPORTAMIENTO ESPERADO

### Inmediatez Absoluta

**Crear ítem:**
- ✅ El ítem aparece inmediatamente en la UI
- ✅ No requiere refresh manual
- ✅ Feedback visual instantáneo

**Eliminar ítem:**
- ✅ El ítem desaparece inmediatamente de la UI
- ✅ No requiere refresh manual
- ✅ Feedback visual instantáneo

### Coherencia Visual

**Cambio de lista en modo proyección:**
- ✅ La proyección se recarga automáticamente
- ✅ El estado de vista (view_layer, scope) se preserva
- ✅ Los datos mostrados corresponden a la lista activa
- ✅ No hay datos stale de listas anteriores

**Cambio de lista en modo operativa:**
- ✅ La vista operativa se renderiza normalmente
- ✅ Los items se cargan y muestran correctamente
- ✅ No hay interferencia con modo proyección

### Confianza Total

**El Master puede:**
- ✅ Confiar en lo que ve en pantalla
- ✅ Ver resultados inmediatos de sus acciones
- ✅ Cambiar de lista sin perder contexto
- ✅ Trabajar sin necesidad de refreshes manuales

---

## 6) QUÉ NO SE HA TOCADO

### Algoritmo Backend de Proyección ALL

**NO modificado:**
- `src/core/master/services/list-projection-model.js`
- Función `getCleaningStatesForItems()` (scope='all')
- Algoritmo que usa `MAX()` en lugar de lógica de peor estado

**Razón:**
- Este fix es exclusivamente frontend
- El algoritmo backend requiere rediseño canónico (ver Próximo Paso)

### Contratos API

**NO modificados:**
- Endpoints `/master/api/alquimia-general/*`
- Payloads de request/response
- Validaciones backend

**Razón:**
- Los fixes son de sincronización frontend
- No se requieren cambios en contratos API

### Modelo de Datos

**NO modificado:**
- Tablas PostgreSQL
- Estructura de `state` en frontend
- Proyecciones de datos

**Razón:**
- Los fixes son de renderizado y sincronización
- No se requieren cambios en modelo de datos

---

## 7) PRÓXIMO PASO IDENTIFICADO

### Rediseño Canónico del Algoritmo de Proyección ALL

**Problema identificado:**
- El algoritmo actual usa `MAX(shared_last_cleaned_at)` que toma el **mejor** estado
- La regla canónica requiere mostrar el **peor** estado (menos trabajado)

**Archivo afectado:**
- `src/core/master/services/list-projection-model.js`
- Función `getCleaningStatesForItems()` (línea ~193-249)

**Cambio requerido:**
- Rediseñar algoritmo para scope='all'
- En lugar de `MAX()`, calcular el peor estado entre todos los estudiantes
- Aplicar lógica de "menos trabajado" como regla canónica

**Referencia:**
- Ver diagnóstico completo: `DIAGNOSTICO_CANONICO_COMPLETO_ALQUIMIA_GENERAL.md`
- Sección D: "DIAGNÓSTICO 3 — PROYECCIÓN ALL (REGLA DEL 'MENOS TRABAJADO')"

---

## 8) REFERENCIAS CRUZADAS

### Documentación Relacionada

- **Diagnóstico completo:** `DIAGNOSTICO_CANONICO_COMPLETO_ALQUIMIA_GENERAL.md`
- **List Projection Model:** `docs/LIST_PROJECTION_MODEL_V1.md`
- **Cleaning Projection Model:** `docs/CLEANING_PROJECTION_MODEL_V1.md`
- **View Authority:** `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md`

### Commits Relacionados

- **Commit de fixes:** `5c7551c` - `fix(master-alquimia): immediate ui updates + projection sync on list change`

### Archivos Relacionados

- `public/js/master/master-alquimia-general-client.js` (cliente frontend)
- `src/endpoints/master-api-alquimia-general.js` (endpoints API)
- `src/core/master/services/list-projection-model.js` (modelo de proyección)

---

## 9) VERIFICACIÓN POST-FIX

### Checklist de Verificación

- ✅ Crear ítem (una_vez) → aparece inmediatamente sin refresh
- ✅ Crear ítem (recurrente) → aparece inmediatamente sin refresh
- ✅ Eliminar ítem → desaparece inmediatamente sin refresh
- ✅ Cambiar lista en modo proyección → proyección se recarga automáticamente
- ✅ Cambiar lista en modo operativa → vista operativa se renderiza correctamente
- ✅ Estado de vista (view_layer, scope) se preserva y honra
- ✅ No hay errores nuevos en consola
- ✅ No hay renders duplicados

### Métricas de Éxito

**Antes del fix:**
- ❌ Crear ítem requería refresh manual
- ❌ Eliminar ítem requería refresh manual
- ❌ Cambio de lista mostraba datos stale
- ❌ Estado preservado no se ejecutaba

**Después del fix:**
- ✅ Crear ítem es inmediato
- ✅ Eliminar ítem es inmediato
- ✅ Cambio de lista recarga proyección automáticamente
- ✅ Estado preservado se honra y ejecuta

---

## 10) CONCLUSIÓN

Los fixes aplicados resuelven completamente los problemas de sincronización frontend identificados en el diagnóstico canónico. La UI ahora es:

- **Inmediata:** Feedback visual instantáneo tras mutaciones
- **Coherente:** Estado preservado se honra y ejecuta
- **Confiable:** El Master puede confiar en lo que ve

**Próximo paso:** Rediseñar algoritmo backend de proyección ALL para cumplir regla canónica de "menos trabajado".

---

**Fin de la documentación.**
