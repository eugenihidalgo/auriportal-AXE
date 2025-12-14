// src/endpoints/configurar-drive-webhook.js
// Endpoint para configurar el webhook de Google Drive

import { configurarWebhookCanalizaciones } from '../services/drive-webhook.js';
import { obtenerArchivoDrive } from '../services/google-workspace.js';

/**
 * Handler para configurar el webhook de Google Drive
 */
export default async function configurarDriveWebhookHandler(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method;
  
  // Verificar password
  const password = url.searchParams.get('password');
  const passwordCorrecto = env.ADMIN_PASSWORD || 'kaketes7897';
  
  if (password !== passwordCorrecto) {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Configurar Webhook Drive - AuriPortal</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; color: #c00; }
        </style>
      </head>
      <body>
        <h1>🔒 Acceso Restringido</h1>
        <div class="error">
          <p>Se requiere contraseña para acceder a este endpoint.</p>
          <p>Usa: <code>?password=tu_contraseña</code></p>
        </div>
      </body>
      </html>
    `, {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  
  try {
    // ID de la carpeta de audios
    const folderId = env.GOOGLE_DRIVE_AUDIOS_FOLDER_ID || '1HL5gG6eq0mLqifr8eqdiR_GmnHPdmECP';
    
    // Obtener información de la carpeta de audios
    const carpeta = await obtenerArchivoDrive(env, folderId);
    
    // Configurar webhook
    const resultado = await configurarWebhookCanalizaciones(env);
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Configurar Webhook Drive - AuriPortal</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 1000px; margin: 50px auto; padding: 20px; }
          .success { background: #efe; border: 1px solid #cfc; padding: 15px; border-radius: 5px; color: #0a0; }
          .error { background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; color: #c00; }
          .info { background: #eef; border: 1px solid #ccf; padding: 15px; border-radius: 5px; color: #00a; }
          code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>🔔 Configurar Webhook de Google Drive</h1>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
    `;
    
    if (resultado.success) {
      html += `
        <div class="success">
          <h2>✅ Webhook Configurado Exitosamente</h2>
          <p><strong>Carpeta:</strong> ${carpeta.name}</p>
          <p><strong>ID de Carpeta:</strong> <code>${carpeta.id}</code></p>
          <p><strong>Channel ID:</strong> <code>${resultado.webhookInfo.channelId}</code></p>
          <p><strong>Resource ID:</strong> <code>${resultado.webhookInfo.resourceId}</code></p>
          <p><strong>URL del Webhook:</strong> <code>${resultado.webhookInfo.webhookUrl}</code></p>
          <p><strong>Expiración:</strong> ${new Date(parseInt(resultado.webhookInfo.expiration)).toLocaleString('es-ES')}</p>
        </div>
        <div class="info">
          <h3>ℹ️ Información Importante</h3>
          <ul>
            <li>El webhook expirará en <strong>7 días</strong>. Deberás renovarlo antes de que expire.</li>
            <li>Las notificaciones se recibirán en tiempo real cuando se suban archivos a la carpeta.</li>
            <li>El sistema también mantiene un polling cada 5 minutos como respaldo.</li>
            <li>Para renovar el webhook, vuelve a ejecutar este endpoint.</li>
          </ul>
        </div>
      `;
    } else {
      html += `
        <div class="error">
          <h2>❌ Error Configurando Webhook</h2>
          <p><strong>Error:</strong> ${resultado.error || 'Error desconocido'}</p>
        </div>
        <div class="info">
          <h3>ℹ️ Solución</h3>
          <p>Verifica que:</p>
          <ul>
            <li>El Service Account tenga permisos en la carpeta de Google Drive</li>
            <li>La URL del webhook sea accesible públicamente (HTTPS)</li>
            <li>Google Drive API esté habilitada en el proyecto</li>
          </ul>
        </div>
      `;
    }
    
    html += `
        <p><a href="?password=${password}">🔄 Reconfigurar</a> | 
           <a href="/transcription-process?password=${password}">📋 Ver Procesamiento</a></p>
      </body>
      </html>
    `;
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
    
  } catch (error) {
    console.error('❌ Error configurando webhook:', error);
    
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - Configurar Webhook</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 5px; color: #c00; }
        </style>
      </head>
      <body>
        <h1>❌ Error Configurando Webhook</h1>
        <div class="error">
          <p><strong>Error:</strong> ${error.message}</p>
          <pre>${error.stack}</pre>
        </div>
      </body>
      </html>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}



