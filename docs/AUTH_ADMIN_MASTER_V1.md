# Autenticación Compartida ADMIN/MASTER v1

## Estado: ✅ OPERATIVO

**Fecha de certificación**: 2025-01-XX  
**Versión**: v1.0  
**Dominio**: ADMIN (`/admin/*`) y MASTER (`/master/*`)

---

## 📋 Resumen Ejecutivo

Sistema de autenticación compartido (SSO) entre ADMIN y MASTER usando una única cookie `admin_session` y un único endpoint de login en `/admin/login`. MASTER verifica sesión y redirige a login si no hay sesión válida.

### Principios Canónicos

1. **ADMIN es la única autoridad de autenticación**: Solo existe `/admin/login`
2. **MASTER solo verifica sesión**: No tiene pantalla de login propia
3. **Una cookie compartida**: `admin_session` funciona en ambos dominios
4. **Redirect post-login**: Tras login exitoso, redirige al destino original
5. **Sin duplicaciones**: No se duplica HTML, JS ni lógica de autenticación

---

## 🔐 Flujo de Autenticación

### Flujo Normal (Usuario Autenticado)

```
Usuario → /master/templo-luz/alquimia-general
  ↓
Entry Gate verifica admin_session
  ↓
Sesión válida → Continúa → Renderiza UI
```

### Flujo Sin Sesión (Usuario No Autenticado)

```
Usuario → /master/templo-luz/alquimia-general
  ↓
Entry Gate verifica admin_session
  ↓
Sesión NO válida → Redirect 302
  ↓
/admin/login?redirect=/master/templo-luz/alquimia-general
  ↓
Usuario ingresa credenciales
  ↓
Login exitoso → Set cookie admin_session
  ↓
Redirect 302 → /master/templo-luz/alquimia-general
  ↓
Entry Gate verifica admin_session
  ↓
Sesión válida → Renderiza UI
```

### Flujo API (401 UNAUTHORIZED)

```
Frontend → GET /master/api/alquimia-general/listas
  ↓
Handler verifica con requireAdminContext()
  ↓
Sesión NO válida → 401 JSON
  ↓
Frontend detecta 401
  ↓
Muestra banner: "Sesión requerida"
  ↓
Botón: "Iniciar sesión" → /admin/login?redirect=<current_path>
```

---

## 🔧 Implementación Técnica

### 1. Endpoint de Login (`/admin/login`)

**Ubicación**: `src/endpoints/admin-login.js`

**Parámetros**:
- Query: `?redirect=/master/...` (opcional)
- Body (POST): `redirect` (opcional)

**Comportamiento**:
- Si ya está autenticado → Redirect a `redirect` o `/admin`
- Si no está autenticado → Muestra formulario de login
- Tras login exitoso → Set cookie `admin_session` + Redirect a `redirect` o `/admin`

**Validación de seguridad**:
- Solo acepta redirects relativos (no URLs absolutas)
- Rechaza `http://` y `https://` en redirect

### 2. Entry Gate de MASTER

**Ubicación**: `src/router.js` (línea ~397)

**Comportamiento**:
- Detecta contexto MASTER por host (`master.pdeeugenihidalgo.org`)
- Verifica sesión admin ANTES de resolver rutas (excepto rutas API)
- Si no hay sesión → Redirect 302 a `/admin/login?redirect=<path>`
- Si hay sesión → Continúa con resolución de ruta

**Excepciones**:
- Rutas `/master/api/*` NO verifican aquí (verifican en su handler con `requireAdminContext()`)

### 3. requireAdminContext() para APIs

**Ubicación**: `src/core/auth-context.js`

**Comportamiento**:
- Si es path MASTER (`/master/*`) → Redirect 302 a login con redirect
- Si es path ADMIN → Muestra HTML de login (comportamiento original)
- Si hay sesión válida → Devuelve contexto admin

### 4. Frontend MASTER (Manejo de 401)

**Ubicación**: `public/js/master/master-alquimia-general-client.js`

**Función**: `apiFetch()`

**Comportamiento**:
- Detecta `response.status === 401`
- Muestra banner amarillo con mensaje claro
- Incluye botón "Iniciar sesión" con enlace a `/admin/login?redirect=<current_path>`
- NO hace auto-redirect (deja control al usuario)

---

## 🍪 Cookie `admin_session`

**Nombre**: `admin_session`  
**Path**: `/` (compartida entre dominios)  
**HttpOnly**: `true` (seguridad)  
**Secure**: `true` (si HTTPS)  
**SameSite**: `Lax`  
**Duración**:
- Sin "Recordarme": 12 horas
- Con "Recordarme": 30 días

**Dominios**:
- Funciona en `admin.pdeeugenihidalgo.org`
- Funciona en `master.pdeeugenihidalgo.org`
- Compartida por dominio (mismo dominio base)

---

## 📝 Logging Estructurado

Todos los logs incluyen:
- `trace_id`: Identificador único de request
- `path`: Ruta solicitada
- `redirect`: URL de redirect (si aplica)
- `username`: Usuario (solo en logs de login, sin password)

**Prefijos canónicos**:
- `[AUTH][ADMIN][LOGIN]`: Login de admin
- `[AUTH][MASTER][REQUIRE_ADMIN]`: Verificación de sesión en MASTER
- `[AUTH][ADMIN][REQUIRE_ADMIN]`: Verificación de sesión en ADMIN

**Ejemplos**:
```javascript
logInfo('AUTH', 'ADMIN LOGIN intento', { username, redirect, traceId });
logInfo('AUTH', 'MASTER REQUIRE_ADMIN sesión válida', { path, traceId });
logError('AUTH', 'ADMIN LOGIN credenciales inválidas', { username, traceId });
```

---

## ✅ Checklist de Verificación

- [x] Login en `/admin` sigue funcionando igual
- [x] Cookie `admin_session` se comparte con `master.*`
- [x] Entrar directo a `/master/*` sin login redirige a `/admin/login?redirect=...`
- [x] Tras login, vuelve correctamente a MASTER
- [x] No se ha duplicado ninguna pantalla
- [x] Rutas API devuelven 401 JSON cuando no hay sesión
- [x] Frontend muestra banner claro con enlace a login
- [x] Logs estructurados con `trace_id` implementados

---

## 🔍 Troubleshooting

### Redirect no funciona después del login
**Verificar**:
1. Logs: `pm2 logs aurelinportal | grep "ADMIN LOGIN"`
2. Verificar que `redirect` se pasa correctamente en query string
3. Verificar que redirect es relativo (no absoluto)

### Cookie no se comparte entre dominios
**Causa**: Dominios diferentes (`admin.*` vs `master.*`) no comparten cookies por defecto.

**Solución**: La cookie debe estar en el dominio base común. Verificar:
- Cookie `Path=/` (ya implementado)
- Mismo dominio base (ambos `.pdeeugenihidalgo.org`)

### Frontend muestra 401 pero no muestra banner
**Verificar**:
1. Console del navegador: ¿hay errores JS?
2. Verificar que `apiFetch()` está siendo usado
3. Verificar que `showAuthRequired()` está definida

### Loop infinito de redirects
**Causa**: `/admin/login` también verifica sesión y redirige.

**Solución**: Ya implementado - `/admin/login` permite acceso sin sesión.

---

## 📚 Referencias

- **Login Handler**: `src/endpoints/admin-login.js`
- **Auth Context**: `src/core/auth-context.js`
- **Router Entry Gate**: `src/router.js` (línea ~397)
- **Admin Auth Module**: `src/modules/admin-auth.js`
- **Frontend API Fetch**: `public/js/master/master-alquimia-general-client.js`
- **Login Template**: `src/core/html/admin/login.html`

---

## 🔄 Reglas Constitucionales

- ✅ ADMIN autentica
- ✅ MASTER verifica
- ✅ Una cookie (`admin_session`)
- ✅ Un login (`/admin/login`)
- ✅ Sin duplicaciones
- ✅ Sin dependencias circulares
- ✅ Sin legacy nuevo

---

**Última actualización**: 2025-01-XX  
**Mantenido por**: Sistema de Autenticación Compartida v1
