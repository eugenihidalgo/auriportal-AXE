// src/endpoints/admin-comunicacion-directa.js
// Comunicación Directa: Envío rápido de mensajes a alumnos activos

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../../database/pg.js';
import { validarSuscripcionActiva } from '../services/notas-master.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar templates
const baseTemplatePath = join(__dirname, '../core/html/admin/base.html');
const baseTemplate = readFileSync(baseTemplatePath, 'utf-8');

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderizar vista de Comunicación Directa
 */
export async function renderComunicacionDirecta(request, env) {
  try {
    // Obtener todos los alumnos activos
    const todosAlumnos = await query(
      `SELECT a.id, a.email, a.apodo, a.nombre_completo, a.nivel_actual,
              COALESCE(nf.fase, 'sanación') as fase
       FROM alumnos a
       LEFT JOIN niveles_fases nf ON (
         (nf.nivel_min IS NULL OR a.nivel_actual >= nf.nivel_min) 
         AND (nf.nivel_max IS NULL OR a.nivel_actual <= nf.nivel_max)
       )
       WHERE a.estado_suscripcion = 'activa'
       ORDER BY a.nivel_actual DESC, a.apodo ASC`,
      []
    );
    
    const alumnos = todosAlumnos.rows;
    
    // Generar HTML de la lista de alumnos
    let alumnosHTML = '';
    if (alumnos.length === 0) {
      alumnosHTML = '<div class="text-center py-8 text-slate-400">No hay alumnos activos</div>';
    } else {
      alumnosHTML = alumnos.map(alumno => {
        const nombre = alumno.nombre_completo || alumno.apodo || alumno.email;
        const apodo = alumno.apodo || 'Sin apodo';
        const nivel = alumno.nivel_actual || 1;
        const fase = alumno.fase || 'sanación';
        
        return `
          <div class="alumno-row bg-slate-700 rounded-lg p-4 mb-3" data-alumno-id="${alumno.id}">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <div class="text-white font-semibold text-lg">${nombre}</div>
                  <div class="text-slate-400 text-sm">(${apodo})</div>
                </div>
                <div class="flex items-center gap-4 text-sm text-slate-300">
                  <span class="flex items-center gap-1">
                    <span class="text-indigo-400">⭐</span>
                    Nivel ${nivel}
                  </span>
                  <span class="flex items-center gap-1">
                    <span class="text-purple-400">🔑</span>
                    ${fase}
                  </span>
                </div>
              </div>
              <div class="w-96 ml-4">
                <textarea 
                  class="mensaje-input w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  rows="3"
                  placeholder="Escribe un mensaje para ${nombre}..."
                  data-alumno-id="${alumno.id}"
                ></textarea>
                <button 
                  onclick="enviarMensaje(${alumno.id}, this)"
                  class="mt-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors font-medium">
                  📤 Enviar
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
    
    const content = `
      <div class="p-6">
        <h1 class="text-3xl font-bold text-white mb-6">💬 Comunicación Directa</h1>
        <p class="text-slate-400 mb-6">Envía mensajes rápidos a todos los alumnos activos. Los mensajes aparecerán en el apartado personal de comunicados de cada alumno.</p>
        
        <div class="bg-slate-800 rounded-lg p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xl font-semibold text-white">Alumnos Activos (${alumnos.length})</h2>
            <button 
              onclick="enviarTodosMensajes()"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium">
              📤 Enviar Todos
            </button>
          </div>
          
          <div id="lista-alumnos" class="space-y-3">
            ${alumnosHTML}
          </div>
        </div>
      </div>
      
      <script>
        async function enviarMensaje(alumnoId, button) {
          const row = button.closest('.alumno-row');
          const textarea = row.querySelector('.mensaje-input');
          const mensaje = textarea.value.trim();
          
          if (!mensaje) {
            alert('Por favor, escribe un mensaje');
            return;
          }
          
          const originalText = button.textContent;
          button.disabled = true;
          button.textContent = '⏳ Enviando...';
          
          try {
            const response = await fetch(\`/admin/comunicacion-directa/enviar\`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                alumno_id: alumnoId,
                mensaje: mensaje
              })
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
              throw new Error(errorData.error || 'Error al enviar mensaje');
            }
            
            const data = await response.json();
            
            // Mostrar éxito
            button.textContent = '✅ Enviado';
            button.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            button.classList.add('bg-green-600');
            textarea.value = '';
            
            // Restaurar después de 2 segundos
            setTimeout(() => {
              button.textContent = originalText;
              button.disabled = false;
              button.classList.remove('bg-green-600');
              button.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            }, 2000);
            
          } catch (error) {
            console.error('Error enviando mensaje:', error);
            alert('❌ Error al enviar: ' + error.message);
            button.disabled = false;
            button.textContent = originalText;
          }
        }
        
        async function enviarTodosMensajes() {
          const rows = document.querySelectorAll('.alumno-row');
          const mensajes = [];
          
          rows.forEach(row => {
            const textarea = row.querySelector('.mensaje-input');
            const mensaje = textarea.value.trim();
            const alumnoId = parseInt(row.dataset.alumnoId);
            
            if (mensaje && alumnoId) {
              mensajes.push({ alumno_id: alumnoId, mensaje });
            }
          });
          
          if (mensajes.length === 0) {
            alert('No hay mensajes para enviar');
            return;
          }
          
          if (!confirm(\`¿Enviar \${mensajes.length} mensaje(s)?\`)) {
            return;
          }
          
          const button = event.target;
          const originalText = button.textContent;
          button.disabled = true;
          button.textContent = '⏳ Enviando...';
          
          try {
            const response = await fetch(\`/admin/comunicacion-directa/enviar-multiple\`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ mensajes })
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
              throw new Error(errorData.error || 'Error al enviar mensajes');
            }
            
            const data = await response.json();
            
            // Mostrar éxito
            button.textContent = \`✅ \${data.enviados} enviados\`;
            button.classList.remove('bg-green-600', 'hover:bg-green-700');
            button.classList.add('bg-green-700');
            
            // Limpiar todos los textareas
            rows.forEach(row => {
              const textarea = row.querySelector('.mensaje-input');
              textarea.value = '';
            });
            
            // Restaurar después de 3 segundos
            setTimeout(() => {
              button.textContent = originalText;
              button.disabled = false;
              button.classList.remove('bg-green-700');
              button.classList.add('bg-green-600', 'hover:bg-green-700');
            }, 3000);
            
          } catch (error) {
            console.error('Error enviando mensajes:', error);
            alert('❌ Error al enviar: ' + error.message);
            button.disabled = false;
            button.textContent = originalText;
          }
        }
        
        // Hacer funciones globales
        window.enviarMensaje = enviarMensaje;
        window.enviarTodosMensajes = enviarTodosMensajes;
      </script>
    `;
    
    return new Response(
      replace(baseTemplate, {
        TITLE: 'Comunicación Directa',
        CONTENT: content
      }),
      {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      }
    );
  } catch (error) {
    console.error('❌ Error en renderComunicacionDirecta:', error);
    return new Response(
      `Error interno del servidor: ${error.message}`,
      { status: 500 }
    );
  }
}

/**
 * POST /admin/comunicacion-directa/enviar - Enviar un mensaje a un alumno
 */
export async function enviarMensaje(request, env) {
  try {
    const body = await request.json();
    const { alumno_id, mensaje } = body;
    
    if (!alumno_id || !mensaje || !mensaje.trim()) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos requeridos' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Validar suscripción activa
    const esActivo = await validarSuscripcionActiva(alumno_id);
    if (!esActivo) {
      return new Response(
        JSON.stringify({ error: 'Alumno no tiene suscripción activa' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Crear o actualizar tabla de comunicados si no existe
    await query(`
      CREATE TABLE IF NOT EXISTS comunicados_eugeni (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        mensaje TEXT NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        creado_por VARCHAR(100) DEFAULT 'Eugeni',
        leido BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_comunicados_alumno ON comunicados_eugeni(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_comunicados_fecha ON comunicados_eugeni(fecha DESC);
    `).catch(() => {}); // Ignorar si ya existe
    
    // Insertar mensaje
    await query(
      `INSERT INTO comunicados_eugeni (alumno_id, mensaje, creado_por)
       VALUES ($1, $2, 'Eugeni')`,
      [alumno_id, mensaje.trim()]
    );
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensaje enviado correctamente' 
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en enviarMensaje:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * POST /admin/comunicacion-directa/enviar-multiple - Enviar múltiples mensajes
 */
export async function enviarMensajesMultiple(request, env) {
  try {
    const body = await request.json();
    const { mensajes } = body;
    
    if (!mensajes || !Array.isArray(mensajes) || mensajes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay mensajes para enviar' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Crear o actualizar tabla de comunicados si no existe
    await query(`
      CREATE TABLE IF NOT EXISTS comunicados_eugeni (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        mensaje TEXT NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        creado_por VARCHAR(100) DEFAULT 'Eugeni',
        leido BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_comunicados_alumno ON comunicados_eugeni(alumno_id);
      CREATE INDEX IF NOT EXISTS idx_comunicados_fecha ON comunicados_eugeni(fecha DESC);
    `).catch(() => {}); // Ignorar si ya existe
    
    let enviados = 0;
    const errores = [];
    
    for (const { alumno_id, mensaje } of mensajes) {
      try {
        // Validar suscripción activa
        const esActivo = await validarSuscripcionActiva(alumno_id);
        if (!esActivo) {
          errores.push({ alumno_id, error: 'Suscripción no activa' });
          continue;
        }
        
        // Insertar mensaje
        await query(
          `INSERT INTO comunicados_eugeni (alumno_id, mensaje, creado_por)
           VALUES ($1, $2, 'Eugeni')`,
          [alumno_id, mensaje.trim()]
        );
        
        enviados++;
      } catch (error) {
        errores.push({ alumno_id, error: error.message });
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        enviados,
        errores: errores.length > 0 ? errores : undefined
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en enviarMensajesMultiple:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

