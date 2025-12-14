// src/endpoints/transmutaciones-api.js
// API endpoints para gestionar transmutaciones energéticas

import {
  obtenerListas,
  obtenerListaPorId,
  crearLista,
  actualizarLista,
  eliminarLista,
  obtenerItemsPorLista,
  obtenerItemPorId,
  crearItem,
  actualizarItem,
  eliminarItem,
  limpiarItemParaTodos,
  obtenerEstadoPorAlumnos
} from '../services/transmutaciones-energeticas.js';
import { renderSuccess, renderError } from '../core/responses.js';

/**
 * Verifica acceso admin
 */
export async function verificarAccesoAdmin(request, env) {
  // Si viene del admin panel, usar la autenticación del admin
  try {
    const { validateAdminSession } = await import('../modules/admin-auth.js');
    if (validateAdminSession(request)) {
      return true;
    }
  } catch (e) {
    // Si falla, continuar con verificación antigua
  }
  
  // Verificar IP permitida (fallback)
  const allowedIPs = env.ADMIN_ALLOWED_IPS ? env.ADMIN_ALLOWED_IPS.split(',') : [];
  const clientIP = request.headers.get('cf-connecting-ip') || 
                   request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   'unknown';
  
  if (allowedIPs.length > 0 && allowedIPs.includes(clientIP)) {
    return true;
  }
  
  // Verificar password en query string (fallback)
  const password = request.url.includes('?password=') 
    ? new URL(request.url).searchParams.get('password')
    : request.headers.get('x-admin-password');
  
  const adminPassword = env.ADMIN_PASSWORD || 'kaketes7897';
  
  if (password === adminPassword) {
    return true;
  }
  
  if (process.env.NODE_ENV !== 'production' && allowedIPs.length === 0) {
    return true;
  }
  
  return false;
}

export default async function transmutacionesApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Verificar acceso admin
  if (!(await verificarAccesoAdmin(request, env))) {
    return renderError('Acceso denegado', 403);
  }
  
  // Normalizar path: remover /api/transmutaciones si está presente
  let normalizedPath = path;
  if (normalizedPath.startsWith('/api/transmutaciones')) {
    normalizedPath = normalizedPath.replace('/api/transmutaciones', '') || '/';
  }
  if (normalizedPath.startsWith('/transmutaciones-api')) {
    normalizedPath = normalizedPath.replace('/transmutaciones-api', '') || '/';
  }
  
  try {
    // ============================================
    // LISTAS
    // ============================================
    
    // GET /api/transmutaciones/listas - Obtener todas las listas
    if (normalizedPath === '/listas' && method === 'GET') {
      const listas = await obtenerListas();
      return renderSuccess('Listas obtenidas', { listas });
    }
    
    // POST /api/transmutaciones/listas - Crear lista
    if (normalizedPath === '/listas' && method === 'POST') {
      const datos = await request.json();
      if (!datos.nombre) {
        return renderError('El nombre es requerido', 400);
      }
      const lista = await crearLista(datos);
      return renderSuccess('Lista creada', { lista }, 201);
    }
    
    // ============================================
    // ÍTEMS (debe ir ANTES de las rutas de listas individuales)
    // ============================================
    
    // GET /api/transmutaciones/listas/:id/items - Obtener ítems de una lista
    if (normalizedPath.startsWith('/listas/') && normalizedPath.endsWith('/items') && method === 'GET') {
      const listaId = parseInt(normalizedPath.split('/listas/')[1].split('/items')[0]);
      if (isNaN(listaId)) {
        return renderError('ID de lista inválido', 400);
      }
      const items = await obtenerItemsPorLista(listaId);
      return renderSuccess('Ítems obtenidos', { items });
    }
    
    // GET /api/transmutaciones/listas/:id - Obtener una lista
    if (normalizedPath.startsWith('/listas/') && method === 'GET') {
      const id = parseInt(normalizedPath.split('/listas/')[1]);
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const lista = await obtenerListaPorId(id);
      if (!lista) {
        return renderError('Lista no encontrada', 404);
      }
      return renderSuccess('Lista obtenida', { lista });
    }
    
    // PUT /api/transmutaciones/listas/:id - Actualizar lista
    if (normalizedPath.startsWith('/listas/') && method === 'PUT') {
      const id = parseInt(normalizedPath.split('/listas/')[1]);
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const datos = await request.json();
      const lista = await actualizarLista(id, datos);
      if (!lista) {
        return renderError('Lista no encontrada', 404);
      }
      return renderSuccess('Lista actualizada', { lista });
    }
    
    // DELETE /api/transmutaciones/listas/:id - Eliminar lista
    if (normalizedPath.startsWith('/listas/') && method === 'DELETE') {
      const id = parseInt(normalizedPath.split('/listas/')[1]);
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      await eliminarLista(id);
      return renderSuccess('Lista eliminada');
    }
    
    // POST /api/transmutaciones/items - Crear ítem (creación rápida)
    if (normalizedPath === '/items' && method === 'POST') {
      const datos = await request.json();
      if (!datos.nombre || !datos.lista_id) {
        return renderError('El nombre y lista_id son requeridos', 400);
      }
      const item = await crearItem(datos);
      return renderSuccess('Ítem creado', { item }, 201);
    }
    
    // ============================================
    // ACCIONES ESPECIALES (deben ir ANTES de las rutas genéricas)
    // ============================================
    
    // POST /api/transmutaciones/items/:id/limpiar-todos - Limpiar ítem para todos los suscriptores activos
    if (normalizedPath.startsWith('/items/') && normalizedPath.endsWith('/limpiar-todos') && method === 'POST') {
      const id = parseInt(normalizedPath.split('/items/')[1].split('/limpiar-todos')[0]);
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const resultado = await limpiarItemParaTodos(id);
      return renderSuccess('Ítem limpiado para todos los suscriptores activos', resultado);
    }
    
    // GET /api/transmutaciones/items/:id/por-alumnos - Ver estado por alumnos
    if (normalizedPath.startsWith('/items/') && normalizedPath.endsWith('/por-alumnos') && method === 'GET') {
      const id = parseInt(normalizedPath.split('/items/')[1].split('/por-alumnos')[0]);
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const estados = await obtenerEstadoPorAlumnos(id);
      if (!estados) {
        return renderError('Ítem no encontrado', 404);
      }
      return renderSuccess('Estados por alumnos obtenidos', estados);
    }
    
    // GET /api/transmutaciones/items/:id - Obtener un ítem
    if (normalizedPath.startsWith('/items/') && method === 'GET') {
      const id = parseInt(normalizedPath.split('/items/')[1]);
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const item = await obtenerItemPorId(id);
      if (!item) {
        return renderError('Ítem no encontrado', 404);
      }
      return renderSuccess('Ítem obtenido', { item });
    }
    
    // PUT /api/transmutaciones/items/:id - Actualizar ítem
    if (normalizedPath.startsWith('/items/') && method === 'PUT') {
      const id = parseInt(normalizedPath.split('/items/')[1]);
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const datos = await request.json();
      const item = await actualizarItem(id, datos);
      if (!item) {
        return renderError('Ítem no encontrado', 404);
      }
      return renderSuccess('Ítem actualizado', { item });
    }
    
    // DELETE /api/transmutaciones/items/:id - Eliminar ítem
    if (normalizedPath.startsWith('/items/') && method === 'DELETE') {
      const id = parseInt(normalizedPath.split('/items/')[1]);
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      await eliminarItem(id);
      return renderSuccess('Ítem eliminado');
    }
    
    return renderError('Ruta no encontrada', 404);
  } catch (error) {
    console.error('Error en transmutaciones-api:', error);
    return renderError(error.message || 'Error interno del servidor', 500);
  }
}


