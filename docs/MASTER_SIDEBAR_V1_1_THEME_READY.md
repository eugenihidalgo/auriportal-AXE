# MASTER SIDEBAR v1.1 - Theme-Ready + Foldable

## Versión
- **v1.1.0-master-sidebar-theme-ready-fold**
- **Fecha**: 2024
- **Estado**: Activo

## Objetivo
Mejorar estética del sidebar MASTER y prepararlo para Theme Editor mediante variables CSS canónicas, añadir funcionalidad de plegar/desplegar sidebar completo, y ajustar estética de secciones.

## Cambios Implementados

### 1. Variables CSS Canónicas (Theme-Ready)

**Archivo**: `src/core/master/layout/master-layout-v1.html`

Se introdujeron variables CSS canónicas en `:root` para todos los aspectos visuales del sidebar:

#### Variables de Contenedor
- `--master-sidebar-width`: Ancho normal (280px)
- `--master-sidebar-width-folded`: Ancho plegado (72px)
- `--master-sidebar-bg`: Color de fondo
- `--master-sidebar-border`: Color de borde
- `--master-sidebar-shadow`: Sombra del contenedor

#### Variables de Texto
- `--master-sidebar-text`: Color de texto normal
- `--master-sidebar-text-muted`: Color de texto secundario
- `--master-sidebar-text-bright`: Color de texto destacado
- `--master-sidebar-text-hover`: Color de texto en hover

#### Variables de Estados
- `--master-sidebar-item-hover-bg`: Fondo en hover
- `--master-sidebar-item-active-bg-start`: Inicio de gradiente activo
- `--master-sidebar-item-active-bg-end`: Fin de gradiente activo
- `--master-sidebar-item-active-shadow`: Sombra de item activo
- `--master-sidebar-item-active-indicator`: Color del indicador activo (barra dorada)

#### Variables de Secciones
- `--master-sidebar-section-title-color`: Color de título de sección
- `--master-sidebar-section-title-size`: Tamaño de título (0.6875rem - más pequeño)
- `--master-sidebar-section-title-weight`: Peso de fuente (700)
- `--master-sidebar-section-title-spacing`: Letter-spacing (0.1em)
- `--master-sidebar-section-title-hover-bg`: Fondo en hover

#### Variables de Espaciado
- `--master-sidebar-padding-x`: Padding horizontal
- `--master-sidebar-padding-y`: Padding vertical
- `--master-sidebar-item-padding-x`: Padding horizontal de items
- `--master-sidebar-item-padding-y`: Padding vertical de items
- `--master-sidebar-section-gap`: Espacio entre secciones
- `--master-sidebar-item-gap`: Espacio entre items

#### Variables de Otros Elementos
- `--master-sidebar-radius`: Border radius general
- `--master-sidebar-radius-sm`: Border radius pequeño
- `--master-sidebar-chevron-color`: Color del chevron
- `--master-sidebar-chevron-size`: Tamaño del chevron
- `--master-sidebar-bookmarks-*`: Variables para bookmarks
- `--master-sidebar-search-*`: Variables para búsqueda

**Regla**: NO se hardcodean colores directamente en reglas de componentes. Todos los valores usan variables CSS.

### 2. Mejoras Estéticas

#### Secciones Más Pequeñas
- Tamaño de título de sección reducido a `0.6875rem`
- Espaciado ajustado para mejor jerarquía visual
- Padding reducido en títulos de sección

#### Sidebar Más Potente Visualmente
- Sombra sutil añadida al contenedor (`box-shadow`)
- Mejor contraste en estados hover/active
- Bordes más definidos

#### Hover/Active Mejorados
- Transiciones suaves en todos los estados
- Colores más claros y definidos
- Indicador activo (barra dorada) más visible

### 3. Fold/Unfold Sidebar Completo

**Archivo**: `public/js/master/master-sidebar-client.js`

#### Funcionalidad
- Botón toggle en header del sidebar (flecha ◀/▶)
- Persistencia en `localStorage` con key `ap_master_sidebar_folded_v1`
- Cuando está plegado:
  - Ancho reduce a 72px
  - Labels ocultos
  - Solo iconos/emojis visibles
  - Tooltips en hover para mostrar label

#### Implementación
- Funciones `loadSidebarFoldedState()` y `saveSidebarFoldedState()`
- Modificación de `createSidebarHeader()` para incluir botón toggle
- CSS para estados plegado/desplegado
- Tooltips CSS usando `attr(data-tooltip)`

### 4. Iconos/Emojis

**Regla Canónica**: Solo se renderizan iconos si son emojis/símbolos Unicode visibles.

- Si `entry.icon` es id técnico (`alchemy`, `work`, etc.), NO se renderiza
- Si `entry.icon` es emoji/símbolo Unicode, se renderiza como `<span>` con `textContent`
- NUNCA se concatena icon id con label
- NUNCA se muestra texto técnico en UI

### 5. Secciones Colapsables

**Mantenido**: Funcionalidad existente de colapsar/expandir secciones.

**Mejorado**: 
- Alineado con nueva estética
- Chevron más pequeño y elegante
- Espaciados ajustados

**Persistencia**: Se mantiene key existente `ap_master_sidebar_collapsed_v1`

## Keys de localStorage

- `ap_master_sidebar_folded_v1`: Boolean - Estado de sidebar plegado/desplegado
- `ap_master_sidebar_collapsed_v1`: Array - Secciones colapsadas (existente)
- `ap_master_sidebar_bookmarks_v1`: Array - Bookmarks (existente)

## Archivos Modificados

1. **src/core/master/layout/master-layout-v1.html**
   - Variables CSS canónicas añadidas
   - Todos los valores hardcodeados reemplazados por variables
   - CSS para estados folded/unfolded
   - CSS para tooltips
   - Botón fold toggle en header

2. **public/js/master/master-sidebar-client.js**
   - Funciones de carga/guardado de estado folded
   - Modificación de `createSidebarHeader()` para incluir toggle
   - Añadido `data-tooltip` a items para tooltips

## Verificación

### Checklist de Verificación

- [ ] Ejecutar `npm run check:master-ui`
- [ ] Ejecutar `npm run check:assets-master`
- [ ] Abrir `/master` en navegador
- [ ] Abrir `/master/templo-luz/proyectos` en navegador
- [ ] Verificar:
  - Sidebar se ve bonito y jerárquico
  - Títulos de sección más pequeños
  - Fold/unfold funciona y persiste
  - Colapsar secciones funciona
  - NO aparecen ids técnicos (alchemy/work/etc.)
  - Tooltips aparecen cuando está plegado
  - Variables CSS funcionan correctamente

### Pruebas Visuales

1. **Sidebar Normal**:
   - Ancho: 280px
   - Todos los labels visibles
   - Secciones con títulos pequeños
   - Hover/active funcionan

2. **Sidebar Plegado**:
   - Ancho: 72px
   - Solo iconos/emojis visibles
   - Tooltips en hover
   - Botón toggle cambia a flecha derecha

3. **Secciones Colapsables**:
   - Chevron rota correctamente
   - Estado persiste en localStorage
   - Espaciados consistentes

## Compatibilidad

- **Backward Compatible**: Sí
- **Breaking Changes**: No
- **Dependencias**: Ninguna nueva
- **Browser Support**: Navegadores modernos (CSS variables)

## Referencias

- **Registry**: `src/core/master/registry/master-sidebar-registry.js`
- **Cliente JS**: `public/js/master/master-sidebar-client.js`
- **Layout**: `src/core/master/layout/master-layout-v1.html`
- **Contrato Registry**: `docs/MASTER_SIDEBAR_REGISTRY_CONTRACT.md`
- **Contrato CSS**: `docs/MASTER_SIDEBAR_CSS_CONTRACT.md`

## Próximos Pasos (Futuro)

- Theme Editor para modificar variables CSS dinámicamente
- Más opciones de personalización visual
- Temas predefinidos (dark, light, ritual, etc.)

## Commit Info

- **VERSION NAME**: `v1.1.0-master-sidebar-theme-ready-fold`
- **COMMIT MESSAGE**: `feat(master): sidebar theme-ready + foldable (v1.1)`
- **DESCRIPTION**: Sidebar MASTER v1.1 con variables CSS canónicas (theme-ready), funcionalidad fold/unfold con persistencia, mejoras estéticas (secciones más pequeñas, sidebar más potente visualmente), y tooltips cuando está plegado.
