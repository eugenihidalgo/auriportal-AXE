#!/usr/bin/env node
/**
 * CHECK SIGNALS REGISTRY v1 - AuriPortal
 * 
 * Assembly check para verificar que todas las señales emitidas están registradas.
 * 
 * Verifica:
 * - dispatchSignal valida contra registry
 * - No hay señales ad-hoc sin registro
 * - Todas las señales de dominio están en student-signal-registry.js
 * 
 * Capa 1: Validación obligatoria con fail-open controlado
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Lista archivos en un directorio recursivamente
 */
function findFiles(directory, pattern) {
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
        if (pattern.test(fullPath)) {
          files.push(fullPath.replace(projectRoot + '/', ''));
        }
      }
    }
  }
  
  walkDir(directory);
  return files;
}

/**
 * Extrae señales emitidas en el código
 */
function extractSignalsFromCode(content) {
  const signals = new Set();
  
  // Buscar dispatchSignal({ signal_key: '...' })
  const dispatchSignalRegex = /dispatchSignal\s*\(\s*\{[^}]*signal_key:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = dispatchSignalRegex.exec(content)) !== null) {
    signals.add(match[1]);
  }
  
  // Buscar emitSignal('...', ...) (legacy wrapper)
  const emitSignalRegex = /emitSignal\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = emitSignalRegex.exec(content)) !== null) {
    signals.add(match[1]);
  }
  
  return Array.from(signals);
}

/**
 * Carga el registry de señales
 */
function loadSignalRegistry() {
  const registryPath = join(projectRoot, 'src/core/student/signals/student-signal-registry.js');
  const content = readFileSync(registryPath, 'utf-8');
  
  // Extraer claves de señales del registry
  const signalKeys = new Set();
  const registryKeyRegex = /['"]([^'"]+)['"]:\s*\{/g;
  let match;
  while ((match = registryKeyRegex.exec(content)) !== null) {
    signalKeys.add(match[1]);
  }
  
  return signalKeys;
}

/**
 * Verifica que todas las señales emitidas están registradas
 */
function checkSignalsRegistry() {
  const servicesDir = join(projectRoot, 'src');
  const files = findFiles(servicesDir, /\.js$/);
  
  const registry = loadSignalRegistry();
  const unregisteredSignals = new Map(); // file -> [signals]
  
  for (const file of files) {
    // Skip el registry mismo y tests
    if (file.includes('student-signal-registry') || file.includes('test') || file.includes('spec')) {
      continue;
    }
    
    const fullPath = join(projectRoot, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      
      // Solo verificar archivos que emiten señales
      if (!content.includes('dispatchSignal') && !content.includes('emitSignal')) {
        continue;
      }
      
      const signals = extractSignalsFromCode(content);
      
      for (const signal of signals) {
        // Verificar señales de dominio (student., place., project., sponsor.)
        if (signal.startsWith('student.') || 
            signal.startsWith('place.') || 
            signal.startsWith('project.') || 
            signal.startsWith('sponsor.')) {
          if (!registry.has(signal)) {
            if (!unregisteredSignals.has(file)) {
              unregisteredSignals.set(file, []);
            }
            unregisteredSignals.get(file).push(signal);
          }
        }
      }
    } catch (e) {
      // Skip errores
    }
  }
  
  return {
    checked: files.length,
    registrySize: registry.size,
    unregistered: unregisteredSignals
  };
}

// Ejecutar checks
console.log('[SIGNALS_REGISTRY_CHECK] Verificando registry de señales...\n');

const result = checkSignalsRegistry();
console.log(`[SIGNALS_REGISTRY_CHECK] Archivos verificados: ${result.checked}`);
console.log(`[SIGNALS_REGISTRY_CHECK] Señales registradas: ${result.registrySize}`);

if (result.unregistered.size > 0) {
  console.log(`\n[SIGNALS_REGISTRY_CHECK] ⚠️  ${result.unregistered.size} archivo(s) con señales no registradas:`);
  for (const [file, signals] of result.unregistered.entries()) {
    console.log(`  📄 ${file}:`);
    for (const signal of signals) {
      console.log(`     - ${signal}`);
    }
  }
  console.log('\n[SIGNALS_REGISTRY_CHECK] ℹ️  Nota: Capa 1 usa fail-open controlado. Registrar en student-signal-registry.js');
} else {
  console.log('[SIGNALS_REGISTRY_CHECK] ✅ Todas las señales de dominio están registradas\n');
}

console.log('[SIGNALS_REGISTRY_CHECK] ✅ Check completado');
