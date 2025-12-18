// src/infra/repos/nivel-override-repo-pg.js
// Implementación PostgreSQL del Repositorio de Overrides de Nivel
//
// Encapsula todas las operaciones de base de datos relacionadas con overrides
// de nivel del Master (ajustes manuales auditables).

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Overrides de Nivel - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con overrides.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 */
export class NivelOverrideRepoPg {
  /**
   * Busca todos los overrides activos de un alumno
   * (solo los más recientes, sin revocar)
   * 
   * @param {number|string} studentIdOrEmail - ID del alumno o email
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de objetos override ordenados por created_at DESC
   */
  async findByStudent(studentIdOrEmail, client = null) {
    if (!studentIdOrEmail) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    
    // Buscar por ID o email
    const isEmail = typeof studentIdOrEmail === 'string' && studentIdOrEmail.includes('@');
    const whereClause = isEmail 
      ? 'no.student_email = $1'
      : 'no.student_id = $1';
    
    const result = await queryFn(`
      SELECT no.*
      FROM nivel_overrides no
      WHERE ${whereClause}
        AND no.revoked_at IS NULL
      ORDER BY no.created_at DESC
    `, [studentIdOrEmail]);
    
    return result.rows;
  }

  /**
   * Obtiene el override activo más reciente de un alumno
   * 
   * @param {number|string} studentIdOrEmail - ID del alumno o email
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto override o null si no hay override activo
   */
  async getActiveOverride(studentIdOrEmail, client = null) {
    if (!studentIdOrEmail) return null;
    
    const overrides = await this.findByStudent(studentIdOrEmail, client);
    return overrides.length > 0 ? overrides[0] : null;
  }

  /**
   * Crea un nuevo override
   * 
   * @param {Object} overrideData - Datos del override
   * @param {number} [overrideData.student_id] - ID del alumno (opcional si se usa email)
   * @param {string} [overrideData.student_email] - Email del alumno (opcional si se usa ID)
   * @param {string} overrideData.type - Tipo de override ('ADD', 'SET', 'MIN')
   * @param {number} overrideData.value - Valor del override
   * @param {string} overrideData.reason - Razón del override
   * @param {string} [overrideData.created_by] - Usuario que crea el override (default: 'system')
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto override creado
   */
  async create(overrideData, client = null) {
    const { student_id, student_email, type, value, reason, created_by = 'system' } = overrideData;
    
    if (!type || !value || !reason) {
      throw new Error('NivelOverrideRepo: type, value y reason son requeridos');
    }
    
    if (!student_id && !student_email) {
      throw new Error('NivelOverrideRepo: se requiere student_id o student_email');
    }
    
    if (!['ADD', 'SET', 'MIN'].includes(type)) {
      throw new Error(`NivelOverrideRepo: type debe ser 'ADD', 'SET' o 'MIN', recibido: ${type}`);
    }
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO nivel_overrides (student_id, student_email, type, value, reason, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [student_id || null, student_email || null, type, value, reason, created_by]);
    
    return result.rows[0];
  }

  /**
   * Revoca un override (soft delete)
   * 
   * @param {number} overrideId - ID del override
   * @param {string} [revokedBy] - Usuario que revoca (default: 'system')
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto override revocado
   */
  async revoke(overrideId, revokedBy = 'system', client = null) {
    if (!overrideId) {
      throw new Error('NivelOverrideRepo: se requiere overrideId');
    }
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE nivel_overrides
      SET revoked_at = CURRENT_TIMESTAMP,
          revoked_by = $1
      WHERE id = $2
      RETURNING *
    `, [revokedBy, overrideId]);
    
    if (result.rows.length === 0) {
      throw new Error(`NivelOverrideRepo: override ${overrideId} no encontrado`);
    }
    
    return result.rows[0];
  }

  /**
   * Revoca todos los overrides activos de un alumno
   * 
   * @param {number|string} studentIdOrEmail - ID del alumno o email
   * @param {string} [revokedBy] - Usuario que revoca (default: 'system')
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Número de overrides revocados
   */
  async revokeAll(studentIdOrEmail, revokedBy = 'system', client = null) {
    if (!studentIdOrEmail) return 0;
    
    const queryFn = client ? client.query.bind(client) : query;
    const isEmail = typeof studentIdOrEmail === 'string' && studentIdOrEmail.includes('@');
    const whereClause = isEmail 
      ? 'student_email = $1'
      : 'student_id = $1';
    
    const result = await queryFn(`
      UPDATE nivel_overrides
      SET revoked_at = CURRENT_TIMESTAMP,
          revoked_by = $2
      WHERE ${whereClause}
        AND revoked_at IS NULL
    `, [studentIdOrEmail, revokedBy]);
    
    return result.rowCount || 0;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Factory function para obtener instancia del repositorio
 * 
 * @returns {NivelOverrideRepoPg} Instancia del repositorio
 */
export function getDefaultNivelOverrideRepo() {
  if (!defaultInstance) {
    defaultInstance = new NivelOverrideRepoPg();
  }
  return defaultInstance;
}

// Exportar también la instancia para compatibilidad con default imports
export default getDefaultNivelOverrideRepo();






