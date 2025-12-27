// src/endpoints/admin-niveles-energeticos.js
// Gestión de Niveles Energéticos (Fases y Rangos)

import { query } from '../../database/pg.js';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { validateAndNormalizeNivelesEnergeticos } from '../core/config/niveles-energeticos.schema.js';

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
 * GET /admin/niveles-energeticos - Vista de gestión de niveles
 * POST /admin/niveles-energeticos - Actualizar niveles
 */
export async function renderNivelesEnergeticos(request, env) {
  try {
    // Verificar autenticación
    const authCheck = requireAdminAuth(request);
    if (authCheck.requiresAuth) {
      return authCheck.response;
    }

    if (request.method === 'POST') {
      return await handleUpdateNiveles(request, env);
    }

    // Obtener todos los niveles
    const nivelesResult = await query(`
      SELECT * FROM niveles_fases 
      ORDER BY 
        CASE WHEN nivel_min IS NULL THEN 999 ELSE nivel_min END ASC,
        CASE WHEN nivel_max IS NULL THEN 999 ELSE nivel_max END ASC
    `);
    
    const niveles = nivelesResult.rows || [];
    
    // Validar configuración actual
    const validationResult = validateAndNormalizeNivelesEnergeticos(niveles);
    
    // Preparar datos para la UI
    const validationStatus = {
      ok: validationResult.ok,
      errors: validationResult.errors || []
    };
    
    // Si la config es válida, usar la versión normalizada (mejor orden)
    const nivelesParaUI = validationResult.ok && validationResult.value 
      ? validationResult.value 
      : niveles;

    const content = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h1 class="text-3xl font-bold text-white">⚡ Niveles Energéticos (Progreso V4)</h1>
          <button onclick="agregarNuevoNivel()" 
                  class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            ➕ Agregar Nueva Fase
          </button>
        </div>
        
        <!-- Estado de Validación -->
        <div class="bg-slate-800 rounded-lg p-4 ${validationStatus.ok ? 'border border-green-500' : 'border border-red-500'}">
          <div class="flex items-center gap-3">
            ${validationStatus.ok 
              ? '<span class="text-2xl">✅</span><span class="text-green-400 font-semibold">Configuración válida</span>' 
              : '<span class="text-2xl">❌</span><span class="text-red-400 font-semibold">Configuración inválida</span>'
            }
          </div>
          ${validationStatus.errors.length > 0 ? `
            <div class="mt-3 space-y-1">
              <p class="text-sm font-medium text-slate-300 mb-2">Errores encontrados:</p>
              <ul class="list-disc list-inside space-y-1">
                ${validationStatus.errors.map(err => `<li class="text-sm text-red-300">${err}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <div class="bg-slate-800 rounded-lg p-6">
          <p class="text-slate-300 mb-4">
            Gestiona los rangos de niveles y sus fases. Define desde qué nivel hasta qué nivel corresponde cada fase (Sanación, Sanación Avanzada, Canalización, Creación, etc.).
            <strong class="text-yellow-400"> Esta configuración es el single source of truth para fase_efectiva en el motor de progreso V4.</strong>
          </p>

          <div id="niveles-container" class="space-y-4">
            ${nivelesParaUI.map((nivel, index) => `
              <div class="bg-slate-700 rounded-lg p-4 nivel-item" data-id="${nivel.id}">
                <div class="grid grid-cols-12 gap-4 items-center">
                  <div class="col-span-3">
                    <label class="block text-sm font-medium text-slate-300 mb-1">Fase</label>
                    <input type="text" 
                           name="fase_${nivel.id}" 
                           value="${nivel.fase || ''}" 
                           class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                           required>
                  </div>
                  <div class="col-span-2">
                    <label class="block text-sm font-medium text-slate-300 mb-1">Nivel Mín</label>
                    <input type="number" 
                           name="nivel_min_${nivel.id}" 
                           value="${nivel.nivel_min || ''}" 
                           class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                           placeholder="Ej: 1">
                  </div>
                  <div class="col-span-2">
                    <label class="block text-sm font-medium text-slate-300 mb-1">Nivel Máx</label>
                    <input type="number" 
                           name="nivel_max_${nivel.id}" 
                           value="${nivel.nivel_max || ''}" 
                           class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                           placeholder="Ej: 6">
                  </div>
                  <div class="col-span-4">
                    <label class="block text-sm font-medium text-slate-300 mb-1">Descripción</label>
                    <input type="text" 
                           name="descripcion_${nivel.id}" 
                           value="${nivel.descripcion || ''}" 
                           class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                           placeholder="Ej: Sanación Experto">
                  </div>
                  <div class="col-span-1 flex justify-end">
                    <button onclick="eliminarNivel(${nivel.id})" 
                            class="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 transition-colors">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button id="btn-guardar" 
                    onclick="guardarNiveles()" 
                    ${validationStatus.ok ? '' : 'disabled'}
                    class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium ${validationStatus.ok ? '' : 'opacity-50 cursor-not-allowed'}">
              💾 Guardar Cambios
            </button>
          </div>
          ${!validationStatus.ok ? `
            <div class="mt-3 p-3 bg-red-900/30 border border-red-500 rounded text-sm text-red-300">
              ⚠️ No se puede guardar una configuración inválida. Por favor, corrige los errores antes de guardar.
            </div>
          ` : ''}
        </div>
      </div>

      <script>
        // Estado de validación (se actualiza dinámicamente)
        let validationState = ${JSON.stringify(validationStatus)};
        
        // Función para validar configuración en el cliente (simplificada)
        function validarConfiguracion() {
          const items = document.querySelectorAll('.nivel-item');
          const niveles = [];
          
          items.forEach(item => {
            const fase = item.querySelector('[name^="fase_"]').value.trim();
            const nivelMin = item.querySelector('[name^="nivel_min_"]').value;
            const nivelMax = item.querySelector('[name^="nivel_max_"]').value;
            
            if (fase) {
              niveles.push({
                fase,
                nivel_min: nivelMin ? parseInt(nivelMin) : null,
                nivel_max: nivelMax ? parseInt(nivelMax) : null
              });
            }
          });
          
          // Validación básica en cliente (validación completa en servidor)
          const errores = [];
          
          niveles.forEach((nivel, idx) => {
            if (!nivel.fase || nivel.fase.trim() === '') {
              errores.push(`Fase ${idx + 1}: 'fase' es obligatorio`);
            }
            if (nivel.nivel_min !== null && nivel.nivel_max !== null && nivel.nivel_max < nivel.nivel_min) {
              errores.push(`Fase ${idx + 1} (${nivel.fase}): nivel_max debe ser >= nivel_min`);
            }
          });
          
          return { ok: errores.length === 0, errors: errores };
        }
        
        // Actualizar estado de validación visual
        function actualizarEstadoValidacion() {
          const validationResult = validarConfiguracion();
          const btnGuardar = document.getElementById('btn-guardar');
          
          if (validationResult.ok) {
            btnGuardar.disabled = false;
            btnGuardar.classList.remove('opacity-50', 'cursor-not-allowed');
          } else {
            btnGuardar.disabled = true;
            btnGuardar.classList.add('opacity-50', 'cursor-not-allowed');
          }
        }
        
        // Añadir listeners a todos los inputs para validación en tiempo real
        document.addEventListener('DOMContentLoaded', function() {
          const container = document.getElementById('niveles-container');
          if (container) {
            // Validar al cambiar cualquier campo
            container.addEventListener('input', actualizarEstadoValidacion);
            container.addEventListener('change', actualizarEstadoValidacion);
          }
        });
        
        function agregarNuevoNivel() {
          const container = document.getElementById('niveles-container');
          const nuevoId = 'nuevo_' + Date.now();
          const nuevoNivel = document.createElement('div');
          nuevoNivel.className = 'bg-slate-700 rounded-lg p-4 nivel-item';
          nuevoNivel.dataset.id = nuevoId;
          nuevoNivel.innerHTML = \`
            <div class="grid grid-cols-12 gap-4 items-center">
              <div class="col-span-3">
                <label class="block text-sm font-medium text-slate-300 mb-1">Fase</label>
                <input type="text" 
                       name="fase_\${nuevoId}" 
                       value="" 
                       class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                       required>
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-slate-300 mb-1">Nivel Mín</label>
                <input type="number" 
                       name="nivel_min_\${nuevoId}" 
                       value="" 
                       class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                       placeholder="Ej: 1">
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-slate-300 mb-1">Nivel Máx</label>
                <input type="number" 
                       name="nivel_max_\${nuevoId}" 
                       value="" 
                       class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                       placeholder="Ej: 6">
              </div>
              <div class="col-span-4">
                <label class="block text-sm font-medium text-slate-300 mb-1">Descripción</label>
                <input type="text" 
                       name="descripcion_\${nuevoId}" 
                       value="" 
                       class="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 focus:border-indigo-500 focus:outline-none"
                       placeholder="Ej: Sanación Experto">
              </div>
              <div class="col-span-1 flex justify-end">
                <button onclick="this.closest('.nivel-item').remove()" 
                        class="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 transition-colors">
                  🗑️
                </button>
              </div>
            </div>
          \`;
          container.appendChild(nuevoNivel);
          // Añadir listeners al nuevo nivel
          actualizarEstadoValidacion();
          nuevoNivel.addEventListener('input', actualizarEstadoValidacion);
          nuevoNivel.addEventListener('change', actualizarEstadoValidacion);
        }

        function eliminarNivel(id) {
          if (confirm('¿Estás seguro de eliminar esta fase?')) {
            const item = document.querySelector(\`[data-id="\${id}"]\`);
            if (item) {
              item.remove();
            }
          }
        }

        async function guardarNiveles() {
          const items = document.querySelectorAll('.nivel-item');
          const niveles = [];

          items.forEach(item => {
            const id = item.dataset.id;
            const fase = item.querySelector(\`[name^="fase_"]\`).value;
            const nivelMin = item.querySelector(\`[name^="nivel_min_"]\`).value || null;
            const nivelMax = item.querySelector(\`[name^="nivel_max_"]\`).value || null;
            const descripcion = item.querySelector(\`[name^="descripcion_"]\`).value || '';

            if (fase) {
              niveles.push({
                id: id.startsWith('nuevo_') ? null : parseInt(id),
                fase,
                nivel_min: nivelMin ? parseInt(nivelMin) : null,
                nivel_max: nivelMax ? parseInt(nivelMax) : null,
                descripcion
              });
            }
          });

          try {
            const response = await fetch('/admin/niveles-energeticos', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ niveles })
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
              alert('✅ Niveles guardados correctamente');
              location.reload();
            } else {
              // Mostrar errores de validación si existen
              if (result.validation && result.validation.errors && result.validation.errors.length > 0) {
                const errorsText = result.validation.errors.join('\\n');
                alert('❌ Configuración inválida:\\n\\n' + errorsText);
              } else {
                alert('❌ Error: ' + (result.error || 'Error desconocido'));
              }
            }
          } catch (error) {
            alert('❌ Error: ' + error.message);
          }
        }
      </script>
    `;

    const url = new URL(request.url);
    const activePath = url.pathname;

    return renderAdminPage({
      title: 'Niveles Energéticos',
      contentHtml: content,
      activePath,
      userContext: { isAdmin: true }
    });
  } catch (error) {
    console.error('❌ Error en renderNivelesEnergeticos:', error);
    return new Response('Error interno del servidor: ' + error.message, { status: 500 });
  }
}

/**
 * Manejar actualización de niveles
 * Valida antes de guardar y guarda solo si es válida (normalizada)
 */
async function handleUpdateNiveles(request, env) {
  try {
    const body = await request.json();
    const { niveles } = body;

    // Validar configuración antes de guardar
    const validationResult = validateAndNormalizeNivelesEnergeticos(niveles);
    
    if (!validationResult.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Configuración inválida',
        validation: {
          ok: false,
          errors: validationResult.errors
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Usar configuración normalizada para guardar
    const nivelesNormalizados = validationResult.value;
    
    // ========================================================================
    // DECISIÓN ARQUITECTÓNICA: DELETE ALL + INSERT (Reemplazo completo)
    // ========================================================================
    // 
    // Esta estrategia asume que la configuración de niveles_energeticos es:
    // - GLOBAL: Una única configuración para todo el sistema
    // - ÚNICA: No hay versionado, preview por entorno o rollback
    // - REEMPLAZO COMPLETO: Cada guardado reemplaza toda la configuración anterior
    //
    // Ventajas:
    // - Simplicidad: No requiere diff, merge o detección de cambios
    // - Consistencia: Garantiza que la BD refleja exactamente lo que el admin guardó
    // - Transaccional: Todo o nada (BEGIN/COMMIT/ROLLBACK)
    //
    // Limitaciones:
    // - No permite versionado histórico
    // - No permite preview por entorno (dev/beta/prod)
    // - No permite rollback granular
    //
    // Si en el futuro se necesita:
    // - Versionado: Añadir tabla niveles_energeticos_versions con timestamps
    // - Preview por entorno: Añadir campo env y tabla ui_active_config (similar a UI Experience)
    // - Rollback: Implementar sistema de versiones con activación selectiva
    //
    // Esta decisión es CONSCIENTE, REVERSIBLE y DOCUMENTADA.
    // ========================================================================
    
    await query('BEGIN');
    
    try {
      // Eliminar todos los niveles existentes
      await query('DELETE FROM niveles_fases');
      
      // Insertar configuración normalizada
      for (const nivel of nivelesNormalizados) {
        await query(`
          INSERT INTO niveles_fases (fase, nivel_min, nivel_max, descripcion)
          VALUES ($1, $2, $3, $4)
        `, [nivel.fase, nivel.nivel_min, nivel.nivel_max, nivel.descripcion]);
      }
      
      await query('COMMIT');
    } catch (dbError) {
      await query('ROLLBACK');
      throw dbError;
    }

    return new Response(JSON.stringify({ 
      success: true,
      validation: {
        ok: true,
        errors: []
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error en handleUpdateNiveles:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      validation: {
        ok: false,
        errors: [error.message]
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}




















