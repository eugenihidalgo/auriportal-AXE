// src/endpoints/protecciones-energeticas-api.js
// API endpoints para Protecciones Energéticas
// Categoría de contenido PDE reutilizable dentro de prácticas

import { requireAdminContext } from '../core/auth-context.js';
import { 
  listarTodasLasProtecciones, 
  obtenerProteccion, 
  crearProteccion, 
  actualizarProteccion, 
  archivarProteccion,
  obtenerProteccionPorKey
} from '../services/protecciones-energeticas.js';

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

/**
 * Genera un slug seguro desde un nombre
 * @param {string} name - Nombre a convertir
 * @returns {string} - Slug seguro
 */
function generarSlug(name) {
  if (!name || typeof name !== 'string') {
    return 'proteccion-' + Date.now();
  }
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9]+/g, '-') // Reemplazar no-alfanuméricos con guiones
    .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio/final
}

/**
 * Genera una key única añadiendo sufijo si es necesario
 * @param {string} baseKey - Key base
 * @returns {Promise<string>} - Key única
 */
async function generarKeyUnica(baseKey) {
  let key = baseKey;
  let contador = 1;
  
  while (true) {
    const existente = await obtenerProteccionPorKey(key);
    if (!existente) {
      return key;
    }
    key = `${baseKey}-${contador}`;
    contador++;
  }
}

export default async function proteccionesEnergeticasApiHandler(request, env, ctx) {
  // Verificar acceso admin usando requireAdminContext
  const adminContext = await requireAdminContext(request, env);
  if (adminContext instanceof Response) {
    return adminContext; // Es una respuesta de error (login)
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const normalizedPath = path.replace('/api/protecciones-energeticas', '').replace(/\/$/, '') || '/';

  try {
    // GET /api/protecciones-energeticas - Listar todas las protecciones
    if (normalizedPath === '/' && method === 'GET') {
      const protecciones = await listarTodasLasProtecciones();
      return renderSuccess('Protecciones obtenidas', { protecciones });
    }

    // POST /api/protecciones-energeticas - Crear nueva protección
    if (normalizedPath === '/' && method === 'POST') {
      // Manejo seguro de req.body
      let body = {};
      try {
        body = await request.json();
      } catch (parseError) {
        console.error('[PROTECCIONES-API] Error parseando body:', parseError.message);
        // Continuar con body vacío (fail-open)
        body = {};
      }
      
      // Extraer campos con defaults seguros
      const name = body.name || '';
      const key = body.key || null;
      const description = body.description || '';
      const usage_context = body.usage_context || '';
      let recommended_moment = body.recommended_moment || null;
      let tags = body.tags || null;
      const status = body.status || 'active';
      
      // Validar que name existe (único campo realmente requerido)
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return renderError('El campo "name" es requerido', 400);
      }
      
      // Autogenerar key si no viene
      let keyFinal = key;
      if (!keyFinal || typeof keyFinal !== 'string' || keyFinal.trim().length === 0) {
        const slugBase = generarSlug(name);
        keyFinal = await generarKeyUnica(slugBase);
      } else {
        // Verificar unicidad de key proporcionada
        keyFinal = await generarKeyUnica(keyFinal.trim());
      }
      
      // Normalizar recommended_moment
      const momentosValidos = ['pre-practica', 'durante', 'post-practica', 'transversal'];
      if (!recommended_moment || !momentosValidos.includes(recommended_moment)) {
        recommended_moment = 'transversal';
      }
      
      // Normalizar tags
      if (!tags) {
        tags = [];
      } else if (typeof tags === 'string') {
        // Si viene como string, intentar parsear como JSON o convertir a array
        try {
          tags = JSON.parse(tags);
        } catch {
          // Si no es JSON válido, convertir a array de un elemento
          tags = tags.trim() ? [tags.trim()] : [];
        }
      } else if (!Array.isArray(tags)) {
        tags = [];
      }
      
      // Preparar datos para insertar
      const datosInsertar = {
        key: keyFinal,
        name: name.trim(),
        description: description || '',
        usage_context: usage_context || '',
        recommended_moment: recommended_moment,
        tags: tags,
        status: status || 'active'
      };
      
      try {
        const id = await crearProteccion(datosInsertar);
        const proteccion = await obtenerProteccion(id);
        return renderSuccess('Protección creada', { proteccion });
      } catch (dbError) {
        console.error('[PROTECCIONES-API] Error en base de datos:', dbError.message);
        throw dbError; // Re-lanzar para que el catch general lo maneje
      }
    }

    // GET /api/protecciones-energeticas/:id - Obtener una protección
    if (normalizedPath.startsWith('/') && method === 'GET') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const proteccion = await obtenerProteccion(id);
      if (!proteccion) {
        return renderError('Protección no encontrada', 404);
      }
      return renderSuccess('Protección obtenida', { proteccion });
    }

    // PUT /api/protecciones-energeticas/:id - Actualizar protección
    if (normalizedPath.startsWith('/') && method === 'PUT') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const body = await request.json();
      const { key, name, description, usage_context, recommended_moment, tags, status } = body;
      
      const actualizado = await actualizarProteccion(id, { 
        key, 
        name, 
        description, 
        usage_context, 
        recommended_moment, 
        tags, 
        status 
      });
      if (!actualizado) {
        return renderError('Error actualizando protección', 500);
      }
      const proteccion = await obtenerProteccion(id);
      return renderSuccess('Protección actualizada', { proteccion });
    }

    // DELETE /api/protecciones-energeticas/:id - Archivar protección
    if (normalizedPath.startsWith('/') && method === 'DELETE') {
      const id = parseInt(normalizedPath.slice(1));
      if (isNaN(id)) {
        return renderError('ID inválido', 400);
      }
      const archivado = await archivarProteccion(id);
      if (!archivado) {
        return renderError('Error archivando protección', 500);
      }
      return renderSuccess('Protección archivada');
    }

    return renderError('Ruta no encontrada', 404);
  } catch (error) {
    console.error('[PROTECCIONES-API] Error:', error.message);
    return renderError(error.message || 'Error interno del servidor', 500);
  }
}

