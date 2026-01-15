# Mapa de Estados y Textos UI (Alquimia General)

**Fecha:** 2025-01-27  
**Versión:** 5.74.2  
**Estado:** DIAGNÓSTICO COMPLETO  
**Dominio:** MASTER (AuriPortal)

---

## Resumen Ejecutivo

Este documento mapea **TODOS** los estados posibles de items/alumnos, sus textos asociados en la UI, y los contextos donde aparecen.

**Total de estados identificados:** 8  
**Total de textos únicos:** 15+  
**Total de contextos:** 3 (RECURRENTE, UNA_VEZ, EFFECTIVE)

---

## Estados por item_kind

### RECURRENTE

**Estados posibles:**
1. `never` - Nunca limpiado
2. `reviewed` - Revisado (dentro de threshold)
3. `pending` - Pendiente (entre threshold y critical)
4. `important` - Importante (más allá de critical)

**Fuente de verdad:** `state_by_view_layer[view_layer].state`

---

### UNA_VEZ

**Estados posibles:**
1. `never` - Nunca limpiado (total_clean_count = 0)
2. `in_progress` - En proceso (0 < combo_count < required_count)
3. `completed` - Completado (combo_count >= required_count && combo_count < required_count * 10)
4. `empowered` - Potenciado (combo_count >= required_count * 10)

**Fuente de verdad:** `state_by_view_layer[view_layer].visual_state`

---

## Textos por Estado y Contexto

### RECURRENTE - Columna SHARED/PDE

| Estado | Texto en Columna | Texto en Fila | Color | Ubicación |
|--------|------------------|---------------|-------|-----------|
| `never` | `"⚪ NUNCA"` | `"Nunca"` | Gris (#cbd5e1) | Flotante (línea 2732) |
| `reviewed` | `"🟢 REVISADO"` | `"Revisado"` | Verde (#86efac) | Flotante (línea 2720) |
| `pending` | `"🟡 PENDIENTE"` | `"Pendiente"` | Amarillo (#fde047) | Flotante (línea 2724) |
| `important` | `"🔴 IMPORTANTE REVISAR"` | `"Importante"` | Rojo (#fca5a5) | Flotante (línea 2728) |

**Código:**
```javascript
// Línea 3307-3310
const stateTexts = {
  'never': 'Nunca',
  'reviewed': 'Revisado',
  'pending': 'Pendiente',
  'important': 'Importante'
};
```

---

### RECURRENTE - Columna EFFECTIVE

| Estado | Texto en Columna | Texto en Fila | Color | Indicadores |
|--------|------------------|---------------|-------|-------------|
| `never` | `"⚪ NUNCA"` | `"Nunca"` | Gris | [S] [P] (ambos grises) |
| `reviewed` | `"🟢 REVISADO"` | `"✓ Revisado"` | Verde | [S] [P] (ambos verdes) |
| `pending` | `"🟡 PENDIENTE"` | `"Pendiente"` | Amarillo | [S] [P] (según effective_sources) |
| `important` | `"🔴 IMPORTANTE REVISAR"` | `"Importante"` | Rojo | [S] [P] (según effective_sources) |

**Indicadores [S] [P]:**
- Verde (#10b981) si `effective_sources.shared === true` o `effective_sources.pde === true`
- Gris (#64748b) si `false`

**Código:**
```javascript
// Línea 2918-2945
if (layerView === 'effective') {
  const effectiveSources = effectiveStateData?.effective_sources || { shared: false, pde: false };
  // Renderizar [S] y [P] según effectiveSources
}
```

---

### UNA_VEZ - Columna COMBO

| Estado | Texto en Columna | Texto en Fila | Color | Ubicación |
|--------|------------------|---------------|-------|-----------|
| `never` | `"⚪ NUNCA"` | `"Nunca"` | Gris | Flotante (línea 2739) |
| `in_progress` | `"🟡 EN PROCESO"` | `"En proceso"` | Amarillo | Flotante (línea 2743) |
| `completed` | `"✅ COMPLETADO"` | `"Completado"` | Verde | Flotante (línea 2747) |
| `empowered` | `"🟣 POTENCIADO"` | `"Potenciado"` | Violeta | Flotante (línea 2751) |

**Código:**
```javascript
// Línea 3315-3320
const visualStateTexts = {
  'never': 'Nunca',
  'in_progress': 'En proceso',
  'completed': 'Completado',
  'empowered': 'Potenciado'
};
```

---

### UNA_VEZ - Columna SHARED/PDE

| Estado | Texto en Columna | Texto en Fila | Color | Ubicación |
|--------|------------------|---------------|-------|-----------|
| `never` | `"⚪ NUNCA"` | `"Nunca"` | Gris | Flotante (línea 2739) |
| `in_progress` | `"🟡 EN PROCESO"` | `"En proceso"` | Amarillo | Flotante (línea 2743) |
| `completed` | `"✅ COMPLETADO"` | `"Completado"` | Verde | Flotante (línea 2747) |
| `empowered` | `"🟣 POTENCIADO"` | `"Potenciado"` | Violeta | Flotante (línea 2751) |

**Nota:** Mismo texto que COMBO, pero calculado desde `shared` o `pde` individual.

---

## Textos de Métricas (Proyección)

### Métricas Agregadas

**Ubicación:** `renderProjectionView()` (línea 1700)

| Métrica | Texto | Formato |
|---------|-------|---------|
| `reviewed_pct` | `"Revisado: ${(reviewed_pct * 100).toFixed(1)}%"` | Porcentaje |
| `by_state_counts` | `"Never: ${counts.never} \| Pending: ${counts.pending} \| Important: ${counts.important} \| Reviewed: ${counts.reviewed}"` | Conteos |

**Código:**
```javascript
// Línea 1701
reviewedPct.textContent = `Revisado: ${(state.projection.data.metrics.reviewed_pct * 100).toFixed(1)}%`;

// Línea 1707
countsText.textContent = `Never: ${counts.never} | Pending: ${counts.pending} | Important: ${counts.important} | Reviewed: ${counts.reviewed}`;
```

---

## Textos de "Restantes" (Flotante)

### RECURRENTE - SHARED/PDE

**Ubicación:** `createStudentRow()` (línea 3038)

| Estado | Texto | Formato |
|--------|-------|---------|
| `never` | `"Nunca"` | String literal |
| `reviewed` | `"${days}d"` | Días desde última limpieza |
| `pending` | `"${days}d"` | Días desde última limpieza |
| `important` | `"${days}d"` | Días desde última limpieza |

**Código:**
```javascript
// Línea 3039-3042
if (itemKind === 'recurrente') {
  const days = layerView === 'pde' 
    ? (student.pde?.days_since_last_clean)
    : (student.shared?.days_since_last_clean);
  remainingDiv.textContent = days !== null ? `${days}d` : 'Nunca';
}
```

---

### RECURRENTE - COMBO

**Ubicación:** `createStudentRow()` (línea 3029)

| Estado | Texto | Formato |
|--------|-------|---------|
| Cualquiera | `"S:${sharedDays}d \| P:${pdeDays}d"` | Ambos días |

**Código:**
```javascript
// Línea 3030-3035
const sharedDays = student.shared?.days_since_last_clean;
const pdeDays = student.pde?.days_since_last_clean;
const sharedText = sharedDays !== null ? `${sharedDays}d` : 'Nunca';
const pdeText = pdeDays !== null ? `${pdeDays}d` : 'Nunca';
remainingDiv.textContent = `S:${sharedText} | P:${pdeText}`;
```

---

### RECURRENTE - EFFECTIVE

**Ubicación:** `createStudentRow()` (línea 2980-2996)

| Estado | Texto | Formato |
|--------|-------|---------|
| Cualquiera | `"S: ${sharedStateText} \| P: ${pdeStateText}"` | Ambos estados calculados |

**Código:**
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

stateDiv.textContent = `S: ${sharedStateText} | P: ${pdeStateText}`;
```

**⚠️ PROBLEMA:** Calcula estados en frontend (debería venir del backend).

---

### UNA_VEZ - SHARED/PDE

**Ubicación:** `createStudentRow()` (línea 3044)

| Estado | Texto | Formato |
|--------|-------|---------|
| `never` / `in_progress` | `"Faltan: ${faltan}"` | Faltan para completar |
| `completed` | `"Completado"` | String literal |
| `empowered` | `"De más: ${excedente}"` | Excedente sobre required |

**Código:**
```javascript
// Línea 3044-3062
if (cleanCount < requiredCount) {
  const faltan = requiredCount - cleanCount;
  remainingDiv.textContent = `Faltan: ${faltan}`;
} else {
  const excedente = cleanCount - requiredCount;
  if (excedente > 0) {
    remainingDiv.textContent = `De más: ${excedente}`;
  } else {
    remainingDiv.textContent = 'Completado';
  }
}
```

---

### UNA_VEZ - COMBO

**Ubicación:** `createStudentRow()` (línea 3009)

| Estado | Texto | Formato |
|--------|-------|---------|
| `never` / `in_progress` | `"Faltan: ${faltan} (S:${sharedRemaining} P:${pdeRemaining})"` | Faltan + breakdown |
| `completed` | `"Completado (S:${sharedRemaining} P:${pdeRemaining})"` | Completado + breakdown |
| `empowered` | `"De más: ${excedente} (S:${sharedRemaining} P:${pdeRemaining})"` | Excedente + breakdown |

**Código:**
```javascript
// Línea 3009-3028
if (comboCleanCount < requiredCount) {
  const faltan = requiredCount - comboCleanCount;
  remainingDiv.textContent = `Faltan: ${faltan} (S:${sharedRemaining} P:${pdeRemaining})`;
} else {
  const excedente = comboCleanCount - requiredCount;
  if (excedente > 0) {
    remainingDiv.textContent = `De más: ${excedente} (S:${sharedRemaining} P:${pdeRemaining})`;
  } else {
    remainingDiv.textContent = `Completado (S:${sharedRemaining} P:${pdeRemaining})`;
  }
}
```

---

## Textos de Botones

### Botones de Limpieza

| Contexto | Texto | Ubicación |
|----------|-------|-----------|
| UNA_VEZ SHARED/PDE | `"+1"` | Línea 3260 |
| UNA_VEZ COMBO Shared | `"S +1"` | Línea 3074 |
| UNA_VEZ COMBO PDE | `"P +1"` | Línea 3082 |
| UNA_VEZ COMBO Ambos | `"S+P"` | Línea 3090 |
| RECURRENTE SHARED/PDE | `"✓"` | Línea 3260 |
| RECURRENTE COMBO Shared | `"S ✓"` | Línea 3119 |
| RECURRENTE COMBO PDE | `"P ✓"` | Línea 3127 |
| RECURRENTE COMBO Ambos | `"S+P"` | Línea 3135 |
| RECURRENTE EFFECTIVE Shared | `"S"` | Línea 3173 |
| RECURRENTE EFFECTIVE PDE | `"P"` | Línea 3190 |
| RECURRENTE EFFECTIVE Ambos | `"S+P"` | Línea 3207 |
| RECURRENTE EFFECTIVE Revisado | `"✓ Revisado"` (texto, no botón) | Línea 3245 |

---

## Textos de Feedback (Toasts)

### Éxito

| Acción | Texto | Ubicación |
|--------|-------|-----------|
| Limpiar estudiante | `"✓ ${displayName} limpiado"` | Línea 3478 |
| Limpiar item (all) | `"✅ Item limpiado para ${updated} alumnos"` | Línea 2153 |
| Increment all | `"Item incrementado para ${updated} alumnos"` | Línea 5085 |
| PDE increment all | `"PDE registrado: ${updated} alumnos"` | Línea 5178 |
| Reset item | `"Reset completado (${applied} aplicado, ${skipped} omitido)"` | Línea 4476 |
| Reset lista | `"Reset completado (${applied} items, ${skipped} omitidos)"` | Línea 1589 |
| Override guardado | `"Override de ${key} guardado"` | Líneas 3914, 4067, 4214, 4317 |
| Override eliminado | `"Override eliminado (valor vuelve al base)"` | Líneas 3904, 4057, 4204, 4307 |
| Eliminar overrides | `"${deletedCount} override(s) eliminado(s)"` | Línea 4439 |
| Eliminar lista | `"✓ Lista eliminada correctamente"` | Línea 5555 |
| S+P aplicados | `"✓ SHARED y PDE aplicados"` | Líneas 3100, 3145, 3226 |

---

### Error

| Acción | Texto | Ubicación |
|--------|-------|-----------|
| Item sin item_ref | `"ERROR: Item sin item_ref. Acción bloqueada."` | Líneas 2091, 2121, 5046 |
| clean_layer inválido | `"ERROR: clean_layer no definido. Acción bloqueada."` | Líneas 2100, 3351 |
| item_kind inválido | `"ERROR: item_kind no definido. Acción bloqueada."` | Líneas 2113, 3368, 5060, 5147 |
| Datos incompletos | `"ERROR: Datos incompletos. Acción bloqueada."` | Línea 3344 |
| HTTP Error | `"ERROR HTTP ${status}: ${statusText}. Trace en consola."` | Línea 3457 |
| Backend Error | `"ERROR: ${errorMsg} (trace_id=${traceId})"` | Línea 3471 |
| SHARED falló, PDE no ejecutado | `"❌ SHARED falló: ${error.message}. PDE no ejecutado."` | Líneas 3105, 3150, 3231 |
| SHARED OK, PDE falló | `"✓ SHARED aplicado, pero PDE falló: ${error.message}"` | Líneas 3102, 3147, 3228 |

---

### Warning

| Acción | Texto | Ubicación |
|--------|-------|-----------|
| Limpiar item (0 actualizados) | `"⚠️ 0 actualizados; ${reasons.join(', ')}"` | Línea 2163 |
| PDE clean all (0 actualizados) | `"⚠️ PDE: 0 actualizados; ${reasons.join(', ')}"` | Línea 4995 |
| Nivel inválido | `"nivel debe ser entre 1 y 9"` | Línea 3888 |
| Nombre vacío | `"El nombre no puede estar vacío"` | Línea 3986 |
| threshold_days inválido | `"threshold_days debe ser >= 1"` | Línea 4191 |
| required_count inválido | `"required_count debe ser >= 0"` | Línea 4294 |
| veces_limpiar inválido | `"veces_limpiar debe ser >= 0"` | Línea 4335 |
| Crear item (nombre requerido) | `"El nombre es requerido"` | Línea 4676 |
| Crear item (nivel inválido) | `"El nivel debe ser entre 1 y 9"` | Línea 4682 |

---

## Textos de "NO APLICA"

### Sección NO APLICA (Nivel)

**Ubicación:** `showFlotanteVer()` (línea 2757)

| Texto | Formato |
|-------|---------|
| Header | `"⚠️ NO APLICA (nivel) (${count})"` |
| Fila estudiante | `"${displayName} (nivel ${nivel_efectivo} < item nivel ${item_nivel})"` |

**Código:**
```javascript
// Línea 2766
noAplicaTitle.textContent = `⚠️ NO APLICA (nivel) (${studentsNoAplica.length})`;

// Línea 2788
studentDiv.textContent = `${student.display_name || ...} (nivel ${student.nivel_efectivo || '?'} < item nivel ${student.item_nivel || '?'})`;
```

---

## Casos donde aparece `undefined` o valores no normalizados

### 1. display_name

**Ubicación:** Múltiples (líneas 2911, 2788, 3425)

**Fallback:**
```javascript
student.display_name || student.student_name || student.student_email || 'Sin nombre'
```

**Problema:** Si todos son `undefined`, muestra `"Sin nombre"` (no es error, pero puede ser confuso).

---

### 2. days_since_last_clean

**Ubicación:** `createStudentRow()` (línea 3039)

**Fallback:**
```javascript
days !== null ? `${days}d` : 'Nunca'
```

**Problema:** Si `days === undefined`, muestra `"Nunca"` (correcto, pero no distingue `null` de `undefined`).

---

### 3. clean_count

**Ubicación:** `createStudentRow()` (línea 3046)

**Fallback:**
```javascript
const cleanCount = layerData?.clean_count ?? 0;
```

**Problema:** Si `clean_count === undefined`, usa `0` (puede ser incorrecto si el backend no devolvió el campo).

---

### 4. remaining

**Ubicación:** `createStudentRow()` (línea 3013)

**Fallback:**
```javascript
const sharedRemaining = student.shared?.remaining ?? 0;
const pdeRemaining = student.pde?.remaining ?? 0;
```

**Problema:** Si `remaining === undefined`, usa `0` (puede ser incorrecto).

---

### 5. item_kind

**Ubicación:** Múltiples

**Fallback:**
```javascript
const itemKind = getItemKindExplicit(item, state.listaActiva);
// Si falla, usa:
item.tipo || item.item_kind || state.listaActiva?.tipo || 'recurrente'
```

**Problema:** Si todos fallan, usa `'recurrente'` como default (puede ser incorrecto para UNA_VEZ).

---

### 6. required_count

**Ubicación:** Múltiples

**Fallback:**
```javascript
const requiredCount = normalized.required_count || normalized.veces_limpiar || item.veces_limpiar || 1;
```

**Problema:** Si todos son `undefined`, usa `1` (puede ser incorrecto).

---

## Estados sin narrativa UX

### 1. `empowered` (UNA_VEZ)

**Estado:** `combo_count >= required_count * 10`

**Narrativa actual:** `"🟣 POTENCIADO"`

**Problema:** No hay explicación de qué significa "potenciado" ni por qué aparece.

**Sugerencia:** Añadir tooltip o texto explicativo: `"Potenciado: ${combo_count} limpiezas (${required_count * 10}+)"`

---

### 2. `important` (RECURRENTE)

**Estado:** `days_since_last_clean >= critical_threshold`

**Narrativa actual:** `"🔴 IMPORTANTE REVISAR"`

**Problema:** No hay explicación de qué significa "importante" ni cuántos días faltan.

**Sugerencia:** Añadir tooltip: `"Importante: ${days_since_last_clean} días sin limpiar (umbral crítico: ${critical_threshold} días)"`

---

### 3. `effective` (RECURRENTE)

**Estado:** Proyección de shared+pde

**Narrativa actual:** Indicadores [S] [P] con tooltips

**Problema:** No hay explicación clara de qué significa "effective" ni cómo se calcula.

**Sugerencia:** Añadir texto explicativo: `"Effective: revisado si AMBAS capas (shared y pde) están revisadas"`

---

## Textos ambiguos

### 1. "Faltan: X"

**Contexto:** UNA_VEZ antes de completar

**Problema:** No especifica "faltan para qué" (completar el item).

**Sugerencia:** `"Faltan ${faltan} para completar (requerido: ${requiredCount})"`

---

### 2. "De más: X"

**Contexto:** UNA_VEZ después de completar

**Problema:** No especifica "de más sobre qué" (required_count).

**Sugerencia:** `"Excedente: ${excedente} sobre ${requiredCount} requerido"`

---

### 3. "Completado"

**Contexto:** UNA_VEZ cuando `clean_count === required_count`

**Problema:** No especifica cuántas veces se ha limpiado.

**Sugerencia:** `"Completado: ${cleanCount}/${requiredCount}"`

---

### 4. "Nunca"

**Contexto:** RECURRENTE cuando `days_since_last_clean === null`

**Problema:** No distingue entre "nunca limpiado" y "datos no disponibles".

**Sugerencia:** Verificar si `last_cleaned_at === null` para distinguir.

---

## Textos hardcodeados que deberían ser configurables

### 1. Multiplicador crítico

**Ubicación:** Múltiples

**Valor:** `2.0` (hardcoded)

**Problema:** No es configurable por item o lista.

**Sugerencia:** Leer desde `item.critical_multiplier` o override.

---

### 2. Umbral de potenciado

**Ubicación:** `createStudentRow()` (línea 2751)

**Valor:** `required_count * 10` (hardcoded)

**Problema:** No es configurable.

**Sugerencia:** Leer desde configuración del item.

---

## Resumen de Problemas

### Problemas Críticos:
1. ❌ Cálculo de estados EFFECTIVE en frontend (línea 2980-2996)
2. ❌ Textos ambiguos ("Faltan", "De más", "Completado")
3. ❌ Estados sin narrativa UX (`empowered`, `important`, `effective`)
4. ❌ Fallbacks que ocultan errores (`undefined` → valores por defecto)

### Problemas Menores:
1. ⚠️ Textos hardcodeados que deberían ser configurables
2. ⚠️ No distingue `null` de `undefined` en algunos casos
3. ⚠️ Tooltips faltantes para estados complejos

---

**FIN DE MAPA ESTADOS Y TEXTOS UI**
