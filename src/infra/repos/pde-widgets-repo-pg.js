// src/infra/repos/pde-widgets-repo-pg.js
// Repositorio PostgreSQL para Widgets PDE con versionado completo

import { query } from '../../../database/pg.js';

/**
 * Repositorio para gestionar widgets PDE con versionado (draft/published)
 */
export class PdeWidgetsRepo {
  /**
   * Lista todos los widgets (activos por defecto, excluyendo eliminados)
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} [options.onlyPublished=true] - Si filtrar solo publicados
   * @param {boolean} [options.includeDeleted=false] - Si incluir eliminados
   * @returns {Promise<Array>} Array de widgets
   */
  async listWidgets(options = {}) {
    const {
      onlyPublished = true,
      includeDeleted = false
    } = options;

    let sql = `
      SELECT 
        w.id,
        w.widget_key,
        w.name,
        w.description,
        w.status,
        w.current_draft_id,
        w.current_published_version,
        w.created_at,
        w.updated_at,
        w.deleted_at
      FROM pde_widgets w
      WHERE 1=1
    `;

    const params = [];

    if (!includeDeleted) {
      sql += ` AND w.deleted_at IS NULL`;
    }

    if (onlyPublished) {
      sql += ` AND w.status = 'published'`;
    }

    sql += ` ORDER BY w.created_at DESC`;

    const result = await query(sql, params);
    return result.rows.map(row => ({
      ...row,
      definition: typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
    }));
  }

  /**
   * Obtiene un widget por widget_key
   */
  async getWidgetByKey(widgetKey, includeDeleted = false) {
    if (!widgetKey) return null;

    let sql = `
      SELECT 
        w.id,
        w.widget_key,
        w.name,
        w.description,
        w.status,
        w.current_draft_id,
        w.current_published_version,
        w.created_at,
        w.updated_at,
        w.deleted_at
      FROM pde_widgets w
      WHERE w.widget_key = $1
    `;

    const params = [widgetKey];

    if (!includeDeleted) {
      sql += ` AND w.deleted_at IS NULL`;
    }

    const result = await query(sql, params);
    if (!result.rows[0]) return null;

    return result.rows[0];
  }

  /**
   * Obtiene un widget por ID
   */
  async getWidgetById(id, includeDeleted = false) {
    if (!id) return null;

    let sql = `
      SELECT 
        w.id,
        w.widget_key,
        w.name,
        w.description,
        w.status,
        w.current_draft_id,
        w.current_published_version,
        w.created_at,
        w.updated_at,
        w.deleted_at
      FROM pde_widgets w
      WHERE w.id = $1
    `;

    const params = [id];

    if (!includeDeleted) {
      sql += ` AND w.deleted_at IS NULL`;
    }

    const result = await query(sql, params);
    if (!result.rows[0]) return null;

    return result.rows[0];
  }

  /**
   * Crea un nuevo widget
   */
  async createWidget(widgetData, updatedBy = null) {
    const {
      widget_key,
      name,
      description = null,
      status = 'draft'
    } = widgetData;

    const result = await query(`
      INSERT INTO pde_widgets (widget_key, name, description, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [widget_key, name, description, status]);

    const widget = result.rows[0];

    // Log de auditoría
    await this.logAudit(widget.id, 'create', updatedBy, null, {
      widget_key,
      name,
      description,
      status
    });

    return widget;
  }

  /**
   * Actualiza un widget
   */
  async updateWidget(id, updates, updatedBy = null) {
    const before = await this.getWidgetById(id, true);
    if (!before) return null;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const sql = `
      UPDATE pde_widgets
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(sql, values);
    if (!result.rows[0]) return null;

    const after = result.rows[0];

    // Log de auditoría
    await this.logAudit(id, 'update', updatedBy, before, after);

    return after;
  }

  /**
   * Elimina un widget (soft delete)
   */
  async deleteWidget(id, updatedBy = null) {
    const before = await this.getWidgetById(id, true);
    if (!before) return null;

    const result = await query(`
      UPDATE pde_widgets
      SET deleted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (!result.rows[0]) return null;

    // Log de auditoría
    await this.logAudit(id, 'delete', updatedBy, before, null);

    return result.rows[0];
  }

  // ============================================================================
  // DRAFTS
  // ============================================================================

  /**
   * Obtiene el draft actual de un widget
   */
  async getCurrentDraft(widgetId) {
    if (!widgetId) return null;

    const result = await query(`
      SELECT d.*
      FROM pde_widget_drafts d
      JOIN pde_widgets w ON w.current_draft_id = d.draft_id
      WHERE w.id = $1
    `, [widgetId]);

    if (!result.rows[0]) return null;

    const draft = result.rows[0];
    if (typeof draft.prompt_context_json === 'string') {
      draft.prompt_context_json = JSON.parse(draft.prompt_context_json);
    }

    return draft;
  }

  /**
   * Crea o actualiza el draft de un widget
   */
  async saveDraft(widgetId, draftData, updatedBy = null) {
    const {
      prompt_context_json,
      code = null,
      validation_status = 'pending',
      validation_errors = [],
      validation_warnings = []
    } = draftData;

    // Verificar si ya existe un draft actual
    const widget = await this.getWidgetById(widgetId);
    if (!widget) {
      throw new Error(`Widget con id ${widgetId} no existe`);
    }

    let draft;
    if (widget.current_draft_id) {
      // Actualizar draft existente
      const result = await query(`
        UPDATE pde_widget_drafts
        SET prompt_context_json = $1,
            code = $2,
            validation_status = $3,
            validation_errors = $4,
            validation_warnings = $5,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $6
        WHERE draft_id = $7
        RETURNING *
      `, [
        JSON.stringify(prompt_context_json),
        code,
        validation_status,
        JSON.stringify(validation_errors),
        JSON.stringify(validation_warnings),
        updatedBy,
        widget.current_draft_id
      ]);

      draft = result.rows[0];
    } else {
      // Crear nuevo draft
      const result = await query(`
        INSERT INTO pde_widget_drafts (
          widget_id, prompt_context_json, code, validation_status,
          validation_errors, validation_warnings, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        widgetId,
        JSON.stringify(prompt_context_json),
        code,
        validation_status,
        JSON.stringify(validation_errors),
        JSON.stringify(validation_warnings),
        updatedBy
      ]);

      draft = result.rows[0];

      // Actualizar widget con current_draft_id
      await query(`
        UPDATE pde_widgets
        SET current_draft_id = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [draft.draft_id, widgetId]);
    }

    if (typeof draft.prompt_context_json === 'string') {
      draft.prompt_context_json = JSON.parse(draft.prompt_context_json);
    }

    // Log de auditoría
    await this.logAudit(widgetId, 'update', updatedBy, null, {
      draft_id: draft.draft_id,
      action: 'draft_saved'
    }, { draft_id: draft.draft_id });

    return draft;
  }

  // ============================================================================
  // VERSIONS
  // ============================================================================

  /**
   * Publica un draft (crea una nueva versión publicada)
   */
  async publishDraft(widgetId, publishedBy = null) {
    const widget = await this.getWidgetById(widgetId);
    if (!widget) {
      throw new Error(`Widget con id ${widgetId} no existe`);
    }

    if (!widget.current_draft_id) {
      throw new Error(`Widget no tiene draft para publicar`);
    }

    const draft = await query(`
      SELECT * FROM pde_widget_drafts
      WHERE draft_id = $1
    `, [widget.current_draft_id]);

    if (!draft.rows[0]) {
      throw new Error(`Draft no existe`);
    }

    const draftData = draft.rows[0];
    if (typeof draftData.prompt_context_json === 'string') {
      draftData.prompt_context_json = JSON.parse(draftData.prompt_context_json);
    }

    // Obtener el siguiente número de versión
    const nextVersion = widget.current_published_version 
      ? widget.current_published_version + 1 
      : 1;

    // Crear versión publicada
    const versionResult = await query(`
      INSERT INTO pde_widget_versions (
        widget_id, version, prompt_context_json, code, published_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      widgetId,
      nextVersion,
      JSON.stringify(draftData.prompt_context_json),
      draftData.code || '',
      publishedBy
    ]);

    const version = versionResult.rows[0];

    // Actualizar widget
    await query(`
      UPDATE pde_widgets
      SET current_published_version = $1,
          status = 'published',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [nextVersion, widgetId]);

    // Log de auditoría
    await this.logAudit(widgetId, 'publish', publishedBy, {
      current_version: widget.current_published_version
    }, {
      current_version: nextVersion,
      version_id: version.version_id
    }, { version: nextVersion, version_id: version.version_id });

    return version;
  }

  /**
   * Obtiene la versión publicada más reciente de un widget
   */
  async getLatestPublishedVersion(widgetId) {
    if (!widgetId) return null;

    const result = await query(`
      SELECT v.*
      FROM pde_widget_versions v
      JOIN pde_widgets w ON w.id = v.widget_id
      WHERE v.widget_id = $1
        AND v.version = w.current_published_version
        AND v.status = 'published'
      ORDER BY v.version DESC
      LIMIT 1
    `, [widgetId]);

    if (!result.rows[0]) return null;

    const version = result.rows[0];
    if (typeof version.prompt_context_json === 'string') {
      version.prompt_context_json = JSON.parse(version.prompt_context_json);
    }

    return version;
  }

  /**
   * Obtiene todas las versiones publicadas de un widget
   */
  async listPublishedVersions(widgetId) {
    if (!widgetId) return [];

    const result = await query(`
      SELECT *
      FROM pde_widget_versions
      WHERE widget_id = $1
      ORDER BY version DESC
    `, [widgetId]);

    return result.rows.map(row => {
      if (typeof row.prompt_context_json === 'string') {
        row.prompt_context_json = JSON.parse(row.prompt_context_json);
      }
      return row;
    });
  }

  // ============================================================================
  // AUDIT LOG
  // ============================================================================

  /**
   * Registra una acción en el log de auditoría
   */
  async logAudit(widgetId, action, actorAdminId = null, before = null, after = null, metadata = {}) {
    await query(`
      INSERT INTO pde_widget_audit_log (
        widget_id, action, actor_admin_id, before, after, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      widgetId,
      action,
      actorAdminId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      JSON.stringify(metadata)
    ]);
  }

  /**
   * Obtiene el log de auditoría de un widget
   */
  async getAuditLog(widgetId, limit = 50) {
    const result = await query(`
      SELECT *
      FROM pde_widget_audit_log
      WHERE widget_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [widgetId, limit]);

    return result.rows.map(row => {
      if (row.before && typeof row.before === 'string') {
        row.before = JSON.parse(row.before);
      }
      if (row.after && typeof row.after === 'string') {
        row.after = JSON.parse(row.after);
      }
      if (row.metadata && typeof row.metadata === 'string') {
        row.metadata = JSON.parse(row.metadata);
      }
      return row;
    });
  }
}

// Instancia singleton
let widgetsRepoInstance = null;

/**
 * Obtiene la instancia singleton del repositorio de widgets
 */
export function getDefaultPdeWidgetsRepo() {
  if (!widgetsRepoInstance) {
    widgetsRepoInstance = new PdeWidgetsRepo();
  }
  return widgetsRepoInstance;
}

