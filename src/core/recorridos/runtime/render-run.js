// src/core/recorridos/runtime/render-run.js
// Renderizador de HTML para runtime de recorridos (alumno)
//
// RESPONSABILIDAD:
// - Renderizar HTML completo del step actual
// - Aplicar Theme Resolver v1
// - Layout limpio sin admin
// - Inyectar JavaScript para navegación

import { renderStepHTML } from './step-renderer.js';
import { applyTheme } from '../../responses.js';
import { resolveTheme } from '../../theme/theme-resolver.js';
import { logError, logWarn } from '../../observability/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Renderiza HTML completo de un run de recorrido
 * 
 * @param {Object} params
 * @param {Object} params.definition - RecorridoDefinition
 * @param {Object} params.step - Step actual a renderizar
 * @param {Object} params.run - Run actual
 * @param {Object} params.student - Estudiante (opcional)
 * @returns {Promise<string>} HTML completo
 */
export async function renderRunHTML({ definition, step, run, student = null }) {
  try {
    if (!step) {
      return renderCompletedHTML(definition, run);
    }

    // Renderizar HTML del step usando step-renderer
    const stepHTML = await renderStepHTML({
      screen_template_id: step.screen_template_id,
      props: step.props || {},
      context: run.state_json || {},
      run_id: run.run_id,
      step_id: run.current_step_id
    });

    // Construir renderSpec para el step
    const renderSpec = {
      screen_template_id: step.screen_template_id,
      props: step.props || {},
      context: run.state_json || {},
      run_id: run.run_id,
      step_id: run.current_step_id
    };

    // Obtener tema usando Theme Resolver v1
    const themeEffective = resolveTheme({ student });

    // Construir HTML completo con layout alumno
    const html = buildRunLayoutHTML({
      stepHTML,
      renderSpec,
      definition,
      run,
      themeEffective,
      student
    });

    // Aplicar tema usando applyTheme (que usa Theme Resolver v1 internamente)
    const finalHTML = applyTheme(html, student);

    return finalHTML;

  } catch (error) {
    logError('RenderRun', 'Error renderizando run HTML', {
      error: error.message,
      stack: error.stack
    });
    return renderErrorHTML(error.message);
  }
}

/**
 * Construye el layout HTML completo del run
 */
function buildRunLayoutHTML({ stepHTML, renderSpec, definition, run, themeEffective, student }) {
  // Cargar template base del layout alumno
  const layoutPath = join(__dirname, '../../../html/layouts/recorrido-run.html');
  let layoutHTML;
  
  try {
    layoutHTML = readFileSync(layoutPath, 'utf-8');
  } catch (e) {
    // Si no existe el template, usar layout básico inline
    layoutHTML = getDefaultLayoutHTML();
  }

  // Reemplazar placeholders
  layoutHTML = layoutHTML.replace('{{STEP_CONTENT}}', stepHTML);
  layoutHTML = layoutHTML.replace('{{RECORRIDO_ID}}', definition.id || '');
  layoutHTML = layoutHTML.replace('{{RUN_ID}}', run.run_id || '');
  layoutHTML = layoutHTML.replace('{{STEP_ID}}', run.current_step_id || '');

  // Inyectar JavaScript para navegación
  const navigationScript = buildNavigationScript(definition, run);
  layoutHTML = layoutHTML.replace('{{NAVIGATION_SCRIPT}}', navigationScript);

  // Inyectar contexto en window
  const contextScript = `
    <script>
      window.RECORRIDO_CONTEXT = ${JSON.stringify(run.state_json || {})};
      window.RECORRIDO_RUN_ID = ${JSON.stringify(run.run_id || null)};
      window.RECORRIDO_STEP_ID = ${JSON.stringify(run.current_step_id || null)};
      window.RECORRIDO_ID = ${JSON.stringify(definition.id || null)};
    </script>
  `;
  layoutHTML = layoutHTML.replace('{{CONTEXT_SCRIPT}}', contextScript);

  return layoutHTML;
}

/**
 * Construye el script de navegación para el step
 */
function buildNavigationScript(definition, run) {
  const currentStep = definition.steps[run.current_step_id];
  if (!currentStep) {
    return '';
  }

  // Obtener URL base del recorrido
  const recorridoSlug = definition.id;
  const nextUrl = `/r/${recorridoSlug}/next`;

  // Script para manejar formularios y navegación
  return `
    <script>
      (function() {
        'use strict';
        
        // Auto-submit de formularios al hacer click en botones/opciones
        document.addEventListener('DOMContentLoaded', function() {
          // Buscar botones de opción (screen_choice, screen_choice_cards)
          const choiceButtons = document.querySelectorAll('.choice-button, .choice-card');
          choiceButtons.forEach(function(button) {
            button.addEventListener('click', function() {
              const choiceId = this.dataset.choiceId || this.closest('[data-choice-id]')?.dataset.choiceId;
              if (choiceId) {
                submitNext({ choice_id: choiceId });
              } else {
                submitNext({});
              }
            });
          });

          // Buscar formularios
          const forms = document.querySelectorAll('form[data-recorrido-next]');
          forms.forEach(function(form) {
            form.addEventListener('submit', function(e) {
              e.preventDefault();
              const formData = new FormData(form);
              const data = {};
              for (const [key, value] of formData.entries()) {
                data[key] = value;
              }
              submitNext(data);
            });
          });

          // Buscar botones con data-next
          const nextButtons = document.querySelectorAll('[data-next]');
          nextButtons.forEach(function(button) {
            button.addEventListener('click', function() {
              submitNext({});
            });
          });
        });

        function submitNext(capture) {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = '${nextUrl}';
          
          for (const [key, value] of Object.entries(capture)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
          }
          
          document.body.appendChild(form);
          form.submit();
        }
      })();
    </script>
  `;
}

/**
 * HTML por defecto si no existe template
 */
function getDefaultLayoutHTML() {
  return `<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recorrido</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: var(--bg-primary, #1a1a1a);
      color: var(--text-primary, #ffffff);
      padding: 20px;
      min-height: 100vh;
    }
    .recorrido-container {
      max-width: 800px;
      margin: 0 auto;
    }
    {{STEP_CONTENT}}
  </style>
  {{CONTEXT_SCRIPT}}
</head>
<body>
  <div class="recorrido-container">
    {{STEP_CONTENT}}
  </div>
  {{NAVIGATION_SCRIPT}}
</body>
</html>`;
}

/**
 * Renderiza HTML cuando el recorrido está completado
 */
function renderCompletedHTML(definition, run) {
  return `<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recorrido Completado</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: var(--bg-primary, #1a1a1a);
      color: var(--text-primary, #ffffff);
      padding: 40px 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .completed-message {
      text-align: center;
      max-width: 600px;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 20px;
    }
    p {
      font-size: 1.2rem;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="completed-message">
    <h1>✓ Recorrido Completado</h1>
    <p>Has completado este recorrido exitosamente.</p>
  </div>
</body>
</html>`;
}

/**
 * Renderiza HTML de error
 */
function renderErrorHTML(errorMessage) {
  return `<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Error</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: var(--bg-primary, #1a1a1a);
      color: var(--text-primary, #ffffff);
      padding: 40px 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .error-message {
      text-align: center;
      max-width: 600px;
      padding: 20px;
      background: var(--bg-card, #2a2a2a);
      border-radius: 8px;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 10px;
      color: var(--text-error, #ff6b6b);
    }
    p {
      font-size: 1rem;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="error-message">
    <h1>Error</h1>
    <p>${escapeHtml(errorMessage)}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  if (typeof text !== 'string') {
    return String(text);
  }
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}




