// src/services/zoho-mail-admin.js
// Servei per gestionar Zoho Mail via API (dominis, emails, etc.)

import fetch from 'node-fetch';

const ZOHO_API_BASE = 'https://mail.zoho.com/api';

/**
 * Obtenir token d'accés nou des del refresh token
 */
async function obtenerAccessToken() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET i ZOHO_REFRESH_TOKEN són necessaris');
  }

  // Usar endpoint EU si el compte és europeu
  const zohoEndpoint = process.env.ZOHO_ENDPOINT || 'https://accounts.zoho.eu/oauth/v2/token';
  const response = await fetch(zohoEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error obtenint token: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Afegir domini a Zoho Mail
 */
export async function agregarDominio(dominio) {
  try {
    const accessToken = await obtenerAccessToken();
    const accountId = process.env.ZOHO_ACCOUNT_ID;

    if (!accountId) {
      throw new Error('ZOHO_ACCOUNT_ID no està configurat');
    }

    const response = await fetch(`${ZOHO_API_BASE}/accounts/${accountId}/domains`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domainName: dominio
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error afegint domini: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.data,
      verificationRecord: data.data?.verificationRecord // Registre TXT per verificar
    };

  } catch (error) {
    console.error(`Error afegint domini ${dominio}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verificar domini a Zoho Mail
 */
export async function verificarDominio(dominio) {
  try {
    const accessToken = await obtenerAccessToken();
    const accountId = process.env.ZOHO_ACCOUNT_ID;

    const response = await fetch(
      `${ZOHO_API_BASE}/accounts/${accountId}/domains/${dominio}/verify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error verificant domini: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      verified: data.data?.verified || false
    };

  } catch (error) {
    console.error(`Error verificant domini ${dominio}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtenir claus DKIM d'un domini
 */
export async function obtenerDKIM(dominio) {
  try {
    const accessToken = await obtenerAccessToken();
    const accountId = process.env.ZOHO_ACCOUNT_ID;

    const response = await fetch(
      `${ZOHO_API_BASE}/accounts/${accountId}/domains/${dominio}/dkim`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error obtenint DKIM: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      dkim: data.data
    };

  } catch (error) {
    console.error(`Error obtenint DKIM per ${dominio}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Crear email a Zoho Mail
 */
export async function crearEmail(email, password, displayName = null) {
  try {
    const accessToken = await obtenerAccessToken();
    const accountId = process.env.ZOHO_ACCOUNT_ID;

    const [localPart, domain] = email.split('@');
    if (!domain) {
      throw new Error('Email invàlid');
    }

    const response = await fetch(`${ZOHO_API_BASE}/accounts/${accountId}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailAddress: email,
        password: password,
        displayName: displayName || localPart,
        domainName: domain
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error creant email: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      user: data.data
    };

  } catch (error) {
    console.error(`Error creant email ${email}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Llistar dominis a Zoho Mail
 */
export async function listarDominios() {
  try {
    const accessToken = await obtenerAccessToken();
    const accountId = process.env.ZOHO_ACCOUNT_ID;

    const response = await fetch(`${ZOHO_API_BASE}/accounts/${accountId}/domains`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error llistant dominis: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      dominios: data.data || []
    };

  } catch (error) {
    console.error('Error llistant dominis:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Llistar emails d'un domini
 */
export async function listarEmails(dominio) {
  try {
    const accessToken = await obtenerAccessToken();
    const accountId = process.env.ZOHO_ACCOUNT_ID;

    const response = await fetch(
      `${ZOHO_API_BASE}/accounts/${accountId}/domains/${dominio}/users`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error llistant emails: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      emails: data.data || []
    };

  } catch (error) {
    console.error(`Error llistant emails de ${dominio}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

