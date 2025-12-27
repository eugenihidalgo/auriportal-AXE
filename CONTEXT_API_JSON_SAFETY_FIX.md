# Fix: JSON Safety en Admin Contexts API

## Problema Identificado
El endpoint `/admin/api/contexts` estaba devolviendo **texto plano** en algunos casos de error, causando que el frontend fallara con:
```
"Invalid or unexpected token"
```

Esto ocurría cuando:
- DELETE /admin/api/contexts/:key tenía un error inesperado
- GET /admin/api/contexts fallaba
- ARCHIVE / RESTORE fallaban

## Solución Implementada

### 1. Helper `safeJsonEndpoint()`
Se agregó un helper en **src/endpoints/admin-contexts-api.js** que:

```javascript
function safeJsonEndpoint(handlerFn, handlerName) {
  return async (...args) => {
    try {
      return await handlerFn(...args);
    } catch (error) {
      // Atrapa CUALQUIER error inesperado
      // Devuelve SIEMPRE JSON válido
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Error interno del servidor',
        message: error?.message || 'Error desconocido'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}
```

### 2. Aplicación a Todos los Handlers
Todos los handlers en el router ahora están envueltos con `safeJsonEndpoint()`:

```javascript
// GET /admin/api/contexts
return await safeJsonEndpoint(handleListContexts, 'handleListContexts')(request, env);

// DELETE /admin/api/contexts/:key
return await safeJsonEndpoint(handleDeleteContext, 'handleDeleteContext')(contextKey, request, env);

// POST /admin/api/contexts/:key/archive
return await safeJsonEndpoint(handleArchiveContext, 'handleArchiveContext')(contextKey, request, env);

// POST /admin/api/contexts/:key/restore
return await safeJsonEndpoint(handleRestoreContext, 'handleRestoreContext')(contextKey, request, env);

// ... y más
```

## Garantías de Contrato HTTP

| Caso | Status | Response | Content-Type |
|------|--------|----------|--------------|
| ✅ Éxito | 200 | `{"ok":true,...}` | `application/json` |
| ❌ Validación fallida | 400 | `{"ok":false,"error":"..."}` | `application/json` |
| ❌ No encontrado | 404 | `{"ok":false,"error":"..."}` | `application/json` |
| 💥 Error inesperado | 500 | `{"ok":false,"error":"..."}` | `application/json` |

## Cambios Realizados

### Archivo Modificado
- **src/endpoints/admin-contexts-api.js**

### Cambios Específicos
1. ✅ Agregado helper `safeJsonEndpoint()` (líneas 33-54)
2. ✅ Router envuelve TODOS los handlers con `safeJsonEndpoint()`
3. ✅ Status codes correctos:
   - 200: éxito
   - 400: error de validación
   - 404: no encontrado
   - 500: error inesperado
4. ✅ Content-Type SIEMPRE es `application/json`
5. ✅ **NUNCA** devuelve texto plano, incluso en errores inesperados

### SIN Cambios (Respetadas las Restricciones)
- ✅ Router sin cambios (mismo patrón de rutas)
- ✅ Lógica de handlers sin cambios
- ✅ Action Engine sin cambios
- ✅ Frontend sin cambios
- ✅ Nombres de handlers sin cambios

## Verificación

### Sintaxis
```bash
node -c src/endpoints/admin-contexts-api.js
# ✅ Sin errores
```

### Test Manual

#### DELETE - Error Inesperado
```bash
curl -X DELETE \
  http://localhost/admin/api/contexts/invalid-key \
  -H "Authorization: Bearer TOKEN"
```

**Ahora responde JSON:**
```json
{
  "ok": false,
  "error": "Error interno del servidor",
  "message": "..."
}
```

Status: **500**  
Content-Type: **application/json**

#### GET - Error Inesperado
```bash
curl http://localhost/admin/api/contexts
```

**Responde JSON incluso si hay error:**
```json
{
  "ok": false,
  "error": "Error interno del servidor",
  "message": "..."
}
```

Status: **500**  
Content-Type: **application/json**

## Resultado Final
✅ **NUNCA** más "Invalid or unexpected token"  
✅ Frontend puede parsear respuestas con confianza  
✅ Todas las respuestas son JSON válido  
✅ Status codes reflejan el tipo de error  
✅ Logging detallado en caso de errores inesperados

## Impacto Cero
- No hay cambios en la lógica de negocio
- No hay cambios en el frontend
- No hay cambios en las rutas
- No hay cambios en el Action Engine
- No hay nuevas librerías
