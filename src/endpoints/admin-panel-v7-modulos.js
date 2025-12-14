// src/endpoints/admin-panel-v7-modulos.js
// Endpoints del Admin Panel para módulos V7

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../../database/pg.js';
import { isActivo, isBeta } from '../services/modulos.js';
import { 
  getCumpleañosHoy, 
  crearEventoCumpleaños, 
  getProximosCumpleaños 
} from '../modules/cumpleaños/services/cumpleaños.js';
import { 
  guardarCartaAstral, 
  getCartaAstral, 
  listarCartasAstrales 
} from '../modules/carta-astral/services/carta-astral.js';
import { 
  guardarDisenohumano, 
  getDisenohumano, 
  listarDisenohumanos 
} from '../modules/disenohumano/services/disenohumano.js';
import { 
  getAlumnosDisponibles, 
  getPracticasConjuntas 
} from '../modules/sinergia/services/sinergia.js';
import { 
  getSkillTreeAlumno, 
  completarNodoSkillTree 
} from '../modules/skilltree/services/skilltree.js';
import { 
  getAmistades, 
  enviarSolicitudAmistad, 
  aceptarSolicitudAmistad 
} from '../modules/amistades/services/amistades.js';
import { 
  getEstadisticasAuriClock, 
  getMomentoActualRecomendado 
} from '../modules/auriclock/services/auriclock.js';
import { 
  crearMensajeEspecial, 
  getMensajesEspeciales 
} from '../modules/mensajes-especiales/services/mensajes-especiales.js';
import { 
  getEventosGlobales, 
  crearEventoGlobal 
} from '../modules/eventos-globales/services/eventos-globales.js';
import { 
  getResumenEmocionalAnual, 
  generarResumenEmocionalAnual 
} from '../modules/emocional-anual/services/emocional-anual.js';
import { 
  getAjustesAlumno, 
  actualizarAjustesAlumno 
} from '../modules/ajustes-alumno/services/ajustes-alumno.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

// ============================================
// CUMPLEAÑOS
// ============================================

export async function renderCumpleaños(request, env) {
  // Permitir acceso aunque el módulo esté en OFF (para desarrollo)
  // if (!isActivo('mod_cumpleaños') && !isBeta('mod_cumpleaños')) {
  //   return new Response('Módulo no disponible', { status: 403 });
  // }

  const hoy = await getCumpleañosHoy();
  const proximos = await getProximosCumpleaños();

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">🎉 Cumpleaños</h1>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Cumpleaños de Hoy -->
        <div class="bg-slate-800 rounded-lg p-6">
          <h2 class="text-xl font-semibold text-white mb-4">Cumpleaños de Hoy</h2>
          ${hoy.length > 0 ? `
            <div class="space-y-3">
              ${hoy.map(a => `
                <div class="bg-slate-700 rounded p-3">
                  <p class="text-white font-medium">${a.nombre_completo || a.apodo || a.email}</p>
                  <p class="text-slate-400 text-sm">${a.email}</p>
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400">No hay cumpleaños hoy</p>'}
        </div>

        <!-- Próximos Cumpleaños -->
        <div class="bg-slate-800 rounded-lg p-6">
          <h2 class="text-xl font-semibold text-white mb-4">Próximos Cumpleaños</h2>
          <div class="space-y-3 max-h-96 overflow-y-auto">
            ${proximos.length > 0 ? proximos.map(a => `
              <div class="bg-slate-700 rounded p-3">
                <p class="text-white font-medium">${a.nombre_completo || a.apodo || a.email}</p>
                <p class="text-slate-400 text-sm">${a.email}</p>
                ${a.dias_restantes !== null ? `<p class="text-yellow-400 text-xs">En ${a.dias_restantes} días</p>` : ''}
              </div>
            `).join('') : '<p class="text-slate-400">No hay próximos cumpleaños</p>'}
          </div>
        </div>
      </div>
    </div>
  `;

  return new Response(replace(baseTemplate, { TITLE: 'Cumpleaños', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ============================================
// CARTA ASTRAL
// ============================================

export async function renderCartaAstral(request, env) {
  // Permitir acceso aunque el módulo esté en OFF (para desarrollo)
  // if (!isActivo('mod_carta_astral') && !isBeta('mod_carta_astral')) {
  //   return new Response('Módulo no disponible', { status: 403 });
  // }

  const url = new URL(request.url);
  const alumnoId = url.searchParams.get('alumno_id');

  if (alumnoId && request.method === 'POST') {
    const formData = await request.formData();
    const imagenUrl = formData.get('imagen_url') || '';
    const notas = formData.get('notas') || '';

    await guardarCartaAstral(parseInt(alumnoId), imagenUrl, notas);
    return Response.redirect(new URL(request.url).pathname + `?alumno_id=${alumnoId}&saved=1`, 302);
  }

  const cartas = await listarCartasAstrales();
  const cartaActual = alumnoId ? await getCartaAstral(parseInt(alumnoId)) : null;

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">🔮 Carta Astral</h1>
      
      ${alumnoId ? `
        <div class="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 class="text-xl font-semibold text-white mb-4">Subir Carta Astral</h2>
          <form method="POST" class="space-y-4">
            <div>
              <label class="block text-slate-300 mb-2">URL de la Imagen</label>
              <input type="text" name="imagen_url" value="${cartaActual?.imagen_url || ''}" 
                     class="w-full bg-slate-700 text-white rounded px-4 py-2" 
                     placeholder="https://...">
            </div>
            <div>
              <label class="block text-slate-300 mb-2">Notas</label>
              <textarea name="notas" rows="4" 
                        class="w-full bg-slate-700 text-white rounded px-4 py-2"
                        placeholder="Notas sobre la carta astral...">${cartaActual?.notas || ''}</textarea>
            </div>
            <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
              Guardar
            </button>
          </form>
          ${cartaActual?.imagen_url ? `
            <div class="mt-4">
              <img src="${cartaActual.imagen_url}" alt="Carta Astral" class="max-w-full rounded">
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="bg-slate-800 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-white mb-4">Cartas Astrales Registradas</h2>
        <div class="space-y-3">
          ${cartas.length > 0 ? cartas.map(c => `
            <div class="bg-slate-700 rounded p-4 flex justify-between items-center">
              <div>
                <p class="text-white font-medium">${c.nombre || c.email}</p>
                <p class="text-slate-400 text-sm">${c.email}</p>
                ${c.imagen_url ? '<span class="text-green-400 text-xs">✓ Imagen</span>' : '<span class="text-yellow-400 text-xs">Sin imagen</span>'}
              </div>
              <a href="?alumno_id=${c.alumno_id}" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                Ver/Editar
              </a>
            </div>
          `).join('') : '<p class="text-slate-400">No hay cartas astrales registradas</p>'}
        </div>
      </div>
    </div>
  `;

  return new Response(replace(baseTemplate, { TITLE: 'Carta Astral', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ============================================
// DISEÑO HUMANO
// ============================================

export async function renderDisenohumano(request, env) {
  // Permitir acceso aunque el módulo esté en OFF (para desarrollo)
  // if (!isActivo('mod_disenohumano') && !isBeta('mod_disenohumano')) {
  //   return new Response('Módulo no disponible', { status: 403 });
  // }

  const url = new URL(request.url);
  const alumnoId = url.searchParams.get('alumno_id');

  if (alumnoId && request.method === 'POST') {
    const formData = await request.formData();
    const imagenUrl = formData.get('imagen_url') || '';
    const tipo = formData.get('tipo') || '';
    const notas = formData.get('notas') || '{}';

    await guardarDisenohumano(parseInt(alumnoId), imagenUrl, tipo, JSON.parse(notas));
    return Response.redirect(new URL(request.url).pathname + `?alumno_id=${alumnoId}&saved=1`, 302);
  }

  const disenohumanos = await listarDisenohumanos();
  const disenohumanoActual = alumnoId ? await getDisenohumano(parseInt(alumnoId)) : null;

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">🌐 Diseño Humano</h1>
      
      ${alumnoId ? `
        <div class="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 class="text-xl font-semibold text-white mb-4">Subir Diseño Humano</h2>
          <form method="POST" class="space-y-4">
            <div>
              <label class="block text-slate-300 mb-2">URL de la Imagen</label>
              <input type="text" name="imagen_url" value="${disenohumanoActual?.imagen_url || ''}" 
                     class="w-full bg-slate-700 text-white rounded px-4 py-2" 
                     placeholder="https://...">
            </div>
            <div>
              <label class="block text-slate-300 mb-2">Tipo</label>
              <input type="text" name="tipo" value="${disenohumanoActual?.tipo || ''}" 
                     class="w-full bg-slate-700 text-white rounded px-4 py-2" 
                     placeholder="Ej: Generador, Manifestador, etc.">
            </div>
            <div>
              <label class="block text-slate-300 mb-2">Notas (JSON)</label>
              <textarea name="notas" rows="4" 
                        class="w-full bg-slate-700 text-white rounded px-4 py-2 font-mono text-sm"
                        placeholder='{"centro": "...", "tipo": "..."}'>${JSON.stringify(disenohumanoActual?.notas || {}, null, 2)}</textarea>
            </div>
            <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
              Guardar
            </button>
          </form>
          ${disenohumanoActual?.imagen_url ? `
            <div class="mt-4">
              <img src="${disenohumanoActual.imagen_url}" alt="Diseño Humano" class="max-w-full rounded">
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="bg-slate-800 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-white mb-4">Diseños Humanos Registrados</h2>
        <div class="space-y-3">
          ${disenohumanos.length > 0 ? disenohumanos.map(d => `
            <div class="bg-slate-700 rounded p-4 flex justify-between items-center">
              <div>
                <p class="text-white font-medium">${d.nombre || d.email}</p>
                <p class="text-slate-400 text-sm">${d.email}</p>
                ${d.tipo ? `<p class="text-slate-300 text-xs">Tipo: ${d.tipo}</p>` : ''}
                ${d.imagen_url ? '<span class="text-green-400 text-xs">✓ Imagen</span>' : '<span class="text-yellow-400 text-xs">Sin imagen</span>'}
              </div>
              <a href="?alumno_id=${d.alumno_id}" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                Ver/Editar
              </a>
            </div>
          `).join('') : '<p class="text-slate-400">No hay diseños humanos registrados</p>'}
        </div>
      </div>
    </div>
  `;

  return new Response(replace(baseTemplate, { TITLE: 'Diseño Humano', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Placeholder para otros endpoints V7 (se implementarán según necesidad)
export async function renderSinergia(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'Sinergias', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Sinergias - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function renderSkillTree(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'Skill Tree', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Skill Tree - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function renderAmistades(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'Amistades', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Amistades - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function renderAuriClock(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'AuriClock', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">AuriClock - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function renderMensajesEspeciales(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'Mensajes Especiales', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Mensajes Especiales - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function renderIdeas(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'Ideas', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Ideas - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function renderEventosGlobales(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'Eventos Globales', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Eventos Globales - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function renderEmocionalAnual(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'Emocional Anual', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Emocional Anual - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function renderAjustesAlumno(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'Ajustes Alumno', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Ajustes Alumno - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

