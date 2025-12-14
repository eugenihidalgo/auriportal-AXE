// recursos-tecnicos.js
// Lógica JavaScript para el panel de recursos técnicos

const API_BASE_MUSICAS = "/api/musicas-meditacion";
const API_BASE_TONOS = "/api/tonos-meditacion";
const API_UPLOAD_MUSICAS = "/api/musicas-meditacion/upload";
const API_UPLOAD_TONOS = "/api/tonos-meditacion/upload";

let archivoSeleccionado = null;
let archivoSeleccionadoId = null;

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
  inicializarEventListeners();
  inicializarEventListenersDinamicos();
});

function inicializarEventListenersDinamicos() {
  // Event listeners para filas dinámicas de músicas
  document.querySelectorAll('[data-musica-id] input[data-campo]').forEach(input => {
    input.addEventListener('blur', function() {
      const musicaId = this.dataset.musicaId;
      const campo = this.dataset.campo;
      let valor = this.value;
      
      if (campo === 'duracion_segundos') {
        valor = valor ? parseInt(valor) : null;
      }
      
      guardarCampoMusica(musicaId, campo, valor);
    });
  });
  
  // Event listeners para checkbox "por defecto" de músicas
  document.querySelectorAll('.checkbox-por-defecto-musica').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const musicaId = this.dataset.musicaId;
      const valor = this.checked; // Asegurar que es un booleano
      console.log('Cambiando es_por_defecto para música', musicaId, 'a', valor);
      guardarCampoMusica(musicaId, 'es_por_defecto', valor);
    });
  });
  
  // Event listeners para filas dinámicas de tonos
  document.querySelectorAll('[data-tono-id] input[data-campo]').forEach(input => {
    if (input.type === 'checkbox') {
      input.addEventListener('change', function() {
        const tonoId = this.dataset.tonoId;
        const campo = this.dataset.campo;
        guardarCampoTono(tonoId, campo, this.checked);
      });
    } else {
      input.addEventListener('blur', function() {
        const tonoId = this.dataset.tonoId;
        const campo = this.dataset.campo;
        let valor = this.value;
        
        if (campo === 'duracion_segundos') {
          valor = valor ? parseInt(valor) : null;
        }
        
        guardarCampoTono(tonoId, campo, valor);
      });
    }
  });
  
  // Event listeners para botones de cambiar archivo
  document.querySelectorAll('.btn-cambiar-archivo').forEach(btn => {
    btn.addEventListener('click', function() {
      const inputId = this.dataset.inputId;
      const input = document.getElementById(inputId);
      if (input) {
        input.click();
      }
    });
  });
  
  // Event listeners para inputs de archivo dinámicos
  document.querySelectorAll('input[data-tipo][data-id]').forEach(input => {
    input.addEventListener('change', function() {
      handleFileSelect(this.dataset.tipo, this, this.dataset.id);
    });
  });
  
  // Event listeners para botones de eliminar
  document.querySelectorAll('.btn-eliminar-musica').forEach(btn => {
    btn.addEventListener('click', function() {
      eliminarMusica(this.dataset.musicaId);
    });
  });
  
  document.querySelectorAll('.btn-eliminar-tono').forEach(btn => {
    btn.addEventListener('click', function() {
      eliminarTono(this.dataset.tonoId);
    });
  });
}

function inicializarEventListeners() {
  // Músicas
  const btnNewMusicaArchivo = document.getElementById('btnNewMusicaArchivo');
  const newMusicaArchivo = document.getElementById('newMusicaArchivo');
  const btnCrearMusica = document.getElementById('btnCrearMusica');
  const newMusicaNombre = document.getElementById('newMusicaNombre');
  const newMusicaDescripcion = document.getElementById('newMusicaDescripcion');
  const newMusicaCategoria = document.getElementById('newMusicaCategoria');
  const newMusicaUrl = document.getElementById('newMusicaUrl');
  
  if (btnNewMusicaArchivo && newMusicaArchivo) {
    btnNewMusicaArchivo.addEventListener('click', () => newMusicaArchivo.click());
    newMusicaArchivo.addEventListener('change', (e) => handleFileSelect('musica', e.target));
  }
  
  if (btnCrearMusica) {
    btnCrearMusica.addEventListener('click', crearMusicaRapido);
  }
  
  if (newMusicaNombre) {
    newMusicaNombre.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        crearMusicaRapido();
      }
    });
  }
  
  if (newMusicaDescripcion) {
    newMusicaDescripcion.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        crearMusicaRapido();
      }
    });
  }
  
  if (newMusicaCategoria) {
    newMusicaCategoria.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        crearMusicaRapido();
      }
    });
  }
  
  if (newMusicaUrl) {
    newMusicaUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        crearMusicaRapido();
      }
    });
  }
  
  // Tonos
  const btnNewTonoArchivo = document.getElementById('btnNewTonoArchivo');
  const newTonoArchivo = document.getElementById('newTonoArchivo');
  const btnCrearTono = document.getElementById('btnCrearTono');
  const newTonoNombre = document.getElementById('newTonoNombre');
  const newTonoDescripcion = document.getElementById('newTonoDescripcion');
  const newTonoCategoria = document.getElementById('newTonoCategoria');
  const newTonoUrl = document.getElementById('newTonoUrl');
  
  if (btnNewTonoArchivo && newTonoArchivo) {
    btnNewTonoArchivo.addEventListener('click', () => newTonoArchivo.click());
    newTonoArchivo.addEventListener('change', (e) => handleFileSelect('tono', e.target));
  }
  
  if (btnCrearTono) {
    btnCrearTono.addEventListener('click', crearTonoRapido);
  }
  
  if (newTonoNombre) {
    newTonoNombre.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        crearTonoRapido();
      }
    });
  }
  
  if (newTonoDescripcion) {
    newTonoDescripcion.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        crearTonoRapido();
      }
    });
  }
  
  if (newTonoCategoria) {
    newTonoCategoria.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        crearTonoRapido();
      }
    });
  }
  
  if (newTonoUrl) {
    newTonoUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        crearTonoRapido();
      }
    });
  }
}

async function handleFileSelect(tipo, input) {
  const file = input.files[0];
  if (!file) return;
  
  archivoSeleccionado = file;
  archivoSeleccionadoId = input.dataset.id || null;
  
  const tipoCapitalizado = tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const infoDiv = archivoSeleccionadoId ? null : document.getElementById("new" + tipoCapitalizado + "ArchivoInfo");
  if (infoDiv) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    infoDiv.textContent = "📁 " + file.name + " (" + sizeMB + " MB)";
    infoDiv.classList.remove("hidden");
  }
}

async function subirArchivo(tipo, musicaTonoId = null) {
  if (!archivoSeleccionado) return null;
  
  const formData = new FormData();
  formData.append("archivo", archivoSeleccionado);
  
  const uploadUrl = tipo === "musica" ? API_UPLOAD_MUSICAS : API_UPLOAD_TONOS;
  
  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      archivoSeleccionado = null;
      return data;
    } else {
      alert("Error subiendo archivo: " + data.error);
      return null;
    }
  } catch (error) {
    alert("Error: " + error.message);
    return null;
  }
}

async function crearMusicaRapido() {
  const nombreInput = document.getElementById("newMusicaNombre");
  const descripcionInput = document.getElementById("newMusicaDescripcion");
  const categoriaInput = document.getElementById("newMusicaCategoria");
  const urlInput = document.getElementById("newMusicaUrl");
  const duracionInput = document.getElementById("newMusicaDuracion");
  const porDefectoInput = document.getElementById("newMusicaPorDefecto");
  
  if (!nombreInput) return;
  
  const nombre = nombreInput.value.trim();
  const descripcion = descripcionInput?.value.trim() || "";
  const categoria = categoriaInput?.value.trim() || null;
  const url_externa = urlInput?.value.trim() || null;
  let duracion_segundos = duracionInput?.value ? parseInt(duracionInput.value) : null;
  const es_por_defecto = porDefectoInput?.checked || false;
  
  if (!nombre) {
    alert("El nombre es requerido");
    nombreInput.focus();
    return;
  }
  
  let archivo_path = null;
  let peso_mb = null;
  
  if (archivoSeleccionado) {
    const uploadResult = await subirArchivo("musica");
    if (uploadResult) {
      archivo_path = uploadResult.archivo_path;
      peso_mb = uploadResult.peso_mb;
      if (uploadResult.duracion_segundos && !duracion_segundos) {
        duracion_segundos = uploadResult.duracion_segundos;
      }
    } else {
      return;
    }
  }
  
  nombreInput.disabled = true;
  if (descripcionInput) descripcionInput.disabled = true;
  if (categoriaInput) categoriaInput.disabled = true;
  if (urlInput) urlInput.disabled = true;
  if (duracionInput) duracionInput.disabled = true;
  if (porDefectoInput) porDefectoInput.disabled = true;
  
  try {
    const response = await fetch(API_BASE_MUSICAS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, categoria, archivo_path, url_externa, duracion_segundos, peso_mb, es_por_defecto })
    });
    
    const data = await response.json();
    
    if (data.success || data.id) {
      nombreInput.value = "";
      if (descripcionInput) descripcionInput.value = "";
      if (categoriaInput) categoriaInput.value = "";
      if (urlInput) urlInput.value = "";
      if (duracionInput) duracionInput.value = "";
      document.getElementById("newMusicaArchivo").value = "";
      document.getElementById("newMusicaArchivoInfo").classList.add("hidden");
      archivoSeleccionado = null;
      
      nombreInput.disabled = false;
      if (descripcionInput) descripcionInput.disabled = false;
      if (categoriaInput) categoriaInput.disabled = false;
      if (urlInput) urlInput.disabled = false;
      if (duracionInput) duracionInput.disabled = false;
      
      location.reload();
    } else {
      alert("Error: " + (data.error || "Error desconocido"));
      nombreInput.disabled = false;
      if (descripcionInput) descripcionInput.disabled = false;
      if (categoriaInput) categoriaInput.disabled = false;
      if (urlInput) urlInput.disabled = false;
      if (duracionInput) duracionInput.disabled = false;
    }
  } catch (error) {
    alert("Error: " + error.message);
    nombreInput.disabled = false;
    if (descripcionInput) descripcionInput.disabled = false;
    if (categoriaInput) categoriaInput.disabled = false;
    if (urlInput) urlInput.disabled = false;
    if (duracionInput) duracionInput.disabled = false;
  }
}

async function crearTonoRapido() {
  const nombreInput = document.getElementById("newTonoNombre");
  const descripcionInput = document.getElementById("newTonoDescripcion");
  const categoriaInput = document.getElementById("newTonoCategoria");
  const urlInput = document.getElementById("newTonoUrl");
  const duracionInput = document.getElementById("newTonoDuracion");
  const porDefectoInput = document.getElementById("newTonoPorDefecto");
  
  if (!nombreInput) return;
  
  const nombre = nombreInput.value.trim();
  const descripcion = descripcionInput?.value.trim() || "";
  const categoria = categoriaInput?.value.trim() || null;
  const url_externa = urlInput?.value.trim() || null;
  let duracion_segundos = duracionInput?.value ? parseInt(duracionInput.value) : null;
  const es_por_defecto = porDefectoInput?.checked || false;
  
  if (!nombre) {
    alert("El nombre es requerido");
    nombreInput.focus();
    return;
  }
  
  let archivo_path = null;
  let peso_mb = null;
  
  if (archivoSeleccionado) {
    const uploadResult = await subirArchivo("tono");
    if (uploadResult) {
      archivo_path = uploadResult.archivo_path;
      peso_mb = uploadResult.peso_mb;
      if (uploadResult.duracion_segundos && !duracion_segundos) {
        duracion_segundos = uploadResult.duracion_segundos;
      }
    } else {
      return;
    }
  }
  
  nombreInput.disabled = true;
  if (descripcionInput) descripcionInput.disabled = true;
  if (categoriaInput) categoriaInput.disabled = true;
  if (urlInput) urlInput.disabled = true;
  if (duracionInput) duracionInput.disabled = true;
  if (porDefectoInput) porDefectoInput.disabled = true;
  
  try {
    const response = await fetch(API_BASE_TONOS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, categoria, archivo_path, url_externa, duracion_segundos, peso_mb, es_por_defecto })
    });
    
    const data = await response.json();
    
    if (data.success || data.id) {
      nombreInput.value = "";
      if (descripcionInput) descripcionInput.value = "";
      if (categoriaInput) categoriaInput.value = "";
      if (urlInput) urlInput.value = "";
      if (duracionInput) duracionInput.value = "";
      if (porDefectoInput) porDefectoInput.checked = false;
      document.getElementById("newTonoArchivo").value = "";
      document.getElementById("newTonoArchivoInfo").classList.add("hidden");
      archivoSeleccionado = null;
      
      nombreInput.disabled = false;
      if (descripcionInput) descripcionInput.disabled = false;
      if (categoriaInput) categoriaInput.disabled = false;
      if (urlInput) urlInput.disabled = false;
      if (duracionInput) duracionInput.disabled = false;
      if (porDefectoInput) porDefectoInput.disabled = false;
      
      location.reload();
    } else {
      alert("Error: " + (data.error || "Error desconocido"));
      nombreInput.disabled = false;
      if (descripcionInput) descripcionInput.disabled = false;
      if (categoriaInput) categoriaInput.disabled = false;
      if (urlInput) urlInput.disabled = false;
      if (duracionInput) duracionInput.disabled = false;
      if (porDefectoInput) porDefectoInput.disabled = false;
    }
  } catch (error) {
    alert("Error: " + error.message);
    nombreInput.disabled = false;
    if (descripcionInput) descripcionInput.disabled = false;
    if (categoriaInput) categoriaInput.disabled = false;
    if (urlInput) urlInput.disabled = false;
    if (duracionInput) duracionInput.disabled = false;
    if (porDefectoInput) porDefectoInput.disabled = false;
  }
}

async function guardarCampoMusica(musicaId, campo, valor) {
  try {
    const response = await fetch(API_BASE_MUSICAS + '/' + musicaId);
    const data = await response.json();
    
    if (!data || !data.id) {
      const updateResponse = await fetch(API_BASE_MUSICAS + '/' + musicaId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor })
      });
      
      const updateData = await updateResponse.json();
      if (!updateData.success && updateData.error) {
        alert("Error guardando: " + updateData.error);
      }
      return;
    }
    
    const musica = data;
    const datos = {
      nombre: musica.nombre,
      descripcion: musica.descripcion || "",
      categoria: musica.categoria || null,
      archivo_path: musica.archivo_path || null,
      url_externa: musica.url_externa || null,
      duracion_segundos: musica.duracion_segundos || null,
      peso_mb: musica.peso_mb || null,
      es_por_defecto: musica.es_por_defecto || false
    };
    
    // Asegurar que el valor booleano se envíe correctamente
    if (campo === 'es_por_defecto') {
      datos[campo] = valor === true || valor === 'true' || valor === 1;
    } else {
      datos[campo] = valor;
    }
    
    const updateResponse = await fetch(API_BASE_MUSICAS + '/' + musicaId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    
    const updateData = await updateResponse.json();
    
    if (!updateData.success && updateData.error) {
      alert("Error guardando: " + updateData.error);
      location.reload();
    }
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function guardarCampoTono(tonoId, campo, valor) {
  try {
    const response = await fetch(API_BASE_TONOS + '/' + tonoId);
    const data = await response.json();
    
    if (!data || !data.id) {
      const updateResponse = await fetch(API_BASE_TONOS + '/' + tonoId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valor })
      });
      
      const updateData = await updateResponse.json();
      if (!updateData.success && updateData.error) {
        alert("Error guardando: " + updateData.error);
      }
      return;
    }
    
    const tono = data;
    const datos = {
      nombre: tono.nombre,
      descripcion: tono.descripcion || "",
      categoria: tono.categoria || null,
      archivo_path: tono.archivo_path || null,
      url_externa: tono.url_externa || null,
      duracion_segundos: tono.duracion_segundos || null,
      peso_mb: tono.peso_mb || null,
      es_por_defecto: tono.es_por_defecto || false
    };
    
    datos[campo] = valor;
    
    const updateResponse = await fetch(API_BASE_TONOS + '/' + tonoId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    
    const updateData = await updateResponse.json();
    
    if (!updateData.success && updateData.error) {
      alert("Error guardando: " + updateData.error);
      location.reload();
    } else if (campo === "es_por_defecto") {
      // Recargar siempre cuando se cambia es_por_defecto para actualizar todos los checkboxes
      // Esto asegura que si se marca una como por defecto, las demás se desmarquen visualmente
      setTimeout(() => location.reload(), 100);
    }
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function eliminarMusica(id) {
  if (!confirm('¿Estás seguro de eliminar esta música?')) return;
  
  try {
    const response = await fetch(API_BASE_MUSICAS + '/' + id, { method: 'DELETE' });
    const data = await response.json();
    
    if (data.success) {
      location.reload();
    } else {
      alert("Error: " + (data.error || "Error desconocido"));
    }
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function eliminarTono(id) {
  if (!confirm('¿Estás seguro de eliminar este tono?')) return;
  
  try {
    const response = await fetch(API_BASE_TONOS + '/' + id, { method: 'DELETE' });
    const data = await response.json();
    
    if (data.success) {
      location.reload();
    } else {
      alert("Error: " + (data.error || "Error desconocido"));
    }
  } catch (error) {
    alert("Error: " + error.message);
  }
}

// Exportar funciones para uso global
window.guardarCampoMusica = guardarCampoMusica;
window.guardarCampoTono = guardarCampoTono;
window.eliminarMusica = eliminarMusica;
window.eliminarTono = eliminarTono;
window.handleFileSelect = handleFileSelect;

