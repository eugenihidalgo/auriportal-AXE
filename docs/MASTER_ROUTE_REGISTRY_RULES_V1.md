# MASTER ROUTE REGISTRY RULES v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Versión:** 1.0.0  
**Fecha:** 2026-01-13  
**Estado:** CANÓNICO  
**Commit:** (pendiente - v5.69.0-reset-alumnos-fix-logger)

---

## PROPÓSITO

Documentación canónica de las reglas obligatorias para el registro de rutas en dominio MASTER.

Este documento establece las reglas constitucionales que garantizan que todas las rutas MASTER estén correctamente registradas y validadas.

**OBLIGATORIO:** Cualquier nueva ruta MASTER debe cumplir estas reglas.

---

## 1) REGLA CANÓNICA: ENDPOINTS MASTER API DEBEN REGISTRARSE EXPLÍCITAMENTE

### 1.1 Principio Fundamental

**En dominio MASTER, ningún endpoint `/master/api/**` puede existir sin:**
- ✅ Registro explícito en `master-route-registry.js`
- ✅ `method` + `path` + `type='api'` declarados
- ✅ Mapeo en `MASTER_HANDLER_MAP` del resolver

### 1.2 Protección Constitucional

**Si no está registrado:**
- El router debe fallar (fail-hard)
- Error esperado: `MASTER_API_ROUTE_NOT_REGISTERED`
- Stack trace completo para debugging
- **Esto NO es un bug, es una protección constitucional**

**Razón:**
- Garantiza que todas las rutas API están documentadas
- Previene rutas "fantasma" que funcionan por casualidad
- Facilita mantenimiento y auditoría
- Asegura coherencia entre registry y handlers

### 1.3 UI y Lógica NO Deben Saltarse Esta Capa

**PROHIBIDO:**
- ❌ Crear endpoints sin registro en el registry
- ❌ Asumir que "si funciona, está bien"
- ❌ Intentar bypass del router para rutas API
- ❌ Usar rutas API sin verificar registro

**OBLIGATORIO:**
- ✅ Registrar TODA ruta API en `master-route-registry.js`
- ✅ Declarar `method` explícitamente (GET, POST, PUT, DELETE)
- ✅ Declarar `type='api'` (nunca 'island' o 'page')
- ✅ Mapear handler en `MASTER_HANDLER_MAP`

---

## 2) ESTRUCTURA DE REGISTRO

### 2.1 Formato Canónico

**Archivo:** `src/core/master/registry/master-route-registry.js`

**Estructura mínima:**
```javascript
{
  key: 'master-api-endpoint-name',
  path: '/master/api/endpoint',
  type: 'api',
  method: 'POST'  // O 'GET', 'PUT', 'DELETE'
}
```

### 2.2 Campos Obligatorios

- **`key`**: Identificador único canónico (formato: `master-api-*`)
- **`path`**: Ruta exacta (debe empezar con `/master/api/`)
- **`type`**: Siempre `'api'` para endpoints API
- **`method`**: Método HTTP explícito (GET, POST, PUT, DELETE)

### 2.3 Múltiples Métodos en Misma Ruta

**Si una ruta maneja múltiples métodos HTTP:**
- Crear entrada separada por cada método
- Usar keys distintos pero descriptivos
- Ejemplo:

```javascript
// GET /master/api/students
{
  key: 'master-api-students',
  path: '/master/api/students',
  type: 'api',
  method: 'GET'
},
// POST /master/api/students
{
  key: 'master-api-students-create',
  path: '/master/api/students',
  type: 'api',
  method: 'POST'
}
```

**Ambas entradas pueden mapear al mismo handler** (el handler maneja múltiples métodos internamente).

---

## 3) MAPEO DE HANDLERS

### 3.1 MASTER_HANDLER_MAP

**Archivo:** `src/core/master/router/master-router-resolver.js`

**Estructura:**
```javascript
const MASTER_HANDLER_MAP = {
  'master-api-endpoint-name': () => import('../../../endpoints/master-api-endpoint.js'),
  // ...
};
```

### 3.2 Reglas de Mapeo

- **Cada `key` del registry debe tener entrada en `MASTER_HANDLER_MAP`**
- **El handler debe exportar función por defecto**
- **El handler debe manejar el método HTTP declarado**

---

## 4) VALIDACIÓN Y ERRORES

### 4.1 Validación en Runtime

El router valida en este orden:

1. **Pre-check estructural:** ¿Es ruta `/master/api/**`?
2. **Búsqueda en registry:** ¿Existe entrada con path + method?
3. **Validación de tipo:** ¿`type === 'api'`?
4. **Validación de handler:** ¿Existe en `MASTER_HANDLER_MAP`?

### 4.2 Errores Posibles

**`MASTER_API_ROUTE_NOT_REGISTERED`:**
- Ruta no existe en registry
- **Solución:** Añadir entrada en `master-route-registry.js`

**`MASTER_API_ROUTE_WRONG_TYPE`:**
- Ruta existe pero `type !== 'api'`
- **Solución:** Cambiar `type` a `'api'`

**`MASTER_API_HANDLER_NOT_MAPPED`:**
- Ruta existe pero no tiene handler en `MASTER_HANDLER_MAP`
- **Solución:** Añadir mapeo en `master-router-resolver.js`

---

## 5) CASO DE ESTUDIO: POST /master/api/students

### 5.1 Problema Original

**Síntoma:**
- Error 500: `MASTER_API_ROUTE_NOT_REGISTERED`
- Endpoint POST `/master/api/students` existía pero no estaba registrado
- GET `/master/api/students` funcionaba (estaba registrado)

### 5.2 Solución Aplicada

**Versión:** v5.69.0-reset-alumnos-fix-logger  
**Commit:** (pendiente)

**Cambios:**

1. **Registry (`master-route-registry.js`):**
```javascript
{
  key: 'master-api-students-create',
  path: '/master/api/students',
  type: 'api',
  method: 'POST'
}
```

2. **Handler Map (`master-router-resolver.js`):**
```javascript
'master-api-students-create': () => import('../../../endpoints/master-api-students.js'),
```

**Resultado:**
- ✅ POST `/master/api/students` ahora pasa validación
- ✅ GET `/master/api/students` sigue funcionando
- ✅ Error 500 eliminado
- ✅ Creación canónica de alumnos funciona

### 5.3 Lecciones Aprendidas

- **Siempre registrar ambos métodos** (GET y POST) si el handler los maneja
- **Usar keys descriptivos** (`master-api-students-create` vs `master-api-students`)
- **Verificar mapeo de handlers** después de añadir rutas

---

## 6) CHECKLIST OBLIGATORIO

Al crear un nuevo endpoint `/master/api/**`:

- [ ] ¿Está registrado en `master-route-registry.js`?
- [ ] ¿Tiene `type='api'`?
- [ ] ¿Tiene `method` explícito (GET, POST, etc.)?
- [ ] ¿Está mapeado en `MASTER_HANDLER_MAP`?
- [ ] ¿El handler exporta función por defecto?
- [ ] ¿El handler maneja el método HTTP declarado?
- [ ] ¿Se probó manualmente (GET/POST según corresponda)?

---

## 7) REFERENCIAS

- **Registry:** `src/core/master/registry/master-route-registry.js`
- **Resolver:** `src/core/master/router/master-router-resolver.js`
- **Documentación API:** `docs/MASTER_API_CONTRACTS.md`
- **Documentación Strict Resolution:** `docs/MASTER_API_STRICT_RESOLUTION_V1.md`
- **Caso de estudio:** POST `/master/api/students` (creación canónica de alumnos)

---

## 8) CIERRE CANÓNICO

**Regla canónica de registro de rutas MASTER API: ESTABLECIDA**

**Estado:**
- ✅ Protección constitucional activa
- ✅ Fail-hard en rutas no registradas
- ✅ Documentación canónica completa
- ✅ Caso de estudio documentado

**OBLIGATORIO:** Cualquier nueva ruta API en dominio MASTER debe cumplir estas reglas.

---

**ESTADO:** CANÓNICO  
**REFERENCIA:** OBLIGATORIA
