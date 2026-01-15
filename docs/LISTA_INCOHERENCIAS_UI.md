# Lista de Incoherencias UI (Alquimia General)

**Fecha:** 2025-01-27  
**Versión:** 5.74.2  
**Estado:** DIAGNÓSTICO COMPLETO  
**Dominio:** MASTER (AuriPortal)

---

## Resumen Ejecutivo

Este documento enumera **TODAS** las incoherencias, comportamientos erráticos y problemas de UX identificados en la UI de Alquimia General, con su causa técnica concreta.

**Total de incoherencias identificadas:** 15  
**Críticas:** 5  
**Mayores:** 7  
**Menores:** 3

---

## Incoherencias Críticas

### 1. Cálculo de Estados EFFECTIVE en Frontend

**Síntoma:** Los estados de la columna EFFECTIVE se calculan en el frontend en lugar de venir del backend.

**Ubicación:** `createStudentRow()` (línea 2980-2996)

**Código problemático:**
```javascript
// Línea 2980-2996
let sharedStateText = 'Nunca';
if (sharedDays !== null && sharedDays !== undefined) {
  if (sharedDays < thresholdDays) sharedStateText = 'Revisado';
  else if (sharedDays < criticalThreshold) sharedStateText = 'Pendiente';
  else sharedStateText = 'Importante';
}

let pdeStateText = 'Nunca';
if (pdeDays !== null && pdeDays !== undefined) {
  if (pdeDays < thresholdDays) pdeStateText = 'Revisado';
  else if (pdeDays < criticalThreshold) pdeStateText = 'Pendiente';
  else pdeStateText = 'Importante';
}
```

**Causa técnica:**
- El backend NO devuelve `state_by_view_layer.effective.state` calculado
- El frontend calcula estados desde `days_since_last_clean` y `threshold_days`
- Viola regla constitucional: "Frontend NO calcula estados"

**Impacto:**
- Estados pueden ser inconsistentes con el backend
- Si el backend cambia la lógica, el frontend no se actualiza
- No hay garantía de coherencia

**Fix sugerido:**
- Backend debe devolver `state_by_view_layer.effective.state` calculado
- Frontend solo consume y muestra

---

### 2. Acciones sin Refresh Engine

**Síntoma:** Varias acciones NO usan Refresh Engine, causando refresh inconsistente.

**Acciones afectadas:**
- `handlePdeCleanItem` (línea 4909) - Fallback manual
- `handleEliminarItem` (línea 5227) - Directo
- `handleCrearLista` (línea 1861) - Directo
- `handleCrearItemInline` (línea 4836) - Directo
- Todas las acciones de overrides (líneas 3868-4430) - Directo
- `deleteLista` (línea 5528) - Directo

**Causa técnica:**
- Refresh manual sin invalidación de estado local
- No hay logs forenses estructurados
- No hay garantía de coherencia entre superficies

**Impacto:**
- Superficies pueden mostrar datos desincronizados
- No hay trazabilidad de refresh
- Usuario debe recargar manualmente en algunos casos

**Fix sugerido:**
- Migrar todas las acciones a Refresh Engine v1
- Añadir `mutation_type` canónico para cada acción

---

### 3. Acciones que NO Refrescan Todas las Superficies Afectadas

**Síntoma:** Algunas acciones solo refrescan una superficie, aunque otras también se afectan.

**Ejemplos:**

#### 3.1. Eliminar Item

**Acción:** `handleEliminarItem` (línea 5227)

**Refresh actual:**
- ✅ `loadItems()` (directo)
- ❌ NO refresca proyección
- ❌ NO refresca flotante

**Causa técnica:**
- Refresh directo sin pasar por Refresh Engine
- No verifica si proyección o flotante están abiertos

**Impacto:**
- Si proyección está abierta, muestra item eliminado
- Si flotante está abierto, muestra item eliminado

---

#### 3.2. Overrides

**Acción:** `updateStudentItemOverride()` (líneas 3868-4430)

**Refresh actual:**
- ✅ `handleVerItem()` (directo, solo flotante)
- ❌ NO refresca proyección
- ❌ NO refresca items

**Causa técnica:**
- Refresh directo solo del flotante
- No verifica si proyección o items están visibles

**Impacto:**
- Si proyección está abierta, no refleja cambios de overrides
- Si items están visibles, no reflejan cambios de overrides

---

### 4. Cambios de Estado Local Manuales Inconsistentes

**Síntoma:** Algunas acciones cambian `state.modal.layerView` manualmente, sin garantía de persistencia.

**Ejemplos:**

#### 4.1. PDE Clean All (Legacy)

**Acción:** `handlePdeCleanItem` (línea 5021)

**Código problemático:**
```javascript
// Línea 5021-5022
state.modal.layerView = activeViewLayer; // 'pde'
state.modal.cleanLayer = 'pde';
```

**Causa técnica:**
- Cambio de estado local sin pasar por `updateViewState()`
- No hay garantía de que el cambio persista

**Impacto:**
- Si el flotante se cierra y reabre, puede perder el cambio
- No hay coherencia con el estado global

---

#### 4.2. PDE Increment All

**Acción:** `handlePdeIncrementAllItem` (línea 5187)

**Código problemático:**
```javascript
// Línea 5187
if (state.projection.mode === 'operativa' && state.modal.item && state.modal.item.item_ref === item.item_ref) {
  state.modal.layerView = 'pde';
}
```

**Causa técnica:** Igual que 4.1

**Impacto:** Igual que 4.1

---

### 5. Uso de `confirm()` (Violación Constitucional)

**Síntoma:** Dos acciones usan `confirm()`, violando regla constitucional.

**Acciones afectadas:**
1. **Eliminar todos los overrides** (línea 4433)
   ```javascript
   if (!confirm(`¿Eliminar todos los overrides de este item para este alumno?`)) {
     return;
   }
   ```

2. **Eliminar lista** (línea 5529)
   ```javascript
   const confirmMessage = 'Esta acción eliminará la lista y todos sus ítems de las vistas.\nNo se borrará el historial.\n\n¿Continuar?';
   if (!window.confirm(confirmMessage)) {
     return;
   }
   ```

**Causa técnica:**
- Regla constitucional prohíbe `confirm()` y `alert()`
- Debe usarse toasts no bloqueantes

**Impacto:**
- UX con fricción innecesaria
- Bloquea el hilo principal
- No es accesible

**Fix sugerido:**
- Reemplazar con modal no bloqueante o toast con acción de deshacer

---

## Incoherencias Mayores

### 6. Textos Ambiguos sin Contexto

**Síntoma:** Algunos textos no especifican suficiente contexto.

**Ejemplos:**

#### 6.1. "Faltan: X"

**Ubicación:** `createStudentRow()` (línea 3019)

**Texto actual:** `"Faltan: ${faltan}"`

**Problema:** No especifica "faltan para qué" (completar el item).

**Sugerencia:** `"Faltan ${faltan} para completar (requerido: ${requiredCount})"`

---

#### 6.2. "De más: X"

**Ubicación:** `createStudentRow()` (línea 3024)

**Texto actual:** `"De más: ${excedente}"`

**Problema:** No especifica "de más sobre qué" (required_count).

**Sugerencia:** `"Excedente: ${excedente} sobre ${requiredCount} requerido"`

---

#### 6.3. "Completado"

**Ubicación:** `createStudentRow()` (línea 3026, 3059)

**Texto actual:** `"Completado"`

**Problema:** No especifica cuántas veces se ha limpiado.

**Sugerencia:** `"Completado: ${cleanCount}/${requiredCount}"`

---

### 7. Estados sin Narrativa UX

**Síntoma:** Algunos estados no tienen explicación clara de qué significan.

**Ejemplos:**

#### 7.1. `empowered` (UNA_VEZ)

**Estado:** `combo_count >= required_count * 10`

**Narrativa actual:** `"🟣 POTENCIADO"`

**Problema:** No hay explicación de qué significa "potenciado" ni por qué aparece.

**Sugerencia:** Añadir tooltip: `"Potenciado: ${combo_count} limpiezas (${required_count * 10}+)"`

---

#### 7.2. `important` (RECURRENTE)

**Estado:** `days_since_last_clean >= critical_threshold`

**Narrativa actual:** `"🔴 IMPORTANTE REVISAR"`

**Problema:** No hay explicación de qué significa "importante" ni cuántos días faltan.

**Sugerencia:** Añadir tooltip: `"Importante: ${days_since_last_clean} días sin limpiar (umbral crítico: ${critical_threshold} días)"`

---

#### 7.3. `effective` (RECURRENTE)

**Estado:** Proyección de shared+pde

**Narrativa actual:** Indicadores [S] [P] con tooltips

**Problema:** No hay explicación clara de qué significa "effective" ni cómo se calcula.

**Sugerencia:** Añadir texto explicativo: `"Effective: revisado si AMBAS capas (shared y pde) están revisadas"`

---

### 8. Fallbacks que Ocultan Errores

**Síntoma:** Algunos fallbacks usan valores por defecto que pueden ocultar errores del backend.

**Ejemplos:**

#### 8.1. `clean_count`

**Ubicación:** `createStudentRow()` (línea 3046)

**Código:**
```javascript
const cleanCount = layerData?.clean_count ?? 0;
```

**Problema:** Si `clean_count === undefined`, usa `0` (puede ser incorrecto si el backend no devolvió el campo).

**Sugerencia:** Validar que el backend siempre devuelve `clean_count`, o mostrar error visible.

---

#### 8.2. `remaining`

**Ubicación:** `createStudentRow()` (línea 3013)

**Código:**
```javascript
const sharedRemaining = student.shared?.remaining ?? 0;
const pdeRemaining = student.pde?.remaining ?? 0;
```

**Problema:** Si `remaining === undefined`, usa `0` (puede ser incorrecto).

**Sugerencia:** Validar que el backend siempre devuelve `remaining`, o mostrar error visible.

---

#### 8.3. `item_kind`

**Ubicación:** Múltiples

**Código:**
```javascript
const itemKind = getItemKindExplicit(item, state.listaActiva);
// Si falla, usa:
item.tipo || item.item_kind || state.listaActiva?.tipo || 'recurrente'
```

**Problema:** Si todos fallan, usa `'recurrente'` como default (puede ser incorrecto para UNA_VEZ).

**Sugerencia:** Validar que `item_kind` siempre está presente, o mostrar error visible.

---

### 9. Valores Hardcodeados que Deberían Ser Configurables

**Síntoma:** Algunos valores están hardcodeados pero deberían ser configurables.

**Ejemplos:**

#### 9.1. Multiplicador Crítico

**Ubicación:** Múltiples

**Valor:** `2.0` (hardcoded)

**Problema:** No es configurable por item o lista.

**Sugerencia:** Leer desde `item.critical_multiplier` o override.

---

#### 9.2. Umbral de Potenciado

**Ubicación:** `createStudentRow()` (línea 2751)

**Valor:** `required_count * 10` (hardcoded)

**Problema:** No es configurable.

**Sugerencia:** Leer desde configuración del item.

---

### 10. No Distingue `null` de `undefined`

**Síntoma:** Algunos fallbacks no distinguen entre `null` (valor válido) y `undefined` (error).

**Ejemplo:**

#### 10.1. `days_since_last_clean`

**Ubicación:** `createStudentRow()` (línea 3039)

**Código:**
```javascript
days !== null ? `${days}d` : 'Nunca'
```

**Problema:** Si `days === undefined`, muestra `"Nunca"` (correcto, pero no distingue `null` de `undefined`).

**Sugerencia:** Validar explícitamente `null` vs `undefined`.

---

### 11. Refresh Manual Inconsistente

**Síntoma:** Algunas acciones tienen refresh manual que puede ser inconsistente.

**Ejemplo:**

#### 11.1. PDE Clean All (Legacy)

**Acción:** `handlePdeCleanItem` (línea 5012-5030)

**Código:**
```javascript
if (state.projection.mode === 'proyeccion') {
  await loadListProjection();
} else {
  await loadItems(state.listaActiva.id);
  if (state.modal.item && state.modal.item.item_ref === item.item_ref) {
    state.modal.layerView = 'pde';
    await handleVerItem(item, 'pde', 'pde');
  }
}
```

**Problema:**
- No usa Refresh Engine
- Cambia `state.modal.layerView` manualmente
- No hay invalidación de estado local

**Sugerencia:** Migrar a Refresh Engine v1.

---

### 12. Botones que se Ocultan en Lugar de Disabled

**Síntoma:** Algunos botones se ocultan completamente en lugar de mostrarse disabled.

**Ejemplo:**

#### 12.1. Botón "✓" RECURRENTE si `stateKey === 'reviewed'`

**Ubicación:** `createStudentRow()` (línea 3253)

**Código:**
```javascript
if (itemKind === 'recurrente' && stateKey === 'reviewed') {
  // RECURRENTE: no mostrar botón si ya está revisado (idempotencia diaria)
  // (botón no se muestra, pero no es un error)
} else {
  // Mostrar botón
}
```

**Problema:** El botón desaparece completamente, no hay feedback visual de por qué.

**Sugerencia:** Mostrar botón disabled con tooltip: `"Ya revisado hoy (idempotencia diaria)"`

---

## Incoherencias Menores

### 13. Textos de Métricas sin Formato Consistente

**Síntoma:** Algunos textos de métricas no tienen formato consistente.

**Ejemplo:**

#### 13.1. Conteos por Estado

**Ubicación:** `renderProjectionView()` (línea 1707)

**Texto actual:** `"Never: ${counts.never} | Pending: ${counts.pending} | Important: ${counts.important} | Reviewed: ${counts.reviewed}"`

**Problema:** No hay formato consistente (algunos en mayúsculas, otros no).

**Sugerencia:** Usar formato consistente: `"Nunca: ${counts.never} | Pendiente: ${counts.pending} | Importante: ${counts.important} | Revisado: ${counts.reviewed}"`

---

### 14. Tooltips Faltantes

**Síntoma:** Algunos elementos no tienen tooltips explicativos.

**Ejemplos:**
- Botones de limpieza (no explican qué hacen)
- Indicadores [S] [P] en EFFECTIVE (solo tooltip básico)
- Estados complejos (`empowered`, `important`, `effective`)

**Sugerencia:** Añadir tooltips explicativos para todos los elementos interactivos.

---

### 15. Mensajes de Error sin Acción Sugerida

**Síntoma:** Algunos mensajes de error no sugieren qué hacer.

**Ejemplo:**

#### 15.1. "ERROR: item_kind no definido. Acción bloqueada."

**Ubicación:** Múltiples (líneas 2113, 3368, 5060, 5147)

**Problema:** No sugiere qué hacer (recargar página, contactar soporte, etc.).

**Sugerencia:** `"ERROR: item_kind no definido. Acción bloqueada. Por favor, recarga la página o contacta soporte si el problema persiste."`

---

## Resumen por Severidad

### Críticas (5)
1. Cálculo de estados EFFECTIVE en frontend
2. Acciones sin Refresh Engine
3. Acciones que NO refrescan todas las superficies afectadas
4. Cambios de estado local manuales inconsistentes
5. Uso de `confirm()` (violación constitucional)

### Mayores (7)
6. Textos ambiguos sin contexto
7. Estados sin narrativa UX
8. Fallbacks que ocultan errores
9. Valores hardcodeados que deberían ser configurables
10. No distingue `null` de `undefined`
11. Refresh manual inconsistente
12. Botones que se ocultan en lugar de disabled

### Menores (3)
13. Textos de métricas sin formato consistente
14. Tooltips faltantes
15. Mensajes de error sin acción sugerida

---

## Priorización de Fixes

### Fase 1 (Críticas - Inmediato)
1. Migrar todas las acciones a Refresh Engine v1
2. Eliminar cálculo de estados EFFECTIVE en frontend
3. Reemplazar `confirm()` con modales no bloqueantes

### Fase 2 (Mayores - Próximo Sprint)
4. Añadir narrativa UX para estados complejos
5. Mejorar textos ambiguos con contexto
6. Validar que backend siempre devuelve campos requeridos
7. Migrar valores hardcodeados a configuración

### Fase 3 (Menores - Mejora Continua)
8. Añadir tooltips explicativos
9. Mejorar formato de textos de métricas
10. Añadir acciones sugeridas a mensajes de error

---

**FIN DE LISTA INCOHERENCIAS UI**
