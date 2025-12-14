// src/endpoints/perfil-personal.js
// Página de perfil personal del alumno
//
// REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.

import { requireStudentContext } from '../core/auth-context.js';
import { query } from '../../database/pg.js';
import { obtenerNotasAlumno } from '../services/notas-master.js';
import { obtenerItemsVerdesParaAlumno } from '../services/transmutaciones-energeticas.js';
import { listarTonos } from '../services/tonos-meditacion.js';
import { renderHtml } from '../core/html-response.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar plantilla HTML
const templatePath = join(__dirname, '../core/html/perfil-personal.html');
const template = readFileSync(templatePath, 'utf-8');

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Obtener alumno por email desde PostgreSQL (permite suscripción pausada también)
 */
async function obtenerAlumnoPorEmail(email) {
  try {
    // Intentar obtener con tema_preferido, si falla usar query sin esa columna
    let result;
    try {
      result = await query(
        `SELECT id, email, apodo, nivel_actual, estado_suscripcion, COALESCE(tema_preferido, 'light') as tema_preferido
         FROM alumnos 
         WHERE email = $1`,
        [email.toLowerCase().trim()]
      );
    } catch (colError) {
      // Si la columna no existe (error 42703), obtener sin ella y usar 'light' por defecto
      if (colError.code === '42703' || colError.message?.includes('does not exist') || colError.message?.includes('no existe')) {
        console.warn('⚠️  Columna tema_preferido no existe aún, usando query sin ella');
        result = await query(
          `SELECT id, email, apodo, nivel_actual, estado_suscripcion
           FROM alumnos 
           WHERE email = $1`,
          [email.toLowerCase().trim()]
        );
        // Añadir tema_preferido por defecto
        if (result.rows.length > 0) {
          result.rows[0].tema_preferido = 'light';
        }
      } else {
        // Si es otro tipo de error, relanzarlo
        throw colError;
      }
    }
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const alumno = result.rows[0];
    
    // Asegurar que tema_preferido siempre esté definido
    if (!alumno.tema_preferido) {
      alumno.tema_preferido = 'light';
    }
    
    // Obtener la fase basándose en el nivel
    try {
      const nivel = alumno.nivel_actual || 1;
      const faseResult = await query(
        `SELECT fase FROM niveles_fases 
         WHERE (nivel_min IS NULL OR $1 >= nivel_min) 
           AND (nivel_max IS NULL OR $1 <= nivel_max)
         ORDER BY nivel_min DESC
         LIMIT 1`,
        [nivel]
      );
      
      alumno.fase_actual = faseResult.rows.length > 0 ? faseResult.rows[0].fase : 'sanación';
    } catch (faseError) {
      // Si hay error obteniendo la fase, usar valor por defecto
      const nivel = alumno.nivel_actual || 1;
      console.warn('Error obteniendo fase para nivel', nivel, ':', faseError.message);
      alumno.fase_actual = 'sanación';
    }
    
    return alumno;
  } catch (error) {
    console.error('Error en obtenerAlumnoPorEmail:', error);
    throw error;
  }
}

/**
 * Obtener notas de Eugeni Hidalgo para un alumno
 */
async function obtenerNotas(alumnoId, suscripcionActiva = true) {
  try {
    // Solo obtener notas si la suscripción está activa
    if (!suscripcionActiva) {
      return [];
    }
    return await obtenerNotasAlumno(alumnoId);
  } catch (error) {
    // Si el error es de suscripción no activa, retornar array vacío
    if (error.message && error.message.includes('suscripción activa')) {
      return [];
    }
    console.error('Error obteniendo notas:', error);
    return [];
  }
}

/**
 * Obtener canalizaciones/comunicados para un alumno
 */
async function obtenerCanalizaciones(alumnoId) {
  try {
    const result = await query(
      `SELECT id, mensaje, fecha, creado_por, leido
       FROM comunicados_eugeni
       WHERE alumno_id = $1
       ORDER BY fecha DESC
       LIMIT 50`,
      [alumnoId]
    );
    return result.rows || [];
  } catch (error) {
    // Si la tabla no existe, retornar array vacío sin error
    if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('no existe')) {
      console.warn('⚠️  Tabla comunicados_eugeni no existe aún, retornando array vacío');
      return [];
    }
    console.error('Error obteniendo canalizaciones:', error);
    return [];
  }
}

/**
 * Obtener lugares creados por el alumno
 */
async function obtenerLugares(alumnoId) {
  try {
    const result = await query(
      `SELECT id, nombre, descripcion, activo, created_at, updated_at
       FROM alumnos_lugares
       WHERE alumno_id = $1
       ORDER BY activo DESC, nombre ASC`,
      [alumnoId]
    );
    return result.rows || [];
  } catch (error) {
    // Si la tabla no existe, retornar array vacío sin error
    if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('no existe')) {
      console.warn('⚠️  Tabla alumnos_lugares no existe aún, retornando array vacío');
      return [];
    }
    console.error('Error obteniendo lugares:', error);
    return [];
  }
}

/**
 * Asegurar que la tabla alumnos_proyectos existe, crearla si no existe
 */
async function asegurarTablaAlumnosProyectos() {
  try {
    // Primero verificar que la tabla alumnos existe (requisito para la foreign key)
    const checkAlumnos = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'alumnos'
      );
    `);
    
    if (!checkAlumnos.rows[0].exists) {
      console.error('❌ La tabla alumnos no existe. No se puede crear alumnos_proyectos sin ella.');
      throw new Error('La tabla alumnos no existe. Por favor, inicializa la base de datos primero.');
    }
    
    // Verificar si la tabla alumnos_proyectos existe
    const checkResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'alumnos_proyectos'
      );
    `);
    
    if (!checkResult.rows[0].exists) {
      console.log('📦 Creando tabla alumnos_proyectos...');
      // Crear la tabla
      await query(`
        CREATE TABLE IF NOT EXISTS alumnos_proyectos (
          id SERIAL PRIMARY KEY,
          alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
          nombre VARCHAR(255) NOT NULL,
          descripcion TEXT,
          activo BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(alumno_id, nombre)
        );
        
        CREATE INDEX IF NOT EXISTS idx_alumnos_proyectos_alumno ON alumnos_proyectos(alumno_id);
        CREATE INDEX IF NOT EXISTS idx_alumnos_proyectos_activo ON alumnos_proyectos(activo);
      `);
      console.log('✅ Tabla alumnos_proyectos creada exitosamente');
    }
  } catch (error) {
    console.error('❌ Error verificando/creando tabla alumnos_proyectos:', error);
    // Re-lanzar el error para que el código que llama pueda manejarlo
    throw error;
  }
}

/**
 * Obtener proyectos creados por el alumno
 */
async function obtenerProyectos(alumnoId) {
  try {
    // Asegurar que la tabla existe antes de consultar
    await asegurarTablaAlumnosProyectos();
    
    const result = await query(
      `SELECT id, nombre, descripcion, activo, created_at, updated_at
       FROM alumnos_proyectos
       WHERE alumno_id = $1
       ORDER BY activo DESC, nombre ASC`,
      [alumnoId]
    );
    return result.rows || [];
  } catch (error) {
    // Si la tabla no existe, retornar array vacío sin error
    if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('no existe')) {
      console.warn('⚠️  Tabla alumnos_proyectos no existe aún, retornando array vacío');
      return [];
    }
    console.error('Error obteniendo proyectos:', error);
    return [];
  }
}

/**
 * Obtener diario personal del alumno
 */
async function obtenerDiario(alumnoId) {
  try {
    const result = await query(
      `SELECT id, fecha, texto_usuario as contenido, resumen_auto, created_at
       FROM diario_practicas
       WHERE alumno_id = $1
       ORDER BY fecha DESC
       LIMIT 30`,
      [alumnoId]
    );
    return result.rows || [];
  } catch (error) {
    // Si la tabla no existe, retornar array vacío sin error
    if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('no existe')) {
      console.warn('⚠️  Tabla diario_practicas no existe aún, retornando array vacío');
      return [];
    }
    console.error('Error obteniendo diario:', error);
    return [];
  }
}

/**
 * Obtener apadrinados del alumno (solo lectura, informativo)
 */
async function obtenerApadrinados(alumnoId) {
  try {
    const result = await query(
      `SELECT 
        ta.id,
        ta.nombre,
        ta.descripcion,
        ta.nivel_minimo,
        ta.prioridad,
        ta.activo,
        tae.estado,
        tae.ultima_limpieza,
        CASE
          WHEN tae.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT
        END as dias_desde_limpieza
      FROM transmutaciones_apadrinados ta
      LEFT JOIN transmutaciones_apadrinados_estado tae ON ta.id = tae.apadrinado_id AND tae.alumno_id = $1
      WHERE ta.activo = true
        AND ta.alumno_id = $1
      ORDER BY COALESCE(ta.orden, 0) ASC, ta.nombre ASC`,
      [alumnoId]
    );
    return result.rows || [];
  } catch (error) {
    // Si la tabla no existe, retornar array vacío
    if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('no existe')) {
      console.warn('⚠️  Tabla transmutaciones_apadrinados no existe aún, retornando array vacío');
      return [];
    }
    console.error('Error obteniendo apadrinados:', error);
    return [];
  }
}

/**
 * Obtener todas las limpiezas al día (aspectos marcados como 'limpio') para un alumno
 */
async function obtenerLimpiezasAlDia(alumnoId) {
  try {
    const limpiezas = [];
    
    // 1. Aspectos Energéticos
    try {
      const resultEnergeticos = await query(
        `SELECT 
          aea.id,
          ae.nombre as aspecto_nombre,
          'Anatomía Energética' as seccion,
          'energetico' as tipo,
          aea.ultima_limpieza,
          aea.veces_limpiado,
          ae.frecuencia_dias
        FROM aspectos_energeticos_alumnos aea
        INNER JOIN aspectos_energeticos ae ON aea.aspecto_id = ae.id
        WHERE aea.alumno_id = $1
          AND aea.estado = 'limpio'
        ORDER BY aea.ultima_limpieza DESC, ae.nombre ASC`,
        [alumnoId]
      );
      limpiezas.push(...resultEnergeticos.rows.map(r => ({
        ...r,
        tipo: 'energetico'
      })));
    } catch (error) {
      if (error.code !== '42P01' && !error.message?.includes('does not exist') && !error.message?.includes('no existe')) {
        console.error('Error obteniendo aspectos energéticos limpios:', error);
      }
    }
    
    // 2. Aspectos Kármicos
    try {
      const resultKarmicos = await query(
        `SELECT 
          aka.id,
          ak.nombre as aspecto_nombre,
          'Aspectos Kármicos' as seccion,
          'karmico' as tipo,
          aka.ultima_limpieza,
          aka.veces_limpiado,
          ak.frecuencia_dias
        FROM aspectos_karmicos_alumnos aka
        INNER JOIN aspectos_karmicos ak ON aka.aspecto_id = ak.id
        WHERE aka.alumno_id = $1
          AND aka.estado = 'limpio'
        ORDER BY aka.ultima_limpieza DESC, ak.nombre ASC`,
        [alumnoId]
      );
      limpiezas.push(...resultKarmicos.rows.map(r => ({
        ...r,
        tipo: 'karmico'
      })));
    } catch (error) {
      if (error.code !== '42P01' && !error.message?.includes('does not exist') && !error.message?.includes('no existe')) {
        console.error('Error obteniendo aspectos kármicos limpios:', error);
      }
    }
    
    // 3. Aspectos Indeseables
    try {
      const resultIndeseables = await query(
        `SELECT 
          aia.id,
          ai.nombre as aspecto_nombre,
          'Aspectos Indeseables' as seccion,
          'indeseable' as tipo,
          aia.ultima_limpieza,
          aia.veces_limpiado,
          ai.frecuencia_dias
        FROM aspectos_indeseables_alumnos aia
        INNER JOIN aspectos_indeseables ai ON aia.aspecto_id = ai.id
        WHERE aia.alumno_id = $1
          AND aia.estado = 'limpio'
        ORDER BY aia.ultima_limpieza DESC, ai.nombre ASC`,
        [alumnoId]
      );
      limpiezas.push(...resultIndeseables.rows.map(r => ({
        ...r,
        tipo: 'indeseable'
      })));
    } catch (error) {
      if (error.code !== '42P01' && !error.message?.includes('does not exist') && !error.message?.includes('no existe')) {
        console.error('Error obteniendo aspectos indeseables limpios:', error);
      }
    }
    
    // 4. Limpieza de Hogar
    try {
      const resultHogar = await query(
        `SELECT 
          lha.id,
          lh.nombre as aspecto_nombre,
          'Limpieza de Hogar' as seccion,
          'hogar' as tipo,
          lha.ultima_limpieza,
          lha.veces_limpiado,
          lh.frecuencia_dias
        FROM limpieza_hogar_alumnos lha
        INNER JOIN limpieza_hogar lh ON lha.aspecto_id = lh.id
        WHERE lha.alumno_id = $1
          AND lha.estado = 'limpio'
        ORDER BY lha.ultima_limpieza DESC, lh.nombre ASC`,
        [alumnoId]
      );
      limpiezas.push(...resultHogar.rows.map(r => ({
        ...r,
        tipo: 'hogar'
      })));
    } catch (error) {
      if (error.code !== '42P01' && !error.message?.includes('does not exist') && !error.message?.includes('no existe')) {
        console.error('Error obteniendo limpiezas de hogar:', error);
      }
    }
    
    // Ordenar por fecha de última limpieza (más reciente primero)
    limpiezas.sort((a, b) => {
      if (!a.ultima_limpieza && !b.ultima_limpieza) return 0;
      if (!a.ultima_limpieza) return 1;
      if (!b.ultima_limpieza) return -1;
      return new Date(b.ultima_limpieza) - new Date(a.ultima_limpieza);
    });
    
    return limpiezas;
  } catch (error) {
    console.error('Error obteniendo limpiezas al día:', error);
    return [];
  }
}

/**
 * Crear nuevo lugar del alumno
 */
async function crearLugar(alumnoId, nombre, descripcion) {
  try {
    const result = await query(
      `INSERT INTO alumnos_lugares (alumno_id, nombre, descripcion, activo)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (alumno_id, nombre) DO UPDATE SET
         descripcion = EXCLUDED.descripcion,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [alumnoId, nombre.trim(), descripcion || '']
    );
    return { success: true, lugar: result.rows[0] };
  } catch (error) {
    console.error('Error creando lugar:', error);
    throw error;
  }
}

/**
 * Actualizar lugar del alumno
 */
async function actualizarLugar(alumnoId, lugarId, nombre, descripcion) {
  try {
    // Verificar que el lugar pertenece al alumno
    const lugarResult = await query(
      `SELECT id FROM alumnos_lugares WHERE id = $1 AND alumno_id = $2`,
      [lugarId, alumnoId]
    );
    
    if (lugarResult.rows.length === 0) {
      throw new Error('Lugar no encontrado o no pertenece al alumno');
    }
    
    const result = await query(
      `UPDATE alumnos_lugares 
       SET nombre = $1, descripcion = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND alumno_id = $4
       RETURNING *`,
      [nombre.trim(), descripcion || '', lugarId, alumnoId]
    );
    
    return { success: true, lugar: result.rows[0] };
  } catch (error) {
    console.error('Error actualizando lugar:', error);
    throw error;
  }
}

/**
 * Activar un lugar (desactiva los demás)
 */
async function activarLugar(alumnoId, lugarId) {
  try {
    // Verificar que el lugar pertenece al alumno
    const lugarResult = await query(
      `SELECT id FROM alumnos_lugares WHERE id = $1 AND alumno_id = $2`,
      [lugarId, alumnoId]
    );
    
    if (lugarResult.rows.length === 0) {
      throw new Error('Lugar no encontrado o no pertenece al alumno');
    }
    
    // Desactivar todos los lugares del alumno
    await query(
      `UPDATE alumnos_lugares SET activo = FALSE WHERE alumno_id = $1`,
      [alumnoId]
    );
    
    // Activar el lugar seleccionado
    const result = await query(
      `UPDATE alumnos_lugares 
       SET activo = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND alumno_id = $2
       RETURNING *`,
      [lugarId, alumnoId]
    );
    
    return { success: true, lugar: result.rows[0] };
  } catch (error) {
    console.error('Error activando lugar:', error);
    throw error;
  }
}

/**
 * Desactivar un lugar
 */
async function desactivarLugar(alumnoId, lugarId) {
  try {
    // Verificar que el lugar pertenece al alumno
    const lugarResult = await query(
      `SELECT id FROM alumnos_lugares WHERE id = $1 AND alumno_id = $2`,
      [lugarId, alumnoId]
    );
    
    if (lugarResult.rows.length === 0) {
      throw new Error('Lugar no encontrado o no pertenece al alumno');
    }
    
    // Desactivar el lugar
    const result = await query(
      `UPDATE alumnos_lugares 
       SET activo = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND alumno_id = $2
       RETURNING *`,
      [lugarId, alumnoId]
    );
    
    return { success: true, lugar: result.rows[0] };
  } catch (error) {
    console.error('Error desactivando lugar:', error);
    throw error;
  }
}

/**
 * Eliminar lugar del alumno
 */
async function eliminarLugar(alumnoId, lugarId) {
  try {
    const result = await query(
      `DELETE FROM alumnos_lugares WHERE id = $1 AND alumno_id = $2 RETURNING id`,
      [lugarId, alumnoId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Lugar no encontrado o no pertenece al alumno');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error eliminando lugar:', error);
    throw error;
  }
}

/**
 * Crear nuevo proyecto del alumno
 */
async function crearProyecto(alumnoId, nombre, descripcion) {
  try {
    // Asegurar que la tabla existe antes de insertar
    await asegurarTablaAlumnosProyectos();
    
    const result = await query(
      `INSERT INTO alumnos_proyectos (alumno_id, nombre, descripcion, activo)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (alumno_id, nombre) DO UPDATE SET
         descripcion = EXCLUDED.descripcion,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [alumnoId, nombre.trim(), descripcion || '']
    );
    return { success: true, proyecto: result.rows[0] };
  } catch (error) {
    // Si el error es que la tabla no existe, intentar crearla y reintentar
    if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('no existe')) {
      console.warn('⚠️  Tabla alumnos_proyectos no existe, intentando crearla...');
      try {
        await asegurarTablaAlumnosProyectos();
        // Reintentar la inserción
        const result = await query(
          `INSERT INTO alumnos_proyectos (alumno_id, nombre, descripcion, activo)
           VALUES ($1, $2, $3, FALSE)
           ON CONFLICT (alumno_id, nombre) DO UPDATE SET
             descripcion = EXCLUDED.descripcion,
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [alumnoId, nombre.trim(), descripcion || '']
        );
        return { success: true, proyecto: result.rows[0] };
      } catch (retryError) {
        console.error('❌ Error después de crear tabla:', retryError);
        throw new Error(`Error creando proyecto: ${retryError.message}`);
      }
    }
    console.error('Error creando proyecto:', error);
    throw new Error(`Error creando proyecto: ${error.message}`);
  }
}

/**
 * Actualizar proyecto del alumno
 */
async function actualizarProyecto(alumnoId, proyectoId, nombre, descripcion) {
  try {
    // Asegurar que la tabla existe antes de actualizar
    await asegurarTablaAlumnosProyectos();
    
    // Verificar que el proyecto pertenece al alumno
    const proyectoResult = await query(
      `SELECT id FROM alumnos_proyectos WHERE id = $1 AND alumno_id = $2`,
      [proyectoId, alumnoId]
    );
    
    if (proyectoResult.rows.length === 0) {
      throw new Error('Proyecto no encontrado o no pertenece al alumno');
    }
    
    const result = await query(
      `UPDATE alumnos_proyectos 
       SET nombre = $1, descripcion = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND alumno_id = $4
       RETURNING *`,
      [nombre.trim(), descripcion || '', proyectoId, alumnoId]
    );
    
    return { success: true, proyecto: result.rows[0] };
  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    throw new Error(`Error actualizando proyecto: ${error.message}`);
  }
}

/**
 * Activar un proyecto (desactiva los demás)
 */
async function activarProyecto(alumnoId, proyectoId) {
  try {
    // Asegurar que la tabla existe antes de activar
    await asegurarTablaAlumnosProyectos();
    
    // Verificar que el proyecto pertenece al alumno
    const proyectoResult = await query(
      `SELECT id FROM alumnos_proyectos WHERE id = $1 AND alumno_id = $2`,
      [proyectoId, alumnoId]
    );
    
    if (proyectoResult.rows.length === 0) {
      throw new Error('Proyecto no encontrado o no pertenece al alumno');
    }
    
    // Desactivar todos los proyectos del alumno
    await query(
      `UPDATE alumnos_proyectos SET activo = FALSE WHERE alumno_id = $1`,
      [alumnoId]
    );
    
    // Activar el proyecto seleccionado
    const result = await query(
      `UPDATE alumnos_proyectos 
       SET activo = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND alumno_id = $2
       RETURNING *`,
      [proyectoId, alumnoId]
    );
    
    return { success: true, proyecto: result.rows[0] };
  } catch (error) {
    console.error('Error activando proyecto:', error);
    throw new Error(`Error activando proyecto: ${error.message}`);
  }
}

/**
 * Eliminar proyecto del alumno
 */
async function eliminarProyecto(alumnoId, proyectoId) {
  try {
    // Asegurar que la tabla existe antes de eliminar
    await asegurarTablaAlumnosProyectos();
    
    const result = await query(
      `DELETE FROM alumnos_proyectos WHERE id = $1 AND alumno_id = $2 RETURNING id`,
      [proyectoId, alumnoId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Proyecto no encontrado o no pertenece al alumno');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    throw new Error(`Error eliminando proyecto: ${error.message}`);
  }
}

/**
 * Handler principal
 */
export default async function perfilPersonalHandler(request, env, ctx) {
  try {
    // Obtener contexto de autenticación (devuelve Response si no autenticado)
    const authCtx = await requireStudentContext(request, env);
    if (authCtx instanceof Response) {
      // Si no está autenticado, redirigir a /enter
      return Response.redirect('/enter', 302);
    }
    
    // Usar ctx.user en lugar de buscar alumno directamente
    const student = authCtx.user;
    const email = student.email.toLowerCase().trim();
    console.log(`🔍 Perfil-personal: Alumno autenticado: ID ${student.id}, email: ${email}`);
    
    // Obtener alumno completo desde PostgreSQL (permite ver aunque esté pausado)
    // Usamos obtenerAlumnoPorEmail para obtener datos completos (tema_preferido, etc.)
    let alumno;
    try {
      alumno = await obtenerAlumnoPorEmail(email);
    } catch (dbError) {
      console.error('❌ Error en obtenerAlumnoPorEmail:', dbError);
      throw new Error(`Error accediendo a la base de datos: ${dbError.message}`);
    }
    
    if (!alumno) {
      console.log(`⚠️  Perfil-personal: Alumno no encontrado para email: ${email}`);
      const errorHtml = `<!DOCTYPE html>
<html>
<head><title>Acceso Denegado</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
  <h1>🔒 Acceso Denegado</h1>
  <p>No tienes acceso a esta página.</p>
  <p><a href="/enter">Volver al inicio</a></p>
</body>
</html>`;
      return renderHtml(errorHtml, { status: 403 });
    }
    
    console.log(`✅ Perfil-personal: Alumno encontrado: ID ${alumno.id}, nivel ${alumno.nivel_actual}`);
    
    // Verificar si la suscripción está pausada (ya calculado arriba, pero mantener para compatibilidad)
    const suscripcionPausada = alumno.estado_suscripcion !== 'activa';
    
    // Si es POST, manejar acciones de lugares y proyectos
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (jsonError) {
        console.error('❌ Error parseando JSON del request:', jsonError);
        return new Response(JSON.stringify({ error: 'Error: JSON inválido en el request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Verificar que body tiene la estructura esperada
      if (!body || typeof body !== 'object') {
        return new Response(JSON.stringify({ error: 'Error: body inválido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Verificar suscripción activa antes de permitir cualquier acción
      if (suscripcionPausada) {
        return new Response(JSON.stringify({ 
          error: 'Tu suscripción está pausada. No puedes realizar esta acción hasta que se reactive.' 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        // Acciones de lugares
        if (body.accion === 'crear_lugar') {
          const resultado = await crearLugar(alumno.id, body.nombre, body.descripcion);
          return new Response(JSON.stringify(resultado), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (body.accion === 'actualizar_lugar') {
          const resultado = await actualizarLugar(alumno.id, body.lugar_id, body.nombre, body.descripcion);
          return new Response(JSON.stringify(resultado), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (body.accion === 'activar_lugar') {
          const resultado = await activarLugar(alumno.id, body.lugar_id);
          return new Response(JSON.stringify(resultado), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (body.accion === 'desactivar_lugar') {
          const resultado = await desactivarLugar(alumno.id, body.lugar_id);
          return new Response(JSON.stringify(resultado), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (body.accion === 'eliminar_lugar') {
          const resultado = await eliminarLugar(alumno.id, body.lugar_id);
          return new Response(JSON.stringify(resultado), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Acciones de proyectos
        if (body.accion === 'crear_proyecto') {
          const resultado = await crearProyecto(alumno.id, body.nombre, body.descripcion);
          return new Response(JSON.stringify(resultado), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (body.accion === 'actualizar_proyecto') {
          const resultado = await actualizarProyecto(alumno.id, body.proyecto_id, body.nombre, body.descripcion);
          return new Response(JSON.stringify(resultado), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (body.accion === 'activar_proyecto') {
          const resultado = await activarProyecto(alumno.id, body.proyecto_id);
          return new Response(JSON.stringify(resultado), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (body.accion === 'eliminar_proyecto') {
          const resultado = await eliminarProyecto(alumno.id, body.proyecto_id);
          return new Response(JSON.stringify(resultado), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Acción para guardar tono de meditación
        if (body.accion === 'guardar_tono_meditacion') {
          const tonoId = body.tono_id ? parseInt(body.tono_id) : null;
          await query(
            `UPDATE alumnos SET tono_meditacion_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [tonoId, alumno.id]
          );
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Acción para guardar tema preferido
        if (body.accion === 'guardar_tema') {
          try {
            const tema = body.tema || 'light';
            if (tema !== 'light' && tema !== 'dark') {
              return new Response(JSON.stringify({ error: 'Tema no válido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            if (!alumno || !alumno.id) {
              return new Response(JSON.stringify({ error: 'Error: datos de usuario no disponibles' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            await query(
              `UPDATE alumnos SET tema_preferido = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
              [tema, alumno.id]
            );
            
            return new Response(JSON.stringify({ success: true, tema: tema }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (error) {
            console.error('❌ Error guardando tema:', error);
            return new Response(JSON.stringify({ error: 'Error al guardar el tema' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
        
        return new Response(JSON.stringify({ error: 'Acción no válida' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Obtener todos los datos
    const suscripcionActiva = alumno.estado_suscripcion === 'activa';
    console.log(`📊 Perfil-personal: Obteniendo datos para alumno ID ${alumno.id}, suscripción: ${suscripcionActiva ? 'activa' : 'pausada'}`);
    
    let notas, canalizaciones, lugares, proyectos, diario, apadrinados, limpiezasAlDia, transmutacionesVerdes, tonos;
    try {
      [notas, canalizaciones, lugares, proyectos, diario, apadrinados, limpiezasAlDia, transmutacionesVerdes, tonos] = await Promise.all([
        obtenerNotas(alumno.id, suscripcionActiva),
        obtenerCanalizaciones(alumno.id),
        obtenerLugares(alumno.id),
        obtenerProyectos(alumno.id),
        obtenerDiario(alumno.id),
        obtenerApadrinados(alumno.id),
        obtenerLimpiezasAlDia(alumno.id),
        suscripcionActiva ? obtenerItemsVerdesParaAlumno(alumno.id) : Promise.resolve([]),
        listarTonos()
      ]);
      console.log(`✅ Perfil-personal: Datos obtenidos - Notas: ${notas.length}, Canalizaciones: ${canalizaciones.length}, Lugares: ${lugares.length}, Proyectos: ${proyectos.length}, Diario: ${diario.length}, Apadrinados: ${apadrinados.length}, Limpiezas al día: ${limpiezasAlDia.length}, Transmutaciones: ${transmutacionesVerdes?.length || 0}`);
    } catch (dataError) {
      console.error('❌ Error obteniendo datos del perfil:', dataError);
      // Continuar con arrays vacíos si hay error obteniendo datos
      notas = [];
      canalizaciones = [];
      lugares = [];
      proyectos = [];
      diario = [];
      apadrinados = [];
      limpiezasAlDia = [];
      transmutacionesVerdes = [];
      tonos = [];
    }
    
    // Preparar datos para la plantilla
    const nombre = alumno.apodo || alumno.email;
    const nivel = alumno.nivel_actual || 1;
    const fase = alumno.fase_actual || 'sanación';
    const tonoActualId = alumno.tono_meditacion_id || null;
    // Asegurar que tema_preferido siempre tenga un valor válido
    const temaPreferido = (alumno.tema_preferido === 'dark' || alumno.tema_preferido === 'light') 
      ? alumno.tema_preferido 
      : 'light';
    
    // Generar HTML del selector de tonos
    const tonosHTML = tonos.length > 0
      ? tonos.map(tono => `
          <option value="${tono.id}" ${tonoActualId === tono.id ? 'selected' : ''}>
            ${escapeHtml(tono.nombre || 'Sin nombre')}${tono.es_por_defecto ? ' (Por defecto)' : ''}
          </option>
        `).join('')
      : '<option value="">No hay tonos disponibles</option>';
    
    // Lugar activo (solo uno puede estar activo)
    const lugarActivo = lugares.find(l => l.activo === true) || null;
    
    // Proyecto activo (solo uno puede estar activo)
    const proyectoActivo = proyectos.find(p => p.activo === true) || null;
    
    // Generar HTML de notas
    const notasHTML = notas.length > 0
      ? notas.map(nota => `
          <div class="nota-item">
            <div class="nota-fecha">${new Date(nota.fecha).toLocaleDateString('es-ES')}</div>
            <div class="nota-contenido">${nota.contenido}</div>
          </div>
        `).join('')
      : '<p class="texto-vacio">No hay notas de Eugeni Hidalgo aún.</p>';
    
    // Generar HTML de canalizaciones
    const canalizacionesHTML = canalizaciones.length > 0
      ? canalizaciones.map(can => `
          <div class="canalizacion-item ${can.leido ? '' : 'no-leida'}">
            <div class="canalizacion-fecha">${new Date(can.fecha).toLocaleDateString('es-ES')}</div>
            <div class="canalizacion-mensaje">${can.mensaje}</div>
          </div>
        `).join('')
      : '<p class="texto-vacio">No hay canalizaciones aún.</p>';
    
    // Generar HTML de diario
    const diarioHTML = diario.length > 0
      ? diario.map(entrada => `
          <div class="diario-item">
            <div class="diario-fecha">${new Date(entrada.fecha).toLocaleDateString('es-ES')}</div>
            <div class="diario-contenido">${entrada.contenido || ''}</div>
          </div>
        `).join('')
      : '<p class="texto-vacio">No hay entradas en tu diario aún.</p>';
    
    // Función helper para escapar HTML
    function escapeHtml(text) {
      if (!text) return '';
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    // Función helper para escapar para atributos JavaScript
    function escapeJs(text) {
      if (!text) return '';
      return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
    }
    
    // Deshabilitar acciones si está pausada
    const deshabilitadoAttr = suscripcionPausada ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : '';
    
    // Generar HTML de lista de lugares
    const lugaresHTML = lugares.length > 0
      ? lugares.map(l => {
          const nombreEscapado = escapeJs(l.nombre || '');
          const descripcionEscapada = escapeJs(l.descripcion || '');
          return `
          <div class="item-lista ${l.activo ? 'activo' : 'inactivo'}" data-id="${l.id}">
            <div class="item-header">
              <strong>${escapeHtml(l.nombre || 'Sin nombre')}</strong>
              ${l.activo 
                ? '<span class="badge-activo">✓ Activo - Aparece en Lugares Activados</span>' 
                : '<span class="badge-inactivo">⚠️ No activado - Actívalo para que aparezca en Lugares Activados</span>'}
            </div>
            <div class="item-descripcion">${escapeHtml(l.descripcion || 'Sin descripción')}</div>
            <div class="item-acciones">
              ${!l.activo 
                ? `<button onclick="activarLugar(${l.id})" class="btn-activar destacado" ${deshabilitadoAttr} title="Activar este lugar para que aparezca en la tabla de Lugares Activados">
                    ⭐ Activar Lugar
                  </button>` 
                : `<button onclick="desactivarLugar(${l.id})" class="btn-desactivar" ${deshabilitadoAttr} title="Desactivar este lugar">
                    Desactivar
                  </button>`}
              <button onclick="editarLugar(${l.id}, '${nombreEscapado}', '${descripcionEscapada}')" class="btn-editar" ${deshabilitadoAttr}>Editar</button>
              <button onclick="eliminarLugar(${l.id})" class="btn-eliminar" ${deshabilitadoAttr}>Eliminar</button>
            </div>
          </div>
        `;
        }).join('')
      : '<p class="texto-vacio">No has creado ningún lugar aún. Crea uno nuevo abajo.</p>';
    
    // Generar HTML de lista de proyectos
    const proyectosHTML = proyectos.length > 0
      ? proyectos.map(p => {
          const nombreEscapado = escapeJs(p.nombre || '');
          const descripcionEscapada = escapeJs(p.descripcion || '');
          return `
          <div class="item-lista ${p.activo ? 'activo' : ''}" data-id="${p.id}">
            <div class="item-header">
              <strong>${escapeHtml(p.nombre || 'Sin nombre')}</strong>
              ${p.activo ? '<span class="badge-activo">✓ Activo</span>' : ''}
            </div>
            <div class="item-descripcion">${escapeHtml(p.descripcion || 'Sin descripción')}</div>
            <div class="item-acciones">
              ${!p.activo ? `<button onclick="activarProyecto(${p.id})" class="btn-activar" ${deshabilitadoAttr}>Activar</button>` : ''}
              <button onclick="editarProyecto(${p.id}, '${nombreEscapado}', '${descripcionEscapada}')" class="btn-editar" ${deshabilitadoAttr}>Editar</button>
              <button onclick="eliminarProyecto(${p.id})" class="btn-eliminar" ${deshabilitadoAttr}>Eliminar</button>
            </div>
          </div>
        `;
        }).join('')
      : '<p class="texto-vacio">No has creado ningún proyecto aún. Crea uno nuevo abajo.</p>';
    
    // Generar HTML de apadrinados (solo lectura, sin información de limpieza)
    const apadrinadosHTML = apadrinados.length > 0
      ? apadrinados.map(a => {
          return `
          <div class="item-lista apadrinado-item">
            <div class="item-header">
              <strong>${escapeHtml(a.nombre || 'Sin nombre')}</strong>
            </div>
            <div class="item-descripcion">${escapeHtml(a.descripcion || 'Sin descripción')}</div>
          </div>
        `;
        }).join('')
      : '<p class="texto-vacio">No tienes apadrinados registrados. Los apadrinados se gestionan desde el panel de administración.</p>';
    
    // Generar HTML de limpiezas al día
    const limpiezasAlDiaHTML = limpiezasAlDia.length > 0
      ? limpiezasAlDia.map(limpieza => {
          const fechaLimpieza = limpieza.ultima_limpieza 
            ? new Date(limpieza.ultima_limpieza).toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })
            : 'Sin fecha';
          const vecesLimpiado = limpieza.veces_limpiado || 0;
          const frecuenciaDias = limpieza.frecuencia_dias || 14;
          
          // Icono según el tipo
          let icono = '✨';
          if (limpieza.tipo === 'energetico') icono = '⚡';
          else if (limpieza.tipo === 'karmico') icono = '🔄';
          else if (limpieza.tipo === 'indeseable') icono = '🧹';
          else if (limpieza.tipo === 'hogar') icono = '🏠';
          
          return `
          <div class="item-lista limpieza-item">
            <div class="item-header">
              <strong>${icono} ${escapeHtml(limpieza.aspecto_nombre || 'Sin nombre')}</strong>
              <span class="badge-info">${escapeHtml(limpieza.seccion || '')}</span>
            </div>
            <div class="item-descripcion">
              <p><strong>Última limpieza:</strong> ${fechaLimpieza}</p>
              <p><strong>Veces limpiado:</strong> ${vecesLimpiado}</p>
              <p><strong>Frecuencia:</strong> Cada ${frecuenciaDias} días</p>
            </div>
          </div>
        `;
        }).join('')
      : '<p class="texto-vacio">No tienes aspectos marcados como limpios en este momento.</p>';
    
    // Generar HTML de transmutaciones energéticas (solo visualización)
    function generarTransmutacionesHTML(transmutaciones) {
      if (!transmutaciones || transmutaciones.length === 0) {
        return '<p class="texto-vacio">No tienes aspectos energéticos limpios en este momento.</p>';
      }
      
      return transmutaciones.map(item => {
        const fechaLimpieza = item.ultima_limpieza 
          ? new Date(item.ultima_limpieza).toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })
          : 'Sin limpiar aún';
        
        const frecuencia = item.frecuencia_dias ? `Cada ${item.frecuencia_dias} días` : '';
        const veces = item.veces_limpiar ? `Veces completadas: ${item.veces_completadas || 0} de ${item.veces_limpiar}` : '';
        
        return `
          <div class="item-lista transmutacion-item">
            <div class="item-header">
              <strong>🔮 ${escapeHtml(item.nombre || 'Sin nombre')}</strong>
              <span class="badge-info">Nivel ${item.nivel}</span>
            </div>
            <div class="item-descripcion">
              ${item.descripcion ? `<p>${escapeHtml(item.descripcion)}</p>` : ''}
              <p><strong>Última limpieza:</strong> ${fechaLimpieza}</p>
              ${frecuencia ? `<p><strong>Frecuencia:</strong> ${frecuencia}</p>` : ''}
              ${veces ? `<p><strong>${veces}</strong></p>` : ''}
              ${item.lista_nombre ? `<p style="font-size: 0.9rem; color: #8a6b00; margin-top: 8px;"><em>Lista: ${escapeHtml(item.lista_nombre)}</em></p>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
    
    const transmutacionesHTML = generarTransmutacionesHTML(transmutacionesVerdes || []);
    
    // Mensaje de suscripción pausada
    const mensajePausada = suscripcionPausada 
      ? '<div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 30px; text-align: center;"><h2 style="color: #92400e; font-size: 1.5rem; margin-bottom: 10px;">⏸️ Tu suscripción está pausada</h2><p style="color: #78350f; font-size: 1.1rem;">No puedes realizar acciones hasta que se reactive tu suscripción.</p></div>'
      : '';
    
    // Preparar opciones de tema para el selector
    const temaLightSelected = temaPreferido === 'light' ? 'selected' : '';
    const temaDarkSelected = temaPreferido === 'dark' ? 'selected' : '';
    
    console.log(`🎨 Perfil-personal: Tema preferido: ${temaPreferido}, Light selected: ${temaLightSelected}, Dark selected: ${temaDarkSelected}`);
    
    // Renderizar plantilla
    let html = replace(template, {
      NOMBRE: nombre,
      NIVEL: nivel,
      FASE: fase,
      NOTAS_HTML: notasHTML,
      CANALIZACIONES_HTML: canalizacionesHTML,
      DIARIO_HTML: diarioHTML,
      LUGARES_HTML: lugaresHTML,
      PROYECTOS_HTML: proyectosHTML,
      APADRINADOS_HTML: apadrinadosHTML,
      LIMPIEZAS_AL_DIA_HTML: limpiezasAlDiaHTML,
      TRANSMUTACIONES_HTML: transmutacionesHTML,
      MENSAJE_PAUSADA: mensajePausada,
      DESHABILITADO_ATTR: deshabilitadoAttr,
      TONOS_HTML: tonosHTML,
      TEMA_PREFERIDO: temaPreferido,
      TEMA_LIGHT_SELECTED: temaLightSelected,
      TEMA_DARK_SELECTED: temaDarkSelected
    });
    
    // El data-theme ya está en el template, solo asegurar que el placeholder se reemplazó
    // Si por alguna razón no se reemplazó, añadirlo manualmente
    if (html.includes('{{TEMA_PREFERIDO}}')) {
      console.warn('⚠️  Perfil-personal: El placeholder TEMA_PREFERIDO no se reemplazó, corrigiendo manualmente');
      html = html.replace(/data-theme="{{TEMA_PREFERIDO}}"/g, `data-theme="${temaPreferido}"`);
    }
    
    // Verificar que los otros placeholders también se reemplazaron
    if (html.includes('{{TEMA_LIGHT_SELECTED}}') || html.includes('{{TEMA_DARK_SELECTED}}')) {
      console.warn('⚠️  Perfil-personal: Los placeholders de tema no se reemplazaron completamente');
      html = html.replace(/{{TEMA_LIGHT_SELECTED}}/g, temaLightSelected);
      html = html.replace(/{{TEMA_DARK_SELECTED}}/g, temaDarkSelected);
    }
    
    // Usar renderHtml centralizado (aplica tema y headers anti-cache automáticamente)
    // Convertir alumno a formato student (solo necesita tema_preferido)
    const student = {
      tema_preferido: temaPreferido
    };
    return renderHtml(html, { student });
    
  } catch (error) {
    console.error('❌ Error en perfilPersonalHandler:', error);
    console.error('Stack trace:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Mensaje de error más informativo pero seguro
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `${error.message} (${error.name})` 
      : 'Ha ocurrido un error al cargar tu perfil. Por favor, intenta de nuevo más tarde.';
    
    // Escapar el mensaje de error para evitar XSS
    const escapedMessage = errorMessage
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: sans-serif; text-align: center; padding: 50px; background: #faf7f2;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
    <h1 style="color: #d32f2f; margin-bottom: 20px;">❌ Error</h1>
    <p style="color: #555; margin-bottom: 30px; line-height: 1.6;">${escapedMessage}</p>
    <a href="/enter" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #ffd86b, #ffcd4a); color: #333; text-decoration: none; border-radius: 8px; font-weight: 600;">Volver al inicio</a>
  </div>
</body>
</html>`;
    return renderHtml(errorHtml, { status: 500 });
  }
}

