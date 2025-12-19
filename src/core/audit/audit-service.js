// src/core/audit/audit-service.js
// Servicio de auditoría uniforme para eventos del Master (FASE 3)
// 
// REGLAS:
// - Fail-open: si falla la auditoría, loguear warning y continuar
// - No debe romper ninguna operación si falla
// - Logs estructurados: [Audit][OK] y [Audit][FAIL]

import { query } from '../../../database/pg.js';
import { logWarn, logInfo } from '../observability/logger.js';
import { getRequestId } from '../observability/request-context.js';

/**
 * Extrae metadatos del request (IP, user-agent)
 * 
 * @param {Request} request - Request object
 * @returns {Object} Metadatos del request
 */
function extractRequestMeta(request) {
  if (!request || !request.headers) {
    return { ip: null, userAgent: null };
  }

  // Intentar obtener IP de diferentes headers (Cloudflare, proxies, etc.)
  const ip = request.headers.get('cf-connecting-ip') ||
             request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             request.headers.get('x-client-ip') ||
             null;

  const userAgent = request.headers.get('user-agent') || null;

  return { ip, userAgent };
}

/**
 * Registra un evento de auditoría en audit_events
 * 
 * @param {Object} params - Parámetros del evento
 * @param {string} params.actor - Tipo de actor ('admin', 'master', 'system')
 * @param {string} [params.actorId] - ID del actor (opcional)
 * @param {number} [params.alumnoId] - ID del alumno afectado (opcional)
 * @param {string} params.action - Nombre de la acción ('apodo', 'marcar-limpio', 'pause_create', etc.)
 * @param {string} [params.entityType] - Tipo de entidad afectada (opcional)
 * @param {string|number} [params.entityId] - ID de la entidad afectada (opcional)
 * @param {Object} [params.payload={}] - Datos adicionales del evento
 * @param {Request} [params.req] - Request object (para extraer IP/user-agent)
 * @param {string} [params.requestId] - Correlation ID del request (opcional, se genera si no se proporciona)
 * @returns {Promise<Object|null>} Evento registrado o null si falló (fail-open)
 */
export async function logAuditEvent({
  actor,
  actorId = null,
  alumnoId = null,
  action,
  entityType = null,
  entityId = null,
  payload = {},
  req = null,
  requestId = null
}) {
  // Validación mínima
  if (!actor || !action) {
    logWarn('audit', 'logAuditEvent: actor y action son requeridos', {
      actor,
      action
    });
    return null;
  }

  // Extraer metadatos del request si está disponible
  const reqMeta = req ? extractRequestMeta(req) : { ip: null, userAgent: null };
  
  // Generar requestId si no se proporciona
  const finalRequestId = requestId || getRequestId();

  try {
    // Insertar evento en audit_events
    const result = await query(`
      INSERT INTO audit_events (
        actor_type, actor_id, alumno_id, action, entity_type, entity_id,
        payload, ip, user_agent, request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      actor,
      actorId || null,
      alumnoId || null,
      action,
      entityType || null,
      entityId ? String(entityId) : null,
      JSON.stringify(payload),
      reqMeta.ip,
      reqMeta.userAgent,
      finalRequestId
    ]);

    // Log de éxito (solo en dev/beta para no saturar)
    const env = process.env.APP_ENV || 'prod';
    if (env === 'dev' || env === 'beta') {
      logInfo('audit', '[Audit][OK] Evento registrado', {
        event_id: result.rows[0]?.id,
        actor,
        action,
        alumno_id: alumnoId
      }, true);
    }

    return result.rows[0] || null;
  } catch (error) {
    // Fail-open: loguear error pero no fallar la operación
    logWarn('audit', '[Audit][FAIL] Error registrando evento de auditoría', {
      error: error.message,
      actor,
      action,
      alumno_id: alumnoId,
      stack: error.stack?.substring(0, 200) // Solo primeros 200 chars del stack
    });
    
    return null;
  }
}

/**
 * Obtiene eventos de auditoría recientes con filtros opcionales
 * 
 * @param {Object} [filters] - Filtros opcionales
 * @param {number} [filters.alumnoId] - Filtrar por alumno_id
 * @param {string} [filters.action] - Filtrar por acción
 * @param {string} [filters.actorType] - Filtrar por tipo de actor
 * @param {number} [filters.limit=100] - Límite de resultados
 * @returns {Promise<Array>} Array de eventos ordenados por created_at DESC
 */
export async function getAuditEvents(filters = {}) {
  const {
    alumnoId = null,
    action = null,
    actorType = null,
    limit = 100
  } = filters;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // Construir condiciones dinámicamente
  if (alumnoId) {
    conditions.push(`alumno_id = $${paramIndex}`);
    params.push(alumnoId);
    paramIndex++;
  }

  if (action) {
    conditions.push(`action = $${paramIndex}`);
    params.push(action);
    paramIndex++;
  }

  if (actorType) {
    conditions.push(`actor_type = $${paramIndex}`);
    params.push(actorType);
    paramIndex++;
  }

  // Solo eventos no eliminados
  conditions.push(`is_deleted = FALSE`);

  // Construir query
  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}`
    : `WHERE is_deleted = FALSE`;

  params.push(Math.min(limit, 1000)); // Máximo 1000 eventos por seguridad

  try {
    const result = await query(`
      SELECT * FROM audit_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}
    `, params);

    return result.rows || [];
  } catch (error) {
    logWarn('audit', 'Error obteniendo eventos de auditoría', {
      error: error.message
    });
    return [];
  }
}












