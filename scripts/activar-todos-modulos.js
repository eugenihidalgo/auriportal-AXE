// Script para activar todos los módulos
import { query } from '../database/pg.js';

async function activarTodosModulos() {
  try {
    console.log('🔄 Activando todos los módulos...');
    
    const result = await query(`
      UPDATE modulos_sistema 
      SET estado = 'on', updated_at = CURRENT_TIMESTAMP
      RETURNING codigo, nombre, estado
    `);
    
    console.log(`✅ ${result.rows.length} módulos actualizados a ON:`);
    result.rows.forEach(mod => {
      console.log(`   - ${mod.nombre} (${mod.codigo}): ${mod.estado}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error activando módulos:', error);
    process.exit(1);
  }
}

activarTodosModulos();





























