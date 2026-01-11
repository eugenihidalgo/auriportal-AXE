#!/usr/bin/env node
/**
 * CHECK HTTP CONTRACT v1 - AuriPortal
 * 
 * Assembly check mínimo para verificar contrato HTTP canónico.
 * 
 * Verifica:
 * - Endpoints GOD usan http-json-v1.js
 * - Lista archivos MASTER que todavía usan helpers antiguos (solo reporte, no fail-hard)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Busca archivos que usan helpers HTTP antiguos
 */
function findFilesUsingOldHelpers(directory, pattern) {
  const files = [];
  
  function walkDir(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // Skip node_modules y otros
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (pattern.test(content)) {
            files.push(fullPath.replace(projectRoot + '/', ''));
          }
        } catch (e) {
          // Skip errores de lectura
        }
      }
    }
  }
  
  walkDir(directory);
  return files;
}

/**
 * Verifica que endpoints GOD usan http-json-v1.js
 */
function checkGodEndpoints() {
  const godEndpointDir = join(projectRoot, 'src/endpoints');
  const godEndpoints = findFilesUsingOldHelpers(
    godEndpointDir,
    /god-api-.*\.js$/
  ).filter(f => f.includes('god-api-'));
  
  const issues = [];
  
  for (const file of godEndpoints) {
    const fullPath = join(projectRoot, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      
      // Verificar que importa http-json-v1
      if (!content.includes('http-json-v1')) {
        issues.push({
          file,
          issue: 'No usa http-json-v1.js',
          severity: 'error'
        });
      } else {
        // Verificar que usa sendJsonOk o sendJsonError
        if (!content.includes('sendJsonOk') && !content.includes('sendJsonError')) {
          issues.push({
            file,
            issue: 'Importa http-json-v1 pero no usa sendJsonOk/sendJsonError',
            severity: 'warning'
          });
        }
      }
    } catch (e) {
      issues.push({
        file,
        issue: `Error leyendo archivo: ${e.message}`,
        severity: 'error'
      });
    }
  }
  
  return {
    checked: godEndpoints.length,
    issues
  };
}

/**
 * Lista archivos MASTER que usan helpers antiguos (solo reporte)
 */
function listMasterFilesUsingOldHelpers() {
  const masterEndpointDir = join(projectRoot, 'src/endpoints');
  const masterEndpoints = findFilesUsingOldHelpers(
    masterEndpointDir,
    /master-api-.*\.js$/
  ).filter(f => f.includes('master-api-'));
  
  const usingOldHelpers = [];
  
  for (const file of masterEndpoints) {
    const fullPath = join(projectRoot, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      
      // Buscar uso de helpers antiguos (json-response.js, new Response manual, etc.)
      if (content.includes('jsonOk') || content.includes('jsonError') || 
          (content.includes('new Response') && content.includes('JSON.stringify') && !content.includes('http-json-v1'))) {
        usingOldHelpers.push(file);
      }
    } catch (e) {
      // Skip errores
    }
  }
  
  return usingOldHelpers;
}

// Ejecutar checks
console.log('[HTTP_CONTRACT_CHECK] Verificando contrato HTTP canónico...\n');

const godCheck = checkGodEndpoints();
console.log(`[HTTP_CONTRACT_CHECK] Endpoints GOD verificados: ${godCheck.checked}`);

if (godCheck.issues.length > 0) {
  console.log(`\n[HTTP_CONTRACT_CHECK] ⚠️  ${godCheck.issues.length} problema(s) encontrado(s):`);
  for (const issue of godCheck.issues) {
    const icon = issue.severity === 'error' ? '❌' : '⚠️';
    console.log(`  ${icon} ${issue.file}: ${issue.issue}`);
  }
  process.exit(1);
} else {
  console.log('[HTTP_CONTRACT_CHECK] ✅ Todos los endpoints GOD usan http-json-v1.js\n');
}

const masterOldHelpers = listMasterFilesUsingOldHelpers();
if (masterOldHelpers.length > 0) {
  console.log(`[HTTP_CONTRACT_CHECK] 📋 ${masterOldHelpers.length} archivo(s) MASTER todavía usan helpers antiguos (solo reporte):`);
  for (const file of masterOldHelpers.slice(0, 10)) { // Mostrar solo los primeros 10
    console.log(`  - ${file}`);
  }
  if (masterOldHelpers.length > 10) {
    console.log(`  ... y ${masterOldHelpers.length - 10} más`);
  }
  console.log('');
}

console.log('[HTTP_CONTRACT_CHECK] ✅ Check completado');
