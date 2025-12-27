/**
 * SIDEBAR RESOLVER v1 - AuriPortal Admin
 * 
 * Resuelve el estado del sidebar basándose en:
 * - Contrato canónico
 * - Permisos del usuario
 * - Ruta actual
 * - Feature flags (si están disponibles)
 * 
 * RESPONSABILIDADES:
 * - Filtrar items por permisos
 * - Filtrar items por feature flags
 * - Marcar item activo según path
 * - Determinar sección abierta
 * - Ordenar items según orden canónico
 */

import { getSidebarItems, getSidebarSections } from './sidebar-contract.js';

/**
 * Resuelve el estado del sidebar para una ruta y usuario dados
 * @param {string} currentPath - Ruta actual
 * @param {Object} userContext - Contexto del usuario (permisos, roles, featureFlags, etc.)
 * @returns {Object} Estado resuelto del sidebar
 */
export function resolveSidebarState(currentPath = '', userContext = {}) {
  const sections = getSidebarSections();
  const allItems = getSidebarItems();
  
  // Obtener feature flags del contexto (si están disponibles)
  const featureFlags = userContext.featureFlags || {};
  
  // Filtrar items visibles y con permisos
  const visibleItems = allItems.filter(item => {
    // Verificar visibilidad
    if (!item.visible) return false;
    
    // Verificar permisos (si hay lógica de permisos)
    if (item.requiresAdmin && !userContext.isAdmin) return false;
    
    // Verificar feature flag (si está definido)
    if (item.featureFlag) {
      // Si el flag está en el contexto, usarlo; si no, asumir false (fail-safe)
      const flagEnabled = featureFlags[item.featureFlag] !== undefined 
        ? featureFlags[item.featureFlag] 
        : false;
      if (!flagEnabled) return false;
    }
    
    // Por ahora, todos los items visibles son accesibles
    return true;
  });
  
  // Agrupar por sección
  const grouped = {};
  visibleItems.forEach(item => {
    const section = item.section === null ? 'Dashboard' : item.section;
    if (!grouped[section]) {
      grouped[section] = [];
    }
    grouped[section].push(item);
  });
  
  // Ordenar items dentro de cada sección
  Object.keys(grouped).forEach(section => {
    grouped[section].sort((a, b) => {
      const orderA = a.order || 999;
      const orderB = b.order || 999;
      return orderA - orderB;
    });
  });
  
  // Determinar item activo
  const activeItem = findActiveItem(visibleItems, currentPath);
  const activeSection = activeItem ? (activeItem.section === null ? 'Dashboard' : activeItem.section) : null;
  
  return {
    grouped,
    activeItem,
    activeSection,
    currentPath,
    sections: Object.keys(sections).sort((a, b) => {
      const orderA = sections[a] || 999;
      const orderB = sections[b] || 999;
      return orderA - orderB;
    })
  };
}

/**
 * Encuentra el item activo basándose en la ruta actual
 * @param {Array} items - Items del sidebar
 * @param {string} currentPath - Ruta actual
 * @returns {Object|null} Item activo o null
 */
function findActiveItem(items, currentPath) {
  if (!currentPath) return null;
  
  // Buscar coincidencia exacta primero
  let active = items.find(item => item.route === currentPath);
  if (active) return active;
  
  // Buscar coincidencia parcial (para subrutas)
  active = items.find(item => {
    if (!item.route) return false;
    
    // Si la ruta actual empieza con la ruta del item
    if (currentPath.startsWith(item.route + '/')) return true;
    
    // Si la ruta actual incluye la ruta del item (para casos especiales)
    if (item.route.includes('/') && currentPath.includes(item.route)) {
      // Verificar que no sea un falso positivo
      const itemParts = item.route.split('/');
      const pathParts = currentPath.split('/');
      return itemParts.every((part, i) => pathParts[i] === part);
    }
    
    return false;
  });
  
  return active || null;
}

/**
 * Marca items como activos en el estado resuelto
 * @param {Object} resolvedState - Estado resuelto del sidebar
 * @returns {Object} Estado con items marcados como activos
 */
export function markActiveItems(resolvedState) {
  const { grouped, activeItem } = resolvedState;
  
  // Marcar items activos en cada sección
  Object.keys(grouped).forEach(section => {
    grouped[section].forEach(item => {
      item.isActive = (activeItem && item.id === activeItem.id);
    });
  });
  
  return resolvedState;
}

