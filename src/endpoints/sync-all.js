// src/endpoints/sync-all.js
// Endpoint para sincronizar todos los contactos de ClickUp
// NOTA: Integración con Kajabi eliminada

import { CLICKUP } from "../config/config.js";
import { actualizarNivelSiNecesario } from "../modules/nivel.js";
import { findStudentByEmail } from "../modules/student.js";
import { clickup } from "../services/clickup.js";
import { sincronizarListaPrincipalAurelin } from "../services/clickup-sync-listas.js";

/**
 * Obtiene todas las tareas de ClickUp
 */
async function obtenerTodasLasTareas(env) {
  const tasks = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const pageTasks = await clickup.getTasks(env, CLICKUP.LIST_ID, { page, archived: false });
      
      if (pageTasks.length === 0) {
        hasMore = false;
      } else {
        tasks.push(...pageTasks);
        page++;
        
        if (pageTasks.length < 100) {
          hasMore = false;
        }
      }
    } catch (err) {
      console.error(`Error obteniendo tareas (página ${page}):`, err);
      break;
    }
  }

  return tasks;
}

/**
 * Extrae el email de una tarea de ClickUp
 */
function extraerEmailDeTarea(task) {
  if (!task.custom_fields) return null;
  
  const emailField = task.custom_fields.find(
    cf => cf.id === CLICKUP.CF_EMAIL
  );
  
  return emailField?.value || null;
}

export default async function syncAllHandler(request, env, ctx) {
  console.log("🔄 Iniciando sincronización masiva de ClickUp...");
  
  // Solo aceptar GET o POST
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(
      `Método no permitido. Este endpoint solo acepta GET o POST. Método recibido: ${request.method}`,
      { 
        status: 405,
        headers: { "Content-Type": "text/plain" }
      }
    );
  }

  try {
    // Obtener todas las tareas de ClickUp
    console.log("📋 Obteniendo todas las tareas de ClickUp...");
    const tasks = await obtenerTodasLasTareas(env);
    console.log(`✅ Encontradas ${tasks.length} tareas en ClickUp`);

    const resultados = {
      total: tasks.length,
      procesadas: 0,
      sincronizadas: 0,
      sinEmail: 0,
      errores: 0,
      detalles: []
    };

    // Procesar cada tarea
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      let email = extraerEmailDeTarea(task);

      if (!email) {
        resultados.sinEmail++;
        resultados.detalles.push({
          tarea: task.id,
          nombre: task.name || "Sin nombre",
          email: null,
          estado: "sin_email"
        });
        continue;
      }

      // Normalizar email
      email = email.trim().toLowerCase();
      console.log(`\n[${i + 1}/${tasks.length}] Procesando: ${email} (normalizado)`);

      try {
        // Integración con Kajabi eliminada - solo sincronizar Lista Principal
        resultados.sincronizadas++;
        resultados.detalles.push({
          tarea: task.id,
          nombre: task.name || "Sin nombre",
          email,
          estado: "sincronizado",
          camposActualizados: 0
        });
        
        // Sincronizar en Lista 2 (Principal Aurelín)
        try {
          await sincronizarListaPrincipalAurelin(email, env);
          console.log(`   ✅ Lista Principal sincronizada para ${email}`);
        } catch (lista2Err) {
          console.warn(`   ⚠️  Error sincronizando Lista Principal para ${email}:`, lista2Err.message);
        }

        resultados.procesadas++;

        // Pequeña pausa para no sobrecargar las APIs
        if (i < tasks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (err) {
        resultados.errores++;
        console.error(`   ❌ Error procesando ${email}:`, err);
        resultados.detalles.push({
          tarea: task.id,
          nombre: task.name || "Sin nombre",
          email,
          estado: "error",
          error: err.message
        });
      }
    }

    // Generar resumen HTML
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sincronización Completa</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at top, #fff5e1, #f5ecff);
      min-height: 100vh;
      padding: 20px;
      margin: 0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 24px;
      box-shadow: 0 18px 45px rgba(0,0,0,0.12);
      padding: 32px;
    }
    h1 {
      color: #4a2c00;
      margin-bottom: 24px;
      text-align: center;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: linear-gradient(135deg, #fff5e1 0%, #f5ecff 100%);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }
    .stat-number {
      font-size: 2.5rem;
      font-weight: bold;
      color: #4a2c00;
      margin-bottom: 8px;
    }
    .stat-label {
      color: #6e4b00;
      font-size: 0.9rem;
    }
    .details {
      margin-top: 32px;
    }
    .details h2 {
      color: #4a2c00;
      margin-bottom: 16px;
    }
    .detail-item {
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 8px;
      border-left: 4px solid #ddd;
      background: #f9f9f9;
    }
    .detail-item.sin-email { border-left-color: #ffa500; }
    .detail-item.sin-datos { border-left-color: #ff6b6b; }
    .detail-item.sincronizado { border-left-color: #51cf66; }
    .detail-item.error { border-left-color: #ff0000; }
    .detail-email {
      font-weight: bold;
      color: #4a2c00;
    }
    .detail-nombre {
      color: #6e4b00;
      font-size: 0.9rem;
    }
    .detail-estado {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
      margin-top: 4px;
    }
    .estado-sin-email { background: #ffe0b2; color: #e65100; }
    .estado-sin-datos { background: #ffcdd2; color: #c62828; }
    .estado-sincronizado { background: #c8e6c9; color: #2e7d32; }
    .estado-error { background: #ffcdd2; color: #c62828; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔄 Sincronización Completa</h1>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-number">${resultados.total}</div>
        <div class="stat-label">Total de tareas</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${resultados.procesadas}</div>
        <div class="stat-label">Procesadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${resultados.sincronizadas}</div>
        <div class="stat-label">Sincronizadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${resultados.sinEmail}</div>
        <div class="stat-label">Sin email</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${resultados.errores}</div>
        <div class="stat-label">Errores</div>
      </div>
    </div>

    <div class="details">
      <h2>Detalles de la sincronización</h2>
      ${resultados.detalles.map(d => `
        <div class="detail-item ${d.estado}">
          <div class="detail-nombre">${d.nombre}</div>
          ${d.email ? `<div class="detail-email">${d.email}</div>` : ''}
          <div>
            <span class="detail-estado estado-${d.estado}">
              ${d.estado === 'sin_email' ? '⚠️ Sin email' : ''}
              ${d.estado === 'sincronizado' ? `✅ Sincronizado (${d.camposActualizados} campos)` : ''}
              ${d.estado === 'error' ? `❌ Error: ${d.error || 'Desconocido'}` : ''}
            </span>
            ${d.fechaInscripcionActualizada ? '<span style="margin-left: 8px;">📅 Fecha actualizada</span>' : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

    console.log("\n✅ Sincronización masiva completada:");
    console.log(`   Total: ${resultados.total}`);
    console.log(`   Procesadas: ${resultados.procesadas}`);
    console.log(`   Sincronizadas: ${resultados.sincronizadas}`);
    console.log(`   Sin email: ${resultados.sinEmail}`);
    console.log(`   Errores: ${resultados.errores}`);

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });

  } catch (err) {
    console.error("❌ Error en sincronización masiva:", err);
    return new Response(
      `Error en sincronización masiva: ${err.message}`,
      {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      }
    );
  }
}

