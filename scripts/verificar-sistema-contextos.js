// scripts/verificar-sistema-contextos.js
// Script de verificación del sistema de contextos canónico

import { query } from '../database/pg.js';
import { listContexts, createContext } from '../src/services/pde-contexts-service.js';
import { listMappingsByContextKey } from '../src/services/context-mappings-service.js';
import { getDefaultPdeContextsRepo } from '../src/infra/repos/pde-contexts-repo-pg.js';

const PREFIX = '[VERIFY][CONTEXTS]';

async function verificarTablas() {
  console.log(`\n${PREFIX} Verificando tablas...\n`);
  
  const tablas = ['pde_contexts', 'context_mappings'];
  
  for (const tabla of tablas) {
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tabla]);
      
      if (result.rows[0].exists) {
        console.log(`  ✅ Tabla ${tabla} existe`);
      } else {
        console.error(`  ❌ Tabla ${tabla} NO existe`);
        return false;
      }
    } catch (error) {
      console.error(`  ❌ Error verificando tabla ${tabla}:`, error.message);
      return false;
    }
  }
  
  return true;
}

async function verificarColumnas() {
  console.log(`\n${PREFIX} Verificando columnas...\n`);
  
  const columnas = {
    'pde_contexts': ['scope', 'kind', 'injected', 'type', 'allowed_values', 'default_value', 'description'],
    'context_mappings': ['label', 'description']
  };
  
  for (const [tabla, cols] of Object.entries(columnas)) {
    for (const columna of cols) {
      try {
        const result = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1
            AND column_name = $2
          )
        `, [tabla, columna]);
        
        if (result.rows[0].exists) {
          console.log(`  ✅ ${tabla}.${columna} existe`);
        } else {
          console.error(`  ❌ ${tabla}.${columna} NO existe`);
          return false;
        }
      } catch (error) {
        console.error(`  ❌ Error verificando ${tabla}.${columna}:`, error.message);
        return false;
      }
    }
  }
  
  return true;
}

async function verificarServicios() {
  console.log(`\n${PREFIX} Verificando servicios...\n`);
  
  try {
    const contextos = await listContexts({ includeArchived: false });
    console.log(`  ✅ Servicio listContexts: ${contextos.length} contextos encontrados`);
    
    if (contextos.length > 0) {
      const ejemplo = contextos[0];
      console.log(`     Ejemplo: ${ejemplo.context_key}`);
      console.log(`     - Scope: ${ejemplo.scope || 'N/A'}`);
      console.log(`     - Kind: ${ejemplo.kind || 'N/A'}`);
      console.log(`     - Injected: ${ejemplo.injected !== undefined ? ejemplo.injected : 'N/A'}`);
      
      // Si es enum, verificar mappings
      const tipo = ejemplo.type || ejemplo.definition?.type;
      if (tipo === 'enum') {
        const { mappings } = await listMappingsByContextKey(ejemplo.context_key);
        console.log(`     - Mappings: ${mappings.length} encontrados`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error verificando servicios:`, error.message);
    return false;
  }
}

async function crearContextoPrueba() {
  console.log(`\n${PREFIX} Creando contexto de prueba...\n`);
  
  try {
    const repo = getDefaultPdeContextsRepo();
    
    // Usar nombre único con timestamp
    const testKey = `test_contexto_verificacion_${Date.now()}`;
    
    // Crear contexto enum de prueba usando el servicio (para que se ejecute syncContextMappings)
    const contexto = await createContext({
      context_key: testKey,
      label: 'Contexto de Verificación',
      definition: {
        type: 'enum',
        allowed_values: ['opcion1', 'opcion2', 'opcion3'],
        default_value: 'opcion1',
        scope: 'package',
        origin: 'user_choice',
        description: 'Contexto de prueba para verificar el sistema'
      }
    });
    
    console.log(`  ✅ Contexto creado: ${contexto.context_key}`);
    console.log(`     - Scope: ${contexto.scope || contexto.definition?.scope || 'N/A'}`);
    console.log(`     - Kind: ${contexto.kind || contexto.definition?.kind || 'N/A'}`);
    console.log(`     - Injected: ${contexto.injected !== undefined ? contexto.injected : (contexto.definition?.injected !== undefined ? contexto.definition.injected : 'N/A')}`);
    console.log(`     - Type: ${contexto.type || contexto.definition?.type || 'N/A'}`);
    
    // Esperar un momento para que se procese la sincronización
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verificar que se crearon mappings automáticamente
    const { mappings } = await listMappingsByContextKey(testKey);
    console.log(`  ✅ Mappings auto-creados: ${mappings.length}`);
    
    if (mappings.length === 3) {
      console.log(`     ✅ Todos los mappings fueron creados correctamente`);
      mappings.forEach(m => {
        console.log(`        - ${m.mapping_key}: ${m.label || m.mapping_key}`);
      });
    } else {
      console.warn(`     ⚠️  Se esperaban 3 mappings, se encontraron ${mappings.length}`);
      if (mappings.length > 0) {
        mappings.forEach(m => {
          console.log(`        - ${m.mapping_key}: ${m.label || m.mapping_key}`);
        });
      }
    }
    
    // Limpiar
    await repo.softDeleteByKey(testKey);
    console.log(`  ✅ Contexto de prueba eliminado`);
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error creando contexto de prueba:`, error.message);
    console.error(`     Stack:`, error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando verificación del sistema de contextos...\n');
  
  // Inicializar conexión
  const { initPostgreSQL } = await import('../database/pg.js');
  initPostgreSQL();
  
  // Esperar un momento para que la conexión se establezca
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const verificaciones = [
    { nombre: 'Tablas', fn: verificarTablas },
    { nombre: 'Columnas', fn: verificarColumnas },
    { nombre: 'Servicios', fn: verificarServicios },
    { nombre: 'Contexto de prueba', fn: crearContextoPrueba }
  ];
  
  let todasOK = true;
  for (const verificacion of verificaciones) {
    const ok = await verificacion.fn();
    if (!ok) {
      todasOK = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (todasOK) {
    console.log('✅ VERIFICACIÓN OK - Sistema de contextos funcionando correctamente');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.error('❌ ERROR - Algunas verificaciones fallaron');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

