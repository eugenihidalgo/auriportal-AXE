# 📧 Guía Completa: 5+ Emails + Spark + Automatización

## 🎯 Objetivo

Configurar un sistema que permita:
- ✅ **Mínimo 5 emails distintos**
- ✅ **Todas las bandejas de entrada visibles en Spark**
- ✅ **Automatización con APIs** (Mailgun para webhooks)
- ✅ **Integración con Kajabi**

---

## ⚠️ Importante: Mailgun y Múltiples Direcciones

**Mailgun SÍ puede tener múltiples direcciones de email** (contacto@, ventas@, soporte@, etc.), pero:
- ✅ Perfecto para automatización y APIs
- ✅ Puedes recibir emails a múltiples direcciones
- ❌ **NO tiene IMAP** (no compatible con Spark directamente)
- ✅ Puedes reenviar emails a Zoho Mail para verlos en Spark

**Ver guía completa:** `MAILGUN_MULTIPLES_CUENTAS.md`

---

## 🏆 Mejores Opciones para 5+ Emails

### Opción 1: Zoho Mail (Recomendado para Email Empresarial)

**✅ Ventajas:**
- ✅ **5 usuarios GRATIS** (perfecto para empezar)
- ✅ IMAP/POP3 completo (compatible con Spark)
- ✅ 5 GB por usuario
- ✅ Interfaz web profesional
- ✅ Calendario y contactos integrados
- ✅ Precio: €1-3/usuario/mes después del plan gratuito

**❌ Desventajas:**
- ❌ No tiene API para automatización (solo IMAP/SMTP)
- ❌ No tiene webhooks para recibir emails programáticamente

**Precio:**
- **Gratis**: 5 usuarios, 5 GB cada uno
- **Mail Lite**: €1/usuario/mes (10 GB)
- **Mail Premium**: €3/usuario/mes (50 GB)

**Configuración IMAP para Spark:**
```
Servidor IMAP: imap.zoho.com
Puerto: 993 (SSL) o 143 (TLS)
Servidor SMTP: smtp.zoho.com
Puerto: 465 (SSL) o 587 (TLS)
```

---

### Opción 2: Google Workspace

**✅ Ventajas:**
- ✅ IMAP completo (compatible con Spark)
- ✅ Excelente integración con otras herramientas
- ✅ 30 GB por usuario (plan básico)
- ✅ Apps de Google incluidas

**❌ Desventajas:**
- ❌ Más caro: €5.20/usuario/mes (mínimo)
- ❌ No tiene API para automatización de emails (solo Gmail API básica)

**Precio:**
- **Business Starter**: €5.20/usuario/mes (30 GB)
- **Business Standard**: €10.40/usuario/mes (2 TB)

**Configuración IMAP para Spark:**
```
Servidor IMAP: imap.gmail.com
Puerto: 993 (SSL)
Servidor SMTP: smtp.gmail.com
Puerto: 465 (SSL) o 587 (TLS)
```

---

### Opción 3: Microsoft 365

**✅ Ventajas:**
- ✅ IMAP completo (compatible con Spark)
- ✅ Outlook incluido
- ✅ 50 GB por usuario (plan básico)
- ✅ Office apps incluidas

**❌ Desventajas:**
- ❌ Más caro: €4/usuario/mes (mínimo)
- ❌ No tiene API para automatización de emails

**Precio:**
- **Microsoft 365 Business Basic**: €4/usuario/mes (50 GB)
- **Microsoft 365 Business Standard**: €10.50/usuario/mes (50 GB + Office)

**Configuración IMAP para Spark:**
```
Servidor IMAP: outlook.office365.com
Puerto: 993 (SSL)
Servidor SMTP: smtp.office365.com
Puerto: 587 (TLS)
```

---

### Opción 4: Migadu (Recomendado para Múltiples Dominios)

**✅ Ventajas:**
- ✅ **Cuentas ILIMITADAS** en un solo plan
- ✅ IMAP completo
- ✅ Múltiples dominios
- ✅ Precio fijo (no por usuario)
- ✅ Muy económico para muchas cuentas

**❌ Desventajas:**
- ❌ No tiene API para automatización
- ❌ Interfaz más básica

**Precio:**
- **Mini**: €3/mes (cuentas ilimitadas, 1 dominio, 10 GB total)
- **Small**: €6/mes (cuentas ilimitadas, 3 dominios, 50 GB total)
- **Medium**: €12/mes (cuentas ilimitadas, 10 dominios, 200 GB total)

**Configuración IMAP para Spark:**
```
Servidor IMAP: imap.migadu.com
Puerto: 993 (SSL)
Servidor SMTP: smtp.migadu.com
Puerto: 587 (TLS)
```

---

### Opción 5: MXRoute (Recomendado para Múltiples Cuentas)

**✅ Ventajas:**
- ✅ **Cuentas ILIMITADAS**
- ✅ IMAP completo
- ✅ Múltiples dominios
- ✅ Precio fijo muy económico

**❌ Desventajas:**
- ❌ No tiene API para automatización
- ❌ Interfaz básica

**Precio:**
- **Lite**: $40/año (cuentas ilimitadas, 5 GB total)
- **Standard**: $65/año (cuentas ilimitadas, 25 GB total)
- **Deluxe**: $110/año (cuentas ilimitadas, 100 GB total)

**Configuración IMAP para Spark:**
```
Servidor IMAP: mail.tu-dominio.com (o el servidor asignado)
Puerto: 993 (SSL)
Servidor SMTP: mail.tu-dominio.com
Puerto: 587 (TLS)
```

---

## 🎯 Recomendación Final

### Para Tu Caso (5+ emails + Spark + Automatización):

**Solución Híbrida Recomendada:**

1. **Zoho Mail** (5 usuarios gratis) → Para emails empresariales en Spark
2. **Mailgun** → Para automatización y APIs

**Por qué:**
- ✅ Zoho Mail: 5 usuarios gratis, perfecto para empezar
- ✅ Compatible con Spark vía IMAP
- ✅ Mailgun: Automatización completa con webhooks
- ✅ Costo total: €0-15/mes (dependiendo de uso)

---

## 📱 Configuración de Spark para Múltiples Cuentas

### Paso 1: Instalar Spark

- **Mac**: Descarga desde Mac App Store o sparkmailapp.com
- **iOS**: Descarga desde App Store
- **Windows**: Descarga desde sparkmailapp.com

### Paso 2: Agregar Primera Cuenta

1. Abre Spark
2. Si es la primera vez, te pedirá agregar una cuenta
3. Selecciona tu proveedor (Zoho, Gmail, etc.) o "Cuenta de correo privada"
4. Ingresa tus credenciales

### Paso 3: Agregar Cuentas Adicionales

**En Mac:**
1. Menú superior: **Spark** → **Añadir cuenta**
2. Selecciona tu proveedor o "Cuenta de correo privada"
3. Ingresa los datos de la nueva cuenta
4. Repite para cada cuenta

**En iOS:**
1. Toca el ícono de menú (☰) en la esquina superior izquierda
2. Ve a **Configuración** → **Cuentas de correo electrónico**
3. Toca **+ Añadir cuenta**
4. Repite para cada cuenta

### Paso 4: Configurar Bandeja de Entrada Unificada

1. Ve a **Configuración** → **Bandeja de entrada inteligente**
2. Activa **"Bandeja de entrada unificada"**
3. Personaliza las secciones:
   - Personal
   - Notificaciones
   - Boletines
   - Otros

### Paso 5: Configuración Manual IMAP (Si es necesario)

Si necesitas configurar manualmente (por ejemplo, con Zoho Mail):

**Configuración IMAP:**
```
Servidor: imap.zoho.com
Puerto: 993
Seguridad: SSL/TLS
Usuario: tu-email@tudominio.com
Contraseña: tu-contraseña
```

**Configuración SMTP:**
```
Servidor: smtp.zoho.com
Puerto: 587
Seguridad: STARTTLS
Usuario: tu-email@tudominio.com
Contraseña: tu-contraseña
```

---

## 🔧 Configuración Completa: Zoho Mail + Mailgun

### Parte 1: Configurar Zoho Mail (5 Emails)

#### Paso 1: Crear Cuenta en Zoho Mail

1. Ve a: https://www.zoho.com/mail/
2. Crea una cuenta
3. Verifica tu dominio (ej: `eugenihidalgo.work`)

#### Paso 2: Crear 5 Usuarios

1. Ve a **Administración** → **Usuarios**
2. Crea 5 usuarios:
   - `eugeni@eugenihidalgo.work`
   - `contacto@eugenihidalgo.work`
   - `soporte@eugenihidalgo.work`
   - `ventas@eugenihidalgo.work`
   - `info@eugenihidalgo.work`

#### Paso 3: Configurar DNS

Agrega estos registros DNS en Cloudflare:

**Registro MX:**
```
Tipo: MX
Nombre: @
Prioridad: 10
Destino: mx.zoho.com
```

**Registro SPF:**
```
Tipo: TXT
Nombre: @
Contenido: v=spf1 include:zoho.com ~all
```

**Registro DKIM:**
```
Tipo: TXT
Nombre: zmail._domainkey
Contenido: [lo que te dé Zoho]
```

#### Paso 4: Agregar Cuentas en Spark

Para cada cuenta:
1. Abre Spark
2. **Spark** → **Añadir cuenta**
3. Selecciona "Cuenta de correo privada"
4. Ingresa:
   - Email: `usuario@eugenihidalgo.work`
   - Contraseña: [contraseña del usuario]
   - IMAP: `imap.zoho.com:993`
   - SMTP: `smtp.zoho.com:587`

### Parte 2: Configurar Mailgun (Automatización)

#### Paso 1: Crear Cuenta en Mailgun

1. Ve a: https://www.mailgun.com
2. Crea una cuenta
3. Verifica tu dominio (puede ser el mismo o diferente)

#### Paso 2: Configurar Variables de Entorno

Agrega al `.env`:

```env
# Zoho Mail (para emails empresariales)
ZOHO_IMAP_SERVER=imap.zoho.com
ZOHO_SMTP_SERVER=smtp.zoho.com

# Mailgun (para automatización)
MAILGUN_API_KEY=key-tu_api_key_aqui
MAILGUN_DOMAIN=mg.eugenihidalgo.work
MAILGUN_WEBHOOK_SECRET=tu_secreto_aleatorio_aqui

# Email de recepción para automatización
INBOUND_EMAIL=contacto@eugenihidalgo.work
EMAIL_FROM=eugeni@eugenihidalgo.work
```

#### Paso 3: Configurar Webhook en Mailgun

1. Ve a: https://app.mailgun.com → **Receiving** → **Routes**
2. Crea una ruta:
   - **Expression Type**: `match_recipient`
   - **Recipient**: `contacto@eugenihidalgo.work`
   - **Action**: `forward("https://pdeeugenihidalgo.org/api/email-inbound")`

#### Paso 4: Reenviar Emails Importantes a Zoho

Puedes configurar Mailgun para reenviar emails importantes a tu cuenta de Zoho Mail, así aparecerán en Spark:

1. En la ruta de Mailgun, agrega otra acción:
   - **Action**: `forward("eugeni@eugenihidalgo.work")`

Esto hará que los emails recibidos en Mailgun también lleguen a tu bandeja de Zoho Mail (visible en Spark).

---

## 🔄 Flujo Completo

```
Email Recibido → Mailgun (webhook) → Tu Servidor → Procesar → Kajabi
                                    ↓
                              Reenviar a Zoho Mail → Spark (bandeja unificada)

Email Enviado → Mailgun API → Enviar email
```

---

## 📊 Comparación de Opciones

| Proveedor | Cuentas | Precio | IMAP | API | Mejor Para |
|-----------|---------|--------|------|-----|------------|
| **Zoho Mail** | 5 gratis | €0-3/usuario | ✅ | ❌ | Email empresarial |
| **Google Workspace** | Ilimitadas | €5.20/usuario | ✅ | ⚠️ Básica | Integración Google |
| **Microsoft 365** | Ilimitadas | €4/usuario | ✅ | ⚠️ Básica | Office apps |
| **Migadu** | Ilimitadas | €3-12/mes | ✅ | ❌ | Muchas cuentas barato |
| **MXRoute** | Ilimitadas | $40-110/año | ✅ | ❌ | Muchas cuentas muy barato |

---

## 🎯 Plan de Implementación

### Fase 1: Configurar Zoho Mail (1-2 horas)

1. ✅ Crear cuenta en Zoho Mail
2. ✅ Verificar dominio
3. ✅ Crear 5 usuarios
4. ✅ Configurar DNS (MX, SPF, DKIM)
5. ✅ Agregar cuentas en Spark

### Fase 2: Configurar Mailgun (30 minutos)

1. ✅ Crear cuenta en Mailgun
2. ✅ Verificar dominio
3. ✅ Configurar webhook
4. ✅ Configurar reenvío a Zoho (opcional)

### Fase 3: Integrar con Tu Servidor (Ya hecho)

1. ✅ Los archivos ya están creados (`email-mailgun.js`, `email-inbound.js`)
2. ✅ Solo necesitas agregar las variables de entorno
3. ✅ Configurar webhooks de Kajabi

---

## 📝 Configuración Paso a Paso: Spark

### Agregar Cuenta en Spark (Mac)

1. Abre Spark
2. Menú: **Spark** → **Añadir cuenta**
3. Selecciona **"Cuenta de correo privada"**
4. Completa:
   - **Nombre**: Tu nombre
   - **Email**: `usuario@eugenihidalgo.work`
   - **Contraseña**: [tu contraseña]
5. Spark intentará detectar automáticamente la configuración
6. Si no funciona, haz clic en **"Configuración manual"**:
   - **IMAP**: `imap.zoho.com`, puerto `993`, SSL
   - **SMTP**: `smtp.zoho.com`, puerto `587`, STARTTLS

### Agregar Cuenta en Spark (iOS)

1. Abre Spark
2. Toca el menú (☰) → **Configuración**
3. **Cuentas de correo electrónico** → **+ Añadir cuenta**
4. Selecciona **"Cuenta de correo privada"**
5. Ingresa email y contraseña
6. Spark configurará automáticamente

### Ver Todas las Bandejas en Spark

1. En la vista principal, verás **"Bandeja de entrada unificada"**
2. Esta muestra todos los emails de todas tus cuentas
3. Puedes filtrar por cuenta tocando el nombre de la cuenta en el menú lateral
4. Personaliza en **Configuración** → **Bandeja de entrada inteligente**

---

## 🔒 Seguridad

### Recomendaciones:

1. ✅ Usa contraseñas fuertes para cada cuenta
2. ✅ Habilita autenticación de dos factores (2FA) en Zoho Mail
3. ✅ Verifica las firmas de webhooks de Mailgun
4. ✅ Usa HTTPS para todos los webhooks
5. ✅ Guarda secrets en `.env` (no en el código)

---

## 💡 Casos de Uso

### Caso 1: Email Recibido en Mailgun

1. Email llega a `contacto@eugenihidalgo.work` (Mailgun)
2. Mailgun envía webhook a tu servidor
3. Tu servidor procesa el email (busca en Kajabi, etc.)
4. Opcional: Reenvía a `eugeni@eugenihidalgo.work` (Zoho)
5. El email aparece en Spark (bandeja unificada)

### Caso 2: Enviar Email desde Tu Servidor

1. Tu código llama a `enviarEmail()` (Mailgun API)
2. Email se envía vía Mailgun
3. Tracking y analytics disponibles

### Caso 3: Leer/Responder en Spark

1. Abres Spark
2. Ves todas las bandejas unificadas
3. Lees y respondes emails normalmente
4. Los emails se envían vía Zoho Mail SMTP

---

## 📚 Recursos

- **Zoho Mail**: https://www.zoho.com/mail/
- **Mailgun**: https://www.mailgun.com
- **Spark**: https://sparkmailapp.com
- **Guía Spark**: https://sparkmailapp.com/support

---

## ✅ Checklist Final

- [ ] Crear cuenta en Zoho Mail
- [ ] Verificar dominio en Zoho
- [ ] Crear 5 usuarios en Zoho
- [ ] Configurar DNS (MX, SPF, DKIM)
- [ ] Agregar todas las cuentas en Spark
- [ ] Verificar que todas las bandejas aparecen en Spark
- [ ] Crear cuenta en Mailgun
- [ ] Configurar webhook en Mailgun
- [ ] Agregar variables de entorno
- [ ] Probar recepción de emails
- [ ] Probar envío de emails
- [ ] Configurar webhooks de Kajabi

---

**¿Necesitas ayuda con algún paso específico?** 🚀

