// tests/recorridos/registry.test.js
// Tests para los registries del Capability Registry v1

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as screenTemplateRegistry from '../../src/core/registry/screen-template-registry.js';
import * as stepTypeRegistry from '../../src/core/registry/step-type-registry.js';
import * as conditionRegistry from '../../src/core/registry/condition-registry.js';
import * as eventRegistry from '../../src/core/registry/event-registry.js';
import * as pdeResourceRegistry from '../../src/core/registry/pde-resource-registry.js';

describe('Capability Registry v1', () => {
  describe('Screen Template Registry', () => {
    it('debe obtener todos los screen templates', () => {
      const templates = screenTemplateRegistry.getAll();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      // Verificar estructura de cada template
      templates.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('feature_flag');
        expect(template).toHaveProperty('props_schema');
        expect(typeof template.props_schema).toBe('object');
      });
    });
    
    it('debe obtener un template por ID', () => {
      const template = screenTemplateRegistry.getById('screen_intro_centered');
      
      expect(template).not.toBeNull();
      expect(template.id).toBe('screen_intro_centered');
      expect(template.props_schema).toBeDefined();
    });
    
    it('debe retornar null para template inexistente', () => {
      const template = screenTemplateRegistry.getById('template_inexistente');
      
      expect(template).toBeNull();
    });
    
    it('debe tener schema válido para screen_intro_centered', () => {
      const template = screenTemplateRegistry.getById('screen_intro_centered');
      
      expect(template.props_schema.type).toBe('object');
      expect(template.props_schema.required).toContain('title');
      expect(template.props_schema.required).toContain('subtitle');
    });
  });
  
  describe('Step Type Registry', () => {
    it('debe obtener todos los step types', () => {
      const stepTypes = stepTypeRegistry.getAll();
      
      expect(Array.isArray(stepTypes)).toBe(true);
      expect(stepTypes.length).toBeGreaterThan(0);
      
      stepTypes.forEach(stepType => {
        expect(stepType).toHaveProperty('id');
        expect(stepType).toHaveProperty('name');
        expect(stepType).toHaveProperty('compatible_templates');
        expect(Array.isArray(stepType.compatible_templates)).toBe(true);
      });
    });
    
    it('debe verificar compatibilidad de template con step type', () => {
      const isCompatible = stepTypeRegistry.isTemplateCompatible('practice', 'screen_practice_timer');
      
      expect(isCompatible).toBe(true);
    });
    
    it('debe detectar incompatibilidad de template con step type', () => {
      const isCompatible = stepTypeRegistry.isTemplateCompatible('practice', 'screen_input_short');
      
      expect(isCompatible).toBe(false);
    });
  });
  
  describe('Condition Registry', () => {
    it('debe obtener todos los condition types', () => {
      const conditions = conditionRegistry.getAll();
      
      expect(Array.isArray(conditions)).toBe(true);
      expect(conditions.length).toBeGreaterThan(0);
      
      conditions.forEach(condition => {
        expect(condition).toHaveProperty('id');
        expect(condition).toHaveProperty('name');
        expect(condition).toHaveProperty('params_schema');
      });
    });
    
    it('debe obtener condition type "always"', () => {
      const condition = conditionRegistry.getById('always');
      
      expect(condition).not.toBeNull();
      expect(condition.id).toBe('always');
      expect(condition.params_schema.type).toBe('object');
    });
    
    it('debe tener schema válido para field_equals', () => {
      const condition = conditionRegistry.getById('field_equals');
      
      expect(condition.params_schema.required).toContain('field');
      expect(condition.params_schema.required).toContain('value');
    });
  });
  
  describe('Event Registry', () => {
    it('debe obtener todos los event types', () => {
      const events = eventRegistry.getAll();
      
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      
      events.forEach(event => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('name');
        expect(event).toHaveProperty('payload_schema');
        expect(event).toHaveProperty('policies');
      });
    });
    
    it('debe obtener event type "recorrido_started"', () => {
      const event = eventRegistry.getById('recorrido_started');
      
      expect(event).not.toBeNull();
      expect(event.id).toBe('recorrido_started');
      expect(event.payload_schema.required).toContain('recorrido_id');
      expect(event.payload_schema.required).toContain('user_id');
    });
  });
  
  describe('PDE Resource Registry', () => {
    it('debe obtener todos los recursos PDE', () => {
      const resources = pdeResourceRegistry.getAll();
      
      expect(Array.isArray(resources)).toBe(true);
      
      resources.forEach(resource => {
        expect(resource).toHaveProperty('resource_id');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('type');
        expect(resource).toHaveProperty('available');
      });
    });
    
    it('debe verificar existencia de recurso', () => {
      const exists = pdeResourceRegistry.exists('resource_meditacion_1');
      
      expect(exists).toBe(true);
    });
    
    it('debe detectar recurso inexistente', () => {
      const exists = pdeResourceRegistry.exists('resource_inexistente');
      
      expect(exists).toBe(false);
    });
  });
});





