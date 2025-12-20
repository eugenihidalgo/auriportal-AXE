# AXE v0.6.2 — Lógica del Canvas (Validadores y Conversores)

**Versión:** 0.6.2  
**Fecha:** 2025-01-XX  
**Estado:** IMPLEMENTADO  
**Fase:** Lógica Interna del Canvas (Sin UI, Sin DB)

---

## 🎯 OBJETIVO DE ESTA FASE

Implementar la **lógica interna del Canvas** que permite:
- ✅ Validación del Canvas
- ✅ Normalización del Canvas
- ✅ Conversión Canvas → Recorrido
- ✅ Conversión Recorrido → Canvas
- ✅ Tests mínimos críticos

**Todo es:**
- ✅ Incremental (no rompe recorridos existentes)
- ✅ Reversible (conversión bidireccional)
- ✅ Auditable (logs y validaciones)
- ✅ Sin impacto en runtime (solo lógica, no ejecución)

---

## 📋 CONTEXTO

Esta fase implementa la **lógica pura del Canvas**, sin tocar:
- ❌ Base de datos
- ❌ UI
- ❌ Runtime de ejecución

El modelo base está definido en **AXE_V0_6_1_CANVAS_MODEL.md** y es el contrato que NO se rediseña.

---

## 📁 MÓDULOS IMPLEMENTADOS

### 1. `validate-canvas-definition.js`

**Ubicación:** `src/core/canvas/validate-canvas-definition.js`

**Qué hace:**
- Valida estructura base del Canvas
- Detecta errores bloqueantes
- Emite warnings informativos
- NO lanza excepciones en runtime (fail-open)
- Retorna `{ ok: boolean, errors: [], warnings: [] }`

**Errores bloqueantes mínimos:**
- ✅ 0 o >1 StartNode
- ✅ Nodos huérfanos (sin edges)
- ✅ Edges a nodos inexistentes
- ✅ EndNode inalcanzable
- ✅ Loops infinitos sin salida
- ✅ ScreenNode sin `screen_template_id`

**Validaciones por tipo de nodo:**
- **StartNode**: No puede tener edges entrantes, debe tener edges salientes
- **ScreenNode**: Debe tener `screen_template_id`
- **DecisionNode**: En PUBLISH debe tener al menos 2 choices
- **ConditionNode**: Debe tener exactamente 2 edges salientes
- **DelayNode**: En PUBLISH debe tener duración
- **EndNode**: No puede tener edges salientes

**Uso:**
```javascript
import { validateCanvasDefinition } from '../core/canvas/validate-canvas-definition.js';

const result = validateCanvasDefinition(canvas, { isPublish: false });
if (!result.ok) {
  console.error('Errores:', result.errors);
}
```

---

### 2. `normalize-canvas-definition.js`

**Ubicación:** `src/core/canvas/normalize-canvas-definition.js`

**Qué hace:**
- Ordena nodos y edges de forma determinista
- Completa campos faltantes con defaults
- Asegura IDs únicos (maneja duplicados)
- Prepara estructura determinista para diffs
- Fail-open: si algo falta, normaliza con defaults

**Normalizaciones:**
- **Versión**: Establece `version: '1.0'` si falta
- **IDs**: Genera IDs faltantes o resuelve duplicados
- **Posiciones**: Establece `{ x: 0, y: 0 }` si falta
- **Props**: Completa props según tipo de nodo
- **Orden**: Ordena nodos (start primero, luego por id) y edges (por from/to)

**Defaults por tipo de nodo:**
- **ScreenNode**: `screen_template_id: 'blank'` si falta
- **DecisionNode**: `choices: []` si falta
- **ConditionNode**: `condition_type: 'always'` si falta
- **GroupNode**: `label: 'Group'` si falta
- **CommentNode**: `text: ''` si falta

**Uso:**
```javascript
import { normalizeCanvasDefinition } from '../core/canvas/normalize-canvas-definition.js';

const normalized = normalizeCanvasDefinition(canvas, {
  generateMissingIds: true
});
```

---

### 3. `canvas-to-recorrido.js`

**Ubicación:** `src/core/canvas/canvas-to-recorrido.js`

**Qué hace:**
- Transforma `CanvasDefinition` a `RecorridoDefinition` actual
- Preserva orden lógico
- Mapea nodos Screen → steps
- Mapea decisiones → branching existente
- Sin perder información (usa meta si hace falta)

**Conversión de nodos:**
- **StartNode**: No se convierte a step (ya está en `entry_step_id`)
- **ScreenNode**: Se convierte a step con `screen_template_id` y `props`
- **DecisionNode**: Se convierte a step con `screen_template_id: 'screen_choice'` y `step_type: 'decision'`
- **ConditionNode**: Se convierte a step con `step_type: 'condition'`
- **DelayNode**: Se convierte a step con `step_type: 'delay'`
- **EndNode**: No se convierte a step (es implícito)
- **GroupNode/CommentNode**: Se ignoran (no ejecutables)

**Conversión de edges:**
- **Direct**: Se convierte a edge con `condition: { type: 'always' }`
- **Conditional**: Se convierte a edge con `condition` preservada
- Se filtran edges a nodos no ejecutables

**Uso:**
```javascript
import { canvasToRecorrido } from '../core/canvas/canvas-to-recorrido.js';

const recorrido = canvasToRecorrido(canvas);
// Ahora el runtime puede ejecutar este recorrido
```

**Objetivo:**
👉 Permitir que el runtime actual ejecute recorridos definidos en Canvas.

---

### 4. `recorrido-to-canvas.js`

**Ubicación:** `src/core/canvas/recorrido-to-canvas.js`

**Qué hace:**
- Genera un Canvas válido desde recorridos existentes
- Infiere Start y End
- Representa secuencialidad como edges directos
- Permite edición posterior en Canvas

**Conversión de steps:**
- **Step con `step_type: 'decision'`**: Se convierte a `DecisionNode`
- **Step con `step_type: 'condition'`**: Se convierte a `ConditionNode`
- **Step con `step_type: 'delay'`**: Se convierte a `DelayNode`
- **Step con `screen_template_id: 'screen_choice'`**: Se convierte a `DecisionNode`
- **Otros**: Se convierten a `ScreenNode`

**Generación de nodos:**
- **StartNode**: Se crea desde `entry_step_id`
- **EndNode**: Se crea para steps sin edges salientes
- **Posiciones**: Se generan automáticamente en layout horizontal

**Uso:**
```javascript
import { recorridoToCanvas } from '../core/canvas/recorrido-to-canvas.js';

const canvas = recorridoToCanvas(recorrido, {
  generatePositions: true
});
// Ahora se puede editar este canvas visualmente
```

**Objetivo:**
👉 Garantizar compatibilidad total hacia atrás con recorridos existentes.

---

## 🧪 TESTS MÍNIMOS

**Ubicación:** `tests/canvas/`

### Tests implementados:

1. **`validate-canvas-definition.test.js`**
   - ✅ Canvas válido pasa
   - ✅ Canvas sin Start falla
   - ✅ Múltiples StartNodes detectados
   - ✅ Edges a nodos inexistentes detectados
   - ✅ EndNode inalcanzable detectado
   - ✅ ScreenNode sin screen_template_id detectado
   - ✅ Loops infinitos detectados
   - ✅ Warnings permitidos en draft

2. **`normalize-canvas-definition.test.js`**
   - ✅ Normaliza campos faltantes
   - ✅ Completa defaults de nodos
   - ✅ Ordena nodos determinísticamente
   - ✅ Maneja IDs duplicados
   - ✅ Genera IDs faltantes
   - ✅ Preserva estructura válida

3. **`canvas-conversion.test.js`**
   - ✅ Convierte canvas simple a recorrido
   - ✅ Filtra nodos no ejecutables
   - ✅ Convierte recorrido simple a canvas
   - ✅ Infiere tipos de nodo desde step_type
   - ✅ Conversión ida y vuelta conserva estructura
   - ✅ Fail-open no rompe

**Ejecutar tests:**
```bash
node --test tests/canvas/
```

---

## 🔄 FLUJO DE USO

### 1. Validar Canvas
```javascript
import { validateCanvasDefinition } from './core/canvas/validate-canvas-definition.js';

const result = validateCanvasDefinition(canvas, { isPublish: false });
if (!result.ok) {
  // Mostrar errores al usuario
  console.error(result.errors);
}
```

### 2. Normalizar Canvas
```javascript
import { normalizeCanvasDefinition } from './core/canvas/normalize-canvas-definition.js';

const normalized = normalizeCanvasDefinition(canvas);
// Guardar canvas normalizado
```

### 3. Convertir Canvas → Recorrido (para ejecutar)
```javascript
import { canvasToRecorrido } from './core/canvas/canvas-to-recorrido.js';

const recorrido = canvasToRecorrido(canvas);
// Publicar recorrido para que el runtime lo ejecute
```

### 4. Convertir Recorrido → Canvas (para editar)
```javascript
import { recorridoToCanvas } from './core/canvas/recorrido-to-canvas.js';

const canvas = recorridoToCanvas(recorrido);
// Abrir canvas en editor visual
```

---

## ⚠️ QUÉ NO HACE ESTA FASE

### ❌ NO toca Base de Datos
- No crea migraciones
- No modifica esquemas
- No guarda canvas en DB (eso viene después)

### ❌ NO crea UI
- No renderiza canvas visualmente
- No crea editor drag & drop
- No genera preview (usa Preview Harness existente)

### ❌ NO modifica Runtime
- No cambia cómo se ejecutan recorridos
- No afecta el flujo actual
- No rompe recorridos existentes

### ❌ NO valida contra Registries
- No valida `screen_template_id` contra `ScreenTemplateRegistry` (eso lo hace el validador de recorridos)
- No valida `condition_type` contra `ConditionRegistry` (eso lo hace el validador de recorridos)
- Solo valida estructura y semántica básica

---

## 🔗 INTEGRACIÓN FUTURA

### Con UI del Canvas (futuro)
1. Editor carga canvas desde DB
2. Usuario edita visualmente
3. Editor valida con `validateCanvasDefinition()`
4. Editor normaliza con `normalizeCanvasDefinition()`
5. Al guardar, convierte con `canvasToRecorrido()` y guarda recorrido

### Con Base de Datos (futuro)
1. Canvas se guarda en `recorrido_drafts.definition_json.canvas`
2. Al publicar, se valida estrictamente
3. Se convierte a recorrido y se publica

### Con Preview (futuro)
1. Usuario hace clic en nodo Screen
2. Se extrae step del canvas
3. Se usa Preview Harness existente para renderizar

---

## 📊 ESTRUCTURA DE ARCHIVOS

```
src/core/canvas/
├── validate-canvas-definition.js    # Validación
├── normalize-canvas-definition.js    # Normalización
├── canvas-to-recorrido.js            # Conversión Canvas → Recorrido
└── recorrido-to-canvas.js            # Conversión Recorrido → Canvas

tests/canvas/
├── validate-canvas-definition.test.js
├── normalize-canvas-definition.test.js
└── canvas-conversion.test.js

docs/
└── AXE_V0_6_2_CANVAS_LOGIC.md        # Este documento
```

---

## ✅ RESULTADO ESPERADO

### Implementado:
- ✅ Lógica del Canvas lista
- ✅ Validaciones claras
- ✅ Conversión bidireccional funcional
- ✅ Tests básicos pasando
- ✅ Sistema preparado para UI Canvas

### Próximos pasos:
1. **UI del Canvas** (futuro sprint)
2. **Integración con DB** (guardar canvas en `recorrido_drafts`)
3. **Preview desde nodos** (usar Preview Harness)
4. **Migración de recorridos existentes** (convertir a canvas automáticamente)

---

## 🔍 VALIDACIONES ESPECÍFICAS

### Estructurales (siempre)
- Estructura JSON válida
- Campos requeridos presentes
- IDs únicos
- Referencias válidas (edges a nodos existentes)

### Semánticas (en PUBLISH)
- StartNode único y válido
- ScreenNodes con `screen_template_id`
- DecisionNodes con choices válidos
- ConditionNodes con 2 edges salientes
- DelayNodes con duración
- EndNodes alcanzables

### Conectividad
- Nodos alcanzables desde `entry_node_id`
- EndNodes alcanzables
- Sin loops infinitos sin salida
- Sin nodos huérfanos (warnings)

---

## 🎯 DECISIONES DE DISEÑO

### 1. Fail-Open
- Las validaciones NO lanzan excepciones
- Retornan `{ ok, errors, warnings }`
- Permite continuar con warnings en draft

### 2. Normalización Determinista
- Ordena nodos y edges de forma consistente
- Facilita diffs y comparaciones
- Asegura IDs únicos automáticamente

### 3. Conversión Bidireccional
- Canvas → Recorrido: Para ejecutar
- Recorrido → Canvas: Para editar
- Preserva información en `meta` si es necesario

### 4. Nodos No Ejecutables
- `group` y `comment` se ignoran en conversión
- Solo aparecen en Canvas, no en Recorrido
- Permiten organización visual sin afectar runtime

---

## 📝 NOTAS FINALES

- Esta fase implementa **solo lógica pura**, sin dependencias externas
- Los módulos son **independientes** y pueden usarse por separado
- La validación es **incremental** (draft vs publish)
- La conversión es **reversible** (ida y vuelta)
- Todo es **auditable** (logs y validaciones)

---

**Fin del Documento - AXE v0.6.2**





