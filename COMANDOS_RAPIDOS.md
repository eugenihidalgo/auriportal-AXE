# ⚡ Comandos Rápidos - Implementación Entornos

## 🚀 Inicio Rápido

### 1. Preparar Variables de Entorno

```bash
cd /var/www/aurelinportal

# Copiar archivos de ejemplo
cp env.prod.example .env.prod
cp env.beta.example .env.beta
cp env.dev.example .env.dev

# Editar cada archivo (IMPORTANTE: Configurar valores reales)
nano .env.prod
nano .env.beta
nano .env.dev
```

### 2. Configurar Nginx

```bash
# Backup de configuración actual
sudo cp /etc/nginx/sites-available/aurelinportal /etc/nginx/sites-available/aurelinportal.backup.$(date +%Y%m%d)

# Copiar nueva configuración
sudo cp /var/www/aurelinportal/nginx-multi-env.conf /etc/nginx/sites-available/aurelinportal

# Verificar sintaxis
sudo nginx -t

# Recargar (si todo está bien)
sudo systemctl reload nginx
```

### 3. Configurar SSL (Certificados)

```bash
# Obtener certificados para los 3 subdominios
sudo certbot --nginx \
  -d portal.pdeeugenihidalgo.org \
  -d beta.portal.pdeeugenihidalgo.org \
  -d dev.portal.pdeeugenihidalgo.org
```

### 4. Migrar Producción a PM2 Ecosystem

```bash
cd /var/www/aurelinportal

# Detener proceso actual
pm2 stop aurelinportal
pm2 delete aurelinportal

# Iniciar producción con ecosystem
pm2 start ecosystem.config.js --only aurelinportal-prod

# Verificar
pm2 status
curl http://localhost:3000/__version
```

### 5. Iniciar Beta y Dev

```bash
# Iniciar beta
pm2 start ecosystem.config.js --only aurelinportal-beta

# Iniciar dev
pm2 start ecosystem.config.js --only aurelinportal-dev

# Ver todos
pm2 status
```

### 6. Guardar Configuración PM2

```bash
# Guardar para persistencia
pm2 save

# Configurar inicio automático
pm2 startup
# (Ejecutar el comando que muestre)
```

---

## 📋 Comandos de Gestión Diaria

### Usando el Script de Ayuda

```bash
# Ver estado de todos los entornos
./scripts/manage-env.sh status

# Ver logs de un entorno
./scripts/manage-env.sh logs prod
./scripts/manage-env.sh logs beta
./scripts/manage-env.sh logs dev

# Reiniciar un entorno
./scripts/manage-env.sh restart prod

# Ver versión de un entorno
./scripts/manage-env.sh version prod
```

### Comandos PM2 Directos

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs aurelinportal-prod
pm2 logs aurelinportal-beta
pm2 logs aurelinportal-dev

# Reiniciar
pm2 restart aurelinportal-prod
pm2 restart aurelinportal-beta
pm2 restart aurelinportal-dev

# Monitoreo en tiempo real
pm2 monit
```

### Verificar Endpoints

```bash
# Verificar versión de cada entorno
curl http://localhost:3000/__version | jq  # PROD
curl http://localhost:3001/__version | jq  # DEV
curl http://localhost:3002/__version | jq  # BETA

# Verificar desde navegador
# https://portal.pdeeugenihidalgo.org/__version
# https://beta.portal.pdeeugenihidalgo.org/__version
# https://dev.portal.pdeeugenihidalgo.org/__version
```

---

## 🚨 Rollback Rápido

### Opción 1: Usando el Script

```bash
./scripts/manage-env.sh rollback
```

### Opción 2: Manual

```bash
# Restaurar Nginx
sudo cp /etc/nginx/sites-available/aurelinportal.backup.* /etc/nginx/sites-available/aurelinportal
sudo nginx -t && sudo systemctl reload nginx

# Detener entornos nuevos
pm2 delete aurelinportal-prod aurelinportal-beta aurelinportal-dev

# Iniciar proceso anterior
pm2 start server.js --name aurelinportal
pm2 save
```

---

## ✅ Checklist de Validación Rápida

```bash
# 1. Verificar procesos PM2
pm2 status

# 2. Verificar puertos
netstat -tlnp | grep -E '3000|3001|3002'

# 3. Verificar endpoints
curl http://localhost:3000/__version
curl http://localhost:3001/__version
curl http://localhost:3002/__version

# 4. Verificar Nginx
sudo nginx -t

# 5. Ver logs recientes
pm2 logs --lines 20
```

---

## 📊 Verificación Completa

```bash
# Ejecutar script de estado
./scripts/manage-env.sh status

# Verificar que cada entorno muestra el entorno correcto
./scripts/manage-env.sh version prod   # Debe mostrar "app_env": "prod"
./scripts/manage-env.sh version beta   # Debe mostrar "app_env": "beta"
./scripts/manage-env.sh version dev    # Debe mostrar "app_env": "dev"
```

---

## 🔧 Troubleshooting Rápido

### Puerto en uso
```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

### PM2 no inicia
```bash
pm2 logs --err
pm2 delete all
pm2 start ecosystem.config.js --only aurelinportal-prod
```

### Nginx no funciona
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

---

**Para documentación completa, ver:** `IMPLEMENTACION_ENTORNOS.md`












