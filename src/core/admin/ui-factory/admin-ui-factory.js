/**
 * UI ADMIN FACTORY v1 - AuriPortal Admin
 * 
 * Sistema canónico para crear/renderizar UIs Admin desde Registry.
 * 
 * PRINCIPIO FUNDAMENTAL:
 * Toda UI Admin debe pasar por la Factory para garantizar cumplimiento del Contrato Canónico v1.
 * 
 * RESPONSABILIDADES:
 * - Validar Registry Entry contra Registry Schema
 * - Validar UI Screen Definition contra UI Admin Schema (si existe)
 * - Aplicar wiring estándar (contexto, permisos, observabilidad, sidebar, mobile)
 * - Llamar renderAdminPage() con parámetros correctos
 * - Añadir metadata diagnóstica
 * 
 * MODOS:
 * - shadow: Valida y registra warnings sin bloquear (por defecto)
 * - enforced: Bloquea renderizado si no cumple contratos
 * 
 * ═══════════════════════════════════════════════════════════════
 * ⚠️  NO ejecuta lógica de negocio: solo valida, cablea y delega
 * ⚠️  NO renderiza HTML: solo orquesta renderAdminPage()
 * ⚠️  NO modifica UI de producto: solo garantiza cumplimiento
 * ═══════════════════════════════════════════════════════════════
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { renderAdminPage } from '../admin-page-renderer.js';
import { getRequestId } from '../../observability/request-context.js';
import { logError, logWarn, logInfo } from '../../observability/logger.js';
import { getAllFlags } from '../../feature-flags/feature-flag-service.js';
import { generateSidebarHTML } from '../sidebar-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar schemas una sola vez
let registrySchema = null;
let uiAdminSchema = null;

function getRegistrySchema() {
  if (!registrySchema) {
    // Path relativo desde src/core/admin/ui-factory/ a docs/ en raíz
    const schemaPath = join(__dirname, '../../../../docs/UI_ADMIN_REGISTRY_SCHEMA_V1.json');
    try {
      registrySchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    } catch (error) {
      logError('UIAdminFactory', 'Error cargando Registry Schema', {
        error: error.message,
        path: schemaPath
      });
      throw new Error(`No se pudo cargar Registry Schema: ${error.message}`);
    }
  }
  return registrySchema;
}

function getUIAdminSchema() {
  if (!uiAdminSchema) {
    // Path relativo desde src/core/admin/ui-factory/ a docs/ en raíz
    const schemaPath = join(__dirname, '../../../../docs/UI_ADMIN_SCHEMA_V1.json');
    try {
      uiAdminSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    } catch (error) {
      logError('UIAdminFactory', 'Error cargando UI Admin Schema', {
        error: error.message,
        path: schemaPath
      });
      throw new Error(`No se pudo cargar UI Admin Schema: ${error.message}`);
    }
  }
  return uiAdminSchema;
}

// Inicializar AJV
// strictTypes: false para evitar errores con allOf en schemas complejos
// strictRequired: false para evitar errores con required en allOf/then
const ajv = new Ajv({ strict: true, strictTypes: false, strictRequired: false, allErrors: true, verbose: true });
addFormats(ajv);

/**
 * Obtiene el modo de la Factory (shadow | enforced)
 * @returns {string} Modo de la factory
 */
export function getFactoryMode() {
  // Prioridad: env var > feature flag > default shadow
  const envMode = process.env.UI_FACTORY_MODE;
  if (envMode === 'enforced') {
    return 'enforced';
  }
  // TODO: Consultar feature flag 'ui-factory-enforced' si existe
  return 'shadow';
}

/**
 * Valida una entrada del registry contra el Registry Schema
 * @param {Object} entry - Entrada del registry
 * @returns {{valid: boolean, errors: Array}} Resultado de validación
 */
export function validateRegistryEntry(entry) {
  try {
    const schema = getRegistrySchema();
    const validate = ajv.compile(schema.$defs.UIAdminScreenRegistryEntry);
    const valid = validate(entry);
    
    if (!valid) {
      return {
        valid: false,
        errors: validate.errors || []
      };
    }
    
    return {
      valid: true,
      errors: []
    };
  } catch (error) {
    logError('UIAdminFactory', 'Error validando Registry Entry', {
      error: error.message,
      entryId: entry?.id
    });
    return {
      valid: false,
      errors: [{ message: error.message, path: '' }]
    };
  }
}

/**
 * Valida una definición de UI contra el UI Admin Schema
 * @param {Object} screenDef - Definición de UI Admin
 * @returns {{valid: boolean, errors: Array}} Resultado de validación
 */
// Cache para validadores compilados
let uiAdminValidator = null;

export function validateUIScreenDefinition(screenDef) {
  try {
    if (!uiAdminValidator) {
      const schema = getUIAdminSchema();
      // Remover $schema para evitar warnings de AJV sobre referencias externas
      const schemaWithoutMeta = { ...schema };
      delete schemaWithoutMeta.$schema;
      // Remover $id para evitar conflictos al compilar múltiples veces
      delete schemaWithoutMeta.$id;
      uiAdminValidator = ajv.compile(schemaWithoutMeta);
    }
    
    const valid = uiAdminValidator(screenDef);
    
    if (!valid) {
      // Filtrar errores relacionados con $schema (warnings de AJV, no errores reales)
      const realErrors = (uiAdminValidator.errors || []).filter(e => 
        !e.message.includes('no schema with key or ref') &&
        !e.message.includes('$schema') &&
        !e.message.includes('already exists')
      );
      
      return {
        valid: realErrors.length === 0,
        errors: realErrors
      };
    }
    
    return {
      valid: true,
      errors: []
    };
  } catch (error) {
    logError('UIAdminFactory', 'Error validando UI Screen Definition', {
      error: error.message
    });
    return {
      valid: false,
      errors: [{ message: error.message, path: '' }]
    };
  }
}

/**
 * Valida flags de activación (feature flags, permisos, modos del sistema)
 * @param {Object} flags - Flags de la entrada
 * @param {Object} context - Contexto del sistema
 * @returns {{valid: boolean, errors: Array}} Resultado de validación
 */
async function validateFlags(flags, context) {
  const errors = [];
  
  // Validar feature flags
  if (flags.featureFlags && flags.featureFlags.length > 0) {
    try {
      const allFlags = await getAllFlags();
      const flagMap = {};
      allFlags.forEach(flag => {
        flagMap[flag.key] = flag.enabled;
      });
      
      for (const requiredFlag of flags.featureFlags) {
        if (!flagMap[requiredFlag] || !flagMap[requiredFlag]) {
          errors.push({
            type: 'feature_flag',
            flag: requiredFlag,
            message: `Feature flag requerido no está activo: ${requiredFlag}`
          });
        }
      }
    } catch (error) {
      logWarn('UIAdminFactory', 'Error validando feature flags (fail-open)', {
        error: error.message
      });
      // Fail-open: si falla, asumir que los flags están activos
    }
  }
  
  // Validar permisos (básico, se puede extender)
  if (flags.permissions && flags.permissions.length > 0) {
    // TODO: Validar permisos contra Permission System
    // Por ahora, solo registrar que se requiere validación
    logInfo('UIAdminFactory', 'Validación de permisos requerida', {
      permissions: flags.permissions
    });
  }
  
  // Validar modos del sistema
  if (flags.systemModes && flags.systemModes.length > 0) {
    const currentMode = context.systemMode || 'NORMAL';
    if (!flags.systemModes.includes(currentMode)) {
      errors.push({
        type: 'system_mode',
        currentMode,
        allowedModes: flags.systemModes,
        message: `Modo del sistema actual (${currentMode}) no está permitido`
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Construye contexto UI enriquecido
 * @param {Object} entry - Entrada del registry
 * @param {Object} context - Contexto del request
 * @returns {Object} Contexto UI enriquecido
 */
async function buildUIContext(entry, context) {
  // Obtener feature flags
  let featureFlags = {};
  try {
    const allFlags = await getAllFlags();
    allFlags.forEach(flag => {
      featureFlags[flag.key] = flag.enabled;
    });
  } catch (error) {
    logWarn('UIAdminFactory', 'Error obteniendo feature flags (fail-open)', {
      error: error.message
    });
  }
  
  return {
    ...context.userContext,
    featureFlags,
    systemMode: context.systemMode || 'NORMAL',
    entryId: entry.id,
    routeKey: entry.routeKey
  };
}

/**
 * Construye una UI Admin desde una entrada del registry
 * @param {Object} entry - Entrada del registry (UIAdminScreenRegistryEntry)
 * @param {Object} ctx - Contexto del sistema
 * @param {Object} reqInfo - Información del request
 * @returns {{html: Response, meta: Object}} HTML renderizado y metadata
 */
export async function buildAdminUIFromRegistryEntry(entry, ctx, reqInfo = {}) {
  const mode = getFactoryMode();
  const traceId = getRequestId() || reqInfo.traceId || 'unknown';
  const warnings = [];
  const errors = [];
  
  // Paso 1: Validar entrada del registry
  const registryValidation = validateRegistryEntry(entry);
  if (!registryValidation.valid) {
    const errorMsg = `Registry Entry inválida: ${registryValidation.errors.map(e => e.message).join(', ')}`;
    if (mode === 'enforced') {
      logError('UIAdminFactory', 'Registry Entry inválida (enforced)', {
        code: 'REGISTRY_ENTRY_INVALID',
        trace_id: traceId,
        routeKey: entry.routeKey,
        screen_id: entry.id,
        errors: registryValidation.errors
      });
      throw new Error(errorMsg);
    } else {
      warnings.push({
        code: 'REGISTRY_ENTRY_INVALID',
        message: errorMsg,
        errors: registryValidation.errors
      });
      logWarn('UIAdminFactory', 'Registry Entry inválida (shadow)', {
        code: 'REGISTRY_ENTRY_INVALID',
        trace_id: traceId,
        routeKey: entry.routeKey,
        screen_id: entry.id
      });
    }
  }
  
  // Paso 2: Validar estado
  if (entry.status !== 'active' && entry.status !== 'deprecated') {
    const errorMsg = `Estado inválido para renderizado: ${entry.status}`;
    if (mode === 'enforced') {
      logError('UIAdminFactory', 'Estado inválido (enforced)', {
        code: 'INVALID_STATUS',
        trace_id: traceId,
        routeKey: entry.routeKey,
        screen_id: entry.id,
        status: entry.status
      });
      throw new Error(errorMsg);
    } else {
      warnings.push({
        code: 'INVALID_STATUS',
        message: errorMsg
      });
    }
  }
  
  // Paso 3: Validar screen definition si está activa
  let screenValidation = null;
  if (entry.status === 'active' && entry.screenDef) {
    screenValidation = validateUIScreenDefinition(entry.screenDef);
    if (!screenValidation.valid) {
      const errorMsg = `UI Screen Definition inválida: ${screenValidation.errors.map(e => e.message).join(', ')}`;
      if (mode === 'enforced') {
        logError('UIAdminFactory', 'UI Screen Definition inválida (enforced)', {
          code: 'SCREEN_DEF_INVALID',
          trace_id: traceId,
          routeKey: entry.routeKey,
          screen_id: entry.id,
          errors: screenValidation.errors
        });
        throw new Error(errorMsg);
      } else {
        warnings.push({
          code: 'SCREEN_DEF_INVALID',
          message: errorMsg,
          errors: screenValidation.errors
        });
      }
    }
  }
  
  // Paso 4: Validar flags de activación
  const flagsValidation = await validateFlags(entry.flags || {}, {
    systemMode: ctx.systemMode,
    userContext: ctx.userContext
  });
  if (!flagsValidation.valid) {
    const errorMsg = `Flags de activación no cumplidos: ${flagsValidation.errors.map(e => e.message).join(', ')}`;
    if (mode === 'enforced') {
      logError('UIAdminFactory', 'Flags no cumplidos (enforced)', {
        code: 'FLAGS_NOT_MET',
        trace_id: traceId,
        routeKey: entry.routeKey,
        screen_id: entry.id,
        errors: flagsValidation.errors
      });
      throw new Error(errorMsg);
    } else {
      warnings.push({
        code: 'FLAGS_NOT_MET',
        message: errorMsg,
        errors: flagsValidation.errors
      });
    }
  }
  
  // Paso 5: Construir contexto UI
  const uiContext = await buildUIContext(entry, ctx);
  
  // Paso 6: Preparar sidebar
  let sidebarHtml = '';
  try {
    sidebarHtml = generateSidebarHTML(entry.route.path, uiContext);
  } catch (error) {
    logWarn('UIAdminFactory', 'Error generando sidebar (fail-open)', {
      error: error.message,
      routeKey: entry.routeKey
    });
    sidebarHtml = '<div id="admin-sidebar-scroll" class="sidebar-scroll overflow-y-auto"><p class="px-3 py-2 text-xs text-slate-500">Error cargando sidebar</p></div>';
  }
  
  // Paso 7: Preparar observabilidad
  // Trace ID ya está disponible
  // Logging estructurado se hace en cada paso
  
  // Paso 8: Llamar renderAdminPage()
  // NOTA: El contenido HTML debe generarse en el handler, no aquí
  // La Factory solo orquesta, no genera contenido
  const title = entry.metadata?.name || entry.id;
  const contentHtml = reqInfo.contentHtml || '<div class="p-4"><p>Contenido de la UI Admin</p></div>';
  
  const response = await renderAdminPage({
    title,
    contentHtml,
    activePath: entry.route.path,
    extraScripts: entry.screenDef?.layout?.scripts?.map(s => s.path) || [],
    extraStyles: entry.screenDef?.layout?.styles?.map(s => s.path) || [],
    userContext: uiContext
  });
  
  // Paso 9: Añadir metadata diagnóstica
  const headers = new Headers(response.headers);
  headers.set('X-UI-FACTORY', mode);
  headers.set('X-Trace-ID', traceId);
  headers.set('X-UI-Factory-Entry-Id', entry.id);
  if (warnings.length > 0) {
    headers.set('X-UI-Factory-Warnings', warnings.length.toString());
  }
  if (errors.length > 0) {
    headers.set('X-UI-Factory-Errors', errors.length.toString());
  }
  
  // Crear nueva Response con headers actualizados
  const html = await response.text();
  const newResponse = new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
  
  // Metadata para logging
  const meta = {
    factoryMode: mode,
    validated: registryValidation.valid && (!entry.screenDef || (screenValidation && screenValidation.valid)),
    warnings,
    errors,
    traceId,
    entryId: entry.id,
    routeKey: entry.routeKey
  };
  
  // Logging estructurado
  if (warnings.length > 0) {
    logWarn('UIAdminFactory', 'Warnings en buildAdminUIFromRegistryEntry', {
      code: 'SHADOW_WARNING',
      trace_id: traceId,
      routeKey: entry.routeKey,
      screen_id: entry.id,
      warnings: warnings.map(w => w.message)
    });
  }
  
  if (errors.length > 0) {
    logError('UIAdminFactory', 'Errors en buildAdminUIFromRegistryEntry', {
      code: 'ENFORCED_ERROR',
      trace_id: traceId,
      routeKey: entry.routeKey,
      screen_id: entry.id,
      errors: errors.map(e => e.message)
    });
  }
  
  return {
    html: newResponse,
    meta
  };
}

