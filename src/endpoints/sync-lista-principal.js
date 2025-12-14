// src/endpoints/sync-lista-principal.js
// Endpoint para sincronizar la Lista Principal Aurelín (Lista 2)

import { CLICKUP } from "../config/config.js";
import { clickup } from "../services/clickup.js";
import { sincronizarListaPrincipalAurelin, sincronizarMultiplesListaPrincipal } from "../services/clickup-sync-listas.js";

const LISTA_PRINCIPAL = "901214375878"; // Lista Principal Aurelín

/**
 * Obtiene todas las tareas de la Lista Principal
 */
async function obtenerTodasLasTareasListaPrincipal(env) {
  const tasks = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const pageTasks = await clickup.getTasks(env, LISTA_PRINCIPAL, { page, archived: false });
      
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

export default async function syncListaPrincipalHandler(request, env, ctx) {
  console.log("🔄 Iniciando sincronización de Lista Principal Aurelín...");
  
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
    // Obtener todas las tareas de la Lista Principal
    console.log("📋 Obteniendo todas las tareas de la Lista Principal...");
    const tasks = await obtenerTodasLasTareasListaPrincipal(env);
    console.log(`✅ Encontradas ${tasks.length} tareas en la Lista Principal`);

    const resultados = {
      total: tasks.length,
      procesadas: 0,
      sincronizadas: 0,
      creadas: 0,
      actualizadas: 0,
      sinEmail: 0,
      errores: 0,
      detalles: []
    };

    // Extraer emails de las tareas
    const emails = tasks
      .map(task => {
        const email = extraerEmailDeTarea(task);
        return email ? email.trim().toLowerCase() : null;
      })
      .filter(email => email !== null);

    console.log(`📧 Encontrados ${emails.length} emails válidos de ${tasks.length} tareas`);

    // Sincronizar múltiples emails
    const syncResultados = await sincronizarMultiplesListaPrincipal(emails, env, {
      delay: 200 // 200ms entre cada sincronización
    });

    resultados.procesadas = syncResultados.total;
    resultados.exitosos = syncResultados.exitosos;
    resultados.fallidos = syncResultados.fallidos;
    resultados.creadas = syncResultados.creados;
    resultados.actualizadas = syncResultados.actualizados;
    resultados.errores = syncResultados.fallidos;
    resultados.detalles = syncResultados.errores.map(e => ({
      email: e.email,
      estado: "error",
      error: e.error
    }));

    // Generar resumen HTML
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sincronización Lista Principal</title>
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
    .detail-item.error { border-left-color: #ff6b6b; }
    .detail-item.sincronizado { border-left-color: #51cf66; }
    .detail-email {
      font-weight: bold;
      color: #4a2c00;
    }
    .detail-estado {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
      margin-top: 4px;
    }
    .estado-error { background: #ffcdd2; color: #c62828; }
    .estado-sincronizado { background: #c8e6c9; color: #2e7d32; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔄 Sincronización Lista Principal Completada</h1>
    
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
        <div class="stat-number">${resultados.exitosos}</div>
        <div class="stat-label">Exitosas</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${resultados.creadas}</div>
        <div class="stat-label">Creadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${resultados.actualizadas}</div>
        <div class="stat-label">Actualizadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${resultados.errores}</div>
        <div class="stat-label">Errores</div>
      </div>
    </div>

    ${resultados.detalles.length > 0 ? `
    <div class="details">
      <h2>Detalles de errores</h2>
      ${resultados.detalles.map(d => `
        <div class="detail-item ${d.estado}">
          <div class="detail-email">${d.email}</div>
          <div>
            <span class="detail-estado estado-${d.estado}">
              ${d.estado === 'error' ? `❌ Error: ${d.error || 'Desconocido'}` : '✅ Sincronizado'}
            </span>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    <div style="margin-top: 32px; padding: 20px; background: #f0f0f0; border-radius: 8px; text-align: center;">
      <p style="color: #666; margin: 0;">
        Sincronización completada el ${new Date().toLocaleString('es-ES')}
      </p>
      <p style="margin-top: 10px;">
        <a href="/admin" style="color: #667eea; text-decoration: none;">← Volver al Panel de Control</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    console.log("\n✅ Sincronización Lista Principal completada:");
    console.log(`   Total: ${resultados.total}`);
    console.log(`   Procesadas: ${resultados.procesadas}`);
    console.log(`   Exitosas: ${resultados.exitosos}`);
    console.log(`   Creadas: ${resultados.creadas}`);
    console.log(`   Actualizadas: ${resultados.actualizadas}`);
    console.log(`   Errores: ${resultados.errores}`);

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });

  } catch (err) {
    console.error("❌ Error en sincronización Lista Principal:", err);
    return new Response(
      `Error en sincronización Lista Principal: ${err.message}`,
      {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      }
    );
  }
}








