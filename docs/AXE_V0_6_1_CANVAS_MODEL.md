# AXE v0.6.1 — Modelo del Canvas de Recorridos (Sin UI)

**Versión:** 0.6.1  
**Fecha:** 2025-01-XX  
**Estado:** ESPECIFICACIÓN TÉCNICA  
**Fase:** Modelo Interno (Sin UI)

---

## 🎯 OBJETIVO DE ESTA FASE

Definir el **modelo interno del Canvas de Recorridos** que será la base para:
- UI del Canvas (futuro)
- Preview desde nodos
- Migraciones futuras
- Validación estructural

**NO se implementa UI en esta fase.**  
**NO se toca la base de datos todavía (solo se define si hará falta).**

---

## 📋 CONTEXTO FIJO (NO REDISEÑAR)

Ya existen y están consolidados:
- ✅ **Recorridos** con draft/publish (`RecorridoDefinition`)
- ✅ **Screen Templates v1** (`ScreenTemplateDefinition`)
- ✅ **Theme Definitions v1** (`ThemeDefinition`)
- ✅ **Preview Harness Unificado** (`PreviewContext`)
- ✅ **NavigationDefinition** como sistema de activación
- ✅ **Runtime fail-open** para recorridos

**El Canvas:**
- ❌ NO guarda progreso
- ❌ NO calcula estado
- ❌ NO hace lógica de negocio
- ✅ SOLO orquesta flujo (representación visual/estructural)

---

## 1️⃣ MODELO BASE DEL CANVAS

### Estructura Principal

```typescript
interface CanvasDefinition {
  version: '1.0';                    // Versión del formato Canvas
  canvas_id: string;                // ID único del canvas (coincide con recorrido_id)
  name: string;                     // Nombre legible
  description?: string;              // Descripción opcional
  entry_node_id: string;            // ID del nodo de entrada
  nodes: CanvasNode[];              // Array de nodos (no mapa, para orden)
  edges: CanvasEdge[];              // Array de edges
  viewport?: ViewportConfig;        // Configuración de viewport (para UI)
  meta?: CanvasMetadata;            // Metadatos adicionales
}

interface CanvasMetadata {
  created_at?: string;              // ISO 8601
  updated_at?: string;              // ISO 8601
  created_by?: string;              // Admin que creó
  canvas_version?: number;           // Versión incremental del canvas (independiente de recorrido)
}
```

### ¿Por qué esta estructura?

1. **`version: '1.0'`**: Permite evolución del formato sin breaking changes
2. **`nodes: CanvasNode[]`** (array, no mapa): Preserva orden visual y facilita drag & drop
3. **`edges: CanvasEdge[]`** (array): Permite múltiples edges entre mismos nodos
4. **`viewport`**: Configuración de UI (zoom, posición) separada de lógica
5. **`meta`**: Auditoría y versionado independiente del recorrido

### Versionado del Canvas

El Canvas tiene su propio versionado independiente del recorrido:

- **Canvas Version**: Incremental (1, 2, 3...) para cambios en estructura visual
- **Recorrido Version**: Incremental (1, 2, 3...) para cambios en definición ejecutable

**Ejemplo:**
```
Canvas v1 → Recorrido v1 (publicado)
Canvas v2 → Recorrido v1 (mismo recorrido, solo cambió layout)
Canvas v3 → Recorrido v2 (nuevo recorrido publicado)
```

### Extensibilidad Futura

El modelo está preparado para:
- **Nuevos tipos de nodos**: Agregar a `CanvasNodeType`
- **Nuevos tipos de edges**: Agregar a `CanvasEdgeType`
- **Metadatos adicionales**: Extender `CanvasMetadata`
- **Plugins de UI**: `viewport` y `meta` permiten configuraciones personalizadas

---

## 2️⃣ TIPOS DE NODOS (FORMALIZADOS)

### Estructura Base

```typescript
interface CanvasNode {
  id: string;                        // ID único (coincide con step_id del recorrido)
  type: CanvasNodeType;              // Tipo de nodo
  label: string;                     // Etiqueta visible en canvas
  position: Position;                // Posición en canvas (x, y)
  props: CanvasNodeProps;            // Props específicas del tipo
  style?: NodeStyle;                 // Estilo visual (opcional)
  metadata?: NodeMetadata;           // Metadatos adicionales
}

interface Position {
  x: number;                         // Coordenada X (píxeles o unidades)
  y: number;                         // Coordenada Y (píxeles o unidades)
}

interface NodeStyle {
  color?: string;                    // Color del nodo (hex)
  icon?: string;                     // Icono (opcional)
  size?: 'small' | 'medium' | 'large';
}

interface NodeMetadata {
  notes?: string;                     // Notas del editor
  tags?: string[];                    // Tags para organización
}
```

### Tipos de Nodos

```typescript
type CanvasNodeType =
  | 'start'                          // Nodo de inicio
  | 'screen'                         // Nodo de pantalla (usa screen_template_id)
  | 'decision'                        // Nodo de decisión (branching)
  | 'condition'                      // Nodo de condición (filtro)
  | 'delay'                          // Nodo de delay/timer
  | 'end'                            // Nodo de fin
  | 'group'                          // Nodo contenedor (agrupación visual)
  | 'comment'                        // Nodo de comentario (no ejecutable)
```

### 2.1 StartNode

**Tipo:** `'start'`

**Props:**
```typescript
interface StartNodeProps {
  // No props específicas (nodo de entrada)
}
```

**Restricciones:**
- ✅ Debe existir exactamente UN nodo `start` por canvas
- ✅ `id` debe coincidir con `entry_step_id` del recorrido
- ✅ NO puede tener edges entrantes
- ✅ DEBE tener al menos un edge saliente

**Validación:**
- Error si hay 0 o >1 nodos start
- Error si tiene edges entrantes
- Warning si no tiene edges salientes

**Qué NO hace:**
- NO ejecuta lógica
- NO captura datos
- NO emite eventos

---

### 2.2 ScreenNode

**Tipo:** `'screen'`

**Props:**
```typescript
interface ScreenNodeProps {
  screen_template_id: string;        // ID del Screen Template (requerido)
  props?: Record<string, any>;        // Props para el template (opcional en draft)
  step_type?: string;                // Tipo de step (opcional, para validación)
}
```

**Restricciones:**
- ✅ `screen_template_id` debe existir en `ScreenTemplateRegistry`
- ✅ En PUBLISH: `props` debe validar contra `schema` del template
- ✅ Puede tener `capture` declarativo (se define en recorrido, no en canvas)

**Validación:**
- Error si `screen_template_id` no existe
- Error en PUBLISH si `props` no valida contra schema
- Warning si `step_type` no coincide con tipo esperado del template

**Qué NO hace:**
- NO renderiza HTML (eso lo hace el runtime)
- NO valida props en tiempo real (solo en validación)

---

### 2.3 DecisionNode

**Tipo:** `'decision'`

**Props:**
```typescript
interface DecisionNodeProps {
  question?: string;                  // Pregunta (opcional en draft)
  choices?: DecisionChoice[];        // Opciones (opcional en draft)
  capture_field?: string;             // Campo donde capturar choice_id
}

interface DecisionChoice {
  choice_id: string;                  // ID de la opción
  label: string;                      // Etiqueta visible
  estimated_minutes?: number;          // Tiempo estimado (opcional)
}
```

**Restricciones:**
- ✅ En PUBLISH: debe tener al menos 2 `choices`
- ✅ Cada `choice_id` debe ser slug válido (`/^[a-z][a-z0-9_]*$/`)
- ✅ `choice_id` no puede repetirse
- ✅ Debe tener edges salientes (uno por choice o edge condicional)

**Validación:**
- Error en PUBLISH si no tiene choices
- Error si `choice_id` duplicado
- Warning si no tiene edges salientes

**Qué NO hace:**
- NO evalúa condiciones (eso lo hace el runtime)
- NO captura datos directamente (usa `capture` del step)

---

### 2.4 ConditionNode

**Tipo:** `'condition'`

**Props:**
```typescript
interface ConditionNodeProps {
  condition_type: string;             // Tipo de condición (always, field_exists, etc.)
  condition_params?: Record<string, any>; // Parámetros de la condición
  label_true?: string;                // Etiqueta para rama true (opcional)
  label_false?: string;               // Etiqueta para rama false (opcional)
}
```

**Restricciones:**
- ✅ `condition_type` debe existir en `ConditionRegistry`
- ✅ Debe tener exactamente 2 edges salientes (true/false)
- ✅ `condition_params` debe validar contra `params_schema` del registry

**Validación:**
- Error si `condition_type` no existe
- Error si no tiene 2 edges salientes
- Warning si `condition_params` no valida

**Qué NO hace:**
- NO evalúa la condición (eso lo hace el runtime)
- NO modifica state

---

### 2.5 DelayNode

**Tipo:** `'delay'`

**Props:**
```typescript
interface DelayNodeProps {
  duration_seconds?: number;          // Duración en segundos (opcional en draft)
  duration_minutes?: number;           // Duración en minutos (alternativa)
  message?: string;                   // Mensaje durante delay (opcional)
}
```

**Restricciones:**
- ✅ En PUBLISH: debe tener `duration_seconds` o `duration_minutes`
- ✅ Duración debe ser > 0

**Validación:**
- Error en PUBLISH si no tiene duración
- Error si duración <= 0

**Qué NO hace:**
- NO ejecuta el delay (eso lo hace el runtime)
- NO bloquea el flujo (es asíncrono)

---

### 2.6 EndNode

**Tipo:** `'end'`

**Props:**
```typescript
interface EndNodeProps {
  message?: string;                   // Mensaje final (opcional)
  redirect_url?: string;               // URL de redirección (opcional)
}
```

**Restricciones:**
- ✅ Puede haber múltiples nodos `end`
- ✅ NO puede tener edges salientes
- ✅ Puede tener edges entrantes

**Validación:**
- Warning si no tiene edges entrantes (nodo inalcanzable)
- Error si tiene edges salientes

**Qué NO hace:**
- NO completa el recorrido (eso lo hace el runtime)
- NO emite eventos (eso lo hace el runtime)

---

### 2.7 GroupNode

**Tipo:** `'group'`

**Props:**
```typescript
interface GroupNodeProps {
  label: string;                      // Etiqueta del grupo
  collapsed?: boolean;                // Si está colapsado (para UI)
  color?: string;                     // Color del grupo (hex)
}
```

**Restricciones:**
- ✅ Es solo visual (no ejecutable)
- ✅ Puede contener otros nodos (relación padre-hijo)
- ✅ NO aparece en el recorrido ejecutable

**Validación:**
- Warning si está vacío (no contiene nodos)
- No genera errores (es solo visual)

**Qué NO hace:**
- NO ejecuta nada
- NO aparece en runtime
- NO se serializa en recorrido

---

### 2.8 CommentNode

**Tipo:** `'comment'`

**Props:**
```typescript
interface CommentNodeProps {
  text: string;                       // Texto del comentario
  author?: string;                    // Autor (opcional)
}
```

**Restricciones:**
- ✅ Es solo visual (no ejecutable)
- ✅ NO aparece en el recorrido ejecutable
- ✅ NO tiene edges

**Validación:**
- No genera errores (es solo visual)

**Qué NO hace:**
- NO ejecuta nada
- NO aparece en runtime
- NO se serializa en recorrido

---

## 3️⃣ EDGES (CONEXIONES)

### Estructura Base

```typescript
interface CanvasEdge {
  id: string;                         // ID único del edge
  from_node_id: string;               // ID del nodo origen
  to_node_id: string;                 // ID del nodo destino
  type: CanvasEdgeType;               // Tipo de edge
  condition?: EdgeCondition;         // Condición (opcional)
  label?: string;                     // Etiqueta visible (opcional)
  style?: EdgeStyle;                  // Estilo visual (opcional)
  metadata?: EdgeMetadata;             // Metadatos adicionales
}

type CanvasEdgeType =
  | 'direct'                          // Edge directo (sin condición)
  | 'conditional'                     // Edge condicional
  | 'temporal'                        // Edge temporal (delay antes de transición)
  | 'fallback'                        // Edge de fallback (si ninguna condición se cumple)

interface EdgeCondition {
  type: string;                       // Tipo de condición (always, field_exists, etc.)
  params?: Record<string, any>;       // Parámetros de la condición
}

interface EdgeStyle {
  color?: string;                      // Color del edge (hex)
  style?: 'solid' | 'dashed' | 'dotted';
  width?: number;                     // Grosor (píxeles)
}

interface EdgeMetadata {
  notes?: string;                      // Notas del editor
}
```

### 3.1 Edge Directo

**Tipo:** `'direct'`

**Características:**
- ✅ Siempre se cumple (sin condición)
- ✅ Transición inmediata
- ✅ No requiere `condition`

**Ejemplo:**
```json
{
  "id": "edge_1",
  "from_node_id": "start",
  "to_node_id": "screen_intro",
  "type": "direct"
}
```

---

### 3.2 Edge Condicional

**Tipo:** `'conditional'`

**Características:**
- ✅ Requiere `condition`
- ✅ Se evalúa en runtime
- ✅ Solo transiciona si la condición se cumple

**Ejemplo:**
```json
{
  "id": "edge_2",
  "from_node_id": "decision_1",
  "to_node_id": "screen_a",
  "type": "conditional",
  "condition": {
    "type": "field_equals",
    "params": {
      "field": "choice_id",
      "value": "rapida"
    }
  },
  "label": "Si eligió rápida"
}
```

---

### 3.3 Edge Temporal

**Tipo:** `'temporal'`

**Características:**
- ✅ Requiere `delay_seconds` o `delay_minutes`
- ✅ Espera antes de transicionar
- ✅ Útil para delays entre pantallas

**Ejemplo:**
```json
{
  "id": "edge_3",
  "from_node_id": "screen_intro",
  "to_node_id": "screen_main",
  "type": "temporal",
  "delay_seconds": 5
}
```

**Nota:** Este tipo puede no ser necesario si usamos `DelayNode`. Se incluye para flexibilidad.

---

### 3.4 Edge Fallback

**Tipo:** `'fallback'`

**Características:**
- ✅ Solo se activa si ninguna otra condición se cumple
- ✅ Útil para "default" en decisiones
- ✅ Debe ser el último edge evaluado

**Ejemplo:**
```json
{
  "id": "edge_4",
  "from_node_id": "decision_1",
  "to_node_id": "screen_default",
  "type": "fallback",
  "label": "Por defecto"
}
```

---

### Reglas de Edges

#### Prohibiciones

1. **Loops inválidos:**
   - ❌ Edge desde `end` a cualquier nodo
   - ❌ Edge desde `start` a `start` (auto-loop)
   - ❌ Edge desde `end` a `end` (auto-loop)

2. **Nodos inexistentes:**
   - ❌ `from_node_id` debe existir en `nodes`
   - ❌ `to_node_id` debe existir en `nodes`

3. **Condiciones inválidas:**
   - ❌ `condition.type` debe existir en `ConditionRegistry`
   - ❌ `condition.params` debe validar contra `params_schema`

#### Detección de Errores

1. **Nodos huérfanos:**
   - Warning si un nodo no tiene edges entrantes ni salientes (excepto `start` y `end`)

2. **Nodos inalcanzables:**
   - Warning si un nodo no es alcanzable desde `entry_node_id`

3. **Ciclos válidos vs inválidos:**
   - ✅ **Válidos**: Ciclos controlados (ej: reintentar decisión)
   - ❌ **Inválidos**: Ciclos infinitos sin condición de salida

4. **Múltiples edges sin condición:**
   - Warning si hay múltiples edges `direct` desde el mismo nodo (ambiguo)

---

## 4️⃣ VALIDACIONES DE PUBLISH

### 4.1 Errores Bloqueantes

Estos errores **impiden publicar**:

1. **Estructura:**
   - Falta `entry_node_id`
   - No hay nodos
   - No hay nodo `start`
   - Múltiples nodos `start`

2. **Nodos:**
   - `screen_template_id` no existe
   - `condition_type` no existe
   - `choice_id` duplicado en `DecisionNode`
   - `EndNode` con edges salientes

3. **Edges:**
   - `from_node_id` no existe
   - `to_node_id` no existe
   - Edge desde `end` a otro nodo
   - `ConditionNode` sin 2 edges salientes

4. **Conectividad:**
   - `entry_node_id` no existe
   - Nodo `start` no tiene edges salientes
   - Nodos inalcanzables desde `start`

5. **Props en PUBLISH:**
   - `ScreenNode.props` no valida contra schema
   - `DecisionNode` sin choices en PUBLISH
   - `DelayNode` sin duración en PUBLISH

---

### 4.2 Warnings

Estos warnings **no bloquean publicar** pero se muestran:

1. **Nodos:**
   - Nodo sin edges (huérfano)
   - `ScreenNode` sin `step_type`
   - `DecisionNode` con choices sin edges correspondientes

2. **Edges:**
   - Múltiples edges `direct` desde mismo nodo (ambiguo)
   - Edge sin `condition` en `conditional`
   - `ConditionNode` con edges sin etiquetas true/false

3. **Conectividad:**
   - Nodos inalcanzables (no desde `start`)
   - Ciclos sin condición de salida

---

### 4.3 Validación Estructural

```typescript
function validateCanvasStructure(canvas: CanvasDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validar estructura base
  if (!canvas.entry_node_id) {
    errors.push('entry_node_id es requerido');
  }

  if (!canvas.nodes || canvas.nodes.length === 0) {
    errors.push('Debe tener al menos un nodo');
  }

  // 2. Validar nodo start
  const startNodes = canvas.nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Debe tener un nodo start');
  } else if (startNodes.length > 1) {
    errors.push('Solo puede haber un nodo start');
  }

  // 3. Validar entry_node_id existe
  const entryNode = canvas.nodes.find(n => n.id === canvas.entry_node_id);
  if (!entryNode) {
    errors.push(`entry_node_id '${canvas.entry_node_id}' no existe en nodes`);
  }

  // 4. Validar edges
  for (const edge of canvas.edges || []) {
    const fromNode = canvas.nodes.find(n => n.id === edge.from_node_id);
    const toNode = canvas.nodes.find(n => n.id === edge.to_node_id);

    if (!fromNode) {
      errors.push(`Edge '${edge.id}': from_node_id '${edge.from_node_id}' no existe`);
    }
    if (!toNode) {
      errors.push(`Edge '${edge.id}': to_node_id '${edge.to_node_id}' no existe`);
    }

    // Validar que end no tenga edges salientes
    if (fromNode?.type === 'end') {
      errors.push(`Edge '${edge.id}': end node no puede tener edges salientes`);
    }
  }

  // 5. Validar conectividad
  const reachable = getReachableNodes(canvas, canvas.entry_node_id);
  const unreachable = canvas.nodes.filter(n => !reachable.has(n.id) && n.type !== 'start');
  if (unreachable.length > 0) {
    warnings.push(`Nodos inalcanzables: ${unreachable.map(n => n.id).join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

---

### 4.4 Validación Semántica Básica

```typescript
function validateCanvasSemantics(
  canvas: CanvasDefinition,
  isPublish: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const node of canvas.nodes) {
    // Validar ScreenNode
    if (node.type === 'screen') {
      const props = node.props as ScreenNodeProps;
      if (!props.screen_template_id) {
        errors.push(`Node '${node.id}': screen_template_id es requerido`);
      } else {
        // Validar que template existe (requiere registry)
        // if (!screenTemplateRegistry.has(props.screen_template_id)) {
        //   errors.push(`Node '${node.id}': screen_template_id '${props.screen_template_id}' no existe`);
        // }
      }

      // En PUBLISH, validar props contra schema
      if (isPublish && props.props) {
        // Validar contra schema del template
        // const template = screenTemplateRegistry.get(props.screen_template_id);
        // const validation = validatePropsAgainstSchema(props.props, template.schema);
        // errors.push(...validation.errors);
        // warnings.push(...validation.warnings);
      }
    }

    // Validar DecisionNode
    if (node.type === 'decision') {
      const props = node.props as DecisionNodeProps;
      if (isPublish) {
        if (!props.choices || props.choices.length < 2) {
          errors.push(`Node '${node.id}': DecisionNode debe tener al menos 2 choices en PUBLISH`);
        }

        const choiceIds = props.choices?.map(c => c.choice_id) || [];
        const duplicates = choiceIds.filter((id, idx) => choiceIds.indexOf(id) !== idx);
        if (duplicates.length > 0) {
          errors.push(`Node '${node.id}': choice_id duplicados: ${duplicates.join(', ')}`);
        }
      }
    }

    // Validar ConditionNode
    if (node.type === 'condition') {
      const props = node.props as ConditionNodeProps;
      if (!props.condition_type) {
        errors.push(`Node '${node.id}': condition_type es requerido`);
      }

      // Validar que tiene 2 edges salientes
      const outgoingEdges = canvas.edges.filter(e => e.from_node_id === node.id);
      if (outgoingEdges.length !== 2) {
        errors.push(`Node '${node.id}': ConditionNode debe tener exactamente 2 edges salientes`);
      }
    }

    // Validar DelayNode
    if (node.type === 'delay') {
      const props = node.props as DelayNodeProps;
      if (isPublish) {
        if (!props.duration_seconds && !props.duration_minutes) {
          errors.push(`Node '${node.id}': DelayNode debe tener duración en PUBLISH`);
        }
      }
    }
  }

  // Validar edges
  for (const edge of canvas.edges) {
    if (edge.type === 'conditional' && !edge.condition) {
      warnings.push(`Edge '${edge.id}': conditional edge sin condition`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

---

## 5️⃣ SERIALIZACIÓN

### 5.1 Cómo se Guarda en JSON

El Canvas se serializa como JSON estándar:

```json
{
  "version": "1.0",
  "canvas_id": "limpieza-diaria",
  "name": "Limpieza Energética Diaria",
  "description": "Recorrido diario de limpieza",
  "entry_node_id": "start",
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "label": "Inicio",
      "position": { "x": 100, "y": 100 },
      "props": {}
    },
    {
      "id": "screen_intro",
      "type": "screen",
      "label": "Pantalla Intro",
      "position": { "x": 300, "y": 100 },
      "props": {
        "screen_template_id": "screen_intro_centered",
        "props": {
          "title": "Bienvenido",
          "subtitle": "Limpieza Energética"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "from_node_id": "start",
      "to_node_id": "screen_intro",
      "type": "direct"
    }
  ],
  "viewport": {
    "zoom": 1.0,
    "pan": { "x": 0, "y": 0 }
  },
  "meta": {
    "created_at": "2025-01-XXT10:00:00Z",
    "updated_at": "2025-01-XXT11:00:00Z",
    "canvas_version": 1
  }
}
```

---

### 5.2 Normalización

La normalización asegura consistencia:

```typescript
function normalizeCanvasDefinition(canvas: any): CanvasDefinition {
  // 1. Asegurar version
  if (!canvas.version) {
    canvas.version = '1.0';
  }

  // 2. Normalizar nodes (asegurar campos requeridos)
  const normalizedNodes = (canvas.nodes || []).map(node => ({
    id: node.id,
    type: node.type,
    label: node.label || node.id,
    position: node.position || { x: 0, y: 0 },
    props: node.props || {},
    style: node.style,
    metadata: node.metadata
  }));

  // 3. Normalizar edges (asegurar campos requeridos)
  const normalizedEdges = (canvas.edges || []).map((edge, idx) => ({
    id: edge.id || `edge_${idx}`,
    from_node_id: edge.from_node_id,
    to_node_id: edge.to_node_id,
    type: edge.type || 'direct',
    condition: edge.condition,
    label: edge.label,
    style: edge.style,
    metadata: edge.metadata
  }));

  // 4. Asegurar entry_node_id
  if (!canvas.entry_node_id && normalizedNodes.length > 0) {
    const startNode = normalizedNodes.find(n => n.type === 'start');
    if (startNode) {
      canvas.entry_node_id = startNode.id;
    }
  }

  return {
    version: canvas.version,
    canvas_id: canvas.canvas_id || canvas.id,
    name: canvas.name || canvas.canvas_id || 'Unnamed Canvas',
    description: canvas.description,
    entry_node_id: canvas.entry_node_id,
    nodes: normalizedNodes,
    edges: normalizedEdges,
    viewport: canvas.viewport,
    meta: {
      ...canvas.meta,
      updated_at: new Date().toISOString()
    }
  };
}
```

---

### 5.3 Validación de Serialización

```typescript
function validateCanvasSerialization(canvas: any): ValidationResult {
  const errors: string[] = [];

  // Validar estructura JSON básica
  if (!canvas || typeof canvas !== 'object') {
    errors.push('Canvas debe ser un objeto JSON');
    return { valid: false, errors, warnings: [] };
  }

  // Validar version
  if (canvas.version && canvas.version !== '1.0') {
    errors.push(`Versión '${canvas.version}' no soportada. Versión esperada: '1.0'`);
  }

  // Validar nodes es array
  if (canvas.nodes && !Array.isArray(canvas.nodes)) {
    errors.push('nodes debe ser un array');
  }

  // Validar edges es array
  if (canvas.edges && !Array.isArray(canvas.edges)) {
    errors.push('edges debe ser un array');
  }

  // Validar IDs únicos en nodes
  const nodeIds = (canvas.nodes || []).map((n: any) => n.id);
  const duplicateNodeIds = nodeIds.filter((id: string, idx: number) => nodeIds.indexOf(id) !== idx);
  if (duplicateNodeIds.length > 0) {
    errors.push(`IDs de nodos duplicados: ${duplicateNodeIds.join(', ')}`);
  }

  // Validar IDs únicos en edges
  const edgeIds = (canvas.edges || []).map((e: any) => e.id);
  const duplicateEdgeIds = edgeIds.filter((id: string, idx: number) => edgeIds.indexOf(id) !== idx);
  if (duplicateEdgeIds.length > 0) {
    errors.push(`IDs de edges duplicados: ${duplicateEdgeIds.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}
```

---

### 5.4 Versionado

El Canvas soporta versionado para:
- **Draft/Publish**: Canvas puede estar en draft o publicado
- **Auditoría**: Historial de cambios
- **Rollback**: Volver a versiones anteriores

**Estrategia:**
- Canvas se guarda junto con `RecorridoDefinition` en `recorrido_drafts`
- Canvas tiene su propio `canvas_version` en `meta`
- Al publicar recorrido, se publica también el canvas asociado

---

## 6️⃣ COMPATIBILIDAD CON RECORRIDOS ACTUALES

### 6.1 Cómo un Recorrido Actual se Representa como Canvas

**Algoritmo de conversión:**

```typescript
function recorridoToCanvas(recorrido: RecorridoDefinition): CanvasDefinition {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  // 1. Crear nodo start
  nodes.push({
    id: recorrido.entry_step_id,
    type: 'start',
    label: 'Inicio',
    position: { x: 100, y: 100 },
    props: {}
  });

  // 2. Convertir steps a nodes
  let x = 300;
  let y = 100;
  const stepPositions = new Map<string, Position>();

  for (const [stepId, step] of Object.entries(recorrido.steps || {})) {
    const position = { x, y };
    stepPositions.set(stepId, position);

    // Determinar tipo de nodo
    let nodeType: CanvasNodeType = 'screen';
    if (step.step_type === 'decision') {
      nodeType = 'decision';
    } else if (step.step_type === 'condition') {
      nodeType = 'condition';
    } else if (step.step_type === 'delay') {
      nodeType = 'delay';
    }

    nodes.push({
      id: stepId,
      type: nodeType,
      label: stepId,
      position,
      props: {
        screen_template_id: step.screen_template_id,
        props: step.props,
        step_type: step.step_type
      }
    });

    x += 300; // Avanzar horizontalmente
  }

  // 3. Convertir edges
  for (const edge of recorrido.edges || []) {
    edges.push({
      id: `edge_${edge.from_step_id}_${edge.to_step_id}`,
      from_node_id: edge.from_step_id,
      to_node_id: edge.to_step_id,
      type: edge.condition ? 'conditional' : 'direct',
      condition: edge.condition
    });
  }

  // 4. Crear nodo end (si no existe)
  // Buscar nodos sin edges salientes
  const nodesWithOutgoing = new Set(recorrido.edges?.map(e => e.from_step_id) || []);
  const endNodes = Object.keys(recorrido.steps || {}).filter(
    stepId => !nodesWithOutgoing.has(stepId)
  );

  if (endNodes.length > 0) {
    // Crear nodo end para cada nodo sin salida
    for (const endNodeId of endNodes) {
      if (endNodeId !== recorrido.entry_step_id) {
        nodes.push({
          id: `${endNodeId}_end`,
          type: 'end',
          label: 'Fin',
          position: { x: x, y: y },
          props: {}
        });

        edges.push({
          id: `edge_${endNodeId}_end`,
          from_node_id: endNodeId,
          to_node_id: `${endNodeId}_end`,
          type: 'direct'
        });
      }
    }
  }

  return {
    version: '1.0',
    canvas_id: recorrido.id,
    name: recorrido.name || recorrido.id,
    description: recorrido.description,
    entry_node_id: recorrido.entry_step_id,
    nodes,
    edges,
    meta: {
      created_at: new Date().toISOString(),
      canvas_version: 1
    }
  };
}
```

---

### 6.2 Cómo un Canvas se Convierte a Recorrido

**Algoritmo de conversión:**

```typescript
function canvasToRecorrido(canvas: CanvasDefinition): RecorridoDefinition {
  const steps: Record<string, StepDefinition> = {};
  const edges: EdgeDefinition[] = [];

  // 1. Filtrar nodos ejecutables (excluir group, comment)
  const executableNodes = canvas.nodes.filter(
    n => n.type !== 'group' && n.type !== 'comment'
  );

  // 2. Convertir nodes a steps
  for (const node of executableNodes) {
    if (node.type === 'start') {
      // Start node no se convierte a step (ya está en entry_step_id)
      continue;
    }

    if (node.type === 'end') {
      // End node no se convierte a step (es implícito)
      continue;
    }

    const step: StepDefinition = {
      screen_template_id: (node.props as ScreenNodeProps).screen_template_id || 'blank',
      props: (node.props as ScreenNodeProps).props || {}
    };

    // Agregar step_type si existe
    if ((node.props as ScreenNodeProps).step_type) {
      step.step_type = (node.props as ScreenNodeProps).step_type;
    }

    steps[node.id] = step;
  }

  // 3. Convertir edges a edges de recorrido
  for (const edge of canvas.edges) {
    // Filtrar edges que van a nodos no ejecutables
    const toNode = canvas.nodes.find(n => n.id === edge.to_node_id);
    if (toNode && (toNode.type === 'group' || toNode.type === 'comment')) {
      continue; // Skip edges a nodos no ejecutables
    }

    const recorridoEdge: EdgeDefinition = {
      from_step_id: edge.from_node_id,
      to_step_id: edge.to_node_id,
      condition: edge.condition || { type: 'always' }
    };

    edges.push(recorridoEdge);
  }

  return {
    id: canvas.canvas_id,
    name: canvas.name,
    description: canvas.description,
    entry_step_id: canvas.entry_node_id,
    steps,
    edges
  };
}
```

---

### 6.3 Qué se Asume por Defecto

1. **Posiciones:** Si un recorrido no tiene canvas, se genera automáticamente con layout horizontal
2. **Nodos faltantes:** Si un canvas tiene nodos que no están en el recorrido, se ignoran al convertir
3. **Edges faltantes:** Si un recorrido tiene edges que no están en el canvas, se agregan como `direct`
4. **Nodos no ejecutables:** `group` y `comment` se ignoran al convertir a recorrido

---

### 6.4 Cómo se Evita Breaking Change

1. **Canvas es opcional:** Un recorrido puede existir sin canvas
2. **Conversión bidireccional:** Canvas ↔ Recorrido es reversible
3. **Validación independiente:** Canvas se valida por separado del recorrido
4. **Versionado paralelo:** Canvas version y Recorrido version son independientes

**Estrategia de migración:**
- Recorridos existentes se pueden convertir a canvas automáticamente
- Canvas se guarda en `recorrido_drafts.definition_json.canvas` (campo opcional)
- Si no hay canvas, se genera uno al abrir el editor

---

## 7️⃣ RESULTADO ESPERADO

### 7.1 Definición Clara del Modelo

✅ **CanvasDefinition** como estructura principal  
✅ **CanvasNode** con 8 tipos formalizados  
✅ **CanvasEdge** con 4 tipos formalizados  
✅ **Validaciones** estructurales y semánticas  
✅ **Serialización** JSON normalizada  
✅ **Compatibilidad** bidireccional con recorridos

---

### 7.2 Ejemplos de JSON

Ver sección **5.1** para ejemplo completo de serialización.

---

### 7.3 Reglas Explícitas

✅ **Restricciones por tipo de nodo** documentadas  
✅ **Reglas de edges** (prohibiciones, detección de errores)  
✅ **Validaciones de publish** (errores bloqueantes vs warnings)  
✅ **Compatibilidad** con recorridos actuales

---

### 7.4 Decisiones Justificadas

1. **Array de nodes (no mapa):** Preserva orden visual y facilita drag & drop
2. **Canvas version independiente:** Permite cambios visuales sin tocar recorrido
3. **Nodos no ejecutables (group, comment):** Permiten organización visual sin afectar runtime
4. **Conversión bidireccional:** Garantiza compatibilidad con recorridos existentes
5. **Validación en dos fases:** Estructural (siempre) y semántica (solo en publish)

---

### 7.5 Riesgos Detectados

1. **Desincronización Canvas ↔ Recorrido:**
   - **Riesgo:** Canvas y recorrido pueden divergir
   - **Mitigación:** Validación en publish, conversión automática

2. **Performance con muchos nodos:**
   - **Riesgo:** Canvas con 100+ nodos puede ser lento
   - **Mitigación:** Límites de validación, optimización futura

3. **Validación de screen_template_id:**
   - **Riesgo:** Template puede no existir en runtime
   - **Mitigación:** Validación estricta en publish, fail-open en runtime

4. **Ciclos infinitos:**
   - **Riesgo:** Canvas puede tener loops sin salida
   - **Mitigación:** Detección de ciclos en validación, warnings

---

## 📚 PRÓXIMOS PASOS

1. **Implementar validadores** (`validate-canvas-definition.js`)
2. **Implementar conversores** (`canvas-to-recorrido.js`, `recorrido-to-canvas.js`)
3. **Integrar en repos** (guardar canvas en `recorrido_drafts`)
4. **Crear UI del Canvas** (futuro sprint)
5. **Preview desde nodos** (usar Preview Harness)

---

## 📝 NOTAS FINALES

- Este documento define el **modelo interno** del Canvas
- **NO incluye UI** (eso viene en fases posteriores)
- **NO toca DB** todavía (solo se define estructura si hará falta)
- El modelo es **incremental y reversible**
- Compatible con **recorridos actuales** sin breaking changes

---

**Fin del Documento - AXE v0.6.1**

