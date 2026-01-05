/**
 * MASTER ALUMNOS - AuriPortal Master
 * 
 * Pantalla principal del mundo ALUMNOS.
 * Redirige a la tabla técnica PostgreSQL Alumnos.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterAlumnosHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  // Redirigir a la tabla técnica por defecto (URL absoluta requerida por Node/Undici)
  const redirectUrl = new URL('/master/alumnos/postgresql', request.url);
  return Response.redirect(redirectUrl.toString(), 302);
}


