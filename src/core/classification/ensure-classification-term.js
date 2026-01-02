// src/core/classification/ensure-classification-term.js
// Helper canónico ÚNICO para creación/idempotencia de classification terms
//
// Este es el ÚNICO punto de creación de classification terms en el sistema.
// Usa pde_classification_terms como Source of Truth global.
//
// REGLAS ABSOLUTAS:
// - type obligatorio ('tag', 'key', 'subkey')
// - value string no vacío
// - normalización centralizada (función PostgreSQL)
// - idempotente (si existe, devuelve; si no, crea)
// - respeta status (active / deprecated)
//
// CONSTITUCIONAL: La creación inline desde UI es un derecho del usuario MASTER.

import { query } from '../../../database/pg.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';
import { getRequestId } from '../observability/request-context.js';

/**
 * Helper canónico para asegurar que existe un classification term
 * 
 * @param {Object} params
 * @param {string} params.type - Tipo: 'tag', 'key', 'subkey'
 * @param {string} params.value - Valor del término (string no vacío)
 * @param {Object} options - Opciones adicionales
 * @param {string} options.traceId - Trace ID para logging
 * @returns {Promise<Object>} { id, type, value, normalized, status, created_at, updated_at }
 * @throws {Error} Si type o value son inválidos
 */
export async function ensureClassificationTerm({ type, value }, options = {}) {
  const traceId = options.traceId || getRequestId();

  // Validación estricta
  if (!type || typeof type !== 'string') {
    throw new Error('type es obligatorio y debe ser un string');
  }

  const validTypes = ['tag', 'key', 'subkey'];
  if (!validTypes.includes(type)) {
    throw new Error(`type inválido: "${type}". Debe ser uno de: ${validTypes.join(', ')}`);
  }

  if (!value || typeof value !== 'string' || !value.trim()) {
    throw new Error('value es obligatorio y debe ser un string no vacío');
  }

  const trimmedValue = value.trim();

  logInfo('EnsureClassificationTerm', 'Asegurando término', {
    type,
    value: trimmedValue,
    traceId
  });

  try {
    // Usar función PostgreSQL ensure_classification_term (idempotente)
    const result = await query(
      `SELECT ensure_classification_term($1, $2) as term_id`,
      [type, trimmedValue]
    );

    const termId = result.rows[0].term_id;

    if (!termId) {
      throw new Error('ensure_classification_term no devolvió un ID');
    }

    // Obtener información completa del término
    const termResult = await query(
      `SELECT id, type, value, normalized, status, created_at, updated_at
       FROM pde_classification_terms
       WHERE id = $1`,
      [termId]
    );

    if (termResult.rows.length === 0) {
      throw new Error(`Término creado (ID: ${termId}) pero no encontrado al consultar`);
    }

    const term = termResult.rows[0];

    logInfo('EnsureClassificationTerm', 'Término asegurado', {
      term_id: term.id,
      type: term.type,
      value: term.value,
      normalized: term.normalized,
      status: term.status,
      traceId
    });

    return {
      id: term.id,
      type: term.type,
      value: term.value,
      normalized: term.normalized,
      status: term.status,
      created_at: term.created_at,
      updated_at: term.updated_at
    };
  } catch (error) {
    logError('EnsureClassificationTerm', 'Error asegurando término', {
      type,
      value: trimmedValue,
      error: error.message,
      stack: error.stack,
      traceId
    });
    throw error;
  }
}
