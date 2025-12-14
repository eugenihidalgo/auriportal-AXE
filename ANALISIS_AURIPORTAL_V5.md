# Análisis Técnico: AuriPortal V5 - Plan de Implementación

## Resumen Ejecutivo

AuriPortal V5 es una expansión completa del sistema actual que elimina dependencias de APIs externas y añade funcionalidades avanzadas de analytics, gamificación, emociones y procesamiento local de audio e IA.

**Principios Fundamentales:**
- ✅ 100% local (sin APIs externas)
- ✅ Whisper local para transcripciones
- ✅ Ollama local para IA
- ✅ PostgreSQL como única fuente de verdad
- ✅ Workflow 100% configurable desde Admin Panel

---

## 1. DISEÑO DE PRÁCTICAS SIN ENVÍO DE TYPEFORM

### 1.1. Cambios Requeridos

#### Frontend (Typeform)
- **Modificar último step de Typeform** para mostrar:
  - Botón: "Confirmar práctica en AuriPortal"
  - Botón opcional: "Enviar feedback / compartir experiencia"
- **Hidden fields** (no enviar automáticamente):
  - `email`
  - `apodo`
  - `nivel`
  - `tipo_practica`
  - `id_practica`
  - `timestamp`

#### Backend - Nuevo Endpoint

**Archivo:** `src/endpoints/practica-confirmar.js`

```javascript
// POST /practica/confirmar
export default async function practicaConfirmarHandler(request, env, ctx) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const tipo = url.searchParams.get('tipo');
  
  // 1. Validar alumno
  const alumno = await findStudentByEmail(env, email);
  if (!alumno) {
    return Response.redirect('/enter?error=alumno_no_encontrado', 302);
  }
  
  // 2. Registrar práctica
  await practicas.create({
    alumno_id: alumno.id,
    fecha: new Date(),
    tipo: tipo || 'general',
    origen: 'portal',
    duracion: null
  });
  
  // 3. Actualizar streak
  await actualizarStreak(alumno.id);
  
  // 4. Actualizar última práctica
  await alumnos.update(alumno.id, {
    fecha_ultima_practica: new Date()
  });
  
  // 5. Verificar logros/misiones
  await verificarLogros(alumno.id);
  await verificarMisiones(alumno.id);
  
  // 6. Registrar evento analytics
  await analytics.registrarEvento({
    alumno_id: alumno.id,
    tipo_evento: 'confirmacion_practica',
    fecha: new Date(),
    metadata: { tipo, origen: 'portal' }
  });
  
  // 7. Redirigir según workflow configurado
  const siguientePantalla = await obtenerSiguientePantalla(alumno.id, 'practica_confirmada');
  return Response.redirect(siguientePantalla.url_ruta, 302);
}
```

#### Base de Datos

**No requiere cambios** - La tabla `practicas` ya existe.

#### Archivos a Modificar

1. **Nuevo:** `src/endpoints/practica-confirmar.js`
2. **Modificar:** `src/router.js` - Agregar ruta `/practica/confirmar`
3. **Nuevo:** `src/services/logros.js` - Función `verificarLogros()`
4. **Nuevo:** `src/services/misiones.js` - Función `verificarMisiones()`
5. **Nuevo:** `src/services/workflow-engine.js` - Función `obtenerSiguientePantalla()`

---

## 2. AURIANALYTICS (ESTADÍSTICAS AVANZADAS)

### 2.1. Nuevas Tablas

#### Tabla: `analytics_eventos`

```sql
CREATE TABLE analytics_eventos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_eventos_alumno ON analytics_eventos(alumno_id);
CREATE INDEX idx_analytics_eventos_tipo ON analytics_eventos(tipo_evento);
CREATE INDEX idx_analytics_eventos_fecha ON analytics_eventos(fecha);
```

**Tipos de evento:**
- `login`
- `confirmacion_practica`
- `enviar_feedback`
- `pausa`
- `reactivacion`
- `ritual`
- `cambio_nivel`
- `cambio_fase`
- `logro`
- `mision`
- `emocion`
- `reflexion`

#### Tabla: `analytics_resumen_diario`

```sql
CREATE TABLE analytics_resumen_diario (
  id SERIAL PRIMARY KEY,
  fecha DATE UNIQUE NOT NULL,
  alumnos_activos INTEGER DEFAULT 0,
  practicas_totales INTEGER DEFAULT 0,
  energia_media NUMERIC(4,2) DEFAULT 0,
  nivel_promedio NUMERIC(4,2) DEFAULT 0,
  fase_predominante TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_resumen_fecha ON analytics_resumen_diario(fecha);
```

### 2.2. Servicio de Analytics

**Archivo:** `src/services/analytics.js`

```javascript
import { query } from '../../database/pg.js';

export const analytics = {
  /**
   * Registrar un evento
   */
  async registrarEvento({ alumno_id, tipo_evento, fecha, metadata = {} }) {
    await query(
      `INSERT INTO analytics_eventos (alumno_id, tipo_evento, fecha, metadata)
       VALUES ($1, $2, $3, $4)`,
      [alumno_id, tipo_evento, fecha || new Date(), JSON.stringify(metadata)]
    );
  },

  /**
   * Obtener eventos de un alumno
   */
  async getEventosAlumno(alumnoId, tipoEvento = null, fechaDesde = null, fechaHasta = null) {
    let where = ['alumno_id = $1'];
    let params = [alumnoId];
    let paramIndex = 2;

    if (tipoEvento) {
      where.push(`tipo_evento = $${paramIndex}`);
      params.push(tipoEvento);
      paramIndex++;
    }

    if (fechaDesde) {
      where.push(`fecha >= $${paramIndex}`);
      params.push(fechaDesde);
      paramIndex++;
    }

    if (fechaHasta) {
      where.push(`fecha <= $${paramIndex}`);
      params.push(fechaHasta);
      paramIndex++;
    }

    const result = await query(
      `SELECT * FROM analytics_eventos 
       WHERE ${where.join(' AND ')} 
       ORDER BY fecha DESC`,
      params
    );

    return result.rows;
  },

  /**
   * Calcular resumen diario
   */
  async calcularResumenDiario(fecha = new Date()) {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    // Alumnos activos (con práctica en el día)
    const alumnosActivos = await query(
      `SELECT COUNT(DISTINCT alumno_id) as total
       FROM practicas
       WHERE DATE(fecha) = $1`,
      [fechaStr]
    );

    // Prácticas totales
    const practicasTotales = await query(
      `SELECT COUNT(*) as total
       FROM practicas
       WHERE DATE(fecha) = $1`,
      [fechaStr]
    );

    // Energía media
    const energiaMedia = await query(
      `SELECT AVG(energia_emocional) as media
       FROM alumnos
       WHERE energia_emocional IS NOT NULL`,
      []
    );

    // Nivel promedio
    const nivelPromedio = await query(
      `SELECT AVG(nivel_actual) as promedio
       FROM alumnos
       WHERE estado_suscripcion = 'activa'`,
      []
    );

    // Fase predominante
    const fasePredominante = await query(
      `SELECT 
         CASE
           WHEN nivel_actual BETWEEN 1 AND 6 THEN 'sanación'
           WHEN nivel_actual BETWEEN 7 AND 9 THEN 'sanación avanzada'
           WHEN nivel_actual BETWEEN 10 AND 15 THEN 'canalización'
           WHEN nivel_actual > 15 THEN 'creación'
           ELSE 'sanación'
         END as fase,
         COUNT(*) as count
       FROM alumnos
       WHERE estado_suscripcion = 'activa'
       GROUP BY fase
       ORDER BY count DESC
       LIMIT 1`,
      []
    );

    // Upsert resumen
    await query(
      `INSERT INTO analytics_resumen_diario 
       (fecha, alumnos_activos, practicas_totales, energia_media, nivel_promedio, fase_predominante)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (fecha) DO UPDATE SET
         alumnos_activos = EXCLUDED.alumnos_activos,
         practicas_totales = EXCLUDED.practicas_totales,
         energia_media = EXCLUDED.energia_media,
         nivel_promedio = EXCLUDED.nivel_promedio,
         fase_predominante = EXCLUDED.fase_predominante,
         updated_at = CURRENT_TIMESTAMP`,
      [
        fechaStr,
        parseInt(alumnosActivos.rows[0].total) || 0,
        parseInt(practicasTotales.rows[0].total) || 0,
        parseFloat(energiaMedia.rows[0].media) || 0,
        parseFloat(nivelPromedio.rows[0].promedio) || 0,
        fasePredominante.rows[0]?.fase || null
      ]
    );
  }
};
```

### 2.3. Endpoint Admin para Analytics

**Archivo:** `src/endpoints/admin-panel-analytics.js`

- Dashboard con gráficos
- Filtros por fecha, alumno, tipo de evento
- Exportación a CSV

---

## 3. SISTEMA DE TRANSICIONES 100% CONFIGURABLE

### 3.1. Extensión de `conexiones_pantallas`

#### Modificar Tabla

```sql
ALTER TABLE conexiones_pantallas 
ADD COLUMN condiciones JSONB DEFAULT '{}';

-- Ejemplo de estructura JSONB:
-- {
--   "nivel": { "op": ">=", "valor": 5 },
--   "fase": "canalizacion",
--   "streak": { "op": ">=", "valor": 7 },
--   "emocion": { "op": "<", "valor": 4 },
--   "mision": "mision_ritmo_7dias",
--   "logro": "chispa_luz",
--   "dia_semana": [1, 2, 3, 4, 5],  // Lunes a Viernes
--   "hora_desde": "09:00",
--   "hora_hasta": "18:00"
-- }
```

#### Motor de Evaluación de Condiciones

**Archivo:** `src/services/workflow-engine.js`

```javascript
import { conexionesPantallas, alumnos } from '../../database/pg.js';
import { getFasePorNivel } from '../modules/nivel-v4.js';
import { logros } from '../services/logros.js';
import { misiones } from '../services/misiones.js';

/**
 * Obtener siguiente pantalla según condiciones
 */
export async function obtenerSiguientePantalla(alumnoId, evento = null) {
  const alumno = await alumnos.findById(alumnoId);
  if (!alumno) return null;

  // Obtener todas las conexiones activas
  const conexiones = await conexionesPantallas.getAll();
  const conexionesActivas = conexiones.filter(c => c.activa);

  // Obtener datos del alumno para evaluar condiciones
  const datosAlumno = await obtenerDatosAlumnoParaCondiciones(alumnoId);

  // Evaluar cada conexión
  for (const conexion of conexionesActivas) {
    if (evaluarCondiciones(conexion.condiciones, datosAlumno, evento)) {
      // Esta conexión es válida, obtener pantalla destino
      const pantallaDestino = await pantallas.findById(conexion.pantalla_destino_id);
      return pantallaDestino;
    }
  }

  // Si no hay conexión válida, retornar pantalla por defecto
  return await obtenerPantallaPorDefecto();
}

/**
 * Obtener datos del alumno para evaluar condiciones
 */
async function obtenerDatosAlumnoParaCondiciones(alumnoId) {
  const alumno = await alumnos.findById(alumnoId);
  const fase = await getFasePorNivel(alumno.nivel_actual || 1);
  
  // Obtener logros del alumno
  const logrosAlumno = await logros.getByAlumnoId(alumnoId);
  const codigosLogros = logrosAlumno.map(l => l.codigo);

  // Obtener misiones completadas
  const misionesAlumno = await misiones.getByAlumnoId(alumnoId);
  const codigosMisiones = misionesAlumno
    .filter(m => m.completada)
    .map(m => m.codigo);

  // Práctica reciente (últimas 24 horas)
  const practicaReciente = await practicas.findByAlumnoId(alumnoId, 1);
  const tienePracticaReciente = practicaReciente.length > 0 && 
    (new Date() - new Date(practicaReciente[0].fecha)) < 24 * 60 * 60 * 1000;

  return {
    nivel: alumno.nivel_actual || 1,
    fase: fase?.fase || 'sanación',
    streak: alumno.streak || 0,
    energia_emocional: alumno.energia_emocional || 5,
    logros: codigosLogros,
    misiones: codigosMisiones,
    practica_reciente: tienePracticaReciente,
    dia_semana: new Date().getDay(), // 0 = Domingo, 6 = Sábado
    hora_actual: new Date().toTimeString().slice(0, 5) // "HH:MM"
  };
}

/**
 * Evaluar condiciones JSONB
 */
function evaluarCondiciones(condiciones, datosAlumno, evento) {
  if (!condiciones || Object.keys(condiciones).length === 0) {
    return true; // Sin condiciones = siempre válida
  }

  // Evaluar nivel
  if (condiciones.nivel) {
    const { op, valor } = condiciones.nivel;
    if (!evaluarOperador(datosAlumno.nivel, op, valor)) {
      return false;
    }
  }

  // Evaluar fase
  if (condiciones.fase) {
    if (datosAlumno.fase !== condiciones.fase) {
      return false;
    }
  }

  // Evaluar streak
  if (condiciones.streak) {
    const { op, valor } = condiciones.streak;
    if (!evaluarOperador(datosAlumno.streak, op, valor)) {
      return false;
    }
  }

  // Evaluar emoción
  if (condiciones.emocion) {
    const { op, valor } = condiciones.emocion;
    if (!evaluarOperador(datosAlumno.energia_emocional, op, valor)) {
      return false;
    }
  }

  // Evaluar misión
  if (condiciones.mision) {
    if (!datosAlumno.misiones.includes(condiciones.mision)) {
      return false;
    }
  }

  // Evaluar logro
  if (condiciones.logro) {
    if (!datosAlumno.logros.includes(condiciones.logro)) {
      return false;
    }
  }

  // Evaluar práctica reciente
  if (condiciones.practica_reciente === true) {
    if (!datosAlumno.practica_reciente) {
      return false;
    }
  }

  // Evaluar día de la semana
  if (condiciones.dia_semana) {
    const diasPermitidos = Array.isArray(condiciones.dia_semana) 
      ? condiciones.dia_semana 
      : [condiciones.dia_semana];
    if (!diasPermitidos.includes(datosAlumno.dia_semana)) {
      return false;
    }
  }

  // Evaluar horario
  if (condiciones.hora_desde || condiciones.hora_hasta) {
    const horaActual = datosAlumno.hora_actual;
    if (condiciones.hora_desde && horaActual < condiciones.hora_desde) {
      return false;
    }
    if (condiciones.hora_hasta && horaActual > condiciones.hora_hasta) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluar operador
 */
function evaluarOperador(valor, op, comparacion) {
  switch (op) {
    case '>=': return valor >= comparacion;
    case '<=': return valor <= comparacion;
    case '>': return valor > comparacion;
    case '<': return valor < comparacion;
    case '==': return valor === comparacion;
    case '!=': return valor !== comparacion;
    default: return false;
  }
}
```

### 3.2. Modificar Admin Panel Workflow

**Archivo:** `src/endpoints/admin-panel-workflow.js`

- Agregar editor JSON para condiciones
- Validación de sintaxis
- Vista previa de condiciones
- Testing de condiciones con datos de ejemplo

---

## 4. AURICALENDAR (CALENDARIO DE PRÁCTICAS)

### 4.1. Vista Admin

**Archivo:** `src/endpoints/admin-panel-calendario.js`

**Funcionalidades:**
- Calendario mensual/semanal/diario
- Prácticas por día
- Pausas
- Logros
- Misiones
- Energía media
- Nuevas inscripciones

**Datos a Mostrar:**
- Consultar `practicas` por fecha
- Consultar `pausas` por fecha
- Consultar `logros` por fecha
- Consultar `misiones_alumnos` por fecha
- Consultar `analytics_resumen_diario` para energía media

### 4.2. Vista Alumno

**Archivo:** `src/endpoints/calendario-alumno.js`

**Funcionalidades:**
- Prácticas del alumno
- Reflexiones
- Logros
- Racha
- Rituales

**Endpoint:** `GET /calendario`

---

## 5. REGISTRO DE REFLEXIONES Y EMOCIONES

### 5.1. Nueva Tabla

```sql
CREATE TABLE reflexiones (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  texto TEXT NOT NULL,
  energia_emocional INTEGER CHECK (energia_emocional >= 1 AND energia_emocional <= 10),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reflexiones_alumno ON reflexiones(alumno_id);
CREATE INDEX idx_reflexiones_fecha ON reflexiones(fecha);
```

### 5.2. Nuevo Endpoint

**Archivo:** `src/endpoints/reflexion-crear.js`

```javascript
// POST /reflexion/crear
export default async function reflexionCrearHandler(request, env, ctx) {
  const formData = await request.formData();
  const email = formData.get('email');
  const texto = formData.get('texto');
  const energia = parseInt(formData.get('energia_emocional'));

  const alumno = await findStudentByEmail(env, email);
  if (!alumno) {
    return new Response(JSON.stringify({ error: 'Alumno no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Crear reflexión
  await reflexiones.create({
    alumno_id: alumno.id,
    texto,
    energia_emocional: energia,
    metadata: {}
  });

  // Actualizar energía emocional del alumno (promedio de últimas 7 reflexiones)
  await actualizarEnergiaEmocional(alumno.id);

  // Registrar evento
  await analytics.registrarEvento({
    alumno_id: alumno.id,
    tipo_evento: 'reflexion',
    metadata: { energia }
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 5.3. Pantalla de Reflexión

**Archivo:** `src/core/html/reflexion.html`

- Formulario opcional después de confirmar práctica
- "¿Quieres registrar una reflexión?"
- "¿Cómo te sientes del 1 al 10?" (slider)

---

## 6. LOGROS (INSIGNIAS)

### 6.1. Nuevas Tablas

```sql
CREATE TABLE logros_definicion (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  icono TEXT,
  condiciones JSONB NOT NULL,
  recompensa JSONB DEFAULT '{}',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE logros (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  codigo TEXT REFERENCES logros_definicion(codigo),
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, codigo)
);

CREATE INDEX idx_logros_alumno ON logros(alumno_id);
CREATE INDEX idx_logros_codigo ON logros(codigo);
```

### 6.2. Servicio de Logros

**Archivo:** `src/services/logros.js`

```javascript
import { query } from '../../database/pg.js';
import { alumnos, practicas } from '../../database/pg.js';

export const logros = {
  /**
   * Verificar y otorgar logros a un alumno
   */
  async verificarLogros(alumnoId) {
    const definiciones = await this.getDefinicionesActivas();
    const alumno = await alumnos.findById(alumnoId);
    
    for (const definicion of definiciones) {
      // Verificar si ya tiene el logro
      const yaTiene = await this.tieneLogro(alumnoId, definicion.codigo);
      if (yaTiene) continue;

      // Evaluar condiciones
      if (await this.evaluarCondiciones(definicion.condiciones, alumnoId)) {
        // Otorgar logro
        await this.otorgarLogro(alumnoId, definicion.codigo);
        
        // Aplicar recompensa si existe
        if (definicion.recompensa) {
          await this.aplicarRecompensa(alumnoId, definicion.recompensa);
        }

        // Registrar evento
        await analytics.registrarEvento({
          alumno_id: alumnoId,
          tipo_evento: 'logro',
          metadata: { codigo: definicion.codigo }
        });
      }
    }
  },

  /**
   * Evaluar condiciones de un logro
   */
  async evaluarCondiciones(condiciones, alumnoId) {
    const alumno = await alumnos.findById(alumnoId);
    
    // Ejemplo de condiciones:
    // { "practicas_totales": { "op": ">=", "valor": 10 } }
    // { "streak": { "op": ">=", "valor": 7 } }
    // { "nivel": { "op": ">=", "valor": 5 } }
    
    for (const [campo, condicion] of Object.entries(condiciones)) {
      const { op, valor } = condicion;
      
      let valorActual;
      switch (campo) {
        case 'practicas_totales':
          const practicasCount = await practicas.countByAlumnoId(alumnoId);
          valorActual = practicasCount;
          break;
        case 'streak':
          valorActual = alumno.streak || 0;
          break;
        case 'nivel':
          valorActual = alumno.nivel_actual || 1;
          break;
        case 'energia_emocional':
          valorActual = alumno.energia_emocional || 5;
          break;
        default:
          continue;
      }

      if (!evaluarOperador(valorActual, op, valor)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Otorgar logro
   */
  async otorgarLogro(alumnoId, codigo) {
    await query(
      `INSERT INTO logros (alumno_id, codigo)
       VALUES ($1, $2)
       ON CONFLICT (alumno_id, codigo) DO NOTHING`,
      [alumnoId, codigo]
    );
  },

  /**
   * Obtener logros de un alumno
   */
  async getByAlumnoId(alumnoId) {
    const result = await query(
      `SELECT l.*, ld.nombre, ld.descripcion, ld.icono
       FROM logros l
       JOIN logros_definicion ld ON l.codigo = ld.codigo
       WHERE l.alumno_id = $1
       ORDER BY l.fecha DESC`,
      [alumnoId]
    );
    return result.rows;
  }
};
```

### 6.3. Logros Predefinidos

**Archivo:** `database/seed-logros.js`

```javascript
const logrosPredefinidos = [
  {
    codigo: 'chispa_luz',
    nombre: 'Chispa de Luz',
    descripcion: 'Completa tu primera práctica',
    icono: '✨',
    condiciones: { practicas_totales: { op: '>=', valor: 1 } }
  },
  {
    codigo: 'racha_7',
    nombre: 'Racha de 7 Días',
    descripcion: 'Mantén una racha de 7 días consecutivos',
    icono: '🔥',
    condiciones: { streak: { op: '>=', valor: 7 } }
  },
  {
    codigo: 'nivel_5',
    nombre: 'Nivel 5',
    descripcion: 'Alcanza el nivel 5',
    icono: '⭐',
    condiciones: { nivel: { op: '>=', valor: 5 } }
  }
];
```

---

## 7. WHISPER LOCAL (SIN API)

### 7.1. Requisitos del Sistema

- **FFmpeg** instalado para conversión de audio
- **Whisper** instalado localmente
- **Modelo:** `medium` o `large` (recomendado `medium` para español)

### 7.2. Instalación de Whisper

```bash
# Instalar Whisper
pip install openai-whisper

# Descargar modelo
whisper --model medium
```

### 7.3. Nueva Tabla

```sql
CREATE TABLE practicas_audio (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archivo_path TEXT NOT NULL,
  transcripcion TEXT,
  emocion INTEGER CHECK (emocion >= 1 AND emocion <= 10),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_practicas_audio_alumno ON practicas_audio(alumno_id);
CREATE INDEX idx_practicas_audio_fecha ON practicas_audio(fecha);
```

### 7.4. Nuevo Endpoint

**Archivo:** `src/endpoints/audio-whisper.js`

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { findStudentByEmail } from '../modules/student-v4.js';
import { practicasAudio } from '../../database/pg.js';
import { ollama } from '../services/ollama.js';

const execAsync = promisify(exec);
const UPLOAD_DIR = '/var/www/aurelinportal/uploads/audio';
const MAX_DURATION = 5 * 60; // 5 minutos en segundos

// POST /audio/whisper
export default async function audioWhisperHandler(request, env, ctx) {
  try {
    const formData = await request.formData();
    const email = formData.get('email');
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'Archivo de audio requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar alumno
    const alumno = await findStudentByEmail(env, email);
    if (!alumno) {
      return new Response(JSON.stringify({ error: 'Alumno no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Guardar archivo temporal
    const timestamp = Date.now();
    const originalName = audioFile.name;
    const extension = originalName.split('.').pop();
    const tempPath = join(UPLOAD_DIR, `temp_${timestamp}.${extension}`);
    const wavPath = join(UPLOAD_DIR, `audio_${timestamp}.wav`);

    // Escribir archivo
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(tempPath, buffer);

    // Verificar duración con FFmpeg
    const { stdout: durationOutput } = await execAsync(
      `ffprobe -i "${tempPath}" -show_entries format=duration -v quiet -of csv="p=0"`
    );
    const duration = parseFloat(durationOutput.trim());

    if (duration > MAX_DURATION) {
      await unlink(tempPath);
      return new Response(JSON.stringify({ 
        error: `Audio demasiado largo. Máximo ${MAX_DURATION / 60} minutos` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convertir a WAV si es necesario
    if (extension !== 'wav') {
      await execAsync(
        `ffmpeg -i "${tempPath}" -ar 16000 -ac 1 "${wavPath}"`
      );
      await unlink(tempPath);
    } else {
      await execAsync(`cp "${tempPath}" "${wavPath}"`);
      await unlink(tempPath);
    }

    // Transcribir con Whisper
    const { stdout: whisperOutput } = await execAsync(
      `whisper "${wavPath}" --model medium --language es --output_format json --output_dir "${UPLOAD_DIR}"`
    );

    // Leer transcripción
    const jsonPath = join(UPLOAD_DIR, `audio_${timestamp}.json`);
    const transcriptionData = JSON.parse(await readFile(jsonPath, 'utf-8'));
    const transcription = transcriptionData.text;

    // Analizar emoción con Ollama
    const emocion = await ollama.analizarEmocion(transcription);

    // Guardar en base de datos
    const practicaAudio = await practicasAudio.create({
      alumno_id: alumno.id,
      archivo_path: wavPath,
      transcripcion: transcription,
      emocion: emocion,
      metadata: {
        duracion: duration,
        modelo: 'whisper-medium',
        idioma: 'es'
      }
    });

    // Actualizar energía emocional del alumno
    await actualizarEnergiaEmocional(alumno.id);

    // Registrar evento
    await analytics.registrarEvento({
      alumno_id: alumno.id,
      tipo_evento: 'emocion',
      metadata: { emocion, fuente: 'audio' }
    });

    // Limpiar archivos temporales
    await unlink(jsonPath);

    return new Response(JSON.stringify({
      success: true,
      transcripcion,
      emocion,
      id: practicaAudio.id
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error procesando audio:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

---

## 8. TERMÓMETRO EMOCIONAL

### 8.1. Modificar Tabla `alumnos`

```sql
ALTER TABLE alumnos 
ADD COLUMN energia_emocional INTEGER DEFAULT 5 CHECK (energia_emocional >= 1 AND energia_emocional <= 10);
```

### 8.2. Algoritmo de Cálculo

**Archivo:** `src/services/emociones.js`

```javascript
import { query } from '../../database/pg.js';
import { alumnos } from '../../database/pg.js';

export async function actualizarEnergiaEmocional(alumnoId) {
  // Obtener últimas 7 reflexiones
  const reflexiones = await query(
    `SELECT energia_emocional 
     FROM reflexiones 
     WHERE alumno_id = $1 
     ORDER BY fecha DESC 
     LIMIT 7`,
    [alumnoId]
  );

  // Obtener últimas 7 transcripciones de audio
  const audios = await query(
    `SELECT emocion 
     FROM practicas_audio 
     WHERE alumno_id = $1 
     ORDER BY fecha DESC 
     LIMIT 7`,
    [alumnoId]
  );

  // Calcular promedio
  const valores = [
    ...reflexiones.rows.map(r => r.energia_emocional),
    ...audios.rows.map(a => a.emocion)
  ].filter(v => v !== null && v !== undefined);

  if (valores.length === 0) {
    return; // No hay datos suficientes
  }

  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;

  // Factores adicionales
  const alumno = await alumnos.findById(alumnoId);
  
  // Bonus por racha
  let bonusRacha = 0;
  if (alumno.streak >= 7) bonusRacha = 0.5;
  if (alumno.streak >= 14) bonusRacha = 1;
  if (alumno.streak >= 30) bonusRacha = 1.5;

  // Bonus por constancia (prácticas en últimos 7 días)
  const practicasRecientes = await query(
    `SELECT COUNT(*) as count
     FROM practicas
     WHERE alumno_id = $1 
     AND fecha >= NOW() - INTERVAL '7 days'`,
    [alumnoId]
  );
  const constancia = parseInt(practicasRecientes.rows[0].count);
  let bonusConstancia = 0;
  if (constancia >= 5) bonusConstancia = 0.5;
  if (constancia >= 7) bonusConstancia = 1;

  // Penalización por pausa reciente
  let penalizacionPausa = 0;
  const pausasRecientes = await query(
    `SELECT COUNT(*) as count
     FROM pausas
     WHERE alumno_id = $1 
     AND fin IS NULL`,
    [alumnoId]
  );
  if (parseInt(pausasRecientes.rows[0].count) > 0) {
    penalizacionPausa = -1;
  }

  // Calcular energía final
  let energiaFinal = promedio + bonusRacha + bonusConstancia + penalizacionPausa;
  energiaFinal = Math.max(1, Math.min(10, Math.round(energiaFinal)));

  // Actualizar
  await query(
    `UPDATE alumnos 
     SET energia_emocional = $1 
     WHERE id = $2`,
    [energiaFinal, alumnoId]
  );

  return energiaFinal;
}
```

---

## 9. AURIGRAPH (MAPA DEL ALUMNO)

### 9.1. Endpoint

**Archivo:** `src/endpoints/aurigraph.js`

```javascript
// GET /aurigraph?email=xxx
export default async function aurigraphHandler(request, env, ctx) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  
  const alumno = await findStudentByEmail(env, email);
  if (!alumno) {
    return new Response(JSON.stringify({ error: 'Alumno no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Calcular métricas
  const nivel = alumno.nivel_actual || 1;
  const fase = await getFasePorNivel(nivel);
  const streak = alumno.streak || 0;
  const energia = alumno.energia_emocional || 5;
  
  // Ritmo de práctica (prácticas por semana)
  const practicasSemana = await query(
    `SELECT COUNT(*) as count
     FROM practicas
     WHERE alumno_id = $1 
     AND fecha >= NOW() - INTERVAL '7 days'`,
    [alumno.id]
  );
  const ritmo = parseInt(practicasSemana.rows[0].count);

  // Aspectos dominados
  const aspectosDominados = await query(
    `SELECT COUNT(*) as count
     FROM progreso_pedagogico
     WHERE alumno_id = $1
     AND (
       contador_alumno >= recomendacion_master_iniciarse OR
       contador_alumno >= recomendacion_master_conocer OR
       contador_alumno >= recomendacion_master_dominio
     )`,
    [alumno.id]
  );
  const aspectos = parseInt(aspectosDominados.rows[0].count);

  // Generar datos para radar chart
  const radarData = {
    nivel: Math.min(nivel / 15, 1) * 100, // Normalizado a 0-100
    fase: fase?.fase || 'sanación',
    racha: Math.min(streak / 30, 1) * 100, // Normalizado a 0-100
    energia: energia * 10, // 1-10 -> 10-100
    ritmo: Math.min(ritmo / 7, 1) * 100, // Normalizado a 0-100
    aspectos: Math.min(aspectos / 10, 1) * 100 // Normalizado a 0-100
  };

  return new Response(JSON.stringify(radarData), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 9.2. Frontend

**Archivo:** `src/core/html/aurigraph.html`

- Usar Chart.js o similar para radar chart
- Visualización interactiva

---

## 10. SISTEMA DE MISIONES

### 10.1. Nuevas Tablas

```sql
CREATE TABLE misiones (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  condiciones JSONB NOT NULL,
  recompensa JSONB DEFAULT '{}',
  activa BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE misiones_alumnos (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  mision_id INTEGER REFERENCES misiones(id) ON DELETE CASCADE,
  completada BOOLEAN DEFAULT false,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_completada TIMESTAMP,
  progreso JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(alumno_id, mision_id)
);

CREATE INDEX idx_misiones_alumnos_alumno ON misiones_alumnos(alumno_id);
CREATE INDEX idx_misiones_alumnos_mision ON misiones_alumnos(mision_id);
```

### 10.2. Servicio de Misiones

**Archivo:** `src/services/misiones.js`

```javascript
import { query } from '../../database/pg.js';

export const misiones = {
  /**
   * Verificar y actualizar misiones de un alumno
   */
  async verificarMisiones(alumnoId) {
    const misionesActivas = await this.getMisionesActivas();
    
    for (const mision of misionesActivas) {
      // Obtener o crear registro de misión para el alumno
      let misionAlumno = await this.getMisionAlumno(alumnoId, mision.id);
      
      if (!misionAlumno) {
        misionAlumno = await this.crearMisionAlumno(alumnoId, mision.id);
      }

      // Si ya está completada, saltar
      if (misionAlumno.completada) continue;

      // Evaluar progreso
      const progreso = await this.evaluarProgreso(mision.condiciones, alumnoId);
      
      // Actualizar progreso
      await this.actualizarProgreso(alumnoId, mision.id, progreso);

      // Verificar si se completó
      if (progreso.completado) {
        await this.completarMision(alumnoId, mision.id);
        
        // Aplicar recompensa
        if (mision.recompensa) {
          await this.aplicarRecompensa(alumnoId, mision.recompensa);
        }

        // Registrar evento
        await analytics.registrarEvento({
          alumno_id: alumnoId,
          tipo_evento: 'mision',
          metadata: { codigo: mision.codigo }
        });
      }
    }
  },

  /**
   * Obtener misiones de un alumno
   */
  async getByAlumnoId(alumnoId) {
    const result = await query(
      `SELECT m.*, ma.completada, ma.fecha_completada, ma.progreso
       FROM misiones m
       LEFT JOIN misiones_alumnos ma ON m.id = ma.mision_id AND ma.alumno_id = $1
       WHERE m.activa = true
       ORDER BY m.orden ASC, m.id ASC`,
      [alumnoId]
    );
    return result.rows;
  }
};
```

### 10.3. Misiones Predefinidas

**Archivo:** `database/seed-misiones.js`

```javascript
const misionesPredefinidas = [
  {
    codigo: 'mision_ritmo_7dias',
    nombre: 'Ritmo de 7 Días',
    descripcion: 'Practica 7 días consecutivos',
    condiciones: {
      tipo: 'streak',
      valor: 7
    },
    recompensa: {
      logro: 'racha_7'
    }
  },
  {
    codigo: 'mision_nivel_5',
    nombre: 'Alcanza el Nivel 5',
    descripcion: 'Llega al nivel 5 en tu recorrido',
    condiciones: {
      tipo: 'nivel',
      valor: 5
    }
  }
];
```

---

## 11. LOGS AVANZADOS

### 11.1. Nueva Tabla

```sql
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_alumno ON logs(alumno_id);
CREATE INDEX idx_logs_tipo ON logs(tipo);
CREATE INDEX idx_logs_fecha ON logs(fecha);
```

### 11.2. Servicio de Logs

**Archivo:** `src/services/logs.js`

```javascript
import { query } from '../../database/pg.js';

export const logs = {
  async registrar(tipo, mensaje, alumnoId = null, metadata = {}) {
    await query(
      `INSERT INTO logs (alumno_id, tipo, mensaje, metadata)
       VALUES ($1, $2, $3, $4)`,
      [alumnoId, tipo, mensaje, JSON.stringify(metadata)]
    );
  },

  async getByAlumnoId(alumnoId, tipo = null, limit = 100) {
    let where = ['alumno_id = $1'];
    let params = [alumnoId];
    
    if (tipo) {
      where.push('tipo = $2');
      params.push(tipo);
    }

    const result = await query(
      `SELECT * FROM logs 
       WHERE ${where.join(' AND ')} 
       ORDER BY fecha DESC 
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    return result.rows;
  }
};
```

---

## 12. MODO MAESTRO (VISTA TOTAL DEL ALUMNO)

### 12.1. Endpoint Admin

**Archivo:** `src/endpoints/admin-panel-maestro.js`

**Funcionalidades:**
- Estadísticas completas del alumno
- Gráfico energético (últimos 30 días)
- Emociones recientes
- Recomendaciones IA (local con Ollama)
- Próximos pasos sugeridos
- Sugerencias de prácticas
- Misiones recomendadas

### 12.2. Integración con Ollama

**Archivo:** `src/services/ollama.js`

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const ollama = {
  /**
   * Analizar emoción de un texto
   */
  async analizarEmocion(texto) {
    const prompt = `Analiza el sentimiento del siguiente texto y responde SOLO con un número del 1 al 10, donde 1 es muy negativo y 10 es muy positivo:

${texto}

Respuesta (solo el número):`;

    try {
      const { stdout } = await execAsync(
        `ollama run llama3:latest "${prompt}"`
      );
      
      const emocion = parseInt(stdout.trim());
      return Math.max(1, Math.min(10, emocion || 5));
    } catch (error) {
      console.error('Error analizando emoción:', error);
      return 5; // Valor por defecto
    }
  },

  /**
   * Generar recomendaciones para un alumno
   */
  async generarRecomendaciones(datosAlumno) {
    const prompt = `Eres un mentor espiritual. Analiza estos datos de un alumno y genera recomendaciones personalizadas:

Nivel: ${datosAlumno.nivel}
Fase: ${datosAlumno.fase}
Racha: ${datosAlumno.streak} días
Energía emocional: ${datosAlumno.energia}/10
Prácticas esta semana: ${datosAlumno.practicas_semana}

Genera 3 recomendaciones breves y específicas.`;

    try {
      const { stdout } = await execAsync(
        `ollama run llama3:latest "${prompt}"`
      );
      return stdout.trim();
    } catch (error) {
      console.error('Error generando recomendaciones:', error);
      return 'Continúa con tu práctica diaria.';
    }
  }
};
```

---

## 13. PLAN DE IMPLEMENTACIÓN

### Fase 1: Fundamentos (Semanas 1-2)
1. ✅ Crear tablas de base de datos
2. ✅ Implementar endpoint `/practica/confirmar`
3. ✅ Modificar Typeform para no enviar automáticamente
4. ✅ Implementar sistema de analytics básico

### Fase 2: Gamificación (Semanas 3-4)
1. ✅ Implementar sistema de logros
2. ✅ Implementar sistema de misiones
3. ✅ Crear logros y misiones predefinidos
4. ✅ Integrar con workflow

### Fase 3: Emociones y Reflexiones (Semanas 5-6)
1. ✅ Implementar tabla y endpoints de reflexiones
2. ✅ Implementar termómetro emocional
3. ✅ Crear pantalla de reflexión opcional
4. ✅ Integrar con analytics

### Fase 4: Audio y Whisper (Semanas 7-8)
1. ✅ Instalar Whisper local
2. ✅ Implementar endpoint `/audio/whisper`
3. ✅ Integrar con Ollama para análisis de emoción
4. ✅ Crear tabla `practicas_audio`

### Fase 5: Workflow Configurable (Semanas 9-10)
1. ✅ Extender `conexiones_pantallas` con condiciones JSONB
2. ✅ Implementar motor de evaluación de condiciones
3. ✅ Modificar Admin Panel para editar condiciones
4. ✅ Testing exhaustivo

### Fase 6: Calendario y Visualizaciones (Semanas 11-12)
1. ✅ Implementar Auricalendar (Admin)
2. ✅ Implementar calendario alumno
3. ✅ Implementar Aurigraph (radar chart)
4. ✅ Crear visualizaciones en Admin Panel

### Fase 7: Modo Maestro (Semanas 13-14)
1. ✅ Implementar vista completa del alumno
2. ✅ Integrar recomendaciones IA con Ollama
3. ✅ Crear gráficos energéticos
4. ✅ Implementar sugerencias de prácticas

### Fase 8: Logs y Optimización (Semanas 15-16)
1. ✅ Implementar sistema de logs avanzados
2. ✅ Optimizar consultas SQL
3. ✅ Agregar índices necesarios
4. ✅ Testing final y documentación

---

## 14. DEPENDENCIAS Y REQUISITOS

### Software Requerido

1. **Whisper**
   ```bash
   pip install openai-whisper
   ```

2. **Ollama**
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ollama pull llama3
   ```

3. **FFmpeg**
   ```bash
   apt-get install ffmpeg
   ```

### Variables de Entorno

```env
# Whisper
WHISPER_MODEL=medium
WHISPER_LANGUAGE=es

# Ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3

# Directorios
UPLOAD_DIR=/var/www/aurelinportal/uploads/audio
```

### Recursos del Servidor

- **CPU:** Mínimo 4 cores (recomendado 8+ para Whisper)
- **RAM:** Mínimo 8GB (recomendado 16GB+)
- **Disco:** Espacio para modelos Whisper (~3GB para medium)
- **GPU:** Opcional pero recomendado para Whisper

---

## 15. CONSIDERACIONES DE SEGURIDAD

1. **Validación de archivos de audio**
   - Verificar tipo MIME
   - Limitar tamaño (máx 50MB)
   - Escanear con antivirus

2. **Rate limiting**
   - Limitar requests a `/audio/whisper` por alumno
   - Limitar requests a Ollama

3. **Sanitización**
   - Sanitizar todos los inputs
   - Validar JSONB de condiciones

4. **Permisos de archivos**
   - Directorio de uploads con permisos restrictivos
   - No ejecutar archivos subidos

---

## CONCLUSIÓN

AuriPortal V5 representa una evolución completa del sistema hacia una plataforma 100% local, autónoma y rica en funcionalidades. La implementación debe ser gradual, priorizando las funcionalidades core (prácticas, analytics) antes de avanzar a funcionalidades avanzadas (Whisper, Ollama).

**Prioridad Alta:**
- Prácticas sin Typeform
- Analytics básico
- Logros y misiones
- Workflow configurable

**Prioridad Media:**
- Reflexiones y emociones
- Calendario
- Aurigraph

**Prioridad Baja:**
- Whisper (requiere recursos significativos)
- Ollama (requiere recursos significativos)
- Modo Maestro (nice to have)

---

**Última actualización:** Diciembre 2024





