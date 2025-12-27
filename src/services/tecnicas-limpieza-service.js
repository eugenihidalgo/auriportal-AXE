// src/services/tecnicas-limpieza-service.js
// Servicio Canónico de Técnicas de Limpieza
//
// Responsabilidades:
// - Validación mínima
// - Normalización
// - Ninguna lógica de UI
// - Preparado para consumo por Packages

import { getTecnicasLimpiezaRepo } from '../infra/repos/tecnicas-limpieza-repo-pg.js';
import { logError } from '../core/observability/logger.js';
import * as interactiveResourceService from './interactive-resource-service.js';

/**
 * Contrato de filtros canónicos para Técnicas de Limpieza
 * 
 * Define qué campos son filtrables y qué operadores están permitidos.
 * 
 * Operadores permitidos:
 * - eq: igualdad exacta
 * - lte: menor o igual (<=)
 * - gte: mayor o igual (>=)
 * - contains: contiene substring (LIKE '%valor%')
 * - startsWith: empieza con (LIKE 'valor%')
 * - in: pertenece a array (IN (valor1, valor2, ...))
 */
export const FILTER_CONTRACT = {
  level: {
    type: 'number',
    operators: ['eq', 'lte', 'gte'],
    description: 'Nivel energético de la técnica'
  },
  nombre: {
    type: 'string',
    operators: ['contains', 'startsWith'],
    description: 'Nombre de la técnica'
  },
  aplica_energias_indeseables: {
    type: 'boolean',
    operators: ['eq'],
    description: 'Si aplica para energías indeseables'
  },
  aplica_limpiezas_recurrentes: {
    type: 'boolean',
    operators: ['eq'],
    description: 'Si aplica para limpiezas recurrentes'
  },
  status: {
    type: 'string',
    operators: ['eq'],
    allowed: ['active', 'archived'],
    description: 'Estado de la técnica'
  },
  // Filtros derivados (requieren join con interactive_resources)
  has_video: {
    type: 'boolean',
    operators: ['eq'],
    description: 'Técnica con vídeo asociado',
    requires_join: true
  },
  has_audio: {
    type: 'boolean',
    operators: ['eq'],
    description: 'Técnica con audio asociado',
    requires_join: true
  },
  has_image: {
    type: 'boolean',
    operators: ['eq'],
    description: 'Técnica con imagen asociada',
    requires_join: true
  }
};

/**
 * Valida filtros contra FILTER_CONTRACT
 */
function validateFilters(filters) {
  const errors = [];
  
  for (const [field, condition] of Object.entries(filters)) {
    const contract = FILTER_CONTRACT[field];
    
    if (!contract) {
      errors.push(`Campo '${field}' no es filtrable. Campos disponibles: ${Object.keys(FILTER_CONTRACT).join(', ')}`);
      continue;
    }
    
    // Si condition es un objeto con operadores
    if (typeof condition === 'object' && !Array.isArray(condition)) {
      for (const [operator, value] of Object.entries(condition)) {
        if (!contract.operators.includes(operator)) {
          errors.push(`Operador '${operator}' no permitido para campo '${field}'. Operadores permitidos: ${contract.operators.join(', ')}`);
        }
        
        // Validar valor según tipo
        if (contract.type === 'number' && typeof value !== 'number') {
          errors.push(`Valor para campo '${field}' debe ser número`);
        }
        if (contract.type === 'string' && typeof value !== 'string') {
          errors.push(`Valor para campo '${field}' debe ser string`);
        }
        if (contract.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Valor para campo '${field}' debe ser boolean`);
        }
        if (contract.allowed && !contract.allowed.includes(value)) {
          errors.push(`Valor '${value}' no permitido para campo '${field}'. Valores permitidos: ${contract.allowed.join(', ')}`);
        }
      }
    } else {
      // Si es valor directo, asumir 'eq'
      if (!contract.operators.includes('eq')) {
        errors.push(`Campo '${field}' no soporta igualdad directa. Usa operadores: ${contract.operators.join(', ')}`);
      }
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Filtros inválidos: ${errors.join('; ')}`);
  }
}

/**
 * Construye query SQL desde filtros validados
 */
function buildQueryFromFilters(filters, options = {}) {
  const { include, exclude, limit, offset, orderBy, orderDir = 'ASC' } = options;
  
  let sql = 'SELECT';
  
  // Inclusión parcial o exclusión de campos
  if (include && Array.isArray(include)) {
    const fields = include.map(f => `t.${f}`).join(', ');
    sql += ` ${fields}`;
  } else if (exclude && Array.isArray(exclude)) {
    // Obtener todas las columnas y excluir
    sql += ' t.*'; // Simplificado, en producción podría ser más complejo
  } else {
    sql += ' t.*';
  }
  
  sql += ' FROM tecnicas_limpieza t';
  
  // Detectar si necesitamos join con interactive_resources
  const needsJoin = Object.keys(filters).some(field => {
    const contract = FILTER_CONTRACT[field];
    return contract && contract.requires_join;
  });
  
  if (needsJoin) {
    sql += ` LEFT JOIN interactive_resources ir ON ir.origin->>'sot' = 'tecnicas-limpieza' AND ir.origin->>'entity_id' = t.id::TEXT AND ir.status = 'active'`;
  }
  
  const params = [];
  const conditions = [];
  
  // Aplicar filtros
  for (const [field, condition] of Object.entries(filters)) {
    const contract = FILTER_CONTRACT[field];
    
    if (!contract) continue;
    
    if (contract.requires_join) {
      // Filtros que requieren join con interactive_resources
      if (field === 'has_video' && condition.eq === true) {
        conditions.push(`EXISTS (SELECT 1 FROM interactive_resources ir2 WHERE ir2.origin->>'sot' = 'tecnicas-limpieza' AND ir2.origin->>'entity_id' = t.id::TEXT AND ir2.resource_type = 'video' AND ir2.status = 'active')`);
      } else if (field === 'has_audio' && condition.eq === true) {
        conditions.push(`EXISTS (SELECT 1 FROM interactive_resources ir2 WHERE ir2.origin->>'sot' = 'tecnicas-limpieza' AND ir2.origin->>'entity_id' = t.id::TEXT AND ir2.resource_type = 'audio' AND ir2.status = 'active')`);
      } else if (field === 'has_image' && condition.eq === true) {
        conditions.push(`EXISTS (SELECT 1 FROM interactive_resources ir2 WHERE ir2.origin->>'sot' = 'tecnicas-limpieza' AND ir2.origin->>'entity_id' = t.id::TEXT AND ir2.resource_type = 'image' AND ir2.status = 'active')`);
      }
    } else {
      // Filtros directos
      if (typeof condition === 'object' && !Array.isArray(condition)) {
        for (const [operator, value] of Object.entries(condition)) {
          if (operator === 'eq') {
            conditions.push(`t.${field} = $${params.length + 1}`);
            params.push(value);
          } else if (operator === 'lte') {
            conditions.push(`t.${field} <= $${params.length + 1}`);
            params.push(value);
          } else if (operator === 'gte') {
            conditions.push(`t.${field} >= $${params.length + 1}`);
            params.push(value);
          } else if (operator === 'contains') {
            conditions.push(`t.${field} LIKE $${params.length + 1}`);
            params.push(`%${value}%`);
          } else if (operator === 'startsWith') {
            conditions.push(`t.${field} LIKE $${params.length + 1}`);
            params.push(`${value}%`);
          } else if (operator === 'in') {
            const placeholders = Array.isArray(value) ? value.map((_, i) => `$${params.length + i + 1}`).join(', ') : `$${params.length + 1}`;
            conditions.push(`t.${field} IN (${placeholders})`);
            if (Array.isArray(value)) {
              params.push(...value);
            } else {
              params.push(value);
            }
          }
        }
      } else {
        // Valor directo (asumir eq)
        conditions.push(`t.${field} = $${params.length + 1}`);
        params.push(condition);
      }
    }
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  // Ordenamiento
  if (orderBy && FILTER_CONTRACT[orderBy]) {
    sql += ` ORDER BY t.${orderBy} ${orderDir === 'DESC' ? 'DESC' : 'ASC'}`;
  } else {
    // Ordenamiento canónico por defecto
    sql += ' ORDER BY t.nivel ASC, t.created_at ASC';
  }
  
  // Límite y offset
  if (limit) {
    sql += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }
  if (offset) {
    sql += ` OFFSET $${params.length + 1}`;
    params.push(offset);
  }
  
  return { sql, params };
}

/**
 * Lista técnicas con filtros (método legacy para compatibilidad)
 */
export async function listTecnicas(filters = {}) {
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.list(filters);
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error listando técnicas', {
      filters,
      error: error.message
    });
    throw error;
  }
}

/**
 * Lista técnicas para consumo programático por Packages, Resolvers, Widgets
 * 
 * Este método respeta FILTER_CONTRACT y permite filtros avanzados.
 * NO depende de contexto de UI.
 * 
 * @param {Object} filters - Filtros según FILTER_CONTRACT
 * @param {Object} options - Opciones de consumo
 * @param {boolean} [options.onlyActive=true] - Solo activos (se añade automáticamente)
 * @param {number} [options.limit] - Límite de resultados
 * @param {number} [options.offset] - Offset para paginación
 * @param {string} [options.orderBy] - Campo de ordenamiento
 * @param {string} [options.orderDir='ASC'] - Dirección (ASC/DESC)
 * @param {Array<string>} [options.include] - Campos a incluir (inclusión parcial)
 * @param {Array<string>} [options.exclude] - Campos a excluir
 * @returns {Promise<Array>} Array de técnicas
 */
export async function listForConsumption(filters = {}, options = {}) {
  try {
    // Validar filtros contra FILTER_CONTRACT
    validateFilters(filters);
    
    // Añadir filtro de status='active' por defecto si onlyActive=true
    if (options.onlyActive !== false) {
      if (!filters.status) {
        filters.status = { eq: 'active' };
      } else if (filters.status.eq && filters.status.eq !== 'active') {
        // Si explícitamente se pide archived, respetar
      }
    }
    
    // Construir query
    const { sql, params } = buildQueryFromFilters(filters, options);
    
    // Ejecutar query
    const { query } = await import('../../database/pg.js');
    const result = await query(sql, params);
    
    let tecnicas = result.rows || [];
    
    // Aplicar exclusión de campos si se especifica
    if (options.exclude && Array.isArray(options.exclude)) {
      tecnicas = tecnicas.map(tecnica => {
        const filtered = { ...tecnica };
        for (const field of options.exclude) {
          delete filtered[field];
        }
        return filtered;
      });
    }
    
    return tecnicas;
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error en listForConsumption', {
      filters,
      options,
      error: error.message
    });
    throw error;
  }
}

/**
 * Obtiene una técnica por ID
 */
export async function getTecnicaById(id) {
  if (!id) {
    return null;
  }
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.getById(id);
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error obteniendo técnica por ID', {
      id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Crea una nueva técnica
 */
export async function createTecnica(tecnicaData) {
  // Validación mínima
  if (!tecnicaData.nombre || typeof tecnicaData.nombre !== 'string' || tecnicaData.nombre.trim().length === 0) {
    throw new Error('nombre es requerido y debe ser un string no vacío');
  }
  if (tecnicaData.nivel === undefined || tecnicaData.nivel === null || typeof tecnicaData.nivel !== 'number') {
    throw new Error('nivel es requerido y debe ser un número');
  }
  if (tecnicaData.nivel < 1) {
    throw new Error('nivel debe ser mayor o igual a 1');
  }

  // Normalización
  const normalizedData = {
    nombre: tecnicaData.nombre.trim(),
    nivel: parseInt(tecnicaData.nivel, 10),
    descripcion: tecnicaData.descripcion ? tecnicaData.descripcion.trim() : null,
    estimated_duration: tecnicaData.estimated_duration ? parseInt(tecnicaData.estimated_duration, 10) : null,
    aplica_energias_indeseables: tecnicaData.aplica_energias_indeseables || false,
    aplica_limpiezas_recurrentes: tecnicaData.aplica_limpiezas_recurrentes || false,
    prioridad: tecnicaData.prioridad || 'media',
    is_obligatoria: tecnicaData.is_obligatoria || false,
    status: tecnicaData.status || 'active'
  };

  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.create(normalizedData);
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error creando técnica', {
      nombre: normalizedData.nombre,
      nivel: normalizedData.nivel,
      error: error.message
    });
    throw error;
  }
}

/**
 * Actualiza una técnica
 */
export async function updateTecnica(id, patch) {
  if (!id) {
    throw new Error('id es requerido');
  }

  // Normalización del patch
  const normalizedPatch = {};
  if (patch.nombre !== undefined) {
    if (typeof patch.nombre !== 'string' || patch.nombre.trim().length === 0) {
      throw new Error('nombre debe ser un string no vacío');
    }
    normalizedPatch.nombre = patch.nombre.trim();
  }
  if (patch.nivel !== undefined) {
    const nivel = parseInt(patch.nivel, 10);
    if (isNaN(nivel) || nivel < 1) {
      throw new Error('nivel debe ser un número mayor o igual a 1');
    }
    normalizedPatch.nivel = nivel;
  }
  if (patch.descripcion !== undefined) {
    normalizedPatch.descripcion = patch.descripcion ? patch.descripcion.trim() : null;
  }
  if (patch.estimated_duration !== undefined) {
    normalizedPatch.estimated_duration = patch.estimated_duration ? parseInt(patch.estimated_duration, 10) : null;
  }
  if (patch.aplica_energias_indeseables !== undefined) {
    normalizedPatch.aplica_energias_indeseables = Boolean(patch.aplica_energias_indeseables);
  }
  if (patch.aplica_limpiezas_recurrentes !== undefined) {
    normalizedPatch.aplica_limpiezas_recurrentes = Boolean(patch.aplica_limpiezas_recurrentes);
  }
  if (patch.status !== undefined) {
    if (!['active', 'archived'].includes(patch.status)) {
      throw new Error('status debe ser "active" o "archived"');
    }
    normalizedPatch.status = patch.status;
  }
  if (patch.prioridad !== undefined) {
    normalizedPatch.prioridad = patch.prioridad;
  }
  if (patch.is_obligatoria !== undefined) {
    normalizedPatch.is_obligatoria = Boolean(patch.is_obligatoria);
  }

  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.update(id, normalizedPatch);
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error actualizando técnica', {
      id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Archiva una técnica (soft delete)
 */
export async function archiveTecnica(id) {
  if (!id) {
    throw new Error('id es requerido');
  }
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.archive(id);
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error archivando técnica', {
      id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Elimina físicamente una técnica (delete físico)
 */
export async function deleteTecnica(id) {
  if (!id) {
    throw new Error('id es requerido');
  }
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.delete(id);
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error eliminando técnica', {
      id,
      error: error.message
    });
    throw error;
  }
}

