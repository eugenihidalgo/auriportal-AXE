# 🔐 Configurar Domain-Wide Delegation - Pas a Pas

## ❌ Error Actual

`unauthorized_client: Client is unauthorized to retrieve access tokens`

Això significa que cal configurar **Domain-Wide Delegation** a Google Admin Console.

## ✅ Pas a Pas

### Pas 1: Obtenir Client ID del Service Account

El teu Client ID és: **`115320164248532519199`**

(Pots verificar-lo a: Google Cloud Console → IAM & Admin → Service Accounts → `aurelin-portal@pde-aurelin-portal.iam.gserviceaccount.com`)

### Pas 2: Anar a Google Admin Console

1. Anar a: **https://admin.google.com/**
2. Iniciar sessió com a **administrador** de Google Workspace
3. Assegurar-te que tens permisos d'administrador

### Pas 3: Configurar Domain-Wide Delegation

1. A Google Admin Console, anar a:
   - **Security** (Seguretat)
   - **API Controls** (Controls d'API)
   - **Domain-wide Delegation** (Delegació a nivell de domini)

2. Clicar **Add new** (Afegir nou)

3. Omplir el formulari:
   - **Client ID**: `115320164248532519199`
   - **OAuth Scopes** (afegir un per línia):
     ```
     https://www.googleapis.com/auth/gmail.send
     https://www.googleapis.com/auth/gmail.readonly
     ```

4. Clicar **Authorize** (Autoritzar)

### Pas 4: Verificar que Gmail API està Habilitada

1. Anar a: **https://console.cloud.google.com/**
2. Seleccionar projecte: **`pde-aurelin-portal`**
3. Anar a **APIs & Services** → **Library**
4. Buscar **"Gmail API"**
5. Assegurar-te que està **Enabled** (Habilitada)
6. Si no ho està, clicar **Enable**

### Pas 5: Esperar Propagació

Després de configurar Domain-Wide Delegation, espera **5-10 minuts** perquè es propagui.

### Pas 6: Provar

```bash
cd /var/www/aurelinportal
node scripts/enviar-email-prova.js
```

## 📝 Resum de Configuració Necessària

### A Google Admin Console:
- ✅ **Security** → **API Controls** → **Domain-wide Delegation**
- ✅ **Client ID**: `115320164248532519199`
- ✅ **Scopes**:
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/gmail.readonly`

### A Google Cloud Console:
- ✅ **Gmail API** habilitada al projecte `pde-aurelin-portal`

### Al .env:
- ✅ `GOOGLE_SERVICE_ACCOUNT_KEY` configurat
- ✅ `GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=eugeni@eugenihidalgo.org`

---

**Després de configurar Domain-Wide Delegation i esperar 5-10 minuts, hauria de funcionar!** 🚀



