// src/infra/repos/automation-audit-repo-pg.js
// Implementación PostgreSQL del Repositorio de Auditoría de Automatizaciones

import { query } from '../../../database/pg.js';
import { AutomationAuditRepo } from '../../core/repos/automation-audit-repo.js';

/**
 * Repositorio de Auditoría de Automatizaciones - Implementación PostgreSQL
 */
export class AutomationAuditRepoPg extends AutomationAuditRepo {
  /**
   * Añade una entrada al log de auditoría (append-only)
   */
  async append(data, client = null) {
    const {
      automation_key,
      action,
      actor_admin_id = null,
      before = null,
      after = null
    } = data;

    if (!automation_key || !action) {
      throw new Error('automation_key y action son obligatorios');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const sql = `
      INSERT INTO pde_automation_audit_log (
        automation_key,
        action,
        actor_admin_id,
        before,
        after
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      RETURNING *
    `;

    const params = [
      automation_key,
      action,
      actor_admin_id,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ];

    const result = await queryFn(sql, params);
    const row = result.rows[0];
    return {
      ...row,
      before: row.before && typeof row.before === 'string' ? JSON.parse(row.before) : row.before,
      after: row.after && typeof row.after === 'string' ? JSON.parse(row.after) : row.after
    };
  }
}

// Instancia singleton
let auditRepoInstance = null;

/**
 * Obtiene la instancia singleton del repositorio de auditoría
 */
export function getDefaultAutomationAuditRepo() {
  if (!auditRepoInstance) {
    auditRepoInstance = new AutomationAuditRepoPg();
  }
  return auditRepoInstance;
}



