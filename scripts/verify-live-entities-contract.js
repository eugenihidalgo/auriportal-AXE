#!/usr/bin/env node
// scripts/verify-live-entities-contract.js
// Verificación estática del Contrato Canónico de Creación de Entidades Vivas
//
// Busca violaciones obvias del contrato:
// - Creación directa desde endpoints
// - Creación directa desde módulos de negocio
// - Uso de repositorios para crear entidades vivas fuera del servicio canónico
//
// Referencia: CONTRATO_CANONICO_CREACION_ENTIDADES_VIVAS.md

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const VIOLATIONS = [];

// Patrones prohibidos para entidades vivas principales (Alumno, Práctica)
const PROHIBITED_PATTERNS = [
  // Creación directa de alumnos desde endpoints o módulos
  {
    pattern: /studentRepo\.create\(|repo\.create\(.*alumno|\.createStudent\(/i,
    description: 'Creación directa de alumno desde repositorio',
    recommendation: 'Usar StudentMutationService.createStudent()',
    // Excluir si está en el servicio canónico
    excludeIn: ['student-mutation-service.js']
  },
  {
    pattern: /INSERT INTO\s+alumnos\s*\(/i,
    description: 'INSERT directo en tabla alumnos (entidad principal)',
    recommendation: 'Usar StudentMutationService.createStudent()',
    // Excluir tablas de relación (no son entidades vivas principales)
    excludeIf: /alumnos_(lugares|proyectos|arquetipos|auribosses|aurimapa|quests|avatar|historias|sellos|sorpresas|limpieza_hogar)/
  },
  // Creación directa de prácticas desde endpoints o módulos
  {
    pattern: /practiceRepo\.create\(|repo\.create\(.*practica|\.createPractice\(/i,
    description: 'Creación directa de práctica desde repositorio',
    recommendation: 'Usar StudentMutationService.createStudentPractice()',
    // Excluir si está en el servicio canónico o practice-v4.js (puede ser legítimo)
    excludeIn: ['student-mutation-service.js', 'practice-v4.js']
  },
  {
    pattern: /INSERT INTO\s+practicas\s*\(/i,
    description: 'INSERT directo en tabla practicas (entidad principal)',
    recommendation: 'Usar StudentMutationService.createStudentPractice()',
    // Excluir tablas de relación (no son entidades vivas principales)
    excludeIf: /practicas_(audio|diario|preparaciones|tecnicas)/
  },
  // Upsert como creación canónica (solo en endpoints/módulos, no en servicio canónico)
  {
    pattern: /upsertByEmail\(/i,
    description: 'Upsert de alumno (prohibido como creación canónica)',
    recommendation: 'Usar createStudent() para crear, update*() para actualizar',
    // Excluir si está en el servicio canónico
    excludeIn: ['student-mutation-service.js'],
    // Excluir getOrCreateStudent (función de conveniencia, caso especial documentado)
    // NOTA: Idealmente getOrCreateStudent debería usar el servicio canónico, pero es un caso especial
    excludeIf: /getOrCreateStudent/
  }
];

// Archivos y directorios a excluir
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /scripts\/verify-live-entities-contract\.js$/, // Excluir este mismo script
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

  // Permitir creación en el servicio canónico
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

          // Verificar contexto: si la línea contiene getOrCreateStudent y es upsert, puede ser caso especial
          const contextLines = lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 3));
          const context = contextLines.join('\n');
          if (excludeIf && excludeIf.test(context)) {
            return; // Excluido por contexto
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
  console.log('🔍 VERIFICACIÓN DEL CONTRATO DE CREACIÓN DE ENTIDADES VIVAS');
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
    console.log('Referencia: CONTRATO_CANONICO_CREACION_ENTIDADES_VIVAS.md');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    process.exit(1);
  }
}

// Ejecutar
main();

