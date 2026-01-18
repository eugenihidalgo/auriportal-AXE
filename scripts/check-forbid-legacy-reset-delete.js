#!/usr/bin/env node
/**
 * check-forbid-legacy-reset-delete
 *
 * Invariante: En MASTER ningún handler ni servicio usado por MASTER puede invocar
 * deleteState ni deleteStatesByList de cleaning-item-state-repo (reset por DELETE).
 * Reset canónico = evento + effective_since vía cleaning-engine.
 *
 * Busca en:
 * - src/endpoints/master-api*.js
 * - src/core/master/
 * - src/services/alquimia-general-service.js
 * - src/core/master/services/alquimia-reset-service.js
 *
 * Excluye: src/infra/repos/cleaning/cleaning-item-state-repo-pg.js (donde se definen).
 *
 * Si encuentra .deleteState( o .deleteStatesByList( → EXIT 1.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const PATTERNS = ['.deleteState(', '.deleteStatesByList('];

const SCOPE = [
  'src/endpoints/master-api-alquimia-general.js',
  'src/core/master',
  'src/services/alquimia-general-service.js',
  'src/core/master/services/alquimia-reset-service.js'
];

const EXCLUDE = ['cleaning-item-state-repo-pg.js'];

function collectFiles() {
  const out = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    const ents = readdirSync(dir, { withFileTypes: true });
    for (const e of ents) {
      const full = join(dir, e.name);
      if (e.isDirectory() && e.name !== 'node_modules') {
        walk(full);
      } else if (e.isFile() && e.name.endsWith('.js')) {
        out.push(full);
      }
    }
  }
  for (const p of SCOPE) {
    const full = join(ROOT, p);
    if (existsSync(full)) {
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    }
  }
  return out.filter((f) => !EXCLUDE.some((ex) => f.includes(ex)));
}

function run() {
  const files = collectFiles();
  const hits = [];
  for (const f of files) {
    const rel = f.replace(ROOT, '').replace(/\\/g, '/');
    let content;
    try {
      content = readFileSync(f, 'utf8');
    } catch (_) {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pat of PATTERNS) {
        if (line.includes(pat)) {
          const stripped = line.trim();
          if (stripped.startsWith('//') || stripped.startsWith('*')) continue;
          hits.push({ file: rel, line: i + 1, match: pat });
        }
      }
    }
  }
  if (hits.length > 0) {
    console.error('[check:forbid-legacy-reset-delete] LEGACY_RESET_DELETE_FORBIDDEN:');
    for (const h of hits) {
      console.error(`  ${h.file}:${h.line}  ${h.match}`);
    }
    console.error(
      'En MASTER está prohibido usar deleteState/deleteStatesByList. Usa cleaning-engine reset (evento+effective_since).'
    );
    process.exit(1);
  }
  console.log(
    '[check:forbid-legacy-reset-delete] OK: ningún uso de deleteState/deleteStatesByList en ámbito MASTER.'
  );
  process.exit(0);
}

run();
