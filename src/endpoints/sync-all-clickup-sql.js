// src/endpoints/sync-all-clickup-sql.js
// Endpoint para sincronización masiva de todos los contactos ClickUp ↔ SQL

import { CLICKUP } from "../config/config.js";
import { clickup } from "../services/clickup.js";
import { getDatabase, students } from "../../database/db.js";
import { sincronizarClickUpASQL } from "./sync-clickup-sql.js";

/**
 * Sincroniza todos los contactos desde ClickUp a SQL
 */
export default async function syncAllClickUpSQLHandler(request, env, ctx) {
  const url = new URL(request.url);
  const direccion = url.searchParams.get("direccion") || "clickup-sql"; // "clickup-sql", "sql-clickup", "bidireccional"
  
  try {
    console.log(`🔄 Iniciando sincronización masiva (${direccion})...`);
    
    // Obtener todas las tareas de ClickUp
    const tasks = await clickup.getTasks(env, CLICKUP.LIST_ID, { archived: false, page: 0 });
    console.log(`📋 Encontradas ${tasks.length} tareas en ClickUp`);
    
    const resultados = {
      total: tasks.length,
      exitosos: 0,
      fallidos: 0,
      sinEmail: 0,
      detalles: []
    };
    
    // Procesar cada tarea
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Extraer email de la tarea
      const emailField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL);
      const email = emailField ? String(emailField.value).trim() : null;
      
      if (!email) {
        resultados.sinEmail++;
        console.log(`⚠️  Tarea ${task.id} sin email, saltando...`);
        continue;
      }
      
      try {
        // Sincronizar este contacto
        const resultado = await sincronizarClickUpASQL(email, env);
        
        if (resultado.success) {
          resultados.exitosos++;
          if (resultado.cambios > 0) {
            resultados.detalles.push({
              email,
              cambios: resultado.cambios,
              estado: "actualizado"
            });
          }
        } else {
          resultados.fallidos++;
          resultados.detalles.push({
            email,
            error: resultado.error,
            estado: "error"
          });
        }
        
        // Pequeño delay para no saturar la API
        if (i < tasks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (err) {
        resultados.fallidos++;
        resultados.detalles.push({
          email,
          error: err.message,
          estado: "error"
        });
        console.error(`❌ Error sincronizando ${email}:`, err);
      }
      
      // Log de progreso cada 10 contactos
      if ((i + 1) % 10 === 0) {
        console.log(`   Progreso: ${i + 1}/${tasks.length} contactos procesados`);
      }
    }
    
    console.log(`✅ Sincronización masiva completada:`);
    console.log(`   - Exitosos: ${resultados.exitosos}`);
    console.log(`   - Fallidos: ${resultados.fallidos}`);
    console.log(`   - Sin email: ${resultados.sinEmail}`);
    
    return new Response(JSON.stringify({
      success: true,
      resultados
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (err) {
    console.error("❌ Error en sincronización masiva:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}







