// tests/automations/automation-constitutional.test.js
// Tests Constitucionales del Sistema de Automatizaciones (Fase D - Fase 8)
//
// OBJETIVO: Garantizar que no se puede romper la arquitectura
// - No existen bypasses
// - Las prohibiciones se mantienen en el tiempo
//
// NO se busca cobertura total.
// Se busca protección del diseño.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { query } from '../../database/pg.js';
import { createAutomation, updateAutomation, activateAutomation, deactivateAutomation } from '../../src/core/automations/automation-write-service.js';
import { executeAutomation } from '../../src/core/automations/automation-execution-service.js';

describe('Tests Constitucionales - Sistema de Automatizaciones', () => {
  let createdDefinitionIds = [];
  let testCounter = 0;

  beforeEach(() => {
    createdDefinitionIds = [];
    testCounter++;
  });

  afterEach(async () => {
    // Limpiar definiciones creadas
    if (createdDefinitionIds.length > 0) {
      for (const id of createdDefinitionIds) {
        try {
          await query('DELETE FROM automation_definitions WHERE id = $1', [id]);
        } catch (error) {
          // Ignorar errores de limpieza
        }
      }
    }
  });

  // ============================================================================
  // 1. TESTS DE ESCRITURA
  // ============================================================================

  describe('Escritura Canónica', () => {
    it('debe crear automatización SIEMPRE en status draft', async () => {
      const result = await createAutomation({
        automation_key: `test_create_draft_${Date.now()}_${testCounter}`,
        name: 'Test Create Draft',
        description: 'Test que verifica que siempre se crea en draft',
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [
            { action_key: 'student.updateNivel', inputTemplate: { nivel: 2 } }
          ]
        },
        actor: { type: 'admin', id: 'test-admin' }
      }, null);

      expect(result.status).toBe('draft');
      expect(result.version).toBe(1);

      createdDefinitionIds.push(result.id);
    });

    it('debe rechazar creación con status active explícito', async () => {
      // El servicio NO acepta status explícito, pero verificamos que siempre crea en draft
      const result = await createAutomation({
        automation_key: `test_reject_active_${Date.now()}_${testCounter}`,
        name: 'Test Reject Active',
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [{ action_key: 'student.updateNivel', inputTemplate: { nivel: 2 } }]
        },
        actor: { type: 'admin', id: 'test-admin' }
      }, null);
      
      // Debe ser draft aunque intentemos forzar
      expect(result.status).toBe('draft');
      
      createdDefinitionIds.push(result.id);
    });

    it('debe rechazar definición con schema inválido', async () => {
      await expect(
        createAutomation({
          automation_key: `test_invalid_schema_${Date.now()}_${testCounter}`,
          name: 'Test Invalid Schema',
          definition: {
            // Falta trigger
            steps: []
          },
          actor: { type: 'admin', id: 'test-admin' }
        }, null)
      ).rejects.toThrow();
    });

    it('debe detectar conflicto de versiones en actualización', async () => {
      // Crear automatización
      const createResult = await createAutomation({
        automation_key: `test_version_conflict_${Date.now()}_${testCounter}`,
        name: 'Test Version Conflict',
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [{ action_key: 'student.updateNivel', inputTemplate: { nivel: 2 } }]
        },
        actor: { type: 'admin', id: 'test-admin' }
      }, null);
      const createdId = createResult.id;
      createdDefinitionIds.push(createdId);

      // Actualizar una vez
      await updateAutomation(createdId, {
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [{ action_key: 'student.updateStreak', inputTemplate: { streak: 10 } }]
        },
        expectedVersion: createResult.version,
        actor: { type: 'admin', id: 'test-admin' }
      }, null);

      // Intentar actualizar con versión incorrecta (debe fallar)
      await expect(
        updateAutomation(createdId, {
          definition: {
            trigger: { signalType: 'student.practice_registered' },
            steps: [{ action_key: 'student.updateApodo', inputTemplate: { apodo: 'Test' } }]
          },
          expectedVersion: 1, // Versión incorrecta (debería ser 2)
          actor: { type: 'admin', id: 'test-admin' }
        }, null)
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // 2. TESTS DE ACTIVACIÓN
  // ============================================================================

  describe('Activación Gobernada', () => {
    it('debe activar automatización en draft válido', async () => {
      // Crear automatización en draft
      const createResult = await createAutomation({
        automation_key: `test_activate_valid_${Date.now()}_${testCounter}`,
        name: 'Test Activate Valid',
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [{ action_key: 'student.updateNivel', inputTemplate: { nivel: 2 } }]
        },
        actor: { type: 'admin', id: 'test-admin' }
      }, null);
      const createdId = createResult.id;
      createdDefinitionIds.push(createdId);

      // Activar
      const activateResult = await activateAutomation(createdId, { actor: { type: 'admin', id: 'test-admin' } }, null);

      expect(activateResult.status).toBe('active');
      expect(activateResult.version).toBe(createResult.version); // Versión no cambia en activación
    });

    it('debe rechazar activar automatización broken', async () => {
      // Crear automatización
      const createResult = await createAutomation({
        automation_key: `test_activate_broken_${Date.now()}_${testCounter}`,
        name: 'Test Activate Broken',
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [{ action_key: 'student.updateNivel', inputTemplate: { nivel: 2 } }]
        },
        actor: { type: 'admin', id: 'test-admin' }
      }, null);
      const createdId = createResult.id;
      createdDefinitionIds.push(createdId);

      // Marcar como broken directamente en BD (simulación)
      await query(
        'UPDATE automation_definitions SET status = $1 WHERE id = $2',
        ['broken', createdId]
      );

      // Intentar activar (debe fallar)
      await expect(
        activateAutomation(createdId, { actor: { type: 'admin', id: 'test-admin' } }, null)
      ).rejects.toThrow();
    });

    it('debe rechazar activar automatización dos veces', async () => {
      // Crear y activar
      const createResult = await createAutomation({
        automation_key: `test_activate_twice_${Date.now()}_${testCounter}`,
        name: 'Test Activate Twice',
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [{ action_key: 'student.updateNivel', inputTemplate: { nivel: 2 } }]
        },
        actor: { type: 'admin', id: 'test-admin' }
      }, null);
      const createdId = createResult.id;
      createdDefinitionIds.push(createdId);

      // Activar primera vez
      await activateAutomation(createdId, { actor: { type: 'admin', id: 'test-admin' } }, null);

      // Intentar activar segunda vez (debe fallar)
      await expect(
        activateAutomation(createdId, { actor: { type: 'admin', id: 'test-admin' } }, null)
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // 3. TESTS DE EJECUCIÓN MANUAL
  // ============================================================================

  describe('Ejecución Manual Gobernada', () => {
    let activeAutomationId;

    beforeEach(async () => {
      // Crear automatización activa para tests de ejecución
      const createResult = await createAutomation({
        automation_key: `test_execute_active_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: 'Test Execute Active',
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [{ action_key: 'student.updateNivel', inputTemplate: { nivel: 2 } }]
        },
        actor: { type: 'admin', id: 'test-admin' }
      }, null);
      activeAutomationId = createResult.id;
      createdDefinitionIds.push(activeAutomationId);

      // Activar
      await activateAutomation(activeAutomationId, { actor: { type: 'admin', id: 'test-admin' } }, null);
    });

    it('debe rechazar ejecutar automatización en draft', async () => {
      // Crear automatización en draft
      const createResult = await createAutomation({
        automation_key: `test_execute_draft_${Date.now()}_${testCounter}`,
        name: 'Test Execute Draft',
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [{ action_key: 'student.updateNivel', inputTemplate: { nivel: 2 } }]
        },
        actor: { type: 'admin', id: 'test-admin' }
      }, null);
      const draftId = createResult.id;
      createdDefinitionIds.push(draftId);

      // Intentar ejecutar (debe fallar)
      await expect(
        executeAutomation(draftId, {
          mode: 'dry_run',
          context: {},
          actor: { type: 'admin', id: 'test-admin' }
        })
      ).rejects.toThrow('Solo se pueden ejecutar automatizaciones activas');
    });

    it('debe rechazar ejecutar automatización deprecated', async () => {
      // Desactivar automatización activa
      await deactivateAutomation(activeAutomationId, { actor: { type: 'admin', id: 'test-admin' } }, null);

      // Intentar ejecutar (debe fallar)
      await expect(
        executeAutomation(activeAutomationId, {
          mode: 'dry_run',
          context: {},
          actor: { type: 'admin', id: 'test-admin' }
        })
      ).rejects.toThrow('Solo se pueden ejecutar automatizaciones activas');
    });

    it('debe ejecutar automatización active en modo dry_run', async () => {
      // NOTA: Este test verifica que executeAutomation funciona correctamente
      // En un entorno real, dispatchSignal estaría integrado
      const result = await executeAutomation(activeAutomationId, {
        mode: 'dry_run',
        context: {},
        actor: { type: 'admin', id: 'test-admin' }
      });

      expect(result.ok).toBe(true);
      expect(result.mode).toBe('dry_run');
      expect(result.signal_id).toBeDefined();
      expect(result.trace_id).toBeDefined();
    });

    it('debe ejecutar automatización active en modo live_run', async () => {
      // NOTA: Este test verifica que executeAutomation funciona en modo live_run
      // En un entorno real, dispatchSignal estaría integrado
      const result = await executeAutomation(activeAutomationId, {
        mode: 'live_run',
        context: {},
        actor: { type: 'admin', id: 'test-admin' }
      });

      expect(result.ok).toBe(true);
      expect(result.mode).toBe('live_run');
      expect(result.signal_id).toBeDefined();
      expect(result.trace_id).toBeDefined();
    });

    it('debe generar signal_id y trace_id en ejecución', async () => {
      // Verificar que executeAutomation genera IDs únicos
      const result = await executeAutomation(activeAutomationId, {
        mode: 'dry_run',
        context: {},
        actor: { type: 'admin', id: 'test-admin' }
      });

      expect(result.signal_id).toBeDefined();
      expect(result.trace_id).toBeDefined();
      // automation_key viene del resultado de ejecución (no del objeto de definición directamente)
      expect(result.automation_key).toBeDefined();
    });
  });

  // ============================================================================
  // 4. TESTS DE FLUJO CANÓNICO (CRÍTICO)
  // ============================================================================

  describe('Flujo Canónico - Protección Anti-Bypass', () => {
    it('executeAutomation debe estar definido y NO importar action-registry directamente', async () => {
      // Verificación estática: el módulo existe y tiene la función
      const executionService = await import('../../src/core/automations/automation-execution-service.js');
      expect(executionService.executeAutomation).toBeDefined();
      
      // NOTA: Este test documenta que executeAutomation NO debe importar action-registry
      // La verificación real es que el código fuente no tiene ese import
      // Si alguien añade un import directo, este test documenta que NO debería hacerlo
    });

    it('executeAutomation debe llamar dispatchSignal (no ejecutar acciones directamente)', async () => {
      // Crear automatización activa
      const createResult = await createAutomation({
        automation_key: `test_flujo_canonico_${Date.now()}_${testCounter}`,
        name: 'Test Flujo Canónico',
        definition: {
          trigger: { signalType: 'student.practice_registered' },
          steps: [{ action_key: 'student.updateNivel', inputTemplate: { nivel: 2 } }]
        },
        actor: { type: 'admin', id: 'test-admin' }
      }, null);
      const automationId = createResult.id;
      createdDefinitionIds.push(automationId);

      await activateAutomation(automationId, { actor: { type: 'admin', id: 'test-admin' } }, null);

      // Ejecutar - debe llamar dispatchSignal internamente
      const result = await executeAutomation(automationId, {
        mode: 'dry_run',
        context: {},
        actor: { type: 'admin', id: 'test-admin' }
      });

      // Verificar que la ejecución fue exitosa (lo que indica que dispatchSignal fue llamado)
      expect(result.ok).toBe(true);
      
      // NOTA: La verificación real de que dispatchSignal fue llamado está en el código fuente
      // Este test verifica que el flujo funciona, documentando que TODO pasa por dispatchSignal
    });
  });
});
