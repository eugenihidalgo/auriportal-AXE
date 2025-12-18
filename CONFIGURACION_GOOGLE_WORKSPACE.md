# Configuración de Google Workspace - vegasquestfantasticworld.win

**Fecha:** 11 de Diciembre, 2025  
**Dominio:** vegasquestfantasticworld.win  
**Estado:** ⚠️ Requiere acción manual

---

## ⚠️ PROBLEMA IDENTIFICADO

**Cloudflare Email Routing está activo** en este dominio, lo que impide modificar los registros MX a través de la API. Los registros MX están siendo gestionados automáticamente por Email Routing.

### Error Encontrado
```
Error: This zone is managed by Email Routing. 
Disable Email Routing to add/modify MX records.
```

---

## ✅ COMPLETADO AUTOMÁTICAMENTE

### 1. Registros SPF Antiguos Eliminados ✅
- ✅ `v=spf1 include:spf.privateemail.com ~all` - Eliminado
- ✅ `v=spf1 include:_spf.mx.cloudflare.net ~all` - Eliminado

### 2. SPF de Google Workspace Configurado ✅
- ✅ **Estado:** CORRECTO
- ✅ **Contenido:** `v=spf1 include:_spf.google.com ~all`
- ✅ **Resolución DNS:** Activa

---

## ⚠️ ACCIONES MANUALES REQUERIDAS

### Paso 1: Desactivar Cloudflare Email Routing

1. **Accede a Cloudflare Dashboard:**
   - Ve a: https://dash.cloudflare.com
   - Selecciona el dominio: `vegasquestfantasticworld.win`

2. **Desactiva Email Routing:**
   - Ve a **Email** → **Email Routing**
   - Haz clic en **Disable Email Routing** o **Turn off Email Routing**
   - Confirma la desactivación

3. **Espera la eliminación automática:**
   - Cloudflare eliminará automáticamente los registros MX de Email Routing:
     - `route1.mx.cloudflare.net`
     - `route2.mx.cloudflare.net`
     - `route3.mx.cloudflare.net`

### Paso 2: Eliminar Registros MX de Mailgun

Después de desactivar Email Routing, elimina manualmente los registros MX de Mailgun:

1. **Ve a DNS Records:**
   - Cloudflare Dashboard → **DNS** → **Records**

2. **Elimina los siguientes registros MX:**
   - `mxa.mailgun.org` (Priority: 10)
   - `mxb.mailgun.org` (Priority: 20)

### Paso 3: Agregar Registros MX de Google Workspace

Una vez que Email Routing esté desactivado y los registros MX antiguos eliminados:

1. **Agrega los 5 registros MX de Google Workspace:**

   | Priority | Host |
   |----------|------|
   | 1 | `aspmx.l.google.com` |
   | 5 | `alt1.aspmx.l.google.com` |
   | 5 | `alt2.aspmx.l.google.com` |
   | 10 | `alt3.aspmx.l.google.com` |
   | 10 | `alt4.aspmx.l.google.com` |

2. **Pasos en Cloudflare:**
   - Click en **Add record**
   - Tipo: **MX**
   - Name: `@` (o deja en blanco para la raíz del dominio)
   - Mail server: (el host de la tabla arriba)
   - Priority: (la prioridad de la tabla arriba)
   - Proxy status: **DNS only** (gris, NO proxied)
   - TTL: **Auto**
   - Click **Save**
   - Repite para los 5 registros

### Paso 4: Verificar Configuración

Después de completar los pasos anteriores, ejecuta el script de verificación:

```bash
node scripts/configurar-google-workspace-email.js
```

O verifica manualmente en Cloudflare Dashboard que:
- ✅ Solo existen los 5 registros MX de Google Workspace
- ✅ El SPF es: `v=spf1 include:_spf.google.com ~all`
- ✅ No hay registros MX adicionales

---

## 📊 ESTADO ACTUAL

### Registros MX Actuales (ANTES de desactivar Email Routing)
- ⚠️ `route1.mx.cloudflare.net` (Priority: 42) - Email Routing
- ⚠️ `route2.mx.cloudflare.net` (Priority: 85) - Email Routing
- ⚠️ `route3.mx.cloudflare.net` (Priority: 65) - Email Routing
- ⚠️ `mxa.mailgun.org` (Priority: 10) - Mailgun
- ⚠️ `mxb.mailgun.org` (Priority: 20) - Mailgun

### Registros MX Esperados (DESPUÉS de la configuración)
- ✅ `aspmx.l.google.com` (Priority: 1) - Google Workspace
- ✅ `alt1.aspmx.l.google.com` (Priority: 5) - Google Workspace
- ✅ `alt2.aspmx.l.google.com` (Priority: 5) - Google Workspace
- ✅ `alt3.aspmx.l.google.com` (Priority: 10) - Google Workspace
- ✅ `alt4.aspmx.l.google.com` (Priority: 10) - Google Workspace

### Registro SPF
- ✅ **Estado:** CORRECTO
- ✅ **Contenido:** `v=spf1 include:_spf.google.com ~all`
- ✅ **Resolución DNS:** Activa

---

## 🔧 SCRIPT DE VERIFICACIÓN POST-CONFIGURACIÓN

Una vez completados los pasos manuales, puedes ejecutar el script nuevamente para verificar:

```bash
cd /var/www/aurelinportal
node scripts/configurar-google-workspace-email.js
```

El script verificará:
- ✅ Que solo existan los 5 registros MX de Google
- ✅ Que el SPF esté correctamente configurado
- ✅ Que no haya registros conflictivos
- ✅ La resolución DNS

---

## 📝 NOTAS IMPORTANTES

1. **Email Routing debe desactivarse primero:**
   - No es posible modificar registros MX mientras Email Routing está activo
   - Cloudflare gestiona estos registros automáticamente

2. **Propagación DNS:**
   - Los cambios pueden tardar 5-15 minutos en propagarse completamente
   - Verifica la resolución DNS después de completar la configuración

3. **Google Workspace:**
   - Asegúrate de que Google Workspace esté configurado para este dominio
   - Google puede requerir verificación de dominio antes de activar el email

4. **Backup:**
   - Antes de hacer cambios, considera hacer un backup de la configuración DNS actual
   - Puedes exportar los registros DNS desde Cloudflare Dashboard

---

## ✅ CHECKLIST DE CONFIGURACIÓN

- [ ] Desactivar Cloudflare Email Routing
- [ ] Eliminar registros MX de Mailgun (mxa.mailgun.org, mxb.mailgun.org)
- [ ] Agregar 5 registros MX de Google Workspace
- [ ] Verificar que el SPF sea: `v=spf1 include:_spf.google.com ~all`
- [ ] Verificar resolución DNS
- [ ] Probar envío/recepción de emails

---

**Documento generado automáticamente el:** 11 de Diciembre, 2025  
**Script utilizado:** `scripts/configurar-google-workspace-email.js`
















