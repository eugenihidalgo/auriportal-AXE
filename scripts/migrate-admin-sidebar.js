#!/usr/bin/env node
/**
 * Script de migración: Actualiza todos los handlers admin para usar replaceAdminTemplate()
 * 
 * Busca archivos que:
 * 1. Tienen baseTemplate
 * 2. Tienen función replace() local
 * 3. Usan replace() con baseTemplate
 * 
 * Los actualiza para usar replaceAdminTemplate() del helper centralizado
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Encontrar handlers admin
const endpointsDir = join(projectRoot, 'src/endpoints');
const allFiles = readdirSync(endpointsDir);
const adminFiles = allFiles
  .filter(f => f.startsWith('admin-') && f.endsWith('.js'))
  .map(f => join('src/endpoints', f));

let updatedCount = 0;
let skippedCount = 0;

for (const file of adminFiles) {
  const filePath = join(projectRoot, file);
  let content = readFileSync(filePath, 'utf-8');
  
  // Verificar si el archivo ya usa replaceAdminTemplate
  if (content.includes('replaceAdminTemplate')) {
    console.log(`✓ ${file} ya usa replaceAdminTemplate`);
    skippedCount++;
    continue;
  }
  
  // Verificar si tiene baseTemplate
  if (!content.includes('baseTemplate')) {
    console.log(`- ${file} no usa baseTemplate, saltando`);
    skippedCount++;
    continue;
  }
  
  let modified = false;
  
  // 1. Añadir import si no existe
  if (!content.includes('replaceAdminTemplate')) {
    // Buscar la línea de imports después de otros imports
    const importLines = content.match(/^import .* from ['"].*['"];$/gm) || [];
    const lastImportLine = importLines[importLines.length - 1];
    
    if (lastImportLine) {
      const insertPosition = content.indexOf(lastImportLine) + lastImportLine.length;
      const newImport = "\nimport { replaceAdminTemplate } from '../core/admin/admin-template-helper.js';";
      
      // Verificar si ya hay un import de admin-template-helper con otro nombre
      if (!content.includes("admin-template-helper")) {
        content = content.slice(0, insertPosition) + newImport + content.slice(insertPosition);
        modified = true;
      }
    }
  }
  
  // 2. Reemplazar llamadas a replace(baseTemplate, ...) por replaceAdminTemplate(baseTemplate, ...)
  const replacePattern = /(\s+)(const|let|var)\s+html\s*=\s*(await\s+)?replace\s*\(\s*baseTemplate\s*,/g;
  if (replacePattern.test(content)) {
    content = content.replace(replacePattern, '$1$2 html = $3replaceAdminTemplate(baseTemplate,');
    modified = true;
  }
  
  // 3. Simplificar función replace() local si solo se usa para baseTemplate
  // (dejamos esto para revisión manual ya que algunos pueden usarla para otros templates)
  
  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ ${file} actualizado`);
    updatedCount++;
  } else {
    console.log(`- ${file} no necesita cambios (ya actualizado o estructura diferente)`);
    skippedCount++;
  }
}

console.log(`\nResumen:`);
console.log(`  Actualizados: ${updatedCount}`);
console.log(`  Omitidos: ${skippedCount}`);
console.log(`  Total: ${adminFiles.length}`);

