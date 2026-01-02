#!/usr/bin/env node
/**
 * CLI para validar LayoutRegistry v1
 * 
 * Uso:
 *   node src/core/admin/layout/validate-layout-registry-cli.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { validateLayoutRegistry } from './layout-registry-validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REGISTRY_PATH = join(__dirname, 'layout-registry.v1.json');

function main() {
  console.log('[LayoutRegistry] Validando registry...');
  console.log(`[LayoutRegistry] Archivo: ${REGISTRY_PATH}`);

  try {
    // Leer el JSON
    const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
    const registry = JSON.parse(registryContent);

    // Validar
    const result = validateLayoutRegistry(registry);

    if (result.ok) {
      console.log('[LayoutRegistry] ✅ Validación exitosa');
      console.log(`[LayoutRegistry] - Universes: ${registry.universes.length}`);
      console.log(`[LayoutRegistry] - Layouts: ${registry.layouts.length}`);
      console.log(`[LayoutRegistry] - Sidebars: ${registry.sidebars.length}`);
      console.log(`[LayoutRegistry] - Routes: ${registry.routes.length}`);
      process.exit(0);
    } else {
      console.error(`[LayoutRegistry] ❌ Validación falló: ${result.error}`);
      if (result.details && result.details.length > 0) {
        console.error('[LayoutRegistry] Detalles:');
        result.details.forEach((detail, index) => {
          console.error(`[LayoutRegistry]   ${index + 1}. ${detail}`);
        });
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(`[LayoutRegistry] ❌ Error leyendo o parseando registry: ${error.message}`);
    console.error(`[LayoutRegistry] Stack: ${error.stack}`);
    process.exit(1);
  }
}

main();


