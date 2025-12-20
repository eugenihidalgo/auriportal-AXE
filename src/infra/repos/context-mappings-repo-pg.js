// src/infra/repos/context-mappings-repo-pg.js
// Implementación PostgreSQL del Repositorio de Context Mappings
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con context mappings en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para context mappings
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - La normalización se hace en la capa de servicio

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Context Mappings - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con context mappings.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class ContextMappingsRepoPg {
  /**
   * Lista todos los mappings activos de un contexto, ordenados por sort_order
   * 
   * @param {string} contextKey - Clave del contexto
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de mappings (raw de PostgreSQL)
   */
  async listByContextKey(contextKey, client = null) {
    if (!contextKey) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT 
        id,
        context_key,
        mapping_key,
        label,
        description,
        mapping_data,
        sort_order,
        active,
        created_at,
        updated_at,
        deleted_at
      FROM context_mappings
      WHERE context_key = $1 AND deleted_at IS NULL
      ORDER BY sort_order ASC, mapping_key ASC`,
      [contextKey]
    );
    
    return result.rows.map(row => ({
      ...row,
      mapping_data: typeof row.mapping_data === 'string' 
        ? JSON.parse(row.mapping_data) 
        : row.mapping_data
    }));
  }

  /**
   * Crea o actualiza un mapping (UPSERT)
   * 
   * @param {string} contextKey - Clave del contexto
   * @param {string} mappingKey - Clave del mapping (valor del enum)
   * @param {Object} mappingData - Datos del mapping (JSON)
   * @param {Object} [options] - Opciones adicionales
   * @param {string} [options.label] - Etiqueta humana del mapping
   * @param {string} [options.description] - Descripción del mapping
   * @param {number} [options.sortOrder] - Orden de visualización
   * @param {boolean} [options.active] - Estado activo/inactivo
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto mapping creado/actualizado
   */
  async upsertMapping(contextKey, mappingKey, mappingData, options = {}, client = null) {
    if (!contextKey || !mappingKey || !mappingData) {
      throw new Error('contextKey, mappingKey y mappingData son obligatorios');
    }

    const {
      label = null,
      description = null,
      sortOrder = 0,
      active = true
    } = options;

    // Si no hay label, generar uno automático desde mapping_key
    const finalLabel = label || mappingKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO context_mappings (
        context_key, mapping_key, label, description, mapping_data, sort_order, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (context_key, mapping_key) 
      WHERE deleted_at IS NULL
      DO UPDATE SET
        label = COALESCE(EXCLUDED.label, context_mappings.label),
        description = COALESCE(EXCLUDED.description, context_mappings.description),
        mapping_data = EXCLUDED.mapping_data,
        sort_order = EXCLUDED.sort_order,
        active = EXCLUDED.active,
        updated_at = NOW()
      RETURNING 
        id,
        context_key,
        mapping_key,
        label,
        description,
        mapping_data,
        sort_order,
        active,
        created_at,
        updated_at,
        deleted_at
    `, [
      contextKey,
      mappingKey,
      finalLabel,
      description,
      JSON.stringify(mappingData),
      sortOrder,
      active
    ]);

    const row = result.rows[0];
    return {
      ...row,
      mapping_data: typeof row.mapping_data === 'string' 
        ? JSON.parse(row.mapping_data) 
        : row.mapping_data
    };
  }

  /**
   * Elimina un mapping por ID (soft delete)
   * 
   * @param {string} id - UUID del mapping
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async softDeleteMapping(id, client = null) {
    if (!id) return false;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE context_mappings
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    return result.rows.length > 0;
  }
}

// Instancia singleton
let defaultRepo = null;

/**
 * Obtiene la instancia singleton del repositorio
 * 
 * @returns {ContextMappingsRepoPg} Instancia del repositorio
 */
export function getDefaultContextMappingsRepo() {
  if (!defaultRepo) {
    defaultRepo = new ContextMappingsRepoPg();
  }
  return defaultRepo;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultContextMappingsRepo();

