// src/endpoints/admin-decretos.js
// Panel admin para gestionar Biblioteca de Decretos

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { requireAdminContext } from '../core/auth-context.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';
import { 
  listarDecretos, 
  obtenerDecreto, 
  crearDecreto, 
  actualizarDecreto, 
  eliminarDecreto,
  restaurarDecreto
} from '../services/decretos-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza el listado de decretos
 */
export async function renderListadoDecretos(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  let decretos = [];
  try {
    decretos = await listarDecretos();
  } catch (error) {
    console.error('Error al cargar decretos:', error);
  }

  // Generar filas de la tabla
  const decretosRows = decretos.length > 0 ? decretos.map(decreto => {
    const nombreEscapado = (decreto.nombre || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const contenidoHtmlEscapado = (decreto.contenido_html || '').replace(/"/g, '&quot;').replace(/\n/g, '\\n');
    const descripcionEscapada = (decreto.descripcion || '').replace(/"/g, '&quot;').replace(/\n/g, '\\n');
    
    return `
    <tr class="border-b border-slate-700 hover:bg-slate-700" data-nombre="${nombreEscapado.toLowerCase()}">
      <td class="py-3 px-4 text-white">${nombreEscapado}</td>
      <td class="py-3 px-4 text-slate-300">${decreto.nivel_minimo || 1}</td>
      <td class="py-3 px-4 text-slate-300">${decreto.posicion || 'inicio'}</td>
      <td class="py-3 px-4 text-slate-300">${decreto.obligatoria_global ? 'Sí' : 'No'}</td>
      <td class="py-3 px-4 text-slate-300">${decreto.activo !== false && !decreto.deleted_at ? '✅' : '❌'}</td>
      <td class="py-3 px-4">
        <button onclick="mostrarPreviewRapido(${decreto.id}, '${nombreEscapado}', \`${contenidoHtmlEscapado}\`)" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors inline-block mr-2">👁️ Preview</button>
        <a href="/admin/decretos/editar/${decreto.id}" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors inline-block mr-2">Editar</a>
        <button onclick="eliminarDecreto(${decreto.id})" class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors">Eliminar</button>
      </td>
    </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="6" class="py-8 text-center text-slate-400">No hay decretos creados aún.</td>
    </tr>
  `;

  const listadoTemplate = readFileSync(join(__dirname, '../core/html/admin/decretos/decretos-listado.html'), 'utf-8');
  const content = replace(listadoTemplate, {
    DECRETOS_ROWS: decretosRows
  });

  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: 'Biblioteca de Decretos',
    CONTENT: content,
    CURRENT_PATH: '/admin/decretos'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Renderiza el editor de decreto
 */
export async function renderEditarDecreto(request, env, decretoId) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  let decreto = null;
  if (decretoId && decretoId !== 'nuevo') {
    try {
      decreto = await obtenerDecreto(parseInt(decretoId));
    } catch (error) {
      console.error('Error al cargar decreto:', error);
    }
  }

  const editarTemplate = readFileSync(join(__dirname, '../core/html/admin/decretos/decretos-editar.html'), 'utf-8');
  const content = replace(editarTemplate, {
    DECRETO_ID: decreto ? decreto.id : 'nuevo',
    NOMBRE: decreto ? (decreto.nombre || '').replace(/"/g, '&quot;') : '',
    DESCRIPCION: decreto ? (decreto.descripcion || '').replace(/"/g, '&quot;').replace(/\n/g, '\\n') : '',
    CONTENIDO_HTML: decreto ? (decreto.contenido_html || '').replace(/"/g, '&quot;').replace(/\n/g, '\\n') : '',
    NIVEL_MINIMO: decreto ? (decreto.nivel_minimo || 1) : 1,
    POSICION: decreto ? (decreto.posicion || 'inicio') : 'inicio',
    OBLIGATORIA_GLOBAL: decreto ? (decreto.obligatoria_global ? 'checked' : '') : '',
    OBLIGATORIA_POR_NIVEL: decreto ? (JSON.stringify(decreto.obligatoria_por_nivel || {})).replace(/"/g, '&quot;') : '{}'
  });

  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: decreto ? `Editar Decreto: ${decreto.nombre}` : 'Nuevo Decreto',
    CONTENT: content,
    CURRENT_PATH: '/admin/decretos'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * API: Crear decreto (legacy - mantiene compatibilidad)
 */
export async function apiCrearDecreto(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const nuevoDecreto = await crearDecreto({
      nombre: body.nombre || 'Decreto sin nombre',
      contenido_html: body.contenido_html || '',
      content_delta: body.content_delta,
      content_text: body.content_text,
      descripcion: body.descripcion,
      nivel_minimo: body.nivel_minimo || 1,
      posicion: body.posicion || 'inicio',
      obligatoria_global: body.obligatoria_global || false,
      obligatoria_por_nivel: body.obligatoria_por_nivel || {},
      orden: body.orden || 0
    });

    return new Response(JSON.stringify({ 
      success: true, 
      id: nuevoDecreto.id,
      decreto: nuevoDecreto
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al crear decreto:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error al crear decreto' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * API: Actualizar decreto
 */
export async function apiActualizarDecreto(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { id, ...datos } = body;
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID de decreto requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await actualizarDecreto(id, datos);

    return new Response(JSON.stringify({ 
      success: true 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al actualizar decreto:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error al actualizar decreto' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * API: Eliminar decreto (soft delete)
 */
export async function apiEliminarDecreto(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID de decreto requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await eliminarDecreto(id);

    return new Response(JSON.stringify({ 
      success: true 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al eliminar decreto:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error al eliminar decreto' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * API: Sincronizar decretos (stub)
 */
export async function apiSincronizarDecretos(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Lógica aún no implementada
  return new Response(JSON.stringify({ 
    message: 'Sincronización aún no implementada',
    success: false
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// ENDPOINTS RESTful NUEVOS: /api/pde/decretos/*
// ============================================================================

/**
 * GET /api/pde/decretos
 * Lista todos los decretos (JSON)
 */
export async function apiListarDecretos(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const soloActivos = !includeDeleted;
    
    const decretos = await listarDecretos(soloActivos);
    
    return new Response(JSON.stringify({ 
      success: true,
      decretos
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al listar decretos:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error al listar decretos' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/pde/decretos/:id
 * Obtiene un decreto por ID
 */
export async function apiObtenerDecreto(request, env, decretoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const id = parseInt(decretoId);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const decreto = await obtenerDecreto(id);
    
    if (!decreto) {
      return new Response(JSON.stringify({ error: 'Decreto no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      decreto
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al obtener decreto:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error al obtener decreto' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/pde/decretos
 * Crea un nuevo decreto
 */
export async function apiCrearDecretoREST(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    
    if (!body.nombre || !body.contenido_html) {
      return new Response(JSON.stringify({ 
        error: 'Nombre y contenido_html son obligatorios' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const nuevoDecreto = await crearDecreto({
      nombre: body.nombre,
      contenido_html: body.contenido_html,
      content_delta: body.content_delta,
      content_text: body.content_text,
      descripcion: body.descripcion,
      nivel_minimo: body.nivel_minimo || 1,
      posicion: body.posicion || 'inicio',
      obligatoria_global: body.obligatoria_global || false,
      obligatoria_por_nivel: body.obligatoria_por_nivel || {},
      orden: body.orden || 0
    });

    return new Response(JSON.stringify({ 
      success: true,
      decreto: nuevoDecreto
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al crear decreto:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error al crear decreto' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /api/pde/decretos/:id
 * Actualiza un decreto existente
 */
export async function apiActualizarDecretoREST(request, env, decretoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const id = parseInt(decretoId);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const decretoActualizado = await actualizarDecreto(id, body);
    
    if (!decretoActualizado) {
      return new Response(JSON.stringify({ error: 'Decreto no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      decreto: decretoActualizado
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al actualizar decreto:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error al actualizar decreto' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /api/pde/decretos/:id
 * Elimina un decreto (soft delete)
 */
export async function apiEliminarDecretoREST(request, env, decretoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const id = parseInt(decretoId);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await eliminarDecreto(id);

    return new Response(JSON.stringify({ 
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al eliminar decreto:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error al eliminar decreto' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/pde/decretos/:id/restore
 * Restaura un decreto eliminado
 */
export async function apiRestaurarDecreto(request, env, decretoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const id = parseInt(decretoId);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const decretoRestaurado = await restaurarDecreto(id);
    
    if (!decretoRestaurado) {
      return new Response(JSON.stringify({ error: 'Decreto no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      decreto: decretoRestaurado
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al restaurar decreto:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error al restaurar decreto' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
















