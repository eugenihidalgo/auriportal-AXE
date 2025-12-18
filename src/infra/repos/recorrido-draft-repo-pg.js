// src/infra/repos/recorrido-draft-repo-pg.js
// Implementación PostgreSQL del Repositorio de Drafts de Recorridos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con drafts de recorridos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para drafts
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Drafts de Recorridos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con drafts.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class RecorridoDraftRepoPg {
  /**
   * Crea un nuevo draft para un recorrido
   * 
   * @param {string} recorrido_id - ID del recorrido
   * @param {Object} definition_json - RecorridoDefinition completa
   * @param {string|null} [updated_by] - ID/email del admin (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto draft creado
   */
  async createDraft(recorrido_id, definition_json, updated_by = null, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO recorrido_drafts (recorrido_id, definition_json, updated_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [recorrido_id, JSON.stringify(definition_json), updated_by]);

    return result.rows[0];
  }

  /**
   * Busca un draft por UUID
   * 
   * @param {string} draft_id - UUID del draft
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto draft o null si no existe
   */
  async getDraftById(draft_id, client = null) {
    if (!draft_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM recorrido_drafts
      WHERE draft_id = $1
    `, [draft_id]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const draft = result.rows[0];
    if (typeof draft.definition_json === 'string') {
      draft.definition_json = JSON.parse(draft.definition_json);
    }
    // Parsear canvas_json si es string
    if (draft.canvas_json && typeof draft.canvas_json === 'string') {
      draft.canvas_json = JSON.parse(draft.canvas_json);
    }

    return draft;
  }

  /**
   * Actualiza un draft existente
   * 
   * @param {string} draft_id - UUID del draft
   * @param {Object} definition_json - Nueva RecorridoDefinition
   * @param {string|null} [updated_by] - ID/email del admin (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto draft actualizado o null si no existe
   */
  async updateDraft(draft_id, definition_json, updated_by = null, client = null) {
    if (!draft_id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE recorrido_drafts
      SET definition_json = $1,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $2
      WHERE draft_id = $3
      RETURNING *
    `, [JSON.stringify(definition_json), updated_by, draft_id]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const draft = result.rows[0];
    if (typeof draft.definition_json === 'string') {
      draft.definition_json = JSON.parse(draft.definition_json);
    }
    // Parsear canvas_json si es string
    if (draft.canvas_json && typeof draft.canvas_json === 'string') {
      draft.canvas_json = JSON.parse(draft.canvas_json);
    }

    return draft;
  }

  /**
   * Actualiza canvas_json de un draft
   * 
   * @param {string} draft_id - UUID del draft
   * @param {Object} canvas_json - CanvasDefinition normalizada
   * @param {string|null} [updated_by] - ID/email del admin (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} { draft, rowCount }
   *   - draft: Objeto draft actualizado o null si no existe
   *   - rowCount: Número de filas afectadas por el UPDATE
   */
  async updateCanvas(draft_id, canvas_json, updated_by = null, client = null) {
    if (!draft_id) {
      return { draft: null, rowCount: 0 };
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE public.recorrido_drafts
      SET canvas_json = $1,
          canvas_updated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $2
      WHERE draft_id = $3
      RETURNING *
    `, [JSON.stringify(canvas_json), updated_by, draft_id]);

    const rowCount = result.rowCount || 0;

    // Si no se afectó ninguna fila, el draft no existe o el draft_id es incorrecto
    if (rowCount === 0 || !result.rows[0]) {
      return { draft: null, rowCount: 0 };
    }

    // Parsear JSONs si son strings
    const draft = result.rows[0];
    if (typeof draft.definition_json === 'string') {
      draft.definition_json = JSON.parse(draft.definition_json);
    }
    if (draft.canvas_json && typeof draft.canvas_json === 'string') {
      draft.canvas_json = JSON.parse(draft.canvas_json);
    }

    return { draft, rowCount };
  }

  /**
   * Obtiene el draft actual de un recorrido (el más reciente)
   * 
   * @param {string} recorrido_id - ID del recorrido
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto draft actual o null si no existe
   */
  async getCurrentDraft(recorrido_id, client = null) {
    if (!recorrido_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM recorrido_drafts
      WHERE recorrido_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [recorrido_id]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const draft = result.rows[0];
    if (typeof draft.definition_json === 'string') {
      draft.definition_json = JSON.parse(draft.definition_json);
    }
    // Parsear canvas_json si es string
    if (draft.canvas_json && typeof draft.canvas_json === 'string') {
      draft.canvas_json = JSON.parse(draft.canvas_json);
    }

    return draft;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {RecorridoDraftRepoPg} Instancia del repositorio
 */
export function getDefaultRecorridoDraftRepo() {
  if (!defaultInstance) {
    defaultInstance = new RecorridoDraftRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultRecorridoDraftRepo();




