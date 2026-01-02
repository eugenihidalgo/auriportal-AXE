#!/usr/bin/env node
/**
 * DISCOVER ADMIN SCREENS v1 - AuriPortal Admin
 * 
 * Sistema canónico de descubrimiento y sincronización de pantallas Admin.
 * 
 * OBJETIVO:
 * - Descubrir pantallas Admin visibles en sidebar
 * - Cruzarlas con Router Registry para obtener routeKey y type
 * - Generar reporte y opcionalmente actualizar UI Admin Registry Runtime
 * 
 * FUENTES DE VERDAD:
 * - Sidebar Registry: lista canónica de rutas visibles
 * - Router Registry: lista canónica de rutas registradas (routeKey, type, path)
 * - UI Admin Registry Runtime: entries actuales (para sincronización)
 * 
 * USO:
 *   node scripts/discover-admin-screens.js                    # Solo reporte
 *   node scripts/discover-admin-screens.js --apply           # Actualizar registry runtime
 *   node scripts/discover-admin-screens.js --apply --hide-missing  # Ocultar entradas no visibles
 *   node scripts/discover-admin-screens.js --json             # Output JSON
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getVisibleSidebarItemsFlat } from '../src/core/admin/sidebar-registry.js';
import { ADMIN_ROUTES } from '../src/core/admin/admin-route-registry.js';
import { resolveAdminRoute } from '../src/core/admin/admin-router-resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Configuración
const APPLY_MODE = process.argv.includes('--apply');
const HIDE_MISSING = process.argv.includes('--hide-missing');
const OUTPUT_JSON = process.argv.includes('--json');
const REGISTRY_RUNTIME_PATH = join(projectRoot, 'src/core/admin/ui-factory/ui-admin-registry.runtime.js');

/**
 * Convierte un path a slug para ID (kebab-case)
 * @param {string} path - Ruta (ej: /admin/dashboard)
 * @returns {string} Slug (ej: admin-dashboard)
 */
function pathToSlug(path) {
  if (path === '/admin') {
    return 'admin-home';
  }
  // Remover /admin y convertir a slug
  const withoutAdmin = path.replace(/^\/admin\/?/, '');
  if (!withoutAdmin) {
    return 'admin-home';
  }
  // Reemplazar / por - y limpiar (kebab-case)
  return 'admin-' + withoutAdmin.replace(/\//g, '-').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Genera ID canónico para una entrada
 * @param {string} path - Ruta
 * @param {string} existingId - ID existente (si hay)
 * @returns {string} ID canónico (kebab-case)
 */
function generateCanonicalId(path, existingId = null) {
  // Si ya existe ID, verificar que cumple pattern (kebab-case)
  if (existingId) {
    const kebabPattern = /^[a-z0-9-]+$/;
    if (kebabPattern.test(existingId)) {
      return existingId; // Mantener si cumple pattern
    }
    // Normalizar ID existente que no cumple pattern
    const normalized = existingId.replace(/_/g, '-').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    console.warn(`[DISCOVER] ⚠️  Normalizando ID existente: ${existingId} -> ${normalized}`);
    return normalized;
  }
  return pathToSlug(path);
}

/**
 * Encuentra ruta en Router Registry que coincide con un path
 * @param {string} path - Path a buscar
 * @returns {Object|null} Ruta encontrada o null
 */
function findRouteInRegistry(path) {
  // Normalizar path (remover trailing slash excepto /admin)
  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  
  // PRIORIDAD 1: Buscar coincidencia exacta (sin parámetros)
  let route = ADMIN_ROUTES.find(r => {
    if (r.path.includes(':')) return false; // Saltar rutas con parámetros
    const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
    return routePath === normalizedPath;
  });
  
  if (route) {
    return route;
  }
  
  // PRIORIDAD 2: Buscar rutas con parámetros dinámicos que matchean
  // Ordenar por longitud DESC para priorizar rutas más específicas
  const routesWithParams = ADMIN_ROUTES
    .filter(r => r.path.includes(':'))
    .sort((a, b) => b.path.length - a.path.length);
  
  for (const r of routesWithParams) {
    const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
    
    // Matching de parámetros dinámicos usando regex
    const paramPattern = routePath.replace(/:[^/]+/g, '([^/]+)');
    const regex = new RegExp(`^${paramPattern}$`);
    if (regex.test(normalizedPath)) {
      return r;
    }
  }
  
  // PRIORIDAD 3: Buscar por startsWith (solo rutas sin parámetros que no matchearon exactamente)
  // Esto es para casos edge donde una ruta puede ser prefijo de otra
  const routesWithoutParams = ADMIN_ROUTES.filter(r => !r.path.includes(':'));
  const sortedRoutesWithoutParams = routesWithoutParams.sort((a, b) => b.path.length - a.path.length);
  
  for (const r of sortedRoutesWithoutParams) {
    const routePath = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
    // Solo si es prefijo estricto (no igual, ya se probó en PRIORIDAD 1)
    if (normalizedPath !== routePath && normalizedPath.startsWith(routePath + '/')) {
      return r;
    }
  }
  
  return null;
}

/**
 * Descubre pantallas Admin visibles
 */
async function discoverAdminScreens() {
  console.log('[DISCOVER] Iniciando descubrimiento de pantallas Admin...\n');
  
  // 1. Obtener rutas visibles del sidebar
  const visibleItems = getVisibleSidebarItemsFlat();
  const sidebarVisiblePaths = visibleItems
    .map(item => item.route)
    .filter(route => route && route.startsWith('/admin'));
  
  console.log(`[DISCOVER] Encontradas ${sidebarVisiblePaths.length} rutas visibles en sidebar\n`);
  
  // 2. Filtrar rutas API (no deben estar en sidebar, pero por si acaso)
  const sidebarVisibleNonApi = sidebarVisiblePaths.filter(path => !path.startsWith('/admin/api/'));
  const sidebarVisibleApi = sidebarVisiblePaths.filter(path => path.startsWith('/admin/api/'));
  
  if (sidebarVisibleApi.length > 0) {
    console.warn(`[DISCOVER] ⚠️  WARNING: ${sidebarVisibleApi.length} rutas API encontradas en sidebar (no deberían estar):`);
    sidebarVisibleApi.forEach(path => console.warn(`  - ${path}`));
    console.log('');
  }
  
  // 3. Cruzar con Router Registry
  const matched = [];
  const missingInRouter = [];
  const sidebarVisibleIslands = [];
  const sidebarVisibleNonIslands = [];
  const seenRouteKeys = new Set(); // Evitar duplicados
  
  for (const path of sidebarVisibleNonApi) {
    const route = findRouteInRegistry(path);
    
    if (!route) {
      missingInRouter.push({
        path,
        sidebarItem: visibleItems.find(item => item.route === path)
      });
      continue;
    }
    
    // Evitar duplicados por routeKey
    if (seenRouteKeys.has(route.key)) {
      continue;
    }
    seenRouteKeys.add(route.key);
    
    const match = {
      path,
      routeKey: route.key,
      type: route.type,
      pathPattern: route.path,
      method: route.method || null,
      sidebarItem: visibleItems.find(item => item.route === path)
    };
    
    matched.push(match);
    
    if (route.type === 'island') {
      sidebarVisibleIslands.push(match);
    } else {
      sidebarVisibleNonIslands.push(match);
    }
  }
  
  // 4. Cargar registry runtime actual (si existe)
  let currentRegistry = { entries: [] };
  try {
    const registryModule = await import(REGISTRY_RUNTIME_PATH);
    currentRegistry = registryModule.UI_ADMIN_REGISTRY_RUNTIME || { entries: [] };
  } catch (error) {
    console.warn(`[DISCOVER] No se pudo cargar registry runtime (puede no existir aún): ${error.message}\n`);
  }
  
  // 5. Generar entradas sugeridas
  const suggestedEntries = [];
  const existingByRouteKey = new Map();
  currentRegistry.entries.forEach(entry => {
    existingByRouteKey.set(entry.routeKey, entry);
  });
  
  for (const match of sidebarVisibleIslands) {
    const existing = existingByRouteKey.get(match.routeKey);
    const sidebarItem = match.sidebarItem;
    
    // Generar ID canónico
    const canonicalId = generateCanonicalId(match.path, existing?.id);
    
    // Determinar status
    let status = 'draft';
    if (existing) {
      status = existing.status; // Mantener status existente
    }
    
    // Generar entry sugerida
    const suggestedEntry = {
      id: canonicalId,
      routeKey: match.routeKey,
      status,
      route: {
        path: match.path,
        type: 'island'
      },
      schemaVersion: '1.0.0',
      schemaValidation: existing?.schemaValidation || {
        validated: false,
        validatedAt: null,
        errors: []
      },
      capabilities: existing?.capabilities || [
        'CTX-001', // Acceso a Contexto de Usuario
        'OBS-002', // Propagación de Trace ID
        'ACT-001', // Lectura de Source of Truth
        'NAV-001', // Generación Automática de Sidebar
        'LAY-001'  // Renderizado con Template Base
      ],
      flags: existing?.flags || {
        featureFlags: [],
        permissions: ['admin:read'],
        systemModes: ['NORMAL', 'DEGRADED']
      },
      sidebar: {
        visible: true,
        section: sidebarItem?.section || null,
        subsection: null,
        order: sidebarItem?.order || 999
      },
      metadata: existing?.metadata || {
        tags: [],
        owner: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    
    // Si existe, mantener campos adicionales
    if (existing) {
      // Mantener screenDef si existe
      if (existing.screenDef) {
        suggestedEntry.screenDef = existing.screenDef;
      }
      // Actualizar updatedAt
      suggestedEntry.metadata.updatedAt = new Date().toISOString();
      // Asegurar coherencia de routeKey y path
      if (existing.routeKey !== match.routeKey) {
        console.warn(`[DISCOVER] ⚠️  Coherencia: entry ${canonicalId} tiene routeKey diferente (${existing.routeKey} vs ${match.routeKey})`);
      }
      if (existing.route?.path !== match.path) {
        console.warn(`[DISCOVER] ⚠️  Coherencia: entry ${canonicalId} tiene path diferente (${existing.route?.path} vs ${match.path})`);
        suggestedEntry.route.path = match.path; // Actualizar path
      }
    }
    
    suggestedEntries.push({
      entry: suggestedEntry,
      isNew: !existing,
      isUpdate: !!existing
    });
  }
  
  // 6. Detectar entradas que ya no están en sidebar (si --hide-missing)
  const entriesToHide = [];
  if (HIDE_MISSING) {
    for (const entry of currentRegistry.entries) {
      const stillVisible = sidebarVisibleIslands.some(match => match.routeKey === entry.routeKey);
      if (!stillVisible && entry.status !== 'hidden') {
        entriesToHide.push(entry);
      }
    }
  }
  
  // 7. Generar reporte
  const report = {
    timestamp: new Date().toISOString(),
    sidebar_visible_paths: sidebarVisibleNonApi,
    sidebar_visible_islands: sidebarVisibleIslands.map(m => ({
      path: m.path,
      routeKey: m.routeKey,
      type: m.type
    })),
    sidebar_visible_non_islands: sidebarVisibleNonIslands.map(m => ({
      path: m.path,
      routeKey: m.routeKey,
      type: m.type
    })),
    missing_in_router: missingInRouter.map(m => ({
      path: m.path,
      label: m.sidebarItem?.label
    })),
    matched: matched,
    suggested_registry_entries: suggestedEntries.map(s => ({
      id: s.entry.id,
      routeKey: s.entry.routeKey,
      path: s.entry.route.path,
      status: s.entry.status,
      isNew: s.isNew,
      isUpdate: s.isUpdate
    })),
    entries_to_hide: entriesToHide.map(e => ({
      id: e.id,
      routeKey: e.routeKey,
      path: e.route.path
    })),
    summary: {
      total_sidebar_visible: sidebarVisibleNonApi.length,
      total_islands: sidebarVisibleIslands.length,
      total_non_islands: sidebarVisibleNonIslands.length,
      missing_in_router_count: missingInRouter.length,
      current_registry_entries: currentRegistry.entries.length,
      suggested_new: suggestedEntries.filter(s => s.isNew).length,
      suggested_updates: suggestedEntries.filter(s => s.isUpdate).length,
      entries_to_hide_count: entriesToHide.length
    }
  };
  
  // 8. Mostrar reporte
  if (OUTPUT_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('[DISCOVER] ════════════════════════════════════════');
    console.log('[DISCOVER] RESUMEN:');
    console.log(`[DISCOVER]   Total rutas visibles en sidebar: ${report.summary.total_sidebar_visible}`);
    console.log(`[DISCOVER]   Rutas island: ${report.summary.total_islands}`);
    console.log(`[DISCOVER]   Rutas no-island: ${report.summary.total_non_islands}`);
    console.log(`[DISCOVER]   Rutas no encontradas en Router: ${report.summary.missing_in_router_count}`);
    console.log(`[DISCOVER]   Entradas actuales en registry: ${report.summary.current_registry_entries}`);
    console.log(`[DISCOVER]   Entradas nuevas sugeridas: ${report.summary.suggested_new}`);
    console.log(`[DISCOVER]   Entradas a actualizar: ${report.summary.suggested_updates}`);
    if (HIDE_MISSING) {
      console.log(`[DISCOVER]   Entradas a ocultar: ${report.summary.entries_to_hide_count}`);
    }
    console.log('[DISCOVER] ════════════════════════════════════════\n');
    
    if (missingInRouter.length > 0) {
      console.log('⚠️  RUTAS NO ENCONTRADAS EN ROUTER REGISTRY:');
      missingInRouter.forEach(m => {
        console.log(`  - ${m.path} (${m.sidebarItem?.label || 'sin label'})`);
      });
      console.log('');
    }
    
    if (sidebarVisibleNonIslands.length > 0) {
      console.log('⚠️  RUTAS VISIBLES QUE NO SON ISLANDS:');
      sidebarVisibleNonIslands.forEach(m => {
        console.log(`  - ${m.path} (type: ${m.type})`);
      });
      console.log('');
    }
    
    if (suggestedEntries.length > 0) {
      console.log('📋 ENTRADAS SUGERIDAS:');
      suggestedEntries.forEach(s => {
        const action = s.isNew ? 'NUEVA' : 'ACTUALIZAR';
        console.log(`  [${action}] ${s.entry.id} (${s.entry.routeKey}) -> ${s.entry.route.path}`);
      });
      console.log('');
    }
  }
  
  // 9. Aplicar cambios si --apply
  if (APPLY_MODE) {
    console.log('[DISCOVER] Aplicando cambios al registry runtime...\n');
    
    // Construir nuevo registry
    const newEntries = [...currentRegistry.entries];
    const entriesByRouteKey = new Map();
    newEntries.forEach(entry => {
      entriesByRouteKey.set(entry.routeKey, entry);
    });
    
    // Añadir/actualizar entradas
    for (const suggested of suggestedEntries) {
      const existing = entriesByRouteKey.get(suggested.entry.routeKey);
      if (existing) {
        // Actualizar existente
        const index = newEntries.indexOf(existing);
        newEntries[index] = suggested.entry;
        console.log(`[DISCOVER] ✅ Actualizada: ${suggested.entry.id}`);
      } else {
        // Añadir nueva
        newEntries.push(suggested.entry);
        console.log(`[DISCOVER] ✅ Añadida: ${suggested.entry.id}`);
      }
    }
    
    // Ocultar entradas si --hide-missing
    if (HIDE_MISSING && entriesToHide.length > 0) {
      for (const entryToHide of entriesToHide) {
        const index = newEntries.findIndex(e => e.id === entryToHide.id);
        if (index >= 0) {
          newEntries[index].status = 'hidden';
          newEntries[index].sidebar.visible = false;
          newEntries[index].metadata.updatedAt = new Date().toISOString();
          console.log(`[DISCOVER] ✅ Ocultada: ${entryToHide.id}`);
        }
      }
    }
    
    // Generar nuevo contenido del archivo
    const registryContent = `/**
 * UI ADMIN REGISTRY RUNTIME v1 - AuriPortal Admin
 * 
 * Registry runtime de UIs Admin existentes.
 * 
 * IMPORTANTE:
 * - Estas entradas DESCRIBEN pantallas existentes, no las reemplazan
 * - Todas empiezan en status='draft' para migración gradual
 * - En shadow mode, solo validan y registran warnings
 * - En enforced mode, bloquean si no cumplen contratos
 * 
 * GENERADO AUTOMÁTICAMENTE por: scripts/discover-admin-screens.js
 * FECHA: ${new Date().toISOString()}
 * 
 * ESTRUCTURA:
 * - Cada entrada debe cumplir UI Admin Registry Schema v1
 * - screenDef es opcional (se añadirá gradualmente)
 * - flags y sidebar se configuran según necesidades
 */

export const UI_ADMIN_REGISTRY_RUNTIME = {
  version: '1.0.0',
  entries: ${JSON.stringify(newEntries, null, 2)}
};

/**
 * Busca una entrada por routeKey
 * @param {string} routeKey - Clave de ruta
 * @returns {Object|null} Entrada del registry o null
 */
export function findEntryByRouteKey(routeKey) {
  return UI_ADMIN_REGISTRY_RUNTIME.entries.find(entry => entry.routeKey === routeKey) || null;
}

/**
 * Busca una entrada por id
 * @param {string} id - ID de la entrada
 * @returns {Object|null} Entrada del registry o null
 */
export function findEntryById(id) {
  return UI_ADMIN_REGISTRY_RUNTIME.entries.find(entry => entry.id === id) || null;
}

/**
 * Obtiene todas las entradas activas
 * @returns {Array} Entradas con status='active'
 */
export function getActiveEntries() {
  return UI_ADMIN_REGISTRY_RUNTIME.entries.filter(entry => entry.status === 'active');
}

/**
 * Obtiene todas las entradas visibles en sidebar
 * @returns {Array} Entradas con sidebar.visible=true y status IN ('active', 'deprecated')
 */
export function getSidebarVisibleEntries() {
  return UI_ADMIN_REGISTRY_RUNTIME.entries.filter(entry => 
    entry.sidebar.visible && 
    (entry.status === 'active' || entry.status === 'deprecated')
  );
}
`;
    
    // Escribir archivo
    writeFileSync(REGISTRY_RUNTIME_PATH, registryContent, 'utf-8');
    console.log(`\n[DISCOVER] ✅ Registry runtime actualizado: ${REGISTRY_RUNTIME_PATH}`);
    console.log(`[DISCOVER]   Total entradas: ${newEntries.length}`);
  }
  
  return report;
}

// Ejecutar
discoverAdminScreens().catch(error => {
  console.error('[DISCOVER] ❌ Error fatal:', error);
  process.exit(1);
});

