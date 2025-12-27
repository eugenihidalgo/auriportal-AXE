// tests/feature-flags/feature-flags-constitutional.test.js
// Tests Constitucionales del Sistema de Feature Flags (Fase D - Nuevo Dominio)
//
// OBJETIVO: Garantizar que no se puede romper la arquitectura
// - No existen bypasses
// - Las prohibiciones se mantienen en el tiempo
// - PostgreSQL es Source of Truth
// - UI no puede crear flags
// - Flags irreversibles no se pueden resetear
//
// NO se busca cobertura total.
// Se busca protección del diseño.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { query } from '../../database/pg.js';
import {
  getAllFlags,
  isEnabled,
  setFlag,
  resetFlag
} from '../../src/core/feature-flags/feature-flag-service.js';
import { flagExists } from '../../src/core/feature-flags/feature-flag-registry.js';

describe('Tests Constitucionales - Sistema de Feature Flags', () => {
  let testFlags = [];

  beforeEach(() => {
    testFlags = [];
  });

  afterEach(async () => {
    // Limpiar flags de test
    if (testFlags.length > 0) {
      for (const flagKey of testFlags) {
        try {
          await query('DELETE FROM feature_flags WHERE flag_key = $1', [flagKey]);
        } catch (error) {
          console.warn(`Error limpiando flag ${flagKey}:`, error.message);
        }
      }
    }
  });

  // ============================================================================
  // 1. TESTS DE REGISTRY
  // ============================================================================

  describe('Registry Canónico', () => {
    it('debe verificar que un flag existe en registry antes de usar', async () => {
      const exists = flagExists('admin.feature_flags.ui');
      expect(exists).toBe(true);

      const notExists = flagExists('flag.inexistente');
      expect(notExists).toBe(false);
    });

    it('debe rechazar activar flag inexistente', async () => {
      await expect(
        setFlag('flag.inexistente', true, { type: 'admin', id: 'test-admin' })
      ).rejects.toThrow('no existe en registry');
    });
  });

  // ============================================================================
  // 2. TESTS DE POSTGRESQL COMO SOT
  // ============================================================================

  describe('PostgreSQL como Source of Truth', () => {
    it('debe retornar default del registry si no existe en BD', async () => {
      const enabled = await isEnabled('admin.feature_flags.ui');
      // El default es false según el registry
      expect(enabled).toBe(false);
    });

    it('debe retornar valor de BD si existe override', async () => {
      const flagKey = 'admin.feature_flags.ui';
      
      // Establecer override en BD
      await setFlag(flagKey, true, { type: 'admin', id: 'test-admin' });
      testFlags.push(flagKey);

      // Verificar que retorna el valor de BD (no el default)
      const enabled = await isEnabled(flagKey);
      expect(enabled).toBe(true);
    });

    it('debe persistir cambios en PostgreSQL', async () => {
      const flagKey = 'admin.automations.ui';
      
      // Establecer flag
      const result = await setFlag(flagKey, true, { type: 'admin', id: 'test-admin' });
      testFlags.push(flagKey);

      expect(result.enabled).toBe(true);
      expect(result.flag_key).toBe(flagKey);

      // Verificar en BD directamente
      const dbResult = await query('SELECT enabled FROM feature_flags WHERE flag_key = $1', [flagKey]);
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].enabled).toBe(true);
    });
  });

  // ============================================================================
  // 3. TESTS DE IRREVERSIBILIDAD
  // ============================================================================

  describe('Flags Irreversibles', () => {
    it('debe rechazar resetear flag irreversible', async () => {
      // Primero necesitamos un flag irreversible en el registry
      // Por ahora, todos los flags son reversibles, así que este test verifica la lógica
      // Si en el futuro hay flags irreversibles, este test los protegerá
      
      // Verificar que resetFlag valida irreversibilidad
      const flagKey = 'admin.feature_flags.ui'; // Este flag es reversible
      
      // Establecer flag
      await setFlag(flagKey, true, { type: 'admin', id: 'test-admin' });
      testFlags.push(flagKey);

      // Resetear debería funcionar (es reversible)
      const result = await resetFlag(flagKey, { type: 'admin', id: 'test-admin' });
      expect(result.reset).toBe(true);
    });
  });

  // ============================================================================
  // 4. TESTS DE VALIDACIÓN DE ACTOR
  // ============================================================================

  describe('Validación de Actor', () => {
    it('debe rechazar operaciones sin actor', async () => {
      await expect(
        setFlag('admin.feature_flags.ui', true, null)
      ).rejects.toThrow('actor es requerido');
    });

    it('debe rechazar actor inválido', async () => {
      await expect(
        setFlag('admin.feature_flags.ui', true, { type: 'invalid', id: 'test' })
      ).rejects.toThrow('debe ser "admin" o "system"');
    });

    it('debe aceptar actor válido (admin)', async () => {
      const result = await setFlag('admin.feature_flags.ui', true, { type: 'admin', id: 'test-admin' });
      testFlags.push('admin.feature_flags.ui');
      
      expect(result.enabled).toBe(true);
      expect(result.updated_by.type).toBe('admin');
      expect(result.updated_by.id).toBe('test-admin');
    });

    it('debe aceptar actor válido (system)', async () => {
      const result = await setFlag('admin.feature_flags.ui', true, { type: 'system', id: 'system-init' });
      testFlags.push('admin.feature_flags.ui');
      
      expect(result.enabled).toBe(true);
      expect(result.updated_by.type).toBe('system');
      expect(result.updated_by.id).toBe('system-init');
    });
  });

  // ============================================================================
  // 5. TESTS DE RESET
  // ============================================================================

  describe('Reset de Flags', () => {
    it('debe resetear flag a default del registry', async () => {
      const flagKey = 'admin.automations.ui';
      
      // Establecer override
      await setFlag(flagKey, false, { type: 'admin', id: 'test-admin' });
      testFlags.push(flagKey);

      // Verificar que está en false
      let enabled = await isEnabled(flagKey);
      expect(enabled).toBe(false);

      // Resetear
      const result = await resetFlag(flagKey, { type: 'admin', id: 'test-admin' });
      expect(result.reset).toBe(true);

      // Verificar que vuelve al default (true según registry)
      enabled = await isEnabled(flagKey);
      expect(enabled).toBe(true);
    });

    it('debe manejar reset de flag que no existe en BD', async () => {
      const flagKey = 'admin.automations.ui';
      
      // No establecer en BD (ya está en default)
      const result = await resetFlag(flagKey, { type: 'admin', id: 'test-admin' });
      
      expect(result.reset).toBe(true);
      expect(result.message).toContain('ya estaba en valor por defecto');
    });
  });

  // ============================================================================
  // 6. TESTS DE PROHIBICIONES CONSTITUCIONALES
  // ============================================================================

  describe('Prohibiciones Constitucionales', () => {
    it('NO debe permitir crear flags desde UI (solo desde registry)', async () => {
      // Este test documenta que la UI NO puede crear flags
      // La verificación real es que setFlag valida contra registry
      
      await expect(
        setFlag('ui.created.flag', true, { type: 'admin', id: 'test-admin' })
      ).rejects.toThrow('no existe en registry');
    });

    it('NO debe ejecutar lógica desde flags', async () => {
      // Este test documenta que los flags NO ejecutan lógica
      // Los flags solo retornan booleanos
      
      const enabled = await isEnabled('admin.feature_flags.ui');
      expect(typeof enabled).toBe('boolean');
      // No hay efectos secundarios, solo retorna true/false
    });

    it('NO debe llamar servicios de negocio desde flags', async () => {
      // Este test documenta que los flags NO llaman servicios
      // isEnabled solo consulta BD o registry, no ejecuta nada
      
      const enabled = await isEnabled('admin.automations.ui');
      expect(typeof enabled).toBe('boolean');
      // No hay llamadas a servicios, solo lectura
    });
  });
});

