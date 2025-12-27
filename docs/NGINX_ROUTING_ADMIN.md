# 🔧 Configuración de Nginx para Rutas `/admin/*`

## 📋 Resumen

Este documento describe la configuración de Nginx para garantizar que **TODAS** las rutas `/admin/*` se reenvíen correctamente al backend Express, evitando errores 404 en producción.

---

## 🎯 Problema Resuelto

**Síntoma:** Rutas como `/admin/pde/catalog-registry` devolvían 404 en producción, aunque funcionaban correctamente en local.

**Causa:** Aunque existía un bloque `location /` que hacía proxy a Express, no había un bloque explícito para `/admin/` que garantizara el reenvío de todas las rutas administrativas.

**Solución:** Agregar un bloque `location /admin/` específico antes del bloque `location /` general.

---

## ✅ Configuración Implementada

### Archivo: `/etc/nginx/sites-available/aurelinportal`

Se agregó un bloque específico para rutas `/admin/*`:

```nginx
# CRÍTICO: Todas las rutas /admin/* deben ir al backend Express
# Este bloque debe ir ANTES de location / para tener prioridad
location /admin/ {
    client_max_body_size 100M;
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_cache_bypass $http_upgrade;
    
    # Timeouts (aumentados para operaciones largas)
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;
}
```

### Orden de Bloques `location` (CRÍTICO)

El orden de los bloques `location` en Nginx es importante. Los bloques más específicos deben ir **ANTES** de los más generales:

1. `location /.well-known/acme-challenge/` - Para certificados SSL
2. `location /uploads/` - Archivos estáticos de uploads
3. **`location /admin/`** - **Rutas administrativas (NUEVO)**
4. `location /` - Ruta general (catch-all)

---

## 🔍 Verificación

### 1. Verificar Sintaxis

```bash
sudo nginx -t
```

Debe mostrar: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

### 2. Recargar Nginx

```bash
sudo systemctl reload nginx
```

### 3. Probar Ruta

```bash
curl -I https://admin.pdeeugenihidalgo.org/admin/pde/catalog-registry
```

**Resultado esperado:**
- ✅ **HTTP 302** (redirección a login) - **CORRECTO**
- ❌ **HTTP 404** - Indica que Nginx no está reenviando a Express

---

## 📝 Reglas Importantes

### ✅ HACER

1. **Siempre** incluir un bloque `location /admin/` explícito
2. **Siempre** colocar `location /admin/` antes de `location /`
3. **Siempre** incluir todos los headers de proxy necesarios
4. **Siempre** verificar sintaxis antes de recargar

### ❌ NO HACER

1. **NO** usar `try_files` en bloques `/admin/*` (bloquearía el proxy)
2. **NO** usar `root` estático para `/admin/*` (bloquearía el proxy)
3. **NO** colocar `location /admin/` después de `location /`
4. **NO** omitir headers de proxy (causa problemas de autenticación)

---

## 🔄 Dominios Afectados

Esta configuración aplica a todos los dominios configurados en el `server_name`:

- `pdeeugenihidalgo.org`
- `www.pdeeugenihidalgo.org`
- `portal.pdeeugenihidalgo.org`
- **`admin.pdeeugenihidalgo.org`** ⭐ (principal)

---

## 🚨 Troubleshooting

### Problema: Sigue devolviendo 404

**Solución:**
1. Verificar que el bloque `location /admin/` existe
2. Verificar que está ANTES de `location /`
3. Verificar sintaxis: `sudo nginx -t`
4. Recargar: `sudo systemctl reload nginx`
5. Verificar logs: `sudo tail -f /var/log/nginx/aurelinportal-error.log`

### Problema: Devuelve 502 Bad Gateway

**Solución:**
1. Verificar que Express está corriendo: `pm2 status`
2. Verificar puerto: `netstat -tlnp | grep 3000`
3. Verificar logs de Express: `pm2 logs aurelinportal`

### Problema: Redirección infinita

**Solución:**
1. Verificar que `proxy_set_header Host $host;` está presente
2. Verificar que `X-Forwarded-Proto` está configurado
3. Verificar configuración SSL en Express

---

## 📚 Referencias

- **Archivo de configuración:** `/etc/nginx/sites-available/aurelinportal`
- **Logs de acceso:** `/var/log/nginx/aurelinportal-access.log`
- **Logs de error:** `/var/log/nginx/aurelinportal-error.log`
- **Router Express:** `src/router.js` (línea 900+)

---

## ✅ Checklist de Implementación

- [x] Bloque `location /admin/` agregado
- [x] Orden correcto de bloques `location`
- [x] Headers de proxy configurados
- [x] Sintaxis de Nginx verificada
- [x] Nginx recargado
- [x] Ruta probada en producción
- [x] Documentación creada

---

**Última actualización:** 2025-12-18  
**Estado:** ✅ Resuelto











