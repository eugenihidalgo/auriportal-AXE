/**
 * MASTER ALUMNOS - AuriPortal Master
 * 
 * Pantalla de Alumnos en dominio Master.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterAlumnosHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'Alumnos',
    contentHtml: `
      <div style="padding: 2rem;">
        <h1>Alumnos</h1>
        <p>Gestión de alumnos en dominio Master.</p>
      </div>
    `,
    activePath,
    universeId: 'alumnos'
  });
}


