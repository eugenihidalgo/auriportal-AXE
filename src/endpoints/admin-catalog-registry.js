// src/endpoints/admin-catalog-registry.js
// Panel admin para gestionar Registro de Catálogos PDE

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { listCatalogs, getCatalogById, updateCatalogMeta, createCatalog } from '../services/pde-catalog-registry-service.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    // Escapar caracteres especiales de regex en key para evitar errores
    const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{{${escapedKey}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza el listado de catálogos registrados
 */
export async function renderCatalogList(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  let catalogs = [];
  try {
    catalogs = await listCatalogs({ onlyActive: false }); // Mostrar todos para poder ver archived
  } catch (error) {
    console.error('Error al cargar catálogos:', error);
  }

  // Generar filas de la tabla
  const catalogRows = catalogs.length > 0 ? catalogs.map(catalog => {
    const labelEscapado = (catalog.label || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const keyEscapado = (catalog.catalog_key || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    
    const statusBadge = catalog.status === 'active' 
      ? '<span class="px-2 py-1 bg-green-600 text-white text-xs rounded">Activo</span>'
      : '<span class="px-2 py-1 bg-gray-600 text-white text-xs rounded">Archivado</span>';
    
    // Badges de capacidades
    const capabilities = [];
    if (catalog.supports_level) capabilities.push('<span class="px-2 py-0.5 bg-blue-600 text-white text-xs rounded mr-1">Nivel</span>');
    if (catalog.supports_priority) capabilities.push('<span class="px-2 py-0.5 bg-purple-600 text-white text-xs rounded mr-1">Prioridad</span>');
    if (catalog.supports_obligatory) capabilities.push('<span class="px-2 py-0.5 bg-orange-600 text-white text-xs rounded mr-1">Obligatorio</span>');
    if (catalog.supports_duration) capabilities.push('<span class="px-2 py-0.5 bg-cyan-600 text-white text-xs rounded mr-1">Duración</span>');
    const capabilitiesHtml = capabilities.join('') || '<span class="text-slate-500 text-xs">-</span>';
    
    const usableBadge = catalog.usable_for_motors 
      ? '<span class="px-2 py-1 bg-green-600 text-white text-xs rounded">Sí</span>'
      : '<span class="px-2 py-1 bg-red-600 text-white text-xs rounded">No</span>';
    
    // Escapar ID para uso seguro en data attribute
    const idEscapado = String(catalog.id || '').replace(/"/g, '&quot;');
    
    return `
    <tr class="border-b border-slate-700 hover:bg-slate-700" data-catalog-id="${idEscapado}">
      <td class="py-3 px-4 text-white font-medium">${labelEscapado}</td>
      <td class="py-3 px-4 text-slate-300 text-sm font-mono">${keyEscapado}</td>
      <td class="py-3 px-4 text-slate-300 text-sm font-mono">${(catalog.source_table || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
      <td class="py-3 px-4">${usableBadge}</td>
      <td class="py-3 px-4">${capabilitiesHtml}</td>
      <td class="py-3 px-4">${statusBadge}</td>
      <td class="py-3 px-4">
        <button 
          class="btn-editar-catalog px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors inline-block" 
          data-catalog-id="${idEscapado}"
        >Editar</button>
      </td>
    </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="7" class="py-8 text-center text-slate-400">No hay catálogos registrados.</td>
    </tr>
  `;

  const url = new URL(request.url);
  const activePath = url.pathname;

  const listTemplate = readFileSync(join(__dirname, '../core/html/admin/catalog-registry/catalog-list.html'), 'utf-8');
  const contentHtml = replace(listTemplate, {
    CATALOG_ROWS: catalogRows
  });

  return renderAdminPage({
    title: 'Registro de Catálogos PDE',
    contentHtml,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminCatalogRegistryHandler(request, env, ctx) {
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-catalog-registry.js:101',message:'Handler catalog-registry: entrada',data:{url:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-catalog-registry.js:105',message:'Handler catalog-registry: path y method extraídos',data:{path,method,searchParams:Object.fromEntries(url.searchParams)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  // POST /admin/pde/catalog-registry - Crear catálogo (API)
  if (path === '/admin/pde/catalog-registry' && method === 'POST') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const body = await request.json();
      
      // Validación de campos requeridos
      if (!body.catalog_key || !body.label || !body.source_table) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'catalog_key, label y source_table son requeridos' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validar catalog_key (solo letras, números, guiones bajos)
      if (!/^[a-z0-9_]+$/.test(body.catalog_key)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'catalog_key solo puede contener letras minúsculas, números y guiones bajos' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Preparar datos del catálogo
      const catalogData = {
        catalog_key: body.catalog_key.trim(),
        label: body.label.trim(),
        description: body.description?.trim() || null,
        source_table: body.source_table.trim(),
        source_endpoint: body.source_endpoint?.trim() || null,
        usable_for_motors: body.usable_for_motors !== undefined ? Boolean(body.usable_for_motors) : true,
        supports_level: Boolean(body.supports_level || false),
        supports_priority: Boolean(body.supports_priority || false),
        supports_obligatory: Boolean(body.supports_obligatory || false),
        supports_duration: Boolean(body.supports_duration || false),
        status: body.status || 'active'
      };

      const created = await createCatalog(catalogData);

      return new Response(JSON.stringify({ success: true, catalog: created }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al crear catálogo:', error);
      
      // Si es error de duplicado, devolver 409
      if (error.message.includes('ya existe')) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message || 'Error al crear catálogo' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /admin/pde/catalog-registry/:id - Obtener catálogo (API)
  if (path.match(/^\/admin\/pde\/catalog-registry\/([^\/]+)$/) && method === 'GET') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const match = path.match(/^\/admin\/pde\/catalog-registry\/([^\/]+)$/);
    const id = match[1];

    try {
      const catalog = await getCatalogById(id);
      if (!catalog) {
        return new Response(JSON.stringify({ success: false, error: 'Catálogo no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, catalog }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al obtener catálogo:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // PUT /admin/pde/catalog-registry/:id - Actualizar catálogo (API)
  if (path.match(/^\/admin\/pde\/catalog-registry\/([^\/]+)$/) && method === 'PUT') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const match = path.match(/^\/admin\/pde\/catalog-registry\/([^\/]+)$/);
    const id = match[1];

    try {
      const body = await request.json();
      
      // Campos permitidos para actualización (no permitir cambiar catalog_key ni source_table)
      const allowedFields = [
        'label', 'description', 'source_endpoint',
        'usable_for_motors', 'supports_level', 'supports_priority',
        'supports_obligatory', 'supports_duration', 'status'
      ];
      
      const patch = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          patch[field] = body[field];
        }
      }

      const updated = await updateCatalogMeta(id, patch);
      if (!updated) {
        return new Response(JSON.stringify({ success: false, error: 'Catálogo no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, catalog: updated }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al actualizar catálogo:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /admin/pde/catalog-registry (API para dropdowns) - DEBE IR ANTES de la ruta HTML
  if (path === '/admin/pde/catalog-registry' && method === 'GET' && url.searchParams.get('format') === 'json') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const usableOnly = url.searchParams.get('usable_for_motors') === 'true';
      const catalogs = await listCatalogs({ 
        onlyActive: true,
        usableForMotors: usableOnly ? true : undefined
      });

      return new Response(JSON.stringify({ success: true, catalogs }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al listar catálogos:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /admin/pde/catalog-registry - Lista de catálogos (HTML)
  // #region agent log
  if (path === '/admin/pde/catalog-registry' && method === 'GET') {
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-catalog-registry.js:211',message:'Handler catalog-registry: ruta HTML detectada',data:{path,method,matches:path === '/admin/pde/catalog-registry'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    return await renderCatalogList(request, env);
  }
  // #endregion

  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-catalog-registry.js:215',message:'Handler catalog-registry: ninguna ruta coincidió, devolviendo 404',data:{path,method,matchedId:path.match(/^\/admin\/pde\/catalog-registry\/([^\/]+)$/) !== null,matchedJson:path === '/admin/pde/catalog-registry' && method === 'GET' && url.searchParams.get('format') === 'json',matchedHtml:path === '/admin/pde/catalog-registry' && method === 'GET'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  return new Response('Not Found', { status: 404 });
}

