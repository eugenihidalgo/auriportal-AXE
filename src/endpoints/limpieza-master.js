// src/endpoints/limpieza-master.js
// Endpoints para que el Master limpie aspectos (individual y global)

import { query } from '../../database/pg.js';
import { requireAdminAuth } from '../modules/admin-auth.js';
import { obtenerEstadoAspectoPorAlumnos } from '../services/ver-por-alumno.js';

/**
 * Limpia un aspecto para un alumno específico (Master)
 */
export async function limpiarAspectoIndividual(request, env) {
  try {
    const authCheck = requireAdminAuth(request);
    if (authCheck.requiresAuth) {
      return new Response(JSON.stringify({ success: false, error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { aspecto_id, alumno_id, tipo_aspecto = 'anatomia' } = body;
    
    if (!aspecto_id || !alumno_id) {
      return new Response(JSON.stringify({ success: false, error: 'Datos incompletos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Obtener información del aspecto
    let aspectoInfo;
    let tablaEstado;
    let campoAspectoId;
    
    switch (tipo_aspecto) {
      case 'anatomia':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias, tipo_limpieza, cantidad_minima
          FROM aspectos_energeticos
          WHERE id = $1
        `, [aspecto_id]);
        tablaEstado = 'aspectos_energeticos_alumnos';
        campoAspectoId = 'aspecto_id';
        break;
      case 'karmicos':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias, tipo_limpieza, cantidad_minima
          FROM aspectos_karmicos
          WHERE id = $1
        `, [aspecto_id]);
        tablaEstado = 'aspectos_karmicos_alumnos';
        campoAspectoId = 'aspecto_id';
        break;
      case 'indeseables':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias, tipo_limpieza, cantidad_minima
          FROM aspectos_indeseables
          WHERE id = $1
        `, [aspecto_id]);
        tablaEstado = 'aspectos_indeseables_alumnos';
        campoAspectoId = 'aspecto_id';
        break;
      case 'limpieza_hogar':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias
          FROM limpieza_hogar
          WHERE id = $1
        `, [aspecto_id]);
        tablaEstado = 'limpieza_hogar_alumnos';
        campoAspectoId = 'aspecto_id';
        break;
      default:
        return new Response(JSON.stringify({ success: false, error: 'Tipo de aspecto no válido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (aspectoInfo.rows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Aspecto no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const aspecto = aspectoInfo.rows[0];
    const ahora = new Date();
    const tipoLimpieza = aspecto.tipo_limpieza || 'regular';
    
    if (tipoLimpieza === 'regular') {
      // Limpieza regular
      const proxima = new Date(ahora);
      proxima.setDate(proxima.getDate() + (aspecto.frecuencia_dias || 14));
      
      await query(`
        INSERT INTO ${tablaEstado} 
          (alumno_id, ${campoAspectoId}, ultima_limpieza, estado, veces_limpiado)
        VALUES ($1, $2, $3, 'al_dia', 1)
        ON CONFLICT (alumno_id, ${campoAspectoId}) DO UPDATE
        SET 
          ultima_limpieza = $3,
          estado = 'al_dia',
          veces_limpiado = ${tablaEstado}.veces_limpiado + 1,
          updated_at = CURRENT_TIMESTAMP
      `, [alumno_id, aspecto_id, ahora]);
    } else {
      // Limpieza de una vez: incrementar cantidad
      await query(`
        INSERT INTO ${tablaEstado} 
          (alumno_id, ${campoAspectoId}, cantidad_completada, cantidad_requerida, completado_permanentemente)
        VALUES ($1, $2, 1, $3, false)
        ON CONFLICT (alumno_id, ${campoAspectoId}) DO UPDATE
        SET 
          cantidad_completada = ${tablaEstado}.cantidad_completada + 1,
          cantidad_requerida = COALESCE(EXCLUDED.cantidad_requerida, ${tablaEstado}.cantidad_requerida),
          completado_permanentemente = CASE
            WHEN (${tablaEstado}.cantidad_completada + 1) >= 
                 COALESCE(EXCLUDED.cantidad_requerida, ${tablaEstado}.cantidad_requerida, $3, 1)
            THEN true
            ELSE false
          END,
          updated_at = CURRENT_TIMESTAMP
      `, [alumno_id, aspecto_id, aspecto.cantidad_minima]);
    }
    
    // Registrar en historial del master
    await query(`
      INSERT INTO limpiezas_master_historial 
        (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [alumno_id, tipo_aspecto, aspecto_id, aspecto.nombre, tipo_aspecto, ahora]).catch(err => {
      console.warn('Error registrando en historial:', err.message);
    });
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en limpiarAspectoIndividual:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Limpia un aspecto para todos los suscriptores activos (Master)
 */
export async function limpiarAspectoGlobal(request, env) {
  try {
    const authCheck = requireAdminAuth(request);
    if (authCheck.requiresAuth) {
      return new Response(JSON.stringify({ success: false, error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { aspecto_id, tipo_aspecto = 'anatomia' } = body;
    
    if (!aspecto_id) {
      return new Response(JSON.stringify({ success: false, error: 'Datos incompletos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Obtener información del aspecto
    let aspectoInfo;
    let tablaEstado;
    let campoAspectoId;
    
    switch (tipo_aspecto) {
      case 'anatomia':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias, tipo_limpieza, cantidad_minima
          FROM aspectos_energeticos
          WHERE id = $1
        `, [aspecto_id]);
        tablaEstado = 'aspectos_energeticos_alumnos';
        campoAspectoId = 'aspecto_id';
        break;
      case 'karmicos':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias, tipo_limpieza, cantidad_minima
          FROM aspectos_karmicos
          WHERE id = $1
        `, [aspecto_id]);
        tablaEstado = 'aspectos_karmicos_alumnos';
        campoAspectoId = 'aspecto_id';
        break;
      case 'indeseables':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias, tipo_limpieza, cantidad_minima
          FROM aspectos_indeseables
          WHERE id = $1
        `, [aspecto_id]);
        tablaEstado = 'aspectos_indeseables_alumnos';
        campoAspectoId = 'aspecto_id';
        break;
      case 'limpieza_hogar':
        aspectoInfo = await query(`
          SELECT nombre, frecuencia_dias
          FROM limpieza_hogar
          WHERE id = $1
        `, [aspecto_id]);
        tablaEstado = 'limpieza_hogar_alumnos';
        campoAspectoId = 'aspecto_id';
        break;
      default:
        return new Response(JSON.stringify({ success: false, error: 'Tipo de aspecto no válido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (aspectoInfo.rows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Aspecto no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const aspecto = aspectoInfo.rows[0];
    const ahora = new Date();
    const tipoLimpieza = aspecto.tipo_limpieza || 'regular';
    
    // Obtener todos los alumnos con suscripción activa
    const alumnos = await query(`
      SELECT id FROM alumnos WHERE estado_suscripcion = 'activa'
    `);
    
    let totalLimpios = 0;
    
    if (tipoLimpieza === 'regular') {
      // Limpieza regular: actualizar fecha
      const proxima = new Date(ahora);
      proxima.setDate(proxima.getDate() + (aspecto.frecuencia_dias || 14));
      
      for (const alumno of alumnos.rows) {
        await query(`
          INSERT INTO ${tablaEstado} 
            (alumno_id, ${campoAspectoId}, ultima_limpieza, estado, veces_limpiado)
          VALUES ($1, $2, $3, 'al_dia', 1)
          ON CONFLICT (alumno_id, ${campoAspectoId}) DO UPDATE
          SET 
            ultima_limpieza = $3,
            estado = 'al_dia',
            veces_limpiado = ${tablaEstado}.veces_limpiado + 1,
            updated_at = CURRENT_TIMESTAMP
        `, [alumno.id, aspecto_id, ahora]);
        totalLimpios++;
      }
    } else {
      // Limpieza de una vez: incrementar cantidad (no completar permanentemente)
      for (const alumno of alumnos.rows) {
        await query(`
          INSERT INTO ${tablaEstado} 
            (alumno_id, ${campoAspectoId}, cantidad_completada, cantidad_requerida, completado_permanentemente)
          VALUES ($1, $2, 1, $3, false)
          ON CONFLICT (alumno_id, ${campoAspectoId}) DO UPDATE
          SET 
            cantidad_completada = ${tablaEstado}.cantidad_completada + 1,
            cantidad_requerida = COALESCE(EXCLUDED.cantidad_requerida, ${tablaEstado}.cantidad_requerida),
            updated_at = CURRENT_TIMESTAMP
        `, [alumno.id, aspecto_id, aspecto.cantidad_minima]);
        totalLimpios++;
      }
    }
    
    // Registrar en historial del master (alumno_id = NULL para indicar que es global)
    await query(`
      INSERT INTO limpiezas_master_historial 
        (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
      VALUES (NULL, $1, $2, $3, $4, $5)
    `, [tipo_aspecto, aspecto_id, aspecto.nombre, tipo_aspecto, ahora]).catch(err => {
      console.warn('Error registrando en historial:', err.message);
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      total_limpiados: totalLimpios 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en limpiarAspectoGlobal:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Obtiene el estado de un aspecto para todos los alumnos (para mostrar en modal)
 */
export async function obtenerEstadoAspecto(request, env) {
  try {
    const authCheck = requireAdminAuth(request);
    if (authCheck.requiresAuth) {
      return new Response(JSON.stringify({ success: false, error: 'No autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const url = new URL(request.url);
    const aspectoId = parseInt(url.searchParams.get('aspecto_id'));
    const tipoAspecto = url.searchParams.get('tipo_aspecto') || 'anatomia';
    
    if (!aspectoId) {
      return new Response(JSON.stringify({ success: false, error: 'aspecto_id requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const estado = await obtenerEstadoAspectoPorAlumnos(aspectoId, tipoAspecto);
    
    return new Response(JSON.stringify({ success: true, ...estado }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en obtenerEstadoAspecto:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}













