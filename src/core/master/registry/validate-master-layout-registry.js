#!/usr/bin/env node
/**
 * VALIDATOR MASTER LAYOUT REGISTRY v1
 * 
 * Valida el Master Layout Registry contra el schema.
 * 
 * Uso:
 *   node validate-master-layout-registry.js
 *   npm run validate:master-layout
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REGISTRY_PATH = join(__dirname, 'master-layout-registry.v1.json');

function validateMasterLayoutRegistry() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  VALIDATOR MASTER LAYOUT REGISTRY v1                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Cargar registry
    const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
    const registry = JSON.parse(registryContent);
    
    console.log('✅ Registry cargado correctamente');
    console.log(`   Schema: ${registry.schema}`);
    console.log(`   Version: ${registry.version}\n`);
    
    const errors = [];
    const warnings = [];
    
    // Validar schema
    if (registry.schema !== 'auri.master.layout_registry.v1') {
      errors.push(`Schema inválido: esperado 'auri.master.layout_registry.v1', encontrado '${registry.schema}'`);
    }
    
    // Validar universes
    if (!Array.isArray(registry.universes)) {
      errors.push('universes debe ser un array');
    } else {
      const universeIds = new Set();
      for (const universe of registry.universes) {
        // Validar ID único
        if (universeIds.has(universe.id)) {
          errors.push(`Universe ID duplicado: ${universe.id}`);
        }
        universeIds.add(universe.id);
        
        // Validar campos requeridos
        if (!universe.layout_id) {
          errors.push(`Universe ${universe.id} sin layout_id`);
        }
        if (!universe.sidebar_id) {
          errors.push(`Universe ${universe.id} sin sidebar_id`);
        }
        if (!universe.entry_route_key) {
          errors.push(`Universe ${universe.id} sin entry_route_key`);
        }
        
        // Validar que layout existe
        const layoutExists = registry.layouts?.some(l => l.id === universe.layout_id);
        if (!layoutExists) {
          errors.push(`Universe ${universe.id} referencia layout inexistente: ${universe.layout_id}`);
        }
        
        // Validar que sidebar existe
        const sidebarExists = registry.sidebars?.some(s => s.id === universe.sidebar_id);
        if (!sidebarExists) {
          errors.push(`Universe ${universe.id} referencia sidebar inexistente: ${universe.sidebar_id}`);
        }
      }
    }
    
    // Validar layouts
    if (!Array.isArray(registry.layouts)) {
      errors.push('layouts debe ser un array');
    } else {
      const layoutIds = new Set();
      for (const layout of registry.layouts) {
        if (layoutIds.has(layout.id)) {
          errors.push(`Layout ID duplicado: ${layout.id}`);
        }
        layoutIds.add(layout.id);
        
        // Validar slots requeridos
        const requiredSlots = ['sidebar', 'main', 'notes_panel', 'diagnostics_panel'];
        if (!Array.isArray(layout.slots)) {
          errors.push(`Layout ${layout.id} sin slots array`);
        } else {
          for (const requiredSlot of requiredSlots) {
            if (!layout.slots.includes(requiredSlot)) {
              errors.push(`Layout ${layout.id} falta slot requerido: ${requiredSlot}`);
            }
          }
        }
        
        // Validar constraints
        const forbidden = ['inline_js', 'dynamic_innerHTML', 'html_in_js_strings', 'base_html_reuse', 'admin_reuse'];
        if (!Array.isArray(layout.constraints)) {
          errors.push(`Layout ${layout.id} sin constraints array`);
        } else {
          for (const constraint of forbidden) {
            if (!layout.constraints.includes(`no_${constraint}`)) {
              warnings.push(`Layout ${layout.id} no declara constraint: no_${constraint}`);
            }
          }
        }
      }
    }
    
    // Validar sidebars
    if (!Array.isArray(registry.sidebars)) {
      errors.push('sidebars debe ser un array');
    } else {
      const sidebarIds = new Set();
      for (const sidebar of registry.sidebars) {
        if (sidebarIds.has(sidebar.id)) {
          errors.push(`Sidebar ID duplicado: ${sidebar.id}`);
        }
        sidebarIds.add(sidebar.id);
        
        // Validar que universe_id existe
        const universeExists = registry.universes?.some(u => u.id === sidebar.universe_id);
        if (!universeExists) {
          errors.push(`Sidebar ${sidebar.id} referencia universe inexistente: ${sidebar.universe_id}`);
        }
      }
    }
    
    // Validar routes
    if (!Array.isArray(registry.routes)) {
      errors.push('routes debe ser un array');
    } else {
      for (const route of registry.routes) {
        // Validar que path_hint empieza con /master
        if (route.path_hint && !route.path_hint.startsWith('/master')) {
          errors.push(`Route ${route.route_key} tiene path_hint que no empieza con /master: ${route.path_hint}`);
        }
        
        // Validar que universe_id existe
        const universeExists = registry.universes?.some(u => u.id === route.universe_id);
        if (!universeExists) {
          errors.push(`Route ${route.route_key} referencia universe inexistente: ${route.universe_id}`);
        }
        
        // Validar que layout_id existe
        const layoutExists = registry.layouts?.some(l => l.id === route.layout_id);
        if (!layoutExists) {
          errors.push(`Route ${route.route_key} referencia layout inexistente: ${route.layout_id}`);
        }
      }
    }
    
    // Reportar resultados
    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      for (const warning of warnings) {
        console.log(`   - ${warning}`);
      }
      console.log('');
    }
    
    if (errors.length > 0) {
      console.log('❌ ERRORES:');
      for (const error of errors) {
        console.log(`   - ${error}`);
      }
      console.log('');
      console.log('❌ Validación FALLIDA');
      process.exit(1);
    } else {
      console.log('✅ Validación EXITOSA');
      console.log(`   Universes: ${registry.universes?.length || 0}`);
      console.log(`   Layouts: ${registry.layouts?.length || 0}`);
      console.log(`   Sidebars: ${registry.sidebars?.length || 0}`);
      console.log(`   Routes: ${registry.routes?.length || 0}`);
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error validando registry:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  validateMasterLayoutRegistry();
}

export { validateMasterLayoutRegistry };


