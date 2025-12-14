// src/endpoints/admin-recursos-tecnicos.js
// Panel admin para gestionar recursos técnicos (músicas y tonos de meditación)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { listarMusicas, crearMusica, actualizarMusica, eliminarMusica } from '../services/musicas-meditacion.js';
import { listarTonos, crearTono, actualizarTono, eliminarTono } from '../services/tonos-meditacion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');
const templateRecursos = readFileSync(join(__dirname, '../core/html/admin/recursos-tecnicos.html'), 'utf-8');
const templateMusicas = readFileSync(join(__dirname, '../core/html/admin/recursos-tecnicos-musicas.html'), 'utf-8');
const templateTonos = readFileSync(join(__dirname, '../core/html/admin/recursos-tecnicos-tonos.html'), 'utf-8');

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp("{{" + key + "}}", "g");
    output = output.replace(regex, value);
  }
  return output;
}

function generarFilaMusica(musica) {
  function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  
  const nombre = escapeHtml(musica.nombre || "");
  const descripcion = escapeHtml(musica.descripcion || "");
  const categoria = escapeHtml(musica.categoria || "");
  const url_externa = escapeHtml(musica.url_externa || "");
  const peso = musica.peso_mb ? musica.peso_mb + " MB" : "-";
  const duracion = musica.duracion_segundos || "";
  const checked = musica.es_por_defecto ? "checked" : "";
  const rowClass = musica.es_por_defecto ? "bg-indigo-900/20" : "";
  
  let archivoLink = "";
  if (musica.archivo_path) {
    archivoLink = '<a href="' + musica.archivo_path + '" target="_blank" class="text-indigo-400 hover:text-indigo-300 text-xs">Archivo</a>';
  }
  
  let urlLink = "";
  if (musica.url_externa) {
    urlLink = '<a href="' + musica.url_externa + '" target="_blank" class="text-indigo-400 hover:text-indigo-300 text-xs">URL</a>';
  }
  
  return '<tr class="border-b border-slate-700 hover:bg-slate-700 ' + rowClass + '" data-musica-id="' + musica.id + '">' +
    '<td class="py-3">' +
      '<input type="text" value="' + nombre + '" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-musica-id="' + musica.id + '" data-campo="nombre">' +
    '</td>' +
    '<td class="py-3">' +
      '<input type="text" value="' + descripcion + '" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-musica-id="' + musica.id + '" data-campo="descripcion">' +
    '</td>' +
    '<td class="py-3">' +
      '<input type="text" value="' + categoria + '" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-musica-id="' + musica.id + '" data-campo="categoria">' +
    '</td>' +
    '<td class="py-3">' +
      '<div class="flex gap-2">' +
        archivoLink +
        urlLink +
        '<input type="file" id="musicaArchivo' + musica.id + '" accept="audio/*" class="hidden" data-tipo="musica" data-id="' + musica.id + '">' +
        '<button type="button" class="btn-cambiar-archivo px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded" data-input-id="musicaArchivo' + musica.id + '">Cambiar</button>' +
        '<input type="text" value="' + url_externa + '" placeholder="URL externa" class="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-musica-id="' + musica.id + '" data-campo="url_externa">' +
      '</div>' +
    '</td>' +
    '<td class="py-3">' +
      '<input type="number" value="' + duracion + '" min="0" class="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-musica-id="' + musica.id + '" data-campo="duracion_segundos">' +
    '</td>' +
    '<td class="py-3">' +
      '<span class="text-slate-400 text-xs">' + peso + '</span>' +
    '</td>' +
    '<td class="py-3">' +
      '<label class="flex items-center gap-2 cursor-pointer">' +
        '<input type="checkbox" ' + checked + ' class="checkbox-por-defecto-musica" data-musica-id="' + musica.id + '" title="Marcar como música por defecto">' +
        '<span class="text-xs text-slate-300">Por defecto</span>' +
      '</label>' +
    '</td>' +
    '<td class="py-3">' +
      '<button type="button" class="btn-eliminar-musica px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors" data-musica-id="' + musica.id + '" title="Eliminar">Eliminar</button>' +
    '</td>' +
  '</tr>';
}

function generarFilaTono(tono) {
  function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  
  const nombre = escapeHtml(tono.nombre || "");
  const descripcion = escapeHtml(tono.descripcion || "");
  const categoria = escapeHtml(tono.categoria || "");
  const url_externa = escapeHtml(tono.url_externa || "");
  const peso = tono.peso_mb ? tono.peso_mb + " MB" : "-";
  const duracion = tono.duracion_segundos || "";
  const checked = tono.es_por_defecto ? "checked" : "";
  const rowClass = tono.es_por_defecto ? "bg-indigo-900/20" : "";
  
  let archivoLink = "";
  if (tono.archivo_path) {
    archivoLink = '<a href="' + tono.archivo_path + '" target="_blank" class="text-indigo-400 hover:text-indigo-300 text-xs">Archivo</a>';
  }
  
  let urlLink = "";
  if (tono.url_externa) {
    urlLink = '<a href="' + tono.url_externa + '" target="_blank" class="text-indigo-400 hover:text-indigo-300 text-xs">URL</a>';
  }
  
  return '<tr class="border-b border-slate-700 hover:bg-slate-700 ' + rowClass + '" data-tono-id="' + tono.id + '">' +
    '<td class="py-3">' +
      '<input type="checkbox" ' + checked + ' class="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-600 rounded focus:ring-indigo-500" data-tono-id="' + tono.id + '" data-campo="es_por_defecto">' +
    '</td>' +
    '<td class="py-3">' +
      '<input type="text" value="' + nombre + '" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-tono-id="' + tono.id + '" data-campo="nombre">' +
    '</td>' +
    '<td class="py-3">' +
      '<input type="text" value="' + descripcion + '" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-tono-id="' + tono.id + '" data-campo="descripcion">' +
    '</td>' +
    '<td class="py-3">' +
      '<input type="text" value="' + categoria + '" class="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-tono-id="' + tono.id + '" data-campo="categoria">' +
    '</td>' +
    '<td class="py-3">' +
      '<div class="flex gap-2">' +
        archivoLink +
        urlLink +
        '<input type="file" id="tonoArchivo' + tono.id + '" accept="audio/*" class="hidden" data-tipo="tono" data-id="' + tono.id + '">' +
        '<button type="button" class="btn-cambiar-archivo px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded" data-input-id="tonoArchivo' + tono.id + '">Cambiar</button>' +
        '<input type="text" value="' + url_externa + '" placeholder="URL externa" class="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-tono-id="' + tono.id + '" data-campo="url_externa">' +
      '</div>' +
    '</td>' +
    '<td class="py-3">' +
      '<input type="number" value="' + duracion + '" min="0" class="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" data-tono-id="' + tono.id + '" data-campo="duracion_segundos">' +
    '</td>' +
    '<td class="py-3">' +
      '<span class="text-slate-400 text-xs">' + peso + '</span>' +
    '</td>' +
    '<td class="py-3">' +
      '<button type="button" class="btn-eliminar-tono px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors" data-tono-id="' + tono.id + '" title="Eliminar">Eliminar</button>' +
    '</td>' +
  '</tr>';
}

export default async function adminRecursosTecnicosHandler(request, env) {
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    const loginUrl = new URL('/admin/login', request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  const url = new URL(request.url);
  const currentPath = url.pathname;
  
  const seccion = currentPath.includes('/tonos') ? 'tonos' : 'musicas';

  let musicas = [];
  let tonos = [];
  
  try {
    if (seccion === "musicas") {
      musicas = await listarMusicas();
    } else {
      tonos = await listarTonos();
    }
  } catch (error) {
    console.error('Error al cargar recursos:', error);
  }

  let contentSection = "";
  let tabMusicasClass = "";
  let tabTonosClass = "";

  if (seccion === "musicas") {
    tabMusicasClass = "bg-indigo-600 text-white border-b-2 border-indigo-400";
    tabTonosClass = "text-slate-400 hover:text-white";
    
    const musicasRows = musicas.length > 0 
      ? musicas.map(m => generarFilaMusica(m)).join('')
      : '<tr><td colspan="7" class="py-4 text-center text-slate-400">Crea tu primera música arriba</td></tr>';
    
    contentSection = replace(templateMusicas, {
      MUSICAS_ROWS: musicasRows
    });
  } else {
    tabMusicasClass = "text-slate-400 hover:text-white";
    tabTonosClass = "bg-indigo-600 text-white border-b-2 border-indigo-400";
    
    const tonosRows = tonos.length > 0 
      ? tonos.map(t => generarFilaTono(t)).join('')
      : '<tr><td colspan="8" class="py-4 text-center text-slate-400">Crea tu primer tono arriba</td></tr>';
    
    contentSection = replace(templateTonos, {
      TONOS_ROWS: tonosRows
    });
  }

  const content = replace(templateRecursos, {
    TAB_MUSICAS_CLASS: tabMusicasClass,
    TAB_TONOS_CLASS: tabTonosClass,
    CONTENT_SECTION: contentSection
  });

  return new Response(replace(baseTemplate, {
    TITLE: 'Recursos técnicos para las prácticas',
    BODY_CLASSES: 'flex h-full',
    CURRENT_PATH: currentPath,
    CONTENT: content,
    ACTIVE_MENU_ITEM: '/admin/recursos-tecnicos'
  }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
