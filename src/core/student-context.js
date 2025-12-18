// src/core/student-context.js
// Contrato único y estable "StudentContext" para AuriPortal
//
// PRINCIPIO: La UI es CONSECUENCIA del estado.
// El estado NO puede estar repartido en múltiples módulos con side-effects.
// Este módulo define un contrato único, calculado en una sola función.

import { requireStudentContext } from './auth-context.js';
import { renderPantalla0 } from './responses.js';
import { computeProgress } from './progress-engine.js';
import { checkDailyStreak, detectMilestone } from '../modules/streak.js';
import { gestionarEstadoSuscripcion } from '../modules/suscripcion-v4.js';
import { getFrasePorNivel } from '../modules/frases.js';
import { hitoMessage } from './responses.js';
import { buildProgressUX } from './progress-ux-builder.js';
import { computeStreakFromPracticas } from './streak-engine.js';
import { getAggregatesForAlumno, getRecentSignalsForAlumno } from './signals/signal-aggregator.js';
import { getActivePatternsForAlumno } from './patterns/pattern-engine.js';

/**
 * Construye el contexto completo del estudiante (StudentContext)
 * 
 * SINGLE SOURCE OF TRUTH: Esta función es la única fuente de verdad para
 * el estado del estudiante en el endpoint /enter.
 * 
 * @param {Request} request - Request object
 * @param {object} env - Variables de entorno
 * @param {object} opts - Opciones opcionales
 * @param {boolean} opts.forcePractice - Si true, fuerza práctica (para ?practico=si)
 * @returns {Promise<{ok: true, ctx: StudentContext}|{ok: false, response: Response}>}
 * 
 * @typedef {Object} StudentContext
 * @property {Object} student - Objeto student "source of truth"
 * @property {string} email - Email normalizado
 * @property {boolean} isAuthenticated - Siempre true si ok:true
 * @property {Object} estadoSuscripcion - Estado de suscripción (pausada, reactivada, etc.)
 * @property {boolean} puedePracticar - Si puede practicar hoy
 * @property {Object} streakInfo - Información de racha normalizada
 * @property {Object} nivelInfo - Información de nivel/fase calculada
 * @property {string} frase - Frase motivacional elegida (si falla, '')
 * @property {boolean} todayPracticed - Si ya practicó hoy
 * @property {string} bloqueHito - Mensaje de hito si aplica ('' si no)
 */
export async function buildStudentContext(request, env, opts = {}) {
  console.log('[StudentContext] Iniciando buildStudentContext');
  
  try {
    // 1. Verificar autenticación (devuelve Response si no autenticado)
    let authCtx;
    try {
      authCtx = await requireStudentContext(request, env);
    } catch (authError) {
      console.error('[StudentContext] Error en requireStudentContext:', authError.message);
      return { ok: false, response: renderPantalla0() };
    }
    
    // Si no está autenticado, requireStudentContext ya devolvió la respuesta HTML (pantalla0)
    if (authCtx instanceof Response) {
      console.log('[StudentContext] No autenticado, devolviendo pantalla0');
      return { ok: false, response: authCtx };
    }
    
    // Validar que authCtx tenga user
    if (!authCtx || !authCtx.user) {
      console.warn('[StudentContext] authCtx o authCtx.user no disponible, devolviendo pantalla0');
      return { ok: false, response: renderPantalla0() };
    }
    
    const student = authCtx.user;
    
    // Validar que student tenga email
    if (!student || !student.email) {
      console.warn('[StudentContext] student o student.email no disponible, devolviendo pantalla0');
      return { ok: false, response: renderPantalla0() };
    }
    
    // Normalizar email
    const email = student.email.toLowerCase().trim();
    console.log('[StudentContext] Auth OK para:', email);
    
    // 2. Gestionar estado de suscripción (CRÍTICO para cálculo de días activos)
    let estadoSuscripcion;
    try {
      estadoSuscripcion = await gestionarEstadoSuscripcion(email, env, student, null);
    } catch (suscripcionError) {
      console.error('[StudentContext] Error en gestionarEstadoSuscripcion:', suscripcionError.message);
      // Fail-open: continuar con estado por defecto (no pausada)
      estadoSuscripcion = { pausada: false, reactivada: false };
    }
    
    // Si se reactivó, recargar estudiante para tener datos actualizados
    if (estadoSuscripcion && estadoSuscripcion.reactivada) {
      try {
        const { getOrCreateStudent } = await import('../modules/student-v4.js');
        const studentActualizado = await getOrCreateStudent(email, env);
        if (studentActualizado) {
          Object.assign(student, studentActualizado);
        }
      } catch (reloadError) {
        console.error('[StudentContext] Error recargando estudiante:', reloadError.message);
        // Continuar con student actual si falla la recarga
      }
    }
    
    // 3. Verificar si puede practicar
    let puedePracticar = true;
    if (estadoSuscripcion && estadoSuscripcion.pausada) {
      puedePracticar = false;
    }
    
    // 4. Calcular racha canónica desde practicas (FASE 1.5)
    // NOTA: Si opts.forcePractice es true, primero se ejecuta checkDailyStreak para la mutación,
    // pero luego se usa computeStreakFromPracticas para la lectura canónica
    let streakResult;
    let streakCheck = null;
    
    // Si es forcePractice, ejecutar checkDailyStreak primero (para mutación)
    if (opts.forcePractice) {
      try {
        streakCheck = await checkDailyStreak(student, env, {
          forcePractice: true
        });
        console.log('[StudentContext] checkDailyStreak ejecutado (forcePractice=true)');
      } catch (streakError) {
        console.error('[StudentContext] Error en checkDailyStreak (forcePractice):', streakError.message);
        // Continuar con cálculo canónico aunque falle la mutación
      }
    }
    
    // Calcular racha canónica desde practicas (siempre, para lectura)
    try {
      // Obtener alumno_id del student object
      // En student-v4.js, el campo 'id' es el alumno_id de PostgreSQL
      const alumnoId = student.id || student.raw?.id;
      
      if (!alumnoId) {
        console.warn('[StudentContext] No se pudo obtener alumno_id, usando fallback');
        // Fallback: usar checkDailyStreak si no hay alumno_id
        if (!streakCheck) {
          streakCheck = await checkDailyStreak(student, env, {
            forcePractice: false
          });
        }
        streakResult = {
          actual: streakCheck?.streak || student.streak || 0,
          ultimo_dia_con_practica: null,
          hoy_practicado: streakCheck?.todayPracticed || false,
          congelada_por_pausa: false,
          dias_congelados: 0
        };
      } else {
        // Usar motor canónico
        streakResult = await computeStreakFromPracticas(alumnoId);
        console.log('[StudentContext] Racha canónica calculada:', {
          actual: streakResult.actual,
          hoy_practicado: streakResult.hoy_practicado,
          congelada: streakResult.congelada_por_pausa
        });
      }
    } catch (streakError) {
      console.error('[StudentContext] Error en computeStreakFromPracticas:', streakError.message);
      // Fail-open: usar valores por defecto
      streakResult = {
        actual: student.streak || 0,
        ultimo_dia_con_practica: null,
        hoy_practicado: false,
        congelada_por_pausa: false,
        dias_congelados: 0
      };
    }
    
    // 5. Calcular progreso usando motor único (nivel + fase)
    let progressResult;
    try {
      progressResult = await computeProgress({ student, now: new Date(), env });
      console.log('[StudentContext] progress result:', { 
        nivel_efectivo: progressResult.nivel_efectivo, 
        fase_efectiva: progressResult.fase_efectiva,
        nivel_base: progressResult.nivel_base,
        tiene_overrides: progressResult.overrides_aplicados.length > 0
      });
    } catch (progressError) {
      console.error('[StudentContext] Error en computeProgress:', progressError.message);
      // Si falla, usar valores por defecto (computeProgress ya tiene fallback interno)
      progressResult = {
        nivel_efectivo: 1,
        fase_efectiva: {
          id: 'sanacion',
          nombre: 'Sanación',
          reason: 'fallback_error'
        },
        nombre_nivel: 'Sanación - Inicial',
        nivel_base: 1,
        overrides_aplicados: []
      };
    }
    
    // Construir nivelInfo compatible con código existente
    // fase_efectiva es SIEMPRE un objeto {id, nombre, reason?}
    const faseEfectivaObj = typeof progressResult.fase_efectiva === 'object' 
      ? progressResult.fase_efectiva 
      : { id: 'sanacion', nombre: 'Sanación', reason: 'legacy_string_format' };
    
    const nivelInfo = {
      nivel: progressResult.nivel_efectivo,
      nombre: progressResult.nombre_nivel,
      fase: faseEfectivaObj.nombre, // Compatibilidad: extraer nombre para código legacy
      categoria: faseEfectivaObj.nombre, // Usar nombre de fase como categoría
      esManual: progressResult.overrides_aplicados.length > 0,
      nivelAutomatico: progressResult.nivel_base,
      nombreAutomatico: progressResult.nombre_nivel, // Se puede mejorar si se necesita
      faseAutomatica: faseEfectivaObj.nombre, // Compatibilidad: extraer nombre
      // Campos adicionales para buildProgressUX (mantener compatibilidad)
      nivel_efectivo: progressResult.nivel_efectivo,
      nivel_base: progressResult.nivel_base,
      fase_efectiva: faseEfectivaObj
    };
    
    // 5.5. Construir nivelInfoUX (capa UX derivada)
    let nivelInfoUX;
    try {
      nivelInfoUX = buildProgressUX(nivelInfo);
    } catch (uxError) {
      console.error('[StudentContext] Error en buildProgressUX:', uxError.message);
      // Fail-open: buildProgressUX ya tiene fallback interno, pero por seguridad
      // construimos uno manual si falla completamente
      nivelInfoUX = {
        nivel: { actual: nivelInfo.nivel || 0, nombre: nivelInfo.nombre || 'Nivel' },
        fase: { id: faseEfectivaObj.id || 'unknown', nombre: faseEfectivaObj.nombre || 'Fase no disponible' },
        estado: { mensaje_corto: 'Sigues avanzando' }
      };
    }
    
    // 6. Obtener frase del sistema con variables dinámicas
    let frase = '';
    try {
      const fraseNivel = await getFrasePorNivel(nivelInfo.nivel, student);
      frase = fraseNivel || streakCheck.motivationalPhrase || '';
    } catch (fraseError) {
      console.error('[StudentContext] Error en getFrasePorNivel:', fraseError.message);
      // Si falla, usar frase motivacional por defecto
      frase = streakCheck.motivationalPhrase || '';
    }
    
    // 7. Detectar hito si aplica
    let bloqueHito = '';
    try {
      // Usar racha canónica (streakResult.actual)
      const streakFinal = streakResult.actual;
      if (detectMilestone(streakFinal)) {
        bloqueHito = hitoMessage(streakFinal);
      }
    } catch (hitoError) {
      console.error('[StudentContext] Error en detectMilestone/hitoMessage:', hitoError.message);
      // Si falla, dejar bloqueHito vacío
    }
    
    // 8. Construir streakInfo normalizado (usando racha canónica)
    const streakFinal = streakResult.actual;
    const streakInfo = {
      todayPracticed: streakResult.hoy_practicado,
      streak: streakFinal,
      motivationalPhrase: streakCheck?.motivationalPhrase || getMotivationalPhrase(streakFinal),
      fraseNivel: frase,
      nivelInfo: nivelInfo,
      suscripcionPausada: estadoSuscripcion && estadoSuscripcion.pausada || false,
      razon: estadoSuscripcion && estadoSuscripcion.razon || null,
      // Campos adicionales del motor canónico
      congelada_por_pausa: streakResult.congelada_por_pausa,
      dias_congelados: streakResult.dias_congelados,
      ultimo_dia_con_practica: streakResult.ultimo_dia_con_practica
    };
    
    console.log('[StudentContext] streakInfo result:', { 
      todayPracticed: streakInfo.todayPracticed, 
      streak: streakInfo.streak 
    });
    
    // 8.5. Obtener señales (AUTO-2A)
    let signalsData = {
      raw: [],
      aggregates: {}
    };
    
    try {
      if (alumnoId) {
        // Obtener agregados
        const aggregates = await getAggregatesForAlumno(alumnoId);
        signalsData.aggregates = aggregates;
        
        // Obtener últimas señales (máximo 10)
        const recentSignals = await getRecentSignalsForAlumno(alumnoId, 10);
        signalsData.raw = recentSignals;
        
        console.log('[StudentContext] Señales cargadas:', {
          aggregates_count: Object.keys(aggregates).length,
          raw_count: recentSignals.length
        });
      }
    } catch (signalsError) {
      console.error('[StudentContext] Error cargando señales:', signalsError.message);
      // Fail-open: continuar sin señales
    }
    
    // 8.6. Obtener patrones activos (AUTO-2B)
    let patternsData = {
      active: []
    };
    
    try {
      if (alumnoId) {
        const activePatterns = await getActivePatternsForAlumno(alumnoId);
        patternsData.active = activePatterns;
        
        console.log('[StudentContext] Patrones cargados:', {
          active_count: activePatterns.length
        });
      }
    } catch (patternsError) {
      console.error('[StudentContext] Error cargando patrones:', patternsError.message);
      // Fail-open: continuar sin patrones
    }
    
    // 9. Construir contexto completo
    const ctx = {
      student,
      email,
      isAuthenticated: true,
      estadoSuscripcion,
      puedePracticar,
      streakInfo,
      nivelInfo, // Mantener para compatibilidad legacy
      nivelInfoUX, // Nueva capa UX
      frase,
      todayPracticed: streakInfo.todayPracticed,
      bloqueHito,
      signals: signalsData, // AUTO-2A: Señales post-práctica
      patterns: patternsData // AUTO-2B: Patrones derivados de señales
    };
    
    console.log('[StudentContext] Contexto construido exitosamente');
    
    return { ok: true, ctx };
    
  } catch (error) {
    // CRÍTICO: Capturar TODOS los errores y devolver pantalla0 (fail-open)
    console.error('[StudentContext] Error no manejado en buildStudentContext:', error);
    console.error('[StudentContext] Stack:', error.stack);
    // NUNCA devolver 500 - siempre pantalla0
    return { ok: false, response: renderPantalla0() };
  }
}

/**
 * Frases motivacionales según racha (función auxiliar)
 * @private
 */
function getMotivationalPhrase(streak) {
  if (streak <= 3) return "Hoy enciendes tu luz interior.";
  if (streak <= 10) return "Tu constancia está despertando un fuego nuevo.";
  if (streak <= 30) return "Tu energía ya sostiene un ritmo sagrado.";
  return "Tu compromiso ilumina caminos invisibles.";
}

