# 🔐 Configuració SPF i DKIM per a eugenihidalgo.org

## ❌ Problema Actual

Gmail està bloquejant els emails perquè el domini `eugenihidalgo.org` no té configurats els registres SPF i DKIM. Això és necessari per autenticar que els emails venen realment del teu domini.

## ✅ Solució: Configurar SPF i DKIM

### Opció 1: Configurar a Namecheap (si el domini està gestionat allà)

#### 1. Accedir al Panell de Namecheap

1. Anar a: https://www.namecheap.com/
2. Iniciar sessió
3. Anar a **Domain List** → Seleccionar `eugenihidalgo.org`
4. Clicar a **Manage** → **Advanced DNS**

#### 2. Configurar SPF

1. A la secció **Host Records**, buscar si ja existeix un registre TXT amb `@` o `eugenihidalgo.org`
2. Si no existeix, afegir un nou registre:
   - **Type**: `TXT`
   - **Host**: `@` (o deixar buit)
   - **Value**: `v=spf1 include:spf.privateemail.com ~all`
   - **TTL**: `Automatic` o `3600`

#### 3. Configurar DKIM

Per obtenir les claus DKIM de PrivateEmail:

1. Anar al panell de **PrivateEmail** de Namecheap
2. Iniciar sessió amb `eugeni@eugenihidalgo.org`
3. Anar a **Settings** → **Email Authentication** o **DKIM**
4. Copiar les claus DKIM que et proporcionen
5. Afegir registres TXT al DNS:
   - **Type**: `TXT`
   - **Host**: `default._domainkey` (o el que et digui PrivateEmail)
   - **Value**: [La clau DKIM que et proporciona PrivateEmail]
   - **TTL**: `Automatic`

**Nota**: PrivateEmail normalment proporciona les claus DKIM al panell. Si no les trobes, contacta amb el suport de Namecheap.

#### 4. Configurar DMARC (Opcional però recomanat)

Afegeix un altre registre TXT:
- **Type**: `TXT`
- **Host**: `_dmarc`
- **Value**: `v=DMARC1; p=none; rua=mailto:eugeni@eugenihidalgo.org`
- **TTL**: `Automatic`

### Opció 2: Configurar a Cloudflare (si el domini està gestionat allà)

Si `eugenihidalgo.org` està gestionat a Cloudflare:

1. Anar a: https://dash.cloudflare.com
2. Seleccionar el domini `eugenihidalgo.org`
3. Anar a **DNS** → **Records**

#### Afegir SPF:

1. Clicar **Add record**
2. Configurar:
   - **Type**: `TXT`
   - **Name**: `@` (o `eugenihidalgo.org`)
   - **Content**: `v=spf1 include:spf.privateemail.com ~all`
   - **TTL**: `Auto`
3. Clicar **Save**

#### Afegir DKIM:

1. Obtenir les claus DKIM del panell de PrivateEmail (veure pas 3 de l'Opció 1)
2. Afegir registre TXT:
   - **Type**: `TXT`
   - **Name**: `default._domainkey` (o el que et digui PrivateEmail)
   - **Content**: [Clau DKIM de PrivateEmail]
   - **TTL**: `Auto`
3. Clicar **Save**

#### Afegir DMARC:

1. Clicar **Add record**
2. Configurar:
   - **Type**: `TXT`
   - **Name**: `_dmarc`
   - **Content**: `v=DMARC1; p=none; rua=mailto:eugeni@eugenihidalgo.org`
   - **TTL**: `Auto`
3. Clicar **Save**

## 🔍 Verificar la Configuració

Després d'afegir els registres, espera 5-15 minuts perquè es propaguin i després verifica:

### Verificar SPF:

```bash
dig TXT eugenihidalgo.org +short
```

Hauria de mostrar: `"v=spf1 include:spf.privateemail.com ~all"`

### Verificar DKIM:

```bash
dig TXT default._domainkey.eugenihidalgo.org +short
```

Hauria de mostrar la clau DKIM.

### Verificar DMARC:

```bash
dig TXT _dmarc.eugenihidalgo.org +short
```

## 📧 Provar l'Enviament

Un cop configurats els registres i després d'esperar la propagació:

```bash
cd /var/www/aurelinportal
# Usa el servicio de email desde tu código
```

## ⚠️ Notes Importants

1. **Propagació DNS**: Els canvis DNS poden tardar entre 5 minuts i 24 hores. Normalment és entre 15-30 minuts.

2. **PrivateEmail DKIM**: Si no trobes les claus DKIM al panell de PrivateEmail, contacta amb el suport de Namecheap. Ells et proporcionaran les claus correctes.

3. **Verificació**: Pots verificar si els registres estan configurats correctament amb eines com:
   - https://mxtoolbox.com/spf.aspx
   - https://mxtoolbox.com/dkim.aspx
   - https://www.dmarcanalyzer.com/

## 🆘 Si Continua el Problema

Si després de configurar SPF i DKIM encara hi ha problemes:

1. Verifica que els registres estan ben escrits (sense espais extra, cometes correctes, etc.)
2. Espera més temps per la propagació DNS
3. Verifica que estàs utilitzant el servidor SMTP correcte de PrivateEmail
4. Contacta amb el suport de Namecheap per confirmar la configuració DKIM

---

**Després de configurar això, els emails haurien d'arribar correctament a Gmail!** ✅






