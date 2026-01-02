#!/usr/bin/env node
/**
 * ASSETS MASTER CHECK v1
 * 
 * Verifica que todos los required_scripts del contrato MASTER existen y son válidos.
 * 
 * Uso:
 *   node scripts/check-assets-master.js
 *   npm run check:assets-master
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

let errors = [];
let warnings = [];

console.log('[ASSETS][CHECK] Verificando required_scripts del contrato MASTER...\n');

try {
  // Leer contrato
  const registryPath = join(ROOT, 'src/core/master/registry/master-layout-registry.v1.json');
  if (!existsSync(registryPath)) {
    console.error(`❌ Registry no encontrado: ${registryPath}`);
    process.exit(1);
  }
  
  const registryContent = readFileSync(registryPath, 'utf-8');
  const registry = JSON.parse(registryContent);
  const requiredScripts = registry.required_scripts || [];
  
  if (!Array.isArray(requiredScripts) || requiredScripts.length === 0) {
    errors.push('required_scripts no es array o está vacío');
  } else {
    console.log(`📋 Encontrados ${requiredScripts.length} script(s) en contrato\n`);
    
    const publicAssetsRoot = join(ROOT, 'public');
    
    for (const scriptDef of requiredScripts) {
      // Normalizar: aceptar string o objeto (compatibilidad backward)
      const script = typeof scriptDef === 'string' 
        ? { path: scriptDef, id: scriptDef, critical: false } 
        : scriptDef;
      
      const scriptPath = script.path || script.src;
      const scriptId = script.id || scriptPath?.split('/').pop()?.replace('.js', '') || 'unknown';
      
      if (!scriptPath) {
        errors.push(`Script ${scriptId} sin path definido`);
        continue;
      }
      
      console.log(`  🔍 Verificando: ${scriptId} (${scriptPath})`);
      
      // Construir ruta completa en filesystem
      const fsPath = join(publicAssetsRoot, scriptPath);
      
      // Verificar existencia
      if (!existsSync(fsPath)) {
        errors.push(`❌ Script ${scriptId} no existe: ${fsPath}`);
        continue;
      }
      
      // Leer y verificar contenido
      try {
        const scriptContent = readFileSync(fsPath, 'utf-8');
        
        // Sniff: verificar que NO es HTML
        const trimmed = scriptContent.trim();
        const htmlMarkers = [
          trimmed.startsWith('<!'),
          trimmed.startsWith('<html'),
          trimmed.startsWith('<!DOCTYPE'),
          trimmed.toLowerCase().includes('<html'),
          trimmed.toLowerCase().includes('<!doctype')
        ];
        
        if (htmlMarkers.some(marker => marker)) {
          const firstBytes = trimmed.substring(0, 100).replace(/\n/g, ' ');
          errors.push(`❌ Script ${scriptId} parece HTML en lugar de JS:\n     Primeros bytes: ${firstBytes}...`);
        } else {
          console.log(`    ✅ Archivo existe y parece JS válido`);
        }
        
        // Verificar extensión
        if (!scriptPath.endsWith('.js')) {
          warnings.push(`⚠️  Script ${scriptId} no tiene extensión .js (${scriptPath})`);
        }
        
        // Verificar campos del contrato
        if (!script.id) {
          warnings.push(`⚠️  Script sin campo 'id' definido: ${scriptPath}`);
        }
        
        if (script.critical === undefined) {
          warnings.push(`⚠️  Script ${scriptId} sin campo 'critical' definido (default: false)`);
        }
        
      } catch (err) {
        errors.push(`❌ Error leyendo script ${scriptId}: ${err.message}`);
      }
    }
  }
  
  // Reporte
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RESUMEN ASSETS CHECK');
  console.log('═══════════════════════════════════════════════════════\n');
  
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(w => console.log(`   ${w}`));
    console.log('');
  }
  
  if (errors.length === 0) {
    console.log('✅ TODOS LOS ASSETS VÁLIDOS');
    console.log(`   ${requiredScripts.length} script(s) verificados correctamente\n`);
    process.exit(0);
  } else {
    console.error('❌ ERRORES ENCONTRADOS:');
    errors.forEach(e => console.error(`   ${e}`));
    console.error('');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ ERROR FATAL:', error.message);
  console.error(error.stack);
  process.exit(1);
}

