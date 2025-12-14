# 🔐 Guía Completa: Configurar Google Workspace APIs

Esta guía te ayudará a configurar todas las APIs de Google Workspace en el servidor para que estén disponibles para todo lo que necesites hacer.

## 📋 Índice

1. [Opciones de Autenticación](#opciones-de-autenticación)
2. [Opción 1: Service Account (Recomendado para Servidores)](#opción-1-service-account-recomendado)
3. [Opción 2: OAuth2 (Para Aplicaciones con Usuarios)](#opción-2-oauth2-para-aplicaciones)
4. [APIs Disponibles](#apis-disponibles)
5. [Variables de Entorno](#variables-de-entorno)
6. [Verificación](#verificación)
7. [Ejemplos de Uso](#ejemplos-de-uso)

---

## 🔑 Opciones de Autenticación

Hay dos formas de autenticarse con Google Workspace:

### **Opción 1: Service Account** ⭐ (Recomendado para servidores)
- ✅ No requiere interacción del usuario
- ✅ Funciona 24/7 sin renovación de tokens
- ✅ Ideal para automatizaciones y servicios backend
- ✅ Puede impersonar usuarios del dominio

### **Opción 2: OAuth2** (Para aplicaciones con usuarios)
- ✅ Permite acceso a cuentas de usuarios específicos
- ⚠️ Requiere refresh token inicial
- ⚠️ Necesita renovación periódica

**Recomendación:** Usa **Service Account** para el servidor.

---

## 🚀 Opción 1: Service Account (Recomendado)

### **Paso 1: Crear Proyecto en Google Cloud Console**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el **Project ID** (lo necesitarás después)

### **Paso 2: Habilitar APIs Necesarias**

Ve a **APIs & Services** → **Library** y habilita:

- ✅ **Gmail API**
- ✅ **Google Drive API**
- ✅ **Google Calendar API**
- ✅ **Google Sheets API**
- ✅ **Google Docs API**
- ✅ **Admin SDK API** (para gestión de usuarios y grupos)

### **Paso 3: Crear Service Account**

1. Ve a **APIs & Services** → **Credentials**
2. Click en **+ CREATE CREDENTIALS** → **Service Account**
3. Completa:
   - **Service account name**: `auriportal-workspace`
   - **Service account ID**: Se genera automáticamente
   - **Description**: `Service account para AuriPortal Google Workspace APIs`
4. Click en **CREATE AND CONTINUE**
5. En **Grant this service account access to project**:
   - **Role**: Selecciona **Editor** (o roles más específicos según necesites)
6. Click en **CONTINUE** → **DONE**

### **Paso 4: Crear y Descargar Key JSON**

1. En la lista de Service Accounts, click en el que acabas de crear
2. Ve a la pestaña **KEYS**
3. Click en **ADD KEY** → **Create new key**
4. Selecciona **JSON**
5. Click en **CREATE**
6. Se descargará un archivo JSON (guárdalo de forma segura, no lo subas a Git)

### **Paso 5: Habilitar Domain-Wide Delegation (Opcional pero Recomendado)**

Si quieres que el Service Account pueda impersonar usuarios del dominio:

1. En la página del Service Account, ve a **Show Domain-Wide Delegation**
2. Marca **Enable Google Workspace Domain-wide Delegation**
3. Anota el **Client ID** que aparece
4. Ve a [Google Admin Console](https://admin.google.com/)
5. Ve a **Security** → **API Controls** → **Domain-wide Delegation**
6. Click en **Add new**
7. Completa:
   - **Client ID**: El que anotaste antes
   - **OAuth Scopes**: Pega todos estos scopes (uno por línea):
     ```
     https://www.googleapis.com/auth/gmail
     https://www.googleapis.com/auth/gmail.send
     https://www.googleapis.com/auth/gmail.readonly
     https://www.googleapis.com/auth/drive
     https://www.googleapis.com/auth/drive.file
     https://www.googleapis.com/auth/calendar
     https://www.googleapis.com/auth/spreadsheets
     https://www.googleapis.com/auth/documents
     https://www.googleapis.com/auth/admin.directory.user
     https://www.googleapis.com/auth/admin.directory.group
     https://www.googleapis.com/auth/admin.directory.domain.readonly
     ```
8. Click en **Authorize**

### **Paso 6: Configurar en el Servidor**

Abre el archivo JSON descargado y copia su contenido completo. Luego agrégalo a tu archivo `.env`:

```env
# Google Workspace - Service Account
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"tu-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"auriportal-workspace@tu-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'

# Opcional: Usuario a impersonar (si habilitaste Domain-Wide Delegation)
GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=admin@tudominio.com

# Opcional: Dominio de Google Workspace
GOOGLE_WORKSPACE_DOMAIN=tudominio.com

# Opcional: Email desde el cual enviar (si usas impersonación)
EMAIL_FROM=noreply@tudominio.com
```

**⚠️ IMPORTANTE:** 
- El JSON debe estar en una sola línea
- Usa comillas simples `'...'` para envolver el JSON
- O escapa las comillas dobles dentro del JSON

---

## 🔐 Opción 2: OAuth2 (Para Aplicaciones con Usuarios)

### **Paso 1: Crear Proyecto en Google Cloud Console**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente

### **Paso 2: Habilitar APIs**

Igual que en la Opción 1, habilita todas las APIs necesarias.

### **Paso 3: Crear OAuth 2.0 Credentials**

1. Ve a **APIs & Services** → **Credentials**
2. Click en **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Si es la primera vez, configura la **OAuth consent screen**:
   - **User Type**: Selecciona **Internal** (si tienes Google Workspace) o **External**
   - Completa la información requerida
   - En **Scopes**, agrega todos los scopes necesarios
   - Guarda y continúa
4. En **Create OAuth client ID**:
   - **Application type**: **Web application**
   - **Name**: `AuriPortal Web Client`
   - **Authorized redirect URIs**: 
     - `http://localhost:3000/oauth/callback` (desarrollo)
     - `https://tudominio.com/oauth/callback` (producción)
5. Click en **CREATE**
6. Se mostrarán el **Client ID** y **Client Secret** (cópialos)

### **Paso 4: Obtener Refresh Token**

#### **Método 1: Usando el Servidor (Recomendado)**

1. Agrega las credenciales a `.env`:
   ```env
   GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=tu_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
   ```

2. Inicia el servidor y visita:
   ```
   http://localhost:3000/google-auth
   ```
   (Necesitarás crear este endpoint si no existe)

3. Serás redirigido a Google para autorizar
4. Después de autorizar, obtendrás el refresh token

#### **Método 2: Manual con OAuth Playground**

1. Ve a [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click en el ícono de configuración (⚙️) en la esquina superior derecha
3. Marca **Use your own OAuth credentials**
4. Ingresa tu **Client ID** y **Client Secret**
5. En la lista de la izquierda, selecciona todos los scopes necesarios
6. Click en **Authorize APIs**
7. Autoriza con tu cuenta
8. Click en **Exchange authorization code for tokens**
9. Copia el **Refresh token**

### **Paso 5: Configurar en el Servidor**

Agrega a tu archivo `.env`:

```env
# Google Workspace - OAuth2
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REFRESH_TOKEN=tu_refresh_token_aqui
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback

# Opcional: Email desde el cual enviar
EMAIL_FROM=noreply@tudominio.com
```

---

## 📚 APIs Disponibles

Una vez configurado, tendrás acceso a todas estas APIs:

### **Gmail API**
- ✅ Enviar emails
- ✅ Leer emails
- ✅ Listar emails
- ✅ Configurar webhooks

### **Google Drive API**
- ✅ Listar archivos
- ✅ Obtener archivos
- ✅ Crear archivos
- ✅ Subir/descargar archivos

### **Google Calendar API**
- ✅ Listar eventos
- ✅ Crear eventos
- ✅ Actualizar eventos
- ✅ Eliminar eventos

### **Google Sheets API**
- ✅ Leer datos de hojas
- ✅ Escribir datos en hojas
- ✅ Crear hojas nuevas
- ✅ Actualizar formato

### **Google Docs API**
- ✅ Obtener documentos
- ✅ Crear documentos
- ✅ Actualizar contenido

### **Admin SDK (Usuarios)**
- ✅ Listar usuarios del dominio
- ✅ Obtener información de usuario
- ✅ Crear usuarios
- ✅ Actualizar usuarios
- ✅ Eliminar usuarios

### **Admin SDK (Grupos)**
- ✅ Listar grupos
- ✅ Obtener información de grupo
- ✅ Listar miembros de grupo
- ✅ Agregar miembros a grupos
- ✅ Eliminar miembros de grupos

---

## 🔧 Variables de Entorno

### **Para Service Account:**
```env
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=admin@tudominio.com  # Opcional
GOOGLE_WORKSPACE_DOMAIN=tudominio.com  # Opcional
EMAIL_FROM=noreply@tudominio.com  # Opcional
```

### **Para OAuth2:**
```env
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REFRESH_TOKEN=tu_refresh_token
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
EMAIL_FROM=noreply@tudominio.com  # Opcional
```

---

## ✅ Verificación

### **Verificar Configuración**

1. Inicia el servidor:
   ```bash
   npm start
   ```

2. Visita el health check:
   ```
   http://localhost:3000/health-check
   ```

3. Deberías ver en la sección de Google Workspace:
   ```
   ✅ Google Workspace: Conectado como: tu-email@tudominio.com
   ```

### **Probar Conexión Manualmente**

Puedes crear un script de prueba:

```javascript
import { verificarConexionGoogle } from './src/services/google-workspace.js';
import dotenv from 'dotenv';

dotenv.config();

const env = {
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  // ... otras variables
};

const resultado = await verificarConexionGoogle(env);
console.log(resultado);
```

---

## 💡 Ejemplos de Uso

### **Enviar Email con Gmail API**

```javascript
import { enviarEmailGmail } from './src/services/google-workspace.js';

await enviarEmailGmail(
  env,
  'destinatario@ejemplo.com',
  'Asunto del email',
  'Texto del email',
  '<h1>HTML del email</h1>',
  'me' // o email específico si usas impersonación
);
```

### **Listar Archivos en Drive**

```javascript
import { listarArchivosDrive } from './src/services/google-workspace.js';

const archivos = await listarArchivosDrive(env, "mimeType='application/vnd.google-apps.spreadsheet'");
console.log(archivos);
```

### **Crear Evento en Calendar**

```javascript
import { crearEventoCalendar } from './src/services/google-workspace.js';

const evento = await crearEventoCalendar(
  env,
  'Reunión importante',
  'Descripción de la reunión',
  '2024-12-25T10:00:00',
  '2024-12-25T11:00:00'
);
```

### **Leer Datos de Sheets**

```javascript
import { leerDatosSheets } from './src/services/google-workspace.js';

const datos = await leerDatosSheets(
  env,
  'ID_DE_TU_HOJA',
  'A1:C10'
);
console.log(datos);
```

### **Listar Usuarios del Dominio**

```javascript
import { listarUsuariosAdmin } from './src/services/google-workspace.js';

const usuarios = await listarUsuariosAdmin(env, 'tudominio.com');
console.log(usuarios);
```

### **Agregar Miembro a Grupo**

```javascript
import { agregarMiembroGrupo } from './src/services/google-workspace.js';

await agregarMiembroGrupo(
  env,
  'grupo@tudominio.com',
  'usuario@tudominio.com',
  'MEMBER' // o 'OWNER', 'MANAGER'
);
```

---

## 🐛 Solución de Problemas

### **Error: "Google Workspace no está configurado"**

- Verifica que las variables de entorno estén en `.env`
- Asegúrate de que el archivo `.env` esté en la raíz del proyecto
- Reinicia el servidor después de cambiar `.env`

### **Error: "Invalid credentials"**

- Verifica que el JSON del Service Account sea válido
- Asegúrate de que el Service Account tenga los permisos necesarios
- Si usas OAuth2, verifica que el refresh token sea válido

### **Error: "Insufficient permissions"**

- Verifica que hayas habilitado todas las APIs necesarias
- Si usas Service Account, verifica Domain-Wide Delegation
- Verifica que los scopes estén correctamente configurados

### **Error: "User not found" (con impersonación)**

- Verifica que el email en `GOOGLE_SERVICE_ACCOUNT_IMPERSONATE` exista
- Asegúrate de que Domain-Wide Delegation esté habilitado
- Verifica que los scopes incluyan los necesarios para impersonación

---

## 📝 Notas Importantes

1. **Seguridad:**
   - ⚠️ **NUNCA** subas el archivo JSON del Service Account a Git
   - ⚠️ **NUNCA** compartas tus credenciales
   - ✅ Usa variables de entorno para todas las credenciales
   - ✅ Mantén el archivo `.env` en `.gitignore`

2. **Límites de API:**
   - Google tiene límites de rate limiting
   - Gmail API: 1 billón de cuotas por día (suficiente para la mayoría de casos)
   - Drive API: 1 billón de cuotas por día
   - Calendar API: 1 millón de cuotas por día
   - Admin SDK: 1.5 millones de cuotas por día

3. **Service Account vs OAuth2:**
   - **Service Account**: Mejor para automatizaciones y servicios backend
   - **OAuth2**: Mejor cuando necesitas acceso a cuentas de usuarios específicos

---

## 🎯 Resumen Rápido

1. ✅ Crea proyecto en Google Cloud Console
2. ✅ Habilita todas las APIs necesarias
3. ✅ Crea Service Account (recomendado) o OAuth2 credentials
4. ✅ Descarga/configura credenciales
5. ✅ Agrega variables a `.env`
6. ✅ Reinicia servidor
7. ✅ Verifica en `/health-check`

---

*Guía creada: $(date)*
*Versión: AuriPortal v3.1*



