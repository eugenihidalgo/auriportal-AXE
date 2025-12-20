// screen-template-renderer.js
// Runtime Renderer de Screen Templates v1
//
// PRINCIPIOS:
// 1. Fail-open absoluto: si algo falla, devuelve HTML básico válido
// 2. Validación suave: valida props contra schema pero no bloquea
// 3. Integración con Theme Resolver: aplica tema automáticamente
// 4. NO lógica de negocio: solo renderiza HTML
// 5. NO persistencia: solo renderiza, no guarda nada
//
// SPRINT AXE v0.5 - Screen Templates v1

import { getDefaultScreenTemplateVersionRepo } from '../../infra/repos/screen-template-version-repo-pg.js';
import { validatePropsAgainstSchema } from './screen-template-definition-contract.js';
import { applyTheme } from '../responses.js';
import { logWarn, logError } from '../observability/logger.js';

/**
 * Renderiza un screen template con props dadas
 * 
 * Fail-open: si el template no existe o hay errores, devuelve HTML básico válido
 * 
 * @param {string} screen_template_id - ID del template a renderizar
 * @param {Object} props - Props para el template (validadas contra schema)
 * @param {Object|null} [student] - Objeto estudiante (opcional, para tema)
 * @param {string|null} [theme_id] - ID del tema a usar (opcional, para preview)
 * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
 * @returns {Promise<string>} HTML renderizado con tema aplicado
 */
export async function renderScreenTemplate(screen_template_id, props = {}, student = null, theme_id = null, client = null) {
  try {
    // PASO 1: Obtener versión publicada del template
    const versionRepo = getDefaultScreenTemplateVersionRepo();
    const version = await versionRepo.getLatestVersion(screen_template_id, client);

    if (!version || !version.definition_json) {
      logWarn('ScreenTemplateRenderer', `Template '${screen_template_id}' no encontrado, usando fallback`, { screen_template_id });
      return renderFallbackHtml(screen_template_id, props, student, theme_id);
    }

    const definition = version.definition_json;

    // PASO 2: Validar props contra schema (fail-open: solo warnings)
    const schema = definition.schema || {};
    const validation = validatePropsAgainstSchema(props, schema);
    
    if (validation.warnings.length > 0) {
      logWarn('ScreenTemplateRenderer', `Warnings en validación de props para '${screen_template_id}'`, {
        screen_template_id,
        warnings: validation.warnings
      });
    }

    // PASO 3: Renderizar HTML desde el template
    // Por ahora, el template debe tener un campo 'html_template' o similar
    // En el futuro, esto puede ser más sofisticado (compilación, slots, etc.)
    let html = '';
    
    if (definition.html_template) {
      // Si el template tiene HTML directo, usarlo
      html = definition.html_template;
    } else if (definition.template_function) {
      // Si tiene función de template, ejecutarla (futuro)
      logWarn('ScreenTemplateRenderer', `template_function no soportado aún para '${screen_template_id}'`, { screen_template_id });
      html = renderFallbackHtml(screen_template_id, props, student, theme_id);
    } else {
      // Si no tiene HTML, usar fallback
      logWarn('ScreenTemplateRenderer', `Template '${screen_template_id}' no tiene html_template, usando fallback`, { screen_template_id });
      html = renderFallbackHtml(screen_template_id, props, student, theme_id);
    }

    // PASO 4: Reemplazar placeholders con props
    html = replacePlaceholders(html, props);

    // PASO 5: Aplicar tema usando Theme Resolver
    html = applyTheme(html, student, theme_id);

    return html;

  } catch (error) {
    // Fail-open: si algo falla, devolver HTML básico válido
    logError('ScreenTemplateRenderer', `Error renderizando template '${screen_template_id}'`, {
      screen_template_id,
      error: error.message,
      stack: error.stack
    });
    
    return renderFallbackHtml(screen_template_id, props, student, theme_id);
  }
}

/**
 * Reemplaza placeholders en HTML con valores de props
 * 
 * @param {string} html - HTML con placeholders
 * @param {Object} props - Props para reemplazar
 * @returns {string} HTML con placeholders reemplazados
 */
function replacePlaceholders(html, props) {
  let output = html;
  
  // Reemplazar placeholders estilo {{PROP_NAME}}
  for (const [key, value] of Object.entries(props)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    const safeValue = value !== null && value !== undefined ? String(value) : '';
    output = output.replace(regex, safeValue);
  }

  // Reemplazar placeholders estilo {{PROP_NAME|default}} con valores por defecto
  const defaultRegex = /\{\{(\w+)\|([^}]+)\}\}/g;
  output = output.replace(defaultRegex, (match, propName, defaultValue) => {
    if (props[propName] !== null && props[propName] !== undefined) {
      return String(props[propName]);
    }
    return defaultValue;
  });

  return output;
}

/**
 * Renderiza HTML fallback cuando el template no existe o falla
 * 
 * @param {string} screen_template_id - ID del template
 * @param {Object} props - Props
 * @param {Object|null} student - Estudiante
 * @param {string|null} theme_id - ID del tema
 * @returns {string} HTML fallback válido
 */
function renderFallbackHtml(screen_template_id, props, student, theme_id) {
  const title = props.title || 'Pantalla';
  const content = props.content || 'Contenido no disponible';
  
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <div style="padding: 2rem; max-width: 800px; margin: 0 auto;">
    <h1>${title}</h1>
    <p>${content}</p>
    <p style="color: #666; font-size: 0.9rem; margin-top: 2rem;">
      Template: ${screen_template_id}
    </p>
  </div>
</body>
</html>
  `.trim();

  // Aplicar tema al fallback también
  return applyTheme(html, student, theme_id);
}

/**
 * Renderiza un screen template en modo preview
 * Usa PreviewContext para simular contexto de estudiante
 * 
 * @param {string} screen_template_id - ID del template
 * @param {Object} props - Props para el template
 * @param {Object} previewContext - PreviewContext (de Preview Harness)
 * @param {string|null} [theme_id] - ID del tema a usar
 * @returns {Promise<string>} HTML renderizado con tema aplicado
 */
export async function renderScreenTemplatePreview(screen_template_id, props = {}, previewContext = null, theme_id = null) {
  // Crear objeto estudiante simulado desde PreviewContext
  const mockStudent = previewContext && previewContext.student ? {
    tema_preferido: previewContext.student.tema_preferido || null,
    nivel: previewContext.student.nivel || '1',
    nombre: previewContext.student.nombre || 'Estudiante Preview'
  } : null;

  // Renderizar con estudiante simulado
  return renderScreenTemplate(screen_template_id, props, mockStudent, theme_id);
}





