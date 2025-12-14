# 💻 Instalación en tu PC - Aplicación Sincronizada

Aplicación completa que se sincroniza automáticamente con la base de datos del servidor.

## 📋 Requisitos

1. **Node.js** instalado en tu PC
   - Descarga desde: https://nodejs.org/
   - Versión 18 o superior

2. **Acceso SSH** al servidor configurado
   - Debes poder conectarte con: `ssh root@88.99.173.249`
   - O configurar clave SSH para acceso sin contraseña

3. **Dependencias**:
   ```bash
   npm install better-sqlite3
   ```

## 🚀 Instalación

### Paso 1: Copiar archivos a tu PC

```bash
# Crear carpeta en tu PC
mkdir ~/kajabi-sync-app
cd ~/kajabi-sync-app

# Copiar la aplicación desde el servidor
scp -r root@88.99.173.249:/var/www/aurelinportal/scripts/kajabi-sync-app.js ./
```

### Paso 2: Instalar dependencias

```bash
cd ~/kajabi-sync-app
npm init -y
npm install better-sqlite3
```

### Paso 3: Configurar (opcional)

Crea un archivo `.env` si quieres cambiar la configuración:

```bash
# .env
KAJABI_SERVER_HOST=88.99.173.249
KAJABI_SERVER_USER=root
```

### Paso 4: Ejecutar

```bash
node kajabi-sync-app.js
```

## 🎯 Características

- ✅ **Sincronización automática** cada 5 minutos
- ✅ **Sincronización manual** con botón
- ✅ **Interfaz web** en http://localhost:8080
- ✅ **Base de datos local** para acceso rápido
- ✅ **Actualización automática** de datos
- ✅ **Indicador de estado** de sincronización

## 📊 Uso

1. **Ejecuta la aplicación:**
   ```bash
   node kajabi-sync-app.js
   ```

2. **Abre tu navegador:**
   ```
   http://localhost:8080
   ```

3. **Navega entre secciones:**
   - Resumen
   - Contactos
   - Compras
   - Suscripciones
   - Transacciones
   - Catálogo

4. **Sincroniza manualmente:**
   - Haz clic en "🔄 Sincronizar Ahora"

## ⚙️ Configuración Avanzada

### Cambiar intervalo de sincronización

Edita el archivo y cambia:
```javascript
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos
```

### Cambiar puerto

Edita el archivo y cambia:
```javascript
const PORT = 8080; // Cambia por el puerto que quieras
```

## 🔧 Solución de Problemas

### Error: "Base de datos no disponible"

- Verifica que tengas acceso SSH al servidor
- Prueba: `ssh root@88.99.173.249`
- Verifica que la ruta de la BD sea correcta

### Error: "scp: command not found"

- En Windows, usa WSL o Git Bash
- O instala OpenSSH para Windows

### La sincronización no funciona

- Verifica que tengas acceso SSH sin contraseña (clave SSH)
- O configura la contraseña en el script

## 📝 Notas

- La base de datos se guarda localmente en: `aurelinportal-sync.db`
- Los datos se actualizan automáticamente cada 5 minutos
- Puedes cerrar y abrir la aplicación, los datos se mantienen
- La aplicación funciona offline una vez sincronizada






