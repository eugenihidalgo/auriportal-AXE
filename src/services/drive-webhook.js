// src/services/drive-webhook.js
// Servicio para configurar y gestionar webhooks de Google Drive (Push Notifications)

import { obtenerClienteDrive } from './google-workspace.js';
import fetch from 'node-fetch';

/**
 * Configura un webhook (Push Notification) para una carpeta de Google Drive
 */
export async function configurarWebhookDrive(env, folderId, webhookUrl) {
  try {
    const drive = obtenerClienteDrive(env);
    
    // Obtener el channel token (identificador único para este webhook)
    const channelId = `drive-webhook-${folderId}-${Date.now()}`;
    
    // Crear el webhook usando Drive API
    const response = await drive.files.watch({
      fileId: folderId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        expiration: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 días
      }
    });
    
    console.log(`✅ [Drive Webhook] Webhook configurado para carpeta ${folderId}`);
    console.log(`   Channel ID: ${channelId}`);
    console.log(`   Resource ID: ${response.data.resourceId}`);
    
    return {
      success: true,
      channelId: response.data.id,
      resourceId: response.data.resourceId,
      expiration: response.data.expiration
    };
  } catch (error) {
    console.error('❌ [Drive Webhook] Error configurando webhook:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Detiene un webhook de Google Drive
 */
export async function detenerWebhookDrive(env, channelId, resourceId) {
  try {
    const drive = obtenerClienteDrive(env);
    
    await drive.channels.stop({
      requestBody: {
        id: channelId,
        resourceId: resourceId
      }
    });
    
    console.log(`✅ [Drive Webhook] Webhook detenido: ${channelId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ [Drive Webhook] Error deteniendo webhook:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica si hay cambios en una carpeta usando el webhook
 */
export async function procesarNotificacionWebhook(env, payload) {
  try {
    // Google Drive envía notificaciones con este formato
    const headers = payload.headers || {};
    const body = payload.body || {};
    
    // Verificar que sea una notificación válida de Google Drive
    if (headers['x-goog-resource-state'] === 'sync') {
      // Primera notificación de sincronización (ignorar)
      console.log('📡 [Drive Webhook] Notificación de sincronización recibida');
      return { success: true, tipo: 'sync' };
    }
    
    if (headers['x-goog-resource-state'] === 'update' || headers['x-goog-resource-state'] === 'change') {
      // Cambio detectado en la carpeta
      const resourceId = headers['x-goog-resource-id'];
      const channelId = headers['x-goog-channel-id'];
      const resourceState = headers['x-goog-resource-state'];
      const changed = headers['x-goog-changed'] || '';
      
      console.log(`📡 [Drive Webhook] Cambio detectado en carpeta:`);
      console.log(`   Resource ID: ${resourceId}`);
      console.log(`   Channel ID: ${channelId}`);
      console.log(`   Estado: ${resourceState}`);
      console.log(`   Cambios: ${changed}`);
      
      // Si el cambio incluye archivos nuevos o modificados
      if (changed.includes('children') || changed.includes('content')) {
        return {
          success: true,
          tipo: 'change',
          resourceId,
          channelId,
          necesitaProcesar: true
        };
      }
      
      return {
        success: true,
        tipo: 'change',
        resourceId,
        channelId,
        necesitaProcesar: false
      };
    }
    
    return { success: true, tipo: 'unknown' };
  } catch (error) {
    console.error('❌ [Drive Webhook] Error procesando notificación:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene la URL del webhook para una carpeta específica
 */
export function obtenerUrlWebhook(env, baseUrl = null) {
  const url = baseUrl || env.WEBHOOK_BASE_URL || env.SERVER_URL || 'https://controlauriportal.eugenihidalgo.work';
  return `${url}/drive-webhook`;
}

/**
 * Configura automáticamente el webhook para la carpeta "CANALIZACIONES MÍRIAM"
 */
export async function configurarWebhookCanalizaciones(env) {
  try {
    const { obtenerArchivoDrive } = await import('./google-workspace.js');
    
    // ID de la carpeta de audios
    const folderId = env.GOOGLE_DRIVE_AUDIOS_FOLDER_ID || '1HL5gG6eq0mLqifr8eqdiR_GmnHPdmECP';
    
    // Obtener la carpeta de audios
    const carpeta = await obtenerArchivoDrive(env, folderId);
    
    // Obtener URL del webhook
    const webhookUrl = obtenerUrlWebhook(env);
    
    console.log(`🔧 [Drive Webhook] Configurando webhook para carpeta: ${carpeta.name}`);
    console.log(`   URL: ${webhookUrl}`);
    
    // Configurar el webhook
    const resultado = await configurarWebhookDrive(env, carpeta.id, webhookUrl);
    
    if (resultado.success) {
      // Guardar información del webhook para poder detenerlo después
      const webhookInfo = {
        folderId: carpeta.id,
        folderName: carpeta.name,
        channelId: resultado.channelId,
        resourceId: resultado.resourceId,
        expiration: resultado.expiration,
        webhookUrl: webhookUrl,
        configuradoEn: new Date().toISOString()
      };
      
      // Guardar en archivo para referencia futura
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      
      const webhookFile = path.join(os.tmpdir(), 'aurelinportal-transcripciones', 'webhook-info.json');
      await fs.mkdir(path.dirname(webhookFile), { recursive: true });
      await fs.writeFile(webhookFile, JSON.stringify(webhookInfo, null, 2), 'utf-8');
      
      console.log(`✅ [Drive Webhook] Webhook configurado exitosamente`);
      console.log(`   Información guardada en: ${webhookFile}`);
      
      return {
        success: true,
        webhookInfo
      };
    }
    
    return resultado;
  } catch (error) {
    console.error('❌ [Drive Webhook] Error configurando webhook:', error);
    return { success: false, error: error.message };
  }
}



