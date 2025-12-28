// context-request-builders.js
// Builders para ContextRequest
//
// Responsabilidades:
// - Construir ContextRequest desde package definition
// - Construir ContextRequest desde theme definition

import { getRequestId } from '../observability/request-context.js';

/**
 * Construye ContextRequest desde package definition
 * 
 * @param {Object} options - Opciones
 * @param {Object} options.packageDefinition - Definición del paquete
 * @param {string} [options.requestId] - Request ID
 * @returns {Object} ContextRequest
 */
export function buildContextRequestFromPackage({
  packageDefinition,
  requestId = null
}) {
  if (!packageDefinition || !packageDefinition.package_key) {
    throw new Error('buildContextRequestFromPackage: packageDefinition.package_key is required');
  }

  const { context_contract = {} } = packageDefinition;
  const { inputs = [] } = context_contract;

  // Separar required y optional según el contrato
  const required = [];
  const optional = [];

  for (const input of inputs) {
    const key = input.key || input.context_key;
    if (!key) continue;

    if (input.required === true || input.required === undefined) {
      // Si no se especifica required, asumir required (comportamiento legacy)
      required.push(key);
    } else {
      optional.push(key);
    }
  }

  return {
    required,
    optional,
    purpose: 'package',
    include: {
      snapshotPaths: ['student.*', 'environment.*', 'time.*', 'flags.*'],
      pdeContexts: true,
      derived: true,
      flags: true
    },
    meta: {
      targetKey: packageDefinition.package_key,
      targetType: 'package',
      requestId: requestId || getRequestId() || 'unknown'
    }
  };
}

/**
 * Construye ContextRequest desde theme definition
 * 
 * Un tema puede declarar context_request en su definition_json.
 * Si no lo declara, usa defaults seguros.
 * 
 * @param {Object} options - Opciones
 * @param {Object} options.themeDefinition - Definición del tema
 * @param {string} [options.requestId] - Request ID
 * @returns {Object} ContextRequest
 */
export function buildContextRequestFromTheme({
  themeDefinition,
  requestId = null
}) {
  if (!themeDefinition || (!themeDefinition.theme_key && !themeDefinition.id)) {
    throw new Error('buildContextRequestFromTheme: themeDefinition.theme_key or themeDefinition.id is required');
  }

  const themeKey = themeDefinition.theme_key || themeDefinition.id;
  const definitionJson = themeDefinition.definition_json || themeDefinition;

  // Si el tema declara context_request, usarlo
  if (definitionJson.context_request) {
    const { required = [], optional = [], include = {} } = definitionJson.context_request;

    return {
      required: Array.isArray(required) ? required : [],
      optional: Array.isArray(optional) ? optional : [],
      purpose: 'theme',
      include: {
        snapshotPaths: include.snapshotPaths || ['identity.*', 'environment.*', 'student.nivelEfectivo'],
        pdeContexts: include.pdeContexts !== undefined ? include.pdeContexts : false,
        derived: include.derived !== undefined ? include.derived : false,
        flags: include.flags !== undefined ? include.flags : true
      },
      meta: {
        targetKey: themeKey,
        targetType: 'theme',
        requestId: requestId || getRequestId() || 'unknown'
      }
    };
  }

  // Defaults seguros si no declara context_request
  return {
    required: ['actor_type'],
    optional: ['nivel_efectivo', 'sidebar_context'],
    purpose: 'theme',
    include: {
      snapshotPaths: ['identity.*', 'environment.*', 'student.nivelEfectivo'],
      pdeContexts: false,
      derived: false,
      flags: true
    },
    meta: {
      targetKey: themeKey,
      targetType: 'theme',
      requestId: requestId || getRequestId() || 'unknown'
    }
  };
}

