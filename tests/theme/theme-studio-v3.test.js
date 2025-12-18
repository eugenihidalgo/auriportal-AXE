// tests/theme/theme-studio-v3.test.js
// Tests mínimos críticos para Theme Studio v3

import { describe, it, expect } from '@jest/globals';

/**
 * Valida ThemeDefinition v1 (contrato mínimo)
 * Reglas:
 * - schema_version === 1
 * - tokens es objeto
 * - keys empiezan por "--"
 * - values son string no vacía
 */
function validateThemeDefinitionV1(definition) {
  const errors = [];

  if (!definition || typeof definition !== 'object') {
    return { valid: false, errors: ['definition debe ser un objeto'] };
  }

  if (definition.schema_version !== 1) {
    errors.push('schema_version debe ser 1');
  }

  if (!definition.tokens || typeof definition.tokens !== 'object') {
    errors.push('tokens es requerido y debe ser un objeto');
  } else {
    for (const [key, value] of Object.entries(definition.tokens)) {
      if (!key.startsWith('--')) {
        errors.push(`Token key "${key}" debe empezar por "--"`);
      }
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`Token value para "${key}" debe ser un string no vacío`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

describe('Theme Studio v3 - Validación ThemeDefinition v1', () => {
  describe('validateThemeDefinitionV1', () => {
    it('acepta un definition válido', () => {
      const definition = {
        schema_version: 1,
        tokens: {
          '--bg-main': '#0a0a0a',
          '--text-primary': '#ffffff'
        }
      };

      const result = validateThemeDefinitionV1(definition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rechaza schema_version != 1', () => {
      const definition = {
        schema_version: 2,
        tokens: {
          '--bg-main': '#0a0a0a'
        }
      };

      const result = validateThemeDefinitionV1(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('schema_version debe ser 1');
    });

    it('rechaza tokens no objeto', () => {
      const definition = {
        schema_version: 1,
        tokens: 'invalid'
      };

      const result = validateThemeDefinitionV1(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tokens es requerido'))).toBe(true);
    });

    it('rechaza keys que no empiezan por "--"', () => {
      const definition = {
        schema_version: 1,
        tokens: {
          'bg-main': '#0a0a0a', // Falta --
          '--text-primary': '#ffffff'
        }
      };

      const result = validateThemeDefinitionV1(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('bg-main') && e.includes('debe empezar por "--"'))).toBe(true);
    });

    it('rechaza values vacíos', () => {
      const definition = {
        schema_version: 1,
        tokens: {
          '--bg-main': '',
          '--text-primary': '#ffffff'
        }
      };

      const result = validateThemeDefinitionV1(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('bg-main') && e.includes('debe ser un string no vacío'))).toBe(true);
    });

    it('rechaza definition null', () => {
      const result = validateThemeDefinitionV1(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('definition debe ser un objeto');
    });

    it('rechaza definition undefined', () => {
      const result = validateThemeDefinitionV1(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('definition debe ser un objeto');
    });
  });
});

