# Theme Definitions v1 - Documentación

## SPRINT AXE v0.4

Documentación de los contratos creados y formalizados para el sistema de Theme Definitions v1 del Admin.

---

## Contratos Formales

### 1. ThemeDefinition v1

**Archivo**: `src/core/theme/theme-definition-contract.js`

**Estructura normalizada**:
```typescript
interface ThemeDefinition {
  id: string;              // ID único del tema (ej: 'dark-classic', 'custom-theme-1')
  name: string;            // Nombre legible del tema
  description?: string;     // Descripción opcional
  tokens: {                 // Mapa completo de variables CSS del contrato
    [key: string]: string;  // Todas las variables de CONTRACT_VARIABLES
  };
  meta?: {                 // Metadata opcional
    version?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
  };
}
```

**Principios**:
- Validación estricta en publish (rechaza si no es válido)
- Validación tolerante en draft (permite warnings, rechaza errores críticos)
- Fail-open absoluto en runtime (fallback a default theme)
- Inmutabilidad en versiones publicadas

**Funciones principales**:
- `validateThemeDefinition(definition)`: Validación estricta para publish
- `validateThemeDefinitionDraft(definition)`: Validación tolerante para draft
- `normalizeThemeDefinition(definition)`: Normaliza y asegura campos requeridos

---

### 2. Almacenamiento (PostgreSQL)

**Migración**: `database/migrations/v5.2.0-create-themes-versioning.sql`

**Tablas**:
- `themes`: Tabla principal de temas (id, name, status, current_draft_id, current_published_version)
- `theme_drafts`: Drafts editables (draft_id, theme_id, definition_json, updated_at, updated_by)
- `theme_versions`: Versiones publicadas e INMUTABLES (theme_id, version, definition_json, status)
- `theme_audit_log`: Log de auditoría append-only
- `theme_rules`: Estructura para reglas futuras (NO se implementa lógica todavía)

**Principios**:
- Draft/Publish inmutable
- Versionado automático (1, 2, 3, ...)
- Auditoría completa de todas las acciones
- Fail-open absoluto en runtime

---

### 3. Repositorios

**Archivos**:
- `src/infra/repos/theme-repo-pg.js`: Repositorio principal de temas
- `src/infra/repos/theme-draft-repo-pg.js`: Repositorio de drafts
- `src/infra/repos/theme-version-repo-pg.js`: Repositorio de versiones

**Funciones principales**:
- `createTheme()`, `getThemeById()`, `listThemes()`, `updateThemeMeta()`
- `createDraft()`, `getCurrentDraft()`, `updateDraft()`
- `getLatestVersion()`, `getVersion()`, `createVersion()`, `deprecateVersion()`

---

### 4. Theme Resolver (Extensión v1.1)

**Archivo**: `src/core/theme/theme-resolver.js`

**Nuevas capacidades**:
- Acepta `theme_id` en input para resolver directamente desde BD
- `resolveThemeAsync()`: Versión async que puede esperar carga de BD
- Mantiene compatibilidad total con código existente

**Lógica de resolución (actualizada)**:
1. Si `theme_id` está especificado → usarlo directamente (v1.1)
2. Si `student.tema_preferido` existe → usarlo (mapeando legacy si es necesario)
3. Si no → usar system_default ('dark-classic')
4. Intentar obtener tema del Theme Registry (sistema + BD async)
5. Si falla → fallback a SYSTEM_DEFAULT o CONTRACT_DEFAULT
6. Validar y rellenar variables faltantes
7. Fail-open absoluto

---

### 5. Endpoints API

**Archivo**: `src/endpoints/admin-themes-api.js`

**Endpoints**:
- `GET /admin/api/themes` - Lista temas
- `POST /admin/api/themes` - Crea tema + draft inicial
- `GET /admin/api/themes/:id` - Obtiene tema completo (meta + draft + published)
- `PUT /admin/api/themes/:id/draft` - Actualiza draft
- `POST /admin/api/themes/:id/publish` - Publica draft como versión
- `POST /admin/api/themes/:id/preview` - Preview de tema (integra con Preview Harness)

**Protecciones**:
- Requiere autenticación admin (`requireAdminContext`)
- Validación estricta en publish (bloquea si hay errores)
- Validación tolerante en draft (permite warnings)

---

### 6. Editor de Temas (Admin v1)

**Ubicación**: `src/core/html/admin/themes/` (pendiente de implementación)

**Componentes**:
- Lista de temas (draft / published)
- Editor JSON con schema
- Validaciones visibles (warnings / errors)
- Botón Preview (usa Preview Harness)
- Botón Publish (con validación dura)

**Estado**: Pendiente de implementación (Sprint siguiente)

---

### 7. Preview de Temas

**Integración con Preview Harness**:
- Endpoint `/admin/api/themes/:id/preview`
- Usa `PreviewContext` con `preview_mode: true`
- Render real del alumno con ese tema
- Sin contaminar analíticas ni estado

**Estado**: Estructura creada, integración completa pendiente

---

### 8. Theme Rules (Preparación Futura)

**Tabla**: `theme_rules`

**Estructura**:
- `rule_type`: 'date', 'event', 'student_state', 'custom'
- `rule_config`: JSONB con configuración flexible
- `priority`: Prioridad de la regla (menor = mayor prioridad)
- `active`: Boolean (NO se usa todavía)

**Estado**: Estructura creada, NO se implementa lógica todavía

---

## Flujo Típico

### 1. Crear Tema
```
POST /admin/api/themes
{
  "id": "dark-classic",
  "name": "Dark Classic"
}
→ Crea tema + draft inicial mínimo
```

### 2. Editar Draft
```
PUT /admin/api/themes/:id/draft
{
  "definition_json": {
    "id": "dark-classic",
    "name": "Dark Classic",
    "tokens": { ... }
  }
}
→ Valida con validateThemeDefinitionDraft (tolerante)
→ Guarda draft si pasa validación básica
```

### 3. Validar Draft
```
GET /admin/api/themes/:id
→ Devuelve draft con warnings/errors visibles
```

### 4. Publicar Versión
```
POST /admin/api/themes/:id/publish
{
  "release_notes": "Versión inicial"
}
→ Valida con validateThemeDefinition (estricto)
→ Bloquea si hay errores
→ Crea versión inmutable
→ Actualiza current_published_version
```

### 5. Usar en Runtime
```
resolveTheme({ theme_id: 'dark-classic' })
→ Resuelve desde versión publicada
→ Fail-open si no existe
```

---

## Protecciones del Runtime

1. **Fail-open absoluto**: Si el tema no existe o falla, usa CONTRACT_DEFAULT
2. **Validación en publish**: Bloquea publicación si hay errores
3. **Inmutabilidad**: Versiones publicadas nunca cambian
4. **Preview mode**: Preview usa `preview_mode: true` para proteger runtime

---

## Tests

**Archivo**: `tests/theme/theme-definition.test.js` (pendiente)

Tests estructurales que verifican:
- Validación de ThemeDefinition (estricta y tolerante)
- Fail-open del resolver
- Protección runtime en preview_mode
- Inmutabilidad de versiones

---

## Próximos Pasos (Fuera del Sprint)

- [ ] Editor de Temas en Admin (UI completa)
- [ ] Integración completa con Preview Harness
- [ ] Tests de integración E2E
- [ ] Implementación de theme_rules (automatizaciones)
- [ ] Cache de temas en memoria para performance

---

**Versión**: 1.0  
**Fecha**: Sprint AXE v0.4  
**Estado**: Contratos y backend completos, UI pendiente
