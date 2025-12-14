// src/endpoints/admin-transmutaciones-proyectos.js
// Vista informativa de Proyectos Activados (solo lectura)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../../database/pg.js';

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
 * Obtener todos los proyectos activados de alumnos con suscripción activa
 */
async function obtenerProyectosActivados() {
  try {
    const result = await query(
      `SELECT 
        ap.id,
        ap.nombre,
        ap.descripcion,
        ap.activo,
        ap.created_at,
        ap.updated_at,
        a.id as alumno_id,
        a.nombre_completo,
        a.apodo,
        a.email
       FROM alumnos_proyectos ap
       INNER JOIN alumnos a ON ap.alumno_id = a.id
       WHERE ap.activo = true 
         AND a.estado_suscripcion = 'activa'
       ORDER BY a.nombre_completo ASC, ap.nombre ASC`
    );
    return result.rows || [];
  } catch (error) {
    console.error('Error obteniendo proyectos activados:', error);
    return [];
  }
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

export async function renderTransmutacionesProyectos(request, env) {
  try {
    // Obtener proyectos activados
    const proyectos = await obtenerProyectosActivados();
    
    // Generar HTML de la tabla
    const proyectosHTML = proyectos.length > 0
      ? proyectos.map(p => {
          const nombreAlumno = escapeHtml(p.nombre_completo || p.apodo || p.email || 'Sin nombre');
          const nombreProyecto = escapeHtml(p.nombre || 'Sin nombre');
          const descripcion = escapeHtml(p.descripcion || 'Sin descripción');
          const fechaCreacion = p.created_at ? new Date(p.created_at).toLocaleDateString('es-ES') : 'N/A';
          
          return `
            <tr class="border-b border-slate-700 hover:bg-slate-700">
              <td class="py-3 text-white font-medium">${nombreProyecto}</td>
              <td class="py-3 text-slate-300">${descripcion}</td>
              <td class="py-3 text-slate-300">${nombreAlumno}</td>
              <td class="py-3 text-slate-400 text-sm">${fechaCreacion}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="4" class="py-8 text-center text-slate-400">No hay proyectos activados</td></tr>';
    
    const content = `
      <div class="p-6">
        <h1 class="text-3xl font-bold text-white mb-6">🎯 Proyectos Activados</h1>
        <p class="text-slate-400 mb-6">
          Vista informativa de todos los proyectos activados por alumnos con suscripción activa. 
          Los alumnos gestionan sus proyectos desde su perfil personal.
        </p>
        
        <div class="bg-slate-800 rounded-lg p-6">
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-slate-700">
                  <th class="pb-3 text-slate-300 font-semibold">Nombre del Proyecto</th>
                  <th class="pb-3 text-slate-300 font-semibold">Descripción</th>
                  <th class="pb-3 text-slate-300 font-semibold">Alumno</th>
                  <th class="pb-3 text-slate-300 font-semibold">Fecha de Creación</th>
                </tr>
              </thead>
              <tbody>
                ${proyectosHTML}
              </tbody>
            </table>
          </div>
          
          <div class="mt-4 text-sm text-slate-400">
            Total: ${proyectos.length} proyecto${proyectos.length !== 1 ? 's' : ''} activado${proyectos.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    `;
    
    return new Response(
      replace(baseTemplate, {
        TITLE: 'Proyectos Activados',
        CONTENT: content
      }),
      {
        headers: { 
          'Content-Type': 'text/html; charset=UTF-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    console.error('❌ Error en renderTransmutacionesProyectos:', error);
    return new Response(
      `Error interno del servidor: ${error.message}`,
      { status: 500 }
    );
  }
}

export default renderTransmutacionesProyectos;
