// src/endpoints/admin-panel-logros.js
// Gestión de Logros (Insignias) en el Admin Panel

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
 * GET /admin/logros - Muestra todos los logros y estadísticas
 */
export async function renderLogros(request, env) {
  try {
    // Obtener todas las definiciones de logros
    const logros = await query(
      `SELECT * FROM logros_definicion ORDER BY created_at DESC`
    );

    // Obtener estadísticas de obtención por logro
    const stats = await query(`
      SELECT 
        ld.codigo,
        ld.nombre,
        COUNT(l.id) as total_obtenidos,
        COUNT(DISTINCT l.alumno_id) as alumnos_unicos
      FROM logros_definicion ld
      LEFT JOIN logros l ON ld.codigo = l.codigo_logro
      GROUP BY ld.codigo, ld.nombre
      ORDER BY total_obtenidos DESC
    `);

    const statsMap = {};
    stats.rows.forEach(s => {
      statsMap[s.codigo] = {
        total_obtenidos: parseInt(s.total_obtenidos) || 0,
        alumnos_unicos: parseInt(s.alumnos_unicos) || 0
      };
    });

    // Total de alumnos para calcular porcentajes
    const totalAlumnosResult = await query(`SELECT COUNT(*) as total FROM alumnos`);
    const totalAlumnos = parseInt(totalAlumnosResult.rows[0].total) || 1;

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Gestión de Logros</h2>
          <button onclick="mostrarModalNuevoLogro()" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
            + Nuevo Logro
          </button>
        </div>

        ${logros.rows.length === 0 ? `
          <div class="text-center py-12">
            <p class="text-slate-400">No hay logros creados aún.</p>
            <button onclick="mostrarModalNuevoLogro()" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
              Crear Primer Logro
            </button>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${logros.rows.map(l => {
              const stat = statsMap[l.codigo] || { total_obtenidos: 0, alumnos_unicos: 0 };
              const porcentaje = Math.round((stat.alumnos_unicos / totalAlumnos) * 100);
              
              return `
                <div class="bg-slate-800 border rounded-lg p-4 shadow-sm hover:shadow-md transition">
                  <div class="flex items-start justify-between">
                    <div class="flex items-start gap-3 flex-1">
                      <div class="text-4xl">${l.icono || '🏆'}</div>
                      <div class="flex-1">
                        <h3 class="font-semibold text-lg">${l.nombre}</h3>
                        <p class="text-sm text-slate-300 mt-1">${l.descripcion || ''}</p>
                        <div class="mt-2 text-xs text-slate-400">
                          <code class="bg-slate-800 px-1 rounded">${l.codigo}</code>
                        </div>
                      </div>
                    </div>
                    <span class="px-2 py-1 text-xs rounded ${l.activo ? 'bg-green-100 text-green-800' : 'bg-slate-800 text-slate-100'}">
                      ${l.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  
                  ${l.condiciones ? `
                    <div class="mt-3 p-2 bg-slate-750 rounded text-xs">
                      <strong>Condiciones:</strong>
                      <pre class="mt-1 overflow-auto">${JSON.stringify(JSON.parse(l.condiciones), null, 2)}</pre>
                    </div>
                  ` : ''}
                  
                  <div class="mt-3 pt-3 border-t">
                    <div class="flex justify-between text-sm mb-1">
                      <span>Obtenido por ${stat.alumnos_unicos} alumnos</span>
                      <span class="font-semibold">${porcentaje}%</span>
                    </div>
                    <div class="w-full bg-slate-700 rounded-full h-2">
                      <div class="bg-indigo-600 h-2 rounded-full" style="width: ${porcentaje}%"></div>
                    </div>
                  </div>
                  
                  <div class="mt-3 flex gap-2">
                    <button onclick="editarLogro('${l.codigo}')" class="flex-1 text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded text-sm">
                      Editar
                    </button>
                    <button onclick="toggleLogroActivo('${l.codigo}', ${l.activo})" class="flex-1 text-slate-300 hover:bg-slate-750 px-3 py-1 rounded text-sm">
                      ${l.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Modal para nuevo/editar logro -->
      <div id="modalLogro" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h3 class="text-xl font-bold mb-4" id="tituloModal">Nuevo Logro</h3>
          <form id="formLogro" onsubmit="guardarLogro(event)">
            <input type="hidden" id="codigo_original" name="codigo_original">
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">Código</label>
                <input type="text" id="codigo" name="codigo" required 
                  class="w-full border rounded px-3 py-2" 
                  placeholder="ej: chispa_luz">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Nombre</label>
                <input type="text" id="nombre" name="nombre" required 
                  class="w-full border rounded px-3 py-2" 
                  placeholder="ej: Chispa de Luz">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Descripción</label>
                <textarea id="descripcion" name="descripcion" rows="2" 
                  class="w-full border rounded px-3 py-2" 
                  placeholder="Descripción del logro"></textarea>
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Icono (emoji)</label>
                <input type="text" id="icono" name="icono" 
                  class="w-full border rounded px-3 py-2" 
                  placeholder="🏆" maxlength="4">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Condiciones (JSON)</label>
                <textarea id="condiciones" name="condiciones" rows="6" 
                  class="w-full border rounded px-3 py-2 font-mono text-sm" 
                  placeholder='{"tipo": "racha", "min_dias": 7}'></textarea>
                <div class="mt-1 text-xs text-slate-400">
                  Ejemplos:<br>
                  • Racha: <code>{"tipo": "racha", "min_dias": 7}</code><br>
                  • Prácticas totales: <code>{"tipo": "practicas_total", "min_practicas": 50}</code><br>
                  • Nivel: <code>{"tipo": "nivel", "min_nivel": 5}</code>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Recompensa (JSON, opcional)</label>
                <textarea id="recompensa" name="recompensa" rows="2" 
                  class="w-full border rounded px-3 py-2 font-mono text-sm" 
                  placeholder='{"mensaje": "¡Felicidades!"}'></textarea>
              </div>
              
              <div class="flex items-center">
                <input type="checkbox" id="activo" name="activo" checked 
                  class="mr-2">
                <label for="activo" class="text-sm font-medium">Logro activo</label>
              </div>
            </div>
            
            <div class="flex justify-end gap-3 mt-6">
              <button type="button" onclick="cerrarModalLogro()" 
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
        function mostrarModalNuevoLogro() {
          document.getElementById('modalLogro').classList.remove('hidden');
          document.getElementById('tituloModal').textContent = 'Nuevo Logro';
          document.getElementById('formLogro').reset();
          document.getElementById('codigo_original').value = '';
        }
        
        function cerrarModalLogro() {
          document.getElementById('modalLogro').classList.add('hidden');
        }
        
        async function editarLogro(codigo) {
          try {
            const response = await fetch('/admin/logros?action=get&codigo=' + encodeURIComponent(codigo));
            const data = await response.json();
            
            if (data.success) {
              const l = data.logro;
              document.getElementById('modalLogro').classList.remove('hidden');
              document.getElementById('tituloModal').textContent = 'Editar Logro';
              document.getElementById('codigo_original').value = l.codigo;
              document.getElementById('codigo').value = l.codigo;
              document.getElementById('nombre').value = l.nombre;
              document.getElementById('descripcion').value = l.descripcion || '';
              document.getElementById('icono').value = l.icono || '';
              document.getElementById('condiciones').value = l.condiciones ? JSON.stringify(JSON.parse(l.condiciones), null, 2) : '';
              document.getElementById('recompensa').value = l.recompensa ? JSON.stringify(JSON.parse(l.recompensa), null, 2) : '';
              document.getElementById('activo').checked = l.activo;
            }
          } catch (error) {
            console.error('Error al cargar logro:', error);
            alert('Error al cargar el logro');
          }
        }
        
        async function guardarLogro(event) {
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
            const response = await fetch('/admin/logros', {
              method: 'POST',
              body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
              alert('Logro guardado correctamente');
              window.location.reload();
            } else {
              alert('Error: ' + data.error);
            }
          } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar el logro');
          }
        }
        
        async function toggleLogroActivo(codigo, estadoActual) {
          if (!confirm(\`¿Deseas \${estadoActual ? 'desactivar' : 'activar'} este logro?\`)) {
            return;
          }
          
          try {
            const formData = new FormData();
            formData.append('action', 'toggle_active');
            formData.append('codigo', codigo);
            formData.append('activo', !estadoActual);
            
            const response = await fetch('/admin/logros', {
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
            alert('Error al cambiar el estado del logro');
          }
        }
      </script>
    `;

    return new Response(
      replace(baseTemplate, {
        TITLE: 'Logros - Admin',
        CONTENT: content
      }),
      {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      }
    );
  } catch (error) {
    console.error('❌ Error en renderLogros:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
}

/**
 * POST /admin/logros - Crea o actualiza un logro
 */
export async function handleLogros(request, env) {
  try {
    // GET de un logro específico
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const codigo = url.searchParams.get('codigo');
      const action = url.searchParams.get('action');
      
      if (action === 'get' && codigo) {
        const result = await query(
          `SELECT * FROM logros_definicion WHERE codigo = $1`,
          [codigo]
        );
        
        if (result.rows.length === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Logro no encontrado' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ success: true, logro: result.rows[0] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const formData = await request.formData();
    const action = formData.get('action');

    // Toggle activo
    if (action === 'toggle_active') {
      const codigo = formData.get('codigo');
      const activo = formData.get('activo') === 'true';
      
      await query(
        `UPDATE logros_definicion SET activo = $1, updated_at = now() WHERE codigo = $2`,
        [activo, codigo]
      );
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Crear o actualizar logro
    const codigo_original = formData.get('codigo_original');
    const codigo = formData.get('codigo');
    const nombre = formData.get('nombre');
    const descripcion = formData.get('descripcion') || null;
    const icono = formData.get('icono') || null;
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

    if (codigo_original && codigo_original !== '') {
      // Actualizar
      await query(
        `UPDATE logros_definicion 
         SET codigo = $1, nombre = $2, descripcion = $3, icono = $4, condiciones = $5, recompensa = $6, activo = $7, updated_at = now()
         WHERE codigo = $8`,
        [codigo, nombre, descripcion, icono, JSON.stringify(condiciones), JSON.stringify(recompensa), activo, codigo_original]
      );
    } else {
      // Crear
      await query(
        `INSERT INTO logros_definicion (codigo, nombre, descripcion, icono, condiciones, recompensa, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [codigo, nombre, descripcion, icono, JSON.stringify(condiciones), JSON.stringify(recompensa), activo]
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error en handleLogros:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



