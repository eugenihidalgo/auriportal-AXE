// src/endpoints/admin-panel-auricalendar.js
// Calendario de prácticas y actividad de los alumnos

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
 * GET /admin/auricalendar - Calendario de actividad
 */
export async function renderAuricalendar(request, env) {
  try {
    const url = new URL(request.url);
    const alumno_id = url.searchParams.get('alumno_id');
    const mes = url.searchParams.get('mes') || new Date().getMonth() + 1;
    const anio = url.searchParams.get('anio') || new Date().getFullYear();

    // Obtener lista de alumnos
    const alumnos = await query(
      `SELECT id, email, apodo, COALESCE(apodo, email) as nombre FROM alumnos ORDER BY COALESCE(apodo, email)`
    );

    // Construir el calendario del mes
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    const diasEnMes = ultimoDia.getDate();
    const primerDiaSemana = primerDia.getDay(); // 0 = domingo

    // Obtener datos del mes
    let datosQuery = `
      SELECT 
        DATE(fecha) as fecha,
        COUNT(*) as num_practicas
      FROM practicas
      WHERE EXTRACT(MONTH FROM fecha) = $1
        AND EXTRACT(YEAR FROM fecha) = $2
    `;
    
    const params = [mes, anio];
    if (alumno_id) {
      datosQuery += ` AND alumno_id = $3`;
      params.push(alumno_id);
    }
    
    datosQuery += ` GROUP BY DATE(fecha) ORDER BY fecha`;
    
    const practicas = await query(datosQuery, params);
    
    // Mapear prácticas por fecha
    const practicasMap = {};
    practicas.rows.forEach(p => {
      const fecha = new Date(p.fecha).toISOString().split('T')[0];
      practicasMap[fecha] = parseInt(p.num_practicas);
    });

    // Obtener logros del mes
    let logrosQuery = `
      SELECT 
        DATE(fecha_obtenido) as fecha,
        COUNT(*) as num_logros
      FROM logros
      WHERE EXTRACT(MONTH FROM fecha_obtenido) = $1
        AND EXTRACT(YEAR FROM fecha_obtenido) = $2
    `;
    
    const logrosParams = [mes, anio];
    if (alumno_id) {
      logrosQuery += ` AND alumno_id = $3`;
      logrosParams.push(alumno_id);
    }
    
    logrosQuery += ` GROUP BY DATE(fecha_obtenido)`;
    
    const logros = await query(logrosQuery, logrosParams);
    
    const logrosMap = {};
    logros.rows.forEach(l => {
      const fecha = new Date(l.fecha).toISOString().split('T')[0];
      logrosMap[fecha] = parseInt(l.num_logros);
    });

    // Generar días del calendario
    let diasHTML = [];
    
    // Días vacíos al inicio
    for (let i = 0; i < primerDiaSemana; i++) {
      diasHTML.push('<div class="bg-slate-750"></div>');
    }
    
    // Días del mes
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fecha = new Date(anio, mes - 1, dia);
      const fechaStr = fecha.toISOString().split('T')[0];
      const numPracticas = practicasMap[fechaStr] || 0;
      const numLogros = logrosMap[fechaStr] || 0;
      const esHoy = fechaStr === new Date().toISOString().split('T')[0];
      
      let bgColor = 'bg-slate-800';
      if (numPracticas > 0) {
        if (numPracticas >= 3) bgColor = 'bg-green-100';
        else if (numPracticas >= 2) bgColor = 'bg-yellow-100';
        else bgColor = 'bg-blue-50';
      }
      
      diasHTML.push(`
        <div class="${bgColor} border ${esHoy ? 'border-indigo-500 border-2' : 'border-slate-700'} p-2 min-h-[80px] hover:shadow-md transition">
          <div class="font-semibold text-sm ${esHoy ? 'text-indigo-600' : 'text-slate-200'}">${dia}</div>
          ${numPracticas > 0 ? `
            <div class="text-xs text-green-700 mt-1">
              📝 ${numPracticas} práctica${numPracticas > 1 ? 's' : ''}
            </div>
          ` : ''}
          ${numLogros > 0 ? `
            <div class="text-xs text-yellow-700">
              🏆 ${numLogros} logro${numLogros > 1 ? 's' : ''}
            </div>
          ` : ''}
        </div>
      `);
    }

    // Navegación de meses
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anioAnterior = mes === 1 ? anio - 1 : anio;
    const mesSiguiente = mes === 12 ? 1 : mes + 1;
    const anioSiguiente = mes === 12 ? parseInt(anio) + 1 : anio;

    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">Auricalendar</h2>

        <!-- Filtros -->
        <div class="bg-slate-800 border rounded-lg p-4 mb-4">
          <form method="GET" action="/admin/auricalendar" class="flex gap-3 items-end flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <label class="block text-sm font-medium mb-1">Alumno</label>
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
              <label class="block text-sm font-medium mb-1">Mes</label>
              <select name="mes" class="border rounded px-3 py-2">
                ${nombresMeses.map((nombre, idx) => `
                  <option value="${idx + 1}" ${mes == (idx + 1) ? 'selected' : ''}>${nombre}</option>
                `).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Año</label>
              <input type="number" name="anio" value="${anio}" class="border rounded px-3 py-2" min="2020" max="2030">
            </div>
            <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
              Ver
            </button>
          </form>
        </div>

        <!-- Navegación de meses -->
        <div class="flex justify-between items-center mb-4">
          <a href="/admin/auricalendar?mes=${mesAnterior}&anio=${anioAnterior}${alumno_id ? '&alumno_id=' + alumno_id : ''}" 
             class="text-indigo-600 hover:text-indigo-800">
            ← ${nombresMeses[mesAnterior - 1]} ${anioAnterior}
          </a>
          <h3 class="text-xl font-bold">${nombresMeses[mes - 1]} ${anio}</h3>
          <a href="/admin/auricalendar?mes=${mesSiguiente}&anio=${anioSiguiente}${alumno_id ? '&alumno_id=' + alumno_id : ''}" 
             class="text-indigo-600 hover:text-indigo-800">
            ${nombresMeses[mesSiguiente - 1]} ${anioSiguiente} →
          </a>
        </div>

        <!-- Calendario -->
        <div class="bg-slate-800 border rounded-lg p-4">
          <!-- Cabecera días de la semana -->
          <div class="grid grid-cols-7 gap-1 mb-2">
            ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(dia => `
              <div class="text-center font-semibold text-sm text-slate-300 p-2">${dia}</div>
            `).join('')}
          </div>
          
          <!-- Días del mes -->
          <div class="grid grid-cols-7 gap-1">
            ${diasHTML.join('')}
          </div>
        </div>

        <!-- Leyenda -->
        <div class="mt-4 flex gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-blue-50 border"></div>
            <span>1 práctica</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-yellow-100 border"></div>
            <span>2 prácticas</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-green-100 border"></div>
            <span>3+ prácticas</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 border-2 border-indigo-500"></div>
            <span>Hoy</span>
          </div>
        </div>
      </div>
    `;

    return new Response(
      replace(baseTemplate, {
        TITLE: 'Auricalendar - Admin',
        CONTENT: content
      }),
      {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      }
    );
  } catch (error) {
    console.error('❌ Error en renderAuricalendar:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
}

