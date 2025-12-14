#!/usr/bin/env node
// Script para agregar el registro DMARC TXT de Kajabi en Cloudflare para eugenihidalgo.org

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL;
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
const DOMAIN = 'eugenihidalgo.org';

// Registro DMARC a agregar
const DMARC_RECORD = {
  type: 'TXT',
  name: '_dmarc.y.kajabimail.net',
  content: 'v=DMARC1; p=none; pct=100; fo=1; ri=3600; rf=afrf; rua=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com,mailto:dmarc_agg@dmarc.250ok.net; ruf=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com,mailto:dmarc_fr@dmarc.250ok.net',
  ttl: 1, // Auto
  proxied: false // Los registros TXT no deben estar proxied
};

async function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  
  if (CLOUDFLARE_API_TOKEN) {
    headers['Authorization'] = `Bearer ${CLOUDFLARE_API_TOKEN}`;
  } else if (CLOUDFLARE_EMAIL && CLOUDFLARE_API_KEY) {
    headers['X-Auth-Email'] = CLOUDFLARE_EMAIL;
    headers['X-Auth-Key'] = CLOUDFLARE_API_KEY;
  } else {
    throw new Error('No hay credenciales de Cloudflare configuradas. Configura CLOUDFLARE_API_TOKEN o CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY en .env');
  }
  
  return headers;
}

async function getZoneId(headers) {
  console.log(`🔍 Buscando Zone ID para ${DOMAIN}...`);
  
  const response = await fetch('https://api.cloudflare.com/client/v4/zones', {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error obteniendo zonas: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
  }

  const zone = data.result.find(z => z.name === DOMAIN);
  
  if (!zone) {
    throw new Error(`No se encontró la zona para ${DOMAIN}. Zonas disponibles: ${data.result.map(z => z.name).join(', ')}`);
  }

  console.log(`✅ Zone ID encontrado: ${zone.id}`);
  return zone.id;
}

async function listAllRecords(zoneId, headers) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error listando registros: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
  }

  return data.result || [];
}

async function findExistingDMARCRecord(records) {
  // Buscar registros TXT con el nombre exacto o con el dominio agregado
  const exactName = DMARC_RECORD.name;
  const withDomain = `${DMARC_RECORD.name}.${DOMAIN}`;
  
  const found = records.find(r => 
    r.type === 'TXT' && 
    (r.name === exactName || r.name === withDomain)
  );
  
  // Debug: mostrar todos los registros TXT relacionados con dmarc o kajabi
  const relatedTXT = records.filter(r => 
    r.type === 'TXT' && 
    (r.name.toLowerCase().includes('dmarc') || 
     r.name.toLowerCase().includes('kajabi') ||
     r.content.toLowerCase().includes('dmarc'))
  );
  
  if (relatedTXT.length > 0) {
    console.log(`\n   📋 Registros TXT relacionados encontrados: ${relatedTXT.length}`);
    relatedTXT.forEach(r => {
      console.log(`      - ${r.name} (ID: ${r.id})`);
    });
  }
  
  return found;
}

async function createOrUpdateDMARC(zoneId, headers, existingRecord) {
  // Para registros que no terminan con el dominio de la zona, usar el nombre exacto
  // Cloudflare requiere que el nombre sea un FQDN o termine con el dominio de la zona
  // En este caso, usamos el nombre exacto tal cual porque es un registro especial de Kajabi
  const recordData = {
    type: DMARC_RECORD.type,
    name: DMARC_RECORD.name, // Usar el nombre exacto sin modificar
    content: DMARC_RECORD.content,
    ttl: DMARC_RECORD.ttl,
    proxied: DMARC_RECORD.proxied
  };

  // Si existe, actualizar
  if (existingRecord && existingRecord.id) {
    console.log(`   🔄 Actualizando registro existente (ID: ${existingRecord.id})...`);
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(recordData)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error actualizando registro: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    console.log(`     ✅ Registro actualizado exitosamente`);
    return { action: 'updated', record: data.result };
  }
  
  // Si no existe, crear nuevo
  console.log(`   ➕ Creando nuevo registro...`);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(recordData)
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error creando registro: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
  }

  console.log(`     ✅ Registro creado exitosamente`);
  return { action: 'created', record: data.result };
}

function verifyDNSResolution(hostname) {
  try {
    console.log(`\n🔍 Verificando resolución DNS para ${hostname}...`);
    const result = execSync(`dig +short TXT "${hostname}"`, { encoding: 'utf-8', timeout: 10000 });
    const records = result.trim().split('\n').filter(r => r);
    
    if (records.length === 0) {
      console.log(`   ⚠️  No se encontraron registros TXT (puede tardar unos minutos en propagarse)`);
      return false;
    }
    
    console.log(`   ✅ Registro encontrado:`);
    records.forEach((record, i) => {
      console.log(`      ${i + 1}. ${record}`);
    });
    
    // Verificar que el contenido coincida
    const foundRecord = records.find(r => r.includes('v=DMARC1'));
    if (foundRecord) {
      console.log(`   ✅ Contiene v=DMARC1 - Registro DMARC válido`);
      return true;
    } else {
      console.log(`   ⚠️  Registro encontrado pero no contiene v=DMARC1`);
      return false;
    }
  } catch (error) {
    console.log(`   ⚠️  Error al verificar DNS: ${error.message}`);
    console.log(`   ℹ️  Esto puede ser normal si el registro aún no se ha propagado`);
    return false;
  }
}

function filterKajabiMailgunRecords(records) {
  const keywords = ['kajabi', 'mailgun', 'dmarc', 'spf', 'dkim', 'mx', 'email'];
  
  return records.filter(r => {
    const nameLower = r.name.toLowerCase();
    const contentLower = r.content.toLowerCase();
    
    return keywords.some(keyword => 
      nameLower.includes(keyword) || contentLower.includes(keyword)
    );
  });
}

function displayDNSSummary(records) {
  console.log(`\n📊 RESUMEN DE REGISTROS DNS`);
  console.log('='.repeat(80));
  
  // Filtrar registros relacionados con Kajabi/Mailgun
  const kajabiRecords = filterKajabiMailgunRecords(records);
  
  // Agrupar por tipo
  const byType = {};
  records.forEach(r => {
    if (!byType[r.type]) {
      byType[r.type] = [];
    }
    byType[r.type].push(r);
  });
  
  // Mostrar todos los tipos
  Object.keys(byType).sort().forEach(type => {
    console.log(`\n📌 ${type} RECORDS (${byType[type].length}):`);
    console.log('-'.repeat(80));
    
    byType[type].forEach((record, i) => {
      const isKajabi = kajabiRecords.includes(record);
      const marker = isKajabi ? '🔵' : '  ';
      
      console.log(`${marker} ${i + 1}. ${record.name}`);
      console.log(`      Content: ${record.content.substring(0, 100)}${record.content.length > 100 ? '...' : ''}`);
      if (record.priority !== undefined) {
        console.log(`      Priority: ${record.priority}`);
      }
      console.log(`      TTL: ${record.ttl === 1 ? 'Auto' : record.ttl}`);
      console.log(`      Proxied: ${record.proxied ? 'Yes 🟠' : 'No'}`);
      console.log(`      ID: ${record.id}`);
    });
  });
  
  // Resumen de registros Kajabi/Mailgun
  console.log(`\n🔵 REGISTROS RELACIONADOS CON KAJABI/MAILGUN (${kajabiRecords.length}):`);
  console.log('-'.repeat(80));
  kajabiRecords.forEach((record, i) => {
    console.log(`\n${i + 1}. ${record.type} - ${record.name}`);
    console.log(`   Content: ${record.content.substring(0, 150)}${record.content.length > 150 ? '...' : ''}`);
  });
  
  // Verificar duplicados del registro DMARC
  const dmarcRecords = records.filter(r => 
    r.type === 'TXT' && r.name === DMARC_RECORD.name
  );
  
  if (dmarcRecords.length > 1) {
    console.log(`\n⚠️  ADVERTENCIA: Se encontraron ${dmarcRecords.length} registros DMARC con el mismo nombre:`);
    dmarcRecords.forEach((r, i) => {
      console.log(`   ${i + 1}. ID: ${r.id} - Content: ${r.content.substring(0, 80)}...`);
    });
  } else if (dmarcRecords.length === 1) {
    console.log(`\n✅ Registro DMARC único encontrado (sin duplicados)`);
  }
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  try {
    console.log('🚀 Agregando registro DMARC TXT de Kajabi a Cloudflare\n');
    console.log(`📋 Configuración:`);
    console.log(`   Dominio: ${DOMAIN}`);
    console.log(`   Tipo: ${DMARC_RECORD.type}`);
    console.log(`   Host: ${DMARC_RECORD.name}`);
    console.log(`   Valor: ${DMARC_RECORD.content.substring(0, 80)}...\n`);

    // Verificar credenciales
    if (!CLOUDFLARE_API_TOKEN && (!CLOUDFLARE_EMAIL || !CLOUDFLARE_API_KEY)) {
      console.error('❌ Error: No hay credenciales de Cloudflare configuradas.');
      console.error('\n📝 Para configurar las credenciales:');
      console.error('   1. Opción 1 (Recomendado): Crea un API Token en Cloudflare');
      console.error('      - Ve a: https://dash.cloudflare.com/profile/api-tokens');
      console.error('      - Crea un token con permisos: Zone → DNS → Edit');
      console.error('      - Agrega a .env: CLOUDFLARE_API_TOKEN=tu_token_aqui\n');
      console.error('   2. Opción 2: Usa Email + API Key');
      console.error('      - Ve a: https://dash.cloudflare.com/profile/api-tokens');
      console.error('      - Copia tu Global API Key');
      console.error('      - Agrega a .env:');
      console.error('        CLOUDFLARE_EMAIL=tu_email@ejemplo.com');
      console.error('        CLOUDFLARE_API_KEY=tu_api_key_aqui\n');
      process.exit(1);
    }

    const headers = await getHeaders();
    const zoneId = await getZoneId(headers);
    
    // Listar todos los registros existentes
    console.log(`\n🔍 Listando registros DNS existentes...`);
    const allRecords = await listAllRecords(zoneId, headers);
    console.log(`   ✅ Encontrados ${allRecords.length} registros DNS`);
    
    // Buscar registro DMARC existente
    let existingDMARC = findExistingDMARCRecord(allRecords);
    
    // Buscar registros incorrectos (con el dominio agregado)
    const incorrectRecords = allRecords.filter(r => 
      r.type === 'TXT' && 
      r.name === `${DMARC_RECORD.name}.${DOMAIN}`
    );
    
    // Eliminar registros incorrectos
    if (incorrectRecords.length > 0) {
      console.log(`\n⚠️  Se encontraron ${incorrectRecords.length} registro(s) con nombre incorrecto. Eliminándolos...`);
      for (const incorrectRecord of incorrectRecords) {
        try {
          const deleteResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${incorrectRecord.id}`,
            {
              method: 'DELETE',
              headers
            }
          );
          
          if (deleteResponse.ok) {
            console.log(`   ✅ Eliminado registro incorrecto: ${incorrectRecord.name} (ID: ${incorrectRecord.id})`);
          } else {
            console.log(`   ⚠️  No se pudo eliminar el registro ${incorrectRecord.id}`);
          }
        } catch (error) {
          console.log(`   ⚠️  Error al eliminar registro ${incorrectRecord.id}: ${error.message}`);
        }
      }
      
      // Después de eliminar, volver a listar los registros para obtener el estado actualizado
      console.log(`\n🔍 Actualizando lista de registros después de la eliminación...`);
      const updatedRecords = await listAllRecords(zoneId, headers);
      const updatedExistingDMARC = findExistingDMARCRecord(updatedRecords);
      
      if (updatedExistingDMARC && updatedExistingDMARC.name === DMARC_RECORD.name) {
        existingDMARC = updatedExistingDMARC;
      } else {
        existingDMARC = null;
      }
    }
    
    if (existingDMARC && existingDMARC.id && existingDMARC.name && existingDMARC.name === DMARC_RECORD.name) {
      console.log(`\n📋 Registro DMARC existente encontrado:`);
      console.log(`   ID: ${existingDMARC.id}`);
      console.log(`   Name: ${existingDMARC.name}`);
      if (existingDMARC.content) {
        console.log(`   Content: ${existingDMARC.content.substring(0, 100)}...`);
        
        // Verificar si el contenido es diferente
        if (existingDMARC.content === DMARC_RECORD.content) {
          console.log(`\n✅ El registro ya existe con el contenido correcto. No se realizarán cambios.`);
          // Continuar para mostrar el resumen
        } else {
          console.log(`\n⚠️  El contenido es diferente. Se actualizará el registro.`);
        }
      }
    } else {
      console.log(`\n📋 No se encontró registro DMARC existente con el nombre correcto. Se creará uno nuevo.`);
      existingDMARC = null;
    }

    // Crear o actualizar el registro solo si es necesario
    let result = null;
    if (existingDMARC && existingDMARC.content === DMARC_RECORD.content) {
      console.log(`\n📝 El registro ya existe y es correcto. No se realizarán cambios.`);
      result = { action: 'no_change', record: existingDMARC };
    } else {
      console.log(`\n📝 ${existingDMARC ? 'Actualizando' : 'Creando'} registro DMARC...`);
      result = await createOrUpdateDMARC(zoneId, headers, existingDMARC);
      
      console.log(`\n✅ ${result.action === 'created' ? 'Registro creado' : 'Registro actualizado'} exitosamente!`);
      console.log(`   ID: ${result.record.id}`);
      console.log(`   Name: ${result.record.name}`);
      console.log(`   Type: ${result.record.type}`);
      console.log(`   TTL: ${result.record.ttl === 1 ? 'Auto' : result.record.ttl}`);
      console.log(`   Proxied: ${result.record.proxied ? 'Yes' : 'No'}`);
    }

    // Verificar resolución DNS
    verifyDNSResolution(DMARC_RECORD.name);

    // Obtener todos los registros actualizados
    console.log(`\n🔍 Obteniendo lista completa de registros DNS...`);
    const updatedRecords = await listAllRecords(zoneId, headers);
    
    // Mostrar resumen completo
    displayDNSSummary(updatedRecords);

    console.log(`\n✅ Proceso completado exitosamente!\n`);
    console.log(`📝 Próximos pasos:`);
    console.log(`   1. Espera 5-15 minutos para que el DNS se propague completamente`);
    console.log(`   2. Verifica la resolución DNS con: dig TXT "${DMARC_RECORD.name}"`);
    console.log(`   3. Verifica en Cloudflare Dashboard que el registro esté correcto\n`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
    process.exit(1);
  }
}

main();
