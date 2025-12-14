// src/services/transmutaciones-apadrinados.js
// Servicio para gestión de apadrinados

import { query } from '../../database/pg.js';

export async function listarApadrinadosGlobales() {
  try {
    const result = await query(`
      SELECT 
        ta.*,
        a.id as padrino_id,
        a.email as padrino_email,
        a.apodo as padrino_apodo,
        a.nombre_completo as padrino_nombre
      FROM transmutaciones_apadrinados ta
      LEFT JOIN alumnos a ON ta.alumno_id = a.id
      WHERE ta.activo = true
      ORDER BY COALESCE(ta.nivel_minimo, 1) ASC, ta.orden ASC, ta.nombre ASC
    `).catch(async (err) => {
      // Si la tabla no existe, intentar crearla
      if (err.message && err.message.includes('does not exist')) {
        console.log('⚠️ Tabla transmutaciones_apadrinados no existe, creándola...');
        try {
          await query(`
            CREATE TABLE IF NOT EXISTS transmutaciones_apadrinados (
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
          await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_activo ON transmutaciones_apadrinados(activo)`);
          await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_nivel ON transmutaciones_apadrinados(nivel_minimo)`);
          
          await query(`
            CREATE TABLE IF NOT EXISTS transmutaciones_apadrinados_estado (
              id SERIAL PRIMARY KEY,
              apadrinado_id INT REFERENCES transmutaciones_apadrinados(id) ON DELETE CASCADE,
              alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
              estado VARCHAR(50) DEFAULT 'pendiente',
              ultima_limpieza TIMESTAMP,
              veces_limpiado INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE (apadrinado_id, alumno_id)
            )
          `);
          await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_estado_apadrinado ON transmutaciones_apadrinados_estado(apadrinado_id)`);
          await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_estado_alumno ON transmutaciones_apadrinados_estado(alumno_id)`);
          
          console.log('✅ Tablas de transmutaciones_apadrinados creadas, reintentando consulta...');
          // Reintentar la consulta
          return query(`
            SELECT 
              ta.*,
              a.id as padrino_id,
              a.email as padrino_email,
              a.apodo as padrino_apodo,
              a.nombre_completo as padrino_nombre
            FROM transmutaciones_apadrinados ta
            LEFT JOIN alumnos a ON ta.alumno_id = a.id
            WHERE ta.activo = true
            ORDER BY COALESCE(ta.nivel_minimo, 1) ASC, ta.orden ASC, ta.nombre ASC
          `);
        } catch (createError) {
          console.error('Error creando tablas de transmutaciones_apadrinados:', createError);
          return { rows: [] };
        }
      }
      if (err.message.includes('nivel_minimo')) {
        return query(`
          SELECT 
            ta.*,
            1 as nivel_minimo,
            a.id as padrino_id,
            a.email as padrino_email,
            a.apodo as padrino_apodo,
            a.nombre_completo as padrino_nombre
          FROM transmutaciones_apadrinados ta
          LEFT JOIN alumnos a ON ta.alumno_id = a.id
          WHERE ta.activo = true
          ORDER BY ta.orden ASC, ta.nombre ASC
        `);
      }
      throw err;
    });
    return result.rows || [];
  } catch (error) {
    console.error('Error listando apadrinados globales:', error);
    return [];
  }
}

export async function crearApadrinadoRapido(nombre, nivel_minimo = 1, descripcion = null, frecuencia_dias = null, prioridad = 'Normal', orden = 0, alumno_id = null) {
  try {
    // Apadrinados no requieren frecuencia_dias, usar NULL si no se proporciona
    const result = await query(`
      INSERT INTO transmutaciones_apadrinados (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo, alumno_id)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING id
    `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, alumno_id]);
    return result.rows[0].id;
  } catch (error) {
    // Si la columna no existe, intentar agregarla y reintentar
    if (error.message && (error.message.includes('alumno_id') || error.message.includes('column "alumno_id" of relation "transmutaciones_apadrinados" does not exist'))) {
      console.log('⚠️ Columna alumno_id no existe, agregándola...');
      try {
        // Verificar si la columna existe antes de agregarla
        const checkColumn = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'transmutaciones_apadrinados' 
          AND column_name = 'alumno_id'
        `);
        
        if (checkColumn.rows.length === 0) {
          // La columna no existe, agregarla
          await query(`
            ALTER TABLE transmutaciones_apadrinados 
            ADD COLUMN alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE;
          `);
          console.log('✅ Columna alumno_id agregada exitosamente');
        }
        
        // Reintentar la inserción
        const result = await query(`
          INSERT INTO transmutaciones_apadrinados (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo, alumno_id)
          VALUES ($1, $2, $3, $4, $5, $6, true, $7)
          RETURNING id
        `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, alumno_id]);
        return result.rows[0].id;
      } catch (alterError) {
        console.error('Error agregando columna alumno_id:', alterError);
        throw alterError;
      }
    }
    // Si la tabla no existe, intentar crearla
    if (error.message && error.message.includes('does not exist')) {
      console.log('⚠️ Tabla transmutaciones_apadrinados no existe, creándola...');
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS transmutaciones_apadrinados (
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
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_activo ON transmutaciones_apadrinados(activo)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_nivel ON transmutaciones_apadrinados(nivel_minimo)`);
        
        await query(`
          CREATE TABLE IF NOT EXISTS transmutaciones_apadrinados_estado (
            id SERIAL PRIMARY KEY,
            apadrinado_id INT REFERENCES transmutaciones_apadrinados(id) ON DELETE CASCADE,
            alumno_id INT REFERENCES alumnos(id) ON DELETE CASCADE,
            estado VARCHAR(50) DEFAULT 'pendiente',
            ultima_limpieza TIMESTAMP,
            veces_limpiado INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (apadrinado_id, alumno_id)
          )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_estado_apadrinado ON transmutaciones_apadrinados_estado(apadrinado_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_transmutaciones_apadrinados_estado_alumno ON transmutaciones_apadrinados_estado(alumno_id)`);
        
        console.log('✅ Tablas de transmutaciones_apadrinados creadas, reintentando inserción...');
        // Reintentar la inserción
        const result = await query(`
          INSERT INTO transmutaciones_apadrinados (nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, activo, alumno_id)
          VALUES ($1, $2, $3, $4, $5, $6, true, $7)
          RETURNING id
        `, [nombre, descripcion, nivel_minimo, frecuencia_dias, prioridad, orden, alumno_id]);
        return result.rows[0].id;
      } catch (createError) {
        console.error('Error creando tablas de transmutaciones_apadrinados:', createError);
        throw createError;
      }
    }
    console.error('Error creando apadrinado rápido:', error);
    throw error;
  }
}

export async function actualizarApadrinadoDetalle(apadrinadoId, datos) {
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
    params.push(apadrinadoId);

    await query(`
      UPDATE transmutaciones_apadrinados
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);
    return true;
  } catch (error) {
    console.error('Error actualizando apadrinado:', error);
    return false;
  }
}

export async function getApadrinadosAlumno(alumnoId) {
  try {
    const result = await query(`
      SELECT 
        ta.*,
        tae.ultima_limpieza,
        tae.veces_limpiado,
        tae.estado,
        CASE
          WHEN tae.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT
        END as dias_desde_limpieza
      FROM transmutaciones_apadrinados ta
      LEFT JOIN transmutaciones_apadrinados_estado tae ON ta.id = tae.apadrinado_id AND tae.alumno_id = $1
      WHERE ta.activo = true
        AND (COALESCE(ta.nivel_minimo, 1) <= (SELECT nivel_actual FROM alumnos WHERE id = $1 LIMIT 1))
      ORDER BY COALESCE(ta.nivel_minimo, 1) ASC, ta.orden ASC, ta.nombre ASC
    `, [alumnoId]).catch(err => {
      if (err.message.includes('nivel_minimo')) {
        return query(`
          SELECT 
            ta.*,
            1 as nivel_minimo,
            tae.ultima_limpieza,
            tae.veces_limpiado,
            tae.estado,
            CASE
              WHEN tae.ultima_limpieza IS NULL THEN NULL
              ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT
            END as dias_desde_limpieza
          FROM transmutaciones_apadrinados ta
          LEFT JOIN transmutaciones_apadrinados_estado tae ON ta.id = tae.apadrinado_id AND tae.alumno_id = $1
          WHERE ta.activo = true
          ORDER BY ta.orden ASC, ta.nombre ASC
        `, [alumnoId]);
      }
      throw err;
    });
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo apadrinados del alumno:', error);
    return [];
  }
}

export async function getAlumnosPorApadrinado(apadrinadoId) {
  try {
    // Primero obtener el apadrinado para saber qué padrino lo tiene
    const apadrinadoResult = await query(`
      SELECT alumno_id, nombre, frecuencia_dias, nivel_minimo
      FROM transmutaciones_apadrinados
      WHERE id = $1
    `, [apadrinadoId]);
    
    if (apadrinadoResult.rows.length === 0) {
      return [];
    }
    
    const apadrinado = apadrinadoResult.rows[0];
    const padrinoId = apadrinado.alumno_id;
    const frecuenciaDias = apadrinado.frecuencia_dias || 30;
    
    // Si el apadrinado no tiene padrino asignado, retornar lista vacía
    if (!padrinoId) {
      return [];
    }
    
    // Obtener el padrino (alumno) que tiene este apadrinado asignado
    const result = await query(`
      SELECT 
        a.id as alumno_id,
        a.email,
        a.apodo,
        a.nombre_completo,
        a.nivel_actual,
        tae.ultima_limpieza,
        tae.estado,
        tae.veces_limpiado,
        ta.nombre as apadrinado_nombre,
        ta.frecuencia_dias,
        CASE
          WHEN tae.ultima_limpieza IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT
        END as dias_desde_limpieza,
        CASE
          WHEN tae.ultima_limpieza IS NULL THEN 'pendiente'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT <= ta.frecuencia_dias THEN 'limpio'
          WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT <= 15 THEN 'pendiente'
          ELSE 'olvidado'
        END as estado_calculado
      FROM alumnos a
      INNER JOIN transmutaciones_apadrinados ta ON ta.alumno_id = a.id
      LEFT JOIN transmutaciones_apadrinados_estado tae ON tae.apadrinado_id = ta.id AND tae.alumno_id = a.id
      WHERE ta.id = $1
        AND a.estado_suscripcion = 'activa'
      ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
    `, [apadrinadoId]).catch(err => {
      if (err.message.includes('nivel_minimo')) {
        return query(`
          SELECT 
            a.id as alumno_id,
            a.email,
            a.apodo,
            a.nombre_completo,
            a.nivel_actual,
            tae.ultima_limpieza,
            tae.estado,
            tae.veces_limpiado,
            ta.nombre as apadrinado_nombre,
            ta.frecuencia_dias,
            CASE
              WHEN tae.ultima_limpieza IS NULL THEN NULL
              ELSE EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT
            END as dias_desde_limpieza,
            CASE
              WHEN tae.ultima_limpieza IS NULL THEN 'pendiente'
              WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT <= ta.frecuencia_dias THEN 'limpio'
              WHEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - tae.ultima_limpieza))::INT <= 15 THEN 'pendiente'
              ELSE 'olvidado'
            END as estado_calculado
          FROM alumnos a
          INNER JOIN transmutaciones_apadrinados ta ON ta.alumno_id = a.id
          LEFT JOIN transmutaciones_apadrinados_estado tae ON tae.apadrinado_id = ta.id AND tae.alumno_id = a.id
          WHERE ta.id = $1
            AND a.estado_suscripcion = 'activa'
          ORDER BY a.nivel_actual DESC, a.apodo ASC, a.email ASC
        `, [apadrinadoId]);
      }
      throw err;
    });
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo alumnos por apadrinado:', error);
    return [];
  }
}

