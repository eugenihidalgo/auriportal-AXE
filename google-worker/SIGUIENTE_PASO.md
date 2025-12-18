# ✅ Siguiente Paso - Obtener Refresh Token

## 🎯 Estado Actual

✅ Credenciales actualizadas en todos los archivos  
✅ Servidor reiniciado  
✅ Endpoints configurados  

## 📋 Pasos para Completar

### Paso 1: Abre esta URL en tu navegador:

```
https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fscript.projects&prompt=consent&response_type=code&client_id=<GOOGLE_CLIENT_ID>&redirect_uri=<GOOGLE_REDIRECT_URI>
```

> **⚠️ IMPORTANTE:** Reemplaza `<GOOGLE_CLIENT_ID>` y `<GOOGLE_REDIRECT_URI>` con tus valores reales desde Google Cloud Console.

### Paso 2: Autoriza la aplicación

Cuando Google te lo solicite, haz clic en "Permitir"

### Paso 3: Copia el Refresh Token

Serás redirigido a tu servidor y verás una página mostrando el `refresh_token`. Cópialo.

### Paso 4: Ejecuta el script de setup

```bash
cd /var/www/aurelinportal/google-worker
./completar-setup.sh
```

El script te pedirá el refresh_token, lo añadirá al `.env` y subirá todos los archivos a Google Apps Script automáticamente.

---

## 🔄 Alternativa Manual

Si prefieres hacerlo manualmente:

1. Añade el token a `.env`:
   ```bash
   echo "GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=tu_token_aqui" >> /var/www/aurelinportal/.env
   ```

2. Sube los archivos:
   ```bash
   cd /var/www/aurelinportal/google-worker
   node subir-archivos.js
   ```

---

**¡Una vez tengas el token, todo el resto es automático!** 🚀















