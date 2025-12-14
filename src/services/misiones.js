// src/services/misiones.js
// Servicio de gestión de misiones para AuriPortal V5

import { query } from '../../database/pg.js';
import { analytics } from './analytics.js';

/**
 * Verifica y actualiza el progreso de misiones para un alumno
 * @param {number} alumnoId - ID del alumno
 */
export async function verificarMisiones(alumnoId) {
  try {
    console.log(`[Misiones] Verificando misiones para alumno ${alumnoId}...`);

    // Obtener todas las misiones activas
    const misionesActivas = await query(
      `SELECT * FROM misiones WHERE activo = true`
    );

    if (misionesActivas.rows.length === 0) {
      console.log(`[Misiones] No hay misiones activas`);
      return { verificadas: 0, completadas: 0 };
    }

    let verificadas = 0;
    let completadas = 0;

    for (const mision of misionesActivas.rows) {
      // Verificar si el alumno ya completó esta misión
      const misionAlumno = await query(
        `SELECT * FROM misiones_alumnos 
         WHERE alumno_id = $1 AND mision_id = $2`,
        [alumnoId, mision.id]
      );

      if (misionAlumno.rows.length > 0 && misionAlumno.rows[0].completada) {
        // Ya está completada, saltar
        continue;
      }

      verificadas++;

      // Evaluar condiciones según el tipo
      const condiciones = typeof mision.condiciones === 'string' 
        ? JSON.parse(mision.condiciones) 
        : mision.condiciones;

      const cumpleCondiciones = await evaluarCondiciones(alumnoId, condiciones);

      if (cumpleCondiciones) {
        // Marcar misión como completada
        if (misionAlumno.rows.length === 0) {
          // Crear registro
          await query(
            `INSERT INTO misiones_alumnos (alumno_id, mision_id, completada, fecha)
             VALUES ($1, $2, true, CURRENT_TIMESTAMP)
             ON CONFLICT (alumno_id, mision_id) 
             DO UPDATE SET completada = true, fecha = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
            [alumnoId, mision.id]
          );
        } else {
          // Actualizar registro existente
          await query(
            `UPDATE misiones_alumnos 
             SET completada = true, fecha = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE alumno_id = $1 AND mision_id = $2`,
            [alumnoId, mision.id]
          );
        }

        completadas++;

        // Registrar evento analytics
        await analytics.registrarEvento({
          alumno_id: alumnoId,
          tipo_evento: 'mision_completada',
          metadata: {
            mision_id: mision.id,
            mision_codigo: mision.codigo,
            mision_nombre: mision.nombre
          }
        });

        console.log(`[Misiones] ✅ Misión completada: ${mision.nombre} (alumno ${alumnoId})`);
      }
    }

    console.log(`[Misiones] Verificación completada: ${verificadas} verificadas, ${completadas} completadas`);

    return { verificadas, completadas };
  } catch (error) {
    console.error(`[Misiones] Error verificando misiones: ${error.message}`);
    return { verificadas: 0, completadas: 0, error: error.message };
  }
}

/**
 * Evalúa las condiciones de una misión
 * @param {number} alumnoId - ID del alumno
 * @param {Object} condiciones - Objeto con condiciones
 * @returns {Promise<boolean>}
 */
async function evaluarCondiciones(alumnoId, condiciones) {
  if (!condiciones || typeof condiciones !== 'object') {
    return false;
  }

  const tipo = condiciones.tipo;

  switch (tipo) {
    case 'contador_aspectos':
      return await evaluarContadorAspectos(alumnoId, condiciones);

    case 'contador_practicas':
      return await evaluarContadorPracticas(alumnoId, condiciones);

    case 'racha':
      return await evaluarRacha(alumnoId, condiciones);

    case 'nivel':
      return await evaluarNivel(alumnoId, condiciones);

    case 'combinado':
      return await evaluarCombinado(alumnoId, condiciones);

    default:
      console.warn(`[Misiones] Tipo de condición desconocido: ${tipo}`);
      return false;
  }
}

/**
 * Evalúa condiciones de tipo "contador_aspectos"
 * Ejemplo: { tipo: "contador_aspectos", objetivos: [{ aspecto_id: 3, min_practicas: 5 }] }
 */
async function evaluarContadorAspectos(alumnoId, condiciones) {
  const objetivos = condiciones.objetivos || [];

  for (const objetivo of objetivos) {
    const aspectoId = objetivo.aspecto_id;
    const minPracticas = objetivo.min_practicas || 0;

    // Contar prácticas del alumno para este aspecto
    const resultado = await query(
      `SELECT COUNT(*) as total 
       FROM practicas 
       WHERE alumno_id = $1 AND aspecto_id = $2`,
      [alumnoId, aspectoId]
    );

    const total = parseInt(resultado.rows[0].total || 0);

    if (total < minPracticas) {
      return false; // No cumple este objetivo
    }
  }

  return true; // Cumple todos los objetivos
}

/**
 * Evalúa condiciones de tipo "contador_practicas"
 * Ejemplo: { tipo: "contador_practicas", min_practicas: 10 }
 */
async function evaluarContadorPracticas(alumnoId, condiciones) {
  const minPracticas = condiciones.min_practicas || 0;

  const resultado = await query(
    `SELECT COUNT(*) as total 
     FROM practicas 
     WHERE alumno_id = $1`,
    [alumnoId]
  );

  const total = parseInt(resultado.rows[0].total || 0);

  return total >= minPracticas;
}

/**
 * Evalúa condiciones de tipo "racha"
 * Ejemplo: { tipo: "racha", min_dias: 7 }
 */
async function evaluarRacha(alumnoId, condiciones) {
  const minDias = condiciones.min_dias || 0;

  const resultado = await query(
    `SELECT streak FROM alumnos WHERE id = $1`,
    [alumnoId]
  );

  if (resultado.rows.length === 0) {
    return false;
  }

  const streak = parseInt(resultado.rows[0].streak || 0);

  return streak >= minDias;
}

/**
 * Evalúa condiciones de tipo "nivel"
 * Ejemplo: { tipo: "nivel", min_nivel: 5 }
 */
async function evaluarNivel(alumnoId, condiciones) {
  const minNivel = condiciones.min_nivel || 0;

  const resultado = await query(
    `SELECT nivel_actual FROM alumnos WHERE id = $1`,
    [alumnoId]
  );

  if (resultado.rows.length === 0) {
    return false;
  }

  const nivel = parseInt(resultado.rows[0].nivel_actual || 0);

  return nivel >= minNivel;
}

/**
 * Evalúa condiciones de tipo "combinado" (AND/OR)
 * Ejemplo: { tipo: "combinado", operador: "AND", condiciones: [...] }
 */
async function evaluarCombinado(alumnoId, condiciones) {
  const operador = condiciones.operador || 'AND';
  const subCondiciones = condiciones.condiciones || [];

  const resultados = await Promise.all(
    subCondiciones.map(cond => evaluarCondiciones(alumnoId, cond))
  );

  if (operador === 'AND') {
    return resultados.every(r => r === true);
  } else if (operador === 'OR') {
    return resultados.some(r => r === true);
  }

  return false;
}

/**
 * Obtiene las misiones de un alumno
 * @param {number} alumnoId - ID del alumno
 * @param {boolean} soloCompletadas - Si true, solo devuelve completadas
 */
export async function getMisionesAlumno(alumnoId, soloCompletadas = false) {
  try {
    let querySQL = `
      SELECT 
        m.*,
        ma.completada,
        ma.fecha as fecha_completada
      FROM misiones m
      LEFT JOIN misiones_alumnos ma ON m.id = ma.mision_id AND ma.alumno_id = $1
      WHERE m.activo = true
    `;

    const params = [alumnoId];

    if (soloCompletadas) {
      querySQL += ` AND ma.completada = true`;
    }

    querySQL += ` ORDER BY m.id`;

    const resultado = await query(querySQL, params);

    return resultado.rows.map(row => ({
      ...row,
      condiciones: typeof row.condiciones === 'string' 
        ? JSON.parse(row.condiciones) 
        : row.condiciones,
      recompensa: typeof row.recompensa === 'string' 
        ? JSON.parse(row.recompensa) 
        : row.recompensa
    }));
  } catch (error) {
    console.error(`[Misiones] Error obteniendo misiones del alumno: ${error.message}`);
    return [];
  }
}

/**
 * Crea una nueva misión
 */
export async function crearMision(misionData) {
  try {
    const { codigo, nombre, descripcion, condiciones, recompensa, activo = true } = misionData;

    const resultado = await query(
      `INSERT INTO misiones (codigo, nombre, descripcion, condiciones, recompensa, activo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        codigo,
        nombre,
        descripcion,
        JSON.stringify(condiciones || {}),
        JSON.stringify(recompensa || {}),
        activo
      ]
    );

    return resultado.rows[0];
  } catch (error) {
    console.error(`[Misiones] Error creando misión: ${error.message}`);
    throw error;
  }
}




