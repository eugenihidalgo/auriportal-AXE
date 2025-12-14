# 🔐 Configurar Domain-Wide Delegation per Gmail API

## ❌ Error Actual

L'error `invalid_scope: https://www.googleapis.com/auth/gmail is not a valid audience string` indica que cal configurar **Domain-Wide Delegation** a Google Admin Console.

## ✅ Solució: Configurar Domain-Wide Delegation

### Pas 1: Obtenir Client ID del Service Account

El Client ID del teu Service Account és: `115320164248532519199`

(Pots trobar-lo també a: Google Cloud Console → IAM & Admin → Service Accounts → El teu Service Account)

### Pas 2: Configurar a Google Admin Console

1. Anar a: **https://admin.google.com/**
2. Iniciar sessió com a administrador de Google Workspace
3. Anar a **Security** → **API Controls** → **Domain-wide Delegation**
4. Clicar **Add new**
5. Configurar:
   - **Client ID**: `115320164248532519199`
   - **OAuth Scopes** (afegir un per línia):
     ```
     https://www.googleapis.com/auth/gmail.send
     https://www.googleapis.com/auth/gmail.readonly
     ```
6. Clicar **Authorize**

### Pas 3: Verificar que Gmail API està Habilitada

1. Anar a: **https://console.cloud.google.com/**
2. Seleccionar el projecte: `pde-aurelin-portal`
3. Anar a **APIs & Services** → **Library**
4. Buscar "Gmail API"
5. Assegurar-te que està **Enabled**

### Pas 4: Provar de Nou

Després de configurar Domain-Wide Delegation:

```bash
cd /var/www/aurelinportal
# Usa el servicio de Google Workspace desde tu código
```

## 📝 Resum de Configuració

### A Google Admin Console:
- ✅ Domain-Wide Delegation configurat
- ✅ Client ID: `115320164248532519199`
- ✅ Scopes: `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/gmail.readonly`

### Al .env:
- ✅ `GOOGLE_SERVICE_ACCOUNT_KEY` configurat
- ✅ `GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=eugeni@eugenihidalgo.org`

### A Google Cloud Console:
- ✅ Gmail API habilitada

---

**Després de configurar Domain-Wide Delegation, hauria de funcionar!** 🚀



