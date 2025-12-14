# 🎛️ Acceso al Panel de Administración

## 🔑 Password Configurado

**Password:** `kaketes7897`

Este password está configurado en el archivo `.env` y se usa para acceder al panel de administración.

---

## 🌐 URLs de Acceso

### **Opción 1: Con Password en URL**
```
https://controlauriportal.eugenihidalgo.work/admin?password=kaketes7897
```

### **Opción 2: Sin Password (si tu IP está autorizada)**
```
https://controlauriportal.eugenihidalgo.work/admin
```

---

## 🔧 Si Dice "Ruta No Encontrada"

### **Verificación 1: Servidor Node.js**

```bash
# Verificar que el servidor esté corriendo
pm2 status

# Ver logs del servidor
pm2 logs aurelinportal --lines 20

# Reiniciar servidor
pm2 restart aurelinportal --update-env
```

### **Verificación 2: Ruta en el Router**

La ruta `/admin` está configurada en `src/router.js`. Verifica que el archivo tenga:

```javascript
// Panel de control administrativo
if (path === "/admin" || path === "/control" || path.startsWith("/admin/")) {
  return adminPanelHandler(request, env, ctx);
}
```

### **Verificación 3: Nginx (si usas subdominio)**

Si accedes desde `controlauriportal.eugenihidalgo.work`, verifica que Nginx esté configurado:

```bash
# Verificar configuración de Nginx
sudo nginx -t

# Ver configuración del subdominio
sudo cat /etc/nginx/sites-available/controlauriportal

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

**Configuración Nginx esperada:**
```nginx
server {
    listen 80;
    server_name controlauriportal.eugenihidalgo.work;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name controlauriportal.eugenihidalgo.work;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### **Verificación 4: Variables de Entorno**

```bash
# Verificar que el password esté en .env
grep ADMIN_PASSWORD /var/www/aurelinportal/.env

# Debe mostrar:
# ADMIN_PASSWORD=kaketes7897
```

### **Verificación 5: Probar Directamente en el Servidor**

```bash
# Probar desde el servidor mismo
curl "http://localhost:3000/admin?password=kaketes7897"

# Si funciona aquí pero no desde el subdominio, el problema es Nginx
```

---

## 🐛 Solución de Problemas Comunes

### **Problema: "Ruta no encontrada" desde subdominio**

**Causa:** Nginx no está configurado o no está redirigiendo correctamente.

**Solución:**
1. Verifica que el subdominio apunte a la IP correcta en Cloudflare
2. Verifica que Nginx tenga la configuración del subdominio
3. Reinicia Nginx: `sudo systemctl reload nginx`
4. Verifica logs: `sudo tail -f /var/log/nginx/error.log`

### **Problema: "Acceso Denegado"**

**Causa:** Password incorrecto o IP no autorizada.

**Solución:**
1. Usa el password en la URL: `?password=kaketes7897`
2. Verifica que `.env` tenga `ADMIN_PASSWORD=kaketes7897`
3. Reinicia el servidor: `pm2 restart aurelinportal --update-env`

### **Problema: Panel carga pero no funcionan los botones**

**Causa:** Las rutas de los endpoints no están accesibles.

**Solución:**
1. Verifica que `/sync-kajabi-all`, `/sync-all`, `/import-kajabi` funcionen
2. Revisa la consola del navegador para errores
3. Verifica logs del servidor: `pm2 logs aurelinportal`

---

## ✅ Verificación Rápida

Ejecuta estos comandos para verificar que todo esté bien:

```bash
# 1. Verificar servidor
pm2 status

# 2. Verificar password en .env
grep ADMIN_PASSWORD /var/www/aurelinportal/.env

# 3. Probar ruta localmente
curl "http://localhost:3000/admin?password=kaketes7897" | head -5

# 4. Verificar Nginx (si usas subdominio)
sudo nginx -t
sudo systemctl status nginx

# 5. Ver logs
pm2 logs aurelinportal --lines 10
```

---

## 📝 Notas

- El password `kaketes7897` está configurado como predeterminado en el código
- También está en `.env` como `ADMIN_PASSWORD=kaketes7897`
- El panel está disponible en: `/admin` o `/control`
- Las subrutas como `/admin/logs` y `/admin/sql` también funcionan

---

*Documento generado: $(date)*









