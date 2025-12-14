// src/services/transmutaciones-proyectos.js
// Servicio para gestión de proyectos a iluminar

import { query } from '../../database/pg.js';

/**
 * Asegura que la tabla limpiezas_master_historial existe
 */
async function asegurarTablaHistorial() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS limpiezas_master_historial (
        id SERIAL PRIMARY KEY,
        alumno_id INT,
        tipo VARCHAR(50) NOT NULL,
        aspecto_id INT NOT NULL,
        aspecto_nombre VARCHAR(500),
        seccion VARCHAR(100),
        fecha_limpieza TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_alumno ON limpiezas_master_historial(alumno_id)`).catch(() => {});
    await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_fecha ON limpiezas_master_historial(fecha_limpieza)`).catch(() => {});
    await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_tipo ON limpiezas_master_historial(tipo)`).catch(() => {});
  } catch (err) {
    // Ignorar errores de creación (puede que ya exista o haya problema de permisos)
  }
}

export async function listarProyectosGlobales() {
  try {
    const result = await query(`
      SELECT 
        tp.*,
        tp.alumno_id as proyecto_alumno_id,
        a_propietario.id as propietario_id,
        a_propietario.nombre_completo as propietario_nombre,
        a_propietario.apodo as propietario_apodo,
        a_propietario.email as propietario_email,
        a_estado.id as alumno_id,
        a_estado.nombre_completo as alumno_nombre,
        a_estado.apodo as alumno_apodo,
        a_estado.email as alumno_email,
        tpe.ultima_limpieza,
        CASE
          WHEN tpe.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT <= tp.frecuencia_dias THEN 'limpio'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT <= 15 THEN 'pendiente'
          ELSE 'olvidado'
        END as estado_calculado
      FROM transmutaciones_proyectos tp
      LEFT JOIN alumnos a_propietario ON tp.alumno_id = a_propietario.id
      LEFT JOIN transmutaciones_proyectos_estado tpe ON tp.id = tpe.proyecto_id
      LEFT JOIN alumnos a_estado ON tpe.alumno_id = a_estado.id
      WHERE tp.activo = true
      ORDER BY tp.nombre ASC, a_propietario.nombre_completo ASC, a_propietario.apodo ASC
    `).catch(async (err) => {
      // Si la tabla no existe, intentar crearla
      if (err.message && err.message.includes('does not exist')) {
        console.log('⚠️ Tabla transmutaciones_proyectos no existe, creándola...');
        try {
          await query(`
            CREATE TABLE IF NOT EXISTS transmutaciones_proyectos (
              id SERIAL PRIMARY KEY,
              nombre VARCHAR(200) NOT NULL,
              descripcion TEXT,
              nivel_minimo INT DEFAULT 1,
              frecuencia_dias INT DEFAULT 30,
              prioridad VARCHAR(50) DEFAULT 'Normal',
              orden INT DEFAULT 0,
              activo BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_activo ON transmutaciones_proyectos(activo)`);
          await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_nivel ON transmutaciones_proyectos(nivel_minimo)`);
          
          await query(`
            CREATE TABLE IF NOT EXISTS transmutaciones_proyectos_estado (
              id SERIAL PRIMARY KEY,
              proyecto_id INT REFERENCES transmutaciones_proyectos(id) ON DELETE CASCADE,
              alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
              estado VARCHAR(50) DEFAULT 'pendiente',
              ultima_limpieza TIMESTAMP,
              veces_limpiado INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE (proyecto_id, alumno_id)
            )
          `);
          await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_estado_proyecto ON transmutaciones_proyectos_estado(proyecto_id)`);
          await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_estado_alumno ON transmutaciones_proyectos_estado(alumno_id)`);
          
          console.log('✅ Tablas de transmutaciones_proyectos creadas, reintentando consulta...');
          // Reintentar la consulta
          return query(`
            SELECT 
              tp.*,
              tp.alumno_id as proyecto_alumno_id,
              a_propietario.id as propietario_id,
              a_propietario.nombre_completo as propietario_nombre,
              a_propietario.apodo as propietario_apodo,
              a_propietario.email as propietario_email,
              NULL as alumno_id,
              NULL as alumno_nombre,
              NULL as alumno_apodo,
              NULL as alumno_email,
              NULL as ultima_limpieza,
              'pendiente' as estado_calculado
            FROM transmutaciones_proyectos tp
            LEFT JOIN alumnos a_propietario ON tp.alumno_id = a_propietario.id AND a_propietario.estado_suscripcion = 'activa'
            WHERE tp.activo = true
            ORDER BY tp.nombre ASC
          `);
        } catch (createError) {
          console.error('Error creando tablas de transmutaciones_proyectos:', createError);
          return { rows: [] };
        }
      }
      // Fallback sin joins si hay problemas
      return query(`
        SELECT 
          tp.*,
          tp.alumno_id as proyecto_alumno_id,
          a_propietario.id as propietario_id,
          a_propietario.nombre_completo as propietario_nombre,
          a_propietario.apodo as propietario_apodo,
          a_propietario.email as propietario_email,
          NULL as alumno_id,
          NULL as alumno_nombre,
          NULL as alumno_apodo,
          NULL as alumno_email,
          NULL as ultima_limpieza,
          'pendiente' as estado_calculado
        FROM transmutaciones_proyectos tp
        LEFT JOIN alumnos a_propietario ON tp.alumno_id = a_propietario.id AND a_propietario.estado_suscripcion = 'activa'
        WHERE tp.activo = true
        ORDER BY tp.nombre ASC
      `);
    });
    return result.rows || [];
  } catch (error) {
    console.error('Error listando proyectos globales:', error);
    return [];
  }
}

export async function crearProyectoRapido(nombre, nivel_minimo = 1, descripcion = null, frecuencia_dias = 30, prioridad = 'Normal', orden = 0, alumno_id = null) {
  try {
    const result = await query(`
      INSERT INTO transmutaciones_proyectos (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo, alumno_id)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING id
    `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, alumno_id]);
    return result.rows[0].id;
  } catch (error) {
    // Si la tabla no existe, intentar crearla
    if (error.message && error.message.includes('does not exist')) {
      console.log('⚠️ Tabla transmutaciones_proyectos no existe, creándola...');
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS transmutaciones_proyectos (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(200) NOT NULL,
            descripcion TEXT,
            nivel_minimo INT DEFAULT 1,
            frecuencia_dias INT DEFAULT 30,
            prioridad VARCHAR(50) DEFAULT 'Normal',
            orden INT DEFAULT 0,
            activo BOOLEAN DEFAULT TRUE,
            alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_activo ON transmutaciones_proyectos(activo)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_nivel ON transmutaciones_proyectos(nivel_minimo)`);
        
        await query(`
          CREATE TABLE IF NOT EXISTS transmutaciones_proyectos_estado (
            id SERIAL PRIMARY KEY,
            proyecto_id INT REFERENCES transmutaciones_proyectos(id) ON DELETE CASCADE,
            alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
            estado VARCHAR(50) DEFAULT 'pendiente',
            ultima_limpieza TIMESTAMP,
            veces_limpiado INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (proyecto_id, alumno_id)
          )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_estado_proyecto ON transmutaciones_proyectos_estado(proyecto_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_proyectos_estado_alumno ON transmutaciones_proyectos_estado(alumno_id)`);
        
        console.log('✅ Tablas de transmutaciones_proyectos creadas, reintentando inserción...');
        // Reintentar la inserción
        const result = await query(`
          INSERT INTO transmutaciones_proyectos (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo, alumno_id)
          VALUES ($1, $2, $3, $4, $5, $6, true, $7)
          RETURNING id
        `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, alumno_id]);
        return result.rows[0].id;
      } catch (createError) {
        console.error('Error creando tablas de transmutaciones_proyectos:', createError);
        throw createError;
      }
    }
    // Si el error es por columna alumno_id no existe, intentar agregarla
    if (error.message && error.message.includes('column "alumno_id" of relation "transmutaciones_proyectos" does not exist')) {
      console.log('⚠️ Columna alumno_id no existe en transmutaciones_proyectos, agregándola...');
      try {
        await query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'transmutaciones_proyectos' 
              AND column_name = 'alumno_id'
            ) THEN
              ALTER TABLE transmutaciones_proyectos 
              ADD COLUMN alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE;
            END IF;
          END $$;
        `);
        console.log('✅ Columna alumno_id agregada, reintentando inserción...');
        const result = await query(`
          INSERT INTO transmutaciones_proyectos (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo, alumno_id)
          VALUES ($1, $2, $3, $4, $5, $6, true, $7)
          RETURNING id
        `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, alumno_id]);
        return result.rows[0].id;
      } catch (alterError) {
        console.error('Error agregando columna alumno_id y reintentando inserción:', alterError);
        throw alterError;
      }
    }
    console.error('Error creando proyecto rápido:', error);
    throw error;
  }
}

export async function actualizarProyectoDetalle(proyectoId, datos) {
  try {
    const { nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, activo, orden } = datos;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (nombre !== undefined) { updates.push(`nombre = $${paramIndex++}`); params.push(nombre); }
    if (descripcion !== undefined) { updates.push(`descripcion = $${paramIndex++}`); params.push(descripcion); }
    if (nivel_minimo !== undefined) { updates.push(`nivel_minimo = $${paramIndex++}`); params.push(nivel_minimo); }
    if (frecuencia_dias !== undefined) { updates.push(`frecuencia_dias = $${paramIndex++}`); params.push(frecuencia_dias); }
    if (prioridad !== undefined) { updates.push(`prioridad = $${paramIndex++}`); params.push(prioridad); }
    if (activo !== undefined) { updates.push(`activo = $${paramIndex++}`); params.push(activo); }
    if (orden !== undefined) { updates.push(`orden = $${paramIndex++}`); params.push(orden); }

    if (updates.length === 0) return true;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(proyectoId);

    await query(`
      UPDATE transmutaciones_proyectos
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);
    return true;
  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    return false;
  }
}

export async function getProyectosAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT 
        tp.*,
        tpe.ultima_limpieza,
        tpe.veces_limpiado,
        tpe.estado,
        CASE
          WHEN tpe.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT
        END as dias_desde_limpieza
      FROM transmutaciones_proyectos tp
      LEFT JOIN transmutaciones_proyectos_estado tpe ON tp.id = tpe.proyecto_id AND tpe.alumno_id = $1
      WHERE tp.activo = true
        AND (COALESCE(tp.nivel_minimo, 1) <= (SELECT nivel_actual FROM alumnos WHERE id = $1 LIMIT 1))
        AND (tp.alumno_id IS NULL OR tp.alumno_id = $1)
      ORDER BY COALESCE(tp.nivel_minimo, 1) ASC, tp.orden ASC, tp.nombre ASC
    `, [alumnoId]).catch(err => {
      if (err.message.includes('nivel_minimo')) {
        return query(`
          SELECT 
            tp.*,
            1 as nivel_minimo,
            tpe.ultima_limpieza,
            tpe.veces_limpiado,
            tpe.estado,
            CASE
              WHEN tpe.ultima_limpieza IS NULL THEN NULL
              ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT
            END as dias_desde_limpieza
          FROM transmutaciones_proyectos tp
          LEFT JOIN transmutaciones_proyectos_estado tpe ON tp.id = tpe.proyecto_id AND tpe.alumno_id = $1
          WHERE tp.activo = true
            AND (tp.alumno_id IS NULL OR tp.alumno_id = $1)
          ORDER BY tp.orden ASC, tp.nombre ASC
        `, [alumnoId]);
      }
      throw err;
    });
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo proyectos del alumno:', error);
    return [];
  }
}

export async function getAlumnosPorProyecto(proyectoId) {
  try {
    const result = await query(`
      SELECT 
        a.id as alumno_id,
        a.email,
        a.apodo,
        a.nombre_completo,
        a.nivel_actual,
        tpe.ultima_limpieza,
        tpe.estado,
        tpe.veces_limpiado,
        tp.nombre as proyecto_nombre,
        tp.frecuencia_dias,
        CASE
          WHEN tpe.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT
        END as dias_desde_limpieza,
        CASE
          WHEN tpe.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT <= tp.frecuencia_dias THEN 'limpio'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT <= 15 THEN 'pendiente'
          ELSE 'olvidado'
        END as estado_calculado
      FROM alumnos a
      CROSS JOIN transmutaciones_proyectos tp
      LEFT JOIN transmutaciones_proyectos_estado tpe ON tpe.proyecto_id = tp.id AND tpe.alumno_id = a.id
      WHERE tp.id = $1
        AND a.estado_suscripcion = 'activa'
        AND (COALESCE(tp.nivel_minimo, 1) <= a.nivel_actual)
      ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
    `, [proyectoId]).catch(err => {
      if (err.message.includes('nivel_minimo')) {
        return query(`
          SELECT 
            a.id as alumno_id,
            a.email,
            a.apodo,
            a.nombre_completo,
            a.nivel_actual,
            tpe.ultima_limpieza,
            tpe.estado,
            tpe.veces_limpiado,
            tp.nombre as proyecto_nombre,
            tp.frecuencia_dias,
            CASE
              WHEN tpe.ultima_limpieza IS NULL THEN NULL
              ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT
            END as dias_desde_limpieza,
            CASE
              WHEN tpe.ultima_limpieza IS NULL THEN 'pendiente'
              WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT <= tp.frecuencia_dias THEN 'limpio'
              WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tpe.ultima_limpieza))::INT <= 15 THEN 'pendiente'
              ELSE 'olvidado'
            END as estado_calculado
          FROM alumnos a
          CROSS JOIN transmutaciones_proyectos tp
          LEFT JOIN transmutaciones_proyectos_estado tpe ON tpe.proyecto_id = tp.id AND tpe.alumno_id = a.id
          WHERE tp.id = $1
            AND a.estado_suscripcion = 'activa'
          ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
        `, [proyectoId]);
      }
      throw err;
    });
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo alumnos por proyecto:', error);
    return [];
  }
}

/**
 * Marca todos los alumnos activos de un proyecto específico como limpios
 */
export async function marcarTodosAlumnosLimpiosPorProyecto(proyectoId) {
  try {
    // Obtener el nombre del proyecto para el historial
    const proyectoResult = await query('SELECT nombre FROM transmutaciones_proyectos WHERE id = $1', [proyectoId]);
    const proyectoNombre = proyectoResult.rows[0]?.nombre || null;
    const seccion = 'Transmutaciones PDE - Proyectos';
    
    // Obtener todos los alumnos activos que pueden ver este proyecto
    const alumnos = await query(`
      SELECT DISTINCT a.id
      FROM alumnos a
      CROSS JOIN transmutaciones_proyectos tp
      WHERE tp.id = $1
        AND a.estado_suscripcion = 'activa'
        AND (COALESCE(tp.nivel_minimo, 1) <= a.nivel_actual)
        AND (tp.alumno_id IS NULL OR tp.alumno_id = a.id)
    `, [proyectoId]).catch(err => {
      if (err.message.includes('nivel_minimo')) {
        return query(`
          SELECT DISTINCT a.id
          FROM alumnos a
          CROSS JOIN transmutaciones_proyectos tp
          WHERE tp.id = $1
            AND a.estado_suscripcion = 'activa'
            AND (tp.alumno_id IS NULL OR tp.alumno_id = a.id)
        `, [proyectoId]);
      }
      throw err;
    });
    
    const ahora = new Date();
    let marcados = 0;
    
    // Obtener frecuencia del proyecto
    const proyecto = await query(`SELECT frecuencia_dias FROM transmutaciones_proyectos WHERE id = $1`, [proyectoId]);
    const frecuenciaDias = proyecto.rows[0]?.frecuencia_dias || 14;
    
    for (const alumno of alumnos.rows) {
      // Verificar si existe el registro
      const existe = await query(
        `SELECT id FROM transmutaciones_proyectos_estado WHERE alumno_id = $1 AND proyecto_id = $2`,
        [alumno.id, proyectoId]
      );
      
      if (existe.rows.length > 0) {
        // Actualizar registro existente
        await query(
          `UPDATE transmutaciones_proyectos_estado 
           SET estado = 'limpio', 
               ultima_limpieza = $1,
               veces_limpiado = COALESCE(veces_limpiado, 0) + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE alumno_id = $2 AND proyecto_id = $3`,
          [ahora, alumno.id, proyectoId]
        ).catch(() => {
          return query(
            `UPDATE transmutaciones_proyectos_estado 
             SET estado = 'limpio', 
                 ultima_limpieza = $1
             WHERE alumno_id = $2 AND proyecto_id = $3`,
            [ahora, alumno.id, proyectoId]
          );
        });
      } else {
        // Crear nuevo registro
        await query(
          `INSERT INTO transmutaciones_proyectos_estado (alumno_id, proyecto_id, estado, ultima_limpieza, veces_limpiado)
           VALUES ($1, $2, 'limpio', $3, 1)`,
          [alumno.id, proyectoId, ahora]
        ).catch(() => {
          return query(
            `INSERT INTO transmutaciones_proyectos_estado (alumno_id, proyecto_id, estado, ultima_limpieza)
             VALUES ($1, $2, 'limpio', $3)`,
            [alumno.id, proyectoId, ahora]
          );
        });
      }
      
      // Registrar en el historial de limpiezas del master
      try {
        await asegurarTablaHistorial();
        await query(
          `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [alumno.id, 'proyectos', proyectoId, proyectoNombre, seccion, ahora]
        );
      } catch (histError) {
        console.warn('⚠️ Error registrando en historial de limpiezas:', histError.message);
      }
      
      marcados++;
    }
    
    return { success: true, marcados };
  } catch (error) {
    console.error('Error marcando todos los alumnos limpios por proyecto:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Marca todos los proyectos de un alumno como limpios
 */
export async function marcarTodosProyectosLimpios(alumnoId) {
  try {
    // Obtener todos los proyectos activos que el alumno puede ver
    const proyectos = await query(`
      SELECT tp.id, tp.nombre
      FROM transmutaciones_proyectos tp
      WHERE tp.activo = true
        AND (COALESCE(tp.nivel_minimo, 1) <= (SELECT nivel_actual FROM alumnos WHERE id = $1 LIMIT 1))
    `, [alumnoId]);
    
    const ahora = new Date();
    let marcados = 0;
    
    for (const proyecto of proyectos.rows) {
      // Verificar si existe el registro
      const existe = await query(
        `SELECT id FROM transmutaciones_proyectos_estado WHERE alumno_id = $1 AND proyecto_id = $2`,
        [alumnoId, proyecto.id]
      );
      
      if (existe.rows.length > 0) {
        // Actualizar registro existente
        await query(
          `UPDATE transmutaciones_proyectos_estado 
           SET estado = 'limpio', 
               ultima_limpieza = $1,
               veces_limpiado = COALESCE(veces_limpiado, 0) + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE alumno_id = $2 AND proyecto_id = $3`,
          [ahora, alumnoId, proyecto.id]
        ).catch(() => {
          // Si alguna columna no existe, actualizar sin ella
          query(
            `UPDATE transmutaciones_proyectos_estado 
             SET estado = 'limpio', 
                 ultima_limpieza = $1
             WHERE alumno_id = $2 AND proyecto_id = $3`,
            [ahora, alumnoId, proyecto.id]
          );
        });
        
        // Registrar en el historial de limpiezas del master
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [alumnoId, 'proyectos', proyecto.id, proyecto.nombre, 'Transmutaciones PDE - Proyectos', ahora]
          );
        } catch (histError) {
          console.warn('⚠️ Error registrando en historial de limpiezas:', histError.message);
        }
        
        marcados++;
      } else {
        // Crear nuevo registro
        await query(
          `INSERT INTO transmutaciones_proyectos_estado (alumno_id, proyecto_id, estado, ultima_limpieza, veces_limpiado)
           VALUES ($1, $2, 'limpio', $3, 1)`,
          [alumnoId, proyecto.id, ahora]
        ).catch(() => {
          // Si veces_limpiado no existe, crear sin ella
          query(
            `INSERT INTO transmutaciones_proyectos_estado (alumno_id, proyecto_id, estado, ultima_limpieza)
             VALUES ($1, $2, 'limpio', $3)`,
            [alumnoId, proyecto.id, ahora]
          );
        });
        
        // Registrar en el historial de limpiezas del master
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [alumnoId, 'proyectos', proyecto.id, proyecto.nombre, 'Transmutaciones PDE - Proyectos', ahora]
          );
        } catch (histError) {
          console.warn('⚠️ Error registrando en historial de limpiezas:', histError.message);
        }
        
        marcados++;
      }
    }
    
    return { success: true, marcados };
  } catch (error) {
    console.error('Error marcando todos los proyectos como limpios:', error);
    throw error;
  }
}

