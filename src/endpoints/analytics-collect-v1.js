// src/endpoints/analytics-collect-v1.js
// Endpoint de ingesta de eventos de analytics desde el cliente
//
// REGLAS:
// - POST /analytics/collect
// - Validación estricta de entrada
// - Respeta feature flag analytics_v1
// - Rate limit básico (TODO si no hay infra)
// - Fail-open: si falla DB, responder 204 igualmente pero loguear error
// - No PII en analytics (prohibido email/nombre/texto libre sin sanitizar)

import { isFeatureEnabled } from '../core/flags/feature-flags.js';
import { getRequestId } from '../core/observability/request-context.js';
import { logWarn, logError } from '../core/observability/logger.js';
import { requireStudentContext, requireAdminContext } from '../core/auth-context.js';
import { getDefaultAnalyticsRepo } from '../infra/repos/analytics-repo-pg.js';

/**
 * Rate limit simple en memoria (TODO: implementar rate limit robusto)
 * Por ahora, solo previene spam básico
 */
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests por minuto

/**
 * Verifica rate limit básico por IP/session
 * 
 * @param {string} identifier - IP o session_id
 * @returns {boolean} true si está dentro del límite, false si excedió
 */
function checkRateLimit(identifier) {
  const now = Date.now();
  const key = identifier || 'unknown';
  
  const record = rateLimitMap.get(key);
  if (!record) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  // Si la ventana expiró, resetear
  if (now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  // Incrementar contador
  record.count++;
  
  // Si excedió el límite
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  return true;
}

/**
 * Limpia entradas expiradas del rate limit (cada 5 minutos)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Valida el body del request
 * 
 * @param {Object} body - Body del request
 * @returns {Object} { valid: boolean, error?: string, data?: Object }
 */
function validateBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Body debe ser un objeto JSON' };
  }
  
  // Validar event_name
  if (!body.event_name || typeof body.event_name !== 'string') {
    return { valid: false, error: 'event_name es requerido y debe ser un string' };
  }
  
  // Validar formato de event_name: [a-z0-9_:.-], length <= 80
  const eventNamePattern = /^[a-z0-9_:.-]+$/;
  if (!eventNamePattern.test(body.event_name) || body.event_name.length > 80) {
    return { valid: false, error: 'event_name solo permite caracteres [a-z0-9_:.-] y máximo 80 caracteres' };
  }
  
  // Validar props
  if (body.props !== undefined && typeof body.props !== 'object') {
    return { valid: false, error: 'props debe ser un objeto JSON' };
  }
  
  // Validar tamaño de props (16KB tras stringify)
  if (body.props) {
    try {
      const propsStr = JSON.stringify(body.props);
      if (propsStr.length > 16 * 1024) {
        return { valid: false, error: 'props excede tamaño máximo de 16KB' };
      }
    } catch (err) {
      return { valid: false, error: 'props no es un JSON válido' };
    }
  }
  
  // Validar session_id (opcional, pero si existe debe ser string y <= 128)
  if (body.session_id !== undefined) {
    if (typeof body.session_id !== 'string' || body.session_id.length > 128) {
      return { valid: false, error: 'session_id debe ser un string de máximo 128 caracteres' };
    }
  }
  
  // Validar path (opcional, pero si existe debe ser string y <= 500)
  if (body.path !== undefined) {
    if (typeof body.path !== 'string' || body.path.length > 500) {
      return { valid: false, error: 'path debe ser un string de máximo 500 caracteres' };
    }
  }
  
  // Validar screen (opcional, pero si existe debe ser string y <= 100)
  if (body.screen !== undefined) {
    if (typeof body.screen !== 'string' || body.screen.length > 100) {
      return { valid: false, error: 'screen debe ser un string de máximo 100 caracteres' };
    }
  }
  
  return {
    valid: true,
    data: {
      eventName: body.event_name.toLowerCase(),
      props: body.props || {},
      sessionId: body.session_id || null,
      path: body.path || null,
      screen: body.screen || null
    }
  };
}

/**
 * Handler del endpoint /analytics/collect
 * 
 * POST /analytics/collect
 * Body: { event_name, props?, path?, screen?, session_id? }
 * 
 * Respeta feature flag analytics_v1:
 * - off: responde 204 pero no guarda nada
 * - beta: solo en dev/beta
 * - on: todos los entornos
 * 
 * Fail-open: si falla DB, responde 204 igualmente pero loguea error
 */
export default async function analyticsCollectHandler(request, env, ctx) {
  // Solo aceptar POST
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  // Verificar feature flag
  if (!isFeatureEnabled('analytics_v1', ctx)) {
    // Feature desactivada: responder 204 pero no guardar nada
    return new Response(null, { status: 204 });
  }
  
  try {
    // Parsear body
    const body = await request.json();
    
    // Validar body
    const validation = validateBody(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { eventName, props, sessionId, path, screen } = validation.data;
    
    // Rate limit básico por IP
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    
    if (!checkRateLimit(clientIP)) {
      // Rate limit excedido: responder 429 pero no loguear (evitar spam)
      return new Response('Too Many Requests', { status: 429 });
    }
    
    // Intentar obtener contexto de autenticación (sin bloquear si falla)
    let actorType = 'anonymous';
    let actorId = null;
    
    try {
      // Intentar obtener contexto de estudiante
      const authCtx = await requireStudentContext(request, env);
      if (authCtx && !(authCtx instanceof Response) && authCtx.user) {
        actorType = 'student';
        actorId = authCtx.user.id?.toString() || null;
      } else {
        // Si no es estudiante, intentar admin
        const adminCtx = await requireAdminContext(request, env);
        if (adminCtx && !(adminCtx instanceof Response) && adminCtx.isAdmin) {
          actorType = 'admin';
          actorId = adminCtx.user?.id?.toString() || null;
        }
      }
    } catch (err) {
      // Si falla la autenticación, usar anonymous (fail-open)
      // No logueamos para evitar ruido
    }
    
    // Obtener request_id
    const requestId = ctx?.requestId || getRequestId();
    
    // Obtener APP_VERSION y BUILD_ID
    const appVersion = process.env.APP_VERSION || '4.0.0';
    const buildId = process.env.BUILD_ID || 'unknown';
    
    // Registrar evento usando el repositorio
    try {
      const analyticsRepo = getDefaultAnalyticsRepo();
      await analyticsRepo.recordEvent({
        requestId,
        actorType,
        actorId,
        sessionId,
        source: 'client',
        eventName,
        path,
        screen,
        appVersion,
        buildId,
        props
      });
    } catch (dbError) {
      // Fail-open: si falla DB, responder 204 igualmente pero loguear error
      logError('analytics', 'Error guardando evento de analytics en DB', {
        eventName,
        error: dbError.message,
        requestId
      });
      // Continuar para responder 204
    }
    
    // Responder 204 No Content en éxito
    return new Response(null, { status: 204 });
    
  } catch (error) {
    // Si hay error parseando JSON o validando, responder 400
    if (error instanceof SyntaxError || error.message.includes('JSON')) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Otros errores: fail-open, responder 204 pero loguear
    logError('analytics', 'Error inesperado en analytics-collect', {
      error: error.message,
      requestId: ctx?.requestId || getRequestId()
    });
    
    return new Response(null, { status: 204 });
  }
}














