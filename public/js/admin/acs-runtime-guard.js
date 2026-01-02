/**
 * ACS-R (Assembly Check Runtime Frontend) v1
 * 
 * Guard que se ejecuta en el navegador al cargar una UI admin
 * para verificar que el runtime frontend está sano antes de permitir interacción.
 * 
 * PRINCIPIO: Si el JS crítico falla, la UI debe mostrar un diagnóstico claro
 * y bloquear interacción (FAIL-HARD visible).
 * 
 * REGLAS CONSTITUCIONALES:
 * - Prohibido innerHTML dinámico (DOM API obligatoria)
 * - Prohibido JSON embebido en <script> (usar application/json o inline object seguro)
 * - FAIL-HARD visible si JS crítico falla
 */

(function() {
  'use strict';

  // Estado del guard
  let isInitialized = false;
  let currentContract = null;
  let errors = [];
  let isBlocked = false;

  /**
   * Lee el contrato por pantalla desde el HTML
   * @returns {Object|null} Contrato o null si no existe
   */
  function readScreenContract() {
    // OPCIÓN 1: JSON embebido como application/json
    const jsonScript = document.getElementById('acs-r-contract');
    if (jsonScript && jsonScript.type === 'application/json') {
      try {
        return JSON.parse(jsonScript.textContent);
      } catch (e) {
        console.error('[ACS-R] Error parseando contrato JSON:', e);
        return null;
      }
    }

    // OPCIÓN 2: Inline object seguro en window
    if (window.__ACS_R_CONTRACT__) {
      return window.__ACS_R_CONTRACT__;
    }

    return null;
  }

  /**
   * Lee build stamp del HTML
   * @returns {Object} { buildId, appVersion } o null
   */
  function readBuildStamp() {
    const buildId = document.documentElement.dataset.buildId || 
                    window.__BUILD__?.buildId || 
                    null;
    const appVersion = document.documentElement.dataset.appVersion || 
                       window.__BUILD__?.appVersion || 
                       null;
    
    return { buildId, appVersion };
  }

  /**
   * Valida build stamp coherente con servidor
   * @returns {Promise<boolean>}
   */
  async function validateBuildStamp() {
    const htmlBuildStamp = readBuildStamp();
    
    if (!htmlBuildStamp.buildId) {
      reportError('BUILD_STAMP_MISSING', {
        message: 'Build stamp no encontrado en HTML'
      });
      return false;
    }

    try {
      const response = await fetch('/__version');
      if (!response.ok) {
        // Endpoint no disponible, solo warning
        console.warn('[ACS-R] Endpoint /__version no disponible');
        return true; // No bloquear si endpoint no está disponible
      }

      const serverVersion = await response.json();
      
      if (htmlBuildStamp.buildId !== serverVersion.build_id) {
        reportError('BUILD_STAMP_MISMATCH', {
          htmlBuildId: htmlBuildStamp.buildId,
          serverBuildId: serverVersion.build_id,
          message: 'Build ID del HTML no coincide con el del servidor (posible cache viejo)'
        });
        return false;
      }

      return true;
    } catch (error) {
      // Error de red, no bloquear
      console.warn('[ACS-R] Error validando build stamp:', error);
      return true; // No bloquear si hay error de red
    }
  }

  /**
   * Valida que handlers críticos estén presentes
   * @param {Object} contract - Contrato por pantalla
   * @returns {boolean}
   */
  function validateHandlers(contract) {
    if (!contract.required_globals || !Array.isArray(contract.required_globals)) {
      return true; // No hay handlers requeridos
    }

    let allPresent = true;

    for (const globalName of contract.required_globals) {
      if (typeof window[globalName] !== 'function' && typeof window[globalName] !== 'object') {
        reportError('MISSING_HANDLER', {
          handler: globalName,
          ui_key: contract.ui_key,
          message: `Handler requerido no encontrado: ${globalName}`
        });
        allPresent = false;
      }
    }

    return allPresent;
  }

  /**
   * Valida que endpoints críticos respondan
   * @param {Object} contract - Contrato por pantalla
   * @returns {Promise<boolean>}
   */
  async function validateEndpoints(contract) {
    if (!contract.required_endpoints || !Array.isArray(contract.required_endpoints)) {
      return true; // No hay endpoints requeridos
    }

    let allOk = true;

    for (const endpoint of contract.required_endpoints) {
      try {
        const response = await fetch(endpoint, { method: 'HEAD' });
        if (!response.ok) {
          reportError('ENDPOINT_ERROR', {
            endpoint,
            status: response.status,
            ui_key: contract.ui_key,
            message: `Endpoint crítico devuelve error: ${endpoint} (${response.status})`
          });
          allOk = false;
        }
      } catch (error) {
        // Error de red, solo warning (no bloquear)
        console.warn(`[ACS-R] Error validando endpoint ${endpoint}:`, error);
        // No reportar como error crítico si es error de red
      }
    }

    return allOk;
  }

  /**
   * Reporta un error
   * @param {string} errorType - Tipo de error
   * @param {Object} details - Detalles del error
   */
  function reportError(errorType, details) {
    const error = {
      type: errorType,
      ...details,
      timestamp: new Date().toISOString(),
      trace_id: window.__TRACE_ID__ || null
    };

    errors.push(error);
    console.error('[ACS-R] Error detectado:', error);

    // Si es modo estricto, bloquear UI
    if (currentContract && currentContract.strict_mode !== false) {
      blockUI();
    }
  }

  /**
   * Bloquea la UI y muestra panel de diagnóstico
   */
  function blockUI() {
    if (isBlocked) {
      return; // Ya está bloqueado
    }

    isBlocked = true;
    showDiagnosticPanel();
    
    // Intentar reportar al servidor (opcional, fail-open)
    reportToServer().catch(() => {
      // Ignorar errores de reporte
    });
  }

  /**
   * Muestra panel de diagnóstico (DOM API, sin innerHTML)
   */
  function showDiagnosticPanel() {
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.id = 'acs-r-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Crear panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;

    // Título
    const title = document.createElement('h2');
    title.textContent = '⚠️ Error de Runtime Frontend';
    title.style.cssText = 'margin: 0 0 16px 0; color: #dc3545;';
    panel.appendChild(title);

    // Información de build
    const buildInfo = document.createElement('div');
    buildInfo.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 4px;';
    const buildStamp = readBuildStamp();
    buildInfo.innerHTML = `
      <strong>Build Info:</strong><br>
      App Version: ${buildStamp.appVersion || 'N/A'}<br>
      Build ID: ${buildStamp.buildId || 'N/A'}<br>
      UI Key: ${currentContract?.ui_key || 'N/A'}
    `;
    panel.appendChild(buildInfo);

    // Errores
    const errorsDiv = document.createElement('div');
    errorsDiv.style.cssText = 'margin-bottom: 16px;';
    const errorsTitle = document.createElement('h3');
    errorsTitle.textContent = 'Errores detectados:';
    errorsTitle.style.cssText = 'margin: 0 0 8px 0; font-size: 16px;';
    errorsDiv.appendChild(errorsTitle);

    errors.forEach((error, index) => {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #fef2f2; border-left: 4px solid #dc3545; border-radius: 4px;';
      
      const errorType = document.createElement('strong');
      errorType.textContent = `[${error.type}]`;
      errorType.style.cssText = 'display: block; margin-bottom: 4px; color: #dc3545;';
      errorDiv.appendChild(errorType);

      const errorMsg = document.createElement('div');
      errorMsg.textContent = error.message || JSON.stringify(error, null, 2);
      errorMsg.style.cssText = 'font-size: 14px; color: #721c24; white-space: pre-wrap;';
      errorDiv.appendChild(errorMsg);

      errorsDiv.appendChild(errorDiv);
    });

    panel.appendChild(errorsDiv);

    // Acciones
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display: flex; gap: 8px;';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copiar diagnóstico';
    copyBtn.style.cssText = `
      padding: 8px 16px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    copyBtn.onclick = () => {
      const diagnostic = JSON.stringify({
        ui_key: currentContract?.ui_key,
        build_stamp: buildStamp,
        errors: errors,
        trace_id: window.__TRACE_ID__
      }, null, 2);
      navigator.clipboard.writeText(diagnostic).then(() => {
        copyBtn.textContent = '✅ Copiado';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copiar diagnóstico';
        }, 2000);
      });
    };
    actionsDiv.appendChild(copyBtn);

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '🔄 Hard Refresh';
    refreshBtn.style.cssText = `
      padding: 8px 16px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    refreshBtn.onclick = () => {
      window.location.reload(true);
    };
    actionsDiv.appendChild(refreshBtn);

    panel.appendChild(actionsDiv);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  /**
   * Instala listeners de errores globales
   */
  function installErrorListeners() {
    // window.onerror
    window.addEventListener('error', (event) => {
      if (event.error instanceof SyntaxError) {
        reportError('SYNTAX_ERROR', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        });
      } else {
        // Otros errores, solo log (no bloquear)
        console.error('[ACS-R] Error capturado:', event);
      }
    });

    // unhandledrejection
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason instanceof SyntaxError) {
        reportError('SYNTAX_ERROR_PROMISE', {
          message: event.reason.message,
          stack: event.reason?.stack
        });
      }
    });
  }

  /**
   * Ejecuta todos los checks
   * @returns {Promise<boolean>} true si todos los checks pasan
   */
  async function runRuntimeChecks() {
    if (isInitialized) {
      console.warn('[ACS-R] Ya inicializado, ignorando llamada duplicada');
      return true;
    }

    isInitialized = true;
    errors = [];

    // Instalar listeners de errores primero
    installErrorListeners();

    // Leer contrato
    currentContract = readScreenContract();
    if (!currentContract) {
      console.warn('[ACS-R] No se encontró contrato por pantalla, saltando validaciones');
      return true; // No bloquear si no hay contrato
    }

    console.log('[ACS-R] Iniciando validaciones para UI:', currentContract.ui_key);

    // Check 1: Build stamp
    const buildStampOk = await validateBuildStamp();
    if (!buildStampOk && currentContract.strict_mode !== false) {
      return false;
    }

    // Check 2: Handlers críticos
    const handlersOk = validateHandlers(currentContract);
    if (!handlersOk && currentContract.strict_mode !== false) {
      return false;
    }

    // Check 3: Endpoints críticos (opcional, no bloquea si falla)
    await validateEndpoints(currentContract);

    // Si hay errores y es modo estricto, ya se bloqueó en reportError
    if (errors.length > 0 && currentContract.strict_mode !== false) {
      // Intentar reportar al servidor (opcional, fail-open)
      reportToServer().catch(() => {
        // Ignorar errores de reporte, no bloquear
      });
      return false;
    }

    console.log('[ACS-R] ✅ Todas las validaciones pasaron');
    return true;
  }

  /**
   * Reporta errores al servidor (opcional, fail-open)
   * @returns {Promise<void>}
   */
  async function reportToServer() {
    if (errors.length === 0 || !currentContract) {
      return;
    }

    try {
      const buildStamp = readBuildStamp();
      const report = {
        ui_key: currentContract.ui_key,
        build_id: buildStamp.buildId,
        app_version: buildStamp.appVersion,
        errors: errors,
        timestamp: new Date().toISOString(),
        trace_id: window.__TRACE_ID__ || null
      };

      await fetch('/admin/api/acs/runtime-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      });
    } catch (error) {
      // Fail-open: no bloquear si el endpoint no está disponible
      console.warn('[ACS-R] No se pudo reportar al servidor:', error);
    }
  }

  /**
   * Registra contrato por pantalla (API pública)
   * @param {Object} contract - Contrato por pantalla
   */
  function registerUiRuntimeContract(contract) {
    currentContract = contract;
    window.__ACS_R_CONTRACT__ = contract; // También exponer en window para compatibilidad
  }

  // Exponer API pública
  window.acsRuntimeGuard = {
    init: registerUiRuntimeContract,
    registerUiRuntimeContract: registerUiRuntimeContract,
    runRuntimeChecks: runRuntimeChecks
  };

  // Auto-ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      runRuntimeChecks().catch(error => {
        console.error('[ACS-R] Error ejecutando checks:', error);
      });
    });
  } else {
    // DOM ya está listo
    runRuntimeChecks().catch(error => {
      console.error('[ACS-R] Error ejecutando checks:', error);
    });
  }

})();

