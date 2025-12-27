# Theme System v1 - Documentación Canónica

## Objetivo

Sistema de temas robusto y extensible que permite:
- Guardar múltiples temas (ThemeDefinition) con modo light/dark
- Resolver el tema efectivo por capas (global → entorno → editor → pantalla → usuario)
- Aplicar temas en Admin (y preparar Alumno) sin homogeneizar layouts
- Exponer selector de tema reutilizable (dropdown) en cualquier editor/pantalla admin
- Mantener compatibilidad legacy (dark/light → dark-classic/light-classic) pero con Source of Truth nuevo
- Theme Studio v1 mínimo (lista + editor JSON + preview básico) con draft/publish

## Arquitectura

### Capas de Resolución

El tema efectivo se resuelve por capas con esta precedencia:

1. **user override** (opcional v1, pero dejar el hueco)
2. **screen override** (pantalla concreta)
3. **editor override** (p.ej. "nav-editor", "recorridos-editor")
4. **environment override** (admin/student)
5. **global default**

### Source of Truth

PostgreSQL es el Source of Truth soberano:
- Tabla `themes`: temas con draft/publish
- Tabla `theme_versions`: versiones publicadas inmutables
- Tabla `theme_bindings`: bindings por scope/capa

### Tokens Semánticos v1

Set mínimo de tokens semánticos:
- `bg.base`, `bg.surface`, `bg.panel`, `bg.elevated`
- `text.primary`, `text.muted`, `text.inverse`
- `border.subtle`, `border.strong`
- `accent.primary`, `accent.secondary`
- `state.hover`, `state.active`, `state.focus`
- `danger.base`, `warning.base`, `success.base`
- `shadow.soft`, `shadow.medium`
- `radius.sm`, `radius.md`, `radius.lg`
- `spacing.xs/sm/md/lg` (opcional)
- `font.base`, `font.mono` (opcional)

## API

### Endpoints Admin

- `GET /admin/api/themes` → lista themes (published/draft)
- `GET /admin/api/themes/:theme_key` → obtiene draft/published + bindings relevantes
- `POST /admin/api/themes` → crear draft (theme_key, name, definition)
- `PUT /admin/api/themes/:theme_key/draft` → actualizar draft definition
- `POST /admin/api/themes/:theme_key/publish` → publish
- `POST /admin/api/theme-bindings` → setBinding(scope_type, scope_key, theme_key, mode_pref)
- `GET /admin/api/theme-bindings?scope_type=&scope_key=` → leer binding
- `GET /admin/api/themes/__diag` → diagnóstico de resolución

### Servicio Theme System

```javascript
import { resolveTheme, getThemeDefinition, listThemes, saveDraft, publish, setBinding } from '../core/theme-system/theme-system-v1.js';

// Resolver tema por capas
const resolved = await resolveTheme({
  student: student,
  screen: 'admin/tecnicas-limpieza',
  editor: 'nav-editor',
  environment: 'admin'
});

// Obtener definición
const definition = await getThemeDefinition('admin-classic', true);

// Guardar draft
await saveDraft('my-theme', definition, { description: 'Mi tema' });

// Publicar
await publish('my-theme', 'admin@example.com');

// Establecer binding
await setBinding('editor', 'nav-editor', 'admin-classic', 'auto');
```

## UI

### Theme Studio v1

Ruta: `/admin/theme-studio`

Características:
- Lista de temas (theme_key, name, status, version)
- Editor JSON (definition con light/dark)
- Preview básico en tiempo real
- Botones: Guardar Draft, Publicar

### Selector Reutilizable

```javascript
import { createThemeSelector } from '/js/admin/themes/theme-selector-v1.js';

createThemeSelector({
  scope_type: 'editor',
  scope_key: 'nav-editor',
  containerEl: document.getElementById('container')
});
```

## Integración

### Con Theme Resolver Existente

El Theme System v1 se integra con el resolver existente manteniendo compatibilidad legacy:
- Si hay binding en DB, resolver desde Theme System v1
- Si no, usar lógica legacy (dark/light → classic)
- `applyTheme()` inyecta CSS variables canónicas y añade `data-ap-theme` y `data-ap-mode`

### CSS Canónico

Archivo: `public/css/theme-vars-v1.css`

Define nombres canónicos de variables:
- `--ap-bg-base`, `--ap-text-primary`, etc.
- Las pantallas usan variables, no colores hardcode

## Migración

### v5.41.0-theme-system-v1.sql

- Crea tabla `theme_bindings`
- Añade columnas a `themes` (theme_key, definition, version, deleted_at)
- Añade columnas a `theme_versions` (published_at, published_by)
- Seed inicial: `admin-classic` con bindings global/environment

### Aplicar Migración

```bash
sudo -u postgres psql -d aurelinportal -f database/migrations/v5.41.0-theme-system-v1.sql
```

### Verificar

```bash
sudo -u postgres psql -d aurelinportal -c "\d theme_bindings"
sudo -u postgres psql -d aurelinportal -c "SELECT theme_key, status FROM themes WHERE deleted_at IS NULL;"
sudo -u postgres psql -d aurelinportal -c "SELECT scope_type, scope_key, theme_key FROM theme_bindings WHERE deleted_at IS NULL;"
```

## Logs

Todos los logs usan el prefijo `[THEME][V1]`:
- `[THEME][V1] resolveTheme ...`
- `[THEME][V1] binding ...`

## Fail-Open

Si algo falla:
- DB falla → usar default clásico actual
- Tema no encontrado → usar `admin-classic`
- Binding no encontrado → usar binding global
- Validación falla → usar CONTRACT_DEFAULT

## Compatibilidad Legacy

- `dark`/`light` → mapeados a `dark-classic`/`light-classic`
- Resolver existente sigue funcionando
- `applyTheme()` mantiene compatibilidad total


