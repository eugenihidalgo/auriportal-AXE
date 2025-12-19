// tests/recorridos/validate-recorrido-definition.test.js
// Tests para el validador de RecorridoDefinition

import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateRecorridoDefinition } from '../../src/core/recorridos/validate-recorrido-definition.js';

// Ejemplo de RecorridoDefinition válido: "Limpieza Energética Diaria"
const RECORRIDO_LIMPIEZA_DIARIA_VALIDO = {
  id: 'limpieza_energetica_diaria',
  name: 'Limpieza Energética Diaria',
  entry_step_id: 'step_intro',
  steps: {
    step_intro: {
      screen_template_id: 'screen_intro_centered',
      step_type: 'experience',
      props: {
        title: 'Bienvenido a tu Limpieza Energética Diaria',
        subtitle: 'Dedica unos minutos a limpiar tu campo energético',
        button_text: 'Comenzar'
      }
    },
    step_eleccion: {
      screen_template_id: 'screen_choice_cards',
      step_type: 'decision',
      props: {
        title: '¿Qué área quieres limpiar hoy?',
        choices: [
          { id: 'emocional', label: 'Emocional', description: 'Libera emociones bloqueadas' },
          { id: 'mental', label: 'Mental', description: 'Limpia pensamientos negativos' },
          { id: 'fisico', label: 'Físico', description: 'Purifica tu cuerpo energético' }
        ]
      }
    },
    step_practica: {
      screen_template_id: 'screen_practice_timer',
      step_type: 'practice',
      props: {
        title: 'Practica de Limpieza',
        instructions: 'Respira profundamente y visualiza la luz limpiando tu campo energético',
        duration_seconds: 300,
        show_progress: true
      },
      emit: [
        {
          event_type: 'practice_completed',
          payload_template: {
            recorrido_id: 'limpieza_energetica_diaria',
            step_id: 'step_practica',
            user_id: '{{user_id}}',
            duration_seconds: 300
          }
        }
      ]
    },
    step_reflexion: {
      screen_template_id: 'screen_input_short',
      step_type: 'reflection',
      props: {
        title: '¿Cómo te sientes ahora?',
        placeholder: 'Describe brevemente tu experiencia...',
        max_length: 200,
        required: false
      }
    },
    step_cierre: {
      screen_template_id: 'screen_outro_summary',
      step_type: 'closure',
      props: {
        title: '¡Limpieza completada!',
        summary_text: 'Has dedicado tiempo a limpiar tu campo energético. ¡Bien hecho!',
        show_completion_badge: true
      }
    }
  },
  edges: [
    {
      from_step_id: 'step_intro',
      to_step_id: 'step_eleccion',
      condition: {
        type: 'always'
      }
    },
    {
      from_step_id: 'step_eleccion',
      to_step_id: 'step_practica',
      condition: {
        type: 'field_exists',
        params: {
          field: 'choice_id'
        }
      }
    },
    {
      from_step_id: 'step_practica',
      to_step_id: 'step_reflexion',
      condition: {
        type: 'always'
      }
    },
    {
      from_step_id: 'step_reflexion',
      to_step_id: 'step_cierre',
      condition: {
        type: 'always'
      }
    }
  ]
};

describe('validateRecorridoDefinition', () => {
  describe('Validación de RecorridoDefinition válido', () => {
    it('debe validar correctamente un RecorridoDefinition completo (Limpieza Diaria)', () => {
      const result = validateRecorridoDefinition(RECORRIDO_LIMPIEZA_DIARIA_VALIDO, { isPublish: false });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('debe permitir publish si es válido', () => {
      const result = validateRecorridoDefinition(RECORRIDO_LIMPIEZA_DIARIA_VALIDO, { isPublish: true });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
  
  describe('Errores de estructura base', () => {
    it('debe detectar RecorridoDefinition sin id', () => {
      const invalid = { ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO };
      delete invalid.id;
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('id'))).toBe(true);
    });
    
    it('debe detectar RecorridoDefinition sin entry_step_id', () => {
      const invalid = { ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO };
      delete invalid.entry_step_id;
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('entry_step_id'))).toBe(true);
    });
    
    it('debe detectar RecorridoDefinition sin steps', () => {
      const invalid = { ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO };
      delete invalid.steps;
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('steps'))).toBe(true);
    });
    
    it('debe detectar entry_step_id que no existe en steps', () => {
      const invalid = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        entry_step_id: 'step_inexistente'
      };
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('entry_step_id') && e.includes('no existe'))).toBe(true);
    });
  });
  
  describe('Errores de screen_template_id', () => {
    it('debe detectar screen_template_id inexistente', () => {
      const invalid = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        steps: {
          ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps,
          step_intro: {
            ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps.step_intro,
            screen_template_id: 'template_inexistente'
          }
        }
      };
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('screen_template_id') && e.includes('no existe'))).toBe(true);
    });
    
    it('debe detectar props inválidas según el schema del template', () => {
      const invalid = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        steps: {
          ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps,
          step_intro: {
            ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps.step_intro,
            props: {
              // Falta 'title' que es requerido
              subtitle: 'Solo subtitle'
            }
          }
        }
      };
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('props') && e.includes('title'))).toBe(true);
    });
  });
  
  describe('Errores de edges', () => {
    it('debe detectar edge con from_step_id inexistente', () => {
      const invalid = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        edges: [
          {
            from_step_id: 'step_inexistente',
            to_step_id: 'step_intro',
            condition: { type: 'always' }
          }
        ]
      };
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('from_step_id') && e.includes('no existe'))).toBe(true);
    });
    
    it('debe detectar edge con to_step_id inexistente', () => {
      const invalid = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        edges: [
          {
            from_step_id: 'step_intro',
            to_step_id: 'step_inexistente',
            condition: { type: 'always' }
          }
        ]
      };
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('to_step_id') && e.includes('no existe'))).toBe(true);
    });
    
    it('debe detectar condition.type inexistente', () => {
      const invalid = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        edges: [
          {
            from_step_id: 'step_intro',
            to_step_id: 'step_eleccion',
            condition: {
              type: 'condition_inexistente'
            }
          }
        ]
      };
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('condition.type') && e.includes('no existe'))).toBe(true);
    });
    
    it('debe detectar condition.params inválidos', () => {
      const invalid = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        edges: [
          {
            from_step_id: 'step_eleccion',
            to_step_id: 'step_practica',
            condition: {
              type: 'field_equals',
              // Falta 'value' que es requerido
              params: {
                field: 'choice_id'
              }
            }
          }
        ]
      };
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('condition.params'))).toBe(true);
    });
  });
  
  describe('Errores de event types', () => {
    it('debe detectar event_type inexistente en emit[]', () => {
      const invalid = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        steps: {
          ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps,
          step_practica: {
            ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps.step_practica,
            emit: [
              {
                event_type: 'event_inexistente',
                payload_template: {}
              }
            ]
          }
        }
      };
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('event_type') && e.includes('no existe'))).toBe(true);
    });
  });
  
  describe('Errores de resource_id', () => {
    it('debe detectar resource_id inexistente en PDE registry', () => {
      const invalid = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        steps: {
          ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps,
          step_intro: {
            ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps.step_intro,
            resource_id: 'resource_inexistente'
          }
        }
      };
      
      const result = validateRecorridoDefinition(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('resource_id') && e.includes('no existe'))).toBe(true);
    });
  });
  
  describe('Warnings (no bloqueantes)', () => {
    it('debe generar warning si step no tiene step_type', () => {
      const withWarning = {
        ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO,
        steps: {
          ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps,
          step_intro: {
            ...RECORRIDO_LIMPIEZA_DIARIA_VALIDO.steps.step_intro
            // step_type eliminado intencionalmente
          }
        }
      };
      delete withWarning.steps.step_intro.step_type;
      
      const result = validateRecorridoDefinition(withWarning, { isPublish: false });
      
      // Debe ser válido (solo warning)
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('step_type'))).toBe(true);
    });
  });
});







