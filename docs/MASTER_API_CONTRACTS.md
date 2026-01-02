# MASTER API Contracts - Reglas Constitucionales

**Versión:** 1.0.0  
**Fecha:** 2025-01-XX  
**Estado:** ✅ ACTIVO

---

## 🎯 Objetivo

Este documento formaliza las reglas constitucionales que garantizan que las rutas API del dominio MASTER (`/master/api/**`) NUNCA se resuelvan incorrectamente como islands, evitando errores `ROUTER_ERROR` y `MASTER_API_ROUTE_AS_ISLAND_PREVENTED`.

---

## 📜 REGLA CONSTITUCIONAL MASTER-API-001

### Identificador
**MASTER-API-001**: Separación absoluta API/Island en dominio MASTER

### Alcance
Todas las rutas que empiezan con `/master/api/**`

### Invariantes Obligatorias

1. **Registro en Master Route Registry**
   - Toda ruta `/master/api/**` DEBE estar registrada explícitamente en `src/core/master/registry/master-route-registry.js`
   - La entrada debe tener:
     - `key`: Identificador único canónico (formato: `master-api-*`)
     - `path`: Path exacto o con parámetros dinámicos (ej: `/master/api/alquimia-general/classifications`)
     - `type`: DEBE ser `'api'` (nunca `'island'`)
     - `method`: (Opcional) Método HTTP específico

2. **Mapeo en MASTER_HANDLER_MAP**
   - Toda ruta API registrada DEBE tener una entrada correspondiente en `MASTER_HANDLER_MAP` dentro de `src/core/master/router/master-router-resolver.js`
   - El handler debe ser una función que retorna una promesa de importación dinámica del módulo del endpoint

3. **Type: 'api' Obligatorio**
   - El campo `type` en el registry DEBE ser exactamente `'api'`
   - Está PROHIBIDO usar `'island'` para rutas `/master/api/**`
   - El resolver lanzará error `MASTER_API_ROUTE_INVALID_TYPE` si se viola

4. **Protección en Resolver**
   - El resolver (`master-router-resolver.js`) implementa guards constitucionales:
     - **Guard 1**: Si el path empieza con `/master/api/` y `route.type === 'island'` → Lanza `MASTER_API_ROUTE_AS_ISLAND_PREVENTED`
     - **Guard 2**: Si el path empieza con `/master/api/` y `route.type !== 'api'` → Lanza `MASTER_API_ROUTE_INVALID_TYPE`

### Error que se Produce si se Viola

Si una ruta `/master/api/**` se registra incorrectamente o se resuelve como island, se produce:

```javascript
{
  ok: false,
  error: "API route resolved as island: GET /master/api/...",
  code: "MASTER_API_ROUTE_AS_ISLAND_PREVENTED",
  details: {
    path: "/master/api/...",
    method: "GET",
    routeKey: "...",
    routePath: "...",
    routeType: "island", // ← ERROR: Debería ser "api"
    traceId: "...",
    message: "INVARIANTE ROTA: Ruta API Master no puede resolverse como island."
  }
}
```

O si el type es inválido:

```javascript
{
  ok: false,
  error: "API route has invalid type: GET /master/api/... (type=...)",
  code: "MASTER_API_ROUTE_INVALID_TYPE",
  details: {
    path: "/master/api/...",
    method: "GET",
    routeKey: "...",
    routePath: "...",
    routeType: "...", // ← ERROR: Debería ser "api"
    expectedType: "api",
    traceId: "...",
    message: "Ruta /master/api/* debe tener type=api en el registry"
  }
}
```

### Ejemplo Real: Caso alquimia-general/classifications

**Ruta problemática resuelta:**
```
GET /master/api/alquimia-general/classifications
```

**Registro correcto en master-route-registry.js:**
```javascript
{
  key: 'master-api-alquimia-classifications',
  path: '/master/api/alquimia-general/classifications',
  type: 'api', // ← OBLIGATORIO: type='api'
  method: 'GET'
}
```

**Mapeo correcto en MASTER_HANDLER_MAP:**
```javascript
const MASTER_HANDLER_MAP = {
  // ...
  'master-api-alquimia-classifications': () => import('../../../endpoints/master-api-alquimia-general.js'),
  // ...
};
```

**Handler correcto:**
El handler en `master-api-alquimia-general.js` debe exportar por defecto una función que maneja el método GET y devuelve JSON.

---

## ✅ Checklist para Nuevas Rutas MASTER API

Cuando Cursor o un desarrollador crea una nueva ruta `/master/api/**`, debe verificar:

- [ ] ✅ La ruta está registrada en `master-route-registry.js` con `type: 'api'`
- [ ] ✅ La ruta tiene una entrada en `MASTER_HANDLER_MAP` con el handler correcto
- [ ] ✅ El handler existe y exporta una función por defecto
- [ ] ✅ La ruta devuelve JSON (nunca HTML)
- [ ] ✅ `curl -i` de la ruta devuelve `Content-Type: application/json`
- [ ] ✅ No hay errores `MASTER_API_ROUTE_AS_ISLAND_PREVENTED` en logs
- [ ] ✅ No hay errores `MASTER_API_ROUTE_INVALID_TYPE` en logs

---

## 🔍 Verificación Manual

Para verificar que una ruta API está correctamente configurada:

```bash
# 1. Verificar que la ruta existe en el registry
grep -r "master-api-alquimia-classifications" src/core/master/registry/master-route-registry.js

# 2. Verificar que tiene type: 'api'
# (Debe aparecer type: 'api' en la misma entrada)

# 3. Verificar que está en MASTER_HANDLER_MAP
grep -r "master-api-alquimia-classifications" src/core/master/router/master-router-resolver.js

# 4. Probar la ruta (debe devolver JSON, no HTML)
curl -i https://master.pdeeugenihidalgo.org/master/api/alquimia-general/classifications

# Resultado esperado:
# - Status: 401 (sin auth) o 200 (con auth)
# - Content-Type: application/json; charset=utf-8
# - Body: JSON válido
```

---

## 📚 Referencias

- **Master Route Registry**: `src/core/master/registry/master-route-registry.js`
- **Master Router Resolver**: `src/core/master/router/master-router-resolver.js`
- **Ejemplo de Fix**: `docs/ROUTER_ERROR_FIX_2025-01-XX.md`
- **Contract of Contracts**: `docs/CONTRACT_OF_CONTRACTS.md`

---

## 🔄 Historial de Cambios

- **v1.0.0 (2025-01-XX)**: Creación inicial de la regla MASTER-API-001 después de resolver el error en `/master/api/alquimia-general/classifications`

---

**Última actualización:** 2025-01-XX
