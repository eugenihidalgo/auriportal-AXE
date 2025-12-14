# 🔐 Guía de Configuración de Tokens y APIs

Esta guía te ayudará a obtener y configurar todos los tokens necesarios para AuriPortal.

## 📋 Índice

1. [ClickUp](#clickup)
2. [Kajabi](#kajabi)
3. [Typeform](#typeform)
4. [Cloudflare](#cloudflare)
5. [Google Workspace](#google-workspace)
6. [Verificación](#verificación)

---

## 🔵 ClickUp

### Cómo obtener el token:

1. Inicia sesión en [ClickUp](https://app.clickup.com)
2. Ve a **Settings** (Configuración) → **Apps** → **API**
3. Haz clic en **Generate** para crear un nuevo token
4. Copia el token (debe empezar con `pk_`)
5. Agrega el token a tu archivo `.env`:
   ```env
   CLICKUP_API_TOKEN=pk_tu_token_aqui
   ```

### Permisos necesarios:
- Read tasks
- Write tasks
- Read custom fields
- Write custom fields

### Verificación:
El token debe tener acceso a la lista con ID `901214375878` (Lista PDE – Aurelín)

---

## 🟣 Kajabi

### Cómo obtener las credenciales:

1. Inicia sesión en [Kajabi](https://kajabi.com)
2. Ve a **Settings** → **API**
3. Crea una nueva aplicación OAuth
4. Obtendrás:
   - **Client ID**
   - **Client Secret**
5. Agrega las credenciales a tu archivo `.env`:
   ```env
   KAJABI_CLIENT_ID=tu_client_id
   KAJABI_CLIENT_SECRET=tu_client_secret
   ```

### Permisos necesarios:
- Read contacts
- Read customers
- Read offers
- Read purchases

### Verificación:
Las credenciales deben tener acceso al sitio "Plataforma de desarrollo espiritual Eugeni Hidalgo"

---

## 🟢 Typeform

### Cómo obtener el token:

1. Inicia sesión en [Typeform](https://admin.typeform.com)
2. Ve a **Account** → **Personal tokens**
3. Haz clic en **Generate a new token**
4. Asigna un nombre al token (ej: "AuriPortal Webhook")
5. Copia el token generado
6. Agrega el token a tu archivo `.env`:
   ```env
   TYPEFORM_API_TOKEN=tu_token_aqui
   ```

**Nota:** Este token es opcional pero recomendado para operaciones avanzadas con webhooks.

### Verificación:
El token debe tener acceso al formulario con ID `GR5IErrl` (Onboarding)

---

## ☁️ Cloudflare

Cloudflare es opcional y se usa principalmente para gestión de DNS y CDN.

### Opción 1: API Token (Recomendado)

1. Inicia sesión en [Cloudflare](https://dash.cloudflare.com)
2. Ve a **My Profile** → **API Tokens**
3. Haz clic en **Create Token**
4. Usa el template "Edit zone DNS" o crea uno personalizado con:
   - **Permissions:**
     - Zone → DNS → Edit
     - Zone → Zone → Read
   - **Zone Resources:** Include → Specific zone → (tu dominio)
5. Copia el token generado
6. Agrega el token a tu archivo `.env`:
   ```env
   CLOUDFLARE_API_TOKEN=tu_api_token_aqui
   ```

### Opción 2: Email + API Key (Alternativa)

1. Inicia sesión en [Cloudflare](https://dash.cloudflare.com)
2. Ve a **My Profile** → **API Tokens**
3. En la sección "API Keys", copia tu **Global API Key**
4. Agrega las credenciales a tu archivo `.env`:
   ```env
   CLOUDFLARE_EMAIL=tu_email@ejemplo.com
   CLOUDFLARE_API_KEY=tu_global_api_key_aqui
   ```

**Nota:** La opción 1 (API Token) es más segura porque permite permisos granulares.

---

## 🔴 Google Workspace

Google Workspace permite acceso a múltiples APIs: Gmail, Drive, Calendar, Sheets, Docs, Admin SDK, etc.

### Opción 1: Service Account (Recomendado para Servidores) ⭐

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Habilita las APIs necesarias:
   - Gmail API
   - Google Drive API
   - Google Calendar API
   - Google Sheets API
   - Google Docs API
   - Admin SDK API
4. Ve a **APIs & Services** → **Credentials**
5. Click en **+ CREATE CREDENTIALS** → **Service Account**
6. Completa el formulario y crea el Service Account
7. Ve a la pestaña **KEYS** → **ADD KEY** → **Create new key** → **JSON**
8. Descarga el archivo JSON
9. Copia el contenido completo del JSON y agrégalo a tu archivo `.env`:
   ```env
   GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
   ```

**Opcional - Domain-Wide Delegation:**
Si quieres impersonar usuarios del dominio:
1. Habilita Domain-Wide Delegation en el Service Account
2. Anota el Client ID
3. Ve a [Google Admin Console](https://admin.google.com/)
4. **Security** → **API Controls** → **Domain-wide Delegation**
5. Agrega el Client ID con los scopes necesarios
6. Agrega a `.env`:
   ```env
   GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=admin@tudominio.com
   ```

### Opción 2: OAuth2 (Para Aplicaciones con Usuarios)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Habilita las APIs necesarias (igual que arriba)
4. Ve a **APIs & Services** → **Credentials**
5. Click en **+ CREATE CREDENTIALS** → **OAuth client ID**
6. Configura OAuth consent screen si es necesario
7. Crea credenciales tipo **Web application**
8. Agrega redirect URI: `http://localhost:3000/oauth/callback`
9. Copia **Client ID** y **Client Secret**
10. Obtén un refresh token (ver guía completa más abajo)
11. Agrega a tu archivo `.env`:
    ```env
    GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
    GOOGLE_CLIENT_SECRET=tu_client_secret
    GOOGLE_REFRESH_TOKEN=tu_refresh_token
    GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
    ```

**Nota:** Para una guía completa y detallada, consulta [CONFIGURAR_GOOGLE_WORKSPACE.md](./CONFIGURAR_GOOGLE_WORKSPACE.md)

### APIs Disponibles:
- ✅ Gmail API (enviar/leer emails)
- ✅ Google Drive API (archivos)
- ✅ Google Calendar API (eventos)
- ✅ Google Sheets API (hojas de cálculo)
- ✅ Google Docs API (documentos)
- ✅ Admin SDK (usuarios y grupos del dominio)

### Verificación:
El servicio se verifica automáticamente en `/health-check`. Deberías ver:
```
✅ Google Workspace: Conectado como: tu-email@tudominio.com
```

---

## ✅ Verificación

### Verificación Automática al Iniciar

El servidor valida automáticamente la configuración al iniciar y muestra:
- ✅ Configuración válida
- ❌ Errores de configuración
- ⚠️ Advertencias

### Panel de Verificación Web

Visita cualquiera de estos endpoints:

- `http://localhost:3000/health-check`
- `http://localhost:3000/health`
- `http://localhost:3000/status`

Para probar la conectividad con las APIs, agrega `?test=true`:
- `http://localhost:3000/health-check?test=true`

El panel muestra:
- Estado de cada variable de entorno
- Errores y advertencias
- Resultados de pruebas de conectividad con cada API

---

## 🔒 Seguridad

### Buenas Prácticas:

1. **Nunca commits el archivo `.env`** - Ya está en `.gitignore`
2. **Usa valores diferentes** en desarrollo y producción
3. **Rota los tokens periódicamente** (especialmente si sospechas que fueron comprometidos)
4. **Usa permisos mínimos necesarios** en cada servicio
5. **Guarda los tokens de forma segura** (gestor de contraseñas, variables de entorno del servidor)

### Generar Cookie Secret:

Para generar un `COOKIE_SECRET` seguro:

```bash
openssl rand -hex 32
```

O usando Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🆘 Solución de Problemas

### Error: "CLICKUP_API_TOKEN no está configurado"
- Verifica que el archivo `.env` existe en la raíz del proyecto
- Verifica que la variable esté escrita correctamente (sin espacios)
- Reinicia el servidor después de modificar `.env`

### Error: "Kajabi OAuth error: 401"
- Verifica que `KAJABI_CLIENT_ID` y `KAJABI_CLIENT_SECRET` sean correctos
- Asegúrate de que las credenciales no hayan expirado
- Verifica que la aplicación OAuth esté activa en Kajabi

### Error: "ClickUp fetch failed: 401"
- Verifica que el token de ClickUp sea válido
- Asegúrate de que el token tenga los permisos necesarios
- Verifica que el token no haya expirado

### El panel de health-check muestra "not_configured"
- Esto es normal para servicios opcionales (Typeform, Cloudflare)
- Para servicios requeridos (ClickUp, Kajabi), verifica que las variables estén en `.env`

---

## 📝 Checklist de Configuración

Antes de poner en producción, verifica:

- [ ] `CLICKUP_API_TOKEN` configurado y funcionando
- [ ] `KAJABI_CLIENT_ID` configurado
- [ ] `KAJABI_CLIENT_SECRET` configurado
- [ ] `COOKIE_SECRET` configurado (no el valor por defecto)
- [ ] `TYPEFORM_API_TOKEN` configurado (si usas webhooks)
- [ ] `CLOUDFLARE_API_TOKEN` o credenciales configuradas (si usas Cloudflare)
- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY` o credenciales OAuth2 configuradas (si usas Google Workspace)
- [ ] Panel `/health-check` muestra todo en verde
- [ ] Pruebas de conectividad (`?test=true`) exitosas

---

---

## 🔒 Gestión de Secretos y Variables de Entorno

### Archivo .env.example

El proyecto incluye un archivo `.env.example` con todas las variables de entorno necesarias usando placeholders seguros. Este archivo es seguro para versionar en Git.

**Para configurar tu entorno:**

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Edita `.env` con tus valores reales:
   ```bash
   nano .env
   ```

3. **IMPORTANTE:** El archivo `.env` está en `.gitignore` y NO debe committearse nunca.

### Protección contra Fugas de Secretos

El proyecto incluye un script de detección de secretos que escanea el repositorio en busca de valores sensibles:

```bash
# Ejecutar detección de secretos
node scripts/detectar-secretos.js
```

**El script detecta:**
- Tokens de APIs (ClickUp, Cloudflare, etc.)
- Secrets hexadecimales largos
- Passwords en variables de entorno
- URLs con tokens en query params
- Database URLs con passwords
- Y otros patrones comunes de secretos

**Recomendaciones:**
- Ejecuta el script antes de cada commit
- Reemplaza valores reales con placeholders (`<VARIABLE_NAME>`) en documentación
- Nunca incluyas valores reales en archivos `.md` o código
- Usa el archivo `.env` del servidor para valores reales

### Buenas Prácticas de Seguridad

1. **Separación de Entornos:**
   - Usa valores diferentes para desarrollo, beta y producción
   - Los archivos `env.dev.example` y `env.beta.example` están disponibles como referencia

2. **Rotación de Tokens:**
   - Rota los tokens periódicamente
   - Especialmente si sospechas que fueron comprometidos

3. **Permisos Mínimos:**
   - Usa permisos mínimos necesarios en cada servicio
   - No uses tokens con permisos de administrador si no es necesario

4. **Almacenamiento Seguro:**
   - Guarda los tokens en un gestor de contraseñas
   - No compartas tokens por email o chat
   - Usa variables de entorno del servidor en producción

5. **Verificación Regular:**
   - Ejecuta `node scripts/detectar-secretos.js` regularmente
   - Revisa el historial de Git antes de hacer push público
   - Usa herramientas como `git-secrets` o `truffleHog` para auditorías profundas

---

## 📞 Soporte

Si tienes problemas configurando los tokens:

1. Revisa el panel `/health-check` para ver errores específicos
2. Verifica los logs del servidor al iniciar
3. Consulta la documentación oficial de cada servicio:
   - [ClickUp API Docs](https://clickup.com/api)
   - [Kajabi API Docs](https://kajabi.com/api)
   - [Typeform API Docs](https://developer.typeform.com/)
   - [Cloudflare API Docs](https://developers.cloudflare.com/api/)
   - [Google Workspace API Docs](https://developers.google.com/workspace)
   - [Guía Completa Google Workspace](./CONFIGURAR_GOOGLE_WORKSPACE.md)







