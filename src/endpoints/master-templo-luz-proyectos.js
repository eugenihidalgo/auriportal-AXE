/**
 * MASTER TEMPLO DE LUZ - Proyectos Activados
 * 
 * Pantalla de Proyectos Activados en el Templo de Luz.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterTemploLuzProyectosHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Proyectos Activados - Templo de Luz',
    contentHtml: `
      <div style="padding: 2rem;">
        <h1>Proyectos Activados</h1>
        <p>Este espacio formará parte del Templo de Luz.</p>
        <p>Infraestructura lista. Contenido en fase posterior.</p>
      </div>
    `,
    activePath,
    universeId: 'templo_luz'
  });
}


