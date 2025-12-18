// tests/theme/theme-registry.test.js
// Tests críticos para Theme Registry v1

import { describe, it, expect, beforeEach } from '@jest/globals';
import { getThemeDefinition, listSystemThemes, listSystemThemeKeys, hasTheme } from '../../src/core/theme/theme-registry.js';
import { getAllContractVariables } from '../../src/core/theme/theme-contract.js';

describe('Theme Registry v1', () => {
  describe('getThemeDefinition()', () => {
    it('debe devolver definición completa de dark-classic', () => {
      const definition = getThemeDefinition('dark-classic');
      
      expect(definition).not.toBeNull();
      expect(definition.key).toBe('dark-classic');
      expect(definition.name).toBe('Dark Classic');
      expect(definition.contractVersion).toBe('v1');
      expect(definition.values).toBeDefined();
      expect(typeof definition.values).toBe('object');
    });
    
    it('debe devolver definición completa de light-classic', () => {
      const definition = getThemeDefinition('light-classic');
      
      expect(definition).not.toBeNull();
      expect(definition.key).toBe('light-classic');
      expect(definition.name).toBe('Light Classic');
      expect(definition.contractVersion).toBe('v1');
      expect(definition.values).toBeDefined();
      expect(typeof definition.values).toBe('object');
    });
    
    it('debe devolver null para tema inexistente', () => {
      const definition = getThemeDefinition('inexistente');
      expect(definition).toBeNull();
    });
    
    it('debe devolver null para clave inválida', () => {
      expect(getThemeDefinition(null)).toBeNull();
      expect(getThemeDefinition(undefined)).toBeNull();
      expect(getThemeDefinition('')).toBeNull();
      expect(getThemeDefinition(123)).toBeNull();
    });
    
    it('dark-classic debe tener TODAS las variables del contrato', () => {
      const definition = getThemeDefinition('dark-classic');
      const contractVars = getAllContractVariables();
      
      expect(definition).not.toBeNull();
      
      for (const varName of contractVars) {
        expect(definition.values).toHaveProperty(varName);
        expect(definition.values[varName]).toBeTruthy();
        expect(typeof definition.values[varName]).toBe('string');
      }
    });
    
    it('light-classic debe tener TODAS las variables del contrato', () => {
      const definition = getThemeDefinition('light-classic');
      const contractVars = getAllContractVariables();
      
      expect(definition).not.toBeNull();
      
      for (const varName of contractVars) {
        expect(definition.values).toHaveProperty(varName);
        expect(definition.values[varName]).toBeTruthy();
        expect(typeof definition.values[varName]).toBe('string');
      }
    });
  });
  
  describe('listSystemThemes()', () => {
    it('debe devolver array con al menos dark-classic y light-classic', () => {
      const themes = listSystemThemes();
      
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThanOrEqual(2);
      
      const keys = themes.map(t => t.key);
      expect(keys).toContain('dark-classic');
      expect(keys).toContain('light-classic');
    });
    
    it('cada tema debe tener estructura completa (key, name, contractVersion, values)', () => {
      const themes = listSystemThemes();
      
      for (const theme of themes) {
        expect(theme).toHaveProperty('key');
        expect(theme).toHaveProperty('name');
        expect(theme).toHaveProperty('contractVersion');
        expect(theme).toHaveProperty('values');
        expect(typeof theme.key).toBe('string');
        expect(typeof theme.name).toBe('string');
        expect(typeof theme.contractVersion).toBe('string');
        expect(typeof theme.values).toBe('object');
      }
    });
  });
  
  describe('listSystemThemeKeys()', () => {
    it('debe devolver array de strings con claves de temas', () => {
      const keys = listSystemThemeKeys();
      
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys).toContain('dark-classic');
      expect(keys).toContain('light-classic');
      
      for (const key of keys) {
        expect(typeof key).toBe('string');
      }
    });
  });
  
  describe('hasTheme()', () => {
    it('debe devolver true para temas existentes', () => {
      expect(hasTheme('dark-classic')).toBe(true);
      expect(hasTheme('light-classic')).toBe(true);
    });
    
    it('debe devolver false para temas inexistentes', () => {
      expect(hasTheme('inexistente')).toBe(false);
      expect(hasTheme(null)).toBe(false);
      expect(hasTheme(undefined)).toBe(false);
    });
  });
});







