/**
 * MASTER ALUMNOS - ALUMNOS (Placeholder)
 * 
 * Pantalla placeholder para funcionalidad futura de Alumnos.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterAlumnosAlumnosHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Alumnos',
    contentHtml: `
      <div style="padding: 2rem;">
        <h1>Alumnos</h1>
        <p style="color: #666; margin-bottom: 1.5rem;">
          En construcción.
        </p>
      </div>
    `,
    activePath,
    universeId: 'u_alumnos'
  });
}
