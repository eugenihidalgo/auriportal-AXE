// scripts/configurar-zoho-completo-api.js
// Script per configurar tot Zoho Mail i DNS via APIs

import dotenv from 'dotenv';
import { agregarDominio, verificarDominio, obtenerDKIM, crearEmail, listarDominios } from '../src/services/zoho-mail-admin.js';
import { configurarDNSCompleto } from '../src/services/cloudflare-dns.js';

dotenv.config();

// Emails a configurar
const EMAILS = [
  { email: 'master@vegasquestfantasticworld.win', password: process.env.ZOHO_MASTER_PASSWORD || 'GenerarPassword123!', displayName: 'Master' },
  { email: 'eugeni@eugenihidalgo.org', password: process.env.ZOHO_EUGENI_PASSWORD || 'GenerarPassword123!', displayName: 'Eugeni' },
  { email: 'elcalordelalma@eugenihidalgo.org', password: process.env.ZOHO_ELCALOR_PASSWORD || 'GenerarPassword123!', displayName: 'El Calor del Alma' },
  { email: 'bennascut@eugenihidalgo.org', password: process.env.ZOHO_BENNASCUT_PASSWORD || 'GenerarPassword123!', displayName: 'Bennascut' }
];

// Dominis únics
const DOMINIOS = ['vegasquestfantasticworld.win', 'eugenihidalgo.org'];

async function esperar(segundos) {
  return new Promise(resolve => setTimeout(resolve, segundos * 1000));
}

async function configurarTodo() {
  console.log('🚀 Iniciant configuració completa de Zoho Mail via API...\n');

  // Verificar credencials
  if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN) {
    console.error('❌ Error: Falten credencials de Zoho API');
    console.error('Necessites configurar al .env:');
    console.error('  - ZOHO_CLIENT_ID');
    console.error('  - ZOHO_CLIENT_SECRET');
    console.error('  - ZOHO_REFRESH_TOKEN');
    console.error('  - ZOHO_ACCOUNT_ID');
    process.exit(1);
  }

  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error('❌ Error: Falta CLOUDFLARE_API_TOKEN al .env');
    process.exit(1);
  }

  // Pas 1: Llistar dominis existents
  console.log('📋 Verificant dominis existents a Zoho...');
  const dominiosExistentes = await listarDominios();
  if (dominiosExistentes.success) {
    console.log(`   Dominis trobats: ${dominiosExistentes.dominios.map(d => d.domainName).join(', ')}\n`);
  }

  // Pas 2: Afegir dominis a Zoho
  const verificaciones = {};
  for (const dominio of DOMINIOS) {
    console.log(`🌐 Afegint domini ${dominio} a Zoho Mail...`);
    
    const resultado = await agregarDominio(dominio);
    if (resultado.success) {
      console.log(`   ✅ Domini afegit`);
      if (resultado.verificationRecord) {
        console.log(`   📝 Registre de verificació: ${resultado.verificationRecord}`);
        verificaciones[dominio] = resultado.verificationRecord;
      }
    } else {
      if (resultado.error.includes('already exists') || resultado.error.includes('ya existe')) {
        console.log(`   ⚠️  Domini ja existeix`);
      } else {
        console.error(`   ❌ Error: ${resultado.error}`);
        continue;
      }
    }
    
    await esperar(2); // Esperar entre peticions
  }

  console.log('\n⏳ Esperant 10 segons abans de verificar dominis...\n');
  await esperar(10);

  // Pas 3: Verificar dominis (després d'afegir registres TXT a Cloudflare)
  console.log('🔍 Verificant dominis...');
  console.log('⚠️  IMPORTANT: Abans de continuar, afegeix els registres TXT de verificació a Cloudflare!\n');
  
  for (const dominio of DOMINIOS) {
    if (verificaciones[dominio]) {
      console.log(`   Per ${dominio}, afegeix a Cloudflare:`);
      console.log(`   Type: TXT`);
      console.log(`   Name: @ (o el que indiqui Zoho)`);
      console.log(`   Content: ${verificaciones[dominio]}\n`);
    }
  }

  const continuar = process.argv.includes('--skip-verification') || process.argv.includes('--auto');
  
  if (!continuar) {
    console.log('Pressiona Enter quan hagis afegit els registres TXT a Cloudflare...');
    // En un entorn real, podries fer readline aquí
    await esperar(30); // Esperar 30 segons per defecte
  }

  // Pas 4: Obtenir DKIM i configurar DNS
  for (const dominio of DOMINIOS) {
    console.log(`\n📝 Configurant DNS per ${dominio}...`);
    
    // Obtenir DKIM
    console.log('   → Obtenint clau DKIM de Zoho...');
    const dkim = await obtenerDKIM(dominio);
    
    let dkimRecord = null;
    if (dkim.success && dkim.dkim) {
      dkimRecord = dkim.dkim;
      console.log('   ✅ DKIM obtingut');
    } else {
      console.log(`   ⚠️  No s'ha pogut obtenir DKIM: ${dkim.error}`);
    }

    // Configurar DNS a Cloudflare
    const emailReporte = dominio === 'vegasquestfantasticworld.win' 
      ? 'master@vegasquestfantasticworld.win'
      : 'eugeni@eugenihidalgo.org';

    const dnsResult = await configurarDNSCompleto(dominio, dkimRecord, emailReporte);
    
    console.log(`   ✅ DNS configurat per ${dominio}`);
    if (dnsResult.mx) console.log(`      MX: ${dnsResult.mx.every(r => r.success) ? 'OK' : 'Error'}`);
    if (dnsResult.spf) console.log(`      SPF: ${dnsResult.spf.success ? 'OK' : 'Error'}`);
    if (dnsResult.dkim) console.log(`      DKIM: ${dnsResult.dkim.success ? 'OK' : 'Error'}`);
    if (dnsResult.dmarc) console.log(`      DMARC: ${dnsResult.dmarc.success ? 'OK' : 'Error'}`);

    await esperar(2);
  }

  // Pas 5: Crear emails
  console.log('\n👤 Creant emails a Zoho Mail...\n');
  
  for (const emailConfig of EMAILS) {
    console.log(`   → Creant ${emailConfig.email}...`);
    const resultado = await crearEmail(emailConfig.email, emailConfig.password, emailConfig.displayName);
    
    if (resultado.success) {
      console.log(`   ✅ Email creat: ${emailConfig.email}`);
    } else {
      if (resultado.error.includes('already exists') || resultado.error.includes('ya existe')) {
        console.log(`   ⚠️  Email ja existeix: ${emailConfig.email}`);
      } else {
        console.error(`   ❌ Error creant ${emailConfig.email}: ${resultado.error}`);
      }
    }
    
    await esperar(2);
  }

  console.log('\n✅ Configuració completada!');
  console.log('\n📝 Pròxims passos:');
  console.log('   1. Generar contrasenyes d\'aplicació per cada email a Zoho');
  console.log('   2. Actualitzar .env amb les contrasenyes d\'aplicació');
  console.log('   3. Provar enviament utilitzant el servei de email des del teu codi');
}

configurarTodo().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});






