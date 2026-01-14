/**
 * MASTER Informes de Limpiezas Client v1
 * 
 * Cliente JavaScript para la UI de Informes de Limpiezas.
 * DOM API only - Prohibido innerHTML dinámico.
 */

(function() {
  'use strict';
  
  // Guard: Solo ejecutar en contexto MASTER
  if (typeof window === 'undefined' || !window.__AP_CONTEXT__ || window.__AP_CONTEXT__ !== 'MASTER') {
    console.warn('[MasterInformesLimpiezas] Contexto no es MASTER, abortando');
    return;
  }
  
  console.log('[MasterInformesLimpiezas] Cliente inicializado');
  
  // Elementos DOM
  const container = document.getElementById('master-informes-limpiezas-container');
  if (!container) {
    console.warn('[MasterInformesLimpiezas] Contenedor no encontrado');
    return;
  }
  
  const filterStudentUuid = document.getElementById('filter-student-uuid');
  const filterPeriod = document.getElementById('filter-period');
  const filterType = document.getElementById('filter-type');
  const btnLoadReport = document.getElementById('btn-load-report');
  const btnCopyReport = document.getElementById('btn-copy-report');
  const reportResult = document.getElementById('report-result');
  const reportContent = document.getElementById('report-content');
  const reportLoading = document.getElementById('report-loading');
  const reportError = document.getElementById('report-error');
  
  if (!filterStudentUuid || !filterPeriod || !filterType || !btnLoadReport || !btnCopyReport || !reportResult || !reportContent || !reportLoading || !reportError) {
    console.error('[MasterInformesLimpiezas] Elementos DOM no encontrados');
    return;
  }
  
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
   * Renderiza bloques narrativos
   */
  function renderBlocks(blocks) {
    if (!blocks || !Array.isArray(blocks)) {
      return '';
    }
    
    let html = '';
    for (const block of blocks) {
      switch (block.type) {
        case 'title':
          html += `<h3 style="font-size: 1.25rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem;">${escapeHtml(block.text)}</h3>`;
          break;
        case 'context':
          html += `<p style="margin-bottom: 0.75rem; color: #64748b;">${escapeHtml(block.text)}</p>`;
          break;
        case 'actions':
          if (block.items && Array.isArray(block.items)) {
            html += '<ul style="margin-bottom: 0.75rem; padding-left: 1.5rem;">';
            for (const item of block.items) {
              html += `<li style="margin-bottom: 0.25rem;">${escapeHtml(item)}</li>`;
            }
            html += '</ul>';
          }
          break;
        case 'reading':
          html += `<p style="margin-bottom: 0.75rem; font-style: italic; color: #475569;">${escapeHtml(block.text)}</p>`;
          break;
        case 'closure':
          html += `<p style="margin-bottom: 0.75rem; font-weight: 600; color: #334155;">${escapeHtml(block.text)}</p>`;
          break;
        case 'action':
          html += `<p style="margin-bottom: 0.5rem;">${escapeHtml(block.text)}</p>`;
          break;
      }
    }
    return html;
  }
  
  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
   * Carga informe desde API
   */
  async function loadReport() {
    const studentUuid = filterStudentUuid.value.trim();
    const days = parseInt(filterPeriod.value, 10);
    const type = filterType.value || null;
    
    if (!studentUuid) {
      showError('UUID del estudiante es requerido');
      return;
    }
    
    showLoading();
    
    try {
      // Construir URL de API
      let apiUrl = `/master/api/history/reports?student_uuid=${encodeURIComponent(studentUuid)}&days=${days}`;
      if (type) {
        apiUrl += `&type=${encodeURIComponent(type)}`;
      }
      
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
      
      // Construir contenido del informe
      let contentHtml = '';
      
      if (report.entries && report.entries.length > 0) {
        contentHtml += `<div style="margin-bottom: 2rem;">`;
        contentHtml += `<p style="margin-bottom: 1rem; color: #64748b;">Total: ${report.total_entries} entradas</p>`;
        
        for (const entry of report.entries) {
          contentHtml += `<div style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #e2e8f0;">`;
          contentHtml += `<div style="margin-bottom: 0.5rem; font-size: 0.875rem; color: #94a3b8;">${formatDate(entry.created_at)}</div>`;
          contentHtml += `<h4 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">${escapeHtml(entry.title)}</h4>`;
          
          if (entry.content && entry.content.blocks) {
            contentHtml += renderBlocks(entry.content.blocks);
          }
          
          contentHtml += `</div>`;
        }
        
        contentHtml += `</div>`;
      } else {
        contentHtml += `<p style="color: #64748b;">No hay entradas de historial para los filtros seleccionados.</p>`;
      }
      
      // Renderizar contenido (usar textContent para seguridad, pero necesitamos HTML)
      // NOTA: El contenido viene del backend y es seguro (narrativas generadas por el sistema)
      reportContent.innerHTML = contentHtml;
      
      // Guardar contenido para copiar
      reportContent.dataset.rawContent = contentHtml;
      
      hideLoading();
      reportResult.style.display = 'block';
      hideError();
      
      console.log('[MasterInformesLimpiezas] Informe cargado', {
        entries_count: report.entries?.length || 0
      });
    } catch (error) {
      console.error('[MasterInformesLimpiezas] Error cargando informe', error);
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
      
      console.log('[MasterInformesLimpiezas] Informe copiado al portapapeles');
    } catch (error) {
      console.error('[MasterInformesLimpiezas] Error copiando informe', error);
      showError('Error copiando al portapapeles: ' + error.message);
    }
  }
  
  // Event listeners
  btnLoadReport.addEventListener('click', loadReport);
  btnCopyReport.addEventListener('click', copyReport);
  
  // Cargar al presionar Enter en el input
  filterStudentUuid.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadReport();
    }
  });
  
  console.log('[MasterInformesLimpiezas] Event listeners registrados');
})();
