#!/usr/bin/env node
/**
 * Script de prueba para verificar la conexión del servidor MCP de Google Workspace
 * 
 * Uso:
 *   npm run mcp:test
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { verificarConexionGoogle } from '../src/services/google-workspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

const env = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE,
  GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
  GOOGLE_WORKSPACE_DOMAIN: process.env.GOOGLE_WORKSPACE_DOMAIN,
  EMAIL_FROM: process.env.EMAIL_FROM,
};

async function testConnection() {
  console.log('🔍 Verificando conexión con Google Workspace...\n');

  // Verificar variables de entorno
  console.log('📋 Variables de entorno:');
  console.log(`   GOOGLE_SERVICE_ACCOUNT_KEY: ${env.GOOGLE_SERVICE_ACCOUNT_KEY ? '✅ Configurado' : '❌ No configurado'}`);
  console.log(`   GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: ${env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE || 'No configurado'}`);
  console.log(`   GOOGLE_PROJECT_ID: ${env.GOOGLE_PROJECT_ID || 'No configurado'}`);
  console.log(`   GOOGLE_CLIENT_ID: ${env.GOOGLE_CLIENT_ID ? '✅ Configurado' : '❌ No configurado'}`);
  console.log(`   GOOGLE_CLIENT_SECRET: ${env.GOOGLE_CLIENT_SECRET ? '✅ Configurado' : '❌ No configurado'}`);
  console.log('');

  // Verificar conexión
  try {
    const resultado = await verificarConexionGoogle(env);
    
    if (resultado.success) {
      console.log('✅ Conexión exitosa con Google Workspace!');
      console.log(`   Email: ${resultado.email}`);
      console.log(`   Total de mensajes: ${resultado.messagesTotal}`);
      console.log(`   Total de hilos: ${resultado.threadsTotal}`);
      console.log('\n🎉 El servidor MCP está listo para usar!');
    } else {
      console.log('❌ Error en la conexión:');
      console.log(`   ${resultado.error}`);
    }
  } catch (error) {
    console.error('❌ Error verificando conexión:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testConnection();

