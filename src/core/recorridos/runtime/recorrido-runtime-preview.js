// src/core/recorridos/runtime/recorrido-runtime-preview.js
// Helper para construir renderSpec en modo preview (sin run real)
//
// RESPONSABILIDAD:
// - Construir renderSpec para preview usando mock data
// - Simular handlers sin ejecutar lógica real
// - Fail-open: si algo falla, devolver renderSpec básico
//
// SPRINT AXE v0.3 - Preview Harness Unificado
// - Soporta PreviewContext normalizado
// - Integración con Mock Profiles

import { logInfo, logWarn } from '../../observability/logger.js';
import { normalizePreviewContext } from '../../preview/preview-context.js';

/**
 * Construye renderSpec de un step para preview
 * 
 * @param {Object} step - Step definition
 * @param {string} step_id - ID del step
 * @param {Object} mockOrContext - Datos mock (legacy) o PreviewContext (nuevo)
 * @returns {Promise<Object>} RenderSpec { step_id, step_type, screen_template_id, props, uiHints? }
 */
export async function buildRenderSpecForPreview(step, step_id, mockOrContext = {}) {
  // Detectar si es PreviewContext (tiene preview_mode) o mock legacy
  let previewContext = null;
  let mock = {};

  if (mockOrContext.preview_mode === true) {
    // Es un PreviewContext normalizado
    const { context, warnings } = normalizePreviewContext(mockOrContext);
    previewContext = context;
    
    if (warnings.length > 0) {
      logWarn('RecorridoRuntimePreview', 'Warnings normalizando PreviewContext', {
        step_id,
        warnings_count: warnings.length
      });
    }

    // Extraer datos relevantes para el mock (compatibilidad)
    mock = {
      nivel_efectivo: previewContext.student?.nivel_efectivo,
      energia: previewContext.student?.energia,
      racha: previewContext.student?.racha,
      estado: previewContext.student?.estado,
      ...previewContext.flags
    };
  } else {
    // Legacy: mock data directo
    mock = mockOrContext;
  }

  // RenderSpec base
  let renderSpec = {
    step_id,
    step_type: step.step_type || 'experience',
    screen_template_id: step.screen_template_id,
    props: step.props || {},
    uiHints: step.uiHints || {}
  };

  // Si el step tiene handler, intentar enriquecer con mock
  // Por ahora, solo devolvemos el renderSpec base
  // Los handlers reales se ejecutarían en runtime con datos reales
  
  // TODO: En el futuro, podríamos simular handlers específicos aquí
  // Por ejemplo, si step_id === 'limpieza_energetica', podríamos añadir
  // datos mock de transmutaciones basados en mock.tipo_limpieza
  
  logInfo('RecorridoRuntimePreview', 'RenderSpec construido para preview', {
    step_id,
    screen_template_id: step.screen_template_id,
    has_preview_context: !!previewContext,
    has_mock: Object.keys(mock).length > 0
  });
  
  return renderSpec;
}

export default { buildRenderSpecForPreview };

