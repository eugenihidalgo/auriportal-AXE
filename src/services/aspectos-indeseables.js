// src/services/aspectos-indeseables.js
// Servicio para gestión de energías indeseables

import { query } from '../../database/pg.js';
import { analytics } from './analytics.js';

/**
 * Asegura que la tabla limpiezas_master_historial existe
 */
async function asegurarTablaHistorial() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS limpiezas_master_historial (
        id SERIAL PRIMARY KEY,
        alumno_id INT,
        tipo VARCHAR(50) NOT NULL,
        aspecto_id INT NOT NULL,
        aspecto_nombre VARCHAR(500),
        seccion VARCHAR(100),
        fecha_limpieza TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_alumno ON limpiezas_master_historial(alumno_id)`).catch(() => {});
    await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_fecha ON limpiezas_master_historial(fecha_limpieza)`).catch(() => {});
    await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_tipo ON limpiezas_master_historial(tipo)`).catch(() => {});
  } catch (err) {
    // Ignorar errores de creación (puede que ya exista o haya problema de permisos)
  }
}

// Asegurar que las tablas existan
async function ensureTables() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS aspectos_indeseables (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      frecuencia_dias INT DEFAULT 14,
      prioridad VARCHAR(50) DEFAULT 'Normal',
      orden INT DEFAULT 0,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_activo ON aspectos_indeseables(activo)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_orden ON aspectos_indeseables(orden)`);
    
    await query(`CREATE TABLE IF NOT EXISTS aspectos_indeseables_alumnos (
      id SERIAL PRIMARY KEY,
      alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
      aspecto_id INT REFERENCES aspectos_indeseables(id) ON DELETE CASCADE,
      estado VARCHAR(50) DEFAULT 'pendiente',
      ultima_limpieza TIMESTAMP,
      proxima_limpieza TIMESTAMP,
      UNIQUE (alumno_id, aspecto_id)
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_alumnos_alumno ON aspectos_indeseables_alumnos(alumno_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_alumnos_aspecto ON aspectos_indeseables_alumnos(aspecto_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aspectos_indeseables_alumnos_estado ON aspectos_indeseables_alumnos(estado)`);
  } catch (error) {
    // Ignorar errores si las tablas ya existen
    if (!error.message.includes('already exists')) {
      console.error('Error asegurando tablas de energías indeseables:', error.message);
    }
  }
}

/**
 * Lista todas las energías indeseables globales
 * @returns {Promise<Array>}
 */
export async function listarAspectosIndeseablesGlobales() {
  try {
    await ensureTables();
    try {
      const result = await query(`
        SELECT *, COALESCE(nivel_minimo, 1) as nivel_minimo
        FROM aspectos_indeseables
        WHERE activo = true
        ORDER BY COALESCE(nivel_minimo, 1) ASC, orden ASC, nombre ASC
      `);
      return result.rows;
    } catch (err) {
      if (err.message.includes('nivel_minimo')) {
        const result = await query(`
          SELECT *, 1 as nivel_minimo
          FROM aspectos_indeseables
          WHERE activo = true
          ORDER BY orden ASC, nombre ASC
        `);
        return result.rows;
      }
      throw err;
    }
  } catch (error) {
    console.error('Error listando aspectos indeseables globales:', error);
    return [];
  }
}

/**
 * Crea una energía indeseable rápidamente (solo con nombre)
 * @param {string} nombre 
 * @returns {Promise<number>} - ID del aspecto creado
 */
export async function crearAspectoIndeseableRapido(nombre) {
  try {
    await ensureTables();
    const result = await query(`
      INSERT INTO aspectos_indeseables (nombre, frecuencia_dias, prioridad)
      VALUES ($1, 14, 'Normal')
      RETURNING id
    `, [nombre]);

    await analytics.registrarEvento({
      tipo_evento: 'aspecto_indeseable_creado',
      metadata: { aspecto_id: result.rows[0].id, nombre }
    });

    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando aspecto indeseable rápido:', error);
    throw error;
  }
}

/**
 * Actualiza detalles de una energía indeseable
 * @param {number} aspectoId 
 * @param {Object} datos 
 * @returns {Promise<boolean>}
 */
export async function actualizarAspectoIndeseableDetalle(aspectoId, datos) {
  try {
    const { nombre, frecuencia_dias, prioridad, activo, orden, nivel_minimo } = datos;
    
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      params.push(nombre);
    }
    if (frecuencia_dias !== undefined) {
      updates.push(`frecuencia_dias = $${paramIndex++}`);
      params.push(frecuencia_dias);
    }
    if (prioridad !== undefined) {
      updates.push(`prioridad = $${paramIndex++}`);
      params.push(prioridad);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      params.push(activo);
    }
    if (orden !== undefined) {
      updates.push(`orden = $${paramIndex++}`);
      params.push(orden);
    }
    if (nivel_minimo !== undefined) {
      updates.push(`nivel_minimo = $${paramIndex++}`);
      params.push(nivel_minimo);
    }

    if (updates.length === 0) return true;

    params.push(aspectoId);

    await query(`
      UPDATE aspectos_indeseables
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);

    return true;
  } catch (error) {
    console.error('Error actualizando aspecto indeseable:', error);
    return false;
  }
}

/**
 * Obtiene energías indeseables de un alumno con estado calculado
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getAspectosIndeseablesAlumno(alumnoId) {
  try {
    // Primero, asegurar que el alumno tiene registro de todos los aspectos activos
    await query(`
      INSERT INTO aspectos_indeseables_alumnos (alumno_id, aspecto_id, estado)
      SELECT $1, id, 'pendiente'
      FROM aspectos_indeseables
      WHERE activo = true
        AND id NOT IN (
          SELECT aspecto_id FROM aspectos_indeseables_alumnos WHERE alumno_id = $1
        )
    `, [alumnoId]);

    // Calcular estados
    await query(`
      UPDATE aspectos_indeseables_alumnos ai
      SET 
        proxima_limpieza = COALESCE(
          ai.ultima_limpieza + INTERVAL '1 day' * a.frecuencia_dias,
          CURRENT_TIMESTAMP
        ),
        estado = CASE
          WHEN ai.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN CURRENT_TIMESTAMP <= (ai.ultima_limpieza + INTERVAL '1 day' * a.frecuencia_dias) THEN 'al_dia'
          WHEN CURRENT_TIMESTAMP <= (ai.ultima_limpieza + INTERVAL '1 day' * a.frecuencia_dias * 2) THEN 'pendiente'
          ELSE 'muy_pendiente'
        END
      FROM aspectos_indeseables a
      WHERE ai.aspecto_id = a.id
        AND ai.alumno_id = $1
    `, [alumnoId]);

    // Obtener aspectos con estado
    const result = await query(`
      SELECT 
        a.*,
        ai.ultima_limpieza,
        ai.proxima_limpieza,
        ai.estado
      FROM aspectos_indeseables a
      JOIN aspectos_indeseables_alumnos ai ON a.id = ai.aspecto_id
      WHERE a.activo = true
        AND ai.alumno_id = $1
      ORDER BY 
        CASE ai.estado
          WHEN 'muy_pendiente' THEN 1
          WHEN 'pendiente' THEN 2
          WHEN 'al_dia' THEN 3
        END,
        a.orden ASC,
        ai.proxima_limpieza ASC
    `, [alumnoId]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo aspectos indeseables del alumno:', error);
    return [];
  }
}

/**
 * Obtiene estadísticas de limpieza de energías indeseables del alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object>}
 */
export async function getEstadisticasLimpiezaIndeseables(alumnoId) {
  try {
    const aspectos = await getAspectosIndeseablesAlumno(alumnoId);
    
    const alDia = aspectos.filter(a => a.estado === 'al_dia').length;
    const pendientes = aspectos.filter(a => a.estado === 'pendiente').length;
    const muyPendientes = aspectos.filter(a => a.estado === 'muy_pendiente').length;

    return {
      total: aspectos.length,
      al_dia: alDia,
      pendientes: pendientes,
      muy_pendientes: muyPendientes
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas de energías indeseables:', error);
    return { total: 0, al_dia: 0, pendientes: 0, muy_pendientes: 0 };
  }
}

/**
 * Obtiene todos los alumnos que tienen una energía indeseable específica con su estado
 * @param {number} aspectoId 
 * @returns {Promise<Array>}
 */
export async function getAlumnosPorAspectoIndeseable(aspectoId) {
  try {
    const result = await query(`
      SELECT 
        a.id as alumno_id,
        a.email,
        a.apodo,
        a.nombre_completo,
        a.nivel_actual,
        ai.ultima_limpieza,
        ai.estado,
        ai.veces_limpiado,
        aei.nombre as aspecto_nombre,
        aei.frecuencia_dias,
        CASE
          WHEN ai.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ai.ultima_limpieza))::INT
        END as dias_desde_limpieza,
        CASE
          WHEN ai.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ai.ultima_limpieza))::INT <= aei.frecuencia_dias THEN 'limpio'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ai.ultima_limpieza))::INT <= 15 THEN 'pendiente'
          ELSE 'olvidado'
        END as estado_calculado
      FROM alumnos a
      CROSS JOIN aspectos_indeseables aei
      LEFT JOIN aspectos_indeseables_alumnos ai ON ai.alumno_id = a.id AND ai.aspecto_id = aei.id
      WHERE aei.id = $1
        AND a.estado_suscripcion = 'activa'
        AND (COALESCE(aei.nivel_minimo, 1) <= a.nivel_actual)
      ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
    `, [aspectoId]).catch(err => {
      if (err.message.includes('nivel_minimo') || err.message.includes('veces_limpiado')) {
        return query(`
          SELECT 
            a.id as alumno_id,
            a.email,
            a.apodo,
            a.nombre_completo,
            a.nivel_actual,
            ai.ultima_limpieza,
            ai.estado,
            aei.nombre as aspecto_nombre,
            aei.frecuencia_dias,
            CASE
              WHEN ai.ultima_limpieza IS NULL THEN NULL
              ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ai.ultima_limpieza))::INT
            END as dias_desde_limpieza,
            CASE
              WHEN ai.ultima_limpieza IS NULL THEN 'pendiente'
              WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ai.ultima_limpieza))::INT <= aei.frecuencia_dias THEN 'limpio'
              WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ai.ultima_limpieza))::INT <= 15 THEN 'pendiente'
              ELSE 'olvidado'
            END as estado_calculado
          FROM alumnos a
          CROSS JOIN aspectos_indeseables aei
          LEFT JOIN aspectos_indeseables_alumnos ai ON ai.alumno_id = a.id AND ai.aspecto_id = aei.id
          WHERE aei.id = $1
            AND a.estado_suscripcion = 'activa'
          ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
        `, [aspectoId]);
      }
      throw err;
    });
    
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo alumnos por aspecto indeseable:', error);
    return [];
  }
}

/**
 * Marca todos los alumnos de una energía indeseable específica como limpios
 * @param {number} aspectoId 
 * @returns {Promise<Object>}
 */
export async function marcarTodosAlumnosLimpiosPorAspectoIndeseable(aspectoId) {
  try {
    // Obtener el nombre del aspecto para el historial
    const aspectoResult = await query('SELECT nombre FROM aspectos_indeseables WHERE id = $1', [aspectoId]);
    const aspectoNombre = aspectoResult.rows[0]?.nombre || null;
    const seccion = 'Energías Indeseables';
    
    // Obtener todos los alumnos activos que pueden ver este aspecto
    // Intentar con nivel_minimo primero, si falla usar sin filtro de nivel
    let alumnos;
    try {
      alumnos = await query(`
        SELECT DISTINCT a.id
        FROM alumnos a
        CROSS JOIN aspectos_indeseables aei
        WHERE aei.id = $1
          AND a.estado_suscripcion = 'activa'
          AND (COALESCE(aei.nivel_minimo, 1) <= a.nivel_actual)
      `, [aspectoId]);
    } catch (error) {
      // Si la columna nivel_minimo no existe, obtener todos los alumnos activos
      if (error.message.includes('nivel_minimo')) {
        alumnos = await query(`
          SELECT DISTINCT a.id
          FROM alumnos a
          CROSS JOIN aspectos_indeseables aei
          WHERE aei.id = $1
            AND a.estado_suscripcion = 'activa'
        `, [aspectoId]);
      } else {
        throw error;
      }
    }
    
    const ahora = new Date();
    let marcados = 0;
    let historialRegistrado = false; // Flag para registrar solo una vez en el historial
    
    for (const alumno of alumnos.rows) {
      // Verificar si existe el registro
      const existe = await query(
        `SELECT id FROM aspectos_indeseables_alumnos WHERE alumno_id = $1 AND aspecto_id = $2`,
        [alumno.id, aspectoId]
      );
      
      if (existe.rows.length > 0) {
        // Actualizar registro existente
        await query(
          `UPDATE aspectos_indeseables_alumnos 
           SET estado = 'limpio', 
               ultima_limpieza = $1,
               veces_limpiado = COALESCE(veces_limpiado, 0) + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE alumno_id = $2 AND aspecto_id = $3`,
          [ahora, alumno.id, aspectoId]
        ).catch(() => {
          return query(
            `UPDATE aspectos_indeseables_alumnos 
             SET estado = 'limpio', 
                 ultima_limpieza = $1
             WHERE alumno_id = $2 AND aspecto_id = $3`,
            [ahora, alumno.id, aspectoId]
          );
        });
        
        marcados++;
      } else {
        // Crear nuevo registro
        await query(
          `INSERT INTO aspectos_indeseables_alumnos (alumno_id, aspecto_id, estado, ultima_limpieza, veces_limpiado)
           VALUES ($1, $2, 'limpio', $3, 1)`,
          [alumno.id, aspectoId, ahora]
        ).catch(() => {
          return query(
            `INSERT INTO aspectos_indeseables_alumnos (alumno_id, aspecto_id, estado, ultima_limpieza)
             VALUES ($1, $2, 'limpio', $3)`,
            [alumno.id, aspectoId, ahora]
          );
        });
        
        marcados++;
      }
    }
    
    // Registrar en el historial de limpiezas del master SOLO UNA VEZ (con alumno_id NULL para indicar que es para todos)
    if (marcados > 0 && !historialRegistrado) {
      try {
        await asegurarTablaHistorial();
        // Usar alumno_id NULL para indicar que es una limpieza global (para todos)
        await query(
          `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
           SELECT NULL, $1, $2, $3, $4, $5
           WHERE NOT EXISTS (
             SELECT 1 FROM limpiezas_master_historial 
             WHERE tipo = $1 AND aspecto_id = $2 AND DATE(fecha_limpieza) = DATE($5)
           )`,
          ['indeseables', aspectoId, aspectoNombre, seccion, ahora]
        );
        historialRegistrado = true;
      } catch (histError) {
        // Si la tabla no existe aún, solo loguear el error pero no fallar
        console.warn('⚠️ Error registrando en historial de limpiezas (puede que la tabla no exista aún):', histError.message);
      }
    }
    
    return { success: true, marcados };
  } catch (error) {
    console.error('Error marcando todos los alumnos como limpios:', error);
    throw error;
  }
}

