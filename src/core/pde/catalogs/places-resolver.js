// src/core/pde/catalogs/places-resolver.js
// Resolver determinista para catálogo de Lugares Activados v1
//
// FUENTE: Tabla transmutaciones_lugares (PostgreSQL)
// ADMIN: /admin/transmutaciones-lugares
//
// NOTA: Este catálogo aún NO se usa en el flujo de limpieza runtime.
// Está formalizado para uso futuro donde un recorrido pueda decir:
// "limpia este lugar" o "trabaja este lugar activado"
//
// PRINCIPIOS:
// - Determinista: mismos inputs → mismos outputs
// - Filtrable por nivel, estado, prioridad
// - Fail-open: errores devuelven bundle vacío
// - NO modifica datos, solo lee

import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getNivelEfectivo, getAlumnoId } from '../nivel-helper.js';

const DOMAIN = 'PlacesResolver';

/**
 * Bundle vacío para fail-open
 */
export const EMPTY_PLACE_BUNDLE = {
  catalog_id: 'places',
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
    ...EMPTY_PLACE_BUNDLE,
    meta: {
      ...EMPTY_PLACE_BUNDLE.meta,
      resolved_at: new Date().toISOString(),
      reason,
      ...extraMeta
    }
  };
}

/**
 * Resuelve un bundle de lugares para un estudiante
 * 
 * @param {Object} studentCtx - Contexto del estudiante
 * @param {Object} options - Opciones de filtrado
 * @param {number} options.alumno_id - ID del alumno para estado personalizado
 * @param {boolean} options.include_global - Incluir lugares globales (default: true)
 * @param {boolean} options.include_personal - Incluir lugares personales (default: true)
 * @param {string} options.filter_estado - Filtrar por estado (pendiente/limpio/olvidado)
 * @param {string} options.prioridad - Filtrar por prioridad (Alta/Normal/Baja)
 * @returns {Promise<Object>} Bundle de lugares
 */
export async function resolvePlaceBundle(studentCtx, options = {}) {
  const resolvedAt = new Date().toISOString();
  
  try {
    // 1. Extraer nivel_efectivo y alumno_id usando helpers centralizados
    const studentLevel = getNivelEfectivo(studentCtx);
    const alumnoId = options.alumno_id || getAlumnoId(studentCtx);
    
    logInfo(DOMAIN, 'Resolviendo bundle de lugares', {
      student_level: studentLevel,
      alumno_id: alumnoId,
      filter_estado: options.filter_estado,
      prioridad: options.prioridad
    }, true);
    
    // 2. Importar servicio dinámicamente
    const { getLugaresAlumno, listarLugaresGlobales } = await import('../../../services/transmutaciones-lugares.js');
    
    let lugares = [];
    
    // 3. Obtener lugares según alumno_id
    if (alumnoId) {
      lugares = await getLugaresAlumno(alumnoId);
    } else {
      // Si no hay alumno_id, obtener solo globales
      const globales = await listarLugaresGlobales();
      lugares = globales.filter(l => !l.alumno_id);
    }
    
    if (!lugares || !Array.isArray(lugares)) {
      logWarn(DOMAIN, 'No se pudieron obtener lugares');
      return createEmptyBundle('no_data', { student_level: studentLevel });
    }
    
    // 4. Aplicar filtros
    let filtered = lugares;
    
    // Filtrar por nivel
    filtered = filtered.filter(l => (l.nivel_minimo || 1) <= studentLevel);
    
    // Filtrar por prioridad
    if (options.prioridad) {
      filtered = filtered.filter(l => l.prioridad === options.prioridad);
    }
    
    // Filtrar por estado (calculado)
    if (options.filter_estado) {
      filtered = filtered.filter(l => {
        const estado = calcularEstado(l);
        return estado === options.filter_estado;
      });
    }
    
    // Filtrar globales vs personales
    const includeGlobal = options.include_global !== false;
    const includePersonal = options.include_personal !== false;
    
    if (!includeGlobal || !includePersonal) {
      filtered = filtered.filter(l => {
        const esPersonal = l.alumno_id !== null && l.alumno_id !== undefined;
        if (esPersonal && !includePersonal) return false;
        if (!esPersonal && !includeGlobal) return false;
        return true;
      });
    }
    
    // 5. Ordenar
    filtered.sort((a, b) => {
      // Primero por nivel
      if ((a.nivel_minimo || 1) !== (b.nivel_minimo || 1)) {
        return (a.nivel_minimo || 1) - (b.nivel_minimo || 1);
      }
      // Luego por orden
      if ((a.orden || 0) !== (b.orden || 0)) {
        return (a.orden || 0) - (b.orden || 0);
      }
      // Finalmente por nombre
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
    
    // 6. Construir items
    const items = filtered.map(item => ({
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion,
      nivel_minimo: item.nivel_minimo || 1,
      frecuencia_dias: item.frecuencia_dias || 30,
      prioridad: item.prioridad || 'Normal',
      orden: item.orden || 0,
      activo: item.activo,
      alumno_id: item.alumno_id,
      es_personal: item.alumno_id !== null && item.alumno_id !== undefined,
      // Estado de limpieza (si está disponible)
      ultima_limpieza: item.ultima_limpieza,
      veces_limpiado: item.veces_limpiado || 0,
      estado: calcularEstado(item),
      dias_desde_limpieza: item.dias_desde_limpieza
    }));
    
    // 7. Construir bundle
    const bundle = {
      catalog_id: 'places',
      version: '1.0.0',
      items,
      meta: {
        resolved_at: resolvedAt,
        student_level: studentLevel,
        alumno_id: alumnoId,
        total_available: lugares.length,
        items_selected: items.length,
        filter_estado: options.filter_estado,
        prioridad_filter: options.prioridad,
        include_global: includeGlobal,
        include_personal: includePersonal
      }
    };
    
    logInfo(DOMAIN, 'Bundle de lugares resuelto', {
      student_level: studentLevel,
      items_count: bundle.items.length,
      alumno_id: alumnoId
    });
    
    return bundle;
    
  } catch (error) {
    logError(DOMAIN, 'Error resolviendo bundle de lugares', {
      error: error.message,
      stack: error.stack
    });
    
    return createEmptyBundle('error', { error: error.message });
  }
}

/**
 * Calcula el estado de limpieza de un lugar
 */
function calcularEstado(lugar) {
  if (!lugar.ultima_limpieza) return 'pendiente';
  
  const diasDesde = lugar.dias_desde_limpieza 
    || Math.floor((Date.now() - new Date(lugar.ultima_limpieza).getTime()) / (1000 * 60 * 60 * 24));
  
  const frecuencia = lugar.frecuencia_dias || 30;
  
  if (diasDesde <= frecuencia) return 'limpio';
  if (diasDesde <= frecuencia + 15) return 'pendiente';
  return 'olvidado';
}

export default {
  resolvePlaceBundle,
  EMPTY_PLACE_BUNDLE
};

