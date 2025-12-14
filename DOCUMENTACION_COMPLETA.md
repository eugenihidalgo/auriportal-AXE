# 📚 Documentación Completa - AuriPortal v3.1

## 🎯 ¿Qué es AuriPortal?

**AuriPortal** es una plataforma educativa gamificada que gestiona estudiantes, sus rachas de práctica diaria, niveles de progreso y sincronización automática entre **Kajabi** (sistema de ventas/cursos) y **ClickUp** (centro de operaciones).

### Propósito Principal
- **Gestionar estudiantes** que compraron "Mundo de Luz" en Kajabi
- **Sincronizar datos** automáticamente entre Kajabi y ClickUp
- **Rastrear rachas** de práctica diaria de los estudiantes
- **Calcular niveles** basados en la fecha de inscripción
- **Pausar/reactivar rachas** según el estado de suscripción en Kajabi

---

## 🏗️ Arquitectura

### Stack Tecnológico
- **Servidor**: Node.js en VPS Hetzner (CPX32: 4 VCPU, 8GB RAM)
- **Base de Datos Local**: SQLite (caché rápida para lecturas)
- **Base de Datos Principal**: ClickUp (centro de operaciones)
- **APIs Externas**: 
  - Kajabi API v1 (contactos, ofertas, compras)
  - ClickUp API v2 (tareas, campos personalizados)
  - Typeform API (formularios de onboarding)

### Flujo de Datos
```
Kajabi (Ventas) 
    ↓
[Sincronización Automática]
    ↓
ClickUp (Centro de Operaciones)
    ↓
[Base de Datos Local - SQLite]
    ↓
Aplicación Web (Usuarios)
```

**Principio**: ClickUp es la "fuente de verdad", SQLite es caché para velocidad.

---

## 📁 Estructura del Proyecto

```
/var/www/aurelinportal/
├── server.js              # Servidor Node.js principal
├── package.json           # Dependencias
├── .env                   # Variables de entorno (credenciales)
├── database/
│   ├── db.js             # Conexión y funciones SQLite
│   └── schema.sql        # Esquema de base de datos
└── src/
    ├── router.js         # Router principal (enrutamiento)
    ├── config/
    │   ├── config.js     # IDs de ClickUp, Typeform, etc.
    │   └── milestones.js # Hitos de rachas (25, 50, 75, 100 días)
    ├── core/
    │   ├── cookies.js    # Gestión de cookies de sesión
    │   ├── responses.js  # Renderizado de HTML
    │   └── html/         # Plantillas HTML (pantalla0-4.html)
    ├── endpoints/        # Handlers de rutas HTTP
    │   ├── enter.js              # Pantalla principal / login
    │   ├── onboarding-complete.js # Después de Typeform
    │   ├── topic-list.js         # Lista de temas
    │   ├── topic-screen.js       # Vista de tema individual
    │   ├── aprender.js           # Redirección
    │   ├── typeform-webhook.js   # Webhook de Typeform
    │   ├── sync-all.js           # Sincronización masiva
    │   └── import-kajabi.js     # Importar contactos de Kajabi
    └── modules/          # Lógica de negocio
        ├── student.js    # CRUD de estudiantes en ClickUp
        ├── streak.js     # Sistema de rachas
        ├── nivel.js      # Cálculo de niveles
        ├── suscripcion.js # Estado de suscripción
        ├── kajabi.js    # Verificación de acceso Kajabi
        ├── kajabi-full.js # API completa de Kajabi
        ├── kajabi-sync.js # Sincronización Kajabi→ClickUp
        └── topics.js    # Gestión de temas
```

---

## 🌐 Endpoints y Funcionalidad

### 1. `/` o `/enter` - Pantalla Principal
**Handler**: `src/endpoints/enter.js`

**Funcionalidad**:
- **Pantalla 0**: Login por email (si no hay cookie)
- **Pantalla 1**: Usuario logueado, muestra racha actual
- **Pantalla 2**: Usuario con racha pausada (suscripción cancelada)

**Flujo**:
1. Verifica cookie de sesión
2. Si no hay cookie → Muestra formulario de email
3. Si hay cookie → Verifica acceso en Kajabi
4. Si tiene acceso → Muestra racha y opción de practicar
5. Si no tiene acceso → Muestra mensaje de error
6. Si suscripción pausada → Pausa racha automáticamente

**Parámetros**:
- `?practico=si` → Marca práctica del día, actualiza racha

**Datos que muestra**:
- Nombre/apodo del estudiante
- Racha actual (días consecutivos)
- Última fecha de práctica
- Nivel actual
- Mensajes motivacionales según hitos (25, 50, 75, 100+ días)

---

### 2. `/onboarding-complete` - Después de Typeform
**Handler**: `src/endpoints/onboarding-complete.js`

**Funcionalidad**:
- Recibe datos después de completar Typeform
- Extrae email y apodo del formulario
- Verifica acceso en Kajabi
- Crea/actualiza estudiante en ClickUp
- Sincroniza datos de Kajabi (nombre, fecha inscripción, etc.)
- Establece cookie de sesión
- Redirige a `/enter`

**Flujo**:
```
Typeform completado
    ↓
POST /onboarding-complete
    ↓
Extrae email y apodo
    ↓
Busca en Kajabi
    ↓
Crea/actualiza en ClickUp
    ↓
Sincroniza datos (nombre, fecha inscripción, nivel)
    ↓
Establece cookie
    ↓
Redirige a /enter
```

---

### 3. `/typeform-webhook` - Webhook de Typeform
**Handler**: `src/endpoints/typeform-webhook.js`

**Funcionalidad**:
- Recibe webhook cuando alguien completa Typeform
- Extrae email y apodo
- Busca contacto en Kajabi
- Crea/actualiza tarea en ClickUp
- Sincroniza datos de Kajabi

**Diferencia con `/onboarding-complete`**:
- Este es el webhook automático de Typeform
- `/onboarding-complete` es la redirección después del formulario

---

### 4. `/topics` - Lista de Temas
**Handler**: `src/endpoints/topic-list.js`

**Funcionalidad**:
- Muestra lista de temas disponibles
- Cada tema tiene contador y objetivo independiente

**Temas disponibles**:
1. Limpieza de mis canales perceptivos
2. Abundancia
3. Salud física

---

### 5. `/topic/:topicId` - Vista de Tema
**Handler**: `src/endpoints/topic-screen.js`

**Funcionalidad**:
- Muestra estado de un tema específico
- Contador actual vs objetivo
- Opción de practicar (`?practicar=si`)

**Parámetros**:
- `:topicId` → `tema1`, `tema2`, `tema3`
- `?practicar=si` → Incrementa contador del tema

---

### 6. `/sync-all` - Sincronización Masiva
**Handler**: `src/endpoints/sync-all.js`

**Funcionalidad**:
- Sincroniza TODOS los contactos de ClickUp con Kajabi
- Actualiza:
  - Nombre/apodo desde Kajabi
  - Fecha de inscripción (Mundo de Luz)
  - Estado de suscripción (pausada/activa)
  - Campo "Tiene Mundo de Luz" (checkbox)
  - Nivel del estudiante

**Uso**:
- Ejecutar manualmente cuando necesites sincronizar todo
- URL: `http://88.99.173.249:3000/sync-all`

**Proceso**:
1. Obtiene todas las tareas de ClickUp (lista `901214375878`)
2. Para cada tarea:
   - Busca email en Kajabi
   - Si encuentra → Sincroniza datos
   - Si no encuentra → Marca como "Sin datos en Kajabi"
3. Muestra resumen HTML con resultados

---

### 7. `/import-kajabi` - Importar Contactos de Kajabi
**Handler**: `src/endpoints/import-kajabi.js`

**Funcionalidad**:
- Importa TODOS los contactos de Kajabi a ClickUp
- **IMPORTANTE**: Solo importa contactos que tienen "Mundo de Luz"
- Crea nuevas tareas en ClickUp (lista `901214540219`)
- Sincroniza datos completos

**Ofertas "Mundo de Luz" identificadas**:
- `uriUhsHt`
- `qibUv2Fu`
- `bgLUBFjc`
- `L8wjafVK`
- `r9LbHwqk`

**Proceso**:
1. Obtiene todas las ofertas de Kajabi
2. Filtra ofertas "Mundo de Luz" por tokens
3. Obtiene todos los contactos de Kajabi (paginación)
4. Para cada contacto:
   - Verifica si tiene alguna oferta "Mundo de Luz"
   - Si tiene → Crea/actualiza en ClickUp
   - Si no tiene → Lo omite
5. Muestra resumen HTML

**Uso**:
- Ejecutar una vez para importar todos los contactos
- URL: `http://88.99.173.249:3000/import-kajabi`

---

## 🔄 Sincronización Kajabi ↔ ClickUp

### Datos que se Sincronizan

| Dato | Origen | Destino | Campo ClickUp |
|------|--------|---------|---------------|
| Nombre completo | Kajabi | ClickUp | Nombre de tarea |
| Apodo | Kajabi | ClickUp | `CF_APODO` |
| Email | Kajabi | ClickUp | `CF_EMAIL` |
| Fecha inscripción | Kajabi (primera compra Mundo de Luz) | ClickUp | `CF_FECHA_INSCRIPCION` |
| Tiene Mundo de Luz | Kajabi (verificación de ofertas) | ClickUp | `CF_TIENE_MUNDO_DE_LUZ` (checkbox) |
| Suscripción pausada | Kajabi (estado de suscripción) | ClickUp | `CF_SUSCRIPCION_PAUSADA` |
| Nivel | Calculado (fecha inscripción) | ClickUp | `CF_NIVEL_AURELIN` |

### Flujo de Sincronización

**Kajabi → ClickUp**:
1. Obtiene contacto de Kajabi por email
2. Obtiene ofertas asociadas
3. Verifica si tiene "Mundo de Luz"
4. Obtiene primera compra de "Mundo de Luz" (fecha inscripción)
5. Verifica estado de suscripción
6. Actualiza tarea en ClickUp

**ClickUp → Base de Datos Local**:
1. Lee tarea de ClickUp
2. Guarda en SQLite (caché)
3. Lecturas futuras son instantáneas (5ms vs 1000ms)

---

## 🎯 Sistema de Rachas

### ¿Qué es una Racha?
Días consecutivos que el estudiante practica. Se resetea si:
- No practica un día
- Su suscripción está pausada en Kajabi

### Hitos Especiales
- **25 días**: Mensaje motivacional
- **50 días**: Mensaje motivacional
- **75 días**: Mensaje motivacional
- **100 días**: Mensaje especial
- **150 días**: Mensaje especial
- **200 días**: Mensaje especial
- **365 días**: Mensaje especial

### Lógica de Rachas
**Archivo**: `src/modules/streak.js`

1. **Verifica última práctica**:
   - Si es hoy → Ya practicó, no incrementa
   - Si es ayer → Incrementa racha
   - Si es anterior → Resetea racha a 1

2. **Verifica suscripción**:
   - Si está pausada → Pausa racha (no cuenta días)
   - Si está activa → Racha normal

3. **Actualiza**:
   - ClickUp: Campo `CF_STREAK_GENERAL`
   - ClickUp: Campo `CF_LAST_PRACTICE_DATE`
   - Base de datos local: Tabla `students`

---

## 📊 Sistema de Niveles

### ¿Cómo se Calcula el Nivel?
**Archivo**: `src/modules/nivel.js`

El nivel se calcula basado en la **fecha de inscripción** (primera compra de "Mundo de Luz"):

**Fórmula**:
```
Días desde inscripción = HOY - Fecha inscripción
Nivel = Función(días desde inscripción)
```

**Niveles actuales** (configurables en `src/config/milestones.js`):
- Nivel 1: 0-30 días
- Nivel 2: 31-60 días
- Nivel 3: 61-90 días
- ... (configurable)

**Actualización**:
- Se calcula automáticamente en cada sincronización
- Se actualiza en ClickUp: Campo `CF_NIVEL_AURELIN`
- Se guarda en base de datos local

---

## 🗄️ Base de Datos Local (SQLite)

### Tabla: `students`
Almacena caché de estudiantes para lecturas rápidas.

**Campos**:
- `id`: ID único
- `email`: Email del estudiante (único)
- `clickup_task_id`: ID de tarea en ClickUp
- `nombre`: Nombre completo
- `apodo`: Apodo
- `nivel`: Nivel actual
- `racha_actual`: Días consecutivos
- `ultima_practica_date`: Última fecha de práctica
- `fecha_inscripcion`: Fecha de inscripción (Mundo de Luz)
- `tiene_mundo_de_luz`: 0 o 1 (boolean)
- `suscripcion_pausada`: 0 o 1 (boolean)
- `sync_updated_at`: Última sincronización
- `created_at`: Fecha de creación
- `updated_at`: Última actualización

### Tabla: `sync_log`
Registro de sincronizaciones.

### Tabla: `topics`
Caché de temas (opcional).

### Tabla: `practices`
Registro de prácticas (opcional, para analytics).

---

## 🔐 Autenticación y Sesiones

### Sistema de Cookies
**Archivo**: `src/core/cookies.js`

- **Cookie name**: `auriportal_session`
- **Contenido**: Email del usuario (encriptado)
- **Configuración**:
  - HttpOnly: Sí (no accesible desde JavaScript)
  - Secure: Sí (solo HTTPS)
  - SameSite: Lax
  - Expiración: 30 días

### Flujo de Autenticación
1. Usuario ingresa email en `/enter`
2. Se verifica acceso en Kajabi
3. Si tiene acceso → Se crea cookie
4. Próximas visitas → Se lee cookie automáticamente

---

## 🔧 Configuración

### Variables de Entorno (`.env`)
```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# ClickUp
CLICKUP_API_TOKEN=pk_tu_token_aqui

# Kajabi
KAJABI_CLIENT_ID=tu_client_id
KAJABI_CLIENT_SECRET=tu_client_secret
KAJABI_SITE_NAME=Plataforma de desarrollo espiritual Eugeni Hidalgo

# Typeform
TYPEFORM_API_TOKEN=tu_token_aqui

# Cookie Secret (genera uno aleatorio)
COOKIE_SECRET=tu_secreto_aleatorio_aqui
```

### IDs de ClickUp (`src/config/config.js`)
- `LIST_ID`: `901214375878` (Lista principal)
- `CF_EMAIL`: ID del campo email
- `CF_APODO`: ID del campo apodo
- `CF_FECHA_INSCRIPCION`: ID del campo fecha inscripción
- `CF_NIVEL_AURELIN`: ID del campo nivel
- `CF_STREAK_GENERAL`: ID del campo racha
- `CF_LAST_PRACTICE_DATE`: ID del campo última práctica
- `CF_TIENE_MUNDO_DE_LUZ`: ID del checkbox "Tiene Mundo de Luz"
- `CF_SUSCRIPCION_PAUSADA`: ID del campo suscripción pausada

---

## 🚀 Comandos Útiles

### Gestión del Servidor
```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs aurelinportal

# Reiniciar
pm2 restart aurelinportal

# Detener
pm2 stop aurelinportal

# Iniciar
pm2 start server.js --name aurelinportal
```

### Sincronización Manual
```bash
# Sincronizar todos los contactos
curl http://localhost:3000/sync-all

# Importar contactos de Kajabi
curl http://localhost:3000/import-kajabi
```

### Base de Datos
```bash
# Ver estudiantes
sqlite3 database/aurelinportal.db "SELECT * FROM students LIMIT 10;"

# Ver logs de sincronización
sqlite3 database/aurelinportal.db "SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 10;"
```

---

## 🔍 Debugging

### Ver Logs en Tiempo Real
```bash
pm2 logs aurelinportal --lines 50
```

### Verificar Conexión a APIs
```bash
# ClickUp
curl -H "Authorization: $CLICKUP_API_TOKEN" https://api.clickup.com/api/v2/user

# Kajabi (requiere OAuth primero)
# Ver src/modules/kajabi-full.js para obtener token
```

### Verificar Base de Datos
```bash
cd /var/www/aurelinportal
sqlite3 database/aurelinportal.db ".tables"
sqlite3 database/aurelinportal.db "SELECT COUNT(*) FROM students;"
```

---

## 📝 Flujos Principales

### Flujo 1: Nuevo Usuario
```
1. Usuario completa Typeform
2. Typeform → POST /typeform-webhook
3. Sistema busca en Kajabi
4. Crea tarea en ClickUp
5. Sincroniza datos de Kajabi
6. Redirige a /onboarding-complete
7. Establece cookie
8. Redirige a /enter
9. Usuario ve su racha
```

### Flujo 2: Usuario Existente Practica
```
1. Usuario visita /enter?practico=si
2. Sistema verifica cookie
3. Busca estudiante en BD local (rápido)
4. Verifica última práctica
5. Si es válida → Incrementa racha
6. Actualiza ClickUp
7. Actualiza BD local
8. Muestra mensaje de éxito
```

### Flujo 3: Sincronización Masiva
```
1. Ejecutar /sync-all
2. Obtiene todas las tareas de ClickUp
3. Para cada tarea:
   a. Busca email en Kajabi
   b. Si encuentra → Sincroniza datos
   c. Actualiza ClickUp
   d. Actualiza BD local
4. Muestra resumen
```

### Flujo 4: Suscripción Pausada
```
1. Usuario visita /enter
2. Sistema verifica suscripción en Kajabi
3. Si está pausada:
   a. Pausa racha (no cuenta días)
   b. Muestra Pantalla 2 (mensaje de pausa)
   c. No permite practicar
4. Si se reactiva:
   a. Reactiva racha
   b. Muestra Pantalla 1 (normal)
```

---

## ⚠️ Consideraciones Importantes

### Rate Limits
- **Kajabi API**: ~100 requests/minuto
- **ClickUp API**: ~100 requests/minuto
- El código incluye pausas automáticas para evitar límites

### Paginación
- Kajabi: Máximo 100 contactos por página
- ClickUp: Máximo 100 tareas por página
- El código maneja paginación automáticamente

### Sincronización
- **ClickUp es la fuente de verdad**: Todos los cambios importantes se hacen en ClickUp
- **SQLite es caché**: Se sincroniza desde ClickUp, no es fuente primaria
- **Sincronización automática**: Cada vez que se lee/escribe, se actualiza caché

### "Mundo de Luz"
- Solo se importan contactos que tienen al menos una de las ofertas específicas
- Se verifica por tokens de ofertas, no por nombre
- Si un contacto no tiene "Mundo de Luz", no se importa

---

## 🎯 Próximos Pasos / Mejoras Futuras

1. **Webhooks de ClickUp**: Sincronización automática cuando cambias algo en ClickUp
2. **Sincronización periódica**: Cron job cada 5-10 minutos
3. **Analytics**: Dashboard con estadísticas de rachas, niveles, etc.
4. **Notificaciones**: Email cuando alguien alcanza un hito
5. **Backup automático**: Backup de SQLite diario

---

## 📞 Soporte

Si tienes problemas:
1. Verifica logs: `pm2 logs aurelinportal`
2. Verifica estado: `pm2 status`
3. Verifica base de datos: `sqlite3 database/aurelinportal.db ".tables"`
4. Verifica variables de entorno: `cat .env`

---

**Última actualización**: Diciembre 2024  
**Versión**: 3.1  
**Servidor**: Aurelinportal (Hetzner CPX32)

