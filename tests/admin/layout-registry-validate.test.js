/**
 * Tests para LayoutRegistry v1 Validator
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { validateLayoutRegistry } from '../../src/core/admin/layout/layout-registry-validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REGISTRY_PATH = join(__dirname, '../../src/core/admin/layout/layout-registry.v1.json');

describe('LayoutRegistry v1 Validator', () => {
  let validRegistry;

  beforeAll(() => {
    const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');
    validRegistry = JSON.parse(registryContent);
  });

  describe('Validación del registry actual', () => {
    it('debe validar correctamente el registry JSON actual', () => {
      const result = validateLayoutRegistry(validRegistry);
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.details).toBeUndefined();
    });
  });

  describe('Validación de schema y versión', () => {
    it('debe fallar si schema es incorrecto', () => {
      const invalid = { ...validRegistry, schema: 'invalid' };
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Schema inválido');
    });

    it('debe fallar si versión es incorrecta', () => {
      const invalid = { ...validRegistry, version: '2.0.0' };
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Versión inválida');
    });
  });

  describe('Validación de referencias', () => {
    it('debe fallar si universe apunta a layout inexistente', () => {
      const invalid = JSON.parse(JSON.stringify(validRegistry));
      invalid.universes[0].layout_id = 'layout_inexistente';
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details.some(d => d.includes('layout inexistente'))).toBe(true);
    });

    it('debe fallar si universe apunta a sidebar inexistente', () => {
      const invalid = JSON.parse(JSON.stringify(validRegistry));
      invalid.universes[0].sidebar_id = 'sidebar_inexistente';
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details.some(d => d.includes('sidebar inexistente'))).toBe(true);
    });

    it('debe fallar si route apunta a universe inexistente', () => {
      const invalid = JSON.parse(JSON.stringify(validRegistry));
      invalid.routes[0].universe_id = 'u_inexistente';
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details.some(d => d.includes('universe inexistente'))).toBe(true);
    });

    it('debe fallar si route apunta a layout inexistente', () => {
      const invalid = JSON.parse(JSON.stringify(validRegistry));
      invalid.routes[0].layout_id = 'layout_inexistente';
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details.some(d => d.includes('layout inexistente'))).toBe(true);
    });
  });

  describe('Validación de IDs únicos', () => {
    it('debe fallar si hay IDs duplicados en universes', () => {
      const invalid = JSON.parse(JSON.stringify(validRegistry));
      invalid.universes.push({ ...invalid.universes[0] }); // Duplicar primer universe
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details.some(d => d.includes('ID duplicado en universes'))).toBe(true);
    });

    it('debe fallar si hay IDs duplicados en layouts', () => {
      const invalid = JSON.parse(JSON.stringify(validRegistry));
      invalid.layouts.push({ ...invalid.layouts[0] }); // Duplicar primer layout
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details.some(d => d.includes('ID duplicado en layouts'))).toBe(true);
    });
  });

  describe('Validación de required_slots', () => {
    it('debe fallar si layout falta slot requerido', () => {
      const invalid = JSON.parse(JSON.stringify(validRegistry));
      invalid.layouts[0].slots = ['sidebar', 'main']; // Faltan notes_panel y diagnostics_panel
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details.some(d => d.includes('falta slot requerido'))).toBe(true);
    });
  });

  describe('Validación de required_features', () => {
    it('debe fallar si sidebar falta feature requerida (global_search)', () => {
      const invalid = JSON.parse(JSON.stringify(validRegistry));
      invalid.sidebars[0].features = ['bookmarks']; // Falta global_search
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details.some(d => d.includes('falta feature requerida: global_search'))).toBe(true);
    });

    it('debe fallar si sidebar falta feature requerida (bookmarks)', () => {
      const invalid = JSON.parse(JSON.stringify(validRegistry));
      invalid.sidebars[0].features = ['global_search']; // Falta bookmarks
      const result = validateLayoutRegistry(invalid);
      expect(result.ok).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details.some(d => d.includes('falta feature requerida: bookmarks'))).toBe(true);
    });
  });
});

