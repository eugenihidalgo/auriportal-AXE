# ⏰ Configuración de Cron Job para Sincronización Diaria

## 📋 Descripción

Este documento explica cómo configurar un cron job para ejecutar la sincronización masiva de Kajabi → SQL diariamente a las 3 AM.

---

## 🔧 Configuración

### **Opción 1: Usando el script bash (Recomendado)**

1. **Editar crontab:**
```bash
crontab -e
```

2. **Añadir la siguiente línea:**
```bash
# Sincronización masiva diaria de Kajabi → SQL a las 3 AM
0 3 * * * /var/www/aurelinportal/scripts/sync-daily.sh >> /var/www/aurelinportal/logs/cron.log 2>&1
```

3. **Verificar que el script tiene permisos de ejecución:**
```bash
chmod +x /var/www/aurelinportal/scripts/sync-daily.sh
```

### **Opción 2: Llamada directa con curl**

```bash
# Añadir a crontab:
0 3 * * * curl -X GET "https://controlauriportal.eugenihidalgo.work/sync-kajabi-all?password=kaketes7897" > /var/www/aurelinportal/logs/sync-daily.log 2>&1
```

---

## 📊 Verificación

### **Ver logs de ejecución:**
```bash
# Ver último log
tail -f /var/www/aurelinportal/logs/sync-daily-$(date +%Y%m%d).log

# Ver todos los logs
ls -lh /var/www/aurelinportal/logs/sync-daily-*.log

# Ver log de cron
tail -f /var/www/aurelinportal/logs/cron.log
```

### **Probar ejecución manual:**
```bash
# Ejecutar script manualmente
/var/www/aurelinportal/scripts/sync-daily.sh

# O llamar directamente al endpoint
curl -X GET "https://controlauriportal.eugenihidalgo.work/sync-kajabi-all?password=kaketes7897"
```

### **Verificar que el cron está configurado:**
```bash
crontab -l
```

---

## ⚙️ Configuración del Script

El script `sync-daily.sh` está configurado con:
- **URL**: `https://controlauriportal.eugenihidalgo.work/sync-kajabi-all`
- **Password**: `kaketes7897`
- **Logs**: Se guardan en `/var/www/aurelinportal/logs/sync-daily-YYYYMMDD.log`
- **Rotación**: Mantiene solo los últimos 30 días de logs

Si necesitas cambiar la URL o password, edita el archivo:
```bash
nano /var/www/aurelinportal/scripts/sync-daily.sh
```

---

## 🔍 Troubleshooting

### **El cron no se ejecuta:**
1. Verificar permisos del script: `chmod +x /var/www/aurelinportal/scripts/sync-daily.sh`
2. Verificar que el path es absoluto en crontab
3. Verificar logs del sistema: `grep CRON /var/log/syslog`

### **Error 404 o ruta no encontrada:**
1. Verificar que la URL es correcta
2. Verificar que el servidor está corriendo
3. Verificar que el endpoint existe en el router

### **Error de autenticación:**
1. Verificar que el password es correcto (`kaketes7897`)
2. Verificar que el endpoint acepta el parámetro `password`

---

## 📅 Horarios Alternativos

Si quieres cambiar el horario de ejecución, modifica el formato cron:

```bash
# Cada día a las 3 AM (actual)
0 3 * * *

# Cada día a las 2 AM
0 2 * * *

# Cada día a las 4 AM
0 4 * * *

# Cada lunes a las 3 AM
0 3 * * 1

# Cada día a las 3 AM y 3 PM
0 3,15 * * *
```

Formato: `minuto hora día mes día-semana`

---

*Documento creado: $(date)*








