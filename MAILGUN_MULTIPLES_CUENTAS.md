# 📧 Mailgun: Múltiples Cuentas y Direcciones de Email

## ✅ Lo que Mailgun SÍ Puede Hacer

### 1. Múltiples Dominios
- ✅ **Hasta 1,000 dominios** en una cuenta de pago
- ✅ Cada dominio puede tener múltiples direcciones de email
- ✅ Credenciales SMTP específicas por dominio
- ✅ Claves de API por dominio

### 2. Múltiples Direcciones de Email
- ✅ Puedes recibir emails a **cualquier dirección** en tus dominios
- ✅ Ejemplo: `contacto@`, `ventas@`, `soporte@`, `info@`, `eugeni@` (todos en el mismo dominio)
- ✅ Configuración de **inbound routing** para cada dirección

### 3. Múltiples Usuarios en la Cuenta
- ✅ Puedes agregar usuarios adicionales a tu cuenta Mailgun
- ✅ Diferentes roles y permisos
- ✅ Útil para equipos

### 4. Inbound Routing (Recepción)
- ✅ Puedes configurar rutas para recibir emails a diferentes direcciones
- ✅ Cada dirección puede tener su propio webhook
- ✅ Puedes reenviar a diferentes destinos

---

## ❌ Lo que Mailgun NO Puede Hacer

### 1. Servidor IMAP
- ❌ **Mailgun NO tiene servidor IMAP**
- ❌ No puedes usar Spark directamente con Mailgun
- ❌ No puedes leer emails desde un cliente de email tradicional

### 2. Bandeja de Entrada Tradicional
- ❌ No tiene interfaz web para leer emails
- ❌ No es un servicio de email empresarial tradicional
- ❌ Está diseñado para automatización, no para uso personal

---

## 🎯 Soluciones Posibles

### Opción 1: Mailgun Solo (Solo Automatización)

**✅ Ventajas:**
- Múltiples direcciones de email (contacto@, ventas@, etc.)
- Webhooks para cada dirección
- Automatización completa
- API potente

**❌ Desventajas:**
- No puedes usar Spark para leer emails
- No hay bandeja de entrada tradicional
- Solo para automatización, no para uso personal

**Ideal para:** Automatización pura, sin necesidad de leer emails manualmente.

---

### Opción 2: Mailgun + Zoho Mail (Recomendado)

**✅ Ventajas:**
- Mailgun: Automatización y APIs
- Zoho Mail: Email empresarial con IMAP (compatible con Spark)
- Reenvío automático: Emails recibidos en Mailgun → Zoho Mail → Spark

**Configuración:**
```
Email Recibido → Mailgun (webhook) → Tu Servidor → Procesar
                                    ↓
                              Reenviar a Zoho Mail → Spark
```

**Ideal para:** Necesitas automatización + leer emails en Spark.

---

### Opción 3: Solo Zoho Mail (Sin Automatización)

**✅ Ventajas:**
- 5 usuarios gratis
- IMAP completo (compatible con Spark)
- Bandeja de entrada tradicional
- Calendario y contactos

**❌ Desventajas:**
- No tiene API para automatización
- No tiene webhooks
- Solo SMTP/IMAP tradicional

**Ideal para:** Solo necesitas email empresarial, sin automatización.

---

## 🔧 Configuración: Mailgun con Múltiples Direcciones

### Paso 1: Agregar Múltiples Direcciones en Mailgun

1. Ve a: https://app.mailgun.com
2. Selecciona tu dominio
3. Ve a **Receiving** → **Routes**

### Paso 2: Crear Rutas para Cada Dirección

**Ruta 1: contacto@**
```
Expression Type: match_recipient
Recipient: contacto@eugenihidalgo.work
Action: forward("https://pdeeugenihidalgo.org/api/email-inbound?tipo=contacto")
Action: store(notify="https://pdeeugenihidalgo.org/api/email-inbound?tipo=contacto")
```

**Ruta 2: ventas@**
```
Expression Type: match_recipient
Recipient: ventas@eugenihidalgo.work
Action: forward("https://pdeeugenihidalgo.org/api/email-inbound?tipo=ventas")
```

**Ruta 3: soporte@**
```
Expression Type: match_recipient
Recipient: soporte@eugenihidalgo.work
Action: forward("https://pdeeugenihidalgo.org/api/email-inbound?tipo=soporte")
```

**Ruta 4: info@**
```
Expression Type: match_recipient
Recipient: info@eugenihidalgo.work
Action: forward("https://pdeeugenihidalgo.org/api/email-inbound?tipo=info")
```

**Ruta 5: eugeni@**
```
Expression Type: match_recipient
Recipient: eugeni@eugenihidalgo.work
Action: forward("https://pdeeugenihidalgo.org/api/email-inbound?tipo=personal")
Action: forward("eugeni@eugenihidalgo.work")  # Reenviar a Zoho Mail
```

### Paso 3: Actualizar Endpoint para Manejar Diferentes Tipos

Modifica `src/endpoints/email-inbound.js` para detectar el tipo:

```javascript
// Detectar tipo de email desde query params o del destinatario
const url = new URL(request.url);
const tipo = url.searchParams.get('tipo') || detectarTipo(emailData.destinatario);

function detectarTipo(destinatario) {
  if (destinatario.includes('contacto@')) return 'contacto';
  if (destinatario.includes('ventas@')) return 'ventas';
  if (destinatario.includes('soporte@')) return 'soporte';
  if (destinatario.includes('info@')) return 'info';
  return 'general';
}

// Procesar según el tipo
switch (tipo) {
  case 'contacto':
    // Lógica específica para contacto
    break;
  case 'ventas':
    // Lógica específica para ventas
    break;
  // etc.
}
```

---

## 🔄 Flujo Completo: Mailgun Múltiples Direcciones

```
contacto@ → Mailgun → Webhook → Tu Servidor → Procesar → Kajabi
ventas@   → Mailgun → Webhook → Tu Servidor → Procesar → Kajabi
soporte@  → Mailgun → Webhook → Tu Servidor → Procesar → Kajabi
info@     → Mailgun → Webhook → Tu Servidor → Procesar → Kajabi
eugeni@   → Mailgun → Webhook → Tu Servidor → Procesar → Kajabi
                    ↓
              Reenviar a Zoho Mail → Spark (bandeja unificada)
```

---

## 📊 Comparación: Mailgun vs Zoho Mail

| Característica | Mailgun | Zoho Mail |
|---------------|---------|-----------|
| **Múltiples direcciones** | ✅ Sí (ilimitadas) | ✅ Sí (5 gratis) |
| **IMAP (para Spark)** | ❌ No | ✅ Sí |
| **Webhooks** | ✅✅ Sí | ❌ No |
| **API para automatización** | ✅✅ Sí | ❌ No |
| **Bandeja de entrada** | ❌ No | ✅ Sí |
| **Uso con Spark** | ❌ No directo | ✅✅ Sí |
| **Recepción programática** | ✅✅ Sí | ❌ No |
| **Precio** | $35/50K emails | €0-3/usuario |

---

## 💡 Recomendación Final

### Si Necesitas:

1. **✅ Automatización completa** → **Mailgun** (múltiples direcciones)
2. **✅ Leer emails en Spark** → **Zoho Mail** (5 usuarios gratis)
3. **✅ Ambas cosas** → **Mailgun + Zoho Mail** (híbrido)

### Configuración Híbrida Recomendada:

```
Mailgun:
- contacto@ → Webhook → Tu Servidor
- ventas@ → Webhook → Tu Servidor
- soporte@ → Webhook → Tu Servidor
- info@ → Webhook → Tu Servidor
- eugeni@ → Webhook → Tu Servidor + Reenviar a Zoho

Zoho Mail:
- eugeni@ → IMAP → Spark (para leer/responder)
- contacto@ → IMAP → Spark (opcional)
- ventas@ → IMAP → Spark (opcional)
- soporte@ → IMAP → Spark (opcional)
- info@ → IMAP → Spark (opcional)
```

**Ventajas:**
- ✅ Automatización completa con Mailgun
- ✅ Puedes leer/responder en Spark (Zoho Mail)
- ✅ Múltiples direcciones funcionando
- ✅ Costo: €0-35/mes

---

## 🔧 Script para Configurar Múltiples Rutas en Mailgun

Puedes usar la API de Mailgun para crear rutas automáticamente:

```javascript
// scripts/configurar-rutas-mailgun.js
import formData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
});

const dominio = process.env.MAILGUN_DOMAIN;
const baseUrl = process.env.BASE_URL || 'https://pdeeugenihidalgo.org';

const direcciones = [
  { email: 'contacto@', tipo: 'contacto' },
  { email: 'ventas@', tipo: 'ventas' },
  { email: 'soporte@', tipo: 'soporte' },
  { email: 'info@', tipo: 'info' },
  { email: 'eugeni@', tipo: 'personal' }
];

async function crearRutas() {
  for (const dir of direcciones) {
    const expresion = `match_recipient("${dir.email}${dominio}")`;
    const webhookUrl = `${baseUrl}/api/email-inbound?tipo=${dir.tipo}`;
    
    try {
      await mg.routes.create(dominio, {
        priority: 0,
        description: `Ruta para ${dir.email}`,
        expression: expresion,
        action: [`forward("${webhookUrl}")`, 'stop()']
      });
      
      console.log(`✅ Ruta creada para ${dir.email}`);
    } catch (error) {
      console.error(`❌ Error creando ruta para ${dir.email}:`, error.message);
    }
  }
}

crearRutas();
```

---

## ✅ Resumen

**Mailgun SÍ puede tener múltiples direcciones de email**, pero:
- ✅ Perfecto para automatización y APIs
- ❌ No tiene IMAP (no compatible con Spark directamente)
- ✅ Puedes reenviar a Zoho Mail para ver en Spark

**Solución recomendada:** Mailgun (automatización) + Zoho Mail (lectura en Spark)

---

**¿Quieres que cree el script para configurar las rutas automáticamente?** 🚀



