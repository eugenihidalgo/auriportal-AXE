# 🔐 Instrucciones para OAuth y Subida Automática

## Paso 1: Obtener Refresh Token

### Opción A: Usando el script automatizado

```bash
cd /var/www/aurelinportal/google-worker
node obtener-refresh-token.js
```

Esto te mostrará una URL. Ábrela en tu navegador y autoriza.

### Opción B: Manual

1. Abre esta URL en tu navegador (reemplaza con tus credenciales si cambian):

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=<GOOGLE_CLIENT_ID>&redirect_uri=<GOOGLE_REDIRECT_URI>&response_type=code&scope=https://www.googleapis.com/auth/script.projects&access_type=offline&prompt=consent
```

> **⚠️ IMPORTANTE:** Reemplaza `<GOOGLE_CLIENT_ID>` y `<GOOGLE_REDIRECT_URI>` con tus valores reales desde Google Cloud Console.

2. Autoriza la aplicación
3. Serás redirigido a tu servidor: `https://pdeeugenihidalgo.org/oauth/callback?code=CODIGO_AQUI&scope=...`
4. Copia el código de la URL (el valor del parámetro `code`)
5. Ejecuta:

```bash
node obtener-refresh-token.js CODIGO_AQUI
```

6. Añade el refresh_token a tu `.env`:

```env
GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=tu_refresh_token_aqui
```

## Paso 2: Habilitar Google Apps Script API

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Selecciona tu proyecto (el que tiene las credenciales OAuth)
3. Ve a "APIs & Services" → "Library"
4. Busca "Google Apps Script API"
5. Haz clic en "Enable"

## Paso 3: Subir Archivos

Una vez tengas el refresh_token configurado:

```bash
cd /var/www/aurelinportal/google-worker

# Para crear un nuevo proyecto:
node subir-archivos.js

# Para actualizar un proyecto existente:
node subir-archivos.js SCRIPT_ID_AQUI
```

El script:
- ✅ Encontrará todos los archivos `.gs`
- ✅ Los subirá a Google Apps Script
- ✅ Creará el proyecto si no existe
- ✅ Te dará la URL del proyecto

## ✅ Verificación

Después de subir, verifica:

1. Abre la URL del proyecto en Apps Script
2. Verifica que todos los archivos estén presentes
3. Configura `SCRIPT_SECRET` en Script Properties
4. Despliega como Web App

## 🔧 Troubleshooting

### Error: "invalid_grant"
- El refresh_token expiró o es inválido
- Obtén uno nuevo con `obtener-refresh-token.js`

### Error: "API not enabled"
- Habilita Google Apps Script API en Google Cloud Console

### Error: "Permission denied"
- Verifica que el refresh_token tenga los scopes correctos
- Autoriza de nuevo con `prompt=consent`















