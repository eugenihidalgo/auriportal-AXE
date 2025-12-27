// src/infra/repos/pde-contexts-repo-pg.js
// Repositorio PostgreSQL para Contextos PDE
//
// FASE 2 (v5.30.0): CORRECCIÓN CONTROLADA
// - Columnas dedicadas son la ÚNICA fuente de verdad
// - definition es DERIVADO (se construye desde columnas)
// - Política de soft-delete: no permitir recrear eliminados

import { query } from '../../../database/pg.js';

/**
 * Normaliza un payload eliminando campos undefined
 * FASE 2: Asegurar que no se envíen campos undefined al backend
 * 
 * @param {Object} data - Datos a normalizar
 * @returns {Object} Datos normalizados sin campos undefined
 */
function normalizePayload(data) {
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Valida combinaciones de campos según el contrato canónico
 * FASE 2: Validar combinaciones antes de guardar
 * 
 * @param {Object} data - Datos del contexto
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateCombinations(data) {
  const errors = [];
  const { kind, scope, type, allowed_values, injected } = data;

  // kind='level' → scope='structural' (obligatorio)
  if (kind === 'level' && scope !== 'structural') {
    errors.push(`kind='level' requiere scope='structural', pero se recibió scope='${scope}'`);
  }

  // type='enum' → allowed_values obligatorio y no vacío
  if (type === 'enum') {
    if (!allowed_values || !Array.isArray(allowed_values) || allowed_values.length === 0) {
      errors.push(`type='enum' requiere allowed_values no vacío`);
    }
  }

  // scope='system' → injected=true (recomendado, warning)
  if (scope === 'system' && injected === false) {
    console.warn(`[CONTEXTS][DIAG][VALIDATION] scope='system' normalmente debe tener injected=true`);
  }

  // scope='structural' → injected=true (recomendado, warning)
  if (scope === 'structural' && injected === false) {
    console.warn(`[CONTEXTS][DIAG][VALIDATION] scope='structural' normalmente debe tener injected=true`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Construye definition JSONB desde columnas dedicadas
 * FASE 2: definition es DERIVADO, se construye SIEMPRE desde columnas
 * 
 * @param {Object} columns - Columnas dedicadas
 * @returns {Object} definition JSONB
 */
function buildDefinitionFromColumns(columns) {
  const {
    type = 'string',
    scope = 'package',
    kind = 'normal',
    injected = false,
    allowed_values = null,
    default_value = null,
    description = null,
    origin = 'user_choice'
  } = columns;

  const definition = {
    type,
    scope,
    kind,
    injected,
    origin,
    description: description || ''
  };

  if (type === 'enum' && allowed_values) {
    definition.allowed_values = allowed_values;
  }

  if (default_value !== null && default_value !== undefined) {
    definition.default_value = default_value;
  }

  return definition;
}

/**
 * Repositorio para gestionar contextos PDE
 */
export class PdeContextsRepo {
  /**
   * Lista todos los contextos (activos por defecto, excluyendo eliminados)
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.onlyActive=true] - Si filtrar solo activos
   * @param {boolean} [options.includeDeleted=false] - Si incluir eliminados
   * @param {boolean} [options.includeArchived=false] - Si incluir archivados
   * @returns {Promise<Array>} Array de contextos
   */
  async list(options = {}) {
    const {
      onlyActive = true,
      includeDeleted = false,
      includeArchived = false
    } = options;

    let sql = `
      SELECT 
        id,
        context_key,
        label,
        description,
        definition,
        scope,
        kind,
        injected,
        type,
        allowed_values,
        default_value,
        status,
        created_at,
        updated_at,
        deleted_at
      FROM pde_contexts
      WHERE 1=1
    `;

    const params = [];

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    if (onlyActive && !includeArchived) {
      sql += ` AND status = 'active'`;
    }

    // FASE 2: FILTRADO CANÓNICO OBLIGATORIO (v5.27.0+)
    // Solo devolver contextos que cumplen el contrato canónico:
    // - scope, type, kind NOT NULL
    // - Si type = 'enum', allowed_values NOT NULL
    sql += ` AND scope IS NOT NULL`;
    sql += ` AND type IS NOT NULL`;
    sql += ` AND kind IS NOT NULL`;
    sql += ` AND (type != 'enum' OR allowed_values IS NOT NULL)`;

    sql += ` ORDER BY context_key ASC`;

    const result = await query(sql, params);
    // Parsear JSONB fields de forma segura
    return result.rows
      .filter(row => {
        // FILTRADO CRÍTICO: Verificación adicional por si acaso
        // Asegurar que deleted_at es NULL (aunque la query ya lo filtra)
        return !row.deleted_at;
      })
      .map(row => {
        let parsedDefinition = row.definition;
        if (typeof parsedDefinition === 'string') {
          try {
            parsedDefinition = JSON.parse(parsedDefinition);
          } catch (e) {
            parsedDefinition = row.definition;
          }
        }
        
        let parsedAllowedValues = row.allowed_values;
        if (parsedAllowedValues && typeof parsedAllowedValues === 'string') {
          try {
            parsedAllowedValues = JSON.parse(parsedAllowedValues);
          } catch (e) {
            parsedAllowedValues = row.allowed_values;
          }
        }
        
        let parsedDefaultValue = row.default_value;
        if (parsedDefaultValue && typeof parsedDefaultValue === 'string') {
          try {
            parsedDefaultValue = JSON.parse(parsedDefaultValue);
          } catch (e) {
            parsedDefaultValue = row.default_value;
          }
        }
        
        return {
          ...row,
          definition: parsedDefinition,
          allowed_values: parsedAllowedValues,
          default_value: parsedDefaultValue
        };
      });
  }

  /**
   * Obtiene un contexto por context_key
   * 
   * FASE 2 (v5.30.0): Corregido para manejar includeDeleted correctamente
   * 
   * @param {string} contextKey - Clave del contexto
   * @param {boolean} [includeDeleted=false] - Si incluir eliminados
   * @returns {Promise<Object|null>} Contexto o null si no existe
   */
  async getByKey(contextKey, includeDeleted = false) {
    if (!contextKey) return null;

    let sql = `
      SELECT 
        id,
        context_key,
        label,
        description,
        definition,
        scope,
        kind,
        injected,
        type,
        allowed_values,
        default_value,
        status,
        created_at,
        updated_at,
        deleted_at
      FROM pde_contexts
      WHERE context_key = $1
    `;

    const params = [contextKey];

    if (!includeDeleted) {
      sql += ` AND deleted_at IS NULL`;
    }

    // FASE 2: FILTRADO CANÓNICO OBLIGATORIO (solo para activos)
    // Si includeDeleted=true, no aplicar filtro canónico (puede haber eliminados inválidos)
    if (!includeDeleted) {
      sql += ` AND scope IS NOT NULL`;
      sql += ` AND type IS NOT NULL`;
      sql += ` AND kind IS NOT NULL`;
      sql += ` AND (type != 'enum' OR allowed_values IS NOT NULL)`;
    }

    const result = await query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // FASE 2: Si includeDeleted=false, verificar que no esté eliminado
    if (!includeDeleted && row.deleted_at) {
      return null;
    }
    
    // Parsear JSONB fields
    let parsedDefinition = row.definition;
    if (typeof parsedDefinition === 'string') {
      try {
        parsedDefinition = JSON.parse(parsedDefinition);
      } catch (e) {
        parsedDefinition = row.definition;
      }
    }
    
    let parsedAllowedValues = row.allowed_values;
    if (parsedAllowedValues && typeof parsedAllowedValues === 'string') {
      try {
        parsedAllowedValues = JSON.parse(parsedAllowedValues);
      } catch (e) {
        parsedAllowedValues = row.allowed_values;
      }
    }
    
    let parsedDefaultValue = row.default_value;
    if (parsedDefaultValue && typeof parsedDefaultValue === 'string') {
      try {
        parsedDefaultValue = JSON.parse(parsedDefaultValue);
      } catch (e) {
        parsedDefaultValue = row.default_value;
      }
    }
    
    return {
      ...row,
      definition: parsedDefinition,
      allowed_values: parsedAllowedValues,
      default_value: parsedDefaultValue
    };
  }

  /**
   * Crea un nuevo contexto
   * 
   * FASE 2 (v5.30.0): Columnas dedicadas son la única fuente de verdad
   * - definition se construye SIEMPRE desde columnas
   * - No se confía en definition entrante
   * - Política de soft-delete: error claro si existe (activo o eliminado)
   * 
   * @param {Object} data - Datos del contexto
   * @param {string} data.context_key - Clave única del contexto
   * @param {string} data.label - Etiqueta legible
   * @param {string} [data.description] - Descripción opcional
   * @param {string} [data.scope='package'] - Scope: system, structural, personal, package
   * @param {string} [data.kind='normal'] - Kind: normal, level
   * @param {boolean} [data.injected=false] - Si el runtime lo inyecta automáticamente
   * @param {string} [data.type='string'] - Tipo: string, number, boolean, enum, json
   * @param {Array} [data.allowed_values] - Valores permitidos (solo para enum)
   * @param {any} [data.default_value] - Valor por defecto
   * @param {string} [data.status='active'] - Estado del contexto
   * @returns {Promise<Object>} Contexto creado
   */
  async create(data) {
    // FASE 2: Normalizar payload (eliminar undefined)
    const normalized = normalizePayload(data);
    
    const {
      context_key,
      label,
      description = null,
      scope = 'package',
      kind = 'normal',
      injected = false,
      type = 'string',
      allowed_values = null,
      default_value = null,
      status = 'active'
    } = normalized;

    // Validaciones básicas
    if (!context_key || !label) {
      throw new Error('context_key y label son obligatorios');
    }

    // FASE 2: Política de soft-delete - verificar si existe (activo o eliminado)
    const existingActive = await this.getByKey(context_key, false); // includeDeleted = false
    if (existingActive) {
      throw new Error(`El contexto '${context_key}' ya existe (activo)`);
    }

    // Verificar si existe eliminado
    const existingDeleted = await this.getByKey(context_key, true); // includeDeleted = true
    if (existingDeleted && existingDeleted.deleted_at) {
      throw new Error(
        `El contexto '${context_key}' fue eliminado anteriormente. ` +
        `No se puede recrear automáticamente. ` +
        `Use el método restore() para restaurarlo o cambie el context_key.`
      );
    }

    // FASE 2: Validar combinaciones
    const validation = validateCombinations({
      kind,
      scope,
      type,
      allowed_values,
      injected
    });

    if (!validation.valid) {
      console.error('[CONTEXTS][DIAG][CREATE] Validación fallida:', {
        context_key,
        errors: validation.errors,
        type,
        has_allowed_values: !!allowed_values,
        allowed_values_type: typeof allowed_values,
        allowed_values_is_array: Array.isArray(allowed_values),
        allowed_values_length: Array.isArray(allowed_values) ? allowed_values.length : 'not-array',
        allowed_values_preview: Array.isArray(allowed_values) ? allowed_values.slice(0, 3) : allowed_values
      });
      throw new Error(`Validación fallida: ${validation.errors.join('; ')}`);
    }

    // FASE 2: Construir definition desde columnas (ÚNICA fuente de verdad)
    const finalDefinition = buildDefinitionFromColumns({
      type,
      scope,
      kind,
      injected,
      allowed_values,
      default_value,
      description,
      origin: 'user_choice'
    });

    // Log estructurado temporal
    console.log('[CONTEXTS][DIAG][CREATE]', {
      context_key,
      scope,
      kind,
      type,
      injected,
      has_allowed_values: !!allowed_values,
      allowed_values_count: allowed_values ? (Array.isArray(allowed_values) ? allowed_values.length : 'not-array') : null,
      allowed_values_preview: allowed_values ? (Array.isArray(allowed_values) ? allowed_values.slice(0, 3) : allowed_values) : null,
      has_default_value: default_value !== null && default_value !== undefined
    });

    const sql = `
      INSERT INTO pde_contexts (
        context_key, label, description, definition,
        scope, kind, injected, type, allowed_values, default_value, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id,
        context_key,
        label,
        description,
        definition,
        scope,
        kind,
        injected,
        type,
        allowed_values,
        default_value,
        status,
        created_at,
        updated_at,
        deleted_at
    `;

    // FASE 2: Log para diagnóstico
    console.log('[CONTEXTS][DIAG][CREATE] Parámetros antes de INSERT:', {
      context_key,
      type,
      allowed_values_type: typeof allowed_values,
      allowed_values_is_array: Array.isArray(allowed_values),
      allowed_values_length: Array.isArray(allowed_values) ? allowed_values.length : 'not-array',
      allowed_values_preview: Array.isArray(allowed_values) ? allowed_values.slice(0, 3) : allowed_values,
      allowed_values_stringified: allowed_values ? JSON.stringify(allowed_values) : null
    });

    const params = [
      context_key,
      label,
      description,
      JSON.stringify(finalDefinition), // definition derivado
      scope,
      kind,
      injected,
      type,
      allowed_values ? JSON.stringify(allowed_values) : null,
      default_value !== null && default_value !== undefined ? JSON.stringify(default_value) : null,
      status
    ];

    const result = await query(sql, params);
    const row = result.rows[0];
    
    // Parsear JSONB fields de forma segura
    let parsedDefinition = row.definition;
    if (typeof parsedDefinition === 'string') {
      try {
        parsedDefinition = JSON.parse(parsedDefinition);
      } catch (e) {
        // Si falla, mantener como string
        parsedDefinition = row.definition;
      }
    }
    
    let parsedAllowedValues = row.allowed_values;
    if (parsedAllowedValues && typeof parsedAllowedValues === 'string') {
      try {
        parsedAllowedValues = JSON.parse(parsedAllowedValues);
      } catch (e) {
        parsedAllowedValues = row.allowed_values;
      }
    }
    
    let parsedDefaultValue = row.default_value;
    if (parsedDefaultValue && typeof parsedDefaultValue === 'string') {
      try {
        parsedDefaultValue = JSON.parse(parsedDefaultValue);
      } catch (e) {
        // Si falla, mantener como string (puede ser un string simple)
        parsedDefaultValue = row.default_value;
      }
    }
    
    return {
      ...row,
      definition: parsedDefinition,
      allowed_values: parsedAllowedValues,
      default_value: parsedDefaultValue
    };
  }

  /**
   * Actualiza un contexto existente
   * 
   * FASE 2 (v5.30.0): 
   * - Normalizar payload (eliminar undefined)
   * - No permitir borrar campos obligatorios
   * - Reconstruir definition desde columnas después del update
   * - Validar combinaciones
   * 
   * @param {string} contextKey - Clave del contexto a actualizar
   * @param {Object} patch - Campos a actualizar
   * @param {string} [patch.label] - Nueva etiqueta
   * @param {string} [patch.description] - Nueva descripción
   * @param {string} [patch.scope] - Nuevo scope
   * @param {string} [patch.kind] - Nuevo kind
   * @param {boolean} [patch.injected] - Nuevo injected
   * @param {string} [patch.type] - Nuevo type
   * @param {Array} [patch.allowed_values] - Nuevos allowed_values
   * @param {any} [patch.default_value] - Nuevo default_value
   * @param {string} [patch.status] - Nuevo estado
   * @returns {Promise<Object|null>} Contexto actualizado o null si no existe
   */
  async updateByKey(contextKey, patch) {
    if (!contextKey) {
      throw new Error('context_key es obligatorio');
    }

    // FASE 2: Normalizar payload (eliminar undefined)
    const normalizedPatch = normalizePayload(patch);

    // Obtener contexto actual para validar y construir definition
    const current = await this.getByKey(contextKey);
    if (!current) {
      return null;
    }

    // FASE 2: Construir objeto con valores finales (actual + patch)
    const final = {
      scope: normalizedPatch.scope !== undefined ? normalizedPatch.scope : current.scope,
      kind: normalizedPatch.kind !== undefined ? normalizedPatch.kind : current.kind,
      type: normalizedPatch.type !== undefined ? normalizedPatch.type : current.type,
      injected: normalizedPatch.injected !== undefined ? normalizedPatch.injected : current.injected,
      allowed_values: normalizedPatch.allowed_values !== undefined ? normalizedPatch.allowed_values : current.allowed_values,
      default_value: normalizedPatch.default_value !== undefined ? normalizedPatch.default_value : current.default_value,
      description: normalizedPatch.description !== undefined ? normalizedPatch.description : current.description
    };

    // FASE 2: Validar combinaciones con valores finales
    const validation = validateCombinations(final);
    if (!validation.valid) {
      throw new Error(`Validación fallida: ${validation.errors.join('; ')}`);
    }

    // FASE 2: No permitir borrar campos obligatorios
    // scope, kind, type son obligatorios (NOT NULL en BD)
    if (normalizedPatch.scope === null || normalizedPatch.kind === null || normalizedPatch.type === null) {
      throw new Error('No se pueden borrar campos obligatorios: scope, kind, type');
    }

    // Si type='enum', allowed_values no puede ser null
    if (final.type === 'enum' && final.allowed_values === null) {
      throw new Error('type="enum" requiere allowed_values no vacío');
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (normalizedPatch.label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      params.push(normalizedPatch.label);
    }

    if (normalizedPatch.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(normalizedPatch.description);
    }

    if (normalizedPatch.scope !== undefined) {
      updates.push(`scope = $${paramIndex++}`);
      params.push(normalizedPatch.scope);
    }

    if (normalizedPatch.kind !== undefined) {
      updates.push(`kind = $${paramIndex++}`);
      params.push(normalizedPatch.kind);
    }

    if (normalizedPatch.injected !== undefined) {
      updates.push(`injected = $${paramIndex++}`);
      params.push(normalizedPatch.injected);
    }

    if (normalizedPatch.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(normalizedPatch.type);
    }

    if (normalizedPatch.allowed_values !== undefined) {
      updates.push(`allowed_values = $${paramIndex++}`);
      params.push(normalizedPatch.allowed_values ? JSON.stringify(normalizedPatch.allowed_values) : null);
    }

    if (normalizedPatch.default_value !== undefined) {
      updates.push(`default_value = $${paramIndex++}`);
      params.push(normalizedPatch.default_value !== null && normalizedPatch.default_value !== undefined 
        ? JSON.stringify(normalizedPatch.default_value) 
        : null);
    }

    if (normalizedPatch.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(normalizedPatch.status);
    }

    if (updates.length === 0) {
      // No hay cambios, devolver el contexto actual
      return await this.getByKey(contextKey);
    }

    // FASE 2: Reconstruir definition desde columnas finales
    const finalDefinition = buildDefinitionFromColumns(final);
    updates.push(`definition = $${paramIndex++}`);
    params.push(JSON.stringify(finalDefinition));

    // Log estructurado temporal
    console.log('[CONTEXTS][DIAG][UPDATE]', {
      context_key: contextKey,
      fields_updated: updates.length,
      final_scope: final.scope,
      final_kind: final.kind,
      final_type: final.type
    });

    updates.push(`updated_at = NOW()`);
    params.push(contextKey);

    const sql = `
      UPDATE pde_contexts
      SET ${updates.join(', ')}
      WHERE context_key = $${paramIndex} AND deleted_at IS NULL
      RETURNING 
        id,
        context_key,
        label,
        description,
        definition,
        scope,
        kind,
        injected,
        type,
        allowed_values,
        default_value,
        status,
        created_at,
        updated_at,
        deleted_at
    `;

    const result = await query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Parsear JSONB fields de forma segura
    let parsedDefinition = row.definition;
    if (typeof parsedDefinition === 'string') {
      try {
        parsedDefinition = JSON.parse(parsedDefinition);
      } catch (e) {
        parsedDefinition = row.definition;
      }
    }
    
    let parsedAllowedValues = row.allowed_values;
    if (parsedAllowedValues && typeof parsedAllowedValues === 'string') {
      try {
        parsedAllowedValues = JSON.parse(parsedAllowedValues);
      } catch (e) {
        parsedAllowedValues = row.allowed_values;
      }
    }
    
    let parsedDefaultValue = row.default_value;
    if (parsedDefaultValue && typeof parsedDefaultValue === 'string') {
      try {
        parsedDefaultValue = JSON.parse(parsedDefaultValue);
      } catch (e) {
        parsedDefaultValue = row.default_value;
      }
    }
    
    return {
      ...row,
      definition: parsedDefinition,
      allowed_values: parsedAllowedValues,
      default_value: parsedDefaultValue
    };
  }

  /**
   * Archiva un contexto (soft archive, cambia status a 'archived')
   * 
   * @param {string} contextKey - Clave del contexto
   * @returns {Promise<Object|null>} Contexto archivado o null si no existe
   */
  async archiveByKey(contextKey) {
    return await this.updateByKey(contextKey, { status: 'archived' });
  }

  /**
   * Elimina un contexto (soft delete)
   * 
   * @param {string} contextKey - Clave del contexto
   * @returns {Promise<boolean>} true si se eliminó, false si no existía
   */
  async softDeleteByKey(contextKey) {
    if (!contextKey) {
      return false;
    }

    const sql = `
      UPDATE pde_contexts
      SET deleted_at = NOW()
      WHERE context_key = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await query(sql, [contextKey]);
    
    // Log estructurado temporal
    if (result.rows.length > 0) {
      console.log('[CONTEXTS][DIAG][DELETE]', {
        context_key: contextKey,
        deleted: true
      });
    }
    
    return result.rows.length > 0;
  }

  /**
   * Restaura un contexto eliminado (soft delete)
   * 
   * FASE 2 (v5.30.0): Método explícito para restaurar contextos eliminados
   * 
   * @param {string} contextKey - Clave del contexto
   * @returns {Promise<Object|null>} Contexto restaurado o null si no existía o no estaba eliminado
   */
  async restoreByKey(contextKey) {
    if (!contextKey) {
      return null;
    }

    // Verificar que existe y está eliminado
    const existing = await this.getByKey(contextKey, true); // includeDeleted = true
    if (!existing || !existing.deleted_at) {
      return null;
    }

    // Restaurar (poner deleted_at = NULL)
    const sql = `
      UPDATE pde_contexts
      SET deleted_at = NULL, updated_at = NOW()
      WHERE context_key = $1 AND deleted_at IS NOT NULL
      RETURNING 
        id,
        context_key,
        label,
        description,
        definition,
        scope,
        kind,
        injected,
        type,
        allowed_values,
        default_value,
        status,
        created_at,
        updated_at,
        deleted_at
    `;

    const result = await query(sql, [contextKey]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Parsear JSONB fields
    let parsedDefinition = row.definition;
    if (typeof parsedDefinition === 'string') {
      try {
        parsedDefinition = JSON.parse(parsedDefinition);
      } catch (e) {
        parsedDefinition = row.definition;
      }
    }
    
    let parsedAllowedValues = row.allowed_values;
    if (parsedAllowedValues && typeof parsedAllowedValues === 'string') {
      try {
        parsedAllowedValues = JSON.parse(parsedAllowedValues);
      } catch (e) {
        parsedAllowedValues = row.allowed_values;
      }
    }
    
    let parsedDefaultValue = row.default_value;
    if (parsedDefaultValue && typeof parsedDefaultValue === 'string') {
      try {
        parsedDefaultValue = JSON.parse(parsedDefaultValue);
      } catch (e) {
        parsedDefaultValue = row.default_value;
      }
    }

    // Log estructurado temporal
    console.log('[CONTEXTS][DIAG][RESTORE]', {
      context_key: contextKey,
      restored: true
    });
    
    return {
      ...row,
      definition: parsedDefinition,
      allowed_values: parsedAllowedValues,
      default_value: parsedDefaultValue
    };
  }

  /**
   * Registra una acción en el audit log
   * 
   * @param {Object} data - Datos del log
   * @param {string} data.context_id - UUID del contexto
   * @param {string} data.action - Acción (create, update, archive, delete)
   * @param {string} [data.actor_admin_id] - ID del administrador
   * @param {Object} [data.before] - Estado anterior
   * @param {Object} [data.after] - Estado nuevo
   * @returns {Promise<Object>} Log creado
   */
  async logAudit(data) {
    const {
      context_id,
      action,
      actor_admin_id = null,
      before = null,
      after = null
    } = data;

    if (!context_id || !action) {
      throw new Error('context_id y action son obligatorios');
    }

    const sql = `
      INSERT INTO pde_context_audit_log (context_id, action, actor_admin_id, before, after)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        context_id,
        action,
        actor_admin_id,
        before,
        after,
        created_at
    `;

    const params = [
      context_id,
      action,
      actor_admin_id,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ];

    const result = await query(sql, params);
    const row = result.rows[0];
    return {
      ...row,
      before: typeof row.before === 'string' ? JSON.parse(row.before) : row.before,
      after: typeof row.after === 'string' ? JSON.parse(row.after) : row.after
    };
  }
}

// Instancia singleton
let defaultRepo = null;

/**
 * Obtiene la instancia singleton del repositorio
 * 
 * @returns {PdeContextsRepo} Instancia del repositorio
 */
export function getDefaultPdeContextsRepo() {
  if (!defaultRepo) {
    defaultRepo = new PdeContextsRepo();
  }
  return defaultRepo;
}



