// src/endpoints/admin-panel-aurigraph.js
// Endpoint para Aurigraph - Visualización radar del estado del alumno

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { query } from '../../database/pg.js';
import { generarAurigraph } from '../services/aurigraph.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

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
 * Renderiza página de Aurigraph
 */
export async function renderAurigraph(env, request) {
  try {
    const url = new URL(request.url);
    const alumnoId = url.searchParams.get('alumno_id');

    // Obtener lista de alumnos para el selector
    const alumnosResult = await query(
      `SELECT id, COALESCE(apodo, email) as nombre, email, nivel_actual
       FROM alumnos
       ORDER BY COALESCE(apodo, email) ASC`
    );
    const alumnos = alumnosResult.rows;

    let aurigraphHTML = '';
    let alumnoSeleccionado = null;

    if (alumnoId) {
      // Obtener datos del alumno seleccionado
      const alumnoResult = await query(
        `SELECT id, email, apodo, nivel_actual, streak as racha_actual, energia_emocional,
                fecha_ultima_practica, estado_suscripcion
         FROM alumnos
         WHERE id = $1`,
        [alumnoId]
      );

      if (alumnoResult.rows.length > 0) {
        alumnoSeleccionado = alumnoResult.rows[0];

        // Generar Aurigraph (stub por ahora, puede ser SVG o canvas)
        const aurigraphData = await generarAurigraph(alumnoId);

        aurigraphHTML = `
          <div class="bg-slate-800 shadow-lg rounded-lg p-6 border border-slate-700">
            <h3 class="text-xl font-semibold text-white mb-4">
              📈 Aurigraph de ${alumnoSeleccionado.apodo || alumnoSeleccionado.email}
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 class="text-sm font-medium text-slate-400 mb-2">Datos Actuales</h4>
                <dl class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-slate-400">Nivel:</dt>
                    <dd class="text-indigo-400 font-semibold">${alumnoSeleccionado.nivel_actual || 1}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-slate-400">Racha:</dt>
                    <dd class="text-yellow-400 font-semibold">${alumnoSeleccionado.racha_actual || 0} días</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-slate-400">Energía Emocional:</dt>
                    <dd class="text-green-400 font-semibold">${alumnoSeleccionado.energia_emocional || 5}/10</dd>
                  </div>
                </dl>
              </div>
              
              <div>
                <h4 class="text-sm font-medium text-slate-400 mb-2">Métricas Calculadas</h4>
                <dl class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-slate-400">Intensidad Práctica:</dt>
                    <dd class="text-blue-400 font-semibold">${aurigraphData.intensidadPractica || 0}/10</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-slate-400">Diversidad Aspectos:</dt>
                    <dd class="text-cyan-400 font-semibold">${aurigraphData.diversidadAspectos || 0}/10</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-slate-400">Última práctica:</dt>
                    <dd class="text-slate-300">${alumnoSeleccionado.fecha_ultima_practica ? new Date(alumnoSeleccionado.fecha_ultima_practica).toLocaleDateString('es-ES') : 'Nunca'}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-slate-400">Estado:</dt>
                    <dd class="text-slate-300 capitalize">${alumnoSeleccionado.estado_suscripcion || 'activa'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <!-- Radar Chart Placeholder -->
            <div class="bg-slate-900 rounded-lg p-8 flex items-center justify-center border border-slate-700">
              <div class="text-center">
                <div class="text-6xl mb-4">📊</div>
                <p class="text-slate-400 text-lg mb-2">Gráfico Radar Aurigraph</p>
                <p class="text-slate-500 text-sm">
                  Visualización en desarrollo: Nivel, Fase, Racha, Energía, Intensidad, Diversidad
                </p>
                <div class="mt-4 grid grid-cols-3 gap-4 text-xs">
                  <div class="bg-indigo-900/30 p-2 rounded">
                    <div class="text-indigo-400 font-semibold">Nivel</div>
                    <div class="text-slate-300">${aurigraphData.nivel}/10</div>
                  </div>
                  <div class="bg-purple-900/30 p-2 rounded">
                    <div class="text-purple-400 font-semibold">Fase</div>
                    <div class="text-slate-300">${aurigraphData.fase}/10</div>
                  </div>
                  <div class="bg-yellow-900/30 p-2 rounded">
                    <div class="text-yellow-400 font-semibold">Racha</div>
                    <div class="text-slate-300">${aurigraphData.racha}/10</div>
                  </div>
                  <div class="bg-green-900/30 p-2 rounded">
                    <div class="text-green-400 font-semibold">Energía</div>
                    <div class="text-slate-300">${aurigraphData.energia}/10</div>
                  </div>
                  <div class="bg-blue-900/30 p-2 rounded">
                    <div class="text-blue-400 font-semibold">Intensidad</div>
                    <div class="text-slate-300">${aurigraphData.intensidadPractica}/10</div>
                  </div>
                  <div class="bg-cyan-900/30 p-2 rounded">
                    <div class="text-cyan-400 font-semibold">Diversidad</div>
                    <div class="text-slate-300">${aurigraphData.diversidadAspectos}/10</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    }

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">📈 Aurigraph - Estado del Alumno</h2>

        <div class="bg-slate-800 shadow-lg rounded-lg p-6 mb-6 border border-slate-700">
          <p class="text-slate-300 mb-4">
            El Aurigraph es una visualización tipo radar que muestra el estado general del alumno en 6 dimensiones clave.
          </p>
          
          <form method="GET" action="/admin/aurigraph" class="flex gap-4 items-end">
            <div class="flex-1">
              <label for="alumno_id" class="block text-sm font-medium text-slate-400 mb-2">
                Seleccionar Alumno
              </label>
              <select 
                id="alumno_id" 
                name="alumno_id" 
                class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">-- Selecciona un alumno --</option>
                ${alumnos.map(a => `
                  <option value="${a.id}" ${alumnoId == a.id ? 'selected' : ''}>
                    ${a.nombre} (${a.email}) - Nivel ${a.nivel_actual || 1}
                  </option>
                `).join('')}
              </select>
            </div>
            <button 
              type="submit" 
              class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Ver Aurigraph
            </button>
          </form>
        </div>

        ${aurigraphHTML}

        ${!alumnoId ? `
          <div class="bg-slate-800 shadow-lg rounded-lg p-8 border border-slate-700 text-center">
            <div class="text-6xl mb-4">📊</div>
            <h3 class="text-lg font-medium text-slate-300 mb-2">
              Selecciona un alumno para ver su Aurigraph
            </h3>
            <p class="text-slate-500">
              El gráfico radar mostrará el nivel, fase, racha, energía emocional, intensidad de práctica y diversidad de aspectos.
            </p>
          </div>
        ` : ''}
      </div>
    `;

    const html = replaceAdminTemplate(baseTemplate, {
      TITLE: 'Aurigraph',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando Aurigraph:', error);
    return new Response(`Error interno del servidor: ${error.message}`, { status: 500 });
  }
}

