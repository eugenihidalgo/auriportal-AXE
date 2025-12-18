// src/endpoints/limpieza-handler.js
// Handler principal para la pantalla de limpieza energética
//
// REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.

import { requireStudentContext } from '../core/auth-context.js';
import { obtenerAspectosParaLimpieza as obtenerAspectosParaLimpiezaNuevo } from '../services/transmutaciones-energeticas.js';
import { limpiarItemParaAlumno, obtenerItemPorId, obtenerListaPorId } from '../services/transmutaciones-energeticas.js';
import { obtenerTecnicasPorNivel } from '../services/tecnicas-limpieza.js';
import { checkDailyStreak } from '../modules/streak.js';
import { renderHtml } from '../core/html-response.js';
import { insertEnergyEvent } from '../core/energy/energy-events.js';
import { getRequestId } from '../core/observability/request-context.js';
import { query } from '../../database/pg.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Reemplaza placeholders en HTML (soporta condicionales simples)
 */
function replace(html, placeholders) {
  let output = html;
  
  // Función auxiliar para evaluar valor como booleano
  function isTruthy(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value !== '' && value !== 'false' && value !== '0';
    }
    return Boolean(value);
  }
  
  // Procesar condicionales en múltiples pasadas para manejar anidados
  let changed = true;
  let iterations = 0;
  const maxIterations = 10; // Evitar bucles infinitos
  
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    // Reemplazar condicionales negativos {{^KEY}}...{{/KEY}}
    for (const key in placeholders) {
      const value = placeholders[key];
      const regexNegativo = new RegExp(`{{\\^${key}}}([\\s\\S]*?){{/${key}}}`, 'g');
      const matches = output.match(regexNegativo);
      if (matches) {
        const newOutput = output.replace(regexNegativo, (match, content) => {
          if (!isTruthy(value)) {
            return content;
          }
          return '';
        });
        if (newOutput !== output) {
          output = newOutput;
          changed = true;
        }
      }
    }
    
    // Reemplazar condicionales positivos {{#KEY}}...{{/KEY}}
    for (const key in placeholders) {
      const value = placeholders[key];
      const regex = new RegExp(`{{#${key}}}([\\s\\S]*?){{/${key}}}`, 'g');
      const matches = output.match(regex);
      if (matches) {
        const newOutput = output.replace(regex, (match, content) => {
          if (isTruthy(value)) {
            return content;
          }
          return '';
        });
        if (newOutput !== output) {
          output = newOutput;
          changed = true;
        }
      }
    }
  }
  
  // Reemplazar placeholders normales
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    
    // Si es un booleano, convertirlo a string JavaScript
    let replacement = value;
    if (typeof value === 'boolean') {
      replacement = value ? 'true' : 'false';
    } else {
      replacement = String(value);
    }
    
    output = output.replace(regex, replacement);
  }
  
  return output;
}

/**
 * Renderiza la pantalla principal de limpieza
 */
export async function renderLimpiezaPrincipal(request, env) {
  // Obtener contexto de autenticación (devuelve Response si no autenticado)
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) return authCtx;
  
  // Usar ctx.user en lugar de buscar alumno directamente
  const student = authCtx.user;
  
  const htmlTemplate = readFileSync(join(__dirname, '../core/html/limpieza-principal.html'), 'utf-8');
  
  const temaPreferido = student?.tema_preferido || 'dark';
  let html = replace(htmlTemplate, {
    TEMA_PREFERIDO: temaPreferido,
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    URL_LIMPIEZA_RAPIDA: "/limpieza/rapida",
    URL_LIMPIEZA_BASICA: "/limpieza/basica",
    URL_LIMPIEZA_PROFUNDA: "/limpieza/profunda",
    URL_LIMPIEZA_TOTAL: "/limpieza/total"
  });
  
  // Usar renderHtml centralizado (aplica tema y headers anti-cache automáticamente)
  return renderHtml(html, { student });
}

/**
 * Renderiza la pantalla de un tipo específico de limpieza
 */
export async function renderLimpiezaTipo(request, env, tipoLimpieza) {
  // Obtener contexto de autenticación (devuelve Response si no autenticado)
  const authCtx = await requireStudentContext(request, env);
  if (authCtx instanceof Response) return authCtx;
  
  // Usar ctx.user en lugar de buscar alumno directamente
  const student = authCtx.user;
  
  // Obtener nivel del alumno
  const nivelAlumno = student.nivel_actual || 1;
  
  // Obtener técnicas generales y de energías indeseables por separado
  const tecnicasGenerales = await obtenerTecnicasPorNivel(nivelAlumno, false);
  const tecnicasEnergiasIndeseables = await obtenerTecnicasPorNivel(nivelAlumno, true);
  
  // Obtener aspectos generales y de energías indeseables por separado
  const aspectosGenerales = await obtenerAspectosParaLimpiezaNuevo(student.id, tipoLimpieza, false);
  const aspectosEnergiasIndeseables = await obtenerAspectosParaLimpiezaNuevo(student.id, tipoLimpieza, true);
  
  const nombresLimpieza = {
    'rapida': '⚡ Limpieza Rápida',
    'basica': '🧘 Limpieza Básica',
    'profunda': '🌊 Limpieza Profunda',
    'total': '✨ Limpieza Total'
  };
  const nombreLimpieza = nombresLimpieza[tipoLimpieza] || 'Limpieza Energética';
  
  // Función auxiliar para generar HTML de técnicas
  function generarHTMLTecnicas(tecnicas) {
    if (tecnicas.length === 0) return '';
    return `
      <div class="tecnicas-container">
        <h2 class="tecnicas-titulo">📚 Técnicas Disponibles</h2>
        <div class="tecnicas-lista">
          ${tecnicas.map(tecnica => `
            <div class="tecnica-item">
              <div class="tecnica-nombre">${tecnica.nombre}</div>
              ${tecnica.descripcion ? `<div class="tecnica-descripcion">${tecnica.descripcion}</div>` : ''}
              <div class="tecnica-nivel">Nivel ${tecnica.nivel}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Función auxiliar para generar HTML de aspectos
  function generarHTMLAspectos(aspectos) {
    if (aspectos.length === 0) {
      return `
        <div class="mensaje-completado">
          <p>Has completado las limpiezas de tu nivel. ¡Felicidades! 🎉</p>
        </div>
      `;
    }
    
    // Agrupar por lista si no es rápida
    if (tipoLimpieza === 'rapida') {
      // Mezclados
      return aspectos.map(aspecto => {
        const estadoBadge = aspecto.estado === 'pasado' 
          ? '<span class="estado-badge estado-pasado">✨ Renovar su luz</span>'
          : '<span class="estado-badge estado-pendiente">⚠️ Pendiente</span>';
        
        return `
          <div class="aspecto-item" data-aspecto-id="${aspecto.id}">
            <label class="aspecto-checkbox">
              <input type="checkbox" class="checkbox-limpieza" data-aspecto-id="${aspecto.id}">
              <span class="checkmark"></span>
              <div class="aspecto-content">
                <div class="aspecto-nombre">${aspecto.nombre} ${estadoBadge}</div>
                ${aspecto.descripcion ? `<div class="aspecto-descripcion">${aspecto.descripcion}</div>` : ''}
                <div class="aspecto-lista">Lista: ${aspecto.lista_nombre}</div>
              </div>
            </label>
          </div>
        `;
      }).join('');
    } else {
      // Agrupados por lista
      const aspectosPorLista = {};
      aspectos.forEach(aspecto => {
        if (!aspectosPorLista[aspecto.lista_id]) {
          aspectosPorLista[aspecto.lista_id] = {
            nombre: aspecto.lista_nombre,
            items: []
          };
        }
        aspectosPorLista[aspecto.lista_id].items.push(aspecto);
      });
      
      return Object.values(aspectosPorLista).map(lista => {
        const itemsHTML = lista.items.map(aspecto => {
          const estadoBadge = aspecto.estado === 'pasado' 
            ? '<span class="estado-badge estado-pasado">✨ Renovar su luz</span>'
            : '<span class="estado-badge estado-pendiente">⚠️ Pendiente</span>';
          
          return `
            <div class="aspecto-item" data-aspecto-id="${aspecto.id}">
              <label class="aspecto-checkbox">
                <input type="checkbox" class="checkbox-limpieza" data-aspecto-id="${aspecto.id}">
                <span class="checkmark"></span>
                <div class="aspecto-content">
                  <div class="aspecto-nombre">${aspecto.nombre} ${estadoBadge}</div>
                  ${aspecto.descripcion ? `<div class="aspecto-descripcion">${aspecto.descripcion}</div>` : ''}
                </div>
              </label>
            </div>
          `;
        }).join('');
        
        return `
          <div class="lista-grupo">
            <h3 class="lista-titulo">${lista.nombre}</h3>
            ${itemsHTML}
          </div>
        `;
      }).join('');
    }
  }
  
  // Generar contenido para tab general
  const tecnicasGeneralesHTML = generarHTMLTecnicas(tecnicasGenerales);
  const aspectosGeneralesHTML = generarHTMLAspectos(aspectosGenerales);
  const totalAspectosGenerales = aspectosGenerales.length;
  
  // Generar contenido para tab energías indeseables (solo si hay aspectos)
  const tieneEnergiasIndeseables = aspectosEnergiasIndeseables.length > 0;
  const tecnicasEnergiasIndeseablesHTML = tieneEnergiasIndeseables ? generarHTMLTecnicas(tecnicasEnergiasIndeseables) : '';
  const aspectosEnergiasIndeseablesHTML = generarHTMLAspectos(aspectosEnergiasIndeseables);
  const totalAspectosEnergiasIndeseables = aspectosEnergiasIndeseables.length;
  
  const htmlTemplate = readFileSync(join(__dirname, '../core/html/limpieza-tipo.html'), 'utf-8');
  
  // Cliente no tiene tabs, admin sí. Por defecto es cliente
  const mostrarTabs = false; // Cliente sin tabs
  
  // Calcular total inicial según si hay tabs o no
  const totalInicial = mostrarTabs ? totalAspectosGenerales : (totalAspectosGenerales + totalAspectosEnergiasIndeseables);
  
  // Construir el contenido HTML según si hay tabs o no
  let contenidoHTML = '';
  
  if (mostrarTabs) {
    // Vista con tabs (admin)
    contenidoHTML = `
    <div class="tabs-container">
      <div class="tabs-header">
        <button class="tab-button active" data-tab="generales" onclick="cambiarTab('generales')">
          Limpiezas Generales
        </button>
        ${tieneEnergiasIndeseables ? `
        <button class="tab-button" data-tab="energias-indeseables" onclick="cambiarTab('energias-indeseables')">
          ⚠️ Energías Indeseables
        </button>
        ` : ''}
      </div>
      
      <!-- Tab Generales -->
      <div class="tab-content active" id="tab-generales">
        ${tecnicasGeneralesHTML}
        <div class="aspectos-container">
          ${aspectosGeneralesHTML}
        </div>
      </div>
      
      <!-- Tab Energías Indeseables -->
      ${tieneEnergiasIndeseables ? `
      <div class="tab-content" id="tab-energias-indeseables">
        ${tecnicasEnergiasIndeseablesHTML}
        <div class="aspectos-container">
          ${aspectosEnergiasIndeseablesHTML}
        </div>
      </div>
      ` : ''}
    </div>
    `;
  } else {
    // Vista sin tabs (cliente - de arriba a abajo)
    contenidoHTML = `
    <!-- Limpiezas Generales -->
    ${tecnicasGeneralesHTML}
    <div class="aspectos-container">
      ${aspectosGeneralesHTML}
    </div>
    
    <!-- Energías Indeseables (si las hay) -->
    ${tieneEnergiasIndeseables ? `
    <div style="margin-top: 30px;">
      <h2 style="font-size: 1.3rem; color: #5a3c00; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #ffd86b;">
        ⚠️ Energías Indeseables
      </h2>
      ${tecnicasEnergiasIndeseablesHTML}
      <div class="aspectos-container">
        ${aspectosEnergiasIndeseablesHTML}
      </div>
    </div>
    ` : ''}
    `;
  }
  
  // Preparar placeholders (sin condicionales en el HTML)
  const temaPreferido = student?.tema_preferido || 'dark';
  const placeholders = {
    TEMA_PREFERIDO: temaPreferido,
    IMAGEN_AURI: "https://images.typeform.com/images/tXs4JibWTbvb",
    NOMBRE_LIMPIEZA: nombreLimpieza,
    TIPO_LIMPIEZA: tipoLimpieza,
    CONTENIDO_HTML: contenidoHTML,
    TOTAL_ASPECTOS_GENERALES: totalAspectosGenerales,
    TOTAL_ASPECTOS_ENERGIAS_INDESEABLES: totalAspectosEnergiasIndeseables,
    TIENE_ENERGIAS_INDESEABLES: tieneEnergiasIndeseables ? 'true' : 'false',
    MOSTRAR_TABS: mostrarTabs ? 'true' : 'false',
    TOTAL_INICIAL: totalInicial,
    URL_VOLVER: "/limpieza"
  };
  
  let html = replace(htmlTemplate, placeholders);
  
  // Usar renderHtml centralizado (aplica tema y headers anti-cache automáticamente)
  return renderHtml(html, { student });
}

/**
 * Maneja la marca de un aspecto como limpio (POST)
 */
export async function handleMarcarLimpio(request, env) {
  try {
    // Obtener contexto de autenticación (devuelve Response si no autenticado)
    const authCtx = await requireStudentContext(request, env);
    if (authCtx instanceof Response) {
      return new Response(JSON.stringify({ success: false, error: 'No autenticado' }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Usar ctx.user en lugar de buscar alumno directamente
    const student = authCtx.user;
    
    const body = await request.json();
    const { aspecto_id } = body;
    
    if (!aspecto_id) {
      return new Response(JSON.stringify({ success: false, error: 'ID de aspecto requerido' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Marcar como limpiado usando el nuevo sistema
    await limpiarItemParaAlumno(aspecto_id, student.id);
    
    // ========================================================================
    // EMITIR EVENTO EN PARALELO (fail-open: no rompe si falla)
    // ========================================================================
    try {
      const ahora = new Date();
      const item = await obtenerItemPorId(aspecto_id);
      const lista = item ? await obtenerListaPorId(item.lista_id) : null;
      
      // Obtener estado antes (si existe)
      const estadoAntes = await query(`
        SELECT ultima_limpieza, veces_completadas 
        FROM items_transmutaciones_alumnos
        WHERE item_id = $1 AND alumno_id = $2
      `, [aspecto_id, student.id]).catch(() => null);
      
      const wasCleanBefore = estadoAntes?.rows?.[0]?.ultima_limpieza ? true : false;
      
      await insertEnergyEvent({
        occurred_at: ahora,
        event_type: 'cleaning',
        actor_type: 'alumno',
        actor_id: String(student.id),
        alumno_id: student.id,
        subject_type: 'transmutacion_item',
        subject_id: String(aspecto_id),
        origin: 'web_portal',
        notes: item ? `Limpieza de item transmutación ${item.nombre} desde portal alumno` : `Limpieza de item transmutación desde portal alumno`,
        metadata: {
          legacy_table_updated: true,
          item_id: aspecto_id,
          item_nombre: item?.nombre || null,
          lista_id: item?.lista_id || null,
          lista_nombre: lista?.nombre || null,
          tipo_lista: lista?.tipo || null,
          frecuencia_dias: item?.frecuencia_dias || null,
          veces_limpiar: item?.veces_limpiar || null
        },
        request_id: getRequestId(),
        requires_clean_state: true,
        was_clean_before: wasCleanBefore,
        is_clean_after: true,
        request: request,
        ctx: { request_id: getRequestId() }
      });
    } catch (energyError) {
      // FAIL-OPEN: No romper la limpieza legacy si falla el evento
      console.error(`[handleMarcarLimpio][EnergyEvent][FAIL] alumno_id=${student.id}`, energyError.message);
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error('Error en handleMarcarLimpio:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Verifica si una limpieza está completada (POST)
 */
export async function handleVerificarCompletada(request, env) {
  try {
    // Obtener contexto de autenticación (devuelve Response si no autenticado)
    const authCtx = await requireStudentContext(request, env);
    if (authCtx instanceof Response) {
      return new Response(JSON.stringify({ success: false, error: 'No autenticado' }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Usar ctx.user en lugar de buscar alumno directamente
    const student = authCtx.user;
    
    const body = await request.json();
    const { aspecto_ids } = body;
    
    if (!aspecto_ids || !Array.isArray(aspecto_ids)) {
      return new Response(JSON.stringify({ success: false, error: 'IDs de aspectos requeridos' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Verificar que todos los aspectos estén marcados
    // (esto se verifica en el frontend, aquí solo confirmamos)
    const todosMarcados = aspecto_ids.length > 0;
    
    if (!todosMarcados) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Debes marcar todos los aspectos como limpiados'
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Sumar racha (solo una vez por día)
    const streakResult = await checkDailyStreak(student, env, { forcePractice: false });
    
    return new Response(JSON.stringify({ 
      success: true, 
      completada: true,
      rachaSumada: streakResult.todayPracticed,
      racha: streakResult.streak,
      mensaje: streakResult.todayPracticed 
        ? `¡Limpieza completada! Tu racha ahora es de ${streakResult.streak} días. ${streakResult.motivationalPhrase || ''}`
        : '¡Limpieza completada! (Ya practicaste hoy, la racha no se incrementó)'
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error('Error en handleVerificarCompletada:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

