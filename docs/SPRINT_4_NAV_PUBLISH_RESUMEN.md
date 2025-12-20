# Sprint 4 (NAV): Publish Estricto + Versionado + Export/Import + Contrato V1

**Versión**: v5.14.0-nav-editor-v2-publish-export-contract  
**Fecha**: 2025-01-XX  
**Estado**: ✅ Implementado

---

## Resumen Ejecutivo

Se ha completado el cierre del lifecycle del sistema de navegación con:
- ✅ Publicación estricta (fail-closed)
- ✅ Versionado published inmutable + checksum
- ✅ Export/Import seguro (formato `auriportal.navigation.v1`)
- ✅ Documento contrato NavigationDefinition v1
- ✅ UI: botón publicar + estado published

---

## 1. Diagnóstico del Estado Actual

**Resultado**: La infraestructura ya existía desde la migración `v5.5.0-navigation-versioning-v1.sql`:

- ✅ Tablas: `navigation_definitions`, `navigation_drafts`, `navigation_versions`, `navigation_audit_log`
- ✅ Repos: `NavigationRepoPg` con métodos `publish()`, `getPublishedLatest()`, `exportPublished()`, `importAsDraft()`
- ✅ Validación: `validateNavigationPublish()` con validación estricta
- ✅ Endpoints: `/admin/api/navigation/:navId/publish`, `/export`, `/import`

**Decisión**: Reutilizar infraestructura existente y mejorar/ajustar según requisitos.

---

## 2. Contrato NavigationDefinition v1

**Archivo**: `docs/NAVIGATION_DEFINITION_V1.md`

**Contenido**:
- ✅ Estructura JSON exacta (NavigationDefinition, Node, Edge, VisibilityRules, TargetConfig)
- ✅ Campos obligatorios vs opcionales
- ✅ Defaults
- ✅ Normalización (orden estable)
- ✅ Qué NO hace v1 (no eval visibility_rules, no runtime)
- ✅ Compatibilidad forward (campos desconocidos se conservan en meta)
- ✅ Formato de export (`auriportal.navigation.v1`)

---

## 3. Validación Estricta de Publish

**Archivo**: `src/core/navigation/validate-navigation-definition-v1.js`

**Errores bloqueantes implementados**:
- ✅ `entry_node_id` existe y apunta a node real
- ✅ Debe existir al menos 1 node
- ✅ Edges no apuntan a nodos inexistentes
- ✅ No duplicados exactos de edges (from,to) - se normalizan
- ✅ No "huérfanos" (nodos inalcanzables desde entry) - **error estricto en publish**
- ✅ Target requerido para ciertos kinds
- ✅ Validación de estructura completa

**Nota**: `computeNavWarnings` ya existe (no bloqueante). La validación estricta está en `validateNavigationPublish()`.

---

## 4. Versionado y Published Inmutable

### 4.1 Tablas (Ya Existentes)

**Migración**: `database/migrations/v5.5.0-navigation-versioning-v1.sql`

**Tablas**:
- ✅ `navigation_published_versions` → `navigation_versions` (con `version`, `checksum`, `published_by`)
- ✅ Índices: `unique (navigation_id, version)`, `index (navigation_id, status)` donde `status='published'`
- ✅ `navigation_audit_log` (append-only)

### 4.2 Repos (Ya Existentes, Mejorados)

**Archivo**: `src/infra/repos/navigation-repo-pg.js`

**Operaciones**:
- ✅ `getActivePublished(navigation_id)` → `getPublishedLatest()`
- ✅ `listPublishedVersions(navigation_id, limit)` → `listVersions()`
- ✅ `createPublishedVersion(...)` → `publish()` (version = max+1, set previous active to false)
- ✅ `getPublishedByVersion(navigation_id, version)` → `getPublishedVersion()`

**Mejoras**:
- ✅ Logs estructurados `[AXE][NAV_PUBLISH]`
- ✅ Formato de export actualizado a `auriportal.navigation.v1`

---

## 5. Endpoints Admin (Publish/Export/Import)

**Archivo**: `src/endpoints/admin-navigation-api.js`

### 5.1 POST /admin/api/navigation/:navId/publish

**Implementación**:
- ✅ Auth: `requireAdminContext()`
- ✅ Flow:
  1. Cargar draft (fallback published si no hay draft)
  2. Normalizar con `normalizeNavigationDefinition()`
  3. Validar con `validateNavigationForPublish()` (estricto)
  4. Si errores: 400 con `{ ok:false, errors:[...] }`
  5. Si ok: crear versión published con checksum
  6. Responder `{ ok:true, version:X, checksum }`

**Logs**:
- ✅ `[AXE][NAV_PUBLISH] validation_ok navigation_id=... version=X checksum=...`
- ✅ `[AXE][NAV_PUBLISH] published version=X checksum=...`

### 5.2 GET /admin/api/navigation/:navId/export

**Implementación**:
- ✅ Query: `navigation_id`, `version` (opcional; default active)
- ✅ Reglas: exporta SOLO published
- ✅ Salida:
```json
{
  "ok": true,
  "format": "auriportal.navigation.v1",
  "exported_at": "...",
  "navigation_id": "...",
  "version": X,
  "checksum": "...",
  "navigation": { ...definition... }
}
```

**Logs**:
- ✅ `[AXE][NAV_EXPORT] navigation_id=... version=... checksum=...`

### 5.3 POST /admin/api/navigation/:navId/import

**Implementación**:
- ✅ Auth: `requireAdminContext()`
- ✅ Flow:
  1. Validar `format === "auriportal.navigation.v1"` (si presente)
  2. Validar checksum (recalcular) → si no coincide: error
  3. Validar estructura con `validateNavigationDraft()` (no estricto, permite borradores)
  4. Normalizar
  5. Crear NUEVA navegación en DRAFT
  6. Responder `{ ok:true, navigation_id:newId, status:"draft" }`

**Logs**:
- ✅ `[AXE][NAV_IMPORT] created draft navigation_id=newId from version=X format=...`

---

## 6. UI — NAV Editor: Botón Publicar + Estado Published

**Archivo**: `src/core/html/admin/navigation/navigation-editor.html`

### 6.1 Botón "Publicar"

**Implementación**:
- ✅ Botón en header: `🚀 Publicar`
- ✅ Deshabilitado si `isDirty === true` (para evitar publicar algo no guardado)
- ✅ Al click:
  - Verifica que no hay cambios sin guardar
  - Llama `POST /admin/api/navigation/:navId/publish`
  - Si errors: modal/listado bonito con errores
  - Si ok: toast "Publicado vX" + refrescar estado published

### 6.2 Estado Published

**Implementación**:
- ✅ Badge: "📦 Published: vX" (si existe versión publicada)
- ✅ Badge: "📦 Draft" (si no hay versión publicada)
- ✅ Se carga al iniciar editor
- ✅ Se actualiza después de publicar

### 6.3 Mejoras Adicionales

- ✅ Modal de errores de validación con listado bonito
- ✅ Toast de éxito con número de versión
- ✅ Actualización automática del estado después de publicar

---

## 7. Logs Estructurados

**Implementados**:
- ✅ `[AXE][NAV_PUBLISH] validation_ok navigation_id=... version=X checksum=...`
- ✅ `[AXE][NAV_PUBLISH] published version=X checksum=...`
- ✅ `[AXE][NAV_EXPORT] navigation_id=... version=... checksum=...`
- ✅ `[AXE][NAV_IMPORT] created draft navigation_id=... from version=... format=...`

**Ubicaciones**:
- `src/infra/repos/navigation-repo-pg.js` (repo)
- `src/endpoints/admin-navigation-api.js` (endpoints)

---

## 8. Cambios Realizados

### Archivos Modificados

1. **`docs/NAVIGATION_DEFINITION_V1.md`** (NUEVO)
   - Contrato formal NavigationDefinition v1

2. **`src/infra/repos/navigation-repo-pg.js`**
   - Actualizado `exportPublished()`: formato `auriportal.navigation.v1`
   - Mejorado `importAsDraft()`: validación de formato y checksum
   - Añadidos logs estructurados `[AXE][NAV_PUBLISH]`, `[AXE][NAV_IMPORT]`

3. **`src/endpoints/admin-navigation-api.js`**
   - Añadidos logs estructurados `[AXE][NAV_PUBLISH]`, `[AXE][NAV_EXPORT]`
   - Mejorado manejo de errores en publish

4. **`src/core/html/admin/navigation/navigation-editor.html`**
   - Añadido badge "Published: vX"
   - Botón Publicar deshabilitado si `isDirty`
   - Modal de errores de validación
   - Carga de versión publicada al inicio
   - Actualización de estado después de publicar

---

## 9. Verificación de Requisitos

### ✅ Publish = FAIL-CLOSED
- Validación estricta bloquea si hay errores
- No se crea versión si validación falla

### ✅ Published nunca se edita
- Solo se crea nueva versión
- Versiones inmutables con checksum

### ✅ Migración SQL
- Ya existe: `v5.5.0-navigation-versioning-v1.sql`
- Tablas verificadas: `navigation_versions`, `navigation_audit_log`

### ✅ Auth siempre con requireAdminContext()
- Todos los endpoints protegidos

### ✅ Logs estructurados
- `[AXE][NAV_PUBLISH]`, `[AXE][NAV_EXPORT]`, `[AXE][NAV_IMPORT]`

---

## 10. Tests Manuales Recomendados

### Test 1: Publish con Draft Inválido
1. Crear draft con `entry_node_id` inexistente
2. Intentar publicar
3. ✅ Debe devolver errores claros en modal

### Test 2: Publish con Draft Válido
1. Crear draft válido
2. Publicar → debe crear v1
3. ✅ Debe mostrar "Published: v1"

### Test 3: Editar y Publicar Otra Vez
1. Editar draft (cambiar algo)
2. Guardar draft
3. Publicar → debe crear v2
4. ✅ Published debe mostrar v2, draft puede seguir editándose

### Test 4: Export
1. Exportar versión publicada
2. ✅ Debe devolver JSON con formato `auriportal.navigation.v1`
3. ✅ Debe incluir `checksum` válido

### Test 5: Import
1. Importar JSON exportado
2. ✅ Debe crear NUEVO draft
3. ✅ Debe validar checksum (si está presente)
4. ✅ Debe validar formato (si es `auriportal.navigation.v1`)

### Test 6: Botón Publicar Deshabilitado
1. Hacer cambios sin guardar
2. ✅ Botón Publicar debe estar deshabilitado
3. Guardar cambios
4. ✅ Botón Publicar debe habilitarse

---

## 11. Deploy Checklist

- [ ] Verificar migración aplicada: `\d navigation_versions`
- [ ] Verificar tablas: `SELECT COUNT(*) FROM navigation_versions;`
- [ ] `pm2 restart aurelinportal`
- [ ] Comprobar `/__version`
- [ ] Test UI: publish/export/import
- [ ] Verificar logs: `pm2 logs aurelinportal | grep AXE`

---

## 12. GitHub Entrega

**Versión**: `v5.14.0-nav-editor-v2-publish-export-contract`

**Commit**:
```
NAV: publish strict + versions + export/import + contract v1

- Publicación estricta (fail-closed)
- Versionado published inmutable + checksum
- Export/Import seguro (formato auriportal.navigation.v1)
- Documento contrato NavigationDefinition v1
- UI: botón publicar + estado published
```

---

## 13. Notas Técnicas

### Formato de Export

**Antes**:
```json
{
  "_export_version": "1.0",
  "_exported_at": "...",
  "navigation": { ... },
  "version": X,
  "checksum": "...",
  "definition": { ... }
}
```

**Ahora**:
```json
{
  "ok": true,
  "format": "auriportal.navigation.v1",
  "exported_at": "...",
  "navigation_id": "...",
  "version": X,
  "checksum": "...",
  "navigation": { ... }
}
```

### Validación de Import

- Si `format === "auriportal.navigation.v1"`: valida formato y checksum
- Si no tiene `format`: acepta como legacy (compatibilidad)
- Siempre valida estructura básica con `validateNavigationDraft()`

### Estado Published en UI

- Se carga al iniciar editor (si existe)
- Se actualiza después de publicar
- Se muestra en badge: "📦 Published: vX" o "📦 Draft"

---

## FIN

✅ **Sprint 4 completado**: Publish estricto + Versionado + Export/Import + Contrato V1




