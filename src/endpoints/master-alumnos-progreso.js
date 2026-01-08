/**
 * MASTER ALUMNOS PROGRESO - AuriPortal Master
 * 
 * Pantalla de Progreso del Alumno (sección mayor).
 * Muestra niveles, fases, gates, historial y diagnóstico.
 * 
 * Ruta: /master/alumnos/:student_uuid/progreso
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';
import { requireAdminContext } from '../core/auth-context.js';

export default async function masterAlumnosProgresoHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // Verificar autenticación
  const authResult = await requireAdminContext(request, env);
  if (!authResult.ok) {
    return authResult.response;
  }
  
  // Extraer student_uuid del path
  const pathParts = activePath.split('/').filter(Boolean);
  const studentUuidIndex = pathParts.indexOf('alumnos') + 1;
  const studentUuid = pathParts[studentUuidIndex] || null;
  
  if (!studentUuid) {
    return renderMasterPage({
      title: 'Error — Progreso del Alumno',
      contentHtml: `
        <div style="padding: 2rem;">
          <h1>Error</h1>
          <p>No se proporcionó student_uuid en la URL.</p>
        </div>
      `,
      activePath,
      universeId: 'u_alumnos'
    });
  }
  
  // HTML básico que será poblado por el cliente JS
  const contentHtml = `
    <div id="master-progreso-content" style="padding: 2rem;">
      <h1>Progreso del Alumno</h1>
      <p style="color: #666; margin-bottom: 1.5rem;">
        Estado de niveles, fases, gates y progresión para el alumno.
      </p>
      <div id="progreso-loading" style="padding: 2rem; text-align: center;">
        <p>Cargando datos de progreso...</p>
      </div>
      <div id="progreso-data" style="display: none;">
        <!-- Será poblado por master-progreso-client.js -->
      </div>
      <div id="progreso-error" style="display: none; color: #d32f2f; padding: 1rem; background: #ffebee; border-radius: 4px; margin-top: 1rem;">
        <!-- Errores se mostrarán aquí -->
      </div>
    </div>
  `;
  
  return renderMasterPage({
    title: `Progreso del Alumno — ${studentUuid.substring(0, 8)}...`,
    contentHtml,
    activePath,
    universeId: 'u_alumnos',
    extraScripts: [
      // Script cliente que consumirá APIs MASTER
      `<script>
        (function() {
          const studentUuid = '${studentUuid}';
          const apiBase = '/master/api';
          
          async function loadProgreso() {
            try {
              // Cargar niveles del estudiante
              const levelsRes = await fetch(\`\${apiBase}/students/\${studentUuid}/levels\`);
              const levelsData = await levelsRes.json();
              
              if (!levelsData.ok) {
                throw new Error(levelsData.error || 'Error cargando niveles');
              }
              
              // Renderizar datos
              const dataEl = document.getElementById('progreso-data');
              const loadingEl = document.getElementById('progreso-loading');
              
              if (dataEl && loadingEl) {
                loadingEl.style.display = 'none';
                dataEl.style.display = 'block';
                
                // Renderizar usando DOM API (sin innerHTML dinámico)
                const container = document.createElement('div');
                container.className = 'progreso-container';
                
                const title = document.createElement('h2');
                title.textContent = 'Estados de Nivel';
                container.appendChild(title);
                
                if (levelsData.data.levels && levelsData.data.levels.length > 0) {
                  const list = document.createElement('ul');
                  levelsData.data.levels.forEach(level => {
                    const item = document.createElement('li');
                    item.textContent = \`Línea: \${level.line_key}, Nivel: \${level.current_level_number || 'N/A'}, Días: \${level.computed_days}, Estado: \${level.upgrade_status}\`;
                    list.appendChild(item);
                  });
                  container.appendChild(list);
                } else {
                  const empty = document.createElement('p');
                  empty.textContent = 'No hay estados de nivel registrados.';
                  empty.style.color = '#666';
                  container.appendChild(empty);
                }
                
                dataEl.appendChild(container);
              }
            } catch (error) {
              const errorEl = document.getElementById('progreso-error');
              const loadingEl = document.getElementById('progreso-loading');
              
              if (errorEl && loadingEl) {
                loadingEl.style.display = 'none';
                errorEl.style.display = 'block';
                errorEl.textContent = 'Error: ' + error.message;
              }
            }
          }
          
          // Cargar cuando el DOM esté listo
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadProgreso);
          } else {
            loadProgreso();
          }
        })();
      </script>`
    ]
  });
}
