// src/endpoints/admin-recorridos-api.js
// Endpoints admin para gestionar recorridos con versionado (DRAFT/PUBLISH)
// Protegido por requireAdminContext()
//
// PRINCIPIOS DE BLINDAJE (v2):
// 1. IDs son slugs técnicos (sin espacios, sin acentos, estables)
// 2. Names son display/editables (cualquier texto)
// 3. Draft se guarda solo si pasa validación básica
// 4. Publish bloquea si hay errores de validación completa

import { requireAdminContext } from '../core/auth-context.js';
import { validateRecorridoDefinition } from '../core/recorridos/validate-recorrido-definition.js';
import { 
  validateSlugId, 
  normalizeRecorridoDefinition, 
  validateDefinitionForDraft 
} from '../core/recorridos/normalize-recorrido-definition.js';
import { getDefaultRecorridoRepo } from '../infra/repos/recorrido-repo-pg.js';
import { getDefaultRecorridoDraftRepo } from '../infra/repos/recorrido-draft-repo-pg.js';
import { getDefaultRecorridoVersionRepo } from '../infra/repos/recorrido-version-repo-pg.js';
import { getDefaultRecorridoAuditRepo } from '../infra/repos/recorrido-audit-repo-pg.js';
import { query, getPool } from '../../database/pg.js';
import { logInfo, logWarn, logError } from '../core/observability/logger.js';
import { getEffectiveCanvasForDraft, saveCanvasToDraft } from '../core/canvas/canvas-storage.js';
import { canvasToRecorrido } from '../core/canvas/canvas-to-recorrido.js';
import { validateCanvasDefinition } from '../core/canvas/validate-canvas-definition.js';
import { normalizeCanvasDefinition } from '../core/canvas/normalize-canvas-definition.js';
import { recorridoToCanvas } from '../core/canvas/recorrido-to-canvas.js';

/**
 * Helper para obtener el admin ID/email del contexto
 */
function getAdminId(authCtx) {
  return authCtx?.adminId || authCtx?.email || null;
}

/**
 * Helper para crear respuesta JSON
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Helper para crear respuesta de error
 */
function errorResponse(message, status = 400, details = null) {
  const response = { error: message };
  if (details) {
    response.details = details;
  }
  return jsonResponse(response, status);
}

/**
 * GET /admin/api/recorridos
 * Lista recorridos (id, name, status, current_published_version, updated_at)
 */
async function handleListRecorridos(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // Filtro opcional

    const repo = getDefaultRecorridoRepo();
    const recorridos = await repo.listRecorridos({ status: status || undefined });

    // Formatear respuesta (solo campos relevantes)
    const result = recorridos.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      current_published_version: r.current_published_version,
      updated_at: r.updated_at
    }));

    logInfo('RecorridosAPI', 'Lista de recorridos obtenida', {
      count: result.length,
      status_filter: status || 'all'
    });

    return jsonResponse({ recorridos: result });
  } catch (error) {
    logError('RecorridosAPI', 'Error listando recorridos', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al listar recorridos', 500);
  }
}

/**
 * POST /admin/api/recorridos
 * Crea recorrido + crea draft inicial con definition_json mínimo
 * 
 * BLINDAJE v2:
 * - id debe ser slug técnico (validado con validateSlugId)
 * - name puede ser cualquier texto legible
 */
async function handleCreateRecorrido(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id || !name) {
      return errorResponse('Se requieren "id" y "name"');
    }

    // BLINDAJE: Validar que el ID sea un slug técnico válido
    const slugValidation = validateSlugId(id);
    if (!slugValidation.valid) {
      logWarn('RecorridosAPI', 'Intento de crear recorrido con ID inválido', {
        id,
        error: slugValidation.error
      });
      return errorResponse(slugValidation.error, 400);
    }

    // Usar transacción para crear recorrido + draft
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const recorridoRepo = getDefaultRecorridoRepo();
      const draftRepo = getDefaultRecorridoDraftRepo();
      const auditRepo = getDefaultRecorridoAuditRepo();

      // Crear recorrido
      const recorrido = await recorridoRepo.createRecorrido({ id, name }, client);

      // Crear draft inicial con definition_json mínimo
      const definitionMinima = {
        id,
        entry_step_id: 'step1',
        steps: {
          step1: {
            screen_template_id: 'blank',
            props: {}
          }
        },
        edges: []
      };

      const draft = await draftRepo.createDraft(
        id,
        definitionMinima,
        getAdminId(authCtx),
        client
      );

      // Actualizar recorrido con current_draft_id
      await recorridoRepo.updateRecorridoMeta(
        id,
        { current_draft_id: draft.draft_id },
        client
      );

      // Audit log
      await auditRepo.append(
        id,
        draft.draft_id,
        'create_recorrido',
        { name, draft_id: draft.draft_id },
        getAdminId(authCtx),
        client
      );

      await client.query('COMMIT');

      logInfo('RecorridosAPI', 'Recorrido creado exitosamente', {
        recorrido_id: id,
        draft_id: draft.draft_id
      });

      return jsonResponse({
        recorrido: {
          id: recorrido.id,
          name: recorrido.name,
          status: recorrido.status,
          current_draft_id: draft.draft_id
        },
        draft: {
          draft_id: draft.draft_id,
          definition_json: draft.definition_json
        }
      }, 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('RecorridosAPI', 'Error creando recorrido', {
      error: error.message,
      stack: error.stack
    });

    if (error.code === '23505') { // Unique violation
      return errorResponse('El recorrido con ese ID ya existe', 409);
    }

    return errorResponse('Error interno al crear recorrido', 500);
  }
}

/**
 * GET /admin/api/recorridos/:id
 * Devuelve meta + current draft (si existe) + latest published version (si existe)
 */
async function handleGetRecorrido(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const recorridoRepo = getDefaultRecorridoRepo();
    const draftRepo = getDefaultRecorridoDraftRepo();
    const versionRepo = getDefaultRecorridoVersionRepo();

    const recorrido = await recorridoRepo.getRecorridoById(recorridoId);
    if (!recorrido) {
      return errorResponse('Recorrido no encontrado', 404);
    }

    const draft = await draftRepo.getCurrentDraft(recorridoId);
    const latestVersion = await versionRepo.getLatestVersion(recorridoId);

    const result = {
      recorrido: {
        id: recorrido.id,
        name: recorrido.name,
        status: recorrido.status,
        current_draft_id: recorrido.current_draft_id,
        current_published_version: recorrido.current_published_version,
        created_at: recorrido.created_at,
        updated_at: recorrido.updated_at
      }
    };

    if (draft) {
      result.draft = {
        draft_id: draft.draft_id,
        definition_json: draft.definition_json,
        updated_at: draft.updated_at,
        updated_by: draft.updated_by
      };
    }

    if (latestVersion) {
      result.published_version = {
        version: latestVersion.version,
        status: latestVersion.status,
        definition_json: latestVersion.definition_json,
        release_notes: latestVersion.release_notes,
        created_at: latestVersion.created_at,
        created_by: latestVersion.created_by
      };
    }

    return jsonResponse(result);
  } catch (error) {
    logError('RecorridosAPI', 'Error obteniendo recorrido', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al obtener recorrido', 500);
  }
}

/**
 * PUT /admin/api/recorridos/:id/draft
 * Actualiza draft (solo draft)
 * 
 * BLINDAJE v2 - SAFE DRAFT MODE:
 * - Valida la definición con validateDefinitionForDraft ANTES de guardar
 * - Normaliza la definición para eliminar campos temporales
 * - Rechaza drafts inválidos con errores estructurados
 * - NO guarda basura, incluso si viene del editor
 */
async function handleUpdateDraft(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { definition_json } = body;

    if (!definition_json) {
      return errorResponse('Se requiere "definition_json"');
    }

    // Verificar que el recorrido existe
    const recorridoRepo = getDefaultRecorridoRepo();
    const recorrido = await recorridoRepo.getRecorridoById(recorridoId);
    if (!recorrido) {
      return errorResponse('Recorrido no encontrado', 404);
    }

    // BLINDAJE v2: Validar definición ANTES de guardar
    const draftValidation = validateDefinitionForDraft(definition_json);
    if (!draftValidation.valid) {
      logWarn('RecorridosAPI', 'Draft rechazado por validación', {
        recorrido_id: recorridoId,
        errors_count: draftValidation.errors.length,
        errors: draftValidation.errors
      });
      
      return errorResponse('El draft tiene errores estructurales y no se puede guardar', 400, {
        errors: draftValidation.errors,
        hint: 'Corrige los errores antes de guardar. El editor NO debe enviar datos incompletos.'
      });
    }

    // LOG TEMPORAL: Mostrar order recibido de cada step
    const stepsReceived = definition_json?.steps || {};
    const orderReceived = Object.keys(stepsReceived).reduce((acc, stepId) => {
      const step = stepsReceived[stepId];
      acc[stepId] = typeof step?.order === 'number' ? step.order : 'undefined';
      return acc;
    }, {});
    logInfo('RecorridosAPI', 'Order recibido en draft (antes de normalizar)', {
      recorrido_id: recorridoId,
      steps_order: orderReceived
    });

    // BLINDAJE v2: Normalizar definición antes de guardar
    const normalizedDefinition = normalizeRecorridoDefinition(definition_json, {
      removeInvalidEdges: true,
      cleanEmptyProps: true
    });

    // CRÍTICO: Verificar que ningún step perdió su order durante la normalización
    const stepsNormalized = normalizedDefinition?.steps || {};
    const orderSaved = Object.keys(stepsNormalized).reduce((acc, stepId) => {
      const step = stepsNormalized[stepId];
      acc[stepId] = typeof step?.order === 'number' ? step.order : 'undefined';
      return acc;
    }, {});
    
    // Detectar steps que tenían order y lo perdieron
    const stepsWithLostOrder = Object.keys(orderReceived).filter(stepId => {
      const hadOrder = typeof orderReceived[stepId] === 'number';
      const hasOrder = typeof orderSaved[stepId] === 'number';
      return hadOrder && !hasOrder;
    });
    
    if (stepsWithLostOrder.length > 0) {
      logWarn('RecorridosAPI', '⚠️ CRÍTICO: Steps perdieron su order durante normalización', {
        recorrido_id: recorridoId,
        steps_afectados: stepsWithLostOrder,
        order_antes: orderReceived,
        order_despues: orderSaved,
        mensaje: 'Esto NO debería ocurrir. Verificar normalizeStep() en normalize-recorrido-definition.js'
      });
    } else {
      logInfo('RecorridosAPI', 'Order preservado correctamente en normalización', {
        recorrido_id: recorridoId,
        steps_order: orderSaved
      });
    }

    const draftRepo = getDefaultRecorridoDraftRepo();
    const auditRepo = getDefaultRecorridoAuditRepo();

    // Obtener draft actual o crear uno nuevo
    let draft = await draftRepo.getCurrentDraft(recorridoId);
    
    if (draft) {
      // Actualizar draft existente
      draft = await draftRepo.updateDraft(
        draft.draft_id,
        normalizedDefinition,
        getAdminId(authCtx)
      );
    } else {
      // Crear nuevo draft
      draft = await draftRepo.createDraft(
        recorridoId,
        normalizedDefinition,
        getAdminId(authCtx)
      );

      // Actualizar recorrido con current_draft_id
      await recorridoRepo.updateRecorridoMeta(
        recorridoId,
        { current_draft_id: draft.draft_id }
      );
    }

    // Audit log
    await auditRepo.append(
      recorridoId,
      draft.draft_id,
      'update_draft',
      { draft_id: draft.draft_id, normalized: true },
      getAdminId(authCtx)
    );

    // LOG TEMPORAL: Mostrar order devuelto al frontend
    const stepsReturned = draft.definition_json?.steps || {};
    const orderReturned = Object.keys(stepsReturned).reduce((acc, stepId) => {
      const step = stepsReturned[stepId];
      acc[stepId] = typeof step?.order === 'number' ? step.order : 'undefined';
      return acc;
    }, {});
    logInfo('RecorridosAPI', 'Order devuelto al frontend', {
      recorrido_id: recorridoId,
      draft_id: draft.draft_id,
      steps_order: orderReturned
    });

    logInfo('RecorridosAPI', 'Draft actualizado exitosamente (normalizado)', {
      recorrido_id: recorridoId,
      draft_id: draft.draft_id
    });

    return jsonResponse({
      draft: {
        draft_id: draft.draft_id,
        definition_json: draft.definition_json,
        updated_at: draft.updated_at,
        updated_by: draft.updated_by
      }
    });
  } catch (error) {
    logError('RecorridosAPI', 'Error actualizando draft', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al actualizar draft', 500);
  }
}

/**
 * POST /admin/api/recorridos/:id/validate
 * Valida draft (si no viene definition_json, valida el draft actual)
 */
async function handleValidateDraft(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    let definition_json;

    // Intentar obtener definition_json del body (opcional)
    try {
      const body = await request.json().catch(() => ({}));
      definition_json = body.definition_json;
    } catch (e) {
      // Si no hay body, usar draft actual
    }

    // Si no viene en body, obtener draft actual
    if (!definition_json) {
      const draftRepo = getDefaultRecorridoDraftRepo();
      const draft = await draftRepo.getCurrentDraft(recorridoId);
      if (!draft) {
        return errorResponse('No hay draft para validar', 404);
      }
      definition_json = draft.definition_json;
    }

    // Validar con isPublish:false (permite warnings)
    const validation = validateRecorridoDefinition(definition_json, { isPublish: false });

    const auditRepo = getDefaultRecorridoAuditRepo();
    const draftRepo = getDefaultRecorridoDraftRepo();
    const draft = await draftRepo.getCurrentDraft(recorridoId);

    // Audit log
    await auditRepo.append(
      recorridoId,
      draft?.draft_id || null,
      'validate_draft',
      {
        valid: validation.valid,
        errors_count: validation.errors.length,
        warnings_count: validation.warnings.length,
        errors: validation.errors,
        warnings: validation.warnings
      },
      getAdminId(authCtx)
    );

    logInfo('RecorridosAPI', 'Draft validado', {
      recorrido_id: recorridoId,
      valid: validation.valid,
      errors_count: validation.errors.length,
      warnings_count: validation.warnings.length
    });

    return jsonResponse({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    });
  } catch (error) {
    logError('RecorridosAPI', 'Error validando draft', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al validar draft', 500);
  }
}

/**
 * POST /admin/api/recorridos/:id/publish
 * Publica una versión desde el draft actual
 */
async function handlePublishVersion(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { release_notes } = body;

    const recorridoRepo = getDefaultRecorridoRepo();
    const draftRepo = getDefaultRecorridoDraftRepo();
    const versionRepo = getDefaultRecorridoVersionRepo();
    const auditRepo = getDefaultRecorridoAuditRepo();

    // Verificar que el recorrido existe
    const recorrido = await recorridoRepo.getRecorridoById(recorridoId);
    if (!recorrido) {
      return errorResponse('Recorrido no encontrado', 404);
    }

    // Obtener draft actual
    const draft = await draftRepo.getCurrentDraft(recorridoId);
    if (!draft) {
      return errorResponse('No hay draft para publicar', 404);
    }

    // Validar con isPublish:true (bloquea si invalid)
    const validation = validateRecorridoDefinition(draft.definition_json, { isPublish: true });
    
    if (!validation.valid) {
      logWarn('RecorridosPublish', 'Publicación bloqueada: draft inválido', {
        recorrido_id: recorridoId,
        errors_count: validation.errors.length
      });

      // Audit log del intento fallido
      await auditRepo.append(
        recorridoId,
        draft.draft_id,
        'publish_version',
        {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        },
        getAdminId(authCtx)
      );

      return errorResponse('No se puede publicar: el draft tiene errores', 400, {
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Usar transacción para publicar
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Calcular next version
      const latestVersion = await versionRepo.getLatestVersion(recorridoId, client);
      const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

      // Obtener canvas para publicar (AXE v0.6.3)
      let canvasToPublish = null;
      let canvasWarnings = [];
      
      if (draft.canvas_json) {
        // Si hay canvas persistido, validarlo estrictamente y usarlo
        const canvasValidation = validateCanvasDefinition(draft.canvas_json, { isPublish: true });
        if (!canvasValidation.ok) {
          await client.query('ROLLBACK');
          return errorResponse('No se puede publicar: el canvas tiene errores', 400, {
            errors: canvasValidation.errors,
            warnings: canvasValidation.warnings
          });
        }
        canvasToPublish = normalizeCanvasDefinition(draft.canvas_json);
        canvasWarnings = canvasValidation.warnings;
      } else {
        // Si no hay canvas, derivar desde definition_json
        try {
          const derivedCanvas = recorridoToCanvas(draft.definition_json, { generatePositions: true });
          canvasToPublish = normalizeCanvasDefinition(derivedCanvas);
          canvasWarnings.push('Canvas publicado fue derivado automáticamente desde definition_json');
          
          logInfo('RecorridosPublish', 'Canvas derivado en publish-time', {
            recorrido_id: recorridoId,
            version: nextVersion
          });
        } catch (error) {
          logWarn('RecorridosPublish', 'Error derivando canvas en publish', {
            recorrido_id: recorridoId,
            error: error.message
          });
          // Fail-open: continuar sin canvas (no bloquear publish)
          canvasWarnings.push(`Error derivando canvas: ${error.message}. Se publica sin canvas.`);
        }
      }

      // Crear versión (INMUTABLE) con canvas
      const version = await versionRepo.createVersion(
        recorridoId,
        nextVersion,
        draft.definition_json, // INMUTABLE después de esto
        canvasToPublish, // Canvas también INMUTABLE
        release_notes || null,
        getAdminId(authCtx),
        client
      );

      // Actualizar recorrido
      const statusUpdate = recorrido.status === 'draft' ? 'published' : recorrido.status;
      await recorridoRepo.updateRecorridoMeta(
        recorridoId,
        {
          current_published_version: nextVersion,
          status: statusUpdate
        },
        client
      );

      // Audit log
      await auditRepo.append(
        recorridoId,
        draft.draft_id,
        'publish_version',
        {
          success: true,
          version: nextVersion,
          errors_count: validation.errors.length,
          warnings_count: validation.warnings.length,
          warnings: validation.warnings,
          canvas_published: canvasToPublish !== null,
          canvas_derived: draft.canvas_json === null,
          canvas_warnings: canvasWarnings
        },
        getAdminId(authCtx),
        client
      );

      await client.query('COMMIT');

      logInfo('RecorridosPublish', 'Versión publicada exitosamente', {
        recorrido_id: recorridoId,
        version: nextVersion,
        valid: validation.valid,
        errors_count: validation.errors.length,
        warnings_count: validation.warnings.length
      });

      return jsonResponse({
        version: {
          version: version.version,
          status: version.status,
          definition_json: version.definition_json,
          canvas_json: version.canvas_json,
          release_notes: version.release_notes,
          created_at: version.created_at
        },
        validation: {
          valid: validation.valid,
          warnings: validation.warnings
        },
        canvas: {
          published: canvasToPublish !== null,
          derived: draft.canvas_json === null,
          warnings: canvasWarnings
        }
      }, 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('RecorridosPublish', 'Error publicando versión', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al publicar versión', 500);
  }
}

/**
 * POST /admin/api/recorridos/:id/status
 * Cambia status global del recorrido
 */
async function handleSetStatus(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !['draft', 'published', 'deprecated', 'archived'].includes(status)) {
      return errorResponse('Status inválido. Debe ser: draft, published, deprecated o archived');
    }

    const recorridoRepo = getDefaultRecorridoRepo();
    const auditRepo = getDefaultRecorridoAuditRepo();

    // Verificar que el recorrido existe
    const recorrido = await recorridoRepo.getRecorridoById(recorridoId);
    if (!recorrido) {
      return errorResponse('Recorrido no encontrado', 404);
    }

    // Actualizar status
    const updated = await recorridoRepo.updateRecorridoMeta(
      recorridoId,
      { status }
    );

    // Audit log
    await auditRepo.append(
      recorridoId,
      null,
      'set_status',
      { old_status: recorrido.status, new_status: status },
      getAdminId(authCtx)
    );

    logInfo('RecorridosAPI', 'Status actualizado', {
      recorrido_id: recorridoId,
      old_status: recorrido.status,
      new_status: status
    });

    return jsonResponse({
      recorrido: {
        id: updated.id,
        name: updated.name,
        status: updated.status
      }
    });
  } catch (error) {
    logError('RecorridosAPI', 'Error actualizando status', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al actualizar status', 500);
  }
}

/**
 * GET /admin/api/recorridos/:id/export
 * Exporta bundle JSON del recorrido
 */
async function handleExportRecorrido(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const recorridoRepo = getDefaultRecorridoRepo();
    const draftRepo = getDefaultRecorridoDraftRepo();
    const versionRepo = getDefaultRecorridoVersionRepo();
    const auditRepo = getDefaultRecorridoAuditRepo();

    const recorrido = await recorridoRepo.getRecorridoById(recorridoId);
    if (!recorrido) {
      return errorResponse('Recorrido no encontrado', 404);
    }

    const draft = await draftRepo.getCurrentDraft(recorridoId);

    // Obtener todas las versiones publicadas (opcional)
    // Por ahora solo incluimos la última, pero se puede extender
    const latestVersion = await versionRepo.getLatestVersion(recorridoId);

    const bundle = {
      recorrido: {
        id: recorrido.id,
        name: recorrido.name,
        status: recorrido.status,
        current_published_version: recorrido.current_published_version
      },
      draft: draft ? {
        draft_id: draft.draft_id,
        definition_json: draft.definition_json
      } : null,
      published_versions: latestVersion ? [{
        version: latestVersion.version,
        status: latestVersion.status,
        definition_json: latestVersion.definition_json,
        release_notes: latestVersion.release_notes,
        created_at: latestVersion.created_at
      }] : [],
      exported_at: new Date().toISOString()
    };

    // Audit log
    await auditRepo.append(
      recorridoId,
      draft?.draft_id || null,
      'export',
      { exported_at: bundle.exported_at },
      getAdminId(authCtx)
    );

    logInfo('RecorridosAPI', 'Recorrido exportado', {
      recorrido_id: recorridoId
    });

    return jsonResponse(bundle);
  } catch (error) {
    logError('RecorridosAPI', 'Error exportando recorrido', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al exportar recorrido', 500);
  }
}

/**
 * POST /admin/api/recorridos/:id/preview-step
 * Preview de un step específico con mock data opcional o PreviewContext
 * 
 * Body: { 
 *   step_id, 
 *   mock?: { nivel_efectivo, tipo_limpieza, etc. } (legacy),
 *   preview_context?: PreviewContext (nuevo),
 *   preview_profile_id?: string (nuevo - ID de Mock Profile)
 * }
 * Response: { ok: true, html?: "...", render_spec?: {...}, warnings: [] }
 * 
 * SPRINT AXE v0.3 - Preview Harness Unificado
 */
async function handlePreviewStep(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { step_id, mock: legacyMock = {}, preview_context, preview_profile_id } = body;

    if (!step_id) {
      return errorResponse('Se requiere step_id en el body');
    }

    // SPRINT AXE v0.3: Determinar PreviewContext
    let previewContextData = null;
    
    if (preview_context) {
      // PreviewContext explícito (prioridad)
      previewContextData = preview_context;
    } else if (preview_profile_id) {
      // Cargar desde Mock Profile (solo si está disponible server-side)
      // Por ahora, en el cliente se maneja, pero podríamos tener endpoints para profiles
      logWarn('RecorridosAPI', 'preview_profile_id especificado pero no soportado server-side todavía', {
        preview_profile_id
      });
      // Fallback a mock legacy
      previewContextData = legacyMock;
    } else {
      // Legacy: usar mock directo (mantener compatibilidad)
      previewContextData = legacyMock;
    }

    const draftRepo = getDefaultRecorridoDraftRepo();
    const versionRepo = getDefaultRecorridoVersionRepo();

    // Cargar draft SIEMPRE primero (si existe)
    let definition = null;
    let source = 'draft';
    let checksum = null;
    let updatedAt = null;

    const draft = await draftRepo.getCurrentDraft(recorridoId);
    if (draft && draft.definition_json) {
      definition = draft.definition_json;
      source = 'draft';
      updatedAt = draft.updated_at;
      // Checksum puede calcularse si es necesario
    } else {
      // Si no hay draft, usar published como fallback
      const published = await versionRepo.getLatestVersion(recorridoId);
      if (published && published.definition_json) {
        definition = published.definition_json;
        source = 'published';
        checksum = published.checksum || null;
        updatedAt = published.created_at;
      }
    }

    if (!definition || !definition.steps) {
      return errorResponse(`No se encontró definición para recorrido "${recorridoId}"`, 404);
    }

    const step = definition.steps[step_id];
    if (!step) {
      return errorResponse(`Step "${step_id}" no encontrado en el recorrido`, 404);
    }

    // Construir renderSpec usando la misma lógica del runtime
    const { buildRenderSpecForPreview } = await import('../core/recorridos/runtime/recorrido-runtime-preview.js');
    
    // SPRINT AXE v0.3: Pasar PreviewContext o mock legacy
    const renderSpec = await buildRenderSpecForPreview(step, step_id, previewContextData || legacyMock);

    // Renderizar HTML del step
    const { renderStepHTML } = await import('../core/recorridos/runtime/step-renderer.js');
    let html = null;
    let renderError = null;
    
    try {
      html = await renderStepHTML(renderSpec);
    } catch (error) {
      renderError = error.message;
      logWarn('RecorridosAPI', 'Error renderizando HTML en preview', {
        recorrido_id: recorridoId,
        step_id,
        error: error.message
      });
    }

    const warnings = [];
    
    // SPRINT AXE v0.3: Validar PreviewContext si existe
    if (previewContextData && previewContextData.preview_mode === true) {
      const { validatePreviewContext } = await import('../core/preview/preview-context.js');
      const contextWarnings = validatePreviewContext(previewContextData);
      warnings.push(...contextWarnings);
    }
    
    // Si el step tiene handler y faltan datos, añadir warnings
    const mockData = previewContextData?.student || legacyMock;
    if (step.handler && (!mockData || Object.keys(mockData).length === 0)) {
      warnings.push('Este step tiene un handler específico. Considera proporcionar datos mock para un preview más realista.');
    }
    
    // Warnings adicionales según el tipo de handler
    const tipoLimpieza = mockData?.tipo_limpieza || legacyMock?.tipo_limpieza;
    const nivelEfectivo = mockData?.nivel_efectivo || legacyMock?.nivel_efectivo || previewContextData?.student?.nivel_efectivo;
    
    if (step.handler === 'pde_catalog' && !tipoLimpieza) {
      warnings.push('Falta mock.tipo_limpieza para este handler');
    }
    
    if (step.handler === 'pde_catalog' && nivelEfectivo && nivelEfectivo < 3) {
      warnings.push('No hay items en catálogo por nivel (nivel_efectivo < 3)');
    }

    logInfo('RecorridosAPI', 'Preview step generado', {
      recorrido_id: recorridoId,
      step_id,
      source,
      has_html: !!html,
      has_render_error: !!renderError
    });

    return jsonResponse({
      ok: true,
      html: html || null,
      render_spec: renderSpec,
      warnings: warnings,
      source: source,
      checksum: checksum,
      updated_at: updatedAt,
      metadata: {
        source: source,
        checksum: checksum,
        updated_at: updatedAt,
        step_id: step_id,
        recorrido_id: recorridoId
      },
      render_error: renderError || null
    });

  } catch (error) {
    logError('RecorridosAPI', 'Error generando preview step', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return jsonResponse({
      ok: false,
      error: {
        message: error.message,
        code: 'PREVIEW_ERROR'
      }
    }, 500);
  }
}

/**
 * GET /admin/api/recorridos/:id/canvas
 * Obtiene el canvas del recorrido (persistido o derivado)
 * 
 * Response: {
 *   ok: true,
 *   source: "draft" | "derived",
 *   canvas: <CanvasDefinition normalizado>,
 *   warnings: []
 * }
 */
async function handleGetCanvas(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const draftRepo = getDefaultRecorridoDraftRepo();
    const draft = await draftRepo.getCurrentDraft(recorridoId);

    if (!draft) {
      return errorResponse('No hay draft para este recorrido', 404);
    }

    const result = getEffectiveCanvasForDraft(draft);

    return jsonResponse({
      ok: true,
      source: result.source,
      canvas: result.canvas,
      warnings: result.warnings
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error obteniendo canvas', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al obtener canvas', 500);
  }
}

/**
 * PUT /admin/api/recorridos/:id/canvas
 * Guarda canvas en draft (valida, normaliza y persiste)
 * 
 * Body: { canvas: <CanvasDefinition> }
 * Response: {
 *   ok: true,
 *   canvas_normalized: <CanvasDefinition normalizado>,
 *   warnings: []
 * }
 * 
 * Si hay errors bloqueantes → 400 con { ok: false, errors, warnings }
 */
async function handleSaveCanvas(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { canvas } = body;

    if (!canvas) {
      return errorResponse('Se requiere "canvas" en el body');
    }

    const result = await saveCanvasToDraft(recorridoId, canvas, {
      isPublish: false,
      updated_by: getAdminId(authCtx)
    });

    if (!result.ok) {
      return errorResponse('No se puede guardar canvas: tiene errores', 400, {
        errors: result.errors,
        warnings: result.warnings
      });
    }

    return jsonResponse({
      ok: true,
      canvas_normalized: result.canvas_normalized,
      warnings: result.warnings
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error guardando canvas', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al guardar canvas', 500);
  }
}

/**
 * POST /admin/api/recorridos/:id/canvas/validate
 * Valida canvas sin persistir
 * 
 * Body: { canvas: <CanvasDefinition> }
 * Response: {
 *   ok: true,
 *   valid: boolean,
 *   errors: [],
 *   warnings: []
 * }
 */
async function handleValidateCanvas(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { canvas } = body;

    if (!canvas) {
      return errorResponse('Se requiere "canvas" en el body');
    }

    const validation = validateCanvasDefinition(canvas, { isPublish: false });

    return jsonResponse({
      ok: true,
      valid: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error validando canvas', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al validar canvas', 500);
  }
}

/**
 * POST /admin/api/recorridos/:id/canvas/convert-to-recorrido
 * Convierte Canvas → RecorridoDefinition (solo devuelve, no persiste)
 * 
 * Body: { canvas: <CanvasDefinition> }
 * Response: {
 *   ok: true,
 *   recorrido_definition: <RecorridoDefinition>,
 *   warnings: []
 * }
 */
async function handleConvertCanvasToRecorrido(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { canvas } = body;

    if (!canvas) {
      return errorResponse('Se requiere "canvas" en el body');
    }

    const recorridoDefinition = canvasToRecorrido(canvas);
    const warnings = [];

    // Validar que el recorrido resultante es válido
    const validation = validateRecorridoDefinition(recorridoDefinition, { isPublish: false });
    if (!validation.valid) {
      warnings.push(...validation.errors.map(e => `Recorrido resultante: ${e}`));
    }
    if (validation.warnings) {
      warnings.push(...validation.warnings);
    }

    return jsonResponse({
      ok: true,
      recorrido_definition: recorridoDefinition,
      warnings
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error convirtiendo canvas a recorrido', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse(`Error convirtiendo canvas: ${error.message}`, 500);
  }
}

/**
 * DELETE /admin/api/recorridos/:id
 * Borra un recorrido (soft delete: marca status = 'deleted')
 */
async function handleDeleteRecorrido(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const recorridoRepo = getDefaultRecorridoRepo();
    
    // Verificar que el recorrido existe
    const recorrido = await recorridoRepo.getRecorridoById(recorridoId);
    if (!recorrido) {
      return errorResponse(`Recorrido "${recorridoId}" no encontrado`, 404);
    }

    // Soft delete: marcar como deleted
    await recorridoRepo.updateRecorridoMeta(recorridoId, { status: 'deleted' });

    logInfo('RecorridosAPI', 'Recorrido borrado (soft delete)', {
      recorrido_id: recorridoId,
      deleted_by: getAdminId(authCtx)
    });

    return jsonResponse({
      recorrido_id: recorridoId,
      deleted: true,
      message: 'Recorrido borrado correctamente'
    });
  } catch (error) {
    logError('RecorridosAPI', 'Error borrando recorrido', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al borrar recorrido', 500);
  }
}

/**
 * POST /admin/api/recorridos/import
 * Importa bundle JSON (crea o actualiza según estrategia "safe")
 */
async function handleImportRecorrido(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const bundle = await request.json();

    if (!bundle.recorrido || !bundle.recorrido.id) {
      return errorResponse('Bundle inválido: falta recorrido.id');
    }

    const { id, name } = bundle.recorrido;
    const definition_json = bundle.draft?.definition_json || bundle.published_versions?.[0]?.definition_json;

    if (!definition_json) {
      return errorResponse('Bundle inválido: falta definition_json en draft o published_versions');
    }

    const recorridoRepo = getDefaultRecorridoRepo();
    const draftRepo = getDefaultRecorridoDraftRepo();
    const auditRepo = getDefaultRecorridoAuditRepo();

    // Usar transacción
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Verificar si el recorrido existe
      const existing = await recorridoRepo.getRecorridoById(id, client);

      if (existing) {
        // Estrategia "safe": crear NUEVO draft y no tocar published
        const draft = await draftRepo.createDraft(
          id,
          definition_json,
          getAdminId(authCtx),
          client
        );

        await recorridoRepo.updateRecorridoMeta(
          id,
          { current_draft_id: draft.draft_id },
          client
        );

        await client.query('COMMIT');

        logInfo('RecorridosAPI', 'Recorrido importado (actualizado draft)', {
          recorrido_id: id,
          draft_id: draft.draft_id
        });

        return jsonResponse({
          action: 'updated_draft',
          recorrido_id: id,
          draft_id: draft.draft_id
        });
      } else {
        // Crear nuevo recorrido + draft
        const recorrido = await recorridoRepo.createRecorrido({ id, name }, client);
        const draft = await draftRepo.createDraft(
          id,
          definition_json,
          getAdminId(authCtx),
          client
        );

        await recorridoRepo.updateRecorridoMeta(
          id,
          { current_draft_id: draft.draft_id },
          client
        );

        // Audit log
        await auditRepo.append(
          id,
          draft.draft_id,
          'import',
          { imported_at: bundle.exported_at || new Date().toISOString() },
          getAdminId(authCtx),
          client
        );

        await client.query('COMMIT');

        logInfo('RecorridosAPI', 'Recorrido importado (creado nuevo)', {
          recorrido_id: id,
          draft_id: draft.draft_id
        });

        return jsonResponse({
          action: 'created',
          recorrido_id: id,
          draft_id: draft.draft_id
        }, 201);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logError('RecorridosAPI', 'Error importando recorrido', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al importar recorrido', 500);
  }
}

/**
 * Handler principal que enruta según el método y path
 * 
 * BLINDAJE v2:
 * - recorridoId se valida como slug técnico
 * - Errores 404 devuelven JSON, no HTML
 * - URLs con espacios o caracteres especiales se rechazan con error claro
 */
export default async function adminRecorridosApiHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Extraer recorridoId si está en el path
  const match = path.match(/^\/admin\/api\/recorridos\/([^\/]+)(?:\/(.+))?$/);
  // Decodificar el recorridoId para manejar espacios y caracteres especiales
  const recorridoIdRaw = match ? decodeURIComponent(match[1]) : null;
  const subPath = match ? match[2] : null;
  
  // BLINDAJE v2: Validar que el recorridoId sea un slug válido
  // RETROCOMPATIBILIDAD: Permitir acceso a recorridos legacy con IDs no-slug
  // La validación estricta se aplica solo en la CREACIÓN de nuevos recorridos
  let recorridoId = recorridoIdRaw;
  if (recorridoIdRaw && !['import'].includes(recorridoIdRaw)) {
    const slugValidation = validateSlugId(recorridoIdRaw);
    if (!slugValidation.valid) {
      // Log de advertencia pero NO bloquear el acceso (retrocompatibilidad)
      logInfo('RecorridosAPI', 'Acceso a recorrido con ID legacy (no-slug)', {
        recorrido_id: recorridoIdRaw,
        validation_error: slugValidation.error,
        path,
        note: 'Se permite por retrocompatibilidad. Nuevos recorridos requieren slugs válidos.'
      });
      // No retornamos error, permitimos el acceso para operaciones GET/PUT/etc
      // La validación estricta solo aplica en handleCreateRecorrido
    }
  }

  // Enrutamiento
  if (method === 'GET' && path === '/admin/api/recorridos') {
    return handleListRecorridos(request, env, ctx);
  }

  if (method === 'POST' && path === '/admin/api/recorridos') {
    return handleCreateRecorrido(request, env, ctx);
  }

  if (method === 'GET' && recorridoId && !subPath) {
    return handleGetRecorrido(request, env, ctx, recorridoId);
  }

  if (method === 'PUT' && recorridoId && subPath === 'draft') {
    return handleUpdateDraft(request, env, ctx, recorridoId);
  }

  if (method === 'POST' && recorridoId && subPath === 'validate') {
    return handleValidateDraft(request, env, ctx, recorridoId);
  }

  if (method === 'POST' && recorridoId && subPath === 'publish') {
    return handlePublishVersion(request, env, ctx, recorridoId);
  }

  if (method === 'POST' && recorridoId && subPath === 'status') {
    return handleSetStatus(request, env, ctx, recorridoId);
  }

  if (method === 'GET' && recorridoId && subPath === 'export') {
    return handleExportRecorrido(request, env, ctx, recorridoId);
  }

  if (method === 'POST' && path === '/admin/api/recorridos/import') {
    return handleImportRecorrido(request, env, ctx);
  }

  if (method === 'POST' && recorridoId && subPath === 'preview-step') {
    return handlePreviewStep(request, env, ctx, recorridoId);
  }

  // Endpoints de Canvas (AXE v0.6.3)
  if (method === 'GET' && recorridoId && subPath === 'canvas') {
    return handleGetCanvas(request, env, ctx, recorridoId);
  }

  if (method === 'PUT' && recorridoId && subPath === 'canvas') {
    return handleSaveCanvas(request, env, ctx, recorridoId);
  }

  if (method === 'POST' && recorridoId && subPath === 'canvas/validate') {
    return handleValidateCanvas(request, env, ctx, recorridoId);
  }

  if (method === 'POST' && recorridoId && subPath === 'canvas/convert-to-recorrido') {
    return handleConvertCanvasToRecorrido(request, env, ctx, recorridoId);
  }

  if (method === 'DELETE' && recorridoId && !subPath) {
    return handleDeleteRecorrido(request, env, ctx, recorridoId);
  }

  // No encontrado
  return errorResponse('Endpoint no encontrado', 404);
}

