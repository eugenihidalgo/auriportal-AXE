// src/modules/auriclock/services/auriclock.js
// Servicio para AuriClock - Ritmos del Día

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Determina la categoría del momento actual
 * @param {Date} fecha 
 * @returns {string} - 'aurora', 'zenit', 'crepusculo', 'noche'
 */
export function getCategoriaMomento(fecha = new Date()) {
  const hora = fecha.getHours();
  
  if (hora >= 5 && hora < 9) {
    return 'aurora';
  } else if (hora >= 9 && hora < 15) {
    return 'zenit';
  } else if (hora >= 15 && hora < 20) {
    return 'crepusculo';
  } else {
    return 'noche';
  }
}

/**
 * Registra un momento en AuriClock
 * @param {number} alumnoId 
 * @param {Date} fecha 
 * @param {Object} metadata 
 * @returns {Promise<boolean>}
 */
export async function registrarMomentoAuriClock(alumnoId, fecha = new Date(), metadata = {}) {
  try {
    const categoria = getCategoriaMomento(fecha);
    const hora = fecha.toTimeString().slice(0, 5); // HH:MM

    await query(`
      INSERT INTO auriclock_registro (alumno_id, hora, categoria, metadata)
      VALUES ($1, $2, $3, $4)
    `, [alumnoId, hora, categoria, JSON.stringify(metadata)]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'auriclock_registrado',
      metadata: { categoria, hora }
    });

    return true;
  } catch (error) {
    console.error('Error registrando momento AuriClock:', error);
    return false;
  }
}

/**
 * Obtiene estadísticas de ritmos del alumno
 * @param {number} alumnoId 
 * @param {number} dias 
 * @returns {Promise<Object>}
 */
export async function getEstadisticasAuriClock(alumnoId, dias = 30) {
  try {
    const result = await query(`
      SELECT 
        categoria,
        COUNT(*) as total,
        AVG(EXTRACT(HOUR FROM hora::time)) as hora_promedio
      FROM auriclock_registro
      WHERE alumno_id = $1
        AND fecha >= CURRENT_DATE - INTERVAL '${dias} days'
      GROUP BY categoria
    `, [alumnoId]);

    const estadisticas = {
      aurora: 0,
      zenit: 0,
      crepusculo: 0,
      noche: 0
    };

    result.rows.forEach(row => {
      estadisticas[row.categoria] = parseInt(row.total);
    });

    return estadisticas;
  } catch (error) {
    console.error('Error obteniendo estadísticas AuriClock:', error);
    return { aurora: 0, zenit: 0, crepusculo: 0, noche: 0 };
  }
}

/**
 * Obtiene el momento actual recomendado
 * @param {number} alumnoId 
 * @returns {Promise<Object>}
 */
export async function getMomentoActualRecomendado(alumnoId) {
  try {
    const ahora = new Date();
    const categoria = getCategoriaMomento(ahora);
    
    // Obtener prácticas más comunes en esta categoría
    const practicas = await query(`
      SELECT 
        p.tipo,
        COUNT(*) as veces
      FROM practicas p
      JOIN auriclock_registro ac ON DATE(p.fecha) = DATE(ac.fecha)
      WHERE p.alumno_id = $1
        AND ac.categoria = $2
        AND ac.fecha >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY p.tipo
      ORDER BY veces DESC
      LIMIT 3
    `, [alumnoId, categoria]);

    return {
      categoria,
      hora: ahora.toTimeString().slice(0, 5),
      practicas_recomendadas: practicas.rows
    };
  } catch (error) {
    console.error('Error obteniendo momento recomendado:', error);
    return { categoria: getCategoriaMomento(), hora: new Date().toTimeString().slice(0, 5), practicas_recomendadas: [] };
  }
}



