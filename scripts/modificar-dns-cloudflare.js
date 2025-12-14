#!/usr/bin/env node
/**
 * Script para modificar registros DNS en Cloudflare
 * 
 * Uso:
 *   node scripts/modificar-dns-cloudflare.js crear A subdominio 88.99.173.249 dominio.com
 *   node scripts/modificar-dns-cloudflare.js crear TXT @ "v=spf1 include:spf.privateemail.com ~all" dominio.com
 *   node scripts/modificar-dns-cloudflare.js listar dominio.com
 *   node scripts/modificar-dns-cloudflare.js eliminar registro_id dominio.com
 */

import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL;
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;

// Verificar credenciales
function getAuthHeaders() {
  if (CLOUDFLARE_API_TOKEN) {
    return {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    };
  } else if (CLOUDFLARE_EMAIL && CLOUDFLARE_API_KEY) {
    return {
      'X-Auth-Email': CLOUDFLARE_EMAIL,
      'X-Auth-Key': CLOUDFLARE_API_KEY,
      'Content-Type': 'application/json'
    };
  } else {
    throw new Error('No hay credenciales de Cloudflare configuradas. Configura CLOUDFLARE_API_TOKEN o CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY en .env');
  }
}

// Obtener Zone ID de un dominio
async function getZoneId(domain) {
  const headers = getAuthHeaders();
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
    headers
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error al obtener Zone ID: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.success || !data.result || data.result.length === 0) {
    throw new Error(`No se encontró el dominio ${domain} en Cloudflare`);
  }

  return data.result[0].id;
}

// Listar todos los registros DNS
async function listRecords(domain) {
  const zoneId = await getZoneId(domain);
  const headers = getAuthHeaders();
  
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    headers
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error al listar registros: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Error: ${data.errors?.map(e => e.message).join(', ')}`);
  }

  return data.result;
}

// Crear un registro DNS
async function createRecord(domain, type, name, content, proxied = false, ttl = 1) {
  const zoneId = await getZoneId(domain);
  const headers = getAuthHeaders();

  // Normalizar el nombre (si es @, dejarlo vacío o como el dominio raíz)
  const recordName = name === '@' ? domain : name.includes('.') ? name : `${name}.${domain}`;

  const body = {
    type: type.toUpperCase(),
    name: recordName,
    content: content,
    ttl: ttl === 'auto' ? 1 : parseInt(ttl),
    proxied: proxied === true || proxied === 'true' || proxied === 'proxied'
  };

  log(`\n📝 Creando registro DNS:`, 'cyan');
  log(`   Tipo: ${type}`, 'blue');
  log(`   Nombre: ${recordName}`, 'blue');
  log(`   Contenido: ${content}`, 'blue');
  log(`   Proxy: ${body.proxied ? '🟠 Proxied' : 'DNS only'}`, 'blue');

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error al crear registro: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Error: ${data.errors?.map(e => e.message).join(', ')}`);
  }

  return data.result;
}

// Actualizar un registro DNS
async function updateRecord(domain, recordId, type, name, content, proxied = false, ttl = 1) {
  const zoneId = await getZoneId(domain);
  const headers = getAuthHeaders();

  const recordName = name === '@' ? domain : name.includes('.') ? name : `${name}.${domain}`;

  const body = {
    type: type.toUpperCase(),
    name: recordName,
    content: content,
    ttl: ttl === 'auto' ? 1 : parseInt(ttl),
    proxied: proxied === true || proxied === 'true' || proxied === 'proxied'
  };

  log(`\n📝 Actualizando registro DNS:`, 'cyan');
  log(`   ID: ${recordId}`, 'blue');
  log(`   Tipo: ${type}`, 'blue');
  log(`   Nombre: ${recordName}`, 'blue');
  log(`   Contenido: ${content}`, 'blue');

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error al actualizar registro: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Error: ${data.errors?.map(e => e.message).join(', ')}`);
  }

  return data.result;
}

// Eliminar un registro DNS
async function deleteRecord(domain, recordId) {
  const zoneId = await getZoneId(domain);
  const headers = getAuthHeaders();

  log(`\n🗑️  Eliminando registro DNS ID: ${recordId}`, 'yellow');

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'DELETE',
    headers
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error al eliminar registro: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Error: ${data.errors?.map(e => e.message).join(', ')}`);
  }

  return data.result;
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'listar':
      case 'list': {
        if (args.length < 2) {
          log('Uso: node scripts/modificar-dns-cloudflare.js listar dominio.com', 'red');
          process.exit(1);
        }
        const domain = args[1];
        log(`\n📋 Listando registros DNS para: ${domain}`, 'cyan');
        const records = await listRecords(domain);
        
        if (records.length === 0) {
          log('   No se encontraron registros', 'yellow');
        } else {
          log(`\n   Encontrados ${records.length} registros:\n`, 'green');
          records.forEach(record => {
            const proxyStatus = record.proxied ? '🟠 Proxied' : 'DNS only';
            log(`   ${record.type.padEnd(6)} ${record.name.padEnd(40)} ${record.content.padEnd(30)} ${proxyStatus}`, 'blue');
            log(`   ID: ${record.id}`, 'yellow');
            log('');
          });
        }
        break;
      }

      case 'crear':
      case 'create': {
        if (args.length < 5) {
          log('Uso: node scripts/modificar-dns-cloudflare.js crear TIPO NOMBRE CONTENIDO DOMINIO [proxied] [ttl]', 'red');
          log('Ejemplo: node scripts/modificar-dns-cloudflare.js crear A subdominio 88.99.173.249 dominio.com proxied', 'yellow');
          log('Ejemplo: node scripts/modificar-dns-cloudflare.js crear TXT @ "v=spf1 include:spf.privateemail.com ~all" dominio.com', 'yellow');
          process.exit(1);
        }
        const type = args[1];
        const name = args[2];
        const content = args[3];
        const domain = args[4];
        const proxied = args[5] === 'proxied' || args[5] === 'true';
        const ttl = args[6] || 'auto';

        const result = await createRecord(domain, type, name, content, proxied, ttl);
        log(`\n✅ Registro creado exitosamente!`, 'green');
        log(`   ID: ${result.id}`, 'blue');
        log(`   Nombre: ${result.name}`, 'blue');
        log(`   Contenido: ${result.content}`, 'blue');
        break;
      }

      case 'actualizar':
      case 'update': {
        if (args.length < 6) {
          log('Uso: node scripts/modificar-dns-cloudflare.js actualizar RECORD_ID TIPO NOMBRE CONTENIDO DOMINIO [proxied]', 'red');
          process.exit(1);
        }
        const recordId = args[1];
        const type = args[2];
        const name = args[3];
        const content = args[4];
        const domain = args[5];
        const proxied = args[6] === 'proxied' || args[6] === 'true';

        const result = await updateRecord(domain, recordId, type, name, content, proxied);
        log(`\n✅ Registro actualizado exitosamente!`, 'green');
        break;
      }

      case 'eliminar':
      case 'delete': {
        if (args.length < 3) {
          log('Uso: node scripts/modificar-dns-cloudflare.js eliminar RECORD_ID DOMINIO', 'red');
          process.exit(1);
        }
        const recordId = args[1];
        const domain = args[2];

        await deleteRecord(domain, recordId);
        log(`\n✅ Registro eliminado exitosamente!`, 'green');
        break;
      }

      default:
        log('Comandos disponibles:', 'cyan');
        log('  listar DOMINIO              - Lista todos los registros DNS', 'blue');
        log('  crear TIPO NOMBRE CONTENIDO DOMINIO [proxied] [ttl]', 'blue');
        log('  actualizar RECORD_ID TIPO NOMBRE CONTENIDO DOMINIO [proxied]', 'blue');
        log('  eliminar RECORD_ID DOMINIO  - Elimina un registro DNS', 'blue');
        log('\nEjemplos:', 'cyan');
        log('  node scripts/modificar-dns-cloudflare.js listar pdeeugenihidalgo.org', 'yellow');
        log('  node scripts/modificar-dns-cloudflare.js crear A subdominio 88.99.173.249 pdeeugenihidalgo.org proxied', 'yellow');
        log('  node scripts/modificar-dns-cloudflare.js crear TXT @ "v=spf1 include:spf.privateemail.com ~all" pdeeugenihidalgo.org', 'yellow');
        process.exit(1);
    }
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();

