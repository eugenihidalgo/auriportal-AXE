// src/services/tecnicas-limpieza-clasificaciones-service.js
// Service Layer para Clasificaciones de Técnicas de Limpieza
//
// Responsabilidades:
// - Lógica de negocio para clasificaciones
// - Validación y normalización
// - Abstracción de repositorio
// - NO lógica de UI
// - Preparado para consumo por Packages

import { getTecnicasLimpiezaRepo } from '../infra/repos/tecnicas-limpieza-repo-pg.js';
import { logError } from '../core/observability/logger.js';

/**
 * Lista todas las clasificaciones disponibles
 */
export async function listDisponibles() {
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.listClasificacionesDisponibles();
  } catch (error) {
    logError('TecnicasLimpiezaClasificacionesService', 'Error listando clasificaciones disponibles', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Obtiene las clasificaciones de una técnica
 */
export async function getForTecnica(tecnicaId) {
  if (!tecnicaId) {
    throw new Error('tecnicaId es requerido');
  }
  
  // Validar que tecnicaId sea un integer válido
  const id = parseInt(tecnicaId, 10);
  if (isNaN(id) || id <= 0) {
    throw new Error('tecnicaId debe ser un integer positivo válido');
  }
  
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.getClasificaciones(id);
  } catch (error) {
    logError('TecnicasLimpiezaClasificacionesService', 'Error obteniendo clasificaciones de técnica', {
      tecnicaId: id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Establece las clasificaciones de una técnica (reemplaza todas)
 */
export async function setForTecnica(tecnicaId, clasificaciones) {
  if (!tecnicaId) {
    throw new Error('tecnicaId es requerido');
  }
  
  // Validar que tecnicaId sea un integer válido
  const id = parseInt(tecnicaId, 10);
  if (isNaN(id) || id <= 0) {
    throw new Error('tecnicaId debe ser un integer positivo válido');
  }
  
  if (!Array.isArray(clasificaciones)) {
    throw new Error('clasificaciones debe ser un array');
  }
  
  // Validar que todas las clasificaciones sean strings no vacíos
  const clasificacionesValidas = clasificaciones
    .map(c => typeof c === 'string' ? c.trim() : String(c).trim())
    .filter(c => c.length > 0);
  
  try {
    const repo = getTecnicasLimpiezaRepo();
    return await repo.setClasificaciones(id, clasificacionesValidas);
  } catch (error) {
    logError('TecnicasLimpiezaClasificacionesService', 'Error estableciendo clasificaciones de técnica', {
      tecnicaId: id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Crea una clasificación si no existe (idempotente)
 * 
 * Esta función crea el término en pde_classification_terms si no existe,
 * usando la función ensure_classification_term de PostgreSQL.
 * 
 * @param {string} key - Clave/nombre de la clasificación
 * @param {string} [label] - Etiqueta opcional (por defecto igual a key)
 * @returns {Promise<Object>} Clasificación creada o existente {id, value, normalized}
 */
export async function addIfNotExists(key, label = null) {
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw new Error('key es requerido y debe ser un string no vacío');
  }
  
  const trimmedKey = key.trim();
  const trimmedLabel = label ? label.trim() : trimmedKey;
  
  try {
    // Usar directamente ensure_classification_term de PostgreSQL
    const { query } = await import('../../database/pg.js');
    const result = await query(
      'SELECT ensure_classification_term($1, $2) as term_id',
      ['tag', trimmedKey]
    );
    
    const termId = result.rows[0].term_id;
    
    // Obtener información del término
    const termInfo = await query(
      'SELECT id, value, normalized FROM pde_classification_terms WHERE id = $1',
      [termId]
    );
    
    if (termInfo.rows.length > 0) {
      return {
        id: termInfo.rows[0].id,
        value: termInfo.rows[0].value,
        normalized: termInfo.rows[0].normalized
      };
    }
    
    // Si no se encontró (no debería pasar), retornar datos básicos
    return {
      id: termId,
      value: trimmedKey,
      normalized: trimmedKey.toLowerCase()
    };
  } catch (error) {
    logError('TecnicasLimpiezaClasificacionesService', 'Error creando clasificación', {
      key: trimmedKey,
      error: error.message
    });
    throw error;
  }
}

