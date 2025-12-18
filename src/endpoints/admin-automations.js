// src/endpoints/admin-automations.js
// Módulo AUTOMATIZACIONES - Prototipo de sistema de automatizaciones

import { query } from '../../database/pg.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Función helper para reemplazar placeholders
async function replace(html, placeholders) {
  let output = html;
  
  // VALIDACIÓN CRÍTICA: Detectar Promises antes de reemplazar
  for (const key in placeholders) {
    let value = placeholders[key] ?? "";
    
    // DETECCIÓN DE PROMISE: Si value es una Promise, lanzar error visible
    if (value && typeof value === 'object' && typeof value.then === 'function') {
      const errorMsg = `DEBUG: PLACEHOLDER ${key} IS A PROMISE (MISSING AWAIT)`;
      console.error(`[REPLACE] ${errorMsg}`);
      value = `<div style="padding:8px;color:#fca5a5;background:#1e293b;border:2px solid #fca5a5;border-radius:4px;margin:8px;font-weight:bold;">${errorMsg}</div>`;
    }
    
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  
  return output;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplatePath = join(__dirname, '../core/html/admin/base.html');
const baseTemplate = readFileSync(baseTemplatePath, 'utf-8');

// Almacenamiento en memoria (prototipo)
// En producción, esto debería ser una tabla en PostgreSQL
let automationsStore = [
  {
    id: 1,
    name: 'Sugerir práctica después de limpieza',
    trigger_type: 'evento_energetico',
    trigger_config: { event_type: 'cleaning' },
    condition: { subject_type: 'aspecto' },
    action_type: 'sugerir_practica',
    action_config: { message: 'Has limpiado un aspecto, considera practicar' },
    enabled: true,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Alerta por sujeto sin limpiar 30 días',
    trigger_type: 'tiempo',
    trigger_config: { days: 30 },
    condition: { is_clean: false },
    action_type: 'marcar_alerta',
    action_config: { severity: 'medium' },
    enabled: true,
    created_at: new Date().toISOString()
  }
];

/**
 * Obtiene todas las automatizaciones
 */
export async function getAutomations() {
  return automationsStore;
}

/**
 * Crea una nueva automatización
 */
export async function createAutomation(data) {
  const newAutomation = {
    id: automationsStore.length > 0 
      ? Math.max(...automationsStore.map(a => a.id)) + 1 
      : 1,
    name: data.name || 'Nueva Automatización',
    trigger_type: data.trigger_type || 'evento_energetico',
    trigger_config: data.trigger_config || {},
    condition: data.condition || {},
    action_type: data.action_type || 'sugerir_practica',
    action_config: data.action_config || {},
    enabled: data.enabled !== undefined ? data.enabled : true,
    created_at: new Date().toISOString()
  };
  
  automationsStore.push(newAutomation);
  return newAutomation;
}

/**
 * Actualiza una automatización
 */
export async function updateAutomation(id, data) {
  const index = automationsStore.findIndex(a => a.id === parseInt(id));
  if (index === -1) {
    return null;
  }
  
  automationsStore[index] = {
    ...automationsStore[index],
    ...data,
    id: automationsStore[index].id // No permitir cambiar el ID
  };
  
  return automationsStore[index];
}

/**
 * Simula la ejecución de una automatización (preview)
 */
export async function simulateAutomation(automation) {
  // Esto es solo un preview, no ejecuta acciones reales
  const simulation = {
    automation_id: automation.id,
    automation_name: automation.name,
    would_trigger: true,
    would_affect: Math.floor(Math.random() * 10) + 1, // Simulado
    preview_action: getActionPreview(automation.action_type, automation.action_config),
    timestamp: new Date().toISOString()
  };
  
  return simulation;
}

function getActionPreview(actionType, config) {
  const previews = {
    sugerir_practica: `Sugeriría práctica: "${config.message || 'Mensaje por defecto'}"`,
    marcar_alerta: `Marcaría alerta con severidad: ${config.severity || 'low'}`,
    recomendar_intervencion: 'Recomendaría intervención del Master',
    registrar_nota: `Registraría nota interna: "${config.note || 'Nota automática'}"`,
    disparar_evento: `Dispararía evento simulado: ${config.event_type || 'custom'}`
  };
  
  return previews[actionType] || 'Acción desconocida';
}

/**
 * Renderiza la página principal de automatizaciones
 */
export async function renderAutomationsOverview(request, env) {
  const automations = await getAutomations();
  const enabledCount = automations.filter(a => a.enabled).length;
  const disabledCount = automations.filter(a => !a.enabled).length;
  
  const content = `
    <div class="p-6 space-y-6">
      <!-- Header con estadísticas -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Total Automatizaciones</p>
          <p class="text-3xl font-bold text-white mt-2">${automations.length}</p>
        </div>
        <div class="bg-green-900/30 border border-green-700 rounded-lg p-6">
          <p class="text-green-400 text-sm">Activas</p>
          <p class="text-3xl font-bold text-green-400 mt-2">${enabledCount}</p>
        </div>
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Inactivas</p>
          <p class="text-3xl font-bold text-slate-500 mt-2">${disabledCount}</p>
        </div>
      </div>
      
      <!-- Aviso de prototipo -->
      <div class="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
        <p class="text-yellow-200 text-sm">
          ⚠️ <strong>MODO PROTOTIPO:</strong> Las automatizaciones están en fase de desarrollo. 
          Puedes crear y configurar reglas, pero no se ejecutarán acciones reales todavía.
        </p>
      </div>
      
      <!-- Botón crear nueva -->
      <div class="flex justify-end">
        <a href="/admin/automations/new" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
          ➕ Crear Nueva Automatización
        </a>
      </div>
      
      <!-- Lista de automatizaciones -->
      <div class="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Nombre</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Trigger</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Acción</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Estado</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              ${automations.length > 0
                ? automations.map(automation => `
                  <tr class="hover:bg-slate-700/50">
                    <td class="px-6 py-4">
                      <p class="text-white font-medium">${automation.name}</p>
                    </td>
                    <td class="px-6 py-4">
                      <span class="text-slate-400 text-sm">${automation.trigger_type}</span>
                    </td>
                    <td class="px-6 py-4">
                      <span class="text-slate-400 text-sm">${automation.action_type}</span>
                    </td>
                    <td class="px-6 py-4">
                      ${automation.enabled
                        ? '<span class="px-2 py-1 bg-green-900 text-green-200 rounded text-xs">ON</span>'
                        : '<span class="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs">OFF</span>'
                      }
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex space-x-2">
                        <a href="/admin/automations/${automation.id}" class="text-indigo-400 hover:text-indigo-300 text-sm">Editar</a>
                        <button onclick="previewAutomation(${automation.id})" class="text-yellow-400 hover:text-yellow-300 text-sm">Preview</button>
                      </div>
                    </td>
                  </tr>
                `).join('')
                : `
                  <tr>
                    <td colspan="5" class="px-6 py-8 text-center text-slate-500">
                      No hay automatizaciones creadas aún
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <script>
      async function previewAutomation(id) {
        try {
          const response = await fetch(\`/admin/api/automations/\${id}/preview\`);
          const data = await response.json();
          
          if (data.success) {
            alert(\`Preview de automatización:\\n\\n\${data.preview.preview_action}\\n\\nAfectaría a: \${data.preview.would_affect} sujetos\`);
          }
        } catch (error) {
          alert('Error al obtener preview');
        }
      }
    </script>
  `;
  
  const html = await replace(baseTemplate, {
    TITLE: 'AUTOMATIZACIONES - Overview',
    CONTENT: content,
    CURRENT_PATH: '/admin/automations'
  });
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Renderiza placeholder para otras secciones de automatizaciones
 */
export async function renderAutomationsPlaceholder(sectionName, sectionTitle) {
  const content = `
    <div class="p-6">
      <div class="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
        <div class="text-6xl mb-4">🚧</div>
        <h2 class="text-2xl font-bold text-white mb-4">${sectionTitle}</h2>
        <p class="text-slate-400 mb-6">
          Esta sección está en desarrollo y estará disponible próximamente.
        </p>
        <div class="bg-yellow-900/30 border border-yellow-700 rounded p-4 inline-block">
          <p class="text-yellow-200 text-sm">
            <span class="font-semibold">Estado:</span> PROTOTIPO
          </p>
        </div>
      </div>
    </div>
  `;
  
  const html = await replace(baseTemplate, {
    TITLE: `AUTOMATIZACIONES - ${sectionTitle}`,
    CONTENT: content,
    CURRENT_PATH: `/admin/automations/${sectionName}`
  });
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

