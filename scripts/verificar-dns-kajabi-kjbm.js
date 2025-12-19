// scripts/verificar-dns-kajabi-kjbm.js
// Script para verificar que los registros DNS de Kajabi estén correctos en kjbm.eugenihidalgo.org

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
const SUBDOMAIN = 'kjbm';
const FULL_DOMAIN = `${SUBDOMAIN}.${DOMAIN}`;

// Registros requeridos por Kajabi EXACTAMENTE como los pide
const REQUIRED_RECORDS = {
  txt: [
    { 
      name: SUBDOMAIN, 
      description: 'SPF Record', 
      expected: 'v=spf1 include:mailgun.org ~all' 
    },
    { 
      name: `k1._domainkey.${SUBDOMAIN}`, 
      description: 'DKIM Record', 
      expected: 'k=rsa' 
    },
    { 
      name: `_dmarc.${SUBDOMAIN}`, 
      description: 'DMARC Record', 
      expected: 'v=DMARC1' 
    }
  ],
  mx: [
    { 
      name: SUBDOMAIN, 
      content: 'mxa.mailgun.org', 
      priority: 10 
    },
    { 
      name: SUBDOMAIN, 
      content: 'mxb.mailgun.org', 
      priority: 20 
    }
  ],
  cname: [
    { 
      name: `email.${SUBDOMAIN}`, 
      content: 'mailgun.org' 
    }
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

function checkRecord(record, required) {
  const recordName = record.name;
  const requiredName = required.name.includes('.') 
    ? `${required.name}.${DOMAIN}` 
    : `${required.name}.${DOMAIN}`;
  
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

async function main() {
  try {
    console.log(`🔍 Verificando configuración DNS de Kajabi para ${FULL_DOMAIN}\n`);

    const headers = await getHeaders();
    const zoneId = await getZoneId(headers);
    const allRecords = await listAllRecords(zoneId, headers);

    // Filtrar solo registros del subdominio kjbm
    const kjbmRecords = allRecords.filter(r => r.name.includes(SUBDOMAIN));

    console.log(`📊 Total de registros DNS encontrados: ${allRecords.length}`);
    console.log(`📊 Registros en ${SUBDOMAIN}: ${kjbmRecords.length}\n`);

    // Verificar registros requeridos
    console.log('🔍 Verificación de registros requeridos por Kajabi:\n');

    let allFound = true;

    // Verificar TXT
    console.log('📋 Registros TXT:');
    for (const req of REQUIRED_RECORDS.txt) {
      const fullName = req.name.includes('.') 
        ? `${req.name}.${DOMAIN}` 
        : `${req.name}.${DOMAIN}`;
      
      const found = kjbmRecords.find(r => 
        r.type === 'TXT' && 
        r.name === fullName &&
        r.content.includes(req.expected)
      );
      
      const status = found ? '✅' : '❌';
      console.log(`${status} ${req.description} (${fullName})`);
      if (!found) {
        allFound = false;
        console.log(`   ⚠️  No encontrado o incorrecto`);
      } else {
        console.log(`   ✅ ${found.content.substring(0, 60)}...`);
      }
    }

    // Verificar MX
    console.log('\n📋 Registros MX:');
    for (const req of REQUIRED_RECORDS.mx) {
      const fullName = `${req.name}.${DOMAIN}`;
      
      const found = kjbmRecords.find(r => 
        r.type === 'MX' && 
        r.name === fullName &&
        r.content === req.content &&
        r.priority === req.priority
      );
      
      const status = found ? '✅' : '❌';
      console.log(`${status} MX Record: ${req.content} (Priority ${req.priority})`);
      if (!found) {
        allFound = false;
        console.log(`   ⚠️  No encontrado o incorrecto`);
      } else {
        console.log(`   ✅ ${found.name} → ${found.content} (Priority ${found.priority})`);
      }
    }

    // Verificar CNAME
    console.log('\n📋 Registros CNAME:');
    for (const req of REQUIRED_RECORDS.cname) {
      const fullName = `${req.name}.${DOMAIN}`;
      
      const found = kjbmRecords.find(r => 
        r.type === 'CNAME' && 
        r.name === fullName &&
        r.content === req.content
      );
      
      const status = found ? '✅' : '❌';
      console.log(`${status} CNAME: ${fullName} → ${req.content}`);
      if (!found) {
        allFound = false;
        console.log(`   ⚠️  No encontrado o incorrecto`);
      } else {
        console.log(`   ✅ ${found.name} → ${found.content}`);
      }
    }

    // Verificar proxy status
    console.log('\n⚠️  Verificación de Proxy Status:');
    const proxiedRecords = kjbmRecords.filter(r => r.proxied && (r.type === 'TXT' || r.type === 'MX' || r.type === 'CNAME'));
    if (proxiedRecords.length > 0) {
      console.log('   ⚠️  ADVERTENCIA: Los siguientes registros tienen proxy activado (deberían estar en DNS only):');
      proxiedRecords.forEach(record => {
        console.log(`      - ${record.type} ${record.name}`);
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
      console.log('   2. Ve a Kajabi → Settings → Custom Domain');
      console.log('   3. Verifica que Kajabi detecte todos los registros');
      console.log('   4. Activa el dominio personalizado en Kajabi');
      console.log('\nℹ️  Nota: Los emails recibidos seguirán yendo a Google (MX en la raíz)');
      console.log('   Los emails enviados por Kajabi estarán autenticados correctamente');
    } else {
      console.log('❌ Faltan algunos registros o hay problemas de configuración');
      console.log('\n📝 Para configurar los registros faltantes:');
      console.log('   node scripts/configurar-dns-kajabi-kjbm.js');
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



















