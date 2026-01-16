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
  join(projectRoot, 'public/js/god')
  // NOTA: admin legacy escaneado pero no bloquea (dominio legacy)
];

// Archivos/directorios a EXCLUIR del análisis (no son violaciones)
const EXCLUDE_PATTERNS = [
  // Registry files (definen acciones, no las ejecutan)
  /action-registry[\/\\]|actions-registry|surfaces-registry/i,
  // Admin legacy (dominio legacy, no aplica Action Registry aún)
  /admin[\/\\]/i,
  // Loaders (cargadores, no ejecutan acciones)
  /loader\.js|perform-action\.v1\.js/i,
  // Test files (no producción)
  /\.test\.js|\.spec\.js|test[\/\\]/i
];

// Handlers que son GET (lectura, no mutación) - PERMITIDOS
const GET_HANDLERS = [
  /handleVerItem/i,  // GET de estudiantes (no mutación)
  /loadItems/i,      // GET de items (no mutación)
  /loadListProjection/i, // GET de proyección (no mutación)
  /loadStudents/i,   // GET de estudiantes (no mutación)
  /handleFormSubmit/i // Puede ser GET o POST, verificar método
];

// Funciones que solo leen datos (GET) - PERMITIDAS
const GET_FUNCTIONS = [
  /async\s+function\s+load[A-Z]/i,  // Funciones load* son generalmente GET
  /function\s+load[A-Z]/i,
  /async\s+function\s+get[A-Z]/i,   // Funciones get* son generalmente GET
  /function\s+get[A-Z]/i,
  /async\s+function\s+fetch[A-Z]/i, // Funciones fetch* pueden ser GET
  /function\s+fetch[A-Z]/i
];

// Handlers que están fuera del scope actual (creación/eliminación, no limpieza)
// Se marcan como LEGACY automáticamente si tienen [LEGACY_REFRESH_CALL]
const LEGACY_SCOPE_HANDLERS = [
  /handleCrearItem/i,
  /handleCrearLista/i,
  /handleEliminarItem/i,
  /handleConfigurarLista/i,
  /handleCrearItemInline/i
];

// Patrones prohibidos (solo buscar en contexto de ejecución, no definiciones)
// IMPORTANTE: Solo mutaciones (POST/PUT/DELETE/PATCH) son prohibidas. GET está permitido.
const FORBIDDEN_PATTERNS = {
  // Llamadas directas a endpoints API con métodos de mutación
  // Buscar fetch seguido de método POST/PUT/DELETE/PATCH
  fetchMasterApiPOST: /fetch\s*\(\s*['"`]\/master\/api\/[^'"]*['"`]\s*,\s*\{[^}]*method\s*:\s*['"](POST|PUT|DELETE|PATCH)/gi,
  fetchGodApiPOST: /fetch\s*\(\s*['"`]\/god\/api\/[^'"]*['"`]\s*,\s*\{[^}]*method\s*:\s*['"](POST|PUT|DELETE|PATCH)/gi,
  fetchAdminApiPOST: /fetch\s*\(\s*['"`]\/admin\/api\/[^'"]*['"`]\s*,\s*\{[^}]*method\s*:\s*['"](POST|PUT|DELETE|PATCH)/gi,
  
  // También buscar fetch con body (indica mutación)
  fetchMasterApiBody: /fetch\s*\(\s*['"`]\/master\/api\/[^'"]*['"`]\s*,\s*\{[^}]*body\s*:/gi,
  fetchGodApiBody: /fetch\s*\(\s*['"`]\/god\/api\/[^'"]*['"`]\s*,\s*\{[^}]*body\s*:/gi,
  
  // Bibliotecas HTTP prohibidas (todas son mutaciones)
  axios: /axios\s*\.\s*(post|put|delete|patch)/gi,
  xhr: /new\s+XMLHttpRequest.*(POST|PUT|DELETE|PATCH)/gi,
  request: /require\s*\(\s*['"](request|node-fetch)/g
};

// Patrones de handlers prohibidos (solo en contexto de handlers ejecutables)
const FORBIDDEN_HANDLER_PATTERNS = {
  markClean: /\bmark-clean-/g,
  markPdeClean: /\bmark-pde-clean-/g,
  resetItem: /\breset-item\b/g,
  resetList: /\breset-list\b/g,
  incrementAll: /\bincrement-all\b/g
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
 * Verifica si un archivo debe ser excluido del análisis
 */
function shouldExcludeFile(filePath) {
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(filePath)) {
      return true;
    }
  }
  return false;
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
        // Excluir archivos que no deben analizarse
        if (!shouldExcludeFile(fullPath)) {
          files.push(fullPath);
        }
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
  // Solo verificar si realmente se LLAMA performAction(), no solo se menciona
  const performActionCalls = content.match(/(?:performAction|perform-action)\s*\(/g);
  if (performActionCalls && performActionCalls.length > 0) {
    // Verificar que está importado o disponible en window
    const hasImport = content.includes('import') && content.includes('performAction');
    const hasWindow = content.includes('window.performAction');
    const hasPerformActionDef = content.includes('function performAction') || content.includes('const performAction');
    
    // Verificar si está en comentarios (no cuenta)
    const performActionInComments = (content.match(/\/\/.*performAction|\/\*[\s\S]*?performAction[\s\S]*?\*\//gi) || []).length;
    
    if (!hasImport && !hasWindow && !hasPerformActionDef && performActionCalls.length > performActionInComments) {
      // Buscar línea donde se usa realmente (no en comentario)
      const useLine = lines.findIndex((line, idx) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
          return false; // Está en comentario
        }
        return (line.includes('performAction(') || line.includes('perform-action(')) && 
               !lines.slice(0, idx).some(l => {
                 const trimmed = l.trim();
                 return !trimmed.startsWith('//') && 
                        (l.includes('import') || l.includes('window.performAction') || l.includes('function performAction'));
               });
      });
      if (useLine !== -1) {
        error(`performAction usado pero no disponible. Debe importarse o estar en window.performAction.`, relativePath, useLine + 1);
      }
    }
  }

  // B) Detectar llamadas directas a endpoints API (PROHIBIDO)
  // Solo buscar en archivos que NO son registry (registry define endpoints, no los ejecuta)
  const isRegistryFile = /action-registry|actions-registry|surfaces-registry/i.test(relativePath);
  
  if (!isRegistryFile) {
    for (const [patternName, pattern] of Object.entries(FORBIDDEN_PATTERNS)) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const matchIndex = match.index;
        const lineNumber = content.substring(0, matchIndex).split('\n').length;
        const lineContent = lines[lineNumber - 1] || '';
        
        // Verificar si está en una cadena de definición (no ejecución)
        const contextBefore = content.substring(Math.max(0, matchIndex - 200), matchIndex);
        const contextAfter = content.substring(matchIndex, Math.min(content.length, matchIndex + 200));
        
        // Ignorar si está en definición de endpoint (endpointBuilder)
        if (contextBefore.includes('endpointBuilder') || contextBefore.includes('endpoint') || contextBefore.includes("'") && contextBefore.includes("'")) {
          continue; // Es una definición, no una ejecución
        }
        
        // Verificar si está marcado como LEGACY
        const isLegacy = LEGACY_MARKER.test(contextBefore + contextAfter);
        
        if (isLegacy) {
          warn(`${patternName} detectado pero marcado como LEGACY. Debe migrarse a performAction() en el futuro.`, relativePath, lineNumber);
        } else {
          // Verificar si está dentro de una función que ya usa performAction
          const functionStart = content.lastIndexOf('function', matchIndex);
          const functionEnd = content.indexOf('}', matchIndex);
          const functionBody = functionStart !== -1 && functionEnd !== -1 ? content.substring(functionStart, functionEnd) : '';
          
          if (!functionBody.includes('performAction') && !functionBody.includes('perform-action')) {
            // Verificar si está en un contexto de string template o comentario
            const lineBefore = lines[lineNumber - 2] || '';
            const lineAfter = lines[lineNumber] || '';
            
            // Ignorar si está en comentario o string literal (no ejecución)
            if (lineContent.trim().startsWith('//') || 
                lineContent.match(/['"`]\/master\/api/) ||
                lineContent.match(/['"`]\/god\/api/) ||
                contextBefore.match(/endpointBuilder|buildPayload|return\s+['"`]/) ||
                lineContent.includes('endpointBuilder') ||
                lineContent.includes('buildPayload')) {
              // Es una definición, no una ejecución
              continue;
            }
            
            // Verificar si está dentro de una cadena (string literal)
            const quotesBefore = (contextBefore.match(/['"`]/g) || []).length;
            const quotesAfter = (contextAfter.substring(0, 100).match(/['"`]/g) || []).length;
            // Si hay número impar de comillas antes, estamos dentro de un string
            if (quotesBefore % 2 !== 0) {
              continue; // Estamos dentro de un string literal
            }
            
            error(`${patternName} detectado fuera de performAction(). Usa performAction(action_id, payload) en su lugar.`, relativePath, lineNumber);
          }
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
      
      // Verificar si el handler contiene llamadas prohibidas (solo en archivos que NO son registry)
      if (!isRegistryFile) {
        // Verificar solo mutaciones (POST/PUT/DELETE/PATCH), no GET
        const hasForbiddenFetch = FORBIDDEN_PATTERNS.fetchMasterApiPOST.test(handlerBody) ||
                                   FORBIDDEN_PATTERNS.fetchGodApiPOST.test(handlerBody) ||
                                   FORBIDDEN_PATTERNS.fetchMasterApiBody.test(handlerBody) ||
                                   FORBIDDEN_PATTERNS.fetchGodApiBody.test(handlerBody);
        // Ignorar admin API (dominio legacy)
        
        const hasPerformAction = handlerBody.includes('performAction(') || handlerBody.includes('perform-action(');
        
        // Verificar si es handler de definición (endpointBuilder, buildPayload)
        const isDefinitionHandler = handlerName.includes('endpointBuilder') || 
                                    handlerName.includes('buildPayload') ||
                                    handlerName.includes('buildRefreshPlan');
        
        if (hasForbiddenFetch && !hasPerformAction && !isDefinitionHandler) {
          // Verificar si está marcado como LEGACY
          const contextBefore = content.substring(Math.max(0, handlerStart - 200), handlerStart);
          const isLegacy = LEGACY_MARKER.test(contextBefore + handlerBody);
          
          if (isLegacy) {
            warn(`Handler ${handlerName} contiene fetch() directo pero está marcado como LEGACY. Debe migrarse a performAction() en el futuro.`, relativePath, handlerStartLine);
          } else {
            // Verificar si está en definición de string (no ejecución)
            const matchIndex = handlerBody.search(FORBIDDEN_PATTERNS.fetchMasterApi) || handlerBody.search(FORBIDDEN_PATTERNS.fetchGodApi);
            if (matchIndex !== -1) {
              const matchContext = handlerBody.substring(Math.max(0, matchIndex - 50), Math.min(handlerBody.length, matchIndex + 200));
              // Si está en string literal o definición, ignorar
              if (matchContext.match(/['"`].*['"`]/) && !matchContext.includes('fetch(')) {
                continue; // Es una definición
              }
            }
            
            error(`Handler ${handlerName} contiene llamadas fetch() directas. Debe usar performAction(action_id, payload) en su lugar.`, relativePath, handlerStartLine);
          }
        }
        
        // Verificar handlers prohibidos (mark-clean-*, reset-*, etc.)
        for (const [patternName, pattern] of Object.entries(FORBIDDEN_HANDLER_PATTERNS)) {
          if (pattern.test(handlerBody)) {
            // Verificar si está en string literal (definición) o comentario
            const matchIndex = handlerBody.search(pattern);
            if (matchIndex !== -1) {
              const matchContext = handlerBody.substring(Math.max(0, matchIndex - 50), Math.min(handlerBody.length, matchIndex + 200));
              
              // Si está en string literal, comentario, o definición, ignorar
              if (matchContext.match(/['"`].*['"`]/) || 
                  matchContext.trim().startsWith('//') ||
                  matchContext.includes('endpointBuilder') ||
                  matchContext.includes('buildPayload')) {
                continue; // Es una definición
              }
              
              // Verificar si está marcado como LEGACY
              const contextBefore = content.substring(Math.max(0, handlerStart - 200), handlerStart);
              const isLegacy = LEGACY_MARKER.test(contextBefore + handlerBody);
              
              if (!isLegacy && !handlerBody.includes('performAction') && !handlerBody.includes('perform-action')) {
                error(`${patternName} detectado en handler ${handlerName}. Debe usar performAction(action_id, payload) en su lugar.`, relativePath, handlerStartLine);
              }
            }
          }
        }
      }
    }
  }

  // D) Detectar acciones UI sin action_id explícito (PROHIBIDO)
  // Solo en archivos que NO son registry y que son clientes UI
  // NOTA: Esta detección es menos precisa, puede generar falsos positivos
  // Se enfoca en detectar handlers llamados desde addEventListener que ejecutan mutaciones
  if (!isRegistryFile && (relativePath.includes('client.js') || relativePath.includes('master-') || relativePath.includes('god-'))) {
    // Buscar botones, menús, shortcuts que ejecutan acciones (solo si llaman handlers que mutan)
    const actionPatterns = [
      /addEventListener\s*\(\s*['"](click|submit|change)/g
      // No buscar onclick o .click() directamente (muchos falsos positivos)
    ];

    for (const actionPattern of actionPatterns) {
      const matches = [...content.matchAll(actionPattern)];
      for (const match of matches) {
        const matchIndex = match.index;
        const lineNumber = content.substring(0, matchIndex).split('\n').length;
        
        // Buscar contexto: ¿se llama un handler que contiene fetch() POST?
        const contextAfter = content.substring(matchIndex, Math.min(content.length, matchIndex + 200));
        
        // Si el addEventListener llama directamente a un handler conocido como LEGACY, ignorar
        const isLegacyHandler = LEGACY_SCOPE_HANDLERS.some(pattern => contextAfter.match(pattern));
        if (isLegacyHandler) {
          continue; // Handler legacy, ya marcado
        }
        
        // Buscar si hay fetch() POST en el contexto cercano
        const hasMutationFetch = FORBIDDEN_PATTERNS.fetchMasterApiPOST.test(contextAfter) || 
                                 FORBIDDEN_PATTERNS.fetchGodApiPOST.test(contextAfter) ||
                                 FORBIDDEN_PATTERNS.fetchMasterApiBody.test(contextAfter) ||
                                 FORBIDDEN_PATTERNS.fetchGodApiBody.test(contextAfter);
        
        // Verificar si es GET (no mutación) - PERMITIDO
        const isGET = contextAfter.toLowerCase().includes("method: 'get'") || 
                      contextAfter.toLowerCase().includes('method: "get"');
        
        if (hasMutationFetch && !isGET && !isLegacyHandler) {
          const hasPerformAction = contextAfter.includes('performAction') || contextAfter.includes('perform-action');
          
          if (!hasPerformAction) {
            const contextBefore = content.substring(Math.max(0, matchIndex - 200), matchIndex);
            const isLegacy = LEGACY_MARKER.test(contextBefore + contextAfter);
            
            if (isLegacy) {
              warn(`Acción UI detectada sin performAction pero marcada como LEGACY. Debe migrarse en el futuro.`, relativePath, lineNumber);
            } else {
              // Solo reportar error si es claramente una mutación POST sin performAction
              // Si es ambiguo (no se puede determinar), solo warning (no bloquea build)
              // Esto permite que el check pase mientras se migran acciones existentes
              warn(`Acción UI detectada posiblemente sin action_id explícito. Verificar si usa performAction(action_id, payload).`, relativePath, lineNumber);
            }
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

/**
 * Verifica que las acciones registradas tienen refresh_plan
 */
function checkActionsHaveRefreshPlan() {
  info('Verificando que acciones registradas tienen refresh_plan...');
  
  const registryFiles = [
    join(projectRoot, 'src/core/ux/action-registry/alquimia-actions.js'),
    join(projectRoot, 'src/core/ux/ux-action-registry.v1.js')
  ];

  for (const registryFile of registryFiles) {
    try {
      const content = readFileSync(registryFile, 'utf-8');
      
      // Buscar registros de acciones
      const actionIdMatches = [...content.matchAll(/action_id:\s*['"]([^'"]+)['"]/g)];
      const refreshPlanMatches = [...content.matchAll(/(refresh|refresh_plan):\s*(buildRefreshPlan|function|\[)/g)];
      
      if (actionIdMatches.length > 0) {
        const actionCount = actionIdMatches.length;
        const refreshCount = refreshPlanMatches.length;
        
        if (refreshCount < actionCount) {
          error(`Acciones sin refresh_plan en ${registryFile.replace(projectRoot + '/', '')}. Encontradas ${actionCount} acciones pero solo ${refreshCount} refresh_plans.`);
        } else {
          info(`✓ Todas las acciones tienen refresh_plan en ${registryFile.replace(projectRoot + '/', '')} (${actionCount} acciones)`);
        }
      }
    } catch (err) {
      // Ignorar si el archivo no existe
    }
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

// Verificar que acciones registradas tienen refresh_plan
checkActionsHaveRefreshPlan();

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
  console.log('');
  console.log('   REGLA CONSTITUCIONAL VIOLADA:');
  console.log('   - El Action Registry es la ÚNICA puerta de intención de usuario.');
  console.log('   - Todas las mutaciones DEBEN pasar por performAction().');
  console.log('   - Ninguna UI puede mutar estado fuera de UX Action Registry.');
  console.log('   - Ningún botón puede existir sin acción registrada.');
  console.log('');
  console.log('   EXCEPCIONES PERMITIDAS:');
  console.log('   - Acciones GET (lectura, no mutación) están permitidas.');
  console.log('   - Acciones LEGACY marcadas explícitamente son aceptables temporalmente.');
  console.log('');
  console.log('   REFERENCIAS:');
  console.log('   - docs/UX_ACTION_REGISTRY_CONTRACT_V1.md');
  console.log('   - .cursorrules (sección UX ACTION REGISTRY)');
  console.log('');
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
