# ✅ Setup Completo - AuriPortal v3.1

## 🎯 Estado Actual

✅ **Proyecto reorganizado y funcionando sin Workers**
✅ **Nginx configurado para dominio pdeeugenihidalgo.org**
✅ **Servicios consolidados (Kajabi, ClickUp)**
✅ **Carpeta antigua eliminada**

## 📁 Estructura Final

```
/var/www/aurelinportal/
├── server.js                 # Servidor Node.js principal
├── package.json              # Dependencias
├── .env                      # Variables de entorno
├── database/                 # Base de datos SQLite
├── src/
│   ├── router.js            # Router principal
│   ├── config/             # Configuración
│   ├── services/           # APIs externas (Kajabi, ClickUp)
│   ├── modules/            # Lógica de negocio
│   ├── endpoints/          # Handlers HTTP
│   └── core/               # Utilidades y HTML
└── README.md               # Documentación
```

## 🌐 Configuración de Dominio

### Nginx Configurado

- **Archivo**: `/etc/nginx/sites-available/aurelinportal`
- **Dominios**: 
  - `pdeeugenihidalgo.org`
  - `www.pdeeugenihidalgo.org`
  - `portal.pdeeugenihidalgo.org`
- **Proxy**: `http://localhost:3000`

### Para Activar

```bash
# Recargar nginx
sudo systemctl reload nginx

# Verificar estado
sudo systemctl status nginx
```

## 🚀 Iniciar el Servidor

### Opción 1: Directo (desarrollo)
```bash
cd /var/www/aurelinportal
npm start
```

### Opción 2: Con PM2 (producción)
```bash
cd /var/www/aurelinportal
npm run pm2:start

# Ver logs
npm run pm2:logs

# Reiniciar
npm run pm2:restart
```

## 🔧 Variables de Entorno Requeridas

Verifica que `.env` tenga todas las variables:

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# ClickUp
CLICKUP_API_TOKEN=tu_token

# Kajabi
KAJABI_CLIENT_ID=tu_client_id
KAJABI_CLIENT_SECRET=tu_client_secret

# Typeform (opcional)
TYPEFORM_API_TOKEN=tu_token

# Cookies
COOKIE_SECRET=tu_secreto_aleatorio
```

## 📡 Endpoints Disponibles

- `GET /` o `/enter` - Pantalla principal
- `POST /enter` - Login con email
- `GET /onboarding-complete` - Después de Typeform
- `POST /typeform-webhook` - Webhook de Typeform
- `GET /topics` - Lista de temas
- `GET /topic/:id` - Vista de tema
- `GET /sync-all` - Sincronización masiva
- `GET /import-kajabi` - Importar contactos

## 🔒 SSL/HTTPS

### Estado Actual

✅ **Certbot instalado**  
✅ **Nginx configurado para SSL**  
✅ **Script de configuración automática creado**  
⏳ **Esperando configuración DNS**

### IP del Servidor

**88.99.173.249** - Esta IP debe estar en los registros DNS

### Configuración Rápida

1. **Configurar DNS** en tu proveedor:
   ```
   pdeeugenihidalgo.org          A    88.99.173.249
   www.pdeeugenihidalgo.org      A    88.99.173.249
   portal.pdeeugenihidalgo.org   A    88.99.173.249
   ```

2. **Esperar propagación DNS** (minutos a horas)

3. **Ejecutar script automático**:
   ```bash
   cd /var/www/aurelinportal
   sudo ./setup-ssl.sh tu-email@ejemplo.com
   ```

El script verificará DNS y configurará SSL automáticamente.

**Para más detalles**: Ver `CONFIGURAR_SSL.md`

## ✅ Verificaciones

### 1. Servidor Node.js
```bash
curl http://localhost:3000/
```

### 2. Nginx
```bash
curl http://pdeeugenihidalgo.org/
```

### 3. Logs
```bash
# Nginx
sudo tail -f /var/log/nginx/aurelinportal-access.log
sudo tail -f /var/log/nginx/aurelinportal-error.log

# Node.js (con PM2)
npm run pm2:logs
```

## 🐛 Troubleshooting

### El servidor no inicia
- Verifica `.env` tiene todas las variables
- Verifica que el puerto 3000 esté libre: `netstat -tuln | grep 3000`
- Revisa logs: `npm run pm2:logs`

### Nginx no funciona
- Verifica configuración: `sudo nginx -t`
- Verifica que nginx esté corriendo: `sudo systemctl status nginx`
- Revisa logs: `sudo tail -f /var/log/nginx/error.log`

### Dominio no resuelve
- Verifica DNS apunta al servidor
- Verifica firewall permite puertos 80 y 443
- Verifica nginx está escuchando: `sudo netstat -tuln | grep :80`

## 📝 Notas Importantes

1. **El servidor corre en puerto 3000** - Nginx hace proxy a este puerto
2. **ClickUp es la fuente de verdad** - Todos los datos importantes están ahí
3. **SQLite es caché** - Se sincroniza desde ClickUp
4. **Solo usuarios con "Mundo de Luz"** tienen acceso

## 🎉 ¡Listo para Usar!

El proyecto está completamente configurado y listo para funcionar. Solo necesitas:

1. ✅ Verificar variables de entorno en `.env`
2. ✅ Iniciar el servidor con PM2
3. ✅ Configurar DNS para apuntar al servidor
4. ✅ (Opcional) Configurar SSL con Let's Encrypt

---

**Última actualización**: Diciembre 2024  
**Versión**: 3.1  
**Estado**: ✅ Operativo

