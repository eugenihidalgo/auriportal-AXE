# MASTER API Strict Resolution v1

**Versión:** 1.0.0  
**Fecha:** 2025-01-02  
**Estado:** ✅ CERTIFICADO

---

## 🎯 Objetivo

Hacer **IMPOSIBLE** que una ruta `/master/api/**` se resuelva como `island` o caiga en fallback. Garantizar resolución estricta como API con diagnóstico explícito.

---

## 📜 Problema Histórico

**Error histórico:** `MASTER_API_ROUTE_AS_ISLAND_PREVENTED` - "API route resolved as island"

Este error ocurría cuando:
- Una ruta `/master/api/**` no estaba correctamente registrada
- El resolver caía en fallback y resolvía como `island`
- El guard detectaba la violación constitucional y lanzaba el error

**Consecuencias:**
- Rutas API devolvían HTML en lugar de JSON
- Errores silenciosos hasta que el guard los detectaba
- Diagnóstico tardío (en runtime)

---

## 🔒 Regla Constitucional

**CUALQUIER ruta `/master/api/**` DEBE:**

1. **Estar registrada explícitamente** en `master-route-registry.js`
2. **Tener `type: 'api'`** (nunca `'island'`)
3. **Estar mapeada** en `MASTER_HANDLER_MAP`
4. **Resolver SOLO como API** (sin fallback)
5. **Si no está registrada → ERROR HARD INMEDIATO** (no fallback)

---

## 🛡️ Blindaje Absoluto

### Pre-check en Resolver

El resolver `master-router-resolver.js` implementa un **PRE-CHECK** que se ejecuta **ANTES** de cualquier fallback:

```javascript
// Si path empieza por /master/api/
if (path.startsWith('/master/api/')) {
  // A) Buscar en registry
  // B) Si NO existe → MASTER_API_ROUTE_NOT_REGISTERED
  // C) Si existe pero type !== 'api' → MASTER_API_ROUTE_WRONG_TYPE
  // D) Si existe pero sin handler → MASTER_API_HANDLER_NOT_MAPPED
  // E) Si existe y type es api → continuar SOLO por camino API
}
```

**Características:**
- Se ejecuta **SIEMPRE** (incluso en producción)
- Error **HARD** (no fallback)
- Diagnóstico **EXPLÍCITO** (traceId, method, path, routeKey)
- Corta **ANTES** de tocar islands

---

## 🔍 Assembly Check Automático

**Script:** `scripts/check-master-api-assembly.js`

Verifica en **compile-time** (no runtime):

1. Todas las rutas `/master/api/**` están registradas
2. Todas tienen `type === 'api'`
3. Todas tienen entrada en `MASTER_HANDLER_MAP`
4. Los handlers existen en disco
5. Los handlers exportan función válida

**Uso:**
```bash
npm run check:master-api
```

**Integración:**
- Ejecutado en CI/CD
- Falla con exit code 1 si hay errores
- Previene regresiones antes de deployment

---

## 📋 Checklist Obligatorio

Para crear/modificar un endpoint `/master/api/**`:

- [ ] Ruta registrada en `master-route-registry.js` con `type: 'api'`
- [ ] Entrada en `MASTER_HANDLER_MAP` con key correspondiente
- [ ] Handler existe y exporta función por defecto
- [ ] `npm run check:master-api` pasa sin errores
- [ ] Test manual: curl devuelve JSON válido

---

## 🔄 Responsables

1. **Registry** (`master-route-registry.js`): Registro explícito
2. **Handler Map** (`master-router-resolver.js`): Mapeo de keys a handlers
3. **Resolver** (`master-router-resolver.js`): Pre-check + resolución estricta
4. **Assembly Check** (`scripts/check-master-api-assembly.js`): Verificación compile-time

---

## 🚫 Prohibiciones Absolutas

1. **PROHIBIDO:** Rutas `/master/api/**` con `type: 'island'`
2. **PROHIBIDO:** Fallback a island para rutas API
3. **PROHIBIDO:** Inferencia de handlers (debe ser explícito)
4. **PROHIBIDO:** Rutas API sin registro en registry
5. **PROHIBIDO:** Llamar `/admin/api/**` desde código MASTER

---

## ✅ Verificación

**En runtime:**
- No aparece `MASTER_API_ROUTE_AS_ISLAND_PREVENTED`
- No aparece `MASTER_API_ROUTE_NOT_REGISTERED`
- No aparece `MASTER_API_ROUTE_WRONG_TYPE`
- No aparece `MASTER_API_HANDLER_NOT_MAPPED`

**En compile-time:**
- `npm run check:master-api` pasa sin errores
- Todos los handlers existen y son válidos

---

## 📚 Referencias

- **Registry:** `src/core/master/registry/master-route-registry.js`
- **Resolver:** `src/core/master/router/master-router-resolver.js`
- **Assembly Check:** `scripts/check-master-api-assembly.js`
- **Contratos API:** `docs/MASTER_API_CONTRACTS.md`

---

## ✅ Certificación

**Versión**: 1.0.0  
**Fecha certificación**: 2025-01-02  
**Estado**: CERTIFICADO

MASTER API Strict Resolution v1 garantiza que ninguna ruta `/master/api/**` puede resolverse como island o caer en fallback.
