#!/usr/bin/env node
/**
 * CHECK UX REFRESH WIRING - AuriPortal
 * 
 * Assembly check que detecta wiring incorrecto en UX Contract v1 y Refresh Contract v1.
 * 
 * DETECTA:
 * 1) fetch() con método POST fuera de performAction()
 * 2) Llamadas a loadItems/loadListProjection/handleVerItem dentro de handlers POST (deberían estar en refreshEngine)
 * 3) Acciones sin registro en UX Action Registry
 * 4) Acciones sin refresh_plan
 * 
 * SALIDA:
 * - Errors = violación constitucional
 * - Warnings = legacy marcado
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const TARGET_FILE = join(projectRoot, 'public/js/master/master-alquimia-general-client.js');

let errors = [];
let warnings = [];

function error(msg) {
  errors.push(msg);
  console.error(`❌ ERROR: ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`⚠️  WARNING: ${msg}`);
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

// Leer archivo
let content;
try {
  content = readFileSync(TARGET_FILE, 'utf-8');
} catch (err) {
  error(`No se pudo leer ${TARGET_FILE}: ${err.message}`);
  process.exit(1);
}

  // 1) Detectar fetch() POST fuera de performAction (excluyendo LEGACY marcado)
info('Buscando fetch() POST fuera de performAction()...');
const fetchPostRegex = /fetch\s*\(\s*[^,]+,\s*\{[^}]*method\s*:\s*['"]POST['"]/g;
const performActionRegex = /performAction\s*\(/g;
const legacyRegex = /\[LEGACY_REFRESH_CALL\]/g;

let fetchPostMatches = [];
let match;
while ((match = fetchPostRegex.exec(content)) !== null) {
  fetchPostMatches.push({
    index: match.index,
    line: content.substring(0, match.index).split('\n').length
  });
}

let performActionMatches = [];
while ((match = performActionRegex.exec(content)) !== null) {
  performActionMatches.push({
    index: match.index,
    line: content.substring(0, match.index).split('\n').length
  });
}

// Verificar si cada fetch POST está dentro de performAction o marcado como LEGACY
for (const fetchMatch of fetchPostMatches) {
  // Buscar contexto alrededor del fetch para verificar si está marcado como LEGACY
  const contextStart = Math.max(0, fetchMatch.index - 500);
  const contextEnd = Math.min(content.length, fetchMatch.index + 100);
  const context = content.substring(contextStart, contextEnd);
  
  // Verificar si está marcado como LEGACY
  if (context.includes('[LEGACY_REFRESH_CALL]') || context.includes('LEGACY_REFRESH_CALL')) {
    warn(`fetch() POST en línea ${fetchMatch.line} marcado como LEGACY. Debe migrarse a performAction() en el futuro.`);
    continue; // Saltar este fetch (es legacy marcado)
  }
  
  // Buscar performAction más cercano antes de este fetch
  const performActionBefore = performActionMatches
    .filter(m => m.index < fetchMatch.index)
    .sort((a, b) => b.index - a.index)[0];

  if (!performActionBefore) {
    // Buscar contexto alrededor del fetch
    const linesBefore = content.substring(0, fetchMatch.index);
    const functionStart = linesBefore.lastIndexOf('async function') || linesBefore.lastIndexOf('function');
    if (functionStart > 0) {
      const functionContent = content.substring(functionStart, fetchMatch.index + 200);
      if (!functionContent.includes('performAction')) {
        error(`fetch() POST encontrado fuera de performAction() en línea ${fetchMatch.line}. Debe usar performAction() o marcar como LEGACY con [LEGACY_REFRESH_CALL].`);
      }
    } else {
      error(`fetch() POST encontrado fuera de performAction() en línea ${fetchMatch.line}. Debe usar performAction() o marcar como LEGACY con [LEGACY_REFRESH_CALL].`);
    }
  } else {
    // Verificar que no hay otro performAction entre ellos (lo cual sería raro)
    const performActionAfter = performActionMatches
      .filter(m => m.index > fetchMatch.index)[0];
    
    if (performActionAfter && performActionAfter.index < fetchMatch.index + 500) {
      // Puede ser válido si el fetch está en un contexto diferente
      // Por ahora, solo warning
      warn(`fetch() POST en línea ${fetchMatch.line} cerca de performAction(). Verificar que es legacy marcado.`);
    }
  }
}

// 2) Detectar llamadas a loadItems/loadListProjection/handleVerItem dentro de handlers POST
info('Buscando llamadas a loadItems/loadListProjection/handleVerItem en handlers POST...');
const handlerFunctions = [
  'handleLimpiarItem',
  'handleLimpiarEstudiante',
  'handleIncrementAllItem',
  'handlePdeIncrementAllItem',
  'resetStudentItemProgress',
  'resetStudentListProgress'
];

const loadFunctions = ['loadItems', 'loadListProjection', 'handleVerItem'];

for (const handlerName of handlerFunctions) {
  const handlerRegex = new RegExp(`async function ${handlerName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?=async function|function|\\}$|$)`, 'g');
  let handlerMatch;
  
  while ((handlerMatch = handlerRegex.exec(content)) !== null) {
    const handlerBody = handlerMatch[1];
        const handlerStartLine = content.substring(0, handlerMatch.index).split('\n').length;
        
        // Verificar si hay fetch POST en este handler
        if (handlerBody.includes('fetch') && handlerBody.includes('POST')) {
          // Verificar si hay llamadas a loadFunctions
          for (const loadFunc of loadFunctions) {
            if (handlerBody.includes(loadFunc + '(') && !handlerBody.includes('performAction')) {
              error(`Llamada a ${loadFunc}() encontrada en ${handlerName}() (línea ~${handlerStartLine}). Debe estar dentro de refresh_plan, no en el handler.`);
            }
          }
        }
      }
    }

// 3) Verificar que cada action_id usado existe en registry
info('Verificando action_ids en código...');
const actionIdsInCode = [
  'alquimia.clean',           // Nueva acción consolidada
  'alquimia.clean_all',       // Nueva acción consolidada
  'alquimia.reset',           // Nueva acción consolidada
  'alquimia.clean.student',   // Legacy (compatibilidad)
  'alquimia.clean.all',       // Legacy (compatibilidad)
  'alquimia.increment.all',   // Legacy (compatibilidad)
  'alquimia.reset.item',      // Legacy (compatibilidad)
  'alquimia.reset.list'       // Legacy (compatibilidad)
];

// Leer registry de acciones (core primero, fallback a legacy)
const actionsRegistryCoreFile = join(projectRoot, 'src/core/ux/action-registry/alquimia-actions.js');
const actionsRegistryLegacyFile = join(projectRoot, 'public/js/master/ux/alquimia-actions-registry.v1.js');
let actionsRegistryContent = '';
try {
  // Intentar leer registry core
  const coreContent = readFileSync(actionsRegistryCoreFile, 'utf-8');
  actionsRegistryContent += coreContent;
  info(`Registry core encontrado: ${actionsRegistryCoreFile}`);
} catch (err) {
  warn(`No se pudo leer ${actionsRegistryCoreFile}: ${err.message}. Intentando legacy...`);
}

try {
  // Intentar leer registry legacy (compatibilidad)
  const legacyContent = readFileSync(actionsRegistryLegacyFile, 'utf-8');
  actionsRegistryContent += '\n' + legacyContent;
  info(`Registry legacy encontrado: ${actionsRegistryLegacyFile}`);
} catch (err) {
  warn(`No se pudo leer ${actionsRegistryLegacyFile}: ${err.message}.`);
}

if (actionsRegistryContent) {
  for (const actionId of actionIdsInCode) {
    // Verificar que el action_id se usa en código
    if (content.includes(`action_id: '${actionId}'`) || content.includes(`action_id: "${actionId}"`)) {
      // Verificar que está registrado en registry
      if (!actionsRegistryContent.includes(`action_id: '${actionId}'`) && !actionsRegistryContent.includes(`action_id: "${actionId}"`)) {
        error(`action_id '${actionId}' usado en código pero NO registrado en alquimia-actions-registry.v1.js`);
      } else {
        info(`✓ action_id '${actionId}' registrado correctamente`);
      }
    }
  }
}

// 4) Verificar que cada acción tiene refresh_plan
if (actionsRegistryContent) {
  info('Verificando refresh_plan en acciones registradas...');
  // Buscar refresh_plan o refresh: seguido de función o array
  const refreshPlanRegex = /(refresh_plan|refresh):\s*(buildRefreshPlan|function|\[)/g;
  let refreshPlanMatches = 0;
  while ((match = refreshPlanRegex.exec(actionsRegistryContent)) !== null) {
    refreshPlanMatches++;
  }
  
  const actionIdRegex = /action_id:\s*['"]([^'"]+)['"]/g;
  let actionCount = 0;
  while ((match = actionIdRegex.exec(actionsRegistryContent)) !== null) {
    actionCount++;
  }
  
  if (refreshPlanMatches < actionCount) {
    error(`Algunas acciones no tienen refresh/refresh_plan. Encontradas ${actionCount} acciones pero solo ${refreshPlanMatches} refresh_plans.`);
  } else {
    info(`✓ Todas las acciones tienen refresh/refresh_plan (${actionCount} acciones, ${refreshPlanMatches} refresh_plans)`);
  }
}

// Resumen
console.log('\n' + '='.repeat(60));
console.log('RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(60));
console.log(`Errores: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);

if (errors.length > 0) {
  console.log('\n❌ VIOLACIONES CONSTITUCIONALES DETECTADAS:');
  errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (legacy marcado):');
  warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('\n✅ Todas las verificaciones pasaron correctamente.');
  process.exit(0);
} else if (errors.length > 0) {
  console.log('\n❌ FALLÓ: Se encontraron violaciones constitucionales.');
  process.exit(1);
} else {
  console.log('\n⚠️  WARNINGS: Se encontraron elementos legacy marcados.');
  process.exit(0);
}
