// public/js/admin-decretos.js
// Funcionalidad JavaScript para la gestión de decretos en el admin

/**
 * Guarda un decreto (crear o actualizar)
 */
async function guardarDecreto(event) {
  event.preventDefault();
  
  const btnGuardar = document.getElementById('btnGuardar');
  const feedback = document.getElementById('feedback');
  const feedbackContent = document.getElementById('feedbackContent');
  
  // Deshabilitar botón y mostrar loading
  btnGuardar.disabled = true;
  btnGuardar.textContent = '💾 Guardando...';
  feedback.classList.add('hidden');
  
  const decretoId = document.getElementById('decretoId').value;
  const nombre = document.getElementById('nombre').value;
  const descripcion = document.getElementById('descripcion')?.value || '';
  
  // Obtener contenido de Quill si está disponible
  let contenidoHtml = '';
  let contentDelta = null;
  
  if (typeof Quill !== 'undefined' && window.quill) {
    contenidoHtml = window.quill.root.innerHTML;
    contentDelta = window.quill.getContents();
  } else {
    // Fallback: usar textarea si Quill no está disponible
    contenidoHtml = document.getElementById('contenidoHtml').value || 
                    document.getElementById('contenidoHtmlFallback').value;
  }
  
  if (!contenidoHtml || contenidoHtml.trim() === '' || contenidoHtml === '<p><br></p>') {
    mostrarFeedback('error', 'El contenido del decreto no puede estar vacío');
    btnGuardar.disabled = false;
    btnGuardar.textContent = '💾 Guardar';
    return;
  }
  
  const nivelMinimo = parseInt(document.getElementById('nivelMinimo').value);
  const posicion = document.getElementById('posicion').value;
  const obligatoriaGlobal = document.getElementById('obligatoriaGlobal').checked;
  
  let obligatoriaPorNivel = {};
  try {
    const obligatoriaPorNivelText = document.getElementById('obligatoriaPorNivel').value.trim();
    if (obligatoriaPorNivelText) {
      obligatoriaPorNivel = JSON.parse(obligatoriaPorNivelText);
    }
  } catch (error) {
    mostrarFeedback('error', 'Error en el formato JSON de obligatoriedad por nivel. Usa formato: {"1": true, "2": false}');
    btnGuardar.disabled = false;
    btnGuardar.textContent = '💾 Guardar';
    return;
  }
  
  const datos = {
    nombre,
    descripcion,
    contenido_html: contenidoHtml,
    content_delta: contentDelta,
    nivel_minimo: nivelMinimo,
    posicion,
    obligatoria_global: obligatoriaGlobal,
    obligatoria_por_nivel: obligatoriaPorNivel
  };
  
  try {
    let response;
    if (decretoId === 'nuevo') {
      // Crear nuevo decreto
      response = await fetch('/api/pde/decretos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      });
    } else {
      // Actualizar decreto existente
      response = await fetch(`/api/pde/decretos/${decretoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      });
    }
    
    const result = await response.json();
    
    if (result.success) {
      mostrarFeedback('success', '✅ Decreto guardado correctamente. Redirigiendo...');
      setTimeout(() => {
        window.location.href = '/admin/decretos';
      }, 1000);
    } else {
      mostrarFeedback('error', '❌ Error al guardar: ' + (result.error || 'Error desconocido'));
      btnGuardar.disabled = false;
      btnGuardar.textContent = '💾 Guardar';
    }
  } catch (error) {
    console.error('Error al guardar decreto:', error);
    mostrarFeedback('error', '❌ Error al guardar el decreto. Por favor, intenta de nuevo.');
    btnGuardar.disabled = false;
    btnGuardar.textContent = '💾 Guardar';
  }
}

/**
 * Muestra feedback al usuario
 */
function mostrarFeedback(tipo, mensaje) {
  const feedback = document.getElementById('feedback');
  const feedbackContent = document.getElementById('feedbackContent');
  
  feedbackContent.className = 'p-3 rounded';
  if (tipo === 'success') {
    feedbackContent.classList.add('bg-green-900', 'text-green-200', 'border', 'border-green-700');
  } else {
    feedbackContent.classList.add('bg-red-900', 'text-red-200', 'border', 'border-red-700');
  }
  
  feedbackContent.textContent = mensaje;
  feedback.classList.remove('hidden');
  
  // Scroll a feedback
  feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Elimina un decreto (soft delete)
 */
async function eliminarDecreto(id) {
  if (!confirm('¿Estás seguro de que quieres eliminar este decreto?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/pde/decretos/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Decreto eliminado correctamente');
      window.location.reload();
    } else {
      alert('Error al eliminar: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error al eliminar decreto:', error);
    alert('Error al eliminar el decreto. Por favor, intenta de nuevo.');
  }
}

/**
 * Sincroniza decretos con Drive y ClickUp
 */
async function sincronizarDecretos() {
  if (!confirm('¿Deseas sincronizar los decretos con Google Drive y ClickUp?')) {
    return;
  }
  
  try {
    const response = await fetch('/api/decretos/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Sincronización completada correctamente');
      window.location.reload();
    } else {
      alert('Sincronización: ' + (result.message || result.error || 'Aún no implementada'));
    }
  } catch (error) {
    console.error('Error al sincronizar decretos:', error);
    alert('Error al sincronizar. Por favor, intenta de nuevo.');
  }
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('Admin Decretos JS cargado');
  
  const decretoId = document.getElementById('decretoId');
  const nivelSelect = document.getElementById('nivelMinimo');
  
  if (!nivelSelect) return;
  
  // Inicializar nivel por defecto persistente solo si es un decreto nuevo
  if (decretoId && decretoId.value === 'nuevo') {
    const defaultLevel = getDefaultLevel('decretos', 9);
    nivelSelect.value = defaultLevel.toString();
  }
  
  // Guardar cuando cambie el nivel (tanto en nuevo como en edición)
  nivelSelect.addEventListener('change', function() {
    const level = parseInt(this.value, 10);
    if (!isNaN(level) && level >= 1) {
      setDefaultLevel('decretos', level);
    }
  });
});
















