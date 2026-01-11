/**
 * STUDENTS REPOSITORY PG v1 - AuriPortal
 * 
 * Implementación PostgreSQL del repositorio de students (UUID-only).
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - students.id (UUID) es la identidad soberana
 * - Email es único (case-insensitive)
 * - Solo para el mundo nuevo (sin legacy)
 */

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Students - Implementación PostgreSQL
 */
export class StudentsRepoPg {
  /**
   * Crea un nuevo student (UUID-only)
   * 
   * @param {Object} data - Datos del student
   * @param {string} data.email - Email (requerido, único)
   * @param {string} [data.apodo] - Apodo (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object>} Student creado
   */
  async create(data, client = null) {
    const { email, apodo = null } = data;
    
    if (!email) {
      throw new Error('email es requerido');
    }
    
    const queryFn = client ? client.query.bind(client) : query;
    
    try {
      const result = await queryFn(`
        INSERT INTO students (email, apodo, status, created_at, updated_at)
        VALUES (LOWER(TRIM($1)), $2, 'NORMAL', now(), now())
        RETURNING *
      `, [email, apodo]);
      
      return result.rows[0];
    } catch (error) {
      // Si es error de unicidad, lanzar error más descriptivo
      if (error.code === '23505') { // Unique violation
        throw new Error(`Student con email ${email} ya existe`);
      }
      throw error;
    }
  }

  /**
   * Busca un student por email (case-insensitive)
   * 
   * @param {string} email - Email del student
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Student encontrado o null
   */
  async getByEmail(email, client = null) {
    if (!email) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM students 
      WHERE LOWER(email) = LOWER($1) 
      AND deleted_at IS NULL
    `, [email]);
    
    return result.rows[0] || null;
  }

  /**
   * Busca un student por ID (UUID)
   * 
   * @param {string} id - UUID del student
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Student encontrado o null
   */
  async getById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM students 
      WHERE id = $1 
      AND deleted_at IS NULL
    `, [id]);
    
    return result.rows[0] || null;
  }

  /**
   * Lista todos los students
   * 
   * @param {Object} [options] - Opciones de listado
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de students
   */
  async list(options = {}, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM students 
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);
    
    return result.rows || [];
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;
export function getDefaultStudentsRepoPg() {
  if (!defaultInstance) {
    defaultInstance = new StudentsRepoPg();
  }
  return defaultInstance;
}

export default getDefaultStudentsRepoPg();
