# 🔐 Cómo Obtener el Refresh Token

## ✅ Solución Automática (Recomendada)

Ahora el endpoint `/oauth/callback` detecta automáticamente si es una llamada de Apps Script y lo maneja correctamente.

### Pasos:

1. **Actualiza el Redirect URI en Google Cloud Console** (si no lo has hecho):
   - Ve a [Credentials](https://console.cloud.google.com/apis/credentials)
   - Edita tu OAuth Client ID
   - Añade: `https://pdeeugenihidalgo.org/oauth/callback`
   - Guarda

2. **Obtén la URL de autorización:**

```bash
cd /var/www/aurelinportal/google-worker
node obtener-refresh-token.js
```

Esto te mostrará una URL. Ábrela en tu navegador.

3. **Autoriza la aplicación**

4. **Serás redirigido automáticamente** a tu servidor y verás el refresh_token en la página

5. **Copia el refresh_token** y añádelo a tu `.env`:

```env
GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=el_token_que_te_muestre
```

6. **Sube los archivos:**

```bash
node subir-archivos.js
```

---

## 🔄 Alternativa: Script Local

Si prefieres evitar problemas con el dominio:

```bash
cd /var/www/aurelinportal/google-worker
node obtener-token-local.js
```

Este script abre un servidor local temporal en `localhost:8080`.

**IMPORTANTE:** Necesitas añadir `http://localhost:8080/oauth/callback` a los Redirect URIs en Google Cloud Console.

---

## ⚠️ Si el Código Expira

Los códigos OAuth de Google expiran en minutos. Si ves un error `invalid_grant`, simplemente:

1. Obtén una nueva URL de autorización
2. Autoriza de nuevo
3. El código se procesará automáticamente

---

## 📝 Nota

El endpoint `/oauth/callback` ahora detecta automáticamente si la autorización es para:
- **Apps Script API** (scope: `script.projects`) → Muestra el refresh_token para Apps Script
- **Gmail API** (otros scopes) → Muestra el refresh_token para Gmail

No necesitas hacer nada especial, funciona automáticamente.


















