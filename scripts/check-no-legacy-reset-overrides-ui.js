#!/usr/bin/env node
/**
 * check-no-legacy-reset-overrides-ui
 *
 * Falla (exit 1) si master-alquimia-general-client.js contiene 'alquimia.reset_overrides'.
 * La UI debe usar solo 'alquimia.restore_defaults'. El alias reset_overrides existe en
 * el registry por compatibilidad, pero la UI no debe invocarlo.
 *
 * UX_ACTION_EXECUTION_KEY_UNIQUE_V1 + RESTORE_DEFAULTS: evita "action_id not registered"
 * por rutas o cargas que no tengan el alias; y evita confusión reset vs restore.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const FILE = join(ROOT, 'public/js/master/master-alquimia-general-client.js');

const FORBIDDEN = 'alquimia.reset_overrides';

function run() {
  let content;
  try {
    content = readFileSync(FILE, 'utf8');
  } catch (e) {
    console.error('[check-no-legacy-reset-overrides-ui] No se pudo leer', FILE, e.message);
    process.exit(1);
  }

  if (content.includes(FORBIDDEN)) {
    console.error('[check-no-legacy-reset-overrides-ui] PROHIBIDO:', FORBIDDEN, 'en', FILE);
    console.error('Usa action_id: \'alquimia.restore_defaults\' en la UI.');
    process.exit(1);
  }

  console.log('[check-no-legacy-reset-overrides-ui] OK: ningún', FORBIDDEN, 'en UI');
  process.exit(0);
}

run();
