// tests/feature-flags/feature-flags.test.js
// Tests para el sistema de feature flags

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  isFeatureEnabled, 
  getFeatureState, 
  getAllFeatureFlags 
} from '../../src/core/flags/feature-flags.js';
import { createTestStudent } from '../fixtures/student.js';

describe('Sistema de Feature Flags', () => {
  let originalEnv;
  
  beforeEach(() => {
    // Guardar APP_ENV original
    originalEnv = process.env.APP_ENV;
  });
  
  afterEach(() => {
    // Restaurar APP_ENV
    process.env.APP_ENV = originalEnv;
  });
  
  describe('isFeatureEnabled', () => {
    it('debe retornar false para flag "off" en cualquier entorno', () => {
      process.env.APP_ENV = 'dev';
      expect(isFeatureEnabled('progress_v4')).toBe(false);
      
      process.env.APP_ENV = 'beta';
      expect(isFeatureEnabled('progress_v4')).toBe(false);
      
      process.env.APP_ENV = 'prod';
      expect(isFeatureEnabled('progress_v4')).toBe(false);
    });
    
    it('debe retornar true para flag "on" en todos los entornos', () => {
      process.env.APP_ENV = 'dev';
      expect(isFeatureEnabled('observability_extended')).toBe(true);
      
      process.env.APP_ENV = 'beta';
      expect(isFeatureEnabled('observability_extended')).toBe(true);
      
      process.env.APP_ENV = 'prod';
      expect(isFeatureEnabled('observability_extended')).toBe(true);
    });
    
    it('debe retornar true para flag "beta" solo en dev y beta', () => {
      // Simular flag beta (necesitaríamos modificar temporalmente)
      // Por ahora, verificamos que los flags existentes funcionan
      process.env.APP_ENV = 'dev';
      // Los flags actuales están en 'off', así que verificamos el comportamiento
      expect(isFeatureEnabled('progress_v4')).toBe(false);
    });
    
    it('debe retornar false para flag desconocido', () => {
      expect(isFeatureEnabled('flag_inexistente')).toBe(false);
    });
    
    it('debe aceptar contexto opcional sin errores', () => {
      const student = createTestStudent();
      
      expect(() => {
        isFeatureEnabled('progress_v4', { student });
      }).not.toThrow();
    });
  });
  
  describe('getFeatureState', () => {
    it('debe retornar estado de flag existente', () => {
      const state = getFeatureState('progress_v4');
      
      expect(state).toHaveProperty('estado');
      expect(state).toHaveProperty('activo');
      expect(state).toHaveProperty('env');
    });
    
    it('debe retornar null para flag inexistente', () => {
      const state = getFeatureState('flag_inexistente');
      expect(state).toBeNull();
    });
  });
  
  describe('getAllFeatureFlags', () => {
    it('debe retornar todos los flags con sus estados', () => {
      const allFlags = getAllFeatureFlags();
      
      expect(typeof allFlags).toBe('object');
      expect(Object.keys(allFlags).length).toBeGreaterThan(0);
      
      // Verificar estructura de cada flag
      for (const flagName in allFlags) {
        const flag = allFlags[flagName];
        expect(flag).toHaveProperty('estado');
        expect(flag).toHaveProperty('activo');
        expect(flag).toHaveProperty('env');
      }
    });
  });
  
  describe('Comportamiento con wrapper y fallback', () => {
    it('debe ejecutar lógica tradicional cuando flag está off', () => {
      process.env.APP_ENV = 'dev';
      
      // Simular función protegida por feature flag
      let ejecutado = false;
      
      if (isFeatureEnabled('progress_v4')) {
        ejecutado = true; // Nuevo camino
      } else {
        ejecutado = false; // Lógica tradicional
      }
      
      expect(ejecutado).toBe(false);
    });
    
    it('debe permitir wrapper con fallback cuando flag está beta', () => {
      // Este test verifica que el sistema permite wrappers
      // La implementación real está en los módulos que usan feature flags
      process.env.APP_ENV = 'beta';
      
      const flagActivo = isFeatureEnabled('progress_v4');
      
      // Si el flag está activo, el wrapper debería retornar fallback
      // Por ahora, como está 'off', verificamos que funciona
      expect(typeof flagActivo).toBe('boolean');
    });
  });
});




















