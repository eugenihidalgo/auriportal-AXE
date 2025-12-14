// src/services/logros.js
// Servicio de gestión de logros/insignias para AuriPortal V5

import { query } from '../../database/pg.js';
import { analytics } from './analytics.js';

/**
 * Verifica y otorga logros para un alumno
 * @param {number} alumnoId - ID del alumno
 */
export async function verificarLogros(alumnoId) {
  try {
    console.log(`[Logros] Verificando logros para alumno ${alumnoId}...`);

    // Obtener todos los logros activos
    const logrosActivos = await query(
      `SELECT * FROM logros_definicion WHERE activo = true`
    );

    if (logrosActivos.rows.length === 0) {
      console.log(`[Logros] No hay logros activos`);
      return { verificados: 0, otorgados: 0 };
    }

    // Obtener logros ya obtenidos por el alumno
    const logrosObtenidos = await query(
      `SELECT codigo FROM logros WHERE alumno_id = $1`,
      [alumnoId]
    );

    const codigosObtenidos = new Set(logrosObtenidos.rows.map(r => r.codigo));

    let verificados = 0;
    let otorgados = 0;

    for (const logro of logrosActivos.rows) {
      // Si ya lo tiene, saltar
      if (codigosObtenidos.has(logro.codigo)) {
        continue;
      }

      verificados++;

      // Evaluar condiciones
      const condiciones = typeof logro.condiciones === 'string' 
        ? JSON.parse(logro.condiciones) 
        : logro.condiciones;

      const cumpleCondiciones = await evaluarCondicionesLogro(alumnoId, condiciones);

      if (cumpleCondiciones) {
        // Otorgar logro
        await query(
          `INSERT INTO logros (alumno_id, codigo, fecha)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (alumno_id, codigo) DO NOTHING`,
          [alumnoId, logro.codigo]
        );

        otorgados++;

        // Registrar evento analytics
        await analytics.registrarEvento({
          alumno_id: alumnoId,
          tipo_evento: 'logro_obtenido',
          metadata: {
            logro_codigo: logro.codigo,
            logro_nombre: logro.nombre
          }
        });

        console.log(`[Logros] ✅ Logro otorgado: ${logro.nombre} (alumno ${alumnoId})`);
      }
    }

    console.log(`[Logros] Verificación completada: ${verificados} verificados, ${otorgados} otorgados`);

    return { verificados, otorgados };
  } catch (error) {
    console.error(`[Logros] Error verificando logros: ${error.message}`);
    return { verificados: 0, otorgados: 0, error: error.message };
  }
}

/**
 * Evalúa las condiciones de un logro
 * @param {number} alumnoId - ID del alumno
 * @param {Object} condiciones - Objeto con condiciones
 * @returns {Promise<boolean>}
 */
async function evaluarCondicionesLogro(alumnoId, condiciones) {
  if (!condiciones || typeof condiciones !== 'object') {
    return false;
  }

  const tipo = condiciones.tipo;

  switch (tipo) {
    case 'racha':
      return await evaluarRachaLogro(alumnoId, condiciones);

    case 'nivel':
      return await evaluarNivelLogro(alumnoId, condiciones);

    case 'practicas_totales':
      return await evaluarPracticasTotales(alumnoId, condiciones);

    case 'practicas_aspecto':
      return await evaluarPracticasAspecto(alumnoId, condiciones);

    case 'reflexiones':
      return await evaluarReflexiones(alumnoId, condiciones);

    case 'combinado':
      return await evaluarCombinadoLogro(alumnoId, condiciones);

    default:
      console.warn(`[Logros] Tipo de condición desconocido: ${tipo}`);
      return false;
  }
}

/**
 * Evalúa condiciones de tipo "racha"
 * Ejemplo: { tipo: "racha", min_dias: 7, exacto: false }
 */
async function evaluarRachaLogro(alumnoId, condiciones) {
  const minDias = condiciones.min_dias || 0;
  const exacto = condiciones.exacto || false;

  const resultado = await query(
    `SELECT streak FROM alumnos WHERE id = $1`,
    [alumnoId]
  );

  if (resultado.rows.length === 0) {
    return false;
  }

  const streak = parseInt(resultado.rows[0].streak || 0);

  if (exacto) {
    return streak === minDias;
  }

  return streak >= minDias;
}

/**
 * Evalúa condiciones de tipo "nivel"
 * Ejemplo: { tipo: "nivel", min_nivel: 5, exacto: false }
 */
async function evaluarNivelLogro(alumnoId, condiciones) {
  const minNivel = condiciones.min_nivel || 0;
  const exacto = condiciones.exacto || false;

  const resultado = await query(
    `SELECT nivel_actual FROM alumnos WHERE id = $1`,
    [alumnoId]
  );

  if (resultado.rows.length === 0) {
    return false;
  }

  const nivel = parseInt(resultado.rows[0].nivel_actual || 0);

  if (exacto) {
    return nivel === minNivel;
  }

  return nivel >= minNivel;
}

/**
 * Evalúa condiciones de tipo "practicas_totales"
 * Ejemplo: { tipo: "practicas_totales", min_practicas: 10 }
 */
async function evaluarPracticasTotales(alumnoId, condiciones) {
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
 * Evalúa condiciones de tipo "practicas_aspecto"
 * Ejemplo: { tipo: "practicas_aspecto", aspecto_id: 3, min_practicas: 5 }
 */
async function evaluarPracticasAspecto(alumnoId, condiciones) {
  const aspectoId = condiciones.aspecto_id;
  const minPracticas = condiciones.min_practicas || 0;

  if (!aspectoId) {
    return false;
  }

  const resultado = await query(
    `SELECT COUNT(*) as total 
     FROM practicas 
     WHERE alumno_id = $1 AND aspecto_id = $2`,
    [alumnoId, aspectoId]
  );

  const total = parseInt(resultado.rows[0].total || 0);

  return total >= minPracticas;
}

/**
 * Evalúa condiciones de tipo "reflexiones"
 * Ejemplo: { tipo: "reflexiones", min_reflexiones: 5 }
 */
async function evaluarReflexiones(alumnoId, condiciones) {
  const minReflexiones = condiciones.min_reflexiones || 0;

  const resultado = await query(
    `SELECT COUNT(*) as total 
     FROM reflexiones 
     WHERE alumno_id = $1`,
    [alumnoId]
  );

  const total = parseInt(resultado.rows[0].total || 0);

  return total >= minReflexiones;
}

/**
 * Evalúa condiciones de tipo "combinado" (AND/OR)
 */
async function evaluarCombinadoLogro(alumnoId, condiciones) {
  const operador = condiciones.operador || 'AND';
  const subCondiciones = condiciones.condiciones || [];

  const resultados = await Promise.all(
    subCondiciones.map(cond => evaluarCondicionesLogro(alumnoId, cond))
  );

  if (operador === 'AND') {
    return resultados.every(r => r === true);
  } else if (operador === 'OR') {
    return resultados.some(r => r === true);
  }

  return false;
}

/**
 * Obtiene los logros de un alumno
 * @param {number} alumnoId - ID del alumno
 */
export async function getLogrosAlumno(alumnoId) {
  try {
    const resultado = await query(
      `SELECT 
        l.*,
        ld.nombre,
        ld.descripcion,
        ld.icono,
        ld.recompensa
       FROM logros l
       JOIN logros_definicion ld ON l.codigo = ld.codigo
       WHERE l.alumno_id = $1
       ORDER BY l.fecha DESC`,
      [alumnoId]
    );

    return resultado.rows.map(row => ({
      ...row,
      recompensa: typeof row.recompensa === 'string' 
        ? JSON.parse(row.recompensa) 
        : row.recompensa
    }));
  } catch (error) {
    console.error(`[Logros] Error obteniendo logros del alumno: ${error.message}`);
    return [];
  }
}

/**
 * Crea un nuevo logro
 */
export async function crearLogro(logroData) {
  try {
    const { codigo, nombre, descripcion, icono, condiciones, recompensa, activo = true } = logroData;

    const resultado = await query(
      `INSERT INTO logros_definicion (codigo, nombre, descripcion, icono, condiciones, recompensa, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (codigo) 
       DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, 
                     icono = EXCLUDED.icono, condiciones = EXCLUDED.condiciones,
                     recompensa = EXCLUDED.recompensa, activo = EXCLUDED.activo,
                     updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        codigo,
        nombre,
        descripcion,
        icono,
        JSON.stringify(condiciones || {}),
        JSON.stringify(recompensa || {}),
        activo
      ]
    );

    return resultado.rows[0];
  } catch (error) {
    console.error(`[Logros] Error creando logro: ${error.message}`);
    throw error;
  }
}




