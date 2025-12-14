// scripts/verificar-dns-kajabi.js
// Script para verificar los registros DNS actuales de eugenihidalgo.org en Cloudflare

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL;
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const DOMAIN = 'eugenihidalgo.org';

// Registros requeridos por Kajabi para ENVÍO de emails
// NOTA: Los MX de Mailgun NO son necesarios si solo se usa para envío (no recepción)
const REQUIRED_RECORDS = {
  txt: [
    { name: '@', description: 'SPF Record', expected: 'v=spf1 include:mailgun.org' },
    { name: 'k1._domainkey', description: 'DKIM Record', expected: 'k=rsa' },
    { name: '_dmarc', description: 'DMARC Record', expected: 'v=DMARC1' }
  ],
  mx: [
    // Los MX de Mailgun solo son necesarios para RECEPCIÓN
    // Si solo se usa para ENVÍO, no son requeridos
    // { name: '@', content: 'mxa.mailgun.org', priority: 10 },
    // { name: '@', content: 'mxb.mailgun.org', priority: 20 }
  ],
  cname: [
    { name: 'email', content: 'mailgun.org' }
  ]
};

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

  if (!response.ok) {
    throw new Error(`Error obteniendo zonas: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ')}`);
  }

  const zone = data.result.find(z => z.name === DOMAIN);
  
  if (!zone) {
    throw new Error(`No se encontró la zona para ${DOMAIN}`);
  }

  return zone.id;
}

async function listAllRecords(zoneId, headers) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    throw new Error(`Error listando registros: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ')}`);
  }

  return data.result || [];
}

function normalizeName(name, domain) {
  if (name === domain || name === '@') {
    return '@';
  }
  if (name.endsWith(`.${domain}`)) {
    return name.replace(`.${domain}`, '');
  }
  return name;
}

function checkRecord(record, required) {
  const recordName = normalizeName(record.name, DOMAIN);
  const requiredName = required.name === '@' ? '@' : required.name;
  
  if (recordName !== requiredName) {
    return false;
  }
  
  if (record.type === 'TXT') {
    return record.content.includes(required.expected);
  }
  
  if (record.type === 'MX') {
    return record.content === required.content && record.priority === required.priority;
  }
  
  if (record.type === 'CNAME') {
    return record.content === required.content;
  }
  
  return false;
}

function displayRecord(record, domain) {
  const name = normalizeName(record.name, domain);
  const displayName = name === '@' ? domain : `${name}.${domain}`;
  const proxyStatus = record.proxied ? '🟠 Proxied' : '⚪ DNS only';
  
  let info = `   ${record.type.padEnd(6)} ${displayName.padEnd(30)}`;
  
  if (record.type === 'MX') {
    info += ` ${record.content.padEnd(25)} Priority: ${record.priority}`;
  } else if (record.type === 'TXT') {
    const content = record.content.length > 60 
      ? record.content.substring(0, 57) + '...' 
      : record.content;
    info += ` ${content}`;
  } else {
    info += ` ${record.content}`;
  }
  
  info += ` ${proxyStatus}`;
  
  return info;
}

async function main() {
  try {
    console.log('🔍 Verificando configuración DNS de Kajabi para eugenihidalgo.org\n');

    const headers = await getHeaders();
    const zoneId = await getZoneId(headers);
    const allRecords = await listAllRecords(zoneId, headers);

    console.log(`📊 Total de registros DNS encontrados: ${allRecords.length}\n`);

    // Separar registros por tipo
    const txtRecords = allRecords.filter(r => r.type === 'TXT');
    const mxRecords = allRecords.filter(r => r.type === 'MX');
    const cnameRecords = allRecords.filter(r => r.type === 'CNAME');
    const aRecords = allRecords.filter(r => r.type === 'A');

    // Verificar registros TXT requeridos
    console.log('📋 Registros TXT:');
    if (txtRecords.length === 0) {
      console.log('   ⚠️  No se encontraron registros TXT');
    } else {
      txtRecords.forEach(record => {
        const found = REQUIRED_RECORDS.txt.some(req => checkRecord(record, req));
        const status = found ? '✅' : 'ℹ️ ';
        console.log(`${status} ${displayRecord(record, DOMAIN)}`);
      });
    }

    // Verificar registros MX requeridos
    console.log('\n📋 Registros MX:');
    if (mxRecords.length === 0) {
      console.log('   ⚠️  No se encontraron registros MX');
    } else {
      mxRecords.forEach(record => {
        const found = REQUIRED_RECORDS.mx.some(req => checkRecord(record, req));
        const status = found ? '✅' : 'ℹ️ ';
        console.log(`${status} ${displayRecord(record, DOMAIN)}`);
      });
    }

    // Verificar registros CNAME requeridos
    console.log('\n📋 Registros CNAME:');
    if (cnameRecords.length === 0) {
      console.log('   ⚠️  No se encontraron registros CNAME');
    } else {
      cnameRecords.forEach(record => {
        const found = REQUIRED_RECORDS.cname.some(req => checkRecord(record, req));
        const status = found ? '✅' : 'ℹ️ ';
        console.log(`${status} ${displayRecord(record, DOMAIN)}`);
      });
    }

    // Mostrar registros A (información adicional)
    if (aRecords.length > 0) {
      console.log('\n📋 Registros A (información adicional):');
      aRecords.forEach(record => {
        console.log(`   ℹ️  ${displayRecord(record, DOMAIN)}`);
      });
    }

    // Verificación de registros requeridos
    console.log('\n🔍 Verificación de registros requeridos por Kajabi:\n');

    let allFound = true;

    // Verificar TXT
    REQUIRED_RECORDS.txt.forEach(req => {
      const found = txtRecords.some(record => checkRecord(record, req));
      const status = found ? '✅' : '❌';
      console.log(`${status} ${req.description} (${req.name === '@' ? DOMAIN : `${req.name}.${DOMAIN}`})`);
      if (!found) allFound = false;
    });

    // Verificar MX
    REQUIRED_RECORDS.mx.forEach(req => {
      const found = mxRecords.some(record => checkRecord(record, req));
      const status = found ? '✅' : '❌';
      console.log(`${status} MX Record: ${req.content} (Priority ${req.priority})`);
      if (!found) allFound = false;
    });

    // Verificar CNAME
    REQUIRED_RECORDS.cname.forEach(req => {
      const found = cnameRecords.some(record => checkRecord(record, req));
      const status = found ? '✅' : '❌';
      console.log(`${status} CNAME: ${req.name}.${DOMAIN} → ${req.content}`);
      if (!found) allFound = false;
    });

    // Verificar proxy status
    console.log('\n⚠️  Verificación de Proxy Status:');
    const proxiedRecords = [...txtRecords, ...mxRecords, ...cnameRecords].filter(r => r.proxied);
    if (proxiedRecords.length > 0) {
      console.log('   ⚠️  ADVERTENCIA: Los siguientes registros tienen proxy activado (deberían estar en DNS only):');
      proxiedRecords.forEach(record => {
        console.log(`      - ${record.type} ${normalizeName(record.name, DOMAIN) === '@' ? DOMAIN : `${normalizeName(record.name, DOMAIN)}.${DOMAIN}`}`);
      });
      allFound = false;
    } else {
      console.log('   ✅ Todos los registros tienen proxy desactivado (correcto)');
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    if (allFound) {
      console.log('✅ Todos los registros requeridos por Kajabi están configurados correctamente');
      console.log('\n📝 Próximos pasos:');
      console.log('   1. Espera 5-15 minutos para la propagación DNS');
      console.log('   2. Verifica en Kajabi que detecte los registros');
      console.log('   3. Activa el dominio personalizado en Kajabi');
    } else {
      console.log('❌ Faltan algunos registros o hay problemas de configuración');
      console.log('\n📝 Para configurar los registros faltantes:');
      console.log('   node scripts/configurar-dns-kajabi.js');
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
    process.exit(1);
  }
}

main();

