// src/modules/sorpresas/services/sorpresas.js
// Servicio para recomendación inteligente de prácticas sorpresa

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Genera una sorpresa para el alumno basada en su comportamiento
 * @param {number} alumnoId 
 * @returns {Promise<Object|null>}
 */
export async function generarSorpresa(alumnoId) {
  try {
    const alumno = await query(
      `SELECT * FROM alumnos WHERE id = $1`,
      [alumnoId]
    );

    if (alumno.rows.length === 0) {
      return null;
    }

    const alumnoData = alumno.rows[0];

    // Verificar última práctica
    const diasSinPractica = alumnoData.fecha_ultima_practica
      ? Math.floor((Date.now() - new Date(alumnoData.fecha_ultima_practica)) / (1000 * 60 * 60 * 24))
      : 999;

    // Obtener sorpresas que el alumno NO ha visto recientemente
    const sorpresasResult = await query(`
      SELECT s.*
      FROM sorpresas s
      WHERE s.activo = true
        AND s.id NOT IN (
          SELECT sorpresa_id 
          FROM sorpresas_alumnos 
          WHERE alumno_id = $1 
            AND fecha_mostrada >= NOW() - INTERVAL '7 days'
        )
      ORDER BY s.prioridad DESC, RANDOM()
      LIMIT 5
    `, [alumnoId]);

    // Evaluar condiciones de cada sorpresa
    for (const sorpresa of sorpresasResult.rows) {
      const condiciones = typeof sorpresa.condiciones === 'string'
        ? JSON.parse(sorpresa.condiciones)
        : sorpresa.condiciones;

      if (await evaluarCondicionesSorpresa(alumnoId, alumnoData, condiciones, diasSinPractica)) {
        // Registrar que se mostró
        await query(`
          INSERT INTO sorpresas_alumnos (alumno_id, sorpresa_id)
          VALUES ($1, $2)
        `, [alumnoId, sorpresa.id]);

        await analytics.registrarEvento({
          alumno_id: alumnoId,
          tipo_evento: 'sorpresa_mostrada',
          metadata: { sorpresa_id: sorpresa.id, codigo: sorpresa.codigo }
        });

        return sorpresa;
      }
    }

    return null;
  } catch (error) {
    console.error('Error generando sorpresa:', error);
    return null;
  }
}

async function evaluarCondicionesSorpresa(alumnoId, alumnoData, condiciones, diasSinPractica) {
  if (condiciones.practicas_total !== undefined) {
    const practicasResult = await query(
      `SELECT COUNT(*) as total FROM practicas WHERE alumno_id = $1`,
      [alumnoId]
    );
    if (parseInt(practicasResult.rows[0].total) !== condiciones.practicas_total) {
      return false;
    }
  }

  if (condiciones.racha !== undefined) {
    if (alumnoData.streak !== condiciones.racha) {
      return false;
    }
  }

  if (condiciones.sin_practica_dias !== undefined) {
    if (diasSinPractica < condiciones.sin_practica_dias) {
      return false;
    }
  }

  if (condiciones.nivel_cambio && !alumnoData.nivel_cambio_reciente) {
    return false;
  }

  return true;
}



