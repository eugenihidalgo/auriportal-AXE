// src/endpoints/gmail-webhook.js
// Endpoint para recibir notificaciones push de Gmail API

import { obtenerEmail, parsearEmail } from '../services/email-gmail.js';
// Integración con Kajabi eliminada

/**
 * Handler para recibir notificaciones push de Gmail
 * 
 * Gmail envía notificaciones cuando llegan nuevos emails
 * Este endpoint procesa esas notificaciones
 */
export default async function gmailWebhookHandler(request, env, ctx) {
  // Solo aceptar POST
  if (request.method !== 'POST') {
    return new Response('Método no permitido', { 
      status: 405,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  try {
    const payload = await request.json();
    
    // Gmail envía notificaciones en formato Pub/Sub
    const message = payload.message;
    if (!message) {
      console.log('⚠️  Notificación sin mensaje, ignorando...');
      return new Response('OK', { status: 200 });
    }

    // Decodificar datos del mensaje
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8'));
    
    console.log(`📧 Notificación de Gmail recibida`);
    console.log(`   Email ID: ${data.emailAddress}`);
    console.log(`   History ID: ${data.historyId}`);

    // Obtener emails nuevos desde el último historyId
    // (En producción, deberías guardar el último historyId)
    
    // Por ahora, listamos los últimos emails
    const { listarEmails, obtenerEmail, parsearEmail } = await import('../services/email-gmail.js');
    const emails = await listarEmails(data.emailAddress, 10);
    
    for (const emailRef of emails) {
      try {
        const emailCompleto = await obtenerEmail(emailRef.id, data.emailAddress);
        const emailParseado = parsearEmail(emailCompleto);
        
        console.log(`📧 Email recibido de ${emailParseado.remitente} a ${emailParseado.destinatario}`);
        console.log(`   Asunto: ${emailParseado.asunto}`);

        // Integración con Kajabi eliminada

        // Aquí puedes agregar tu lógica personalizada:
        // - Guardar email en base de datos
        // - Crear tarea en ClickUp
        // - Enviar notificación
        // - etc.

      } catch (err) {
        console.error(`❌ Error procesando email ${emailRef.id}:`, err.message);
      }
    }

    return new Response('OK', { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });

  } catch (error) {
    console.error('❌ Error procesando webhook de Gmail:', error);
    return new Response('Error interno', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}



