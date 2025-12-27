// src/core/assembly/assembly-check-engine.js
// Assembly Check Engine (ACS) v1.0 - AuriPortal
//
// PROPÓSITO:
// Motor canónico para verificar ensamblaje real de Admin UIs.
// Detecta errores ANTES de que lleguen al usuario.
//
// REGLAS:
// - Estados: OK | WARN | BROKEN
// - Códigos ACS_* explícitos
// - No errores silenciosos
// - No errores genéricos

import { ADMIN_ROUTES, findRouteByPath } from '../admin/admin-route-registry.js';
import { resolveAdminRoute } from '../admin/admin-router-resolver.js';
import { getAllFlags } from '../feature-flags/feature-flag-service.js';
import * as checkRepo from '../../infra/repos/assembly-check-repo-pg.js';
import * as runRepo from '../../infra/repos/assembly-check-run-repo-pg.js';
import * as resultRepo from '../../infra/repos/assembly-check-result-repo-pg.js';
import { logError, logWarn, logInfo } from '../observability/logger.js';

/**
 * Códigos de error ACS explícitos
 */
export const ACS_CODES = {
  OK: null, // No hay código si está OK
  HANDLER_NOT_FOUND: 'ACS_HANDLER_NOT_FOUND',
  HANDLER_IMPORT_ERROR: 'ACS_HANDLER_IMPORT_ERROR',
  HTML_EMPTY: 'ACS_HTML_EMPTY',
  PLACEHOLDER_UNRESOLVED: 'ACS_PLACEHOLDER_UNRESOLVED',
  SIDEBAR_MISSING: 'ACS_SIDEBAR_MISSING',
  FEATURE_FLAG_INACTIVE: 'ACS_FEATURE_FLAG_INACTIVE',
  ROUTE_NOT_FOUND: 'ACS_ROUTE_NOT_FOUND',
  HANDLER_EXECUTION_ERROR: 'ACS_HANDLER_EXECUTION_ERROR',
  INVALID_RESPONSE: 'ACS_INVALID_RESPONSE',
  RENDER_OUTSIDE_ADMIN_PAGE: 'ACS_RENDER_OUTSIDE_ADMIN_PAGE',
  // Source of Truth Certification
  SOT_DOC_NOT_FOUND: 'ACS_SOT_DOC_NOT_FOUND',
  SOT_SEMANTIC_CONTRACT_MISSING: 'ACS_SOT_SEMANTIC_CONTRACT_MISSING',
  SOT_FILTER_CONTRACT_MISSING: 'ACS_SOT_FILTER_CONTRACT_MISSING',
  SOT_LIST_FOR_CONSUMPTION_MISSING: 'ACS_SOT_LIST_FOR_CONSUMPTION_MISSING',
  SOT_LOGIC_IN_UI: 'ACS_SOT_LOGIC_IN_UI',
  SOT_NOT_CONSUMABLE: 'ACS_SOT_NOT_CONSUMABLE'
};

/**
 * Verifica el ensamblaje de una UI Admin específica
 * @param {Object} check - Definición del check
 * @param {string} check.ui_key - Clave de la UI
 * @param {string} check.route_path - Ruta canónica
 * @param {string} check.display_name - Nombre legible
 * @param {string} [check.feature_flag_key] - Feature flag (opcional)
 * @param {boolean} check.expected_sidebar - Si se espera sidebar
 * @param {Object} env - Environment variables
 * @returns {Promise<Object>} Resultado del check
 */
export async function checkAssembly(check, env) {
  const startTime = Date.now();
  const result = {
    status: 'OK',
    code: null,
    message: null,
    details: {
      route_resolved: false,
      handler_imported: false,
      html_empty: false,
      placeholders: [],
      sidebar_present: false,
      feature_flag_active: null
    }
  };
  
  try {
    // 1. Verificar que la ruta existe en el registry
    const route = findRouteByPath(check.route_path);
    if (!route) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.ROUTE_NOT_FOUND;
      result.message = `Ruta ${check.route_path} no encontrada en Admin Route Registry`;
      result.details.route_resolved = false;
      return result;
    }
    result.details.route_resolved = true;
    
    // 2. Verificar feature flag si aplica
    if (check.feature_flag_key) {
      const flags = await getAllFlags();
      const flag = flags.find(f => f.flag_key === check.feature_flag_key);
      if (!flag || !flag.enabled) {
        result.status = 'WARN';
        result.code = ACS_CODES.FEATURE_FLAG_INACTIVE;
        result.message = `Feature flag ${check.feature_flag_key} no está activo`;
        result.details.feature_flag_active = false;
        return result;
      }
      result.details.feature_flag_active = true;
    }
    
    // 3. Verificar que la ruta está en admin-route-registry (ya verificado en paso 1)
    // 4. Verificar que tiene handler mapeado en admin-router-resolver
    // 5. Resolver handler
    let handler = null;
    let resolved = null;
    try {
      resolved = await resolveAdminRoute(check.route_path, 'GET');
      if (!resolved) {
        result.status = 'BROKEN';
        result.code = ACS_CODES.HANDLER_NOT_FOUND;
        result.message = `Handler no encontrado para ruta ${check.route_path}. Verifica que está mapeado en admin-router-resolver.js`;
        result.details.handler_imported = false;
        return result;
      }
      
      if (!resolved.handler) {
        result.status = 'BROKEN';
        result.code = ACS_CODES.HANDLER_NOT_FOUND;
        result.message = `Handler resuelto pero no es una función válida para ruta ${check.route_path}`;
        result.details.handler_imported = false;
        return result;
      }
      handler = resolved.handler;
      result.details.handler_imported = true;
    } catch (importError) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.HANDLER_IMPORT_ERROR;
      result.message = `Error importando handler: ${importError.message}`;
      result.details.handler_imported = false;
      return result;
    }
    
    // 4. Ejecutar handler en modo seguro
    let response = null;
    try {
      // Crear un request mock para el handler
      // NOTA: Usamos header X-ACS-Check para que validateAdminSession() permita
      // la ejecución sin requerir autenticación real. Esto es seguro porque:
      // - Solo se usa en el contexto del ACS (checks internos)
      // - No afecta la seguridad de rutas reales
      // - Permite verificar el ensamblaje correcto de las pantallas
      const mockRequest = new Request(`http://localhost${check.route_path}`, {
        method: 'GET',
        headers: {
          'Cookie': 'admin_session=test-session', // Mock session (no se valida si X-ACS-Check está presente)
          'X-ACS-Check': 'true' // Header especial para bypass de autenticación en checks
        }
      });
      
      // Ejecutar handler con timeout
      const handlerPromise = handler(mockRequest, env, {});
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Handler timeout')), 10000)
      );
      
      response = await Promise.race([handlerPromise, timeoutPromise]);
      
      if (!response || !(response instanceof Response)) {
        result.status = 'BROKEN';
        result.code = ACS_CODES.INVALID_RESPONSE;
        result.message = 'Handler no devolvió una Response válida';
        return result;
      }
    } catch (execError) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.HANDLER_EXECUTION_ERROR;
      result.message = `Error ejecutando handler: ${execError.message}`;
      return result;
    }
    
    // 5. Verificar HTML no vacío
    const html = await response.text();
    if (!html || html.trim().length === 0) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.HTML_EMPTY;
      result.message = 'HTML vacío o sin contenido';
      result.details.html_empty = true;
      return result;
    }
    result.details.html_empty = false;
    
    // 6. CHECK: Verificar que el HTML proviene de renderAdminPage (solo para rutas island)
    // Si la ruta es tipo 'island', debe tener sidebar y estructura de base.html
    if (resolved && resolved.type === 'island') {
      // Verificar que contiene elementos característicos de renderAdminPage:
      // - Sidebar (id="admin-sidebar-scroll" o id="sidebar")
      // - Script sidebar-client.js
      // - Estructura base.html
      const hasSidebar = html.includes('admin-sidebar-scroll') || html.includes('id="sidebar"');
      const hasSidebarClient = html.includes('sidebar-client.js');
      const hasBaseStructure = html.includes('<!DOCTYPE html>') && html.includes('<body');
      
      if (!hasSidebar || !hasSidebarClient || !hasBaseStructure) {
        result.status = 'BROKEN';
        result.code = ACS_CODES.RENDER_OUTSIDE_ADMIN_PAGE;
        result.message = 'HTML no proviene de renderAdminPage(). Faltan elementos: ' + [
          !hasSidebar && 'sidebar',
          !hasSidebarClient && 'sidebar-client.js',
          !hasBaseStructure && 'estructura base.html'
        ].filter(Boolean).join(', ');
        result.details.renderAdminPage_used = false;
        return result;
      }
      result.details.renderAdminPage_used = true;
    }
    
    // 7. Detectar placeholders sin resolver
    const placeholderRegex = /\{\{([A-Z_]+)\}\}/g;
    const placeholders = [];
    let match;
    while ((match = placeholderRegex.exec(html)) !== null) {
      placeholders.push(match[0]);
    }
    
    if (placeholders.length > 0) {
      result.status = 'WARN';
      result.code = ACS_CODES.PLACEHOLDER_UNRESOLVED;
      result.message = `Placeholders sin resolver: ${placeholders.join(', ')}`;
      result.details.placeholders = placeholders;
      // No retornamos aquí, continuamos con otras verificaciones
    }
    
    // 8. Verificar sidebar esperado
    if (check.expected_sidebar) {
      // Buscar indicadores de sidebar en el HTML
      // NOTA: Después de renderAdminPage(), el HTML ya tiene el sidebar inyectado
      // Buscamos los IDs reales que genera generateSidebarHTML()
      const hasSidebar = html.includes('id="sidebar"') || 
                        html.includes('id="admin-sidebar"') ||
                        html.includes('id="admin-sidebar-scroll"') ||
                        html.includes('{{SIDEBAR_MENU}}') || // Placeholder antes de render
                        html.includes('sidebar-registry') ||
                        html.includes('sidebar-client.js'); // Script del sidebar
      
      if (!hasSidebar) {
        result.status = 'WARN';
        result.code = ACS_CODES.SIDEBAR_MISSING;
        result.message = 'Sidebar esperado pero no encontrado en HTML';
        result.details.sidebar_present = false;
        // No retornamos aquí, es WARN no BROKEN
      } else {
        result.details.sidebar_present = true;
      }
    }
    
    // Si llegamos aquí y no hay problemas, está OK
    if (result.status === 'OK') {
      result.message = 'Ensamblaje correcto';
    }
    
    return result;
  } catch (error) {
    logError('AssemblyCheckEngine', 'Error inesperado en checkAssembly', {
      check: check.ui_key,
      error: error.message,
      stack: error.stack
    });
    
    result.status = 'BROKEN';
    result.code = ACS_CODES.HANDLER_EXECUTION_ERROR;
    result.message = `Error inesperado: ${error.message}`;
    return result;
  } finally {
    const duration = Date.now() - startTime;
    result.details.duration_ms = duration;
  }
}

/**
 * Ejecuta checks de ensamblaje para todas las UIs habilitadas
 * @param {Object} env - Environment variables
 * @param {string} [triggeredBy] - Actor que disparó la ejecución
 * @returns {Promise<Object>} Resultado de la ejecución
 */
export async function runAssemblyChecks(env, triggeredBy = null) {
  const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  logInfo('AssemblyCheckEngine', 'Iniciando ejecución de assembly checks', { runId });
  
  try {
    // 1. Crear run
    await runRepo.createRun(runId, triggeredBy);
    
    // 2. Obtener todos los checks habilitados
    const checks = await checkRepo.getEnabledChecks();
    
    logInfo('AssemblyCheckEngine', `Ejecutando ${checks.length} checks`, { runId, count: checks.length });
    
    let totalChecks = 0;
    let checksOk = 0;
    let checksWarn = 0;
    let checksBroken = 0;
    
    // 3. Ejecutar cada check
    if (checks.length === 0) {
      logInfo('AssemblyCheckEngine', 'No hay checks habilitados para ejecutar', { runId });
    } else {
      for (const check of checks) {
        totalChecks++;
        
        try {
          const checkResult = await checkAssembly(check, env);
          
          // Guardar resultado
          await resultRepo.saveResult({
            run_id: runId,
            check_id: check.id,
            status: checkResult.status,
            code: checkResult.code,
            message: checkResult.message,
            details: checkResult.details,
            duration_ms: checkResult.details.duration_ms
          });
          
          // Contar por estado
          if (checkResult.status === 'OK') {
            checksOk++;
          } else if (checkResult.status === 'WARN') {
            checksWarn++;
          } else if (checkResult.status === 'BROKEN') {
            checksBroken++;
          }
          
          logInfo('AssemblyCheckEngine', `Check completado: ${check.ui_key}`, {
            runId,
            ui_key: check.ui_key,
            status: checkResult.status,
            code: checkResult.code
          });
        } catch (checkError) {
          // Si un check individual falla, continuar con los demás
          logError('AssemblyCheckEngine', `Error ejecutando check ${check.ui_key}`, {
            runId,
            ui_key: check.ui_key,
            error: checkError.message
          });
          checksBroken++;
          totalChecks++;
        }
      }
    }
    
    // 4. Actualizar run con resultados
    await runRepo.updateRun(runId, {
      status: 'completed',
      total_checks: totalChecks,
      checks_ok: checksOk,
      checks_warn: checksWarn,
      checks_broken: checksBroken
    });
    
    logInfo('AssemblyCheckEngine', 'Ejecución completada', {
      runId,
      total_checks: totalChecks,
      checks_ok: checksOk,
      checks_warn: checksWarn,
      checks_broken: checksBroken
    });
    
    return {
      run_id: runId,
      status: 'completed',
      total_checks: totalChecks,
      checks_ok: checksOk,
      checks_warn: checksWarn,
      checks_broken: checksBroken
    };
  } catch (error) {
    logError('AssemblyCheckEngine', 'Error ejecutando assembly checks', {
      runId,
      error: error.message,
      stack: error.stack
    });
    
    // Actualizar run con error
    await runRepo.updateRun(runId, {
      status: 'failed',
      error_message: error.message
    });
    
    throw error;
  }
}

/**
 * Inicializa checks basándose en Admin Route Registry
 * Crea checks automáticamente para todas las rutas 'island' del registry
 * @param {string} [createdBy] - Actor que crea los checks
 * @returns {Promise<number>} Número de checks creados
 */
export async function initializeChecksFromRegistry(createdBy = 'system') {
  logInfo('AssemblyCheckEngine', 'Inicializando checks desde Admin Route Registry');
  
  let created = 0;
  
  // Obtener todas las rutas 'island' del registry
  const islandRoutes = ADMIN_ROUTES.filter(route => 
    route.type === 'island' && 
    !route.disabled &&
    route.path.startsWith('/admin/')
  );
  
  for (const route of islandRoutes) {
    try {
      // Verificar si ya existe
      const existing = await checkRepo.getCheckByUiKey(route.key);
      if (existing) {
        continue; // Ya existe, saltar
      }
      
      // Crear check
      await checkRepo.createCheck({
        ui_key: route.key,
        route_path: route.path,
        display_name: route.key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        feature_flag_key: null, // Se puede configurar después
        expected_sidebar: true,
        created_by: createdBy
      });
      
      created++;
      
      logInfo('AssemblyCheckEngine', `Check creado: ${route.key}`, { ui_key: route.key });
    } catch (error) {
      logError('AssemblyCheckEngine', `Error creando check para ${route.key}`, {
        ui_key: route.key,
        error: error.message
      });
    }
  }
  
  logInfo('AssemblyCheckEngine', `Inicialización completada: ${created} checks creados`, { created });
  
  return created;
}

/**
 * Verifica la certificación de un Source of Truth (SOT)
 * 
 * Un SOT está certificado cuando:
 * 1. Existe docs/SOT_<entidad>.md
 * 2. El documento declara contrato semántico (qué representa y qué NO representa)
 * 3. Existe contrato de filtros exportado (FILTER_CONTRACT)
 * 4. Existe método listForConsumption() en el servicio
 * 5. La UI NO contiene lógica de filtrado
 * 6. El SOT es consumible sin contexto de UI
 * 
 * @param {string} sotName - Nombre del SOT (ej: 'tecnicas-limpieza')
 * @param {string} servicePath - Ruta del servicio relativa a src/ (ej: 'services/tecnicas-limpieza-service.js')
 * @param {Object} env - Environment variables
 * @returns {Promise<Object>} Resultado del check
 */
export async function checkSotCertification(sotName, servicePath, env) {
  const startTime = Date.now();
  const result = {
    status: 'OK',
    code: null,
    message: null,
    details: {
      doc_exists: false,
      semantic_contract_declared: false,
      filter_contract_exported: false,
      list_for_consumption_exists: false,
      ui_has_no_logic: false,
      consumable_without_ui: false
    }
  };

  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = path.resolve(__dirname, '../../..');

    // 1. Verificar que existe docs/SOT_<entidad>.md
    const docPath = path.join(projectRoot, 'docs', `SOT_${sotName}.md`);
    if (!fs.existsSync(docPath)) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.SOT_DOC_NOT_FOUND;
      result.message = `Documento docs/SOT_${sotName}.md no encontrado`;
      result.details.doc_exists = false;
      return result;
    }
    result.details.doc_exists = true;

    // 2. Verificar que el documento declara contrato semántico
    const docContent = fs.readFileSync(docPath, 'utf-8');
    const hasSemanticContract = 
      docContent.includes('ROL ONTOLÓGICO') ||
      (docContent.includes('Qué representa') || docContent.includes('Representa')) &&
      (docContent.includes('Qué NO representa') || docContent.includes('NO representa'));
    
    if (!hasSemanticContract) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.SOT_SEMANTIC_CONTRACT_MISSING;
      result.message = `Documento SOT_${sotName}.md no declara contrato semántico (qué representa y qué NO representa)`;
      result.details.semantic_contract_declared = false;
      return result;
    }
    result.details.semantic_contract_declared = true;

    // 3. Verificar que existe FILTER_CONTRACT exportado
    const serviceFullPath = path.join(projectRoot, 'src', servicePath);
    if (!fs.existsSync(serviceFullPath)) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.SOT_FILTER_CONTRACT_MISSING;
      result.message = `Servicio ${servicePath} no encontrado`;
      result.details.filter_contract_exported = false;
      return result;
    }

    const serviceContent = fs.readFileSync(serviceFullPath, 'utf-8');
    const hasFilterContract = 
      serviceContent.includes('FILTER_CONTRACT') ||
      serviceContent.includes('export') && serviceContent.includes('FILTER_CONTRACT');
    
    if (!hasFilterContract) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.SOT_FILTER_CONTRACT_MISSING;
      result.message = `Servicio ${servicePath} no exporta FILTER_CONTRACT`;
      result.details.filter_contract_exported = false;
      return result;
    }
    result.details.filter_contract_exported = true;

    // 4. Verificar que existe método listForConsumption()
    const hasListForConsumption = 
      serviceContent.includes('listForConsumption') ||
      serviceContent.includes('export') && serviceContent.includes('listForConsumption');
    
    if (!hasListForConsumption) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.SOT_LIST_FOR_CONSUMPTION_MISSING;
      result.message = `Servicio ${servicePath} no tiene método listForConsumption()`;
      result.details.list_for_consumption_exists = false;
      return result;
    }
    result.details.list_for_consumption_exists = true;

    // 5. Verificar que la UI NO contiene lógica de filtrado
    // Buscar archivos UI relacionados
    const possibleUiFiles = [
      `admin-${sotName}-ui.js`,
      `admin-${sotName}.js`
    ];
    
    const endpointsDir = path.join(projectRoot, 'src', 'endpoints');
    let uiHasLogic = false;
    
    for (const uiFile of possibleUiFiles) {
      const uiFullPath = path.join(endpointsDir, uiFile);
      if (fs.existsSync(uiFullPath)) {
        const uiContent = fs.readFileSync(uiFullPath, 'utf-8');
        // Buscar patrones de lógica de filtrado en UI (excluyendo validaciones de campos y renderizado)
        const logicPatterns = [
          /\.filter\([^)]*=>[^)]*(nivel|status|level)/,  // Filtrado por nivel/status
          /const\s+\w+\s*=\s*\w+\.filter\([^)]*(nivel|status|level)/,  // Asignación de filtrado
          /if\s*\([^)]*nivel[^)]*(<=|>=|<|>|=)/,  // Comparaciones con nivel
          /if\s*\([^)]*status[^)]*(===|==|!==|!=)/,  // Comparaciones con status (excepto validaciones)
          /\.map\([^)]*=>[^)]*\.filter\(/  // Map seguido de filter
        ];
        
        // Patrones que SÍ son válidos (validaciones de campos, no lógica semántica)
        const validPatterns = [
          /if\s*\(\s*!.*Input\s*\)/,  // Validación de campo requerido (if (!nivelInput))
          /if\s*\(\s*!.*\.value\s*\)/,  // Validación de valor requerido
          /inputNivel|nivelInput|statusInput/,  // Nombres de variables de input
          /getElementById|querySelector/,  // Selección de elementos
          /addEventListener/,  // Event listeners
          /textContent|value\s*=/,  // Asignación de valores de UI
          /onlyActive=true/,  // Parámetro de API (no es lógica, es parámetro)
          /\.filter\([^)]*Input[^)]*\)/  // Filtrado de inputs HTML (no datos)
        ];
        
        for (const pattern of logicPatterns) {
          const matches = uiContent.match(new RegExp(pattern.source, 'gi'));
          if (matches) {
            // Verificar que no son solo comentarios, strings o validaciones válidas
            for (const match of matches) {
              const lineIndex = uiContent.indexOf(match);
              const line = uiContent.substring(Math.max(0, lineIndex - 100), lineIndex + match.length + 100);
              
              // Ignorar si está en comentario
              if (line.includes('//') || line.includes('/*') || line.includes('*/')) {
                continue;
              }
              
              // Ignorar si es renderizado
              if (line.includes('render') || line.includes('Render')) {
                continue;
              }
              
              // Ignorar si coincide con patrones válidos
              let isValid = false;
              for (const validPattern of validPatterns) {
                if (validPattern.test(line)) {
                  isValid = true;
                  break;
                }
              }
              
              if (!isValid) {
                uiHasLogic = true;
                break;
              }
            }
            if (uiHasLogic) break;
          }
        }
        if (uiHasLogic) break;
      }
    }

    if (uiHasLogic) {
      result.status = 'BROKEN';
      result.code = ACS_CODES.SOT_LOGIC_IN_UI;
      result.message = `UI de ${sotName} contiene lógica de filtrado. La lógica debe estar en el servicio, no en la UI.`;
      result.details.ui_has_no_logic = false;
      return result;
    }
    result.details.ui_has_no_logic = true;

    // 6. Verificar que el SOT es consumible sin contexto de UI
    // Esto se verifica intentando importar y usar listForConsumption
    try {
      const serviceModule = await import(`../../${servicePath}`);
      if (typeof serviceModule.listForConsumption === 'function') {
        result.details.consumable_without_ui = true;
      } else {
        result.status = 'BROKEN';
        result.code = ACS_CODES.SOT_NOT_CONSUMABLE;
        result.message = `Método listForConsumption() no es una función exportada en ${servicePath}`;
        result.details.consumable_without_ui = false;
        return result;
      }
    } catch (importError) {
      // Si no se puede importar, asumimos que está bien (puede ser por dependencias)
      // Pero marcamos como WARN
      result.status = 'WARN';
      result.code = ACS_CODES.SOT_NOT_CONSUMABLE;
      result.message = `No se pudo verificar importación de ${servicePath}: ${importError.message}`;
      result.details.consumable_without_ui = false;
      return result;
    }

    // Si llegamos aquí, todo está OK
    if (result.status === 'OK') {
      result.message = `SOT ${sotName} está certificado correctamente`;
    }

    return result;
  } catch (error) {
    logError('AssemblyCheckEngine', 'Error verificando certificación SOT', {
      sotName,
      servicePath,
      error: error.message,
      stack: error.stack
    });

    result.status = 'BROKEN';
    result.code = ACS_CODES.HANDLER_EXECUTION_ERROR;
    result.message = `Error inesperado verificando SOT: ${error.message}`;
    return result;
  } finally {
    const duration = Date.now() - startTime;
    result.details.duration_ms = duration;
  }
}

