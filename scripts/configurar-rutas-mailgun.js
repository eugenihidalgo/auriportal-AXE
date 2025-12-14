#!/usr/bin/env node
// scripts/configurar-rutas-mailgun.js
// Script para configurar múltiples rutas de email en Mailgun

import dotenv from 'dotenv';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

dotenv.config();

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
});

const dominio = process.env.MAILGUN_DOMAIN || process.env.MAILGUN_DOMAIN?.replace('mg.', '');
const baseUrl = process.env.BASE_URL || 'https://pdeeugenihidalgo.org';

// Direcciones de email a configurar
const direcciones = [
  { email: 'contacto', tipo: 'contacto', reenviarZoho: false },
  { email: 'ventas', tipo: 'ventas', reenviarZoho: false },
  { email: 'soporte', tipo: 'soporte', reenviarZoho: false },
  { email: 'info', tipo: 'info', reenviarZoho: false },
  { email: 'eugeni', tipo: 'personal', reenviarZoho: true } // Reenviar a Zoho para ver en Spark
];

async function listarRutasExistentes() {
  try {
    const routes = await mg.routes.list(dominio);
    console.log(`\n📋 Rutas existentes en Mailgun:\n`);
    
    if (routes.items && routes.items.length > 0) {
      routes.items.forEach((route, index) => {
        console.log(`   ${index + 1}. ${route.description || 'Sin descripción'}`);
        console.log(`      Expresión: ${route.expression}`);
        console.log(`      Acciones: ${route.actions?.join(', ') || 'Ninguna'}\n`);
      });
    } else {
      console.log('   (ninguna ruta configurada)\n');
    }
    
    return routes.items || [];
  } catch (error) {
    console.error('❌ Error listando rutas:', error.message);
    return [];
  }
}

async function crearRuta(direccion) {
  const emailCompleto = `${direccion.email}@${dominio}`;
  const expresion = `match_recipient("${emailCompleto}")`;
  const webhookUrl = `${baseUrl}/api/email-inbound?tipo=${direccion.tipo}`;
  
  const acciones = [
    `forward("${webhookUrl}")`,
    'stop()'
  ];
  
  // Si se debe reenviar a Zoho Mail
  if (direccion.reenviarZoho && process.env.ZOHO_EMAIL_DESTINO) {
    acciones.unshift(`forward("${process.env.ZOHO_EMAIL_DESTINO}")`);
  }
  
  try {
    const route = await mg.routes.create(dominio, {
      priority: 0,
      description: `Ruta para ${emailCompleto} (${direccion.tipo})`,
      expression: expresion,
      action: acciones
    });
    
    console.log(`✅ Ruta creada para ${emailCompleto}`);
    console.log(`   Webhook: ${webhookUrl}`);
    if (direccion.reenviarZoho) {
      console.log(`   Reenvío a Zoho: ${process.env.ZOHO_EMAIL_DESTINO}`);
    }
    return route;
  } catch (error) {
    if (error.message.includes('already exists') || error.status === 400) {
      console.log(`⏭️  Ruta para ${emailCompleto} ya existe, saltando...`);
      return null;
    }
    console.error(`❌ Error creando ruta para ${emailCompleto}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  📧 Configurar Rutas de Email en Mailgun                    ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Verificar configuración
  if (!process.env.MAILGUN_API_KEY) {
    console.error('❌ Error: MAILGUN_API_KEY no está configurado en .env');
    process.exit(1);
  }

  if (!dominio) {
    console.error('❌ Error: MAILGUN_DOMAIN no está configurado en .env');
    process.exit(1);
  }

  console.log(`🔍 Dominio: ${dominio}`);
  console.log(`🔗 Base URL: ${baseUrl}\n`);

  // Listar rutas existentes
  const rutasExistentes = await listarRutasExistentes();

  // Crear rutas
  console.log('🔧 Creando rutas para direcciones de email...\n');

  for (const direccion of direcciones) {
    await crearRuta(direccion);
    console.log(''); // Línea en blanco
  }

  console.log('✅ Configuración completada!\n');
  console.log('📝 Próximos pasos:');
  console.log('   1. Verifica las rutas en: https://app.mailgun.com');
  console.log('   2. Prueba enviando un email a cada dirección');
  console.log('   3. Verifica los logs: pm2 logs aurelinportal');
  console.log('   4. Si configuraste reenvío a Zoho, verifica que lleguen los emails\n');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});



