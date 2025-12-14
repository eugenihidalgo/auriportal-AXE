#!/usr/bin/env node
// scripts/configurar-webhooks-email.js
// Script para configurar webhooks de email (Mailgun + Kajabi)

import dotenv from 'dotenv';
import { crearWebhookKajabi, listarWebhooksKajabi, EVENTOS_KAJABI } from '../src/services/kajabi-webhooks.js';
import { obtenerSiteIdPorNombre } from '../src/services/kajabi.js';

// Cargar variables de entorno
dotenv.config();

const env = {
  KAJABI_CLIENT_ID: process.env.KAJABI_CLIENT_ID,
  KAJABI_CLIENT_SECRET: process.env.KAJABI_CLIENT_SECRET,
  KAJABI_SITE_NAME: process.env.KAJABI_SITE_NAME || 'Plataforma de desarrollo espiritual Eugeni Hidalgo'
};

// URL base de tu servidor (ajusta según tu dominio)
const BASE_URL = process.env.BASE_URL || 'https://pdeeugenihidalgo.org';

async function main() {
  console.log('🚀 Configurando webhooks de email...\n');

  // Verificar credenciales
  if (!env.KAJABI_CLIENT_ID || !env.KAJABI_CLIENT_SECRET) {
    console.error('❌ Error: KAJABI_CLIENT_ID y KAJABI_CLIENT_SECRET deben estar configurados en .env');
    process.exit(1);
  }

  try {
    // Obtener siteId
    console.log('🔍 Obteniendo siteId de Kajabi...');
    const siteId = await obtenerSiteIdPorNombre(
      env.KAJABI_SITE_NAME,
      env.KAJABI_CLIENT_ID,
      env.KAJABI_CLIENT_SECRET
    );

    if (!siteId) {
      console.error('❌ No se pudo obtener el siteId');
      process.exit(1);
    }

    console.log(`✅ Site ID: ${siteId}\n`);

    // Listar webhooks existentes
    console.log('📋 Webhooks existentes:');
    const webhooksExistentes = await listarWebhooksKajabi(env, siteId);
    if (webhooksExistentes.length === 0) {
      console.log('   (ninguno)\n');
    } else {
      webhooksExistentes.forEach(webhook => {
        const attrs = webhook.attributes || {};
        console.log(`   - ${attrs.event}: ${attrs.target_url}`);
      });
      console.log('');
    }

    // Crear webhooks recomendados
    const webhooksACrear = [
      {
        evento: EVENTOS_KAJABI.FORM_SUBMISSION,
        descripcion: 'Envíos de formularios'
      },
      {
        evento: EVENTOS_KAJABI.PURCHASE,
        descripcion: 'Compras realizadas'
      },
      {
        evento: EVENTOS_KAJABI.PAYMENT_SUCCEEDED,
        descripcion: 'Pagos exitosos'
      },
      {
        evento: EVENTOS_KAJABI.TAG_ADDED,
        descripcion: 'Tags agregados a contactos'
      }
    ];

    console.log('🔧 Creando webhooks...\n');

    for (const webhook of webhooksACrear) {
      const targetUrl = `${BASE_URL}/kajabi-webhook`;
      
      // Verificar si ya existe
      const existe = webhooksExistentes.some(
        w => w.attributes?.event === webhook.evento && w.attributes?.target_url === targetUrl
      );

      if (existe) {
        console.log(`⏭️  Webhook "${webhook.evento}" ya existe, saltando...`);
        continue;
      }

      try {
        await crearWebhookKajabi(
          webhook.evento,
          targetUrl,
          env,
          siteId
        );
        console.log(`✅ Webhook creado: ${webhook.evento} (${webhook.descripcion})`);
      } catch (error) {
        console.error(`❌ Error creando webhook ${webhook.evento}: ${error.message}`);
      }
    }

    console.log('\n✅ Configuración completada!\n');
    console.log('📝 Próximos pasos:');
    console.log('   1. Configura las rutas de Mailgun en: https://app.mailgun.com');
    console.log('   2. Agrega una ruta que apunte a: ' + BASE_URL + '/api/email-inbound');
    console.log('   3. Prueba enviando un email a tu dirección de recepción');
    console.log('   4. Verifica los logs con: pm2 logs aurelinportal\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();






