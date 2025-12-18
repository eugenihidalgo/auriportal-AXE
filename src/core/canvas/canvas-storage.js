// src/core/canvas/canvas-storage.js
// Helpers para persistencia y gestión de Canvas en Recorridos
// 
// Funciones:
// - getEffectiveCanvasForDraft: Obtiene canvas (persistido o derivado)
// - saveCanvasToDraft: Valida, normaliza y guarda canvas en draft

import { recorridoToCanvas } from './recorrido-to-canvas.js';
import { validateCanvasDefinition } from './validate-canvas-definition.js';
import { normalizeCanvasDefinition } from './normalize-canvas-definition.js';
import { repairUnreachableEndNodes } from './canvas-semantic-actions.js';
import { getDefaultRecorridoDraftRepo } from '../../infra/repos/recorrido-draft-repo-pg.js';
import { logInfo, logWarn } from '../observability/logger.js';

/**
 * Obtiene el canvas efectivo para un draft
 * 
 * - Si draft.canvas_json existe → devuelve ese (source: "draft")
 * - Si draft.canvas_json es null → deriva desde definition_json (source: "derived")
 * 
 * @param {Object} draft - Draft de recorrido (debe tener definition_json)
 * @returns {Object} { canvas, source, warnings }
 *   - canvas: CanvasDefinition normalizada
 *   - source: "draft" | "derived"
 *   - warnings: Array de warnings (si es derived, incluye warning)
 */
export function getEffectiveCanvasForDraft(draft) {
  if (!draft || !draft.definition_json) {
    throw new Error('Draft debe tener definition_json');
  }

  // Si hay canvas persistido, usarlo
  if (draft.canvas_json) {
    return {
      canvas: normalizeCanvasDefinition(draft.canvas_json),
      source: 'persisted',
      warnings: []
    };
  }

  // Si no hay canvas, derivar desde definition_json
  try {
    const derivedCanvas = recorridoToCanvas(draft.definition_json, { generatePositions: true });
    // AXE v0.6.9: Validar con isPublish=false para GET (más permisivo)
    const validation = validateCanvasDefinition(derivedCanvas, { isPublish: false });
    
    // Si hay errores críticos en validación, no normalizar (fallará más abajo)
    if (validation.errors.length > 0) {
      logWarn('CanvasStorage', 'Canvas derivado tiene errores de validación', {
        recorrido_id: draft.recorrido_id,
        draft_id: draft.draft_id,
        errors_count: validation.errors.length,
        errors: validation.errors
      });
      // Continuar intentando normalizar (puede que la normalización arregle algunos problemas)
    }
    
    const normalized = normalizeCanvasDefinition(derivedCanvas);
    
    logInfo('CanvasStorage', 'Canvas derivado desde definition_json', {
      recorrido_id: draft.recorrido_id,
      draft_id: draft.draft_id,
      warnings_count: validation.warnings?.length || 0
    });

    return {
      canvas: normalized,
      source: 'derived',
      warnings: [
        'Canvas no persistido todavía; se muestra derivado desde definition_json',
        ...(validation.warnings || [])
      ]
    };
  } catch (error) {
    logWarn('CanvasStorage', 'Error derivando canvas', {
      recorrido_id: draft.recorrido_id,
      draft_id: draft.draft_id,
      error: error.message
    });

    // Fail-open: devolver canvas mínimo válido en lugar de fallar
    const fallbackCanvas = {
      version: '1.0',
      canvas_id: draft.recorrido_id || '',
      name: 'Unnamed Canvas',
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', label: 'Inicio', position: { x: 80, y: 80 }, props: {} },
        { id: 'end', type: 'end', label: 'Fin', position: { x: 380, y: 80 }, props: {} }
      ],
      edges: [
        { id: 'e_start_end', type: 'direct', from_node_id: 'start', to_node_id: 'end' }
      ]
    };
    
    return {
      canvas: normalizeCanvasDefinition(fallbackCanvas),
      source: 'error-fallback',
      warnings: [
        `Error derivando canvas: ${error.message}. Se muestra canvas mínimo válido.`
      ]
    };
  }
}

/**
 * Valida, normaliza, repara y guarda canvas en draft
 * 
 * AXE v0.6.9+ - EDITOR MODE (fail-open):
 * - SIEMPRE guarda el canvas aunque tenga errores de validación
 * - Ejecuta repair de nodos inalcanzables antes de guardar
 * - Normaliza el canvas antes de guardar
 * - Devuelve errores y warnings en la respuesta (no bloquea)
 * 
 * @param {string} recorridoId - ID del recorrido
 * @param {Object} canvasInput - CanvasDefinition a guardar (puede no estar normalizado)
 * @param {Object} options - Opciones
 * @param {boolean} options.isPublish - Si es true, validación estricta (default: false)
 * @param {string|null} options.updated_by - ID/email del admin (opcional)
 * @param {Object} options.client - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} { ok, canvas_normalized, errors, warnings }
 *   - ok: true si no hay errores, false si hay errores (pero siempre guarda)
 *   - canvas_normalized: Canvas normalizado y reparado (siempre presente)
 *   - errors: Array de errores de validación (si los hay)
 *   - warnings: Array de warnings (si los hay)
 */
export async function saveCanvasToDraft(recorridoId, canvasInput, options = {}) {
  const { isPublish = false, updated_by = null, client = null } = options;

  if (!recorridoId || !canvasInput) {
    return {
      ok: false,
      errors: ['recorridoId y canvasInput son requeridos'],
      warnings: [],
      canvas_normalized: null
    };
  }

  // Validar canvas (para obtener errores y warnings)
  const validation = validateCanvasDefinition(canvasInput, { isPublish });

  // EDITOR MODE: SIEMPRE guardar aunque haya errores
  // 1. Reparar nodos END inalcanzables
  let repairedCanvas = repairUnreachableEndNodes(canvasInput);
  
  // 2. Normalizar canvas (SIEMPRE se guarda normalizado)
  const normalized = normalizeCanvasDefinition(repairedCanvas);

  // 3. Guardar en draft (incluso si hay errores)
  try {
    const draftRepo = getDefaultRecorridoDraftRepo();
    const draft = await draftRepo.getCurrentDraft(recorridoId, client);

    if (!draft) {
      logWarn('CanvasStorage', '[AXE][PUT_CANVAS][DB] No hay draft para este recorrido', {
        recorrido_id: recorridoId,
        schema: 'public',
        table: 'recorrido_drafts'
      });
      return {
        ok: false,
        errors: ['No hay draft para este recorrido'],
        warnings: validation.warnings || [],
        canvas_normalized: normalized
      };
    }

    // Actualizar canvas y verificar rowCount
    const updateResult = await draftRepo.updateCanvas(draft.draft_id, normalized, updated_by, client);
    const { draft: updatedDraft, rowCount } = updateResult;

    // REGLA CRÍTICA: rowCount === 0 significa que NO se persistió
    if (rowCount === 0) {
      logWarn('CanvasStorage', '[AXE][PUT_CANVAS][DB] UPDATE affected 0 rows', {
        recorrido_id: recorridoId,
        draft_id: draft.draft_id,
        schema: 'public',
        table: 'recorrido_drafts',
        where_clause: 'draft_id = $3',
        rowCount: 0,
        error: 'canvas_not_persisted'
      });

      return {
        ok: false,
        saved: false,
        source: 'derived',
        errors: [
          'canvas_not_persisted',
          'El UPDATE no afectó ninguna fila. El draft_id puede ser incorrecto o el draft no existe.',
          ...(validation.errors || [])
        ],
        warnings: validation.warnings || [],
        canvas_normalized: normalized
      };
    }

    // Log exitoso con detalles
    logInfo('CanvasStorage', '[AXE][PUT_CANVAS] Canvas guardado exitosamente (persisted)', {
      recorrido_id: recorridoId,
      draft_id: draft.draft_id,
      schema: 'public',
      table: 'recorrido_drafts',
      rowCount: rowCount,
      errors_count: validation.errors.length,
      warnings_count: validation.warnings?.length || 0,
      saved: true,
      persisted: true
    });

    return {
      ok: validation.errors.length === 0,
      saved: true,
      source: 'persisted',
      canvas_normalized: normalized,
      errors: validation.errors || [],
      warnings: validation.warnings || []
    };
  } catch (error) {
    logWarn('CanvasStorage', '[AXE][PUT_CANVAS] Error guardando canvas', {
      recorrido_id: recorridoId,
      error: error.message,
      stack: error.stack
    });

    return {
      ok: false,
      saved: false,
      source: 'derived',
      errors: [`Error guardando canvas: ${error.message}`, ...(validation.errors || [])],
      warnings: validation.warnings || [],
      canvas_normalized: normalized
    };
  }
}


