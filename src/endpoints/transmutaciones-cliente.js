// src/endpoints/transmutaciones-cliente.js
// Endpoints para que los alumnos gestionen sus transmutaciones

import { query } from '../../database/pg.js';
import { getCookieData } from '../core/cookies.js';
import { findStudentByEmail } from '../modules/student-v4.js';
import {
  limpiarItemParaAlumno,
  obtenerItemsVerdesParaAlumno,
  calcularEstado
} from '../services/transmutaciones-energeticas.js';
import { renderSuccess, renderError } from '../core/responses.js';

/**
 * Obtiene el alumno desde la cookie de sesión
 */
async function obtenerAlumnoDesdeRequest(request, env) {
  const cookie = getCookieData(request);
  
  if (!cookie || !cookie.email) {
    return null;
  }
  
  try {
    const email = cookie.email.toLowerCase().trim();
    const student = await findStudentByEmail(env, email);
    
    // Verificar que tenga suscripción activa
    if (!student || student.estado_suscripcion !== 'activa') {
      return null;
    }
    
    return student;
  } catch (error) {
    console.error('Error obteniendo alumno:', error);
    return null;
  }
}

/**
 * GET /transmutaciones - Obtener ítems en estado verde para el alumno
 */
export async function obtenerTransmutacionesVerdes(request, env) {
  try {
    const alumno = await obtenerAlumnoDesdeRequest(request, env);
    
    if (!alumno) {
      return renderError('Debes estar autenticado y tener suscripción activa', 401);
    }
    
    const items = await obtenerItemsVerdesParaAlumno(alumno.id);
    
    return renderSuccess('Ítems obtenidos', { items });
  } catch (error) {
    console.error('Error obteniendo transmutaciones:', error);
    return renderError(error.message || 'Error interno del servidor', 500);
  }
}

/**
 * POST /transmutaciones/limpiar/:itemId - Limpiar un ítem para el alumno
 */
export async function limpiarTransmutacion(request, env) {
  try {
    const alumno = await obtenerAlumnoDesdeRequest(request, env);
    
    if (!alumno) {
      return renderError('Debes estar autenticado y tener suscripción activa', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const itemId = parseInt(pathParts[pathParts.length - 1]);
    
    if (isNaN(itemId)) {
      return renderError('ID de ítem inválido', 400);
    }
    
    // Verificar que el ítem existe y el alumno puede acceder a él
    const itemResult = await query(`
      SELECT it.*, lt.tipo as tipo_lista
      FROM items_transmutaciones it
      JOIN listas_transmutaciones lt ON lt.id = it.lista_id
      WHERE it.id = $1 
        AND it.activo = true 
        AND lt.activo = true
        AND it.nivel <= $2
    `, [itemId, alumno.nivel_actual]);
    
    if (itemResult.rows.length === 0) {
      return renderError('Ítem no encontrado o no tienes acceso', 404);
    }
    
    const item = itemResult.rows[0];
    
    // Verificar que el ítem está en estado verde
    const estadoResult = await query(`
      SELECT ultima_limpieza, veces_completadas
      FROM items_transmutaciones_alumnos
      WHERE item_id = $1 AND alumno_id = $2
    `, [itemId, alumno.id]);
    
    const estadoAlumno = estadoResult.rows[0] || null;
    const estado = calcularEstado(item, estadoAlumno, item.tipo_lista);
    
    if (estado !== 'limpio') {
      return renderError('Solo puedes limpiar ítems que estén en estado verde', 400);
    }
    
    await limpiarItemParaAlumno(itemId, alumno.id);
    
    return renderSuccess('Ítem limpiado correctamente');
  } catch (error) {
    console.error('Error limpiando transmutación:', error);
    return renderError(error.message || 'Error interno del servidor', 500);
  }
}

