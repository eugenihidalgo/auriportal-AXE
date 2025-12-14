# 🚀 Servidor MCP de Google Workspace

Este servidor MCP (Model Context Protocol) expone todas las APIs de Google Workspace para su uso en Cursor o cualquier cliente MCP compatible.

## 📋 Funcionalidades

### Gmail API
- ✅ Enviar emails
- ✅ Listar emails
- ✅ Obtener email por ID

### Google Drive API
- ✅ Listar archivos
- ✅ Obtener información de archivo
- ✅ Listar archivos en carpeta
- ✅ Crear archivos
- ✅ Crear carpetas
- ✅ Buscar carpetas por nombre

### Google Calendar API
- ✅ Listar eventos
- ✅ Crear eventos

### Google Sheets API
- ✅ Leer datos de hojas
- ✅ Escribir datos en hojas

### Google Docs API
- ✅ Obtener documentos
- ✅ Crear documentos

### Admin SDK
- ✅ Listar usuarios
- ✅ Obtener usuario
- ✅ Crear usuario
- ✅ Listar grupos
- ✅ Obtener grupo
- ✅ Listar miembros de grupo
- ✅ Agregar miembro a grupo

## 🔧 Configuración

### Requisitos Previos

1. **Variables de entorno configuradas** en `.env`:
   ```env
   GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=eugeni@eugenihidalgo.org
   GOOGLE_PROJECT_ID=pde-aurelin-portal
   ```

2. **APIs habilitadas** en Google Cloud Console:
   - Gmail API
   - Google Drive API
   - Google Calendar API
   - Google Sheets API
   - Google Docs API
   - Admin SDK API

### Configurar en Cursor

Agrega la siguiente configuración en tu archivo de configuración de Cursor (`.cursor/config.json` o similar):

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/var/www/aurelinportal/mcp-server/google-workspace.js"]
    }
  }
}
```

O si estás usando la configuración global de Cursor, agrega en `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/var/www/aurelinportal/mcp-server/google-workspace.js"]
    }
  }
}
```

### Probar el Servidor

Puedes probar el servidor directamente:

```bash
cd /var/www/aurelinportal
node mcp-server/google-workspace.js
```

El servidor usa `stdio` para comunicación, por lo que no verás salida normal, pero los errores se mostrarán en `stderr`.

## 📚 Uso

Una vez configurado en Cursor, podrás usar todas las herramientas de Google Workspace directamente desde el chat. Por ejemplo:

- "Envía un email a usuario@ejemplo.com con asunto 'Hola' y texto 'Mensaje'"
- "Lista los últimos 10 emails en mi bandeja de entrada"
- "Crea una carpeta en Drive llamada 'Proyectos'"
- "Lista los eventos de mi calendario"
- "Lee los datos de la hoja de cálculo con ID 'abc123' en el rango A1:C10"

## 🔍 Recursos Disponibles

El servidor también expone recursos que puedes consultar:

- `google://connection-status` - Estado de la conexión
- `google://profile` - Perfil del usuario de Google

## ⚠️ Notas Importantes

1. **Seguridad**: El servidor usa las credenciales del archivo `.env`. Asegúrate de que este archivo esté protegido y no se suba a Git.

2. **Permisos**: El Service Account debe tener los permisos necesarios y Domain-Wide Delegation configurado si usas impersonación.

3. **Límites de API**: Google tiene límites de rate limiting. El servidor respetará estos límites automáticamente.

## 🐛 Solución de Problemas

### Error: "Google Workspace no está configurado"
- Verifica que las variables de entorno estén en `.env`
- Asegúrate de que el archivo `.env` esté en la raíz del proyecto

### Error: "Invalid credentials"
- Verifica que el JSON del Service Account sea válido
- Asegúrate de que el Service Account tenga los permisos necesarios

### Error: "Insufficient permissions"
- Verifica que hayas habilitado todas las APIs necesarias
- Verifica que Domain-Wide Delegation esté configurado correctamente

## 📝 Versión

- **Versión**: 1.0.0
- **Última actualización**: 2024-12-19
