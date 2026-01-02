// src/endpoints/master-api-tags.js
// Endpoints API MASTER para gestión de Tags (TAG SOT GLOBAL v1)
//
// Endpoints bajo /master/api/tags/*
// Requiere autenticación MASTER (requireAdminContext)
// Devuelve JSON siempre (nunca HTML)

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import { query } from '../../database/pg.js';
import { dispatchSignal } from '../core/signals/signal-dispatcher.js';

/**
 * Helper: Respuesta JSON de error
 */
function jsonError(message, code, status = 400, traceId = null) {
  return new Response(JSON.stringify({
    ok: false,
    error: message,
    code: code || 'ERROR',
    trace_id: traceId || getRequestId()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * Helper: Respuesta JSON de éxito
 */
function jsonSuccess(data, traceId = null) {
  return new Response(JSON.stringify({
    ok: true,
    ...data,
    trace_id: traceId || getRequestId()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Trace-Id': traceId || getRequestId()
    }
  });
}

/**
 * Handler principal de endpoints API Tags
 */
export default async function masterApiTagsHandler(request, env, ctx) {
  const traceId = getRequestId();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Auth: usar requireAdminContext (mismo sistema de sesión que MASTER)
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No autorizado',
        code: 'UNAUTHORIZED',
        trace_id: traceId
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Trace-Id': traceId
        }
      });
    }
  } catch (authError) {
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  logInfo('MasterApiTags', 'Request recibido', { path, method, traceId });

  try {
    // GET /master/api/tags - Listar tags
    if (path === '/master/api/tags' && method === 'GET') {
      const search = url.searchParams.get('search') || '';
      const status = url.searchParams.get('status') || 'active';
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);

      if (!['active', 'deprecated'].includes(status)) {
        return jsonError('Status inválido. Debe ser "active" o "deprecated"', 'INVALID_STATUS', 400, traceId);
      }

      let sql = `
        SELECT id, type, value, normalized, status, created_at, updated_at
        FROM pde_classification_terms
        WHERE type = 'tag'
          AND status = $1
      `;
      const params = [status];

      if (search && search.trim()) {
        // Normalizar búsqueda (mismo proceso que normalize_classification_term)
        const normalizedSearch = search.trim().toLowerCase()
          .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
          .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
          .replace(/ü/g, 'u');
        
        sql += ` AND normalized LIKE $2`;
        params.push(`%${normalizedSearch}%`);
      }

      sql += ` ORDER BY value ASC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await query(sql, params);
      
      const tags = result.rows.map(row => ({
        id: row.id,
        value: row.value,
        normalized: row.normalized,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      return jsonSuccess({ tags }, traceId);
    }

    // POST /master/api/tags - Crear tag (idempotente)
    if (path === '/master/api/tags' && method === 'POST') {
      const body = await request.json();

      if (!body.value || typeof body.value !== 'string' || !body.value.trim()) {
        return jsonError('Campo "value" es requerido y debe ser un string no vacío', 'INVALID_VALUE', 400, traceId);
      }

      const value = body.value.trim();

      // Usar ensure_classification_term para crear/obtener (idempotente)
      const result = await query(
        `SELECT ensure_classification_term('tag', $1) as term_id`,
        [value]
      );

      const termId = result.rows[0].term_id;

      // Obtener información completa del tag
      const tagResult = await query(
        `SELECT id, type, value, normalized, status, created_at, updated_at
         FROM pde_classification_terms
         WHERE id = $1`,
        [termId]
      );

      if (tagResult.rows.length === 0) {
        return jsonError('Error creando tag', 'TAG_CREATE_ERROR', 500, traceId);
      }

      const tag = tagResult.rows[0];
      const tagData = {
        id: tag.id,
        value: tag.value,
        normalized: tag.normalized,
        status: tag.status,
        created_at: tag.created_at,
        updated_at: tag.updated_at
      };

      // Emitir señal tag.created (solo si es nuevo, pero ensure_classification_term no nos dice)
      // Emitimos siempre, el sistema de señales maneja idempotencia
      try {
        await dispatchSignal({
          signal_key: 'tag.created',
          payload: {
            tag_id: tag.id,
            tag_value: tag.value,
            tag_normalized: tag.normalized
          },
          runtime: {
            trace_id: traceId
          }
        }, {
          source: { type: 'master', id: authCtx.user?.email || 'master' }
        });
      } catch (signalError) {
        logWarn('MasterApiTags', 'Error emitiendo señal tag.created (continuando)', {
          error: signalError.message,
          traceId
        });
      }

      logInfo('MasterApiTags', 'Tag creado', { tag_id: tag.id, value: tag.value, traceId });

      return jsonSuccess({ tag: tagData }, traceId);
    }

    // PATCH /master/api/tags/:id - Editar tag (solo value)
    if (path.match(/^\/master\/api\/tags\/([^\/]+)$/) && method === 'PATCH') {
      const match = path.match(/^\/master\/api\/tags\/([^\/]+)$/);
      const tagId = match[1];

      const body = await request.json();

      if (!body.value || typeof body.value !== 'string' || !body.value.trim()) {
        return jsonError('Campo "value" es requerido y debe ser un string no vacío', 'INVALID_VALUE', 400, traceId);
      }

      const newValue = body.value.trim();

      // Verificar que el tag existe y obtener valor actual
      const currentResult = await query(
        `SELECT id, value, normalized, status FROM pde_classification_terms WHERE id = $1 AND type = 'tag'`,
        [tagId]
      );

      if (currentResult.rows.length === 0) {
        return jsonError('Tag no encontrado', 'TAG_NOT_FOUND', 404, traceId);
      }

      const currentTag = currentResult.rows[0];

      // Normalizar nuevo valor
      const normalizedResult = await query(
        `SELECT normalize_classification_term($1) as normalized`,
        [newValue]
      );
      const newNormalized = normalizedResult.rows[0].normalized;

      // Verificar que no existe otro tag con el mismo normalized
      const duplicateResult = await query(
        `SELECT id FROM pde_classification_terms 
         WHERE type = 'tag' AND normalized = $1 AND id != $2`,
        [newNormalized, tagId]
      );

      if (duplicateResult.rows.length > 0) {
        return jsonError('Ya existe un tag con ese valor (normalizado)', 'DUPLICATE_TAG', 409, traceId);
      }

      // Actualizar tag
      const updateResult = await query(
        `UPDATE pde_classification_terms
         SET value = $1, normalized = $2, updated_at = now()
         WHERE id = $3
         RETURNING id, type, value, normalized, status, created_at, updated_at`,
        [newValue, newNormalized, tagId]
      );

      if (updateResult.rows.length === 0) {
        return jsonError('Error actualizando tag', 'TAG_UPDATE_ERROR', 500, traceId);
      }

      const tag = updateResult.rows[0];
      const tagData = {
        id: tag.id,
        value: tag.value,
        normalized: tag.normalized,
        status: tag.status,
        created_at: tag.created_at,
        updated_at: tag.updated_at
      };

      logInfo('MasterApiTags', 'Tag actualizado', { tag_id: tag.id, value: tag.value, traceId });

      return jsonSuccess({ tag: tagData }, traceId);
    }

    // POST /master/api/tags/:id/deprecate - Marcar tag como deprecated
    if (path.match(/^\/master\/api\/tags\/([^\/]+)\/deprecate$/) && method === 'POST') {
      const match = path.match(/^\/master\/api\/tags\/([^\/]+)\/deprecate$/);
      const tagId = match[1];

      // Verificar que el tag existe
      const currentResult = await query(
        `SELECT id, value, normalized, status FROM pde_classification_terms WHERE id = $1 AND type = 'tag'`,
        [tagId]
      );

      if (currentResult.rows.length === 0) {
        return jsonError('Tag no encontrado', 'TAG_NOT_FOUND', 404, traceId);
      }

      const currentTag = currentResult.rows[0];

      if (currentTag.status === 'deprecated') {
        return jsonError('Tag ya está deprecated', 'TAG_ALREADY_DEPRECATED', 400, traceId);
      }

      // Actualizar status a deprecated
      const updateResult = await query(
        `UPDATE pde_classification_terms
         SET status = 'deprecated', updated_at = now()
         WHERE id = $1
         RETURNING id, type, value, normalized, status, created_at, updated_at`,
        [tagId]
      );

      if (updateResult.rows.length === 0) {
        return jsonError('Error deprecando tag', 'TAG_DEPRECATE_ERROR', 500, traceId);
      }

      const tag = updateResult.rows[0];
      const tagData = {
        id: tag.id,
        value: tag.value,
        normalized: tag.normalized,
        status: tag.status,
        created_at: tag.created_at,
        updated_at: tag.updated_at
      };

      // Emitir señal tag.deprecated
      try {
        await dispatchSignal({
          signal_key: 'tag.deprecated',
          payload: {
            tag_id: tag.id,
            tag_value: tag.value,
            tag_normalized: tag.normalized
          },
          runtime: {
            trace_id: traceId
          }
        }, {
          source: { type: 'master', id: authCtx.user?.email || 'master' }
        });
      } catch (signalError) {
        logWarn('MasterApiTags', 'Error emitiendo señal tag.deprecated (continuando)', {
          error: signalError.message,
          traceId
        });
      }

      logInfo('MasterApiTags', 'Tag deprecated', { tag_id: tag.id, value: tag.value, traceId });

      return jsonSuccess({ tag: tagData }, traceId);
    }

    // Ruta no encontrada
    return jsonError('Ruta no encontrada', 'ROUTE_NOT_FOUND', 404, traceId);

  } catch (error) {
    logError('MasterApiTags', 'Error en handler', {
      error: error.message,
      stack: error.stack,
      traceId
    });

    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}
