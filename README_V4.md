# 🟣 AuriPortal v4 - Sovereign Edition

**PostgreSQL como ÚNICA fuente de verdad del sistema**

## 📋 Índice

1. [Arquitectura](#arquitectura)
2. [Tablas SQL](#tablas-sql)
3. [Endpoints](#endpoints)
4. [Webhooks](#webhooks)
5. [Flujos](#flujos)
6. [Sincronización de Frases](#sincronización-de-frases)
7. [Sistema de Niveles](#sistema-de-niveles)
8. [Sistema de Pausas](#sistema-de-pausas)
9. [Variables Dinámicas](#variables-dinámicas)
10. [Despliegue](#despliegue)

---

## 🏗️ Arquitectura

### Principio Fundamental

**PostgreSQL es la ÚNICA fuente de verdad del sistema.**

ClickUp se usa **SOLO** como entorno creativo para frases. El sistema operativo nunca lee de ClickUp (excepto el sincronizador diario de frases).

### Diagrama de Arquitectura

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Kajabi    │─────►│   PostgreSQL │◄─────│  Typeform   │
│   Webhook   │      │   (Fuente    │      │  Webhook    │
└─────────────┘      │   de Verdad) │      └─────────────┘
                      └──────────────┘
                             ▲
                             │
                      ┌──────┴──────┐
                      │             │
                ┌─────▼─────┐  ┌───▼──────┐
                │  Portal   │  │ Scheduler│
                │  Web App  │  │  (Cron)  │
                └───────────┘  └──────────┘
                                    │
                                    │ (diario)
                                    ▼
                            ┌──────────────┐
                            │   ClickUp    │
                            │ (Solo frases)│
                            └──────────────┘
```

---

## 📊 Tablas SQL

### Tabla: `alumnos`

Almacena toda la información de los alumnos.

```sql
CREATE TABLE alumnos (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  apodo VARCHAR(255),
  fecha_inscripcion TIMESTAMP NOT NULL,
  fecha_ultima_practica TIMESTAMP,
  nivel_actual INTEGER DEFAULT 1,
  nivel_manual INTEGER,
  streak INTEGER DEFAULT 0,
  estado_suscripcion VARCHAR(50) DEFAULT 'activa',
  fecha_reactivacion TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos clave:**
- `nivel_actual`: Nivel automático calculado
- `nivel_manual`: Nivel manual (override, null si no hay)
- `streak`: Racha actual de prácticas
- `estado_suscripcion`: 'activa', 'pausada', 'cancelada'

### Tabla: `pausas`

Registra intervalos de pausa de suscripciones.

```sql
CREATE TABLE pausas (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  inicio TIMESTAMP NOT NULL,
  fin TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `practicas`

Registra todas las prácticas realizadas.

```sql
CREATE TABLE practicas (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL,
  tipo VARCHAR(100),
  origen VARCHAR(100),
  duracion INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `frases_nivel`

Almacena frases por nivel (sincronizadas desde ClickUp).

```sql
CREATE TABLE frases_nivel (
  id SERIAL PRIMARY KEY,
  nivel INTEGER NOT NULL,
  frase TEXT NOT NULL,
  clickup_task_id VARCHAR(255) UNIQUE,
  origen VARCHAR(50) DEFAULT 'clickup',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `niveles_fases`

Define las fases del sistema de niveles.

```sql
CREATE TABLE niveles_fases (
  id SERIAL PRIMARY KEY,
  fase VARCHAR(100) NOT NULL,
  nivel_min INTEGER,
  nivel_max INTEGER,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Datos iniciales:**
- `sanación`: niveles 1-6
- `sanación avanzada`: niveles 7-9
- `canalización`: niveles 10-15
- `creación`: null-null (futuro)
- `servicio`: null-null (futuro)

---

## 🔌 Endpoints

### Principales

- `GET /` o `GET /enter` - Portal principal (usa PostgreSQL)
- `GET /topics` - Lista de temas (usa PostgreSQL)
- `GET /topic/:id` - Pantalla de tema específico (usa PostgreSQL)
- `GET /aprender` - Pantalla de aprendizaje (usa PostgreSQL)
- `GET /onboarding-complete` - Completar onboarding (usa PostgreSQL)

### Webhooks

- `POST /kajabi-webhook` - Webhook de Kajabi
  - Eventos: `purchase`, `subscription_activated`, `subscription_deactivated`, `subscription_cancelled`
  - Crea/actualiza alumnos en PostgreSQL
  - Maneja pausas y reactivaciones automáticamente
  
- `POST /typeform-webhook` - Webhook de Typeform (v4)
  - Recibe respuestas del formulario de bienvenida
  - Crea/actualiza alumnos en PostgreSQL
  - Registra prácticas si corresponde

### Administración

- `GET /admin` - Panel de administración
- `GET /health-check` - Estado del sistema

---

## 📥 Webhooks

### Webhook de Kajabi (`/kajabi-webhook`)

**Eventos soportados:**

#### `purchase` - Creación de Alumno
1. Recibe datos de compra desde Kajabi
2. Extrae email, nombre, fecha de compra
3. Crea o actualiza alumno en PostgreSQL
4. Establece `nivel_actual = 1`
5. Establece `streak = 0`
6. Establece `fecha_inscripcion = fecha de compra`
7. Establece `estado_suscripcion = 'activa'`

#### `subscription_activated` / `subscription_reactivated`
1. Busca alumno en PostgreSQL
2. Cierra pausa activa si existe
3. Actualiza `estado_suscripcion = 'activa'`
4. Establece `fecha_reactivacion = ahora`

#### `subscription_deactivated` / `subscription_paused`
1. Busca alumno en PostgreSQL
2. Crea nueva pausa (inicio = ahora, fin = null)
3. Actualiza `estado_suscripcion = 'pausada'`

#### `subscription_cancelled`
1. Busca alumno en PostgreSQL
2. Cierra pausa activa si existe
3. Actualiza `estado_suscripcion = 'cancelada'`

**Respuesta:** `200 OK`

### Webhook de Typeform (`/typeform-webhook`)

**Proceso:**
1. Recibe respuesta del formulario
2. Extrae email, apodo, respuestas
3. Crea o actualiza alumno en PostgreSQL
4. Si es práctica, registra en tabla `practicas`
5. Actualiza `fecha_ultima_practica`
6. Recalcula `streak`

**Respuesta:** JSON con estado y datos del alumno

---

## 🔄 Flujos

### Flujo de Entrada (Alumno)

1. Alumno accede a `/enter`
2. Sistema verifica cookie
3. Si no hay cookie → Pantalla 0 (ingresar email)
4. Si hay cookie → Busca alumno en PostgreSQL
5. Si existe → Muestra pantalla de racha
6. Si no existe → Redirige a Typeform

### Flujo de Práctica

1. Alumno hace clic en "Sí, hoy practico"
2. Sistema verifica `estado_suscripcion`
3. Si pausada → Muestra mensaje de pausa
4. Si activa → Registra práctica
5. Actualiza `fecha_ultima_practica`
6. Recalcula `streak`
7. Actualiza nivel si corresponde
8. Muestra pantalla de confirmación

### Flujo de Niveles

1. Sistema calcula días activos: `(hoy - fecha_inscripcion) - total_dias_pausa`
2. Determina nivel según umbrales
3. Si `nivel_manual` existe → Respeta nivel manual
4. Si no → Actualiza `nivel_actual` si es mayor
5. Calcula fase desde tabla `niveles_fases`

---

## 🔄 Sincronización de Frases

### Proceso Diario (4:00 AM)

1. Conecta a ClickUp API
2. Lee listas "Nivel 1", "Nivel 2", ... "Nivel 15"
3. Por cada tarea:
   - Extrae título (texto de la frase)
   - Extrae ID (clickup_task_id)
   - Determina nivel según lista
4. En PostgreSQL:
   - Inserta nuevas frases
   - Actualiza frases existentes
   - Actualiza nivel si cambió
   - Elimina frases que desaparecieron

**Archivo:** `src/services/sync-frases-clickup.js`

**Configuración:** Tarea cron en `src/services/scheduler.js`

---

## 📈 Sistema de Niveles

### Cálculo de Nivel

```javascript
dias_activos = (hoy - fecha_inscripcion) - total_dias_pausa
nivel = calcularNivelPorDiasActivos(dias_activos)
```

### Umbrales de Niveles

| Días Activos | Nivel | Fase |
|--------------|-------|------|
| 0-39 | 1 | Sanación |
| 40-59 | 2 | Sanación |
| 60-89 | 3 | Sanación |
| 90-119 | 4 | Sanación |
| 120-149 | 5 | Sanación |
| 150-179 | 6 | Sanación |
| 180-229 | 7 | Sanación Avanzada |
| 230-259 | 8 | Sanación Avanzada |
| 260-289 | 9 | Sanación Avanzada |
| 290-319 | 10 | Canalización |
| 320-349 | 11 | Canalización |
| 350-379 | 12 | Canalización |
| 380-409 | 13 | Canalización |
| 410-439 | 14 | Canalización |
| 440+ | 15 | Canalización |

### Funciones Utilitarias

- `getNivelPorDiasActivos(alumnoId)` - Calcula nivel por días activos
- `getFasePorNivel(nivel)` - Obtiene fase desde PostgreSQL
- `getDiasActivos(alumnoId)` - Calcula días activos (considerando pausas)
- `actualizarNivelSiCorresponde(student, env)` - Actualiza nivel si es necesario

---

## ⏸️ Sistema de Pausas

### Registro de Pausa

Cuando una suscripción se pausa:
1. Se crea registro en tabla `pausas`
2. `inicio = fecha actual`
3. `fin = null` (se completa al reactivar)

### Reactivación

Cuando se reactiva:
1. Se actualiza registro de pausa: `fin = fecha actual`
2. Se actualiza `fecha_reactivacion` en tabla `alumnos`
3. Se actualiza `estado_suscripcion = 'activa'`

### Cálculo de Días Activos

```javascript
dias_totales = (hoy - fecha_inscripcion) / días
dias_pausados = SUM((fin - inicio) / días) de todas las pausas
dias_activos = dias_totales - dias_pausados
```

---

## 🎨 Variables Dinámicas

### Motor de Templates

**Archivo:** `src/modules/template-engine.js`

**Función:** `renderTemplate(frase, alumno)`

### Variables Disponibles

- `{apodo}` - Apodo del alumno
- `{nivel}` - Nivel numérico actual
- `{fase}` - Fase actual (sanación, canalización, etc.)

### Uso en Frases

**Archivo:** `src/modules/frases.js`

**Función:** `getFrasePorNivel(nivel, alumno)`

Obtiene una frase aleatoria del nivel y la renderiza automáticamente con variables dinámicas.

### Ejemplo

```javascript
import { getFrasePorNivel } from './modules/frases.js';

const frase = await getFrasePorNivel(5, alumno);
// Si la frase en DB es: "Hola {apodo}, estás en el nivel {nivel} de {fase}."
// Resultado: "Hola María, estás en el nivel 5 de sanación."
```

---

## 🚀 Despliegue

### Requisitos

- Node.js >= 18.0.0
- PostgreSQL >= 12
- Variables de entorno configuradas

### Variables de Entorno

```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@host:port/database
# O individualmente:
PGUSER=postgres
PGPASSWORD=password
PGHOST=localhost
PGPORT=5432
PGDATABASE=aurelinportal
PGSSL=false

# ClickUp (solo para sincronización de frases)
CLICKUP_API_TOKEN=tu_token
CLICKUP_SPACE_ID=tu_space_id

# Kajabi
KAJABI_CLIENT_ID=tu_client_id
KAJABI_CLIENT_SECRET=tu_client_secret

# Typeform
TYPEFORM_API_TOKEN=tu_token

# Otros
COOKIE_SECRET=tu_secret
SERVER_URL=https://tu-dominio.com
```

### Instalación

```bash
# Instalar dependencias
npm install

# Inicializar base de datos (se crea automáticamente al iniciar)
npm start

# O con PM2
npm run pm2:start
```

### Verificación

1. Acceder a `/health-check` para verificar configuración
2. Verificar logs del servidor
3. Probar webhook de Kajabi
4. Probar webhook de Typeform

---

## 📝 Notas Importantes

### Migración desde v3

- **NO eliminar** código legacy inmediatamente
- Mantener compatibilidad temporal con SQLite
- Migrar datos gradualmente
- Probar exhaustivamente antes de eliminar ClickUp como backend

### ClickUp

- **SOLO** se usa para sincronización diaria de frases
- **NO** se lee desde el portal operativo
- **NO** se escribe desde el portal operativo
- Es solo entorno creativo

### PostgreSQL

- **ÚNICA** fuente de verdad
- Todas las operaciones CRUD van a PostgreSQL
- ClickUp es solo lectura para frases (sincronizador)

---

## 🔧 Mantenimiento

### Sincronización Manual de Frases

```javascript
import { sincronizarFrasesClickUpAPostgreSQL } from './src/services/sync-frases-clickup.js';
await sincronizarFrasesClickUpAPostgreSQL(env);
```

### Verificar Estado

- Acceder a `/health-check`
- Revisar logs del servidor
- Verificar tablas en PostgreSQL

---

**AuriPortal v4 - Sovereign Edition**  
*PostgreSQL como ÚNICA fuente de verdad*

