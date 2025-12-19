// src/core/analytics/track.js
// Helper para tracking de eventos de analytics en el servidor
//
// REGLAS:
// - Fail-open: analytics nunca debe bloquear UX
// - Respetar feature flag analytics_v1
// - Enriquecer automáticamente con request_id, actor_type/id, APP_VERSION, BUILD_ID
// - No PII en analytics (prohibido email/nombre/texto libre sin sanitizar)

import { isFeatureEnabled } from '../flags/feature-flags.js';
import { getRequestId } from '../observability/request-context.js';
import { logWarn, logError } from '../observability/logger.js';
import { getDefaultAnalyticsRepo } from '../../infra/repos/analytics-repo-pg.js';

/**
 * Trackea un evento de analytics desde el servidor
 * 
 * Enriquece automáticamente el evento con:
 * - request_id: desde el contexto de request
 * - actor_type y actor_id: desde ctx (si existe)
 * - APP_VERSION y BUILD_ID: desde variables de entorno
 * - source: 'server'
 * 
 * Respeta el feature flag analytics_v1:
 * - off: no guarda eventos (fail-silent)
 * - beta: solo en dev/beta
 * - on: todos los entornos
 * 
 * Fail-open: si falla, loguea error pero no tira excepción
 * 
 * @param {Object} ctx - Contexto del request (puede contener user, request_id, etc.)
 * @param {string} eventName - Nombre del evento (ej: 'page_view', 'button_click', 'practice_completed')
 * @param {Object} [props={}] - Propiedades adicionales del evento (sin PII)
 * @param {Object} [options={}] - Opciones adicionales
 * @param {string} [options.path] - Ruta HTTP del evento
 * @param {string} [options.screen] - Pantalla/vista del evento
 * @returns {Promise<void>} No retorna nada (fail-open)
 * 
 * @example
 * // Tracking básico
 * await trackServerEvent(ctx, 'page_view', { page: '/enter' });
 * 
 * @example
 * // Tracking con path y screen
 * await trackServerEvent(ctx, 'practice_completed', 
 *   { practice_type: 'meditation', duration: 10 },
 *   { path: '/enter', screen: 'pantalla2' }
 * );
 */
export async function trackServerEvent(ctx, eventName, props = {}, options = {}) {
  // Verificar feature flag
  if (!isFeatureEnabled('analytics_v1', ctx)) {
    // Feature desactivada: no hacer nada (fail-silent)
    return;
  }

  try {
    // Obtener request_id del contexto
    const requestId = ctx?.requestId || getRequestId();
    
    // Determinar actor_type y actor_id desde ctx
    let actorType = 'system';
    let actorId = null;
    
    if (ctx?.user) {
      // Si hay user en ctx, determinar tipo
      if (ctx.user.isAdmin) {
        actorType = 'admin';
        actorId = ctx.user.id?.toString() || null;
      } else if (ctx.user.id) {
        actorType = 'student';
        actorId = ctx.user.id.toString();
      }
    } else if (ctx?.isAdmin) {
      actorType = 'admin';
      actorId = ctx.adminId?.toString() || null;
    } else if (ctx?.isAuthenticated && ctx?.user?.id) {
      actorType = 'student';
      actorId = ctx.user.id.toString();
    }
    
    // Obtener APP_VERSION y BUILD_ID
    const appVersion = process.env.APP_VERSION || '4.0.0';
    const buildId = process.env.BUILD_ID || 'unknown';
    
    // Registrar evento usando el repositorio
    const analyticsRepo = getDefaultAnalyticsRepo();
    await analyticsRepo.recordEvent({
      requestId,
      actorType,
      actorId,
      source: 'server',
      eventName,
      path: options.path || null,
      screen: options.screen || null,
      appVersion,
      buildId,
      props
    });
    
    // No logueamos éxito para evitar ruido en logs
  } catch (error) {
    // Fail-open: loguear error pero no tirar excepción
    logError('analytics', 'Error registrando evento de analytics', {
      eventName,
      error: error.message,
      requestId: ctx?.requestId || getRequestId()
    });
    // No re-lanzar el error (fail-open)
  }
}













