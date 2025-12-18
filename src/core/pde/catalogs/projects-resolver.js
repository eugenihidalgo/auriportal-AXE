// src/core/pde/catalogs/projects-resolver.js
// Resolver determinista para catálogo de Proyectos Activados v1
//
// FUENTE: Tabla transmutaciones_proyectos (PostgreSQL)
// ADMIN: /admin/transmutaciones-proyectos
//
// NOTA: Este catálogo aún NO se usa en el flujo de limpieza runtime.
// Está formalizado para uso futuro donde un recorrido pueda decir:
// "trabaja este proyecto activado"
//
// PRINCIPIOS:
// - Determinista: mismos inputs → mismos outputs
// - Filtrable por nivel, estado, prioridad
// - Fail-open: errores devuelven bundle vacío
// - NO modifica datos, solo lee

import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getNivelEfectivo, getAlumnoId } from '../nivel-helper.js';

const DOMAIN = 'ProjectsResolver';

/**
 * Bundle vacío para fail-open
 */
export const EMPTY_PROJECT_BUNDLE = {
  catalog_id: 'projects',
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
    ...EMPTY_PROJECT_BUNDLE,
    meta: {
      ...EMPTY_PROJECT_BUNDLE.meta,
      resolved_at: new Date().toISOString(),
      reason,
      ...extraMeta
    }
  };
}

/**
 * Resuelve un bundle de proyectos para un estudiante
 * 
 * @param {Object} studentCtx - Contexto del estudiante
 * @param {Object} options - Opciones de filtrado
 * @param {number} options.alumno_id - ID del alumno para estado personalizado
 * @param {boolean} options.include_global - Incluir proyectos globales (default: true)
 * @param {boolean} options.include_personal - Incluir proyectos personales (default: true)
 * @param {string} options.filter_estado - Filtrar por estado (pendiente/limpio/olvidado)
 * @param {string} options.prioridad - Filtrar por prioridad (Alta/Normal/Baja)
 * @returns {Promise<Object>} Bundle de proyectos
 */
export async function resolveProjectBundle(studentCtx, options = {}) {
  const resolvedAt = new Date().toISOString();
  
  try {
    // 1. Extraer nivel_efectivo y alumno_id usando helpers centralizados
    const studentLevel = getNivelEfectivo(studentCtx);
    const alumnoId = options.alumno_id || getAlumnoId(studentCtx);
    
    logInfo(DOMAIN, 'Resolviendo bundle de proyectos', {
      student_level: studentLevel,
      alumno_id: alumnoId,
      filter_estado: options.filter_estado,
      prioridad: options.prioridad
    }, true);
    
    // 2. Importar servicio dinámicamente
    const { getProyectosAlumno, listarProyectosGlobales } = await import('../../../services/transmutaciones-proyectos.js');
    
    let proyectos = [];
    
    // 3. Obtener proyectos según alumno_id
    if (alumnoId) {
      proyectos = await getProyectosAlumno(alumnoId);
    } else {
      // Si no hay alumno_id, obtener solo globales
      const globales = await listarProyectosGlobales();
      proyectos = globales.filter(p => !p.alumno_id);
    }
    
    if (!proyectos || !Array.isArray(proyectos)) {
      logWarn(DOMAIN, 'No se pudieron obtener proyectos');
      return createEmptyBundle('no_data', { student_level: studentLevel });
    }
    
    // 4. Aplicar filtros
    let filtered = proyectos;
    
    // Filtrar por nivel
    filtered = filtered.filter(p => (p.nivel_minimo || 1) <= studentLevel);
    
    // Filtrar por prioridad
    if (options.prioridad) {
      filtered = filtered.filter(p => p.prioridad === options.prioridad);
    }
    
    // Filtrar por estado (calculado)
    if (options.filter_estado) {
      filtered = filtered.filter(p => {
        const estado = calcularEstado(p);
        return estado === options.filter_estado;
      });
    }
    
    // Filtrar globales vs personales
    const includeGlobal = options.include_global !== false;
    const includePersonal = options.include_personal !== false;
    
    if (!includeGlobal || !includePersonal) {
      filtered = filtered.filter(p => {
        const esPersonal = p.alumno_id !== null && p.alumno_id !== undefined;
        if (esPersonal && !includePersonal) return false;
        if (!esPersonal && !includeGlobal) return false;
        return true;
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
      ultima_limpieza: item.ultima_limpieza,
      veces_limpiado: item.veces_limpiado || 0,
      estado: calcularEstado(item),
      dias_desde_limpieza: item.dias_desde_limpieza
    }));
    
    // 7. Construir bundle
    const bundle = {
      catalog_id: 'projects',
      version: '1.0.0',
      items,
      meta: {
        resolved_at: resolvedAt,
        student_level: studentLevel,
        alumno_id: alumnoId,
        total_available: proyectos.length,
        items_selected: items.length,
        filter_estado: options.filter_estado,
        prioridad_filter: options.prioridad,
        include_global: includeGlobal,
        include_personal: includePersonal
      }
    };
    
    logInfo(DOMAIN, 'Bundle de proyectos resuelto', {
      student_level: studentLevel,
      items_count: bundle.items.length,
      alumno_id: alumnoId
    });
    
    return bundle;
    
  } catch (error) {
    logError(DOMAIN, 'Error resolviendo bundle de proyectos', {
      error: error.message,
      stack: error.stack
    });
    
    return createEmptyBundle('error', { error: error.message });
  }
}

/**
 * Calcula el estado de un proyecto
 */
function calcularEstado(proyecto) {
  if (!proyecto.ultima_limpieza) return 'pendiente';
  
  const diasDesde = proyecto.dias_desde_limpieza 
    || Math.floor((Date.now() - new Date(proyecto.ultima_limpieza).getTime()) / (1000 * 60 * 60 * 24));
  
  const frecuencia = proyecto.frecuencia_dias || 30;
  
  if (diasDesde <= frecuencia) return 'limpio';
  if (diasDesde <= frecuencia + 15) return 'pendiente';
  return 'olvidado';
}

export default {
  resolveProjectBundle,
  EMPTY_PROJECT_BUNDLE
};

