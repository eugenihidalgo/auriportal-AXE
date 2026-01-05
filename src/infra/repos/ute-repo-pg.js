// src/infra/repos/ute-repo-pg.js
// Implementación PostgreSQL del Repositorio de UTE (Definitions y Assignments)

import { query } from '../../../database/pg.js';
import { UteRepo } from '../../core/repos/ute-repo.js';

let defaultRepo = null;

export class UteRepoPg extends UteRepo {
  async createDefinition(definitionData, client = null) {
    const {
      ute_key,
      name,
      description = null,
      mode,
      threshold_days = null,
      critical_multiplier = 2.0,
      required_count = null,
      metadata = {},
      status = 'active',
      created_by = null
    } = definitionData;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO ute_definitions (
        ute_key, name, description, mode, threshold_days, critical_multiplier,
        required_count, metadata, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [ute_key, name, description, mode, threshold_days, critical_multiplier,
       required_count, JSON.stringify(metadata), status, created_by]
    );

    return result.rows[0];
  }

  async getDefinitionById(uteId, client = null) {
    if (!uteId) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM ute_definitions WHERE id = $1 AND deleted_at IS NULL',
      [uteId]
    );

    return result.rows[0] || null;
  }

  async getDefinitionByKey(uteKey, client = null) {
    if (!uteKey) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM ute_definitions WHERE ute_key = $1 AND deleted_at IS NULL',
      [uteKey]
    );

    return result.rows[0] || null;
  }

  async listDefinitions(filter = {}, client = null) {
    const { status, mode, includeDeleted = false } = filter;
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

    if (mode) {
      conditions.push(`mode = $${paramIndex++}`);
      params.push(mode);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ute_definitions ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return result.rows || [];
  }

  async updateDefinition(uteId, updateData, client = null) {
    if (!uteId) return null;

    const allowedFields = ['name', 'description', 'mode', 'threshold_days', 'critical_multiplier',
                          'required_count', 'metadata', 'status'];
    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        if (field === 'metadata') {
          params.push(JSON.stringify(updateData[field]));
        } else {
          params.push(updateData[field]);
        }
      }
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(uteId);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE ute_definitions 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  async createAssignment(assignmentData, client = null) {
    const {
      ute_id,
      target_type,
      target_ref = null,
      metadata = {},
      status = 'active',
      assigned_by = null
    } = assignmentData;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `INSERT INTO ute_assignments (
        ute_id, target_type, target_ref, metadata, status, assigned_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [ute_id, target_type, target_ref, JSON.stringify(metadata), status, assigned_by]
    );

    return result.rows[0];
  }

  async listAssignments(uteId, filter = {}, client = null) {
    if (!uteId) return [];

    const { status, includeDeleted = false } = filter;
    const conditions = ['ute_id = $1'];
    const params = [uteId];
    let paramIndex = 2;

    if (!includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ute_assignments 
       WHERE ${conditions.join(' AND ')} 
       ORDER BY created_at DESC`,
      params
    );

    return result.rows || [];
  }

  async listAssignmentsByTarget(targetType, targetRef = null, filter = {}, client = null) {
    const conditions = ['target_type = $1'];
    const params = [targetType];
    let paramIndex = 2;

    if (targetType === 'all') {
      conditions.push('target_ref IS NULL');
    } else if (targetRef) {
      conditions.push(`target_ref = $${paramIndex++}`);
      params.push(targetRef);
    }

    const { status, includeDeleted = false } = filter;
    if (!includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }
    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `SELECT * FROM ute_assignments 
       WHERE ${conditions.join(' AND ')} 
       ORDER BY created_at DESC`,
      params
    );

    return result.rows || [];
  }
}

export function getDefaultUteRepo() {
  if (!defaultRepo) {
    defaultRepo = new UteRepoPg();
  }
  return defaultRepo;
}
