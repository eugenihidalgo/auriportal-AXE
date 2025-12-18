# 🔧 Solución al Error 403: access_denied

## Problema

Tu dominio `pdeeugenihidalgo.org` no está verificado en Google Cloud Console, por lo que OAuth bloquea el acceso.

## ✅ Solución Rápida: Usar localhost

### Paso 1: Actualizar Redirect URI en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Selecciona tu proyecto
3. Ve a **APIs & Services** → **Credentials**
4. Haz clic en tu OAuth Client ID (el que empieza con `<GOOGLE_CLIENT_ID>`)
5. En **Authorized redirect URIs**, añade:
   ```
   http://localhost:8080/oauth/callback
   ```
6. Haz clic en **Save**

### Paso 2: Obtener el Token con Script Local

Ejecuta el script que crea un servidor local temporal:

```bash
cd /var/www/aurelinportal/google-worker
node obtener-token-local.js
```

Esto:
- ✅ Abre un servidor en `localhost:8080`
- ✅ Te muestra una URL para autorizar
- ✅ Recibe el código automáticamente
- ✅ Obtiene el refresh_token
- ✅ Te muestra qué añadir a `.env`

### Paso 3: Añadir Token a .env

Añade el refresh_token a tu `.env`:

```env
GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=el_token_que_te_muestre
```

### Paso 4: Subir Archivos

```bash
node subir-archivos.js
```

---

## 🔄 Alternativa: Configurar Pantalla de Consentimiento

Si prefieres usar tu dominio de producción:

### Opción A: Añadir Email como Tester

1. Ve a **APIs & Services** → **OAuth consent screen**
2. Desplázate a **Test users**
3. Haz clic en **+ ADD USERS**
4. Añade: `bennascut@eugenihidalgo.org`
5. Haz clic en **ADD**

Luego puedes usar:
```bash
node obtener-refresh-token.js
```
Con el redirect URI de producción.

### Opción B: Cambiar a Tipo Interno (si es solo para tu organización)

1. Ve a **OAuth consent screen**
2. En **User Type**, selecciona **Internal**
3. Guarda
4. Solo usuarios de tu organización Google Workspace podrán acceder

---

## 📝 Resumen de Scripts

- **`obtener-token-local.js`** - Obtiene token usando localhost (recomendado para empezar)
- **`obtener-refresh-token.js`** - Obtiene token usando el servidor de producción
- **`subir-archivos.js`** - Sube todos los archivos .gs a Apps Script

---

## ⚠️ Nota Importante

Si usas `localhost` para obtener el token, eso está bien. Una vez tengas el refresh_token, funcionará desde cualquier lugar, incluso desde tu servidor de producción.

El redirect_uri solo se usa durante la obtención inicial del token. Una vez tienes el refresh_token, ya no necesitas el redirect_uri para las operaciones normales.















