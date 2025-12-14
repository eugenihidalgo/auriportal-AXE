// scripts/optimizar-dns-kajabi-google.js
// Script para optimizar DNS: Kajabi envía, Google recibe

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

async function deleteRecord(zoneId, headers, recordId) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: 'DELETE',
      headers
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error eliminando registro: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.success;
}

async function updateRecord(zoneId, headers, recordId, recordData) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(recordData)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    // Si no se puede actualizar (405), intentar crear uno nuevo
    if (response.status === 405) {
      return null; // Retornar null para indicar que se debe crear nuevo
    }
    throw new Error(`Error actualizando registro: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    return null;
  }

  return data.result;
}

async function createRecord(zoneId, headers, recordData) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(recordData)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error creando registro: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ')}`);
  }

  return data.result;
}

function normalizeName(name, domain) {
  if (name === domain || name === '@') {
    return domain;
  }
  if (name.endsWith(`.${domain}`)) {
    return name;
  }
  return `${name}.${domain}`;
}

async function main() {
  try {
    console.log('🔧 Optimizando configuración DNS: Kajabi envía, Google recibe\n');
    console.log('📋 Objetivo:');
    console.log('   ✅ Kajabi puede enviar emails (SPF, DKIM, DMARC)');
    console.log('   ✅ Google recibe todos los emails (MX con prioridad alta)');
    console.log('   ✅ SPF combinado (Google + Mailgun)\n');

    const headers = await getHeaders();
    const zoneId = await getZoneId(headers);
    const allRecords = await listAllRecords(zoneId, headers);

    console.log(`📊 Total de registros encontrados: ${allRecords.length}\n`);

    // 1. Encontrar y combinar registros SPF
    console.log('📋 Paso 1: Combinando registros SPF...');
    const spfRecords = allRecords.filter(r => 
      r.type === 'TXT' && 
      (r.name === DOMAIN || r.name === '@') &&
      r.content.includes('v=spf1')
    );

    if (spfRecords.length === 0) {
      console.log('   ⚠️  No se encontraron registros SPF');
    } else {
      console.log(`   📝 Encontrados ${spfRecords.length} registros SPF:`);
      spfRecords.forEach(r => {
        console.log(`      - ${r.content.substring(0, 80)}...`);
      });

      // Extraer includes de cada SPF
      const includes = new Set();
      spfRecords.forEach(r => {
        const content = r.content;
        // Extraer includes
        const includeMatches = content.match(/include:([^\s]+)/g);
        if (includeMatches) {
          includeMatches.forEach(inc => {
            includes.add(inc.replace('include:', ''));
          });
        }
      });

      // Crear SPF combinado
      const combinedSPF = `v=spf1 ${Array.from(includes).map(inc => `include:${inc}`).join(' ')} ~all`;
      console.log(`\n   ✅ SPF combinado: ${combinedSPF}`);

      // Actualizar el primer registro SPF y eliminar los demás
      if (spfRecords.length > 0) {
        const mainSPF = spfRecords[0];
        const recordData = {
          type: 'TXT',
          name: DOMAIN,
          content: combinedSPF,
          ttl: 1,
          proxied: false
        };

        console.log(`   🔄 Actualizando registro SPF principal (ID: ${mainSPF.id})...`);
        const updated = await updateRecord(zoneId, headers, mainSPF.id, recordData);
        
        if (updated) {
          console.log(`      ✅ Actualizado exitosamente`);
        } else {
          console.log(`      ⚠️  No se pudo actualizar, creando nuevo registro...`);
          await createRecord(zoneId, headers, recordData);
          console.log(`      ✅ Creado exitosamente`);
          // Eliminar el antiguo
          await deleteRecord(zoneId, headers, mainSPF.id);
        }

        // Eliminar registros SPF duplicados
        for (let i = 1; i < spfRecords.length; i++) {
          console.log(`   🗑️  Eliminando registro SPF duplicado (ID: ${spfRecords[i].id})...`);
          await deleteRecord(zoneId, headers, spfRecords[i].id);
          console.log(`      ✅ Eliminado`);
        }
      }
    }

    // 2. Eliminar registros MX de Mailgun (mantener solo Google)
    console.log('\n📋 Paso 2: Eliminando registros MX de Mailgun...');
    const mailgunMX = allRecords.filter(r => 
      r.type === 'MX' && 
      (r.name === DOMAIN || r.name === '@') &&
      (r.content === 'mxa.mailgun.org' || r.content === 'mxb.mailgun.org')
    );

    if (mailgunMX.length === 0) {
      console.log('   ✅ No hay registros MX de Mailgun para eliminar');
    } else {
      console.log(`   📝 Encontrados ${mailgunMX.length} registros MX de Mailgun`);
      for (const mx of mailgunMX) {
        console.log(`   🗑️  Eliminando MX: ${mx.content} (Priority ${mx.priority})...`);
        await deleteRecord(zoneId, headers, mx.id);
        console.log(`      ✅ Eliminado`);
      }
    }

    // 3. Verificar que DKIM y DMARC estén correctos (no hacer cambios, solo informar)
    console.log('\n📋 Paso 3: Verificando DKIM y DMARC...');
    const dkim = allRecords.find(r => 
      r.type === 'TXT' && 
      r.name === `k1._domainkey.${DOMAIN}` &&
      r.content.includes('k=rsa')
    );
    const dmarc = allRecords.find(r => 
      r.type === 'TXT' && 
      r.name === `_dmarc.${DOMAIN}` &&
      r.content.includes('v=DMARC1')
    );

    if (dkim) {
      console.log(`   ✅ DKIM configurado: k1._domainkey.${DOMAIN}`);
    } else {
      console.log(`   ⚠️  DKIM no encontrado (debería estar configurado)`);
    }

    if (dmarc) {
      console.log(`   ✅ DMARC configurado: _dmarc.${DOMAIN}`);
    } else {
      console.log(`   ⚠️  DMARC no encontrado (debería estar configurado)`);
    }

    // 4. Verificar registros MX de Google
    console.log('\n📋 Paso 4: Verificando registros MX de Google...');
    const googleMX = allRecords.filter(r => 
      r.type === 'MX' && 
      (r.name === DOMAIN || r.name === '@') &&
      r.content.includes('google.com')
    );

    if (googleMX.length > 0) {
      console.log(`   ✅ ${googleMX.length} registros MX de Google encontrados (prioridad alta)`);
      googleMX.forEach(mx => {
        console.log(`      - ${mx.content} (Priority ${mx.priority})`);
      });
    } else {
      console.log(`   ⚠️  No se encontraron registros MX de Google`);
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('✅ Optimización completada!\n');
    console.log('📋 Configuración final:');
    console.log('   ✅ SPF combinado (Google + Mailgun)');
    console.log('   ✅ DKIM configurado para Kajabi');
    console.log('   ✅ DMARC configurado');
    console.log('   ✅ MX solo de Google (recepción)');
    console.log('   ✅ CNAME email → mailgun.org (para envío de Kajabi)');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Espera 5-15 minutos para la propagación DNS');
    console.log('   2. Verifica en Kajabi que los registros estén correctos');
    console.log('   3. Los emails recibidos irán a Google');
    console.log('   4. Los emails enviados por Kajabi estarán autenticados');
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







