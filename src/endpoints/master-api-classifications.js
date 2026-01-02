// src/endpoints/master-api-classifications.js
// API MASTER canónica para CLASSIFICATION SOT GLOBAL v1
//
// Endpoints:
// GET    /master/api/classifications - Listar classifications (filtros: type, status, search)
// POST   /master/api/classifications - Crear classification (idempotente)
// PATCH  /master/api/classifications/:id - Actualizar classification
// POST   /master/api/classifications/:id/deprecate - Deprecar classification
//
// REGLAS CONSTITUCIONALES:
// - Solo MASTER puede crear/editar/deprecar
// - Usa ensureClassificationTerm como único punto de creación
// - Emite señales para todas las operaciones
// - Nunca se borran físicamente (solo deprecated)

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../core/observability/logger.js';
import { query } from '../../database/pg.js';
import { dispatchSignal } from '../core/signals/signal-dispatcher.js';
import { ensureClassificationTerm } from '../core/classification/ensure-classification-term.js';

/**
 * Helper para respuestas JSON exitosas
 */
function jsonSuccess(data, traceId) {
  return new Response(JSON.stringify({
    ok: true,
    data: data,
    trace_id: traceId || ''
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Trace-Id': traceId || ''
    }
  });
}

/**
 * Helper para respuestas JSON de error
 */
function jsonError(message, code, status = 400, traceId) {
  return new Response(JSON.stringify({
    ok: false,
    error: message,
    code: code || 'ERROR',
    trace_id: traceId || ''
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Trace-Id': traceId || ''
    }
  });
}

/**
 * Handler principal del endpoint de classifications
 */
export default async function masterApiClassificationsHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const traceId = getRequestId();

  // Autenticación obligatoria (MASTER only)
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return jsonError('No autorizado', 'AUTH_ERROR', 401, traceId);
    }
  } catch (authError) {
    return jsonError('Error de autenticación', 'AUTH_ERROR', 401, traceId);
  }

  logInfo('MasterApiClassifications', 'Request recibido', { path, method, traceId });

  try {
    // GET /master/api/classifications - Listar classifications
    if (path === '/master/api/classifications' && method === 'GET') {
      const typeFilter = url.searchParams.get('type'); // 'tag', 'key', 'subkey' o null (todos)
      const statusFilter = url.searchParams.get('status') || 'active'; // 'active', 'deprecated', 'all'
      const searchTerm = url.searchParams.get('search') || '';
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);

      // Validar type
      if (typeFilter && !['tag', 'key', 'subkey'].includes(typeFilter)) {
        return jsonError('type inválido. Debe ser: tag, key, subkey', 'INVALID_TYPE', 400, traceId);
      }

      // Validar status
      if (!['active', 'deprecated', 'all'].includes(statusFilter)) {
        return jsonError('status inválido. Debe ser: active, deprecated, all', 'INVALID_STATUS', 400, traceId);
      }

      let sql = `
        SELECT id, type, value, normalized, status, created_at, updated_at
        FROM pde_classification_terms
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (typeFilter) {
        sql += ` AND type = $${paramIndex++}`;
        params.push(typeFilter);
      }

      if (statusFilter !== 'all') {
        sql += ` AND status = $${paramIndex++}`;
        params.push(statusFilter);
      }

      if (searchTerm) {
        // Normalizar búsqueda (mismo proceso que normalize_classification_term)
        const normalizedSearch = searchTerm.trim().toLowerCase()
          .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
          .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
          .replace(/ü/g, 'u');
        
        sql += ` AND normalized LIKE $${paramIndex++}`;
        params.push(`%${normalizedSearch}%`);
      }

      sql += ` ORDER BY value ASC LIMIT $${paramIndex++}`;
      params.push(limit);

      const result = await query(sql, params);
      
      const classifications = result.rows.map(row => ({
        id: row.id,
        type: row.type,
        value: row.value,
        normalized: row.normalized,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      return jsonSuccess({ items: classifications }, traceId);
    }

    // POST /master/api/classifications - Crear classification (idempotente)
    if (path === '/master/api/classifications' && method === 'POST') {
      const body = await request.json();

      if (!body.type || typeof body.type !== 'string') {
        return jsonError('Campo "type" es requerido y debe ser un string', 'INVALID_TYPE', 400, traceId);
      }

      const validTypes = ['tag', 'key', 'subkey'];
      if (!validTypes.includes(body.type)) {
        return jsonError(`type inválido: "${body.type}". Debe ser uno de: ${validTypes.join(', ')}`, 'INVALID_TYPE', 400, traceId);
      }

      if (!body.value || typeof body.value !== 'string' || !body.value.trim()) {
        return jsonError('Campo "value" es requerido y debe ser un string no vacío', 'INVALID_VALUE', 400, traceId);
      }

      const value = body.value.trim();

      // Usar helper canónico ensureClassificationTerm (idempotente)
      let classification;
      try {
        classification = await ensureClassificationTerm({ type: body.type, value }, { traceId });
      } catch (error) {
        logError('MasterApiClassifications', 'Error en ensureClassificationTerm', {
          error: error.message,
          stack: error.stack,
          traceId
        });
        return jsonError('Error creando classification', 'CLASSIFICATION_CREATE_ERROR', 500, traceId);
      }

      const classificationData = {
        id: classification.id,
        type: classification.type,
        value: classification.value,
        normalized: classification.normalized,
        status: classification.status,
        created_at: classification.created_at,
        updated_at: classification.updated_at
      };

      // Verificar que está activo
      if (classification.status !== 'active') {
        logWarn('MasterApiClassifications', 'Classification creado pero no está activo', {
          classification_id: classification.id,
          status: classification.status,
          traceId
        });
      }

      // Emitir señal classification.created
      try {
        await dispatchSignal({
          signal_key: 'classification.created',
          payload: {
            classification_id: classification.id,
            classification_type: classification.type,
            classification_value: classification.value,
            classification_normalized: classification.normalized
          },
          runtime: { trace_id: traceId }
        }, { source: { type: 'master', id: authCtx.user?.email || 'master' } });
      } catch (signalError) {
        logWarn('MasterApiClassifications', 'Error emitiendo señal classification.created', {
          error: signalError.message,
          traceId
        });
        // Fail-open: continuar sin error
      }

      return jsonSuccess({ classification: classificationData }, traceId);
    }

    // PATCH /master/api/classifications/:id - Actualizar classification
    const patchMatch = path.match(/^\/master\/api\/classifications\/([^/]+)$/);
    if (patchMatch && method === 'PATCH') {
      const id = patchMatch[1];
      const body = await request.json();

      // Obtener classification actual
      const currentResult = await query(
        `SELECT id, type, value, normalized, status FROM pde_classification_terms WHERE id = $1`,
        [id]
      );

      if (currentResult.rows.length === 0) {
        return jsonError('Classification no encontrado', 'CLASSIFICATION_NOT_FOUND', 404, traceId);
      }

      const current = currentResult.rows[0];

      // Solo permitir actualizar label/description si existe (por ahora, solo status)
      // NOTA: value y type son inmutables (son la identidad del término)
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (body.status !== undefined) {
        if (!['active', 'deprecated'].includes(body.status)) {
          return jsonError('status inválido. Debe ser: active, deprecated', 'INVALID_STATUS', 400, traceId);
        }
        updates.push(`status = $${paramIndex++}`);
        params.push(body.status);
      }

      if (updates.length === 0) {
        return jsonError('No hay campos para actualizar', 'NO_UPDATES', 400, traceId);
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const updateSql = `
        UPDATE pde_classification_terms
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, type, value, normalized, status, created_at, updated_at
      `;

      const updateResult = await query(updateSql, params);
      const updated = updateResult.rows[0];

      const classificationData = {
        id: updated.id,
        type: updated.type,
        value: updated.value,
        normalized: updated.normalized,
        status: updated.status,
        created_at: updated.created_at,
        updated_at: updated.updated_at
      };

      return jsonSuccess({ classification: classificationData }, traceId);
    }

    // POST /master/api/classifications/:id/deprecate - Deprecar classification
    const deprecateMatch = path.match(/^\/master\/api\/classifications\/([^/]+)\/deprecate$/);
    if (deprecateMatch && method === 'POST') {
      const id = deprecateMatch[1];

      // Obtener classification actual
      const currentResult = await query(
        `SELECT id, type, value, normalized, status FROM pde_classification_terms WHERE id = $1`,
        [id]
      );

      if (currentResult.rows.length === 0) {
        return jsonError('Classification no encontrado', 'CLASSIFICATION_NOT_FOUND', 404, traceId);
      }

      const current = currentResult.rows[0];

      if (current.status === 'deprecated') {
        return jsonError('Classification ya está deprecated', 'ALREADY_DEPRECATED', 400, traceId);
      }

      // Marcar como deprecated
      const updateResult = await query(
        `UPDATE pde_classification_terms
         SET status = 'deprecated', updated_at = NOW()
         WHERE id = $1
         RETURNING id, type, value, normalized, status, created_at, updated_at`,
        [id]
      );

      const deprecated = updateResult.rows[0];

      const classificationData = {
        id: deprecated.id,
        type: deprecated.type,
        value: deprecated.value,
        normalized: deprecated.normalized,
        status: deprecated.status,
        created_at: deprecated.created_at,
        updated_at: deprecated.updated_at
      };

      // Emitir señal classification.deprecated
      try {
        await dispatchSignal({
          signal_key: 'classification.deprecated',
          payload: {
            classification_id: deprecated.id,
            classification_type: deprecated.type,
            classification_value: deprecated.value,
            classification_normalized: deprecated.normalized
          },
          runtime: { trace_id: traceId }
        }, { source: { type: 'master', id: authCtx.user?.email || 'master' } });
      } catch (signalError) {
        logWarn('MasterApiClassifications', 'Error emitiendo señal classification.deprecated', {
          error: signalError.message,
          traceId
        });
        // Fail-open: continuar sin error
      }

      return jsonSuccess({ classification: classificationData }, traceId);
    }

    // 404 para rutas no encontradas
    logWarn('MasterApiClassifications', 'Ruta no encontrada', { path, method, traceId });
    return jsonError('Ruta no encontrada', 'ROUTE_NOT_FOUND', 404, traceId);

  } catch (error) {
    logError('MasterApiClassifications', 'Error en handler', {
      error: error.message,
      stack: error.stack,
      path,
      method,
      traceId
    });
    return jsonError('Error interno del servidor', 'INTERNAL_ERROR', 500, traceId);
  }
}
