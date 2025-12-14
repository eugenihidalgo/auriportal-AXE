// src/endpoints/admin-registros-karmicos.js
// Endpoints del Admin Panel para Registros y Karmas

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { 
  listarAspectosKarmicosGlobales,
  crearAspectoKarmicoRapido,
  actualizarAspectoKarmicoDetalle,
  getAspectosKarmicosAlumno,
  getEstadisticasLimpiezaKarmica,
  getAlumnosPorAspectoKarmico,
  marcarTodosAlumnosLimpiosPorAspectoKarmico
} from '../services/aspectos-karmicos.js';
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

// ============================================
// REGISTROS Y KARMAS - LIMPIEZAS Y PROCESOS
// ============================================

export async function renderRegistrosKarmicos(request, env) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const alumnoId = url.searchParams.get('alumno_id');

  // POST: Crear registro kármico rápido
  if (request.method === 'POST' && action === 'create_rapido') {
    try {
      const contentType = request.headers.get('content-type') || '';
      let nombre = '';
      
      if (contentType.includes('application/json')) {
        const body = await request.json();
        nombre = body.nombre || '';
      } else {
        try {
          const formData = await request.formData();
          nombre = formData.get('nombre') || '';
        } catch (e) {
          console.error('[POST create_rapido] Error parseando FormData:', e);
        }
      }
      
      nombre = nombre ? String(nombre).trim() : '';
      
      if (!nombre || nombre === '') {
        return new Response(JSON.stringify({ error: 'Nombre requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const id = await crearAspectoKarmicoRapido(nombre);
      
      return new Response(JSON.stringify({ success: true, id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[POST create_rapido] ❌ Error:', error);
      return new Response(JSON.stringify({ error: error.message || 'Error interno del servidor' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST: Marcar todos los alumnos de un aspecto como limpios
  if (request.method === 'POST' && action === 'marcar_todos_limpios') {
    try {
      const contentType = request.headers.get('content-type') || '';
      let aspectoId = null;
      
      if (contentType.includes('application/json')) {
        const body = await request.json();
        aspectoId = parseInt(body.aspecto_id);
      } else {
        aspectoId = parseInt(url.searchParams.get('aspecto_id'));
      }
      
      if (!aspectoId || isNaN(aspectoId)) {
        return new Response(JSON.stringify({ error: 'aspecto_id requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const resultado = await marcarTodosAlumnosLimpiosPorAspectoKarmico(aspectoId);
      
      return new Response(JSON.stringify(resultado), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[POST marcar_todos_limpios] ❌ Error:', error);
      return new Response(JSON.stringify({ error: error.message || 'Error interno del servidor' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET: Ver alumnos por aspecto
  if (action === 'ver_alumnos') {
    const aspectoId = url.searchParams.get('aspecto_id');
    if (!aspectoId) {
      return new Response(JSON.stringify({ error: 'aspecto_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const alumnos = await getAlumnosPorAspectoKarmico(parseInt(aspectoId));
    const aspecto = (await query(`SELECT nombre FROM aspectos_karmicos WHERE id = $1`, [aspectoId])).rows[0];
    
    // Agrupar por estado
    const limpios = alumnos.filter(a => a.estado_calculado === 'limpio');
    const pendientes = alumnos.filter(a => a.estado_calculado === 'pendiente');
    const olvidados = alumnos.filter(a => a.estado_calculado === 'olvidado');
    
    const html = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold text-white">Ver por cada alumno: ${aspecto?.nombre || 'Aspecto'}</h1>
          <button onclick="window.closeModalAlumnos()" class="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700">
            Cerrar
          </button>
        </div>
        
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-green-900/30 rounded-lg p-4 border border-green-700">
            <div class="text-2xl font-bold text-green-400">${limpios.length}</div>
            <div class="text-sm text-green-300">Limpiados</div>
          </div>
          <div class="bg-yellow-900/30 rounded-lg p-4 border border-yellow-700">
            <div class="text-2xl font-bold text-yellow-400">${pendientes.length}</div>
            <div class="text-sm text-yellow-300">Pendientes</div>
          </div>
          <div class="bg-red-900/30 rounded-lg p-4 border border-red-700">
            <div class="text-2xl font-bold text-red-400">${olvidados.length}</div>
            <div class="text-sm text-red-300">Olvidados</div>
          </div>
        </div>
        
        <!-- Tabla con alumnos en columnas por estado -->
        <div class="grid grid-cols-3 gap-4">
          <!-- Columna Limpiados -->
          <div>
            <h2 class="text-lg font-semibold text-green-300 mb-3 sticky top-0 bg-slate-800 py-2 z-10">✅ Limpiados (${limpios.length})</h2>
            <div class="space-y-2 max-h-[60vh] overflow-y-auto">
              ${limpios.length > 0 ? limpios.map(al => `
                <div class="bg-green-900/20 rounded p-3 border border-green-800">
                  <div class="font-semibold text-white mb-1">${(al.apodo || al.nombre_completo || al.email).replace(/'/g, "&#39;")}</div>
                  <div class="text-xs text-green-300 mb-2">Nivel ${al.nivel_actual || 1} • ${al.dias_desde_limpieza || 0} días</div>
                  <button onclick="marcarLimpioDirecto('karmicos', ${aspectoId}, ${al.alumno_id}, '${(al.apodo || al.email || '').replace(/'/g, "\\'")}')" 
                          class="w-full px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                    ✅ Marcar limpiado
                  </button>
                </div>
              `).join('') : '<p class="text-slate-400 text-sm">No hay alumnos limpiados</p>'}
            </div>
          </div>
          
          <!-- Columna Pendientes -->
          <div>
            <h2 class="text-lg font-semibold text-yellow-300 mb-3 sticky top-0 bg-slate-800 py-2 z-10">⏳ Pendientes (${pendientes.length})</h2>
            <div class="space-y-2 max-h-[60vh] overflow-y-auto">
              ${pendientes.length > 0 ? pendientes.map(al => `
                <div class="bg-yellow-900/20 rounded p-3 border border-yellow-800">
                  <div class="font-semibold text-white mb-1">${(al.apodo || al.nombre_completo || al.email).replace(/'/g, "&#39;")}</div>
                  <div class="text-xs text-yellow-300 mb-2">Nivel ${al.nivel_actual || 1} • ${al.dias_desde_limpieza !== null ? al.dias_desde_limpieza + ' días' : 'Nunca'}</div>
                  <button onclick="marcarLimpioDirecto('karmicos', ${aspectoId}, ${al.alumno_id}, '${(al.apodo || al.email || '').replace(/'/g, "\\'")}')" 
                          class="w-full px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                    ✅ Marcar limpiado
                  </button>
                </div>
              `).join('') : '<p class="text-slate-400 text-sm">No hay alumnos pendientes</p>'}
            </div>
          </div>
          
          <!-- Columna Olvidados -->
          <div>
            <h2 class="text-lg font-semibold text-red-300 mb-3 sticky top-0 bg-slate-800 py-2 z-10">❌ Olvidados (${olvidados.length})</h2>
            <div class="space-y-2 max-h-[60vh] overflow-y-auto">
              ${olvidados.length > 0 ? olvidados.map(al => `
                <div class="bg-red-900/20 rounded p-3 border border-red-800">
                  <div class="font-semibold text-white mb-1">${(al.apodo || al.nombre_completo || al.email).replace(/'/g, "&#39;")}</div>
                  <div class="text-xs text-red-300 mb-2">Nivel ${al.nivel_actual || 1} • ${al.dias_desde_limpieza !== null ? al.dias_desde_limpieza + ' días' : 'Nunca'}</div>
                  <button onclick="marcarLimpioDirecto('karmicos', ${aspectoId}, ${al.alumno_id}, '${(al.apodo || al.email || '').replace(/'/g, "\\'")}')" 
                          class="w-full px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                    ✅ Marcar limpiado
                  </button>
                </div>
              `).join('') : '<p class="text-slate-400 text-sm">No hay alumnos olvidados</p>'}
            </div>
          </div>
        </div>
      </div>
      
      <script>
        window.closeModalAlumnos = function() {
          document.getElementById('modalAlumnos')?.remove();
        };
        
        async function marcarLimpioDirecto(tipo, aspectoId, alumnoId, nombreAlumno) {
          try {
            const response = await fetch(\`/admin/master/\${alumnoId}/marcar-limpio\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tipo, aspecto_id: aspectoId })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
              const modal = document.getElementById('modalAlumnos');
              if (modal) {
                const response2 = await fetch(\`/admin/registros-karmicos?action=ver_alumnos&aspecto_id=\${aspectoId}\`);
                const html2 = await response2.text();
                modal.querySelector('.bg-slate-800').innerHTML = html2;
              }
            } else {
              console.error('Error al marcar como limpiado:', result.error);
            }
          } catch (error) {
            console.error('Error:', error);
          }
        }
      </script>
    `;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // POST: Actualizar registro kármico
  if (request.method === 'POST' && action === 'update') {
    try {
      const formData = await request.formData();
      const aspectoId = parseInt(formData.get('id'));
      const datos = {};

      if (formData.has('nombre')) datos.nombre = formData.get('nombre');
      if (formData.has('frecuencia_dias')) datos.frecuencia_dias = parseInt(formData.get('frecuencia_dias'));
      if (formData.has('prioridad')) datos.prioridad = formData.get('prioridad');
      if (formData.has('activo')) datos.activo = formData.get('activo') === 'true';
      if (formData.has('orden')) datos.orden = parseInt(formData.get('orden'));

      await actualizarAspectoKarmicoDetalle(aspectoId, datos);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // GET: Listar registros kármicos
  const aspectos = await listarAspectosKarmicosGlobales();
  const aspectosAlumno = alumnoId ? await getAspectosKarmicosAlumno(parseInt(alumnoId)) : null;
  const estadisticas = alumnoId ? await getEstadisticasLimpiezaKarmica(parseInt(alumnoId)) : null;

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">🔮 Registros y Karmas – Limpiezas y Procesos</h1>
      
      ${alumnoId ? `
        <div class="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 class="text-xl font-semibold text-white mb-4">Estado del Alumno</h2>
          <div class="grid grid-cols-4 gap-4">
            <div class="bg-slate-700 rounded p-4">
              <p class="text-slate-400 text-sm">Total</p>
              <p class="text-white text-2xl font-bold">${estadisticas?.total || 0}</p>
            </div>
            <div class="bg-green-900 rounded p-4">
              <p class="text-green-300 text-sm">Al Día</p>
              <p class="text-white text-2xl font-bold">${estadisticas?.al_dia || 0}</p>
            </div>
            <div class="bg-yellow-900 rounded p-4">
              <p class="text-yellow-300 text-sm">Pendientes</p>
              <p class="text-white text-2xl font-bold">${estadisticas?.pendientes || 0}</p>
            </div>
            <div class="bg-red-900 rounded p-4">
              <p class="text-red-300 text-sm">Muy Pendientes</p>
              <p class="text-white text-2xl font-bold">${estadisticas?.muy_pendientes || 0}</p>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="bg-slate-800 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-white mb-4">Registros y Karmas</h2>
        
        <!-- Creación Rápida Inline -->
        <div class="mb-6 bg-slate-700 rounded p-4">
          <form id="formCrearRapido" class="flex gap-2">
            <input 
              type="text" 
              id="inputNombreAspecto"
              name="nombre"
              placeholder="Añadir nuevo registro kármico… (Enter para guardar)"
              class="flex-1 bg-slate-600 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autocomplete="off"
              required
            />
            <button 
              type="submit"
              class="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700"
            >
              Crear
            </button>
          </form>
        </div>

        <!-- Tabla de Registros Kármicos -->
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
                <th class="pb-3 text-slate-300 font-semibold text-lg">Nivel</th>
                <th class="pb-3 text-slate-300 font-semibold">Mínimo de días de trabajo</th>
                <th class="pb-3 text-slate-300 font-semibold">Prioridad</th>
                <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody id="tbodyAspectos">
              ${aspectos.map((a, index) => {
                const nivelActual = a.nivel_minimo || 1;
                const nombreEscapado = String(a.nombre || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                const nombreEscapadoJS = String(a.nombre || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const prioridadSelectedAlta = a.prioridad === 'Alta' ? 'selected' : '';
                const prioridadSelectedMedia = a.prioridad === 'Media' ? 'selected' : '';
                const prioridadSelectedNormal = a.prioridad === 'Normal' ? 'selected' : '';
                
                const nivelHeader = index === 0 || (aspectos[index - 1]?.nivel_minimo || 1) !== nivelActual
                  ? `<tr class="border-t-2 border-slate-600">
                      <td colspan="5" class="py-2 bg-slate-900/50">
                        <div class="text-center">
                          <span class="text-slate-400 text-sm font-semibold">━━━ NIVEL ${nivelActual} ━━━</span>
                        </div>
                      </td>
                    </tr>`
                  : '';
                
                return nivelHeader + `
                  <tr class="border-b border-slate-700 hover:bg-slate-700" data-id="${a.id}" data-nivel="${nivelActual}">
                    <td class="py-3">
                      <input 
                        type="text" 
                        value="${nombreEscapado}" 
                        class="bg-slate-600 text-white rounded px-2 py-1 w-full text-sm"
                        onchange="actualizarAspecto(${a.id}, 'nombre', this.value)"
                      />
                    </td>
                    <td class="py-3">
                      <input 
                        type="number" 
                        value="${a.nivel_minimo || 1}" 
                        min="1"
                        class="bg-slate-600 text-white rounded px-2 py-1 w-24 text-sm font-bold text-lg"
                        onchange="actualizarAspecto(${a.id}, 'nivel_minimo', parseInt(this.value))"
                        style="font-weight: bold; font-size: 1.1rem;"
                      />
                    </td>
                    <td class="py-3">
                      <input 
                        type="number" 
                        value="${a.frecuencia_dias || 14}" 
                        class="bg-slate-600 text-white rounded px-2 py-1 w-20 text-sm"
                        onchange="actualizarAspecto(${a.id}, 'frecuencia_dias', parseInt(this.value))"
                      />
                    </td>
                    <td class="py-3">
                      <select 
                        class="bg-slate-600 text-white rounded px-2 py-1 text-sm"
                        onchange="actualizarAspecto(${a.id}, 'prioridad', this.value)"
                      >
                        <option value="Alta" ${prioridadSelectedAlta}>Alta</option>
                        <option value="Media" ${prioridadSelectedMedia}>Media</option>
                        <option value="Normal" ${prioridadSelectedNormal}>Normal</option>
                      </select>
                    </td>
                    <td class="py-3">
                      <div class="flex gap-2">
                        <button 
                          onclick="verAspectoAlumno(${a.id})"
                          class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                        >
                          Ver por cada alumno
                        </button>
                        <button 
                          onclick="marcarTodosLimpiosAspecto(${a.id}, '${nombreEscapadoJS}')"
                          class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          ✅ Limpiar todos los suscriptores activos
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <script>
      // Crear registro kármico rápido
      document.getElementById('formCrearRapido').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('inputNombreAspecto');
        const nombre = input.value.trim();
        
        if (!nombre || nombre === '') {
          alert('Por favor, introduce un nombre para el registro kármico');
          input.focus();
          return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando...';

        try {
          const url = new URL(window.location.href);
          url.searchParams.set('action', 'create_rapido');
          
          const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombre: nombre })
          });

          let data;
          try {
            data = await res.json();
          } catch (jsonError) {
            const text = await res.text();
            console.error('Error parseando JSON:', text);
            alert('Error del servidor: ' + text);
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
          }

          if (res.ok && data.success) {
            input.value = '';
            location.reload();
          } else {
            alert('Error creando registro kármico: ' + (data.error || 'Error desconocido'));
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
        } catch (error) {
          console.error('Error:', error);
          alert('Error de conexión: ' + error.message);
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });

      // Actualizar registro kármico
      async function actualizarAspecto(id, campo, valor) {
        try {
          const formData = new FormData();
          formData.append('id', id);
          formData.append(campo, valor);
          
          const res = await fetch('?action=update', {
            method: 'POST',
            body: formData
          });

          if (!res.ok) {
            alert('Error actualizando registro kármico');
            location.reload();
          } else {
            // Si se actualizó el nivel, recargar la página para reordenar
            if (campo === 'nivel_minimo') {
              location.reload();
            }
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      async function verAspectoAlumno(aspectoId) {
        const response = await fetch(\`/admin/registros-karmicos?action=ver_alumnos&aspecto_id=\${aspectoId}\`);
        const html = await response.text();
        
        const modal = document.createElement('div');
        modal.id = 'modalAlumnos';
        modal.className = 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4';
        modal.innerHTML = \`
          <div class="bg-slate-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            \${html}
          </div>
        \`;
        
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.remove();
          }
        });
      }
      
      window.verAspectoAlumno = verAspectoAlumno;
      
      async function marcarTodosLimpiosAspecto(aspectoId, nombreAspecto) {
        if (!confirm(\`¿Marcar todos los alumnos del aspecto "\${nombreAspecto}" como limpios?\`)) {
          return;
        }
        
        try {
          const response = await fetch('/admin/registros-karmicos?action=marcar_todos_limpios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aspecto_id: aspectoId })
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            alert(\`✅ Se marcaron \${result.marcados} alumnos como limpios\`);
            location.reload();
          } else {
            alert('Error: ' + (result.error || 'Error desconocido'));
          }
        } catch (error) {
          console.error('Error:', error);
          alert('Error de conexión: ' + error.message);
        }
      }
      
      window.marcarTodosLimpiosAspecto = marcarTodosLimpiosAspecto;
    </script>
  `;

  return new Response(replace(baseTemplate, { TITLE: 'Registros y Karmas', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

