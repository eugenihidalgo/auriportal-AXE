// src/services/pde-limpiezas-master.js
// Servicio para limpiezas masivas del Master en catálogos PDE
//
// REGLAS:
// 1. SIEMPRE usar nivel_efectivo
// 2. SIEMPRE registrar en auditoría
// 3. SIEMPRE registrar en historial de limpiezas
// 4. Soft delete (nunca borrar físicamente)
// 5. Fail-open en lectura, fail-closed en escritura

import { query } from '../../database/pg.js';
import { logAuditEvent } from '../core/audit/audit-service.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';

const DOMAIN = 'PdeLimpiezasMaster';

// Mapeo de tipos a tablas y columnas
const TIPO_CONFIG = {
  lugares: {
    tablaBase: 'transmutaciones_lugares',
    tablaEstado: 'transmutaciones_lugares_estado',
    fkColumna: 'lugar_id',
    nombreColumna: 'nombre',
    seccion: 'Transmutaciones PDE - Lugares'
  },
  proyectos: {
    tablaBase: 'transmutaciones_proyectos',
    tablaEstado: 'transmutaciones_proyectos_estado',
    fkColumna: 'proyecto_id',
    nombreColumna: 'nombre',
    seccion: 'Transmutaciones PDE - Proyectos'
  },
  apadrinados: {
    tablaBase: 'transmutaciones_apadrinados',
    tablaEstado: 'transmutaciones_apadrinados_estado',
    fkColumna: 'apadrinado_id',
    nombreColumna: 'nombre',
    seccion: 'Transmutaciones PDE - Apadrinados'
  }
};

/**
 * Obtiene el nivel_efectivo de un alumno
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<number>} Nivel efectivo (1-12)
 */
async function getNivelEfectivoAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT 
        COALESCE(
          (SELECT nivel FROM nivel_overrides WHERE alumno_id = $1 AND activo = true ORDER BY created_at DESC LIMIT 1),
          nivel_actual
        ) as nivel_efectivo
      FROM alumnos 
      WHERE id = $1
    `, [alumnoId]);
    
    return result.rows[0]?.nivel_efectivo || 1;
  } catch (error) {
    // Fallback: obtener nivel_actual directamente
    try {
      const fallback = await query('SELECT nivel_actual FROM alumnos WHERE id = $1', [alumnoId]);
      return fallback.rows[0]?.nivel_actual || 1;
    } catch {
      return 1;
    }
  }
}

/**
 * Verifica que el alumno tiene suscripción activa y no está en pausa
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<{valido: boolean, razon?: string}>}
 */
async function validarSuscripcionAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT 
        estado_suscripcion,
        EXISTS(
          SELECT 1 FROM pausas 
          WHERE alumno_id = $1 AND activa = true
        ) as tiene_pausa
      FROM alumnos
      WHERE id = $1
    `, [alumnoId]);
    
    if (result.rows.length === 0) {
      return { valido: false, razon: 'Alumno no encontrado' };
    }
    
    const alumno = result.rows[0];
    
    if (alumno.estado_suscripcion !== 'activa') {
      return { valido: false, razon: `Suscripción no activa: ${alumno.estado_suscripcion}` };
    }
    
    if (alumno.tiene_pausa) {
      return { valido: false, razon: 'El alumno está en pausa' };
    }
    
    return { valido: true };
  } catch (error) {
    logWarn(DOMAIN, 'Error validando suscripción, asumiendo válida', { error: error.message });
    return { valido: true }; // Fail-open en lectura
  }
}

/**
 * Obtiene todos los items activos de un tipo para un alumno
 * @param {string} tipo - 'lugares' | 'proyectos' | 'apadrinados'
 * @param {number} alumnoId - ID del alumno
 * @param {number} nivelEfectivo - Nivel efectivo del alumno
 * @returns {Promise<Array>} Items disponibles
 */
async function obtenerItemsActivos(tipo, alumnoId, nivelEfectivo) {
  const config = TIPO_CONFIG[tipo];
  if (!config) {
    throw new Error(`Tipo no válido: ${tipo}`);
  }
  
  try {
    const result = await query(`
      SELECT 
        tb.id,
        tb.${config.nombreColumna} as nombre,
        tb.frecuencia_dias,
        te.ultima_limpieza,
        te.veces_limpiado
      FROM ${config.tablaBase} tb
      LEFT JOIN ${config.tablaEstado} te 
        ON tb.id = te.${config.fkColumna} AND te.alumno_id = $1
      WHERE tb.activo = true
        AND (tb.deleted_at IS NULL)
        AND (COALESCE(tb.nivel_minimo, 1) <= $2)
        AND (tb.alumno_id IS NULL OR tb.alumno_id = $1)
      ORDER BY COALESCE(tb.nivel_minimo, 1) ASC, tb.orden ASC, tb.nombre ASC
    `, [alumnoId, nivelEfectivo]);
    
    return result.rows || [];
  } catch (error) {
    // Si la tabla no existe o hay error, devolver array vacío (fail-open)
    logWarn(DOMAIN, `Error obteniendo ${tipo}`, { error: error.message });
    return [];
  }
}

/**
 * Actualiza la limpieza de un item específico
 * @param {string} tipo - 'lugares' | 'proyectos' | 'apadrinados'
 * @param {number} itemId - ID del item
 * @param {number} alumnoId - ID del alumno
 * @param {Date} fechaLimpieza - Fecha de la limpieza
 * @returns {Promise<boolean>} True si se actualizó correctamente
 */
async function actualizarLimpiezaItem(tipo, itemId, alumnoId, fechaLimpieza) {
  const config = TIPO_CONFIG[tipo];
  if (!config) {
    throw new Error(`Tipo no válido: ${tipo}`);
  }
  
  try {
    // Verificar si existe registro de estado
    const existeEstado = await query(`
      SELECT id FROM ${config.tablaEstado}
      WHERE ${config.fkColumna} = $1 AND alumno_id = $2
    `, [itemId, alumnoId]);
    
    if (existeEstado.rows.length > 0) {
      // Actualizar existente
      await query(`
        UPDATE ${config.tablaEstado}
        SET estado = 'limpio',
            ultima_limpieza = $1,
            veces_limpiado = COALESCE(veces_limpiado, 0) + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE ${config.fkColumna} = $2 AND alumno_id = $3
      `, [fechaLimpieza, itemId, alumnoId]);
    } else {
      // Crear nuevo
      await query(`
        INSERT INTO ${config.tablaEstado} 
          (${config.fkColumna}, alumno_id, estado, ultima_limpieza, veces_limpiado)
        VALUES ($1, $2, 'limpio', $3, 1)
      `, [itemId, alumnoId, fechaLimpieza]);
    }
    
    return true;
  } catch (error) {
    logError(DOMAIN, `Error actualizando limpieza de ${tipo}`, {
      itemId,
      alumnoId,
      error: error.message
    });
    return false;
  }
}

/**
 * Registra en el historial de limpiezas del master
 * @param {Object} params - Parámetros
 */
async function registrarHistorialLimpieza({ alumnoId, tipo, itemId, itemNombre, seccion, accion, metadata }) {
  try {
    await query(`
      INSERT INTO limpiezas_master_historial 
        (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, accion, metadata, fecha_limpieza)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [alumnoId, tipo, itemId, itemNombre, seccion, accion, JSON.stringify(metadata || {})]);
  } catch (error) {
    logWarn(DOMAIN, 'Error registrando en historial', { error: error.message });
    // No fallar si no se puede registrar historial
  }
}

/**
 * Marca TODOS los items de un tipo como limpios para un alumno específico
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.alumnoId - ID del alumno
 * @param {string} params.tipo - 'lugares' | 'proyectos' | 'apadrinados'
 * @param {number} [params.masterId] - ID del master que ejecuta la acción (para auditoría)
 * @param {Request} [params.req] - Request object para auditoría
 * @returns {Promise<{success: boolean, total_items: number, actualizados: number, tipo: string, errores?: string[]}>}
 */
export async function marcarTodoComoLimpio({ alumnoId, tipo, masterId = null, req = null }) {
  const tipoNormalizado = tipo.toLowerCase();
  const config = TIPO_CONFIG[tipoNormalizado];
  
  if (!config) {
    return {
      success: false,
      total_items: 0,
      actualizados: 0,
      tipo: tipoNormalizado,
      errores: [`Tipo no válido: ${tipo}. Tipos válidos: lugares, proyectos, apadrinados`]
    };
  }
  
  logInfo(DOMAIN, `[PDE][MASTER][${tipoNormalizado.toUpperCase()}][MARCAR_TODO_LIMPIO] Iniciando`, {
    alumno_id: alumnoId,
    tipo: tipoNormalizado,
    master_id: masterId
  });
  
  const errores = [];
  
  try {
    // 1. Validar suscripción
    const validacion = await validarSuscripcionAlumno(alumnoId);
    if (!validacion.valido) {
      return {
        success: false,
        total_items: 0,
        actualizados: 0,
        tipo: tipoNormalizado,
        errores: [validacion.razon]
      };
    }
    
    // 2. Obtener nivel efectivo
    const nivelEfectivo = await getNivelEfectivoAlumno(alumnoId);
    
    // 3. Obtener todos los items activos
    const items = await obtenerItemsActivos(tipoNormalizado, alumnoId, nivelEfectivo);
    
    if (items.length === 0) {
      logInfo(DOMAIN, `No hay ${tipoNormalizado} activos para este alumno`, { alumno_id: alumnoId });
      return {
        success: true,
        total_items: 0,
        actualizados: 0,
        tipo: tipoNormalizado
      };
    }
    
    // 4. Marcar cada item como limpio
    const fechaLimpieza = new Date();
    let actualizados = 0;
    
    for (const item of items) {
      const exito = await actualizarLimpiezaItem(tipoNormalizado, item.id, alumnoId, fechaLimpieza);
      
      if (exito) {
        actualizados++;
        
        // Registrar en historial
        await registrarHistorialLimpieza({
          alumnoId,
          tipo: tipoNormalizado,
          itemId: item.id,
          itemNombre: item.nombre,
          seccion: config.seccion,
          accion: 'marcar_todo_limpio',
          metadata: {
            master_id: masterId,
            batch_action: true,
            nivel_efectivo: nivelEfectivo
          }
        });
      } else {
        errores.push(`Error actualizando ${item.nombre} (ID: ${item.id})`);
      }
    }
    
    // 5. Registrar auditoría
    await logAuditEvent({
      actor: 'master',
      actorId: masterId ? String(masterId) : null,
      alumnoId,
      action: `pde_marcar_todo_limpio_${tipoNormalizado}`,
      entityType: tipoNormalizado,
      entityId: null,
      payload: {
        total_items: items.length,
        actualizados,
        errores_count: errores.length,
        nivel_efectivo: nivelEfectivo
      },
      req
    });
    
    logInfo(DOMAIN, `[PDE][MASTER][${tipoNormalizado.toUpperCase()}][MARCAR_TODO_LIMPIO] Completado`, {
      alumno_id: alumnoId,
      total_items: items.length,
      actualizados,
      errores_count: errores.length
    });
    
    return {
      success: errores.length === 0 || actualizados > 0,
      total_items: items.length,
      actualizados,
      tipo: tipoNormalizado,
      errores: errores.length > 0 ? errores : undefined
    };
    
  } catch (error) {
    logError(DOMAIN, `[PDE][MASTER][${tipoNormalizado.toUpperCase()}][MARCAR_TODO_LIMPIO] Error`, {
      alumno_id: alumnoId,
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      total_items: 0,
      actualizados: 0,
      tipo: tipoNormalizado,
      errores: [error.message]
    };
  }
}

/**
 * Marca un item específico como limpio
 * 
 * @param {Object} params - Parámetros
 * @param {number} params.alumnoId - ID del alumno
 * @param {string} params.tipo - 'lugares' | 'proyectos' | 'apadrinados'
 * @param {number} params.itemId - ID del item
 * @param {number} [params.masterId] - ID del master que ejecuta la acción
 * @param {Request} [params.req] - Request object para auditoría
 * @returns {Promise<{success: boolean, mensaje?: string}>}
 */
export async function marcarItemComoLimpio({ alumnoId, tipo, itemId, masterId = null, req = null }) {
  const tipoNormalizado = tipo.toLowerCase();
  const config = TIPO_CONFIG[tipoNormalizado];
  
  if (!config) {
    return {
      success: false,
      mensaje: `Tipo no válido: ${tipo}`
    };
  }
  
  try {
    // 1. Validar suscripción
    const validacion = await validarSuscripcionAlumno(alumnoId);
    if (!validacion.valido) {
      return {
        success: false,
        mensaje: validacion.razon
      };
    }
    
    // 2. Obtener nombre del item
    const itemResult = await query(`
      SELECT ${config.nombreColumna} as nombre 
      FROM ${config.tablaBase} 
      WHERE id = $1
    `, [itemId]);
    
    const itemNombre = itemResult.rows[0]?.nombre || 'Item desconocido';
    
    // 3. Actualizar limpieza
    const fechaLimpieza = new Date();
    const exito = await actualizarLimpiezaItem(tipoNormalizado, itemId, alumnoId, fechaLimpieza);
    
    if (!exito) {
      return {
        success: false,
        mensaje: 'Error actualizando el item'
      };
    }
    
    // 4. Registrar en historial
    await registrarHistorialLimpieza({
      alumnoId,
      tipo: tipoNormalizado,
      itemId,
      itemNombre,
      seccion: config.seccion,
      accion: 'marcar_limpio',
      metadata: { master_id: masterId }
    });
    
    // 5. Registrar auditoría
    await logAuditEvent({
      actor: 'master',
      actorId: masterId ? String(masterId) : null,
      alumnoId,
      action: `pde_marcar_limpio_${tipoNormalizado}`,
      entityType: tipoNormalizado,
      entityId: itemId,
      payload: { item_nombre: itemNombre },
      req
    });
    
    logInfo(DOMAIN, `[PDE][MASTER][${tipoNormalizado.toUpperCase()}][MARCAR_LIMPIO]`, {
      alumno_id: alumnoId,
      item_id: itemId,
      item_nombre: itemNombre
    });
    
    return {
      success: true,
      mensaje: `${itemNombre} marcado como limpio`
    };
    
  } catch (error) {
    logError(DOMAIN, 'Error marcando item como limpio', {
      alumno_id: alumnoId,
      tipo: tipoNormalizado,
      item_id: itemId,
      error: error.message
    });
    
    return {
      success: false,
      mensaje: error.message
    };
  }
}

/**
 * Obtiene el resumen de limpiezas PDE para un alumno
 * 
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<{lugares: Object, proyectos: Object, apadrinados: Object}>}
 */
export async function obtenerResumenLimpiezasPde(alumnoId) {
  const nivelEfectivo = await getNivelEfectivoAlumno(alumnoId);
  
  const resumen = {
    lugares: { total: 0, limpios: 0, pendientes: 0, olvidados: 0 },
    proyectos: { total: 0, limpios: 0, pendientes: 0, olvidados: 0 },
    apadrinados: { total: 0, limpios: 0, pendientes: 0, olvidados: 0 }
  };
  
  for (const tipo of ['lugares', 'proyectos', 'apadrinados']) {
    try {
      const items = await obtenerItemsActivos(tipo, alumnoId, nivelEfectivo);
      
      resumen[tipo].total = items.length;
      
      for (const item of items) {
        if (!item.ultima_limpieza) {
          resumen[tipo].pendientes++;
          continue;
        }
        
        const diasDesde = Math.floor((Date.now() - new Date(item.ultima_limpieza).getTime()) / (1000 * 60 * 60 * 24));
        const frecuencia = item.frecuencia_dias || 30;
        
        if (diasDesde <= frecuencia) {
          resumen[tipo].limpios++;
        } else if (diasDesde <= frecuencia + 15) {
          resumen[tipo].pendientes++;
        } else {
          resumen[tipo].olvidados++;
        }
      }
    } catch (error) {
      logWarn(DOMAIN, `Error obteniendo resumen de ${tipo}`, { error: error.message });
    }
  }
  
  return resumen;
}

export default {
  marcarTodoComoLimpio,
  marcarItemComoLimpio,
  obtenerResumenLimpiezasPde
};






