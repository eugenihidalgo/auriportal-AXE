// src/core/automations/automation-write-service.js
// Servicio Canónico de Escritura de Automatizaciones (Fase D - Fase 7)
//
// PRINCIPIOS CONSTITUCIONALES:
// - Este servicio es la ÚNICA forma permitida de escribir en automation_definitions
// - NO ejecuta automatizaciones
// - NO emite señales
// - NO llama al engine
// - Solo escribe, valida y audita
//
// RELACIÓN CON CONTRATOS:
// - Contrato D: Las automatizaciones deben pasar por validación y auditoría
// - Contrato Fase 7: Escritura gobernada y reversible
//
// ESTADO: Fase 7 - Write Service Canónico

import {
  validateAutomationDefinition,
  validateAutomationKey
} from './automation-definition-validator.js';
import {
  createDefinition,
  updateDefinition,
  updateDefinitionStatus,
  automationKeyExists,
  getDefinitionById
} from '../../infra/repos/automation-definitions-repo-pg.js';
import { getDefaultAutomationAuditRepo } from '../../infra/repos/automation-audit-repo-pg.js';

const auditRepo = getDefaultAutomationAuditRepo();

// ============================================================================
// CREAR AUTOMATIZACIÓN
// ============================================================================

/**
 * Crea una nueva automatización
 * 
 * Reglas duras:
 * - status SIEMPRE 'draft' (no negociable)
 * - version SIEMPRE 1
 * - Validación completa antes de guardar
 * - Auditoría obligatoria
 * 
 * @param {Object} params - Parámetros de creación
 * @param {string} params.automation_key - Clave única
 * @param {string} params.name - Nombre legible
 * @param {string} [params.description] - Descripción opcional
 * @param {Object} params.definition - Definición JSON (ya validada)
 * @param {Object} params.actor - Actor que crea { type: 'admin', id: admin_id }
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Definición creada
 * @throws {Error} Si la automatización ya existe o hay error de validación
 */
export async function createAutomation(params, client = null) {
  const {
    automation_key,
    name,
    description,
    definition,
    actor
  } = params;

  // Validar automation_key
  validateAutomationKey(automation_key);

  // Validar que no existe ya
  const exists = await automationKeyExists(automation_key);
  if (exists) {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] automation_key ya existe: ${automation_key}`);
  }

  // Validar definición
  validateAutomationDefinition(definition);

  // Validar actor
  if (!actor || actor.type !== 'admin' || !actor.id) {
    throw new Error('[AUTOMATION_WRITE_SERVICE] actor es requerido y debe ser { type: "admin", id: string }');
  }

  // Forzar status = 'draft' y version = 1
  const created = await createDefinition({
    automation_key,
    name,
    description,
    definition,
    version: 1, // SIEMPRE 1 para nuevas
    status: 'draft', // SIEMPRE draft al crear
    created_by: `admin:${actor.id}`
  }, client);

  // Registrar auditoría (fail-open)
  try {
    await auditRepo.append({
      automation_key,
      action: 'create',
      actor_admin_id: actor.id,
      before: null,
      after: {
        id: created.id,
        automation_key: created.automation_key,
        name: created.name,
        status: created.status,
        version: created.version
      }
    }, client);
  } catch (auditError) {
    console.error('[AUTOMATION_WRITE_SERVICE] Error registrando auditoría (fail-open):', auditError);
    // No lanzar error, auditoría es fail-open
  }

  return created;
}

// ============================================================================
// ACTUALIZAR AUTOMATIZACIÓN
// ============================================================================

/**
 * Actualiza una automatización existente
 * 
 * Reglas duras:
 * - Validación de versión (prevenir conflictos)
 * - Validación completa antes de guardar
 * - Incrementa versión automáticamente
 * - Auditoría completa (before/after)
 * 
 * @param {string} definitionId - ID de la definición
 * @param {Object} params - Parámetros de actualización
 * @param {string} [params.name] - Nombre legible
 * @param {string} [params.description] - Descripción
 * @param {Object} [params.definition] - Definición JSON (ya validada)
 * @param {number} params.expectedVersion - Versión esperada (para prevenir conflictos)
 * @param {Object} params.actor - Actor que actualiza { type: 'admin', id: admin_id }
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Definición actualizada
 * @throws {Error} Si no existe, hay conflicto de versión o error de validación
 */
export async function updateAutomation(definitionId, params, client = null) {
  const {
    name,
    description,
    definition,
    expectedVersion,
    actor
  } = params;

  // Validar actor
  if (!actor || actor.type !== 'admin' || !actor.id) {
    throw new Error('[AUTOMATION_WRITE_SERVICE] actor es requerido y debe ser { type: "admin", id: string }');
  }

  // Validar expectedVersion
  if (expectedVersion === undefined || typeof expectedVersion !== 'number') {
    throw new Error('[AUTOMATION_WRITE_SERVICE] expectedVersion es requerido y debe ser un número');
  }

  // Obtener definición actual (para auditoría)
  const before = await getDefinitionById(definitionId);
  if (!before) {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] Automatización no encontrada: ${definitionId}`);
  }

  // Validar definición si se actualiza
  if (definition !== undefined) {
    validateAutomationDefinition(definition);
  }

  // Actualizar (con validación de versión)
  const after = await updateDefinition(definitionId, {
    name,
    description,
    definition,
    expectedVersion,
    updated_by: `admin:${actor.id}`
  }, client);

  if (!after) {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] Conflicto de versión o automatización no encontrada: ${definitionId}. Versión esperada: ${expectedVersion}, versión actual: ${before.version}`);
  }

  // Registrar auditoría (fail-open)
  try {
    await auditRepo.append({
      automation_key: before.automation_key,
      action: 'update',
      actor_admin_id: actor.id,
      before: {
        id: before.id,
        version: before.version,
        name: before.name,
        status: before.status
      },
      after: {
        id: after.id,
        version: after.version,
        name: after.name,
        status: after.status
      }
    }, client);
  } catch (auditError) {
    console.error('[AUTOMATION_WRITE_SERVICE] Error registrando auditoría (fail-open):', auditError);
    // No lanzar error, auditoría es fail-open
  }

  return after;
}

// ============================================================================
// ACTIVAR AUTOMATIZACIÓN
// ============================================================================

/**
 * Activa una automatización (cambia status de 'draft' o 'deprecated' a 'active')
 * 
 * Reglas duras:
 * - Solo se puede activar si status es 'draft' o 'deprecated'
 * - NO se puede activar si status es 'broken'
 * - Auditoría explícita
 * 
 * @param {string} definitionId - ID de la definición
 * @param {Object} params - Parámetros
 * @param {Object} params.actor - Actor que activa { type: 'admin', id: admin_id }
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Definición actualizada
 * @throws {Error} Si no existe, status no permite activación o error de validación
 */
export async function activateAutomation(definitionId, params, client = null) {
  const { actor } = params;

  // Validar actor
  if (!actor || actor.type !== 'admin' || !actor.id) {
    throw new Error('[AUTOMATION_WRITE_SERVICE] actor es requerido y debe ser { type: "admin", id: string }');
  }

  // Obtener definición actual
  const before = await getDefinitionById(definitionId);
  if (!before) {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] Automatización no encontrada: ${definitionId}`);
  }

  // Validar que status permite activación
  if (before.status === 'broken') {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] No se puede activar una automatización con status 'broken': ${before.automation_key}`);
  }

  if (before.status === 'active') {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] La automatización ya está activa: ${before.automation_key}`);
  }

  // Validar definición antes de activar (asegurar que es válida)
  validateAutomationDefinition(before.definition);

  // Actualizar status
  const after = await updateDefinitionStatus(definitionId, 'active', `admin:${actor.id}`, client);
  if (!after) {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] Error al activar automatización: ${definitionId}`);
  }

  // Registrar auditoría (fail-open)
  try {
    await auditRepo.append({
      automation_key: before.automation_key,
      action: 'activate',
      actor_admin_id: actor.id,
      before: {
        id: before.id,
        status: before.status
      },
      after: {
        id: after.id,
        status: after.status
      }
    }, client);
  } catch (auditError) {
    console.error('[AUTOMATION_WRITE_SERVICE] Error registrando auditoría (fail-open):', auditError);
    // No lanzar error, auditoría es fail-open
  }

  return after;
}

// ============================================================================
// DESACTIVAR AUTOMATIZACIÓN
// ============================================================================

/**
 * Desactiva una automatización (cambia status de 'active' a 'deprecated')
 * 
 * Reglas duras:
 * - Solo se puede desactivar si status es 'active'
 * - Auditoría explícita
 * 
 * @param {string} definitionId - ID de la definición
 * @param {Object} params - Parámetros
 * @param {Object} params.actor - Actor que desactiva { type: 'admin', id: admin_id }
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Definición actualizada
 * @throws {Error} Si no existe, status no permite desactivación
 */
export async function deactivateAutomation(definitionId, params, client = null) {
  const { actor } = params;

  // Validar actor
  if (!actor || actor.type !== 'admin' || !actor.id) {
    throw new Error('[AUTOMATION_WRITE_SERVICE] actor es requerido y debe ser { type: "admin", id: string }');
  }

  // Obtener definición actual
  const before = await getDefinitionById(definitionId);
  if (!before) {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] Automatización no encontrada: ${definitionId}`);
  }

  // Validar que status permite desactivación
  if (before.status !== 'active') {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] Solo se puede desactivar una automatización activa. Status actual: ${before.status}`);
  }

  // Actualizar status
  const after = await updateDefinitionStatus(definitionId, 'deprecated', `admin:${actor.id}`, client);
  if (!after) {
    throw new Error(`[AUTOMATION_WRITE_SERVICE] Error al desactivar automatización: ${definitionId}`);
  }

  // Registrar auditoría (fail-open)
  try {
    await auditRepo.append({
      automation_key: before.automation_key,
      action: 'deactivate',
      actor_admin_id: actor.id,
      before: {
        id: before.id,
        status: before.status
      },
      after: {
        id: after.id,
        status: after.status
      }
    }, client);
  } catch (auditError) {
    console.error('[AUTOMATION_WRITE_SERVICE] Error registrando auditoría (fail-open):', auditError);
    // No lanzar error, auditoría es fail-open
  }

  return after;
}





