// src/endpoints/admin-panel-audios.js
// Endpoint para gestionar audios de prácticas

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { query } from '../../database/pg.js';
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
 * Renderiza página de audios de prácticas
 */
export async function renderAudios(env, request) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    // Obtener audios con información del alumno
    const audiosResult = await query(
      `SELECT 
        pa.id,
        pa.alumno_id,
        pa.fecha,
        pa.transcripcion,
        pa.emocion,
        pa.metadata,
        COALESCE(a.apodo, a.email) as alumno_nombre,
        a.email as alumno_email
       FROM practicas_audio pa
       JOIN alumnos a ON pa.alumno_id = a.id
       ORDER BY pa.fecha DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const audios = audiosResult.rows;

    // Contar total para paginación
    const countResult = await query('SELECT COUNT(*) FROM practicas_audio');
    const totalAudios = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalAudios / limit);

    // Obtener estadísticas
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT alumno_id) as alumnos_unicos,
        AVG(CAST(emocion AS FLOAT)) as emocion_promedio
      FROM practicas_audio
    `);
    const stats = statsResult.rows[0];

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">🎧 Audios de Prácticas</h2>

        <!-- Estadísticas -->
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
          <div class="bg-slate-800 overflow-hidden shadow-lg rounded-lg border border-slate-700">
            <div class="p-5">
              <div class="text-sm font-medium text-slate-400">Total Audios</div>
              <div class="mt-1 text-3xl font-bold text-indigo-400">${stats.total || 0}</div>
            </div>
          </div>
          
          <div class="bg-slate-800 overflow-hidden shadow-lg rounded-lg border border-slate-700">
            <div class="p-5">
              <div class="text-sm font-medium text-slate-400">Alumnos Únicos</div>
              <div class="mt-1 text-3xl font-bold text-purple-400">${stats.alumnos_unicos || 0}</div>
            </div>
          </div>
          
          <div class="bg-slate-800 overflow-hidden shadow-lg rounded-lg border border-slate-700">
            <div class="p-5">
              <div class="text-sm font-medium text-slate-400">Emoción Promedio</div>
              <div class="mt-1 text-3xl font-bold text-green-400">
                ${stats.emocion_promedio ? parseFloat(stats.emocion_promedio).toFixed(1) : '-'}/10
              </div>
            </div>
          </div>
          
          <div class="bg-slate-800 overflow-hidden shadow-lg rounded-lg border border-slate-700">
            <div class="p-5">
              <div class="text-sm font-medium text-slate-400">Con Transcripción</div>
              <div class="mt-1 text-3xl font-bold text-yellow-400">
                ${audios.filter(a => a.transcripcion).length}
              </div>
            </div>
          </div>
        </div>

        <!-- Lista de audios -->
        <div class="bg-slate-800 shadow-lg rounded-lg border border-slate-700">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg font-medium text-white mb-4">
              Audios Registrados ${audios.length > 0 ? `(${offset + 1} - ${Math.min(offset + limit, totalAudios)} de ${totalAudios})` : ''}
            </h3>
            
            ${audios.length === 0 ? `
              <div class="text-center py-12">
                <div class="text-6xl mb-4">🎤</div>
                <h3 class="text-lg font-medium text-slate-300 mb-2">No hay audios registrados</h3>
                <p class="text-slate-500">
                  Los audios de prácticas aparecerán aquí cuando los alumnos graben reflexiones en audio.
                </p>
              </div>
            ` : `
              <div class="space-y-4">
                ${audios.map(audio => {
                  const metadata = audio.metadata ? (typeof audio.metadata === 'string' ? JSON.parse(audio.metadata) : audio.metadata) : {};
                  const emocionColor = audio.emocion >= 7 ? 'green' : audio.emocion >= 4 ? 'yellow' : 'red';
                  
                  return `
                    <div class="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-indigo-500 transition-colors">
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          <h4 class="text-white font-medium">
                            🎧 ${audio.alumno_nombre}
                          </h4>
                          <p class="text-sm text-slate-400">${audio.alumno_email}</p>
                          <p class="text-xs text-slate-500 mt-1">
                            ${new Date(audio.fecha).toLocaleString('es-ES')}
                          </p>
                        </div>
                        <div class="text-right">
                          <div class="text-sm text-slate-400">Emoción</div>
                          <div class="text-2xl font-bold text-${emocionColor}-400">
                            ${audio.emocion || '-'}/10
                          </div>
                        </div>
                      </div>
                      
                      ${audio.transcripcion ? `
                        <div class="bg-slate-950 rounded p-3 mb-2">
                          <div class="text-xs font-medium text-slate-400 mb-1">📝 Transcripción:</div>
                          <p class="text-sm text-slate-300 leading-relaxed">
                            ${audio.transcripcion.length > 300 ? audio.transcripcion.substring(0, 300) + '...' : audio.transcripcion}
                          </p>
                        </div>
                      ` : ''}
                      
                      <div class="flex gap-4 text-xs text-slate-500">
                        ${metadata.modelo ? `<span>🤖 ${metadata.modelo}</span>` : ''}
                        ${metadata.confianza ? `<span>✅ ${(metadata.confianza * 100).toFixed(0)}% confianza</span>` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              
              <!-- Paginación -->
              ${totalPages > 1 ? `
                <div class="mt-6 flex justify-center gap-2">
                  ${page > 1 ? `
                    <a href="/admin/audios?page=${page - 1}" 
                       class="px-4 py-2 bg-slate-700 text-slate-200 rounded hover:bg-slate-600 transition-colors">
                      ← Anterior
                    </a>
                  ` : ''}
                  
                  <span class="px-4 py-2 bg-slate-900 text-slate-300 rounded">
                    Página ${page} de ${totalPages}
                  </span>
                  
                  ${page < totalPages ? `
                    <a href="/admin/audios?page=${page + 1}" 
                       class="px-4 py-2 bg-slate-700 text-slate-200 rounded hover:bg-slate-600 transition-colors">
                      Siguiente →
                    </a>
                  ` : ''}
                </div>
              ` : ''}
            `}
          </div>
        </div>
      </div>
    `;

    const html = replaceAdminTemplate(baseTemplate, {
      TITLE: 'Audios de Prácticas',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando audios:', error);
    return new Response(`Error interno del servidor: ${error.message}`, { status: 500 });
  }
}

