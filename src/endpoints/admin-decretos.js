// src/endpoints/admin-decretos.js
// Panel admin para gestionar Biblioteca de Decretos

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { 
  listarDecretos, 
  obtenerDecreto, 
  crearDecreto, 
  actualizarDecreto, 
  eliminarDecreto 
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
  const decretosRows = decretos.length > 0 ? decretos.map(decreto => `
    <tr class="border-b border-slate-700 hover:bg-slate-700">
      <td class="py-3 px-4 text-white">${(decreto.nombre || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
      <td class="py-3 px-4 text-slate-300">${decreto.nivel_minimo || 1}</td>
      <td class="py-3 px-4 text-slate-300">${decreto.posicion || 'inicio'}</td>
      <td class="py-3 px-4 text-slate-300">${decreto.obligatoria_global ? 'Sí' : 'No'}</td>
      <td class="py-3 px-4 text-slate-300">${decreto.activo !== false ? '✅' : '❌'}</td>
      <td class="py-3 px-4">
        <a href="/admin/decretos/editar/${decreto.id}" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors inline-block mr-2">Editar</a>
        <button onclick="eliminarDecreto(${decreto.id})" class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors">Eliminar</button>
      </td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="6" class="py-8 text-center text-slate-400">No hay decretos creados aún.</td>
    </tr>
  `;

  const listadoTemplate = readFileSync(join(__dirname, '../core/html/admin/decretos/decretos-listado.html'), 'utf-8');
  const content = replace(listadoTemplate, {
    DECRETOS_ROWS: decretosRows
  });

  const html = replace(baseTemplate, {
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
    CONTENIDO_HTML: decreto ? (decreto.contenido_html || '').replace(/"/g, '&quot;').replace(/\n/g, '\\n') : '',
    NIVEL_MINIMO: decreto ? (decreto.nivel_minimo || 1) : 1,
    POSICION: decreto ? (decreto.posicion || 'inicio') : 'inicio',
    OBLIGATORIA_GLOBAL: decreto ? (decreto.obligatoria_global ? 'checked' : '') : '',
    OBLIGATORIA_POR_NIVEL: decreto ? (JSON.stringify(decreto.obligatoria_por_nivel || {})).replace(/"/g, '&quot;') : '{}'
  });

  const html = replace(baseTemplate, {
    TITLE: decreto ? `Editar Decreto: ${decreto.nombre}` : 'Nuevo Decreto',
    CONTENT: content,
    CURRENT_PATH: '/admin/decretos'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * API: Crear decreto
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
      nivel_minimo: body.nivel_minimo || 1
    });

    return new Response(JSON.stringify({ 
      success: true, 
      id: nuevoDecreto.id 
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






