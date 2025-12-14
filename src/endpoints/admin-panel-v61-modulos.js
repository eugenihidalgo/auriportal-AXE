// Plantilla base para endpoints de módulos V6.1
// Este archivo genera endpoints automáticos para todos los módulos

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { query } from '../../database/pg.js';
import { isActivo } from '../services/modulos.js';

const __dirname = resolve();
const baseTemplate = readFileSync(resolve(__dirname, 'src/core/html/admin/base.html'), 'utf-8');

function replace(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

// Configuración de módulos V6.1
const modulosV61 = [
  {
    codigo: 'circulos_auri',
    titulo: '🌐 Círculos Auri',
    icono: '🌐',
    descripcion: 'Energía grupal compartida y retos colectivos',
    tabla: 'circulos_auri',
    query: 'SELECT * FROM circulos_auri ORDER BY activo DESC, nombre'
  },
  {
    codigo: 'diario_aurelin',
    titulo: '📔 Diario de Aurelín',
    icono: '📔',
    descripcion: 'Diario personal con auto-registro de prácticas',
    tabla: 'diario_practicas',
    query: 'SELECT COUNT(*) as total FROM diario_practicas'
  },
  {
    codigo: 'practicas_horario',
    titulo: '🕐 Prácticas por Horario',
    icono: '🕐',
    descripcion: 'Prácticas desbloqueables por franjas horarias',
    tabla: 'practicas_horario',
    query: 'SELECT * FROM practicas_horario ORDER BY hora_inicio'
  },
  {
    codigo: 'laboratorio_ideas',
    titulo: '💡 Laboratorio de Ideas',
    icono: '💡',
    descripcion: 'Backlog de prácticas + sync con ClickUp',
    tabla: 'ideas_practicas',
    query: 'SELECT * FROM ideas_practicas ORDER BY prioridad DESC, created_at DESC LIMIT 50'
  },
  {
    codigo: 'tarot_energetico',
    titulo: '🔮 Tarot Energético',
    icono: '🔮',
    descripcion: 'Tarot simbólico no adivinatorio (BETA)',
    tabla: 'tarot_cartas',
    query: 'SELECT * FROM tarot_cartas WHERE activo = true ORDER BY nombre'
  },
  {
    codigo: 'editor_pantallas',
    titulo: '🎨 Editor Visual',
    icono: '🎨',
    descripcion: 'Editor visual de pantallas HTML del portal',
    tabla: 'pantallas',
    query: 'SELECT id, nombre, tipo, orden FROM pantallas ORDER BY orden'
  },
  {
    codigo: 'timeline_30dias',
    titulo: '📅 Timeline 30 Días',
    icono: '📅',
    descripcion: 'Historial visual de 30 días del alumno',
    tabla: null,
    query: null
  },
  {
    codigo: 'altar_personal',
    titulo: '🕯️ Altar Personal',
    icono: '🕯️',
    descripcion: 'Espacio personal con símbolos y elementos favoritos',
    tabla: 'altares',
    query: 'SELECT COUNT(*) as total FROM altares WHERE activo = true'
  },
  {
    codigo: 'puntos_compasion',
    titulo: '💚 Puntos de Compasión',
    icono: '💚',
    descripcion: 'Prácticas para los demás y recompensas',
    tabla: 'practicas_compasion',
    query: 'SELECT COUNT(*) as total, SUM(1) as practicas FROM practicas_compasion'
  },
  {
    codigo: 'notificaciones_prefs',
    titulo: '🔔 Preferencias Notificaciones',
    icono: '🔔',
    descripcion: 'Centro de control de notificaciones',
    tabla: 'notificaciones_preferencias',
    query: 'SELECT COUNT(*) as total FROM notificaciones_preferencias'
  },
  {
    codigo: 'maestro_interior',
    titulo: '🧘 Maestro Interior',
    icono: '🧘',
    descripcion: 'IA local entrenada con iluminaciones del alumno',
    tabla: 'maestro_insights',
    query: 'SELECT COUNT(DISTINCT alumno_id) as alumnos, COUNT(*) as insights FROM maestro_insights'
  },
  {
    codigo: 'sellos_ascension',
    titulo: '🏆 Sellos de Ascensión',
    icono: '🏆',
    descripcion: 'Ceremonias y sellos en transiciones importantes',
    tabla: 'sellos_ascension',
    query: 'SELECT * FROM sellos_ascension WHERE activo = true ORDER BY nivel_desde'
  }
];

// Función genérica para renderizar módulos
async function renderModuloGenerico(moduloConfig) {
  return async function(request, env) {
    try {
      const moduloActivo = await isActivo(moduloConfig.codigo);
      
      let datos = null;
      let estadisticas = { total: 0 };
      
      if (moduloConfig.query) {
        try {
          const result = await query(moduloConfig.query);
          datos = result.rows;
          if (datos.length > 0 && datos[0].total !== undefined) {
            estadisticas.total = datos[0].total;
          } else {
            estadisticas.total = datos.length;
          }
        } catch (error) {
          console.error(`Error consultando ${moduloConfig.tabla}:`, error);
        }
      }

      const content = `
        <div class="px-4 py-5 sm:p-6">
          <div class="flex justify-between items-center mb-6">
            <div>
              <h2 class="text-2xl font-bold text-white mb-2">${moduloConfig.titulo}</h2>
              <p class="text-slate-400">${moduloConfig.descripcion}</p>
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

          <!-- Estadísticas -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
              <div class="text-indigo-400 text-2xl font-bold">${estadisticas.total || 0}</div>
              <div class="text-slate-300 text-sm">Registros Totales</div>
            </div>
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
              <div class="text-purple-400 text-2xl font-bold">${moduloActivo ? 'SI' : 'NO'}</div>
              <div class="text-slate-300 text-sm">Estado del Módulo</div>
            </div>
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-lg">
              <div class="text-green-400 text-2xl font-bold">V6.1</div>
              <div class="text-slate-300 text-sm">Versión</div>
            </div>
          </div>

          <!-- Contenido principal -->
          <div class="bg-slate-800 border border-slate-700 rounded-lg p-8">
            ${datos && datos.length > 0 ? `
              <h3 class="text-lg font-bold text-white mb-4">Datos Registrados</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-slate-300">
                  <thead class="text-xs text-slate-400 uppercase bg-slate-900">
                    <tr>
                      ${Object.keys(datos[0]).slice(0, 5).map(key => 
                        `<th class="px-4 py-3">${key}</th>`
                      ).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${datos.slice(0, 10).map(row => `
                      <tr class="border-b border-slate-700">
                        ${Object.values(row).slice(0, 5).map(val => 
                          `<td class="px-4 py-3">${val !== null ? String(val).substring(0, 50) : '-'}</td>`
                        ).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ${datos.length > 10 ? `
                <p class="text-slate-500 text-sm mt-4">Mostrando 10 de ${datos.length} registros</p>
              ` : ''}
            ` : `
              <div class="text-center py-8">
                <div class="text-6xl mb-4">${moduloConfig.icono}</div>
                <h3 class="text-lg font-medium text-white mb-2">${moduloConfig.titulo}</h3>
                <p class="text-slate-400">Módulo listo para usar</p>
                <p class="text-slate-500 text-sm mt-2">No hay datos aún o el módulo no requiere visualización de datos</p>
              </div>
            `}
          </div>

          <!-- Acciones -->
          <div class="mt-6 flex gap-4">
            <button class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg">
              ➕ Crear Nuevo
            </button>
            <button class="px-6 py-3 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors">
              🔄 Recargar
            </button>
          </div>
        </div>
      `;

      const html = replace(baseTemplate, {
        TITLE: moduloConfig.titulo,
        CONTENT: content
      });

      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      });
    } catch (error) {
      console.error(`Error renderizando ${moduloConfig.codigo}:`, error);
      return new Response(`Error interno del servidor: ${error.message}`, { status: 500 });
    }
  };
}

// Exportar todas las funciones
export const renderCirculosAuri = renderModuloGenerico(modulosV61[0]);
export const renderDiarioAurelin = renderModuloGenerico(modulosV61[1]);
export const renderPracticasHorario = renderModuloGenerico(modulosV61[2]);
export const renderLaboratorioIdeas = renderModuloGenerico(modulosV61[3]);
export const renderTarotEnergetico = renderModuloGenerico(modulosV61[4]);
export const renderEditorPantallas = renderModuloGenerico(modulosV61[5]);
export const renderTimeline30Dias = renderModuloGenerico(modulosV61[6]);
export const renderAltarPersonal = renderModuloGenerico(modulosV61[7]);
export const renderPuntosCompasion = renderModuloGenerico(modulosV61[8]);
export const renderNotificacionesPrefs = renderModuloGenerico(modulosV61[9]);
export const renderMaestroInterior = renderModuloGenerico(modulosV61[10]);
export const renderSellosAscension = renderModuloGenerico(modulosV61[11]);



