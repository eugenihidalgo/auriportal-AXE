#!/usr/bin/env node
// Script para configurar autenticación de email personalizado de Kajabi en subdominio kjbm

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
const SUBDOMAIN = 'kjbm';
const FULL_SUBDOMAIN = `${SUBDOMAIN}.${DOMAIN}`;

// Registros requeridos por Kajabi
const KAJABI_RECORDS = {
  txt: [
    {
      name: SUBDOMAIN, // kjbm
      content: 'v=spf1 include:mailgun.org ~all',
      description: 'SPF Record'
    },
    {
      name: `mailo._domainkey.${SUBDOMAIN}`, // mailo._domainkey.kjbm
      content: 'k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDByBINQvnLZAju673z+Y7DKv6IG71RFFd5++DkqvIQvguXOFV9xWiGVTz8YWLrrMstElXMvgXy5lvhkXpwC719JulmiuYC8doG7j8SNWqbA/na2MV2/1COm6AXXC6HJV4PCH6VasqeJk549zCrLtsVLMoDwghe4qy3oC4NpJXcMQIDAQAB',
      description: 'DKIM Record'
    },
    {
      name: `_dmarc.${SUBDOMAIN}`, // _dmarc.kjbm
      content: 'v=DMARC1; p=none; pct=100; fo=1; ri=3600; rua=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com; ruf=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com',
      description: 'DMARC Record'
    }
  ],
  mx: [
    {
      name: SUBDOMAIN, // kjbm
      content: 'mxa.mailgun.org',
      priority: 10,
      description: 'MX Record - Primary (Mailgun)'
    },
    {
      name: SUBDOMAIN, // kjbm
      content: 'mxb.mailgun.org',
      priority: 20,
      description: 'MX Record - Secondary (Mailgun)'
    }
  ],
  cname: [
    {
      name: `email.${SUBDOMAIN}`, // email.kjbm
      content: 'mailgun.org',
      description: 'CNAME Record'
    }
  ]
};

function normalizeTXTContent(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let normalized = content;

  // Remover comillas existentes
  normalized = normalized.replace(/^["']+|["']+$/g, '');

  // Eliminar saltos de línea, tabs, y caracteres invisibles
  normalized = normalized.replace(/[\r\n\t]/g, ' ');
  
  // Eliminar caracteres de control
  normalized = normalized.replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, '');
  
  // Reemplazar múltiples espacios con uno solo
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Eliminar espacios al inicio y final
  normalized = normalized.trim();
  
  // Envolver en comillas dobles
  if (normalized.length > 0) {
    normalized = `"${normalized}"`;
  }

  return normalized;
}

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

function findKJBMRecords(records) {
  // Filtrar solo registros del subdominio kjbm
  return records.filter(r => {
    const name = r.name.toLowerCase();
    return name === `${SUBDOMAIN}.${DOMAIN}`.toLowerCase() ||
           name === SUBDOMAIN.toLowerCase() ||
           name.startsWith(`${SUBDOMAIN}.`) ||
           name.includes(`.${SUBDOMAIN}.`);
  });
}

function findExistingRecord(records, type, name) {
  const fullName = name === SUBDOMAIN ? `${SUBDOMAIN}.${DOMAIN}` : `${name}.${DOMAIN}`;
  
  return records.find(r => {
    if (r.type !== type) return false;
    
    // Para registros en la raíz del subdominio
    if (name === SUBDOMAIN) {
      return r.name === `${SUBDOMAIN}.${DOMAIN}` || r.name === SUBDOMAIN;
    }
    
    // Para otros registros
    return r.name === fullName || r.name === name;
  });
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
    const error = await response.text();
    throw new Error(`Error eliminando registro: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
  }

  return true;
}

async function createOrUpdateTXTRecord(zoneId, headers, name, content, existingRecord = null) {
  const fullName = name === SUBDOMAIN ? `${SUBDOMAIN}.${DOMAIN}` : `${name}.${DOMAIN}`;
  const normalizedContent = normalizeTXTContent(content);
  
  const recordData = {
    type: 'TXT',
    name: fullName,
    content: normalizedContent,
    ttl: 1, // Auto
    proxied: false
  };

  if (existingRecord) {
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
      throw new Error(`Error actualizando TXT: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    return { action: 'updated', record: data.result };
  } else {
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
      throw new Error(`Error creando TXT: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    return { action: 'created', record: data.result };
  }
}

async function createOrUpdateMXRecord(zoneId, headers, name, content, priority, existingRecord = null) {
  const fullName = name === SUBDOMAIN ? `${SUBDOMAIN}.${DOMAIN}` : `${name}.${DOMAIN}`;
  
  const recordData = {
    type: 'MX',
    name: fullName,
    content: content,
    priority: priority,
    ttl: 1, // Auto
    proxied: false
  };

  if (existingRecord) {
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
      throw new Error(`Error actualizando MX: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    return { action: 'updated', record: data.result };
  } else {
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
      throw new Error(`Error creando MX: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    return { action: 'created', record: data.result };
  }
}

async function createOrUpdateCNAMERecord(zoneId, headers, name, content, existingRecord = null) {
  const fullName = `${name}.${DOMAIN}`;
  
  const recordData = {
    type: 'CNAME',
    name: fullName,
    content: content,
    ttl: 1, // Auto
    proxied: false
  };

  if (existingRecord) {
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
      throw new Error(`Error actualizando CNAME: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    return { action: 'updated', record: data.result };
  } else {
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
      throw new Error(`Error creando CNAME: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    return { action: 'created', record: data.result };
  }
}

function verifyDNSResolution(hostname, type = 'TXT') {
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
    console.log('📧 CONFIGURANDO AUTENTICACIÓN DE EMAIL KAJABI\n');
    console.log(`Dominio: ${DOMAIN}`);
    console.log(`Subdominio: ${SUBDOMAIN}`);
    console.log(`Subdominio completo: ${FULL_SUBDOMAIN}\n`);

    // Verificar credenciales
    if (!CLOUDFLARE_API_TOKEN && (!CLOUDFLARE_EMAIL || !CLOUDFLARE_API_KEY)) {
      console.error('❌ Error: No hay credenciales de Cloudflare configuradas.');
      process.exit(1);
    }

    const headers = await getHeaders();
    const zoneId = await getZoneId(headers);
    console.log(`✅ Zone ID: ${zoneId}\n`);

    // Paso 1: Listar registros actuales
    console.log('🔍 Paso 1: Analizando registros DNS actuales...\n');
    const allRecords = await listAllRecords(zoneId, headers);
    const kjbmRecords = findKJBMRecords(allRecords);
    
    console.log(`   📊 Registros encontrados en ${FULL_SUBDOMAIN}:`);
    console.log(`      - Total: ${kjbmRecords.length} registro(s)\n`);

    // Paso 2: Eliminar duplicados
    console.log('🗑️  Paso 2: Eliminando registros duplicados...\n');
    const recordsToKeep = new Set();
    const duplicates = [];
    
    for (const record of kjbmRecords) {
      const key = `${record.type}-${record.name}-${record.content}-${record.priority || ''}`;
      if (recordsToKeep.has(key)) {
        duplicates.push(record);
      } else {
        recordsToKeep.add(key);
      }
    }

    if (duplicates.length > 0) {
      console.log(`   ⚠️  Se encontraron ${duplicates.length} registro(s) duplicado(s):`);
      for (const dup of duplicates) {
        try {
          await deleteRecord(zoneId, headers, dup.id);
          console.log(`   ✅ Eliminado duplicado: ${dup.type} - ${dup.name}`);
        } catch (error) {
          console.log(`   ❌ Error eliminando ${dup.name}: ${error.message}`);
        }
      }
      console.log('');
    } else {
      console.log(`   ✅ No se encontraron duplicados\n`);
    }

    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Paso 3: Configurar registros TXT
    console.log('📝 Paso 3: Configurando registros TXT...\n');
    const txtResults = [];
    
    for (const txtRecord of KAJABI_RECORDS.txt) {
      const existing = findExistingRecord(kjbmRecords, 'TXT', txtRecord.name);
      console.log(`   → ${txtRecord.description} (${txtRecord.name})`);
      
      try {
        const result = await createOrUpdateTXTRecord(
          zoneId,
          headers,
          txtRecord.name,
          txtRecord.content,
          existing
        );
        
        txtResults.push({ ...txtRecord, ...result });
        console.log(`     ✅ ${result.action === 'created' ? 'Creado' : 'Actualizado'}`);
      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
        txtResults.push({ ...txtRecord, error: error.message });
      }
    }

    // Paso 4: Configurar registros MX
    console.log('\n📝 Paso 4: Configurando registros MX...\n');
    const mxResults = [];
    
    for (const mxRecord of KAJABI_RECORDS.mx) {
      const existing = findExistingRecord(kjbmRecords, 'MX', mxRecord.name);
      console.log(`   → ${mxRecord.description} (${mxRecord.content})`);
      
      try {
        const result = await createOrUpdateMXRecord(
          zoneId,
          headers,
          mxRecord.name,
          mxRecord.content,
          mxRecord.priority,
          existing
        );
        
        mxResults.push({ ...mxRecord, ...result });
        console.log(`     ✅ ${result.action === 'created' ? 'Creado' : 'Actualizado'}`);
      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
        mxResults.push({ ...mxRecord, error: error.message });
      }
    }

    // Paso 5: Configurar registro CNAME
    console.log('\n📝 Paso 5: Configurando registro CNAME...\n');
    const cnameResults = [];
    
    for (const cnameRecord of KAJABI_RECORDS.cname) {
      const existing = findExistingRecord(kjbmRecords, 'CNAME', cnameRecord.name);
      console.log(`   → ${cnameRecord.description} (${cnameRecord.name})`);
      
      try {
        const result = await createOrUpdateCNAMERecord(
          zoneId,
          headers,
          cnameRecord.name,
          cnameRecord.content,
          existing
        );
        
        cnameResults.push({ ...cnameRecord, ...result });
        console.log(`     ✅ ${result.action === 'created' ? 'Creado' : 'Actualizado'}`);
      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
        cnameResults.push({ ...cnameRecord, error: error.message });
      }
    }

    // Esperar para propagación
    console.log('\n⏳ Esperando 3 segundos para propagación...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Paso 6: Verificación final
    console.log('🔍 Paso 6: Verificación final...\n');
    
    const finalRecords = await listAllRecords(zoneId, headers);
    const finalKJBM = findKJBMRecords(finalRecords);
    
    // Verificar cada registro requerido
    const verification = {
      spf: null,
      dkim: null,
      dmarc: null,
      mx1: null,
      mx2: null,
      cname: null
    };

    // SPF
    const spfRecord = finalKJBM.find(r => 
      r.type === 'TXT' && 
      (r.name === `${SUBDOMAIN}.${DOMAIN}` || r.name === SUBDOMAIN) &&
      r.content.includes('v=spf1')
    );
    verification.spf = spfRecord;

    // DKIM
    const dkimRecord = finalKJBM.find(r => 
      r.type === 'TXT' && 
      r.name === `mailo._domainkey.${SUBDOMAIN}.${DOMAIN}`
    );
    verification.dkim = dkimRecord;

    // DMARC
    const dmarcRecord = finalKJBM.find(r => 
      r.type === 'TXT' && 
      r.name === `_dmarc.${SUBDOMAIN}.${DOMAIN}`
    );
    verification.dmarc = dmarcRecord;

    // MX
    const mxRecords = finalKJBM.filter(r => 
      r.type === 'MX' && 
      (r.name === `${SUBDOMAIN}.${DOMAIN}` || r.name === SUBDOMAIN)
    );
    verification.mx1 = mxRecords.find(mx => mx.content === 'mxa.mailgun.org' && mx.priority === 10);
    verification.mx2 = mxRecords.find(mx => mx.content === 'mxb.mailgun.org' && mx.priority === 20);

    // CNAME
    const cnameRecord = finalKJBM.find(r => 
      r.type === 'CNAME' && 
      r.name === `email.${SUBDOMAIN}.${DOMAIN}`
    );
    verification.cname = cnameRecord;

    // Verificar resolución DNS
    console.log('🌐 Verificando resolución DNS...\n');
    
    const dnsChecks = {
      spf: verifyDNSResolution(`${SUBDOMAIN}.${DOMAIN}`, 'TXT'),
      dkim: verifyDNSResolution(`mailo._domainkey.${SUBDOMAIN}.${DOMAIN}`, 'TXT'),
      dmarc: verifyDNSResolution(`_dmarc.${SUBDOMAIN}.${DOMAIN}`, 'TXT'),
      mx: verifyDNSResolution(`${SUBDOMAIN}.${DOMAIN}`, 'MX'),
      cname: verifyDNSResolution(`email.${SUBDOMAIN}.${DOMAIN}`, 'CNAME')
    };

    // Generar reporte final
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 REPORTE FINAL DE CONFIGURACIÓN`);
    console.log(`${'='.repeat(80)}\n`);

    console.log(`Dominio: ${DOMAIN}`);
    console.log(`Subdominio: ${SUBDOMAIN}`);
    console.log(`Fecha: ${new Date().toISOString()}\n`);

    console.log(`✅ REGISTROS CONFIGURADOS:\n`);
    
    const allConfigured = [
      { name: 'SPF (TXT)', record: verification.spf, dns: dnsChecks.spf, expected: 'v=spf1 include:mailgun.org ~all' },
      { name: 'DKIM (TXT)', record: verification.dkim, dns: dnsChecks.dkim, expected: 'mailo._domainkey.kjbm' },
      { name: 'DMARC (TXT)', record: verification.dmarc, dns: dnsChecks.dmarc, expected: 'v=DMARC1' },
      { name: 'MX Primary', record: verification.mx1, dns: dnsChecks.mx, expected: 'mxa.mailgun.org (Priority: 10)' },
      { name: 'MX Secondary', record: verification.mx2, dns: dnsChecks.mx, expected: 'mxb.mailgun.org (Priority: 20)' },
      { name: 'CNAME', record: verification.cname, dns: dnsChecks.cname, expected: 'mailgun.org' }
    ];

    let allOK = true;
    for (const item of allConfigured) {
      const status = item.record ? '✅' : '❌';
      const dnsStatus = item.dns.success ? '✅ Resuelve' : '⏳ Propagando';
      console.log(`   ${status} ${item.name}: ${item.record ? 'Existe' : 'FALTA'} - DNS: ${dnsStatus}`);
      if (!item.record) allOK = false;
    }

    // Verificar duplicados
    console.log(`\n📋 VERIFICACIÓN DE DUPLICADOS:\n`);
    const txtRecords = finalKJBM.filter(r => r.type === 'TXT');
    const mxRecordsForDupCheck = finalKJBM.filter(r => r.type === 'MX');
    const cnameRecords = finalKJBM.filter(r => r.type === 'CNAME');
    
    const txtNames = new Set();
    const txtDuplicates = [];
    txtRecords.forEach(r => {
      if (txtNames.has(r.name)) {
        txtDuplicates.push(r);
      } else {
        txtNames.add(r.name);
      }
    });

    const mxDuplicates = [];
    const mxKeys = new Set();
    mxRecordsForDupCheck.forEach(r => {
      const key = `${r.name}-${r.content}-${r.priority}`;
      if (mxKeys.has(key)) {
        mxDuplicates.push(r);
      } else {
        mxKeys.add(key);
      }
    });

    if (txtDuplicates.length === 0 && mxDuplicates.length === 0) {
      console.log(`   ✅ No se encontraron duplicados\n`);
    } else {
      console.log(`   ⚠️  Se encontraron duplicados:`);
      if (txtDuplicates.length > 0) {
        console.log(`      - TXT: ${txtDuplicates.length} duplicado(s)`);
      }
      if (mxDuplicates.length > 0) {
        console.log(`      - MX: ${mxDuplicates.length} duplicado(s)`);
      }
      console.log('');
    }

    // Verificar conflictos
    console.log(`📋 VERIFICACIÓN DE CONFLICTOS:\n`);
    const conflicts = [];
    
    // Verificar si hay registros fuera del subdominio kjbm que puedan conflictuar
    const otherMX = allRecords.filter(r => 
      r.type === 'MX' && 
      !r.name.includes(SUBDOMAIN) &&
      (r.content.includes('mailgun') || r.content.includes('cloudflare'))
    );
    
    if (otherMX.length > 0) {
      conflicts.push(`Se encontraron ${otherMX.length} registro(s) MX fuera del subdominio kjbm`);
    }

    if (conflicts.length === 0) {
      console.log(`   ✅ No se encontraron conflictos\n`);
    } else {
      console.log(`   ⚠️  Conflictos encontrados:`);
      conflicts.forEach(c => console.log(`      - ${c}`));
      console.log('');
    }

    console.log(`🌐 ESTADO DE PROPAGACIÓN DNS:\n`);
    console.log(`   - SPF: ${dnsChecks.spf.success ? '✅ Activo' : '⏳ Propagando'}`);
    console.log(`   - DKIM: ${dnsChecks.dkim.success ? '✅ Activo' : '⏳ Propagando'}`);
    console.log(`   - DMARC: ${dnsChecks.dmarc.success ? '✅ Activo' : '⏳ Propagando'}`);
    console.log(`   - MX: ${dnsChecks.mx.success ? '✅ Activo' : '⏳ Propagando'}`);
    console.log(`   - CNAME: ${dnsChecks.cname.success ? '✅ Activo' : '⏳ Propagando'}`);
    console.log(`\n   Nota: La propagación completa puede tardar 5-15 minutos\n`);

    console.log(`${'='.repeat(80)}\n`);

    if (allOK) {
      console.log(`✅ CONFIGURACIÓN COMPLETA\n`);
      console.log(`   Todos los 6 registros requeridos por Kajabi están configurados.`);
      console.log(`   El DNS está listo para la verificación de email personalizado de Kajabi.\n`);
    } else {
      console.log(`⚠️  CONFIGURACIÓN INCOMPLETA\n`);
      console.log(`   Algunos registros no se pudieron configurar. Revisa los errores arriba.\n`);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
    process.exit(1);
  }
}

main();

