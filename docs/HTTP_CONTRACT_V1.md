# CONTRATO HTTP v1

**Versión**: 1.0  
**Fecha**: 2026-01-11  
**Estado**: CANÓNICO

---

## ENVELOPE CANÓNICO

Todos los endpoints MASTER + GOD usan el mismo envelope JSON.

### Respuesta Exitosa
```json
{
  "ok": true,
  "data": { ... },
  "trace_id": "abc123"
}
```

### Respuesta de Error
```json
{
  "ok": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  },
  "trace_id": "abc123"
}
```

---

## HEADERS OBLIGATORIOS

Todos los endpoints DEBEN incluir:

```
Content-Type: application/json; charset=utf-8
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
Pragma: no-cache
Expires: 0
X-Trace-Id: abc123
```

---

## HELPERS CANÓNICOS

**Único helper válido**: `http-json-v1.js`

**Ubicación**: `src/core/http/http-json-v1.js`

**API**:
```javascript
import { sendJsonOk, sendJsonError } from '../core/http/http-json-v1.js';

// Respuesta exitosa
return sendJsonOk(data, traceId);

// Respuesta de error
return sendJsonError(
  { message: 'Error description', code: 'ERROR_CODE' },
  400,
  traceId
);
```

---

## ERRORES

### Códigos de Error Canónicos

- `NOT_FOUND`: Recurso no encontrado (404)
- `VALIDATION_ERROR`: Error de validación (400)
- `UNAUTHORIZED`: No autorizado (401)
- `FORBIDDEN`: Prohibido (403)
- `INTERNAL_ERROR`: Error interno (500)

### Ejemplo
```javascript
return sendJsonError(
  { message: 'Student not found', code: 'NOT_FOUND' },
  404,
  traceId
);
```

---

## EJEMPLOS REALES

### Endpoint GOD
```javascript
// src/endpoints/god-api-me.js
import { sendJsonOk } from '../core/http/http-json-v1.js';

export default async function handler(req) {
  const traceId = getRequestId();
  const data = { user: '...' };
  return sendJsonOk(data, traceId);
}
```

### Endpoint MASTER
```javascript
// src/endpoints/master-api-students.js
import { sendJsonOk, sendJsonError } from '../core/http/http-json-v1.js';

export default async function handler(req) {
  const traceId = getRequestId();
  try {
    const data = await getStudents();
    return sendJsonOk(data, traceId);
  } catch (error) {
    return sendJsonError(
      { message: error.message, code: 'INTERNAL_ERROR' },
      500,
      traceId
    );
  }
}
```

---

## PROHIBICIONES

### ❌ PROHIBIDO

1. **Helpers alternativos**
   ```javascript
   // ❌ INCORRECTO
   import { jsonOk, jsonError } from './json-response.js';
   ```

2. **Respuestas manuales**
   ```javascript
   // ❌ INCORRECTO
   return new Response(JSON.stringify({ data }), {
     headers: { 'Content-Type': 'application/json' }
   });
   ```

3. **Envelopes inconsistentes**
   ```javascript
   // ❌ INCORRECTO
   return new Response(JSON.stringify({ success: true, result: data }), ...);
   ```

---

## VERIFICACIÓN

**Check**:
```bash
npm run check:http-contract
```

**Qué verifica**:
- Endpoints GOD usan `http-json-v1.js`
- Endpoints MASTER usan `http-json-v1.js`
- No hay helpers alternativos
- No hay respuestas manuales

**Fail-hard**: Si detecta dialectos alternativos, el check falla.

---

## REFERENCIAS

- `src/core/http/http-json-v1.js`: Helper canónico
- `docs/CONSTITUTION_PLATFORM_LAYER1.md`: Capa 1 completa

---

**ESTADO**: ✅ CONTRATO CERRADO (2026-01-11)
