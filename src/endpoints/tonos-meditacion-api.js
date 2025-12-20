// src/endpoints/tonos-meditacion-api.js
// API endpoints para tonos de meditación

import * as tonosService from '../services/tonos-meditacion.js';

/**
 * GET /api/tonos-meditacion
 * Lista todos los tonos activos
 */
export async function listarTonos(request, env, ctx) {
  try {
    const tonos = await tonosService.listarTonos();
    return new Response(JSON.stringify(tonos), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error listando tonos:', error);
    return new Response(
      JSON.stringify({ error: 'Error al listar tonos' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/tonos-meditacion/por-defecto
 * Obtiene el tono por defecto
 */
export async function obtenerTonoPorDefecto(request, env, ctx) {
  try {
    const tono = await tonosService.obtenerTonoPorDefecto();
    
    if (!tono) {
      return new Response(
        JSON.stringify({ error: 'No hay tono por defecto configurado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(JSON.stringify(tono), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error obteniendo tono por defecto:', error);
    return new Response(
      JSON.stringify({ error: 'Error al obtener tono por defecto' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/tonos-meditacion/:id
 * Obtiene un tono por ID
 */
export async function obtenerTono(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tonoId = parseInt(pathParts[pathParts.length - 1]);
    
    if (isNaN(tonoId)) {
      return new Response(
        JSON.stringify({ error: 'ID inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const tono = await tonosService.obtenerTono(tonoId);
    
    if (!tono) {
      return new Response(
        JSON.stringify({ error: 'Tono no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(JSON.stringify(tono), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error obteniendo tono:', error);
    return new Response(
      JSON.stringify({ error: 'Error al obtener tono' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/tonos-meditacion
 * Crea un nuevo tono
 */
export async function crearTono(request, env, ctx) {
  try {
    const datos = await request.json();
    const tonoId = await tonosService.crearTono(datos);
    
    return new Response(
      JSON.stringify({ success: true, id: tonoId }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creando tono:', error);
    return new Response(
      JSON.stringify({ error: 'Error al crear tono' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /api/tonos-meditacion/:id
 * Actualiza un tono
 */
export async function actualizarTono(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tonoId = parseInt(pathParts[pathParts.length - 1]);
    
    if (isNaN(tonoId)) {
      return new Response(
        JSON.stringify({ error: 'ID inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const datos = await request.json();
    const success = await tonosService.actualizarTono(tonoId, datos);
    
    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Error al actualizar tono' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error actualizando tono:', error);
    return new Response(
      JSON.stringify({ error: 'Error al actualizar tono' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/tonos-meditacion/:id
 * Elimina un tono (soft delete)
 */
export async function eliminarTono(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tonoId = parseInt(pathParts[pathParts.length - 1]);
    
    if (isNaN(tonoId)) {
      return new Response(
        JSON.stringify({ error: 'ID inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const success = await tonosService.eliminarTono(tonoId);
    
    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Error al eliminar tono' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error eliminando tono:', error);
    return new Response(
      JSON.stringify({ error: 'Error al eliminar tono' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}




















