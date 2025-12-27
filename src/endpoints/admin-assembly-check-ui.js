// src/endpoints/admin-assembly-check-ui.js
// Assembly Check System UI - AuriPortal
//
// PROPÓSITO:
// UI visible en /admin/system/assembly para verificar ensamblaje de Admin UIs.
//
// REGLAS:
// - requireAdminContext() obligatorio
// - Usa renderAdminPage()
// - Sidebar visible
// - Empty-state correcto
// - Tabla con resultados

import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import * as checkRepo from '../infra/repos/assembly-check-repo-pg.js';
import * as runRepo from '../infra/repos/assembly-check-run-repo-pg.js';
import * as resultRepo from '../infra/repos/assembly-check-result-repo-pg.js';
import { logError } from '../core/observability/logger.js';

/**
 * Handler para GET /admin/system/assembly
 * UI visible para el Assembly Check System
 */
export default async function adminAssemblyCheckUIHandler(request, env, ctx) {
  try {
    // Autenticación
    const authCtx = await requireAdminContext(request, env);
    if (!authCtx || !authCtx.isAdmin) {
      // requireAdminContext ya devolvió la respuesta de login si no está autenticado
      return;
    }
    
    const url = new URL(request.url);
    const activePath = url.pathname;
    
    // Obtener datos para la UI
    let checks = [];
    let lastCompletedRun = null;
    let lastRunResults = [];
    let checksWithStatus = [];
    
    try {
      checks = await checkRepo.getAllChecks();
      const enabledChecks = checks.filter(c => c.enabled && !c.deleted_at);
      
      // Obtener SOLO el último run completed (no mezclar histórico)
      lastCompletedRun = await runRepo.getLastCompletedRun();
      
      // Si hay un run completed, obtener sus resultados
      if (lastCompletedRun) {
        lastRunResults = await resultRepo.getResultsByRunId(lastCompletedRun.run_id);
      }
      
      // Obtener últimos resultados por check (del último run completed)
      checksWithStatus = await Promise.all(
        enabledChecks.map(async (check) => {
          // Si hay un run completed, usar sus resultados
          const resultInLastRun = lastRunResults.find(r => r.check_id === check.id);
          if (resultInLastRun) {
            return {
              ...check,
              last_status: resultInLastRun.status,
              last_code: resultInLastRun.code,
              last_checked_at: resultInLastRun.checked_at,
              last_duration_ms: resultInLastRun.duration_ms
            };
          }
          // Si no hay resultado en el último run, no mostrar estado
          return {
            ...check,
            last_status: null,
            last_code: null,
            last_checked_at: null,
            last_duration_ms: null
          };
        })
      );
    } catch (error) {
      logError('AssemblyCheckUI', 'Error obteniendo datos', {
        error: error.message,
        stack: error.stack
      });
    }
    
    // Construir HTML del contenido
    const contentHtml = `
      <div class="admin-container" style="padding: 2rem;">
        <div style="margin-bottom: 2rem;">
          <h1 style="margin: 0 0 0.5rem 0; font-size: 2rem; font-weight: 600;">
            🔍 Assembly Check System (ACS)
          </h1>
          <p style="color: #6b7280; margin: 0;">
            Verifica el ensamblaje real de Admin UIs. Detecta errores antes de que lleguen al usuario.
          </p>
        </div>
        
        <div style="margin-bottom: 2rem; display: flex; gap: 1rem; align-items: center;">
          <button 
            id="run-assembly-check-btn" 
            style="
              padding: 0.75rem 1.5rem;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 0.5rem;
              font-size: 1rem;
              font-weight: 500;
              cursor: pointer;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#2563eb'"
            onmouseout="this.style.background='#3b82f6'"
          >
            ▶️ Ejecutar Assembly Check
          </button>
          <button 
            id="initialize-checks-btn" 
            style="
              padding: 0.75rem 1.5rem;
              background: #10b981;
              color: white;
              border: none;
              border-radius: 0.5rem;
              font-size: 1rem;
              font-weight: 500;
              cursor: pointer;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#059669'"
            onmouseout="this.style.background='#10b981'"
          >
            🔄 Inicializar Checks
          </button>
          <div id="status-message" style="margin-left: auto; font-size: 0.875rem; color: #6b7280;"></div>
        </div>
        
        ${lastCompletedRun ? `
          <div style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Último Run Completado</h2>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <div style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Run ID</div>
                  <div style="font-family: monospace; font-size: 0.875rem; color: #111827; font-weight: 500;">${lastCompletedRun.run_id}</div>
                </div>
                <div>
                  <div style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Fecha</div>
                  <div style="font-size: 0.875rem; color: #111827;">${new Date(lastCompletedRun.completed_at).toLocaleString('es-ES')}</div>
                </div>
                <div>
                  <div style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Duración</div>
                  <div style="font-size: 0.875rem; color: #111827;">
                    ${lastCompletedRun.started_at && lastCompletedRun.completed_at 
                      ? `${Math.round((new Date(lastCompletedRun.completed_at) - new Date(lastCompletedRun.started_at)) / 1000)}s`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Estado</div>
                  <div style="font-size: 0.875rem; color: #10b981; font-weight: 500;">✅ Completado</div>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                <div style="text-align: center;">
                  <div style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 0.25rem;">${lastCompletedRun.total_checks || 0}</div>
                  <div style="font-size: 0.75rem; color: #6b7280;">Total</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 1.5rem; font-weight: 600; color: #10b981; margin-bottom: 0.25rem;">${lastCompletedRun.checks_ok || 0}</div>
                  <div style="font-size: 0.75rem; color: #6b7280;">✅ OK</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 1.5rem; font-weight: 600; color: #f59e0b; margin-bottom: 0.25rem;">${lastCompletedRun.checks_warn || 0}</div>
                  <div style="font-size: 0.75rem; color: #6b7280;">⚠️ WARN</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 1.5rem; font-weight: 600; color: #ef4444; margin-bottom: 0.25rem;">${lastCompletedRun.checks_broken || 0}</div>
                  <div style="font-size: 0.75rem; color: #6b7280;">❌ BROKEN</div>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <div style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Último Run Completado</h2>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 3rem; text-align: center;">
              <p style="color: #6b7280; margin: 0;">No hay runs completados todavía. Ejecuta un Assembly Check para ver resultados.</p>
            </div>
          </div>
        `}
        
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Checks Registrados</h2>
          ${checksWithStatus.length > 0 ? `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                    <th style="padding: 0.75rem; text-align: left; font-weight: 600; font-size: 0.875rem;">UI Key</th>
                    <th style="padding: 0.75rem; text-align: left; font-weight: 600; font-size: 0.875rem;">Ruta</th>
                    <th style="padding: 0.75rem; text-align: left; font-weight: 600; font-size: 0.875rem;">Flag</th>
                    <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.875rem;">Sidebar</th>
                    <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.875rem;">Estado</th>
                    <th style="padding: 0.75rem; text-align: left; font-weight: 600; font-size: 0.875rem;">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  ${checksWithStatus.map(check => {
                    const statusColor = check.last_status === 'OK' ? '#10b981' : check.last_status === 'WARN' ? '#f59e0b' : check.last_status === 'BROKEN' ? '#ef4444' : '#6b7280';
                    const statusText = check.last_status === 'OK' ? '✅ OK' : check.last_status === 'WARN' ? '⚠️ WARN' : check.last_status === 'BROKEN' ? '❌ BROKEN' : '⏸️ Sin ejecutar';
                    const duration = check.last_duration_ms ? `${check.last_duration_ms}ms` : '—';
                    return `
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 0.75rem; font-family: monospace; font-size: 0.875rem;">${check.ui_key}</td>
                        <td style="padding: 0.75rem; font-size: 0.875rem;">
                          <a href="${check.route_path}" target="_blank" style="color: #3b82f6; text-decoration: none;">${check.route_path}</a>
                        </td>
                        <td style="padding: 0.75rem; font-size: 0.875rem;">${check.feature_flag_key || '—'}</td>
                        <td style="padding: 0.75rem; text-align: center;">${check.expected_sidebar ? '✅' : '—'}</td>
                        <td style="padding: 0.75rem; text-align: center;">
                          <span style="color: ${statusColor}; font-weight: 500;">${statusText}</span>
                        </td>
                        <td style="padding: 0.75rem; font-size: 0.875rem; color: #6b7280; font-family: monospace;">${duration}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 3rem; text-align: center;">
              <p style="color: #6b7280; margin: 0;">No hay checks registrados. Haz clic en "Inicializar Checks" para crear checks automáticamente desde el Admin Route Registry.</p>
            </div>
          `}
        </div>
      </div>
      
      <script>
        // Handler para ejecutar assembly check
        // Espera a que termine el run antes de mostrar resultados
        document.getElementById('run-assembly-check-btn').addEventListener('click', async () => {
          const btn = document.getElementById('run-assembly-check-btn');
          const statusMsg = document.getElementById('status-message');
          
          btn.disabled = true;
          btn.textContent = '⏳ Ejecutando...';
          statusMsg.textContent = 'Ejecutando checks...';
          statusMsg.style.color = '#f59e0b';
          
          try {
            // 1. Iniciar ejecución
            const runResponse = await fetch('/admin/api/assembly/run', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            const runData = await runResponse.json();
            
            if (!runData.ok) {
              const errorMsg = runData.error || 'Error desconocido';
              statusMsg.textContent = '❌ Error: ' + errorMsg;
              statusMsg.style.color = '#ef4444';
              btn.disabled = false;
              btn.textContent = '▶️ Ejecutar Assembly Check';
              return;
            }
            
            const runId = runData.data.run_id;
            statusMsg.textContent = '⏳ Esperando a que termine el run...';
            
            // 2. Polling hasta que el run esté completed o failed
            let runCompleted = false;
            let attempts = 0;
            const maxAttempts = 60; // Máximo 60 intentos (5 minutos con polling cada 5s)
            
            while (!runCompleted && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
              
              try {
                const statusResponse = await fetch('/admin/api/assembly/runs/' + runId, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                
                const statusData = await statusResponse.json();
                
                if (statusData.ok && statusData.data && statusData.data.run) {
                  const run = statusData.data.run;
                  
                  if (run.status === 'completed') {
                    runCompleted = true;
                    const checksOk = run.checks_ok || 0;
                    const checksWarn = run.checks_warn || 0;
                    const checksBroken = run.checks_broken || 0;
                    statusMsg.textContent = '✅ Ejecución completada: ' + checksOk + ' OK, ' + checksWarn + ' WARN, ' + checksBroken + ' BROKEN';
                    statusMsg.style.color = '#10b981';
                    
                    // Refetch explícito: recargar página para mostrar resultados
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                    return;
                  } else if (run.status === 'failed') {
                    runCompleted = true;
                    const errorMsg = run.error_message || 'Run falló';
                    statusMsg.textContent = '❌ Run falló: ' + errorMsg;
                    statusMsg.style.color = '#ef4444';
                    btn.disabled = false;
                    btn.textContent = '▶️ Ejecutar Assembly Check';
                    return;
                  } else {
                    // Todavía running, continuar polling
                    statusMsg.textContent = '⏳ Ejecutando... (intento ' + (attempts + 1) + ')';
                  }
                }
              } catch (pollError) {
                console.error('Error en polling:', pollError);
                // Continuar intentando
              }
              
              attempts++;
            }
            
            // Si llegamos aquí, timeout
            if (!runCompleted) {
              statusMsg.textContent = '⏱️ Timeout esperando run. Recargando para ver estado...';
              statusMsg.style.color = '#f59e0b';
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            }
          } catch (error) {
            const errorMsg = error.message || 'Error desconocido';
            statusMsg.textContent = '❌ Error: ' + errorMsg;
            statusMsg.style.color = '#ef4444';
            btn.disabled = false;
            btn.textContent = '▶️ Ejecutar Assembly Check';
          }
        });
        
        // Handler para inicializar checks
        document.getElementById('initialize-checks-btn').addEventListener('click', async () => {
          const btn = document.getElementById('initialize-checks-btn');
          const statusMsg = document.getElementById('status-message');
          
          btn.disabled = true;
          btn.textContent = '⏳ Inicializando...';
          statusMsg.textContent = 'Inicializando checks...';
          statusMsg.style.color = '#f59e0b';
          
          try {
            const response = await fetch('/admin/api/assembly/initialize', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            const data = await response.json();
            
            if (data.ok) {
              const created = data.data.created || 0;
              statusMsg.textContent = '✅ ' + created + ' checks creados';
              statusMsg.style.color = '#10b981';
              
              // Recargar página después de 1 segundo
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            } else {
              const errorMsg = data.error || 'Error desconocido';
              statusMsg.textContent = '❌ Error: ' + errorMsg;
              statusMsg.style.color = '#ef4444';
            }
          } catch (error) {
            const errorMsg = error.message || 'Error desconocido';
            statusMsg.textContent = '❌ Error: ' + errorMsg;
            statusMsg.style.color = '#ef4444';
          } finally {
            btn.disabled = false;
            btn.textContent = '🔄 Inicializar Checks';
          }
        });
      </script>
    `;
    
    return renderAdminPage({
      title: 'Assembly Check System',
      contentHtml,
      activePath
    });
  } catch (error) {
    logError('AssemblyCheckUI', 'Error renderizando UI', {
      error: error.message,
      stack: error.stack
    });
    
    // Devolver página de error
    return renderAdminPage({
      title: 'Error - Assembly Check System',
      contentHtml: `
        <div class="admin-container" style="padding: 2rem;">
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem; padding: 1.5rem;">
            <h2 style="color: #dc2626; margin: 0 0 0.5rem 0;">❌ Error</h2>
            <p style="color: #991b1b; margin: 0;">${error.message}</p>
          </div>
        </div>
      `,
      activePath: '/admin/system/assembly'
    });
  }
}

