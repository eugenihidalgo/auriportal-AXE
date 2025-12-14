# 📁 Cómo Usar el Workspace Guardado en Cursor

## 🎯 Tu Situación Actual

✅ Ya estás conectado al servidor remoto en Cursor  
✅ Quieres abrir la carpeta `/var/www/aurelinportal`  
✅ Quieres que se guarde para abrirla automáticamente la próxima vez

## 🚀 Pasos para Configurar el Workspace

### Opción 1: Usar el Workspace que Acabo de Crear (Más Fácil)

1. **En Cursor (ya conectado al servidor):**
   - Ve a **File → Open Folder...** (o Ctrl+K, Ctrl+O)
   - Navega a: `/var/www/aurelinportal`
   - Haz clic en **OK**

2. **Guardar el Workspace:**
   - Ve a **File → Save Workspace As...**
   - **IMPORTANTE:** Guarda el archivo en tu **PC local** (no en el servidor)
   - Sugerencia: Guarda en `~/aurelinportal.code-workspace` o `~/Desktop/aurelinportal.code-workspace`
   - Haz clic en **Save**

3. **La próxima vez:**
   - Abre Cursor
   - Ve a **File → Open Workspace from File...**
   - Selecciona el archivo `aurelinportal.code-workspace` que guardaste
   - ¡Cursor se conectará automáticamente y abrirá la carpeta!

### Opción 2: Descargar el Workspace del Servidor

1. **Desde tu PC local, descarga el workspace:**
   ```bash
   # Si usas Tailscale:
   scp root@nombre-servidor:/var/www/aurelinportal/aurelinportal.code-workspace ~/
   
   # O si usas IP:
   scp root@88.99.173.249:/var/www/aurelinportal/aurelinportal.code-workspace ~/
   ```

2. **Abre el workspace en Cursor:**
   - En Cursor (en tu PC local)
   - Ve a **File → Open Workspace from File...**
   - Selecciona `~/aurelinportal.code-workspace`
   - Cursor se conectará al servidor y abrirá la carpeta automáticamente

### Opción 3: Crear Workspace Manualmente en Cursor

1. **En Cursor (conectado al servidor):**
   - Abre la carpeta: **File → Open Folder...** → `/var/www/aurelinportal`

2. **Guardar Workspace:**
   - **File → Save Workspace As...**
   - Guarda en tu PC local (ej: `~/aurelinportal.code-workspace`)
   - Cursor guardará automáticamente la configuración del servidor remoto

## ✅ Verificar que Funciona

1. Cierra Cursor completamente
2. Abre Cursor de nuevo
3. **File → Open Recent** → Deberías ver tu workspace
4. O **File → Open Workspace from File...** → Selecciona tu archivo `.code-workspace`
5. Cursor debería:
   - Conectarse automáticamente al servidor
   - Abrir la carpeta `/var/www/aurelinportal`
   - Todo listo para trabajar

## 🔧 Configuración Avanzada del Workspace

El archivo `aurelinportal.code-workspace` que creé incluye:
- ✅ Carpeta principal: `/var/www/aurelinportal`
- ✅ Exclusiones de archivos (node_modules, logs, etc.)
- ✅ Configuración de búsqueda optimizada

Puedes editarlo manualmente si necesitas agregar más carpetas o configuraciones.

## 💡 Tips

- **Atajo rápido:** Una vez guardado, puedes hacer doble clic en el archivo `.code-workspace` para abrirlo
- **Favoritos:** Agrega el workspace a tus favoritos en Cursor
- **Múltiples workspaces:** Puedes tener varios workspaces para diferentes proyectos

---

## 🔐 Configuración de Variables de Entorno (.env)

### Verificar que .env existe y está configurado

El proyecto requiere un archivo `.env` con las variables de entorno necesarias. Para verificar que todo está correcto:

```bash
cd /var/www/aurelinportal
node scripts/verify-env.js
```

Este script:
- ✅ Verifica que el archivo `.env` existe
- ✅ Valida que todas las variables requeridas están configuradas
- ✅ **NO expone valores reales** de secretos (solo muestra estado OK/MISSING)

### Crear/Actualizar .env

Si falta el archivo `.env` o faltan variables:

```bash
# 1. Copiar desde el ejemplo (si no existe)
cp .env.example .env

# 2. Editar y configurar valores reales
nano .env

# 3. Verificar que todo está correcto
node scripts/verify-env.js
```

### Variables Requeridas

Las variables mínimas requeridas son:
- `CLICKUP_API_TOKEN` - Token de API de ClickUp
- `GOOGLE_WORKER_URL` - URL del Google Apps Script Worker
- `GOOGLE_WORKER_SECRET` - Secreto para autenticar con el worker
- Variables de PostgreSQL: `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` (o `DATABASE_URL`)

Consulta `.env.example` para ver la lista completa con descripciones.

## 🚀 Iniciar el Servidor con PM2

### Usar ecosystem.config.js (Recomendado)

El archivo `ecosystem.config.js` está configurado para cargar automáticamente las variables de entorno desde `.env`:

```bash
# Iniciar en producción
pm2 start ecosystem.config.js --only aurelinportal-prod

# Iniciar en desarrollo
pm2 start ecosystem.config.js --only aurelinportal-dev

# Iniciar en beta/staging
pm2 start ecosystem.config.js --only aurelinportal-beta
```

### Verificar que PM2 carga las variables correctamente

Después de iniciar con PM2, verifica que el servidor carga las variables:

```bash
# Ver logs del servidor
pm2 logs aurelinportal-prod

# Deberías ver mensajes como:
# ✅ Todas las variables requeridas están configuradas
# ✅ PostgreSQL conectado correctamente
```

Si ves errores sobre variables faltantes, verifica:
1. Que el archivo `.env` existe en la raíz del proyecto
2. Que contiene todas las variables requeridas
3. Ejecuta `node scripts/verify-env.js` para diagnóstico

### Nota sobre .env por entorno

El `ecosystem.config.js` soporta archivos específicos por entorno:
- `.env.prod` para producción (si existe, se usa en lugar de `.env`)
- `.env.beta` para beta/staging
- `.env.dev` para desarrollo

Si no existen estos archivos específicos, se usa `.env` por defecto.

---

**🎉 ¡Listo!** Ahora cada vez que abras ese workspace, Cursor se conectará automáticamente al servidor y abrirá la carpeta del proyecto.





