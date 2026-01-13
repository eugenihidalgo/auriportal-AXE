#!/usr/bin/env node
// scripts/check-lpm-pdui.js
// Assembly Check: Verifica cumplimiento de PDUI en List Projection Model (LPM) v1
//
// Detecta violaciones en:
// - Frontend: cálculo de estados en vista Proyección, comparaciones de fechas/días
// - Frontend: agrupaciones basadas en campos legacy sin state_by_view_layer

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const VIOLATIONS = [];
const WARNINGS = [];

// ============================================================================
// PATRONES DE DETECCIÓN
// ============================================================================

const PATTERNS = {
  // FRONTEND: Cálculo de estados en vista Proyección
  projection_calculate_state: [
    {
      pattern: /renderProjectionView|loadListProjection/,
      message: 'Función de proyección detectada. Verificar que NO calcula estados.',
      severity: 'WARN',
      check: (content, filePath) => {
        // Verificar que NO hay cálculos de días o estados
        const calculatePatterns = [
          /days_since_last_clean\s*=\s*[^;]+Math\.|days_since_last_clean\s*=\s*[^;]+Date\.|days_since_last_clean\s*=\s*[^;]+now|days_since_last_clean\s*=\s*[^;]+getTime/,
          /Math\.floor\s*\(\s*\([^)]*now[^)]*-\s*[^)]*lastCleaned/,
          /new Date\([^)]*\)\s*-\s*new Date\([^)]*\)/,
          /\.getTime\(\)\s*-\s*\.getTime\(\)/
        ];
        
        for (const pattern of calculatePatterns) {
          if (pattern.test(content)) {
            return {
              message: 'Cálculo de días/fechas detectado en vista Proyección. Usar state_by_view_layer del backend.',
              severity: 'FAIL'
            };
          }
        }
        return null;
      }
    }
  ],

  // FRONTEND: Comparaciones de fechas/días en vista Proyección
  projection_date_comparisons: [
    {
      pattern: /renderProjectionView/,
      message: 'Función de proyección detectada. Verificar que NO compara fechas directamente.',
      severity: 'WARN',
      check: (content, filePath) => {
        // Verificar que NO hay comparaciones de fechas
        const comparisonPatterns = [
          /(shared_last_cleaned_at|pde_last_cleaned_at)\s*[!=<>]/,
          /(shared_last_cleaned_at|pde_last_cleaned_at)\s*\?/,
          /last_cleaned_at\s*[!=<>]/,
          /\.getTime\(\)\s*[!=<>]/
        ];
        
        for (const pattern of comparisonPatterns) {
          if (pattern.test(content)) {
            return {
              message: 'Comparación de fechas detectada en vista Proyección. Usar state_by_view_layer del backend.',
              severity: 'FAIL'
            };
          }
        }
        return null;
      }
    }
  ],

  // FRONTEND: Agrupación por campos legacy sin state_by_view_layer
  projection_legacy_grouping: [
    {
      pattern: /renderProjectionView|itemsByState/,
      message: 'Agrupación de items detectada. Verificar que usa state_by_view_layer.',
      severity: 'WARN',
      check: (content, filePath) => {
        // Verificar que se usa state_by_view_layer para agrupar
        if (content.includes('itemsByState') || content.includes('items.forEach')) {
          // Buscar si se usa state_by_view_layer
          if (!content.includes('state_by_view_layer') || !content.includes('view_layer')) {
            return {
              message: 'Agrupación de items sin usar state_by_view_layer[view_layer].state. Violación de PDUI.',
              severity: 'FAIL'
            };
          }
          
          // Verificar que NO se usa item.state directamente
          if (content.includes('item.state') && !content.includes('state_by_view_layer')) {
            return {
              message: 'Uso de item.state directamente sin state_by_view_layer. Violación de PDUI.',
              severity: 'FAIL'
            };
          }
        }
        return null;
      }
    }
  ]
};

// ============================================================================
// FUNCIONES DE ANÁLISIS
// ============================================================================

function analyzeFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(ROOT, filePath);
    
    // Solo analizar archivos de UI de Alquimia General
    if (!relativePath.includes('master-alquimia-general-client.js')) {
      return;
    }
    
    // Analizar cada categoría de patrones
    for (const [category, patterns] of Object.entries(PATTERNS)) {
      for (const patternConfig of patterns) {
        const { pattern, message, severity, check } = patternConfig;
        
        if (pattern.test(content)) {
          if (check) {
            const result = check(content, filePath);
            if (result) {
              VIOLATIONS.push({
                file: relativePath,
                category,
                message: result.message,
                severity: result.severity || severity
              });
            }
          } else {
            if (severity === 'FAIL') {
              VIOLATIONS.push({
                file: relativePath,
                category,
                message,
                severity: 'FAIL'
              });
            } else {
              WARNINGS.push({
                file: relativePath,
                category,
                message
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error analizando ${filePath}:`, error.message);
  }
}

function scanDirectory(dir) {
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Ignorar node_modules y otros directorios
      if (entry === 'node_modules' || entry === '.git' || entry === 'logs') {
        continue;
      }
      scanDirectory(fullPath);
    } else if (stat.isFile() && entry.endsWith('.js')) {
      analyzeFile(fullPath);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

console.log('[LPM-PDUI] Verificando cumplimiento de PDUI en List Projection Model...\n');

// Escanear directorio public/js/master
const publicJsMaster = join(ROOT, 'public', 'js', 'master');
if (statSync(publicJsMaster).isDirectory()) {
  scanDirectory(publicJsMaster);
}

// Mostrar resultados
if (VIOLATIONS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ No se encontraron violaciones de PDUI en LPM.');
  process.exit(0);
}

if (VIOLATIONS.length > 0) {
  console.log('❌ VIOLACIONES ENCONTRADAS:\n');
  VIOLATIONS.forEach((v, i) => {
    console.log(`${i + 1}. [${v.severity}] ${v.file}`);
    console.log(`   ${v.message}\n`);
  });
}

if (WARNINGS.length > 0) {
  console.log('⚠️  ADVERTENCIAS:\n');
  WARNINGS.forEach((w, i) => {
    console.log(`${i + 1}. ${w.file}`);
    console.log(`   ${w.message}\n`);
  });
}

// Exit code: 1 si hay violaciones FAIL
const hasFailures = VIOLATIONS.some(v => v.severity === 'FAIL');
process.exit(hasFailures ? 1 : 0);
