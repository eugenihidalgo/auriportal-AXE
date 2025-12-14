# 📧 Resumen Rápido: 5 Emails + Spark + Automatización

## 🎯 Solución Recomendada

**Zoho Mail (5 usuarios gratis) + Mailgun (automatización)**

---

## ✅ Por Qué Esta Combinación

| Necesidad | Solución | Resultado |
|-----------|----------|-----------|
| **5+ emails** | Zoho Mail (5 gratis) | ✅ 5 usuarios sin costo |
| **Ver en Spark** | Zoho Mail IMAP | ✅ Todas las bandejas unificadas |
| **Automatización** | Mailgun API | ✅ Webhooks y APIs completas |
| **Integración Kajabi** | Mailgun webhooks | ✅ Automatización completa |

---

## 🚀 Configuración Rápida (3 Pasos)

### 1. Zoho Mail (30 minutos)

1. Crear cuenta: https://www.zoho.com/mail/
2. Verificar dominio `eugenihidalgo.work`
3. Crear 5 usuarios:
   - `eugeni@eugenihidalgo.work`
   - `contacto@eugenihidalgo.work`
   - `soporte@eugenihidalgo.work`
   - `ventas@eugenihidalgo.work`
   - `info@eugenihidalgo.work`
4. Configurar DNS en Cloudflare:
   - MX: `mx.zoho.com`
   - SPF: `v=spf1 include:zoho.com ~all`
   - DKIM: (lo que te dé Zoho)

### 2. Spark (15 minutos)

Para cada cuenta:
1. Abre Spark
2. **Spark** → **Añadir cuenta**
3. Selecciona "Cuenta de correo privada"
4. Ingresa email y contraseña
5. Spark detectará automáticamente la configuración

**Resultado**: Verás todas las 5 bandejas de entrada unificadas en Spark.

### 3. Mailgun (20 minutos)

1. Crear cuenta: https://www.mailgun.com
2. Verificar dominio
3. Configurar webhook:
   - **Routes** → **Create Route**
   - **Expression**: `match_recipient`
   - **Recipient**: `contacto@eugenihidalgo.work`
   - **Action**: `forward("https://pdeeugenihidalgo.org/api/email-inbound")`
   - **Action (opcional)**: `forward("eugeni@eugenihidalgo.work")` (para ver en Spark)

---

## 💰 Costo Total

- **Zoho Mail**: €0/mes (5 usuarios gratis)
- **Mailgun**: €0/mes (5,000 emails/mes gratis primeros 3 meses)
- **Total**: **€0-35/mes** (dependiendo del uso de Mailgun)

---

## 📋 Variables de Entorno

Agrega al `.env`:

```env
# Zoho Mail
ZOHO_IMAP_SERVER=imap.zoho.com
ZOHO_SMTP_SERVER=smtp.zoho.com

# Mailgun
MAILGUN_API_KEY=key-tu_api_key
MAILGUN_DOMAIN=mg.eugenihidalgo.work
MAILGUN_WEBHOOK_SECRET=secreto_aleatorio

# Emails
INBOUND_EMAIL=contacto@eugenihidalgo.work
EMAIL_FROM=eugeni@eugenihidalgo.work
```

---

## 🔄 Flujo Completo

```
Email Recibido → Mailgun → Webhook → Tu Servidor → Procesar → Kajabi
                                    ↓
                              Reenviar a Zoho → Spark (bandeja unificada)

Email Enviado → Mailgun API → Enviar
```

---

## ✅ Checklist

- [ ] Crear cuenta Zoho Mail
- [ ] Verificar dominio
- [ ] Crear 5 usuarios
- [ ] Configurar DNS
- [ ] Agregar cuentas en Spark
- [ ] Crear cuenta Mailgun
- [ ] Configurar webhook Mailgun
- [ ] Agregar variables .env
- [ ] Probar recepción
- [ ] Probar envío

---

## 📚 Documentación Completa

- **Guía completa**: `GUIA_5_EMAILS_SPARK_AUTOMATIZACION.md`
- **Script de ayuda**: `node scripts/configurar-email-zoho-mailgun.js`

---

**¿Listo para empezar?** 🚀



