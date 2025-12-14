// src/endpoints/admin-niveles-energeticos.js
// Gestión de Niveles Energéticos (Fases y Rangos)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../../database/pg.js';
import { requireAdminAuth } from '../modules/admin-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar templates
const baseTemplatePath = join(__dirname, '../core/html/admin/base.html');
const baseTemplate = readFileSync(baseTemplatePath, 'utf-8');

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
 * GET /admin/niveles-energeticos - Vista de gestión de niveles
 * POST /admin/niveles-energeticos - Actualizar niveles
 */
export async function renderNivelesEnergeticos(request, env) {
  try {
    // Verificar autenticación
    const authCheck = requireAdminAuth(request);
    if (authCheck.requiresAuth) {
      return authCheck.response;
    }

    if (request.method === 'POST') {
      return await handleUpdateNiveles(request, env);
    }

    // Obtener todos los niveles
    const niveles = await query(`
      SELECT * FROM niveles_fases 
      ORDER BY 
        CASE WHEN nivel_min IS NULL THEN 999 ELSE nivel_min END ASC,
        CASE WHEN nivel_max IS NULL THEN 999 ELSE nivel_max END ASC
    `);

    const content = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h1 class="text-3xl font-bold text-white">⚡ Niveles Energéticos</h1>
          <button onclick="agregarNuevoNivel()" 
                  class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            ➕ Agregar Nueva Fase
          </button>
        </div>

        <div class="bg-slate-800 rounded-lg p-6">
          <p class="text-slate-300 mb-4">
            Gestiona los rangos de niveles y sus fases. Define desde qué nivel hasta qué nivel corresponde cada fase (Sanación, Sanación Avanzada, Canalización, Creación, etc.).
          </p>

          <div id="niveles-container" class="space-y-4">
            ${niveles.rows.map((nivel, index) => `
              <div class="bg-slate-700 rounded-lg p-4 nivel-item" data-id="${nivel.id}">
                <div class="grid grid-cols-12 gap-4 items-center">
                  <div class="col-span-3">
                    <label class="block text-sm font-medium text-slate-300 mb-1">Fase</label>
                    <input type="text" 
                           name="fase_${nivel.id}" 
                           value="${nivel.fase || ''}" 
                           class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                           required>
                  </div>
                  <div class="col-span-2">
                    <label class="block text-sm font-medium text-slate-300 mb-1">Nivel Mín</label>
                    <input type="number" 
                           name="nivel_min_${nivel.id}" 
                           value="${nivel.nivel_min || ''}" 
                           class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                           placeholder="Ej: 1">
                  </div>
                  <div class="col-span-2">
                    <label class="block text-sm font-medium text-slate-300 mb-1">Nivel Máx</label>
                    <input type="number" 
                           name="nivel_max_${nivel.id}" 
                           value="${nivel.nivel_max || ''}" 
                           class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                           placeholder="Ej: 6">
                  </div>
                  <div class="col-span-4">
                    <label class="block text-sm font-medium text-slate-300 mb-1">Descripción</label>
                    <input type="text" 
                           name="descripcion_${nivel.id}" 
                           value="${nivel.descripcion || ''}" 
                           class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                           placeholder="Ej: Sanación Experto">
                  </div>
                  <div class="col-span-1 flex justify-end">
                    <button onclick="eliminarNivel(${nivel.id})" 
                            class="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 transition-colors">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button onclick="guardarNiveles()" 
                    class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium">
              💾 Guardar Cambios
            </button>
          </div>
        </div>
      </div>

      <script>
        function agregarNuevoNivel() {
          const container = document.getElementById('niveles-container');
          const nuevoId = 'nuevo_' + Date.now();
          const nuevoNivel = document.createElement('div');
          nuevoNivel.className = 'bg-slate-700 rounded-lg p-4 nivel-item';
          nuevoNivel.dataset.id = nuevoId;
          nuevoNivel.innerHTML = \`
            <div class="grid grid-cols-12 gap-4 items-center">
              <div class="col-span-3">
                <label class="block text-sm font-medium text-slate-300 mb-1">Fase</label>
                <input type="text" 
                       name="fase_\${nuevoId}" 
                       value="" 
                       class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                       required>
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-slate-300 mb-1">Nivel Mín</label>
                <input type="number" 
                       name="nivel_min_\${nuevoId}" 
                       value="" 
                       class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                       placeholder="Ej: 1">
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-slate-300 mb-1">Nivel Máx</label>
                <input type="number" 
                       name="nivel_max_\${nuevoId}" 
                       value="" 
                       class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                       placeholder="Ej: 6">
              </div>
              <div class="col-span-4">
                <label class="block text-sm font-medium text-slate-300 mb-1">Descripción</label>
                <input type="text" 
                       name="descripcion_\${nuevoId}" 
                       value="" 
                       class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                       placeholder="Ej: Sanación Experto">
              </div>
              <div class="col-span-1 flex justify-end">
                <button onclick="this.closest('.nivel-item').remove()" 
                        class="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 transition-colors">
                  🗑️
                </button>
              </div>
            </div>
          \`;
          container.appendChild(nuevoNivel);
        }

        function eliminarNivel(id) {
          if (confirm('¿Estás seguro de eliminar esta fase?')) {
            const item = document.querySelector(\`[data-id="\${id}"]\`);
            if (item) {
              item.remove();
            }
          }
        }

        async function guardarNiveles() {
          const items = document.querySelectorAll('.nivel-item');
          const niveles = [];

          items.forEach(item => {
            const id = item.dataset.id;
            const fase = item.querySelector(\`[name^="fase_"]\`).value;
            const nivelMin = item.querySelector(\`[name^="nivel_min_"]\`).value || null;
            const nivelMax = item.querySelector(\`[name^="nivel_max_"]\`).value || null;
            const descripcion = item.querySelector(\`[name^="descripcion_"]\`).value || '';

            if (fase) {
              niveles.push({
                id: id.startsWith('nuevo_') ? null : parseInt(id),
                fase,
                nivel_min: nivelMin ? parseInt(nivelMin) : null,
                nivel_max: nivelMax ? parseInt(nivelMax) : null,
                descripcion
              });
            }
          });

          try {
            const response = await fetch('/admin/niveles-energeticos', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ niveles })
            });

            if (response.ok) {
              alert('✅ Niveles guardados correctamente');
              location.reload();
            } else {
              const error = await response.text();
              alert('❌ Error: ' + error);
            }
          } catch (error) {
            alert('❌ Error: ' + error.message);
          }
        }
      </script>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Niveles Energéticos',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('❌ Error en renderNivelesEnergeticos:', error);
    return new Response('Error interno del servidor: ' + error.message, { status: 500 });
  }
}

/**
 * Manejar actualización de niveles
 */
async function handleUpdateNiveles(request, env) {
  try {
    const body = await request.json();
    const { niveles } = body;

    // Procesar cada nivel
    for (const nivel of niveles) {
      if (nivel.id) {
        // Actualizar existente
        await query(`
          UPDATE niveles_fases 
          SET fase = $1, nivel_min = $2, nivel_max = $3, descripcion = $4
          WHERE id = $5
        `, [nivel.fase, nivel.nivel_min, nivel.nivel_max, nivel.descripcion, nivel.id]);
      } else {
        // Insertar nuevo
        await query(`
          INSERT INTO niveles_fases (fase, nivel_min, nivel_max, descripcion)
          VALUES ($1, $2, $3, $4)
        `, [nivel.fase, nivel.nivel_min, nivel.nivel_max, nivel.descripcion]);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error en handleUpdateNiveles:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



















