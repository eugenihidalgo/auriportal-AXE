// src/services/aurigraph.js
// Generador de gráfico radar (Aurigraph) para el estado del alumno

import { query } from '../../database/pg.js';

/**
 * Calcula las métricas para el Aurigraph de un alumno
 * @param {number} alumno_id 
 * @returns {Object} Métricas normalizadas (0-10)
 */
export async function calcularMetricasAurigraph(alumno_id) {
  try {
    // Obtener datos básicos del alumno
    const alumnoResult = await query(
      `SELECT nivel_actual, streak, energia_emocional FROM alumnos WHERE id = $1`,
      [alumno_id]
    );

    if (alumnoResult.rows.length === 0) {
      throw new Error('Alumno no encontrado');
    }

    const alumno = alumnoResult.rows[0];

    // 1. Nivel (ya normalizado 0-10)
    const nivel = parseInt(alumno.nivel_actual) || 0;

    // 2. Racha (normalizar a 0-10, máximo 30 días = 10)
    const racha = Math.min((parseInt(alumno.streak) || 0) / 3, 10);

    // 3. Energía emocional (ya normalizado 0-10)
    const energia = parseInt(alumno.energia_emocional) || 5;

    // 4. Intensidad de práctica (prácticas por semana, máximo 7 = 10)
    const practicasSemanales = await query(`
      SELECT COUNT(*) as total
      FROM practicas
      WHERE alumno_id = $1
        AND fecha >= NOW() - INTERVAL '7 days'
    `, [alumno_id]);
    const intensidad = Math.min((parseInt(practicasSemanales.rows[0].total) || 0) / 0.7, 10);

    // 5. Diversidad de aspectos (número de aspectos distintos practicados / total aspectos * 10)
    const diversidadResult = await query(`
      SELECT 
        COUNT(DISTINCT aspecto_id) as practicados,
        (SELECT COUNT(*) FROM aspectos_practica WHERE activo = true) as total_aspectos
      FROM practicas
      WHERE alumno_id = $1
        AND aspecto_id IS NOT NULL
        AND fecha >= NOW() - INTERVAL '30 days'
    `, [alumno_id]);
    
    const diversidadData = diversidadResult.rows[0];
    const practicados = parseInt(diversidadData.practicados) || 0;
    const totalAspectos = parseInt(diversidadData.total_aspectos) || 1;
    const diversidad = (practicados / totalAspectos) * 10;

    return {
      nivel: Math.round(nivel * 10) / 10,
      racha: Math.round(racha * 10) / 10,
      energia: Math.round(energia * 10) / 10,
      intensidad: Math.round(intensidad * 10) / 10,
      diversidad: Math.round(diversidad * 10) / 10
    };
  } catch (error) {
    console.error('❌ Error en calcularMetricasAurigraph:', error);
    throw error;
  }
}

/**
 * Genera un SVG del Aurigraph
 * @param {Object} metricas - Métricas del alumno
 * @param {number} size - Tamaño del gráfico (default 300)
 * @returns {string} SVG como string
 */
export function generarAurigraphSVG(metricas, size = 300) {
  const center = size / 2;
  const maxRadius = size * 0.4;
  
  const dimensiones = [
    { key: 'nivel', label: 'Nivel', angle: 0 },
    { key: 'racha', label: 'Racha', angle: 72 },
    { key: 'energia', label: 'Energía', angle: 144 },
    { key: 'intensidad', label: 'Intensidad', angle: 216 },
    { key: 'diversidad', label: 'Diversidad', angle: 288 }
  ];

  // Calcular puntos del polígono
  const puntos = dimensiones.map(dim => {
    const valor = metricas[dim.key] || 0;
    const radio = (valor / 10) * maxRadius;
    const angleRad = (dim.angle - 90) * Math.PI / 180; // -90 para empezar arriba
    const x = center + radio * Math.cos(angleRad);
    const y = center + radio * Math.sin(angleRad);
    return { x, y, valor, label: dim.label, angle: dim.angle };
  });

  const puntosStr = puntos.map(p => `${p.x},${p.y}`).join(' ');

  // Generar círculos concéntricos (guías)
  const circulos = [2, 4, 6, 8, 10].map(nivel => {
    const radio = (nivel / 10) * maxRadius;
    return `<circle cx="${center}" cy="${center}" r="${radio}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`;
  }).join('');

  // Generar líneas radiales
  const lineas = dimensiones.map(dim => {
    const angleRad = (dim.angle - 90) * Math.PI / 180;
    const x = center + maxRadius * Math.cos(angleRad);
    const y = center + maxRadius * Math.sin(angleRad);
    return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`;
  }).join('');

  // Generar etiquetas
  const etiquetas = dimensiones.map(dim => {
    const angleRad = (dim.angle - 90) * Math.PI / 180;
    const radio = maxRadius + 25;
    const x = center + radio * Math.cos(angleRad);
    const y = center + radio * Math.sin(angleRad);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#374151" font-weight="600">${dim.label}</text>`;
  }).join('');

  // Generar valores en los puntos
  const valores = puntos.map(p => {
    return `
      <circle cx="${p.x}" cy="${p.y}" r="4" fill="#4f46e5"/>
      <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="10" fill="#4f46e5" font-weight="bold">${p.valor.toFixed(1)}</text>
    `;
  }).join('');

  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- Círculos concéntricos -->
      ${circulos}
      
      <!-- Líneas radiales -->
      ${lineas}
      
      <!-- Polígono de datos -->
      <polygon points="${puntosStr}" fill="#4f46e5" fill-opacity="0.3" stroke="#4f46e5" stroke-width="2"/>
      
      <!-- Puntos y valores -->
      ${valores}
      
      <!-- Etiquetas -->
      ${etiquetas}
    </svg>
  `;
}

/**
 * Genera un Aurigraph completo para un alumno
 * @param {number} alumno_id 
 * @param {number} size - Tamaño del gráfico
 * @returns {Object} { metricas, svg }
 */
export async function generarAurigraph(alumno_id, size = 300) {
  const metricas = await calcularMetricasAurigraph(alumno_id);
  const svg = generarAurigraphSVG(metricas, size);
  
  return {
    metricas,
    svg
  };
}

