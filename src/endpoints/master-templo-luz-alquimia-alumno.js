/**
 * MASTER TEMPLO DE LUZ - Alquimia por Alumno
 * 
 * Pantalla de Alquimia por Alumno en el Templo de Luz.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterTemploLuzAlquimiaAlumnoHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Alquimia por Alumno - Templo de Luz',
    contentHtml: `
      <div id="alquimia-alumno-container" style="padding: 2rem;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <!-- Header izquierdo: Dropdown + Buscador -->
          <div style="display: flex; gap: 1rem; align-items: center; flex: 1; min-width: 300px;">
            <div style="position: relative; flex: 1;">
              <input 
                type="text" 
                id="student-search" 
                placeholder="Buscar alumno..." 
                style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"
              />
              <select 
                id="student-select" 
                style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; margin-top: 0.5rem; display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: white; max-height: 300px; overflow-y: auto;"
              >
                <option value="">Seleccionar alumno...</option>
              </select>
            </div>
          </div>
          
          <!-- Header derecho: Indicador de progreso -->
          <div id="progress-indicator" style="display: none; text-align: right;">
            <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem;">
              <span id="progress-text">0%</span> limpiado
            </div>
            <div style="width: 300px; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden;">
              <div id="progress-bar" style="height: 100%; background: #4caf50; width: 0%; transition: width 0.3s;"></div>
            </div>
          </div>
        </div>
        
        <!-- Cuerpo: Listas -->
        <div id="listas-container">
          <p style="color: #666; text-align: center; padding: 2rem;">
            Selecciona un alumno para ver sus items de alquimia
          </p>
        </div>
        
        <!-- Mensaje de error -->
        <div id="error-message" style="display: none; padding: 1rem; background: #ffebee; color: #c62828; border-radius: 4px; margin-top: 1rem;"></div>
      </div>
      
      <script src="/js/master/master-alquimia-alumno-client.js"></script>
    `,
    activePath,
    universeId: 'templo_luz'
  });
}


