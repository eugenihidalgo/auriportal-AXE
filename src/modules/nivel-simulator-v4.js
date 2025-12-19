// src/modules/nivel-simulator-v4.js
// Simulador de cálculo de nivel para AuriPortal V4
//
// PRINCIPIO: Ejecuta la lógica de cálculo de nivel SIN escribir en PostgreSQL
// Permite comparar nivel actual vs nivel simulado con diferentes parámetros
//
// GARANTÍAS:
// - NO llama a updateStudentNivel()
// - NO ejecuta UPDATE en PostgreSQL
// - SOLO calcula y compara resultados

import { getDiasActivos } from './student-v4.js';
import { 
  getNivelPorDiasActivos, 
  getNombreNivel, 
  getFasePorNivel,
  calcularNivelPorDiasActivos 
} from './nivel-v4.js';

/**
 * Simula el cambio de nivel de un alumno
 * 
 * Calcula el nivel actual y el nivel simulado (usando lógica alternativa o parámetros nuevos)
 * SIN modificar la base de datos.
 * 
 * @param {Object} student - Objeto estudiante normalizado
 * @param {Object} opciones - Opciones de simulación
 * @param {Function} [opciones.calcularNivelSimulado] - Función alternativa para calcular nivel simulado
 *                                                      Si no se proporciona, usa la lógica actual
 * @param {number} [opciones.diasActivosSimulados] - Días activos simulados (opcional)
 *                                                   Si se proporciona, usa estos días en lugar de calcularlos
 * @returns {Promise<Object>} Resultado de la simulación con formato:
 *                            {
 *                              actual: <nivel_actual>,
 *                              simulated: <nivel_simulado>,
 *                              diff: <diferencia>,
 *                              diff_description: <descripción>,
 *                              detalles: { ... }
 *                            }
 */
export async function simulateNivelCambio(student, opciones = {}) {
  if (!student || !student.id) {
    throw new Error('Student debe tener un ID válido');
  }
  
  // Obtener nivel actual desde PostgreSQL (fuente de verdad)
  const nivelActual = student.nivel_manual || student.nivel_actual || 1;
  const nombreActual = getNombreNivel(nivelActual);
  const faseActual = await getFasePorNivel(nivelActual);
  
  // Calcular días activos actuales
  const diasActivosActuales = await getDiasActivos(student.id);
  
  // Calcular nivel automático actual (basado en días activos reales)
  const nivelAutomaticoActual = await getNivelPorDiasActivos(student.id);
  
  // Determinar nivel simulado
  let nivelSimulado;
  let diasActivosSimulados;
  let nombreSimulado;
  let faseSimulada;
  
  if (opciones.calcularNivelSimulado) {
    // Usar función personalizada para calcular nivel simulado
    nivelSimulado = await opciones.calcularNivelSimulado(student, {
      diasActivos: diasActivosActuales,
      nivelActual: nivelActual,
      nivelAutomaticoActual: nivelAutomaticoActual
    });
    diasActivosSimulados = diasActivosActuales; // Usar días activos reales
  } else if (opciones.diasActivosSimulados !== undefined) {
    // Usar días activos simulados proporcionados
    diasActivosSimulados = opciones.diasActivosSimulados;
    // Calcular nivel basado en días activos simulados (función pura, síncrona)
    nivelSimulado = calcularNivelPorDiasActivosSimulados(diasActivosSimulados);
  } else {
    // Por defecto: usar la misma lógica actual (útil para validar que funciona)
    nivelSimulado = nivelAutomaticoActual;
    diasActivosSimulados = diasActivosActuales;
  }
  
  nombreSimulado = getNombreNivel(nivelSimulado);
  faseSimulada = await getFasePorNivel(nivelSimulado);
  
  // Calcular diferencia
  const diff = nivelSimulado - nivelActual;
  
  // Generar descripción de diferencia
  let diffDescription;
  if (diff === 0) {
    diffDescription = 'Sin cambios';
  } else if (diff > 0) {
    diffDescription = `Aumentaría de nivel ${nivelActual} a nivel ${nivelSimulado}`;
  } else {
    diffDescription = `Disminuiría de nivel ${nivelActual} a nivel ${nivelSimulado}`;
  }
  
  // Verificar si hay nivel manual (que se respetaría)
  const tieneNivelManual = !!student.nivel_manual;
  const nivelManual = student.nivel_manual || null;
  
  // Verificar estado de suscripción
  const estadoSuscripcion = student.estado_suscripcion || student.raw?.estado_suscripcion || 'activa';
  const suscripcionActiva = estadoSuscripcion === 'activa';
  
  // Determinar si se aplicaría el cambio (considerando reglas de negocio)
  let seAplicariaCambio = false;
  let razonNoAplicacion = null;
  
  if (!suscripcionActiva) {
    razonNoAplicacion = `Suscripción ${estadoSuscripcion} - nivel congelado`;
  } else if (tieneNivelManual && nivelManual !== nivelSimulado) {
    razonNoAplicacion = `Nivel manual establecido (${nivelManual}) - se respeta`;
  } else if (nivelSimulado <= nivelActual) {
    razonNoAplicacion = `Nivel simulado (${nivelSimulado}) no es mayor que actual (${nivelActual}) - solo se actualiza si aumenta`;
  } else {
    seAplicariaCambio = true;
  }
  
  return {
    actual: nivelActual,
    simulated: nivelSimulado,
    diff: diff,
    diff_description: diffDescription,
    detalles: {
      nivel_actual: nivelActual,
      nombre_actual: nombreActual,
      fase_actual: faseActual,
      nivel_simulado: nivelSimulado,
      nombre_simulado: nombreSimulado,
      fase_simulada: faseSimulada,
      dias_activos_actuales: diasActivosActuales,
      dias_activos_simulados: diasActivosSimulados,
      nivel_automatico_actual: nivelAutomaticoActual,
      tiene_nivel_manual: tieneNivelManual,
      nivel_manual: nivelManual,
      estado_suscripcion: estadoSuscripcion,
      suscripcion_activa: suscripcionActiva,
      se_aplicaria_cambio: seAplicariaCambio,
      razon_no_aplicacion: razonNoAplicacion
    }
  };
}

/**
 * Calcula el nivel basado en días activos simulados
 * 
 * SINGLE SOURCE OF TRUTH: Usa la función pura compartida de nivel-v4.js
 * para garantizar consistencia con la lógica real.
 * 
 * @param {number} diasActivos - Días activos simulados
 * @returns {number} Nivel calculado
 */
function calcularNivelPorDiasActivosSimulados(diasActivos) {
  // Usar función pura compartida (single source of truth)
  // Eliminada duplicación de thresholds - ahora usa la fuente de verdad única
  return calcularNivelPorDiasActivos(diasActivos);
}














