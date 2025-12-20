// src/core/pde/catalogs/post-practices-resolver.js
// Resolver determinista para catálogo de Técnicas Post-Práctica v1
//
// FUENTE: Tabla tecnicas_post_practica (PostgreSQL)
// ADMIN: /admin/tecnicas-post-practica
//
// PRINCIPIOS:
// - Determinista: mismos inputs → mismos outputs
// - Filtrable por nivel del alumno
// - Fail-open: errores devuelven bundle vacío
// - NO modifica datos, solo lee

import { logInfo, logWarn, logError } from '../../observability/logger.js';

const DOMAIN = 'PostPracticesResolver';

/**
 * Bundle vacío para fail-open
 */
export const EMPTY_POST_PRACTICE_BUNDLE = {
  catalog_id: 'post_practices',
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
    ...EMPTY_POST_PRACTICE_BUNDLE,
    meta: {
      ...EMPTY_POST_PRACTICE_BUNDLE.meta,
      resolved_at: new Date().toISOString(),
      reason,
      ...extraMeta
    }
  };
}

/**
 * Resuelve un bundle de técnicas post-práctica para un estudiante
 * 
 * @param {Object} studentCtx - Contexto del estudiante
 * @param {Object} options - Opciones de filtrado
 * @param {string} options.mode_id - Modo de limpieza
 * @param {string} options.context - Contexto (limpieza/general)
 * @param {boolean} options.filter_obligatorias - Solo obligatorias
 * @param {string} options.posicion - Filtrar por posición
 * @returns {Promise<Object>} Bundle de técnicas post-práctica
 */
export async function resolvePostPracticeBundle(studentCtx, options = {}) {
  const resolvedAt = new Date().toISOString();
  
  try {
    // 1. Validar contexto
    if (!studentCtx) {
      logWarn(DOMAIN, 'studentCtx no proporcionado');
      return createEmptyBundle('missing_student_context');
    }
    
    // 2. Extraer nivel del estudiante
    const studentLevel = studentCtx.nivelInfo?.nivel 
      || studentCtx.nivelInfo?.nivel_efectivo 
      || studentCtx.student?.nivel_actual 
      || 1;
    
    logInfo(DOMAIN, 'Resolviendo bundle de técnicas post-práctica', {
      student_level: studentLevel,
      mode_id: options.mode_id,
      context: options.context
    }, true);
    
    // 3. Importar servicio dinámicamente
    const { obtenerTecnicasPostPracticaPorNivel } = await import('../../../services/tecnicas-post-practica.js');
    
    // 4. Obtener técnicas por nivel
    const tecnicas = await obtenerTecnicasPostPracticaPorNivel(studentLevel);
    
    if (!tecnicas || !Array.isArray(tecnicas)) {
      logWarn(DOMAIN, 'No se pudieron obtener técnicas post-práctica');
      return createEmptyBundle('no_data', { student_level: studentLevel });
    }
    
    // 5. Aplicar filtros adicionales
    let filtered = tecnicas;
    
    // Filtrar por posición si se especifica
    if (options.posicion) {
      filtered = filtered.filter(t => t.posicion === options.posicion);
    }
    
    // Filtrar solo obligatorias si se solicita
    if (options.filter_obligatorias) {
      filtered = filtered.filter(t => {
        if (t.obligatoria_global) return true;
        if (t.obligatoria_por_nivel) {
          const porNivel = typeof t.obligatoria_por_nivel === 'string'
            ? JSON.parse(t.obligatoria_por_nivel)
            : t.obligatoria_por_nivel;
          return porNivel[studentLevel] === true;
        }
        return false;
      });
    }
    
    // 6. Ordenar
    filtered.sort((a, b) => {
      if (a.orden !== b.orden) return (a.orden || 0) - (b.orden || 0);
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
    
    // 7. Construir bundle
    const bundle = {
      catalog_id: 'post_practices',
      version: '1.0.0',
      items: filtered.map(item => ({
        id: item.id,
        nombre: item.nombre,
        descripcion: item.descripcion,
        nivel: item.nivel,
        video_url: item.video_url,
        orden: item.orden,
        activar_reloj: item.activar_reloj,
        musica_id: item.musica_id,
        tipo: item.tipo || 'consigna',
        posicion: item.posicion || 'inicio',
        obligatoria_global: item.obligatoria_global || false,
        obligatoria_por_nivel: typeof item.obligatoria_por_nivel === 'string'
          ? JSON.parse(item.obligatoria_por_nivel || '{}')
          : (item.obligatoria_por_nivel || {}),
        minutos: item.minutos,
        tiene_video: item.tiene_video || false,
        contenido_html: item.contenido_html
      })),
      meta: {
        resolved_at: resolvedAt,
        student_level: studentLevel,
        total_available: tecnicas.length,
        items_selected: filtered.length,
        mode_id: options.mode_id,
        context: options.context || 'general',
        posicion_filter: options.posicion
      }
    };
    
    logInfo(DOMAIN, 'Bundle de técnicas post-práctica resuelto', {
      student_level: studentLevel,
      items_count: bundle.items.length
    });
    
    return bundle;
    
  } catch (error) {
    logError(DOMAIN, 'Error resolviendo bundle de técnicas post-práctica', {
      error: error.message,
      stack: error.stack
    });
    
    return createEmptyBundle('error', { error: error.message });
  }
}

export default {
  resolvePostPracticeBundle,
  EMPTY_POST_PRACTICE_BUNDLE
};







