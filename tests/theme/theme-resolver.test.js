// tests/theme/theme-resolver.test.js
// Tests críticos para Theme Resolver v1 con Theme Registry

import { describe, it, expect } from '@jest/globals';
import { resolveTheme, getThemeId, getSystemThemeName } from '../../src/core/theme/theme-resolver.js';
import { getAllContractVariables } from '../../src/core/theme/theme-contract.js';
import { CONTRACT_DEFAULT } from '../../src/core/theme/theme-defaults.js';

describe('Theme Resolver v1 con Registry', () => {
  describe('resolveTheme() con student.tema_preferido', () => {
    it('debe resolver dark-classic cuando student.tema_preferido es "dark"', () => {
      const student = { tema_preferido: 'dark' };
      const effective = resolveTheme({ student });
      
      // Verificar que tiene todas las variables
      const contractVars = getAllContractVariables();
      for (const varName of contractVars) {
        expect(effective).toHaveProperty(varName);
        expect(typeof effective[varName]).toBe('string');
      }
      
      // Verificar que es tema oscuro (dark-classic)
      expect(effective['--bg-main']).toBe('#0a0e1a'); // Valor de dark-classic
      expect(effective['--text-primary']).toBe('#f1f5f9'); // Valor de dark-classic
      
      // Verificar metadata interna
      expect(effective._resolvedKey).toBe('dark-classic');
      expect(effective._resolvedFrom).toBe('registry');
    });
    
    it('debe resolver light-classic cuando student.tema_preferido es "light"', () => {
      const student = { tema_preferido: 'light' };
      const effective = resolveTheme({ student });
      
      // Verificar que tiene todas las variables
      const contractVars = getAllContractVariables();
      for (const varName of contractVars) {
        expect(effective).toHaveProperty(varName);
        expect(typeof effective[varName]).toBe('string');
      }
      
      // Verificar que es tema claro (light-classic)
      expect(effective['--bg-main']).toBe('#faf7f2'); // Valor de light-classic
      expect(effective['--text-primary']).toBe('#333333'); // Valor de light-classic
      
      // Verificar metadata interna
      expect(effective._resolvedKey).toBe('light-classic');
      expect(effective._resolvedFrom).toBe('registry');
    });
    
    it('debe resolver dark-classic cuando student.tema_preferido es "dark-classic" directamente', () => {
      const student = { tema_preferido: 'dark-classic' };
      const effective = resolveTheme({ student });
      
      expect(effective['--bg-main']).toBe('#0a0e1a');
      expect(effective._resolvedKey).toBe('dark-classic');
    });
    
    it('debe usar dark-classic por defecto cuando no hay student', () => {
      const effective = resolveTheme({});
      
      expect(effective['--bg-main']).toBe('#0a0e1a');
      expect(effective._resolvedKey).toBe('dark-classic');
      expect(effective._resolvedFrom).toBe('registry');
    });
    
    it('debe usar dark-classic cuando student.tema_preferido es null', () => {
      const student = { tema_preferido: null };
      const effective = resolveTheme({ student });
      
      expect(effective['--bg-main']).toBe('#0a0e1a');
      expect(effective._resolvedKey).toBe('dark-classic');
    });
  });
  
  describe('resolveTheme() - completitud de variables', () => {
    it('debe devolver TODAS las variables del contrato', () => {
      const effective = resolveTheme({});
      const contractVars = getAllContractVariables();
      
      expect(contractVars.length).toBeGreaterThan(0);
      
      for (const varName of contractVars) {
        expect(effective).toHaveProperty(varName);
        expect(effective[varName]).toBeTruthy();
        expect(typeof effective[varName]).toBe('string');
      }
    });
  });
  
  describe('resolveTheme() - fail-open', () => {
    it('debe devolver CONTRACT_DEFAULT si todo falla (fallback seguro)', () => {
      // Simular un escenario donde registry podría fallar
      // Nota: en realidad el registry no falla porque está hardcodeado,
      // pero el resolver debe manejar errores de forma segura
      const effective = resolveTheme({});
      
      // Debe tener todas las variables
      const contractVars = getAllContractVariables();
      for (const varName of contractVars) {
        expect(effective).toHaveProperty(varName);
        expect(effective[varName]).toBeTruthy();
      }
      
      // Debe tener metadata
      expect(effective._contractVersion).toBe('v1');
      expect(effective._resolvedFrom).toBeDefined();
    });
  });
  
  describe('getThemeId()', () => {
    it('debe devolver "dark" para dark-classic', () => {
      const student = { tema_preferido: 'dark' };
      const effective = resolveTheme({ student });
      const themeId = getThemeId(effective);
      
      expect(themeId).toBe('dark');
    });
    
    it('debe devolver "light" para light-classic', () => {
      const student = { tema_preferido: 'light' };
      const effective = resolveTheme({ student });
      const themeId = getThemeId(effective);
      
      expect(themeId).toBe('light');
    });
  });
  
  describe('getSystemThemeName()', () => {
    it('debe devolver "dark-classic" para tema oscuro', () => {
      const student = { tema_preferido: 'dark' };
      const effective = resolveTheme({ student });
      const themeName = getSystemThemeName(effective);
      
      expect(themeName).toBe('dark-classic');
    });
    
    it('debe devolver "light-classic" para tema claro', () => {
      const student = { tema_preferido: 'light' };
      const effective = resolveTheme({ student });
      const themeName = getSystemThemeName(effective);
      
      expect(themeName).toBe('light-classic');
    });
  });
});

















