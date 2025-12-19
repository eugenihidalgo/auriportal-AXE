// src/endpoints/admin-panel-analytics.js
// Panel de Analytics para Admin

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { analytics } from '../services/analytics.js';
import { query } from '../../database/pg.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';

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

/**
 * Helper para obtener URL absoluta
 */
function getAbsoluteUrl(request, path) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}${path}`;
}

/**
 * Renderiza página de Analytics
 */
export async function renderAnalytics(request, env) {
  try {
    const url = new URL(request.url);
    const fechaDesde = url.searchParams.get('fechaDesde') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fechaHasta = url.searchParams.get('fechaHasta') || new Date().toISOString().split('T')[0];
    const tipoEvento = url.searchParams.get('tipoEvento') || null;
    const alumnoId = url.searchParams.get('alumnoId') || null;

    // Obtener estadísticas generales
    const estadisticas = await analytics.getEstadisticasGenerales();

    // Obtener resumen diario
    const resumenDiario = await analytics.getResumenDiario(
      new Date(fechaDesde),
      new Date(fechaHasta)
    );

    // Obtener eventos recientes
    let eventosRecientes = [];
    if (alumnoId) {
      eventosRecientes = await analytics.getEventosAlumno(
        parseInt(alumnoId),
        tipoEvento,
        new Date(fechaDesde),
        new Date(fechaHasta),
        100
      );
    } else if (tipoEvento) {
      eventosRecientes = await analytics.getEventosPorTipo(
        tipoEvento,
        new Date(fechaDesde),
        new Date(fechaHasta),
        100
      );
    }

    // Obtener lista de alumnos para el filtro
    const todosAlumnosResult = await query('SELECT id, email FROM alumnos ORDER BY email LIMIT 1000');
    const todosAlumnos = todosAlumnosResult.rows;

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Analytics</h2>
          <button onclick="calcularResumenDiario()" 
                  class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
            🔄 Calcular Resumen Diario
          </button>
        </div>

        <!-- Estadísticas Generales -->
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
          <div class="bg-slate-800 overflow-hidden shadow-xl rounded border border-slate-700-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="text-3xl font-bold text-white">${estadisticas.total_eventos.toLocaleString()}</div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-slate-400 truncate">Total Eventos</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-slate-800 overflow-hidden shadow-xl rounded border border-slate-700-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="text-3xl font-bold text-indigo-600">${estadisticas.eventos_ultimos_7_dias.toLocaleString()}</div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-slate-400 truncate">Últimos 7 días</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-slate-800 overflow-hidden shadow-xl rounded border border-slate-700-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="text-3xl font-bold text-purple-600">${estadisticas.eventos_ultimos_30_dias.toLocaleString()}</div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-slate-400 truncate">Últimos 30 días</dt>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-slate-800 overflow-hidden shadow-xl rounded border border-slate-700-lg">
            <div class="p-5">
              <div class="text-sm font-medium text-slate-400">Tipos de Eventos</div>
              <div class="mt-2 text-sm text-white">
                ${estadisticas.eventos_por_tipo.length} tipos diferentes
              </div>
            </div>
          </div>
        </div>

        <!-- Eventos por Tipo -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg mb-6">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg font-medium text-white mb-4">Eventos por Tipo</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-700">
                <thead class="bg-slate-750">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo de Evento</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Total</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody class="bg-slate-800 divide-y divide-slate-700">
                  ${estadisticas.eventos_por_tipo.map(e => `
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">${e.tipo_evento}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${parseInt(e.total).toLocaleString()}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <a href="/admin/analytics?tipoEvento=${encodeURIComponent(e.tipo_evento)}&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}" 
                           class="text-indigo-600 hover:text-indigo-900">Ver Eventos</a>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-4 mb-6">
          <form method="GET" action="/admin/analytics" class="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <input type="date" name="fechaDesde" value="${fechaDesde}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <input type="date" name="fechaHasta" value="${fechaHasta}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <select name="tipoEvento" class="px-3 py-2 border border-slate-600 rounded-md">
              <option value="">Todos los tipos</option>
              ${estadisticas.eventos_por_tipo.map(e => `
                <option value="${e.tipo_evento}" ${tipoEvento === e.tipo_evento ? 'selected' : ''}>${e.tipo_evento}</option>
              `).join('')}
            </select>
            <select name="alumnoId" class="px-3 py-2 border border-slate-600 rounded-md">
              <option value="">Todos los alumnos</option>
              ${todosAlumnos.map(a => `
                <option value="${a.id}" ${alumnoId === String(a.id) ? 'selected' : ''}>${a.email}</option>
              `).join('')}
            </select>
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Filtrar
            </button>
          </form>
        </div>

        <!-- Resumen Diario -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg mb-6">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg font-medium text-white mb-4">Resumen Diario</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-700">
                <thead class="bg-slate-750">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Alumnos Activos</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Prácticas Totales</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nivel Promedio</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fase Predominante</th>
                  </tr>
                </thead>
                <tbody class="bg-slate-800 divide-y divide-slate-700">
                  ${resumenDiario.length === 0 ? `
                    <tr>
                      <td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">
                        No hay datos de resumen diario. <button onclick="calcularResumenDiario()" class="text-indigo-600 hover:text-indigo-900">Calcular ahora</button>
                      </td>
                    </tr>
                  ` : resumenDiario.map(r => `
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${new Date(r.fecha).toLocaleDateString('es-ES')}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${r.alumnos_activos}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${r.practicas_totales}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${parseFloat(r.nivel_promedio).toFixed(1)}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${r.fase_predominante || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Eventos Recientes -->
        ${eventosRecientes.length > 0 ? `
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg font-medium text-white mb-4">Eventos Recientes</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-700">
                <thead class="bg-slate-750">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Alumno</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Metadata</th>
                  </tr>
                </thead>
                <tbody class="bg-slate-800 divide-y divide-slate-700">
                  ${eventosRecientes.map(e => `
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${new Date(e.fecha).toLocaleString('es-ES')}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        <span class="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800">${e.tipo_evento}</span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        ${e.alumno_id ? `<a href="/admin/alumno/${e.alumno_id}" class="text-indigo-600 hover:text-indigo-900">Ver Alumno</a>` : '-'}
                      </td>
                      <td class="px-6 py-4 text-sm text-slate-400">
                        <pre class="text-xs bg-slate-750 p-2 rounded">${JSON.stringify(e.metadata, null, 2)}</pre>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        ` : ''}
      </div>

      <script>
        async function calcularResumenDiario() {
          if (!confirm('¿Calcular resumen diario para hoy? Esto puede tardar unos momentos.')) {
            return;
          }
          
          try {
            const response = await fetch('/admin/analytics?action=calcular_resumen', {
              method: 'POST'
            });
            
            if (response.ok) {
              alert('✅ Resumen diario calculado correctamente');
              location.reload();
            } else {
              alert('❌ Error calculando resumen diario');
            }
          } catch (error) {
            console.error('Error:', error);
            alert('❌ Error calculando resumen diario');
          }
        }
      </script>
    `;

    const html = replaceAdminTemplate(baseTemplate, {
      TITLE: 'Analytics',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando analytics:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja acciones de analytics
 */
export async function handleAnalytics(request, env) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'calcular_resumen' && request.method === 'POST') {
      await analytics.calcularResumenDiario();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Acción no válida', { status: 400 });
  } catch (error) {
    console.error('Error manejando analytics:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

