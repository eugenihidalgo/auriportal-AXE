# 📖 Documentación Completa: Reloj de Meditación y Sistema de Músicas/Tonos

## 📋 Índice

1. [Resumen General](#resumen-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Base de Datos](#base-de-datos)
4. [Servicios (Lógica de Negocio)](#servicios-lógica-de-negocio)
5. [Endpoints y APIs](#endpoints-y-apis)
6. [Panel de Administración](#panel-de-administración)
7. [Cliente (Frontend)](#cliente-frontend)
8. [Flujo Completo de Funcionamiento](#flujo-completo-de-funcionamiento)
9. [Configuraciones y Personalización](#configuraciones-y-personalización)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Resumen General

El sistema de Reloj de Meditación permite a los alumnos:
- Configurar un tiempo de meditación de 1 a 120 minutos
- Seleccionar música de meditación de un banco de músicas disponibles
- Reproducir música durante la meditación (con loop automático si es necesario)
- Escuchar un tono personalizado al finalizar la meditación
- Pausar, reanudar y reiniciar la meditación
- Mantener la configuración guardada entre sesiones

El sistema incluye:
- **Banco de Músicas**: Administración de músicas de meditación
- **Banco de Tonos**: Administración de tonos de finalización
- **Reloj de Meditación**: Componente cliente con todas las funcionalidades
- **Integración**: Aparece en las páginas de "Preparación para la práctica" y "Técnicas Post-práctica"

---

## 🏗️ Arquitectura del Sistema

### Estructura de Archivos

```
/var/www/aurelinportal/
├── database/
│   └── pg.js                          # Definición de tablas (musicas_meditacion, tonos_meditacion)
├── src/
│   ├── services/
│   │   ├── musicas-meditacion.js      # Lógica CRUD para músicas
│   │   └── tonos-meditacion.js        # Lógica CRUD para tonos
│   ├── endpoints/
│   │   ├── musicas-meditacion-api.js  # API REST para músicas
│   │   ├── tonos-meditacion-api.js    # API REST para tonos
│   │   ├── musicas-tonos-upload.js    # Endpoint de subida de archivos
│   │   ├── admin-recursos-tecnicos.js # Panel admin de recursos técnicos
│   │   ├── preparacion-practica-handler.js  # Handler que muestra preparaciones + reloj
│   │   └── tecnica-post-practica-handler.js # Handler que muestra técnicas + reloj
│   └── core/
│       └── html/
│           ├── admin/
│           │   ├── recursos-tecnicos.html
│           │   ├── recursos-tecnicos-musicas.html
│           │   └── recursos-tecnicos-tonos.html
│           ├── preparacion-practica.html
│           └── tecnica-post-practica.html
├── public/
│   ├── js/
│   │   ├── reloj-meditacion.js        # Clase RelojMeditacion (cliente)
│   │   └── recursos-tecnicos.js        # JS del admin de recursos
│   └── css/
│       └── reloj-meditacion.css       # Estilos del reloj
└── scripts/
    └── ejecutar-migracion-es-por-defecto.js  # Script de migración
```

### Flujo de Datos

```
Cliente (Navegador)
    ↓
Handler (preparacion-practica-handler.js / tecnica-post-practica-handler.js)
    ↓
Servicios (musicas-meditacion.js, tonos-meditacion.js)
    ↓
Base de Datos PostgreSQL
    ↓
Respuesta HTML con reloj configurado
    ↓
Cliente inicializa RelojMeditacion
    ↓
Reproducción de audio (Web Audio API / HTML5 Audio)
```

---

## 💾 Base de Datos

### Tabla: `musicas_meditacion`

**Ubicación**: `database/pg.js` (líneas ~1430-1464)

**Estructura**:
```sql
CREATE TABLE IF NOT EXISTS musicas_meditacion (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,              -- Nombre de la música
  descripcion TEXT,                          -- Descripción opcional
  archivo_path TEXT,                         -- Ruta del archivo subido (ej: /uploads/musicas/musica-123.mp3)
  url_externa TEXT,                          -- URL externa (ej: https://ejemplo.com/musica.mp3)
  duracion_segundos INTEGER,                  -- Duración en segundos (calculada automáticamente)
  peso_mb DECIMAL(10,2),                     -- Tamaño del archivo en MB
  categoria VARCHAR(100),                     -- Categoría opcional
  es_por_defecto BOOLEAN DEFAULT FALSE,      -- Si es la música por defecto
  activo BOOLEAN DEFAULT TRUE,                -- Soft delete
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Índices**:
- `idx_musicas_meditacion_activo` - Para filtrar músicas activas
- `idx_musicas_meditacion_categoria` - Para filtrar por categoría
- `idx_musicas_meditacion_por_defecto` - Para encontrar música por defecto rápidamente

**Migración**: Se agregó la columna `es_por_defecto` mediante script de migración (`scripts/ejecutar-migracion-es-por-defecto.js`)

### Tabla: `tonos_meditacion`

**Ubicación**: `database/pg.js` (líneas ~1466-1487)

**Estructura**:
```sql
CREATE TABLE IF NOT EXISTS tonos_meditacion (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  archivo_path TEXT,
  url_externa TEXT,
  duracion_segundos INTEGER,
  peso_mb DECIMAL(10,2),
  categoria VARCHAR(100),
  es_por_defecto BOOLEAN DEFAULT FALSE,      -- Si es el tono por defecto
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Índices**: Similar a `musicas_meditacion`

### Tabla: `alumnos` (Modificación)

**Campo agregado**:
```sql
tono_meditacion_id INTEGER REFERENCES tonos_meditacion(id)
```

Permite que cada alumno tenga su tono personalizado de finalización.

### Tablas Relacionadas

**`preparaciones_practica`**:
- `activar_reloj BOOLEAN` - Campo para activar/desactivar reloj (actualmente no se usa, reloj siempre visible)
- `musica_id INTEGER` - ID de música configurada (actualmente no se usa, se usa música por defecto)

**`tecnicas_post_practica`**:
- `activar_reloj BOOLEAN` - Campo para activar/desactivar reloj (actualmente no se usa, reloj siempre visible)
- `musica_id INTEGER` - ID de música configurada (actualmente no se usa, se usa música por defecto)

---

## 🔧 Servicios (Lógica de Negocio)

### `src/services/musicas-meditacion.js`

**Funciones principales**:

#### `listarMusicas()`
- **Propósito**: Obtener todas las músicas activas
- **Query**: `SELECT * FROM musicas_meditacion WHERE activo = true ORDER BY categoria ASC, nombre ASC`
- **Retorna**: Array de objetos música

#### `obtenerMusica(musicaId)`
- **Propósito**: Obtener una música específica por ID
- **Query**: `SELECT * FROM musicas_meditacion WHERE id = $1`
- **Retorna**: Objeto música o `null`

#### `obtenerMusicaPorDefecto()`
- **Propósito**: Obtener la música marcada como por defecto
- **Query**: `SELECT * FROM musicas_meditacion WHERE es_por_defecto = true AND activo = true LIMIT 1`
- **Retorna**: Objeto música o `null`
- **Lógica**: Solo puede haber una música por defecto a la vez

#### `crearMusica(datos)`
- **Propósito**: Crear una nueva música
- **Parámetros**:
  - `nombre` (requerido)
  - `descripcion`, `archivo_path`, `url_externa`, `duracion_segundos`, `peso_mb`, `categoria`, `es_por_defecto`, `activo`
- **Lógica especial**: Si `es_por_defecto = true`, desmarca todas las demás músicas como por defecto
- **Query**: 
  ```sql
  -- Primero desmarcar otras si es por defecto
  UPDATE musicas_meditacion SET es_por_defecto = false WHERE es_por_defecto = true;
  
  -- Luego insertar
  INSERT INTO musicas_meditacion (...) VALUES (...);
  ```

#### `actualizarMusica(musicaId, datos)`
- **Propósito**: Actualizar una música existente
- **Lógica especial**: Si se marca como por defecto, desmarca todas las demás (excepto la actual)
- **Query dinámico**: Solo actualiza los campos proporcionados

#### `eliminarMusica(musicaId)`
- **Propósito**: Soft delete (marca como `activo = false`)
- **Query**: `UPDATE musicas_meditacion SET activo = false WHERE id = $1`

### `src/services/tonos-meditacion.js`

**Funciones similares a `musicas-meditacion.js`**:
- `listarTonos()`
- `obtenerTono(tonoId)`
- `obtenerTonoPorDefecto()`
- `crearTono(datos)`
- `actualizarTono(tonoId, datos)`
- `eliminarTono(tonoId)`

**Diferencia**: Los tonos se usan solo al finalizar la meditación (una vez), mientras que las músicas se reproducen en loop durante toda la meditación.

---

## 🌐 Endpoints y APIs

### API de Músicas: `/api/musicas-meditacion`

**Ubicación**: `src/endpoints/musicas-meditacion-api.js`

#### `GET /api/musicas-meditacion`
- **Handler**: `listarMusicas(request, env, ctx)`
- **Respuesta**: Array JSON de todas las músicas activas
- **Uso**: Listar músicas en el admin y en el reloj

#### `GET /api/musicas-meditacion/:id`
- **Handler**: `obtenerMusica(request, env, ctx)`
- **Respuesta**: Objeto JSON de la música
- **Uso**: Obtener detalles de una música específica

#### `POST /api/musicas-meditacion`
- **Handler**: `crearMusica(request, env, ctx)`
- **Body**: JSON con campos de la música
- **Respuesta**: `{ success: true, id: musicaId }`
- **Uso**: Crear nueva música desde el admin

#### `PUT /api/musicas-meditacion/:id`
- **Handler**: `actualizarMusica(request, env, ctx)`
- **Body**: JSON con campos a actualizar
- **Respuesta**: `{ success: true }`
- **Uso**: Actualizar música desde el admin

#### `DELETE /api/musicas-meditacion/:id`
- **Handler**: `eliminarMusica(request, env, ctx)`
- **Respuesta**: `{ success: true }`
- **Uso**: Eliminar música (soft delete)

### API de Tonos: `/api/tonos-meditacion`

**Ubicación**: `src/endpoints/tonos-meditacion-api.js`

**Endpoints similares a músicas**:
- `GET /api/tonos-meditacion`
- `GET /api/tonos-meditacion/:id`
- `POST /api/tonos-meditacion`
- `PUT /api/tonos-meditacion/:id`
- `DELETE /api/tonos-meditacion/:id`

### Upload de Archivos: `/api/musicas-meditacion/upload` y `/api/tonos-meditacion/upload`

**Ubicación**: `src/endpoints/musicas-tonos-upload.js`

#### `POST /api/musicas-meditacion/upload`
- **Handler**: `uploadMusica(request, env, ctx)`
- **Content-Type**: `multipart/form-data`
- **Campo**: `archivo` (archivo de audio)
- **Proceso**:
  1. Valida tamaño máximo (100 MB)
  2. Parsea `multipart/form-data` usando `busboy`
  3. Valida extensión (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`)
  4. Genera nombre único: `musica-{timestamp}{extension}`
  5. Guarda archivo en `/public/uploads/musicas/`
  6. Calcula duración automáticamente usando `music-metadata`
  7. Calcula peso en MB
  8. Retorna: `{ success: true, archivo_path, peso_mb, duracion_segundos }`

#### `POST /api/tonos-meditacion/upload`
- **Handler**: `uploadTono(request, env, ctx)`
- **Proceso similar a `uploadMusica`**
- **Directorio**: `/public/uploads/tonos/`
- **Nombre**: `tono-{timestamp}{extension}`

**Librerías usadas**:
- `busboy`: Parsear `multipart/form-data`
- `music-metadata`: Extraer metadatos de audio (duración)

**Configuración Nginx**:
- `client_max_body_size 100M;` - Permite subir archivos de hasta 100 MB

### Panel Admin: `/admin/recursos-tecnicos/musicas` y `/admin/recursos-tecnicos/tonos`

**Ubicación**: `src/endpoints/admin-recursos-tecnicos.js`

**Estructura**:
- **Autenticación**: Requiere login admin
- **Tabs**: Dos pestañas (Músicas / Tonos)
- **Funcionalidades**:
  - Crear nueva música/tono (fila especial en la tabla)
  - Editar inline (cambios se guardan al hacer blur)
  - Subir archivo o usar URL externa
  - Marcar como "por defecto" (checkbox)
  - Eliminar (soft delete)

**Templates HTML**:
- `src/core/html/admin/recursos-tecnicos.html` - Estructura principal con tabs
- `src/core/html/admin/recursos-tecnicos-musicas.html` - Tabla de músicas
- `src/core/html/admin/recursos-tecnicos-tonos.html` - Tabla de tonos

**JavaScript Cliente**: `public/js/recursos-tecnicos.js`
- Maneja eventos de creación, edición, eliminación
- Subida de archivos
- Actualización de campos inline

### Handlers de Páginas Cliente

#### `preparacion-practica-handler.js`

**Ruta**: `/preparacion-practica`

**Proceso**:
1. Obtiene alumno de la sesión
2. Obtiene preparaciones según nivel del alumno
3. Obtiene todas las músicas disponibles
4. Obtiene música por defecto
5. Obtiene tono del perfil del alumno (o tono por defecto)
6. Genera HTML de preparaciones (sin reloj individual)
7. Genera HTML de reloj único al final con configuración:
   ```javascript
   {
     musicaUrl: url de música por defecto,
     musicaDuracion: duracion en segundos,
     musicaIdPorDefecto: id de música por defecto,
     musicasDisponibles: array de todas las músicas,
     tonoUrl: url del tono personalizado o por defecto
   }
   ```
8. Renderiza template `preparacion-practica.html` con placeholders

#### `tecnica-post-practica-handler.js`

**Ruta**: `/tecnica-post-practica`

**Proceso similar a `preparacion-practica-handler.js`**, pero para técnicas post-práctica.

---

## 🎛️ Panel de Administración

### Estructura del Menú

**Ubicación en menú**: `src/core/html/admin/base.html`

**Sección**: "🎵 Recursos técnicos" (sección principal, no subsección)

**Subsecciones**:
- **Músicas de meditación**: `/admin/recursos-tecnicos/musicas`
- **Tonos de meditación**: `/admin/recursos-tecnicos/tonos`

**Orden en menú**:
1. Favoritos
2. Gestión del alumno
3. Comunicación con los alumnos
4. Transmutación energética PDE
5. I+D de los alumnos
6. Contenido PDE
7. Clasificaciones
8. **Recursos técnicos** ← Aquí
9. Analytics
10. ... (resto de secciones)

### Funcionalidades del Admin

#### Crear Música/Tono Rápido

**Ubicación**: Primera fila de la tabla (fila especial con fondo diferente)

**Campos**:
- Nombre (requerido)
- Descripción
- Categoría
- Archivo (subir) o URL externa
- Duración (se calcula automáticamente si se sube archivo)
- **Por defecto** (checkbox)

**Proceso**:
1. Usuario llena campos
2. Si hay archivo, se sube primero (`/api/musicas-meditacion/upload`)
3. Se crea registro con `POST /api/musicas-meditacion`
4. Se recarga la página para mostrar nueva fila

#### Edición Inline

**Campos editables**:
- Nombre
- Descripción
- Categoría
- URL externa
- Duración
- **Por defecto** (checkbox)

**Proceso**:
1. Usuario cambia valor en input/checkbox
2. Al hacer `blur` (o `change` en checkbox), se llama a `guardarCampoMusica(musicaId, campo, valor)`
3. Se obtiene música actual (`GET /api/musicas-meditacion/:id`)
4. Se actualiza con `PUT /api/musicas-meditacion/:id`
5. Si es `es_por_defecto`, se recarga la página para actualizar todos los checkboxes

#### Cambiar Archivo

**Proceso**:
1. Usuario hace clic en "Cambiar"
2. Se abre selector de archivos
3. Al seleccionar, se sube (`/api/musicas-meditacion/upload`)
4. Se actualiza `archivo_path` y `peso_mb` del registro
5. Se recarga la página

#### Eliminar

**Proceso**:
1. Usuario hace clic en "Eliminar"
2. Confirmación: `confirm('¿Estás seguro de eliminar esta música?')`
3. Se llama a `DELETE /api/musicas-meditacion/:id`
4. Se recarga la página

### Características Especiales

#### Música/Tono por Defecto

- Solo puede haber **una** música por defecto a la vez
- Solo puede haber **un** tono por defecto a la vez
- Al marcar una como por defecto, automáticamente se desmarcan las demás
- Las filas con "por defecto" tienen fondo destacado (`bg-indigo-900/20`)

#### Cálculo Automático de Duración

- Al subir archivo, se usa `music-metadata` para extraer duración
- Se guarda en `duracion_segundos`
- Si el usuario no proporciona duración manual, se usa la calculada

#### Validación de Archivos

- **Extensiones permitidas**: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`
- **Tamaño máximo**: 100 MB (configurado en Nginx y busboy)
- **Validación**: Tanto en cliente como en servidor

---

## 💻 Cliente (Frontend)

### Clase `RelojMeditacion`

**Ubicación**: `public/js/reloj-meditacion.js`

**Inicialización**:
```javascript
const reloj = new RelojMeditacion('reloj-meditacion-unico', {
  musicaUrl: url de música por defecto,
  musicaDuracion: duracion en segundos,
  musicaIdPorDefecto: id de música por defecto,
  musicasDisponibles: [
    { id: 1, nombre: 'Música 1', url: '/uploads/...', duracion: 300, esPorDefecto: true },
    ...
  ],
  tonoUrl: url del tono
});
```

**Propiedades principales**:
- `tiempoTotal`: Tiempo configurado en segundos
- `tiempoTranscurrido`: Tiempo que ha pasado
- `estaIniciado`: Si la meditación está en curso
- `estaPausado`: Si está pausada
- `reproducirMusica`: Si debe reproducir música
- `musicaSeleccionadaId`: ID de música seleccionada
- `musicaSeleccionadaUrl`: URL de música seleccionada
- `audioContext`: Web Audio API context
- `audioHTML5`: Fallback HTML5 Audio

**Métodos principales**:

#### `init()`
- Carga configuración guardada de `localStorage`
- Renderiza el reloj
- Configura event listeners
- Inicializa Web Audio API

#### `render()`
- Genera HTML del reloj según estado
- **Antes de iniciar**: Muestra configuración (tiempo, selector de música, botón iniciar)
- **Durante meditación**: Muestra tiempo transcurrido, tiempo restante, botones pausar/reanudar/reiniciar

#### `iniciar()`
- Valida que tiempo >= 1 minuto
- Marca `estaIniciado = true`
- Inicia contador
- Si hay música seleccionada, la reproduce

#### `pausar()`
- Detiene contador
- Detiene música
- Marca `estaPausado = true`

#### `reanudar()`
- Reanuda contador
- Reanuda música
- Marca `estaPausado = false`

#### `reiniciar()`
- Resetea `tiempoTranscurrido = 0`
- Reinicia contador
- Reinicia música

#### `seleccionarMusica(musicaId)`
- Si `musicaId` es vacío, deselecciona música
- Si hay `musicaId`, busca música en `musicasDisponibles`
- Actualiza `musicaSeleccionadaId`, `musicaSeleccionadaUrl`, `musicaSeleccionadaDuracion`
- Guarda en `localStorage`

#### `reproducirMusicaMeditacion()`
- Usa Web Audio API (preferido)
- Carga archivo de audio
- Crea loop automático si la música es más corta que el tiempo de meditación
- Si falla, usa HTML5 Audio como fallback

#### `reproducirMusicaHTML5()`
- Fallback usando `<audio>` HTML5
- Configura `loop = true`
- Reproduce en background

#### `reproducirTono()`
- Reproduce tono al finalizar meditación
- Usa Web Audio API
- Se reproduce **una sola vez** (no loop)

#### `guardarConfiguracion()` / `cargarConfiguracion()`
- Usa `localStorage` con clave `'reloj-meditacion-config'`
- Guarda: `tiempoTotal`, `reproducirMusica`, `musicaSeleccionadaId`, `tiempoTranscurrido`
- Permite persistencia entre sesiones

### Estilos CSS

**Ubicación**: `public/css/reloj-meditacion.css`

**Características**:
- Fondo degradado dorado (`#fff9e6` a `#ffe9a8`)
- Bordes dorados (`#ffd86b`)
- Diseño responsive
- Animaciones suaves
- Selector de música estilizado

**Clases principales**:
- `.reloj-meditacion-container` - Contenedor principal
- `.reloj-configuracion` - Panel de configuración
- `.reloj-en-ejecucion` - Panel durante meditación
- `.reloj-select-musica` - Selector desplegable
- `.reloj-btn-iniciar`, `.reloj-btn-pausar`, etc. - Botones

### Integración en Páginas

#### `preparacion-practica.html`

**Estructura**:
```html
<div class="container">
  <!-- Header con Aurelín -->
  <!-- Preparaciones -->
  <!-- Botón Continuar -->
  <!-- Reloj único al final -->
  <div id="reloj-meditacion-unico" data-reloj-config='{...}'></div>
</div>
```

**Scripts**:
- `/js/reloj-meditacion.js` - Clase RelojMeditacion
- `/css/reloj-meditacion.css` - Estilos
- Script inline que inicializa el reloj al cargar DOM

**Inicialización**:
```javascript
document.addEventListener('DOMContentLoaded', function() {
  const relojEl = document.getElementById('reloj-meditacion-unico');
  if (relojEl) {
    const configStr = relojEl.getAttribute('data-reloj-config');
    const config = JSON.parse(configStr.replace(/&quot;/g, '"'));
    window.relojMeditacionActual = new RelojMeditacion('reloj-meditacion-unico', config);
  }
});
```

#### `tecnica-post-practica.html`

**Estructura similar a `preparacion-practica.html`**

---

## 🔄 Flujo Completo de Funcionamiento

### Flujo: Usuario Accede a Preparación para la Práctica

1. **Usuario hace clic en "Limpiar energéticamente"**
   - Redirige a `/preparacion-practica`

2. **Servidor procesa request** (`preparacion-practica-handler.js`)
   - Obtiene sesión del usuario
   - Obtiene nivel del alumno
   - Consulta preparaciones: `SELECT * FROM preparaciones_practica WHERE nivel <= $nivelAlumno ORDER BY nivel ASC, prioridad ASC`
   - Obtiene todas las músicas: `SELECT * FROM musicas_meditacion WHERE activo = true`
   - Busca música por defecto: `SELECT * FROM musicas_meditacion WHERE es_por_defecto = true AND activo = true`
   - Obtiene tono del perfil del alumno o tono por defecto
   - Genera HTML de preparaciones (sin reloj individual)
   - Genera configuración del reloj único:
     ```javascript
     {
       musicaUrl: '/uploads/musicas/musica-123.mp3',
       musicaDuracion: 300,
       musicaIdPorDefecto: 1,
       musicasDisponibles: [
         { id: 1, nombre: 'Meditación 1', url: '/uploads/...', duracion: 300, esPorDefecto: true },
         { id: 2, nombre: 'Meditación 2', url: '/uploads/...', duracion: 600, esPorDefecto: false }
       ],
       tonoUrl: '/uploads/tonos/tono-456.mp3'
     }
     ```
   - Renderiza template con placeholders

3. **Cliente recibe HTML**
   - Navegador parsea HTML
   - Carga CSS (`reloj-meditacion.css`)
   - Carga JS (`reloj-meditacion.js`)

4. **Inicialización del reloj** (script inline)
   - `DOMContentLoaded` se dispara
   - Busca elemento `#reloj-meditacion-unico`
   - Lee `data-reloj-config`
   - Parsea JSON (reemplazando `&quot;` por `"`)
   - Crea instancia: `new RelojMeditacion('reloj-meditacion-unico', config)`

5. **Constructor de RelojMeditacion**
   - Guarda configuración
   - Inicializa propiedades
   - Llama a `init()`

6. **init()**
   - Carga configuración de `localStorage` (si existe)
   - Llama a `render()`
   - Configura event listeners
   - Inicializa Web Audio API

7. **render()**
   - Genera HTML según estado
   - **Si no está iniciado**: Muestra configuración
     - Input de tiempo (1-120 minutos)
     - Selector de música (con todas las opciones)
     - Botón "Iniciar Meditación"
   - **Si está iniciado**: Muestra meditación en curso
     - Tiempo transcurrido
     - Tiempo restante
     - Botones pausar/reanudar/reiniciar

8. **Usuario configura meditación**
   - Ajusta tiempo (botones +/- o input directo)
   - Selecciona música del dropdown
   - Hace clic en "Iniciar Meditación"

9. **iniciar()**
   - Valida tiempo >= 1 minuto
   - Marca `estaIniciado = true`
   - Resetea `tiempoTranscurrido = 0`
   - Llama a `iniciarContador()`
   - Si hay música seleccionada, llama a `reproducirMusicaMeditacion()`
   - Guarda configuración en `localStorage`
   - Llama a `render()` para mostrar vista de meditación

10. **iniciarContador()**
    - Crea `setInterval` que se ejecuta cada 1 segundo
    - Incrementa `tiempoTranscurrido`
    - Actualiza display (tiempo transcurrido, tiempo restante)
    - Si `tiempoTranscurrido >= tiempoTotal`, llama a `finalizar()`

11. **reproducirMusicaMeditacion()**
    - Intenta usar Web Audio API
    - Hace `fetch` del archivo de música
    - Decodifica audio
    - Crea loop automático si música < tiempo de meditación
    - Si falla, usa HTML5 Audio

12. **Durante meditación**
    - Contador sigue corriendo
    - Música se reproduce en loop
    - Usuario puede pausar/reanudar/reiniciar

13. **finalizar()**
    - Detiene contador
    - Detiene música
    - Reproduce tono (`reproducirTono()`)
    - Muestra mensaje de finalización
    - Resetea estado

### Flujo: Admin Crea Música

1. **Admin accede a `/admin/recursos-tecnicos/musicas`**
   - Se autentica
   - Se carga template con tabla de músicas

2. **Admin llena formulario de creación rápida**
   - Nombre: "Meditación 1"
   - Descripción: "Música relajante"
   - Archivo: Selecciona `meditacion.mp3`

3. **Usuario hace clic en "Crear"**
   - JavaScript (`recursos-tecnicos.js`) captura evento
   - Valida que nombre no esté vacío
   - Si hay archivo, llama a `subirArchivo('musica')`

4. **subirArchivo()**
   - Crea `FormData` con archivo
   - Hace `POST /api/musicas-meditacion/upload`
   - Servidor (`musicas-tonos-upload.js`):
     - Parsea `multipart/form-data` con `busboy`
     - Valida extensión
     - Genera nombre único
     - Guarda archivo en `/public/uploads/musicas/`
     - Calcula duración con `music-metadata`
     - Calcula peso
     - Retorna: `{ archivo_path, peso_mb, duracion_segundos }`

5. **Crear registro**
   - JavaScript hace `POST /api/musicas-meditacion` con datos
   - Servidor (`musicas-meditacion-api.js`) llama a `crearMusica()`
   - Si `es_por_defecto = true`, desmarca otras músicas
   - Inserta en BD
   - Retorna `{ success: true, id: nuevaId }`

6. **Recargar página**
   - JavaScript recarga la página
   - Nueva música aparece en la tabla

### Flujo: Admin Marca Música como Por Defecto

1. **Admin hace clic en checkbox "Por defecto"**
   - JavaScript captura evento `change`
   - Llama a `guardarCampoMusica(musicaId, 'es_por_defecto', true)`

2. **guardarCampoMusica()**
   - Obtiene música actual (`GET /api/musicas-meditacion/:id`)
   - Actualiza objeto con nuevo valor
   - Hace `PUT /api/musicas-meditacion/:id`

3. **Servidor actualiza**
   - `actualizarMusica()` detecta `es_por_defecto = true`
   - Ejecuta: `UPDATE musicas_meditacion SET es_por_defecto = false WHERE es_por_defecto = true AND id != $1`
   - Luego actualiza la música actual

4. **Recargar página**
   - JavaScript detecta cambio en `es_por_defecto`
   - Recarga página para actualizar todos los checkboxes

---

## ⚙️ Configuraciones y Personalización

### Configuración de Música por Defecto

**En Admin**:
1. Ir a `/admin/recursos-tecnicos/musicas`
2. Marcar checkbox "Por defecto" en la música deseada
3. Automáticamente se desmarcan las demás

**Uso en Cliente**:
- Si hay música por defecto, se selecciona automáticamente en el reloj
- Usuario puede cambiar la selección

### Configuración de Tono Personalizado

**En Perfil de Alumno**:
1. Alumno accede a `/perfil-personal`
2. Tab "Configuración"
3. Selecciona tono del dropdown
4. Se guarda en `alumnos.tono_meditacion_id`

**Prioridad**:
1. Tono del perfil del alumno (si existe)
2. Tono por defecto (si existe)
3. `null` (no reproduce tono)

### Límites y Restricciones

- **Tiempo mínimo**: 1 minuto
- **Tiempo máximo**: 120 minutos
- **Tamaño máximo de archivo**: 100 MB
- **Formatos permitidos**: MP3, WAV, OGG, M4A, AAC
- **Música por defecto**: Solo una a la vez
- **Tono por defecto**: Solo uno a la vez

### Persistencia

**localStorage**:
- Clave: `'reloj-meditacion-config'`
- Datos guardados:
  - `tiempoTotal`: Tiempo configurado
  - `reproducirMusica`: Si debe reproducir música
  - `musicaSeleccionadaId`: ID de música seleccionada
  - `tiempoTranscurrido`: Tiempo transcurrido (solo si está iniciado)

**Comportamiento**:
- Si usuario cierra navegador durante meditación, al volver se restaura el tiempo transcurrido
- La selección de música se mantiene entre sesiones
- El tiempo configurado se mantiene

---

## 🐛 Troubleshooting

### Problema: Selector de música no aparece

**Posibles causas**:
1. Array `musicasDisponibles` está vacío
2. Error al parsear JSON
3. Problema con template literal

**Solución**:
- Verificar consola del navegador (F12)
- Verificar que hay músicas creadas en admin
- Verificar que las músicas están activas (`activo = true`)

### Problema: Música no se reproduce

**Posibles causas**:
1. URL incorrecta
2. Archivo no existe
3. Web Audio API no disponible
4. Problema de CORS

**Solución**:
- Verificar que el archivo existe en `/public/uploads/musicas/`
- Verificar permisos del archivo
- Verificar consola para errores de CORS
- El sistema usa HTML5 Audio como fallback automático

### Problema: Error 413 al subir archivo

**Causa**: Archivo demasiado grande

**Solución**:
- Verificar `client_max_body_size 100M;` en Nginx
- Verificar límites en `busboy` (100 MB)
- Reducir tamaño del archivo

### Problema: Checkbox "Por defecto" no se guarda

**Causa**: Problema con valor booleano

**Solución**:
- Verificar que `es_por_defecto` se envía como booleano, no string
- Verificar logs del servidor
- El código normaliza el valor antes de enviarlo

### Problema: Reloj no aparece

**Posibles causas**:
1. Elemento `#reloj-meditacion-unico` no existe
2. Error al parsear `data-reloj-config`
3. Error en JavaScript

**Solución**:
- Verificar HTML generado (inspeccionar elemento)
- Verificar consola para errores JavaScript
- Verificar que `reloj-meditacion.js` se carga correctamente

---

## 📝 Notas Técnicas

### Web Audio API vs HTML5 Audio

**Web Audio API** (preferido):
- Mejor control
- Permite loop preciso
- Funciona en background (con limitaciones del navegador)

**HTML5 Audio** (fallback):
- Más compatible
- Más simple
- Menos control sobre loop

**Estrategia**: Intentar Web Audio API primero, si falla usar HTML5 Audio.

### Loop Automático de Música

**Lógica**:
- Si `duracionMusica < tiempoRestante`, se reproduce de nuevo
- Se crea un loop que verifica cada segundo
- Cuando `tiempoRestante <= 0`, se detiene

### Persistencia en Background

**Limitaciones del navegador**:
- En móvil, algunos navegadores pausan JavaScript cuando la app está en background
- Web Audio API puede pausarse
- HTML5 Audio puede continuar (depende del navegador)

**Solución actual**: El contador continúa, pero la música puede pausarse. El usuario puede reanudar manualmente.

### Seguridad

**Validación de archivos**:
- Extensiones permitidas validadas en servidor
- Tamaño máximo validado
- Nombres de archivo sanitizados
- Rutas relativas (no permiten path traversal)

**Autenticación**:
- Admin requiere login
- Cliente no requiere autenticación (público para alumnos)

---

## 🔗 Referencias de Código

### Archivos Principales

1. **Base de Datos**: `database/pg.js` (líneas ~1430-1487)
2. **Servicios**: 
   - `src/services/musicas-meditacion.js`
   - `src/services/tonos-meditacion.js`
3. **APIs**:
   - `src/endpoints/musicas-meditacion-api.js`
   - `src/endpoints/tonos-meditacion-api.js`
   - `src/endpoints/musicas-tonos-upload.js`
4. **Admin**:
   - `src/endpoints/admin-recursos-tecnicos.js`
   - `public/js/recursos-tecnicos.js`
5. **Cliente**:
   - `src/endpoints/preparacion-practica-handler.js`
   - `src/endpoints/tecnica-post-practica-handler.js`
   - `public/js/reloj-meditacion.js`
   - `public/css/reloj-meditacion.css`
6. **Templates**:
   - `src/core/html/preparacion-practica.html`
   - `src/core/html/tecnica-post-practica.html`
   - `src/core/html/admin/recursos-tecnicos-*.html`

---

## ✅ Checklist de Funcionalidades

### Admin
- [x] Crear música/tono
- [x] Editar música/tono inline
- [x] Subir archivo de audio
- [x] Usar URL externa
- [x] Marcar como por defecto
- [x] Eliminar (soft delete)
- [x] Cálculo automático de duración
- [x] Validación de formatos
- [x] Límite de tamaño (100 MB)

### Cliente
- [x] Reloj único al final de la página
- [x] Configurar tiempo (1-120 minutos)
- [x] Selector de música
- [x] Reproducir música durante meditación
- [x] Loop automático si música < tiempo
- [x] Pausar/Reanudar
- [x] Reiniciar
- [x] Reproducir tono al finalizar
- [x] Persistencia en localStorage
- [x] Mostrar tiempo transcurrido/restante
- [x] Funciona en móvil
- [x] Música en background (con limitaciones)

### Base de Datos
- [x] Tabla `musicas_meditacion`
- [x] Tabla `tonos_meditacion`
- [x] Campo `es_por_defecto` en ambas
- [x] Campo `tono_meditacion_id` en `alumnos`
- [x] Índices optimizados

---

## 🎨 Mejoras Futuras Posibles

1. **Visualización de progreso**: Barra de progreso visual
2. **Estadísticas**: Tiempo total meditado, sesiones completadas
3. **Múltiples músicas en playlist**: Reproducir varias músicas en secuencia
4. **Volumen ajustable**: Control de volumen para música
5. **Notificaciones**: Notificación cuando termine la meditación
6. **Modo oscuro**: Tema oscuro para el reloj
7. **Sonidos ambientales**: Agregar sonidos de naturaleza, etc.
8. **Guías de meditación**: Textos o audios guiados

---

**Documentación generada el**: 2025-01-11
**Versión del sistema**: AuriPortal v4.0
**Autor**: Sistema de Documentación Automática


















