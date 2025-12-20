// src/infra/repos/recorrido-run-repo-pg.js
// Implementación PostgreSQL del Repositorio de Runs de Recorridos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con runs de recorridos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para runs
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Runs de Recorridos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con runs.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class RecorridoRunRepoPg {
  /**
   * Crea un nuevo run de un recorrido
   * 
   * @param {Object} data - Datos del run
   * @param {string} data.user_id - ID del usuario
   * @param {string} data.recorrido_id - ID del recorrido
   * @param {number} data.version - Versión del recorrido
   * @param {string} data.entry_step_id - ID del step de entrada
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto run creado
   */
  async createRun(data, client = null) {
    const { user_id, recorrido_id, version, entry_step_id } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO recorrido_runs (
        user_id, recorrido_id, version, status, current_step_id, state_json
      )
      VALUES ($1, $2, $3, 'in_progress', $4, '{}')
      RETURNING *
    `, [user_id, recorrido_id, version, entry_step_id]);

    // Parsear state_json si es string
    const run = result.rows[0];
    if (typeof run.state_json === 'string') {
      run.state_json = JSON.parse(run.state_json);
    }

    return run;
  }

  /**
   * Obtiene un run por su ID
   * 
   * @param {string} run_id - UUID del run
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto run o null si no existe
   */
  async getRunById(run_id, client = null) {
    if (!run_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM recorrido_runs
      WHERE run_id = $1
    `, [run_id]);

    if (!result.rows[0]) return null;

    // Parsear state_json si es string
    const run = result.rows[0];
    if (typeof run.state_json === 'string') {
      run.state_json = JSON.parse(run.state_json);
    }

    return run;
  }

  /**
   * Obtiene el run activo (in_progress) de un usuario para un recorrido
   * 
   * @param {Object} params - Parámetros de búsqueda
   * @param {string} params.user_id - ID del usuario
   * @param {string} params.recorrido_id - ID del recorrido
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto run o null si no existe
   */
  async getActiveRunForUser(params, client = null) {
    const { user_id, recorrido_id } = params;
    if (!user_id || !recorrido_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM recorrido_runs
      WHERE user_id = $1
        AND recorrido_id = $2
        AND status = 'in_progress'
      ORDER BY started_at DESC
      LIMIT 1
    `, [user_id, recorrido_id]);

    if (!result.rows[0]) return null;

    // Parsear state_json si es string
    const run = result.rows[0];
    if (typeof run.state_json === 'string') {
      run.state_json = JSON.parse(run.state_json);
    }

    return run;
  }

  /**
   * Actualiza un run. Solo actualiza los campos proporcionados en patch.
   * Para state_json, se hace merge (no sobrescribe completo).
   * 
   * @param {string} run_id - UUID del run
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto run actualizado o null si no existe
   */
  async updateRun(run_id, patch, client = null) {
    if (!run_id) return null;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Construir SET dinámicamente
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined && key !== 'state_json') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    // Manejar state_json especial (merge, no sobrescribe)
    if (patch.state_json !== undefined) {
      // Obtener state_json actual
      const currentRun = await this.getRunById(run_id, client);
      if (!currentRun) return null;
      
      const currentState = currentRun.state_json || {};
      const newState = { ...currentState, ...patch.state_json };
      
      fields.push(`state_json = $${paramIndex}`);
      values.push(JSON.stringify(newState));
      paramIndex++;
    }

    if (fields.length === 0) {
      // No hay campos para actualizar, retornar el run actual
      return await this.getRunById(run_id, client);
    }

    // Actualizar last_activity_at automáticamente
    fields.push(`last_activity_at = NOW()`);
    values.push(run_id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE recorrido_runs SET ${fields.join(', ')} WHERE run_id = $${paramIndex} RETURNING *`,
      values
    );

    if (!result.rows[0]) return null;

    // Parsear state_json si es string
    const run = result.rows[0];
    if (typeof run.state_json === 'string') {
      run.state_json = JSON.parse(run.state_json);
    }

    return run;
  }

  /**
   * Actualiza last_activity_at de un run
   * 
   * @param {string} run_id - UUID del run
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto run actualizado o null si no existe
   */
  async touchRun(run_id, client = null) {
    if (!run_id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE recorrido_runs
      SET last_activity_at = NOW()
      WHERE run_id = $1
      RETURNING *
    `, [run_id]);

    if (!result.rows[0]) return null;

    // Parsear state_json si es string
    const run = result.rows[0];
    if (typeof run.state_json === 'string') {
      run.state_json = JSON.parse(run.state_json);
    }

    return run;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {RecorridoRunRepoPg} Instancia del repositorio
 */
export function getDefaultRecorridoRunRepo() {
  if (!defaultInstance) {
    defaultInstance = new RecorridoRunRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultRecorridoRunRepo();








