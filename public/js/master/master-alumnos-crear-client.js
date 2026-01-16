/**
 * MASTER ALUMNOS CREAR CLIENT v1
 * 
 * Cliente JavaScript canónico para la UI de Crear Alumnos en dominio MASTER.
 * 
 * REGLAS ABSOLUTAS:
 * - Prohibido innerHTML, template literals con HTML, concatenación de strings HTML
 * - Usar SOLO DOM API (createElement, textContent, appendChild, etc.)
 * - Validar email (required, trim, lowercase)
 * - POST al endpoint /master/api/students
 * - Mostrar toast de éxito con display_name
 * - Limpiar formulario tras éxito
 * 
 * CONTRATO:
 * - Se ejecuta cuando window.__AP_CONTEXT__ === 'MASTER'
 * - Bootstrap autoejecutable con guards
 */

(function() {
  'use strict';

  // CLIENT SENTINEL: Log al cargar el módulo
  console.log('[MASTER][ALUMNOS_CREAR] client loaded', {
    time: Date.now(),
    context: window.__AP_CONTEXT__,
    readyState: document.readyState
  });

  // Guard: Verificar contexto MASTER y contenedor
  if (typeof window === 'undefined' || window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterAlumnosCrear] No ejecutando en contexto no-MASTER');
    return;
  }

  const rootContainer = document.getElementById('master-alumnos-crear-root');
  if (!rootContainer) {
    console.warn('[MASTER][ALUMNOS_CREAR] root not found');
    return;
  }

  // Toast helpers: se cargan desde /js/master/ui/toast.js (common helper)
  // showToastSuccess y showToastError están disponibles globalmente

  // CLIENT SENTINEL: Insertar bloque visible para confirmar que el script se ejecutó
  try {
    const clientSentinel = document.createElement('div');
    clientSentinel.id = 'ap-client-sentinel';
    clientSentinel.style.cssText = 'background: #10b981; color: #000; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-family: monospace; margin-bottom: 0.5rem; border-radius: 0.25rem;';
    clientSentinel.textContent = 'CLIENT_SENTINEL: booted';
    
    // Insertar después del server sentinel si existe, sino al inicio
    const serverSentinel = document.getElementById('ap-sentinel');
    if (serverSentinel && serverSentinel.nextSibling) {
      rootContainer.insertBefore(clientSentinel, serverSentinel.nextSibling);
    } else {
      rootContainer.insertBefore(clientSentinel, rootContainer.firstChild);
    }
  } catch (sentinelError) {
    console.error('[MASTER][ALUMNOS_CREAR] Error creando client sentinel:', sentinelError);
  }

  /**
   * Inicialización
   */
  function init() {
    console.log('[MasterAlumnosCrear] Inicializando...');
    
    const form = document.getElementById('crear-alumno-form');
    if (!form) {
      console.error('[MasterAlumnosCrear] Formulario no encontrado');
      return;
    }
    
    form.addEventListener('submit', handleFormSubmit);
    
    console.log('[MasterAlumnosCrear] Inicializado correctamente');
  }

  /**
   * Maneja el envío del formulario
   * LEGACY: handleFormSubmit usa fetch() directo (creación de alumno, fuera del scope actual de limpieza).
   * TODO: Migrar a performAction('alumnos.create') cuando se registre acción de creación.
   */
  async function handleFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const emailInput = document.getElementById('email');
    const apodoInput = document.getElementById('apodo');
    const nombreCompletoInput = document.getElementById('nombre_completo');
    const submitButton = document.getElementById('crear-alumno-btn');
    
    if (!emailInput || !submitButton) {
      console.error('[MasterAlumnosCrear] Campos del formulario no encontrados');
      return;
    }
    
    // Validar email (required, trim, lowercase)
    const email = emailInput.value.trim().toLowerCase();
    if (!email) {
      console.error('[MasterAlumnosCrear] Email es obligatorio');
      if (typeof window.showToastError === 'function') {
        window.showToastError('Email es obligatorio');
      }
      emailInput.focus();
      return;
    }
    
    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('[MasterAlumnosCrear] Email inválido');
      if (typeof window.showToastError === 'function') {
        window.showToastError('Email inválido');
      }
      emailInput.focus();
      return;
    }
    
    const apodo = apodoInput ? apodoInput.value.trim() : null;
    const nombreCompleto = nombreCompletoInput ? nombreCompletoInput.value.trim() : null;
    
    // Deshabilitar botón mientras se procesa
    submitButton.disabled = true;
    submitButton.textContent = 'Creando...';
    
    try {
      console.log('[MasterAlumnosCrear] Creando alumno:', { email, apodo, nombre_completo });
      
      // POST al endpoint /master/api/students
      const response = await fetch('/master/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          apodo: apodo || undefined,
          nombre_completo: nombre_completo || undefined
        })
      });
      
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error?.message || result.error || 'Error creando alumno');
      }
      
      console.log('[MasterAlumnosCrear] Alumno creado exitosamente:', result);
      
      // Mostrar toast de éxito con display_name
      const displayName = result.data?.display_name || email;
      if (typeof window.showToastSuccess === 'function') {
        window.showToastSuccess(`✓ ${displayName} creado exitosamente`);
      }
      
      // Limpiar formulario tras éxito
      form.reset();
      emailInput.focus();
      
    } catch (error) {
      console.error('[MasterAlumnosCrear] Error creando alumno:', error);
      
      if (typeof window.showToastError === 'function') {
        window.showToastError(`Error: ${error.message}`);
      }
    } finally {
      // Rehabilitar botón
      submitButton.disabled = false;
      submitButton.textContent = 'Crear Alumno';
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
