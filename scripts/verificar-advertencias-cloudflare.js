#!/usr/bin/env node
// Script para verificar si Cloudflare muestra advertencias en registros TXT

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL;
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const DOMAIN = 'eugenihidalgo.org';

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

async function listAllTXTRecords(zoneId, headers) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=TXT&per_page=100`, {
    method: 'GET',
    headers
  });

  const data = await response.json();
  return data.result || [];
}

function checkTXTFormatting(content) {
  const issues = [];
  
  // Verificar si está envuelto en comillas dobles
  if (!content.startsWith('"') || !content.endsWith('"')) {
    issues.push('No está envuelto en comillas dobles');
  }
  
  // Verificar saltos de línea
  if (content.includes('\n') || content.includes('\r')) {
    issues.push('Contiene saltos de línea');
  }
  
  // Verificar tabs
  if (content.includes('\t')) {
    issues.push('Contiene caracteres de tabulación');
  }
  
  // Verificar caracteres de control
  if (/[\x00-\x1F\x7F-\x9F]/.test(content)) {
    issues.push('Contiene caracteres de control');
  }
  
  // Verificar espacios no separables
  if (/[\u200B-\u200D\uFEFF]/.test(content)) {
    issues.push('Contiene espacios no separables');
  }
  
  // Verificar espacios al inicio/final (dentro de las comillas)
  const contentWithoutQuotes = content.replace(/^["']+|["']+$/g, '');
  if (contentWithoutQuotes !== contentWithoutQuotes.trim()) {
    issues.push('Tiene espacios al inicio o final');
  }
  
  return {
    hasIssues: issues.length > 0,
    issues: issues
  };
}

async function main() {
  try {
    console.log('🔍 VERIFICANDO ADVERTENCIAS DE CLOUDFLARE EN REGISTROS TXT\n');
    console.log(`Dominio: ${DOMAIN}\n`);

    const headers = await getHeaders();
    const zoneId = await getZoneId(headers);
    const txtRecords = await listAllTXTRecords(zoneId, headers);

    console.log(`📊 Total de registros TXT: ${txtRecords.length}\n`);

    let recordsWithIssues = 0;
    let recordsOK = 0;

    for (const record of txtRecords) {
      const check = checkTXTFormatting(record.content);
      
      if (check.hasIssues) {
        recordsWithIssues++;
        console.log(`⚠️  ${record.name}`);
        console.log(`   ID: ${record.id}`);
        check.issues.forEach(issue => {
          console.log(`   - ${issue}`);
        });
        console.log(`   Contenido: ${record.content.substring(0, 80)}...\n`);
      } else {
        recordsOK++;
      }
    }

    console.log(`${'='.repeat(80)}`);
    console.log(`📈 RESUMEN:`);
    console.log(`   ✅ Registros correctos: ${recordsOK}`);
    console.log(`   ⚠️  Registros con problemas: ${recordsWithIssues}`);
    console.log(`${'='.repeat(80)}\n`);

    if (recordsWithIssues === 0) {
      console.log(`✅ Todos los registros TXT están correctamente formateados.`);
      console.log(`   Cloudflare no debería mostrar advertencias.\n`);
    } else {
      console.log(`⚠️  Se encontraron ${recordsWithIssues} registro(s) con problemas de formato.`);
      console.log(`   Estos registros pueden mostrar advertencias en Cloudflare Dashboard.\n`);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

















