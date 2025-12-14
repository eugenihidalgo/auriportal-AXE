# 🔒 Configuración SSL/HTTPS para AuriPortal

## 📋 Estado Actual

✅ **Certbot instalado**  
✅ **Nginx configurado**  
⏳ **Esperando configuración DNS**

## 🌐 Configuración DNS Requerida

Para obtener certificados SSL, los dominios deben apuntar al servidor. Necesitas configurar estos registros DNS:

### Registros A (IPv4)

```
pdeeugenihidalgo.org          A    [IP_DEL_SERVIDOR]
www.pdeeugenihidalgo.org      A    [IP_DEL_SERVIDOR]
portal.pdeeugenihidalgo.org   A    [IP_DEL_SERVIDOR]
```

### IP del Servidor

**IP del servidor**: `88.99.173.249`

Esta es la IP que debes usar en los registros DNS.

## 🚀 Pasos para Configurar SSL

### 1. Verificar IP del Servidor

```bash
curl ifconfig.me
```

Anota esta IP para configurar en DNS.

### 2. Configurar DNS

Ve a tu proveedor de DNS (donde está registrado `pdeeugenihidalgo.org`) y agrega:

- **Tipo**: A
- **Nombre**: `@` (o `pdeeugenihidalgo.org`)
- **Valor**: [IP del servidor]
- **TTL**: 3600 (o el que recomiende tu proveedor)

Repite para:
- `www` → [IP del servidor]
- `portal` → [IP del servidor]

### 3. Verificar que DNS esté propagado

```bash
# Verificar que los dominios apuntan al servidor
dig pdeeugenihidalgo.org +short
dig www.pdeeugenihidalgo.org +short
dig portal.pdeeugenihidalgo.org +short

# Deben mostrar la IP del servidor
```

### 4. Obtener Certificado SSL

**Opción A: Script Automático (Recomendado)**

Una vez que DNS esté propagado (puede tardar unos minutos a horas):

```bash
cd /var/www/aurelinportal
sudo ./setup-ssl.sh tu-email@ejemplo.com
```

El script verificará DNS automáticamente y configurará SSL.

**Opción B: Manual**

```bash
sudo certbot --nginx \
  -d pdeeugenihidalgo.org \
  -d www.pdeeugenihidalgo.org \
  -d portal.pdeeugenihidalgo.org \
  --non-interactive \
  --agree-tos \
  --email tu-email@ejemplo.com \
  --redirect
```

**Nota**: Reemplaza `tu-email@ejemplo.com` con tu email real.

### 5. Verificar Renovación Automática

Certbot configura renovación automática. Verifica:

```bash
# Ver estado del timer
sudo systemctl status certbot.timer

# Ver próximas renovaciones
sudo certbot certificates
```

## 🔧 Configuración Manual (Si certbot no funciona)

Si prefieres configurar manualmente, edita `/etc/nginx/sites-available/aurelinportal`:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name pdeeugenihidalgo.org www.pdeeugenihidalgo.org portal.pdeeugenihidalgo.org;

    ssl_certificate /etc/letsencrypt/live/pdeeugenihidalgo.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pdeeugenihidalgo.org/privkey.pem;
    
    # Configuración SSL recomendada
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

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

    access_log /var/log/nginx/aurelinportal-ssl-access.log;
    error_log /var/log/nginx/aurelinportal-ssl-error.log;
}

# Redirigir HTTP a HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name pdeeugenihidalgo.org www.pdeeugenihidalgo.org portal.pdeeugenihidalgo.org;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    return 301 https://$server_name$request_uri;
}
```

Luego recarga nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## ✅ Verificación

Después de configurar SSL:

```bash
# Verificar certificado
sudo certbot certificates

# Probar HTTPS
curl -I https://pdeeugenihidalgo.org

# Verificar renovación automática
sudo systemctl status certbot.timer
```

## 🔄 Renovación Manual (si es necesario)

Los certificados se renuevan automáticamente, pero puedes renovar manualmente:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

## 📝 Notas Importantes

1. **DNS debe estar configurado ANTES** de obtener certificados SSL
2. **La propagación DNS puede tardar** de minutos a 48 horas
3. **Certbot renueva automáticamente** los certificados antes de expirar
4. **Los certificados Let's Encrypt duran 90 días** y se renuevan automáticamente

## 🐛 Troubleshooting

### Error: "no valid A records found"
- Verifica que DNS esté configurado correctamente
- Espera a que DNS se propague
- Usa `dig` o `nslookup` para verificar

### Error: "NXDOMAIN"
- El dominio o subdominio no existe en DNS
- Verifica que hayas creado los registros correctos

### Certificado no se renueva automáticamente
```bash
# Verificar timer
sudo systemctl status certbot.timer

# Habilitar si no está activo
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

**Última actualización**: Diciembre 2024  
**Estado**: ⏳ Esperando configuración DNS

