// scripts/diagnostico-contextos-pde.js
// Script de diagnóstico exhaustivo del sistema de contextos PDE
// FASE 1: DIAGNÓSTICO (NO CORREGIR AÚN)

import 'dotenv/config';
import { query } from '../database/pg.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 DIAGNÓSTICO EXHAUSTIVO: Sistema de Contextos PDE');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

const DIAGNOSTICOS = {
  estructura: [],
  registros: [],
  duplicados: [],
  nulos: [],
  combinaciones: [],
  soft_deletes: [],
  definiciones: []
};

async function diagnosticarEstructura() {
  console.log('[CONTEXTS][DIAG][BD] Analizando estructura de tabla pde_contexts...');
  
  try {
    // Obtener estructura de la tabla
    const structureQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'pde_contexts'
      ORDER BY ordinal_position;
    `;
    
    const structure = await query(structureQuery);
    DIAGNOSTICOS.estructura = structure.rows;
    
    console.log(`✅ Estructura detectada: ${structure.rows.length} columnas`);
    structure.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
  } catch (error) {
    console.error('❌ Error analizando estructura:', error.message);
  }
}

async function diagnosticarRegistros() {
  console.log('');
  console.log('[CONTEXTS][DIAG][BD] Enumerando TODOS los registros (incluyendo eliminados)...');
  
  try {
    const allQuery = `
      SELECT 
        id,
        context_key,
        label,
        description,
        definition,
        scope,
        kind,
        injected,
        type,
        allowed_values,
        default_value,
        status,
        created_at,
        updated_at,
        deleted_at
      FROM pde_contexts
      ORDER BY context_key, created_at;
    `;
    
    const result = await query(allQuery);
    DIAGNOSTICOS.registros = result.rows;
    
    console.log(`✅ Total de registros encontrados: ${result.rows.length}`);
    console.log('');
    
    // Mostrar cada registro
    result.rows.forEach((row, idx) => {
      console.log(`[${idx + 1}] context_key: ${row.context_key}`);
      console.log(`    id: ${row.id}`);
      console.log(`    label: ${row.label || '(NULL)'}`);
      console.log(`    scope: ${row.scope || '(NULL)'}`);
      console.log(`    kind: ${row.kind || '(NULL)'}`);
      console.log(`    type: ${row.type || '(NULL)'}`);
      console.log(`    injected: ${row.injected !== null ? row.injected : '(NULL)'}`);
      console.log(`    status: ${row.status || '(NULL)'}`);
      console.log(`    deleted_at: ${row.deleted_at || '(NULL)'}`);
      console.log(`    definition: ${row.definition ? JSON.stringify(row.definition).substring(0, 100) + '...' : '(NULL)'}`);
      console.log(`    allowed_values: ${row.allowed_values ? JSON.stringify(row.allowed_values).substring(0, 50) + '...' : '(NULL)'}`);
      console.log(`    default_value: ${row.default_value !== null ? JSON.stringify(row.default_value) : '(NULL)'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error enumerando registros:', error.message);
  }
}

async function diagnosticarDuplicados() {
  console.log('[CONTEXTS][DIAG][BD] Detectando context_keys duplicados...');
  
  try {
    // Duplicados activos
    const dupActiveQuery = `
      SELECT 
        context_key,
        COUNT(*) as count,
        array_agg(id::text) as ids,
        array_agg(deleted_at::text) as deleted_ats
      FROM pde_contexts
      WHERE deleted_at IS NULL
      GROUP BY context_key
      HAVING COUNT(*) > 1;
    `;
    
    const dupActive = await query(dupActiveQuery);
    
    // Duplicados incluyendo eliminados
    const dupAllQuery = `
      SELECT 
        context_key,
        COUNT(*) as count,
        array_agg(id::text) as ids,
        array_agg(CASE WHEN deleted_at IS NULL THEN 'active' ELSE deleted_at::text END) as states
      FROM pde_contexts
      GROUP BY context_key
      HAVING COUNT(*) > 1;
    `;
    
    const dupAll = await query(dupAllQuery);
    
    DIAGNOSTICOS.duplicados = {
      activos: dupActive.rows,
      todos: dupAll.rows
    };
    
    if (dupActive.rows.length > 0) {
      console.log(`⚠️  DUPLICADOS ACTIVOS encontrados: ${dupActive.rows.length}`);
      dupActive.rows.forEach(dup => {
        console.log(`   - ${dup.context_key}: ${dup.count} registros (ids: ${dup.ids.join(', ')})`);
      });
    } else {
      console.log('✅ No hay duplicados activos');
    }
    
    if (dupAll.rows.length > 0) {
      console.log(`⚠️  DUPLICADOS TOTALES (incluyendo eliminados): ${dupAll.rows.length}`);
      dupAll.rows.forEach(dup => {
        console.log(`   - ${dup.context_key}: ${dup.count} registros (ids: ${dup.ids.join(', ')}, estados: ${dup.states.join(', ')})`);
      });
    } else {
      console.log('✅ No hay duplicados totales');
    }
  } catch (error) {
    console.error('❌ Error detectando duplicados:', error.message);
  }
}

async function diagnosticarNulos() {
  console.log('');
  console.log('[CONTEXTS][DIAG][BD] Detectando NULLs indebidos...');
  
  try {
    const nulosQuery = `
      SELECT 
        context_key,
        CASE WHEN scope IS NULL THEN 'scope' END as campo_nulo_1,
        CASE WHEN type IS NULL THEN 'type' END as campo_nulo_2,
        CASE WHEN kind IS NULL THEN 'kind' END as campo_nulo_3,
        CASE WHEN definition IS NULL THEN 'definition' END as campo_nulo_4,
        CASE WHEN label IS NULL THEN 'label' END as campo_nulo_5,
        CASE WHEN type = 'enum' AND allowed_values IS NULL THEN 'allowed_values (enum sin valores)' END as campo_nulo_6
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          scope IS NULL 
          OR type IS NULL 
          OR kind IS NULL 
          OR definition IS NULL
          OR label IS NULL
          OR (type = 'enum' AND allowed_values IS NULL)
        );
    `;
    
    const nulos = await query(nulosQuery);
    DIAGNOSTICOS.nulos = nulos.rows;
    
    if (nulos.rows.length > 0) {
      console.log(`⚠️  REGISTROS CON NULLs INDEBIDOS: ${nulos.rows.length}`);
      nulos.rows.forEach(row => {
        const camposNulos = [
          row.campo_nulo_1,
          row.campo_nulo_2,
          row.campo_nulo_3,
          row.campo_nulo_4,
          row.campo_nulo_5,
          row.campo_nulo_6
        ].filter(Boolean);
        console.log(`   - ${row.context_key}: ${camposNulos.join(', ')}`);
      });
    } else {
      console.log('✅ No hay NULLs indebidos');
    }
  } catch (error) {
    console.error('❌ Error detectando NULLs:', error.message);
  }
}

async function diagnosticarCombinaciones() {
  console.log('');
  console.log('[CONTEXTS][DIAG][BD] Detectando combinaciones ilegales scope/kind/type...');
  
  try {
    const combinacionesQuery = `
      SELECT 
        context_key,
        scope,
        kind,
        type,
        injected,
        CASE 
          WHEN scope NOT IN ('system', 'structural', 'personal', 'package') THEN 'scope inválido'
          WHEN kind NOT IN ('normal', 'level') THEN 'kind inválido'
          WHEN type NOT IN ('string', 'number', 'boolean', 'enum', 'json') THEN 'type inválido'
          WHEN type = 'enum' AND allowed_values IS NULL THEN 'enum sin allowed_values'
          WHEN scope = 'system' AND injected = false THEN 'system sin injected=true (sospechoso)'
          WHEN scope = 'structural' AND injected = false THEN 'structural sin injected=true (sospechoso)'
          WHEN kind = 'level' AND scope != 'structural' THEN 'level con scope != structural (sospechoso)'
        END as problema
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          scope NOT IN ('system', 'structural', 'personal', 'package')
          OR kind NOT IN ('normal', 'level')
          OR type NOT IN ('string', 'number', 'boolean', 'enum', 'json')
          OR (type = 'enum' AND allowed_values IS NULL)
          OR (scope = 'system' AND injected = false)
          OR (scope = 'structural' AND injected = false)
          OR (kind = 'level' AND scope != 'structural')
        );
    `;
    
    const combinaciones = await query(combinacionesQuery);
    DIAGNOSTICOS.combinaciones = combinaciones.rows;
    
    if (combinaciones.rows.length > 0) {
      console.log(`⚠️  COMBINACIONES ILEGALES/SOSPECHOSAS: ${combinaciones.rows.length}`);
      combinaciones.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.problema} (scope=${row.scope}, kind=${row.kind}, type=${row.type}, injected=${row.injected})`);
      });
    } else {
      console.log('✅ No hay combinaciones ilegales');
    }
  } catch (error) {
    console.error('❌ Error detectando combinaciones:', error.message);
  }
}

async function diagnosticarSoftDeletes() {
  console.log('');
  console.log('[CONTEXTS][DIAG][BD] Analizando soft deletes y colisiones potenciales...');
  
  try {
    const softDeleteQuery = `
      SELECT 
        context_key,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE deleted_at IS NULL) as activos,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as eliminados,
        array_agg(id::text ORDER BY created_at) as ids,
        array_agg(CASE WHEN deleted_at IS NULL THEN 'ACTIVO' ELSE deleted_at::text END ORDER BY created_at) as estados
      FROM pde_contexts
      GROUP BY context_key
      HAVING COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) > 0;
    `;
    
    const softDeletes = await query(softDeleteQuery);
    DIAGNOSTICOS.soft_deletes = softDeletes.rows;
    
    if (softDeletes.rows.length > 0) {
      console.log(`⚠️  CONTEXT_KEYS CON SOFT DELETES: ${softDeletes.rows.length}`);
      softDeletes.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.activos} activo(s), ${row.eliminados} eliminado(s)`);
        console.log(`     IDs: ${row.ids.join(', ')}`);
        console.log(`     Estados: ${row.estados.join(', ')}`);
        
        // Detectar colisiones potenciales
        if (row.activos > 0 && row.eliminados > 0) {
          console.log(`     ⚠️  COLISIÓN POTENCIAL: Hay activos Y eliminados con el mismo context_key`);
        }
      });
    } else {
      console.log('✅ No hay soft deletes');
    }
  } catch (error) {
    console.error('❌ Error analizando soft deletes:', error.message);
  }
}

async function diagnosticarDefiniciones() {
  console.log('');
  console.log('[CONTEXTS][DIAG][BD] Analizando coherencia de definiciones JSONB...');
  
  try {
    const defQuery = `
      SELECT 
        context_key,
        definition,
        scope,
        kind,
        type,
        allowed_values,
        default_value,
        CASE 
          WHEN definition->>'type' != type::text THEN 'type en definition != type columna'
          WHEN definition->>'scope' != scope::text THEN 'scope en definition != scope columna'
          WHEN definition->>'kind' != kind::text THEN 'kind en definition != kind columna'
          WHEN (definition->'allowed_values')::text != COALESCE(allowed_values::text, 'null') THEN 'allowed_values en definition != allowed_values columna'
          WHEN (definition->'default_value')::text != COALESCE(default_value::text, 'null') THEN 'default_value en definition != default_value columna'
        END as inconsistencia
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          definition->>'type' != type::text
          OR definition->>'scope' != scope::text
          OR definition->>'kind' != kind::text
          OR (definition->'allowed_values')::text != COALESCE(allowed_values::text, 'null')
          OR (definition->'default_value')::text != COALESCE(default_value::text, 'null')
        );
    `;
    
    const inconsistencias = await query(defQuery);
    DIAGNOSTICOS.definiciones = inconsistencias.rows;
    
    if (inconsistencias.rows.length > 0) {
      console.log(`⚠️  INCONSISTENCIAS EN DEFINICIONES: ${inconsistencias.rows.length}`);
      inconsistencias.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.inconsistencia}`);
        console.log(`     definition.type: ${row.definition?.type}, columna.type: ${row.type}`);
        console.log(`     definition.scope: ${row.definition?.scope}, columna.scope: ${row.scope}`);
      });
    } else {
      console.log('✅ No hay inconsistencias en definiciones');
    }
  } catch (error) {
    console.error('❌ Error analizando definiciones:', error.message);
  }
}

async function generarResumen() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN DEL DIAGNÓSTICO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total de registros: ${DIAGNOSTICOS.registros.length}`);
  console.log(`Registros activos: ${DIAGNOSTICOS.registros.filter(r => !r.deleted_at).length}`);
  console.log(`Registros eliminados: ${DIAGNOSTICOS.registros.filter(r => r.deleted_at).length}`);
  console.log(`Duplicados activos: ${DIAGNOSTICOS.duplicados.activos?.length || 0}`);
  console.log(`Duplicados totales: ${DIAGNOSTICOS.duplicados.todos?.length || 0}`);
  console.log(`Registros con NULLs indebidos: ${DIAGNOSTICOS.nulos.length}`);
  console.log(`Combinaciones ilegales: ${DIAGNOSTICOS.combinaciones.length}`);
  console.log(`Context_keys con soft deletes: ${DIAGNOSTICOS.soft_deletes.length}`);
  console.log(`Inconsistencias en definiciones: ${DIAGNOSTICOS.definiciones.length}`);
  console.log('');
  
  // Guardar diagnóstico en JSON para análisis posterior
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const { dirname } = await import('path');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const outputPath = path.join(__dirname, '..', 'docs', 'diagnostico-contextos-raw.json');
  
  fs.writeFileSync(outputPath, JSON.stringify(DIAGNOSTICOS, null, 2));
  console.log(`✅ Diagnóstico guardado en: ${outputPath}`);
}

// Ejecutar todos los diagnósticos
async function ejecutarDiagnostico() {
  try {
    await diagnosticarEstructura();
    await diagnosticarRegistros();
    await diagnosticarDuplicados();
    await diagnosticarNulos();
    await diagnosticarCombinaciones();
    await diagnosticarSoftDeletes();
    await diagnosticarDefiniciones();
    await generarResumen();
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ DIAGNÓSTICO COMPLETADO');
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('❌ Error ejecutando diagnóstico:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

ejecutarDiagnostico();





