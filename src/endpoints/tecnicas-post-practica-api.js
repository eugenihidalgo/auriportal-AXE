// src/endpoints/tecnicas-post-practica-api.js
// API endpoints para técnicas post-práctica

import { verificarAccesoAdmin } from './transmutaciones-api.js';
import { listarTecnicasPostPractica, obtenerTecnicaPostPractica, crearTecnicaPostPractica, actualizarTecnicaPostPractica, eliminarTecnicaPostPractica } from '../services/tecnicas-post-practica.js';

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

export default async function tecnicasPostPracticaApiHandler(request, env, ctx) {
  if (!(await verificarAccesoAdmin(request, env))) {
    return renderError('Acceso denegado', 403);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const normalizedPath = path.replace('/api/tecnicas-post-practica', '').replace(/\/$/, '') || '/';

  try {
    // GET /api/tecnicas-post-practica - Listar todas las técnicas
    if (normalizedPath === '/' && method === 'GET') {
      const tecnicas = await listarTecnicasPostPractica();
      return renderSuccess('Técnicas post-práctica obtenidas', { tecnicas });
    }

    // POST /api/tecnicas-post-practica - Crear nueva técnica
    if (normalizedPath === '/' && method === 'POST') {
      const body = await request.json();
      const { 
        nombre, descripcion, nivel, video_url, activar_reloj, musica_id,
        tipo, posicion, orden, obligatoria_global, obligatoria_por_nivel, minutos, tiene_video, contenido_html
      } = body;
      
      if (!nombre) {
        return renderError('El nombre es requerido', 400);
      }
      
      const id = await crearTecnicaPostPractica({ 
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
      const tecnica = await obtenerTecnicaPostPractica(id);
      return renderSuccess('Técnica post-práctica creada', { tecnica });
    }

    // GET /api/tecnicas-post-practica/:id - Obtener una técnica
    if (normalizedPath.startsWith('/') && method === 'GET') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const tecnica = await obtenerTecnicaPostPractica(id);
      if (!tecnica) {
        return renderError('Técnica post-práctica no encontrada', 404);
      }
      return renderSuccess('Técnica post-práctica obtenida', { tecnica });
    }

    // PUT /api/tecnicas-post-practica/:id - Actualizar técnica
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
      
      const actualizado = await actualizarTecnicaPostPractica(id, { 
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
        return renderError('Error actualizando técnica post-práctica', 500);
      }
      const tecnica = await obtenerTecnicaPostPractica(id);
      return renderSuccess('Técnica post-práctica actualizada', { tecnica });
    }

    // DELETE /api/tecnicas-post-practica/:id - Eliminar técnica
    if (normalizedPath.startsWith('/') && method === 'DELETE') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const eliminado = await eliminarTecnicaPostPractica(id);
      if (!eliminado) {
        return renderError('Error eliminando técnica post-práctica', 500);
      }
      return renderSuccess('Técnica post-práctica eliminada');
    }

    return renderError('Ruta no encontrada', 404);
  } catch (error) {
    console.error('Error en API de técnicas post-práctica:', error);
    return renderError(error.message || 'Error interno del servidor', 500);
  }
}


