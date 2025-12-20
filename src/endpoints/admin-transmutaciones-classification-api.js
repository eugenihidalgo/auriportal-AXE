// src/endpoints/admin-transmutaciones-classification-api.js
// API endpoints para gestión de clasificación de transmutaciones
//
// Endpoints:
// - GET    /admin/api/transmutaciones/classification - Obtiene todas las clasificaciones
// - POST   /admin/api/transmutaciones/classification/categories - Crea categoría
// - PATCH  /admin/api/transmutaciones/classification/categories/:key - Actualiza categoría
// - POST   /admin/api/transmutaciones/classification/categories/:key/delete - Soft delete categoría
// - POST   /admin/api/transmutaciones/classification/subtypes - Crea subtipo
// - PATCH  /admin/api/transmutaciones/classification/subtypes/:key - Actualiza subtipo
// - POST   /admin/api/transmutaciones/classification/subtypes/:key/delete - Soft delete subtipo
// - POST   /admin/api/transmutaciones/classification/tags - Crea tag
// - PATCH  /admin/api/transmutaciones/classification/tags/:key - Actualiza tag
// - POST   /admin/api/transmutaciones/classification/tags/:key/delete - Soft delete tag
// - PATCH  /admin/api/transmutaciones/lists/:list_id/classification - Actualiza clasificación de lista

import { requireAdminContext } from '../core/auth-context.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  softDeleteCategory,
  listSubtypes,
  createSubtype,
  updateSubtype,
  softDeleteSubtype,
  listTags,
  createTag,
  updateTag,
  softDeleteTag,
  getAllClassifications,
  updateListClassification
} from '../services/pde-transmutaciones-classification-service.js';
import { logError } from '../core/observability/logger.js';

/**
 * Handler principal de la API de clasificación
 */
export default async function adminTransmutacionesClassificationApiHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return new Response(JSON.stringify({ 
      success: false,
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
    // ============================================
    // GET /admin/api/transmutaciones/classification
    // ============================================
    if (path === '/admin/api/transmutaciones/classification' && method === 'GET') {
      return await handleGetAllClassifications(request, env);
    }

    // ============================================
    // CATEGORÍAS
    // ============================================
    
    // POST /admin/api/transmutaciones/classification/categories
    if (path === '/admin/api/transmutaciones/classification/categories' && method === 'POST') {
      return await handleCreateCategory(request, env);
    }

    // PATCH /admin/api/transmutaciones/classification/categories/:key
    const matchPatchCategory = path.match(/^\/admin\/api\/transmutaciones\/classification\/categories\/([^\/]+)$/);
    if (matchPatchCategory && method === 'PATCH') {
      const key = matchPatchCategory[1];
      return await handleUpdateCategory(key, request, env);
    }

    // POST /admin/api/transmutaciones/classification/categories/:key/delete
    const matchDeleteCategory = path.match(/^\/admin\/api\/transmutaciones\/classification\/categories\/([^\/]+)\/delete$/);
    if (matchDeleteCategory && method === 'POST') {
      const key = matchDeleteCategory[1];
      return await handleDeleteCategory(key, request, env);
    }

    // ============================================
    // SUBTIPOS
    // ============================================
    
    // POST /admin/api/transmutaciones/classification/subtypes
    if (path === '/admin/api/transmutaciones/classification/subtypes' && method === 'POST') {
      return await handleCreateSubtype(request, env);
    }

    // PATCH /admin/api/transmutaciones/classification/subtypes/:key
    const matchPatchSubtype = path.match(/^\/admin\/api\/transmutaciones\/classification\/subtypes\/([^\/]+)$/);
    if (matchPatchSubtype && method === 'PATCH') {
      const key = matchPatchSubtype[1];
      return await handleUpdateSubtype(key, request, env);
    }

    // POST /admin/api/transmutaciones/classification/subtypes/:key/delete
    const matchDeleteSubtype = path.match(/^\/admin\/api\/transmutaciones\/classification\/subtypes\/([^\/]+)\/delete$/);
    if (matchDeleteSubtype && method === 'POST') {
      const key = matchDeleteSubtype[1];
      return await handleDeleteSubtype(key, request, env);
    }

    // ============================================
    // TAGS
    // ============================================
    
    // POST /admin/api/transmutaciones/classification/tags
    if (path === '/admin/api/transmutaciones/classification/tags' && method === 'POST') {
      return await handleCreateTag(request, env);
    }

    // PATCH /admin/api/transmutaciones/classification/tags/:key
    const matchPatchTag = path.match(/^\/admin\/api\/transmutaciones\/classification\/tags\/([^\/]+)$/);
    if (matchPatchTag && method === 'PATCH') {
      const key = matchPatchTag[1];
      return await handleUpdateTag(key, request, env);
    }

    // POST /admin/api/transmutaciones/classification/tags/:key/delete
    const matchDeleteTag = path.match(/^\/admin\/api\/transmutaciones\/classification\/tags\/([^\/]+)\/delete$/);
    if (matchDeleteTag && method === 'POST') {
      const key = matchDeleteTag[1];
      return await handleDeleteTag(key, request, env);
    }

    // ============================================
    // CLASIFICACIÓN DE LISTAS
    // ============================================
    
    // PATCH /admin/api/transmutaciones/lists/:list_id/classification
    const matchListClassification = path.match(/^\/admin\/api\/transmutaciones\/lists\/([^\/]+)\/classification$/);
    if (matchListClassification && method === 'PATCH') {
      const listId = parseInt(matchListClassification[1], 10);
      return await handleUpdateListClassification(listId, request, env);
    }

    // ============================================
    // RUTA NO ENCONTRADA
    // ============================================
    return new Response(JSON.stringify({
      success: false,
      error: 'Ruta no encontrada',
      message: `Ruta ${method} ${path} no existe`
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PDE][TRANSMUTACIONES][CLASSIFICATION][API] Error:', error);
    logError('transmutaciones_classification_api_error', error.message, {
      path,
      method,
      error: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error interno del servidor',
      message: 'Error procesando la solicitud'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================
// HANDLERS
// ============================================

async function handleGetAllClassifications(request, env) {
  const classifications = await getAllClassifications();
  
  return new Response(JSON.stringify({
    success: true,
    data: classifications
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleCreateCategory(request, env) {
  const body = await request.json();
  const category = await createCategory(body);
  
  return new Response(JSON.stringify({
    success: true,
    data: { category }
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleUpdateCategory(key, request, env) {
  const body = await request.json();
  const category = await updateCategory(key, body);
  
  if (!category) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Categoría no encontrada'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    data: { category }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleDeleteCategory(key, request, env) {
  const deleted = await softDeleteCategory(key);
  
  if (!deleted) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Categoría no encontrada'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    message: 'Categoría eliminada correctamente'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleCreateSubtype(request, env) {
  const body = await request.json();
  const subtype = await createSubtype(body);
  
  return new Response(JSON.stringify({
    success: true,
    data: { subtype }
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleUpdateSubtype(key, request, env) {
  const body = await request.json();
  const subtype = await updateSubtype(key, body);
  
  if (!subtype) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Subtipo no encontrado'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    data: { subtype }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleDeleteSubtype(key, request, env) {
  const deleted = await softDeleteSubtype(key);
  
  if (!deleted) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Subtipo no encontrado'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    message: 'Subtipo eliminado correctamente'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleCreateTag(request, env) {
  const body = await request.json();
  const tag = await createTag(body);
  
  return new Response(JSON.stringify({
    success: true,
    data: { tag }
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleUpdateTag(key, request, env) {
  const body = await request.json();
  const tag = await updateTag(key, body);
  
  if (!tag) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Tag no encontrado'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    data: { tag }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleDeleteTag(key, request, env) {
  const deleted = await softDeleteTag(key);
  
  if (!deleted) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Tag no encontrado'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    message: 'Tag eliminado correctamente'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleUpdateListClassification(listId, request, env) {
  const body = await request.json();
  const list = await updateListClassification(listId, body);
  
  if (!list) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Lista no encontrada'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    data: { list }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

