// src/modules/informes/services/informes.js
// Servicio para generación de informes semanales

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Genera informe semanal para un alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object>}
 */
export async function generarInformeSemanal(alumnoId) {
  try {
    const ahora = new Date();
    const semana = getWeekNumber(ahora);
    const año = ahora.getFullYear();

    // Obtener datos del alumno
    const alumno = await query(
      `SELECT * FROM alumnos WHERE id = $1`,
      [alumnoId]
    );

    if (alumno.rows.length === 0) {
      throw new Error('Alumno no encontrado');
    }

    const alumnoData = alumno.rows[0];

    // Prácticas de la semana
    const practicasResult = await query(`
      SELECT COUNT(*) as total, 
             COUNT(DISTINCT DATE(fecha)) as dias_practicados
      FROM practicas
      WHERE alumno_id = $1 
        AND fecha >= DATE_TRUNC('week', NOW())
    `, [alumnoId]);

    const practicas = practicasResult.rows[0];

    // Reflexiones de la semana
    const reflexionesResult = await query(`
      SELECT COUNT(*) as total,
             AVG(energia_emocional) as energia_promedio
      FROM reflexiones
      WHERE alumno_id = $1
        AND fecha >= DATE_TRUNC('week', NOW())
        AND energia_emocional IS NOT NULL
    `, [alumnoId]);

    const reflexiones = reflexionesResult.rows[0];

    // Aspectos practicados
    const aspectosResult = await query(`
      SELECT ap.nombre, COUNT(*) as veces
      FROM practicas p
      JOIN aspectos_practica ap ON p.aspecto_id = ap.id
      WHERE p.alumno_id = $1
        AND p.fecha >= DATE_TRUNC('week', NOW())
      GROUP BY ap.nombre
      ORDER BY veces DESC
    `, [alumnoId]);

    const contenido = {
      alumno: {
        email: alumnoData.email,
        apodo: alumnoData.apodo,
        nivel: alumnoData.nivel_actual,
        racha: alumnoData.streak
      },
      practicas: {
        total: parseInt(practicas.total),
        dias_practicados: parseInt(practicas.dias_practicados)
      },
      reflexiones: {
        total: parseInt(reflexiones.total),
        energia_promedio: reflexiones.energia_promedio ? parseFloat(reflexiones.energia_promedio).toFixed(1) : null
      },
      aspectos: aspectosResult.rows,
      fecha_generado: ahora.toISOString()
    };

    // Guardar informe
    await query(`
      INSERT INTO informes_semanales (alumno_id, semana, año, contenido)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (alumno_id, año, semana) DO UPDATE
      SET contenido = EXCLUDED.contenido, fecha_generado = CURRENT_TIMESTAMP
    `, [alumnoId, semana, año, JSON.stringify(contenido)]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'informe_semanal_generado',
      metadata: { semana, año }
    });

    return contenido;
  } catch (error) {
    console.error('Error generando informe semanal:', error);
    throw error;
  }
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

/**
 * Genera informes para todos los alumnos activos
 * @returns {Promise<number>} Cantidad de informes generados
 */
export async function generarInformesSemanalesMasivo() {
  try {
    const alumnos = await query(
      `SELECT id FROM alumnos WHERE estado_suscripcion = 'activa'`
    );

    let generados = 0;
    for (const alumno of alumnos.rows) {
      try {
        await generarInformeSemanal(alumno.id);
        generados++;
      } catch (error) {
        console.error(`Error generando informe para alumno ${alumno.id}:`, error);
      }
    }

    console.log(`✅ Informes semanales generados: ${generados}/${alumnos.rows.length}`);
    return generados;
  } catch (error) {
    console.error('Error generando informes masivos:', error);
    return 0;
  }
}



