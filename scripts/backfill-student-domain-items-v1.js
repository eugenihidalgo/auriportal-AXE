#!/usr/bin/env node
// scripts/backfill-student-domain-items-v1.js
// Backfill para inicializar student_item_state desde catálogos
//
// Uso:
//   node scripts/backfill-student-domain-items-v1.js --dry-run --limit 20
//   node scripts/backfill-student-domain-items-v1.js --apply --limit 20
//   node scripts/backfill-student-domain-items-v1.js --apply --student_id 123
//
// Este script:
// 1. Inicializa student_item_state desde catálogos (transmutaciones, proyectos)
// 2. No marca activos por defecto
// 3. Es idempotente

import 'dotenv/config';
import { query } from '../database/pg.js';
import { getDefaultStudentAuditRepo } from '../src/infra/repos/student-audit-repo-pg.js';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || !args.includes('--apply');
const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null;
const specificStudentId = args.includes('--student_id') ? parseInt(args[args.indexOf('--student_id') + 1], 10) : null;
const productKey = 'pde';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('BACKFILL STUDENT DOMAIN ITEMS v1');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (no aplicará cambios)' : 'APPLY (aplicará cambios)'}`);
  if (limit) console.log(`Límite: ${limit} alumnos`);
  if (specificStudentId) console.log(`Alumno específico: ${specificStudentId}`);
  console.log('');

  try {
    console.log('✅ PostgreSQL conectado correctamente');

    // Obtener alumnos
    let alumnosQuery = 'SELECT id FROM alumnos';
    const alumnosParams = [];

    if (specificStudentId) {
      alumnosQuery += ' WHERE id = $1';
      alumnosParams.push(specificStudentId);
    } else {
      alumnosQuery += ' ORDER BY id';
      if (limit) {
        alumnosQuery += ` LIMIT $1`;
        alumnosParams.push(limit);
      }
    }

    const alumnosResult = await query(alumnosQuery, alumnosParams);
    const alumnos = alumnosResult.rows || [];

    console.log(`📊 Alumnos encontrados: ${alumnos.length}`);
    console.log('');

    if (alumnos.length === 0) {
      console.log('✅ No hay alumnos para procesar');
      return;
    }

    const auditRepo = getDefaultStudentAuditRepo();

    let itemsToProcess = [];
    let insertedItems = 0;
    let errors = 0;

    console.log('📋 Análisis de ítems de dominio:');
    console.log('');

    for (const alumno of alumnos) {
      const studentId = alumno.id;

      // Obtener transmutaciones del catálogo (si existe tabla)
      // Nota: La tabla transmutaciones_energeticas puede no existir en todas las instalaciones
      try {
        // Verificar si la tabla existe
        const tableCheck = await query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'transmutaciones_energeticas'
          )`
        );
        
        if (tableCheck.rows[0]?.exists) {
          const transmutationsResult = await query(
            `SELECT id, nombre FROM transmutaciones_energeticas LIMIT 10`
          );
          const transmutations = transmutationsResult.rows || [];

          for (const transmutation of transmutations) {
            const existing = await query(
              `SELECT * FROM student_item_state 
               WHERE student_id = $1 
                 AND product_key = $2 
                 AND domain_type = 'transmutation' 
                 AND item_ref = $3`,
              [studentId, productKey, transmutation.id.toString()]
            );

            if (existing.rows.length === 0) {
              itemsToProcess.push({
                studentId,
                domainType: 'transmutation',
                itemRef: transmutation.id.toString(),
                itemRefType: 'catalog_id',
                name: transmutation.nombre
              });
              console.log(`  [INSERTAR] Alumno ${studentId} | Transmutación ${transmutation.id} (${transmutation.nombre})`);
            }
          }
        } else {
          console.log(`  ℹ️  Tabla transmutaciones_energeticas no existe, omitiendo transmutaciones`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Error obteniendo transmutaciones: ${error.message}`);
      }

      // Proyectos: no se inicializan desde catálogo (son personalizados)
      // Se crearán cuando el alumno los cree
    }

    console.log('');
    console.log(`📊 Resumen:`);
    console.log(`  - Total alumnos: ${alumnos.length}`);
    console.log(`  - Ítems a insertar: ${itemsToProcess.length}`);
    console.log('');

    if (isDryRun) {
      console.log('✅ DRY-RUN completado. Usa --apply para aplicar cambios.');
      return;
    }

    // Aplicar cambios
    console.log('🔄 Aplicando cambios...');
    console.log('');

    const traceId = `backfill-domain-items-${Date.now()}`;

    for (const itemData of itemsToProcess) {
      try {
        await query(
          `INSERT INTO student_item_state (
            student_id, product_key, domain_type, item_ref, item_ref_type,
            active_state, clean_state, clean_count
          ) VALUES ($1, $2, $3, $4, $5, 'inactive', 'unclean', 0)
          ON CONFLICT (student_id, product_key, domain_type, item_ref) DO NOTHING`,
          [
            itemData.studentId,
            productKey,
            itemData.domainType,
            itemData.itemRef,
            itemData.itemRefType
          ]
        );

        insertedItems++;
        console.log(`  ✅ Ítem insertado: ${itemData.domainType} ${itemData.itemRef} para alumno ${itemData.studentId}`);

        // Registrar auditoría
        await auditRepo.createAuditEvent({
          student_id: itemData.studentId,
          domain_key: itemData.domainType === 'transmutation' ? 'transmutaciones_energeticas' : 'proyectos',
          item_id: itemData.itemRef,
          action: 'BACKFILLED',
          actor_type: 'system',
          actor_id: 'backfill-script',
          before: null,
          after: JSON.stringify({
            domain_type: itemData.domainType,
            item_ref: itemData.itemRef,
            active_state: 'inactive',
            clean_state: 'unclean'
          }),
          trace_id: traceId
        }, null);
      } catch (error) {
        errors++;
        console.error(`  ❌ Error procesando ítem para alumno ${itemData.studentId}: ${error.message}`);
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ BACKFILL COMPLETADO');
    console.log(`  - Ítems insertados: ${insertedItems}`);
    console.log(`  - Errores: ${errors}`);
    console.log(`  - Trace ID: ${traceId}`);
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error en backfill:', error);
  }
}

main();

