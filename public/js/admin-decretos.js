// public/js/admin-decretos.js
// Funcionalidad JavaScript para la gestión de decretos en el admin

/**
 * Guarda un decreto (crear o actualizar)
 */
async function guardarDecreto(event) {
  event.preventDefault();
  
  const decretoId = document.getElementById('decretoId').value;
  const nombre = document.getElementById('nombre').value;
  const contenidoHtml = document.getElementById('contenidoHtml').value;
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
    alert('Error en el formato JSON de obligatoriedad por nivel. Usa formato: {"1": true, "2": false}');
    return;
  }
  
  const datos = {
    nombre,
    contenido_html: contenidoHtml,
    nivel_minimo: nivelMinimo,
    posicion,
    obligatoria_global: obligatoriaGlobal,
    obligatoria_por_nivel: obligatoriaPorNivel
  };
  
  try {
    let response;
    if (decretoId === 'nuevo') {
      // Crear nuevo decreto
      response = await fetch('/api/decretos/crear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      });
    } else {
      // Actualizar decreto existente
      datos.id = parseInt(decretoId);
      response = await fetch('/api/decretos/actualizar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      });
    }
    
    const result = await response.json();
    
    if (result.success) {
      alert('Decreto guardado correctamente');
      window.location.href = '/admin/decretos';
    } else {
      alert('Error al guardar: ' + (result.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error al guardar decreto:', error);
    alert('Error al guardar el decreto. Por favor, intenta de nuevo.');
  }
}

/**
 * Elimina un decreto (soft delete)
 */
async function eliminarDecreto(id) {
  if (!confirm('¿Estás seguro de que quieres eliminar este decreto?')) {
    return;
  }
  
  try {
    const response = await fetch('/api/decretos/eliminar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id })
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
});















