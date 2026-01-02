/**
 * ROBUSTNESS DIAGNOSTICS v1
 * 
 * Banner debug opcional con trace_id/version en todas las páginas admin.
 * 
 * PRINCIPIO:
 * En modo MASTER, mostrar información de diagnóstico visible.
 */

(function() {
  'use strict';
  
  // Solo ejecutar en modo debug o si AP_SHOW_DIAGNOSTICS=1
  const showDiagnostics = window.location.search.includes('?debug') || 
    document.cookie.includes('ap_show_diagnostics=1') ||
    localStorage.getItem('ap_show_diagnostics') === '1';
  
  if (!showDiagnostics) {
    return;
  }
  
  // Obtener trace_id del request (si está disponible en meta tag o data attribute)
  let traceId = null;
  const traceMeta = document.querySelector('meta[name="trace-id"]');
  if (traceMeta) {
    traceId = traceMeta.getAttribute('content');
  }
  
  // Obtener versión (si está disponible)
  const versionMeta = document.querySelector('meta[name="app-version"]');
  const buildMeta = document.querySelector('meta[name="build-id"]');
  const appVersion = versionMeta ? versionMeta.getAttribute('content') : 'unknown';
  const buildId = buildMeta ? buildMeta.getAttribute('content') : 'unknown';
  
  // Crear banner diagnóstico
  const banner = document.createElement('div');
  banner.id = 'robustness-diagnostics-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    padding: 8px 16px;
    font-size: 11px;
    font-family: monospace;
    z-index: 9999;
    border-top: 1px solid #444;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  `;
  
  const leftDiv = document.createElement('div');
  leftDiv.style.cssText = 'display: flex; gap: 16px; align-items: center; flex-wrap: wrap;';
  
  if (appVersion !== 'unknown') {
    const versionSpan = document.createElement('span');
    versionSpan.textContent = `v${appVersion}`;
    versionSpan.style.cssText = 'color: #4ade80;';
    leftDiv.appendChild(versionSpan);
  }
  
  if (buildId !== 'unknown') {
    const buildSpan = document.createElement('span');
    buildSpan.textContent = `build:${buildId.substring(0, 7)}`;
    buildSpan.style.cssText = 'color: #94a3b8;';
    leftDiv.appendChild(buildSpan);
  }
  
  if (traceId) {
    const traceSpan = document.createElement('span');
    traceSpan.textContent = `trace:${traceId.substring(0, 8)}`;
    traceSpan.style.cssText = 'color: #60a5fa; cursor: pointer;';
    traceSpan.title = 'Click para copiar trace_id completo';
    traceSpan.onclick = () => {
      navigator.clipboard.writeText(traceId).then(() => {
        traceSpan.textContent = '✓ copiado';
        setTimeout(() => {
          traceSpan.textContent = `trace:${traceId.substring(0, 8)}`;
        }, 1000);
      });
    };
    leftDiv.appendChild(traceSpan);
  }
  
  const rightDiv = document.createElement('div');
  rightDiv.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Ocultar';
  toggleBtn.style.cssText = `
    background: transparent;
    border: 1px solid #444;
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
  `;
  toggleBtn.onclick = () => {
    banner.style.display = 'none';
    localStorage.setItem('ap_show_diagnostics', '0');
  };
  rightDiv.appendChild(toggleBtn);
  
  banner.appendChild(leftDiv);
  banner.appendChild(rightDiv);
  
  // Añadir al body
  document.body.appendChild(banner);
  
  // Manejar errores JS globales
  window.addEventListener('error', (event) => {
    console.error('[ROBUSTNESS] Error JS detectado:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      trace_id: traceId
    });
    
    // Mostrar notificación en banner
    const errorSpan = document.createElement('span');
    errorSpan.textContent = '⚠️ Error JS detectado';
    errorSpan.style.cssText = 'color: #f87171; margin-left: 12px;';
    errorSpan.title = event.message;
    leftDiv.appendChild(errorSpan);
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[ROBUSTNESS] Promesa rechazada no manejada:', {
      reason: event.reason,
      trace_id: traceId
    });
    
    const errorSpan = document.createElement('span');
    errorSpan.textContent = '⚠️ Promise rejected';
    errorSpan.style.cssText = 'color: #f87171; margin-left: 12px;';
    errorSpan.title = String(event.reason);
    leftDiv.appendChild(errorSpan);
  });
})();





