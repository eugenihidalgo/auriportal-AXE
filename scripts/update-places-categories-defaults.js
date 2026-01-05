// scripts/update-places-categories-defaults.js
// Actualiza las categorías por defecto con valores más potentes

import { query, initPostgreSQL } from '../database/pg.js';

async function updateCategories() {
  try {
    console.log('🔄 Actualizando categorías por defecto...\n');

    initPostgreSQL();

    // Actualizar o insertar categorías
    const categories = [
      { key: 'lugar_meditacion', name: 'Lugar de meditación', recurrence: 30, sort: 1 },
      { key: 'casa', name: 'Casa', recurrence: 30, sort: 2 },
      { key: 'segunda_residencia', name: 'Segunda residencia', recurrence: 45, sort: 3 },
      { key: 'trabajo', name: 'Trabajo', recurrence: 30, sort: 4 },
      { key: 'casa_ajena', name: 'Casa ajena', recurrence: 90, sort: 5 },
      { key: 'otro', name: 'Otro', recurrence: 30, sort: 6 }
    ];

    for (const cat of categories) {
      await query(`
        INSERT INTO place_categories (category_key, name, default_recurrence_days, sort_order, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (category_key) 
        DO UPDATE SET
          name = EXCLUDED.name,
          default_recurrence_days = EXCLUDED.default_recurrence_days,
          sort_order = EXCLUDED.sort_order,
          is_active = TRUE,
          deleted_at = NULL
      `, [cat.key, cat.name, cat.recurrence, cat.sort]);
      console.log(`✅ Categoría "${cat.name}" actualizada`);
    }

    console.log('\n✅ Categorías actualizadas correctamente\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error actualizando categorías:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

updateCategories();
