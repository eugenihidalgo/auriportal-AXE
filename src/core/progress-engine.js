// src/core/progress-engine.js
// Motor único de cálculo de progreso (nivel + fase) para AuriPortal
//
// PRINCIPIO ARQUITECTÓNICO: Single source of truth
// - nivel_base: calculado por el sistema (días activos → nivel)
// - overrides: ajustes del Master (auditables, reversibles)
// - nivel_efectivo y fase_efectiva: lo único que consume el cliente
//
// Fail-open controlado: si algo falla, fallback a valores seguros con logWarn

import { getDiasActivos } from '../modules/student-v4.js';
import { calcularDiasPausados } from '../modules/pausa-v4.js';
import { calcularNivelPorDiasActivos, getNombreNivel } from '../modules/nivel-v4.js';
// Nota: nivelesFases es el nombre de la función helper para la tabla legacy
// El nombre canónico del concepto es "niveles_energeticos"
import { nivelesFases } from '../../database/pg.js';
import { getDefaultNivelOverrideRepo } from '../infra/repos/nivel-override-repo-pg.js';
import { logWarn, logInfo } from './observability/logger.js';
import { validateAndNormalizeNivelesEnergeticos, resolveFaseFromConfig } from './config/niveles-energeticos.schema.js';

/**
 * Calcula el progreso completo de un estudiante
 * 
 * SINGLE SOURCE OF TRUTH: Esta función es la única fuente de verdad para
 * el cálculo de nivel y fase. Todos los módulos deben usar esta función.
 * 
 * @param {Object} params - Parámetros de cálculo
 * @param {Object} params.student - Objeto estudiante (debe tener id, email, fecha_inscripcion)
 * @param {Date} [params.now] - Fecha de referencia (default: ahora)
 * @param {Object} [params.env] - Variables de entorno (opcional)
 * @returns {Promise<Object>} Objeto con progreso calculado
 * 
 * @typedef {Object} ProgressResult
 * @property {number} dias_activos - Días activos (considerando pausas)
 * @property {number} dias_pausados - Total de días pausados
 * @property {number} nivel_base - Nivel calculado por el sistema (sin overrides)
 * @property {Array} overrides_aplicados - Array de overrides aplicados
 * @property {number} nivel_efectivo - Nivel final después de aplicar overrides
 * @property {Object} fase_efectiva - Fase correspondiente al nivel_efectivo (SIEMPRE objeto: {id, nombre, reason?})
 * @property {string} nombre_nivel - Nombre del nivel efectivo
 * @property {string} motivo_debug - Información de debug (solo para logs)
 */
export async function computeProgress({ student, now = new Date(), env = {} }) {
  // Validación inicial
  if (!student) {
    logWarn('progress_engine', 'computeProgress: student es null/undefined', {}, true);
    return getFallbackProgress();
  }

  if (!student.id && !student.email) {
    logWarn('progress_engine', 'computeProgress: student sin id ni email', {
      student_keys: Object.keys(student || {})
    }, true);
    return getFallbackProgress();
  }

  try {
    // 1. Calcular días activos (ya considera pausas)
    let diasActivos = 0;
    let diasPausados = 0;
    
    try {
      if (student.id) {
        diasActivos = await getDiasActivos(student.id);
        diasPausados = await calcularDiasPausados(student.id);
      } else {
        // Fallback: calcular desde fecha_inscripcion si no hay id
        if (student.fecha_inscripcion) {
          const fechaInscripcion = new Date(student.fecha_inscripcion);
          const diasTotales = Math.floor((now - fechaInscripcion) / (1000 * 60 * 60 * 24));
          diasActivos = Math.max(0, diasTotales);
          diasPausados = 0; // No podemos calcular pausas sin id
        }
      }
    } catch (error) {
      logWarn('progress_engine', 'Error calculando días activos/pausados', {
        student_id: student.id,
        student_email: student.email,
        error: error.message
      });
      // Fallback: usar valores por defecto
      diasActivos = 0;
      diasPausados = 0;
    }

    // 2. Calcular nivel_base (sin overrides)
    let nivelBase = 1;
    try {
      nivelBase = calcularNivelPorDiasActivos(diasActivos);
    } catch (error) {
      logWarn('progress_engine', 'Error calculando nivel_base', {
        dias_activos: diasActivos,
        error: error.message
      });
      nivelBase = 1; // Fallback seguro
    }

    // 3. Obtener overrides activos del Master
    let overridesAplicados = [];
    let nivelEfectivo = nivelBase;
    
    try {
      const overrideRepo = getDefaultNivelOverrideRepo();
      const studentIdOrEmail = student.id || student.email;
      const overrideActivo = await overrideRepo.getActiveOverride(studentIdOrEmail);
      
      if (overrideActivo) {
        overridesAplicados = [overrideActivo];
        
        // Aplicar override según tipo
        switch (overrideActivo.type) {
          case 'ADD':
            nivelEfectivo = nivelBase + overrideActivo.value;
            break;
          case 'SET':
            nivelEfectivo = overrideActivo.value;
            break;
          case 'MIN':
            nivelEfectivo = Math.max(nivelBase, overrideActivo.value);
            break;
          default:
            logWarn('progress_engine', 'Tipo de override desconocido', {
              override_id: overrideActivo.id,
              type: overrideActivo.type
            });
            nivelEfectivo = nivelBase; // Fallback: ignorar override inválido
        }
        
        // Validar que nivel_efectivo esté en rango válido (1-15)
        nivelEfectivo = Math.max(1, Math.min(15, nivelEfectivo));
      }
    } catch (error) {
      logWarn('progress_engine', 'Error obteniendo/aplicando overrides', {
        student_id: student.id,
        student_email: student.email,
        error: error.message
      });
      // Continuar con nivel_base si falla la lectura de overrides
    }

    // 4. Resolver fase_efectiva desde configuración del Admin (niveles_energeticos)
    // SINGLE SOURCE OF TRUTH: Cargar, validar y normalizar configuración antes de resolver
    // CONTRATO: fase_efectiva SIEMPRE es un objeto {id, nombre, reason?}, nunca un string
    let faseEfectiva = {
      id: 'sanacion',
      nombre: 'Sanación',
      reason: 'fallback_default'
    };
    let nombreNivel = getNombreNivel(nivelEfectivo);
    
    try {
      // Cargar toda la configuración de niveles_energeticos
      const configRaw = await nivelesFases.getAll();
      
      // Validar y normalizar la configuración
      const validationResult = validateAndNormalizeNivelesEnergeticos(configRaw);
      
      if (!validationResult.ok) {
        // FAIL-OPEN CONTROLADO: Config inválida => fase unknown estructurada con log
        logWarn('progress_engine', 'Configuración niveles_energeticos inválida', {
          nivel: nivelEfectivo,
          student_id: student.id,
          student_email: student.email,
          validation_errors: validationResult.errors
        }, true); // Force log para observabilidad
        
        // Usar fase unknown estructurada (SIEMPRE objeto)
        faseEfectiva = {
          id: 'unknown',
          nombre: 'Fase no disponible',
          reason: 'invalid_config'
        };
        nombreNivel = getNombreNivel(nivelEfectivo); // Mantener nombre de nivel aunque fase sea unknown
      } else {
        // Config válida: resolver fase usando el resolver normalizado
        const faseResuelta = resolveFaseFromConfig(validationResult.value, nivelEfectivo);
        
        if (faseResuelta.id === 'unknown') {
          // No se encontró fase para este nivel (pero la config es válida)
          logWarn('progress_engine', 'Nivel sin cobertura en config válida', {
            nivel: nivelEfectivo,
            student_id: student.id,
            student_email: student.email,
            reason: faseResuelta.reason
          });
          // Fallback a sanación estructurada (SIEMPRE objeto)
          faseEfectiva = {
            id: 'sanacion',
            nombre: 'Sanación',
            reason: faseResuelta.reason || 'nivel_sin_cobertura'
          };
        } else {
          // Usar fase resuelta directamente (ya es un objeto)
          faseEfectiva = faseResuelta;
        }
      }
    } catch (error) {
      // Error al cargar/validar config: fail-open con log
      logWarn('progress_engine', 'Error cargando/validando niveles_energeticos', {
        nivel: nivelEfectivo,
        student_id: student.id,
        student_email: student.email,
        error: error.message
      }, true);
      // Usar fallback estructurado (SIEMPRE objeto)
      faseEfectiva = {
        id: 'sanacion',
        nombre: 'Sanación',
        reason: 'error_cargando_config'
      };
    }

    // 5. Construir motivo_debug (solo para logs, no para UI)
    const motivoDebug = overridesAplicados.length > 0
      ? `nivel_base=${nivelBase}, override=${overridesAplicados[0].type}+${overridesAplicados[0].value}`
      : `nivel_base=${nivelBase} (sin overrides)`;

    // 6. Construir resultado
    const result = {
      dias_activos: diasActivos,
      dias_pausados: diasPausados,
      nivel_base: nivelBase,
      overrides_aplicados: overridesAplicados.map(o => ({
        id: o.id,
        type: o.type,
        value: o.value,
        reason: o.reason,
        created_at: o.created_at,
        created_by: o.created_by
      })),
      nivel_efectivo: nivelEfectivo,
      fase_efectiva: faseEfectiva,
      nombre_nivel: nombreNivel,
      motivo_debug: motivoDebug
    };

    // Log INFO en dev/beta para trazabilidad (sin saturar producción)
    const envName = env.APP_ENV || process.env.APP_ENV || 'prod';
    if (envName === 'dev' || envName === 'beta') {
      logInfo('progress_engine', 'Progreso calculado', {
        student_id: student.id,
        student_email: student.email,
        nivel_base: nivelBase,
        nivel_efectivo: nivelEfectivo,
        fase_efectiva: faseEfectiva,
        dias_activos: diasActivos,
        tiene_overrides: overridesAplicados.length > 0
      }, true); // Force log en dev/beta
    }

    return result;

  } catch (error) {
    // CRÍTICO: Capturar TODOS los errores y devolver fallback seguro
    logWarn('progress_engine', 'Error no manejado en computeProgress', {
      student_id: student?.id,
      student_email: student?.email,
      error: error.message,
      stack: error.stack
    }, true);
    
    return getFallbackProgress();
  }
}

/**
 * Retorna valores de fallback seguros cuando falla el cálculo
 * 
 * @returns {Object} Objeto de progreso con valores por defecto
 */
function getFallbackProgress() {
  return {
    dias_activos: 0,
    dias_pausados: 0,
    nivel_base: 1,
    overrides_aplicados: [],
    nivel_efectivo: 1,
    fase_efectiva: {
      id: 'sanacion',
      nombre: 'Sanación',
      reason: 'fallback_error_calculo'
    },
    nombre_nivel: 'Sanación - Inicial',
    motivo_debug: 'fallback: error en cálculo'
  };
}

