/**
 * MASTER SYSTEMA - AuriPortal Master
 * 
 * Pantalla de Systema en dominio Master.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterSystemaHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Systema',
    contentHtml: `
      <div style="padding: 2rem;">
        <h1>Systema</h1>
        <p>Configuración y diagnóstico del sistema en dominio Master.</p>
      </div>
    `,
    activePath,
    universeId: 'systema'
  });
}


