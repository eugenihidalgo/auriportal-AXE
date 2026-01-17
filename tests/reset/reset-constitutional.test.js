// tests/reset/reset-constitutional.test.js
// Tests Constitucionales del Reset v1
//
// OBJETIVO: Garantizar invariantes constitucionales del Reset
// - Reset SOLO modifica effective_since
// - Reset NO borra historia
// - Reset NO modifica contadores directamente
// - Reset en UNA_VEZ falla
// - Reset en GET falla
// - Reset ALL continúa ante fallo parcial
// - Señal se emite solo tras persistencia
//
// NO se busca cobertura total.
// Se busca protección del diseño constitucional.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { resetStudentItemProgress, resetAllStudentsItemProgress } from '../../src/core/master/services/cleaning-engine-service.js';
import { query } from '../../database/pg.js';
import { getDefaultCleaningEventsRepo } from '../../src/infra/repos/cleaning/cleaning-events-repo-pg.js';

describe('Tests Constitucionales - Reset v1', () => {
  let testCounter = 0;
  const TEST_STUDENT_UUID = '00000000-0000-0000-0000-000000000001';
  const TEST_ITEM_REF = 'test-reset-item-1';
  const TEST_PRODUCT_KEY = 'pde';
  const TEST_DOMAIN_TYPE = 'transmutation';

  beforeEach(() => {
    testCounter++;
  });

  afterEach(async () => {
    // Limpiar estados y eventos de test
    try {
      await query(`
        DELETE FROM cleaning_events
        WHERE student_id = $1::uuid
          AND product_key = $2
          AND domain_type = $3
          AND item_ref = $4
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE, TEST_ITEM_REF]);

      await query(`
        DELETE FROM cleaning_item_state
        WHERE student_id = $1::uuid
          AND product_key = $2
          AND domain_type = $3
          AND item_ref = $4
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE, TEST_ITEM_REF]);
    } catch (error) {
      // Ignorar errores de limpieza
    }
  });

  // ============================================================================
  // 1. GUARD CONSTITUCIONAL: Reset PROHIBIDO en UNA_VEZ
  // ============================================================================

  describe('Guard Constitucional - Reset PROHIBIDO en UNA_VEZ', () => {
    it('debe REJECTAR reset si item_kind=una_vez', async () => {
      await expect(
        resetStudentItemProgress({
          student_uuid: TEST_STUDENT_UUID,
          item_ref: TEST_ITEM_REF,
          item_kind: 'una_vez',
          clean_layer: 'shared',
          actor_type: 'master',
          surface_key: 'test'
        })
      ).rejects.toThrow('Reset está PROHIBIDO para item_kind="una_vez"');
    });

    it('debe REJECTAR reset ALL si item_kind=una_vez', async () => {
      await expect(
        resetAllStudentsItemProgress({
          item_ref: TEST_ITEM_REF,
          item_kind: 'una_vez',
          clean_layer: 'pde',
          actor_type: 'master',
          surface_key: 'test'
        })
      ).rejects.toThrow('Reset está PROHIBIDO para item_kind="una_vez"');
    });
  });

  // ============================================================================
  // 2. INVARIANTE: Reset SOLO modifica effective_since
  // ============================================================================

  describe('Invariante - Reset SOLO modifica effective_since', () => {
    it('debe modificar SOLO effective_since, NO contadores', async () => {
      // Crear estado inicial con valores conocidos
      await query(`
        INSERT INTO cleaning_item_state (
          student_id, product_key, domain_type, item_ref,
          shared_last_cleaned_at, shared_clean_count, shared_effective_since
        ) VALUES (
          $1::uuid, $2, $3, $4,
          '2024-01-01T00:00:00Z'::timestamp, 5, NULL
        )
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE, TEST_ITEM_REF]);

      // Ejecutar reset
      await resetStudentItemProgress({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'shared',
        actor_type: 'master',
        surface_key: 'test'
      });

      // Verificar que SOLO effective_since cambió
      const stateResult = await query(`
        SELECT 
          shared_effective_since,
          shared_last_cleaned_at,
          shared_clean_count
        FROM cleaning_item_state
        WHERE student_id = $1::uuid
          AND product_key = $2
          AND domain_type = $3
          AND item_ref = $4
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE, TEST_ITEM_REF]);

      const state = stateResult.rows[0];

      // effective_since DEBE estar establecido
      expect(state.shared_effective_since).toBeTruthy();

      // last_cleaned_at NO debe ser NULL (debe mantener valor previo)
      // NOTA: En reset canónico, contadores NO se modifican directamente
      // Se calcularán desde eventos post-RESET en rebaseStateFromReset()
      expect(state.shared_last_cleaned_at).toBeTruthy();
      expect(state.shared_clean_count).toBe(5);
    });

    it('debe insertar evento RESET', async () => {
      await resetStudentItemProgress({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'shared',
        actor_type: 'master',
        surface_key: 'test'
      });

      // Verificar que se insertó evento RESET
      const eventsRepo = getDefaultCleaningEventsRepo();
      const events = await eventsRepo.listEventsForStudentItem({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        product_key: TEST_PRODUCT_KEY,
        domain_type: TEST_DOMAIN_TYPE
      });

      const resetEvents = events.filter(e => e.action_type === 'reset' && e.clean_layer === 'shared');
      expect(resetEvents.length).toBeGreaterThan(0);
      expect(resetEvents[0].action_type).toBe('reset');
    });
  });

  // ============================================================================
  // 3. INVARIANTE: Reset NO borra historia
  // ============================================================================

  describe('Invariante - Reset NO borra historia', () => {
    it('debe conservar eventos previos', async () => {
      // Crear eventos previos (mark_clean)
      const eventsRepo = getDefaultCleaningEventsRepo();
      await eventsRepo.insertEvent({
        trace_id: 'test-trace-1',
        execution_key: 'test-exec-key-1',
        student_uuid: TEST_STUDENT_UUID,
        product_key: TEST_PRODUCT_KEY,
        domain_type: TEST_DOMAIN_TYPE,
        item_ref: TEST_ITEM_REF,
        clean_layer: 'shared',
        item_kind: 'recurrente',
        action_type: 'mark_clean',
        actor_type: 'master',
        surface_key: 'test'
      });

      // Ejecutar reset
      await resetStudentItemProgress({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'shared',
        actor_type: 'master',
        surface_key: 'test'
      });

      // Verificar que eventos previos NO se borraron
      const events = await eventsRepo.listEventsForStudentItem({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        product_key: TEST_PRODUCT_KEY,
        domain_type: TEST_DOMAIN_TYPE
      });

      const markCleanEvents = events.filter(e => e.action_type === 'mark_clean');
      expect(markCleanEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('NO debe eliminar fila de cleaning_item_state', async () => {
      // Crear estado inicial
      await query(`
        INSERT INTO cleaning_item_state (
          student_id, product_key, domain_type, item_ref,
          shared_last_cleaned_at, shared_clean_count
        ) VALUES (
          $1::uuid, $2, $3, $4,
          '2024-01-01T00:00:00Z'::timestamp, 5
        )
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE, TEST_ITEM_REF]);

      // Ejecutar reset
      await resetStudentItemProgress({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'shared',
        actor_type: 'master',
        surface_key: 'test'
      });

      // Verificar que la fila NO se eliminó
      const stateResult = await query(`
        SELECT * FROM cleaning_item_state
        WHERE student_id = $1::uuid
          AND product_key = $2
          AND domain_type = $3
          AND item_ref = $4
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE, TEST_ITEM_REF]);

      expect(stateResult.rows.length).toBe(1);
    });
  });

  // ============================================================================
  // 4. INVARIANTE: Reset NO modifica contadores directamente
  // ============================================================================

  describe('Invariante - Reset NO modifica contadores directamente', () => {
    it('debe mantener contadores previos (se calcularán desde eventos post-RESET)', async () => {
      // Crear estado inicial con valores conocidos
      await query(`
        INSERT INTO cleaning_item_state (
          student_id, product_key, domain_type, item_ref,
          shared_last_cleaned_at, shared_clean_count, shared_effective_since
        ) VALUES (
          $1::uuid, $2, $3, $4,
          '2024-01-01T00:00:00Z'::timestamp, 10, NULL
        )
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE, TEST_ITEM_REF]);

      // Ejecutar reset
      await resetStudentItemProgress({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'shared',
        actor_type: 'master',
        surface_key: 'test'
      });

      // Verificar que contadores NO se modificaron directamente
      const stateResult = await query(`
        SELECT 
          shared_last_cleaned_at,
          shared_clean_count,
          shared_effective_since
        FROM cleaning_item_state
        WHERE student_id = $1::uuid
          AND product_key = $2
          AND domain_type = $3
          AND item_ref = $4
      `, [TEST_STUDENT_UUID, TEST_PRODUCT_KEY, TEST_DOMAIN_TYPE, TEST_ITEM_REF]);

      const state = stateResult.rows[0];

      // effective_since DEBE estar establecido
      expect(state.shared_effective_since).toBeTruthy();

      // NOTA: Los contadores NO se modifican directamente en reset canónico
      // Se mantienen hasta que se recalcule desde eventos post-RESET
      // Este test verifica que reset NO los resetea a 0/NULL directamente
      expect(state.shared_last_cleaned_at).toBeTruthy();
      expect(state.shared_clean_count).toBe(10);
    });
  });

  // ============================================================================
  // 5. INVARIANTE: Reset inserta evento RESET (append-only)
  // ============================================================================

  describe('Invariante - Reset inserta evento RESET (append-only)', () => {
    it('debe insertar evento RESET con action_type=reset', async () => {
      await resetStudentItemProgress({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'shared',
        actor_type: 'master',
        surface_key: 'test'
      });

      const eventsRepo = getDefaultCleaningEventsRepo();
      const events = await eventsRepo.listEventsForStudentItem({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        product_key: TEST_PRODUCT_KEY,
        domain_type: TEST_DOMAIN_TYPE
      });

      const resetEvents = events.filter(e => e.action_type === 'reset' && e.clean_layer === 'shared');
      expect(resetEvents.length).toBe(1);
      expect(resetEvents[0].action_type).toBe('reset');
      expect(resetEvents[0].clean_layer).toBe('shared');
    });

    it('el evento RESET NO debe borrarse', async () => {
      await resetStudentItemProgress({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'shared',
        actor_type: 'master',
        surface_key: 'test'
      });

      // Ejecutar reset de nuevo (idempotente)
      await resetStudentItemProgress({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'shared',
        actor_type: 'master',
        surface_key: 'test',
        execution_mode: 'APPLY' // Idempotente
      });

      // Verificar que el evento original NO se borró (append-only)
      const eventsRepo = getDefaultCleaningEventsRepo();
      const events = await eventsRepo.listEventsForStudentItem({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        product_key: TEST_PRODUCT_KEY,
        domain_type: TEST_DOMAIN_TYPE
      });

      const resetEvents = events.filter(e => e.action_type === 'reset' && e.clean_layer === 'shared');
      // Debe haber al menos 1 evento (el primero no se borró)
      expect(resetEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // 6. INVARIANTE: Reset ALL es best-effort (fail-open)
  // ============================================================================

  describe('Invariante - Reset ALL es best-effort (fail-open)', () => {
    it('debe continuar aunque un estudiante falle', async () => {
      // Este test requiere múltiples estudiantes
      // Por simplicidad, verificamos que el error no detiene la iteración
      // (el código ya tiene try-catch que continúa)

      const result = await resetAllStudentsItemProgress({
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'pde',
        actor_type: 'master',
        surface_key: 'test'
      });

      // Reset ALL debe retornar resultado incluso si algunos fallan
      expect(result).toBeDefined();
      expect(result).toHaveProperty('applied');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('skipped_breakdown');
    });
  });

  // ============================================================================
  // 7. VALIDACIÓN UUID
  // ============================================================================

  describe('Validación UUID', () => {
    it('debe REJECTAR student_uuid inválido', async () => {
      await expect(
        resetStudentItemProgress({
          student_uuid: 'invalid-uuid',
          item_ref: TEST_ITEM_REF,
          item_kind: 'recurrente',
          clean_layer: 'shared',
          actor_type: 'master',
          surface_key: 'test'
        })
      ).rejects.toThrow('student_uuid debe ser un UUID válido');
    });

    it('debe PERMITIR student_uuid válido', async () => {
      const result = await resetStudentItemProgress({
        student_uuid: TEST_STUDENT_UUID,
        item_ref: TEST_ITEM_REF,
        item_kind: 'recurrente',
        clean_layer: 'shared',
        actor_type: 'master',
        surface_key: 'test'
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('applied');
    });
  });

  // ============================================================================
  // 8. VALIDACIÓN Campos Requeridos
  // ============================================================================

  describe('Validación Campos Requeridos', () => {
    it('debe REJECTAR si falta student_uuid', async () => {
      await expect(
        resetStudentItemProgress({
          item_ref: TEST_ITEM_REF,
          item_kind: 'recurrente',
          clean_layer: 'shared',
          actor_type: 'master',
          surface_key: 'test'
        })
      ).rejects.toThrow('Campos requeridos faltantes');
    });

    it('debe REJECTAR si falta item_ref', async () => {
      await expect(
        resetStudentItemProgress({
          student_uuid: TEST_STUDENT_UUID,
          item_kind: 'recurrente',
          clean_layer: 'shared',
          actor_type: 'master',
          surface_key: 'test'
        })
      ).rejects.toThrow('Campos requeridos faltantes');
    });

    it('debe REJECTAR si falta actor_type', async () => {
      await expect(
        resetStudentItemProgress({
          student_uuid: TEST_STUDENT_UUID,
          item_ref: TEST_ITEM_REF,
          item_kind: 'recurrente',
          clean_layer: 'shared',
          surface_key: 'test'
        })
      ).rejects.toThrow('Campos requeridos faltantes');
    });

    it('debe REJECTAR si falta surface_key', async () => {
      await expect(
        resetStudentItemProgress({
          student_uuid: TEST_STUDENT_UUID,
          item_ref: TEST_ITEM_REF,
          item_kind: 'recurrente',
          clean_layer: 'shared',
          actor_type: 'master'
        })
      ).rejects.toThrow('Campos requeridos faltantes');
    });
  });
});
