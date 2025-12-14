// src/services/practicas-service.js
// Servicio para el nuevo sistema de prácticas (Fase 2)

import { obtenerPreparacionesPorNivel, obtenerPreparacion } from './preparaciones-practica.js';
import { obtenerTecnicasPostPracticaPorNivel, obtenerTecnicaPostPractica } from './tecnicas-post-practica.js';
import { obtenerDecreto as obtenerDecretoService } from './decretos-service.js';

/**
 * Obtiene las preparaciones para una práctica según el nivel del alumno (para pantalla de selección)
 * @param {number} practicaId - ID de la práctica (no usado aún, para futuro)
 * @param {number} nivelAlumno - Nivel del alumno
 * @returns {Promise<Array>} Lista de preparaciones con información básica
 */
export async function obtenerPreparacionesParaPantalla(practicaId, nivelAlumno) {
  try {
    const preparaciones = await obtenerPreparacionesPorNivel(nivelAlumno);
    
    // Retornar solo información esencial (sin contenido_html, sin vídeos cargados)
    return preparaciones.map(prep => ({
      id: prep.id,
      nombre: prep.nombre,
      tipo: prep.tipo || 'consigna',
      posicion: prep.posicion || 'inicio',
      orden: prep.orden || 0,
      obligatoria_global: prep.obligatoria_global || false,
      obligatoria_por_nivel: prep.obligatoria_por_nivel || {},
      nivel: prep.nivel
    }));
  } catch (error) {
    console.error('Error obteniendo preparaciones para pantalla:', error);
    return [];
  }
}

/**
 * Obtiene las técnicas post-práctica para una práctica según el nivel del alumno (para pantalla de selección)
 * @param {number} practicaId - ID de la práctica (no usado aún, para futuro)
 * @param {number} nivelAlumno - Nivel del alumno
 * @returns {Promise<Array>} Lista de técnicas post-práctica con información básica
 */
export async function obtenerPostPracticasParaPantalla(practicaId, nivelAlumno) {
  try {
    const tecnicas = await obtenerTecnicasPostPracticaPorNivel(nivelAlumno);
    
    // Retornar solo información esencial (sin contenido_html, sin vídeos cargados)
    return tecnicas.map(tec => ({
      id: tec.id,
      nombre: tec.nombre,
      tipo: tec.tipo || 'consigna',
      posicion: tec.posicion || 'inicio',
      orden: tec.orden || 0,
      obligatoria_global: tec.obligatoria_global || false,
      obligatoria_por_nivel: tec.obligatoria_por_nivel || {},
      nivel: tec.nivel
    }));
  } catch (error) {
    console.error('Error obteniendo post-prácticas para pantalla:', error);
    return [];
  }
}

/**
 * Obtiene datos completos de preparaciones según IDs seleccionados
 * @param {Array<number>} idsSeleccionados - Array de IDs de preparaciones
 * @returns {Promise<Array>} Lista de preparaciones con todos los datos
 */
export async function obtenerDatosCompletosDePreparaciones(idsSeleccionados) {
  if (!idsSeleccionados || idsSeleccionados.length === 0) {
    return [];
  }
  
  try {
    const preparaciones = await Promise.all(
      idsSeleccionados.map(id => obtenerPreparacion(id))
    );
    
    // Filtrar nulls y ordenar: primero inicio, luego final; dentro de cada grupo por orden
    return preparaciones
      .filter(prep => prep !== null)
      .sort((a, b) => {
        // Primero por posición (inicio antes que final)
        const posA = (a.posicion || 'inicio') === 'inicio' ? 0 : 1;
        const posB = (b.posicion || 'inicio') === 'inicio' ? 0 : 1;
        if (posA !== posB) return posA - posB;
        
        // Luego por orden
        return (a.orden || 0) - (b.orden || 0);
      });
  } catch (error) {
    console.error('Error obteniendo datos completos de preparaciones:', error);
    return [];
  }
}

/**
 * Obtiene datos completos de técnicas post-práctica según IDs seleccionados
 * @param {Array<number>} idsSeleccionados - Array de IDs de técnicas post-práctica
 * @returns {Promise<Array>} Lista de técnicas con todos los datos
 */
export async function obtenerDatosCompletosDePost(idsSeleccionados) {
  if (!idsSeleccionados || idsSeleccionados.length === 0) {
    return [];
  }
  
  try {
    const tecnicas = await Promise.all(
      idsSeleccionados.map(id => obtenerTecnicaPostPractica(id))
    );
    
    // Filtrar nulls y ordenar: primero inicio, luego final; dentro de cada grupo por orden
    return tecnicas
      .filter(tec => tec !== null)
      .sort((a, b) => {
        // Primero por posición (inicio antes que final)
        const posA = (a.posicion || 'inicio') === 'inicio' ? 0 : 1;
        const posB = (b.posicion || 'inicio') === 'inicio' ? 0 : 1;
        if (posA !== posB) return posA - posB;
        
        // Luego por orden
        return (a.orden || 0) - (b.orden || 0);
      });
  } catch (error) {
    console.error('Error obteniendo datos completos de post-prácticas:', error);
    return [];
  }
}

/**
 * Obtiene un decreto por ID
 * @param {number} id - ID del decreto
 * @returns {Promise<Object|null>} Decreto o null
 */
export async function obtenerDecreto(id) {
  try {
    return await obtenerDecretoService(id);
  } catch (error) {
    console.error('Error obteniendo decreto:', error);
    return null;
  }
}

/**
 * Guarda el tema preferido del alumno
 * @param {number} alumnoId - ID del alumno
 * @param {string} tema - Tema preferido ('light', 'dark', 'system')
 * @returns {Promise<boolean>} true si se guardó correctamente
 */
export async function guardarTemaAlumno(alumnoId, tema) {
  // Lógica aún no implementada
  return true;
}

/**
 * Obtiene los decretos disponibles para una preparación según el nivel del alumno
 * @param {number} practicaId - ID de la práctica
 * @param {number} nivelAlumno - Nivel del alumno
 * @returns {Promise<Array>} Lista de decretos (vacía por ahora)
 */
export async function obtenerDecretosParaPreparacion(practicaId, nivelAlumno) {
  // Lógica aún no implementada
  return [];
}

/**
 * Obtiene IDs de preparaciones obligatorias válidas para un alumno
 * @param {number} practicaId - ID de la práctica
 * @param {number} nivelAlumno - Nivel del alumno
 * @returns {Promise<Array<number>>} Array de IDs de preparaciones obligatorias válidas
 */
export async function obtenerObligatoriasPreparaciones(practicaId, nivelAlumno) {
  try {
    const preparaciones = await obtenerPreparacionesPorNivel(nivelAlumno);
    const idsObligatorias = [];
    
    for (const prep of preparaciones) {
      // Verificar si es obligatoria global
      let esObligatoria = prep.obligatoria_global || false;
      
      // Verificar si es obligatoria por nivel
      if (!esObligatoria && prep.obligatoria_por_nivel) {
        try {
          const obligPorNivel = typeof prep.obligatoria_por_nivel === 'string' 
            ? JSON.parse(prep.obligatoria_por_nivel) 
            : prep.obligatoria_por_nivel;
          esObligatoria = obligPorNivel[nivelAlumno.toString()] === true;
        } catch (e) {
          // Si hay error parseando, usar obligatoria_global
        }
      }
      
      // Solo incluir si es obligatoria Y está activa Y cumple nivel
      if (esObligatoria && prep.activo && prep.nivel <= nivelAlumno && prep.id) {
        idsObligatorias.push(prep.id);
      }
    }
    
    return idsObligatorias;
  } catch (error) {
    console.error('Error obteniendo obligatorias de preparaciones:', error);
    return [];
  }
}

/**
 * Obtiene IDs de técnicas post-práctica obligatorias válidas para un alumno
 * @param {number} practicaId - ID de la práctica
 * @param {number} nivelAlumno - Nivel del alumno
 * @returns {Promise<Array<number>>} Array de IDs de técnicas obligatorias válidas
 */
export async function obtenerObligatoriasPostPracticas(practicaId, nivelAlumno) {
  try {
    const tecnicas = await obtenerTecnicasPostPracticaPorNivel(nivelAlumno);
    const idsObligatorias = [];
    
    for (const tec of tecnicas) {
      // Verificar si es obligatoria global
      let esObligatoria = tec.obligatoria_global || false;
      
      // Verificar si es obligatoria por nivel
      if (!esObligatoria && tec.obligatoria_por_nivel) {
        try {
          const obligPorNivel = typeof tec.obligatoria_por_nivel === 'string' 
            ? JSON.parse(tec.obligatoria_por_nivel) 
            : tec.obligatoria_por_nivel;
          esObligatoria = obligPorNivel[nivelAlumno.toString()] === true;
        } catch (e) {
          // Si hay error parseando, usar obligatoria_global
        }
      }
      
      // Solo incluir si es obligatoria Y está activa Y cumple nivel
      if (esObligatoria && tec.activo && tec.nivel <= nivelAlumno && tec.id) {
        idsObligatorias.push(tec.id);
      }
    }
    
    return idsObligatorias;
  } catch (error) {
    console.error('Error obteniendo obligatorias de post-prácticas:', error);
    return [];
  }
}

