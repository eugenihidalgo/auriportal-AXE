/**
 * MIGRACIÓN LEGACY → SPONSORS v1 (Idempotente)
 * 
 * Migra solo datos humanos de transmutaciones_apadrinados a sponsors_catalog:
 * - nombre → display_name
 * - descripcion → description
 * - alumno_id (padrino) → sponsor_student_links
 * - transmutaciones_apadrinados_estado.alumno_id → sponsor_student_links
 * 
 * NO migra: frecuencia_dias, prioridad, orden, nivel_minimo, estado, ultima_limpieza, veces_limpiado
 * 
 * Idempotente: verifica meta.legacy_id antes de crear
 */

import { query, getPool } from '../database/pg.js';

const MIGRATION_NAME = 'legacy-apadrinados-to-sponsors-v1';
const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`MIGRACIÓN: ${MIGRATION_NAME}`);
  console.log(`${DRY_RUN ? '🔍 DRY RUN (no se escribirá nada)' : '✍️  MODO REAL (se escribirá en DB)'}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Verificar que las tablas nuevas existen
    const checkNew = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sponsors_catalog', 'sponsor_student_links')
    `);
    
    if (checkNew.rows.length < 2) {
      throw new Error('Tablas nuevas no existen. Ejecutar migración v5.56.0 primero.');
    }

    // Verificar que la tabla legacy existe
    const checkLegacy = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'transmutaciones_apadrinados'
    `);
    
    if (checkLegacy.rows.length === 0) {
      console.log('⚠️  Tabla legacy no existe. No hay nada que migrar.');
      return;
    }

    // Contar registros legacy
    const countLegacy = await query(`
      SELECT COUNT(*) as total
      FROM transmutaciones_apadrinados
      WHERE (deleted_at IS NULL OR deleted_at IS NULL)
      AND (activo = true OR activo IS NULL)
    `);
    const totalLegacy = parseInt(countLegacy.rows[0].total, 10);
    console.log(`📊 Registros legacy encontrados: ${totalLegacy}`);

    if (totalLegacy === 0) {
      console.log('✅ No hay registros legacy para migrar.');
      return;
    }

    // Obtener todos los apadrinados legacy (solo activos, no eliminados)
    const legacyApadrinados = await query(`
      SELECT 
        id,
        nombre,
        descripcion,
        alumno_id,
        created_at
      FROM transmutaciones_apadrinados
      WHERE (deleted_at IS NULL)
      AND (activo = true OR activo IS NULL)
      ORDER BY id ASC
    `);

    console.log(`\n📋 Procesando ${legacyApadrinados.rows.length} apadrinados...\n`);

    let created = 0;
    let skipped = 0;
    let linksCreated = 0;
    let errors = [];

    for (const legacy of legacyApadrinados.rows) {
      try {
        // Verificar si ya existe (idempotencia)
        const existing = await query(`
          SELECT id 
          FROM sponsors_catalog
          WHERE meta->>'legacy_id' = $1
        `, [String(legacy.id)]);

        if (existing.rows.length > 0) {
          console.log(`⏭️  Ya migrado: ${legacy.nombre} (legacy_id=${legacy.id})`);
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(`[DRY RUN] Crearía sponsor: ${legacy.nombre} (legacy_id=${legacy.id})`);
          created++;
          continue;
        }

        // Crear sponsor en nueva tabla (con transacción manual)
        const pool = getPool();
        const client = await pool.connect();
        
        let sponsorId;
        
        try {
          await client.query('BEGIN');
          
          // Insertar sponsor
          const sponsorInsert = await client.query(`
            INSERT INTO sponsors_catalog (
              display_name,
              description,
              status,
              meta,
              created_at
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id
          `, [
            legacy.nombre || 'Sin nombre',
            legacy.descripcion || null,
            'active',
            JSON.stringify({ legacy_id: legacy.id }),
            legacy.created_at || new Date()
          ]);

          sponsorId = sponsorInsert.rows[0].id;

          // Crear links desde alumno_id (padrino)
          if (legacy.alumno_id) {
            // Verificar que el alumno existe
            const alumnoCheck = await client.query(`
              SELECT id FROM alumnos WHERE id = $1
            `, [legacy.alumno_id]);

            if (alumnoCheck.rows.length > 0) {
              // Verificar si el link ya existe
              const linkCheck = await client.query(`
                SELECT id 
                FROM sponsor_student_links
                WHERE sponsor_id = $1 AND student_id = $2 AND deleted_at IS NULL
              `, [sponsorId, legacy.alumno_id]);

              if (linkCheck.rows.length === 0) {
                await client.query(`
                  INSERT INTO sponsor_student_links (
                    sponsor_id,
                    student_id,
                    role,
                    created_at
                  ) VALUES ($1, $2, $3, $4)
                `, [sponsorId, legacy.alumno_id, 'padrino', legacy.created_at || new Date()]);
                linksCreated++;
              }
            }
          }

          // Crear links desde transmutaciones_apadrinados_estado
          const estadoLinks = await client.query(`
            SELECT DISTINCT alumno_id
            FROM transmutaciones_apadrinados_estado
            WHERE apadrinado_id = $1
            AND alumno_id IS NOT NULL
          `, [legacy.id]);

          for (const estadoLink of estadoLinks.rows) {
            // Verificar que el alumno existe
            const alumnoCheck = await client.query(`
              SELECT id FROM alumnos WHERE id = $1
            `, [estadoLink.alumno_id]);

            if (alumnoCheck.rows.length > 0) {
              // Verificar si el link ya existe
              const linkCheck = await client.query(`
                SELECT id 
                FROM sponsor_student_links
                WHERE sponsor_id = $1 AND student_id = $2 AND deleted_at IS NULL
              `, [sponsorId, estadoLink.alumno_id]);

              if (linkCheck.rows.length === 0) {
                await client.query(`
                  INSERT INTO sponsor_student_links (
                    sponsor_id,
                    student_id,
                    role,
                    created_at
                  ) VALUES ($1, $2, $3, $4)
                `, [sponsorId, estadoLink.alumno_id, 'padrino', legacy.created_at || new Date()]);
                linksCreated++;
              }
            }
          }

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        
        const sponsorResult = sponsorId;

        console.log(`✅ Migrado: ${legacy.nombre} (legacy_id=${legacy.id} → sponsor_id=${sponsorResult})`);
        created++;

      } catch (error) {
        console.error(`❌ Error migrando legacy_id=${legacy.id} (${legacy.nombre}):`, error.message);
        errors.push({ legacy_id: legacy.id, nombre: legacy.nombre, error: error.message });
      }
    }

    // Resumen
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Sponsors creados: ${created}`);
    console.log(`⏭️  Sponsors ya migrados (skipped): ${skipped}`);
    console.log(`🔗 Links creados: ${linksCreated}`);
    console.log(`❌ Errores: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ DETALLES DE ERRORES:`);
      errors.forEach(e => {
        console.log(`   - legacy_id=${e.legacy_id} (${e.nombre}): ${e.error}`);
      });
    }

    console.log(`\n${'='.repeat(60)}\n`);

  } catch (error) {
    console.error(`\n❌ ERROR FATAL EN MIGRACIÓN:`, error);
    process.exit(1);
  }
}

// Ejecutar
main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
