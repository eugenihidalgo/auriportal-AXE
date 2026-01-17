// src/core/master/services/override-resolution-service.js
// Override Resolution Service v1
//
// CONSTITUCIONAL: Única capa autorizada para resolver estado efectivo
// combinando valores base con overrides.
//
// REGLAS ABSOLUTAS:
// 1. Backend es la única autoridad
// 2. Override ≠ Mutación (nunca modifica valor base)
// 3. UUID-only (student_uuid)
// 4. Auditable y reversible
// 5. PROHIBIDO emitir señales (overrides solo afectan lectura, no escriben)
//
// GUARD CONSTITUCIONAL: Overrides NO emiten señales
// - Overrides son capa de lectura efectiva
// - Overrides NO modifican estado persistido
// - Señales solo se emiten desde acciones WRITE (cleaning-engine, seed)
//
// Referencias:
// - docs/OVERRIDES_SYSTEM_V1.md (documentación canónica)
// - docs/contracts/SIGNALS_CONTRACT_V1.md (sistema de señales canónico)

import { getDefaultStudentOverridesRepoPg } from '../../../infra/repos/student-overrides-repo-pg.js';
import { getDefaultStudentItemOverridesRepoPg } from '../../../infra/repos/student-item-overrides-repo-pg.js';
import { logInfo, logWarn } from '../../observability/logger.js';

/**
 * Resuelve el valor efectivo de un campo de alumno.
 * Combina valor base con override si existe.
 * 
 * @param {Object} student - Objeto student (debe tener id o student_uuid)
 * @param {string} field - Campo a resolver (nivel, fecha_creacion, apodo)
 * @param {*} baseValue - Valor base del campo
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<*>} Valor efectivo (override si existe, baseValue si no)
 */
export async function resolveStudentField(student, field, baseValue, client = null) {
  if (!student) {
    logWarn('OverrideResolution', 'Student es null/undefined', { field });
    return baseValue;
  }
  
  const student_uuid = student.id || student.student_uuid;
  if (!student_uuid) {
    logWarn('OverrideResolution', 'Student sin UUID', { field });
    return baseValue;
  }
  
  const repo = getDefaultStudentOverridesRepoPg();
  const overrideRecord = await repo.getByStudentAndField(student_uuid, field, client);
  
  if (!overrideRecord) {
    // Sin override, devolver valor base
    return baseValue;
  }
  
  // Override existe, devolver valor del override
  const overrideValue = overrideRecord.override_value;
  
  logInfo('OverrideResolution', 'Override aplicado', {
    student_uuid,
    field,
    base_value: baseValue,
    override_value: overrideValue,
    override_id: overrideRecord.id
  });
  
  // Deserializar JSONB según tipo esperado
  if (field === 'nivel') {
    return typeof overrideValue === 'number' ? overrideValue : Number(overrideValue);
  }
  
  if (field === 'fecha_creacion') {
    // Puede ser string ISO o timestamp
    if (typeof overrideValue === 'string') {
      return new Date(overrideValue);
    }
    if (typeof overrideValue === 'number') {
      return new Date(overrideValue);
    }
    return overrideValue;
  }
  
  if (field === 'apodo') {
    return typeof overrideValue === 'string' ? overrideValue : String(overrideValue);
  }
  
  // Para otros campos, devolver tal cual
  return overrideValue;
}

/**
 * Resuelve la configuración efectiva de un item para un estudiante.
 * Combina configuración base con override si existe.
 * 
 * REGLA CONSTITUCIONAL: Override NO modifica estado persistido.
 * - Override solo afecta lectura (cálculo de estado en CPM)
 * - Override NO modifica cleaning_item_state
 * - Override NO modifica effective_since
 * - Override NO modifica contadores
 * 
 * MOMENTO DE APLICACIÓN:
 * - Overrides se aplican ANTES de CPM
 * - Overrides se aplican SOLO en READ operations (getStudentsForItem, list-projection)
 * - Overrides NO se aplican en WRITE operations (markCleanStudent, resetStudentItemProgress, seed)
 * 
 * OVERRIDES HUÉRFANOS:
 * - Si item_ref no existe en catálogo, override NO se aplica (silencioso)
 * - Si estado no existe (antes del seed), override NO tiene efecto hasta que exista estado
 * 
 * @param {Object} itemConfig - Configuración base del item
 * @param {string} student_uuid - UUID canónico del estudiante
 * @param {string} item_ref - Referencia del item
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Configuración efectiva con overrides aplicados
 */
export async function resolveItemConfigForStudent(itemConfig, student_uuid, item_ref, client = null) {
  if (!itemConfig || !student_uuid || !item_ref) {
    logWarn('OverrideResolution', 'Parámetros inválidos para resolveItemConfigForStudent', {
      has_item_config: !!itemConfig,
      has_student_uuid: !!student_uuid,
      has_item_ref: !!item_ref
    });
    return itemConfig || {};
  }
  
  const repo = getDefaultStudentItemOverridesRepoPg();
  const overrides = await repo.listByStudent(student_uuid, { item_ref }, client);
  
  if (overrides.length === 0) {
    // Sin overrides, devolver configuración base
    return itemConfig;
  }
  
  // Construir configuración efectiva
  // NOTA: effectiveConfig es una copia de itemConfig, NO modifica el original
  // Los overrides se aplican SOLO a esta copia, que se usa en CPM
  const effectiveConfig = { ...itemConfig };
  
  for (const overrideRecord of overrides) {
    const { override_key, override_value } = overrideRecord;
    
    // REGLA CONSTITUCIONAL: Overrides desconocidos se ignoran silenciosamente (fail-safe)
    // Solo 4 claves son reconocidas: required_count, threshold_days, nivel, descripcion
    // Aplicar override según clave
    if (override_key === 'required_count') {
      // Para items una_vez
      const value = typeof override_value === 'number' ? override_value : Number(override_value);
      effectiveConfig.required_count = value;
      
      logInfo('OverrideResolution', 'Override required_count aplicado', {
        student_uuid,
        item_ref,
        base_required_count: itemConfig.required_count,
        override_required_count: value,
        override_id: overrideRecord.id
      });
    } else if (override_key === 'threshold_days') {
      // Para items recurrentes
      const value = typeof override_value === 'number' ? override_value : Number(override_value);
      effectiveConfig.threshold_days = value;
      
      logInfo('OverrideResolution', 'Override threshold_days aplicado', {
        student_uuid,
        item_ref,
        base_threshold_days: itemConfig.threshold_days,
        override_threshold_days: value,
        override_id: overrideRecord.id
      });
    } else if (override_key === 'nivel') {
      // Para nivel del item
      const value = typeof override_value === 'number' ? override_value : Number(override_value);
      effectiveConfig.nivel = value;
      
      logInfo('OverrideResolution', 'Override nivel aplicado', {
        student_uuid,
        item_ref,
        base_nivel: itemConfig.nivel,
        override_nivel: value,
        override_id: overrideRecord.id
      });
    } else if (override_key === 'descripcion') {
      // Para descripción del item
      const value = typeof override_value === 'string' ? override_value : String(override_value);
      effectiveConfig.descripcion = value;
      
      logInfo('OverrideResolution', 'Override descripcion aplicado', {
        student_uuid,
        item_ref,
        base_descripcion: itemConfig.descripcion,
        override_descripcion: value,
        override_id: overrideRecord.id
      });
    } else {
      logWarn('OverrideResolution', 'Override key desconocido', {
        student_uuid,
        item_ref,
        override_key,
        override_id: overrideRecord.id
      });
    }
  }
  
  return effectiveConfig;
}

/**
 * Obtiene todos los overrides de un estudiante (para diagnóstico)
 * 
 * @param {string} student_uuid - UUID canónico del estudiante
 * @param {Object} [client] - Client de PostgreSQL (opcional)
 * @returns {Promise<Object>} Objeto con student_overrides e item_overrides
 */
export async function getAllOverridesForStudent(student_uuid, client = null) {
  if (!student_uuid) {
    return { student_overrides: [], item_overrides: [] };
  }
  
  const studentOverridesRepo = getDefaultStudentOverridesRepoPg();
  const itemOverridesRepo = getDefaultStudentItemOverridesRepoPg();
  
  const [studentOverrides, itemOverrides] = await Promise.all([
    studentOverridesRepo.listByStudent(student_uuid, client),
    itemOverridesRepo.listByStudent(student_uuid, {}, client)
  ]);
  
  return {
    student_overrides: studentOverrides,
    item_overrides: itemOverrides
  };
}
