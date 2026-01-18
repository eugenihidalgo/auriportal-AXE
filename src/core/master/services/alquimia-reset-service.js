// src/core/master/services/alquimia-reset-service.js
// Servicio Canónico de Reset de Progreso en Alquimia (MASTER)
//
// RESPONSABILIDADES:
// - Resetear progreso de alumno para ítem específico
// - Resetear progreso de alumno para lista completa
// - Validar inputs (UUID-only, scope='student')
// - Operación idempotente
//
// REGLAS CONSTITUCIONALES:
// - Reset ≠ override (no modifica student_item_overrides)
// - Reset ≠ limpieza (no marca como limpiado)
// - Solo afecta cleaning_item_state
// - UUID-only: NO acepta legacy_alumno_id
// - Backend es la única autoridad
// - Operación idempotente (mismo resultado si se llama múltiples veces)

/**
 * Resetea el progreso de un alumno para un ítem específico.
 *
 * ⚠️ DEPRECATED HARD - BLINDAJE LEGACY_RESET_DELETE_FORBIDDEN:
 * Este servicio usaba deleteState (reset por DELETE). En MASTER está PROHIBIDO.
 * Usa cleaning-engine: resetByScope / resetStudentItemProgress (evento+effective_since).
 * Ningún endpoint MASTER invoca esta función.
 *
 * @deprecated Usar cleaning-engine resetStudentItemProgress o resetByScope
 */
export async function resetStudentItemProgress(options) {
  const err = new Error('Reset por DELETE está prohibido en MASTER. Usa cleaning-engine reset (evento+effective_since).');
  err.code = 'LEGACY_RESET_DELETE_FORBIDDEN';
  throw err;
}

/**
 * Resetea el progreso de un alumno para todos los ítems de una lista.
 *
 * ⚠️ DEPRECATED HARD - BLINDAJE LEGACY_RESET_DELETE_FORBIDDEN:
 * Este servicio usaba deleteState/deleteStatesByList (reset por DELETE). En MASTER está PROHIBIDO.
 * Usa cleaning-engine: resetByScope con reset_scope=LIST_STUDENT (evento+effective_since).
 * Ningún endpoint MASTER invoca esta función.
 *
 * @deprecated Usar cleaning-engine resetByScope
 */
export async function resetStudentListProgress(options) {
  const err = new Error('Reset por DELETE está prohibido en MASTER. Usa cleaning-engine reset (evento+effective_since).');
  err.code = 'LEGACY_RESET_DELETE_FORBIDDEN';
  throw err;
}
