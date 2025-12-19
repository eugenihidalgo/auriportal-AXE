# 🎨 AuriPortal Studio - Resumen Ejecutivo

## Qué es Studio

Sistema para editar contenido desde **múltiples vistas simultáneas** sobre una **única fuente de verdad**.

## Fuente de Verdad: StudioDocument

```
StudioDocument
├── definition_json  → Lógica (steps, edges, conditions) → SE PUBLICA
├── layout_json      → Visual (posiciones, grupos)        → NO se publica
└── theme_binding    → Tema (base + overrides)            → SE PUBLICA
```

## Vistas Planificadas

| Vista | Versión | Qué Edita |
|-------|---------|-----------|
| Outline/Tree | v1 | Steps (CRUD), visual_order, collapsed |
| Inspector | v1 | Props, theme_binding, conditions |
| Raw JSON | v1 | definition_json completo, import/export |
| Workflow Graph | v1.5 | Edges, positions |
| Spatial Canvas | v2 | Todo lo anterior + groups |

## Cambios a Base de Datos

**Solo 2 columnas nuevas** (sin crear tablas):

```sql
ALTER TABLE recorrido_drafts ADD COLUMN layout_json JSONB DEFAULT '{}';
ALTER TABLE recorrido_drafts ADD COLUMN theme_binding JSONB DEFAULT '{}';
ALTER TABLE recorrido_versions ADD COLUMN theme_binding JSONB DEFAULT '{}';
```

## Endpoints Studio v1

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/admin/api/studio/:type/:id` | Obtener documento |
| PATCH | `/admin/api/studio/:type/:id` | Guardar cambios |
| POST | `/admin/api/studio/:type/:id/validate` | Validar |
| POST | `/admin/api/studio/:type/:id/publish` | Publicar |
| GET/POST | `/admin/api/studio/:type/:id/export|import` | Import/Export |

## Integración con Temas

```javascript
theme_binding = {
  base_theme_id: "aurora-dark",      // Selector en Inspector
  overrides: { "--accent-primary": "#ffd86b" }, // Editor de overrides
  preview_mode: "dark"               // Toggle dark/light
}
```

## Principios Clave

1. **Separación definition/layout**: Layout NUNCA afecta runtime
2. **Publish = inmutable**: Validación estricta, versión congelada
3. **Fail-open**: Error en Studio → portal sigue funcionando
4. **No hardcode temas**: Variables del Theme Contract v1

## Plan de Implementación

| Fase | Semanas | Entregables |
|------|---------|-------------|
| 1. Fundamentos | 2 | Migración + endpoints base |
| 2. Vistas Base | 2 | Outline + Inspector + Raw JSON |
| 3. Workflow Graph | 3 | Vista de grafo con edges editables |
| 4. Canvas | 4 | Vista espacial tipo Figma |

## Archivos Relacionados

- **Diseño completo**: `docs/STUDIO_MULTI_EDITOR_V1.md`
- **Migración SQL**: `database/migrations/v5.3.0-add-studio-layout-theme.sql`
- **Theme System**: `docs/THEME_RESOLVER_DESIGN.md`
- **Recorridos actual**: `src/endpoints/admin-recorridos-api.js`

---

**Estado**: ✅ Diseño completado | ⬜ Pendiente implementación






