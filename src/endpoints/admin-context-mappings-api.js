// src/endpoints/admin-context-mappings-api.js
// API endpoints para gestión de Context Mappings
//
// Endpoints:
// - GET    /admin/api/context-mappings?context_key= - Lista mappings por contexto
// - POST   /admin/api/context-mappings - Crea o actualiza un mapping
// - PATCH  /admin/api/context-mappings/:id - Actualiza un mapping
// - DELETE /admin/api/context-mappings/:id - Elimina un mapping (soft delete)

import { requireAdminContext } from '../core/auth-context.js';
import {
  listMappingsByContextKey,
  upsertMapping,
  softDeleteMapping
} from '../services/context-mappings-service.js';
import { logError } from '../core/observability/logger.js';

/**
 * Handler principal de la API de context mappings
 */
export default async function adminContextMappingsApiHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    // Para APIs, devolver JSON en lugar de HTML cuando falla la autenticación
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'No autenticado',
      message: 'Se requiere autenticación de administrador'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // GET /admin/api/context-mappings?context_key= - Lista mappings por contexto
    if (path === '/admin/api/context-mappings' && method === 'GET') {
      return await handleListMappings(request, env);
    }

    // POST /admin/api/context-mappings - Crea o actualiza un mapping
    if (path === '/admin/api/context-mappings' && method === 'POST') {
      return await handleUpsertMapping(request, env);
    }

    // PATCH /admin/api/context-mappings/:id - Actualiza un mapping
    const matchPatch = path.match(/^\/admin\/api\/context-mappings\/([^\/]+)$/);
    if (matchPatch && method === 'PATCH') {
      const id = matchPatch[1];
      return await handleUpdateMapping(id, request, env);
    }

    // DELETE /admin/api/context-mappings/:id - Elimina un mapping
    if (matchPatch && method === 'DELETE') {
      const id = matchPatch[1];
      return await handleDeleteMapping(id, request, env);
    }

    // Ruta no encontrada
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Ruta no encontrada' 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][CONTEXT-MAPPINGS] Error en API de context mappings:', error);
    logError(error, { context: 'admin-context-mappings-api', path, method });
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error interno del servidor',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Lista mappings por contexto
 */
async function handleListMappings(request, env) {
  try {
    const url = new URL(request.url);
    const contextKey = url.searchParams.get('context_key');

    if (!contextKey) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'context_key es obligatorio' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { mappings, warnings } = await listMappingsByContextKey(contextKey);

    return new Response(JSON.stringify({ 
      ok: true,
      mappings,
      warnings: warnings.length > 0 ? warnings : undefined
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][CONTEXT-MAPPINGS] Error listando mappings:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error listando mappings',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Crea o actualiza un mapping
 */
async function handleUpsertMapping(request, env) {
  try {
    const body = await request.json();
    
    const { context_key, mapping_key, label, description, mapping_data, sort_order, active } = body;

    // Validaciones básicas
    if (!context_key || !mapping_key) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'context_key y mapping_key son obligatorios' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // mapping_data puede ser vacío, pero debe ser un objeto
    const finalMappingData = mapping_data || {};

    const { mapping, warnings } = await upsertMapping(
      context_key,
      mapping_key,
      finalMappingData,
      {
        label: label || null,
        description: description || null,
        sortOrder: sort_order !== undefined ? sort_order : 0,
        active: active !== undefined ? active : true
      }
    );

    if (!mapping) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'No se pudo crear/actualizar el mapping',
        warnings: warnings.length > 0 ? warnings : undefined
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXT-MAPPINGS] Mapping creado/actualizado: ${context_key}.${mapping_key}`);

    return new Response(JSON.stringify({ 
      ok: true,
      mapping,
      warnings: warnings.length > 0 ? warnings : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AXE][CONTEXT-MAPPINGS] Error creando/actualizando mapping:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error creando/actualizando mapping',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Actualiza un mapping existente
 */
async function handleUpdateMapping(id, request, env) {
  try {
    const body = await request.json();
    
    // Para actualizar, necesitamos obtener el mapping actual primero
    // Luego hacer upsert con los nuevos valores
    const { getDefaultContextMappingsRepo } = await import('../infra/repos/context-mappings-repo-pg.js');
    const repo = getDefaultContextMappingsRepo();
    
    // Buscar el mapping por ID (necesitamos hacer una query especial)
    const { query } = await import('../../database/pg.js');
    const result = await query(
      'SELECT * FROM context_mappings WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Mapping no encontrado' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existing = result.rows[0];
    const contextKey = existing.context_key;
    const mappingKey = existing.mapping_key;

    // Actualizar solo los campos proporcionados
    const mappingData = body.mapping_data !== undefined ? body.mapping_data : (typeof existing.mapping_data === 'string' ? JSON.parse(existing.mapping_data) : existing.mapping_data);
    const label = body.label !== undefined ? body.label : existing.label;
    const description = body.description !== undefined ? body.description : existing.description;
    const sortOrder = body.sort_order !== undefined ? body.sort_order : existing.sort_order;
    const active = body.active !== undefined ? body.active : existing.active;

    const { mapping, warnings } = await upsertMapping(
      contextKey,
      mappingKey,
      typeof mappingData === 'string' ? JSON.parse(mappingData) : mappingData,
      {
        label: label || null,
        description: description || null,
        sortOrder,
        active
      }
    );

    if (!mapping) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'No se pudo actualizar el mapping',
        warnings: warnings.length > 0 ? warnings : undefined
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXT-MAPPINGS] Mapping actualizado: ${id}`);

    return new Response(JSON.stringify({ 
      ok: true,
      mapping,
      warnings: warnings.length > 0 ? warnings : undefined
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][CONTEXT-MAPPINGS] Error actualizando mapping '${id}':`, error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error actualizando mapping',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Elimina un mapping (soft delete)
 */
async function handleDeleteMapping(id, request, env) {
  try {
    const { success, warnings } = await softDeleteMapping(id);
    
    if (!success) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Mapping no encontrado',
        warnings: warnings.length > 0 ? warnings : undefined
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AXE][CONTEXT-MAPPINGS] Mapping eliminado: ${id}`);

    return new Response(JSON.stringify({ 
      ok: true,
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AXE][CONTEXT-MAPPINGS] Error eliminando mapping '${id}':`, error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error eliminando mapping',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

