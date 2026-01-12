#!/usr/bin/env node
// scripts/check-view-authority.js
// Assembly Check: Verifica cumplimiento de Regla Constitucional de Autoridad de Vista
//
// Detecta violaciones en:
// - Frontend: cálculo de estados, uso de campos legacy sin state_by_view_layer
// - Backend: endpoints GET sin view_layer, respuestas sin state_by_view_layer

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
  // FRONTEND: Cálculo de estados prohibido
  frontend_calculate_state: [
    {
      pattern: /calculateItemState\s*\(/,
      message: 'calculateItemState() está prohibido. Usar state_by_view_layer del backend.',
      severity: 'FAIL'
    },
    {
      pattern: /days_since_last_clean\s*=\s*[^;]+Math\.|days_since_last_clean\s*=\s*[^;]+Date\.|days_since_last_clean\s*=\s*[^;]+now|days_since_last_clean\s*=\s*[^;]+getTime/,
      message: 'Cálculo de days_since_last_clean en frontend está prohibido.',
      severity: 'FAIL'
    },
    {
      pattern: /(shared_last_cleaned_at|pde_last_cleaned_at)\s*[!=<>]|(shared_last_cleaned_at|pde_last_cleaned_at)\s*\?/,
      message: 'Uso directo de shared_last_cleaned_at/pde_last_cleaned_at para decidir estado está prohibido. Usar state_by_view_layer.',
      severity: 'FAIL'
    },
    {
      pattern: /(item\.state|item\.visual_state)\s*[!=<>]|(item\.state|item\.visual_state)\s*\?/,
      message: 'Uso directo de item.state/item.visual_state sin state_by_view_layer está prohibido.',
      severity: 'WARN',
      context: 'Verificar que existe state_by_view_layer antes de usar'
    }
  ],

  // FRONTEND: Agrupación por campos legacy
  frontend_legacy_grouping: [
    {
      pattern: /\.state\s*===\s*['"]never['"]|\.state\s*===\s*['"]important['"]|\.state\s*===\s*['"]pending['"]|\.state\s*===\s*['"]reviewed['"]/,
      message: 'Agrupación por .state directamente está prohibido. Usar state_by_view_layer[view_layer].state',
      severity: 'FAIL',
      context: 'Verificar que se usa state_by_view_layer[view_layer]'
    }
  ],

  // BACKEND: GET sin view_layer
  backend_missing_view_layer: [
    {
      pattern: /\/master\/api\/alquimia-alumno\/megalist.*method\s*===\s*['"]GET['"]/,
      message: 'GET /master/api/alquimia-alumno/megalist debe requerir view_layer',
      severity: 'FAIL',
      check: (content, filePath) => {
        // Verificar que hay validación de view_layer
        if (!content.includes('view_layer') || !content.includes('MISSING_VIEW_LAYER')) {
          return {
            message: 'GET /master/api/alquimia-alumno/megalist no valida view_layer explícitamente',
            severity: 'FAIL'
          };
        }
        return null;
      }
    }
  ],

  // BACKEND: Respuesta sin state_by_view_layer
  backend_missing_state_by_view_layer: [
    {
      pattern: /getMegalistForStudent|buildMegalist/,
      message: 'Servicio megalist debe devolver state_by_view_layer para cada item',
      severity: 'FAIL',
      check: (content, filePath) => {
        // Verificar que se calcula state_by_view_layer
        if (!content.includes('state_by_view_layer') || !content.includes('computeVisualState')) {
          return {
            message: 'Servicio megalist no calcula state_by_view_layer usando computeVisualState',
            severity: 'FAIL'
          };
        }
        return null;
      }
    }
  ]
};

// ============================================================================
// ESCANEO DE ARCHIVOS
// ============================================================================

function scanFile(filePath, relativePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // FRONTEND: public/js/master/**
    if (relativePath.startsWith('public/js/master/')) {
      for (const patternGroup of Object.values(PATTERNS)) {
        for (const pattern of patternGroup) {
          if (pattern.pattern.test(content)) {
            // Si tiene check personalizado, ejecutarlo
            if (pattern.check) {
              const result = pattern.check(content, filePath);
              if (result) {
                const lineNum = findLineNumber(content, pattern.pattern);
                VIOLATIONS.push({
                  file: relativePath,
                  line: lineNum,
                  message: result.message,
                  severity: result.severity || pattern.severity,
                  context: pattern.context || getContext(lines, lineNum)
                });
              }
            } else {
              const lineNum = findLineNumber(content, pattern.pattern);
              const violation = {
                file: relativePath,
                line: lineNum,
                message: pattern.message,
                severity: pattern.severity,
                context: pattern.context || getContext(lines, lineNum)
              };
              if (pattern.severity === 'FAIL') {
                VIOLATIONS.push(violation);
              } else {
                WARNINGS.push(violation);
              }
            }
          }
        }
      }
    }

    // BACKEND: src/**/master/**
    if (relativePath.includes('/master/') && relativePath.endsWith('.js')) {
      for (const patternGroup of Object.values(PATTERNS)) {
        for (const pattern of patternGroup) {
          if (pattern.pattern.test(content)) {
            if (pattern.check) {
              const result = pattern.check(content, filePath);
              if (result) {
                const lineNum = findLineNumber(content, pattern.pattern);
                VIOLATIONS.push({
                  file: relativePath,
                  line: lineNum,
                  message: result.message,
                  severity: result.severity || pattern.severity,
                  context: pattern.context || getContext(lines, lineNum)
                });
              }
            } else {
              const lineNum = findLineNumber(content, pattern.pattern);
              const violation = {
                file: relativePath,
                line: lineNum,
                message: pattern.message,
                severity: pattern.severity,
                context: pattern.context || getContext(lines, lineNum)
              };
              if (pattern.severity === 'FAIL') {
                VIOLATIONS.push(violation);
              } else {
                WARNINGS.push(violation);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error escaneando ${relativePath}:`, error.message);
  }
}

function findLineNumber(content, pattern) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return 0;
}

function getContext(lines, lineNum, contextLines = 2) {
  const start = Math.max(0, lineNum - contextLines - 1);
  const end = Math.min(lines.length, lineNum + contextLines);
  return lines.slice(start, end).map((line, idx) => {
    const actualLine = start + idx + 1;
    const marker = actualLine === lineNum ? '>>>' : '   ';
    return `${marker} ${actualLine}: ${line}`;
  }).join('\n');
}

function scanDirectory(dir, relativeDir = '') {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = relativeDir ? join(relativeDir, entry) : entry;
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Ignorar node_modules, .git, etc.
      if (entry.startsWith('.') || entry === 'node_modules') {
        continue;
      }
      scanDirectory(fullPath, relativePath);
    } else if (entry.endsWith('.js')) {
      scanFile(fullPath, relativePath);
    }
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

console.log('🔍 Assembly Check: View Authority (Autoridad de Vista)\n');
console.log('Escaneando archivos...\n');

// Escanear frontend
scanDirectory(join(ROOT, 'public/js/master'));

// Escanear backend
scanDirectory(join(ROOT, 'src/endpoints'));
scanDirectory(join(ROOT, 'src/core/master/services'));

// ============================================================================
// REPORTE
// ============================================================================

console.log('='.repeat(80));
console.log('RESULTADOS\n');

if (VIOLATIONS.length === 0 && WARNINGS.length === 0) {
  console.log('✅ OK: No se encontraron violaciones.\n');
  process.exit(0);
}

if (VIOLATIONS.length > 0) {
  console.log(`❌ FAIL: ${VIOLATIONS.length} violación(es) encontrada(s):\n`);
  for (const violation of VIOLATIONS) {
    console.log(`  ${violation.file}:${violation.line}`);
    console.log(`  ${violation.message}`);
    if (violation.context) {
      console.log(`  Contexto:\n${violation.context.split('\n').map(l => `    ${l}`).join('\n')}`);
    }
    console.log('');
  }
}

if (WARNINGS.length > 0) {
  console.log(`⚠️  WARN: ${WARNINGS.length} advertencia(s):\n`);
  for (const warning of WARNINGS) {
    console.log(`  ${warning.file}:${warning.line}`);
    console.log(`  ${warning.message}`);
    if (warning.context) {
      console.log(`  Contexto:\n${warning.context.split('\n').map(l => `    ${l}`).join('\n')}`);
    }
    console.log('');
  }
}

console.log('='.repeat(80));
console.log('\nReferencias:');
console.log('  - docs/CONSTITUTION_VIEW_AUTHORITY_V1.md');
console.log('  - docs/REFACTOR_ALQUIMIA_ALUMNO_AUTORIDAD_VISTA_V1.md\n');

if (VIOLATIONS.length > 0) {
  console.log('❌ Assembly Check FALLÓ. Corrige las violaciones antes de continuar.\n');
  process.exit(1);
} else {
  console.log('✅ Assembly Check PASÓ.\n');
  process.exit(0);
}
