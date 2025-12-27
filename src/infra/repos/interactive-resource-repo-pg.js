// src/infra/repos/interactive-resource-repo-pg.js
// Implementación PostgreSQL del Repositorio de Recursos Interactivos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con interactive_resources en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para recursos interactivos
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - Todos los métodos aceptan client opcional para transacciones
// - Usa status ('active'/'archived') NO activo (boolean)

import { query } from '../../../database/pg.js';
import { InteractiveResourceRepo } from '../../core/repos/interactive-resource-repo.js';

// Singleton para evitar múltiples instancias
let defaultRepo = null;

/**
 * Repositorio de Recursos Interactivos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con recursos interactivos.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class InteractiveResourceRepoPg extends InteractiveResourceRepo {
  /**
   * Lista recursos por origen (SOT y entity_id)
   */
  async listByOrigin({ sot, entity_id }, options = {}, client = null) {
    if (!sot || !entity_id) {
      throw new Error('sot y entity_id son requeridos');
    }

    const { onlyActive = true, resource_type } = options;
    const queryFn = client ? client.query.bind(client) : query;

    let sql = `
      SELECT * FROM interactive_resources 
      WHERE origin->>'sot' = $1 
      AND origin->>'entity_id' = $2
    `;
    const params = [sot, entity_id];
    const conditions = [];

    if (onlyActive) {
      conditions.push(`status = 'active'`);
    }

    if (resource_type) {
      conditions.push(`resource_type = $${params.length + 1}`);
      params.push(resource_type);
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  /**
   * Obtiene un recurso por ID
   */
  async getById(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM interactive_resources WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Crea un nuevo recurso
   */
  async createResource(resourceData, client = null) {
    if (!resourceData.title) {
      throw new Error('title es requerido');
    }
    if (!resourceData.resource_type) {
      throw new Error('resource_type es requerido');
    }
    if (!resourceData.origin || !resourceData.origin.sot || !resourceData.origin.entity_id) {
      throw new Error('origin con sot y entity_id es requerido');
    }

    const validTypes = ['video', 'audio', 'image', 'quiz', 'experience', 'game'];
    if (!validTypes.includes(resourceData.resource_type)) {
      throw new Error(`resource_type debe ser uno de: ${validTypes.join(', ')}`);
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO interactive_resources (
        title, resource_type, payload, capabilities, origin, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        resourceData.title,
        resourceData.resource_type,
        JSON.stringify(resourceData.payload || {}),
        JSON.stringify(resourceData.capabilities || {}),
        JSON.stringify(resourceData.origin),
        resourceData.status || 'active'
      ]
    );

    return result.rows[0];
  }

  /**
   * Actualiza un recurso
   */
  async updateResource(id, patch, client = null) {
    if (!id) {
      throw new Error('id es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;

    // Construir SET dinámicamente
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (patch.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(patch.title);
    }

    if (patch.payload !== undefined) {
      // Si payload es un objeto, mergear con el existente
      if (typeof patch.payload === 'object' && !Array.isArray(patch.payload)) {
        const existing = await this.getById(id, client);
        if (existing && existing.payload) {
          const merged = { ...existing.payload, ...patch.payload };
          updates.push(`payload = $${paramIndex++}`);
          params.push(JSON.stringify(merged));
        } else {
          updates.push(`payload = $${paramIndex++}`);
          params.push(JSON.stringify(patch.payload));
        }
      } else {
        updates.push(`payload = $${paramIndex++}`);
        params.push(JSON.stringify(patch.payload));
      }
    }

    if (patch.capabilities !== undefined) {
      updates.push(`capabilities = $${paramIndex++}`);
      params.push(JSON.stringify(patch.capabilities));
    }

    if (updates.length === 0) {
      // No hay nada que actualizar, retornar el recurso actual
      return await this.getById(id, client);
    }

    params.push(id);
    const sql = `
      UPDATE interactive_resources 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await queryFn(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Archiva un recurso (soft delete)
   */
  async archiveResource(id, client = null) {
    if (!id) {
      throw new Error('id es requerido');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE interactive_resources 
       SET status = 'archived'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }
}

/**
 * Obtiene o crea la instancia singleton del repositorio
 */
export function getInteractiveResourceRepo() {
  if (!defaultRepo) {
    defaultRepo = new InteractiveResourceRepoPg();
  }
  return defaultRepo;
}


