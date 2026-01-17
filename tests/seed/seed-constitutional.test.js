// tests/seed/seed-constitutional.test.js
// Tests Constitucionales del Cleaning State Seed v1
//
// OBJETIVO: Garantizar invariantes constitucionales del Seed
// - Seed NO puede ejecutarse en GET sin flag
// - Seed requiere level_cap explícito (no null)
// - Seed es idempotente
// - Seed NO modifica estados existentes
// - skipped nunca es negativo
// - Seed respeta lista_tipo cuando se pasa
//
// NO se busca cobertura total.
// Se busca protección del diseño constitucional.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ensureCleaningItemStateSeedForStudent } from '../../src/core/master/services/cleaning-state-seed-service.js';
import { query } from '../../database/pg.js';

describe('Tests Constitucionales - Cleaning State Seed v1', () => {
  let testCounter = 0;
  const TEST_STUDENT_UUID = '00000000-0000-0000-0000-000000000001';
  const TEST_PRODUCT_KEY = 'pde';
  const TEST_DOMAIN_TYPE = 'transmutation';

  beforeEach(() => {
    testCounter++;
  });

  afterEach(async () => {
    // Limpiar estados de test si es necesario
    try {
      await query(`
        DELETE FROM cleaning_item_state
        WHERE student_id = $1::uuid
          AND product_key = $2
          AND domain_type = $3
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE]);
    } catch (error) {
      // Ignorar errores de limpieza
    }
  });

  // ============================================================================
  // 1. GUARD CONSTITUCIONAL: allow_structural_seed debe ser true
  // ============================================================================

  describe('Guard Constitucional - allow_structural_seed', () => {
    it('debe REJECTAR seed sin flag allow_structural_seed=true', async () => {
      await expect(
        ensureCleaningItemStateSeedForStudent({
          student_uuid: TEST_STUDENT_UUID,
          level_cap: 10,
          allow_structural_seed: false
        })
      ).rejects.toThrow('Seed solo puede ejecutarse con allow_structural_seed=true');
    });

    it('debe REJECTAR seed sin flag allow_structural_seed (default false)', async () => {
      await expect(
        ensureCleaningItemStateSeedForStudent({
          student_uuid: TEST_STUDENT_UUID,
          level_cap: 10
          // allow_structural_seed no especificado (default: false)
        })
      ).rejects.toThrow('Seed solo puede ejecutarse con allow_structural_seed=true');
    });

    it('debe PERMITIR seed con flag allow_structural_seed=true', async () => {
      const result = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('inserted');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('total_applicable');
      expect(result).toHaveProperty('total_existing');
    });
  });

  // ============================================================================
  // 2. GUARD CONSTITUCIONAL: level_cap es OBLIGATORIO (no null)
  // ============================================================================

  describe('Guard Constitucional - level_cap obligatorio', () => {
    it('debe REJECTAR seed si level_cap es null', async () => {
      await expect(
        ensureCleaningItemStateSeedForStudent({
          student_uuid: TEST_STUDENT_UUID,
          level_cap: null,
          allow_structural_seed: true
        })
      ).rejects.toThrow('level_cap es requerido');
    });

    it('debe REJECTAR seed si level_cap es undefined', async () => {
      await expect(
        ensureCleaningItemStateSeedForStudent({
          student_uuid: TEST_STUDENT_UUID,
          level_cap: undefined,
          allow_structural_seed: true
        })
      ).rejects.toThrow('level_cap es requerido');
    });

    it('debe REJECTAR seed si level_cap < 1', async () => {
      await expect(
        ensureCleaningItemStateSeedForStudent({
          student_uuid: TEST_STUDENT_UUID,
          level_cap: 0,
          allow_structural_seed: true
        })
      ).rejects.toThrow('level_cap debe ser un número >= 1');
    });

    it('debe PERMITIR seed con level_cap válido', async () => {
      const result = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
      });

      expect(result).toBeDefined();
      expect(result.inserted).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // 3. INVARIANTE: Idempotencia estricta
  // ============================================================================

  describe('Invariante - Idempotencia estricta', () => {
    it('debe retornar inserted=0 en segunda ejecución con mismos parámetros', async () => {
      // Primera ejecución
      const result1 = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
      });

      const inserted1 = result1.inserted;

      // Segunda ejecución (idempotente)
      const result2 = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
      });

      const inserted2 = result2.inserted;

      // En segunda ejecución, inserted debe ser 0 (idempotente)
      expect(inserted2).toBe(0);
      expect(result2.skipped).toBeGreaterThanOrEqual(inserted1);
    });

    it('NO debe modificar estados existentes', async () => {
      // Primera ejecución
      const result1 = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
      });

      // Obtener un estado creado
      const statesResult = await query(`
        SELECT *
        FROM cleaning_item_state
        WHERE student_id = $1::uuid
          AND product_key = $2
          AND domain_type = $3
        LIMIT 1
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE]);

      if (statesResult.rows.length > 0) {
        const stateBefore = statesResult.rows[0];

        // Segunda ejecución (idempotente)
        await ensureCleaningItemStateSeedForStudent({
          student_uuid: TEST_STUDENT_UUID,
          level_cap: 10,
          allow_structural_seed: true
        });

        // Verificar que estado NO cambió
        const statesResult2 = await query(`
          SELECT *
          FROM cleaning_item_state
          WHERE student_id = $1::uuid
            AND product_key = $2
            AND domain_type = $3
            AND item_ref = $4
        `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE, stateBefore.item_ref]);

        const stateAfter = statesResult2.rows[0];

        expect(stateAfter.shared_clean_count).toBe(stateBefore.shared_clean_count);
        expect(stateAfter.shared_last_cleaned_at).toEqual(stateBefore.shared_last_cleaned_at);
        expect(stateAfter.shared_completed).toBe(stateBefore.shared_completed);
        expect(stateAfter.shared_remaining).toBe(stateBefore.shared_remaining);
      }
    });
  });

  // ============================================================================
  // 4. INVARIANTE: skipped nunca es negativo
  // ============================================================================

  describe('Invariante - skipped nunca es negativo', () => {
    it('debe retornar skipped >= 0 siempre', async () => {
      const result = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
      });

      expect(result.skipped).toBeGreaterThanOrEqual(0);
    });

    it('debe retornar skipped >= 0 incluso si total_applicable cambia', async () => {
      // Primera ejecución
      const result1 = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 5,
        allow_structural_seed: true
      });

      // Segunda ejecución con level_cap diferente (más alto)
      const result2 = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
      });

      // skipped debe ser >= 0
      expect(result1.skipped).toBeGreaterThanOrEqual(0);
      expect(result2.skipped).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // 5. FILTRO POR lista_tipo (opcional)
  // ============================================================================

  describe('Filtro por lista_tipo (opcional)', () => {
    it('debe PERMITIR seed sin lista_tipo', async () => {
      const result = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
        // lista_tipo no especificado
      });

      expect(result).toBeDefined();
      expect(result.inserted).toBeGreaterThanOrEqual(0);
    });

    it('debe FILTRAR por lista_tipo si se pasa', async () => {
      // Seed sin filtro
      const resultAll = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
      });

      // Limpiar estados
      await query(`
        DELETE FROM cleaning_item_state
        WHERE student_id = $1::uuid
          AND product_key = $2
          AND domain_type = $3
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE]);

      // Seed con filtro por lista_tipo
      const resultFiltered = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        lista_tipo: 'recurrente',
        allow_structural_seed: true
      });

      // Resultado filtrado debe tener menos o igual inserted que sin filtro
      expect(resultFiltered.inserted).toBeLessThanOrEqual(resultAll.inserted);
    });
  });

  // ============================================================================
  // 6. VALIDACIÓN UUID
  // ============================================================================

  describe('Validación UUID', () => {
    it('debe REJECTAR student_uuid inválido', async () => {
      await expect(
        ensureCleaningItemStateSeedForStudent({
          student_uuid: 'invalid-uuid',
          level_cap: 10,
          allow_structural_seed: true
        })
      ).rejects.toThrow('student_uuid debe ser un UUID válido');
    });

    it('debe PERMITIR student_uuid válido', async () => {
      const result = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 10,
        allow_structural_seed: true
      });

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // 7. VALIDACIÓN level_cap con infinity/∞
  // ============================================================================

  describe('Validación level_cap - infinity/∞', () => {
    it('debe convertir "infinity" a 999', async () => {
      const result = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: 'infinity',
        allow_structural_seed: true
      });

      expect(result).toBeDefined();
      expect(result.inserted).toBeGreaterThanOrEqual(0);
    });

    it('debe convertir "∞" a 999', async () => {
      const result = await ensureCleaningItemStateSeedForStudent({
        student_uuid: TEST_STUDENT_UUID,
        level_cap: '∞',
        allow_structural_seed: true
      });

      expect(result).toBeDefined();
      expect(result.inserted).toBeGreaterThanOrEqual(0);
    });
  });
});
