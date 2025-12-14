# AuriPortal V5 - Documentación de Implementación

## 📋 Resumen

AuriPortal V5 es una expansión del sistema V4 que añade:
- Registro de prácticas desde Typeform sin depender del envío automático
- Integración con Whisper local para transcripción de audio
- Integración con Ollama local para análisis emocional
- Sistema de misiones y logros
- Reflexiones y termómetro emocional
- Auricalendar y Aurigraph
- Modo Maestro

**Fecha de implementación:** Diciembre 2024

---

## ✅ Estado de Implementación

### Completado ✅

1. **Base de Datos**
   - ✅ Tabla `reflexiones` creada
   - ✅ Tabla `practicas_audio` creada
   - ✅ Tabla `misiones` creada
   - ✅ Tabla `misiones_alumnos` creada
   - ✅ Tabla `logros_definicion` creada
   - ✅ Tabla `logros` creada
   - ✅ Campo `practicas.aspecto_id` añadido
   - ✅ Campo `alumnos.energia_emocional` añadido

2. **Servicios**
   - ✅ `src/services/emociones.js` - Análisis emocional con Ollama
   - ✅ `src/services/misiones.js` - Gestión de misiones
   - ✅ `src/services/logros.js` - Gestión de logros/insignias

3. **Endpoints**
   - ✅ `GET /practica/registro` - Página de registro de práctica
   - ✅ `POST /practica/registro` - Procesamiento de práctica con Whisper
   - ✅ `GET /practica/confirmacion` - Página de confirmación
   - ✅ Webhook Typeform v4 ajustado (solo feedback, no crea prácticas)

4. **Integración Analytics**
   - ✅ Eventos registrados: `confirmacion_practica_portal`, `reflexion`, `audio_practica`, `mision_completada`, `logro_obtenido`

### Pendiente ⏳

1. **Panel Admin**
   - ⏳ Sección Misiones
   - ⏳ Sección Logros
   - ⏳ Sección Reflexiones
   - ⏳ Auricalendar (vista admin y alumno)
   - ⏳ Aurigraph (gráfico radar)
   - ⏳ Modo Maestro

2. **Instalación de Dependencias**
   - ⏳ Whisper (modelo medium) instalado en servidor
   - ⏳ Ollama instalado con modelo llama3
   - ⏳ FFmpeg para conversión de audio

---

## 🗄️ Estructura de Base de Datos

### Tablas Nuevas

#### `reflexiones`
```sql
CREATE TABLE reflexiones (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  texto TEXT NOT NULL,
  energia_emocional INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `practicas_audio`
```sql
CREATE TABLE practicas_audio (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  transcripcion TEXT,
  emocion INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `misiones`
```sql
CREATE TABLE misiones (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(100) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  condiciones JSONB DEFAULT '{}',
  recompensa JSONB DEFAULT '{}',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `misiones_alumnos`
```sql
CREATE TABLE misiones_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  mision_id INTEGER NOT NULL REFERENCES misiones(id) ON DELETE CASCADE,
  completada BOOLEAN DEFAULT false,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, mision_id)
);
```

#### `logros_definicion`
```sql
CREATE TABLE logros_definicion (
  codigo VARCHAR(100) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  icono VARCHAR(255),
  condiciones JSONB DEFAULT '{}',
  recompensa JSONB DEFAULT '{}',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `logros`
```sql
CREATE TABLE logros (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  codigo VARCHAR(100) NOT NULL REFERENCES logros_definicion(codigo) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, codigo)
);
```

### Campos Añadidos

- `practicas.aspecto_id` - Relación con aspectos de práctica
- `alumnos.energia_emocional` - Termómetro emocional (1-10, default 5)

---

## 🔧 Servicios Implementados

### `src/services/emociones.js`

**Funciones:**
- `analizarEmocionTexto(texto)` - Analiza emoción usando Ollama local
- `calcularEnergiaPromedio(textos)` - Calcula energía promedio de múltiples textos

**Uso:**
```javascript
import { analizarEmocionTexto } from '../services/emociones.js';

const analisis = await analizarEmocionTexto("Me siento muy bien hoy");
// { puntuacion: 8, etiquetas: ['positivo', 'alegría'], resumen: '...' }
```

### `src/services/misiones.js`

**Funciones:**
- `verificarMisiones(alumnoId)` - Verifica y completa misiones
- `getMisionesAlumno(alumnoId, soloCompletadas)` - Obtiene misiones del alumno
- `crearMision(misionData)` - Crea una nueva misión

**Tipos de condiciones:**
- `contador_aspectos` - N prácticas de aspectos específicos
- `contador_practicas` - N prácticas totales
- `racha` - Racha de N días
- `nivel` - Nivel mínimo
- `combinado` - Combinación AND/OR

### `src/services/logros.js`

**Funciones:**
- `verificarLogros(alumnoId)` - Verifica y otorga logros
- `getLogrosAlumno(alumnoId)` - Obtiene logros del alumno
- `crearLogro(logroData)` - Crea un nuevo logro

**Tipos de condiciones:**
- `racha` - Racha de N días
- `nivel` - Nivel mínimo
- `practicas_totales` - N prácticas totales
- `practicas_aspecto` - N prácticas de un aspecto
- `reflexiones` - N reflexiones
- `combinado` - Combinación AND/OR

---

## 🌐 Endpoints

### `GET /practica/registro`

**Query Parameters:**
- `email` (requerido) - Email del alumno
- `aspecto_id` (opcional) - ID del aspecto
- `tipo` (opcional) - Tipo de práctica
- `form_id` (opcional) - ID del formulario Typeform
- `session_id` (opcional) - ID de sesión

**Respuesta:** HTML con formulario de registro

### `POST /practica/registro`

**Body (multipart/form-data):**
- `alumno_id` (requerido)
- `practica_id` (requerido)
- `reflexion_texto` (opcional)
- `energia_emocional` (opcional, 1-10)
- `audio` (opcional, archivo de audio)

**Procesamiento:**
1. Crea reflexión si hay texto
2. Procesa audio con Whisper si existe
3. Analiza emoción con Ollama
4. Actualiza energía emocional del alumno
5. Verifica logros y misiones
6. Redirige a `/practica/confirmacion`

### `GET /practica/confirmacion`

**Respuesta:** HTML de confirmación

---

## 🔄 Flujo de Práctica V5

1. **Alumno completa Typeform**
   - Typeform incluye hidden fields: `email`, `apodo`, `nivel`, `aspecto_id`, `tipo_practica`, etc.

2. **Pantalla final de Typeform**
   - Botón principal: "Registrar mi práctica en AuriPortal"
   - Redirige a: `/practica/registro?email=...&aspecto_id=...&tipo=...`

3. **GET /practica/registro**
   - Crea práctica en PostgreSQL (si no existe)
   - Actualiza última práctica y streak
   - Muestra formulario para reflexión y audio

4. **POST /practica/registro**
   - Guarda reflexión (si hay)
   - Procesa audio con Whisper (si hay)
   - Analiza emoción con Ollama
   - Actualiza energía emocional
   - Verifica logros y misiones
   - Redirige a confirmación

5. **Opcional: Enviar feedback a Typeform**
   - Botón secundario en Typeform: "Enviar mis respuestas a Eugeni"
   - Dispara webhook Typeform
   - Webhook guarda feedback completo en `respuestas`
   - NO crea práctica nueva (ya existe)

---

## 📊 Eventos de Analytics

### Nuevos Tipos de Eventos

- `confirmacion_practica_portal` - Práctica registrada desde portal
- `reflexion` - Reflexión guardada
- `audio_practica` - Audio procesado
- `mision_completada` - Misión completada
- `logro_obtenido` - Logro otorgado

### Metadata Ejemplo

```json
{
  "tipo_evento": "confirmacion_practica_portal",
  "metadata": {
    "practica_id": 123,
    "aspecto_id": 5,
    "aspecto_nombre": "Respiración",
    "tipo_practica": "meditación corta",
    "form_id": "abc123",
    "session_id": "xyz789"
  }
}
```

---

## 🛠️ Instalación de Dependencias

### Whisper (Modelo Medium)

```bash
# Instalar Whisper
pip install openai-whisper

# Descargar modelo medium
whisper --model medium
```

### Ollama

```bash
# Instalar Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Descargar modelo llama3
ollama pull llama3
```

### FFmpeg

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install ffmpeg

# Verificar instalación
ffmpeg -version
```

### Variables de Entorno

Añadir a `.env`:

```env
# Ollama
OLLAMA_MODEL=llama3

# Whisper
TEMP_AUDIO_DIR=/tmp/aurelinportal/audio
```

---

## 🚀 Próximos Pasos

1. **Instalar dependencias** (Whisper, Ollama, FFmpeg)
2. **Crear secciones Admin Panel:**
   - Misiones (crear/editar misiones)
   - Logros (crear/editar logros)
   - Reflexiones (ver reflexiones de alumnos)
   - Auricalendar (vista admin)
   - Aurigraph (generar gráfico radar)
   - Modo Maestro (vista completa del alumno)

3. **Vista Alumno:**
   - `/mi-calendario` - Calendario personal
   - Integrar Aurigraph en perfil

4. **Testing:**
   - Probar flujo completo de práctica
   - Verificar Whisper y Ollama
   - Probar misiones y logros

---

## 📝 Notas Técnicas

### Whisper
- Modelo: `medium` (balance entre calidad y velocidad)
- Formato de salida: JSON
- Idioma: Español (`--language es`)
- Máximo: 5 minutos de audio

### Ollama
- Modelo por defecto: `llama3`
- Timeout: 30 segundos
- Fallback: Análisis básico por palabras clave si falla

### Termómetro Emocional
- Algoritmo: Promedio de últimas 10 reflexiones/audios (últimos 7 días)
- Rango: 1-10
- Default: 5

### Misiones y Logros
- Se verifican automáticamente tras:
  - Registrar práctica
  - Guardar reflexión
  - Procesar audio
- Condiciones en JSONB para máxima flexibilidad

---

## 🔒 Seguridad

- ✅ Validación de tamaño de archivo (máx. 50MB)
- ✅ Validación de duración de audio (máx. 5 min)
- ✅ Sanitización de inputs
- ✅ Timeouts en procesos externos (Whisper, Ollama)
- ✅ Limpieza de archivos temporales

---

**Última actualización:** Diciembre 2024  
**Versión:** AuriPortal V5.0.0




