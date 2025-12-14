// src/endpoints/admin-panel-modo-maestro.js
// Modo Maestro: Vista completa y detallada de un alumno

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../../database/pg.js';
import { generarAurigraph } from '../services/aurigraph.js';

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
 * GET /admin/modo-maestro?alumno_id=X - Vista completa del alumno
 */
export async function renderModoMaestro(request, env) {
  try {
    const url = new URL(request.url);
    const alumno_id = url.searchParams.get('alumno_id');

    if (!alumno_id) {
      // Mostrar lista de alumnos ACTIVOS para seleccionar (Modo Master solo para activos)
      // Primero obtener TODOS los alumnos para debug, luego filtrar
      const todosAlumnos = await query(
        `SELECT a.id, a.email, a.apodo, a.nombre_completo, COALESCE(a.apodo, a.nombre_completo, a.email) as nombre, 
                a.nivel_actual as nivel, a.streak as racha, a.estado_suscripcion, 
                COALESCE(nf.fase, 'sanación') as fase,
                a.fecha_ultima_practica
         FROM alumnos a
         LEFT JOIN niveles_fases nf ON a.nivel_actual >= nf.nivel_min 
                                    AND (nf.nivel_max IS NULL OR a.nivel_actual <= nf.nivel_max)
         ORDER BY COALESCE(a.apodo, a.nombre_completo, a.email)`
      );
      
      // Filtrar solo los que tienen estado 'activa' o 'active' (case insensitive)
      const alumnos = {
        rows: todosAlumnos.rows.filter(a => {
          const estado = (a.estado_suscripcion || '').toLowerCase().trim();
          return estado === 'activa' || estado === 'active';
        })
      };
      
      // Debug: mostrar qué alumnos se están obteniendo
      console.log(`[Modo Master] Total alumnos en BD: ${todosAlumnos.rows.length}`);
      console.log(`[Modo Master] Alumnos activos encontrados: ${alumnos.rows.length}`);
      if (todosAlumnos.rows.length > 0) {
        const estadosUnicos = [...new Set(todosAlumnos.rows.map(a => a.estado_suscripcion || 'NULL'))];
        console.log(`[Modo Master] Estados únicos en BD:`, estadosUnicos);
      }

      const content = `
        <div class="px-4 py-5 sm:p-6">
          <div class="mb-6">
            <h2 class="text-2xl font-bold text-white mb-2">🧙 Modo Master</h2>
            <p class="text-slate-300">Selecciona un alumno con suscripción activa para ver su perfil completo.</p>
            <p class="text-slate-400 text-sm mt-2">⚠️ Solo se muestran alumnos con estado_suscripcion = 'activa'</p>
          </div>
          
          ${alumnos.rows.length === 0 ? `
            <div class="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6 text-center">
              <p class="text-yellow-200 text-lg mb-2">No hay alumnos con suscripción activa</p>
              <p class="text-yellow-300 text-sm">Todos los alumnos están pausados, cancelados o expirados.</p>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              ${alumnos.rows
                .filter(a => {
                  // Filtrar solo los que realmente tienen estado activo
                  const estado = (a.estado_suscripcion || '').toLowerCase();
                  return estado === 'activa' || estado === 'active';
                })
                .map(a => {
                  const estado = (a.estado_suscripcion || '').toLowerCase();
                  const esActiva = estado === 'activa' || estado === 'active';
                  
                  return `
                <a href="/admin/master/${a.id}" 
                   class="bg-slate-800 border ${esActiva ? 'border-green-600' : 'border-red-600'} rounded-lg p-4 hover:border-purple-500 hover:shadow-xl transition-all">
                  <div class="flex items-start justify-between mb-2">
                    <h3 class="font-semibold text-lg text-white">${a.nombre}</h3>
                    ${esActiva ? `
                      <span class="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded font-semibold">✓ Activa</span>
                    ` : `
                      <span class="px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded">⚠ ${a.estado_suscripcion || 'Sin estado'}</span>
                    `}
                  </div>
                  ${a.email ? `<p class="text-sm text-slate-400 mb-2">${a.email}</p>` : ''}
                  <div class="mt-3 space-y-1 text-xs">
                    <div class="flex items-center gap-2 text-slate-300">
                      <span class="text-indigo-400">⭐ Nivel ${a.nivel || 1}</span>
                      <span>•</span>
                      <span class="text-yellow-400">🔥 Racha ${a.racha || 0} días</span>
                    </div>
                    ${a.fase ? `<div class="text-slate-400">🔑 Fase: ${a.fase}</div>` : ''}
                    ${a.fecha_ultima_practica ? `
                      <div class="text-slate-400">📅 Última práctica: ${new Date(a.fecha_ultima_practica).toLocaleDateString('es-ES')}</div>
                    ` : ''}
                    <div class="text-slate-500 mt-2 pt-2 border-t border-slate-700">
                      Estado: <strong>${a.estado_suscripcion || 'NULL'}</strong>
                    </div>
                  </div>
                  <div class="mt-3 pt-3 border-t border-slate-700">
                    <span class="text-purple-400 text-sm font-medium">→ Abrir Modo Master</span>
                  </div>
                </a>
              `;
                }).join('')}
            </div>
          `}
        </div>
      `;

      return new Response(
        replace(baseTemplate, {
          TITLE: 'Modo Maestro - Admin',
          CONTENT: content
        }),
        {
          headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        }
      );
    }

    // Si hay alumno_id, redirigir al nuevo sistema Modo Master
    // Verificar que el alumno tenga suscripción activa
    const alumnoResult = await query(
      `SELECT id, estado_suscripcion FROM alumnos WHERE id = $1`,
      [alumno_id]
    );

    if (alumnoResult.rows.length === 0) {
      return new Response('Alumno no encontrado', { status: 404 });
    }

    const alumno = alumnoResult.rows[0];
    
    // Si no tiene suscripción activa, mostrar error
    if (alumno.estado_suscripcion !== 'activa') {
      const content = `
        <div class="px-4 py-5 sm:p-6">
          <div class="bg-red-900/30 border border-red-700 rounded-lg p-6 text-center">
            <h2 class="text-2xl font-bold text-red-400 mb-4">🔒 Acceso Denegado</h2>
            <p class="text-red-200 text-lg mb-2">El Modo Master solo está disponible para alumnos con suscripción activa.</p>
            <p class="text-red-300 text-sm mb-4">Este alumno tiene estado: <strong>${alumno.estado_suscripcion}</strong></p>
            <a href="/admin/modo-maestro" class="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              ← Volver a lista de alumnos activos
            </a>
          </div>
        </div>
      `;
      return new Response(
        replace(baseTemplate, {
          TITLE: 'Acceso Denegado - Modo Master',
          CONTENT: content
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        }
      );
    }
    
    // Redirigir al nuevo sistema Modo Master
    return new Response(null, {
      status: 302,
      headers: { 'Location': `/admin/master/${alumno_id}` }
    });
    const practicas = await query(`
      SELECT 
        p.*,
        ap.nombre as aspecto_nombre
      FROM practicas p
      LEFT JOIN aspectos_practica ap ON p.aspecto_id = ap.id
      WHERE p.alumno_id = $1
      ORDER BY p.fecha DESC
      LIMIT 20
    `, [alumno_id]);

    // Obtener reflexiones recientes (últimas 10)
    const reflexiones = await query(`
      SELECT *
      FROM reflexiones
      WHERE alumno_id = $1
      ORDER BY fecha DESC
      LIMIT 10
    `, [alumno_id]);

    // Obtener logros
    const logros = await query(`
      SELECT 
        l.*,
        ld.nombre,
        ld.descripcion,
        ld.icono
      FROM logros l
      JOIN logros_definicion ld ON l.codigo_logro = ld.codigo
      WHERE l.alumno_id = $1
      ORDER BY l.fecha_obtenido DESC
    `, [alumno_id]);

    // Obtener misiones
    const misiones = await query(`
      SELECT 
        ma.*,
        m.nombre,
        m.descripcion,
        m.condiciones
      FROM misiones_alumnos ma
      JOIN misiones m ON ma.mision_id = m.id
      WHERE ma.alumno_id = $1
      ORDER BY ma.completada ASC, ma.created_at DESC
    `, [alumno_id]);

    // Estadísticas
    const stats = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE fecha >= NOW() - INTERVAL '7 days') as practicas_semana,
        COUNT(*) FILTER (WHERE fecha >= NOW() - INTERVAL '30 days') as practicas_mes,
        COUNT(*) as practicas_total,
        COUNT(DISTINCT DATE(fecha)) FILTER (WHERE fecha >= NOW() - INTERVAL '30 days') as dias_activos_mes
      FROM practicas
      WHERE alumno_id = $1
    `, [alumno_id]);
    
    const statsData = stats.rows[0] || {};

    // Emociones recientes
    const emocionesRecientes = await query(`
      SELECT 
        DATE(fecha) as fecha,
        AVG(energia_emocional) as energia_media
      FROM reflexiones
      WHERE alumno_id = $1
        AND energia_emocional IS NOT NULL
        AND fecha >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(fecha)
      ORDER BY fecha DESC
      LIMIT 10
    `, [alumno_id]);

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <div>
            <a href="/admin/modo-maestro" class="text-indigo-400 hover:text-indigo-300 text-sm">← Volver a lista</a>
            <h2 class="text-3xl font-bold text-white mt-2">🧙 Modo Maestro: ${alumno.nombre}</h2>
            ${alumno.email ? `<p class="text-lg text-slate-300">${alumno.email}</p>` : ''}
          </div>
          <div class="text-right bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div class="text-sm text-slate-400">Nivel</div>
            <div class="text-3xl font-bold text-indigo-400">${alumno.nivel_actual || 1}</div>
            <div class="text-sm text-slate-400 mt-2">Racha: <span class="text-yellow-400 font-semibold">${alumno.streak || 0}</span> días</div>
          </div>
        </div>

        <!-- Grid de 2 columnas -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <!-- Columna izquierda: Aurigraph y estadísticas -->
          <div class="space-y-6">
            
            <!-- Aurigraph -->
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-lg">
              <h3 class="text-xl font-bold text-white mb-4">📊 Aurigraph</h3>
              <div class="flex justify-center">
                ${aurigraph.svg}
              </div>
              <div class="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div class="text-center bg-slate-900 p-2 rounded">
                  <div class="font-semibold text-slate-400">Nivel</div>
                  <div class="text-indigo-400 text-xl">${aurigraph.metricas.nivel}</div>
                </div>
                <div class="text-center bg-slate-900 p-2 rounded">
                  <div class="font-semibold text-slate-400">Racha</div>
                  <div class="text-yellow-400 text-xl">${aurigraph.metricas.racha}</div>
                </div>
                <div class="text-center bg-slate-900 p-2 rounded">
                  <div class="font-semibold text-slate-400">Energía</div>
                  <div class="text-green-400 text-xl">${aurigraph.metricas.energia}</div>
                </div>
                <div class="text-center bg-slate-900 p-2 rounded">
                  <div class="font-semibold text-slate-400">Intensidad</div>
                  <div class="text-blue-400 text-xl">${aurigraph.metricas.intensidad}</div>
                </div>
                <div class="text-center bg-slate-900 p-2 rounded">
                  <div class="font-semibold text-slate-400">Diversidad</div>
                  <div class="text-cyan-400 text-xl">${aurigraph.metricas.diversidad}</div>
                </div>
              </div>
            </div>

            <!-- Estadísticas -->
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-lg">
              <h3 class="text-xl font-bold text-white mb-4">📈 Estadísticas</h3>
              <div class="space-y-3">
                <div class="flex justify-between text-slate-200">
                  <span>Prácticas esta semana:</span>
                  <span class="font-semibold text-indigo-400">${statsData.practicas_semana || 0}</span>
                </div>
                <div class="flex justify-between text-slate-200">
                  <span>Prácticas este mes:</span>
                  <span class="font-semibold text-purple-400">${statsData.practicas_mes || 0}</span>
                </div>
                <div class="flex justify-between text-slate-200">
                  <span>Prácticas totales:</span>
                  <span class="font-semibold text-blue-400">${statsData.practicas_total || 0}</span>
                </div>
                <div class="flex justify-between text-slate-200">
                  <span>Días activos (30d):</span>
                  <span class="font-semibold text-green-400">${statsData.dias_activos_mes || 0}</span>
                </div>
                <div class="flex justify-between text-slate-200">
                  <span>Energía emocional:</span>
                  <span class="font-semibold ${alumno.energia_emocional >= 7 ? 'text-green-400' : alumno.energia_emocional >= 4 ? 'text-yellow-400' : 'text-red-400'}">
                    ${alumno.energia_emocional || 'N/A'}/10
                  </span>
                </div>
              </div>
            </div>

            <!-- Logros -->
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-lg">
              <h3 class="text-xl font-bold text-white mb-4">🏆 Logros (${logros.rows.length})</h3>
              ${logros.rows.length === 0 ? `
                <p class="text-slate-400 text-sm">Sin logros aún</p>
              ` : `
                <div class="space-y-2">
                  ${logros.rows.map(l => {
                    const fecha = new Date(l.fecha_obtenido);
                    return `
                      <div class="flex items-center gap-3 p-2 bg-slate-900 rounded">
                        <div class="text-2xl">${l.icono || '🏆'}</div>
                        <div class="flex-1">
                          <div class="font-semibold text-sm text-white">${l.nombre}</div>
                          <div class="text-xs text-slate-400">${fecha.toLocaleDateString('es-ES')}</div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>

            <!-- Misiones -->
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-lg">
              <h3 class="text-xl font-bold text-white mb-4">🎯 Misiones</h3>
              ${misiones.rows.length === 0 ? `
                <p class="text-slate-400 text-sm">Sin misiones asignadas</p>
              ` : `
                <div class="space-y-2">
                  ${misiones.rows.map(m => `
                    <div class="p-3 ${m.completada ? 'bg-green-900/30 border border-green-700' : 'bg-slate-900 border border-slate-700'} rounded">
                      <div class="flex items-center justify-between">
                        <span class="font-semibold text-sm text-white">${m.nombre}</span>
                        <span class="px-2 py-1 text-xs rounded ${m.completada ? 'bg-green-700 text-green-100' : 'bg-slate-700 text-slate-300'}">
                          ${m.completada ? '✓ Completada' : 'En progreso'}
                        </span>
                      </div>
                      ${m.descripcion ? `<p class="text-xs text-slate-300 mt-1">${m.descripcion}</p>` : ''}
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

          </div>

          <!-- Columna derecha: Actividad reciente -->
          <div class="space-y-6">
            
            <!-- Emociones recientes -->
            ${emocionesRecientes.rows.length > 0 ? `
              <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-lg">
                <h3 class="text-xl font-bold text-white mb-4">🌡️ Termómetro Emocional (últimos 10 días)</h3>
                <div class="space-y-2">
                  ${emocionesRecientes.rows.map(e => {
                    const energia = parseFloat(e.energia_media).toFixed(1);
                    const fecha = new Date(e.fecha);
                    const barWidth = (energia / 10) * 100;
                    const color = energia >= 7 ? 'bg-green-500' : energia >= 4 ? 'bg-yellow-500' : 'bg-red-500';
                    
                    return `
                      <div>
                        <div class="flex justify-between text-xs text-slate-300 mb-1">
                          <span>${fecha.toLocaleDateString('es-ES')}</span>
                          <span class="font-semibold">${energia}/10</span>
                        </div>
                        <div class="w-full bg-slate-900 rounded-full h-2">
                          <div class="${color} h-2 rounded-full" style="width: ${barWidth}%"></div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Reflexiones recientes -->
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-lg">
              <h3 class="text-xl font-bold text-white mb-4">💬 Reflexiones Recientes</h3>
              ${reflexiones.rows.length === 0 ? `
                <p class="text-slate-400 text-sm">Sin reflexiones</p>
              ` : `
                <div class="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                  ${reflexiones.rows.map(r => {
                    const fecha = new Date(r.fecha);
                    return `
                      <div class="p-3 bg-slate-900 rounded border border-slate-700">
                        <div class="flex justify-between items-start mb-2">
                          <div class="text-xs text-slate-400">${fecha.toLocaleString('es-ES')}</div>
                          ${r.energia_emocional ? `
                            <span class="text-xs font-semibold px-2 py-1 rounded ${r.energia_emocional >= 7 ? 'bg-green-900 text-green-300' : r.energia_emocional >= 4 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}">
                              ${r.energia_emocional}/10
                            </span>
                          ` : ''}
                        </div>
                        <p class="text-sm text-slate-200 whitespace-pre-wrap">${r.texto.length > 200 ? r.texto.substring(0, 200) + '...' : r.texto}</p>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>

            <!-- Prácticas recientes -->
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-lg">
              <h3 class="text-xl font-bold text-white mb-4">🔥 Prácticas Recientes</h3>
              ${practicas.rows.length === 0 ? `
                <p class="text-slate-400 text-sm">Sin prácticas</p>
              ` : `
                <div class="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                  ${practicas.rows.map(p => {
                    const fecha = new Date(p.fecha);
                    return `
                      <div class="flex justify-between items-center p-2 bg-slate-900 rounded text-sm border border-slate-700">
                        <div class="flex-1">
                          <div class="font-semibold text-white">${p.tipo || 'Práctica'}</div>
                          ${p.aspecto_nombre ? `<div class="text-xs text-indigo-400">${p.aspecto_nombre}</div>` : ''}
                        </div>
                        <div class="text-xs text-slate-400">
                          ${fecha.toLocaleDateString('es-ES')}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>

          </div>
        </div>

        <!-- Acciones rápidas -->
        <div class="mt-6 flex gap-3 flex-wrap">
          <a href="/admin/alumnos" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg">
            Ver detalles completos →
          </a>
          <a href="/admin/auricalendar?alumno_id=${alumno_id}" class="bg-slate-700 text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600">
            📆 Ver calendario
          </a>
          <a href="/admin/reflexiones?alumno_id=${alumno_id}" class="bg-slate-700 text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600">
            💬 Ver todas las reflexiones
          </a>
        </div>
      </div>
    `;

    return new Response(
      replace(baseTemplate, {
        TITLE: `Modo Maestro: ${alumno.nombre} - Admin`,
        CONTENT: content
      }),
      {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      }
    );
  } catch (error) {
    console.error('❌ Error en renderModoMaestro:', error);
    return new Response('Error interno del servidor: ' + error.message, { status: 500 });
  }
}

