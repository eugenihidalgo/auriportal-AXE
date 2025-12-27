# AXE v0.5 — Smoke Tests HTTP

**Fecha:** 2025-12-18  
**Servidor:** http://127.0.0.1:3000  
**Hash Commit:** `5c44b0ba29072d71be401106716ec64276aec75c`

---

## Resultados de Smoke Tests

### 1. Endpoint de Versión

```bash
curl -I http://127.0.0.1:3000/__version
```

**Resultado:**
```
HTTP/1.1 200 OK
cache-control: no-store
```

✅ **Status:** 200 OK  
✅ **Comportamiento:** Correcto - devuelve información de versión

---

### 2. Panel Admin (Sin Autenticación)

```bash
curl -I http://127.0.0.1:3000/admin
```

**Resultado:**
```
HTTP/1.1 302 Found
location: http://127.0.0.1:3000/admin/login
```

✅ **Status:** 302 Found  
✅ **Comportamiento:** Correcto - redirige a login cuando no hay autenticación

---

### 3. Screen Templates UI (Sin Autenticación)

```bash
curl -I http://127.0.0.1:3000/admin/screen-templates
```

**Resultado:**
```
HTTP/1.1 302 Found
location: http://127.0.0.1:3000/admin/login
```

✅ **Status:** 302 Found  
✅ **Comportamiento:** Correcto - redirige a login cuando no hay autenticación  
✅ **Ruta Registrada:** Sí, en `src/router.js` línea 852

---

### 4. Screen Templates API (Sin Autenticación)

```bash
curl -I http://127.0.0.1:3000/api/admin/screen-templates
```

**Resultado:**
```
HTTP/1.1 401 Unauthorized
content-type: application/json
```

✅ **Status:** 401 Unauthorized  
✅ **Comportamiento:** Correcto - rechaza peticiones sin autenticación  
✅ **Ruta Registrada:** Sí, en `src/router.js` línea 846

---

## Resumen

| Endpoint | Status Code | Comportamiento | Estado |
|----------|-------------|----------------|--------|
| `GET /__version` | 200 | Devuelve versión | ✅ OK |
| `GET /admin` | 302 | Redirige a login | ✅ OK |
| `GET /admin/screen-templates` | 302 | Redirige a login | ✅ OK |
| `GET /api/admin/screen-templates` | 401 | Rechaza sin auth | ✅ OK |

---

## Conclusión

✅ Todos los endpoints responden con códigos HTTP esperados  
✅ Autenticación funcionando correctamente  
✅ Rutas de Screen Templates registradas y accesibles  
✅ No se detectaron errores 500 ni problemas de routing  

**Estado:** Smoke tests pasados exitosamente.












