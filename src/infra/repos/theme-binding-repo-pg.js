// src/infra/repos/theme-binding-repo-pg.js
// Implementación PostgreSQL del Repositorio de Theme Bindings v1
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con bindings de temas en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para bindings
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Theme Bindings - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con bindings.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class ThemeBindingRepoPg {
  /**
   * Obtiene un binding por scope_type y scope_key
   * 
   * @param {string} scope_type - Tipo de scope
   * @param {string} scope_key - Clave del scope
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto binding o null si no existe
   */
  async getBinding(scope_type, scope_key, client = null) {
    if (!scope_type || !scope_key) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM theme_bindings
      WHERE scope_type = $1
        AND scope_key = $2
        AND deleted_at IS NULL
    `, [scope_type, scope_key]);

    return result.rows[0] || null;
  }

  /**
   * Crea o actualiza un binding
   * Si ya existe un binding activo para ese scope, lo actualiza.
   * 
   * @param {string} scope_type - Tipo de scope
   * @param {string} scope_key - Clave del scope
   * @param {string} theme_key - Clave del tema
   * @param {string} [mode_pref='auto'] - Preferencia de modo
   * @param {number} [priority=100] - Prioridad
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Binding creado/actualizado
   */
  async setBinding(scope_type, scope_key, theme_key, mode_pref = 'auto', priority = 100, client = null) {
    if (!scope_type || !scope_key || !theme_key) {
      throw new Error('scope_type, scope_key y theme_key son requeridos');
    }
    
    const queryFn = client ? client.query.bind(client) : query;
    
    // Verificar si ya existe un binding activo
    const existing = await this.getBinding(scope_type, scope_key, client);
    
    if (existing) {
      // Actualizar binding existente
      const result = await queryFn(`
        UPDATE theme_bindings
        SET theme_key = $1,
            mode_pref = $2,
            priority = $3,
            active = true,
            updated_at = NOW(),
            deleted_at = NULL
        WHERE id = $4
        RETURNING *
      `, [theme_key, mode_pref, priority, existing.id]);
      
      return result.rows[0];
    } else {
      // Crear nuevo binding
      const result = await queryFn(`
        INSERT INTO theme_bindings (
          scope_type, scope_key, theme_key, mode_pref, priority, active
        )
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
      `, [scope_type, scope_key, theme_key, mode_pref, priority]);
      
      return result.rows[0];
    }
  }

  /**
   * Lista bindings con filtros opcionales
   * 
   * @param {Object} [filters] - Filtros opcionales
   * @param {string} [filters.scope_type] - Filtrar por scope_type
   * @param {string} [filters.theme_key] - Filtrar por theme_key
   * @param {boolean} [filters.active] - Filtrar por active
   * @param {boolean} [filters.include_deleted] - Incluir soft deleted
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de bindings ordenados por priority ASC
   */
  async listBindings(filters = {}, client = null) {
    const { scope_type, theme_key, active, include_deleted = false } = filters;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (scope_type) {
      conditions.push(`scope_type = $${paramIndex}`);
      params.push(scope_type);
      paramIndex++;
    }

    if (theme_key) {
      conditions.push(`theme_key = $${paramIndex}`);
      params.push(theme_key);
      paramIndex++;
    }

    if (active !== undefined) {
      conditions.push(`active = $${paramIndex}`);
      params.push(active);
      paramIndex++;
    }

    if (!include_deleted) {
      conditions.push(`deleted_at IS NULL`);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM theme_bindings
      ${whereClause}
      ORDER BY priority ASC, created_at DESC
    `, params);

    return result.rows;
  }

  /**
   * Soft delete de un binding (marca deleted_at)
   * 
   * @param {string} scope_type - Tipo de scope
   * @param {string} scope_key - Clave del scope
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async deleteBinding(scope_type, scope_key, client = null) {
    if (!scope_type || !scope_key) return false;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE theme_bindings
      SET deleted_at = NOW(),
          active = false,
          updated_at = NOW()
      WHERE scope_type = $1
        AND scope_key = $2
        AND deleted_at IS NULL
      RETURNING id
    `, [scope_type, scope_key]);

    return result.rows.length > 0;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {ThemeBindingRepoPg} Instancia del repositorio
 */
export function getDefaultThemeBindingRepo() {
  if (!defaultInstance) {
    defaultInstance = new ThemeBindingRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultThemeBindingRepo();

