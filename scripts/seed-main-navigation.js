#!/usr/bin/env node
// scripts/seed-main-navigation.js
// Script para importar y publicar la navegación principal (main-navigation)
//
// Este script:
// 1. Lee el archivo seed JSON desde config/navigation/main-navigation.seed.json
// 2. Crea la navegación si no existe
// 3. Crea/actualiza el draft con la definición del seed
// 4. Valida el draft
// 5. Publica como versión v1 (o siguiente versión)
// 6. Registra en audit log
//
// Ejecutar: node scripts/seed-main-navigation.js
// Opciones:
//   --dry-run    Solo valida sin publicar
//   --force      Publica incluso si ya existe una versión

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno ANTES de importar módulos que usen la DB
dotenv.config({ path: join(__dirname, '..', '.env') });

// Configuración
const NAVIGATION_ID = 'main-navigation';
const SEED_FILE = join(__dirname, '..', 'config', 'navigation', 'main-navigation.seed.json');
const ACTOR = 'seed-script';

// Parsear argumentos
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

/**
 * Función principal
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       SEED: main-navigation - Navegación Principal            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log();

  if (DRY_RUN) {
    console.log('⚠️  Modo --dry-run: Solo se validará, no se publicará\n');
  }
  if (FORCE) {
    console.log('⚠️  Modo --force: Se publicará aunque ya exista una versión\n');
  }

  try {
    // ================================================================
    // 1. Verificar que existe el archivo seed
    // ================================================================
    console.log('📂 [1/6] Verificando archivo seed...');
    
    if (!existsSync(SEED_FILE)) {
      throw new Error(`Archivo seed no encontrado: ${SEED_FILE}`);
    }
    
    const seedContent = readFileSync(SEED_FILE, 'utf-8');
    const seedDefinition = JSON.parse(seedContent);
    
    console.log(`   ✅ Archivo leído: ${SEED_FILE}`);
    console.log(`   📋 navigation_id: ${seedDefinition.navigation_id}`);
    console.log(`   📋 name: ${seedDefinition.name}`);
    console.log(`   📋 nodos: ${Object.keys(seedDefinition.nodes || {}).length}`);
    console.log(`   📋 edges: ${(seedDefinition.edges || []).length}`);
    console.log();

    // Verificar que el navigation_id coincide
    if (seedDefinition.navigation_id !== NAVIGATION_ID) {
      throw new Error(`navigation_id en el seed (${seedDefinition.navigation_id}) no coincide con el esperado (${NAVIGATION_ID})`);
    }

    // ================================================================
    // 2. Importar módulos dinámicamente (después de cargar .env)
    // ================================================================
    console.log('🔍 [2/6] Verificando estado actual en PostgreSQL...');
    
    // Importar módulos de forma dinámica para que .env ya esté cargado
    const { getDefaultNavigationRepo } = await import('../src/infra/repos/navigation-repo-pg.js');
    const { 
      validateNavigationDraft, 
      validateNavigationPublish 
    } = await import('../src/core/navigation/validate-navigation-definition-v1.js');
    
    const repo = getDefaultNavigationRepo();
    
    const existingNav = await repo.getNavigationById(NAVIGATION_ID);
    const existingDraft = existingNav ? await repo.getDraft(NAVIGATION_ID) : null;
    const existingPublished = existingNav ? await repo.getPublishedLatest(NAVIGATION_ID) : null;

    if (existingNav) {
      console.log(`   ⚠️  Navegación "${NAVIGATION_ID}" ya existe`);
      console.log(`   📋 Tiene draft: ${existingDraft ? 'Sí' : 'No'}`);
      console.log(`   📋 Versión publicada: ${existingPublished ? `v${existingPublished.version}` : 'Ninguna'}`);
      
      if (existingPublished && !FORCE) {
        console.log();
        console.log('   ℹ️  Ya existe una versión publicada.');
        console.log('   ℹ️  Usa --force para publicar una nueva versión de todas formas.');
        console.log();
      }
    } else {
      console.log(`   ✅ Navegación "${NAVIGATION_ID}" no existe, se creará nueva`);
    }
    console.log();

    // ================================================================
    // 3. Crear/actualizar draft
    // ================================================================
    console.log('📝 [3/6] Creando/actualizando draft...');
    
    // Asegurar que la navegación existe
    const navigation = await repo.ensureNavigation(NAVIGATION_ID, {
      name: seedDefinition.name,
      description: seedDefinition.description || 'Navegación principal del Home del alumno',
    });
    console.log(`   ✅ Navegación asegurada: ${navigation.navigation_id}`);
    
    // Crear/actualizar draft
    const draft = await repo.upsertDraft(NAVIGATION_ID, seedDefinition, ACTOR);
    console.log(`   ✅ Draft creado/actualizado (id: ${draft.id})`);
    console.log();

    // ================================================================
    // 4. Validar draft (modo draft primero)
    // ================================================================
    console.log('🔎 [4/6] Validando draft (modo tolerante)...');
    
    const draftValidation = validateNavigationDraft(seedDefinition);
    
    if (draftValidation.warnings.length > 0) {
      console.log('   ⚠️  Warnings:');
      draftValidation.warnings.forEach(w => console.log(`      - ${w}`));
    }
    
    if (!draftValidation.ok) {
      console.log('   ❌ Errores de validación (modo draft):');
      draftValidation.errors.forEach(e => console.log(`      - ${e}`));
      throw new Error('Validación de draft fallida');
    }
    
    console.log('   ✅ Draft válido');
    console.log();

    // ================================================================
    // 5. Validar en modo publish (estricto)
    // ================================================================
    console.log('🔎 [5/6] Validando para publicación (modo estricto)...');
    
    const publishValidation = validateNavigationPublish(seedDefinition);
    
    if (publishValidation.warnings.length > 0) {
      console.log('   ⚠️  Warnings:');
      publishValidation.warnings.forEach(w => console.log(`      - ${w}`));
    }
    
    if (!publishValidation.ok) {
      console.log('   ❌ Errores de validación (modo publish):');
      publishValidation.errors.forEach(e => console.log(`      - ${e}`));
      throw new Error('Validación de publish fallida');
    }
    
    console.log('   ✅ Listo para publicar');
    console.log();

    // ================================================================
    // 6. Publicar
    // ================================================================
    if (DRY_RUN) {
      console.log('🏁 [6/6] Publicación omitida (--dry-run)');
      console.log();
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  ✅ VALIDACIÓN EXITOSA (dry-run)                              ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log();
      console.log('Para publicar, ejecuta sin --dry-run:');
      console.log('  node scripts/seed-main-navigation.js');
      console.log();
      process.exit(0);
      return;
    }

    // Verificar si debemos publicar
    if (existingPublished && !FORCE) {
      console.log('🏁 [6/6] Publicación omitida (ya existe versión publicada)');
      console.log();
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  ℹ️  DRAFT ACTUALIZADO, PUBLICACIÓN OMITIDA                   ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      console.log();
      console.log('Para publicar una nueva versión, ejecuta con --force:');
      console.log('  node scripts/seed-main-navigation.js --force');
      console.log();
      process.exit(0);
      return;
    }

    console.log('🚀 [6/6] Publicando versión...');
    
    const publishedVersion = await repo.publish(NAVIGATION_ID, ACTOR);
    
    console.log(`   ✅ Versión publicada: v${publishedVersion.version}`);
    console.log(`   📋 Checksum: ${publishedVersion.checksum}`);
    console.log(`   📋 Status: ${publishedVersion.status}`);
    console.log(`   📋 Publicado por: ${publishedVersion.published_by}`);
    console.log();

    // Audit log adicional (usando 'import' que es una acción válida)
    await repo.appendAuditLog(NAVIGATION_ID, 'import', {
      version: publishedVersion.version,
      checksum: publishedVersion.checksum,
      seed_file: 'main-navigation.seed.json',
      action_detail: 'seed_complete',
    }, ACTOR);

    // ================================================================
    // Resumen final
    // ================================================================
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ SEED COMPLETADO EXITOSAMENTE                              ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log();
    console.log('📋 Resumen:');
    console.log(`   - navigation_id: ${NAVIGATION_ID}`);
    console.log(`   - name: ${seedDefinition.name}`);
    console.log(`   - versión: v${publishedVersion.version}`);
    console.log(`   - checksum: ${publishedVersion.checksum.substring(0, 16)}...`);
    console.log();
    console.log('🔗 Verificar con:');
    console.log('   curl http://localhost:3000/api/navigation');
    console.log();
    
    process.exit(0);

  } catch (error) {
    console.error();
    console.error('╔═══════════════════════════════════════════════════════════════╗');
    console.error('║  ❌ ERROR DURANTE EL SEED                                     ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝');
    console.error();
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Ejecutar
main();
