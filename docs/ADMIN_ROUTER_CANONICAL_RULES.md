# AuriPortal — Reglas Canónicas del Router Admin

**Versión:** 1.0  
**Fecha:** 2025-01-XX  
**Estado:** CONSTITUCIONAL (NO MODIFICAR SIN DECISIÓN ARQUITECTÓNICA)

---

## PROPÓSITO

Este documento establece las reglas canónicas del Router Admin de AuriPortal. Estas reglas son **invariantes estructurales** que no pueden romperse sin rediseñar el sistema.

---

## DIFERENCIA: ASSEMBLY CHECK vs DIAGNÓSTICO RUNTIME

### Assembly Check (Estático)
- **Qué valida:** Estructura estática (registry, handlers, contratos)
- **Cuándo se ejecuta:** Manualmente o en CI/CD
- **Herramienta:** `scripts/admin-ui-assembly-check.js`
- **Limitaciones:** NO valida comportamiento runtime

**Ejemplo:**
```bash
node scripts/admin-ui-assembly-check.js
# Verifica que todas las rutas /admin/api/* tienen type=api
# Verifica que las rutas island usan renderAdminPage()
```

### Diagnóstico Runtime (Dinámico)
- **Qué valida:** Comportamiento real del sistema en ejecución
- **Cuándo se ejecuta:** Cuando ocurre un error o se necesita debug
- **Herramienta:** `trace_id` + logs PM2 + curl
- **Limitaciones:** Requiere servidor corriendo

**Ejemplo:**
```bash
# Buscar error por trace_id
pm2 logs | grep "req_1767017995397_qpvhnn"

# Probar ruta manualmente
curl -i http://localhost:3000/admin/api/theme-studio-canon/theme/dark-classic
```

---

## REGLA 1: ORDEN DE MATCHING CANÓNICO

### Orden Obligatorio

1. **Coincidencia exacta** (path === routePath)
2. **Rutas con parámetros dinámicos** (`:id`, `:key`, `:slug`, etc.)
3. **Rutas sin parámetros con startsWith** (ordenadas por longitud DESC)

### Por Qué Este Orden es Constitucional

**Bug histórico prevenido:** `API_ROUTE_AS_ISLAND`

**Caso real:**
- Ruta: `/admin/api/theme-studio-canon/theme/dark-classic`
- Bug: Se resolvía como `/admin` (admin-dashboard, type=island)
- Correcto: Debe resolverse como `/admin/api/theme-studio-canon/theme/:id` (type=api)

**Razón:**
- El matching semántico (parámetros dinámicos) tiene **prioridad absoluta** sobre el matching por prefijo
- Si `/admin` se evalúa antes que `/admin/api/theme/:id`, se rompe la separación API/UI
- Las rutas con parámetros son más específicas y deben evaluarse primero

### Implementación

**Archivo:** `src/core/admin/admin-router-resolver.js` (líneas 161-247)

**Comentarios canónicos:**
- Explican por qué el orden es constitucional
- Documentan el bug histórico que previene
- Advierten que NO debe modificarse sin decisión arquitectónica

---

## REGLA 2: SEPARACIÓN API/UI (INVARIANTE DURA)

### Regla

**Cualquier ruta `/admin/api/**`:**
- ✅ SOLO puede resolverse como `type=api`
- ❌ JAMÁS puede caer en `renderAdminPage()`
- ❌ JAMÁS puede resolverse como `island` UI

### Verificación

**Ubicación:** `src/core/admin/admin-router-resolver.js` (líneas 268-310)

**Código:**
```javascript
if (path.startsWith('/admin/api/') && route.type === 'island') {
  throw new Error('API_ROUTE_AS_ISLAND_PREVENTED');
}
```

**Log estructurado:**
- Código de error: `API_ROUTE_AS_ISLAND_PREVENTED`
- Trace_id incluido
- Detalles completos para diagnóstico forense

### Razón

Las APIs y las UIs son capas diferentes:
- **APIs:** Devuelven JSON, no HTML
- **UIs:** Usan `renderAdminPage()`, devuelven HTML

Si una API se resuelve como UI:
- El handler intentará usar `renderAdminPage()`
- Se generará HTML en lugar de JSON
- Se rompe el contrato API
- Se rompe la separación de responsabilidades

---

## REGLA 3: APIs SIEMPRE DEVUELVEN JSON

### Regla

**Si una ruta empieza por `/admin/api/`:**
- ✅ Debe tener `type=api` en el registry
- ✅ Su handler debe devolver JSON (no HTML)
- ✅ Content-Type debe ser `application/json`
- ❌ Nunca debe usar `renderAdminPage()`
- ❌ Nunca debe devolver HTML como fallback

### Verificaciones

#### 1. En el Resolver
**Ubicación:** `src/core/admin/admin-router-resolver.js` (líneas 312-330)

Verifica que rutas `/admin/api/*` tengan `type=api`:
```javascript
if (path.startsWith('/admin/api/') && route.type !== 'api') {
  throw new Error('API_ROUTE_INVALID_TYPE');
}
```

#### 2. En el Guard
**Ubicación:** `src/core/admin/admin-handler-guard.js` (líneas 32-60)

**Verificación 1:** APIs no tienen `routeContext`:
```javascript
if (isApi && routeContext) {
  throw new Error('API_ROUTE_HAS_UI_CONTEXT');
}
```

**Verificación 2:** APIs devuelven JSON:
```javascript
if (isApi) {
  const contentType = result.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Forzar respuesta JSON de error
  }
}
```

---

## CASO REAL: API_ROUTE_AS_ISLAND

### Incidente

**Fecha:** 2025-01-XX  
**Trace ID:** `req_1767017995397_qpvhnn`  
**Ruta:** `GET /admin/api/theme-studio-canon/theme/dark-classic`

**Error:**
```json
{
  "ok": false,
  "error": "Error interno del servidor",
  "code": "ROUTER_ERROR",
  "trace_id": "req_1767017995397_qpvhnn"
}
```

**Stacktrace:**
```
[ADMIN_ROUTER] matched routeKey=admin-dashboard path=/admin type=island
[ADMIN_ROUTER] ❌ ERROR ESTRUCTURAL: API_ROUTE_AS_ISLAND
```

### Causa Raíz

El resolver estaba evaluando rutas con `startsWith` antes que rutas con parámetros dinámicos:
1. `/admin/api/theme-studio-canon/theme/dark-classic` no tenía coincidencia exacta
2. El resolver buscaba por `startsWith`
3. `/admin` coincidía antes que `/admin/api/theme-studio-canon/theme/:id`
4. Se resolvía como `admin-dashboard` (type=island)
5. Se lanzaba error `API_ROUTE_AS_ISLAND`

### Fix Aplicado

**Cambio:** Separar rutas con parámetros dinámicos de rutas sin parámetros, y evaluar primero las rutas con parámetros.

**Resultado:**
- La ruta se resuelve correctamente como `api-theme-studio-canon-theme` (type=api)
- No más errores `API_ROUTE_AS_ISLAND`
- Respuesta correcta: 401 Unauthorized (comportamiento esperado)

---

## REGLAS QUE NO SE PUEDEN ROMPER

### 1. Orden de Matching

**NO se puede:**
- Evaluar `startsWith` antes que parámetros dinámicos
- Cambiar el orden sin decisión arquitectónica explícita
- Permitir que rutas genéricas (`/admin`) coincidan antes que rutas específicas

**Consecuencia de romperla:**
- Bug `API_ROUTE_AS_ISLAND`
- Separación API/UI rota
- Contratos violados

### 2. Separación API/UI

**NO se puede:**
- Resolver rutas `/admin/api/*` como `type=island`
- Permitir que APIs usen `renderAdminPage()`
- Devolver HTML desde rutas API

**Consecuencia de romperla:**
- Contrato API violado
- Frontend recibe HTML en lugar de JSON
- Errores en cliente

### 3. APIs Siempre JSON

**NO se puede:**
- Devolver HTML desde rutas API
- Usar `renderAdminPage()` en handlers API
- Permitir Content-Type no-JSON en APIs

**Consecuencia de romperla:**
- Contrato API violado
- Errores de parseo en cliente
- Sistema inconsistente

---

## VERIFICACIÓN

### Assembly Check

```bash
node scripts/admin-ui-assembly-check.js
```

**Verifica:**
- ✅ Todas las rutas `/admin/api/*` tienen `type=api`
- ✅ Rutas `island` (NO api) usan `renderAdminPage()`
- ✅ Sidebar placeholder se reemplaza correctamente
- ✅ Scripts globales no se duplican

### Tests Guardianes

```bash
node tests/admin-ui-creation-guardian.test.js
```

**Verifica:**
- ✅ Rutas con parámetros dinámicos en registry
- ✅ Resolver maneja parámetros dinámicos
- ✅ `renderAdminPage` valida contexto
- ✅ Router no llama `renderAdminPage` fuera de contexto
- ✅ Todas las rutas `/admin/api/*` tienen `type=api`
- ✅ Guard establece contexto correctamente

### Diagnóstico Runtime

```bash
# Buscar por trace_id
pm2 logs | grep "trace_id_here"

# Probar rutas manualmente
curl -i http://localhost:3000/admin/api/theme-studio-canon/theme/dark-classic
curl -i http://localhost:3000/admin/__version
curl -i http://localhost:3000/admin/api/assembly/status
```

**Verifica:**
- ✅ Rutas se resuelven correctamente
- ✅ `type=api` para rutas API
- ✅ No hay errores `ROUTER_ERROR`
- ✅ Respuestas JSON válidas en APIs

---

## PREPARACIÓN PARA FUTURO SISTEMA CANÓNICO

### TODO Explícito

**Ubicación:** `src/core/admin/admin-router-resolver.js` (comentario canónico)

**Texto:**
```
TODO FUTURO: Sistema Canónico de Creación de UI Admin

Toda nueva UI Admin deberá crearse mediante un Sistema Canónico
de Creación de UI que incluirá:
- renderAdminPage() obligatorio para UIs
- Declaración de capabilities
- Integración con Theme Studio
- Validación automática de contratos
- Assembly checks integrados

Este sistema se diseñará en una fase futura.
Por ahora, seguir el protocolo en docs/ADMIN_UI_CREATION_PROTOCOL_V1.md
```

**Estado:** NO implementado aún, solo preparado

---

## REFERENCIAS

- `docs/ADMIN_UI_CREATION_DIAGNOSTIC.md` - Diagnóstico completo del sistema
- `docs/ADMIN_UI_CREATION_PROTOCOL_V1.md` - Protocolo de creación de UIs
- `docs/ROUTER_ERROR_FIX_2025-01-XX.md` - Fix del bug histórico
- `src/core/admin/admin-router-resolver.js` - Implementación del resolver
- `src/core/admin/admin-handler-guard.js` - Guard de handlers

---

**Última actualización:** 2025-01-XX




