// src/services/cloudflare-dns.js
// Servei per gestionar DNS a Cloudflare via API

import fetch from 'node-fetch';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * Obtenir zone ID d'un domini
 */
async function obtenerZoneId(dominio) {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN no està configurat');
  }

  const response = await fetch(`${CLOUDFLARE_API_BASE}/zones?name=${dominio}`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error obtenint zone ID: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (!data.result || data.result.length === 0) {
    throw new Error(`Domini ${dominio} no trobat a Cloudflare`);
  }

  return data.result[0].id;
}

/**
 * Afegir registre DNS a Cloudflare
 */
export async function agregarRegistroDNS(dominio, tipo, nombre, contenido, prioridad = null, ttl = 3600, proxied = true) {
  try {
    const zoneId = await obtenerZoneId(dominio);
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    // Construir nombre completo del registro
    let nombreCompleto;
    if (nombre === '@' || nombre === dominio) {
      // Para registros en la raíz del dominio, usar el dominio directamente
      nombreCompleto = dominio;
    } else if (nombre.includes('.')) {
      // Si ya incluye puntos, usar tal cual
      nombreCompleto = nombre;
    } else {
      // Para subdominios, agregar el dominio
      nombreCompleto = `${nombre}.${dominio}`;
    }
    
    const registro = {
      type: tipo,
      name: nombreCompleto,
      content: contenido,
      ttl: ttl === 'auto' ? 1 : ttl,
      proxied: proxied // Activar proxy por defecto para SSL automático
    };

    if (prioridad !== null) {
      registro.priority = prioridad;
    }

    // Verificar si ja existeix (buscar por nombre completo o por @)
    // Para registros en la raíz, buscar también por @
    const nombreBusqueda = (nombre === '@' || nombre === dominio) ? dominio : nombreCompleto;
    const existentes = await listarRegistrosDNS(dominio, tipo, nombreBusqueda);
    if (existentes.success && existentes.registros.length > 0) {
      // Actualitzar existent
      const registroId = existentes.registros[0].id;
      const response = await fetch(
        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records/${registroId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(registro)
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Error actualitzant registre: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        success: true,
        action: 'updated',
        registro: data.result
      };
    } else {
      // Crear nou
      const response = await fetch(
        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(registro)
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Error creant registre: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        success: true,
        action: 'created',
        registro: data.result
      };
    }

  } catch (error) {
    console.error(`Error afegint registre DNS ${tipo} ${nombre} per ${dominio}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Llistar registres DNS
 */
export async function listarRegistrosDNS(dominio, tipo = null, nombre = null) {
  try {
    const zoneId = await obtenerZoneId(dominio);
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    let url = `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`;
    const params = new URLSearchParams();
    if (tipo) params.append('type', tipo);
    if (nombre) params.append('name', nombre);
    if (params.toString()) url += '?' + params.toString();

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error llistant registres: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      registros: data.result || []
    };

  } catch (error) {
    console.error(`Error llistant registres DNS de ${dominio}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Configurar MX records per Zoho
 */
export async function configurarMX(dominio) {
  const resultados = [];

  // MX 10
  const mx1 = await agregarRegistroDNS(dominio, 'MX', '@', 'mx.zoho.com', 10);
  resultados.push({ priority: 10, ...mx1 });

  // MX 20
  const mx2 = await agregarRegistroDNS(dominio, 'MX', '@', 'mx2.zoho.com', 20);
  resultados.push({ priority: 20, ...mx2 });

  return resultados;
}

/**
 * Configurar SPF per Zoho
 */
export async function configurarSPF(dominio) {
  return await agregarRegistroDNS(dominio, 'TXT', '@', 'v=spf1 include:zoho.com ~all');
}

/**
 * Configurar DKIM
 */
export async function configurarDKIM(dominio, dkimRecord) {
  // DKIM normalment té el format: zmail._domainkey
  const nombre = dkimRecord.name || 'zmail._domainkey';
  const contenido = dkimRecord.value || dkimRecord.content || dkimRecord;
  
  return await agregarRegistroDNS(dominio, 'TXT', nombre, contenido);
}

/**
 * Configurar DMARC
 */
export async function configurarDMARC(dominio, emailReporte) {
  const contenido = `v=DMARC1; p=none; rua=mailto:${emailReporte}`;
  return await agregarRegistroDNS(dominio, 'TXT', '_dmarc', contenido);
}

/**
 * Configurar tots els registres DNS per Zoho Mail
 */
export async function configurarDNSCompleto(dominio, dkimRecord, emailReporte) {
  const resultados = {
    mx: null,
    spf: null,
    dkim: null,
    dmarc: null
  };

  console.log(`📝 Configurant DNS per ${dominio}...`);

  // MX
  console.log('  → Configurant MX records...');
  resultados.mx = await configurarMX(dominio);

  // SPF
  console.log('  → Configurant SPF...');
  resultados.spf = await configurarSPF(dominio);

  // DKIM
  if (dkimRecord) {
    console.log('  → Configurant DKIM...');
    resultados.dkim = await configurarDKIM(dominio, dkimRecord);
  }

  // DMARC
  console.log('  → Configurant DMARC...');
  resultados.dmarc = await configurarDMARC(dominio, emailReporte);

  return resultados;
}

/**
 * Eliminar registre DNS
 */
export async function eliminarRegistroDNS(dominio, registroId) {
  try {
    const zoneId = await obtenerZoneId(dominio);
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    const response = await fetch(
      `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records/${registroId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error eliminant registre: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      registro: data.result
    };

  } catch (error) {
    console.error(`Error eliminant registre DNS ${registroId} de ${dominio}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Actualizar registre DNS per ID
 */
export async function actualizarRegistroDNS(dominio, registroId, tipo, nombre, contenido, prioridad = null, ttl = 3600, proxied = false) {
  try {
    const zoneId = await obtenerZoneId(dominio);
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    const registro = {
      type: tipo,
      name: nombre,
      content: contenido,
      ttl: ttl === 'auto' ? 1 : ttl,
      proxied: proxied
    };

    if (prioridad !== null) {
      registro.priority = prioridad;
    }

    const response = await fetch(
      `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records/${registroId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registro)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error actualitzant registre: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      registro: data.result
    };

  } catch (error) {
    console.error(`Error actualitzant registre DNS ${registroId} de ${dominio}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}






