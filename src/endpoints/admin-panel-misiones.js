// src/endpoints/admin-panel-misiones.js
// Gestión de Misiones en el Admin Panel

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
 * GET /admin/misiones - Muestra todas las misiones y su configuración
 */
export async function renderMisiones(request, env) {
  try {
    // Obtener todas las misiones
    const misiones = await query(
      `SELECT * FROM misiones ORDER BY created_at DESC`
    );

    // Obtener aspectos para los selectores
    const aspectos = await query(
      `SELECT id, nombre FROM aspectos_practica ORDER BY nombre`
    );

    // Obtener estadísticas de cumplimiento por misión
    const stats = await query(`
      SELECT 
        m.id,
        m.nombre,
        COUNT(ma.alumno_id) FILTER (WHERE ma.completada = true) as completadas,
        COUNT(ma.alumno_id) as total_alumnos
      FROM misiones m
      LEFT JOIN misiones_alumnos ma ON m.id = ma.mision_id
      GROUP BY m.id, m.nombre
      ORDER BY m.created_at DESC
    `);

    const statsMap = {};
    stats.rows.forEach(s => {
      statsMap[s.id] = {
        completadas: parseInt(s.completadas) || 0,
        total_alumnos: parseInt(s.total_alumnos) || 0
      };
    });

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Gestión de Misiones</h2>
          <button onclick="mostrarModalNuevaMision()" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
            + Nueva Misión
          </button>
        </div>

        ${misiones.rows.length === 0 ? `
          <div class="text-center py-12">
            <p class="text-slate-400">No hay misiones creadas aún.</p>
            <button onclick="mostrarModalNuevaMision()" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
              Crear Primera Misión
            </button>
          </div>
        ` : `
          <div class="space-y-4">
            ${misiones.rows.map(m => {
              const stat = statsMap[m.id] || { completadas: 0, total_alumnos: 0 };
              const porcentaje = stat.total_alumnos > 0 
                ? Math.round((stat.completadas / stat.total_alumnos) * 100) 
                : 0;
              
              return `
                <div class="bg-slate-800 border rounded-lg p-4 shadow-sm">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="flex items-center gap-3">
                        <h3 class="text-lg font-semibold">${m.nombre}</h3>
                        <span class="px-2 py-1 text-xs rounded ${m.activo ? 'bg-green-100 text-green-800' : 'bg-slate-800 text-slate-100'}">
                          ${m.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      <p class="text-sm text-slate-300 mt-1">${m.descripcion || ''}</p>
                      <div class="mt-2 text-xs text-slate-400">
                        Código: <code class="bg-slate-800 px-1 rounded">${m.codigo}</code>
                      </div>
                      
                      ${m.condiciones ? `
                        <div class="mt-3 p-3 bg-slate-750 rounded text-sm">
                          <strong>Condiciones:</strong>
                          <pre class="mt-1 text-xs overflow-auto">${JSON.stringify(JSON.parse(m.condiciones), null, 2)}</pre>
                        </div>
                      ` : ''}
                      
                      ${m.recompensa ? `
                        <div class="mt-2 text-sm">
                          <strong>Recompensa:</strong> ${JSON.stringify(JSON.parse(m.recompensa))}
                        </div>
                      ` : ''}
                    </div>
                    
                    <div class="ml-4 text-right">
                      <div class="text-sm text-slate-300">
                        ${stat.completadas} / ${stat.total_alumnos} alumnos (${porcentaje}%)
                      </div>
                      <div class="mt-2 flex gap-2">
                        <button onclick="editarMision(${m.id})" class="text-indigo-600 hover:text-indigo-800 text-sm">
                          Editar
                        </button>
                        <button onclick="toggleMisionActiva(${m.id}, ${m.activo})" class="text-slate-300 hover:text-slate-100 text-sm">
                          ${m.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Modal para nueva/editar misión -->
      <div id="modalMision" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h3 class="text-xl font-bold mb-4" id="tituloModal">Nueva Misión</h3>
          <form id="formMision" onsubmit="guardarMision(event)">
            <input type="hidden" id="mision_id" name="mision_id">
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">Código</label>
                <input type="text" id="codigo" name="codigo" required 
                  class="w-full border rounded px-3 py-2" 
                  placeholder="ej: mision_7_dias">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Nombre</label>
                <input type="text" id="nombre" name="nombre" required 
                  class="w-full border rounded px-3 py-2" 
                  placeholder="ej: Racha de 7 días">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Descripción</label>
                <textarea id="descripcion" name="descripcion" rows="3" 
                  class="w-full border rounded px-3 py-2" 
                  placeholder="Descripción de la misión"></textarea>
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Condiciones (JSON)</label>
                <textarea id="condiciones" name="condiciones" rows="6" 
                  class="w-full border rounded px-3 py-2 font-mono text-sm" 
                  placeholder='{"tipo": "contador_aspectos", "objetivos": [{"aspecto_id": 1, "min_practicas": 5}]}'></textarea>
                <div class="mt-1 text-xs text-slate-400">
                  Ejemplos:<br>
                  • Contador de aspectos: <code>{"tipo": "contador_aspectos", "objetivos": [{"aspecto_id": 3, "min_practicas": 5}]}</code><br>
                  • Racha: <code>{"tipo": "racha", "min_dias": 7}</code>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Recompensa (JSON, opcional)</label>
                <textarea id="recompensa" name="recompensa" rows="3" 
                  class="w-full border rounded px-3 py-2 font-mono text-sm" 
                  placeholder='{"puntos": 100, "mensaje": "¡Enhorabuena!"}'></textarea>
              </div>
              
              <div class="flex items-center">
                <input type="checkbox" id="activo" name="activo" checked 
                  class="mr-2">
                <label for="activo" class="text-sm font-medium">Misión activa</label>
              </div>
            </div>
            
            <div class="flex justify-end gap-3 mt-6">
              <button type="button" onclick="cerrarModalMision()" 
                class="px-4 py-2 text-slate-200 hover:bg-slate-800 rounded">
                Cancelar
              </button>
              <button type="submit" 
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>

      <script>
        const aspectos = ${JSON.stringify(aspectos.rows)};
        
        function mostrarModalNuevaMision() {
          document.getElementById('modalMision').classList.remove('hidden');
          document.getElementById('tituloModal').textContent = 'Nueva Misión';
          document.getElementById('formMision').reset();
          document.getElementById('mision_id').value = '';
        }
        
        function cerrarModalMision() {
          document.getElementById('modalMision').classList.add('hidden');
        }
        
        async function editarMision(id) {
          try {
            const response = await fetch('/admin/misiones?action=get&id=' + id);
            const data = await response.json();
            
            if (data.success) {
              const m = data.mision;
              document.getElementById('modalMision').classList.remove('hidden');
              document.getElementById('tituloModal').textContent = 'Editar Misión';
              document.getElementById('mision_id').value = m.id;
              document.getElementById('codigo').value = m.codigo;
              document.getElementById('nombre').value = m.nombre;
              document.getElementById('descripcion').value = m.descripcion || '';
              document.getElementById('condiciones').value = m.condiciones ? JSON.stringify(JSON.parse(m.condiciones), null, 2) : '';
              document.getElementById('recompensa').value = m.recompensa ? JSON.stringify(JSON.parse(m.recompensa), null, 2) : '';
              document.getElementById('activo').checked = m.activo;
            }
          } catch (error) {
            console.error('Error al cargar misión:', error);
            alert('Error al cargar la misión');
          }
        }
        
        async function guardarMision(event) {
          event.preventDefault();
          const form = event.target;
          const formData = new FormData(form);
          
          // Validar JSON
          try {
            const condicionesText = formData.get('condiciones');
            if (condicionesText && condicionesText.trim()) {
              JSON.parse(condicionesText);
            }
            const recompensaText = formData.get('recompensa');
            if (recompensaText && recompensaText.trim()) {
              JSON.parse(recompensaText);
            }
          } catch (e) {
            alert('Error en el formato JSON: ' + e.message);
            return;
          }
          
          try {
            const response = await fetch('/admin/misiones', {
              method: 'POST',
              body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
              alert('Misión guardada correctamente');
              window.location.reload();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar la misión');
          }
        }
        
        async function toggleMisionActiva(id, estadoActual) {
          if (!confirm(\`¿Deseas \${estadoActual ? 'desactivar' : 'activar'} esta misión?\`)) {
            return;
          }
          
          try {
            const formData = new FormData();
            formData.append('action', 'toggle_active');
            formData.append('mision_id', id);
            formData.append('activo', !estadoActual);
            
            const response = await fetch('/admin/misiones', {
              method: 'POST',
              body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
              window.location.reload();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            console.error('Error:', error);
            alert('Error al cambiar el estado de la misión');
          }
        }
      </script>
    `;

    return new Response(
      replace(baseTemplate, {
        TITLE: 'Misiones - Admin',
        CONTENT: content
      }),
      {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      }
    );
  } catch (error) {
    console.error('❌ Error en renderMisiones:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
}

/**
 * POST /admin/misiones - Crea o actualiza una misión
 */
export async function handleMisiones(request, env) {
  try {
    const formData = await request.formData();
    const action = formData.get('action');

    // GET de una misión específica
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      const action = url.searchParams.get('action');
      
      if (action === 'get' && id) {
        const result = await query(
          `SELECT * FROM misiones WHERE id = $1`,
          [id]
        );
        
        if (result.rows.length === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Misión no encontrada' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ success: true, mision: result.rows[0] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Toggle activo
    if (action === 'toggle_active') {
      const mision_id = formData.get('mision_id');
      const activo = formData.get('activo') === 'true';
      
      await query(
        `UPDATE misiones SET activo = $1, updated_at = now() WHERE id = $2`,
        [activo, mision_id]
      );
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Crear o actualizar misión
    const mision_id = formData.get('mision_id');
    const codigo = formData.get('codigo');
    const nombre = formData.get('nombre');
    const descripcion = formData.get('descripcion') || null;
    const condicionesText = formData.get('condiciones');
    const recompensaText = formData.get('recompensa');
    const activo = formData.get('activo') === 'on';

    // Validar JSON
    let condiciones = null;
    if (condicionesText && condicionesText.trim()) {
      try {
        condiciones = JSON.parse(condicionesText);
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Condiciones JSON inválido' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    let recompensa = null;
    if (recompensaText && recompensaText.trim()) {
      try {
        recompensa = JSON.parse(recompensaText);
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Recompensa JSON inválido' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (mision_id && mision_id !== '') {
      // Actualizar
      await query(
        `UPDATE misiones 
         SET codigo = $1, nombre = $2, descripcion = $3, condiciones = $4, recompensa = $5, activo = $6, updated_at = now()
         WHERE id = $7`,
        [codigo, nombre, descripcion, JSON.stringify(condiciones), JSON.stringify(recompensa), activo, mision_id]
      );
    } else {
      // Crear
      await query(
        `INSERT INTO misiones (codigo, nombre, descripcion, condiciones, recompensa, activo)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [codigo, nombre, descripcion, JSON.stringify(condiciones), JSON.stringify(recompensa), activo]
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error en handleMisiones:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



