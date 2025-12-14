// Script para eliminar secciones antiguas de limpieza que no fueron creadas desde el nuevo sistema
// Las secciones antiguas son las que tienen nombres hardcodeados y no tienen icono o fueron creadas antes del nuevo sistema

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

import { query } from '../database/pg.js';

const SECCIONES_ANTIGUAS = [
  'Anatomía Energética',
  'Anatomía energética',
  'anatomía energética',
  'Registros y Karmas',
  'Registros y karmas',
  'registros y karmas',
  'Energías Indeseables',
  'Energías indeseables',
  'energías indeseables',
  'Limpieza de Hogar',
  'Limpieza de hogar',
  'limpieza de hogar',
  'Lugares',
  'Proyectos'
];

async function eliminarSeccionesAntiguas() {
  try {
    console.log('🔍 Buscando secciones antiguas...');
    
    // Obtener todas las secciones (sin icono por si no existe)
    let todasSecciones;
    try {
      todasSecciones = await query(`
        SELECT id, nombre, created_at, activo
        FROM secciones_limpieza
        ORDER BY id
      `);
    } catch (error) {
      // Si falla, intentar con icono
      try {
        todasSecciones = await query(`
          SELECT id, nombre, icono, created_at, activo
          FROM secciones_limpieza
          ORDER BY id
        `);
      } catch (err2) {
        throw error;
      }
    }
    
    console.log(`\n📋 Secciones encontradas: ${todasSecciones.rows.length}`);
    todasSecciones.rows.forEach(sec => {
      const icono = sec.icono ? `, Icono: ${sec.icono}` : '';
      console.log(`  - ID: ${sec.id}, Nombre: "${sec.nombre}"${icono}, Activo: ${sec.activo}, Creado: ${sec.created_at}`);
    });
    
    // Identificar secciones antiguas (case-insensitive)
    const seccionesAEliminar = todasSecciones.rows.filter(sec => {
      // Normalizar nombre (minúsculas, sin espacios extra)
      const nombreNormalizado = sec.nombre.toLowerCase().trim();
      // Verificar si coincide con alguna sección antigua (case-insensitive)
      return SECCIONES_ANTIGUAS.some(antigua => 
        antigua.toLowerCase().trim() === nombreNormalizado
      );
    });
    
    if (seccionesAEliminar.length === 0) {
      console.log('\n✅ No se encontraron secciones antiguas para eliminar.');
      return;
    }
    
    console.log(`\n🗑️  Secciones a eliminar: ${seccionesAEliminar.length}`);
    seccionesAEliminar.forEach(sec => {
      console.log(`  - ID: ${sec.id}, Nombre: "${sec.nombre}"`);
    });
    
    // Eliminar aspectos asociados primero (poner seccion_id a NULL) - solo si la columna existe
    for (const seccion of seccionesAEliminar) {
      console.log(`\n🔄 Intentando eliminar aspectos asociados a sección ${seccion.id}...`);
      try {
        const aspectosActualizados = await query(`
          UPDATE aspectos_energeticos
          SET seccion_id = NULL
          WHERE seccion_id = $1
        `, [seccion.id]);
        console.log(`  ✅ ${aspectosActualizados.rowCount || 0} aspectos actualizados (seccion_id = NULL)`);
      } catch (error) {
        if (error.message.includes('seccion_id') || error.code === '42703') {
          console.log(`  ⚠️  La columna seccion_id no existe aún, omitiendo actualización de aspectos`);
        } else {
          throw error;
        }
      }
    }
    
    // Eliminar las secciones (soft delete: poner activo = false)
    for (const seccion of seccionesAEliminar) {
      console.log(`\n🗑️  Eliminando sección ${seccion.id} ("${seccion.nombre}")...`);
      await query(`
        UPDATE secciones_limpieza
        SET activo = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [seccion.id]);
      console.log(`  ✅ Sección ${seccion.id} eliminada (activo = false)`);
    }
    
    console.log(`\n✅ Proceso completado. ${seccionesAEliminar.length} secciones eliminadas.`);
    
    // Mostrar secciones restantes
    let seccionesRestantes;
    try {
      seccionesRestantes = await query(`
        SELECT id, nombre, activo
        FROM secciones_limpieza
        WHERE activo = true
        ORDER BY id
      `);
    } catch (error) {
      try {
        seccionesRestantes = await query(`
          SELECT id, nombre, icono, activo
          FROM secciones_limpieza
          WHERE activo = true
          ORDER BY id
        `);
      } catch (err2) {
        throw error;
      }
    }
    
    console.log(`\n📋 Secciones activas restantes: ${seccionesRestantes.rows.length}`);
    seccionesRestantes.rows.forEach(sec => {
      const icono = sec.icono ? `, Icono: ${sec.icono}` : '';
      console.log(`  - ID: ${sec.id}, Nombre: "${sec.nombre}"${icono}`);
    });
    
  } catch (error) {
    console.error('❌ Error eliminando secciones antiguas:', error);
    throw error;
  }
}

// Ejecutar
eliminarSeccionesAntiguas()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  });

