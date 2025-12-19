# Screen Templates v1 - Documentación

## SPRINT AXE v0.5 - Screen Templates v1

Sistema de templates de pantallas reutilizables y versionados para AuriPortal.

---

## 📋 Contrato ScreenTemplateDefinition

### Estructura

```typescript
interface ScreenTemplateDefinition {
  id: string;                    // ID único (ej: 'welcome-screen')
  name: string;                  // Nombre legible (ej: 'Pantalla de Bienvenida')
  description?: string;          // Descripción opcional
  template_type: string;         // Tipo (ej: 'welcome', 'practice', 'navigation', 'custom')
  schema: {                      // Schema JSON Schema compatible
    type: 'object';
    properties: {
      [propName: string]: {
        type: 'string' | 'number' | 'boolean' | 'object';
        // ... más propiedades del schema
      };
    };
    required?: string[];
  };
  ui_contract?: {                // Contrato de UI (slots, layout)
    slots?: string[];
    layout?: string;
  };
  meta?: {                       // Metadata opcional
    version?: string;
    created_at?: string;
    updated_at?: string;
  };
}
```

### Validación

- **Publish (estricta)**: Rechaza si hay errores críticos
- **Draft (tolerante)**: Permite warnings, solo rechaza errores críticos
- **Runtime (fail-open)**: Siempre válido, solo genera warnings

---

## 🗄️ Almacenamiento

### Tablas PostgreSQL

1. **screen_templates**: Tabla principal
   - `id` (TEXT PRIMARY KEY)
   - `name` (TEXT)
   - `status` ('draft' | 'published' | 'deprecated' | 'archived')
   - `current_draft_id` (UUID)
   - `current_published_version` (INT)

2. **screen_template_drafts**: Drafts editables
   - `draft_id` (UUID PRIMARY KEY)
   - `screen_template_id` (TEXT FK)
   - `definition_json` (JSONB)
   - `updated_by` (TEXT)

3. **screen_template_versions**: Versiones publicadas (INMUTABLES)
   - `screen_template_id` (TEXT FK)
   - `version` (INT)
   - `status` ('published' | 'deprecated')
   - `definition_json` (JSONB) - NUNCA cambia después de publicación
   - `release_notes` (TEXT)

4. **screen_template_audit_log**: Auditoría append-only
   - `id` (UUID PRIMARY KEY)
   - `screen_template_id` (TEXT)
   - `draft_id` (UUID)
   - `action` (TEXT)
   - `details_json` (JSONB)
   - `created_by` (TEXT)

### Migración

```bash
# Ejecutar migración
psql -d aurelinportal -f database/migrations/v5.4.0-create-screen-templates-versioning.sql
```

---

## 🔧 Repositorios

### screen-template-draft-repo-pg.js

- `createDraft(screen_template_id, definition_json, updated_by, client)`
- `getDraftById(draft_id, client)`
- `updateDraft(draft_id, definition_json, updated_by, client)`
- `getCurrentDraft(screen_template_id, client)`

### screen-template-version-repo-pg.js

- `getLatestVersion(screen_template_id, client)`
- `getVersion(screen_template_id, version, client)`
- `createVersion(screen_template_id, version, definition_json, release_notes, created_by, client)`
- `deprecateVersion(screen_template_id, version, client)`
- `getAllVersions(screen_template_id, client)`

### screen-template-audit-repo-pg.js

- `append(screen_template_id, draft_id, action, details_json, created_by, client)`
- `listByTemplate(screen_template_id, limit, client)`

---

## 🎨 Runtime Renderer

### renderScreenTemplate()

Renderiza un screen template con props dadas.

**Principios:**
- Fail-open absoluto: si falla, devuelve HTML básico válido
- Validación suave: valida props pero no bloquea
- Integración con Theme Resolver: aplica tema automáticamente
- NO lógica de negocio: solo renderiza HTML
- NO persistencia: solo renderiza, no guarda

**Uso:**

```javascript
import { renderScreenTemplate } from '../core/screen-template/screen-template-renderer.js';

const html = await renderScreenTemplate(
  'welcome-screen',
  { title: 'Bienvenido', message: 'Hola mundo' },
  student,  // opcional
  theme_id  // opcional, para preview
);
```

### renderScreenTemplatePreview()

Renderiza en modo preview usando PreviewContext.

```javascript
import { renderScreenTemplatePreview } from '../core/screen-template/screen-template-renderer.js';
import { getSafePreviewContext } from '../core/preview/preview-context.js';

const previewContext = getSafePreviewContext({
  student: { nivel: '3', nombre: 'Test' }
});

const html = await renderScreenTemplatePreview(
  'welcome-screen',
  { title: 'Preview' },
  previewContext
);
```

---

## 🖥️ Editor Admin

### Rutas

- `GET /admin/screen-templates` - Listado de templates
- `GET /admin/screen-templates/new` - Crear nuevo template
- `GET /admin/screen-templates/:id/edit` - Editor de template

### API REST

- `GET /api/admin/screen-templates` - Listar todos
- `POST /api/admin/screen-templates` - Crear nuevo
- `GET /api/admin/screen-templates/:id/draft` - Obtener draft
- `PUT /api/admin/screen-templates/:id/draft` - Actualizar draft
- `POST /api/admin/screen-templates/:id/publish` - Publicar versión
- `POST /api/admin/screen-templates/validate` - Validar definición
- `POST /api/admin/screen-templates/preview` - Preview
- `GET /api/admin/screen-templates/:id/audit` - Log de auditoría

### Funcionalidades

1. **Editor JSON**: Editor de texto para editar definición JSON
2. **Validación**: Botón para validar definición (muestra errores/warnings)
3. **Preview**: Botón para ver preview usando Preview Harness
4. **Guardar Draft**: Guarda como draft (validación tolerante)
5. **Publicar**: Publica versión inmutable (validación estricta)
6. **Auditoría**: Muestra log de todas las acciones

---

## 🔍 Preview Integration

El preview se integra con Preview Harness existente:

1. Usa `PreviewContext` para simular contexto de estudiante
2. Usa `Theme Resolver` para aplicar tema
3. Renderiza HTML real con tema aplicado
4. Protegido: `preview_mode = true` (no contamina runtime ni analíticas)

---

## ✅ Tests

### screen-template-definition-contract.test.js

- Validación estricta (publish)
- Validación tolerante (draft)
- Normalización
- Validación de props (fail-open)

### screen-template-renderer.test.js

- Renderizado de template válido
- Fallback cuando template no existe (fail-open)
- Manejo de errores (fail-open)
- Preview con PreviewContext

---

## 🚀 Flujo Típico

### 1. Crear Template

```javascript
// POST /api/admin/screen-templates
{
  "definition": {
    "id": "welcome-screen",
    "name": "Pantalla de Bienvenida",
    "template_type": "welcome",
    "schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "message": { "type": "string" }
      },
      "required": ["title"]
    },
    "html_template": "<html><body><h1>{{title}}</h1><p>{{message}}</p></body></html>"
  }
}
```

### 2. Editar Draft

```javascript
// PUT /api/admin/screen-templates/welcome-screen/draft
{
  "definition": {
    // ... definición actualizada
  }
}
```

### 3. Validar

```javascript
// POST /api/admin/screen-templates/validate
{
  "definition": {
    // ... definición a validar
  }
}
```

### 4. Preview

```javascript
// POST /api/admin/screen-templates/preview
{
  "screen_template_id": "welcome-screen",
  "props": {
    "title": "Bienvenido",
    "message": "Hola mundo"
  }
}
```

### 5. Publicar

```javascript
// POST /api/admin/screen-templates/welcome-screen/publish
{
  "definition": {
    // ... definición validada
  },
  "release_notes": "Versión inicial"
}
```

### 6. Usar en Runtime

```javascript
import { renderScreenTemplate } from '../core/screen-template/screen-template-renderer.js';

const html = await renderScreenTemplate(
  'welcome-screen',
  { title: 'Bienvenido', message: 'Hola' },
  student
);
```

---

## 📝 Notas Importantes

1. **Inmutabilidad**: Las versiones publicadas NUNCA cambian
2. **Fail-open**: El runtime siempre devuelve HTML válido, incluso si falla
3. **Validación**: Estricta en publish, tolerante en draft
4. **Preview**: Protegido, no contamina runtime
5. **Auditoría**: Append-only, nunca se modifica ni elimina

---

## 🔮 Futuro

- Compilación de templates más sofisticada
- Slots y layouts dinámicos
- Template functions (JavaScript en templates)
- Integración con Canvas de Recorridos
- IA para generar templates

---

**Sprint AXE v0.5 - Screen Templates v1 - Completado**




