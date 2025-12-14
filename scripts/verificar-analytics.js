// scripts/verificar-analytics.js
// Script de verificación del sistema de Analytics

import { query, getPool } from '../database/pg.js';
import { analytics } from '../src/services/analytics.js';

async function verificarAnalytics() {
  console.log('🔍 Verificando sistema de Analytics...\n');

  try {
    // 1. Verificar que las tablas existen
    console.log('1️⃣ Verificando tablas...');
    const tablas = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('analytics_eventos', 'analytics_resumen_diario')
      ORDER BY table_name
    `);
    
    const tablasEncontradas = tablas.rows.map(r => r.table_name);
    const tablasEsperadas = ['analytics_eventos', 'analytics_resumen_diario'];
    
    for (const tabla of tablasEsperadas) {
      if (tablasEncontradas.includes(tabla)) {
        console.log(`   ✅ Tabla ${tabla} existe`);
      } else {
        console.log(`   ❌ Tabla ${tabla} NO existe`);
      }
    }

    // 2. Verificar índices
    console.log('\n2️⃣ Verificando índices...');
    const indices = await query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN ('analytics_eventos', 'analytics_resumen_diario')
    `);
    
    const indicesEsperados = [
      'idx_analytics_eventos_alumno',
      'idx_analytics_eventos_tipo',
      'idx_analytics_eventos_fecha',
      'idx_analytics_resumen_fecha'
    ];
    
    const indicesEncontrados = indices.rows.map(r => r.indexname);
    for (const indice of indicesEsperados) {
      if (indicesEncontrados.includes(indice)) {
        console.log(`   ✅ Índice ${indice} existe`);
      } else {
        console.log(`   ⚠️  Índice ${indice} NO existe (no crítico)`);
      }
    }

    // 3. Verificar eventos registrados
    console.log('\n3️⃣ Verificando eventos registrados...');
    const totalEventos = await query('SELECT COUNT(*) as total FROM analytics_eventos');
    console.log(`   📊 Total de eventos: ${totalEventos.rows[0].total}`);

    const eventosPorTipo = await query(`
      SELECT tipo_evento, COUNT(*) as total
      FROM analytics_eventos
      GROUP BY tipo_evento
      ORDER BY total DESC
    `);
    
    if (eventosPorTipo.rows.length > 0) {
      console.log('   📈 Eventos por tipo:');
      eventosPorTipo.rows.forEach(e => {
        console.log(`      - ${e.tipo_evento}: ${e.total}`);
      });
    } else {
      console.log('   ⚠️  No hay eventos registrados aún');
    }

    // 4. Verificar resumen diario
    console.log('\n4️⃣ Verificando resumen diario...');
    const resumenes = await query('SELECT COUNT(*) as total FROM analytics_resumen_diario');
    console.log(`   📊 Total de resúmenes: ${resumenes.rows[0].total}`);

    const ultimoResumen = await query(`
      SELECT * FROM analytics_resumen_diario
      ORDER BY fecha DESC
      LIMIT 1
    `);
    
    if (ultimoResumen.rows.length > 0) {
      const r = ultimoResumen.rows[0];
      console.log(`   📅 Último resumen: ${r.fecha}`);
      console.log(`      - Alumnos activos: ${r.alumnos_activos}`);
      console.log(`      - Prácticas totales: ${r.practicas_totales}`);
      console.log(`      - Nivel promedio: ${parseFloat(r.nivel_promedio).toFixed(1)}`);
    } else {
      console.log('   ⚠️  No hay resúmenes diarios. Ejecuta calcularResumenDiario()');
    }

    // 5. Probar registro de evento
    console.log('\n5️⃣ Probando registro de evento...');
    try {
      await analytics.registrarEvento({
        tipo_evento: 'test_verificacion',
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      });
      console.log('   ✅ Evento de prueba registrado correctamente');
      
      // Eliminar evento de prueba
      await query('DELETE FROM analytics_eventos WHERE tipo_evento = $1', ['test_verificacion']);
      console.log('   🧹 Evento de prueba eliminado');
    } catch (error) {
      console.log(`   ❌ Error registrando evento de prueba: ${error.message}`);
    }

    // 6. Verificar estadísticas generales
    console.log('\n6️⃣ Verificando estadísticas generales...');
    try {
      const stats = await analytics.getEstadisticasGenerales();
      console.log(`   ✅ Estadísticas obtenidas:`);
      console.log(`      - Total eventos: ${stats.total_eventos}`);
      console.log(`      - Últimos 7 días: ${stats.eventos_ultimos_7_dias}`);
      console.log(`      - Últimos 30 días: ${stats.eventos_ultimos_30_dias}`);
      console.log(`      - Tipos diferentes: ${stats.eventos_por_tipo.length}`);
    } catch (error) {
      console.log(`   ❌ Error obteniendo estadísticas: ${error.message}`);
    }

    // 7. Verificar integración con webhook
    console.log('\n7️⃣ Verificando integración con webhook...');
    const eventosWebhook = await query(`
      SELECT COUNT(*) as total
      FROM analytics_eventos
      WHERE tipo_evento = 'webhook_typeform'
    `);
    console.log(`   📊 Eventos de webhook registrados: ${eventosWebhook.rows[0].total}`);

    const eventosPractica = await query(`
      SELECT COUNT(*) as total
      FROM analytics_eventos
      WHERE tipo_evento = 'confirmacion_practica'
    `);
    console.log(`   📊 Prácticas confirmadas registradas: ${eventosPractica.rows[0].total}`);

    console.log('\n✅ Verificación completada');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Accede a /admin/analytics para ver el panel');
    console.log('   2. Envía un Typeform para generar eventos');
    console.log('   3. Usa el botón "Calcular Resumen Diario" en el panel');
    console.log('   4. Verifica que los eventos aparezcan en la tabla');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
    process.exit(1);
  } finally {
    const pool = getPool();
    if (pool) {
      await pool.end();
    }
  }
}

verificarAnalytics();




