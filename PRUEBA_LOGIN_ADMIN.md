# 🔍 Instrucciones de Prueba - Login Admin AuriPortal

## FASE 5 - Prueba Manual Guiada

Este documento describe cómo probar el sistema de login admin después de las correcciones implementadas.

---

## 📋 Pre-requisitos

1. **Reiniciar PM2** para cargar los cambios:
```bash
cd /var/www/aurelinportal
pm2 restart aurelinportal --update-env
pm2 logs aurelinportal --lines 50
```

2. **Verificar variables de entorno**:
```bash
# Verificar que ADMIN_USER y ADMIN_PASS estén configuradas
grep -E "ADMIN_USER|ADMIN_PASS" .env
```

---

## 🧪 Pasos de Prueba

### Paso 1: Abrir Navegador en Modo Incógnito

1. Abrir navegador en **modo incógnito/privado**
2. Navegar a: `https://controlauriportal.eugenihidalgo.work/admin/login`
   - O la URL correspondiente según tu configuración

### Paso 2: Realizar Login

1. Ingresar credenciales:
   - Usuario: (valor de `ADMIN_USER` en `.env`)
   - Password: (valor de `ADMIN_PASS` en `.env`)
   - Opcional: Marcar "Remember me" si se desea

2. Hacer clic en "Iniciar Sesión"

### Paso 3: Verificar Logs en Tiempo Real

En otra terminal, ejecutar:
```bash
pm2 logs aurelinportal --lines 0
```

**Logs esperados durante el login:**

1. **handleLogin() ejecutado:**
```
[AdminAuth] handleLogin() - URL: https://..., Host: ..., X-Forwarded-Proto: https, Has-Cookie-Header: ...
[AdminAuth] Intento de login para usuario: ...
[AdminAuth] Validación de credenciales: VÁLIDAS
```

2. **createSessionCookie() ejecutado:**
```
[AdminAuth] createSessionCookie() - URL: ..., Host: ..., X-Forwarded-Proto: https, X-Forwarded-Ssl: ...
[AdminAuth] HTTPS detectado: true
[AdminAuth] Cookie creada: Secure=true, SameSite=Lax, Path=/
```

3. **Redirect:**
```
[AdminAuth] Login exitoso. Redirigiendo a: https://.../admin
[AdminAuth] Set-Cookie header: admin_session=...
```

4. **validateAdminSession() en la siguiente request:**
```
[AdminAuth] validateAdminSession() - URL: ..., Host: ..., X-Forwarded-Proto: https, Has-Cookie-Header: true
[AdminAuth] Cookie header presente: true, Longitud: ...
[AdminAuth] Cookie admin_session encontrada, token length: ...
[AdminAuth] Sesión válida - Token verificado correctamente
```

5. **requireAdminContext() ejecutado:**
```
[AdminAuth] requireAdminContext() - URL: ..., Host: ..., X-Forwarded-Proto: https, Has-Cookie-Header: true
[AdminAuth] requireAdminContext() - Sesión válida: true
[AdminAuth] requireAdminContext() - Sesión válida, devolviendo contexto admin
```

### Paso 4: Verificar Acceso a Rutas Protegidas

Después del login exitoso, verificar acceso a:

1. **Dashboard:** `https://controlauriportal.eugenihidalgo.work/admin/dashboard`
   - Debe cargar sin redirigir al login

2. **Recorridos:** `https://controlauriportal.eugenihidalgo.work/admin/recorridos`
   - Debe cargar sin redirigir al login

3. **Navigation:** `https://controlauriportal.eugenihidalgo.work/admin/navigation`
   - Debe cargar sin redirigir al login

---

## 🔴 Casos de Error a Verificar

### Error 1: "Credenciales incorrectas" con credenciales válidas

**Síntoma:** El login devuelve "Credenciales incorrectas" incluso con credenciales correctas.

**Logs a revisar:**
```
[AdminAuth] Validación de credenciales: INVÁLIDAS
```

**Posibles causas:**
- Variables de entorno `ADMIN_USER` o `ADMIN_PASS` no configuradas correctamente
- Error en la base de datos al validar usuarios

**Solución:**
- Verificar `.env` tiene `ADMIN_USER` y `ADMIN_PASS` correctos
- Verificar logs de base de datos

---

### Error 2: Cookie no se establece

**Síntoma:** Login exitoso pero inmediatamente redirige al login.

**Logs a revisar:**
```
[AdminAuth] validateAdminSession() - NO_COOKIE - No se encontró cookie admin_session
```

**Posibles causas:**
- Cookie con `Secure=true` en HTTP (no HTTPS)
- Problema con SameSite
- Navegador bloqueando cookies

**Solución:**
- Verificar que `HTTPS detectado: true` en logs
- Verificar que la cookie tiene `Secure=true` solo en HTTPS
- Verificar configuración de Nginx (X-Forwarded-Proto)

---

### Error 3: Token inválido o expirado

**Síntoma:** Login exitoso pero en la siguiente request dice "sesión inválida".

**Logs a revisar:**
```
[AdminAuth] INVALID_TOKEN - Razón: EXPIRED_TOKEN
[AdminAuth] INVALID_TOKEN - Razón: INVALID_SIGNATURE
[AdminAuth] INVALID_TOKEN - Razón: SESSION_NOT_ACTIVE
```

**Posibles causas:**
- Token no se guarda en `activeSessions`
- Firma del token incorrecta
- Token expirado inmediatamente

**Solución:**
- Verificar que `createAdminSession()` se ejecuta correctamente
- Verificar que `ADMIN_SESSION_SECRET` está configurado
- Verificar que el token se decodifica correctamente

---

## ✅ Criterios de Éxito

El login admin funciona correctamente si:

1. ✅ Login con credenciales válidas redirige a `/admin/dashboard`
2. ✅ Cookie `admin_session` se establece correctamente
3. ✅ Logs muestran `HTTPS detectado: true` en producción
4. ✅ Logs muestran `Cookie creada: Secure=true, SameSite=Lax, Path=/` en HTTPS
5. ✅ Logs muestran `Sesión válida - Token verificado correctamente` en requests posteriores
6. ✅ Acceso a rutas protegidas (`/admin/dashboard`, `/admin/recorridos`, etc.) funciona sin redirigir al login
7. ✅ Logout funciona correctamente

---

## 🧹 Limpieza de Logs Temporales

Una vez confirmado que el login funciona, los logs detallados pueden mantenerse para auditoría o reducirse según necesidades.

Los logs incluyen:
- Información del request (URL, Host, headers)
- Estado de validación de credenciales
- Estado de creación de cookie
- Estado de validación de sesión
- Flags finales de cookie (Secure, SameSite, Path)

**NOTA:** Los logs NO incluyen valores sensibles (passwords, tokens completos).

---

## 📞 Soporte

Si el problema persiste después de seguir estos pasos:

1. Revisar todos los logs de PM2
2. Verificar configuración de Nginx (headers X-Forwarded-Proto)
3. Verificar variables de entorno en `.env`
4. Verificar que el servidor Node.js está recibiendo las requests correctamente













