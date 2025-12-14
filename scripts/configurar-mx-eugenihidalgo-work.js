// scripts/configurar-mx-eugenihidalgo-work.js
// Script per configurar MX records per a eugenihidalgo.work

import dotenv from 'dotenv';
import { configurarMX, configurarSPF, configurarDMARC } from '../src/services/cloudflare-dns.js';

dotenv.config();

async function configurarDNS() {
  try {
    if (!process.env.CLOUDFLARE_API_TOKEN) {
      throw new Error('CLOUDFLARE_API_TOKEN ha d\'estar configurat al .env');
    }

    const dominio = 'eugenihidalgo.work';
    const emailReporte = 'eugeni@eugenihidalgo.work';

    console.log(`🌐 Configurant DNS per ${dominio}...\n`);

    // Configurar MX records per Google Workspace
    console.log('📧 Configurant registres MX...');
    const mxResult = await configurarMX(dominio);
    console.log('   MX 10:', mxResult[0].success ? '✅' : '❌');
    console.log('   MX 20:', mxResult[1].success ? '✅' : '❌');

    // Configurar SPF
    console.log('\n📝 Configurant SPF...');
    const spfResult = await configurarSPF(dominio);
    console.log('   SPF:', spfResult.success ? '✅' : '❌');

    // Configurar DMARC
    console.log('\n🛡️  Configurant DMARC...');
    const dmarcResult = await configurarDMARC(dominio, emailReporte);
    console.log('   DMARC:', dmarcResult.success ? '✅' : '❌');

    console.log('\n✅ Configuració DNS completada!');
    console.log('\n⏳ Espera 5-15 minuts per la propagació DNS abans de provar l\'enviament.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

configurarDNS();



