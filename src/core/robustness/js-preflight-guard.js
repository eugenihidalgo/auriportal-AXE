/**
 * JS PRE-FLIGHT GUARD v1
 * 
 * Valida sintaxis de archivos JS críticos ANTES de aceptar servir el sistema.
 * 
 * PRINCIPIO:
 * Un SyntaxError en cualquier asset JS público rompe pantallas y aparece como
 * "Invalid or unexpected token". Este guard previene que el servidor arranque
 * con JS inválido.
 * 
 * REGLAS:
 * - En arranque, ejecuta `node --check` sobre lista de archivos JS críticos
 * - Si falla: modo FAIL-HARD (no arrancar) en PROD; modo WARN en DEV/BETA
 * - Log claro: [ROBUSTNESS][JS_GUARD] con archivo y error
 * 
 * USO:
 * - Integrado en server.js antes de registrar rutas
 * - Config: env AP_JS_GUARD=warn|fail (default: warn en dev/beta, fail en prod)
 */

// FASE 2: Usar PUBLIC_ASSETS_ROOT como source of truth único
// OBJETIVO 1: Importar explícitamente PUBLIC_ASSETS_ROOT para evitar ReferenceError
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolvePublicAsset, PUBLIC_ASSETS_ROOT } from './public-assets-root.js';

/**
 * Ejecuta validación de sintaxis JS sobre un archivo
 * 
 * @param {string} filePath - Ruta absoluta o relativa al repo
 * @returns {{ valid: boolean, error?: string }}
 */
function validateJsSyntax(filePath) {
  // Resolver ruta absoluta usando source of truth único
  const absolutePath = filePath.startsWith('/') 
    ? filePath 
    : resolvePublicAsset(filePath);
  
  // Verificar que el archivo existe
  if (!existsSync(absolutePath)) {
    return {
      valid: false,
      error: `File not found: ${filePath}`
    };
  }
  
  // OBJETIVO 5: Fix bug REPO_ROOT - usar PUBLIC_ASSETS_ROOT
  // Obtener repo root desde public root (eliminar /public del final)
  const REPO_ROOT = PUBLIC_ASSETS_ROOT.replace(/\/public$/, '');
  
  // Ejecutar node --check
  const result = spawnSync('node', ['--check', absolutePath], {
    encoding: 'utf-8',
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  if (result.status === 0) {
    return { valid: true };
  } else {
    const errorOutput = result.stderr || result.stdout || 'Unknown syntax error';
    return {
      valid: false,
      error: errorOutput.trim()
    };
  }
}

/**
 * Ejecuta JS Pre-Flight Guard sobre lista de archivos
 * 
 * @param {Object} options - Opciones de guard
 * @param {string} options.mode - 'warn' | 'fail' (default: 'warn')
 * @param {string[]} options.files - Array de rutas (absolutas o relativas a repo)
 * @returns {{ passed: boolean, results: Array, errors: Array }}
 */
export function runJsPreflightGuard(options = {}) {
  const { mode = 'warn', files = [] } = options;
  
  if (!Array.isArray(files) || files.length === 0) {
    console.warn('[ROBUSTNESS][JS_GUARD] ⚠️  No files provided for validation');
    return {
      passed: true,
      results: [],
      errors: []
    };
  }
  
  console.log(`[ROBUSTNESS][JS_GUARD] Validating ${files.length} JS files...`);
  
  const results = [];
  const errors = [];
  
  for (const file of files) {
    const validation = validateJsSyntax(file);
    
    if (validation.valid) {
      results.push({ file, status: 'OK' });
      console.log(`[ROBUSTNESS][JS_GUARD] ✅ ${file}`);
    } else {
      const error = {
        file,
        error: validation.error
      };
      results.push({ file, status: 'ERROR', error: validation.error });
      errors.push(error);
      console.error(`[ROBUSTNESS][JS_GUARD] ❌ ${file}`);
      console.error(`[ROBUSTNESS][JS_GUARD]    Error: ${validation.error}`);
    }
  }
  
  // Resolver según modo
  const passed = errors.length === 0;
  
  if (!passed) {
    if (mode === 'fail') {
      const errorMsg = `[ROBUSTNESS][JS_GUARD] FAIL-HARD: ${errors.length} JS file(s) with syntax errors`;
      console.error(errorMsg);
      console.error(`[ROBUSTNESS][JS_GUARD] Files with errors:`);
      errors.forEach(e => {
        console.error(`[ROBUSTNESS][JS_GUARD]   - ${e.file}: ${e.error}`);
      });
      throw new Error(errorMsg);
    } else {
      // mode === 'warn'
      console.warn(`[ROBUSTNESS][JS_GUARD] ⚠️  WARNING: ${errors.length} JS file(s) with syntax errors (continuing in warn mode)`);
    }
  } else {
    console.log(`[ROBUSTNESS][JS_GUARD] ✅ All ${files.length} JS files validated successfully`);
  }
  
  return {
    passed,
    results,
    errors
  };
}

