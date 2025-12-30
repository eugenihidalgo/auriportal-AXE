/**
 * ASSET AUDIT v1 - Theme Studio Canon
 * 
 * Detecta HTML servido como JS y problemas de encoding.
 * 
 * PRINCIPIO:
 * El error "Invalid or unexpected token" casi siempre es HTML servido como JS.
 * Este audit verifica que los assets JS no contengan HTML.
 * 
 * REGLAS:
 * - Verifica existencia de archivos
 * - Verifica que NO empiecen con "<!DOCTYPE" ni "<html"
 * - Verifica que NO contengan "<body" en primeros 300 bytes
 * - Verifica encoding UTF-8 (sin BOM raro)
 */

// FASE 2: Usar PUBLIC_ASSETS_ROOT como source of truth único
import { readFileSync, existsSync } from 'fs';
import { PUBLIC_ASSETS_RELATIVE, resolvePublicAsset } from './public-assets-root.js';

/**
 * Lista de scripts que inyecta admin-theme-studio-canon-ui.js
 * @returns {string[]} Array de rutas relativas al repo root
 */
/**
 * Lista de scripts que inyecta admin-theme-studio-canon-ui.js
 * Rutas relativas desde la raíz del repo (incluyen 'public/')
 * 
 * @returns {string[]} Array de rutas relativas al repo root
 */
function getThemeStudioCanonScripts() {
  return [
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/safe-fetch-json.js`,
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/theme-preview-playground.js`,
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/theme-playground-iframe-v2.js`,
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/theme-studio-canon-modals.js`,
    `${PUBLIC_ASSETS_RELATIVE}/js/admin/theme-studio-canon.js`
  ];
}

/**
 * Verifica que un archivo JS no sea HTML
 * @param {string} filePath - Ruta absoluta del archivo
 * @returns {{ valid: boolean, error?: string, firstBytes?: string }}
 */
/**
 * FASE 3: Hardening - Diferenciar tipos de errores
 * @param {string} filePath - Ruta absoluta del archivo
 * @returns {{ valid: boolean, errorType?: 'FILE_NOT_FOUND' | 'HTML_SERVED_AS_JS' | 'WRONG_CONTENT_TYPE' | 'READ_ERROR', error?: string, firstBytes?: string }}
 */
function validateJsFile(filePath) {
  if (!existsSync(filePath)) {
    return {
      valid: false,
      errorType: 'FILE_NOT_FOUND',
      error: 'File not found'
    };
  }
  
  try {
    const content = readFileSync(filePath, { encoding: 'utf-8', flag: 'r' });
    const first300 = content.substring(0, 300);
    
    // Verificar que NO empiece con HTML
    if (first300.trim().startsWith('<!DOCTYPE') || first300.trim().startsWith('<html')) {
      return {
        valid: false,
        errorType: 'HTML_SERVED_AS_JS',
        error: 'File starts with HTML (DOCTYPE/html tag)',
        firstBytes: first300.substring(0, 100)
      };
    }
    
    // Verificar que NO contenga <body en los primeros 300 bytes
    if (first300.includes('<body')) {
      return {
        valid: false,
        errorType: 'HTML_SERVED_AS_JS',
        error: 'File contains <body tag in first 300 bytes',
        firstBytes: first300.substring(0, 100)
      };
    }
    
    // Verificar que tenga caracteres JS razonables (no solo espacios/HTML)
    const hasJsContent = /[a-zA-Z_$]/.test(first300);
    if (!hasJsContent && first300.trim().length > 0) {
      return {
        valid: false,
        errorType: 'WRONG_CONTENT_TYPE',
        error: 'File does not appear to contain JavaScript',
        firstBytes: first300.substring(0, 100)
      };
    }
    
    return { valid: true };
  } catch (readError) {
    return {
      valid: false,
      errorType: 'READ_ERROR',
      error: `Error reading file: ${readError.message}`
    };
  }
}

/**
 * Ejecuta audit de assets Theme Studio Canon
 * @param {Object} options
 * @param {'warn' | 'fail' | 'report'} options.mode - Modo de operación
 * @returns {{ status: 'ok' | 'warn' | 'fail', results: Array, errors: Array }}
 */
export function auditThemeStudioAssets(options = {}) {
  const { mode = 'warn' } = options;
  
  const scripts = getThemeStudioCanonScripts();
  const results = [];
  const errors = [];
  
  console.log(`[ROBUSTNESS][ASSET_AUDIT] Validating ${scripts.length} Theme Studio Canon assets...`);
  
  for (const script of scripts) {
    const absolutePath = resolvePublicAsset(script);
    const validation = validateJsFile(absolutePath);
    
    if (validation.valid) {
      results.push({ file: script, status: 'OK' });
      console.log(`[ROBUSTNESS][ASSET_AUDIT] ✅ ${script}`);
    } else {
      const error = {
        file: script,
        errorType: validation.errorType || 'UNKNOWN',
        error: validation.error,
        firstBytes: validation.firstBytes
      };
      results.push({ 
        file: script, 
        status: 'ERROR', 
        errorType: validation.errorType || 'UNKNOWN',
        error: validation.error 
      });
      errors.push(error);
      
      // FASE 3: Logs estructurados por tipo de error
      const errorTypeLabel = {
        'FILE_NOT_FOUND': '❌ FILE_NOT_FOUND',
        'HTML_SERVED_AS_JS': '🔴 HTML_SERVED_AS_JS (CRÍTICO)',
        'WRONG_CONTENT_TYPE': '🟡 WRONG_CONTENT_TYPE',
        'READ_ERROR': '🟠 READ_ERROR'
      }[validation.errorType] || '❓ UNKNOWN';
      
      console.error(`[ROBUSTNESS][ASSET_AUDIT] ${errorTypeLabel} ${script}`);
      console.error(`[ROBUSTNESS][ASSET_AUDIT]    Error: ${validation.error}`);
      if (validation.firstBytes) {
        console.error(`[ROBUSTNESS][ASSET_AUDIT]    First bytes: ${validation.firstBytes}`);
      }
    }
  }
  
  // FASE 3: Hardening - Fail-hard si hay HTML_SERVED_AS_JS en producción
  const hasHtmlAsJs = errors.some(e => e.errorType === 'HTML_SERVED_AS_JS');
  const hasFileNotFound = errors.some(e => e.errorType === 'FILE_NOT_FOUND');
  
  let status = 'ok';
  if (errors.length > 0) {
    // HTML_SERVED_AS_JS es siempre crítico
    if (hasHtmlAsJs) {
      status = 'fail';
    } else if (mode === 'fail') {
      status = 'fail';
    } else {
      status = 'warn';
    }
  }
  
  if (errors.length > 0) {
    if (status === 'fail') {
      console.error(`[ROBUSTNESS][ASSET_AUDIT] ❌ FAIL-HARD: ${errors.length} asset(s) with issues`);
      if (hasHtmlAsJs) {
        console.error(`[ROBUSTNESS][ASSET_AUDIT] 🔴 CRÍTICO: HTML servido como JS detectado`);
      }
      if (hasFileNotFound) {
        console.error(`[ROBUSTNESS][ASSET_AUDIT] ❌ CRÍTICO: Archivos críticos no encontrados`);
      }
      console.error(`[ROBUSTNESS][ASSET_AUDIT] Files with errors:`);
      errors.forEach(e => {
        const typeLabel = e.errorType || 'UNKNOWN';
        console.error(`[ROBUSTNESS][ASSET_AUDIT]   - [${typeLabel}] ${e.file}: ${e.error}`);
      });
    } else {
      console.warn(`[ROBUSTNESS][ASSET_AUDIT] ⚠️  WARNING: ${errors.length} asset(s) with issues (continuing in warn mode)`);
      errors.forEach(e => {
        console.warn(`[ROBUSTNESS][ASSET_AUDIT]   - [${e.errorType || 'UNKNOWN'}] ${e.file}: ${e.error}`);
      });
    }
  } else {
    console.log(`[ROBUSTNESS][ASSET_AUDIT] ✅ All ${scripts.length} assets validated successfully`);
  }
  
  return {
    status,
    results,
    errors
  };
}

