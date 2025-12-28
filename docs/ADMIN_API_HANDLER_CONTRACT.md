# Admin API Handler Contract v1

## Propósito

Este documento define el **contrato canónico** para handlers API del Admin Router de AuriPortal. Establece reglas estructurales que garantizan que **un endpoint API sin handler es IMPOSIBLE**.

## Principio Fundamental

> **Si una ruta API está registrada en `admin-route-registry.js`, DEBE tener un handler válido.**

Un endpoint API sin handler es un **BUG ESTRUCTURAL** que provoca errores 500 silenciosos (`ERR_MODULE_NOT_FOUND`).

## Cómo Funciona el Sistema

### 1. Registro de Rutas

Todas las rutas admin están registradas en `src/core/admin/admin-route-registry.js`:

```javascript
{
  key: 'api-theme-studio-canon-themes',
  path: '/admin/api/theme-studio-canon/themes',
  type: 'api',
  method: 'GET'
}
```

### 2. Resolución de Handlers

El Admin Router Resolver (`admin-router-resolver.js`) resuelve handlers en este orden:

1. **HANDLER_MAP** (mapeo explícito para handlers centralizados)
2. **Inferencia** (según patrón estándar)
3. **Error estructural** (si no se puede resolver)

### 3. Inferencia de Handlers

#### Patrón Estándar para Rutas API

```
routeKey: 'api-{name}'
→ handler: src/endpoints/admin-{name}-api.js
```

**Ejemplo:**
- `routeKey: 'api-packages'`
- `→ handler: src/endpoints/admin-packages-api.js`

#### Patrón para Handlers Centralizados

Algunos grupos de rutas comparten un mismo handler. Estos se mapean explícitamente en `HANDLER_MAP`:

```javascript
'api-theme-studio-canon-themes': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
'api-theme-studio-canon-theme': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
'api-theme-studio-canon-validate': () => import('../../endpoints/admin-theme-studio-canon-api.js'),
// ... todas apuntan al mismo handler centralizado
```

## Contrato del Handler

### Requisitos Obligatorios

1. **Archivo debe existir** en `src/endpoints/`
2. **Debe exportar `default function`** (a menos que sea named export conocido)
3. **Función debe aceptar** `(request, env, ctx)`
4. **Debe devolver** `Response` o `Promise<Response>`
5. **Content-Type debe ser `application/json`** para endpoints API

### Ejemplo Mínimo Válido

```javascript
// src/endpoints/admin-example-api.js
import { requireAdminContext } from '../core/auth-context.js';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async function handler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  
  // CRÍTICO: Endpoints API NUNCA devuelven HTML
  if (authCtx instanceof Response) {
    return jsonResponse({ ok: false, error: 'No autenticado' }, 401);
  }
  
  return jsonResponse({ ok: true, data: [] });
}
```

## Handlers Centralizados

Algunos handlers manejan múltiples rutas. Ejemplos:

- **admin-theme-studio-canon-api.js**: Maneja todas las rutas `api-theme-studio-canon-*`
- **admin-energy-api.js**: Maneja `api-energy-clean` y `api-energy-illuminate` (con funciones nombradas)
- **admin-automation-definitions-api.js**: Maneja múltiples rutas de automatizaciones

### Cómo Añadir un Handler Centralizado

1. **Crear el handler** en `src/endpoints/`
2. **Añadir todas las rutas al HANDLER_MAP** en `admin-router-resolver.js`
3. **Añadir al HANDLER_MAP del auditor** en `audit-admin-api-handlers.js`

## Auditoría Automática

### Script de Auditoría

El script `src/core/admin/audit-admin-api-handlers.js` verifica automáticamente:

- ✅ Archivos existen
- ✅ Exportan default function (o named export conocido)
- ✅ Reporta handlers faltantes

### Uso Manual

```bash
# Auditoría (solo reporte)
node src/core/admin/audit-admin-api-handlers.js

# Auditoría con auto-fix (crea stubs)
node src/core/admin/audit-admin-api-handlers.js --fix

# Auditoría fail-hard (lanza error si hay handlers faltantes)
node src/core/admin/audit-admin-api-handlers.js --fail
```

### Guard de Arranque

El guard de arranque se ejecuta automáticamente cuando el servidor arranca:

- **Modo WARNING**: Reporta handlers faltantes pero permite arrancar
- **Modo FAIL**: (futuro) Detiene el arranque si hay handlers faltantes

## Errores Comunes y Soluciones

### Error: `ERR_MODULE_NOT_FOUND`

**Causa:** Ruta registrada sin handler.

**Solución:**
1. Verificar que el archivo existe en `src/endpoints/`
2. Verificar que exporta `default function`
3. Si es handler centralizado, añadir a `HANDLER_MAP`

### Error: `Handler no mapeado para ruta: api-{name}`

**Causa:** Ruta en registry pero no en `HANDLER_MAP` ni inferible.

**Solución:**
1. Si es handler estándar: crear `admin-{name}-api.js`
2. Si es handler centralizado: añadir a `HANDLER_MAP`

### Error: `Handler inválido` (no es función)

**Causa:** Archivo existe pero no exporta función válida.

**Solución:**
1. Verificar que exporta `export default async function`
2. Verificar sintaxis del archivo

## Reglas Constitucionales

1. **Ninguna ruta API puede existir sin handler**
2. **Todos los handlers deben ser verificables** (archivo existe, exporta función)
3. **Handlers centralizados deben estar en HANDLER_MAP** (no confiar en inferencia)
4. **Auditoría debe ejecutarse en arranque** (guard constitucional)
5. **Endpoints API NUNCA devuelven HTML** (siempre JSON)

## Compatibilidad y Evolución

- **Versión actual:** v1.0.0
- **Fail-open:** Por defecto, el sistema permite arrancar con warnings
- **Fail-hard:** (Futuro) Permitir modo que detiene arranque con handlers faltantes
- **Auto-fix:** El script puede crear stubs automáticamente (modo `--fix`)

## Referencias

- `src/core/admin/admin-route-registry.js` - Registry de rutas
- `src/core/admin/admin-router-resolver.js` - Resolución de handlers
- `src/core/admin/audit-admin-api-handlers.js` - Script de auditoría
- `src/router.js` - Guard de arranque

---

**Última actualización:** 2024-12-28  
**Versión del contrato:** 1.0.0

