# Inventario de Migración Admin - AuriPortal

## Estado de Migración a `renderAdminPage()`

Este documento rastrea el estado de migración de todas las rutas `/admin/*` al contrato único `renderAdminPage()`.

**Última actualización**: 2024-12-XX

---

## Clasificación de Handlers

### Tipo A: ✅ Ya usa `renderAdminPage()`
Handlers que ya están migrados al contrato único.

- ✅ `admin-system-diagnostics-page.js` → `/admin/system/diagnostics`
- ✅ `admin-contexts-ui.js` → `/admin/contexts` (migrado)
- ✅ `admin-catalog-registry.js` → `/admin/pde/catalog-registry` (migrado)

### Tipo B: 🔄 Usa `replaceAdminTemplate` / `base.html` legacy
Handlers que usan el sistema legacy pero pueden migrarse fácilmente.

**Island Handlers (archivos separados)**:
- 🔄 `admin-resolvers-studio.js` → `/admin/resolvers`
- 🔄 `admin-transmutaciones-energeticas.js` → `/admin/transmutaciones-energeticas`
- 🔄 `admin-packages-ui.js` → `/admin/packages`
- 🔄 `admin-packages-v2-ui.js` → `/admin/pde/packages-v2`
- 🔄 `admin-widgets-ui.js` → `/admin/widgets`
- 🔄 `admin-widgets-v2-ui.js` → `/admin/pde/widgets-v2`
- 🔄 `admin-automations-ui.js` → `/admin/automations`
- 🔄 `admin-motors.js` → `/admin/motors`
- 🔄 `admin-senales-ui.js` → `/admin/senales`
- 🔄 `admin-themes.js` → `/admin/themes/*`
- 🔄 `admin-screen-templates.js` → `/admin/screen-templates`
- 🔄 `admin-navigation-pages.js` → `/admin/navigation`
- 🔄 `admin-recorridos-preview-ui.js` → `/admin/recorridos/preview`
- 🔄 `admin-themes-v3-ui.js` → `/admin/themes/studio-v3`
- 🔄 `admin-themes-studio-ui.js` → `/admin/themes/studio`

**Handlers dentro de `admin-panel-v4.js` (legacy)**:
- 🔄 `admin-preparaciones-practica.js` → `/admin/preparaciones-practica`
- 🔄 `admin-tecnicas-post-practica.js` → `/admin/tecnicas-post-practica`
- 🔄 `admin-master.js` → `/admin/modo-maestro`
- 🔄 `admin-decretos.js` → `/admin/decretos`
- 🔄 `admin-tecnicas-limpieza.js` → `/admin/tecnicas-limpieza`
- 🔄 `admin-panel-v8-modulos.js` → `/admin/limpieza-hogar`
- 🔄 `admin-master-insight.js` → `/admin/master-insight/*`
- 🔄 `admin-protecciones-energeticas.js` → `/admin/protecciones-energeticas`
- 🔄 `admin-recorridos.js` → `/admin/recorridos`
- 🔄 `admin-configuracion-favoritos.js` → `/admin/configuracion-favoritos`
- 🔄 `admin-capabilities.js` → `/admin/system/capabilities`
- 🔄 `admin-niveles-energeticos.js` → `/admin/niveles-energeticos`
- 🔄 `admin-editor-pantallas.js` → `/admin/editor-pantallas`
- 🔄 `admin-registros-karmicos.js` → `/admin/registros-karmicos`
- 🔄 `admin-transmutaciones-proyectos.js` → `/admin/transmutaciones/proyectos`
- 🔄 `admin-recursos-tecnicos.js` → `/admin/recursos-tecnicos/*`
- 🔄 `admin-limpiezas-master.js` → `/admin/limpiezas-master`
- 🔄 `admin-energias-indeseables.js` → `/admin/energias-indeseables`
- 🔄 `admin-comunicacion-directa.js` → `/admin/comunicacion-directa`
- 🔄 `admin-transmutaciones-personas.js` → `/admin/transmutaciones/personas`
- 🔄 `admin-transmutaciones-lugares.js` → `/admin/transmutaciones/lugares`
- 🔄 `admin-iad-alumnos.js` → `/admin/iad-alumnos`
- 🔄 `admin-panel-modo-maestro.js` → `/admin/modo-maestro`
- 🔄 `admin-panel-modulos.js` → `/admin/modulos`
- 🔄 `admin-automations.js` → `/admin/automations` (legacy)
- 🔄 `admin-panel-workflow.js` → `/admin/configuracion-workflow`
- 🔄 `admin-panel-v61-modulos.js` → `/admin/modulos` (legacy)
- 🔄 `admin-panel-v7-modulos.js` → `/admin/modulos` (legacy)
- 🔄 `admin-panel-reflexiones.js` → `/admin/reflexiones`
- 🔄 `admin-panel-pedagogico.js` → `/admin/respuestas`, `/admin/recorrido-pedagogico`, etc.
- 🔄 `admin-panel-pedagogico-caminos.js` → `/admin/configuracion-caminos`
- 🔄 `admin-panel-misiones.js` → `/admin/misiones`
- 🔄 `admin-panel-logros.js` → `/admin/logros`
- 🔄 `admin-panel-aurigraph.js` → `/admin/aurigraph`
- 🔄 `admin-panel-auricalendar.js` → `/admin/auricalendar`
- 🔄 `admin-panel-audios.js` → `/admin/audios`
- 🔄 `admin-panel-analytics.js` → `/admin/analytics`
- 🔄 `admin-limpieza-hogar.js` → `/admin/limpieza-hogar`

### Tipo C: ⚠️ Renderiza HTML completo manualmente
Handlers que renderizan HTML completo sin usar templates.

- ⚠️ `admin-panel-v4.js` → Todas las rutas legacy (catch-all)
  - Este archivo maneja ~50+ rutas legacy
  - Requiere migración caso por caso
  - Prioridad: ALTA (afecta muchas rutas)

---

## Patrón de Migración

### De Tipo B a Tipo A

**Antes** (usando `replaceAdminTemplate`):
```javascript
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

const html = replaceAdminTemplate(baseTemplate, {
  TITLE: 'Mi Página',
  CONTENT: contentHtml,
  CURRENT_PATH: '/admin/mi-pagina'
});

return new Response(html, {
  headers: { 'Content-Type': 'text/html; charset=UTF-8' }
});
```

**Después** (usando `renderAdminPage`):
```javascript
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const url = new URL(request.url);
const activePath = url.pathname;

return renderAdminPage({
  title: 'Mi Página',
  contentHtml,
  activePath,
  userContext: { isAdmin: true }
});
```

### Cambios Requeridos

1. ✅ Eliminar import de `replaceAdminTemplate`
2. ✅ Eliminar lectura de `baseTemplate`
3. ✅ Reemplazar `replaceAdminTemplate()` con `renderAdminPage()`
4. ✅ Extraer `activePath` de `request.url`
5. ✅ Pasar `userContext: { isAdmin: true }`
6. ✅ Eliminar `new Response()` manual (lo hace `renderAdminPage`)

---

## Priorización

### Prioridad ALTA
- Rutas que no muestran sidebar
- Rutas donde el scroll se reinicia
- Rutas legacy en `admin-panel-v4.js` más usadas

### Prioridad MEDIA
- Island handlers con archivos separados (más fáciles de migrar)
- Handlers que ya usan `replaceAdminTemplate`

### Prioridad BAJA
- Rutas poco usadas
- Rutas que funcionan correctamente con el sistema legacy

---

## Progreso

- **Total de rutas**: ~80+
- **Migradas (Tipo A)**: 3
- **Pendientes (Tipo B)**: ~50+
- **Pendientes (Tipo C)**: ~50+ (dentro de admin-panel-v4.js)

**Progreso**: ~3% completado

---

## Notas

- `admin-panel-v4.js` es un archivo enorme (6242 líneas) que maneja todas las rutas legacy
- La migración de `admin-panel-v4.js` debe hacerse caso por caso
- Cada handler migrado debe probarse individualmente
- El assert en desarrollo detectará rutas que no usan `renderAdminPage()`

---

## Reglas de Migración

1. ❌ NO modificar lógica de negocio
2. ❌ NO cambiar UI o estilos
3. ❌ NO añadir JS nuevo
4. ✅ SOLO migrar el render
5. ✅ Si algo falla, corregir el contrato, no la pantalla

---

## Referencias

- `src/core/admin/admin-page-renderer.js` - Contrato único de renderizado
- `src/core/html/admin/base.html` - Template base
- `src/core/admin/admin-template-helper.js` - Helper legacy (deprecado)
- `src/core/admin/admin-route-registry.js` - Registry de rutas

