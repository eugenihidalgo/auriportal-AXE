#!/usr/bin/env node
/**
 * Script para crear reglas de redirección en Cloudflare
 * 
 * Uso:
 *   node scripts/crear-redirect-cloudflare.js dominio.com
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

// Obtener o crear el ruleset de redirección
async function getOrCreateRedirectRuleset(zoneId, headers) {
  // Primero intentar obtener el ruleset existente
  const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`, {
    headers
  });

  if (listResponse.ok) {
    const listData = await listResponse.json();
    if (listData.success && listData.result) {
      const redirectRuleset = listData.result.find(
        rs => rs.phase === 'http_request_dynamic_redirect' && rs.kind === 'zone'
      );
      if (redirectRuleset) {
        return redirectRuleset.id;
      }
    }
  }

  // Si no existe, crear uno nuevo
  const createBody = {
    name: 'Redirect domain to www',
    kind: 'zone',
    phase: 'http_request_dynamic_redirect'
  };

  const createResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(createBody)
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Error al crear ruleset: ${createResponse.status} ${error}`);
  }

  const createData = await createResponse.json();
  if (!createData.success) {
    throw new Error(`Error: ${createData.errors?.map(e => e.message).join(', ')}`);
  }

  return createData.result.id;
}

// Crear Redirect Rule usando la API moderna
async function createRedirectRule(domain) {
  const zoneId = await getZoneId(domain);
  const headers = getAuthHeaders();

  // Obtener o crear el ruleset
  const rulesetId = await getOrCreateRedirectRuleset(zoneId, headers);

  const rule = {
    action: 'redirect',
    action_parameters: {
      from: {
        value: `http://${domain}/*`
      },
      to: {
        value: `https://www.${domain}/$1`,
        status_code: 301,
        preserve_query_string: true
      }
    },
    expression: `(http.host eq "${domain}")`,
    description: `Redirect ${domain} to www.${domain}`
  };

  log(`\n📝 Creando Redirect Rule:`, 'cyan');
  log(`   Desde: ${domain}/*`, 'blue');
  log(`   Hacia: https://www.${domain}/$1`, 'blue');
  log(`   Código: 301 (Permanente)`, 'blue');

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rule)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error al crear Redirect Rule: ${response.status} ${error}`);
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
  
  if (args.length < 1) {
    log('Uso: node scripts/crear-redirect-cloudflare.js dominio.com', 'red');
    log('Ejemplo: node scripts/crear-redirect-cloudflare.js eugenihidalgo.org', 'yellow');
    process.exit(1);
  }

  const domain = args[0];

  try {
    const result = await createRedirectRule(domain);
    log(`\n✅ Redirect Rule creada exitosamente!`, 'green');
    log(`   ID: ${result.id}`, 'blue');
    log(`\n📋 Resumen:`, 'cyan');
    log(`   - ${domain}/* → https://www.${domain}/$1 (301)`, 'blue');
    log(`   - La redirección está activa y funcionará en unos minutos`, 'green');
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    
    // Si falla con Redirect Rules, intentar con Page Rules usando email+key
    if (CLOUDFLARE_EMAIL && CLOUDFLARE_API_KEY && !CLOUDFLARE_API_TOKEN) {
      log(`\n⚠️  Intentando método alternativo con Page Rules...`, 'yellow');
      try {
        const result = await createPageRuleLegacy(domain);
        log(`\n✅ Page Rule creada exitosamente!`, 'green');
        log(`   ID: ${result.id}`, 'blue');
      } catch (pageRuleError) {
        log(`\n❌ Error con Page Rules: ${pageRuleError.message}`, 'red');
        log(`\n💡 Configura manualmente en Cloudflare Dashboard:`, 'cyan');
        log(`   1. Ve a https://dash.cloudflare.com`, 'blue');
        log(`   2. Selecciona el dominio: ${domain}`, 'blue');
        log(`   3. Ve a Rules → Page Rules`, 'blue');
        log(`   4. Haz clic en "Create Page Rule"`, 'blue');
        log(`   5. Configura:`, 'blue');
        log(`      - URL: ${domain}/*`, 'blue');
        log(`      - Setting: Forwarding URL → 301 - Permanent Redirect`, 'blue');
        log(`      - Destination URL: https://www.${domain}/$1`, 'blue');
        log(`   6. Guarda la regla`, 'blue');
        process.exit(1);
      }
    } else {
      log(`\n💡 Configura manualmente en Cloudflare Dashboard:`, 'cyan');
      log(`   1. Ve a https://dash.cloudflare.com`, 'blue');
      log(`   2. Selecciona el dominio: ${domain}`, 'blue');
      log(`   3. Ve a Rules → Page Rules`, 'blue');
      log(`   4. Haz clic en "Create Page Rule"`, 'blue');
      log(`   5. Configura:`, 'blue');
      log(`      - URL: ${domain}/*`, 'blue');
      log(`      - Setting: Forwarding URL → 301 - Permanent Redirect`, 'blue');
      log(`      - Destination URL: https://www.${domain}/$1`, 'blue');
      log(`   6. Guarda la regla`, 'blue');
      process.exit(1);
    }
  }
}

// Método legacy para Page Rules (solo funciona con email+key, no con tokens)
async function createPageRuleLegacy(domain) {
  const zoneId = await getZoneId(domain);
  const headers = getAuthHeaders();

  const body = {
    targets: [
      {
        target: 'url',
        constraint: {
          operator: 'matches',
          value: `${domain}/*`
        }
      }
    ],
    actions: [
      {
        id: 'forwarding_url',
        value: {
          status_code: 301,
          url: `https://www.${domain}/$1`
        }
      }
    ],
    priority: 1,
    status: 'active'
  };

  log(`\n📝 Creando Page Rule (método legacy)...`, 'cyan');

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error al crear Page Rule: ${response.status} ${error}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Error: ${data.errors?.map(e => e.message).join(', ')}`);
  }

  return data.result;
}

main();

