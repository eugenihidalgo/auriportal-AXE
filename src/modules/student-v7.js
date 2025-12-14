// src/modules/student-v7.js
// Extensión V7 de student-v4.js con funcionalidades nuevas

import { createStudent as createStudentV4 } from './student-v4.js';
import { query } from '../../database/pg.js';
import { crearTareaClickUpNuevoAlumno } from '../services/clickup-nuevo-alumno.js';
import { analytics } from '../../../services/analytics.js';

/**
 * Crea un nuevo alumno con todas las funcionalidades V7
 * @param {Object} env - Variables de entorno
 * @param {Object} datos - Datos del alumno
 * @returns {Promise<Object>}
 */
export async function createStudentV7(env, datos) {
  const {
    email,
    apodo = '',
    nombreKajabi = null, // Parámetro mantenido por compatibilidad pero no usado
    nombre_completo = null,
    fecha_nacimiento = null,
    lugar_nacimiento = null,
    hora_nacimiento = null
  } = datos;

  try {
    // 1. Crear alumno base (V4)
    const alumno = await createStudentV4(env, { email, apodo });

    if (!alumno || !alumno.id) {
      throw new Error('Error creando alumno base');
    }

    // 2. Actualizar alumno con datos V7
    await query(`
      UPDATE alumnos
      SET 
        nombre_completo = COALESCE($1, nombre_completo),
        fecha_nacimiento = COALESCE($2::date, fecha_nacimiento),
        lugar_nacimiento = COALESCE($3, lugar_nacimiento),
        hora_nacimiento = COALESCE($4, hora_nacimiento),
        ajustes = '{}'::jsonb
      WHERE id = $5
    `, [nombre_completo, fecha_nacimiento, lugar_nacimiento, hora_nacimiento, alumno.id]);

    // 4. Crear entradas vacías en carta_astral y disenohumano
    await query(`
      INSERT INTO carta_astral (alumno_id)
      VALUES ($1)
      ON CONFLICT (alumno_id) DO NOTHING
    `, [alumno.id]);

    await query(`
      INSERT INTO disenohumano (alumno_id)
      VALUES ($1)
      ON CONFLICT (alumno_id) DO NOTHING
    `, [alumno.id]);

    // 3. Crear tarea en ClickUp
    let clickupResult = null;
    try {
      const datosCompletos = {
        email,
        nombre_completo: nombre_completo || apodo,
        apodo,
        fecha_nacimiento,
        lugar_nacimiento,
        hora_nacimiento
      };
      clickupResult = await crearTareaClickUpNuevoAlumno(env, datosCompletos);
    } catch (clickupError) {
      console.error('Error creando tarea ClickUp (no crítico):', clickupError);
      // No fallar si ClickUp falla
    }

    // 4. Registrar evento analytics
    await analytics.registrarEvento({
      alumno_id: alumno.id,
      tipo_evento: 'alumno_creado_v7',
      metadata: {
        tiene_fecha_nacimiento: !!fecha_nacimiento,
        tiene_carta_astral: false,
        tiene_disenohumano: false,
        clickup_task_id: clickupResult?.taskId || null
      }
    });

    console.log(`✅ Alumno V7 creado: ${email} (ID: ${alumno.id})`);

    return {
      ...alumno,
      clickup_task_id: clickupResult?.taskId || null
    };
  } catch (error) {
    console.error('Error creando alumno V7:', error);
    throw error;
  }
}



