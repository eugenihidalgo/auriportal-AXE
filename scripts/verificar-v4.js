// scripts/verificar-v4.js
// Script de verificación para AuriPortal v4
// Verifica que todo esté correctamente configurado

import { initPostgreSQL, query } from '../database/pg.js';
import dotenv from 'dotenv';

dotenv.config();

async function verificarV4() {
  console.log('🔍 Verificando AuriPortal v4...\n');

  // 1. Verificar PostgreSQL
  console.log('1️⃣ Verificando conexión a PostgreSQL...');
  try {
    initPostgreSQL();
    const result = await query('SELECT NOW()');
    console.log('   ✅ PostgreSQL conectado correctamente');
    console.log(`   📅 Hora del servidor: ${result.rows[0].now}\n`);
  } catch (err) {
    console.error('   ❌ Error conectando a PostgreSQL:', err.message);
    console.error('   💡 Verifica las variables de entorno: DATABASE_URL o PGUSER/PGPASSWORD/PGHOST/PGPORT/PGDATABASE\n');
    return;
  }

  // 2. Verificar tablas
  console.log('2️⃣ Verificando tablas...');
  const tablas = ['alumnos', 'pausas', 'practicas', 'frases_nivel', 'niveles_fases'];
  for (const tabla of tablas) {
    try {
      const result = await query(`SELECT COUNT(*) FROM ${tabla}`);
      console.log(`   ✅ Tabla ${tabla}: ${result.rows[0].count} registros`);
    } catch (err) {
      console.error(`   ❌ Error en tabla ${tabla}:`, err.message);
    }
  }
  console.log('');

  // 3. Verificar datos iniciales de fases
  console.log('3️⃣ Verificando fases iniciales...');
  try {
    const result = await query('SELECT * FROM niveles_fases ORDER BY nivel_min');
    if (result.rows.length > 0) {
      console.log(`   ✅ ${result.rows.length} fases configuradas:`);
      result.rows.forEach(fase => {
        console.log(`      - ${fase.fase}: niveles ${fase.nivel_min || '?'}-${fase.nivel_max || '?'}`);
      });
    } else {
      console.log('   ⚠️  No hay fases configuradas');
    }
  } catch (err) {
    console.error('   ❌ Error verificando fases:', err.message);
  }
  console.log('');

  // 4. Verificar variables de entorno
  console.log('4️⃣ Verificando variables de entorno...');
  const varsRequeridas = ['DATABASE_URL'];
  const varsOpcionales = ['CLICKUP_API_TOKEN', 'CLICKUP_SPACE_ID', 'KAJABI_CLIENT_ID', 'TYPEFORM_API_TOKEN'];
  
  let todasOk = true;
  for (const varName of varsRequeridas) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: configurada`);
    } else {
      console.log(`   ❌ ${varName}: NO configurada (REQUERIDA)`);
      todasOk = false;
    }
  }
  
  for (const varName of varsOpcionales) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: configurada`);
    } else {
      console.log(`   ⚠️  ${varName}: no configurada (opcional)`);
    }
  }
  console.log('');

  // 5. Verificar estructura de tablas
  console.log('5️⃣ Verificando estructura de tablas...');
  try {
    const alumnosCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'alumnos'
      ORDER BY ordinal_position
    `);
    console.log(`   ✅ Tabla alumnos tiene ${alumnosCols.rows.length} columnas:`);
    alumnosCols.rows.forEach(col => {
      console.log(`      - ${col.column_name} (${col.data_type})`);
    });
  } catch (err) {
    console.error('   ❌ Error verificando estructura:', err.message);
  }
  console.log('');

  console.log('✅ Verificación completada\n');
  
  if (todasOk) {
    console.log('🎉 AuriPortal v4 está listo para usar!');
  } else {
    console.log('⚠️  Hay algunos problemas que resolver antes de usar el sistema');
  }
}

verificarV4().catch(err => {
  console.error('❌ Error en verificación:', err);
  process.exit(1);
});

