// scripts/create-motor-limpiezas-energeticas.js
// Script para crear el motor PDE motor_limpiezas_energeticas

import { query } from '../database/pg.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const motorDefinition = {
  inputs: [
    {
      key: 'tipo_limpieza',
      type: 'enum',
      required: true,
      options: ['rapida', 'basica', 'profunda', 'maestro'],
      description: 'Tipo de limpieza energética'
    },
    {
      key: 'nivel_efectivo',
      type: 'number',
      required: true,
      description: 'Nivel efectivo del alumno'
    }
  ],
  rules: {
    // Límites por tipo de limpieza
    limites: {
      rapida: 5,
      basica: 10,
      profunda: 25,
      maestro: 40
    },
    // Catálogos a usar
    catalogos: {
      transmutaciones: 'transmutaciones_energeticas',
      tecnicas: 'tecnicas_limpieza'
    }
  },
  outputs: {
    // Este motor no genera steps/edges, sino que modifica el context
    // Por eso outputs está vacío
    steps: [],
    edges: [],
    captures: []
  }
};

async function createMotor() {
  try {
    console.log('[PDE][MOTOR][LIMPIEZAS] Creando motor motor_limpiezas_energeticas...');

    // Verificar si ya existe
    const existing = await query(
      'SELECT * FROM pde_motors WHERE motor_key = $1 AND deleted_at IS NULL',
      ['motor_limpiezas_energeticas']
    );

    if (existing.rows.length > 0) {
      console.log('[PDE][MOTOR][LIMPIEZAS] ⚠️  El motor ya existe. Actualizando...');
      const result = await query(
        `UPDATE pde_motors 
         SET name = $1, description = $2, category = $3, definition = $4::jsonb, version = version + 1, updated_at = NOW()
         WHERE motor_key = $5 AND deleted_at IS NULL
         RETURNING *`,
        [
          'Motor de Limpiezas Energéticas',
          'Genera listas de limpiezas energéticas agrupadas por categoría principal y lista contextual, según tipo de limpieza y nivel del alumno',
          'limpiezas',
          JSON.stringify(motorDefinition),
          'motor_limpiezas_energeticas'
        ]
      );
      console.log('[PDE][MOTOR][LIMPIEZAS] ✅ Motor actualizado:', result.rows[0].id);
      return result.rows[0];
    }

    // Crear nuevo motor
    const result = await query(
      `INSERT INTO pde_motors (motor_key, name, description, category, version, status, definition, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
       RETURNING *`,
      [
        'motor_limpiezas_energeticas',
        'Motor de Limpiezas Energéticas',
        'Genera listas de limpiezas energéticas agrupadas por categoría principal y lista contextual, según tipo de limpieza y nivel del alumno',
        'limpiezas',
        1,
        'published',
        JSON.stringify(motorDefinition)
      ]
    );

    console.log('[PDE][MOTOR][LIMPIEZAS] ✅ Motor creado exitosamente:', result.rows[0].id);
    console.log('[PDE][MOTOR][LIMPIEZAS] Motor Key:', result.rows[0].motor_key);
    console.log('[PDE][MOTOR][LIMPIEZAS] Status:', result.rows[0].status);
    console.log('[PDE][MOTOR][LIMPIEZAS] Version:', result.rows[0].version);

    return result.rows[0];
  } catch (error) {
    console.error('[PDE][MOTOR][LIMPIEZAS] ❌ Error creando motor:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  createMotor()
    .then(() => {
      console.log('[PDE][MOTOR][LIMPIEZAS] ✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[PDE][MOTOR][LIMPIEZAS] ❌ Error:', error);
      process.exit(1);
    });
}

export { createMotor };



