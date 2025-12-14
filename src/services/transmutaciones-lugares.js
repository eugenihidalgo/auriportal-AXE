// src/services/transmutaciones-lugares.js
// Servicio para gestión de lugares a iluminar

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

/**
 * Lista todos los lugares globales
 */
export async function listarLugaresGlobales() {
  try {
    const result = await query(`
      SELECT 
        tl.*,
        a.id as alumno_id,
        a.nombre_completo as alumno_nombre,
        a.apodo as alumno_apodo,
        a.email as alumno_email,
        tle.ultima_limpieza,
        CASE
          WHEN tle.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT <= tl.frecuencia_dias THEN 'limpio'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT <= 15 THEN 'pendiente'
          ELSE 'olvidado'
        END as estado_calculado
      FROM transmutaciones_lugares tl
      LEFT JOIN transmutaciones_lugares_estado tle ON tl.id = tle.lugar_id
      LEFT JOIN alumnos a ON tle.alumno_id = a.id AND a.estado_suscripcion = 'activa'
      WHERE tl.activo = true
      ORDER BY tl.nombre ASC, a.nombre_completo ASC, a.apodo ASC
    `).catch(err => {
      if (err.message.includes('does not exist')) {
        return { rows: [] };
      }
      // Fallback sin joins si hay problemas
      return query(`
        SELECT 
          tl.*,
          NULL as alumno_id,
          NULL as alumno_nombre,
          NULL as alumno_apodo,
          NULL as alumno_email,
          NULL as ultima_limpieza,
          'pendiente' as estado_calculado
        FROM transmutaciones_lugares tl
        WHERE tl.activo = true
        ORDER BY tl.nombre ASC
      `);
    });
    return result.rows;
  } catch (error) {
    console.error('Error listando lugares globales:', error);
    return [];
  }
}

/**
 * Verifica si una columna existe en una tabla
 */
async function columnaExiste(nombreTabla, nombreColumna) {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = $2
      ) AS exists
    `, [nombreTabla, nombreColumna]);
    return result.rows[0]?.exists || false;
  } catch (error) {
    console.error(`❌ Error verificando existencia de columna ${nombreTabla}.${nombreColumna}:`, error.message);
    return false;
  }
}

/**
 * Crea un lugar rápidamente
 */
export async function crearLugarRapido(nombre, nivel_minimo = 1, descripcion = null, frecuencia_dias = 30, prioridad = 'Normal', orden = 0, alumno_id = null) {
  try {
    // Verificar si la columna alumno_id existe
    const tieneAlumnoId = await columnaExiste('transmutaciones_lugares', 'alumno_id');
    
    if (tieneAlumnoId) {
      // Si la columna existe, usar la inserción completa
      const result = await query(`
        INSERT INTO transmutaciones_lugares (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo, alumno_id)
        VALUES ($1, $2, $3, $4, $5, $6, true, $7)
        RETURNING id
      `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, alumno_id]);
      return result.rows[0].id;
    } else {
      // Si la columna no existe, hacer inserción sin ella
      console.log('⚠️ Columna alumno_id no existe en transmutaciones_lugares, creando lugar sin alumno_id');
      const result = await query(`
        INSERT INTO transmutaciones_lugares (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id
      `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden]);
      return result.rows[0].id;
    }
  } catch (error) {
    // Si la tabla no existe, intentar crearla
    if (error.message && error.message.includes('does not exist') && error.message.includes('relation')) {
      console.log('⚠️ Tabla transmutaciones_lugares no existe, creándola...');
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS transmutaciones_lugares (
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
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_activo ON transmutaciones_lugares(activo)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_nivel ON transmutaciones_lugares(nivel_minimo)`);
        
        // Intentar agregar alumno_id si es posible
        try {
          await query(`
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'transmutaciones_lugares' 
                AND column_name = 'alumno_id'
              ) THEN
                ALTER TABLE transmutaciones_lugares 
                ADD COLUMN alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE;
              END IF;
            END $$;
          `);
        } catch (alterErr) {
          console.warn('⚠️ No se pudo agregar columna alumno_id (puede ser por permisos):', alterErr.message);
        }
        
        await query(`
          CREATE TABLE IF NOT EXISTS transmutaciones_lugares_estado (
            id SERIAL PRIMARY KEY,
            lugar_id INT REFERENCES transmutaciones_lugares(id) ON DELETE CASCADE,
            alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
            estado VARCHAR(50) DEFAULT 'pendiente',
            ultima_limpieza TIMESTAMP,
            veces_limpiado INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (lugar_id, alumno_id)
          )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_estado_lugar ON transmutaciones_lugares_estado(lugar_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_lugares_estado_alumno ON transmutaciones_lugares_estado(alumno_id)`);
        
        console.log('✅ Tablas de transmutaciones_lugares creadas, reintentando inserción...');
        // Reintentar la inserción
        const tieneAlumnoIdDespues = await columnaExiste('transmutaciones_lugares', 'alumno_id');
        if (tieneAlumnoIdDespues) {
          const result = await query(`
            INSERT INTO transmutaciones_lugares (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo, alumno_id)
            VALUES ($1, $2, $3, $4, $5, $6, true, $7)
            RETURNING id
          `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, alumno_id]);
          return result.rows[0].id;
        } else {
          const result = await query(`
            INSERT INTO transmutaciones_lugares (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo)
            VALUES ($1, $2, $3, $4, $5, $6, true)
            RETURNING id
          `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden]);
          return result.rows[0].id;
        }
      } catch (createError) {
        console.error('Error creando tablas de transmutaciones_lugares:', createError);
        throw createError;
      }
    }
    // Si el error es por columna alumno_id no existe, hacer inserción sin ella
    if (error.message && error.message.includes('column "alumno_id" of relation "transmutaciones_lugares" does not exist')) {
      console.log('⚠️ Columna alumno_id no existe en transmutaciones_lugares, creando lugar sin alumno_id');
      try {
        const result = await query(`
          INSERT INTO transmutaciones_lugares (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo)
          VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING id
        `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden]);
        return result.rows[0].id;
      } catch (insertError) {
        console.error('Error insertando lugar sin alumno_id:', insertError);
        throw insertError;
      }
    }
    console.error('Error creando lugar rápido:', error);
    throw error;
  }
}

/**
 * Actualiza detalles de un lugar
 */
export async function actualizarLugarDetalle(lugarId, datos) {
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
    params.push(lugarId);

    await query(`
      UPDATE transmutaciones_lugares
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);
    return true;
  } catch (error) {
    console.error('Error actualizando lugar:', error);
    return false;
  }
}

/**
 * Obtiene lugares de un alumno
 */
export async function getLugaresAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT 
        tl.*,
        tle.ultima_limpieza,
        tle.veces_limpiado,
        tle.estado,
        CASE
          WHEN tle.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT
        END as dias_desde_limpieza
      FROM transmutaciones_lugares tl
      LEFT JOIN transmutaciones_lugares_estado tle ON tl.id = tle.lugar_id AND tle.alumno_id = $1
      WHERE tl.activo = true
        AND (COALESCE(tl.nivel_minimo, 1) <= (SELECT nivel_actual FROM alumnos WHERE id = $1 LIMIT 1))
        AND (tl.alumno_id IS NULL OR tl.alumno_id = $1)
      ORDER BY COALESCE(tl.nivel_minimo, 1) ASC, tl.orden ASC, tl.nombre ASC
    `, [alumnoId]).catch(err => {
      if (err.message.includes('nivel_minimo')) {
        return query(`
          SELECT 
            tl.*,
            1 as nivel_minimo,
            tle.ultima_limpieza,
            tle.veces_limpiado,
            tle.estado,
            CASE
              WHEN tle.ultima_limpieza IS NULL THEN NULL
              ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT
            END as dias_desde_limpieza
          FROM transmutaciones_lugares tl
          LEFT JOIN transmutaciones_lugares_estado tle ON tl.id = tle.lugar_id AND tle.alumno_id = $1
          WHERE tl.activo = true
            AND (tl.alumno_id IS NULL OR tl.alumno_id = $1)
          ORDER BY tl.orden ASC, tl.nombre ASC
        `, [alumnoId]);
      }
      throw err;
    });
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo lugares del alumno:', error);
    return [];
  }
}

/**
 * Obtiene todos los alumnos que tienen un lugar específico con su estado
 */
export async function getAlumnosPorLugar(lugarId) {
  try {
    const result = await query(`
      SELECT 
        a.id as alumno_id,
        a.email,
        a.apodo,
        a.nombre_completo,
        a.nivel_actual,
        tle.ultima_limpieza,
        tle.estado,
        tle.veces_limpiado,
        tl.nombre as lugar_nombre,
        tl.frecuencia_dias,
        CASE
          WHEN tle.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT
        END as dias_desde_limpieza,
        CASE
          WHEN tle.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT <= tl.frecuencia_dias THEN 'limpio'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT <= 15 THEN 'pendiente'
          ELSE 'olvidado'
        END as estado_calculado
      FROM alumnos a
      CROSS JOIN transmutaciones_lugares tl
      LEFT JOIN transmutaciones_lugares_estado tle ON tle.lugar_id = tl.id AND tle.alumno_id = a.id
      WHERE tl.id = $1
        AND a.estado_suscripcion = 'activa'
        AND (COALESCE(tl.nivel_minimo, 1) <= a.nivel_actual)
      ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
    `, [lugarId]).catch(err => {
      if (err.message.includes('nivel_minimo')) {
        return query(`
          SELECT 
            a.id as alumno_id,
            a.email,
            a.apodo,
            a.nombre_completo,
            a.nivel_actual,
            tle.ultima_limpieza,
            tle.estado,
            tle.veces_limpiado,
            tl.nombre as lugar_nombre,
            tl.frecuencia_dias,
            CASE
              WHEN tle.ultima_limpieza IS NULL THEN NULL
              ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT
            END as dias_desde_limpieza,
            CASE
              WHEN tle.ultima_limpieza IS NULL THEN 'pendiente'
              WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT <= tl.frecuencia_dias THEN 'limpio'
              WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tle.ultima_limpieza))::INT <= 15 THEN 'pendiente'
              ELSE 'olvidado'
            END as estado_calculado
          FROM alumnos a
          CROSS JOIN transmutaciones_lugares tl
          LEFT JOIN transmutaciones_lugares_estado tle ON tle.lugar_id = tl.id AND tle.alumno_id = a.id
          WHERE tl.id = $1
            AND a.estado_suscripcion = 'activa'
          ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
        `, [lugarId]);
      }
      throw err;
    });
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo alumnos por lugar:', error);
    return [];
  }
}

/**
 * Marca todos los alumnos activos de un lugar específico como limpios
 */
export async function marcarTodosAlumnosLimpiosPorLugar(lugarId) {
  try {
    // Obtener el nombre del lugar para el historial
    const lugarResult = await query('SELECT nombre FROM transmutaciones_lugares WHERE id = $1', [lugarId]);
    const lugarNombre = lugarResult.rows[0]?.nombre || null;
    const seccion = 'Transmutaciones PDE - Lugares';
    
    // Obtener todos los alumnos activos que pueden ver este lugar
    const alumnos = await query(`
      SELECT DISTINCT a.id
      FROM alumnos a
      CROSS JOIN transmutaciones_lugares tl
      WHERE tl.id = $1
        AND a.estado_suscripcion = 'activa'
        AND (COALESCE(tl.nivel_minimo, 1) <= a.nivel_actual)
        AND (tl.alumno_id IS NULL OR tl.alumno_id = a.id)
    `, [lugarId]).catch(err => {
      if (err.message.includes('nivel_minimo')) {
        return query(`
          SELECT DISTINCT a.id
          FROM alumnos a
          CROSS JOIN transmutaciones_lugares tl
          WHERE tl.id = $1
            AND a.estado_suscripcion = 'activa'
            AND (tl.alumno_id IS NULL OR tl.alumno_id = a.id)
        `, [lugarId]);
      }
      throw err;
    });
    
    const ahora = new Date();
    let marcados = 0;
    
    // Obtener frecuencia del lugar
    const lugar = await query(`SELECT frecuencia_dias FROM transmutaciones_lugares WHERE id = $1`, [lugarId]);
    const frecuenciaDias = lugar.rows[0]?.frecuencia_dias || 14;
    
    for (const alumno of alumnos.rows) {
      // Verificar si existe el registro
      const existe = await query(
        `SELECT id FROM transmutaciones_lugares_estado WHERE alumno_id = $1 AND lugar_id = $2`,
        [alumno.id, lugarId]
      );
      
      if (existe.rows.length > 0) {
        // Actualizar registro existente
        await query(
          `UPDATE transmutaciones_lugares_estado 
           SET estado = 'limpio', 
               ultima_limpieza = $1,
               veces_limpiado = COALESCE(veces_limpiado, 0) + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE alumno_id = $2 AND lugar_id = $3`,
          [ahora, alumno.id, lugarId]
        ).catch(() => {
          return query(
            `UPDATE transmutaciones_lugares_estado 
             SET estado = 'limpio', 
                 ultima_limpieza = $1
             WHERE alumno_id = $2 AND lugar_id = $3`,
            [ahora, alumno.id, lugarId]
          );
        });
      } else {
        // Crear nuevo registro
        await query(
          `INSERT INTO transmutaciones_lugares_estado (alumno_id, lugar_id, estado, ultima_limpieza, veces_limpiado)
           VALUES ($1, $2, 'limpio', $3, 1)`,
          [alumno.id, lugarId, ahora]
        ).catch(() => {
          return query(
            `INSERT INTO transmutaciones_lugares_estado (alumno_id, lugar_id, estado, ultima_limpieza)
             VALUES ($1, $2, 'limpio', $3)`,
            [alumno.id, lugarId, ahora]
          );
        });
      }
      
      // Registrar en el historial de limpiezas del master
      try {
        await asegurarTablaHistorial();
        await query(
          `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [alumno.id, 'lugares', lugarId, lugarNombre, seccion, ahora]
        );
      } catch (histError) {
        console.warn('⚠️ Error registrando en historial de limpiezas:', histError.message);
      }
      
      marcados++;
    }
    
    return { success: true, marcados };
  } catch (error) {
    console.error('Error marcando todos los alumnos limpios por lugar:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Marca todos los lugares de un alumno como limpios
 */
export async function marcarTodosLugaresLimpios(alumnoId) {
  try {
    // Obtener todos los lugares activos que el alumno puede ver
    const lugares = await query(`
      SELECT tl.id, tl.nombre
      FROM transmutaciones_lugares tl
      WHERE tl.activo = true
        AND (COALESCE(tl.nivel_minimo, 1) <= (SELECT nivel_actual FROM alumnos WHERE id = $1 LIMIT 1))
    `, [alumnoId]);
    
    const ahora = new Date();
    let marcados = 0;
    
    for (const lugar of lugares.rows) {
      // Verificar si existe el registro
      const existe = await query(
        `SELECT id FROM transmutaciones_lugares_estado WHERE alumno_id = $1 AND lugar_id = $2`,
        [alumnoId, lugar.id]
      );
      
      if (existe.rows.length > 0) {
        // Actualizar registro existente
        await query(
          `UPDATE transmutaciones_lugares_estado 
           SET estado = 'limpio', 
               ultima_limpieza = $1,
               veces_limpiado = COALESCE(veces_limpiado, 0) + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE alumno_id = $2 AND lugar_id = $3`,
          [ahora, alumnoId, lugar.id]
        ).catch(() => {
          // Si alguna columna no existe, actualizar sin ella
          return query(
            `UPDATE transmutaciones_lugares_estado 
             SET estado = 'limpio', 
                 ultima_limpieza = $1
             WHERE alumno_id = $2 AND lugar_id = $3`,
            [ahora, alumnoId, lugar.id]
          );
        });
        
        // Registrar en el historial de limpiezas del master
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [alumnoId, 'lugares', lugar.id, lugar.nombre, 'Transmutaciones PDE - Lugares', ahora]
          );
        } catch (histError) {
          console.warn('⚠️ Error registrando en historial de limpiezas:', histError.message);
        }
        
        marcados++;
      } else {
        // Crear nuevo registro
        await query(
          `INSERT INTO transmutaciones_lugares_estado (alumno_id, lugar_id, estado, ultima_limpieza, veces_limpiado)
           VALUES ($1, $2, 'limpio', $3, 1)`,
          [alumnoId, lugar.id, ahora]
        ).catch(() => {
          // Si veces_limpiado no existe, crear sin ella
          return query(
            `INSERT INTO transmutaciones_lugares_estado (alumno_id, lugar_id, estado, ultima_limpieza)
             VALUES ($1, $2, 'limpio', $3)`,
            [alumnoId, lugar.id, ahora]
          );
        });
        
        // Registrar en el historial de limpiezas del master
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [alumnoId, 'lugares', lugar.id, lugar.nombre, 'Transmutaciones PDE - Lugares', ahora]
          );
        } catch (histError) {
          console.warn('⚠️ Error registrando en historial de limpiezas:', histError.message);
        }
        
        marcados++;
      }
    }
    
    return { success: true, marcados };
  } catch (error) {
    console.error('Error marcando todos los lugares como limpios:', error);
    throw error;
  }
}
