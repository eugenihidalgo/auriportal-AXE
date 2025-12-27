// src/core/ui-experience/registry.js
// Sistema de Registros de Extensibilidad para UI & Experience System
//
// Este sistema permite registrar nuevos layer_type y component_type sin tocar el engine.
// Garantiza que el sistema NUNCA se cierre y siempre permita añadir nuevas funcionalidades.

import { logWarn, logError } from '../observability/logger.js';
import { getRequestId } from '../observability/request-context.js';

/**
 * @typedef {Object} LayerHook
 * @property {Function} [beforeRender] - Hook ejecutado antes de renderizar (screen, ctx) => screen
 * @property {Function} [decorateHtml] - Hook ejecutado para decorar HTML (html, ctx) => html
 * @property {Function} [injectHead] - Hook ejecutado para inyectar en <head> (headTags, ctx) => headTags
 * @property {Function} [injectBodyTop] - Hook ejecutado para inyectar al inicio de <body> (nodes, ctx) => nodes
 * @property {Function} [injectBodyBottom] - Hook ejecutado para inyectar al final de <body> (nodes, ctx) => nodes
 * @property {Function} [onClientBootstrap] - Hook ejecutado para datos JS cliente (config, ctx) => config
 */

/**
 * @typedef {Object} LayerTypeDefinition
 * @property {string} layerType - Tipo de layer (ej: transition_background_v1)
 * @property {Function} validateConfig - Función de validación de config (config) => { valid: boolean, error?: string }
 * @property {LayerHook} hooks - Hooks soportados por el layer
 * @property {Object} securityLimits - Límites de seguridad (maxConfigSize, allowedFields, etc.)
 */

/**
 * @typedef {Object} ComponentTypeDefinition
 * @property {string} componentType - Tipo de componente (ej: button, card, modal)
 * @property {Function} render - Función de renderizado (props, ctx) => html
 * @property {Function} validateProps - Función de validación de props (props) => { valid: boolean, error?: string }
 * @property {Object} securityLimits - Límites de seguridad
 */

/**
 * Registry de Layer Types
 * Permite registrar nuevos layer_type sin modificar el engine
 */
class LayerRegistry {
  constructor() {
    this.registry = new Map(); // layerType -> LayerTypeDefinition
  }

  /**
   * Registra un nuevo layer type
   * 
   * @param {LayerTypeDefinition} definition - Definición del layer type
   * @throws {Error} Si la definición es inválida
   */
  register(definition) {
    if (!definition || !definition.layerType) {
      throw new Error('layerType es requerido en la definición');
    }

    if (this.registry.has(definition.layerType)) {
      logWarn('layer_registry', `Layer type ya registrado: ${definition.layerType}`, {
        layerType: definition.layerType,
        requestId: getRequestId()
      });
      // Permitir re-registro (útil para hot-reload en desarrollo)
    }

    // Validar que tenga al menos un hook
    const hasHooks = definition.hooks && (
      definition.hooks.beforeRender ||
      definition.hooks.decorateHtml ||
      definition.hooks.injectHead ||
      definition.hooks.injectBodyTop ||
      definition.hooks.injectBodyBottom ||
      definition.hooks.onClientBootstrap
    );

    if (!hasHooks) {
      throw new Error(`Layer type ${definition.layerType} debe tener al menos un hook`);
    }

    // Validar que validateConfig sea una función
    if (!definition.validateConfig || typeof definition.validateConfig !== 'function') {
      throw new Error(`Layer type ${definition.layerType} debe tener validateConfig como función`);
    }

    this.registry.set(definition.layerType, {
      layerType: definition.layerType,
      validateConfig: definition.validateConfig,
      hooks: definition.hooks || {},
      securityLimits: definition.securityLimits || {
        maxConfigSize: 16 * 1024, // 16KB por defecto
        allowedFields: [] // Todos los campos permitidos por defecto
      }
    });

    logWarn('layer_registry', `Layer type registrado: ${definition.layerType}`, {
      layerType: definition.layerType,
      requestId: getRequestId()
    });
  }

  /**
   * Obtiene la definición de un layer type
   * 
   * @param {string} layerType - Tipo de layer
   * @returns {LayerTypeDefinition|null} Definición del layer type o null si no existe
   */
  get(layerType) {
    return this.registry.get(layerType) || null;
  }

  /**
   * Verifica si un layer type está registrado
   * 
   * @param {string} layerType - Tipo de layer
   * @returns {boolean} true si está registrado
   */
  has(layerType) {
    return this.registry.has(layerType);
  }

  /**
   * Lista todos los layer types registrados
   * 
   * @returns {Array<string>} Array de layer types
   */
  listAll() {
    return Array.from(this.registry.keys());
  }
}

/**
 * Registry de Component Types
 * Permite registrar nuevos componentes sin modificar el engine
 */
class ComponentRegistry {
  constructor() {
    this.registry = new Map(); // componentType -> ComponentTypeDefinition
  }

  /**
   * Registra un nuevo component type
   * 
   * @param {ComponentTypeDefinition} definition - Definición del component type
   * @throws {Error} Si la definición es inválida
   */
  register(definition) {
    if (!definition || !definition.componentType) {
      throw new Error('componentType es requerido en la definición');
    }

    if (this.registry.has(definition.componentType)) {
      logWarn('component_registry', `Component type ya registrado: ${definition.componentType}`, {
        componentType: definition.componentType,
        requestId: getRequestId()
      });
      // Permitir re-registro (útil para hot-reload en desarrollo)
    }

    // Validar que tenga función render
    if (!definition.render || typeof definition.render !== 'function') {
      throw new Error(`Component type ${definition.componentType} debe tener render como función`);
    }

    this.registry.set(definition.componentType, {
      componentType: definition.componentType,
      render: definition.render,
      validateProps: definition.validateProps || (() => ({ valid: true })),
      securityLimits: definition.securityLimits || {
        maxPropsSize: 8 * 1024, // 8KB por defecto
        allowedFields: []
      }
    });

    logWarn('component_registry', `Component type registrado: ${definition.componentType}`, {
      componentType: definition.componentType,
      requestId: getRequestId()
    });
  }

  /**
   * Obtiene la definición de un component type
   * 
   * @param {string} componentType - Tipo de componente
   * @returns {ComponentTypeDefinition|null} Definición del component type o null si no existe
   */
  get(componentType) {
    return this.registry.get(componentType) || null;
  }

  /**
   * Verifica si un component type está registrado
   * 
   * @param {string} componentType - Tipo de componente
   * @returns {boolean} true si está registrado
   */
  has(componentType) {
    return this.registry.has(componentType);
  }

  /**
   * Lista todos los component types registrados
   * 
   * @returns {Array<string>} Array de component types
   */
  listAll() {
    return Array.from(this.registry.keys());
  }
}

// Instancias singleton globales
let layerRegistryInstance = null;
let componentRegistryInstance = null;

/**
 * Obtiene la instancia singleton del LayerRegistry
 * 
 * @returns {LayerRegistry} Instancia del registry
 */
export function getLayerRegistry() {
  if (!layerRegistryInstance) {
    layerRegistryInstance = new LayerRegistry();
  }
  return layerRegistryInstance;
}

/**
 * Obtiene la instancia singleton del ComponentRegistry
 * 
 * @returns {ComponentRegistry} Instancia del registry
 */
export function getComponentRegistry() {
  if (!componentRegistryInstance) {
    componentRegistryInstance = new ComponentRegistry();
  }
  return componentRegistryInstance;
}

// Exportar también las clases para permitir crear instancias personalizadas
export { LayerRegistry, ComponentRegistry };




















