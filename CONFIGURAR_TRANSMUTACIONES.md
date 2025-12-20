# 🔮 Configuración del Subdominio de Transmutaciones Energéticas

## 📋 Resumen

Se ha configurado el sistema de Transmutaciones Energéticas accesible desde:
- **Subdominio específico:** `transmutaciones.eugenihidalgo.work`
- **Desde admin principal:** `admin.eugenihidalgo.work/transmutaciones`

## 🚀 Configuración del Subdominio en Cloudflare

### **Paso 1: Acceder a Cloudflare Dashboard**

1. Abre tu navegador y ve a: **https://dash.cloudflare.com**
2. Inicia sesión con tu cuenta de Cloudflare
3. Selecciona el dominio: **`eugenihidalgo.work`**

### **Paso 2: Ir a la Sección DNS**

1. En el menú lateral izquierdo, haz clic en **"DNS"** o **"DNS Records"**
2. Verás una lista de todos los registros DNS existentes

### **Paso 3: Agregar Nuevo Registro DNS**

1. Haz clic en el botón **"+ Add record"** (Agregar registro)
2. Se abrirá un formulario para crear un nuevo registro

### **Paso 4: Configurar el Registro**

Completa el formulario con estos valores:

#### **Opción A: Usar Registro Tipo A (Recomendado si conoces la IP del servidor)**

```
Type:        A
Name:        transmutaciones
IPv4 address: [IP de tu servidor]
             (Ejemplo: 88.99.173.249 o la IP que uses)
Proxy status: 🟠 Proxied (naranja - ACTIVADO)
TTL:         Auto
```

**¿Cómo saber la IP de tu servidor?**
- Si ya tienes otros subdominios configurados, mira la IP que usan
- O ejecuta en tu servidor: `curl ifconfig.me`

#### **Opción B: Usar Registro Tipo CNAME (Si tienes un dominio principal)**

```
Type:        CNAME
Name:        transmutaciones
Target:      eugenihidalgo.work
             (o el dominio principal que uses)
Proxy status: 🟠 Proxied (naranja - ACTIVADO)
TTL:         Auto
```

### **Paso 5: Activar el Proxy (IMPORTANTE)**

⚠️ **MUY IMPORTANTE:** Asegúrate de que el **Proxy status** esté en **🟠 Proxied** (naranja)

- ✅ **🟠 Proxied (naranja)** = Activado (recomendado)
  - SSL automático de Cloudflare
  - Protección DDoS
  - CDN
  
- ❌ **DNS only (gris)** = Desactivado
  - No tendrás SSL automático
  - No tendrás protección DDoS

### **Paso 6: Guardar y Esperar**

1. Haz clic en **"Save"** (Guardar)
2. Espera 1-5 minutos para que el DNS se propague
3. Verifica con: `dig transmutaciones.eugenihidalgo.work`

---

## 🔧 Configuración de Nginx (Opcional pero Recomendado)

Si quieres configurar Nginx para el subdominio (recomendado para mejor rendimiento):

### **1. Crear configuración de Nginx:**

```bash
sudo nano /etc/nginx/sites-available/transmutaciones.eugenihidalgo.work
```

### **2. Agregar la siguiente configuración:**

```nginx
server {
    listen 80;
    server_name transmutaciones.eugenihidalgo.work;

    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name transmutaciones.eugenihidalgo.work;

    # Si usas certificados SSL propios, descomenta estas líneas:
    # ssl_certificate /etc/ssl/certs/transmutaciones.crt;
    # ssl_certificate_key /etc/ssl/private/transmutaciones.key;
    
    # Si usas Cloudflare, no necesitas certificados SSL aquí
    # Cloudflare maneja el SSL automáticamente

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
    }
}
```

### **3. Habilitar el sitio:**

```bash
sudo ln -s /etc/nginx/sites-available/transmutaciones.eugenihidalgo.work /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### **4. Configurar SSL (Solo si NO usas Cloudflare Proxy):**

```bash
sudo certbot --nginx -d transmutaciones.eugenihidalgo.work
```

---

## 🌐 URLs de Acceso

### **Opción 1: Subdominio Específico (Recomendado)**

```
https://transmutaciones.eugenihidalgo.work
```

### **Opción 2: Desde Admin Principal**

```
https://admin.eugenihidalgo.work/transmutaciones
```

### **Opción 3: Con Password en URL**

```
https://transmutaciones.eugenihidalgo.work?password=kaketes7897
```

---

## 🔒 Seguridad

### **Password Configurado**

**Password:** `kaketes7897`

Este password está configurado en el archivo `.env` y se usa para acceder al panel de transmutaciones.

### **Opciones de Protección:**

1. **Password en URL:**
   ```
   https://transmutaciones.eugenihidalgo.work?password=kaketes7897
   ```

2. **IPs Permitidas:**
   - Configura `ADMIN_ALLOWED_IPS` en `.env`
   - Solo esas IPs podrán acceder

3. **Combinación (Recomendado):**
   - Usa ambas: IPs permitidas + password
   - Máxima seguridad

---

## ✅ Verificar Funcionamiento

1. **Verificar DNS:**
   ```bash
   dig transmutaciones.eugenihidalgo.work
   nslookup transmutaciones.eugenihidalgo.work
   ```

2. **Verificar Nginx (si lo configuraste):**
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
   - Abre en navegador: `https://transmutaciones.eugenihidalgo.work`
   - O con password: `https://transmutaciones.eugenihidalgo.work?password=kaketes7897`

---

## 🎛️ Funcionalidades del Panel

El panel de Transmutaciones Energéticas incluye:

1. **📋 Gestión de Listas:**
   - Crear listas de transmutaciones recurrentes
   - Crear listas de transmutaciones de una sola vez
   - Editar y eliminar listas

2. **✨ Gestión de Ítems:**
   - Creación rápida de ítems (solo nombre requerido)
   - Editar todos los campos (nombre, descripción, nivel, frecuencia)
   - Ordenamiento automático por nivel y nombre

3. **👥 Gestión Masiva:**
   - Limpiar un ítem para todos los suscriptores activos
   - Ver estado por alumnos (limpio/pendiente/pasado)

4. **📊 Estados Automáticos:**
   - Verde: Ítem limpio (dentro del período de frecuencia)
   - Amarillo: Pendiente (últimos 7 días antes de vencer)
   - Rojo: Pasado de rosca (fuera del período)

---

## 🔄 Reiniciar Servidor (si es necesario)

Si después de configurar el subdominio no funciona, reinicia el servidor:

```bash
pm2 restart aurelinportal --update-env
```

O si usas npm directamente:

```bash
npm run pm2:restart
```

---

## 📝 Notas Importantes

- ✅ El sistema ya está configurado en el código, solo necesitas el subdominio DNS
- ✅ Cloudflare Proxy proporciona SSL automático
- ✅ El router detecta automáticamente el subdominio
- ✅ Solo suscriptores activos pueden ver y limpiar ítems
- ✅ Los alumnos ven los ítems en su perfil personal en la pestaña "Transmutaciones Energéticas"

---

## 🆘 Solución de Problemas

### **El subdominio no carga:**

1. Verifica que el DNS esté propagado: `dig transmutaciones.eugenihidalgo.work`
2. Verifica que el proxy esté activado (🟠 naranja) en Cloudflare
3. Verifica que el servidor Node.js esté corriendo: `pm2 status`
4. Revisa los logs: `pm2 logs aurelinportal --lines 50`

### **Error 403 Acceso Denegado:**

1. Verifica que uses el password correcto en la URL
2. Verifica que tu IP esté en `ADMIN_ALLOWED_IPS` si está configurado
3. Revisa el archivo `.env` para verificar `ADMIN_PASSWORD`

### **Error 404 Ruta No Encontrada:**

1. Verifica que el router tenga las rutas configuradas
2. Reinicia el servidor: `pm2 restart aurelinportal`
3. Revisa los logs del servidor para ver errores























