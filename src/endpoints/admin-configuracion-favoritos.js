// src/endpoints/admin-configuracion-favoritos.js
// Endpoint para configurar favoritos del admin

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';
import { 
  listarFavoritos,
  crearFavorito,
  actualizarFavorito,
  eliminarFavorito,
  getRutasDisponibles
} from '../services/admin-favoritos.js';

/**
 * Obtiene la URL absoluta asegurando HTTPS
 */
function getAbsoluteUrl(request, path) {
  const url = new URL(request.url);
  // Asegurar que el protocolo sea HTTPS si la petición original era HTTPS
  if (url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https') {
    url.protocol = 'https:';
  }
  
  // Separar path y query parameters
  const [pathname, search] = path.split('?');
  url.pathname = pathname;
  url.search = search || ''; // Mantener query params si existen
  
  return url.toString();
}

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

export async function renderConfiguracionFavoritos(request, env) {
  const favoritos = await listarFavoritos();
  const rutasDisponibles = getRutasDisponibles();
  
  // Filtrar rutas ya agregadas
  const rutasAgregadas = new Set(favoritos.map(f => f.ruta));
  const rutasSinAgregar = rutasDisponibles.filter(r => !rutasAgregadas.has(r.ruta));

  const content = `
    <div class="p-6">
      <h1 class="text-3xl font-bold text-white mb-6">⭐ Configuración de Favoritos</h1>
      
      <div class="bg-slate-800 rounded-lg p-6 mb-6">
        <h2 class="text-xl font-semibold text-white mb-4">Favoritos Actuales</h2>
        
        ${favoritos.length > 0 ? `
          <div class="space-y-2">
            ${favoritos.map(f => `
              <div class="flex items-center justify-between bg-slate-700 rounded p-3">
                <div class="flex items-center">
                  <span class="mr-3 text-lg">${f.icono || '⭐'}</span>
                  <span class="text-white">${f.nombre}</span>
                  <span class="ml-3 text-sm text-slate-400">${f.ruta}</span>
                </div>
                <div class="flex gap-2">
                  <button 
                    onclick="eliminarFavorito(${f.id})"
                    class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-slate-400">No hay favoritos configurados</p>'}
      </div>

      <div class="bg-slate-800 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-white mb-4">Agregar Nuevo Favorito</h2>
        
        ${rutasSinAgregar.length > 0 ? `
          <form id="formAgregarFavorito" class="space-y-4">
            <div>
              <label class="block text-slate-300 mb-2">Ruta</label>
              <select 
                id="selectRuta"
                name="ruta"
                class="w-full bg-slate-700 text-white rounded px-4 py-2"
                required
              >
                <option value="">Selecciona una ruta</option>
                ${rutasSinAgregar.map(r => `
                  <option value="${r.ruta}" data-nombre="${r.nombre}" data-icono="${r.icono}">
                    ${r.nombre} (${r.ruta})
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div>
              <label class="block text-slate-300 mb-2">Nombre (opcional, por defecto usa el nombre de la ruta)</label>
              <input 
                type="text"
                id="inputNombre"
                name="nombre"
                class="w-full bg-slate-700 text-white rounded px-4 py-2"
                placeholder="Deja vacío para usar el nombre por defecto"
              />
            </div>
            
            <div>
              <label class="block text-slate-300 mb-2">Icono (opcional, por defecto ⭐)</label>
              <input 
                type="text"
                id="inputIcono"
                name="icono"
                class="w-full bg-slate-700 text-white rounded px-4 py-2"
                placeholder="⭐"
                maxlength="5"
              />
            </div>
            
            <div>
              <label class="block text-slate-300 mb-2">Orden</label>
              <input 
                type="number"
                id="inputOrden"
                name="orden"
                value="0"
                class="w-full bg-slate-700 text-white rounded px-4 py-2"
              />
            </div>
            
            <button 
              type="submit"
              class="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700"
            >
              Agregar Favorito
            </button>
          </form>
        ` : '<p class="text-slate-400">Todas las rutas disponibles ya están en favoritos</p>'}
      </div>
    </div>

    <script>
      // Auto-completar nombre e icono al seleccionar ruta
      document.getElementById('selectRuta')?.addEventListener('change', function() {
        const option = this.options[this.selectedIndex];
        if (option.value) {
          document.getElementById('inputNombre').value = option.dataset.nombre || '';
          document.getElementById('inputIcono').value = option.dataset.icono || '⭐';
        }
      });

      // Enviar formulario
      document.getElementById('formAgregarFavorito')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        formData.append('action', 'create');
        
        try {
          const res = await fetch('/admin/configuracion-favoritos', {
            method: 'POST',
            body: formData
          });
          
          if (res.ok) {
            location.reload();
          } else {
            const errorText = await res.text();
            alert('Error agregando favorito: ' + errorText);
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      });

      // Eliminar favorito
      async function eliminarFavorito(id) {
        if (!confirm('¿Estás seguro de eliminar este favorito?')) return;
        
        try {
          const formData = new FormData();
          formData.append('action', 'delete');
          formData.append('id', id);
          
          const res = await fetch('/admin/configuracion-favoritos', {
            method: 'POST',
            body: formData
          });
          
          if (res.ok) {
            location.reload();
          } else {
            alert('Error eliminando favorito');
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    </script>
  `;

  return new Response(replace(baseTemplate, { TITLE: 'Configuración de Favoritos', CONTENT: content }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

export async function handleFavoritos(request, env) {
  try {
    const formData = await request.formData();
    const action = formData.get('action');
    
    console.log('[Favoritos] Acción recibida:', action);
    console.log('[Favoritos] Todos los campos del formData:');
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    if (action === 'create') {
      const ruta = formData.get('ruta');
      const nombre = formData.get('nombre') || getRutasDisponibles().find(r => r.ruta === ruta)?.nombre || 'Favorito';
      const icono = formData.get('icono') || '⭐';
      const orden = parseInt(formData.get('orden') || '0');

      console.log('[Favoritos] Creando favorito:', { ruta, nombre, icono, orden });

      if (!ruta) {
        return new Response('La ruta es requerida', { status: 400 });
      }

      await crearFavorito({ ruta, nombre, icono, orden });
      
      return Response.redirect(getAbsoluteUrl(request, '/admin/configuracion-favoritos?success=created'), 302);
    }

    if (action === 'delete') {
      const id = parseInt(formData.get('id'));
      console.log('[Favoritos] Eliminando favorito ID:', id);
      
      if (!id || isNaN(id)) {
        return new Response('ID inválido', { status: 400 });
      }
      
      await eliminarFavorito(id);
      
      return Response.redirect(getAbsoluteUrl(request, '/admin/configuracion-favoritos?success=deleted'), 302);
    }

    console.error('[Favoritos] Acción no válida:', action);
    return new Response('Acción no válida. Acción recibida: ' + (action || 'ninguna'), { status: 400 });
  } catch (error) {
    console.error('Error manejando favoritos:', error);
    return Response.redirect(getAbsoluteUrl(request, `/admin/configuracion-favoritos?error=${encodeURIComponent(error.message)}`), 302);
  }
}














