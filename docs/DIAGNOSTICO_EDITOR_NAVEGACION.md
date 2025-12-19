# 🔍 Diagnóstico: Editor de Navegación Actual

**Fecha**: 2025-01-27  
**Objetivo**: Analizar el estado actual del editor de navegación antes de portar el motor visual AXE

---

## 📋 RESUMEN EJECUTIVO

El editor de navegación (`navigation-editor.html`) existe pero **NO usa el motor visual AXE**. Actualmente solo tiene:
- ✅ Vista de lista/árbol HTML (no canvas visual)
- ✅ Panel de propiedades básico
- ✅ Drag & drop básico entre listas
- ❌ **NO tiene canvas visual con pan/zoom**
- ❌ **NO tiene renderizado SVG de edges**
- ❌ **NO tiene motor visual reutilizable**

---

## 🏗️ ARQUITECTURA ACTUAL

### Estructura del Editor

```
navigation-editor.html
├── Topbar (guardar, validar, exportar, publicar)
├── Tabs (Mapa, Árbol, JSON)
└── Vista Mapa (3 columnas):
    ├── Columna Izq: Lista de nodos (HTML)
    ├── Columna Centro: Propiedades del nodo
    └── Columna Derecha: Preview JSON
```

### Modelo de Datos

**NavigationDefinition** (actual):
```javascript
{
  nodes: {
    "node-id": {
      id: "node-id",
      kind: "section|group|item|hub|external_link|system_entry",
      label: "Texto visible",
      subtitle: "...",
      icon: "...",
      order: 0,
      layout_hint: "list|grid|map|cards|tree",
      target: {
        type: "recorrido|pde_catalog|screen|url|admin_tool",
        ref: "..."
      },
      visibility: {...}
    }
  },
  edges: [
    {
      from: "parent-id",
      to: "child-id",
      kind: "child",
      order: 0
    }
  ],
  entry_node_id: "root-node-id"
}
```

### Estado del Editor

```javascript
editorState = {
  navigationId: null,
  definition: null,      // NavigationDefinition
  tree: null,            // Árbol jerárquico (fuente de verdad local)
  selectedNodeId: null,
  dirty: false,
  valid: false,
  currentView: 'mapa',   // 'mapa', 'arbol', 'json'
  treeState: {}          // Estado expand/collapse
}
```

---

## ❌ LO QUE NO FUNCIONA / FALTA

### 1. **NO hay Canvas Visual**
- La "Vista Mapa" es solo una lista HTML vertical
- No hay renderizado visual de nodos posicionados
- No hay pan/zoom/drag visual

### 2. **NO hay Motor Visual Reutilizable**
- El código está acoplado a la vista de lista
- No hay funciones de canvas renderer
- No hay handlers de pan/zoom/drag

### 3. **Drag & Drop Limitado**
- Solo drag & drop entre listas HTML
- No hay drag visual de nodos en canvas
- No hay conexiones visuales (edges SVG)

### 4. **NO hay Renderizado de Edges**
- Las conexiones solo se muestran en el árbol
- No hay líneas SVG conectando nodos

---

## ✅ LO QUE SÍ FUNCIONA

1. **Carga y Guardado**
   - ✅ Carga `navigationDefinition` desde draft/published
   - ✅ Guarda draft correctamente
   - ✅ Serialización tree ↔ definition funciona

2. **Vista Árbol**
   - ✅ Renderiza árbol jerárquico
   - ✅ Expand/collapse funciona
   - ✅ Selección de nodos funciona

3. **Panel de Propiedades**
   - ✅ Edición de propiedades básicas (id, kind, label, etc.)
   - ✅ Actualización en tiempo real

4. **Validación y Publicación**
   - ✅ Validación básica funciona
   - ✅ Publicación funciona

---

## 🎯 MOTOR VISUAL AXE (Editor de Recorridos)

### Componentes Reutilizables

1. **Canvas Renderer**
   - `renderCanvasViewer(canvas)` - Renderiza nodos y edges
   - `renderCanvasEdges(canvas)` - Renderiza edges como SVG

2. **Estado Visual**
   ```javascript
   window.canvasVisualState = {
     panX: 0,
     panY: 0,
     zoom: 1,
     isDragging: false,
     dragNodeId: null,
     isPanning: false,
     snappingEnabled: false,
     snapGrid: 20
   }
   ```

3. **Handlers de Interacción**
   - `handleNodeMouseDown(event, nodeId)` - Inicio drag nodo
   - `handleCanvasMouseMove(event)` - Movimiento durante drag/pan
   - `handleCanvasMouseUp(event)` - Fin drag/pan
   - `handleCanvasMouseDown(event)` - Inicio pan del canvas
   - `handleCanvasWheel(event)` - Zoom con Alt+rueda
   - `handleNodeClick(event, nodeId)` - Selección de nodo

4. **Funciones de Zoom/Pan**
   - `zoomInCanvas()`, `zoomOutCanvas()`
   - `resetCanvasView()`
   - `toggleSnapping()`
   - `updateZoomDisplay()`

5. **Selección**
   - `seleccionarNodo(nodeId)` - Selecciona nodo
   - `deseleccionarNodo()` - Deselecciona
   - `window.canvasSelectionState = { selectedNodeId: null }`

---

## 🔄 ADAPTACIÓN NECESARIA

### 1. Modelo de Datos

**NavigationDefinition** → **CanvasDefinition** (adaptador):

```javascript
// NavigationDefinition usa:
nodes: { "id": { id, kind, label, ... } }
edges: [{ from, to, kind: "child", order }]

// CanvasDefinition (AXE) usa:
nodes: [{ id, type, label, position: {x, y}, ... }]
edges: [{ from_node_id, to_node_id, type, ... }]
```

**Adaptador necesario**:
- `navigationDefinitionToCanvas(navDef)` - Convierte NavigationDefinition → CanvasDefinition
- `canvasToNavigationDefinition(canvas)` - Convierte CanvasDefinition → NavigationDefinition

### 2. Mapeo de Tipos

```javascript
// NavigationDefinition.kind → CanvasDefinition.type
"section" → "section"
"group" → "group"
"item" → "item"
"hub" → "hub"
"external_link" → "external"
"system_entry" → "start"  // o "entry"
```

### 3. Posiciones

- NavigationDefinition NO tiene `position` en nodos
- CanvasDefinition SÍ requiere `position: {x, y}`
- **Solución**: Generar posiciones automáticas basadas en el árbol jerárquico

---

## 📝 PLAN DE PORTADO

### FASE 1: Portar Motor Visual
1. Copiar funciones de canvas renderer del editor de recorridos
2. Adaptar para usar NavigationDefinition
3. Crear adaptador NavigationDefinition ↔ CanvasDefinition
4. Integrar en vista "Mapa" del editor de navegación

### FASE 2: Modelo de Datos Mínimo
1. Definir NavigationDefinition v1 (ya existe, validar)
2. Crear adaptador bidireccional
3. Validación mínima (1 entry route, ids únicos)

### FASE 3: Guardado Básico
1. Guardar NavigationDefinition como draft
2. Sincronizar posiciones del canvas al definition
3. Fail-open como en AXE

---

## ✅ CRITERIOS DE ÉXITO

- [ ] El editor de navegación carga sin errores
- [ ] Usa el MISMO motor visual que recorridos
- [ ] Se pueden crear y mover nodos en canvas
- [ ] Se pueden conectar nodos (edges visuales)
- [ ] Se guarda un draft de navegación
- [ ] El panel lateral muestra propiedades básicas

---

## 🚫 NO IMPLEMENTAR AÚN

- Condiciones complejas
- Roles
- Niveles
- Publish final
- Runtime real

---

**Estado**: ✅ Diagnóstico completo. Listo para FASE 1.



