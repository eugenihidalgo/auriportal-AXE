#!/usr/bin/env node
/**
 * Linter para detectar hardcodes de colores en HTML/JS
 * Busca violaciones del Theme Contract v1
 * 
 * Uso:
 *   node scripts/lint-theme-hardcodes.js              # Modo CI (falla si encuentra violaciones)
 *   node scripts/lint-theme-hardcodes.js --warn       # Modo advertencia (no falla)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Modo: 'ci' (falla) o 'warn' (solo advertencias)
const mode = process.argv.includes('--warn') ? 'warn' : 'ci';

// Whitelist de excepciones (casos válidos donde se permite color directo)
const WHITELIST = {
  // Imágenes SVG internas pueden tener colores
  svg: true,
  // Meta tags específicos
  metaThemeColor: true,
  // Comentarios
  comments: true,
  // URLs de imágenes externas
  imageUrls: true,
};

// Patrones para detectar hardcodes
const PATTERNS = [
  // Colores hex (#fff, #ffffff, #FFF)
  { pattern: /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g, name: 'Color hex' },
  // RGB/RGBA
  { pattern: /rgba?\([^)]+\)/g, name: 'Color RGB/RGBA' },
  // HSL/HSLA
  { pattern: /hsla?\([^)]+\)/g, name: 'Color HSL/HSLA' },
  // Nombres de color comunes (white, black, red, etc.)
  { pattern: /\b(white|black|red|green|blue|yellow|orange|purple|pink|brown|gray|grey|cyan|magenta|transparent)\b/gi, name: 'Nombre de color' },
  // Estilos inline
  { pattern: /style\s*=\s*["'][^"']*["']/gi, name: 'Atributo style inline' },
  // Tags <style> en HTML (deben estar en archivos CSS separados)
  { pattern: /<style[^>]*>[\s\S]*?<\/style>/gi, name: 'Tag <style> inline' },
];

// Archivos/directorios a excluir
const EXCLUDE_PATHS = [
  'node_modules',
  '**/*.db',
  'logs',
  '**/*.md',
  'public/css/theme-variables.css', // Este archivo SÍ puede tener colores
  'public/css/theme-overrides.css', // Este archivo SÍ puede tener colores
  'public/css/theme-contract.css', // Este archivo es el contrato
  'scripts/lint-theme-hardcodes.js', // Este mismo archivo
];

// Directorios a escanear
const SCAN_DIRS = [
  'src/core/html',
  'src/endpoints',
  'public/js',
];

/**
 * Verifica si una ruta debe ser excluida
 */
function shouldExclude(filePath) {
  const relativePath = filePath.replace(projectRoot + '/', '');
  return EXCLUDE_PATHS.some(exclude => {
    if (exclude.includes('**')) {
      const pattern = exclude.replace(/\*\*/g, '.*');
      return new RegExp(pattern).test(relativePath);
    }
    return relativePath.includes(exclude);
  });
}

/**
 * Verifica si un match está en un comentario
 */
function isInComment(content, index) {
  const before = content.substring(Math.max(0, index - 100), index);
  // Comentarios HTML
  if (before.includes('<!--') && !before.includes('-->')) return true;
  // Comentarios JS/CSS
  if (before.includes('//') && !before.includes('\n', before.lastIndexOf('//'))) return true;
  if (before.includes('/*') && !before.includes('*/', before.lastIndexOf('/*'))) return true;
  return false;
}

/**
 * Verifica si es una excepción válida
 */
function isWhitelisted(match, context, filePath) {
  // Meta theme-color es válido
  if (context.includes('theme-color') && context.includes('meta')) return true;
  // URLs de imágenes
  if (match.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|gif|svg|webp)/i)) return true;
  // Comentarios
  if (isInComment(context, context.indexOf(match))) return true;
  return false;
}

/**
 * Escanea un archivo en busca de violaciones
 */
function scanFile(filePath) {
  const violations = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    PATTERNS.forEach(({ pattern, name }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNumber - 1] || '';
        const context = line.trim();
        
        // Verificar whitelist
        if (isWhitelisted(match[0], context, filePath)) {
          continue;
        }
        
        violations.push({
          file: filePath.replace(projectRoot + '/', ''),
          line: lineNumber,
          type: name,
          match: match[0].substring(0, 50), // Primeros 50 caracteres
          context: context.substring(0, 100), // Primeros 100 caracteres
        });
      }
    });
  } catch (error) {
    console.error(`Error leyendo ${filePath}:`, error.message);
  }
  
  return violations;
}

/**
 * Escanea un directorio recursivamente
 */
function scanDirectory(dirPath) {
  const violations = [];
  
  try {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      
      if (shouldExclude(fullPath)) {
        continue;
      }
      
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        violations.push(...scanDirectory(fullPath));
      } else if (stat.isFile()) {
        const ext = extname(entry);
        // Solo escanear HTML y JS
        if (['.html', '.js'].includes(ext)) {
          violations.push(...scanFile(fullPath));
        }
      }
    }
  } catch (error) {
    console.error(`Error escaneando ${dirPath}:`, error.message);
  }
  
  return violations;
}

/**
 * Función principal
 */
function main() {
  console.log('🔍 Escaneando archivos en busca de hardcodes de colores...\n');
  
  const allViolations = [];
  
  SCAN_DIRS.forEach(dir => {
    const fullPath = join(projectRoot, dir);
    try {
      const violations = scanDirectory(fullPath);
      allViolations.push(...violations);
    } catch (error) {
      console.warn(`⚠️  No se pudo escanear ${dir}:`, error.message);
    }
  });
  
  if (allViolations.length === 0) {
    console.log('✅ No se encontraron violaciones del Theme Contract.\n');
    process.exit(0);
  }
  
  console.log(`❌ Se encontraron ${allViolations.length} violación(es):\n`);
  
  // Agrupar por archivo
  const byFile = {};
  allViolations.forEach(v => {
    if (!byFile[v.file]) byFile[v.file] = [];
    byFile[v.file].push(v);
  });
  
  // Mostrar violaciones
  Object.keys(byFile).sort().forEach(file => {
    console.log(`📄 ${file}:`);
    byFile[file].forEach(v => {
      console.log(`   Línea ${v.line}: ${v.type}`);
      console.log(`   → ${v.match}`);
      console.log(`   Contexto: ${v.context}`);
      console.log('');
    });
  });
  
  console.log(`\n💡 Solución: Usa variables CSS (var(--bg-primary), etc.) en lugar de colores directos.`);
  console.log(`   Consulta public/css/theme-contract.css para ver las variables disponibles.\n`);
  
  if (mode === 'ci') {
    console.log('❌ Modo CI: Fallando por violaciones encontradas.\n');
    process.exit(1);
  } else {
    console.log('⚠️  Modo advertencia: No fallando, pero se recomienda corregir.\n');
    process.exit(0);
  }
}

main();






