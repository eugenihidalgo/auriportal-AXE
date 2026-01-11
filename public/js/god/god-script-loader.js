/**
 * GOD SCRIPT LOADER v1 - AuriPortal God
 * 
 * Loader canónico que carga scripts requeridos desde el contrato.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - El contrato manda (god-layout-registry.v1.json)
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
 * ║ ⚠️  GOD RULE: no HTML in JS strings (constitutional)                         ║
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
      console.error('[GodScriptLoader] ❌ Error cargando asset-runtime-registry:', error);
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
      console.error('[GodScriptLoader] ❌ Error cargando asset-versioning:', error);
      // No continuar - versionado es obligatorio
      throw new Error('Asset versioning es obligatorio y no se pudo cargar');
    }
  }
  return assetVersioning;
}

// Guard idempotente
if (window.__AP_GOD_SCRIPT_LOADER_LOADED__) {
  console.warn('[GodScriptLoader] Ya cargado, ignorando carga duplicada');
} else {
  window.__AP_GOD_SCRIPT_LOADER_LOADED__ = true;
  
  /**
   * Preflight: valida que el asset es válido antes de cargar
   * Verifica: status OK, Content-Type correcto, no es HTML
   * @param {string} url - URL del asset
   * @returns {Promise<{ok: boolean, content_type?: string, first_bytes?: string, error?: string}>}
   */
  async function preflightAsset(url) {
    try {
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
      if (contentType && contentType.includes('text/html')) {
        return {
          ok: false,
          content_type: contentType,
          error: `Content-Type es HTML: ${contentType}`
        };
      }
      
      // Sniff primeros bytes para detectar HTML servido como JS
      let firstBytes = '';
      try {
        if (finalResponse.body) {
          const reader = finalResponse.body.getReader();
          const { value, done } = await reader.read();
          if (!done && value) {
            const textDecoder = new TextDecoder();
            firstBytes = textDecoder.decode(value.slice(0, 200));
            reader.cancel();
            
            const trimmed = firstBytes.trim();
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
        console.warn('[ASSETS][GOD] Error en sniff de contenido:', sniffError);
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
   */
  async function loadScript(scriptDef) {
    const { id, path: src, type = 'module', critical = false, name } = scriptDef;
    const registryModule = await getAssetRegistryModule();
    
    // OBLIGATORIO: Aplicar versionado canónico al path
    const versioningModule = await getAssetVersioningModule();
    const versionedSrc = versioningModule.withAssetVersion(src);
    
    console.log(`[ASSETS][GOD] Versionando asset: ${src} → ${versionedSrc}`);
    
    // Marcar inicio en registry
    if (registryModule) {
      registryModule.markAssetStart({
        id,
        url: versionedSrc,
        name: name || id,
        expected_type: 'js',
        critical
      });
    }
    
    // Preflight: validar antes de cargar
    const preflight = await preflightAsset(versionedSrc);
    if (!preflight.ok) {
      const errorInfo = {
        reason: preflight.error || 'Preflight failed',
        content_type: preflight.content_type,
        first_bytes_sniff: preflight.first_bytes
      };
      
      if (registryModule) {
        registryModule.markAssetFailure(id, errorInfo);
        
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
      const existingScript = document.querySelector(`script[src="${versionedSrc}"]`);
      if (existingScript) {
        console.log(`[GodScriptLoader] Script ya cargado: ${versionedSrc}`);
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
      script.src = versionedSrc;
      script.type = type;
      script.async = false; // Carga secuencial
      
      script.onload = () => {
        console.log(`[GodScriptLoader] ✅ Script cargado: ${versionedSrc}`);
        if (registryModule) {
          registryModule.markAssetSuccess(id, {
            content_type: preflight.content_type,
            first_bytes_sniff: preflight.first_bytes
          });
        }
        resolve();
      };
      
      script.onerror = (error) => {
        const errorMsg = `Error cargando script: ${versionedSrc}`;
        console.error(`[GodScriptLoader] ❌ ${errorMsg}`, error);
        
        if (registryModule) {
          const errorInfo = {
            reason: `Script load error: ${error.message || 'unknown'}`,
            content_type: preflight.content_type,
            first_bytes_sniff: preflight.first_bytes
          };
          
          registryModule.markAssetFailure(id, errorInfo);
          
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
      
      const body = document.body || document.documentElement;
      body.appendChild(script);
    });
  }
  
  /**
   * Carga todos los scripts requeridos desde el contrato
   */
  async function loadRequiredScripts(requiredScripts) {
    if (!Array.isArray(requiredScripts) || requiredScripts.length === 0) {
      console.error('[GodScriptLoader] ❌ required_scripts no válido o vacío');
      return;
    }
    
    console.log(`[ASSETS][GOD] Cargando ${requiredScripts.length} script(s) desde contrato...`);
    console.log(`[ASSETS][GOD] BUILD_ID: ${window.__AP_BUILD_ID__ || 'unknown'}, APP_VERSION: ${window.__AP_APP_VERSION__ || 'unknown'}`);
    
    const loadedScriptIds = [];
    const failedScriptIds = [];
    let criticalFailure = false;
    
    // Cargar scripts secuencialmente
    for (const scriptDef of requiredScripts) {
      if (!scriptDef.path && !scriptDef.src) {
        console.error(`[ASSETS][GOD] ❌ Script sin path:`, scriptDef);
        continue;
      }
      
      if (scriptDef.required === false) {
        console.log(`[ASSETS][GOD] ⏭️  Script opcional omitido: ${scriptDef.id}`);
        continue;
      }
      
      if (criticalFailure && scriptDef.critical) {
        console.error(`[ASSETS][GOD] ⛔ Abortando carga restante debido a fallo crítico previo`);
        failedScriptIds.push(scriptDef.id);
        continue;
      }
      
      try {
        await loadScript(scriptDef);
        loadedScriptIds.push(scriptDef.id);
        console.log(`[ASSETS][GOD] ✅ ${scriptDef.id} cargado correctamente`);
      } catch (error) {
        console.error(`[ASSETS][GOD] ❌ FALLO: No se pudo cargar script: ${scriptDef.id} (${scriptDef.path || scriptDef.src})`);
        console.error(`[ASSETS][GOD] Error:`, error.message);
        failedScriptIds.push(scriptDef.id);
        
        if (scriptDef.critical) {
          criticalFailure = true;
          console.error(`[ASSETS][GOD] ⛔ FALLO CRÍTICO: ${scriptDef.id} - abortando carga restante`);
        }
      }
    }
    
    console.log(`[ASSETS][GOD] ✅ Carga de scripts completada (${loadedScriptIds.length} ok, ${failedScriptIds.length} failed)`);
    
    // Emitir evento global cuando TODOS los scripts requeridos se hayan cargado
    window.__AP_GOD_SCRIPTS_READY_EMITTED__ = true;
    
    if (failedScriptIds.length === 0) {
      window.dispatchEvent(
        new CustomEvent('AP_GOD_SCRIPTS_READY', {
          detail: {
            scripts: loadedScriptIds,
            allLoaded: true
          }
        })
      );
      console.log('[ASSETS][GOD] 📢 Evento AP_GOD_SCRIPTS_READY emitido (todos cargados)');
    } else {
      console.error(`[ASSETS][GOD] ⚠️  Algunos scripts fallaron: ${failedScriptIds.join(', ')}`);
      window.dispatchEvent(
        new CustomEvent('AP_GOD_SCRIPTS_READY', {
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
      console.warn('[GodScriptLoader] document no disponible, esperando...');
      return;
    }
    
    // Leer required_scripts del contrato (inyectado en HTML como JSON)
    const requiredScripts = window.__AP_GOD_REQUIRED_SCRIPTS__;
    
    if (!requiredScripts) {
      console.error('[GodScriptLoader] ❌ CONTRATO NO ENCONTRADO: window.__AP_GOD_REQUIRED_SCRIPTS__ no está definido');
      console.error('[GodScriptLoader] El contrato debe inyectarse en el HTML antes de cargar este script');
      return;
    }
    
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        loadRequiredScripts(requiredScripts);
      });
    } else {
      loadRequiredScripts(requiredScripts);
    }
  }
  
  // Auto-inicializar
  initScriptLoader();
}
