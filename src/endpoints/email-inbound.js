// src/endpoints/email-inbound.js
// Endpoint para recibir emails de Mailgun (inbound webhook)

import { verificarWebhookMailgun, parsearEmailInbound } from '../services/email-mailgun.js';
// Integración con Kajabi eliminada

/**
 * Detecta el tipo de email basado en la dirección de destino
 */
function detectarTipoEmail(destinatario) {
  if (!destinatario) return 'general';
  
  const email = destinatario.toLowerCase();
  if (email.includes('contacto@')) return 'contacto';
  if (email.includes('ventas@')) return 'ventas';
  if (email.includes('soporte@')) return 'soporte';
  if (email.includes('info@')) return 'info';
  if (email.includes('eugeni@')) return 'personal';
  return 'general';
}

/**
 * Procesa el email según su tipo
 */
async function procesarEmailPorTipo(tipo, emailData, env) {
  console.log(`   🔄 Procesando email tipo: ${tipo}`);
  
  switch (tipo) {
    case 'contacto':
      // Lógica específica para emails de contacto
      console.log('   📝 Email de contacto recibido');
      // Aquí puedes: crear tarea en ClickUp, enviar notificación, etc.
      break;
      
    case 'ventas':
      // Lógica específica para emails de ventas
      console.log('   💰 Email de ventas recibido');
      break;
      
    case 'soporte':
      // Lógica específica para emails de soporte
      console.log('   🛟 Email de soporte recibido');
      break;
      
    case 'info':
      // Lógica específica para emails de info
      console.log('   ℹ️  Email de información recibido');
      break;
      
    case 'personal':
      // Lógica específica para emails personales
      console.log('   👤 Email personal recibido');
      break;
      
    default:
      console.log('   📧 Email general recibido');
  }
  
  // Lógica común para todos los tipos
  // Integración con Kajabi eliminada
}

/**
 * Handler para recibir emails inbound de Mailgun
 * 
 * Este endpoint recibe webhooks de Mailgun cuando llega un email
 * a la dirección configurada (ej: contacto@eugenihidalgo.work)
 */
export default async function emailInboundHandler(request, env, ctx) {
  // Solo aceptar POST
  if (request.method !== 'POST') {
    return new Response('Método no permitido', { 
      status: 405,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  try {
    const formData = await request.formData();
    
    // Parsear datos del email
    const emailData = parsearEmailInbound(formData);
    
    // Verificar firma del webhook (seguridad)
    if (!verificarWebhookMailgun(emailData.timestamp, emailData.token, emailData.signature)) {
      console.error('❌ Webhook de Mailgun no verificado');
      return new Response('Unauthorized', { status: 401 });
    }

    // Detectar tipo de email desde query params o del destinatario
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') || detectarTipoEmail(emailData.destinatario);

    console.log(`📧 Email recibido de ${emailData.remitente} a ${emailData.destinatario}`);
    console.log(`   Tipo: ${tipo}`);
    console.log(`   Asunto: ${emailData.asunto}`);
    console.log(`   Message ID: ${emailData.messageId}`);

    // Integración con Kajabi eliminada
    // 2. Procesar según el tipo de email
    await procesarEmailPorTipo(tipo, emailData, env);

    // 3. Aquí puedes agregar tu lógica personalizada adicional:
    // - Guardar email en base de datos
    // - Enviar notificación
    // - Crear tarea en ClickUp
    // - etc.

    // 4. Responder a Mailgun (200 OK)
    // Mailgun espera una respuesta 200 para confirmar que recibimos el webhook
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });

  } catch (error) {
    console.error('❌ Error procesando email inbound:', error);
    return new Response('Error interno', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}




