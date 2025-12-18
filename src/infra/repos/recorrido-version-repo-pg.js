// src/infra/repos/recorrido-version-repo-pg.js
// Implementación PostgreSQL del Repositorio de Versiones de Recorridos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con versiones de recorridos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para versiones
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Las versiones son INMUTABLES (una vez publicadas, nunca cambian)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Versiones de Recorridos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con versiones.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class RecorridoVersionRepoPg {
  /**
   * Obtiene la versión publicada más reciente de un recorrido
   * 
   * @param {string} recorrido_id - ID del recorrido
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto versión o null si no existe
   */
  async getLatestVersion(recorrido_id, client = null) {
    if (!recorrido_id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM recorrido_versions
      WHERE recorrido_id = $1
        AND status = 'published'
      ORDER BY version DESC
      LIMIT 1
    `, [recorrido_id]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const version = result.rows[0];
    if (typeof version.definition_json === 'string') {
      version.definition_json = JSON.parse(version.definition_json);
    }
    // Parsear canvas_json si es string
    if (version.canvas_json && typeof version.canvas_json === 'string') {
      version.canvas_json = JSON.parse(version.canvas_json);
    }

    return version;
  }

  /**
   * Obtiene una versión específica de un recorrido
   * 
   * @param {string} recorrido_id - ID del recorrido
   * @param {number} version - Número de versión
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto versión o null si no existe
   */
  async getVersion(recorrido_id, version, client = null) {
    if (!recorrido_id || !version) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM recorrido_versions
      WHERE recorrido_id = $1 AND version = $2
    `, [recorrido_id, version]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const versionObj = result.rows[0];
    if (typeof versionObj.definition_json === 'string') {
      versionObj.definition_json = JSON.parse(versionObj.definition_json);
    }
    // Parsear canvas_json si es string
    if (versionObj.canvas_json && typeof versionObj.canvas_json === 'string') {
      versionObj.canvas_json = JSON.parse(versionObj.canvas_json);
    }

    return versionObj;
  }

  /**
   * Crea una nueva versión publicada (INMUTABLE)
   * 
   * @param {string} recorrido_id - ID del recorrido
   * @param {number} version - Número de versión
   * @param {Object} definition_json - RecorridoDefinition completa (validada)
   * @param {Object|null} [canvas_json] - CanvasDefinition (opcional, se congela en publish)
   * @param {string|null} [release_notes] - Notas de la versión (opcional)
   * @param {string|null} [created_by] - ID/email del admin (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto versión creada
   */
  async createVersion(recorrido_id, version, definition_json, canvas_json = null, release_notes = null, created_by = null, client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO recorrido_versions (
        recorrido_id, version, status, definition_json, canvas_json, release_notes, created_by
      )
      VALUES ($1, $2, 'published', $3, $4, $5, $6)
      RETURNING *
    `, [
      recorrido_id, 
      version, 
      JSON.stringify(definition_json), 
      canvas_json ? JSON.stringify(canvas_json) : null,
      release_notes, 
      created_by
    ]);

    // Parsear JSONs si son strings
    const versionObj = result.rows[0];
    if (typeof versionObj.definition_json === 'string') {
      versionObj.definition_json = JSON.parse(versionObj.definition_json);
    }
    if (versionObj.canvas_json && typeof versionObj.canvas_json === 'string') {
      versionObj.canvas_json = JSON.parse(versionObj.canvas_json);
    }

    return versionObj;
  }

  /**
   * Marca una versión como deprecated (obsoleta)
   * 
   * @param {string} recorrido_id - ID del recorrido
   * @param {number} version - Número de versión
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Objeto versión actualizada o null si no existe
   */
  async deprecateVersion(recorrido_id, version, client = null) {
    if (!recorrido_id || !version) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE recorrido_versions
      SET status = 'deprecated'
      WHERE recorrido_id = $1 AND version = $2
      RETURNING *
    `, [recorrido_id, version]);

    if (!result.rows[0]) return null;

    // Parsear definition_json si es string
    const versionObj = result.rows[0];
    if (typeof versionObj.definition_json === 'string') {
      versionObj.definition_json = JSON.parse(versionObj.definition_json);
    }
    // Parsear canvas_json si es string
    if (versionObj.canvas_json && typeof versionObj.canvas_json === 'string') {
      versionObj.canvas_json = JSON.parse(versionObj.canvas_json);
    }

    return versionObj;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {RecorridoVersionRepoPg} Instancia del repositorio
 */
export function getDefaultRecorridoVersionRepo() {
  if (!defaultInstance) {
    defaultInstance = new RecorridoVersionRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultRecorridoVersionRepo();




