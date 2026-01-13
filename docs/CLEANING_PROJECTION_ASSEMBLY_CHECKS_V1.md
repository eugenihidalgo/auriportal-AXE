# Cleaning Projection Model (CPM) - Assembly Checks v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-27  
**Estado**: DOCUMENTACIÓN (NO implementado aún)

## Propósito

Este documento define los assembly checks futuros para verificar el cumplimiento del Cleaning Projection Model (CPM) v1.

**NOTA:** Estos checks NO están implementados aún. Se documentan aquí para preparar la implementación futura.

## Checks Propuestos

### CHECK-CPM-001: Cálculo de Estado Fuera de CPM

**Objetivo:** Detectar cálculos de estado de limpieza que NO usan CPM.

**Qué detecta:**
- Funciones que calculan `state` o `visual_state` sin importar CPM
- Comparaciones de `days_since_last_clean` con `threshold_days` fuera de CPM
- Cálculos de `effective` o `combo` fuera de CPM
- Duplicación de lógica de cálculo de estado

**Patrones a buscar:**
```javascript
// ❌ VIOLACIÓN: Cálculo inline
if (daysSince < threshold_days) {
  state = 'reviewed';
}

// ❌ VIOLACIÓN: Comparación directa
const state = daysSince > 7 ? 'pending' : 'reviewed';

// ✅ CORRECTO: Usa CPM
const projection = computeCleaningProjection({ ... });
const state = projection.state_active;
```

**Cómo arreglar:**
- Importar CPM: `import { computeCleaningProjection } from '../services/cleaning-projection-model.js'`
- Delegar cálculo a CPM
- Eliminar cálculos inline

### CHECK-CPM-002: Comparaciones Temporales en Frontend

**Objetivo:** Detectar cálculos de `days_since_last_clean` o comparaciones temporales en frontend.

**Qué detecta:**
- Cálculo de `days_since_last_clean` en archivos `public/js/**/*.js`
- Comparaciones con `threshold_days` en frontend
- Uso de `shared_last_cleaned_at` o `pde_last_cleaned_at` directamente
- Funciones `calculateDaysSince` o similares en frontend

**Patrones a buscar:**
```javascript
// ❌ VIOLACIÓN: Cálculo en frontend
const daysSince = calculateDaysSince(student.shared_last_cleaned_at);
const state = daysSince > 7 ? 'pending' : 'reviewed';

// ❌ VIOLACIÓN: Comparación directa
if (new Date() - new Date(student.shared_last_cleaned_at) > 7 * 24 * 60 * 60 * 1000) {
  state = 'pending';
}

// ✅ CORRECTO: Consume proyección
const stateData = student.state_by_view_layer?.[activeViewLayer];
const state = stateData?.state || 'never';
```

**Cómo arreglar:**
- Eliminar cálculos temporales en frontend
- Consumir `state_by_view_layer[view_layer]` desde backend
- Solicitar datos con `view_layer` explícita

### CHECK-CPM-003: Inferencias de Capa en UI

**Objetivo:** Detectar inferencias de `view_layer` o `clean_layer` desde contexto.

**Qué detecta:**
- Inferencia de `view_layer` desde `context.isMaster` o similar
- Inferencia de `clean_layer` desde `view_layer`
- Uso de defaults implícitos para `view_layer`
- Asunción de `view_layer` desde contexto sin validar

**Patrones a buscar:**
```javascript
// ❌ VIOLACIÓN: Inferencia de view_layer
const viewLayer = context.isMaster ? 'pde' : 'shared';

// ❌ VIOLACIÓN: Inferencia de clean_layer
const cleanLayer = viewLayer === 'pde' ? 'pde' : 'shared';

// ❌ VIOLACIÓN: Default implícito
const viewLayer = request.query.view_layer || 'shared'; // Sin validar

// ✅ CORRECTO: view_layer explícita y validada
const viewLayer = request.query.view_layer;
if (!viewLayer) {
  throw new Error('view_layer is required');
}
validateViewLayer(viewLayer);
```

**Cómo arreglar:**
- Requerir `view_layer` explícita en todas las peticiones GET
- Validar `view_layer` con `validateViewLayer()`
- Error explícito si `view_layer` falta o es inválida

### CHECK-CPM-004: Escrituras desde CPM

**Objetivo:** Detectar intentos de escribir desde CPM (violación constitucional).

**Qué detecta:**
- Llamadas a funciones de escritura dentro de `cleaning-projection-model.js`
- Mutaciones de estado en funciones de CPM
- Efectos secundarios en `computeCleaningProjection`
- Uso de `await` o `async` en CPM (excepto si es necesario para cálculos puros)

**Patrones a buscar:**
```javascript
// ❌ VIOLACIÓN: Escritura desde CPM
export function computeCleaningProjection(...) {
  // ...
  await updateCleaningState(...); // ❌ PROHIBIDO
  return projection;
}

// ❌ VIOLACIÓN: Mutación de estado
export function computeCleaningProjection(...) {
  cleaning_state.shared.clean_count++; // ❌ PROHIBIDO
  return projection;
}

// ✅ CORRECTO: Función pura
export function computeCleaningProjection(...) {
  // Solo cálculos, sin efectos secundarios
  return projection;
}
```

**Cómo arreglar:**
- Eliminar todas las escrituras desde CPM
- Asegurar que CPM es función pura (sin efectos secundarios)
- Mover escrituras a Cleaning Engine

### CHECK-CPM-005: state_by_view_layer Faltante

**Objetivo:** Detectar respuestas que NO incluyen `state_by_view_layer`.

**Qué detecta:**
- Respuestas GET que calculan estado pero NO incluyen `state_by_view_layer`
- Items sin `state_by_view_layer` en respuestas
- Respuestas que solo incluyen `state` sin `state_by_view_layer`

**Patrones a buscar:**
```javascript
// ❌ VIOLACIÓN: Respuesta sin state_by_view_layer
return {
  item_ref: '...',
  state: 'pending', // Solo state, falta state_by_view_layer
  visual_state: 'pending'
};

// ✅ CORRECTO: Respuesta con state_by_view_layer
return {
  item_ref: '...',
  state_by_view_layer: {
    shared: { state: 'pending', visual_state: 'pending', ... },
    pde: { state: 'reviewed', visual_state: 'reviewed', ... },
    combo: { ... } // Si aplica
  },
  state: 'pending', // Estado activo según view_layer
  visual_state: 'pending'
};
```

**Cómo arreglar:**
- Calcular `state_by_view_layer` para todas las view_layers
- Incluir `state_by_view_layer` en todas las respuestas que calculan estado
- Usar CPM para calcular `state_by_view_layer`

### CHECK-CPM-006: Uso de Campos Legacy para Estado

**Objetivo:** Detectar uso de campos legacy (`student.state`, `visual_state`) en lugar de `state_by_view_layer`.

**Qué detecta:**
- Uso de `student.state` o `student.visual_state` directamente
- Agrupación por campos legacy en lugar de `state_by_view_layer`
- Fallback a campos legacy sin warning DEPRECATED

**Patrones a buscar:**
```javascript
// ❌ VIOLACIÓN: Uso de campos legacy
const state = student.state; // Campo legacy
const column = determineColumnFromState(state);

// ❌ VIOLACIÓN: Agrupación por campos legacy
const grouped = students.reduce((acc, s) => {
  acc[s.state].push(s); // Usa campo legacy
  return acc;
}, {});

// ✅ CORRECTO: Usa state_by_view_layer
const stateData = student.state_by_view_layer?.[activeViewLayer];
const state = stateData?.state || 'never';
const column = determineColumnFromState(state);
```

**Cómo arreglar:**
- Eliminar uso de campos legacy
- Consumir `state_by_view_layer[view_layer]` exclusivamente
- Si hay fallback legacy, marcar como DEPRECATED con warning

## Implementación Futura

### Script de Verificación

**Ubicación propuesta:** `scripts/check-cleaning-projection-model.js`

**Funcionalidad:**
- Ejecutar todos los checks CPM
- Reportar violaciones encontradas
- Sugerir fixes automáticos cuando sea posible

**Integración:**
- Añadir a `package.json`: `"check:cpm": "node scripts/check-cleaning-projection-model.js"`
- Integrar en CI/CD pipeline
- Ejecutar antes de commits (pre-commit hook opcional)

### Checks Automáticos

**CHECK-CPM-001 y CHECK-CPM-002:**
- Usar AST parsing (eslint, babel) para detectar patrones
- Buscar funciones que calculan estado sin importar CPM
- Buscar comparaciones temporales en frontend

**CHECK-CPM-003:**
- Buscar inferencias de `view_layer` o `clean_layer`
- Verificar que `view_layer` se valida explícitamente

**CHECK-CPM-004:**
- Verificar que `cleaning-projection-model.js` no tiene escrituras
- Verificar que funciones de CPM son puras (sin efectos secundarios)

**CHECK-CPM-005:**
- Verificar que respuestas GET incluyen `state_by_view_layer`
- Verificar que items tienen `state_by_view_layer` completo

**CHECK-CPM-006:**
- Buscar uso de campos legacy (`student.state`, `visual_state`)
- Verificar que se usa `state_by_view_layer` exclusivamente

## Priorización

### Alta Prioridad
- CHECK-CPM-001: Cálculo de estado fuera de CPM
- CHECK-CPM-002: Comparaciones temporales en frontend
- CHECK-CPM-005: state_by_view_layer faltante

### Media Prioridad
- CHECK-CPM-003: Inferencias de capa en UI
- CHECK-CPM-006: Uso de campos legacy

### Baja Prioridad
- CHECK-CPM-004: Escrituras desde CPM (menos probable, pero crítico si ocurre)

## Referencias

- `docs/CLEANING_PROJECTION_MODEL_V1.md` - Documentación canónica CPM
- `docs/CONSTITUTION_VIEW_AUTHORITY_V1.md` - Regla constitucional
- `src/core/master/services/cleaning-projection-model.js` - Implementación CPM
- `docs/ASSEMBLY_CHECKS.md` - Sistema de Assembly Checks

---

**Fin del Documento**
