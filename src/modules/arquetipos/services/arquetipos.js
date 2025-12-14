// src/modules/arquetipos/services/arquetipos.js
// Servicio para evaluación y asignación de arquetipos dinámicos

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Evalúa qué arquetipos cumple un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function evaluarArquetipos(alumnoId) {
  try {
    const arquetipos = await query(
      `SELECT * FROM arquetipos WHERE activo = true ORDER BY prioridad DESC`
    );

    const alumno = await query(
      `SELECT * FROM alumnos WHERE id = $1`,
      [alumnoId]
    );

    if (alumno.rows.length === 0) {
      return [];
    }

    const alumnoData = alumno.rows[0];
    const arquetiposCumplidos = [];

    for (const arquetipo of arquetipos.rows) {
      const condiciones = typeof arquetipo.condiciones === 'string'
        ? JSON.parse(arquetipo.condiciones)
        : arquetipo.condiciones;

      const cumple = await verificarCondicionesArquetipo(alumnoId, alumnoData, condiciones);
      
      if (cumple) {
        arquetiposCumplidos.push(arquetipo);
      }
    }

    return arquetiposCumplidos;
  } catch (error) {
    console.error('❌ Error evaluando arquetipos:', error);
    return [];
  }
}

async function verificarCondicionesArquetipo(alumnoId, alumnoData, condiciones) {
  try {
    // Diversidad mínima
    if (condiciones.diversidad_min) {
      const diversidadResult = await query(
        `SELECT COUNT(DISTINCT aspecto_id) as total 
         FROM practicas 
         WHERE alumno_id = $1 AND aspecto_id IS NOT NULL 
           AND fecha >= NOW() - INTERVAL '30 days'`,
        [alumnoId]
      );
      if (parseInt(diversidadResult.rows[0].total) < condiciones.diversidad_min) {
        return false;
      }
    }

    // Racha mínima
    if (condiciones.racha_min && alumnoData.streak < condiciones.racha_min) {
      return false;
    }

    // Prácticas por mes
    if (condiciones.practicas_mes) {
      const practicasResult = await query(
        `SELECT COUNT(*) as total 
         FROM practicas 
         WHERE alumno_id = $1 
           AND fecha >= NOW() - INTERVAL '30 days'`,
        [alumnoId]
      );
      if (parseInt(practicasResult.rows[0].total) < condiciones.practicas_mes) {
        return false;
      }
    }

    // Energía promedio
    if (condiciones.energia_promedio) {
      if ((alumnoData.energia_emocional || 5) < condiciones.energia_promedio) {
        return false;
      }
    }

    // Prácticas de tipo específico
    if (condiciones.practicas_sanacion || condiciones.practicas_canalizacion) {
      // Verificar por tipo de práctica
      // (Implementar según necesidad)
    }

    return true;
  } catch (error) {
    console.error('Error verificando condiciones arquetipo:', error);
    return false;
  }
}

/**
 * Asigna un arquetipo a un alumno
 * @param {number} alumnoId 
 * @param {string} arquetipoCodigo 
 * @returns {Promise<boolean>}
 */
export async function asignarArquetipo(alumnoId, arquetipoCodigo) {
  try {
    await query(`
      INSERT INTO arquetipos_alumnos (alumno_id, arquetipo_codigo, activo)
      VALUES ($1, $2, true)
      ON CONFLICT (alumno_id, arquetipo_codigo) DO UPDATE 
      SET activo = true, fecha_asignado = CURRENT_TIMESTAMP
    `, [alumnoId, arquetipoCodigo]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'arquetipo_asignado',
      metadata: { arquetipo: arquetipoCodigo }
    });

    return true;
  } catch (error) {
    console.error('Error asignando arquetipo:', error);
    return false;
  }
}

/**
 * Obtiene arquetipos del alumno
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getArquetiposAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT a.*, aa.fecha_asignado, aa.activo as asignado_activo
      FROM arquetipos_alumnos aa
      JOIN arquetipos a ON aa.arquetipo_codigo = a.codigo
      WHERE aa.alumno_id = $1 AND aa.activo = true
      ORDER BY aa.fecha_asignado DESC
    `, [alumnoId]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo arquetipos de alumno:', error);
    return [];
  }
}



