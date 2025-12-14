#!/usr/bin/env node
// scripts/configurar-gmail-api.js
// Script de ayuda para configurar Gmail API

import dotenv from 'dotenv';
import { obtenerUrlAutorizacion } from '../src/services/email-gmail.js';

dotenv.config();

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  📧 Configuración de Gmail API (Google Workspace)            ║
╚══════════════════════════════════════════════════════════════╝

Este script te ayudará a configurar Gmail API paso a paso.

`);

// Verificar variables de entorno
const variables = {
  'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
  'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
  'GOOGLE_REDIRECT_URI': process.env.GOOGLE_REDIRECT_URI,
  'GOOGLE_REFRESH_TOKEN': process.env.GOOGLE_REFRESH_TOKEN
};

console.log('📋 Verificando variables de entorno:\n');

let todasConfiguradas = true;
for (const [key, value] of Object.entries(variables)) {
  if (value) {
    if (key === 'GOOGLE_REFRESH_TOKEN') {
      console.log(`   ✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ✅ ${key}: ${value.substring(0, 30)}...`);
    }
  } else {
    console.log(`   ❌ ${key}: NO CONFIGURADO`);
    todasConfiguradas = false;
  }
}

console.log('\n');

if (!todasConfiguradas) {
  console.log('⚠️  Algunas variables no están configuradas.\n');
  console.log('📝 Pasos para configurar Gmail API:\n');
  console.log('1. Ve a: https://console.cloud.google.com');
  console.log('2. Crea un nuevo proyecto o selecciona uno existente');
  console.log('3. Habilita "Gmail API" en la biblioteca de APIs');
  console.log('4. Ve a "Credenciales" → "Crear credenciales" → "ID de cliente OAuth"');
  console.log('5. Configura:');
  console.log('   - Tipo: Aplicación web');
  console.log('   - URI de redirección autorizados: https://pdeeugenihidalgo.org/oauth/callback');
  console.log('6. Descarga el JSON de credenciales');
  console.log('7. Agrega al .env:');
  console.log('   GOOGLE_CLIENT_ID=tu_client_id');
  console.log('   GOOGLE_CLIENT_SECRET=tu_client_secret');
  console.log('   GOOGLE_REDIRECT_URI=https://pdeeugenihidalgo.org/oauth/callback');
  console.log('\n');
  console.log('8. Para obtener el refresh token, ejecuta este script de nuevo');
  console.log('   y visita la URL que se mostrará.\n');
}

// Si tenemos client_id y client_secret, mostrar URL de autorización
if (variables.GOOGLE_CLIENT_ID && variables.GOOGLE_CLIENT_SECRET && !variables.GOOGLE_REFRESH_TOKEN) {
  try {
    const authUrl = obtenerUrlAutorizacion();
    console.log('🔗 URL de Autorización:\n');
    console.log(authUrl);
    console.log('\n');
    console.log('📝 Pasos:');
    console.log('1. Abre la URL de arriba en tu navegador');
    console.log('2. Autoriza el acceso a Gmail');
    console.log('3. Serás redirigido a /oauth/callback');
    console.log('4. Copia el refresh_token que se mostrará');
    console.log('5. Agrégalo a tu .env como GOOGLE_REFRESH_TOKEN\n');
  } catch (error) {
    console.error('❌ Error generando URL de autorización:', error.message);
  }
}

if (todasConfiguradas) {
  console.log('✅ ¡Configuración completa!\n');
  console.log('📝 Próximos pasos:');
  console.log('1. Agrega cuentas en Spark usando IMAP:');
  console.log('   - Servidor: imap.gmail.com');
  console.log('   - Puerto: 993 (SSL)');
  console.log('2. Configura webhooks (Push notifications) si lo necesitas');
  console.log('3. Prueba enviando un email con la API\n');
} else {
  console.log('⚠️  Completa la configuración antes de continuar.\n');
}



