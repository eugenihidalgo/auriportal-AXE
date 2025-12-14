# 📧 Configuració Zoho Mail amb API/SMTP

## 🎯 Opcions Disponibles

Zoho Mail ofereix dues maneres d'enviar emails des del servidor:

### Opció 1: SMTP de Zoho (Recomanat - Més Senzill) ✅

Usa SMTP estàndard amb Zoho. Més senzill i directe.

### Opció 2: API de Zoho (Més Avançat)

Usa l'API REST de Zoho per més control i funcionalitats.

---

## 🚀 Opció 1: Configuració SMTP de Zoho

### Pas 1: Crear Compte Zoho Mail

1. Anar a: https://www.zoho.com/mail/
2. Crear compte gratuït (5 usuaris gratuïts)
3. Verificar email

### Pas 2: Afegir el Teu Domini

1. A Zoho Mail, anar a **Settings** → **Domains**
2. Clicar **Add Domain**
3. Afegir `pdeeugenihidalgo.org` o `vegasquestfantasticworld.win`
4. Verificar propietat del domini (afegir registre TXT a DNS)

### Pas 3: Configurar DNS

Després d'afegir el domini, Zoho et proporcionarà els registres DNS necessaris:

#### Registres MX (per rebre emails):
```
pdeeugenihidalgo.org    MX    10 mx.zoho.com
pdeeugenihidalgo.org    MX    20 mx2.zoho.com
```

#### Registre SPF:
```
pdeeugenihidalgo.org    TXT   v=spf1 include:zoho.com ~all
```

#### Registre DKIM:
Zoho et proporcionarà una clau DKIM única que has d'afegir.

#### Registre DMARC:
```
_dmarc.pdeeugenihidalgo.org    TXT   v=DMARC1; p=none; rua=mailto:admin@pdeeugenihidalgo.org
```

### Pas 4: Crear Email

1. A Zoho Mail, crear email: `eugeni@pdeeugenihidalgo.org`
2. Configurar contrasenya

### Pas 5: Generar Contrasenya d'Aplicació

1. Anar a: https://accounts.zoho.com/home#security/app-passwords
2. Generar nova contrasenya d'aplicació
3. Copiar la contrasenya generada

### Pas 6: Configurar al Servidor

Actualitzar `.env`:

```env
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=eugeni@pdeeugenihidalgo.org
SMTP_PASS=la_contrassenya_d_aplicacio_generada
SMTP_FROM=eugeni@pdeeugenihidalgo.org
```

---

## 🔧 Opció 2: API de Zoho Mail

### Pas 1: Crear Aplicació Zoho

1. Anar a: https://api-console.zoho.com/
2. Crear nova aplicació
3. Seleccionar **Server-based Applications**
4. Configurar:
   - **Client Name**: AurelinPortal Email
   - **Homepage URL**: https://pdeeugenihidalgo.org
   - **Authorized Redirect URIs**: https://pdeeugenihidalgo.org/callback
5. Copiar **Client ID** i **Client Secret**

### Pas 2: Obtenir Token d'Accés

Cal fer OAuth2 per obtenir un token d'accés. Això requereix un procés d'autorització.

### Pas 3: Usar API

L'API de Zoho permet:
- Enviar emails
- Llegir emails
- Gestionar carpetes
- Etc.

---

## 💡 Recomanació

**Recomano usar SMTP de Zoho** perquè:
- ✅ Més senzill
- ✅ No cal gestionar tokens OAuth
- ✅ Funciona directament amb nodemailer
- ✅ Menys codi

L'API de Zoho és útil si necessites:
- Llegir emails
- Gestionar carpetes
- Automatitzacions complexes

---

## 📝 Configuració Ràpida SMTP

Després de configurar Zoho Mail:

1. **Actualitzar `.env`**:
```env
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=eugeni@pdeeugenihidalgo.org
SMTP_PASS=contrassenya_aplicacio
SMTP_FROM=eugeni@pdeeugenihidalgo.org
```

2. **Provar**:
```bash
cd /var/www/aurelinportal
# Usa el servicio de email desde tu código
```

---

## 🔐 Seguretat

- **Usa contrasenyes d'aplicació**, no la contrasenya principal
- **Mantén les claus segures** al `.env`
- **No commitegis** el `.env` al git

---

**Vols que creï un script per configurar Zoho Mail automàticament?** 🚀






