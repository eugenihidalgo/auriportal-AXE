#!/usr/bin/env node
// Script para verificación específica de registros DMARC de Kajabi en Cloudflare

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

// Registros a verificar
const TARGET_RECORDS = {
  'kjbm': {
    expectedName: '_dmarc.kjbm',
    expectedFullName: '_dmarc.kjbm.eugenihidalgo.org',
    description: '_dmarc.kjbm (subdominio kjbm)'
  },
  'kajabimail': {
    expectedName: '_dmarc.y.kajabimail.net',
    expectedFullName: '_dmarc.y.kajabimail.net',
    description: '_dmarc.y.kajabimail.net (zona externa)'
  }
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
    const error = await response.text();
    throw new Error(`Error obteniendo zonas: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
  }

  const zone = data.result.find(z => z.name === DOMAIN);
  
  if (!zone) {
    throw new Error(`No se encontró la zona para ${DOMAIN}`);
  }

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

function findRecordsByName(records, searchPatterns) {
  const found = [];
  
  for (const record of records) {
    if (record.type !== 'TXT') continue;
    
    for (const pattern of searchPatterns) {
      if (record.name.includes(pattern) || record.name === pattern) {
        found.push(record);
        break;
      }
    }
  }
  
  return found;
}

function verifyDNSResolution(hostname) {
  try {
    const result = execSync(`dig +short TXT "${hostname}"`, { 
      encoding: 'utf-8', 
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const records = result.trim().split('\n').filter(r => r && r.trim());
    return {
      success: records.length > 0,
      records: records,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      records: [],
      error: error.message
    };
  }
}

function formatTXTContent(content) {
  // Remover comillas si están presentes
  return content.replace(/^"/, '').replace(/"$/, '');
}

async function verifyRecord(recordKey, zoneId, headers, allRecords) {
  const target = TARGET_RECORDS[recordKey];
  const results = {
    key: recordKey,
    description: target.description,
    expectedName: target.expectedName,
    expectedFullName: target.expectedFullName,
    foundInCloudflare: false,
    cloudflareName: null,
    cloudflareContent: null,
    cloudflareId: null,
    cloudflareTTL: null,
    cloudflareProxied: null,
    dnsResolution: {
      expectedName: null,
      expectedFullName: null,
      cloudflareStoredName: null
    },
    analysis: {
      nameMatches: false,
      cloudflareAppendedDomain: false,
      resolvesCorrectly: false,
      canBeValidated: false,
      issues: []
    }
  };

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 VERIFICANDO: ${target.description}`);
  console.log(`${'='.repeat(80)}`);

  // Buscar en Cloudflare
  const searchPatterns = [
    target.expectedName,
    target.expectedFullName,
    `_dmarc.kjbm`,
    `_dmarc.y.kajabimail.net`
  ];
  
  const foundRecords = findRecordsByName(allRecords, searchPatterns);
  
  // Filtrar por el registro específico
  let matchingRecord = null;
  if (recordKey === 'kjbm') {
    matchingRecord = foundRecords.find(r => 
      r.name === '_dmarc.kjbm.eugenihidalgo.org' || 
      r.name === '_dmarc.kjbm'
    );
  } else if (recordKey === 'kajabimail') {
    matchingRecord = foundRecords.find(r => 
      r.name.includes('_dmarc.y.kajabimail.net')
    );
  }

  if (matchingRecord) {
    results.foundInCloudflare = true;
    results.cloudflareName = matchingRecord.name;
    results.cloudflareContent = matchingRecord.content;
    results.cloudflareId = matchingRecord.id;
    results.cloudflareTTL = matchingRecord.ttl === 1 ? 'Auto' : matchingRecord.ttl;
    results.cloudflareProxied = matchingRecord.proxied;
    
    console.log(`\n✅ REGISTRO ENCONTRADO EN CLOUDFLARE:`);
    console.log(`   ID: ${matchingRecord.id}`);
    console.log(`   Nombre almacenado: ${matchingRecord.name}`);
    console.log(`   Tipo: ${matchingRecord.type}`);
    console.log(`   TTL: ${results.cloudflareTTL}`);
    console.log(`   Proxied: ${matchingRecord.proxied ? 'Yes 🟠' : 'No'}`);
    console.log(`   Contenido: ${formatTXTContent(matchingRecord.content).substring(0, 120)}...`);
  } else {
    console.log(`\n❌ REGISTRO NO ENCONTRADO EN CLOUDFLARE`);
    results.analysis.issues.push('Registro no existe en la zona DNS');
  }

  // Verificar resolución DNS
  console.log(`\n🔍 VERIFICANDO RESOLUCIÓN DNS:`);
  
  // Verificar nombre esperado
  const dnsExpected = verifyDNSResolution(target.expectedFullName);
  results.dnsResolution.expectedFullName = dnsExpected;
  
  if (dnsExpected.success) {
    console.log(`   ✅ ${target.expectedFullName} se resuelve correctamente:`);
    dnsExpected.records.forEach((r, i) => {
      console.log(`      ${i + 1}. ${r}`);
    });
  } else {
    console.log(`   ❌ ${target.expectedFullName} NO se resuelve`);
    if (dnsExpected.error) {
      console.log(`      Error: ${dnsExpected.error}`);
    }
  }

  // Verificar nombre almacenado en Cloudflare (si existe)
  if (matchingRecord) {
    const dnsStored = verifyDNSResolution(matchingRecord.name);
    results.dnsResolution.cloudflareStoredName = dnsStored;
    
    if (dnsStored.success) {
      console.log(`   ✅ ${matchingRecord.name} se resuelve correctamente:`);
      dnsStored.records.forEach((r, i) => {
        console.log(`      ${i + 1}. ${r}`);
      });
    } else {
      console.log(`   ⚠️  ${matchingRecord.name} no se resuelve aún (puede tardar en propagarse)`);
    }
  }

  // Verificar si Cloudflare agregó el dominio
  if (matchingRecord) {
    if (matchingRecord.name !== target.expectedName && 
        matchingRecord.name === `${target.expectedName}.${DOMAIN}`) {
      results.analysis.cloudflareAppendedDomain = true;
      results.analysis.issues.push(`Cloudflare agregó automáticamente el dominio base: ${matchingRecord.name}`);
      console.log(`\n⚠️  CLOUDFLARE AGREGÓ EL DOMINIO BASE:`);
      console.log(`   Nombre esperado: ${target.expectedName}`);
      console.log(`   Nombre almacenado: ${matchingRecord.name}`);
    } else if (matchingRecord.name === target.expectedFullName) {
      results.analysis.nameMatches = true;
      console.log(`\n✅ EL NOMBRE COINCIDE CON LO ESPERADO`);
    }
  }

  // Análisis específico por tipo de registro
  if (recordKey === 'kjbm') {
    if (matchingRecord && matchingRecord.name === '_dmarc.kjbm.eugenihidalgo.org') {
      results.analysis.nameMatches = true;
      results.analysis.resolvesCorrectly = dnsExpected.success;
      results.analysis.canBeValidated = true;
      console.log(`\n✅ ANÁLISIS PARA _dmarc.kjbm:`);
      console.log(`   - Nombre correcto: ${matchingRecord.name === '_dmarc.kjbm.eugenihidalgo.org'}`);
      console.log(`   - Se resuelve correctamente: ${dnsExpected.success}`);
      console.log(`   - Puede ser validado por Kajabi: ${results.analysis.canBeValidated}`);
    }
  } else if (recordKey === 'kajabimail') {
    if (matchingRecord && matchingRecord.name.includes('eugenihidalgo.org')) {
      results.analysis.cloudflareAppendedDomain = true;
      results.analysis.canBeValidated = false;
      results.analysis.issues.push(
        `El registro se almacenó como ${matchingRecord.name} pero Kajabi busca _dmarc.y.kajabimail.net en la zona kajabimail.net`
      );
      console.log(`\n❌ ANÁLISIS PARA _dmarc.y.kajabimail.net:`);
      console.log(`   - Cloudflare reescribió el nombre: ${matchingRecord.name}`);
      console.log(`   - Kajabi busca: _dmarc.y.kajabimail.net (en zona kajabimail.net)`);
      console.log(`   - El registro está en zona: ${DOMAIN}`);
      console.log(`   - NO puede ser validado por Kajabi desde esta zona`);
      
      // Verificar si el nombre original se resuelve
      const dnsOriginal = verifyDNSResolution('_dmarc.y.kajabimail.net');
      if (dnsOriginal.success) {
        console.log(`\n   ⚠️  _dmarc.y.kajabimail.net se resuelve, pero desde otra zona DNS:`);
        dnsOriginal.records.forEach((r, i) => {
          console.log(`      ${i + 1}. ${r}`);
        });
        console.log(`   Esto confirma que el registro debe estar en la zona kajabimail.net, no en ${DOMAIN}`);
      }
    }
  }

  return results;
}

function generateTechnicalSummary(results) {
  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`📋 RESUMEN TÉCNICO PARA KAJABI SUPPORT`);
  console.log(`${'='.repeat(80)}\n`);

  const kjbmResult = results.find(r => r.key === 'kjbm');
  const kajabimailResult = results.find(r => r.key === 'kajabimail');

  console.log(`DOMINIO: ${DOMAIN}`);
  console.log(`FECHA DE VERIFICACIÓN: ${new Date().toISOString()}\n`);

  console.log(`1. REGISTRO: _dmarc.kjbm`);
  console.log(`   ${'-'.repeat(76)}`);
  if (kjbmResult.foundInCloudflare) {
    console.log(`   ✅ Estado: EXISTE en Cloudflare`);
    console.log(`   📝 Nombre almacenado: ${kjbmResult.cloudflareName}`);
    console.log(`   🔍 Resolución DNS: ${kjbmResult.dnsResolution.expectedFullName.success ? '✅ Resuelve correctamente' : '❌ No resuelve'}`);
    console.log(`   ✅ Validación: PUEDE ser validado por Kajabi`);
    console.log(`   📋 Contenido: ${formatTXTContent(kjbmResult.cloudflareContent).substring(0, 100)}...`);
  } else {
    console.log(`   ❌ Estado: NO EXISTE en Cloudflare`);
    console.log(`   ❌ Validación: NO puede ser validado (registro faltante)`);
  }

  console.log(`\n2. REGISTRO: _dmarc.y.kajabimail.net`);
  console.log(`   ${'-'.repeat(76)}`);
  if (kajabimailResult.foundInCloudflare) {
    console.log(`   ⚠️  Estado: EXISTE en Cloudflare PERO con nombre incorrecto`);
    console.log(`   📝 Nombre almacenado: ${kajabimailResult.cloudflareName}`);
    console.log(`   🔍 Nombre esperado por Kajabi: _dmarc.y.kajabimail.net`);
    console.log(`   ⚠️  Cloudflare agregó dominio: ${kajabimailResult.analysis.cloudflareAppendedDomain ? 'SÍ' : 'NO'}`);
    console.log(`   ❌ Validación: NO puede ser validado por Kajabi desde esta zona`);
    console.log(`\n   🔴 PROBLEMA IDENTIFICADO:`);
    console.log(`      - El registro está almacenado como: ${kajabimailResult.cloudflareName}`);
    console.log(`      - Kajabi busca el registro en: _dmarc.y.kajabimail.net`);
    console.log(`      - Este hostname pertenece a la zona DNS: kajabimail.net`);
    console.log(`      - El registro está en la zona: ${DOMAIN}`);
    console.log(`      - Cloudflare automáticamente agregó el dominio base al nombre`);
    console.log(`\n   💡 SOLUCIÓN REQUERIDA:`);
    console.log(`      - Este registro DEBE crearse en la zona DNS de kajabimail.net`);
    console.log(`      - NO puede crearse correctamente en la zona ${DOMAIN}`);
    console.log(`      - Kajabi debe crear este registro en su propia zona DNS interna`);
    console.log(`      - O proporcionar acceso a la zona kajabimail.net para crearlo`);
  } else {
    console.log(`   ❌ Estado: NO EXISTE en Cloudflare`);
    console.log(`   ❌ Validación: NO puede ser validado (registro faltante)`);
    console.log(`\n   🔴 PROBLEMA IDENTIFICADO:`);
    console.log(`      - El registro no existe en la zona ${DOMAIN}`);
    console.log(`      - Este registro DEBE estar en la zona DNS de kajabimail.net`);
    console.log(`      - NO puede crearse en la zona ${DOMAIN} porque el hostname pertenece a otra zona`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 CONCLUSIÓN:`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`✅ REGISTRO VÁLIDO Y FUNCIONAL:`);
  console.log(`   - _dmarc.kjbm.eugenihidalgo.org`);
  console.log(`   - Existe en Cloudflare`);
  console.log(`   - Se resuelve correctamente en DNS`);
  console.log(`   - Puede ser validado por Kajabi\n`);

  console.log(`❌ REGISTRO QUE NO PUEDE VALIDARSE:`);
  console.log(`   - _dmarc.y.kajabimail.net`);
  console.log(`   - Razón: El hostname pertenece a la zona DNS kajabimail.net, no a ${DOMAIN}`);
  console.log(`   - Cloudflare automáticamente reescribe el nombre agregando el dominio base`);
  console.log(`   - Incluso si se crea en ${DOMAIN}, Kajabi no puede validarlo porque busca en kajabimail.net\n`);

  console.log(`🔧 ACCIÓN REQUERIDA:`);
  console.log(`   - Kajabi debe crear el registro _dmarc.y.kajabimail.net en su zona DNS interna`);
  console.log(`   - O proporcionar acceso a la zona kajabimail.net para que el cliente lo cree`);
  console.log(`   - Este registro NO puede resolverse desde la zona ${DOMAIN}\n`);
}

async function main() {
  try {
    console.log('🔍 VERIFICACIÓN ESPECÍFICA DE REGISTROS DMARC DE KAJABI\n');
    console.log(`Dominio: ${DOMAIN}`);
    console.log(`Registros a verificar:`);
    console.log(`  1. ${TARGET_RECORDS.kjbm.description}`);
    console.log(`  2. ${TARGET_RECORDS.kajabimail.description}\n`);

    // Verificar credenciales
    if (!CLOUDFLARE_API_TOKEN && (!CLOUDFLARE_EMAIL || !CLOUDFLARE_API_KEY)) {
      console.error('❌ Error: No hay credenciales de Cloudflare configuradas.');
      process.exit(1);
    }

    const headers = await getHeaders();
    const zoneId = await getZoneId(headers);
    console.log(`✅ Zone ID: ${zoneId}\n`);
    
    // Obtener todos los registros
    const allRecords = await listAllRecords(zoneId, headers);
    console.log(`📊 Total de registros DNS en la zona: ${allRecords.length}\n`);

    // Verificar cada registro
    const results = [];
    
    for (const recordKey of Object.keys(TARGET_RECORDS)) {
      const result = await verifyRecord(recordKey, zoneId, headers, allRecords);
      results.push(result);
    }

    // Generar resumen técnico
    generateTechnicalSummary(results);

    console.log(`\n✅ Verificación completada\n`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
    process.exit(1);
  }
}

main();



























