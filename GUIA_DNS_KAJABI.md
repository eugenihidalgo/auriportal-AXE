# 🌐 Guía: Configurar DNS de Kajabi para eugenihidalgo.org

## 📋 Resumen

Esta guía te ayudará a configurar los registros DNS necesarios en Cloudflare para que Kajabi pueda usar tu dominio personalizado `eugenihidalgo.org` y `www.eugenihidalgo.org` para el envío de emails.

## 🔍 Análisis de las Instrucciones de Kajabi

Kajabi requiere los siguientes registros DNS para configurar un dominio personalizado de email:

### Registros Requeridos

1. **3 Registros TXT:**
   - SPF Record (para autenticación de email)
   - DKIM Record (firma digital de emails)
   - DMARC Record (política de autenticación)

2. **2 Registros MX:**
   - Para recibir emails a través de Mailgun

3. **1 Registro CNAME:**
   - Para el subdominio `email.eugenihidalgo.org`

### ⚠️ Nota Importante sobre "kjbm"

En las instrucciones de Kajabi, aparece "kjbm" como host. Esto es un **subdominio temporal** que Kajabi genera. Para tu dominio `eugenihidalgo.org`, debes:

- **Reemplazar "kjbm" por "@"** (raíz del dominio) para los registros TXT y MX
- **Usar "email"** para el registro CNAME (email.eugenihidalgo.org)

## 🚀 Configuración Automática

### Opción 1: Script Automático (Recomendado)

Ejecuta el script que configura todos los registros automáticamente:

```bash
cd /var/www/aurelinportal
node scripts/configurar-dns-kajabi.js
```

Este script:
- ✅ Verifica tus credenciales de Cloudflare
- ✅ Lista los registros existentes
- ✅ Crea o actualiza los registros necesarios
- ✅ Muestra un resumen de lo configurado

### Opción 2: Configuración Manual en Cloudflare

Si prefieres configurarlo manualmente:

1. **Accede a Cloudflare Dashboard:**
   - Ve a: https://dash.cloudflare.com
   - Selecciona el dominio: `eugenihidalgo.org`

2. **Ve a DNS → Records**

3. **Agrega los siguientes registros:**

#### Registros TXT

**1. SPF Record:**
```
Type: TXT
Name: @ (o eugenihidalgo.org)
Content: v=spf1 include:mailgun.org ~all
TTL: Auto
Proxy: ⚪ DNS only (desactivado)
```

**2. DKIM Record:**
```
Type: TXT
Name: k1._domainkey
Content: k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDQ/ZilOdNpbkOf4KI+Azu3tToiCuon+6tQwgSJbOmL5g4gc8SmYTVJH/iQ6Haj1R42+5Np9tyDY6K6thH8Rw3KRZpgGHldPesxjPG0rFWL7gvB/L9bDH0Xz/KriP05ZLKFEau1s9ap6j+BXg10wKTcbrCZY2fMDEGhWe7e+AnY7wIDAQAB
TTL: Auto
Proxy: ⚪ DNS only (desactivado)
```

**3. DMARC Record:**
```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=none; pct=100; fo=1; ri=3600; rua=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com; ruf=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com
TTL: Auto
Proxy: ⚪ DNS only (desactivado)
```

#### Registros MX

**4. MX Record - Prioridad 10:**
```
Type: MX
Name: @ (o eugenihidalgo.org)
Content: mxa.mailgun.org
Priority: 10
TTL: Auto
Proxy: ⚪ DNS only (desactivado)
```

**5. MX Record - Prioridad 20:**
```
Type: MX
Name: @ (o eugenihidalgo.org)
Content: mxb.mailgun.org
Priority: 20
TTL: Auto
Proxy: ⚪ DNS only (desactivado)
```

#### Registro CNAME

**6. CNAME para email:**
```
Type: CNAME
Name: email
Content: mailgun.org
TTL: Auto
Proxy: ⚪ DNS only (desactivado)
```

## ⚠️ Importante: Proxy Status

**Los registros MX, TXT y CNAME NO deben tener el proxy activado (🟠 Proxied).**

- ✅ **DNS only (⚪ gris)** = Correcto para estos registros
- ❌ **Proxied (🟠 naranja)** = Incorrecto, puede causar problemas

El proxy solo se usa para registros A y CNAME que apuntan a servidores web.

## 🔍 Verificar Configuración Actual

Para ver qué registros DNS tienes actualmente configurados:

```bash
cd /var/www/aurelinportal
node scripts/verificar-dns-kajabi.js
```

O manualmente desde la terminal:

```bash
# Ver registros TXT
dig eugenihidalgo.org TXT +short

# Ver registros MX
dig eugenihidalgo.org MX +short

# Ver registro CNAME de email
dig email.eugenihidalgo.org CNAME +short
```

## 📝 Sobre www.eugenihidalgo.org

El subdominio `www.eugenihidalgo.org` **no necesita registros DNS adicionales** para el email de Kajabi. Los registros configurados en la raíz (`@` o `eugenihidalgo.org`) aplican a todo el dominio, incluyendo `www`.

Sin embargo, si quieres que `www.eugenihidalgo.org` redirija a `eugenihidalgo.org`, puedes configurar un registro CNAME:

```
Type: CNAME
Name: www
Content: eugenihidalgo.org
TTL: Auto
Proxy: 🟠 Proxied (activado - para SSL automático)
```

## ✅ Verificación en Kajabi

Una vez configurados los registros DNS:

1. **Espera 5-15 minutos** para que los DNS se propaguen
2. **Ve a Kajabi** → Settings → Custom Domain
3. **Verifica** que Kajabi detecte todos los registros correctamente
4. **Activa** el dominio personalizado cuando Kajabi lo indique

## 🐛 Solución de Problemas

### Los registros no aparecen en Kajabi

1. **Verifica la propagación DNS:**
   ```bash
   dig eugenihidalgo.org TXT +short
   dig eugenihidalgo.org MX +short
   ```

2. **Espera más tiempo** (puede tardar hasta 24 horas en algunos casos)

3. **Verifica que los registros estén correctos** en Cloudflare

### Error: "Registro duplicado"

Si ya tienes registros SPF, MX o DMARC existentes:

- **NO los elimines** sin verificar primero
- **Combina** los registros si es necesario (especialmente SPF)
- **Contacta a soporte** si no estás seguro

### Los emails no se envían

1. Verifica que todos los registros estén configurados
2. Verifica que el proxy esté desactivado (⚪ DNS only)
3. Espera 24-48 horas para la propagación completa
4. Revisa los logs de Kajabi para ver errores específicos

## 📚 Referencias

- [Documentación de Kajabi sobre Custom Domains](https://help.kajabi.com)
- [Documentación de Mailgun sobre DNS](https://documentation.mailgun.com/)
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)

---

**Última actualización:** $(date)



















