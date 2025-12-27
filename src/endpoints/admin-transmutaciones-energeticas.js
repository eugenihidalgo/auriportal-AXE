// src/endpoints/admin-transmutaciones-energeticas.js
// Panel admin para gestionar Transmutaciones Energéticas PDE
// Source of Truth canónico - Patrón replicado de catalog-registry

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { 
  listListas, getListaById, updateListaMeta, createLista, archiveLista,
  listItemsOrdered, createItem, updateItem,
  getRecurrentStateForItem, markCleanForAllRecurrent, markCleanForStudentRecurrent,
  getOneTimeStateForItem, incrementCleanForAllOneTime, adjustRemainingForStudent,
  getItemById
} from '../services/pde-transmutaciones-energeticas-service.js';
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
 * Renderiza el listado de listas de transmutaciones
 */
export async function renderTransmutacionesList(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  const url = new URL(request.url);
  const activePath = url.pathname;

  const listTemplate = readFileSync(join(__dirname, '../core/html/admin/transmutaciones-energeticas/transmutaciones-list.html'), 'utf-8');
  const contentHtml = replace(listTemplate, {
    LISTA_CARDS: '', // Se cargan dinámicamente via API
    ITEMS_ROWS: ''   // Se cargan dinámicamente via API
  });

  return renderAdminPage({
    title: 'Transmutaciones Energéticas',
    contentHtml,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminTransmutacionesEnergeticasHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // POST /admin/pde/transmutaciones-energeticas - Crear lista (API)
  if (path === '/admin/pde/transmutaciones-energeticas' && method === 'POST') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const body = await request.json();
      
      // Validación de campos requeridos
      if (!body.nombre) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'nombre es requerido' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Preparar datos de la lista
      const listaData = {
        nombre: body.nombre.trim(),
        tipo: body.tipo || 'recurrente',
        descripcion: body.descripcion?.trim() || null,
        orden: body.orden !== undefined ? parseInt(body.orden) : 0,
        category_key: body.category_key?.trim() || null,
        subtype_key: body.subtype_key?.trim() || null,
        tags: body.tags || null,
        status: body.status || 'active'
      };

      const created = await createLista(listaData);

      return new Response(JSON.stringify({ success: true, lista: created }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al crear lista:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message || 'Error al crear lista' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /admin/pde/transmutaciones-energeticas/:id - Obtener lista (API)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/([^\/]+)$/) && method === 'GET') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/([^\/]+)$/);
    const id = match[1];

    try {
      const lista = await getListaById(id);
      if (!lista) {
        return new Response(JSON.stringify({ success: false, error: 'Lista no encontrada' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, lista }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al obtener lista:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // PUT /admin/pde/transmutaciones-energeticas/:id - Actualizar lista (API)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/([^\/]+)$/) && method === 'PUT') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/([^\/]+)$/);
    const id = match[1];

    try {
      const body = await request.json();
      
      // Campos permitidos para actualización
      const patch = {};
      if (body.nombre !== undefined) patch.nombre = body.nombre.trim();
      if (body.tipo !== undefined) patch.tipo = body.tipo;
      if (body.descripcion !== undefined) patch.descripcion = body.descripcion?.trim() || null;
      if (body.orden !== undefined) patch.orden = parseInt(body.orden);
      if (body.category_key !== undefined) patch.category_key = body.category_key?.trim() || null;
      if (body.subtype_key !== undefined) patch.subtype_key = body.subtype_key?.trim() || null;
      if (body.tags !== undefined) patch.tags = body.tags;
      if (body.status !== undefined) patch.status = body.status;

      const updated = await updateListaMeta(id, patch);

      if (!updated) {
        return new Response(JSON.stringify({ success: false, error: 'Lista no encontrada' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, lista: updated }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al actualizar lista:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // DELETE /admin/pde/transmutaciones-energeticas/api/items/:id - DELETE físico de item (API)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)$/) && method === 'DELETE') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)$/);
      const itemId = match[1];

      // DELETE FÍSICO (no soft delete para items)
      const repo = (await import('../infra/repos/pde-transmutaciones-energeticas-repo-pg.js')).getDefaultPdeTransmutacionesEnergeticasRepo();
      const queryFn = (await import('../../database/pg.js')).query;
      
      const result = await queryFn(
        'DELETE FROM items_transmutaciones WHERE id = $1 RETURNING *',
        [itemId]
      );

      if (result.rows.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Item no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, item: result.rows[0] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error eliminando item:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // DELETE /admin/pde/transmutaciones-energeticas/:id - Archivar lista (soft delete) (API)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/([^\/]+)$/) && method === 'DELETE') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/([^\/]+)$/);
    const id = match[1];

    try {
      const archived = await archiveLista(id);

      if (!archived) {
        return new Response(JSON.stringify({ success: false, error: 'Lista no encontrada' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, lista: archived }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al archivar lista:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /admin/pde/transmutaciones-energeticas/api/listas - Lista listas (API)
  if (path === '/admin/pde/transmutaciones-energeticas/api/listas' && method === 'GET') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const url = new URL(request.url);
      const tipo = url.searchParams.get('tipo') || null;
      
      const listas = await listListas({ onlyActive: true, tipo });
      return new Response(JSON.stringify({ success: true, listas }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al listar listas:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /admin/pde/transmutaciones-energeticas/api/listas/:id/items - Lista items (API)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/listas\/([^\/]+)\/items$/) && method === 'GET') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/listas\/([^\/]+)\/items$/);
      const listaId = match[1];
      
      // LEY ABSOLUTA: ORDER BY nivel ASC, created_at ASC
      const items = await listItemsOrdered(listaId, { onlyActive: true });
      return new Response(JSON.stringify({ success: true, items }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al listar items:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /admin/pde/transmutaciones-energeticas/api/items - Crear item (API)
  if (path === '/admin/pde/transmutaciones-energeticas/api/items' && method === 'POST') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const body = await request.json();
      console.error('[transmutaciones] POST /api/items - body recibido:', JSON.stringify(body));
      
      if (!body.lista_id || !body.nombre) {
        return new Response(JSON.stringify({ success: false, error: 'lista_id y nombre son requeridos' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Asegurar que lista_id sea número
      const itemData = {
        ...body,
        lista_id: parseInt(body.lista_id)
      };
      
      console.error('[transmutaciones] Creando item con datos:', JSON.stringify(itemData));
      const item = await createItem(itemData);
      console.error('[transmutaciones] Item creado exitosamente:', item?.id);
      
      return new Response(JSON.stringify({ success: true, item }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[transmutaciones] Error al crear item:', error);
      console.error('[transmutaciones] Stack:', error.stack);
      return new Response(JSON.stringify({ success: false, error: error.message || 'Error desconocido al crear item' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // PUT /admin/pde/transmutaciones-energeticas/api/items/:id - Actualizar item (API)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)$/) && method === 'PUT') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)$/);
      const itemId = match[1];
      const body = await request.json();

      const updated = await updateItem(itemId, body);
      if (!updated) {
        return new Response(JSON.stringify({ success: false, error: 'Item no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, item: updated }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al actualizar item:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }


  // OPERACIONES MASTER - Recurrentes

  // GET /admin/pde/transmutaciones-energeticas/api/items/:id/master/students-recurrent - Ver alumnos (recurrente)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/students-recurrent$/) && method === 'GET') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/students-recurrent$/);
      const itemId = match[1];

      const item = await getItemById(itemId);
      if (!item) {
        return new Response(JSON.stringify({ success: false, error: 'Item no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const states = await getRecurrentStateForItem(itemId);
      return new Response(JSON.stringify({ success: true, item, states }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al obtener estado recurrente:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/mark-clean-all - Marcar limpio todos (recurrente)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/mark-clean-all$/) && method === 'POST') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/mark-clean-all$/);
      const itemId = match[1];

      const result = await markCleanForAllRecurrent(itemId);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error marcando limpio todos:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/mark-clean-student - Marcar limpio alumno (recurrente)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/mark-clean-student$/) && method === 'POST') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/mark-clean-student$/);
      const itemId = match[1];
      const body = await request.json();

      if (!body.student_email) {
        return new Response(JSON.stringify({ success: false, error: 'student_email es requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const state = await markCleanForStudentRecurrent(itemId, body.student_email);
      return new Response(JSON.stringify({ success: true, state }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error marcando limpio alumno:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // OPERACIONES MASTER - Una Vez

  // GET /admin/pde/transmutaciones-energeticas/api/items/:id/master/students-one-time - Ver alumnos (una_vez)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/students-one-time$/) && method === 'GET') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/students-one-time$/);
      const itemId = match[1];

      const item = await getItemById(itemId);
      if (!item) {
        return new Response(JSON.stringify({ success: false, error: 'Item no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const states = await getOneTimeStateForItem(itemId);
      return new Response(JSON.stringify({ success: true, item, states }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error al obtener estado una_vez:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/increment-all - Incrementar +1 todos (una_vez)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/increment-all$/) && method === 'POST') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/increment-all$/);
      const itemId = match[1];

      const result = await incrementCleanForAllOneTime(itemId);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error incrementando todos:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST /admin/pde/transmutaciones-energeticas/api/items/:id/master/adjust-remaining - Ajustar remaining (una_vez)
  if (path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/adjust-remaining$/) && method === 'POST') {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }

    try {
      const match = path.match(/^\/admin\/pde\/transmutaciones-energeticas\/api\/items\/([^\/]+)\/master\/adjust-remaining$/);
      const itemId = match[1];
      const body = await request.json();

      if (!body.student_email || body.remaining === undefined) {
        return new Response(JSON.stringify({ success: false, error: 'student_email y remaining son requeridos' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const state = await adjustRemainingForStudent(itemId, body.student_email, body.remaining);
      return new Response(JSON.stringify({ success: true, state }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error ajustando remaining:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET /admin/pde/transmutaciones-energeticas - Lista de listas (HTML)
  if (path === '/admin/pde/transmutaciones-energeticas' && method === 'GET') {
    return await renderTransmutacionesList(request, env);
  }

  // Si no coincide ninguna ruta, 404
  return new Response(JSON.stringify({ success: false, error: 'Ruta no encontrada' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
