// src/services/aspectos-energeticos.js
// Servicio para gestión de aspectos energéticos a limpiar (PRIORITARIO)

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

/**
 * Lista todos los aspectos energéticos globales
 * @returns {Promise<Array>}
 */
export async function listarAspectosGlobales() {
  try {
    // Intentar con nivel_minimo primero
    try {
      const result = await query(`
        SELECT *, COALESCE(nivel_minimo, 1) as nivel_minimo
        FROM aspectos_energeticos
        WHERE activo = true
        ORDER BY COALESCE(nivel_minimo, 1) ASC, orden ASC, nombre ASC
      `);
      return result.rows;
    } catch (err) {
      // Si la columna no existe, ordenar sin nivel_minimo
      if (err.message.includes('nivel_minimo')) {
        const result = await query(`
          SELECT *, 1 as nivel_minimo
          FROM aspectos_energeticos
          WHERE activo = true
          ORDER BY orden ASC, nombre ASC
        `);
        return result.rows;
      }
      throw err;
    }
  } catch (error) {
    console.error('Error listando aspectos globales:', error);
    return [];
  }
}

/**
 * Crea un aspecto rápidamente (solo con nombre)
 * @param {string} nombre 
 * @param {number} nivel_minimo - Nivel mínimo requerido (default: 1)
 * @returns {Promise<number>} - ID del aspecto creado
 */
export async function crearAspectoRapido(nombre, nivel_minimo = 1) {
  try {
    // INSERT directo - la columna nivel_minimo debe existir (creada en migración)
    const result = await query(`
      INSERT INTO aspectos_energeticos (nombre, frecuencia_dias, prioridad, nivel_minimo)
      VALUES ($1, 14, 3, $2)
      RETURNING id
    `, [nombre, nivel_minimo]);

    await analytics.registrarEvento({
      tipo_evento: 'aspecto_energetico_creado',
      metadata: { aspecto_id: result.rows[0].id, nombre, nivel_minimo }
    });

    return result.rows[0].id;
  } catch (error) {
    console.error('❌ Error creando aspecto rápido:', error);
    throw error;
  }
}


/**
 * Actualiza detalles de un aspecto
 * @param {number} aspectoId 
 * @param {Object} datos 
 * @returns {Promise<boolean>}
 */
export async function actualizarAspectoDetalle(aspectoId, datos) {
  if (!datos || typeof datos !== 'object') {
    throw new Error('Los datos proporcionados deben ser un objeto');
  }
  
  const updates = [];
  const params = [];
  let paramIndex = 1;
  
  const { nombre, descripcion, descripcion_corta, categoria, frecuencia_dias, prioridad, activo, orden, nivel_minimo, cantidad_minima, seccion_id, tipo_limpieza } = datos;

  // Construir updates directamente - las columnas ya existen (creadas en migración)
  if (nombre !== undefined) {
    updates.push(`nombre = $${paramIndex++}`);
    params.push(nombre);
  }
  if (descripcion !== undefined) {
    updates.push(`descripcion = $${paramIndex++}`);
    params.push(descripcion);
  }
  if (descripcion_corta !== undefined) {
    updates.push(`descripcion_corta = $${paramIndex++}`);
    params.push(descripcion_corta);
  }
  if (categoria !== undefined) {
    updates.push(`categoria = $${paramIndex++}`);
    params.push(categoria);
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
  if (cantidad_minima !== undefined) {
    updates.push(`cantidad_minima = $${paramIndex++}`);
    params.push(cantidad_minima);
  }
  if (seccion_id !== undefined) {
    updates.push(`seccion_id = $${paramIndex++}`);
    params.push(seccion_id);
  }
  if (tipo_limpieza !== undefined) {
    updates.push(`tipo_limpieza = $${paramIndex++}`);
    params.push(tipo_limpieza);
  }

  if (updates.length === 0) {
    console.warn('⚠️ No hay campos para actualizar');
    return true;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(aspectoId);

  const updateQuery = `
    UPDATE aspectos_energeticos
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
  `;
  
  console.log('🔧 Ejecutando UPDATE:', updateQuery);
  console.log('🔧 Parámetros:', params);
  
  try {
    await query(updateQuery, params);
    console.log('✅ Aspecto actualizado correctamente');
    return true;
  } catch (updateError) {
    console.error('❌ Error actualizando aspecto:', updateError);
    console.error('❌ Query:', updateQuery);
    console.error('❌ Parámetros:', params);
    // Lanzar error real - no más fallbacks silenciosos
    throw updateError;
  }
}

/**
 * Obtiene aspectos de un alumno con estado calculado
 * @param {number} alumnoId 
 * @returns {Promise<Array>}
 */
export async function getAspectosAlumno(alumnoId) {
  try {
    // Primero, asegurar que el alumno tiene registro de todos los aspectos activos
    await query(`
      INSERT INTO aspectos_energeticos_alumnos (alumno_id, aspecto_id, estado)
      SELECT $1, id, 'pendiente'
      FROM aspectos_energeticos
      WHERE activo = true
        AND id NOT IN (
          SELECT aspecto_id FROM aspectos_energeticos_alumnos WHERE alumno_id = $1
        )
    `, [alumnoId]);

    // Calcular estados
    await query(`
      UPDATE aspectos_energeticos_alumnos ae
      SET 
        proxima_limpieza = COALESCE(
          ae.ultima_limpieza + INTERVAL '1 day' * a.frecuencia_dias,
          CURRENT_TIMESTAMP
        ),
        estado = CASE
          WHEN ae.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN CURRENT_TIMESTAMP <= (ae.ultima_limpieza + INTERVAL '1 day' * a.frecuencia_dias) THEN 'al_dia'
          WHEN CURRENT_TIMESTAMP <= (ae.ultima_limpieza + INTERVAL '1 day' * a.frecuencia_dias * 2) THEN 'pendiente'
          ELSE 'muy_pendiente'
        END
      FROM aspectos_energeticos a
      WHERE ae.aspecto_id = a.id
        AND ae.alumno_id = $1
    `, [alumnoId]);

    // Obtener aspectos con estado
    const result = await query(`
      SELECT 
        a.*,
        ae.ultima_limpieza,
        ae.proxima_limpieza,
        ae.estado,
        ae.veces_limpiado,
        CASE
          WHEN ae.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM CURRENT_TIMESTAMP - ae.ultima_limpieza)::INTEGER
        END as dias_desde_ultima_limpieza
      FROM aspectos_energeticos a
      JOIN aspectos_energeticos_alumnos ae ON a.id = ae.aspecto_id
      WHERE a.activo = true
        AND ae.alumno_id = $1
      ORDER BY 
        CASE ae.estado
          WHEN 'muy_pendiente' THEN 1
          WHEN 'pendiente' THEN 2
          WHEN 'al_dia' THEN 3
        END,
        a.prioridad ASC,
        ae.proxima_limpieza ASC
    `, [alumnoId]);

    return result.rows;
  } catch (error) {
    console.error('Error obteniendo aspectos del alumno:', error);
    return [];
  }
}

/**
 * Marca una limpieza de aspecto
 * @param {number} alumnoId 
 * @param {number} aspectoId 
 * @param {string} modo - 'basica', 'media', 'profunda', 'total', 'rescate'
 * @param {string} origen 
 * @param {string} notas 
 * @returns {Promise<boolean>}
 */
export async function marcarLimpieza(alumnoId, aspectoId, modo, origen = 'portal', notas = '') {
  try {
    // Obtener frecuencia del aspecto
    const aspecto = await query(`SELECT frecuencia_dias FROM aspectos_energeticos WHERE id = $1`, [aspectoId]);
    if (aspecto.rows.length === 0) return false;

    const frecuenciaDias = aspecto.rows[0].frecuencia_dias;
    const ahora = new Date();
    const proxima = new Date(ahora);
    proxima.setDate(proxima.getDate() + frecuenciaDias);

    // Actualizar registro del alumno
    await query(`
      INSERT INTO aspectos_energeticos_alumnos (alumno_id, aspecto_id, ultima_limpieza, proxima_limpieza, estado, veces_limpiado)
      VALUES ($1, $2, $3, $4, 'al_dia', 1)
      ON CONFLICT (alumno_id, aspecto_id) DO UPDATE
      SET 
        ultima_limpieza = $3,
        proxima_limpieza = $4,
        estado = 'al_dia',
        veces_limpiado = aspectos_energeticos_alumnos.veces_limpiado + 1
    `, [alumnoId, aspectoId, ahora, proxima]);

    // Registrar en histórico
    await query(`
      INSERT INTO aspectos_energeticos_registros (alumno_id, aspecto_id, fecha, modo_limpieza, origen, notas)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [alumnoId, aspectoId, ahora, modo, origen, notas]);

    // Registrar evento analytics
    await analytics.registrarEvento({
      alumno_id: alumnoId,
      tipo_evento: 'limpieza_aspecto',
      metadata: { aspecto_id: aspectoId, modo, origen }
    });

    return true;
  } catch (error) {
    console.error('Error marcando limpieza:', error);
    return false;
  }
}

/**
 * Selecciona aspectos para una limpieza según el tipo
 * @param {number} alumnoId 
 * @param {string} tipoLimpieza - 'basica', 'media', 'profunda', 'total', 'rescate'
 * @returns {Promise<Array>}
 */
export async function seleccionarAspectosParaLimpieza(alumnoId, tipoLimpieza) {
  try {
    const aspectos = await getAspectosAlumno(alumnoId);

    // Filtrar solo pendientes y muy pendientes
    const pendientes = aspectos.filter(a => 
      a.estado === 'pendiente' || a.estado === 'muy_pendiente'
    );

    // Ordenar por: muy_pendiente primero, luego días de retraso, luego prioridad
    pendientes.sort((a, b) => {
      if (a.estado === 'muy_pendiente' && b.estado !== 'muy_pendiente') return -1;
      if (a.estado !== 'muy_pendiente' && b.estado === 'muy_pendiente') return 1;
      
      const diasA = a.dias_desde_ultima_limpieza || 999;
      const diasB = b.dias_desde_ultima_limpieza || 999;
      if (diasA !== diasB) return diasB - diasA;
      
      return a.prioridad - b.prioridad;
    });

    // Determinar cantidad según tipo
    let cantidad;
    switch (tipoLimpieza) {
      case 'basica':
        cantidad = 7;
        break;
      case 'media':
        cantidad = 20;
        break;
      case 'profunda':
        cantidad = 40;
        break;
      case 'total':
      case 'rescate':
        cantidad = pendientes.length; // Todos
        break;
      default:
        cantidad = 7;
    }

    // Si es rescate, priorizar aspectos críticos (prioridad 1) y muy pendientes
    if (tipoLimpieza === 'rescate') {
      const criticos = pendientes.filter(a => a.prioridad === 1 || a.estado === 'muy_pendiente');
      const otros = pendientes.filter(a => !criticos.includes(a));
      return [...criticos.slice(0, Math.min(5, criticos.length)), ...otros.slice(0, Math.max(0, cantidad - criticos.length))];
    }

    return pendientes.slice(0, cantidad);
  } catch (error) {
    console.error('Error seleccionando aspectos para limpieza:', error);
    return [];
  }
}

/**
 * Obtiene estadísticas de limpieza del alumno
 * @param {number} alumnoId 
 * @returns {Promise<Object>}
 */
export async function getEstadisticasLimpieza(alumnoId) {
  try {
    const aspectos = await getAspectosAlumno(alumnoId);
    
    const alDia = aspectos.filter(a => a.estado === 'al_dia').length;
    const pendientes = aspectos.filter(a => a.estado === 'pendiente').length;
    const muyPendientes = aspectos.filter(a => a.estado === 'muy_pendiente').length;

    let estadoGeneral = 'limpia';
    if (muyPendientes > 0) estadoGeneral = 'muy_pendiente';
    else if (pendientes > 0) estadoGeneral = 'algo_pendiente';

    return {
      total: aspectos.length,
      al_dia: alDia,
      pendientes: pendientes,
      muy_pendientes: muyPendientes,
      estado_general: estadoGeneral
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return { total: 0, al_dia: 0, pendientes: 0, muy_pendientes: 0, estado_general: 'limpia' };
  }
}

/**
 * Obtiene todos los alumnos que tienen un aspecto específico con su estado
 * @param {number} aspectoId 
 * @returns {Promise<Array>} - Array de objetos con información del alumno y estado del aspecto
 */
export async function getAlumnosPorAspecto(aspectoId) {
  try {
    const result = await query(`
      SELECT 
        a.id as alumno_id,
        a.email,
        a.apodo,
        a.nombre_completo,
        a.nivel_actual,
        aea.ultima_limpieza,
        aea.estado,
        aea.veces_limpiado,
        ae.nombre as aspecto_nombre,
        ae.frecuencia_dias,
        CASE
          WHEN aea.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - aea.ultima_limpieza))::INT
        END as dias_desde_limpieza,
        CASE
          WHEN aea.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - aea.ultima_limpieza))::INT <= ae.frecuencia_dias THEN 'limpio'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - aea.ultima_limpieza))::INT <= 15 THEN 'pendiente'
          ELSE 'olvidado'
        END as estado_calculado
      FROM alumnos a
      CROSS JOIN aspectos_energeticos ae
      LEFT JOIN aspectos_energeticos_alumnos aea ON aea.alumno_id = a.id AND aea.aspecto_id = ae.id
      WHERE ae.id = $1
        AND a.nivel_actual >= COALESCE(ae.nivel_minimo, 1)
      ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
    `, [aspectoId]);
    
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo alumnos por aspecto:', error);
    return [];
  }
}

/**
 * Marca todos los alumnos de un aspecto específico como limpios
 * @param {number} aspectoId 
 * @returns {Promise<Object>}
 */
export async function marcarTodosAlumnosLimpiosPorAspecto(aspectoId) {
  try {
    // Obtener el nombre del aspecto para el historial
    const aspectoResult = await query('SELECT nombre FROM aspectos_energeticos WHERE id = $1', [aspectoId]);
    const aspectoNombre = aspectoResult.rows[0]?.nombre || null;
    const seccion = 'Anatomía Energética';
    
    // Obtener todos los alumnos activos que pueden ver este aspecto
    const alumnos = await query(`
      SELECT DISTINCT a.id
      FROM alumnos a
      CROSS JOIN aspectos_energeticos ae
      WHERE ae.id = $1
        AND a.estado_suscripcion = 'activa'
        AND (COALESCE(ae.nivel_minimo, 1) <= a.nivel_actual)
    `, [aspectoId]);
    
    const ahora = new Date();
    let marcados = 0;
    let historialRegistrado = false; // Flag para registrar solo una vez en el historial
    
    // Obtener frecuencia del aspecto para calcular próxima fecha
    const aspecto = await query(`SELECT frecuencia_dias FROM aspectos_energeticos WHERE id = $1`, [aspectoId]);
    const frecuenciaDias = aspecto.rows[0]?.frecuencia_dias || 14;
    const proxima = new Date(ahora);
    proxima.setDate(proxima.getDate() + frecuenciaDias);
    
    for (const alumno of alumnos.rows) {
      // Verificar si existe el registro
      const existe = await query(
        `SELECT id FROM aspectos_energeticos_alumnos WHERE alumno_id = $1 AND aspecto_id = $2`,
        [alumno.id, aspectoId]
      );
      
      if (existe.rows.length > 0) {
        // Actualizar registro existente
        await query(
          `UPDATE aspectos_energeticos_alumnos 
           SET estado = 'al_dia', 
               ultima_limpieza = $1,
               proxima_limpieza = $2,
               veces_limpiado = COALESCE(veces_limpiado, 0) + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE alumno_id = $3 AND aspecto_id = $4`,
          [ahora, proxima, alumno.id, aspectoId]
        );
        
        marcados++;
      } else {
        // Crear nuevo registro
        await query(
          `INSERT INTO aspectos_energeticos_alumnos (alumno_id, aspecto_id, estado, ultima_limpieza, proxima_limpieza, veces_limpiado)
           VALUES ($1, $2, 'al_dia', $3, $4, 1)`,
          [alumno.id, aspectoId, ahora, proxima]
        );
        
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
          ['anatomia', aspectoId, aspectoNombre, seccion, ahora]
        );
        historialRegistrado = true;
      } catch (histError) {
        console.warn('⚠️ Error registrando en historial de limpiezas:', histError.message);
      }
    }
    
    return { success: true, marcados };
  } catch (error) {
    console.error('Error marcando todos los alumnos como limpios:', error);
    throw error;
  }
}



