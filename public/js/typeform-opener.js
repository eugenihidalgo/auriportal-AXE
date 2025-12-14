// Script global para abrir Typeforms
// Se carga en todas las pantallas del portal

(function() {
  'use strict';
  
  // Función para abrir Typeforms
  function openTypeformInApp(event, url) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Abrir en la misma ventana
    console.log('📱 Abriendo Typeform:', url);
    window.location.href = url;
  }
  
  // Hacer función global
  window.openTypeformInApp = openTypeformInApp;
  
  // Interceptar todos los enlaces a Typeforms y aplicar la función automáticamente
  document.addEventListener('DOMContentLoaded', function() {
    // Buscar todos los enlaces que apuntan a Typeforms
    const typeformLinks = document.querySelectorAll('a[href*="typeform.com"]');
    
    typeformLinks.forEach(link => {
      // Si no tiene onclick personalizado, agregar el nuestro
      if (!link.onclick && !link.getAttribute('onclick')) {
        const href = link.getAttribute('href');
        if (href && href.includes('typeform.com')) {
          link.addEventListener('click', function(e) {
            openTypeformInApp(e, href);
          });
          
          // Remover target="_blank" si existe
          if (link.getAttribute('target') === '_blank') {
            link.removeAttribute('target');
            link.removeAttribute('rel');
          }
        }
      }
    });
    
    console.log(`✅ ${typeformLinks.length} enlaces a Typeforms configurados`);
  });
  
  // También interceptar clics dinámicos
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href*="typeform.com"]');
    if (link && !link.hasAttribute('data-typeform-handled')) {
      const href = link.getAttribute('href');
      if (href && href.includes('typeform.com')) {
        // Solo interceptar si no tiene onclick personalizado
        if (!link.onclick && !link.getAttribute('onclick')) {
          e.preventDefault();
          e.stopPropagation();
          link.setAttribute('data-typeform-handled', 'true');
          openTypeformInApp(e, href);
        }
      }
    }
  }, true); // Usar capture phase para interceptar antes
  
})();

