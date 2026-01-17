/**
 * MASTER UI TOAST v1 - Helper común para toasts no bloqueantes
 * 
 * REGLAS:
 * - DOM API only (prohibido innerHTML dinámico)
 * - Position: bottom-right
 * - Success: 2s auto-dismiss, verde
 * - Error: 3s auto-dismiss, rojo
 * - Queue simple: stacking vertical si hay múltiples
 * 
 * USO:
 * import { showToastSuccess, showToastError } from './ui/toast.js';
 */

(function() {
  'use strict';

  // Container global para toasts (se crea al primer uso)
  let toastContainer = null;

  /**
   * Obtiene o crea el contenedor de toasts
   */
  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'ap-toast-container';
      toastContainer.style.cssText = 'position: fixed; bottom: 1rem; right: 1rem; z-index: 10000; display: flex; flex-direction: column; gap: 0.5rem; max-width: 400px; pointer-events: none;';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  /**
   * Muestra un toast de éxito (verde, 2s)
   */
  window.showToastSuccess = function(message) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.style.cssText = 'background: #10b981; color: #fff; padding: 0.75rem 1rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-size: 0.875rem; font-weight: 500; pointer-events: auto; opacity: 0; transition: opacity 0.2s ease-in;';
    toast.textContent = message;
    container.appendChild(toast);
    
    // Fade in
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    // Auto-dismiss después de 2s
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease-out';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2000);
  };

  /**
   * Muestra un toast de error (rojo, 3s)
   */
  window.showToastError = function(message) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.style.cssText = 'background: #ef4444; color: #fff; padding: 0.75rem 1rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-size: 0.875rem; font-weight: 500; pointer-events: auto; opacity: 0; transition: opacity 0.2s ease-in;';
    toast.textContent = message;
    container.appendChild(toast);
    
    // Fade in
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    // Auto-dismiss después de 3s
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease-out';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  /**
   * Muestra un toast de advertencia (amarillo, 3s)
   */
  window.showToastWarning = function(message) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.style.cssText = 'background: #f59e0b; color: #fff; padding: 0.75rem 1rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-size: 0.875rem; font-weight: 500; pointer-events: auto; opacity: 0; transition: opacity 0.2s ease-in;';
    toast.textContent = message;
    container.appendChild(toast);
    
    // Fade in
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    // Auto-dismiss después de 3s
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease-out';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  // Log de inicialización
  if (typeof window !== 'undefined' && window.__AP_CONTEXT__ === 'MASTER') {
    console.log('[MASTER][UI][TOAST] Helper inicializado');
  }

})();