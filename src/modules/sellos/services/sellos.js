// src/modules/sellos/services/sellos.js
// Servicio para Sellos de Ascensión

import { query } from '../../../../database/pg.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Verifica si un alumno cumple requisitos para un sello
 * @param {number} alumnoId 
 * @param {string} selloCodigo 
 * @returns {Promise<{cumple: boolean, detalles: Object}>}
 */
export async function verificarSello(alumnoId, selloCodigo) {
  try {
    const sello = await query(
      `SELECT * FROM sellos_ascension WHERE codigo = $1 AND activo = true`,
      [selloCodigo]
    );

    if (sello.rows.length === 0) {
      return { cumple: false, detalles: { error: 'Sello no encontrado' } };
    }

    const selloData = sello.rows[0];
    const requisitos = typeof selloData.requisitos === 'string'
      ? JSON.parse(selloData.requisitos)
      : selloData.requisitos;

    const alumno = await query(`SELECT * FROM alumnos WHERE id = $1`, [alumnoId]);
    if (alumno.rows.length === 0) {
      return { cumple: false, detalles: { error: 'Alumno no encontrado' } };
    }

    const alumnoData = alumno.rows[0];
    const detalles = {};

    // Verificar nivel
    if (selloData.nivel_desde && alumnoData.nivel_actual < selloData.nivel_desde) {
      return { cumple: false, detalles: { nivel_requerido: selloData.nivel_desde } };
    }

    // Verificar requisitos
    if (requisitos.min_practicas) {
      const practicas = await query(
        `SELECT COUNT(*) as total FROM practicas WHERE alumno_id = $1`,
        [alumnoId]
      );
      detalles.practicas = parseInt(practicas.rows[0].total);
      detalles.practicas_requeridas = requisitos.min_practicas;
      if (detalles.practicas < requisitos.min_practicas) {
        return { cumple: false, detalles };
      }
    }

    if (requisitos.min_racha) {
      detalles.racha = alumnoData.streak || 0;
      if (detalles.racha < requisitos.min_racha) {
        return { cumple: false, detalles };
      }
    }

    if (requisitos.boss_completado) {
      const boss = await query(`
        SELECT 1 FROM auribosses_alumnos
        WHERE alumno_id = $1 AND completado = true
        LIMIT 1
      `, [alumnoId]);
      if (boss.rows.length === 0) {
        return { cumple: false, detalles: { boss_requerido: true } };
      }
    }

    return { cumple: true, detalles };
  } catch (error) {
    console.error('Error verificando sello:', error);
    return { cumple: false, detalles: { error: error.message } };
  }
}

/**
 * Otorga un sello a un alumno
 * @param {number} alumnoId 
 * @param {string} selloCodigo 
 * @returns {Promise<boolean>}
 */
export async function otorgarSello(alumnoId, selloCodigo) {
  try {
    // Verificar si ya lo tiene
    const existe = await query(`
      SELECT 1 FROM sellos_alumnos
      WHERE alumno_id = $1 AND sello_codigo = $2
    `, [alumnoId, selloCodigo]);

    if (existe.rows.length > 0) {
      return true; // Ya lo tiene
    }

    // Otorgar sello
    await query(`
      INSERT INTO sellos_alumnos (alumno_id, sello_codigo, fecha)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
    `, [alumnoId, selloCodigo]);

    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'sello_otorgado',
      metadata: { sello_codigo: selloCodigo }
    });

    console.log(`✅ Sello ${selloCodigo} otorgado a alumno ${alumnoId}`);
    return true;
  } catch (error) {
    console.error('Error otorgando sello:', error);
    return false;
  }
}

/**
 * Obtiene sellos del alumno
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getSellosAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT s.*, sa.fecha as fecha_otorgado
      FROM sellos_alumnos sa
      JOIN sellos_ascension s ON sa.sello_codigo = s.codigo
      WHERE sa.alumno_id = $1
      ORDER BY sa.fecha DESC
    `, [alumnoId]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo sellos:', error);
    return [];
  }
}

/**
 * Verifica y otorga sellos automáticamente al cambiar de nivel
 * @param {number} alumnoId 
 * @param {number} nuevoNivel 
 * @returns {Promise<Array>} Sellos otorgados
 */
export async function verificarSellosPorNivel(alumnoId, nuevoNivel) {
  try {
    const sellos = await query(`
      SELECT * FROM sellos_ascension
      WHERE activo = true
        AND nivel_desde <= $1
        AND (nivel_hasta IS NULL OR nivel_hasta >= $1)
    `, [nuevoNivel]);

    const sellosOtorgados = [];

    for (const sello of sellos.rows) {
      const verificacion = await verificarSello(alumnoId, sello.codigo);
      if (verificacion.cumple) {
        const otorgado = await otorgarSello(alumnoId, sello.codigo);
        if (otorgado) {
          sellosOtorgados.push(sello);
        }
      }
    }

    return sellosOtorgados;
  } catch (error) {
    console.error('Error verificando sellos por nivel:', error);
    return [];
  }
}



