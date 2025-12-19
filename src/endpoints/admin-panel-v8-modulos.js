// src/endpoints/admin-panel-v8-modulos.js
// Endpoints del Admin Panel para módulos V8.0

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../../database/pg.js';
import { isActivo, isBeta } from '../services/modulos.js';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';
import { 
  listarAspectosGlobales,
  crearAspectoRapido,
  actualizarAspectoDetalle,
  getAspectosAlumno,
  getEstadisticasLimpieza,
  getAlumnosPorAspecto,
  marcarTodosAlumnosLimpiosPorAspecto
} from '../services/aspectos-energeticos.js';
import {
  crearObjetivoCreacion,
  getObjetivosCreacion,
  completarObjetivo
} from '../modules/creacion/services/creacion.js';
import {
  getVersionFutura,
  generarVersionFuturaIA,
  guardarVersionFutura
} from '../services/version-futura.js';

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
// ANATOMÍA ENERGÉTICA - ASPECTOS A LIMPIAR (PRIORITARIO)
// ============================================

export async function renderAnatomiaEnergetica(request, env) {
  // Permitir acceso aunque esté en BETA
  // if (!isActivo('aspectos_energeticos') && !isBeta('aspectos_energeticos')) {
  //   return new Response('Módulo no disponible', { status: 403 });
  // }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const alumnoId = url.searchParams.get('alumno_id');

  // POST: Crear aspecto rápido
  if (request.method === 'POST' && action === 'create_rapido') {
    try {
      const contentType = request.headers.get('content-type') || '';
      console.log('[POST create_rapido] Content-Type:', contentType);
      
      let nombre = '';
      let nivel_minimo = 1;
      
      if (contentType.includes('application/json')) {
        // JSON (método preferido)
        const body = await request.json();
        nombre = body.nombre || '';
        nivel_minimo = parseInt(body.nivel_minimo) || 1;
        console.log('[POST create_rapido] JSON nombre recibido:', nombre, 'nivel:', nivel_minimo);
      } else {
        // Fallback a FormData
        try {
          const formData = await request.formData();
          nombre = formData.get('nombre') || '';
          nivel_minimo = parseInt(formData.get('nivel_minimo')) || 1;
          console.log('[POST create_rapido] FormData nombre recibido:', nombre, 'nivel:', nivel_minimo);
        } catch (e) {
          console.error('[POST create_rapido] Error parseando FormData:', e);
        }
      }
      
      // Convertir a string y trim
      nombre = nombre ? String(nombre).trim() : '';
      
      console.log('[POST create_rapido] Nombre final procesado:', nombre, 'nivel:', nivel_minimo);
      
      if (!nombre || nombre === '') {
        console.log('[POST create_rapido] ERROR: Nombre vacío');
        return new Response(JSON.stringify({ error: 'Nombre requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const id = await crearAspectoRapido(nombre, nivel_minimo);
      console.log('[POST create_rapido] ✅ Aspecto creado con ID:', id);
      
      return new Response(JSON.stringify({ success: true, id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[POST create_rapido] ❌ Error:', error);
      console.error('[POST create_rapido] Stack:', error.stack);
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

      const resultado = await marcarTodosAlumnosLimpiosPorAspecto(aspectoId);
      
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

  // POST: Actualizar aspecto
  if (request.method === 'POST' && action === 'update') {
    try {
      const formData = await request.formData();
      const aspectoId = parseInt(formData.get('id'));
      const datos = {};

      if (formData.has('nombre')) datos.nombre = formData.get('nombre');
      if (formData.has('descripcion')) datos.descripcion = formData.get('descripcion');
      if (formData.has('nivel_minimo')) datos.nivel_minimo = parseInt(formData.get('nivel_minimo'));
      if (formData.has('frecuencia_dias')) datos.frecuencia_dias = parseInt(formData.get('frecuencia_dias'));
      if (formData.has('prioridad')) {
        const prioridadValue = formData.get('prioridad');
        // Convertir de string a integer si es necesario (para compatibilidad)
        datos.prioridad = isNaN(prioridadValue) ? prioridadValue : parseInt(prioridadValue);
      }
      if (formData.has('activo')) datos.activo = formData.get('activo') === 'true';
      if (formData.has('orden')) datos.orden = parseInt(formData.get('orden'));

      await actualizarAspectoDetalle(aspectoId, datos);
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

  // GET: Ver alumnos por aspecto
  if (action === 'ver_alumnos') {
    const aspectoId = url.searchParams.get('aspecto_id');
    if (!aspectoId) {
      return new Response(JSON.stringify({ error: 'aspecto_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const alumnos = await getAlumnosPorAspecto(parseInt(aspectoId));
    const aspecto = (await query(`SELECT nombre FROM aspectos_energeticos WHERE id = $1`, [aspectoId])).rows[0];
    
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
                  <button onclick="marcarLimpioDirecto('anatomia', ${aspectoId}, ${al.alumno_id}, '${(al.apodo || al.email || '').replace(/'/g, "\\'")}')" 
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
                  <button onclick="marcarLimpioDirecto('anatomia', ${aspectoId}, ${al.alumno_id}, '${(al.apodo || al.email || '').replace(/'/g, "\\'")}')" 
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
                  <button onclick="marcarLimpioDirecto('anatomia', ${aspectoId}, ${al.alumno_id}, '${(al.apodo || al.email || '').replace(/'/g, "\\'")}')" 
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
              // Recargar el modal sin recargar toda la página
              const modal = document.getElementById('modalAlumnos');
              if (modal) {
                const response2 = await fetch(\`/admin/anatomia-energetica?action=ver_alumnos&aspecto_id=\${aspectoId}\`);
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

  // GET: Listar aspectos
  const aspectos = await listarAspectosGlobales();
  const aspectosAlumno = alumnoId ? await getAspectosAlumno(parseInt(alumnoId)) : null;
  const estadisticas = alumnoId ? await getEstadisticasLimpieza(parseInt(alumnoId)) : null;

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">⚡ Anatomía Energética</h1>
      
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
        <h2 class="text-xl font-semibold text-white mb-4">Anatomía Energética</h2>
        
        <!-- Creación Rápida Inline -->
        <div class="mb-6 bg-slate-700 rounded p-4">
          <form id="formCrearRapido" class="flex gap-2">
            <input 
              type="text" 
              id="inputNombreAspecto"
              name="nombre"
              placeholder="Nombre del aspecto..."
              class="flex-1 bg-slate-600 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autocomplete="off"
              required
            />
            <input 
              type="number" 
              id="inputNivelAspecto"
              name="nivel_minimo"
              placeholder="Nivel"
              min="1"
              value="1"
              class="w-24 bg-slate-600 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

        <!-- Tabla de Aspectos -->
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
                <th class="pb-3 text-slate-300 font-semibold text-lg">Nivel</th>
                <th class="pb-3 text-slate-300 font-semibold">Frecuencia (días)</th>
                <th class="pb-3 text-slate-300 font-semibold">Prioridad</th>
                <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody id="tbodyAspectos">
              ${(() => {
                let nivelAnterior = null;
                let html = '';
                aspectos.forEach((a, index) => {
                  const nivelActual = a.nivel_minimo || 1;
                  // Añadir separador cuando cambia el nivel
                  if (nivelAnterior !== null && nivelActual !== nivelAnterior) {
                    html += '<tr class="border-t-2 border-slate-600">' +
                      '<td colspan="5" class="py-2 bg-slate-900/50">' +
                        '<div class="text-center">' +
                          '<span class="text-slate-400 text-sm font-semibold">━━━ NIVEL ' + nivelActual + ' ━━━</span>' +
                        '</div>' +
                      '</td>' +
                    '</tr>';
                  } else if (nivelAnterior === null) {
                    // Primer separador
                    html += '<tr class="border-t-2 border-slate-600">' +
                      '<td colspan="5" class="py-2 bg-slate-900/50">' +
                        '<div class="text-center">' +
                          '<span class="text-slate-400 text-sm font-semibold">━━━ NIVEL ' + nivelActual + ' ━━━</span>' +
                        '</div>' +
                      '</td>' +
                    '</tr>';
                  }
                  nivelAnterior = nivelActual;
                  
                  const nombreEscapado = (a.nombre || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
                  const prioridadSelected1 = a.prioridad === 1 ? 'selected' : '';
                  const prioridadSelected2 = a.prioridad === 2 ? 'selected' : '';
                  const prioridadSelected3 = a.prioridad === 3 ? 'selected' : '';
                  
                  html += '<tr class="border-b border-slate-700 hover:bg-slate-700" data-id="' + a.id + '" data-nivel="' + nivelActual + '">' +
                    '<td class="py-3">' +
                      '<input ' +
                        'type="text" ' +
                        'value="' + nombreEscapado + '" ' +
                        'class="bg-slate-600 text-white rounded px-2 py-1 w-full text-sm" ' +
                        'onchange="actualizarAspecto(' + a.id + ', \'nombre\', this.value)" ' +
                      '/>' +
                    '</td>' +
                    '<td class="py-3">' +
                      '<input ' +
                        'type="number" ' +
                        'value="' + (a.nivel_minimo || 1) + '" ' +
                        'min="1" ' +
                        'class="bg-slate-600 text-white rounded px-2 py-1 w-24 text-sm font-bold text-lg" ' +
                        'onchange="actualizarAspecto(' + a.id + ', \'nivel_minimo\', parseInt(this.value))" ' +
                        'style="font-weight: bold; font-size: 1.1rem;" ' +
                      '/>' +
                    '</td>' +
                    '<td class="py-3">' +
                      '<input ' +
                        'type="number" ' +
                        'value="' + (a.frecuencia_dias || 14) + '" ' +
                        'class="bg-slate-600 text-white rounded px-2 py-1 w-20 text-sm" ' +
                        'onchange="actualizarAspecto(' + a.id + ', \'frecuencia_dias\', parseInt(this.value))" ' +
                      '/>' +
                    '</td>' +
                    '<td class="py-3">' +
                      '<select ' +
                        'class="bg-slate-600 text-white rounded px-2 py-1 text-sm" ' +
                        'onchange="actualizarAspecto(' + a.id + ', \'prioridad\', parseInt(this.value))" ' +
                      '>' +
                        '<option value="1" ' + prioridadSelected1 + '>Alta</option>' +
                        '<option value="2" ' + prioridadSelected2 + '>Media</option>' +
                        '<option value="3" ' + prioridadSelected3 + '>Normal</option>' +
                      '</select>' +
                    '</td>' +
                    '<td class="py-3">' +
                      '<div class="flex gap-2">' +
                        '<button ' +
                          'onclick="verAspectoAlumno(' + a.id + ')" ' +
                          'class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700" ' +
                        '>' +
                          'Ver por cada alumno' +
                        '</button>' +
                        '<button ' +
                          'onclick="marcarTodosLimpiosAspecto(' + a.id + ', \'' + nombreEscapado + '\')" ' +
                          'class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700" ' +
                        '>' +
                          '✅ Limpiar todos los suscriptores activos' +
                        '</button>' +
                      '</div>' +
                    '</td>' +
                  '</tr>';
                });
                return html;
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <script>
      // Crear aspecto rápido
      document.getElementById('formCrearRapido').addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputNombre = document.getElementById('inputNombreAspecto');
        const inputNivel = document.getElementById('inputNivelAspecto');
        const nombre = inputNombre.value.trim();
        const nivel = parseInt(inputNivel.value) || 1;
        
        if (!nombre || nombre === '') {
          alert('Por favor, introduce un nombre para el aspecto');
          inputNombre.focus();
          return;
        }

        // Deshabilitar botón mientras se procesa
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando...';

        try {
          // Usar JSON en lugar de FormData para evitar problemas de parsing
          const url = new URL(window.location.href);
          url.searchParams.set('action', 'create_rapido');
          
          console.log('Enviando nombre:', nombre, 'nivel:', nivel);
          console.log('URL de la petición:', url.toString());
          
          const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombre: nombre, nivel_minimo: nivel })
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
            inputNombre.value = '';
            inputNivel.value = '1';
            location.reload();
          } else {
            alert('Error creando aspecto: ' + (data.error || 'Error desconocido'));
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

      // Actualizar aspecto
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
            alert('Error actualizando aspecto');
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
        const response = await fetch(\`/admin/anatomia-energetica?action=ver_alumnos&aspecto_id=\${aspectoId}\`);
        const html = await response.text();
        
        // Crear modal
        const modal = document.createElement('div');
        modal.id = 'modalAlumnos';
        modal.className = 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4';
        modal.innerHTML = \`
          <div class="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            \${html}
          </div>
        \`;
        
        document.body.appendChild(modal);
        
        // Cerrar al hacer click fuera
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
          const response = await fetch('/admin/anatomia-energetica?action=marcar_todos_limpios', {
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

  return new Response(replace(baseTemplate, { TITLE: 'Anatomía Energética', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ============================================
// LIMPIEZA DE HOGAR
// ============================================

export async function renderLimpiezaHogar(request, env) {
  // Reutilizar la lógica de Anatomía Energética pero con tablas diferentes
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const alumnoId = url.searchParams.get('alumno_id');

  // POST: Crear aspecto rápido
  if (request.method === 'POST' && action === 'create_rapido') {
    try {
      const contentType = request.headers.get('content-type') || '';
      let nombre = '';
      let nivel_minimo = 1;
      
      if (contentType.includes('application/json')) {
        const body = await request.json();
        nombre = body.nombre || '';
        nivel_minimo = parseInt(body.nivel_minimo) || 1;
      } else {
        const formData = await request.formData();
        nombre = formData.get('nombre') || '';
        nivel_minimo = parseInt(formData.get('nivel_minimo')) || 1;
      }
      
      nombre = nombre ? String(nombre).trim() : '';
      
      if (!nombre || nombre === '') {
        return new Response(JSON.stringify({ error: 'Nombre requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Crear en tabla limpieza_hogar (con manejo de error si la tabla no existe)
      let result;
      try {
        result = await query(`
          INSERT INTO limpieza_hogar (nombre, nivel_minimo, frecuencia_dias, prioridad)
          VALUES ($1, $2, 14, 3)
          RETURNING id
        `, [nombre, nivel_minimo]);
      } catch (error) {
        if (error.message && error.message.includes('does not exist')) {
          // La tabla no existe, intentar crearla
          console.log('⚠️ Tabla limpieza_hogar no existe, creándola...');
          try {
            await query(`
              CREATE TABLE IF NOT EXISTS limpieza_hogar (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL,
                descripcion TEXT,
                nivel_minimo INT DEFAULT 1,
                frecuencia_dias INT DEFAULT 14,
                prioridad INT DEFAULT 3,
                orden INT DEFAULT 0,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              )
            `);
            await query(`CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_activo ON limpieza_hogar(activo)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_nivel ON limpieza_hogar(nivel_minimo)`);
            // Reintentar la inserción
            result = await query(`
              INSERT INTO limpieza_hogar (nombre, nivel_minimo, frecuencia_dias, prioridad)
              VALUES ($1, $2, 14, 3)
              RETURNING id
            `, [nombre, nivel_minimo]);
          } catch (createError) {
            console.error('Error creando tabla limpieza_hogar:', createError);
            throw createError;
          }
        } else {
          throw error;
        }
      }

      return new Response(JSON.stringify({ success: true, id: result.rows[0].id }), {
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

      // Obtener todos los alumnos activos con este aspecto
      const alumnos = await query(`
        SELECT a.id as alumno_id
        FROM alumnos a
        CROSS JOIN limpieza_hogar lh
        WHERE lh.id = $1
          AND a.estado_suscripcion = 'activa'
          AND (COALESCE(lh.nivel_minimo, 1) <= a.nivel_actual)
      `, [aspectoId]);

      // Obtener el nombre del aspecto para el historial
      const aspectoResult = await query('SELECT nombre FROM limpieza_hogar WHERE id = $1', [aspectoId]);
      const aspectoNombre = aspectoResult.rows[0]?.nombre || 'Aspecto de Limpieza de Hogar';
      const seccion = 'Limpieza de Hogar';
      const ahora = new Date();
      
      let marcados = 0;
      for (const al of alumnos.rows) {
        await query(`
          INSERT INTO limpieza_hogar_alumnos (aspecto_id, alumno_id, ultima_limpieza, veces_limpiado, updated_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP, COALESCE((SELECT veces_limpiado FROM limpieza_hogar_alumnos WHERE aspecto_id = $1 AND alumno_id = $2), 0) + 1, CURRENT_TIMESTAMP)
          ON CONFLICT (aspecto_id, alumno_id) 
          DO UPDATE SET 
            ultima_limpieza = CURRENT_TIMESTAMP,
            veces_limpiado = COALESCE(limpieza_hogar_alumnos.veces_limpiado, 0) + 1,
            updated_at = CURRENT_TIMESTAMP
        `, [aspectoId, al.alumno_id]).catch(() => {
          // Fallback si updated_at no existe
          return query(`
            INSERT INTO limpieza_hogar_alumnos (aspecto_id, alumno_id, ultima_limpieza, veces_limpiado)
            VALUES ($1, $2, CURRENT_TIMESTAMP, COALESCE((SELECT veces_limpiado FROM limpieza_hogar_alumnos WHERE aspecto_id = $1 AND alumno_id = $2), 0) + 1)
            ON CONFLICT (aspecto_id, alumno_id) 
            DO UPDATE SET 
              ultima_limpieza = CURRENT_TIMESTAMP,
              veces_limpiado = COALESCE(limpieza_hogar_alumnos.veces_limpiado, 0) + 1
          `, [aspectoId, al.alumno_id]);
        });
        
        // Registrar en el historial de limpiezas del master
        try {
          // Asegurar que la tabla existe antes de insertar
          await query(`
            CREATE TABLE IF NOT EXISTS limpiezas_master_historial (
              id SERIAL PRIMARY KEY,
              alumno_id INT,
              tipo VARCHAR(50) NOT NULL,
              aspecto_id INT NOT NULL,
              aspecto_nombre VARCHAR(500),
              seccion VARCHAR(100),
              fecha_limpieza TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `).catch(() => {});
          await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_alumno ON limpiezas_master_historial(alumno_id)`).catch(() => {});
          await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_fecha ON limpiezas_master_historial(fecha_limpieza)`).catch(() => {});
          await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_tipo ON limpiezas_master_historial(tipo)`).catch(() => {});
          
          await query(`
            INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [al.alumno_id, 'limpieza_hogar', aspectoId, aspectoNombre, seccion, ahora]);
        } catch (histError) {
          console.warn('⚠️ Error registrando limpieza en historial (tabla puede no existir):', histError.message);
        }
        
        marcados++;
      }
      
      return new Response(JSON.stringify({ success: true, marcados }), {
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

  // POST: Actualizar aspecto
  if (request.method === 'POST' && action === 'update') {
    try {
      const formData = await request.formData();
      const aspectoId = parseInt(formData.get('id'));
      const datos = {};
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (formData.has('nombre')) { updates.push(`nombre = $${paramIndex++}`); params.push(formData.get('nombre')); }
      if (formData.has('nivel_minimo')) { updates.push(`nivel_minimo = $${paramIndex++}`); params.push(parseInt(formData.get('nivel_minimo'))); }
      if (formData.has('frecuencia_dias')) { updates.push(`frecuencia_dias = $${paramIndex++}`); params.push(parseInt(formData.get('frecuencia_dias'))); }
      if (formData.has('prioridad')) { updates.push(`prioridad = $${paramIndex++}`); params.push(parseInt(formData.get('prioridad'))); }
      if (formData.has('activo')) { updates.push(`activo = $${paramIndex++}`); params.push(formData.get('activo') === 'true'); }
      if (formData.has('orden')) { updates.push(`orden = $${paramIndex++}`); params.push(parseInt(formData.get('orden'))); }

      if (updates.length === 0) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(aspectoId);

      await query(`
        UPDATE limpieza_hogar
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
      `, params);

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

  // GET: Ver alumnos por aspecto
  if (action === 'ver_alumnos') {
    const aspectoId = url.searchParams.get('aspecto_id');
    if (!aspectoId) {
      return new Response(JSON.stringify({ error: 'aspecto_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const alumnos = await query(`
      SELECT 
        a.id as alumno_id,
        a.email,
        a.apodo,
        a.nombre_completo,
        a.nivel_actual,
        lha.ultima_limpieza,
        lha.estado,
        lh.nombre as aspecto_nombre,
        lh.frecuencia_dias,
        CASE
          WHEN lha.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - lha.ultima_limpieza))::INT
        END as dias_desde_limpieza,
        CASE
          WHEN lha.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - lha.ultima_limpieza))::INT <= lh.frecuencia_dias THEN 'limpio'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - lha.ultima_limpieza))::INT <= 15 THEN 'pendiente'
          ELSE 'olvidado'
        END as estado_calculado
      FROM alumnos a
      CROSS JOIN limpieza_hogar lh
      LEFT JOIN limpieza_hogar_alumnos lha ON lha.aspecto_id = lh.id AND lha.alumno_id = a.id
      WHERE lh.id = $1
        AND a.estado_suscripcion = 'activa'
        AND (COALESCE(lh.nivel_minimo, 1) <= a.nivel_actual)
      ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
    `, [aspectoId]);
    
    const aspecto = (await query(`SELECT nombre FROM limpieza_hogar WHERE id = $1`, [aspectoId])).rows[0];
    
    const limpios = alumnos.rows.filter(a => a.estado_calculado === 'limpio');
    const pendientes = alumnos.rows.filter(a => a.estado_calculado === 'pendiente');
    const olvidados = alumnos.rows.filter(a => a.estado_calculado === 'olvidado');
    
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
                  <button onclick="marcarLimpioDirecto('limpieza_hogar', ${aspectoId}, ${al.alumno_id}, '${(al.apodo || al.email || '').replace(/'/g, "\\'")}')" 
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
                  <button onclick="marcarLimpioDirecto('limpieza_hogar', ${aspectoId}, ${al.alumno_id}, '${(al.apodo || al.email || '').replace(/'/g, "\\'")}')" 
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
                  <button onclick="marcarLimpioDirecto('limpieza_hogar', ${aspectoId}, ${al.alumno_id}, '${(al.apodo || al.email || '').replace(/'/g, "\\'")}')" 
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
                const response2 = await fetch(\`/admin/limpieza-hogar?action=ver_alumnos&aspecto_id=\${aspectoId}\`);
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

  // GET: Listar aspectos (con manejo de error si la tabla no existe)
  let aspectos;
  try {
    aspectos = await query(`
      SELECT *, COALESCE(nivel_minimo, 1) as nivel_minimo
      FROM limpieza_hogar
      WHERE activo = true
      ORDER BY COALESCE(nivel_minimo, 1) ASC, orden ASC, nombre ASC
    `);
  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      // La tabla no existe, intentar crearla
      console.log('⚠️ Tabla limpieza_hogar no existe, creándola...');
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS limpieza_hogar (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(200) NOT NULL,
            descripcion TEXT,
            nivel_minimo INT DEFAULT 1,
            frecuencia_dias INT DEFAULT 14,
            prioridad INT DEFAULT 3,
            orden INT DEFAULT 0,
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_activo ON limpieza_hogar(activo)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_nivel ON limpieza_hogar(nivel_minimo)`);
        await query(`
          CREATE TABLE IF NOT EXISTS limpieza_hogar_alumnos (
            id SERIAL PRIMARY KEY,
            alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
            aspecto_id INT REFERENCES limpieza_hogar(id) ON DELETE CASCADE,
            estado VARCHAR(50) DEFAULT 'pendiente',
            ultima_limpieza TIMESTAMP,
            proxima_limpieza TIMESTAMP,
            veces_limpiado INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (alumno_id, aspecto_id)
          )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_alumnos_alumno ON limpieza_hogar_alumnos(alumno_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_limpieza_hogar_alumnos_aspecto ON limpieza_hogar_alumnos(aspecto_id)`);
        // Reintentar la consulta
        aspectos = await query(`
          SELECT *, COALESCE(nivel_minimo, 1) as nivel_minimo
          FROM limpieza_hogar
          WHERE activo = true
          ORDER BY COALESCE(nivel_minimo, 1) ASC, orden ASC, nombre ASC
        `);
      } catch (createError) {
        console.error('Error creando tabla limpieza_hogar:', createError);
        aspectos = { rows: [] };
      }
    } else {
      // Otro error, intentar query sin nivel_minimo
      try {
        aspectos = await query(`
          SELECT *, 1 as nivel_minimo
          FROM limpieza_hogar
          WHERE activo = true
          ORDER BY orden ASC, nombre ASC
        `);
      } catch (err2) {
        console.error('Error obteniendo aspectos de limpieza_hogar:', err2);
        aspectos = { rows: [] };
      }
    }
  }

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">🏡 Limpieza de Hogar</h1>
      
      <div class="bg-slate-800 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-white mb-4">Limpieza de Hogar</h2>
        
        <!-- Creación Rápida Inline -->
        <div class="mb-6 bg-slate-700 rounded p-4">
          <form id="formCrearRapido" class="flex gap-2">
            <input 
              type="text" 
              id="inputNombreAspecto"
              name="nombre"
              placeholder="Nombre del aspecto..."
              class="flex-1 bg-slate-600 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autocomplete="off"
              required
            />
            <input 
              type="number" 
              id="inputNivelAspecto"
              name="nivel_minimo"
              placeholder="Nivel"
              min="1"
              value="1"
              class="w-24 bg-slate-600 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

        <!-- Tabla de Aspectos -->
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
                <th class="pb-3 text-slate-300 font-semibold text-lg">Nivel</th>
                <th class="pb-3 text-slate-300 font-semibold">Frecuencia (días)</th>
                <th class="pb-3 text-slate-300 font-semibold">Prioridad</th>
                <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody id="tbodyAspectos">
              ${(() => {
                let nivelAnterior = null;
                let html = '';
                aspectos.rows.forEach((a, index) => {
                  const nivelActual = a.nivel_minimo || 1;
                  if (nivelAnterior !== null && nivelActual !== nivelAnterior) {
                    html += '<tr class="border-t-2 border-slate-600">' +
                      '<td colspan="5" class="py-2 bg-slate-900/50">' +
                        '<div class="text-center">' +
                          '<span class="text-slate-400 text-sm font-semibold">━━━ NIVEL ' + nivelActual + ' ━━━</span>' +
                        '</div>' +
                      '</td>' +
                    '</tr>';
                  } else if (nivelAnterior === null) {
                    html += '<tr class="border-t-2 border-slate-600">' +
                      '<td colspan="5" class="py-2 bg-slate-900/50">' +
                        '<div class="text-center">' +
                          '<span class="text-slate-400 text-sm font-semibold">━━━ NIVEL ' + nivelActual + ' ━━━</span>' +
                        '</div>' +
                      '</td>' +
                    '</tr>';
                  }
                  nivelAnterior = nivelActual;
                  
                  const nombreEscapado2 = (a.nombre || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
                  const prioridadSelected1_2 = a.prioridad === 1 ? 'selected' : '';
                  const prioridadSelected2_2 = a.prioridad === 2 ? 'selected' : '';
                  const prioridadSelected3_2 = a.prioridad === 3 ? 'selected' : '';
                  
                  html += '<tr class="border-b border-slate-700 hover:bg-slate-700" data-id="' + a.id + '" data-nivel="' + nivelActual + '">' +
                    '<td class="py-3">' +
                      '<input ' +
                        'type="text" ' +
                        'value="' + nombreEscapado2 + '" ' +
                        'class="bg-slate-600 text-white rounded px-2 py-1 w-full text-sm" ' +
                        'onchange="actualizarAspecto(' + a.id + ', \'nombre\', this.value)" ' +
                      '/>' +
                    '</td>' +
                    '<td class="py-3">' +
                      '<input ' +
                        'type="number" ' +
                        'value="' + (a.nivel_minimo || 1) + '" ' +
                        'min="1" ' +
                        'class="bg-slate-600 text-white rounded px-2 py-1 w-24 text-sm font-bold text-lg" ' +
                        'onchange="actualizarAspecto(' + a.id + ', \'nivel_minimo\', parseInt(this.value))" ' +
                        'style="font-weight: bold; font-size: 1.1rem;" ' +
                      '/>' +
                    '</td>' +
                    '<td class="py-3">' +
                      '<input ' +
                        'type="number" ' +
                        'value="' + (a.frecuencia_dias || 14) + '" ' +
                        'class="bg-slate-600 text-white rounded px-2 py-1 w-20 text-sm" ' +
                        'onchange="actualizarAspecto(' + a.id + ', \'frecuencia_dias\', parseInt(this.value))" ' +
                      '/>' +
                    '</td>' +
                    '<td class="py-3">' +
                      '<select ' +
                        'class="bg-slate-600 text-white rounded px-2 py-1 text-sm" ' +
                        'onchange="actualizarAspecto(' + a.id + ', \'prioridad\', parseInt(this.value))" ' +
                      '>' +
                        '<option value="1" ' + prioridadSelected1_2 + '>Alta</option>' +
                        '<option value="2" ' + prioridadSelected2_2 + '>Media</option>' +
                        '<option value="3" ' + prioridadSelected3_2 + '>Normal</option>' +
                      '</select>' +
                    '</td>' +
                    '<td class="py-3">' +
                      '<div class="flex gap-2">' +
                        '<button ' +
                          'onclick="verAspectoAlumno(' + a.id + ')" ' +
                          'class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700" ' +
                        '>' +
                          'Ver por cada alumno' +
                        '</button>' +
                        '<button ' +
                          'onclick="marcarTodosLimpiosAspecto(' + a.id + ', \'' + nombreEscapado2 + '\')" ' +
                          'class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700" ' +
                        '>' +
                          '✅ Limpiar todos los suscriptores activos' +
                        '</button>' +
                      '</div>' +
                    '</td>' +
                  '</tr>';
                });
                return html;
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <script>
      document.getElementById('formCrearRapido').addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputNombre = document.getElementById('inputNombreAspecto');
        const inputNivel = document.getElementById('inputNivelAspecto');
        const nombre = inputNombre.value.trim();
        const nivel = parseInt(inputNivel.value) || 1;
        
        if (!nombre || nombre === '') {
          alert('Por favor, introduce un nombre para el aspecto');
          inputNombre.focus();
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, nivel_minimo: nivel })
          });

          const data = await res.json();

          if (res.ok && data.success) {
            inputNombre.value = '';
            inputNivel.value = '1';
            location.reload();
          } else {
            alert('Error creando aspecto: ' + (data.error || 'Error desconocido'));
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
        } catch (error) {
          alert('Error de conexión: ' + error.message);
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });

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
            alert('Error actualizando aspecto');
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
        const response = await fetch(\`/admin/limpieza-hogar?action=ver_alumnos&aspecto_id=\${aspectoId}\`);
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
          const response = await fetch('/admin/limpieza-hogar?action=marcar_todos_limpios', {
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

  return new Response(replace(baseTemplate, { TITLE: 'Limpieza de Hogar', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ============================================
// MÓDULO DE CREACIÓN
// ============================================

export async function renderCreacionObjetivos(request, env) {
  const url = new URL(request.url);
  const alumnoId = url.searchParams.get('alumno_id');

  if (alumnoId && request.method === 'POST') {
    const formData = await request.formData();
    const titulo = formData.get('titulo');
    const descripcion = formData.get('descripcion');
    const prioridad = parseInt(formData.get('prioridad')) || 3;
    
    await crearObjetivoCreacion(parseInt(alumnoId), { titulo, descripcion, prioridad });
    return Response.redirect(new URL(request.url).pathname + `?alumno_id=${alumnoId}&saved=1`, 302);
  }

  const objetivos = alumnoId ? await getObjetivosCreacion(parseInt(alumnoId)) : [];

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">🎯 Objetivos de Creación</h1>
      ${alumnoId ? `
        <div class="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 class="text-xl font-semibold text-white mb-4">Nuevo Objetivo</h2>
          <form method="POST" class="space-y-4">
            <input type="text" name="titulo" placeholder="Título del objetivo" required
                   class="w-full bg-slate-700 text-white rounded px-4 py-2" />
            <textarea name="descripcion" placeholder="Descripción" rows="3"
                      class="w-full bg-slate-700 text-white rounded px-4 py-2"></textarea>
            <select name="prioridad" class="bg-slate-700 text-white rounded px-4 py-2">
              <option value="3">Normal</option>
              <option value="2">Media</option>
              <option value="1">Alta</option>
            </select>
            <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
              Crear Objetivo
            </button>
          </form>
        </div>
        <div class="bg-slate-800 rounded-lg p-6">
          <h2 class="text-xl font-semibold text-white mb-4">Objetivos Activos</h2>
          ${objetivos.length > 0 ? objetivos.map(o => `
            <div class="bg-slate-700 rounded p-4 mb-3">
              <h3 class="text-white font-medium">${o.titulo}</h3>
              ${o.descripcion ? `<p class="text-slate-300 text-sm mt-1">${o.descripcion}</p>` : ''}
              <div class="mt-2 flex gap-2">
                <span class="px-2 py-1 bg-slate-600 rounded text-xs text-slate-300">
                  Prioridad: ${o.prioridad === 1 ? 'Alta' : o.prioridad === 2 ? 'Media' : 'Normal'}
                </span>
                <button onclick="completarObjetivo(${o.id})" 
                        class="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                  Completar
                </button>
              </div>
            </div>
          `).join('') : '<p class="text-slate-400">No hay objetivos activos</p>'}
        </div>
      ` : '<p class="text-slate-400">Selecciona un alumno para ver sus objetivos</p>'}
    </div>
  `;

  return new Response(replace(baseTemplate, { TITLE: 'Objetivos de Creación', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function renderCreacionVersionFutura(request, env) {
  const url = new URL(request.url);
  const alumnoId = url.searchParams.get('alumno_id');

  if (alumnoId && request.method === 'POST') {
    const formData = await request.formData();
    const action = formData.get('action');
    const borrador = formData.get('borrador');
    const versionEditada = formData.get('version_editada');

    if (action === 'generar_ia') {
      const versionIA = await generarVersionFuturaIA(borrador);
      await guardarVersionFutura(parseInt(alumnoId), borrador, versionIA);
      return Response.redirect(new URL(request.url).pathname + `?alumno_id=${alumnoId}&generado=1`, 302);
    } else if (action === 'guardar_editada') {
      await guardarVersionFutura(parseInt(alumnoId), borrador, null, versionEditada);
      return Response.redirect(new URL(request.url).pathname + `?alumno_id=${alumnoId}&saved=1`, 302);
    }
  }

  const versionFutura = alumnoId ? await getVersionFutura(parseInt(alumnoId)) : null;

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">✨ Versión Futura</h1>
      ${alumnoId ? `
        <div class="bg-slate-800 rounded-lg p-6 space-y-6">
          ${versionFutura ? `
            <div>
              <h2 class="text-xl font-semibold text-white mb-2">Borrador Original</h2>
              <div class="bg-slate-700 rounded p-4 text-slate-300 whitespace-pre-wrap">${versionFutura.borrador_original || ''}</div>
            </div>
            ${versionFutura.version_ia ? `
              <div>
                <h2 class="text-xl font-semibold text-white mb-2">Versión IA</h2>
                <div class="bg-slate-700 rounded p-4 text-slate-300 whitespace-pre-wrap">${versionFutura.version_ia}</div>
              </div>
            ` : ''}
            ${versionFutura.version_editada ? `
              <div>
                <h2 class="text-xl font-semibold text-white mb-2">Versión Editada Final</h2>
                <div class="bg-slate-700 rounded p-4 text-slate-300 whitespace-pre-wrap">${versionFutura.version_editada}</div>
              </div>
            ` : ''}
          ` : `
            <form method="POST" class="space-y-4">
              <input type="hidden" name="action" value="generar_ia" />
              <label class="block text-slate-300">Escribe tu visión futura (texto libre):</label>
              <textarea name="borrador" rows="10" required
                        class="w-full bg-slate-700 text-white rounded px-4 py-2"
                        placeholder="Escribe aquí tu visión de futuro de forma libre y emocional..."></textarea>
              <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
                Ordenar con Aurelín (IA Local)
              </button>
            </form>
          `}
        </div>
      ` : '<p class="text-slate-400">Selecciona un alumno</p>'}
    </div>
  `;

  return new Response(replace(baseTemplate, { TITLE: 'Versión Futura', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Placeholders para otros endpoints
export async function renderCreacionProblemas(request, env) {
  return new Response(replace(baseTemplate, { TITLE: 'Problemas Iniciales', CONTENT: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Problemas Iniciales - En desarrollo</h1></div>' }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

