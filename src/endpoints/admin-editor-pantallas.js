// src/endpoints/admin-editor-pantallas.js
// Editor profesional de pantallas HTML para AuriPortal Admin

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname, basename } from 'path';
import { requireAdminAuth } from '../modules/admin-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar template base
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

/**
 * Reemplaza placeholders en templates
 */
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
 * Obtiene todas las pantallas HTML disponibles
 */
function obtenerPantallasHTML() {
  try {
    const htmlDir = join(__dirname, '../core/html');
    
    if (!existsSync(htmlDir)) {
      console.error(`[Editor Pantallas] Directorio HTML no existe: ${htmlDir}`);
      return [];
    }
    
    const pantallas = [];
    
    function scanDirectory(dir, relativePath = '') {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          
          if (!existsSync(fullPath)) {
            continue;
          }
          
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            // Escanear subdirectorios (como admin/)
            scanDirectory(fullPath, join(relativePath, item));
          } else if (stat.isFile() && extname(item).toLowerCase() === '.html') {
            const relativeFilePath = join(relativePath, item);
            const nombre = basename(item, '.html');
            
            pantallas.push({
              nombre: nombre,
              ruta: relativeFilePath,
              rutaCompleta: fullPath,
              rutaRelativa: relativeFilePath.replace(/\\/g, '/'),
              tamaño: stat.size,
              modificado: stat.mtime
            });
          }
        }
      } catch (error) {
        console.error(`[Editor Pantallas] Error escaneando directorio ${dir}:`, error.message);
      }
    }
    
    scanDirectory(htmlDir);
    
    // Ordenar por nombre
    pantallas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    return pantallas;
  } catch (error) {
    console.error('[Editor Pantallas] Error obteniendo pantallas HTML:', error);
    return [];
  }
}

/**
 * Renderiza el editor de pantallas
 */
/**
 * Helper para crear URLs absolutas para redirecciones
 */
function getAbsoluteUrl(request, path) {
  const url = new URL(request.url);
  // Detectar HTTPS desde headers de proxy (nginx) o del URL
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isHttps = forwardedProto === 'https' || url.protocol === 'https:' || 
                   request.headers.get('x-forwarded-ssl') === 'on';
  const protocol = isHttps ? 'https:' : 'http:';
  return `${protocol}//${url.host}${path}`;
}

export async function renderEditorPantallas(request, env) {
  // Verificar autenticación
  const authCheck = requireAdminAuth(request);
  if (authCheck.requiresAuth) {
    return Response.redirect(getAbsoluteUrl(request, '/admin/login'), 302);
  }
  
  const url = new URL(request.url);
  let path = url.pathname;
  
  // Normalizar path si viene del subdominio admin
  const host = url.hostname;
  if (host === 'admin.pdeeugenihidalgo.org' || host.startsWith('admin.')) {
    if (path === '/' || path === '') {
      path = '/admin';
    } else if (!path.startsWith('/admin') && !path.startsWith('/portal') && !path.startsWith('/api')) {
      path = '/admin' + path;
    }
  }
  
  // Detectar rutas de API del editor
  const isApiListar = (path.includes('/editor-pantallas/api/listar') || path.endsWith('/editor-pantallas/api/listar')) && request.method === 'GET';
  const isApiObtener = (path.includes('/editor-pantallas/api/obtener') || path.endsWith('/editor-pantallas/api/obtener')) && request.method === 'POST';
  const isApiGuardar = (path.includes('/editor-pantallas/api/guardar') || path.endsWith('/editor-pantallas/api/guardar')) && request.method === 'POST';
  
  // API: Listar pantallas
  if (isApiListar) {
    try {
      const pantallas = obtenerPantallasHTML();
      return new Response(JSON.stringify({ 
        success: true, 
        pantallas: pantallas.map(p => ({
          nombre: p.nombre,
          ruta: p.rutaRelativa,
          tamaño: p.tamaño,
          modificado: p.modificado.toISOString()
        }))
      }), {
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
      });
    }
  }
  
  // API: Obtener contenido de una pantalla
  if (isApiObtener) {
    try {
      const body = await request.json();
      const { ruta } = body;
      
      if (!ruta) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Ruta no especificada' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' }
        });
      }
      
      const htmlDir = join(__dirname, '../core/html');
      const filePath = join(htmlDir, ruta);
      
      // Validar que el archivo esté dentro del directorio HTML (seguridad)
      if (!filePath.startsWith(htmlDir)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Ruta no válida' 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' }
        });
      }
      
      if (!existsSync(filePath)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Archivo no encontrado' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' }
        });
      }
      
      const contenido = readFileSync(filePath, 'utf-8');
      const stat = statSync(filePath);
      
      return new Response(JSON.stringify({ 
        success: true, 
        contenido,
        ruta,
        modificado: stat.mtime.toISOString(),
        tamaño: stat.size
      }), {
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
      });
    }
  }
  
  // API: Guardar contenido de una pantalla
  if (isApiGuardar) {
    try {
      const body = await request.json();
      const { ruta, contenido } = body;
      
      if (!ruta || contenido === undefined) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Ruta y contenido son requeridos' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' }
        });
      }
      
      const htmlDir = join(__dirname, '../core/html');
      const filePath = join(htmlDir, ruta);
      
      // Validar que el archivo esté dentro del directorio HTML (seguridad)
      if (!filePath.startsWith(htmlDir)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Ruta no válida' 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' }
        });
      }
      
      // Crear directorio si no existe
      const { mkdirSync } = await import('fs');
      const dirPath = dirname(filePath);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
      
      // Guardar archivo
      writeFileSync(filePath, contenido, 'utf-8');
      
      const stat = statSync(filePath);
      
      return new Response(JSON.stringify({ 
        success: true, 
        mensaje: 'Archivo guardado correctamente',
        modificado: stat.mtime.toISOString(),
        tamaño: stat.size
      }), {
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
      });
    }
  }
  
  // Vista principal del editor
  let pantallas = [];
  try {
    pantallas = obtenerPantallasHTML();
  } catch (error) {
    console.error('[Editor Pantallas] Error obteniendo lista de pantallas:', error);
    // Continuar con lista vacía en caso de error
  }
  
  const content = `
    <div class="px-4 py-5 sm:p-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-white mb-2">🎨 Editor de Pantallas HTML</h2>
          <p class="text-slate-400">Edita profesionalmente todas las pantallas HTML del portal</p>
        </div>
        <div class="flex gap-2">
          <button onclick="recargarLista()" class="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors">
            🔄 Recargar
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Panel izquierdo: Lista de pantallas -->
        <div class="lg:col-span-1">
          <div class="bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
            <div class="p-4 border-b border-slate-700">
              <h3 class="text-lg font-semibold text-white mb-2">📄 Pantallas Disponibles</h3>
              <input 
                type="text" 
                id="buscar-pantalla" 
                placeholder="Buscar pantalla..."
                class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onkeyup="filtrarPantallas()"
              />
            </div>
            <div class="p-2 max-h-[600px] overflow-y-auto" id="lista-pantallas">
              ${pantallas.map(p => {
                const rutaEscapada = p.rutaRelativa.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const nombreEscapado = p.nombre.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                return `
                <div 
                  class="pantalla-item p-3 mb-2 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors"
                  data-ruta="${p.rutaRelativa.replace(/"/g, '&quot;')}"
                  data-nombre="${p.nombre.replace(/"/g, '&quot;')}"
                  onclick="cargarPantallaDesdeElemento(this)"
                >
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="text-white font-medium">${p.nombre}</div>
                      <div class="text-xs text-slate-400 mt-1">${p.rutaRelativa}</div>
                      <div class="text-xs text-slate-500 mt-1">
                        ${(p.tamaño / 1024).toFixed(2)} KB • 
                        ${new Date(p.modificado).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                    <div class="text-slate-500 text-xs">📄</div>
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Panel derecho: Editor -->
        <div class="lg:col-span-2">
          <div class="bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
            <div class="p-4 border-b border-slate-700 flex justify-between items-center">
              <div>
                <h3 class="text-lg font-semibold text-white" id="nombre-pantalla-actual">
                  Selecciona una pantalla para editar
                </h3>
                <p class="text-sm text-slate-400" id="ruta-pantalla-actual"></p>
              </div>
              <div class="flex gap-2">
                <button 
                  id="btn-preview" 
                  onclick="mostrarPreview()" 
                  class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors hidden"
                  disabled
                >
                  👁️ Preview
                </button>
                <button 
                  id="btn-guardar" 
                  onclick="guardarPantalla()" 
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors hidden"
                  disabled
                >
                  💾 Guardar
                </button>
              </div>
            </div>
            
            <div id="editor-container" class="hidden">
              <div class="p-4 border-b border-slate-700 flex gap-2">
                <button 
                  id="btn-vista-visual" 
                  onclick="cambiarVista('visual')" 
                  class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  ✏️ Vista Visual
                </button>
                <button 
                  id="btn-vista-codigo" 
                  onclick="cambiarVista('codigo')" 
                  class="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  💻 Ver Código
                </button>
              </div>
              
              <!-- Editor Visual (Quill.js) -->
              <div id="editor-visual-container" class="p-4">
                <div id="editor-visual" style="min-height: 600px; background: #1e293b; border-radius: 8px;"></div>
              </div>
              
              <!-- Editor de Código (solo lectura/edición avanzada) -->
              <div id="editor-codigo-container" class="hidden p-4">
                <textarea 
                  id="editor-codigo" 
                  class="w-full h-[600px] bg-slate-900 text-white font-mono text-sm p-4 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  spellcheck="false"
                ></textarea>
              </div>
            </div>
            
            <div id="mensaje-inicial" class="p-12 text-center">
              <div class="text-6xl mb-4">🎨</div>
              <h3 class="text-xl font-semibold text-white mb-2">Editor Visual de Pantallas HTML</h3>
              <p class="text-slate-400">Selecciona una pantalla del panel izquierdo para comenzar a editar visualmente</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de Preview -->
      <div id="modal-preview" class="hidden fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div class="bg-slate-900 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
          <div class="p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 class="text-lg font-semibold text-white">👁️ Preview de Pantalla</h3>
            <button onclick="cerrarPreview()" class="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">
              ✕ Cerrar
            </button>
          </div>
          <iframe id="iframe-preview" class="flex-1 w-full border-0 bg-white"></iframe>
        </div>
      </div>
    </div>

    <!-- Quill.js Editor Visual -->
    <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
    <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
    <script>
      // Variables globales
      let editorQuill = null;
      let pantallaActual = null;
      let rutaActual = null;
      let vistaActual = 'visual';
      let contenidoOriginal = '';

      // Inicializar Quill cuando el DOM esté listo
      document.addEventListener('DOMContentLoaded', function() {
        const quillContainer = document.getElementById('editor-visual');
        if (quillContainer) {
          editorQuill = new Quill('#editor-visual', {
            theme: 'snow',
            modules: {
              toolbar: [
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'image', 'video'],
                ['blockquote', 'code-block'],
                ['clean']
              ]
            },
            placeholder: 'Edita el contenido HTML visualmente...'
          });
          
          // Estilo personalizado para el editor
          const editorElement = document.querySelector('#editor-visual .ql-editor');
          if (editorElement) {
            editorElement.style.minHeight = '600px';
            editorElement.style.backgroundColor = '#1e293b';
            editorElement.style.color = '#f1f5f9';
          }
        }
      });

      // Funciones globales (window para asegurar acceso desde onclick)
      window.filtrarPantallas = function() {
        const busqueda = document.getElementById('buscar-pantalla').value.toLowerCase();
        const items = document.querySelectorAll('.pantalla-item');
        
        items.forEach(item => {
          const nombre = item.textContent.toLowerCase();
          if (nombre.includes(busqueda)) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      };

      // Función helper para cargar desde el elemento (evita problemas de escape)
      window.cargarPantallaDesdeElemento = function(elemento) {
        const ruta = elemento.getAttribute('data-ruta');
        const nombre = elemento.getAttribute('data-nombre');
        window.cargarPantalla(ruta, nombre);
      };

      window.cargarPantalla = async function(ruta, nombre) {
        try {
          // Actualizar UI
          document.getElementById('nombre-pantalla-actual').textContent = nombre;
          document.getElementById('ruta-pantalla-actual').textContent = ruta;
          document.getElementById('mensaje-inicial').classList.add('hidden');
          document.getElementById('editor-container').classList.remove('hidden');
          document.getElementById('btn-guardar').classList.remove('hidden');
          document.getElementById('btn-guardar').disabled = false;
          document.getElementById('btn-preview').classList.remove('hidden');
          document.getElementById('btn-preview').disabled = false;
          
          // Marcar como activa - buscar el elemento por data-ruta
          document.querySelectorAll('.pantalla-item').forEach(item => {
            item.classList.remove('bg-indigo-900', 'border-indigo-600');
            if (item.getAttribute('data-ruta') === ruta) {
              item.classList.add('bg-indigo-900', 'border-indigo-600');
            }
          });
          
          // Cargar contenido
          const response = await fetch('/admin/editor-pantallas/api/obtener', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ruta })
          });
          
          const data = await response.json();
          
          if (!data.success) {
            alert('Error: ' + data.error);
            return;
          }
          
          pantallaActual = nombre;
          rutaActual = ruta;
          contenidoOriginal = data.contenido;
          
          // Cargar contenido en el editor visual (Quill)
          if (editorQuill) {
            // Quill necesita el HTML limpio, extraer solo el body si es un documento completo
            let htmlContent = data.contenido;
            // Si es un documento HTML completo, extraer solo el body
            const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            if (bodyMatch) {
              htmlContent = bodyMatch[1];
            }
            editorQuill.root.innerHTML = htmlContent;
          } else {
            // Si Quill aún no está inicializado, esperar un momento
            setTimeout(() => {
              if (editorQuill) {
                let htmlContent = data.contenido;
                const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                if (bodyMatch) {
                  htmlContent = bodyMatch[1];
                }
                editorQuill.root.innerHTML = htmlContent;
              }
            }, 500);
          }
          
          // Cargar también en el editor de código
          document.getElementById('editor-codigo').value = data.contenido;
          
          // Asegurar que estemos en vista visual
          cambiarVista('visual');
          
        } catch (error) {
          console.error('Error cargando pantalla:', error);
          alert('Error al cargar la pantalla: ' + error.message);
        }
      };
      
      window.cambiarVista = function(vista) {
        vistaActual = vista;
        
        if (vista === 'visual') {
          document.getElementById('editor-visual-container').classList.remove('hidden');
          document.getElementById('editor-codigo-container').classList.add('hidden');
          document.getElementById('btn-vista-visual').classList.add('bg-indigo-600');
          document.getElementById('btn-vista-visual').classList.remove('bg-slate-700');
          document.getElementById('btn-vista-codigo').classList.remove('bg-indigo-600');
          document.getElementById('btn-vista-codigo').classList.add('bg-slate-700');
          
          // Sincronizar contenido del código al visual
          if (editorQuill) {
            const codigo = document.getElementById('editor-codigo').value;
            let htmlContent = codigo;
            // Extraer solo el body si es un documento completo
            const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            if (bodyMatch) {
              htmlContent = bodyMatch[1];
            }
            editorQuill.root.innerHTML = htmlContent;
          }
        } else {
          document.getElementById('editor-visual-container').classList.add('hidden');
          document.getElementById('editor-codigo-container').classList.remove('hidden');
          document.getElementById('btn-vista-visual').classList.remove('bg-indigo-600');
          document.getElementById('btn-vista-visual').classList.add('bg-slate-700');
          document.getElementById('btn-vista-codigo').classList.add('bg-indigo-600');
          document.getElementById('btn-vista-codigo').classList.remove('bg-slate-700');
          
          // Sincronizar contenido del visual al código
          if (editorQuill) {
            const visual = editorQuill.root.innerHTML;
            // Si el contenido original tenía estructura HTML completa, mantenerla
            const codigoActual = document.getElementById('editor-codigo').value;
            if (codigoActual.includes('<!DOCTYPE') || codigoActual.includes('<html')) {
              // Reemplazar solo el contenido del body
              const nuevoCodigo = codigoActual.replace(
                /<body[^>]*>[\s\S]*<\/body>/i,
                '<body>' + visual + '</body>'
              );
              document.getElementById('editor-codigo').value = nuevoCodigo;
            } else {
              document.getElementById('editor-codigo').value = visual;
            }
          }
        }
      };

      window.guardarPantalla = async function() {
        if (!rutaActual) {
          alert('No hay pantalla seleccionada');
          return;
        }
        
        // Obtener contenido según la vista actual
        let contenido = '';
        if (vistaActual === 'visual' && editorQuill) {
          const visualContent = editorQuill.root.innerHTML;
          // Si el contenido original tenía estructura HTML completa, mantenerla
          if (contenidoOriginal.includes('<!DOCTYPE') || contenidoOriginal.includes('<html')) {
            // Reemplazar solo el contenido del body
            contenido = contenidoOriginal.replace(
              /<body[^>]*>[\s\S]*<\/body>/i,
              '<body>' + visualContent + '</body>'
            );
          } else {
            contenido = visualContent;
          }
        } else {
          contenido = document.getElementById('editor-codigo').value;
        }
        
        if (!contenido) {
          alert('El contenido está vacío');
          return;
        }
        
        if (!confirm('¿Estás seguro de que quieres guardar los cambios en ' + pantallaActual + '?')) {
          return;
        }
        
        try {
          const response = await fetch('/admin/editor-pantallas/api/guardar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ruta: rutaActual,
              contenido: contenido
            })
          });
          
          const data = await response.json();
          
          if (data.success) {
            alert('✅ Pantalla guardada correctamente');
            contenidoOriginal = contenido;
            // Sincronizar ambos editores
            if (editorQuill) {
              let htmlContent = contenido;
              const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
              if (bodyMatch) {
                htmlContent = bodyMatch[1];
              }
              editorQuill.root.innerHTML = htmlContent;
            }
            document.getElementById('editor-codigo').value = contenido;
            // Recargar lista para actualizar fechas
            recargarLista();
          } else {
            alert('❌ Error: ' + data.error);
          }
        } catch (error) {
          console.error('Error guardando pantalla:', error);
          alert('Error al guardar: ' + error.message);
        }
      };

      window.mostrarPreview = function() {
        if (!rutaActual) {
          alert('No hay pantalla seleccionada');
          return;
        }
        
        // Obtener contenido según la vista actual
        let contenido = '';
        if (vistaActual === 'visual' && editorQuill) {
          const visualContent = editorQuill.root.innerHTML;
          // Si el contenido original tenía estructura HTML completa, mantenerla
          if (contenidoOriginal.includes('<!DOCTYPE') || contenidoOriginal.includes('<html')) {
            // Reemplazar solo el contenido del body
            contenido = contenidoOriginal.replace(
              /<body[^>]*>[\s\S]*<\/body>/i,
              '<body>' + visualContent + '</body>'
            );
          } else {
            contenido = visualContent;
          }
        } else {
          contenido = document.getElementById('editor-codigo').value;
        }
        
        if (!contenido) {
          alert('No hay contenido para previsualizar');
          return;
        }
        
        const iframe = document.getElementById('iframe-preview');
        const modal = document.getElementById('modal-preview');
        
        // Validar HTML básico antes de mostrar preview
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(contenido, 'text/html');
          const errors = doc.querySelectorAll('parsererror');
          
          if (errors.length > 0) {
            const errorMsg = Array.from(errors).map(e => e.textContent).join('\n');
            if (!confirm('⚠️ Advertencia: El HTML tiene errores.\n\n' + errorMsg + '\n\n¿Deseas continuar con el preview de todos modos?')) {
              return;
            }
          }
        } catch (e) {
          // Continuar con el preview aunque haya error de validación
        }
        
        // Escribir contenido en iframe
        iframe.srcdoc = contenido;
        modal.classList.remove('hidden');
      };

      window.cerrarPreview = function() {
        document.getElementById('modal-preview').classList.add('hidden');
      };

      window.recargarLista = async function() {
        try {
          const response = await fetch('/admin/editor-pantallas/api/listar');
          const data = await response.json();
          
          if (data.success) {
            const lista = document.getElementById('lista-pantallas');
            lista.innerHTML = data.pantallas.map(p => {
              return '<div ' +
                'class="pantalla-item p-3 mb-2 bg-slate-900 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors" ' +
                'data-ruta="' + p.ruta.replace(/"/g, '&quot;') + '" ' +
                'data-nombre="' + p.nombre.replace(/"/g, '&quot;') + '" ' +
                'onclick="cargarPantallaDesdeElemento(this)">' +
                '<div class="flex justify-between items-start">' +
                  '<div class="flex-1">' +
                    '<div class="text-white font-medium">' + p.nombre + '</div>' +
                    '<div class="text-xs text-slate-400 mt-1">' + p.ruta + '</div>' +
                    '<div class="text-xs text-slate-500 mt-1">' +
                      (p.tamaño / 1024).toFixed(2) + ' KB • ' +
                      new Date(p.modificado).toLocaleDateString('es-ES') +
                    '</div>' +
                  '</div>' +
                  '<div class="text-slate-500 text-xs">📄</div>' +
                '</div>' +
              '</div>';
            }).join('');
          }
        } catch (error) {
          console.error('Error recargando lista:', error);
        }
      };

      // Cerrar modal con ESC
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          cerrarPreview();
        }
      });
    </script>
  `;

  const html = replace(baseTemplate, {
    TITLE: 'Editor de Pantallas HTML',
    CONTENT: content
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

