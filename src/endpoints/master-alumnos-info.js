/**
 * MASTER ALUMNOS - Información espiritual del alumno (Placeholder)
 * 
 * Pantalla placeholder para información espiritual del alumno.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterAlumnosInfoHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Información espiritual del alumno',
    contentHtml: `
      <div style="padding: 2rem;">
        <h1>Información espiritual del alumno</h1>
        <p style="color: #666; margin-bottom: 1.5rem;">
          En construcción.
        </p>
      </div>
    `,
    activePath,
    universeId: 'u_alumnos'
  });
}
