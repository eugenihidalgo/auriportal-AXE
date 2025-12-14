# 📧 Guia Completa: Zoho Mail per a AurelinPortal

## 🎯 Per què Zoho Mail?

- ✅ **Gratuït** per 5 usuaris
- ✅ **Pots usar els teus dominis** (pdeeugenihidalgo.org, vegasquestfantasticworld.win)
- ✅ **API disponible** per gestionar des del servidor
- ✅ **SMTP senzill** per enviar emails
- ✅ **Millor reputació** que servidor propi (menys spam)

---

## 🚀 Pas 1: Crear Compte Zoho Mail

1. Anar a: **https://www.zoho.com/mail/**
2. Clicar **Sign Up Free**
3. Crear compte amb el teu email
4. Verificar email

---

## 🌐 Pas 2: Afegir el Teu Domini

### 2.1 Afegir Domini a Zoho

1. Iniciar sessió a Zoho Mail
2. Anar a **Settings** → **Domains** (o **Mail Admin** → **Domains**)
3. Clicar **Add Domain**
4. Introduir el domini: `pdeeugenihidalgo.org` o `vegasquestfantasticworld.win`
5. Clicar **Add**

### 2.2 Verificar Propietat del Domini

Zoho et donarà un registre TXT per verificar que ets el propietari del domini.

**A Cloudflare:**
1. Anar a DNS → Records
2. Afegir registre TXT:
   - **Name**: `@` (o el que et digui Zoho)
   - **Content**: [El valor que et dona Zoho]
   - **TTL**: Auto

3. Esperar 5-15 minuts
4. Tornar a Zoho i clicar **Verify**

---

## 📝 Pas 3: Configurar DNS

Després de verificar el domini, Zoho et proporcionarà els registres DNS necessaris.

### 3.1 Registres MX (per rebre emails)

A Cloudflare, afegir:

```
Type: MX
Name: @
Priority: 10
Content: mx.zoho.com
TTL: Auto

Type: MX
Name: @
Priority: 20
Content: mx2.zoho.com
TTL: Auto
```

### 3.2 Registre SPF

```
Type: TXT
Name: @
Content: v=spf1 include:zoho.com ~all
TTL: Auto
```

### 3.3 Registre DKIM

Zoho et proporcionarà una clau DKIM única:

1. A Zoho Mail, anar a **Settings** → **Domains** → [El teu domini]
2. Buscar secció **DKIM**
3. Clicar **Generate** o **Show DKIM**
4. Copiar el registre DKIM

A Cloudflare, afegir:
```
Type: TXT
Name: zmail._domainkey (o el que et digui Zoho)
Content: [La clau DKIM completa de Zoho]
TTL: Auto
```

### 3.4 Registre DMARC

```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=none; rua=mailto:admin@pdeeugenihidalgo.org
TTL: Auto
```

---

## 👤 Pas 4: Crear Email

1. A Zoho Mail, anar a **Users** o **Mailboxes**
2. Clicar **Add User** o **Create Mailbox**
3. Introduir:
   - **Email**: `eugeni@pdeeugenihidalgo.org`
   - **Password**: [Contrasenya segura]
4. Crear

---

## 🔐 Pas 5: Generar Contrasenya d'Aplicació

Per enviar emails des del servidor, necessites una **contrasenya d'aplicació** (no la contrasenya normal).

1. Anar a: **https://accounts.zoho.com/home#security/app-passwords**
2. Clicar **Generate New Password**
3. Donar-li un nom: "AurelinPortal Email"
4. Copiar la contrasenya generada (sembla: `AbCdEfGhIjKlMnOpQrStUvWxYz`)

**⚠️ Important**: Aquesta contrasenya només es mostra una vegada. Guarda-la bé!

---

## ⚙️ Pas 6: Configurar al Servidor

### Opció A: Script Automàtic

```bash
/var/www/aurelinportal/scripts/configurar-zoho-mail.sh
```

### Opció B: Manual

Editar `.env`:

```env
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=eugeni@pdeeugenihidalgo.org
SMTP_PASS=la_contrassenya_d_aplicacio_generada
SMTP_FROM=eugeni@pdeeugenihidalgo.org
```

---

## 🧪 Pas 7: Provar

```bash
cd /var/www/aurelinportal
# Usa el servicio de email desde tu código
```

Si funciona, veuràs:
```
✅ Email enviat correctament!
```

---

## 🔧 Gestió via API (Opcional)

Si vols gestionar emails via API (llegir, gestionar carpetes, etc.), veure:
- `src/services/zoho-mail-api.js` - Mòdul per API
- `ZOHO_MAIL_CONFIGURACION.md` - Documentació API

**Nota**: Per enviar emails, SMTP és més senzill i suficient.

---

## 📊 Resum de Configuració

### A Zoho Mail:
- ✅ Domini afegit i verificat
- ✅ Email creat
- ✅ Contrasenya d'aplicació generada

### A Cloudflare:
- ✅ Registres MX configurats
- ✅ SPF configurat
- ✅ DKIM configurat
- ✅ DMARC configurat

### Al Servidor:
- ✅ `.env` configurat amb credencials Zoho

---

## 🆘 Troubleshooting

### Error: "Invalid login"
- Verifica que estàs usant la **contrasenya d'aplicació**, no la contrasenya normal
- Verifica que l'email és correcte

### Error: "Authentication failed"
- Assegura't que has generat una contrasenya d'aplicació
- Verifica que no hi ha espais extra al `.env`

### Emails van a spam
- Verifica que SPF, DKIM i DMARC estan configurats correctament
- Espera 24-48 hores perquè la reputació es construeixi

---

## ✅ Avantatges de Zoho Mail

1. **Gratuït** per 5 usuaris
2. **Els teus dominis** (pdeeugenihidalgo.org, etc.)
3. **API disponible** per automatitzacions
4. **Millor reputació** que servidor propi
5. **No cal mantenir servidor** d'email

---

**Després de configurar això, tindràs emails propis gestionats des del servidor!** 🎉






