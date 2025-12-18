// src/core/canvas/canvas-storage.js
// Helpers para persistencia y gestión de Canvas en Recorridos
// 
// Funciones:
// - getEffectiveCanvasForDraft: Obtiene canvas (persistido o derivado)
// - saveCanvasToDraft: Valida, normaliza y guarda canvas en draft

import { recorridoToCanvas } from './recorrido-to-canvas.js';
import { validateCanvasDefinition } from './validate-canvas-definition.js';
import { normalizeCanvasDefinition } from './normalize-canvas-definition.js';
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
      source: 'draft',
      warnings: []
    };
  }

  // Si no hay canvas, derivar desde definition_json
  try {
    const derivedCanvas = recorridoToCanvas(draft.definition_json, { generatePositions: true });
    const normalized = normalizeCanvasDefinition(derivedCanvas);
    
    logInfo('CanvasStorage', 'Canvas derivado desde definition_json', {
      recorrido_id: draft.recorrido_id,
      draft_id: draft.draft_id
    });

    return {
      canvas: normalized,
      source: 'derived',
      warnings: [
        'Canvas no persistido todavía; se muestra derivado desde definition_json'
      ]
    };
  } catch (error) {
    logWarn('CanvasStorage', 'Error derivando canvas', {
      recorrido_id: draft.recorrido_id,
      draft_id: draft.draft_id,
      error: error.message
    });

    // Fail-open: devolver canvas vacío en lugar de fallar
    return {
      canvas: normalizeCanvasDefinition({
        version: '1.0',
        canvas_id: draft.recorrido_id || '',
        name: 'Unnamed Canvas',
        entry_node_id: 'start',
        nodes: [{ id: 'start', type: 'start', label: 'Inicio', position: { x: 0, y: 0 }, props: {} }],
        edges: []
      }),
      source: 'derived',
      warnings: [
        `Error derivando canvas: ${error.message}. Se muestra canvas vacío.`
      ]
    };
  }
}

/**
 * Valida, normaliza y guarda canvas en draft
 * 
 * - Valida canvas con validateCanvasDefinition
 * - Si hay errors bloqueantes → retorna error (no guarda)
 * - Si ok → normaliza y guarda en draft.canvas_json + canvas_updated_at
 * 
 * @param {string} recorridoId - ID del recorrido
 * @param {Object} canvasInput - CanvasDefinition a guardar (puede no estar normalizado)
 * @param {Object} options - Opciones
 * @param {boolean} options.isPublish - Si es true, validación estricta (default: false)
 * @param {string|null} options.updated_by - ID/email del admin (opcional)
 * @param {Object} options.client - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<Object>} { ok, canvas_normalized, errors, warnings }
 */
export async function saveCanvasToDraft(recorridoId, canvasInput, options = {}) {
  const { isPublish = false, updated_by = null, client = null } = options;

  if (!recorridoId || !canvasInput) {
    return {
      ok: false,
      errors: ['recorridoId y canvasInput son requeridos'],
      warnings: []
    };
  }

  // Validar canvas
  const validation = validateCanvasDefinition(canvasInput, { isPublish });

  // Si hay errors bloqueantes, no guardar
  if (validation.errors.length > 0) {
    logWarn('CanvasStorage', 'Guardado bloqueado: canvas inválido', {
      recorrido_id: recorridoId,
      errors_count: validation.errors.length,
      is_publish: isPublish
    });

    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
      canvas_normalized: null
    };
  }

  // Normalizar canvas (SIEMPRE se guarda normalizado)
  const normalized = normalizeCanvasDefinition(canvasInput);

  // Guardar en draft
  try {
    const draftRepo = getDefaultRecorridoDraftRepo();
    const draft = await draftRepo.getCurrentDraft(recorridoId, client);

    if (!draft) {
      return {
        ok: false,
        errors: ['No hay draft para este recorrido'],
        warnings: []
      };
    }

    await draftRepo.updateCanvas(draft.draft_id, normalized, updated_by, client);

    logInfo('CanvasStorage', 'Canvas guardado exitosamente', {
      recorrido_id: recorridoId,
      draft_id: draft.draft_id,
      warnings_count: validation.warnings.length
    });

    return {
      ok: true,
      canvas_normalized: normalized,
      errors: [],
      warnings: validation.warnings
    };
  } catch (error) {
    logWarn('CanvasStorage', 'Error guardando canvas', {
      recorrido_id: recorridoId,
      error: error.message
    });

    return {
      ok: false,
      errors: [`Error guardando canvas: ${error.message}`],
      warnings: validation.warnings
    };
  }
}

