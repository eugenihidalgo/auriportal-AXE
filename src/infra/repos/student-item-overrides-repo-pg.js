/**
 * STUDENT ITEM OVERRIDES REPOSITORY PG v1 - AuriPortal
 * 
 * Implementación PostgreSQL del repositorio de student_item_overrides (UUID-only).
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - student_uuid (UUID) es la identidad soberana
 * - Override ≠ Mutación (nunca modifica valor base)
 * - Auditable y reversible
 */

import { query } from '../../../database/pg.js';
import { logError, logInfo } from '../../core/observability/logger.js';

/**
 * Repositorio de Student Item Overrides - Implementación PostgreSQL
 */
export class StudentItemOverridesRepoPg {
  /**
   * Crea un override de configuración de item
   * 
   * @param {Object} data - Datos del override
   * @param {string} data.student_uuid - UUID canónico del estudiante
   * @param {string} data.item_ref - Referencia del item
   * @param {string} data.override_key - Clave del override (ej: required_count, threshold_days)
   * @param {*} data.override_value - Valor del override (se serializa a JSONB)
   * @param {string} [data.reason] - Razón del override (opcional)
   * @param {string} [data.created_by] - Quién creó el override (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object>} Override creado
   */
  async create(data, client = null) {
    const { student_uuid, item_ref, override_key, override_value, reason = null, created_by = null } = data;
    
    if (!student_uuid || !item_ref || !override_key || override_value === undefined) {
      throw new Error('student_uuid, item_ref, override_key y override_value son requeridos');
    }
    
    const queryFn = client ? client.query.bind(client) : query;
    
    try {
      const result = await queryFn(`
        INSERT INTO student_item_overrides (student_uuid, item_ref, override_key, override_value, reason, created_by, created_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, now())
        RETURNING *
      `, [student_uuid, item_ref, override_key, JSON.stringify(override_value), reason, created_by]);
      
      logInfo('StudentItemOverridesRepo', 'Item override creado', {
        student_uuid,
        item_ref,
        override_key,
        override_id: result.rows[0].id
      });
      
      return result.rows[0];
    } catch (error) {
      // Si es error de unicidad, lanzar error más descriptivo
      if (error.code === '23505') { // Unique violation
        throw new Error(`Override para student_uuid=${student_uuid}, item_ref=${item_ref} y override_key=${override_key} ya existe`);
      }
      logError('StudentItemOverridesRepo', 'Error creando item override', {
        student_uuid,
        item_ref,
        override_key,
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
        UPDATE student_item_overrides
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);
      
      if (result.rows.length === 0) {
        throw new Error(`Override con id=${id} no encontrado`);
      }
      
      logInfo('StudentItemOverridesRepo', 'Item override actualizado', {
        override_id: id
      });
      
      return result.rows[0];
    } catch (error) {
      logError('StudentItemOverridesRepo', 'Error actualizando item override', {
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
        DELETE FROM student_item_overrides
        WHERE id = $1
        RETURNING id
      `, [id]);
      
      const deleted = result.rows.length > 0;
      
      if (deleted) {
        logInfo('StudentItemOverridesRepo', 'Item override eliminado', {
          override_id: id
        });
      }
      
      return deleted;
    } catch (error) {
      logError('StudentItemOverridesRepo', 'Error eliminando item override', {
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
      SELECT * FROM student_item_overrides 
      WHERE id = $1
    `, [id]);
    
    return result.rows[0] || null;
  }

  /**
   * Obtiene un override por student_uuid, item_ref y override_key
   * 
   * @param {string} student_uuid - UUID canónico del estudiante
   * @param {string} item_ref - Referencia del item
   * @param {string} override_key - Clave del override
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Object|null>} Override encontrado o null
   */
  async getByStudentItemAndKey(student_uuid, item_ref, override_key, client = null) {
    if (!student_uuid || !item_ref || !override_key) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM student_item_overrides 
      WHERE student_uuid = $1 AND item_ref = $2 AND override_key = $3
    `, [student_uuid, item_ref, override_key]);
    
    return result.rows[0] || null;
  }

  /**
   * Lista todos los overrides de un estudiante
   * 
   * @param {string} student_uuid - UUID canónico del estudiante
   * @param {Object} [options] - Opciones de filtrado
   * @param {string} [options.item_ref] - Filtrar por item_ref (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional)
   * @returns {Promise<Array>} Array de overrides
   */
  async listByStudent(student_uuid, options = {}, client = null) {
    if (!student_uuid) return [];
    
    const { item_ref } = options;
    const queryFn = client ? client.query.bind(client) : query;
    
    let sql = `
      SELECT * FROM student_item_overrides 
      WHERE student_uuid = $1
    `;
    const params = [student_uuid];
    
    if (item_ref) {
      sql += ` AND item_ref = $2`;
      params.push(item_ref);
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    const result = await queryFn(sql, params);
    
    return result.rows || [];
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;
export function getDefaultStudentItemOverridesRepoPg() {
  if (!defaultInstance) {
    defaultInstance = new StudentItemOverridesRepoPg();
  }
  return defaultInstance;
}

export default getDefaultStudentItemOverridesRepoPg();
