# 🔵 Configuración de Zoom Workplace API

El servidor ahora está configurado para manejar toda la API de Zoom Workplace, similar a como se maneja Cloudflare.

## 📋 Credenciales Necesarias

Para configurar Zoom, necesitas crear una aplicación **Server-to-Server OAuth** en Zoom y obtener estas credenciales:

1. **Account ID** - ID de tu cuenta de Zoom
2. **Client ID** - ID del cliente de la aplicación OAuth
3. **Client Secret** - Secreto del cliente de la aplicación OAuth

## 🔧 Cómo Obtener las Credenciales

1. Inicia sesión en tu cuenta de Zoom
2. Ve al [Zoom App Marketplace](https://marketplace.zoom.us/develop/create)
3. Haz clic en **"Create"** → **"Server-to-Server OAuth App"**
4. Completa la información de la aplicación:
   - Nombre de la aplicación
   - Información de contacto del desarrollador
   - Etc.
5. En la sección **"App Credentials"**, encontrarás:
   - **Account ID**
   - **Client ID**
   - **Client Secret**
6. En la sección **"Scopes"**, agrega los permisos necesarios según las funcionalidades que quieras usar:
   - `meeting:write` - Crear/editar reuniones
   - `meeting:read` - Leer información de reuniones
   - `user:read` - Leer información de usuarios
   - `user:write` - Crear/editar usuarios
   - `webinar:write` - Crear/editar webinars
   - `webinar:read` - Leer información de webinars
   - `recording:read` - Leer grabaciones
   - Y otros según tus necesidades

## ⚙️ Configuración en el Servidor

Una vez que tengas las credenciales, agrégalas a tu archivo `.env`:

```env
# Zoom Workplace API
ZOOM_ACCOUNT_ID=tu_account_id_aqui
ZOOM_CLIENT_ID=tu_client_id_aqui
ZOOM_CLIENT_SECRET=tu_client_secret_aqui
```

## ✅ Verificación

Después de configurar las credenciales:

1. Reinicia el servidor
2. Visita `/health-check` para ver el estado de configuración
3. Visita `/health-check?test=true` para probar la conexión con Zoom

## 🚀 Funcionalidades Disponibles

El servicio `src/services/zoom-api.js` incluye las siguientes funciones:

### Usuarios
- `listarUsuarios()` - Listar todos los usuarios
- `obtenerUsuario(userId)` - Obtener información de un usuario
- `crearUsuario()` - Crear un nuevo usuario
- `actualizarUsuario()` - Actualizar un usuario
- `eliminarUsuario()` - Eliminar un usuario

### Reuniones
- `listarReuniones(userId)` - Listar reuniones de un usuario
- `obtenerReunion(meetingId)` - Obtener información de una reunión
- `crearReunion(userId, meetingData)` - Crear una reunión
- `actualizarReunion()` - Actualizar una reunión
- `eliminarReunion()` - Eliminar una reunión
- `obtenerParticipantesReunion()` - Obtener participantes de una reunión pasada
- `obtenerEstadisticasReunion()` - Obtener estadísticas de una reunión

### Webinars
- `listarWebinars(userId)` - Listar webinars de un usuario
- `obtenerWebinar(webinarId)` - Obtener información de un webinar
- `crearWebinar(userId, webinarData)` - Crear un webinar
- `actualizarWebinar()` - Actualizar un webinar
- `eliminarWebinar()` - Eliminar un webinar

### Grabaciones
- `listarGrabaciones()` - Listar grabaciones de un usuario
- `obtenerGrabacion()` - Obtener información de una grabación
- `eliminarGrabacion()` - Eliminar una grabación

### Reportes
- `obtenerReporteDiario()` - Obtener reporte de uso diario
- `obtenerReporteUsuarios()` - Obtener reporte de usuarios
- `obtenerReporteReunionesUsuario()` - Obtener reporte de reuniones del usuario

### Zoom Rooms
- `listarRooms()` - Listar todas las Zoom Rooms
- `obtenerRoom()` - Obtener información de una Zoom Room

## 📝 Ejemplo de Uso

```javascript
import { 
  crearReunion, 
  listarUsuarios, 
  crearWebinar 
} from './src/services/zoom-api.js';

// Listar usuarios
const usuarios = await listarUsuarios('active');

// Crear una reunión
const reunion = await crearReunion('userId', {
  topic: 'Reunión de equipo',
  start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hora desde ahora
  duration: 60,
  settings: {
    host_video: true,
    participant_video: true
  }
});

// Crear un webinar
const webinar = await crearWebinar('userId', {
  topic: 'Webinar de Producto',
  start_time: new Date(Date.now() + 86400000).toISOString(), // Mañana
  duration: 90
});
```

## 🔒 Seguridad

- El access token se cachea automáticamente para mejorar el rendimiento
- El token se renueva automáticamente cuando expira
- Las credenciales se almacenan de forma segura en variables de entorno

## 📚 Documentación

Para más información sobre la API de Zoom:
- [Documentación oficial de Zoom API](https://developers.zoom.us/docs/api/)
- [Referencia de la API](https://developers.zoom.us/docs/api/rest/)
















