# Master Sidebar v1.4 - Control Físico Completo (Resize + Fold)

## ⚠️ ESTADO: CANÓNICO / CONSTITUCIONAL v1.4

**Fecha de implementación**: 2024-12-XX
**Versión**: v1.4.0
**Estado**: ✅ OPERATIVO

---

## Objetivo

Añadir **CONTROL DEL ESPACIO** al sidebar MASTER mediante resize lateral con drag y persistencia de ancho. Esta fase es **estructural** - no modifica estética ni lógica del contenido.

**Filosofía**: El usuario controla el espacio, el sistema recuerda sus preferencias.

---

## ¿Qué se ha Cambiado?

### Variables CSS Nuevas (v1.4)

Se han añadido 5 nuevas variables CSS canónicas para sizing:

```css
--master-sidebar-width-collapsed: 72px; /* Alias para folded */
--master-sidebar-width-min: 220px; /* Ancho mínimo al redimensionar */
--master-sidebar-width-max: 420px; /* Ancho máximo al redimensionar */
--master-sidebar-resize-handle-width: 4px; /* Ancho del handle de resize */
```

**Características**:
- Todas las variables son theme-ready
- Valores ajustables sin tocar código
- Layout usa SOLO estas variables para sizing

### Resize Handle

- **Zona invisible pero usable**: cursor `col-resize` en borde derecho
- **Anchura**: definida por `--master-sidebar-resize-handle-width` (4px)
- **Comportamiento**:
  - Captura `mousedown` en el handle
  - Escucha `mousemove` y `mouseup` en `document`
  - Calcula nuevo width basado en delta X
  - Clamp entre min y max
  - Actualiza SOLO la CSS variable `--master-sidebar-width`

**PROHIBIDO**:
- ❌ Modificar `style.width` directamente
- ❌ Recalcular layout manualmente
- ❌ Estilos inline dinámicos

### Persistencia de Width

**localStorage key**: `ap_master_sidebar_width_v1`

**Comportamiento**:
- Al cargar: Si existe → aplicar a CSS variable, si no → usar default
- Al resize: Guardar ancho final después de soltar
- Al plegar: Guardar ancho actual antes de plegar
- Al desplegar: Restaurar ancho guardado

### Coordinación con Fold

**Estados compatibles**:
1. **Expanded + resized**: Sidebar desplegado con ancho personalizado
2. **Collapsed**: Sidebar plegado (usa `--master-sidebar-width-collapsed`)
3. **Expanded restored**: Sidebar desplegado restaura último ancho guardado

**Reglas**:
- Collapsed usa `--master-sidebar-width-collapsed` (72px)
- Expanded usa último width guardado (o default 280px)
- No perder el width del usuario al plegar/desplegar
- Resize handle oculto cuando está plegado

---

## Variables CSS Canónicas (v1.4)

### Nuevas Variables de Sizing

```css
/* Ancho colapsado (alias para folded) */
--master-sidebar-width-collapsed: 72px;

/* Límites de redimensionamiento */
--master-sidebar-width-min: 220px;
--master-sidebar-width-max: 420px;

/* Ancho del handle de resize */
--master-sidebar-resize-handle-width: 4px;
```

### Variables Existentes (Mantenidas)

- `--master-sidebar-width: 280px` (default, puede ser sobrescrito por resize)
- `--master-sidebar-width-folded: 72px` (mantenido para compatibilidad)

---

## Keys de localStorage

### `ap_master_sidebar_width_v1`

**Tipo**: `string` (número como string)

**Valor**: Ancho en píxeles (ej: `"320"`)

**Uso**:
- Se guarda después de cada resize
- Se guarda antes de plegar
- Se restaura al desplegar
- Se aplica al cargar si existe

### `ap_master_sidebar_folded_v1` (Existente)

**Tipo**: `string` (`"true"` o `"false"`)

**Uso**: Coordinado con resize para mantener estado

---

## Flujo de Estados

### 1. Carga Inicial

```
1. Cargar estado folded desde localStorage
2. Si NO está plegado:
   - Cargar width desde localStorage
   - Si existe → aplicar a CSS variable
   - Si no → usar default (280px)
3. Si está plegado:
   - Usar width-collapsed (72px)
```

### 2. Resize

```
1. Usuario hace mousedown en resize handle
2. Capturar startX y startWidth
3. Durante mousemove:
   - Calcular deltaX
   - Calcular newWidth = startWidth + deltaX
   - Clamp entre min y max
   - Actualizar CSS variable --master-sidebar-width
4. En mouseup:
   - Guardar width final en localStorage
   - Remover listeners
```

### 3. Fold/Unfold

```
FOLD:
1. Guardar width actual en localStorage
2. Aplicar clase 'folded'
3. Width cambia a --master-sidebar-width-collapsed

UNFOLD:
1. Remover clase 'folded'
2. Cargar width guardado desde localStorage
3. Aplicar a CSS variable --master-sidebar-width
```

### 4. Coordinación Resize + Fold

```
Estado: Expanded + Resized (320px)
  ↓ Usuario hace fold
Estado: Collapsed (72px, width 320px guardado)
  ↓ Usuario hace unfold
Estado: Expanded + Restored (320px restaurado)
```

---

## Implementación Técnica

### CSS

**Resize Handle**:
```css
.master-sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: var(--master-sidebar-resize-handle-width);
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  user-select: none;
  touch-action: none;
}
```

**Estado Resizing**:
```css
.master-sidebar-container.resizing {
  transition: none; /* Desactivar transición durante resize */
}
```

### JavaScript

**Funciones principales**:
- `loadSidebarWidth()`: Carga width desde localStorage
- `saveSidebarWidth(width)`: Guarda width en localStorage
- `applySavedSidebarWidth(container)`: Aplica width guardado a CSS variable
- `createResizeHandle(container)`: Crea y configura el resize handle

**Eventos**:
- `mousedown` en resize handle → iniciar resize
- `mousemove` en document → calcular y aplicar nuevo width
- `mouseup` en document → finalizar resize y guardar

---

## Qué NO se ha Tocado

### Arquitectura
- ✅ Registry (`master-sidebar-registry.js`) - **NO modificado**
- ✅ Layout renderer (`master-page-renderer.js`) - **NO modificado**
- ✅ Loaders (`master-script-loader.js`) - **NO modificado**
- ✅ Contratos existentes - **NO modificados**

### Estética
- ✅ Variables CSS de luminosidad (v1.3) - **NO modificadas**
- ✅ Estilos visuales existentes - **NO modificados**
- ✅ Iconografía - **NO modificada**

### Lógica de Contenido
- ✅ Funcionalidad de colapsado - **NO modificada**
- ✅ Funcionalidad de búsqueda - **NO modificada**
- ✅ Renderizado del sidebar - **NO modificado**

---

## Compatibilidad

### Versiones Anteriores

- ✅ **v1.1** (Theme-Ready): Compatible
- ✅ **v1.2** (Fold/Unfold): Compatible y coordinado
- ✅ **v1.3** (Luminosidad Arcana): Compatible
- ✅ **v1.4** (Resize): Nueva versión

### Incremental y Reversible

Todos los cambios son:
- ✅ Incrementales (no rompen funcionalidad existente)
- ✅ Reversibles (variables CSS pueden desactivarse)
- ✅ Theme-ready (todo vía variables CSS canónicas)

---

## Referencias

- Layout: `src/core/master/layout/master-layout-v1.html`
- Cliente: `public/js/master/master-sidebar-client.js`
- Registry: `src/core/master/registry/master-sidebar-registry.js`
- Renderer: `src/core/master/layout/master-page-renderer.js`

---

## Estado Final

✅ **IMPLEMENTACIÓN COMPLETA**
✅ **RESIZE HANDLE FUNCIONAL**
✅ **PERSISTENCIA DE WIDTH**
✅ **COORDINACIÓN CON FOLD**
✅ **DOCUMENTACIÓN COMPLETA**

**Sistema operativo y listo para producción.**

---

**Última actualización**: 2024-12-XX
**Versión del sistema**: v1.4.0 (CANÓNICO)
