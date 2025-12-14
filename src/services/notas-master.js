// src/services/notas-master.js
// Servicio para gestionar notas del Master (PostgreSQL)

import { query } from '../../database/pg.js';

/**
 * Validar que el alumno tiene suscripción activa
 */
export async function validarSuscripcionActiva(alumnoId) {
  const result = await query(
    `SELECT id FROM alumnos 
     WHERE id = $1 AND estado_suscripcion = 'activa'`,
    [alumnoId]
  );
  return result.rows.length > 0;
}

/**
 * Crear la tabla notas_master si no existe
 */
async function crearTablaSiNoExiste() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS notas_master (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tipo VARCHAR(50) DEFAULT 'general',
        contenido TEXT NOT NULL,
        adjuntos JSONB DEFAULT '[]',
        creado_por VARCHAR(100) DEFAULT 'Master',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crear índices si no existen
    await query(`
      CREATE INDEX IF NOT EXISTS idx_notas_master_alumno ON notas_master(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_notas_master_fecha ON notas_master(fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_notas_master_tipo ON notas_master(tipo);
    `);
  } catch (error) {
    // Si la tabla ya existe, ignorar el error
    if (error.code !== '42P07') { // 42P07 = duplicate_table
      console.error('Error creando tabla notas_master:', error);
    }
  }
}

/**
 * Obtener todas las notas de un alumno
 */
export async function obtenerNotasAlumno(alumnoId) {
  // Validar suscripción activa
  const esActivo = await validarSuscripcionActiva(alumnoId);
  if (!esActivo) {
    throw new Error('Alumno no tiene suscripción activa');
  }

  // Asegurar que la tabla existe
  await crearTablaSiNoExiste();

  try {
    const result = await query(
      `SELECT 
        id,
        alumno_id,
        fecha,
        tipo,
        contenido,
        adjuntos,
        creado_por,
        created_at,
        updated_at
      FROM notas_master
      WHERE alumno_id = $1
      ORDER BY fecha DESC`,
      [alumnoId]
    );
    
    return result.rows;
  } catch (error) {
    // Si la tabla no existe, retornar array vacío
    if (error.code === '42P01') { // 42P01 = undefined_table
      console.warn('Tabla notas_master no existe, retornando array vacío');
      return [];
    }
    throw error;
  }
}

/**
 * Crear una nueva nota
 */
export async function crearNota(alumnoId, datos) {
  // Validar suscripción activa
  const esActivo = await validarSuscripcionActiva(alumnoId);
  if (!esActivo) {
    throw new Error('Alumno no tiene suscripción activa');
  }

  // Asegurar que la tabla existe
  await crearTablaSiNoExiste();

  const { fecha, tipo, contenido, adjuntos, creado_por } = datos;
  
  const result = await query(
    `INSERT INTO notas_master (
      alumno_id,
      fecha,
      tipo,
      contenido,
      adjuntos,
      creado_por
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      alumnoId,
      fecha || new Date().toISOString(),
      tipo || 'general',
      contenido,
      adjuntos ? JSON.stringify(adjuntos) : '[]',
      creado_por || 'Master'
    ]
  );
  
  return result.rows[0];
}

/**
 * Actualizar una nota
 */
export async function actualizarNota(notaId, datos) {
  const { fecha, tipo, contenido, adjuntos } = datos;
  
  // Obtener alumno_id de la nota para validar
  const notaResult = await query(
    'SELECT alumno_id FROM notas_master WHERE id = $1',
    [notaId]
  );
  
  if (notaResult.rows.length === 0) {
    throw new Error('Nota no encontrada');
  }
  
  const alumnoId = notaResult.rows[0].alumno_id;
  const esActivo = await validarSuscripcionActiva(alumnoId);
  if (!esActivo) {
    throw new Error('Alumno no tiene suscripción activa');
  }
  
  const result = await query(
    `UPDATE notas_master
    SET 
      fecha = $1,
      tipo = $2,
      contenido = $3,
      adjuntos = $4,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *`,
    [
      fecha,
      tipo,
      contenido,
      adjuntos ? JSON.stringify(adjuntos) : '[]',
      notaId
    ]
  );
  
  return result.rows[0];
}

/**
 * Eliminar una nota
 */
export async function eliminarNota(notaId) {
  // Obtener alumno_id de la nota para validar
  const notaResult = await query(
    'SELECT alumno_id FROM notas_master WHERE id = $1',
    [notaId]
  );
  
  if (notaResult.rows.length === 0) {
    throw new Error('Nota no encontrada');
  }
  
  const alumnoId = notaResult.rows[0].alumno_id;
  const esActivo = await validarSuscripcionActiva(alumnoId);
  if (!esActivo) {
    throw new Error('Alumno no tiene suscripción activa');
  }
  
  const result = await query(
    'DELETE FROM notas_master WHERE id = $1 RETURNING id',
    [notaId]
  );
  
  return result.rows[0];
}
