// src/endpoints/admin-panel-pedagogico.js
// Funciones para las nuevas pantallas pedagógicas del admin panel

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { respuestas, aspectosPractica, progresoPedagogico, alumnos, rachaFases, caminosPantallas } from '../../database/pg.js';
import { crearWebhookTypeform, generarUrlWebhookAspecto } from '../services/typeform-webhook-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

/**
 * Reemplaza placeholders en templates
 */
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
 * Renderiza página de respuestas (histórico)
 */
export async function renderRespuestas(request, env) {
  try {
    const url = new URL(request.url);
    const filters = {
      email: url.searchParams.get('email') || null,
      nivel_practica: url.searchParams.get('nivel_practica') || null,
      form_id: url.searchParams.get('form_id') || null
    };
    const pageParam = url.searchParams.get('page');
    const page = pageParam && !isNaN(parseInt(pageParam)) ? parseInt(pageParam) : 1;

    const { respuestas: respuestasList, total, page: currentPage, totalPages } = await respuestas.getAll(filters, page, 50);

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">Respuestas (Histórico)</h2>

        <!-- Filtros -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg p-4 mb-6">
          <form method="GET" action="/admin/respuestas" class="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <input type="text" name="email" placeholder="Email" value="${filters.email || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <input type="number" name="nivel_practica" placeholder="Nivel práctica" value="${filters.nivel_practica || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <input type="text" name="form_id" placeholder="Form ID" value="${filters.form_id || ''}" 
                   class="px-3 py-2 border border-slate-600 rounded-md">
            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Filtrar
            </button>
          </form>
        </div>

        <!-- Tabla de respuestas -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Apodo</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nivel Práctica</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Formulario</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Respuesta</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${respuestasList.length === 0 ? `
                  <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-sm text-slate-400">
                      No hay respuestas registradas
                    </td>
                  </tr>
                ` : respuestasList.map(r => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${new Date(r.submitted_at).toLocaleString('es-ES')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${r.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${r.apodo || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${r.nivel_practica ? `Nivel ${r.nivel_practica}` : '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${r.form_title || r.form_id || '-'}</td>
                    <td class="px-6 py-4 text-sm text-slate-400 max-w-md truncate" title="${r.respuesta}">${r.respuesta.substring(0, 100)}${r.respuesta.length > 100 ? '...' : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Paginación -->
        ${totalPages > 1 ? `
          <div class="mt-4 flex justify-center">
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
              const params = new URLSearchParams({...filters, page: p});
              return `<a href="/admin/respuestas?${params.toString()}" 
                         class="px-3 py-2 mx-1 ${p === currentPage ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'} border border-slate-600 rounded-md hover:bg-indigo-50">
                  ${p}
                </a>`;
            }).join('')}
          </div>
        ` : ''}

        <div class="mt-4 text-sm text-slate-400">
          Mostrando ${respuestasList.length} de ${total} respuestas
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Respuestas',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando respuestas:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Renderiza página de Recorrido Pedagógico
 */
export async function renderRecorridoPedagogico(request, env) {
  try {
    const url = new URL(request.url);
    const sortBy = url.searchParams.get('sortBy') || 'apodo';
    const sortOrder = url.searchParams.get('sortOrder') || 'ASC';

    // Obtener todos los aspectos activos
    const aspectos = await aspectosPractica.getAll(true);
    
    // Obtener todos los alumnos con su progreso
    const progresoData = await progresoPedagogico.getAllAlumnosConProgreso(sortBy, sortOrder);
    
    // Agrupar por alumno
    const alumnosMap = new Map();
    for (const row of progresoData) {
      // Validar que los IDs sean números enteros válidos
      const alumnoId = parseInt(row.alumno_id);
      const aspectoId = parseInt(row.aspecto_id);
      
      if (isNaN(alumnoId) || !alumnoId || isNaN(aspectoId) || !aspectoId) {
        console.error('Fila con IDs inválidos ignorada:', { 
          alumno_id: row.alumno_id, 
          aspecto_id: row.aspecto_id,
          email: row.email,
          aspecto_nombre: row.aspecto_nombre
        });
        continue; // Saltar esta fila
      }
      
      if (!alumnosMap.has(alumnoId)) {
        alumnosMap.set(alumnoId, {
          id: alumnoId, // Asegurar que sea un número entero
          email: row.email,
          apodo: row.apodo || row.email,
          nivel_actual: row.nivel_actual,
          fase: row.fase || 'sin fase',
          aspectos: []
        });
      }
      alumnosMap.get(alumnoId).aspectos.push({
        aspecto_id: aspectoId, // Asegurar que sea un número entero
        aspecto_nombre: row.aspecto_nombre,
        contador_alumno: row.contador_alumno || 0,
        recomendacion_iniciarse: row.recomendacion_iniciarse,
        recomendacion_conocer: row.recomendacion_conocer,
        recomendacion_dominio: row.recomendacion_dominio,
        recomendado_iniciarse: row.recomendado_iniciarse,
        recomendado_conocer: row.recomendado_conocer,
        recomendado_dominio: row.recomendado_dominio
      });
    }

    const alumnosList = Array.from(alumnosMap.values());

    // Construir tabla con columnas dinámicas por aspecto
    const columnasAspectos = aspectos.map(ap => {
      return `
        <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase bg-slate-800" colspan="3">
          ${ap.nombre}
        </th>
      `;
    }).join('');

    const filasAspectos = aspectos.map(ap => {
      return `
        <th class="px-2 py-2 text-xs font-medium text-slate-400 bg-slate-750">Iniciarse</th>
        <th class="px-2 py-2 text-xs font-medium text-slate-400 bg-slate-750">Recomendación Master</th>
        <th class="px-2 py-2 text-xs font-medium text-slate-400 bg-slate-750">Veces Practicado</th>
      `;
    }).join('');

    const filasAlumnos = alumnosList.map(alumno => {
      // Asegurar que el ID del alumno sea un número entero válido
      const alumnoId = parseInt(alumno.id);
      if (isNaN(alumnoId) || !alumnoId) {
        console.error('ID de alumno inválido:', alumno);
        return '';
      }
      
      const celdasAspectos = aspectos.map(ap => {
        // Asegurar que el ID del aspecto sea un número entero válido
        const aspectoId = parseInt(ap.id);
        if (isNaN(aspectoId) || !aspectoId) {
          console.error('ID de aspecto inválido:', ap);
          return '';
        }
        
        const progreso = alumno.aspectos.find(a => parseInt(a.aspecto_id) === aspectoId);
        if (!progreso) {
          return `
            <td class="px-2 py-2 text-xs text-slate-400">${ap.recomendado_iniciarse}</td>
            <td class="px-2 py-2 text-xs">
              <input type="number" 
                     data-alumno-id="${alumnoId}" 
                     data-aspecto-id="${aspectoId}" 
                     data-tipo="iniciarse"
                     data-last-valid-value="${ap.recomendado_iniciarse || 1}"
                     class="w-16 px-1 py-1 border border-slate-600 rounded text-xs" 
                     placeholder="${ap.recomendado_iniciarse}"
                     min="0"
                     step="1"
                     oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                     onblur="this.value = this.value.replace(/[^0-9]/g, '') || '${ap.recomendado_iniciarse || 1}'; this.dataset.lastValidValue = this.value; actualizarRecomendacion(${alumnoId}, ${aspectoId}, 'iniciarse', this.value);"
                     onchange="this.value = this.value.replace(/[^0-9]/g, '') || '${ap.recomendado_iniciarse || 1}'; this.dataset.lastValidValue = this.value; actualizarRecomendacion(${alumnoId}, ${aspectoId}, 'iniciarse', this.value);">
            </td>
            <td class="px-2 py-2 text-xs text-slate-400">0</td>
          `;
        }

        // Determinar qué contador mostrar según el progreso
        let contadorMostrar = progreso.recomendado_iniciarse;
        let tipoActual = 'iniciarse';
        if (progreso.contador_alumno >= progreso.recomendacion_iniciarse) {
          contadorMostrar = progreso.recomendacion_conocer;
          tipoActual = 'conocer';
          if (progreso.contador_alumno >= progreso.recomendacion_conocer) {
            contadorMostrar = progreso.recomendacion_dominio;
            tipoActual = 'dominio';
          }
        }

        return `
          <td class="px-2 py-2 text-xs text-slate-200 font-medium">${contadorMostrar}</td>
          <td class="px-2 py-2 text-xs">
            <div class="flex gap-1">
              <input type="number" 
                     data-alumno-id="${alumnoId}" 
                     data-aspecto-id="${aspectoId}" 
                     data-tipo="iniciarse"
                     data-last-valid-value="${progreso.recomendacion_iniciarse || progreso.recomendado_iniciarse}"
                     value="${progreso.recomendacion_iniciarse || progreso.recomendado_iniciarse}"
                     class="w-12 px-1 py-1 border border-slate-600 rounded text-xs" 
                     min="0"
                     step="1"
                     oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                     onblur="this.value = this.value.replace(/[^0-9]/g, '') || '${progreso.recomendado_iniciarse || 1}'; this.dataset.lastValidValue = this.value; actualizarRecomendacion(${alumnoId}, ${aspectoId}, 'iniciarse', this.value);"
                     onchange="this.value = this.value.replace(/[^0-9]/g, '') || '${progreso.recomendado_iniciarse || 1}'; this.dataset.lastValidValue = this.value; actualizarRecomendacion(${alumnoId}, ${aspectoId}, 'iniciarse', this.value);">
              <input type="number" 
                     data-alumno-id="${alumnoId}" 
                     data-aspecto-id="${aspectoId}" 
                     data-tipo="conocer"
                     data-last-valid-value="${progreso.recomendacion_conocer || progreso.recomendado_conocer}"
                     value="${progreso.recomendacion_conocer || progreso.recomendado_conocer}"
                     class="w-12 px-1 py-1 border border-slate-600 rounded text-xs" 
                     min="0"
                     step="1"
                     oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                     onblur="this.value = this.value.replace(/[^0-9]/g, '') || '${progreso.recomendado_conocer || 5}'; this.dataset.lastValidValue = this.value; actualizarRecomendacion(${alumnoId}, ${aspectoId}, 'conocer', this.value);"
                     onchange="this.value = this.value.replace(/[^0-9]/g, '') || '${progreso.recomendado_conocer || 5}'; this.dataset.lastValidValue = this.value; actualizarRecomendacion(${alumnoId}, ${aspectoId}, 'conocer', this.value);">
              <input type="number" 
                     data-alumno-id="${alumnoId}" 
                     data-aspecto-id="${aspectoId}" 
                     data-tipo="dominio"
                     data-last-valid-value="${progreso.recomendacion_dominio || progreso.recomendado_dominio}"
                     value="${progreso.recomendacion_dominio || progreso.recomendado_dominio}"
                     class="w-12 px-1 py-1 border border-slate-600 rounded text-xs" 
                     min="0"
                     step="1"
                     oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                     onblur="this.value = this.value.replace(/[^0-9]/g, '') || '${progreso.recomendado_dominio || 10}'; this.dataset.lastValidValue = this.value; actualizarRecomendacion(${alumnoId}, ${aspectoId}, 'dominio', this.value);"
                     onchange="this.value = this.value.replace(/[^0-9]/g, '') || '${progreso.recomendado_dominio || 10}'; this.dataset.lastValidValue = this.value; actualizarRecomendacion(${alumnoId}, ${aspectoId}, 'dominio', this.value);">
            </div>
          </td>
          <td class="px-2 py-2 text-xs text-slate-200 font-semibold">${progreso.contador_alumno}</td>
        `;
      }).join('');

      return `
        <tr>
          <td class="px-4 py-3 text-sm font-medium text-white sticky left-0 bg-slate-800 z-0">${alumno.apodo}</td>
          <td class="px-4 py-3 text-sm text-slate-400 sticky left-32 bg-slate-800 z-0">Nivel ${alumno.nivel_actual}</td>
          <td class="px-4 py-3 text-sm text-slate-400 sticky left-48 bg-slate-800 z-0">${alumno.fase}</td>
          ${celdasAspectos}
        </tr>
      `;
    }).join('');

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">Recorrido Pedagógico</h2>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p class="text-sm text-blue-800">
            <strong>Instrucciones:</strong> Cada aspecto tiene 3 columnas: 
            <strong>Contador recomendado</strong> (se muestra según progreso), 
            <strong>Recomendación Master</strong> (editable inline - 3 campos: iniciarse, conocer, dominio), 
            <strong>Veces practicado</strong> (contador automático desde Typeform).
          </p>
        </div>

        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase sticky left-0 bg-slate-750 z-10">
                    <a href="/admin/recorrido-pedagogico?sortBy=apodo&sortOrder=${sortBy === 'apodo' && sortOrder === 'ASC' ? 'DESC' : 'ASC'}" 
                       class="hover:text-indigo-600">
                      Apodo ${sortBy === 'apodo' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase sticky left-32 bg-slate-750 z-10">
                    <a href="/admin/recorrido-pedagogico?sortBy=nivel_actual&sortOrder=${sortBy === 'nivel_actual' && sortOrder === 'ASC' ? 'DESC' : 'ASC'}" 
                       class="hover:text-indigo-600">
                      Nivel ${sortBy === 'nivel_actual' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase sticky left-48 bg-slate-750 z-10">
                    <a href="/admin/recorrido-pedagogico?sortBy=fase&sortOrder=${sortBy === 'fase' && sortOrder === 'ASC' ? 'DESC' : 'ASC'}" 
                       class="hover:text-indigo-600">
                      Fase ${sortBy === 'fase' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}
                    </a>
                  </th>
                  ${columnasAspectos}
                </tr>
                <tr>
                  <th class="px-4 py-3 bg-slate-750 sticky left-0 z-10"></th>
                  <th class="px-4 py-3 bg-slate-750 sticky left-32 z-10"></th>
                  <th class="px-4 py-3 bg-slate-750 sticky left-48 z-10"></th>
                  ${filasAspectos}
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${alumnosList.length === 0 ? `
                  <tr>
                    <td colspan="${3 + aspectos.length * 3}" class="px-6 py-8 text-center text-sm text-slate-400">
                      No hay alumnos registrados
                    </td>
                  </tr>
                ` : filasAlumnos}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <script>
        // Función helper para limpiar y validar valor numérico
        function limpiarValorNumerico(valor) {
          if (valor === null || valor === undefined) return null;
          const str = String(valor).trim();
          if (str === '') return null;
          // Eliminar todo lo que no sea número
          const limpio = str.replace(/[^0-9]/g, '');
          if (limpio === '') return null;
          const num = parseInt(limpio);
          return isNaN(num) ? null : (num < 0 ? 0 : num);
        }
        
        async function actualizarRecomendacion(alumnoId, aspectoId, tipo, valor) {
          // Limpiar el valor ANTES de validar
          const valorLimpio = limpiarValorNumerico(valor);
          
          // Si el valor no es un número válido después de limpiar, no hacer nada
          if (valorLimpio === null) {
            console.warn('Valor inválido ignorado después de limpiar:', { alumnoId, aspectoId, tipo, valor, valorLimpio });
            // Restaurar el valor del campo al último valor válido conocido
            const input = document.querySelector(\`input[data-alumno-id="\${alumnoId}"][data-aspecto-id="\${aspectoId}"][data-tipo="\${tipo}"]\`);
            if (input && input.dataset.lastValidValue) {
              input.value = input.dataset.lastValidValue;
            }
            return;
          }
          
          // Guardar el valor válido para restaurar si es necesario
          const input = document.querySelector(\`input[data-alumno-id="\${alumnoId}"][data-aspecto-id="\${aspectoId}"][data-tipo="\${tipo}"]\`);
          if (input) {
            input.dataset.lastValidValue = valorLimpio;
            // Si el valor visual es diferente al limpio, actualizarlo
            if (input.value !== String(valorLimpio)) {
              input.value = valorLimpio;
            }
          }
          
          // Validar que los IDs sean números válidos
          if (!alumnoId || isNaN(alumnoId) || !aspectoId || isNaN(aspectoId)) {
            console.error('IDs inválidos:', { alumnoId, aspectoId, tipo, valor, valorLimpio });
            alert('Error: IDs de alumno o aspecto inválidos. Por favor, recarga la página.');
            return;
          }
          
          // Convertir a números enteros para asegurar que son válidos
          const alumnoIdNum = parseInt(alumnoId);
          const aspectoIdNum = parseInt(aspectoId);
          
          if (isNaN(alumnoIdNum) || isNaN(aspectoIdNum)) {
            console.error('Error parseando IDs:', { alumnoId, aspectoId, alumnoIdNum, aspectoIdNum });
            alert('Error: No se pudieron parsear los IDs. Por favor, recarga la página.');
            return;
          }
          
          // Función helper para parsear valores numéricos correctamente (incluyendo 0)
          const parseValue = (val) => {
            const limpio = limpiarValorNumerico(val);
            return limpio;
          };
          
          // Obtener valores actuales de todos los campos
          const iniciarseInput = document.querySelector(\`input[data-alumno-id="\${alumnoIdNum}"][data-aspecto-id="\${aspectoIdNum}"][data-tipo="iniciarse"]\`);
          const conocerInput = document.querySelector(\`input[data-alumno-id="\${alumnoIdNum}"][data-aspecto-id="\${aspectoIdNum}"][data-tipo="conocer"]\`);
          const dominioInput = document.querySelector(\`input[data-alumno-id="\${alumnoIdNum}"][data-aspecto-id="\${aspectoIdNum}"][data-tipo="dominio"]\`);
          
          // Construir objeto de recomendaciones con el valor actualizado y los demás valores actuales
          const recomendaciones = {
            iniciarse: tipo === 'iniciarse' ? parseValue(valor) : (iniciarseInput ? parseValue(iniciarseInput.value) : null),
            conocer: tipo === 'conocer' ? parseValue(valor) : (conocerInput ? parseValue(conocerInput.value) : null),
            dominio: tipo === 'dominio' ? parseValue(valor) : (dominioInput ? parseValue(dominioInput.value) : null)
          };

          try {
            // Usar URLSearchParams en lugar de FormData para compatibilidad con Node.js
            const params = new URLSearchParams();
            const alumnoIdStr = String(alumnoIdNum);
            const aspectoIdStr = String(aspectoIdNum);
            
            params.append('alumno_id', alumnoIdStr);
            params.append('aspecto_id', aspectoIdStr);
            // Enviar null como cadena vacía, pero números válidos (incluyendo 0) como números
            params.append('recomendacion_iniciarse', recomendaciones.iniciarse !== null ? recomendaciones.iniciarse.toString() : '');
            params.append('recomendacion_conocer', recomendaciones.conocer !== null ? recomendaciones.conocer.toString() : '');
            params.append('recomendacion_dominio', recomendaciones.dominio !== null ? recomendaciones.dominio.toString() : '');

            console.log('Enviando datos:', {
              alumno_id: alumnoIdNum,
              aspecto_id: aspectoIdNum,
              alumnoIdStr,
              aspectoIdStr,
              recomendaciones
            });

            const response = await fetch('/admin/recorrido-pedagogico', {
              method: 'POST',
              body: params,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                console.log('✅ Recomendación actualizada correctamente');
              } else {
                console.error('Error en respuesta:', result);
                alert('Error: ' + (result.error || 'Error desconocido'));
              }
            } else {
              const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
              console.error('Error HTTP:', response.status, errorData);
              alert('Error actualizando recomendación: ' + (errorData.error || 'Error desconocido'));
            }
          } catch (error) {
            console.error('Error:', error);
            alert('Error actualizando recomendación: ' + error.message);
          }
        }
      </script>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Recorrido Pedagógico',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando recorrido pedagógico:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja actualización de recomendaciones del master
 */
export async function handleUpdateProgresoPedagogico(request, env) {
  try {
    // Verificar Content-Type
    const contentType = request.headers.get('content-type') || '';
    console.log('📋 Content-Type recibido:', contentType);
    
    // Parsear como FormData directamente
    const formData = await request.formData();
    
    // Obtener todos los valores del FormData
    const alumnoIdRaw = formData.get('alumno_id');
    const aspectoIdRaw = formData.get('aspecto_id');
    
    // Log para debugging - ver qué está llegando
    console.log('📥 Datos recibidos del FormData:', {
      alumnoIdRaw: alumnoIdRaw,
      aspectoIdRaw: aspectoIdRaw,
      tipoAlumnoId: typeof alumnoIdRaw,
      tipoAspectoId: typeof aspectoIdRaw,
      alumnoIdRawValue: alumnoIdRaw?.valueOf ? alumnoIdRaw.valueOf() : alumnoIdRaw,
      aspectoIdRawValue: aspectoIdRaw?.valueOf ? aspectoIdRaw.valueOf() : aspectoIdRaw,
      recomendacion_iniciarse: formData.get('recomendacion_iniciarse'),
      recomendacion_conocer: formData.get('recomendacion_conocer'),
      recomendacion_dominio: formData.get('recomendacion_dominio'),
      todasLasKeys: Array.from(formData.keys()),
      todasLasEntries: Array.from(formData.entries())
    });
    
    // Parsear IDs con validación más estricta
    // FormData.get() puede devolver File, string, o null
    // Necesitamos asegurarnos de que sea un string
    let alumnoIdStr = '';
    let aspectoIdStr = '';
    
    if (alumnoIdRaw !== null && alumnoIdRaw !== undefined) {
      alumnoIdStr = String(alumnoIdRaw).trim();
    }
    if (aspectoIdRaw !== null && aspectoIdRaw !== undefined) {
      aspectoIdStr = String(aspectoIdRaw).trim();
    }
    
    // Verificar que no estén vacíos antes de parsear
    if (!alumnoIdStr || !aspectoIdStr) {
      console.error('❌ IDs vacíos después de convertir a string:', { 
        alumnoIdRaw, 
        aspectoIdRaw, 
        alumnoIdStr, 
        aspectoIdStr,
        alumnoIdRawType: typeof alumnoIdRaw,
        aspectoIdRawType: typeof aspectoIdRaw
      });
      return new Response(JSON.stringify({ 
        error: 'ID de alumno o aspecto inválido (vacío)',
        details: { 
          alumnoIdRaw, 
          aspectoIdRaw, 
          alumnoIdStr, 
          aspectoIdStr,
          alumnoIdRawType: typeof alumnoIdRaw,
          aspectoIdRawType: typeof aspectoIdRaw
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const alumnoId = parseInt(alumnoIdStr, 10);
    const aspectoId = parseInt(aspectoIdStr, 10);
    
    // Log para debugging
    console.log('🔍 IDs parseados:', {
      alumnoIdStr,
      aspectoIdStr,
      alumnoId,
      aspectoId,
      alumnoIdValid: !isNaN(alumnoId) && alumnoId > 0,
      aspectoIdValid: !isNaN(aspectoId) && aspectoId > 0
    });
    
    // Parsear valores de recomendaciones, manejando cadenas vacías y NaN
    const parseRecomendacion = (value) => {
      if (!value || value === '') return null;
      const str = String(value).trim();
      if (str === '') return null;
      const parsed = parseInt(str);
      return isNaN(parsed) ? null : parsed;
    };
    
    const recomendacion_iniciarse = parseRecomendacion(formData.get('recomendacion_iniciarse'));
    const recomendacion_conocer = parseRecomendacion(formData.get('recomendacion_conocer'));
    const recomendacion_dominio = parseRecomendacion(formData.get('recomendacion_dominio'));

    // Verificar que alumnoId y aspectoId sean válidos (números enteros positivos)
    if (isNaN(alumnoId) || alumnoId <= 0 || isNaN(aspectoId) || aspectoId <= 0) {
      console.error('❌ IDs inválidos después de parsear:', { 
        alumnoId, 
        aspectoId, 
        alumnoIdRaw, 
        aspectoIdRaw,
        alumnoIdStr,
        aspectoIdStr
      });
      return new Response(JSON.stringify({ 
        error: 'ID de alumno o aspecto inválido (no es un número válido)',
        details: { 
          alumnoId, 
          aspectoId, 
          alumnoIdRaw, 
          aspectoIdRaw,
          alumnoIdStr,
          aspectoIdStr
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Asegurar que existe el registro de progreso y actualizar recomendaciones
    // Primero hacer upsert para asegurar que existe
    await progresoPedagogico.upsert({
      alumno_id: alumnoId,
      aspecto_id: aspectoId,
      contador_alumno: 0
    });
    
    // Luego actualizar las recomendaciones del master (esto siempre actualiza, incluso si son null)
    const result = await progresoPedagogico.updateRecomendacionesMaster(alumnoId, aspectoId, {
      iniciarse: recomendacion_iniciarse,
      conocer: recomendacion_conocer,
      dominio: recomendacion_dominio
    });
    
    // Si no se actualizó nada (no existe el registro), crearlo con las recomendaciones
    if (!result) {
      await progresoPedagogico.upsert({
        alumno_id: alumnoId,
        aspecto_id: aspectoId,
        contador_alumno: 0,
        recomendacion_master_iniciarse: recomendacion_iniciarse,
        recomendacion_master_conocer: recomendacion_conocer,
        recomendacion_master_dominio: recomendacion_dominio
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error actualizando progreso pedagógico:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Renderiza página de configuración de aspectos
 */
export async function renderConfiguracionAspectos(request, env) {
  try {
    const url = new URL(request.url);
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');
    const editId = url.searchParams.get('edit');
    const deleteId = url.searchParams.get('delete');

    const aspectos = await aspectosPractica.getAll(false); // Todos, incluso inactivos
    
    // Si hay deleteId, eliminar el aspecto
    if (deleteId) {
      try {
        await aspectosPractica.deleteById(parseInt(deleteId));
        return new Response('', {
          status: 302,
          headers: { 
            'Location': getAbsoluteUrl(request, '/admin/configuracion-aspectos?success=aspecto_eliminado')
          }
        });
      } catch (err) {
        return new Response('', {
          status: 302,
          headers: { 
            'Location': getAbsoluteUrl(request, `/admin/configuracion-aspectos?error=${encodeURIComponent(err.message)}`)
          }
        });
      }
    }
    
    // Obtener aspecto a editar si existe
    let aspectoEditando = null;
    if (editId) {
      aspectoEditando = await aspectosPractica.findById(parseInt(editId));
    }

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Configuración de Aspectos</h2>
          <button onclick="document.getElementById('modalCrearAspecto').classList.remove('hidden')" 
                  class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            + Añadir Aspecto
          </button>
        </div>

        ${success === 'aspecto_creado' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Aspecto creado correctamente
            ${url.searchParams.get('webhook') ? `
              <div class="mt-2 p-2 bg-slate-800 rounded border border-green-300">
                <p class="text-xs font-semibold mb-1">Webhook generado automáticamente:</p>
                <div class="flex items-center gap-2 mt-1">
                  <code class="text-xs break-all bg-slate-800 px-2 py-1 rounded flex-1">${url.searchParams.get('webhook')}</code>
                  <button onclick="navigator.clipboard.writeText('${url.searchParams.get('webhook')}').then(() => alert('Webhook copiado al portapapeles')).catch(() => alert('Error al copiar'))" 
                          class="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">
                    📋 Copiar
                  </button>
                </div>
                <p class="text-xs mt-2 text-slate-300">Copia este webhook y configúralo en Typeform como webhook del formulario</p>
              </div>
            ` : ''}
          </div>
        ` : ''}
        ${success === 'aspecto_actualizado' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Aspecto actualizado correctamente
          </div>
        ` : ''}
        ${success === 'aspecto_eliminado' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Aspecto eliminado correctamente
          </div>
        ` : ''}
        ${error ? `
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            ❌ Error: ${decodeURIComponent(error)}
          </div>
        ` : ''}

        <!-- Tabla de aspectos -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nombre</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Webhook Typeform</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Recomendado Iniciarse</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Recomendado Conocer</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Recomendado Dominio</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Estado</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${aspectos.length === 0 ? `
                  <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-sm text-slate-400">
                      No hay aspectos configurados. <a href="#" onclick="document.getElementById('modalCrearAspecto').classList.remove('hidden'); return false;" class="text-indigo-600 hover:text-indigo-900">Añade el primero</a>
                    </td>
                  </tr>
                ` : aspectos.map(a => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">${a.nombre}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      ${a.webhook_typeform ? `
                        <div class="flex items-center gap-2">
                          <code class="text-xs bg-slate-800 px-2 py-1 rounded max-w-xs truncate">${a.webhook_typeform}</code>
                          <button onclick="navigator.clipboard.writeText('${a.webhook_typeform}').then(() => alert('Webhook copiado')).catch(() => alert('Error al copiar'))" 
                                  class="text-indigo-600 hover:text-indigo-900 text-xs" title="Copiar webhook">📋</button>
                        </div>
                      ` : '<span class="text-slate-500">No generado</span>'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${a.recomendado_iniciarse}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${a.recomendado_conocer}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${a.recomendado_dominio}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      <span class="px-2 py-1 text-xs rounded-full ${a.activo ? 'bg-green-100 text-green-800' : 'bg-slate-800 text-slate-100'}">
                        ${a.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a href="/admin/configuracion-aspectos?edit=${a.id}" 
                         class="text-indigo-600 hover:text-indigo-900">Editar</a>
                      <span class="mx-2">|</span>
                      <a href="/admin/configuracion-aspectos?delete=${a.id}" 
                         onclick="return confirm('¿Eliminar el aspecto \\'${a.nombre}\\'? Esto eliminará también todo el progreso asociado.')"
                         class="text-red-600 hover:text-red-900">Eliminar</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal para crear aspecto -->
        <div id="modalCrearAspecto" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800">
            <div class="mt-3">
              <h3 class="text-lg font-medium text-white mb-4">Añadir Aspecto</h3>
              <form method="POST" action="/admin/configuracion-aspectos" class="space-y-4">
                <input type="hidden" name="action" value="create">
                <div>
                  <label class="block text-sm font-medium text-slate-200">Nombre del Objetivo *</label>
                  <input type="text" name="nombre" required 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Recomendado Iniciarse</label>
                  <input type="number" name="recomendado_iniciarse" value="1" min="1"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Recomendado Conocer</label>
                  <input type="number" name="recomendado_conocer" value="5" min="1"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Recomendado Dominio</label>
                  <input type="number" name="recomendado_dominio" value="10" min="1"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Descripción</label>
                  <textarea name="descripcion" rows="3"
                            class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"></textarea>
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" onclick="document.getElementById('modalCrearAspecto').classList.add('hidden')" 
                          class="px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-750">
                    Cancelar
                  </button>
                  <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    Crear
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Modal para editar aspecto -->
        <div id="modalEditarAspecto" class="${aspectoEditando ? '' : 'hidden'} fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800 max-h-[90vh] overflow-y-auto">
            <div class="mt-3">
              <h3 class="text-lg font-medium text-white mb-4">Editar Aspecto</h3>
              ${aspectoEditando ? `
              <form method="POST" action="/admin/configuracion-aspectos" class="space-y-4">
                <input type="hidden" name="action" value="update">
                <input type="hidden" name="aspecto_id" value="${aspectoEditando.id}">
                <div>
                  <label class="block text-sm font-medium text-slate-200">Nombre del Objetivo *</label>
                  <input type="text" name="nombre" required 
                         value="${aspectoEditando.nombre || ''}"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Webhook Typeform</label>
                  <div class="mt-1 flex items-center gap-2">
                    <input type="text" 
                           value="${aspectoEditando.webhook_typeform || 'No generado aún'}"
                           readonly
                           class="flex-1 block w-full border border-slate-600 rounded-md px-3 py-2 bg-slate-750"
                           id="webhook-input-${aspectoEditando.id}">
                    <button type="button" 
                            onclick="navigator.clipboard.writeText('${aspectoEditando.webhook_typeform || ''}').then(() => alert('Webhook copiado al portapapeles')).catch(() => alert('Error al copiar'))"
                            class="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">
                      📋 Copiar
                    </button>
                  </div>
                  <p class="mt-1 text-xs text-slate-400">Copia este webhook y configúralo en Typeform</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Recomendado Iniciarse</label>
                  <input type="number" name="recomendado_iniciarse" 
                         value="${aspectoEditando.recomendado_iniciarse || 1}" 
                         min="1"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Recomendado Conocer</label>
                  <input type="number" name="recomendado_conocer" 
                         value="${aspectoEditando.recomendado_conocer || 5}" 
                         min="1"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Recomendado Dominio</label>
                  <input type="number" name="recomendado_dominio" 
                         value="${aspectoEditando.recomendado_dominio || 10}" 
                         min="1"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Descripción</label>
                  <textarea name="descripcion" rows="3"
                            class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">${aspectoEditando.descripcion || ''}</textarea>
                </div>
                <div>
                  <label class="flex items-center">
                    <input type="checkbox" name="activo" value="true" 
                           ${aspectoEditando.activo ? 'checked' : ''}
                           class="mr-2">
                    <span class="text-sm text-slate-200">Activo</span>
                  </label>
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" onclick="document.getElementById('modalEditarAspecto').classList.add('hidden'); window.location.href='/admin/configuracion-aspectos';" 
                          class="px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-750">
                    Cancelar
                  </button>
                  <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    Guardar Cambios
                  </button>
                </div>
              </form>
              ` : '<p>Cargando...</p>'}
            </div>
          </div>
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Configuración de Aspectos',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando configuración de aspectos:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja creación/actualización de aspectos
 */
export async function handleUpdateAspecto(request, env) {
  try {
    const formData = await request.formData();
    const action = formData.get('action');
    const aspectoId = formData.get('aspecto_id') ? parseInt(formData.get('aspecto_id')) : null;

    if (action === 'create') {
      const nombreAspecto = formData.get('nombre');
      
      // Crear el aspecto primero
      const aspecto = await aspectosPractica.create({
        nombre: nombreAspecto,
        webhook_typeform: null, // Se generará automáticamente
        recomendado_iniciarse: parseInt(formData.get('recomendado_iniciarse')) || 1,
        recomendado_conocer: parseInt(formData.get('recomendado_conocer')) || 5,
        recomendado_dominio: parseInt(formData.get('recomendado_dominio')) || 10,
        descripcion: formData.get('descripcion') || null
      });

      // Generar webhook automáticamente (sin necesidad de form_id)
      const baseUrl = `https://webhook-typeform.pdeeugenihidalgo.org`;
      const webhookUrl = generarUrlWebhookAspecto(aspecto.id, aspecto.nombre, baseUrl);
      
      // Actualizar el aspecto con la URL del webhook generada
      await aspectosPractica.update(aspecto.id, {
        webhook_typeform: webhookUrl
      });
      
      console.log(`✅ Webhook generado automáticamente para aspecto ${aspecto.nombre}: ${webhookUrl}`);

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, `/admin/configuracion-aspectos?success=aspecto_creado&webhook=${encodeURIComponent(webhookUrl)}`)
        }
      });
    } else if (action === 'update' && aspectoId) {
      // No permitir modificar el webhook manualmente, solo otros campos
      await aspectosPractica.update(aspectoId, {
        nombre: formData.get('nombre') || undefined,
        // webhook_typeform NO se actualiza manualmente
        recomendado_iniciarse: formData.get('recomendado_iniciarse') ? parseInt(formData.get('recomendado_iniciarse')) : undefined,
        recomendado_conocer: formData.get('recomendado_conocer') ? parseInt(formData.get('recomendado_conocer')) : undefined,
        recomendado_dominio: formData.get('recomendado_dominio') ? parseInt(formData.get('recomendado_dominio')) : undefined,
        descripcion: formData.get('descripcion') || undefined,
        activo: formData.get('activo') === 'true'
      });

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-aspectos?success=aspecto_actualizado')
        }
      });
    } else {
      return new Response('Acción no válida', { status: 400 });
    }
  } catch (error) {
    console.error('Error actualizando aspecto:', error);
    return new Response('', {
      status: 302,
      headers: { 
        'Location': getAbsoluteUrl(request, `/admin/configuracion-aspectos?error=${encodeURIComponent(error.message)}`)
      }
    });
  }
}

/**
 * Renderiza página de configuración de fases de racha
 */
export async function renderConfiguracionRacha(request, env) {
  try {
    const url = new URL(request.url);
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');
    const editId = url.searchParams.get('edit');

    // Obtener fases ordenadas por días mínimo (de menor a mayor)
    // Obtener fases ordenadas por días mínimo (de menor a mayor)
    // Obtener fases ordenadas por días mínimo (de menor a mayor)
    const fases = await rachaFases.getAll();
    fases.sort((a, b) => {
      // Ordenar por dias_min: null va al final, luego de menor a mayor
      if (a.dias_min === null && b.dias_min === null) return 0;
      if (a.dias_min === null) return 1;
      if (b.dias_min === null) return -1;
      return a.dias_min - b.dias_min;
    });
    
    // Obtener fase a editar si existe
    let faseEditando = null;
    if (editId) {
      faseEditando = await rachaFases.findById(parseInt(editId));
    }

    const content = `
      <div class="px-4 py-5 sm:p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">Configuración de Fases de Racha</h2>
          <button onclick="document.getElementById('modalCrearFaseRacha').classList.remove('hidden')" 
                  class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            + Añadir Fase de Racha
          </button>
        </div>

        ${success === 'fase_creada' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Fase de racha creada correctamente
          </div>
        ` : ''}
        ${success === 'fase_actualizada' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Fase de racha actualizada correctamente
          </div>
        ` : ''}
        ${success === 'fase_eliminada' ? `
          <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Fase de racha eliminada correctamente
          </div>
        ` : ''}
        ${error ? `
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            ❌ Error: ${decodeURIComponent(error)}
          </div>
        ` : ''}

        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p class="text-sm text-blue-800">
            <strong>Instrucciones:</strong> Configura las fases de racha según los días consecutivos de práctica. 
            Cada fase tiene un rango de días (dias_min y dias_max). El sistema asignará automáticamente la fase 
            correspondiente a cada alumno según su streak (días consecutivos).
          </p>
        </div>

        <!-- Tabla de fases de racha -->
        <div class="bg-slate-800 shadow-xl rounded border border-slate-700-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-700">
              <thead class="bg-slate-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Orden</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nombre de Fase</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Días Mínimo</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Días Máximo</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Descripción</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800 divide-y divide-slate-700">
                ${fases.length === 0 ? `
                  <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-sm text-slate-400">
                      No hay fases configuradas. <a href="#" onclick="document.getElementById('modalCrearFaseRacha').classList.remove('hidden'); return false;" class="text-indigo-600 hover:text-indigo-900">Añade la primera</a>
                    </td>
                  </tr>
                ` : fases.map(f => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${f.orden}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">${f.fase}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${f.dias_min !== null ? f.dias_min : 'Sin límite'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400">${f.dias_max !== null ? f.dias_max : 'Sin límite'}</td>
                    <td class="px-6 py-4 text-sm text-slate-400">${f.descripcion || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <a href="/admin/configuracion-racha?edit=${f.id}" class="text-indigo-600 hover:text-indigo-900">Editar</a>
                      <span class="mx-2">|</span>
                      <a href="/admin/configuracion-racha?delete=${f.id}" 
                         onclick="return confirm('¿Eliminar esta fase de racha?')"
                         class="text-red-600 hover:text-red-900">Eliminar</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal para crear fase de racha -->
        <div id="modalCrearFaseRacha" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800">
            <div class="mt-3">
              <h3 class="text-lg font-medium text-white mb-4">Añadir Fase de Racha</h3>
              <form method="POST" action="/admin/configuracion-racha" class="space-y-4">
                <input type="hidden" name="action" value="create">
                <div>
                  <label class="block text-sm font-medium text-slate-200">Nombre de la Fase *</label>
                  <input type="text" name="fase" required 
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Ej: Iniciando, Constante, Maestro">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Días Mínimo</label>
                  <input type="number" name="dias_min" min="0"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Días mínimos (ej: 1)">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Días Máximo</label>
                  <input type="number" name="dias_max" min="0"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"
                         placeholder="Días máximos (dejar vacío para sin límite)">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Orden</label>
                  <input type="number" name="orden" value="${fases.length + 1}" min="1"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                  <p class="mt-1 text-xs text-slate-400">Orden de evaluación (menor = primero)</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Descripción</label>
                  <textarea name="descripcion" rows="3"
                            class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2"></textarea>
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" onclick="document.getElementById('modalCrearFaseRacha').classList.add('hidden')" 
                          class="px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-750">
                    Cancelar
                  </button>
                  <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    Crear
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Modal para editar fase de racha -->
        <div id="modalEditarFaseRacha" class="${faseEditando ? '' : 'hidden'} fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-xl rounded-md bg-slate-800">
            <div class="mt-3">
              <h3 class="text-lg font-medium text-white mb-4">Editar Fase de Racha</h3>
              ${faseEditando ? `
              <form method="POST" action="/admin/configuracion-racha" class="space-y-4">
                <input type="hidden" name="action" value="update">
                <input type="hidden" name="fase_id" value="${faseEditando.id}">
                <div>
                  <label class="block text-sm font-medium text-slate-200">Nombre de la Fase *</label>
                  <input type="text" name="fase" required 
                         value="${faseEditando.fase || ''}"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Días Mínimo</label>
                  <input type="number" name="dias_min" min="0"
                         value="${faseEditando.dias_min !== null ? faseEditando.dias_min : ''}"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Días Máximo</label>
                  <input type="number" name="dias_max" min="0"
                         value="${faseEditando.dias_max !== null ? faseEditando.dias_max : ''}"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Orden</label>
                  <input type="number" name="orden" value="${faseEditando.orden || 0}" min="1"
                         class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-200">Descripción</label>
                  <textarea name="descripcion" rows="3"
                            class="mt-1 block w-full border border-slate-600 rounded-md px-3 py-2">${faseEditando.descripcion || ''}</textarea>
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" onclick="document.getElementById('modalEditarFaseRacha').classList.add('hidden'); window.location.href='/admin/configuracion-racha';" 
                          class="px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-750">
                    Cancelar
                  </button>
                  <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    Guardar Cambios
                  </button>
                </div>
              </form>
              ` : '<p>Cargando...</p>'}
            </div>
          </div>
        </div>
      </div>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Configuración de Fases de Racha',
      CONTENT: content
    });

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando configuración de racha:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Maneja creación/actualización/eliminación de fases de racha
 */
export async function handleUpdateRachaFase(request, env) {
  try {
    const url = new URL(request.url);
    
    // Manejar eliminación desde GET
    if (url.searchParams.get('delete') && request.method === 'GET') {
      const deleteId = parseInt(url.searchParams.get('delete'));
      if (!isNaN(deleteId)) {
        await rachaFases.deleteById(deleteId);
        return new Response('', {
          status: 302,
          headers: { 
            'Location': getAbsoluteUrl(request, '/admin/configuracion-racha?success=fase_eliminada')
          }
        });
      }
    }
    
    const formData = await request.formData();
    const action = formData.get('action');
    const faseId = formData.get('fase_id') ? parseInt(formData.get('fase_id')) : null;

    if (action === 'create') {
      const fase = await rachaFases.create({
        fase: formData.get('fase'),
        dias_min: formData.get('dias_min') ? parseInt(formData.get('dias_min')) : null,
        dias_max: formData.get('dias_max') ? parseInt(formData.get('dias_max')) : null,
        descripcion: formData.get('descripcion') || null,
        orden: parseInt(formData.get('orden')) || 0
      });

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-racha?success=fase_creada')
        }
      });
    } else if (action === 'update' && faseId) {
      await rachaFases.update(faseId, {
        fase: formData.get('fase') || undefined,
        dias_min: formData.get('dias_min') ? parseInt(formData.get('dias_min')) : undefined,
        dias_max: formData.get('dias_max') ? parseInt(formData.get('dias_max')) : undefined,
        descripcion: formData.get('descripcion') || undefined,
        orden: formData.get('orden') ? parseInt(formData.get('orden')) : undefined
      });

      return new Response('', {
        status: 302,
        headers: { 
          'Location': getAbsoluteUrl(request, '/admin/configuracion-racha?success=fase_actualizada')
        }
      });
    }

    return new Response('Acción no válida', { status: 400 });
  } catch (error) {
    console.error('Error actualizando fase de racha:', error);
    return new Response('', {
      status: 302,
      headers: { 
        'Location': getAbsoluteUrl(request, `/admin/configuracion-racha?error=${encodeURIComponent(error.message)}`)
      }
    });
  }
}

/**
 * Helper para obtener URL absoluta
 */
function getAbsoluteUrl(request, path) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}${path}`;
}

