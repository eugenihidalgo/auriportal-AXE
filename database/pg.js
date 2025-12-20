// database/pg.js
// Gestor de Base de Datos PostgreSQL para AuriPortal v4 (Sovereign Edition)
// PostgreSQL es la ÚNICA fuente de verdad del sistema

import 'dotenv/config';

import pg from 'pg';
const { Pool } = pg;

// Pool de conexiones PostgreSQL
let pool = null;

/**
 * Inicializa la conexión a PostgreSQL
 * 
 * CONFIGURACIÓN CANÓNICA:
 * - Usa DATABASE_URL si existe
 * - Fallback a variables PG* (PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE, PGSSL)
 * - Fail-open y robusto
 */
export function initPostgreSQL() {
  try {
    // Configuración canónica del Pool
    // Prioridad 1: DATABASE_URL (connection string completo)
    // Prioridad 2: Variables PG* individuales
    const poolConfig = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
          max: 20, // Máximo de conexiones en el pool
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        }
      : {
          host: process.env.PGHOST || 'localhost',
          port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
          user: process.env.PGUSER || 'postgres',
          password: process.env.PGPASSWORD || '', // Asegurar que sea string, no undefined
          database: process.env.PGDATABASE || 'aurelinportal',
          ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
          max: 20, // Máximo de conexiones en el pool
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        };
    
    pool = new Pool(poolConfig);
    
    // Log informativo de arranque (una sola vez)
    console.log('[PG] Pool inicializado con',
      process.env.DATABASE_URL ? 'DATABASE_URL' : 'PG* variables'
    );

    // Test de conexión
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
      } else {
        console.log('✅ PostgreSQL conectado correctamente');
      }
    });

    // Crear tablas si no existen (async, no bloquea)
    createTables().then(() => {
      // Ejecutar migración de estandarización de columnas
      standardizeLimpiezaColumns().catch(err => {
        console.error('⚠️  Error ejecutando migración de columnas (se reintentará al usar):', err.message);
      });
      // Ejecutar migraciones pendientes
      runMigrations().catch(err => {
        console.error('⚠️  Error ejecutando migraciones (se reintentará al usar):', err.message);
      });
    }).catch(err => {
      console.error('⚠️  Error creando tablas (se reintentará al usar):', err.message);
    });
    
    return pool;
  } catch (error) {
    console.error('❌ Error inicializando PostgreSQL:', error);
    throw error;
  }
}

/**
 * Obtiene el pool de conexiones
 */
export function getPool() {
  if (!pool) {
    return initPostgreSQL();
  }
  return pool;
}

/**
 * Ejecuta una query y retorna el resultado
 */
export async function query(text, params) {
  const pool = getPool();
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('Error ejecutando query:', error);
    throw error;
  }
}

/**
 * Crea todas las tablas necesarias según la arquitectura v4
 */
export async function createTables() {
  const pool = getPool();
  
  try {
    // Tabla: alumnos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alumnos (
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
        energia_emocional INTEGER DEFAULT 5,
        tono_meditacion_id INTEGER REFERENCES tonos_meditacion(id),
        tema_preferido VARCHAR(20) DEFAULT 'light',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_alumnos_email ON alumnos(email);
      CREATE INDEX IF NOT EXISTS idx_alumnos_nivel_actual ON alumnos(nivel_actual);
      CREATE INDEX IF NOT EXISTS idx_alumnos_fecha_inscripcion ON alumnos(fecha_inscripcion);
      CREATE INDEX IF NOT EXISTS idx_alumnos_estado_suscripcion ON alumnos(estado_suscripcion);
    `);
    
    // Añadir columna energia_emocional si no existe (migración)
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alumnos' AND column_name = 'energia_emocional'
        ) THEN
          ALTER TABLE alumnos ADD COLUMN energia_emocional INTEGER DEFAULT 5;
        END IF;
      END $$;
    `);
    
    // Añadir columna tono_meditacion_id si no existe (migración)
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alumnos' AND column_name = 'tono_meditacion_id'
        ) THEN
          -- Verificar que la tabla tonos_meditacion existe antes de agregar la foreign key
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tonos_meditacion') THEN
            ALTER TABLE alumnos ADD COLUMN tono_meditacion_id INTEGER REFERENCES tonos_meditacion(id);
          ELSE
            ALTER TABLE alumnos ADD COLUMN tono_meditacion_id INTEGER;
          END IF;
        END IF;
      END $$;
    `);

    // Tabla: pausas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pausas (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        inicio TIMESTAMP NOT NULL,
        fin TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_pausas_alumno_id ON pausas(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_pausas_inicio ON pausas(inicio);
    `);

    // Tabla: practicas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS practicas (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        fecha TIMESTAMP NOT NULL,
        tipo VARCHAR(100),
        origen VARCHAR(100),
        duracion INTEGER,
        aspecto_id INTEGER REFERENCES aspectos_practica(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_practicas_alumno_id ON practicas(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_practicas_fecha ON practicas(fecha);
      CREATE INDEX IF NOT EXISTS idx_practicas_aspecto_id ON practicas(aspecto_id);
    `);
    
    // Añadir columna aspecto_id si no existe (migración)
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'practicas' AND column_name = 'aspecto_id'
        ) THEN
          ALTER TABLE practicas ADD COLUMN aspecto_id INTEGER REFERENCES aspectos_practica(id) ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_practicas_aspecto_id ON practicas(aspecto_id);
        END IF;
      END $$;
    `);

    // Tabla: frases_nivel
    await pool.query(`
      CREATE TABLE IF NOT EXISTS frases_nivel (
        id SERIAL PRIMARY KEY,
        nivel INTEGER NOT NULL,
        frase TEXT NOT NULL,
        clickup_task_id VARCHAR(255) UNIQUE,
        origen VARCHAR(50) DEFAULT 'clickup',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_frases_nivel_nivel ON frases_nivel(nivel);
      CREATE INDEX IF NOT EXISTS idx_frases_nivel_clickup_task_id ON frases_nivel(clickup_task_id);
    `);

    // Tabla: niveles_fases
    await pool.query(`
      CREATE TABLE IF NOT EXISTS niveles_fases (
        id SERIAL PRIMARY KEY,
        fase VARCHAR(100) NOT NULL,
        nivel_min INTEGER,
        nivel_max INTEGER,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_niveles_fases_nivel_min ON niveles_fases(nivel_min);
      CREATE INDEX IF NOT EXISTS idx_niveles_fases_nivel_max ON niveles_fases(nivel_max);
    `);

    // Insertar datos iniciales de niveles_fases si no existen
    // Usar INSERT con verificación manual porque no hay UNIQUE constraint
    const fasesExistentes = await pool.query('SELECT COUNT(*) FROM niveles_fases');
    if (parseInt(fasesExistentes.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO niveles_fases (fase, nivel_min, nivel_max, descripcion)
        VALUES 
          ('sanación', 1, 6, 'Fase de sanación inicial'),
          ('sanación avanzada', 7, 9, 'Fase de sanación avanzada'),
          ('canalización', 10, 15, 'Fase de canalización'),
          ('creación', NULL, NULL, 'Fase de creación'),
          ('servicio', NULL, NULL, 'Fase de servicio');
      `);
    }

    // Tabla: racha_fases (fases de racha según días consecutivos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS racha_fases (
        id SERIAL PRIMARY KEY,
        fase VARCHAR(255) NOT NULL,
        dias_min INTEGER,
        dias_max INTEGER,
        descripcion TEXT,
        orden INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_racha_fases_dias_min ON racha_fases(dias_min);
      CREATE INDEX IF NOT EXISTS idx_racha_fases_dias_max ON racha_fases(dias_max);
      CREATE INDEX IF NOT EXISTS idx_racha_fases_orden ON racha_fases(orden);
    `);

    // Tabla: nivel_overrides (overrides del Master para ajustes manuales auditables)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nivel_overrides (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
        student_email VARCHAR(255),
        type VARCHAR(10) NOT NULL CHECK (type IN ('ADD', 'SET', 'MIN')),
        value INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_by VARCHAR(255) DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP,
        revoked_by VARCHAR(255)
      );
      
      CREATE INDEX IF NOT EXISTS idx_nivel_overrides_student_id ON nivel_overrides(student_id);
      CREATE INDEX IF NOT EXISTS idx_nivel_overrides_student_email ON nivel_overrides(student_email);
      CREATE INDEX IF NOT EXISTS idx_nivel_overrides_revoked_at ON nivel_overrides(revoked_at);
      CREATE INDEX IF NOT EXISTS idx_nivel_overrides_created_at ON nivel_overrides(created_at);
    `);

    // Tabla: student_progress_snapshot (snapshots de progreso del alumno)
    // REGLA: El snapshot es DERIVADO, no fuente de verdad. computeProgress() siempre gana.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_progress_snapshot (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        nivel_base INTEGER NOT NULL,
        nivel_efectivo INTEGER NOT NULL,
        fase_id VARCHAR(100) NOT NULL,
        fase_nombre VARCHAR(255) NOT NULL,
        dias_activos INTEGER NOT NULL DEFAULT 0,
        dias_pausados INTEGER NOT NULL DEFAULT 0,
        snapshot_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_progress_snapshot_student_id ON student_progress_snapshot(student_id);
      CREATE INDEX IF NOT EXISTS idx_progress_snapshot_snapshot_at ON student_progress_snapshot(snapshot_at);
      CREATE INDEX IF NOT EXISTS idx_progress_snapshot_student_snapshot ON student_progress_snapshot(student_id, snapshot_at DESC);
    `);

    // Insertar datos iniciales de racha_fases si no existen
    const rachaFasesExistentes = await pool.query('SELECT COUNT(*) FROM racha_fases');
    if (parseInt(rachaFasesExistentes.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO racha_fases (fase, dias_min, dias_max, descripcion, orden)
        VALUES 
          ('Iniciando', 1, 6, 'Fase inicial de racha', 1),
          ('Constante', 7, 13, 'Racha constante', 2),
          ('Comprometido', 14, 20, 'Racha comprometida', 3),
          ('Dedicado', 21, 30, 'Racha dedicada', 4),
          ('Maestro', 31, NULL, 'Racha de maestro', 5);
      `);
    }

    // Tabla: respuestas (histórico de respuestas de Typeform)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS respuestas (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        apodo VARCHAR(255),
        respuesta TEXT NOT NULL,
        nivel_practica INTEGER,
        form_id VARCHAR(255),
        form_title VARCHAR(255),
        submitted_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_respuestas_alumno_id ON respuestas(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_respuestas_email ON respuestas(email);
      CREATE INDEX IF NOT EXISTS idx_respuestas_nivel_practica ON respuestas(nivel_practica);
      CREATE INDEX IF NOT EXISTS idx_respuestas_submitted_at ON respuestas(submitted_at);
    `);

    // Tabla: aspectos_practica (configuración de aspectos/practicas)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aspectos_practica (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL UNIQUE,
        webhook_typeform VARCHAR(255),
        recomendado_iniciarse INTEGER DEFAULT 1,
        recomendado_conocer INTEGER DEFAULT 5,
        recomendado_dominio INTEGER DEFAULT 10,
        descripcion TEXT,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_aspectos_practica_nombre ON aspectos_practica(nombre);
      CREATE INDEX IF NOT EXISTS idx_aspectos_practica_activo ON aspectos_practica(activo);
    `);

    // Tabla: progreso_pedagogico (progreso de cada alumno en cada aspecto)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS progreso_pedagogico (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        aspecto_id INTEGER NOT NULL REFERENCES aspectos_practica(id) ON DELETE CASCADE,
        contador_alumno INTEGER DEFAULT 0,
        recomendacion_master_iniciarse INTEGER,
        recomendacion_master_conocer INTEGER,
        recomendacion_master_dominio INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(alumno_id, aspecto_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_progreso_alumno_id ON progreso_pedagogico(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_progreso_aspecto_id ON progreso_pedagogico(aspecto_id);
    `);

    // Tabla: analytics_eventos (sistema de analytics centralizado)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_eventos (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
        tipo_evento TEXT NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_analytics_eventos_alumno ON analytics_eventos(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_eventos_tipo ON analytics_eventos(tipo_evento);
      CREATE INDEX IF NOT EXISTS idx_analytics_eventos_fecha ON analytics_eventos(fecha);
    `);

    // Tabla: analytics_resumen_diario (resúmenes diarios para dashboard)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_resumen_diario (
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
      
      CREATE INDEX IF NOT EXISTS idx_analytics_resumen_fecha ON analytics_resumen_diario(fecha);
    `);

    // ============================================
    // TABLAS AURIPORTAL V5
    // ============================================

    // Tabla: reflexiones (reflexiones del alumno después de prácticas)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reflexiones (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        texto TEXT NOT NULL,
        energia_emocional INTEGER,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_reflexiones_alumno_id ON reflexiones(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_reflexiones_fecha ON reflexiones(fecha);
      CREATE INDEX IF NOT EXISTS idx_reflexiones_energia_emocional ON reflexiones(energia_emocional);
    `);

    // Tabla: practicas_audio (audios transcritos con Whisper)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS practicas_audio (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        transcripcion TEXT,
        emocion INTEGER,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_practicas_audio_alumno_id ON practicas_audio(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_practicas_audio_fecha ON practicas_audio(fecha);
      CREATE INDEX IF NOT EXISTS idx_practicas_audio_emocion ON practicas_audio(emocion);
    `);

    // Tabla: misiones (definición de misiones)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS misiones (
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
      
      CREATE INDEX IF NOT EXISTS idx_misiones_codigo ON misiones(codigo);
      CREATE INDEX IF NOT EXISTS idx_misiones_activo ON misiones(activo);
    `);

    // Tabla: misiones_alumnos (progreso de misiones por alumno)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS misiones_alumnos (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        mision_id INTEGER NOT NULL REFERENCES misiones(id) ON DELETE CASCADE,
        completada BOOLEAN DEFAULT false,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(alumno_id, mision_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_misiones_alumnos_alumno_id ON misiones_alumnos(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_misiones_alumnos_mision_id ON misiones_alumnos(mision_id);
      CREATE INDEX IF NOT EXISTS idx_misiones_alumnos_completada ON misiones_alumnos(completada);
    `);

    // Tabla: logros_definicion (definición de logros/insignias)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logros_definicion (
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
      
      CREATE INDEX IF NOT EXISTS idx_logros_definicion_codigo ON logros_definicion(codigo);
      CREATE INDEX IF NOT EXISTS idx_logros_definicion_activo ON logros_definicion(activo);
    `);

    // Tabla: logros (logros obtenidos por alumnos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logros (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        codigo VARCHAR(100) NOT NULL REFERENCES logros_definicion(codigo) ON DELETE CASCADE,
        fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(alumno_id, codigo)
      );
      
      CREATE INDEX IF NOT EXISTS idx_logros_alumno_id ON logros(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_logros_codigo ON logros(codigo);
      CREATE INDEX IF NOT EXISTS idx_logros_fecha ON logros(fecha);
    `);

    console.log('✅ Tablas PostgreSQL creadas/verificadas correctamente (incluyendo V5)');

    // ============================================
    // AURIPORTAL V6: SISTEMA DE MÓDULOS
    // ============================================
    
    // Tabla: modulos_sistema (gestión ON/BETA/OFF de módulos)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS modulos_sistema (
        id SERIAL PRIMARY KEY,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        estado TEXT NOT NULL DEFAULT 'off',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_estado CHECK (estado IN ('off', 'beta', 'on'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_modulos_sistema_codigo ON modulos_sistema(codigo);
      CREATE INDEX IF NOT EXISTS idx_modulos_sistema_estado ON modulos_sistema(estado);
    `);

    // Insertar módulos V6 por defecto (todos en OFF inicialmente)
    await pool.query(`
      INSERT INTO modulos_sistema (codigo, nombre, descripcion, estado) VALUES
        ('auribosses', 'Auribosses', 'Retos de ascenso de nivel', 'off'),
        ('arquetipos', 'Arquetipos Dinámicos', 'Sistema de arquetipos basado en comportamiento', 'off'),
        ('informe_semanal', 'Informe Semanal', 'Informes automáticos semanales', 'off'),
        ('practicas_sorpresa', 'Prácticas Sorpresa', 'Recomendaciones inteligentes de prácticas', 'off'),
        ('modo_historia', 'Modo Historia', 'Narrativa por niveles', 'off'),
        ('avatar_aurelin', 'Evolución Avatar', 'Evolución visual del avatar Aurelín', 'off'),
        ('aurimapa', 'Aurimapa', 'Mapa interior del alumno', 'off'),
        ('auriquest', 'AuriQuest', 'Viajes guiados de varios días', 'off'),
        ('token_auri', 'Token AURI', 'Sistema de tokens (beta)', 'off'),
        ('aspectos_energeticos', 'Anatomía Energética', 'Biblioteca y gestión de aspectos a limpiar', 'beta'),
        ('mod_registros_karmicos', 'Registros y Karmas', 'Limpiezas y procesos kármicos', 'beta'),
        ('mod_energias_indeseables', 'Energías Indeseables', 'Impurezas y densidades', 'beta')
      ON CONFLICT (codigo) DO NOTHING;
    `);

    console.log('✅ Tablas V6 y módulos del sistema creados/verificados');

    // ============================================
    // AGREGAR COLUMNA NIVEL A ASPECTOS TABLES
    // ============================================
    // Aspectos Energéticos
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_energeticos' AND column_name='nivel_minimo') THEN
            ALTER TABLE aspectos_energeticos ADD COLUMN nivel_minimo INT DEFAULT 1;
            CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_nivel ON aspectos_energeticos(nivel_minimo);
          END IF;
        END $$;
      `);
      console.log('✅ Columna nivel_minimo agregada/verificada en aspectos_energeticos');
    } catch (error) {
      console.error('⚠️ Error agregando nivel_minimo a aspectos_energeticos:', error.message);
    }

    // Aspectos Kármicos
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_karmicos' AND column_name='nivel_minimo') THEN
            ALTER TABLE aspectos_karmicos ADD COLUMN nivel_minimo INT DEFAULT 1;
            CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_nivel ON aspectos_karmicos(nivel_minimo);
          END IF;
        END $$;
      `);
      console.log('✅ Columna nivel_minimo agregada/verificada en aspectos_karmicos');
    } catch (error) {
      console.error('⚠️ Error agregando nivel_minimo a aspectos_karmicos:', error.message);
    }

    // Aspectos Indeseables
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_indeseables' AND column_name='nivel_minimo') THEN
            ALTER TABLE aspectos_indeseables ADD COLUMN nivel_minimo INT DEFAULT 1;
            CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_nivel ON aspectos_indeseables(nivel_minimo);
          END IF;
        END $$;
      `);
      console.log('✅ Columna nivel_minimo agregada/verificada en aspectos_indeseables');
    } catch (error) {
      console.error('⚠️ Error agregando nivel_minimo a aspectos_indeseables:', error.message);
    }

    // ============================================
    // TRANSMUTACIONES PDE (Lugares, Proyectos, Apadrinados)
    // ============================================
    try {
      // Tabla: transmutaciones_lugares
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transmutaciones_lugares (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(200) NOT NULL,
          descripcion TEXT,
            nivel_minimo INT DEFAULT 1,
            frecuencia_dias INT DEFAULT 30,
            prioridad VARCHAR(50) DEFAULT 'Normal',
            alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          orden INT DEFAULT 0,
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_activo ON transmutaciones_lugares(activo);
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_nivel ON transmutaciones_lugares(nivel_minimo);
      `);

      // Tabla: transmutaciones_lugares_estado
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transmutaciones_lugares_estado (
          id SERIAL PRIMARY KEY,
          lugar_id INT REFERENCES transmutaciones_lugares(id) ON DELETE CASCADE,
          alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          estado VARCHAR(50) DEFAULT 'pendiente',
          ultima_limpieza TIMESTAMP,
          veces_limpiado INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (lugar_id, alumno_id)
        );
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_estado_lugar ON transmutaciones_lugares_estado(lugar_id);
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_estado_alumno ON transmutaciones_lugares_estado(alumno_id);
      `);

      // Tabla: transmutaciones_proyectos
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transmutaciones_proyectos (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(200) NOT NULL,
          descripcion TEXT,
          nivel_minimo INT DEFAULT 1,
          frecuencia_dias INT DEFAULT 30,
          prioridad VARCHAR(50) DEFAULT 'Normal',
          orden INT DEFAULT 0,
          activo BOOLEAN DEFAULT TRUE,
          alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_activo ON transmutaciones_proyectos(activo);
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_nivel ON transmutaciones_proyectos(nivel_minimo);
      `);
      
      // Agregar columna alumno_id si no existe (para tablas creadas antes)
      try {
        await pool.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'transmutaciones_proyectos' 
              AND column_name = 'alumno_id'
            ) THEN
              ALTER TABLE transmutaciones_proyectos 
              ADD COLUMN alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE;
            END IF;
          END $$;
        `);
      } catch (alterError) {
        console.log('⚠️ Error verificando/agregando columna alumno_id a transmutaciones_proyectos (puede que ya exista):', alterError.message);
      }

      // Tabla: transmutaciones_proyectos_estado
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transmutaciones_proyectos_estado (
          id SERIAL PRIMARY KEY,
          proyecto_id INT REFERENCES transmutaciones_proyectos(id) ON DELETE CASCADE,
          alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          estado VARCHAR(50) DEFAULT 'pendiente',
          ultima_limpieza TIMESTAMP,
          veces_limpiado INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (proyecto_id, alumno_id)
        );
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_estado_proyecto ON transmutaciones_proyectos_estado(proyecto_id);
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_estado_alumno ON transmutaciones_proyectos_estado(alumno_id);
      `);

      // Tabla: transmutaciones_apadrinados
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transmutaciones_apadrinados (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(200) NOT NULL,
          descripcion TEXT,
          nivel_minimo INT DEFAULT 1,
          frecuencia_dias INT DEFAULT 30,
          prioridad VARCHAR(50) DEFAULT 'Normal',
          orden INT DEFAULT 0,
          activo BOOLEAN DEFAULT TRUE,
          alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_activo ON transmutaciones_apadrinados(activo);
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_nivel ON transmutaciones_apadrinados(nivel_minimo);
      `);
      
      // Agregar columna alumno_id si no existe (para tablas creadas antes)
      try {
        await pool.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'transmutaciones_apadrinados' 
              AND column_name = 'alumno_id'
            ) THEN
              ALTER TABLE transmutaciones_apadrinados 
              ADD COLUMN alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE;
            END IF;
          END $$;
        `);
      } catch (alterError) {
        console.log('⚠️ Error verificando/agregando columna alumno_id (puede que ya exista):', alterError.message);
      }

      // Tabla: transmutaciones_apadrinados_estado
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transmutaciones_apadrinados_estado (
          id SERIAL PRIMARY KEY,
          apadrinado_id INT REFERENCES transmutaciones_apadrinados(id) ON DELETE CASCADE,
          alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          estado VARCHAR(50) DEFAULT 'pendiente',
          ultima_limpieza TIMESTAMP,
          veces_limpiado INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (apadrinado_id, alumno_id)
        );
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_estado_apadrinado ON transmutaciones_apadrinados_estado(apadrinado_id);
        CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_estado_alumno ON transmutaciones_apadrinados_estado(alumno_id);
      `);

      console.log('✅ Tablas de Transmutaciones PDE creadas/verificadas');
    } catch (error) {
      console.error('⚠️ Error creando tablas de Transmutaciones PDE:', error.message);
    }

    // ============================================
    // HISTORIAL DE LIMPIEZAS DEL MASTER
    // ============================================
    try {
      // Tabla: limpiezas_master_historial
      await pool.query(`
        CREATE TABLE IF NOT EXISTS limpiezas_master_historial (
          id SERIAL PRIMARY KEY,
          alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          tipo VARCHAR(50) NOT NULL,
          aspecto_id INT NOT NULL,
          aspecto_nombre VARCHAR(500),
          seccion VARCHAR(100),
          fecha_limpieza TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_alumno ON limpiezas_master_historial(alumno_id);
        CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_fecha ON limpiezas_master_historial(fecha_limpieza);
        CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_tipo ON limpiezas_master_historial(tipo);
      `);
      console.log('✅ Tabla de historial de limpiezas del master creada/verificada');
    } catch (error) {
      console.error('⚠️ Error creando tabla de historial de limpiezas del master:', error.message);
    }

    // ============================================
    // LIMPIEZA DE HOGAR
    // ============================================
    try {
      // Tabla: limpieza_hogar
      await pool.query(`
        CREATE TABLE IF NOT EXISTS limpieza_hogar (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(200) NOT NULL,
          descripcion TEXT,
          nivel_minimo INT DEFAULT 1,
          frecuencia_dias INT DEFAULT 14,
          prioridad INT DEFAULT 3,
          orden INT DEFAULT 0,
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_activo ON limpieza_hogar(activo);
        CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_nivel ON limpieza_hogar(nivel_minimo);
      `);

      // Tabla: limpieza_hogar_alumnos
      await pool.query(`
        CREATE TABLE IF NOT EXISTS limpieza_hogar_alumnos (
          id SERIAL PRIMARY KEY,
          alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          aspecto_id INT REFERENCES limpieza_hogar(id) ON DELETE CASCADE,
          estado VARCHAR(50) DEFAULT 'pendiente',
          fecha_ultima_limpieza TIMESTAMP,
          veces_limpiado INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (alumno_id, aspecto_id)
        );
        CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_alumnos_alumno ON limpieza_hogar_alumnos(alumno_id);
        CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_alumnos_aspecto ON limpieza_hogar_alumnos(aspecto_id);
      `);

      console.log('✅ Tablas de Limpieza de Hogar creadas/verificadas');
    } catch (error) {
      console.error('⚠️ Error creando tablas de Limpieza de Hogar:', error.message);
    }

    // ============================================
    // SISTEMA DE TRANSCRIPCIONES WHISPER
    // ============================================
    
    // Tabla: whisper_transcripciones (historial de transcripciones)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whisper_transcripciones (
        id SERIAL PRIMARY KEY,
        archivo_id TEXT NOT NULL,
        archivo_nombre TEXT NOT NULL,
        carpeta_audio_id TEXT NOT NULL,
        carpeta_transcripcion_id TEXT NOT NULL,
        carpeta_procesados_id TEXT NOT NULL,
        modelo_usado TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        transcripcion_id TEXT,
        error_message TEXT,
        duracion_segundos INTEGER,
        tamaño_archivo_mb NUMERIC(10,2),
        progreso_porcentaje INTEGER DEFAULT 0,
        tiempo_estimado_restante INTEGER,
        fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_fin TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_whisper_transcripciones_estado ON whisper_transcripciones(estado);
      CREATE INDEX IF NOT EXISTS idx_whisper_transcripciones_fecha ON whisper_transcripciones(fecha_inicio);
      CREATE INDEX IF NOT EXISTS idx_whisper_transcripciones_archivo_id ON whisper_transcripciones(archivo_id);
    `);

    // Tabla: whisper_control (control de pausar/activar)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whisper_control (
        id SERIAL PRIMARY KEY,
        activo BOOLEAN DEFAULT true,
        ultima_ejecucion TIMESTAMP,
        proxima_ejecucion TIMESTAMP,
        total_procesados INTEGER DEFAULT 0,
        total_exitosos INTEGER DEFAULT 0,
        total_fallidos INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insertar registro inicial de control si no existe
    await pool.query(`
      INSERT INTO whisper_control (activo) 
      SELECT true 
      WHERE NOT EXISTS (SELECT 1 FROM whisper_control);
    `);

    console.log('✅ Tablas de transcripciones Whisper creadas/verificadas');

    // ============================================
    // REGISTROS Y KARMAS - NUEVAS TABLAS
    // ============================================
    try {
      // Tabla: aspectos_karmicos (biblioteca de registros kármicos)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aspectos_karmicos (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(200) NOT NULL,
          frecuencia_dias INT DEFAULT 14,
          prioridad VARCHAR(50) DEFAULT 'Normal',
          orden INT DEFAULT 0,
          nivel_minimo INT DEFAULT 1,
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Agregar columna nivel si no existe
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_karmicos' AND column_name='nivel_minimo') THEN
            ALTER TABLE aspectos_karmicos ADD COLUMN nivel_minimo INT DEFAULT 1;
            CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_nivel ON aspectos_karmicos(nivel_minimo);
          END IF;
        END $$;
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_activo ON aspectos_karmicos(activo)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_orden ON aspectos_karmicos(orden)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_nivel ON aspectos_karmicos(nivel_minimo)`);

      // Tabla: aspectos_karmicos_alumnos (estado por alumno)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aspectos_karmicos_alumnos (
          id SERIAL PRIMARY KEY,
          alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          aspecto_id INT REFERENCES aspectos_karmicos(id) ON DELETE CASCADE,
          estado VARCHAR(50) DEFAULT 'pendiente',
          ultima_limpieza TIMESTAMP,
          proxima_limpieza TIMESTAMP,
          UNIQUE (alumno_id, aspecto_id)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_alumnos_alumno ON aspectos_karmicos_alumnos(alumno_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_alumnos_aspecto ON aspectos_karmicos_alumnos(aspecto_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_karmicos_alumnos_estado ON aspectos_karmicos_alumnos(estado)`);

      console.log('✅ Tablas de Registros y Karmas creadas/verificadas');
    } catch (error) {
      console.error('⚠️ Error creando tablas de Registros y Karmas:', error.message);
    }

    // ============================================
    // ENERGÍAS INDESEABLES - NUEVAS TABLAS
    // ============================================
    try {
      // Tabla: aspectos_indeseables (biblioteca de energías indeseables)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aspectos_indeseables (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(200) NOT NULL,
          frecuencia_dias INT DEFAULT 14,
          prioridad VARCHAR(50) DEFAULT 'Normal',
          orden INT DEFAULT 0,
          nivel_minimo INT DEFAULT 1,
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Agregar columna nivel si no existe
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_indeseables' AND column_name='nivel_minimo') THEN
            ALTER TABLE aspectos_indeseables ADD COLUMN nivel_minimo INT DEFAULT 1;
            CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_nivel ON aspectos_indeseables(nivel_minimo);
          END IF;
        END $$;
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_activo ON aspectos_indeseables(activo)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_orden ON aspectos_indeseables(orden)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_nivel ON aspectos_indeseables(nivel_minimo)`);

      // Tabla: aspectos_indeseables_alumnos (estado por alumno)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aspectos_indeseables_alumnos (
          id SERIAL PRIMARY KEY,
          alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
          aspecto_id INT REFERENCES aspectos_indeseables(id) ON DELETE CASCADE,
          estado VARCHAR(50) DEFAULT 'pendiente',
          ultima_limpieza TIMESTAMP,
          proxima_limpieza TIMESTAMP,
          veces_limpiado INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (alumno_id, aspecto_id)
        )
      `);
      // Agregar columnas si no existen (migración)
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aspectos_indeseables_alumnos' AND column_name = 'veces_limpiado') THEN
            ALTER TABLE aspectos_indeseables_alumnos ADD COLUMN veces_limpiado INTEGER DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aspectos_indeseables_alumnos' AND column_name = 'created_at') THEN
            ALTER TABLE aspectos_indeseables_alumnos ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aspectos_indeseables_alumnos' AND column_name = 'updated_at') THEN
            ALTER TABLE aspectos_indeseables_alumnos ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          END IF;
        END $$;
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_alumnos_alumno ON aspectos_indeseables_alumnos(alumno_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_alumnos_aspecto ON aspectos_indeseables_alumnos(aspecto_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_alumnos_estado ON aspectos_indeseables_alumnos(estado)`);

      console.log('✅ Tablas de Energías Indeseables creadas/verificadas');
    } catch (error) {
      console.error('⚠️ Error creando tablas de Energías Indeseables:', error.message);
    }

    // ============================================
    // SECCIONES DE LIMPIEZA (NUEVO SISTEMA)
    // ============================================
    try {
      // Tabla: secciones_limpieza (gestión de pestañas/secciones)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS secciones_limpieza (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(200) NOT NULL,
          tipo_limpieza VARCHAR(20) DEFAULT 'regular',
          activo BOOLEAN DEFAULT TRUE,
          orden INTEGER DEFAULT 0,
          botones_mostrar JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_tipo_limpieza CHECK (tipo_limpieza IN ('regular', 'una_vez'))
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_secciones_limpieza_activo ON secciones_limpieza(activo)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_secciones_limpieza_orden ON secciones_limpieza(orden)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_secciones_limpieza_tipo ON secciones_limpieza(tipo_limpieza)`);

      // Añadir columna icono si no existe
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='secciones_limpieza' AND column_name='icono') THEN
            ALTER TABLE secciones_limpieza ADD COLUMN icono VARCHAR(10) DEFAULT '🧹';
          END IF;
        END $$;
      `);

      console.log('✅ Tabla de Secciones de Limpieza creada/verificada');
    } catch (error) {
      console.error('⚠️ Error creando tabla de Secciones de Limpieza:', error.message);
    }

    // ============================================
    // MODIFICACIONES A ASPECTOS_ENERGETICOS
    // ============================================
    try {
      // Añadir campos nuevos a aspectos_energeticos
      await pool.query(`
        DO $$
        BEGIN
          -- Añadir tipo_limpieza
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_energeticos' AND column_name='tipo_limpieza') THEN
            ALTER TABLE aspectos_energeticos ADD COLUMN tipo_limpieza VARCHAR(20) DEFAULT 'regular';
            ALTER TABLE aspectos_energeticos ADD CONSTRAINT check_tipo_limpieza_aspecto CHECK (tipo_limpieza IN ('regular', 'una_vez'));
          END IF;
          
          -- Añadir cantidad_minima
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_energeticos' AND column_name='cantidad_minima') THEN
            ALTER TABLE aspectos_energeticos ADD COLUMN cantidad_minima INTEGER DEFAULT NULL;
          END IF;
          
          -- Añadir descripcion_corta
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_energeticos' AND column_name='descripcion_corta') THEN
            ALTER TABLE aspectos_energeticos ADD COLUMN descripcion_corta TEXT;
          END IF;
          
          -- Añadir seccion_id
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_energeticos' AND column_name='seccion_id') THEN
            ALTER TABLE aspectos_energeticos ADD COLUMN seccion_id INTEGER REFERENCES secciones_limpieza(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_aspectos_energeticos_seccion ON aspectos_energeticos(seccion_id);
          END IF;
        END $$;
      `);

      console.log('✅ Campos nuevos añadidos/verificados en aspectos_energeticos');
    } catch (error) {
      console.error('⚠️ Error añadiendo campos a aspectos_energeticos:', error.message);
    }

    // ============================================
    // MODIFICACIONES A ASPECTOS_ENERGETICOS_ALUMNOS
    // ============================================
    try {
      // Añadir campos nuevos a aspectos_energeticos_alumnos
      await pool.query(`
        DO $$
        BEGIN
          -- Añadir cantidad_requerida
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_energeticos_alumnos' AND column_name='cantidad_requerida') THEN
            ALTER TABLE aspectos_energeticos_alumnos ADD COLUMN cantidad_requerida INTEGER DEFAULT NULL;
          END IF;
          
          -- Añadir cantidad_completada
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_energeticos_alumnos' AND column_name='cantidad_completada') THEN
            ALTER TABLE aspectos_energeticos_alumnos ADD COLUMN cantidad_completada INTEGER DEFAULT 0;
          END IF;
          
          -- Añadir completado_permanentemente
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aspectos_energeticos_alumnos' AND column_name='completado_permanentemente') THEN
            ALTER TABLE aspectos_energeticos_alumnos ADD COLUMN completado_permanentemente BOOLEAN DEFAULT FALSE;
          END IF;
        END $$;
      `);

      console.log('✅ Campos nuevos añadidos/verificados en aspectos_energeticos_alumnos');
    } catch (error) {
      console.error('⚠️ Error añadiendo campos a aspectos_energeticos_alumnos:', error.message);
    }

    // ============================================
    // I+D DE LOS ALUMNOS - ASPECTOS PERSONALIZADOS
    // ============================================
    try {
      // Tabla: aspectos_personalizados (aspectos creados por los alumnos)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aspectos_personalizados (
          id SERIAL PRIMARY KEY,
          alumno_id INT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
          nombre VARCHAR(200) NOT NULL,
          descripcion TEXT,
          frecuencia_dias INT DEFAULT 14,
          prioridad VARCHAR(50) DEFAULT 'Normal',
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_personalizados_alumno ON aspectos_personalizados(alumno_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_personalizados_activo ON aspectos_personalizados(activo)`);

      // Tabla: aspectos_personalizados_estado (estado de limpieza)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aspectos_personalizados_estado (
          id SERIAL PRIMARY KEY,
          alumno_id INT NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
          aspecto_id INT NOT NULL REFERENCES aspectos_personalizados(id) ON DELETE CASCADE,
          estado VARCHAR(50) DEFAULT 'pendiente',
          ultima_limpieza TIMESTAMP,
          proxima_limpieza TIMESTAMP,
          UNIQUE (alumno_id, aspecto_id)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_personalizados_estado_alumno ON aspectos_personalizados_estado(alumno_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aspectos_personalizados_estado_aspecto ON aspectos_personalizados_estado(aspecto_id)`);

      console.log('✅ Tablas de I+D de los alumnos creadas/verificadas');
    } catch (error) {
      console.error('⚠️ Error creando tablas de I+D de los alumnos:', error.message);
    }

    // ============================================
    // FAVORITOS DEL ADMIN
    // ============================================
    
    // Tabla: admin_favoritos (favoritos configurados por el administrador)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_favoritos (
        id SERIAL PRIMARY KEY,
        ruta VARCHAR(255) NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        icono VARCHAR(50),
        orden INT DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_admin_favoritos_activo ON admin_favoritos(activo);
      CREATE INDEX IF NOT EXISTS idx_admin_favoritos_orden ON admin_favoritos(orden);
    `);

    console.log('✅ Tabla de favoritos del admin creada/verificada');

    // Tabla: alumnos_lugares (lugares creados por los alumnos)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS alumnos_lugares (
          id SERIAL PRIMARY KEY,
          alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          activo BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(alumno_id, nombre)
        );
        
        CREATE INDEX IF NOT EXISTS idx_alumnos_lugares_alumno ON alumnos_lugares(alumno_id);
        CREATE INDEX IF NOT EXISTS idx_alumnos_lugares_activo ON alumnos_lugares(activo);
      `);

      console.log('✅ Tabla alumnos_lugares creada/verificada');
    } catch (error) {
      console.error('❌ Error creando tabla alumnos_lugares:', error.message);
      // Continuar con otras tablas aunque esta falle
    }

    // Tabla: alumnos_proyectos (proyectos creados por los alumnos)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS alumnos_proyectos (
          id SERIAL PRIMARY KEY,
          alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          activo BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(alumno_id, nombre)
        );
        
        CREATE INDEX IF NOT EXISTS idx_alumnos_proyectos_alumno ON alumnos_proyectos(alumno_id);
        CREATE INDEX IF NOT EXISTS idx_alumnos_proyectos_activo ON alumnos_proyectos(activo);
      `);

      console.log('✅ Tabla alumnos_proyectos creada/verificada');
    } catch (error) {
      console.error('❌ Error creando tabla alumnos_proyectos:', error.message);
      // Continuar con otras tablas aunque esta falle
    }

    // Tabla: comunicados_eugeni (canalizaciones/comunicados del master)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS comunicados_eugeni (
          id SERIAL PRIMARY KEY,
          alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
          mensaje TEXT NOT NULL,
          fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          creado_por VARCHAR(100) DEFAULT 'Eugeni',
          leido BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_comunicados_alumno ON comunicados_eugeni(alumno_id);
        CREATE INDEX IF NOT EXISTS idx_comunicados_fecha ON comunicados_eugeni(fecha DESC);
      `);
      console.log('✅ Tabla comunicados_eugeni creada/verificada');
    } catch (error) {
      console.error('❌ Error creando tabla comunicados_eugeni:', error.message);
    }

    // Tabla: diario_practicas (diario personal del alumno)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS diario_practicas (
          id SERIAL PRIMARY KEY,
          alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          texto_usuario TEXT,
          resumen_auto TEXT,
          contenido TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(alumno_id, fecha)
        );
        
        CREATE INDEX IF NOT EXISTS idx_diario_alumno_fecha ON diario_practicas(alumno_id, fecha DESC);
      `);
      console.log('✅ Tabla diario_practicas creada/verificada');
    } catch (error) {
      console.error('❌ Error creando tabla diario_practicas:', error.message);
    }

    // ============================================
    // SISTEMA DE TRANSMUTACIONES ENERGÉTICAS
    // ============================================
    try {
      // Tabla: listas_transmutaciones (listas de transmutaciones recurrentes o de una sola vez)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS listas_transmutaciones (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          tipo VARCHAR(20) NOT NULL DEFAULT 'recurrente',
          descripcion TEXT,
          activo BOOLEAN DEFAULT TRUE,
          orden INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_tipo_lista CHECK (tipo IN ('recurrente', 'una_vez'))
        );
        CREATE INDEX IF NOT EXISTS idx_listas_transmutaciones_tipo ON listas_transmutaciones(tipo);
        CREATE INDEX IF NOT EXISTS idx_listas_transmutaciones_activo ON listas_transmutaciones(activo);
        CREATE INDEX IF NOT EXISTS idx_listas_transmutaciones_orden ON listas_transmutaciones(orden);
      `);

      // Tabla: items_transmutaciones (ítems energéticos dentro de las listas)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS items_transmutaciones (
          id SERIAL PRIMARY KEY,
          lista_id INTEGER NOT NULL REFERENCES listas_transmutaciones(id) ON DELETE CASCADE,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          nivel INTEGER NOT NULL DEFAULT 9,
          frecuencia_dias INTEGER DEFAULT 20, -- Para listas recurrentes: días que se mantiene limpio
          veces_limpiar INTEGER DEFAULT 15, -- Para listas de una sola vez: veces que hay que limpiar
          prioridad VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo')),
          orden INTEGER DEFAULT 0,
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_lista ON items_transmutaciones(lista_id);
        CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_nivel ON items_transmutaciones(nivel);
        CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_activo ON items_transmutaciones(activo);
        CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_orden ON items_transmutaciones(orden);
      `);
      
      // Agregar columna prioridad si no existe (migración)
      try {
        // Verificar si la columna ya existe
        const colCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'items_transmutaciones' 
          AND column_name = 'prioridad'
        `);
        
        if (colCheck.rows.length === 0) {
          // La columna no existe, agregarla
          await pool.query(`
            ALTER TABLE items_transmutaciones 
            ADD COLUMN prioridad VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo'))
          `);
          
          // Actualizar registros existentes que puedan tener NULL
          await pool.query(`
            UPDATE items_transmutaciones 
            SET prioridad = 'media' 
            WHERE prioridad IS NULL
          `);
          
          console.log('✅ Columna prioridad agregada a items_transmutaciones');
        }
        
        // Verificar si el índice existe antes de crearlo
        const idxCheck = await pool.query(`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = 'items_transmutaciones' 
          AND indexname = 'idx_items_transmutaciones_prioridad'
        `);
        
        if (idxCheck.rows.length === 0) {
          await pool.query(`
            CREATE INDEX idx_items_transmutaciones_prioridad ON items_transmutaciones(prioridad)
          `);
          console.log('✅ Índice idx_items_transmutaciones_prioridad creado');
        }
      } catch (error) {
        console.error('⚠️  Error en migración de columna prioridad:', error.message);
        // No lanzar error, solo registrar
      }

      // Tabla: items_transmutaciones_alumnos (estado de cada ítem por alumno)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS items_transmutaciones_alumnos (
          id SERIAL PRIMARY KEY,
          item_id INTEGER NOT NULL REFERENCES items_transmutaciones(id) ON DELETE CASCADE,
          alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
          ultima_limpieza TIMESTAMP,
          veces_completadas INTEGER DEFAULT 0, -- Para ítems de una sola vez
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (item_id, alumno_id)
        );
        CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_alumnos_item ON items_transmutaciones_alumnos(item_id);
        CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_alumnos_alumno ON items_transmutaciones_alumnos(alumno_id);
        CREATE INDEX IF NOT EXISTS idx_items_transmutaciones_alumnos_ultima_limpieza ON items_transmutaciones_alumnos(ultima_limpieza);
      `);

      console.log('✅ Tablas de Transmutaciones Energéticas creadas/verificadas');
      
      // Tabla: tecnicas_limpieza (técnicas disponibles para realizar limpiezas)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tecnicas_limpieza (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          nivel INTEGER NOT NULL DEFAULT 1,
          orden INTEGER DEFAULT 0,
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_nivel ON tecnicas_limpieza(nivel);
        CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_activo ON tecnicas_limpieza(activo);
        CREATE INDEX IF NOT EXISTS idx_tecnicas_limpieza_orden ON tecnicas_limpieza(orden);
      `);
      
      console.log('✅ Tabla de Técnicas de Limpieza creada/verificada');
      
      // Tabla: preparaciones_practica (preparaciones para la práctica antes de limpiar)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS preparaciones_practica (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          nivel INTEGER NOT NULL DEFAULT 1,
          video_url TEXT,
          orden INTEGER DEFAULT 0,
          activo BOOLEAN DEFAULT TRUE,
          tipo VARCHAR(20) DEFAULT 'consigna',
          posicion VARCHAR(20) DEFAULT 'inicio',
          obligatoria_global BOOLEAN DEFAULT false,
          obligatoria_por_nivel JSONB DEFAULT '{}',
          minutos INT DEFAULT NULL,
          tiene_video BOOLEAN DEFAULT false,
          contenido_html TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_preparaciones_practica_nivel ON preparaciones_practica(nivel);
        CREATE INDEX IF NOT EXISTS idx_preparaciones_practica_activo ON preparaciones_practica(activo);
        CREATE INDEX IF NOT EXISTS idx_preparaciones_practica_orden ON preparaciones_practica(orden);
      `);
      
      console.log('✅ Tabla de Preparaciones para la Práctica creada/verificada');
      
      // Agregar campos de reloj a preparaciones_practica si no existen
      try {
        await pool.query(`
          DO \$\$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='preparaciones_practica' 
                          AND column_name='activar_reloj') THEN
              ALTER TABLE preparaciones_practica 
              ADD COLUMN activar_reloj BOOLEAN DEFAULT FALSE,
              ADD COLUMN musica_id INTEGER;
            END IF;
          END \$\$;
        `);
        console.log('✅ Campos de reloj agregados a preparaciones_practica');
      } catch (error) {
        console.log('⚠️ Campos de reloj ya existen o error:', error.message);
      }
      
      // Tabla: tecnicas_post_practica (técnicas post-práctica después de limpiar)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tecnicas_post_practica (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          nivel INTEGER NOT NULL DEFAULT 1,
          video_url TEXT,
          orden INTEGER DEFAULT 0,
          activo BOOLEAN DEFAULT TRUE,
          tipo VARCHAR(20) DEFAULT 'consigna',
          posicion VARCHAR(20) DEFAULT 'inicio',
          obligatoria_global BOOLEAN DEFAULT false,
          obligatoria_por_nivel JSONB DEFAULT '{}',
          minutos INT DEFAULT NULL,
          tiene_video BOOLEAN DEFAULT false,
          contenido_html TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tecnicas_post_practica_nivel ON tecnicas_post_practica(nivel);
        CREATE INDEX IF NOT EXISTS idx_tecnicas_post_practica_activo ON tecnicas_post_practica(activo);
        CREATE INDEX IF NOT EXISTS idx_tecnicas_post_practica_orden ON tecnicas_post_practica(orden);
      `);
      
      console.log('✅ Tabla de Técnicas Post-práctica creada/verificada');
      
      // Tabla: protecciones_energeticas (Categoría de contenido PDE reutilizable dentro de prácticas)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS protecciones_energeticas (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          usage_context TEXT,
          recommended_moment TEXT,
          tags JSONB DEFAULT '[]',
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT protecciones_energeticas_status_check CHECK (status IN ('active', 'archived'))
        );
        CREATE INDEX IF NOT EXISTS idx_protecciones_energeticas_key ON protecciones_energeticas(key);
        CREATE INDEX IF NOT EXISTS idx_protecciones_energeticas_status ON protecciones_energeticas(status);
      `);
      console.log('✅ Tabla de Protecciones Energéticas creada/verificada');
      
      // Agregar campos de reloj a tecnicas_post_practica si no existen
      try {
        await pool.query(`
          DO \$\$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='tecnicas_post_practica' 
                          AND column_name='activar_reloj') THEN
              ALTER TABLE tecnicas_post_practica 
              ADD COLUMN activar_reloj BOOLEAN DEFAULT FALSE,
              ADD COLUMN musica_id INTEGER;
            END IF;
          END \$\$;
        `);
        console.log('✅ Campos de reloj agregados a tecnicas_post_practica');
      } catch (error) {
        console.log('⚠️ Campos de reloj ya existen o error:', error.message);
      }
      
      // Tabla: musicas_meditacion (banco de músicas de meditación)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS musicas_meditacion (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          archivo_path TEXT,
          url_externa TEXT,
          duracion_segundos INTEGER,
          peso_mb DECIMAL(10,2),
          categoria VARCHAR(100),
          es_por_defecto BOOLEAN DEFAULT FALSE,
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_musicas_meditacion_activo ON musicas_meditacion(activo);
        CREATE INDEX IF NOT EXISTS idx_musicas_meditacion_categoria ON musicas_meditacion(categoria);
        CREATE INDEX IF NOT EXISTS idx_musicas_meditacion_por_defecto ON musicas_meditacion(es_por_defecto);
      `);
      
      // Migración: agregar columna es_por_defecto si no existe
      try {
        await pool.query(`
          ALTER TABLE musicas_meditacion 
          ADD COLUMN IF NOT EXISTS es_por_defecto BOOLEAN DEFAULT FALSE;
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_musicas_meditacion_por_defecto ON musicas_meditacion(es_por_defecto);
        `);
      } catch (error) {
        // La columna ya existe o el índice ya existe, ignorar
      }
      
      console.log('✅ Tabla de Músicas de Meditación creada/verificada');
      
      // Tabla: tonos_meditacion (banco de tonos de meditación)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tonos_meditacion (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          archivo_path TEXT,
          url_externa TEXT,
          duracion_segundos INTEGER,
          peso_mb DECIMAL(10,2),
          categoria VARCHAR(100),
          es_por_defecto BOOLEAN DEFAULT FALSE,
          activo BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tonos_meditacion_activo ON tonos_meditacion(activo);
        CREATE INDEX IF NOT EXISTS idx_tonos_meditacion_categoria ON tonos_meditacion(categoria);
        CREATE INDEX IF NOT EXISTS idx_tonos_meditacion_por_defecto ON tonos_meditacion(es_por_defecto);
      `);
      
      console.log('✅ Tabla de Tonos de Meditación creada/verificada');
    } catch (error) {
      console.error('❌ Error creando tablas de Transmutaciones Energéticas:', error.message);
    }

    // ============================================
    // FASE 1: Migraciones para expansión de prácticas
    // ============================================
    
    // A) Migración: Añadir nuevos campos a preparaciones_practica
    try {
      await pool.query(`
        DO $$
        BEGIN
          -- Añadir campo tipo
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='preparaciones_practica' AND column_name='tipo') THEN
            ALTER TABLE preparaciones_practica ADD COLUMN tipo VARCHAR(20) DEFAULT 'consigna';
          END IF;
          
          -- Añadir campo posicion
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='preparaciones_practica' AND column_name='posicion') THEN
            ALTER TABLE preparaciones_practica ADD COLUMN posicion VARCHAR(20) DEFAULT 'inicio';
          END IF;
          
          -- Añadir campo orden (ya existe, pero verificamos)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='preparaciones_practica' AND column_name='orden') THEN
            ALTER TABLE preparaciones_practica ADD COLUMN orden INT DEFAULT 0;
          END IF;
          
          -- Añadir campo obligatoria_global
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='preparaciones_practica' AND column_name='obligatoria_global') THEN
            ALTER TABLE preparaciones_practica ADD COLUMN obligatoria_global BOOLEAN DEFAULT false;
          END IF;
          
          -- Añadir campo obligatoria_por_nivel
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='preparaciones_practica' AND column_name='obligatoria_por_nivel') THEN
            ALTER TABLE preparaciones_practica ADD COLUMN obligatoria_por_nivel JSONB DEFAULT '{}';
          END IF;
          
          -- Añadir campo minutos
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='preparaciones_practica' AND column_name='minutos') THEN
            ALTER TABLE preparaciones_practica ADD COLUMN minutos INT DEFAULT NULL;
          END IF;
          
          -- Añadir campo tiene_video
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='preparaciones_practica' AND column_name='tiene_video') THEN
            ALTER TABLE preparaciones_practica ADD COLUMN tiene_video BOOLEAN DEFAULT false;
          END IF;
          
          -- Añadir campo video_url (ya existe, pero verificamos)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='preparaciones_practica' AND column_name='video_url') THEN
            ALTER TABLE preparaciones_practica ADD COLUMN video_url TEXT DEFAULT NULL;
          END IF;
          
          -- Añadir campo contenido_html
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='preparaciones_practica' AND column_name='contenido_html') THEN
            ALTER TABLE preparaciones_practica ADD COLUMN contenido_html TEXT DEFAULT NULL;
          END IF;
        END $$;
      `);
      console.log('✅ Campos nuevos añadidos/verificados en preparaciones_practica');
    } catch (error) {
      console.error('⚠️ Error añadiendo campos a preparaciones_practica:', error.message);
    }

    // B) Migración: Añadir nuevos campos a tecnicas_post_practica
    try {
      await pool.query(`
        DO $$
        BEGIN
          -- Añadir campo tipo
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='tecnicas_post_practica' AND column_name='tipo') THEN
            ALTER TABLE tecnicas_post_practica ADD COLUMN tipo VARCHAR(20) DEFAULT 'consigna';
          END IF;
          
          -- Añadir campo posicion
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='tecnicas_post_practica' AND column_name='posicion') THEN
            ALTER TABLE tecnicas_post_practica ADD COLUMN posicion VARCHAR(20) DEFAULT 'inicio';
          END IF;
          
          -- Añadir campo orden (ya existe, pero verificamos)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='tecnicas_post_practica' AND column_name='orden') THEN
            ALTER TABLE tecnicas_post_practica ADD COLUMN orden INT DEFAULT 0;
          END IF;
          
          -- Añadir campo obligatoria_global
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='tecnicas_post_practica' AND column_name='obligatoria_global') THEN
            ALTER TABLE tecnicas_post_practica ADD COLUMN obligatoria_global BOOLEAN DEFAULT false;
          END IF;
          
          -- Añadir campo obligatoria_por_nivel
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='tecnicas_post_practica' AND column_name='obligatoria_por_nivel') THEN
            ALTER TABLE tecnicas_post_practica ADD COLUMN obligatoria_por_nivel JSONB DEFAULT '{}';
          END IF;
          
          -- Añadir campo minutos
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='tecnicas_post_practica' AND column_name='minutos') THEN
            ALTER TABLE tecnicas_post_practica ADD COLUMN minutos INT DEFAULT NULL;
          END IF;
          
          -- Añadir campo tiene_video
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='tecnicas_post_practica' AND column_name='tiene_video') THEN
            ALTER TABLE tecnicas_post_practica ADD COLUMN tiene_video BOOLEAN DEFAULT false;
          END IF;
          
          -- Añadir campo video_url (ya existe, pero verificamos)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='tecnicas_post_practica' AND column_name='video_url') THEN
            ALTER TABLE tecnicas_post_practica ADD COLUMN video_url TEXT DEFAULT NULL;
          END IF;
          
          -- Añadir campo contenido_html
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='tecnicas_post_practica' AND column_name='contenido_html') THEN
            ALTER TABLE tecnicas_post_practica ADD COLUMN contenido_html TEXT DEFAULT NULL;
          END IF;
        END $$;
      `);
      console.log('✅ Campos nuevos añadidos/verificados en tecnicas_post_practica');
    } catch (error) {
      console.error('⚠️ Error añadiendo campos a tecnicas_post_practica:', error.message);
    }

    // C) Migración: Añadir campo tema_preferido a alumnos
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='alumnos' AND column_name='tema_preferido') THEN
            ALTER TABLE alumnos ADD COLUMN tema_preferido VARCHAR(20) DEFAULT 'light';
          END IF;
        END $$;
      `);
      console.log('✅ Campo tema_preferido añadido/verificado en alumnos');
    } catch (error) {
      console.error('⚠️ Error añadiendo campo tema_preferido a alumnos:', error.message);
    }

    // D) Crear nueva tabla: decretos
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS decretos (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          contenido_html TEXT NOT NULL,
          nivel_minimo INT DEFAULT 1,
          posicion VARCHAR(20) DEFAULT 'inicio',
          obligatoria_global BOOLEAN DEFAULT false,
          obligatoria_por_nivel JSONB DEFAULT '{}',
          orden INT DEFAULT 0,
          activo BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_decretos_nivel_minimo ON decretos(nivel_minimo);
        CREATE INDEX IF NOT EXISTS idx_decretos_activo ON decretos(activo);
      `);
      console.log('✅ Tabla decretos creada/verificada');
      
      // Migración: Añadir campos nuevos si no existen (para tablas ya creadas)
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='decretos' AND column_name='posicion') THEN
            ALTER TABLE decretos ADD COLUMN posicion VARCHAR(20) DEFAULT 'inicio';
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='decretos' AND column_name='obligatoria_global') THEN
            ALTER TABLE decretos ADD COLUMN obligatoria_global BOOLEAN DEFAULT false;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='decretos' AND column_name='obligatoria_por_nivel') THEN
            ALTER TABLE decretos ADD COLUMN obligatoria_por_nivel JSONB DEFAULT '{}';
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='decretos' AND column_name='orden') THEN
            ALTER TABLE decretos ADD COLUMN orden INT DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='decretos' AND column_name='activo') THEN
            ALTER TABLE decretos ADD COLUMN activo BOOLEAN DEFAULT true;
          END IF;
        END $$;
      `);
      console.log('✅ Campos adicionales añadidos/verificados en decretos');
    } catch (error) {
      console.error('⚠️ Error creando tabla decretos:', error.message);
    }

    // E) Crear nueva tabla: pde_motors
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pde_motors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          motor_key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'draft',
          definition JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now(),
          deleted_at TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_pde_motors_motor_key ON pde_motors(motor_key);
        CREATE INDEX IF NOT EXISTS idx_pde_motors_status ON pde_motors(status);
        CREATE INDEX IF NOT EXISTS idx_pde_motors_category ON pde_motors(category);
        CREATE INDEX IF NOT EXISTS idx_pde_motors_deleted_at ON pde_motors(deleted_at);
      `);
      console.log('✅ Tabla pde_motors creada/verificada');
    } catch (error) {
      console.error('⚠️ Error creando tabla pde_motors:', error.message);
    }

  } catch (error) {
    console.error('❌ Error creando tablas PostgreSQL:', error);
    // No lanzar error para permitir que el servidor inicie aunque falle la creación
  }
}

/**
 * Ejecuta la migración de estandarización de columnas de limpieza
 * Renombra fecha_ultima_limpieza -> ultima_limpieza y fecha_proxima_recomendada -> proxima_limpieza
 */
export async function standardizeLimpiezaColumns() {
  const pool = getPool();
  
  try {
    // Estandarizar aspectos_energeticos_alumnos
    await pool.query(`
      DO $$
      BEGIN
        -- Renombrar fecha_ultima_limpieza a ultima_limpieza
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='aspectos_energeticos_alumnos' 
                   AND column_name='fecha_ultima_limpieza') THEN
          ALTER TABLE aspectos_energeticos_alumnos 
          RENAME COLUMN fecha_ultima_limpieza TO ultima_limpieza;
        ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='aspectos_energeticos_alumnos' 
                          AND column_name='ultima_limpieza') THEN
          ALTER TABLE aspectos_energeticos_alumnos 
          ADD COLUMN ultima_limpieza TIMESTAMP;
        END IF;

        -- Renombrar fecha_proxima_recomendada a proxima_limpieza
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='aspectos_energeticos_alumnos' 
                   AND column_name='fecha_proxima_recomendada') THEN
          ALTER TABLE aspectos_energeticos_alumnos 
          RENAME COLUMN fecha_proxima_recomendada TO proxima_limpieza;
        ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='aspectos_energeticos_alumnos' 
                          AND column_name='proxima_limpieza') THEN
          ALTER TABLE aspectos_energeticos_alumnos 
          ADD COLUMN proxima_limpieza TIMESTAMP;
        END IF;
      END $$;
    `);

    // Estandarizar aspectos_karmicos_alumnos
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='aspectos_karmicos_alumnos' 
                   AND column_name='fecha_ultima_limpieza') THEN
          ALTER TABLE aspectos_karmicos_alumnos 
          RENAME COLUMN fecha_ultima_limpieza TO ultima_limpieza;
        ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='aspectos_karmicos_alumnos' 
                          AND column_name='ultima_limpieza') THEN
          ALTER TABLE aspectos_karmicos_alumnos 
          ADD COLUMN ultima_limpieza TIMESTAMP;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='aspectos_karmicos_alumnos' 
                   AND column_name='fecha_proxima_limpieza') THEN
          ALTER TABLE aspectos_karmicos_alumnos 
          RENAME COLUMN fecha_proxima_limpieza TO proxima_limpieza;
        ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='aspectos_karmicos_alumnos' 
                          AND column_name='proxima_limpieza') THEN
          ALTER TABLE aspectos_karmicos_alumnos 
          ADD COLUMN proxima_limpieza TIMESTAMP;
        END IF;
      END $$;
    `);

    // Estandarizar aspectos_indeseables_alumnos
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='aspectos_indeseables_alumnos' 
                   AND column_name='fecha_ultima_limpieza') THEN
          ALTER TABLE aspectos_indeseables_alumnos 
          RENAME COLUMN fecha_ultima_limpieza TO ultima_limpieza;
        ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='aspectos_indeseables_alumnos' 
                          AND column_name='ultima_limpieza') THEN
          ALTER TABLE aspectos_indeseables_alumnos 
          ADD COLUMN ultima_limpieza TIMESTAMP;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='aspectos_indeseables_alumnos' 
                   AND column_name='fecha_proxima_limpieza') THEN
          ALTER TABLE aspectos_indeseables_alumnos 
          RENAME COLUMN fecha_proxima_limpieza TO proxima_limpieza;
        ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='aspectos_indeseables_alumnos' 
                          AND column_name='proxima_limpieza') THEN
          ALTER TABLE aspectos_indeseables_alumnos 
          ADD COLUMN proxima_limpieza TIMESTAMP;
        END IF;
      END $$;
    `);

    console.log('✅ Migración de estandarización de columnas ejecutada correctamente');
  } catch (error) {
    console.error('⚠️  Error ejecutando migración de columnas:', error.message);
    // No lanzar error, solo loguear, para que no bloquee la inicialización
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Pool de PostgreSQL cerrado');
  }
}

// Exportar funciones helper para alumnos
export const alumnos = {
  /**
   * Buscar alumno por email
   */
  async findByEmail(email) {
    const result = await query('SELECT * FROM alumnos WHERE email = $1', [email.toLowerCase().trim()]);
    return result.rows[0] || null;
  },

  /**
   * Buscar alumno por ID
   */
  async findById(id) {
    const result = await query('SELECT * FROM alumnos WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Crear o actualizar alumno (UPSERT)
   */
  async upsert(alumnoData) {
    const {
      email,
      apodo,
      fecha_inscripcion,
      fecha_ultima_practica,
      nivel_actual,
      nivel_manual,
      streak,
      estado_suscripcion,
      fecha_reactivacion
    } = alumnoData;

    const result = await query(`
      INSERT INTO alumnos (
        email, apodo, fecha_inscripcion, fecha_ultima_practica,
        nivel_actual, nivel_manual, streak, estado_suscripcion, fecha_reactivacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (email) DO UPDATE SET
        apodo = COALESCE(EXCLUDED.apodo, alumnos.apodo),
        fecha_ultima_practica = COALESCE(EXCLUDED.fecha_ultima_practica, alumnos.fecha_ultima_practica),
        nivel_actual = COALESCE(EXCLUDED.nivel_actual, alumnos.nivel_actual),
        nivel_manual = COALESCE(EXCLUDED.nivel_manual, alumnos.nivel_manual),
        streak = COALESCE(EXCLUDED.streak, alumnos.streak),
        estado_suscripcion = COALESCE(EXCLUDED.estado_suscripcion, alumnos.estado_suscripcion),
        fecha_reactivacion = COALESCE(EXCLUDED.fecha_reactivacion, alumnos.fecha_reactivacion),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      email.toLowerCase().trim(),
      apodo || null,
      fecha_inscripcion || new Date(),
      fecha_ultima_practica || null,
      nivel_actual || 1,
      nivel_manual || null,
      streak || 0,
      estado_suscripcion || 'activa',
      fecha_reactivacion || null
    ]);

    return result.rows[0];
  },

  /**
   * Actualizar nivel
   */
  async updateNivel(email, nivel) {
    const result = await query(
      'UPDATE alumnos SET nivel_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING *',
      [nivel, email.toLowerCase().trim()]
    );
    return result.rows[0];
  },

  /**
   * Actualizar streak
   */
  async updateStreak(email, streak) {
    const result = await query(
      'UPDATE alumnos SET streak = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING *',
      [streak, email.toLowerCase().trim()]
    );
    return result.rows[0];
  },

  /**
   * Actualizar última práctica
   */
  async updateUltimaPractica(email, fecha) {
    const result = await query(
      'UPDATE alumnos SET fecha_ultima_practica = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING *',
      [fecha, email.toLowerCase().trim()]
    );
    return result.rows[0];
  },

  /**
   * Actualizar estado de suscripción
   */
  async updateEstadoSuscripcion(email, estado, fechaReactivacion = null) {
    const result = await query(
      'UPDATE alumnos SET estado_suscripcion = $1, fecha_reactivacion = $2, updated_at = CURRENT_TIMESTAMP WHERE email = $3 RETURNING *',
      [estado, fechaReactivacion, email.toLowerCase().trim()]
    );
    return result.rows[0];
  },

  /**
   * Eliminar alumno por ID (elimina también prácticas y pausas relacionadas)
   */
  async deleteById(id) {
    // Eliminar prácticas relacionadas
    await query('DELETE FROM practicas WHERE alumno_id = $1', [id]);
    // Eliminar pausas relacionadas
    await query('DELETE FROM pausas WHERE alumno_id = $1', [id]);
    // Eliminar alumno
    const result = await query('DELETE FROM alumnos WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }
};

// Exportar funciones helper para respuestas
export const respuestas = {
  /**
   * Crear nueva respuesta
   */
  async create(respuestaData) {
    const { alumno_id, email, apodo, respuesta, nivel_practica, form_id, form_title, submitted_at } = respuestaData;
    const result = await query(`
      INSERT INTO respuestas (alumno_id, email, apodo, respuesta, nivel_practica, form_id, form_title, submitted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [alumno_id, email, apodo || null, respuesta, nivel_practica || null, form_id || null, form_title || null, submitted_at || new Date()]);
    return result.rows[0];
  },

  /**
   * Obtener respuestas por alumno
   */
  async getByAlumnoId(alumnoId) {
    const result = await query(
      'SELECT * FROM respuestas WHERE alumno_id = $1 ORDER BY submitted_at DESC',
      [alumnoId]
    );
    return result.rows;
  },

  /**
   * Obtener respuestas por email
   */
  async getByEmail(email) {
    const result = await query(
      'SELECT * FROM respuestas WHERE email = $1 ORDER BY submitted_at DESC',
      [email.toLowerCase().trim()]
    );
    return result.rows;
  },

  /**
   * Obtener todas las respuestas con filtros y paginación
   */
  async getAll(filters = {}, page = 1, limit = 50) {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (filters.email) {
      whereConditions.push(`email ILIKE $${paramIndex}`);
      params.push(`%${filters.email}%`);
      paramIndex++;
    }

    if (filters.nivel_practica) {
      const nivel = parseInt(filters.nivel_practica);
      if (!isNaN(nivel)) {
        whereConditions.push(`nivel_practica = $${paramIndex}`);
        params.push(nivel);
        paramIndex++;
      }
    }

    if (filters.form_id) {
      whereConditions.push(`form_id = $${paramIndex}`);
      params.push(filters.form_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Contar total
    const countResult = await query(
      `SELECT COUNT(*) as total FROM respuestas ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Obtener respuestas con paginación
    const pageNum = (typeof page === 'number' && !isNaN(page) && page > 0) ? page : 1;
    const limitNum = (typeof limit === 'number' && !isNaN(limit) && limit > 0) ? limit : 50;
    const offset = (pageNum - 1) * limitNum;
    
    params.push(limitNum, offset);
    const result = await query(
      `SELECT * FROM respuestas ${whereClause} ORDER BY submitted_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    return {
      respuestas: result.rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  }
};

// Exportar funciones helper para aspectos_practica
export const aspectosPractica = {
  /**
   * Crear nuevo aspecto
   */
  async create(aspectoData) {
    const { nombre, webhook_typeform, recomendado_iniciarse, recomendado_conocer, recomendado_dominio, descripcion } = aspectoData;
    const result = await query(`
      INSERT INTO aspectos_practica (nombre, webhook_typeform, recomendado_iniciarse, recomendado_conocer, recomendado_dominio, descripcion)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [nombre, webhook_typeform || null, recomendado_iniciarse || 1, recomendado_conocer || 5, recomendado_dominio || 10, descripcion || null]);
    return result.rows[0];
  },

  /**
   * Actualizar aspecto
   */
  async update(id, aspectoData) {
    const { nombre, webhook_typeform, recomendado_iniciarse, recomendado_conocer, recomendado_dominio, descripcion, activo } = aspectoData;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex}`);
      params.push(nombre);
      paramIndex++;
    }
    if (webhook_typeform !== undefined) {
      updates.push(`webhook_typeform = $${paramIndex}`);
      params.push(webhook_typeform);
      paramIndex++;
    }
    if (recomendado_iniciarse !== undefined) {
      updates.push(`recomendado_iniciarse = $${paramIndex}`);
      params.push(recomendado_iniciarse);
      paramIndex++;
    }
    if (recomendado_conocer !== undefined) {
      updates.push(`recomendado_conocer = $${paramIndex}`);
      params.push(recomendado_conocer);
      paramIndex++;
    }
    if (recomendado_dominio !== undefined) {
      updates.push(`recomendado_dominio = $${paramIndex}`);
      params.push(recomendado_dominio);
      paramIndex++;
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex}`);
      params.push(descripcion);
      paramIndex++;
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex}`);
      params.push(activo);
      paramIndex++;
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
      `UPDATE aspectos_practica SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0];
  },

  /**
   * Obtener aspecto por ID
   */
  async findById(id) {
    const result = await query('SELECT * FROM aspectos_practica WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Obtener aspecto por nombre
   */
  async findByNombre(nombre) {
    const result = await query('SELECT * FROM aspectos_practica WHERE nombre = $1', [nombre]);
    return result.rows[0] || null;
  },

  /**
   * Obtener aspecto por webhook
   */
  async findByWebhook(webhook) {
    const result = await query('SELECT * FROM aspectos_practica WHERE webhook_typeform = $1', [webhook]);
    return result.rows[0] || null;
  },

  /**
   * Obtener todos los aspectos activos
   */
  async getAll(activos = true) {
    const result = await query(
      activos 
        ? 'SELECT * FROM aspectos_practica WHERE activo = true ORDER BY nombre ASC'
        : 'SELECT * FROM aspectos_practica ORDER BY nombre ASC'
    );
    return result.rows;
  },

  /**
   * Eliminar aspecto
   */
  async deleteById(id) {
    await query('DELETE FROM aspectos_practica WHERE id = $1', [id]);
  }
};

// Exportar funciones helper para progreso_pedagogico
export const progresoPedagogico = {
  /**
   * Crear o actualizar progreso
   */
  async upsert(progresoData) {
    const { alumno_id, aspecto_id, contador_alumno, recomendacion_master_iniciarse, recomendacion_master_conocer, recomendacion_master_dominio } = progresoData;
    const result = await query(`
      INSERT INTO progreso_pedagogico (alumno_id, aspecto_id, contador_alumno, recomendacion_master_iniciarse, recomendacion_master_conocer, recomendacion_master_dominio)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (alumno_id, aspecto_id) DO UPDATE SET
        contador_alumno = EXCLUDED.contador_alumno,
        recomendacion_master_iniciarse = COALESCE(EXCLUDED.recomendacion_master_iniciarse, progreso_pedagogico.recomendacion_master_iniciarse),
        recomendacion_master_conocer = COALESCE(EXCLUDED.recomendacion_master_conocer, progreso_pedagogico.recomendacion_master_conocer),
        recomendacion_master_dominio = COALESCE(EXCLUDED.recomendacion_master_dominio, progreso_pedagogico.recomendacion_master_dominio),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [alumno_id, aspecto_id, contador_alumno || 0, recomendacion_master_iniciarse || null, recomendacion_master_conocer || null, recomendacion_master_dominio || null]);
    return result.rows[0];
  },

  /**
   * Obtener progreso por alumno
   */
  async getByAlumnoId(alumnoId) {
    const result = await query(`
      SELECT pp.*, ap.nombre as aspecto_nombre, ap.recomendado_iniciarse, ap.recomendado_conocer, ap.recomendado_dominio
      FROM progreso_pedagogico pp
      JOIN aspectos_practica ap ON pp.aspecto_id = ap.id
      WHERE pp.alumno_id = $1 AND ap.activo = true
      ORDER BY ap.nombre ASC
    `, [alumnoId]);
    return result.rows;
  },

  /**
   * Obtener progreso por aspecto
   */
  async getByAspectoId(aspectoId) {
    const result = await query(`
      SELECT pp.*, a.email, a.apodo, a.nivel_actual
      FROM progreso_pedagogico pp
      JOIN alumnos a ON pp.alumno_id = a.id
      WHERE pp.aspecto_id = $1
      ORDER BY a.apodo ASC
    `, [aspectoId]);
    return result.rows;
  },

  /**
   * Incrementar contador de alumno en aspecto
   */
  async incrementarContador(alumnoId, aspectoId) {
    const result = await query(`
      INSERT INTO progreso_pedagogico (alumno_id, aspecto_id, contador_alumno)
      VALUES ($1, $2, 1)
      ON CONFLICT (alumno_id, aspecto_id) DO UPDATE SET
        contador_alumno = progreso_pedagogico.contador_alumno + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [alumnoId, aspectoId]);
    return result.rows[0];
  },

  /**
   * Actualizar recomendaciones del master
   */
  async updateRecomendacionesMaster(alumnoId, aspectoId, recomendaciones) {
    const { iniciarse, conocer, dominio } = recomendaciones;
    const result = await query(`
      UPDATE progreso_pedagogico
      SET recomendacion_master_iniciarse = $1,
          recomendacion_master_conocer = $2,
          recomendacion_master_dominio = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE alumno_id = $4 AND aspecto_id = $5
      RETURNING *
    `, [iniciarse || null, conocer || null, dominio || null, alumnoId, aspectoId]);
    return result.rows[0];
  },

  /**
   * Obtener todos los alumnos con su progreso en todos los aspectos
   */
  async getAllAlumnosConProgreso(sortBy = 'apodo', sortOrder = 'ASC') {
    // Validar sortBy
    const validSortBy = ['apodo', 'nivel_actual', 'fase', 'email'];
    const validSortOrder = ['ASC', 'DESC'];
    const finalSortBy = validSortBy.includes(sortBy) ? sortBy : 'apodo';
    const finalSortOrder = validSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    // Construir ORDER BY según sortBy
    let orderByClause = '';
    if (finalSortBy === 'fase') {
      // Ordenar por fase requiere un JOIN con niveles_fases
      orderByClause = `
        ORDER BY 
          CASE 
            WHEN nf.fase = 'sanación' THEN 1
            WHEN nf.fase = 'sanación avanzada' THEN 2
            WHEN nf.fase = 'canalización' THEN 3
            WHEN nf.fase = 'creación' THEN 4
            WHEN nf.fase = 'servicio' THEN 5
            ELSE 6
          END ${finalSortOrder},
          a.apodo ASC
      `;
    } else {
      orderByClause = `ORDER BY a.${finalSortBy} ${finalSortOrder}, ap.nombre ASC`;
    }

    const result = await query(`
      SELECT 
        a.id as alumno_id,
        a.email,
        a.apodo,
        a.nivel_actual,
        COALESCE(nf.fase, 'sin fase') as fase,
        ap.id as aspecto_id,
        ap.nombre as aspecto_nombre,
        COALESCE(pp.contador_alumno, 0) as contador_alumno,
        COALESCE(pp.recomendacion_master_iniciarse, ap.recomendado_iniciarse) as recomendacion_iniciarse,
        COALESCE(pp.recomendacion_master_conocer, ap.recomendado_conocer) as recomendacion_conocer,
        COALESCE(pp.recomendacion_master_dominio, ap.recomendado_dominio) as recomendacion_dominio,
        ap.recomendado_iniciarse as recomendado_iniciarse,
        ap.recomendado_conocer as recomendado_conocer,
        ap.recomendado_dominio as recomendado_dominio
      FROM alumnos a
      CROSS JOIN aspectos_practica ap
      LEFT JOIN progreso_pedagogico pp ON pp.alumno_id = a.id AND pp.aspecto_id = ap.id
      LEFT JOIN niveles_fases nf ON (
        (nf.nivel_min IS NULL OR a.nivel_actual >= nf.nivel_min)
        AND (nf.nivel_max IS NULL OR a.nivel_actual <= nf.nivel_max)
      )
      WHERE ap.activo = true
      ${orderByClause}
    `);
    return result.rows;
  }
};

// Exportar funciones helper para racha_fases
export const rachaFases = {
  /**
   * Obtener fase de racha por días consecutivos
   */
  async getFasePorDias(dias) {
    const result = await query(`
      SELECT * FROM racha_fases
      WHERE (dias_min IS NULL OR $1 >= dias_min)
        AND (dias_max IS NULL OR $1 <= dias_max)
      ORDER BY orden ASC, dias_min ASC NULLS LAST
      LIMIT 1
    `, [dias]);

    return result.rows[0] || null;
  },

  /**
   * Obtener todas las fases de racha
   */
  async getAll() {
    const result = await query('SELECT * FROM racha_fases ORDER BY orden ASC, dias_min ASC');
    return result.rows;
  },

  /**
   * Crear nueva fase de racha
   */
  async create(faseData) {
    const { fase, dias_min, dias_max, descripcion, orden } = faseData;
    const result = await query(`
      INSERT INTO racha_fases (fase, dias_min, dias_max, descripcion, orden)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [fase, dias_min || null, dias_max || null, descripcion || null, orden || 0]);
    return result.rows[0];
  },

  /**
   * Actualizar fase de racha
   */
  async update(id, faseData) {
    const { fase, dias_min, dias_max, descripcion, orden } = faseData;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (fase !== undefined) {
      updates.push(`fase = $${paramIndex}`);
      params.push(fase);
      paramIndex++;
    }
    if (dias_min !== undefined) {
      updates.push(`dias_min = $${paramIndex}`);
      params.push(dias_min);
      paramIndex++;
    }
    if (dias_max !== undefined) {
      updates.push(`dias_max = $${paramIndex}`);
      params.push(dias_max);
      paramIndex++;
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex}`);
      params.push(descripcion);
      paramIndex++;
    }
    if (orden !== undefined) {
      updates.push(`orden = $${paramIndex}`);
      params.push(orden);
      paramIndex++;
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
      `UPDATE racha_fases SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0];
  },

  /**
   * Eliminar fase de racha
   */
  async deleteById(id) {
    await query('DELETE FROM racha_fases WHERE id = $1', [id]);
  },

  /**
   * Obtener fase por ID
   */
  async findById(id) {
    const result = await query('SELECT * FROM racha_fases WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
};

// Exportar funciones helper para caminos_pantallas
export const caminosPantallas = {
  /**
   * Obtener todos los caminos de una pantalla
   */
  async getByPantalla(pantalla) {
    const result = await query(`
      SELECT * FROM caminos_pantallas
      WHERE pantalla = $1 AND activo = true
      ORDER BY orden ASC
    `, [pantalla]);
    return result.rows;
  },

  /**
   * Obtener todos los caminos
   */
  async getAll() {
    const result = await query('SELECT * FROM caminos_pantallas ORDER BY pantalla, orden ASC');
    return result.rows;
  },

  /**
   * Crear nuevo camino
   */
  async create(caminoData) {
    const { pantalla, boton_texto, boton_url, orden, activo, descripcion } = caminoData;
    const result = await query(`
      INSERT INTO caminos_pantallas (pantalla, boton_texto, boton_url, orden, activo, descripcion)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [pantalla, boton_texto, boton_url, orden || 0, activo !== false, descripcion || null]);
    return result.rows[0];
  },

  /**
   * Actualizar camino
   */
  async update(id, caminoData) {
    const { pantalla, boton_texto, boton_url, orden, activo, descripcion } = caminoData;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (pantalla !== undefined) {
      updates.push(`pantalla = $${paramIndex}`);
      params.push(pantalla);
      paramIndex++;
    }
    if (boton_texto !== undefined) {
      updates.push(`boton_texto = $${paramIndex}`);
      params.push(boton_texto);
      paramIndex++;
    }
    if (boton_url !== undefined) {
      updates.push(`boton_url = $${paramIndex}`);
      params.push(boton_url);
      paramIndex++;
    }
    if (orden !== undefined) {
      updates.push(`orden = $${paramIndex}`);
      params.push(orden);
      paramIndex++;
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex}`);
      params.push(activo);
      paramIndex++;
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex}`);
      params.push(descripcion);
      paramIndex++;
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
      `UPDATE caminos_pantallas SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0];
  },

  /**
   * Eliminar camino
   */
  async deleteById(id) {
    await query('DELETE FROM caminos_pantallas WHERE id = $1', [id]);
  },

  /**
   * Obtener camino por ID
   */
  async findById(id) {
    const result = await query('SELECT * FROM caminos_pantallas WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
};

// Exportar funciones helper para pantallas
export const pantallas = {
  /**
   * Obtener todas las pantallas
   */
  async getAll() {
    const result = await query('SELECT * FROM pantallas ORDER BY orden ASC');
    return result.rows;
  },

  /**
   * Obtener pantalla por ID
   */
  async findById(id) {
    const result = await query('SELECT * FROM pantallas WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Obtener pantalla por código
   */
  async findByCodigo(codigo) {
    const result = await query('SELECT * FROM pantallas WHERE codigo = $1', [codigo]);
    return result.rows[0] || null;
  },

  /**
   * Crear nueva pantalla
   */
  async create(pantallaData) {
    const { nombre, codigo, descripcion, orden, activa, template_path, url_ruta } = pantallaData;
    const result = await query(`
      INSERT INTO pantallas (nombre, codigo, descripcion, orden, activa, template_path, url_ruta)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [nombre, codigo, descripcion || null, orden || 0, activa !== false, template_path || null, url_ruta || null]);
    return result.rows[0];
  },

  /**
   * Actualizar pantalla
   */
  async update(id, pantallaData) {
    const { nombre, codigo, descripcion, orden, activa, template_path, pos_x, pos_y, url_ruta, metodo_entrada } = pantallaData;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex}`);
      params.push(nombre);
      paramIndex++;
    }
    if (codigo !== undefined) {
      updates.push(`codigo = $${paramIndex}`);
      params.push(codigo);
      paramIndex++;
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex}`);
      params.push(descripcion);
      paramIndex++;
    }
    if (orden !== undefined) {
      updates.push(`orden = $${paramIndex}`);
      params.push(orden);
      paramIndex++;
    }
    if (activa !== undefined) {
      updates.push(`activa = $${paramIndex}`);
      params.push(activa);
      paramIndex++;
    }
    if (template_path !== undefined) {
      updates.push(`template_path = $${paramIndex}`);
      params.push(template_path);
      paramIndex++;
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
      `UPDATE pantallas SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0];
  },

  /**
   * Eliminar pantalla
   */
  async deleteById(id) {
    // Primero eliminar conexiones relacionadas
    await query('DELETE FROM conexiones_pantallas WHERE pantalla_origen_id = $1 OR pantalla_destino_id = $1', [id]);
    // Luego eliminar la pantalla
    const result = await query('DELETE FROM pantallas WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }
};

// Exportar funciones helper para conexiones_pantallas
export const conexionesPantallas = {
  /**
   * Obtener todas las conexiones
   */
  async getAll() {
    const result = await query(`
      SELECT 
        c.*,
        po.nombre as origen_nombre,
        po.codigo as origen_codigo,
        pd.nombre as destino_nombre,
        pd.codigo as destino_codigo
      FROM conexiones_pantallas c
      JOIN pantallas po ON c.pantalla_origen_id = po.id
      JOIN pantallas pd ON c.pantalla_destino_id = pd.id
      ORDER BY c.orden ASC
    `);
    return result.rows;
  },

  /**
   * Obtener conexiones desde una pantalla
   */
  async getByOrigen(pantallaId) {
    const result = await query(`
      SELECT 
        c.*,
        pd.nombre as destino_nombre,
        pd.codigo as destino_codigo
      FROM conexiones_pantallas c
      JOIN pantallas pd ON c.pantalla_destino_id = pd.id
      WHERE c.pantalla_origen_id = $1 AND c.activa = true
      ORDER BY c.orden ASC
    `, [pantallaId]);
    return result.rows;
  },

  /**
   * Crear nueva conexión
   */
  async create(conexionData) {
    const { pantalla_origen_id, pantalla_destino_id, boton_texto, condicion, orden, activa } = conexionData;
    const result = await query(`
      INSERT INTO conexiones_pantallas (pantalla_origen_id, pantalla_destino_id, boton_texto, condicion, orden, activa)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [pantalla_origen_id, pantalla_destino_id, boton_texto || null, condicion || null, orden || 0, activa !== false]);
    return result.rows[0];
  },

  /**
   * Actualizar conexión
   */
  async update(id, conexionData) {
    const { pantalla_origen_id, pantalla_destino_id, boton_texto, condicion, orden, activa } = conexionData;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (pantalla_origen_id !== undefined) {
      updates.push(`pantalla_origen_id = $${paramIndex}`);
      params.push(pantalla_origen_id);
      paramIndex++;
    }
    if (pantalla_destino_id !== undefined) {
      updates.push(`pantalla_destino_id = $${paramIndex}`);
      params.push(pantalla_destino_id);
      paramIndex++;
    }
    if (boton_texto !== undefined) {
      updates.push(`boton_texto = $${paramIndex}`);
      params.push(boton_texto);
      paramIndex++;
    }
    if (condicion !== undefined) {
      updates.push(`condicion = $${paramIndex}`);
      params.push(condicion);
      paramIndex++;
    }
    if (orden !== undefined) {
      updates.push(`orden = $${paramIndex}`);
      params.push(orden);
      paramIndex++;
    }
    if (activa !== undefined) {
      updates.push(`activa = $${paramIndex}`);
      params.push(activa);
      paramIndex++;
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
      `UPDATE conexiones_pantallas SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0];
  },

  /**
   * Eliminar conexión
   */
  async deleteById(id) {
    await query('DELETE FROM conexiones_pantallas WHERE id = $1', [id]);
  },

  /**
   * Obtener conexión por ID
   */
  async findById(id) {
    const result = await query(`
      SELECT 
        c.*,
        po.nombre as origen_nombre,
        po.codigo as origen_codigo,
        pd.nombre as destino_nombre,
        pd.codigo as destino_codigo
      FROM conexiones_pantallas c
      JOIN pantallas po ON c.pantalla_origen_id = po.id
      JOIN pantallas pd ON c.pantalla_destino_id = pd.id
      WHERE c.id = $1
    `, [id]);
    return result.rows[0] || null;
  }
};

// Exportar funciones helper para prácticas
export const practicas = {
  /**
   * Crear nueva práctica
   */
  async create(practicaData) {
    const { alumno_id, fecha, tipo, origen, duracion } = practicaData;
    
    const result = await query(`
      INSERT INTO practicas (alumno_id, fecha, tipo, origen, duracion)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [alumno_id, fecha || new Date(), tipo || null, origen || null, duracion || null]);

    return result.rows[0];
  },

  /**
   * Obtener prácticas de un alumno
   */
  async findByAlumnoId(alumno_id, limit = 100) {
    const result = await query(
      'SELECT * FROM practicas WHERE alumno_id = $1 ORDER BY fecha DESC LIMIT $2',
      [alumno_id, limit]
    );
    return result.rows;
  }
};

// Exportar funciones helper para pausas
export const pausas = {
  /**
   * Crear nueva pausa
   */
  async create(pausaData) {
    const { alumno_id, inicio, fin } = pausaData;
    
    const result = await query(`
      INSERT INTO pausas (alumno_id, inicio, fin)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [alumno_id, inicio || new Date(), fin || null]);

    return result.rows[0];
  },

  /**
   * Obtener pausas de un alumno
   */
  async findByAlumnoId(alumno_id) {
    const result = await query(
      'SELECT * FROM pausas WHERE alumno_id = $1 ORDER BY inicio DESC',
      [alumno_id]
    );
    return result.rows;
  },

  /**
   * Calcular total de días pausados para un alumno
   */
  async calcularDiasPausados(alumno_id) {
    const result = await query(`
      SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (COALESCE(fin, CURRENT_TIMESTAMP) - inicio)) / 86400
      ), 0)::INTEGER as dias_pausados
      FROM pausas
      WHERE alumno_id = $1
    `, [alumno_id]);

    return result.rows[0]?.dias_pausados || 0;
  },

  /**
   * Calcular días pausados hasta una fecha específica (excluyendo días después de esa fecha)
   */
  async calcularDiasPausadosHastaFecha(alumno_id, fechaLimite) {
    const result = await query(`
      SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (
          (COALESCE(fin, $2::timestamp)) - inicio
        )) / 86400
      ), 0)::INTEGER as dias_pausados
      FROM pausas
      WHERE alumno_id = $1
        AND inicio < $2::timestamp
    `, [alumno_id, fechaLimite]);

    return result.rows[0]?.dias_pausados || 0;
  },

  /**
   * Obtener la pausa activa (sin fin) más reciente para un alumno
   */
  async getPausaActiva(alumno_id) {
    const result = await query(`
      SELECT * FROM pausas
      WHERE alumno_id = $1
        AND fin IS NULL
      ORDER BY inicio DESC
      LIMIT 1
    `, [alumno_id]);

    return result.rows[0] || null;
  },

  /**
   * Cerrar una pausa poniendo fecha de fin
   */
  async cerrarPausa(pausaId, fechaFin) {
    const result = await query(`
      UPDATE pausas
      SET fin = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [fechaFin, pausaId]);

    return result.rows[0];
  }
};

// Exportar funciones helper para frases
export const frases = {
  /**
   * Obtener frase aleatoria por nivel
   */
  async getByNivel(nivel) {
    const result = await query(
      'SELECT * FROM frases_nivel WHERE nivel = $1 ORDER BY RANDOM() LIMIT 1',
      [nivel]
    );
    return result.rows[0] || null;
  },

  /**
   * Obtener todas las frases de un nivel
   */
  async getAllByNivel(nivel) {
    const result = await query(
      'SELECT * FROM frases_nivel WHERE nivel = $1 ORDER BY created_at DESC',
      [nivel]
    );
    return result.rows;
  },

  /**
   * Crear o actualizar frase
   */
  async upsert(fraseData) {
    const { nivel, frase, clickup_task_id, origen } = fraseData;
    
    const result = await query(`
      INSERT INTO frases_nivel (nivel, frase, clickup_task_id, origen)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (clickup_task_id) DO UPDATE SET
        nivel = EXCLUDED.nivel,
        frase = EXCLUDED.frase,
        origen = EXCLUDED.origen,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [nivel, frase, clickup_task_id, origen || 'clickup']);

    return result.rows[0];
  },

  /**
   * Eliminar frase por clickup_task_id
   */
  async deleteByClickUpTaskId(clickup_task_id) {
    const result = await query(
      'DELETE FROM frases_nivel WHERE clickup_task_id = $1 RETURNING *',
      [clickup_task_id]
    );
    return result.rows[0] || null;
  },

  /**
   * Obtener todas las frases
   */
  async getAll() {
    const result = await query('SELECT * FROM frases_nivel ORDER BY nivel, created_at DESC');
    return result.rows;
  }
};

// Exportar funciones helper para niveles_fases
export const nivelesFases = {
  /**
   * Obtener fase por nivel
   */
  async getFasePorNivel(nivel) {
    const result = await query(`
      SELECT * FROM niveles_fases
      WHERE (nivel_min IS NULL OR $1 >= nivel_min)
        AND (nivel_max IS NULL OR $1 <= nivel_max)
      ORDER BY nivel_min ASC NULLS LAST
      LIMIT 1
    `, [nivel]);

    return result.rows[0] || null;
  },

  /**
   * Obtener todas las fases
   */
  async getAll() {
    const result = await query('SELECT * FROM niveles_fases ORDER BY nivel_min ASC');
    return result.rows;
  }
};

/**
 * Ejecuta migraciones pendientes
 */
export async function runMigrations() {
  const pool = getPool();
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  try {
    // Migración v4.13.0: Crear tabla theme_definitions
    const migrationPath = join(__dirname, 'migrations', 'v4.13.0-create-theme-definitions.sql');
    try {
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v4.13.0 ejecutada: theme_definitions');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        console.warn('⚠️  Error ejecutando migración v4.13.0:', error.message);
      }
    }
    
    // Migración v5.1.0: Crear tablas de versionado de recorridos (DEBE ejecutarse ANTES de v5.2.0)
    const migration51Path = join(__dirname, 'migrations', 'v5.1.0-create-recorridos-versioning.sql');
    try {
      const migrationSQL = readFileSync(migration51Path, 'utf-8');
      // Ejecutar por statements separados para evitar problemas de parsing
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => {
          const trimmed = s.trim();
          return trimmed.length > 0 && 
                 !trimmed.startsWith('--') && 
                 !trimmed.match(/^\/\*/) &&
                 trimmed.length > 10;
        });
      
      for (const stmt of statements) {
        try {
          await pool.query(stmt + ';');
        } catch (stmtError) {
          // Si es error de "already exists", continuar (idempotente)
          if (stmtError.message && (
            stmtError.message.includes('already exists') ||
            stmtError.message.includes('duplicate')
          )) {
            continue;
          }
          // Si es error de permisos pero la tabla/objeto ya existe, continuar
          if (stmtError.message && (
            stmtError.message.includes('must be owner') ||
            stmtError.message.includes('permission denied')
          )) {
            // Verificar si el objeto ya existe antes de continuar
            const objectName = stmt.match(/CREATE\s+(?:TABLE|INDEX|CONSTRAINT)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
            if (objectName) {
              console.log(`ℹ️  Objeto ${objectName[1]} ya existe (permisos limitados, continuando...)`);
              continue;
            }
          }
          throw stmtError;
        }
      }
      console.log('✅ Migración v5.1.0 ejecutada: recorridos, recorrido_drafts, recorrido_versions, recorrido_audit_log');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        if (error.message && error.message.includes('already exists')) {
          console.log('ℹ️  Migración v5.1.0 ya aplicada (tablas existentes)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          // Verificar si las tablas ya existen (migración aplicada por otro usuario)
          try {
            const checkResult = await pool.query(`
              SELECT COUNT(*) as count FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('recorridos', 'recorrido_drafts', 'recorrido_versions')
            `);
            if (parseInt(checkResult.rows[0].count) >= 2) {
              console.log('ℹ️  Migración v5.1.0 ya aplicada (tablas existentes con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.1.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.1.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.1.0:', error.message);
        }
      }
    }
    
    // Migración v5.2.0: Crear tablas de runtime de recorridos (depende de v5.1.0)
    const migration52Path = join(__dirname, 'migrations', 'v5.2.0-create-recorrido-runtime.sql');
    try {
      const migrationSQL = readFileSync(migration52Path, 'utf-8');
      // Ejecutar por statements separados para evitar problemas de parsing
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => {
          const trimmed = s.trim();
          // Filtrar comentarios y líneas vacías
          return trimmed.length > 0 && 
                 !trimmed.startsWith('--') && 
                 !trimmed.match(/^\/\*/) &&
                 trimmed.length > 10; // Filtrar statements muy cortos
        });
      
      for (const stmt of statements) {
        try {
          await pool.query(stmt + ';');
        } catch (stmtError) {
          // Si es error de "already exists", continuar (idempotente)
          if (stmtError.message && (
            stmtError.message.includes('already exists') ||
            stmtError.message.includes('duplicate')
          )) {
            continue;
          }
          // Si es error de "relation does not exist" en índices/constraints, continuar
          // (se crearán después cuando existan las tablas)
          if (stmtError.message && 
              stmtError.message.includes('does not exist') &&
              (stmt.includes('INDEX') || stmt.includes('CONSTRAINT'))) {
            continue;
          }
          // Si es error de permisos pero la tabla/objeto ya existe, continuar
          if (stmtError.message && (
            stmtError.message.includes('must be owner') ||
            stmtError.message.includes('permission denied')
          )) {
            // Verificar si el objeto ya existe antes de continuar
            const objectName = stmt.match(/CREATE\s+(?:TABLE|INDEX|CONSTRAINT)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
            if (objectName) {
              console.log(`ℹ️  Objeto ${objectName[1]} ya existe (permisos limitados, continuando...)`);
              continue;
            }
          }
          // Para otros errores, lanzar
          throw stmtError;
        }
      }
      console.log('✅ Migración v5.2.0 ejecutada: recorrido_runs, recorrido_step_results, recorrido_events');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de tabla ya existe, es OK (idempotente)
        if (error.message && error.message.includes('already exists')) {
          console.log('ℹ️  Migración v5.2.0 ya aplicada (tablas existentes)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          // Verificar si las tablas ya existen (migración aplicada por otro usuario)
          try {
            const checkResult = await pool.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('recorrido_runs', 'recorrido_step_results', 'recorrido_events')
              );
            `);
            if (checkResult.rows[0].exists) {
              console.log('ℹ️  Migración v5.2.0 ya aplicada (tablas existentes con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.2.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.2.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.2.0:', error.message);
        }
      }
    }
    
    // Migración v5.6.0: Añadir flags de clasificación a técnicas de limpieza
    const migration56Path = join(__dirname, 'migrations', 'v5.6.0-tecnicas-clasificacion-flags.sql');
    try {
      const migrationSQL = readFileSync(migration56Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.6.0 ejecutada: aplica_energias_indeseables, aplica_limpiezas_recurrentes');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de columna ya existe, es OK (idempotente)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate column')
        )) {
          console.log('ℹ️  Migración v5.6.0 ya aplicada (columnas existentes)');
        } else {
          console.warn('⚠️  Error ejecutando migración v5.6.0:', error.message);
        }
      }
    }
    
    // Migración v5.7.0: Añadir campo descripción a preparaciones_practica
    const migration57Path = join(__dirname, 'migrations', 'v5.7.0-preparaciones-descripcion.sql');
    try {
      const migrationSQL = readFileSync(migration57Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.7.0 ejecutada: descripcion en preparaciones_practica');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de columna ya existe, es OK (idempotente)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate column')
        )) {
          console.log('ℹ️  Migración v5.7.0 ya aplicada (columna existente)');
        } else {
          console.warn('⚠️  Error ejecutando migración v5.7.0:', error.message);
        }
      }
    }
    
    // Migración v5.9.0: Editor WYSIWYG para Biblioteca de Decretos
    const migration59Path = join(__dirname, 'migrations', 'v5.9.0-decretos-editor-v1.sql');
    try {
      // Verificar que la tabla decretos existe antes de ejecutar
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'decretos'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('ℹ️  Tabla decretos no existe, creándola primero...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS decretos (
            id SERIAL PRIMARY KEY,
            titulo TEXT NOT NULL,
            content_html TEXT,
            activo BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
        console.log('✅ Tabla decretos creada');
      }
      
      const migrationSQL = readFileSync(migration59Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.9.0 ejecutada: editor WYSIWYG para decretos');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de columna ya existe, es OK (idempotente)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate column')
        )) {
          console.log('ℹ️  Migración v5.9.0 ya aplicada (columnas existentes)');
        } else if (error.message && error.message.includes('does not exist')) {
          console.log('ℹ️  Tabla decretos no existe, se creará automáticamente en el próximo inicio');
        } else {
          console.warn('⚠️  Error ejecutando migración v5.9.0:', error.message);
        }
      }
    }
    
    // Migración v5.11.0: Normalización de Catálogos PDE para Motores
    const migration511Path = join(__dirname, 'migrations', 'v5.11.0-normalize-pde-catalogs-for-motors.sql');
    try {
      const migrationSQL = readFileSync(migration511Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.11.0 ejecutada: normalización de catálogos PDE para motores');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de columna ya existe, es OK (idempotente)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate column')
        )) {
          console.log('ℹ️  Migración v5.11.0 ya aplicada (columnas existentes)');
        } else {
          console.warn('⚠️  Error ejecutando migración v5.11.0:', error.message);
        }
      }
    }
    
    // Migración v5.12.0: Registro Canónico de Catálogos PDE
    const migration512Path = join(__dirname, 'migrations', 'v5.12.0-create-pde-catalog-registry.sql');
    try {
      const migrationSQL = readFileSync(migration512Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.12.0 ejecutada: registro canónico de catálogos PDE');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de tabla ya existe, es OK (idempotente)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        )) {
          console.log('ℹ️  Migración v5.12.0 ya aplicada (tabla existente)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          // Verificar si la tabla ya existe (migración aplicada por otro usuario)
          try {
            const checkResult = await pool.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'pde_catalog_registry'
              );
            `);
            if (checkResult.rows[0].exists) {
              console.log('ℹ️  Migración v5.12.0 ya aplicada (tabla existente con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.12.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.12.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.12.0:', error.message);
        }
      }
    }
    
    // Migración v5.13.0: Sistema de Paquetes PDE (Package Creator)
    const migration513Path = join(__dirname, 'migrations', 'v5.13.0-create-pde-packages.sql');
    try {
      const migrationSQL = readFileSync(migration513Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.13.0 ejecutada: sistema de paquetes PDE');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de tabla ya existe, es OK (idempotente)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        )) {
          console.log('ℹ️  Migración v5.13.0 ya aplicada (tablas existentes)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          // Verificar si las tablas ya existen (migración aplicada por otro usuario)
          try {
            const checkResult = await pool.query(`
              SELECT COUNT(*) as count FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('pde_packages', 'pde_source_templates')
            `);
            if (parseInt(checkResult.rows[0].count) >= 2) {
              console.log('ℹ️  Migración v5.13.0 ya aplicada (tablas existentes con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.13.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.13.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.13.0:', error.message);
        }
      }
    }
    
    // Migración v5.17.0: Context Registry v1 (Source of Truth para Contextos)
    const migration517Path = join(__dirname, 'migrations', 'v5.17.0-create-pde-contexts.sql');
    try {
      const migrationSQL = readFileSync(migration517Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.17.0 ejecutada: Context Registry v1');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de tabla ya existe, es OK (idempotente)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        )) {
          console.log('ℹ️  Migración v5.17.0 ya aplicada (tablas existentes)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          // Verificar si las tablas ya existen (migración aplicada por otro usuario)
          try {
            const checkResult = await pool.query(`
              SELECT COUNT(*) as count FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('pde_contexts', 'pde_context_audit_log')
            `);
            if (parseInt(checkResult.rows[0].count) >= 2) {
              console.log('ℹ️  Migración v5.17.0 ya aplicada (tablas existentes con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.17.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.17.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.17.0:', error.message);
        }
      }
    }
    
    // Migración v5.18.0: Señales Registry v1 (Sistema de Señales PDE)
    const migration518Path = join(__dirname, 'migrations', 'v5.18.0-create-pde-senales.sql');
    try {
      const migrationSQL = readFileSync(migration518Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.18.0 ejecutada: Señales Registry v1');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de tabla ya existe, es OK (idempotente)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        )) {
          console.log('ℹ️  Migración v5.18.0 ya aplicada (tablas existentes)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          // Verificar si las tablas ya existen (migración aplicada por otro usuario)
          try {
            const checkResult = await pool.query(`
              SELECT COUNT(*) as count FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('pde_signals', 'pde_signal_audit_log')
            `);
            if (parseInt(checkResult.rows[0].count) >= 2) {
              console.log('ℹ️  Migración v5.18.0 ya aplicada (tablas existentes con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.18.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.18.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.18.0:', error.message);
        }
      }
    }
    
    // Migración v5.19.0: Motor de Automatizaciones v1 (Señales → Acciones)
    const migration519Path = join(__dirname, 'migrations', 'v5.19.0-pde-automations-engine-v1.sql');
    try {
      const migrationSQL = readFileSync(migration519Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.19.0 ejecutada: Motor de Automatizaciones v1');
    } catch (error) {
      // Si el archivo no existe o ya está aplicada, ignorar
      if (error.code !== 'ENOENT') {
        // Si es error de tabla ya existe, es OK (idempotente)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        )) {
          console.log('ℹ️  Migración v5.19.0 ya aplicada (tablas existentes)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          // Verificar si las tablas ya existen (migración aplicada por otro usuario)
          try {
            const checkResult = await pool.query(`
              SELECT COUNT(*) as count FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('pde_automations', 'pde_automation_audit_log', 'pde_automation_executions')
            `);
            if (parseInt(checkResult.rows[0].count) >= 3) {
              console.log('ℹ️  Migración v5.19.0 ya aplicada (tablas existentes con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.19.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.19.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.19.0:', error.message);
        }
      }
    }
    
    // Migración v5.5.0: Sistema de Versionado de Navegación (DRAFT/PUBLISH)
    try {
      // Verificar si las tablas ya existen ANTES de intentar aplicar
      const checkResult = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('navigation_definitions', 'navigation_drafts', 'navigation_versions', 'navigation_audit_log')
      `);
      
      const count = parseInt(checkResult.rows[0].count);
      if (count >= 3) {
        console.log('ℹ️  Migración v5.5.0 ya aplicada (tablas existentes)');
      } else {
        // Solo aplicar si faltan tablas
        const migration55Path = join(__dirname, 'migrations', 'v5.5.0-navigation-versioning-v1.sql');
        const migrationSQL = readFileSync(migration55Path, 'utf-8');
        // Ejecutar SQL completo (las funciones con $$ se manejan mejor así)
        await pool.query(migrationSQL);
        console.log('✅ Migración v5.5.0 ejecutada: navigation_definitions, navigation_drafts, navigation_versions, navigation_audit_log');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        )) {
          console.log('ℹ️  Migración v5.5.0 ya aplicada (objetos existentes)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          // Verificar si las tablas ya existen (migración aplicada por otro usuario)
          try {
            const checkResult = await pool.query(`
              SELECT COUNT(*) as count FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('navigation_definitions', 'navigation_drafts', 'navigation_versions', 'navigation_audit_log')
            `);
            if (parseInt(checkResult.rows[0].count) >= 3) {
              console.log('ℹ️  Migración v5.5.0 ya aplicada (tablas existentes con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.5.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.5.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.5.0:', error.message);
        }
      }
    }
    
    // Migración v5.21.0: Sistema de Widgets PDE (RECONSTRUCCIÓN COMPLETA)
    const migration521Path = join(__dirname, 'migrations', 'v5.21.0-create-pde-widgets.sql');
    try {
      const migrationSQL = readFileSync(migration521Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.21.0 ejecutada: Sistema de Widgets PDE');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        )) {
          console.log('ℹ️  Migración v5.21.0 ya aplicada (tablas existentes)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          try {
            const checkResult = await pool.query(`
              SELECT COUNT(*) as count FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('pde_widgets', 'pde_widget_drafts', 'pde_widget_versions', 'pde_widget_audit_log')
            `);
            if (parseInt(checkResult.rows[0].count) >= 4) {
              console.log('ℹ️  Migración v5.21.0 ya aplicada (tablas existentes con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.21.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.21.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.21.0:', error.message);
        }
      }
    }
    
    // Migración v5.22.0: Añadir Versionado Completo a Paquetes PDE
    const migration522Path = join(__dirname, 'migrations', 'v5.22.0-add-versioning-to-pde-packages.sql');
    try {
      const migrationSQL = readFileSync(migration522Path, 'utf-8');
      await pool.query(migrationSQL);
      console.log('✅ Migración v5.22.0 ejecutada: Versionado completo a paquetes PDE');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        )) {
          console.log('ℹ️  Migración v5.22.0 ya aplicada (tablas existentes)');
        } else if (error.message && (
          error.message.includes('must be owner') ||
          error.message.includes('permission denied')
        )) {
          try {
            const checkResult = await pool.query(`
              SELECT COUNT(*) as count FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('pde_package_drafts', 'pde_package_versions', 'pde_package_audit_log')
            `);
            if (parseInt(checkResult.rows[0].count) >= 3) {
              console.log('ℹ️  Migración v5.22.0 ya aplicada (tablas existentes con permisos limitados)');
            } else {
              console.warn('⚠️  Error ejecutando migración v5.22.0:', error.message);
            }
          } catch (checkError) {
            console.warn('⚠️  Error ejecutando migración v5.22.0:', error.message);
          }
        } else {
          console.warn('⚠️  Error ejecutando migración v5.22.0:', error.message);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️  Error ejecutando migraciones:', error.message);
  }
}
