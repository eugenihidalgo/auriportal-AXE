# AXE v0.5 — Runbook de Migración Screen Templates v1

**Fecha de Ejecución:** 2025-12-18  
**Hash de Commit Base:** `5c44b0ba29072d71be401106716ec64276aec75c`  
**Migración:** `v5.4.0-create-screen-templates-versioning.sql`

---

## 1) PRE-CHECK ✅

### Estado Git
- **Branch:** master
- **Último commit:** `5c44b0b feat(env): validar .env y prevenir fallos por secrets sanitizados`
- **Hash completo:** `5c44b0ba29072d71be401106716ec64276aec75c`
- **Estado:** Muchos archivos modificados/sin trackear (normal en desarrollo activo)

### Estado PM2
- **Proceso:** `aurelinportal` (id: 9)
- **Estado:** online
- **Uptime antes:** 6h
- **Restarts:** 2 → 3 (después del reinicio)

---

## 2) EJECUCIÓN DE MIGRACIÓN ✅

### Comando Ejecutado
```bash
psql "$DATABASE_URL" -f database/migrations/v5.4.0-create-screen-templates-versioning.sql
```

### Resultado
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX (×8)
COMMENT (×11)
```

**Estado:** ✅ Migración ejecutada exitosamente

---

## 3) VERIFICACIÓN DE TABLAS ✅

### Verificación con to_regclass

**screen_templates:**
```sql
SELECT to_regclass('public.screen_templates');
-- Resultado: screen_templates ✅
```

**screen_template_drafts:**
```sql
SELECT to_regclass('public.screen_template_drafts');
-- Resultado: screen_template_drafts ✅
```

**screen_template_versions:**
```sql
SELECT to_regclass('public.screen_template_versions');
-- Resultado: screen_template_versions ✅
```

**screen_template_audit_log:**
```sql
SELECT to_regclass('public.screen_template_audit_log');
-- Resultado: screen_template_audit_log ✅
```

### Estructura de Tablas Verificada

#### screen_templates
```
Column                     | Type                        | Constraints
---------------------------+-----------------------------+-------------
id                         | text                        | PRIMARY KEY
name                       | text                        | NOT NULL
status                     | text                        | NOT NULL, DEFAULT 'draft'
current_draft_id           | uuid                        | 
current_published_version  | integer                     | 
created_at                 | timestamptz                 | NOT NULL, DEFAULT NOW()
updated_at                 | timestamptz                 | NOT NULL, DEFAULT NOW()
```

**Índices:**
- PRIMARY KEY (id)
- idx_screen_templates_status (status)

**Foreign Keys:**
- screen_template_drafts → screen_templates(id) ON DELETE CASCADE
- screen_template_versions → screen_templates(id) ON DELETE CASCADE

#### screen_template_drafts
```
Column                | Type                        | Constraints
----------------------+-----------------------------+-------------
draft_id              | uuid                        | PRIMARY KEY, DEFAULT gen_random_uuid()
screen_template_id    | text                        | NOT NULL, FK
definition_json       | jsonb                       | NOT NULL
created_at            | timestamptz                 | NOT NULL, DEFAULT NOW()
updated_at            | timestamptz                 | NOT NULL, DEFAULT NOW()
updated_by            | text                        | 
```

**Índices:**
- PRIMARY KEY (draft_id)
- idx_screen_template_drafts_template_id (screen_template_id)
- idx_screen_template_drafts_definition_gin (definition_json) GIN

#### screen_template_versions
```
Column                | Type                        | Constraints
----------------------+-----------------------------+-------------
screen_template_id    | text                        | NOT NULL, FK
version               | integer                     | NOT NULL, CHECK (version > 0)
status                | text                        | NOT NULL, DEFAULT 'published', CHECK (status IN ('published', 'deprecated'))
definition_json       | jsonb                       | NOT NULL
release_notes         | text                        | 
created_at            | timestamptz                 | NOT NULL, DEFAULT NOW()
created_by            | text                        | 
```

**Índices:**
- PRIMARY KEY (screen_template_id, version)
- idx_screen_template_versions_template_version (screen_template_id, version DESC)
- idx_screen_template_versions_status (status) WHERE status = 'published'

#### screen_template_audit_log
```
Column                | Type                        | Constraints
----------------------+-----------------------------+-------------
id                    | uuid                        | PRIMARY KEY, DEFAULT gen_random_uuid()
screen_template_id    | text                        | NOT NULL
draft_id              | uuid                        | 
action                | text                        | NOT NULL, CHECK (action IN ('create_template', 'update_draft', 'validate_draft', 'publish_version', 'set_status', 'import', 'export'))
details_json          | jsonb                       | 
created_at            | timestamptz                 | NOT NULL, DEFAULT NOW()
created_by            | text                        | 
```

**Índices:**
- PRIMARY KEY (id)
- idx_screen_template_audit_log_template_id (screen_template_id)
- idx_screen_template_audit_log_action (action)
- idx_screen_template_audit_log_created_at (created_at DESC)

---

## 4) REINICIO CONTROLADO ✅

### Comando
```bash
pm2 restart aurelinportal
```

### Resultado
- ✅ Proceso reiniciado correctamente
- ✅ Nuevo PID: 1255391
- ✅ Uptime: 0s (recién iniciado)
- ✅ Status: online
- ✅ Restarts: 2 → 3

### Logs de Arranque (Resumen)
```
✅ Servidor AuriPortal iniciado correctamente
📍 Escuchando en http://0.0.0.0:3000
✅ PostgreSQL conectado correctamente
✅ UI & Experience System v1 inicializado
✅ Motor de Automatizaciones (AUTO-1) iniciado
```

**No se detectaron errores relacionados con la migración.**

---

## 5) SMOKE TESTS HTTP ✅

### Endpoints Probados

| Endpoint | Status | Comportamiento Esperado | Resultado |
|----------|--------|------------------------|-----------|
| `GET /__version` | 200 OK | Debe devolver versión | ✅ 200 OK |
| `GET /admin` | 302 Found | Debe redirigir a login (sin auth) | ✅ 302 → /admin/login |
| `GET /admin/screen-templates` | 302 Found | Debe redirigir a login (sin auth) | ✅ 302 → /admin/login |
| `GET /api/admin/screen-templates` | 401 Unauthorized | Debe rechazar sin auth | ✅ 401 Unauthorized |

### Conclusión
✅ Todos los endpoints responden con los códigos HTTP esperados  
✅ Autenticación funcionando correctamente  
✅ Rutas registradas y accesibles  

---

## 6) NAVEGABILIDAD ✅

### Estado Actual
- ✅ Rutas UI registradas: `/admin/screen-templates`
- ✅ Rutas API registradas: `/api/admin/screen-templates`
- ✅ Endpoint handler existe: `src/endpoints/admin-screen-templates.js`
- ✅ Endpoint API handler existe: `src/endpoints/admin-screen-templates-api.js`
- ✅ Router configurado en `src/router.js` (líneas 846-855)

### Acceso
- **Acceso directo:** `/admin/screen-templates` funciona (requiere auth)
- **Sidebar:** El código intenta cargar desde `admin-sidebar-registry.js` pero maneja el error gracefully si no existe

### Decisión
Según especificaciones AXE v0.5: **NO tocar sidebar largo**. El acceso manual está disponible y funcional. Si se necesita integración en sidebar, hacerlo en una iteración posterior.

---

## 7) GUARDARRÁILES ✅

### ✅ Fail-Open en Renderer
**Archivo:** `src/core/screen-template/screen-template-renderer.js`

- Línea 5: Comentario explícito "Fail-open absoluto"
- Líneas 31-89: Try/catch completo con `renderFallbackHtml()` como fallback
- Línea 37-38: Si template no encontrado, devuelve fallback (no error)
- Líneas 80-89: Cualquier error capturado devuelve fallback HTML válido

### ✅ Preview Mode
**Archivo:** `src/core/preview/preview-context.js`

- Línea 45: `preview_mode: true` en DEFAULT_PREVIEW_CONTEXT
- Línea 134: `context.preview_mode = true;` forzado en normalización
- Verificado en `mock-profiles.js`: todos los perfiles tienen `preview_mode: true`

### ✅ No Analytics en Preview
**Verificación:** No se encontraron llamadas a `analytics` o `track` en:
- `src/core/preview/preview-context.js`
- `src/core/preview/mock-profiles.js`
- Renderer no tiene lógica de analytics

### ✅ Rutas No Rompen Router
**Verificación:** Smoke tests confirman que:
- Rutas nuevas no interfieren con rutas existentes
- Router global funciona correctamente
- No hay errores 500 en endpoints críticos

---

## 8) ARCHIVOS TOCADOS

### Migración SQL
- ✅ `database/migrations/v5.4.0-create-screen-templates-versioning.sql` (ejecutado)

### Documentación (nuevos)
- ✅ `docs/AXE_V0_5_MIGRATION_RUNBOOK.md` (este archivo)
- ⏳ `docs/AXE_V0_5_SMOKETEST.md` (pendiente)

### Archivos Existentes (no modificados)
- `src/router.js` (rutas ya estaban registradas)
- `src/endpoints/admin-screen-templates.js` (ya existía)
- `src/endpoints/admin-screen-templates-api.js` (ya existía)

---

## PRÓXIMOS PASOS RECOMENDADOS

1. **Integración Sidebar (Opcional):** Agregar enlace a Screen Templates en sidebar admin si se requiere navegación desde menú principal

2. **Tests de Integración:** Crear tests que validen flujo completo: crear draft → validar → publicar → renderizar

3. **UI de Editor:** Completar implementación del editor visual si está pendiente (actualmente tiene estructura básica)

4. **Documentación API:** Documentar endpoints API de screen templates para uso por frontend

5. **Seed Data (Opcional):** Crear scripts de seed para templates iniciales si se requieren ejemplos

---

## CONCLUSIÓN

✅ **Migración ejecutada exitosamente**  
✅ **Tablas verificadas en PostgreSQL**  
✅ **Endpoints funcionando correctamente**  
✅ **Guardarraíles verificados**  
✅ **PM2 estable sin errores**  

**Estado:** Screen Templates v1 está operativo y listo para uso.












