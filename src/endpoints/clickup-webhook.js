// src/endpoints/clickup-webhook.js
// Webhook para recibir eventos de ClickUp y sincronizar automáticamente

import { sincronizarClickUpASQL } from "./sync-clickup-sql.js";

/**
 * Handler para webhooks de ClickUp
 * ClickUp puede enviar eventos cuando se actualiza una tarea
 */
export default async function clickupWebhookHandler(request, env, ctx) {
  try {
    const payload = await request.json();
    
    console.log("📥 Webhook recibido de ClickUp:", JSON.stringify(payload, null, 2));
    
    // ClickUp envía diferentes tipos de eventos
    // Necesitamos extraer el email de la tarea actualizada
    const event = payload.event || payload;
    const task = event.task || event;
    
    if (!task) {
      console.warn("⚠️  Webhook sin información de tarea");
      return new Response(JSON.stringify({ status: "ok", message: "No task data" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Buscar el campo de email en los custom fields
    // Importar CLICKUP config para obtener el ID del campo email
    const { CLICKUP } = await import("../config/config.js");
    const emailField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL);
    const email = emailField ? String(emailField.value).trim() : null;
    
    if (!email) {
      console.warn("⚠️  Tarea sin email, no se puede sincronizar:", task.id);
      return new Response(JSON.stringify({ status: "ok", message: "No email found" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Sincronizar automáticamente desde ClickUp a SQL
    console.log(`🔄 Sincronizando automáticamente ${email} desde ClickUp...`);
    const resultado = await sincronizarClickUpASQL(email, env);
    
    if (resultado.success) {
      console.log(`✅ Sincronización automática exitosa para ${email} (${resultado.cambios} cambios)`);
    } else {
      console.warn(`⚠️  Error en sincronización automática para ${email}:`, resultado.error);
    }
    
    return new Response(JSON.stringify({
      status: "ok",
      email,
      sincronizado: resultado.success,
      cambios: resultado.cambios || 0
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (err) {
    console.error("❌ Error procesando webhook de ClickUp:", err);
    return new Response(JSON.stringify({
      status: "error",
      error: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

