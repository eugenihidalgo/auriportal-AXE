// src/core/progress-ux-builder.js
// Builder de experiencia UX derivado de nivelInfo
//
// PRINCIPIO: Capa UX pura, sin lógica de progreso.
// Solo derivación y formateo de datos del motor.
//
// RESTRICCIONES:
// - NO recalcula nivel/fase (usa nivelInfo del motor)
// - NO tiene side-effects
// - NO muta nivelInfo
// - FAIL-OPEN: siempre devuelve estructura válida

import progressUXConfig from './config/progress-ux.config.js';
import { logWarn } from './observability/logger.js';

/**
 * Construye la experiencia UX de progreso a partir de nivelInfo
 * 
 * @param {Object} nivelInfo - Objeto nivelInfo del motor (debe tener nivel_efectivo, fase_efectiva, nivel_base)
 * @param {Object} [opts] - Opciones opcionales (reservado para futuras extensiones)
 * @returns {Object} nivelInfoUX - Objeto listo para UI
 * 
 * @typedef {Object} NivelInfoUX
 * @property {Object} nivel - Información del nivel
 * @property {number} nivel.actual - Nivel efectivo (number)
 * @property {string} nivel.nombre - Nombre formateado del nivel
 * @property {string} [nivel.descripcion] - Descripción opcional del nivel
 * @property {Object} fase - Información de la fase
 * @property {string} fase.id - ID de la fase
 * @property {string} fase.nombre - Nombre de la fase
 * @property {string} [fase.descripcion] - Descripción opcional de la fase
 * @property {string} [fase.reason] - Razón de la fase (opcional, para debug)
 * @property {Object} estado - Estado del progreso
 * @property {string} estado.mensaje_corto - Mensaje corto para UI
 * @property {string} [estado.mensaje_largo] - Mensaje largo opcional
 */
export function buildProgressUX(nivelInfo, opts = {}) {
  // Fail-open: validar entrada
  if (!nivelInfo) {
    logWarn('progress_ux_builder', 'nivelInfo es null/undefined', {}, true);
    return getDefaultNivelInfoUX();
  }

  try {
    // 1. Extraer nivel_efectivo (con fallback seguro)
    const nivelEfectivo = typeof nivelInfo.nivel_efectivo === 'number' 
      ? nivelInfo.nivel_efectivo 
      : (typeof nivelInfo.nivel === 'number' ? nivelInfo.nivel : 0);
    
    // 2. Extraer fase_efectiva (debe ser objeto {id, nombre, reason?})
    let faseEfectiva;
    if (nivelInfo.fase_efectiva && typeof nivelInfo.fase_efectiva === 'object') {
      faseEfectiva = nivelInfo.fase_efectiva;
    } else {
      // Fallback: intentar construir desde datos legacy
      logWarn('progress_ux_builder', 'fase_efectiva no es objeto válido', {
        tipo: typeof nivelInfo.fase_efectiva,
        tiene_fase: !!nivelInfo.fase
      });
      faseEfectiva = {
        id: 'unknown',
        nombre: nivelInfo.fase || 'Fase no disponible',
        reason: 'missing_phase_object'
      };
    }

    // Validar que fase_efectiva tenga id y nombre
    if (!faseEfectiva.id || !faseEfectiva.nombre) {
      logWarn('progress_ux_builder', 'fase_efectiva incompleta', {
        tiene_id: !!faseEfectiva.id,
        tiene_nombre: !!faseEfectiva.nombre
      });
      faseEfectiva = {
        id: 'unknown',
        nombre: 'Fase no disponible',
        reason: 'incomplete_phase'
      };
    }

    // 3. Construir nivel.actual
    const nivelActual = nivelEfectivo > 0 ? nivelEfectivo : 0;

    // 4. Construir nivel.nombre
    const nivelNombrePrefix = progressUXConfig.default?.nivel_nombre_prefix || 'Nivel';
    const nivelNombre = nivelActual > 0 
      ? `${nivelNombrePrefix} ${nivelActual}`
      : nivelNombrePrefix;

    // 5. Construir nivel.descripcion (opcional, desde config)
    const nivelDescripcion = progressUXConfig.niveles?.[String(nivelActual)]?.descripcion;

    // 6. Construir fase (copiar id, nombre, reason desde fase_efectiva)
    const fase = {
      id: faseEfectiva.id,
      nombre: faseEfectiva.nombre,
      ...(faseEfectiva.reason && { reason: faseEfectiva.reason })
    };

    // 7. Añadir fase.descripcion si existe en config
    const faseDescripcion = progressUXConfig.fases?.[fase.id]?.descripcion;
    if (faseDescripcion) {
      fase.descripcion = faseDescripcion;
    }

    // 8. Construir estado.mensaje_corto (prioridad: fase > default)
    const mensajeCortoFase = progressUXConfig.fases?.[fase.id]?.mensaje_corto;
    const mensajeCorto = mensajeCortoFase 
      || progressUXConfig.default?.mensaje_corto 
      || 'Sigues avanzando';

    // 9. Construir estado.mensaje_largo (opcional, prioridad: fase > default)
    const mensajeLargoFase = progressUXConfig.fases?.[fase.id]?.mensaje_largo;
    const mensajeLargo = mensajeLargoFase 
      || progressUXConfig.default?.mensaje_largo 
      || undefined; // Opcional, puede omitirse

    // 10. Construir nivelInfoUX
    const nivelInfoUX = {
      nivel: {
        actual: nivelActual,
        nombre: nivelNombre,
        ...(nivelDescripcion && { descripcion: nivelDescripcion })
      },
      fase: fase,
      estado: {
        mensaje_corto: mensajeCorto,
        ...(mensajeLargo && { mensaje_largo: mensajeLargo })
      }
    };

    return nivelInfoUX;

  } catch (error) {
    // Fail-open: si algo falla, devolver estructura válida con defaults
    logWarn('progress_ux_builder', 'Error construyendo nivelInfoUX', {
      error: error.message,
      nivelInfo_keys: Object.keys(nivelInfo || {})
    }, true);
    return getDefaultNivelInfoUX();
  }
}

/**
 * Devuelve nivelInfoUX por defecto (fallback seguro)
 * @private
 */
function getDefaultNivelInfoUX() {
  const defaultConfig = progressUXConfig.default || {};
  
  return {
    nivel: {
      actual: 0,
      nombre: defaultConfig.nivel_nombre_prefix || 'Nivel'
    },
    fase: {
      id: 'unknown',
      nombre: 'Fase no disponible',
      reason: 'missing_phase'
    },
    estado: {
      mensaje_corto: defaultConfig.mensaje_corto || 'Sigues avanzando',
      ...(defaultConfig.mensaje_largo && { mensaje_largo: defaultConfig.mensaje_largo })
    }
  };
}









