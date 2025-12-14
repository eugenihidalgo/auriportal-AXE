// public/js/error-handler.js
// Script para capturar y suprimir errores de extensiones del navegador

/**
 * Maneja errores de extensiones del navegador que no afectan la funcionalidad
 * del sitio web. Específicamente captura errores relacionados con:
 * - inject_main.js (scripts inyectados por extensiones)
 * - Listeners asíncronos de mensajes que no responden
 * - Service Workers y mensajes entre contextos
 */
(function() {
  'use strict';

  // Lista de patrones de errores a suprimir (errores de extensiones)
  const extensionErrorPatterns = [
    /A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received/i,
    /inject_main\.js/i,
    /Extension context invalidated/i,
    /message channel closed/i,
    /chrome-extension:/i,
    /moz-extension:/i,
    /safari-extension:/i,
    /Could not establish connection/i,
    /Receiving end does not exist/i
  ];

  /**
   * Verifica si un error es de una extensión del navegador
   */
  function isExtensionError(error, message, filename) {
    if (!error && !message && !filename) return false;
    
    const errorString = [
      error ? (error.toString() + ' ' + (error.message || '') + ' ' + (error.stack || '')) : '',
      message || '',
      filename || ''
    ].join(' ').toLowerCase();
    
    return extensionErrorPatterns.some(pattern => pattern.test(errorString));
  }

  /**
   * Handler para errores no capturados
   * Se ejecuta en la fase de captura (true) para interceptar antes que otros handlers
   */
  window.addEventListener('error', function(event) {
    // Verificar si el error proviene de una extensión
    const isExtError = isExtensionError(
      event.error, 
      event.message, 
      event.filename
    ) || 
    (event.filename && (
      event.filename.includes('inject_main.js') ||
      event.filename.includes('chrome-extension://') ||
      event.filename.includes('moz-extension://') ||
      event.filename.includes('safari-extension://')
    ));
    
    if (isExtError) {
      // Suprimir el error completamente
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
    
    // Permitir que otros errores se muestren normalmente
    return true;
  }, true); // true = fase de captura (antes que otros handlers)

  /**
   * Handler para promesas rechazadas no capturadas
   */
  window.addEventListener('unhandledrejection', function(event) {
    // Verificar si el error de la promesa es de una extensión
    const reason = event.reason;
    let errorMessage = '';
    let errorStack = '';
    
    if (reason) {
      if (typeof reason === 'string') {
        errorMessage = reason;
      } else if (reason instanceof Error) {
        errorMessage = reason.message || '';
        errorStack = reason.stack || '';
      } else if (reason.message) {
        errorMessage = reason.message;
        errorStack = reason.stack || '';
      }
    }
    
    const isExtError = isExtensionError(
      reason,
      errorMessage,
      ''
    ) || extensionErrorPatterns.some(p => 
      p.test(errorMessage) || p.test(errorStack)
    );
    
    if (isExtError) {
      // Suprimir el error
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
    
    // Permitir que otros errores de promesas se muestren normalmente
    return true;
  }, true); // true = fase de captura

  // También interceptar console.error para errores de extensiones
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const errorString = args.join(' ').toLowerCase();
    const isExtError = extensionErrorPatterns.some(p => p.test(errorString)) ||
                       errorString.includes('inject_main.js') ||
                       errorString.includes('chrome-extension://') ||
                       errorString.includes('moz-extension://');
    
    if (!isExtError) {
      // Llamar al console.error original solo si no es error de extensión
      originalConsoleError.apply(console, args);
    }
    // Si es error de extensión, simplemente no hacer nada (suprimir)
  };

  // Log opcional (solo en modo desarrollo)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🛡️ Error handler de extensiones activado');
  }
})();





