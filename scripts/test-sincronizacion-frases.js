// scripts/test-sincronizacion-frases.js
// Prueba la sincronización de frases desde ClickUp

import dotenv from 'dotenv';
import { sincronizarFrasesClickUpAPostgreSQL } from '../src/services/sync-frases-clickup.js';

dotenv.config();

const env = {
  CLICKUP_API_TOKEN: process.env.CLICKUP_API_TOKEN
};

async function testSincronizacion() {
  console.log('🔄 Probando sincronización de frases ClickUp → PostgreSQL...\n');
  
  if (!env.CLICKUP_API_TOKEN) {
    console.error('❌ CLICKUP_API_TOKEN no configurado');
    process.exit(1);
  }

  try {
    const resultado = await sincronizarFrasesClickUpAPostgreSQL(env);
    
    console.log('\n📊 Resultado de la sincronización:\n');
    console.log(JSON.stringify(resultado, null, 2));
    
    if (resultado.success) {
      console.log('\n✅ Sincronización completada exitosamente');
      console.log(`   ➕ Nuevas frases: ${resultado.nuevas || 0}`);
      console.log(`   🔄 Actualizadas: ${resultado.actualizadas || 0}`);
      console.log(`   🗑️  Eliminadas: ${resultado.eliminadas || 0}`);
      console.log(`   ❌ Errores: ${resultado.errores || 0}`);
    } else {
      console.log('\n❌ Error en la sincronización:', resultado.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

testSincronizacion();

