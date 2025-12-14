// src/modules/historia/endpoints/admin-historia.js
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isActivo } from '../../../services/modulos.js';

const __dirname = resolve();
const baseTemplate = readFileSync(resolve(__dirname, 'src/core/html/admin/base.html'), 'utf-8');

function replace(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

export async function renderHistoria(request, env) {
  try {
    const moduloActivo = await isActivo('modo_historia');

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-white mb-2">📖 Modo Historia</h2>
            <p class="text-slate-400">Narrativa por niveles que acompaña al alumno en su viaje</p>
          </div>
          <div>
            ${moduloActivo 
              ? '<span class="px-4 py-2 bg-green-900 text-green-200 rounded-lg text-sm font-semibold">🟢 ACTIVO</span>'
              : '<span class="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold">⚫ OFF</span>'
            }
          </div>
        </div>

        ${!moduloActivo ? `
          <div class="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6">
            <p class="text-yellow-300 text-sm">
              ⚠️ Este módulo está desactivado. Actívalo en 
              <a href="/admin/modulos" class="underline hover:text-yellow-100">Gestión de Módulos</a>
            </p>
          </div>
        ` : ''}

        <div class="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
          <div class="text-6xl mb-4">📖</div>
          <h3 class="text-lg font-medium text-white mb-2">Modo Historia - En Construcción</h3>
          <p class="text-slate-400">Capítulos y escenas narrativas por nivel</p>
        </div>
      </div>
    `;

    const html = replace(baseTemplate, { TITLE: 'Modo Historia', CONTENT: content });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
  } catch (error) {
    console.error('Error renderizando Historia:', error);
    return new Response(`Error interno del servidor: ${error.message}`, { status: 500 });
  }
}



