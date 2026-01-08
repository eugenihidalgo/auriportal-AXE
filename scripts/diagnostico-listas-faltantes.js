#!/usr/bin/env node
/**
 * DIAGNÓSTICO: Listas faltantes en Alquimia Alumno
 * 
 * Verifica:
 * - nivel_efectivo real de alumnos
 * - Estados antes/después de seed
 * - Distribución por lista_id y nivel
 * - Gap entre catálogo aplicable y states
 */

import { query } from '../database/pg.js';

async function main() {
  console.log('=== DIAGNÓSTICO: LISTAS FALTANTES ALQUIMIA ALUMNO ===\n');

  // A) Nivel efectivo real
  console.log('A) Datos de alumnos 4 y 6:');
  const alumnos = await query(`
    SELECT id, email, nivel_actual
    FROM alumnos
    WHERE id IN (4, 6)
  `);
  console.log(JSON.stringify(alumnos.rows, null, 2));
  console.log('');

  // Calcular nivel efectivo usando la función canónica
  const { getStudentEffectiveLevel } = await import('../src/core/master/services/cleaning-engine-service.js');
  const nivel4 = await getStudentEffectiveLevel(4, 'pde');
  const nivel6 = await getStudentEffectiveLevel(6, 'pde');
  
  console.log(`Nivel efectivo calculado (student_id=4): ${nivel4}`);
  console.log(`Nivel efectivo calculado (student_id=6): ${nivel6}`);
  console.log('');

  // B) Estados ANTES
  console.log('B) Estados ANTES de llamar /megalist:');
  const statesAntes = await query(`
    SELECT student_id, COUNT(*) total_states
    FROM cleaning_item_state
    WHERE student_id IN (4, 6)
      AND product_key = 'pde'
      AND domain_type = 'transmutation'
    GROUP BY student_id
  `);
  console.log(JSON.stringify(statesAntes.rows, null, 2));
  console.log('');

  // C) Catálogo aplicable por nivel_efectivo (student_id=4)
  console.log(`C1) Catálogo aplicable para student_id=4 (nivel_efectivo=${nivel4}):`);
  const catalogo4 = await query(`
    SELECT lista_id, COUNT(*) cnt
    FROM items_transmutaciones
    WHERE (status = 'active' OR activo = true)
      AND item_ref IS NOT NULL
      AND (nivel IS NULL OR nivel <= $1)
    GROUP BY lista_id
    ORDER BY cnt DESC
  `, [nivel4]);
  console.log(JSON.stringify(catalogo4.rows, null, 2));
  console.log(`Total items aplicables: ${catalogo4.rows.reduce((sum, r) => sum + parseInt(r.cnt), 0)}`);
  console.log('');

  // C2) States por lista_id (student_id=4) usando join catálogo
  console.log('C2) States por lista_id (student_id=4) tras seed:');
  const statesPorLista4 = await query(`
    SELECT i.lista_id, COUNT(*) cnt
    FROM cleaning_item_state s
    JOIN items_transmutaciones i ON i.item_ref = s.item_ref
    WHERE s.student_id = 4
      AND s.product_key = 'pde'
      AND s.domain_type = 'transmutation'
    GROUP BY i.lista_id
    ORDER BY cnt DESC
  `);
  console.log(JSON.stringify(statesPorLista4.rows, null, 2));
  console.log(`Total states con lista resuelta: ${statesPorLista4.rows.reduce((sum, r) => sum + parseInt(r.cnt), 0)}`);
  console.log('');

  // C3) Distribución por nivel (catálogo aplicable)
  console.log(`C3) Distribución por nivel (catálogo aplicable, nivel <= ${nivel4}):`);
  const distribNivel = await query(`
    SELECT nivel, COUNT(*) cnt
    FROM items_transmutaciones
    WHERE (status = 'active' OR activo = true)
      AND item_ref IS NOT NULL
      AND (nivel IS NULL OR nivel <= $1)
    GROUP BY nivel
    ORDER BY nivel ASC NULLS LAST
  `, [nivel4]);
  console.log(JSON.stringify(distribNivel.rows, null, 2));
  console.log('');

  // C4) Gap: listas en catálogo pero sin states
  console.log('C4) Gap: listas en catálogo aplicable pero sin states:');
  const listasSinStates = await query(`
    SELECT DISTINCT i.lista_id
    FROM items_transmutaciones i
    WHERE (i.status = 'active' OR i.activo = true)
      AND i.item_ref IS NOT NULL
      AND (i.nivel IS NULL OR i.nivel <= $1)
      AND NOT EXISTS (
        SELECT 1
        FROM cleaning_item_state s
        WHERE s.student_id = 4
          AND s.product_key = 'pde'
          AND s.domain_type = 'transmutation'
          AND s.item_ref = i.item_ref
      )
    GROUP BY i.lista_id
    ORDER BY i.lista_id
  `, [nivel4]);
  console.log(JSON.stringify(listasSinStates.rows, null, 2));
  console.log(`Total listas con items sin estado: ${listasSinStates.rows.length}`);
  console.log('');

  // D) Catálogo con cap=∞ (999) para ver qué se pierde
  console.log('D) Catálogo aplicable con cap=∞ (999):');
  const catalogoInfinito = await query(`
    SELECT lista_id, COUNT(*) cnt
    FROM items_transmutaciones
    WHERE (status = 'active' OR activo = true)
      AND item_ref IS NOT NULL
      AND (nivel IS NULL OR nivel <= 999)
    GROUP BY lista_id
    ORDER BY cnt DESC
  `);
  console.log(JSON.stringify(catalogoInfinito.rows, null, 2));
  console.log(`Total items con cap=∞: ${catalogoInfinito.rows.reduce((sum, r) => sum + parseInt(r.cnt), 0)}`);
  console.log('');

  // E) Items de nivel > nivel_efectivo que se pierden
  console.log(`E) Items de nivel > ${nivel4} que se pierden con cap actual:`);
  const itemsPerdidos = await query(`
    SELECT lista_id, nivel, COUNT(*) cnt
    FROM items_transmutaciones
    WHERE (status = 'active' OR activo = true)
      AND item_ref IS NOT NULL
      AND nivel IS NOT NULL
      AND nivel > $1
    GROUP BY lista_id, nivel
    ORDER BY nivel ASC, lista_id ASC
  `, [nivel4]);
  console.log(JSON.stringify(itemsPerdidos.rows, null, 2));
  console.log(`Total items perdidos: ${itemsPerdidos.rows.reduce((sum, r) => sum + parseInt(r.cnt), 0)}`);
  console.log('');

  console.log('=== FIN DIAGNÓSTICO ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
