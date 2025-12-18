// src/core/streak-engine.js
// Motor canónico de cálculo de racha diaria desde practicas
//
// PRINCIPIO: La racha diaria es una función pura calculada desde practicas + pausas.
// NO depende de campos legacy (alumnos.streak) ni de funciones mutantes (checkDailyStreak).
//
// CARACTERÍSTICAS:
// - SOLO lectura (sin efectos secundarios)
// - SIN escrituras
// - SIN dependencias externas (ClickUp, jobs, etc.)
// - Fecha "hoy" configurable vía opts.today (para testabilidad)
// - Reproducible y determinista

import { getDefaultPracticeRepo } from '../infra/repos/practice-repo-pg.js';
import { getDefaultPausaRepo } from '../infra/repos/pausa-repo-pg.js';

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD (horario España)
 * @param {Date} [today] - Fecha opcional para testabilidad (default: new Date())
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function hoyES(today = new Date()) {
  // Usar horario España (UTC+1 o UTC+2 según DST)
  // Por simplicidad, usar UTC y ajustar manualmente
  const fecha = new Date(today);
  // Convertir a horario España (UTC+1)
  const offsetEspana = 1; // Horas de diferencia con UTC
  const fechaEspana = new Date(fecha.getTime() + (offsetEspana * 60 * 60 * 1000));
  return fechaEspana.toISOString().substring(0, 10);
}

/**
 * Convierte una fecha a objeto Date con inicio del día (00:00:00)
 * @param {string|Date} fecha - Fecha a convertir
 * @returns {Date} Fecha con inicio del día
 */
function inicioDelDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Convierte una fecha a objeto Date con fin del día (23:59:59.999)
 * @param {string|Date} fecha - Fecha a convertir
 * @returns {Date} Fecha con fin del día
 */
function finDelDia(fecha) {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Calcula la diferencia en días entre dos fechas
 * @param {Date|string} fecha1 - Primera fecha
 * @param {Date|string} fecha2 - Segunda fecha
 * @returns {number} Diferencia en días (puede ser negativa)
 */
function diferenciaEnDias(fecha1, fecha2) {
  const d1 = inicioDelDia(fecha1);
  const d2 = inicioDelDia(fecha2);
  const diffMs = d1.getTime() - d2.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Verifica si una fecha está dentro de un rango de pausa
 * @param {Date|string} fecha - Fecha a verificar
 * @param {Object} pausa - Objeto pausa con inicio y fin
 * @returns {boolean} true si la fecha está dentro de la pausa
 */
function fechaEnPausa(fecha, pausa) {
  if (!pausa) return false;
  
  const fechaCheck = inicioDelDia(fecha);
  const inicioPausa = inicioDelDia(pausa.inicio);
  const finPausa = pausa.fin ? inicioDelDia(pausa.fin) : null;
  
  // Si la pausa no tiene fin, se considera activa hasta hoy
  if (!finPausa) {
    return fechaCheck >= inicioPausa;
  }
  
  return fechaCheck >= inicioPausa && fechaCheck <= finPausa;
}

/**
 * Obtiene todas las pausas que cubren un rango de fechas
 * @param {number} alumnoId - ID del alumno
 * @param {Date} fechaInicio - Fecha de inicio del rango
 * @param {Date} fechaFin - Fecha de fin del rango
 * @returns {Promise<Array>} Array de pausas que cubren el rango
 */
async function obtenerPausasEnRango(alumnoId, fechaInicio, fechaFin) {
  const pausaRepo = getDefaultPausaRepo();
  const todasPausas = await pausaRepo.findByAlumnoId(alumnoId);
  
  return todasPausas.filter(pausa => {
    const inicioPausa = inicioDelDia(pausa.inicio);
    const finPausa = pausa.fin ? inicioDelDia(pausa.fin) : fechaFin;
    
    // Verificar si hay solapamiento
    return inicioPausa <= fechaFin && finPausa >= fechaInicio;
  });
}

/**
 * Verifica si existe al menos una práctica válida en un día específico
 * @param {number} alumnoId - ID del alumno
 * @param {Date|string} fecha - Fecha a verificar
 * @returns {Promise<boolean>} true si existe al menos una práctica ese día
 */
async function tienePracticaEnDia(alumnoId, fecha) {
  const practiceRepo = getDefaultPracticeRepo();
  const practica = await practiceRepo.existsForDate(alumnoId, fecha);
  return practica !== null;
}

/**
 * Obtiene la fecha del último día con práctica
 * @param {number} alumnoId - ID del alumno
 * @returns {Promise<Date|null>} Fecha del último día con práctica o null
 */
async function obtenerUltimoDiaConPractica(alumnoId) {
  const practiceRepo = getDefaultPracticeRepo();
  const practicas = await practiceRepo.findByAlumnoId(alumnoId, 1);
  
  if (practicas.length === 0) {
    return null;
  }
  
  return new Date(practicas[0].fecha);
}

/**
 * Calcula la racha diaria canónica desde practicas
 * 
 * REGLAS DE CÁLCULO:
 * 1. La racha se cuenta por DÍAS consecutivos hacia atrás desde hoy.
 * 2. Un día cuenta si existe ≥1 práctica válida ese día.
 * 3. El cálculo se detiene al primer día no válido.
 * 4. Si un día está cubierto por una pausa activa:
 *    - NO rompe la racha
 *    - NO incrementa la racha
 * 5. Si HOY:
 *    - hay práctica → cuenta
 *    - no hay práctica y NO hay pausa → racha = 0
 *    - no hay práctica y HAY pausa → racha se congela
 * 
 * @param {number} alumnoId - ID del alumno en PostgreSQL
 * @param {Object} [opts={}] - Opciones
 * @param {Date|string} [opts.today] - Fecha "hoy" para testabilidad (default: new Date())
 * @returns {Promise<Object>} Objeto con:
 *   - actual: number - Racha actual (días consecutivos)
 *   - ultimo_dia_con_practica: Date | null - Último día con práctica
 *   - hoy_practicado: boolean - Si practicó hoy
 *   - congelada_por_pausa: boolean - Si la racha está congelada por pausa
 *   - dias_congelados: number - Días consecutivos congelados (desde hoy hacia atrás)
 */
export async function computeStreakFromPracticas(alumnoId, opts = {}) {
  if (!alumnoId) {
    console.error('[StreakEngine][FAIL] alumnoId no proporcionado');
    return {
      actual: 0,
      ultimo_dia_con_practica: null,
      hoy_practicado: false,
      congelada_por_pausa: false,
      dias_congelados: 0
    };
  }
  
  try {
    const today = opts.today ? new Date(opts.today) : new Date();
    const hoyStr = hoyES(today);
    const hoyDate = inicioDelDia(today);
    
    // Obtener pausa activa (si existe)
    const pausaRepo = getDefaultPausaRepo();
    const pausaActiva = await pausaRepo.getPausaActiva(alumnoId);
    
    // Verificar si hoy tiene práctica
    const hoyPracticado = await tienePracticaEnDia(alumnoId, hoyDate);
    
    // Obtener último día con práctica
    const ultimoDiaConPractica = await obtenerUltimoDiaConPractica(alumnoId);
    
    // Si no hay prácticas, racha = 0
    if (!ultimoDiaConPractica) {
      console.log(`[StreakEngine][OK] alumnoId=${alumnoId} actual=0 hoy_practicado=${hoyPracticado} congelada=false (sin prácticas)`);
      return {
        actual: 0,
        ultimo_dia_con_practica: null,
        hoy_practicado: hoyPracticado,
        congelada_por_pausa: false,
        dias_congelados: 0
      };
    }
    
    // Calcular racha: contar días consecutivos hacia atrás desde hoy
    let racha = 0;
    let diasCongelados = 0;
    let diaActual = hoyDate;
    let encontroGap = false;
    let enPausaActiva = pausaActiva && fechaEnPausa(hoyDate, pausaActiva);
    
    // Si hoy tiene práctica, cuenta
    if (hoyPracticado) {
      racha = 1;
      diaActual = new Date(diaActual);
      diaActual.setDate(diaActual.getDate() - 1);
    } else {
      // Si hoy NO tiene práctica
      if (enPausaActiva) {
        // Hoy está en pausa → no cuenta hoy, pero puede haber racha previa
        // Continuar hacia atrás para ver si hay racha previa
        diasCongelados = 1;
        diaActual = new Date(diaActual);
        diaActual.setDate(diaActual.getDate() - 1);
      } else {
        // Hoy NO tiene práctica y NO está en pausa → racha = 0
        console.log(`[StreakEngine][OK] alumnoId=${alumnoId} actual=0 hoy_practicado=false congelada=false (sin práctica hoy y sin pausa)`);
        return {
          actual: 0,
          ultimo_dia_con_practica: ultimoDiaConPractica,
          hoy_practicado: false,
          congelada_por_pausa: false,
          dias_congelados: 0
        };
      }
    }
    
    // Continuar contando hacia atrás
    while (!encontroGap && diaActual >= inicioDelDia(ultimoDiaConPractica)) {
      const tienePractica = await tienePracticaEnDia(alumnoId, diaActual);
      const estaEnPausa = pausaActiva && fechaEnPausa(diaActual, pausaActiva);
      
      if (tienePractica) {
        // Hay práctica → incrementa racha
        racha++;
        diasCongelados = 0; // Reset días congelados si hay práctica
      } else if (estaEnPausa) {
        // No hay práctica pero está en pausa → no rompe, no incrementa
        diasCongelados++;
      } else {
        // No hay práctica y NO está en pausa → GAP, detener
        encontroGap = true;
        break;
      }
      
      // Retroceder un día
      diaActual = new Date(diaActual);
      diaActual.setDate(diaActual.getDate() - 1);
    }
    
    // Determinar si la racha está congelada por pausa
    // La racha está congelada si:
    // - Hay días congelados (incluyendo hoy si está en pausa)
    // - Y la racha es > 0 (hay racha previa que se congela)
    // O si hoy está en pausa y no hay práctica pero hay racha previa
    const congeladaPorPausa = (diasCongelados > 0 && racha > 0) || (enPausaActiva && !hoyPracticado && racha > 0);
    
    console.log(`[StreakEngine][OK] alumnoId=${alumnoId} actual=${racha} hoy_practicado=${hoyPracticado} congelada=${congeladaPorPausa} dias_congelados=${diasCongelados}`);
    
    return {
      actual: racha,
      ultimo_dia_con_practica: ultimoDiaConPractica,
      hoy_practicado: hoyPracticado,
      congelada_por_pausa: congeladaPorPausa,
      dias_congelados: diasCongelados
    };
    
  } catch (error) {
    console.error(`[StreakEngine][FAIL] alumnoId=${alumnoId} error=${error.message}`);
    console.error(`[StreakEngine][FAIL] stack:`, error.stack);
    
    // Fail-open: devolver valores por defecto seguros
    return {
      actual: 0,
      ultimo_dia_con_practica: null,
      hoy_practicado: false,
      congelada_por_pausa: false,
      dias_congelados: 0
    };
  }
}

