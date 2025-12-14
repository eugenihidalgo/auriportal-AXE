-- Schema de Base de Datos para AuriPortal v3.1
-- SQLite (puede adaptarse a PostgreSQL)

-- Tabla principal de estudiantes
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    clickup_task_id TEXT UNIQUE,
    nombre TEXT,
    apodo TEXT,
    nivel TEXT,
    racha_actual INTEGER DEFAULT 0,
    ultima_practica_date TEXT,
    fecha_inscripcion TEXT,
    tiene_mundo_de_luz INTEGER DEFAULT 0, -- 0 = false, 1 = true
    suscripcion_pausada INTEGER DEFAULT 0, -- 0 = false, 1 = true
    sync_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_clickup_task_id ON students(clickup_task_id);
CREATE INDEX IF NOT EXISTS idx_students_nivel ON students(nivel);

-- Tabla de log de sincronización
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL, -- 'create', 'update', 'delete'
    clickup_task_id TEXT,
    email TEXT,
    success INTEGER DEFAULT 1, -- 0 = false, 1 = true
    error_message TEXT,
    synced_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de temas/contenido (opcional, si quieres cachear)
CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id TEXT UNIQUE NOT NULL,
    title TEXT,
    content TEXT,
    order_index INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de prácticas (opcional, para tracking)
CREATE TABLE IF NOT EXISTS practices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    practice_date TEXT NOT NULL,
    topic_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_practices_student_id ON practices(student_id);
CREATE INDEX IF NOT EXISTS idx_practices_practice_date ON practices(practice_date);

