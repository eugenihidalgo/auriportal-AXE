// src/endpoints/admin-master.js
// Modo Master: Vista completa y detallada de un alumno (SOLO suscripción activa)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../../database/pg.js';
import { validarSuscripcionActiva, obtenerNotasAlumno, crearNota } from '../services/notas-master.js';
import { listarSecciones } from '../services/secciones-limpieza.js';
import { obtenerTransmutacionesPorAlumno, limpiarItemParaAlumno } from '../services/transmutaciones-energeticas.js';
import { findStudentById } from '../modules/student-v4.js';
import { computeProgress } from '../core/progress-engine.js';
import { computeStreakFromPracticas } from '../core/streak-engine.js';
import { gestionarEstadoSuscripcion } from '../modules/suscripcion-v4.js';
import { calcularDiasPausados, estaPausada } from '../modules/pausa-v4.js';
import { logAuditEvent } from '../core/audit/audit-service.js';
import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validar si una tabla existe en la base de datos
 */
async function tablaExiste(nombreTabla) {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `, [nombreTabla]);
    return result.rows[0]?.exists || false;
  } catch (error) {
    console.error(`❌ Error verificando existencia de tabla ${nombreTabla}:`, error.message);
    return false;
  }
}

/**
 * Validar si una columna existe en una tabla
 */
async function columnaExiste(nombreTabla, nombreColumna) {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = $2
      ) AS exists
    `, [nombreTabla, nombreColumna]);
    return result.rows[0]?.exists || false;
  } catch (error) {
    console.error(`❌ Error verificando existencia de columna ${nombreTabla}.${nombreColumna}:`, error.message);
    return false;
  }
}

// Templates ya no se cargan aquí, se usan a través de renderAdminPage

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

/**
 * Validar que el alumno tiene suscripción activa y obtener contexto V4
 * Devuelve { alumno, ctx } donde:
 * - alumno: datos legacy del alumno (para compatibilidad)
 * - ctx: studentContext V4 (null si falla, con fail-open)
 */
async function validarYobtenerAlumno(alumnoId) {
  // Primero obtener el alumno legacy
  const result = await query(
    `SELECT id, email, apodo, nombre_completo, nivel_actual, 
            estado_suscripcion, streak as racha,
            fecha_ultima_practica, fecha_nacimiento, hora_nacimiento, lugar_nacimiento
     FROM alumnos 
     WHERE id = $1 AND estado_suscripcion = 'activa'`,
    [alumnoId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const alumno = result.rows[0];
  
  // Obtener la fase basándose en el nivel (legacy, solo para compatibilidad)
  const nivel = alumno.nivel_actual || 1;
  const faseResult = await query(
    `SELECT fase FROM niveles_fases 
     WHERE (nivel_min IS NULL OR $1 >= nivel_min) 
       AND (nivel_max IS NULL OR $1 <= nivel_max)
     ORDER BY nivel_min DESC
     LIMIT 1`,
    [nivel]
  );
  
  alumno.fase_actual = faseResult.rows.length > 0 ? faseResult.rows[0].fase : 'sanación';
  
  // FASE 1: Cargar studentContext V4 (fail-open controlado)
  let ctx = null;
  try {
    // Obtener student desde student-v4.js
    const student = await findStudentById(alumnoId);
    
    if (!student) {
      console.warn(`[Master][CTX_FAIL] alumnoId=${alumnoId} error=student_not_found`);
      return { alumno, ctx: null };
    }
    
    // Construir contexto usando las mismas funciones que buildStudentContext()
    // (sin pasar por autenticación, ya que estamos en contexto admin)
    
    // 1. Calcular progreso (nivel + fase)
    const progressResult = await computeProgress({ 
      student, 
      now: new Date(), 
      env: {} 
    });
    
    // 2. Obtener racha canónica desde practicas (FASE 1.5)
    let streakResult;
    try {
      streakResult = await computeStreakFromPracticas(alumnoId);
      console.log(`[Master][StreakEngine] alumnoId=${alumnoId} actual=${streakResult.actual} hoy_practicado=${streakResult.hoy_practicado}`);
    } catch (streakError) {
      console.error(`[Master][StreakEngine][FAIL] alumnoId=${alumnoId} error=${streakError.message}`);
      // Fail-open: usar valores por defecto
      streakResult = {
        actual: student.streak || 0,
        hoy_practicado: false,
        congelada_por_pausa: false,
        dias_congelados: 0
      };
    }
    
    // 3. Obtener estado de suscripción (pausas)
    const estadoSuscripcion = await gestionarEstadoSuscripcion(
      student.email, 
      {}, 
      student, 
      null
    );
    
    // 4. Obtener pausas activas (FASE 2B: usar estaPausada como fuente canónica)
    let pausaActiva = false;
    try {
      pausaActiva = await estaPausada(alumnoId);
    } catch (pausaError) {
      console.warn(`[Master][CTX_FAIL] alumnoId=${alumnoId} error=pausa_calculation errorMsg=${pausaError.message}`);
      // Continuar sin información de pausa (fail-open)
      pausaActiva = false;
    }
    
    // Construir contexto simplificado (solo lo necesario para la cabecera)
    ctx = {
      progress: {
        nivel_efectivo: progressResult.nivel_efectivo,
        nivel_base: progressResult.nivel_base,
        fase_efectiva: progressResult.fase_efectiva
      },
      streak: {
        actual: streakResult.actual,
        hoy_practicado: streakResult.hoy_practicado,
        congelada_por_pausa: streakResult.congelada_por_pausa,
        dias_congelados: streakResult.dias_congelados
      },
      pausas: {
        activa: pausaActiva
      }
    };
    
    console.log(`[Master][CTX_OK] alumnoId=${alumnoId} nivel_efectivo=${ctx.progress.nivel_efectivo} fase=${typeof ctx.progress.fase_efectiva === 'object' ? ctx.progress.fase_efectiva.nombre : ctx.progress.fase_efectiva} streak=${ctx.streak.actual}`);
    
  } catch (error) {
    // Fail-open: continuar con ctx = null y usar datos legacy
    console.error(`[Master][CTX_FAIL] alumnoId=${alumnoId} error=${error.message}`);
    ctx = null;
  }
  
  return { alumno, ctx };
}

/**
 * FASE 2B: Validación centralizada de pausa activa para acciones mutables
 * 
 * Regla canónica:
 * - SI ctx.pausas.activa === true → BLOQUEAR acción mutable
 * - SI ctx NO está disponible → PERMITIR (fail-open) con log
 * 
 * @param {number} alumnoId - ID del alumno
 * @param {string} actionName - Nombre de la acción (para logs)
 * @returns {Promise<{blocked: boolean, response: Response|null}>}
 *   - blocked: true si la acción está bloqueada
 *   - response: Response con 403 si está bloqueada, null si está permitida
 */
async function checkPausaActiva(alumnoId, actionName, request = null) {
  try {
    // Obtener contexto del alumno
    const resultado = await validarYobtenerAlumno(alumnoId);
    
    if (!resultado || !resultado.ctx) {
      // Fail-open: si no hay contexto, permitir la acción
      console.log(`[Master][PAUSE_FALLBACK] alumnoId=${alumnoId} action=${actionName} reason=ctx_not_available`);
      return { blocked: false, response: null };
    }
    
    const ctx = resultado.ctx;
    
    // Verificar si hay pausa activa
    if (ctx.pausas && ctx.pausas.activa === true) {
      // BLOQUEAR: pausa activa detectada
      console.log(`[Master][PAUSE_BLOCK] alumnoId=${alumnoId} action=${actionName}`);
      
      // FASE 3: Registrar evento de bloqueo por pausa
      try {
        await logAuditEvent({
          actor: 'admin',
          actorId: null, // Se puede obtener del contexto admin si está disponible
          alumnoId: Number(alumnoId),
          action: 'pause_block',
          entityType: 'alumno',
          entityId: String(alumnoId),
          payload: {
            actionName,
            pausaActiva: true,
            pausaId: ctx.pausas.pausaActiva?.id || null,
            motivo: ctx.pausas.pausaActiva?.motivo || null
          },
          req: request
        });
      } catch (auditError) {
        // Fail-open: no fallar si la auditoría falla
        console.warn(`[Master][PAUSE_BLOCK] Error registrando auditoría: ${auditError.message}`);
      }
      
      const response = new Response(
        JSON.stringify({ 
          error: 'El alumno está en pausa activa. Acción no permitida.' 
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      return { blocked: true, response };
    }
    
    // PERMITIR: no hay pausa activa
    console.log(`[Master][PAUSE_ALLOW] alumnoId=${alumnoId} action=${actionName}`);
    return { blocked: false, response: null };
    
  } catch (error) {
    // Fail-open: en caso de error, permitir la acción
    console.error(`[Master][PAUSE_FALLBACK] alumnoId=${alumnoId} action=${actionName} error=${error.message}`);
    return { blocked: false, response: null };
  }
}

/**
 * GET /admin/master/:alumnoId - Vista principal del Modo Master
 */
export async function renderMaster(request, env, alumnoId) {
  try {
    // Validar suscripción activa y obtener contexto V4
    const resultado = await validarYobtenerAlumno(alumnoId);
    
    if (!resultado || !resultado.alumno) {
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <title>Acceso Denegado - Modo Master</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: #1e293b;
      border-radius: 0.5rem;
      border: 1px solid #334155;
      max-width: 600px;
    }
    h1 { color: #ef4444; margin-bottom: 1rem; }
    p { color: #94a3b8; margin-bottom: 1rem; }
    a {
      color: #60a5fa;
      text-decoration: none;
      display: inline-block;
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: #1e40af;
      border-radius: 0.25rem;
    }
    a:hover { background: #1e3a8a; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔒 Acceso Denegado</h1>
    <p>El Modo Master solo está disponible para alumnos con suscripción activa.</p>
    <p>Este alumno no tiene una suscripción activa y no puede verse en el Modo Master.</p>
    <a href="/admin/alumnos">← Volver a Alumnos</a>
  </div>
</body>
</html>`,
        {
          status: 403,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        }
      );
    }

    const { alumno, ctx } = resultado;
    
    // Obtener datos básicos adicionales
    // El apodo es el identificador humano principal; si no hay apodo, usar email
    const nombreDisplay = alumno.apodo || alumno.nombre_completo || alumno.email;
    const primeraLetra = (nombreDisplay || 'A').charAt(0).toUpperCase();
    
    // FASE 1: Usar datos canónicos del contexto V4 si está disponible
    let nivelMostrar, faseMostrar, rachaMostrar;
    let indicadorLegacy = '';
    
    if (ctx && ctx.progress) {
      // Datos canónicos del Sistema de Progreso V4
      nivelMostrar = ctx.progress.nivel_efectivo || 1;
      const faseEfectiva = ctx.progress.fase_efectiva;
      faseMostrar = typeof faseEfectiva === 'object' ? faseEfectiva.nombre : (faseEfectiva || 'sanación');
      rachaMostrar = ctx.streak && ctx.streak.actual !== undefined ? ctx.streak.actual : 0;
    } else {
      // Fallback a datos legacy (marcado visualmente)
      nivelMostrar = alumno.nivel_actual || 1;
      faseMostrar = alumno.fase_actual || 'sanación';
      rachaMostrar = alumno.racha || 0;
      indicadorLegacy = ' <span class="text-yellow-400 text-xs">(LEGACY / FALLBACK)</span>';
      console.log(`[Master][CTX_FALLBACK] alumnoId=${alumnoId} usando datos legacy`);
    }
    
    // Generar contenido HTML para el Modo Master
    const content = `
      <!-- Cabecera del Alumno -->
      <div class="bg-slate-800 rounded-lg p-6 mb-6 shadow-lg">
        <div class="flex justify-between items-start">
          <div class="flex items-center gap-4 flex-1">
            <!-- Avatar -->
            <div class="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-3xl text-white font-bold">
              ${primeraLetra}
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h2 class="text-2xl font-bold text-white">${nombreDisplay}</h2>
                <button 
                  id="btn-editar-apodo" 
                  class="text-indigo-400 hover:text-indigo-300 text-sm font-medium px-3 py-1 border border-indigo-600 rounded hover:bg-indigo-900/30 transition-colors"
                  title="Editar apodo del alumno">
                  ✏️ Editar Apodo
                </button>
              </div>
              
              <!-- Apodo destacado (editable) -->
              <div class="mb-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-indigo-400 font-semibold text-sm">👤 Apodo (Identificador Principal):</span>
                  <span id="apodo-display" class="text-white font-semibold text-base">${alumno.apodo || '<span class="text-slate-500 italic">Sin apodo</span>'}</span>
                </div>
                <p class="text-xs text-slate-400 mt-1">El apodo es el identificador humano principal del alumno en el sistema.</p>
              </div>
              
              <div class="flex items-center gap-3 text-sm text-slate-300 flex-wrap">
                <span>📧 ${alumno.email || 'N/A'}</span>
                <span>•</span>
                <span>⭐ Nivel ${nivelMostrar}${indicadorLegacy}</span>
                <span>•</span>
                <span>🔑 Fase: ${faseMostrar}</span>
                <span>•</span>
                <span>🔥 Racha: ${rachaMostrar} días</span>
                ${ctx && ctx.pausas && ctx.pausas.activa ? '<span>•</span><span class="text-yellow-400">⏸️ Pausa activa</span>' : ''}
              </div>
              <div class="text-xs text-slate-400 mt-2">
                📅 Última práctica: ${alumno.fecha_ultima_practica 
                  ? new Date(alumno.fecha_ultima_practica).toLocaleDateString('es-ES')
                  : 'Nunca'}
              </div>
            </div>
          </div>
          <div class="flex gap-3">
            <a href="/portal/master-view/${alumnoId}" 
               class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg text-sm">
              👁️ Ver como alumno
            </a>
            <a href="/admin/alumno/${alumnoId}" 
               class="bg-slate-700 text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600 text-sm">
              ✏️ Editar alumno
            </a>
          </div>
        </div>
      </div>
      
      <!-- Tabs Navigation -->
      <div class="bg-slate-800 rounded-t-lg border-b border-slate-700 px-6 mb-0">
        <div class="flex gap-2 overflow-x-auto">
          <button data-tab="tab-info" 
                  class="tab-button bg-indigo-600 text-white px-4 py-3 rounded-t-lg hover:bg-indigo-700 transition-colors whitespace-nowrap font-medium">
            📋 Información General
          </button>
          <button data-tab="tab-transmutaciones" 
                  class="tab-button bg-slate-700 text-slate-300 px-4 py-3 rounded-t-lg hover:bg-slate-600 transition-colors whitespace-nowrap font-medium">
            🌟 Transmutaciones PDE
          </button>
          <button data-tab="tab-energetico" 
                  class="tab-button bg-slate-700 text-slate-300 px-4 py-3 rounded-t-lg hover:bg-slate-600 transition-colors whitespace-nowrap font-medium">
            🧹 Limpieza Energética
          </button>
          <button data-tab="tab-gamificado" 
                  class="tab-button bg-slate-700 text-slate-300 px-4 py-3 rounded-t-lg hover:bg-slate-600 transition-colors whitespace-nowrap font-medium">
            🎮 Progreso Gamificado
          </button>
          <button data-tab="tab-practicas" 
                  class="tab-button bg-slate-700 text-slate-300 px-4 py-3 rounded-t-lg hover:bg-slate-600 transition-colors whitespace-nowrap font-medium">
            🔥 Prácticas y Reflexiones
          </button>
          <button data-tab="tab-creacion" 
                  class="tab-button bg-slate-700 text-slate-300 px-4 py-3 rounded-t-lg hover:bg-slate-600 transition-colors whitespace-nowrap font-medium">
            ✨ Creación
          </button>
          <button data-tab="tab-cooperacion" 
                  class="tab-button bg-slate-700 text-slate-300 px-4 py-3 rounded-t-lg hover:bg-slate-600 transition-colors whitespace-nowrap font-medium">
            🤝 Cooperación con otros
          </button>
          <button data-tab="tab-emocional" 
                  class="tab-button bg-slate-700 text-slate-300 px-4 py-3 rounded-t-lg hover:bg-slate-600 transition-colors whitespace-nowrap font-medium">
            💚 Área Emocional
          </button>
          <button data-tab="tab-notas" 
                  class="tab-button bg-slate-700 text-slate-300 px-4 py-3 rounded-t-lg hover:bg-slate-600 transition-colors whitespace-nowrap font-medium">
            📝 Notas del Master
          </button>
        </div>
      </div>
      
      <!-- Tab Contents -->
      <div class="bg-slate-800 rounded-b-lg p-6 min-h-[500px]">
        
        <!-- Tab 1: Información General -->
        <div id="tab-info" class="tab-content" style="display: block !important;" data-alumno-id="${alumnoId}" data-loaded="false">
          <!-- FASE 3: Bloque de Pausas (siempre visible) -->
          <div class="bg-slate-800 rounded-lg p-6 mb-6 shadow-lg border ${ctx && ctx.pausas && ctx.pausas.activa ? 'border-yellow-500' : 'border-slate-700'}">
            <div class="flex justify-between items-start mb-4">
              <h3 class="text-xl font-bold text-white flex items-center gap-2">
                ⏸️ Gestión de Pausas
                ${ctx && ctx.pausas && ctx.pausas.activa 
                  ? '<span class="text-yellow-400 text-sm font-normal">(Pausa Activa)</span>' 
                  : '<span class="text-green-400 text-sm font-normal">(Sin Pausa)</span>'}
              </h3>
              <div class="flex gap-2">
                ${ctx && ctx.pausas && ctx.pausas.activa 
                  ? `<button id="btn-finalizar-pausa" class="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium">
                      ✅ Finalizar Pausa
                    </button>`
                  : `<button id="btn-crear-pausa" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                      ➕ Crear Pausa
                    </button>`}
              </div>
            </div>
            
            <div id="pausa-info" class="text-slate-300 text-sm">
              <div class="text-slate-400">Cargando información de pausas...</div>
            </div>
          </div>
          
          <div class="text-center py-8">
            <div class="text-slate-400">Cargando información general...</div>
          </div>
        </div>
        
        <!-- Tab 2: Transmutaciones PDE -->
        <div id="tab-transmutaciones" class="tab-content" style="display: none;" data-alumno-id="${alumnoId}" data-loaded="false">
          <div class="text-center py-8">
            <div class="text-slate-400">Cargando transmutaciones PDE...</div>
          </div>
        </div>
        
        <!-- Tab 3: Limpieza Energética -->
        <div id="tab-energetico" class="tab-content" style="display: none;" data-alumno-id="${alumnoId}" data-loaded="false">
          <div class="text-center py-8">
            <div class="text-slate-400">Cargando limpieza energética...</div>
          </div>
        </div>
        
        <!-- Tab 3: Progreso Gamificado -->
        <div id="tab-gamificado" class="tab-content" style="display: none;" data-alumno-id="${alumnoId}" data-loaded="false">
          <div class="text-center py-8">
            <div class="text-slate-400">Cargando progreso gamificado...</div>
          </div>
        </div>
        
        <!-- Tab 4: Prácticas y Reflexiones -->
        <div id="tab-practicas" class="tab-content" style="display: none;" data-alumno-id="${alumnoId}" data-loaded="false">
          <div class="text-center py-8">
            <div class="text-slate-400">Cargando prácticas y reflexiones...</div>
          </div>
        </div>
        
        <!-- Tab 5: Creación -->
        <div id="tab-creacion" class="tab-content" style="display: none;" data-alumno-id="${alumnoId}" data-loaded="false">
          <div class="text-center py-8">
            <div class="text-slate-400">Cargando datos de creación...</div>
          </div>
        </div>
        
        <!-- Tab 6: Cooperación con otros -->
        <div id="tab-cooperacion" class="tab-content" style="display: none;" data-alumno-id="${alumnoId}" data-loaded="false">
          <div class="text-center py-8">
            <div class="text-slate-400">Cargando cooperación con otros...</div>
          </div>
        </div>
        
        <!-- Tab 7: Área Emocional -->
        <div id="tab-emocional" class="tab-content" style="display: none;" data-alumno-id="${alumnoId}" data-loaded="false">
          <div class="text-center py-8">
            <div class="text-slate-400">Cargando área emocional...</div>
          </div>
        </div>
        
        <!-- Tab 8: Notas del Master -->
        <div id="tab-notas" class="tab-content" style="display: none;" data-alumno-id="${alumnoId}" data-loaded="false">
          <div class="text-center py-8">
            <div class="text-slate-400">Cargando notas...</div>
          </div>
        </div>
        
      </div>
      
      <script src="/js/admin-master.js?v=${Date.now()}"></script>
      <script>
        // Funcionalidad de edición de apodo
        document.addEventListener('DOMContentLoaded', function() {
          const btnEditarApodo = document.getElementById('btn-editar-apodo');
          const apodoDisplay = document.getElementById('apodo-display');
          const alumnoId = ${alumnoId};
          
          if (btnEditarApodo && apodoDisplay) {
            btnEditarApodo.addEventListener('click', async function() {
              const apodoActual = apodoDisplay.textContent.trim();
              const apodoSinEtiqueta = apodoActual.includes('Sin apodo') ? '' : apodoActual;
              
              // Usar prompt mejorado si está disponible, sino usar prompt nativo
              const nuevoApodo = typeof mostrarModalFormulario !== 'undefined'
                ? await mostrarModalFormulario({
                    titulo: 'Editar Apodo del Alumno',
                    ayuda: 'El apodo es el identificador humano principal del alumno en el sistema. Puede dejarse vacío para eliminarlo.',
                    campos: [{
                      nombre: 'apodo',
                      etiqueta: 'Apodo',
                      tipo: 'text',
                      valor: apodoSinEtiqueta,
                      placeholder: 'Ej: Juan, María, etc.'
                    }],
                    botonTexto: 'Guardar Apodo'
                  }).then(result => result.apodo).catch(() => null)
                : prompt('Ingrese el nuevo apodo (deje vacío para eliminar):', apodoSinEtiqueta);
              
              if (nuevoApodo === null) return; // Usuario canceló
              
              // Normalizar: string vacío se convierte en null
              const apodoParaGuardar = nuevoApodo.trim() === '' ? null : nuevoApodo.trim();
              
              try {
                btnEditarApodo.disabled = true;
                btnEditarApodo.textContent = '⏳ Guardando...';
                
                const response = await fetch('/admin/master/' + alumnoId + '/apodo', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ apodo: apodoParaGuardar })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                  // Actualizar display
                  apodoDisplay.innerHTML = data.alumno.apodo || '<span class="text-slate-500 italic">Sin apodo</span>';
                  
                  // Actualizar título si es necesario
                  const tituloPrincipal = document.querySelector('h2.text-2xl');
                  if (tituloPrincipal) {
                    tituloPrincipal.textContent = data.alumno.apodo || data.alumno.email;
                  }
                  
                  // Mostrar mensaje de éxito
                  const mensaje = document.createElement('div');
                  mensaje.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
                  mensaje.textContent = '✅ Apodo actualizado correctamente';
                  document.body.appendChild(mensaje);
                  setTimeout(() => mensaje.remove(), 3000);
                  
                  // Recargar datos del alumno para reflejar cambios
                  if (typeof loadTabData === 'function') {
                    const tabActivo = document.querySelector('.tab-content[style*="display: block"]')?.id;
                    if (tabActivo) {
                      const tabContent = document.getElementById(tabActivo);
                      if (tabContent) {
                        tabContent.dataset.loaded = 'false';
                        loadTabData(tabActivo);
                      }
                    }
                  }
                } else {
                  throw new Error(data.error || 'Error al actualizar apodo');
                }
              } catch (error) {
                console.error('Error actualizando apodo:', error);
                alert('❌ Error al actualizar apodo: ' + error.message);
              } finally {
                btnEditarApodo.disabled = false;
                btnEditarApodo.textContent = '✏️ Editar Apodo';
              }
            });
          }
          
          // FASE 3: Funcionalidad de gestión de pausas
          const btnCrearPausa = document.getElementById('btn-crear-pausa');
          const btnFinalizarPausa = document.getElementById('btn-finalizar-pausa');
          const pausaInfo = document.getElementById('pausa-info');
          
          // Función para actualizar información de pausas
          async function actualizarInfoPausas() {
            try {
              const response = await fetch('/admin/master/' + alumnoId + '/data');
              const data = await response.json();
              
              if (data.pausas) {
                const { activa, pausaActiva, historial, diasPausados } = data.pausas;
                
                let html = '';
                if (activa && pausaActiva) {
                  const inicio = new Date(pausaActiva.inicio);
                  html = \`
                    <div class="mb-3 p-3 bg-yellow-900/30 rounded-lg border border-yellow-700">
                      <div class="font-semibold text-yellow-400 mb-2">⏸️ Pausa Activa</div>
                      <div class="text-sm space-y-1">
                        <div><strong>Inicio:</strong> \${inicio.toLocaleDateString('es-ES')} \${inicio.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                        \${pausaActiva.motivo ? \`<div><strong>Motivo:</strong> \${pausaActiva.motivo}</div>\` : ''}
                        <div><strong>Días pausados totales:</strong> \${diasPausados || 0} días</div>
                      </div>
                    </div>
                  \`;
                } else {
                  html = \`
                    <div class="mb-3 p-3 bg-green-900/30 rounded-lg border border-green-700">
                      <div class="font-semibold text-green-400 mb-2">✅ Sin Pausa Activa</div>
                      <div class="text-sm"><strong>Días pausados totales:</strong> \${diasPausados || 0} días</div>
                    </div>
                  \`;
                }
                
                if (historial && historial.length > 0) {
                  html += '<div class="mt-3"><div class="font-semibold text-slate-300 mb-2">📋 Historial (últimas 10):</div><div class="text-xs space-y-1 max-h-40 overflow-y-auto">';
                  historial.forEach(p => {
                    const inicio = new Date(p.inicio);
                    const fin = p.fin ? new Date(p.fin) : null;
                    html += \`
                      <div class="p-2 bg-slate-900/50 rounded border border-slate-700">
                        <div><strong>Inicio:</strong> \${inicio.toLocaleDateString('es-ES')}</div>
                        <div><strong>Fin:</strong> \${fin ? fin.toLocaleDateString('es-ES') : 'Activa'}</div>
                        \${p.motivo ? \`<div><strong>Motivo:</strong> \${p.motivo}</div>\` : ''}
                      </div>
                    \`;
                  });
                  html += '</div></div>';
                }
                
                if (pausaInfo) {
                  pausaInfo.innerHTML = html;
                }
              }
            } catch (err) {
              console.error('Error actualizando info de pausas:', err);
              if (pausaInfo) {
                pausaInfo.innerHTML = '<div class="text-red-400 text-sm">Error cargando información de pausas</div>';
              }
            }
          }
          
          // Botón crear pausa
          if (btnCrearPausa) {
            btnCrearPausa.addEventListener('click', async function() {
              const motivo = prompt('Ingrese el motivo de la pausa (requerido):');
              if (!motivo || motivo.trim().length === 0) {
                alert('El motivo es requerido');
                return;
              }
              
              try {
                btnCrearPausa.disabled = true;
                btnCrearPausa.textContent = '⏳ Creando...';
                
                const response = await fetch('/admin/master/' + alumnoId + '/pausas/crear', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ motivo: motivo.trim() })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                  alert('✅ Pausa creada correctamente');
                  location.reload();
                } else {
                  throw new Error(data.error || 'Error al crear pausa');
                }
              } catch (error) {
                console.error('Error creando pausa:', error);
                alert('❌ Error al crear pausa: ' + error.message);
              } finally {
                btnCrearPausa.disabled = false;
                btnCrearPausa.textContent = '➕ Crear Pausa';
              }
            });
          }
          
          // Botón finalizar pausa
          if (btnFinalizarPausa) {
            btnFinalizarPausa.addEventListener('click', async function() {
              if (!confirm('¿Está seguro de que desea finalizar la pausa activa?')) {
                return;
              }
              
              try {
                btnFinalizarPausa.disabled = true;
                btnFinalizarPausa.textContent = '⏳ Finalizando...';
                
                const response = await fetch('/admin/master/' + alumnoId + '/pausas/finalizar', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({})
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                  alert('✅ Pausa finalizada correctamente');
                  location.reload();
                } else {
                  throw new Error(data.error || 'Error al finalizar pausa');
                }
              } catch (error) {
                console.error('Error finalizando pausa:', error);
                alert('❌ Error al finalizar pausa: ' + error.message);
              } finally {
                btnFinalizarPausa.disabled = false;
                btnFinalizarPausa.textContent = '✅ Finalizar Pausa';
              }
            });
          }
          
          // Cargar información de pausas al inicio
          actualizarInfoPausas();
        });
        
        // Asegurar que openTab esté disponible globalmente
        window.openTab = typeof openTab !== 'undefined' ? openTab : function(tabId) {
          // Fallback si el script no se cargó
          document.querySelectorAll('.tab-content').forEach(div => {
            div.style.display = 'none';
          });
          document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('bg-indigo-600', 'text-white');
            btn.classList.add('bg-slate-700', 'text-slate-300');
          });
          const tabContent = document.getElementById(tabId);
          if (tabContent) {
            tabContent.style.display = 'block';
          }
          const button = document.querySelector('[data-tab="' + tabId + '"]');
          if (button) {
            button.classList.remove('bg-slate-700', 'text-slate-300');
            button.classList.add('bg-indigo-600', 'text-white');
          }
        };
        
        // Agregar event listeners a los botones de pestañas
        document.addEventListener('DOMContentLoaded', function() {
          console.log('Modo Master: Inicializando pestañas...');
          
          // Agregar event listeners a todos los botones de pestañas
          document.querySelectorAll('[data-tab]').forEach(button => {
            button.addEventListener('click', function() {
              const tabId = this.getAttribute('data-tab');
              if (typeof openTab === 'function') {
                openTab(tabId);
              } else {
                window.openTab(tabId);
              }
            });
          });
          
          // Inicializar primera pestaña
          if (typeof openTab === 'function') {
            openTab('tab-info');
          } else {
            window.openTab('tab-info');
          }
        });
      </script>
    `;
    
    // Usar apodo como identificador principal en el título
    const tituloPagina = alumno.apodo || alumno.nombre_completo || alumno.email;
    const url = new URL(request.url);
    const activePath = url.pathname;

    return renderAdminPage({
      title: `Modo Master: ${tituloPagina}`,
      contentHtml: content,
      activePath,
      userContext: { isAdmin: true }
    });
  } catch (error) {
    console.error('❌ Error en renderMaster:', error);
    return new Response('Error interno del servidor: ' + error.message, { status: 500 });
  }
}

/**
 * Obtener limpiezas de hoy del master para un alumno
 */
async function obtenerLimpiezasHoy(alumnoId) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const result = await query(
    `SELECT 
      id,
      tipo,
      aspecto_id,
      aspecto_nombre,
      seccion,
      fecha_limpieza,
      created_at
    FROM limpiezas_master_historial
    WHERE alumno_id = $1
      AND fecha_limpieza >= $2
      AND fecha_limpieza < $3
    ORDER BY fecha_limpieza DESC`,
    [alumnoId, hoy, manana]
  );

  return result.rows || [];
}

/**
 * GET /admin/master/:alumnoId/data - Datos JSON para poblar las pestañas
 */
export async function getMasterData(request, env, alumnoId) {
  try {
    // Validar suscripción activa y obtener contexto V4
    const resultado = await validarYobtenerAlumno(alumnoId);
    
    if (!resultado || !resultado.alumno) {
      return new Response(
        JSON.stringify({ error: 'Alumno no tiene suscripción activa' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { alumno, ctx } = resultado;
    
    // FASE 2A: Extraer nivel_efectivo desde ctx (canónico) con fail-open controlado
    let nivelEfectivo;
    if (ctx && ctx.progress && ctx.progress.nivel_efectivo !== undefined) {
      nivelEfectivo = ctx.progress.nivel_efectivo;
      console.log(`[Master][LEVEL_FILTER] alumnoId=${alumnoId} nivel_efectivo=${nivelEfectivo} seccion=inicializacion`);
    } else {
      // Fail-open: usar nivel_actual como fallback explícito
      nivelEfectivo = alumno.nivel_actual || 1;
      console.log(`[Master][LEVEL_FALLBACK] alumnoId=${alumnoId} nivel_actual=${nivelEfectivo}`);
    }

    // El contexto (ctx) está disponible internamente pero no se expone en JSON
    // para mantener compatibilidad con código frontend existente
    // En FASE 1 solo se usa en la cabecera renderizada

    // Validar tablas críticas antes de hacer queries
    const tablasRequeridas = [
      'superprioritarios',
      'aspectos_energeticos',
      'aspectos_karmicos',
      'aspectos_indeseables',
      'limpiezas_master_historial'
    ];
    
    const tablasExistentes = {};
    for (const tabla of tablasRequeridas) {
      tablasExistentes[tabla] = await tablaExiste(tabla);
    }

    // Verificar columnas críticas antes de hacer queries
    const columnasExistentes = {
      aspectos_energeticos_nivel_minimo: await columnaExiste('aspectos_energeticos', 'nivel_minimo'),
      aspectos_karmicos_nivel_minimo: await columnaExiste('aspectos_karmicos', 'nivel_minimo'),
      aspectos_indeseables_nivel_minimo: await columnaExiste('aspectos_indeseables', 'nivel_minimo'),
      aspectos_indeseables_alumnos_veces_limpiado: await columnaExiste('aspectos_indeseables_alumnos', 'veces_limpiado'),
      aspectos_energeticos_alumnos_metadata: await columnaExiste('aspectos_energeticos_alumnos', 'metadata'),
      aspectos_karmicos_alumnos_metadata: await columnaExiste('aspectos_karmicos_alumnos', 'metadata'),
      aspectos_indeseables_alumnos_metadata: await columnaExiste('aspectos_indeseables_alumnos', 'metadata'),
      transmutaciones_lugares_alumno_id: await columnaExiste('transmutaciones_lugares', 'alumno_id'),
      transmutaciones_proyectos_alumno_id: await columnaExiste('transmutaciones_proyectos', 'alumno_id'),
      limpieza_hogar_nivel_minimo: await columnaExiste('limpieza_hogar', 'nivel_minimo')
    };

    // Obtener fase del alumno
    const fase = alumno.fase_actual || 'sanación';

    // Obtener datos adicionales del alumno (nacimiento, ajustes)
    const alumnoCompleto = await query(
      `SELECT fecha_nacimiento, hora_nacimiento, lugar_nacimiento, ajustes 
       FROM alumnos WHERE id = $1`,
      [alumnoId]
    );
    const datosNacimiento = alumnoCompleto.rows[0] || {};

    // Función helper para ejecutar consultas de forma segura
    const ejecutarConsultaSegura = async (consultaPromise, nombreConsulta) => {
      try {
        return await consultaPromise;
      } catch (err) {
        console.error(`❌ Error en consulta ${nombreConsulta}:`, err.message);
        // Si el error es por columnas que no existen, devolver estructura vacía
        if (err.message.includes('does not exist') || err.message.includes('column')) {
          console.warn(`⚠️ Columna no existe en ${nombreConsulta}, devolviendo estructura vacía`);
          return { rows: [] };
        }
        // Para otros errores, también devolver estructura vacía para no romper todo
        return { rows: [] };
      }
    };

    // Obtener todos los datos necesarios
    const [
      superprioritarios,
      cartaAstral,
      disenohumano,
      ajustes,
      disponibilidad,
      sinergias,
      aspectos,
      aspectosAlumnos,
      aspectosKarmicos,
      aspectosKarmicosAlumnos,
      aspectosIndeseables,
      aspectosIndeseablesAlumnos,
      practicas,
      reflexiones,
      audios,
      objetivos,
      problemas,
      versionFutura,
      emocional,
      misiones,
      logros,
      skilltree,
      arquetipos,
      auribosses,
      tokens,
      transmutacionesLugares,
      transmutacionesProyectos,
      transmutacionesApadrinados,
      transmutacionesEnergeticas,
      limpiezaHogar,
      notas,
      limpiezasHoy,
      seccionesLimpieza
    ] = await Promise.all([
      // Superprioritarios - solo si la tabla existe
      tablasExistentes.superprioritarios
        ? query('SELECT * FROM superprioritarios WHERE alumno_id = $1 ORDER BY fecha DESC', [alumnoId])
        : Promise.resolve({ rows: [] }),
      // Carta Astral
      query('SELECT * FROM carta_astral WHERE alumno_id = $1', [alumnoId]),
      
      // Diseño Humano
      query('SELECT * FROM disenohumano WHERE alumno_id = $1', [alumnoId]),
      
      // Ajustes (ya obtenidos arriba, pero lo incluimos aquí para consistencia)
      Promise.resolve({ rows: [{ ajustes: datosNacimiento.ajustes || {} }] }),
      
      // Disponibilidad
      query('SELECT * FROM alumnos_disponibilidad WHERE alumno_id = $1', [alumnoId]),
      
      // Sinergias (prácticas conjuntas)
      query(`
        SELECT pc.*, 
               a1.apodo as alumno1_apodo, a1.nombre_completo as alumno1_nombre,
               a2.apodo as alumno2_apodo, a2.nombre_completo as alumno2_nombre
        FROM practicas_conjuntas pc
        LEFT JOIN alumnos a1 ON pc.alumno1_id = a1.id
        LEFT JOIN alumnos a2 ON pc.alumno2_id = a2.id
        WHERE pc.alumno1_id = $1 OR pc.alumno2_id = $1
        ORDER BY pc.fecha DESC
        LIMIT 20
      `, [alumnoId]),
      
      // Aspectos Energéticos Globales (filtrados por nivel del alumno)
      (async () => {
        if (columnasExistentes.aspectos_energeticos_nivel_minimo) {
          try {
            console.log(`[Master][LEVEL_FILTER] alumnoId=${alumnoId} nivel_efectivo=${nivelEfectivo} seccion=aspectos_energeticos`);
            return await query(`
              SELECT ae.*,
                     COALESCE(ae.nivel_minimo, 1) as nivel_minimo
              FROM aspectos_energeticos ae
              WHERE ae.activo = true 
                AND (COALESCE(ae.nivel_minimo, 1) <= $2)
              ORDER BY ae.orden, ae.nombre
            `, [alumnoId, nivelEfectivo]);
          } catch (err) {
            if (err.message.includes('nivel_minimo')) {
              console.warn('⚠️ Columna nivel_minimo no existe en aspectos_energeticos, usando consulta sin filtro de nivel');
              return await query(`
                SELECT ae.*, 1 as nivel_minimo
                FROM aspectos_energeticos ae
                WHERE ae.activo = true
                ORDER BY ae.orden, ae.nombre
              `, []);
            }
            throw err;
          }
        } else {
          return await query(`
            SELECT ae.*, 1 as nivel_minimo
            FROM aspectos_energeticos ae
            WHERE ae.activo = true
            ORDER BY ae.orden, ae.nombre
          `, []);
        }
      })(),
      
      // Aspectos del Alumno (Anatomía Energética)
      (async () => {
        const tieneMetadata = columnasExistentes.aspectos_energeticos_alumnos_metadata;
        const camposMetadata = tieneMetadata ? 'aea.metadata,' : 'NULL as metadata,';
        
        if (columnasExistentes.aspectos_energeticos_nivel_minimo) {
          try {
            return await query(`
              SELECT aea.id, aea.alumno_id, aea.aspecto_id, aea.estado, aea.veces_limpiado, ${camposMetadata}
                     aea.ultima_limpieza,
                     aea.proxima_limpieza,
                     ae.nombre, ae.frecuencia_dias,
                     COALESCE(ae.nivel_minimo, 1) as nivel_minimo
              FROM aspectos_energeticos_alumnos aea
              JOIN aspectos_energeticos ae ON aea.aspecto_id = ae.id
              WHERE aea.alumno_id = $1
              ORDER BY ae.orden, ae.nombre
            `, [alumnoId]);
          } catch (err) {
            if (err.message.includes('nivel_minimo') || err.message.includes('metadata')) {
              console.warn('⚠️ Columnas no existen en aspectos_energeticos_alumnos, usando consulta simplificada');
              return await query(`
                SELECT aea.id, aea.alumno_id, aea.aspecto_id, aea.estado, aea.veces_limpiado, NULL as metadata,
                       aea.ultima_limpieza,
                       aea.proxima_limpieza,
                       ae.nombre, ae.frecuencia_dias,
                       1 as nivel_minimo
                FROM aspectos_energeticos_alumnos aea
                JOIN aspectos_energeticos ae ON aea.aspecto_id = ae.id
                WHERE aea.alumno_id = $1
                ORDER BY ae.orden, ae.nombre
              `, [alumnoId]);
            }
            throw err;
          }
        } else {
          return await query(`
            SELECT aea.id, aea.alumno_id, aea.aspecto_id, aea.estado, aea.veces_limpiado, ${camposMetadata}
                   aea.ultima_limpieza,
                   aea.proxima_limpieza,
                   ae.nombre, ae.frecuencia_dias,
                   1 as nivel_minimo
            FROM aspectos_energeticos_alumnos aea
            JOIN aspectos_energeticos ae ON aea.aspecto_id = ae.id
            WHERE aea.alumno_id = $1
            ORDER BY ae.orden, ae.nombre
          `, [alumnoId]).catch(err => {
            if (err.message.includes('metadata')) {
              return query(`
                SELECT aea.id, aea.alumno_id, aea.aspecto_id, aea.estado, aea.veces_limpiado, NULL as metadata,
                       aea.ultima_limpieza,
                       aea.proxima_limpieza,
                       ae.nombre, ae.frecuencia_dias,
                       1 as nivel_minimo
                FROM aspectos_energeticos_alumnos aea
                JOIN aspectos_energeticos ae ON aea.aspecto_id = ae.id
                WHERE aea.alumno_id = $1
                ORDER BY ae.orden, ae.nombre
              `, [alumnoId]);
            }
            throw err;
          });
        }
      })(),
      
      // Registros y Karmas - Biblioteca (filtrados por nivel del alumno)
      (async () => {
        if (columnasExistentes.aspectos_karmicos_nivel_minimo) {
          try {
            console.log(`[Master][LEVEL_FILTER] alumnoId=${alumnoId} nivel_efectivo=${nivelEfectivo} seccion=aspectos_karmicos`);
            return await query(`
              SELECT ak.*, COALESCE(ak.nivel_minimo, 1) as nivel_minimo
              FROM aspectos_karmicos ak
              WHERE ak.activo = true 
                AND (COALESCE(ak.nivel_minimo, 1) <= $2)
              ORDER BY ak.orden, ak.nombre
            `, [alumnoId, nivelEfectivo]);
          } catch (err) {
            if (err.message.includes('nivel_minimo')) {
              console.warn('⚠️ Columna nivel_minimo no existe en aspectos_karmicos, usando consulta sin filtro de nivel');
              return await query(`
                SELECT ak.*, 1 as nivel_minimo
                FROM aspectos_karmicos ak
                WHERE ak.activo = true
                ORDER BY ak.orden, ak.nombre
              `, [alumnoId]);
            }
            throw err;
          }
        } else {
          return await query(`
            SELECT ak.*, 1 as nivel_minimo
            FROM aspectos_karmicos ak
            WHERE ak.activo = true
            ORDER BY ak.orden, ak.nombre
          `, []);
        }
      })(),
      
      // Registros y Karmas - Estado del Alumno
      (async () => {
        const tieneVecesLimpiado = await columnaExiste('aspectos_karmicos_alumnos', 'veces_limpiado');
        const tieneMetadata = columnasExistentes.aspectos_karmicos_alumnos_metadata;
        const camposMetadata = tieneMetadata ? 'aka.metadata,' : 'NULL as metadata,';
        
        if (columnasExistentes.aspectos_karmicos_nivel_minimo) {
          try {
            if (tieneVecesLimpiado) {
              return await query(`
                SELECT aka.id, aka.alumno_id, aka.aspecto_id, aka.estado, aka.veces_limpiado, ${camposMetadata}
                       aka.ultima_limpieza, aka.proxima_limpieza,
                       ak.nombre, ak.frecuencia_dias, ak.prioridad,
                       COALESCE(ak.nivel_minimo, 1) as nivel_minimo
                FROM aspectos_karmicos_alumnos aka
                JOIN aspectos_karmicos ak ON aka.aspecto_id = ak.id
                WHERE aka.alumno_id = $1
                ORDER BY ak.orden, ak.nombre
              `, [alumnoId]);
            } else {
              return await query(`
                SELECT aka.id, aka.alumno_id, aka.aspecto_id, aka.estado, 0 as veces_limpiado, ${camposMetadata}
                       aka.ultima_limpieza, aka.proxima_limpieza,
                       ak.nombre, ak.frecuencia_dias, ak.prioridad,
                       COALESCE(ak.nivel_minimo, 1) as nivel_minimo
                FROM aspectos_karmicos_alumnos aka
                JOIN aspectos_karmicos ak ON aka.aspecto_id = ak.id
                WHERE aka.alumno_id = $1
                ORDER BY ak.orden, ak.nombre
              `, [alumnoId]);
            }
          } catch (err) {
            if (err.message.includes('nivel_minimo') || err.message.includes('veces_limpiado') || err.message.includes('metadata')) {
              console.warn('⚠️ Columnas no existen en aspectos_karmicos_alumnos, usando consulta simplificada');
              return await query(`
                SELECT aka.id, aka.alumno_id, aka.aspecto_id, aka.estado, 0 as veces_limpiado, NULL as metadata,
                       aka.ultima_limpieza, aka.proxima_limpieza,
                       ak.nombre, ak.frecuencia_dias, ak.prioridad,
                       1 as nivel_minimo
                FROM aspectos_karmicos_alumnos aka
                JOIN aspectos_karmicos ak ON aka.aspecto_id = ak.id
                WHERE aka.alumno_id = $1
                ORDER BY ak.orden, ak.nombre
              `, [alumnoId]);
            }
            throw err;
          }
        } else {
          try {
            if (tieneVecesLimpiado) {
              return await query(`
                SELECT aka.id, aka.alumno_id, aka.aspecto_id, aka.estado, aka.veces_limpiado, ${camposMetadata}
                       aka.ultima_limpieza, aka.proxima_limpieza,
                       ak.nombre, ak.frecuencia_dias, ak.prioridad,
                       1 as nivel_minimo
                FROM aspectos_karmicos_alumnos aka
                JOIN aspectos_karmicos ak ON aka.aspecto_id = ak.id
                WHERE aka.alumno_id = $1
                ORDER BY ak.orden, ak.nombre
              `, [alumnoId]);
            } else {
              return await query(`
                SELECT aka.id, aka.alumno_id, aka.aspecto_id, aka.estado, 0 as veces_limpiado, ${camposMetadata}
                       aka.ultima_limpieza, aka.proxima_limpieza,
                       ak.nombre, ak.frecuencia_dias, ak.prioridad,
                       1 as nivel_minimo
                FROM aspectos_karmicos_alumnos aka
                JOIN aspectos_karmicos ak ON aka.aspecto_id = ak.id
                WHERE aka.alumno_id = $1
                ORDER BY ak.orden, ak.nombre
              `, [alumnoId]);
            }
          } catch (err) {
            if (err.message.includes('veces_limpiado') || err.message.includes('metadata')) {
              console.warn('⚠️ Columnas no existen en aspectos_karmicos_alumnos');
              return await query(`
                SELECT aka.id, aka.alumno_id, aka.aspecto_id, aka.estado, 0 as veces_limpiado, NULL as metadata,
                       aka.ultima_limpieza, aka.proxima_limpieza,
                       ak.nombre, ak.frecuencia_dias, ak.prioridad,
                       1 as nivel_minimo
                FROM aspectos_karmicos_alumnos aka
                JOIN aspectos_karmicos ak ON aka.aspecto_id = ak.id
                WHERE aka.alumno_id = $1
                ORDER BY ak.orden, ak.nombre
              `, [alumnoId]);
            }
            throw err;
          }
        }
      })(),
      
      // Energías Indeseables - Biblioteca (filtrados por nivel del alumno)
      (async () => {
        if (columnasExistentes.aspectos_indeseables_nivel_minimo) {
          try {
            console.log(`[Master][LEVEL_FILTER] alumnoId=${alumnoId} nivel_efectivo=${nivelEfectivo} seccion=aspectos_indeseables`);
            return await query(`
              SELECT ai.*, COALESCE(ai.nivel_minimo, 1) as nivel_minimo
              FROM aspectos_indeseables ai
              WHERE ai.activo = true 
                AND (COALESCE(ai.nivel_minimo, 1) <= $2)
              ORDER BY ai.orden, ai.nombre
            `, [alumnoId, nivelEfectivo]);
          } catch (err) {
            if (err.message.includes('nivel_minimo')) {
              console.warn('⚠️ Columna nivel_minimo no existe en aspectos_indeseables, usando consulta sin filtro de nivel');
              return await query(`
                SELECT ai.*, 1 as nivel_minimo
                FROM aspectos_indeseables ai
                WHERE ai.activo = true
                ORDER BY ai.orden, ai.nombre
              `, []);
            }
            throw err;
          }
        } else {
          return await query(`
            SELECT ai.*, 1 as nivel_minimo
            FROM aspectos_indeseables ai
            WHERE ai.activo = true
            ORDER BY ai.orden, ai.nombre
          `, []);
        }
      })(),
      
      // Energías Indeseables - Estado del Alumno
      (async () => {
        const tieneMetadata = columnasExistentes.aspectos_indeseables_alumnos_metadata;
        const camposMetadata = tieneMetadata ? 'aia.metadata,' : 'NULL as metadata,';
        
        if (columnasExistentes.aspectos_indeseables_alumnos_veces_limpiado && columnasExistentes.aspectos_indeseables_nivel_minimo) {
          try {
            return await query(`
              SELECT aia.id, aia.alumno_id, aia.aspecto_id, aia.estado, aia.veces_limpiado, ${camposMetadata}
                     aia.ultima_limpieza, aia.proxima_limpieza,
                     ai.nombre, ai.frecuencia_dias, ai.prioridad,
                     COALESCE(ai.nivel_minimo, 1) as nivel_minimo
              FROM aspectos_indeseables_alumnos aia
              JOIN aspectos_indeseables ai ON aia.aspecto_id = ai.id
              WHERE aia.alumno_id = $1
              ORDER BY ai.orden, ai.nombre
            `, [alumnoId]);
          } catch (err) {
            if (err.message.includes('nivel_minimo') || err.message.includes('veces_limpiado') || err.message.includes('metadata')) {
              console.warn('⚠️ Columnas no existen en aspectos_indeseables_alumnos, usando consulta simplificada');
              return await query(`
                SELECT aia.id, aia.alumno_id, aia.aspecto_id, aia.estado, 0 as veces_limpiado, NULL as metadata,
                       aia.ultima_limpieza, aia.proxima_limpieza,
                       ai.nombre, ai.frecuencia_dias, ai.prioridad,
                       1 as nivel_minimo
                FROM aspectos_indeseables_alumnos aia
                JOIN aspectos_indeseables ai ON aia.aspecto_id = ai.id
                WHERE aia.alumno_id = $1
                ORDER BY ai.orden, ai.nombre
              `, [alumnoId]);
            }
            throw err;
          }
        } else if (columnasExistentes.aspectos_indeseables_alumnos_veces_limpiado) {
          try {
            return await query(`
              SELECT aia.id, aia.alumno_id, aia.aspecto_id, aia.estado, aia.veces_limpiado, ${camposMetadata}
                     aia.ultima_limpieza, aia.proxima_limpieza,
                     ai.nombre, ai.frecuencia_dias, ai.prioridad,
                     1 as nivel_minimo
              FROM aspectos_indeseables_alumnos aia
              JOIN aspectos_indeseables ai ON aia.aspecto_id = ai.id
              WHERE aia.alumno_id = $1
              ORDER BY ai.orden, ai.nombre
            `, [alumnoId]);
          } catch (err) {
            if (err.message.includes('veces_limpiado') || err.message.includes('metadata')) {
              console.warn('⚠️ Columnas no existen, usando consulta sin esas columnas');
              return await query(`
                SELECT aia.id, aia.alumno_id, aia.aspecto_id, aia.estado, 0 as veces_limpiado, NULL as metadata,
                       aia.ultima_limpieza, aia.proxima_limpieza,
                       ai.nombre, ai.frecuencia_dias, ai.prioridad,
                       1 as nivel_minimo
                FROM aspectos_indeseables_alumnos aia
                JOIN aspectos_indeseables ai ON aia.aspecto_id = ai.id
                WHERE aia.alumno_id = $1
                ORDER BY ai.orden, ai.nombre
              `, [alumnoId]);
            }
            throw err;
          }
        } else {
          return await query(`
            SELECT aia.id, aia.alumno_id, aia.aspecto_id, aia.estado, 0 as veces_limpiado, NULL as metadata,
                   aia.ultima_limpieza, aia.proxima_limpieza,
                   ai.nombre, ai.frecuencia_dias, ai.prioridad,
                   1 as nivel_minimo
            FROM aspectos_indeseables_alumnos aia
            JOIN aspectos_indeseables ai ON aia.aspecto_id = ai.id
            WHERE aia.alumno_id = $1
            ORDER BY ai.orden, ai.nombre
          `, [alumnoId]);
        }
      })(),
      
      // Prácticas recientes
      query(`
        SELECT p.*, ap.nombre as aspecto_nombre
        FROM practicas p
        LEFT JOIN aspectos_practica ap ON p.aspecto_id = ap.id
        WHERE p.alumno_id = $1
        ORDER BY p.fecha DESC
        LIMIT 50
      `, [alumnoId]),
      
      // Reflexiones recientes
      query(`
        SELECT * FROM reflexiones
        WHERE alumno_id = $1
        ORDER BY fecha DESC
        LIMIT 30
      `, [alumnoId]),
      
      // Audios
      query(`
        SELECT * FROM practicas_audio
        WHERE alumno_id = $1
        ORDER BY fecha DESC
        LIMIT 20
      `, [alumnoId]),
      
      // Objetivos de Creación
      query(`
        SELECT * FROM creacion_objetivos
        WHERE alumno_id = $1
        ORDER BY fecha_creacion DESC
      `, [alumnoId]),
      
      // Problemas Iniciales
      query(`
        SELECT * FROM creacion_problemas_iniciales
        WHERE alumno_id = $1
        ORDER BY fecha_registro DESC
      `, [alumnoId]),
      
      // Versión Futura
      query('SELECT * FROM creacion_version_futura WHERE alumno_id = $1', [alumnoId]),
      
      // Emocional Anual
      query(`
        SELECT * FROM emocional_ano
        WHERE alumno_id = $1
        ORDER BY año DESC
        LIMIT 1
      `, [alumnoId]),
      
      // Misiones
      query(`
        SELECT ma.*, m.nombre, m.descripcion
        FROM misiones_alumnos ma
        JOIN misiones m ON ma.mision_id = m.id
        WHERE ma.alumno_id = $1
        ORDER BY ma.created_at DESC
      `, [alumnoId]),
      
      // Logros
      query(`
        SELECT l.*, ld.nombre, ld.descripcion, ld.icono
        FROM logros l
        JOIN logros_definicion ld ON l.codigo_logro = ld.codigo
        WHERE l.alumno_id = $1
        ORDER BY l.fecha_obtenido DESC
      `, [alumnoId]),
      
      // Skill Tree
      query(`
        SELECT stp.*, stn.nombre, stn.descripcion
        FROM skilltree_progreso stp
        JOIN skilltree_nodos stn ON stp.nodo_id = stn.id
        WHERE stp.alumno_id = $1
        ORDER BY stp.completado_en DESC
      `, [alumnoId]),
      
      // Arquetipos
      query(`
        SELECT * FROM arquetipos_alumnos
        WHERE alumno_id = $1
        ORDER BY created_at DESC
      `, [alumnoId]),
      
      // Auribosses
      query(`
        SELECT aa.*, a.nombre as boss_nombre, a.descripcion as boss_descripcion
        FROM auribosses_alumnos aa
        LEFT JOIN auribosses a ON aa.boss_id = a.id
        WHERE aa.alumno_id = $1
        ORDER BY aa.fecha_completado DESC NULLS LAST, aa.created_at DESC
      `, [alumnoId]),
      
      // Tokens
      query(`
        SELECT * FROM tokens_auri
        WHERE alumno_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `, [alumnoId]),
      
      // Lugares del alumno (desde alumnos_lugares)
      query(`
        SELECT 
          id,
          nombre,
          descripcion,
          activo,
          created_at,
          updated_at
        FROM alumnos_lugares
        WHERE alumno_id = $1
        ORDER BY activo DESC, nombre ASC
      `, [alumnoId]).catch(err => {
        console.error('❌ Error obteniendo lugares del alumno:', err.message);
        return { rows: [] };
      }),
      
      // Proyectos del alumno (desde alumnos_proyectos)
      query(`
        SELECT 
          id,
          nombre,
          descripcion,
          activo,
          created_at,
          updated_at
        FROM alumnos_proyectos
        WHERE alumno_id = $1
        ORDER BY activo DESC, nombre ASC
      `, [alumnoId]).catch(err => {
        console.error('❌ Error obteniendo proyectos del alumno:', err.message);
        return { rows: [] };
      }),
      
      // Transmutaciones PDE - Apadrinados (solo los que pertenecen a este alumno como padrino)
      query(`
        SELECT 
          ta.*,
          tae.ultima_limpieza,
          tae.veces_limpiado,
          tae.estado,
          CASE
            WHEN tae.ultima_limpieza IS NULL THEN NULL
            ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT
          END as dias_desde_limpieza
        FROM transmutaciones_apadrinados ta
        LEFT JOIN transmutaciones_apadrinados_estado tae ON ta.id = tae.apadrinado_id AND tae.alumno_id = $1
        WHERE ta.activo = true
          AND ta.alumno_id = $1
          AND (SELECT estado_suscripcion FROM alumnos WHERE id = $1 LIMIT 1) = 'activa'
        ORDER BY COALESCE(ta.orden, 0) ASC, ta.nombre ASC
      `, [alumnoId]).catch((err) => {
        console.error('❌ Error en consulta transmutaciones_apadrinados:', err.message);
        return { rows: [] }; // Devolver estructura vacía en lugar de lanzar error
      }),
      
      // Transmutaciones Energéticas (FASE 2A: pasar nivel_efectivo)
      obtenerTransmutacionesPorAlumno(alumnoId, nivelEfectivo).catch((err) => {
        console.error('❌ Error obteniendo transmutaciones energéticas:', err.message);
        return { listas: [] }; // Devolver estructura vacía
      }),
      
      // Limpieza de Hogar
      (async () => {
        const tieneUltimaLimpieza = await columnaExiste('limpieza_hogar_alumnos', 'ultima_limpieza');
        const tieneVecesLimpiado = await columnaExiste('limpieza_hogar_alumnos', 'veces_limpiado');
        
        try {
          if (columnasExistentes.limpieza_hogar_nivel_minimo && tieneUltimaLimpieza && tieneVecesLimpiado) {
            console.log(`[Master][LEVEL_FILTER] alumnoId=${alumnoId} nivel_efectivo=${nivelEfectivo} seccion=limpieza_hogar`);
            return await query(`
              SELECT 
                lh.*,
                lha.ultima_limpieza,
                lha.veces_limpiado,
                lha.estado,
                CASE
                  WHEN lha.ultima_limpieza IS NULL THEN NULL
                  ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - lha.ultima_limpieza))::INT
                END as dias_desde_limpieza
              FROM limpieza_hogar lh
              LEFT JOIN limpieza_hogar_alumnos lha ON lh.id = lha.aspecto_id AND lha.alumno_id = $1
              WHERE lh.activo = true
                AND (SELECT estado_suscripcion FROM alumnos WHERE id = $1 LIMIT 1) = 'activa'
                AND (COALESCE(lh.nivel_minimo, 1) <= $2)
              ORDER BY COALESCE(lh.nivel_minimo, 1) ASC, lh.orden ASC, lh.nombre ASC
            `, [alumnoId, nivelEfectivo]);
          } else if (tieneUltimaLimpieza && tieneVecesLimpiado) {
            return await query(`
              SELECT 
                lh.*,
                lha.ultima_limpieza,
                lha.veces_limpiado,
                lha.estado,
                CASE
                  WHEN lha.ultima_limpieza IS NULL THEN NULL
                  ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - lha.ultima_limpieza))::INT
                END as dias_desde_limpieza
              FROM limpieza_hogar lh
              LEFT JOIN limpieza_hogar_alumnos lha ON lh.id = lha.aspecto_id AND lha.alumno_id = $1
              WHERE lh.activo = true
                AND (SELECT estado_suscripcion FROM alumnos WHERE id = $1 LIMIT 1) = 'activa'
              ORDER BY lh.orden ASC, lh.nombre ASC
            `, [alumnoId]);
          } else {
            // Consulta simplificada sin columnas que no existen
            return await query(`
              SELECT 
                lh.*,
                lha.estado,
                NULL as ultima_limpieza,
                0 as veces_limpiado,
                NULL as dias_desde_limpieza
              FROM limpieza_hogar lh
              LEFT JOIN limpieza_hogar_alumnos lha ON lh.id = lha.aspecto_id AND lha.alumno_id = $1
              WHERE lh.activo = true
                AND (SELECT estado_suscripcion FROM alumnos WHERE id = $1 LIMIT 1) = 'activa'
              ORDER BY lh.orden ASC, lh.nombre ASC
            `, [alumnoId]);
          }
        } catch (err) {
          if (err.message.includes('ultima_limpieza') || err.message.includes('veces_limpiado') || err.message.includes('nivel_minimo')) {
            console.warn('⚠️ Columnas no existen en limpieza_hogar, usando consulta simplificada');
            return await query(`
              SELECT 
                lh.*,
                lha.estado,
                NULL as ultima_limpieza,
                0 as veces_limpiado,
                NULL as dias_desde_limpieza
              FROM limpieza_hogar lh
              LEFT JOIN limpieza_hogar_alumnos lha ON lh.id = lha.aspecto_id AND lha.alumno_id = $1
              WHERE lh.activo = true
                AND (SELECT estado_suscripcion FROM alumnos WHERE id = $1 LIMIT 1) = 'activa'
              ORDER BY lh.orden ASC, lh.nombre ASC
            `, [alumnoId]);
          }
          throw err;
        }
      })(),
      
      // Notas del Master
      obtenerNotasAlumno(alumnoId).catch((error) => {
        console.error('❌ Error obteniendo notas:', error.message);
        return []; // Devolver array vacío en lugar de lanzar error
      }),
      
      // Limpiezas de hoy del Master - solo si la tabla existe
      tablasExistentes.limpiezas_master_historial
        ? obtenerLimpiezasHoy(alumnoId).catch(err => {
            console.warn('⚠️ Error obteniendo limpiezas de hoy:', err.message);
            return [];
          })
        : Promise.resolve([]),
      
      // Secciones de limpieza dinámicas
      listarSecciones().catch(err => {
        console.warn('⚠️ Error obteniendo secciones de limpieza:', err.message);
        return [];
      })
    ]).then(results => {
      // Todos los resultados son válidos
      return results;
    }).catch(err => {
      // Si Promise.all falla, devolver valores por defecto para evitar 502
      console.error('❌ Error crítico en Promise.all, devolviendo valores por defecto:', err.message);
      console.error('❌ Stack trace:', err.stack);
      // Devolver valores por defecto en el mismo orden que las consultas originales (30 elementos)
      return [
        { rows: [] }, // superprioritarios
        { rows: [] }, // cartaAstral
        { rows: [] }, // disenohumano
        { rows: [{ ajustes: datosNacimiento.ajustes || {} }] }, // ajustes
        { rows: [] }, // disponibilidad
        { rows: [] }, // sinergias
        { rows: [] }, // aspectos
        { rows: [] }, // aspectosAlumnos
        { rows: [] }, // aspectosKarmicos
        { rows: [] }, // aspectosKarmicosAlumnos
        { rows: [] }, // aspectosIndeseables
        { rows: [] }, // aspectosIndeseablesAlumnos
        { rows: [] }, // practicas
        { rows: [] }, // reflexiones
        { rows: [] }, // audios
        { rows: [] }, // objetivos
        { rows: [] }, // problemas
        { rows: [] }, // versionFutura
        { rows: [] }, // emocional
        { rows: [] }, // misiones
        { rows: [] }, // logros
        { rows: [] }, // skilltree
        { rows: [] }, // arquetipos
        { rows: [] }, // auribosses
        { rows: [] }, // tokens
        { rows: [] }, // transmutacionesLugares
        { rows: [] }, // transmutacionesProyectos
        { rows: [] }, // transmutacionesApadrinados
        { listas: [] }, // transmutacionesEnergeticas
        { rows: [] }, // limpiezaHogar
        [], // notas
        [], // limpiezasHoy
        [], // seccionesLimpieza
      ];
    });

    // Función helper para calcular días desde última limpieza
    const calcularDiasDesdeUltimaLimpieza = (ultimaLimpieza) => {
      if (!ultimaLimpieza) return null;
      const ahora = new Date();
      const ultima = new Date(ultimaLimpieza);
      const diffTime = Math.abs(ahora - ultima);
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };
    
    // Función helper para procesar aspectos con lógica de días
    const procesarAspectos = (biblioteca, alumnos, tipo) => {
      const ahora = new Date();
      const mapAlumnos = new Map();
      alumnos.forEach(a => mapAlumnos.set(a.aspecto_id, a));
      
      const procesados = biblioteca.map(aspecto => {
        const registroAlumno = mapAlumnos.get(aspecto.id);
        // Todas las tablas ahora usan ultima_limpieza de forma consistente
        const ultimaLimpieza = registroAlumno?.ultima_limpieza || null;
        const diasDesdeLimpieza = calcularDiasDesdeUltimaLimpieza(ultimaLimpieza);
        const frecuenciaDias = aspecto.frecuencia_dias || 14; // Default 14 días
        
        let estado = 'pendiente';
        
        // Verificar si está al día (para Anatomía Energética)
        if (tipo === 'anatomia' && registroAlumno?.estado === 'al_dia') {
          estado = 'limpio';
        } else if (tipo === 'anatomia' && registroAlumno?.estado === 'muy_pendiente') {
          estado = 'olvidado';
        } else if (ultimaLimpieza && diasDesdeLimpieza !== null) {
          // Si hay última limpieza y podemos calcular días
          if (diasDesdeLimpieza <= frecuenciaDias) {
            // Limpio si está dentro del período de frecuencia
            estado = 'limpio';
          } else if (diasDesdeLimpieza <= 15) {
            // Pendiente si está entre frecuencia y 15 días
            estado = 'pendiente';
          } else {
            // Olvidado si tiene más de 15 días
            estado = 'olvidado';
          }
        } else if (ultimaLimpieza) {
          // Si hay última limpieza pero no se puede calcular días, considerar limpio reciente
          estado = 'limpio';
        } else {
          // Nunca se ha limpiado - pendiente por defecto
          estado = 'pendiente';
        }
        
        return {
          ...aspecto,
          ...(registroAlumno || {}),
          dias_desde_limpieza: diasDesdeLimpieza,
          estado_calculado: estado,
          ultima_limpieza: ultimaLimpieza
        };
      });
      
      // Filtrar asegurando que cada aspecto solo aparece en una categoría
      return {
        limpios: procesados.filter(a => a.estado_calculado === 'limpio'),
        pendientes: procesados.filter(a => a.estado_calculado === 'pendiente'),
        olvidados: procesados.filter(a => a.estado_calculado === 'olvidado'),
        todos: procesados
      };
    };
    
    // Procesar Anatomía Energética
    const anatomía = procesarAspectos(aspectos.rows, aspectosAlumnos.rows, 'anatomia');
    const aspectosResumen = {
      total: aspectos.rows.length,
      limpios: anatomía.limpios.length,
      pendientes: anatomía.pendientes.length,
      olvidados: anatomía.olvidados.length
    };
    
    // Procesar Registros y Karmas
    const karmicos = procesarAspectos(aspectosKarmicos.rows, aspectosKarmicosAlumnos.rows, 'karmicos');
    const karmicosResumen = {
      total: aspectosKarmicos.rows.length,
      limpios: karmicos.limpios.length,
      pendientes: karmicos.pendientes.length,
      olvidados: karmicos.olvidados.length
    };
    
    // Procesar Energías Indeseables
    const indeseables = procesarAspectos(aspectosIndeseables.rows, aspectosIndeseablesAlumnos.rows, 'indeseables');
    const indeseablesResumen = {
      total: aspectosIndeseables.rows.length,
      limpios: indeseables.limpios.length,
      pendientes: indeseables.pendientes.length,
      olvidados: indeseables.olvidados.length
    };

    // Procesar aspectos de secciones dinámicas
    const seccionesConAspectos = await Promise.all(
      (seccionesLimpieza || []).map(async (seccion) => {
        try {
          // Obtener aspectos de esta sección
          console.log(`[Master][LEVEL_FILTER] alumnoId=${alumnoId} nivel_efectivo=${nivelEfectivo} seccion=secciones_dinamicas seccion_id=${seccion.id}`);
          const aspectosSeccion = await query(`
            SELECT ae.*, COALESCE(ae.nivel_minimo, 1) as nivel_minimo
            FROM aspectos_energeticos ae
            WHERE ae.activo = true 
              AND ae.seccion_id = $1
              AND (COALESCE(ae.nivel_minimo, 1) <= $2)
            ORDER BY COALESCE(ae.nivel_minimo, 1) ASC, COALESCE(ae.orden, 0) ASC, ae.nombre ASC
          `, [seccion.id, nivelEfectivo]);

          // Obtener estado del alumno para estos aspectos
          const tieneMetadata = columnasExistentes.aspectos_energeticos_alumnos_metadata;
          const camposMetadata = tieneMetadata ? 'aea.metadata,' : 'NULL as metadata,';
          
          const aspectosAlumnosSeccion = await query(`
            SELECT aea.id, aea.alumno_id, aea.aspecto_id, aea.estado, aea.veces_limpiado, ${camposMetadata}
                   aea.ultima_limpieza, aea.proxima_limpieza,
                   ae.nombre, ae.frecuencia_dias, ae.seccion_id,
                   COALESCE(ae.nivel_minimo, 1) as nivel_minimo
            FROM aspectos_energeticos_alumnos aea
            JOIN aspectos_energeticos ae ON aea.aspecto_id = ae.id
            WHERE aea.alumno_id = $1 AND ae.seccion_id = $2
            ORDER BY ae.orden, ae.nombre
          `, [alumnoId, seccion.id]).catch(() => ({ rows: [] }));

          // Procesar aspectos de esta sección
          const aspectosProcesados = procesarAspectos(aspectosSeccion.rows, aspectosAlumnosSeccion.rows, `seccion_${seccion.id}`);
          
          return {
            ...seccion,
            aspectos: aspectosSeccion.rows,
            aspectos_alumnos: aspectosAlumnosSeccion.rows,
            aspectos_procesados: aspectosProcesados.todos,
            aspectos_resumen: {
              total: aspectosSeccion.rows.length,
              limpios: aspectosProcesados.limpios.length,
              pendientes: aspectosProcesados.pendientes.length,
              olvidados: aspectosProcesados.olvidados.length
            }
          };
        } catch (error) {
          console.error(`Error procesando sección ${seccion.id}:`, error);
          return {
            ...seccion,
            aspectos: [],
            aspectos_alumnos: [],
            aspectos_procesados: [],
            aspectos_resumen: { total: 0, limpios: 0, pendientes: 0, olvidados: 0 }
          };
        }
      })
    );

    // Generar Aurigraph (simplificado por ahora)
    const aurigraph = { svg: '<svg>Placeholder</svg>', metricas: {} };

    return new Response(
      JSON.stringify({
        alumno: {
          id: alumno.id,
          email: alumno.email,
          apodo: alumno.apodo,
          nombre_completo: alumno.nombre_completo,
          nombre_display: alumno.apodo || alumno.nombre_completo || alumno.email, // Apodo como identificador principal
          nivel: nivelEfectivo, // FASE 2A: Usar nivel_efectivo canónico
          fase: fase,
          racha: alumno.racha,
          estado_suscripcion: alumno.estado_suscripcion,
          fecha_nacimiento: datosNacimiento.fecha_nacimiento || null,
          hora_nacimiento: datosNacimiento.hora_nacimiento || null,
          lugar_nacimiento: datosNacimiento.lugar_nacimiento || null
        },
        carta_astral: cartaAstral.rows[0] || null,
        disenohumano: disenohumano.rows[0] || null,
        ajustes: ajustes.rows[0]?.ajustes || {},
        disponibilidad: disponibilidad.rows[0] || null,
        sinergias: sinergias.rows || [],
        // Anatomía Energética
        aspectos: aspectos.rows,
        aspectos_alumnos: aspectosAlumnos.rows,
        aspectos_resumen: aspectosResumen,
        aspectos_procesados: anatomía.todos,
        // Registros y Karmas
        aspectos_karmicos: aspectosKarmicos.rows,
        aspectos_karmicos_alumnos: aspectosKarmicosAlumnos.rows,
        aspectos_karmicos_resumen: karmicosResumen,
        aspectos_karmicos_procesados: karmicos.todos,
        // Energías Indeseables
        aspectos_indeseables: aspectosIndeseables.rows,
        aspectos_indeseables_alumnos: aspectosIndeseablesAlumnos.rows,
        aspectos_indeseables_resumen: indeseablesResumen,
        aspectos_indeseables_procesados: indeseables.todos,
        practicas: practicas.rows,
        reflexiones: reflexiones.rows,
        audios: audios.rows,
        objetivos: objetivos.rows,
        problemas: problemas.rows,
        version_futura: versionFutura.rows[0] || null,
        emocional: emocional.rows[0] || null,
        aurigraph: aurigraph,
        misiones: misiones.rows,
        logros: logros.rows,
        skilltree: skilltree.rows,
        arquetipos: arquetipos.rows,
        auribosses: auribosses.rows,
        tokens: tokens.rows,
        notas: notas || [],
        nivel_alumno: nivelEfectivo, // FASE 2A: Usar nivel_efectivo canónico
        // Transmutaciones PDE
        alumnos_lugares: transmutacionesLugares?.rows || [],
        alumnos_proyectos: transmutacionesProyectos?.rows || [],
        transmutaciones_apadrinados: transmutacionesApadrinados?.rows || [],
        transmutaciones_energeticas: transmutacionesEnergeticas || { listas: [] },
        // Limpieza de Hogar
        limpieza_hogar: limpiezaHogar?.rows || [],
        // Historial de limpiezas de hoy
        limpiezas_hoy: limpiezasHoy || [],
        // Superprioritarios
        superprioritarios: superprioritarios?.rows || [],
        // Secciones de limpieza dinámicas (con aspectos procesados)
        secciones_limpieza: seccionesConAspectos || [],
        // FASE 3: Información de pausas
        pausas: {
          activa: ctx?.pausas?.activa || false,
          pausaActiva: ctx?.pausas?.pausaActiva || null,
          historial: await (async () => {
            try {
              const { findByAlumnoId } = await import('../modules/pausa-v4.js');
              const todasPausas = await findByAlumnoId(Number(alumnoId));
              // Retornar últimas 10 pausas ordenadas por inicio DESC
              return todasPausas.slice(0, 10).map(p => ({
                id: p.id,
                inicio: p.inicio,
                fin: p.fin,
                motivo: p.motivo || null
              }));
            } catch (err) {
              console.warn('Error obteniendo historial de pausas:', err.message);
              return [];
            }
          })(),
          diasPausados: await calcularDiasPausados(Number(alumnoId))
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en getMasterData:', error);
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
 * POST /admin/master/:alumnoId/marcar-limpio - Marcar aspecto como limpiado
 */
export async function handleMarcarLimpio(request, env, alumnoId) {
  console.log(`\n🔵 [handleMarcarLimpio] Iniciando - alumnoId: ${alumnoId}, método: ${request.method}`);
  
  // Asegurar que siempre devolvemos JSON, incluso en errores
  const jsonResponse = (data, status = 200) => {
    console.log(`🔵 [handleMarcarLimpio] Respondiendo - status: ${status}, data:`, JSON.stringify(data).substring(0, 200));
    return new Response(
      JSON.stringify(data),
      {
        status,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  };

  try {
    // Validar que el método sea POST
    if (request.method !== 'POST') {
      console.log(`❌ [handleMarcarLimpio] Método no permitido: ${request.method}`);
      return jsonResponse({ error: 'Método no permitido' }, 405);
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'marcar-limpio', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }

    console.log(`🔵 [handleMarcarLimpio] Validando suscripción activa para alumno ${alumnoId}...`);
    // Validar suscripción activa PRIMERO
    const esActivo = await validarSuscripcionActiva(alumnoId);
    if (!esActivo) {
      console.log(`❌ [handleMarcarLimpio] Alumno ${alumnoId} no tiene suscripción activa`);
      return jsonResponse({ error: 'Alumno no tiene suscripción activa' }, 403);
    }
    console.log(`✅ [handleMarcarLimpio] Alumno ${alumnoId} tiene suscripción activa`);

    // Parsear body con manejo de errores
    let body;
    try {
      body = await request.json();
      console.log(`🔵 [handleMarcarLimpio] Body recibido:`, JSON.stringify(body));
    } catch (error) {
      console.error(`❌ [handleMarcarLimpio] Error parseando JSON:`, error.message);
      return jsonResponse({ error: 'Error parseando JSON del body' }, 400);
    }

    let { tipo, aspecto_id } = body; // tipo: 'anatomia', 'karmicos', 'indeseables', 'seccion_X', etc.

    if (!tipo || !aspecto_id) {
      console.log(`❌ [handleMarcarLimpio] Faltan parámetros - tipo: ${tipo}, aspecto_id: ${aspecto_id}`);
      return jsonResponse({ error: 'Tipo y aspecto_id son requeridos' }, 400);
    }
    
    // Si el tipo es una sección dinámica (seccion_X), convertir a 'anatomia' para procesamiento
    let seccionId = null;
    let seccionNombre = null;
    let esTransmutacionEnergetica = false;
    let listaIdTransmutacion = null;
    
    if (tipo.startsWith('seccion_')) {
      seccionId = parseInt(tipo.replace('seccion_', ''));
      // Obtener nombre de la sección
      try {
        const seccionResult = await query('SELECT nombre, icono FROM secciones_limpieza WHERE id = $1', [seccionId]);
        if (seccionResult.rows.length > 0) {
          seccionNombre = seccionResult.rows[0].nombre;
        }
      } catch (err) {
        console.warn('⚠️ No se pudo obtener nombre de sección:', err.message);
      }
      tipo = 'anatomia'; // Todos los aspectos de secciones dinámicas están en aspectos_energeticos
    } else if (tipo.startsWith('transmutacion_')) {
      // Es una transmutación energética del nuevo sistema
      esTransmutacionEnergetica = true;
      listaIdTransmutacion = parseInt(tipo.replace('transmutacion_', ''));
      console.log(`🔮 [handleMarcarLimpio] Es transmutación energética - lista_id: ${listaIdTransmutacion}, item_id: ${aspecto_id}`);
    }
    
    console.log(`🔵 [handleMarcarLimpio] Procesando - tipo: ${tipo}, aspecto_id: ${aspecto_id}, seccion_id: ${seccionId}, esTransmutacion: ${esTransmutacionEnergetica}`);

    const ahora = new Date();
    
    // Función común para actualizar limpieza
    const actualizarLimpiezaAlumno = async (tipo, alumnoId, aspectoId, ahora) => {
      let tablaAlumnos, campoAspectoId, nuevoEstado, tablaFrecuencia;
      
      // Determinar tabla según tipo
      if (tipo === 'anatomia') {
        tablaAlumnos = 'aspectos_energeticos_alumnos';
        campoAspectoId = 'aspecto_id';
        nuevoEstado = 'al_dia';
        tablaFrecuencia = 'aspectos_energeticos';
      } else if (tipo === 'karmicos') {
        tablaAlumnos = 'aspectos_karmicos_alumnos';
        campoAspectoId = 'aspecto_id';
        nuevoEstado = 'limpio';
        tablaFrecuencia = 'aspectos_karmicos';
      } else if (tipo === 'indeseables') {
        tablaAlumnos = 'aspectos_indeseables_alumnos';
        campoAspectoId = 'aspecto_id';
        nuevoEstado = 'limpio';
        tablaFrecuencia = 'aspectos_indeseables';
      } else if (tipo === 'lugares') {
        tablaAlumnos = 'transmutaciones_lugares_estado';
        campoAspectoId = 'lugar_id';
        nuevoEstado = 'limpio';
        tablaFrecuencia = 'transmutaciones_lugares';
      } else if (tipo === 'proyectos') {
        tablaAlumnos = 'transmutaciones_proyectos_estado';
        campoAspectoId = 'proyecto_id';
        nuevoEstado = 'limpio';
        tablaFrecuencia = 'transmutaciones_proyectos';
      } else if (tipo === 'apadrinados') {
        tablaAlumnos = 'transmutaciones_apadrinados_estado';
        campoAspectoId = 'apadrinado_id';
        nuevoEstado = 'limpio';
        tablaFrecuencia = 'transmutaciones_apadrinados';
      } else if (tipo === 'limpieza_hogar') {
        tablaAlumnos = 'limpieza_hogar_alumnos';
        campoAspectoId = 'aspecto_id';
        nuevoEstado = 'limpio';
        tablaFrecuencia = 'limpieza_hogar';
      } else {
        throw new Error('Tipo inválido');
      }

      // Verificar si existe el registro
      const existe = await query(
        `SELECT id FROM ${tablaAlumnos} WHERE alumno_id = $1 AND ${campoAspectoId} = $2`,
        [alumnoId, aspectoId]
      );

      // Calcular próxima limpieza basada en frecuencia
      const aspectoResult = await query(
        `SELECT frecuencia_dias FROM ${tablaFrecuencia} WHERE id = $1`,
        [aspectoId]
      );
      const frecuenciaDias = aspectoResult.rows[0]?.frecuencia_dias || 14;
      const proximaLimpieza = new Date(ahora);
      proximaLimpieza.setDate(proximaLimpieza.getDate() + frecuenciaDias);

      if (existe.rows.length > 0) {
        // Actualizar registro existente - todas las tablas usan ultima_limpieza y proxima_limpieza
        await query(
          `UPDATE ${tablaAlumnos} 
           SET estado = $1, 
               ultima_limpieza = $2,
               proxima_limpieza = $3,
               veces_limpiado = COALESCE(veces_limpiado, 0) + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE alumno_id = $4 AND ${campoAspectoId} = $5`,
          [nuevoEstado, ahora, proximaLimpieza, alumnoId, aspectoId]
        );
      } else {
        // Crear nuevo registro - todas las tablas usan ultima_limpieza y proxima_limpieza
        await query(
          `INSERT INTO ${tablaAlumnos} (alumno_id, ${campoAspectoId}, estado, ultima_limpieza, proxima_limpieza, veces_limpiado)
           VALUES ($1, $2, $3, $4, $5, 1)`,
          [alumnoId, aspectoId, nuevoEstado, ahora, proximaLimpieza]
        );
      }
    };

    // Si es transmutación energética, usar función específica antes de la función genérica
    if (esTransmutacionEnergetica) {
      console.log(`🔮 [handleMarcarLimpio] Limpiando transmutación energética para alumno ${alumnoId}, item ${aspecto_id}`);
      
      try {
        await limpiarItemParaAlumno(aspecto_id, alumnoId);
        
        // Obtener nombre del ítem para el historial
        let aspectoNombre = null;
        let seccion = 'Transmutaciones Energéticas';
        try {
          const itemResult = await query(`
            SELECT it.nombre, lt.nombre as lista_nombre
            FROM items_transmutaciones it
            JOIN listas_transmutaciones lt ON lt.id = it.lista_id
            WHERE it.id = $1
          `, [aspecto_id]);
          if (itemResult.rows.length > 0) {
            aspectoNombre = itemResult.rows[0].nombre;
            seccion = `Transmutaciones Energéticas - ${itemResult.rows[0].lista_nombre}`;
          }
        } catch (err) {
          console.warn('⚠️ No se pudo obtener nombre del ítem:', err.message);
        }
        
        // Registrar en historial si existe la tabla
        try {
          const tablaExisteHistorial = await tablaExiste('limpiezas_master_historial');
          if (tablaExisteHistorial) {
            await query(`
              INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [alumnoId, 'transmutacion_energetica', aspecto_id, aspectoNombre, seccion, ahora]);
            console.log(`✅ [handleMarcarLimpio] Registrado en historial`);
          } else {
            console.warn('⚠️ [handleMarcarLimpio] Tabla limpiezas_master_historial no existe, omitiendo registro de historial');
          }
        } catch (error) {
          console.warn('⚠️ [handleMarcarLimpio] Error registrando en historial (no crítico):', error.message);
        }
        
        console.log(`✅ [handleMarcarLimpio] Transmutación energética limpiada exitosamente`);
        return jsonResponse({ 
          success: true, 
          message: 'Transmutación energética marcada como limpiada',
          tipo: 'transmutacion_energetica',
          aspecto_id,
          fecha_limpieza: ahora.toISOString()
        });
      } catch (error) {
        console.error(`❌ [handleMarcarLimpio] Error limpiando transmutación energética:`, error);
        return jsonResponse({ 
          error: error.message || 'Error limpiando transmutación energética'
        }, 500);
      }
    }

    // Ejecutar actualización usando función común
    await actualizarLimpiezaAlumno(tipo, alumnoId, aspecto_id, ahora);

    // Obtener el nombre del aspecto para el historial
    let aspectoNombre = null;
    let seccion = tipo;
    try {
      if (tipo === 'anatomia') {
        const aspectoResult = await query('SELECT nombre FROM aspectos_energeticos WHERE id = $1', [aspecto_id]);
        aspectoNombre = aspectoResult.rows[0]?.nombre || null;
        // Si es una sección dinámica, usar su nombre; si no, usar 'Anatomía Energética'
        seccion = seccionNombre || 'Anatomía Energética';
      } else if (tipo === 'karmicos') {
        const aspectoResult = await query('SELECT nombre FROM aspectos_karmicos WHERE id = $1', [aspecto_id]);
        aspectoNombre = aspectoResult.rows[0]?.nombre || null;
        seccion = 'Aspectos Kármicos';
      } else if (tipo === 'indeseables') {
        const aspectoResult = await query('SELECT nombre FROM aspectos_indeseables WHERE id = $1', [aspecto_id]);
        aspectoNombre = aspectoResult.rows[0]?.nombre || null;
        seccion = 'Energías Indeseables';
      } else if (tipo === 'lugares') {
        const lugarResult = await query('SELECT nombre FROM transmutaciones_lugares WHERE id = $1', [aspecto_id]);
        aspectoNombre = lugarResult.rows[0]?.nombre || null;
        seccion = 'Transmutaciones PDE - Lugares';
      } else if (tipo === 'proyectos') {
        const proyectoResult = await query('SELECT nombre FROM transmutaciones_proyectos WHERE id = $1', [aspecto_id]);
        aspectoNombre = proyectoResult.rows[0]?.nombre || null;
        seccion = 'Transmutaciones PDE - Proyectos';
      } else if (tipo === 'apadrinados') {
        const apadrinadoResult = await query('SELECT nombre FROM transmutaciones_apadrinados WHERE id = $1', [aspecto_id]);
        aspectoNombre = apadrinadoResult.rows[0]?.nombre || null;
        seccion = 'Transmutaciones PDE - Apadrinados';
      } else if (tipo === 'limpieza_hogar') {
        const hogarResult = await query('SELECT nombre FROM limpieza_hogar WHERE id = $1', [aspecto_id]);
        aspectoNombre = hogarResult.rows[0]?.nombre || null;
        seccion = 'Limpieza de Hogar';
      }
    } catch (error) {
      console.error('❌ Error obteniendo nombre del aspecto para historial:', error.message);
      // Continuar sin el nombre si hay error
    }

    // Registrar en el historial de limpiezas del master (si la tabla existe)
    try {
      const tablaExisteHistorial = await tablaExiste('limpiezas_master_historial');
      if (tablaExisteHistorial) {
        await query(
          `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [alumnoId, tipo, aspecto_id, aspectoNombre, seccion, ahora]
        );
        console.log(`✅ [handleMarcarLimpio] Registrado en historial`);
      } else {
        console.warn('⚠️ [handleMarcarLimpio] Tabla limpiezas_master_historial no existe, omitiendo registro de historial');
      }
    } catch (error) {
      // Si falla el historial, no es crítico, solo loguear el error
      console.warn('⚠️ [handleMarcarLimpio] Error registrando en historial (no crítico):', error.message);
    }

    // FASE 3: Registrar evento de auditoría
    try {
      await logAuditEvent({
        actor: 'admin',
        alumnoId: Number(alumnoId),
        action: 'marcar-limpio',
        entityType: tipo,
        entityId: String(aspecto_id),
        payload: {
          tipo,
          aspecto_id,
          seccionId: seccionId || null,
          seccionNombre: seccionNombre || null,
          esTransmutacionEnergetica,
          fecha_limpieza: ahora.toISOString()
        },
        req: request
      });
    } catch (auditError) {
      // Fail-open: no fallar si la auditoría falla
      console.warn(`[handleMarcarLimpio] Error registrando auditoría: ${auditError.message}`);
    }

    console.log(`✅ [handleMarcarLimpio] Éxito completo - tipo: ${tipo}, aspecto_id: ${aspecto_id}`);
    return jsonResponse({ 
      success: true, 
      message: 'Aspecto marcado como limpiado',
      tipo,
      aspecto_id,
      fecha_limpieza: ahora.toISOString()
    });
  } catch (error) {
    // Capturar cualquier error fuera del try principal
    console.error(`❌ [handleMarcarLimpio] Error general:`, error);
    console.error(`❌ [handleMarcarLimpio] Stack:`, error.stack);
    return jsonResponse({ 
      error: error.message || 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, 500);
  }
}

/**
 * POST /admin/master/:alumnoId/apodo - Actualizar apodo del alumno
 */
export async function handleApodo(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response('Método no permitido', { status: 405 });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'apodo', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }

    // Validar suscripción activa
    const esActivo = await validarSuscripcionActiva(alumnoId);
    if (!esActivo) {
      return new Response(
        JSON.stringify({ error: 'Alumno no tiene suscripción activa' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await request.json();
    const { apodo } = body;

    // Actualizar apodo usando student-v4.js (que incluye auditoría)
    const { updateStudentApodo } = await import('../modules/student-v4.js');
    const alumnoActualizado = await updateStudentApodo(Number(alumnoId), apodo || null);

    // FASE 3: Registrar evento de auditoría
    try {
      await logAuditEvent({
        actor: 'admin',
        alumnoId: Number(alumnoId),
        action: 'apodo',
        entityType: 'alumno',
        entityId: String(alumnoId),
        payload: {
          apodoAnterior: null, // Se puede obtener del contexto si está disponible
          apodoNuevo: apodo || null
        },
        req: request
      });
    } catch (auditError) {
      // Fail-open: no fallar si la auditoría falla
      console.warn(`[handleApodo] Error registrando auditoría: ${auditError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Apodo actualizado correctamente',
        alumno: {
          id: alumnoActualizado.id,
          email: alumnoActualizado.email,
          apodo: alumnoActualizado.apodo
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en handleApodo:', error);
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
 * POST /admin/master/:alumnoId/datos-nacimiento - Actualizar datos de nacimiento
 */
export async function handleDatosNacimiento(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response('Método no permitido', { status: 405 });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'datos-nacimiento', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }

    // Validar suscripción activa
    const esActivo = await validarSuscripcionActiva(alumnoId);
    if (!esActivo) {
      return new Response(
        JSON.stringify({ error: 'Alumno no tiene suscripción activa' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await request.json();
    const { fecha_nacimiento, hora_nacimiento, lugar_nacimiento } = body;

    // Actualizar en la base de datos
    await query(
      `UPDATE alumnos 
       SET fecha_nacimiento = $1, 
           hora_nacimiento = $2, 
           lugar_nacimiento = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND estado_suscripcion = 'activa'`,
      [
        fecha_nacimiento || null,
        hora_nacimiento || null,
        lugar_nacimiento || null,
        alumnoId
      ]
    );

    // FASE 3: Registrar evento de auditoría
    try {
      await logAuditEvent({
        actor: 'admin',
        alumnoId: Number(alumnoId),
        action: 'datos-nacimiento',
        entityType: 'alumno',
        entityId: String(alumnoId),
        payload: {
          fecha_nacimiento: fecha_nacimiento || null,
          hora_nacimiento: hora_nacimiento || null,
          lugar_nacimiento: lugar_nacimiento || null
        },
        req: request
      });
    } catch (auditError) {
      // Fail-open: no fallar si la auditoría falla
      console.warn(`[handleDatosNacimiento] Error registrando auditoría: ${auditError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Datos de nacimiento actualizados correctamente' 
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en handleDatosNacimiento:', error);
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
 * GET /admin/master/:alumnoId/notas - Obtener notas
 * POST /admin/master/:alumnoId/notas - Crear nota
 */
export async function handleNotas(request, env, alumnoId) {
  try {
    // Validar suscripción activa
    const esActivo = await validarSuscripcionActiva(alumnoId);
    if (!esActivo) {
      return new Response(
        JSON.stringify({ error: 'Alumno no tiene suscripción activa' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (request.method === 'GET') {
      const notas = await obtenerNotasAlumno(alumnoId);
      return new Response(
        JSON.stringify({ notas }),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const nota = await crearNota(alumnoId, body);
      return new Response(
        JSON.stringify({ success: true, nota }),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response('Método no permitido', { status: 405 });
  } catch (error) {
    console.error('❌ Error en handleNotas:', error);
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
 * POST /admin/master/:alumnoId/activar-lugar - Activar lugar (master puede activar múltiples)
 */
export async function handleActivarLugar(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'activar-lugar', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { lugar_id } = body;
    
    if (!lugar_id) {
      return new Response(JSON.stringify({ error: 'lugar_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verificar que el lugar pertenece al alumno
    const lugarResult = await query(
      `SELECT id FROM alumnos_lugares WHERE id = $1 AND alumno_id = $2`,
      [lugar_id, alumnoId]
    );
    
    if (lugarResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Lugar no encontrado o no pertenece al alumno' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Activar el lugar (master puede tener múltiples activos - NO desactivar otros)
    const result = await query(
      `UPDATE alumnos_lugares 
       SET activo = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND alumno_id = $2
       RETURNING *`,
      [lugar_id, alumnoId]
    );
    
    return new Response(JSON.stringify({ success: true, lugar: result.rows[0] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error activando lugar:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/desactivar-lugar - Desactivar lugar
 */
export async function handleDesactivarLugar(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'desactivar-lugar', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { lugar_id } = body;
    
    if (!lugar_id) {
      return new Response(JSON.stringify({ error: 'lugar_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Desactivar el lugar
    const result = await query(
      `UPDATE alumnos_lugares 
       SET activo = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND alumno_id = $2
       RETURNING *`,
      [lugar_id, alumnoId]
    );
    
    return new Response(JSON.stringify({ success: true, lugar: result.rows[0] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error desactivando lugar:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/activar-proyecto - Activar proyecto (master puede activar múltiples)
 */
export async function handleActivarProyecto(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'activar-proyecto', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { proyecto_id } = body;
    
    if (!proyecto_id) {
      return new Response(JSON.stringify({ error: 'proyecto_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verificar que el proyecto pertenece al alumno
    const proyectoResult = await query(
      `SELECT id FROM alumnos_proyectos WHERE id = $1 AND alumno_id = $2`,
      [proyecto_id, alumnoId]
    );
    
    if (proyectoResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Proyecto no encontrado o no pertenece al alumno' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Activar el proyecto (master puede tener múltiples activos - NO desactivar otros)
    const result = await query(
      `UPDATE alumnos_proyectos 
       SET activo = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND alumno_id = $2
       RETURNING *`,
      [proyecto_id, alumnoId]
    );
    
    return new Response(JSON.stringify({ success: true, proyecto: result.rows[0] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error activando proyecto:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/desactivar-proyecto - Desactivar proyecto
 */
export async function handleDesactivarProyecto(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'desactivar-proyecto', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { proyecto_id } = body;
    
    if (!proyecto_id) {
      return new Response(JSON.stringify({ error: 'proyecto_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Desactivar el proyecto
    const result = await query(
      `UPDATE alumnos_proyectos 
       SET activo = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND alumno_id = $2
       RETURNING *`,
      [proyecto_id, alumnoId]
    );
    
    return new Response(JSON.stringify({ success: true, proyecto: result.rows[0] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error desactivando proyecto:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/crear-lugar - Crear lugar desde master
 */
export async function handleCrearLugar(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'crear-lugar', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { nombre, descripcion } = body;
    
    if (!nombre || nombre.trim() === '') {
      return new Response(JSON.stringify({ error: 'Nombre requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Crear el lugar (inactivo por defecto, el master puede activarlo después)
    const result = await query(
      `INSERT INTO alumnos_lugares (alumno_id, nombre, descripcion, activo, created_at, updated_at)
       VALUES ($1, $2, $3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [alumnoId, nombre.trim(), descripcion ? descripcion.trim() : null]
    );
    
    return new Response(JSON.stringify({ success: true, lugar: result.rows[0] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creando lugar:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/crear-proyecto - Crear proyecto desde master
 */
export async function handleCrearProyecto(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'crear-proyecto', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { nombre, descripcion } = body;
    
    if (!nombre || nombre.trim() === '') {
      return new Response(JSON.stringify({ error: 'Nombre requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Crear el proyecto (inactivo por defecto, el master puede activarlo después)
    const result = await query(
      `INSERT INTO alumnos_proyectos (alumno_id, nombre, descripcion, activo, created_at, updated_at)
       VALUES ($1, $2, $3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [alumnoId, nombre.trim(), descripcion ? descripcion.trim() : null]
    );
    
    return new Response(JSON.stringify({ success: true, proyecto: result.rows[0] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creando proyecto:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/actualizar-lugar - Actualizar lugar desde master
 */
export async function handleActualizarLugar(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'actualizar-lugar', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { lugar_id, nombre, descripcion } = body;
    
    if (!lugar_id || !nombre || nombre.trim() === '') {
      return new Response(JSON.stringify({ error: 'lugar_id y nombre requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Actualizar el lugar
    const result = await query(
      `UPDATE alumnos_lugares 
       SET nombre = $1, descripcion = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND alumno_id = $4
       RETURNING *`,
      [nombre.trim(), descripcion ? descripcion.trim() : null, lugar_id, alumnoId]
    );
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Lugar no encontrado o no pertenece al alumno' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ success: true, lugar: result.rows[0] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error actualizando lugar:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/actualizar-proyecto - Actualizar proyecto desde master
 */
export async function handleActualizarProyecto(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'actualizar-proyecto', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { proyecto_id, nombre, descripcion } = body;
    
    if (!proyecto_id || !nombre || nombre.trim() === '') {
      return new Response(JSON.stringify({ error: 'proyecto_id y nombre requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Actualizar el proyecto
    const result = await query(
      `UPDATE alumnos_proyectos 
       SET nombre = $1, descripcion = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND alumno_id = $4
       RETURNING *`,
      [nombre.trim(), descripcion ? descripcion.trim() : null, proyecto_id, alumnoId]
    );
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Proyecto no encontrado o no pertenece al alumno' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ success: true, proyecto: result.rows[0] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/eliminar-lugar - Eliminar lugar desde master
 */
export async function handleEliminarLugar(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'eliminar-lugar', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { lugar_id } = body;
    
    if (!lugar_id) {
      return new Response(JSON.stringify({ error: 'lugar_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Eliminar el lugar
    const result = await query(
      `DELETE FROM alumnos_lugares 
       WHERE id = $1 AND alumno_id = $2
       RETURNING id`,
      [lugar_id, alumnoId]
    );
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Lugar no encontrado o no pertenece al alumno' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error eliminando lugar:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/eliminar-proyecto - Eliminar proyecto desde master
 */
export async function handleEliminarProyecto(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FASE 2B: Validar pausa activa (BLOQUEAR acción mutable si hay pausa)
    const pausaCheck = await checkPausaActiva(alumnoId, 'eliminar-proyecto', request);
    if (pausaCheck.blocked) {
      return pausaCheck.response;
    }
    
    const body = await request.json();
    const { proyecto_id } = body;
    
    if (!proyecto_id) {
      return new Response(JSON.stringify({ error: 'proyecto_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Eliminar el proyecto
    const result = await query(
      `DELETE FROM alumnos_proyectos 
       WHERE id = $1 AND alumno_id = $2
       RETURNING id`,
      [proyecto_id, alumnoId]
    );
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Proyecto no encontrado o no pertenece al alumno' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /admin/master/:alumnoId/pausas/crear - Crear pausa manualmente (FASE 3)
 * 
 * IMPORTANTE: Esta acción NO está bloqueada por checkPausaActiva porque
 * precisamente es para gestionar las pausas.
 */
export async function handleCrearPausa(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar suscripción activa
    const esActivo = await validarSuscripcionActiva(alumnoId);
    if (!esActivo) {
      return new Response(
        JSON.stringify({ error: 'Alumno no tiene suscripción activa' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await request.json();
    const { inicio, fin, motivo } = body;

    // Validar motivo (requerido mínimo)
    if (!motivo || motivo.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'El motivo es requerido' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Fecha de inicio: por defecto hoy, o la proporcionada
    const fechaInicio = inicio ? new Date(inicio) : new Date();
    // Fecha de fin: opcional (null para pausa indefinida)
    const fechaFin = fin ? new Date(fin) : null;

    // Verificar si ya hay una pausa activa
    const { getPausaActiva } = await import('../modules/pausa-v4.js');
    const pausaActiva = await getPausaActiva(Number(alumnoId));
    if (pausaActiva) {
      return new Response(
        JSON.stringify({ 
          error: 'Ya existe una pausa activa. Finalícela antes de crear una nueva.',
          pausaActiva: {
            id: pausaActiva.id,
            inicio: pausaActiva.inicio,
            motivo: pausaActiva.motivo || null
          }
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Crear la pausa usando el servicio canónico
    const { crearPausa } = await import('../modules/pausa-v4.js');
    const pausa = await crearPausa({
      alumno_id: Number(alumnoId),
      inicio: fechaInicio,
      fin: fechaFin,
      motivo: motivo.trim()
    });

    // FASE 3: Registrar evento de auditoría
    let auditEvent = null;
    try {
      auditEvent = await logAuditEvent({
        actor: 'admin',
        alumnoId: Number(alumnoId),
        action: 'pause_create',
        entityType: 'pausa',
        entityId: String(pausa.id),
        payload: {
          pausaId: pausa.id,
          inicio: fechaInicio.toISOString(),
          fin: fechaFin ? fechaFin.toISOString() : null,
          motivo: motivo.trim()
        },
        req: request
      });
    } catch (auditError) {
      // Fail-open: no fallar si la auditoría falla
      console.warn(`[handleCrearPausa] Error registrando auditoría: ${auditError.message}`);
    }

    // AUTO-1: Disparar automatizaciones después de pause_create
    try {
      const { runAutomationsForAlumno } = await import('../core/automations/automation-engine.js');
      await runAutomationsForAlumno(
        Number(alumnoId),
        'pause_create',
        auditEvent,
        env,
        request
      ).catch(autoError => {
        // Fail-open: no fallar si las automatizaciones fallan
        console.warn(`[handleCrearPausa] Error ejecutando automatizaciones: ${autoError.message}`);
      });
    } catch (autoError) {
      // Fail-open: no fallar si las automatizaciones fallan
      console.warn(`[handleCrearPausa] Error importando motor de automatizaciones: ${autoError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Pausa creada correctamente',
        pausa: {
          id: pausa.id,
          inicio: pausa.inicio,
          fin: pausa.fin,
          motivo: pausa.motivo || motivo.trim()
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en handleCrearPausa:', error);
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
 * POST /admin/master/:alumnoId/pausas/finalizar - Finalizar pausa activa (FASE 3)
 * 
 * IMPORTANTE: Esta acción NO está bloqueada por checkPausaActiva porque
 * precisamente es para gestionar las pausas.
 */
export async function handleFinalizarPausa(request, env, alumnoId) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar suscripción activa
    const esActivo = await validarSuscripcionActiva(alumnoId);
    if (!esActivo) {
      return new Response(
        JSON.stringify({ error: 'Alumno no tiene suscripción activa' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await request.json();
    const { pausaId } = body;

    // Obtener pausa activa
    const { getPausaActiva, cerrarPausa, cerrarPausaActiva } = await import('../modules/pausa-v4.js');
    
    let pausaActiva;
    if (pausaId) {
      // Si se proporciona pausaId, verificar que existe y está activa
      const todasPausas = await query(
        'SELECT * FROM pausas WHERE id = $1 AND alumno_id = $2 AND fin IS NULL',
        [pausaId, alumnoId]
      );
      if (todasPausas.rows.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Pausa no encontrada o ya finalizada' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      pausaActiva = todasPausas.rows[0];
    } else {
      // Si no se proporciona pausaId, usar la pausa activa actual
      pausaActiva = await getPausaActiva(Number(alumnoId));
      if (!pausaActiva) {
        return new Response(
          JSON.stringify({ error: 'No hay pausa activa para finalizar' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Cerrar la pausa (fecha fin = ahora)
    const pausaCerrada = await cerrarPausa(pausaActiva.id);

    // FASE 3: Registrar evento de auditoría
    let auditEvent = null;
    try {
      auditEvent = await logAuditEvent({
        actor: 'admin',
        alumnoId: Number(alumnoId),
        action: 'pause_end',
        entityType: 'pausa',
        entityId: String(pausaCerrada.id),
        payload: {
          pausaId: pausaCerrada.id,
          inicio: pausaCerrada.inicio ? (pausaCerrada.inicio instanceof Date ? pausaCerrada.inicio.toISOString() : pausaCerrada.inicio) : null,
          fin: pausaCerrada.fin ? (pausaCerrada.fin instanceof Date ? pausaCerrada.fin.toISOString() : pausaCerrada.fin) : null,
          motivo: pausaCerrada.motivo || null
        },
        req: request
      });
    } catch (auditError) {
      // Fail-open: no fallar si la auditoría falla
      console.warn(`[handleFinalizarPausa] Error registrando auditoría: ${auditError.message}`);
    }

    // AUTO-1: Disparar automatizaciones después de pause_end
    try {
      const { runAutomationsForAlumno } = await import('../core/automations/automation-engine.js');
      await runAutomationsForAlumno(
        Number(alumnoId),
        'pause_end',
        auditEvent,
        env,
        request
      ).catch(autoError => {
        // Fail-open: no fallar si las automatizaciones fallan
        console.warn(`[handleFinalizarPausa] Error ejecutando automatizaciones: ${autoError.message}`);
      });
    } catch (autoError) {
      // Fail-open: no fallar si las automatizaciones fallan
      console.warn(`[handleFinalizarPausa] Error importando motor de automatizaciones: ${autoError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Pausa finalizada correctamente',
        pausa: {
          id: pausaCerrada.id,
          inicio: pausaCerrada.inicio,
          fin: pausaCerrada.fin,
          motivo: pausaCerrada.motivo || null
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en handleFinalizarPausa:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

