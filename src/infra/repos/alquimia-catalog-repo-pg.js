// src/infra/repos/alquimia-catalog-repo-pg.js
// Implementación PostgreSQL del Repositorio de Catálogo de Alquimia General
//
// Esta es la implementación concreta que encapsula TODAS las queries
// relacionadas con listas_transmutaciones e items_transmutaciones en PostgreSQL.
// 
// REGLAS:
// - Este es el ÚNICO lugar donde se importa database/pg.js para catálogo alquimia
// - Retorna objetos raw de PostgreSQL (sin normalización)
// - Todos los métodos aceptan client opcional para transacciones
// - Usa status ('active'/'archived') NO activo (boolean)
// - LEY ABSOLUTA: ORDER BY nivel ASC, created_at ASC para items

import { query } from '../../../database/pg.js';
import { AlquimiaCatalogRepo } from '../../core/repos/alquimia-catalog-repo.js';
import { getRequestId } from '../../core/observability/request-context.js';
import { logError, logInfo, logWarn } from '../../core/observability/logger.js';

// Singleton para evitar múltiples instancias
let defaultRepo = null;

// Cache de verificación de columnas (evitar múltiples queries)
let hasStatusColumnCache = {
  listas: null,
  items: null
};

/**
 * Verifica si existe la columna status en una tabla (cache)
 */
async function hasStatusColumn(tableName, queryFn) {
  const cacheKey = tableName === 'listas_transmutaciones' ? 'listas' : 'items';
  
  if (hasStatusColumnCache[cacheKey] !== null) {
    return hasStatusColumnCache[cacheKey];
  }
  
  try {
    const checkResult = await queryFn(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
      AND column_name = 'status'
    `, [tableName]);
    hasStatusColumnCache[cacheKey] = checkResult.rows.length > 0;
    // Log solo si hay error real (no debug en producción)
    return hasStatusColumnCache[cacheKey];
  } catch (checkError) {
    // Log error real usando logger estructurado
    logError('AlquimiaCatalogRepo', `Error verificando columna status en ${tableName}`, {
      tableName,
      error: checkError.message,
      code: checkError.code
    });
    // En caso de error, asumir que no existe (fallback seguro)
    hasStatusColumnCache[cacheKey] = false;
    return false;
  }
}

/**
 * Repositorio de Catálogo de Alquimia General - Implementación PostgreSQL
 * 
 * Encapsula todas las operaciones de base de datos relacionadas con el catálogo.
 * Retorna objetos raw de PostgreSQL (sin transformación).
 * 
 * Todos los métodos aceptan un parámetro opcional `client` para transacciones.
 * Si se proporciona, usa ese client; si no, usa el pool por defecto.
 */
export class AlquimiaCatalogRepoPg extends AlquimiaCatalogRepo {
  /**
   * Lista todas las listas de transmutaciones
   */
  async listListas(options = {}, client = null) {
    const traceId = getRequestId();
    try {
      const { onlyActive = true, tipo } = options;
      const queryFn = client ? client.query.bind(client) : query;

      logInfo('AlquimiaCatalogRepo', 'listListas iniciado', { traceId, options, onlyActive, tipo });

      // Verificar si existe columna status (migración v5.34.0)
      // FIX TDZ: Renombrar variable local para evitar shadowing de la función
      const hasStatus = await hasStatusColumn('listas_transmutaciones', queryFn);
      
      logInfo('AlquimiaCatalogRepo', 'listListas - verificación status', { 
        traceId, 
        hasStatus 
      });

      let sql = 'SELECT * FROM listas_transmutaciones';
      const params = [];
      const conditions = [];

      if (onlyActive) {
        if (hasStatus) {
          conditions.push(`status = 'active'`);
        } else {
          conditions.push(`activo = true`);
        }
      }

      if (tipo) {
        conditions.push(`tipo = $${params.length + 1}`);
        params.push(tipo);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY orden ASC, nombre ASC';

      logInfo('AlquimiaCatalogRepo', 'listListas - SQL preparado', { 
        traceId, 
        sql, 
        params 
      });
      
      const result = await queryFn(sql, params);
      
      logInfo('AlquimiaCatalogRepo', 'listListas completado', { 
        traceId, 
        rowCount: result?.rows?.length || 0 
      });
      
      return result.rows || [];
    } catch (error) {
      logError('AlquimiaCatalogRepo', 'Error en listListas', {
        traceId,
        error: error.message,
        code: error.code,
        stack: error.stack,
        options,
        sql: 'SELECT * FROM listas_transmutaciones...'
      });
      throw error;
    }
  }

  /**
   * Obtiene una lista por ID
   */
  async getListaById(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM listas_transmutaciones WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Crea una nueva lista
   */
  async createLista(listaData, client = null) {
    const traceId = getRequestId();
    try {
      if (!listaData.nombre) {
        throw new Error('nombre es requerido');
      }

      logInfo('AlquimiaCatalogRepo', 'createLista iniciado', { traceId, listaData });

      const queryFn = client ? client.query.bind(client) : query;
      
      // Verificar si existe columna status
      // FIX TDZ: Renombrar variable local para evitar shadowing
      const hasStatus = await hasStatusColumn('listas_transmutaciones', queryFn);
      
      logInfo('AlquimiaCatalogRepo', 'createLista - verificación status', { 
        traceId, 
        hasStatus 
      });
      
      let sql;
      let params;
      
      if (hasStatus) {
        sql = `INSERT INTO listas_transmutaciones (
          nombre, tipo, descripcion, orden, status
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`;
        params = [
          listaData.nombre,
          listaData.tipo || 'recurrente',
          listaData.descripcion || null,
          listaData.orden !== undefined ? listaData.orden : 0,
          listaData.status || 'active'
        ];
      } else {
        // Fallback a activo (BOOLEAN)
        sql = `INSERT INTO listas_transmutaciones (
          nombre, tipo, descripcion, orden, activo
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`;
        params = [
          listaData.nombre,
          listaData.tipo || 'recurrente',
          listaData.descripcion || null,
          listaData.orden !== undefined ? listaData.orden : 0,
          (listaData.status === 'active' || !listaData.status) ? true : false
        ];
      }
      
      logInfo('AlquimiaCatalogRepo', 'createLista - SQL preparado', { 
        traceId, 
        sql, 
        params 
      });
      
      const result = await queryFn(sql, params);

      logInfo('AlquimiaCatalogRepo', 'createLista completado', { 
        traceId, 
        lista_id: result?.rows?.[0]?.id 
      });
      
      return result.rows[0];
    } catch (error) {
      logError('AlquimiaCatalogRepo', 'Error en createLista', {
        traceId,
        error: error.message,
        code: error.code,
        stack: error.stack,
        listaData
      });
      throw error;
    }
  }

  /**
   * Actualiza metadata de una lista
   */
  async updateListaMeta(id, patch, client = null) {
    try {
      if (!id) return null;

      const queryFn = client ? client.query.bind(client) : query;
      
      // Verificar si existe columna status
      // FIX TDZ: Renombrar variable local para evitar shadowing
      const hasStatus = await hasStatusColumn('listas_transmutaciones', queryFn);

      const campos = [];
      const valores = [];
      let paramIndex = 1;

      // Campos permitidos para actualización
      const allowedFields = [
        'nombre', 'tipo', 'descripcion', 'orden'
      ];

      for (const field of allowedFields) {
        if (patch[field] !== undefined) {
          campos.push(`${field} = $${paramIndex++}`);
          valores.push(patch[field]);
        }
      }

      // Manejar status/activo según disponibilidad
      if (patch.status !== undefined) {
        if (hasStatus) {
          campos.push(`status = $${paramIndex++}`);
          valores.push(patch.status);
        } else {
          // Mapear status a activo
          campos.push(`activo = $${paramIndex++}`);
          valores.push(patch.status === 'active');
        }
      }

      if (campos.length === 0) {
        // No hay campos para actualizar, retornar la lista actual
        return await this.getListaById(id, client);
      }

      // Agregar id al final para el WHERE
      valores.push(id);

      const sql = `UPDATE listas_transmutaciones 
       SET ${campos.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`;

      const result = await queryFn(sql, valores);

      return result.rows[0] || null;
    } catch (error) {
      logError('AlquimiaCatalogRepo', 'Error en updateListaMeta', {
        traceId: getRequestId(),
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Archiva una lista (soft delete)
   */
  async archiveLista(id, client = null) {
    return await this.updateListaMeta(id, { status: 'archived' }, client);
  }

  /**
   * Lista todos los items de una lista
   * LEY ABSOLUTA: ORDER BY nivel ASC, created_at ASC
   */
  async listItems(listaId, options = {}, client = null) {
    try {
      if (!listaId) return [];

      const { onlyActive = true } = options;
      const queryFn = client ? client.query.bind(client) : query;

      // Verificar si existe columna status (migración v5.34.0)
      // FIX TDZ: Renombrar variable local para evitar shadowing
      const hasStatus = await hasStatusColumn('items_transmutaciones', queryFn);

      let sql = 'SELECT * FROM items_transmutaciones WHERE lista_id = $1';
      const params = [listaId];

      if (onlyActive) {
        if (hasStatus) {
          sql += ` AND status = 'active'`;
        } else {
          sql += ` AND activo = true`;
        }
      }

      // LEY ABSOLUTA: ORDER BY priority ASC, nivel ASC, created_at ASC
      // priority 1 = máxima prioridad (número más bajo = más importante)
      sql += ' ORDER BY priority ASC, nivel ASC NULLS LAST, created_at ASC';

      const result = await queryFn(sql, params);
      
      return result.rows || [];
    } catch (error) {
      logError('AlquimiaCatalogRepo', 'Error en listItems', {
        traceId: getRequestId(),
        listaId,
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Obtiene un item por ID
   */
  async getItemById(id, client = null) {
    if (!id) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM items_transmutaciones WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Obtiene un item por item_ref
   */
  async getItemByRef(itemRef, client = null) {
    if (!itemRef) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM items_transmutaciones WHERE item_ref = $1',
      [itemRef]
    );

    return result.rows[0] || null;
  }

  /**
   * Crea un nuevo item
   * Genera item_ref automáticamente: 'te_item_' || id (después de INSERT)
   */
  async createItem(itemData, client = null) {
    if (!itemData.lista_id || !itemData.nombre) {
      throw new Error('lista_id y nombre son requeridos');
    }

    // FIX CRÍTICO: Validar item_ref ANTES de INSERT
    // item_ref debe venir del service (generado automáticamente)
    // NO debe venir del frontend
    if (!itemData.item_ref || typeof itemData.item_ref !== 'string' || itemData.item_ref.trim() === '') {
      throw new Error('item_ref es requerido y debe ser un string no vacío. Debe generarse en el service antes de llamar a createItem().');
    }

    const queryFn = client ? client.query.bind(client) : query;
    const traceId = getRequestId();
    
    // FIX v1.1: Usar priority (integer) en lugar de prioridad (string)
    // priority 1 = máxima prioridad, default 10
    // FIX CRÍTICO: Validación defensiva para prevenir NaN
    const nivelValue = itemData.nivel !== undefined && Number.isFinite(itemData.nivel) ? itemData.nivel : null;
    const priorityValue = itemData.priority !== undefined && Number.isFinite(itemData.priority) && itemData.priority >= 1 ? itemData.priority : 10;
    const daysValue = itemData.days !== undefined && Number.isFinite(itemData.days) && itemData.days >= 1 
      ? itemData.days 
      : (itemData.frecuencia_dias !== undefined && Number.isFinite(itemData.frecuencia_dias) && itemData.frecuencia_dias >= 1 
          ? itemData.frecuencia_dias 
          : 20);
    const vecesValue = itemData.veces_limpiar !== undefined && Number.isFinite(itemData.veces_limpiar) && itemData.veces_limpiar >= 1 
      ? itemData.veces_limpiar 
      : null;
    
    // Log warning si se corrigió un NaN (solo una línea)
    if (itemData.nivel !== undefined && !Number.isFinite(itemData.nivel)) {
      logWarn('AlquimiaCatalogRepo', 'Nivel NaN corregido a null en createItem', { traceId });
    }
    if (itemData.priority !== undefined && !Number.isFinite(itemData.priority)) {
      logWarn('AlquimiaCatalogRepo', 'Priority NaN corregido a 10 en createItem', { traceId });
    }
    if ((itemData.days !== undefined || itemData.frecuencia_dias !== undefined) && !Number.isFinite(daysValue)) {
      logWarn('AlquimiaCatalogRepo', 'Days NaN corregido a 20 en createItem', { traceId });
    }
    
    // INSERT con item_ref (generado en service)
    const result = await queryFn(
      `INSERT INTO items_transmutaciones (
        lista_id, nombre, descripcion, nivel, priority,
        frecuencia_dias, veces_limpiar, status, item_ref
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        itemData.lista_id,
        itemData.nombre,
        itemData.descripcion || null,
        nivelValue,
        priorityValue,
        daysValue,
        vecesValue,
        itemData.status || 'active',
        itemData.item_ref // item_ref generado en service
      ]
    );

    const item = result.rows[0];
    
    // Verificar que item_ref se insertó correctamente
    if (!item.item_ref) {
      logWarn('AlquimiaCatalogRepo', 'item_ref no se insertó correctamente, generando fallback', { traceId, item_id: item.id });
      // Fallback: generar item_ref si por alguna razón no se insertó
      const itemRef = 'te_item_' + item.id;
      const updateResult = await queryFn(
        'UPDATE items_transmutaciones SET item_ref = $1 WHERE id = $2 RETURNING *',
        [itemRef, item.id]
      );
      return updateResult.rows[0];
    }

    return item;
  }

  /**
   * Actualiza un item
   */
  async updateItem(id, patch, client = null) {
    if (!id) return null;

    const campos = [];
    const valores = [];
    let paramIndex = 1;

    // Campos permitidos para actualización
    const allowedFields = [
      'nombre', 'descripcion', 'nivel', 'prioridad',
      'frecuencia_dias', 'veces_limpiar', 'status'
    ];

    for (const field of allowedFields) {
      if (patch[field] !== undefined) {
        campos.push(`${field} = $${paramIndex++}`);
        valores.push(patch[field]);
      }
    }

    if (campos.length === 0) {
      // No hay campos para actualizar, retornar el item actual
      return await this.getItemById(id, client);
    }

    // Agregar id al final para el WHERE
    valores.push(id);

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      `UPDATE items_transmutaciones 
       SET ${campos.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      valores
    );

    return result.rows[0] || null;
  }

  /**
   * Archiva un item (soft delete)
   */
  async archiveItem(id, client = null) {
    return await this.updateItem(id, { status: 'archived' }, client);
  }
}

/**
 * Obtiene una instancia singleton del repositorio
 * 
 * @returns {AlquimiaCatalogRepoPg} Instancia del repositorio
 */
export function getDefaultAlquimiaCatalogRepo() {
  if (!defaultRepo) {
    defaultRepo = new AlquimiaCatalogRepoPg();
  }
  return defaultRepo;
}
