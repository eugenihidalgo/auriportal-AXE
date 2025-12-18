// src/core/navigation/navigation-renderer.js
// Helper para cargar y transformar navegación publicada para renderizado en templates
//
// RESPONSABILIDAD:
// - Cargar la navegación publicada desde PostgreSQL
// - Evaluar visibilidad según el alumno (usando visibility-evaluator)
// - Transformar nodos en items renderizables para templates HTML
//
// REGLA: Fail-open. Si algo falla, devolver [] (Home vacía, no rota)

import { getDefaultNavigationRepo } from '../../infra/repos/navigation-repo-pg.js';
import { evaluateNavigationForStudent } from './visibility-evaluator.js';
import { logInfo, logWarn, logError } from '../observability/logger.js';

/**
 * Obtiene los items de navegación filtrados para un estudiante
 * 
 * @param {Object} studentCtx - Contexto del estudiante (de buildStudentContext)
 * @param {string} [navId='main-navigation'] - ID de la navegación a cargar
 * @param {string} [zone='home'] - Zona de navegación: 'home', 'practica', 'personal', 'sidebar'
 * @returns {Promise<Array>} Array de items renderizables para el template
 * 
 * Cada item tiene:
 * - id: string - ID único del nodo
 * - label: string - Texto del botón
 * - icon: string - Emoji/icono (puede estar vacío)
 * - target_type: string - 'recorrido' | 'screen' | 'url' | 'modal'
 * - target_ref: string - Referencia según target_type
 * - kind: string - Tipo de nodo (section/group/item/hub/external_link/system_entry)
 * - order: number - Orden de visualización
 * - layout_hint: string - Hint de layout (list/grid/map/cards/tree)
 * - is_active: boolean - Si el item está activo según currentPath
 * - css_class: string - Clases CSS para el botón
 * - section_id: string - ID de la sección padre (si aplica)
 */
export async function getNavigationItemsForStudent(studentCtx, navId = 'main-navigation', zone = 'home', currentPath = null) {
  try {
    const repo = getDefaultNavigationRepo();
    
    // Cargar la navegación publicada más reciente
    const published = await repo.getPublishedLatest(navId);

    if (!published) {
      logWarn('navigation-renderer', 'No hay navegación publicada', { navId });
      return [];
    }

    // definition_json contiene la NavigationDefinition
    const definition = published.definition_json;
    
    if (!definition) {
      logWarn('navigation-renderer', 'Navegación publicada sin definition_json', { navId });
      return [];
    }

    // Evaluar visibilidad según el estudiante
    const filtered = evaluateNavigationForStudent(definition, studentCtx);

    // Extraer nodos del root usando edges
    const nodes = filtered.nodes;
    const edges = filtered.edges;
    
    if (!nodes || !edges) {
      // Si no hay estructura nodes/edges, intentar con sections (formato legacy)
      if (filtered.sections && Array.isArray(filtered.sections)) {
        return extractItemsFromSections(filtered.sections);
      }
      
      logWarn('navigation-renderer', 'Navegación sin estructura de nodos válida', { 
        navId,
        hasNodes: !!nodes,
        hasEdges: !!edges,
        hasSections: !!filtered.sections
      });
      return [];
    }

    // Construir árbol desde entry_node_id
    const entryNodeId = filtered.entry_node_id;
    if (!entryNodeId || !nodes[entryNodeId]) {
      logWarn('navigation-renderer', 'No hay entry_node_id válido', { navId, entryNodeId });
      return [];
    }
    
    // Construir mapa de hijos desde edges
    const childrenMap = {};
    edges.forEach(edge => {
      if (edge.kind === 'child' || !edge.kind) {
        if (!childrenMap[edge.from]) {
          childrenMap[edge.from] = [];
        }
        childrenMap[edge.from].push({
          nodeId: edge.to,
          order: edge.order || 0
        });
      }
    });
    
    // Ordenar hijos por order
    Object.keys(childrenMap).forEach(parentId => {
      childrenMap[parentId].sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    
    // Filtrar por zone usando normalizeZones y matchesZone
    function normalizeZones(node) {
      // Si el nodo tiene meta.zone, puede ser string o array
      if (node.meta?.zone) {
        if (Array.isArray(node.meta.zone)) {
          return node.meta.zone;
        }
        return [node.meta.zone];
      }
      
      // Fallback: mapear layout_hint a zone si no hay meta.zone (solo compat legacy)
      if (node.layout_hint) {
        const layoutToZones = {
          'list': ['home', 'practica', 'personal', 'sidebar'],
          'grid': ['home', 'practica'],
          'cards': ['home', 'personal'],
          'tree': ['sidebar'],
          'map': ['home']
        };
        return layoutToZones[node.layout_hint] || [];
      }
      
      // Por defecto, sin zones específicas
      return [];
    }
    
    function matchesZone(node, targetZone) {
      const zones = normalizeZones(node);
      return zones.includes(targetZone);
    }
    
    // Función legacy para compatibilidad (mantener por ahora)
    function nodeMatchesZone(node, nodeId) {
      return matchesZone(node, zone);
    }
    
    // Recorrer árbol desde entry_node_id y extraer nodos de la zone
    const items = [];
    const studentLevel = studentCtx?.nivelInfo?.nivel || 1;
    
    function processNode(nodeId, parentSectionId = null, visited = new Set()) {
      if (visited.has(nodeId)) return; // Evitar loops
      visited.add(nodeId);
      
      const node = nodes[nodeId];
      if (!node) return;
      
      // Verificar visibilidad del estudiante
      if (node.visibility?.min_nivel_efectivo) {
        if (studentLevel < node.visibility.min_nivel_efectivo) {
          return; // Nodo no visible para este estudiante
        }
      }
      
      // Si el nodo coincide con la zone, añadirlo
      if (matchesZone(node, zone)) {
        const item = transformNodeToItem(node, currentPath);
        if (parentSectionId) {
          item.section_id = parentSectionId;
        }
        items.push(item);
      }
      
      // Procesar hijos recursivamente
      const children = childrenMap[nodeId] || [];
      const sectionId = node.kind === 'section' ? node.id : parentSectionId;
      
      children.forEach(child => {
        processNode(child.nodeId, sectionId, new Set(visited));
      });
    }
    
    // Empezar desde entry_node_id
    processNode(entryNodeId);
    
    // Ordenar items por order
    items.sort((a, b) => (a.order || 0) - (b.order || 0));

    logInfo('navigation-renderer', 'Navegación cargada', {
      navId,
      zone,
      version: published.version,
      totalItems: items.length,
      studentLevel: studentCtx?.nivelInfo?.nivel || 1
    });

    return items;

  } catch (error) {
    // FAIL-OPEN: Si algo falla, devolver array vacío (Home no rompe)
    logError('navigation-renderer', 'Error cargando navegación', {
      navId,
      error: error.message,
      stack: error.stack
    });
    return [];
  }
}

/**
 * Transforma un nodo de navegación en un item renderizable
 * 
 * @param {Object} node - Nodo de NavigationDefinition
 * @param {string|null} currentPath - Ruta actual para determinar is_active
 * @returns {Object} Item renderizable
 */
function transformNodeToItem(node, currentPath = null) {
  // Determinar target_ref y target_type
  let targetRef = '#';
  let targetType = 'screen';

  if (node.target) {
    targetRef = node.target.ref || '#';
    targetType = node.target.type || 'screen';
  }

  // Determinar si el item está activo (consistente)
  let isActive = false;
  if (currentPath && targetRef) {
    if (targetType === 'recorrido') {
      // Para recorridos: activo si currentPath incluye /recorrido/<id>
      isActive = currentPath.includes(`/recorrido/${targetRef}`) || 
                 currentPath.startsWith(`/recorrido/${targetRef}/`);
    } else if (targetType === 'url') {
      // URLs externas: nunca activo (no aplica)
      isActive = false;
    } else if (targetType === 'screen') {
      // Screens: exact match para rutas específicas, prefix para rutas generales
      // Decisión: exact para /perfil-personal, prefix para /recorrido/*
      if (targetRef === '/perfil-personal') {
        isActive = currentPath === targetRef;
      } else {
        isActive = currentPath === targetRef || currentPath.startsWith(targetRef + '/');
      }
    } else {
      // Por defecto: prefix matching
      isActive = currentPath === targetRef || currentPath.startsWith(targetRef + '/');
    }
  }

  // Construir clases CSS
  const cssClasses = ['nav-item'];
  
  if (node.kind) {
    cssClasses.push(`nav-item--${node.kind}`);
  }
  
  if (node.style) {
    cssClasses.push(`nav-item--${node.style}`);
  }
  
  if (isActive) {
    cssClasses.push('nav-item--active');
  }

  return {
    id: node.id || '',
    label: node.label || '',
    icon: node.icon || '',
    subtitle: node.subtitle || '',
    target_type: targetType,
    target_ref: targetRef,
    kind: node.kind || 'item',
    order: node.order || 0,
    layout_hint: node.layout_hint || null,
    is_active: isActive,
    css_class: cssClasses.join(' ')
  };
}

/**
 * Extrae items de formato sections (legacy/alternativo)
 * 
 * @param {Array} sections - Array de secciones
 * @returns {Array} Items renderizables
 */
function extractItemsFromSections(sections) {
  const items = [];

  for (const section of sections) {
    if (!section.items || !Array.isArray(section.items)) continue;

    for (const item of section.items) {
      items.push({
        item_id: item.item_id || item.id || '',
        label: item.label || '',
        icon: item.icon || '',
        target: item.target || '#',
        target_type: item.target_type || 'screen',
        css_class: `nav-item nav-item--${item.kind || 'action'}`
      });
    }
  }

  return items;
}

export default { getNavigationItemsForStudent };

