# AuriPortal v3.1 - Servidor Node.js

Sistema de gestión de estudiantes y rachas de práctica integrado con Kajabi, Typeform y ClickUp.

## 🏗️ Arquitectura del Ecosistema

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌─────────────┐
│   Kajabi    │◄────►│   Servidor   │◄────►│  ClickUp    │
│     API     │      │   Node.js    │      │     API     │
└─────────────┘      └──────────────┘      └─────────────┘
                            ▲
                            │
                            │ Webhook
                            │
                     ┌──────────────┐
                     │   Typeform   │
                     └──────────────┘
```

### Flujo de Integración

1. **Kajabi API**: Verifica acceso de usuarios, obtiene datos de compras y suscripciones
2. **Typeform**: Recibe respuestas del formulario de onboarding
3. **Servidor Node.js**: Coordina todo el ecosistema
4. **ClickUp API**: Almacena datos de estudiantes, rachas, niveles y prácticas

## 📁 Estructura del Proyecto

```
aurelinportal/
├── server.js                 # Servidor HTTP principal
├── package.json              # Dependencias del proyecto
├── database/
│   └── db.js                 # Base de datos SQLite (opcional)
├── src/
│   ├── router.js             # Router principal
│   ├── config/
│   │   ├── config.js         # Configuración de ClickUp y Typeform
│   │   └── milestones.js    # Hitos de racha
│   ├── services/             # Servicios de integración con APIs externas
│   │   ├── kajabi.js         # Servicio consolidado de Kajabi API
│   │   ├── kajabi-sync.js    # Sincronización Kajabi → ClickUp
│   │   └── clickup.js        # Servicio centralizado de ClickUp API
│   ├── modules/              # Módulos de lógica de negocio
│   │   ├── student.js        # Gestión de estudiantes
│   │   ├── streak.js         # Gestión de rachas diarias
│   │   ├── nivel.js          # Sistema de niveles automático
│   │   ├── suscripcion.js    # Gestión de suscripciones
│   │   ├── logs.js           # Registro de accesos
│   │   ├── topics.js         # Gestión de temas
│   │   └── tema.js           # Contadores por tema
│   ├── endpoints/            # Handlers de endpoints HTTP
│   │   ├── enter.js          # Pantalla principal de entrada
│   │   ├── typeform-webhook.js  # Webhook de Typeform
│   │   ├── onboarding-complete.js  # Finalización de onboarding
│   │   ├── sync-all.js       # Sincronización masiva
│   │   ├── import-kajabi.js  # Importación de contactos
│   │   ├── topic-list.js     # Lista de temas
│   │   ├── topic-screen.js   # Pantalla de tema
│   │   └── aprender.js       # Redirección a temas
│   └── core/
│       ├── cookies.js        # Utilidades de cookies
│       └── responses.js      # Renderizado de pantallas HTML
```

## 🔧 Configuración

### Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Servidor
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# ClickUp (REQUERIDO)
CLICKUP_API_TOKEN=pk_tu_token_de_clickup

# Kajabi (REQUERIDO)
KAJABI_CLIENT_ID=tu_client_id
KAJABI_CLIENT_SECRET=tu_client_secret

# Typeform (OPCIONAL pero recomendado para webhooks)
TYPEFORM_API_TOKEN=tu_token_de_typeform

# Cloudflare (OPCIONAL - para DNS/CDN)
# Opción 1: API Token (recomendado)
CLOUDFLARE_API_TOKEN=tu_api_token_de_cloudflare
# Opción 2: Email + API Key (alternativa)
CLOUDFLARE_EMAIL=tu_email@ejemplo.com
CLOUDFLARE_API_KEY=tu_global_api_key

# Cookies (REQUERIDO)
COOKIE_SECRET=tu_secreto_aleatorio_muy_largo

# Base de datos (opcional)
DB_PATH=./database/aurelinportal.db
```

### Verificación de Configuración

Puedes verificar el estado de tu configuración visitando:
- `http://localhost:3000/health-check` - Panel de verificación completo
- `http://localhost:3000/health-check?test=true` - Incluye pruebas de conectividad con APIs

El servidor también valida la configuración al iniciar y muestra advertencias en la consola.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# Modo desarrollo (con watch)
npm run dev

# Con PM2
npm run pm2:start
```

## 📡 Endpoints Principales

### Públicos

- `GET /` o `GET /enter` - Pantalla principal de entrada
- `POST /enter` - Autenticación con email
- `GET /onboarding-complete?email=...` - Finalización de onboarding desde Typeform
- `POST /typeform-webhook` - Webhook de Typeform

### Autenticados (requieren cookie)

- `GET /topics` - Lista de temas disponibles
- `GET /topic/{temaId}` - Pantalla de tema específico
- `GET /aprender` - Redirección a temas

### Administración

- `GET /health-check` o `GET /health` o `GET /status` - Verificación de configuración y estado de APIs
- `GET /sync-all` - Sincronización masiva de ClickUp con Kajabi
- `GET /import-kajabi` - Importación de contactos de Kajabi a ClickUp

## 🔄 Flujo de Usuario

1. **Primera visita**: Usuario es redirigido a Typeform para onboarding
2. **Completar Typeform**: Webhook crea/actualiza estudiante en ClickUp
3. **Validación Kajabi**: Se verifica que tenga compra de "Mundo de Luz"
4. **Sincronización**: Datos de Kajabi se sincronizan a ClickUp
5. **Acceso al portal**: Usuario puede ver su racha, nivel y temas

## 🎯 Funcionalidades Principales

### Sistema de Rachas
- Racha diaria de práctica
- Detección automática de hitos (25, 50, 75, 100, 150, 200, 365 días)
- Reseteo automático si se rompe la racha

### Sistema de Niveles
- Niveles automáticos basados en días desde inscripción
- 15 niveles: Sanación (1-9) y Canalización (10-15)
- Respeta cambios manuales en ClickUp

### Gestión de Suscripciones
- Verificación automática de estado en Kajabi
- Pausa/reactivación de racha según suscripción
- Sincronización de datos de Kajabi a ClickUp

### Temas de Práctica
- Contadores por tema
- Objetivos personalizables
- Seguimiento de progreso

## 🔐 Seguridad

- Cookies HttpOnly y Secure
- Validación de acceso mediante Kajabi API
- Solo usuarios con compra de "Mundo de Luz" tienen acceso

## 📝 Notas

- El servidor está diseñado para funcionar sin Workers (Cloudflare Workers)
- Todo el código está adaptado para Node.js estándar
- La base de datos SQLite es opcional (principalmente se usa ClickUp)
- Los servicios están consolidados y organizados en `src/services/`

## 🛠️ Mantenimiento

### Sincronización Manual

Para sincronizar todos los contactos de ClickUp con datos de Kajabi:
```
GET http://localhost:3000/sync-all
```

Para importar todos los contactos de Kajabi a ClickUp:
```
GET http://localhost:3000/import-kajabi
```

## 📚 Dependencias Principales

- `better-sqlite3` - Base de datos SQLite (opcional)
- `dotenv` - Variables de entorno

## 📋 Contratos y Verificaciones

### Contrato de Creación de Entidades Vivas

AuriPortal define un contrato canónico para la creación de "entidades vivas" (Alumno, Práctica, etc.) que introducen hechos en el sistema.

**Documentación completa**: `CONTRATO_CANONICO_CREACION_ENTIDADES_VIVAS.md`

**Checklist para PRs**: `docs/checklists/CHECKLIST_ENTIDADES_VIVAS.md`

**Verificación automática**:
```bash
npm run verify:contract:entities
```

Este script detecta violaciones obvias del contrato, como creación directa desde endpoints o módulos de negocio.

**Reglas de proyecto**: `.cursor/rules/CONTRATO_A_ENTIDADES_VIVAS.yml`

### Contrato de Mutación de Entidades Vivas

AuriPortal define un contrato canónico para la mutación de "entidades vivas" (Alumno, Práctica, etc.) que modifican el estado del sistema.

**Documentación completa**: `CONTRATO_CANONICO_MUTACION_ENTIDADES_VIVAS.md`

**Checklist para PRs**: `docs/checklists/CHECKLIST_MUTACION_ENTIDADES_VIVAS.md`

**Verificación automática**:
```bash
npm run verify:contract:mutations
```

Este script detecta violaciones obvias del contrato, como mutación directa desde endpoints o módulos de negocio.

**Reglas de proyecto**: `.cursor/rules/CONTRATO_B_MUTACION_ENTIDADES_VIVAS.yml`

### Contrato de Señales Canónicas

AuriPortal define un contrato canónico para las "señales" que describen hechos ocurridos en el sistema.

**Documentación completa**: `CONTRATO_CANONICO_SENALES.md`

**Checklist para PRs**: `docs/checklists/CHECKLIST_SENALES.md`

**Verificación automática**:
```bash
npm run verify:contract:signals
```

Este script detecta violaciones obvias del contrato, como emisión de señales desde servicios canónicos o ejecución de automatizaciones al preparar señales.

**Reglas de proyecto**: `.cursor/rules/CONTRATO_C_SENALES.yml`

### Contrato de Automatizaciones Canónicas

AuriPortal define un contrato canónico para las "automatizaciones" que consumen señales emitidas y ejecutan acciones registradas.

**Documentación completa**: `CONTRATO_CANONICO_AUTOMATIZACIONES.md`

**Checklist para PRs**: `docs/checklists/CHECKLIST_AUTOMATIZACIONES.md`

**Verificación automática**:
```bash
npm run verify:contract:automations
```

Este script detecta violaciones obvias del contrato, como ejecución de automatizaciones desde servicios canónicos o mutación de estado directamente.

**Reglas de proyecto**: `.cursor/rules/CONTRATO_D_AUTOMATIZACIONES.yml`

## 🔄 Migración desde Workers

Este proyecto fue migrado desde Cloudflare Workers a Node.js. Los cambios principales:

- ✅ Eliminados módulos duplicados de Kajabi
- ✅ Creado servicio centralizado de ClickUp
- ✅ Eliminadas referencias a Workers
- ✅ Código organizado en `services/` y `modules/`
- ✅ Servidor HTTP nativo de Node.js

