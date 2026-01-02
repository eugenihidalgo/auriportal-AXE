/**
 * MASTER DASHBOARD - AuriPortal Master
 * 
 * Dashboard principal del dominio Master.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterDashboardHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Dashboard Master',
    contentHtml: `
      <div style="padding: 2rem;">
        <h1>Dashboard Master</h1>
        <p>Bienvenido al dominio canónico de AuriPortal.</p>
        <p>Esta es la pantalla principal del sistema Master.</p>
      </div>
    `,
    activePath,
    universeId: 'systema'
  });
}


