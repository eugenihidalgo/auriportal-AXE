// src/infra/repos/pde-contexts-repo-pg.js
// Repositorio PostgreSQL para Contextos PDE

import { query } from '../../../database/pg.js';

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

    // FASE 2: FILTRADO CANÓNICO OBLIGATORIO (v5.27.0+)
    // Solo devolver contextos que cumplen el contrato canónico
    sql += ` AND scope IS NOT NULL`;
    sql += ` AND type IS NOT NULL`;
    sql += ` AND kind IS NOT NULL`;
    sql += ` AND (type != 'enum' OR allowed_values IS NOT NULL)`;

    const result = await query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // FILTRADO CRÍTICO: Verificación adicional por si acaso
    // Asegurar que deleted_at es NULL (aunque la query ya lo filtra)
    if (row.deleted_at) {
      return null;
    }
    
    return {
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    };
  }

  /**
   * Crea un nuevo contexto
   * 
   * @param {Object} data - Datos del contexto
   * @param {string} data.context_key - Clave única del contexto
   * @param {string} data.label - Etiqueta legible
   * @param {string} [data.description] - Descripción opcional
   * @param {Object} [data.definition] - Definición JSON del contexto (legacy, se migra a campos dedicados)
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
    const {
      context_key,
      label,
      description = null,
      definition = null,
      scope = 'package',
      kind = 'normal',
      injected = false,
      type = 'string',
      allowed_values = null,
      default_value = null,
      status = 'active'
    } = data;

    if (!context_key || !label) {
      throw new Error('context_key y label son obligatorios');
    }

    // Validar que context_key no exista
    const existing = await this.getByKey(context_key, true);
    if (existing) {
      throw new Error(`El contexto '${context_key}' ya existe`);
    }

    // Si se proporciona definition (legacy), extraer campos
    let finalType = type;
    let finalAllowedValues = allowed_values;
    let finalDefaultValue = default_value;
    let finalScope = scope;
    let finalKind = kind;
    let finalInjected = injected;
    let finalDescription = description;
    
    if (definition && typeof definition === 'object') {
      if (definition.type) finalType = definition.type;
      if (definition.allowed_values) finalAllowedValues = definition.allowed_values;
      if (definition.default_value !== undefined) finalDefaultValue = definition.default_value;
      if (definition.scope) finalScope = definition.scope;
      if (definition.kind) finalKind = definition.kind;
      if (definition.injected !== undefined) finalInjected = definition.injected;
      if (definition.description && !finalDescription) finalDescription = definition.description;
    }

    // Construir definition mínimo si no se proporciona (obligatorio en DB)
    let finalDefinition = definition;
    if (!finalDefinition || typeof finalDefinition !== 'object') {
      finalDefinition = {
        type: finalType,
        scope: finalScope,
        origin: 'user_choice',
        description: finalDescription || ''
      };
      if (finalAllowedValues) finalDefinition.allowed_values = finalAllowedValues;
      if (finalDefaultValue !== null && finalDefaultValue !== undefined) finalDefinition.default_value = finalDefaultValue;
    }

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

    const params = [
      context_key,
      label,
      finalDescription,
      JSON.stringify(finalDefinition),
      finalScope,
      finalKind,
      finalInjected,
      finalType,
      finalAllowedValues ? JSON.stringify(finalAllowedValues) : null,
      finalDefaultValue !== null && finalDefaultValue !== undefined ? JSON.stringify(finalDefaultValue) : null,
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
   * @param {string} contextKey - Clave del contexto a actualizar
   * @param {Object} patch - Campos a actualizar
   * @param {string} [patch.label] - Nueva etiqueta
   * @param {string} [patch.description] - Nueva descripción
   * @param {Object} [patch.definition] - Nueva definición (legacy)
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

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (patch.label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      params.push(patch.label);
    }

    if (patch.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(patch.description);
    }

    if (patch.definition !== undefined) {
      updates.push(`definition = $${paramIndex++}`);
      params.push(JSON.stringify(patch.definition));
    }

    if (patch.scope !== undefined) {
      updates.push(`scope = $${paramIndex++}`);
      params.push(patch.scope);
    }

    if (patch.kind !== undefined) {
      updates.push(`kind = $${paramIndex++}`);
      params.push(patch.kind);
    }

    if (patch.injected !== undefined) {
      updates.push(`injected = $${paramIndex++}`);
      params.push(patch.injected);
    }

    if (patch.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(patch.type);
    }

    if (patch.allowed_values !== undefined) {
      updates.push(`allowed_values = $${paramIndex++}`);
      params.push(patch.allowed_values ? JSON.stringify(patch.allowed_values) : null);
    }

    if (patch.default_value !== undefined) {
      updates.push(`default_value = $${paramIndex++}`);
      params.push(patch.default_value !== null && patch.default_value !== undefined 
        ? JSON.stringify(patch.default_value) 
        : null);
    }

    if (patch.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(patch.status);
    }

    if (updates.length === 0) {
      // No hay cambios, devolver el contexto actual
      return await this.getByKey(contextKey);
    }

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
    return result.rows.length > 0;
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



