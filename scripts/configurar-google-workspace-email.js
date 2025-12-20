#!/usr/bin/env node
// Script para configurar Google Workspace como único proveedor de email

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

// Registros MX de Cloudflare Email Routing a eliminar
const CLOUDFLARE_MX_TO_DELETE = [
  'route1.mx.cloudflare.net',
  'route2.mx.cloudflare.net',
  'route3.mx.cloudflare.net'
];

// Registros SPF antiguos/conflictivos a eliminar
const OLD_SPF_TO_DELETE = [
  'v=spf1 include:spf.privateemail.com ~all',
  'v=spf1 include:_spf.mx.cloudflare.net ~all'
];

// Registros MX de Google Workspace
const GOOGLE_MX_RECORDS = [
  { priority: 1, host: 'aspmx.l.google.com' },
  { priority: 5, host: 'alt1.aspmx.l.google.com' },
  { priority: 5, host: 'alt2.aspmx.l.google.com' },
  { priority: 10, host: 'alt3.aspmx.l.google.com' },
  { priority: 10, host: 'alt4.aspmx.l.google.com' }
];

// SPF de Google Workspace (normalizado)
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

async function deleteRecord(zoneId, headers, recordId, recordName, recordType) {
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

async function createMXRecord(zoneId, headers, priority, host) {
  const recordData = {
    type: 'MX',
    name: '@',
    content: host,
    priority: priority,
    ttl: 1, // Auto
    proxied: false
  };

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
    throw new Error(`Error creando registro MX: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
  }

  return data.result;
}

async function createOrUpdateSPF(zoneId, headers, existingRecord) {
  const recordData = {
    type: 'TXT',
    name: '@',
    content: `"${GOOGLE_SPF}"`,
    ttl: 1, // Auto
    proxied: false
  };

  if (existingRecord) {
    // Actualizar registro existente
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
      throw new Error(`Error actualizando SPF: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    return { action: 'updated', record: data.result };
  } else {
    // Crear nuevo registro
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
      throw new Error(`Error creando SPF: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    return { action: 'created', record: data.result };
  }
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
    console.log('📧 CONFIGURANDO GOOGLE WORKSPACE COMO ÚNICO PROVEEDOR DE EMAIL\n');
    console.log(`Dominio: ${DOMAIN}\n`);

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
    const mxRecords = allRecords.filter(r => r.type === 'MX');
    const txtRecords = allRecords.filter(r => r.type === 'TXT');

    console.log(`   📊 Registros encontrados:`);
    console.log(`      - MX: ${mxRecords.length}`);
    console.log(`      - TXT: ${txtRecords.length}\n`);

    // Paso 2: Eliminar registros MX de Cloudflare Email Routing
    console.log('🗑️  Paso 2: Eliminando registros MX de Cloudflare Email Routing...\n');
    const deletedMX = [];
    
    for (const mxRecord of mxRecords) {
      if (CLOUDFLARE_MX_TO_DELETE.includes(mxRecord.content)) {
        try {
          await deleteRecord(zoneId, headers, mxRecord.id, mxRecord.name, 'MX');
          deletedMX.push(mxRecord);
          console.log(`   ✅ Eliminado: ${mxRecord.content} (Priority: ${mxRecord.priority})`);
        } catch (error) {
          console.log(`   ❌ Error eliminando ${mxRecord.content}: ${error.message}`);
        }
      }
    }

    if (deletedMX.length === 0) {
      console.log(`   ℹ️  No se encontraron registros MX de Cloudflare Email Routing para eliminar\n`);
    } else {
      console.log(`\n   ✅ Eliminados ${deletedMX.length} registro(s) MX de Cloudflare\n`);
    }

    // Paso 3: Eliminar registros SPF antiguos/conflictivos
    console.log('🗑️  Paso 3: Eliminando registros SPF antiguos/conflictivos...\n');
    const deletedSPF = [];
    
    for (const txtRecord of txtRecords) {
      const content = txtRecord.content.replace(/^["']+|["']+$/g, ''); // Remover comillas
      
      for (const oldSPF of OLD_SPF_TO_DELETE) {
        if (content === oldSPF || content.includes(oldSPF.replace(/^v=spf1\s+/, ''))) {
          try {
            await deleteRecord(zoneId, headers, txtRecord.id, txtRecord.name, 'TXT');
            deletedSPF.push(txtRecord);
            console.log(`   ✅ Eliminado SPF: ${content.substring(0, 60)}...`);
            break;
          } catch (error) {
            console.log(`   ❌ Error eliminando SPF: ${error.message}`);
          }
        }
      }
    }

    if (deletedSPF.length === 0) {
      console.log(`   ℹ️  No se encontraron registros SPF antiguos para eliminar\n`);
    } else {
      console.log(`\n   ✅ Eliminados ${deletedSPF.length} registro(s) SPF antiguo(s)\n`);
    }

    // Esperar un momento para que los cambios se propaguen
    console.log('⏳ Esperando 2 segundos para que los cambios se propaguen...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Paso 4: Obtener registros actualizados
    const updatedRecords = await listAllRecords(zoneId, headers);
    const currentMX = updatedRecords.filter(r => r.type === 'MX');
    const currentTXT = updatedRecords.filter(r => r.type === 'TXT');

    // Paso 5: Agregar registros MX de Google Workspace
    console.log('➕ Paso 4: Agregando registros MX de Google Workspace...\n');
    
    const googleMXToAdd = [];
    for (const googleMX of GOOGLE_MX_RECORDS) {
      // Verificar si ya existe
      const exists = currentMX.find(mx => 
        mx.content === googleMX.host && mx.priority === googleMX.priority
      );

      if (!exists) {
        googleMXToAdd.push(googleMX);
      }
    }

    if (googleMXToAdd.length > 0) {
      for (const googleMX of googleMXToAdd) {
        try {
          await createMXRecord(zoneId, headers, googleMX.priority, googleMX.host);
          console.log(`   ✅ Agregado: ${googleMX.host} (Priority: ${googleMX.priority})`);
        } catch (error) {
          console.log(`   ❌ Error agregando ${googleMX.host}: ${error.message}`);
        }
      }
      console.log(`\n   ✅ Agregados ${googleMXToAdd.length} registro(s) MX de Google\n`);
    } else {
      console.log(`   ℹ️  Todos los registros MX de Google ya existen\n`);
    }

    // Paso 6: Configurar SPF de Google Workspace
    console.log('📝 Paso 5: Configurando SPF de Google Workspace...\n');
    
    // Buscar registro SPF existente
    const existingSPF = currentTXT.find(txt => {
      const content = txt.content.replace(/^["']+|["']+$/g, '');
      return content.startsWith('v=spf1');
    });

    if (existingSPF) {
      const currentContent = existingSPF.content.replace(/^["']+|["']+$/g, '');
      if (currentContent === GOOGLE_SPF) {
        console.log(`   ℹ️  SPF ya está configurado correctamente: ${GOOGLE_SPF}\n`);
      } else {
        console.log(`   🔄 Actualizando SPF existente...`);
        console.log(`      ANTES: ${currentContent}`);
        try {
          const result = await createOrUpdateSPF(zoneId, headers, existingSPF);
          console.log(`      DESPUÉS: ${GOOGLE_SPF}`);
          console.log(`   ✅ SPF actualizado exitosamente\n`);
        } catch (error) {
          console.log(`   ❌ Error actualizando SPF: ${error.message}\n`);
        }
      }
    } else {
      console.log(`   ➕ Creando nuevo registro SPF...`);
      try {
        const result = await createOrUpdateSPF(zoneId, headers, null);
        console.log(`   ✅ SPF creado: ${GOOGLE_SPF}\n`);
      } catch (error) {
        console.log(`   ❌ Error creando SPF: ${error.message}\n`);
      }
    }

    // Esperar un momento para que los cambios se propaguen
    console.log('⏳ Esperando 3 segundos para que los cambios se propaguen...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Paso 7: Verificación final
    console.log('🔍 Paso 6: Verificación final...\n');
    
    const finalRecords = await listAllRecords(zoneId, headers);
    const finalMX = finalRecords.filter(r => r.type === 'MX');
    const finalTXT = finalRecords.filter(r => r.type === 'TXT');

    // Verificar registros MX
    console.log('📋 Registros MX actuales:');
    const googleMXFound = [];
    const otherMXFound = [];
    
    for (const mx of finalMX) {
      if (GOOGLE_MX_RECORDS.some(g => g.host === mx.content)) {
        googleMXFound.push(mx);
        console.log(`   ✅ ${mx.content} (Priority: ${mx.priority}) - Google Workspace`);
      } else {
        otherMXFound.push(mx);
        console.log(`   ⚠️  ${mx.content} (Priority: ${mx.priority}) - OTRO (debe eliminarse)`);
      }
    }

    if (otherMXFound.length > 0) {
      console.log(`\n   ⚠️  ADVERTENCIA: Se encontraron ${otherMXFound.length} registro(s) MX que no son de Google`);
    }

    // Verificar SPF
    console.log('\n📋 Registros SPF actuales:');
    const spfRecords = finalTXT.filter(txt => {
      const content = txt.content.replace(/^["']+|["']+$/g, '');
      return content.startsWith('v=spf1');
    });

    if (spfRecords.length === 0) {
      console.log(`   ❌ No se encontraron registros SPF`);
    } else if (spfRecords.length > 1) {
      console.log(`   ⚠️  ADVERTENCIA: Se encontraron ${spfRecords.length} registros SPF (debe haber solo uno)`);
      spfRecords.forEach((spf, i) => {
        const content = spf.content.replace(/^["']+|["']+$/g, '');
        console.log(`      ${i + 1}. ${content.substring(0, 80)}...`);
      });
    } else {
      const spfContent = spfRecords[0].content.replace(/^["']+|["']+$/g, '');
      if (spfContent === GOOGLE_SPF) {
        console.log(`   ✅ ${GOOGLE_SPF} - Correcto`);
      } else {
        console.log(`   ⚠️  ${spfContent} - No coincide con el SPF esperado`);
      }
    }

    // Verificar resolución DNS
    console.log('\n🌐 Verificando resolución DNS...\n');
    const mxResolution = verifyDNSResolution(DOMAIN, 'MX');
    if (mxResolution.success) {
      console.log(`   ✅ Registros MX se resuelven correctamente:`);
      mxResolution.records.forEach((r, i) => {
        console.log(`      ${i + 1}. ${r}`);
      });
    } else {
      console.log(`   ⚠️  Los registros MX aún no se resuelven (puede tardar unos minutos)`);
    }

    const txtResolution = verifyDNSResolution(DOMAIN, 'TXT');
    if (txtResolution.success) {
      console.log(`\n   ✅ Registros TXT se resuelven correctamente:`);
      txtResolution.records.forEach((r, i) => {
        if (r.includes('v=spf1')) {
          console.log(`      ${i + 1}. ${r}`);
        }
      });
    }

    // Generar reporte final
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 REPORTE FINAL DE CONFIGURACIÓN`);
    console.log(`${'='.repeat(80)}\n`);

    console.log(`Dominio: ${DOMAIN}`);
    console.log(`Fecha: ${new Date().toISOString()}\n`);

    console.log(`✅ REGISTROS MX (Google Workspace):`);
    console.log(`   Total: ${googleMXFound.length} de ${GOOGLE_MX_RECORDS.length} esperados`);
    if (googleMXFound.length === GOOGLE_MX_RECORDS.length) {
      console.log(`   Estado: ✅ COMPLETO`);
    } else {
      console.log(`   Estado: ⚠️  INCOMPLETO`);
    }
    googleMXFound.forEach(mx => {
      console.log(`   - ${mx.content} (Priority: ${mx.priority})`);
    });

    if (otherMXFound.length > 0) {
      console.log(`\n⚠️  REGISTROS MX ADICIONALES (deben eliminarse):`);
      otherMXFound.forEach(mx => {
        console.log(`   - ${mx.content} (Priority: ${mx.priority})`);
      });
    }

    console.log(`\n✅ REGISTRO SPF:`);
    if (spfRecords.length === 1) {
      const spfContent = spfRecords[0].content.replace(/^["']+|["']+$/g, '');
      if (spfContent === GOOGLE_SPF) {
        console.log(`   Estado: ✅ CORRECTO`);
        console.log(`   Contenido: ${GOOGLE_SPF}`);
      } else {
        console.log(`   Estado: ⚠️  NO COINCIDE`);
        console.log(`   Actual: ${spfContent}`);
        console.log(`   Esperado: ${GOOGLE_SPF}`);
      }
    } else {
      console.log(`   Estado: ⚠️  PROBLEMA (${spfRecords.length} registros encontrados)`);
    }

    console.log(`\n📋 VERIFICACIÓN DE CONFLICTOS:`);
    console.log(`   - Registros MX de Cloudflare eliminados: ${deletedMX.length > 0 ? '✅' : 'N/A'}`);
    console.log(`   - Registros SPF antiguos eliminados: ${deletedSPF.length > 0 ? '✅' : 'N/A'}`);
    console.log(`   - Registros MX adicionales: ${otherMXFound.length > 0 ? '⚠️  ' + otherMXFound.length : '✅ Ninguno'}`);
    console.log(`   - Duplicados SPF: ${spfRecords.length > 1 ? '⚠️  ' + spfRecords.length : '✅ Ninguno'}`);

    console.log(`\n🌐 PROPAGACIÓN DNS:`);
    console.log(`   - Resolución MX: ${mxResolution.success ? '✅ Activa' : '⏳ En progreso'}`);
    console.log(`   - Resolución SPF: ${txtResolution.success ? '✅ Activa' : '⏳ En progreso'}`);
    console.log(`   - Nota: La propagación completa puede tardar 5-15 minutos\n`);

    console.log(`${'='.repeat(80)}\n`);
    console.log(`✅ Configuración completada\n`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
    process.exit(1);
  }
}

main();




















