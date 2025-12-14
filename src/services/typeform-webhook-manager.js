// src/services/typeform-webhook-manager.js
// Servicio para crear y gestionar webhooks de Typeform automáticamente

const TYPEFORM_API_BASE = 'https://api.typeform.com';

/**
 * Crea un webhook en Typeform para un formulario específico
 * @param {string} formId - ID del formulario de Typeform
 * @param {string} webhookUrl - URL del webhook donde Typeform enviará los datos
 * @param {string} tag - Tag único para identificar el aspecto
 * @param {string} apiToken - Token de API de Typeform
 * @returns {Promise<Object>} Información del webhook creado
 */
export async function crearWebhookTypeform(formId, webhookUrl, tag, apiToken) {
  if (!apiToken) {
    throw new Error('TYPEFORM_API_TOKEN no configurado');
  }

  try {
    // Primero, obtener webhooks existentes para verificar si ya existe
    const existingWebhooks = await obtenerWebhooksTypeform(formId, apiToken);
    
    // Buscar si ya existe un webhook con el mismo tag
    const existingWebhook = existingWebhooks.find(wh => wh.tag === tag);
    if (existingWebhook) {
      console.log(`✅ Webhook ya existe para tag ${tag}: ${existingWebhook.id}`);
      return {
        id: existingWebhook.id,
        url: existingWebhook.url,
        tag: existingWebhook.tag,
        formId: formId,
        status: 'existing'
      };
    }

    // Crear nuevo webhook
    const response = await fetch(`${TYPEFORM_API_BASE}/forms/${formId}/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        enabled: true,
        tag: tag,
        secret: generateWebhookSecret()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creando webhook: ${response.status} - ${errorText}`);
    }

    const webhookData = await response.json();
    console.log(`✅ Webhook creado para tag ${tag}: ${webhookData.id}`);

    return {
      id: webhookData.id,
      url: webhookData.url,
      tag: webhookData.tag || tag,
      formId: formId,
      status: 'created'
    };
  } catch (error) {
    console.error('❌ Error creando webhook de Typeform:', error);
    throw error;
  }
}

/**
 * Obtiene todos los webhooks de un formulario de Typeform
 */
async function obtenerWebhooksTypeform(formId, apiToken) {
  try {
    const response = await fetch(`${TYPEFORM_API_BASE}/forms/${formId}/webhooks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error obteniendo webhooks: ${response.status}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error obteniendo webhooks:', error);
    return [];
  }
}

/**
 * Genera un secreto único para el webhook
 */
function generateWebhookSecret() {
  return `auriportal_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Genera una URL única para el webhook de un aspecto
 * @param {number} aspectoId - ID del aspecto
 * @param {string} aspectoNombre - Nombre del aspecto (normalizado)
 * @param {string} baseUrl - URL base del servidor (ej: https://webhook-typeform.pdeeugenihidalgo.org)
 * @returns {string} URL del webhook
 */
export function generarUrlWebhookAspecto(aspectoId, aspectoNombre, baseUrl) {
  // Normalizar nombre del aspecto para URL
  const nombreNormalizado = aspectoNombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9]+/g, '-') // Reemplazar espacios y caracteres especiales con guiones
    .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio y final

  // Crear URL única: /typeform-webhook/aspecto/{id}-{nombre}
  const webhookPath = `/typeform-webhook/aspecto/${aspectoId}-${nombreNormalizado}`;
  return `${baseUrl}${webhookPath}`;
}

/**
 * Extrae el ID del aspecto desde la URL del webhook
 * @param {string} webhookUrl - URL del webhook
 * @returns {number|null} ID del aspecto o null si no se puede extraer
 */
export function extraerAspectoIdDesdeUrl(webhookUrl) {
  const match = webhookUrl.match(/\/aspecto\/(\d+)-/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Verifica que un webhook de Typeform esté funcionando correctamente
 * @param {string} formId - ID del formulario
 * @param {string} webhookId - ID del webhook
 * @param {string} apiToken - Token de API
 * @returns {Promise<boolean>} true si el webhook está activo
 */
export async function verificarWebhookTypeform(formId, webhookId, apiToken) {
  try {
    const response = await fetch(`${TYPEFORM_API_BASE}/forms/${formId}/webhooks/${webhookId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return false;
    }

    const webhook = await response.json();
    return webhook.enabled === true;
  } catch (error) {
    console.error('Error verificando webhook:', error);
    return false;
  }
}

