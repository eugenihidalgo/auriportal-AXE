// scripts/export-sponsors-eugeni.js
// Export READ-ONLY de apadrinados vinculados a "Eugeni el Gran"
// PROHIBIDO: INSERT/UPDATE/DELETE, solo SELECT

import 'dotenv/config';
import { query } from '../database/pg.js';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

// Helper: SELECT-only guard
function q(sql, params = []) {
  const sqlUpper = sql.trim().toUpperCase();
  if (!sqlUpper.startsWith('SELECT') && !sqlUpper.startsWith('WITH')) {
    throw new Error(`[SELECT-ONLY GUARD] Prohibido ejecutar query que no sea SELECT/WITH: ${sql.substring(0, 100)}`);
  }
  console.log(`[QUERY] ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
  return query(sql, params);
}

// Helper: SHA256 de archivo
function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

// Helper: Timestamp UTC
function getTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

async function main() {
  const TS = getTimestamp();
  const exportDir = `/var/backups/aurelinportal/exports/${TS}_eugeni_sponsors`;
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('EXPORT SPONSORS EUGENI - READ ONLY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Export dir: ${exportDir}`);
  console.log(`Timestamp: ${TS}\n`);

  // 1. Preparar carpeta
  fs.mkdirSync(exportDir, { recursive: true });
  console.log(`✅ Carpeta creada: ${exportDir}\n`);

  // 2. Introspección de esquema
  console.log('[1/5] Introspección de esquema...');
  const tables = ['alumnos', 'students', 'sponsor_student_links', 'sponsors_catalog'];
  const schemaColumns = {};

  for (const table of tables) {
    const result = await q(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [table]);
    schemaColumns[table] = result.rows;
  }

  fs.writeFileSync(
    path.join(exportDir, 'schema_columns.json'),
    JSON.stringify(schemaColumns, null, 2)
  );
  console.log(`✅ Esquema guardado: ${exportDir}/schema_columns.json\n`);

  // Detectar columnas automáticamente
  const detectTextColumns = (table) => {
    return schemaColumns[table]
      .filter(col => ['character varying', 'text', 'varchar'].includes(col.data_type.toLowerCase()))
      .map(col => col.column_name);
  };

  const alumnosTextCols = detectTextColumns('alumnos');
  const studentsTextCols = detectTextColumns('students');
  const sponsorLinksCols = schemaColumns['sponsor_student_links'].map(c => c.column_name);
  const sponsorsCatalogCols = schemaColumns['sponsors_catalog'].map(c => c.column_name);

  console.log(`Columnas texto en alumnos: ${alumnosTextCols.join(', ')}`);
  console.log(`Columnas texto en students: ${studentsTextCols.join(', ')}`);
  console.log(`Columnas en sponsor_student_links: ${sponsorLinksCols.join(', ')}`);
  console.log(`Columnas en sponsors_catalog: ${sponsorsCatalogCols.join(', ')}\n`);

  // 3. Resolver identidad de "Eugeni el Gran"
  console.log('[2/5] Resolviendo identidad de "Eugeni el Gran"...');
  
  const searchName = 'Eugeni el Gran';
  const identityResolution = {
    search_name: searchName,
    alumno_id: null,
    student_uuid: null,
    matched_by: null,
    candidates: []
  };

  // Buscar en alumnos (columnas candidatas: apodo, nombre, nickname)
  const alumnosSearchCols = alumnosTextCols.filter(c => 
    ['apodo', 'nombre', 'nickname', 'name'].includes(c.toLowerCase())
  );

  if (alumnosSearchCols.length === 0) {
    throw new Error('No se encontraron columnas de texto candidatas en alumnos para buscar');
  }

  // Primero: búsqueda exacta case-insensitive
  let exactMatch = null;
  for (const col of alumnosSearchCols) {
    const result = await q(`
      SELECT id, ${col}
      FROM alumnos
      WHERE LOWER(${col}) = LOWER($1);
    `, [searchName]);
    
    if (result.rows.length > 0) {
      exactMatch = result.rows[0];
      identityResolution.alumno_id = exactMatch.id;
      identityResolution.matched_by = `alumnos.${col} (exact match)`;
      break;
    }
  }

  // Si no hay match exacto, buscar con ILIKE
  if (!exactMatch) {
    for (const col of alumnosSearchCols) {
      const result = await q(`
        SELECT id, ${col}
        FROM alumnos
        WHERE ${col} ILIKE $1;
      `, [`%eugeni%`]);
      
      if (result.rows.length > 0) {
        identityResolution.candidates = result.rows.map(r => ({
          id: r.id,
          [col]: r[col]
        }));
        break;
      }
    }

    if (identityResolution.candidates.length === 0) {
      throw new Error(`No se encontró ningún candidato para "${searchName}" en alumnos`);
    }

    if (identityResolution.candidates.length > 1) {
      console.error('❌ AMBIGÜEDAD: Múltiples candidatos encontrados:');
      identityResolution.candidates.forEach((c, i) => {
        console.error(`   ${i + 1}. ID: ${c.id}, Datos: ${JSON.stringify(c)}`);
      });
      process.exit(1);
    }

    identityResolution.alumno_id = identityResolution.candidates[0].id;
    identityResolution.matched_by = `alumnos.${alumnosSearchCols[0]} (ILIKE match)`;
  }

  console.log(`✅ Alumno encontrado: ID=${identityResolution.alumno_id} (${identityResolution.matched_by})`);

  // Buscar en students si existe student con legacy_alumno_id
  const studentsResult = await q(`
    SELECT id, legacy_alumno_id
    FROM students
    WHERE legacy_alumno_id = $1;
  `, [identityResolution.alumno_id]);

  if (studentsResult.rows.length > 0) {
    identityResolution.student_uuid = studentsResult.rows[0].id;
    console.log(`✅ Student UUID encontrado: ${identityResolution.student_uuid}`);
  } else {
    console.log(`⚠️  No existe student con legacy_alumno_id = ${identityResolution.alumno_id}`);
  }

  fs.writeFileSync(
    path.join(exportDir, 'identity_resolution.json'),
    JSON.stringify(identityResolution, null, 2)
  );
  console.log(`✅ Identidad guardada: ${exportDir}/identity_resolution.json\n`);

  // 4. Extraer apadrinados
  console.log('[3/5] Extrayendo apadrinados...');

  // Detectar FK automáticamente
  const studentIdCol = sponsorLinksCols.find(c => c.toLowerCase() === 'student_id');
  const sponsorIdCol = sponsorLinksCols.find(c => c.toLowerCase() === 'sponsor_id');

  if (!studentIdCol || !sponsorIdCol) {
    throw new Error(`No se pudo detectar columnas FK en sponsor_student_links. Columnas: ${sponsorLinksCols.join(', ')}`);
  }

  // Detectar PK de sponsors_catalog
  const sponsorPkCol = sponsorsCatalogCols.find(c => c.toLowerCase() === 'id');
  if (!sponsorPkCol) {
    throw new Error(`No se pudo detectar PK en sponsors_catalog. Columnas: ${sponsorsCatalogCols.join(', ')}`);
  }

  // Detectar columna de nombre en sponsors_catalog
  const sponsorNameCol = sponsorsCatalogCols.find(c => 
    ['display_name', 'name', 'nombre', 'title'].includes(c.toLowerCase())
  );
  if (!sponsorNameCol) {
    throw new Error(`No se pudo detectar columna de nombre en sponsors_catalog. Columnas: ${sponsorsCatalogCols.join(', ')}`);
  }

  // Detectar columna de status
  const sponsorStatusCol = sponsorsCatalogCols.find(c => c.toLowerCase() === 'status');
  const linkStatusCol = sponsorLinksCols.find(c => c.toLowerCase() === 'status');
  const linkDeletedAtCol = sponsorLinksCols.find(c => c.toLowerCase() === 'deleted_at');
  const sponsorDeletedAtCol = sponsorsCatalogCols.find(c => c.toLowerCase() === 'deleted_at');

  // Query para obtener links y sponsors
  let selectCols = [];
  schemaColumns['sponsor_student_links'].forEach(col => {
    selectCols.push(`ssl.${col.column_name} AS link_${col.column_name}`);
  });
  schemaColumns['sponsors_catalog'].forEach(col => {
    selectCols.push(`sc.${col.column_name} AS sponsor_${col.column_name}`);
  });

  let whereClause = `ssl.${studentIdCol} = $1`;
  if (linkDeletedAtCol) {
    whereClause += ` AND ssl.${linkDeletedAtCol} IS NULL`;
  }
  if (sponsorDeletedAtCol) {
    whereClause += ` AND sc.${sponsorDeletedAtCol} IS NULL`;
  }

  const linksQuery = `
    SELECT ${selectCols.join(', ')}
    FROM sponsor_student_links ssl
    INNER JOIN sponsors_catalog sc ON ssl.${sponsorIdCol} = sc.${sponsorPkCol}
    WHERE ${whereClause}
    ORDER BY ssl.created_at DESC NULLS LAST, sc.${sponsorNameCol};
  `;

  const linksResult = await q(linksQuery, [identityResolution.alumno_id]);

  console.log(`✅ Encontrados ${linksResult.rows.length} vínculos\n`);

  // 5. Generar JSON completo
  console.log('[4/5] Generando JSON completo...');

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const dbName = process.env.PGDATABASE || 'aurelinportal';

  const jsonExport = {
    exported_at: new Date().toISOString(),
    app_version: packageJson.version,
    db_name: dbName,
    alumno_id: identityResolution.alumno_id,
    student_uuid: identityResolution.student_uuid,
    search_name: searchName,
    counts: {
      links_count: linksResult.rows.length,
      distinct_sponsors: new Set(linksResult.rows.map(r => r[`sponsor_${sponsorPkCol}`])).size
    },
    sponsors: linksResult.rows.map(row => {
      const sponsor = {};
      const link = {};
      
      schemaColumns['sponsors_catalog'].forEach(col => {
        const key = `sponsor_${col.column_name}`;
        if (row[key] !== undefined) {
          sponsor[col.column_name] = row[key];
        }
      });
      
      schemaColumns['sponsor_student_links'].forEach(col => {
        const key = `link_${col.column_name}`;
        if (row[key] !== undefined) {
          link[col.column_name] = row[key];
        }
      });

      return { sponsor, link };
    })
  };

  const jsonPath = path.join(exportDir, 'sponsors_eugeni.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonExport, null, 2));
  console.log(`✅ JSON guardado: ${jsonPath}\n`);

  // 6. Generar CSV mínimo
  console.log('[5/5] Generando CSV mínimo...');

  const csvRows = [];
  csvRows.push(['sponsor_ref', 'sponsor_name', 'link_status', 'link_created_at'].join(','));

  linksResult.rows.forEach(row => {
    const sponsorRef = row[`sponsor_${sponsorPkCol}`];
    const sponsorName = row[`sponsor_${sponsorNameCol}`] || '';
    const linkStatus = linkStatusCol ? (row[`link_${linkStatusCol}`] || '') : '';
    const linkCreatedAt = row[`link_created_at`] || '';
    
    csvRows.push([
      sponsorRef,
      `"${sponsorName.replace(/"/g, '""')}"`,
      linkStatus,
      linkCreatedAt
    ].join(','));
  });

  const csvPath = path.join(exportDir, 'sponsors_eugeni.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'));
  console.log(`✅ CSV guardado: ${csvPath}\n`);

  // 7. Generar SHA256SUMS
  const sha256Sums = [];
  sha256Sums.push(`${sha256File(jsonPath)}  sponsors_eugeni.json`);
  sha256Sums.push(`${sha256File(csvPath)}  sponsors_eugeni.csv`);
  sha256Sums.push(`${sha256File(path.join(exportDir, 'schema_columns.json'))}  schema_columns.json`);
  sha256Sums.push(`${sha256File(path.join(exportDir, 'identity_resolution.json'))}  identity_resolution.json`);

  const sha256Path = path.join(exportDir, 'SHA256SUMS.txt');
  fs.writeFileSync(sha256Path, sha256Sums.join('\n') + '\n');
  console.log(`✅ SHA256SUMS guardado: ${sha256Path}\n`);

  // 8. Resumen final
  console.log('═══════════════════════════════════════════════════════════');
  console.log('EXPORT COMPLETADO');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Export dir: ${exportDir}`);
  console.log(`Links count: ${jsonExport.counts.links_count}`);
  console.log(`Distinct sponsors: ${jsonExport.counts.distinct_sponsors}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`SHA256: ✅ OK`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Retornar datos para reporte
  return {
    exportDir,
    timestamp: TS,
    identityResolution,
    counts: jsonExport.counts,
    queries: {
      schema: 'SELECT from information_schema.columns',
      identity: `SELECT from alumnos WHERE ${identityResolution.matched_by}`,
      links: linksQuery
    }
  };
}

main()
  .then((result) => {
    // Guardar resultado para reporte
    const reportDataPath = `/var/backups/aurelinportal/exports/${result.timestamp}_eugeni_sponsors/export_metadata.json`;
    fs.writeFileSync(reportDataPath, JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en export:', error);
    process.exit(1);
  });
