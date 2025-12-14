// src/endpoints/master-view.js
// Vista espejo del alumno para el Master - Muestra el perfil personal como lo ve el cliente

import { query } from '../../database/pg.js';
import { validarSuscripcionActiva } from '../services/notas-master.js';
import { obtenerNotasAlumno } from '../services/notas-master.js';
import { obtenerItemsVerdesParaAlumno } from '../services/transmutaciones-energeticas.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar plantilla HTML del perfil personal
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
 * Obtener alumno por ID desde PostgreSQL
 */
async function obtenerAlumnoPorId(alumnoId) {
  const result = await query(
    `SELECT id, email, apodo, nombre_completo, nivel_actual, estado_suscripcion
     FROM alumnos 
     WHERE id = $1`,
    [alumnoId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const alumno = result.rows[0];
  
  // Obtener la fase basándose en el nivel
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
  
  return alumno;
}

/**
 * GET /portal/master-view/:alumnoId
 * Vista espejo del alumno - muestra el perfil personal como lo ve el cliente
 */
export async function renderMasterView(request, env, alumnoId) {
  try {
    // Validar suscripción activa
    const esActivo = await validarSuscripcionActiva(alumnoId);
    
    if (!esActivo) {
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <title>Acceso Denegado</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: #1e293b;
      border-radius: 0.5rem;
      border: 1px solid #334155;
      max-width: 600px;
    }
    h1 { color: #ef4444; margin-bottom: 1rem; }
    p { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔒 Acceso Denegado</h1>
    <p>El Modo Master solo está disponible para alumnos con suscripción activa.</p>
  </div>
</body>
</html>`,
        {
          status: 403,
          headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        }
      );
    }

    // Obtener alumno
    const alumno = await obtenerAlumnoPorId(alumnoId);
    if (!alumno) {
      return new Response('Alumno no encontrado', { status: 404 });
    }

    // Obtener todos los datos (igual que en perfil-personal.js)
    const suscripcionActiva = alumno.estado_suscripcion === 'activa';
    const [notas, canalizaciones, lugares, proyectos, diario, apadrinados, limpiezasAlDia, transmutacionesVerdes] = await Promise.all([
      obtenerNotasAlumno(alumno.id).catch(() => []),
      query(
        `SELECT id, mensaje, fecha, creado_por, leido
         FROM comunicados_eugeni
         WHERE alumno_id = $1
         ORDER BY fecha DESC
         LIMIT 50`,
        [alumno.id]
      ).then(r => r.rows || []).catch(() => []),
      query(
        `SELECT id, nombre, descripcion, activo, created_at, updated_at
         FROM alumnos_lugares
         WHERE alumno_id = $1
         ORDER BY activo DESC, nombre ASC`,
        [alumno.id]
      ).then(r => r.rows || []).catch(() => []),
      query(
        `SELECT id, nombre, descripcion, activo, created_at, updated_at
         FROM alumnos_proyectos
         WHERE alumno_id = $1
         ORDER BY activo DESC, nombre ASC`,
        [alumno.id]
      ).then(r => r.rows || []).catch(() => []),
      query(
        `SELECT id, fecha, texto_usuario as contenido, created_at
         FROM diario_practicas
         WHERE alumno_id = $1
         ORDER BY fecha DESC
         LIMIT 30`,
        [alumno.id]
      ).then(r => r.rows || []).catch(() => []),
      // Obtener apadrinados
      query(
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
        [alumno.id]
      ).then(r => r.rows || []).catch(() => []),
      // Obtener limpiezas al día
      (async () => {
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
              [alumno.id]
            );
            limpiezas.push(...resultEnergeticos.rows.map(r => ({ ...r, tipo: 'energetico' })));
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
              [alumno.id]
            );
            limpiezas.push(...resultKarmicos.rows.map(r => ({ ...r, tipo: 'karmico' })));
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
              [alumno.id]
            );
            limpiezas.push(...resultIndeseables.rows.map(r => ({ ...r, tipo: 'indeseable' })));
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
              [alumno.id]
            );
            limpiezas.push(...resultHogar.rows.map(r => ({ ...r, tipo: 'hogar' })));
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
      })(),
      // Obtener transmutaciones energéticas
      suscripcionActiva ? obtenerItemsVerdesParaAlumno(alumno.id).catch(() => []) : Promise.resolve([])
    ]);

    // Preparar datos para la plantilla
    const nombre = alumno.nombre_completo || alumno.apodo || alumno.email;
    const nivel = alumno.nivel_actual || 1;
    const fase = alumno.fase_actual || 'sanación';

    // Lugar y proyecto activos
    const lugarActivo = lugares.find(l => l.activo === true) || null;
    const proyectoActivo = proyectos.find(p => p.activo === true) || null;

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

    // Generar HTML
    const notasHTML = notas.length > 0
      ? notas.map(nota => `
          <div class="nota-item">
            <div class="nota-fecha">${new Date(nota.fecha).toLocaleDateString('es-ES')}</div>
            <div class="nota-contenido">${escapeHtml(nota.contenido)}</div>
          </div>
        `).join('')
      : '<p class="texto-vacio">No hay notas del master aún.</p>';

    const canalizacionesHTML = canalizaciones.length > 0
      ? canalizaciones.map(can => `
          <div class="canalizacion-item ${can.leido ? '' : 'no-leida'}">
            <div class="canalizacion-fecha">${new Date(can.fecha).toLocaleDateString('es-ES')}</div>
            <div class="canalizacion-mensaje">${escapeHtml(can.mensaje)}</div>
          </div>
        `).join('')
      : '<p class="texto-vacio">No hay canalizaciones aún.</p>';

    const diarioHTML = diario.length > 0
      ? diario.map(entrada => `
          <div class="diario-item">
            <div class="diario-fecha">${new Date(entrada.fecha).toLocaleDateString('es-ES')}</div>
            <div class="diario-contenido">${escapeHtml(entrada.contenido || '')}</div>
          </div>
        `).join('')
      : '<p class="texto-vacio">No hay entradas en el diario aún.</p>';

    // Generar HTML de lista de lugares
    const lugaresHTML = lugares.length > 0
      ? lugares.map(l => `
          <div class="item-lista ${l.activo ? 'activo' : ''}" data-id="${l.id}">
            <div class="item-header">
              <strong>${escapeHtml(l.nombre || 'Sin nombre')}</strong>
              ${l.activo ? '<span class="badge-activo">✓ Activo</span>' : ''}
            </div>
            <div class="item-descripcion">${escapeHtml(l.descripcion || 'Sin descripción')}</div>
          </div>
        `).join('')
      : '<p class="texto-vacio">No hay lugares creados.</p>';
    
    // Generar HTML de lista de proyectos
    const proyectosHTML = proyectos.length > 0
      ? proyectos.map(p => `
          <div class="item-lista ${p.activo ? 'activo' : ''}" data-id="${p.id}">
            <div class="item-header">
              <strong>${escapeHtml(p.nombre || 'Sin nombre')}</strong>
              ${p.activo ? '<span class="badge-activo">✓ Activo</span>' : ''}
            </div>
            <div class="item-descripcion">${escapeHtml(p.descripcion || 'Sin descripción')}</div>
          </div>
        `).join('')
      : '<p class="texto-vacio">No hay proyectos creados.</p>';

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
    const suscripcionPausada = !suscripcionActiva;
    const mensajePausada = suscripcionPausada 
      ? '<div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 30px; text-align: center;"><h2 style="color: #92400e; font-size: 1.5rem; margin-bottom: 10px;">⏸️ Tu suscripción está pausada</h2><p style="color: #78350f; font-size: 1.1rem;">No puedes realizar acciones hasta que se reactive tu suscripción.</p></div>'
      : '';

    // Renderizar plantilla con banner de "Vista Master"
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
      DESHABILITADO_ATTR: suscripcionPausada ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''
    });

    // Añadir banner de "Vista Master" y deshabilitar edición
    html = html.replace(
      '<div class="header">',
      `<div style="background: #1e293b; color: white; padding: 15px; text-align: center; margin-bottom: 20px; border-radius: 12px;">
        <strong>🧙 Vista Master</strong> - Estás viendo el perfil como lo ve el cliente. Los selectores están deshabilitados.
        <a href="/admin/master/${alumnoId}" style="color: #60a5fa; margin-left: 15px;">← Volver al Modo Master</a>
      </div>
      <div class="header">`
    );

    // Deshabilitar los botones de guardar y los selectores
    html = html.replace(
      '<select id="lugar-select">',
      '<select id="lugar-select" disabled style="opacity: 0.6; cursor: not-allowed;">'
    );
    html = html.replace(
      '<select id="proyecto-select">',
      '<select id="proyecto-select" disabled style="opacity: 0.6; cursor: not-allowed;">'
    );
    html = html.replace(
      '<button class="boton-guardar" onclick="guardarLugar()">',
      '<button class="boton-guardar" onclick="guardarLugar()" disabled style="opacity: 0.6; cursor: not-allowed;">'
    );
    html = html.replace(
      '<button class="boton-guardar" onclick="guardarProyecto()">',
      '<button class="boton-guardar" onclick="guardarProyecto()" disabled style="opacity: 0.6; cursor: not-allowed;">'
    );

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
  } catch (error) {
    console.error('❌ Error en renderMasterView:', error);
    return new Response('Error interno del servidor: ' + error.message, { status: 500 });
  }
}

