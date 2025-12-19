// src/endpoints/admin-iad-alumnos.js
// Endpoints del Admin Panel para I+D de los alumnos (Aspectos Personalizados)

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

// ============================================
// I+D DE LOS ALUMNOS - ASPECTOS PERSONALIZADOS
// ============================================

export async function renderIadAlumnos(request, env) {
  // Obtener todos los aspectos personalizados con información de alumnos
  let aspectos;
  try {
    aspectos = await query(`
      SELECT ap.*, 
             a.email, a.apodo, a.nombre_completo, a.nivel_actual,
             COUNT(ape.id) as veces_limpiado
      FROM aspectos_personalizados ap
      JOIN alumnos a ON ap.alumno_creador_id = a.id
      LEFT JOIN aspectos_personalizados_estado ape ON ape.aspecto_id = ap.id AND ape.ultima_limpieza IS NOT NULL
      WHERE ap.activo = true
      GROUP BY ap.id, a.id
      ORDER BY ap.created_at DESC
    `);
  } catch (error) {
    console.error('Error obteniendo aspectos personalizados:', error);
    aspectos = { rows: [] };
  }

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">✨ I+D de los alumnos</h1>
      
      <div class="bg-slate-800 rounded-lg p-6 mb-6">
        <p class="text-slate-300 text-lg leading-relaxed">
          Este es el lugar donde los alumnos pueden crear y gestionar sus propios aspectos energéticos personalizados,
          sus iluminaciones y descubrimientos personales. Aquí puedes ver y administrar todos los aspectos creados por los alumnos.
        </p>
      </div>

      <div class="bg-slate-800 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-white mb-4">Aspectos Personalizados</h2>
        
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="pb-3 text-slate-300 font-semibold">Alumno</th>
                <th class="pb-3 text-slate-300 font-semibold">Nombre del Aspecto</th>
                <th class="pb-3 text-slate-300 font-semibold">Descripción</th>
                <th class="pb-3 text-slate-300 font-semibold">Frecuencia (días)</th>
                <th class="pb-3 text-slate-300 font-semibold">Veces Limpiado</th>
                <th class="pb-3 text-slate-300 font-semibold">Activo</th>
                <th class="pb-3 text-slate-300 font-semibold">Creado</th>
              </tr>
            </thead>
            <tbody>
              ${aspectos.rows.length > 0 ? aspectos.rows.map(ap => `
                <tr class="border-b border-slate-700 hover:bg-slate-700">
                  <td class="py-3 text-white">
                    <div class="font-semibold">${ap.apodo || ap.nombre_completo || ap.email}</div>
                    <div class="text-xs text-slate-400">Nivel ${ap.nivel_actual || 1}</div>
                  </td>
                  <td class="py-3 text-white font-semibold">${ap.nombre || 'N/A'}</td>
                  <td class="py-3 text-slate-300">${ap.descripcion || '-'}</td>
                  <td class="py-3 text-slate-300">${ap.frecuencia_dias || 14}</td>
                  <td class="py-3 text-slate-300">${ap.veces_limpiado || 0}</td>
                  <td class="py-3">
                    <span class="px-2 py-1 rounded text-xs ${ap.activo ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}">
                      ${ap.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td class="py-3 text-slate-400 text-sm">
                    ${new Date(ap.created_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" class="py-8 text-center text-slate-400">
                    Aún no hay aspectos personalizados creados por los alumnos.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const html = replaceAdminTemplate(baseTemplate, {
    TITLE: 'I+D de los alumnos',
    CONTENT: content
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

