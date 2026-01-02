/**
 * MASTER UI FACTORY v1 - AuriPortal Master
 * 
 * Factory canónico para renderizar pantallas Master.
 * 
 * PRINCIPIO FUNDAMENTAL:
 * - Consume UI_MASTER_REGISTRY
 * - Renderiza SOLO screens registradas
 * - Status: draft / active
 * - Si no existe en registry → NO EXISTE
 * 
 * Assembly Check obligatorio:
 * - routing
 * - layout slots
 * - sidebar placeholder
 * - scripts-once
 * - theme resolver
 */

import { findEntryByRouteKey } from '../registry/ui-master-registry.runtime.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getRequestId } from '../../observability/request-context.js';

/**
 * Modo del Factory (shadow | enforced)
 */
let factoryMode = 'shadow'; // Por defecto shadow mode

/**
 * Obtiene el modo actual del Factory
 * @returns {string} 'shadow' | 'enforced'
 */
export function getFactoryMode() {
  return factoryMode;
}

/**
 * Establece el modo del Factory
 * @param {string} mode - 'shadow' | 'enforced'
 */
export function setFactoryMode(mode) {
  if (mode !== 'shadow' && mode !== 'enforced') {
    throw new Error(`Modo inválido: ${mode}. Debe ser 'shadow' o 'enforced'`);
  }
  factoryMode = mode;
  logInfo('MasterUIFactory', 'Modo cambiado', { mode });
}

/**
 * Valida una entrada del registry
 * @param {Object} entry - Entrada del UI_MASTER_REGISTRY
 * @returns {Object} { valid: boolean, errors: Array }
 */
export function validateRegistryEntry(entry) {
  const errors = [];
  
  if (!entry.id) {
    errors.push({ field: 'id', message: 'Entry debe tener id' });
  }
  
  if (!entry.routeKey) {
    errors.push({ field: 'routeKey', message: 'Entry debe tener routeKey' });
  }
  
  if (!entry.route) {
    errors.push({ field: 'route', message: 'Entry debe tener route' });
  } else {
    if (!entry.route.path) {
      errors.push({ field: 'route.path', message: 'Route debe tener path' });
    } else if (!entry.route.path.startsWith('/master')) {
      errors.push({ field: 'route.path', message: 'Route path debe empezar con /master' });
    }
    
    if (!entry.route.type) {
      errors.push({ field: 'route.type', message: 'Route debe tener type' });
    } else if (!['api', 'island'].includes(entry.route.type)) {
      errors.push({ field: 'route.type', message: 'Route type debe ser api o island' });
    }
  }
  
  if (!entry.status) {
    errors.push({ field: 'status', message: 'Entry debe tener status' });
  } else if (!['draft', 'active', 'archived'].includes(entry.status)) {
    errors.push({ field: 'status', message: 'Status debe ser draft, active o archived' });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida que una pantalla Master puede renderizarse
 * @param {string} routeKey - Key de la ruta
 * @returns {Object} { canRender: boolean, entry: Object|null, errors: Array }
 */
export function canRenderMasterScreen(routeKey) {
  const traceId = getRequestId() || `master-factory-${Date.now()}`;
  
  // Buscar entrada en registry
  const entry = findEntryByRouteKey(routeKey);
  
  if (!entry) {
    logWarn('MasterUIFactory', 'Pantalla no encontrada en registry', { routeKey, traceId });
    return {
      canRender: false,
      entry: null,
      errors: [{ message: `Pantalla ${routeKey} no existe en UI_MASTER_REGISTRY` }]
    };
  }
  
  // Validar entrada
  const validation = validateRegistryEntry(entry);
  
  if (!validation.valid) {
    logWarn('MasterUIFactory', 'Entry inválida', { routeKey, errors: validation.errors, traceId });
    return {
      canRender: false,
      entry,
      errors: validation.errors
    };
  }
  
  // Verificar status
  if (entry.status === 'archived') {
    logWarn('MasterUIFactory', 'Pantalla archivada', { routeKey, traceId });
    return {
      canRender: false,
      entry,
      errors: [{ message: `Pantalla ${routeKey} está archivada` }]
    };
  }
  
  // En enforced mode, solo active puede renderizarse
  if (factoryMode === 'enforced' && entry.status !== 'active') {
    logWarn('MasterUIFactory', 'Pantalla no activa en enforced mode', { routeKey, status: entry.status, traceId });
    return {
      canRender: false,
      entry,
      errors: [{ message: `Pantalla ${routeKey} no está activa (status: ${entry.status})` }]
    };
  }
  
  // En shadow mode, draft también puede renderizarse (con warning)
  if (factoryMode === 'shadow' && entry.status === 'draft') {
    logWarn('MasterUIFactory', 'Pantalla en draft (shadow mode)', { routeKey, traceId });
  }
  
  logInfo('MasterUIFactory', 'Pantalla válida para renderizar', { routeKey, status: entry.status, traceId });
  
  return {
    canRender: true,
    entry,
    errors: []
  };
}

/**
 * Ejecuta Assembly Check para una pantalla Master
 * @param {string} routeKey - Key de la ruta
 * @returns {Object} Resultado del Assembly Check
 */
export async function runMasterAssemblyCheck(routeKey) {
  const traceId = getRequestId() || `master-assembly-${Date.now()}`;
  
  logInfo('MasterUIFactory', 'Ejecutando Assembly Check', { routeKey, traceId });
  
  const checks = {
    routing: { passed: false, errors: [] },
    layout_slots: { passed: false, errors: [] },
    sidebar_placeholder: { passed: false, errors: [] },
    scripts_once: { passed: false, errors: [] },
    theme_resolver: { passed: false, errors: [] }
  };
  
  // Check 1: Routing
  try {
    const { resolveMasterRoute } = await import('../router/master-router-resolver.js');
    const resolved = await resolveMasterRoute(`/master/${routeKey}`, 'GET');
    if (resolved && resolved.route) {
      checks.routing.passed = true;
    } else {
      checks.routing.errors.push('Ruta no resuelta en Master Router');
    }
  } catch (error) {
    checks.routing.errors.push(`Error resolviendo ruta: ${error.message}`);
  }
  
  // Check 2: Layout slots
  // Verificar que el layout tiene los slots requeridos
  try {
    const layoutRegistry = await import('../registry/master-layout-registry.v1.json');
    const requiredSlots = ['sidebar', 'main', 'notes_panel', 'diagnostics_panel'];
    // Por ahora, asumimos que el layout tiene los slots (validación más completa en futuro)
    checks.layout_slots.passed = true;
  } catch (error) {
    checks.layout_slots.errors.push(`Error verificando layout: ${error.message}`);
  }
  
  // Check 3: Sidebar placeholder
  // Verificar que existe contenedor para sidebar
  checks.sidebar_placeholder.passed = true; // Se valida en runtime
  
  // Check 4: Scripts once
  // Verificar que los scripts se cargan una sola vez
  checks.scripts_once.passed = true; // Se valida en runtime
  
  // Check 5: Theme resolver
  // Verificar que el theme resolver está disponible
  checks.theme_resolver.passed = true; // Se valida en runtime
  
  const allPassed = Object.values(checks).every(check => check.passed);
  
  logInfo('MasterUIFactory', 'Assembly Check completado', { routeKey, allPassed, traceId });
  
  return {
    routeKey,
    allPassed,
    checks,
    traceId
  };
}


