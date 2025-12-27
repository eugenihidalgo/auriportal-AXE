// scripts/verificar-correcciones-contextos.js
// Script de verificación rápida de las correcciones de contextos
// FASE 2.D: Verificación

import 'dotenv/config';
import { query } from '../database/pg.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ VERIFICACIÓN: Correcciones Sistema de Contextos PDE v5.30.0');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

let errores = 0;
let advertencias = 0;

async function verificarDefinitionSincronizado() {
  console.log('[VERIFICACIÓN] Verificando sincronización definition ↔ columnas...');
  
  try {
    const result = await query(`
      SELECT 
        context_key,
        definition->>'type' as def_type,
        type as col_type,
        definition->>'scope' as def_scope,
        scope::text as col_scope,
        definition->>'kind' as def_kind,
        kind::text as col_kind
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          definition->>'type' != type::text
          OR definition->>'scope' != scope::text
          OR definition->>'kind' != kind::text
        );
    `);
    
    if (result.rows.length > 0) {
      console.log(`⚠️  ADVERTENCIA: ${result.rows.length} contextos con definition desincronizado:`);
      result.rows.forEach(row => {
        console.log(`   - ${row.context_key}:`);
        if (row.def_type !== row.col_type) {
          console.log(`     type: definition=${row.def_type}, columna=${row.col_type}`);
        }
        if (row.def_scope !== row.col_scope) {
          console.log(`     scope: definition=${row.def_scope}, columna=${row.col_scope}`);
        }
        if (row.def_kind !== row.col_kind) {
          console.log(`     kind: definition=${row.def_kind}, columna=${row.col_kind}`);
        }
      });
      advertencias += result.rows.length;
    } else {
      console.log('✅ Todos los contextos activos tienen definition sincronizado');
    }
  } catch (error) {
    console.error('❌ Error verificando sincronización:', error.message);
    errores++;
  }
}

async function verificarContextosActivos() {
  console.log('');
  console.log('[VERIFICACIÓN] Verificando contextos activos...');
  
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_activos,
        COUNT(*) FILTER (WHERE scope IS NULL) as sin_scope,
        COUNT(*) FILTER (WHERE type IS NULL) as sin_type,
        COUNT(*) FILTER (WHERE kind IS NULL) as sin_kind,
        COUNT(*) FILTER (WHERE type = 'enum' AND allowed_values IS NULL) as enum_sin_values
      FROM pde_contexts
      WHERE deleted_at IS NULL;
    `);
    
    const stats = result.rows[0];
    console.log(`✅ Contextos activos: ${stats.total_activos}`);
    
    if (stats.sin_scope > 0 || stats.sin_type > 0 || stats.sin_kind > 0 || stats.enum_sin_values > 0) {
      console.log(`⚠️  ADVERTENCIA: Contextos con campos obligatorios NULL:`);
      if (stats.sin_scope > 0) console.log(`   - ${stats.sin_scope} sin scope`);
      if (stats.sin_type > 0) console.log(`   - ${stats.sin_type} sin type`);
      if (stats.sin_kind > 0) console.log(`   - ${stats.sin_kind} sin kind`);
      if (stats.enum_sin_values > 0) console.log(`   - ${stats.enum_sin_values} enum sin allowed_values`);
      advertencias += stats.sin_scope + stats.sin_type + stats.sin_kind + stats.enum_sin_values;
    } else {
      console.log('✅ Todos los contextos activos tienen campos obligatorios');
    }
  } catch (error) {
    console.error('❌ Error verificando contextos activos:', error.message);
    errores++;
  }
}

async function verificarCombinaciones() {
  console.log('');
  console.log('[VERIFICACIÓN] Verificando combinaciones canónicas...');
  
  try {
    const result = await query(`
      SELECT 
        context_key,
        scope,
        kind,
        type,
        CASE 
          WHEN kind = 'level' AND scope != 'structural' THEN 'kind=level requiere scope=structural'
          WHEN type = 'enum' AND allowed_values IS NULL THEN 'type=enum requiere allowed_values'
        END as problema
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          (kind = 'level' AND scope != 'structural')
          OR (type = 'enum' AND allowed_values IS NULL)
        );
    `);
    
    if (result.rows.length > 0) {
      console.log(`⚠️  ADVERTENCIA: ${result.rows.length} contextos con combinaciones inválidas:`);
      result.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.problema}`);
      });
      advertencias += result.rows.length;
    } else {
      console.log('✅ Todos los contextos activos tienen combinaciones válidas');
    }
  } catch (error) {
    console.error('❌ Error verificando combinaciones:', error.message);
    errores++;
  }
}

async function generarResumen() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN DE VERIFICACIÓN');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Errores: ${errores}`);
  console.log(`Advertencias: ${advertencias}`);
  console.log('');
  
  if (errores === 0 && advertencias === 0) {
    console.log('✅ VERIFICACIÓN EXITOSA: Todas las correcciones están aplicadas correctamente');
  } else if (errores === 0) {
    console.log('⚠️  VERIFICACIÓN CON ADVERTENCIAS: Correcciones aplicadas, pero hay inconsistencias menores');
  } else {
    console.log('❌ VERIFICACIÓN FALLIDA: Hay errores que deben corregirse');
  }
}

async function ejecutarVerificacion() {
  try {
    await verificarDefinitionSincronizado();
    await verificarContextosActivos();
    await verificarCombinaciones();
    await generarResumen();
  } catch (error) {
    console.error('❌ Error ejecutando verificación:', error);
    process.exit(1);
  } finally {
    process.exit(errores > 0 ? 1 : 0);
  }
}

ejecutarVerificacion();





