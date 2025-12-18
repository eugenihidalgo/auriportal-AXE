// src/infra/repos/recorrido-event-repo-pg.js
// Implementación PostgreSQL del Repositorio de Events de Recorridos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con events de recorridos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para events
// - Retorna objetos raw de PostgreSQL (sin transformación)
// - Todos los métodos aceptan un parámetro opcional `client` para transacciones
// - Idempotency: si idempotency_key existe, no se duplica

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Events de Recorridos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con events.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class RecorridoEventRepoPg {
  /**
   * Añade un nuevo evento (append-only)
   * Si idempotency_key existe y ya hay un evento con esa clave, retorna el existente.
   * 
   * @param {Object} data - Datos del evento
   * @param {string|null} [data.run_id] - UUID del run (opcional)
   * @param {string|null} [data.user_id] - ID del usuario (opcional)
   * @param {string} data.event_type - Tipo de evento
   * @param {Object} data.payload_json - Payload del evento
   * @param {string|null} [data.idempotency_key] - Clave de idempotencia (opcional)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Objeto evento creado (o existente si idempotency_key duplicado)
   */
  async appendEvent(data, client = null) {
    const { run_id = null, user_id = null, event_type, payload_json, idempotency_key = null } = data;
    
    const queryFn = client ? client.query.bind(client) : query;
    
    // Si hay idempotency_key, verificar si ya existe
    if (idempotency_key) {
      const existing = await queryFn(`
        SELECT * FROM recorrido_events
        WHERE idempotency_key = $1
        LIMIT 1
      `, [idempotency_key]);
      
      if (existing.rows[0]) {
        // Ya existe, retornar el existente
        const event = existing.rows[0];
        if (typeof event.payload_json === 'string') {
          event.payload_json = JSON.parse(event.payload_json);
        }
        return event;
      }
    }
    
    // Insertar nuevo evento
    const result = await queryFn(`
      INSERT INTO recorrido_events (
        run_id, user_id, event_type, payload_json, idempotency_key
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [run_id, user_id, event_type, JSON.stringify(payload_json), idempotency_key]);

    // Parsear payload_json si es string
    const event = result.rows[0];
    if (typeof event.payload_json === 'string') {
      event.payload_json = JSON.parse(event.payload_json);
    }

    return event;
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {RecorridoEventRepoPg} Instancia del repositorio
 */
export function getDefaultRecorridoEventRepo() {
  if (!defaultInstance) {
    defaultInstance = new RecorridoEventRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultRecorridoEventRepo();




