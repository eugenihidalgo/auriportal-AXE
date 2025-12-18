// src/core/pde/catalogs/sponsors-resolver.js
// Resolver determinista para catálogo de Apadrinados v1
//
// FUENTE: Tabla transmutaciones_apadrinados (PostgreSQL)
// ADMIN: /admin/apadrinados
//
// DIFERENCIA CLAVE:
// Los Apadrinados siempre tienen un alumno_id (padrino) asignado.
// Son relaciones energéticas personales, no elementos globales.
//
// NOTA: Este catálogo aún NO se usa en el flujo de limpieza runtime.
// Está formalizado para uso futuro donde un recorrido pueda decir:
// "armoniza este apadrinado"
//
// PRINCIPIOS:
// - Determinista: mismos inputs → mismos outputs
// - Filtrable por nivel, estado, prioridad
// - Fail-open: errores devuelven bundle vacío
// - NO modifica datos, solo lee

import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getNivelEfectivo, getAlumnoId } from '../nivel-helper.js';

const DOMAIN = 'SponsorsResolver';

/**
 * Bundle vacío para fail-open
 */
export const EMPTY_SPONSOR_BUNDLE = {
  catalog_id: 'sponsors',
  version: '1.0.0',
  items: [],
  meta: {
    resolved_at: null,
    student_level: null,
    total_available: 0,
    items_selected: 0,
    reason: 'empty_bundle'
  }
};

/**
 * Crea un bundle vacío con razón específica
 */
function createEmptyBundle(reason, extraMeta = {}) {
  return {
    ...EMPTY_SPONSOR_BUNDLE,
    meta: {
      ...EMPTY_SPONSOR_BUNDLE.meta,
      resolved_at: new Date().toISOString(),
      reason,
      ...extraMeta
    }
  };
}

/**
 * Resuelve un bundle de apadrinados para un estudiante
 * 
 * @param {Object} studentCtx - Contexto del estudiante
 * @param {Object} options - Opciones de filtrado
 * @param {number} options.alumno_id - ID del padrino (requerido para apadrinados personales)
 * @param {boolean} options.include_estado - Incluir estado de limpieza (default: true)
 * @param {string} options.filter_estado - Filtrar por estado (pendiente/limpio/olvidado)
 * @param {string} options.prioridad - Filtrar por prioridad (Alta/Normal/Baja)
 * @returns {Promise<Object>} Bundle de apadrinados
 */
export async function resolveSponsorBundle(studentCtx, options = {}) {
  const resolvedAt = new Date().toISOString();
  
  try {
    // 1. Extraer nivel_efectivo y alumno_id usando helpers centralizados
    const studentLevel = getNivelEfectivo(studentCtx);
    const alumnoId = options.alumno_id || getAlumnoId(studentCtx);
    
    // Para apadrinados, alumno_id es importante ya que son personales
    if (!alumnoId) {
      logWarn(DOMAIN, 'No se proporcionó alumno_id para resolver apadrinados');
      return createEmptyBundle('missing_alumno_id', { student_level: studentLevel });
    }
    
    logInfo(DOMAIN, 'Resolviendo bundle de apadrinados', {
      student_level: studentLevel,
      alumno_id: alumnoId,
      filter_estado: options.filter_estado,
      prioridad: options.prioridad
    }, true);
    
    // 2. Importar servicio dinámicamente
    const { getApadrinadosAlumno } = await import('../../../services/transmutaciones-apadrinados.js');
    
    // 3. Obtener apadrinados del alumno
    const apadrinados = await getApadrinadosAlumno(alumnoId);
    
    if (!apadrinados || !Array.isArray(apadrinados)) {
      logWarn(DOMAIN, 'No se pudieron obtener apadrinados');
      return createEmptyBundle('no_data', { 
        student_level: studentLevel,
        alumno_id: alumnoId
      });
    }
    
    // 4. Aplicar filtros
    let filtered = apadrinados;
    
    // Filtrar por nivel
    filtered = filtered.filter(a => (a.nivel_minimo || 1) <= studentLevel);
    
    // Filtrar por prioridad
    if (options.prioridad) {
      filtered = filtered.filter(a => a.prioridad === options.prioridad);
    }
    
    // Filtrar por estado (calculado)
    if (options.filter_estado) {
      filtered = filtered.filter(a => {
        const estado = calcularEstado(a);
        return estado === options.filter_estado;
      });
    }
    
    // 5. Ordenar
    filtered.sort((a, b) => {
      if ((a.nivel_minimo || 1) !== (b.nivel_minimo || 1)) {
        return (a.nivel_minimo || 1) - (b.nivel_minimo || 1);
      }
      if ((a.orden || 0) !== (b.orden || 0)) {
        return (a.orden || 0) - (b.orden || 0);
      }
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
    
    // 6. Construir items
    const includeEstado = options.include_estado !== false;
    
    const items = filtered.map(item => {
      const baseItem = {
        id: item.id,
        nombre: item.nombre,
        descripcion: item.descripcion,
        nivel_minimo: item.nivel_minimo || 1,
        frecuencia_dias: item.frecuencia_dias, // Puede ser null para apadrinados
        prioridad: item.prioridad || 'Normal',
        orden: item.orden || 0,
        activo: item.activo,
        alumno_id: item.alumno_id, // El padrino
        // Apadrinados son siempre personales
        es_personal: true
      };
      
      // Incluir estado si se solicita
      if (includeEstado) {
        baseItem.ultima_limpieza = item.ultima_limpieza;
        baseItem.veces_limpiado = item.veces_limpiado || 0;
        baseItem.estado = calcularEstado(item);
        baseItem.dias_desde_limpieza = item.dias_desde_limpieza;
      }
      
      return baseItem;
    });
    
    // 7. Construir bundle
    const bundle = {
      catalog_id: 'sponsors',
      version: '1.0.0',
      items,
      meta: {
        resolved_at: resolvedAt,
        student_level: studentLevel,
        alumno_id: alumnoId,
        total_available: apadrinados.length,
        items_selected: items.length,
        filter_estado: options.filter_estado,
        prioridad_filter: options.prioridad,
        include_estado: includeEstado
      }
    };
    
    logInfo(DOMAIN, 'Bundle de apadrinados resuelto', {
      student_level: studentLevel,
      items_count: bundle.items.length,
      alumno_id: alumnoId
    });
    
    return bundle;
    
  } catch (error) {
    logError(DOMAIN, 'Error resolviendo bundle de apadrinados', {
      error: error.message,
      stack: error.stack
    });
    
    return createEmptyBundle('error', { error: error.message });
  }
}

/**
 * Calcula el estado de un apadrinado
 */
function calcularEstado(apadrinado) {
  if (!apadrinado.ultima_limpieza) return 'pendiente';
  
  const diasDesde = apadrinado.dias_desde_limpieza 
    || Math.floor((Date.now() - new Date(apadrinado.ultima_limpieza).getTime()) / (1000 * 60 * 60 * 24));
  
  // Si no tiene frecuencia definida, usar 30 días por defecto
  const frecuencia = apadrinado.frecuencia_dias || 30;
  
  if (diasDesde <= frecuencia) return 'limpio';
  if (diasDesde <= frecuencia + 15) return 'pendiente';
  return 'olvidado';
}

export default {
  resolveSponsorBundle,
  EMPTY_SPONSOR_BUNDLE
};

