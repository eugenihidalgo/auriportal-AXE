#!/usr/bin/env node
// scripts/audit-no-sqlite.js
// Script de auditoría para prevenir reintroducción de imports de SQLite en rutas runtime

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Patrones a buscar (SQLite legacy)
const PATTERNS = [
  /database\/db\.js/,
  /better-sqlite3/,
  /getDatabase\(/,
  /src\/modules\/streak\.js[^v]/,
  /src\/modules\/nivel\.js[^v]/
];

// Archivos/directorios a excluir (allowlist)
const ALLOWLIST = [
  // Scripts de migración y utilidades (no runtime)
  'scripts/',
  'mcp-server/',
  // Archivos legacy explícitamente marcados como no importados por router
  'src/endpoints/typeform-webhook.js', // Ya delegado a v4
  'src/endpoints/sync-clickup-sql.js', // Ya deshabilitado con 410
  'src/endpoints/sync-all-clickup-sql.js', // Ya deshabilitado con 410
  'src/endpoints/sql-admin.js', // Ya deshabilitado con 410
  'src/endpoints/admin-panel.js', // Legacy, no usado en router principal
  'src/modules/streak.js', // Legacy, no usado en endpoints runtime
  'src/modules/nivel.js', // Legacy, no usado en endpoints runtime
  'database/db.js' // Archivo legacy en sí mismo
];

// Directorios a escanear
const SCAN_DIRS = [
  'src/endpoints',
  'src/router.js',
  'src/modules' // Solo módulos usados por endpoints
];

/**
 * Verifica si un archivo está en la allowlist
 */
function isAllowlisted(filePath) {
  const relativePath = filePath.replace(projectRoot + '/', '');
  return ALLOWLIST.some(allowed => {
    if (allowed.endsWith('/')) {
      return relativePath.startsWith(allowed);
    }
    return relativePath === allowed || relativePath.endsWith('/' + allowed);
  });
}

/**
 * Verifica si un archivo es usado por el router (endpoint runtime)
 */
function isRuntimeEndpoint(filePath) {
  const relativePath = filePath.replace(projectRoot + '/', '');
  // Endpoints y router son runtime
  return relativePath.startsWith('src/endpoints/') || 
         relativePath === 'src/router.js' ||
         (relativePath.startsWith('src/modules/') && !relativePath.includes('-v4'));
}

/**
 * Escanea un archivo en busca de patrones SQLite
 */
function scanFile(filePath) {
  if (isAllowlisted(filePath)) {
    return { matches: [], allowed: true };
  }

  const content = readFileSync(filePath, 'utf-8');
  const matches = [];

  PATTERNS.forEach((pattern, index) => {
    const lines = content.split('\n');
    lines.forEach((line, lineNum) => {
      if (pattern.test(line)) {
        matches.push({
          pattern: pattern.toString(),
          line: lineNum + 1,
          content: line.trim(),
          file: filePath.replace(projectRoot + '/', '')
        });
      }
    });
  });

  return { matches, allowed: false };
}

/**
 * Escanea recursivamente un directorio
 */
function scanDirectory(dirPath) {
  const results = [];
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Saltar node_modules y otros directorios no relevantes
      if (entry === 'node_modules' || entry === '.git' || entry === 'logs') {
        continue;
      }
      results.push(...scanDirectory(fullPath));
    } else if (stat.isFile() && (entry.endsWith('.js') || entry.endsWith('.ts'))) {
      const scanResult = scanFile(fullPath);
      if (scanResult.matches.length > 0) {
        results.push(scanResult);
      }
    }
  }

  return results;
}

/**
 * Función principal
 */
function main() {
  console.log('🔍 Auditoría anti-SQLite: Escaneando rutas runtime...\n');

  const allResults = [];

  // Escanear directorios especificados
  SCAN_DIRS.forEach(dir => {
    const dirPath = join(projectRoot, dir);
    try {
      const stat = statSync(dirPath);
      if (stat.isFile()) {
        // Es un archivo (router.js)
        const scanResult = scanFile(dirPath);
        if (scanResult.matches.length > 0) {
          allResults.push(scanResult);
        }
      } else if (stat.isDirectory()) {
        // Es un directorio
        allResults.push(...scanDirectory(dirPath));
      }
    } catch (err) {
      console.warn(`⚠️  No se pudo escanear ${dir}: ${err.message}`);
    }
  });

  // Filtrar resultados: solo errores en rutas runtime
  const errors = allResults.filter(result => {
    if (result.allowed) return false; // Allowlist OK
    // Verificar si es ruta runtime
    return result.matches.some(match => {
      const filePath = join(projectRoot, match.file);
      return isRuntimeEndpoint(filePath);
    });
  });

  // Mostrar resultados
  if (errors.length === 0) {
    console.log('✅ No se encontraron imports de SQLite en rutas runtime.\n');
    process.exit(0);
  }

  console.error('❌ Se encontraron imports de SQLite en rutas runtime:\n');
  
  errors.forEach(result => {
    result.matches.forEach(match => {
      if (!isAllowlisted(join(projectRoot, match.file))) {
        console.error(`  ${match.file}:${match.line}`);
        console.error(`    ${match.content}`);
        console.error('');
      }
    });
  });

  console.error('💡 Solución:');
  console.error('  - Migra el código a usar PostgreSQL v4 (database/pg.js)');
  console.error('  - O añade el archivo a ALLOWLIST si es legacy no usado en runtime');
  console.error('  - O deshabilita el endpoint con 410 Gone si no es necesario\n');

  process.exit(1);
}

main();









