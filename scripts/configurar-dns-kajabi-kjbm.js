// scripts/configurar-dns-kajabi-kjbm.js
// Script para configurar los registros DNS de Kajabi en el subdominio kjbm.eugenihidalgo.org
// EXACTAMENTE como Kajabi lo requiere

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

// Registros DNS EXACTAMENTE como Kajabi los requiere
const KAJABI_RECORDS = {
  // TXT Records
  txt: [
    {
      name: SUBDOMAIN, // kjbm
      content: 'v=spf1 include:mailgun.org ~all',
      description: 'SPF Record para Mailgun'
    },
    {
      name: `k1._domainkey.${SUBDOMAIN}`, // k1._domainkey.kjbm
      content: 'k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDQ/ZilOdNpbkOf4KI+Azu3tToiCuon+6tQwgSJbOmL5g4gc8SmYTVJH/iQ6Haj1R42+5Np9tyDY6K6thH8Rw3KRZpgGHldPesxjPG0rFWL7gvB/L9bDH0Xz/KriP05ZLKFEau1s9ap6j+BXg10wKTcbrCZY2fMDEGhWe7e+AnY7wIDAQAB',
      description: 'DKIM Record'
    },
    {
      name: `_dmarc.${SUBDOMAIN}`, // _dmarc.kjbm
      content: 'v=DMARC1; p=none; pct=100; fo=1; ri=3600; rua=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com; ruf=mailto:ce4b0f5c@dmarc.mailgun.org,mailto:1be13cfa@inbox.ondmarc.com',
      description: 'DMARC Record'
    }
  ],
  // MX Records
  mx: [
    {
      name: SUBDOMAIN, // kjbm
      content: 'mxa.mailgun.org',
      priority: 10,
      description: 'MX Record - Prioridad 10'
    },
    {
      name: SUBDOMAIN, // kjbm
      content: 'mxb.mailgun.org',
      priority: 20,
      description: 'MX Record - Prioridad 20'
    }
  ],
  // CNAME Records
  cname: [
    {
      name: `email.${SUBDOMAIN}`, // email.kjbm
      content: 'mailgun.org',
      description: 'CNAME para email'
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

async function findExistingRecord(records, type, name) {
  // Construir posibles nombres
  const possibleNames = [];
  
  if (name.includes('.')) {
    // Si ya incluye puntos, puede ser k1._domainkey.kjbm o _dmarc.kjbm
    if (name.startsWith('k1._domainkey.') || name.startsWith('_dmarc.') || name.startsWith('email.')) {
      possibleNames.push(`${name}.${DOMAIN}`);
      possibleNames.push(name);
    } else {
      possibleNames.push(name);
      possibleNames.push(`${name}.${DOMAIN}`);
    }
  } else {
    // Si es solo kjbm, buscar kjbm.eugenihidalgo.org
    possibleNames.push(`${name}.${DOMAIN}`);
    possibleNames.push(name);
  }
  
  // Buscar por tipo y nombre
  const found = records.find(r => {
    if (r.type !== type) return false;
    return possibleNames.includes(r.name);
  });
  
  // Si no se encuentra, buscar también por contenido similar (para MX y CNAME)
  if (!found && (type === 'MX' || type === 'CNAME')) {
    return records.find(r => {
      if (r.type !== type) return false;
      // Buscar si el nombre contiene el subdominio
      return r.name.includes(SUBDOMAIN) || r.name.includes(name);
    });
  }
  
  return found;
}

async function createOrUpdateRecord(zoneId, headers, type, name, content, priority = null, existingRecord = null) {
  const fullName = name.includes('.') ? name : `${name}.${DOMAIN}`;
  
  const recordData = {
    type: type,
    name: fullName,
    content: content,
    ttl: 1, // Auto
    proxied: false // Los registros MX, TXT y CNAME no deben estar proxied
  };

  if (priority !== null) {
    recordData.priority = priority;
  }

  // Intentar actualizar si existe un registro
  if (existingRecord && existingRecord.id) {
    console.log(`   🔄 Intentando actualizar registro existente (ID: ${existingRecord.id})...`);
    
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(recordData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          console.log(`     ✅ Actualizado exitosamente`);
          return { action: 'updated', record: data.result };
        }
      }
      
      // Si llegamos aquí, la actualización falló, continuar a crear nuevo
      const errorText = await response.text();
      if (response.status === 405) {
        console.log(`     ⚠️  No se puede actualizar (permisos limitados), creando nuevo registro...`);
      } else {
        console.log(`     ⚠️  Error al actualizar (${response.status}), creando nuevo registro...`);
      }
    } catch (error) {
      console.log(`     ⚠️  Error al actualizar: ${error.message}, creando nuevo registro...`);
    }
  }
  
  // Crear nuevo registro (ya sea porque no existe o porque no se pudo actualizar)
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
    const errorText = await response.text();
    const errorData = JSON.parse(errorText);
    
    // Si el error es que ya existe un registro idéntico o con el mismo nombre, considerarlo como éxito
    if (errorData.errors && errorData.errors.some(e => e.code === 81058 || e.code === 81053)) {
      console.log(`     ℹ️  El registro ya existe, continuando...`);
      // Intentar encontrar el registro existente
      const allRecords = await listAllRecords(zoneId, headers);
      const existing = allRecords.find(r => 
        r.type === type && 
        r.name === fullName
      );
      if (existing) {
        return { action: 'exists', record: existing };
      }
      return { action: 'exists', record: null };
    }
    
    throw new Error(`Error creando registro: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Error de Cloudflare: ${data.errors?.map(e => e.message).join(', ') || 'Error desconocido'}`);
  }

  console.log(`     ✅ Creado exitosamente`);
  return { action: 'created', record: data.result };
}

async function configureKajabiDNS(zoneId, headers, existingRecords) {
  const results = {
    txt: [],
    mx: [],
    cname: []
  };

  console.log(`\n📝 Configurando registros DNS para Kajabi en ${FULL_DOMAIN}...\n`);

  // Configurar TXT Records
  console.log(`📋 Configurando registros TXT:`);
  for (const txtRecord of KAJABI_RECORDS.txt) {
    const existing = findExistingRecord(existingRecords, 'TXT', txtRecord.name);
    console.log(`   → ${txtRecord.description} (${txtRecord.name.includes('.') ? txtRecord.name : `${txtRecord.name}.${DOMAIN}`})`);
    
    const result = await createOrUpdateRecord(
      zoneId,
      headers,
      'TXT',
      txtRecord.name,
      txtRecord.content,
      null,
      existing
    );
    
    results.txt.push({ ...txtRecord, ...result });
  }

  // Configurar MX Records
  console.log(`\n📋 Configurando registros MX:`);
  for (const mxRecord of KAJABI_RECORDS.mx) {
    const existing = findExistingRecord(existingRecords, 'MX', mxRecord.name);
    console.log(`   → ${mxRecord.description} (${mxRecord.content})`);
    
    const result = await createOrUpdateRecord(
      zoneId,
      headers,
      'MX',
      mxRecord.name,
      mxRecord.content,
      mxRecord.priority,
      existing
    );
    
    results.mx.push({ ...mxRecord, ...result });
  }

  // Configurar CNAME Records
  console.log(`\n📋 Configurando registros CNAME:`);
  for (const cnameRecord of KAJABI_RECORDS.cname) {
    const existing = findExistingRecord(existingRecords, 'CNAME', cnameRecord.name);
    console.log(`   → ${cnameRecord.description} (${cnameRecord.name}.${DOMAIN} → ${cnameRecord.content})`);
    
    const result = await createOrUpdateRecord(
      zoneId,
      headers,
      'CNAME',
      cnameRecord.name,
      cnameRecord.content,
      null,
      existing
    );
    
    results.cname.push({ ...cnameRecord, ...result });
  }

  return results;
}

async function main() {
  try {
    console.log('🚀 Configurando DNS de Cloudflare para Kajabi (subdominio kjbm)\n');
    console.log(`📋 Configuración:`);
    console.log(`   Subdominio: ${FULL_DOMAIN}`);
    console.log(`   Dominio principal: ${DOMAIN}`);
    console.log(`\n📝 Registros a configurar (EXACTAMENTE como Kajabi los requiere):`);
    console.log(`   - 3 registros TXT (SPF, DKIM, DMARC) en ${SUBDOMAIN}`);
    console.log(`   - 2 registros MX (mxa.mailgun.org, mxb.mailgun.org) en ${SUBDOMAIN}`);
    console.log(`   - 1 registro CNAME (email.${SUBDOMAIN} → mailgun.org)\n`);

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
    
    // Listar registros existentes
    const existingRecords = await listAllRecords(zoneId, headers);
    
    console.log(`📊 Registros existentes encontrados: ${existingRecords.length}`);
    if (existingRecords.length > 0) {
      console.log(`   (Se actualizarán los que coincidan, se crearán los nuevos)\n`);
    }

    // Configurar registros de Kajabi
    const results = await configureKajabiDNS(zoneId, headers, existingRecords);

    console.log(`\n✅ Configuración completada!\n`);
    console.log(`📋 Resumen:`);
    console.log(`   - TXT Records: ${results.txt.length} configurados`);
    console.log(`   - MX Records: ${results.mx.length} configurados`);
    console.log(`   - CNAME Records: ${results.cname.length} configurados\n`);
    
    console.log(`\n📝 Próximos pasos:`);
    console.log(`   1. Espera 5-15 minutos para que los DNS se propaguen`);
    console.log(`   2. Ve a Kajabi → Settings → Custom Domain`);
    console.log(`   3. Verifica que Kajabi detecte todos los registros correctamente`);
    console.log(`   4. Una vez verificado, Kajabi activará el dominio personalizado\n`);
    
    console.log(`🔍 Para verificar los registros:`);
    console.log(`   dig ${FULL_DOMAIN} TXT`);
    console.log(`   dig ${FULL_DOMAIN} MX`);
    console.log(`   dig email.${FULL_DOMAIN} CNAME\n`);

    console.log(`ℹ️  Nota importante:`);
    console.log(`   - Los registros están configurados en el subdominio ${SUBDOMAIN}`);
    console.log(`   - Esto es EXACTAMENTE lo que Kajabi requiere`);
    console.log(`   - Los emails recibidos seguirán yendo a Google (MX en la raíz)`);
    console.log(`   - Los emails enviados por Kajabi estarán autenticados correctamente\n`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:`, error.stack);
    }
    process.exit(1);
  }
}

main();

