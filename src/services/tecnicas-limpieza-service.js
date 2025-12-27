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
 * IMPORTANTE: Los nombres de campo aquí deben mapear a columnas reales en PostgreSQL.
 * Ver COLUMN_MAP para el mapeo de nombres de filtro a nombres de columna.
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
  nivel: {
    type: 'number',
    operators: ['eq', 'lte', 'gte'],
    description: 'Nivel energético de la técnica',
    column: 'nivel' // Nombre real en PostgreSQL
  },
  nombre: {
    type: 'string',
    operators: ['contains', 'startsWith'],
    description: 'Nombre de la técnica',
    column: 'nombre' // Nombre real en PostgreSQL
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
  estimated_duration: {
    type: 'number',
    operators: ['eq', 'lte', 'gte'],
    description: 'Duración estimada en minutos'
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
  },
  clasificacion: {
    type: 'string',
    operators: ['eq'], // Solo 'eq' por ahora (el parser puede recibir 'in:' pero lo convierte a 'eq' con 1 valor)
    description: 'Clasificación de la técnica (valor normalizado). SOLO acepta UN string, NO arrays.',
    requires_join: true,
    max_values: 1 // Solo permite un valor por filtro
  }
};

/**
 * Mapeo de nombres de filtro a nombres de columna en PostgreSQL
 * Esto permite usar nombres semánticos en el frontend mientras se mapean a columnas reales
 */
const COLUMN_MAP = {
  nivel: 'nivel',
  nombre: 'nombre',
  status: 'status',
  estimated_duration: 'estimated_duration',
  aplica_energias_indeseables: 'aplica_energias_indeseables',
  aplica_limpiezas_recurrentes: 'aplica_limpiezas_recurrentes'
};

/**
 * Valida filtros contra FILTER_CONTRACT
 * 
 * Retorna array de errores (vacío si todo está bien)
 */
function validateFilters(filters) {
  const errors = [];
  
  // Si filtros está vacío o undefined, es válido
  if (!filters || typeof filters !== 'object' || Object.keys(filters).length === 0) {
    return errors;
  }
  
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
          continue;
        }
        
        // Validar valor según tipo
        if (contract.type === 'number' && typeof value !== 'number') {
          errors.push(`Valor para campo '${field}' debe ser número`);
          continue;
        }
        if (contract.type === 'string' && typeof value !== 'string') {
          errors.push(`Valor para campo '${field}' debe ser string`);
          continue;
        }
        if (contract.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Valor para campo '${field}' debe ser boolean`);
          continue;
        }
        if (contract.allowed && Array.isArray(contract.allowed) && !contract.allowed.includes(value)) {
          errors.push(`Valor '${value}' no permitido para campo '${field}'. Valores permitidos: ${contract.allowed.join(', ')}`);
          continue;
        }
      }
    } else {
      // Si es valor directo, asumir 'eq'
      if (!contract.operators.includes('eq')) {
        errors.push(`Campo '${field}' no soporta igualdad directa. Usa operadores: ${contract.operators.join(', ')}`);
      }
    }
  }
  
  return errors;
}

/**
 * Obtiene el nombre de columna real para un campo de filtro
 */
function getColumnName(field) {
  // Si el contrato especifica una columna, usarla
  const contract = FILTER_CONTRACT[field];
  if (contract && contract.column) {
    return contract.column;
  }
  // Si no, usar el mapeo
  if (COLUMN_MAP[field]) {
    return COLUMN_MAP[field];
  }
  // Por defecto, asumir que el nombre del filtro es el nombre de la columna
  return field;
}

/**
 * Construye query SQL desde filtros validados
 * 
 * IMPORTANTE: Usa nombres de columna reales de PostgreSQL, no nombres de filtro semánticos
 */
async function buildQueryFromFilters(filters, options = {}) {
  const { include, exclude, limit, offset, orderBy, orderDir = 'ASC' } = options;
  
  let sql = 'SELECT';
  
  // Inclusión parcial o exclusión de campos
  if (include && Array.isArray(include)) {
    const fields = include.map(f => {
      const colName = getColumnName(f);
      return `t.${colName}`;
    }).join(', ');
    sql += ` ${fields}`;
  } else if (exclude && Array.isArray(exclude)) {
    sql += ' t.*';
  } else {
    sql += ' t.*';
  }
  
  sql += ' FROM tecnicas_limpieza t';
  
  // Detectar si necesitamos join con interactive_resources o clasificaciones
  const needsResourceJoin = Object.keys(filters).some(field => {
    const contract = FILTER_CONTRACT[field];
    return contract && contract.requires_join && field !== 'clasificacion';
  });
  
  const needsClassificationJoin = Object.keys(filters).some(field => {
    return field === 'clasificacion';
  });
  
  if (needsResourceJoin) {
    sql += ` LEFT JOIN interactive_resources ir ON ir.origin->>'sot' = 'tecnicas-limpieza' AND ir.origin->>'entity_id' = t.id::TEXT AND ir.status = 'active'`;
  }
  
  if (needsClassificationJoin) {
    sql += ` INNER JOIN tecnicas_limpieza_classifications tlc ON tlc.tecnica_id = t.id
             INNER JOIN pde_classification_terms ct ON ct.id = tlc.classification_term_id AND ct.type = 'tag'`;
  }
  
  const params = [];
  const conditions = [];
  
  // Aplicar filtros
  for (const [field, condition] of Object.entries(filters)) {
    const contract = FILTER_CONTRACT[field];
    
    if (!contract) continue;
    
    if (field === 'clasificacion') {
      // Filtros por clasificación (requieren join con clasificaciones)
      // IMPORTANTE: Solo acepta 'eq' con UN string (el parser ya limita, pero validamos aquí también)
      if (typeof condition === 'object' && !Array.isArray(condition)) {
        for (const [operator, value] of Object.entries(condition)) {
          if (operator === 'eq') {
            // Validar que value es string
            if (!value || typeof value !== 'string') {
              logError('TECNICAS_LIMPIEZA_QUERY', 'Valor inválido para filtro clasificacion', {
                operator,
                value,
                type: typeof value
              });
              continue;
            }
            
            // Normalizar valor para comparar con normalized
            try {
              const { query: queryFn } = await import('../../database/pg.js');
              const normResult = await queryFn('SELECT normalize_classification_term($1) as normalized', [value]);
              if (normResult.rows && normResult.rows[0]) {
                const normalized = normResult.rows[0].normalized;
                conditions.push(`ct.normalized = $${params.length + 1}`);
                params.push(normalized);
              }
            } catch (normError) {
              logError('TECNICAS_LIMPIEZA_QUERY', 'Error normalizando clasificación', {
                value,
                error: normError.message
              });
              // Continuar sin este filtro si falla la normalización
            }
          } else if (operator === 'in') {
            // 'in' está permitido en el contrato pero limitado a 1 valor por el parser
            // Aquí manejamos arrays por seguridad pero limitamos a 1 valor
            const valuesToProcess = Array.isArray(value) ? value.slice(0, 1) : [value];
            const { query: queryFn } = await import('../../database/pg.js');
            const normalizedValues = [];
            for (const val of valuesToProcess) {
              if (!val || typeof val !== 'string') continue;
              try {
                const normResult = await queryFn('SELECT normalize_classification_term($1) as normalized', [val]);
                if (normResult.rows && normResult.rows[0]) {
                  normalizedValues.push(normResult.rows[0].normalized);
                }
              } catch (normError) {
                logError('TECNICAS_LIMPIEZA_QUERY', 'Error normalizando clasificación en IN', {
                  value: val,
                  error: normError.message
                });
              }
            }
            if (normalizedValues.length > 0) {
              const placeholders = normalizedValues.map((_, i) => `$${params.length + i + 1}`).join(', ');
              conditions.push(`ct.normalized IN (${placeholders})`);
              params.push(...normalizedValues);
            }
          }
        }
      }
    } else if (contract.requires_join) {
      // Filtros que requieren join con interactive_resources
      if (field === 'has_video' && condition.eq === true) {
        conditions.push(`EXISTS (SELECT 1 FROM interactive_resources ir2 WHERE ir2.origin->>'sot' = 'tecnicas-limpieza' AND ir2.origin->>'entity_id' = t.id::TEXT AND ir2.resource_type = 'video' AND ir2.status = 'active')`);
      } else if (field === 'has_audio' && condition.eq === true) {
        conditions.push(`EXISTS (SELECT 1 FROM interactive_resources ir2 WHERE ir2.origin->>'sot' = 'tecnicas-limpieza' AND ir2.origin->>'entity_id' = t.id::TEXT AND ir2.resource_type = 'audio' AND ir2.status = 'active')`);
      } else if (field === 'has_image' && condition.eq === true) {
        conditions.push(`EXISTS (SELECT 1 FROM interactive_resources ir2 WHERE ir2.origin->>'sot' = 'tecnicas-limpieza' AND ir2.origin->>'entity_id' = t.id::TEXT AND ir2.resource_type = 'image' AND ir2.status = 'active')`);
      }
    } else {
      // Filtros directos - USAR NOMBRE DE COLUMNA REAL
      const columnName = getColumnName(field);
      
      if (typeof condition === 'object' && !Array.isArray(condition)) {
        for (const [operator, value] of Object.entries(condition)) {
          if (operator === 'eq') {
            conditions.push(`t.${columnName} = $${params.length + 1}`);
            params.push(value);
          } else if (operator === 'lte') {
            conditions.push(`t.${columnName} <= $${params.length + 1}`);
            params.push(value);
          } else if (operator === 'gte') {
            conditions.push(`t.${columnName} >= $${params.length + 1}`);
            params.push(value);
          } else if (operator === 'contains') {
            conditions.push(`t.${columnName} ILIKE $${params.length + 1}`); // ILIKE para case-insensitive
            params.push(`%${value}%`);
          } else if (operator === 'startsWith') {
            conditions.push(`t.${columnName} ILIKE $${params.length + 1}`);
            params.push(`${value}%`);
          } else if (operator === 'in') {
            const placeholders = Array.isArray(value) ? value.map((_, i) => `$${params.length + i + 1}`).join(', ') : `$${params.length + 1}`;
            conditions.push(`t.${columnName} IN (${placeholders})`);
            if (Array.isArray(value)) {
              params.push(...value);
            } else {
              params.push(value);
            }
          }
        }
      } else {
        // Valor directo (asumir eq)
        conditions.push(`t.${columnName} = $${params.length + 1}`);
        params.push(condition);
      }
    }
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  // Si hay filtro de clasificación, agrupar para evitar duplicados
  if (needsClassificationJoin) {
    sql += ' GROUP BY t.id';
  }
  
  // Ordenamiento - USAR NOMBRE DE COLUMNA REAL
  if (orderBy && FILTER_CONTRACT[orderBy]) {
    const orderColumn = getColumnName(orderBy);
    sql += ` ORDER BY t.${orderColumn} ${orderDir === 'DESC' ? 'DESC' : 'ASC'}`;
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
  
  // Log estructurado de query generada (solo en desarrollo o debug)
  if (process.env.NODE_ENV === 'development' && conditions.length > 0) {
    console.log('[TECNICAS][QUERY] SQL generada (primeros 200 chars):', sql.substring(0, 200) + (sql.length > 200 ? '...' : ''));
    console.log('[TECNICAS][QUERY] Número de parámetros:', params.length);
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
    const validationErrors = validateFilters(filters);
    if (validationErrors.length > 0) {
      logError('TECNICAS_LIMPIEZA_QUERY', 'Errores de validación en filtros', {
        filters,
        errors: validationErrors
      });
      throw new Error(`Errores de validación en filtros: ${validationErrors.join('; ')}`);
    }
    
    // Añadir filtro de status='active' por defecto si onlyActive=true
    if (options.onlyActive !== false) {
      if (!filters.status) {
        filters.status = { eq: 'active' };
      } else if (filters.status.eq && filters.status.eq !== 'active') {
        // Si explícitamente se pide archived, respetar
      }
    }
    
    // Construir query
    const { sql, params } = await buildQueryFromFilters(filters, options);
    
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
    
    // Log estructurado de resultados (solo cantidad, no datos completos)
    console.log('[TECNICAS][QUERY] Técnicas encontradas:', tecnicas.length, 'filtros aplicados:', Object.keys(filters).length);
    
    return tecnicas;
  } catch (error) {
    logError('TECNICAS_LIMPIEZA_QUERY', 'Error en listForConsumption', {
      filters,
      options,
      error: error.message,
      stack: error.stack
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
    status: tecnicaData.status || 'active',
    video_resource_id: tecnicaData.video_resource_id || null,
    audio_resource_id: tecnicaData.audio_resource_id || null,
    image_resource_id: tecnicaData.image_resource_id || null,
    metadata: tecnicaData.metadata || {}
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
  if (patch.estimated_duration !== undefined) {
    normalizedPatch.estimated_duration = patch.estimated_duration ? parseInt(patch.estimated_duration, 10) : null;
  }
  if (patch.video_resource_id !== undefined) {
    normalizedPatch.video_resource_id = patch.video_resource_id || null;
  }
  if (patch.audio_resource_id !== undefined) {
    normalizedPatch.audio_resource_id = patch.audio_resource_id || null;
  }
  if (patch.image_resource_id !== undefined) {
    normalizedPatch.image_resource_id = patch.image_resource_id || null;
  }
  if (patch.metadata !== undefined) {
    normalizedPatch.metadata = patch.metadata || {};
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

/**
 * Obtiene las clasificaciones de una técnica
 */
export async function getClasificacionesTecnica(tecnicaId) {
  if (!tecnicaId) {
    throw new Error('tecnicaId es requerido');
  }
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.getClasificaciones(tecnicaId);
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error obteniendo clasificaciones', {
      tecnicaId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Establece las clasificaciones de una técnica (reemplaza todas)
 */
export async function setClasificacionesTecnica(tecnicaId, clasificaciones) {
  if (!tecnicaId) {
    throw new Error('tecnicaId es requerido');
  }
  if (!Array.isArray(clasificaciones)) {
    throw new Error('clasificaciones debe ser un array');
  }
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.setClasificaciones(tecnicaId, clasificaciones);
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error estableciendo clasificaciones', {
      tecnicaId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Lista todas las clasificaciones disponibles
 */
export async function listClasificacionesDisponibles() {
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.listClasificacionesDisponibles();
  } catch (error) {
    logError('TecnicasLimpiezaService', 'Error listando clasificaciones', {
      error: error.message
    });
    throw error;
  }
}

