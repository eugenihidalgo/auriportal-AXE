// scripts/configurar-dns-transmutaciones.js
// Script para configurar el DNS de transmutaciones.eugenihidalgo.work en Cloudflare

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
const DOMAIN = 'eugenihidalgo.work';
const SUBDOMAIN = 'transmutaciones';
const FULL_DOMAIN = `${SUBDOMAIN}.${DOMAIN}`;

// Obtener IP del servidor (puedes cambiarla manualmente si es necesario)
const SERVER_IP = process.env.SERVER_IP || '88.99.173.249'; // IP por defecto, ajustar si es necesario

async function getZoneId() {
  const headers = {};
  if (CLOUDFLARE_API_TOKEN) {
    headers['Authorization'] = `Bearer ${CLOUDFLARE_API_TOKEN}`;
    headers['Content-Type'] = 'application/json';
  } else if (CLOUDFLARE_EMAIL && CLOUDFLARE_API_KEY) {
    headers['X-Auth-Email'] = CLOUDFLARE_EMAIL;
    headers['X-Auth-Key'] = CLOUDFLARE_API_KEY;
    headers['Content-Type'] = 'application/json';
  } else {
    throw new Error('No hay credenciales de Cloudflare configuradas. Configura CLOUDFLARE_API_TOKEN o CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY en .env');
  }

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
  return { zoneId: zone.id, headers };
}

async function checkExistingRecord(zoneId, headers) {
  console.log(`🔍 Verificando si ya existe un registro para ${FULL_DOMAIN}...`);
  
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${FULL_DOMAIN}`, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error verificando registros: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
  }

  if (data.result.length > 0) {
    console.log(`⚠️  Ya existe un registro para ${FULL_DOMAIN}:`);
    console.log(`   ID: ${data.result[0].id}`);
    console.log(`   Tipo: ${data.result[0].type}`);
    console.log(`   Contenido: ${data.result[0].content}`);
    console.log(`   Proxy: ${data.result[0].proxied ? '🟠 Activado' : '⚪ Desactivado'}`);
    return data.result[0];
  }

  return null;
}

async function createDNSRecord(zoneId, headers, recordId = null) {
  const recordData = {
    type: 'A',
    name: SUBDOMAIN,
    content: SERVER_IP,
    proxied: true, // Activar proxy (SSL automático)
    ttl: 1 // Auto
  };

  if (recordId) {
    console.log(`🔄 Actualizando registro existente (ID: ${recordId})...`);
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(recordData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error actualizando registro: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    console.log(`✅ Registro actualizado exitosamente!`);
    console.log(`   URL: https://${FULL_DOMAIN}`);
    return data.result;
  } else {
    console.log(`➕ Creando nuevo registro DNS...`);
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers,
      body: JSON.stringify(recordData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error creando registro: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
    }

    console.log(`✅ Registro creado exitosamente!`);
    console.log(`   URL: https://${FULL_DOMAIN}`);
    return data.result;
  }
}

async function main() {
  try {
    console.log('🚀 Configurando DNS de Cloudflare para Transmutaciones Energéticas\n');
    console.log(`📋 Configuración:`);
    console.log(`   Dominio: ${FULL_DOMAIN}`);
    console.log(`   Tipo: A`);
    console.log(`   IP: ${SERVER_IP}`);
    console.log(`   Proxy: 🟠 Activado (SSL automático)\n`);

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

    // Obtener Zone ID
    const { zoneId, headers } = await getZoneId();

    // Verificar si ya existe un registro
    const existingRecord = await checkExistingRecord(zoneId, headers);

    if (existingRecord) {
      // Si existe pero no está configurado correctamente, actualizarlo
      if (existingRecord.content !== SERVER_IP || !existingRecord.proxied) {
        console.log(`\n⚠️  El registro existe pero necesita actualización.`);
        const updated = await createDNSRecord(zoneId, headers, existingRecord.id);
        console.log(`\n✅ Configuración completada!`);
        console.log(`\n🌐 Puedes acceder a: https://${FULL_DOMAIN}`);
        console.log(`   (Puede tardar 1-5 minutos en propagarse)`);
      } else {
        console.log(`\n✅ El registro ya está configurado correctamente!`);
        console.log(`\n🌐 Puedes acceder a: https://${FULL_DOMAIN}`);
      }
    } else {
      // Crear nuevo registro
      await createDNSRecord(zoneId, headers);
      console.log(`\n✅ Configuración completada!`);
      console.log(`\n🌐 Puedes acceder a: https://${FULL_DOMAIN}`);
      console.log(`   (Puede tardar 1-5 minutos en propagarse)`);
    }

    console.log(`\n📝 Notas:`);
    console.log(`   - El proxy está activado (🟠), por lo que Cloudflare proporciona SSL automático`);
    console.log(`   - Si necesitas cambiar la IP, edita SERVER_IP en .env o pásala como variable de entorno`);
    console.log(`   - Para verificar: dig ${FULL_DOMAIN}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
    process.exit(1);
  }
}

main();



















