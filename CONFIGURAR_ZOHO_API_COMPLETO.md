# 🚀 Configuració Completa Zoho Mail via API

Aquest script automatitza **tot** el procés de configuració de Zoho Mail i DNS via APIs.

## 📋 Requisits

### 1. Credencials de Zoho API

Necessites crear una aplicació a Zoho per obtenir:

1. **Anar a**: https://api-console.zoho.com/
2. **Clicar**: "Add Client"
3. **Seleccionar**: "Server-based Applications"
4. **Configurar**:
   - **Client Name**: AurelinPortal Email
   - **Homepage URL**: https://pdeeugenihidalgo.org
   - **Authorized Redirect URIs**: https://pdeeugenihidalgo.org/oauth/callback
5. **Copiar**: Client ID i Client Secret

### 2. Obtenir Refresh Token

Per obtenir el refresh token, cal fer OAuth2:

1. **Generar URL d'autorització**:
   ```
   https://accounts.zoho.com/oauth/v2/auth?scope=ZohoMail.messages.CREATE,ZohoMail.accounts.READ,ZohoMail.users.CREATE,ZohoMail.domains.READ,ZohoMail.domains.CREATE&client_id=TU_CLIENT_ID&response_type=code&access_type=offline&redirect_uri=https://pdeeugenihidalgo.org/oauth/callback
   ```

2. **Obrir la URL** al navegador i autoritzar
3. **Copiar el code** de la URL de redirecció
4. **Intercanviar code per refresh token**:
   ```bash
   curl -X POST https://accounts.zoho.com/oauth/v2/token \
     -d "grant_type=authorization_code" \
     -d "client_id=TU_CLIENT_ID" \
     -d "client_secret=TU_CLIENT_SECRET" \
     -d "redirect_uri=https://pdeeugenihidalgo.org/oauth/callback" \
     -d "code=EL_CODE_OBTINGUT"
   ```

5. **Copiar el `refresh_token`** de la resposta

### 3. Obtenir Account ID de Zoho

1. Iniciar sessió a Zoho Mail
2. Anar a **Settings** → **Mail Admin** → **Organization**
3. Copiar el **Organization ID** (aquest és l'Account ID)

### 4. Credencial de Cloudflare API

1. Anar a: https://dash.cloudflare.com/profile/api-tokens
2. Clicar **Create Token**
3. Usar template **Edit zone DNS**
4. Seleccionar els dominis: `vegasquestfantasticworld.win` i `eugenihidalgo.org`
5. Copiar el token generat

---

## ⚙️ Configurar al Servidor

Afegir al `.env`:

```env
# Zoho API
ZOHO_CLIENT_ID=tu_client_id
ZOHO_CLIENT_SECRET=tu_client_secret
ZOHO_REFRESH_TOKEN=tu_refresh_token
ZOHO_ACCOUNT_ID=tu_account_id

# Cloudflare API
CLOUDFLARE_API_TOKEN=tu_cloudflare_token

# Contrasenyes per als emails (opcional, es generaran automàticament)
ZOHO_MASTER_PASSWORD=PasswordSegur123!
ZOHO_EUGENI_PASSWORD=PasswordSegur123!
ZOHO_ELCALOR_PASSWORD=PasswordSegur123!
ZOHO_BENNASCUT_PASSWORD=PasswordSegur123!
```

---

## 🚀 Executar Script

```bash
cd /var/www/aurelinportal
node scripts/configurar-zoho-completo-api.js
```

El script farà:

1. ✅ Afegir dominis a Zoho Mail
2. ✅ Obtenir registres de verificació
3. ⏸️  Esperar que afegeixis registres TXT a Cloudflare
4. ✅ Verificar dominis
5. ✅ Obtenir claus DKIM
6. ✅ Configurar DNS a Cloudflare (MX, SPF, DKIM, DMARC)
7. ✅ Crear tots els emails

---

## 📝 Passos Manuals Necessaris

Després d'executar el script, hauràs de:

1. **Afegeix els registres TXT de verificació** que et mostrarà el script a Cloudflare
2. **Esperar 5-15 minuts** per la propagació
3. **Tornar a executar el script** o continuar manualment

---

## 🔧 Script Alternatiu (Semi-Automàtic)

Si prefereixes fer alguns passos manualment, pots usar:

```bash
# Només configurar DNS (després d'haver creat dominis i emails a Zoho)
node -e "
import('./src/services/cloudflare-dns.js').then(async (m) => {
  const dkim = { name: 'zmail._domainkey', value: 'CLAU_DKIM_DE_ZOHO' };
  await m.configurarDNSCompleto('eugenihidalgo.org', dkim, 'eugeni@eugenihidalgo.org');
  await m.configurarDNSCompleto('vegasquestfantasticworld.win', dkim, 'master@vegasquestfantasticworld.win');
});
"
```

---

## ✅ Verificació

Després de configurar:

```bash
# Verificar DNS
dig MX eugenihidalgo.org +short
dig TXT eugenihidalgo.org +short | grep spf

# Provar enviament
cd /var/www/aurelinportal
# Usa el servicio de email desde tu código
```

---

**Amb aquest script, tot es configura automàticament via APIs!** 🎉






