// src/modules/nivel-v4.js
// Sistema de niveles automático para AuriPortal v4 (Sovereign Edition)
// PostgreSQL es la ÚNICA fuente de verdad
//
// REFACTOR: Usa StudentRepo (vía student-v4.js) en lugar de importar directamente database/pg.js
// El repositorio encapsula todas las queries de alumnos.

import { nivelesFases } from "../../database/pg.js";
import { findStudentByEmail, updateStudentNivel } from "./student-v4.js";
import { isFeatureEnabled } from "../core/flags/feature-flags.js";
import { logInfo, logWarn } from "../core/observability/logger.js";

/**
 * Configuración de niveles basados en días activos (considerando pausas)
 * Basado en el sistema de niveles de Aurelín
 * Según README_V4.md: Rangos de días por nivel
 */
const NIVEL_THRESHOLDS = [
  // Sanación (Healing)
  { diasMin: 0, diasMax: 39, nivel: 1, nombre: "Sanación - Inicial", categoria: "Sanación" },
  { diasMin: 40, diasMax: 59, nivel: 2, nombre: "Sanación - Nivel 2", categoria: "Sanación" },
  { diasMin: 60, diasMax: 89, nivel: 3, nombre: "Sanación - Nivel 3", categoria: "Sanación" },
  { diasMin: 90, diasMax: 119, nivel: 4, nombre: "Sanación - Nivel 4", categoria: "Sanación" },
  { diasMin: 120, diasMax: 149, nivel: 5, nombre: "Sanación - Nivel 5", categoria: "Sanación" },
  { diasMin: 150, diasMax: 179, nivel: 6, nombre: "Sanación - Nivel 6", categoria: "Sanación" },
  // Sanación Avanzada
  { diasMin: 180, diasMax: 229, nivel: 7, nombre: "Sanación - Nivel 7", categoria: "Sanación Avanzada" },
  { diasMin: 230, diasMax: 259, nivel: 8, nombre: "Sanación - Nivel 8", categoria: "Sanación Avanzada" },
  { diasMin: 260, diasMax: 289, nivel: 9, nombre: "Sanación - Nivel 9", categoria: "Sanación Avanzada" },
  // Canalización (Channeling)
  { diasMin: 290, diasMax: 319, nivel: 10, nombre: "Canalización - Nivel 10", categoria: "Canalización" },
  { diasMin: 320, diasMax: 349, nivel: 11, nombre: "Canalización - Nivel 11", categoria: "Canalización" },
  { diasMin: 350, diasMax: 379, nivel: 12, nombre: "Canalización - Nivel 12", categoria: "Canalización" },
  { diasMin: 380, diasMax: 409, nivel: 13, nombre: "Canalización - Nivel 13", categoria: "Canalización" },
  { diasMin: 410, diasMax: 439, nivel: 14, nombre: "Canalización - Nivel 14", categoria: "Canalización" },
  { diasMin: 440, diasMax: 9999, nivel: 15, nombre: "Canalización - Nivel 15", categoria: "Canalización" }
];

/**
 * Calcula el nivel automático basado en días activos (considerando pausas)
 */
export async function getNivelPorDiasActivos(alumnoId) {
  // Importar getDiasActivos localmente para evitar dependencia circular
  const { getDiasActivos } = await import("./student-v4.js");
  const diasActivos = await getDiasActivos(alumnoId);
  
  // Usar función pura compartida (single source of truth)
  return calcularNivelPorDiasActivos(diasActivos);
}

/**
 * Calcula el nivel basado en días activos (función pura, sin DB)
 * 
 * SINGLE SOURCE OF TRUTH: Esta función es la única fuente de verdad para el cálculo de nivel.
 * Devuelve una copia de los thresholds para evitar mutaciones.
 * 
 * @param {number} diasActivos - Días activos del alumno
 * @returns {number} Nivel calculado (1-15)
 */
export function calcularNivelPorDiasActivos(diasActivos) {
  if (typeof diasActivos !== 'number' || diasActivos < 0) {
    return 1; // Nivel por defecto
  }
  
  // Encontrar el nivel correspondiente según rangos de días
  let nivelCalculado = 1;
  for (const threshold of NIVEL_THRESHOLDS) {
    if (diasActivos >= threshold.diasMin && diasActivos <= threshold.diasMax) {
      nivelCalculado = threshold.nivel;
      break; // Encontrado, salir del bucle
    }
  }

  return nivelCalculado;
}

/**
 * Obtiene una copia de los thresholds de nivel (single source of truth)
 * 
 * @returns {Array} Copia de NIVEL_THRESHOLDS para evitar mutaciones
 */
export function getNivelThresholds() {
  // Devolver copia profunda para evitar mutaciones
  return JSON.parse(JSON.stringify(NIVEL_THRESHOLDS));
}

/**
 * Obtiene la fase correspondiente a un nivel desde PostgreSQL
 */
export async function getFasePorNivel(nivel) {
  const fase = await nivelesFases.getFasePorNivel(nivel);
  return fase ? fase.fase : "sanación";
}

/**
 * Obtiene los días activos de un alumno (considerando pausas)
 */
export async function getDiasActivosPorEmail(email) {
  // Importar getDiasActivos localmente para evitar dependencia circular
  const { getDiasActivos } = await import("./student-v4.js");
  
  // Usar student-v4.js que usa el repositorio
  const student = await findStudentByEmail(null, email); // env no necesario para findByEmail
  if (!student || !student.id) return 0;
  
  return await getDiasActivos(student.id);
}

/**
 * Calcula el nivel automático basado en fecha de inscripción (legacy - para compatibilidad)
 */
export function calcularNivelAutomatico(fechaInscripcion) {
  if (!fechaInscripcion) return 1;

  const ahora = Date.now();
  const diasDesdeInscripcion = Math.floor((ahora - fechaInscripcion) / (1000 * 60 * 60 * 24));

  // Usar función pura compartida (single source of truth)
  return calcularNivelPorDiasActivos(diasDesdeInscripcion);
}

/**
 * Obtiene el nombre del nivel
 */
export function getNombreNivel(nivel) {
  const config = NIVEL_THRESHOLDS.find(t => t.nivel === nivel);
  return config ? config.nombre : "Sanación - Inicial";
}

/**
 * Obtiene la categoría del nivel (legacy - usar getFasePorNivel en su lugar)
 */
export function getCategoriaNivel(nivel) {
  const config = NIVEL_THRESHOLDS.find(t => t.nivel === nivel);
  return config ? config.categoria : "Sanación";
}

/**
 * Actualiza el nivel del estudiante en PostgreSQL si es necesario
 * 
 * REGLAS:
 * 1. PostgreSQL es la fuente de verdad
 * 2. Solo actualiza si el nivel automático es mayor al actual (respeta cambios manuales)
 * 3. NO actualiza si la suscripción NO está activa (pausada)
 * 4. Respeta nivel_manual si existe
 * 
 * PROTEGIDO POR FEATURE FLAG: nivel_calculo_v2
 * - Estado 'off': Ejecuta lógica actual (comportamiento por defecto)
 * - Estado 'on'/'beta': Placeholder para lógica futura (por ahora fallback a lógica actual)
 * 
 * @param {Object} student - Objeto estudiante normalizado
 * @param {Object} env - Variables de entorno
 * @returns {number} Nivel actual (puede ser el mismo o el actualizado)
 */
export async function actualizarNivelSiCorresponde(student, env) {
  if (!student || !student.id) {
    console.error("❌ actualizarNivelSiCorresponde: student sin ID");
    return 1;
  }

  // Preparar contexto para feature flag y logging
  const ctx = {
    alumno_id: student.id,
    email: student.email,
    student: {
      id: student.id,
      email: student.email
    }
  };

  // Evaluar feature flag
  const flagActivo = isFeatureEnabled('nivel_calculo_v2', ctx);

  // El nivel actual viene de PostgreSQL (fuente de verdad)
  const nivelActual = student.nivel_manual || student.nivel_actual || 1;
  
  // Calcular días activos (esto ya considera las pausas registradas)
  const { getDiasActivos } = await import("./student-v4.js");
  const diasActivos = await getDiasActivos(student.id);
  
  // Calcular nivel automático basado en días activos
  const nivelAutomatico = await getNivelPorDiasActivos(student.id);

  // Log INFO cuando se evalúa el flag (trazabilidad)
  logInfo('nivel', 'actualizarNivelSiCorresponde: evaluación de feature flag', {
    flag: 'nivel_calculo_v2',
    flag_activo: flagActivo,
    alumno_id: student.id,
    email: student.email,
    nivel_actual: nivelActual,
    nivel_calculado: nivelAutomatico,
    dias_activos: diasActivos
  });

  // Si el flag está activo (dev/beta), log WARN indicando camino nuevo
  // NOTA: Por ahora ejecuta la misma lógica actual como fallback hasta que se implemente la nueva
  if (flagActivo) {
    logWarn('nivel', 'actualizarNivelSiCorresponde: feature flag nivel_calculo_v2 ACTIVO - usando lógica actual como fallback (lógica futura pendiente)', {
      alumno_id: student.id,
      email: student.email,
      nivel_actual: nivelActual,
      nivel_calculado: nivelAutomatico,
      dias_activos: diasActivos,
      flag: 'nivel_calculo_v2'
    });
    // PLACEHOLDER: Aquí irá la nueva lógica cuando se implemente
    // Por ahora, ejecutar lógica actual como fallback
    return await actualizarNivelSiCorresponde_LogicaActual(student, env, nivelActual, nivelAutomatico, diasActivos);
  }

  // Flag 'off': Ejecutar lógica actual (comportamiento por defecto)
  return await actualizarNivelSiCorresponde_LogicaActual(student, env, nivelActual, nivelAutomatico, diasActivos);
}

/**
 * Lógica actual de actualización de nivel (extraída para reutilización)
 * 
 * Esta función contiene la lógica original que se ejecuta cuando el feature flag está 'off'
 * o como fallback cuando está 'on'/'beta' (hasta que se implemente la nueva lógica)
 * 
 * @param {Object} student - Objeto estudiante normalizado
 * @param {Object} env - Variables de entorno
 * @param {number} nivelActual - Nivel actual del estudiante
 * @param {number} nivelAutomatico - Nivel calculado automáticamente
 * @param {number} diasActivos - Días activos del estudiante
 * @returns {number} Nivel actual (puede ser el mismo o el actualizado)
 */
async function actualizarNivelSiCorresponde_LogicaActual(student, env, nivelActual, nivelAutomatico, diasActivos) {
  // Verificar si la suscripción está activa (usar estado_suscripcion directamente de PostgreSQL)
  const estadoSuscripcion = student.estado_suscripcion || student.raw?.estado_suscripcion || 'activa';
  const suscripcionActiva = estadoSuscripcion === 'activa';
  
  if (!suscripcionActiva) {
    console.log(`⏸️  Nivel pausado para ${student.email} - Suscripción ${estadoSuscripcion} (días activos CONGELADOS: ${diasActivos}, nivel actual: ${nivelActual}, nivel automático: ${nivelAutomatico})`);
    return nivelActual; // No actualizar si está pausado - los días activos ya están congelados
  }

  // Si hay nivel_manual, respetarlo (no actualizar automáticamente)
  if (student.nivel_manual && student.nivel_manual !== nivelAutomatico) {
    console.log(`🔒 Nivel manual respetado para ${student.email}: ${student.nivel_manual} (automático sería ${nivelAutomatico} con ${diasActivos} días activos)`);
    return student.nivel_manual;
  }

  // Solo actualizar si el nivel automático es MAYOR (progresión natural)
  if (nivelAutomatico > nivelActual) {
    try {
      // Usar student-v4.js que usa el repositorio
      await updateStudentNivel(student.email, nivelAutomatico);
      console.log(`✅ Nivel actualizado en PostgreSQL: ${student.email} → ${nivelAutomatico} (días activos: ${diasActivos}, nivel anterior: ${nivelActual})`);
      return nivelAutomatico;
    } catch (err) {
      console.error("Error actualizando nivel:", err);
      return nivelActual;
    }
  }

  // Log para debugging cuando no hay cambios
  if (nivelAutomatico <= nivelActual) {
    console.log(`ℹ️  Nivel sin cambios para ${student.email}: ${nivelActual} (días activos: ${diasActivos}, nivel automático: ${nivelAutomatico})`);
  }

  return nivelActual;
}

/**
 * Obtiene información completa del nivel
 * 
 * @param {Object} student - Objeto estudiante normalizado desde PostgreSQL
 * @returns {Object} Información completa del nivel incluyendo nivel actual, nombre, fase, etc.
 */
export async function getNivelInfo(student) {
  if (!student) {
    return {
      nivel: 1,
      nombre: "Sanación - Inicial",
      fase: "sanación",
      esManual: false,
      nivelAutomatico: 1,
      nombreAutomatico: "Sanación - Inicial",
      faseAutomatica: "sanación"
    };
  }

  // El nivel siempre viene de PostgreSQL (fuente de verdad)
  const nivel = student.nivel_manual || student.nivel_actual || 1;
  const nombre = getNombreNivel(nivel);
  const fase = await getFasePorNivel(nivel);
  
  // Calcular nivel automático para comparación
  const nivelAutomatico = student.id ? await getNivelPorDiasActivos(student.id) : calcularNivelAutomatico(student.fechaInscripcion);
  const faseAutomatica = await getFasePorNivel(nivelAutomatico);
  
  return {
    nivel,
    nombre,
    fase,
    esManual: !!student.nivel_manual && student.nivel_manual !== nivelAutomatico,
    nivelAutomatico,
    nombreAutomatico: getNombreNivel(nivelAutomatico),
    faseAutomatica
  };
}

/**
 * Recalcula el nivel de todos los alumnos basado en sus días activos
 * Solo actualiza alumnos sin nivel_manual establecido
 * 
 * @returns {Promise<Object>} Resultado con estadísticas del recálculo
 */
export async function recalcularNivelesTodosAlumnos() {
  const { getPool } = await import("../../database/pg.js");
  const { getDiasActivos } = await import("./student-v4.js");
  const pool = getPool();
  
  const horaInicio = new Date().toISOString();
  console.log(`\n🔄 [${horaInicio}] Iniciando recálculo masivo de niveles de todos los alumnos...`);
  
  try {
    // Obtener todos los alumnos que NO tienen nivel_manual (solo los que deben calcularse automáticamente)
    const alumnosResult = await pool.query(`
      SELECT id, email, nivel_actual, nivel_manual, estado_suscripcion
      FROM alumnos
      WHERE nivel_manual IS NULL
      ORDER BY id
    `);
    
    const totalAlumnos = alumnosResult.rows.length;
    console.log(`📊 Encontrados ${totalAlumnos} alumnos sin nivel manual (se recalcularán)`);
    
    const resultados = {
      total: totalAlumnos,
      actualizados: 0,
      sinCambios: 0,
      errores: 0,
      pausados: 0
    };
    
    // Procesar cada alumno
    for (let i = 0; i < alumnosResult.rows.length; i++) {
      const alumno = alumnosResult.rows[i];
      
      try {
        // Solo recalcular si la suscripción está activa
        if (alumno.estado_suscripcion !== 'activa') {
          resultados.pausados++;
          continue;
        }
        
        // Calcular días activos
        const diasActivos = await getDiasActivos(alumno.id);
        
        // Calcular nivel automático según días activos (usar función pura compartida)
        const nivelNuevo = calcularNivelPorDiasActivos(diasActivos);
        
        // Solo actualizar si el nivel cambió
        if (nivelNuevo !== alumno.nivel_actual) {
          await pool.query(
            'UPDATE alumnos SET nivel_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [nivelNuevo, alumno.id]
          );
          resultados.actualizados++;
          console.log(`   ✅ ${alumno.email}: Nivel ${alumno.nivel_actual} → ${nivelNuevo} (${diasActivos} días activos)`);
        } else {
          resultados.sinCambios++;
        }
        
        // Pequeño delay para no saturar la base de datos
        if (i < alumnosResult.rows.length - 1 && (i + 1) % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Log de progreso cada 50 alumnos
        if ((i + 1) % 50 === 0) {
          console.log(`   📊 Progreso: ${i + 1}/${totalAlumnos} alumnos procesados`);
        }
      } catch (err) {
        resultados.errores++;
        console.error(`   ❌ Error procesando ${alumno.email}:`, err.message);
      }
    }
    
    const horaFin = new Date().toISOString();
    console.log(`✅ [${horaFin}] Recálculo masivo de niveles completado:`);
    console.log(`   - Total procesados: ${resultados.total}`);
    console.log(`   - Actualizados: ${resultados.actualizados}`);
    console.log(`   - Sin cambios: ${resultados.sinCambios}`);
    console.log(`   - Pausados (no procesados): ${resultados.pausados}`);
    console.log(`   - Errores: ${resultados.errores}\n`);
    
    return resultados;
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Error en recálculo masivo de niveles:`, error);
    throw error;
  }
}

