/**
 * MASTER SYSTEMA LEVELS GATES - AuriPortal Master
 * 
 * Pantalla de gestión global de Level Gates.
 * Permite listar, crear, editar y deprecar gates.
 * 
 * Ruta: /master/systema/levels/gates
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';
import { requireAdminContext } from '../core/auth-context.js';

export default async function masterSystemaLevelsGatesHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // Verificar autenticación
  const authResult = await requireAdminContext(request, env);
  if (!authResult.ok) {
    return authResult.response;
  }
  
  const contentHtml = `
    <div id="master-gates-content" style="padding: 2rem;">
      <h1>Gestión de Level Gates</h1>
      <p style="color: #666; margin-bottom: 1.5rem;">
        Gestiona los gates (bloqueos) de nivel para todas las líneas.
      </p>
      <div id="gates-loading" style="padding: 2rem; text-align: center;">
        <p>Cargando gates...</p>
      </div>
      <div id="gates-data" style="display: none;">
        <!-- Será poblado por master-gates-client.js -->
      </div>
      <div id="gates-error" style="display: none; color: #d32f2f; padding: 1rem; background: #ffebee; border-radius: 4px; margin-top: 1rem;">
        <!-- Errores se mostrarán aquí -->
      </div>
    </div>
  `;
  
  return renderMasterPage({
    title: 'Gestión de Level Gates — Systema',
    contentHtml,
    activePath,
    universeId: 'systema',
    extraScripts: [
      `<script>
        (function() {
          const apiBase = '/master/api';
          
          async function loadGates() {
            try {
              // Cargar líneas primero
              const linesRes = await fetch(\`\${apiBase}/levels/lines\`);
              const linesData = await linesRes.json();
              
              if (!linesData.ok) {
                throw new Error(linesData.error || 'Error cargando líneas');
              }
              
              const dataEl = document.getElementById('gates-data');
              const loadingEl = document.getElementById('gates-loading');
              
              if (dataEl && loadingEl) {
                loadingEl.style.display = 'none';
                dataEl.style.display = 'block';
                
                const container = document.createElement('div');
                container.className = 'gates-container';
                
                const title = document.createElement('h2');
                title.textContent = 'Líneas Disponibles';
                container.appendChild(title);
                
                if (linesData.data.lines && linesData.data.lines.length > 0) {
                  const list = document.createElement('ul');
                  linesData.data.lines.forEach(line => {
                    const item = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = \`#\${line.line_key}\`;
                    link.textContent = \`\${line.display_name || line.line_key} (\${line.line_key})\`;
                    item.appendChild(link);
                    list.appendChild(item);
                  });
                  container.appendChild(list);
                } else {
                  const empty = document.createElement('p');
                  empty.textContent = 'No hay líneas registradas.';
                  empty.style.color = '#666';
                  container.appendChild(empty);
                }
                
                dataEl.appendChild(container);
              }
            } catch (error) {
              const errorEl = document.getElementById('gates-error');
              const loadingEl = document.getElementById('gates-loading');
              
              if (errorEl && loadingEl) {
                loadingEl.style.display = 'none';
                errorEl.style.display = 'block';
                errorEl.textContent = 'Error: ' + error.message;
              }
            }
          }
          
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadGates);
          } else {
            loadGates();
          }
        })();
      </script>`
    ]
  });
}
