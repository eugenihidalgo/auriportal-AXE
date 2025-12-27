// src/endpoints/admin-automation-definitions-api.js
// API endpoints READ-ONLY para definiciones de automatizaciones (Fase D - Fase 6.A)
//
// Endpoints:
// - GET /admin/api/automations - Lista todas las definiciones
// - GET /admin/api/automations/:id - Obtiene una definición
//
// PRINCIPIOS:
// - SOLO operaciones GET (read-only)
// - SOLO SELECT en PostgreSQL
// - PROHIBIDO: crear, editar, validar, cambiar status, ejecutar, emitir señales, tocar flags

import { requireAdminContext } from '../core/auth-context.js';
import { query } from '../../database/pg.js';

/**
 * Handler principal de la API de definiciones de automatizaciones
 */
export default async function adminAutomationDefinitionsApiHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
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

  // Solo permitir GET
  if (method !== 'GET') {
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Método no permitido',
      message: 'Solo se permiten operaciones GET (read-only)'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // GET /admin/api/automations - Lista todas las definiciones
    if (path === '/admin/api/automations' && method === 'GET') {
      return await handleListDefinitions(request, env);
    }

    // GET /admin/api/automations/:id - Obtiene una definición
    const matchGet = path.match(/^\/admin\/api\/automations\/([^\/]+)$/);
    if (matchGet && method === 'GET') {
      const definitionId = matchGet[1];
      return await handleGetDefinition(definitionId, request, env);
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
    console.error('[AUTOMATION_DEFINITIONS_API] Error en API de definiciones:', error);
    
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
 * Lista todas las definiciones de automatizaciones
 */
async function handleListDefinitions(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || null;
  const automationKey = url.searchParams.get('automation_key') || null;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    let whereClause = ['deleted_at IS NULL'];
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereClause.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (automationKey) {
      whereClause.push(`automation_key = $${paramIndex++}`);
      params.push(automationKey);
    }

    const whereSQL = `WHERE ${whereClause.join(' AND ')}`;

    params.push(limit);
    params.push(offset);

    const result = await query(`
      SELECT 
        id,
        automation_key,
        name,
        description,
        version,
        status,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM automation_definitions
      ${whereSQL}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);

    // Contar total (para paginación)
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM automation_definitions
      ${whereSQL}
    `, params.slice(0, params.length - 2)); // Excluir limit y offset

    const total = parseInt(countResult.rows[0].total, 10);

    const definitions = result.rows.map(row => ({
      id: row.id,
      automation_key: row.automation_key,
      name: row.name,
      description: row.description,
      version: row.version,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by
    }));

    return new Response(JSON.stringify({ 
      ok: true,
      definitions,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[AUTOMATION_DEFINITIONS_API] Error listando definiciones:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error listando definiciones',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene una definición por ID
 */
async function handleGetDefinition(definitionId, request, env) {
  try {
    // Validar que es un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(definitionId)) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'ID inválido',
        message: 'El ID debe ser un UUID válido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await query(`
      SELECT 
        id,
        automation_key,
        name,
        description,
        definition,
        version,
        status,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM automation_definitions
      WHERE id = $1 AND deleted_at IS NULL
    `, [definitionId]);

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Definición no encontrada' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const row = result.rows[0];
    const definition = {
      id: row.id,
      automation_key: row.automation_key,
      name: row.name,
      description: row.description,
      definition: row.definition, // JSON completo
      version: row.version,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by
    };

    return new Response(JSON.stringify({ 
      ok: true,
      definition 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[AUTOMATION_DEFINITIONS_API] Error obteniendo definición '${definitionId}':`, error);
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Error obteniendo definición',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}





