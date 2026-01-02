// src/endpoints/admin-transmutaciones-proyectos.js
// UI Admin canónica para gestión de proyectos de transmutación energética

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { listarProyectosActivos, listarAlumnos } from '../services/transmutaciones-proyectos-admin-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`{{${escapedKey}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

// Función helper para escapar HTML
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Función helper para escapar JSON (para data attributes)
function escapeJson(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Renderiza la lista de proyectos activos
 */
export async function renderTransmutacionesProyectos(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  let proyectos = [];
  let alumnos = [];
  try {
    [proyectos, alumnos] = await Promise.all([
      listarProyectosActivos(),
      listarAlumnos()
    ]);
  } catch (error) {
    console.error('Error al cargar datos:', error);
  }

  // Generar opciones de alumnos para el select
  const alumnosOptions = alumnos.map(a => {
    const label = a.nombre_completo || a.apodo || a.email || 'Sin nombre';
    return `<option value="${a.id}">${escapeHtml(label)}</option>`;
  }).join('');

  // Generar filas de la tabla (SIN onclick/onchange inline - usar data attributes)
  // Importar resolveTemporalState para calcular estado
  let resolveTemporalState, formatDaysAgo;
  try {
    const temporalStateModule = await import('../core/student/domains/resolve-temporal-state.js');
    resolveTemporalState = temporalStateModule.resolveTemporalState;
    formatDaysAgo = temporalStateModule.formatDaysAgo;
  } catch (error) {
    console.error('Error importando resolveTemporalState:', error);
    // Fallback: funciones básicas
    resolveTemporalState = ({ last_cleaned_at, recurrence_days }) => {
      if (!last_cleaned_at) return 'critical';
      const days = Math.ceil((new Date().getTime() - new Date(last_cleaned_at).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= recurrence_days) return 'clean';
      if (days <= (2 * recurrence_days)) return 'pending';
      return 'critical';
    };
    formatDaysAgo = (date) => {
      if (!date) return 'Nunca';
      const days = Math.ceil((new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
      if (days === 0) return 'Hoy';
      if (days === 1) return 'Ayer';
      return `Hace ${days} días`;
    };
  }
  
  const proyectosRows = proyectos.length > 0 ? proyectos.map(p => {
    const nombreAlumno = p.created_by_nombre || p.created_by_apodo || p.created_by_email || 'Sin asignar';
    
    // Calcular estado temporal usando resolveTemporalState
    let lastCleanedAt = p.ultima_limpieza || p.last_cleaned_at || null;
    let recurrenceDays = p.recommended_recurrence_days || p.frecuencia_dias || 30;
    
    const temporalState = resolveTemporalState({
      last_cleaned_at: lastCleanedAt,
      recurrence_days: recurrenceDays,
      now: new Date()
    });
    
    // Badge de estado temporal
    let estadoBadge = '';
    if (temporalState === 'clean') {
      estadoBadge = '<span class="px-2 py-1 bg-green-600 text-white text-xs rounded">✅ LIMPIO</span>';
    } else if (temporalState === 'pending') {
      estadoBadge = '<span class="px-2 py-1 bg-yellow-600 text-white text-xs rounded">⏳ PENDIENTE</span>';
    } else {
      estadoBadge = '<span class="px-2 py-1 bg-red-600 text-white text-xs rounded">🚨 CRÍTICO</span>';
    }
    
    // Formatear "Hace X días"
    const diasAgo = formatDaysAgo(lastCleanedAt);
    
    // Usar data attributes en lugar de onclick/onchange
    return `
      <tr class="border-b border-slate-700 hover:bg-slate-700" data-proyecto-id="${p.id}">
        <td class="py-3 px-4">
          <input 
            type="checkbox"
            class="checkbox-proyecto"
            data-proyecto-id="${p.id}"
            aria-label="Seleccionar proyecto ${escapeHtml(p.nombre)}"
          />
        </td>
        <td class="py-3 px-4 text-white font-medium">${escapeHtml(p.nombre)}</td>
        <td class="py-3 px-4 text-slate-300">${escapeHtml(p.descripcion || '-')}</td>
        <td class="py-3 px-4 text-slate-300 sortable-column" data-sort-key="alumno" style="cursor: pointer;">
          ${escapeHtml(nombreAlumno)}
        </td>
        <td class="py-3 px-4 text-slate-400 text-sm">${escapeHtml(diasAgo)}</td>
        <td class="py-3 px-4">${estadoBadge}</td>
        <td class="py-3 px-4">
          <input 
            type="number"
            value="${recurrenceDays}"
            min="1"
            class="input-recurrencia px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none w-20"
            data-proyecto-id="${p.id}"
            data-original-value="${recurrenceDays}"
            aria-label="Recurrencia del proyecto ${escapeHtml(p.nombre)}"
          />
        </td>
        <td class="py-3 px-4">
          <div class="flex gap-2">
            <button 
              class="btn-editar-proyecto px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors"
              data-proyecto-id="${p.id}"
              data-student-id="${p.created_by_student_id || ''}"
              aria-label="Editar proyecto ${escapeHtml(p.nombre)}"
            >
              Editar
            </button>
            <button 
              class="btn-limpiar-proyecto px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors"
              data-proyecto-id="${p.id}"
              aria-label="Limpiar proyecto ${escapeHtml(p.nombre)}"
            >
              Limpiar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="8" class="py-8 text-center text-slate-400">No hay proyectos activos</td>
    </tr>
  `;

  const url = new URL(request.url);
  const activePath = url.pathname;

  const listTemplate = readFileSync(join(__dirname, '../core/html/admin/transmutaciones-proyectos/proyectos-list.html'), 'utf-8');
  const contentHtml = replace(listTemplate, {
    PROYECTOS_ROWS: proyectosRows,
    PROYECTOS_TOTAL: proyectos.length,
    PROYECTOS_TOTAL_PLURAL: proyectos.length !== 1 ? 's' : '',
    ALUMNOS_OPTIONS: alumnosOptions
  });

  return renderAdminPage({
    title: 'Proyectos de Transmutación Energética',
    contentHtml,
    activePath,
    userContext: { isAdmin: true },
    acsRuntimeContract: {
      ui_key: 'transmutaciones-proyectos',
      required_endpoints: [
        '/admin/api/transmutaciones/proyectos'
      ],
      strict_mode: true
    }
  });
}

/**
 * Handler principal del endpoint
 */
export default async function adminTransmutacionesProyectosHandler(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Solo manejar GET para la UI
  if (method === 'GET') {
    return await renderTransmutacionesProyectos(request, env);
  }

  // Otros métodos no permitidos aquí (deben ir a los handlers API)
  return new Response(JSON.stringify({
    ok: false,
    error: 'Method not allowed'
  }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}
