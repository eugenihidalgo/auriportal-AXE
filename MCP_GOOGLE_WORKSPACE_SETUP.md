# 🚀 Configuración del Servidor MCP de Google Workspace

## ✅ Estado Actual

El servidor MCP de Google Workspace está **completamente configurado y funcionando** en tu servidor.

### Verificación
```bash
cd /var/www/aurelinportal
npm run mcp:test
```

**Resultado esperado:**
```
✅ Conexión exitosa con Google Workspace!
   Email: bennascut@eugenihidalgo.org
   Total de mensajes: 2075
   Total de hilos: 1741

🎉 El servidor MCP está listo para usar!
```

## 📋 Lo que ya está configurado

1. ✅ **SDK de MCP instalado** (`@modelcontextprotocol/sdk`)
2. ✅ **Servidor MCP creado** (`mcp-server/google-workspace.js`)
3. ✅ **Credenciales de Google Workspace configuradas** (Service Account)
4. ✅ **Conexión verificada y funcionando**
5. ✅ **Scripts de prueba agregados** (`npm run mcp:test`)

## 🔧 Configurar en Cursor

Para usar el servidor MCP en Cursor, necesitas agregar la configuración. Hay dos formas:

### Opción 1: Configuración Global de Cursor

1. Abre o crea el archivo de configuración de MCP de Cursor:
   ```bash
   # En Linux/Mac
   ~/.cursor/mcp.json
   
   # O en Windows
   %APPDATA%\Cursor\mcp.json
   ```

2. Agrega la siguiente configuración:
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

3. Reinicia Cursor para que cargue la nueva configuración.

### Opción 2: Configuración del Workspace

1. Crea un archivo `.cursor/mcp.json` en la raíz del proyecto:
   ```bash
   mkdir -p /var/www/aurelinportal/.cursor
   cp /var/www/aurelinportal/mcp-server/cursor-config.example.json /var/www/aurelinportal/.cursor/mcp.json
   ```

2. Edita el archivo si es necesario para ajustar las rutas.

3. Reinicia Cursor.

## 🎯 Funcionalidades Disponibles

Una vez configurado, podrás usar todas estas herramientas desde Cursor:

### 📧 Gmail
- `gmail_send` - Enviar emails
- `gmail_list` - Listar emails
- `gmail_get` - Obtener email por ID

### 📁 Google Drive
- `drive_list` - Listar archivos
- `drive_get` - Obtener información de archivo
- `drive_list_folder` - Listar archivos en carpeta
- `drive_create_file` - Crear archivo
- `drive_create_folder` - Crear carpeta
- `drive_find_folder` - Buscar carpeta por nombre

### 📅 Google Calendar
- `calendar_list` - Listar eventos
- `calendar_create` - Crear evento

### 📊 Google Sheets
- `sheets_read` - Leer datos de hoja
- `sheets_write` - Escribir datos en hoja

### 📝 Google Docs
- `docs_get` - Obtener documento
- `docs_create` - Crear documento

### 👥 Admin SDK
- `admin_list_users` - Listar usuarios
- `admin_get_user` - Obtener usuario
- `admin_create_user` - Crear usuario
- `admin_list_groups` - Listar grupos
- `admin_get_group` - Obtener grupo
- `admin_list_group_members` - Listar miembros de grupo
- `admin_add_group_member` - Agregar miembro a grupo

### 🔍 Utilidades
- `google_verify_connection` - Verificar conexión

## 💡 Ejemplos de Uso

Una vez configurado, puedes usar comandos como:

- "Envía un email a usuario@ejemplo.com con asunto 'Hola' y texto 'Mensaje de prueba'"
- "Lista los últimos 10 emails en mi bandeja de entrada"
- "Crea una carpeta en Drive llamada 'Proyectos 2024'"
- "Lista los eventos de mi calendario para mañana"
- "Lee los datos de la hoja de cálculo con ID 'abc123' en el rango A1:C10"
- "Crea un nuevo documento de Google Docs llamado 'Reunión de equipo'"

## 📂 Estructura de Archivos

```
/var/www/aurelinportal/
├── mcp-server/
│   ├── google-workspace.js      # Servidor MCP principal
│   ├── test-connection.js        # Script de prueba
│   ├── README.md                 # Documentación del servidor
│   └── cursor-config.example.json # Ejemplo de configuración
├── src/
│   └── services/
│       └── google-workspace.js   # Servicios de Google Workspace
└── .env                          # Variables de entorno (con credenciales)
```

## 🔐 Seguridad

- ⚠️ **NUNCA** subas el archivo `.env` a Git
- ⚠️ **NUNCA** compartas las credenciales del Service Account
- ✅ El archivo `.env` ya está en `.gitignore`
- ✅ Las credenciales están configuradas y funcionando

## 🐛 Solución de Problemas

### El servidor MCP no aparece en Cursor

1. Verifica que el archivo de configuración esté en la ubicación correcta
2. Verifica que la ruta al script sea absoluta y correcta
3. Reinicia Cursor completamente
4. Verifica los logs de Cursor para ver errores

### Error: "Google Workspace no está configurado"

1. Verifica que el archivo `.env` exista y tenga las variables necesarias:
   ```bash
   cd /var/www/aurelinportal
   grep GOOGLE_SERVICE_ACCOUNT_KEY .env
   ```

2. Ejecuta el script de prueba:
   ```bash
   npm run mcp:test
   ```

### Error: "Invalid credentials"

1. Verifica que el JSON del Service Account sea válido
2. Verifica que el Service Account tenga los permisos necesarios
3. Verifica que Domain-Wide Delegation esté configurado si usas impersonación

### Error: "Insufficient permissions"

1. Verifica que todas las APIs estén habilitadas en Google Cloud Console
2. Verifica que Domain-Wide Delegation esté configurado correctamente
3. Verifica que los scopes estén configurados en Google Admin Console

## 📝 Notas Importantes

1. **El servidor usa las credenciales del `.env`**: No necesitas configurar nada adicional, ya está todo listo.

2. **El servidor funciona con Service Account**: Esto significa que no necesitas tokens de OAuth2, funciona 24/7 sin renovación.

3. **Impersonación configurada**: El servidor está configurado para impersonar `eugeni@eugenihidalgo.org`, por lo que todas las operaciones se realizarán como ese usuario.

4. **Límites de API**: Google tiene límites de rate limiting. El servidor respetará estos límites automáticamente.

## ✅ Checklist Final

- [x] SDK de MCP instalado
- [x] Servidor MCP creado
- [x] Credenciales configuradas
- [x] Conexión verificada
- [ ] Configuración agregada en Cursor (hazlo ahora)
- [ ] Cursor reiniciado
- [ ] Servidor MCP visible en Cursor

## 🎉 ¡Listo!

Una vez que agregues la configuración en Cursor y lo reinicies, el servidor MCP de Google Workspace estará disponible y podrás usar todas las herramientas directamente desde el chat de Cursor.

---

**Última actualización**: 2024-12-19  
**Versión del servidor MCP**: 1.0.0

