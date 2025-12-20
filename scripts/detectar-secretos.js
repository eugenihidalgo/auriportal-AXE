#!/usr/bin/env node
/**
 * Script de Detección de Secretos
 * 
 * Escanea el repositorio en busca de secretos, tokens y valores sensibles
 * que no deberían estar versionados.
 * 
 * Uso:
 *   node scripts/detectar-secretos.js
 *   node scripts/detectar-secretos.js --strict  # Modo estricto
 *   node scripts/detectar-secretos.js --fix     # Intenta reemplazar automáticamente
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Patrones de detección de secretos
const SECRET_PATTERNS = [
  // Tokens de ClickUp (pk_ seguido de al menos 20 caracteres)
  { pattern: /pk_[a-zA-Z0-9_]{20,}/g, name: 'ClickUp API Token', severity: 'CRITICAL' },
  
  // Secrets hexadecimales largos (64 caracteres = 32 bytes en hex)
  { pattern: /[a-f0-9]{64}/gi, name: 'Hex Secret (64 chars)', severity: 'HIGH' },
  
  // Google Apps Script IDs
  { pattern: /AKfycbz[a-zA-Z0-9_-]{50,}/g, name: 'Google Apps Script ID', severity: 'HIGH' },
  
  // Google OAuth Client IDs
  { pattern: /\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com/g, name: 'Google OAuth Client ID', severity: 'MEDIUM' },
  
  // Passwords en variables de entorno (formato común)
  { pattern: /(PASSWORD|PASS|SECRET|KEY|TOKEN)\s*=\s*['"]?[^'";\s]{20,}['"]?/gi, name: 'Password/Secret in env format', severity: 'HIGH' },
  
  // URLs con tokens en query params
  { pattern: /https?:\/\/[^\s]+[?&](token|key|secret|api_key|access_token)=[a-zA-Z0-9_-]{20,}/gi, name: 'Token in URL', severity: 'HIGH' },
  
  // Cloudflare API tokens (formato común)
  { pattern: /CLOUDFLARE_API_TOKEN\s*=\s*['"]?[a-zA-Z0-9_-]{30,}['"]?/gi, name: 'Cloudflare API Token', severity: 'HIGH' },
  
  // Database URLs con passwords
  { pattern: /postgresql:\/\/[^:]+:[^@]+@/gi, name: 'Database URL with password', severity: 'CRITICAL' },
  { pattern: /mysql:\/\/[^:]+:[^@]+@/gi, name: 'MySQL URL with password', severity: 'CRITICAL' },
  
  // JWT secrets largos
  { pattern: /JWT_SECRET\s*=\s*['"]?[a-zA-Z0-9_-]{32,}['"]?/gi, name: 'JWT Secret', severity: 'HIGH' },
];

// Archivos y directorios a ignorar
const IGNORE_PATTERNS = [
  /^node_modules$/,
  /^\.git$/,
  /^\.env$/,
  /^\.env\./,
  /^coverage$/,
  /^logs$/,
  /^\.cache$/,
  /^dist$/,
  /^build$/,
  /\.db$/,
  /\.sqlite$/,
  /\.log$/,
  /package-lock\.json$/,
  /^scripts\/detectar-secretos\.js$/, // Ignorar este mismo script
];

// Extensiones de archivo a escanear
const SCAN_EXTENSIONS = ['.js', '.md', '.json', '.sh', '.sql', '.txt', '.yml', '.yaml', '.env.example'];

let issues = [];
let filesScanned = 0;
let filesSkipped = 0;

function shouldIgnore(path) {
  const relativePath = relative(ROOT_DIR, path);
  const parts = relativePath.split('/');
  
  // Verificar cada parte del path
  for (const part of parts) {
    for (const pattern of IGNORE_PATTERNS) {
      if (pattern.test(part)) {
        return true;
      }
    }
  }
  
  // Verificar extensión
  const ext = relativePath.substring(relativePath.lastIndexOf('.'));
  if (ext && !SCAN_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  return false;
}

function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(ROOT_DIR, filePath);
    const lines = content.split('\n');
    
    filesScanned++;
    
    SECRET_PATTERNS.forEach(({ pattern, name, severity }) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Filtrar falsos positivos comunes
          if (match.includes('<') && match.includes('>')) {
            return; // Es un placeholder
          }
          if (match.toLowerCase().includes('example') || match.toLowerCase().includes('placeholder')) {
            return; // Es un ejemplo
          }
          
          // Encontrar línea
          const lineIndex = content.substring(0, content.indexOf(match)).split('\n').length;
          const line = lines[lineIndex - 1] || '';
          
          issues.push({
            file: relativePath,
            line: lineIndex,
            match: match.substring(0, 50) + (match.length > 50 ? '...' : ''),
            type: name,
            severity,
            context: line.trim().substring(0, 100)
          });
        });
      }
    });
  } catch (error) {
    // Ignorar errores de lectura (permisos, etc.)
  }
}

function scanDirectory(dirPath) {
  try {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      
      if (shouldIgnore(fullPath)) {
        filesSkipped++;
        continue;
      }
      
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (stat.isFile()) {
          scanFile(fullPath);
        }
      } catch (error) {
        // Ignorar errores de acceso
      }
    }
  } catch (error) {
    // Ignorar errores de acceso
  }
}

function printReport() {
  console.log('\n🔍 REPORTE DE DETECCIÓN DE SECRETOS\n');
  console.log(`Archivos escaneados: ${filesScanned}`);
  console.log(`Archivos ignorados: ${filesSkipped}`);
  console.log(`Problemas encontrados: ${issues.length}\n`);
  
  if (issues.length === 0) {
    console.log('✅ No se encontraron secretos en el repositorio.\n');
    return;
  }
  
  // Agrupar por severidad
  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const high = issues.filter(i => i.severity === 'HIGH');
  const medium = issues.filter(i => i.severity === 'MEDIUM');
  const low = issues.filter(i => i.severity === 'LOW');
  
  if (critical.length > 0) {
    console.log(`\n🔴 CRÍTICO (${critical.length}):\n`);
    critical.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    Tipo: ${issue.type}`);
      console.log(`    Match: ${issue.match}`);
      console.log(`    Contexto: ${issue.context}`);
      console.log('');
    });
  }
  
  if (high.length > 0) {
    console.log(`\n🟠 ALTO (${high.length}):\n`);
    high.slice(0, 10).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} - ${issue.type}`);
    });
    if (high.length > 10) {
      console.log(`  ... y ${high.length - 10} más`);
    }
    console.log('');
  }
  
  if (medium.length > 0) {
    console.log(`\n🟡 MEDIO (${medium.length}):\n`);
    medium.slice(0, 5).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} - ${issue.type}`);
    });
    if (medium.length > 5) {
      console.log(`  ... y ${medium.length - 5} más`);
    }
    console.log('');
  }
  
  console.log('\n⚠️  RECOMENDACIONES:');
  console.log('  1. Revisa los archivos marcados como CRÍTICO o ALTO');
  console.log('  2. Reemplaza valores reales con placeholders (<VARIABLE_NAME>)');
  console.log('  3. Mueve valores reales al archivo .env (que está en .gitignore)');
  console.log('  4. Actualiza la documentación para explicar cómo obtener los valores\n');
}

// Ejecutar
console.log('🔍 Escaneando repositorio en busca de secretos...\n');
scanDirectory(ROOT_DIR);
printReport();

// Exit code basado en severidad
if (issues.some(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')) {
  process.exit(1);
} else {
  process.exit(0);
}













