// src/endpoints/preparaciones-practica-api.js
// API endpoints para preparaciones de práctica

import { verificarAccesoAdmin } from './transmutaciones-api.js';
import { listarPreparaciones, obtenerPreparacion, crearPreparacion, actualizarPreparacion, eliminarPreparacion } from '../services/preparaciones-practica.js';

function renderSuccess(message, data = {}) {
  return new Response(JSON.stringify({ success: true, message, data }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function renderError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async function preparacionesPracticaApiHandler(request, env, ctx) {
  if (!(await verificarAccesoAdmin(request, env))) {
    return renderError('Acceso denegado', 403);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const normalizedPath = path.replace('/api/preparaciones-practica', '').replace(/\/$/, '') || '/';

  try {
    // GET /api/preparaciones-practica - Listar todas las preparaciones
    if (normalizedPath === '/' && method === 'GET') {
      const preparaciones = await listarPreparaciones();
      return renderSuccess('Preparaciones obtenidas', { preparaciones });
    }

    // POST /api/preparaciones-practica - Crear nueva preparación
    if (normalizedPath === '/' && method === 'POST') {
      const body = await request.json();
      const { 
        nombre, descripcion, nivel, video_url, activar_reloj, musica_id,
        tipo, posicion, orden, obligatoria_global, obligatoria_por_nivel, minutos, tiene_video, contenido_html
      } = body;
      
      if (!nombre) {
        return renderError('El nombre es requerido', 400);
      }
      
      const id = await crearPreparacion({ 
        nombre, 
        descripcion: descripcion || '', 
        nivel: nivel || 1,
        video_url: video_url || null,
        activar_reloj: activar_reloj === true || activar_reloj === 'true',
        musica_id: musica_id || null,
        tipo: tipo || 'consigna',
        posicion: posicion || 'inicio',
        orden: orden || 0,
        obligatoria_global: obligatoria_global === true || obligatoria_global === 'true',
        obligatoria_por_nivel: obligatoria_por_nivel || {},
        minutos: minutos || null,
        tiene_video: tiene_video === true || tiene_video === 'true',
        contenido_html: contenido_html || null
      });
      const preparacion = await obtenerPreparacion(id);
      return renderSuccess('Preparación creada', { preparacion });
    }

    // GET /api/preparaciones-practica/:id - Obtener una preparación
    if (normalizedPath.startsWith('/') && method === 'GET') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const preparacion = await obtenerPreparacion(id);
      if (!preparacion) {
        return renderError('Preparación no encontrada', 404);
      }
      return renderSuccess('Preparación obtenida', { preparacion });
    }

    // PUT /api/preparaciones-practica/:id - Actualizar preparación
    if (normalizedPath.startsWith('/') && method === 'PUT') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const body = await request.json();
      const { 
        nombre, descripcion, nivel, video_url, activo, activar_reloj, musica_id,
        tipo, posicion, orden, obligatoria_global, obligatoria_por_nivel, minutos, tiene_video, contenido_html
      } = body;
      
      const actualizado = await actualizarPreparacion(id, { 
        nombre, 
        descripcion, 
        nivel, 
        video_url,
        activo,
        activar_reloj: activar_reloj !== undefined ? (activar_reloj === true || activar_reloj === 'true') : undefined,
        musica_id: musica_id !== undefined ? (musica_id ? parseInt(musica_id) : null) : undefined,
        tipo,
        posicion,
        orden,
        obligatoria_global: obligatoria_global !== undefined ? (obligatoria_global === true || obligatoria_global === 'true') : undefined,
        obligatoria_por_nivel,
        minutos: minutos !== undefined ? (minutos ? parseInt(minutos) : null) : undefined,
        tiene_video: tiene_video !== undefined ? (tiene_video === true || tiene_video === 'true') : undefined,
        contenido_html
      });
      if (!actualizado) {
        return renderError('Error actualizando preparación', 500);
      }
      const preparacion = await obtenerPreparacion(id);
      return renderSuccess('Preparación actualizada', { preparacion });
    }

    // DELETE /api/preparaciones-practica/:id - Eliminar preparación
    if (normalizedPath.startsWith('/') && method === 'DELETE') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const eliminado = await eliminarPreparacion(id);
      if (!eliminado) {
        return renderError('Error eliminando preparación', 500);
      }
      return renderSuccess('Preparación eliminada');
    }

    return renderError('Ruta no encontrada', 404);
  } catch (error) {
    console.error('Error en API de preparaciones de práctica:', error);
    return renderError(error.message || 'Error interno del servidor', 500);
  }
}


