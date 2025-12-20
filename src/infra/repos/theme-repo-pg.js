// src/infra/repos/theme-repo-pg.js
// Implementación PostgreSQL del Repositorio de Temas
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con temas en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para temas
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Temas - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con temas.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class ThemeRepoPg {
  /**
   * Crea un nuevo tema con status='draft'
   * 
   * @param {Object} data - Datos del tema
   * @param {string} data.id - ID único del tema
   * @param {string} data.name - Nombre legible del tema
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto tema creado
   */
  async createTheme(data, client = null) {
    const { id, name } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO themes (id, name, status)
      VALUES ($1, $2, 'draft')
      RETURNING *
    `, [id, name]);

    return result.rows[0];
  }

  /**
   * Busca un tema por ID
   * 
   * @param {string} id - ID del tema
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto tema o null si no existe
   */
  async getThemeById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM themes
      WHERE id = $1
    `, [id]);

    return result.rows[0] || null;
  }

  /**
   * Lista temas con filtro opcional por status
   * 
   * @param {Object} [filters] - Filtros opcionales
   * @param {string} [filters.status] - Filtrar por status
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de temas ordenados por updated_at DESC
   */
  async listThemes(filters = {}, client = null) {
    const { status } = filters;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM themes
      ${whereClause}
      ORDER BY updated_at DESC
    `, params);

    return result.rows;
  }

  /**
   * Actualiza metadatos de un tema
   * 
   * @param {string} id - ID del tema
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto tema actualizado o null si no existe
   */
  async updateThemeMeta(id, patch, client = null) {
    if (!id) return null;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (patch.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(patch.name);
      paramIndex++;
    }

    if (patch.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(patch.status);
      paramIndex++;
    }

    if (patch.current_draft_id !== undefined) {
      updates.push(`current_draft_id = $${paramIndex}`);
      params.push(patch.current_draft_id);
      paramIndex++;
    }

    if (patch.current_published_version !== undefined) {
      updates.push(`current_published_version = $${paramIndex}`);
      params.push(patch.current_published_version);
      paramIndex++;
    }

    if (updates.length === 0) {
      // No hay nada que actualizar, retornar el tema actual
      return this.getThemeById(id, client);
    }

    // Siempre actualizar updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE themes
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    return result.rows[0] || null;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {ThemeRepoPg} Instancia del repositorio
 */
export function getDefaultThemeRepo() {
  if (!defaultInstance) {
    defaultInstance = new ThemeRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultThemeRepo();






