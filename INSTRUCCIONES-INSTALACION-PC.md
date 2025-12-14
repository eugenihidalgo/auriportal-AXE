# 💻 Instrucciones Completas - Instalación en PC

## 📋 Aplicación: Kajabi Data Sync

Aplicación local que se sincroniza automáticamente con la base de datos del servidor.

---

## ✅ Requisitos Previos

1. **Node.js instalado** (versión 18 o superior)
   - Descargar desde: https://nodejs.org/
   - Verificar instalación: `node --version`

2. **Acceso SSH al servidor**
   - IP: `88.99.173.249`
   - Usuario: `root`
   - Probar conexión: `ssh root@88.99.173.249`

---

## 🚀 Instalación Paso a Paso

### **Paso 1: Crear carpeta de trabajo**

```bash
# En tu PC, crea una carpeta para la aplicación
mkdir ~/kajabi-sync-app
cd ~/kajabi-sync-app
```

### **Paso 2: Copiar la aplicación desde el servidor**

```bash
# Copia el archivo de la aplicación
scp root@88.99.173.249:/var/www/aurelinportal/scripts/kajabi-sync-app.js ./
```

**Si te pide contraseña SSH**, ingrésala.

**Si no tienes acceso SSH configurado**, primero configura la clave SSH o usa contraseña.

### **Paso 3: Inicializar proyecto Node.js**

```bash
# Inicializar package.json
npm init -y
```

### **Paso 4: Instalar dependencias**

```bash
# Instalar better-sqlite3 (base de datos SQLite)
npm install better-sqlite3
```

### **Paso 5: Ejecutar la aplicación**

```bash
# Ejecutar la aplicación
node kajabi-sync-app.js
```

Deberías ver:
```
🚀 Iniciando aplicación Kajabi Data Sync...
✅ Base de datos local cargada: /ruta/a/aurelinportal-sync.db
🔄 Sincronizando base de datos desde el servidor...
✅ Base de datos sincronizada. Contactos: XXX
✅ Aplicación iniciada en http://localhost:8080
```

### **Paso 6: Abrir en el navegador**

Abre tu navegador y ve a:
```
http://localhost:8080
```

---

## 🎯 Uso de la Aplicación

### **Interfaz Principal**

- **📊 Resumen**: Estadísticas generales y últimas sincronizaciones
- **👥 Contactos**: Lista completa de contactos
- **🛒 Compras**: Todas las compras
- **💳 Suscripciones**: Suscripciones activas e inactivas
- **💰 Transacciones**: Historial de transacciones
- **📦 Catálogo**: Productos, cursos y ofertas

### **Sincronización**

- **Automática**: Cada 5 minutos se sincroniza automáticamente
- **Manual**: Haz clic en el botón "🔄 Sincronizar Ahora" en la parte superior

### **Indicador de Estado**

- **🟢 Verde**: Sincronizado y funcionando
- **🟡 Amarillo**: Sincronizando...
- **🔴 Rojo**: Error en sincronización

---

## ⚙️ Configuración (Opcional)

### **Cambiar intervalo de sincronización**

Edita el archivo `kajabi-sync-app.js` y busca:
```javascript
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos
```

Cambia el valor (en milisegundos):
- 1 minuto: `1 * 60 * 1000`
- 10 minutos: `10 * 60 * 1000`
- 30 minutos: `30 * 60 * 1000`

### **Cambiar puerto**

Edita el archivo y busca:
```javascript
const PORT = 8080;
```

Cambia por el puerto que quieras (ej: 3000, 5000, etc.)

### **Cambiar configuración del servidor**

Si el servidor tiene otra IP o usuario, edita:
```javascript
const SERVER_CONFIG = {
  host: '88.99.173.249',  // Cambia la IP si es necesario
  user: 'root',            // Cambia el usuario si es necesario
  remoteDbPath: '/var/www/aurelinportal/database/aurelinportal.db',
  localDbPath: join(__dirname, '..', 'aurelinportal-sync.db')
};
```

---

## 🔧 Solución de Problemas

### **Error: "scp: command not found"**

**Windows:**
- Usa **Git Bash** o **WSL** (Windows Subsystem for Linux)
- O instala **OpenSSH** para Windows

**Mac/Linux:**
- Debería estar instalado por defecto

### **Error: "Permission denied" (SSH)**

**Solución 1: Usar contraseña**
- Asegúrate de tener la contraseña del servidor
- El comando `scp` te la pedirá

**Solución 2: Configurar clave SSH**
```bash
# Generar clave SSH (si no tienes)
ssh-keygen -t rsa -b 4096

# Copiar clave al servidor
ssh-copy-id root@88.99.173.249
```

### **Error: "Cannot find module 'better-sqlite3'"**

```bash
# Reinstalar dependencias
npm install better-sqlite3

# O instalar todas las dependencias de nuevo
rm -rf node_modules package-lock.json
npm install better-sqlite3
```

### **Error: "Base de datos no disponible"**

1. Verifica que tengas acceso SSH:
   ```bash
   ssh root@88.99.173.249
   ```

2. Verifica que la ruta de la BD sea correcta en el código

3. Verifica permisos de escritura en la carpeta donde está el script

### **La aplicación no se sincroniza**

1. Verifica conexión a internet
2. Verifica que el servidor esté accesible:
   ```bash
   ping 88.99.173.249
   ```
3. Verifica acceso SSH:
   ```bash
   ssh root@88.99.173.249
   ```

### **El puerto 8080 está ocupado**

Cambia el puerto en el código o cierra la aplicación que usa el puerto 8080.

---

## 📁 Archivos Generados

La aplicación creará estos archivos en la misma carpeta:

- `aurelinportal-sync.db`: Base de datos local sincronizada
- `package.json`: Configuración del proyecto Node.js
- `node_modules/`: Dependencias instaladas

---

## 🔄 Mantener la Aplicación Actualizada

### **Actualizar el código de la aplicación**

Si hay actualizaciones en el servidor:

```bash
# Desde la carpeta de la aplicación
scp root@88.99.173.249:/var/www/aurelinportal/scripts/kajabi-sync-app.js ./
```

### **Eliminar y reinstalar dependencias**

Si hay problemas:

```bash
rm -rf node_modules package-lock.json
npm install better-sqlite3
```

---

## 🎯 Comandos Rápidos

### **Iniciar la aplicación**
```bash
cd ~/kajabi-sync-app
node kajabi-sync-app.js
```

### **Detener la aplicación**
Presiona `Ctrl + C` en la terminal

### **Verificar que está corriendo**
Abre: http://localhost:8080

### **Forzar sincronización**
Haz clic en "🔄 Sincronizar Ahora" en la interfaz web

---

## 📊 Estructura de la Aplicación

```
kajabi-sync-app/
├── kajabi-sync-app.js    # Aplicación principal
├── package.json          # Configuración npm
├── node_modules/         # Dependencias
└── aurelinportal-sync.db # Base de datos local (se crea automáticamente)
```

---

## ✅ Checklist de Instalación

- [ ] Node.js instalado y funcionando
- [ ] Carpeta creada (`~/kajabi-sync-app`)
- [ ] Archivo copiado desde el servidor
- [ ] `npm init -y` ejecutado
- [ ] `npm install better-sqlite3` ejecutado
- [ ] Aplicación ejecutándose (`node kajabi-sync-app.js`)
- [ ] Navegador abierto en http://localhost:8080
- [ ] Datos visibles en la interfaz

---

## 🆘 Soporte

Si tienes problemas:

1. Verifica que todos los pasos se hayan completado
2. Revisa los mensajes de error en la terminal
3. Verifica que el servidor esté accesible
4. Verifica que tengas acceso SSH al servidor

---

## 📝 Notas Importantes

- La aplicación **funciona offline** una vez sincronizada
- Los datos se **actualizan automáticamente** cada 5 minutos
- Puedes **cerrar y abrir** la aplicación, los datos se mantienen
- La base de datos local se guarda en la misma carpeta
- No necesitas conexión constante, solo para sincronizar

---

**¡Listo para usar!** 🚀






