// src/infra/repos/audit-repo-pg.js
// Implementación PostgreSQL del Repositorio de Auditoría
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con audit_log en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para audit_log
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Valida y trunca datos si exceden límites razonables
// - La tabla es append-only (no UPDATE ni DELETE)

import { query } from '../../../database/pg.js';

/**
 * Tamaño máximo permitido para el campo data (JSONB)
 * Si excede, se trunca o elimina campos grandes
 */
const MAX_DATA_SIZE = 16 * 1024; // 16KB

/**
 * Trunca o limpia el objeto data si excede el tamaño máximo
 * 
 * @param {Object} data - Objeto de datos
 * @returns {Object} Objeto truncado/limpiado
 */
function truncateDataIfNeeded(data) {
  if (!data || typeof data !== 'object') {
    return data || {};
  }

  try {
    const jsonStr = JSON.stringify(data);
    if (jsonStr.length <= MAX_DATA_SIZE) {
      return data;
    }

    // Si excede, intentar eliminar campos grandes
    const cleaned = { ...data };
    
    // Eliminar campos conocidos que pueden ser grandes
    const largeFields = ['stack', 'error', 'trace', 'body', 'response', 'headers'];
    for (const field of largeFields) {
      if (cleaned[field]) {
        delete cleaned[field];
      }
    }

    // Verificar de nuevo
    const cleanedStr = JSON.stringify(cleaned);
    if (cleanedStr.length <= MAX_DATA_SIZE) {
      return cleaned;
    }

    // Si aún excede, truncar el JSON string
    const truncated = cleanedStr.substring(0, MAX_DATA_SIZE - 50);
    return JSON.parse(truncated + '...');
  } catch (err) {
    // Si hay error al procesar, retornar objeto mínimo
    return {
      _error: 'Data too large and could not be processed',
      _original_keys: Object.keys(data)
    };
  }
}

/**
 * Repositorio de Auditoría - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con audit_log.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class AuditRepoPg {
  /**
   * Registra un evento de auditoría
   * 
   * @param {Object} event - Datos del evento
   * @param {string} [event.requestId] - Correlation ID del request
   * @param {string} [event.actorType] - Tipo de actor: 'student', 'admin', 'system'
   * @param {string} [event.actorId] - ID del actor
   * @param {string} event.eventType - Tipo de evento (requerido)
   * @param {string} [event.severity='info'] - Severidad: 'info', 'warn', 'error'
   * @param {Object} [event.data={}] - Datos adicionales del evento
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto con el evento registrado
   */
  async recordEvent(event, client = null) {
    if (!event || !event.eventType) {
      throw new Error('eventType es requerido para recordEvent');
    }

    // Validar y limpiar datos
    const safeData = truncateDataIfNeeded(event.data || {});
    
    // Añadir APP_VERSION y BUILD_ID automáticamente
    const enrichedData = {
      ...safeData,
      app_version: process.env.APP_VERSION || '4.0.0',
      build_id: process.env.BUILD_ID || 'unknown'
    };

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO audit_log (
        request_id, actor_type, actor_id, event_type, severity, data
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      event.requestId || null,
      event.actorType || null,
      event.actorId || null,
      event.eventType,
      event.severity || 'info',
      JSON.stringify(enrichedData)
    ]);

    return result.rows[0];
  }

  /**
   * Obtiene eventos recientes con filtros opcionales
   * 
   * @param {number} [limit=200] - Número máximo de eventos
   * @param {Object} [filters] - Filtros opcionales
   * @param {string} [filters.eventType] - Filtrar por tipo de evento
   * @param {string} [filters.actorId] - Filtrar por ID de actor
   * @param {string} [filters.requestId] - Filtrar por request ID
   * @param {string} [filters.severity] - Filtrar por severidad
   * @param {Date|string} [filters.since] - Filtrar eventos desde esta fecha
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array<Object>>} Array de eventos ordenados por created_at DESC
   */
  async getRecentEvents(limit = 200, filters = {}, client = null) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Construir condiciones dinámicamente
    if (filters.eventType) {
      conditions.push(`event_type = $${paramIndex}`);
      params.push(filters.eventType);
      paramIndex++;
    }

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      params.push(filters.actorId);
      paramIndex++;
    }

    if (filters.requestId) {
      conditions.push(`request_id = $${paramIndex}`);
      params.push(filters.requestId);
      paramIndex++;
    }

    if (filters.severity) {
      conditions.push(`severity = $${paramIndex}`);
      params.push(filters.severity);
      paramIndex++;
    }

    if (filters.since) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(filters.since instanceof Date ? filters.since.toISOString() : filters.since);
      paramIndex++;
    }

    // Construir query
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    params.push(Math.min(limit, 1000)); // Máximo 1000 eventos por seguridad

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT * FROM audit_log
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
 * @returns {AuditRepoPg} Instancia del repositorio
 */
export function getDefaultAuditRepo() {
  if (!defaultInstance) {
    defaultInstance = new AuditRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultAuditRepo();













