# 📋 Resum: Configuració DNS per a Emails

## 🎯 Objectiu

Configurar SPF i DKIM a Cloudflare per a:
- `pdeeugenihidalgo.org`
- `vegasquestfantasticworld.win`

## 📝 Passos Ràpids

### 1. Accedir a Cloudflare

1. Anar a: **https://dash.cloudflare.com**
2. Iniciar sessió
3. Seleccionar el domini

### 2. Per a cada domini, afegir 3 registres TXT:

#### Registre 1: SPF
- **Type**: `TXT`
- **Name**: `@`
- **Content**: `v=spf1 include:spf.privateemail.com ~all`
- **TTL**: `Auto`

#### Registre 2: DKIM
- **Type**: `TXT`
- **Name**: `default._domainkey`
- **Content**: [Clau DKIM de PrivateEmail - obtenir del panell de Namecheap]
- **TTL**: `Auto`

#### Registre 3: DMARC
- **Type**: `TXT`
- **Name**: `_dmarc`
- **Content**: `v=DMARC1; p=none; rua=mailto:eugeni@pdeeugenihidalgo.org` (ajustar email)
- **TTL**: `Auto`

### 3. Obtenir Claus DKIM

1. Anar al panell de **PrivateEmail** de Namecheap
2. Iniciar sessió amb l'email del domini
3. Anar a **Settings** → **Email Authentication** o **DKIM**
4. Copiar les claus DKIM

### 4. Verificar

Després de configurar, espera 5-15 minuts i verifica:

```bash
/var/www/aurelinportal/scripts/verificar-dns-email.sh
```

## 📚 Documentació Completa

Per instruccions detallades, veure: **`CONFIGURAR_SPF_DKIM_CLOUDFLARE.md`**

## ⚙️ Actualitzar Configuració d'Email

Després de configurar DNS, actualitza `.env` amb el domini que vulguis usar:

```env
SMTP_FROM=eugeni@pdeeugenihidalgo.org
# O
SMTP_FROM=admin@vegasquestfantasticworld.win
```

**Important**: L'email ha d'existir al teu compte de PrivateEmail.

---

**Després de configurar, els emails arribaran correctament a Gmail!** ✅






