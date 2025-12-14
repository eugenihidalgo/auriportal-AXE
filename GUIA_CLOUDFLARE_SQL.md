# 🌐 Guía Paso a Paso: Configurar Subdominio SQL en Cloudflare

## 📋 Información del Subdominio

**Subdominio a configurar:** `sqlpdeaurelin.eugenihidalgo.work`

Este subdominio te dará acceso al panel SQL para ver y editar todas las bases de datos de alumnos de Kajabi.

---

## 🚀 Pasos para Configurar en Cloudflare

### **Paso 1: Acceder a Cloudflare Dashboard**

1. Abre tu navegador y ve a: **https://dash.cloudflare.com**
2. Inicia sesión con tu cuenta de Cloudflare
3. Selecciona el dominio: **`eugenihidalgo.work`**

---

### **Paso 2: Ir a la Sección DNS**

1. En el menú lateral izquierdo, haz clic en **"DNS"** o **"DNS Records"**
2. Verás una lista de todos los registros DNS existentes

---

### **Paso 3: Agregar Nuevo Registro DNS**

1. Haz clic en el botón **"+ Add record"** (Agregar registro)
2. Se abrirá un formulario para crear un nuevo registro

---

### **Paso 4: Configurar el Registro**

Completa el formulario con estos valores:

#### **Opción A: Usar Registro Tipo A (Recomendado si conoces la IP del servidor)**

```
Type:        A
Name:        sqlpdeaurelin
IPv4 address: [IP de tu servidor]
             (Ejemplo: 88.99.173.249 o la IP que uses)
Proxy status: 🟠 Proxied (naranja - ACTIVADO)
TTL:         Auto
```

**¿Cómo saber la IP de tu servidor?**
- Si ya tienes otros subdominios configurados, mira la IP que usan
- O ejecuta en tu servidor: `curl ifconfig.me`

#### **Opción B: Usar Registro Tipo CNAME (Si tienes un dominio principal)**

```
Type:        CNAME
Name:        sqlpdeaurelin
Target:      eugenihidalgo.work
             (o el dominio principal que uses)
Proxy status: 🟠 Proxied (naranja - ACTIVADO)
TTL:         Auto
```

---

### **Paso 5: Activar el Proxy (IMPORTANTE)**

⚠️ **MUY IMPORTANTE:** Asegúrate de que el **Proxy status** esté en **🟠 Proxied** (naranja)

- ✅ **🟠 Proxied (naranja)** = Activado (recomendado)
  - SSL automático de Cloudflare
  - Protección DDoS
  - CDN
  
- ❌ **DNS only (gris)** = Desactivado
  - No tendrás SSL automático
  - Acceso directo sin protección

---

### **Paso 6: Guardar el Registro**

1. Haz clic en el botón **"Save"** (Guardar)
2. El registro se agregará a la lista

---

### **Paso 7: Verificar la Configuración**

Deberías ver en la lista de DNS:

```
Type    Name           Content              Proxy Status
A       sqlpdeaurelin  88.99.173.249        Proxied 🟠
```

O si usaste CNAME:

```
Type    Name           Content              Proxy Status
CNAME   sqlpdeaurelin  eugenihidalgo.work   Proxied 🟠
```

---

### **Paso 8: Esperar Propagación DNS**

⏱️ **Tiempo de propagación:** 1-5 minutos (normalmente es instantáneo con Cloudflare)

Puedes verificar que está funcionando:

1. **Desde tu navegador:**
   - Abre: `http://sqlpdeaurelin.eugenihidalgo.work`
   - Deberías ver el panel SQL

2. **Desde la terminal (opcional):**
   ```bash
   dig sqlpdeaurelin.eugenihidalgo.work +short
   # Debería mostrar una IP (la de Cloudflare si está proxied)
   ```

---

## 🔒 Configurar SSL (Automático con Cloudflare)

Si activaste el **Proxy (🟠 Proxied)**, Cloudflare proporciona SSL automáticamente:

1. Ve a **SSL/TLS** en el menú de Cloudflare
2. Asegúrate de que el modo esté en **"Full"** o **"Full (strict)"**
3. El SSL se activará automáticamente en unos minutos

**Para verificar SSL:**
- Abre: `https://sqlpdeaurelin.eugenihidalgo.work`
- Deberías ver el candado verde 🔒

---

## ✅ Verificación Final

Una vez configurado, deberías poder:

1. ✅ Acceder a: `https://sqlpdeaurelin.eugenihidalgo.work`
2. ✅ Ver el panel SQL con todas las tablas
3. ✅ Ver y editar datos de alumnos de Kajabi

---

## 🐛 Solución de Problemas

### **El subdominio no carga**

1. **Verifica que el registro DNS esté correcto:**
   - Revisa que el nombre sea exactamente: `sqlpdeaurelin`
   - Verifica que el Proxy esté activado (🟠)

2. **Verifica que el servidor Node.js esté corriendo:**
   ```bash
   # En tu servidor
   pm2 status
   # o
   systemctl status aurelinportal
   ```

3. **Verifica los logs de Nginx (si usas Nginx):**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

### **Error 502 Bad Gateway**

Esto significa que Cloudflare no puede conectar con tu servidor:

1. Verifica que el servidor Node.js esté corriendo en el puerto 3000
2. Verifica que Nginx (si lo usas) esté configurado correctamente
3. Verifica el firewall del servidor

### **El subdominio carga pero muestra error 404**

El router no está detectando el subdominio. Verifica:

1. Que el servidor Node.js tenga la última versión del código
2. Reinicia el servidor:
   ```bash
   pm2 restart aurelinportal
   # o
   npm restart
   ```

---

## 📸 Capturas de Pantalla de Referencia

### Vista del Formulario DNS en Cloudflare:

```
┌─────────────────────────────────────┐
│ Type: [A ▼]                         │
│ Name: [sqlpdeaurelin]               │
│ IPv4 address: [88.99.173.249]       │
│ Proxy status: [🟠 Proxied]          │
│ TTL: [Auto]                         │
│                                     │
│ [Save] [Cancel]                     │
┌─────────────────────────────────────┐
```

---

## 🎯 Resumen Rápido

1. ✅ Ve a Cloudflare Dashboard → DNS
2. ✅ Click en "+ Add record"
3. ✅ Tipo: **A** o **CNAME**
4. ✅ Name: **sqlpdeaurelin**
5. ✅ Content: **IP del servidor** o **dominio principal**
6. ✅ Proxy: **🟠 Proxied (ACTIVADO)**
7. ✅ Click en **Save**
8. ✅ Espera 1-5 minutos
9. ✅ Accede a: `https://sqlpdeaurelin.eugenihidalgo.work`

---

## 📞 ¿Necesitas Ayuda?

Si después de seguir estos pasos aún tienes problemas:

1. Verifica que el servidor Node.js esté corriendo
2. Revisa los logs del servidor
3. Verifica la configuración de Nginx (si la usas)
4. Asegúrate de que el router detecte el subdominio correctamente

---

*Guía creada: $(date)*
*Versión: AuriPortal v3.1*

---

# 📧 Guía: Configurar Correo Electrónico de Kajabi en Cloudflare

## 📋 Información General

Esta guía te ayudará a configurar el dominio de correo personalizado de Kajabi en Cloudflare para que tus emails de marketing se envíen desde tu dominio personalizado en lugar del dominio compartido de Kajabi.

**Dominio a configurar:** `kjbm.eugenihidalgo.org`

**⚠️ Importante:** 
- Hasta que completes esta configuración, tus emails de marketing seguirán enviándose desde el dominio compartido de Kajabi.
- El estado en Kajabi mostrará "Setup pending" hasta que los registros DNS se verifiquen correctamente.
- **NO elimines registros existentes** - Si ya tienes registros, crea nuevos en lugar de reemplazarlos.

---

## 📊 Resumen de Registros DNS Requeridos

Necesitas agregar **6 registros DNS** en total. Aquí está la lista completa:

### **Registros TXT (3 registros)**

| # | Type | Host | Value | TTL |
|---|------|------|-------|-----|
| 1 | TXT | `kjbm` | `v=spf1 include:mailgun.org ~all` | Auto |
| 2 | TXT | `pic._domainkey.kjbm` | `k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDe7wwAsAOvmJ8oio0wVhBfJyCs/4IDdSpsO+fx0NfFheaQgZQnnRKjHT6BTwMpno0B5fO8qEMB/3JQ34y8xxbLStsVcr7rdLLZFcwEkD87jg5ZR9dJML/bwVT5KSKFzBxAwJ14o3Redag+DqAayjXI88n/IUXEz6A+4nSB6RnpUwIDAQAB` | Auto |
| 3 | TXT | `_dmarc.kjbm` | `v=DMARC1; p=none; pct=100; fo=1; ri=3600; rua=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com; ruf=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com` | Auto |

### **Registros MX (2 registros)**

| # | Type | Host | Value | Priority | TTL |
|---|------|------|-------|----------|-----|
| 4 | MX | `kjbm` | `mxa.mailgun.org` | 10 | Auto |
| 5 | MX | `kjbm` | `mxb.mailgun.org` | 20 | Auto |

### **Registros CNAME (1 registro)**

| # | Type | Host | Value | TTL |
|---|------|------|-------|-----|
| 6 | CNAME | `email.kjbm` | `mailgun.org` | Auto |

**💡 Tip:** Puedes copiar los valores de "Host" y "Value" directamente desde esta tabla para pegarlos en Cloudflare.

---

## 🚀 Pasos para Configurar en Cloudflare

### **Paso 1: Acceder a Cloudflare Dashboard**

1. Abre tu navegador y ve a: **https://dash.cloudflare.com**
2. Inicia sesión con tu cuenta de Cloudflare
3. Selecciona el dominio: **`eugenihidalgo.org`** (el dominio principal donde se configurará el subdominio `kjbm`)

---

### **Paso 2: Ir a la Sección DNS**

1. En el menú lateral izquierdo, haz clic en **"DNS"** o **"DNS Records"**
2. Verás una lista de todos los registros DNS existentes

---

### **Paso 3: Instrucciones Importantes**

Antes de agregar los registros, ten en cuenta:

- ✅ **Agrega TODOS los 6 registros** listados en la tabla de arriba
- ✅ **NO elimines ni reemplaces** registros existentes - Si ya tienes registros con los mismos nombres, crea nuevos
- ✅ **Copia y pega exactamente** los valores de "Host" y "Value" desde la tabla resumen
- ✅ **Empieza con la columna "Type"** para cada registro al crear en Cloudflare

---

### **Paso 4: Agregar Registros TXT (SPF, DKIM, DMARC)**

Necesitas agregar **3 registros TXT** para la autenticación de correo:

#### **Registro 1: SPF (Sender Policy Framework)**

1. Haz clic en **"+ Add record"**
2. Completa el formulario:

```
Type:        TXT
Name:        kjbm
Content:     v=spf1 include:mailgun.org ~all
TTL:         Auto
```

3. Haz clic en **"Save"**

#### **Registro 2: DKIM (DomainKeys Identified Mail)**

1. Haz clic en **"+ Add record"**
2. Completa el formulario:

```
Type:        TXT
Name:        pic._domainkey.kjbm
Content:     k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDe7wwAsAOvmJ8oio0wVhBfJyCs/4IDdSpsO+fx0NfFheaQgZQnnRKjHT6BTwMpno0B5fO8qEMB/3JQ34y8xxbLStsVcr7rdLLZFcwEkD87jg5ZR9dJML/bwVT5KSKFzBxAwJ14o3Redag+DqAayjXI88n/IUXEz6A+4nSB6RnpUwIDAQAB
TTL:         Auto
```

3. Haz clic en **"Save"**

#### **Registro 3: DMARC (Domain-based Message Authentication)**

1. Haz clic en **"+ Add record"**
2. Completa el formulario:

```
Type:        TXT
Name:        _dmarc.kjbm
Content:     v=DMARC1; p=none; pct=100; fo=1; ri=3600; rua=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com; ruf=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com
TTL:         Auto
```

3. Haz clic en **"Save"**

---

### **Paso 5: Agregar Registros MX (Mail Exchange)**

Necesitas agregar **2 registros MX** para el enrutamiento de correo:

#### **Registro MX 1 (Prioridad 10)**

1. Haz clic en **"+ Add record"**
2. Completa el formulario:

```
Type:        MX
Name:        kjbm
Mail server: mxa.mailgun.org
Priority:    10
TTL:         Auto
```

3. Haz clic en **"Save"**

#### **Registro MX 2 (Prioridad 20)**

1. Haz clic en **"+ Add record"**
2. Completa el formulario:

```
Type:        MX
Name:        kjbm
Mail server: mxb.mailgun.org
Priority:    20
TTL:         Auto
```

3. Haz clic en **"Save"**

---

### **Paso 6: Agregar Registro CNAME**

1. Haz clic en **"+ Add record"**
2. Completa el formulario:

```
Type:        CNAME
Name:        email.kjbm
Target:      mailgun.org
Proxy status: ⚪ DNS only (gris - DESACTIVADO)
TTL:         Auto
```

⚠️ **IMPORTANTE:** Para registros CNAME de correo, el Proxy debe estar **DESACTIVADO** (DNS only - gris)

3. Haz clic en **"Save"**

---

## ✅ Verificación de Registros

Después de agregar todos los registros, deberías ver en la lista de DNS:

```
Type    Name                  Content/Value                    Priority    Proxy
TXT     kjbm                  v=spf1 include:mailgun.org ~all              -
TXT     pic._domainkey.kjbm   k=rsa; p=MIGfMA0GCSqGSIb3DQ...              -
TXT     _dmarc.kjbm           v=DMARC1; p=none; pct=100...                -
MX      kjbm                  mxa.mailgun.org                 10          -
MX      kjbm                  mxb.mailgun.org                 20          -
CNAME   email.kjbm            mailgun.org                                 DNS only
```

---

## ⏱️ Tiempo de Propagación

- **Tiempo estimado:** 5-30 minutos
- Los cambios DNS pueden tardar en propagarse
- Puedes verificar el estado en el panel de Kajabi

---

## 🔍 Verificación de Configuración

### **Desde la Terminal (Opcional)**

Puedes verificar que los registros están configurados correctamente:

```bash
# Verificar registro SPF
dig TXT kjbm.eugenihidalgo.org +short

# Verificar registro DKIM
dig TXT pic._domainkey.kjbm.eugenihidalgo.org +short

# Verificar registro DMARC
dig TXT _dmarc.kjbm.eugenihidalgo.org +short

# Verificar registros MX
dig MX kjbm.eugenihidalgo.org +short

# Verificar registro CNAME
dig CNAME email.kjbm.eugenihidalgo.org +short
```

**Nota:** En Cloudflare, el campo "Name" solo requiere `kjbm` (sin el dominio completo), pero al verificar desde la terminal debes usar el dominio completo.

---

## 🐛 Solución de Problemas

### **Los registros no aparecen después de agregarlos**

1. **Espera unos minutos** - La propagación DNS puede tardar
2. **Verifica que no haya registros duplicados** - No debes tener múltiples registros del mismo tipo con el mismo nombre
3. **Limpia la caché de tu navegador** y recarga la página

### **Error al guardar registros**

1. **Verifica el formato del contenido:**
   - Los registros TXT deben tener el contenido exacto (sin espacios extra)
   - Los registros MX deben tener la prioridad correcta (10 y 20)
   - El CNAME debe apuntar exactamente a `mailgun.org`

2. **Verifica que no existan registros conflictivos:**
   - No debes tener otros registros con los mismos nombres
   - Si existen, elimínalos primero o usa nombres diferentes

### **Los emails aún no se envían desde el dominio personalizado**

1. **Espera la propagación completa** (puede tardar hasta 30 minutos)
2. **Verifica en Kajabi** que la configuración esté completa
3. **Revisa que todos los 6 registros estén agregados correctamente**
4. **Si el estado sigue en "Setup pending":**
   - Espera hasta 30 minutos después de agregar los registros
   - Verifica que los registros estén correctamente guardados en Cloudflare
   - Asegúrate de que el dominio en Kajabi sea exactamente `kjbm.eugenihidalgo.org`

---

## 📧 Configuración en Kajabi (Después de DNS)

Una vez que los registros DNS se hayan verificado (el estado cambie de "Setup pending" a "Active"), configura los siguientes campos en Kajabi:

### **From name (Nombre del remitente)**
- **Ejemplo:** `Eugeni Hidalgo`
- Este es el nombre que aparecerá como remitente en los emails

### **From email (Email del remitente)**
- **Formato:** `[usuario]@kjbm.eugenihidalgo.org`
- **Ejemplo:** `pdeeugenihidalgo@kjbm.eugenihidalgo.org`
- Este es el email desde el cual se enviarán tus emails de marketing

### **Reply-to email (Email de respuesta)**
- **Formato:** `[usuario]@eugenihidalgo.org`
- **Ejemplo:** `eugeni@eugenihidalgo.org`
- Este es el email donde recibirás las respuestas a tus emails

### **Preview (Vista previa)**

Después de configurar, deberías ver algo como:

```
from: Eugeni Hidalgo <pdeeugenihidalgo@kjbm.eugenihidalgo.org>
reply-to: eugeni@eugenihidalgo.org
mailed by: kjbm.eugenihidalgo.org
```

**⚠️ Importante:** No podrás guardar estos cambios hasta que el estado DNS cambie de "Setup pending" a "Active" o "Verified".

---

## 📝 Notas Importantes

- ✅ **NO elimines** registros existentes a menos que sean conflictivos
- ✅ **NO actives el Proxy** en registros MX o CNAME de correo (deben estar en "DNS only")
- ✅ **Copia y pega exactamente** los valores proporcionados por Kajabi
- ✅ **Verifica** que todos los registros estén guardados correctamente antes de cerrar Cloudflare

---

## 🎯 Resumen Rápido

1. ✅ Ve a Cloudflare Dashboard → DNS
2. ✅ Revisa la tabla resumen de arriba con los 6 registros necesarios
3. ✅ Agrega los 3 registros TXT (SPF, DKIM, DMARC) - Copia Host y Value exactamente
4. ✅ Agrega los 2 registros MX (prioridades 10 y 20) - NO actives Proxy
5. ✅ Agrega el 1 registro CNAME - Proxy DESACTIVADO (DNS only)
6. ✅ Verifica que todos los 6 registros estén guardados correctamente
7. ✅ Espera 5-30 minutos para la propagación DNS
8. ✅ Verifica en Kajabi que el estado cambie de "Setup pending" a "Active"
9. ✅ Configura From name, From email y Reply-to email en Kajabi

---

*Guía de correo electrónico agregada: $(date)*
*Versión: AuriPortal v3.1*






