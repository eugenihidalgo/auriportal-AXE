// tests/screen-template/screen-template-definition-contract.test.js
// Tests para ScreenTemplateDefinition v1
//
// SPRINT AXE v0.5 - Screen Templates v1

import { describe, it, expect } from '@jest/globals';
import {
  validateScreenTemplateDefinition,
  validateScreenTemplateDefinitionDraft,
  normalizeScreenTemplateDefinition,
  validatePropsAgainstSchema
} from '../../src/core/screen-template/screen-template-definition-contract.js';

describe('ScreenTemplateDefinition Contract', () => {
  describe('validateScreenTemplateDefinition', () => {
    it('debe validar una definición válida', () => {
      const definition = {
        id: 'welcome-screen',
        name: 'Pantalla de Bienvenida',
        description: 'Pantalla de bienvenida para nuevos usuarios',
        template_type: 'welcome',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            message: { type: 'string' }
          },
          required: ['title']
        },
        ui_contract: {},
        meta: {}
      };

      const result = validateScreenTemplateDefinition(definition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('debe rechazar definición sin id', () => {
      const definition = {
        name: 'Test',
        template_type: 'custom',
        schema: { type: 'object', properties: {} }
      };

      const result = validateScreenTemplateDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('id es requerido'))).toBe(true);
    });

    it('debe rechazar definición sin name', () => {
      const definition = {
        id: 'test',
        template_type: 'custom',
        schema: { type: 'object', properties: {} }
      };

      const result = validateScreenTemplateDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name es requerido'))).toBe(true);
    });

    it('debe rechazar definición sin template_type', () => {
      const definition = {
        id: 'test',
        name: 'Test',
        schema: { type: 'object', properties: {} }
      };

      const result = validateScreenTemplateDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('template_type es requerido'))).toBe(true);
    });

    it('debe rechazar definición sin schema', () => {
      const definition = {
        id: 'test',
        name: 'Test',
        template_type: 'custom'
      };

      const result = validateScreenTemplateDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('schema es requerido'))).toBe(true);
    });
  });

  describe('validateScreenTemplateDefinitionDraft', () => {
    it('debe ser tolerante con warnings en draft', () => {
      const definition = {
        id: 'test',
        name: 'Test',
        template_type: 'custom',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' }
          }
        }
      };

      const result = validateScreenTemplateDefinitionDraft(definition);
      expect(result.valid).toBe(true); // Válido en draft aunque tenga warnings
    });

    it('debe rechazar errores críticos incluso en draft', () => {
      const definition = {
        // Falta id
        name: 'Test',
        template_type: 'custom',
        schema: { type: 'object', properties: {} }
      };

      const result = validateScreenTemplateDefinitionDraft(definition);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('id es requerido'))).toBe(true);
    });
  });

  describe('normalizeScreenTemplateDefinition', () => {
    it('debe normalizar una definición válida', () => {
      const definition = {
        id: '  test  ',
        name: '  Test  ',
        template_type: 'custom',
        schema: { type: 'object', properties: {} }
      };

      const normalized = normalizeScreenTemplateDefinition(definition);
      expect(normalized).not.toBeNull();
      expect(normalized.id).toBe('test');
      expect(normalized.name).toBe('Test');
      expect(normalized.schema.type).toBe('object');
    });

    it('debe retornar null para definición inválida', () => {
      const definition = {
        // Falta id
        name: 'Test',
        template_type: 'custom'
      };

      const normalized = normalizeScreenTemplateDefinition(definition);
      expect(normalized).toBeNull();
    });
  });

  describe('validatePropsAgainstSchema', () => {
    it('debe validar props correctamente (fail-open)', () => {
      const schema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          count: { type: 'number' }
        },
        required: ['title']
      };

      const props = {
        title: 'Hello',
        count: 42
      };

      const result = validatePropsAgainstSchema(props, schema);
      expect(result.valid).toBe(true); // Siempre válido (fail-open)
      expect(result.errors).toHaveLength(0);
    });

    it('debe generar warnings para props faltantes pero no fallar (fail-open)', () => {
      const schema = {
        type: 'object',
        properties: {
          title: { type: 'string' }
        },
        required: ['title']
      };

      const props = {}; // Falta title

      const result = validatePropsAgainstSchema(props, schema);
      expect(result.valid).toBe(true); // Fail-open: siempre válido
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('title'))).toBe(true);
    });

    it('debe generar warnings para tipos incorrectos pero no fallar (fail-open)', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number' }
        }
      };

      const props = {
        count: 'not-a-number' // Tipo incorrecto
      };

      const result = validatePropsAgainstSchema(props, schema);
      expect(result.valid).toBe(true); // Fail-open: siempre válido
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('debe ser fail-open incluso con schema inválido', () => {
      const schema = null; // Schema inválido
      const props = { title: 'Test' };

      const result = validatePropsAgainstSchema(props, schema);
      expect(result.valid).toBe(true); // Fail-open: siempre válido
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});


