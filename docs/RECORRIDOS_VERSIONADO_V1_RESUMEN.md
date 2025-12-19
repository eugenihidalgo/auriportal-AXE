# Sistema de Versionado de Recorridos (DRAFT/PUBLISH) - Sprint 2A

## Resumen de Implementación

Sistema completo de versionado de recorridos con persistencia de drafts editables y versiones publicadas inmutables, incluyendo auditoría completa de cambios.

---

## Archivos Creados/Modificados

### Migraciones
- `database/migrations/v5.1.0-create-recorridos-versioning.sql`
  - Tabla `recorridos` (metadatos del producto)
  - Tabla `recorrido_drafts` (drafts editables)
  - Tabla `recorrido_versions` (versiones publicadas inmutables)
  - Tabla `recorrido_audit_log` (auditoría append-only)
  - Índices para consultas rápidas

### Repositorios - Contratos (src/core/repos/)
- `src/core/repos/recorrido-repo.js`
- `src/core/repos/recorrido-draft-repo.js`
- `src/core/repos/recorrido-version-repo.js`
- `src/core/repos/recorrido-audit-repo.js`

### Repositorios - Implementaciones PostgreSQL (src/infra/repos/)
- `src/infra/repos/recorrido-repo-pg.js`
- `src/infra/repos/recorrido-draft-repo-pg.js`
- `src/infra/repos/recorrido-version-repo-pg.js`
- `src/infra/repos/recorrido-audit-repo-pg.js`

### Endpoints Admin API
- `src/endpoints/admin-recorridos-api.js`
  - GET `/admin/api/recorridos` - Lista recorridos
  - POST `/admin/api/recorridos` - Crea recorrido + draft inicial
  - GET `/admin/api/recorridos/:id` - Obtiene recorrido completo
  - PUT `/admin/api/recorridos/:id/draft` - Actualiza draft
  - POST `/admin/api/recorridos/:id/validate` - Valida draft
  - POST `/admin/api/recorridos/:id/publish` - Publica versión
  - POST `/admin/api/recorridos/:id/status` - Cambia status global
  - GET `/admin/api/recorridos/:id/export` - Exporta bundle JSON
  - POST `/admin/api/recorridos/import` - Importa bundle JSON

### Router
- `src/router.js` - Registro de endpoints admin recorridos

### Tests
- `tests/recorridos/recorridos-versioning.test.js` - Tests mínimos críticos

---

## Comandos para Ejecutar Migración

### Opción 1: Ejecutar manualmente con psql

```bash
# Conectar a PostgreSQL
psql -h localhost -U postgres -d aurelinportal

# Ejecutar migración
\i database/migrations/v5.1.0-create-recorridos-versioning.sql
```

### Opción 2: Ejecutar desde Node.js (si hay script de migraciones)

```bash
# Si existe un script de migraciones
node scripts/run-migrations.js v5.1.0
```

### Opción 3: Ejecutar directamente

```bash
psql $DATABASE_URL -f database/migrations/v5.1.0-create-recorridos-versioning.sql
```

### Verificar Migración

```sql
-- Verificar que las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('recorridos', 'recorrido_drafts', 'recorrido_versions', 'recorrido_audit_log');

-- Verificar estructura de una tabla
\d recorridos
\d recorrido_drafts
\d recorrido_versions
\d recorrido_audit_log
```

---

## Ejemplos cURL

### 1. Crear Recorrido

```bash
curl -X POST http://localhost:3000/admin/api/recorridos \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{
    "id": "limpieza-diaria",
    "name": "Limpieza Energética Diaria"
  }'
```

**Respuesta:**
```json
{
  "recorrido": {
    "id": "limpieza-diaria",
    "name": "Limpieza Energética Diaria",
    "status": "draft",
    "current_draft_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "draft": {
    "draft_id": "550e8400-e29b-41d4-a716-446655440000",
    "definition_json": {
      "id": "limpieza-diaria",
      "entry_step_id": "step1",
      "steps": {
        "step1": {
          "screen_template_id": "blank",
          "props": {}
        }
      },
      "edges": []
    }
  }
}
```

### 2. Actualizar Draft

```bash
curl -X PUT http://localhost:3000/admin/api/recorridos/limpieza-diaria/draft \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{
    "definition_json": {
      "id": "limpieza-diaria",
      "entry_step_id": "step_intro",
      "steps": {
        "step_intro": {
          "screen_template_id": "screen_intro_centered",
          "props": {
            "title": "Bienvenido a tu Limpieza Energética Diaria"
          }
        }
      },
      "edges": []
    }
  }'
```

### 3. Validar Draft

```bash
curl -X POST http://localhost:3000/admin/api/recorridos/limpieza-diaria/validate \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{}'
```

**Respuesta:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

### 4. Publicar Versión

```bash
curl -X POST http://localhost:3000/admin/api/recorridos/limpieza-diaria/publish \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{
    "release_notes": "Primera versión publicada"
  }'
```

**Respuesta:**
```json
{
  "version": {
    "version": 1,
    "status": "published",
    "definition_json": { ... },
    "release_notes": "Primera versión publicada",
    "created_at": "2025-01-XX..."
  },
  "validation": {
    "valid": true,
    "warnings": []
  }
}
```

### 5. Obtener Recorrido Completo

```bash
curl -X GET http://localhost:3000/admin/api/recorridos/limpieza-diaria \
  -H "Cookie: admin_session=..."
```

**Respuesta:**
```json
{
  "recorrido": {
    "id": "limpieza-diaria",
    "name": "Limpieza Energética Diaria",
    "status": "published",
    "current_draft_id": "550e8400-e29b-41d4-a716-446655440000",
    "current_published_version": 1
  },
  "draft": {
    "draft_id": "550e8400-e29b-41d4-a716-446655440000",
    "definition_json": { ... },
    "updated_at": "2025-01-XX..."
  },
  "published_version": {
    "version": 1,
    "status": "published",
    "definition_json": { ... },
    "release_notes": "Primera versión publicada"
  }
}
```

### 6. Exportar Recorrido

```bash
curl -X GET http://localhost:3000/admin/api/recorridos/limpieza-diaria/export \
  -H "Cookie: admin_session=..."
```

### 7. Importar Recorrido

```bash
curl -X POST http://localhost:3000/admin/api/recorridos/import \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{
    "recorrido": {
      "id": "nuevo-recorrido",
      "name": "Nuevo Recorrido"
    },
    "draft": {
      "definition_json": { ... }
    },
    "exported_at": "2025-01-XX..."
  }'
```

### 8. Cambiar Status

```bash
curl -X POST http://localhost:3000/admin/api/recorridos/limpieza-diaria/status \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=..." \
  -d '{
    "status": "deprecated"
  }'
```

---

## Decisiones v1

### 1. Inmutabilidad de Versiones
- **Decisión**: Las versiones publicadas son INMUTABLES. Una vez publicada, `definition_json` nunca cambia.
- **Razón**: Garantiza que el runtime siempre use la misma versión que se validó al publicar.
- **Implementación**: No hay UPDATE en `recorrido_versions` excepto para `status` (deprecated).

### 2. Validación en Publish
- **Decisión**: El publish SIEMPRE valida con `isPublish:true` y BLOQUEA si hay errores.
- **Razón**: No queremos versiones inválidas en producción.
- **Implementación**: Si `validation.valid === false`, se retorna error 400 y no se crea versión.

### 3. Estrategia de Import "Safe"
- **Decisión**: Si el recorrido existe, crear NUEVO draft y NO tocar published.
- **Razón**: Protege las versiones publicadas de cambios accidentales.
- **Implementación**: Solo se actualiza `current_draft_id`, nunca se modifica `recorrido_versions`.

### 4. Auditoría Append-Only
- **Decisión**: La tabla `recorrido_audit_log` es append-only (no UPDATE ni DELETE).
- **Razón**: Historial completo e inmutable de todas las acciones.
- **Implementación**: Solo INSERT, nunca UPDATE ni DELETE.

### 5. Status Global vs Status de Versión
- **Decisión**: `recorridos.status` es global del producto, `recorrido_versions.status` es por versión.
- **Razón**: Permite tener múltiples versiones (algunas deprecated) mientras el producto sigue "published".
- **Implementación**: Dos campos separados con lógica independiente.

### 6. Draft Inicial Mínimo
- **Decisión**: Al crear recorrido, se crea draft con `definition_json` mínimo válido.
- **Razón**: Permite empezar a editar inmediatamente sin errores de validación.
- **Implementación**: Draft con `entry_step_id: 'step1'` y un step básico.

### 7. Transacciones en Operaciones Críticas
- **Decisión**: Usar transacciones en `create`, `publish` e `import`.
- **Razón**: Garantiza consistencia: si falla algo, todo se revierte.
- **Implementación**: `BEGIN` / `COMMIT` / `ROLLBACK` con `pool.connect()`.

### 8. Logs Estructurados
- **Decisión**: Logs con contexto completo (recorrido_id, version, errors_count, etc.).
- **Razón**: Observabilidad para debugging y monitoreo.
- **Implementación**: `logInfo`, `logWarn`, `logError` con objetos estructurados.

### 9. No Runtime en Sprint 2A
- **Decisión**: NO implementar runtime alumno (runs/step_results) en este sprint.
- **Razón**: Separar concerns: primero persistencia, luego runtime.
- **Implementación**: Solo API admin, sin endpoints de runtime.

### 10. Feature Flags
- **Decisión**: Mantener `recorridos_editor_v1` en 'off', endpoints pueden estar en 'beta'.
- **Razón**: Control gradual de rollout.
- **Implementación**: Endpoints disponibles pero UI desactivada por feature flag.

---

## Próximos Pasos (Sprint 2B)

1. **Runtime Alumno**: Implementar ejecución de recorridos (runs, step_results)
2. **UI Editor**: Crear interfaz visual para editar recorridos
3. **Validación Avanzada**: Mejorar validación con más reglas de negocio
4. **Historial de Versiones**: UI para ver todas las versiones publicadas
5. **Rollback**: Permitir deprecar versión actual y activar versión anterior

---

## Notas Técnicas

- **PostgreSQL**: Todas las tablas usan TIMESTAMPTZ para timezone-aware
- **UUIDs**: Los drafts usan `gen_random_uuid()` para IDs únicos
- **JSONB**: `definition_json` se almacena como JSONB para búsquedas eficientes
- **Índices GIN**: En `definition_json` para búsquedas JSON (opcional, implementado)
- **Cascade Delete**: Si se elimina un recorrido, se eliminan todos sus drafts y versiones
- **Constraints**: CHECK constraints para validar valores permitidos (status, version > 0)

---

## Verificación Post-Implementación

```bash
# 1. Ejecutar migración
psql $DATABASE_URL -f database/migrations/v5.1.0-create-recorridos-versioning.sql

# 2. Ejecutar tests
npm test -- tests/recorridos/recorridos-versioning.test.js

# 3. Verificar endpoints (con sesión admin activa)
curl -X GET http://localhost:3000/admin/api/recorridos \
  -H "Cookie: admin_session=..."

# 4. Verificar logs
tail -f logs/app.log | grep RecorridosAPI
```

---

**Sistema de Versionado de Recorridos v1 - Sprint 2A completado ✅**







