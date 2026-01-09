// src/infra/repos/cleaning/cleaning-item-state-repo-pg.js
// Implementación PostgreSQL del Repositorio de Cleaning Item State
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con cleaning item state en PostgreSQL.

import { query } from '../../../../database/pg.js';
import { logError, logInfo } from '../../../core/observability/logger.js';

// Singleton para evitar múltiples instancias
let defaultInstance = null;

/**
 * Repositorio de Cleaning Item State - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con cleaning item state.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 */
export class CleaningItemStateRepoPg {
  /**
   * Obtiene el estado de limpieza para un item específico de un alumno.
   * 
   * @param {Object} options - Opciones de búsqueda
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Estado o null si no existe
   */
  async getState(options, client = null) {
    if (!options || !options.student_id || !options.item_ref) {
      return null;
    }

    const queryFn = client ? client.query.bind(client) : query;

    const result = await queryFn(`
      SELECT * FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = $2
        AND domain_type = $3
        AND item_ref = $4
    `, [
      options.student_id,
      options.product_key || 'pde',
      options.domain_type,
      options.item_ref
    ]);

    return result.rows[0] || null;
  }

  /**
   * Aplica una limpieza recurrente (marca last_cleaned_at e incrementa clean_count).
   * 
   * @param {Object} options - Opciones
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyRecurrent(options, client = null) {
    if (!options || !options.student_id || !options.item_ref || !options.clean_layer || !options.cleaned_at) {
      throw new Error('student_id, item_ref, clean_layer y cleaned_at son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;

    const productKey = options.product_key || 'pde';
    const domainType = options.domain_type;

    // Determinar qué columna actualizar según clean_layer
    const lastCleanedColumn = options.clean_layer === 'shared' 
      ? 'shared_last_cleaned_at' 
      : 'pde_last_cleaned_at';
    const countColumn = options.clean_layer === 'shared'
      ? 'shared_clean_count'
      : 'pde_clean_count';

    const result = await queryFn(`
      INSERT INTO cleaning_item_state (
        student_id, product_key, domain_type, item_ref,
        ${lastCleanedColumn}, ${countColumn}
      ) VALUES (
        $1, $2, $3, $4, $5, 1
      )
      ON CONFLICT (student_id, product_key, domain_type, item_ref)
      DO UPDATE SET
        ${lastCleanedColumn} = $5,
        ${countColumn} = cleaning_item_state.${countColumn} + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      options.student_id,
      productKey,
      domainType,
      options.item_ref,
      options.cleaned_at
    ]);

    logInfo('CleaningItemStateRepo', 'Limpieza recurrente aplicada', {
      student_id: options.student_id,
      item_ref: options.item_ref,
      clean_layer: options.clean_layer
    });

    return result.rows[0];
  }

  /**
   * Incrementa completed y decrementa remaining para una_vez en capa SHARED.
   * Respeta clamp: remaining no puede ser negativo.
   * 
   * @param {Object} options - Opciones
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyOneTimeIncrementShared(options, client = null) {
    if (!options || !options.student_id || !options.item_ref) {
      throw new Error('student_id e item_ref son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;

    const productKey = options.product_key || 'pde';
    const domainType = options.domain_type;
    const requiredCount = options.required_count || 1;

    // REGLA UNA_VEZ: 
    // - Incrementar clean_count
    // - Recalcular remaining = max(required_count - clean_count, 0)
    // - Recalcular completed = (remaining === 0 ? 1 : 0)
    // Si no existe estado, inicializar con clean_count = 1, remaining = max(0, required_count - 1), completed = (remaining === 0)
    const result = await queryFn(`
      INSERT INTO cleaning_item_state (
        student_id, product_key, domain_type, item_ref,
        shared_clean_count, shared_remaining, shared_completed
      ) VALUES (
        $1, $2, $3, $4, 1, GREATEST(0, $5 - 1), 
        CASE WHEN $5 - 1 <= 0 THEN 1 ELSE 0 END
      )
      ON CONFLICT (student_id, product_key, domain_type, item_ref)
      DO UPDATE SET
        shared_clean_count = cleaning_item_state.shared_clean_count + 1,
        -- Recalcular remaining basado en required_count y nuevo clean_count
        -- Asumimos que remaining original = required_count - clean_count original
        -- Nuevo remaining = required_count - (clean_count + 1) = remaining - 1
        shared_remaining = GREATEST(0, cleaning_item_state.shared_remaining - 1),
        -- Recalcular completed: es 1 si remaining = 0, 0 si remaining > 0
        shared_completed = CASE 
          WHEN GREATEST(0, cleaning_item_state.shared_remaining - 1) <= 0 THEN 1 
          ELSE 0 
        END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      options.student_id,
      productKey,
      domainType,
      options.item_ref,
      requiredCount
    ]);

    logInfo('CleaningItemStateRepo', 'Incremento una_vez SHARED aplicado', {
      student_id: options.student_id,
      item_ref: options.item_ref,
      remaining: result.rows[0]?.shared_remaining,
      completed: result.rows[0]?.shared_completed
    });

    return result.rows[0];
  }

  /**
   * Establece remaining directamente para una_vez en capa SHARED.
   * 
   * @param {Object} options - Opciones
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyOneTimeSetRemainingShared(options, client = null) {
    if (!options || !options.student_id || !options.item_ref || options.remaining === undefined) {
      throw new Error('student_id, item_ref y remaining son requeridos');
    }

    const queryFn = client ? client.query.bind(client) : query;

    const productKey = options.product_key || 'pde';
    const domainType = options.domain_type;
    const remaining = Math.max(0, options.remaining); // Clamp a 0

    // Calcular completed basado en required_count si viene, sino mantener el actual
    // Por simplicidad, asumimos que completed = required_count - remaining
    // Si no viene required_count, solo actualizamos remaining
    const result = await queryFn(`
      INSERT INTO cleaning_item_state (
        student_id, product_key, domain_type, item_ref,
        shared_remaining
      ) VALUES (
        $1, $2, $3, $4, $5
      )
      ON CONFLICT (student_id, product_key, domain_type, item_ref)
      DO UPDATE SET
        shared_remaining = $5,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      options.student_id,
      productKey,
      domainType,
      options.item_ref,
      remaining
    ]);

    logInfo('CleaningItemStateRepo', 'Remaining establecido SHARED', {
      student_id: options.student_id,
      item_ref: options.item_ref,
      remaining: result.rows[0]?.shared_remaining
    });

    return result.rows[0];
  }
}

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {CleaningItemStateRepoPg} Instancia del repositorio
 */
export function getDefaultCleaningItemStateRepo() {
  if (!defaultInstance) {
    defaultInstance = new CleaningItemStateRepoPg();
  }
  return defaultInstance;
}

export default getDefaultCleaningItemStateRepo();
