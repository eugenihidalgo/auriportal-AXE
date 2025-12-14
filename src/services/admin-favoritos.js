// src/services/admin-favoritos.js
// Servicio para gestión de favoritos del admin

import { query } from '../../database/pg.js';

/**
 * Lista todos los favoritos activos ordenados
 * @returns {Promise<Array>}
 */
export async function listarFavoritos() {
  try {
    const result = await query(`
      SELECT * FROM admin_favoritos
      WHERE activo = true
      ORDER BY orden ASC, nombre ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error listando favoritos:', error);
    return [];
  }
}

/**
 * Obtiene un favorito por ID
 * @param {number} id 
 * @returns {Promise<Object|null>}
 */
export async function getFavorito(id) {
  try {
    const result = await query('SELECT * FROM admin_favoritos WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error obteniendo favorito:', error);
    return null;
  }
}

/**
 * Crea un nuevo favorito
 * @param {Object} datos 
 * @returns {Promise<number>}
 */
export async function crearFavorito(datos) {
  try {
    const { ruta, nombre, icono, orden } = datos;
    const result = await query(`
      INSERT INTO admin_favoritos (ruta, nombre, icono, orden)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [ruta, nombre, icono || '⭐', orden || 0]);
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creando favorito:', error);
    throw error;
  }
}

/**
 * Actualiza un favorito
 * @param {number} id 
 * @param {Object} datos 
 * @returns {Promise<boolean>}
 */
export async function actualizarFavorito(id, datos) {
  try {
    const { ruta, nombre, icono, orden, activo } = datos;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (ruta !== undefined) {
      updates.push(`ruta = $${paramIndex++}`);
      params.push(ruta);
    }
    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      params.push(nombre);
    }
    if (icono !== undefined) {
      updates.push(`icono = $${paramIndex++}`);
      params.push(icono);
    }
    if (orden !== undefined) {
      updates.push(`orden = $${paramIndex++}`);
      params.push(orden);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      params.push(activo);
    }

    if (updates.length === 0) return true;

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    await query(`
      UPDATE admin_favoritos
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);

    return true;
  } catch (error) {
    console.error('Error actualizando favorito:', error);
    return false;
  }
}

/**
 * Elimina un favorito
 * @param {number} id 
 * @returns {Promise<boolean>}
 */
export async function eliminarFavorito(id) {
  try {
    await query('DELETE FROM admin_favoritos WHERE id = $1', [id]);
    return true;
  } catch (error) {
    console.error('Error eliminando favorito:', error);
    return false;
  }
}

/**
 * Obtiene todas las rutas disponibles para configurar como favoritos
 * @returns {Array}
 */
export function getRutasDisponibles() {
  return [
    // ============================================
    // PRINCIPALES
    // ============================================
    { ruta: '/admin/dashboard', nombre: 'Dashboard', icono: '📊' },
    { ruta: '/admin/alumnos', nombre: 'Alumnos', icono: '🧍' },
    { ruta: '/admin/practicas', nombre: 'Prácticas', icono: '🔥' },
    { ruta: '/admin/frases', nombre: 'Frases', icono: '💬' },
    { ruta: '/admin/respuestas', nombre: 'Feedbacks de los alumnos', icono: '📋' },
    { ruta: '/admin/analytics', nombre: 'Analytics', icono: '📊' },
    { ruta: '/admin/analytics-resumen', nombre: 'Analytics Resumen', icono: '📈' },
    
    // ============================================
    // ALUMNOS - SUBSECCIONES
    // ============================================
    // Nota: Las rutas con :id se acceden desde /admin/alumnos, pero se pueden añadir como favoritos genéricos
    
    // ============================================
    // MODO MAESTRO
    // ============================================
    { ruta: '/admin/modo-maestro', nombre: 'Modo Master (Legacy)', icono: '🧙' },
    { ruta: '/admin/comunicacion-directa', nombre: 'Canalizaciones y comentarios', icono: '💬' },
    { ruta: '/admin/comunicacion-directa/enviar', nombre: 'Enviar Mensaje', icono: '📤' },
    { ruta: '/admin/comunicacion-directa/enviar-multiple', nombre: 'Enviar Mensajes Múltiples', icono: '📨' },
    { ruta: '/admin/niveles-energeticos', nombre: 'Niveles Energéticos', icono: '⚡' },
    
    // ============================================
    // MASTER - SUBSECCIONES
    // ============================================
    // Nota: Las rutas /admin/master/:id/* requieren un ID de alumno
    // Se incluyen las rutas base que llevan a la vista master
    
    // ============================================
    // ANATOMÍA Y ENERGÍA
    // ============================================
    { ruta: '/admin/anatomia-energetica', nombre: 'Anatomía Energética', icono: '⚡' },
    { ruta: '/admin/registros-karmicos', nombre: 'Registros y Karmas', icono: '🔮' },
    { ruta: '/admin/energias-indeseables', nombre: 'Energías Indeseables', icono: '⚠️' },
    { ruta: '/admin/progreso-energetico', nombre: 'Progreso Energético', icono: '📈' },
    { ruta: '/admin/progreso-gamificado', nombre: 'Progreso Gamificado', icono: '🎮' },
    
    // ============================================
    // TRANSMUTACIONES
    // ============================================
    { ruta: '/admin/transmutaciones-energeticas', nombre: 'Transmutaciones Energéticas', icono: '🌀' },
    { ruta: '/admin/transmutaciones/personas', nombre: 'Transmutaciones - Personas', icono: '👥' },
    { ruta: '/admin/transmutaciones/lugares', nombre: 'Transmutaciones - Lugares', icono: '📍' },
    { ruta: '/admin/transmutaciones/proyectos', nombre: 'Transmutaciones - Proyectos', icono: '🚀' },
    
    // ============================================
    // TÉCNICAS Y PRÁCTICAS
    // ============================================
    { ruta: '/admin/tecnicas-limpieza', nombre: 'Técnicas de Limpieza', icono: '🧹' },
    { ruta: '/admin/preparaciones-practica', nombre: 'Preparaciones para la Práctica', icono: '🔮' },
    { ruta: '/admin/tecnicas-post-practica', nombre: 'Técnicas Post-práctica', icono: '✨' },
    { ruta: '/admin/decretos', nombre: 'Biblioteca de Decretos', icono: '📜' },
    { ruta: '/admin/recursos-tecnicos', nombre: 'Recursos Técnicos', icono: '🎵' },
    { ruta: '/admin/limpieza-hogar', nombre: 'Limpieza de Hogar', icono: '🏠' },
    { ruta: '/admin/limpieza/individual', nombre: 'Limpieza Individual (API)', icono: '🧹' },
    { ruta: '/admin/limpieza/global', nombre: 'Limpieza Global (API)', icono: '🌍' },
    { ruta: '/admin/limpieza/estado', nombre: 'Estado de Limpieza (API)', icono: '📊' },
    
    // ============================================
    // PEDAGOGÍA
    // ============================================
    { ruta: '/admin/recorrido-pedagogico', nombre: 'Recorrido Pedagógico', icono: '📚' },
    { ruta: '/admin/configuracion-aspectos', nombre: 'Configuración Aspectos', icono: '⚙️' },
    { ruta: '/admin/configuracion-racha', nombre: 'Configuración Racha', icono: '🔥' },
    { ruta: '/admin/configuracion-caminos', nombre: 'Configuración Caminos', icono: '🛤️' },
    { ruta: '/admin/configuracion-workflow', nombre: 'Configuración Workflow', icono: '🔄' },
    
    // ============================================
    // GAMIFICACIÓN
    // ============================================
    { ruta: '/admin/misiones', nombre: 'Misiones', icono: '🎯' },
    { ruta: '/admin/logros', nombre: 'Logros', icono: '🏆' },
    { ruta: '/admin/auribosses', nombre: 'Auribosses', icono: '👹' },
    { ruta: '/admin/arquetipos', nombre: 'Arquetipos', icono: '🎭' },
    { ruta: '/admin/avatar', nombre: 'Avatar Aurelín', icono: '👤' },
    { ruta: '/admin/historia', nombre: 'Modo Historia', icono: '📖' },
    { ruta: '/admin/aurimapa', nombre: 'Aurimapa', icono: '🗺️' },
    { ruta: '/admin/auriquest', nombre: 'AuriQuest', icono: '❓' },
    { ruta: '/admin/tokens', nombre: 'Token AURI', icono: '🪙' },
    { ruta: '/admin/skilltree', nombre: 'Skill Tree', icono: '🌳' },
    { ruta: '/admin/sellos', nombre: 'Sellos de Ascensión', icono: '🔖' },
    
    // ============================================
    // MÓDULOS FUNCIONALES
    // ============================================
    { ruta: '/admin/informes', nombre: 'Informes Semanales', icono: '📄' },
    { ruta: '/admin/sorpresas', nombre: 'Prácticas Sorpresa', icono: '🎁' },
    { ruta: '/admin/circulos', nombre: 'Círculos Auri', icono: '⭕' },
    { ruta: '/admin/diario', nombre: 'Diario de Aurelín', icono: '📔' },
    { ruta: '/admin/horarios', nombre: 'Prácticas por Horario', icono: '⏰' },
    { ruta: '/admin/ideas', nombre: 'Laboratorio de Ideas', icono: '💡' },
    { ruta: '/admin/tarot', nombre: 'Tarot Energético', icono: '🔮' },
    { ruta: '/admin/timeline', nombre: 'Timeline 30 Días', icono: '📅' },
    { ruta: '/admin/altar', nombre: 'Altar Personal', icono: '🕯️' },
    { ruta: '/admin/compasion', nombre: 'Puntos de Compasión', icono: '💚' },
    { ruta: '/admin/notificaciones', nombre: 'Preferencias Notificaciones', icono: '🔔' },
    { ruta: '/admin/maestro', nombre: 'Maestro Interior', icono: '🧘' },
    { ruta: '/admin/cumpleaños', nombre: 'Cumpleaños', icono: '🎂' },
    { ruta: '/admin/cumpleanos', nombre: 'Cumpleaños (alternativo)', icono: '🎂' },
    { ruta: '/admin/astral', nombre: 'Carta Astral', icono: '⭐' },
    { ruta: '/admin/disenohumano', nombre: 'Diseño Humano', icono: '🧬' },
    { ruta: '/admin/sinergia', nombre: 'Sinergia', icono: '🤝' },
    { ruta: '/admin/amistades', nombre: 'Amistades', icono: '👫' },
    { ruta: '/admin/auriclock', nombre: 'AuriClock', icono: '🕐' },
    { ruta: '/admin/mensajes-especiales', nombre: 'Mensajes Especiales', icono: '💌' },
    { ruta: '/admin/eventos-globales', nombre: 'Eventos Globales', icono: '🌍' },
    { ruta: '/admin/emocional-anual', nombre: 'Emocional Anual', icono: '💫' },
    
    // ============================================
    // HERRAMIENTAS Y CONFIGURACIÓN
    // ============================================
    { ruta: '/admin/modulos', nombre: 'Gestión de Módulos', icono: '🧩' },
    { ruta: '/admin/reflexiones', nombre: 'Reflexiones', icono: '💭' },
    { ruta: '/admin/auricalendar', nombre: 'Auricalendar', icono: '📆' },
    { ruta: '/admin/aurigraph', nombre: 'Aurigraph', icono: '📊' },
    { ruta: '/admin/audios', nombre: 'Audios', icono: '🎧' },
    { ruta: '/admin/logs', nombre: 'Logs', icono: '📝' },
    { ruta: '/admin/editor-pantallas', nombre: 'Editor de Pantallas', icono: '🖼️' },
    { ruta: '/admin/iad-alumnos', nombre: 'I+D de los alumnos', icono: '🔬' },
    { ruta: '/admin/id-alumnos', nombre: 'I+D de los alumnos (alternativo)', icono: '🔬' },
    { ruta: '/admin/ajustes-alumno', nombre: 'Ajustes Alumno', icono: '⚙️' },
    { ruta: '/admin/configuracion', nombre: 'Configuración', icono: '⚙️' },
    { ruta: '/admin/configuracion-favoritos', nombre: 'Configuración de Favoritos', icono: '⭐' },
    { ruta: '/admin/email', nombre: 'Enviar Email', icono: '📧' },
    { ruta: '/admin/crear-tablas-nuevas', nombre: 'Crear Tablas Nuevas', icono: '🗄️' },
    
    // ============================================
    // CREACIÓN
    // ============================================
    { ruta: '/admin/creacion-objetivos', nombre: 'Objetivos de Creación', icono: '🎯' },
    { ruta: '/admin/creacion-version-futura', nombre: 'Versión Futura', icono: '🔮' },
    { ruta: '/admin/creacion-problemas', nombre: 'Problemas Iniciales', icono: '❓' },
    
    // ============================================
    // RUTAS LEGACY Y REDIRECCIONES
    // ============================================
    { ruta: '/admin/aspectos-energeticos', nombre: 'Aspectos Energéticos (Legacy)', icono: '⚡' },
  ];
}














