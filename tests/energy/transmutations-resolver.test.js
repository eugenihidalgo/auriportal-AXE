// tests/energy/transmutations-resolver.test.js
// Tests unitarios para el resolver de bundles de transmutaciones

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  resolveTransmutationBundle, 
  getAvailableModes, 
  isValidModeId,
  EMPTY_BUNDLE 
} from '../../src/core/energy/transmutations/bundle-resolver.js';
import { invalidateCatalogCache } from '../../src/core/energy/transmutations/catalog-loader.js';

describe('bundle-resolver', () => {
  // Invalidar cache antes de cada test para asegurar estado limpio
  beforeEach(() => {
    invalidateCatalogCache();
  });

  afterEach(() => {
    invalidateCatalogCache();
  });

  // Contexto de estudiante mock
  const createStudentContext = (level = 1) => ({
    student: {
      id: 1,
      email: 'test@example.com',
      nivel_actual: level
    },
    nivelInfo: {
      nivel: level,
      nivel_efectivo: level
    }
  });

  describe('resolveTransmutationBundle', () => {
    it('devuelve bundle vacío si studentCtx es null', () => {
      const bundle = resolveTransmutationBundle(null, 'basica');
      
      expect(bundle.transmutations).toEqual([]);
      expect(bundle.techniques).toEqual([]);
      expect(bundle.meta.reason).toBe('missing_student_context');
    });

    it('devuelve bundle vacío si mode_id es null', () => {
      const studentCtx = createStudentContext(1);
      const bundle = resolveTransmutationBundle(studentCtx, null);
      
      expect(bundle.transmutations).toEqual([]);
      expect(bundle.meta.reason).toBe('invalid_mode_id');
    });

    it('devuelve bundle vacío si mode_id no existe', () => {
      const studentCtx = createStudentContext(1);
      const bundle = resolveTransmutationBundle(studentCtx, 'modo_inexistente');
      
      expect(bundle.transmutations).toEqual([]);
      expect(bundle.meta.reason).toBe('mode_not_found');
      expect(bundle.meta.available_modes).toBeDefined();
    });

    it('resuelve modo rapida con máximo 5 transmutaciones', () => {
      const studentCtx = createStudentContext(5); // Nivel alto para tener acceso a todas
      const bundle = resolveTransmutationBundle(studentCtx, 'rapida');
      
      expect(bundle.mode).not.toBeNull();
      expect(bundle.mode.mode_id).toBe('rapida');
      expect(bundle.transmutations.length).toBeLessThanOrEqual(5);
      expect(bundle.meta.student_level).toBe(5);
    });

    it('resuelve modo basica con máximo 10 transmutaciones', () => {
      const studentCtx = createStudentContext(5);
      const bundle = resolveTransmutationBundle(studentCtx, 'basica');
      
      expect(bundle.mode.mode_id).toBe('basica');
      expect(bundle.transmutations.length).toBeLessThanOrEqual(10);
    });

    it('resuelve modo profunda con máximo 25 transmutaciones', () => {
      const studentCtx = createStudentContext(5);
      const bundle = resolveTransmutationBundle(studentCtx, 'profunda');
      
      expect(bundle.mode.mode_id).toBe('profunda');
      expect(bundle.transmutations.length).toBeLessThanOrEqual(25);
    });

    it('resuelve modo maestro con máximo 50 transmutaciones', () => {
      const studentCtx = createStudentContext(5);
      const bundle = resolveTransmutationBundle(studentCtx, 'maestro');
      
      expect(bundle.mode.mode_id).toBe('maestro');
      expect(bundle.transmutations.length).toBeLessThanOrEqual(50);
    });

    it('filtra transmutaciones por nivel del alumno nivel 1', () => {
      const studentCtx = createStudentContext(1);
      const bundle = resolveTransmutationBundle(studentCtx, 'basica');
      
      // Todas las transmutaciones devueltas deben ser de nivel <= 1
      for (const trans of bundle.transmutations) {
        expect(trans.min_level).toBeLessThanOrEqual(1);
      }
    });

    it('filtra transmutaciones por nivel del alumno nivel 5', () => {
      const studentCtx = createStudentContext(5);
      const bundle = resolveTransmutationBundle(studentCtx, 'maestro');
      
      // Debe incluir transmutaciones de nivel <= 5
      for (const trans of bundle.transmutations) {
        expect(trans.min_level).toBeLessThanOrEqual(5);
      }
      
      // Debe haber transmutaciones de niveles variados
      const levels = new Set(bundle.transmutations.map(t => t.min_level));
      expect(levels.size).toBeGreaterThan(1); // Múltiples niveles
    });

    it('incluye técnicas filtradas por nivel', () => {
      const studentCtx = createStudentContext(3);
      const bundle = resolveTransmutationBundle(studentCtx, 'basica');
      
      // Debe incluir técnicas
      expect(bundle.techniques.length).toBeGreaterThan(0);
      
      // Todas deben ser de nivel <= 3
      for (const tech of bundle.techniques) {
        expect(tech.min_level).toBeLessThanOrEqual(3);
      }
    });

    it('incluye metadata correcta en el bundle', () => {
      const studentCtx = createStudentContext(2);
      const bundle = resolveTransmutationBundle(studentCtx, 'basica');
      
      expect(bundle.meta.resolved_at).toBeDefined();
      expect(bundle.meta.student_level).toBe(2);
      expect(bundle.meta.catalog_version).toBeDefined();
      expect(bundle.meta.transmutations_selected).toBeDefined();
      expect(bundle.meta.techniques_selected).toBeDefined();
      expect(bundle.meta.mode_max).toBe(10);
    });

    it('transmutaciones devueltas tienen campos requeridos', () => {
      const studentCtx = createStudentContext(1);
      const bundle = resolveTransmutationBundle(studentCtx, 'rapida');
      
      if (bundle.transmutations.length > 0) {
        const trans = bundle.transmutations[0];
        expect(trans.transmutation_id).toBeDefined();
        expect(trans.slug).toBeDefined();
        expect(trans.name).toBeDefined();
        expect(trans.description).toBeDefined();
        expect(trans.category).toBeDefined();
        expect(trans.min_level).toBeDefined();
      }
    });

    it('técnicas devueltas tienen campos requeridos', () => {
      const studentCtx = createStudentContext(1);
      const bundle = resolveTransmutationBundle(studentCtx, 'rapida');
      
      if (bundle.techniques.length > 0) {
        const tech = bundle.techniques[0];
        expect(tech.technique_id).toBeDefined();
        expect(tech.slug).toBeDefined();
        expect(tech.name).toBeDefined();
        expect(tech.description).toBeDefined();
        expect(tech.category).toBeDefined();
        expect(tech.min_level).toBeDefined();
      }
    });

    it('usa options.now para timestamp determinista', () => {
      const studentCtx = createStudentContext(1);
      const fixedDate = new Date('2025-12-17T12:00:00Z');
      const bundle = resolveTransmutationBundle(studentCtx, 'rapida', { now: fixedDate });
      
      expect(bundle.meta.resolved_at).toBe('2025-12-17T12:00:00.000Z');
    });
  });

  describe('getAvailableModes', () => {
    it('devuelve los 4 modos definidos', () => {
      const modes = getAvailableModes();
      
      expect(modes.length).toBe(4);
      expect(modes.map(m => m.mode_id)).toContain('rapida');
      expect(modes.map(m => m.mode_id)).toContain('basica');
      expect(modes.map(m => m.mode_id)).toContain('profunda');
      expect(modes.map(m => m.mode_id)).toContain('maestro');
    });

    it('cada modo tiene label y max_transmutations', () => {
      const modes = getAvailableModes();
      
      for (const mode of modes) {
        expect(mode.mode_id).toBeDefined();
        expect(mode.label).toBeDefined();
        expect(mode.max_transmutations).toBeDefined();
        expect(typeof mode.max_transmutations).toBe('number');
      }
    });
  });

  describe('isValidModeId', () => {
    it('retorna true para modos válidos', () => {
      expect(isValidModeId('rapida')).toBe(true);
      expect(isValidModeId('basica')).toBe(true);
      expect(isValidModeId('profunda')).toBe(true);
      expect(isValidModeId('maestro')).toBe(true);
    });

    it('retorna false para modos inválidos', () => {
      expect(isValidModeId('inexistente')).toBe(false);
      expect(isValidModeId('')).toBe(false);
      expect(isValidModeId(null)).toBe(false);
      expect(isValidModeId(undefined)).toBe(false);
    });
  });

  describe('EMPTY_BUNDLE', () => {
    it('tiene estructura correcta para fail-open', () => {
      expect(EMPTY_BUNDLE.mode).toBeNull();
      expect(EMPTY_BUNDLE.transmutations).toEqual([]);
      expect(EMPTY_BUNDLE.techniques).toEqual([]);
      expect(EMPTY_BUNDLE.meta.reason).toBe('empty_bundle');
    });
  });

  describe('escenarios de nivel del alumno', () => {
    it('alumno nivel 1 + modo basica => solo transmutaciones min_level <= 1', () => {
      const studentCtx = createStudentContext(1);
      const bundle = resolveTransmutationBundle(studentCtx, 'basica');
      
      expect(bundle.transmutations.length).toBeGreaterThan(0);
      expect(bundle.transmutations.length).toBeLessThanOrEqual(10);
      
      // Verificar que todas son nivel 1
      const allLevel1 = bundle.transmutations.every(t => t.min_level <= 1);
      expect(allLevel1).toBe(true);
    });

    it('alumno nivel 5 + modo maestro => transmutaciones min_level <= 5 (hasta 50)', () => {
      const studentCtx = createStudentContext(5);
      const bundle = resolveTransmutationBundle(studentCtx, 'maestro');
      
      expect(bundle.transmutations.length).toBeGreaterThan(0);
      expect(bundle.transmutations.length).toBeLessThanOrEqual(50);
      
      // Verificar que todas son nivel <= 5
      const allValidLevel = bundle.transmutations.every(t => t.min_level <= 5);
      expect(allValidLevel).toBe(true);
    });

    it('alumno nivel 2 ve más transmutaciones que nivel 1', () => {
      const ctxLevel1 = createStudentContext(1);
      const ctxLevel2 = createStudentContext(2);
      
      const bundleL1 = resolveTransmutationBundle(ctxLevel1, 'profunda');
      const bundleL2 = resolveTransmutationBundle(ctxLevel2, 'profunda');
      
      // Nivel 2 debería tener acceso a al menos tantas como nivel 1
      // (puede ser igual si el modo ya estaba lleno con nivel 1)
      const availableL1 = bundleL1.meta.transmutations_after_level_filter;
      const availableL2 = bundleL2.meta.transmutations_after_level_filter;
      
      expect(availableL2).toBeGreaterThanOrEqual(availableL1);
    });
  });
});






