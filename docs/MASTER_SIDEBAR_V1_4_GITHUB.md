# Master Sidebar v1.4 - Datos para GitHub

## VERSION NAME

```
v1.4.0-master-sidebar-resizable
```

## COMMIT MESSAGE

```
feat(master): sidebar resizable + width persistence (v1.4)
```

## DESCRIPTION

Control físico completo del Sidebar MASTER: resize lateral con drag,
persistencia de ancho, coordinación con estado plegado y sizing gobernado
exclusivamente por CSS variables. Cambios estructurales, theme-ready,
sin tocar lógica ni arquitectura.

## CAMBIOS PRINCIPALES

### Variables CSS Nuevas (v1.4)

5 nuevas variables CSS canónicas para sizing:
- `--master-sidebar-width-collapsed: 72px`
- `--master-sidebar-width-min: 220px`
- `--master-sidebar-width-max: 420px`
- `--master-sidebar-resize-handle-width: 4px`

### Resize Handle

- Zona invisible pero usable (cursor: col-resize)
- Situada en borde derecho del sidebar
- Drag para redimensionar entre min y max
- Actualiza SOLO CSS variable `--master-sidebar-width`

### Persistencia de Width

- **localStorage key**: `ap_master_sidebar_width_v1`
- Se guarda después de cada resize
- Se guarda antes de plegar
- Se restaura al desplegar
- Se aplica al cargar si existe

### Coordinación con Fold

- Estados compatibles: Expanded + resized, Collapsed, Expanded restored
- Resize handle oculto cuando está plegado
- Width guardado se restaura al desplegar

## ARCHIVOS MODIFICADOS

1. **`src/core/master/layout/master-layout-v1.html`**
   - Añadidas 5 variables CSS nuevas
   - Estilos para resize handle
   - Estado resizing sin transición

2. **`public/js/master/master-sidebar-client.js`**
   - Funciones de persistencia de width
   - Función `createResizeHandle()`
   - Coordinación con fold existente

## ARCHIVOS NO MODIFICADOS

- ✅ Registry (`master-sidebar-registry.js`) - NO tocado
- ✅ Layout renderer (`master-page-renderer.js`) - NO tocado
- ✅ Loaders - NO tocados
- ✅ Contratos existentes - NO modificados
- ✅ Estética (v1.3) - NO modificada

## IMPLEMENTACIÓN TÉCNICA

### CSS

- Resize handle con `position: absolute` y `cursor: col-resize`
- Estado `.resizing` sin transición para mejor UX
- Handle oculto cuando está plegado

### JavaScript

- `loadSidebarWidth()`: Carga desde localStorage
- `saveSidebarWidth(width)`: Guarda en localStorage
- `applySavedSidebarWidth(container)`: Aplica a CSS variable
- `createResizeHandle(container)`: Crea y configura handle
- Eventos: mousedown, mousemove, mouseup

## COMPATIBILIDAD

- ✅ Compatible con v1.1 (Theme-Ready)
- ✅ Compatible con v1.2 (Fold/Unfold)
- ✅ Compatible con v1.3 (Luminosidad Arcana)
- ✅ Incremental y reversible
- ✅ Theme-ready (todo vía variables CSS)

## REFERENCIAS

- Documentación: `docs/MASTER_SIDEBAR_V1_4_RESIZE.md`
- Layout: `src/core/master/layout/master-layout-v1.html`
- Cliente: `public/js/master/master-sidebar-client.js`

---

**ESTADO**: ✅ IMPLEMENTACIÓN COMPLETA Y VERIFICADA
