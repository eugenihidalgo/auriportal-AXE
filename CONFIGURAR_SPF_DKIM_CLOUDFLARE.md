# 🔐 Configuració SPF i DKIM a Cloudflare

Aquesta guia explica com configurar SPF i DKIM per a:
- `pdeeugenihidalgo.org`
- `vegasquestfantasticworld.win`

## 📋 Prerequisits

1. Accés a Cloudflare Dashboard
2. Els dominis han d'estar gestionats a Cloudflare
3. Accés al panell de PrivateEmail de Namecheap per obtenir les claus DKIM

---

## 🚀 Pasos per Configurar a Cloudflare

### Pas 1: Accedir a Cloudflare

1. Anar a: **https://dash.cloudflare.com**
2. Iniciar sessió
3. Seleccionar el domini que vols configurar

---

## 📧 Configuració per a `pdeeugenihidalgo.org`

### 1. Seleccionar el Domini

1. A Cloudflare Dashboard, seleccionar **`pdeeugenihidalgo.org`**
2. Anar a **DNS** → **Records**

### 2. Configurar SPF

1. Clicar **Add record**
2. Configurar:
   - **Type**: `TXT`
   - **Name**: `@` (o deixar buit per al domini principal)
   - **Content**: `v=spf1 include:spf.privateemail.com ~all`
   - **TTL**: `Auto`
   - **Proxy status**: 🟠 Proxied (o DNS only, segons prefereixis)
3. Clicar **Save**

**Nota**: Si ja existeix un registre TXT amb SPF, edita'l en lloc de crear-ne un de nou.

### 3. Configurar DKIM

Per obtenir les claus DKIM:

**📖 IMPORTANT**: Consulta la guia detallada: **`COMO_ENCONTRAR_DKIM_PRIVATEEMAIL.md`**

Resum ràpid:
1. Anar a **namecheap.com** (NO al webmail)
2. Iniciar sessió al panell principal de Namecheap
3. Anar a **"Private Email"** → **"Manage"** al costat del domini
4. Buscar la secció **"DKIM"** → Clicar **"Generate"**
5. Clicar **"Show DKIM"** per veure els detalls
6. Copiar el **Host** (normalment `default._domainkey`) i el **Valor** complet

Després, a Cloudflare:

1. Clicar **Add record**
2. Configurar:
   - **Type**: `TXT`
   - **Name**: `default._domainkey` (o el nom que et digui PrivateEmail)
   - **Content**: [La clau DKIM completa que et proporciona PrivateEmail]
   - **TTL**: `Auto`
   - **Proxy status**: 🟠 Proxied (o DNS only)
3. Clicar **Save**

**Exemple de clau DKIM** (format aproximat):
```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

### 4. Configurar DMARC (Opcional però Recomanat)

1. Clicar **Add record**
2. Configurar:
   - **Type**: `TXT`
   - **Name**: `_dmarc`
   - **Content**: `v=DMARC1; p=none; rua=mailto:eugeni@pdeeugenihidalgo.org`
   - **TTL**: `Auto`
   - **Proxy status**: 🟠 Proxied (o DNS only)
3. Clicar **Save**

---

## 🎮 Configuració per a `vegasquestfantasticworld.win`

Repetir els mateixos passos però per al domini `vegasquestfantasticworld.win`:

### 1. Seleccionar el Domini

1. A Cloudflare Dashboard, seleccionar **`vegasquestfantasticworld.win`**
2. Anar a **DNS** → **Records**

### 2. Configurar SPF

- **Type**: `TXT`
- **Name**: `@`
- **Content**: `v=spf1 include:spf.privateemail.com ~all`
- **TTL**: `Auto`

### 3. Configurar DKIM

- Obtenir claus DKIM del panell de PrivateEmail per a aquest domini
- **Type**: `TXT`
- **Name**: `default._domainkey`
- **Content**: [Clau DKIM de PrivateEmail]
- **TTL**: `Auto`

### 4. Configurar DMARC

- **Type**: `TXT`
- **Name**: `_dmarc`
- **Content**: `v=DMARC1; p=none; rua=mailto:admin@vegasquestfantasticworld.win`
- **TTL**: `Auto`

---

## 🔍 Verificar la Configuració

Després d'afegir els registres, espera 5-15 minuts i verifica:

### Verificar SPF per pdeeugenihidalgo.org:

```bash
dig TXT pdeeugenihidalgo.org +short
```

Hauria de mostrar: `"v=spf1 include:spf.privateemail.com ~all"`

### Verificar DKIM per pdeeugenihidalgo.org:

```bash
dig TXT default._domainkey.pdeeugenihidalgo.org +short
```

### Verificar SPF per vegasquestfantasticworld.win:

```bash
dig TXT vegasquestfantasticworld.win +short
```

### Verificar DKIM per vegasquestfantasticworld.win:

```bash
dig TXT default._domainkey.vegasquestfantasticworld.win +short
```

---

## 📧 Actualitzar Configuració d'Email

Després de configurar els registres DNS, pots actualitzar la configuració d'email per usar un d'aquests dominis.

### Opció A: Usar pdeeugenihidalgo.org

Editar `.env`:
```env
SMTP_FROM=eugeni@pdeeugenihidalgo.org
```

### Opció B: Usar vegasquestfantasticworld.win

Editar `.env`:
```env
SMTP_FROM=admin@vegasquestfantasticworld.win
```

**Nota**: Assegura't que l'email que posis a `SMTP_FROM` existeixi al teu compte de PrivateEmail.

---

## ⏱️ Temps de Propagació

- **Cloudflare**: Normalment 1-5 minuts
- **Propagació global**: 15-30 minuts (màxim 24 hores)

---

## 🧪 Provar l'Enviament

Després de configurar i esperar la propagació:

```bash
cd /var/www/aurelinportal
# Usa el servicio de email desde tu código
```

---

## 🆘 Troubleshooting

### Els registres no apareixen

1. Verifica que has guardat correctament a Cloudflare
2. Espera més temps per la propagació
3. Verifica que estàs buscant el registre correcte (amb `dig` o eines online)

### DKIM no funciona

1. **No trobes DKIM al panell?** → Consulta **`COMO_ENCONTRAR_DKIM_PRIVATEEMAIL.md`**
2. Verifica que has copiat la clau DKIM completa (sovint és molt llarga)
3. Assegura't que el nom del registre és correcte (`default._domainkey` o el que et digui PrivateEmail)
4. Assegura't que estàs al panell de gestió de dominis de Namecheap, NO al webmail
5. Contacta amb el suport de Namecheap si encara no ho trobes

### Gmail encara bloqueja

1. Espera 24 hores després de configurar (Gmail pot trigar a actualitzar)
2. Verifica amb eines online:
   - https://mxtoolbox.com/spf.aspx
   - https://mxtoolbox.com/dkim.aspx
   - https://www.dmarcanalyzer.com/
3. Assegura't que `SMTP_FROM` al `.env` coincideix amb el domini configurat

---

## ✅ Resum de Registres a Afegir

### Per a pdeeugenihidalgo.org:

1. **SPF**: `@` → `v=spf1 include:spf.privateemail.com ~all`
2. **DKIM**: `default._domainkey` → [Clau de PrivateEmail]
3. **DMARC**: `_dmarc` → `v=DMARC1; p=none; rua=mailto:eugeni@pdeeugenihidalgo.org`

### Per a vegasquestfantasticworld.win:

1. **SPF**: `@` → `v=spf1 include:spf.privateemail.com ~all`
2. **DKIM**: `default._domainkey` → [Clau de PrivateEmail]
3. **DMARC**: `_dmarc` → `v=DMARC1; p=none; rua=mailto:admin@vegasquestfantasticworld.win`

---

**Després de configurar això, els emails haurien d'arribar correctament a Gmail!** ✅

