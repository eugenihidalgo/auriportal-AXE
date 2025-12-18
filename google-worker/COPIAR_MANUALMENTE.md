# 📋 Guía para Copiar Archivos Manualmente a Google Apps Script

## ✅ Pasos Sencillos

### 1. Ir a Google Apps Script

Abre: https://script.google.com

### 2. Crear Nuevo Proyecto

1. Clic en "Nuevo proyecto"
2. Renombra el proyecto a: **"AuriPortal Google Worker"**

### 3. Eliminar el archivo por defecto

- Elimina el archivo `Código.gs` que viene por defecto (si existe)

### 4. Crear los archivos

Para cada archivo, haz clic en el ícono **"+"** (más) → **"Script"**

**IMPORTANTE:** Para archivos en carpetas (utils/, actions/), usa el formato `carpeta/archivo` como nombre del archivo.

#### Orden de creación:

1. **`Code.gs`** → Copia contenido de `Code.gs`
2. **`router.gs`** → Copia contenido de `router.gs`
3. **`utils/response.gs`** → Copia contenido de `utils/response.gs`
4. **`utils/validation.gs`** → Copia contenido de `utils/validation.gs`
5. **`actions/drive.gs`** → Copia contenido de `actions/drive.gs`
6. **`actions/docs.gs`** → Copia contenido de `actions/docs.gs`
7. **`actions/email.gs`** → Copia contenido de `actions/email.gs`
8. **`actions/calendar.gs`** → Copia contenido de `actions/calendar.gs`
9. **`actions/aurielin.gs`** → Copia contenido de `actions/aurielin.gs`
10. **`actions/logs.gs`** → Copia contenido de `actions/logs.gs`

### 5. Configurar SCRIPT_SECRET

1. En Apps Script: Clic en **"Proyecto"** (⚙️) → **"Configuración del proyecto"**
2. Pestaña **"Script properties"**
3. Clic en **"+ Agregar propiedad de script"**
4. Añade:
   - **Clave:** `SCRIPT_SECRET`
   - **Valor:** Un token secreto seguro (ejemplo: genera uno con `openssl rand -hex 32`)

### 6. Desplegar como Web App

1. Clic en **"Implementar"** → **"Nueva implementación"**
2. Tipo: **"Aplicación web"**
3. Configuración:
   - **Descripción:** "AuriPortal Google Worker V8.0"
   - **Ejecutar como:** "Yo"
   - **Quien tiene acceso:** "Cualquiera" (o "Cualquiera con una cuenta de Google")
4. Clic en **"Implementar"**
5. **Copia la URL del Web App** - la necesitarás para tu servidor

### 7. Probar

```bash
curl -X POST URL_DEL_WEB_APP \
  -H "Content-Type: application/json" \
  -d '{"token":"TU_SCRIPT_SECRET","accion":"ping"}'
```

---

## 📁 Archivos en esta carpeta

Todos los archivos están en: `/var/www/aurelinportal/google-worker/`

Puedes abrirlos directamente desde aquí o copiarlos uno por uno.

---

## 💡 Tip

Si tienes acceso SSH, puedes listar todos los archivos con:

```bash
cd /var/www/aurelinportal/google-worker
find . -name "*.gs" -type f
```

Esto te mostrará todos los archivos `.gs` que necesitas copiar.
















