// scripts/find-json-contract-violations.js
// Busca violaciones de contrato JSON en el sistema de contextos PDE
// FASE 2: Verificación de contratos

import 'dotenv/config';
import { query } from '../database/pg.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 BÚSQUEDA DE VIOLACIONES DE CONTRATO JSON');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

const VIOLACIONES = {
  tipos_incorrectos: [],
  campos_perdidos: [],
  serializacion_invalida: [],
  inconsistencias_definition: [],
  valores_invalidos: []
};

/**
 * Verifica tipos incorrectos en JSONB fields
 */
async function verificarTiposIncorrectos() {
  console.log('[JSON_CONTRACT] Verificando tipos incorrectos en JSONB fields...');
  
  try {
    // Verificar que allowed_values es array cuando type='enum'
    const result = await query(`
      SELECT 
        context_key,
        type,
        allowed_values,
        pg_typeof(allowed_values) as allowed_values_type,
        CASE 
          WHEN type = 'enum' AND allowed_values IS NOT NULL AND jsonb_typeof(allowed_values) != 'array' 
          THEN 'allowed_values debe ser array para enum'
          WHEN type = 'enum' AND allowed_values IS NOT NULL AND jsonb_array_length(allowed_values) = 0
          THEN 'allowed_values no puede estar vacío para enum'
          WHEN type != 'enum' AND allowed_values IS NOT NULL
          THEN 'allowed_values solo debe existir para enum'
        END as problema
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          (type = 'enum' AND (allowed_values IS NULL OR jsonb_typeof(allowed_values) != 'array' OR jsonb_array_length(allowed_values) = 0))
          OR (type != 'enum' AND allowed_values IS NOT NULL)
        );
    `);
    
    if (result.rows.length > 0) {
      console.log(`⚠️  VIOLACIONES DE TIPO: ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.problema}`);
        console.log(`     type: ${row.type}, allowed_values type: ${row.allowed_values_type}`);
        VIOLACIONES.tipos_incorrectos.push(row);
      });
    } else {
      console.log('✅ No hay violaciones de tipo');
    }
  } catch (error) {
    console.error('❌ Error verificando tipos:', error.message);
  }
}

/**
 * Verifica campos perdidos (NULLs donde no deberían estar)
 */
async function verificarCamposPerdidos() {
  console.log('');
  console.log('[JSON_CONTRACT] Verificando campos perdidos...');
  
  try {
    const result = await query(`
      SELECT 
        context_key,
        type,
        scope,
        kind,
        CASE 
          WHEN scope IS NULL THEN 'scope es NULL (obligatorio)'
          WHEN type IS NULL THEN 'type es NULL (obligatorio)'
          WHEN kind IS NULL THEN 'kind es NULL (obligatorio)'
          WHEN type = 'enum' AND allowed_values IS NULL THEN 'allowed_values es NULL para enum (obligatorio)'
          WHEN definition IS NULL THEN 'definition es NULL (obligatorio)'
        END as campo_perdido
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          scope IS NULL
          OR type IS NULL
          OR kind IS NULL
          OR definition IS NULL
          OR (type = 'enum' AND allowed_values IS NULL)
        );
    `);
    
    if (result.rows.length > 0) {
      console.log(`⚠️  CAMPOS PERDIDOS: ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.campo_perdido}`);
        VIOLACIONES.campos_perdidos.push(row);
      });
    } else {
      console.log('✅ No hay campos perdidos');
    }
  } catch (error) {
    console.error('❌ Error verificando campos perdidos:', error.message);
  }
}

/**
 * Verifica serialización inválida (JSON mal formado)
 */
async function verificarSerializacionInvalida() {
  console.log('');
  console.log('[JSON_CONTRACT] Verificando serialización inválida...');
  
  try {
    // Verificar que definition es JSON válido
    const result = await query(`
      SELECT 
        context_key,
        definition,
        CASE 
          WHEN definition::text IS NULL THEN 'definition es NULL'
          WHEN jsonb_typeof(definition) IS NULL THEN 'definition no es JSON válido'
        END as problema
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          definition IS NULL
          OR jsonb_typeof(definition) IS NULL
        );
    `);
    
    if (result.rows.length > 0) {
      console.log(`⚠️  SERIALIZACIÓN INVÁLIDA: ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.problema}`);
        VIOLACIONES.serializacion_invalida.push(row);
      });
    } else {
      console.log('✅ No hay problemas de serialización');
    }
  } catch (error) {
    console.error('❌ Error verificando serialización:', error.message);
  }
}

/**
 * Verifica inconsistencias entre definition y columnas dedicadas
 */
async function verificarInconsistenciasDefinition() {
  console.log('');
  console.log('[JSON_CONTRACT] Verificando inconsistencias definition ↔ columnas...');
  
  try {
    const result = await query(`
      SELECT 
        context_key,
        definition->>'type' as def_type,
        type::text as col_type,
        definition->>'scope' as def_scope,
        scope::text as col_scope,
        definition->>'kind' as def_kind,
        kind::text as col_kind,
        CASE 
          WHEN definition->>'type' != type::text THEN 'type inconsistente'
          WHEN definition->>'scope' != scope::text THEN 'scope inconsistente'
          WHEN definition->>'kind' != kind::text THEN 'kind inconsistente'
          WHEN (definition->'allowed_values')::text != COALESCE(allowed_values::text, 'null') THEN 'allowed_values inconsistente'
          WHEN (definition->'default_value')::text != COALESCE(default_value::text, 'null') THEN 'default_value inconsistente'
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
    `);
    
    if (result.rows.length > 0) {
      console.log(`⚠️  INCONSISTENCIAS: ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.inconsistencia}`);
        if (row.def_type !== row.col_type) {
          console.log(`     definition.type: ${row.def_type}, columna.type: ${row.col_type}`);
        }
        if (row.def_scope !== row.col_scope) {
          console.log(`     definition.scope: ${row.def_scope}, columna.scope: ${row.col_scope}`);
        }
        if (row.def_kind !== row.col_kind) {
          console.log(`     definition.kind: ${row.def_kind}, columna.kind: ${row.col_kind}`);
        }
        VIOLACIONES.inconsistencias_definition.push(row);
      });
    } else {
      console.log('✅ No hay inconsistencias entre definition y columnas');
    }
  } catch (error) {
    console.error('❌ Error verificando inconsistencias:', error.message);
  }
}

/**
 * Verifica valores inválidos según el contrato
 */
async function verificarValoresInvalidos() {
  console.log('');
  console.log('[JSON_CONTRACT] Verificando valores inválidos según contrato...');
  
  try {
    const result = await query(`
      SELECT 
        context_key,
        type,
        allowed_values,
        default_value,
        CASE 
          WHEN type = 'enum' AND default_value IS NOT NULL 
            AND NOT EXISTS (
              SELECT 1 
              FROM jsonb_array_elements_text(allowed_values) AS elem
              WHERE elem::text = default_value#>>'{}'
            )
          THEN 'default_value no está en allowed_values'
          WHEN type = 'number' AND default_value IS NOT NULL 
            AND jsonb_typeof(default_value) != 'number'
          THEN 'default_value debe ser number para type=number'
          WHEN type = 'boolean' AND default_value IS NOT NULL 
            AND jsonb_typeof(default_value) != 'boolean'
          THEN 'default_value debe ser boolean para type=boolean'
        END as problema
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          (type = 'enum' AND default_value IS NOT NULL 
            AND allowed_values IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 
              FROM jsonb_array_elements_text(allowed_values) AS elem
              WHERE elem::text = default_value#>>'{}'
            ))
          OR (type = 'number' AND default_value IS NOT NULL 
            AND jsonb_typeof(default_value) != 'number')
          OR (type = 'boolean' AND default_value IS NOT NULL 
            AND jsonb_typeof(default_value) != 'boolean')
        );
    `);
    
    if (result.rows.length > 0) {
      console.log(`⚠️  VALORES INVÁLIDOS: ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.problema}`);
        console.log(`     type: ${row.type}, default_value: ${row.default_value}`);
        VIOLACIONES.valores_invalidos.push(row);
      });
    } else {
      console.log('✅ No hay valores inválidos');
    }
  } catch (error) {
    console.error('❌ Error verificando valores inválidos:', error.message);
    // Puede fallar si allowed_values no es array, eso ya se detecta en tipos_incorrectos
  }
}

/**
 * Verifica estructura de definition JSONB
 */
async function verificarEstructuraDefinition() {
  console.log('');
  console.log('[JSON_CONTRACT] Verificando estructura de definition JSONB...');
  
  try {
    const result = await query(`
      SELECT 
        context_key,
        definition,
        CASE 
          WHEN definition->>'type' IS NULL THEN 'definition.type falta'
          WHEN definition->>'scope' IS NULL THEN 'definition.scope falta'
          WHEN definition->>'kind' IS NULL THEN 'definition.kind falta'
          WHEN definition->>'type' = 'enum' AND definition->'allowed_values' IS NULL THEN 'definition.allowed_values falta para enum'
        END as problema
      FROM pde_contexts
      WHERE deleted_at IS NULL
        AND (
          definition->>'type' IS NULL
          OR definition->>'scope' IS NULL
          OR definition->>'kind' IS NULL
          OR (definition->>'type' = 'enum' AND definition->'allowed_values' IS NULL)
        );
    `);
    
    if (result.rows.length > 0) {
      console.log(`⚠️  DEFINITION MAL ESTRUCTURADO: ${result.rows.length}`);
      result.rows.forEach(row => {
        console.log(`   - ${row.context_key}: ${row.problema}`);
        console.log(`     definition keys: ${Object.keys(row.definition || {}).join(', ')}`);
      });
    } else {
      console.log('✅ Todas las definitions tienen estructura correcta');
    }
  } catch (error) {
    console.error('❌ Error verificando estructura:', error.message);
  }
}

/**
 * Genera resumen de violaciones
 */
async function generarResumen() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN DE VIOLACIONES DE CONTRATO JSON');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Tipos incorrectos: ${VIOLACIONES.tipos_incorrectos.length}`);
  console.log(`Campos perdidos: ${VIOLACIONES.campos_perdidos.length}`);
  console.log(`Serialización inválida: ${VIOLACIONES.serializacion_invalida.length}`);
  console.log(`Inconsistencias definition: ${VIOLACIONES.inconsistencias_definition.length}`);
  console.log(`Valores inválidos: ${VIOLACIONES.valores_invalidos.length}`);
  console.log('');
  
  const total = Object.values(VIOLACIONES).reduce((sum, arr) => sum + arr.length, 0);
  
  if (total === 0) {
    console.log('✅ NO SE ENCONTRARON VIOLACIONES DE CONTRATO JSON');
  } else {
    console.log(`⚠️  TOTAL DE VIOLACIONES: ${total}`);
    console.log('');
    console.log('RECOMENDACIONES:');
    console.log('1. Corregir tipos incorrectos antes de continuar');
    console.log('2. Reconstruir definitions desde columnas dedicadas');
    console.log('3. Validar valores según el contrato canónico');
  }
  
  // Guardar resultados
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const { dirname } = await import('path');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const outputPath = path.join(__dirname, '..', 'docs', 'violaciones-contrato-json.json');
  
  fs.writeFileSync(outputPath, JSON.stringify(VIOLACIONES, null, 2));
  console.log(`✅ Resultados guardados en: ${outputPath}`);
}

// Ejecutar todas las verificaciones
async function ejecutarVerificacion() {
  try {
    await verificarTiposIncorrectos();
    await verificarCamposPerdidos();
    await verificarSerializacionInvalida();
    await verificarInconsistenciasDefinition();
    await verificarValoresInvalidos();
    await verificarEstructuraDefinition();
    await generarResumen();
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ VERIFICACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('❌ Error ejecutando verificación:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

ejecutarVerificacion();

