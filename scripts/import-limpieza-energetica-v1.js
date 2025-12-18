#!/usr/bin/env node
// scripts/import-limpieza-energetica-v1.js
// Script para importar el recorrido Limpieza Energética Diaria v1
//
// Uso:
//   node scripts/import-limpieza-energetica-v1.js
//
// Este script:
// 1. Carga la definición desde config/recorridos/limpieza_energetica_diaria_v1.definition.json
// 2. Crea el recorrido si no existe
// 3. Actualiza el draft con la definición
// 4. Valida el draft
// 5. Opcionalmente publica si pasa validación

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, getPool } from '../database/pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Colores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function main() {
  console.log('\n' + '='.repeat(70));
  log(colors.cyan, '📦', 'IMPORTACIÓN: Limpieza Energética Diaria v1');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Cargar definición
    log(colors.blue, '1️⃣', 'Cargando definición desde archivo...');
    const definitionPath = join(projectRoot, 'config/recorridos/limpieza_energetica_diaria_v1.definition.json');
    const definitionRaw = readFileSync(definitionPath, 'utf-8');
    const definition = JSON.parse(definitionRaw);
    
    log(colors.green, '   ✅', `Definición cargada: ${definition.id}`);
    log(colors.green, '   ✅', `Steps: ${Object.keys(definition.steps).length}`);
    log(colors.green, '   ✅', `Edges: ${definition.edges.length}`);

    // 2. Verificar si el recorrido existe
    log(colors.blue, '2️⃣', 'Verificando si el recorrido existe...');
    const existing = await query(
      'SELECT id, status, current_published_version FROM recorridos WHERE id = $1',
      [definition.id]
    );

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (existing.rows.length === 0) {
        // Crear recorrido
        log(colors.yellow, '   ⚠️', 'Recorrido no existe, creando...');
        
        await client.query(`
          INSERT INTO recorridos (id, name, status)
          VALUES ($1, $2, 'draft')
        `, [definition.id, definition.name || definition.id]);
        
        log(colors.green, '   ✅', 'Recorrido creado');
      } else {
        log(colors.green, '   ✅', `Recorrido existe (status: ${existing.rows[0].status})`);
      }

      // 3. Crear/actualizar draft
      log(colors.blue, '3️⃣', 'Creando draft con la definición...');
      
      // Primero obtener el draft actual (si existe)
      const currentDraftResult = await client.query(`
        SELECT draft_id FROM recorrido_drafts 
        WHERE recorrido_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [definition.id]);

      let draftId;
      if (currentDraftResult.rows.length > 0) {
        // Actualizar draft existente
        draftId = currentDraftResult.rows[0].draft_id;
        await client.query(`
          UPDATE recorrido_drafts 
          SET definition_json = $1, updated_at = NOW(), updated_by = 'import-script'
          WHERE draft_id = $2
        `, [JSON.stringify(definition), draftId]);
        log(colors.green, '   ✅', `Draft actualizado: ${draftId}`);
      } else {
        // Crear nuevo draft
        const newDraftResult = await client.query(`
          INSERT INTO recorrido_drafts (recorrido_id, definition_json, updated_by)
          VALUES ($1, $2, 'import-script')
          RETURNING draft_id
        `, [definition.id, JSON.stringify(definition)]);
        draftId = newDraftResult.rows[0].draft_id;
        
        // Actualizar current_draft_id en recorridos
        await client.query(`
          UPDATE recorridos SET current_draft_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [draftId, definition.id]);
        
        log(colors.green, '   ✅', `Draft creado: ${draftId}`);
      }

      // 4. Registrar en audit log
      log(colors.blue, '4️⃣', 'Registrando en audit log...');
      await client.query(`
        INSERT INTO recorrido_audit_log (recorrido_id, draft_id, action, details_json, created_by)
        VALUES ($1, $2, 'import', $3, 'import-script')
      `, [
        definition.id, 
        draftId, 
        JSON.stringify({
          source: 'config/recorridos/limpieza_energetica_diaria_v1.definition.json',
          steps_count: Object.keys(definition.steps).length,
          edges_count: definition.edges.length,
          imported_at: new Date().toISOString()
        })
      ]);
      log(colors.green, '   ✅', 'Audit log registrado');

      await client.query('COMMIT');

      // 5. Validar draft
      log(colors.blue, '5️⃣', 'Validando definición...');
      
      // Importar validador dinámicamente
      const { validateRecorridoDefinition } = await import('../src/core/recorridos/validate-recorrido-definition.js');
      
      const validationDraft = validateRecorridoDefinition(definition, { isPublish: false });
      
      if (validationDraft.valid) {
        log(colors.green, '   ✅', 'Draft válido');
      } else {
        log(colors.red, '   ❌', `Draft inválido: ${validationDraft.errors.length} errores`);
        validationDraft.errors.forEach(err => {
          log(colors.red, '      ', `- ${err}`);
        });
      }
      
      if (validationDraft.warnings.length > 0) {
        log(colors.yellow, '   ⚠️', `${validationDraft.warnings.length} warnings:`);
        validationDraft.warnings.forEach(warn => {
          log(colors.yellow, '      ', `- ${warn}`);
        });
      }

      // 6. Validar para publish
      log(colors.blue, '6️⃣', 'Validando para publicación...');
      const validationPublish = validateRecorridoDefinition(definition, { isPublish: true });
      
      if (validationPublish.valid) {
        log(colors.green, '   ✅', 'Listo para publicar');
      } else {
        log(colors.yellow, '   ⚠️', `No listo para publicar: ${validationPublish.errors.length} errores`);
        validationPublish.errors.forEach(err => {
          log(colors.yellow, '      ', `- ${err}`);
        });
      }

      // Resumen final
      console.log('\n' + '='.repeat(70));
      log(colors.cyan, '📋', 'RESUMEN');
      console.log('='.repeat(70));
      console.log(`
   Recorrido ID:  ${definition.id}
   Nombre:        ${definition.name}
   Steps:         ${Object.keys(definition.steps).length}
   Edges:         ${definition.edges.length}
   Draft ID:      ${draftId}
   Draft válido:  ${validationDraft.valid ? '✅ Sí' : '❌ No'}
   Publish ready: ${validationPublish.valid ? '✅ Sí' : '⚠️ No'}
      `);

      // Instrucciones
      console.log('='.repeat(70));
      log(colors.cyan, '📝', 'PRÓXIMOS PASOS');
      console.log('='.repeat(70));
      console.log(`
   1. Verificar en UI admin:
      → https://tu-dominio.com/admin/recorridos/${definition.id}/edit

   2. Validar vía API:
      curl -X POST http://localhost:3000/admin/api/recorridos/${definition.id}/validate \\
        -H "Cookie: auriportal_session=TU_COOKIE_ADMIN"

   3. Publicar vía API:
      curl -X POST http://localhost:3000/admin/api/recorridos/${definition.id}/publish \\
        -H "Content-Type: application/json" \\
        -H "Cookie: auriportal_session=TU_COOKIE_ADMIN" \\
        -d '{"release_notes": "v1.0 - Flujo completo de 9 steps"}'
      `);

    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    process.exit(0);

  } catch (error) {
    log(colors.red, '❌', `Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();



