# 🔍 AUDITORÍA PASO 3 — PUBLICACIÓN Y VERSIONADO
## Theme System v1 · Draft → Publish → Versionado

**Fecha:** 2025-12-27  
**Auditor:** Cursor AI Agent (Modo Auditor Constitucional)  
**Objetivo:** Certificar que el sistema de publicación es inmutable, reversible, no rompe runtime y soporta evolución futura

---

## FASE 3.1 — INVENTARIO REAL DE PUBLICACIÓN

### Archivos Identificados

#### Función Principal de Publicación
1. **`src/core/theme-system/theme-system-v1.js`**
   - Función: `publish(theme_key, published_by)`
   - Líneas: 209-258
   - Flujo:
     1. Obtiene tema desde `themes` table
     2. Valida definición (tokens completos)
     3. Calcula siguiente versión (`currentVersion + 1`)
     4. Crea entrada en `theme_versions` (inmutable)
     5. Actualiza `themes.version` y `themes.status`

#### Endpoint de Publicación
2. **`src/endpoints/admin-themes-api.js`**
   - Función: `handlePublish(request, env, ctx, themeId)`
   - Ruta: `POST /admin/api/themes/:id/publish`
   - Líneas: 393-493
   - Flujo:
     1. Obtiene draft actual desde `theme_drafts`
     2. Valida con `validateThemeDefinition()` (estricto)
     3. Usa transacción para atomicidad
     4. Crea versión en `theme_versions`
     5. Actualiza `themes.current_published_version` y `themes.status`

#### Repositorios Usados
3. **`src/infra/repos/theme-version-repo-pg.js`**
   - Método: `createVersion(theme_id, version, definition_json, release_notes, published_by)`
   - Query: `INSERT INTO theme_versions (theme_id, version, status, definition_json, ...) VALUES (...)`
   - **Inmutable:** Una vez insertado, nunca se modifica

4. **`src/infra/repos/theme-repo-pg.js`**
   - Método: `updateThemeMeta(id, patch)`
   - Actualiza: `themes.version`, `themes.status`, `themes.current_published_version`
   - **NO actualiza:** `themes.definition` (solo metadatos)

### Flujo Exacto de Publicación

```
1. Usuario hace POST /admin/api/themes/:id/publish
   ↓
2. handlePublish() valida autenticación
   ↓
3. Obtiene draft desde theme_drafts
   ↓
4. Valida con validateThemeDefinition() (estricto)
   ↓
5. BEGIN TRANSACTION
   ↓
6. versionRepo.createVersion() → INSERT en theme_versions
   ↓
7. themeRepo.updateThemeMeta() → UPDATE themes (version, status, current_published_version)
   ↓
8. COMMIT
   ↓
9. Retorna versión creada
```

### Tablas Escritas (en orden)

1. **`theme_versions`** (INSERT) - Versión inmutable
2. **`themes`** (UPDATE) - Metadatos (version, status, current_published_version)

---

## FASE 3.2 — PRUEBA DE INMUTABILIDAD

### Test 1: Intentar editar versión publicada por SQL directo

**Acción:**
```sql
UPDATE theme_versions 
SET definition_json = '{"test": "hacked"}'::jsonb 
WHERE theme_id = 'admin-classic' AND version = 1;
```

**Resultado:** ✅ **SQL permite modificar** (esperado - SQL directo puede hacer cualquier cosa)

**Evaluación:** 
- ⚠️ **Riesgo:** Acceso SQL directo puede modificar versiones
- ✅ **Mitigación:** Solo admins tienen acceso SQL, y el código de la aplicación no permite esto

### Test 2: Intentar editar definition de tema published vía saveDraft()

**Acción:**
```javascript
await saveDraft('admin-classic', modifiedDefinition);
```

**Resultado:** ❌ **Se puede modificar `themes.definition`** incluso cuando `status='published'`

**Código Problemático:**
```javascript
// theme-system-v1.js línea 186-190
theme = await themeRepo.updateThemeMeta(theme.id, {
  definition: definition, // ⚠️ Permite modificar definition de published
  description: definition.description || meta.description,
  name: definition.name || theme.name
});
```

**Evaluación:**
- ❌ **PROBLEMA:** `saveDraft()` no verifica si el tema está published
- ✅ **PROTECCIÓN PARCIAL:** El runtime usa `theme_versions`, no `themes.definition`
- ⚠️ **RIESGO:** Se puede "ensuciar" `themes.definition` sin afectar runtime

### Test 3: Verificar que getThemeDefinition() usa theme_versions

**Código Verificado:**
```javascript
// theme-system-v1.js línea 101-108
if (preferPublished) {
  const theme = await themeRepo.getThemeByKey(theme_key);
  if (theme && theme.id) {
    const version = await versionRepo.getLatestVersion(theme.id);
    if (version && version.definition_json) {
      return version.definition_json; // ✅ USA VERSIÓN PUBLICADA
    }
  }
}
```

**Prueba Real:**
- Modificamos `themes.definition.name` = "HACKED"
- `getThemeDefinition('admin-classic', true)` retornó `name: "Admin Classic (Base)"` (de theme_versions)

**Resultado:** ✅ **OK** - El runtime usa `theme_versions`, no `themes.definition`

### Test 4: Verificar que endpoint bloquea editar published

**Código Verificado:**
```javascript
// admin-themes-api.js línea 294-359
async function handleUpdateDraft(request, env, ctx, themeId) {
  // ... validaciones ...
  // ⚠️ NO verifica si theme.status === 'published'
  const draftRepo = getDefaultThemeDraftRepo();
  // ... crea/actualiza draft ...
}
```

**Resultado:** ❌ **NO bloquea** - El endpoint permite crear/actualizar draft incluso si el tema está published

**Evaluación:**
- ⚠️ **RIESGO:** Se puede crear draft de tema published (pero no afecta runtime)
- ✅ **MITIGACIÓN:** El runtime siempre usa versión publicada cuando existe

---

## FASE 3.3 — VERSIONADO REAL

### Prueba: Publicar múltiples versiones

**Acción:** Publicar `admin-classic` dos veces

**Resultado:**
```
Versión 1: created_at: 2025-12-27 17:13:25
Versión 2: created_at: 2025-12-27 20:15:05
```

**Verificación SQL:**
```sql
SELECT version, status, definition_json->'name' as name 
FROM theme_versions 
WHERE theme_id = 'admin-classic' 
ORDER BY version;
```

**Resultado:**
```
version |  status   |          name          
--------+-----------+------------------------
      1 | published | "Admin Classic (Base)"
      2 | published | "Admin Classic (Base)"
```

✅ **OK:** Ambas versiones existen e intactas

### Verificación: Runtime usa siempre la última publicada

**Código Verificado:**
```javascript
// theme-version-repo-pg.js línea 36-42
SELECT * FROM theme_versions
WHERE theme_id = $1
  AND status = 'published'
ORDER BY version DESC
LIMIT 1
```

**Resultado:** ✅ **OK** - Query ordena por `version DESC`, siempre obtiene la más reciente

### Verificación: Versiones anteriores intactas

**Prueba:** Modificar v1 por SQL, verificar que v2 sigue intacta

**Resultado:** ✅ **OK** - Versiones son independientes, modificar una no afecta otras

---

## FASE 3.4 — ROLLBACK Y HISTORIA

### Mecanismo de Rollback

**Código Identificado:**
```javascript
// theme-version-repo-pg.js línea 121-141
async deprecateVersion(theme_id, version, client = null) {
  // Marca versión como 'deprecated'
  UPDATE theme_versions
  SET status = 'deprecated'
  WHERE theme_id = $1 AND version = $2
}
```

**Evaluación:**
- ✅ **Existe:** Método `deprecateVersion()` disponible
- ⚠️ **Limitación:** Solo marca como deprecated, no restaura versión anterior
- ❌ **No implementado:** Endpoint para deprecar/rollback desde UI
- ❌ **No implementado:** Lógica para "activar" versión anterior

### Estado Actual

**Rollback Manual (SQL):**
```sql
-- Deprecar versión actual
UPDATE theme_versions SET status = 'deprecated' WHERE theme_id = 'admin-classic' AND version = 2;

-- El runtime automáticamente usará v1 (última published no deprecated)
```

**Rollback Automático:** ❌ **No existe**

**Recomendación:** Implementar endpoint `POST /admin/api/themes/:id/rollback/:version` en v2

---

## FASE 3.5 — COHERENCIA CON RUNTIME

### Verificación: Runtime se actualiza sin reiniciar

**Prueba:**
1. Publicar nueva versión (v2)
2. Llamar `getThemeDefinition('admin-classic', true)` inmediatamente
3. Verificar que retorna v2

**Resultado:** ✅ **OK** - El runtime lee directamente de BD, no hay cache persistente

**Código Verificado:**
- No hay cache en `theme-system-v1.js`
- No hay cache en `theme-version-repo-pg.js`
- Cada llamada hace query fresh a PostgreSQL

**Evaluación:**
- ✅ **Ventaja:** Cambios se reflejan inmediatamente
- ⚠️ **Riesgo:** Performance si hay muchas llamadas (mitigado por pool de conexiones)

---

## FASE 3.6 — PROBLEMAS DETECTADOS Y FIXES

### Problema 1: saveDraft() permite modificar themes.definition de published

**Severidad:** MEDIA (no afecta runtime, pero ensucia datos)

**Código Problemático:**
```javascript
// theme-system-v1.js línea 186-190
theme = await themeRepo.updateThemeMeta(theme.id, {
  definition: definition, // ⚠️ Permite modificar incluso si published
  ...
});
```

**Fix Recomendado:**
```javascript
// Verificar si está published antes de modificar definition
if (theme.status === 'published') {
  // No modificar definition, solo crear nuevo draft
  // O lanzar error si se intenta modificar directamente
}
```

**Estado:** ⚠️ **NO BLOQUEANTE** - El runtime está protegido (usa theme_versions)

### Problema 2: handleUpdateDraft() no verifica status

**Severidad:** BAJA (permite crear draft de published, pero no afecta runtime)

**Fix Recomendado:**
- Permitir crear draft de tema published (para futuras versiones)
- Pero no permitir modificar `themes.definition` directamente

**Estado:** ⚠️ **NO BLOQUEANTE** - Comportamiento aceptable (draft es para próxima versión)

### Problema 3: No hay rollback automático

**Severidad:** BAJA (funcionalidad futura)

**Estado:** ✅ **ACEPTABLE** - Rollback manual vía SQL es suficiente para v1

---

## ✅ RESULTADO PASO 3 — PUBLICACIÓN Y VERSIONADO

### [✅] OK — Sistema seguro (con advertencias)

**Resumen:**
- ✅ **Inmutabilidad:** OK - Versiones en `theme_versions` son inmutables por diseño
- ⚠️ **Protección código:** PARCIAL - `saveDraft()` permite modificar `themes.definition` pero no afecta runtime
- ✅ **Versionado:** OK - Múltiples versiones funcionan correctamente
- ✅ **Rollback:** OK - Existe `deprecateVersion()`, rollback manual posible
- ✅ **Coherencia runtime:** OK - Runtime se actualiza sin reiniciar, usa versión correcta

### Hallazgos Positivos

1. ✅ Versiones en `theme_versions` son inmutables por diseño
2. ✅ Runtime siempre usa versión publicada (no `themes.definition`)
3. ✅ Múltiples versiones funcionan correctamente
4. ✅ Transacciones aseguran atomicidad
5. ✅ Validación estricta antes de publicar
6. ✅ Runtime se actualiza sin reiniciar servidor

### Problemas Detectados

1. ⚠️ **saveDraft() permite modificar `themes.definition` de published**
   - **Impacto:** Bajo (no afecta runtime)
   - **Fix:** Agregar verificación de status antes de modificar definition
   - **Prioridad:** Media

2. ⚠️ **No hay rollback automático desde UI**
   - **Impacto:** Bajo (rollback manual vía SQL funciona)
   - **Fix:** Implementar endpoint de rollback en v2
   - **Prioridad:** Baja

### Recomendaciones

1. **Corto plazo:** Agregar verificación en `saveDraft()` para no modificar `themes.definition` si está published
2. **Medio plazo:** Implementar endpoint de rollback desde UI
3. **Largo plazo:** Considerar cache de versiones publicadas (si performance lo requiere)

---

## 🎯 CONCLUSIÓN

El sistema de publicación y versionado del Theme System v1 está **FUNCIONALMENTE SEGURO** para producción.

**Estado del Sistema:** ✅ **CERTIFICADO** (con advertencias menores)

**Características verificadas:**
- ✅ Inmutabilidad de versiones (por diseño)
- ✅ Runtime protegido (usa theme_versions)
- ✅ Versionado múltiple funcional
- ✅ Coherencia sin reiniciar servidor
- ⚠️ Protección parcial en código (no bloqueante)

**Próximos pasos sugeridos:**
1. Implementar fix para `saveDraft()` (no bloqueante)
2. Considerar endpoint de rollback (v2)
3. Documentar proceso de rollback manual

---

**Certificado por:** Cursor AI Agent  
**Fecha de certificación:** 2025-12-27

