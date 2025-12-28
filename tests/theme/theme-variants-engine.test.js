// theme-variants-engine.test.js
// Tests unitarios para Theme Variants Engine v1

import { describe, it, expect } from '@jest/globals';
import { evaluateThemeWhen, applyThemeVariants } from '../../src/core/theme/theme-variants-engine.js';
import { getAllContractVariables } from '../../src/core/theme/theme-contract.js';

describe('Theme Variants Engine v1', () => {
  describe('evaluateThemeWhen', () => {
    const ctx = {
      actor_type: 'admin',
      nivel_efectivo: 12,
      sidebar_context: 'home'
    };

    it('debe evaluar condición simple de igualdad correctamente', () => {
      const result = evaluateThemeWhen({
        when: { actor_type: 'admin' },
        ctx
      });
      
      expect(result.ok).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('debe retornar false si condición simple no cumple', () => {
      const result = evaluateThemeWhen({
        when: { actor_type: 'student' },
        ctx
      });
      
      expect(result.ok).toBe(false);
    });

    it('debe evaluar comparación >= correctamente', () => {
      const result = evaluateThemeWhen({
        when: { nivel_efectivo: { '>=': 10 } },
        ctx
      });
      
      expect(result.ok).toBe(true);
    });

    it('debe evaluar comparación < correctamente', () => {
      const result = evaluateThemeWhen({
        when: { nivel_efectivo: { '<': 15 } },
        ctx
      });
      
      expect(result.ok).toBe(true);
    });

    it('debe evaluar exists correctamente', () => {
      const result = evaluateThemeWhen({
        when: { sidebar_context: { exists: true } },
        ctx
      });
      
      expect(result.ok).toBe(true);
    });

    it('debe retornar false y warning si contexto no existe', () => {
      const result = evaluateThemeWhen({
        when: { contexto_inexistente: 'value' },
        ctx
      });
      
      expect(result.ok).toBe(false);
      expect(result.warnings.some(w => w.includes('not found'))).toBe(true);
    });

    it('debe evaluar condición "all" correctamente', () => {
      const result = evaluateThemeWhen({
        when: {
          all: [
            { actor_type: 'admin' },
            { nivel_efectivo: { '>=': 10 } }
          ]
        },
        ctx
      });
      
      expect(result.ok).toBe(true);
    });

    it('debe evaluar condición "any" correctamente', () => {
      const result = evaluateThemeWhen({
        when: {
          any: [
            { actor_type: 'student' },
            { nivel_efectivo: { '>=': 10 } }
          ]
        },
        ctx
      });
      
      expect(result.ok).toBe(true);
    });

    it('debe evaluar condición "not" correctamente', () => {
      const result = evaluateThemeWhen({
        when: {
          not: { actor_type: 'anonymous' }
        },
        ctx
      });
      
      expect(result.ok).toBe(true);
    });

    it('debe retornar warning si condición es inválida', () => {
      const result = evaluateThemeWhen({
        when: null,
        ctx
      });
      
      expect(result.ok).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('applyThemeVariants', () => {
    const baseTokens = {
      '--bg-main': '#faf7f2',
      '--accent-primary': '#ffd86b',
      '--text-primary': '#333333'
    };

    const contract = getAllContractVariables();

    it('debe aplicar 1 variante simple correctamente', () => {
      const variants = [
        {
          name: 'Admin variant',
          when: { actor_type: 'admin' },
          tokens: {
            '--accent-primary': '#7c3aed'
          }
        }
      ];

      const ctx = { actor_type: 'admin' };

      const result = applyThemeVariants({
        baseTokens,
        variants,
        ctx,
        contract
      });

      expect(result.tokens['--accent-primary']).toBe('#7c3aed');
      expect(result.tokens['--bg-main']).toBe('#faf7f2'); // Sin cambios
      expect(result.appliedVariants).toEqual(['Admin variant']);
    });

    it('debe aplicar variantes en orden (segunda sobreescribe primera)', () => {
      const variants = [
        {
          name: 'First variant',
          when: { actor_type: 'admin' },
          tokens: {
            '--accent-primary': '#7c3aed'
          }
        },
        {
          name: 'Second variant',
          when: { nivel_efectivo: { '>=': 10 } },
          tokens: {
            '--accent-primary': '#10b981'
          }
        }
      ];

      const ctx = {
        actor_type: 'admin',
        nivel_efectivo: 12
      };

      const result = applyThemeVariants({
        baseTokens,
        variants,
        ctx,
        contract
      });

      // La segunda variante debe sobreescribir la primera
      expect(result.tokens['--accent-primary']).toBe('#10b981');
      expect(result.appliedVariants).toEqual(['First variant', 'Second variant']);
    });

    it('debe ignorar variante si condición no cumple', () => {
      const variants = [
        {
          name: 'Student variant',
          when: { actor_type: 'student' },
          tokens: {
            '--accent-primary': '#10b981'
          }
        }
      ];

      const ctx = { actor_type: 'admin' };

      const result = applyThemeVariants({
        baseTokens,
        variants,
        ctx,
        contract
      });

      expect(result.tokens['--accent-primary']).toBe('#ffd86b'); // Mantiene base
      expect(result.appliedVariants).toEqual([]);
    });

    it('debe ignorar token fuera del contrato con warning', () => {
      const variants = [
        {
          name: 'Invalid token variant',
          when: { actor_type: 'admin' },
          tokens: {
            '--accent-primary': '#7c3aed',
            '--invalid-token': '#ffffff' // Token no válido
          }
        }
      ];

      const ctx = { actor_type: 'admin' };

      const result = applyThemeVariants({
        baseTokens,
        variants,
        ctx,
        contract
      });

      expect(result.tokens['--accent-primary']).toBe('#7c3aed');
      expect('--invalid-token' in result.tokens).toBe(false);
      expect(result.warnings.some(w => w.includes('not in Theme Contract'))).toBe(true);
    });

    it('debe ignorar token null/undefined con warning', () => {
      const variants = [
        {
          name: 'Null token variant',
          when: { actor_type: 'admin' },
          tokens: {
            '--accent-primary': null,
            '--text-primary': undefined
          }
        }
      ];

      const ctx = { actor_type: 'admin' };

      const result = applyThemeVariants({
        baseTokens,
        variants,
        ctx,
        contract
      });

      expect(result.tokens['--accent-primary']).toBe('#ffd86b'); // Mantiene base
      expect(result.tokens['--text-primary']).toBe('#333333'); // Mantiene base
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('debe retornar tokens base si no hay variantes', () => {
      const result = applyThemeVariants({
        baseTokens,
        variants: [],
        ctx: {},
        contract
      });

      expect(result.tokens).toEqual(baseTokens);
      expect(result.appliedVariants).toEqual([]);
    });

    it('debe manejar error interno sin romper (fail-open)', () => {
      // Crear variante que cause error interno (condición malformada)
      const variants = [
        {
          name: 'Malformed variant',
          when: { invalid: { 'unknown-op': 10 } }, // Operador desconocido
          tokens: {
            '--accent-primary': '#7c3aed'
          }
        }
      ];

      const ctx = { actor_type: 'admin' };

      const result = applyThemeVariants({
        baseTokens,
        variants,
        ctx,
        contract
      });

      // Debe retornar tokens base sin cambios
      expect(result.tokens).toEqual(baseTokens);
      expect(result.appliedVariants).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('debe evaluar condición any correctamente', () => {
      const variants = [
        {
          name: 'Any variant',
          when: {
            any: [
              { actor_type: 'student' },
              { nivel_efectivo: { '>=': 10 } }
            ]
          },
          tokens: {
            '--accent-primary': '#10b981'
          }
        }
      ];

      const ctx = {
        actor_type: 'admin',
        nivel_efectivo: 12
      };

      const result = applyThemeVariants({
        baseTokens,
        variants,
        ctx,
        contract
      });

      expect(result.tokens['--accent-primary']).toBe('#10b981');
      expect(result.appliedVariants).toEqual(['Any variant']);
    });

    it('debe evaluar condición all correctamente', () => {
      const variants = [
        {
          name: 'All variant',
          when: {
            all: [
              { actor_type: 'admin' },
              { nivel_efectivo: { '>=': 10 } }
            ]
          },
          tokens: {
            '--accent-primary': '#7c3aed'
          }
        }
      ];

      const ctx = {
        actor_type: 'admin',
        nivel_efectivo: 12
      };

      const result = applyThemeVariants({
        baseTokens,
        variants,
        ctx,
        contract
      });

      expect(result.tokens['--accent-primary']).toBe('#7c3aed');
      expect(result.appliedVariants).toEqual(['All variant']);
    });

    it('debe no aplicar variante si all no cumple todas las condiciones', () => {
      const variants = [
        {
          name: 'All variant',
          when: {
            all: [
              { actor_type: 'admin' },
              { nivel_efectivo: { '>=': 20 } } // No cumple
            ]
          },
          tokens: {
            '--accent-primary': '#7c3aed'
          }
        }
      ];

      const ctx = {
        actor_type: 'admin',
        nivel_efectivo: 12
      };

      const result = applyThemeVariants({
        baseTokens,
        variants,
        ctx,
        contract
      });

      expect(result.tokens['--accent-primary']).toBe('#ffd86b'); // Mantiene base
      expect(result.appliedVariants).toEqual([]);
    });
  });
});

