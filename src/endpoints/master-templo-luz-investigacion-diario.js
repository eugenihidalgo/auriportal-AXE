/**
 * MASTER TEMPLO DE LUZ - Investigación: Diario de Ankhar
 * 
 * Pantalla placeholder para Diario de Ankhar en el Templo de Luz.
 * Preparada para futura activación sin refactor.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterTemploLuzInvestigacionDiarioHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Diario de Ankhar - Investigación',
    contentHtml: `
      <div style="padding: 2rem;">
        <h1>Diario de Ankhar</h1>
        <p>Este espacio formará parte del Templo de Luz.</p>
        <p>Infraestructura lista. Contenido en fase posterior.</p>
      </div>
    `,
    activePath,
    universeId: 'templo_luz'
  });
}


