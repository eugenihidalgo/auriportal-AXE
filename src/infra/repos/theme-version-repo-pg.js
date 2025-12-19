// src/infra/repos/theme-version-repo-pg.js
// Implementación PostgreSQL del Repositorio de Versiones de Temas
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con versiones de temas en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para versiones de temas
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Las versiones son INMUTABLES (una vez publicadas, nunca cambian)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Versiones de Temas - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con versiones.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class ThemeVersionRepoPg {
  /**
   * Obtiene la versión publicada más reciente de un tema
   * 
   * @param {string} theme_id - ID del tema
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto versión o null si no existe
   */
  async getLatestVersion(theme_id, client = null) {
    if (!theme_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM theme_versions
      WHERE theme_id = $1
        AND status = 'published'
      ORDER BY version DESC
      LIMIT 1
    `, [theme_id]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const version = result.rows[0];
    if (typeof version.definition_json === 'string') {
      version.definition_json = JSON.parse(version.definition_json);
    }

    return version;
  }

  /**
   * Obtiene una versión específica de un tema
   * 
   * @param {string} theme_id - ID del tema
   * @param {number} version - Número de versión
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto versión o null si no existe
   */
  async getVersion(theme_id, version, client = null) {
    if (!theme_id || !version) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM theme_versions
      WHERE theme_id = $1 AND version = $2
    `, [theme_id, version]);

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
   * @param {string} theme_id - ID del tema
   * @param {number} version - Número de versión
   * @param {Object} definition_json - ThemeDefinition completa (validada)
   * @param {string|null} [release_notes] - Notas de la versión (opcional)
   * @param {string|null} [created_by] - ID/email del admin (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto versión creada
   */
  async createVersion(theme_id, version, definition_json, release_notes = null, created_by = null, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO theme_versions (
        theme_id, version, status, definition_json, release_notes, created_by
      )
      VALUES ($1, $2, 'published', $3, $4, $5)
      RETURNING *
    `, [theme_id, version, JSON.stringify(definition_json), release_notes, created_by]);

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
   * @param {string} theme_id - ID del tema
   * @param {number} version - Número de versión
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto versión actualizada o null si no existe
   */
  async deprecateVersion(theme_id, version, client = null) {
    if (!theme_id || !version) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE theme_versions
      SET status = 'deprecated'
      WHERE theme_id = $1 AND version = $2
      RETURNING *
    `, [theme_id, version]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const versionObj = result.rows[0];
    if (typeof versionObj.definition_json === 'string') {
      versionObj.definition_json = JSON.parse(versionObj.definition_json);
    }

    return versionObj;
  }

  /**
   * Obtiene todas las versiones publicadas de un tema (para historial)
   * 
   * @param {string} theme_id - ID del tema
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object[]>} Array de versiones ordenadas por versión DESC
   */
  async getAllVersions(theme_id, client = null) {
    if (!theme_id) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM theme_versions
      WHERE theme_id = $1
      ORDER BY version DESC
    `, [theme_id]);

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
 * @returns {ThemeVersionRepoPg} Instancia del repositorio
 */
export function getDefaultThemeVersionRepo() {
  if (!defaultInstance) {
    defaultInstance = new ThemeVersionRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultThemeVersionRepo();





