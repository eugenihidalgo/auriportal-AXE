#!/usr/bin/env node
// Script para verificar la configuración de Google Workspace

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL;
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const DOMAIN = 'vegasquestfantasticworld.win';

const GOOGLE_MX_RECORDS = [
  { priority: 1, host: 'aspmx.l.google.com' },
  { priority: 5, host: 'alt1.aspmx.l.google.com' },
  { priority: 5, host: 'alt2.aspmx.l.google.com' },
  { priority: 10, host: 'alt3.aspmx.l.google.com' },
  { priority: 10, host: 'alt4.aspmx.l.google.com' }
];

const GOOGLE_SPF = 'v=spf1 include:_spf.google.com ~all';

async function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  
  if (CLOUDFLARE_API_TOKEN) {
    headers['Authorization'] = `Bearer ${CLOUDFLARE_API_TOKEN}`;
  } else if (CLOUDFLARE_EMAIL && CLOUDFLARE_API_KEY) {
    headers['X-Auth-Email'] = CLOUDFLARE_EMAIL;
    headers['X-Auth-Key'] = CLOUDFLARE_API_KEY;
  } else {
    throw new Error('No hay credenciales de Cloudflare configuradas.');
  }
  
  return headers;
}

async function getZoneId(headers) {
  const response = await fetch('https://api.cloudflare.com/client/v4/zones', {
    method: 'GET',
    headers
  });

  const data = await response.json();
  const zone = data.result.find(z => z.name === DOMAIN);
  return zone.id;
}

async function listAllRecords(zoneId, headers, type = null) {
  let url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`;
  if (type) {
    url += `&type=${type}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  const data = await response.json();
  return data.result || [];
}

function verifyDNSResolution(hostname, type = 'MX') {
  try {
    const result = execSync(`dig +short ${type} "${hostname}"`, { 
      encoding: 'utf-8', 
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const records = result.trim().split('\n').filter(r => r && r.trim());
    return {
      success: records.length > 0,
      records: records
    };
  } catch (error) {
    return {
      success: false,
      records: []
    };
  }
}

async function main() {
  try {
    console.log('🔍 VERIFICANDO CONFIGURACIÓN DE GOOGLE WORKSPACE\n');
    console.log(`Dominio: ${DOMAIN}\n`);

    const headers = await getHeaders();
    const zoneId = await getZoneId(headers);

    const allRecords = await listAllRecords(zoneId, headers);
    const mxRecords = allRecords.filter(r => r.type === 'MX');
    const txtRecords = allRecords.filter(r => r.type === 'TXT');

    console.log('📊 REGISTROS ENCONTRADOS:\n');
    console.log(`   MX: ${mxRecords.length}`);
    console.log(`   TXT: ${txtRecords.length}\n`);

    // Verificar registros MX
    console.log('📋 VERIFICACIÓN DE REGISTROS MX:\n');
    const googleMXFound = [];
    const otherMXFound = [];
    
    for (const mx of mxRecords) {
      const isGoogle = GOOGLE_MX_RECORDS.some(g => g.host === mx.content && g.priority === mx.priority);
      if (isGoogle) {
        googleMXFound.push(mx);
        console.log(`   ✅ ${mx.content} (Priority: ${mx.priority}) - Google Workspace`);
      } else {
        otherMXFound.push(mx);
        const isCloudflare = mx.content.includes('cloudflare.net');
        const isMailgun = mx.content.includes('mailgun.org');
        let type = 'Desconocido';
        if (isCloudflare) type = 'Cloudflare Email Routing';
        else if (isMailgun) type = 'Mailgun';
        console.log(`   ⚠️  ${mx.content} (Priority: ${mx.priority}) - ${type}`);
      }
    }

    console.log(`\n   📈 Resumen MX:`);
    console.log(`      ✅ Google Workspace: ${googleMXFound.length} de ${GOOGLE_MX_RECORDS.length} esperados`);
    console.log(`      ⚠️  Otros: ${otherMXFound.length}`);

    // Verificar SPF
    console.log('\n📋 VERIFICACIÓN DE REGISTRO SPF:\n');
    const spfRecords = txtRecords.filter(txt => {
      const content = txt.content.replace(/^["']+|["']+$/g, '');
      return content.startsWith('v=spf1');
    });

    if (spfRecords.length === 0) {
      console.log(`   ❌ No se encontraron registros SPF`);
    } else if (spfRecords.length > 1) {
      console.log(`   ⚠️  ADVERTENCIA: Se encontraron ${spfRecords.length} registros SPF (debe haber solo uno)`);
      spfRecords.forEach((spf, i) => {
        const content = spf.content.replace(/^["']+|["']+$/g, '');
        console.log(`      ${i + 1}. ${content}`);
      });
    } else {
      const spfContent = spfRecords[0].content.replace(/^["']+|["']+$/g, '');
      if (spfContent === GOOGLE_SPF) {
        console.log(`   ✅ SPF Correcto: ${GOOGLE_SPF}`);
      } else {
        console.log(`   ⚠️  SPF No coincide:`);
        console.log(`      Actual: ${spfContent}`);
        console.log(`      Esperado: ${GOOGLE_SPF}`);
      }
    }

    // Verificar resolución DNS
    console.log('\n🌐 VERIFICACIÓN DE RESOLUCIÓN DNS:\n');
    const mxResolution = verifyDNSResolution(DOMAIN, 'MX');
    if (mxResolution.success) {
      console.log(`   ✅ Registros MX se resuelven:`);
      mxResolution.records.forEach((r, i) => {
        console.log(`      ${i + 1}. ${r}`);
      });
    } else {
      console.log(`   ⚠️  Los registros MX no se resuelven aún`);
    }

    const txtResolution = verifyDNSResolution(DOMAIN, 'TXT');
    if (txtResolution.success) {
      const spfInDNS = txtResolution.records.filter(r => r.includes('v=spf1'));
      if (spfInDNS.length > 0) {
        console.log(`\n   ✅ Registro SPF se resuelve:`);
        spfInDNS.forEach((r, i) => {
          console.log(`      ${i + 1}. ${r.substring(0, 100)}...`);
        });
      }
    }

    // Reporte final
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 REPORTE DE VERIFICACIÓN`);
    console.log(`${'='.repeat(80)}\n`);

    const mxStatus = googleMXFound.length === GOOGLE_MX_RECORDS.length && otherMXFound.length === 0;
    const spfStatus = spfRecords.length === 1 && spfRecords[0].content.replace(/^["']+|["']+$/g, '') === GOOGLE_SPF;

    console.log(`✅ REGISTROS MX (Google Workspace): ${mxStatus ? '✅ COMPLETO' : '⚠️  INCOMPLETO'}`);
    if (!mxStatus) {
      if (googleMXFound.length < GOOGLE_MX_RECORDS.length) {
        console.log(`   - Faltan ${GOOGLE_MX_RECORDS.length - googleMXFound.length} registro(s) MX de Google`);
      }
      if (otherMXFound.length > 0) {
        console.log(`   - Hay ${otherMXFound.length} registro(s) MX adicional(es) que deben eliminarse`);
      }
    }

    console.log(`\n✅ REGISTRO SPF: ${spfStatus ? '✅ CORRECTO' : '⚠️  INCORRECTO'}`);
    if (!spfStatus) {
      if (spfRecords.length === 0) {
        console.log(`   - No se encontró registro SPF`);
      } else if (spfRecords.length > 1) {
        console.log(`   - Hay ${spfRecords.length} registros SPF (debe haber solo uno)`);
      } else {
        console.log(`   - El contenido del SPF no coincide con el esperado`);
      }
    }

    console.log(`\n🌐 PROPAGACIÓN DNS:`);
    console.log(`   - MX: ${mxResolution.success ? '✅ Activa' : '⏳ En progreso'}`);
    console.log(`   - SPF: ${txtResolution.success ? '✅ Activa' : '⏳ En progreso'}`);

    console.log(`\n${'='.repeat(80)}\n`);

    if (mxStatus && spfStatus) {
      console.log(`✅ CONFIGURACIÓN COMPLETA Y CORRECTA\n`);
      console.log(`   - Todos los registros MX de Google Workspace están configurados`);
      console.log(`   - El SPF está correctamente configurado`);
      console.log(`   - No hay registros conflictivos\n`);
    } else {
      console.log(`⚠️  CONFIGURACIÓN INCOMPLETA\n`);
      console.log(`   Revisa los detalles arriba y completa los pasos faltantes.\n`);
      console.log(`   Consulta: CONFIGURACION_GOOGLE_WORKSPACE.md para instrucciones detalladas.\n`);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();




















