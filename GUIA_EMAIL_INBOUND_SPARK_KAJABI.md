# 📧 Guía Completa: Email Inbound con SparkPost y Kajabi

## 🎯 Objetivo

Configurar un sistema completo de email que permita:
- ✅ **Recibir emails** (inbound) mediante webhooks
- ✅ **Enviar emails** con SparkPost
- ✅ **Integrar con Kajabi** para sincronizar contactos y eventos
- ✅ **Automatización completa** con APIs

---

## 🏆 Mejor Proveedor: Mailgun (Recomendado)

### ¿Por qué Mailgun?

**Mailgun** es la mejor opción porque:

1. ✅ **Inbound Email (Recepción)**: Sistema completo de recepción de emails
2. ✅ **Webhooks Avanzados**: Eventos en tiempo real para cada email recibido
3. ✅ **API REST Completa**: Control total desde código
4. ✅ **Integración con SparkPost**: Fácil de combinar ambos servicios
5. ✅ **Integración con Kajabi**: Webhooks compatibles
6. ✅ **Plan Generoso**: 5,000 emails/mes gratis (primeros 3 meses), luego $35/mes para 50K

### Alternativa: SparkPost (Solo Envío)

**SparkPost** es excelente para **enviar** emails, pero:
- ❌ No tiene recepción de emails nativa
- ✅ Excelente para emails transaccionales
- ✅ Muy buena reputación de entrega
- ✅ Plan gratuito: 500 emails/mes

**Recomendación**: Usar **Mailgun** para todo (envío + recepción) O combinar **Mailgun (inbound)** + **SparkPost (outbound)**.

---

## 🚀 Configuración Completa

### Opción 1: Mailgun Todo-en-Uno (Recomendado)

#### Paso 1: Crear Cuenta en Mailgun

1. Ve a: https://www.mailgun.com
2. Crea una cuenta gratuita
3. Verifica tu dominio (ej: `eugenihidalgo.work`)
4. Obtén tus credenciales:
   - **API Key**: `key-xxxxxxxxxxxxx`
   - **Domain**: `mg.eugenihidalgo.work` (o tu dominio verificado)

#### Paso 2: Configurar Variables de Entorno

Agrega al archivo `.env`:

```env
# Mailgun - Envío y Recepción
MAILGUN_API_KEY=key-tu_api_key_aqui
MAILGUN_DOMAIN=mg.eugenihidalgo.work
MAILGUN_WEBHOOK_SECRET=tu_secreto_aleatorio_aqui

# Email de recepción (inbound)
INBOUND_EMAIL=contacto@eugenihidalgo.work

# Email remitente
EMAIL_FROM=eugeni@eugenihidalgo.work
```

#### Paso 3: Instalar Dependencias

```bash
cd /var/www/aurelinportal
npm install mailgun.js
```

**Nota**: El `package.json` ya está actualizado con la dependencia. Solo ejecuta `npm install`.

#### Paso 4: Crear Servicio de Email con Mailgun

Crea el archivo: `src/services/email-mailgun.js`

```javascript
// src/services/email-mailgun.js
// Servicio de email usando Mailgun (envío + recepción)

import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
});

/**
 * Envía un email usando Mailgun
 */
export async function enviarEmail(destinatario, asunto, texto, html = null) {
  try {
    const data = {
      from: process.env.EMAIL_FROM || `noreply@${process.env.MAILGUN_DOMAIN}`,
      to: destinatario,
      subject: asunto,
      text: texto,
      html: html || texto.replace(/\n/g, '<br>')
    };

    const response = await mg.messages.create(process.env.MAILGUN_DOMAIN, data);
    return {
      success: true,
      messageId: response.id,
      message: response.message
    };
  } catch (error) {
    console.error('Error enviando email con Mailgun:', error);
    throw error;
  }
}

/**
 * Verifica la firma del webhook de Mailgun
 */
export function verificarWebhookMailgun(timestamp, token, signature) {
  const crypto = require('crypto');
  const encodedToken = crypto
    .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SECRET)
    .update(timestamp.concat(token))
    .digest('hex');
  
  return encodedToken === signature;
}
```

#### Paso 5: Crear Endpoint para Recibir Emails (Webhook)

Crea el archivo: `src/endpoints/email-inbound.js`

```javascript
// src/endpoints/email-inbound.js
// Endpoint para recibir emails de Mailgun (inbound webhook)

import { verificarWebhookMailgun } from '../services/email-mailgun.js';
import { buscarPersonaPorEmail, obtenerDatosCompletosPersona } from '../services/kajabi.js';

export default async function emailInboundHandler(request, env, ctx) {
  // Solo aceptar POST
  if (request.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  try {
    const formData = await request.formData();
    
    // Verificar firma del webhook (seguridad)
    const signature = formData.get('signature');
    const token = formData.get('token');
    const timestamp = formData.get('timestamp');
    
    if (!verificarWebhookMailgun(timestamp, token, signature)) {
      console.error('❌ Webhook de Mailgun no verificado');
      return new Response('Unauthorized', { status: 401 });
    }

    // Extraer datos del email recibido
    const remitente = formData.get('sender');
    const destinatario = formData.get('recipient');
    const asunto = formData.get('subject');
    const cuerpoTexto = formData.get('body-plain');
    const cuerpoHtml = formData.get('body-html');
    const messageId = formData.get('Message-Id');

    console.log(`📧 Email recibido de ${remitente} a ${destinatario}`);
    console.log(`   Asunto: ${asunto}`);

    // 1. Buscar contacto en Kajabi
    let contactoKajabi = null;
    try {
      contactoKajabi = await buscarPersonaPorEmail(
        remitente,
        env.KAJABI_CLIENT_ID,
        env.KAJABI_CLIENT_SECRET
      );
      
      if (contactoKajabi) {
        console.log(`✅ Contacto encontrado en Kajabi: ${contactoKajabi.name} (ID: ${contactoKajabi.id})`);
      } else {
        console.log(`⚠️  Contacto no encontrado en Kajabi: ${remitente}`);
      }
    } catch (err) {
      console.error(`❌ Error buscando en Kajabi: ${err.message}`);
    }

    // 2. Procesar el email (guardar en base de datos, enviar notificación, etc.)
    // Aquí puedes agregar tu lógica personalizada
    
    // 3. Responder a Mailgun (200 OK)
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });

  } catch (error) {
    console.error('❌ Error procesando email inbound:', error);
    return new Response('Error interno', { status: 500 });
  }
}
```

#### Paso 6: Instalar Dependencias

```bash
cd /var/www/aurelinportal
npm install
```

#### Paso 7: Configurar Webhook en Mailgun

1. Ve a tu dashboard de Mailgun: https://app.mailgun.com
2. Ve a **Receiving** → **Routes**
3. Crea una nueva ruta:
   - **Expression Type**: `match_recipient`
   - **Recipient**: `contacto@eugenihidalgo.work` (tu email de recepción)
   - **Action**: `forward("https://pdeeugenihidalgo.org/api/email-inbound")`
   - **Action**: `store(notify="https://pdeeugenihidalgo.org/api/email-inbound")`

4. Guarda la ruta

#### Paso 8: Agregar Ruta al Router

Edita `src/router.js` y agrega:

```javascript
import emailInboundHandler from './endpoints/email-inbound.js';

// ... en las rutas ...
router.post('/api/email-inbound', emailInboundHandler);
```

---

### Opción 2: Mailgun (Inbound) + SparkPost (Outbound)

Si prefieres usar **SparkPost** para enviar emails (mejor reputación), puedes combinar ambos:

#### Configuración SparkPost

1. Crea cuenta en: https://www.sparkpost.com
2. Verifica tu dominio
3. Obtén tu API Key

Agrega al `.env`:

```env
# SparkPost - Solo Envío
SPARKPOST_API_KEY=tu_api_key_aqui
SPARKPOST_DOMAIN=eugenihidalgo.work

# Mailgun - Solo Recepción
MAILGUN_API_KEY=key-tu_api_key_aqui
MAILGUN_DOMAIN=mg.eugenihidalgo.work
MAILGUN_WEBHOOK_SECRET=tu_secreto_aleatorio_aqui
```

#### Servicio Combinado

Crea `src/services/email-combined.js`:

```javascript
// src/services/email-combined.js
// Mailgun para recibir, SparkPost para enviar

import formData from 'form-data';
import Mailgun from 'mailgun.js';
import nodemailer from 'nodemailer';

// Mailgun para inbound (ya configurado arriba)
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
});

// SparkPost para outbound
const sparkpostTransporter = nodemailer.createTransport({
  host: 'smtp.sparkpostmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'SMTP_Injection',
    pass: process.env.SPARKPOST_API_KEY
  }
});

/**
 * Envía email con SparkPost
 */
export async function enviarEmailSparkPost(destinatario, asunto, texto, html = null) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: destinatario,
    subject: asunto,
    text: texto,
    html: html || texto.replace(/\n/g, '<br>')
  };

  const info = await sparkpostTransporter.sendMail(mailOptions);
  return {
    success: true,
    messageId: info.messageId
  };
}

/**
 * Verifica webhook de Mailgun (mismo código de arriba)
 */
export function verificarWebhookMailgun(timestamp, token, signature) {
  // ... mismo código ...
}
```

---

## 🔗 Integración con Kajabi

### Webhooks de Kajabi para Emails

Kajabi tiene webhooks que puedes usar para sincronizar eventos:

#### Eventos Disponibles en Kajabi:

1. **`form_submission`**: Cuando alguien envía un formulario
2. **`purchase`**: Cuando alguien hace una compra
3. **`tag_added`**: Cuando se agrega un tag a un contacto
4. **`tag_removed`**: Cuando se remueve un tag

#### Crear Webhook en Kajabi

Usa la API de Kajabi para crear webhooks:

```javascript
// src/services/kajabi-webhooks.js
import { obtenerAccessToken } from './kajabi.js';

/**
 * Crea un webhook en Kajabi
 */
export async function crearWebhookKajabi(evento, targetUrl, siteId, env) {
  const accessToken = await obtenerAccessToken(
    env.KAJABI_CLIENT_ID,
    env.KAJABI_CLIENT_SECRET
  );

  const response = await fetch('https://api.kajabi.com/v1/hooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json'
    },
    body: JSON.stringify({
      data: {
        type: 'hooks',
        attributes: {
          target_url: targetUrl,
          event: evento // 'form_submission', 'purchase', etc.
        },
        relationships: {
          site: {
            data: {
              id: siteId,
              type: 'sites'
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Error creando webhook: ${response.status}`);
  }

  return await response.json();
}
```

#### Endpoint para Recibir Webhooks de Kajabi

Crea `src/endpoints/kajabi-webhook.js`:

```javascript
// src/endpoints/kajabi-webhook.js
// Recibe webhooks de Kajabi

export default async function kajabiWebhookHandler(request, env, ctx) {
  if (request.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  try {
    const payload = await request.json();
    const { id, event, payload: data } = payload;

    console.log(`📥 Webhook de Kajabi recibido: ${event}`);

    switch (event) {
      case 'form_submission':
        // Procesar envío de formulario
        console.log(`   Formulario enviado por: ${data.email}`);
        // Aquí puedes enviar un email de confirmación, etc.
        break;

      case 'purchase':
        // Procesar compra
        console.log(`   Compra realizada por: ${data.email}`);
        // Enviar email de bienvenida, etc.
        break;

      case 'tag_added':
        // Tag agregado
        console.log(`   Tag agregado a: ${data.email}`);
        break;
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('❌ Error procesando webhook de Kajabi:', error);
    return new Response('Error', { status: 500 });
  }
}
```

---

## 📋 Resumen de Configuración

### Flujo Completo:

```
Email Recibido → Mailgun → Webhook → Tu Servidor → Procesar → Kajabi
                                                          ↓
Email Enviado ← SparkPost/Mailgun ← Tu Servidor ← Evento Kajabi
```

### Archivos Creados:

1. ✅ `src/services/email-mailgun.js` - Servicio de Mailgun (✅ CREADO)
2. ✅ `src/endpoints/email-inbound.js` - Endpoint para recibir emails (✅ CREADO)
3. ✅ `src/endpoints/kajabi-webhook.js` - Endpoint para webhooks de Kajabi (✅ CREADO)
4. ✅ `src/services/kajabi-webhooks.js` - Utilidades para webhooks de Kajabi (✅ CREADO)
5. ✅ `scripts/configurar-webhooks-email.js` - Script para configurar webhooks automáticamente (✅ CREADO)
6. ✅ `src/router.js` - Router actualizado con nuevas rutas (✅ ACTUALIZADO)

### Variables de Entorno:

```env
# Mailgun
MAILGUN_API_KEY=key-xxxxx
MAILGUN_DOMAIN=mg.eugenihidalgo.work
MAILGUN_WEBHOOK_SECRET=secreto_aleatorio

# SparkPost (opcional)
SPARKPOST_API_KEY=xxxxx
SPARKPOST_DOMAIN=eugenihidalgo.work

# Email
EMAIL_FROM=eugeni@eugenihidalgo.work
INBOUND_EMAIL=contacto@eugenihidalgo.work

# Kajabi (ya configurado)
KAJABI_CLIENT_ID=xxxxx
KAJABI_CLIENT_SECRET=xxxxx
```

---

## ⚙️ Configuración Automática de Webhooks

Puedes usar el script incluido para configurar los webhooks de Kajabi automáticamente:

```bash
cd /var/www/aurelinportal
node scripts/configurar-webhooks-email.js
```

Este script:
- ✅ Obtiene el siteId de Kajabi automáticamente
- ✅ Lista webhooks existentes
- ✅ Crea los webhooks recomendados (form_submission, purchase, payment_succeeded, tag_added)
- ✅ Evita duplicados

**Nota**: Asegúrate de tener configurado `BASE_URL` en `.env` o ajusta la URL en el script.

---

## 🧪 Pruebas

### Probar Recepción de Emails:

```bash
# Enviar email de prueba a tu dirección de recepción
curl -X POST https://api.mailgun.net/v3/mg.eugenihidalgo.work/messages \
  -u 'api:key-tu_api_key' \
  -F from='test@example.com' \
  -F to='contacto@eugenihidalgo.work' \
  -F subject='Test Email' \
  -F text='Este es un email de prueba'
```

### Verificar Logs:

```bash
# Ver logs del servidor
pm2 logs aurelinportal

# Ver logs de Mailgun
# Ve a: https://app.mailgun.com → Logs
```

---

## 💡 Casos de Uso

### 1. Auto-Respuesta a Emails

Cuando recibes un email, puedes:
- Buscar el contacto en Kajabi
- Enviar respuesta automática
- Crear tarea en ClickUp
- Guardar en base de datos

### 2. Sincronización Bidireccional

- Email recibido → Actualizar contacto en Kajabi
- Compra en Kajabi → Enviar email de confirmación
- Tag agregado en Kajabi → Enviar email personalizado

### 3. Automatización Completa

- Formulario en Kajabi → Email de bienvenida
- Email recibido → Crear contacto en Kajabi (si no existe)
- Compra → Email con acceso al curso

---

## 🔒 Seguridad

1. ✅ **Verificar webhooks**: Siempre verifica la firma de Mailgun
2. ✅ **HTTPS**: Usa HTTPS para todos los webhooks
3. ✅ **Secrets**: Guarda todos los secrets en `.env`
4. ✅ **Rate Limiting**: Implementa rate limiting en tus endpoints

---

## 📚 Recursos

- **Mailgun Docs**: https://documentation.mailgun.com/
- **SparkPost Docs**: https://www.sparkpost.com/docs/
- **Kajabi API**: https://developers.kajabi.com/
- **Nodemailer**: https://nodemailer.com/

---

**¿Necesitas ayuda configurando esto? Puedo crear los archivos completos para ti.** 🚀

