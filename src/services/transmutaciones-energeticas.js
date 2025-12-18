// src/services/transmutaciones-energeticas.js
// Servicio para gestionar transmutaciones energéticas

import { query, getPool } from '../../database/pg.js';
import { insertEnergyEvent } from '../core/energy/energy-events.js';
import { getRequestId } from '../core/observability/request-context.js';

/**
 * Calcula el estado de un ítem para un alumno
 * @param {Object} item - El ítem con frecuencia_dias o veces_limpiar
 * @param {Object} estadoAlumno - El estado del alumno (ultima_limpieza, veces_completadas)
 * @param {String} tipoLista - 'recurrente' o 'una_vez'
 * @returns {String} 'limpio' | 'pendiente' | 'pasado'
 */
export function calcularEstado(item, estadoAlumno, tipoLista) {
  if (tipoLista === 'una_vez') {
    // Para ítems de una sola vez
    if (!estadoAlumno || !estadoAlumno.veces_completadas) {
      return 'pasado'; // No ha limpiado nunca
    }
    if (estadoAlumno.veces_completadas >= item.veces_limpiar) {
      return 'limpio'; // Ya completó todas las veces
    }
    return 'pasado'; // No ha completado todas las veces
  } else {
    // Para ítems recurrentes
    if (!estadoAlumno || !estadoAlumno.ultima_limpieza) {
      return 'pasado'; // Nunca ha limpiado
    }

    const ahora = new Date();
    const ultimaLimpieza = new Date(estadoAlumno.ultima_limpieza);
    const diasDesdeLimpieza = Math.floor((ahora - ultimaLimpieza) / (1000 * 60 * 60 * 24));
    const frecuencia = item.frecuencia_dias || 20;

    if (diasDesdeLimpieza <= frecuencia) {
      return 'limpio'; // Dentro del período de frecuencia
    } else if (diasDesdeLimpieza <= frecuencia + 7) {
      return 'pendiente'; // Últimos 7 días antes de vencer
    } else {
      return 'pasado'; // Pasado de rosca
    }
  }
}

/**
 * Obtiene todas las listas de transmutaciones
 */
export async function obtenerListas() {
  const result = await query(`
    SELECT * FROM listas_transmutaciones 
    WHERE activo = true 
    ORDER BY orden ASC, nombre ASC
  `);
  return result.rows;
}

/**
 * Obtiene una lista por ID
 */
export async function obtenerListaPorId(id) {
  const result = await query(
    'SELECT * FROM listas_transmutaciones WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Crea una nueva lista
 */
export async function crearLista(datos) {
  const { nombre, tipo, descripcion, orden } = datos;
  const result = await query(`
    INSERT INTO listas_transmutaciones (nombre, tipo, descripcion, orden)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [nombre, tipo || 'recurrente', descripcion || null, orden || 0]);
  return result.rows[0];
}

/**
 * Actualiza una lista
 */
export async function actualizarLista(id, datos) {
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (datos.nombre !== undefined) {
    updates.push(`nombre = $${paramIndex}`);
    params.push(datos.nombre);
    paramIndex++;
  }
  if (datos.tipo !== undefined) {
    updates.push(`tipo = $${paramIndex}`);
    params.push(datos.tipo);
    paramIndex++;
  }
  if (datos.descripcion !== undefined) {
    updates.push(`descripcion = $${paramIndex}`);
    params.push(datos.descripcion);
    paramIndex++;
  }
  if (datos.activo !== undefined) {
    updates.push(`activo = $${paramIndex}`);
    params.push(datos.activo);
    paramIndex++;
  }
  if (datos.orden !== undefined) {
    updates.push(`orden = $${paramIndex}`);
    params.push(datos.orden);
    paramIndex++;
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const result = await query(
    `UPDATE listas_transmutaciones SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );
  return result.rows[0];
}

/**
 * Elimina una lista (y todos sus ítems)
 */
export async function eliminarLista(id) {
  await query('DELETE FROM listas_transmutaciones WHERE id = $1', [id]);
}

/**
 * Obtiene todos los ítems de una lista, ordenados por nivel y nombre
 */
export async function obtenerItemsPorLista(listaId) {
  const result = await query(`
    SELECT * FROM items_transmutaciones 
    WHERE lista_id = $1 AND activo = true
    ORDER BY nivel ASC, nombre ASC
  `, [listaId]);
  return result.rows;
}

/**
 * Función auxiliar para calcular el orden de prioridad
 * Orden: alta+pasado, alta+pendiente, media+pasado, media+pendiente, bajo+pasado, bajo+pendiente
 */
function calcularOrdenPrioridad(prioridad, estado) {
  const prioridadNum = prioridad === 'alta' ? 1 : prioridad === 'media' ? 2 : 3;
  const estadoNum = estado === 'pasado' ? 0 : 1; // pasado va antes que pendiente
  return prioridadNum * 10 + estadoNum;
}

/**
 * Verifica si una lista es de energías indeseables
 * @param {string} nombreLista - Nombre de la lista
 * @returns {boolean}
 */
function esListaEnergiasIndeseables(nombreLista) {
  const nombreLower = (nombreLista || '').toLowerCase();
  return nombreLower.includes('energías indeseables') || nombreLower.includes('energias indeseables');
}

/**
 * Obtiene aspectos para limpieza según el tipo
 * @param {number} alumnoId - ID del alumno
 * @param {string} tipoLimpieza - 'rapida', 'basica', 'profunda', 'total'
 * @param {boolean} soloEnergiasIndeseables - Si es true, solo retorna aspectos de listas de energías indeseables
 * @returns {Promise<Array>} Array de aspectos con información completa
 */
export async function obtenerAspectosParaLimpieza(alumnoId, tipoLimpieza, soloEnergiasIndeseables = false) {
  try {
    // Obtener nivel del alumno
    const alumnoResult = await query(`
      SELECT nivel_actual FROM alumnos WHERE id = $1
    `, [alumnoId]);
    
    if (alumnoResult.rows.length === 0) return [];
    
    const nivelAlumno = alumnoResult.rows[0].nivel_actual || 1;
    
    // Obtener todas las listas recurrentes activas
    const listasResult = await query(`
      SELECT id, nombre, tipo
      FROM listas_transmutaciones
      WHERE activo = true AND tipo = 'recurrente'
      ORDER BY orden ASC, nombre ASC
    `);
    
    // Filtrar listas según si son de energías indeseables o no
    let listas = listasResult.rows;
    if (soloEnergiasIndeseables) {
      listas = listas.filter(lista => esListaEnergiasIndeseables(lista.nombre));
    } else {
      listas = listas.filter(lista => !esListaEnergiasIndeseables(lista.nombre));
    }
    
    if (listas.length === 0) return [];
    
    // Obtener todos los ítems de estas listas que el alumno puede ver
    const listaIds = listas.map(l => l.id);
    const itemsResult = await query(`
      SELECT 
        it.*,
        lt.nombre as lista_nombre,
        lt.tipo as tipo_lista
      FROM items_transmutaciones it
      JOIN listas_transmutaciones lt ON lt.id = it.lista_id
      WHERE it.activo = true 
        AND lt.activo = true
        AND it.lista_id = ANY($1)
        AND it.nivel <= $2
      ORDER BY it.lista_id ASC, it.nivel ASC, it.nombre ASC
    `, [listaIds, nivelAlumno]);
    
    const items = itemsResult.rows;
    
    // Obtener estados del alumno para estos ítems
    const itemIds = items.map(i => i.id);
    let estadosMap = {};
    
    if (itemIds.length > 0) {
      const estadosResult = await query(`
        SELECT item_id, ultima_limpieza, veces_completadas
        FROM items_transmutaciones_alumnos
        WHERE alumno_id = $1 AND item_id = ANY($2)
      `, [alumnoId, itemIds]);
      
      estadosResult.rows.forEach(estado => {
        estadosMap[estado.item_id] = {
          ultima_limpieza: estado.ultima_limpieza,
          veces_completadas: estado.veces_completadas || 0
        };
      });
    }
    
    // Clasificar ítems por estado y prioridad
    const itemsConEstado = items.map(item => {
      const estadoAlumno = estadosMap[item.id] || null;
      const estado = calcularEstado(item, estadoAlumno, 'recurrente');
      const prioridad = item.prioridad || 'media';
      
      return {
        ...item,
        estado: estado,
        prioridad: prioridad,
        ordenPrioridad: calcularOrdenPrioridad(prioridad, estado),
        ultima_limpieza: estadoAlumno?.ultima_limpieza || null,
        veces_completadas: estadoAlumno?.veces_completadas || 0,
        dias_desde_limpieza: estadoAlumno?.ultima_limpieza 
          ? Math.floor((new Date() - new Date(estadoAlumno.ultima_limpieza)) / (1000 * 60 * 60 * 24))
          : null
      };
    });
    
    // Filtrar solo pendientes y pasados
    const itemsPendientesOPasados = itemsConEstado.filter(item => 
      item.estado === 'pendiente' || item.estado === 'pasado'
    );
    
    if (itemsPendientesOPasados.length === 0) return [];
    
    // Ordenar por prioridad
    itemsPendientesOPasados.sort((a, b) => {
      if (a.ordenPrioridad !== b.ordenPrioridad) {
        return a.ordenPrioridad - b.ordenPrioridad;
      }
      return a.nombre.localeCompare(b.nombre);
    });
    
    // Determinar cantidad según tipo de limpieza
    switch (tipoLimpieza) {
      case 'rapida':
        // 5 aspectos aleatorios mezclados en total
        const aleatorios = [...itemsPendientesOPasados]
          .sort(() => Math.random() - 0.5)
          .slice(0, 5);
        return aleatorios.map(item => ({
          id: item.id,
          nombre: item.nombre,
          descripcion: item.descripcion || '',
          lista_id: item.lista_id,
          lista_nombre: item.lista_nombre,
          estado: item.estado,
          prioridad: item.prioridad,
          nivel: item.nivel
        }));
        
      case 'basica':
        // Máximo 10 ítems en total (entre todas las listas)
        const basicos = itemsPendientesOPasados.slice(0, 10);
        return basicos.map(item => ({
          id: item.id,
          nombre: item.nombre,
          descripcion: item.descripcion || '',
          lista_id: item.lista_id,
          lista_nombre: item.lista_nombre,
          estado: item.estado,
          prioridad: item.prioridad,
          nivel: item.nivel
        }));
        
      case 'profunda':
        // Máximo 5 por lista y 30 en total
        const itemsPorListaProfunda = {};
        let totalProfunda = 0;
        const maxPorListaProfunda = 5;
        const maxTotalProfunda = 30;
        
        for (const item of itemsPendientesOPasados) {
          if (totalProfunda >= maxTotalProfunda) break;
          if (!itemsPorListaProfunda[item.lista_id]) {
            itemsPorListaProfunda[item.lista_id] = [];
          }
          if (itemsPorListaProfunda[item.lista_id].length < maxPorListaProfunda) {
            itemsPorListaProfunda[item.lista_id].push(item);
            totalProfunda++;
          }
        }
        
        const resultadoProfunda = [];
        Object.values(itemsPorListaProfunda).forEach(listaItems => {
          listaItems.forEach(item => {
            resultadoProfunda.push({
              id: item.id,
              nombre: item.nombre,
              descripcion: item.descripcion || '',
              lista_id: item.lista_id,
              lista_nombre: item.lista_nombre,
              estado: item.estado,
              prioridad: item.prioridad,
              nivel: item.nivel
            });
          });
        });
        return resultadoProfunda;
        
      case 'total':
        // Máximo 10 por lista y 50 en total
        const itemsPorListaTotal = {};
        let totalTotal = 0;
        const maxPorListaTotal = 10;
        const maxTotalTotal = 50;
        
        for (const item of itemsPendientesOPasados) {
          if (totalTotal >= maxTotalTotal) break;
          if (!itemsPorListaTotal[item.lista_id]) {
            itemsPorListaTotal[item.lista_id] = [];
          }
          if (itemsPorListaTotal[item.lista_id].length < maxPorListaTotal) {
            itemsPorListaTotal[item.lista_id].push(item);
            totalTotal++;
          }
        }
        
        const resultadoTotal = [];
        Object.values(itemsPorListaTotal).forEach(listaItems => {
          listaItems.forEach(item => {
            resultadoTotal.push({
              id: item.id,
              nombre: item.nombre,
              descripcion: item.descripcion || '',
              lista_id: item.lista_id,
              lista_nombre: item.lista_nombre,
              estado: item.estado,
              prioridad: item.prioridad,
              nivel: item.nivel
            });
          });
        });
        return resultadoTotal;
        
      default:
        // Por defecto: 5 ítems
        const defaultItems = itemsPendientesOPasados.slice(0, 5);
        return defaultItems.map(item => ({
          id: item.id,
          nombre: item.nombre,
          descripcion: item.descripcion || '',
          lista_id: item.lista_id,
          lista_nombre: item.lista_nombre,
          estado: item.estado,
          prioridad: item.prioridad,
          nivel: item.nivel
        }));
    }
  } catch (error) {
    console.error('Error obteniendo aspectos para limpieza:', error);
    return [];
  }
}

/**
 * Obtiene un ítem por ID
 */
export async function obtenerItemPorId(id) {
  const result = await query(
    'SELECT * FROM items_transmutaciones WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Crea un nuevo ítem (creación rápida)
 */
export async function crearItem(datos) {
  const { lista_id, nombre, descripcion, nivel, prioridad, frecuencia_dias, veces_limpiar } = datos;
  
  // Obtener el tipo de lista para establecer valores por defecto
  const lista = await obtenerListaPorId(lista_id);
  const tipoLista = lista?.tipo || 'recurrente';
  
  // Valores por defecto según especificaciones
  const nivelDefault = nivel !== undefined ? nivel : 9;
  const prioridadDefault = prioridad || 'media';
  const frecuenciaDefault = frecuencia_dias !== undefined ? frecuencia_dias : 20;
  const vecesDefault = veces_limpiar !== undefined ? veces_limpiar : 15;
  
  const result = await query(`
    INSERT INTO items_transmutaciones (lista_id, nombre, descripcion, nivel, prioridad, frecuencia_dias, veces_limpiar)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    lista_id,
    nombre,
    descripcion || null,
    nivelDefault,
    prioridadDefault,
    tipoLista === 'recurrente' ? frecuenciaDefault : null,
    tipoLista === 'una_vez' ? vecesDefault : null
  ]);
  return result.rows[0];
}

/**
 * Actualiza un ítem
 */
export async function actualizarItem(id, datos) {
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (datos.nombre !== undefined) {
    updates.push(`nombre = $${paramIndex}`);
    params.push(datos.nombre);
    paramIndex++;
  }
  if (datos.descripcion !== undefined) {
    updates.push(`descripcion = $${paramIndex}`);
    params.push(datos.descripcion);
    paramIndex++;
  }
  if (datos.nivel !== undefined) {
    updates.push(`nivel = $${paramIndex}`);
    params.push(datos.nivel);
    paramIndex++;
  }
  if (datos.prioridad !== undefined) {
    updates.push(`prioridad = $${paramIndex}`);
    params.push(datos.prioridad);
    paramIndex++;
  }
  if (datos.frecuencia_dias !== undefined) {
    updates.push(`frecuencia_dias = $${paramIndex}`);
    params.push(datos.frecuencia_dias);
    paramIndex++;
  }
  if (datos.veces_limpiar !== undefined) {
    updates.push(`veces_limpiar = $${paramIndex}`);
    params.push(datos.veces_limpiar);
    paramIndex++;
  }
  if (datos.activo !== undefined) {
    updates.push(`activo = $${paramIndex}`);
    params.push(datos.activo);
    paramIndex++;
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const result = await query(
    `UPDATE items_transmutaciones SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );
  return result.rows[0];
}

/**
 * Elimina un ítem
 */
export async function eliminarItem(id) {
  await query('DELETE FROM items_transmutaciones WHERE id = $1', [id]);
}

/**
 * Limpia un ítem para todos los suscriptores activos
 */
export async function limpiarItemParaTodos(itemId) {
  const ahora = new Date();
  
  // Obtener todos los suscriptores activos
  const alumnosResult = await query(`
    SELECT id FROM alumnos 
    WHERE estado_suscripcion = 'activa'
  `);
  
  const alumnos = alumnosResult.rows;
  const item = await obtenerItemPorId(itemId);
  const lista = await obtenerListaPorId(item.lista_id);
  
  // Para cada alumno, crear o actualizar el estado
  for (const alumno of alumnos) {
    if (lista.tipo === 'una_vez') {
      // Para ítems de una vez, incrementar veces_completadas
      await query(`
        INSERT INTO items_transmutaciones_alumnos (item_id, alumno_id, ultima_limpieza, veces_completadas)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (item_id, alumno_id) DO UPDATE SET
          ultima_limpieza = $3,
          veces_completadas = items_transmutaciones_alumnos.veces_completadas + 1,
          updated_at = CURRENT_TIMESTAMP
      `, [itemId, alumno.id, ahora]);
    } else {
      // Para ítems recurrentes, actualizar última limpieza
      await query(`
        INSERT INTO items_transmutaciones_alumnos (item_id, alumno_id, ultima_limpieza)
        VALUES ($1, $2, $3)
        ON CONFLICT (item_id, alumno_id) DO UPDATE SET
          ultima_limpieza = $3,
          updated_at = CURRENT_TIMESTAMP
      `, [itemId, alumno.id, ahora]);
    }
    
    // ========================================================================
    // EMITIR EVENTO EN PARALELO (fail-open: no rompe si falla)
    // ========================================================================
    try {
      // Obtener estado antes (si existe)
      const estadoAntes = await query(`
        SELECT ultima_limpieza, veces_completadas 
        FROM items_transmutaciones_alumnos
        WHERE item_id = $1 AND alumno_id = $2
      `, [itemId, alumno.id]).catch(() => null);
      
      const wasCleanBefore = estadoAntes?.rows?.[0]?.ultima_limpieza ? true : false;
      
      await insertEnergyEvent({
        occurred_at: ahora,
        event_type: 'cleaning',
        actor_type: 'master',
        actor_id: null,
        alumno_id: alumno.id,
        subject_type: 'transmutacion_item',
        subject_id: String(itemId),
        origin: 'admin_panel',
        notes: `Limpieza global de item transmutación ${item.nombre}`,
        metadata: {
          legacy_table_updated: true,
          item_id: itemId,
          item_nombre: item.nombre,
          lista_id: item.lista_id,
          lista_nombre: lista.nombre,
          tipo_lista: lista.tipo,
          frecuencia_dias: item.frecuencia_dias || null,
          veces_limpiar: item.veces_limpiar || null,
          global_cleaning: true
        },
        request_id: getRequestId(),
        requires_clean_state: true,
        was_clean_before: wasCleanBefore,
        is_clean_after: true,
        ctx: { request_id: getRequestId() }
      });
    } catch (energyError) {
      // FAIL-OPEN: Continuar con otros alumnos
      console.error(`[limpiarItemParaTodos][EnergyEvent][FAIL] alumno_id=${alumno.id}`, energyError.message);
    }
  }
  
  return { limpiado: alumnos.length };
}

/**
 * Obtiene el estado de un ítem por alumnos (limpio, pendiente, pasado)
 */
export async function obtenerEstadoPorAlumnos(itemId) {
  const item = await obtenerItemPorId(itemId);
  if (!item) return null;
  
  const lista = await obtenerListaPorId(item.lista_id);
  
  // Obtener todos los suscriptores activos con su estado
  const result = await query(`
    SELECT 
      a.id,
      a.email,
      a.apodo,
      a.nivel_actual,
      ita.ultima_limpieza,
      ita.veces_completadas
    FROM alumnos a
    LEFT JOIN items_transmutaciones_alumnos ita ON ita.alumno_id = a.id AND ita.item_id = $1
    WHERE a.estado_suscripcion = 'activa'
    ORDER BY a.apodo ASC, a.email ASC
  `, [itemId]);
  
  const alumnos = result.rows;
  const estados = {
    limpio: [],
    pendiente: [],
    pasado: []
  };
  
  alumnos.forEach(alumno => {
    const estadoAlumno = {
      ultima_limpieza: alumno.ultima_limpieza,
      veces_completadas: alumno.veces_completadas || 0
    };
    
    const estado = calcularEstado(item, estadoAlumno, lista.tipo);
    
    estados[estado].push({
      id: alumno.id,
      nombre: alumno.apodo || alumno.email,
      email: alumno.email,
      nivel: alumno.nivel_actual,
      ultima_limpieza: alumno.ultima_limpieza
    });
  });
  
  return estados;
}

/**
 * Limpia un ítem para un alumno específico
 */
export async function limpiarItemParaAlumno(itemId, alumnoId) {
  const ahora = new Date();
  const item = await obtenerItemPorId(itemId);
  if (!item) {
    throw new Error(`Item ${itemId} no encontrado`);
  }
  const lista = await obtenerListaPorId(item.lista_id);
  
  // Obtener estado antes (si existe) - ANTES de actualizar
  const estadoAntes = await query(`
    SELECT ultima_limpieza, veces_completadas 
    FROM items_transmutaciones_alumnos
    WHERE item_id = $1 AND alumno_id = $2
  `, [itemId, alumnoId]).catch(() => null);
  
  const wasCleanBefore = estadoAntes?.rows?.[0]?.ultima_limpieza ? true : false;
  
  if (lista.tipo === 'una_vez') {
    // Incrementar veces_completadas
    await query(`
      INSERT INTO items_transmutaciones_alumnos (item_id, alumno_id, ultima_limpieza, veces_completadas)
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (item_id, alumno_id) DO UPDATE SET
        ultima_limpieza = $3,
        veces_completadas = items_transmutaciones_alumnos.veces_completadas + 1,
        updated_at = CURRENT_TIMESTAMP
    `, [itemId, alumnoId, ahora]);
  } else {
    // Actualizar última limpieza
    await query(`
      INSERT INTO items_transmutaciones_alumnos (item_id, alumno_id, ultima_limpieza)
      VALUES ($1, $2, $3)
      ON CONFLICT (item_id, alumno_id) DO UPDATE SET
        ultima_limpieza = $3,
        updated_at = CURRENT_TIMESTAMP
    `, [itemId, alumnoId, ahora]);
  }
  
  // ========================================================================
  // EMITIR EVENTO EN PARALELO (fail-open: no rompe si falla)
  // ========================================================================
  try {
    await insertEnergyEvent({
      occurred_at: ahora,
      event_type: 'cleaning',
      actor_type: 'master',
      actor_id: null,
      alumno_id: alumnoId,
      subject_type: 'transmutacion_item',
      subject_id: String(itemId),
      origin: 'admin_panel',
      notes: `Limpieza de item transmutación ${item.nombre}`,
      metadata: {
        legacy_table_updated: true,
        item_id: itemId,
        item_nombre: item.nombre,
        lista_id: item.lista_id,
        lista_nombre: lista.nombre,
        tipo_lista: lista.tipo,
        frecuencia_dias: item.frecuencia_dias || null,
        veces_limpiar: item.veces_limpiar || null
      },
      request_id: getRequestId(),
      requires_clean_state: true,
      was_clean_before: wasCleanBefore,
      is_clean_after: true,
      ctx: { request_id: getRequestId() }
    });
  } catch (energyError) {
    // FAIL-OPEN: No romper la limpieza legacy si falla el evento
    console.error(`[limpiarItemParaAlumno][EnergyEvent][FAIL] alumno_id=${alumnoId}`, energyError.message);
  }
  
  return { success: true };
}

/**
 * Obtiene todos los ítems en estado verde para un alumno
 */
export async function obtenerItemsVerdesParaAlumno(alumnoId) {
  // Obtener el nivel del alumno primero
  const alumnoResult = await query(`
    SELECT nivel_actual FROM alumnos WHERE id = $1
  `, [alumnoId]);
  
  if (alumnoResult.rows.length === 0) {
    return [];
  }
  
  const nivelAlumno = alumnoResult.rows[0].nivel_actual || 1;
  
  // Obtener todos los ítems activos que el alumno puede ver
  const itemsResult = await query(`
    SELECT 
      it.*,
      lt.tipo as tipo_lista,
      lt.nombre as lista_nombre
    FROM items_transmutaciones it
    JOIN listas_transmutaciones lt ON lt.id = it.lista_id
    WHERE it.activo = true 
      AND lt.activo = true
      AND it.nivel <= $1
    ORDER BY it.nivel ASC, it.nombre ASC
  `, [nivelAlumno]);
  
  const items = itemsResult.rows;
  const itemsVerdes = [];
  
  // Obtener estados del alumno
  const estadosResult = await query(`
    SELECT item_id, ultima_limpieza, veces_completadas
    FROM items_transmutaciones_alumnos
    WHERE alumno_id = $1
  `, [alumnoId]);
  
  const estadosMap = {};
  estadosResult.rows.forEach(estado => {
    estadosMap[estado.item_id] = {
      ultima_limpieza: estado.ultima_limpieza,
      veces_completadas: estado.veces_completadas || 0
    };
  });
  
  // Filtrar solo los que están en estado verde
  items.forEach(item => {
    const estadoAlumno = estadosMap[item.id] || null;
    const estado = calcularEstado(item, estadoAlumno, item.tipo_lista);
    
    if (estado === 'limpio') {
      itemsVerdes.push({
        ...item,
        estado: 'limpio',
        ultima_limpieza: estadoAlumno?.ultima_limpieza || null,
        veces_completadas: estadoAlumno?.veces_completadas || 0
      });
    }
  });
  
  return itemsVerdes;
}

/**
 * Obtiene todos los ítems de transmutaciones para un alumno, clasificados por estado y agrupados por lista
 * Retorna un objeto con la estructura: { listas: [{ id, nombre, tipo, items: { limpio: [], pendiente: [], pasado: [] } }] }
 * @param {number} alumnoId - ID del alumno
 * @param {number} [nivelEfectivo] - Nivel efectivo del alumno (opcional, si no se proporciona se obtiene de la BD)
 */
export async function obtenerTransmutacionesPorAlumno(alumnoId, nivelEfectivo = null) {
  // FASE 2A: Usar nivel_efectivo si se proporciona, sino obtener de BD (fallback)
  let nivelAlumno;
  if (nivelEfectivo !== null && nivelEfectivo !== undefined) {
    nivelAlumno = nivelEfectivo;
    console.log(`[Transmutaciones][LEVEL_FILTER] alumnoId=${alumnoId} nivel_efectivo=${nivelAlumno} fuente=parametro`);
  } else {
    // Fallback: obtener desde BD
    const alumnoResult = await query(`
      SELECT nivel_actual FROM alumnos WHERE id = $1
    `, [alumnoId]);
    
    if (alumnoResult.rows.length === 0) {
      return { listas: [] };
    }
    
    nivelAlumno = alumnoResult.rows[0].nivel_actual || 1;
    console.log(`[Transmutaciones][LEVEL_FALLBACK] alumnoId=${alumnoId} nivel_actual=${nivelAlumno} fuente=bd`);
  }
  
  // Obtener todas las listas activas
  const listasResult = await query(`
    SELECT id, nombre, tipo, descripcion
    FROM listas_transmutaciones
    WHERE activo = true
    ORDER BY tipo ASC, nombre ASC
  `);
  
  const listas = listasResult.rows;
  const resultado = { listas: [] };
  
  // Para cada lista, obtener sus ítems y clasificarlos
  for (const lista of listas) {
    // Obtener todos los ítems activos de esta lista que el alumno puede ver
    const itemsResult = await query(`
      SELECT 
        it.*,
        lt.tipo as tipo_lista
      FROM items_transmutaciones it
      JOIN listas_transmutaciones lt ON lt.id = it.lista_id
      WHERE it.activo = true 
        AND lt.activo = true
        AND it.lista_id = $1
        AND it.nivel <= $2
      ORDER BY it.nivel ASC, it.nombre ASC
    `, [lista.id, nivelAlumno]);
    
    const items = itemsResult.rows;
    
    // Obtener estados del alumno para estos ítems
    const itemIds = items.map(i => i.id);
    let estadosMap = {};
    
    if (itemIds.length > 0) {
      const estadosResult = await query(`
        SELECT item_id, ultima_limpieza, veces_completadas
        FROM items_transmutaciones_alumnos
        WHERE alumno_id = $1 AND item_id = ANY($2)
      `, [alumnoId, itemIds]);
      
      estadosResult.rows.forEach(estado => {
        estadosMap[estado.item_id] = {
          ultima_limpieza: estado.ultima_limpieza,
          veces_completadas: estado.veces_completadas || 0
        };
      });
    }
    
    // Clasificar ítems por estado
    const itemsLimpio = [];
    const itemsPendiente = [];
    const itemsPasado = [];
    
    items.forEach(item => {
      const estadoAlumno = estadosMap[item.id] || null;
      const estado = calcularEstado(item, estadoAlumno, lista.tipo);
      
      const itemConEstado = {
        ...item,
        estado: estado,
        ultima_limpieza: estadoAlumno?.ultima_limpieza || null,
        veces_completadas: estadoAlumno?.veces_completadas || 0,
        dias_desde_limpieza: estadoAlumno?.ultima_limpieza 
          ? Math.floor((new Date() - new Date(estadoAlumno.ultima_limpieza)) / (1000 * 60 * 60 * 24))
          : null
      };
      
      if (estado === 'limpio') {
        itemsLimpio.push(itemConEstado);
      } else if (estado === 'pendiente') {
        itemsPendiente.push(itemConEstado);
      } else {
        itemsPasado.push(itemConEstado);
      }
    });
    
    resultado.listas.push({
      id: lista.id,
      nombre: lista.nombre,
      tipo: lista.tipo,
      descripcion: lista.descripcion,
      items: {
        limpio: itemsLimpio,
        pendiente: itemsPendiente,
        pasado: itemsPasado
      }
    });
  }
  
  return resultado;
}

