// src/services/zoho-mail-api.js
// Servei per gestionar emails via API de Zoho Mail

import fetch from 'node-fetch';

/**
 * Configuració de Zoho Mail API
 */
const ZOHO_CONFIG = {
  apiUrl: 'https://mail.zoho.com/api',
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  accessToken: process.env.ZOHO_ACCESS_TOKEN
};

/**
 * Obtenir token d'accés nou (si expira)
 */
async function obtenerAccessToken() {
  if (!ZOHO_CONFIG.refreshToken) {
    throw new Error('ZOHO_REFRESH_TOKEN no està configurat');
  }

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      refresh_token: ZOHO_CONFIG.refreshToken,
      client_id: ZOHO_CONFIG.clientId,
      client_secret: ZOHO_CONFIG.clientSecret,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error(`Error obtenint token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Enviar email via API de Zoho
 */
export async function enviarEmailViaAPI(destinatario, asunto, mensaje, html = null) {
  try {
    // Obtenir token d'accés
    const accessToken = await obtenerAccessToken();

    // Preparar missatge
    const emailData = {
      fromAddress: process.env.ZOHO_FROM_EMAIL || process.env.SMTP_USER,
      toAddress: destinatario,
      subject: asunto,
      content: html || mensaje,
      contentType: html ? 'html' : 'text'
    };

    // Enviar via API
    const response = await fetch(`${ZOHO_CONFIG.apiUrl}/accounts/${process.env.ZOHO_ACCOUNT_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error enviant email: ${error}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.data?.messageId,
      result
    };

  } catch (error) {
    console.error('Error enviant email via API Zoho:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Llegir emails (opcional)
 */
export async function leerEmails(folder = 'INBOX', limit = 10) {
  try {
    const accessToken = await obtenerAccessToken();

    const response = await fetch(
      `${ZOHO_CONFIG.apiUrl}/accounts/${process.env.ZOHO_ACCOUNT_ID}/messages?folder=${folder}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Error llegint emails: ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error llegint emails:', error);
    throw error;
  }
}

/**
 * Verificar configuració
 */
export function verificarConfiguracion() {
  const faltantes = [];

  if (!ZOHO_CONFIG.clientId) faltantes.push('ZOHO_CLIENT_ID');
  if (!ZOHO_CONFIG.clientSecret) faltantes.push('ZOHO_CLIENT_SECRET');
  if (!ZOHO_CONFIG.refreshToken) faltantes.push('ZOHO_REFRESH_TOKEN');
  if (!process.env.ZOHO_ACCOUNT_ID) faltantes.push('ZOHO_ACCOUNT_ID');

  if (faltantes.length > 0) {
    return {
      valido: false,
      faltantes
    };
  }

  return { valido: true };
}






