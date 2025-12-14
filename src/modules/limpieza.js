// src/modules/limpieza.js
// Lógica de negocio para el sistema de limpieza energética

import { query } from '../../database/pg.js';
import { obtenerSeccionesPorBoton } from '../services/secciones-limpieza.js';

// Función para asegurar que la tabla de historial existe
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
    // Ignorar errores de creación
  }
}

/**
 * Obtiene aspectos para una limpieza según el tipo y nivel del alumno
 * @param {number} alumnoId
 * @param {string} tipoLimpieza - 'rapida', 'basica', 'profunda', 'total'
 * @returns {Promise<Array>}
 */
export async function obtenerAspectosParaLimpieza(alumnoId, tipoLimpieza) {
  try {
    // Obtener nivel del alumno
    const alumno = await query(`
      SELECT nivel_actual FROM alumnos WHERE id = $1
    `, [alumnoId]);
    
    if (alumno.rows.length === 0) return [];
    
    const nivelAlumno = alumno.rows[0].nivel_actual || 1;
    
    // Obtener secciones que deben mostrarse en este botón
    const secciones = await obtenerSeccionesPorBoton(tipoLimpieza);
    const seccionIds = secciones.map(s => s.id);
    
    // Si no hay secciones configuradas, usar NULL para mostrar todos los aspectos
    const seccionIdsParam = seccionIds.length > 0 ? seccionIds : null;
    
    // Obtener aspectos según el tipo de limpieza
    let cantidad;
    switch (tipoLimpieza) {
      case 'rapida':
        cantidad = 3;
        break;
      case 'basica':
        cantidad = 7;
        break;
      case 'profunda':
        cantidad = 15;
        break;
      case 'total':
        cantidad = 999; // Todos
        break;
      default:
        cantidad = 7;
    }
    
    // Para limpiezas regulares: obtener aspectos pendientes
    let aspectosRegulares;
    if (seccionIdsParam === null) {
      // Sin filtro de sección: mostrar todos los aspectos
      aspectosRegulares = await query(`
        SELECT 
          a.id,
          a.nombre,
          a.descripcion_corta,
          a.descripcion,
          a.tipo_limpieza,
          a.nivel_minimo,
          a.seccion_id,
          s.nombre as seccion_nombre,
          COALESCE(ae.ultima_limpieza, NULL) as ultima_limpieza,
          COALESCE(ae.estado, 'pendiente') as estado,
          CASE
            WHEN ae.ultima_limpieza IS NULL THEN NULL
            ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ae.ultima_limpieza))::INT
          END as dias_desde_limpieza,
          COALESCE(a.frecuencia_dias, 14) as frecuencia_dias
        FROM aspectos_energeticos a
        LEFT JOIN secciones_limpieza s ON a.seccion_id = s.id
        LEFT JOIN aspectos_energeticos_alumnos ae ON a.id = ae.aspecto_id AND ae.alumno_id = $1
        WHERE a.activo = true
          AND a.tipo_limpieza = 'regular'
          AND a.nivel_minimo <= $2
          AND (ae.estado IN ('pendiente', 'muy_pendiente') OR ae.estado IS NULL)
        ORDER BY 
          CASE WHEN ae.estado = 'muy_pendiente' THEN 1 ELSE 2 END,
          COALESCE(ae.dias_desde_limpieza, 999) DESC,
          a.prioridad ASC
        LIMIT $3
      `, [alumnoId, nivelAlumno, cantidad]);
    } else {
      // Con filtro de sección
      aspectosRegulares = await query(`
        SELECT 
          a.id,
          a.nombre,
          a.descripcion_corta,
          a.descripcion,
          a.tipo_limpieza,
          a.nivel_minimo,
          a.seccion_id,
          s.nombre as seccion_nombre,
          COALESCE(ae.ultima_limpieza, NULL) as ultima_limpieza,
          COALESCE(ae.estado, 'pendiente') as estado,
          CASE
            WHEN ae.ultima_limpieza IS NULL THEN NULL
            ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - ae.ultima_limpieza))::INT
          END as dias_desde_limpieza,
          COALESCE(a.frecuencia_dias, 14) as frecuencia_dias
        FROM aspectos_energeticos a
        LEFT JOIN secciones_limpieza s ON a.seccion_id = s.id
        LEFT JOIN aspectos_energeticos_alumnos ae ON a.id = ae.aspecto_id AND ae.alumno_id = $1
        WHERE a.activo = true
          AND a.tipo_limpieza = 'regular'
          AND a.nivel_minimo <= $2
          AND (a.seccion_id = ANY($3::int[]) OR a.seccion_id IS NULL)
          AND (ae.estado IN ('pendiente', 'muy_pendiente') OR ae.estado IS NULL)
        ORDER BY 
          CASE WHEN ae.estado = 'muy_pendiente' THEN 1 ELSE 2 END,
          COALESCE(ae.dias_desde_limpieza, 999) DESC,
          a.prioridad ASC
        LIMIT $4
      `, [alumnoId, nivelAlumno, seccionIdsParam, cantidad]);
    }
    
    // Para limpiezas de una vez: obtener aspectos no completados
    let aspectosUnaVez;
    if (seccionIdsParam === null) {
      // Sin filtro de sección
      aspectosUnaVez = await query(`
        SELECT 
          a.id,
          a.nombre,
          a.descripcion_corta,
          a.descripcion,
          a.tipo_limpieza,
          a.nivel_minimo,
          a.cantidad_minima,
          a.seccion_id,
          s.nombre as seccion_nombre,
          COALESCE(ae.cantidad_completada, 0) as cantidad_completada,
          COALESCE(ae.cantidad_requerida, a.cantidad_minima) as cantidad_requerida,
          COALESCE(ae.completado_permanentemente, false) as completado_permanentemente
        FROM aspectos_energeticos a
        LEFT JOIN secciones_limpieza s ON a.seccion_id = s.id
        LEFT JOIN aspectos_energeticos_alumnos ae ON a.id = ae.aspecto_id AND ae.alumno_id = $1
        WHERE a.activo = true
          AND a.tipo_limpieza = 'una_vez'
          AND a.nivel_minimo <= $2
          AND (ae.completado_permanentemente = false OR ae.completado_permanentemente IS NULL)
          AND (COALESCE(ae.cantidad_completada, 0) < COALESCE(ae.cantidad_requerida, a.cantidad_minima, 1))
        ORDER BY 
          (COALESCE(ae.cantidad_requerida, a.cantidad_minima, 1) - COALESCE(ae.cantidad_completada, 0)) DESC,
          a.prioridad ASC
        LIMIT $3
      `, [alumnoId, nivelAlumno, cantidad]);
    } else {
      // Con filtro de sección
      aspectosUnaVez = await query(`
        SELECT 
          a.id,
          a.nombre,
          a.descripcion_corta,
          a.descripcion,
          a.tipo_limpieza,
          a.nivel_minimo,
          a.cantidad_minima,
          a.seccion_id,
          s.nombre as seccion_nombre,
          COALESCE(ae.cantidad_completada, 0) as cantidad_completada,
          COALESCE(ae.cantidad_requerida, a.cantidad_minima) as cantidad_requerida,
          COALESCE(ae.completado_permanentemente, false) as completado_permanentemente
        FROM aspectos_energeticos a
        LEFT JOIN secciones_limpieza s ON a.seccion_id = s.id
        LEFT JOIN aspectos_energeticos_alumnos ae ON a.id = ae.aspecto_id AND ae.alumno_id = $1
        WHERE a.activo = true
          AND a.tipo_limpieza = 'una_vez'
          AND a.nivel_minimo <= $2
          AND (a.seccion_id = ANY($3::int[]) OR a.seccion_id IS NULL)
          AND (ae.completado_permanentemente = false OR ae.completado_permanentemente IS NULL)
          AND (COALESCE(ae.cantidad_completada, 0) < COALESCE(ae.cantidad_requerida, a.cantidad_minima, 1))
        ORDER BY 
          (COALESCE(ae.cantidad_requerida, a.cantidad_minima, 1) - COALESCE(ae.cantidad_completada, 0)) DESC,
          a.prioridad ASC
        LIMIT $4
      `, [alumnoId, nivelAlumno, seccionIdsParam, cantidad]);
    }
    
    // Combinar resultados
    const todos = [
      ...aspectosRegulares.rows.map(a => ({ ...a, es_regular: true })),
      ...aspectosUnaVez.rows.map(a => ({ ...a, es_regular: false }))
    ];
    
    return todos;
  } catch (error) {
    console.error('Error obteniendo aspectos para limpieza:', error);
    return [];
  }
}

/**
 * Marca un aspecto como limpio (por el alumno)
 * @param {number} alumnoId
 * @param {number} aspectoId
 * @param {string} tipoLimpieza - 'rapida', 'basica', 'profunda', 'total'
 * @returns {Promise<Object>}
 */
export async function marcarAspectoLimpio(alumnoId, aspectoId, tipoLimpieza) {
  try {
    // Obtener información del aspecto
    const aspecto = await query(`
      SELECT tipo_limpieza, cantidad_minima, frecuencia_dias
      FROM aspectos_energeticos
      WHERE id = $1
    `, [aspectoId]);
    
    if (aspecto.rows.length === 0) {
      return { success: false, error: 'Aspecto no encontrado' };
    }
    
    const aspectoData = aspecto.rows[0];
    const ahora = new Date();
    
    if (aspectoData.tipo_limpieza === 'regular') {
      // Limpieza regular: actualizar fecha de limpieza
      const proxima = new Date(ahora);
      proxima.setDate(proxima.getDate() + (aspectoData.frecuencia_dias || 14));
      
      await query(`
        INSERT INTO aspectos_energeticos_alumnos 
          (alumno_id, aspecto_id, ultima_limpieza, proxima_limpieza, estado, veces_limpiado)
        VALUES ($1, $2, $3, $4, 'al_dia', 1)
        ON CONFLICT (alumno_id, aspecto_id) DO UPDATE
        SET 
          ultima_limpieza = $3,
          proxima_limpieza = $4,
          estado = 'al_dia',
          veces_limpiado = aspectos_energeticos_alumnos.veces_limpiado + 1,
          updated_at = CURRENT_TIMESTAMP
      `, [alumnoId, aspectoId, ahora, proxima]);
      
      // Registrar en historial del master
      await asegurarTablaHistorial();
      await query(`
        INSERT INTO limpiezas_master_historial 
          (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
        SELECT $1, 'anatomia', $2, a.nombre, s.nombre, $3
        FROM aspectos_energeticos a
        LEFT JOIN secciones_limpieza s ON a.seccion_id = s.id
        WHERE a.id = $2
      `, [alumnoId, aspectoId, ahora]).catch(err => {
        console.warn('Error registrando en historial:', err.message);
      });
      
    } else if (aspectoData.tipo_limpieza === 'una_vez') {
      // Limpieza de una vez: incrementar cantidad completada
      await query(`
        INSERT INTO aspectos_energeticos_alumnos 
          (alumno_id, aspecto_id, cantidad_completada, cantidad_requerida, completado_permanentemente)
        VALUES ($1, $2, 1, $3, false)
        ON CONFLICT (alumno_id, aspecto_id) DO UPDATE
        SET 
          cantidad_completada = aspectos_energeticos_alumnos.cantidad_completada + 1,
          cantidad_requerida = COALESCE(EXCLUDED.cantidad_requerida, aspectos_energeticos_alumnos.cantidad_requerida),
          completado_permanentemente = CASE
            WHEN (aspectos_energeticos_alumnos.cantidad_completada + 1) >= 
                 COALESCE(EXCLUDED.cantidad_requerida, aspectos_energeticos_alumnos.cantidad_requerida, $3, 1)
            THEN true
            ELSE false
          END,
          updated_at = CURRENT_TIMESTAMP
      `, [alumnoId, aspectoId, aspectoData.cantidad_minima]);
      
      // Verificar si está completado permanentemente
      const estado = await query(`
        SELECT cantidad_completada, cantidad_requerida, completado_permanentemente
        FROM aspectos_energeticos_alumnos
        WHERE alumno_id = $1 AND aspecto_id = $2
      `, [alumnoId, aspectoId]);
      
      if (estado.rows.length > 0 && estado.rows[0].completado_permanentemente) {
        // Registrar en historial del master
        await asegurarTablaHistorial();
        await query(`
          INSERT INTO limpiezas_master_historial 
            (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
          SELECT $1, 'anatomia', $2, a.nombre, s.nombre, $3
          FROM aspectos_energeticos a
          LEFT JOIN secciones_limpieza s ON a.seccion_id = s.id
          WHERE a.id = $2
        `, [alumnoId, aspectoId, ahora]).catch(err => {
          console.warn('Error registrando en historial:', err.message);
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error marcando aspecto como limpio:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica si todos los aspectos de una limpieza están completados
 * @param {number} alumnoId
 * @param {string} tipoLimpieza
 * @param {Array<number>} aspectoIds
 * @returns {Promise<boolean>}
 */
export async function verificarLimpiezaCompletada(alumnoId, tipoLimpieza, aspectoIds) {
  try {
    // Para limpiezas regulares: verificar que todos estén marcados como limpios hoy
    const aspectosRegulares = await query(`
      SELECT COUNT(*) as total
      FROM aspectos_energeticos a
      LEFT JOIN aspectos_energeticos_alumnos ae ON a.id = ae.aspecto_id AND ae.alumno_id = $1
      WHERE a.id = ANY($2::int[])
        AND a.tipo_limpieza = 'regular'
        AND (
          ae.ultima_limpieza::date = CURRENT_DATE
          OR (ae.ultima_limpieza IS NULL AND a.id = ANY($2::int[]))
        )
    `, [alumnoId, aspectoIds]);
    
    // Para limpiezas de una vez: verificar que todos estén completados
    const aspectosUnaVez = await query(`
      SELECT COUNT(*) as total
      FROM aspectos_energeticos a
      LEFT JOIN aspectos_energeticos_alumnos ae ON a.id = ae.aspecto_id AND ae.alumno_id = $1
      WHERE a.id = ANY($2::int[])
        AND a.tipo_limpieza = 'una_vez'
        AND (
          ae.completado_permanentemente = true
          OR (COALESCE(ae.cantidad_completada, 0) >= COALESCE(ae.cantidad_requerida, a.cantidad_minima, 1))
        )
    `, [alumnoId, aspectoIds]);
    
    const totalRegulares = parseInt(aspectosRegulares.rows[0]?.total || 0);
    const totalUnaVez = parseInt(aspectosUnaVez.rows[0]?.total || 0);
    const totalEsperado = aspectoIds.length;
    
    return (totalRegulares + totalUnaVez) >= totalEsperado;
  } catch (error) {
    console.error('Error verificando limpieza completada:', error);
    return false;
  }
}

/**
 * Obtiene el nombre del tipo de limpieza
 * @param {string} tipoLimpieza
 * @returns {string}
 */
export function getNombreLimpieza(tipoLimpieza) {
  const nombres = {
    'rapida': 'Limpieza Rápida',
    'basica': 'Limpieza Básica',
    'profunda': 'Limpieza Profunda',
    'total': 'Limpieza Total'
  };
  return nombres[tipoLimpieza] || tipoLimpieza;
}

