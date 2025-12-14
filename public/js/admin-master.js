// public/js/admin-master.js
// Script para manejar tabs en Modo Master y renderizar datos

/**
 * Abrir una pestaña específica
 */
function openTab(tabId) {
  // Ocultar todos los contenidos de pestañas
  document.querySelectorAll('.tab-content').forEach(div => {
    div.style.display = 'none';
  });
  
  // Remover clase activa de todos los botones
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('bg-indigo-600', 'text-white');
    btn.classList.add('bg-slate-700', 'text-slate-300');
  });
  
  // Mostrar la pestaña seleccionada
  const tabContent = document.getElementById(tabId);
  if (tabContent) {
    tabContent.style.display = 'block';
  }
  
  // Activar el botón correspondiente
  const button = document.querySelector(`[data-tab="${tabId}"]`);
  if (button) {
    button.classList.remove('bg-slate-700', 'text-slate-300');
    button.classList.add('bg-indigo-600', 'text-white');
  }
  
  // Cargar datos si es necesario (lazy loading)
  if (tabContent && tabContent.dataset.loaded !== 'true') {
    loadTabData(tabId);
  }
}

/**
 * Sistema de Modal Flotante para formularios
 * Reemplaza los prompt() incómodos con modales modernos y amigables
 */

// Función para crear y mostrar un modal de formulario
function mostrarModalFormulario(opciones) {
  return new Promise((resolve, reject) => {
    // Crear overlay (fondo oscuro)
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay-form';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    `;
    
    // Crear modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      animation: slideUp 0.3s ease;
      position: relative;
    `;
    
    // Título
    const titulo = document.createElement('h3');
    titulo.textContent = opciones.titulo || 'Formulario';
    titulo.style.cssText = `
      font-size: 1.5rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    `;
    
    // Descripción/ayuda (opcional)
    let descripcionHelp = null;
    if (opciones.ayuda) {
      descripcionHelp = document.createElement('p');
      descripcionHelp.textContent = opciones.ayuda;
      descripcionHelp.style.cssText = `
        font-size: 0.875rem;
        color: #6b7280;
        margin-bottom: 20px;
        line-height: 1.5;
      `;
    }
    
    // Formulario
    const form = document.createElement('form');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';
    
    // Campo nombre
    const labelNombre = document.createElement('label');
    labelNombre.textContent = opciones.labelNombre || 'Nombre:';
    labelNombre.style.cssText = `
      font-weight: 500;
      color: #374151;
      font-size: 0.875rem;
    `;
    
    const inputNombre = document.createElement('input');
    inputNombre.type = 'text';
    inputNombre.value = opciones.valorNombre || '';
    inputNombre.placeholder = opciones.placeholderNombre || 'Ingresa el nombre...';
    inputNombre.required = opciones.nombreRequerido !== false;
    inputNombre.style.cssText = `
      padding: 10px 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
      outline: none;
    `;
    inputNombre.addEventListener('focus', () => {
      inputNombre.style.borderColor = '#6366f1';
    });
    inputNombre.addEventListener('blur', () => {
      inputNombre.style.borderColor = '#e5e7eb';
    });
    
    // Campo descripción
    const labelDescripcion = document.createElement('label');
    labelDescripcion.textContent = opciones.labelDescripcion || 'Descripción:';
    labelDescripcion.style.cssText = `
      font-weight: 500;
      color: #374151;
      font-size: 0.875rem;
    `;
    
    const textareaDescripcion = document.createElement('textarea');
    textareaDescripcion.value = opciones.valorDescripcion || '';
    textareaDescripcion.placeholder = opciones.placeholderDescripcion || 'Ingresa la descripción...';
    textareaDescripcion.rows = opciones.filasDescripcion || 4;
    textareaDescripcion.required = opciones.descripcionRequerida === true;
    textareaDescripcion.style.cssText = `
      padding: 10px 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.2s;
      outline: none;
    `;
    textareaDescripcion.addEventListener('focus', () => {
      textareaDescripcion.style.borderColor = '#6366f1';
    });
    textareaDescripcion.addEventListener('blur', () => {
      textareaDescripcion.style.borderColor = '#e5e7eb';
    });
    
    // Botones
    const botonesContainer = document.createElement('div');
    botonesContainer.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 8px;
    `;
    
    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.style.cssText = `
      padding: 10px 20px;
      background: #f3f4f6;
      color: #374151;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    `;
    btnCancelar.addEventListener('mouseenter', () => {
      btnCancelar.style.background = '#e5e7eb';
    });
    btnCancelar.addEventListener('mouseleave', () => {
      btnCancelar.style.background = '#f3f4f6';
    });
    
    const btnAceptar = document.createElement('button');
    btnAceptar.type = 'submit';
    btnAceptar.textContent = opciones.textoBotonAceptar || 'Aceptar';
    btnAceptar.style.cssText = `
      padding: 10px 20px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    `;
    btnAceptar.addEventListener('mouseenter', () => {
      btnAceptar.style.background = '#4f46e5';
    });
    btnAceptar.addEventListener('mouseleave', () => {
      btnAceptar.style.background = '#6366f1';
    });
    
    // Ensamblar formulario
    form.appendChild(labelNombre);
    form.appendChild(inputNombre);
    form.appendChild(labelDescripcion);
    form.appendChild(textareaDescripcion);
    botonesContainer.appendChild(btnCancelar);
    botonesContainer.appendChild(btnAceptar);
    form.appendChild(botonesContainer);
    
    // Ensamblar modal
    modal.appendChild(titulo);
    if (descripcionHelp) modal.appendChild(descripcionHelp);
    modal.appendChild(form);
    overlay.appendChild(modal);
    
    // Agregar estilos de animación
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes slideUp {
        from { 
          opacity: 0;
          transform: translateY(20px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes slideDown {
        from { 
          opacity: 1;
          transform: translateY(0);
        }
        to { 
          opacity: 0;
          transform: translateY(20px);
        }
      }
    `;
    document.head.appendChild(style);
    
    // Agregar al DOM
    document.body.appendChild(overlay);
    
    // Enfocar el primer campo
    setTimeout(() => inputNombre.focus(), 100);
    
    // Manejar submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = inputNombre.value.trim();
      const descripcion = textareaDescripcion.value.trim();
      
      if (opciones.nombreRequerido !== false && !nombre) {
        inputNombre.focus();
        inputNombre.style.borderColor = '#ef4444';
        setTimeout(() => {
          inputNombre.style.borderColor = '#e5e7eb';
        }, 2000);
        return;
      }
      
      if (opciones.descripcionRequerida === true && !descripcion) {
        textareaDescripcion.focus();
        textareaDescripcion.style.borderColor = '#ef4444';
        setTimeout(() => {
          textareaDescripcion.style.borderColor = '#e5e7eb';
        }, 2000);
        return;
      }
      
      // Cerrar modal
      overlay.style.animation = 'fadeOut 0.2s ease';
      modal.style.animation = 'slideDown 0.2s ease';
      setTimeout(() => {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
      }, 200);
      
      resolve({ nombre, descripcion });
    });
    
    // Manejar cancelar
    const cancelar = () => {
      overlay.style.animation = 'fadeOut 0.2s ease';
      modal.style.animation = 'slideDown 0.2s ease';
      setTimeout(() => {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
      }, 200);
      reject(new Error('Cancelado por el usuario'));
    };
    
    btnCancelar.addEventListener('click', cancelar);
    
    // Cerrar al hacer clic fuera del modal
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cancelar();
      }
    });
    
    // Cerrar con ESC
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        cancelar();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

/**
 * Cargar datos de una pestaña (lazy loading)
 */
async function loadTabData(tabId) {
  console.log('🔄 loadTabData llamado para:', tabId);
  const tabContent = document.getElementById(tabId);
  if (!tabContent) {
    console.error('❌ Tab no encontrado:', tabId);
    return;
  }
  
  if (tabContent.dataset.loaded === 'true') {
    console.log('⚠️ Tab ya está cargado, saltando...');
    return;
  }
  
  const alumnoId = tabContent.dataset.alumnoId;
  if (!alumnoId) {
    console.error('❌ No se encontró alumnoId en el dataset del tab');
    return;
  }
  
  console.log('📡 Cargando datos para alumno:', alumnoId);
  
  try {
    // Marcar como cargando
    tabContent.innerHTML = '<div class="text-center py-8"><div class="text-slate-400 animate-pulse">Cargando...</div></div>';
    
    // Obtener datos del endpoint
    console.log('🌐 Haciendo fetch a:', `/admin/master/${alumnoId}/data`);
    const response = await fetch(`/admin/master/${alumnoId}/data`);
    console.log('📥 Respuesta recibida, status:', response.status, response.statusText);
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('El alumno no tiene suscripción activa');
      }
      const errorText = await response.text();
      console.error('❌ Error en respuesta:', errorText);
      throw new Error('Error al cargar datos: ' + response.status);
    }
    
    const data = await response.json();
    
    console.log('📊 Datos recibidos para', tabId, ':', data);
    
    // Renderizar según la pestaña
    switch(tabId) {
      case 'tab-info':
        console.log('🎨 Llamando a renderInfoGeneral...');
        renderInfoGeneral(data);
        break;
      case 'tab-transmutaciones':
        renderTransmutaciones(data);
        break;
      case 'tab-energetico':
        renderProgresoEnergetico(data);
        break;
      case 'tab-gamificado':
        renderProgresoGamificado(data);
        break;
      case 'tab-practicas':
        renderPracticasReflexiones(data);
        break;
      case 'tab-creacion':
        renderCreacion(data);
        break;
      case 'tab-cooperacion':
        renderCooperacion(data);
        break;
      case 'tab-emocional':
        renderAreaEmocional(data);
        break;
      case 'tab-notas':
        renderNotas(data);
        break;
    }
    
    tabContent.dataset.loaded = 'true';
  } catch (error) {
    console.error('Error cargando datos:', error);
    tabContent.innerHTML = `
      <div class="text-center py-8">
        <div class="text-red-400 mb-2">❌ Error: ${error.message}</div>
        <button onclick="loadTabData('${tabId}')" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          Reintentar
        </button>
      </div>
    `;
  }
}

/**
 * Renderizar Información General
 */
function renderInfoGeneral(data) {
  const tab = document.getElementById('tab-info');
  if (!tab) {
    console.error('No se encontró el tab tab-info');
    return;
  }
  
  console.log('Renderizando Información General con datos:', data);
  
  const alumno = data.alumno || {};
  const cartaAstral = data.carta_astral || null;
  const disenohumano = data.disenohumano || null;
  const ajustes = data.ajustes || {};
  
  // Formatear fecha de nacimiento
  const fechaNacimiento = alumno.fecha_nacimiento 
    ? new Date(alumno.fecha_nacimiento).toLocaleDateString('es-ES')
    : 'No registrada';
  
  let html = `
    <div class="space-y-6">
      <h3 class="text-2xl font-bold text-white mb-4">📋 Información General</h3>
      
      <!-- Datos Básicos -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">👤 Datos Básicos</h4>
        <div class="grid grid-cols-2 gap-4 text-slate-300">
          <div><strong>ID:</strong> ${alumno.id || 'N/A'}</div>
          <div><strong>Email:</strong> ${alumno.email || 'N/A'}</div>
          <div><strong>Nombre Completo:</strong> ${alumno.nombre_completo || 'N/A'}</div>
          <div><strong>Apodo:</strong> ${alumno.apodo || 'N/A'}</div>
          <div><strong>Nivel:</strong> ${alumno.nivel || 1}</div>
          <div><strong>Fase:</strong> ${alumno.fase || 'N/A'}</div>
          <div><strong>Racha:</strong> ${alumno.racha || 0} días</div>
          <div><strong>Fecha Nacimiento:</strong> ${fechaNacimiento}</div>
          <div><strong>Lugar Nacimiento:</strong> ${alumno.lugar_nacimiento || 'No registrado'}</div>
        </div>
      </div>
      
      <!-- Datos de Nacimiento -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">🎂 Datos de Nacimiento</h4>
        <form id="form-datos-nacimiento" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">
                <strong>Fecha de Nacimiento:</strong>
              </label>
              <input type="date" 
                     id="fecha-nacimiento" 
                     name="fecha_nacimiento"
                     value="${alumno.fecha_nacimiento ? new Date(alumno.fecha_nacimiento).toISOString().split('T')[0] : ''}"
                     class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">
                <strong>Hora de Nacimiento:</strong>
              </label>
              <input type="time" 
                     id="hora-nacimiento" 
                     name="hora_nacimiento"
                     value="${alumno.hora_nacimiento || ''}"
                     class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">
                <strong>Lugar de Nacimiento:</strong>
              </label>
              <input type="text" 
                     id="lugar-nacimiento" 
                     name="lugar_nacimiento"
                     value="${alumno.lugar_nacimiento || ''}"
                     placeholder="Ciudad, País"
                     class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" 
                    onclick="cancelarEdicionNacimiento()"
                    class="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" 
                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
              💾 Guardar Cambios
            </button>
          </div>
        </form>
        ${!alumno.fecha_nacimiento ? `
          <div class="mt-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded text-yellow-300 text-sm">
            ⚠️ Los datos de nacimiento no están completos. Puedes completarlos manualmente arriba.
          </div>
        ` : ''}
      </div>
      
      <!-- Carta Astral y Diseño Humano lado a lado -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <!-- Carta Astral -->
        <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">🔮 Carta Astral</h4>
        ${cartaAstral && cartaAstral.imagen_url ? `
          <div class="space-y-4 mb-4 imagen-container">
            <div class="mb-4 relative">
              <img src="${window.location.origin}${cartaAstral.imagen_url}" 
                   alt="Carta Astral" 
                   class="w-auto max-h-[337px] h-auto rounded-lg border border-slate-600 shadow-lg mx-auto"
                   loading="lazy"
                   onerror="console.error('Error cargando imagen:', this.src); setTimeout(() => { this.src = this.src.split('?')[0] + '?t=' + Date.now(); }, 500);"
                   onload="console.log('✅ Imagen cargada:', this.src); this.style.display='block';">
              <button type="button" 
                      onclick="const container = this.closest('.bg-slate-700').querySelector('.dropzone-carta-container'); if(container) { container.style.display = 'block'; this.closest('.imagen-container').style.display = 'none'; }"
                      class="mt-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                🔄 Cambiar Imagen
              </button>
            </div>
            ${cartaAstral.notas ? `
              <div class="text-slate-300">
                <strong>Notas:</strong>
                <p class="text-slate-400 mt-1">${cartaAstral.notas}</p>
              </div>
            ` : ''}
            <div class="text-xs text-slate-500">
              Subida: ${cartaAstral.fecha_subida 
                ? new Date(cartaAstral.fecha_subida).toLocaleDateString('es-ES')
                : 'N/A'}
            </div>
          </div>
        ` : '<p class="text-slate-400 mb-4">No hay datos de carta astral registrados.</p>'}
        
        <!-- Zona de Drag & Drop para Carta Astral -->
        <div class="mt-4 dropzone-carta-container" ${cartaAstral && cartaAstral.imagen_url ? 'style="display: none;"' : ''}>
          <div id="dropzone-carta-astral" 
               class="border-2 border-dashed border-slate-500 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors bg-slate-800/50"
               ondrop="handleDrop(event, 'carta-astral')" 
               ondragover="handleDragOver(event)" 
               ondragleave="handleDragLeave(event)">
            <input type="file" 
                   id="file-input-carta-astral" 
                   accept="image/*" 
                   style="display: none;"
                   onchange="handleFileSelect(event, 'carta-astral')">
            <div class="text-slate-400">
              <div class="text-5xl mb-3">🖼️</div>
              <div class="text-base font-medium mb-2">Arrastra una imagen aquí</div>
              <div class="text-sm text-slate-500 mb-4">o</div>
              <button type="button" 
                      onclick="event.stopPropagation(); document.getElementById('file-input-carta-astral').click()"
                      class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors shadow-lg">
                📁 Seleccionar Imagen
              </button>
              <div class="text-xs text-slate-500 mt-4">Formatos: JPG, PNG, GIF (máx. 5MB)</div>
            </div>
          </div>
        </div>
        </div>
        
        <!-- Diseño Humano -->
        <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">✨ Diseño Humano</h4>
        ${disenohumano && disenohumano.imagen_url ? `
          <div class="space-y-4 mb-4 imagen-container">
            <div class="mb-4 relative">
              <img src="${window.location.origin}${disenohumano.imagen_url}" 
                   alt="Diseño Humano" 
                   class="w-full max-w-[450px] h-auto rounded-lg border border-slate-600 shadow-lg mx-auto"
                   loading="lazy"
                   onerror="console.error('Error cargando imagen:', this.src); setTimeout(() => { this.src = this.src.split('?')[0] + '?t=' + Date.now(); }, 500);"
                   onload="console.log('✅ Imagen cargada:', this.src); this.style.display='block';">
              <button type="button" 
                      onclick="const container = this.closest('.bg-slate-700').querySelector('.dropzone-diseno-container'); if(container) { container.style.display = 'block'; this.closest('.imagen-container').style.display = 'none'; }"
                      class="mt-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                🔄 Cambiar Imagen
              </button>
            </div>
            <div class="text-slate-300 space-y-2">
              ${disenohumano.tipo ? `
                <div><strong>Tipo:</strong> ${disenohumano.tipo}</div>
              ` : ''}
              ${disenohumano.notas && typeof disenohumano.notas === 'string' && disenohumano.notas.trim() ? `
                <div>
                  <strong>Notas:</strong>
                  <p class="text-slate-400 mt-1">${disenohumano.notas}</p>
                </div>
              ` : ''}
              <div class="text-xs text-slate-500">
                Subida: ${disenohumano.fecha_subida 
                  ? new Date(disenohumano.fecha_subida).toLocaleDateString('es-ES')
                  : 'N/A'}
              </div>
            </div>
          </div>
        ` : '<p class="text-slate-400 mb-4">No hay datos de diseño humano registrados.</p>'}
        
        <!-- Zona de Drag & Drop para Diseño Humano -->
        <div class="mt-4 dropzone-diseno-container" ${disenohumano && disenohumano.imagen_url ? 'style="display: none;"' : ''}>
          <div id="dropzone-diseno-humano" 
               class="border-2 border-dashed border-slate-500 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors bg-slate-800/50"
               ondrop="handleDrop(event, 'diseno-humano')" 
               ondragover="handleDragOver(event)" 
               ondragleave="handleDragLeave(event)">
            <input type="file" 
                   id="file-input-diseno-humano" 
                   accept="image/*" 
                   style="display: none;"
                   onchange="handleFileSelect(event, 'diseno-humano')">
            <div class="text-slate-400">
              <div class="text-5xl mb-3">🖼️</div>
              <div class="text-base font-medium mb-2">Arrastra una imagen aquí</div>
              <div class="text-sm text-slate-500 mb-4">o</div>
              <button type="button" 
                      onclick="event.stopPropagation(); document.getElementById('file-input-diseno-humano').click()"
                      class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors shadow-lg">
                📁 Seleccionar Imagen
              </button>
              <div class="text-xs text-slate-500 mt-4">Formatos: JPG, PNG, GIF (máx. 5MB)</div>
            </div>
          </div>
        </div>
        </div>
      </div>
      
      <!-- Ajustes del Alumno (Solo Lectura) -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">⚙️ Ajustes del Alumno</h4>
        ${Object.keys(ajustes).length > 0 ? `
          <div class="text-slate-300">
            <pre class="text-xs bg-slate-800 p-3 rounded overflow-x-auto">${JSON.stringify(ajustes, null, 2)}</pre>
            <p class="text-xs text-slate-500 mt-2">⚠️ Solo lectura - Los ajustes no se pueden editar desde aquí.</p>
          </div>
        ` : `
          <p class="text-slate-400">No hay ajustes configurados.</p>
        `}
      </div>
    </div>
  `;
  
  console.log('📝 Insertando HTML en tab-info, longitud:', html.length);
  tab.innerHTML = html;
  tab.dataset.loaded = 'true';
  
  // Configurar el formulario de datos de nacimiento
  const formNacimiento = document.getElementById('form-datos-nacimiento');
  if (formNacimiento) {
    formNacimiento.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarDatosNacimiento(alumno.id);
    });
    
    // Guardar valores originales para cancelar
    const fechaOriginal = document.getElementById('fecha-nacimiento')?.value || '';
    const horaOriginal = document.getElementById('hora-nacimiento')?.value || '';
    const lugarOriginal = document.getElementById('lugar-nacimiento')?.value || '';
    formNacimiento.dataset.originalValues = JSON.stringify({
      fecha: fechaOriginal,
      hora: horaOriginal,
      lugar: lugarOriginal
    });
  }
  
  // Verificar que los elementos se crearon
  setTimeout(() => {
    const dropzoneCarta = document.getElementById('dropzone-carta-astral');
    const dropzoneDiseno = document.getElementById('dropzone-diseno-humano');
    const fileInputCarta = document.getElementById('file-input-carta-astral');
    const fileInputDiseno = document.getElementById('file-input-diseno-humano');
    
    console.log('✅ Información General renderizada. Dropzones:', {
      cartaAstral: !!dropzoneCarta,
      disenoHumano: !!dropzoneDiseno,
      fileInputCarta: !!fileInputCarta,
      fileInputDiseno: !!fileInputDiseno,
      dropzoneCartaVisible: dropzoneCarta ? window.getComputedStyle(dropzoneCarta).display !== 'none' : false,
      dropzoneDisenoVisible: dropzoneDiseno ? window.getComputedStyle(dropzoneDiseno).display !== 'none' : false
    });
    
    // Ocultar dropzones si hay imágenes cargadas
    if (data.carta_astral && data.carta_astral.imagen_url) {
      const dropzoneContainerCarta = document.querySelector('.dropzone-carta-container');
      if (dropzoneContainerCarta) {
        dropzoneContainerCarta.style.display = 'none';
      }
    }
    
    if (data.disenohumano && data.disenohumano.imagen_url) {
      const dropzoneContainerDiseno = document.querySelector('.dropzone-diseno-container');
      if (dropzoneContainerDiseno) {
        dropzoneContainerDiseno.style.display = 'none';
      }
    }
    
    if (!dropzoneCarta || !dropzoneDiseno) {
      console.error('❌ ERROR: Las zonas de drag & drop no se crearon correctamente');
      console.log('HTML insertado (primeros 500 caracteres):', html.substring(0, 500));
    }
  }, 100);
}

/**
 * Función para cambiar de subtab en la pestaña de transmutaciones
 * Debe estar definida globalmente para que esté disponible cuando se hace clic en los botones
 */
function mostrarSubtab(subtab) {
  // Ocultar todos los contenidos
  document.querySelectorAll('.subtab-content').forEach(el => el.style.display = 'none');
  // Desactivar todos los botones
  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.classList.add('text-slate-300');
    btn.classList.remove('text-white', 'bg-indigo-600');
  });
  
  // Mostrar el contenido seleccionado
  const content = document.getElementById('subtab-content-' + subtab);
  if (content) {
    content.style.display = 'block';
  }
  
  // Activar el botón seleccionado
  const btn = document.getElementById('subtab-btn-' + subtab);
  if (btn) {
    btn.classList.add('active', 'text-white', 'bg-indigo-600');
    btn.classList.remove('text-slate-300');
  }
}

// Hacer disponible globalmente
window.mostrarSubtab = mostrarSubtab;

/**
 * Renderizar Limpieza Energética
 */
/**
 * Renderizar Transmutaciones PDE
 */
function renderTransmutaciones(data) {
  const tab = document.getElementById('tab-transmutaciones');
  if (!tab) return;
  
  // Establecer currentAlumnoId para que esté disponible en las funciones
  window.currentAlumnoId = tab.dataset.alumnoId || window.currentAlumnoId;
  
  const lugares = data.alumnos_lugares || [];
  const proyectos = data.alumnos_proyectos || [];
  const transmutacionesApadrinados = data.transmutaciones_apadrinados || [];
  
  // Función helper para escapar HTML
  function escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
  
  // Función helper para escapar JS
  function escapeJs(text) {
    if (!text) return '';
    return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
  
  const html = `
    <div class="space-y-6">
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-white mb-3">🌟 Transmutación energética de la PDE</h2>
        <p class="text-slate-300 text-lg leading-relaxed max-w-4xl">
          Aquí puedes gestionar los lugares, proyectos y apadrinados que este alumno necesita limpiar/iluminar. 
          Como master, puedes activar múltiples lugares y proyectos sin límite.
        </p>
      </div>
      
      <!-- Subtabs -->
      <div class="flex gap-2 mb-6 border-b border-slate-700">
        <button onclick="mostrarSubtab('apadrinados')" id="subtab-btn-apadrinados" 
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-t-lg hover:bg-indigo-700 subtab-btn active">
          👥 Apadrinados
        </button>
        <button onclick="mostrarSubtab('lugares')" id="subtab-btn-lugares" 
                class="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-t-lg subtab-btn">
          🏠 Lugares Activados
        </button>
        <button onclick="mostrarSubtab('proyectos')" id="subtab-btn-proyectos" 
                class="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-t-lg subtab-btn">
          🚀 Proyectos Activados
        </button>
      </div>
      
      <!-- Contenido de Apadrinados -->
      <div id="subtab-content-apadrinados" class="subtab-content">
        <div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-white flex items-center gap-2">
              👥 Apadrinados
            </h3>
            <button onclick="agregarApadrinadoMaster()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
              + Añadir Apadrinado
            </button>
          </div>
          <div id="apadrinados-list" class="space-y-2">
            ${transmutacionesApadrinados.length > 0 ? transmutacionesApadrinados.map(a => {
              const estadoCalculado = a.ultima_limpieza && a.dias_desde_limpieza !== null
                ? a.dias_desde_limpieza <= (a.frecuencia_dias || 30) ? 'limpio'
                  : a.dias_desde_limpieza <= 15 ? 'pendiente'
                  : 'olvidado'
                : 'pendiente';
              const estadoColor = estadoCalculado === 'limpio' ? 'text-green-400'
                : estadoCalculado === 'pendiente' ? 'text-yellow-400'
                : 'text-red-400';
              const estadoIcon = estadoCalculado === 'limpio' ? '✅'
                : estadoCalculado === 'pendiente' ? '⏳'
                : '❌';
              
              return `
                <div class="bg-slate-700 rounded p-3 flex justify-between items-center">
                  <div class="flex-1">
                    <div class="font-semibold text-white">${escapeHtml(a.nombre || 'Sin nombre')}</div>
                    ${a.descripcion ? `<div class="text-sm text-slate-300 mt-1">${escapeHtml(a.descripcion)}</div>` : ''}
                    ${a.ultima_limpieza ? `
                      <div class="text-xs ${estadoColor} mt-1">
                        ${estadoIcon} Última limpieza: ${new Date(a.ultima_limpieza).toLocaleDateString('es-ES')} (${a.dias_desde_limpieza} días)
                      </div>
                    ` : '<div class="text-xs text-yellow-300 mt-1">⏳ Nunca limpiado</div>'}
                  </div>
                  <div class="flex items-center gap-2 ml-4">
                    <button onclick="marcarTransmutacionLimpio('apadrinados', ${a.id}, '${escapeJs(a.nombre || '')}')" 
                            class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                      ✅ Limpiar
                    </button>
                    <button onclick="eliminarApadrinadoMaster(${a.id}, '${escapeJs(a.nombre || '')}')" 
                            class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white">
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              `;
            }).join('') : '<p class="text-slate-400 text-sm">No hay apadrinados registrados. Añade uno para comenzar.</p>'}
          </div>
        </div>
      </div>
      
      <!-- Contenido de Lugares Activados -->
      <div id="subtab-content-lugares" class="subtab-content" style="display: none;">
        <div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-white flex items-center gap-2">
              🏠 Lugares Activados
            </h3>
            <button onclick="crearLugarMaster()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
              + Crear Lugar
            </button>
          </div>
          <div class="mb-4 p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
            <p class="text-sm text-blue-200">
              <strong>ℹ️ Información:</strong> Los lugares deben estar <strong>activados</strong> para aparecer en la tabla de "Lugares Activados" y poder recibir limpiezas energéticas.
            </p>
          </div>
          <div id="lugares-list" class="space-y-2">
            ${lugares.length > 0 ? lugares.map(l => {
              const nombreEscapado = escapeJs(l.nombre || '');
              const descripcionEscapada = escapeJs(l.descripcion || '');
              return `
                <div class="bg-slate-700 rounded p-3 flex justify-between items-center ${l.activo ? 'border-2 border-green-500' : 'border-2 border-amber-500'}">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <div class="font-semibold text-white">${escapeHtml(l.nombre || 'Sin nombre')}</div>
                      ${l.activo 
                        ? '<span class="px-2 py-1 bg-green-600 text-white text-xs rounded font-bold">✓ Activo - Aparece en Lugares Activados</span>' 
                        : '<span class="px-2 py-1 bg-amber-600 text-white text-xs rounded font-bold">⚠️ No activado - Actívalo para que aparezca</span>'}
                    </div>
                    ${l.descripcion ? `<div class="text-sm text-slate-300 mt-1">${escapeHtml(l.descripcion)}</div>` : ''}
                    <div class="text-xs text-slate-400 mt-1">
                      Creado: ${l.created_at ? new Date(l.created_at).toLocaleDateString('es-ES') : 'N/A'}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 ml-4">
                    ${!l.activo ? `
                      <button onclick="activarLugarMaster(${l.id})" 
                              class="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded text-sm text-white font-bold shadow-lg hover:shadow-xl transition-all">
                        ⭐ Activar
                      </button>
                    ` : `
                      <button onclick="desactivarLugarMaster(${l.id})" 
                              class="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs text-white">
                        Desactivar
                      </button>
                    `}
                    <button onclick="editarLugarMaster(${l.id}, '${nombreEscapado}', '${descripcionEscapada}')" 
                            class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white">
                      ✏️ Editar
                    </button>
                    <button onclick="eliminarLugarMaster(${l.id}, '${nombreEscapado}')" 
                            class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white">
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              `;
            }).join('') : '<p class="text-slate-400 text-sm">No hay lugares registrados. Crea uno para comenzar.</p>'}
          </div>
        </div>
      </div>
      
      <!-- Contenido de Proyectos Activados -->
      <div id="subtab-content-proyectos" class="subtab-content" style="display: none;">
        <div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-white flex items-center gap-2">
              🚀 Proyectos Activados
            </h3>
            <button onclick="crearProyectoMaster()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">
              + Crear Proyecto
            </button>
          </div>
          <div id="proyectos-list" class="space-y-2">
            ${proyectos.length > 0 ? proyectos.map(p => {
              const nombreEscapado = escapeJs(p.nombre || '');
              const descripcionEscapada = escapeJs(p.descripcion || '');
              return `
                <div class="bg-slate-700 rounded p-3 flex justify-between items-center ${p.activo ? 'border-2 border-green-500' : ''}">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <div class="font-semibold text-white">${escapeHtml(p.nombre || 'Sin nombre')}</div>
                      ${p.activo ? '<span class="px-2 py-1 bg-green-600 text-white text-xs rounded">✓ Activo</span>' : ''}
                    </div>
                    ${p.descripcion ? `<div class="text-sm text-slate-300 mt-1">${escapeHtml(p.descripcion)}</div>` : ''}
                    <div class="text-xs text-slate-400 mt-1">
                      Creado: ${p.created_at ? new Date(p.created_at).toLocaleDateString('es-ES') : 'N/A'}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 ml-4">
                    ${!p.activo ? `
                      <button onclick="activarProyectoMaster(${p.id})" 
                              class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white">
                        Activar
                      </button>
                    ` : `
                      <button onclick="desactivarProyectoMaster(${p.id})" 
                              class="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs text-white">
                        Desactivar
                      </button>
                    `}
                    <button onclick="editarProyectoMaster(${p.id}, '${nombreEscapado}', '${descripcionEscapada}')" 
                            class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white">
                      ✏️ Editar
                    </button>
                    <button onclick="eliminarProyectoMaster(${p.id}, '${nombreEscapado}')" 
                            class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white">
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              `;
            }).join('') : '<p class="text-slate-400 text-sm">No hay proyectos registrados. Crea uno para comenzar.</p>'}
          </div>
        </div>
      </div>
      
    </div>
    
    <style>
      .subtab-btn.active {
        background-color: #4f46e5 !important;
        color: white !important;
      }
      .subtab-content {
        animation: fadeIn 0.2s;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    </style>
  `;
  
  tab.innerHTML = html;
  
  // Asegurar que currentAlumnoId esté establecido
  window.currentAlumnoId = tab.dataset.alumnoId || window.currentAlumnoId;
  
  // Asegurar que mostrarSubtab esté disponible (por si acaso)
  window.mostrarSubtab = mostrarSubtab;
  
  // Hacer disponible la función globalmente
  window.marcarTransmutacionLimpio = marcarTransmutacionLimpio;
  window.agregarTransmutacion = agregarTransmutacion;
  window.editarTransmutacion = editarTransmutacion;
}

// Función para agregar nueva transmutación
async function agregarTransmutacion(tipo) {
  // Obtener alumnoId del tab actual (más confiable que window.currentAlumnoId)
  const tab = document.getElementById('tab-transmutaciones') || 
              document.getElementById('tab-info') || 
              document.getElementById('tab-energetico') ||
              document.querySelector('.tab-content[data-alumno-id]');
  
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    console.error('Error: No se pudo obtener el ID del alumno. Tab:', tab);
    alert('Error: No se pudo obtener el ID del alumno. Por favor, recarga la página.');
    return;
  }
  
  // Actualizar window.currentAlumnoId para futuras llamadas
  window.currentAlumnoId = alumnoId;
  
  // Validar que el tipo sea válido (lugares, proyectos o apadrinados)
  if (tipo !== 'lugares' && tipo !== 'proyectos' && tipo !== 'apadrinados') {
    alert('Tipo de transmutación no válido. Solo se pueden crear lugares, proyectos o apadrinados desde aquí.');
    return;
  }
  
  const tipoNombre = tipo === 'lugares' ? 'lugar' : tipo === 'proyectos' ? 'proyecto' : 'apadrinado';
  
  // Usar modal flotante en lugar de prompt
  let nombre, descripcion;
  try {
    const resultado = await mostrarModalFormulario({
      titulo: `Crear ${tipoNombre.charAt(0).toUpperCase() + tipoNombre.slice(1)}`,
      labelNombre: `Nombre del ${tipoNombre}:`,
      placeholderNombre: `Ingresa el nombre del ${tipoNombre}...`,
      labelDescripcion: 'Descripción (opcional):',
      placeholderDescripcion: 'Ingresa una descripción...',
      nombreRequerido: true,
      descripcionRequerida: false,
      textoBotonAceptar: 'Crear',
      filasDescripcion: 3
    });
    nombre = resultado.nombre;
    descripcion = resultado.descripcion;
  } catch (error) {
    // Usuario canceló
    return;
  }
  
  if (!nombre || nombre.trim() === '') {
    return;
  }
  
  try {
    let body = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      nivel_minimo: 1,
      prioridad: 'Normal',
      orden: 0,
      activo: true
    };
    
    // Si es apadrinado, asociarlo al padrino (alumno actual)
    if (tipo === 'apadrinados') {
      body.alumno_id = alumnoId;
      // Apadrinados no requieren frecuencia_dias
      // Usar la ruta de personas para crear apadrinados
      var endpoint = '/admin/transmutaciones/personas?action=create_rapido';
    } else {
      // Para lugares y proyectos, sí incluir frecuencia_dias
      body.frecuencia_dias = 30;
      // Para proyectos y lugares, también asignar el alumno_id si se crea desde el Modo Master
      if (tipo === 'proyectos' || tipo === 'lugares') {
        body.alumno_id = alumnoId;
      }
      // Usar la ruta del admin para crear transmutaciones (lugares y proyectos)
      var endpoint = `/admin/transmutaciones/${tipo}?action=create_rapido`;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab de transmutaciones
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        // Marcar como no cargado para forzar recarga
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
      // También recargar el tab de limpieza energética si existe (para apadrinados)
      if (tipo === 'apadrinados') {
        const tabEnergetico = document.getElementById('tab-energetico');
        if (tabEnergetico) {
          tabEnergetico.dataset.loaded = 'false';
          loadTabData('tab-energetico');
        }
      }
    } else {
      console.error('Error creando transmutación:', result.error || 'Error desconocido');
      alert('Error al crear la transmutación: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error creando transmutación:', error);
    alert('Error de red al crear la transmutación');
  }
}
window.agregarTransmutacion = agregarTransmutacion;

// Función para agregar apadrinado desde Modo Master (ahora usa agregarTransmutacion)
async function agregarApadrinadoMaster() {
  await agregarTransmutacion('apadrinados');
}
window.agregarApadrinadoMaster = agregarApadrinadoMaster;

// Función para eliminar apadrinado desde Modo Master
async function eliminarApadrinadoMaster(apadrinadoId, nombre) {
  if (!confirm(`¿Estás seguro de que quieres eliminar el apadrinado "${nombre}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/admin/transmutaciones/personas?action=delete&apadrinado_id=${apadrinadoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab de transmutaciones
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
      // También recargar limpieza energética
      const tabEnergetico = document.getElementById('tab-energetico');
      if (tabEnergetico) {
        tabEnergetico.dataset.loaded = 'false';
        loadTabData('tab-energetico');
      }
    } else {
      console.error('Error eliminando apadrinado:', result.error || 'Error desconocido');
      alert('Error al eliminar el apadrinado: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error eliminando apadrinado:', error);
    alert('Error de red al eliminar el apadrinado');
  }
}
window.eliminarApadrinadoMaster = eliminarApadrinadoMaster;

// ===== FUNCIONES PARA GESTIONAR LUGARES DESDE MASTER =====

async function crearLugarMaster() {
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  // Usar modal flotante en lugar de prompt
  let nombre, descripcion;
  try {
    const resultado = await mostrarModalFormulario({
      titulo: 'Crear Lugar',
      ayuda: 'Es importante poner la dirección completa porque eso nos permite poder consignar el lugar. Es un requerimiento indispensable para poder realizar la limpieza energética del lugar activado.',
      labelNombre: 'Nombre del lugar:',
      placeholderNombre: 'Ingresa el nombre del lugar...',
      labelDescripcion: 'Descripción (Dirección completa):',
      placeholderDescripcion: 'Ingresa la dirección completa del lugar...',
      nombreRequerido: true,
      descripcionRequerida: false,
      textoBotonAceptar: 'Crear Lugar',
      filasDescripcion: 4
    });
    nombre = resultado.nombre;
    descripcion = resultado.descripcion;
  } catch (error) {
    // Usuario canceló
    return;
  }
  
  if (!nombre || nombre.trim() === '') return;
  
  try {
    const response = await fetch('/admin/master/' + alumnoId + '/crear-lugar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        descripcion: descripcion.trim()
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al crear el lugar');
  }
}
window.crearLugarMaster = crearLugarMaster;

async function activarLugarMaster(lugarId) {
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  if (!confirm('¿Activar este lugar?\n\nUna vez activado, aparecerá en la tabla de "Lugares Activados" y podrá recibir limpiezas energéticas.\n\nComo master, puedes tener múltiples lugares activos.')) {
    return;
  }
  
  try {
    // Como master, podemos activar múltiples sin desactivar otros
    const response = await fetch('/admin/master/' + alumnoId + '/activar-lugar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lugar_id: lugarId })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      alert('✅ Lugar activado correctamente. Ahora aparecerá en la tabla de "Lugares Activados".');
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al activar el lugar: ' + error.message);
  }
}
window.activarLugarMaster = activarLugarMaster;

async function desactivarLugarMaster(lugarId) {
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  if (!confirm('¿Desactivar este lugar?\n\nYa no aparecerá en la tabla de "Lugares Activados" y no recibirá limpiezas energéticas.')) {
    return;
  }
  
  try {
    const response = await fetch('/admin/master/' + alumnoId + '/desactivar-lugar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lugar_id: lugarId })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      alert('✅ Lugar desactivado correctamente.');
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al desactivar el lugar: ' + error.message);
  }
}
window.desactivarLugarMaster = desactivarLugarMaster;

async function editarLugarMaster(lugarId, nombreActual, descripcionActual) {
  // Usar modal flotante en lugar de prompt
  let nombre, descripcion;
  try {
    const resultado = await mostrarModalFormulario({
      titulo: 'Editar Lugar',
      ayuda: 'Es importante poner la dirección completa porque eso nos permite poder consignar el lugar. Es un requerimiento indispensable para poder realizar la limpieza energética del lugar activado.',
      labelNombre: 'Nombre del lugar:',
      valorNombre: nombreActual,
      placeholderNombre: 'Ingresa el nombre del lugar...',
      labelDescripcion: 'Descripción (Dirección completa):',
      valorDescripcion: descripcionActual || '',
      placeholderDescripcion: 'Ingresa la dirección completa del lugar...',
      nombreRequerido: true,
      descripcionRequerida: false,
      textoBotonAceptar: 'Guardar Cambios',
      filasDescripcion: 4
    });
    nombre = resultado.nombre;
    descripcion = resultado.descripcion;
  } catch (error) {
    // Usuario canceló
    return;
  }
  
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  try {
    const response = await fetch('/admin/master/' + alumnoId + '/actualizar-lugar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lugar_id: lugarId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim()
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al editar el lugar');
  }
}
window.editarLugarMaster = editarLugarMaster;

async function eliminarLugarMaster(lugarId, nombre) {
  if (!confirm(`¿Estás seguro de que quieres eliminar el lugar "${nombre}"?`)) {
    return;
  }
  
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  try {
    const response = await fetch('/admin/master/' + alumnoId + '/eliminar-lugar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lugar_id: lugarId
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al eliminar el lugar');
  }
}
window.eliminarLugarMaster = eliminarLugarMaster;

// ===== FUNCIONES PARA GESTIONAR PROYECTOS DESDE MASTER =====

async function crearProyectoMaster() {
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  // Usar modal flotante en lugar de prompt
  let nombre, descripcion;
  try {
    const resultado = await mostrarModalFormulario({
      titulo: 'Crear Proyecto',
      labelNombre: 'Nombre del proyecto:',
      placeholderNombre: 'Ingresa el nombre del proyecto...',
      labelDescripcion: 'Descripción:',
      placeholderDescripcion: 'Ingresa una descripción del proyecto...',
      nombreRequerido: true,
      descripcionRequerida: false,
      textoBotonAceptar: 'Crear Proyecto',
      filasDescripcion: 3
    });
    nombre = resultado.nombre;
    descripcion = resultado.descripcion;
  } catch (error) {
    // Usuario canceló
    return;
  }
  
  if (!nombre || nombre.trim() === '') return;
  
  try {
    const response = await fetch('/admin/master/' + alumnoId + '/crear-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        descripcion: descripcion.trim()
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al crear el proyecto');
  }
}
window.crearProyectoMaster = crearProyectoMaster;

async function activarProyectoMaster(proyectoId) {
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  try {
    // Como master, podemos activar múltiples sin desactivar otros
    const response = await fetch('/admin/master/' + alumnoId + '/activar-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proyecto_id: proyectoId })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al activar el proyecto');
  }
}
window.activarProyectoMaster = activarProyectoMaster;

async function desactivarProyectoMaster(proyectoId) {
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  try {
    const response = await fetch('/admin/master/' + alumnoId + '/desactivar-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proyecto_id: proyectoId })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al desactivar el proyecto');
  }
}
window.desactivarProyectoMaster = desactivarProyectoMaster;

async function editarProyectoMaster(proyectoId, nombreActual, descripcionActual) {
  // Usar modal flotante en lugar de prompt
  let nombre, descripcion;
  try {
    const resultado = await mostrarModalFormulario({
      titulo: 'Editar Proyecto',
      labelNombre: 'Nombre del proyecto:',
      valorNombre: nombreActual,
      placeholderNombre: 'Ingresa el nombre del proyecto...',
      labelDescripcion: 'Descripción:',
      valorDescripcion: descripcionActual || '',
      placeholderDescripcion: 'Ingresa una descripción del proyecto...',
      nombreRequerido: true,
      descripcionRequerida: false,
      textoBotonAceptar: 'Guardar Cambios',
      filasDescripcion: 3
    });
    nombre = resultado.nombre;
    descripcion = resultado.descripcion;
  } catch (error) {
    // Usuario canceló
    return;
  }
  
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  try {
    const response = await fetch('/admin/master/' + alumnoId + '/actualizar-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id: proyectoId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim()
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al editar el proyecto');
  }
}
window.editarProyectoMaster = editarProyectoMaster;

async function eliminarProyectoMaster(proyectoId, nombre) {
  if (!confirm(`¿Estás seguro de que quieres eliminar el proyecto "${nombre}"?`)) {
    return;
  }
  
  const tab = document.getElementById('tab-transmutaciones');
  const alumnoId = tab?.dataset?.alumnoId || window.currentAlumnoId;
  
  if (!alumnoId) {
    alert('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  try {
    const response = await fetch('/admin/master/' + alumnoId + '/eliminar-proyecto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id: proyectoId
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Recargar el tab
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    } else {
      alert('Error: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de red al eliminar el proyecto');
  }
}
window.eliminarProyectoMaster = eliminarProyectoMaster;

// Función para editar transmutación
async function editarTransmutacion(tipo, id) {
  // Por ahora solo mostrar un mensaje, la funcionalidad completa se puede implementar después
  alert('La funcionalidad de edición se implementará próximamente. Por ahora, puedes editar desde la sección de administración correspondiente.');
}
window.editarTransmutacion = editarTransmutacion;

// Función para marcar transmutación como limpiada
async function marcarTransmutacionLimpio(tipo, id, nombre) {
  if (!window.currentAlumnoId) {
    console.error('Error: No se pudo obtener el ID del alumno');
    return;
  }
  
  // Intentar obtener el ID del alumno de múltiples fuentes
  let alumnoId = window.currentAlumnoId;
  
  // Si no está en window, intentar obtenerlo del tab
  if (!alumnoId) {
    const tab = document.getElementById('tab-energetico');
    if (tab && tab.dataset.alumnoId) {
      alumnoId = tab.dataset.alumnoId;
      window.currentAlumnoId = alumnoId;
    }
  }
  
  // Si aún no tenemos el ID, intentar obtenerlo de la URL
  if (!alumnoId) {
    const urlMatch = window.location.pathname.match(/\/admin\/master\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      alumnoId = urlMatch[1];
      window.currentAlumnoId = alumnoId;
    }
  }
  
  if (!alumnoId) {
    console.error('Error: No se pudo obtener el ID del alumno');
    alert('Error: No se pudo obtener el ID del alumno. Por favor, recarga la página.');
    return;
  }
  
  // Actualización optimista del DOM
  actualizarAspectoEnDOM(tipo, id, 'limpio');
  
  try {
    const url = `/admin/master/${alumnoId}/marcar-limpio`;
    const bodyData = {
      tipo: tipo,
      aspecto_id: id
    };
    console.log('📤 Enviando petición a:', url, bodyData);
    console.log('📍 URL completa:', window.location.origin + url);
    
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
      credentials: 'include', // IMPORTANTE: Incluir cookies para autenticación
      mode: 'same-origin' // Asegurar que funciona en el mismo origen
    };
    console.log('📋 Opciones de fetch:', fetchOptions);
    
    const response = await fetch(url, fetchOptions).catch(fetchError => {
      console.error('❌ Error en fetch (catch):', fetchError);
      throw new Error(`Error de red: ${fetchError.message || 'No se pudo conectar al servidor'}`);
    });
    
    // Verificar si la respuesta es válida
    if (!response) {
      throw new Error('No se recibió respuesta del servidor');
    }
    
    console.log('📥 Respuesta recibida:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // Verificar el tipo de contenido antes de parsear JSON
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      console.error('Respuesta no es JSON:', text);
      throw new Error(`El servidor respondió con: ${text.substring(0, 100)}`);
    }
    
    if (response.ok && result.success) {
      console.log('✅ Transmutación marcada como limpiada correctamente');
      // Recargar el tab de transmutaciones para reflejar los cambios
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones && tabTransmutaciones.dataset.alumnoId) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
      // Si es apadrinado, también recargar limpieza energética
      if (tipo === 'apadrinados') {
        const tabEnergetico = document.getElementById('tab-energetico');
        if (tabEnergetico) {
          tabEnergetico.dataset.loaded = 'false';
          loadTabData('tab-energetico');
        }
      }
      // Cerrar modal si está abierto (verificar primero que existe)
      const modal = document.getElementById('modal-lista-limpieza');
      if (modal) {
        cerrarModalLista();
      }
    } else {
      const errorMsg = result.error || 'Error desconocido';
      console.error('❌ Error marcando transmutación como limpiada:', errorMsg);
      alert(`Error al guardar: ${errorMsg}`);
      // Recargar datos si falló
      const tabTransmutaciones = document.getElementById('tab-transmutaciones');
      if (tabTransmutaciones && tabTransmutaciones.dataset.alumnoId) {
        tabTransmutaciones.dataset.loaded = 'false';
        loadTabData('tab-transmutaciones');
      }
    }
  } catch (error) {
    console.error('❌ Error en fetch marcando transmutación como limpiada:', error);
    const errorMsg = error.message || 'Error de conexión';
    alert(`Error de conexión: ${errorMsg}. Por favor, verifica tu conexión a internet e intenta de nuevo.`);
    // Recargar datos si falló
    const tabTransmutaciones = document.getElementById('tab-transmutaciones');
    if (tabTransmutaciones && tabTransmutaciones.dataset.alumnoId) {
      tabTransmutaciones.dataset.loaded = 'false';
      loadTabData('tab-transmutaciones');
    }
  }
}

/**
 * Renderizar Progreso Energético (Limpieza Energética)
 */
function renderProgresoEnergetico(data) {
  console.log('🧹 [renderProgresoEnergetico] Iniciando renderizado...');
  const tab = document.getElementById('tab-energetico');
  if (!tab) {
    console.error('❌ [renderProgresoEnergetico] Tab tab-energetico no encontrado');
    return;
  }
  
  const nivelAlumno = data.nivel_alumno || data.alumno?.nivel || 1;
  
  // Secciones de limpieza dinámicas - FILTRADAS: No mostrar secciones antiguas, solo transmutaciones energéticas
  // Las secciones antiguas como "Canales de conexión" y "Cuerpos energéticos" ya no se muestran
  const seccionesLimpieza = []; // Vacío - ya no usamos secciones antiguas
  
  // Transmutaciones Energéticas (nuevo sistema) - ESTAS SON LAS ÚNICAS QUE SE MUESTRAN
  const transmutacionesEnergeticas = data.transmutaciones_energeticas || { listas: [] };
  console.log('🔮 [renderProgresoEnergetico] Transmutaciones energéticas encontradas:', transmutacionesEnergeticas.listas?.length || 0);
  if (transmutacionesEnergeticas.listas && transmutacionesEnergeticas.listas.length > 0) {
    console.log('🔮 [renderProgresoEnergetico] Listas encontradas:', transmutacionesEnergeticas.listas.map(l => ({ id: l.id, nombre: l.nombre, tipo: l.tipo })));
  }
  
  // Función helper para renderizar sección de módulo
  const renderModulo = (titulo, icono, moduloId, aspectos) => {
    // Determinar si es un módulo de transmutaciones (apadrinados ya no está aquí, se movió a limpieza energética)
    const esTransmutacion = ['lugares', 'proyectos'].includes(moduloId);
    
    const estadosLimpios = aspectos.filter(a => a.estado_calculado === 'limpio' || a.estado === 'al_dia' || a.estado === 'limpio' || a.estado === 'completo');
    const estadosPendientes = aspectos.filter(a => a.estado_calculado === 'pendiente' || (a.estado === 'pendiente' && (!a.dias_desde_limpieza || a.dias_desde_limpieza <= 15)));
    const estadosOlvidados = aspectos.filter(a => a.estado_calculado === 'olvidado' || (a.dias_desde_limpieza && a.dias_desde_limpieza > 15) || a.estado === 'muy_pendiente');
    
    return `
      <div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-2xl">${icono}</span>
          <h4 class="text-xl font-bold text-white">${titulo}</h4>
        </div>
        
        <!-- Contadores Generales -->
        <div class="grid grid-cols-4 gap-4 mb-6">
          <button onclick="abrirModalLista('${moduloId}', 'limpios')" 
                  class="bg-green-900/30 rounded-lg p-4 text-center border border-green-700 hover:bg-green-900/50 transition-colors cursor-pointer">
            <div class="text-3xl font-bold text-green-400">${estadosLimpios.length}</div>
            <div class="text-sm text-green-300 mt-1">Limpiados</div>
          </button>
          <button onclick="abrirModalLista('${moduloId}', 'pendientes')" 
                  class="bg-yellow-900/30 rounded-lg p-4 text-center border border-yellow-700 hover:bg-yellow-900/50 transition-colors cursor-pointer">
            <div class="text-3xl font-bold text-yellow-400">${estadosPendientes.length}</div>
            <div class="text-sm text-yellow-300 mt-1">Pendientes</div>
          </button>
          <button onclick="abrirModalLista('${moduloId}', 'olvidados')" 
                  class="bg-red-900/30 rounded-lg p-4 text-center border border-red-700 hover:bg-red-900/50 transition-colors cursor-pointer">
            <div class="text-3xl font-bold text-red-400">${estadosOlvidados.length}</div>
            <div class="text-sm text-red-300 mt-1">Olvidados</div>
          </button>
          <div class="bg-slate-700 rounded-lg p-4 text-center border border-slate-600">
            <div class="text-3xl font-bold text-white">${aspectos.length}</div>
            <div class="text-sm text-slate-300 mt-1">Total</div>
          </div>
        </div>
        
        <!-- Lista de Aspectos Limpiados -->
        ${estadosLimpios.length > 0 ? `
          <div class="mb-4">
            <button onclick="toggleLista('${moduloId}-limpios')" class="flex items-center gap-2 text-md font-semibold text-green-300 mb-2 hover:text-green-200 transition-colors cursor-pointer w-full text-left">
              <span id="${moduloId}-limpios-icon">▼</span>
              <span>✅ Aspectos Limpiados (${estadosLimpios.length})</span>
            </button>
            <div id="${moduloId}-limpios" class="space-y-2">
              ${estadosLimpios.map((aspecto, idx) => `
                <div id="aspecto-${moduloId}-${aspecto.id}" data-aspecto-id="${aspecto.id}" data-modulo="${moduloId}" class="bg-green-900/20 rounded p-3 flex justify-between items-center border border-green-800">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <div class="font-semibold text-white">${aspecto.nombre || 'N/A'}</div>
                      ${aspecto.nivel_minimo ? `<span class="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Nivel ${aspecto.nivel_minimo}</span>` : ''}
                    </div>
                    ${aspecto.ultima_limpieza ? `
                      <div class="text-xs text-green-300 mt-1 fecha-limpieza">
                        Última limpieza: ${new Date(aspecto.ultima_limpieza).toLocaleDateString('es-ES')}
                      </div>
                    ` : ''}
                  </div>
                  <span class="px-3 py-1 bg-green-700 rounded text-sm font-medium text-green-100 badge-estado">
                    Limpio
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Lista de Aspectos Pendientes -->
        ${estadosPendientes.length > 0 ? `
          <div class="mb-4">
            <button onclick="toggleLista('${moduloId}-pendientes')" class="flex items-center gap-2 text-md font-semibold text-yellow-300 mb-2 hover:text-yellow-200 transition-colors cursor-pointer w-full text-left">
              <span id="${moduloId}-pendientes-icon">▼</span>
              <span>⏳ Pendientes (${estadosPendientes.length})</span>
            </button>
            <div id="${moduloId}-pendientes" class="space-y-2">
              ${estadosPendientes.map((aspecto, idx) => `
                <div id="aspecto-${moduloId}-${aspecto.id}" data-aspecto-id="${aspecto.id}" data-modulo="${moduloId}" class="bg-yellow-900/20 rounded p-3 flex justify-between items-center border border-yellow-800">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <div class="font-semibold text-white">${aspecto.nombre || 'N/A'}</div>
                      ${aspecto.nivel_minimo ? `<span class="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Nivel ${aspecto.nivel_minimo}</span>` : ''}
                    </div>
                    ${aspecto.dias_desde_limpieza !== null ? `<div class="text-xs text-yellow-300 mt-1">${aspecto.dias_desde_limpieza} días desde última limpieza</div>` : '<div class="text-xs text-yellow-300 mt-1">Nunca limpiado</div>'}
                    ${aspecto.prioridad ? `<div class="text-xs text-slate-400 mt-1">Prioridad: ${aspecto.prioridad}</div>` : ''}
                  </div>
                  <div class="flex items-center gap-2">
                    ${esTransmutacion ? `
                      <button onclick="window.marcarTransmutacionLimpio ? window.marcarTransmutacionLimpio('${moduloId}', ${aspecto.id}, '${aspecto.nombre || 'N/A'}') : marcarAspectoLimpio('${moduloId}', ${aspecto.id}, '${aspecto.nombre || 'N/A'}')" 
                              class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium text-white transition-colors">
                        ✅ Marcar limpiado
                      </button>
                    ` : `
                      <button onclick="marcarAspectoLimpio('${moduloId}', ${aspecto.id}, '${aspecto.nombre || 'N/A'}')" 
                              class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium text-white transition-colors">
                        ✅ Marcar limpiado
                      </button>
                    `}
                    <span class="px-3 py-1 bg-yellow-700 rounded text-sm font-medium text-yellow-100 badge-estado">
                      Pendiente
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Lista de Aspectos Olvidados -->
        ${estadosOlvidados.length > 0 ? `
          <div>
            <button onclick="toggleLista('${moduloId}-olvidados')" class="flex items-center gap-2 text-md font-semibold text-red-300 mb-2 hover:text-red-200 transition-colors cursor-pointer w-full text-left">
              <span id="${moduloId}-olvidados-icon">▼</span>
              <span>⚠️ Olvidados (${estadosOlvidados.length})</span>
            </button>
            <div id="${moduloId}-olvidados" class="space-y-2">
              ${estadosOlvidados.map((aspecto, idx) => `
                <div id="aspecto-${moduloId}-${aspecto.id}" data-aspecto-id="${aspecto.id}" data-modulo="${moduloId}" class="bg-red-900/20 rounded p-3 flex justify-between items-center border border-red-800">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <div class="font-semibold text-white">${aspecto.nombre || 'N/A'}</div>
                      ${aspecto.nivel_minimo ? `<span class="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">Nivel ${aspecto.nivel_minimo}</span>` : ''}
                    </div>
                    ${aspecto.dias_desde_limpieza !== null ? `<div class="text-xs text-red-300 mt-1">${aspecto.dias_desde_limpieza} días desde última limpieza</div>` : '<div class="text-xs text-red-300 mt-1">Nunca limpiado</div>'}
                    ${aspecto.prioridad ? `<div class="text-xs text-slate-400 mt-1">Prioridad: ${aspecto.prioridad}</div>` : ''}
                  </div>
                  <div class="flex items-center gap-2">
                    ${esTransmutacion ? `
                      <button onclick="window.marcarTransmutacionLimpio ? window.marcarTransmutacionLimpio('${moduloId}', ${aspecto.id}, '${aspecto.nombre || 'N/A'}') : marcarAspectoLimpio('${moduloId}', ${aspecto.id}, '${aspecto.nombre || 'N/A'}')" 
                              class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium text-white transition-colors">
                        ✅ Marcar limpiado
                      </button>
                    ` : `
                      <button onclick="marcarAspectoLimpio('${moduloId}', ${aspecto.id}, '${aspecto.nombre || 'N/A'}')" 
                              class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium text-white transition-colors">
                        ✅ Marcar limpiado
                      </button>
                    `}
                    <span class="px-3 py-1 bg-red-700 rounded text-sm font-medium text-red-100 badge-estado">
                      Olvidado
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  };
  
  // Función helper para renderizar transmutaciones (similar a renderModulo pero adaptado)
  const renderTransmutacionesModule = (titulo, icono, moduloId, items) => {
    const estadosLimpios = items.filter(i => {
      if (!i.ultima_limpieza) return false;
      const dias = i.dias_desde_limpieza !== null ? i.dias_desde_limpieza : 
        Math.floor((new Date() - new Date(i.ultima_limpieza)) / (1000 * 60 * 60 * 24));
      return dias <= (i.frecuencia_dias || 14);
    });
    const estadosPendientes = items.filter(i => {
      if (!i.ultima_limpieza) return true;
      const dias = i.dias_desde_limpieza !== null ? i.dias_desde_limpieza : 
        Math.floor((new Date() - new Date(i.ultima_limpieza)) / (1000 * 60 * 60 * 24));
      return dias > (i.frecuencia_dias || 14) && dias <= 15;
    });
    const estadosOlvidados = items.filter(i => {
      if (!i.ultima_limpieza) return false;
      const dias = i.dias_desde_limpieza !== null ? i.dias_desde_limpieza : 
        Math.floor((new Date() - new Date(i.ultima_limpieza)) / (1000 * 60 * 60 * 24));
      return dias > 15;
    });
    
    return renderModulo(titulo, icono, moduloId, items);
  };
  
  let html = `
    <div class="space-y-6">
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-white mb-3">🧹 Limpieza Energética</h2>
        <p class="text-slate-300 text-lg leading-relaxed max-w-4xl mb-4">
          Este es el lugar donde se registra lo que los alumnos limpian de sí mismos, sus iluminaciones. 
          Aquí puedes ver y gestionar el progreso energético del alumno, marcando aspectos como limpiados 
          cuando se realizan sesiones o transmutaciones. Cada lista muestra los ítems clasificados por estado: 
          <span class="text-green-400 font-semibold">✅ Limpio</span>, 
          <span class="text-yellow-400 font-semibold">⚠️ Pendiente</span> y 
          <span class="text-red-400 font-semibold">❌ Pasado</span>.
        </p>
        
        <!-- Subtabs Navigation -->
        <div class="bg-slate-700 rounded-t-lg border-b border-slate-600 px-4 mb-0">
          <div class="flex gap-2 overflow-x-auto">
            <button data-subtab="subtab-limpiezas-master" 
                    class="subtab-button bg-indigo-600 text-white px-4 py-2 rounded-t-lg hover:bg-indigo-700 transition-colors whitespace-nowrap font-medium text-sm">
              📋 Limpiezas del Master
            </button>
            ${transmutacionesEnergeticas.listas?.map(lista => `
              <button data-subtab="subtab-transmutacion-${lista.id}" 
                      class="subtab-button bg-slate-600 text-slate-300 px-4 py-2 rounded-t-lg hover:bg-slate-500 transition-colors whitespace-nowrap font-medium text-sm">
                🔮 ${lista.nombre || 'Sin nombre'}
              </button>
            `).join('') || ''}
          </div>
        </div>
        
        <!-- Subtab Contents -->
        <div class="bg-slate-800 rounded-b-lg p-6 min-h-[400px]">
          <!-- Subtab: Limpiezas del Master (PRIMERO) -->
          <div id="subtab-limpiezas-master" class="subtab-content" style="display: block;">
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                  📋 Limpiezas de hoy del Master
                </h3>
              </div>
              <div id="limpiezas-hoy-list" class="space-y-2">
                ${(data.limpiezas_hoy || []).length > 0 ? (data.limpiezas_hoy || []).map(limpieza => {
                  const fecha = new Date(limpieza.fecha_limpieza);
                  const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                  return `
                    <div class="bg-slate-700 rounded p-3 flex justify-between items-center">
                      <div class="flex-1">
                        <div class="font-semibold text-white">${limpieza.aspecto_nombre || 'Sin nombre'}</div>
                        <div class="text-sm text-slate-300 mt-1">
                          <span class="text-indigo-300">${limpieza.seccion || limpieza.tipo}</span>
                          <span class="text-slate-500 mx-2">•</span>
                          <span class="text-slate-400">${hora}</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 ml-4">
                        <span class="px-3 py-1 bg-green-600 rounded text-xs text-white">
                          ✅ Limpiado
                        </span>
                      </div>
                    </div>
                  `;
                }).join('') : '<p class="text-slate-400 text-sm">No hay limpiezas registradas hoy.</p>'}
              </div>
            </div>
          </div>
          
          ${transmutacionesEnergeticas.listas?.map(lista => {
            // Convertir los ítems de la lista al formato esperado por renderModulo
            const todosItems = [
              ...lista.items.limpio.map(item => ({
                id: item.id,
                nombre: item.nombre,
                descripcion: item.descripcion,
                nivel_minimo: item.nivel,
                estado_calculado: 'limpio',
                estado: 'limpio',
                ultima_limpieza: item.ultima_limpieza,
                dias_desde_limpieza: item.dias_desde_limpieza,
                frecuencia_dias: item.frecuencia_dias || item.veces_limpiar || 20,
                veces_limpiado: item.veces_completadas || 0
              })),
              ...lista.items.pendiente.map(item => ({
                id: item.id,
                nombre: item.nombre,
                descripcion: item.descripcion,
                nivel_minimo: item.nivel,
                estado_calculado: 'pendiente',
                estado: 'pendiente',
                ultima_limpieza: item.ultima_limpieza,
                dias_desde_limpieza: item.dias_desde_limpieza,
                frecuencia_dias: item.frecuencia_dias || item.veces_limpiar || 20,
                veces_limpiado: item.veces_completadas || 0
              })),
              ...lista.items.pasado.map(item => ({
                id: item.id,
                nombre: item.nombre,
                descripcion: item.descripcion,
                nivel_minimo: item.nivel,
                estado_calculado: 'olvidado',
                estado: 'muy_pendiente',
                ultima_limpieza: item.ultima_limpieza,
                dias_desde_limpieza: item.dias_desde_limpieza,
                frecuencia_dias: item.frecuencia_dias || item.veces_limpiar || 20,
                veces_limpiado: item.veces_completadas || 0
              }))
            ];
            
            return `
            <!-- Subtab: Transmutación ${lista.nombre} -->
            <div id="subtab-transmutacion-${lista.id}" class="subtab-content" style="display: none;">
              ${renderModulo(
                `🔮 ${lista.nombre || 'Sin nombre'}`,
                '🔮',
                `transmutacion_${lista.id}`,
                todosItems
              )}
            </div>
          `;
          }).join('') || ''}
          
        </div>
      </div>
    </div>
    
    <!-- Modal para mostrar listas completas -->
    <div id="modal-lista-limpieza" class="hidden fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onclick="if(event.target.id === 'modal-lista-limpieza') cerrarModalLista()">
      <div class="bg-slate-800 rounded-lg border border-slate-600 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onclick="event.stopPropagation()">
        <div class="p-6 border-b border-slate-700 flex justify-between items-center">
          <h3 class="text-2xl font-bold text-white" id="modal-titulo">Lista</h3>
          <button onclick="cerrarModalLista()" class="text-slate-400 hover:text-white text-2xl font-bold">&times;</button>
        </div>
        <div class="p-6 overflow-y-auto flex-1" id="modal-contenido">
          <!-- Contenido dinámico -->
        </div>
      </div>
    </div>
  `;
  
  console.log('📝 [renderProgresoEnergetico] HTML generado, longitud:', html.length);
  console.log('🔮 [renderProgresoEnergetico] Transmutaciones energéticas a renderizar:', transmutacionesEnergeticas.listas?.length || 0);
  tab.innerHTML = html;
  console.log('✅ [renderProgresoEnergetico] HTML insertado en el tab');
  
  // Guardar datos para el modal (solo transmutaciones energéticas)
  window.limpiezaEnergeticaData = {
    // Transmutaciones energéticas
    ...(transmutacionesEnergeticas.listas || []).reduce((acc, lista) => {
      const todosItems = [
        ...(lista.items.limpio || []),
        ...(lista.items.pendiente || []),
        ...(lista.items.pasado || [])
      ];
      acc[`transmutacion_${lista.id}`] = {
        todos: todosItems,
        resumen: {
          limpio: lista.items.limpio?.length || 0,
          pendiente: lista.items.pendiente?.length || 0,
          pasado: lista.items.pasado?.length || 0
        }
      };
      return acc;
    }, {})
  };
  
  // Guardar alumnoId para las funciones
  window.currentAlumnoId = tab.dataset.alumnoId;
  
  // Asegurar que las funciones estén disponibles globalmente
  window.abrirModalLista = abrirModalLista;
  window.cerrarModalLista = cerrarModalLista;
  window.marcarAspectoLimpio = marcarAspectoLimpio;
  window.marcarTransmutacionLimpio = marcarTransmutacionLimpio;
  
  // Inicializar sistema de subtabs
  inicializarSubtabsLimpieza();
}

// Función para inicializar el sistema de subtabs en Limpieza Energética
function inicializarSubtabsLimpieza() {
  const subtabButtons = document.querySelectorAll('[data-subtab]');
  const subtabContents = document.querySelectorAll('.subtab-content');
  
  subtabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const subtabId = button.getAttribute('data-subtab');
      
      // Ocultar todos los contenidos
      subtabContents.forEach(content => {
        content.style.display = 'none';
      });
      
      // Desactivar todos los botones
      subtabButtons.forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white');
        btn.classList.add('bg-slate-600', 'text-slate-300');
      });
      
      // Mostrar el contenido seleccionado
      const targetContent = document.getElementById(subtabId);
      if (targetContent) {
        targetContent.style.display = 'block';
      }
      
      // Activar el botón seleccionado
      button.classList.remove('bg-slate-600', 'text-slate-300');
      button.classList.add('bg-indigo-600', 'text-white');
    });
  });
}

// Función para toggle de listas desplegables
function toggleLista(listaId) {
  const lista = document.getElementById(listaId);
  const icono = document.getElementById(listaId + '-icon');
  
  if (lista && icono) {
    if (lista.style.display === 'none') {
      lista.style.display = 'block';
      icono.textContent = '▼';
    } else {
      lista.style.display = 'none';
      icono.textContent = '▶';
    }
  }
}
window.toggleLista = toggleLista;

// Función para actualizar el aspecto en el DOM sin recargar todo
function actualizarAspectoEnDOM(moduloId, aspectoId, nuevoEstado) {
  // Buscar TODOS los elementos con este aspecto (puede estar duplicado en varias listas)
  const todosLosElementos = document.querySelectorAll(`#aspecto-${moduloId}-${aspectoId}`);
  
  // Si hay múltiples, eliminar todos excepto el primero
  if (todosLosElementos.length > 1) {
    for (let i = 1; i < todosLosElementos.length; i++) {
      todosLosElementos[i].remove();
    }
  }
  
  // También buscar por selector alternativo
  const elementosAlternativos = document.querySelectorAll(`[data-aspecto-id="${aspectoId}"][data-modulo="${moduloId}"]`);
  elementosAlternativos.forEach((el, idx) => {
    if (idx > 0 || (todosLosElementos.length > 0 && el.id !== `aspecto-${moduloId}-${aspectoId}`)) {
      el.remove();
    }
  });
  
  // Obtener el elemento principal (o crear uno nuevo si no existe)
  let aspectoElement = document.querySelector(`#aspecto-${moduloId}-${aspectoId}`);
  
  if (!aspectoElement) {
    // Si no existe, buscar en cualquier lista
    aspectoElement = document.querySelector(`[data-aspecto-id="${aspectoId}"][data-modulo="${moduloId}"]`);
  }
  
  if (aspectoElement) {
    // Eliminar de cualquier lista actual antes de moverlo
    aspectoElement.remove();
    
    // Mover el elemento a la lista correcta según el nuevo estado
    const ahora = new Date();
    const fechaFormateada = ahora.toLocaleDateString('es-ES');
    
    // Determinar en qué lista debe estar
    let listaDestino;
    if (nuevoEstado === 'limpio' || nuevoEstado === 'al_dia') {
      listaDestino = document.getElementById(`${moduloId}-limpios`);
    } else if (nuevoEstado === 'pendiente') {
      listaDestino = document.getElementById(`${moduloId}-pendientes`);
    } else {
      listaDestino = document.getElementById(`${moduloId}-olvidados`);
    }
    
    if (listaDestino) {
      // Actualizar el HTML del elemento
      aspectoElement.className = nuevoEstado === 'limpio' || nuevoEstado === 'al_dia' 
        ? 'bg-green-900/20 rounded p-3 flex justify-between items-center border border-green-800'
        : nuevoEstado === 'pendiente'
        ? 'bg-yellow-900/20 rounded p-3 flex justify-between items-center border border-yellow-800'
        : 'bg-red-900/20 rounded p-3 flex justify-between items-center border border-red-800';
      
      const badgeColor = nuevoEstado === 'limpio' || nuevoEstado === 'al_dia'
        ? 'bg-green-700 text-green-100'
        : nuevoEstado === 'pendiente'
        ? 'bg-yellow-700 text-yellow-100'
        : 'bg-red-700 text-red-100';
      
      const badgeText = nuevoEstado === 'limpio' || nuevoEstado === 'al_dia'
        ? 'Limpio'
        : nuevoEstado === 'pendiente'
        ? 'Pendiente'
        : 'Olvidado';
      
      // Actualizar el badge
      const badge = aspectoElement.querySelector('.badge-estado');
      if (badge) {
        badge.className = `px-3 py-1 ${badgeColor} rounded text-sm font-medium badge-estado`;
        badge.textContent = badgeText;
      }
      
      // Actualizar fecha de última limpieza
      const fechaElement = aspectoElement.querySelector('.fecha-limpieza');
      if (fechaElement) {
        fechaElement.textContent = `Última limpieza: ${fechaFormateada}`;
        fechaElement.style.display = 'block';
      }
      
      // Remover botón "Marcar limpiado" si está limpio
      const botonLimpiar = aspectoElement.querySelector('button[onclick*="marcar"]');
      if (botonLimpiar && (nuevoEstado === 'limpio' || nuevoEstado === 'al_dia')) {
        botonLimpiar.remove();
      }
      
      // Asegurar que tiene el ID correcto
      aspectoElement.id = `aspecto-${moduloId}-${aspectoId}`;
      
      // Mover a la lista correcta
      listaDestino.appendChild(aspectoElement);
    }
  }
}

// Función para marcar aspecto como limpiado
async function marcarAspectoLimpio(moduloId, aspectoId, aspectoNombre) {
  // Intentar obtener el ID del alumno de múltiples fuentes
  let alumnoId = window.currentAlumnoId;
  
  // Si no está en window, intentar obtenerlo del tab
  if (!alumnoId) {
    const tab = document.getElementById('tab-energetico');
    if (tab && tab.dataset.alumnoId) {
      alumnoId = tab.dataset.alumnoId;
      window.currentAlumnoId = alumnoId;
    }
  }
  
  // Si aún no tenemos el ID, intentar obtenerlo de la URL
  if (!alumnoId) {
    const urlMatch = window.location.pathname.match(/\/admin\/master\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      alumnoId = urlMatch[1];
      window.currentAlumnoId = alumnoId;
    }
  }
  
  if (!alumnoId) {
    console.error('Error: No se pudo obtener el ID del alumno');
    alert('Error: No se pudo obtener el ID del alumno. Por favor, recarga la página.');
    return;
  }
  
  // Actualización optimista del DOM
  actualizarAspectoEnDOM(moduloId, aspectoId, 'limpio');
  
  try {
    const url = `/admin/master/${alumnoId}/marcar-limpio`;
    const bodyData = {
      tipo: moduloId,
      aspecto_id: aspectoId
    };
    console.log('📤 Enviando petición a:', url, bodyData);
    console.log('📍 URL completa:', window.location.origin + url);
    
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
      credentials: 'include', // IMPORTANTE: Incluir cookies para autenticación
      mode: 'same-origin' // Asegurar que funciona en el mismo origen
    };
    console.log('📋 Opciones de fetch:', fetchOptions);
    
    const response = await fetch(url, fetchOptions).catch(fetchError => {
      console.error('❌ Error en fetch (catch):', fetchError);
      throw new Error(`Error de red: ${fetchError.message || 'No se pudo conectar al servidor'}`);
    });
    
    // Verificar si la respuesta es válida
    if (!response) {
      throw new Error('No se recibió respuesta del servidor');
    }
    
    console.log('📥 Respuesta recibida:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // Verificar el tipo de contenido antes de parsear JSON
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      console.error('Respuesta no es JSON:', text);
      throw new Error(`El servidor respondió con: ${text.substring(0, 100)}`);
    }
    
    if (response.ok && result.success) {
      console.log('✅ Aspecto marcado como limpiado correctamente');
      // Actualizar contadores sin recargar todo
      actualizarContadores(moduloId);
      // Cerrar modal si está abierto
      cerrarModalLista();
    } else {
      const errorMsg = result.error || 'Error desconocido';
      console.error('❌ Error marcando aspecto como limpiado:', errorMsg);
      alert(`Error al guardar: ${errorMsg}`);
      // Recargar datos si falló
      const tab = document.getElementById('tab-energetico');
      if (tab && tab.dataset.alumnoId) {
        loadTabData('tab-energetico');
      }
    }
  } catch (error) {
    console.error('❌ Error en fetch marcando aspecto como limpiado:', error);
    const errorMsg = error.message || 'Error de conexión';
    alert(`Error de conexión: ${errorMsg}. Por favor, verifica tu conexión a internet e intenta de nuevo.`);
    // Revertir cambio optimista en el DOM
    const tab = document.getElementById('tab-energetico');
    if (tab && tab.dataset.alumnoId) {
      loadTabData('tab-energetico');
    }
  }
}

// Función para actualizar contadores sin recargar
function actualizarContadores(moduloId) {
  const limpios = document.querySelectorAll(`#${moduloId}-limpios > div`).length;
  const pendientes = document.querySelectorAll(`#${moduloId}-pendientes > div`).length;
  const olvidados = document.querySelectorAll(`#${moduloId}-olvidados > div`).length;
  
  // Actualizar contadores en los botones
  const contadorLimpios = document.querySelector(`button[onclick*="abrirModalLista('${moduloId}', 'limpios')"] .text-3xl`);
  const contadorPendientes = document.querySelector(`button[onclick*="abrirModalLista('${moduloId}', 'pendientes')"] .text-3xl`);
  const contadorOlvidados = document.querySelector(`button[onclick*="abrirModalLista('${moduloId}', 'olvidados')"] .text-3xl`);
  
  if (contadorLimpios) contadorLimpios.textContent = limpios;
  if (contadorPendientes) contadorPendientes.textContent = pendientes;
  if (contadorOlvidados) contadorOlvidados.textContent = olvidados;
}

// Función para abrir modal con lista
function abrirModalLista(moduloId, tipo) {
  const modal = document.getElementById('modal-lista-limpieza');
  const titulo = document.getElementById('modal-titulo');
  const contenido = document.getElementById('modal-contenido');
  
  if (!window.limpiezaEnergeticaData || !window.limpiezaEnergeticaData[moduloId]) {
    console.error('Datos no disponibles');
    return;
  }
  
  const datos = window.limpiezaEnergeticaData[moduloId];
  const modulosNombres = {
    anatomía: '⚡ Anatomía Energética',
    karmicos: '🔮 Registros y Karmas',
    indeseables: '⚠️ Energías Indeseables',
    limpieza_hogar: '🏡 Limpieza de Hogar',
    lugares: '🏠 Lugares',
    proyectos: '🚀 Proyectos',
    apadrinados: '👥 Apadrinados'
  };
  
  const tiposNombres = {
    limpios: 'Limpiados',
    pendientes: 'Pendientes',
    olvidados: 'Olvidados'
  };
  
  titulo.textContent = `${modulosNombres[moduloId]} - ${tiposNombres[tipo]}`;
  
  // Determinar si es un módulo de transmutaciones
  const esTransmutacion = ['lugares', 'proyectos'].includes(moduloId);
  
  let aspectosFiltrados = [];
  if (tipo === 'limpios') {
    if (esTransmutacion) {
      aspectosFiltrados = datos.todos.filter(a => {
        if (!a.ultima_limpieza) return false;
        const dias = a.dias_desde_limpieza !== null ? a.dias_desde_limpieza : 
          Math.floor((new Date() - new Date(a.ultima_limpieza)) / (1000 * 60 * 60 * 24));
        return dias <= (a.frecuencia_dias || 14);
      });
    } else {
      aspectosFiltrados = datos.todos.filter(a => a.estado_calculado === 'limpio' || a.estado === 'al_dia' || a.estado === 'limpio' || a.estado === 'completo');
    }
  } else if (tipo === 'pendientes') {
    if (esTransmutacion) {
      aspectosFiltrados = datos.todos.filter(a => {
        if (!a.ultima_limpieza) return true;
        const dias = a.dias_desde_limpieza !== null ? a.dias_desde_limpieza : 
          Math.floor((new Date() - new Date(a.ultima_limpieza)) / (1000 * 60 * 60 * 24));
        return dias > (a.frecuencia_dias || 14) && dias <= 15;
      });
    } else {
      aspectosFiltrados = datos.todos.filter(a => a.estado_calculado === 'pendiente' || (a.estado === 'pendiente' && (!a.dias_desde_limpieza || a.dias_desde_limpieza <= 15)));
    }
  } else if (tipo === 'olvidados') {
    if (esTransmutacion) {
      aspectosFiltrados = datos.todos.filter(a => {
        if (!a.ultima_limpieza) return false;
        const dias = a.dias_desde_limpieza !== null ? a.dias_desde_limpieza : 
          Math.floor((new Date() - new Date(a.ultima_limpieza)) / (1000 * 60 * 60 * 24));
        return dias > 15;
      });
    } else {
      aspectosFiltrados = datos.todos.filter(a => a.estado_calculado === 'olvidado' || (a.dias_desde_limpieza && a.dias_desde_limpieza > 15) || a.estado === 'muy_pendiente');
    }
  }
  
  const colorBg = tipo === 'limpios' ? 'bg-green-900/20 border-green-800' : tipo === 'pendientes' ? 'bg-yellow-900/20 border-yellow-800' : 'bg-red-900/20 border-red-800';
  const colorText = tipo === 'limpios' ? 'text-green-300' : tipo === 'pendientes' ? 'text-yellow-300' : 'text-red-300';
  const colorBadge = tipo === 'limpios' ? 'bg-green-700 text-green-100' : tipo === 'pendientes' ? 'bg-yellow-700 text-yellow-100' : 'bg-red-700 text-red-100';
  
  contenido.innerHTML = `
    <div class="space-y-2">
      ${aspectosFiltrados.length > 0 ? aspectosFiltrados.map(aspecto => `
        <div class="${colorBg} rounded p-4 flex justify-between items-center border">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <div class="font-semibold text-white text-lg">${aspecto.nombre || 'N/A'}</div>
              ${aspecto.nivel_minimo ? `<span class="px-2 py-1 bg-slate-700 rounded text-sm text-slate-300">Nivel ${aspecto.nivel_minimo}</span>` : '<span class="px-2 py-1 bg-slate-700 rounded text-sm text-slate-300">Nivel 1</span>'}
            </div>
            ${aspecto.ultima_limpieza ? `
              <div class="${colorText} text-sm mt-2">
                Última limpieza: ${new Date(aspecto.ultima_limpieza).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            ` : '<div class="text-slate-400 text-sm mt-2">Nunca limpiado</div>'}
            ${aspecto.dias_desde_limpieza !== null ? `<div class="${colorText} text-sm">${aspecto.dias_desde_limpieza} días desde última limpieza</div>` : ''}
            ${aspecto.prioridad ? `<div class="text-slate-400 text-sm mt-1">Prioridad: ${aspecto.prioridad}</div>` : ''}
            ${aspecto.frecuencia_dias ? `<div class="text-slate-400 text-sm">Frecuencia recomendada: cada ${aspecto.frecuencia_dias} días</div>` : ''}
          </div>
          <div class="flex items-center gap-3 ml-4">
            ${tipo !== 'limpios' ? `
              ${esTransmutacion ? `
                <button onclick="marcarTransmutacionLimpio('${moduloId}', ${aspecto.id}, '${aspecto.nombre || 'N/A'}')" 
                        class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium text-white transition-colors">
                  ✅ Marcar limpiado
                </button>
              ` : `
                <button onclick="marcarAspectoLimpio('${moduloId}', ${aspecto.id}, '${aspecto.nombre || 'N/A'}')" 
                        class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium text-white transition-colors">
                  ✅ Marcar limpiado
                </button>
              `}
            ` : ''}
            <span class="px-4 py-2 ${colorBadge} rounded text-sm font-medium">
              ${tipo === 'limpios' ? 'Limpio' : tipo === 'pendientes' ? 'Pendiente' : 'Olvidado'}
            </span>
          </div>
        </div>
      `).join('') : '<p class="text-slate-400 text-center py-8">No hay aspectos en esta categoría.</p>'}
    </div>
  `;
  
  modal.classList.remove('hidden');
}

// Función para cerrar modal
function cerrarModalLista() {
  const modal = document.getElementById('modal-lista-limpieza');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Renderizar Progreso Gamificado
 */
function renderProgresoGamificado(data) {
  const tab = document.getElementById('tab-gamificado');
  if (!tab) return;
  
  const misiones = data.misiones || [];
  const logros = data.logros || [];
  const skilltree = data.skilltree || [];
  const arquetipos = data.arquetipos || [];
  const auribosses = data.auribosses || [];
  const tokens = data.tokens || [];
  
  let html = `
    <div class="space-y-6">
      <h3 class="text-2xl font-bold text-white mb-4">🎮 Progreso Gamificado</h3>
      
      <div class="grid grid-cols-2 gap-6">
        <!-- Misiones -->
        <div class="bg-slate-700 rounded-lg p-4">
          <h4 class="text-lg font-semibold text-white mb-3">🏅 Misiones (${misiones.length})</h4>
          ${misiones.length > 0 ? `
            <div class="space-y-2 max-h-64 overflow-y-auto">
              ${misiones.slice(0, 10).map(m => `
                <div class="bg-slate-600 rounded p-2 text-sm text-slate-300">
                  ${m.nombre || 'Misión sin nombre'}
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400 text-sm">No hay misiones.</p>'}
        </div>
        
        <!-- Logros -->
        <div class="bg-slate-700 rounded-lg p-4">
          <h4 class="text-lg font-semibold text-white mb-3">🌟 Logros (${logros.length})</h4>
          ${logros.length > 0 ? `
            <div class="space-y-2 max-h-64 overflow-y-auto">
              ${logros.slice(0, 10).map(l => `
                <div class="bg-slate-600 rounded p-2 text-sm text-slate-300">
                  ${l.nombre || 'Logro sin nombre'}
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400 text-sm">No hay logros.</p>'}
        </div>
        
        <!-- Skill Tree -->
        <div class="bg-slate-700 rounded-lg p-4">
          <h4 class="text-lg font-semibold text-white mb-3">🌳 Skill Tree (${skilltree.length})</h4>
          ${skilltree.length > 0 ? `
            <div class="space-y-2 max-h-64 overflow-y-auto">
              ${skilltree.slice(0, 10).map(s => `
                <div class="bg-slate-600 rounded p-2 text-sm text-slate-300">
                  ${s.nombre || 'Nodo sin nombre'}
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400 text-sm">No hay nodos completados.</p>'}
        </div>
        
        <!-- Arquetipos -->
        <div class="bg-slate-700 rounded-lg p-4">
          <h4 class="text-lg font-semibold text-white mb-3">🎭 Arquetipos (${arquetipos.length})</h4>
          ${arquetipos.length > 0 ? `
            <div class="space-y-2 max-h-64 overflow-y-auto">
              ${arquetipos.slice(0, 10).map(a => `
                <div class="bg-slate-600 rounded p-2 text-sm text-slate-300">
                  Arquetipo ID: ${a.arquetipo_id || 'N/A'}
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400 text-sm">No hay arquetipos.</p>'}
        </div>
        
        <!-- Auribosses -->
        <div class="bg-slate-700 rounded-lg p-4">
          <h4 class="text-lg font-semibold text-white mb-3">👹 Auribosses (${auribosses.length})</h4>
          ${auribosses.length > 0 ? `
            <div class="space-y-2 max-h-64 overflow-y-auto">
              ${auribosses.slice(0, 10).map(b => `
                <div class="bg-slate-600 rounded p-2 text-sm text-slate-300">
                  Boss ID: ${b.auriboss_id || 'N/A'}
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400 text-sm">No hay bosses derrotados.</p>'}
        </div>
        
        <!-- Tokens -->
        <div class="bg-slate-700 rounded-lg p-4">
          <h4 class="text-lg font-semibold text-white mb-3">🪙 Tokens (${tokens.length})</h4>
          ${tokens.length > 0 ? `
            <div class="space-y-2 max-h-64 overflow-y-auto">
              ${tokens.slice(0, 10).map(t => `
                <div class="bg-slate-600 rounded p-2 text-sm text-slate-300">
                  ${t.cantidad || 0} tokens - ${t.tipo || 'N/A'}
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400 text-sm">No hay tokens.</p>'}
        </div>
      </div>
    </div>
  `;
  
  tab.innerHTML = html;
}

/**
 * Renderizar Prácticas y Reflexiones
 */
function renderPracticasReflexiones(data) {
  const tab = document.getElementById('tab-practicas');
  if (!tab) return;
  
  const practicas = data.practicas || [];
  const reflexiones = data.reflexiones || [];
  const audios = data.audios || [];
  
  let html = `
    <div class="space-y-6">
      <h3 class="text-2xl font-bold text-white mb-4">🔥 Prácticas y Reflexiones</h3>
      
      <div class="grid grid-cols-3 gap-6">
        <!-- Prácticas -->
        <div class="bg-slate-700 rounded-lg p-4">
          <h4 class="text-lg font-semibold text-white mb-3">🔥 Prácticas (${practicas.length})</h4>
          ${practicas.length > 0 ? `
            <div class="space-y-2 max-h-96 overflow-y-auto">
              ${practicas.slice(0, 20).map(p => `
                <div class="bg-slate-600 rounded p-2 text-sm">
                  <div class="text-white font-medium">${p.aspecto_nombre || 'Práctica'}</div>
                  <div class="text-slate-300 text-xs mt-1">
                    ${p.fecha ? new Date(p.fecha).toLocaleDateString('es-ES') : 'Sin fecha'}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400 text-sm">No hay prácticas registradas.</p>'}
        </div>
        
        <!-- Reflexiones -->
        <div class="bg-slate-700 rounded-lg p-4">
          <h4 class="text-lg font-semibold text-white mb-3">💬 Reflexiones (${reflexiones.length})</h4>
          ${reflexiones.length > 0 ? `
            <div class="space-y-2 max-h-96 overflow-y-auto">
              ${reflexiones.slice(0, 20).map(r => `
                <div class="bg-slate-600 rounded p-2 text-sm">
                  <div class="text-white font-medium line-clamp-2">${r.contenido || 'Reflexión sin contenido'}</div>
                  <div class="text-slate-300 text-xs mt-1">
                    ${r.fecha ? new Date(r.fecha).toLocaleDateString('es-ES') : 'Sin fecha'}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400 text-sm">No hay reflexiones registradas.</p>'}
        </div>
        
        <!-- Audios -->
        <div class="bg-slate-700 rounded-lg p-4">
          <h4 class="text-lg font-semibold text-white mb-3">🎧 Audios (${audios.length})</h4>
          ${audios.length > 0 ? `
            <div class="space-y-2 max-h-96 overflow-y-auto">
              ${audios.slice(0, 20).map(a => `
                <div class="bg-slate-600 rounded p-2 text-sm">
                  <div class="text-white font-medium">Audio de práctica</div>
                  <div class="text-slate-300 text-xs mt-1">
                    ${a.fecha ? new Date(a.fecha).toLocaleDateString('es-ES') : 'Sin fecha'}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p class="text-slate-400 text-sm">No hay audios registrados.</p>'}
        </div>
      </div>
    </div>
  `;
  
  tab.innerHTML = html;
}

/**
 * Renderizar Creación
 */
function renderCreacion(data) {
  const tab = document.getElementById('tab-creacion');
  if (!tab) return;
  
  const objetivos = data.objetivos || [];
  const problemas = data.problemas || [];
  const versionFutura = data.version_futura || null;
  
  let html = `
    <div class="space-y-6">
      <h3 class="text-2xl font-bold text-white mb-4">✨ Creación</h3>
      
      <!-- Objetivos -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">🎯 Objetivos (${objetivos.length})</h4>
        ${objetivos.length > 0 ? `
          <div class="space-y-2">
            ${objetivos.map(o => `
              <div class="bg-slate-600 rounded p-3">
                <div class="text-white font-medium">${o.titulo || 'Objetivo sin título'}</div>
                <div class="text-slate-300 text-sm mt-1">${o.descripcion || ''}</div>
                <div class="text-slate-400 text-xs mt-2">
                  Estado: ${o.estado || 'activo'} | 
                  ${o.fecha_creacion ? new Date(o.fecha_creacion).toLocaleDateString('es-ES') : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-slate-400">No hay objetivos registrados.</p>'}
      </div>
      
      <!-- Problemas -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">🔍 Problemas Iniciales (${problemas.length})</h4>
        ${problemas.length > 0 ? `
          <div class="space-y-2">
            ${problemas.map(p => `
              <div class="bg-slate-600 rounded p-3">
                <div class="text-white font-medium">${p.titulo || 'Problema sin título'}</div>
                <div class="text-slate-300 text-sm mt-1">${p.descripcion || ''}</div>
                <div class="text-slate-400 text-xs mt-2">
                  Gravedad: ${p.gravedad_inicial || 0} → ${p.gravedad_actual || 0}
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-slate-400">No hay problemas registrados.</p>'}
      </div>
      
      <!-- Versión Futura -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">✨ Versión Futura</h4>
        ${versionFutura ? `
          <div class="grid grid-cols-3 gap-4">
            <div>
              <div class="text-sm font-semibold text-slate-300 mb-2">Original</div>
              <div class="bg-slate-600 rounded p-3 text-sm text-slate-200 max-h-64 overflow-y-auto">
                ${versionFutura.borrador_original || 'N/A'}
              </div>
            </div>
            <div>
              <div class="text-sm font-semibold text-slate-300 mb-2">IA</div>
              <div class="bg-slate-600 rounded p-3 text-sm text-slate-200 max-h-64 overflow-y-auto">
                ${versionFutura.version_ia || 'N/A'}
              </div>
            </div>
            <div>
              <div class="text-sm font-semibold text-slate-300 mb-2">Editada</div>
              <div class="bg-slate-600 rounded p-3 text-sm text-slate-200 max-h-64 overflow-y-auto">
                ${versionFutura.version_editada || 'N/A'}
              </div>
            </div>
          </div>
        ` : '<p class="text-slate-400">No hay versión futura registrada.</p>'}
      </div>
    </div>
  `;
  
  tab.innerHTML = html;
}

/**
 * Renderizar Cooperación con otros
 */
function renderCooperacion(data) {
  const tab = document.getElementById('tab-cooperacion');
  if (!tab) return;
  
  const alumno = data.alumno || {};
  const disponibilidad = data.disponibilidad || null;
  const sinergias = data.sinergias || [];
  
  let html = `
    <div class="space-y-6">
      <h3 class="text-2xl font-bold text-white mb-4">🤝 Cooperación con otros</h3>
      
      <!-- Sinergias Disponibles -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">🤝 Sinergias (Prácticas Conjuntas)</h4>
        ${sinergias.length > 0 ? `
          <div class="space-y-3">
            ${sinergias.map(sinergia => {
              const otroAlumno = sinergia.alumno1_id == alumno.id 
                ? { nombre: sinergia.alumno2_nombre || sinergia.alumno2_apodo || 'Alumno', id: sinergia.alumno2_id }
                : { nombre: sinergia.alumno1_nombre || sinergia.alumno1_apodo || 'Alumno', id: sinergia.alumno1_id };
              return `
                <div class="bg-slate-600 rounded p-3 flex justify-between items-center">
                  <div>
                    <div class="font-semibold text-white">${otroAlumno.nombre}</div>
                    <div class="text-sm text-slate-400">
                      ${sinergia.fecha ? new Date(sinergia.fecha).toLocaleDateString('es-ES') : 'Fecha no disponible'}
                    </div>
                  </div>
                  <a href="/admin/master/${otroAlumno.id}" 
                     class="text-indigo-400 hover:text-indigo-300 text-sm">
                    Ver perfil →
                  </a>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <p class="text-slate-400">No hay sinergias registradas.</p>
        `}
      </div>
      
      <!-- Disponibilidad -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">📅 Disponibilidad para Prácticas Conjuntas</h4>
        ${disponibilidad ? `
          <div class="text-slate-300 space-y-2">
            <div class="flex items-center gap-2">
              <span class="px-3 py-1 rounded text-sm font-medium ${disponibilidad.disponible 
                ? 'bg-green-900/30 text-green-400' 
                : 'bg-slate-600 text-slate-400'}">
                ${disponibilidad.disponible ? '✅ Disponible' : '❌ No disponible'}
              </span>
            </div>
            ${disponibilidad.mensaje ? `
              <div class="mt-2 p-3 bg-slate-800 rounded">
                <p class="text-slate-300">${disponibilidad.mensaje}</p>
              </div>
            ` : ''}
            <div class="text-xs text-slate-500 mt-2">
              Actualizado: ${disponibilidad.actualizado 
                ? new Date(disponibilidad.actualizado).toLocaleDateString('es-ES')
                : 'N/A'}
            </div>
          </div>
        ` : `
          <p class="text-slate-400">No hay información de disponibilidad registrada.</p>
        `}
      </div>
    </div>
  `;
  
  tab.innerHTML = html;
  tab.dataset.loaded = 'true';
}

/**
 * Renderizar Área Emocional
 */
function renderAreaEmocional(data) {
  const tab = document.getElementById('tab-emocional');
  if (!tab) return;
  
  const emocional = data.emocional || null;
  const aurigraph = data.aurigraph || null;
  
  let html = `
    <div class="space-y-6">
      <h3 class="text-2xl font-bold text-white mb-4">💚 Área Emocional</h3>
      
      <!-- Aurigraph -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">📈 Aurigraph</h4>
        ${aurigraph && aurigraph.svg ? `
          <div class="bg-slate-600 rounded p-4">
            <div class="text-slate-300">Gráfico Aurigraph (SVG placeholder)</div>
          </div>
        ` : '<p class="text-slate-400">No hay datos de Aurigraph disponibles.</p>'}
      </div>
      
      <!-- Emocional Anual -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">📊 Emocional Anual</h4>
        ${emocional ? `
          <div class="text-slate-300 space-y-2">
            <p><strong>Año:</strong> ${emocional.año || 'N/A'}</p>
            <p><strong>Datos:</strong> ${JSON.stringify(emocional).substring(0, 200)}...</p>
          </div>
        ` : '<p class="text-slate-400">No hay datos emocionales anuales registrados.</p>'}
      </div>
    </div>
  `;
  
  tab.innerHTML = html;
}

/**
 * Renderizar Notas del Master
 */
async function renderNotas(data) {
  const tab = document.getElementById('tab-notas');
  if (!tab) return;
  
  const alumnoId = tab.dataset.alumnoId;
  const notas = data.notas || [];
  
  let html = `
    <div class="space-y-6">
      <h3 class="text-2xl font-bold text-white mb-4">📝 Notas del Master</h3>
      
      <!-- Formulario Nueva Nota -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">➕ Nueva Nota</h4>
        <form id="form-nueva-nota" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Fecha</label>
            <input type="datetime-local" id="nota-fecha" class="w-full bg-slate-600 text-white rounded px-3 py-2" 
                   value="${new Date().toISOString().slice(0, 16)}" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Tipo</label>
            <input type="text" id="nota-tipo" class="w-full bg-slate-600 text-white rounded px-3 py-2" 
                   placeholder="general, seguimiento, importante..." value="general" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1">Contenido</label>
            <textarea id="nota-contenido" class="w-full bg-slate-600 text-white rounded px-3 py-2 h-32" 
                      placeholder="Escribe tu nota aquí..." required></textarea>
          </div>
          <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            Guardar Nota
          </button>
        </form>
      </div>
      
      <!-- Lista de Notas -->
      <div class="bg-slate-700 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-white mb-3">📋 Notas Existentes (${notas.length})</h4>
        ${notas.length > 0 ? `
          <div class="space-y-3 max-h-96 overflow-y-auto">
            ${notas.map(nota => `
              <div class="bg-slate-600 rounded p-3">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <div class="text-white font-medium">${nota.tipo || 'general'}</div>
                    <div class="text-slate-400 text-xs">
                      ${nota.fecha ? new Date(nota.fecha).toLocaleString('es-ES') : 'Sin fecha'} 
                      por ${nota.creado_por || 'Master'}
                    </div>
                  </div>
                </div>
                <div class="text-slate-200 text-sm whitespace-pre-wrap">${nota.contenido || ''}</div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-slate-400">No hay notas registradas.</p>'}
      </div>
    </div>
  `;
  
  tab.innerHTML = html;
  
  // Agregar handler para el formulario
  const form = document.getElementById('form-nueva-nota');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fecha = document.getElementById('nota-fecha').value;
      const tipo = document.getElementById('nota-tipo').value;
      const contenido = document.getElementById('nota-contenido').value;
      
      try {
        const response = await fetch(`/admin/master/${alumnoId}/notas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha, tipo, contenido })
        });
        
        if (!response.ok) {
          throw new Error('Error al crear nota');
        }
        
        // Recargar datos
        tab.dataset.loaded = 'false';
        await loadTabData('tab-notas');
        
        // Limpiar formulario
        form.reset();
        document.getElementById('nota-fecha').value = new Date().toISOString().slice(0, 16);
      } catch (error) {
        alert('Error al guardar nota: ' + error.message);
      }
    });
  }
}

// ============================================
// FUNCIONES DE DRAG & DROP PARA IMÁGENES
// ============================================

function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropzone = event.currentTarget;
  dropzone.classList.add('border-indigo-500', 'bg-indigo-900/30');
  dropzone.classList.remove('border-slate-500');
}

function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropzone = event.currentTarget;
  dropzone.classList.remove('border-indigo-500', 'bg-indigo-900/30');
  dropzone.classList.add('border-slate-500');
}

function handleDrop(event, tipo) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-900/20');
  
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    uploadImage(files[0], tipo);
  }
}

function handleFileSelect(event, tipo) {
  const files = event.target.files;
  if (files.length > 0) {
    uploadImage(files[0], tipo);
  }
}

async function uploadImage(file, tipo) {
  // Validar tipo de archivo
  if (!file.type.startsWith('image/')) {
    alert('❌ Por favor, selecciona un archivo de imagen válido');
    return;
  }
  
  // Validar tamaño (máximo 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('❌ El archivo es demasiado grande. Máximo 5MB');
    return;
  }
  
  // Obtener alumno_id del tab actual
  const tab = document.getElementById('tab-info');
  const alumnoId = tab ? tab.dataset.alumnoId : null;
  
  if (!alumnoId) {
    alert('❌ No se pudo obtener el ID del alumno');
    return;
  }
  
  // Mostrar indicador de carga
  const dropzone = document.getElementById(`dropzone-${tipo}`);
  const originalContent = dropzone.innerHTML;
  dropzone.innerHTML = '<div class="text-slate-400"><div class="text-4xl mb-2 animate-spin">⏳</div><div class="text-sm">Subiendo imagen...</div></div>';
    if (dropzone) {
      dropzone.style.pointerEvents = 'none';
    }
  
  try {
    // Crear FormData
    const formData = new FormData();
    formData.append('imagen', file);
    
    // Subir imagen
    const endpoint = tipo === 'carta-astral' 
      ? `/admin/master/${alumnoId}/carta-astral/upload`
      : `/admin/master/${alumnoId}/diseno-humano/upload`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Error al subir la imagen');
    }
    
    const result = await response.json();
    
    console.log('✅ Imagen subida correctamente:', result);
    
    // Mostrar la imagen inmediatamente
    const imagenUrl = result.imagen_url;
    if (imagenUrl) {
      const seccion = dropzone.closest('.bg-slate-700');
      
      // Buscar o crear el contenedor de imagen
      let imagenContainer = seccion.querySelector('.imagen-container');
      
      if (!imagenContainer) {
        // Crear contenedor para la imagen antes del dropzone
        imagenContainer = document.createElement('div');
        imagenContainer.className = 'space-y-4 mb-4 imagen-container';
        const h4 = seccion.querySelector('h4');
        h4.insertAdjacentElement('afterend', imagenContainer);
      }
      
      // Crear o actualizar la imagen
      let img = imagenContainer.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = tipo === 'carta-astral' ? 'Carta Astral' : 'Diseño Humano';
        img.className = 'max-w-full h-auto rounded-lg border border-slate-600 shadow-lg mb-4';
        imagenContainer.innerHTML = '';
        imagenContainer.appendChild(img);
      }
      
      // Asegurar que la URL sea absoluta (no relativa)
      let imagenUrlAbsoluta = imagenUrl;
      if (!imagenUrl.startsWith('http')) {
        // Si es una URL relativa, hacerla absoluta
        imagenUrlAbsoluta = window.location.origin + imagenUrl;
      }
      // No añadir timestamp - confiar en los headers de caché del servidor
      // El timestamp puede causar problemas con algunos navegadores
      const imagenUrlFinal = imagenUrlAbsoluta;
      console.log('🖼️ Intentando cargar imagen:', imagenUrlFinal);
      
      // Configurar handlers antes de cambiar src
      img.onerror = function() {
        console.error('❌ Error cargando imagen:', this.src);
        console.error('❌ Estado:', {
          complete: this.complete,
          naturalWidth: this.naturalWidth,
          naturalHeight: this.naturalHeight,
          src: this.src
        });
        this.style.display = 'none';
      };
      
      img.onload = function() {
        console.log('✅ Imagen cargada correctamente:', this.src);
        console.log('✅ Dimensiones:', this.naturalWidth, 'x', this.naturalHeight);
        this.style.display = 'block';
      };
      
      // Establecer src después de configurar los handlers
      img.src = imagenUrlFinal;
      
      // Agregar botón "Cambiar imagen" si no existe
      let cambiarBtn = imagenContainer.querySelector('button[onclick*="Cambiar"]');
      if (!cambiarBtn) {
        cambiarBtn = document.createElement('button');
        cambiarBtn.type = 'button';
        cambiarBtn.className = 'mt-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors';
        cambiarBtn.textContent = '🔄 Cambiar Imagen';
        cambiarBtn.onclick = function() {
          const dropzoneContainer = tipo === 'carta-astral' 
            ? document.querySelector('.dropzone-carta-container')
            : document.querySelector('.dropzone-diseno-container');
          if (dropzoneContainer) {
            dropzoneContainer.style.display = 'block';
            imagenContainer.style.display = 'none';
          }
        };
        const imgWrapper = img.parentElement;
        if (imgWrapper) {
          imgWrapper.appendChild(cambiarBtn);
        }
      }
      
      // Ocultar el dropzone si hay imagen
      const dropzoneContainer = tipo === 'carta-astral' 
        ? document.querySelector('.dropzone-carta-container')
        : document.querySelector('.dropzone-diseno-container');
      if (dropzoneContainer) {
        dropzoneContainer.style.display = 'none';
      }
      
      // Mostrar mensaje de éxito temporal
      const successMsg = document.createElement('div');
      successMsg.className = 'mt-2 p-2 bg-green-900/20 border border-green-700 rounded text-green-300 text-sm';
      successMsg.textContent = '✅ Imagen subida correctamente';
      imagenContainer.appendChild(successMsg);
      
      setTimeout(() => {
        successMsg.remove();
      }, 3000);
      
      // Asegurar que el contenedor de imagen sea visible
      imagenContainer.style.display = 'block';
    }
    
    // Recargar datos completos después de 2 segundos para asegurar sincronización
    // (aumentado a 2 segundos para dar tiempo a que la BD se actualice)
    setTimeout(async () => {
      dropzone.style.pointerEvents = 'auto';
      
      // Recargar datos de la pestaña para asegurar que todo esté sincronizado
      const tab = document.getElementById('tab-info');
      if (tab) {
        tab.dataset.loaded = 'false';
        await loadTabData('tab-info');
      }
    }, 2000);
    
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    alert('❌ Error al subir la imagen: ' + error.message);
    if (dropzone) {
      dropzone.innerHTML = originalContent;
      dropzone.style.pointerEvents = 'auto';
    }
  } finally {
    // Asegurar que el dropzone siempre se desbloquee
    if (dropzone) {
      setTimeout(() => {
        dropzone.style.pointerEvents = 'auto';
      }, 3000);
    }
  }
}

/**
 * Guardar datos de nacimiento
 */
async function guardarDatosNacimiento(alumnoId) {
  const form = document.getElementById('form-datos-nacimiento');
  if (!form) return;
  
  const fechaNacimiento = document.getElementById('fecha-nacimiento').value;
  const horaNacimiento = document.getElementById('hora-nacimiento').value;
  const lugarNacimiento = document.getElementById('lugar-nacimiento').value;
  
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = '💾 Guardando...';
  
  try {
    const response = await fetch(`/admin/master/${alumnoId}/datos-nacimiento`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fecha_nacimiento: fechaNacimiento || null,
        hora_nacimiento: horaNacimiento || null,
        lugar_nacimiento: lugarNacimiento || null
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errorData.error || 'Error al guardar datos');
    }
    
    const data = await response.json();
    
    // Mostrar mensaje de éxito
    const successMsg = document.createElement('div');
    successMsg.className = 'mt-3 p-3 bg-green-900/20 border border-green-700 rounded text-green-300 text-sm';
    successMsg.textContent = '✅ Datos de nacimiento guardados correctamente';
    form.parentNode.insertBefore(successMsg, form.nextSibling);
    
    // Eliminar mensaje después de 3 segundos
    setTimeout(() => {
      successMsg.remove();
    }, 3000);
    
    // Actualizar valores originales
    form.dataset.originalValues = JSON.stringify({
      fecha: fechaNacimiento,
      hora: horaNacimiento,
      lugar: lugarNacimiento
    });
    
  } catch (error) {
    console.error('Error guardando datos de nacimiento:', error);
    alert('❌ Error al guardar: ' + error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
}

/**
 * Cancelar edición de datos de nacimiento
 */
function cancelarEdicionNacimiento() {
  const form = document.getElementById('form-datos-nacimiento');
  if (!form || !form.dataset.originalValues) return;
  
  const originalValues = JSON.parse(form.dataset.originalValues);
  
  const fechaInput = document.getElementById('fecha-nacimiento');
  const horaInput = document.getElementById('hora-nacimiento');
  const lugarInput = document.getElementById('lugar-nacimiento');
  
  if (fechaInput) fechaInput.value = originalValues.fecha || '';
  if (horaInput) horaInput.value = originalValues.hora || '';
  if (lugarInput) lugarInput.value = originalValues.lugar || '';
}

// Hacer funciones globales
window.openTab = openTab;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleFileSelect = handleFileSelect;
window.guardarDatosNacimiento = guardarDatosNacimiento;
window.cancelarEdicionNacimiento = cancelarEdicionNacimiento;

// Inicializar primera pestaña al cargar
function inicializarPestañas() {
  console.log('[INIT] admin-master.js cargado, inicializando pestañas...');
  console.log('[INIT] Modo Master: Inicializando pestañas...');
  console.log('[INIT] 📊 Estado del DOM:', document.readyState);
  
  // Verificar que el DOM esté listo
  if (document.readyState === 'loading') {
    console.log('[INIT] ⏳ DOM aún cargando, esperando DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', inicializarPestañas);
    return;
  }
  
  console.log('[INIT] ✅ DOM listo, verificando funciones...');
  console.log('[INIT] 📋 openTab disponible (local):', typeof openTab);
  console.log('[INIT] 📋 window.openTab disponible:', typeof window.openTab);
  
  // Verificar que openTab esté disponible (local o global)
  const openTabFunc = typeof openTab !== 'undefined' ? openTab : (typeof window.openTab !== 'undefined' ? window.openTab : null);
  console.log('[INIT] 📋 openTabFunc:', typeof openTabFunc);
  
  if (!openTabFunc || typeof openTabFunc !== 'function') {
    console.error('[INIT] ❌ openTab no está disponible');
    console.log('[INIT] openTab (local):', typeof openTab);
    console.log('[INIT] window.openTab:', typeof window.openTab);
    console.log('[INIT] Intentando usar window.openTab directamente...');
    
    // Intentar usar window.openTab directamente
    if (typeof window.openTab === 'function') {
      console.log('[INIT] ✅ Usando window.openTab directamente');
      setTimeout(() => {
        try {
          window.openTab('tab-info');
          console.log('[INIT] ✅ window.openTab ejecutado');
        } catch (e) {
          console.error('[INIT] ❌ Error con window.openTab:', e);
        }
      }, 100);
    }
    return;
  }
  
  console.log('[INIT] ✅ openTab está disponible');
  
  // Verificar que el tab existe
  const tabInfo = document.getElementById('tab-info');
  if (!tabInfo) {
    console.error('❌ Tab tab-info no encontrado en el DOM');
    console.log('Tabs disponibles:', document.querySelectorAll('.tab-content').length);
    return;
  }
  
  console.log('✅ Tab tab-info encontrado, dataset:', tabInfo.dataset);
  
  // Abrir la primera pestaña
  console.log('✅ Abriendo pestaña tab-info...');
  try {
    openTabFunc('tab-info');
    console.log('✅ openTab ejecutado sin errores');
  } catch (error) {
    console.error('❌ Error al ejecutar openTab:', error);
    console.error('Stack:', error.stack);
    return;
  }
  
  // Verificar que se abrió correctamente y cargar datos
  setTimeout(() => {
    const tabInfoAfter = document.getElementById('tab-info');
    if (tabInfoAfter) {
      const display = window.getComputedStyle(tabInfoAfter).display;
      console.log('✅ Tab tab-info después de openTab:');
      console.log('  - display:', display);
      console.log('  - loaded:', tabInfoAfter.dataset.loaded);
      console.log('  - alumnoId:', tabInfoAfter.dataset.alumnoId);
      
      // Si no se ha cargado, forzar la carga
      if (tabInfoAfter.dataset.loaded !== 'true') {
        console.log('⚠️ Tab no está cargado, forzando carga de datos...');
        loadTabData('tab-info').catch(err => {
          console.error('❌ Error al cargar datos:', err);
        });
      }
    } else {
      console.error('❌ Tab tab-info no encontrado después de openTab');
    }
  }, 200);
}

// Intentar inicializar inmediatamente si el DOM ya está listo
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  inicializarPestañas();
} else {
  document.addEventListener('DOMContentLoaded', inicializarPestañas);
}
