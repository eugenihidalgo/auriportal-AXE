/**
 * ADMIN API HANDLERS AUDITOR v1
 * 
 * Auditoría estructural de handlers API del Admin Router.
 * 
 * PRINCIPIO:
 * Si una ruta API está registrada, DEBE tener un handler válido.
 * 
 * RESPONSABILIDADES:
 * - Leer todas las rutas API del Admin Route Registry
 * - Verificar que cada ruta tiene un handler válido
 * - Identificar handlers faltantes
 * - Generar reporte estructurado
 * 
 * USO:
 * - En arranque del servidor (modo warning o fail-hard según env)
 * - CLI manual: node src/core/admin/audit-admin-api-handlers.js
 */

import { ADMIN_ROUTES, getRoutesByType } from './admin-route-registry.js';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENDPOINTS_DIR = resolve(__dirname, '../../endpoints');

/**
 * HANDLER_MAP del resolver (debe estar sincronizado con admin-router-resolver.js)
 * Rutas que usan handlers centralizados o mapeos especiales
 * 
 * NOTA: Algunos handlers exportan funciones nombradas (no default), se verifica en el resolver
 */
const HANDLER_MAP = {
  // Handlers con funciones nombradas (verificado manualmente en resolver)
  'api-energy-clean': 'admin-energy-api.js',
  'api-energy-illuminate': 'admin-energy-api.js',
  // Handlers centralizados con default export
  'api-registry': 'admin-registry.js',
  'api-themes-diag': 'admin-theme-bindings-api.js',
  'api-theme-studio-canon-themes': 'admin-theme-studio-canon-api.js',
  'api-theme-studio-canon-theme': 'admin-theme-studio-canon-api.js',
  'api-theme-studio-canon-validate': 'admin-theme-studio-canon-api.js',
  'api-theme-studio-canon-save-draft': 'admin-theme-studio-canon-api.js',
  'api-theme-studio-canon-publish': 'admin-theme-studio-canon-api.js',
  'api-theme-studio-canon-preview': 'admin-theme-studio-canon-api.js',
  'ollama-health': 'admin-ollama-health.js',
  'api-packages-sources': 'admin-packages-api.js',
  'api-automation-definitions-list': 'admin-automation-definitions-api.js',
  'api-automation-definitions-detail': 'admin-automation-definitions-api.js',
  'api-automation-definitions-create': 'admin-automation-definitions-write-api.js',
  'api-automation-definitions-update': 'admin-automation-definitions-write-api.js',
  'api-automation-definitions-activate': 'admin-automation-definitions-write-api.js',
  'api-automation-definitions-deactivate': 'admin-automation-definitions-write-api.js',
  'api-automation-definitions-execute-dry-run': 'admin-automation-execution-api.js',
  'api-automation-definitions-execute-live-run': 'admin-automation-execution-api.js',
  'api-automations-preview': 'admin-automations-api.js',
  'api-automation-runs-detail': 'admin-automation-runs-api.js',
  'api-automation-runs-steps': 'admin-automation-runs-api.js',
  'api-transmutaciones-lists-classification': 'admin-transmutaciones-classification-api.js',
  'api-assembly-status': 'admin-assembly-check-api.js',
  'api-assembly-run': 'admin-assembly-check-api.js',
  'api-assembly-runs': 'admin-assembly-check-api.js',
  'api-assembly-run-detail': 'admin-assembly-check-api.js',
  'api-assembly-initialize': 'admin-assembly-check-api.js',
  // Añadir aquí otros handlers centralizados
};

/**
 * Handlers con funciones nombradas (no default export)
 * Estos se verifican manualmente en el resolver, el auditor los marca como OK
 */
const NAMED_EXPORT_HANDLERS = [
  'api-energy-clean',
  'api-energy-illuminate'
];

/**
 * Infiere el path del handler desde routeKey
 * Misma lógica que admin-router-resolver.js
 * 
 * PRIMERO: Verifica HANDLER_MAP (handlers centralizados)
 * SEGUNDO: Infiere según patrón estándar
 */
function inferHandlerPath(routeKey, routeType) {
  // Si está en HANDLER_MAP, usar ese path directamente
  if (HANDLER_MAP[routeKey]) {
    return HANDLER_MAP[routeKey];
  }
  
  // Inferencia estándar
  if (routeKey.startsWith('api-')) {
    // Formato: 'api-{name}' -> admin-{name}-api.js
    const name = routeKey.replace('api-', '').replace(/-/g, '-');
    return `admin-${name}-api.js`;
  } else if (routeType === 'island') {
    // Intentar primero con -page.js, luego sin sufijo
    const name = routeKey.replace(/-/g, '-');
    return [`admin-${name}-page.js`, `admin-${name}.js`];
  }
  return null;
}

/**
 * Verifica si un archivo existe
 */
function fileExists(filePath) {
  const fullPath = join(ENDPOINTS_DIR, filePath);
  return existsSync(fullPath);
}

/**
 * Verifica si un archivo exporta default function
 * (versión simplificada: solo verifica que exporta default)
 */
function hasDefaultExport(filePath) {
  try {
    const fullPath = join(ENDPOINTS_DIR, filePath);
    const content = readFileSync(fullPath, 'utf-8');
    // Verificación básica: buscar export default
    return /export\s+default/.test(content);
  } catch (error) {
    return false;
  }
}

/**
 * Ejecuta auditoría completa de handlers API
 * 
 * @param {Object} options - Opciones de auditoría
 * @param {boolean} options.autoFix - Si true, crea stubs automáticamente
 * @param {string} options.mode - 'warn' | 'fail' | 'report'
 * @returns {Object} Reporte de auditoría
 */
export async function auditAdminAPIHandlers(options = {}) {
  const { autoFix = false, mode = 'report' } = options;
  
  const report = {
    ok: [],
    missing_handlers: [],
    orphan_files: [], // Archivos en endpoints/ que no corresponden a ninguna ruta
    timestamp: new Date().toISOString()
  };
  
  // Obtener todas las rutas API
  const apiRoutes = getRoutesByType('api');
  
  console.log(`[ADMIN_ROUTER_AUDIT] Auditing ${apiRoutes.length} API routes...`);
  
  // Auditar cada ruta API
  for (const route of apiRoutes) {
    const routeKey = route.key;
    const inferredPaths = inferHandlerPath(routeKey, route.type);
    
    if (!inferredPaths) {
      // No se puede inferir (no debería pasar para rutas API)
      report.missing_handlers.push({
        routeKey,
        routePath: route.path,
        reason: 'CANNOT_INFER_PATH',
        inferredPath: null
      });
      continue;
    }
    
    // Para API, inferredPaths puede ser string o array
    const handlerFile = Array.isArray(inferredPaths) ? inferredPaths[0] : inferredPaths;
    
    if (!fileExists(handlerFile)) {
      report.missing_handlers.push({
        routeKey,
        routePath: route.path,
        reason: 'FILE_NOT_FOUND',
        inferredPath: handlerFile,
        expectedPath: `src/endpoints/${handlerFile}`
      });
      
      // Auto-fix: crear stub
      if (autoFix) {
        try {
          await createHandlerStub(handlerFile, routeKey, route);
          console.log(`[ADMIN_ROUTER_AUDIT] ✅ Created stub: ${handlerFile}`);
        } catch (error) {
          console.error(`[ADMIN_ROUTER_AUDIT] ❌ Error creating stub ${handlerFile}:`, error.message);
        }
      }
    } else {
      // Archivo existe, verificar que tiene default export (o es named export conocido)
      if (NAMED_EXPORT_HANDLERS.includes(routeKey)) {
        // Handlers con named exports se verifican en el resolver, marcarlos como OK
        report.ok.push({
          routeKey,
          routePath: route.path,
          handlerFile,
          note: 'NAMED_EXPORT_VERIFIED_IN_RESOLVER'
        });
      } else if (!hasDefaultExport(handlerFile)) {
        report.missing_handlers.push({
          routeKey,
          routePath: route.path,
          reason: 'NO_DEFAULT_EXPORT',
          inferredPath: handlerFile
        });
      } else {
        report.ok.push({
          routeKey,
          routePath: route.path,
          handlerFile
        });
      }
    }
  }
  
  // Generar mensaje según modo
  if (mode === 'warn' && report.missing_handlers.length > 0) {
    console.warn(`[ADMIN_ROUTER_AUDIT] ⚠️  WARNING: ${report.missing_handlers.length} handlers missing`);
    report.missing_handlers.forEach(m => {
      console.warn(`[ADMIN_ROUTER_AUDIT]   - ${m.routeKey} (${m.routePath}) → ${m.inferredPath || 'N/A'}`);
    });
  } else if (mode === 'fail' && report.missing_handlers.length > 0) {
    const error = new Error(`ADMIN_ROUTER_AUDIT_FAIL: ${report.missing_handlers.length} handlers missing`);
    error.code = 'ADMIN_HANDLERS_MISSING';
    error.details = report.missing_handlers;
    throw error;
  }
  
  return report;
}

/**
 * Crea un stub mínimo para un handler faltante
 */
async function createHandlerStub(handlerFile, routeKey, route) {
  const fullPath = join(ENDPOINTS_DIR, handlerFile);
  
  // No sobrescribir si ya existe
  if (existsSync(fullPath)) {
    throw new Error(`File already exists: ${handlerFile}`);
  }
  
  const stubContent = `// src/endpoints/${handlerFile}
// AUTO-GENERATED STUB HANDLER
// Route Key: ${routeKey}
// Route Path: ${route.path}
// Created: ${new Date().toISOString()}
//
// ⚠️  WARNING: This is a stub. Implement the actual handler logic.

import { requireAdminContext } from '../core/auth-context.js';

/**
 * Helper para crear respuesta JSON
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Handler stub para ${route.path}
 * 
 * @param {Request} request - Request object
 * @param {object} env - Variables de entorno
 * @param {object} ctx - Contexto
 * @returns {Promise<Response>} Respuesta JSON
 */
export default async function handler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  
  // CRÍTICO: Endpoints API NUNCA devuelven HTML
  if (authCtx instanceof Response) {
    return jsonResponse({ 
      ok: false, 
      error: 'No autenticado. Requiere sesión admin.' 
    }, 401);
  }
  
  // TODO: Implementar lógica real del handler
  return jsonResponse({
    ok: true,
    message: 'Stub handler autogenerated',
    routeKey: '${routeKey}',
    routePath: '${route.path}',
    warning: 'This handler needs to be implemented'
  });
}
`;
  
  // Escribir archivo (usar writeFileSync desde fs/promises si está disponible)
  const { writeFileSync } = await import('fs');
  writeFileSync(fullPath, stubContent, 'utf-8');
}

/**
 * Ejecuta auditoría desde CLI
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const autoFix = args.includes('--fix');
  const mode = args.includes('--fail') ? 'fail' : (args.includes('--warn') ? 'warn' : 'report');
  
  auditAdminAPIHandlers({ autoFix, mode })
    .then(report => {
      console.log('\n[ADMIN_ROUTER_AUDIT] 📊 AUDIT REPORT:');
      console.log(`  ✅ OK: ${report.ok.length}`);
      console.log(`  ❌ Missing: ${report.missing_handlers.length}`);
      console.log(`  📁 Orphan: ${report.orphan_files.length}`);
      
      if (report.missing_handlers.length > 0) {
        console.log('\n[ADMIN_ROUTER_AUDIT] Missing handlers:');
        report.missing_handlers.forEach(m => {
          console.log(`  - ${m.routeKey}`);
          console.log(`    Path: ${m.routePath}`);
          console.log(`    Expected: ${m.expectedPath || m.inferredPath || 'N/A'}`);
          console.log(`    Reason: ${m.reason}`);
        });
      }
      
      if (mode === 'fail' && report.missing_handlers.length > 0) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('[ADMIN_ROUTER_AUDIT] ❌ ERROR:', error.message);
      process.exit(1);
    });
}

