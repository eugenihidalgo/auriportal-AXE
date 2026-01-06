// src/infra/repos/sponsors/sponsor-links-repo-pg.js
// Implementación PostgreSQL del Repositorio de Vínculos Sponsor-Student

import { query } from '../../../../database/pg.js';

export class SponsorLinksRepoPg {
  async link(sponsorId, studentId, client = null) {
    if (!sponsorId || !studentId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    
    // Verificar si ya existe un vínculo activo
    const existing = await queryFn(`
      SELECT id FROM sponsor_student_links
      WHERE sponsor_id = $1 AND student_id = $2 AND deleted_at IS NULL
    `, [sponsorId, studentId]);
    
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
    
    // Si existe uno borrado, restaurarlo
    const deleted = await queryFn(`
      SELECT id FROM sponsor_student_links
      WHERE sponsor_id = $1 AND student_id = $2 AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
      LIMIT 1
    `, [sponsorId, studentId]);
    
    if (deleted.rows.length > 0) {
      const result = await queryFn(`
        UPDATE sponsor_student_links
        SET deleted_at = NULL
        WHERE id = $1
        RETURNING *
      `, [deleted.rows[0].id]);
      return result.rows[0];
    }
    
    // Crear nuevo vínculo
    const result = await queryFn(`
      INSERT INTO sponsor_student_links (sponsor_id, student_id, role)
      VALUES ($1, $2, 'padrino')
      RETURNING *
    `, [sponsorId, studentId]);
    
    return result.rows[0];
  }

  async unlink(sponsorId, studentId, client = null) {
    if (!sponsorId || !studentId) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE sponsor_student_links
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE sponsor_id = $1 AND student_id = $2 AND deleted_at IS NULL
      RETURNING *
    `, [sponsorId, studentId]);
    
    return result.rows[0] || null;
  }

  async listBySponsor(sponsorId, client = null) {
    if (!sponsorId) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT ssl.*, a.id as student_id, a.email, a.apodo, a.nombre_completo
      FROM sponsor_student_links ssl
      JOIN alumnos a ON ssl.student_id = a.id
      WHERE ssl.sponsor_id = $1 AND ssl.deleted_at IS NULL
      ORDER BY a.apodo ASC, a.email ASC
    `, [sponsorId]);
    
    return result.rows || [];
  }

  async listByStudent(studentId, client = null) {
    if (!studentId) return [];
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT ssl.*, sc.id as sponsor_id, sc.display_name, sc.description, sc.status
      FROM sponsor_student_links ssl
      JOIN sponsors_catalog sc ON ssl.sponsor_id = sc.id
      WHERE ssl.student_id = $1 AND ssl.deleted_at IS NULL AND sc.deleted_at IS NULL
      ORDER BY sc.display_name ASC
    `, [studentId]);
    
    return result.rows || [];
  }

  async unlinkAllForStudent(studentId, client = null) {
    if (!studentId) return 0;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      UPDATE sponsor_student_links
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE student_id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [studentId]);
    
    return result.rows.length;
  }

  async countActiveLinks(sponsorId, client = null) {
    if (!sponsorId) return 0;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      SELECT COUNT(*) as count
      FROM sponsor_student_links
      WHERE sponsor_id = $1 AND deleted_at IS NULL
    `, [sponsorId]);
    
    return parseInt(result.rows[0]?.count || 0, 10);
  }
}

let defaultRepo = null;

export function getDefaultSponsorLinksRepo() {
  if (!defaultRepo) {
    defaultRepo = new SponsorLinksRepoPg();
  }
  return defaultRepo;
}
