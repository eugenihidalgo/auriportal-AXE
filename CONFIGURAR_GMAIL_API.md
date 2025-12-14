# 📧 Configuració Gmail API

## ✅ Canvis Realitzats

He actualitzat el sistema per usar **Gmail API** amb Google Workspace en lloc de SMTP.

## 🔧 Configuració Necessària

### Variables al `.env`

Les següents variables ja estan configurades:
- ✅ `GOOGLE_SERVICE_ACCOUNT_KEY` - Clau del Service Account
- ✅ `GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=eugeni@eugenihidalgo.org` - Email per enviar

## ⚙️ Permisos Necessaris al Service Account

Assegura't que el Service Account té permisos per:

1. **Impersonar l'usuari** `eugeni@eugenihidalgo.org`:
   - Anar a Google Admin Console
   - Security → API Controls → Domain-wide Delegation
   - Afegir el Client ID del Service Account
   - Scopes necessaris:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail`

2. **Habilitar Gmail API**:
   - Anar a Google Cloud Console
   - APIs & Services → Enable APIs
   - Habilitar "Gmail API"

## 🧪 Provar Enviament

Per provar l'enviament d'emails, utilitza el servei de Google Workspace directament des del teu codi.

## 📝 Avantatges de Gmail API

- ✅ **No cal contrasenyes d'aplicació** - Usa Service Account
- ✅ **Millor seguretat** - Autenticació amb claus
- ✅ **No cal configurar SPF/DKIM** - Google ho gestiona
- ✅ **Millor reputació** - Menys risc de spam
- ✅ **API completa** - Pots gestionar emails, llegir, etc.

## 🔍 Verificar Configuració

Per verificar que tot està configurat correctament:

```bash
cd /var/www/aurelinportal
node -e "
import('./src/services/google-workspace.js').then(async (m) => {
  const env = {
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE
  };
  const result = await m.verificarConexionGoogle(env);
  console.log(result);
});
"
```

---

**Ara el sistema usa Gmail API amb Google Workspace!** 🎉



