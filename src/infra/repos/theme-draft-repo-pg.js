// src/infra/repos/theme-draft-repo-pg.js
// Implementación PostgreSQL del Repositorio de Drafts de Temas
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con drafts de temas en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para drafts de temas
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Drafts de Temas - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con drafts.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class ThemeDraftRepoPg {
  /**
   * Crea un nuevo draft para un tema
   * 
   * @param {string} theme_id - ID del tema
   * @param {Object} definition_json - ThemeDefinition completa
   * @param {string|null} [updated_by] - ID/email del admin (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto draft creado
   */
  async createDraft(theme_id, definition_json, updated_by = null, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO theme_drafts (theme_id, definition_json, updated_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [theme_id, JSON.stringify(definition_json), updated_by]);

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
      SELECT * FROM theme_drafts
      WHERE draft_id = $1
    `, [draft_id]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const draft = result.rows[0];
    if (typeof draft.definition_json === 'string') {
      draft.definition_json = JSON.parse(draft.definition_json);
    }

    return draft;
  }

  /**
   * Actualiza un draft existente
   * 
   * @param {string} draft_id - UUID del draft
   * @param {Object} definition_json - Nueva ThemeDefinition
   * @param {string|null} [updated_by] - ID/email del admin (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto draft actualizado o null si no existe
   */
  async updateDraft(draft_id, definition_json, updated_by = null, client = null) {
    if (!draft_id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE theme_drafts
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

    return draft;
  }

  /**
   * Obtiene el draft actual de un tema (el más reciente)
   * 
   * @param {string} theme_id - ID del tema
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto draft actual o null si no existe
   */
  async getCurrentDraft(theme_id, client = null) {
    if (!theme_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM theme_drafts
      WHERE theme_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [theme_id]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const draft = result.rows[0];
    if (typeof draft.definition_json === 'string') {
      draft.definition_json = JSON.parse(draft.definition_json);
    }

    return draft;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {ThemeDraftRepoPg} Instancia del repositorio
 */
export function getDefaultThemeDraftRepo() {
  if (!defaultInstance) {
    defaultInstance = new ThemeDraftRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultThemeDraftRepo();













