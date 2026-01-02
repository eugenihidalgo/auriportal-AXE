#!/usr/bin/env node
// scripts/verify-automations-contract.js
// Verificación estática del Contrato Canónico de Automatizaciones
//
// Busca violaciones obvias del contrato:
// - Ejecución de automatizaciones desde servicios canónicos
// - Consumo de señales preparadas (no emitidas)
// - Mutación de estado directamente desde automatizaciones
// - Ejecución de acciones no registradas
// - Omitir dedupe/idempotencia
// - Omitir auditoría
//
// Referencia: CONTRATO_CANONICO_AUTOMATIZACIONES.md

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const VIOLATIONS = [];

// Patrones prohibidos para automatizaciones
const PROHIBITED_PATTERNS = [
  // Ejecutar automatizaciones desde servicios canónicos
  {
    pattern: /runAutomations|executeAutomation|triggerAutomation/i,
    description: 'Ejecución de automatizaciones desde servicio canónico',
    recommendation: 'Las automatizaciones se ejecutan cuando se emite la señal, no desde servicios canónicos',
    excludeIn: ['automation-engine.js', 'signal-dispatcher.js', 'automation-runner.js']
  },
  // Consumir señal preparada (sin signal_id)
  {
    pattern: /_prepareSignal.*runAutomations|prepareSignal.*executeAutomation/i,
    description: 'Consumo de señal preparada (no emitida)',
    recommendation: 'Las automatizaciones solo consumen señales emitidas con signal_id',
    excludeIn: []
  },
  // Mutar estado directamente desde automatización
  {
    pattern: /automation.*UPDATE\s+alumnos|automation.*repo\.update|automation.*studentRepo\.update/i,
    description: 'Mutación de estado directamente desde automatización',
    recommendation: 'Las automatizaciones deben usar servicios canónicos (StudentMutationService)',
    excludeIn: []
  },
  // Ejecutar acción no registrada (código inline)
  {
    pattern: /executeAction.*\{[\s\S]*?(UPDATE|INSERT|DELETE)\s+/i,
    description: 'Ejecución de acción no registrada (código inline)',
    recommendation: 'Todas las acciones deben estar registradas en Action Registry',
    excludeIn: []
  },
  // Omitir dedupe
  {
    pattern: /runAutomation.*\{[\s\S]*?executeSteps|runAutomation.*\{[\s\S]*?executeActions/i,
    description: 'Posible omisión de dedupe antes de ejecutar',
    recommendation: 'Toda automatización debe verificar dedupe antes de ejecutar',
    excludeIn: ['automation-dedup.js']
  },
  // Omitir auditoría
  {
    pattern: /executeSteps.*\{[\s\S]*?(?!createRun|createStep|updateRun|updateStep)/i,
    description: 'Posible omisión de auditoría (runs/steps)',
    recommendation: 'Toda ejecución debe registrarse en automation_runs y automation_run_steps',
    excludeIn: ['automation-repo-pg.js']
  }
];

// Archivos y directorios a excluir
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /scripts\/verify-automations-contract\.js$/, // Excluir este mismo script
  /\.cursor/,
  /docs/,
  /database\/migrations/,
  /\.md$/,
  /\.json$/,
  /\.yml$/,
  /\.yaml$/
];

// Directorios donde buscar
const SEARCH_DIRS = [
  'src/core/services',  // Servicios canónicos
  'src/core/automation', // Automation engine
  'src/modules'          // Módulos de negocio
];

/**
 * Verifica si un archivo debe ser excluido
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Verifica si un archivo está en el servicio canónico (permitido para preparar señales)
 */
function isCanonicalService(filePath) {
  return filePath.includes('student-mutation-service.js');
}

/**
 * Busca violaciones en un archivo
 */
function checkFile(filePath) {
  if (shouldExclude(filePath)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(projectRoot, filePath);

    lines.forEach((line, index) => {
      PROHIBITED_PATTERNS.forEach(({ pattern, description, recommendation, excludeIn }) => {
        // Verificar exclusiones
        if (excludeIn && excludeIn.some(exclude => relativePath.includes(exclude))) {
          return; // Excluido explícitamente
        }

        // Para patrones multilinea, verificar contexto
        if (pattern.flags && pattern.flags.includes('s')) {
          // Patrón multilinea
          if (pattern.test(content)) {
            // Verificar que no sea comentario
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('//') || 
                trimmedLine.startsWith('*') ||
                trimmedLine.startsWith('/*')) {
              return; // Es comentario, ignorar
            }

            VIOLATIONS.push({
              file: relativePath,
              line: index + 1,
              pattern: description,
              code: trimmedLine.substring(0, 100),
              recommendation
            });
          }
        } else {
          // Patrón de línea única
          if (pattern.test(line)) {
            // Verificar que no sea comentario
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('//') || 
                trimmedLine.startsWith('*') ||
                trimmedLine.startsWith('/*') ||
                (trimmedLine.includes('//') && trimmedLine.indexOf('//') < trimmedLine.search(pattern))) {
              return; // Es comentario, ignorar
            }

            // Verificar contexto: si está en servicio canónico y es runAutomations, es violación
            const contextLines = lines.slice(Math.max(0, index - 10), Math.min(lines.length, index + 10));
            const context = contextLines.join('\n');
            
            // Si es runAutomations y está en servicio canónico, es violación
            if (description.includes('servicio canónico') && isCanonicalService(filePath)) {
              VIOLATIONS.push({
                file: relativePath,
                line: index + 1,
                pattern: description,
                code: trimmedLine.substring(0, 100),
                recommendation
              });
              return;
            }

            // Para otros patrones, verificar contexto
            if (context.includes('_prepareSignal') && description.includes('señal preparada')) {
              VIOLATIONS.push({
                file: relativePath,
                line: index + 1,
                pattern: description,
                code: trimmedLine.substring(0, 100),
                recommendation
              });
            }
          }
        }
      });
    });
  } catch (error) {
    console.error(`Error leyendo archivo ${filePath}:`, error.message);
  }
}

/**
 * Recorre directorio recursivamente
 */
function walkDirectory(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    entries.forEach(entry => {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(projectRoot, fullPath);

      if (shouldExclude(relativePath)) {
        return;
      }

      if (entry.isDirectory()) {
        walkDirectory(fullPath);
      } else if (entry.isFile() && fullPath.endsWith('.js')) {
        checkFile(fullPath);
      }
    });
  } catch (error) {
    console.error(`Error recorriendo directorio ${dirPath}:`, error.message);
  }
}

/**
 * Función principal
 */
function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICACIÓN DEL CONTRATO DE AUTOMATIZACIONES CANÓNICAS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Buscando violaciones en:');
  SEARCH_DIRS.forEach(dir => console.log(`  - ${dir}`));
  console.log('');

  // Recorrer directorios de búsqueda
  SEARCH_DIRS.forEach(dir => {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      walkDirectory(fullPath);
    } else {
      console.warn(`⚠️  Directorio no encontrado: ${dir}`);
    }
  });

  // Reportar resultados
  console.log('');
  if (VIOLATIONS.length === 0) {
    console.log('✅ No se encontraron violaciones del contrato.');
    console.log('');
    process.exit(0);
  } else {
    console.log(`❌ Se encontraron ${VIOLATIONS.length} violación(es) del contrato:`);
    console.log('');

    VIOLATIONS.forEach((violation, index) => {
      console.log(`${index + 1}. ${violation.file}:${violation.line}`);
      console.log(`   Patrón: ${violation.pattern}`);
      console.log(`   Código: ${violation.code}`);
      console.log(`   Recomendación: ${violation.recommendation}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Referencia: CONTRATO_CANONICO_AUTOMATIZACIONES.md');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    process.exit(1);
  }
}

// Ejecutar
main();










