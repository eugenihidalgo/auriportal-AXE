// src/infra/repos/origin-repo-pg.js
// Implementación PostgreSQL del Repositorio de Origin Definitions

import { query } from '../../../database/pg.js';
import { OriginRepo } from '../../core/repos/origin-repo.js';

let defaultRepo = null;

export class OriginRepoPg extends OriginRepo {
  async createOrigin(originData, options = {}, client = null) {
    const {
      origin_key,
      status = 'active',
      source_selector,
      execution,
      actors,
      targets,
      surfaces = [],
      signals = {},
      ui = {},
      meta = {},
      version = 1,
      created_by = null
    } = originData;

    const { idempotent = true } = options;

    const queryFn = client ? client.query.bind(client) : query;

    // Si es idempotente, verificar si ya existe
    if (idempotent) {
      const existing = await this.getOriginByKey(origin_key, client);
      if (existing && existing.deleted_at === null) {
        return existing;
      }
    }

    const result = await queryFn(
      `INSERT INTO origin_definitions (
        origin_key, status, source_selector, execution, actors, targets,
        surfaces, signals, ui, meta, version, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (origin_key) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        origin_key, status, JSON.stringify(source_selector), JSON.stringify(execution),
        JSON.stringify(actors), JSON.stringify(targets), JSON.stringify(surfaces),
        JSON.stringify(signals), JSON.stringify(ui), JSON.stringify(meta),
        version, created_by
      ]
    );

    return result.rows[0];
  }

  async getOriginByKey(originKey, client = null) {
    if (!originKey) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM origin_definitions WHERE origin_key = $1 AND deleted_at IS NULL',
      [originKey]
    );

    return result.rows[0] || null;
  }

  async getOriginById(originId, client = null) {
    if (!originId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM origin_definitions WHERE id = $1 AND deleted_at IS NULL',
      [originId]
    );

    return result.rows[0] || null;
  }

  async listOrigins(filter = {}, client = null) {
    const { status, source_type, includeDeleted = false } = filter;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (!includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (source_type) {
      conditions.push(`source_selector->>'type' = $${paramIndex++}`);
      params.push(source_type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM origin_definitions ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return result.rows || [];
  }

  async updateOrigin(originKey, patchData, client = null) {
    if (!originKey) return null;

    const allowedFields = ['status', 'source_selector', 'execution', 'actors', 'targets',
                          'surfaces', 'signals', 'ui', 'meta', 'version', 'updated_by'];
    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (patchData[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        if (['source_selector', 'execution', 'actors', 'targets', 'surfaces', 'signals', 'ui', 'meta'].includes(field)) {
          params.push(JSON.stringify(patchData[field]));
        } else {
          params.push(patchData[field]);
        }
      }
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(originKey);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE origin_definitions 
       SET ${updates.join(', ')}
       WHERE origin_key = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  async archiveOrigin(originKey, archivedBy = null, client = null) {
    if (!originKey) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE origin_definitions 
       SET status = 'archived', updated_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE origin_key = $2 AND deleted_at IS NULL
       RETURNING *`,
      [archivedBy, originKey]
    );

    return result.rows[0] || null;
  }

  async softDeleteOrigin(originKey, deletedBy = null, client = null) {
    if (!originKey) return false;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE origin_definitions 
       SET deleted_at = NOW(), updated_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE origin_key = $2 AND deleted_at IS NULL
       RETURNING *`,
      [deletedBy, originKey]
    );

    return result.rowCount > 0;
  }

  async recordAudit(auditData, client = null) {
    const {
      origin_id,
      action,
      actor_type,
      actor_id = null,
      snapshot,
      trace_id = null,
      notes = null
    } = auditData;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO origin_audit_log (
        origin_id, action, actor_type, actor_id, snapshot, trace_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [origin_id, action, actor_type, actor_id, JSON.stringify(snapshot), trace_id, notes]
    );

    return result.rows[0];
  }

  async listAuditLog(originId, filter = {}, client = null) {
    if (!originId) return [];

    const { action, limit } = filter;
    const conditions = ['origin_id = $1'];
    const params = [originId];
    let paramIndex = 2;

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = limit ? `LIMIT ${parseInt(limit)}` : '';

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM origin_audit_log
       ${whereClause}
       ORDER BY at DESC
       ${limitClause}`,
      params
    );

    return result.rows || [];
  }
}

export function getDefaultOriginRepo() {
  if (!defaultRepo) {
    defaultRepo = new OriginRepoPg();
  }
  return defaultRepo;
}
