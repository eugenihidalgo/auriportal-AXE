#!/usr/bin/env node
/**
 * CHECK STUDENT IDENTITY CONTRACT v1 - AuriPortal
 * 
 * Assembly check para verificar contrato de identidad de estudiante.
 * 
 * Verifica:
 * - Servicios nuevos NO usan alumno_id directamente
 * - Servicios usan StudentRef (UUID) como entrada principal
 * - Legacy resolution solo en borde (si existe)
 * 
 * Capa 1: Preparación para UUID-only en runtime
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
 * Verifica servicios críticos (Capa 1)
 */
function checkCriticalServices() {
  const servicesDir = join(projectRoot, 'src/core/master/services');
  const services = findFiles(servicesDir, /-service\.js$/);
  
  const issues = [];
  
  for (const file of services) {
    const fullPath = join(projectRoot, file);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      
      // Buscar uso directo de alumno_id en parámetros de funciones exportadas
      // (no en comentarios ni strings)
      const functionParamsRegex = /export\s+(?:async\s+)?function\s+\w+\s*\([^)]*alumno_id[^)]*\)/g;
      const matches = content.match(functionParamsRegex);
      
      if (matches && matches.length > 0) {
        issues.push({
          file,
          issue: `Usa 'alumno_id' directamente en parámetros de función exportada (debe usar StudentRef UUID)`,
          severity: 'warning',
          matches: matches.length
        });
      }
      
      // Buscar uso de alumno_id en queries SQL (puede ser legacy resolution, pero documentar)
      const sqlAlumnoIdRegex = /WHERE.*alumno_id|JOIN.*alumno_id|SELECT.*alumno_id/g;
      const sqlMatches = content.match(sqlAlumnoIdRegex);
      
      if (sqlMatches && sqlMatches.length > 0 && !content.includes('legacy_alumno_id')) {
        // Si usa alumno_id en SQL pero no menciona legacy, puede ser problema
        // Por ahora solo warning
        issues.push({
          file,
          issue: `Usa 'alumno_id' en queries SQL (verificar si es legacy resolution en borde)`,
          severity: 'info',
          matches: sqlMatches.length
        });
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
    checked: services.length,
    issues
  };
}

// Ejecutar checks
console.log('[STUDENT_IDENTITY_CHECK] Verificando contrato de identidad de estudiante...\n');

const servicesCheck = checkCriticalServices();
console.log(`[STUDENT_IDENTITY_CHECK] Servicios críticos verificados: ${servicesCheck.checked}`);

if (servicesCheck.issues.length > 0) {
  console.log(`\n[STUDENT_IDENTITY_CHECK] 📋 ${servicesCheck.issues.length} observación(es):`);
  for (const issue of servicesCheck.issues) {
    const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`  ${icon} ${issue.file}: ${issue.issue}`);
    if (issue.matches) {
      console.log(`     (${issue.matches} ocurrencia(s))`);
    }
  }
  console.log('\n[STUDENT_IDENTITY_CHECK] ℹ️  Nota: Capa 1 prepara UUID-only. Legacy resolution permitido en borde.');
} else {
  console.log('[STUDENT_IDENTITY_CHECK] ✅ Todos los servicios críticos respetan contrato UUID\n');
}

console.log('[STUDENT_IDENTITY_CHECK] ✅ Check completado');
