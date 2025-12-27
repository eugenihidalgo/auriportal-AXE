// src/modules/dias-activos-simulator-v4.js
// Simulador de cálculo de días activos para AuriPortal V4
//
// PRINCIPIO: Ejecuta la lógica de cálculo de días activos SIN escribir en PostgreSQL
// Permite comparar días activos actuales vs días activos simulados
//
// GARANTÍAS:
// - NO ejecuta UPDATE/INSERT/DELETE en PostgreSQL
// - SOLO llama a funciones de lectura (getDiasActivos, calcularDiasPausados, getPausaActiva, etc.)
// - SOLO calcula y compara resultados

import { getDiasActivos, findStudentById } from './student-v4.js';
import { calcularDiasPausados, calcularDiasPausadosHastaFecha, getPausaActiva } from './pausa-v4.js';
import { getDefaultStudentRepo } from '../infra/repos/student-repo-pg.js';

/**
 * Simula el cálculo de días activos de un alumno
 * 
 * Calcula los días activos actuales y los días activos simulados
 * SIN modificar la base de datos.
 * 
 * @param {Object} options - Opciones de simulación
 * @param {Object} options.student - Objeto estudiante normalizado
 * @param {string} [options.fechaHasta] - Fecha límite para simulación (YYYY-MM-DD, default: hoy)
 * @param {string} [options.modo] - Modo de simulación (por ahora solo 'actual', futuro: 'variante')
 * @returns {Promise<Object>} Resultado de la simulación con formato:
 *                            {
 *                              dias_activos_actual: <dias_activos_actual>,
 *                              dias_activos_simulado: <dias_activos_simulado>,
 *                              desglose: {
 *                                dias_total_desde_inscripcion: <dias>,
 *                                dias_pausados_total: <dias>,
 *                                existe_pausa_activa: <boolean>,
 *                                fecha_limite_usada: <fecha>
 *                              }
 *                            }
 */
export async function simulateDiasActivos({ student, fechaHasta, modo = 'actual' }) {
  if (!student || !student.id) {
    throw new Error('Student debe tener un ID válido');
  }
  
  // Obtener alumno completo desde repositorio (lectura)
  // Usamos el repositorio directamente para obtener datos completos
  const repo = getDefaultStudentRepo();
  const alumno = await repo.getById(student.id);
  
  if (!alumno) {
    throw new Error(`Alumno ${student.id} no encontrado`);
  }
  
  // Fecha límite para simulación (default: hoy)
  const fechaLimite = fechaHasta ? new Date(fechaHasta + 'T00:00:00Z') : new Date();
  const fechaInscripcion = new Date(alumno.fecha_inscripcion);
  
  // Obtener días activos actuales (usando función real de lectura)
  const diasActivosActuales = await getDiasActivos(student.id);
  
  // Calcular días activos simulados
  let diasActivosSimulados;
  let diasTotalesDesdeInscripcion;
  let diasPausadosTotal;
  let existePausaActiva = false;
  let pausaActiva = null;
  
  // Verificar si hay pausa activa (lectura)
  pausaActiva = await getPausaActiva(student.id);
  existePausaActiva = pausaActiva !== null;
  
  // Si está pausado, calcular días hasta el inicio de la pausa actual
  if (alumno.estado_suscripcion === 'pausada' && pausaActiva) {
    // Hay una pausa activa: calcular días hasta el inicio de esa pausa
    const fechaInicioPausa = new Date(pausaActiva.inicio);
    diasTotalesDesdeInscripcion = Math.floor((fechaInicioPausa - fechaInscripcion) / (1000 * 60 * 60 * 24));
    
    // Calcular días pausados hasta el inicio de la pausa actual (excluyendo la pausa actual)
    const diasPausadosAntes = await calcularDiasPausadosHastaFecha(student.id, fechaInicioPausa);
    diasPausadosTotal = diasPausadosAntes;
    
    diasActivosSimulados = Math.max(0, diasTotalesDesdeInscripcion - diasPausadosAntes);
  } else if (alumno.estado_suscripcion === 'pausada' && !pausaActiva) {
    // No hay registro de pausa activa en la tabla, pero estado_suscripcion = 'pausada'
    // Usar fecha_reactivacion si existe, o fecha_inscripcion como fallback
    const fechaReferencia = alumno.fecha_reactivacion 
      ? new Date(alumno.fecha_reactivacion) 
      : fechaInscripcion;
    
    diasTotalesDesdeInscripcion = Math.floor((fechaReferencia - fechaInscripcion) / (1000 * 60 * 60 * 24));
    const diasPausadosHastaReferencia = await calcularDiasPausadosHastaFecha(student.id, fechaReferencia);
    diasPausadosTotal = diasPausadosHastaReferencia;
    
    diasActivosSimulados = Math.max(0, diasTotalesDesdeInscripcion - diasPausadosHastaReferencia);
  } else {
    // Si está activo, calcular normalmente (días totales - días pausados)
    // Si se proporciona fechaHasta, usar esa fecha; si no, usar hoy
    const fechaCalculo = fechaHasta ? new Date(fechaHasta + 'T00:00:00Z') : new Date();
    diasTotalesDesdeInscripcion = Math.floor((fechaCalculo - fechaInscripcion) / (1000 * 60 * 60 * 24));
    
    // Si hay fecha límite, calcular días pausados hasta esa fecha
    if (fechaHasta) {
      diasPausadosTotal = await calcularDiasPausadosHastaFecha(student.id, fechaCalculo);
    } else {
      diasPausadosTotal = await calcularDiasPausados(student.id);
    }
    
    diasActivosSimulados = Math.max(0, diasTotalesDesdeInscripcion - diasPausadosTotal);
  }
  
  // Preparar desglose
  const desglose = {
    dias_total_desde_inscripcion: diasTotalesDesdeInscripcion,
    dias_pausados_total: diasPausadosTotal,
    existe_pausa_activa: existePausaActiva,
    fecha_limite_usada: fechaHasta || new Date().toISOString().substring(0, 10),
    fecha_inscripcion: alumno.fecha_inscripcion ? new Date(alumno.fecha_inscripcion).toISOString().substring(0, 10) : null,
    estado_suscripcion: alumno.estado_suscripcion || 'activa',
    pausa_activa: pausaActiva ? {
      id: pausaActiva.id,
      inicio: pausaActiva.inicio ? (pausaActiva.inicio instanceof Date ? pausaActiva.inicio.toISOString().substring(0, 10) : pausaActiva.inicio) : null,
      fin: pausaActiva.fin ? (pausaActiva.fin instanceof Date ? pausaActiva.fin.toISOString().substring(0, 10) : pausaActiva.fin) : null
    } : null
  };
  
  return {
    dias_activos_actual: diasActivosActuales,
    dias_activos_simulado: diasActivosSimulados,
    diff: diasActivosSimulados - diasActivosActuales,
    desglose
  };
}























