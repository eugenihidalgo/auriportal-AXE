// src/endpoints/admin-transmutaciones-personas.js
// Endpoints del Admin Panel para Transmutaciones PDE - Personas de la plataforma

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../../database/pg.js';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { 
  listarPersonasConApadrinados,
  getPersonaConApadrinados
} from '../services/transmutaciones-personas.js';
import {
  crearApadrinadoRapido,
  actualizarApadrinadoDetalle,
  getAlumnosPorApadrinado
} from '../services/transmutaciones-apadrinados.js';

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

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function renderTransmutacionesPersonas(request, env) {
  try {
    // Verificar autenticación
    const authCheck = requireAdminAuth(request);
    if (authCheck.requiresAuth) {
      const loginUrl = new URL('/admin/login', request.url);
      return Response.redirect(loginUrl.toString(), 302);
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const personaId = url.searchParams.get('persona_id');
    const apadrinadoId = url.searchParams.get('apadrinado_id');

    // POST: Crear apadrinado rápido
    if (request.method === 'POST' && action === 'create_rapido') {
      try {
        const contentType = request.headers.get('content-type') || '';
        let nombre = '';
        let descripcion = '';
        let prioridad = 'Normal';
        let orden = 0;
        let alumno_id = null;
        
        if (contentType.includes('application/json')) {
          const body = await request.json();
          nombre = body.nombre || '';
          descripcion = body.descripcion || '';
          prioridad = body.prioridad || 'Normal';
          orden = parseInt(body.orden) || 0;
          alumno_id = body.alumno_id ? parseInt(body.alumno_id) : null;
        } else {
          const formData = await request.formData();
          nombre = formData.get('nombre') || '';
          descripcion = formData.get('descripcion') || '';
          prioridad = formData.get('prioridad') || 'Normal';
          orden = parseInt(formData.get('orden')) || 0;
          alumno_id = formData.get('alumno_id') ? parseInt(formData.get('alumno_id')) : null;
        }
        
        nombre = nombre ? String(nombre).trim() : '';
        descripcion = descripcion ? String(descripcion).trim() : null;
        
        if (!nombre || nombre === '') {
          return new Response(JSON.stringify({ error: 'Nombre requerido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (!alumno_id || isNaN(alumno_id)) {
          return new Response(JSON.stringify({ error: 'alumno_id requerido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Apadrinados no requieren frecuencia_dias, usar null
        const id = await crearApadrinadoRapido(nombre, 1, descripcion, null, prioridad, orden, alumno_id);
        
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

    // POST: Eliminar apadrinado
    if (request.method === 'POST' && action === 'delete') {
      try {
        if (!apadrinadoId || isNaN(parseInt(apadrinadoId))) {
          return new Response(JSON.stringify({ error: 'apadrinado_id requerido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        await query('DELETE FROM transmutaciones_apadrinados WHERE id = $1', [parseInt(apadrinadoId)]);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('[POST delete] ❌ Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Error interno del servidor' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET: Ver apadrinados de una persona
    if (action === 'ver_apadrinados') {
      if (!personaId) {
        return new Response(JSON.stringify({ error: 'persona_id requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const persona = await getPersonaConApadrinados(parseInt(personaId));
      
      if (!persona) {
        return new Response(JSON.stringify({ error: 'Persona no encontrada' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const html = `
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-bold text-white">Apadrinados: ${escapeHtml(persona.nombre_completo || persona.apodo || persona.email)}</h1>
            <button onclick="window.closeModalApadrinados()" class="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700">
              Cerrar
            </button>
          </div>
          
          <div class="space-y-2">
            ${persona.apadrinados && persona.apadrinados.length > 0 ? persona.apadrinados.map(ap => `
              <div class="bg-slate-700 rounded p-3 flex justify-between items-center">
                <div class="flex-1">
                  <div class="font-semibold text-white">${escapeHtml(ap.nombre || 'Sin nombre')}</div>
                  ${ap.descripcion ? `<div class="text-sm text-slate-300 mt-1">${escapeHtml(ap.descripcion)}</div>` : ''}
                  ${ap.ultima_limpieza ? `
                    <div class="text-xs text-green-300 mt-1">
                      Última limpieza: ${new Date(ap.ultima_limpieza).toLocaleDateString('es-ES')}
                    </div>
                  ` : '<div class="text-xs text-yellow-300 mt-1">Nunca limpiado</div>'}
                </div>
              </div>
            `).join('') : '<p class="text-slate-400 text-sm">No hay apadrinados registrados.</p>'}
          </div>
        </div>
        
        <script>
          window.closeModalApadrinados = function() {
            document.getElementById('modalApadrinados')?.remove();
          };
        </script>
      `;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // GET: Listar personas
    let personas = [];
    let errorMessage = null;
    try {
      personas = await listarPersonasConApadrinados();
    } catch (error) {
      console.error('Error obteniendo lista de personas:', error);
      errorMessage = error.message || 'Error desconocido al obtener personas';
      personas = [];
    }

    const content = `
      <div class="p-6">
        <h1 class="text-3xl font-bold text-white mb-6">👥 Personas de la plataforma</h1>
        
        <div class="bg-slate-800 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-white">Personas con Suscripción Activa</h2>
          </div>

          <!-- Tabla de Personas -->
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-slate-700">
                  <th class="pb-3 text-slate-300 font-semibold">Nombre</th>
                  <th class="pb-3 text-slate-300 font-semibold">Email</th>
                  <th class="pb-3 text-slate-300 font-semibold">Nivel</th>
                  <th class="pb-3 text-slate-300 font-semibold">Racha</th>
                  <th class="pb-3 text-slate-300 font-semibold">Apadrinados</th>
                  <th class="pb-3 text-slate-300 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody id="tbodyPersonas">
                ${personas.length > 0 ? personas.map(p => {
                  const nombreDisplay = escapeHtml(p.nombre_completo || p.apodo || p.email);
                  const emailDisplay = escapeHtml(p.email);
                  const apadrinadosCount = p.apadrinados ? p.apadrinados.length : 0;
                  const apadrinadosList = p.apadrinados && p.apadrinados.length > 0
                    ? p.apadrinados.map(ap => escapeHtml(ap.nombre || 'Sin nombre')).join(', ')
                    : 'Ninguno';
                  
                  return `
                    <tr class="border-b border-slate-700 hover:bg-slate-700" data-persona-id="${p.id}">
                      <td class="py-3">
                        <div class="font-semibold text-white">${nombreDisplay}</div>
                      </td>
                      <td class="py-3 text-sm text-slate-300">${emailDisplay}</td>
                      <td class="py-3 text-sm text-slate-300">${p.nivel_actual || 1}</td>
                      <td class="py-3 text-sm text-slate-300">${p.racha || 0} días</td>
                      <td class="py-3">
                        <div class="text-sm text-slate-300">
                          ${apadrinadosCount > 0 ? `
                            <span class="text-white font-medium">${apadrinadosCount}</span> apadrinado${apadrinadosCount > 1 ? 's' : ''}
                            <div class="text-xs text-slate-400 mt-1">${apadrinadosList}</div>
                          ` : '<span class="text-slate-500">Sin apadrinados</span>'}
                        </div>
                      </td>
                      <td class="py-3">
                        <button 
                          onclick="agregarApadrinado(${p.id}, '${nombreDisplay.replace(/'/g, "\\'")}')"
                          class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700 mr-2"
                          title="Añadir apadrinado"
                        >
                          + Añadir
                        </button>
                        ${apadrinadosCount > 0 ? `
                          <button 
                            onclick="verApadrinadosPersona(${p.id})"
                            class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            title="Ver apadrinados"
                          >
                            Ver
                          </button>
                        ` : ''}
                      </td>
                    </tr>
                  `;
                }).join('') : '<tr><td colspan="6" class="py-4 text-center text-slate-400">No hay personas con suscripción activa.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal para añadir apadrinado -->
      <div id="modalAñadirApadrinado" class="hidden fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onclick="if(event.target.id === 'modalAñadirApadrinado') cerrarModalAñadir()">
        <div class="bg-slate-800 rounded-lg border border-slate-600 max-w-md w-full" onclick="event.stopPropagation()">
          <div class="p-6 border-b border-slate-700 flex justify-between items-center">
            <h3 class="text-xl font-bold text-white" id="modalTituloAñadir">Añadir Apadrinado</h3>
            <button onclick="cerrarModalAñadir()" class="text-slate-400 hover:text-white text-2xl font-bold">&times;</button>
          </div>
          <form id="formAñadirApadrinado" class="p-6">
            <input type="hidden" id="inputPersonaId" name="persona_id" />
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-300 mb-2">Nombre del apadrinado</label>
              <input 
                type="text" 
                id="inputNombreApadrinado"
                name="nombre"
                placeholder="Nombre del apadrinado..."
                class="w-full bg-slate-600 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-300 mb-2">Descripción (opcional)</label>
              <input 
                type="text" 
                id="inputDescripcionApadrinado"
                name="descripcion"
                placeholder="Descripción..."
                class="w-full bg-slate-600 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div class="flex gap-2">
              <button 
                type="submit"
                class="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Crear
              </button>
              <button 
                type="button"
                onclick="cerrarModalAñadir()"
                class="flex-1 bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>

      <script>
        function agregarApadrinado(personaId, personaNombre) {
          document.getElementById('inputPersonaId').value = personaId;
          document.getElementById('modalTituloAñadir').textContent = \`Añadir Apadrinado - \${personaNombre}\`;
          document.getElementById('modalAñadirApadrinado').classList.remove('hidden');
          document.getElementById('inputNombreApadrinado').focus();
        }

        function cerrarModalAñadir() {
          document.getElementById('modalAñadirApadrinado').classList.add('hidden');
          document.getElementById('formAñadirApadrinado').reset();
        }

        document.getElementById('formAñadirApadrinado').addEventListener('submit', async (e) => {
          e.preventDefault();
          const personaId = parseInt(document.getElementById('inputPersonaId').value);
          const nombre = document.getElementById('inputNombreApadrinado').value.trim();
          const descripcion = document.getElementById('inputDescripcionApadrinado').value.trim();

          if (!nombre) {
            alert('Por favor, introduce un nombre para el apadrinado');
            return;
          }

          const submitBtn = e.target.querySelector('button[type="submit"]');
          const originalText = submitBtn.textContent;
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creando...';

          try {
            const res = await fetch('?action=create_rapido', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nombre,
                descripcion: descripcion || null,
                prioridad: 'Normal',
                orden: 0,
                alumno_id: personaId
              })
            });

            const data = await res.json();

            if (res.ok && data.success) {
              cerrarModalAñadir();
              location.reload();
            } else {
              alert('Error creando apadrinado: ' + (data.error || 'Error desconocido'));
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
            }
          } catch (error) {
            alert('Error de conexión: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
        });

        async function verApadrinadosPersona(personaId) {
          const response = await fetch(\`?action=ver_apadrinados&persona_id=\${personaId}\`);
          const html = await response.text();
          
          const modal = document.createElement('div');
          modal.id = 'modalApadrinados';
          modal.className = 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4';
          modal.innerHTML = \`
            <div class="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
      </script>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Personas de la plataforma',
      CONTENT: content
    });

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando personas:', error);
    console.error('Stack trace:', error.stack);
    
    const errorHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error - Personas de la plataforma</title>
        <style>
          body { font-family: system-ui; background: #1e1e1e; color: #fff; padding: 20px; }
          .error { background: #7f1d1d; border: 1px solid #991b1b; padding: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Error al cargar Personas de la plataforma</h1>
          <p>${error.message || 'Error desconocido'}</p>
          <p><a href="/admin/dashboard" style="color: #60a5fa;">Volver al dashboard</a></p>
        </div>
      </body>
      </html>
    `;
    
    return new Response(errorHTML, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
}
