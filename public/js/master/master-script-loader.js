/**
 * MASTER SCRIPT LOADER v1 - AuriPortal Master
 * 
 * Loader canónico que carga scripts requeridos desde el contrato.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - El contrato manda (master-layout-registry.v1.json)
 * - El layout NO decide scripts
 * - El guard NO infiere
 * - El loader es la única capa que ejecuta scripts declarados en contrato
 * 
 * RESPONSABILIDAD ÚNICA:
 * - Leer required_scripts del contrato (inyectado en HTML)
 * - Cargar scripts de forma determinista
 * - Garantizar ejecución única
 * - Respetar orden declarado en el contrato
 * - Validar preflight (Content-Type, sniff HTML)
 * - Registrar estado en Asset Runtime Registry
 * - Mostrar overlay en fallos críticos
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  MASTER RULE: no HTML in JS strings (constitutional)                     ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                   ║
 * ║ ❌ innerHTML                                                                 ║
 * ║ ❌ eval                                                                      ║
 * ║ ❌ template strings HTML                                                    ║
 * ║                                                                              ║
 * ║ OBLIGATORIO:                                                                 ║
 * ║ ✅ DOM API (createElement, appendChild)                                     ║
 * ║ ✅ Carga secuencial con promesas                                             ║
 * ║ ✅ Logging de errores claros                                                ║
 * ║ ✅ Preflight validation (Content-Type, HTML sniff)                          ║
 * ║ ✅ Asset Runtime Registry                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// Importar Asset Runtime Registry (carga dinámica para evitar dependencia circular)
let assetRegistry = null;
async function getAssetRegistryModule() {
  if (!assetRegistry) {
    try {
      assetRegistry = await import('/js/shared/asset-runtime-registry.js');
    } catch (error) {
      console.error('[MasterScriptLoader] ❌ Error cargando asset-runtime-registry:', error);
      // Continuar sin registry (modo degradado)
    }
  }
  return assetRegistry;
}

// Importar Asset Versioning (carga dinámica)
let assetVersioning = null;
async function getAssetVersioningModule() {
  if (!assetVersioning) {
    try {
      assetVersioning = await import('/js/shared/asset-versioning.js');
    } catch (error) {
      console.error('[MasterScriptLoader] ❌ Error cargando asset-versioning:', error);
      // No continuar - versionado es obligatorio
      throw new Error('Asset versioning es obligatorio y no se pudo cargar');
    }
  }
  return assetVersioning;
}

// Guard idempotente
if (window.__AP_MASTER_SCRIPT_LOADER_LOADED__) {
  console.warn('[MasterScriptLoader] Ya cargado, ignorando carga duplicada');
} else {
  window.__AP_MASTER_SCRIPT_LOADER_LOADED__ = true;
  
  /**
   * Preflight: valida que el asset es válido antes de cargar
   * Verifica: status OK, Content-Type correcto, no es HTML
   * @param {string} url - URL del asset
   * @returns {Promise<{ok: boolean, content_type?: string, first_bytes?: string, error?: string}>}
   */
  async function preflightAsset(url) {
    try {
      // Para v1, usamos GET directamente porque necesitamos leer primeros bytes para sniff HTML
      // En el futuro, podríamos optimizar usando HEAD + GET condicional
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout
      
      let finalResponse;
      try {
        finalResponse = await fetch(url, { 
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal 
        });
        clearTimeout(timeout);
      } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          return {
            ok: false,
            error: 'Timeout en preflight (3s)'
          };
        }
        throw err;
      }
      
      // Validar status
      if (!finalResponse.ok || finalResponse.status < 200 || finalResponse.status >= 300) {
        return {
          ok: false,
          error: `Status ${finalResponse.status}: ${finalResponse.statusText}`
        };
      }
      
      // Validar Content-Type
      const contentType = finalResponse.headers.get('content-type') || '';
      if (!contentType.includes('javascript') && !contentType.includes('application/javascript') && !contentType.includes('text/javascript')) {
        // Permitir sin Content-Type explícito (algunos servidores no lo envían)
        // Pero si existe y no es JS, es sospechoso
        if (contentType && contentType.includes('text/html')) {
          return {
            ok: false,
            content_type: contentType,
            error: `Content-Type es HTML: ${contentType}`
          };
        }
      }
      
      // Sniff primeros bytes para detectar HTML servido como JS
      let firstBytes = '';
      try {
        if (finalResponse.body) {
          const reader = finalResponse.body.getReader();
          const { value, done } = await reader.read();
          if (!done && value) {
            // Leer primeros 200 bytes (suficiente para detectar HTML)
            const textDecoder = new TextDecoder();
            firstBytes = textDecoder.decode(value.slice(0, 200));
            reader.cancel(); // Cancelar lectura restante
            
            // Normalizar: remover espacios/whitespace al inicio
            const trimmed = firstBytes.trim();
            
            // Detectar HTML
            if (trimmed.startsWith('<!') || 
                trimmed.startsWith('<html') || 
                trimmed.startsWith('<!DOCTYPE') ||
                trimmed.toLowerCase().includes('<html') ||
                trimmed.toLowerCase().includes('<!doctype')) {
              return {
                ok: false,
                content_type: contentType,
                first_bytes: firstBytes.substring(0, 100),
                error: 'Contenido parece HTML en lugar de JavaScript'
              };
            }
          }
        }
      } catch (sniffError) {
        // Si falla el sniff, continuar (no crítico si Content-Type es correcto)
        console.warn('[ASSETS][MASTER] Error en sniff de contenido:', sniffError);
      }
      
      return {
        ok: true,
        content_type: contentType || 'unknown',
        first_bytes: firstBytes.substring(0, 100)
      };
    } catch (error) {
      return {
        ok: false,
        error: `Error en preflight: ${error.message}`
      };
    }
  }
  
  /**
   * Carga un script de forma determinista con preflight y registry
   * @param {Object} scriptDef - Definición del script
   * @param {string} scriptDef.id - ID del script
   * @param {string} scriptDef.path - Path del script
   * @param {string} scriptDef.type - Tipo del script (default: 'module')
   * @param {boolean} scriptDef.critical - Si es crítico
   * @param {string} scriptDef.name - Nombre del script
   * @returns {Promise<void>} Promesa que se resuelve cuando el script se carga
   */
  async function loadScript(scriptDef) {
    const { id, path: src, type = 'module', critical = false, name } = scriptDef;
    const registryModule = await getAssetRegistryModule();
    
    // OBLIGATORIO: Aplicar versionado canónico al path
    const versioningModule = await getAssetVersioningModule();
    const versionedSrc = versioningModule.withAssetVersion(src);
    
    console.log(`[ASSETS][MASTER] Versionando asset: ${src} → ${versionedSrc}`);
    
    // Marcar inicio en registry (usar URL versionada)
    if (registryModule) {
      registryModule.markAssetStart({
        id,
        url: versionedSrc,
        name: name || id,
        expected_type: 'js',
        critical
      });
    }
    
    // Preflight: validar antes de cargar (usar URL versionada)
    const preflight = await preflightAsset(versionedSrc);
    if (!preflight.ok) {
      const errorInfo = {
        reason: preflight.error || 'Preflight failed',
        content_type: preflight.content_type,
        first_bytes_sniff: preflight.first_bytes
      };
      
      // Marcar fallo en registry
      if (registryModule) {
        registryModule.markAssetFailure(id, errorInfo);
        
        // Si es crítico, mostrar overlay
        if (critical) {
          const registry = registryModule.getAssetRegistry();
          registryModule.renderAssetFailureOverlay({
            asset_name: name || id,
            url: versionedSrc,
            reason: errorInfo.reason,
            content_type: errorInfo.content_type,
            domain_context: registry.domain_context,
            app_version: registry.app_version,
            build_id: registry.build_id
          });
        }
      }
      
      throw new Error(`Preflight failed: ${errorInfo.reason}`);
    }
    
    return new Promise((resolve, reject) => {
      // Verificar si el script ya está cargado (usar URL versionada)
      const existingScript = document.querySelector(`script[src="${versionedSrc}"]`);
      if (existingScript) {
        console.log(`[MasterScriptLoader] Script ya cargado: ${versionedSrc}`);
        // Marcar éxito en registry (ya estaba cargado)
        if (registryModule) {
          registryModule.markAssetSuccess(id, {
            content_type: preflight.content_type,
            first_bytes_sniff: preflight.first_bytes
          });
        }
        resolve();
        return;
      }
      
      // Crear elemento script usando DOM API (NO innerHTML)
      const script = document.createElement('script');
      script.src = versionedSrc; // USAR URL VERSIONADA
      script.type = type;
      script.async = false; // Carga secuencial
      
      // Manejar carga exitosa
      script.onload = () => {
        console.log(`[MasterScriptLoader] ✅ Script cargado: ${versionedSrc}`);
        // Marcar éxito en registry
        if (registryModule) {
          registryModule.markAssetSuccess(id, {
            content_type: preflight.content_type,
            first_bytes_sniff: preflight.first_bytes
          });
        }
        resolve();
      };
      
      // Manejar errores
      script.onerror = (error) => {
        const errorMsg = `Error cargando script: ${versionedSrc}`;
        console.error(`[MasterScriptLoader] ❌ ${errorMsg}`, error);
        
        // Marcar fallo en registry
        if (registryModule) {
          const errorInfo = {
            reason: `Script load error: ${error.message || 'unknown'}`,
            content_type: preflight.content_type,
            first_bytes_sniff: preflight.first_bytes
          };
          
          registryModule.markAssetFailure(id, errorInfo);
          
          // Si es crítico, mostrar overlay
          if (critical) {
            const registry = registryModule.getAssetRegistry();
            registryModule.renderAssetFailureOverlay({
              asset_name: name || id,
              url: versionedSrc,
              reason: errorInfo.reason,
              content_type: errorInfo.content_type,
              domain_context: registry.domain_context,
              app_version: registry.app_version,
              build_id: registry.build_id
            });
          }
        }
        
        reject(new Error(errorMsg));
      };
      
      // Añadir al DOM (antes de </body>)
      const body = document.body || document.documentElement;
      body.appendChild(script);
    });
  }
  
  /**
   * Carga todos los scripts requeridos desde el contrato
   * @param {Array} requiredScripts - Array de scripts del contrato (normalizados a objetos)
   */
  async function loadRequiredScripts(requiredScripts) {
    if (!Array.isArray(requiredScripts) || requiredScripts.length === 0) {
      console.error('[MasterScriptLoader] ❌ required_scripts no válido o vacío');
      return;
    }
    
    console.log(`[ASSETS][MASTER] Cargando ${requiredScripts.length} script(s) desde contrato...`);
    
    const loadedScriptIds = [];
    const failedScriptIds = [];
    let criticalFailure = false;
    
    // Cargar scripts secuencialmente (respetar orden del contrato)
    for (const scriptDef of requiredScripts) {
      if (!scriptDef.path && !scriptDef.src) {
        console.error(`[ASSETS][MASTER] ❌ Script sin path:`, scriptDef);
        continue;
      }
      
      if (scriptDef.required === false) {
        console.log(`[ASSETS][MASTER] ⏭️  Script opcional omitido: ${scriptDef.id}`);
        continue;
      }
      
      // Si hubo fallo crítico, abortar resto (overlay ya mostrado)
      if (criticalFailure && scriptDef.critical) {
        console.error(`[ASSETS][MASTER] ⛔ Abortando carga restante debido a fallo crítico previo`);
        failedScriptIds.push(scriptDef.id);
        continue;
      }
      
      try {
        await loadScript(scriptDef);
        loadedScriptIds.push(scriptDef.id);
        console.log(`[ASSETS][MASTER] ✅ ${scriptDef.id} cargado correctamente`);
      } catch (error) {
        // No fallar silenciosamente - loguear error claro
        console.error(`[ASSETS][MASTER] ❌ FALLO: No se pudo cargar script: ${scriptDef.id} (${scriptDef.path || scriptDef.src})`);
        console.error(`[ASSETS][MASTER] Error:`, error.message);
        failedScriptIds.push(scriptDef.id);
        
        // Si es crítico, marcar y abortar resto (overlay ya fue mostrado por loadScript)
        if (scriptDef.critical) {
          criticalFailure = true;
          console.error(`[ASSETS][MASTER] ⛔ FALLO CRÍTICO: ${scriptDef.id} - abortando carga restante`);
        }
      }
    }
    
    console.log(`[ASSETS][MASTER] ✅ Carga de scripts completada (${loadedScriptIds.length} ok, ${failedScriptIds.length} failed)`);
    
    // RUNTIME CORE v1: Verificar si el runtime está BROKEN después de cargar scripts
    if (window.__AP_RUNTIME_READY__ && window.__AP_RUNTIME_READY__.state() === 'broken') {
      console.error('[ASSETS][MASTER] ⛔ RUNTIME BROKEN detectado después de cargar scripts');
      const runtimeError = window.__AP_RUNTIME_READY__.error;
      
      // Mostrar banner fijo en DOM (sin frameworks, DOM API only)
      const banner = document.createElement('div');
      banner.id = 'ap-runtime-broken-banner';
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #dc3545;
        color: white;
        padding: 16px;
        text-align: center;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      banner.textContent = `⚠️ RUNTIME BROKEN: ${runtimeError?.message || 'Error desconocido'}`;
      document.body.appendChild(banner);
      
      // Bloquear clicks en botones con data-action-id
      document.addEventListener('click', function(e) {
        if (e.target && (e.target.hasAttribute('data-action-id') || e.target.closest('[data-action-id]'))) {
          e.preventDefault();
          e.stopPropagation();
          alert('Runtime está BROKEN. No se pueden ejecutar acciones. Por favor, recarga la página.');
          return false;
        }
      }, true); // Use capture phase
      
      console.error('[ASSETS][MASTER] ⛔ Banner de RUNTIME BROKEN mostrado y clicks bloqueados');
    }
    
    // Emitir evento global cuando TODOS los scripts requeridos se hayan cargado
    // Este evento es la señal canónica de que el loader terminó
    // El ACS Guard escucha este evento para validar
    // Marcar que el evento se emitió (para caso edge: guard carga después)
    window.__AP_MASTER_SCRIPTS_READY_EMITTED__ = true;
    
    if (failedScriptIds.length === 0) {
      // Todos los scripts se cargaron correctamente
      window.dispatchEvent(
        new CustomEvent('AP_MASTER_SCRIPTS_READY', {
          detail: {
            scripts: loadedScriptIds,
            allLoaded: true
          }
        })
      );
      console.log('[ASSETS][MASTER] 📢 Evento AP_MASTER_SCRIPTS_READY emitido (todos cargados)');
    } else {
      // Algunos scripts fallaron - emitir evento con información de fallos
      console.error(`[ASSETS][MASTER] ⚠️  Algunos scripts fallaron: ${failedScriptIds.join(', ')}`);
      window.dispatchEvent(
        new CustomEvent('AP_MASTER_SCRIPTS_READY', {
          detail: {
            scripts: loadedScriptIds,
            failed: failedScriptIds,
            allLoaded: false,
            criticalFailure
          }
        })
      );
    }
  }
  
  /**
   * Inicializa el loader
   */
  function initScriptLoader() {
    if (typeof document === 'undefined') {
      console.warn('[MasterScriptLoader] document no disponible, esperando...');
      return;
    }
    
    // Leer required_scripts del contrato (inyectado en HTML como JSON)
    // El contrato se inyecta como: window.__AP_MASTER_REQUIRED_SCRIPTS__
    const requiredScripts = window.__AP_MASTER_REQUIRED_SCRIPTS__;
    
    if (!requiredScripts) {
      console.error('[MasterScriptLoader] ❌ CONTRATO NO ENCONTRADO: window.__AP_MASTER_REQUIRED_SCRIPTS__ no está definido');
      console.error('[MasterScriptLoader] El contrato debe inyectarse en el HTML antes de cargar este script');
      return;
    }
    
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        loadRequiredScripts(requiredScripts);
      });
    } else {
      // DOM ya listo, cargar inmediatamente
      loadRequiredScripts(requiredScripts);
    }
  }
  
  // Auto-inicializar
  initScriptLoader();
}

