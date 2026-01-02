// src/services/transmutaciones-proyectos-admin-service.js
// Servicio canónico para gestión de proyectos en UI Admin
// Source of Truth: transmutaciones_proyectos, transmutaciones_proyectos_estado

import { query } from '../../database/pg.js';
import { logError, logInfo } from '../core/observability/logger.js';

const DOMAIN = 'TransmutacionesProyectosAdminService';

/**
 * Obtiene lista de alumnos para dropdowns (id, nombre_completo, apodo, email)
 * @returns {Promise<Array>} Lista de alumnos
 */
export async function listarAlumnos() {
  try {
    const result = await query(`
      SELECT 
        id,
        nombre_completo,
        apodo,
        email
      FROM alumnos
      WHERE estado_suscripcion = 'activa'
      ORDER BY nombre_completo ASC, apodo ASC, email ASC
    `);
    return result.rows || [];
  } catch (error) {
    logError(DOMAIN, 'Error listando alumnos', { error: error.message });
    return [];
  }
}

/**
 * Obtiene todos los proyectos ACTIVOS con información del creador
 * y estado calculado (limpio/no limpio)
 * 
 * @returns {Promise<Array>} Lista de proyectos activos
 */
export async function listarProyectosActivos() {
  try {
    // Intentar obtener datos de student_item_state primero (nuevo sistema)
    // Si no hay datos, usar tablas legacy como fallback
    const result = await query(`
      SELECT 
        tp.id,
        tp.nombre,
        tp.descripcion,
        tp.frecuencia_dias as recommended_recurrence_days,
        tp.activo as is_active,
        tp.created_at,
        tp.updated_at,
        tp.alumno_id,
        a.id as created_by_student_id,
        a.nombre_completo as created_by_nombre,
        a.apodo as created_by_apodo,
        a.email as created_by_email,
        -- Intentar obtener last_cleaned_at de student_item_state (nuevo sistema)
        sis.last_cleaned_at,
        sis.per_item_config->>'recurrence_days' as per_item_recurrence_days,
        -- Fallback: estado legacy
        CASE
          WHEN tp.alumno_id IS NOT NULL THEN (
            CASE
              WHEN EXISTS (
                SELECT 1 FROM transmutaciones_proyectos_estado tpe
                WHERE tpe.proyecto_id = tp.id
                  AND tpe.alumno_id = tp.alumno_id
                  AND tpe.estado = 'limpio'
                  AND tpe.ultima_limpieza IS NOT NULL
                  AND EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT <= tp.frecuencia_dias
                LIMIT 1
              ) THEN 'LIMPIO'
              ELSE 'NO LIMPIO'
            END
          )
          ELSE 'NO LIMPIO'
        END as estado_legacy
      FROM transmutaciones_proyectos tp
      LEFT JOIN alumnos a ON tp.alumno_id = a.id
      LEFT JOIN student_item_state sis ON sis.student_id = tp.alumno_id
        AND sis.product_key = 'pde'
        AND sis.domain_type = 'project'
        AND sis.item_ref = CAST(tp.id AS TEXT)
      WHERE tp.activo = true
        AND (tp.deleted_at IS NULL)
      ORDER BY tp.nombre ASC, tp.created_at DESC
    `);
    
    return result.rows || [];
  } catch (error) {
    logError(DOMAIN, 'Error listando proyectos activos', { 
      error: error.message,
      stack: error.stack 
    });
    // Retornar array vacío en lugar de lanzar error
    return [];
  }
}

/**
 * Marca un proyecto específico como limpio para todos los alumnos que lo tienen activo
 * 
 * @param {number} proyectoId - ID del proyecto
 * @returns {Promise<{success: boolean, marcados?: number, error?: string}>}
 */
export async function limpiarProyecto(proyectoId) {
  try {
    // Obtener información del proyecto
    const proyectoResult = await query(`
      SELECT nombre, frecuencia_dias 
      FROM transmutaciones_proyectos 
      WHERE id = $1 AND activo = true
    `, [proyectoId]);
    
    if (proyectoResult.rows.length === 0) {
      return { success: false, error: 'Proyecto no encontrado o no activo' };
    }
    
    const proyecto = proyectoResult.rows[0];
    const ahora = new Date();
    let marcados = 0;
    
    // Obtener todos los alumnos que tienen acceso a este proyecto
    const alumnosResult = await query(`
      SELECT DISTINCT a.id
      FROM alumnos a
      CROSS JOIN transmutaciones_proyectos tp
      WHERE tp.id = $1
        AND tp.activo = true
        AND a.estado_suscripcion = 'activa'
        AND (tp.alumno_id IS NULL OR tp.alumno_id = a.id)
    `, [proyectoId]);
    
    for (const alumno of alumnosResult.rows) {
      // Verificar si existe registro de estado
      const existeEstado = await query(`
        SELECT id FROM transmutaciones_proyectos_estado
        WHERE proyecto_id = $1 AND alumno_id = $2
      `, [proyectoId, alumno.id]);
      
      if (existeEstado.rows.length > 0) {
        // Actualizar registro existente
        await query(`
          UPDATE transmutaciones_proyectos_estado
          SET estado = 'limpio',
              ultima_limpieza = $1,
              veces_limpiado = COALESCE(veces_limpiado, 0) + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE proyecto_id = $2 AND alumno_id = $3
        `, [ahora, proyectoId, alumno.id]);
      } else {
        // Crear nuevo registro
        await query(`
          INSERT INTO transmutaciones_proyectos_estado 
            (proyecto_id, alumno_id, estado, ultima_limpieza, veces_limpiado)
          VALUES ($1, $2, 'limpio', $3, 1)
        `, [proyectoId, alumno.id, ahora]);
      }
      
      // Registrar en historial de limpiezas del master
      try {
        await query(`
          INSERT INTO limpiezas_master_historial 
            (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
          VALUES ($1, 'proyectos', $2, $3, 'Transmutaciones PDE - Proyectos', $4)
          ON CONFLICT DO NOTHING
        `, [alumno.id, proyectoId, proyecto.nombre, ahora]);
      } catch (histError) {
        // Ignorar errores de historial (puede que la tabla no exista o haya conflicto)
        logInfo(DOMAIN, 'Error registrando en historial (no crítico)', { error: histError.message });
      }
      
      marcados++;
    }
    
    logInfo(DOMAIN, 'Proyecto limpiado', { proyectoId, marcados });
    return { success: true, marcados };
  } catch (error) {
    logError(DOMAIN, 'Error limpiando proyecto', { proyectoId, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Marca TODOS los proyectos activos como limpios
 * 
 * @returns {Promise<{success: boolean, marcados?: number, error?: string}>}
 */
export async function limpiarTodosLosProyectos() {
  try {
    // Obtener todos los proyectos activos
    const proyectosResult = await query(`
      SELECT id, nombre
      FROM transmutaciones_proyectos
      WHERE activo = true AND (deleted_at IS NULL)
    `);
    
    const ahora = new Date();
    let totalMarcados = 0;
    
    for (const proyecto of proyectosResult.rows) {
      const resultado = await limpiarProyecto(proyecto.id);
      if (resultado.success) {
        totalMarcados += resultado.marcados || 0;
      }
    }
    
    logInfo(DOMAIN, 'Todos los proyectos limpiados', { totalMarcados });
    return { success: true, marcados: totalMarcados };
  } catch (error) {
    logError(DOMAIN, 'Error limpiando todos los proyectos', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Crea un nuevo proyecto
 * 
 * @param {Object} datos - Datos del proyecto
 * @param {string} datos.nombre - Nombre del proyecto
 * @param {string} [datos.descripcion] - Descripción
 * @param {number} [datos.frecuencia_dias=30] - Recurrencia recomendada en días
 * @param {number} [datos.created_by_student_id] - ID del alumno creador (opcional)
 * @param {boolean} [datos.activo=true] - Si el proyecto está activo
 * @returns {Promise<{success: boolean, id?: number, error?: string}>}
 */
export async function crearProyecto(datos) {
  try {
    const { nombre, descripcion = null, frecuencia_dias = 30, created_by_student_id = null, activo = true } = datos;
    
    if (!nombre || nombre.trim().length === 0) {
      return { success: false, error: 'El nombre es requerido' };
    }
    
    // Validación: si se crea activo y tiene alumno_id, verificar que el alumno no tenga otro proyecto activo
    if (activo && created_by_student_id) {
      const proyectoExistente = await query(`
        SELECT id FROM transmutaciones_proyectos
        WHERE alumno_id = $1 AND activo = true AND (deleted_at IS NULL)
        LIMIT 1
      `, [created_by_student_id]);
      
      if (proyectoExistente.rows.length > 0) {
        return { success: false, error: 'El alumno ya tiene un proyecto activo. Solo puede tener uno activo a la vez.' };
      }
    }
    
    const result = await query(`
      INSERT INTO transmutaciones_proyectos 
        (nombre, descripcion, frecuencia_dias, activo, alumno_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [nombre.trim(), descripcion, frecuencia_dias, activo, created_by_student_id]);
    
    const id = result.rows[0].id;
    logInfo(DOMAIN, 'Proyecto creado', { id, nombre, activo });
    return { success: true, id };
  } catch (error) {
    logError(DOMAIN, 'Error creando proyecto', { datos, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Limpia múltiples proyectos seleccionados
 * 
 * @param {number[]} proyectoIds - Array de IDs de proyectos
 * @returns {Promise<{success: boolean, marcados?: number, error?: string}>}
 */
export async function limpiarProyectosSeleccionados(proyectoIds) {
  try {
    if (!Array.isArray(proyectoIds) || proyectoIds.length === 0) {
      return { success: false, error: 'Array de IDs de proyectos requerido' };
    }
    
    let totalMarcados = 0;
    
    for (const proyectoId of proyectoIds) {
      const resultado = await limpiarProyecto(proyectoId);
      if (resultado.success) {
        totalMarcados += resultado.marcados || 0;
      }
    }
    
    logInfo(DOMAIN, 'Proyectos seleccionados limpiados', { total: proyectoIds.length, marcados: totalMarcados });
    return { success: true, marcados: totalMarcados };
  } catch (error) {
    logError(DOMAIN, 'Error limpiando proyectos seleccionados', { proyectoIds, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Actualiza la recurrencia recomendada de un proyecto
 * 
 * @param {number} proyectoId - ID del proyecto
 * @param {number} frecuencia_dias - Nueva recurrencia en días
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function actualizarRecurrenciaProyecto(proyectoId, frecuencia_dias) {
  try {
    if (!frecuencia_dias || frecuencia_dias < 1) {
      return { success: false, error: 'La recurrencia debe ser un número positivo' };
    }
    
    const result = await query(`
      UPDATE transmutaciones_proyectos
      SET frecuencia_dias = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND activo = true
      RETURNING id
    `, [frecuencia_dias, proyectoId]);
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Proyecto no encontrado o no activo' };
    }
    
    logInfo(DOMAIN, 'Recurrencia actualizada', { proyectoId, frecuencia_dias });
    return { success: true };
  } catch (error) {
    logError(DOMAIN, 'Error actualizando recurrencia', { proyectoId, frecuencia_dias, error: error.message });
    return { success: false, error: error.message };
  }
}

