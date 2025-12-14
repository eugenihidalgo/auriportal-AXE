# 🔐 Configuració DKIM per a eugenihidalgo.org

## 📋 Dades DKIM Obtingudes

Per al domini **`eugenihidalgo.org`**:

- **Host**: `default._domainkey`
- **Tipo**: `TXT`
- **Valor**: `v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsAeJCF7purFE6Ua+zYS//UwW/K7huCT1KIVuH+iLBY7rPdOlg76CwD2SRG3W9BZnaRXSq6qvkQS6ZSxGSCRVdOSfEc5lLvdG1DpAA9ZYZtGe2F31L7KC4RhGAcNkwrw3cfxxc2JNZbZwJDNSpbYoXvPTySuC3LQ1aQC8dpX9KK9CLXXMBJTHZjCF8jYxlCkC4xcEPrwJ/2LcTnsZ+mCFWWfnmQ3l9ioguXgzNvOZuIBTmI0g/hVwzo/gkoRvW7zNboTlEytJo8e7kd8WsA1RNltWoUvmn1XuZEEGQpBxtXC1zCpd1/B4BS+GKGEPZ3mb5Pv9CKauANJRGWuYiMBL0QIDAQAB`

---

## 🚀 Configurar a Cloudflare

### Pas 1: Accedir a Cloudflare

1. Anar a: **https://dash.cloudflare.com**
2. Iniciar sessió
3. Seleccionar el domini **`eugenihidalgo.org`**

### Pas 2: Afegir Registre DKIM

1. Anar a **DNS** → **Records**
2. Clicar **Add record**
3. Configurar:
   - **Type**: `TXT`
   - **Name**: `default._domainkey`
   - **Content**: 
     ```
     v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsAeJCF7purFE6Ua+zYS//UwW/K7huCT1KIVuH+iLBY7rPdOlg76CwD2SRG3W9BZnaRXSq6qvkQS6ZSxGSCRVdOSfEc5lLvdG1DpAA9ZYZtGe2F31L7KC4RhGAcNkwrw3cfxxc2JNZbZwJDNSpbYoXvPTySuC3LQ1aQC8dpX9KK9CLXXMBJTHZjCF8jYxlCkC4xcEPrwJ/2LcTnsZ+mCFWWfnmQ3l9ioguXgzNvOZuIBTmI0g/hVwzo/gkoRvW7zNboTlEytJo8e7kd8WsA1RNltWoUvmn1XuZEEGQpBxtXC1zCpd1/B4BS+GKGEPZ3mb5Pv9CKauANJRGWuYiMBL0QIDAQAB
     ```
   - **TTL**: `Auto`
   - **Proxy status**: 🟠 Proxied (o DNS only - recomanat DNS only per registres TXT)
4. Clicar **Save**

### Pas 3: Configurar SPF (si encara no està configurat)

1. Clicar **Add record**
2. Configurar:
   - **Type**: `TXT`
   - **Name**: `@`
   - **Content**: `v=spf1 include:spf.privateemail.com ~all`
   - **TTL**: `Auto`
   - **Proxy status**: 🟠 Proxied (o DNS only)
3. Clicar **Save**

### Pas 4: Configurar DMARC (Opcional però Recomanat)

1. Clicar **Add record**
2. Configurar:
   - **Type**: `TXT`
   - **Name**: `_dmarc`
   - **Content**: `v=DMARC1; p=none; rua=mailto:eugeni@eugenihidalgo.org`
   - **TTL**: `Auto`
   - **Proxy status**: 🟠 Proxied (o DNS only)
3. Clicar **Save**

---

## 🔍 Verificar la Configuració

Després d'afegir els registres, espera 5-15 minuts i verifica:

```bash
# Verificar DKIM
dig TXT default._domainkey.eugenihidalgo.org +short

# Verificar SPF
dig TXT eugenihidalgo.org +short | grep spf

# Verificar DMARC
dig TXT _dmarc.eugenihidalgo.org +short
```

O utilitza el script de verificació:

```bash
/var/www/aurelinportal/scripts/verificar-dns-email.sh
```

---

## 📧 Actualitzar Configuració d'Email

Després de configurar DNS, actualitza `.env` per usar aquest domini:

```env
SMTP_FROM=eugeni@eugenihidalgo.org
```

---

## ✅ Resum de Registres a Afegir

Per a `eugenihidalgo.org`:

1. **SPF**: `@` → `v=spf1 include:spf.privateemail.com ~all`
2. **DKIM**: `default._domainkey` → `v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsAeJCF7purFE6Ua+zYS//UwW/K7huCT1KIVuH+iLBY7rPdOlg76CwD2SRG3W9BZnaRXSq6qvkQS6ZSxGSCRVdOSfEc5lLvdG1DpAA9ZYZtGe2F31L7KC4RhGAcNkwrw3cfxxc2JNZbZwJDNSpbYoXvPTySuC3LQ1aQC8dpX9KK9CLXXMBJTHZjCF8jYxlCkC4xcEPrwJ/2LcTnsZ+mCFWWfnmQ3l9ioguXgzNvOZuIBTmI0g/hVwzo/gkoRvW7zNboTlEytJo8e7kd8WsA1RNltWoUvmn1XuZEEGQpBxtXC1zCpd1/B4BS+GKGEPZ3mb5Pv9CKauANJRGWuYiMBL0QIDAQAB`
3. **DMARC**: `_dmarc` → `v=DMARC1; p=none; rua=mailto:eugeni@eugenihidalgo.org`

---

**Després de configurar això, els emails haurien d'arribar correctament a Gmail!** ✅






