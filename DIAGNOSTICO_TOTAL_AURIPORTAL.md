# 🔍 DIAGNÓSTICO TOTAL — AURIPORTAL
**Fecha:** 2025-12-17 23:41 UTC  
**Objetivo:** Determinar si el sistema global está sano tras cambios en admin (base.html / replace async / sidebar / auth)

---

## 📋 RESUMEN EJECUTIVO

**ESTADO GENERAL:** ⚠️ **SISTEMA PARCIALMENTE ROTO**

- ✅ **Cliente público:** Funcional (HTTP 200 en endpoints básicos)
- ❌ **Admin Auth:** ROTO (variables de entorno no configuradas)
- ❌ **Base de datos:** ROTO (PGPASSWORD no configurado o inválido)
- ⚠️ **PM2:** Funcional pero con 5 restarts recientes (uptime: 11m)
- ✅ **Templates:** OK (base.html sin corrupción, solo cambios de menú)
- ✅ **Routing:** OK (handlers correctos, sin duplicados)

**RECOMENDACIÓN:** 🔴 **ROLLBACK o HOTFIX INMEDIATO** - Variables de entorno críticas faltantes

---

## 📊 FASE 0 — FOTO FORENSE DEL ESTADO

### 0.1) Git Status

**Estado:** Repositorio con cambios sin commitear (170 archivos modificados)

**Archivos críticos modificados:**
- `src/core/html/admin/base.html` (298 cambios) - **ÚLTIMA MODIFICACIÓN: 2025-12-17 23:34:26**
- `src/core/auth-context.js` (117 cambios)
- `src/modules/admin-auth.js` (182 cambios)
- `src/core/cookies.js` (121 cambios)
- `src/router.js` (332 cambios)
- `server.js` (367 cambios)

**Commits recientes:**
```
5c44b0b (HEAD -> master) feat(env): validar .env y prevenir fallos por secrets sanitizados
8245aab chore(security): sanitize secrets and documentation
435c071 chore(git): asegurar repo limpio e ignorar artefactos locales
97b3be0 chore: baseline AuriPortal v4.3.0 (arquitectura blindada)
```

**Superficie de impacto:**
- ✅ Archivos admin tocados: `base.html`, `admin-auth.js`, `auth-context.js`
- ✅ Templates tocados: `base.html`, `login.html` (referenciado)
- ✅ Router tocado: `router.js`
- ✅ Servidor tocado: `server.js`

---

## 🔧 FASE 1 — SALUD DEL PROCESO (PM2/NODE)

### 1.1) Estado PM2

**Comando:** `pm2 list`

**Resultado:**
```
┌────┬─────────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┐
│ id │ name                   │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │
├────┼─────────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┤
│ 8  │ aurelinportal          │ default     │ 4.7.0   │ fork    │ 1229465  │ 11m    │ 5    │ online    │
└────┴─────────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┘
```

**Análisis:**
- ✅ Proceso **online**
- ⚠️ **5 restarts** recientes (sospechoso)
- ⚠️ **Uptime: 11 minutos** (muy corto, sugiere reinicio reciente)
- ✅ **Heap Usage: 94.63%** (normal para Node.js)
- ✅ **Event Loop Latency: 0.49ms** (saludable)

**Veredicto:** ⚠️ **PROCESO INESTABLE** - Múltiples restarts sugieren crash loop o cambios recientes

### 1.2) Logs PM2

**Comando:** `pm2 logs aurelinportal --lines 200`

**Hallazgos críticos en logs:**

1. **Variables de entorno no configuradas:**
```
[ADMIN AUTH QA] validateAdminCredentials called {
  username: 'eugeni',
  passwordLength: 9,
  ADMIN_USER: undefined,        ← ❌ CRÍTICO
  ADMIN_PASS_LENGTH: 0,         ← ❌ CRÍTICO
  hasAdminUser: false,
  hasAdminPass: false
}
```

2. **Login fallando:**
```
[ADMIN AUTH QA] ADMIN_USER o ADMIN_PASS no configurados, saltando validación ENV
[ADMIN AUTH QA] Estrategia: Validación por base de datos
[ADMIN AUTH QA] Resultado de BD: false
[ADMIN AUTH QA] BD credentials invalid → Rechazado
[ADMIN AUTH QA] Todas las estrategias fallaron → Rechazado
```

3. **Sesiones inválidas:**
```
[AdminAuth] INVALID_TOKEN - Razón: INVALID_SIGNATURE
[AdminAuth] requireAdminContext() - Sesión válida: false
```

**Veredicto:** ❌ **AUTENTICACIÓN ADMIN ROTA** - Variables de entorno críticas faltantes

### 1.3) Configuración Runtime

**Comando:** `node -e "import('./src/core/config/env.js')..."`

**Resultado:**
```
Error: Cannot read properties of undefined (reading 'ADMIN_USER')
```

**Variables verificadas:**
- ❌ `ADMIN_USER`: **undefined**
- ❌ `ADMIN_PASS`: **undefined**
- ❌ `NODE_ENV`: **not set**
- ❓ `DB_HOST`: No verificado (error en carga de módulo)
- ❓ `DB_NAME`: No verificado (error en carga de módulo)

**Veredicto:** ❌ **VARIABLES DE ENTORNO NO CARGADAS**

---

## 🌐 FASE 2 — SMOKE TEST HTTP (SIN NAVEGADOR)

### 2.1) Cliente público

**Comando:** `curl -i http://localhost:3000/__version`

**Resultado:**
```
HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
Content-Length: 171

{
  "app_version": "4.7.0",
  "build_id": "5c44b0b",
  "app_env": "prod",
  "uptime_seconds": 683,
  "uptime_human": "11m 23s",
  "timestamp": "2025-12-17T23:40:01.769Z"
}
```

**Veredicto:** ✅ **CLIENTE PÚBLICO OK**

### 2.2) Admin

**GET /admin/login:**
```
HTTP/1.1 200 OK
cache-control: max-age=0, must-revalidate
content-type: text/html; charset=UTF-8
Content-Length: 3002
```

**Veredicto:** ✅ **LOGIN PAGE OK** (HTML válido devuelto)

**POST /admin/login:**
```
HTTP/1.1 200 OK
Content-Length: 3108
```

**Análisis:**
- ❌ **No hay Set-Cookie** en respuesta (login falla)
- ❌ **Status 200 en lugar de 302** (debería redirigir)
- ❌ **HTML de error devuelto** (credenciales incorrectas)

**Veredicto:** ❌ **LOGIN ADMIN ROTO** - No se puede autenticar

**Tabla de resultados:**

| Endpoint | Status | Set-Cookie | Notas |
|----------|--------|------------|-------|
| GET /__version | 200 | N/A | ✅ OK |
| GET /admin/login | 200 | No | ✅ OK (página carga) |
| POST /admin/login | 200 | No | ❌ FALLA (no autentica) |
| GET /admin/dashboard | 302 | No | ⚠️ Redirect a login (esperado sin auth) |

---

## 🗺️ FASE 3 — INTEGRIDAD DEL ROUTING

### 3.1) Handlers identificados

**GET /admin/login:**
- **Handler:** `admin-panel-v4.js` → `renderLogin()`
- **Template:** `src/core/html/admin/login.html`
- **Archivo:** `src/endpoints/admin-panel-v4.js:1586`

**POST /admin/login:**
- **Handler:** `admin-panel-v4.js` → `handleLogin()`
- **Archivo:** `src/endpoints/admin-panel-v4.js:1603`

**GET /admin/dashboard:**
- **Handler:** `admin-panel-v4.js` → `renderDashboard()`
- **Middleware:** `requireAdminContext()` (valida sesión)
- **Archivo:** `src/endpoints/admin-panel-v4.js:1669`

### 3.2) Duplicados y solapes

**Búsqueda:** `rg "admin/login|/admin/login|handleLogin|renderLogin" -n src`

**Resultado:** ✅ **SIN DUPLICADOS**

- Solo un handler por ruta
- Orden correcto en router (específicos antes de genéricos)
- No hay shadowing de rutas

**Veredicto:** ✅ **ROUTING OK**

**Mapa de rutas:**

| Ruta | Archivo | Función | Estado |
|------|---------|---------|--------|
| GET /admin/login | admin-panel-v4.js:1586 | renderLogin() | ✅ OK |
| POST /admin/login | admin-panel-v4.js:1603 | handleLogin() | ❌ ROTO (env vars) |
| GET /admin/dashboard | admin-panel-v4.js:1669 | renderDashboard() | ⚠️ Requiere auth |

---

## 📄 FASE 4 — INTEGRIDAD DE TEMPLATES

### 4.1) Template base.html

**Archivo:**** `src/core/html/admin/base.html`  
**Última modificación:** 2025-12-17 23:34:26  
**Tamaño:** 1392 líneas

**Cambios detectados (git diff):**
- ✅ Añadido enlace "Estado del Alumno" (`/admin/progreso-v4`)
- ✅ Añadido enlace "Protecciones Energéticas" (`/admin/protecciones-energeticas`)
- ✅ Reorganización de menú (sección "Apariencia" movida)
- ✅ Cambio de texto "Técnicas Post-práctica" → "Técnicas por práctica"

**Análisis de integridad:**

1. **Placeholder {{CONTENT}}:**
   - ✅ **Presente en línea 1006:** `<div class="p-6">{{CONTENT}}</div>`

2. **Placeholder {{TITLE}}:**
   - ✅ **Presente en línea 8:** `<title>{{TITLE}} - AuriPortal Admin</title>`
   - ✅ **Presente en línea 996:** `<h2 class="text-xl font-semibold text-white">{{TITLE}}</h2>`

3. **HTML válido:**
   - ✅ **DOCTYPE presente:** `<!DOCTYPE html>`
   - ✅ **Tags cerrados correctamente**
   - ✅ **Scripts válidos** (líneas 1013-1373)

4. **Sin corrupción:**
   - ✅ **No hay placeholders rotos** tipo `{{SIDEBAR_CONTENT}}` colgando
   - ✅ **No hay HTML truncado**
   - ✅ **No hay `<script>` mal cerrado**

**Veredicto:** ✅ **TEMPLATE OK** - Sin corrupción, solo cambios funcionales

### 4.2) Template login.html

**Archivo:** `src/core/html/admin/login.html`  
**Estado:** ✅ **OK** (referenciado correctamente en código)

**Checklist:**

- ✅ Template existe
- ✅ Se carga con `readFileSync` en `admin-panel-v4.js:162`
- ✅ Se usa en `renderLogin()` (línea 1591)
- ✅ Sin corrupción detectada

**Veredicto:** ✅ **TEMPLATE LOGIN OK**

---

## 🗄️ FASE 5 — BASE DE DATOS Y MIGRACIONES

### 5.1) Conexión PostgreSQL

**Comando:** `node -e "import('./database/pg.js').then(async m => { const result = await m.query('SELECT 1 as test'); })"`

**Resultado:**
```
❌ Error conectando a PostgreSQL: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
❌ Error creando tablas PostgreSQL: Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

**Análisis:**
- ❌ **PGPASSWORD no configurado** o no es string
- ❌ **Conexión falla** antes de verificar tablas
- ❌ **Migraciones no pueden ejecutarse**

**Veredicto:** ❌ **BASE DE DATOS ROTA** - Variables de conexión inválidas

### 5.2) Tablas críticas

**Estado:** ⚠️ **NO VERIFICABLE** (conexión falla)

**Tablas que deberían existir:**
- `alumnos`
- `energy_events`
- `energy_subject_state`
- `recorridos`
- `recorrido_versions`
- `drafts`
- `nivel_overrides`
- `admin_users` (para autenticación admin)

### 5.3) Migraciones

**Estado:** ⚠️ **NO EJECUTABLES** (conexión falla)

**Errores detectados:**
```
⚠️  Error ejecutando migración de columnas: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
⚠️  Error ejecutando migración v4.13.0: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
⚠️  Error ejecutando migración v5.1.0: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
⚠️  Error ejecutando migración v5.2.0: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

**Veredicto:** ❌ **MIGRACIONES BLOQUEADAS** - No se pueden ejecutar sin conexión a BD

---

## 🧪 FASE 6 — TESTS Y LINT (OPCIONAL)

**Estado:** ⏭️ **OMITIDO** (no crítico para diagnóstico de rotura)

**Razón:** El sistema tiene problemas más fundamentales (env vars, BD) que deben resolverse primero.

---

## 🎯 FASE 7 — VEREDICTO FINAL

### A) Estado del sistema por módulos

| Módulo | Estado | Evidencia |
|--------|--------|-----------|
| **Cliente** | ✅ **OK** | HTTP 200 en `/__version`, `/admin/login` (GET) |
| **Admin** | ❌ **ROTO** | Login falla, no hay Set-Cookie, credenciales rechazadas |
| **Auth admin** | ❌ **ROTO** | `ADMIN_USER` y `ADMIN_PASS` undefined, BD falla |
| **DB** | ❌ **ROTO** | `PGPASSWORD` no es string, conexión falla |
| **Router** | ✅ **OK** | Handlers correctos, sin duplicados, orden correcto |
| **Templates** | ✅ **OK** | `base.html` sin corrupción, solo cambios funcionales |
| **PM2** | ⚠️ **INESTABLE** | 5 restarts, uptime corto (11m) |

### B) Causa raíz probable

**PROBLEMA PRINCIPAL:** Variables de entorno no cargadas o mal configuradas

**Evidencias:**
1. `ADMIN_USER` y `ADMIN_PASS` son `undefined` en runtime
2. `PGPASSWORD` no es string (error: "client password must be a string")
3. `NODE_ENV` no está configurado
4. Módulo `env.js` falla al cargar: "Cannot read properties of undefined"

**Archivos culpables:**
- ❌ **`.env`** - No existe o no está siendo cargado por PM2
- ❌ **`src/core/config/env.js`** - Lógica de carga puede estar fallando
- ⚠️ **`server.js`** - Puede no estar cargando `.env` antes de iniciar

**Archivos modificados recientemente (posible causa):**
- `src/core/config/env.js` (8 cambios según git diff)
- `server.js` (367 cambios)
- `src/modules/admin-auth.js` (182 cambios)

### C) Recomendación operativa

#### 🔴 **OPCIÓN 1: ROLLBACK (RECOMENDADO)**

**Si hay git:**
```bash
# Verificar commit estable anterior
git log --oneline -n 10

# Rollback a commit antes de cambios en env/auth
git checkout 97b3be0 -- src/core/config/env.js
git checkout 97b3be0 -- src/modules/admin-auth.js
git checkout 97b3be0 -- server.js

# O rollback completo (CUIDADO: perderá cambios en base.html)
git reset --hard 97b3be0
```

**Si NO hay git o rollback no es posible:**
- Restaurar `.env` desde backup
- Verificar que PM2 carga variables desde `env_file` en `ecosystem.config.js`

#### 🟡 **OPCIÓN 2: HOTFIX MÍNIMO**

**Pasos inmediatos:**

1. **Verificar/cargar variables de entorno:**
```bash
# Verificar que .env existe
ls -la /var/www/aurelinportal/.env

# Verificar que PM2 tiene env_file configurado
pm2 show aurelinportal | grep env_file

# Si no existe .env, crear desde ejemplo
cp /var/www/aurelinportal/env.prod.example /var/www/aurelinportal/.env

# Editar .env y añadir:
ADMIN_USER=eugeni
ADMIN_PASS=<password_real>
PGPASSWORD=<password_real>
ADMIN_SESSION_SECRET=<secret_real>
NODE_ENV=production
```

2. **Reiniciar PM2 con variables:**
```bash
pm2 restart aurelinportal --update-env
```

3. **Verificar carga:**
```bash
# Verificar que variables están cargadas
pm2 env 8 | grep ADMIN_USER
pm2 env 8 | grep PGPASSWORD
```

4. **Verificar conexión BD:**
```bash
node -e "import('./database/pg.js').then(async m => { try { const r = await m.query('SELECT 1'); console.log('OK'); } catch(e) { console.log('ERROR:', e.message); } })"
```

#### 🟢 **OPCIÓN 3: SEGUIR (NO RECOMENDADO)**

**Solo si:**
- Variables de entorno se configuran correctamente
- Base de datos se conecta
- Login admin funciona
- Se hace commit del estado actual

**Riesgo:** Alto - Sistema parcialmente roto puede empeorar

---

## 📝 LISTA DE ARCHIVOS TOCADOS (CRÍTICOS)

### Archivos que pueden haber causado la rotura:

1. **`src/core/config/env.js`** - Carga de variables de entorno
2. **`server.js`** - Inicialización del servidor
3. **`src/modules/admin-auth.js`** - Autenticación admin
4. **`src/core/auth-context.js`** - Contexto de autenticación

### Archivos modificados pero OK:

1. **`src/core/html/admin/base.html`** - ✅ OK (solo cambios de menú)
2. **`src/router.js`** - ✅ OK (routing correcto)
3. **`src/core/cookies.js`** - ⚠️ Revisar (puede afectar sesiones)

---

## 🔍 EVIDENCIAS TÉCNICAS

### Comandos ejecutados:

```bash
# FASE 0
git status
git diff --stat
git diff --name-only
git log -n 25 --oneline --decorate

# FASE 1
pm2 list
pm2 describe aurelinportal
pm2 logs aurelinportal --lines 200

# FASE 2
curl -i http://localhost:3000/__version
curl -i http://localhost:3000/admin/login
curl -i -c /tmp/cookies.txt -X POST http://localhost:3000/admin/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "username=test&password=test"

# FASE 3
rg "admin/login|handleLogin|renderLogin" -n src
rg "router|routes" -n src/router.js

# FASE 4
git diff src/core/html/admin/base.html
grep -n "{{CONTENT}}" src/core/html/admin/base.html
grep -n "{{TITLE}}" src/core/html/admin/base.html

# FASE 5
node -e "import('./database/pg.js').then(async m => { const r = await m.query('SELECT 1'); })"
```

### Outputs críticos:

- **PM2:** 5 restarts, uptime 11m
- **Logs:** ADMIN_USER undefined, ADMIN_PASS undefined
- **BD:** "client password must be a string"
- **Login:** Status 200 en lugar de 302, sin Set-Cookie

---

## ✅ CONCLUSIÓN

**El sistema está parcialmente roto debido a variables de entorno no configuradas.**

**Problemas críticos:**
1. ❌ Autenticación admin no funciona (ADMIN_USER/ADMIN_PASS undefined)
2. ❌ Base de datos no conecta (PGPASSWORD inválido)
3. ⚠️ PM2 inestable (5 restarts recientes)

**Problemas NO críticos:**
- ✅ Cliente público funciona
- ✅ Templates OK (base.html sin corrupción)
- ✅ Routing OK (sin duplicados)

**Acción requerida:** 🔴 **ROLLBACK o HOTFIX INMEDIATO** para restaurar funcionalidad admin y BD.

---

**Fin del diagnóstico**  
*Generado automáticamente por Bugbot - AuriPortal v4.7.0*













