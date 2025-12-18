// src/endpoints/admin-screen-templates-api.js
// API REST para gestionar Screen Templates
// Protegido por requireAdminAuth
//
// SPRINT AXE v0.5 - Screen Templates v1

import { requireAdminAuth } from '../modules/admin-auth.js';
import { getDefaultScreenTemplateDraftRepo } from '../infra/repos/screen-template-draft-repo-pg.js';
import { getDefaultScreenTemplateVersionRepo } from '../infra/repos/screen-template-version-repo-pg.js';
import { getDefaultScreenTemplateAuditRepo } from '../infra/repos/screen-template-audit-repo-pg.js';
import { query, getPool } from '../../database/pg.js';
import { 
  validateScreenTemplateDefinition, 
  validateScreenTemplateDefinitionDraft,
  normalizeScreenTemplateDefinition 
} from '../core/screen-template/screen-template-definition-contract.js';
import { renderScreenTemplatePreview } from '../core/screen-template/screen-template-renderer.js';
import { getSafePreviewContext } from '../core/preview/preview-context.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';

/**
 * Lista todos los screen templates
 */
async function listTemplates(request, env) {
  try {
    const result = await query(`
      SELECT 
        st.id,
        st.name,
        st.status,
        st.current_draft_id,
        st.current_published_version,
        st.created_at,
        st.updated_at
      FROM screen_templates st
      ORDER BY st.updated_at DESC
    `);

    return new Response(JSON.stringify({
      success: true,
      templates: result.rows
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('AdminScreenTemplatesAPI', 'Error listando templates', { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene el draft actual de un template
 */
async function getDraft(request, env, templateId) {
  try {
    const draftRepo = getDefaultScreenTemplateDraftRepo();
    const draft = await draftRepo.getCurrentDraft(templateId);

    if (!draft) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Draft no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      draft
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('AdminScreenTemplatesAPI', 'Error obteniendo draft', { templateId, error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Crea o actualiza un draft
 */
async function saveDraft(request, env, templateId = null) {
  try {
    const body = await request.json();
    const definition = body.definition;

    if (!definition) {
      return new Response(JSON.stringify({
        success: false,
        error: 'definition es requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Normalizar definición
    const normalized = normalizeScreenTemplateDefinition(definition);
    if (!normalized) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Definición inválida: faltan campos requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const finalTemplateId = templateId || normalized.id;
    if (!finalTemplateId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID del template es requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar draft (tolerante)
    const validation = validateScreenTemplateDefinitionDraft(normalized);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Errores de validación',
        errors: validation.errors,
        warnings: validation.warnings
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const draftRepo = getDefaultScreenTemplateDraftRepo();
    const auditRepo = getDefaultScreenTemplateAuditRepo();

    // Usar transacción
    const pool = getPool();
    const client = await pool.connect();
    await client.query('BEGIN');

    try {
      // Crear o actualizar template principal
      await client.query(`
        INSERT INTO screen_templates (id, name, status, updated_at)
        VALUES ($1, $2, 'draft', CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE 
        SET name = $2, updated_at = CURRENT_TIMESTAMP
      `, [finalTemplateId, normalized.name]);

      // Obtener draft actual
      const currentDraft = await draftRepo.getCurrentDraft(finalTemplateId, client);

      let draft;
      if (currentDraft) {
        // Actualizar draft existente
        draft = await draftRepo.updateDraft(
          currentDraft.draft_id,
          normalized,
          null, // updated_by (puede extraerse de auth si está disponible)
          client
        );
      } else {
        // Crear nuevo draft
        draft = await draftRepo.createDraft(
          finalTemplateId,
          normalized,
          null, // updated_by
          client
        );
      }

      // Actualizar current_draft_id en screen_templates
      await client.query(`
        UPDATE screen_templates
        SET current_draft_id = $1
        WHERE id = $2
      `, [draft.draft_id, finalTemplateId]);

      // Registrar auditoría
      await auditRepo.append(
        finalTemplateId,
        draft.draft_id,
        currentDraft ? 'update_draft' : 'create_template',
        {
          validation: {
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings
          }
        },
        null, // created_by
        client
      );

      await client.query('COMMIT');

      logInfo('AdminScreenTemplatesAPI', 'Draft guardado', { templateId: finalTemplateId, draft_id: draft.draft_id });

      return new Response(JSON.stringify({
        success: true,
        template_id: finalTemplateId,
        draft_id: draft.draft_id,
        warnings: validation.warnings
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('AdminScreenTemplatesAPI', 'Error guardando draft', { templateId, error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Publica una versión del template
 */
async function publishVersion(request, env, templateId) {
  try {
    const body = await request.json();
    const definition = body.definition;

    if (!definition) {
      return new Response(JSON.stringify({
        success: false,
        error: 'definition es requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Normalizar definición
    const normalized = normalizeScreenTemplateDefinition(definition);
    if (!normalized) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Definición inválida: faltan campos requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar ESTRICTA para publish
    const validation = validateScreenTemplateDefinition(normalized);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Errores de validación (no se puede publicar)',
        errors: validation.errors,
        warnings: validation.warnings
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const versionRepo = getDefaultScreenTemplateVersionRepo();
    const auditRepo = getDefaultScreenTemplateAuditRepo();

    // Usar transacción
    const pool = getPool();
    const client = await pool.connect();
    await client.query('BEGIN');

    try {
      // Obtener última versión
      const latestVersion = await versionRepo.getLatestVersion(templateId, client);
      const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

      // Crear versión publicada
      const version = await versionRepo.createVersion(
        templateId,
        nextVersion,
        normalized,
        body.release_notes || null,
        null, // created_by
        client
      );

      // Actualizar screen_templates
      await client.query(`
        UPDATE screen_templates
        SET current_published_version = $1,
            status = 'published',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [nextVersion, templateId]);

      // Registrar auditoría
      await auditRepo.append(
        templateId,
        null,
        'publish_version',
        {
          version: nextVersion,
          errors_count: validation.errors.length,
          warnings_count: validation.warnings.length
        },
        null, // created_by
        client
      );

      await client.query('COMMIT');

      logInfo('AdminScreenTemplatesAPI', 'Versión publicada', { templateId, version: nextVersion });

      return new Response(JSON.stringify({
        success: true,
        version: nextVersion,
        warnings: validation.warnings
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('AdminScreenTemplatesAPI', 'Error publicando versión', { templateId, error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Valida una definición
 */
async function validateDefinition(request, env) {
  try {
    const body = await request.json();
    const definition = body.definition;

    if (!definition) {
      return new Response(JSON.stringify({
        success: false,
        error: 'definition es requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const validation = validateScreenTemplateDefinition(definition);

    return new Response(JSON.stringify({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('AdminScreenTemplatesAPI', 'Error validando definición', { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Preview de un template
 */
async function previewTemplate(request, env) {
  try {
    const body = await request.json();
    const { screen_template_id, props = {}, definition } = body;

    // Si se proporciona definition, usar esa (para preview de draft)
    // Si no, cargar desde BD
    let html;
    
    if (definition) {
      // Preview de draft: renderizar directamente
      // Por ahora, si tiene html_template, usarlo
      if (definition.html_template) {
        html = definition.html_template;
        // Reemplazar placeholders
        for (const [key, value] of Object.entries(props)) {
          html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
        }
      } else {
        html = `<html><body><p>Template sin html_template definido</p></body></html>`;
      }
    } else {
      // Preview de versión publicada
      html = await renderScreenTemplatePreview(
        screen_template_id,
        props,
        getSafePreviewContext(),
        null // theme_id
      );
    }

    // Aplicar tema (usando Preview Harness)
    const { applyTheme } = await import('../core/responses.js');
    html = applyTheme(html, null, null);

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    logError('AdminScreenTemplatesAPI', 'Error en preview', { error: error.message });
    return new Response(`<html><body><p style="color: red;">Error en preview: ${error.message}</p></body></html>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
}

/**
 * Obtiene el log de auditoría
 */
async function getAuditLog(request, env, templateId) {
  try {
    const auditRepo = getDefaultScreenTemplateAuditRepo();
    const logs = await auditRepo.listByTemplate(templateId, 100);

    return new Response(JSON.stringify({
      success: true,
      logs
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError('AdminScreenTemplatesAPI', 'Error obteniendo audit log', { templateId, error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handler principal de la API
 */
export default async function adminScreenTemplatesAPIHandler(request, env, ctx) {
  // Verificar autenticación
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    return new Response(JSON.stringify({
      success: false,
      error: 'No autorizado'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // GET /api/admin/screen-templates - Listar
  if (path === '/api/admin/screen-templates' && method === 'GET') {
    return listTemplates(request, env);
  }

  // POST /api/admin/screen-templates - Crear nuevo
  if (path === '/api/admin/screen-templates' && method === 'POST') {
    return saveDraft(request, env);
  }

  // GET /api/admin/screen-templates/:id/draft - Obtener draft
  const draftMatch = path.match(/^\/api\/admin\/screen-templates\/([^\/]+)\/draft$/);
  if (draftMatch && method === 'GET') {
    return getDraft(request, env, draftMatch[1]);
  }

  // PUT /api/admin/screen-templates/:id/draft - Actualizar draft
  if (draftMatch && method === 'PUT') {
    return saveDraft(request, env, draftMatch[1]);
  }

  // POST /api/admin/screen-templates/:id/publish - Publicar versión
  const publishMatch = path.match(/^\/api\/admin\/screen-templates\/([^\/]+)\/publish$/);
  if (publishMatch && method === 'POST') {
    return publishVersion(request, env, publishMatch[1]);
  }

  // POST /api/admin/screen-templates/validate - Validar definición
  if (path === '/api/admin/screen-templates/validate' && method === 'POST') {
    return validateDefinition(request, env);
  }

  // POST /api/admin/screen-templates/preview - Preview
  if (path === '/api/admin/screen-templates/preview' && method === 'POST') {
    return previewTemplate(request, env);
  }

  // GET /api/admin/screen-templates/:id/audit - Auditoría
  const auditMatch = path.match(/^\/api\/admin\/screen-templates\/([^\/]+)\/audit$/);
  if (auditMatch && method === 'GET') {
    return getAuditLog(request, env, auditMatch[1]);
  }

  // 404
  return new Response(JSON.stringify({
    success: false,
    error: 'Endpoint no encontrado'
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

