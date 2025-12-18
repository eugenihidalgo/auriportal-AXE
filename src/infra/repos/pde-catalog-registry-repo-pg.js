// src/infra/repos/pde-catalog-registry-repo-pg.js
// Implementación PostgreSQL del Repositorio de Registro de Catálogos PDE
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con pde_catalog_registry en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para catálogos
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - Todos los métodos aceptan client opcional para transacciones

import { query } from '../../../database/pg.js';
import { PdeCatalogRegistryRepo } from '../../core/repos/pde-catalog-registry-repo.js';

// Singleton para evitar múltiples instancias
let defaultRepo = null;

/**
 * Repositorio de Registro de Catálogos PDE - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con pde_catalog_registry.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class PdeCatalogRegistryRepoPg extends PdeCatalogRegistryRepo {
  /**
   * Lista todos los catálogos registrados
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos
   * @param {boolean} [options.usableForMotors] - Si filtrar por usable_for_motors
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de catálogos
   */
  async listCatalogs(options = {}, client = null) {
    const { onlyActive = true, usableForMotors } = options;
    const queryFn = client ? client.query.bind(client) : query;

    let sql = 'SELECT * FROM pde_catalog_registry';
    const params = [];
    const conditions = [];

    if (onlyActive) {
      conditions.push(`status = 'active'`);
    }

    if (usableForMotors !== undefined) {
      conditions.push(`usable_for_motors = $${params.length + 1}`);
      params.push(usableForMotors);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY label ASC';

    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  /**
   * Obtiene un catálogo por catalog_key
   * 
   * @param {string} catalogKey - Clave canónica del catálogo
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Catálogo o null si no existe
   */
  async getCatalogByKey(catalogKey, client = null) {
    if (!catalogKey) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pde_catalog_registry WHERE catalog_key = $1',
      [catalogKey]
    );

    return result.rows[0] || null;
  }

  /**
   * Obtiene un catálogo por ID
   * 
   * @param {string} id - UUID del catálogo
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Catálogo o null si no existe
   */
  async getCatalogById(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pde_catalog_registry WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Actualiza metadata de un catálogo
   * 
   * @param {string} id - UUID del catálogo
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Catálogo actualizado o null si no existe
   */
  async updateCatalogMeta(id, patch, client = null) {
    if (!id) return null;

    const campos = [];
    const valores = [];
    let paramIndex = 1;

    // Campos permitidos para actualización
    const allowedFields = [
      'label', 'description', 'source_endpoint', 
      'usable_for_motors', 'supports_level', 'supports_priority',
      'supports_obligatory', 'supports_duration', 'status'
    ];

    for (const field of allowedFields) {
      if (patch[field] !== undefined) {
        campos.push(`${field} = $${paramIndex++}`);
        valores.push(patch[field]);
      }
    }

    if (campos.length === 0) {
      // No hay campos para actualizar, retornar el catálogo actual
      return await this.getCatalogById(id, client);
    }

    // Siempre actualizar updated_at (lo hace el trigger, pero lo dejamos explícito)
    campos.push(`updated_at = NOW()`);
    
    // Agregar id al final para el WHERE
    valores.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE pde_catalog_registry 
       SET ${campos.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      valores
    );

    return result.rows[0] || null;
  }
}

/**
 * Obtiene una instancia singleton del repositorio
 * 
 * @returns {PdeCatalogRegistryRepoPg} Instancia del repositorio
 */
export function getDefaultPdeCatalogRegistryRepo() {
  if (!defaultRepo) {
    defaultRepo = new PdeCatalogRegistryRepoPg();
  }
  return defaultRepo;
}

