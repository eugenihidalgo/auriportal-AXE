# 🚀 Implementación de Entornos DEV/BETA/PROD - AuriPortal

## 📋 Resumen

Este documento describe la implementación profesional de entornos múltiples (DEV/BETA/PROD) para AuriPortal usando PM2 y Nginx.

### Esquema de Entornos

| Entorno | Subdominio | Puerto | APP_ENV | Variables |
|---------|-----------|--------|---------|-----------|
| **PROD** | `portal.pdeeugenihidalgo.org` | 3000 | `prod` | `.env.prod` |
| **BETA** | `beta.portal.pdeeugenihidalgo.org` | 3002 | `beta` | `.env.beta` |
| **DEV** | `dev.portal.pdeeugenihidalgo.org` | 3001 | `dev` | `.env.dev` |

---

## 📁 Archivos Creados

### 1. `ecosystem.config.js`
Configuración PM2 con 3 aplicaciones:
- `aurelinportal-prod` (puerto 3000)
- `aurelinportal-beta` (puerto 3002)
- `aurelinportal-dev` (puerto 3001)

### 2. `nginx-multi-env.conf`
Configuración Nginx para los 3 subdominios con proxy a los puertos correspondientes.

### 3. Archivos `.env` de ejemplo
- `env.prod.example` → Copiar a `.env.prod`
- `env.beta.example` → Copiar a `.env.beta`
- `env.dev.example` → Copiar a `.env.dev`

### 4. Modificaciones en `server.js`
- Detección automática de `APP_ENV`
- Banner de inicio mostrando el entorno
- Logs mejorados con información del entorno

---

## 🔧 Instalación Paso a Paso

### Paso 1: Preparar Variables de Entorno

```bash
cd /var/www/aurelinportal

# Copiar archivos de ejemplo
cp env.prod.example .env.prod
cp env.beta.example .env.beta
cp env.dev.example .env.dev

# Editar cada archivo con los valores reales
nano .env.prod
nano .env.beta
nano .env.dev
```

**⚠️ IMPORTANTE:**
- Cada entorno debe tener su propio `COOKIE_SECRET` único
- Los `WEBHOOK_BASE_URL` y `SERVER_URL` deben apuntar al subdominio correcto
- En producción, usar tokens/secrets reales
- En dev/beta, puedes usar los mismos tokens o sandboxes si están disponibles

### Paso 2: Configurar Nginx

```bash
# Hacer backup de la configuración actual
sudo cp /etc/nginx/sites-available/aurelinportal /etc/nginx/sites-available/aurelinportal.backup.$(date +%Y%m%d)

# Copiar nueva configuración
sudo cp /var/www/aurelinportal/nginx-multi-env.conf /etc/nginx/sites-available/aurelinportal

# Verificar sintaxis
sudo nginx -t

# Si todo está bien, recargar Nginx
sudo systemctl reload nginx
```

### Paso 3: Configurar Certificados SSL

```bash
# Obtener certificados SSL para los 3 subdominios
sudo certbot --nginx \
  -d portal.pdeeugenihidalgo.org \
  -d beta.portal.pdeeugenihidalgo.org \
  -d dev.portal.pdeeugenihidalgo.org

# Verificar renovación automática
sudo certbot renew --dry-run
```

### Paso 4: Configurar DNS

Asegúrate de que los siguientes registros DNS estén configurados en Cloudflare (o tu proveedor DNS):

```
A     portal.pdeeugenihidalgo.org      → IP_DEL_SERVIDOR
A     beta.portal.pdeeugenihidalgo.org → IP_DEL_SERVIDOR
A     dev.portal.pdeeugenihidalgo.org  → IP_DEL_SERVIDOR
```

### Paso 5: Migrar Producción Actual a PM2 con Ecosystem

```bash
cd /var/www/aurelinportal

# Detener el proceso PM2 actual (si existe)
pm2 stop aurelinportal
pm2 delete aurelinportal

# Iniciar solo producción primero (para no interrumpir servicio)
pm2 start ecosystem.config.js --only aurelinportal-prod

# Verificar que está funcionando
pm2 status
pm2 logs aurelinportal-prod --lines 50

# Verificar que responde
curl http://localhost:3000/__version
```

**Verificar que el endpoint `/__version` muestra:**
```json
{
  "app_version": "4.0.0",
  "build_id": "...",
  "app_env": "prod",
  ...
}
```

### Paso 6: Iniciar Entornos Beta y Dev

```bash
# Iniciar beta
pm2 start ecosystem.config.js --only aurelinportal-beta

# Iniciar dev
pm2 start ecosystem.config.js --only aurelinportal-dev

# Ver estado de todos
pm2 status

# Ver logs de todos
pm2 logs
```

### Paso 7: Guardar Configuración PM2

```bash
# Guardar configuración para que persista después de reinicios
pm2 save

# Configurar PM2 para iniciar al arrancar el sistema
pm2 startup
# (Ejecutar el comando que te muestre)
```

---

## ✅ Checklist de Validación

### Validación Pre-Despliegue

- [ ] Archivos `.env.prod`, `.env.beta`, `.env.dev` creados y configurados
- [ ] Cada `.env` tiene `APP_ENV` correcto (prod/beta/dev)
- [ ] Cada `.env` tiene `PORT` correcto (3000/3002/3001)
- [ ] Cada `.env` tiene `COOKIE_SECRET` único y seguro
- [ ] `WEBHOOK_BASE_URL` y `SERVER_URL` apuntan al subdominio correcto
- [ ] Configuración Nginx copiada y verificada (`nginx -t`)
- [ ] Certificados SSL configurados para los 3 subdominios
- [ ] Registros DNS configurados en Cloudflare
- [ ] Directorio `logs/` existe y tiene permisos correctos

### Validación Post-Despliegue

#### Producción
- [ ] `pm2 status` muestra `aurelinportal-prod` como `online`
- [ ] `curl http://localhost:3000/__version` responde con `"app_env": "prod"`
- [ ] `https://portal.pdeeugenihidalgo.org/__version` muestra entorno correcto
- [ ] `https://portal.pdeeugenihidalgo.org` carga correctamente
- [ ] Logs muestran banner con "Entorno: PROD"
- [ ] No hay errores en `pm2 logs aurelinportal-prod`

#### Beta
- [ ] `pm2 status` muestra `aurelinportal-beta` como `online`
- [ ] `curl http://localhost:3002/__version` responde con `"app_env": "beta"`
- [ ] `https://beta.portal.pdeeugenihidalgo.org/__version` muestra entorno correcto
- [ ] `https://beta.portal.pdeeugenihidalgo.org` carga correctamente
- [ ] Logs muestran banner con "Entorno: BETA"

#### Dev
- [ ] `pm2 status` muestra `aurelinportal-dev` como `online`
- [ ] `curl http://localhost:3001/__version` responde con `"app_env": "dev"`
- [ ] `https://dev.portal.pdeeugenihidalgo.org/__version` muestra entorno correcto
- [ ] `https://dev.portal.pdeeugenihidalgo.org` carga correctamente
- [ ] Logs muestran banner con "Entorno: DEV"

### Validación de Funcionalidad

- [ ] Autenticación funciona en cada entorno
- [ ] Cookies se establecen correctamente
- [ ] APIs externas (Kajabi, ClickUp) responden
- [ ] Base de datos PostgreSQL conecta correctamente
- [ ] Archivos estáticos se sirven correctamente
- [ ] Health check (`/health-check`) funciona

---

## 🔄 Comandos de Gestión

### PM2 - Gestión de Procesos

```bash
# Ver estado de todos los entornos
pm2 status

# Ver logs de un entorno específico
pm2 logs aurelinportal-prod
pm2 logs aurelinportal-beta
pm2 logs aurelinportal-dev

# Ver logs de todos (últimas 100 líneas)
pm2 logs --lines 100

# Reiniciar un entorno específico
pm2 restart aurelinportal-prod
pm2 restart aurelinportal-beta
pm2 restart aurelinportal-dev

# Reiniciar todos los entornos
pm2 restart all

# Detener un entorno
pm2 stop aurelinportal-dev

# Iniciar un entorno
pm2 start ecosystem.config.js --only aurelinportal-dev

# Eliminar un entorno (detener y eliminar)
pm2 delete aurelinportal-dev

# Monitoreo en tiempo real
pm2 monit
```

### Verificar Estado de Entornos

```bash
# Verificar que los puertos están escuchando
netstat -tlnp | grep -E '3000|3001|3002'

# Verificar endpoints de versión
curl http://localhost:3000/__version | jq
curl http://localhost:3001/__version | jq
curl http://localhost:3002/__version | jq

# Verificar desde el navegador
# https://portal.pdeeugenihidalgo.org/__version
# https://beta.portal.pdeeugenihidalgo.org/__version
# https://dev.portal.pdeeugenihidalgo.org/__version
```

### Nginx - Gestión

```bash
# Verificar configuración
sudo nginx -t

# Recargar configuración (sin downtime)
sudo systemctl reload nginx

# Reiniciar Nginx (con downtime mínimo)
sudo systemctl restart nginx

# Ver logs
sudo tail -f /var/log/nginx/aurelinportal-prod-access.log
sudo tail -f /var/log/nginx/aurelinportal-beta-error.log
```

---

## 🚨 Procedimiento de Rollback

### Rollback Rápido (1 comando)

Si algo sale mal y necesitas volver a la configuración anterior:

```bash
# Restaurar configuración Nginx anterior
sudo cp /etc/nginx/sites-available/aurelinportal.backup.* /etc/nginx/sites-available/aurelinportal
sudo nginx -t && sudo systemctl reload nginx

# Detener entornos nuevos y volver al anterior
pm2 delete aurelinportal-prod aurelinportal-beta aurelinportal-dev
pm2 start server.js --name aurelinportal --env production
```

### Rollback Paso a Paso

#### 1. Detener Entornos Nuevos

```bash
pm2 stop aurelinportal-prod
pm2 stop aurelinportal-beta
pm2 stop aurelinportal-dev
```

#### 2. Restaurar PM2 Anterior

```bash
# Eliminar procesos nuevos
pm2 delete aurelinportal-prod
pm2 delete aurelinportal-beta
pm2 delete aurelinportal-dev

# Iniciar proceso anterior (si usabas nombre "aurelinportal")
pm2 start server.js --name aurelinportal
```

#### 3. Restaurar Nginx

```bash
# Encontrar backup más reciente
ls -lt /etc/nginx/sites-available/aurelinportal.backup.*

# Restaurar (reemplazar YYYYMMDD con la fecha del backup)
sudo cp /etc/nginx/sites-available/aurelinportal.backup.YYYYMMDD /etc/nginx/sites-available/aurelinportal

# Verificar y recargar
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. Verificar que Producción Funciona

```bash
# Verificar proceso
pm2 status

# Verificar respuesta
curl http://localhost:3000/__version

# Verificar desde navegador
# https://portal.pdeeugenihidalgo.org
```

---

## 📊 Monitoreo y Logs

### Ubicación de Logs

**PM2:**
- Producción: `/var/www/aurelinportal/logs/pm2-prod-*.log`
- Beta: `/var/www/aurelinportal/logs/pm2-beta-*.log`
- Dev: `/var/www/aurelinportal/logs/pm2-dev-*.log`

**Nginx:**
- Producción: `/var/log/nginx/aurelinportal-prod-*.log`
- Beta: `/var/log/nginx/aurelinportal-beta-*.log`
- Dev: `/var/log/nginx/aurelinportal-dev-*.log`

### Comandos Útiles de Monitoreo

```bash
# Ver logs en tiempo real de producción
pm2 logs aurelinportal-prod --lines 0

# Ver errores de producción
pm2 logs aurelinportal-prod --err --lines 50

# Ver uso de recursos
pm2 monit

# Ver información detallada de un proceso
pm2 describe aurelinportal-prod
```

---

## 🔐 Seguridad

### Recomendaciones

1. **COOKIE_SECRET único por entorno**: Cada entorno debe tener su propio `COOKIE_SECRET` para evitar conflictos.

2. **Tokens separados (opcional)**: Idealmente, cada entorno debería usar tokens/secrets diferentes para APIs externas, especialmente en producción.

3. **Restricción de acceso a dev/beta**: Considera restringir acceso a dev/beta usando:
   - Autenticación HTTP básica en Nginx
   - IP whitelist
   - VPN/Tailscale

4. **Logs sensibles**: Asegúrate de que los logs no contengan tokens o información sensible.

---

## 🎯 Flujo de Trabajo Recomendado

### Desarrollo Normal

1. **Desarrollar en DEV**:
   ```bash
   pm2 logs aurelinportal-dev --lines 0
   # Hacer cambios en el código
   pm2 restart aurelinportal-dev
   ```

2. **Probar en BETA**:
   ```bash
   # Desplegar cambios a beta
   pm2 restart aurelinportal-beta
   # Probar funcionalidad completa
   ```

3. **Desplegar a PROD**:
   ```bash
   # Solo cuando todo está validado en beta
   pm2 restart aurelinportal-prod
   ```

### Actualización de Código

```bash
cd /var/www/aurelinportal

# 1. Hacer pull de cambios
git pull origin main

# 2. Instalar dependencias si hay cambios
npm install

# 3. Reiniciar entornos (empezar por dev, luego beta, luego prod)
pm2 restart aurelinportal-dev
# Probar dev...

pm2 restart aurelinportal-beta
# Probar beta...

pm2 restart aurelinportal-prod
# Producción actualizada
```

---

## ❓ Troubleshooting

### Problema: Puerto ya en uso

```bash
# Ver qué proceso usa el puerto
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :3002

# Matar proceso si es necesario
sudo kill -9 <PID>
```

### Problema: PM2 no inicia

```bash
# Ver logs de PM2
pm2 logs --err

# Verificar que el archivo ecosystem.config.js existe
ls -la ecosystem.config.js

# Verificar sintaxis del archivo
node -c ecosystem.config.js
```

### Problema: Nginx no redirige correctamente

```bash
# Verificar configuración
sudo nginx -t

# Ver logs de error
sudo tail -f /var/log/nginx/error.log

# Verificar que los procesos Node.js están corriendo
pm2 status
```

### Problema: Certificado SSL no funciona

```bash
# Renovar certificado
sudo certbot renew

# Verificar certificados
sudo certbot certificates

# Forzar renovación
sudo certbot renew --force-renewal
```

---

## 📝 Notas Finales

- **Producción NO debe interrumpirse**: Siempre prueba en dev/beta antes de tocar producción.
- **Backups**: Mantén backups de configuraciones antes de cambios importantes.
- **Monitoreo**: Revisa logs regularmente para detectar problemas temprano.
- **Documentación**: Actualiza esta documentación si haces cambios en la configuración.

---

**Última actualización:** $(date)
**Versión:** 1.0.0















