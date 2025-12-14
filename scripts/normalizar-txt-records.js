#!/usr/bin/env node
// Script para normalizar registros TXT y eliminar advertencias de Cloudflare

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

// Registro a excluir de la normalización
const EXCLUDE_RECORD = '_dmarc.y.kajabimail.net.eugenihidalgo.org';

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

async function listAllTXTRecords(zoneId, headers) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=TXT&per_page=100`, {
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

function normalizeTXTContent(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let normalized = content;

  // 1. Remover comillas dobles existentes al inicio y final (las agregaremos después)
  normalized = normalized.replace(/^["']+|["']+$/g, '');

  // 2. Eliminar saltos de línea, tabs, y caracteres invisibles
  normalized = normalized.replace(/[\r\n\t]/g, ' ');
  
  // 3. Eliminar caracteres de control y espacios no separables
  normalized = normalized.replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, '');
  
  // 4. Reemplazar múltiples espacios consecutivos con un solo espacio
  normalized = normalized.replace(/\s+/g, ' ');
  
  // 5. Eliminar espacios al inicio y final
  normalized = normalized.trim();
  
  // 6. Envolver en comillas dobles si no está vacío
  if (normalized.length > 0) {
    normalized = `"${normalized}"`;
  }

  return normalized;
}

function needsNormalization(original, normalized) {
  // Comparar sin las comillas para ver si el contenido cambió
  const originalClean = original.replace(/^["']+|["']+$/g, '').trim();
  const normalizedClean = normalized.replace(/^["']+|["']+$/g, '').trim();
  
  // Verificar si hay diferencias
  if (originalClean !== normalizedClean) {
    return true;
  }
  
  // Verificar si falta envolver en comillas
  if (!original.startsWith('"') || !original.endsWith('"')) {
    return true;
  }
  
  // Verificar si hay caracteres problemáticos
  if (/[\r\n\t\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/.test(original)) {
    return true;
  }
  
  return false;
}

async function updateTXTRecord(zoneId, headers, recordId, recordName, normalizedContent) {
  const recordData = {
    type: 'TXT',
    name: recordName,
    content: normalizedContent,
    ttl: 1, // Auto
    proxied: false
  };

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
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

  return data.result;
}

function generateReport(changes) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 REPORTE DE NORMALIZACIÓN DE REGISTROS TXT`);
  console.log(`${'='.repeat(80)}\n`);

  if (changes.length === 0) {
    console.log(`✅ Todos los registros TXT ya están correctamente formateados.`);
    console.log(`   No se requieren cambios.\n`);
    return;
  }

  console.log(`📝 Registros normalizados: ${changes.length}\n`);

  changes.forEach((change, index) => {
    console.log(`${index + 1}. ${change.name}`);
    console.log(`   ${'-'.repeat(76)}`);
    console.log(`   ID: ${change.id}`);
    console.log(`   Tipo: ${change.type || 'TXT'}`);
    
    // Mostrar antes (truncado si es muy largo)
    const beforeDisplay = change.before.length > 100 
      ? change.before.substring(0, 100) + '...' 
      : change.before;
    console.log(`   ANTES: ${beforeDisplay}`);
    
    // Mostrar después (truncado si es muy largo)
    const afterDisplay = change.after.length > 100 
      ? change.after.substring(0, 100) + '...' 
      : change.after;
    console.log(`   DESPUÉS: ${afterDisplay}`);
    
    if (change.reason) {
      console.log(`   Razón: ${change.reason}`);
    }
    
    console.log(`   Estado: ${change.success ? '✅ Actualizado' : '❌ Error'}`);
    if (change.error) {
      console.log(`   Error: ${change.error}`);
    }
    console.log('');
  });

  const successful = changes.filter(c => c.success).length;
  const failed = changes.filter(c => !c.success).length;

  console.log(`${'='.repeat(80)}`);
  console.log(`📈 RESUMEN:`);
  console.log(`   ✅ Actualizados exitosamente: ${successful}`);
  console.log(`   ❌ Errores: ${failed}`);
  console.log(`   📋 Total procesados: ${changes.length}`);
  console.log(`${'='.repeat(80)}\n`);
}

async function main() {
  try {
    console.log('🔧 NORMALIZACIÓN DE REGISTROS TXT PARA CLOUDFLARE\n');
    console.log(`Dominio: ${DOMAIN}`);
    console.log(`Excluyendo: ${EXCLUDE_RECORD}\n`);

    // Verificar credenciales
    if (!CLOUDFLARE_API_TOKEN && (!CLOUDFLARE_EMAIL || !CLOUDFLARE_API_KEY)) {
      console.error('❌ Error: No hay credenciales de Cloudflare configuradas.');
      process.exit(1);
    }

    const headers = await getHeaders();
    const zoneId = await getZoneId(headers);
    console.log(`✅ Zone ID: ${zoneId}\n`);

    // Obtener todos los registros TXT
    console.log('🔍 Obteniendo registros TXT...');
    const txtRecords = await listAllTXTRecords(zoneId, headers);
    console.log(`   ✅ Encontrados ${txtRecords.length} registros TXT\n`);

    // Filtrar el registro excluido
    const recordsToProcess = txtRecords.filter(r => r.name !== EXCLUDE_RECORD);
    const excluded = txtRecords.filter(r => r.name === EXCLUDE_RECORD);

    if (excluded.length > 0) {
      console.log(`⚠️  Excluyendo registro: ${EXCLUDE_RECORD} (como se solicitó)\n`);
    }

    console.log(`📝 Procesando ${recordsToProcess.length} registros TXT...\n`);

    const changes = [];

    for (const record of recordsToProcess) {
      const originalContent = record.content;
      const normalizedContent = normalizeTXTContent(originalContent);
      
      const needsUpdate = needsNormalization(originalContent, normalizedContent);

      if (needsUpdate) {
        console.log(`🔄 Normalizando: ${record.name}`);
        
        const change = {
          id: record.id,
          name: record.name,
          type: record.type,
          before: originalContent,
          after: normalizedContent,
          success: false,
          error: null,
          reason: null
        };

        // Determinar la razón del cambio
        const reasons = [];
        if (originalContent !== normalizedContent.replace(/^["']+|["']+$/g, '').trim()) {
          reasons.push('Contenido limpiado (espacios, saltos de línea, caracteres invisibles)');
        }
        if (!originalContent.startsWith('"') || !originalContent.endsWith('"')) {
          reasons.push('Agregadas comillas dobles');
        }
        change.reason = reasons.join('; ');

        try {
          const updated = await updateTXTRecord(
            zoneId,
            headers,
            record.id,
            record.name,
            normalizedContent
          );
          
          change.success = true;
          console.log(`   ✅ Actualizado exitosamente`);
        } catch (error) {
          change.success = false;
          change.error = error.message;
          console.log(`   ❌ Error: ${error.message}`);
        }

        changes.push(change);
      } else {
        console.log(`✅ ${record.name} - Ya está correctamente formateado`);
      }
    }

    // Generar reporte
    generateReport(changes);

    // Verificar registros excluidos
    if (excluded.length > 0) {
      console.log(`\n⚠️  REGISTRO EXCLUIDO (no modificado):`);
      excluded.forEach(r => {
        console.log(`   - ${r.name}`);
        console.log(`     Contenido: ${r.content.substring(0, 80)}...`);
      });
      console.log('');
    }

    console.log(`✅ Proceso completado\n`);
    console.log(`📝 Próximos pasos:`);
    console.log(`   1. Verifica en Cloudflare Dashboard que no haya advertencias`);
    console.log(`   2. Espera unos minutos para que los cambios se propaguen`);
    console.log(`   3. Verifica la resolución DNS de los registros actualizados\n`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
    process.exit(1);
  }
}

main();







