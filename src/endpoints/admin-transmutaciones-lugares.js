// src/endpoints/admin-transmutaciones-lugares.js
// Vista informativa de Lugares Activados (solo lectura)

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
 * Obtener todos los lugares activados de alumnos con suscripción activa
 */
async function obtenerLugaresActivados() {
  try {
    const result = await query(
      `SELECT 
        al.id,
        al.nombre,
        al.descripcion,
        al.activo,
        al.created_at,
        al.updated_at,
        a.id as alumno_id,
        a.nombre_completo,
        a.apodo,
        a.email
       FROM alumnos_lugares al
       INNER JOIN alumnos a ON al.alumno_id = a.id
       WHERE al.activo = true 
         AND a.estado_suscripcion = 'activa'
       ORDER BY a.nombre_completo ASC, al.nombre ASC`
    );
    return result.rows || [];
  } catch (error) {
    console.error('Error obteniendo lugares activados:', error);
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

export async function renderTransmutacionesLugares(request, env) {
  try {
    // Obtener lugares activados
    const lugares = await obtenerLugaresActivados();
    
    // Generar HTML de la tabla
    const lugaresHTML = lugares.length > 0
      ? lugares.map(l => {
          const nombreAlumno = escapeHtml(l.nombre_completo || l.apodo || l.email || 'Sin nombre');
          const nombreLugar = escapeHtml(l.nombre || 'Sin nombre');
          const descripcion = escapeHtml(l.descripcion || 'Sin descripción');
          const fechaCreacion = l.created_at ? new Date(l.created_at).toLocaleDateString('es-ES') : 'N/A';
          
          return `
            <tr class="border-b border-slate-700 hover:bg-slate-700">
              <td class="py-3 text-white font-medium">${nombreLugar}</td>
              <td class="py-3 text-slate-300">${descripcion}</td>
              <td class="py-3 text-slate-300">${nombreAlumno}</td>
              <td class="py-3 text-slate-400 text-sm">${fechaCreacion}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="4" class="py-8 text-center text-slate-400">No hay lugares activados</td></tr>';
    
    const content = `
      <div class="p-6">
        <h1 class="text-3xl font-bold text-white mb-6">🏠 Lugares Activados</h1>
        <p class="text-slate-400 mb-6">
          Vista informativa de todos los lugares activados por alumnos con suscripción activa. 
          Los alumnos gestionan sus lugares desde su perfil personal.
        </p>
        
        <div class="bg-slate-800 rounded-lg p-6">
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-slate-700">
                  <th class="pb-3 text-slate-300 font-semibold">Nombre del Lugar</th>
                  <th class="pb-3 text-slate-300 font-semibold">Descripción (Dirección)</th>
                  <th class="pb-3 text-slate-300 font-semibold">Alumno</th>
                  <th class="pb-3 text-slate-300 font-semibold">Fecha de Creación</th>
                </tr>
              </thead>
              <tbody>
                ${lugaresHTML}
              </tbody>
            </table>
          </div>
          
          <div class="mt-4 text-sm text-slate-400">
            Total: ${lugares.length} lugar${lugares.length !== 1 ? 'es' : ''} activado${lugares.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    `;
    
    return new Response(
      replace(baseTemplate, {
        TITLE: 'Lugares Activados',
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
    console.error('❌ Error en renderTransmutacionesLugares:', error);
    return new Response(
      `Error interno del servidor: ${error.message}`,
      { status: 500 }
    );
  }
}

export default renderTransmutacionesLugares;
