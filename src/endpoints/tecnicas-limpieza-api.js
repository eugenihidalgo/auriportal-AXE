// src/endpoints/tecnicas-limpieza-api.js
// API endpoints para técnicas de limpieza

import { verificarAccesoAdmin } from './transmutaciones-api.js';
import { listarTecnicas, obtenerTecnica, crearTecnica, actualizarTecnica, eliminarTecnica } from '../services/tecnicas-limpieza.js';

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

export default async function tecnicasLimpiezaApiHandler(request, env, ctx) {
  if (!(await verificarAccesoAdmin(request, env))) {
    return renderError('Acceso denegado', 403);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const normalizedPath = path.replace('/api/tecnicas-limpieza', '').replace(/\/$/, '') || '/';

  try {
    // GET /api/tecnicas-limpieza - Listar todas las técnicas
    if (normalizedPath === '/' && method === 'GET') {
      const tecnicas = await listarTecnicas();
      return renderSuccess('Técnicas obtenidas', { tecnicas });
    }

    // POST /api/tecnicas-limpieza - Crear nueva técnica
    if (normalizedPath === '/' && method === 'POST') {
      const body = await request.json();
      const { nombre, descripcion, nivel, aplica_energias_indeseables, aplica_limpiezas_recurrentes } = body;
      
      if (!nombre) {
        return renderError('El nombre es requerido', 400);
      }
      
      const id = await crearTecnica({ 
        nombre, 
        descripcion: descripcion || '', 
        nivel: nivel || 1,
        aplica_energias_indeseables: aplica_energias_indeseables || false,
        aplica_limpiezas_recurrentes: aplica_limpiezas_recurrentes || false
      });
      const tecnica = await obtenerTecnica(id);
      return renderSuccess('Técnica creada', { tecnica });
    }

    // GET /api/tecnicas-limpieza/:id - Obtener una técnica
    if (normalizedPath.startsWith('/') && method === 'GET') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const tecnica = await obtenerTecnica(id);
      if (!tecnica) {
        return renderError('Técnica no encontrada', 404);
      }
      return renderSuccess('Técnica obtenida', { tecnica });
    }

    // PUT /api/tecnicas-limpieza/:id - Actualizar técnica
    if (normalizedPath.startsWith('/') && method === 'PUT') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const body = await request.json();
      const { nombre, descripcion, nivel, activo, aplica_energias_indeseables, aplica_limpiezas_recurrentes } = body;
      
      const actualizado = await actualizarTecnica(id, { 
        nombre, 
        descripcion, 
        nivel, 
        activo,
        aplica_energias_indeseables,
        aplica_limpiezas_recurrentes
      });
      if (!actualizado) {
        return renderError('Error actualizando técnica', 500);
      }
      const tecnica = await obtenerTecnica(id);
      return renderSuccess('Técnica actualizada', { tecnica });
    }

    // DELETE /api/tecnicas-limpieza/:id - Eliminar técnica
    if (normalizedPath.startsWith('/') && method === 'DELETE') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const eliminado = await eliminarTecnica(id);
      if (!eliminado) {
        return renderError('Error eliminando técnica', 500);
      }
      return renderSuccess('Técnica eliminada');
    }

    return renderError('Ruta no encontrada', 404);
  } catch (error) {
    console.error('Error en API de técnicas de limpieza:', error);
    return renderError(error.message || 'Error interno del servidor', 500);
  }
}

