// src/services/email-gmail.js
// Servicio de email usando Gmail API (Google Workspace)
// Máxima automatización posible con Cursor

import { google } from 'googleapis';

let oauth2Client = null;
let gmail = null;

/**
 * Inicializa el cliente de Gmail API
 */
function inicializarGmail() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar configurados en .env');
  }

  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
    );

    // Configurar refresh token si está disponible
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
    }
  }

  if (!gmail) {
    gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  return { oauth2Client, gmail };
}

/**
 * Obtiene una URL de autorización OAuth
 * @param {string} userId - ID del usuario (default: 'me')
 * @returns {string} URL de autorización
 */
export function obtenerUrlAutorizacion(userId = 'me') {
  const { oauth2Client } = inicializarGmail();
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
}

/**
 * Intercambia código de autorización por tokens
 * @param {string} code - Código de autorización
 * @returns {Promise<Object>} Tokens (access_token, refresh_token)
 */
export async function intercambiarCodigoPorTokens(code) {
  const { oauth2Client } = inicializarGmail();
  
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  
  return tokens;
}

/**
 * Envía un email usando Gmail API
 * @param {string} destinatario - Email del destinatario
 * @param {string} asunto - Asunto del email
 * @param {string} texto - Cuerpo del email en texto plano
 * @param {string|null} html - Cuerpo del email en HTML (opcional)
 * @param {string} remitente - Email del remitente (default: 'me')
 * @returns {Promise<Object>} Respuesta de Gmail API
 */
export async function enviarEmail(destinatario, asunto, texto, html = null, remitente = 'me') {
  try {
    const { gmail } = inicializarGmail();
    
    const email = [
      `To: ${destinatario}`,
      `From: ${remitente === 'me' ? process.env.EMAIL_FROM || 'me' : remitente}`,
      `Subject: ${asunto}`,
      `Content-Type: text/html; charset=utf-8`,
      '',
      html || texto.replace(/\n/g, '<br>')
    ].join('\n');

    // Codificar email en base64url
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: remitente,
      requestBody: {
        raw: encodedEmail
      }
    });

    console.log(`✅ Email enviado con Gmail API a ${destinatario} (ID: ${response.data.id})`);
    
    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId
    };
  } catch (error) {
    console.error('❌ Error enviando email con Gmail API:', error);
    throw error;
  }
}

/**
 * Lista emails de la bandeja de entrada
 * @param {string} userId - ID del usuario (default: 'me')
 * @param {number} maxResults - Número máximo de resultados (default: 10)
 * @param {string} query - Query de búsqueda (opcional)
 * @returns {Promise<Array>} Lista de emails
 */
export async function listarEmails(userId = 'me', maxResults = 10, query = null) {
  try {
    const { gmail } = inicializarGmail();
    
    const params = {
      userId: userId,
      maxResults: maxResults
    };

    if (query) {
      params.q = query;
    }

    const response = await gmail.users.messages.list(params);
    return response.data.messages || [];
  } catch (error) {
    console.error('❌ Error listando emails:', error);
    throw error;
  }
}

/**
 * Obtiene un email completo por su ID
 * @param {string} messageId - ID del mensaje
 * @param {string} userId - ID del usuario (default: 'me')
 * @returns {Promise<Object>} Email completo
 */
export async function obtenerEmail(messageId, userId = 'me') {
  try {
    const { gmail } = inicializarGmail();
    
    const response = await gmail.users.messages.get({
      userId: userId,
      id: messageId,
      format: 'full'
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo email:', error);
    throw error;
  }
}

/**
 * Parsea un email de Gmail API a formato legible
 * @param {Object} message - Mensaje de Gmail API
 * @returns {Object} Email parseado
 */
export function parsearEmail(message) {
  const headers = message.payload.headers || [];
  
  const getHeader = (name) => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : null;
  };

  // Extraer cuerpo del email
  let cuerpoTexto = '';
  let cuerpoHtml = '';
  
  const extraerCuerpo = (part) => {
    if (part.body && part.body.data) {
      const data = Buffer.from(part.body.data, 'base64').toString('utf-8');
      if (part.mimeType === 'text/plain') {
        cuerpoTexto += data;
      } else if (part.mimeType === 'text/html') {
        cuerpoHtml += data;
      }
    }
    
    if (part.parts) {
      part.parts.forEach(extraerCuerpo);
    }
  };
  
  extraerCuerpo(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    remitente: getHeader('from'),
    destinatario: getHeader('to'),
    asunto: getHeader('subject'),
    fecha: getHeader('date'),
    cuerpoTexto: cuerpoTexto,
    cuerpoHtml: cuerpoHtml || cuerpoTexto
  };
}

/**
 * Configura webhook (Push notifications) para recibir emails en tiempo real
 * @param {string} topicName - Nombre del topic de Pub/Sub
 * @param {string} userId - ID del usuario (default: 'me')
 * @returns {Promise<Object>} Respuesta de la API
 */
export async function configurarWebhook(topicName, userId = 'me') {
  try {
    const { gmail } = inicializarGmail();
    
    const response = await gmail.users.watch({
      userId: userId,
      requestBody: {
        topicName: topicName,
        labelIds: ['INBOX']
      }
    });

    console.log(`✅ Webhook configurado para ${userId} (expires: ${new Date(response.data.expiration).toISOString()})`);
    return response.data;
  } catch (error) {
    console.error('❌ Error configurando webhook:', error);
    throw error;
  }
}

/**
 * Detiene el webhook (Push notifications)
 * @param {string} userId - ID del usuario (default: 'me')
 * @returns {Promise<Object>} Respuesta de la API
 */
export async function detenerWebhook(userId = 'me') {
  try {
    const { gmail } = inicializarGmail();
    
    const response = await gmail.users.stop({
      userId: userId
    });

    console.log(`✅ Webhook detenido para ${userId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error deteniendo webhook:', error);
    throw error;
  }
}



