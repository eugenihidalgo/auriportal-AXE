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
   * UUID-ONLY: Acepta SOLO student_uuid (UUID canónico)
   * 
   * @param {Object} options - Opciones de búsqueda
   * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Estado o null si no existe
   */
  async getState(options, client = null) {
    if (!options || !options.item_ref || !options.student_uuid) {
      return null;
    }

    // UUID-ONLY: student_id en tabla ahora es UUID, usar directamente
    const queryFn = client ? client.query.bind(client) : query;

    const result = await queryFn(`
      SELECT * FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = $2
        AND domain_type = $3
        AND item_ref = $4
    `, [
      options.student_uuid,
      options.product_key || 'pde',
      options.domain_type,
      options.item_ref
    ]);

    return result.rows[0] || null;
  }

  /**
   * Aplica una limpieza recurrente (marca last_cleaned_at e incrementa clean_count).
   * UUID-ONLY: Acepta SOLO student_uuid (UUID canónico)
   * 
   * @param {Object} options - Opciones
   * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyRecurrent(options, client = null) {
    if (!options || !options.item_ref || !options.clean_layer || !options.cleaned_at || !options.student_uuid) {
      throw new Error('student_uuid, item_ref, clean_layer y cleaned_at son requeridos');
    }

    // UUID-ONLY: student_id en tabla ahora es UUID, usar directamente
    const studentUuid = options.student_uuid;

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
      studentUuid,
      productKey,
      domainType,
      options.item_ref,
      options.cleaned_at
    ]);

    logInfo('CleaningItemStateRepo', '[FORENSIC] Limpieza recurrente aplicada', {
      student_uuid: studentUuid,
      item_ref: options.item_ref,
      clean_layer: options.clean_layer,
      columns_updated: `${lastCleanedColumn}, ${countColumn}`,
      independence_check: `SOLO ${options.clean_layer === 'shared' ? 'SHARED' : 'PDE'} columns`
    });

    return result.rows[0];
  }

  /**
   * Incrementa completed y decrementa remaining para una_vez en capa SHARED.
   * Respeta clamp: remaining no puede ser negativo.
   * UUID-ONLY: Acepta SOLO student_uuid (UUID canónico)
   * 
   * @param {Object} options - Opciones
   * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyOneTimeIncrementShared(options, client = null) {
    if (!options || !options.item_ref || !options.student_uuid) {
      throw new Error('student_uuid e item_ref son requeridos');
    }

    // UUID-ONLY: student_id en tabla ahora es UUID, usar directamente
    const studentUuid = options.student_uuid;

    const queryFn = client ? client.query.bind(client) : query;

    const productKey = options.product_key || 'pde';
    const domainType = options.domain_type;
    const requiredCount = options.required_count || 1;

    // REGLA UNA_VEZ v1: 
    // - Incrementar clean_count SIEMPRE (+1)
    // - Recalcular remaining = max(required_count - clean_count, 0) (clamp a 0)
    // - Recalcular completed = (remaining === 0 ? 1 : 0)
    // - clean_count puede superar required_count (sin bloqueo)
    // - Si no existe estado, inicializar con clean_count = 1, remaining = max(0, required_count - 1), completed = (remaining === 0)
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
        -- Recalcular remaining basado en required_count y nuevo clean_count (no solo decrementar)
        -- Nuevo remaining = max(required_count - (clean_count + 1), 0)
        -- Esto permite que clean_count supere required_count (remaining queda en 0)
        shared_remaining = GREATEST(0, $5 - (cleaning_item_state.shared_clean_count + 1)),
        -- Recalcular completed: es 1 si remaining = 0, 0 si remaining > 0
        shared_completed = CASE 
          WHEN GREATEST(0, $5 - (cleaning_item_state.shared_clean_count + 1)) <= 0 THEN 1 
          ELSE 0 
        END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      studentUuid,
      productKey,
      domainType,
      options.item_ref,
      requiredCount
    ]);

    logInfo('CleaningItemStateRepo', '[FORENSIC] Incremento una_vez SHARED aplicado', {
      student_uuid: studentUuid,
      item_ref: options.item_ref,
      columns_updated: 'shared_clean_count, shared_remaining, shared_completed',
      independence_check: 'SOLO SHARED columns (pde_* NO modificadas)',
      remaining: result.rows[0]?.shared_remaining,
      completed: result.rows[0]?.shared_completed,
      clean_count: result.rows[0]?.shared_clean_count
    });

    return result.rows[0];
  }

  /**
   * Establece remaining directamente para una_vez en capa SHARED.
   * UUID-ONLY: Acepta SOLO student_uuid (UUID canónico)
   * 
   * @param {Object} options - Opciones
   * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyOneTimeSetRemainingShared(options, client = null) {
    if (!options || !options.item_ref || options.remaining === undefined || !options.student_uuid) {
      throw new Error('student_uuid, item_ref y remaining son requeridos');
    }

    // UUID-ONLY: student_id en tabla ahora es UUID, usar directamente
    const studentUuid = options.student_uuid;

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
      studentUuid,
      productKey,
      domainType,
      options.item_ref,
      remaining
    ]);

    logInfo('CleaningItemStateRepo', 'Remaining establecido SHARED', {
      student_uuid: studentUuid,
      item_ref: options.item_ref,
      remaining: result.rows[0]?.shared_remaining
    });

    return result.rows[0];
  }

  /**
   * Incrementa clean_count y recalcula remaining/completed para una_vez en capa PDE.
   * SIMÉTRICO A SHARED: misma lógica, distintas columnas.
   * UUID-ONLY: Acepta SOLO student_uuid (UUID canónico)
   * 
   * @param {Object} options - Opciones
   * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
   * @param {number} [options.required_count=1] - Total requerido (para calcular remaining)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyOneTimeIncrementPde(options, client = null) {
    if (!options || !options.item_ref || !options.student_uuid) {
      throw new Error('student_uuid e item_ref son requeridos');
    }

    // UUID-ONLY: student_id en tabla ahora es UUID, usar directamente
    const studentUuid = options.student_uuid;

    const queryFn = client ? client.query.bind(client) : query;

    const productKey = options.product_key || 'pde';
    const domainType = options.domain_type;
    const requiredCount = options.required_count || 1;

    // REGLA PDE UNA_VEZ v1 (SIMÉTRICO A SHARED):
    // - Incrementar pde_clean_count SIEMPRE (+1)
    // - Recalcular pde_remaining = max(required_count - pde_clean_count, 0) (clamp a 0)
    // - Recalcular pde_completed = (pde_remaining === 0 ? 1 : 0)
    // - pde_clean_count puede superar required_count (sin bloqueo)
    // - Si no existe estado, inicializar con pde_clean_count = 1, pde_remaining = max(0, required_count - 1), pde_completed = (pde_remaining === 0)
    const result = await queryFn(`
      INSERT INTO cleaning_item_state (
        student_id, product_key, domain_type, item_ref,
        pde_clean_count, pde_remaining, pde_completed
      ) VALUES (
        $1, $2, $3, $4, 1, GREATEST(0, $5 - 1), 
        CASE WHEN $5 - 1 <= 0 THEN 1 ELSE 0 END
      )
      ON CONFLICT (student_id, product_key, domain_type, item_ref)
      DO UPDATE SET
        pde_clean_count = cleaning_item_state.pde_clean_count + 1,
        -- Recalcular remaining basado en required_count y nuevo clean_count (no solo decrementar)
        -- Nuevo remaining = max(required_count - (clean_count + 1), 0)
        -- Esto permite que clean_count supere required_count (remaining queda en 0)
        pde_remaining = GREATEST(0, $5 - (cleaning_item_state.pde_clean_count + 1)),
        -- Recalcular completed: es 1 si remaining = 0, 0 si remaining > 0
        pde_completed = CASE 
          WHEN GREATEST(0, $5 - (cleaning_item_state.pde_clean_count + 1)) <= 0 THEN 1 
          ELSE 0 
        END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      studentUuid,
      productKey,
      domainType,
      options.item_ref,
      requiredCount
    ]);

    logInfo('CleaningItemStateRepo', '[FORENSIC] Incremento una_vez PDE aplicado', {
      student_uuid: studentUuid,
      item_ref: options.item_ref,
      columns_updated: 'pde_clean_count, pde_remaining, pde_completed',
      independence_check: 'SOLO PDE columns (shared_* NO modificadas)',
      required_count: requiredCount,
      pde_clean_count: result.rows[0]?.pde_clean_count,
      pde_remaining: result.rows[0]?.pde_remaining,
      pde_completed: result.rows[0]?.pde_completed
    });

    return result.rows[0];
  }

  /**
   * Elimina el estado de limpieza para un item específico de un alumno.
   * UUID-ONLY: Acepta SOLO student_uuid (UUID canónico)
   * 
   * REGLA: Eliminar la fila completa hace que el sistema asuma estado inicial.
   * 
   * @param {Object} options - Opciones
   * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
   * @param {string} options.item_ref - Referencia del item (OBLIGATORIO)
   * @param {string} [options.product_key='pde'] - Clave del producto (opcional)
   * @param {string} [options.domain_type] - Tipo de dominio (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async deleteState(options, client = null) {
    if (!options || !options.student_uuid || !options.item_ref) {
      throw new Error('student_uuid e item_ref son requeridos');
    }

    // UUID-ONLY: student_id en tabla ahora es UUID, usar directamente
    const studentUuid = options.student_uuid;
    const productKey = options.product_key || 'pde';
    const domainType = options.domain_type;

    // Manejar domain_type null correctamente
    const sqlQuery = (domainType === null || domainType === undefined)
      ? `
        DELETE FROM cleaning_item_state
        WHERE student_id = $1
          AND product_key = $2
          AND domain_type IS NULL
          AND item_ref = $3
        RETURNING id
      `
      : `
        DELETE FROM cleaning_item_state
        WHERE student_id = $1
          AND product_key = $2
          AND domain_type = $3
          AND item_ref = $4
        RETURNING id
      `;
    
    const params = (domainType === null || domainType === undefined)
      ? [studentUuid, productKey, options.item_ref]
      : [studentUuid, productKey, domainType, options.item_ref];

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(sqlQuery, params);

    const deleted = result.rows.length > 0;

    if (deleted) {
      logInfo('CleaningItemStateRepo', 'Estado de limpieza eliminado (reset)', {
        student_uuid: studentUuid,
        item_ref: options.item_ref,
        product_key: productKey,
        domain_type: domainType
      });
    }

    return deleted;
  }

  /**
   * Elimina todos los estados de limpieza de un alumno para una lista específica.
   * UUID-ONLY: Acepta SOLO student_uuid (UUID canónico)
   * 
   * @param {Object} options - Opciones
   * @param {string} options.student_uuid - UUID canónico del estudiante (OBLIGATORIO)
   * @param {string} options.list_id - ID de la lista (OBLIGATORIO)
   * @param {string} [options.product_key='pde'] - Clave del producto (opcional)
   * @param {string} [options.domain_type] - Tipo de dominio (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<number>} Número de estados eliminados
   */
  async deleteStatesByList(options, client = null) {
    if (!options || !options.student_uuid || !options.list_id) {
      throw new Error('student_uuid y list_id son requeridos');
    }

    // UUID-ONLY: student_id en tabla ahora es UUID, usar directamente
    const studentUuid = options.student_uuid;
    const productKey = options.product_key || 'pde';
    const domainType = options.domain_type;

    // Eliminar estados de items que pertenecen a la lista
    // Manejar domain_type null correctamente
    const sqlQuery = (domainType === null || domainType === undefined)
      ? `
        DELETE FROM cleaning_item_state cis
        USING items_transmutaciones it
        WHERE cis.student_id = $1
          AND cis.product_key = $2
          AND cis.domain_type IS NULL
          AND cis.item_ref = it.item_ref
          AND it.lista_id = $3
          AND it.status = 'active'
        RETURNING cis.id
      `
      : `
        DELETE FROM cleaning_item_state cis
        USING items_transmutaciones it
        WHERE cis.student_id = $1
          AND cis.product_key = $2
          AND cis.domain_type = $3
          AND cis.item_ref = it.item_ref
          AND it.lista_id = $4
          AND it.status = 'active'
        RETURNING cis.id
      `;
    
    const params = (domainType === null || domainType === undefined)
      ? [studentUuid, productKey, options.list_id]
      : [studentUuid, productKey, domainType, options.list_id];

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(sqlQuery, params);

    const deletedCount = result.rows.length;

    if (deletedCount > 0) {
      logInfo('CleaningItemStateRepo', 'Estados de limpieza eliminados por lista (reset)', {
        student_uuid: studentUuid,
        list_id: options.list_id,
        product_key: productKey,
        domain_type: domainType,
        deleted_count: deletedCount
      });
    }

    return deletedCount;
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
