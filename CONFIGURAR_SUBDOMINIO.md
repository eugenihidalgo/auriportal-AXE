# 🌐 Configuración del Subdominio de Control

## 🎯 Objetivo

Configurar el subdominio `controlauriportal.eugenihidalgo.work` para acceder al panel de control administrativo de AuriPortal.

---

## 📋 Pasos de Configuración

### **1. Configurar en Cloudflare**

1. **Accede a Cloudflare Dashboard:**
   - Ve a [dash.cloudflare.com](https://dash.cloudflare.com)
   - Selecciona el dominio `eugenihidalgo.work`

2. **Añadir Registro DNS:**
   - Ve a **DNS** → **Records**
   - Haz clic en **Add record**
   - Configura:
     - **Type:** `A` o `CNAME`
     - **Name:** `controlauriportal`
     - **IPv4 address:** (IP de tu servidor Hetzner) o
     - **Target:** (si usas CNAME, apunta al dominio principal)
     - **Proxy status:** 🟠 Proxied (recomendado para SSL automático)
     - **TTL:** Auto

3. **Esperar propagación:**
   - La propagación DNS puede tardar unos minutos
   - Verifica con: `dig controlauriportal.eugenihidalgo.work`

---

### **2. Configurar Nginx**

Crea o edita el archivo de configuración de Nginx:

```bash
sudo nano /etc/nginx/sites-available/controlauriportal
```

**Contenido del archivo:**

```nginx
server {
    listen 80;
    server_name controlauriportal.eugenihidalgo.work;

    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name controlauriportal.eugenihidalgo.work;

    # Certificados SSL (Cloudflare o Let's Encrypt)
    ssl_certificate /etc/ssl/certs/controlauriportal.crt;
    ssl_certificate_key /etc/ssl/private/controlauriportal.key;
    
    # O si usas Cloudflare, puedes usar certificados de Cloudflare
    # ssl_certificate /etc/ssl/certs/cloudflare.crt;
    # ssl_certificate_key /etc/ssl/private/cloudflare.key;

    # Logs
    access_log /var/log/nginx/controlauriportal-access.log;
    error_log /var/log/nginx/controlauriportal-error.log;

    # Proxy al servidor Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts para operaciones largas (sincronizaciones)
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
```

**Activar el sitio:**

```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/controlauriportal /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```

---

### **3. Configurar SSL con Let's Encrypt (Opcional)**

Si no usas Cloudflare SSL, puedes usar Let's Encrypt:

```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d controlauriportal.eugenihidalgo.work

# Renovación automática (ya está configurada por defecto)
sudo certbot renew --dry-run
```

---

### **4. Configurar Variables de Entorno**

Añade las siguientes variables al archivo `.env`:

```env
# Panel de Administración
ADMIN_PASSWORD=tu_password_seguro_aqui
ADMIN_ALLOWED_IPS=tu_ip_publica,otra_ip  # Opcional: IPs permitidas separadas por comas
```

**Recomendaciones de seguridad:**
- Usa un password fuerte y único
- Considera usar IPs permitidas además del password
- No compartas el password públicamente

---

### **5. Verificar Funcionamiento**

1. **Verificar DNS:**
   ```bash
   dig controlauriportal.eugenihidalgo.work
   nslookup controlauriportal.eugenihidalgo.work
   ```

2. **Verificar Nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

3. **Verificar Servidor Node.js:**
   ```bash
   # Asegúrate de que el servidor esté corriendo
   pm2 status
   # O
   npm run pm2:start
   ```

4. **Acceder al Panel:**
   - Abre en navegador: `https://controlauriportal.eugenihidalgo.work/admin`
   - O con password: `https://controlauriportal.eugenihidalgo.work/admin?password=tu_password`

---

## 🔒 Seguridad

### **Opciones de Protección:**

1. **Password en URL:**
   ```
   https://controlauriportal.eugenihidalgo.work/admin?password=tu_password
   ```

2. **IPs Permitidas:**
   - Configura `ADMIN_ALLOWED_IPS` en `.env`
   - Solo esas IPs podrán acceder

3. **Combinación (Recomendado):**
   - Usa ambas: IPs permitidas + password
   - Máxima seguridad

### **Recomendaciones:**

- ✅ Usa HTTPS siempre (Cloudflare lo proporciona automáticamente)
- ✅ Cambia el password por defecto
- ✅ Limita acceso por IP si es posible
- ✅ No compartas el password públicamente
- ✅ Revisa logs regularmente

---

## 🎛️ Funcionalidades del Panel

El panel incluye:

1. **📊 Estadísticas en Tiempo Real:**
   - Estudiantes en BD
   - Contactos de Kajabi
   - Ofertas y compras
   - Logs de sincronización

2. **🔄 Sincronizaciones:**
   - Sincronizar Kajabi → SQL
   - Sincronizar ClickUp ↔ Kajabi
   - Importar Kajabi → ClickUp

3. **🗄️ Consultas SQL:**
   - Ejecutar consultas SELECT
   - Ver resultados en tiempo real

4. **📋 Logs:**
   - Ver últimos logs de sincronización
   - Historial de operaciones

---

## 🐛 Solución de Problemas

### **Error: "Acceso Denegado"**
- Verifica que el password sea correcto
- Verifica que tu IP esté en `ADMIN_ALLOWED_IPS` (si está configurado)
- Revisa los logs del servidor

### **Error: "502 Bad Gateway"**
- Verifica que el servidor Node.js esté corriendo: `pm2 status`
- Verifica que Nginx esté configurado correctamente
- Revisa logs: `sudo tail -f /var/log/nginx/error.log`

### **Error: "DNS no resuelve"**
- Espera unos minutos para propagación DNS
- Verifica en Cloudflare que el registro esté correcto
- Verifica con: `dig controlauriportal.eugenihidalgo.work`

### **Error: "SSL no funciona"**
- Si usas Cloudflare, asegúrate de que el proxy esté activado (🟠)
- Si usas Let's Encrypt, verifica que el certificado esté instalado
- Revisa: `sudo certbot certificates`

---

## 📝 Notas

- El panel está disponible en: `/admin` o `/control`
- Las operaciones de sincronización pueden tardar varios minutos
- Los resultados se muestran en la misma página
- Las estadísticas se actualizan automáticamente después de cada acción

---

*Documento generado: $(date)*
*Versión: AuriPortal v3.2*









