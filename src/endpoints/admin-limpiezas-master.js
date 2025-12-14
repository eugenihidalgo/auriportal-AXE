// src/endpoints/admin-limpiezas-master.js
// Endpoints del Admin Panel para Limpiezas del Master (vista global)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query } from '../../database/pg.js';
import { requireAdminAuth } from '../modules/admin-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Obtener todas las limpiezas del historial (global)
 * Solo muestra limpiezas que siguen estando limpias (no han pasado a pendientes)
 * Para el filtro "hoy", muestra todas las limpiezas de hoy sin verificar estado
 */
async function obtenerTodasLimpiezas(filtroFecha = null) {
  try {
    // Asegurar que la tabla existe
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
      await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_alumno ON limpiezas_master_historial(alumno_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_fecha ON limpiezas_master_historial(fecha_limpieza)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_limpiezas_master_historial_tipo ON limpiezas_master_historial(tipo)`);
    } catch (createError) {
      // Si falla la creación, continuar (puede que ya exista o haya problema de permisos)
      console.warn('⚠️ No se pudo crear/verificar tabla limpiezas_master_historial:', createError.message);
    }
    let querySQL = `
      SELECT 
        lmh.*,
        a.email,
        a.apodo,
        a.nombre_completo
      FROM limpiezas_master_historial lmh
      LEFT JOIN alumnos a ON lmh.alumno_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filtroFecha === 'hoy') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      querySQL += ` AND lmh.fecha_limpieza >= $${paramIndex++} AND lmh.fecha_limpieza < $${paramIndex++}`;
      params.push(hoy, manana);
      // Para "hoy", no filtramos por estado, mostramos todas
      querySQL += ` ORDER BY lmh.fecha_limpieza DESC LIMIT 1000`;
      const result = await query(querySQL, params);
      return result.rows || [];
    } else if (filtroFecha === 'ayer') {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      ayer.setHours(0, 0, 0, 0);
      const hoy = new Date(ayer);
      hoy.setDate(hoy.getDate() + 1);
      querySQL += ` AND lmh.fecha_limpieza >= $${paramIndex++} AND lmh.fecha_limpieza < $${paramIndex++}`;
      params.push(ayer, hoy);
      // Para "ayer", también mostramos todas sin filtrar por estado
      querySQL += ` ORDER BY lmh.fecha_limpieza DESC LIMIT 1000`;
      const result = await query(querySQL, params);
      return result.rows || [];
    } else if (filtroFecha && filtroFecha !== 'todas') {
      // Filtrar por fecha específica (formato YYYY-MM-DD)
      const fecha = new Date(filtroFecha);
      fecha.setHours(0, 0, 0, 0);
      const manana = new Date(fecha);
      manana.setDate(manana.getDate() + 1);
      querySQL += ` AND lmh.fecha_limpieza >= $${paramIndex++} AND lmh.fecha_limpieza < $${paramIndex++}`;
      params.push(fecha, manana);
      querySQL += ` ORDER BY lmh.fecha_limpieza DESC LIMIT 1000`;
      const result = await query(querySQL, params);
      return result.rows || [];
    }
    
    // Para "todas", filtramos solo las que siguen limpias
    querySQL += ` ORDER BY lmh.fecha_limpieza DESC LIMIT 1000`;
    const result = await query(querySQL, params);
    const todasLimpiezas = result.rows || [];
    
    // Filtrar solo las que siguen estando limpias (solo para "todas")
    const limpiezasActivas = [];
    
    for (const limpieza of todasLimpiezas) {
      // Si alumno_id es NULL, es una limpieza global (para todos) - siempre está limpia
      if (limpieza.alumno_id === null) {
        limpiezasActivas.push(limpieza);
        continue;
      }
      
      let sigueLimpio = false;
      
      try {
        if (limpieza.tipo === 'anatomia') {
          const estado = await query(`
            SELECT 
              aea.ultima_limpieza,
              COALESCE(ae.frecuencia_dias, 14) as frecuencia_dias
            FROM aspectos_energeticos_alumnos aea
            LEFT JOIN aspectos_energeticos ae ON aea.aspecto_id = ae.id
            WHERE aea.alumno_id = $1 AND aea.aspecto_id = $2
          `, [limpieza.alumno_id, limpieza.aspecto_id]);
          
          if (estado.rows.length > 0 && estado.rows[0].ultima_limpieza) {
            const diasDesdeLimpieza = await query(`
              SELECT EXTRACT(DAY FROM (CURRENT_TIMESTAMP - $1::timestamp))::INT as dias
            `, [estado.rows[0].ultima_limpieza]);
            const dias = diasDesdeLimpieza.rows[0]?.dias || 999;
            sigueLimpio = dias <= (estado.rows[0].frecuencia_dias || 14);
          }
        } else if (limpieza.tipo === 'karmicos') {
          const estado = await query(`
            SELECT 
              aka.ultima_limpieza,
              COALESCE(ak.frecuencia_dias, 14) as frecuencia_dias
            FROM aspectos_karmicos_alumnos aka
            LEFT JOIN aspectos_karmicos ak ON aka.aspecto_id = ak.id
            WHERE aka.alumno_id = $1 AND aka.aspecto_id = $2
          `, [limpieza.alumno_id, limpieza.aspecto_id]);
          
          if (estado.rows.length > 0 && estado.rows[0].ultima_limpieza) {
            const diasDesdeLimpieza = await query(`
              SELECT EXTRACT(DAY FROM (CURRENT_TIMESTAMP - $1::timestamp))::INT as dias
            `, [estado.rows[0].ultima_limpieza]);
            const dias = diasDesdeLimpieza.rows[0]?.dias || 999;
            sigueLimpio = dias <= (estado.rows[0].frecuencia_dias || 14);
          }
        } else if (limpieza.tipo === 'indeseables') {
          const estado = await query(`
            SELECT 
              aia.ultima_limpieza,
              COALESCE(ai.frecuencia_dias, 14) as frecuencia_dias
            FROM aspectos_indeseables_alumnos aia
            LEFT JOIN aspectos_indeseables ai ON aia.aspecto_id = ai.id
            WHERE aia.alumno_id = $1 AND aia.aspecto_id = $2
          `, [limpieza.alumno_id, limpieza.aspecto_id]);
          
          if (estado.rows.length > 0 && estado.rows[0].ultima_limpieza) {
            const diasDesdeLimpieza = await query(`
              SELECT EXTRACT(DAY FROM (CURRENT_TIMESTAMP - $1::timestamp))::INT as dias
            `, [estado.rows[0].ultima_limpieza]);
            const dias = diasDesdeLimpieza.rows[0]?.dias || 999;
            sigueLimpio = dias <= (estado.rows[0].frecuencia_dias || 14);
          }
        } else if (limpieza.tipo === 'limpieza_hogar') {
          const estado = await query(`
            SELECT 
              lha.ultima_limpieza,
              COALESCE(lh.frecuencia_dias, 14) as frecuencia_dias
            FROM limpieza_hogar_alumnos lha
            LEFT JOIN limpieza_hogar lh ON lha.aspecto_id = lh.id
            WHERE lha.alumno_id = $1 AND lha.aspecto_id = $2
          `, [limpieza.alumno_id, limpieza.aspecto_id]);
          
          if (estado.rows.length > 0 && estado.rows[0].ultima_limpieza) {
            const diasDesdeLimpieza = await query(`
              SELECT EXTRACT(DAY FROM (CURRENT_TIMESTAMP - $1::timestamp))::INT as dias
            `, [estado.rows[0].ultima_limpieza]);
            const dias = diasDesdeLimpieza.rows[0]?.dias || 999;
            sigueLimpio = dias <= (estado.rows[0].frecuencia_dias || 14);
          }
        } else if (limpieza.tipo === 'lugares') {
          const estado = await query(`
            SELECT 
              tle.ultima_limpieza,
              COALESCE(tl.frecuencia_dias, 14) as frecuencia_dias
            FROM transmutaciones_lugares_estado tle
            LEFT JOIN transmutaciones_lugares tl ON tle.lugar_id = tl.id
            WHERE tle.alumno_id = $1 AND tle.lugar_id = $2
          `, [limpieza.alumno_id, limpieza.aspecto_id]);
          
          if (estado.rows.length > 0 && estado.rows[0].ultima_limpieza) {
            const diasDesdeLimpieza = await query(`
              SELECT EXTRACT(DAY FROM (CURRENT_TIMESTAMP - $1::timestamp))::INT as dias
            `, [estado.rows[0].ultima_limpieza]);
            const dias = diasDesdeLimpieza.rows[0]?.dias || 999;
            sigueLimpio = dias <= (estado.rows[0].frecuencia_dias || 14);
          }
        } else if (limpieza.tipo === 'proyectos') {
          const estado = await query(`
            SELECT 
              tpe.ultima_limpieza,
              COALESCE(tp.frecuencia_dias, 14) as frecuencia_dias
            FROM transmutaciones_proyectos_estado tpe
            LEFT JOIN transmutaciones_proyectos tp ON tpe.proyecto_id = tp.id
            WHERE tpe.alumno_id = $1 AND tpe.proyecto_id = $2
          `, [limpieza.alumno_id, limpieza.aspecto_id]);
          
          if (estado.rows.length > 0 && estado.rows[0].ultima_limpieza) {
            const diasDesdeLimpieza = await query(`
              SELECT EXTRACT(DAY FROM (CURRENT_TIMESTAMP - $1::timestamp))::INT as dias
            `, [estado.rows[0].ultima_limpieza]);
            const dias = diasDesdeLimpieza.rows[0]?.dias || 999;
            sigueLimpio = dias <= (estado.rows[0].frecuencia_dias || 14);
          }
        } else {
          // Para tipos desconocidos, asumimos que siguen limpias
          sigueLimpio = true;
        }
      } catch (err) {
        // Si hay error verificando el estado, asumimos que no está limpio
        console.warn(`Error verificando estado de limpieza ${limpieza.id}:`, err.message);
        sigueLimpio = false;
      }
      
      if (sigueLimpio) {
        limpiezasActivas.push(limpieza);
      }
    }
    
    return limpiezasActivas;
  } catch (error) {
    if (error.message && error.message.includes('does not exist')) {
      console.warn('⚠️ Tabla limpiezas_master_historial no existe aún');
      return [];
    }
    console.error('Error obteniendo limpiezas:', error);
    return [];
  }
}

/**
 * Migrar limpiezas históricas al historial del master
 * Esta función importa todas las limpiezas que ya existen en las tablas de estado
 * pero que no están registradas en el historial
 */
async function migrarLimpiezasHistoricas() {
  try {
    let totalMigradas = 0;
    
    // 1. Anatomía Energética
    try {
      const anatomia = await query(`
        SELECT 
          aea.alumno_id,
          aea.aspecto_id,
          aea.ultima_limpieza,
          ae.nombre as aspecto_nombre
        FROM aspectos_energeticos_alumnos aea
        INNER JOIN aspectos_energeticos ae ON aea.aspecto_id = ae.id
        WHERE aea.ultima_limpieza IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM limpiezas_master_historial lmh
            WHERE lmh.alumno_id = aea.alumno_id
              AND lmh.aspecto_id = aea.aspecto_id
              AND lmh.tipo = 'anatomia'
              AND lmh.fecha_limpieza = aea.ultima_limpieza
          )
      `);
      
      for (const row of anatomia.rows) {
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, 'anatomia', $2, $3, 'Anatomía Energética', $4)`,
            [row.alumno_id, row.aspecto_id, row.aspecto_nombre, row.ultima_limpieza]
          );
          totalMigradas++;
        } catch (err) {
          console.warn('Error insertando limpieza de anatomía:', err.message);
        }
      }
    } catch (err) {
      console.warn('Error migrando anatomía energética:', err.message);
    }
    
    // 2. Aspectos Kármicos
    try {
      const karmicos = await query(`
        SELECT 
          aka.alumno_id,
          aka.aspecto_id,
          aka.ultima_limpieza,
          ak.nombre as aspecto_nombre
        FROM aspectos_karmicos_alumnos aka
        INNER JOIN aspectos_karmicos ak ON aka.aspecto_id = ak.id
        WHERE aka.ultima_limpieza IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM limpiezas_master_historial lmh
            WHERE lmh.alumno_id = aka.alumno_id
              AND lmh.aspecto_id = aka.aspecto_id
              AND lmh.tipo = 'karmicos'
              AND lmh.fecha_limpieza = aka.ultima_limpieza
          )
      `);
      
      for (const row of karmicos.rows) {
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, 'karmicos', $2, $3, 'Aspectos Kármicos', $4)`,
            [row.alumno_id, row.aspecto_id, row.aspecto_nombre, row.ultima_limpieza]
          );
          totalMigradas++;
        } catch (err) {
          console.warn('Error insertando limpieza kármica:', err.message);
        }
      }
    } catch (err) {
      console.warn('Error migrando aspectos kármicos:', err.message);
    }
    
    // 3. Energías Indeseables
    try {
      const indeseables = await query(`
        SELECT 
          aia.alumno_id,
          aia.aspecto_id,
          aia.ultima_limpieza,
          ai.nombre as aspecto_nombre
        FROM aspectos_indeseables_alumnos aia
        INNER JOIN aspectos_indeseables ai ON aia.aspecto_id = ai.id
        WHERE aia.ultima_limpieza IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM limpiezas_master_historial lmh
            WHERE lmh.alumno_id = aia.alumno_id
              AND lmh.aspecto_id = aia.aspecto_id
              AND lmh.tipo = 'indeseables'
              AND lmh.fecha_limpieza = aia.ultima_limpieza
          )
      `);
      
      for (const row of indeseables.rows) {
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, 'indeseables', $2, $3, 'Energías Indeseables', $4)`,
            [row.alumno_id, row.aspecto_id, row.aspecto_nombre, row.ultima_limpieza]
          );
          totalMigradas++;
        } catch (err) {
          console.warn('Error insertando limpieza indeseable:', err.message);
        }
      }
    } catch (err) {
      console.warn('Error migrando energías indeseables:', err.message);
    }
    
    // 4. Transmutaciones PDE - Lugares
    try {
      const lugares = await query(`
        SELECT 
          tle.alumno_id,
          tle.lugar_id as aspecto_id,
          tle.ultima_limpieza,
          tl.nombre as aspecto_nombre
        FROM transmutaciones_lugares_estado tle
        INNER JOIN transmutaciones_lugares tl ON tle.lugar_id = tl.id
        WHERE tle.ultima_limpieza IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM limpiezas_master_historial lmh
            WHERE lmh.alumno_id = tle.alumno_id
              AND lmh.aspecto_id = tle.lugar_id
              AND lmh.tipo = 'lugares'
              AND lmh.fecha_limpieza = tle.ultima_limpieza
          )
      `);
      
      for (const row of lugares.rows) {
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, 'lugares', $2, $3, 'Transmutaciones PDE - Lugares', $4)`,
            [row.alumno_id, row.aspecto_id, row.aspecto_nombre, row.ultima_limpieza]
          );
          totalMigradas++;
        } catch (err) {
          console.warn('Error insertando limpieza de lugar:', err.message);
        }
      }
    } catch (err) {
      console.warn('Error migrando lugares:', err.message);
    }
    
    // 5. Transmutaciones PDE - Proyectos
    try {
      const proyectos = await query(`
        SELECT 
          tpe.alumno_id,
          tpe.proyecto_id as aspecto_id,
          tpe.ultima_limpieza,
          tp.nombre as aspecto_nombre
        FROM transmutaciones_proyectos_estado tpe
        INNER JOIN transmutaciones_proyectos tp ON tpe.proyecto_id = tp.id
        WHERE tpe.ultima_limpieza IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM limpiezas_master_historial lmh
            WHERE lmh.alumno_id = tpe.alumno_id
              AND lmh.aspecto_id = tpe.proyecto_id
              AND lmh.tipo = 'proyectos'
              AND lmh.fecha_limpieza = tpe.ultima_limpieza
          )
      `);
      
      for (const row of proyectos.rows) {
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, 'proyectos', $2, $3, 'Transmutaciones PDE - Proyectos', $4)`,
            [row.alumno_id, row.aspecto_id, row.aspecto_nombre, row.ultima_limpieza]
          );
          totalMigradas++;
        } catch (err) {
          console.warn('Error insertando limpieza de proyecto:', err.message);
        }
      }
    } catch (err) {
      console.warn('Error migrando proyectos:', err.message);
    }
    
    // 6. Transmutaciones PDE - Apadrinados
    try {
      const apadrinados = await query(`
        SELECT 
          tae.alumno_id,
          tae.apadrinado_id as aspecto_id,
          tae.ultima_limpieza,
          ta.nombre as aspecto_nombre
        FROM transmutaciones_apadrinados_estado tae
        INNER JOIN transmutaciones_apadrinados ta ON tae.apadrinado_id = ta.id
        WHERE tae.ultima_limpieza IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM limpiezas_master_historial lmh
            WHERE lmh.alumno_id = tae.alumno_id
              AND lmh.aspecto_id = tae.apadrinado_id
              AND lmh.tipo = 'apadrinados'
              AND lmh.fecha_limpieza = tae.ultima_limpieza
          )
      `);
      
      for (const row of apadrinados.rows) {
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, 'apadrinados', $2, $3, 'Transmutaciones PDE - Apadrinados', $4)`,
            [row.alumno_id, row.aspecto_id, row.aspecto_nombre, row.ultima_limpieza]
          );
          totalMigradas++;
        } catch (err) {
          console.warn('Error insertando limpieza de apadrinado:', err.message);
        }
      }
    } catch (err) {
      console.warn('Error migrando apadrinados:', err.message);
    }
    
    // 7. Limpieza de Hogar
    try {
      const hogar = await query(`
        SELECT 
          lha.alumno_id,
          lha.aspecto_id,
          lha.ultima_limpieza,
          lh.nombre as aspecto_nombre
        FROM limpieza_hogar_alumnos lha
        INNER JOIN limpieza_hogar lh ON lha.aspecto_id = lh.id
        WHERE lha.ultima_limpieza IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM limpiezas_master_historial lmh
            WHERE lmh.alumno_id = lha.alumno_id
              AND lmh.aspecto_id = lha.aspecto_id
              AND lmh.tipo = 'limpieza_hogar'
              AND lmh.fecha_limpieza = lha.ultima_limpieza
          )
      `);
      
      for (const row of hogar.rows) {
        try {
          await query(
            `INSERT INTO limpiezas_master_historial (alumno_id, tipo, aspecto_id, aspecto_nombre, seccion, fecha_limpieza)
             VALUES ($1, 'limpieza_hogar', $2, $3, 'Limpieza de Hogar', $4)`,
            [row.alumno_id, row.aspecto_id, row.aspecto_nombre, row.ultima_limpieza]
          );
          totalMigradas++;
        } catch (err) {
          console.warn('Error insertando limpieza de hogar:', err.message);
        }
      }
    } catch (err) {
      console.warn('Error migrando limpieza de hogar:', err.message);
    }
    
    return { success: true, totalMigradas };
  } catch (error) {
    console.error('Error en migración de limpiezas históricas:', error);
    throw error;
  }
}


export async function renderLimpiezasMaster(request, env) {
  try {
    // Verificar autenticación
    const authCheck = requireAdminAuth(request);
    if (authCheck.requiresAuth) {
      const loginUrl = new URL('/admin/login', request.url);
      return Response.redirect(loginUrl.toString(), 302);
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const filtroFecha = url.searchParams.get('filtro') || url.searchParams.get('fecha') || 'todas'; // 'todas', 'hoy', 'ayer', o fecha específica

    // GET: Obtener lista de aspectos limpiados hoy (para copiar)
    if (request.method === 'GET' && url.pathname === '/admin/limpiezas-master/lista-hoy') {
      try {
        const limpiezasHoy = await obtenerTodasLimpiezas('hoy');
        
        // Obtener aspectos únicos (sin duplicados)
        const aspectosUnicos = [];
        const aspectosVistos = new Set();
        
        limpiezasHoy.forEach(limpieza => {
          if (limpieza.aspecto_nombre && !aspectosVistos.has(limpieza.aspecto_nombre)) {
            aspectosUnicos.push({ nombre: limpieza.aspecto_nombre });
            aspectosVistos.add(limpieza.aspecto_nombre);
          }
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          aspectos: aspectosUnicos 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('[GET lista-hoy] ❌ Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Error interno del servidor' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // POST: Migrar limpiezas históricas
    if (request.method === 'POST' && action === 'migrar_historicas') {
      try {
        const resultado = await migrarLimpiezasHistoricas();
        return new Response(JSON.stringify(resultado), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('[POST migrar_historicas] ❌ Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Error interno del servidor' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }


    // Determinar filtro de fecha
    let fechaFiltro = null;
    if (filtroFecha === 'hoy') {
      fechaFiltro = 'hoy';
    } else if (filtroFecha === 'ayer') {
      fechaFiltro = 'ayer';
    } else if (filtroFecha) {
      fechaFiltro = filtroFecha;
    }

    // Obtener todas las limpiezas
    const limpiezas = await obtenerTodasLimpiezas(fechaFiltro);

    // Agrupar por fecha
    const limpiezasPorFecha = {};
    limpiezas.forEach(limpieza => {
      const fecha = new Date(limpieza.fecha_limpieza);
      const fechaKey = fecha.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
      
      if (!limpiezasPorFecha[fechaKey]) {
        limpiezasPorFecha[fechaKey] = [];
      }
      limpiezasPorFecha[fechaKey].push(limpieza);
    });

    const content = `
      <div class="p-6">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-white mb-3">📋 Limpiezas globales del Master</h1>
          <p class="text-slate-300 text-lg leading-relaxed max-w-4xl">
            Historial global de todas las limpiezas realizadas desde el panel admin del Master.
            Aquí puedes ver todas las limpiezas de todos los alumnos y gestionarlas de forma centralizada.
          </p>
        </div>

        <!-- Filtros -->
        <div class="bg-slate-800 rounded-lg p-4 mb-6">
          <div class="flex items-center gap-4 flex-wrap">
            <a href="/admin/limpiezas-master?filtro=todas" 
               class="px-4 py-2 rounded ${filtroFecha === 'todas' || !filtroFecha ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}">
              Todas
            </a>
            <a href="/admin/limpiezas-master?filtro=hoy" 
               class="px-4 py-2 rounded ${filtroFecha === 'hoy' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}">
              Hoy
            </a>
            <a href="/admin/limpiezas-master?filtro=ayer" 
               class="px-4 py-2 rounded ${filtroFecha === 'ayer' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}">
              Ayer
            </a>
            <button onclick="migrarLimpiezasHistoricas()" 
                    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              🔄 Migrar limpiezas históricas
            </button>
            <button onclick="mostrarListaHoy()" 
                    class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              📋 Ver lista de hoy
            </button>
          </div>
        </div>

        <!-- Lista de limpiezas agrupadas por fecha -->
        <div class="space-y-6">
          ${Object.keys(limpiezasPorFecha).length > 0 ? Object.keys(limpiezasPorFecha).map(fechaKey => {
            const limpiezasFecha = limpiezasPorFecha[fechaKey];
            return `
              <div class="bg-slate-800 rounded-lg p-6">
                <h2 class="text-xl font-bold text-white mb-4">${fechaKey} (${limpiezasFecha.length} limpiezas)</h2>
                <div class="space-y-2">
                  ${limpiezasFecha.map(limpieza => {
                    const fecha = new Date(limpieza.fecha_limpieza);
                    const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    // Si alumno_id es NULL, es una limpieza global (para todos)
                    const esGlobal = limpieza.alumno_id === null;
                    const nombreAlumno = esGlobal ? 'Todos los suscriptores activos' : escapeHtml(limpieza.nombre_completo || limpieza.apodo || limpieza.email || 'Sin nombre');
                    const nombreAspecto = escapeHtml(limpieza.aspecto_nombre || 'Sin nombre');
                    const seccion = escapeHtml(limpieza.seccion || limpieza.tipo || 'Sin sección');
                    
                    return `
                      <div class="bg-slate-700 rounded p-3 flex justify-between items-center">
                        <div class="flex-1">
                          <div class="font-semibold text-white">${nombreAspecto}</div>
                          <div class="text-sm text-slate-300 mt-1">
                            <span class="text-indigo-300">${seccion}</span>
                            <span class="text-slate-500 mx-2">•</span>
                            <span class="text-blue-300">${nombreAlumno}</span>
                            <span class="text-slate-500 mx-2">•</span>
                            <span class="text-slate-400">${hora}</span>
                          </div>
                        </div>
                        <div class="flex items-center gap-2 ml-4">
                          <span class="px-3 py-1 bg-green-600 rounded text-xs text-white">
                            ✅ Limpiado
                          </span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('') : `
            <div class="bg-slate-800 rounded-lg p-6 text-center">
              <p class="text-slate-400 text-lg">No hay limpiezas registradas${filtroFecha ? ' para esta fecha' : ''}.</p>
            </div>
          `}
        </div>
      </div>

      <script>
        async function migrarLimpiezasHistoricas() {
          if (!confirm('¿Migrar todas las limpiezas históricas al historial del master? Esto importará todas las limpiezas que ya se han hecho pero que no están registradas en el historial.')) {
            return;
          }
          
          const button = document.querySelector('button[onclick*="migrarLimpiezasHistoricas"]');
          const originalText = button ? button.textContent : '';
          if (button) {
            button.disabled = true;
            button.textContent = '⏳ Migrando...';
          }
          
          try {
            const response = await fetch('/admin/limpiezas-master?action=migrar_historicas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
              alert(\`✅ Migración completada. Se importaron \${result.totalMigradas || 0} limpiezas históricas al historial.\`);
              window.location.reload();
            } else {
              console.error('Error en migración:', result.error || 'Error desconocido');
              alert('Error en la migración: ' + (result.error || 'Error desconocido'));
            }
          } catch (error) {
            console.error('Error de red en migración:', error);
            alert('Error de red al migrar limpiezas históricas');
          } finally {
            if (button) {
              button.disabled = false;
              button.textContent = originalText;
            }
          }
        }
        
      </script>

      <!-- Modal para lista de hoy -->
      <div id="modal-lista-hoy" class="hidden fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onclick="if(event.target.id === 'modal-lista-hoy') cerrarModalListaHoy()">
        <div class="bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onclick="event.stopPropagation()">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-bold text-white">📋 Aspectos limpiados hoy</h2>
            <button onclick="cerrarModalListaHoy()" class="text-slate-400 hover:text-white text-2xl">&times;</button>
          </div>
          <div class="mb-4">
            <textarea id="lista-copiable" readonly class="w-full h-64 p-4 bg-slate-900 text-white rounded font-mono text-sm resize-none"></textarea>
          </div>
          <div class="flex gap-2">
            <button onclick="copiarLista()" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex-1">
              📋 Copiar lista
            </button>
            <button onclick="cerrarModalListaHoy()" class="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700">
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <script>
        async function mostrarListaHoy() {
          try {
            const response = await fetch('/admin/limpiezas-master/lista-hoy');
            const data = await response.json();
            
            if (data.success) {
              const lista = data.aspectos.map((a, i) => \`\${i + 1}. \${a.nombre}\`).join('\\n');
              document.getElementById('lista-copiable').value = lista;
              document.getElementById('modal-lista-hoy').classList.remove('hidden');
            } else {
              alert('Error al obtener la lista: ' + (data.error || 'Error desconocido'));
            }
          } catch (error) {
            console.error('Error:', error);
            alert('Error de conexión al obtener la lista');
          }
        }

        function cerrarModalListaHoy() {
          document.getElementById('modal-lista-hoy').classList.add('hidden');
        }

        function copiarLista() {
          const textarea = document.getElementById('lista-copiable');
          textarea.select();
          textarea.setSelectionRange(0, 99999); // Para móviles
          document.execCommand('copy');
          
          // Feedback visual
          const button = event.target;
          const originalText = button.textContent;
          button.textContent = '✅ ¡Copiado!';
          button.classList.add('bg-green-600');
          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('bg-green-600');
          }, 2000);
        }
      </script>
    `;

    const html = replace(baseTemplate, {
      TITLE: 'Limpiezas del Master',
      CONTENT: content
    });

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('Error renderizando limpiezas del master:', error);
    console.error('Stack trace:', error.stack);

    const errorHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error - Limpiezas del Master</title>
        <style>
          body { font-family: system-ui; background: #1e1e1e; color: #fff; padding: 20px; }
          .error { background: #7f1d1d; border: 1px solid #991b1b; padding: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Error al cargar Limpiezas del Master</h1>
          <p>${error.message || 'Error desconocido'}</p>
          <p><a href="/admin/dashboard" style="color: #60a5fa;">Volver al dashboard</a></p>
        </div>
      </body>
      </html>
    `;

    return new Response(errorHTML, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  }
}

