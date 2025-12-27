// src/services/pde-motors-executors/motor-post-limpieza-practicas-executor.js
// Ejecutor del motor motor_post_limpieza_practicas
//
// Este motor NO genera steps/edges, sino que modifica el context directamente
// escribiendo en context.post_practices

import { query } from '../../../database/pg.js';
import { logInfo, logWarn, logError } from '../../core/observability/logger.js';

const DOMAIN = 'PDE_MOTOR_POST_LIMPIEZA';

/**
 * Ejecuta el motor motor_post_limpieza_practicas
 * 
 * @param {Object} context - Contexto con tipo_limpieza y nivel_efectivo
 * @param {Object} motorDefinition - Definición del motor con rules
 * @returns {Promise<Object>} Context modificado con post_practices
 */
export async function executeMotorPostLimpiezaPracticas(context, motorDefinition) {
  logInfo(DOMAIN, 'Ejecutando motor motor_post_limpieza_practicas', {
    tipo_limpieza: context.tipo_limpieza,
    nivel_efectivo: context.nivel_efectivo
  });

  // Fail-open: valores por defecto
  const tipoLimpieza = context.tipo_limpieza || 'basica';
  const nivelEfectivo = context.nivel_efectivo !== undefined ? Number(context.nivel_efectivo) : 1;

  // Validar tipo_limpieza
  const tiposValidos = ['rapida', 'basica', 'profunda', 'maestro'];
  const tipoLimpiezaValido = tiposValidos.includes(tipoLimpieza) ? tipoLimpieza : 'basica';

  // Obtener límite según tipo de limpieza
  const limites = motorDefinition.rules?.limites || {
    rapida: 2,
    basica: 3,
    profunda: 5,
    maestro: 7
  };
  const limite = limites[tipoLimpiezaValido] || 3;

  logInfo(DOMAIN, 'Parámetros de ejecución', {
    tipo_limpieza: tipoLimpiezaValido,
    nivel_efectivo: nivelEfectivo,
    limite: limite
  });

  try {
    // 1. Obtener prácticas post-limpieza filtradas por nivel
    const practicas = await obtenerPracticasPostLimpiezaPorNivel(nivelEfectivo);

    // 2. Aplicar límite y mantener orden canónico
    const practicasLimitadas = practicas
      .slice(0, limite);

    // 3. Mapear a formato esperado
    const postPractices = practicasLimitadas.map(practica => ({
      id: practica.id,
      title: practica.nombre,
      description: practica.descripcion || '',
      duration_minutes: practica.minutos || null,
      video_source: practica.video_url || null,
      video_ref: practica.video_url || null // Alias para compatibilidad
    }));

    // 4. Escribir en context (no borrar otros campos)
    const contextModificado = {
      ...context,
      post_practices: postPractices
    };

    logInfo(DOMAIN, 'Motor ejecutado exitosamente', {
      practicas_count: postPractices.length,
      tipo_limpieza: tipoLimpiezaValido
    });

    return contextModificado;
  } catch (error) {
    logError(DOMAIN, 'Error ejecutando motor', {
      error: error.message,
      stack: error.stack
    });
    // Fail-open: retornar context con array vacío
    return {
      ...context,
      post_practices: []
    };
  }
}

/**
 * Obtiene prácticas post-limpieza filtradas por nivel
 * @param {number} nivelEfectivo - Nivel efectivo del alumno
 * @returns {Promise<Array>} Array de prácticas con nivel <= nivelEfectivo
 */
async function obtenerPracticasPostLimpiezaPorNivel(nivelEfectivo) {
  try {
    const result = await query(`
      SELECT 
        id,
        nombre,
        descripcion,
        nivel,
        video_url,
        minutos,
        orden
      FROM tecnicas_post_practica
      WHERE activo = true 
        AND nivel <= $1
      ORDER BY orden ASC, nivel ASC, nombre ASC
    `, [nivelEfectivo]);

    return result.rows;
  } catch (error) {
    logError(DOMAIN, 'Error obteniendo prácticas post-limpieza', {
      error: error.message
    });
    return [];
  }
}











