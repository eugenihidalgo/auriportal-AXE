# 📚 Editor de Navegación AXE - FASE 4

## 🎯 Objetivo

Evolucionar el **Editor de Navegación** para soportar:
- ✅ Navegación GLOBAL y CONTEXTUAL
- ✅ Tipos de nodo semánticos claros
- ✅ Preparación de reglas de visibilidad (sin evaluación)

**CRÍTICO**: Esta fase NO afecta al runtime. Todo es preparatorio y pasivo.

---

## 📋 FASE 4.1 — Tipos de Navegación

### Modelo Extendido

El modelo `NavigationDefinition` ahora soporta:

```javascript
{
  navigation_id: string,
  name: string,
  type: "global" | "contextual",      // NUEVO
  context_key?: string,               // NUEVO (obligatorio si type === contextual)
  entry_node_id: string,
  nodes: { [id]: NodeDefinition },
  edges: EdgeDefinition[],
  meta?: {}
}
```

### Reglas

1. **type = global** → `context_key` debe ser `null` o ausente
2. **type = contextual** → `context_key` obligatorio (string)
3. Solo 1 global activa por entorno (no enforced aún - preparación)
4. `context_key` es libre (ej: `"producto:pde"`, `"programa:limpieza"`)

### Editor UI

- ✅ Selector de tipo de navegación (Global / Contextual) en el header
- ✅ Input `context_key` visible solo si tipo = contextual
- ✅ Info clara en header del editor
- ✅ Validación ligera (warnings, no bloqueos)

### Implementación

**Archivos modificados:**
- `src/core/navigation/navigation-constants.js` - Añadido `NAVIGATION_TYPES` y `NAVIGATION_DEFAULTS`
- `src/core/navigation/navigation-definition-v1.js` - Extendido tipos JSDoc y `normalizeNavigationDefinition()`
- `src/core/html/admin/navigation/navigation-editor.html` - UI con selectores

**Funciones nuevas:**
- `actualizarTipoNavegacion(type)` - Actualiza tipo de navegación
- `actualizarContextKey(contextKey)` - Actualiza context_key

---

## 📋 FASE 4.2 — Tipos de Nodo Semánticos

### Tipos de Nodo Permitidos

```javascript
NODE_TYPES_SEMANTIC = [
  "home",      // Nodo home (solo uno por navegación)
  "section",   // Sección (puede agrupar, no es vista final)
  "view",      // Vista (vista final, requiere target)
  "external",  // Link externo (requiere URL)
  "overlay",   // Overlay (no puede ser entry)
  "return"     // Retorno (solo 1 edge saliente)
]
```

### Estructura de Nodo

Cada nodo ahora puede tener:

```javascript
{
  id: string,
  kind: string,              // Existente (section, group, item, hub, etc.)
  type?: string,             // NUEVO: tipo semántico (home, section, view, etc.)
  label: string,
  target?: { type, ref },    // Requerido según tipo
  position?: { x, y },       // Posición en canvas
  visibility_rules?: {       // FASE 4.3
    min_level?: number,
    max_level?: number,
    flags?: string[],
    products?: string[]
  },
  meta?: {}
}
```

### Reglas Editoriales

1. **home**: Solo uno por navegación (advertencia, no enforced)
2. **return**: Solo 1 edge saliente (advertencia, no enforced)
3. **external**: Requiere URL en target
4. **overlay**: No puede ser entry (advertencia, no enforced)
5. **section**: Puede agrupar, no es vista final
6. **view**: Requiere target

### Panel Lateral

- ✅ Selector de tipo de nodo semántico
- ✅ Campos dinámicos según tipo
- ✅ Validación ligera (warnings, no bloqueos)
- ✅ Ayuda contextual visible con tooltips

### Implementación

**Archivos modificados:**
- `src/core/navigation/navigation-constants.js` - Añadido `NODE_TYPES_SEMANTIC`, `NODES_CANNOT_BE_ENTRY`, `NODES_SINGLE_OUTGOING_EDGE`
- `src/core/navigation/navigation-definition-v1.js` - Extendido tipos JSDoc, actualizado `nodeRequiresTarget()`, añadido `nodeCanBeEntry()`
- `src/core/html/admin/navigation/navigation-editor.html` - UI con selector de tipo semántico

---

## 📋 FASE 4.3 — Preparación de Condiciones (SIN lógica)

### Soporte Pasivo

Añadido soporte para reglas de visibilidad que **NO se evalúan** todavía:

```javascript
visibility_rules: {
  min_level?: number,      // Nivel mínimo requerido
  max_level?: number,      // Nivel máximo permitido
  flags?: string[],        // Feature flags requeridas
  products?: string[]      // Productos requeridos
}
```

### Reglas

1. ✅ **No se evalúan** - Solo se validan como JSON correcto
2. ✅ **No afectan al canvas** - Son puramente declarativas
3. ✅ Se guardan en draft/version
4. ✅ Validación pasiva (solo estructura JSON)

### UI

- ✅ Sección colapsable "👁️ Visibilidad (Futuro)"
- ✅ Tooltip claro: "⚠️ No se evalúa todavía"
- ✅ Campos para min_level, max_level, flags, products
- ✅ Validación JSON ligera

### Implementación

**Archivos modificados:**
- `src/core/navigation/navigation-definition-v1.js` - Añadido `VisibilityRules` typedef, función `validateVisibilityRulesPassive()`
- `src/core/html/admin/navigation/navigation-editor.html` - UI con sección colapsable y campos

**Función nueva:**
- `actualizarVisibilityRules()` - Actualiza reglas de visibilidad (solo guarda, no evalúa)

---

## 🔍 Validaciones

### Principios

1. **Fail-open**: El editor SIEMPRE carga (no rompe navegación existente)
2. **Warnings, no errores**: Si falta algo → warning en consola, no bloqueo
3. **Compatibilidad hacia atrás**: Navegaciones existentes sin nuevos campos funcionan

### Validaciones Implementadas

1. **FASE 4.1**:
   - `type='contextual'` sin `context_key` → warning en consola
   - `type='global'` con `context_key` no-null → warning, se limpia

2. **FASE 4.2**:
   - Validaciones de tipo semántico son advertencias visuales
   - No bloquean el guardado

3. **FASE 4.3**:
   - Validación JSON de `visibility_rules` (solo estructura)
   - No evalúa condiciones

---

## 📝 Logs

Todos los logs usan el prefijo `[AXE][NAV_EDITOR]`:

```javascript
console.log('[AXE][NAV_EDITOR] actualizarTipoNavegacion:', type);
console.warn('[AXE][NAV_EDITOR] normalizeNavigationDefinition: type=contextual sin context_key');
```

---

## ✅ Criterios de Aceptación

- ✅ Puedo crear navegación global y contextual
- ✅ Veo claramente qué tipo es cada una
- ✅ Puedo definir nodos semánticos (home, section, view, etc.)
- ✅ Puedo preparar reglas de visibilidad
- ✅ Nada de esto afecta al runtime actual
- ✅ El editor sigue siendo estable y usable
- ✅ Navegaciones existentes siguen funcionando

---

## 🔄 Compatibilidad

### Navegaciones Existentes

Las navegaciones creadas antes de FASE 4 funcionan correctamente:

- Si no tienen `type` → se asume `'global'` por defecto
- Si no tienen `context_key` → se asume `null`
- Nodos sin `type` semántico → funcionan normalmente
- Nodos sin `visibility_rules` → funcionan normalmente

### Migración

No se requiere migración. Los nuevos campos son opcionales y tienen valores por defecto seguros.

---

## 🚀 Próximos Pasos (Futuras Fases)

1. **Evaluación de condiciones**: Activar evaluación de `visibility_rules` en runtime
2. **Enforcement de reglas**: Hacer obligatorias las validaciones (ej: solo 1 home por navegación)
3. **Runtime contextual**: Usar `context_key` para activar navegaciones contextuales
4. **Validación estricta**: Añadir validaciones estrictas para publicación

---

## 📁 Archivos Modificados

### Core
- `src/core/navigation/navigation-constants.js`
- `src/core/navigation/navigation-definition-v1.js`

### UI
- `src/core/html/admin/navigation/navigation-editor.html`

### Documentación
- `docs/EDITOR_NAVEGACION_FASE_4.md` (este archivo)

---

## 🔗 Referencias

- Editor de Navegación Motor AXE: `docs/EDITOR_NAVEGACION_MOTOR_AXE.md`
- NavigationDefinition v1: `src/core/navigation/navigation-definition-v1.js`
- Constantes de Navegación: `src/core/navigation/navigation-constants.js`

---

**Fecha de implementación**: 2024-12-19  
**Estado**: ✅ Completo  
**Versión**: FASE 4.0



