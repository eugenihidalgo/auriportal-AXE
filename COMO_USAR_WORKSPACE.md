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

**🎉 ¡Listo!** Ahora cada vez que abras ese workspace, Cursor se conectará automáticamente al servidor y abrirá la carpeta del proyecto.





