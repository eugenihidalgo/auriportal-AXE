// src/endpoints/drive-webhook.js
// Endpoint para recibir webhooks de Google Drive (Push Notifications)

import { procesarNotificacionWebhook } from '../services/drive-webhook.js';
import { procesarTranscripciones } from '../services/whisper-transcripciones.js';

/**
 * Handler para recibir webhooks de Google Drive
 */
export default async function driveWebhookHandler(request, env, ctx) {
  const method = request.method;
  
  // Google Drive envía notificaciones con método POST
  if (method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }
  
  try {
    // Obtener headers de la notificación
    const headers = {};
    for (const [key, value] of request.headers.entries()) {
      headers[key.toLowerCase()] = value;
    }
    
    // Obtener body si existe
    let body = null;
    try {
      body = await request.text();
    } catch (e) {
      // Body puede estar vacío
    }
    
    const payload = {
      headers,
      body: body ? JSON.parse(body) : null
    };
    
    console.log(`📡 [Drive Webhook] Notificación recibida de Google Drive`);
    console.log(`   Headers:`, JSON.stringify(headers, null, 2));
    
    // Procesar la notificación
    const resultado = await procesarNotificacionWebhook(env, payload);
    
    if (!resultado.success) {
      console.error('❌ [Drive Webhook] Error procesando notificación:', resultado.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: resultado.error 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Si es una notificación de cambio y necesita procesar
    if (resultado.tipo === 'change' && resultado.necesitaProcesar) {
      console.log(`🔄 [Drive Webhook] Procesando archivos nuevos...`);
      
      // Procesar archivos nuevos en background (no bloquear la respuesta)
      procesarTranscripciones(env).catch(err => {
        console.error('❌ [Drive Webhook] Error procesando archivos:', err);
      });
    }
    
    // Responder a Google Drive (debe ser 200 OK)
    return new Response(JSON.stringify({ 
      success: true,
      tipo: resultado.tipo,
      mensaje: 'Notificación recibida correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ [Drive Webhook] Error en handler:', error);
    
    // Google Drive requiere una respuesta 200 incluso en caso de error
    // para no reintentar la notificación
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



