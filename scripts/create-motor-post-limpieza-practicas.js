// scripts/create-motor-post-limpieza-practicas.js
// Script para crear el motor PDE motor_post_limpieza_practicas

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
      required: false,
      options: ['rapida', 'basica', 'profunda', 'maestro'],
      description: 'Tipo de limpieza energética realizada'
    },
    {
      key: 'nivel_efectivo',
      type: 'number',
      required: false,
      description: 'Nivel efectivo del alumno (permite {{context.nivel_efectivo}})'
    }
  ],
  rules: {
    // Límites por tipo de limpieza
    limites: {
      rapida: 2,
      basica: 3,
      profunda: 5,
      maestro: 7
    }
  },
  outputs: {
    // Este motor no genera steps/edges, sino que modifica el context
    // Escribe en context.post_practices
    steps: [],
    edges: [],
    captures: []
  }
};

async function createMotor() {
  try {
    console.log('[PDE][MOTOR][POST_LIMPIEZA] Creando motor motor_post_limpieza_practicas...');

    // Verificar si ya existe
    const existing = await query(
      'SELECT * FROM pde_motors WHERE motor_key = $1 AND deleted_at IS NULL',
      ['motor_post_limpieza_practicas']
    );

    if (existing.rows.length > 0) {
      console.log('[PDE][MOTOR][POST_LIMPIEZA] ⚠️  El motor ya existe. Actualizando...');
      const result = await query(
        `UPDATE pde_motors 
         SET name = $1, description = $2, category = $3, definition = $4::jsonb, version = version + 1, updated_at = NOW()
         WHERE motor_key = $5 AND deleted_at IS NULL
         RETURNING *`,
        [
          'Motor de Prácticas Post-Limpieza',
          'Decide las prácticas posteriores a la limpieza energética según tipo de limpieza y nivel efectivo del alumno',
          'practicas',
          JSON.stringify(motorDefinition),
          'motor_post_limpieza_practicas'
        ]
      );
      console.log('[PDE][MOTOR][POST_LIMPIEZA] ✅ Motor actualizado:', result.rows[0].id);
      return result.rows[0];
    }

    // Crear nuevo motor
    const result = await query(
      `INSERT INTO pde_motors (motor_key, name, description, category, version, status, definition, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
       RETURNING *`,
      [
        'motor_post_limpieza_practicas',
        'Motor de Prácticas Post-Limpieza',
        'Decide las prácticas posteriores a la limpieza energética según tipo de limpieza y nivel efectivo del alumno',
        'practicas',
        1,
        'published',
        JSON.stringify(motorDefinition)
      ]
    );

    console.log('[PDE][MOTOR][POST_LIMPIEZA] ✅ Motor creado exitosamente:', result.rows[0].id);
    console.log('[PDE][MOTOR][POST_LIMPIEZA] Motor Key:', result.rows[0].motor_key);
    console.log('[PDE][MOTOR][POST_LIMPIEZA] Status:', result.rows[0].status);
    console.log('[PDE][MOTOR][POST_LIMPIEZA] Version:', result.rows[0].version);

    return result.rows[0];
  } catch (error) {
    console.error('[PDE][MOTOR][POST_LIMPIEZA] ❌ Error creando motor:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  createMotor()
    .then(() => {
      console.log('[PDE][MOTOR][POST_LIMPIEZA] ✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[PDE][MOTOR][POST_LIMPIEZA] ❌ Error:', error);
      process.exit(1);
    });
}

export { createMotor };



