// src/services/email-mailgun.js
// Servicio de email usando Mailgun (envío + recepción)

import formData from 'form-data';
import Mailgun from 'mailgun.js';
import crypto from 'crypto';

let mg = null;

/**
 * Inicializa el cliente de Mailgun
 */
function inicializarMailgun() {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    throw new Error('MAILGUN_API_KEY y MAILGUN_DOMAIN deben estar configurados en .env');
  }

  if (!mg) {
    const mailgun = new Mailgun(formData);
    mg = mailgun.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY
    });
  }

  return mg;
}

/**
 * Envía un email usando Mailgun
 * @param {string} destinatario - Email del destinatario
 * @param {string} asunto - Asunto del email
 * @param {string} texto - Cuerpo del email en texto plano
 * @param {string|null} html - Cuerpo del email en HTML (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
export async function enviarEmail(destinatario, asunto, texto, html = null) {
  try {
    const client = inicializarMailgun();
    
    const data = {
      from: process.env.EMAIL_FROM || `noreply@${process.env.MAILGUN_DOMAIN}`,
      to: destinatario,
      subject: asunto,
      text: texto,
      html: html || texto.replace(/\n/g, '<br>')
    };

    const response = await client.messages.create(process.env.MAILGUN_DOMAIN, data);
    
    console.log(`✅ Email enviado con Mailgun a ${destinatario} (ID: ${response.id})`);
    
    return {
      success: true,
      messageId: response.id,
      message: response.message
    };
  } catch (error) {
    console.error('❌ Error enviando email con Mailgun:', error);
    throw error;
  }
}

/**
 * Verifica la firma del webhook de Mailgun
 * @param {string} timestamp - Timestamp del webhook
 * @param {string} token - Token del webhook
 * @param {string} signature - Firma del webhook
 * @returns {boolean} True si la firma es válida
 */
export function verificarWebhookMailgun(timestamp, token, signature) {
  if (!process.env.MAILGUN_WEBHOOK_SECRET) {
    console.warn('⚠️  MAILGUN_WEBHOOK_SECRET no configurado, saltando verificación');
    return true; // En desarrollo, puedes saltar la verificación
  }

  const encodedToken = crypto
    .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SECRET)
    .update(timestamp.concat(token))
    .digest('hex');
  
  const isValid = encodedToken === signature;
  
  if (!isValid) {
    console.error('❌ Firma de webhook de Mailgun inválida');
  }
  
  return isValid;
}

/**
 * Parsea los datos del webhook de Mailgun
 * @param {FormData} formData - FormData del request
 * @returns {Object} Datos parseados del email
 */
export function parsearEmailInbound(formData) {
  return {
    remitente: formData.get('sender'),
    destinatario: formData.get('recipient'),
    asunto: formData.get('subject'),
    cuerpoTexto: formData.get('body-plain'),
    cuerpoHtml: formData.get('body-html'),
    messageId: formData.get('Message-Id'),
    timestamp: formData.get('timestamp'),
    signature: formData.get('signature'),
    token: formData.get('token')
  };
}






