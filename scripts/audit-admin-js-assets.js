#!/usr/bin/env node
/**
 * AUDIT ADMIN JS ASSETS v1.0
 * 
 * ═══════════════════════════════════════════════════════════════
 * PROPÓSITO: VALIDACIÓN DE SINTAXIS JS EN HTML ADMIN
 * ═══════════════════════════════════════════════════════════════
 * 
 * Este script valida que:
 * 1. No hay </script> huérfanos en HTML
 * 2. Todos los <script> tienen su </script> correspondiente
 * 3. Los scripts externos están correctamente formateados
 * 4. No hay HTML servido como JS (validación de magic bytes)
 * 
 * USO:
 *   node scripts/audit-admin-js-assets.js
 *   node scripts/audit-admin-js-assets.js --strict
 *   node scripts/audit-admin-js-assets.js --fix
 * 
 * ═══════════════════════════════════════════════════════════════
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const STRICT_MODE = process.argv.includes('--strict');
const FIX_MODE = process.argv.includes('--fix');
const JSON_OUTPUT = process.argv.includes('--json');

// Archivos y directorios a verificar
const HTML_PATHS = [
  'src/core/html/admin',
  'src/endpoints',
  'src/core/html'
];

const JS_PATHS = [
  'public/js',
  'public/js/admin'
];

const errors = [];
const warnings = [];
const fixed = [];

/**
 * Encuentra todos los archivos HTML en los directorios especificados
 */
function findHTMLFiles() {
  const files = [];
  
  function walkDir(dir, basePath = projectRoot) {
    const fullPath = join(basePath, dir);
    if (!existsSync(fullPath)) return;
    
    try {
      const entries = readdirSync(fullPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullEntryPath = join(fullPath, entry.name);
        if (entry.isDirectory()) {
          walkDir(join(dir, entry.name), basePath);
        } else if (entry.isFile() && extname(entry.name) === '.html') {
          files.push(fullEntryPath);
        }
      }
    } catch (err) {
      // Ignorar errores de lectura
    }
  }
  
  for (const path of HTML_PATHS) {
    walkDir(path);
  }
  
  return files;
}

/**
 * Encuentra todos los archivos JS en los directorios especificados
 */
function findJSFiles() {
  const files = [];
  
  function walkDir(dir, basePath = projectRoot) {
    const fullPath = join(basePath, dir);
    if (!existsSync(fullPath)) return;
    
    try {
      const entries = readdirSync(fullPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullEntryPath = join(fullPath, entry.name);
        if (entry.isDirectory()) {
          walkDir(join(dir, entry.name), basePath);
        } else if (entry.isFile() && extname(entry.name) === '.js') {
          files.push(fullEntryPath);
        }
      }
    } catch (err) {
      // Ignorar errores de lectura
    }
  }
  
  for (const path of JS_PATHS) {
    walkDir(path);
  }
  
  return files;
}

/**
 * Valida que los tags <script> estén balanceados
 */
function validateScriptTags(content, filePath) {
  const issues = [];
  
  // Buscar todos los <script> y </script>
  const scriptOpenRegex = /<script[^>]*>/gi;
  const scriptCloseRegex = /<\/script>/gi;
  
  const openMatches = [...content.matchAll(scriptOpenRegex)];
  const closeMatches = [...content.matchAll(scriptCloseRegex)];
  
  // Verificar balance
  if (openMatches.length !== closeMatches.length) {
    issues.push({
      type: 'unbalanced_scripts',
      message: `Scripts desbalanceados: ${openMatches.length} <script> vs ${closeMatches.length} </script>`,
      line: null
    });
  }
  
  // Verificar </script> huérfanos (sin <script> antes)
  let openCount = 0;
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineOpenMatches = [...line.matchAll(scriptOpenRegex)];
    const lineCloseMatches = [...line.matchAll(scriptCloseRegex)];
    
    openCount += lineOpenMatches.length;
    openCount -= lineCloseMatches.length;
    
    // Si hay un </script> pero no hay <script> abierto, es huérfano
    if (lineCloseMatches.length > 0 && openCount < 0) {
      issues.push({
        type: 'orphan_closing_script',
        message: `</script> huérfano encontrado (sin <script> correspondiente)`,
        line: i + 1,
        content: line.trim()
      });
    }
  }
  
  // VALIDACIÓN NUEVA: Detectar textContent/innerHTML pasados directamente a console.* sin sanitizar
  // Buscar patrones como: console.*({ ... textPreview: sidebarText.substring(...) ... })
  const unsafeConsolePattern = /console\.(log|warn|error|info)\s*\([^)]*(?:textContent|innerHTML|textPreview)\s*:\s*[^,}]*\.(substring|slice|replace)\([^)]*\)[^)]*\)/gi;
  const unsafeMatches = [...content.matchAll(unsafeConsolePattern)];
  
  for (const match of unsafeMatches) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    issues.push({
      type: 'unsafe_console_logging',
      message: `textContent/innerHTML pasado directamente a console.* sin sanitizar (puede romper parser JS)`,
      line: lineNum,
      content: match[0].substring(0, 100)
    });
  }
  
  // Verificar scripts externos mal formateados
  for (const match of openMatches) {
    const scriptTag = match[0];
    const hasSrc = scriptTag.includes('src=');
    const hasClosing = scriptTag.endsWith('/>') || scriptTag.includes('</script>');
    
    // Script externo debe tener src y cerrarse correctamente
    if (hasSrc && !hasClosing) {
      // Verificar que el siguiente </script> esté en la misma línea o cerca
      const tagIndex = match.index;
      const nextClose = content.indexOf('</script>', tagIndex);
      if (nextClose === -1 || nextClose > tagIndex + 200) {
        issues.push({
          type: 'malformed_external_script',
          message: `Script externo mal formateado: ${scriptTag.substring(0, 50)}...`,
          line: content.substring(0, match.index).split('\n').length
        });
      }
    }
  }
  
  return issues;
}

/**
 * Valida que un archivo JS no contenga HTML
 */
function validateJSFile(filePath) {
  const issues = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const firstBytes = content.trim().substring(0, 300);
    
    // Verificar magic bytes de HTML
    if (firstBytes.startsWith('<!DOCTYPE') || 
        firstBytes.startsWith('<html') || 
        firstBytes.startsWith('<?xml')) {
      issues.push({
        type: 'html_in_js',
        message: 'Archivo JS contiene HTML (posible HTML servido como JS)',
        line: 1
      });
    }
    
    // Validar sintaxis JS con Node
    try {
      execSync(`node --check "${filePath}"`, { 
        stdio: 'pipe',
        cwd: projectRoot,
        timeout: 5000
      });
    } catch (checkError) {
      issues.push({
        type: 'js_syntax_error',
        message: `Error de sintaxis JS: ${checkError.message.split('\n')[0]}`,
        line: null
      });
    }
  } catch (err) {
    issues.push({
      type: 'read_error',
      message: `No se pudo leer el archivo: ${err.message}`,
      line: null
    });
  }
  
  return issues;
}

/**
 * Intenta corregir problemas comunes
 */
function fixIssues(filePath, issues) {
  if (!FIX_MODE) return false;
  
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  for (const issue of issues) {
    if (issue.type === 'orphan_closing_script') {
      // Eliminar </script> huérfano
      const lines = content.split('\n');
      const lineIndex = issue.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines[lineIndex] = lines[lineIndex].replace(/<\/script>/g, '');
        content = lines.join('\n');
        modified = true;
        fixed.push({
          file: filePath,
          issue: issue.type,
          action: 'removed_orphan_closing_script'
        });
      }
    }
  }
  
  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  
  return false;
}

// Ejecutar auditoría
console.log('[AUDIT_JS_ASSETS] Iniciando auditoría de assets JS/HTML...\n');

// Auditar archivos HTML
const htmlFiles = findHTMLFiles();
console.log(`[AUDIT_JS_ASSETS] Encontrados ${htmlFiles.length} archivos HTML`);

for (const filePath of htmlFiles) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const issues = validateScriptTags(content, filePath);
    
    if (issues.length > 0) {
      for (const issue of issues) {
        const error = {
          file: filePath.replace(projectRoot + '/', ''),
          type: issue.type,
          message: issue.message,
          line: issue.line
        };
        
        if (issue.type === 'orphan_closing_script' || issue.type === 'unbalanced_scripts') {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      }
      
      // Intentar corregir
      if (FIX_MODE) {
        fixIssues(filePath, issues);
      }
    }
  } catch (err) {
    warnings.push({
      file: filePath.replace(projectRoot + '/', ''),
      type: 'read_error',
      message: `No se pudo leer: ${err.message}`
    });
  }
}

// Auditar archivos JS
const jsFiles = findJSFiles();
console.log(`[AUDIT_JS_ASSETS] Encontrados ${jsFiles.length} archivos JS`);

for (const filePath of jsFiles) {
  const issues = validateJSFile(filePath);
  
  for (const issue of issues) {
    const error = {
      file: filePath.replace(projectRoot + '/', ''),
      type: issue.type,
      message: issue.message,
      line: issue.line
    };
    
    if (issue.type === 'html_in_js' || issue.type === 'js_syntax_error') {
      errors.push(error);
    } else {
      warnings.push(error);
    }
  }
}

// Reporte
if (JSON_OUTPUT) {
  console.log(JSON.stringify({
    ok: errors.length === 0,
    errors,
    warnings,
    fixed: FIX_MODE ? fixed : [],
    stats: {
      htmlFiles: htmlFiles.length,
      jsFiles: jsFiles.length,
      totalIssues: errors.length + warnings.length
    }
  }, null, 2));
  process.exit(errors.length > 0 ? 1 : 0);
}

// Reporte legible
console.log('\n═══════════════════════════════════════════════════════════');
console.log('RESUMEN DE AUDITORÍA');
console.log('═══════════════════════════════════════════════════════════\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ No se encontraron problemas\n');
  process.exit(0);
}

if (errors.length > 0) {
  console.log(`❌ ERRORES CRÍTICOS: ${errors.length}\n`);
  for (const error of errors) {
    console.log(`  [${error.type}] ${error.file}${error.line ? `:${error.line}` : ''}`);
    console.log(`    ${error.message}\n`);
  }
}

if (warnings.length > 0) {
  console.log(`⚠️  ADVERTENCIAS: ${warnings.length}\n`);
  for (const warning of warnings.slice(0, 10)) {
    console.log(`  [${warning.type}] ${warning.file}${warning.line ? `:${warning.line}` : ''}`);
    console.log(`    ${warning.message}\n`);
  }
  if (warnings.length > 10) {
    console.log(`  ... y ${warnings.length - 10} más\n`);
  }
}

if (FIX_MODE && fixed.length > 0) {
  console.log(`🔧 CORREGIDOS: ${fixed.length}\n`);
  for (const fix of fixed) {
    console.log(`  ${fix.file}: ${fix.action}\n`);
  }
}

console.log('═══════════════════════════════════════════════════════════\n');

// Exit code
if (STRICT_MODE && (errors.length > 0 || warnings.length > 0)) {
  process.exit(1);
} else if (errors.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

