# LayoutRegistry v1 — Contrato Canónico

## Propósito

El LayoutRegistry v1 es el Source of Truth canónico que define la jerarquía completa de universos, layouts, sidebars y rutas del Admin Master de AuriPortal.

Este registry **NO** es un catálogo decorativo. Es el contrato que gobierna:
- Qué universos existen y cómo se organizan
- Qué layouts están disponibles y qué slots/features soportan
- Qué sidebars corresponden a cada universo
- Qué rutas mapean a qué universos/layouts

## Jerarquía: Universe → Layout → Sidebar → Router

```
Universe (u_*)
  ├── layout_id → Layout (layout_*_v1)
  │     ├── slots: ["sidebar", "main", "notes_panel", ...]
  │     ├── supports: ["theme_resolver", "acs_runtime_guard", ...]
  │     └── constraints: ["no_inline_js", "no_dynamic_innerHTML", ...]
  │
  ├── sidebar_id → Sidebar (sidebar_*_v1)
  │     ├── universe_id: referencia al universe
  │     ├── features: ["bookmarks", "global_search"]
  │     └── sections: [] (definición de secciones del sidebar)
  │
  └── entry_route_key → Route (route.*.home)
        ├── universe_id: referencia al universe
        ├── layout_id: referencia al layout
        └── path_hint: "/admin/..."
```

## Invariantes Constitucionales

1. **Router nunca elige layout**: El router resuelve handlers y delega layout/sidebar al LayoutRegistry.
2. **Todo universe tiene layout y sidebar**: No existe universe sin `layout_id` y `sidebar_id` válidos.
3. **Prohibición de HTML en JS**: No inline JS, no dynamic innerHTML, no HTML en strings JS.
4. **Bookmarks y Global Search siempre disponibles**: Todos los sidebars deben soportar estas features.
5. **ACS-R obligatorio**: ACS Runtime debe ejecutarse en toda página admin renderizada por el pipeline canónico.

## Estructura del Registry

### Schema y Versión

```json
{
  "schema": "auri.admin.layout_registry.v1",
  "version": "1.0.0",
  "generated_at": "2025-12-30"
}
```

### Universes

Cada universe representa un dominio funcional del Admin Master:

- `u_limpiezas`: Limpiezas Energéticas
- `u_alumnos`: Alumnos
- `u_recursos`: Recursos Pedagógicos
- `u_diseno`: Diseño / Editores
- `u_analiticas`: Analíticas
- `u_marketing`: Marketing & Comunicaciones
- `u_automatizaciones`: Automatizaciones
- `u_tienda`: Tienda Física (future)
- `u_systema`: Systema

**Campos obligatorios:**
- `id`: Identificador único (prefijo `u_`)
- `name`: Nombre legible
- `status`: `"active"` | `"future"` | `"archived"`
- `owner_role`: `"master"` | `"ops"` | `"system"`
- `layout_id`: Referencia a un layout existente
- `sidebar_id`: Referencia a un sidebar existente
- `entry_route_key`: Ruta de entrada al universe
- `theme_scope`: `"universe"` | `"global"`
- `notes_enabled`: Boolean
- `diagnostics_enabled`: Boolean

### Layouts

Cada layout define la estructura de slots y capacidades:

**Slots estándar:**
- `sidebar`: Barra lateral
- `main`: Área principal de contenido
- `notes_panel`: Panel de notas
- `diagnostics_panel`: Panel de diagnósticos
- `overlays`: Capas superpuestas (modals, toasts, etc.)

**Supports (features del layout):**
- `theme_resolver`: Soporte para Theme Resolver
- `acs_runtime_guard`: Guard de ACS Runtime
- `focus_mode`: Modo de enfoque
- `widgets`: Sistema de widgets
- `notes_panel`: Panel de notas

**Constraints (prohibiciones):**
- `no_inline_js`: Prohibido JS inline
- `no_dynamic_innerHTML`: Prohibido innerHTML dinámico
- `no_html_in_js_strings`: Prohibido HTML en strings JS

### Sidebars

Cada sidebar está vinculado a un universe y define sus features:

**Features obligatorias:**
- `bookmarks`: Marcadores globales
- `global_search`: Búsqueda global

**Sections:**
Array de secciones del sidebar (definición futura, por ahora vacío).

### Routes

Cada route mapea una ruta HTTP a un universe y layout:

- `route_key`: Identificador canónico (ej: `route.alumnos.home`)
- `path_hint`: Pista de ruta HTTP (ej: `/admin/alumnos`)
- `universe_id`: Referencia al universe
- `layout_id`: Referencia al layout

## Registry JSON Completo

El registry completo se encuentra en:
`src/core/admin/layout/layout-registry.v1.json`

Este archivo es el Source of Truth absoluto. Cualquier cambio debe:
1. Pasar validación (`npm run validate:layout-registry`)
2. Pasar tests (`npm test`)
3. Ser documentado en este archivo

## Roadmap de Migración

### Fase 1: Registry y Validador (ACTUAL)
- ✅ Registry JSON canónico
- ✅ Validador mínimo
- ✅ Tests básicos
- ✅ CLI de validación

### Fase 2: Integración con Router (FUTURO)
- Router consulta LayoutRegistry para resolver layout/sidebar
- Router delega renderizado a LayoutResolver
- Eliminación de lógica hardcodeada de layouts

### Fase 3: LayoutResolver (FUTURO)
- LayoutResolver consume LayoutRegistry
- Renderiza layouts según slots definidos
- Aplica constraints (no inline JS, etc.)

### Fase 4: SidebarResolver (FUTURO)
- SidebarResolver consume LayoutRegistry
- Renderiza sidebars según features definidas
- Integra Bookmarks y Global Search

### Fase 5: Migración Completa (FUTURO)
- Todas las rutas admin usan LayoutRegistry
- Eliminación de código legacy
- Auditoría de cumplimiento de constraints

## Validación

### Validador

El validador (`layout-registry-validate.js`) verifica:

1. **Schema y versión**: Debe ser `auri.admin.layout_registry.v1` y `1.0.0`
2. **IDs únicos**: Todos los IDs deben ser únicos dentro de su categoría
3. **Referencias válidas**: 
   - Universes deben apuntar a layouts y sidebars existentes
   - Routes deben apuntar a universes y layouts existentes
   - Sidebars deben apuntar a universes existentes
4. **Required slots**: Todos los layouts deben tener los slots requeridos
5. **Required features**: Todos los sidebars deben tener las features requeridas

### Uso

```bash
# Validar registry
npm run validate:layout-registry

# Ejecutar tests
npm test -- layout-registry-validate
```

## Diagnósticos

El registry incluye una sección `diagnostics` que define:

- **required_slots**: Slots que todos los layouts deben tener
- **required_features**: Features que todos los sidebars deben tener
- **forbidden**: Prácticas prohibidas (inline_js, dynamic_innerHTML, html_in_js_strings)

Estos valores se usan para validación y auditoría.

## Notas de Implementación

### NO Implementado Aún

- ❌ Router no consulta LayoutRegistry todavía
- ❌ LayoutResolver no existe todavía
- ❌ SidebarResolver no existe todavía
- ❌ Renderizado basado en slots no está activo

### Compatibilidad

Este registry es **incremental y reversible**. No rompe funcionalidad existente:
- El admin actual sigue funcionando
- Las rutas existentes no se modifican
- Los sidebars existentes no se tocan

### Próximos Pasos

1. Integrar LayoutRegistry en Router
2. Crear LayoutResolver
3. Crear SidebarResolver
4. Migrar rutas una por una
5. Auditar cumplimiento de constraints

---

**Versión**: 1.0.0  
**Fecha**: 2025-12-30  
**Estado**: Registry y Validador completos, integración pendiente


