# 📧 Configuració Completa Zoho Mail - 4 Emails

## 📋 Emails a Configurar

1. `master@vegasquestfantasticworld.win`
2. `eugeni@eugenihidalgo.org`
3. `elcalordelalma@eugenihidalgo.org`
4. `bennascut@eugenihidalgo.org`

## 🎯 Objectius

- ✅ Configurar tots els emails a Zoho Mail
- ✅ Configurar DNS a Cloudflare
- ✅ Eliminar configuració de Namecheap PrivateEmail
- ✅ Configurar al servidor per usar Zoho

---

## 🚀 Pas 1: Crear/Accessar Compte Zoho Mail

1. Anar a: **https://www.zoho.com/mail/**
2. Iniciar sessió o crear compte
3. Verificar que tens accés al panell d'administració

---

## 🌐 Pas 2: Afegir Dominis a Zoho Mail

### 2.1 Afegir `vegasquestfantasticworld.win`

1. A Zoho Mail, anar a **Settings** → **Domains** (o **Mail Admin** → **Domains**)
2. Clicar **Add Domain**
3. Introduir: `vegasquestfantasticworld.win`
4. Clicar **Add**

**Verificar Propietat:**
- Zoho et donarà un registre TXT
- Afegir-lo a Cloudflare per `vegasquestfantasticworld.win`
- Esperar 5-15 minuts
- Tornar a Zoho i clicar **Verify**

### 2.2 Afegir `eugenihidalgo.org`

1. Repetir el procés per `eugenihidalgo.org`
2. Afegir registre TXT de verificació a Cloudflare
3. Verificar a Zoho

---

## 📝 Pas 3: Configurar DNS a Cloudflare

### 3.1 Per a `vegasquestfantasticworld.win`

A Cloudflare, seleccionar el domini i afegir:

#### Registres MX:
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

#### Registre SPF:
```
Type: TXT
Name: @
Content: v=spf1 include:zoho.com ~all
TTL: Auto
```

#### Registre DKIM:
1. A Zoho Mail, anar a **Settings** → **Domains** → `vegasquestfantasticworld.win`
2. Buscar secció **DKIM**
3. Clicar **Generate** o **Show DKIM**
4. Copiar el registre DKIM

A Cloudflare:
```
Type: TXT
Name: zmail._domainkey (o el que et digui Zoho)
Content: [Clau DKIM de Zoho]
TTL: Auto
```

#### Registre DMARC:
```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=none; rua=mailto:master@vegasquestfantasticworld.win
TTL: Auto
```

### 3.2 Per a `eugenihidalgo.org`

Repetir els mateixos passos per `eugenihidalgo.org`:
- MX records
- SPF
- DKIM (obtenir de Zoho)
- DMARC (amb `eugeni@eugenihidalgo.org` com a email de report)

---

## 👤 Pas 4: Crear Emails a Zoho Mail

### 4.1 Crear `master@vegasquestfantasticworld.win`

1. A Zoho Mail, anar a **Users** o **Mailboxes**
2. Clicar **Add User** o **Create Mailbox**
3. Introduir:
   - **Email**: `master@vegasquestfantasticworld.win`
   - **Password**: [Contrasenya segura]
   - **Display Name**: Master
4. Clicar **Create**

### 4.2 Crear `eugeni@eugenihidalgo.org`

1. Repetir el procés
2. **Email**: `eugeni@eugenihidalgo.org`
3. **Password**: [Contrasenya segura]

### 4.3 Crear `elcalordelalma@eugenihidalgo.org`

1. Repetir el procés
2. **Email**: `elcalordelalma@eugenihidalgo.org`
3. **Password**: [Contrasenya segura]

### 4.4 Crear `bennascut@eugenihidalgo.org`

1. Repetir el procés
2. **Email**: `bennascut@eugenihidalgo.org`
3. **Password**: [Contrasenya segura]

---

## 🔐 Pas 5: Generar Contrasenyes d'Aplicació

Per cada email, generar una contrasenya d'aplicació:

1. Anar a: **https://accounts.zoho.com/home#security/app-passwords**
2. Per cada email:
   - Seleccionar l'email
   - Clicar **Generate New Password**
   - Donar-li un nom: "AurelinPortal - [nom email]"
   - Copiar la contrasenya generada

**Guarda totes les contrasenyes d'aplicació!**

---

## ⚙️ Pas 6: Configurar al Servidor

### 6.1 Actualitzar `.env`

Editar `/var/www/aurelinportal/.env`:

```env
# Configuració SMTP Zoho
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false

# Email principal
SMTP_USER=eugeni@eugenihidalgo.org
SMTP_PASS=contrassenya_aplicacio_eugeni
SMTP_FROM=eugeni@eugenihidalgo.org

# Altres emails (opcional, per usar en altres parts de l'aplicació)
ZOHO_MASTER_EMAIL=master@vegasquestfantasticworld.win
ZOHO_MASTER_PASS=contrassenya_aplicacio_master
ZOHO_ELCALOR_EMAIL=elcalordelalma@eugenihidalgo.org
ZOHO_ELCALOR_PASS=contrassenya_aplicacio_elcalor
ZOHO_BENNASCUT_EMAIL=bennascut@eugenihidalgo.org
ZOHO_BENNASCUT_PASS=contrassenya_aplicacio_bennascut
```

### 6.2 Provar Enviament

```bash
cd /var/www/aurelinportal
# Usa el servicio de email desde tu código
```

---

## 🗑️ Pas 7: Eliminar Configuració de Namecheap

### 7.1 Verificar Què Hi Ha a Namecheap

1. Anar a: **https://www.namecheap.com/**
2. Iniciar sessió
3. Anar a **Domain List**
4. Verificar dominis:
   - `vegasquestfantasticworld.win`
   - `eugenihidalgo.org`

### 7.2 Eliminar PrivateEmail (si existeix)

1. A Namecheap, anar a **Private Email**
2. Si hi ha emails configurats per aquests dominis:
   - Eliminar emails de PrivateEmail
   - Eliminar configuració de PrivateEmail
   - Assegurar-te que no queda res

### 7.3 Verificar DNS a Namecheap

Si els dominis utilitzen DNS de Namecheap (no Cloudflare):
- Assegurar-te que els registres MX, SPF, DKIM apunten a Zoho, no a PrivateEmail

Si els dominis utilitzen DNS de Cloudflare:
- Els registres DNS ja estan configurats a Cloudflare (Pas 3)
- No cal fer res a Namecheap DNS

---

## ✅ Checklist Final

### Zoho Mail:
- [ ] Domini `vegasquestfantasticworld.win` afegit i verificat
- [ ] Domini `eugenihidalgo.org` afegit i verificat
- [ ] Email `master@vegasquestfantasticworld.win` creat
- [ ] Email `eugeni@eugenihidalgo.org` creat
- [ ] Email `elcalordelalma@eugenihidalgo.org` creat
- [ ] Email `bennascut@eugenihidalgo.org` creat
- [ ] Contrasenyes d'aplicació generades per tots els emails

### Cloudflare DNS:
- [ ] Registres MX configurats per `vegasquestfantasticworld.win`
- [ ] Registres MX configurats per `eugenihidalgo.org`
- [ ] SPF configurat per ambdós dominis
- [ ] DKIM configurat per ambdós dominis
- [ ] DMARC configurat per ambdós dominis

### Servidor:
- [ ] `.env` actualitzat amb credencials Zoho
- [ ] Enviament de prova funcionant

### Namecheap:
- [ ] PrivateEmail eliminat (si existia)
- [ ] No queda configuració de PrivateEmail

---

## 🧪 Verificació

### Verificar DNS:

```bash
# Verificar MX
dig MX vegasquestfantasticworld.win +short
dig MX eugenihidalgo.org +short

# Verificar SPF
dig TXT vegasquestfantasticworld.win +short | grep spf
dig TXT eugenihidalgo.org +short | grep spf

# Verificar DKIM
dig TXT zmail._domainkey.vegasquestfantasticworld.win +short
dig TXT zmail._domainkey.eugenihidalgo.org +short
```

### Verificar Enviament:

```bash
cd /var/www/aurelinportal
# Usa el servicio de email desde tu código
```

---

## 📝 Notes Importants

1. **Contrasenyes d'Aplicació**: Usa sempre contrasenyes d'aplicació, no les contrasenyes normals
2. **Propagació DNS**: Pot tardar 15-30 minuts (màxim 24 hores)
3. **Reputació**: Pot trigar 24-48 hores per construir reputació i evitar spam
4. **Backup**: Guarda totes les contrasenyes d'aplicació en un lloc segur

---

**Després de completar tots els passos, tindràs 4 emails funcionant amb Zoho Mail!** 🎉






