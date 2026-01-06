/**
 * VERIFICACIÓN DE MIGRACIÓN - SPONSORS v1
 * 
 * Reporta sobre el estado de la migración de datos legacy:
 * - Cuántos sponsors se migraron
 * - Cuántos links se crearon
 * - Ejemplos de datos migrados
 */

import { query } from '../database/pg.js';

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('VERIFICACIÓN DE MIGRACIÓN - SPONSORS v1');
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Contar sponsors migrados (con legacy_id en meta)
    const migratedCount = await query(`
      SELECT COUNT(*) as total
      FROM sponsors_catalog
      WHERE meta->>'legacy_id' IS NOT NULL
    `);
    const totalMigrated = parseInt(migratedCount.rows[0].total, 10);

    // Contar sponsors totales
    const totalCount = await query(`
      SELECT COUNT(*) as total
      FROM sponsors_catalog
      WHERE deleted_at IS NULL
    `);
    const totalSponsors = parseInt(totalCount.rows[0].total, 10);

    // Contar links totales
    const linksCount = await query(`
      SELECT COUNT(*) as total
      FROM sponsor_student_links
      WHERE deleted_at IS NULL
    `);
    const totalLinks = parseInt(linksCount.rows[0].total, 10);

    // Contar apadrinados legacy
    const legacyCount = await query(`
      SELECT COUNT(*) as total
      FROM transmutaciones_apadrinados
      WHERE (deleted_at IS NULL)
      AND (activo = true OR activo IS NULL)
    `).catch(() => ({ rows: [{ total: '0' }] }));
    const totalLegacy = parseInt(legacyCount.rows[0].total, 10);

    // Ejemplos de sponsors migrados
    const examples = await query(`
      SELECT 
        id,
        display_name,
        description,
        status,
        meta->>'legacy_id' as legacy_id,
        created_at
      FROM sponsors_catalog
      WHERE meta->>'legacy_id' IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Ejemplos de links
    const linkExamples = await query(`
      SELECT 
        ssl.id,
        sc.display_name as sponsor_name,
        a.apodo as student_apodo,
        a.email as student_email,
        ssl.role,
        ssl.created_at
      FROM sponsor_student_links ssl
      JOIN sponsors_catalog sc ON ssl.sponsor_id = sc.id
      JOIN alumnos a ON ssl.student_id = a.id
      WHERE ssl.deleted_at IS NULL
      ORDER BY ssl.created_at DESC
      LIMIT 5
    `);

    // Resumen
    console.log('📊 ESTADÍSTICAS DE MIGRACIÓN');
    console.log(`${'='.repeat(60)}`);
    console.log(`📋 Apadrinados legacy: ${totalLegacy}`);
    console.log(`✅ Sponsors migrados (con legacy_id): ${totalMigrated}`);
    console.log(`📦 Sponsors totales (activos): ${totalSponsors}`);
    console.log(`🔗 Links totales (activos): ${totalLinks}`);

    if (totalLegacy > 0) {
      const migrationRate = ((totalMigrated / totalLegacy) * 100).toFixed(1);
      console.log(`📈 Tasa de migración: ${migrationRate}%`);
    }

    if (examples.rows.length > 0) {
      console.log(`\n📋 EJEMPLOS DE SPONSORS MIGRADOS (últimos 5):`);
      examples.rows.forEach((ex, idx) => {
        console.log(`\n   ${idx + 1}. ${ex.display_name || 'Sin nombre'}`);
        console.log(`      - ID nuevo: ${ex.id}`);
        console.log(`      - ID legacy: ${ex.legacy_id}`);
        console.log(`      - Estado: ${ex.status}`);
        console.log(`      - Creado: ${ex.created_at}`);
        if (ex.description) {
          console.log(`      - Descripción: ${ex.description.substring(0, 60)}${ex.description.length > 60 ? '...' : ''}`);
        }
      });
    }

    if (linkExamples.rows.length > 0) {
      console.log(`\n🔗 EJEMPLOS DE LINKS (últimos 5):`);
      linkExamples.rows.forEach((link, idx) => {
        console.log(`\n   ${idx + 1}. ${link.sponsor_name || 'Sin nombre'} ↔ ${link.student_apodo || link.student_email || 'Sin apodo'}`);
        console.log(`      - Link ID: ${link.id}`);
        console.log(`      - Rol: ${link.role}`);
        console.log(`      - Creado: ${link.created_at}`);
      });
    }

    // Verificar sponsors sin links
    const sponsorsWithoutLinks = await query(`
      SELECT COUNT(*) as total
      FROM sponsors_catalog sc
      LEFT JOIN sponsor_student_links ssl ON sc.id = ssl.sponsor_id AND ssl.deleted_at IS NULL
      WHERE sc.deleted_at IS NULL
      AND ssl.id IS NULL
    `);
    const totalWithoutLinks = parseInt(sponsorsWithoutLinks.rows[0].total, 10);

    if (totalWithoutLinks > 0) {
      console.log(`\n⚠️  Sponsors sin links: ${totalWithoutLinks}`);
    }

    console.log(`\n${'='.repeat(60)}\n`);

  } catch (error) {
    console.error(`\n❌ ERROR FATAL EN VERIFICACIÓN:`, error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
