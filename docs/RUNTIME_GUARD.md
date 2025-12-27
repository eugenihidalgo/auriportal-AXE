# Runtime Guard Canónico - Documentación

## Objetivo

Garantizar que **TODO el backend responde SIEMPRE JSON válido**, incluso ante errores inesperados. Este guard es la base del futuro "Contrato de Contratos".

## Problema Resuelto

Antes de implementar el Runtime Guard, existían múltiples lugares donde el backend podía devolver:
- Texto plano (`"Error interno del servidor"`)
- HTML (`"<html>Error</html>"`)
- Responses sin formato JSON canónico
- Excepciones no capturadas que rompían el frontend

Esto violaba el contrato implícito de que todas las respuestas deben ser JSON válido.

## Refinamiento: Normalización Selectiva

El Runtime Guard ahora aplica normalización **solo a APIs**, dejando pasar intactas las páginas HTML del Admin:

- **APIs** (`/admin/api/**`): Siempre normalizadas a JSON canónico
- **Páginas HTML** (`/admin/**` sin `/api`): Dejadas pasar sin normalizar
- **Requests con `Accept: application/json`**: Normalizadas a JSON
- **Requests con `Accept: text/html`**: Dejadas pasar sin normalizar

## Solución

El **Runtime Guard** es un wrapper que:
1. Envuelve todos los handlers del router
2. Captura todas las excepciones no manejadas
3. Normaliza selectivamente las respuestas API a JSON válido
4. Deja pasar intactas las páginas HTML del Admin
5. Aplica formato canónico a todas las respuestas API

## Arquitectura

### Punto de Entrada

El Runtime Guard se integra en `server.js` en el punto donde se llama a `router.fetch()`:

```javascript
import { withRuntimeGuard } from './src/core/runtime-guard.js';

// Envolver el router con el guard
const guardedRouter = withRuntimeGuard(router.fetch.bind(router));
const response = await guardedRouter(request, env, ctx);
```

### Flujo de Ejecución

```
Request → server.js → Runtime Guard → router.fetch() → Handler
                                                          ↓
Response ← server.js ← Runtime Guard ← Normalización ← Response
```

### Formato Canónico

Todas las respuestas de error siguen este formato:

```json
{
  "ok": false,
  "error": "Mensaje de error legible",
  "code": "ERROR_CODE",
  "details": { /* opcional, solo en desarrollo */ },
  "trace_id": "trace-1234567890-abc123"
}
```

Todas las respuestas exitosas siguen este formato:

```json
{
  "ok": true,
  "data": { /* datos de respuesta */ },
  "trace_id": "trace-1234567890-abc123"
}
```

## Funcionalidades

### 1. Captura de Excepciones

El guard captura TODAS las excepciones no manejadas y las convierte en respuestas JSON válidas:

```javascript
try {
  const response = await handler(request, env, ctx);
  // ...
} catch (error) {
  return createErrorResponse(error, traceId, 500);
}
```

### 2. Normalización Selectiva

El guard aplica normalización **solo cuando es necesario**:

**Se normaliza (APIs)**:
- Path empieza por `/admin/api`
- O `Accept` header incluye `application/json`
- Texto plano → JSON con formato canónico
- HTML → JSON con formato canónico (solo en APIs)
- JSON sin formato canónico → JSON con formato canónico
- JSON con formato canónico → Asegurar `trace_id`

**NO se normaliza (Páginas HTML)**:
- Path NO empieza por `/admin/api` Y `Accept` incluye `text/html`
- Respuestas HTML del Admin se dejan pasar intactas
- Login y páginas del Admin renderizan correctamente

### 3. Detección de Tipo de Request

El guard detecta el tipo de request para decidir si normalizar:

```javascript
function shouldNormalizeResponse(request) {
  const path = url.pathname;
  const acceptHeader = request.headers?.get('Accept') || '';

  // NO normalizar si es página HTML del Admin
  if (!path.startsWith('/admin/api') && acceptHeader.includes('text/html')) {
    return false;
  }

  // SÍ normalizar si es API
  if (path.startsWith('/admin/api')) {
    return true;
  }

  // SÍ normalizar si se espera JSON
  if (acceptHeader.includes('application/json')) {
    return true;
  }

  return false;
}
```

### 4. Verificación de Tipos

El guard verifica que:
- La respuesta sea un objeto `Response` válido
- El `Content-Type` sea `application/json` para errores en APIs
- El formato JSON sea válido (solo en APIs)

### 5. Trace ID

Todas las respuestas incluyen un `trace_id` único para debugging:
- Usa `getRequestId()` del contexto de observabilidad si está disponible
- Genera un ID único si no hay contexto

## Archivos Modificados

### 1. `src/core/runtime-guard.js` (NUEVO)

Módulo principal del Runtime Guard:
- `withRuntimeGuard(handler)`: Función principal que envuelve handlers
- `normalizeToJson(response, traceId)`: Normaliza respuestas a JSON
- `createErrorResponse(error, traceId, status)`: Crea respuestas de error JSON
- `isJsonResponse(response)`: Verifica si una respuesta es JSON
- `isTextOrHtmlResponse(response)`: Verifica si una respuesta es texto/HTML

### 2. `server.js` (MODIFICADO)

Cambios:
- Importa `withRuntimeGuard` desde `src/core/runtime-guard.js`
- Envuelve `router.fetch()` con el guard
- Convierte todos los `res.end('texto')` a `res.end(JSON.stringify({...}))`
- Cambia `Content-Type: text/plain` a `Content-Type: application/json`

**Líneas modificadas**:
- Línea 121: Import del Runtime Guard
- Líneas 272-282: Error de URL no disponible → JSON
- Líneas 429-443: Error de request incompleto → JSON
- Líneas 453-480: Router envuelto con Runtime Guard
- Líneas 482-495: Verificación de respuesta inválida → JSON
- Líneas 564-590: Catch de emergencia → JSON

### 3. `src/router.js` (MODIFICADO)

Cambios:
- Convierte respuestas de error a JSON
- Añade `trace_id` a todas las respuestas de error

**Líneas modificadas**:
- Líneas 82-94: Error de URL no disponible → JSON
- Líneas 173-175: Error 403 Forbidden → JSON
- Líneas 179-191: Error 404 Not Found → JSON
- Líneas 1505-1521: Catch de error → JSON

## Garantías

### ✅ Ningún Endpoint Puede Escapar

El Runtime Guard envuelve `router.fetch()` en el punto de entrada (`server.js`), por lo que:
- Todos los handlers pasan por el guard
- Todas las excepciones se capturan
- Todas las respuestas se normalizan

### ✅ Ningún Error Legacy Rompe el Contrato

El guard detecta y normaliza:
- Respuestas de texto plano legacy
- Respuestas HTML legacy
- Respuestas JSON sin formato canónico

### ✅ Handlers Actuales NO Necesitan Cambios

Los handlers existentes pueden seguir devolviendo:
- Texto plano (se normaliza automáticamente)
- HTML (se normaliza automáticamente)
- JSON sin formato canónico (se normaliza automáticamente)
- JSON con formato canónico (se verifica y se añade `trace_id` si falta)

## Ejemplos

### Antes (Texto Plano)

```javascript
// En algún handler
return new Response("Error interno del servidor", {
  status: 500,
  headers: { "Content-Type": "text/plain" }
});
```

**Resultado**: Frontend recibe texto plano, rompe el parsing JSON.

### Después (JSON Normalizado)

```javascript
// El mismo handler devuelve texto plano
return new Response("Error interno del servidor", {
  status: 500,
  headers: { "Content-Type": "text/plain" }
});

// Runtime Guard normaliza automáticamente a:
{
  "ok": false,
  "error": "Error interno del servidor",
  "code": "HTTP_500",
  "trace_id": "trace-1234567890-abc123"
}
```

**Resultado**: Frontend siempre recibe JSON válido.

## Testing

Para verificar que el Runtime Guard funciona:

1. **Forzar error en handler**:
   ```javascript
   throw new Error("Test error");
   ```
   → Debe devolver JSON con formato canónico

2. **Devolver texto plano**:
   ```javascript
   return new Response("Error", { status: 500 });
   ```
   → Debe normalizarse a JSON

3. **Devolver HTML**:
   ```javascript
   return new Response("<html>Error</html>", { 
     status: 500,
     headers: { "Content-Type": "text/html" }
   });
   ```
   → Debe normalizarse a JSON

## Configuración

### Variables de Entorno

- `APP_ENV=prod`: Oculta stack traces en respuestas de error
- `DEBUG_FORENSIC=1`: Activa logs detallados del guard

### Logs

El guard loguea:
- `[RUNTIME_GUARD]`: Logs de normalización
- `[RUNTIME_GUARD][METRICS]`: Métricas de performance (solo con `DEBUG_FORENSIC=1`)

## Próximos Pasos

Este Runtime Guard es la base para:
1. **Contrato de Contratos**: Validación automática de contratos
2. **Observabilidad Mejorada**: Trazabilidad completa con `trace_id`
3. **Métricas Automáticas**: Tracking de errores y performance
4. **Validación de Schemas**: Validación automática de request/response schemas

## Notas Importantes

- ⚠️ **No modificar handlers individuales**: El guard maneja todo automáticamente
- ⚠️ **Respuestas no-JSON permitidas**: Imágenes, archivos, etc. se dejan pasar si `status < 400`
- ⚠️ **Errores siempre JSON**: Cualquier respuesta con `status >= 400` se normaliza a JSON
- ⚠️ **Trace ID obligatorio**: Todas las respuestas incluyen `trace_id` para debugging

---

**Implementado**: 2025-01-20  
**Versión**: 1.0.0  
**Autor**: Sistema AuriPortal

