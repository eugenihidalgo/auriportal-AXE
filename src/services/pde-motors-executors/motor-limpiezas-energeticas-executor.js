// src/services/pde-motors-executors/motor-limpiezas-energeticas-executor.js
// Ejecutor del motor motor_limpiezas_energeticas
//
// Este motor NO genera steps/edges, sino que modifica el context directamente
// escribiendo en context.listas_limpieza y context.tecnicas_disponibles

import { query } from '../../../database/pg.js';
import { obtenerTecnicasPorNivel } from '../tecnicas-limpieza.js';
import { logInfo, logWarn, logError } from '../../core/observability/logger.js';

const DOMAIN = 'PDE_MOTOR_LIMPIEZAS';

/**
 * Determina si una lista es de energías indeseables
 * @param {string} nombreLista - Nombre de la lista
 * @returns {boolean}
 */
function esListaEnergiasIndeseables(nombreLista) {
  const nombreLower = (nombreLista || '').toLowerCase();
  return nombreLower.includes('energías indeseables') || nombreLower.includes('energias indeseables');
}

/**
 * Ejecuta el motor motor_limpiezas_energeticas
 * 
 * @param {Object} context - Contexto con tipo_limpieza y nivel_efectivo
 * @param {Object} motorDefinition - Definición del motor con rules
 * @returns {Promise<Object>} Context modificado con listas_limpieza y tecnicas_disponibles
 */
export async function executeMotorLimpiezasEnergeticas(context, motorDefinition) {
  logInfo(DOMAIN, 'Ejecutando motor motor_limpiezas_energeticas', {
    tipo_limpieza: context.tipo_limpieza,
    nivel_efectivo: context.nivel_efectivo
  });

  // Fail-open: valores por defecto
  const tipoLimpieza = context.tipo_limpieza || 'basica';
  const nivelEfectivo = context.nivel_efectivo !== undefined ? Number(context.nivel_efectivo) : 1;

  // Validar tipo_limpieza
  const tiposValidos = ['rapida', 'basica', 'profunda', 'maestro'];
  const tipoLimpiezaValido = tiposValidos.includes(tipoLimpieza) ? tipoLimpieza : 'basica';

  // Obtener límite según tipo de limpieza
  const limites = motorDefinition.rules?.limites || {
    rapida: 5,
    basica: 10,
    profunda: 25,
    maestro: 40
  };
  const limite = limites[tipoLimpiezaValido] || 10;

  logInfo(DOMAIN, 'Parámetros de ejecución', {
    tipo_limpieza: tipoLimpiezaValido,
    nivel_efectivo: nivelEfectivo,
    limite: limite
  });

  try {
    // 1. Obtener transmutaciones energéticas filtradas por nivel
    const transmutaciones = await obtenerTransmutacionesPorNivel(nivelEfectivo);

    // 2. Aplicar límite y ordenar
    const transmutacionesLimitadas = transmutaciones
      .slice(0, limite);

    // 3. Agrupar por categoría principal y lista contextual
    const listasLimpieza = agruparTransmutaciones(transmutacionesLimitadas);

    // 4. Obtener técnicas disponibles (sin límites, solo filtro por nivel)
    const tecnicasDisponibles = await obtenerTecnicasDisponibles(nivelEfectivo);

    // 5. Escribir en context (no borrar otros campos)
    const contextModificado = {
      ...context,
      listas_limpieza: listasLimpieza,
      tecnicas_disponibles: tecnicasDisponibles
    };

    logInfo(DOMAIN, 'Motor ejecutado exitosamente', {
      listas_count: listasLimpieza.length,
      tecnicas_count: tecnicasDisponibles.length,
      items_total: transmutacionesLimitadas.length
    });

    return contextModificado;
  } catch (error) {
    logError(DOMAIN, 'Error ejecutando motor', {
      error: error.message,
      stack: error.stack
    });
    // Fail-open: retornar context con arrays vacíos
    return {
      ...context,
      listas_limpieza: [],
      tecnicas_disponibles: []
    };
  }
}

/**
 * Obtiene transmutaciones energéticas filtradas por nivel
 * @param {number} nivelEfectivo - Nivel efectivo del alumno
 * @returns {Promise<Array>} Array de transmutaciones con nivel_minimo <= nivelEfectivo
 */
async function obtenerTransmutacionesPorNivel(nivelEfectivo) {
  try {
    const result = await query(`
      SELECT 
        it.id,
        it.nombre as title,
        it.descripcion as description,
        it.nivel as nivel_minimo,
        it.lista_id,
        lt.nombre as lista_titulo,
        it.orden,
        CASE 
          WHEN LOWER(lt.nombre) LIKE '%energías indeseables%' OR LOWER(lt.nombre) LIKE '%energias indeseables%'
          THEN 'indeseables'
          ELSE 'recurrentes'
        END as categoria_principal
      FROM items_transmutaciones it
      JOIN listas_transmutaciones lt ON lt.id = it.lista_id
      WHERE it.activo = true 
        AND lt.activo = true
        AND it.nivel <= $1
      ORDER BY it.orden ASC, it.nombre ASC
    `, [nivelEfectivo]);

    return result.rows;
  } catch (error) {
    logError(DOMAIN, 'Error obteniendo transmutaciones', {
      error: error.message
    });
    return [];
  }
}

/**
 * Agrupa transmutaciones por categoría principal y lista contextual
 * @param {Array} transmutaciones - Array de transmutaciones
 * @returns {Array} Array agrupado con estructura jerárquica
 */
function agruparTransmutaciones(transmutaciones) {
  // Agrupar por categoría principal
  const porCategoria = {};
  
  for (const item of transmutaciones) {
    const categoria = item.categoria_principal || 'recurrentes';
    const categoriaTitulo = categoria === 'indeseables' 
      ? 'Energías Indeseables' 
      : 'Limpiezas Recurrentes';

    if (!porCategoria[categoria]) {
      porCategoria[categoria] = {
        categoria_principal: categoria,
        categoria_titulo: categoriaTitulo,
        listas: {}
      };
    }

    // Agrupar por lista_id dentro de la categoría
    const listaId = item.lista_id;
    const listaTitulo = item.lista_titulo || `Lista ${listaId}`;

    if (!porCategoria[categoria].listas[listaId]) {
      porCategoria[categoria].listas[listaId] = {
        lista_id: listaId,
        lista_titulo: listaTitulo,
        items: []
      };
    }

    // Añadir item con mandatory: true
    porCategoria[categoria].listas[listaId].items.push({
      id: item.id,
      title: item.title,
      description: item.description || '',
      mandatory: true
    });
  }

  // Convertir a array y convertir listas de objeto a array
  return Object.values(porCategoria).map(categoria => ({
    categoria_principal: categoria.categoria_principal,
    categoria_titulo: categoria.categoria_titulo,
    listas: Object.values(categoria.listas)
  }));
}

/**
 * Obtiene técnicas de limpieza disponibles filtradas por nivel
 * @param {number} nivelEfectivo - Nivel efectivo del alumno
 * @returns {Promise<Array>} Array de técnicas con nivel <= nivelEfectivo
 */
async function obtenerTecnicasDisponibles(nivelEfectivo) {
  try {
    const tecnicas = await obtenerTecnicasPorNivel(nivelEfectivo, false);
    
    // Mapear a formato esperado
    // Nota: según la documentación, tecnicas_limpieza no tiene video_url,
    // pero el prompt especifica video_ref en el output, así que lo dejamos como null
    return tecnicas.map(tecnica => ({
      id: tecnica.id,
      title: tecnica.nombre,
      description: tecnica.descripcion || '',
      video_ref: null, // Campo no existe en la tabla actual
      nivel_minimo: tecnica.nivel
    }));
  } catch (error) {
    logError(DOMAIN, 'Error obteniendo técnicas', {
      error: error.message
    });
    return [];
  }
}

