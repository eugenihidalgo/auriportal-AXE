/**
 * MASTER - Informe Total PDE
 * 
 * Pantalla de Informe Total PDE en Comunicaciones.
 * UI read-only para visualizar informe global diario de limpiezas.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';
import { requireAdminContext } from '../core/auth-context.js';

export default async function masterInformeTotalPdeHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // Auth
  let authCtx;
  try {
    authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx; // Ya es respuesta de error
    }
  } catch (authError) {
    return new Response('Error de autenticación', { status: 401 });
  }
  
  return renderMasterPage({
    title: 'Informe Total PDE - Comunicaciones',
    contentHtml: `
      <div id="master-informe-total-pde-container" style="padding: 2rem;">
        <h1 style="margin-bottom: 1.5rem; font-size: 1.875rem; font-weight: 700;">Informe Total PDE</h1>
        
        <!-- Filtros -->
        <div style="margin-bottom: 2rem; padding: 1.5rem; background: #f8fafc; border-radius: 0.5rem;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #334155;">Fecha</label>
              <input 
                type="date" 
                id="filter-date" 
                style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.25rem;"
              />
            </div>
          </div>
          <button 
            id="btn-load-report" 
            style="padding: 0.75rem 1.5rem; background: #4f46e5; color: white; border: none; border-radius: 0.25rem; font-weight: 600; cursor: pointer;"
          >
            Cargar Informe Total
          </button>
        </div>
        
        <!-- Resultado -->
        <div id="report-result" style="display: none;">
          <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="font-size: 1.5rem; font-weight: 600;">Informe Generado</h2>
            <button 
              id="btn-copy-report" 
              style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 0.25rem; font-weight: 600; cursor: pointer;"
            >
              📋 Copiar
            </button>
          </div>
          <div 
            id="report-content" 
            style="padding: 1.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; white-space: pre-wrap; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6;"
          ></div>
        </div>
        
        <!-- Loading -->
        <div id="report-loading" style="display: none; text-align: center; padding: 2rem;">
          <p style="color: #64748b;">Cargando informe...</p>
        </div>
        
        <!-- Error -->
        <div id="report-error" style="display: none; padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.25rem; color: #991b1b;">
        </div>
      </div>
    `,
    activePath,
    universeId: 'templo_luz',
    extraScripts: [
      '<script type="module" src="/js/master/master-informe-total-pde-client.js"></script>'
    ]
  });
}
