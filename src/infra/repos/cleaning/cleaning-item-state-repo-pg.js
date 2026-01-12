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
   * Helper privado: Resuelve legacy_alumno_id desde student_uuid
   * UUID-ONLY: Los repositorios resuelven internamente legacy_id para escribir en tablas legacy
   */
  async _resolveLegacyId(studentUuid, client = null) {
    if (!studentUuid) return null;
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT legacy_alumno_id FROM students WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [studentUuid]
    );
    return result.rows[0]?.legacy_alumno_id || null;
  }

  /**
   * Obtiene el estado de limpieza para un item específico de un alumno.
   * UUID-ONLY: Acepta student_uuid y resuelve internamente legacy_alumno_id
   * 
   * @param {Object} options - Opciones de búsqueda
   * @param {string} [options.student_uuid] - UUID canónico del estudiante
   * @param {number} [options.student_id] - Legacy ID (opcional, se resuelve desde student_uuid si no se proporciona)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Estado o null si no existe
   */
  async getState(options, client = null) {
    if (!options || !options.item_ref) {
      return null;
    }

    // UUID-ONLY: Resolver legacy_id internamente
    let legacyStudentId = options.student_id;
    if (!legacyStudentId && options.student_uuid) {
      legacyStudentId = await this._resolveLegacyId(options.student_uuid, client);
      if (!legacyStudentId) {
        return null; // No existe legacy_id para este UUID
      }
    } else if (!legacyStudentId) {
      return null; // No se proporcionó ni student_uuid ni student_id
    }

    const queryFn = client ? client.query.bind(client) : query;

    const result = await queryFn(`
      SELECT * FROM cleaning_item_state
      WHERE student_id = $1
        AND product_key = $2
        AND domain_type = $3
        AND item_ref = $4
    `, [
      legacyStudentId,
      options.product_key || 'pde',
      options.domain_type,
      options.item_ref
    ]);

    return result.rows[0] || null;
  }

  /**
   * Aplica una limpieza recurrente (marca last_cleaned_at e incrementa clean_count).
   * UUID-ONLY: Acepta student_uuid y resuelve internamente legacy_alumno_id
   * 
   * @param {Object} options - Opciones
   * @param {string} [options.student_uuid] - UUID canónico del estudiante
   * @param {number} [options.student_id] - Legacy ID (opcional, se resuelve desde student_uuid si no se proporciona)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyRecurrent(options, client = null) {
    if (!options || !options.item_ref || !options.clean_layer || !options.cleaned_at) {
      throw new Error('student_uuid (o student_id), item_ref, clean_layer y cleaned_at son requeridos');
    }

    // UUID-ONLY: Resolver legacy_id internamente
    let legacyStudentId = options.student_id;
    if (!legacyStudentId && options.student_uuid) {
      legacyStudentId = await this._resolveLegacyId(options.student_uuid, client);
      if (!legacyStudentId) {
        throw new Error(`Student UUID no encontrado o sin legacy_alumno_id: ${options.student_uuid}`);
      }
    } else if (!legacyStudentId) {
      throw new Error('student_uuid o student_id es requerido');
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
      legacyStudentId,
      productKey,
      domainType,
      options.item_ref,
      options.cleaned_at
    ]);

    logInfo('CleaningItemStateRepo', '[FORENSIC] Limpieza recurrente aplicada', {
      student_uuid: options.student_uuid,
      student_id: legacyStudentId,
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
   * UUID-ONLY: Acepta student_uuid y resuelve internamente legacy_alumno_id
   * 
   * @param {Object} options - Opciones
   * @param {string} [options.student_uuid] - UUID canónico del estudiante
   * @param {number} [options.student_id] - Legacy ID (opcional, se resuelve desde student_uuid si no se proporciona)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyOneTimeIncrementShared(options, client = null) {
    if (!options || !options.item_ref) {
      throw new Error('student_uuid (o student_id) e item_ref son requeridos');
    }

    // UUID-ONLY: Resolver legacy_id internamente
    let legacyStudentId = options.student_id;
    if (!legacyStudentId && options.student_uuid) {
      legacyStudentId = await this._resolveLegacyId(options.student_uuid, client);
      if (!legacyStudentId) {
        throw new Error(`Student UUID no encontrado o sin legacy_alumno_id: ${options.student_uuid}`);
      }
    } else if (!legacyStudentId) {
      throw new Error('student_uuid o student_id es requerido');
    }

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
      legacyStudentId,
      productKey,
      domainType,
      options.item_ref,
      requiredCount
    ]);

    logInfo('CleaningItemStateRepo', '[FORENSIC] Incremento una_vez SHARED aplicado', {
      student_uuid: options.student_uuid,
      student_id: legacyStudentId,
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
   * UUID-ONLY: Acepta student_uuid y resuelve internamente legacy_alumno_id
   * 
   * @param {Object} options - Opciones
   * @param {string} [options.student_uuid] - UUID canónico del estudiante
   * @param {number} [options.student_id] - Legacy ID (opcional, se resuelve desde student_uuid si no se proporciona)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyOneTimeSetRemainingShared(options, client = null) {
    if (!options || !options.item_ref || options.remaining === undefined) {
      throw new Error('student_uuid (o student_id), item_ref y remaining son requeridos');
    }

    // UUID-ONLY: Resolver legacy_id internamente
    let legacyStudentId = options.student_id;
    if (!legacyStudentId && options.student_uuid) {
      legacyStudentId = await this._resolveLegacyId(options.student_uuid, client);
      if (!legacyStudentId) {
        throw new Error(`Student UUID no encontrado o sin legacy_alumno_id: ${options.student_uuid}`);
      }
    } else if (!legacyStudentId) {
      throw new Error('student_uuid o student_id es requerido');
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
      legacyStudentId,
      productKey,
      domainType,
      options.item_ref,
      remaining
    ]);

    logInfo('CleaningItemStateRepo', 'Remaining establecido SHARED', {
      student_uuid: options.student_uuid,
      student_id: legacyStudentId,
      item_ref: options.item_ref,
      remaining: result.rows[0]?.shared_remaining
    });

    return result.rows[0];
  }

  /**
   * Incrementa clean_count y recalcula remaining/completed para una_vez en capa PDE.
   * SIMÉTRICO A SHARED: misma lógica, distintas columnas.
   * UUID-ONLY: Acepta student_uuid y resuelve internamente legacy_alumno_id
   * 
   * @param {Object} options - Opciones
   * @param {string} [options.student_uuid] - UUID canónico del estudiante
   * @param {number} [options.student_id] - Legacy ID (opcional, se resuelve desde student_uuid si no se proporciona)
   * @param {number} [options.required_count=1] - Total requerido (para calcular remaining)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Estado actualizado
   */
  async upsertApplyOneTimeIncrementPde(options, client = null) {
    if (!options || !options.item_ref) {
      throw new Error('student_uuid (o student_id) e item_ref son requeridos');
    }

    // UUID-ONLY: Resolver legacy_id internamente
    let legacyStudentId = options.student_id;
    if (!legacyStudentId && options.student_uuid) {
      legacyStudentId = await this._resolveLegacyId(options.student_uuid, client);
      if (!legacyStudentId) {
        throw new Error(`Student UUID no encontrado o sin legacy_alumno_id: ${options.student_uuid}`);
      }
    } else if (!legacyStudentId) {
      throw new Error('student_uuid o student_id es requerido');
    }

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
      legacyStudentId,
      productKey,
      domainType,
      options.item_ref,
      requiredCount
    ]);

    logInfo('CleaningItemStateRepo', '[FORENSIC] Incremento una_vez PDE aplicado', {
      student_uuid: options.student_uuid,
      student_id: legacyStudentId,
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
