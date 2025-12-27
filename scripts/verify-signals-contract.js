#!/usr/bin/env node
// scripts/verify-signals-contract.js
// Verificación estática del Contrato Canónico de Señales
//
// Busca violaciones obvias del contrato:
// - Emisión de señales desde servicios canónicos
// - Ejecución de automatizaciones al preparar señales
// - Mutación de estado desde señales
// - Llamadas a sistemas externos desde señales
//
// Referencia: CONTRATO_CANONICO_SENALES.md

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const VIOLATIONS = [];

// Patrones prohibidos para señales
const PROHIBITED_PATTERNS = [
  // Emitir señal desde servicio canónico
  {
    pattern: /emitSignal\(|\.emit\(.*signal/i,
    description: 'Emisión de señal desde servicio canónico',
    recommendation: 'Las señales solo se preparan en servicios canónicos, no se emiten',
    excludeIn: ['pde-signal-emitter.js', 'package-engine.js', 'admin-signals-api.js']
  },
  // Ejecutar automatización al preparar señal
  {
    pattern: /triggerAutomation\(|executeAutomation\(|runAutomation\(/i,
    description: 'Ejecución de automatización al preparar señal',
    recommendation: 'Las automatizaciones se ejecutan después, cuando se emite la señal',
    excludeIn: [] // No hay excepciones
  },
  // Mutar estado desde señal (en _prepareSignal)
  {
    pattern: /_prepareSignal.*\{[\s\S]*?(repo\.update|\.update|UPDATE\s+)/i,
    description: 'Mutación de estado dentro de _prepareSignal',
    recommendation: 'Preparar señal no debe mutar estado, solo preparar el dato',
    excludeIn: []
  },
  // Llamar sistema externo desde señal (en _prepareSignal)
  {
    pattern: /_prepareSignal.*\{[\s\S]*?(clickup|kajabi|api\.|fetch\(|axios\.|http\.)/i,
    description: 'Llamada a sistema externo dentro de _prepareSignal',
    recommendation: 'Preparar señal no debe llamar sistemas externos, solo preparar el dato',
    excludeIn: []
  },
  // Usar señal como control de flujo
  {
    pattern: /if\s*\(.*signal|switch\s*\(.*signal|signal.*\?/i,
    description: 'Uso de señal como control de flujo',
    recommendation: 'Las señales no controlan flujo, solo describen hechos',
    excludeIn: []
  }
];

// Archivos y directorios a excluir
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /scripts\/verify-signals-contract\.js$/, // Excluir este mismo script
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
  'src/core/services', // Servicios canónicos
  'src/modules'        // Módulos de negocio
];

/**
 * Verifica si un archivo debe ser excluido
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Verifica si un archivo está en el servicio canónico (permitido para preparar)
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

            // Verificar contexto: si está en _prepareSignal y es servicio canónico, puede ser violación
            const contextLines = lines.slice(Math.max(0, index - 10), Math.min(lines.length, index + 10));
            const context = contextLines.join('\n');
            
            // Si es emitSignal y está en servicio canónico, es violación
            if (description.includes('Emisión de señal') && isCanonicalService(filePath)) {
              VIOLATIONS.push({
                file: relativePath,
                line: index + 1,
                pattern: description,
                code: trimmedLine.substring(0, 100),
                recommendation
              });
              return;
            }

            // Si es triggerAutomation y está en servicio canónico, es violación
            if (description.includes('automatización') && isCanonicalService(filePath)) {
              VIOLATIONS.push({
                file: relativePath,
                line: index + 1,
                pattern: description,
                code: trimmedLine.substring(0, 100),
                recommendation
              });
              return;
            }

            // Para otros patrones, verificar si están dentro de _prepareSignal
            if (context.includes('_prepareSignal')) {
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
  console.log('🔍 VERIFICACIÓN DEL CONTRATO DE SEÑALES CANÓNICAS');
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
    console.log('Referencia: CONTRATO_CANONICO_SENALES.md');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    process.exit(1);
  }
}

// Ejecutar
main();




