# Master Sidebar Layout Contract v1 - Conexión Flex

## ⚠️ ESTADO: CANÓNICO / CONSTITUCIONAL v1

**Fecha de implementación**: 2024-12-XX
**Versión**: v1.4.1
**Estado**: ✅ OPERATIVO

---

## Objetivo

Conectar físicamente el sidebar MASTER al layout flex para que:
- Resize funcione de forma REAL y visible
- Fold / Unfold afecte al layout
- Persistencia de ancho funcione tras reload

**Problema identificado**: El sidebar tenía `width: auto` en DevTools, indicando que las variables CSS no estaban conectadas al layout flex.

---

## Contrato Canónico de Layout Flex

### Sidebar Container

**OBLIGATORIO**:
```css
.master-sidebar-container {
  flex: 0 0 var(--master-sidebar-width);
  width: var(--master-sidebar-width);
  min-width: var(--master-sidebar-width-min);
  max-width: var(--master-sidebar-width-max);
}
```

**Explicación**:
- `flex: 0 0 var(--master-sidebar-width)`: 
  - `0` = no crece
  - `0` = no se encoge
  - `var(--master-sidebar-width)` = ancho base (flex-basis)
- `width`: Ancho explícito (backup para navegadores antiguos)
- `min-width` / `max-width`: Límites de redimensionamiento

**PROHIBIDO**:
- ❌ `width: auto` (el flex lo ignora)
- ❌ Clases tailwind `w-*`, `basis-*`, `flex-auto`
- ❌ Cálculos inline JS para el tamaño

### Main Content

**OBLIGATORIO**:
```css
.master-main {
  flex: 1 1 auto;
  min-width: 0;
}
```

**Explicación**:
- `flex: 1 1 auto`:
  - `1` = puede crecer
  - `1` = puede encogerse
  - `auto` = ancho base automático
- `min-width: 0`: Permite que el contenido se comprima correctamente

---

## Variables CSS que Gobiernan el Layout

### Variables Principales

```css
--master-sidebar-width: 280px; /* Ancho base (default) */
--master-sidebar-width-min: 220px; /* Ancho mínimo */
--master-sidebar-width-max: 420px; /* Ancho máximo */
--master-sidebar-width-collapsed: 72px; /* Ancho cuando está plegado */
```

### Cómo Funciona

1. **Estado Normal (Expanded)**:
   - `flex: 0 0 var(--master-sidebar-width)` → usa ancho guardado o default
   - `width: var(--master-sidebar-width)` → ancho explícito

2. **Estado Plegado (Folded)**:
   - `flex: 0 0 var(--master-sidebar-width-collapsed)` → usa ancho colapsado
   - `width: var(--master-sidebar-width-collapsed)` → ancho explícito

3. **Durante Resize**:
   - JS actualiza `--master-sidebar-width` en `:root`
   - CSS `flex-basis` se recalcula automáticamente
   - Layout flex se ajusta en tiempo real

---

## Verificación en DevTools

### Computed Styles

**Sidebar (Expanded)**:
```
width: 280px (o valor guardado)
flex-basis: 280px (o valor guardado)
flex-grow: 0
flex-shrink: 0
```

**Sidebar (Folded)**:
```
width: 72px
flex-basis: 72px
flex-grow: 0
flex-shrink: 0
```

**Main**:
```
flex-grow: 1
flex-shrink: 1
flex-basis: auto
min-width: 0
```

### Verificación Funcional

1. **Resize Drag**:
   - ✅ Al arrastrar, el ancho cambia en tiempo real
   - ✅ DevTools muestra `width` y `flex-basis` actualizándose
   - ✅ Main content se ajusta automáticamente

2. **Fold / Unfold**:
   - ✅ Al plegar, sidebar se reduce a 72px
   - ✅ Main content se expande
   - ✅ Al desplegar, sidebar restaura ancho guardado

3. **Persistencia**:
   - ✅ Tras reload, sidebar mantiene ancho guardado
   - ✅ DevTools muestra `width` = valor guardado
   - ✅ Layout se mantiene correcto

---

## Estructura HTML

```html
<div class="master-layout">
  <aside class="master-sidebar-container">
    <nav id="master-sidebar-container" class="master-sidebar">
      <!-- Contenido del sidebar -->
    </nav>
  </aside>
  
  <main class="master-main">
    <div class="master-content">
      <!-- Contenido principal -->
    </div>
  </main>
</div>
```

**Nota**: El wrapper real del sidebar es `.master-sidebar-container` (el `<aside>`), no el `<nav>` interno.

---

## Transiciones

### Durante Resize

```css
.master-sidebar-container.resizing {
  transition: none; /* Sin transición durante resize para mejor UX */
}
```

### Normal

```css
.master-sidebar-container {
  transition: flex-basis 0.3s ease, width 0.3s ease, box-shadow 0.3s ease;
}
```

**Nota**: `flex-basis` también tiene transición para animaciones suaves al fold/unfold.

---

## Qué NO se ha Tocado

### Arquitectura
- ✅ Registry (`master-sidebar-registry.js`) - **NO modificado**
- ✅ Layout renderer (`master-page-renderer.js`) - **NO modificado**
- ✅ Loaders - **NO modificados**
- ✅ Contratos existentes - **NO modificados**

### Lógica
- ✅ Resize JS - **NO modificado**
- ✅ Fold JS - **NO modificado**
- ✅ Persistencia JS - **NO modificada**

### Estética
- ✅ Variables CSS de luminosidad (v1.3) - **NO modificadas**
- ✅ Estilos visuales - **NO modificados**

---

## Compatibilidad

### Versiones Anteriores

- ✅ **v1.1** (Theme-Ready): Compatible
- ✅ **v1.2** (Fold/Unfold): Compatible y mejorado
- ✅ **v1.3** (Luminosidad Arcana): Compatible
- ✅ **v1.4** (Resize): Compatible y corregido
- ✅ **v1.4.1** (Layout Contract): Nueva versión

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

✅ **CONTRATO APLICADO**
✅ **LAYOUT FLEX CONECTADO**
✅ **RESIZE FUNCIONAL**
✅ **FOLD/UNFOLD FUNCIONAL**
✅ **PERSISTENCIA FUNCIONAL**
✅ **DOCUMENTACIÓN COMPLETA**

**Sistema operativo y listo para producción.**

---

**Última actualización**: 2024-12-XX
**Versión del sistema**: v1.4.1 (CANÓNICO)
