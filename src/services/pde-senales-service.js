// src/services/pde-senales-service.js
// Servicio que combina señales de DB + defaults del sistema
//
// PRINCIPIO: Fail-open absoluto
// - Combina SYSTEM_SIGNAL_DEFAULTS + señales de DB
// - DB override por signal_key si existe
// - Si falta una señal, se crea "virtual" con default

import { getDefaultPdeSignalsRepo } from '../infra/repos/pde-signals-repo-pg.js';
import {
  SYSTEM_SIGNAL_DEFAULTS,
  normalizeSignal,
  validateSignal,
  mergeDbWithSystemSignals,
  sortSignals
} from '../core/senales/senales-registry.js';

const signalsRepo = getDefaultPdeSignalsRepo();

/**
 * Lista todas las señales disponibles (DB + system defaults)
 * 
 * PRINCIPIO: DB override por signal_key si existe
 * 
 * @param {Object} options - Opciones de filtrado
 * @param {boolean} [options.includeArchived=false] - Si incluir archivadas
 * @param {string} [options.scope] - Filtrar por scope (global, workflow, step)
 * @returns {Promise<Array>} Array de señales (DB tiene prioridad sobre defaults)
 */
export async function listSenales(options = {}) {
  const { includeArchived = false, scope = null } = options;

  try {
    // Obtener señales de DB
    const dbSignals = await signalsRepo.list({
      onlyActive: !includeArchived,
      includeDeleted: false,
      includeArchived,
      scope
    });

    // Combinar: DB tiene prioridad, luego defaults del sistema
    const combined = mergeDbWithSystemSignals(dbSignals);

    // Filtrar por scope si se especifica
    let result = combined;
    if (scope) {
      result = combined.filter(s => (s.scope || 'workflow') === scope);
    }

    // Ordenar
    return sortSignals(result);
  } catch (error) {
    console.error('[AXE][SENALES] Error listando señales:', error);
    // Fail-open: devolver solo defaults del sistema
    let defaults = SYSTEM_SIGNAL_DEFAULTS.map(s => ({
      ...s,
      is_system: true
    }));
    if (scope) {
      defaults = defaults.filter(s => s.scope === scope);
    }
    return sortSignals(defaults);
  }
}

/**
 * Obtiene una señal por signal_key
 * 
 * PRINCIPIO: Fail-open - si no existe en DB, devolver default del sistema
 * 
 * @param {string} signalKey - Clave de la señal
 * @returns {Promise<Object|null>} Señal o null si no existe ni en DB ni en defaults
 */
export async function getSenal(signalKey) {
  if (!signalKey) {
    return null;
  }

  try {
    // Buscar en DB primero
    const dbSignal = await signalsRepo.getByKey(signalKey);
    if (dbSignal) {
      return {
        ...dbSignal,
        is_system: false
      };
    }

    // Buscar en defaults del sistema
    const systemSignal = SYSTEM_SIGNAL_DEFAULTS.find(s => s.signal_key === signalKey);
    if (systemSignal) {
      return {
        ...normalizeSignal(systemSignal),
        is_system: true
      };
    }

    return null;
  } catch (error) {
    console.error(`[AXE][SENALES] Error obteniendo señal '${signalKey}':`, error);
    // Fail-open: buscar en defaults del sistema
    const systemSignal = SYSTEM_SIGNAL_DEFAULTS.find(s => s.signal_key === signalKey);
    if (systemSignal) {
      return {
        ...normalizeSignal(systemSignal),
        is_system: true
      };
    }
    return null;
  }
}

/**
 * Crea una nueva señal
 * 
 * @param {Object} definition - Definición de la señal
 * @returns {Promise<Object>} Señal creada
 */
export async function createSenal(definition) {
  // Normalizar definición
  const normalized = normalizeSignal(definition);

  // Validar (con warnings, no bloquea)
  const validation = validateSignal(normalized, { strict: false });
  if (validation.warnings.length > 0) {
    console.warn(`[AXE][SENALES] Warnings al crear señal '${normalized.signal_key}':`, validation.warnings);
  }

  // Crear en DB
  const created = await signalsRepo.create(normalized);

  // Log de auditoría
  try {
    await signalsRepo.logAudit({
      signal_key: created.signal_key,
      action: 'create',
      after: created
    });
  } catch (auditError) {
    console.warn('[AXE][SENALES] Error registrando audit log:', auditError);
  }

  return {
    ...created,
    is_system: false
  };
}

/**
 * Actualiza una señal existente
 * 
 * @param {string} signalKey - Clave de la señal
 * @param {Object} patch - Campos a actualizar
 * @returns {Promise<Object|null>} Señal actualizada o null si no existe
 */
export async function updateSenal(signalKey, patch) {
  if (!signalKey) {
    throw new Error('signal_key es obligatorio');
  }

  // No se pueden actualizar señales del sistema
  const systemSignal = SYSTEM_SIGNAL_DEFAULTS.find(s => s.signal_key === signalKey);
  if (systemSignal) {
    throw new Error('No se pueden actualizar señales del sistema');
  }

  // Obtener estado anterior para audit log
  const before = await signalsRepo.getByKey(signalKey);
  if (!before) {
    return null;
  }

  // Si se actualiza payload_schema o default_payload, normalizar
  if (patch.payload_schema) {
    if (typeof patch.payload_schema !== 'object' || patch.payload_schema === null) {
      patch.payload_schema = {};
    }
  }
  if (patch.default_payload) {
    if (typeof patch.default_payload !== 'object' || patch.default_payload === null) {
      patch.default_payload = {};
    }
  }
  if (patch.tags && !Array.isArray(patch.tags)) {
    patch.tags = [];
  }

  const updated = await signalsRepo.updateByKey(signalKey, patch);
  if (!updated) {
    return null;
  }

  // Log de auditoría
  try {
    await signalsRepo.logAudit({
      signal_key: signalKey,
      action: 'update',
      before,
      after: updated
    });
  } catch (auditError) {
    console.warn('[AXE][SENALES] Error registrando audit log:', auditError);
  }

  return {
    ...updated,
    is_system: false
  };
}

/**
 * Archiva una señal
 * 
 * @param {string} signalKey - Clave de la señal
 * @returns {Promise<Object|null>} Señal archivada o null si no existe
 */
export async function archiveSenal(signalKey) {
  if (!signalKey) {
    return null;
  }

  // No se pueden archivar señales del sistema
  const systemSignal = SYSTEM_SIGNAL_DEFAULTS.find(s => s.signal_key === signalKey);
  if (systemSignal) {
    throw new Error('No se pueden archivar señales del sistema');
  }

  const before = await signalsRepo.getByKey(signalKey);
  if (!before) {
    return null;
  }

  const archived = await signalsRepo.archiveByKey(signalKey);

  // Log de auditoría
  try {
    await signalsRepo.logAudit({
      signal_key: signalKey,
      action: 'archive',
      before,
      after: archived
    });
  } catch (auditError) {
    console.warn('[AXE][SENALES] Error registrando audit log:', auditError);
  }

  return archived;
}

/**
 * Restaura una señal archivada
 * 
 * @param {string} signalKey - Clave de la señal
 * @returns {Promise<Object|null>} Señal restaurada o null si no existe
 */
export async function restoreSenal(signalKey) {
  if (!signalKey) {
    return null;
  }

  const before = await signalsRepo.getByKey(signalKey, true);
  if (!before) {
    return null;
  }

  const restored = await signalsRepo.restoreByKey(signalKey);

  // Log de auditoría
  try {
    await signalsRepo.logAudit({
      signal_key: signalKey,
      action: 'restore',
      before,
      after: restored
    });
  } catch (auditError) {
    console.warn('[AXE][SENALES] Error registrando audit log:', auditError);
  }

  return restored;
}

/**
 * Elimina una señal (soft delete)
 * 
 * @param {string} signalKey - Clave de la señal
 * @returns {Promise<boolean>} true si se eliminó, false si no existía
 */
export async function deleteSenal(signalKey) {
  if (!signalKey) {
    return false;
  }

  // No se pueden eliminar señales del sistema
  const systemSignal = SYSTEM_SIGNAL_DEFAULTS.find(s => s.signal_key === signalKey);
  if (systemSignal) {
    throw new Error('No se pueden eliminar señales del sistema');
  }

  const before = await signalsRepo.getByKey(signalKey);
  if (!before) {
    return false;
  }

  const deleted = await signalsRepo.softDeleteByKey(signalKey);

  // Log de auditoría
  if (deleted) {
    try {
      await signalsRepo.logAudit({
        signal_key: signalKey,
        action: 'delete',
        before,
        after: null
      });
    } catch (auditError) {
      console.warn('[AXE][SENALES] Error registrando audit log:', auditError);
    }
  }

  return deleted;
}










