/**
 * STUDENT OVERRIDES REPOSITORY PG v1 - AuriPortal
 * 
 * Implementación PostgreSQL del repositorio de student_overrides (UUID-only).
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - student_uuid (UUID) es la identidad soberana
 * - Override ≠ Mutación (nunca modifica valor base)
 * - Auditable y reversible
 */

import { query } from '../../../database/pg.js';
import { logError, logInfo } from '../../core/observability/logger.js';

/**
 * Repositorio de Student Overrides - Implementación PostgreSQL
 */
export class StudentOverridesRepoPg {
  /**
   * Crea un override de campo de alumno
   * 
   * @param {Object} data - Datos del override
   * @param {string} data.student_uuid - UUID canónico del estudiante
   * @param {string} data.field_key - Clave del campo (ej: nivel, fecha_creacion, apodo)
   * @param {*} data.override_value - Valor del override (se serializa a JSONB)
   * @param {string} [data.reason] - Razón del override (opcional)
   * @param {string} [data.created_by] - Quién creó el override (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object>} Override creado
   */
  async create(data, client = null) {
    const { student_uuid, field_key, override_value, reason = null, created_by = null } = data;
    
    if (!student_uuid || !field_key || override_value === undefined) {
      throw new Error('student_uuid, field_key y override_value son requeridos');
    }
    
    const queryFn = client ? client.query.bind(client) : query;
    
    try {
      const result = await queryFn(`
        INSERT INTO student_overrides (student_uuid, field_key, override_value, reason, created_by, created_at)
        VALUES ($1, $2, $3::jsonb, $4, $5, now())
        RETURNING *
      `, [student_uuid, field_key, JSON.stringify(override_value), reason, created_by]);
      
      logInfo('StudentOverridesRepo', 'Override creado', {
        student_uuid,
        field_key,
        override_id: result.rows[0].id
      });
      
      return result.rows[0];
    } catch (error) {
      // Si es error de unicidad, lanzar error más descriptivo
      if (error.code === '23505') { // Unique violation
        throw new Error(`Override para student_uuid=${student_uuid} y field_key=${field_key} ya existe`);
      }
      logError('StudentOverridesRepo', 'Error creando override', {
        student_uuid,
        field_key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Actualiza un override existente
   * 
   * @param {string} id - UUID del override
   * @param {Object} data - Datos a actualizar
   * @param {*} [data.override_value] - Nuevo valor del override
   * @param {string} [data.reason] - Nueva razón
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object>} Override actualizado
   */
  async update(id, data, client = null) {
    if (!id) {
      throw new Error('id es requerido');
    }
    
    const { override_value, reason } = data;
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (override_value !== undefined) {
      updates.push(`override_value = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(override_value));
      paramIndex++;
    }
    
    if (reason !== undefined) {
      updates.push(`reason = $${paramIndex}`);
      values.push(reason);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      throw new Error('No hay campos para actualizar');
    }
    
    values.push(id);
    
    const queryFn = client ? client.query.bind(client) : query;
    
    try {
      const result = await queryFn(`
        UPDATE student_overrides
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
      
      if (result.rows.length === 0) {
        throw new Error(`Override con id=${id} no encontrado`);
      }
      
      logInfo('StudentOverridesRepo', 'Override actualizado', {
        override_id: id
      });
      
      return result.rows[0];
    } catch (error) {
      logError('StudentOverridesRepo', 'Error actualizando override', {
        override_id: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Elimina un override
   * 
   * @param {string} id - UUID del override
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async delete(id, client = null) {
    if (!id) {
      throw new Error('id es requerido');
    }
    
    const queryFn = client ? client.query.bind(client) : query;
    
    try {
      const result = await queryFn(`
        DELETE FROM student_overrides
        WHERE id = $1
        RETURNING id
      `, [id]);
      
      const deleted = result.rows.length > 0;
      
      if (deleted) {
        logInfo('StudentOverridesRepo', 'Override eliminado', {
          override_id: id
        });
      }
      
      return deleted;
    } catch (error) {
      logError('StudentOverridesRepo', 'Error eliminando override', {
        override_id: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene un override por ID
   * 
   * @param {string} id - UUID del override
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Override encontrado o null
   */
  async getById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM student_overrides 
      WHERE id = $1
    `, [id]);
    
    return result.rows[0] || null;
  }

  /**
   * Obtiene un override por student_uuid y field_key
   * 
   * @param {string} student_uuid - UUID canónico del estudiante
   * @param {string} field_key - Clave del campo
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Override encontrado o null
   */
  async getByStudentAndField(student_uuid, field_key, client = null) {
    if (!student_uuid || !field_key) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM student_overrides 
      WHERE student_uuid = $1 AND field_key = $2
    `, [student_uuid, field_key]);
    
    return result.rows[0] || null;
  }

  /**
   * Lista todos los overrides de un estudiante
   * 
   * @param {string} student_uuid - UUID canónico del estudiante
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de overrides
   */
  async listByStudent(student_uuid, client = null) {
    if (!student_uuid) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM student_overrides 
      WHERE student_uuid = $1
      ORDER BY created_at DESC
    `, [student_uuid]);
    
    return result.rows || [];
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;
export function getDefaultStudentOverridesRepoPg() {
  if (!defaultInstance) {
    defaultInstance = new StudentOverridesRepoPg();
  }
  return defaultInstance;
}

export default getDefaultStudentOverridesRepoPg();
