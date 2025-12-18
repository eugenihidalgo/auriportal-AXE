// src/endpoints/admin-motors-api.js
// API endpoints para el Diseñador de Motores PDE
// Protegido por requireAdminContext()

import { requireAdminContext } from '../core/auth-context.js';
import {
  listMotors,
  getMotorById,
  createMotor,
  updateMotor,
  softDeleteMotor,
  duplicateMotor,
  publishMotor,
  archiveMotor,
  generateAxeStructure
} from '../services/pde-motors-service.js';

/**
 * GET /admin/pde/motors
 * Lista todos los motores
 */
export async function apiListMotors(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

    const options = {};
    if (status) options.status = status;
    if (category) options.category = category;
    options.includeDeleted = includeDeleted;

    const motors = await listMotors(options);

    return new Response(JSON.stringify({
      success: true,
      motors
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al listar motores:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al listar motores'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /admin/pde/motors/:id
 * Obtiene un motor por ID
 */
export async function apiGetMotor(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de motor requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const motor = await getMotorById(id);

    if (!motor) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Motor no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      motor
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al obtener motor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al obtener motor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/pde/motors
 * Crea un nuevo motor
 */
export async function apiCreateMotor(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { motor_key, name, description, category, definition } = body;

    if (!motor_key || !name || !category || !definition) {
      return new Response(JSON.stringify({
        success: false,
        error: 'motor_key, name, category y definition son obligatorios'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const motor = await createMotor({
      motor_key,
      name,
      description,
      category,
      definition
    });

    return new Response(JSON.stringify({
      success: true,
      motor
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al crear motor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al crear motor'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /admin/pde/motors/:id
 * Actualiza un motor existente
 */
export async function apiUpdateMotor(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de motor requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const patch = {};

    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.category !== undefined) patch.category = body.category;
    if (body.definition !== undefined) patch.definition = body.definition;
    if (body.status !== undefined) patch.status = body.status;

    const motor = await updateMotor(id, patch);

    if (!motor) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Motor no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      motor
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al actualizar motor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al actualizar motor'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /admin/pde/motors/:id
 * Elimina un motor (soft delete)
 */
export async function apiDeleteMotor(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de motor requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await softDeleteMotor(id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Motor eliminado correctamente'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al eliminar motor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al eliminar motor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/pde/motors/:id/duplicate
 * Duplica un motor
 */
export async function apiDuplicateMotor(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2]; // /motors/:id/duplicate

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de motor requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const motor = await duplicateMotor(id);

    if (!motor) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Motor no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      motor
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al duplicar motor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al duplicar motor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/pde/motors/:id/publish
 * Publica un motor
 */
export async function apiPublishMotor(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2]; // /motors/:id/publish

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de motor requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const motor = await publishMotor(id);

    if (!motor) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Motor no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      motor
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al publicar motor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al publicar motor'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/pde/motors/:id/generate
 * Genera estructura AXE para un motor con inputs dados
 * (Preparado para consumo futuro por el Editor de Recorridos)
 */
export async function apiGenerateAxeStructure(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2]; // /motors/:id/generate

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de motor requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const inputs = body.inputs || {};

    const structure = await generateAxeStructure(id, inputs);

    return new Response(JSON.stringify({
      success: true,
      structure
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al generar estructura AXE:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al generar estructura AXE'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler principal que enruta según el método HTTP
 */
export default async function adminMotorsApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // GET /admin/pde/motors
  if (path === '/admin/pde/motors' && method === 'GET') {
    return await apiListMotors(request, env);
  }

  // POST /admin/pde/motors
  if (path === '/admin/pde/motors' && method === 'POST') {
    return await apiCreateMotor(request, env);
  }

  // GET /admin/pde/motors/:id
  if (path.startsWith('/admin/pde/motors/') && method === 'GET' && !path.endsWith('/duplicate') && !path.endsWith('/publish') && !path.endsWith('/generate')) {
    return await apiGetMotor(request, env);
  }

  // PUT /admin/pde/motors/:id
  if (path.startsWith('/admin/pde/motors/') && method === 'PUT' && !path.endsWith('/duplicate') && !path.endsWith('/publish') && !path.endsWith('/generate')) {
    return await apiUpdateMotor(request, env);
  }

  // DELETE /admin/pde/motors/:id
  if (path.startsWith('/admin/pde/motors/') && method === 'DELETE') {
    return await apiDeleteMotor(request, env);
  }

  // POST /admin/pde/motors/:id/duplicate
  if (path.endsWith('/duplicate') && method === 'POST') {
    return await apiDuplicateMotor(request, env);
  }

  // POST /admin/pde/motors/:id/publish
  if (path.endsWith('/publish') && method === 'POST') {
    return await apiPublishMotor(request, env);
  }

  // POST /admin/pde/motors/:id/generate
  if (path.endsWith('/generate') && method === 'POST') {
    return await apiGenerateAxeStructure(request, env);
  }

  return new Response(JSON.stringify({
    success: false,
    error: 'Ruta no encontrada'
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

