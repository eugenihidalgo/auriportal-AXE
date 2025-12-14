// src/modules/auribosses/endpoints/admin-auribosses.js
// Admin Panel para gestión de Auribosses

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

/**
 * Renderiza página de gestión de Auribosses
 */
export async function renderAuribosses(request, env) {
  try {
    // Verificar si el módulo está activo
    const moduloActivo = await isActivo('auribosses');

    // Obtener todos los bosses
    const bossesResult = await query(`
      SELECT * FROM auribosses ORDER BY nivel ASC
    `);
    const bosses = bossesResult.rows;

    // Estadísticas
    const statsResult = await query(`
      SELECT 
        COUNT(DISTINCT alumno_id) as alumnos_con_bosses,
        COUNT(*) FILTER (WHERE completado = true) as bosses_completados,
        COUNT(*) as total_intentos
      FROM auribosses_alumnos
    `);
    const stats = statsResult.rows[0];

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-white mb-2">👹 Auribosses - Retos de Ascenso</h2>
            <p class="text-slate-400">Gestiona los retos que los alumnos deben superar para subir de nivel</p>
          </div>
          <div>
            ${moduloActivo 
              ? '<span class="px-4 py-2 bg-green-900 text-green-200 rounded-lg text-sm font-semibold">🟢 Módulo ACTIVO</span>'
              : '<span class="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold">⚫ Módulo DESACTIVADO</span>'
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

        <!-- Estadísticas -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
            <div class="text-indigo-400 text-2xl font-bold">${bosses.length}</div>
            <div class="text-slate-300 text-sm">Bosses Configurados</div>
          </div>
          <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
            <div class="text-purple-400 text-2xl font-bold">${stats.alumnos_con_bosses || 0}</div>
            <div class="text-slate-300 text-sm">Alumnos Retados</div>
          </div>
          <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
            <div class="text-green-400 text-2xl font-bold">${stats.bosses_completados || 0}</div>
            <div class="text-slate-300 text-sm">Bosses Vencidos</div>
          </div>
        </div>

        <!-- Lista de Bosses -->
        <div class="space-y-4">
          ${bosses.length === 0 ? `
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
              <div class="text-6xl mb-4">👹</div>
              <h3 class="text-lg font-medium text-white mb-2">No hay Auribosses configurados</h3>
              <p class="text-slate-400 mb-4">Los bosses se crean automáticamente con datos de ejemplo</p>
            </div>
          ` : bosses.map(boss => {
            const condiciones = typeof boss.condiciones === 'string' 
              ? JSON.parse(boss.condiciones) 
              : boss.condiciones;
            
            return `
              <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-indigo-500 transition-colors shadow-lg">
                <div class="flex justify-between items-start mb-4">
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                      <span class="text-4xl">👹</span>
                      <div>
                        <h3 class="text-xl font-bold text-white">${boss.nombre}</h3>
                        <p class="text-sm text-indigo-400">Nivel ${boss.nivel}</p>
                      </div>
                    </div>
                    <p class="text-slate-300 mb-4">${boss.descripcion || 'Sin descripción'}</p>
                  </div>
                  <div>
                    <span class="px-3 py-1 ${boss.activo ? 'bg-green-900 text-green-200' : 'bg-slate-700 text-slate-300'} rounded-full text-xs font-semibold">
                      ${boss.activo ? '✓ Activo' : '⚫ Inactivo'}
                    </span>
                  </div>
                </div>

                <!-- Condiciones -->
                <div class="bg-slate-900 rounded-lg p-4 mb-4">
                  <h4 class="text-sm font-semibold text-slate-400 mb-2">🎯 Condiciones para Vencer:</h4>
                  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    ${condiciones.min_practicas ? `
                      <div class="flex items-center gap-2">
                        <span class="text-indigo-400">🔥</span>
                        <span class="text-slate-300">${condiciones.min_practicas} prácticas</span>
                      </div>
                    ` : ''}
                    ${condiciones.min_racha ? `
                      <div class="flex items-center gap-2">
                        <span class="text-yellow-400">⚡</span>
                        <span class="text-slate-300">${condiciones.min_racha} días racha</span>
                      </div>
                    ` : ''}
                    ${condiciones.energia_min ? `
                      <div class="flex items-center gap-2">
                        <span class="text-green-400">💚</span>
                        <span class="text-slate-300">${condiciones.energia_min}/10 energía</span>
                      </div>
                    ` : ''}
                    ${condiciones.min_diversidad ? `
                      <div class="flex items-center gap-2">
                        <span class="text-cyan-400">🌈</span>
                        <span class="text-slate-300">${condiciones.min_diversidad} aspectos</span>
                      </div>
                    ` : ''}
                    ${condiciones.min_practicas_aspecto ? Object.entries(condiciones.min_practicas_aspecto).map(([asp, cant]) => `
                      <div class="flex items-center gap-2">
                        <span class="text-purple-400">✨</span>
                        <span class="text-slate-300">${cant} de ${asp}</span>
                      </div>
                    `).join('') : ''}
                  </div>
                </div>

                <!-- Estadísticas de este boss -->
                ${boss.id ? `
                  <div class="flex gap-4 text-xs text-slate-400">
                    <span>📊 ID: ${boss.id}</span>
                    <span>📅 Creado: ${new Date(boss.created_at).toLocaleDateString('es-ES')}</span>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- Botón para crear nuevo boss -->
        <div class="mt-6">
          <button class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg">
            ➕ Crear Nuevo Auriboss
          </button>
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Auribosses',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando Auribosses:', error);
    return new Response(`Error interno del servidor: ${error.message}`, { status: 500 });
  }
}



