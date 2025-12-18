// scripts/diagnostico-db-canvas.js
// Script temporal para diagnosticar la base de datos y verificar si el canvas está persistido
// USO: node scripts/diagnostico-db-canvas.js

import { loadEnvIfNeeded } from '../src/core/config/env.js';
import pg from 'pg';
const { Pool } = pg;

// Cargar variables de entorno
loadEnvIfNeeded({ force: true });

async function diagnosticar() {
  try {
    // 1. Construir connectionString igual que en database/pg.js
    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'aurelinportal'}`;
    
    // Extraer info de la conexión para log (sin password)
    let dbInfo = {};
    if (process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL);
        dbInfo = {
          database: url.pathname.replace('/', ''),
          user: url.username,
          host: url.hostname,
          port: url.port || '5432'
        };
      } catch (e) {
        dbInfo = { source: 'DATABASE_URL (parse error)' };
      }
    } else {
      dbInfo = {
        database: process.env.PGDATABASE || 'aurelinportal',
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        port: process.env.PGPORT || '5432'
      };
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[AXE][DB] DIAGNÓSTICO DE BASE DE DATOS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`[AXE][DB] Database: ${dbInfo.database || 'N/A'}`);
    console.log(`[AXE][DB] User: ${dbInfo.user || 'N/A'}`);
    console.log(`[AXE][DB] Host: ${dbInfo.host || 'N/A'}`);
    console.log(`[AXE][DB] Port: ${dbInfo.port || 'N/A'}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // 2. Conectar a la base de datos
    const pool = new Pool({
      connectionString,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    // 3. Verificar conexión y obtener información de la base
    console.log('[1/4] Verificando conexión...');
    const connectionTest = await pool.query('SELECT current_database() as db, current_user as user, inet_server_addr() as host, current_schema() as schema');
    const currentDb = connectionTest.rows[0];
    console.log(`✅ Conectado a base de datos: ${currentDb.db}`);
    console.log(`   Usuario: ${currentDb.user}`);
    console.log(`   Host: ${currentDb.host || 'localhost'}`);
    console.log(`   Schema actual: ${currentDb.schema}`);
    console.log('');

    // 4. Obtener search_path
    console.log('[2/4] Verificando search_path...');
    const searchPathResult = await pool.query('SHOW search_path');
    console.log(`   search_path: ${searchPathResult.rows[0].search_path}`);
    console.log('');

    // 5. Listar todas las tablas
    console.log('[3/4] Listando tablas en la base de datos...');
    const tablesResult = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type='BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    
    console.log(`   Total tablas encontradas: ${tablesResult.rows.length}`);
    const recorridoTables = tablesResult.rows.filter(r => r.table_name.includes('recorrido'));
    if (recorridoTables.length > 0) {
      console.log(`   Tablas relacionadas con recorridos:`);
      recorridoTables.forEach(t => {
        console.log(`     - ${t.table_schema}.${t.table_name}`);
      });
    } else {
      console.log(`   ⚠️  No se encontraron tablas con 'recorrido' en el nombre`);
    }
    console.log('');

    // 6. Buscar tabla recorrido_drafts específicamente
    console.log('[4/4] Verificando tabla recorrido_drafts...');
    const draftTableCheck = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = 'recorrido_drafts';
    `);

    if (draftTableCheck.rows.length === 0) {
      console.log('   ❌ Tabla recorrido_drafts NO encontrada');
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('CONCLUSIÓN: Tabla recorrido_drafts no existe');
      console.log('═══════════════════════════════════════════════════════════════');
      await pool.end();
      process.exit(1);
    }

    const tableSchema = draftTableCheck.rows[0].table_schema;
    const tableName = draftTableCheck.rows[0].table_name;
    console.log(`   ✅ Tabla encontrada: ${tableSchema}.${tableName}`);
    console.log('');

    // 7. Verificar columnas de la tabla
    const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      AND column_name IN ('draft_id', 'recorrido_id', 'canvas_json', 'canvas_updated_at', 'definition_json');
    `, [tableSchema, tableName]);

    console.log('   Columnas relevantes:');
    columnsResult.rows.forEach(col => {
      console.log(`     - ${col.column_name}: ${col.data_type}`);
    });
    console.log('');

    // 8. Buscar el recorrido específico
    const recorridoId = 'limpieza_energetica_diaria';
    console.log(`Buscando recorrido: '${recorridoId}'...`);
    
    // Primero verificar si existe el draft
    const draftCheck = await pool.query(`
      SELECT 
        draft_id,
        recorrido_id,
        canvas_json IS NOT NULL AS has_canvas,
        canvas_updated_at,
        definition_json IS NOT NULL AS has_definition,
        created_at,
        updated_at
      FROM ${tableSchema}.${tableName}
      WHERE recorrido_id = $1
      ORDER BY updated_at DESC
      LIMIT 1;
    `, [recorridoId]);

    if (draftCheck.rows.length === 0) {
      console.log(`   ❌ No se encontró ningún draft para recorrido_id = '${recorridoId}'`);
      console.log('');
      console.log('   Listando todos los recorrido_id disponibles...');
      const allRecorridos = await pool.query(`
        SELECT DISTINCT recorrido_id, COUNT(*) as count
        FROM ${tableSchema}.${tableName}
        GROUP BY recorrido_id
        ORDER BY recorrido_id;
      `);
      if (allRecorridos.rows.length > 0) {
        allRecorridos.rows.forEach(r => {
          console.log(`     - ${r.recorrido_id} (${r.count} draft(s))`);
        });
      } else {
        console.log('     (ningún recorrido encontrado)');
      }
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('CONCLUSIÓN: Draft no encontrado para este recorrido_id');
      console.log('═══════════════════════════════════════════════════════════════');
      await pool.end();
      process.exit(1);
    }

    const draft = draftCheck.rows[0];
    console.log(`   ✅ Draft encontrado (draft_id: ${draft.draft_id})`);
    console.log(`   - has_canvas: ${draft.has_canvas}`);
    console.log(`   - has_definition: ${draft.has_definition}`);
    console.log(`   - canvas_updated_at: ${draft.canvas_updated_at || 'NULL'}`);
    console.log(`   - created_at: ${draft.created_at}`);
    console.log(`   - updated_at: ${draft.updated_at}`);
    console.log('');

    // 9. Si tiene canvas, mostrar tamaño aproximado
    if (draft.has_canvas) {
      const canvasSize = await pool.query(`
        SELECT LENGTH(canvas_json::text) as canvas_size_bytes
        FROM ${tableSchema}.${tableName}
        WHERE draft_id = $1;
      `, [draft.draft_id]);
      const sizeBytes = canvasSize.rows[0].canvas_size_bytes;
      const sizeKB = (sizeBytes / 1024).toFixed(2);
      console.log(`   📊 Tamaño del canvas: ${sizeBytes} bytes (~${sizeKB} KB)`);
      console.log('');
    }

    // 10. CONCLUSIÓN FINAL
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('CONCLUSIÓN FINAL');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Base de datos real: ${currentDb.db}`);
    console.log(`Schema de la tabla: ${tableSchema}`);
    console.log(`Tabla: ${tableName}`);
    console.log(`Recorrido ID: ${recorridoId}`);
    console.log(`Canvas persistido: ${draft.has_canvas ? '✅ SÍ' : '❌ NO'}`);
    console.log('');

    if (draft.has_canvas) {
      console.log('CASO A: El canvas SÍ está guardado en la DB correcta.');
      console.log('El aviso "Canvas no persistido" es un BUG DE UI');
      console.log('(estado no actualizado tras PUT /canvas).');
    } else {
      console.log('CASO B: El canvas NO está guardado.');
      console.log('El autosave no se ha disparado o apunta a otro recorrido/ID.');
    }
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    await pool.end();
    process.exit(draft.has_canvas ? 0 : 1);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('❌ ERROR EN DIAGNÓSTICO');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error(error.message);
    console.error('');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

diagnosticar();

