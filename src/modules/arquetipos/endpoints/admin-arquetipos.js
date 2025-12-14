// src/modules/arquetipos/endpoints/admin-arquetipos.js
// Admin Panel para gestión de Arquetipos

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { query } from '../../../../database/pg.js';
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

export async function renderArquetipos(request, env) {
  try {
    const moduloActivo = await isActivo('arquetipos');

    const arquetiposResult = await query(`
      SELECT * FROM arquetipos ORDER BY prioridad DESC, nombre ASC
    `);
    const arquetipos = arquetiposResult.rows;

    const statsResult = await query(`
      SELECT 
        COUNT(DISTINCT alumno_id) as alumnos_con_arquetipo,
        COUNT(*) as asignaciones_totales
      FROM arquetipos_alumnos WHERE activo = true
    `);
    const stats = statsResult.rows[0];

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-white mb-2">🎭 Arquetipos Dinámicos</h2>
            <p class="text-slate-400">Sistema de arquetipos basado en el comportamiento del alumno</p>
          </div>
          <div>
            ${moduloActivo 
              ? '<span class="px-4 py-2 bg-green-900 text-green-200 rounded-lg text-sm font-semibold">🟢 ACTIVO</span>'
              : '<span class="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold">⚫ OFF</span>'
            }
          </div>
        </div>

        <!-- Estadísticas -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
            <div class="text-indigo-400 text-2xl font-bold">${arquetipos.length}</div>
            <div class="text-slate-300 text-sm">Arquetipos Definidos</div>
          </div>
          <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
            <div class="text-purple-400 text-2xl font-bold">${stats.alumnos_con_arquetipo || 0}</div>
            <div class="text-slate-300 text-sm">Alumnos con Arquetipo</div>
          </div>
        </div>

        <!-- Lista de Arquetipos -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${arquetipos.map(arq => `
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-purple-500 transition-colors shadow-lg">
              <div class="flex items-center gap-3 mb-3">
                <span class="text-4xl">${arq.icono || '🎭'}</span>
                <div>
                  <h3 class="text-lg font-bold text-white">${arq.nombre}</h3>
                  <p class="text-xs text-purple-400">${arq.codigo}</p>
                </div>
              </div>
              <p class="text-slate-300 text-sm mb-4">${arq.descripcion || 'Sin descripción'}</p>
              <div class="flex justify-between items-center text-xs">
                <span class="text-slate-500">Prioridad: ${arq.prioridad}</span>
                <span class="${arq.activo ? 'text-green-400' : 'text-slate-500'}">${arq.activo ? '✓ Activo' : '⚫ Inactivo'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Arquetipos',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando Arquetipos:', error);
    return new Response(`Error interno del servidor: ${error.message}`, { status: 500 });
  }
}



