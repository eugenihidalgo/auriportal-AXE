// src/services/tecnicas-limpieza-filter-parser.js
// Parser canónico de filtros para Técnicas de Limpieza
//
// Responsabilidades:
// - Parsear query params a formato interno
// - Validar contra FILTER_CONTRACT
// - Normalizar valores
// - Retornar errores claros

import { FILTER_CONTRACT } from './tecnicas-limpieza-service.js';
import { logError } from '../core/observability/logger.js';

/**
 * Parsea query params de URL a objeto de filtros validado
 * 
 * @param {URLSearchParams} searchParams - Query params de la URL
 * @returns {Object} { filters: Object, errors: Array<string> }
 */
export function parseTecnicasLimpiezaFilters(searchParams) {
  const filters = {};
  const errors = [];
  
  // nivel: lte:valor, gte:valor, eq:valor, o solo valor (eq por defecto)
  const nivelParam = searchParams.get('nivel');
  if (nivelParam !== null && nivelParam !== '') {
    try {
      if (nivelParam.startsWith('lte:')) {
        const value = parseInt(nivelParam.slice(4), 10);
        if (!isNaN(value) && value > 0) {
          filters.nivel = { lte: value };
        } else {
          errors.push("Valor inválido para filtro 'nivel' con operador 'lte'");
        }
      } else if (nivelParam.startsWith('gte:')) {
        const value = parseInt(nivelParam.slice(4), 10);
        if (!isNaN(value) && value > 0) {
          filters.nivel = { gte: value };
        } else {
          errors.push("Valor inválido para filtro 'nivel' con operador 'gte'");
        }
      } else if (nivelParam.startsWith('eq:')) {
        const value = parseInt(nivelParam.slice(3), 10);
        if (!isNaN(value) && value > 0) {
          filters.nivel = { eq: value };
        } else {
          errors.push("Valor inválido para filtro 'nivel' con operador 'eq'");
        }
      } else {
        // Sin prefijo, asumir 'eq'
        const value = parseInt(nivelParam, 10);
        if (!isNaN(value) && value > 0) {
          filters.nivel = { eq: value };
        } else {
          errors.push("Valor inválido para filtro 'nivel': debe ser un número positivo");
        }
      }
    } catch (error) {
      errors.push(`Error parseando filtro 'nivel': ${error.message}`);
    }
  }
  
  // nombre: contains:valor, startsWith:valor, o solo valor (contains por defecto)
  const nombreParam = searchParams.get('nombre');
  if (nombreParam !== null && nombreParam !== '') {
    try {
      const trimmed = nombreParam.trim();
      if (trimmed.length === 0) {
        // Ignorar si está vacío
      } else if (nombreParam.startsWith('contains:')) {
        filters.nombre = { contains: nombreParam.slice(9).trim() };
      } else if (nombreParam.startsWith('startsWith:')) {
        filters.nombre = { startsWith: nombreParam.slice(11).trim() };
      } else {
        // Sin prefijo, asumir 'contains'
        filters.nombre = { contains: trimmed };
      }
    } catch (error) {
      errors.push(`Error parseando filtro 'nombre': ${error.message}`);
    }
  }
  
  // clasificacion: eq:valor (SOLO string, NO arrays, NO in:)
  const clasificacionParam = searchParams.get('clasificacion');
  if (clasificacionParam !== null && clasificacionParam !== '') {
    try {
      const trimmed = clasificacionParam.trim();
      if (trimmed.length === 0) {
        // Ignorar si está vacío
      } else if (clasificacionParam.startsWith('eq:')) {
        filters.clasificacion = { eq: clasificacionParam.slice(3).trim() };
      } else if (clasificacionParam.startsWith('in:')) {
        // 'in:' está permitido pero solo tomamos el primer valor
        const values = clasificacionParam.slice(3).split(',').map(v => v.trim()).filter(v => v);
        if (values.length > 0 && typeof values[0] === 'string') {
          filters.clasificacion = { eq: values[0] }; // Convertir 'in' a 'eq' con solo el primer valor
        } else {
          errors.push("Valor para filtro 'clasificacion' debe ser un string no vacío");
        }
      } else {
        // Sin prefijo, asumir 'eq' (solo un valor)
        if (trimmed && typeof trimmed === 'string') {
          filters.clasificacion = { eq: trimmed };
        } else {
          errors.push("Valor para filtro 'clasificacion' debe ser un string no vacío");
        }
      }
    } catch (error) {
      errors.push(`Error parseando filtro 'clasificacion': ${error.message}`);
    }
  }
  
  // status: eq:active o eq:archived
  const statusParam = searchParams.get('status');
  if (statusParam !== null && statusParam !== '') {
    try {
      const trimmed = statusParam.trim();
      if (trimmed === 'active' || trimmed === 'archived') {
        filters.status = { eq: trimmed };
      } else if (statusParam.startsWith('eq:')) {
        const value = statusParam.slice(3).trim();
        if (value === 'active' || value === 'archived') {
          filters.status = { eq: value };
        } else {
          errors.push(`Valor inválido para filtro 'status': debe ser 'active' o 'archived'`);
        }
      } else {
        errors.push(`Valor inválido para filtro 'status': debe ser 'active' o 'archived'`);
      }
    } catch (error) {
      errors.push(`Error parseando filtro 'status': ${error.message}`);
    }
  }
  
  // Validar filtros contra FILTER_CONTRACT
  for (const [field, condition] of Object.entries(filters)) {
    const contract = FILTER_CONTRACT[field];
    
    if (!contract) {
      errors.push(`Campo '${field}' no es filtrable. Campos disponibles: ${Object.keys(FILTER_CONTRACT).join(', ')}`);
      delete filters[field];
      continue;
    }
    
    // Validar operadores
    if (typeof condition === 'object' && !Array.isArray(condition)) {
      for (const operator of Object.keys(condition)) {
        if (!contract.operators.includes(operator)) {
          errors.push(`Operador '${operator}' no permitido para campo '${field}'. Operadores permitidos: ${contract.operators.join(', ')}`);
          delete filters[field];
          break;
        }
      }
    }
  }
  
  return { filters, errors };
}

