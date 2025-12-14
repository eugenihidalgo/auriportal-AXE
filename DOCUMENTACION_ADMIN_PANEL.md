# Documentación Completa del Panel Admin - AuriPortal

## Índice
1. [Introducción](#introducción)
2. [Arquitectura General](#arquitectura-general)
3. [Sistema de Autenticación](#sistema-de-autenticación)
4. [Módulos Principales](#módulos-principales)
5. [Funcionalidades Detalladas](#funcionalidades-detalladas)
6. [Base de Datos](#base-de-datos)
7. [Estado Actual y Pendientes](#estado-actual-y-pendientes)

---

## Introducción

El Panel Admin de AuriPortal es un sistema completo de gestión administrativa construido sobre Node.js y PostgreSQL. Proporciona una interfaz web para gestionar estudiantes, prácticas, aspectos pedagógicos, configuración de flujos de trabajo y más.

**URL de Acceso:** `https://admin.pdeeugenihidalgo.org`

**Tecnologías:**
- Backend: Node.js 18+ (ES Modules)
- Base de Datos: PostgreSQL
- Frontend: HTML + Tailwind CSS (CDN)
- Autenticación: Sistema de sesiones con cookies HTTP-only

---

## Arquitectura General

### Estructura de Archivos

```
src/
├── endpoints/
│   ├── admin-panel-v4.js          # Router principal del admin
│   ├── admin-panel-pedagogico.js  # Módulo pedagógico
│   ├── admin-panel-pedagogico-caminos.js  # Configuración de botones/caminos
│   └── admin-panel-workflow.js    # Configuración de workflow/lienzo
├── modules/
│   ├── admin-auth.js              # Autenticación
│   └── admin-data.js              # Helpers de datos
└── core/
    └── html/
        └── admin/
            ├── base.html          # Template base
            └── login.html         # Template de login
```

### Flujo de Peticiones

1. **Request** → `server.js` (crea objeto Request compatible con Workers)
2. **Router** → `src/router.js` → `admin-panel-v4.js`
3. **Autenticación** → `admin-auth.js` (verifica sesión)
4. **Handler** → Función específica según la ruta
5. **Datos** → `database/pg.js` (PostgreSQL)
6. **Response** → HTML renderizado con template base

---

## Sistema de Autenticación

### Archivo: `src/modules/admin-auth.js`

#### Funciones Principales

**1. `validateAdminCredentials(username, password)`**
- Valida credenciales contra variables de entorno
- Variables: `ADMIN_USER`, `ADMIN_PASS`
- Retorna: `true` si las credenciales son correctas

**2. `createAdminSession(rememberMe)`**
- Crea una sesión admin con token firmado
- Duración:
  - Normal: 12 horas
  - "Remember Me": 30 días
- Almacenamiento: Map en memoria (para producción usar Redis)
- Retorna: `{ token, rememberMe }`

**3. `validateAdminSession(request)`**
- Valida token de sesión desde cookie `admin_session`
- Verifica:
  - Formato del token
  - Expiración
  - Firma HMAC-SHA256
  - Existencia en sesiones activas
- Retorna: `true` si la sesión es válida

**4. `requireAdminAuth(request)`**
- Middleware para proteger rutas
- Retorna: `{ requiresAuth: boolean, redirect: string }`

**5. `destroyAdminSession(request)`**
- Cierra sesión eliminando token del Map

### Seguridad

- Tokens firmados con HMAC-SHA256
- Cookies HTTP-only (no accesibles desde JavaScript)
- SameSite=Strict (protección CSRF)
- Limpieza automática de sesiones expiradas

### Limitaciones Actuales

- Sesiones almacenadas en memoria (se pierden al reiniciar)
- No hay límite de intentos de login
- No hay 2FA

---

## Módulos Principales

### 1. Router Principal (`admin-panel-v4.js`)

**Archivo:** `src/endpoints/admin-panel-v4.js`

#### Rutas Disponibles

| Ruta | Método | Función | Descripción |
|------|--------|---------|-------------|
| `/admin/login` | GET/POST | `renderLogin()` / `handleLogin()` | Página de login |
| `/admin/logout` | POST | `handleLogout()` | Cerrar sesión |
| `/admin/dashboard` | GET | `renderDashboard()` | Dashboard principal |
| `/admin/alumnos` | GET | `renderAlumnos()` | Lista de alumnos |
| `/admin/alumnos` | POST | `handleCreateAlumno()` | Crear alumno |
| `/admin/alumno/:id` | GET | `renderAlumnoDetail()` | Detalle de alumno |
| `/admin/alumno/:id` | POST | `handleUpdateAlumno()` | Actualizar alumno |
| `/admin/alumno/:id/delete` | POST | `handleDeleteAlumno()` | Eliminar alumno |
| `/admin/alumno/:id/recalcular-nivel` | POST | `handleRecalcularNivel()` | Recalcular nivel |
| `/admin/practicas` | GET | `renderPracticas()` | Lista de prácticas |
| `/admin/frases` | GET | `renderFrases()` | Lista de frases |
| `/admin/frases?action=sync` | POST | `handleSyncFrases()` | Sincronizar frases desde ClickUp |
| `/admin/respuestas` | GET | `renderRespuestas()` | Histórico de respuestas |
| `/admin/recorrido-pedagogico` | GET | `renderRecorridoPedagogico()` | Recorrido pedagógico |
| `/admin/recorrido-pedagogico` | POST | `handleUpdateProgresoPedagogico()` | Actualizar recomendaciones |
| `/admin/configuracion-aspectos` | GET | `renderConfiguracionAspectos()` | Configurar aspectos |
| `/admin/configuracion-aspectos` | POST | `handleUpdateAspecto()` | Crear/editar/eliminar aspecto |
| `/admin/configuracion-racha` | GET | `renderConfiguracionRacha()` | Configurar fases de racha |
| `/admin/configuracion-racha` | POST | `handleUpdateRachaFase()` | Crear/editar/eliminar fase |
| `/admin/configuracion-caminos` | GET | `renderConfiguracionCaminos()` | Configurar botones/caminos |
| `/admin/configuracion-caminos` | POST | `handleUpdateCamino()` | Crear/editar/eliminar camino |
| `/admin/configuracion-workflow` | GET | `renderConfiguracionWorkflow()` | Configurar workflow |
| `/admin/configuracion-workflow` | POST | `handleUpdateWorkflow()` | Actualizar workflow |
| `/admin/email` | GET | `renderEmailForm()` | Formulario de email |
| `/admin/email` | POST | `handleSendEmail()` | Enviar email |
| `/admin/configuracion` | GET | `renderConfiguracion()` | Ver configuración del sistema |
| `/admin/logs` | GET | `renderLogs()` | Logs del sistema |

#### Funciones Helper

**`getAbsoluteUrl(request, path)`**
- Construye URLs absolutas para redirecciones
- Necesario porque el servidor puede estar detrás de proxy

**`createSessionCookie(token, rememberMe)`**
- Crea cookie de sesión con expiración apropiada

**`replace(html, placeholders)`**
- Reemplaza placeholders `{{KEY}}` en templates HTML

---

### 2. Dashboard (`renderDashboard`)

**Ubicación:** `admin-panel-v4.js` línea 328

#### Funcionalidades

1. **Estadísticas Principales**
   - Total de alumnos
   - Alumnos por estado (activa, pausada, cancelada)
   - Alumnos por fase (sanación, sanación avanzada, canalización, creación, servicio)

2. **Últimas 10 Prácticas**
   - Fecha, email, tipo, origen
   - Ordenadas por fecha descendente

3. **Últimos 10 Alumnos Creados**
   - Email, apodo, nivel, fecha de inscripción

#### Datos Obtenidos

- `getDashboardStats()` desde `admin-data.js`
- Consultas SQL optimizadas con índices

---

### 3. Gestión de Alumnos

#### Lista de Alumnos (`renderAlumnos`)

**Ubicación:** `admin-panel-v4.js` línea 500

**Funcionalidades:**

1. **Filtros**
   - Búsqueda por email/apodo
   - Filtro por estado (activa, pausada, cancelada)
   - Filtro por fase
   - Filtro por nivel

2. **Ordenamiento**
   - Por email, apodo, nivel, fecha inscripción, streak, estado, última práctica
   - Ascendente/descendente

3. **Paginación**
   - 50 alumnos por página
   - Navegación con números de página

4. **Acciones Masivas**
   - Botón "Recalcular Todos los Niveles"
   - Procesa todos los alumnos (excepto pausados)
   - Muestra estadísticas de resultados

5. **Crear Alumno**
   - Modal con formulario
   - Campos: email, apodo, nivel inicial, fecha inscripción
   - Validación: email requerido

#### Detalle de Alumno (`renderAlumnoDetail`)

**Ubicación:** `admin-panel-v4.js` línea 768

**Secciones:**

1. **Formulario de Edición**
   - Email (readonly)
   - Apodo
   - Nivel Actual
   - Nivel Manual (sobrescribe automático)
   - Streak
   - Estado Suscripción
   - Fecha Inscripción
   - Última Práctica
   - Fase (calculada, readonly)
   - Días PDE (calculado, readonly)
   - Días Activos (calculado, readonly)
   - Días en Pausa (calculado, readonly)

2. **Información de Kajabi**
   - Datos personales completos
   - Ofertas/suscripciones
   - Compras
   - Acceso a Mundo de Luz

3. **Prácticas Recientes**
   - Últimas 20 prácticas
   - Fecha, tipo, origen, duración

4. **Pausas**
   - Historial completo de pausas
   - Inicio, fin, duración en días

**Acciones:**
- Guardar Cambios
- Recalcular Nivel (solo si no hay nivel manual)
- Eliminar Alumno (con confirmación)

#### Actualizar Alumno (`handleUpdateAlumno`)

**Ubicación:** `admin-panel-v4.js` línea 1029

**Campos Actualizables:**
- `apodo`
- `nivel_manual` (null para usar automático)
- `estado_suscripcion`
- `nivel_actual`
- `streak`
- `fecha_inscripcion`
- `fecha_ultima_practica`

**Lógica Especial:**
- Si se actualiza `fecha_inscripcion` o se elimina `nivel_manual`, recalcula nivel automático
- Actualiza `updated_at` automáticamente

#### Eliminar Alumno (`handleDeleteAlumno`)

**Ubicación:** `admin-panel-v4.js` línea 1531

**Efectos:**
- Elimina alumno y todos sus datos relacionados (CASCADE)
- Elimina prácticas, pausas, progreso pedagógico

---

### 4. Prácticas

#### Lista de Prácticas (`renderPracticas`)

**Ubicación:** `admin-panel-v4.js` línea 1089

**Funcionalidades:**

1. **Filtros**
   - Fecha desde/hasta
   - Tipo de práctica
   - Email del alumno

2. **Ordenamiento**
   - Por fecha, email, tipo, origen, duración
   - Ascendente/descendente

3. **Paginación**
   - 50 prácticas por página

**Datos Mostrados:**
- Fecha
- Email del alumno
- Tipo
- Origen
- Duración

---

### 5. Frases

#### Lista de Frases (`renderFrases`)

**Ubicación:** `admin-panel-v4.js` línea 1209

**Funcionalidades:**

1. **Filtros**
   - Por nivel
   - Búsqueda por texto en la frase

2. **Ordenamiento**
   - Por nivel, frase, fecha creación

3. **Sincronización**
   - Botón "Sincronizar desde ClickUp"
   - Ejecuta `sincronizarFrasesClickUpAPostgreSQL()`
   - Actualiza frases desde ClickUp

**Datos Mostrados:**
- ID
- Nivel
- Frase (truncada a 100 caracteres)
- Origen
- Fecha creación

---

### 6. Respuestas (Histórico)

#### Lista de Respuestas (`renderRespuestas`)

**Ubicación:** `admin-panel-pedagogico.js` línea 30

**Funcionalidades:**

1. **Filtros**
   - Email
   - Nivel de práctica
   - Form ID (Typeform)

2. **Paginación**
   - 50 respuestas por página

**Datos Mostrados:**
- Fecha de envío
- Email
- Apodo
- Nivel de práctica
- Formulario (título o ID)
- Respuesta (truncada a 100 caracteres)

**Tabla:** `respuestas` en PostgreSQL

---

### 7. Recorrido Pedagógico

#### Renderizar Recorrido (`renderRecorridoPedagogico`)

**Ubicación:** `admin-panel-pedagogico.js` línea 134

**Funcionalidades:**

1. **Vista de Matriz**
   - Filas: Alumnos
   - Columnas: Aspectos (cada uno con 3 subcolumnas)
   - Subcolumnas por aspecto:
     - **Iniciarse**: Contador del alumno
     - **Recomendación Master**: Valor configurado por el admin
     - **Conocer**: Contador del alumno
     - **Recomendación Master**: Valor configurado por el admin
     - **Dominio**: Contador del alumno
     - **Recomendación Master**: Valor configurado por el admin

2. **Ordenamiento**
   - Por apodo, email, nivel (ascendente/descendente)

3. **Edición Inline**
   - Inputs numéricos para recomendaciones master
   - Validación en tiempo real (solo números)
   - Guardado automático al cambiar valor
   - Manejo de valores `null` y `0`

**Estructura de Datos:**

```javascript
{
  alumno_id: number,
  email: string,
  apodo: string,
  nivel_actual: number,
  fase: string,
  aspectos: [
    {
      aspecto_id: number,
      aspecto_nombre: string,
      contador_alumno: number,
      recomendacion_iniciarse: number | null,
      recomendacion_conocer: number | null,
      recomendacion_dominio: number | null,
      recomendado_iniciarse: boolean,
      recomendado_conocer: boolean,
      recomendado_dominio: boolean
    }
  ]
}
```

**Lógica de Recomendaciones:**

- Si `contador_alumno >= recomendacion_master` → Recomendado (verde)
- Si `contador_alumno < recomendacion_master` → No recomendado (gris)
- Si `recomendacion_master` es `null` → No configurado (gris)

#### Actualizar Recomendaciones (`handleUpdateProgresoPedagogico`)

**Ubicación:** `admin-panel-pedagogico.js` línea 510

**Proceso:**

1. **Parseo de FormData**
   - Usa `URLSearchParams` (no `FormData`) para compatibilidad con Node.js
   - Obtiene: `alumno_id`, `aspecto_id`, `recomendacion_iniciarse`, `recomendacion_conocer`, `recomendacion_dominio`

2. **Validación Estricta**
   - `alumno_id` y `aspecto_id` deben ser números enteros positivos
   - No acepta `null`, `undefined`, `0`, strings vacíos, `NaN`

3. **Parseo de Recomendaciones**
   - Convierte strings vacíos a `null`
   - Convierte `NaN` a `null`
   - Parsea números válidos

4. **Upsert en Base de Datos**
   - Usa `progresoPedagogico.upsert()` para crear o actualizar
   - Asegura que existe un registro antes de actualizar

5. **Respuesta**
   - JSON con `{ success: true }` o error con detalles

**Tabla:** `progreso_pedagogico`

**Campos:**
- `alumno_id` (FK a `alumnos`)
- `aspecto_id` (FK a `aspectos_practica`)
- `contador_alumno` (calculado automáticamente)
- `recomendacion_master_iniciarse` (configurado por admin)
- `recomendacion_master_conocer` (configurado por admin)
- `recomendacion_master_dominio` (configurado por admin)

---

### 8. Configuración de Aspectos

#### Renderizar Configuración (`renderConfiguracionAspectos`)

**Ubicación:** `admin-panel-pedagogico.js` línea 671

**Funcionalidades:**

1. **Lista de Aspectos**
   - Nombre
   - Descripción
   - Webhook URL (Typeform)
   - Estado (activo/inactivo)
   - Fecha creación

2. **Crear Aspecto**
   - Modal con formulario
   - Campos: nombre, descripción, webhook URL (opcional)
   - Si se proporciona `TYPEFORM_API_TOKEN`, genera webhook automáticamente

3. **Editar Aspecto**
   - Modal pre-rellenado
   - Actualiza nombre, descripción, webhook URL

4. **Eliminar Aspecto**
   - Confirmación requerida
   - Elimina aspecto y todo su progreso relacionado (CASCADE)

**Tabla:** `aspectos_practica`

**Campos:**
- `id`
- `nombre`
- `descripcion`
- `webhook_url` (URL del webhook de Typeform)
- `activo` (boolean)
- `created_at`
- `updated_at`

#### Actualizar Aspecto (`handleUpdateAspecto`)

**Ubicación:** `admin-panel-pedagogico.js` línea 953

**Acciones:**

1. **Crear** (`action=create`)
   - Crea nuevo aspecto
   - Si hay `TYPEFORM_API_TOKEN`, genera webhook automáticamente
   - Usa `generarUrlWebhookAspecto()` y `crearWebhookTypeform()`

2. **Actualizar** (`action=update`)
   - Actualiza nombre, descripción, webhook URL
   - No regenera webhook si ya existe

3. **Eliminar** (`action=delete` o `?delete=id`)
   - Elimina aspecto
   - CASCADE elimina progreso relacionado

---

### 9. Configuración de Racha

#### Renderizar Configuración (`renderConfiguracionRacha`)

**Ubicación:** `admin-panel-pedagogico.js` línea 1024

**Funcionalidades:**

1. **Lista de Fases de Racha**
   - Nombre de fase
   - Días mínimos
   - Días máximos
   - Descripción
   - Orden

2. **Crear Fase**
   - Modal con formulario
   - Campos: nombre, días_min, días_max, descripción, orden

3. **Editar Fase**
   - Modal pre-rellenado

4. **Eliminar Fase**
   - Confirmación requerida

**Tabla:** `racha_fases`

**Campos:**
- `id`
- `fase` (nombre)
- `dias_min` (días mínimos de racha)
- `dias_max` (días máximos de racha, puede ser null)
- `descripcion`
- `orden` (orden de aparición)
- `created_at`
- `updated_at`

**Lógica:**
- Determina la fase de racha de un alumno según su `streak`
- Se usa en el portal para mostrar mensajes motivacionales

#### Actualizar Fase (`handleUpdateRachaFase`)

**Ubicación:** `admin-panel-pedagogico.js` línea 1251

**Acciones:**
- Crear, actualizar, eliminar fases de racha
- Validación de rangos (días_min < días_max)

---

### 10. Configuración de Caminos/Botones

#### Renderizar Configuración (`renderConfiguracionCaminos`)

**Ubicación:** `admin-panel-pedagogico-caminos.js` línea 31

**Funcionalidades:**

1. **Lista Agrupada por Pantalla**
   - Muestra todos los botones/caminos organizados por pantalla
   - Orden, texto del botón, URL destino, estado, descripción

2. **Crear Camino/Botón**
   - Modal con formulario
   - Campos:
     - Pantalla (select: pantalla1, pantalla2, pantalla3)
     - Texto del Botón
     - URL Destino (select con pantallas existentes + opción personalizada)
     - Orden
     - Descripción
     - Activo (checkbox)

3. **Editar Camino/Botón**
   - Modal pre-rellenado
   - Mismo formulario que crear

4. **Eliminar Camino/Botón**
   - Confirmación requerida

**Tabla:** `caminos_pantallas`

**Campos:**
- `id`
- `pantalla` (código de pantalla: pantalla1, pantalla2, etc.)
- `boton_texto` (texto que aparece en el botón)
- `boton_url` (URL de destino)
- `orden` (orden de aparición)
- `activo` (boolean)
- `descripcion`
- `created_at`
- `updated_at`

**Relación con Workflow:**
- Los caminos se usan para generar conexiones automáticamente en el workflow
- Cada botón puede tener una conexión hacia otra pantalla

#### Actualizar Camino (`handleUpdateCamino`)

**Ubicación:** `admin-panel-pedagogico-caminos.js` línea 374

**Lógica de URL Destino:**
- Si se selecciona una pantalla del select → usa `url_ruta` de esa pantalla
- Si se selecciona "URL Personalizada" → usa el valor del input personalizado
- Guarda en `boton_url`

---

### 11. Configuración de Workflow (Lienzo)

#### Renderizar Workflow (`renderConfiguracionWorkflow`)

**Ubicación:** `admin-panel-workflow.js` línea 31

**Funcionalidades Principales:**

1. **Mapa Visual del Workflow (Lienzo Interactivo)**
   - Canvas de 600px de altura con fondo cuadriculado
   - Pantallas representadas como tarjetas arrastrables
   - Líneas SVG conectando pantallas según conexiones
   - Botones: "Resetear Posiciones", "Guardar Posiciones"

2. **Lista de Pantallas**
   - Tabla con: Orden, Nombre, Código, URL, Estado, Conexiones
   - Acciones: Vista, Editar, Conectar, Eliminar
   - Input inline para cambiar orden

3. **Conexiones del Workflow**
   - Tabla con: Desde, Hacia, Botón, Condición, Acciones
   - Botón "Sincronizar desde Botones" (genera conexiones automáticamente)
   - Botón "Nueva Conexión"

4. **Vista Previa de Pantalla**
   - Modal con información de la pantalla
   - Iframe mostrando el HTML del template (escala 50%)
   - Lista de botones configurados

5. **Crear/Editar Pantalla**
   - Modal con formulario
   - Campos: Nombre, Código, URL/Ruta, Template Path, Descripción, Orden, Activa

6. **Crear/Editar Conexión**
   - Modal con formulario
   - Campos:
     - Pantalla Origen (select)
     - Botón de Origen (select dinámico según pantalla)
     - Pantalla Destino (select)
     - Tipo de Condición (nivel, fase, streak, estado, sin condición)
     - Valor de Condición (operadores: >=, <=, ==, !=, >, <)
     - Activa (checkbox)

**Tablas Relacionadas:**

1. **`pantallas`**
   - `id`, `nombre`, `codigo`, `url_ruta`, `template_path`, `descripcion`, `orden`, `activa`, `pos_x`, `pos_y`, `metodo_entrada`, `created_at`, `updated_at`

2. **`conexiones_pantallas`**
   - `id`, `pantalla_origen_id`, `pantalla_destino_id`, `boton_texto`, `condicion_tipo`, `condicion_valor`, `orden`, `activa`, `created_at`, `updated_at`

**Funcionalidades JavaScript:**

1. **Drag and Drop**
   - Pantallas arrastrables con mouse
   - Guarda posición en `pantallasPositions` objeto
   - Previene drag cuando se hace clic en botones
   - Actualiza líneas de conexión en tiempo real

2. **Actualizar Líneas de Conexión**
   - Función `actualizarLineasConexion()`
   - Dibuja líneas SVG desde centro de pantalla origen hacia centro de destino
   - Si hay botón específico, calcula desde posición del botón
   - Usa marcadores de flecha

3. **Guardar Posiciones**
   - Función `guardarPosiciones()`
   - Envía POST con todas las posiciones
   - Actualiza `pos_x` y `pos_y` en base de datos

4. **Sincronizar Conexiones**
   - Genera conexiones automáticamente desde `caminos_pantallas`
   - Busca pantalla destino por `url_ruta` o código
   - Crea conexión si no existe

**Estado Actual del Lienzo:**

✅ **Funcionando:**
- Drag and drop de pantallas
- Guardado de posiciones
- Visualización de líneas de conexión
- Vista previa de pantallas
- Crear/editar/eliminar pantallas
- Crear/editar/eliminar conexiones
- Sincronización desde botones

⚠️ **Pendiente de Mejora:**
- Las líneas no siempre se actualizan correctamente al mover pantallas
- La posición de los botones en las líneas es aproximada
- No hay zoom/pan en el lienzo
- No hay validación visual de conexiones inválidas

#### Actualizar Workflow (`handleUpdateWorkflow`)

**Ubicación:** `admin-panel-workflow.js` línea 923

**Acciones Soportadas:**

1. **`create_pantalla`**
   - Crea nueva pantalla
   - Valida código único

2. **`update_pantalla`**
   - Actualiza nombre, código, URL, template, descripción, estado

3. **`update_orden`**
   - Actualiza orden de una pantalla

4. **`update_posiciones`**
   - Actualiza `pos_x` y `pos_y` de múltiples pantallas
   - Parsea `posiciones[pantallaId][x]` y `posiciones[pantallaId][y]`

5. **`create_conexion`**
   - Crea nueva conexión entre pantallas
   - Valida que no exista duplicado

6. **`update_conexion`**
   - Actualiza conexión existente

7. **`delete_conexion`** (GET con query param)
   - Elimina conexión

8. **`delete_pantalla`** (GET con query param)
   - Elimina pantalla y todas sus conexiones (CASCADE)

---

### 12. Envío de Email

#### Formulario de Email (`renderEmailForm`)

**Ubicación:** `admin-panel-v4.js` línea 1642

**Funcionalidades:**
- Formulario simple con: destinatario, asunto, mensaje
- Soporta HTML básico en el mensaje
- Envía desde: `eugeni@pdeeugenihidalgo.org`

#### Enviar Email (`handleSendEmail`)

**Ubicación:** `admin-panel-v4.js` línea 1708

**Proceso:**
1. Valida campos requeridos
2. Convierte mensaje a HTML (si no lo es, convierte saltos de línea a `<br>`)
3. Usa `enviarEmailGmail()` desde `services/google-workspace.js`
4. Retorna Message ID de Gmail

**Servicio:** Google Workspace API (Gmail)

---

### 13. Configuración del Sistema

#### Renderizar Configuración (`renderConfiguracion`)

**Ubicación:** `admin-panel-v4.js` línea 1368

**Funcionalidades:**
- Muestra todas las variables de entorno (con valores sensibles ocultos)
- Secciones:
  - Sistema (usuario admin, base de datos, puerto, entorno)
  - ClickUp (API token, Space ID, Folder ID)
  - Kajabi (Client ID, Client Secret)
  - Mailgun (API Key, Domain)
  - Typeform (API Token, estado)
  - Cloudflare (API Token)

**Nota:** Las configuraciones son de solo lectura. Para cambiar, editar `.env` y reiniciar el servidor.

---

## Base de Datos

### Tablas Principales

#### 1. `alumnos`
```sql
id SERIAL PRIMARY KEY
email TEXT UNIQUE NOT NULL
apodo TEXT
fecha_inscripcion TIMESTAMP
fecha_ultima_practica TIMESTAMP
nivel_actual INTEGER DEFAULT 1
nivel_manual INTEGER (null = automático)
streak INTEGER DEFAULT 0
estado_suscripcion TEXT DEFAULT 'activa'
fecha_reactivacion TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 2. `practicas`
```sql
id SERIAL PRIMARY KEY
alumno_id INTEGER REFERENCES alumnos(id)
fecha TIMESTAMP
tipo TEXT
origen TEXT
duracion INTEGER
created_at TIMESTAMP
```

#### 3. `pausas`
```sql
id SERIAL PRIMARY KEY
alumno_id INTEGER REFERENCES alumnos(id)
inicio TIMESTAMP
fin TIMESTAMP (null = pausa activa)
created_at TIMESTAMP
```

#### 4. `aspectos_practica`
```sql
id SERIAL PRIMARY KEY
nombre TEXT NOT NULL
descripcion TEXT
webhook_url TEXT
activo BOOLEAN DEFAULT true
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 5. `progreso_pedagogico`
```sql
id SERIAL PRIMARY KEY
alumno_id INTEGER REFERENCES alumnos(id)
aspecto_id INTEGER REFERENCES aspectos_practica(id)
contador_alumno INTEGER DEFAULT 0
recomendacion_master_iniciarse INTEGER
recomendacion_master_conocer INTEGER
recomendacion_master_dominio INTEGER
created_at TIMESTAMP
updated_at TIMESTAMP
UNIQUE(alumno_id, aspecto_id)
```

#### 6. `racha_fases`
```sql
id SERIAL PRIMARY KEY
fase TEXT NOT NULL
dias_min INTEGER NOT NULL
dias_max INTEGER (null = sin límite)
descripcion TEXT
orden INTEGER DEFAULT 0
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 7. `pantallas`
```sql
id SERIAL PRIMARY KEY
nombre TEXT NOT NULL
codigo TEXT UNIQUE NOT NULL
url_ruta TEXT
template_path TEXT
descripcion TEXT
orden INTEGER DEFAULT 0
activa BOOLEAN DEFAULT true
pos_x INTEGER
pos_y INTEGER
metodo_entrada TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 8. `conexiones_pantallas`
```sql
id SERIAL PRIMARY KEY
pantalla_origen_id INTEGER REFERENCES pantallas(id)
pantalla_destino_id INTEGER REFERENCES pantallas(id)
boton_texto TEXT
condicion_tipo TEXT (nivel, fase, streak, estado)
condicion_valor TEXT (operadores: >=, <=, ==, etc.)
orden INTEGER DEFAULT 0
activa BOOLEAN DEFAULT true
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 9. `caminos_pantallas`
```sql
id SERIAL PRIMARY KEY
pantalla TEXT NOT NULL
boton_texto TEXT NOT NULL
boton_url TEXT NOT NULL
orden INTEGER DEFAULT 0
activo BOOLEAN DEFAULT true
descripcion TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 10. `respuestas`
```sql
id SERIAL PRIMARY KEY
email TEXT NOT NULL
apodo TEXT
nivel_practica INTEGER
form_id TEXT
form_title TEXT
respuesta TEXT
submitted_at TIMESTAMP
created_at TIMESTAMP
```

#### 11. `frases_nivel`
```sql
id SERIAL PRIMARY KEY
nivel INTEGER NOT NULL
frase TEXT NOT NULL
origen TEXT DEFAULT 'clickup'
clickup_task_id TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

### Índices

- `idx_alumnos_email` en `alumnos(email)`
- `idx_practicas_alumno_id` en `practicas(alumno_id)`
- `idx_practicas_fecha` en `practicas(fecha)`
- `idx_progreso_alumno_id` en `progreso_pedagogico(alumno_id)`
- `idx_progreso_aspecto_id` en `progreso_pedagogico(aspecto_id)`

---

## Estado Actual y Pendientes

### ✅ Funcionalidades Completas

1. **Autenticación y Sesiones**
   - Login/logout funcionando
   - Sesiones con cookies HTTP-only
   - Protección de rutas

2. **Gestión de Alumnos**
   - CRUD completo
   - Filtros y búsqueda
   - Recálculo de niveles
   - Integración con Kajabi

3. **Recorrido Pedagógico**
   - Visualización de matriz
   - Edición inline de recomendaciones
   - Validación robusta

4. **Configuración de Aspectos**
   - CRUD completo
   - Generación automática de webhooks Typeform

5. **Configuración de Caminos/Botones**
   - CRUD completo
   - Selector de pantallas destino

6. **Workflow/Lienzo**
   - Drag and drop funcionando
   - Guardado de posiciones
   - Visualización de conexiones
   - Vista previa de pantallas

### ⚠️ Pendientes de Mejora

1. **Lienzo/Workflow**
   - [ ] Mejorar precisión de líneas de conexión
   - [ ] Agregar zoom/pan al lienzo
   - [ ] Validación visual de conexiones
   - [ ] Mejorar cálculo de posición de botones en líneas
   - [ ] Agregar snap-to-grid opcional
   - [ ] Mejorar rendimiento con muchas pantallas

2. **Autenticación**
   - [ ] Migrar sesiones a Redis
   - [ ] Agregar límite de intentos de login
   - [ ] Agregar 2FA opcional

3. **UI/UX**
   - [ ] Reemplazar Tailwind CDN por build compilado
   - [ ] Agregar favicon real
   - [ ] Mejorar responsive en móviles
   - [ ] Agregar loading states

4. **Funcionalidades**
   - [ ] Exportar datos a CSV/Excel
   - [ ] Agregar logs detallados en `/admin/logs`
   - [ ] Agregar dashboard con gráficos
   - [ ] Agregar notificaciones en tiempo real

5. **Rendimiento**
   - [ ] Agregar caché para consultas frecuentes
   - [ ] Optimizar consultas SQL con JOINs
   - [ ] Agregar paginación en más listas

---

## Notas Técnicas

### Compatibilidad Node.js vs Cloudflare Workers

El código está diseñado para funcionar tanto en Node.js como en Cloudflare Workers. Sin embargo, hay diferencias:

- **FormData**: En Node.js se usa `URLSearchParams` en lugar de `FormData` real
- **Request.clone()**: No disponible en Node.js, se eliminó
- **Headers**: Se crean manualmente desde `req.headers`

### Manejo de Errores

- Todos los handlers tienen `try/catch`
- Errores se loguean en consola
- Respuestas de error incluyen mensaje descriptivo
- Redirecciones con query params para mostrar errores en UI

### Validación

- Frontend: Validación en tiempo real con JavaScript
- Backend: Validación estricta de tipos y valores
- Base de datos: Constraints y foreign keys

---

## Conclusión

El Panel Admin de AuriPortal es un sistema completo y funcional para gestionar todos los aspectos del portal educativo. Aunque hay áreas de mejora (especialmente en el lienzo de workflow), la funcionalidad core está implementada y funcionando correctamente.

**Última actualización:** Diciembre 2024





