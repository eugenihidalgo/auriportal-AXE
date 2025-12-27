// src/endpoints/admin-panel-v8-modulos.js
// Endpoints del Admin Panel para módulos V8.0

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { query } from '../../database/pg.js';
import { isActivo, isBeta } from '../services/modulos.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { 
  listarAspectosGlobales,
  crearAspectoRapido,
  actualizarAspectoDetalle,
  getAspectosAlumno,
  getEstadisticasLimpieza,
  getAlumnosPorAspecto
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
          <h1 class="text-3xl font-bold text-white">Alumnos: ${aspecto?.nombre || 'Aspecto'}</h1>
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
        
        <!-- Limpiados -->
        ${limpios.length > 0 ? `
          <div class="mb-6">
            <h2 class="text-xl font-semibold text-green-300 mb-3">✅ Limpiados (${limpios.length})</h2>
            <div class="space-y-2">
              ${limpios.map(al => `
                <div class="bg-green-900/20 rounded p-3 flex justify-between items-center border border-green-800">
                  <div>
                    <div class="font-semibold text-white">${al.apodo || al.nombre_completo || al.email}</div>
                    <div class="text-xs text-green-300">Nivel ${al.nivel_actual || 1} • ${al.dias_desde_limpieza || 0} días desde limpieza</div>
                  </div>
                  <button onclick="marcarLimpioDirecto('anatomia', ${aspectoId}, ${al.alumno_id}, '${al.apodo || al.email}')" 
                          class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                    ✅ Limpiar
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Pendientes -->
        ${pendientes.length > 0 ? `
          <div class="mb-6">
            <h2 class="text-xl font-semibold text-yellow-300 mb-3">⏳ Pendientes (${pendientes.length})</h2>
            <div class="space-y-2">
              ${pendientes.map(al => `
                <div class="bg-yellow-900/20 rounded p-3 flex justify-between items-center border border-yellow-800">
                  <div>
                    <div class="font-semibold text-white">${al.apodo || al.nombre_completo || al.email}</div>
                    <div class="text-xs text-yellow-300">Nivel ${al.nivel_actual || 1} • ${al.dias_desde_limpieza !== null ? al.dias_desde_limpieza + ' días desde limpieza' : 'Nunca limpiado'}</div>
                  </div>
                  <button onclick="marcarLimpioDirecto('anatomia', ${aspectoId}, ${al.alumno_id}, '${al.apodo || al.email}')" 
                          class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                    ✅ Limpiar
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Olvidados -->
        ${olvidados.length > 0 ? `
          <div class="mb-6">
            <h2 class="text-xl font-semibold text-red-300 mb-3">❌ Olvidados (${olvidados.length})</h2>
            <div class="space-y-2">
              ${olvidados.map(al => `
                <div class="bg-red-900/20 rounded p-3 flex justify-between items-center border border-red-800">
                  <div>
                    <div class="font-semibold text-white">${al.apodo || al.nombre_completo || al.email}</div>
                    <div class="text-xs text-red-300">Nivel ${al.nivel_actual || 1} • ${al.dias_desde_limpieza !== null ? al.dias_desde_limpieza + ' días desde limpieza' : 'Nunca limpiado'}</div>
                  </div>
                  <button onclick="marcarLimpioDirecto('anatomia', ${aspectoId}, ${al.alumno_id}, '${al.apodo || al.email}')" 
                          class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                    ✅ Limpiar
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
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
            
            if (response.ok) {
              // Recargar la vista
              window.location.reload();
            } else {
              alert('Error al marcar como limpiado');
            }
          } catch (error) {
            console.error('Error:', error);
            alert('Error al marcar como limpiado');
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
                <th class="pb-3 text-slate-300 font-semibold">Nivel</th>
                <th class="pb-3 text-slate-300 font-semibold">Frecuencia (días)</th>
                <th class="pb-3 text-slate-300 font-semibold">Prioridad</th>
                <th class="pb-3 text-slate-300 font-semibold">Orden</th>
                <th class="pb-3 text-slate-300 font-semibold">Activo</th>
                <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody id="tbodyAspectos">
              ${aspectos.map(a => `
                <tr class="border-b border-slate-700 hover:bg-slate-700" data-id="${a.id}">
                  <td class="py-3">
                    <input 
                      type="text" 
                      value="${a.nombre || ''}" 
                      class="bg-slate-600 text-white rounded px-2 py-1 w-full text-sm"
                      onchange="actualizarAspecto(${a.id}, 'nombre', this.value)"
                    />
                  </td>
                  <td class="py-3">
                    <input 
                      type="number" 
                      value="${a.nivel_minimo || 1}" 
                      min="1"
                      class="bg-slate-600 text-white rounded px-2 py-1 w-20 text-sm"
                      onchange="actualizarAspecto(${a.id}, 'nivel_minimo', parseInt(this.value))"
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
                      onchange="actualizarAspecto(${a.id}, 'prioridad', parseInt(this.value))"
                    >
                      <option value="1" ${a.prioridad === 1 ? 'selected' : ''}>Alta</option>
                      <option value="2" ${a.prioridad === 2 ? 'selected' : ''}>Media</option>
                      <option value="3" ${a.prioridad === 3 ? 'selected' : ''}>Normal</option>
                    </select>
                  </td>
                  <td class="py-3">
                    <input 
                      type="number" 
                      value="${a.orden || 0}" 
                      class="bg-slate-600 text-white rounded px-2 py-1 w-20 text-sm"
                      onchange="actualizarAspecto(${a.id}, 'orden', parseInt(this.value))"
                    />
                  </td>
                  <td class="py-3">
                    <input 
                      type="checkbox" 
                      ${a.activo ? 'checked' : ''}
                      onchange="actualizarAspecto(${a.id}, 'activo', this.checked)"
                      class="w-5 h-5"
                    />
                  </td>
                  <td class="py-3">
                    <button 
                      onclick="verAspectoAlumno(${a.id})"
                      class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                    >
                      Ver Alumnos
                    </button>
                  </td>
                </tr>
              `).join('')}
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
    </script>
  `;

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'Anatomía Energética',
    contentHtml: content,
    activePath,
    userContext: { isAdmin: true }
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

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'Objetivos de Creación',
    contentHtml: content,
    activePath,
    userContext: { isAdmin: true }
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

  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'Versión Futura',
    contentHtml: content,
    activePath,
    userContext: { isAdmin: true }
  });
}

// Placeholders para otros endpoints
export async function renderCreacionProblemas(request, env) {
  const url = new URL(request.url);
  const activePath = url.pathname;

  return renderAdminPage({
    title: 'Problemas Iniciales',
    contentHtml: '<div class="p-6"><h1 class="text-3xl font-bold text-white">Problemas Iniciales - En desarrollo</h1></div>',
    activePath,
    userContext: { isAdmin: true }
  });
}

