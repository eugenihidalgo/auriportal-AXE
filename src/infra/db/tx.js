// src/infra/db/tx.js
// Infraestructura de transacciones PostgreSQL para AuriPortal v4
//
// Proporciona helpers para ejecutar operaciones atómicas en PostgreSQL.
// Las transacciones garantizan que múltiples operaciones se ejecuten
// como una unidad atómica: todas se completan o ninguna.
//
// USO:
//   import { withTransaction } from '../infra/db/tx.js';
//
//   await withTransaction(async (client) => {
//     await repo.create(data, client);
//     await repo.update(id, patch, client);
//     // Si algo falla aquí, todo se revierte automáticamente
//   });

import { getPool } from '../../../database/pg.js';
import { logError } from '../../core/observability/logger.js';

/**
 * Ejecuta una función dentro de una transacción PostgreSQL.
 * 
 * Si la función completa exitosamente, se hace COMMIT.
 * Si la función lanza un error, se hace ROLLBACK automáticamente.
 * El client siempre se libera al final (en finally).
 * 
 * @param {Function} fn - Función async que recibe el client de PostgreSQL
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.domain] - Dominio para logging (default: 'tx')
 * @param {string} [options.flowName] - Nombre del flujo para logging (default: 'transaction')
 * @param {Object} [options.meta] - Metadatos adicionales para logging
 * @returns {Promise<*>} Resultado de la función fn
 * 
 * @example
 * await withTransaction(async (client) => {
 *   await studentRepo.create(data, client);
 *   await practiceRepo.create(practiceData, client);
 *   return { success: true };
 * }, {
 *   domain: 'streak',
 *   flowName: 'streak_atomic',
 *   meta: { alumno_id: 123 }
 * });
 */
export async function withTransaction(fn, options = {}) {
  const {
    domain = 'tx',
    flowName = 'transaction',
    meta = {}
  } = options;

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Iniciar transacción
    await client.query('BEGIN');

    // Ejecutar la función con el client
    const result = await fn(client);

    // Si todo va bien, hacer commit
    await client.query('COMMIT');

    return result;
  } catch (error) {
    // Si hay error, hacer rollback
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Log del error de rollback pero no lo lanzamos
      logError(domain, `Error durante ROLLBACK en ${flowName}`, {
        ...meta,
        flow_name: flowName,
        error: rollbackError.message,
        original_error: error.message
      });
    }

    // Log del error que causó el rollback
    logError(domain, `Transacción revertida: ${flowName}`, {
      ...meta,
      flow_name: flowName,
      error: error.message,
      error_stack: error.stack
    });

    // Re-lanzar el error original para que el caller pueda manejarlo
    throw error;
  } finally {
    // Siempre liberar el client
    client.release();
  }
}

/**
 * Ejecuta una función con un client específico (sin transacción).
 * Útil cuando ya estás dentro de una transacción y necesitas
 * pasar el mismo client a múltiples operaciones.
 * 
 * @param {Function} fn - Función async que recibe el client
 * @param {Object} client - Client de PostgreSQL (debe estar dentro de una transacción)
 * @returns {Promise<*>} Resultado de la función fn
 * 
 * @example
 * await withTransaction(async (client) => {
 *   await withClient(async (c) => {
 *     await repo1.create(data, c);
 *     await repo2.update(id, patch, c);
 *   }, client);
 * });
 */
export async function withClient(fn, client) {
  if (!client) {
    throw new Error('withClient: client es requerido');
  }
  return await fn(client);
}


