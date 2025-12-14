// src/endpoints/admin-panel-modulos.js
// Panel de administración para gestión de módulos V6

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { 
  listarModulos, 
  actualizarEstado, 
  getModulo 
} from '../services/modulos.js';

const __dirname = resolve();
const baseTemplate = readFileSync(resolve(__dirname, 'src/core/html/admin/base.html'), 'utf-8');

function replace(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

/**
 * Renderiza la página de gestión de módulos
 */
export async function renderModulos(request, env) {
  try {
    const modulos = await listarModulos();

    const getEstadoBadge = (estado) => {
      const badges = {
        'on': '<span class="px-3 py-1 bg-green-900 text-green-200 rounded-full text-xs font-semibold">🟢 ON</span>',
        'beta': '<span class="px-3 py-1 bg-yellow-900 text-yellow-200 rounded-full text-xs font-semibold">🟡 BETA</span>',
        'off': '<span class="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-semibold">⚫ OFF</span>'
      };
      return badges[estado] || badges.off;
    };

    const renderModuloCard = (modulo) => `
      <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-indigo-500 transition-colors">
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <h4 class="text-lg font-semibold text-white">${modulo.nombre}</h4>
            <p class="text-sm text-slate-400 mt-1">${modulo.descripcion || 'Sin descripción'}</p>
            <p class="text-xs text-slate-500 mt-2">Código: <code class="bg-slate-900 px-2 py-1 rounded">${modulo.codigo}</code></p>
          </div>
          <div class="ml-4" data-modulo="${modulo.codigo}" data-estado="${modulo.estado}">
            ${getEstadoBadge(modulo.estado)}
          </div>
        </div>
        
        <div class="flex gap-2 mt-4">
          <button onclick="cambiarEstado('${modulo.codigo}', 'off')" 
                  class="flex-1 px-3 py-2 ${modulo.estado === 'off' ? 'bg-slate-600 ring-2 ring-slate-400' : 'bg-slate-700'} text-slate-200 rounded hover:bg-slate-600 transition-all text-sm font-medium">
            ⚫ OFF
          </button>
          <button onclick="cambiarEstado('${modulo.codigo}', 'beta')" 
                  class="flex-1 px-3 py-2 ${modulo.estado === 'beta' ? 'bg-yellow-700 ring-2 ring-yellow-400' : 'bg-slate-700'} text-slate-200 rounded hover:bg-yellow-700 transition-all text-sm font-medium">
            🟡 BETA
          </button>
          <button onclick="cambiarEstado('${modulo.codigo}', 'on')" 
                  class="flex-1 px-3 py-2 ${modulo.estado === 'on' ? 'bg-green-700 ring-2 ring-green-400' : 'bg-slate-700'} text-slate-200 rounded hover:bg-green-700 transition-all text-sm font-medium">
            🟢 ON
          </button>
        </div>
      </div>
    `;

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="mb-6">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h2 class="text-2xl font-bold text-white mb-2">⚙️ Gestión de Módulos del Sistema</h2>
              <p class="text-slate-400">
                Controla qué módulos están activos en AuriPortal. 
                <span class="text-yellow-400">BETA</span> = Solo visible para admins. 
                <span class="text-green-400">ON</span> = Activo para todos.
                <span class="text-slate-400">OFF</span> = Desactivado completamente.
              </p>
            </div>
            <button onclick="activarTodosModulos()" 
                    class="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors">
              🟢 Activar Todos (ON)
            </button>
          </div>
        </div>

        <!-- Estadísticas -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-green-900/30 border border-green-700 rounded-lg p-4">
            <div class="text-green-400 text-2xl font-bold">${modulos.filter(m => m.estado === 'on').length}</div>
            <div class="text-green-300 text-sm">Módulos Activos (ON)</div>
          </div>
          <div class="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
            <div class="text-yellow-400 text-2xl font-bold">${modulos.filter(m => m.estado === 'beta').length}</div>
            <div class="text-yellow-300 text-sm">Módulos en Beta</div>
          </div>
          <div class="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div class="text-slate-400 text-2xl font-bold">${modulos.filter(m => m.estado === 'off').length}</div>
            <div class="text-slate-300 text-sm">Módulos Desactivados</div>
          </div>
        </div>

        <!-- Todos los Módulos -->
        <div class="mb-8">
          <h3 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⚙️</span> Todos los Módulos
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${modulos.map(renderModuloCard).join('')}
          </div>
        </div>

        <!-- Aviso importante -->
        <div class="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4 mt-6">
          <h4 class="text-indigo-300 font-semibold mb-2">ℹ️ Información Importante</h4>
          <ul class="text-slate-300 text-sm space-y-1">
            <li>• Los cambios son <strong>inmediatos</strong> y afectan a todos los usuarios</li>
            <li>• Módulos en <span class="text-yellow-400">BETA</span> solo son visibles en el Admin Panel</li>
            <li>• Módulos en <span class="text-slate-400">OFF</span> no aparecen en ningún lugar del portal</li>
            <li>• Los endpoints de módulos OFF devuelven 404 automáticamente</li>
          </ul>
        </div>
      </div>

      <script>
        const todosLosModulos = ${JSON.stringify(modulos.map(m => m.codigo))};
        
        async function activarTodosModulos() {
          if (!confirm('¿Estás seguro de activar TODOS los módulos a ON?')) {
            return;
          }
          
          try {
            const response = await fetch('/admin/modulos?activarTodos=true', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            if (result.success) {
              alert('✅ ' + result.activados + ' de ' + result.total + ' módulos activados correctamente');
            } else {
              alert('❌ Error activando módulos');
            }
            location.reload();
          } catch (error) {
            alert('❌ Error: ' + error.message);
          }
        }
        
        async function cambiarEstado(codigo, nuevoEstado) {
          // Cambio instantáneo sin confirmación
          const botones = document.querySelectorAll('button[onclick*="' + codigo + '"]');
          const estadoActual = document.querySelector('[data-modulo="' + codigo + '"]')?.dataset.estado;
          
          // Feedback visual inmediato
          botones.forEach(btn => {
            if (btn.textContent.includes(nuevoEstado.toUpperCase())) {
              btn.classList.add('ring-2', 'ring-indigo-400');
            } else {
              btn.classList.remove('ring-2', 'ring-indigo-400');
            }
          });

          try {
            const response = await fetch('/admin/modulos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ codigo, estado: nuevoEstado })
            });

            if (response.ok) {
              // Actualizar badge de estado visualmente
              const badge = document.querySelector('[data-modulo="' + codigo + '"]');
              if (badge) {
                const badges = {
                  'on': '<span class="px-3 py-1 bg-green-900 text-green-200 rounded-full text-xs font-semibold">🟢 ON</span>',
                  'beta': '<span class="px-3 py-1 bg-yellow-900 text-yellow-200 rounded-full text-xs font-semibold">🟡 BETA</span>',
                  'off': '<span class="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-semibold">⚫ OFF</span>'
                };
                badge.outerHTML = badges[nuevoEstado];
              }
              
              // Recargar después de 300ms para mostrar el cambio
              setTimeout(() => location.reload(), 300);
            } else {
              const error = await response.json();
              alert('Error: ' + (error.message || 'No se pudo actualizar el módulo'));
              location.reload();
            }
          } catch (error) {
            alert('Error de conexión: ' + error.message);
            location.reload();
          }
        }
      </script>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Gestión de Módulos',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando módulos:', error);
    return new Response(`Error interno del servidor: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja la actualización de estado de módulos
 */
export async function handleModulos(request, env) {
  try {
    const body = await request.json();
    const { codigo, estado } = body;

    if (!codigo || !estado) {
      return new Response(
        JSON.stringify({ error: 'Código y estado son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['off', 'beta', 'on'].includes(estado)) {
      return new Response(
        JSON.stringify({ error: 'Estado inválido. Debe ser: off, beta u on' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const success = await actualizarEstado(codigo, estado);

    if (success) {
      return new Response(
        JSON.stringify({ success: true, codigo, estado }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'No se pudo actualizar el módulo' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error manejando actualización de módulo:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

