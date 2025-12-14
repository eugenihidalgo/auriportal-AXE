# Google Worker - AuriPortal V8.0

Web App de Google Apps Script que actúa como Worker para automatizar Google Workspace desde el servidor AuriPortal.

## 📋 Descripción

Este script permite que el servidor AuriPortal en Hetzner realice acciones automatizadas dentro de Google Workspace Standard, funcionando como un módulo interno que gestiona:
- Google Drive (carpetas, archivos)
- Google Docs (creación, conversión a PDF)
- Gmail (envío de emails)
- Google Calendar (creación de eventos)
- Google Sheets (registro de logs)

## 🚀 Instalación

### 1. Crear el Proyecto en Google Apps Script

1. Ve a [script.google.com](https://script.google.com)
2. Clic en "Nuevo proyecto"
3. Renombra el proyecto a "AuriPortal Google Worker"

### 2. Copiar los Archivos

Crea la siguiente estructura de archivos en Google Apps Script:

```
├── Code.gs
├── router.gs
├── utils/
│   ├── response.gs
│   └── validation.gs
└── actions/
    ├── drive.gs
    ├── docs.gs
    ├── email.gs
    ├── calendar.gs
    ├── aurielin.gs
    └── logs.gs
```

**Cómo crear archivos en Apps Script:**
- Clic en el ícono "+" junto a "Archivos"
- Selecciona "Script" o "Archivo HTML" según corresponda
- Para crear carpetas, usa el menú "Archivo" → "Nuevo" → "Carpeta" (o nombra archivos con `carpeta/archivo.gs`)

### 3. Configurar el Token Secreto

1. En Apps Script, ve a "Proyecto" → "Configuración del proyecto" → "Script properties"
2. Añade una nueva propiedad:
   - **Clave:** `SCRIPT_SECRET`
   - **Valor:** Un token secreto seguro (genera uno aleatorio)

**Ejemplo de token seguro:**
```bash
openssl rand -hex 32
```

### 4. Desplegar como Web App

1. Clic en "Implementar" → "Nueva implementación"
2. Selecciona tipo: "Aplicación web"
3. Configuración:
   - **Descripción:** "AuriPortal Google Worker V8.0"
   - **Ejecutar como:** "Yo"
   - **Quien tiene acceso:** "Cualquiera" (o "Cualquiera con una cuenta de Google" según tu configuración)
4. Clic en "Implementar"
5. **Copia la URL del Web App** - la necesitarás en tu servidor Node.js

### 5. Habilitar APIs Necesarias

El script necesita acceso a:
- Google Drive API (automático)
- Google Docs API (automático)
- Gmail API (automático)
- Google Calendar API (automático)

La primera vez que ejecutes una acción, Google pedirá autorización. Acepta los permisos.

## 📡 Uso desde Node.js

### Ejemplo Básico

```javascript
const fetch = require('node-fetch');

const WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
const SECRET_TOKEN = 'tu_secret_token_aqui';

async function llamarGoogleWorker(accion, datos) {
  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: SECRET_TOKEN,
      accion: accion,
      ...datos
    })
  });
  
  return await response.json();
}

// Ejemplo: Test de conexión
const resultado = await llamarGoogleWorker('ping', {});
console.log(resultado);
// { status: "ok", message: "Google Worker AuriPortal activo", data: {...} }
```

## 🎯 Acciones Disponibles

### 1. `ping` - Test de Conectividad

```javascript
await llamarGoogleWorker('ping', {});
```

**Respuesta:**
```json
{
  "status": "ok",
  "message": "Google Worker AuriPortal activo",
  "data": {
    "timestamp": "2024-01-15T10:00:00Z",
    "version": "8.0"
  }
}
```

### 2. `crear_carpeta` - Crear Carpeta en Drive

```javascript
await llamarGoogleWorker('crear_carpeta', {
  nombre: 'Mi Carpeta',
  padre_id: '1abc123...' // opcional
});
```

### 3. `crear_documento` - Crear Google Docs

```javascript
await llamarGoogleWorker('crear_documento', {
  nombre: 'Mi Documento',
  contenido: '<h1>Título</h1><p>Contenido...</p>',
  es_html: true,
  carpeta_id: '1abc123...' // opcional
});
```

### 4. `generar_pdf` - Convertir Docs a PDF

```javascript
await llamarGoogleWorker('generar_pdf', {
  documento_id: '1abc123...',
  nombre_pdf: 'informe_final',
  carpeta_destino_id: '1xyz789...'
});
```

### 5. `enviar_email` - Enviar Email con Gmail

```javascript
await llamarGoogleWorker('enviar_email', {
  to: 'alumno@ejemplo.com',
  subject: 'Bienvenido a AuriPortal',
  htmlBody: '<h1>Bienvenido</h1><p>Contenido...</p>',
  adjuntos: [
    { id: '1abc123...', nombre: 'informe.pdf' }
  ],
  cc: 'admin@ejemplo.com', // opcional
  bcc: 'log@ejemplo.com' // opcional
});
```

### 6. `crear_evento_calendar` - Crear Evento en Calendar

```javascript
await llamarGoogleWorker('crear_evento_calendar', {
  titulo: 'Sesión de Meditación',
  descripcion: 'Sesión guiada de meditación',
  fecha_inicio: '2024-01-15T10:00:00',
  fecha_fin: '2024-01-15T11:00:00',
  ubicacion: 'https://zoom.us/j/123456789',
  invitados: ['alumno@ejemplo.com'],
  calendar_id: 'primary' // opcional
});
```

### 7. `mover_archivo` - Mover Archivo entre Carpetas

```javascript
await llamarGoogleWorker('mover_archivo', {
  archivo_id: '1abc123...',
  destino_id: '1xyz789...',
  eliminar_original: true
});
```

### 8. `crear_estructura_alumno` - Crear Estructura de Carpetas

```javascript
await llamarGoogleWorker('crear_estructura_alumno', {
  alumno_id: '12345',
  carpeta_alumnos_id: '1abc123...' // opcional
});
```

Crea automáticamente:
- `/Alumnos/{ID}/Eventos`
- `/Alumnos/{ID}/Informes`
- `/Alumnos/{ID}/Materiales`

### 9. `crear_informe_aurielin` - Crear Informe Completo

```javascript
await llamarGoogleWorker('crear_informe_aurielin', {
  alumno_id: '12345',
  titulo: 'Informe de Progreso - Enero 2024',
  contenido: {
    introduccion: 'Este informe detalla...',
    secciones: [
      {
        titulo: 'Progreso General',
        contenido: 'El alumno ha mostrado...'
      },
      {
        titulo: 'Áreas de Mejora',
        contenido: 'Se recomienda...'
      }
    ],
    conclusion: 'En conclusión...'
  },
  carpeta_informes_id: '1abc123...' // opcional
});
```

Crea un documento formateado y lo convierte a PDF automáticamente.

### 10. `registrar_log` - Registrar Acción en Hoja de Cálculo

```javascript
await llamarGoogleWorker('registrar_log', {
  accion: 'crear_informe',
  usuario: 'alumno@ejemplo.com',
  payload: {
    alumno_id: '12345',
    informe_id: 'abc123'
  },
  spreadsheet_id: '1abc123...' // opcional
});
```

## 🔒 Seguridad

- **Token Secreto:** Siempre usa un token fuerte y guárdalo de forma segura
- **HTTPS:** El Web App siempre usa HTTPS
- **Validación:** Todas las peticiones validan el token antes de ejecutarse
- **Permisos:** El script se ejecuta con los permisos de tu cuenta de Google

## 🐛 Troubleshooting

### Error: "SCRIPT_SECRET no configurado"
- Ve a Script Properties y configura `SCRIPT_SECRET`

### Error: "Token no autorizado"
- Verifica que el token en tu servidor coincida con `SCRIPT_SECRET`
- Asegúrate de enviar el token en el campo `token` del JSON

### Error: "Permisos insuficientes"
- Ejecuta manualmente cualquier función una vez para que Google pida autorización
- O ve a "Autorizaciones" en Apps Script y otorga permisos manualmente

### Error: "Archivo/Carpeta no encontrado"
- Verifica los IDs de Drive
- Asegúrate de que el script tenga acceso a las carpetas/archivos

## 📝 Notas Importantes

1. **IDs de Google Drive:** Los IDs son strings largos únicos. Cópialos desde la URL:
   - `https://drive.google.com/drive/folders/ABC123XYZ` → ID: `ABC123XYZ`

2. **Fechas:** Usa formato ISO 8601 para fechas:
   - `2024-01-15T10:00:00` (hora local)
   - `2024-01-15T10:00:00Z` (UTC)

3. **Límites de Apps Script:**
   - Tiempo de ejecución: 6 minutos máximo
   - Llamadas diarias: 20,000 por usuario
   - Tamaño de respuesta: 50 MB máximo

4. **Logs:** La primera vez que uses `registrar_log`, se creará automáticamente la hoja "Logs_AuriPortal" en tu Drive.

## 📞 Soporte

Para problemas o mejoras, contacta al equipo de AuriPortal.

---

**Versión:** 8.0  
**Última actualización:** 2024






