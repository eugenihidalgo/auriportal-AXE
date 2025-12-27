// src/infra/repos/analytics-repo-pg.js
// Implementación PostgreSQL del Repositorio de Analytics
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con analytics_events en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para analytics_events
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Valida y trunca datos si exceden límites razonables
// - La tabla es append-only (no UPDATE ni DELETE)
// - No permite PII (email, nombre, texto libre sin sanitizar)

import { query } from '../../../database/pg.js';

/**
 * Tamaño máximo permitido para el campo props (JSONB)
 * Si excede, se trunca o elimina campos grandes
 */
const MAX_PROPS_SIZE = 16 * 1024; // 16KB

/**
 * Longitud máxima para campos de texto
 */
const MAX_EVENT_NAME_LENGTH = 80;
const MAX_SESSION_ID_LENGTH = 128;
const MAX_PATH_LENGTH = 500;
const MAX_SCREEN_LENGTH = 100;

/**
 * Validación de event_name: solo permite caracteres alfanuméricos, guiones bajos, guiones y puntos
 */
function validateEventName(eventName) {
  if (!eventName || typeof eventName !== 'string') {
    throw new Error('eventName es requerido y debe ser un string');
  }
  
  // Validar longitud
  if (eventName.length > MAX_EVENT_NAME_LENGTH) {
    throw new Error(`eventName excede longitud máxima de ${MAX_EVENT_NAME_LENGTH} caracteres`);
  }
  
  // Validar caracteres permitidos: [a-z0-9_:.-]
  const validPattern = /^[a-z0-9_:.-]+$/;
  if (!validPattern.test(eventName)) {
    throw new Error('eventName solo permite caracteres [a-z0-9_:.-]');
  }
  
  return eventName.toLowerCase();
}

/**
 * Trunca o limpia el objeto props si excede el tamaño máximo
 * 
 * @param {Object} props - Objeto de propiedades
 * @returns {Object} Objeto truncado/limpiado
 */
function truncatePropsIfNeeded(props) {
  if (!props || typeof props !== 'object') {
    return props || {};
  }

  try {
    const jsonStr = JSON.stringify(props);
    if (jsonStr.length <= MAX_PROPS_SIZE) {
      return props;
    }

    // Si excede, intentar eliminar campos grandes conocidos
    const cleaned = { ...props };
    
    // Eliminar campos conocidos que pueden ser grandes o contener PII
    const largeOrPIIFields = ['stack', 'error', 'trace', 'body', 'response', 'headers', 'email', 'nombre', 'name', 'text', 'message', 'content'];
    for (const field of largeOrPIIFields) {
      if (cleaned[field]) {
        delete cleaned[field];
      }
    }

    // Verificar de nuevo
    const cleanedStr = JSON.stringify(cleaned);
    if (cleanedStr.length <= MAX_PROPS_SIZE) {
      return cleaned;
    }

    // Si aún excede, truncar el JSON string
    const truncated = cleanedStr.substring(0, MAX_PROPS_SIZE - 50);
    try {
      return JSON.parse(truncated + '...');
    } catch {
      // Si no se puede parsear, retornar objeto mínimo
      return {
        _error: 'Props too large and could not be processed',
        _original_keys: Object.keys(props)
      };
    }
  } catch (err) {
    // Si hay error al procesar, retornar objeto mínimo
    return {
      _error: 'Props could not be processed',
      _original_keys: Object.keys(props)
    };
  }
}

/**
 * Sanitiza y valida campos de texto
 */
function sanitizeText(value, maxLength, fieldName) {
  if (!value) return null;
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} debe ser un string`);
  }
  if (value.length > maxLength) {
    console.warn(`⚠️  [analytics-repo] ${fieldName} truncado de ${value.length} a ${maxLength} caracteres`);
    return value.substring(0, maxLength);
  }
  return value;
}

/**
 * Repositorio de Analytics - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con analytics_events.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class AnalyticsRepoPg {
  /**
   * Registra un evento de analytics
   * 
   * @param {Object} event - Datos del evento
   * @param {string} [event.requestId] - Correlation ID del request
   * @param {string} event.actorType - Tipo de actor: 'student', 'admin', 'system', 'anonymous'
   * @param {string} [event.actorId] - ID del actor (NUNCA email ni PII)
   * @param {string} [event.sessionId] - ID de sesión del cliente
   * @param {string} event.source - Origen del evento: 'client' o 'server'
   * @param {string} event.eventName - Nombre del evento
   * @param {string} [event.path] - Ruta HTTP del evento
   * @param {string} [event.screen] - Pantalla/vista del evento
   * @param {string} event.appVersion - Versión de la aplicación
   * @param {string} event.buildId - Build ID de la aplicación
   * @param {Object} [event.props={}] - Propiedades adicionales del evento
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto con el evento registrado
   */
  async recordEvent(event, client = null) {
    // Validaciones requeridas
    if (!event || !event.eventName) {
      throw new Error('eventName es requerido para recordEvent');
    }
    if (!event.actorType) {
      throw new Error('actorType es requerido para recordEvent');
    }
    if (!event.source) {
      throw new Error('source es requerido para recordEvent');
    }
    if (!event.appVersion) {
      throw new Error('appVersion es requerido para recordEvent');
    }
    if (!event.buildId) {
      throw new Error('buildId es requerido para recordEvent');
    }

    // Validar y sanitizar eventName
    const eventName = validateEventName(event.eventName);
    
    // Validar actorType
    const validActorTypes = ['student', 'admin', 'system', 'anonymous'];
    if (!validActorTypes.includes(event.actorType)) {
      throw new Error(`actorType debe ser uno de: ${validActorTypes.join(', ')}`);
    }
    
    // Validar source
    const validSources = ['client', 'server'];
    if (!validSources.includes(event.source)) {
      throw new Error(`source debe ser 'client' o 'server'`);
    }

    // Validar y limpiar props
    const safeProps = truncatePropsIfNeeded(event.props || {});
    
    // Sanitizar campos de texto
    const requestId = sanitizeText(event.requestId, 255, 'requestId');
    const actorId = sanitizeText(event.actorId, 255, 'actorId');
    const sessionId = sanitizeText(event.sessionId, MAX_SESSION_ID_LENGTH, 'sessionId');
    const path = sanitizeText(event.path, MAX_PATH_LENGTH, 'path');
    const screen = sanitizeText(event.screen, MAX_SCREEN_LENGTH, 'screen');

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO analytics_events (
        request_id, actor_type, actor_id, session_id, source, event_name,
        path, screen, app_version, build_id, props
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      requestId,
      event.actorType,
      actorId,
      sessionId,
      event.source,
      eventName,
      path,
      screen,
      event.appVersion,
      event.buildId,
      JSON.stringify(safeProps)
    ]);

    return result.rows[0];
  }

  /**
   * Obtiene eventos recientes con filtros opcionales
   * 
   * @param {Object} [filters] - Filtros opcionales
   * @param {string} [filters.eventName] - Filtrar por nombre de evento
   * @param {string} [filters.actorId] - Filtrar por ID de actor
   * @param {string} [filters.sessionId] - Filtrar por ID de sesión
   * @param {string} [filters.requestId] - Filtrar por request ID
   * @param {string} [filters.source] - Filtrar por origen: 'client' o 'server'
   * @param {string} [filters.actorType] - Filtrar por tipo de actor
   * @param {Date|string} [filters.since] - Filtrar eventos desde esta fecha
   * @param {Date|string} [filters.until] - Filtrar eventos hasta esta fecha
   * @param {number} [limit=200] - Número máximo de eventos
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array<Object>>} Array de eventos ordenados por created_at DESC
   */
  async getRecentEvents(filters = {}, limit = 200, client = null) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Construir condiciones dinámicamente
    if (filters.eventName) {
      conditions.push(`event_name = $${paramIndex}`);
      params.push(filters.eventName.toLowerCase());
      paramIndex++;
    }

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(filters.actorId);
      paramIndex++;
    }

    if (filters.sessionId) {
      conditions.push(`session_id = $${paramIndex}`);
      params.push(filters.sessionId);
      paramIndex++;
    }

    if (filters.requestId) {
      conditions.push(`request_id = $${paramIndex}`);
      params.push(filters.requestId);
      paramIndex++;
    }

    if (filters.source) {
      conditions.push(`source = $${paramIndex}`);
      params.push(filters.source);
      paramIndex++;
    }

    if (filters.actorType) {
      conditions.push(`actor_type = $${paramIndex}`);
      params.push(filters.actorType);
      paramIndex++;
    }

    if (filters.since) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(filters.since instanceof Date ? filters.since.toISOString() : filters.since);
      paramIndex++;
    }

    if (filters.until) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(filters.until instanceof Date ? filters.until.toISOString() : filters.until);
      paramIndex++;
    }

    // Construir query
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    params.push(Math.min(limit, 1000)); // Máximo 1000 eventos por seguridad

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM analytics_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}
    `, params);

    return result.rows;
  }
}

// Exportar instancia singleton por defecto
// Esto permite inyectar un mock en tests si es necesario
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {AnalyticsRepoPg} Instancia del repositorio
 */
export function getDefaultAnalyticsRepo() {
  if (!defaultInstance) {
    defaultInstance = new AnalyticsRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultAnalyticsRepo();




















