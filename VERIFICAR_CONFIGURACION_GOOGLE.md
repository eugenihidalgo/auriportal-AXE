# ✅ Verificar Configuració de Google Workspace

## 🔍 Verificació Ràpida

### 1. Verificar que Domain-Wide Delegation està Configurat

1. Anar a: **https://admin.google.com/**
2. **Security** → **API Controls** → **Domain-wide Delegation**
3. Buscar el Client ID: **`115320164248532519199`**
4. Verificar que està llistat i té els scopes correctes

### 2. Verificar que Gmail API està Habilitada

1. Anar a: **https://console.cloud.google.com/apis/library/gmail.googleapis.com**
2. Seleccionar projecte: **`pde-aurelin-portal`**
3. Verificar que diu **"API enabled"** o **"Enable"** (si no ho està, habilitar-la)

### 3. Verificar Configuració al .env

```bash
cd /var/www/aurelinportal
grep -E "GOOGLE_SERVICE_ACCOUNT" .env
```

Hauries de veure:
- `GOOGLE_SERVICE_ACCOUNT_KEY=...`
- `GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=eugeni@eugenihidalgo.org`

### 4. Provar Connexió

```bash
cd /var/www/aurelinportal
node -e "
import('./src/services/google-workspace.js').then(async (m) => {
  const env = {
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE
  };
  const result = await m.verificarConexionGoogle(env);
  console.log(JSON.stringify(result, null, 2));
});
"
```

---

**Si tot està configurat correctament, hauria de funcionar!** ✅



