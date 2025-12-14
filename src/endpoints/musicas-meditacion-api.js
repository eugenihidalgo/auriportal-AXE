// src/endpoints/musicas-meditacion-api.js
// API endpoints para músicas de meditación

import * as musicasService from '../services/musicas-meditacion.js';

/**
 * GET /api/musicas-meditacion
 * Lista todas las músicas activas
 */
export async function listarMusicas(request, env, ctx) {
  try {
    const musicas = await musicasService.listarMusicas();
    return new Response(JSON.stringify(musicas), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error listando músicas:', error);
    return new Response(
      JSON.stringify({ error: 'Error al listar músicas' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/musicas-meditacion/:id
 * Obtiene una música por ID
 */
export async function obtenerMusica(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const musicaId = parseInt(pathParts[pathParts.length - 1]);
    
    if (isNaN(musicaId)) {
      return new Response(
        JSON.stringify({ error: 'ID inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const musica = await musicasService.obtenerMusica(musicaId);
    
    if (!musica) {
      return new Response(
        JSON.stringify({ error: 'Música no encontrada' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(JSON.stringify(musica), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error obteniendo música:', error);
    return new Response(
      JSON.stringify({ error: 'Error al obtener música' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/musicas-meditacion
 * Crea una nueva música
 */
export async function crearMusica(request, env, ctx) {
  try {
    const datos = await request.json();
    const musicaId = await musicasService.crearMusica(datos);
    
    return new Response(
      JSON.stringify({ success: true, id: musicaId }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creando música:', error);
    return new Response(
      JSON.stringify({ error: 'Error al crear música' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /api/musicas-meditacion/:id
 * Actualiza una música
 */
export async function actualizarMusica(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const musicaId = parseInt(pathParts[pathParts.length - 1]);
    
    if (isNaN(musicaId)) {
      return new Response(
        JSON.stringify({ error: 'ID inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const datos = await request.json();
    const success = await musicasService.actualizarMusica(musicaId, datos);
    
    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Error al actualizar música' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error actualizando música:', error);
    return new Response(
      JSON.stringify({ error: 'Error al actualizar música' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/musicas-meditacion/:id
 * Elimina una música (soft delete)
 */
export async function eliminarMusica(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const musicaId = parseInt(pathParts[pathParts.length - 1]);
    
    if (isNaN(musicaId)) {
      return new Response(
        JSON.stringify({ error: 'ID inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const success = await musicasService.eliminarMusica(musicaId);
    
    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Error al eliminar música' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error eliminando música:', error);
    return new Response(
      JSON.stringify({ error: 'Error al eliminar música' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}







