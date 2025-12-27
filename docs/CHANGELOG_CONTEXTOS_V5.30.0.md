# CHANGELOG: Corrección Sistema de Contextos PDE v5.30.0

**Fecha**: 2025-01-XX  
**Versión**: v5.30.0-contexts-stability  
**Tipo**: Corrección Estructural (Breaking Changes Controlados)

---

## 🎯 OBJETIVO

Corregir problemas estructurales graves en el Gestor de Contextos PDE identificados en el diagnóstico exhaustivo (FASE 1).

---

## 🔧 DECISIONES ARQUITECTÓNICAS

### 1. Fuente de Verdad Única

**ANTES**: Dos fuentes de verdad desincronizadas
- Columna `definition` (JSONB)
- Columnas dedicadas (scope, kind, type, allowed_values, default_value)

**AHORA**: Columnas dedicadas son la ÚNICA fuente de verdad
- `definition` es DERIVADO (se construye siempre desde columnas)
- Nunca se confía en `definition` entrante desde el frontend
- Se mantiene solo por compatibilidad legacy y exportación

### 2. Política de Soft-Delete

**ANTES**: CREATE podía colisionar con soft-deleted sin mensaje claro

**AHORA**: Política explícita
- Un `context_key` soft-deleted NO puede recrearse automáticamente
- CREATE:
  - Si existe activo → error 409 "ya existe"
  - Si existe soft-deleted → error 409 con mensaje claro indicando que debe restaurarse
- Método explícito `restore()` para restaurar contextos eliminados
- NO se reutilizan keys eliminados silenciosamente

---

## 📝 CAMBIOS IMPLEMENTADOS

### BACKEND

#### `src/infra/repos/pde-contexts-repo-pg.js`

**Funciones Helper Añadidas**:
- `normalizePayload(data)`: Elimina campos `undefined` del payload
- `validateCombinations(data)`: Valida combinaciones canónicas (kind='level'→scope='structural', etc.)
- `buildDefinitionFromColumns(columns)`: Construye `definition` JSONB desde columnas dedicadas

**Método `create()`**:
- ✅ Normaliza payload (elimina undefined)
- ✅ Valida que context_key no exista (activo o eliminado)
- ✅ Error claro si existe eliminado (indica usar restore())
- ✅ Valida combinaciones antes de guardar
- ✅ Construye `definition` desde columnas (no confía en definition entrante)
- ✅ Logs estructurados temporales

**Método `updateByKey()`**:
- ✅ Normaliza payload (elimina undefined)
- ✅ No permite borrar campos obligatorios (scope, kind, type)
- ✅ Valida combinaciones con valores finales
- ✅ Reconstruye `definition` desde columnas después del update
- ✅ Logs estructurados temporales

**Método `getByKey()`**:
- ✅ Corregido para manejar `includeDeleted` correctamente
- ✅ Si `includeDeleted=false`, no aplica filtro canónico (puede haber eliminados inválidos)

**Método `restoreByKey()`** (NUEVO):
- ✅ Restaura contextos eliminados (pone `deleted_at = NULL`)
- ✅ Logs estructurados temporales

**Método `softDeleteByKey()`**:
- ✅ Logs estructurados temporales

#### `src/services/pde-contexts-service.js`

**Función `createContext()`**:
- ✅ Actualizada para usar columnas dedicadas (no requiere definition)
- ✅ Eliminada dependencia de `definition` como fuente de verdad

**Función `updateContext()`**:
- ✅ Elimina `definition` del patch (se reconstruye automáticamente)
- ✅ Usa solo columnas dedicadas

**Función `deleteContext()`**:
- ✅ Simplificada (eliminada lógica de contextos virtuales)

**Función `restoreContext()`** (NUEVO):
- ✅ Método explícito para restaurar contextos eliminados

#### `src/endpoints/admin-contexts-api.js`

**Función `normalizePayload()`** (NUEVO):
- ✅ Helper para normalizar payloads (eliminar undefined)

**Función `handleCreateContext()`**:
- ✅ Normaliza payload antes de procesar
- ✅ No envía `definition` al servicio (se construye desde columnas)
- ✅ Errores claros del backend (409 para conflictos, 400 para validación)

**Función `handleUpdateContext()`**:
- ✅ Normaliza payload antes de procesar
- ✅ Elimina `definition` del patch (se reconstruye automáticamente)
- ✅ Errores claros del backend

**Función `handleRestoreContext()`** (NUEVO):
- ✅ Endpoint POST `/admin/api/contexts/:key/restore`
- ✅ Restaura contextos eliminados

### FRONTEND

#### `src/core/html/admin/contexts/contexts-manager.html`

**Función `guardarContexto()`**:
- ✅ Eliminada validación de `definition` JSON
- ✅ Eliminada construcción de `definition` desde formulario
- ✅ Payload limpio (no envía `undefined`)
- ✅ No envía `definition` como fuente de verdad
- ✅ Muestra errores claros del backend

**Construcción de Payload**:
- ✅ Solo envía columnas dedicadas (scope, kind, type, injected, allowed_values, default_value)
- ✅ Limpia payload eliminando campos `undefined`
- ✅ `description` solo se envía si está definido (no undefined, no null, no vacío)

### CONSISTENCIA

#### `src/core/packages/package-engine.js`

**Serialización de Contextos en Paquetes**:
- ✅ Usa columnas dedicadas como fuente de verdad (scope, type, default_value)
- ✅ Fallback a `definition` solo si columnas no están disponibles (compatibilidad)

---

## 🚨 BREAKING CHANGES

### API Changes

1. **CREATE `/admin/api/contexts`**:
   - ❌ Ya NO acepta `definition` como fuente de verdad
   - ✅ Usa columnas dedicadas (scope, kind, type, injected, allowed_values, default_value)
   - ❌ Si se envía `definition`, se ignora (se construye desde columnas)

2. **UPDATE `/admin/api/contexts/:key`**:
   - ❌ Ya NO acepta `definition` para actualizar
   - ✅ Si se envía `definition`, se ignora (se reconstruye desde columnas)

3. **NUEVO: RESTORE `/admin/api/contexts/:key/restore`**:
   - ✅ POST para restaurar contextos eliminados

### Comportamiento Cambiado

1. **CREATE con context_key eliminado**:
   - ❌ ANTES: Error genérico "ya existe"
   - ✅ AHORA: Error claro "fue eliminado anteriormente. Use restore() o cambie el context_key"

2. **UPDATE**:
   - ❌ ANTES: Podía perder campos si no se enviaban
   - ✅ AHORA: Campos no enviados se mantienen, pero no se pueden borrar campos obligatorios

3. **Definition**:
   - ❌ ANTES: Podía desincronizarse de columnas dedicadas
   - ✅ AHORA: Siempre se reconstruye desde columnas (sincronizado)

---

## ✅ VERIFICACIONES REALIZADAS

### Pruebas Manuales (Pendientes)

- [ ] Crear contexto nuevo (enum, number, level)
- [ ] Editar contexto existente
- [ ] Borrar contexto (soft delete)
- [ ] Intentar crear contexto con key eliminado (debe fallar con error claro)
- [ ] Restaurar contexto eliminado
- [ ] Usar contextos en package
- [ ] Verificar que contexts se serializan correctamente en package JSON

---

## 📊 MÉTRICAS DE ÉXITO

Después de las correcciones, el sistema debe cumplir:

- ✅ CREATE permite recrear contextos eliminados usando restore() (o bloquea explícitamente)
- ✅ UPDATE no pierde campos no enviados
- ✅ `definition` y columnas dedicadas están siempre sincronizadas
- ✅ Frontend nunca envía `undefined` en el payload
- ✅ No se pueden crear contextos con combinaciones inválidas
- ✅ `definition` siempre es válido antes de guardar
- ✅ Logs estructurados permiten rastrear problemas

---

## 🔄 PRÓXIMOS PASOS

1. **FASE 2.D**: Verificación exhaustiva (crear, editar, borrar, restaurar, usar en packages)
2. **FASE 2.E**: Commit versionado, eliminar logs temporales, actualizar documentación

---

## 📚 ARCHIVOS MODIFICADOS

- `src/infra/repos/pde-contexts-repo-pg.js` - Repositorio (CREATE, UPDATE, RESTORE)
- `src/services/pde-contexts-service.js` - Servicio (createContext, updateContext, restoreContext)
- `src/endpoints/admin-contexts-api.js` - API endpoints (normalización, errores claros)
- `src/core/html/admin/contexts/contexts-manager.html` - Frontend (payload limpio)
- `src/core/packages/package-engine.js` - Serialización en paquetes (usar columnas dedicadas)

---

## 🗑️ LOGS TEMPORALES

Los siguientes logs estructurados son TEMPORALES y deben eliminarse después de verificación:

- `[CONTEXTS][DIAG][CREATE]` - En repositorio
- `[CONTEXTS][DIAG][UPDATE]` - En repositorio
- `[CONTEXTS][DIAG][DELETE]` - En repositorio
- `[CONTEXTS][DIAG][RESTORE]` - En repositorio
- `[CONTEXTS][DIAG][API][CREATE]` - En endpoint
- `[CONTEXTS][DIAG][API][UPDATE]` - En endpoint
- `[CONTEXTS][DIAG][VALIDATION]` - En validación de combinaciones

---

**FIN DEL CHANGELOG**





