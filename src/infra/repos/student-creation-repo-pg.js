// src/infra/repos/student-creation-repo-pg.js
// Implementación PostgreSQL del Repositorio de Creación de Alumnos (UUID-first)
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con creación de alumnos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para creación de alumnos
// - Creación UUID-first (students como SOT)
// - Creación en alumnos (legacy) solo para compatibilidad
// - Transacción atómica (students + alumnos en misma transacción)
// - Idempotencia por email (retorna existente si ya existe)

import { query, getPool } from '../../../database/pg.js';

/**
 * Repositorio de Creación de Alumnos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de creación de alumnos.
 * Retorna objetos con { student_uuid, legacy_alumno_id, email }.
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class StudentCreationRepoPg {
  /**
   * Crea un alumno canónico (UUID-first)
   * 
   * @param {Object} data - Datos del alumno
   * @param {string} data.email - Email (obligatorio, único)
   * @param {string} [data.apodo] - Apodo (opcional)
   * @param {string} [data.nombre_completo] - Nombre completo (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} { student_uuid, legacy_alumno_id, email }
   * @throws {Error} Si email es requerido o hay error de base de datos
   */
  async createStudent(data, client = null) {
    const { email, apodo = null, nombre_completo = null } = data;
    
    if (!email) {
      throw new Error('email es requerido para crear un alumno');
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    const queryFn = client ? client.query.bind(client) : query;
    
    // Verificar si ya existe (idempotencia por email)
    const existingResult = await queryFn(`
      SELECT s.id as student_uuid, s.legacy_alumno_id, a.email, a.apodo, a.nombre_completo
      FROM students s
      LEFT JOIN alumnos a ON s.legacy_alumno_id = a.id
      WHERE a.email = $1 AND s.deleted_at IS NULL
      LIMIT 1
    `, [normalizedEmail]);
    
    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      return {
        student_uuid: existing.student_uuid,
        legacy_alumno_id: existing.legacy_alumno_id,
        email: existing.email,
        apodo: existing.apodo || null,
        nombre_completo: existing.nombre_completo || null
      };
    }
    
    // Si no existe, crear en transacción
    // Usar transacción explícita si no se proporciona client
    if (!client) {
      const pool = getPool();
      const transactionClient = await pool.connect();
      
      try {
        await transactionClient.query('BEGIN');
        
        // Crear en alumnos (legacy) primero
        const alumnoResult = await transactionClient.query(`
          INSERT INTO alumnos (email, apodo, nombre_completo, fecha_inscripcion, nivel_actual, streak, estado_suscripcion)
          VALUES ($1, $2, $3, now(), 1, 0, 'activa')
          RETURNING id, email, apodo, nombre_completo
        `, [normalizedEmail, apodo || null, nombre_completo || null]);
        
        const alumnoId = alumnoResult.rows[0].id;
        const alumno = alumnoResult.rows[0];
        
        // Crear en students (UUID) con legacy_alumno_id
        const studentResult = await transactionClient.query(`
          INSERT INTO students (status, legacy_alumno_id, created_at, updated_at)
          VALUES ('NORMAL', $1, now(), now())
          RETURNING id
        `, [alumnoId]);
        
        const studentUuid = studentResult.rows[0].id;
        
        await transactionClient.query('COMMIT');
        
        return {
          student_uuid: studentUuid,
          legacy_alumno_id: alumnoId,
          email: normalizedEmail,
          apodo: alumno.apodo || null,
          nombre_completo: alumno.nombre_completo || null
        };
      } catch (error) {
        await transactionClient.query('ROLLBACK');
        
        // Si es error de unicidad (email duplicado), tratar como idempotencia
        if (error.code === '23505' && error.constraint?.includes('email')) {
          // Buscar el existente y retornarlo
          const existingResult = await query(`
            SELECT s.id as student_uuid, s.legacy_alumno_id, a.email, a.apodo, a.nombre_completo
            FROM students s
            LEFT JOIN alumnos a ON s.legacy_alumno_id = a.id
            WHERE a.email = $1 AND s.deleted_at IS NULL
            LIMIT 1
          `, [normalizedEmail]);
          
          if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];
            return {
              student_uuid: existing.student_uuid,
              legacy_alumno_id: existing.legacy_alumno_id,
              email: existing.email,
              apodo: existing.apodo || null,
              nombre_completo: existing.nombre_completo || null
            };
          }
        }
        
        throw error;
      } finally {
        transactionClient.release();
      }
    } else {
      // Si se proporciona client, usar transacción externa
      // Crear en alumnos (legacy) primero
      const alumnoResult = await queryFn(`
        INSERT INTO alumnos (email, apodo, nombre_completo, fecha_inscripcion, nivel_actual, streak, estado_suscripcion)
        VALUES ($1, $2, $3, now(), 1, 0, 'activa')
        RETURNING id, email, apodo, nombre_completo
      `, [normalizedEmail, apodo || null, nombre_completo || null]);
      
      const alumnoId = alumnoResult.rows[0].id;
      const alumno = alumnoResult.rows[0];
      
      // Crear en students (UUID) con legacy_alumno_id
      const studentResult = await queryFn(`
        INSERT INTO students (status, legacy_alumno_id, created_at, updated_at)
        VALUES ('NORMAL', $1, now(), now())
        RETURNING id
      `, [alumnoId]);
      
      const studentUuid = studentResult.rows[0].id;
      
      return {
        student_uuid: studentUuid,
        legacy_alumno_id: alumnoId,
        email: normalizedEmail,
        apodo: alumno.apodo || null,
        nombre_completo: alumno.nombre_completo || null
      };
    }
  }
}

// Singleton para evitar múltiples instancias
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {StudentCreationRepoPg} Instancia del repositorio
 */
export function getDefaultStudentCreationRepo() {
  if (!defaultInstance) {
    defaultInstance = new StudentCreationRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultStudentCreationRepo();
