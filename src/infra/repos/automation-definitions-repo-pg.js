// src/infra/repos/automation-definitions-repo-pg.js
// Repositorio PostgreSQL para automation_definitions (Fase D)
//
// PRINCIPIOS:
// - Métodos de lectura: getActiveAutomationsForSignal, getAutomationByKey, listDefinitions, getDefinitionById
// - Métodos de escritura: createDefinition, updateDefinition (Fase 7)
// - NO contiene lógica de negocio
// - NO valida definiciones (ese es el rol del validator)

import { query } from '../../../database/pg.js';

/**
 * Obtiene automatizaciones activas que escuchan un tipo de señal
 * 
 * @param {string} signalType - Tipo de señal (ej: 'student.practice_registered')
 * @returns {Promise<Array>} Array de automatizaciones activas
 */
export async function getActiveAutomationsForSignal(signalType) {
  const result = await query(`
    SELECT 
      id,
      automation_key,
      name,
      description,
      definition,
      version,
      status,
      created_at,
      updated_at
    FROM automation_definitions
    WHERE deleted_at IS NULL
      AND status = 'active'
      AND definition->'trigger'->>'signalType' = $1
    ORDER BY created_at ASC
  `, [signalType]);

  return result.rows.map(row => ({
    id: row.id,
    automation_key: row.automation_key,
    name: row.name,
    description: row.description,
    definition: row.definition,
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

/**
 * Obtiene una automatización por su clave
 * 
 * @param {string} automationKey - Clave de la automatización
 * @returns {Promise<Object|null>} Automatización o null
 */
export async function getAutomationByKey(automationKey) {
  const result = await query(`
    SELECT 
      id,
      automation_key,
      name,
      description,
      definition,
      version,
      status,
      created_at,
      updated_at
    FROM automation_definitions
    WHERE deleted_at IS NULL
      AND automation_key = $1
    LIMIT 1
  `, [automationKey]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    automation_key: row.automation_key,
    name: row.name,
    description: row.description,
    definition: row.definition,
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Obtiene una definición por ID
 * 
 * @param {string} definitionId - ID de la definición
 * @returns {Promise<Object|null>} Definición o null
 */
export async function getDefinitionById(definitionId) {
  const result = await query(`
    SELECT 
      id,
      automation_key,
      name,
      description,
      definition,
      version,
      status,
      created_at,
      updated_at,
      created_by,
      updated_by
    FROM automation_definitions
    WHERE deleted_at IS NULL
      AND id = $1
    LIMIT 1
  `, [definitionId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    automation_key: row.automation_key,
    name: row.name,
    description: row.description,
    definition: row.definition,
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  };
}

/**
 * Lista definiciones con filtros y paginación
 * 
 * @param {Object} filters - Filtros opcionales
 * @param {string} [filters.status] - Filtrar por status
 * @param {string} [filters.automation_key] - Filtrar por automation_key (ILIKE)
 * @param {number} [filters.limit] - Límite de resultados
 * @param {number} [filters.offset] - Offset para paginación
 * @returns {Promise<Array>} Array de definiciones
 */
export async function listDefinitions(filters = {}) {
  const { status, automation_key, limit = 20, offset = 0 } = filters;

  let whereClause = 'WHERE deleted_at IS NULL';
  const params = [];
  let paramIndex = 1;

  if (status) {
    whereClause += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  if (automation_key) {
    whereClause += ` AND automation_key ILIKE $${paramIndex++}`;
    params.push(`%${automation_key}%`);
  }

  params.push(limit, offset);

  const result = await query(`
    SELECT 
      id,
      automation_key,
      name,
      description,
      definition,
      version,
      status,
      created_at,
      updated_at,
      created_by,
      updated_by
    FROM automation_definitions
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `, params);

  return result.rows.map(row => ({
    id: row.id,
    automation_key: row.automation_key,
    name: row.name,
    description: row.description,
    definition: row.definition,
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  }));
}

/**
 * Verifica si un automation_key ya existe
 * 
 * @param {string} automationKey - Clave a verificar
 * @returns {Promise<boolean>} true si existe, false si no
 */
export async function automationKeyExists(automationKey) {
  const result = await query(`
    SELECT 1
    FROM automation_definitions
    WHERE deleted_at IS NULL
      AND automation_key = $1
    LIMIT 1
  `, [automationKey]);

  return result.rows.length > 0;
}

/**
 * Crea una nueva definición de automatización
 * 
 * @param {Object} params - Parámetros de creación
 * @param {string} params.automation_key - Clave única
 * @param {string} params.name - Nombre legible
 * @param {string} [params.description] - Descripción opcional
 * @param {Object} params.definition - Definición JSON
 * @param {number} params.version - Versión (debe ser 1 para nuevas)
 * @param {string} params.status - Status (debe ser 'draft' para nuevas)
 * @param {string} params.created_by - Actor que crea
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} Definición creada
 */
export async function createDefinition(params, client = null) {
  const {
    automation_key,
    name,
    description = null,
    definition,
    version = 1,
    status = 'draft',
    created_by = null
  } = params;

  const queryFn = client ? client.query.bind(client) : query;

  const result = await queryFn(`
    INSERT INTO automation_definitions (
      automation_key,
      name,
      description,
      definition,
      version,
      status,
      created_by
    )
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
    RETURNING *
  `, [
    automation_key,
    name,
    description,
    JSON.stringify(definition),
    version,
    status,
    created_by
  ]);

  const row = result.rows[0];
  return {
    id: row.id,
    automation_key: row.automation_key,
    name: row.name,
    description: row.description,
    definition: row.definition,
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  };
}

/**
 * Actualiza una definición existente (con validación de versión)
 * 
 * @param {string} definitionId - ID de la definición
 * @param {Object} params - Parámetros de actualización
 * @param {string} [params.name] - Nombre legible
 * @param {string} [params.description] - Descripción
 * @param {Object} [params.definition] - Definición JSON
 * @param {number} params.expectedVersion - Versión esperada (para prevenir conflictos)
 * @param {string} params.updated_by - Actor que actualiza
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Definición actualizada o null si no existe o conflicto de versión
 */
export async function updateDefinition(definitionId, params, client = null) {
  const {
    name,
    description,
    definition,
    expectedVersion,
    updated_by = null
  } = params;

  const queryFn = client ? client.query.bind(client) : query;

  // Construir SET dinámicamente
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(name);
  }

  if (description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(description);
  }

  if (definition !== undefined) {
    updates.push(`definition = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(definition));
  }

  // Siempre actualizar version, updated_at, updated_by
  updates.push(`version = version + 1`);
  updates.push(`updated_at = NOW()`);
  if (updated_by !== null) {
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(updated_by);
  }

  // Añadir condiciones WHERE
  values.push(definitionId, expectedVersion);

  const result = await queryFn(`
    UPDATE automation_definitions
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex++}
      AND version = $${paramIndex++}
      AND deleted_at IS NULL
    RETURNING *
  `, values);

  if (result.rows.length === 0) {
    return null; // No existe o conflicto de versión
  }

  const row = result.rows[0];
  return {
    id: row.id,
    automation_key: row.automation_key,
    name: row.name,
    description: row.description,
    definition: row.definition,
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  };
}

/**
 * Actualiza el status de una definición
 * 
 * @param {string} definitionId - ID de la definición
 * @param {string} newStatus - Nuevo status
 * @param {string} updated_by - Actor que actualiza
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object|null>} Definición actualizada o null si no existe
 */
export async function updateDefinitionStatus(definitionId, newStatus, updated_by = null, client = null) {
  const queryFn = client ? client.query.bind(client) : query;

  const result = await queryFn(`
    UPDATE automation_definitions
    SET 
      status = $1,
      updated_at = NOW(),
      updated_by = $2
    WHERE id = $3
      AND deleted_at IS NULL
    RETURNING *
  `, [newStatus, updated_by, definitionId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    automation_key: row.automation_key,
    name: row.name,
    description: row.description,
    definition: row.definition,
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by
  };
}

