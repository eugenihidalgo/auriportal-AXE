#!/usr/bin/env node
// scripts/verify-env.js
// Script para verificar que .env existe y contiene las variables requeridas
// NO expone valores reales de secretos

import { 
  envFileExists, 
  getRequiredEnvKeys, 
  redactedEnvSnapshot,
  loadEnvIfNeeded 
} from '../src/core/config/env.js';

/**
 * Verifica el estado del archivo .env y las variables requeridas
 */
function verifyEnv() {
  console.log('🔍 Verificando configuración de variables de entorno...\n');
  
  // 1. Verificar que .env existe
  const envExists = envFileExists('.env');
  
  if (!envExists) {
    console.error('❌ ERROR: Archivo .env no encontrado');
    console.error('   Crea el archivo .env copiando desde .env.example:');
    console.error('   cp .env.example .env');
    console.error('   nano .env  # Edita y configura los valores reales\n');
    process.exit(1);
  }
  
  console.log('✅ Archivo .env encontrado');
  
  // 2. Cargar .env (si no está ya cargado por PM2)
  const loadResult = loadEnvIfNeeded({ force: true });
  if (loadResult.loaded) {
    console.log(`✅ Variables cargadas desde: ${loadResult.path}`);
  } else if (loadResult.reason) {
    console.log(`ℹ️  ${loadResult.reason}`);
  }
  
  // 3. Obtener lista de variables requeridas
  const requiredKeys = getRequiredEnvKeys();
  console.log(`\n📋 Verificando ${requiredKeys.length} variable(s) requerida(s)...\n`);
  
  // 4. Verificar cada variable
  const missing = [];
  const present = [];
  
  for (const key of requiredKeys) {
    const value = process.env[key];
    if (!value || value.trim() === '' || value === `<${key}>` || value.startsWith('<')) {
      missing.push(key);
      console.log(`❌ ${key}: MISSING`);
    } else {
      present.push(key);
      console.log(`✅ ${key}: OK`);
    }
  }
  
  // 5. Generar snapshot sin valores reales
  const snapshot = redactedEnvSnapshot(requiredKeys);
  
  // 6. Resultado final
  console.log('\n' + '='.repeat(60));
  
  if (missing.length === 0) {
    console.log('✅ TODAS LAS VARIABLES REQUERIDAS ESTÁN CONFIGURADAS');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } else {
    console.log(`❌ FALTAN ${missing.length} VARIABLE(S) REQUERIDA(S)`);
    console.log('='.repeat(60));
    console.log('\n📊 Estado de variables (sin exponer valores):');
    console.log(JSON.stringify(snapshot, null, 2));
    console.log('\n⚠️  Variables faltantes:');
    missing.forEach(key => console.log(`   - ${key}`));
    console.log('\n💡 Acción requerida:');
    console.log('   1. Edita el archivo .env: nano .env');
    console.log('   2. Añade las variables faltantes (consulta .env.example)');
    console.log('   3. Guarda y vuelve a ejecutar este script\n');
    process.exit(1);
  }
}

// Ejecutar verificación
try {
  verifyEnv();
} catch (error) {
  console.error('\n❌ Error durante la verificación:', error.message);
  if (error.missing) {
    console.error('   Variables faltantes:', error.missing.join(', '));
  }
  process.exit(1);
}













