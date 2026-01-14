// src/infra/repos/student-creation-repo-pg.js
// Implementación PostgreSQL del Repositorio de Creación de Alumnos (UUID-only)
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con creación de alumnos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para creación de alumnos
// - Creación UUID-only (students como SOT único)
// - display_name (apodo, nombre_completo) ahora está en students
// - Idempotencia por email (retorna existente si ya existe)

import { query, getPool } from '../../../database/pg.js';

/**
 * Repositorio de Creación de Alumnos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de creación de alumnos.
 * UUID-ONLY: Retorna objetos con { student_uuid, email, apodo, nombre_completo }.
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class StudentCreationRepoPg {
  /**
   * Crea un alumno canónico (UUID-only)
   * 
   * @param {Object} data - Datos del alumno
   * @param {string} data.email - Email (obligatorio, único)
   * @param {string} [data.apodo] - Apodo (opcional)
   * @param {string} [data.nombre_completo] - Nombre completo (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} { student_uuid, email, apodo, nombre_completo }
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
    // UUID-ONLY: Buscar directamente en students (sin JOIN a alumnos)
    const existingResult = await queryFn(`
      SELECT id as student_uuid, email, apodo, nombre_completo
      FROM students
      WHERE email = $1 AND deleted_at IS NULL
      LIMIT 1
    `, [normalizedEmail]);
    
    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      return {
        student_uuid: existing.student_uuid,
        email: existing.email,
        apodo: existing.apodo || null,
        nombre_completo: existing.nombre_completo || null
      };
    }
    
    // Si no existe, crear SOLO en students (UUID-only)
    // Usar transacción explícita si no se proporciona client
    if (!client) {
      const pool = getPool();
      const transactionClient = await pool.connect();
      
      try {
        await transactionClient.query('BEGIN');
        
        // Crear SOLO en students (UUID-only, sin legacy)
        const studentResult = await transactionClient.query(`
          INSERT INTO students (status, email, apodo, nombre_completo, created_at, updated_at)
          VALUES ('NORMAL', $1, $2, $3, now(), now())
          RETURNING id, email, apodo, nombre_completo
        `, [normalizedEmail, apodo || null, nombre_completo || null]);
        
        const student = studentResult.rows[0];
        const studentUuid = student.id;
        
        await transactionClient.query('COMMIT');
        
        return {
          student_uuid: studentUuid,
          email: student.email,
          apodo: student.apodo || null,
          nombre_completo: student.nombre_completo || null
        };
      } catch (error) {
        await transactionClient.query('ROLLBACK');
        
        // Si es error de unicidad (email duplicado), tratar como idempotencia
        if (error.code === '23505' && error.constraint?.includes('email')) {
          // Buscar el existente y retornarlo
          const existingResult = await query(`
            SELECT id as student_uuid, email, apodo, nombre_completo
            FROM students
            WHERE email = $1 AND deleted_at IS NULL
            LIMIT 1
          `, [normalizedEmail]);
          
          if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];
            return {
              student_uuid: existing.student_uuid,
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
      // Crear SOLO en students (UUID-only, sin legacy)
      const studentResult = await queryFn(`
        INSERT INTO students (status, email, apodo, nombre_completo, created_at, updated_at)
        VALUES ('NORMAL', $1, $2, $3, now(), now())
        RETURNING id, email, apodo, nombre_completo
      `, [normalizedEmail, apodo || null, nombre_completo || null]);
      
      const student = studentResult.rows[0];
      const studentUuid = student.id;
      
      return {
        student_uuid: studentUuid,
        email: student.email,
        apodo: student.apodo || null,
        nombre_completo: student.nombre_completo || null
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
