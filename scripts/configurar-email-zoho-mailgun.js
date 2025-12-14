#!/usr/bin/env node
// scripts/configurar-email-zoho-mailgun.js
// Script de ayuda para configurar la integración Zoho Mail + Mailgun

import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';

dotenv.config();

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  📧 Configuración: Zoho Mail + Mailgun + Spark              ║
╚══════════════════════════════════════════════════════════════╝

Este script te ayudará a verificar tu configuración.

`);

// Verificar variables de entorno
const variables = {
  'ZOHO_IMAP_SERVER': process.env.ZOHO_IMAP_SERVER,
  'ZOHO_SMTP_SERVER': process.env.ZOHO_SMTP_SERVER,
  'MAILGUN_API_KEY': process.env.MAILGUN_API_KEY,
  'MAILGUN_DOMAIN': process.env.MAILGUN_DOMAIN,
  'MAILGUN_WEBHOOK_SECRET': process.env.MAILGUN_WEBHOOK_SECRET,
  'INBOUND_EMAIL': process.env.INBOUND_EMAIL,
  'EMAIL_FROM': process.env.EMAIL_FROM
};

console.log('📋 Verificando variables de entorno:\n');

let todasConfiguradas = true;
for (const [key, value] of Object.entries(variables)) {
  if (value) {
    console.log(`   ✅ ${key}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`   ❌ ${key}: NO CONFIGURADO`);
    todasConfiguradas = false;
  }
}

console.log('\n');

if (!todasConfiguradas) {
  console.log('⚠️  Algunas variables no están configuradas.\n');
  console.log('Agrega estas variables a tu archivo .env:\n');
  console.log('# Zoho Mail');
  console.log('ZOHO_IMAP_SERVER=imap.zoho.com');
  console.log('ZOHO_SMTP_SERVER=smtp.zoho.com');
  console.log('');
  console.log('# Mailgun');
  console.log('MAILGUN_API_KEY=key-tu_api_key_aqui');
  console.log('MAILGUN_DOMAIN=mg.eugenihidalgo.work');
  console.log('MAILGUN_WEBHOOK_SECRET=tu_secreto_aleatorio_aqui');
  console.log('');
  console.log('# Emails');
  console.log('INBOUND_EMAIL=contacto@eugenihidalgo.work');
  console.log('EMAIL_FROM=eugeni@eugenihidalgo.work');
  console.log('\n');
}

// Verificar archivos necesarios
console.log('📁 Verificando archivos necesarios:\n');

const archivos = [
  'src/services/email-mailgun.js',
  'src/endpoints/email-inbound.js',
  'src/endpoints/kajabi-webhook.js',
  'src/services/kajabi-webhooks.js'
];

let todosExisten = true;
for (const archivo of archivos) {
  if (existsSync(archivo)) {
    console.log(`   ✅ ${archivo}`);
  } else {
    console.log(`   ❌ ${archivo} - NO EXISTE`);
    todosExisten = false;
  }
}

console.log('\n');

// Instrucciones
console.log('📝 Próximos pasos:\n');
console.log('1. Configurar Zoho Mail:');
console.log('   - Crear cuenta en https://www.zoho.com/mail/');
console.log('   - Verificar dominio');
console.log('   - Crear 5 usuarios');
console.log('   - Configurar DNS (MX, SPF, DKIM)');
console.log('');
console.log('2. Agregar cuentas en Spark:');
console.log('   - Abre Spark');
console.log('   - Spark → Añadir cuenta');
console.log('   - Para cada cuenta:');
console.log('     * Email: usuario@eugenihidalgo.work');
console.log('     * IMAP: imap.zoho.com:993 (SSL)');
console.log('     * SMTP: smtp.zoho.com:587 (STARTTLS)');
console.log('');
console.log('3. Configurar Mailgun:');
console.log('   - Crear cuenta en https://www.mailgun.com');
console.log('   - Verificar dominio');
console.log('   - Crear ruta en Receiving → Routes:');
console.log('     * Expression: match_recipient');
console.log('     * Recipient: contacto@eugenihidalgo.work');
console.log('     * Action: forward("https://pdeeugenihidalgo.org/api/email-inbound")');
console.log('     * Action (opcional): forward("eugeni@eugenihidalgo.work")');
console.log('');
console.log('4. Configurar webhooks de Kajabi:');
console.log('   - Ejecuta: node scripts/configurar-webhooks-email.js');
console.log('');
console.log('5. Probar:');
console.log('   - Envía un email de prueba a contacto@eugenihidalgo.work');
console.log('   - Verifica los logs: pm2 logs aurelinportal');
console.log('   - Verifica que aparece en Spark (si configuraste reenvío)');
console.log('\n');

if (todasConfiguradas && todosExisten) {
  console.log('✅ ¡Todo está configurado correctamente!\n');
} else {
  console.log('⚠️  Completa los pasos faltantes antes de continuar.\n');
}



