#!/usr/bin/env node
/**
 * check-action-registry-parity
 *
 * Evita desincronización src/ vs public/: valida que las acciones críticas
 * de alquimia existan en public/js/core/ux/action-registry/alquimia-actions.js
 * (el archivo que carga el ux-action-registry-loader en el browser).
 *
 * Acciones requeridas:
 * - alquimia.reset
 * - alquimia.clean
 * - alquimia.clean_all
 * - alquimia.restore_defaults
 * - alquimia.reset_overrides (alias, compat)
 *
 * EXIT 1 si falta alguna.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const FILE = join(ROOT, 'public/js/core/ux/action-registry/alquimia-actions.js');

const REQUIRED = [
  'alquimia.reset',
  'alquimia.clean',
  'alquimia.clean_all',
  'alquimia.restore_defaults',
  'alquimia.reset_overrides'
];

function run() {
  let content;
  try {
    content = readFileSync(FILE, 'utf8');
  } catch (e) {
    console.error('[check-action-registry-parity] No se pudo leer', FILE, e.message);
    process.exit(1);
  }

  const missing = [];
  for (const id of REQUIRED) {
    // match action_id: 'alquimia.xxx' o "alquimia.xxx"
    const re = new RegExp(`action_id:\\s*['"]${id.replace(/\./g, '\\.')}['"]`);
    if (!re.test(content)) {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    console.error('[check-action-registry-parity] Faltan en public/.../alquimia-actions.js:', missing.join(', '));
    console.error('Asegúrate de que el registry que carga el browser tiene estas acciones.');
    process.exit(1);
  }

  console.log('[check-action-registry-parity] OK: todas las acciones críticas en public/.../alquimia-actions.js');
  process.exit(0);
}

run();
