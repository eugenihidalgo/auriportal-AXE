// src/endpoints/admin-panel-reflexiones.js
// Visualización de reflexiones de los alumnos

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
 * GET /admin/reflexiones - Muestra todas las reflexiones con filtros
 */
export async function renderReflexiones(request, env) {
  try {
    const url = new URL(request.url);
    const alumno_id = url.searchParams.get('alumno_id');
    const limite = parseInt(url.searchParams.get('limite')) || 50;

    // Obtener reflexiones con datos del alumno
    let reflexionesQuery = `
      SELECT 
        r.*,
        COALESCE(a.apodo, a.email) as alumno_nombre,
        a.apodo as alumno_apodo,
        a.email as alumno_email
      FROM reflexiones r
      JOIN alumnos a ON r.alumno_id = a.id
    `;
    
    const params = [];
    if (alumno_id) {
      reflexionesQuery += ` WHERE r.alumno_id = $1`;
      params.push(alumno_id);
    }
    
    reflexionesQuery += ` ORDER BY r.fecha DESC LIMIT ${limite}`;
    
    const reflexiones = await query(reflexionesQuery, params);

    // Obtener lista de alumnos para el filtro
    const alumnos = await query(
      `SELECT id, email, apodo, COALESCE(apodo, email) as nombre FROM alumnos ORDER BY COALESCE(apodo, email)`
    );

    // Estadísticas generales
    const stats = await query(`
      SELECT 
        COUNT(*) as total_reflexiones,
        COUNT(DISTINCT alumno_id) as alumnos_con_reflexiones,
        AVG(energia_emocional) as energia_media,
        MIN(energia_emocional) as energia_min,
        MAX(energia_emocional) as energia_max
      FROM reflexiones
      WHERE energia_emocional IS NOT NULL
    `);
    
    const statsData = stats.rows[0] || {};

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">Reflexiones de Alumnos</h2>

        <!-- Estadísticas -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-slate-800 border rounded-lg p-4">
            <div class="text-sm text-slate-300">Total Reflexiones</div>
            <div class="text-2xl font-bold">${statsData.total_reflexiones || 0}</div>
          </div>
          <div class="bg-slate-800 border rounded-lg p-4">
            <div class="text-sm text-slate-300">Alumnos Activos</div>
            <div class="text-2xl font-bold">${statsData.alumnos_con_reflexiones || 0}</div>
          </div>
          <div class="bg-slate-800 border rounded-lg p-4">
            <div class="text-sm text-slate-300">Energía Media</div>
            <div class="text-2xl font-bold">${statsData.energia_media ? parseFloat(statsData.energia_media).toFixed(1) : 'N/A'}</div>
          </div>
          <div class="bg-slate-800 border rounded-lg p-4">
            <div class="text-sm text-slate-300">Rango Energía</div>
            <div class="text-2xl font-bold">${statsData.energia_min || 'N/A'} - ${statsData.energia_max || 'N/A'}</div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="bg-slate-800 border rounded-lg p-4 mb-4">
          <form method="GET" action="/admin/reflexiones" class="flex gap-3 items-end">
            <div class="flex-1">
              <label class="block text-sm font-medium mb-1">Filtrar por alumno</label>
              <select name="alumno_id" class="w-full border rounded px-3 py-2">
                <option value="">Todos los alumnos</option>
                ${alumnos.rows.map(a => `
                  <option value="${a.id}" ${alumno_id == a.id ? 'selected' : ''}>
                    ${a.nombre}${a.apodo ? ` (${a.apodo})` : ''}
                  </option>
                `).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Límite</label>
              <select name="limite" class="border rounded px-3 py-2">
                <option value="50" ${limite === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${limite === 100 ? 'selected' : ''}>100</option>
                <option value="200" ${limite === 200 ? 'selected' : ''}>200</option>
              </select>
            </div>
            <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
              Filtrar
            </button>
            ${alumno_id ? `
              <a href="/admin/reflexiones" class="bg-slate-700 text-slate-200 px-4 py-2 rounded hover:bg-gray-300">
                Limpiar
              </a>
            ` : ''}
          </form>
        </div>

        <!-- Lista de reflexiones -->
        ${reflexiones.rows.length === 0 ? `
          <div class="text-center py-12 bg-slate-800 border rounded-lg">
            <p class="text-slate-400">No hay reflexiones registradas.</p>
          </div>
        ` : `
          <div class="space-y-4">
            ${reflexiones.rows.map(r => {
              const fecha = new Date(r.fecha);
              const energiaColor = r.energia_emocional 
                ? (r.energia_emocional >= 7 ? 'text-green-600' : r.energia_emocional >= 4 ? 'text-yellow-600' : 'text-red-600')
                : 'text-slate-500';
              
              return `
                <div class="bg-slate-800 border rounded-lg p-4">
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <a href="/admin/alumnos/${r.alumno_id}" class="font-semibold text-indigo-600 hover:text-indigo-800">
                        ${r.alumno_nombre}${r.alumno_apodo ? ` (${r.alumno_apodo})` : ''}
                      </a>
                      <div class="text-xs text-slate-400 mt-1">
                        ${fecha.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    ${r.energia_emocional ? `
                      <div class="text-right">
                        <div class="text-xs text-slate-400">Energía</div>
                        <div class="text-2xl font-bold ${energiaColor}">${r.energia_emocional}/10</div>
                      </div>
                    ` : ''}
                  </div>
                  
                  <div class="mt-3 text-slate-200 whitespace-pre-wrap">
                    ${r.texto}
                  </div>
                  
                  ${r.metadata && Object.keys(JSON.parse(r.metadata)).length > 0 ? `
                    <details class="mt-3">
                      <summary class="text-xs text-slate-400 cursor-pointer">Metadata</summary>
                      <pre class="mt-2 text-xs bg-slate-750 p-2 rounded overflow-auto">${JSON.stringify(JSON.parse(r.metadata), null, 2)}</pre>
                    </details>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    return new Response(
      replace(baseTemplate, {
        TITLE: 'Reflexiones - Admin',
        CONTENT: content
      }),
      {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      }
    );
  } catch (error) {
    console.error('❌ Error en renderReflexiones:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
}

