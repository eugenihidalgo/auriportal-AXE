// src/infra/repos/screen-template-version-repo-pg.js
// Implementación PostgreSQL del Repositorio de Versiones de Screen Templates
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con versiones de screen templates en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para versiones de screen templates
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Las versiones son INMUTABLES (una vez publicadas, nunca cambian)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Versiones de Screen Templates - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con versiones.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class ScreenTemplateVersionRepoPg {
  /**
   * Obtiene la versión publicada más reciente de un screen template
   * 
   * @param {string} screen_template_id - ID del template
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto versión o null si no existe
   */
  async getLatestVersion(screen_template_id, client = null) {
    if (!screen_template_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM screen_template_versions
      WHERE screen_template_id = $1
        AND status = 'published'
      ORDER BY version DESC
      LIMIT 1
    `, [screen_template_id]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const version = result.rows[0];
    if (typeof version.definition_json === 'string') {
      version.definition_json = JSON.parse(version.definition_json);
    }

    return version;
  }

  /**
   * Obtiene una versión específica de un screen template
   * 
   * @param {string} screen_template_id - ID del template
   * @param {number} version - Número de versión
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto versión o null si no existe
   */
  async getVersion(screen_template_id, version, client = null) {
    if (!screen_template_id || !version) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM screen_template_versions
      WHERE screen_template_id = $1 AND version = $2
    `, [screen_template_id, version]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const versionObj = result.rows[0];
    if (typeof versionObj.definition_json === 'string') {
      versionObj.definition_json = JSON.parse(versionObj.definition_json);
    }

    return versionObj;
  }

  /**
   * Crea una nueva versión publicada (INMUTABLE)
   * 
   * @param {string} screen_template_id - ID del template
   * @param {number} version - Número de versión
   * @param {Object} definition_json - ScreenTemplateDefinition completa (validada)
   * @param {string|null} [release_notes] - Notas de la versión (opcional)
   * @param {string|null} [created_by] - ID/email del admin (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto versión creada
   */
  async createVersion(screen_template_id, version, definition_json, release_notes = null, created_by = null, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO screen_template_versions (
        screen_template_id, version, status, definition_json, release_notes, created_by
      )
      VALUES ($1, $2, 'published', $3, $4, $5)
      RETURNING *
    `, [screen_template_id, version, JSON.stringify(definition_json), release_notes, created_by]);

    // Parsear definition_json si es string
    const versionObj = result.rows[0];
    if (typeof versionObj.definition_json === 'string') {
      versionObj.definition_json = JSON.parse(versionObj.definition_json);
    }

    return versionObj;
  }

  /**
   * Marca una versión como deprecated (obsoleta)
   * 
   * @param {string} screen_template_id - ID del template
   * @param {number} version - Número de versión
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto versión actualizada o null si no existe
   */
  async deprecateVersion(screen_template_id, version, client = null) {
    if (!screen_template_id || !version) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE screen_template_versions
      SET status = 'deprecated'
      WHERE screen_template_id = $1 AND version = $2
      RETURNING *
    `, [screen_template_id, version]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const versionObj = result.rows[0];
    if (typeof versionObj.definition_json === 'string') {
      versionObj.definition_json = JSON.parse(versionObj.definition_json);
    }

    return versionObj;
  }

  /**
   * Obtiene todas las versiones publicadas de un screen template (para historial)
   * 
   * @param {string} screen_template_id - ID del template
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object[]>} Array de versiones ordenadas por versión DESC
   */
  async getAllVersions(screen_template_id, client = null) {
    if (!screen_template_id) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM screen_template_versions
      WHERE screen_template_id = $1
      ORDER BY version DESC
    `, [screen_template_id]);

    // Parsear definition_json si es string
    return result.rows.map(row => {
      if (typeof row.definition_json === 'string') {
        row.definition_json = JSON.parse(row.definition_json);
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
 * @returns {ScreenTemplateVersionRepoPg} Instancia del repositorio
 */
export function getDefaultScreenTemplateVersionRepo() {
  if (!defaultInstance) {
    defaultInstance = new ScreenTemplateVersionRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultScreenTemplateVersionRepo();


