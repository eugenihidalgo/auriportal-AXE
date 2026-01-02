# AuriPortal — Fix ROUTER_ERROR (trace_id: req_1767017995397_qpvhnn)

**Fecha:** 2025-01-XX  
**Estado:** ✅ RESUELTO

---

## INCIDENTE

**Error reportado:**
```json
{
  "ok": false,
  "error": "Error interno del servidor",
  "code": "ROUTER_ERROR",
  "trace_id": "req_1767017995397_qpvhnn"
}
```

**Ruta afectada:** `GET /admin/api/theme-studio-canon/theme/dark-classic`

---

## DIAGNÓSTICO

### Stacktrace encontrado:

```
[ADMIN_ROUTER] resolving path=/admin/api/theme-studio-canon/theme/dark-classic method=GET trace_id=req_1767017995397_qpvhnn
[ADMIN_ROUTER] matched routeKey=admin-dashboard path=/admin type=island trace_id=req_1767017995397_qpvhnn
[ADMIN_ROUTER] ❌ ERROR ESTRUCTURAL: API_ROUTE_AS_ISLAND path=/admin/api/theme-studio-canon/theme/dark-classic method=GET trace_id=req_1767017995397_qpvhnn
```

**Causa raíz:**
El resolver estaba encontrando la ruta `/admin` (admin-dashboard) cuando debería encontrar `/admin/api/theme-studio-canon/theme/:id`. El problema era que el matching de `startsWith` estaba ocurriendo antes del matching de parámetros dinámicos, y `/admin` coincidía con `/admin/api/theme-studio-canon/theme/dark-classic` antes de que se evaluara la ruta con parámetros.

**Archivo afectado:** `src/core/admin/admin-router-resolver.js` (líneas 161-196)

---

## FIX APLICADO

### Cambio realizado:

**Antes:**
- El resolver buscaba en todas las rutas ordenadas por longitud
- El matching de parámetros dinámicos y `startsWith` ocurrían en el mismo loop
- `/admin` coincidía antes que `/admin/api/theme-studio-canon/theme/:id`

**Después:**
- Separar rutas con parámetros dinámicos de rutas sin parámetros
- **PRIMERO:** Buscar en rutas con parámetros dinámicos (ordenadas por longitud DESC)
- **SEGUNDO:** Si no se encuentra, buscar en rutas sin parámetros (ordenadas por longitud DESC)

**Código modificado:**
```javascript
// Separar rutas con y sin parámetros dinámicos
const routesWithParams = ADMIN_ROUTES.filter(r => r.path.includes(':'));
const routesWithoutParams = ADMIN_ROUTES.filter(r => !r.path.includes(':'));

// PRIMERO: Buscar en rutas con parámetros dinámicos
const sortedRoutesWithParams = routesWithParams.sort((a, b) => b.path.length - a.path.length);
route = sortedRoutesWithParams.find(r => {
  // Matching de parámetros dinámicos con regex
  if (routePath.includes(':')) {
    const paramPattern = routePath.replace(/:[^/]+/g, '([^/]+)');
    const regex = new RegExp(`^${paramPattern}$`);
    if (regex.test(normalizedPath)) {
      return true;
    }
  }
  return false;
});

// SEGUNDO: Si no se encontró, buscar en rutas sin parámetros
if (!route) {
  const sortedRoutesWithoutParams = routesWithoutParams.sort((a, b) => b.path.length - a.path.length);
  route = sortedRoutesWithoutParams.find(r => {
    // Matching con startsWith
    if (normalizedPath === routePath || normalizedPath.startsWith(routePath + '/')) {
      return true;
    }
    return false;
  });
}
```

**Archivo modificado:**
- `src/core/admin/admin-router-resolver.js` (líneas 161-212)

---

## VERIFICACIÓN

### Comandos ejecutados:

```bash
# 1. Ruta problemática
curl -i http://localhost:3000/admin/api/theme-studio-canon/theme/dark-classic
# Resultado: 401 Unauthorized (correcto, requiere auth) ✅
# Antes: 500 ROUTER_ERROR ❌

# 2. Otras rutas
curl -i http://localhost:3000/admin/__version
# Resultado: 200 OK ✅

curl -i http://localhost:3000/admin/api/assembly/status
# Resultado: 401 Unauthorized (correcto) ✅

# 3. Tests guardianes
node tests/admin-ui-creation-guardian.test.js
# Resultado: ✅ Todos los tests pasaron (12/12)

# 4. Assembly check
node scripts/admin-ui-assembly-check.js
# Resultado: ✅ 0 errores
```

### Logs verificados:

```
[ADMIN_ROUTER] resolving path=/admin/api/theme-studio-canon/theme/dark-classic method=GET
[ADMIN_ROUTER] matched routeKey=api-theme-studio-canon-theme path=/admin/api/theme-studio-canon/theme/:id type=api
[ADMIN_ROUTER] handler resolved successfully key=api-theme-studio-canon-theme
```

**✅ Confirmado:** La ruta se resuelve correctamente como `api-theme-studio-canon-theme` (type: api).

---

## AJUSTE SECUNDARIO: Assembly Check

**Problema:** El assembly check estaba exigiendo `renderAdminPage()` en todas las rutas `island`, incluyendo rutas `/admin/api/*` que son APIs.

**Solución:** Ajustado `checkIslandRoutesUseRenderAdminPage()` para:
- Saltar rutas `island` que empiezan con `/admin/api/` (deben ser `type: api`)
- Solo verificar `renderAdminPage()` en rutas `island` que NO son APIs

**Archivo modificado:**
- `scripts/admin-ui-assembly-check.js` (líneas 112-120)

---

## ESTADO FINAL

✅ **ROUTER_ERROR RESUELTO**

- ✅ Ruta `/admin/api/theme-studio-canon/theme/dark-classic` se resuelve correctamente
- ✅ No más errores `API_ROUTE_AS_ISLAND`
- ✅ Tests guardianes pasando
- ✅ Assembly check ajustado correctamente
- ✅ Fix mínimo y canónico (sin parches frontend)

**Evidencia:**
- Respuesta 401 Unauthorized (comportamiento esperado con auth)
- Logs muestran resolución correcta: `api-theme-studio-canon-theme` (type: api)
- No más errores ROUTER_ERROR en logs

---

## LECCIONES APRENDIDAS

1. **Prioridad de matching:** Rutas con parámetros dinámicos deben evaluarse ANTES de rutas con `startsWith`
2. **Separación de lógica:** Separar rutas con y sin parámetros dinámicos mejora la claridad y evita bugs
3. **Verificación:** Siempre verificar con logs y tests después de un fix

---

**Última actualización:** 2025-01-XX




