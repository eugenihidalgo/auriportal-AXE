// src/infra/repos/recorrido-step-result-repo-pg.js
// Implementación PostgreSQL del Repositorio de Step Results de Recorridos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con step results de recorridos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para step results
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Step Results de Recorridos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con step results.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class RecorridoStepResultRepoPg {
  /**
   * Añade un nuevo resultado de step (append-only)
   * 
   * @param {Object} data - Datos del resultado
   * @param {string} data.run_id - UUID del run
   * @param {string} data.step_id - ID del step completado
   * @param {Object} data.captured_json - Datos capturados (raw input)
   * @param {number|null} [data.duration_ms] - Duración en milisegundos (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto resultado creado
   */
  async appendStepResult(data, client = null) {
    const { run_id, step_id, captured_json, duration_ms = null } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO recorrido_step_results (
        run_id, step_id, captured_json, duration_ms
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [run_id, step_id, JSON.stringify(captured_json), duration_ms]);

    // Parsear captured_json si es string
    const stepResult = result.rows[0];
    if (typeof stepResult.captured_json === 'string') {
      stepResult.captured_json = JSON.parse(stepResult.captured_json);
    }

    return stepResult;
  }

  /**
   * Lista todos los resultados de steps de un run (ordenados por created_at)
   * 
   * @param {string} run_id - UUID del run
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array<Object>>} Lista de resultados
   */
  async listResultsForRun(run_id, client = null) {
    if (!run_id) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM recorrido_step_results
      WHERE run_id = $1
      ORDER BY created_at ASC
    `, [run_id]);

    // Parsear captured_json si es string
    return result.rows.map(row => {
      if (typeof row.captured_json === 'string') {
        row.captured_json = JSON.parse(row.captured_json);
      }
      return row;
    });
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {RecorridoStepResultRepoPg} Instancia del repositorio
 */
export function getDefaultRecorridoStepResultRepo() {
  if (!defaultInstance) {
    defaultInstance = new RecorridoStepResultRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultRecorridoStepResultRepo();







