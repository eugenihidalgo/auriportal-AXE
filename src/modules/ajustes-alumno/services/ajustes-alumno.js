// src/modules/ajustes-alumno/services/ajustes-alumno.js
// Servicio para ajustes personales del alumno

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Obtiene ajustes de un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object>}
 */
export async function getAjustesAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT ajustes FROM alumnos WHERE id = $1
    `, [alumnoId]);

    if (result.rows.length === 0) {
      return getAjustesPorDefecto();
    }

    const ajustes = result.rows[0].ajustes;
    return ajustes && typeof ajustes === 'object' ? ajustes : getAjustesPorDefecto();
  } catch (error) {
    console.error('Error obteniendo ajustes:', error);
    return getAjustesPorDefecto();
  }
}

/**
 * Actualiza ajustes de un alumno
 * @param {number} alumnoId 
 * @param {Object} nuevosAjustes 
 * @returns {Promise<boolean>}
 */
export async function actualizarAjustesAlumno(alumnoId, nuevosAjustes) {
  try {
    const ajustesActuales = await getAjustesAlumno(alumnoId);
    const ajustesCombinados = { ...ajustesActuales, ...nuevosAjustes };

    await query(`
      UPDATE alumnos
      SET ajustes = $1
      WHERE id = $2
    `, [JSON.stringify(ajustesCombinados), alumnoId]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'ajustes_actualizados',
      metadata: { ajustes: nuevosAjustes }
    });

    return true;
  } catch (error) {
    console.error('Error actualizando ajustes:', error);
    return false;
  }
}

/**
 * Ajustes por defecto
 * @returns {Object}
 */
function getAjustesPorDefecto() {
  return {
    altar: {
      activo: true
    },
    tarot: {
      activo: true
    },
    maestro_interior: {
      activo: true
    },
    sorpresas: {
      activo: true
    },
    misiones: {
      activo: true
    },
    notificaciones: {
      email_informe_semanal: true,
      email_recordatorios: true,
      email_sorpresas: false,
      email_circulos: true
    },
    privacidad: {
      mostrar_en_sinergias: true,
      mostrar_en_amistades: true
    }
  };
}

/**
 * Verifica si un módulo está activo para el alumno
 * @param {number} alumnoId 
 * @param {string} modulo - 'altar', 'tarot', 'maestro_interior', etc.
 * @returns {Promise<boolean>}
 */
export async function isModuloActivoParaAlumno(alumnoId, modulo) {
  try {
    const ajustes = await getAjustesAlumno(alumnoId);
    const path = modulo.split('.'); // Ej: 'altar.activo'
    
    let valor = ajustes;
    for (const key of path) {
      valor = valor?.[key];
    }
    
    return valor === true;
  } catch (error) {
    console.error('Error verificando módulo activo:', error);
    return true; // Por defecto activo
  }
}



