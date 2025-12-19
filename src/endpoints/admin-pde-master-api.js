// src/endpoints/admin-pde-master-api.js
// API Endpoints para acciones Master sobre catálogos PDE
//
// Endpoints:
// POST /admin/master/:alumnoId/marcar-todo-limpio - Marca todos los items de un tipo como limpios
// GET /admin/master/:alumnoId/resumen-pde - Obtiene resumen de limpiezas PDE
//
// REGLAS:
// - Requiere autenticación admin
// - SIEMPRE usa nivel_efectivo
// - Registra en auditoría todas las acciones

import { requireAdminAuth } from '../modules/admin-auth.js';
import { marcarTodoComoLimpio, marcarItemComoLimpio, obtenerResumenLimpiezasPde } from '../services/pde-limpiezas-master.js';
import { query } from '../../database/pg.js';
import { logInfo, logError } from '../core/observability/logger.js';

const DOMAIN = 'AdminPdeMasterApi';

/**
 * Router principal para endpoints PDE del Master
 */
export default async function adminPdeMasterApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Verificar autenticación admin
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // POST /admin/master/:alumnoId/marcar-todo-limpio
    const marcarTodoMatch = path.match(/^\/admin\/master\/(\d+)\/marcar-todo-limpio$/);
    if (marcarTodoMatch && method === 'POST') {
      const alumnoId = parseInt(marcarTodoMatch[1], 10);
      return await handleMarcarTodoLimpio(request, alumnoId);
    }
    
    // GET /admin/master/:alumnoId/resumen-pde
    const resumenMatch = path.match(/^\/admin\/master\/(\d+)\/resumen-pde$/);
    if (resumenMatch && method === 'GET') {
      const alumnoId = parseInt(resumenMatch[1], 10);
      return await handleResumenPde(alumnoId);
    }
    
    // POST /admin/master/:alumnoId/marcar-limpio (individual)
    const marcarLimpioMatch = path.match(/^\/admin\/master\/(\d+)\/marcar-limpio$/);
    if (marcarLimpioMatch && method === 'POST') {
      const alumnoId = parseInt(marcarLimpioMatch[1], 10);
      return await handleMarcarLimpio(request, alumnoId);
    }
    
    // Ruta no encontrada
    return new Response(JSON.stringify({ error: 'Ruta no encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logError(DOMAIN, 'Error en endpoint PDE Master API', {
      path,
      method,
      error: error.message
    });
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para POST /admin/master/:alumnoId/marcar-todo-limpio
 * 
 * Body: { tipo: 'lugares' | 'proyectos' | 'apadrinados' }
 */
async function handleMarcarTodoLimpio(request, alumnoId) {
  try {
    // Validar que el alumno existe
    const alumnoCheck = await query('SELECT id, apodo, email FROM alumnos WHERE id = $1', [alumnoId]);
    if (alumnoCheck.rows.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Alumno no encontrado',
        alumno_id: alumnoId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parsear body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ 
        error: 'Body JSON inválido. Formato esperado: { "tipo": "lugares" | "proyectos" | "apadrinados" }' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { tipo } = body;
    
    // Validar tipo
    const tiposValidos = ['lugares', 'proyectos', 'apadrinados'];
    if (!tipo || !tiposValidos.includes(tipo.toLowerCase())) {
      return new Response(JSON.stringify({ 
        error: `Tipo inválido: "${tipo}". Tipos válidos: ${tiposValidos.join(', ')}` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    logInfo(DOMAIN, '[PDE][MASTER][MARCAR_TODO_LIMPIO] Request recibido', {
      alumno_id: alumnoId,
      alumno: alumnoCheck.rows[0].apodo || alumnoCheck.rows[0].email,
      tipo
    });
    
    // Ejecutar acción
    const resultado = await marcarTodoComoLimpio({
      alumnoId,
      tipo: tipo.toLowerCase(),
      masterId: null, // TODO: obtener del contexto de sesión admin
      req: request
    });
    
    // Responder
    const statusCode = resultado.success ? 200 : (resultado.errores?.length > 0 ? 207 : 500);
    
    return new Response(JSON.stringify({
      success: resultado.success,
      data: {
        alumno_id: alumnoId,
        alumno_nombre: alumnoCheck.rows[0].apodo || alumnoCheck.rows[0].email,
        tipo: resultado.tipo,
        total_items: resultado.total_items,
        actualizados: resultado.actualizados,
        errores: resultado.errores
      },
      mensaje: resultado.success 
        ? `Se marcaron ${resultado.actualizados} de ${resultado.total_items} ${resultado.tipo} como limpios`
        : `Error al marcar ${resultado.tipo} como limpios`
    }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logError(DOMAIN, 'Error en handleMarcarTodoLimpio', {
      alumno_id: alumnoId,
      error: error.message
    });
    
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para POST /admin/master/:alumnoId/marcar-limpio (individual)
 * 
 * Body: { tipo: string, itemId: number }
 */
async function handleMarcarLimpio(request, alumnoId) {
  try {
    // Validar alumno
    const alumnoCheck = await query('SELECT id FROM alumnos WHERE id = $1', [alumnoId]);
    if (alumnoCheck.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Alumno no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parsear body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ 
        error: 'Body JSON inválido. Formato: { "tipo": "lugares", "itemId": 123 }' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { tipo, itemId } = body;
    
    // Validaciones
    const tiposValidos = ['lugares', 'proyectos', 'apadrinados'];
    if (!tipo || !tiposValidos.includes(tipo.toLowerCase())) {
      return new Response(JSON.stringify({ 
        error: `Tipo inválido: "${tipo}". Tipos válidos: ${tiposValidos.join(', ')}` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!itemId || typeof itemId !== 'number') {
      return new Response(JSON.stringify({ 
        error: 'itemId es requerido y debe ser un número' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Ejecutar
    const resultado = await marcarItemComoLimpio({
      alumnoId,
      tipo: tipo.toLowerCase(),
      itemId,
      masterId: null,
      req: request
    });
    
    return new Response(JSON.stringify({
      success: resultado.success,
      mensaje: resultado.mensaje
    }), {
      status: resultado.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logError(DOMAIN, 'Error en handleMarcarLimpio', {
      alumno_id: alumnoId,
      error: error.message
    });
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler para GET /admin/master/:alumnoId/resumen-pde
 */
async function handleResumenPde(alumnoId) {
  try {
    // Validar alumno
    const alumnoCheck = await query(`
      SELECT id, apodo, email, nombre_completo, nivel_actual 
      FROM alumnos WHERE id = $1
    `, [alumnoId]);
    
    if (alumnoCheck.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Alumno no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const alumno = alumnoCheck.rows[0];
    
    // Obtener resumen
    const resumen = await obtenerResumenLimpiezasPde(alumnoId);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        alumno: {
          id: alumno.id,
          nombre: alumno.nombre_completo || alumno.apodo || alumno.email,
          nivel_actual: alumno.nivel_actual
        },
        resumen
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logError(DOMAIN, 'Error en handleResumenPde', {
      alumno_id: alumnoId,
      error: error.message
    });
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Exportar handlers individuales para uso desde admin-panel-v4
export { handleMarcarTodoLimpio, handleMarcarLimpio, handleResumenPde };






