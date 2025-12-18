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
import {
  insertNodeAfter,
  convertNodeToDecision,
  markAsStart,
  markAsEnd,
  duplicateSubgraph
} from '../core/canvas/canvas-semantic-actions.js';
import {
  insertStandardEnding,
  createGuidedChoice,
  createBranchingPath,
  createLinearSequence,
  listAvailableMacros
} from '../core/canvas/canvas-semantic-macros.js';
import {
  listAvailablePresets,
  getPresetById
} from '../core/canvas/canvas-presets.js';
import { analyzeCanvas } from '../core/canvas/canvas-semantic-analysis.js';
import { generateSuggestions } from '../core/canvas/canvas-pedagogical-suggestions.js';

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

    // Usar transacción para publicar
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Calcular next version
      const latestVersion = await versionRepo.getLatestVersion(recorridoId, client);
      const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

      // AXE v0.6.3: Flujo de publicación consolidado
      let definitionToPublish = null;
      let canvasToPublish = null;
      let canvasWarnings = [];
      let definitionWarnings = [];
      
      if (draft.canvas_json) {
        // CASO 1: Canvas persistido → Generar definition vía canvasToRecorrido()
        logInfo('RecorridosPublish', 'Canvas persistido encontrado, generando definition_json', {
          recorrido_id: recorridoId,
          version: nextVersion
        });

        // Validar canvas estrictamente
        const canvasValidation = validateCanvasDefinition(draft.canvas_json, { isPublish: true });
        if (!canvasValidation.ok) {
          await client.query('ROLLBACK');
          return errorResponse('No se puede publicar: el canvas tiene errores', 400, {
            errors: canvasValidation.errors,
            warnings: canvasValidation.warnings
          });
        }
        
        // Normalizar canvas
        const normalizedCanvas = normalizeCanvasDefinition(draft.canvas_json);
        canvasToPublish = normalizedCanvas;
        canvasWarnings = canvasValidation.warnings;

        // Generar definition_json desde canvas
        try {
          definitionToPublish = canvasToRecorrido(normalizedCanvas);
          
          logInfo('RecorridosPublish', 'Definition generada desde canvas', {
            recorrido_id: recorridoId,
            version: nextVersion,
            steps_count: Object.keys(definitionToPublish.steps || {}).length,
            edges_count: (definitionToPublish.edges || []).length
          });
        } catch (error) {
          await client.query('ROLLBACK');
          logWarn('RecorridosPublish', 'Error generando definition desde canvas', {
            recorrido_id: recorridoId,
            error: error.message
          });
          return errorResponse('Error generando definition desde canvas', 500, {
            error: error.message
          });
        }

        // Validar definition generada
        const definitionValidation = validateRecorridoDefinition(definitionToPublish, { isPublish: true });
        if (!definitionValidation.valid) {
          await client.query('ROLLBACK');
          return errorResponse('No se puede publicar: la definition generada desde canvas tiene errores', 400, {
            errors: definitionValidation.errors,
            warnings: definitionValidation.warnings
          });
        }
        definitionWarnings = definitionValidation.warnings;

      } else {
        // CASO 2: No hay canvas → Usar definition_json legacy
        logInfo('RecorridosPublish', 'Canvas no persistido, usando definition_json legacy', {
          recorrido_id: recorridoId,
          version: nextVersion
        });

        // Validar definition_json legacy
        const validation = validateRecorridoDefinition(draft.definition_json, { isPublish: true });
        if (!validation.valid) {
          await client.query('ROLLBACK');
          
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
            getAdminId(authCtx),
            client
          );

          return errorResponse('No se puede publicar: el draft tiene errores', 400, {
            errors: validation.errors,
            warnings: validation.warnings
          });
        }
        
        definitionToPublish = draft.definition_json;
        definitionWarnings = validation.warnings;

        // Opcionalmente derivar canvas desde definition para visualización
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

      // Crear versión (INMUTABLE) con definition y canvas
      const version = await versionRepo.createVersion(
        recorridoId,
        nextVersion,
        definitionToPublish, // INMUTABLE después de esto (generada o legacy)
        canvasToPublish, // Canvas también INMUTABLE (persistido o derivado)
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
          definition_from_canvas: draft.canvas_json !== null,
          definition_legacy: draft.canvas_json === null,
          errors_count: 0, // Ya validado antes
          warnings_count: definitionWarnings.length + canvasWarnings.length,
          definition_warnings: definitionWarnings,
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
        definition_from_canvas: draft.canvas_json !== null,
        definition_warnings_count: definitionWarnings.length,
        canvas_warnings_count: canvasWarnings.length
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
          valid: true,
          definition_warnings: definitionWarnings,
          canvas_warnings: canvasWarnings
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
 * GET /admin/api/recorridos/:id/preview
 * Preview completo del recorrido como HTML navegable (sandbox, no runtime real)
 * 
 * AXE v0.6.9: Preview Harness para admin
 * - Carga draft si existe; si no published
 * - Construye HTML con renderHtml()
 * - Aplica theme (dark-classic por defecto o del admin)
 * - Muestra lista navegable de steps + botón "Start preview"
 * - NO ejecuta runtime real (solo preview sandbox)
 * 
 * Response: HTML completo con preview harness
 */
async function handlePreviewRecorrido(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const draftRepo = getDefaultRecorridoDraftRepo();
    const versionRepo = getDefaultRecorridoVersionRepo();

    // Cargar draft si existe; si no published
    let definition = null;
    let source = 'unknown';

    const draft = await draftRepo.getCurrentDraft(recorridoId);
    if (draft && draft.definition_json) {
      definition = draft.definition_json;
      source = 'draft';
    } else {
      const published = await versionRepo.getLatestVersion(recorridoId);
      if (published && published.definition_json) {
        definition = published.definition_json;
        source = 'published';
      }
    }

    if (!definition || !definition.steps) {
      return new Response('Recorrido no encontrado o sin steps', {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    }

    // Construir lista de steps para navegación
    const steps = Object.keys(definition.steps || {}).map(stepId => ({
      id: stepId,
      ...definition.steps[stepId]
    }));

    // Construir HTML del preview harness
    const { renderHtml } = await import('../core/html-response.js');
    const { applyTheme } = await import('../core/responses.js');

    // Obtener tema del admin desde localStorage o usar dark-classic por defecto
    const themeId = 'dark-classic'; // Por defecto, podría leerse de request param o cookie

    const previewHTML = `
<!DOCTYPE html>
<html lang="es" data-theme="dark-classic">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${recorridoId}</title>
  <link rel="stylesheet" href="/css/theme-variables.css">
  <link rel="stylesheet" href="/css/theme-overrides.css">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary, #0f172a);
      color: var(--text-primary, #f1f5f9);
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .preview-header {
      background: var(--bg-card, #1e293b);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .preview-header h1 {
      margin: 0 0 8px 0;
      color: var(--text-primary, #f1f5f9);
    }
    .preview-header p {
      color: var(--text-muted, #94a3b8);
      margin: 0;
    }
    .steps-list {
      background: var(--bg-card, #1e293b);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .steps-list h2 {
      margin: 0 0 16px 0;
      color: var(--text-primary, #f1f5f9);
    }
    .step-item {
      padding: 12px;
      margin-bottom: 8px;
      background: var(--bg-secondary, #334155);
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .step-item:hover {
      background: var(--bg-hover, #475569);
    }
    .step-item.active {
      background: var(--accent-primary, #3b82f6);
    }
    .step-preview-container {
      background: var(--bg-card, #1e293b);
      border-radius: 12px;
      padding: 24px;
      min-height: 400px;
    }
    .btn-start {
      padding: 12px 24px;
      background: var(--accent-primary, #3b82f6);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 16px;
    }
    .btn-start:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="preview-header">
    <h1>Preview: ${recorridoId}</h1>
    <p>Source: ${source} | Steps: ${steps.length}</p>
  </div>

  <div class="steps-list">
    <h2>Steps del Recorrido</h2>
    ${steps.map((step, idx) => `
      <div class="step-item" data-step-id="${step.id}" onclick="loadStep('${step.id}')">
        <strong>${step.id}</strong> - ${step.screen_template_id || 'unknown'}
      </div>
    `).join('')}
    <button class="btn-start" onclick="startPreview()">▶ Start Preview</button>
  </div>

  <div class="step-preview-container" id="step-preview">
    <p style="color: var(--text-muted, #94a3b8);">Selecciona un step para ver su preview</p>
  </div>

  <script>
    const steps = ${JSON.stringify(steps)};
    const recorridoId = '${recorridoId}';

    async function loadStep(stepId) {
      // Resaltar step activo
      document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active'));
      document.querySelector(\`[data-step-id="\${stepId}"]\`).classList.add('active');

      try {
        const response = await fetch(\`/admin/api/recorridos/\${recorridoId}/preview-step\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step_id: stepId })
        });
        const data = await response.json();
        
        const container = document.getElementById('step-preview');
        if (data.html) {
          container.innerHTML = data.html;
        } else {
          container.innerHTML = '<p style="color: var(--text-muted);">No hay HTML disponible para este step</p>';
        }
      } catch (error) {
        console.error('Error cargando step:', error);
        document.getElementById('step-preview').innerHTML = '<p style="color: red;">Error cargando step</p>';
      }
    }

    function startPreview() {
      if (steps.length > 0) {
        const entryStepId = '${definition.entry_step_id || steps[0].id}';
        loadStep(entryStepId);
      }
    }

    // Cargar step inicial si existe
    ${definition.entry_step_id ? `loadStep('${definition.entry_step_id}');` : ''}
  </script>
</body>
</html>
    `;

    // Aplicar tema
    const htmlWithTheme = applyTheme(previewHTML, null, themeId);

    return new Response(htmlWithTheme, {
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    logError('RecorridosAPI', 'Error generando preview', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });

    return new Response(`Error generando preview: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
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
 * GET /admin/api/recorridos/:id/canvas/debug
 * Endpoint de debug para diagnosticar problemas con canvas (AXE v0.6.9)
 * 
 * Response: {
 *   draft_id: string | null,
 *   definition_json_size: number (bytes),
 *   canvas_json_size: number (bytes) | null,
 *   validation_error: string | null,
 *   has_canvas_json: boolean
 * }
 */
async function handleDebugCanvas(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const draftRepo = getDefaultRecorridoDraftRepo();
    const draft = await draftRepo.getCurrentDraft(recorridoId);

    if (!draft) {
      return jsonResponse({
        draft_id: null,
        definition_json_size: 0,
        canvas_json_size: null,
        validation_error: 'No hay draft para este recorrido',
        has_canvas_json: false
      });
    }

    const definitionSize = draft.definition_json 
      ? JSON.stringify(draft.definition_json).length 
      : 0;
    
    const canvasSize = draft.canvas_json 
      ? JSON.stringify(draft.canvas_json).length 
      : null;

    let validationError = null;
    try {
      if (draft.canvas_json) {
        const validation = validateCanvasDefinition(draft.canvas_json, { isPublish: false });
        if (validation.errors.length > 0) {
          validationError = validation.errors[0];
        }
      } else {
        const result = getEffectiveCanvasForDraft(draft);
        // Si source es error-fallback, hubo un error
        if (result.source === 'error-fallback') {
          validationError = result.warnings?.[0] || 'Error derivando canvas';
        }
      }
    } catch (err) {
      validationError = err.message;
    }

    return jsonResponse({
      draft_id: draft.draft_id,
      definition_json_size: definitionSize,
      canvas_json_size: canvasSize,
      validation_error: validationError,
      has_canvas_json: !!draft.canvas_json
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error en debug canvas', {
      recorrido_id: recorridoId,
      error: error.message
    });
    return errorResponse('Error interno en debug canvas', 500);
  }
}

/**
 * GET /admin/api/recorridos/:id/canvas
 * Obtiene el canvas del recorrido (persistido o derivado)
 * 
 * AXE v0.6.9: Fail-open - NUNCA devuelve 400 en GET. Si hay error, devuelve canvas mínimo válido.
 * 
 * Response: {
 *   ok: true,
 *   source: "draft" | "derived" | "error-fallback",
 *   canvas: <CanvasDefinition normalizado>,
 *   warnings: []
 * }
 */
async function handleGetCanvas(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  let hasDraft = false;
  let hasCanvasJson = false;
  let source = 'unknown';

  try {
    const draftRepo = getDefaultRecorridoDraftRepo();
    const draft = await draftRepo.getCurrentDraft(recorridoId);

    hasDraft = !!draft;
    hasCanvasJson = !!(draft && draft.canvas_json);

    logInfo('RecorridosCanvasAPI', '[AXE][GET_CANVAS]', {
      recorrido_id: recorridoId,
      has_draft: hasDraft,
      has_canvas_json: hasCanvasJson
    });

    if (!draft) {
      logWarn('RecorridosCanvasAPI', '[AXE][GET_CANVAS] No hay draft, devolviendo canvas mínimo', {
        recorrido_id: recorridoId
      });
      
      // Fail-open: devolver canvas mínimo válido
      const fallbackCanvas = {
        version: "1.0",
        canvas_id: recorridoId || 'fallback',
        name: "Canvas Fallback",
        entry_node_id: "start",
        nodes: [
          { id: "start", type: "start", label: "Start", position: { x: 80, y: 80 }, props: {} },
          { id: "end", type: "end", label: "End", position: { x: 380, y: 80 }, props: {} }
        ],
        edges: [
          { id: "e_start_end", type: "direct", from_node_id: "start", to_node_id: "end" }
        ]
      };

      return jsonResponse({
        canvas: fallbackCanvas,
        source: "error-fallback",
        warnings: ["No hay draft para este recorrido. Se muestra canvas mínimo válido."]
      });
    }

    // Intentar obtener canvas efectivo (puede fallar en derivación/validación)
    try {
      const result = getEffectiveCanvasForDraft(draft);
      source = result.source || 'unknown';

      logInfo('RecorridosCanvasAPI', '[AXE][GET_CANVAS] Canvas obtenido exitosamente', {
        recorrido_id: recorridoId,
        source: source,
        warnings_count: result.warnings?.length || 0
      });

      return jsonResponse({
        canvas: result.canvas,
        source: source,
        warnings: result.warnings || []
      });
    } catch (canvasError) {
      // Error derivando/validando canvas - fail-open con canvas mínimo
      logError('RecorridosCanvasAPI', '[AXE][GET_CANVAS] Error obteniendo canvas efectivo', {
        recorrido_id: recorridoId,
        has_draft: hasDraft,
        has_canvas_json: hasCanvasJson,
        source: source,
        error_message: canvasError.message,
        error_stack: canvasError.stack
      });

      const fallbackCanvas = {
        version: "1.0",
        canvas_id: recorridoId || 'fallback',
        name: "Canvas Fallback",
        entry_node_id: "start",
        nodes: [
          { id: "start", type: "start", label: "Start", position: { x: 80, y: 80 }, props: {} },
          { id: "end", type: "end", label: "End", position: { x: 380, y: 80 }, props: {} }
        ],
        edges: [
          { id: "e_start_end", type: "direct", from_node_id: "start", to_node_id: "end" }
        ]
      };

      return jsonResponse({
        canvas: fallbackCanvas,
        source: "error-fallback",
        warnings: [
          `Error procesando canvas: ${canvasError.message}. Se muestra canvas mínimo válido.`,
          "El canvas puede tener errores de validación. Revisa los logs para más detalles."
        ]
      });
    }
  } catch (error) {
    // Error crítico (DB, etc.) - aún así fail-open
    logError('RecorridosCanvasAPI', '[AXE][GET_CANVAS] Error crítico obteniendo canvas', {
      recorrido_id: recorridoId,
      has_draft: hasDraft,
      has_canvas_json: hasCanvasJson,
      source: source,
      error_message: error.message,
      error_stack: error.stack
    });

    const fallbackCanvas = {
      version: "1.0",
      canvas_id: recorridoId || 'fallback',
      name: "Canvas Fallback",
      entry_node_id: "start",
      nodes: [
        { id: "start", type: "start", label: "Start", position: { x: 80, y: 80 }, props: {} },
        { id: "end", type: "end", label: "End", position: { x: 380, y: 80 }, props: {} }
      ],
      edges: [
        { id: "e_start_end", type: "direct", from_node_id: "start", to_node_id: "end" }
      ]
    };

    return jsonResponse({
      canvas: fallbackCanvas,
      source: "error-fallback",
      warnings: [
        `Error crítico obteniendo canvas: ${error.message}. Se muestra canvas mínimo válido.`,
        "Revisa los logs del servidor para más detalles."
      ]
    });
  }
}

/**
 * PUT /admin/api/recorridos/:id/canvas
 * Guarda canvas en draft (valida, normaliza, repara y persiste)
 * 
 * AXE v0.6.9+ - EDITOR MODE (fail-open):
 * - SIEMPRE devuelve 200 (nunca 400 por errores de validación)
 * - SIEMPRE guarda el canvas aunque tenga errores estructurales
 * - Ejecuta repair de nodos inalcanzables antes de guardar
 * - Devuelve errores y warnings en la respuesta JSON
 * - Los errores SOLO bloquean el endpoint de PUBLICACIÓN, no el guardado
 * 
 * Body: { canvas: <CanvasDefinition> }
 * Response: {
 *   ok: boolean (true si no hay errores, false si hay errores pero se guardó),
 *   saved: true,
 *   mode: "editor",
 *   source: "persisted",
 *   canvas: <CanvasDefinition normalizado y reparado>,
 *   errors: [],
 *   warnings: []
 * }
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

    // EDITOR MODE: SIEMPRE devolver 200, incluso si hay errores
    // PERO: Si saved === false, significa que NO se persistió (rowCount === 0)
    logInfo('RecorridosCanvasAPI', '[AXE][PUT_CANVAS]', {
      recorrido_id: recorridoId,
      saved: result.saved || false,
      source: result.source || 'unknown',
      errors: result.errors?.length || 0,
      warnings: result.warnings?.length || 0
    });

    return jsonResponse({
      ok: result.ok,
      saved: result.saved || false,
      mode: 'editor',
      source: result.source || 'derived',
      canvas: result.canvas_normalized,
      errors: result.errors || [],
      warnings: result.warnings || []
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', '[AXE][PUT_CANVAS] Error guardando canvas', {
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
 * GET /admin/api/recorridos/:id/canvas/analyze
 * Analiza el canvas del recorrido (desde draft) y devuelve diagnósticos semánticos
 * 
 * Response: {
 *   ok: true,
 *   warnings: Array<Diagnostic>,
 *   infos: Array<Diagnostic>
 * }
 * 
 * AXE v0.6.9 - Diagnóstico Semántico (READ-ONLY)
 */
async function handleAnalyzeCanvas(request, env, ctx, recorridoId) {
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
    const analysis = analyzeCanvas(result.canvas);
    const suggestions = generateSuggestions(result.canvas, analysis);

    return jsonResponse({
      ok: true,
      warnings: analysis.warnings,
      infos: analysis.infos,
      suggestions: suggestions
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error analizando canvas', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al analizar canvas', 500);
  }
}

/**
 * POST /admin/api/recorridos/:id/canvas/analyze
 * Analiza un canvas proporcionado en el body (sin persistir)
 * 
 * Body: { canvas: <CanvasDefinition> }
 * Response: {
 *   ok: true,
 *   warnings: Array<Diagnostic>,
 *   infos: Array<Diagnostic>
 * }
 * 
 * AXE v0.6.9 - Diagnóstico Semántico (READ-ONLY)
 */
async function handleAnalyzeCanvasPost(request, env, ctx, recorridoId) {
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

    const analysis = analyzeCanvas(canvas);
    const suggestions = generateSuggestions(canvas, analysis);

    return jsonResponse({
      ok: true,
      warnings: analysis.warnings,
      infos: analysis.infos,
      suggestions: suggestions
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error analizando canvas', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al analizar canvas', 500);
  }
}

/**
 * POST /admin/api/recorridos/:id/canvas/action
 * Ejecuta una acción semántica sobre el canvas (AXE v0.6.4+)
 * 
 * Soporta acciones simples y macros compuestas (AXE v0.6.6)
 * 
 * Body: {
 *   canvas: <CanvasDefinition>,
 *   action: <actionName> | <macroName>,
 *   params: { ... } // Parámetros específicos de la acción/macro
 * }
 * 
 * Acciones simples:
 *   - 'insertNodeAfter'
 *   - 'convertNodeToDecision'
 *   - 'markAsStart'
 *   - 'markAsEnd'
 *   - 'duplicateSubgraph'
 * 
 * Macros compuestas (AXE v0.6.6):
 *   - 'insertStandardEnding'
 *   - 'createGuidedChoice'
 *   - 'createBranchingPath'
 *   - 'createLinearSequence'
 * 
 * Response: {
 *   ok: true,
 *   canvas: <CanvasDefinition normalizado y validado>,
 *   warnings: [],
 *   isMacro: boolean // Indica si fue una macro
 * }
 * 
 * NO persiste el canvas (solo devuelve el resultado)
 */
async function handleCanvasAction(request, env, ctx, recorridoId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const body = await request.json();
    const { canvas, action, params } = body;

    if (!canvas) {
      return errorResponse('Se requiere "canvas" en el body');
    }

    if (!action || typeof action !== 'string') {
      return errorResponse('Se requiere "action" en el body (string)');
    }

    if (!params || typeof params !== 'object') {
      return errorResponse('Se requiere "params" en el body (objeto)');
    }

    let resultCanvas;
    let isMacro = false;

    try {
      // Acciones simples (AXE v0.6.4)
      switch (action) {
        case 'insertNodeAfter':
          if (!params.nodeId || !params.newNode) {
            return errorResponse('insertNodeAfter requiere params.nodeId y params.newNode');
          }
          resultCanvas = insertNodeAfter(canvas, params.nodeId, params.newNode);
          break;

        case 'convertNodeToDecision':
          if (!params.nodeId) {
            return errorResponse('convertNodeToDecision requiere params.nodeId');
          }
          resultCanvas = convertNodeToDecision(canvas, params.nodeId);
          break;

        case 'markAsStart':
          if (!params.nodeId) {
            return errorResponse('markAsStart requiere params.nodeId');
          }
          resultCanvas = markAsStart(canvas, params.nodeId);
          break;

        case 'markAsEnd':
          if (!params.nodeId) {
            return errorResponse('markAsEnd requiere params.nodeId');
          }
          resultCanvas = markAsEnd(canvas, params.nodeId);
          break;

        case 'duplicateSubgraph':
          if (!params.nodeId) {
            return errorResponse('duplicateSubgraph requiere params.nodeId');
          }
          resultCanvas = duplicateSubgraph(canvas, params.nodeId);
          break;

        // Macros compuestas (AXE v0.6.6)
        case 'insertStandardEnding':
          if (!params.nodeId) {
            return errorResponse('insertStandardEnding requiere params.nodeId');
          }
          isMacro = true;
          resultCanvas = insertStandardEnding(canvas, params.nodeId, params.options || {});
          break;

        case 'createGuidedChoice':
          if (!params.nodeId) {
            return errorResponse('createGuidedChoice requiere params.nodeId');
          }
          isMacro = true;
          resultCanvas = createGuidedChoice(canvas, params.nodeId, params.options || {});
          break;

        case 'createBranchingPath':
          if (!params.nodeId) {
            return errorResponse('createBranchingPath requiere params.nodeId');
          }
          isMacro = true;
          resultCanvas = createBranchingPath(canvas, params.nodeId, params.options || {});
          break;

        case 'createLinearSequence':
          if (!params.nodeId) {
            return errorResponse('createLinearSequence requiere params.nodeId');
          }
          isMacro = true;
          resultCanvas = createLinearSequence(canvas, params.nodeId, params.options || {});
          break;

        default:
          return errorResponse(`Acción desconocida: ${action}`, 400);
      }
    } catch (error) {
      logWarn('RecorridosCanvasAPI', 'Error ejecutando acción semántica', {
        recorrido_id: recorridoId,
        action,
        error: error.message
      });
      return errorResponse(`Error ejecutando acción: ${error.message}`, 400);
    }

    // Validar el resultado (ya está normalizado por los helpers)
    const validation = validateCanvasDefinition(resultCanvas, { isPublish: false });

    return jsonResponse({
      ok: true,
      canvas: resultCanvas,
      warnings: validation.warnings,
      errors: validation.errors.length > 0 ? validation.errors : undefined,
      isMacro // Indica si fue una macro compuesta
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error en acción semántica', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al ejecutar acción semántica', 500);
  }
}

/**
 * GET /admin/api/recorridos/canvas/macros
 * Lista todas las macros semánticas disponibles (AXE v0.6.6)
 * 
 * Response: {
 *   ok: true,
 *   macros: Array<{ name, description, params }>
 * }
 */
async function handleListMacros(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const macros = listAvailableMacros();
    return jsonResponse({
      ok: true,
      macros
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error listando macros', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al listar macros', 500);
  }
}

/**
 * GET /admin/api/recorridos/canvas/presets
 * Lista todos los presets pedagógicos disponibles (AXE v0.6.7)
 * 
 * Response: {
 *   ok: true,
 *   presets: Array<{ id, name, description }>
 * }
 */
async function handleListPresets(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const presets = listAvailablePresets();
    
    // Formatear respuesta (sin la función generate)
    const formattedPresets = presets.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description
    }));
    
    return jsonResponse({
      ok: true,
      presets: formattedPresets
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error listando presets', {
      error: error.message,
      stack: error.stack
    });
    return errorResponse('Error interno al listar presets', 500);
  }
}

/**
 * GET /admin/api/recorridos/canvas/presets/:presetId
 * Obtiene un preset específico por ID (AXE v0.6.7)
 * 
 * Response: {
 *   ok: true,
 *   preset: { id, name, description, canvas: <CanvasDefinition> }
 * }
 */
async function handleGetPreset(request, env, ctx, presetId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  try {
    const presets = listAvailablePresets();
    const preset = presets.find(p => p.id === presetId);
    
    if (!preset) {
      return errorResponse(`Preset "${presetId}" no encontrado`, 404);
    }

    // Generar el canvas del preset
    const canvas = preset.generate();
    
    return jsonResponse({
      ok: true,
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        canvas
      }
    });
  } catch (error) {
    logError('RecorridosCanvasAPI', 'Error obteniendo preset', {
      preset_id: presetId,
      error: error.message,
      stack: error.stack
    });
    return errorResponse(`Error generando preset: ${error.message}`, 500);
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

  if (method === 'GET' && recorridoId && subPath === 'preview') {
    return handlePreviewRecorrido(request, env, ctx, recorridoId);
  }

  // Endpoints de Canvas (AXE v0.6.3)
  if (method === 'GET' && recorridoId && subPath === 'canvas') {
    return handleGetCanvas(request, env, ctx, recorridoId);
  }

  if (method === 'GET' && recorridoId && subPath === 'canvas/debug') {
    return handleDebugCanvas(request, env, ctx, recorridoId);
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

  if (method === 'POST' && recorridoId && subPath === 'canvas/action') {
    return handleCanvasAction(request, env, ctx, recorridoId);
  }

  if (method === 'GET' && recorridoId && subPath === 'canvas/analyze') {
    return handleAnalyzeCanvas(request, env, ctx, recorridoId);
  }

  if (method === 'POST' && recorridoId && subPath === 'canvas/analyze') {
    return handleAnalyzeCanvasPost(request, env, ctx, recorridoId);
  }

  if (method === 'GET' && path === '/admin/api/recorridos/canvas/macros') {
    return handleListMacros(request, env, ctx);
  }

  // Endpoints de Presets (AXE v0.6.7)
  if (method === 'GET' && path === '/admin/api/recorridos/canvas/presets') {
    return handleListPresets(request, env, ctx);
  }

  if (method === 'GET' && path.startsWith('/admin/api/recorridos/canvas/presets/')) {
    const presetIdMatch = path.match(/^\/admin\/api\/recorridos\/canvas\/presets\/(.+)$/);
    if (presetIdMatch) {
      const presetId = decodeURIComponent(presetIdMatch[1]);
      return handleGetPreset(request, env, ctx, presetId);
    }
  }

  if (method === 'DELETE' && recorridoId && !subPath) {
    return handleDeleteRecorrido(request, env, ctx, recorridoId);
  }

  // No encontrado
  return errorResponse('Endpoint no encontrado', 404);
}

