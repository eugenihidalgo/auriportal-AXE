#!/usr/bin/env node
/**
 * CHECK UX ACTION REGISTRY - AuriPortal
 * 
 * Assembly check constitucional que verifica DURAMENTE el uso obligatorio del UX Action Registry v1.
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Ninguna UI nueva puede existir sin UX Action Registry
 * - Ninguna mutación puede hacerse fuera de performAction
 * - El Action Registry es la ÚNICA puerta de intención de usuario
 * 
 * VERIFICA DURAMENTE:
 * A) Que performAction está disponible en runtime
 * B) Que no existan llamadas directas a fetch('/master/api/*') o fetch('/god/api/*')
 * C) Que no existan handlers UI que llamen mark-clean-*, reset-*, etc. directamente
 * D) Que toda acción UI tenga action_id explícito y use performAction()
 * E) Detectar y marcar LEGACY_REFRESH_CALL explícitamente
 * 
 * SALIDA:
 * - Errors = VIOLACIÓN CONSTITUCIONAL (bloquea build)
 * - Warnings = legacy marcado explícitamente (aceptable temporalmente)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Directorios a escanear
const UI_DIRS = [
  join(projectRoot, 'public/js/master'),
  join(projectRoot, 'public/js/god'),
  join(projectRoot, 'public/js/admin')
];

// Patrones prohibidos
const FORBIDDEN_PATTERNS = {
  // Llamadas directas a endpoints API
  fetchMasterApi: /fetch\s*\(\s*['"`]\/master\/api\//g,
  fetchGodApi: /fetch\s*\(\s*['"`]\/god\/api\//g,
  fetchAdminApi: /fetch\s*\(\s*['"`]\/admin\/api\//g,
  
  // Bibliotecas HTTP prohibidas
  axios: /axios\s*\.\s*(get|post|put|delete|patch)/g,
  xhr: /new\s+XMLHttpRequest/g,
  request: /require\s*\(\s*['"](request|node-fetch)/g,
  
  // Handlers prohibidos (llamadas directas a endpoints)
  markClean: /mark-clean-/g,
  markPdeClean: /mark-pde-clean-/g,
  resetItem: /reset-item/g,
  resetList: /reset-list/g,
  incrementAll: /increment-all/g
};

// Patrones aceptables (si están marcados como LEGACY)
const LEGACY_MARKER = /\[LEGACY_REFRESH_CALL\]|\[LEGACY_ACTION_CALL\]/;

let errors = [];
let warnings = [];
let filesScanned = 0;
let violationsFound = 0;

function error(msg, file, line = null) {
  errors.push({ msg, file, line });
  const location = line ? ` (línea ${line})` : '';
  console.error(`❌ ERROR: ${msg}${location}`);
  violationsFound++;
}

function warn(msg, file, line = null) {
  warnings.push({ msg, file, line });
  const location = line ? ` (línea ${line})` : '';
  console.warn(`⚠️  WARNING: ${msg}${location}`);
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

/**
 * Recursivamente escanea directorios buscando archivos JS
 */
function scanDirectory(dir, files = []) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Excluir node_modules y otros directorios irrelevantes
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanDirectory(fullPath, files);
        }
      } else if (entry.isFile() && extname(entry.name) === '.js') {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignorar errores de directorios inexistentes
    if (err.code !== 'ENOENT') {
      warn(`No se pudo escanear ${dir}: ${err.message}`);
    }
  }
  return files;
}

/**
 * Verifica un archivo por violaciones constitucionales
 */
function checkFile(filePath) {
  filesScanned++;
  
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    warn(`No se pudo leer ${filePath}: ${err.message}`);
    return;
  }

  const relativePath = filePath.replace(projectRoot + '/', '');
  const lines = content.split('\n');

  // A) Verificar que performAction está disponible (si el archivo lo usa)
  if (content.includes('performAction') || content.includes('perform-action')) {
    // Verificar que está importado o disponible en window
    const hasImport = content.includes('import') && content.includes('performAction');
    const hasWindow = content.includes('window.performAction');
    const hasPerformActionDef = content.includes('function performAction') || content.includes('const performAction');
    
    if (!hasImport && !hasWindow && !hasPerformActionDef) {
      // Buscar línea donde se usa
      const useLine = lines.findIndex((line, idx) => 
        (line.includes('performAction(') || line.includes('perform-action(')) && 
        !lines.slice(0, idx).some(l => l.includes('import') || l.includes('window.performAction') || l.includes('function performAction'))
      );
      if (useLine !== -1) {
        error(`performAction usado pero no disponible. Debe importarse o estar en window.performAction.`, relativePath, useLine + 1);
      }
    }
  }

  // B) Detectar llamadas directas a endpoints API (PROHIBIDO)
  for (const [patternName, pattern] of Object.entries(FORBIDDEN_PATTERNS)) {
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      const matchIndex = match.index;
      const lineNumber = content.substring(0, matchIndex).split('\n').length;
      const lineContent = lines[lineNumber - 1] || '';
      
      // Verificar si está marcado como LEGACY
      const contextBefore = content.substring(Math.max(0, matchIndex - 500), matchIndex);
      const contextAfter = content.substring(matchIndex, Math.min(content.length, matchIndex + 500));
      const isLegacy = LEGACY_MARKER.test(contextBefore + contextAfter);
      
      if (isLegacy) {
        warn(`${patternName} detectado pero marcado como LEGACY. Debe migrarse a performAction() en el futuro.`, relativePath, lineNumber);
      } else {
        // Verificar si está dentro de una función que ya usa performAction
        const functionStart = content.lastIndexOf('function', matchIndex);
        const functionEnd = content.indexOf('}', matchIndex);
        const functionBody = content.substring(functionStart, functionEnd);
        
        if (!functionBody.includes('performAction') && !functionBody.includes('perform-action')) {
          error(`${patternName} detectado fuera de performAction(). Usa performAction(action_id, payload) en su lugar.`, relativePath, lineNumber);
        }
      }
    }
  }

  // C) Detectar handlers que llaman endpoints directamente (PROHIBIDO)
  const handlerPatterns = [
    /async\s+function\s+handle(\w+)\s*\(/g,
    /function\s+handle(\w+)\s*\(/g,
    /const\s+handle(\w+)\s*=\s*(async\s+)?\(/g
  ];

  for (const handlerPattern of handlerPatterns) {
    const handlers = [...content.matchAll(handlerPattern)];
    for (const handlerMatch of handlers) {
      const handlerName = handlerMatch[0];
      const handlerStart = handlerMatch.index;
      const handlerStartLine = content.substring(0, handlerStart).split('\n').length;
      
      // Buscar cierre de función
      let braceCount = 0;
      let handlerEnd = handlerStart;
      for (let i = handlerStart; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            handlerEnd = i;
            break;
          }
        }
      }
      
      const handlerBody = content.substring(handlerStart, handlerEnd);
      
      // Verificar si el handler contiene llamadas prohibidas
      const hasForbiddenFetch = FORBIDDEN_PATTERNS.fetchMasterApi.test(handlerBody) ||
                                 FORBIDDEN_PATTERNS.fetchGodApi.test(handlerBody) ||
                                 FORBIDDEN_PATTERNS.fetchAdminApi.test(handlerBody);
      
      const hasPerformAction = handlerBody.includes('performAction(') || handlerBody.includes('perform-action(');
      
      if (hasForbiddenFetch && !hasPerformAction) {
        // Verificar si está marcado como LEGACY
        const contextBefore = content.substring(Math.max(0, handlerStart - 200), handlerStart);
        const isLegacy = LEGACY_MARKER.test(contextBefore + handlerBody);
        
        if (isLegacy) {
          warn(`Handler ${handlerName} contiene fetch() directo pero está marcado como LEGACY. Debe migrarse a performAction() en el futuro.`, relativePath, handlerStartLine);
        } else {
          error(`Handler ${handlerName} contiene llamadas fetch() directas. Debe usar performAction(action_id, payload) en su lugar.`, relativePath, handlerStartLine);
        }
      }
    }
  }

  // D) Detectar acciones UI sin action_id explícito (PROHIBIDO)
  // Buscar botones, menús, shortcuts que ejecutan acciones
  const actionPatterns = [
    /addEventListener\s*\(\s*['"](click|submit|change)/g,
    /onclick\s*=\s*['"]/g,
    /\.click\s*\(/g
  ];

  for (const actionPattern of actionPatterns) {
    const matches = [...content.matchAll(actionPattern)];
    for (const match of matches) {
      const matchIndex = match.index;
      const lineNumber = content.substring(0, matchIndex).split('\n').length;
      
      // Buscar contexto: ¿se usa performAction?
      const contextAfter = content.substring(matchIndex, Math.min(content.length, matchIndex + 1000));
      
      // Si hay fetch() pero no performAction, es sospechoso
      if (FORBIDDEN_PATTERNS.fetchMasterApi.test(contextAfter) || 
          FORBIDDEN_PATTERNS.fetchGodApi.test(contextAfter)) {
        const hasPerformAction = contextAfter.includes('performAction') || contextAfter.includes('perform-action');
        
        if (!hasPerformAction) {
          const contextBefore = content.substring(Math.max(0, matchIndex - 200), matchIndex);
          const isLegacy = LEGACY_MARKER.test(contextBefore + contextAfter);
          
          if (isLegacy) {
            warn(`Acción UI detectada sin performAction pero marcada como LEGACY. Debe migrarse en el futuro.`, relativePath, lineNumber);
          } else {
            error(`Acción UI detectada sin action_id explícito. Debe usar performAction(action_id, payload) en su lugar.`, relativePath, lineNumber);
          }
        }
      }
    }
  }
}

/**
 * Verifica que performAction está disponible en los loaders
 */
function checkPerformActionAvailability() {
  info('Verificando disponibilidad de performAction...');
  
  const loaderFiles = [
    join(projectRoot, 'public/js/core/ux/action-registry/ux-action-registry-loader.js'),
    join(projectRoot, 'public/js/master/ux/perform-action.v1.js'),
    join(projectRoot, 'src/core/master/registry/master-layout-registry.v1.json')
  ];

  let foundLoader = false;
  for (const loaderFile of loaderFiles) {
    try {
      const content = readFileSync(loaderFile, 'utf-8');
      if (content.includes('performAction') || content.includes('perform-action')) {
        foundLoader = true;
        info(`✓ performAction encontrado en: ${loaderFile.replace(projectRoot + '/', '')}`);
        break;
      }
    } catch (err) {
      // Ignorar si el archivo no existe
    }
  }

  if (!foundLoader) {
    error('performAction NO está disponible en ningún loader. El UX Action Registry no puede funcionar.');
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║   [ASSEMBLY][UX_ACTION_REGISTRY] - Verificación Constitucional       ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

// Verificar disponibilidad de performAction
checkPerformActionAvailability();

// Escanear archivos UI
info('Escaneando archivos UI...');
const uiFiles = [];
for (const dir of UI_DIRS) {
  scanDirectory(dir, uiFiles);
}

info(`Archivos encontrados: ${uiFiles.length}`);
console.log('');

// Verificar cada archivo
for (const file of uiFiles) {
  checkFile(file);
}

// ============================================================================
// RESUMEN
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(60));
console.log(`Archivos escaneados: ${filesScanned}`);
console.log(`Violaciones encontradas: ${violationsFound}`);
console.log(`Errores: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log('');

if (errors.length > 0) {
  console.log('❌ VIOLACIONES CONSTITUCIONALES DETECTADAS:');
  for (const err of errors) {
    const location = err.line ? ` (línea ${err.line})` : '';
    console.log(`   - ${err.msg}${location}`);
    if (err.file) {
      console.log(`     Archivo: ${err.file}`);
    }
  }
  console.log('');
  console.log('❌ FALLÓ: Se encontraron violaciones constitucionales.');
  console.log('   El Action Registry es la ÚNICA puerta de intención de usuario.');
  console.log('   Todas las mutaciones DEBEN pasar por performAction().');
  process.exit(1);
} else {
  console.log('✅ Sin violaciones constitucionales detectadas.');
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (legacy marcado explícitamente):');
    for (const warn of warnings) {
      const location = warn.line ? ` (línea ${warn.line})` : '';
      console.log(`   - ${warn.msg}${location}`);
      if (warn.file) {
        console.log(`     Archivo: ${warn.file}`);
      }
    }
  }
  
  console.log('\n✅ ASSEMBLY CHECK PASÓ: UX Action Registry v1 blindado constitucionalmente.');
  process.exit(0);
}
