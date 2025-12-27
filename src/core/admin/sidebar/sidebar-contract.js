/**
 * SIDEBAR CONTRACT v1 - AuriPortal Admin
 * 
 * Contrato canónico que declara todas las secciones e items del sidebar.
 * Este contrato es la fuente de verdad única para la estructura del sidebar.
 * 
 * PRINCIPIOS:
 * - Declarativo: Solo datos, sin lógica
 * - Completo: Todas las secciones e items
 * - Versionado: Preparado para futuras extensiones
 * - Inmutable: No se modifica en runtime
 */

import { sidebarRegistry, SECTION_ORDER } from '../sidebar-registry.js';

/**
 * Obtiene el contrato completo del sidebar
 * @returns {Object} Contrato con secciones e items
 */
export function getSidebarContract() {
  return {
    version: '1.0.0',
    sections: SECTION_ORDER,
    items: sidebarRegistry,
    metadata: {
      generated_at: new Date().toISOString(),
      total_items: sidebarRegistry.length,
      total_sections: Object.keys(SECTION_ORDER).length
    }
  };
}

/**
 * Obtiene todas las secciones del contrato
 * @returns {Object} Mapa de secciones con su orden
 */
export function getSidebarSections() {
  return SECTION_ORDER;
}

/**
 * Obtiene todos los items del contrato
 * @returns {Array} Array de items del sidebar
 */
export function getSidebarItems() {
  return sidebarRegistry;
}

/**
 * Obtiene un item por su ID
 * @param {string} id - ID del item
 * @returns {Object|null} Item encontrado o null
 */
export function getSidebarItemById(id) {
  return sidebarRegistry.find(item => item.id === id) || null;
}

/**
 * Obtiene items por sección
 * @param {string|null} section - Nombre de la sección (null para Dashboard)
 * @returns {Array} Items de la sección
 */
export function getSidebarItemsBySection(section) {
  return sidebarRegistry.filter(item => item.section === section);
}

