#!/usr/bin/env node
// scripts/verify-live-entities-mutation-contract.js
// Verificación estática del Contrato Canónico de Mutación de Entidades Vivas
//
// Busca violaciones obvias del contrato:
// - Mutación directa desde endpoints
// - Mutación directa desde módulos de negocio
// - Uso de repositorios para mutar entidades vivas fuera del servicio canónico
//
// Referencia: CONTRATO_CANONICO_MUTACION_ENTIDADES_VIVAS.md

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const VIOLATIONS = [];

// Patrones prohibidos para mutaciones de entidades vivas principales
const PROHIBITED_PATTERNS = [
  // Mutación directa de alumnos desde endpoints o módulos
  {
    pattern: /studentRepo\.updateNivel\(|repo\.updateNivel\(/i,
    description: 'Mutación directa de nivel desde repositorio',
    recommendation: 'Usar StudentMutationService.updateNivel()',
    excludeIn: ['student-mutation-service.js']
  },
  {
    pattern: /studentRepo\.updateStreak\(|repo\.updateStreak\(/i,
    description: 'Mutación directa de streak desde repositorio',
    recommendation: 'Usar StudentMutationService.updateStreak()',
    excludeIn: ['student-mutation-service.js']
  },
  {
    pattern: /studentRepo\.updateUltimaPractica\(|repo\.updateUltimaPractica\(/i,
    description: 'Mutación directa de última práctica desde repositorio',
    recommendation: 'Usar StudentMutationService.updateUltimaPractica()',
    excludeIn: ['student-mutation-service.js']
  },
  {
    pattern: /studentRepo\.updateEstadoSuscripcion\(|repo\.updateEstadoSuscripcion\(/i,
    description: 'Mutación directa de estado de suscripción desde repositorio',
    recommendation: 'Usar StudentMutationService.updateEstadoSuscripcion()',
    excludeIn: ['student-mutation-service.js']
  },
  {
    pattern: /studentRepo\.updateApodo\(|repo\.updateApodo\(/i,
    description: 'Mutación directa de apodo desde repositorio',
    recommendation: 'Usar StudentMutationService.updateApodo()',
    excludeIn: ['student-mutation-service.js']
  },
  // UPDATE directo sobre tablas principales
  {
    pattern: /UPDATE\s+alumnos\s+SET.*nivel_actual/i,
    description: 'UPDATE directo de nivel_actual en tabla alumnos',
    recommendation: 'Usar StudentMutationService.updateNivel()',
    excludeIf: /alumnos_(lugares|proyectos|arquetipos|auribosses|aurimapa|quests|avatar|historias|sellos|sorpresas|limpieza_hogar)/
  },
  {
    pattern: /UPDATE\s+alumnos\s+SET.*streak/i,
    description: 'UPDATE directo de streak en tabla alumnos',
    recommendation: 'Usar StudentMutationService.updateStreak()',
    excludeIf: /alumnos_(lugares|proyectos|arquetipos|auribosses|aurimapa|quests|avatar|historias|sellos|sorpresas|limpieza_hogar)/
  },
  {
    pattern: /UPDATE\s+alumnos\s+SET.*fecha_ultima_practica/i,
    description: 'UPDATE directo de fecha_ultima_practica en tabla alumnos',
    recommendation: 'Usar StudentMutationService.updateUltimaPractica()',
    excludeIf: /alumnos_(lugares|proyectos|arquetipos|auribosses|aurimapa|quests|avatar|historias|sellos|sorpresas|limpieza_hogar)/
  },
  {
    pattern: /UPDATE\s+alumnos\s+SET.*estado_suscripcion/i,
    description: 'UPDATE directo de estado_suscripcion en tabla alumnos',
    recommendation: 'Usar StudentMutationService.updateEstadoSuscripcion()',
    excludeIf: /alumnos_(lugares|proyectos|arquetipos|auribosses|aurimapa|quests|avatar|historias|sellos|sorpresas|limpieza_hogar)/
  },
  {
    pattern: /UPDATE\s+alumnos\s+SET.*apodo/i,
    description: 'UPDATE directo de apodo en tabla alumnos',
    recommendation: 'Usar StudentMutationService.updateApodo()',
    excludeIf: /alumnos_(lugares|proyectos|arquetipos|auribosses|aurimapa|quests|avatar|historias|sellos|sorpresas|limpieza_hogar)/
  }
];

// Archivos y directorios a excluir
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /scripts\/verify-live-entities-mutation-contract\.js$/, // Excluir este mismo script
  /\.cursor/,
  /docs/,
  /database\/migrations/,
  /\.md$/,
  /\.json$/,
  /\.yml$/,
  /\.yaml$/
];

// Directorios donde buscar (solo src/)
const SEARCH_DIRS = [
  'src/endpoints',
  'src/modules'
];

/**
 * Verifica si un archivo debe ser excluido
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Verifica si un archivo está en el servicio canónico (permitido)
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

  // Permitir mutación en el servicio canónico
  if (isCanonicalService(filePath)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(projectRoot, filePath);

    lines.forEach((line, index) => {
      PROHIBITED_PATTERNS.forEach(({ pattern, description, recommendation, excludeIn, excludeIf }) => {
        if (pattern.test(line)) {
          // Verificar exclusiones
          if (excludeIn && excludeIn.some(exclude => relativePath.includes(exclude))) {
            return; // Excluido explícitamente
          }

          if (excludeIf && excludeIf.test(line)) {
            return; // Excluido por patrón (tablas de relación)
          }

          // Verificar que no sea un comentario o string
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('//') || 
              trimmedLine.startsWith('*') ||
              trimmedLine.startsWith('/*') ||
              (trimmedLine.includes('//') && trimmedLine.indexOf('//') < trimmedLine.search(pattern))) {
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
  console.log('🔍 VERIFICACIÓN DEL CONTRATO DE MUTACIÓN DE ENTIDADES VIVAS');
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
    console.log('Referencia: CONTRATO_CANONICO_MUTACION_ENTIDADES_VIVAS.md');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    process.exit(1);
  }
}

// Ejecutar
main();




