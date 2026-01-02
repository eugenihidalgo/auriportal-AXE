/**
 * MASTER LIMPIEZAS - AuriPortal Master
 * 
 * Pantalla de Limpiezas Energéticas en dominio Master.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterLimpiezasHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Limpiezas Energéticas',
    contentHtml: `
      <div style="padding: 2rem;">
        <h1>Limpiezas Energéticas</h1>
        <p>Gestión de limpiezas energéticas en dominio Master.</p>
      </div>
    `,
    activePath,
    universeId: 'limpiezas'
  });
}


