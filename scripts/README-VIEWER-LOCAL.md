# 📊 Kajabi Data Viewer - Local

Aplicación local para visualizar todos los datos de Kajabi sin necesidad de usar la URL del servidor.

## 🚀 Uso

### Opción 1: Con Base de Datos Local (Recomendado)

1. **Copia la base de datos a tu PC:**
   ```bash
   # Desde el servidor
   scp /var/www/aurelinportal/database/aurelinportal.db ~/Desktop/
   
   # O usando rsync
   rsync -avz servidor:/var/www/aurelinportal/database/aurelinportal.db ~/Desktop/
   ```

2. **Ejecuta el viewer local:**
   ```bash
   cd /var/www/aurelinportal
   node scripts/kajabi-viewer-local.js
   ```

3. **Abre tu navegador:**
   ```
   http://localhost:8080
   ```

### Opción 2: Sin Base de Datos Local

Si no tienes la base de datos local, el viewer intentará conectarse al servidor remoto (requiere configuración adicional).

## 📋 Requisitos

- Node.js instalado
- Base de datos SQLite (`aurelinportal.db`) en la misma carpeta o ruta configurada

## ⚙️ Configuración

Puedes configurar la ruta de la base de datos editando el archivo o usando variables de entorno:

```bash
export DB_PATH=/ruta/a/tu/aurelinportal.db
node scripts/kajabi-viewer-local.js
```

## 🎯 Características

- ✅ Visualización completa de todos los datos
- ✅ Navegación entre secciones
- ✅ Estadísticas en tiempo real
- ✅ Sin necesidad de conexión a internet (si tienes BD local)
- ✅ Interfaz moderna y responsive

## 📦 Secciones Disponibles

- **Resumen**: Estadísticas generales y últimas sincronizaciones
- **Contactos**: Lista completa de contactos
- **Compras**: Todas las compras
- **Suscripciones**: Suscripciones activas e inactivas
- **Transacciones**: Historial de transacciones
- **Catálogo**: Productos, cursos y ofertas

## 🔄 Sincronizar Base de Datos

Para mantener los datos actualizados, copia periódicamente la base de datos desde el servidor:

```bash
# Script para sincronizar (crear en tu PC)
#!/bin/bash
rsync -avz servidor:/var/www/aurelinportal/database/aurelinportal.db ~/Desktop/
echo "✅ Base de datos sincronizada"
```






