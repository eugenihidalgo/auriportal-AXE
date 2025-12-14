# 🔧 Solución: Permisos de Google Drive para Service Account

## ⚠️ Error Actual

```
unauthorized_client: Client is unauthorized to retrieve access tokens using this method, 
or client not authorized for any of the scopes requested.
```

Este error indica que el Service Account necesita tener los scopes de Drive habilitados en Google Cloud Console.

## ✅ Solución: Habilitar Scopes de Drive API

### Opción 1: Usar Domain-Wide Delegation (Recomendado)

Si tienes Google Workspace, puedes usar Domain-Wide Delegation:

1. **Habilitar Domain-Wide Delegation en Google Cloud Console:**
   - Ve a: https://console.cloud.google.com/iam-admin/serviceaccounts
   - Selecciona tu proyecto
   - Encuentra el Service Account: `aurelin-portal@pde-aurelin-portal.iam.gserviceaccount.com`
   - Haz clic en "Editar" (icono de lápiz)
   - Activa "Habilitar delegación de todo el dominio de Google Workspace"
   - Guarda el **Client ID** del Service Account

2. **Configurar en Google Admin Console:**
   - Ve a: https://admin.google.com/
   - Seguridad > Controles de API > Gestión de delegación de todo el dominio
   - Haz clic en "Agregar nuevo"
   - Ingresa el **Client ID** del Service Account
   - Agrega estos scopes:
     ```
     https://www.googleapis.com/auth/drive
     https://www.googleapis.com/auth/drive.file
     https://www.googleapis.com/auth/gmail.send
     https://www.googleapis.com/auth/gmail.readonly
     ```
   - Guarda

3. **Configurar en `.env`:**
   ```env
   GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=tu-email@eugenihidalgo.org
   ```
   (El email del usuario de Google Workspace que tiene acceso a la carpeta)

### Opción 2: Habilitar Drive API en el Proyecto

1. **Habilitar Drive API:**
   - Ve a: https://console.cloud.google.com/apis/library/drive.googleapis.com
   - Selecciona tu proyecto
   - Haz clic en "Habilitar"

2. **Verificar permisos del Service Account:**
   - Ve a: https://console.cloud.google.com/iam-admin/iam
   - Busca el Service Account
   - Asegúrate de que tenga el rol "Editor" o "Service Account User"

### Opción 3: Usar OAuth2 en lugar de Service Account

Si Domain-Wide Delegation no está disponible, puedes usar OAuth2:

1. **Configurar OAuth2 en `.env`:**
   ```env
   GOOGLE_CLIENT_ID=tu_client_id
   GOOGLE_CLIENT_SECRET=tu_client_secret
   GOOGLE_REFRESH_TOKEN=tu_refresh_token
   ```

2. **Obtener Refresh Token:**
   - Usa el endpoint `/oauth/callback` o sigue la guía de OAuth2

## 🔍 Verificación Rápida

Para verificar qué método está usando el sistema, revisa tu `.env`:

- Si tienes `GOOGLE_SERVICE_ACCOUNT_KEY` → Usa Service Account
- Si tienes `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` → Usa OAuth2

## 📋 Pasos Inmediatos

1. **Habilitar Drive API en Google Cloud Console** (si no está habilitada)
2. **Compartir la carpeta** con el Service Account (ya hecho ✅)
3. **Configurar Domain-Wide Delegation** (si tienes Google Workspace)
4. **O usar OAuth2** (si no tienes Google Workspace)

## 🚀 Después de Configurar

Reinicia el servidor:
```bash
pm2 restart aurelinportal
```

Y ejecuta de nuevo:
```bash
npm run transcripcion:forzar-todos
```

