// src/infra/repos/recorrido-repo-pg.js
// Implementación PostgreSQL del Repositorio de Recorridos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con recorridos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para recorridos
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Recorridos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con recorridos.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class RecorridoRepoPg {
  /**
   * Crea un nuevo recorrido con status='draft'
   * 
   * @param {Object} data - Datos del recorrido
   * @param {string} data.id - ID único del recorrido
   * @param {string} data.name - Nombre legible del recorrido
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto recorrido creado
   */
  async createRecorrido(data, client = null) {
    const { id, name } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO recorridos (id, name, status)
      VALUES ($1, $2, 'draft')
      RETURNING *
    `, [id, name]);

    return result.rows[0];
  }

  /**
   * Busca un recorrido por ID
   * 
   * @param {string} id - ID del recorrido
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto recorrido o null si no existe
   */
  async getRecorridoById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM recorridos
      WHERE id = $1
    `, [id]);

    return result.rows[0] || null;
  }

  /**
   * Lista recorridos con filtro opcional por status
   * 
   * @param {Object} [filters] - Filtros opcionales
   * @param {string} [filters.status] - Filtrar por status
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de recorridos ordenados por updated_at DESC
   */
  async listRecorridos(filters = {}, client = null) {
    const { status, include_deleted = false } = filters;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Por defecto, excluir recorridos borrados (soft delete)
    if (!include_deleted) {
      conditions.push(`status != 'deleted'`);
    }

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
      SELECT * FROM recorridos
      ${whereClause}
      ORDER BY updated_at DESC
    `, params);

    return result.rows;
  }

  /**
   * Actualiza metadatos de un recorrido
   * 
   * @param {string} id - ID del recorrido
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto recorrido actualizado o null si no existe
   */
  async updateRecorridoMeta(id, patch, client = null) {
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
      // No hay nada que actualizar, retornar el recorrido actual
      return this.getRecorridoById(id, client);
    }

    // Siempre actualizar updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    params.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE recorridos
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
 * @returns {RecorridoRepoPg} Instancia del repositorio
 */
export function getDefaultRecorridoRepo() {
  if (!defaultInstance) {
    defaultInstance = new RecorridoRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultRecorridoRepo();



