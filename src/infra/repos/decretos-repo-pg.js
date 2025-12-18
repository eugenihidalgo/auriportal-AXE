// src/infra/repos/decretos-repo-pg.js
// Implementación PostgreSQL del Repositorio de Decretos
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con decretos en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para decretos
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - Sanitiza HTML antes de guardar (fail-open: si falla, guarda como texto plano)
// - Soft delete normalizado usando deleted_at

import { query } from '../../../database/pg.js';

/**
 * Sanitiza HTML básico server-side
 * 
 * Allowlist de elementos permitidos:
 * - p, br, strong, em, u, h1, h2, h3, ul, ol, li, blockquote, a, span
 * - Atributos: href (en a), style limitado (en span)
 * 
 * Fail-open: Si la sanitización falla, retorna HTML escapado
 * 
 * @param {string} html - HTML a sanitizar
 * @returns {string} HTML sanitizado o escapado si falla
 */
function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    // Sanitización básica usando regex (para evitar dependencias pesadas)
    // En producción, considerar usar una librería como DOMPurify server-side
    
    // 1. Remover scripts y eventos inline
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');
    
    // 2. Permitir solo elementos en allowlist
    const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'span'];
    const allowedTagPattern = new RegExp(`</?(?:${allowedTags.join('|')})(?:\\s[^>]*)?>`, 'gi');
    
    // Extraer solo tags permitidos y su contenido
    const matches = html.match(/<[^>]+>/g) || [];
    const validTags = matches.filter(tag => {
      const tagName = tag.match(/<\/?(\w+)/)?.[1]?.toLowerCase();
      return allowedTags.includes(tagName);
    });
    
    // 3. Limpiar atributos en <a> (solo permitir href)
    sanitized = sanitized.replace(/<a\s+([^>]*)>/gi, (match, attrs) => {
      const hrefMatch = attrs.match(/href\s*=\s*["']([^"']*)["']/i);
      if (hrefMatch) {
        const href = hrefMatch[1];
        // Validar que href no sea javascript: o data:
        if (href.startsWith('javascript:') || href.startsWith('data:')) {
          return '<a>';
        }
        return `<a href="${href.replace(/"/g, '&quot;')}">`;
      }
      return '<a>';
    });
    
    // 4. Limpiar atributos en <span> (solo permitir style básico)
    sanitized = sanitized.replace(/<span\s+([^>]*)>/gi, (match, attrs) => {
      const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (styleMatch) {
        const style = styleMatch[1];
        // Permitir solo propiedades CSS seguras básicas
        const safeStyle = style.replace(/[^a-z0-9\s:;.,#-]/gi, '');
        return `<span style="${safeStyle.replace(/"/g, '&quot;')}">`;
      }
      return '<span>';
    });
    
    // 5. Remover atributos no permitidos en otros tags
    sanitized = sanitized.replace(/<(\w+)([^>]*)>/gi, (match, tagName, attrs) => {
      if (tagName.toLowerCase() === 'a' || tagName.toLowerCase() === 'span') {
        return match; // Ya procesados arriba
      }
      // Para otros tags, remover todos los atributos
      return `<${tagName}>`;
    });
    
    return sanitized;
  } catch (error) {
    console.warn('[DecretosRepo] Error sanitizando HTML, usando escape:', error.message);
    // Fail-open: escapar HTML si sanitización falla
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}

/**
 * Extrae texto plano de HTML
 * 
 * @param {string} html - HTML del que extraer texto
 * @returns {string} Texto plano
 */
function extractTextFromHTML(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  try {
    // Remover tags HTML y decodificar entidades básicas
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return '';
  }
}

/**
 * Repositorio de Decretos - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con decretos.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class DecretosRepoPg {
  /**
   * Lista todos los decretos
   * 
   * @param {Object} options - Opciones de filtrado
   * @param {boolean} options.includeDeleted - Si incluir eliminados (default: false)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Array>} Array de decretos
   */
  async list(options = {}, client = null) {
    const { includeDeleted = false } = options;
    const queryFn = client ? client.query.bind(client) : query;
    
    let sql = 'SELECT * FROM decretos';
    const params = [];
    
    if (!includeDeleted) {
      sql += ' WHERE deleted_at IS NULL';
    }
    
    sql += ' ORDER BY nivel_minimo ASC, orden ASC, nombre ASC';
    
    const result = await queryFn(sql, params);
    return result.rows || [];
  }

  /**
   * Obtiene un decreto por ID
   * 
   * @param {number} id - ID del decreto
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Decreto o null si no existe
   */
  async getById(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM decretos WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Crea un nuevo decreto
   * 
   * @param {Object} datos - Datos del decreto
   * @param {string} datos.nombre - Nombre del decreto
   * @param {string} datos.contenido_html - Contenido HTML (será sanitizado)
   * @param {string} [datos.content_delta] - Delta JSON del editor (opcional)
   * @param {string} [datos.content_text] - Texto plano (opcional, se extrae si no se proporciona)
   * @param {string} [datos.descripcion] - Descripción opcional
   * @param {number} [datos.nivel_minimo] - Nivel mínimo (default: 1)
   * @param {string} [datos.posicion] - Posición (default: 'inicio')
   * @param {boolean} [datos.obligatoria_global] - Obligatoria global (default: false)
   * @param {Object} [datos.obligatoria_por_nivel] - Obligatoriedad por nivel (default: {})
   * @param {number} [datos.orden] - Orden (default: 0)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object>} Decreto creado
   */
  async create(datos, client = null) {
    const {
      nombre,
      contenido_html,
      content_delta = null,
      content_text = null,
      descripcion = null,
      nivel_minimo = 1,
      posicion = 'inicio',
      obligatoria_global = false,
      obligatoria_por_nivel = {},
      orden = 0
    } = datos;
    
    if (!nombre || !contenido_html) {
      throw new Error('Nombre y contenido_html son obligatorios');
    }
    
    // Sanitizar HTML
    const htmlSanitizado = sanitizeHTML(contenido_html);
    
    // Extraer texto si no se proporciona
    const textoExtraido = content_text || extractTextFromHTML(htmlSanitizado);
    
    // Convertir obligatoria_por_nivel a JSONB si es objeto
    const obligatoriaPorNivelJson = typeof obligatoria_por_nivel === 'string'
      ? obligatoria_por_nivel
      : JSON.stringify(obligatoria_por_nivel || {});
    
    // Convertir content_delta a JSONB si es objeto
    const contentDeltaJson = content_delta
      ? (typeof content_delta === 'string' ? content_delta : JSON.stringify(content_delta))
      : null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(`
      INSERT INTO decretos (
        nombre, 
        contenido_html, 
        content_delta, 
        content_text, 
        descripcion,
        nivel_minimo, 
        posicion, 
        obligatoria_global, 
        obligatoria_por_nivel, 
        orden,
        activo,
        created_at, 
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `, [
      nombre,
      htmlSanitizado,
      contentDeltaJson,
      textoExtraido,
      descripcion,
      nivel_minimo,
      posicion,
      obligatoria_global,
      obligatoriaPorNivelJson,
      orden,
      true // activo = true por defecto
    ]);
    
    return result.rows[0];
  }

  /**
   * Actualiza un decreto existente
   * 
   * @param {number} id - ID del decreto
   * @param {Object} patch - Campos a actualizar (parcial)
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Decreto actualizado o null si no existe
   */
  async update(id, patch, client = null) {
    if (!id) return null;
    
    const campos = [];
    const valores = [];
    let paramIndex = 1;
    
    // Construir SET dinámico
    if (patch.nombre !== undefined) {
      campos.push(`nombre = $${paramIndex++}`);
      valores.push(patch.nombre);
    }
    
    if (patch.contenido_html !== undefined) {
      // Sanitizar HTML antes de guardar
      const htmlSanitizado = sanitizeHTML(patch.contenido_html);
      campos.push(`contenido_html = $${paramIndex++}`);
      valores.push(htmlSanitizado);
      
      // Actualizar content_text si no se proporciona explícitamente
      if (patch.content_text === undefined) {
        const textoExtraido = extractTextFromHTML(htmlSanitizado);
        campos.push(`content_text = $${paramIndex++}`);
        valores.push(textoExtraido);
      }
    }
    
    if (patch.content_delta !== undefined) {
      const contentDeltaJson = patch.content_delta
        ? (typeof patch.content_delta === 'string' ? patch.content_delta : JSON.stringify(patch.content_delta))
        : null;
      campos.push(`content_delta = $${paramIndex++}`);
      valores.push(contentDeltaJson);
    }
    
    if (patch.content_text !== undefined) {
      campos.push(`content_text = $${paramIndex++}`);
      valores.push(patch.content_text);
    }
    
    if (patch.descripcion !== undefined) {
      campos.push(`descripcion = $${paramIndex++}`);
      valores.push(patch.descripcion);
    }
    
    if (patch.nivel_minimo !== undefined) {
      campos.push(`nivel_minimo = $${paramIndex++}`);
      valores.push(patch.nivel_minimo);
    }
    
    if (patch.posicion !== undefined) {
      campos.push(`posicion = $${paramIndex++}`);
      valores.push(patch.posicion);
    }
    
    if (patch.obligatoria_global !== undefined) {
      campos.push(`obligatoria_global = $${paramIndex++}`);
      valores.push(patch.obligatoria_global);
    }
    
    if (patch.obligatoria_por_nivel !== undefined) {
      const obligatoriaPorNivelJson = typeof patch.obligatoria_por_nivel === 'string'
        ? patch.obligatoria_por_nivel
        : JSON.stringify(patch.obligatoria_por_nivel || {});
      campos.push(`obligatoria_por_nivel = $${paramIndex++}`);
      valores.push(obligatoriaPorNivelJson);
    }
    
    if (patch.orden !== undefined) {
      campos.push(`orden = $${paramIndex++}`);
      valores.push(patch.orden);
    }
    
    if (patch.activo !== undefined) {
      campos.push(`activo = $${paramIndex++}`);
      valores.push(patch.activo);
    }
    
    if (campos.length === 0) {
      // No hay campos para actualizar, retornar el decreto actual
      return await this.getById(id, client);
    }
    
    // Siempre actualizar updated_at
    campos.push(`updated_at = NOW()`);
    valores.push(id);
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE decretos 
       SET ${campos.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      valores
    );
    
    return result.rows[0] || null;
  }

  /**
   * Elimina un decreto (soft delete)
   * 
   * @param {number} id - ID del decreto
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async softDelete(id, client = null) {
    if (!id) return false;
    
    const queryFn = client ? client.query.bind(client) : query;
    await queryFn(
      `UPDATE decretos 
       SET deleted_at = NOW(), activo = false, updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );
    
    return true;
  }

  /**
   * Restaura un decreto eliminado (soft delete)
   * 
   * @param {number} id - ID del decreto
   * @param {Object} [client] - Client de PostgreSQL (opcional, para transacciones)
   * @returns {Promise<Object|null>} Decreto restaurado o null si no existe
   */
  async restore(id, client = null) {
    if (!id) return null;
    
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE decretos 
       SET deleted_at = NULL, activo = true, updated_at = NOW() 
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    
    return result.rows[0] || null;
  }
}

// Exportar instancia singleton por defecto
// Esto permite inyectar un mock en tests si es necesario
let defaultInstance = null;

/**
 * Obtiene la instancia por defecto del repositorio
 * 
 * @returns {DecretosRepoPg} Instancia del repositorio
 */
export function getDefaultDecretosRepo() {
  if (!defaultInstance) {
    defaultInstance = new DecretosRepoPg();
  }
  return defaultInstance;
}

// Exportar también la clase para permitir crear instancias personalizadas
export default getDefaultDecretosRepo();

