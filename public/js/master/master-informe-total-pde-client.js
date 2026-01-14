/**
 * MASTER Informe Total PDE Client v1
 * 
 * Cliente JavaScript para la UI de Informe Total PDE.
 * DOM API only - Prohibido innerHTML dinámico (excepto contenido del backend).
 */

(function() {
  'use strict';
  
  // Guard: Solo ejecutar en contexto MASTER
  if (typeof window === 'undefined' || !window.__AP_CONTEXT__ || window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterInformeTotalPDE] Contexto no es MASTER, abortando');
    return;
  }
  
  console.log('[MasterInformeTotalPDE] Cliente inicializado');
  
  // Elementos DOM
  const container = document.getElementById('master-informe-total-pde-container');
  if (!container) {
    console.warn('[MasterInformeTotalPDE] Contenedor no encontrado');
    return;
  }
  
  const filterDate = document.getElementById('filter-date');
  const btnLoadReport = document.getElementById('btn-load-report');
  const btnCopyReport = document.getElementById('btn-copy-report');
  const reportResult = document.getElementById('report-result');
  const reportContent = document.getElementById('report-content');
  const reportLoading = document.getElementById('report-loading');
  const reportError = document.getElementById('report-error');
  
  if (!filterDate || !btnLoadReport || !btnCopyReport || !reportResult || !reportContent || !reportLoading || !reportError) {
    console.error('[MasterInformeTotalPDE] Elementos DOM no encontrados');
    return;
  }
  
  // Inicializar fecha a hoy
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  filterDate.value = today.toISOString().split('T')[0];
  
  /**
   * Muestra error
   */
  function showError(message) {
    reportError.textContent = message || 'Error desconocido';
    reportError.style.display = 'block';
    reportResult.style.display = 'none';
    reportLoading.style.display = 'none';
  }
  
  /**
   * Oculta error
   */
  function hideError() {
    reportError.style.display = 'none';
  }
  
  /**
   * Muestra loading
   */
  function showLoading() {
    reportLoading.style.display = 'block';
    reportResult.style.display = 'none';
    hideError();
  }
  
  /**
   * Oculta loading
   */
  function hideLoading() {
    reportLoading.style.display = 'none';
  }
  
  /**
   * Renderiza bloques narrativos usando DOM API
   */
  function renderBlocks(blocks, container) {
    if (!blocks || !Array.isArray(blocks)) {
      return;
    }
    
    for (const block of blocks) {
      switch (block.type) {
        case 'title':
          const titleEl = document.createElement('h3');
          titleEl.style.fontSize = '1.25rem';
          titleEl.style.fontWeight = '600';
          titleEl.style.marginTop = '1rem';
          titleEl.style.marginBottom = '0.5rem';
          titleEl.textContent = block.text || '';
          container.appendChild(titleEl);
          break;
          
        case 'context':
          const contextEl = document.createElement('p');
          contextEl.style.marginBottom = '0.75rem';
          contextEl.style.color = '#64748b';
          contextEl.textContent = block.text || '';
          container.appendChild(contextEl);
          break;
          
        case 'actions':
          if (block.items && Array.isArray(block.items)) {
            const listEl = document.createElement('ul');
            listEl.style.marginBottom = '0.75rem';
            listEl.style.paddingLeft = '1.5rem';
            
            for (const item of block.items) {
              const itemEl = document.createElement('li');
              itemEl.style.marginBottom = '0.25rem';
              itemEl.textContent = item;
              listEl.appendChild(itemEl);
            }
            
            container.appendChild(listEl);
          }
          break;
          
        case 'reading':
          const readingEl = document.createElement('p');
          readingEl.style.marginBottom = '0.75rem';
          readingEl.style.fontStyle = 'italic';
          readingEl.style.color = '#475569';
          readingEl.textContent = block.text || '';
          container.appendChild(readingEl);
          break;
          
        case 'closure':
          const closureEl = document.createElement('p');
          closureEl.style.marginBottom = '0.75rem';
          closureEl.style.fontWeight = '600';
          closureEl.style.color = '#334155';
          closureEl.textContent = block.text || '';
          container.appendChild(closureEl);
          break;
          
        case 'action':
          const actionEl = document.createElement('p');
          actionEl.style.marginBottom = '0.5rem';
          actionEl.textContent = block.text || '';
          container.appendChild(actionEl);
          break;
      }
    }
  }
  
  /**
   * Formatea fecha
   */
  function formatDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }
  
  /**
   * Carga informe total desde API
   */
  async function loadReport() {
    const selectedDate = filterDate.value;
    
    if (!selectedDate) {
      showError('Por favor, selecciona una fecha');
      return;
    }
    
    showLoading();
    
    try {
      // Construir URL de API para scope=platform
      // Usar la fecha seleccionada como referencia
      const date = new Date(selectedDate);
      date.setHours(0, 0, 0, 0);
      const days = 1; // Solo el día seleccionado
      
      // Para informe total, usar scope=platform
      let apiUrl = `/master/api/history/reports?scope=platform&scope_ref=global&days=${days}&window=daily`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.ok || !data.data || !data.data.report) {
        throw new Error('Respuesta inválida del servidor');
      }
      
      const report = data.data.report;
      
      // Limpiar contenido previo
      reportContent.innerHTML = '';
      
      if (report.entries && report.entries.length > 0) {
        // Total
        const totalEl = document.createElement('p');
        totalEl.style.marginBottom = '1rem';
        totalEl.style.color = '#64748b';
        totalEl.textContent = `Total: ${report.total_entries} entradas para el ${formatDate(selectedDate)}`;
        reportContent.appendChild(totalEl);
        
        // Entradas
        for (const entry of report.entries) {
          const entryDiv = document.createElement('div');
          entryDiv.style.marginBottom = '2rem';
          entryDiv.style.paddingBottom = '1.5rem';
          entryDiv.style.borderBottom = '1px solid #e2e8f0';
          
          // Fecha
          const dateEl = document.createElement('div');
          dateEl.style.marginBottom = '0.5rem';
          dateEl.style.fontSize = '0.875rem';
          dateEl.style.color = '#94a3b8';
          dateEl.textContent = formatDate(entry.created_at);
          entryDiv.appendChild(dateEl);
          
          // Título
          const titleEl = document.createElement('h4');
          titleEl.style.fontSize = '1.125rem';
          titleEl.style.fontWeight = '600';
          titleEl.style.marginBottom = '0.75rem';
          titleEl.textContent = entry.title || '';
          entryDiv.appendChild(titleEl);
          
          // Bloques narrativos
          if (entry.content && entry.content.blocks) {
            renderBlocks(entry.content.blocks, entryDiv);
          }
          
          reportContent.appendChild(entryDiv);
        }
      } else {
        // Empty state
        const emptyEl = document.createElement('p');
        emptyEl.style.color = '#64748b';
        emptyEl.textContent = `No hay entradas de historial para el ${formatDate(selectedDate)}.`;
        reportContent.appendChild(emptyEl);
      }
      
      hideLoading();
      reportResult.style.display = 'block';
      hideError();
      
      console.log('[MasterInformeTotalPDE] Informe cargado', {
        entries_count: report.entries?.length || 0,
        date: selectedDate
      });
    } catch (error) {
      console.error('[MasterInformeTotalPDE] Error cargando informe', error);
      hideLoading();
      showError(error.message || 'Error cargando informe');
    }
  }
  
  /**
   * Copia informe al portapapeles
   */
  async function copyReport() {
    try {
      // Obtener texto plano del contenido
      const textContent = reportContent.textContent || reportContent.innerText || '';
      
      if (!textContent.trim()) {
        showError('No hay contenido para copiar');
        return;
      }
      
      await navigator.clipboard.writeText(textContent);
      
      // Feedback visual
      const originalText = btnCopyReport.textContent;
      btnCopyReport.textContent = '✓ Copiado';
      btnCopyReport.style.background = '#10b981';
      
      setTimeout(() => {
        btnCopyReport.textContent = originalText;
        btnCopyReport.style.background = '#10b981';
      }, 2000);
      
      console.log('[MasterInformeTotalPDE] Informe copiado al portapapeles');
    } catch (error) {
      console.error('[MasterInformeTotalPDE] Error copiando informe', error);
      showError('Error copiando al portapapeles: ' + error.message);
    }
  }
  
  // Event listeners
  btnLoadReport.addEventListener('click', loadReport);
  btnCopyReport.addEventListener('click', copyReport);
  
  // Cargar informe automáticamente al iniciar
  loadReport();
  
  console.log('[MasterInformeTotalPDE] Event listeners registrados');
})();
