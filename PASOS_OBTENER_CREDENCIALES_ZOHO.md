# 🔐 Passos per Obtenir Credencials de Zoho API

## 📋 Pas 1: Crear Aplicació a Zoho API Console

### 1.1 Triar Tipus de Client

A la pantalla que veus, clica **"CREATE NOW"** a la targeta:

**"Server-based Applications"** (la segona, amb icona blava de globus)

> ✅ Aquesta és la correcta perquè executem el codi des del servidor Node.js

### 1.2 Configurar l'Aplicació

Després de clicar, omple el formulari:

- **Client Name**: `AurelinPortal Email`
- **Homepage URL**: `https://pdeeugenihidalgo.org` (o la teva URL)
- **Authorized Redirect URIs**: 
  - `http://localhost:3001/oauth/callback` (per obtenir el token)
  - `https://pdeeugenihidalgo.org/oauth/callback` (opcional)

### 1.3 Copiar Credencials

Després de crear, copia:
- **Client ID**
- **Client Secret**

Afegeix-les al `.env`:
```env
ZOHO_CLIENT_ID=el_client_id_que_has_copiat
ZOHO_CLIENT_SECRET=el_client_secret_que_has_copiat
```

---

## 📋 Pas 2: Obtenir Refresh Token

### Opció A: Usar Script Helper (Recomanat)

1. Assegura't que tens `ZOHO_CLIENT_ID` i `ZOHO_CLIENT_SECRET` al `.env`

2. Executar script:
```bash
cd /var/www/aurelinportal
node scripts/obtener-zoho-refresh-token.js
```

3. El script et mostrarà una URL. Obre-la al navegador

4. Autoritza l'aplicació

5. El script obtindrà automàticament el refresh token

### Opció B: Manual

1. Generar URL d'autorització:
```
https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ,ZohoMail.users.CREATE,ZohoMail.domains.READ,ZohoMail.domains.CREATE&client_id=TU_CLIENT_ID&response_type=code&access_type=offline&redirect_uri=http://localhost:3001/oauth/callback
```

2. Obrir la URL al navegador i autoritzar

3. Copiar el `code` de la URL de redirecció

4. Intercanviar code per refresh token:
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=TU_CLIENT_ID" \
  -d "client_secret=TU_CLIENT_SECRET" \
  -d "redirect_uri=http://localhost:3001/oauth/callback" \
  -d "code=EL_CODE_OBTINGUT"
```

5. Copiar el `refresh_token` de la resposta

---

## 📋 Pas 3: Obtenir Account ID

1. Iniciar sessió a Zoho Mail: https://mail.zoho.com/

2. Anar a **Settings** → **Mail Admin** → **Organization**

3. Copiar el **Organization ID** (aquest és l'Account ID)

Afegeix-lo al `.env`:
```env
ZOHO_ACCOUNT_ID=el_organization_id
```

---

## 📋 Pas 4: Obtenir Cloudflare API Token

1. Anar a: https://dash.cloudflare.com/profile/api-tokens

2. Clicar **Create Token**

3. Usar template **Edit zone DNS**

4. Seleccionar els dominis:
   - `vegasquestfantasticworld.win`
   - `eugenihidalgo.org`

5. Copiar el token generat

Afegeix-lo al `.env`:
```env
CLOUDFLARE_API_TOKEN=el_token_generat
```

---

## ✅ Verificar Configuració

Després d'afegir totes les credencials al `.env`, verifica:

```bash
cd /var/www/aurelinportal
cat .env | grep -E "(ZOHO_|CLOUDFLARE_)"
```

Hauries de veure:
- `ZOHO_CLIENT_ID=...`
- `ZOHO_CLIENT_SECRET=...`
- `ZOHO_REFRESH_TOKEN=...`
- `ZOHO_ACCOUNT_ID=...`
- `CLOUDFLARE_API_TOKEN=...`

---

## 🚀 Executar Configuració Automàtica

Un cop tens totes les credencials:

```bash
cd /var/www/aurelinportal
node scripts/configurar-zoho-completo-api.js
```

El script farà tot automàticament! 🎉

---

**Recorda**: Tria **"Server-based Applications"** a la consola d'API de Zoho! ✅






