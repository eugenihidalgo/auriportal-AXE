// src/endpoints/admin-master-insight.js
// Módulo MASTER INSIGHT - Panel de administración energética

import { query } from '../../database/pg.js';
// Función helper para reemplazar placeholders
async function replace(html, placeholders) {
  let output = html;
  
  // VALIDACIÓN CRÍTICA: Detectar Promises antes de reemplazar
  for (const key in placeholders) {
    let value = placeholders[key] ?? "";
    
    // DETECCIÓN DE PROMISE: Si value es una Promise, lanzar error visible
    if (value && typeof value === 'object' && typeof value.then === 'function') {
      const errorMsg = `DEBUG: PLACEHOLDER ${key} IS A PROMISE (MISSING AWAIT)`;
      console.error(`[REPLACE] ${errorMsg}`);
      value = `<div style="padding:8px;color:#fca5a5;background:#1e293b;border:2px solid #fca5a5;border-radius:4px;margin:8px;font-weight:bold;">${errorMsg}</div>`;
    }
    
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  
  return output;
}


/**
 * Obtiene estadísticas para la Visión General
 */
export async function getOverviewStats() {
  try {
    // Total de sujetos energéticos
    const totalSubjects = await query(`
      SELECT COUNT(DISTINCT subject_id) as count
      FROM energy_subject_state
    `);
    
    // Sujetos limpios
    const cleanSubjects = await query(`
      SELECT COUNT(*) as count
      FROM energy_subject_state
      WHERE is_clean = true
    `);
    
    // Sujetos con iluminación activa
    const illuminatedSubjects = await query(`
      SELECT COUNT(*) as count
      FROM energy_subject_state
      WHERE illumination_count > 0
    `);
    
    // Eventos últimas 24h
    const events24h = await query(`
      SELECT COUNT(*) as count
      FROM energy_events
      WHERE occurred_at >= NOW() - INTERVAL '24 hours'
    `);
    
    // Eventos últimos 7 días
    const events7d = await query(`
      SELECT COUNT(*) as count
      FROM energy_events
      WHERE occurred_at >= NOW() - INTERVAL '7 days'
    `);
    
    // Alumnos activos (desde tabla alumnos)
    const alumnosActivos = await query(`
      SELECT COUNT(*) as count
      FROM alumnos
      WHERE estado_suscripcion = 'activa'
    `);
    
    // Alumnos en pausa
    const alumnosPausa = await query(`
      SELECT COUNT(*) as count
      FROM alumnos
      WHERE estado_suscripcion = 'pausada'
    `);
    
    // Últimos eventos relevantes
    const ultimosEventos = await query(`
      SELECT 
        e.id,
        e.occurred_at,
        e.event_type,
        e.subject_type,
        e.subject_id,
        e.alumno_id,
        a.email as alumno_email,
        e.notes
      FROM energy_events e
      LEFT JOIN alumnos a ON e.alumno_id = a.id
      ORDER BY e.occurred_at DESC
      LIMIT 10
    `);
    
    // Sujetos más trabajados (por iluminación)
    const sujetosMasTrabajados = await query(`
      SELECT 
        subject_type,
        subject_id,
        SUM(illumination_count) as total_illuminations,
        MAX(illumination_last_at) as last_illumination
      FROM energy_subject_state
      WHERE illumination_count > 0
      GROUP BY subject_type, subject_id
      ORDER BY total_illuminations DESC
      LIMIT 10
    `);
    
    // Sujetos más olvidados (sin eventos recientes)
    const sujetosOlvidados = await query(`
      SELECT 
        subject_type,
        subject_id,
        is_clean,
        illumination_count,
        last_event_at
      FROM energy_subject_state
      WHERE last_event_at IS NULL 
         OR last_event_at < NOW() - INTERVAL '30 days'
      ORDER BY last_event_at ASC NULLS LAST
      LIMIT 10
    `);
    
    return {
      totalSubjects: totalSubjects.rows[0]?.count || 0,
      cleanSubjects: cleanSubjects.rows[0]?.count || 0,
      illuminatedSubjects: illuminatedSubjects.rows[0]?.count || 0,
      events24h: events24h.rows[0]?.count || 0,
      events7d: events7d.rows[0]?.count || 0,
      alumnosActivos: alumnosActivos.rows[0]?.count || 0,
      alumnosPausa: alumnosPausa.rows[0]?.count || 0,
      ultimosEventos: ultimosEventos.rows || [],
      sujetosMasTrabajados: sujetosMasTrabajados.rows || [],
      sujetosOlvidados: sujetosOlvidados.rows || []
    };
  } catch (error) {
    console.error('[MasterInsight] Error obteniendo estadísticas:', error);
    return {
      totalSubjects: 0,
      cleanSubjects: 0,
      illuminatedSubjects: 0,
      events24h: 0,
      events7d: 0,
      alumnosActivos: 0,
      alumnosPausa: 0,
      ultimosEventos: [],
      sujetosMasTrabajados: [],
      sujetosOlvidados: []
    };
  }
}

/**
 * Renderiza la página de Visión General
 */
export async function renderMasterInsightOverview(request, env) {
  const stats = await getOverviewStats();
  
  const porcentajeLimpios = stats.totalSubjects > 0 
    ? Math.round((stats.cleanSubjects / stats.totalSubjects) * 100) 
    : 0;
  
  const porcentajeIluminados = stats.totalSubjects > 0 
    ? Math.round((stats.illuminatedSubjects / stats.totalSubjects) * 100) 
    : 0;
  
  const content = `
    <div class="p-6 space-y-6">
      <!-- Tarjetas principales -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Alumnos activos -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-400 text-sm">Alumnos Activos</p>
              <p class="text-3xl font-bold text-white mt-2">${stats.alumnosActivos}</p>
            </div>
            <div class="text-4xl">👥</div>
          </div>
        </div>
        
        <!-- Alumnos en pausa -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-400 text-sm">Alumnos en Pausa</p>
              <p class="text-3xl font-bold text-white mt-2">${stats.alumnosPausa}</p>
            </div>
            <div class="text-4xl">⏸️</div>
          </div>
        </div>
        
        <!-- Total sujetos energéticos -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-400 text-sm">Total Sujetos Energéticos</p>
              <p class="text-3xl font-bold text-white mt-2">${stats.totalSubjects}</p>
            </div>
            <div class="text-4xl">⚡</div>
          </div>
        </div>
        
        <!-- % Limpios -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-400 text-sm">% Limpios</p>
              <p class="text-3xl font-bold text-green-400 mt-2">${porcentajeLimpios}%</p>
              <p class="text-xs text-slate-500 mt-1">${stats.cleanSubjects} de ${stats.totalSubjects}</p>
            </div>
            <div class="text-4xl">✨</div>
          </div>
        </div>
        
        <!-- % Con Iluminación -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-400 text-sm">% Con Iluminación</p>
              <p class="text-3xl font-bold text-yellow-400 mt-2">${porcentajeIluminados}%</p>
              <p class="text-xs text-slate-500 mt-1">${stats.illuminatedSubjects} sujetos</p>
            </div>
            <div class="text-4xl">💡</div>
          </div>
        </div>
        
        <!-- Eventos últimas 24h -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-400 text-sm">Eventos (24h)</p>
              <p class="text-3xl font-bold text-blue-400 mt-2">${stats.events24h}</p>
            </div>
            <div class="text-4xl">📊</div>
          </div>
        </div>
        
        <!-- Eventos últimos 7 días -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-slate-400 text-sm">Eventos (7 días)</p>
              <p class="text-3xl font-bold text-purple-400 mt-2">${stats.events7d}</p>
            </div>
            <div class="text-4xl">📈</div>
          </div>
        </div>
      </div>
      
      <!-- Bloques de información -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Últimos eventos relevantes -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 class="text-xl font-bold text-white mb-4">📋 Últimos Eventos Relevantes</h3>
          <div class="space-y-3 max-h-96 overflow-y-auto">
            ${stats.ultimosEventos.length > 0 
              ? stats.ultimosEventos.map(evento => `
                <div class="bg-slate-700 rounded p-3 border border-slate-600">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <p class="text-white font-medium">${evento.event_type}</p>
                      <p class="text-slate-400 text-sm mt-1">
                        ${evento.subject_type || 'N/A'} / ${evento.subject_id || 'N/A'}
                        ${evento.alumno_email ? ` • ${evento.alumno_email}` : ''}
                      </p>
                      ${evento.notes ? `<p class="text-slate-500 text-xs mt-1">${evento.notes}</p>` : ''}
                    </div>
                    <div class="text-slate-500 text-xs ml-4">
                      ${new Date(evento.occurred_at).toLocaleString('es-ES', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              `).join('')
              : '<p class="text-slate-500 text-center py-4">No hay eventos recientes</p>'
            }
          </div>
        </div>
        
        <!-- Sujetos más trabajados -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 class="text-xl font-bold text-white mb-4">🔥 Sujetos Más Trabajados</h3>
          <div class="space-y-3 max-h-96 overflow-y-auto">
            ${stats.sujetosMasTrabajados.length > 0
              ? stats.sujetosMasTrabajados.map(sujeto => `
                <div class="bg-slate-700 rounded p-3 border border-slate-600">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-white font-medium">${sujeto.subject_type} / ${sujeto.subject_id}</p>
                      <p class="text-yellow-400 text-sm mt-1">
                        ${sujeto.total_illuminations} iluminaciones
                      </p>
                    </div>
                    <div class="text-slate-500 text-xs">
                      ${sujeto.last_illumination 
                        ? new Date(sujeto.last_illumination).toLocaleDateString('es-ES')
                        : 'N/A'
                      }
                    </div>
                  </div>
                </div>
              `).join('')
              : '<p class="text-slate-500 text-center py-4">No hay sujetos trabajados aún</p>'
            }
          </div>
        </div>
        
        <!-- Sujetos más olvidados -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 class="text-xl font-bold text-white mb-4">😴 Sujetos Más Olvidados</h3>
          <div class="space-y-3 max-h-96 overflow-y-auto">
            ${stats.sujetosOlvidados.length > 0
              ? stats.sujetosOlvidados.map(sujeto => `
                <div class="bg-slate-700 rounded p-3 border border-slate-600">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-white font-medium">${sujeto.subject_type} / ${sujeto.subject_id}</p>
                      <p class="text-slate-400 text-sm mt-1">
                        ${sujeto.is_clean ? '✅ Limpio' : '❌ No limpio'} • 
                        ${sujeto.illumination_count || 0} iluminaciones
                      </p>
                    </div>
                    <div class="text-slate-500 text-xs">
                      ${sujeto.last_event_at 
                        ? new Date(sujeto.last_event_at).toLocaleDateString('es-ES')
                        : 'Sin eventos'
                      }
                    </div>
                  </div>
                </div>
              `).join('')
              : '<p class="text-slate-500 text-center py-4">No hay sujetos olvidados</p>'
            }
          </div>
        </div>
        
        <!-- Alertas básicas (placeholder) -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 class="text-xl font-bold text-white mb-4">🚨 Alertas Básicas</h3>
          <div class="space-y-3">
            <div class="bg-yellow-900/30 border border-yellow-700 rounded p-3">
              <p class="text-yellow-200 text-sm">
                ⚠️ Sistema de alertas en desarrollo. Próximamente: detección automática de patrones y sugerencias.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'MASTER INSIGHT - Visión General',
    contentHtml: content,
    activePath,
    userContext: { isAdmin: true }
  });
}

/**
 * Renderiza placeholder para otras secciones
 */
export async function renderMasterInsightPlaceholder(sectionName, sectionTitle) {
  const content = `
    <div class="p-6">
      <div class="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
        <div class="text-6xl mb-4">🚧</div>
        <h2 class="text-2xl font-bold text-white mb-4">${sectionTitle}</h2>
        <p class="text-slate-400 mb-6">
          Esta sección está en desarrollo y estará disponible próximamente.
        </p>
        <div class="bg-yellow-900/30 border border-yellow-700 rounded p-4 inline-block">
          <p class="text-yellow-200 text-sm">
            <span class="font-semibold">Estado:</span> EN DESARROLLO
          </p>
        </div>
      </div>
    </div>
  `;
  
  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: `MASTER INSIGHT - ${sectionTitle}`,
    contentHtml: content,
    activePath,
    userContext: { isAdmin: true }
  });
}

