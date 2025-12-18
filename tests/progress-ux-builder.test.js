// tests/progress-ux-builder.test.js
// Tests mínimos para el builder de experiencia UX de progreso
//
// Casos de prueba:
// 1. Con nivelInfo completo: devuelve nivelInfoUX con estructura válida
// 2. Con nivelInfo incompleto o null: NO lanza, devuelve estructura válida con defaults

import { describe, it, expect } from '@jest/globals';
import { buildProgressUX } from '../src/core/progress-ux-builder.js';

describe('ProgressUXBuilder', () => {
  describe('buildProgressUX', () => {
    it('debe devolver nivelInfoUX con estructura válida cuando nivelInfo es completo', () => {
      const nivelInfo = {
        nivel_efectivo: 7,
        nivel_base: 6,
        fase_efectiva: {
          id: 'sanacion_avanzada',
          nombre: 'Sanación Avanzada',
          reason: 'config_resolved'
        }
      };

      const nivelInfoUX = buildProgressUX(nivelInfo);

      // Verificar estructura
      expect(nivelInfoUX).toBeDefined();
      expect(nivelInfoUX.nivel).toBeDefined();
      expect(nivelInfoUX.fase).toBeDefined();
      expect(nivelInfoUX.estado).toBeDefined();

      // Verificar nivel
      expect(typeof nivelInfoUX.nivel.actual).toBe('number');
      expect(nivelInfoUX.nivel.actual).toBe(7);
      expect(typeof nivelInfoUX.nivel.nombre).toBe('string');
      expect(nivelInfoUX.nivel.nombre.length).toBeGreaterThan(0);

      // Verificar fase
      expect(typeof nivelInfoUX.fase.id).toBe('string');
      expect(nivelInfoUX.fase.id).toBe('sanacion_avanzada');
      expect(typeof nivelInfoUX.fase.nombre).toBe('string');
      expect(nivelInfoUX.fase.nombre.length).toBeGreaterThan(0);

      // Verificar estado
      expect(typeof nivelInfoUX.estado.mensaje_corto).toBe('string');
      expect(nivelInfoUX.estado.mensaje_corto.length).toBeGreaterThan(0);
    });

    it('debe usar nivel desde nivelInfo.nivel si nivel_efectivo no existe', () => {
      const nivelInfo = {
        nivel: 5,
        fase_efectiva: {
          id: 'sanacion',
          nombre: 'Sanación'
        }
      };

      const nivelInfoUX = buildProgressUX(nivelInfo);

      expect(nivelInfoUX.nivel.actual).toBe(5);
    });

    it('debe NO lanzar y devolver estructura válida cuando nivelInfo es null', () => {
      expect(() => {
        const nivelInfoUX = buildProgressUX(null);
        
        // Verificar que devuelve estructura válida
        expect(nivelInfoUX).toBeDefined();
        expect(nivelInfoUX.nivel).toBeDefined();
        expect(nivelInfoUX.fase).toBeDefined();
        expect(nivelInfoUX.estado).toBeDefined();
        
        // Verificar defaults
        expect(nivelInfoUX.fase.id).toBe('unknown');
        expect(typeof nivelInfoUX.estado.mensaje_corto).toBe('string');
        expect(nivelInfoUX.estado.mensaje_corto.length).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('debe NO lanzar y devolver estructura válida cuando nivelInfo es undefined', () => {
      expect(() => {
        const nivelInfoUX = buildProgressUX(undefined);
        
        expect(nivelInfoUX).toBeDefined();
        expect(nivelInfoUX.fase.id).toBe('unknown');
        expect(typeof nivelInfoUX.estado.mensaje_corto).toBe('string');
      }).not.toThrow();
    });

    it('debe manejar fase_efectiva faltante con fallback seguro', () => {
      const nivelInfo = {
        nivel_efectivo: 3,
        nivel_base: 3
        // Sin fase_efectiva
      };

      const nivelInfoUX = buildProgressUX(nivelInfo);

      expect(nivelInfoUX).toBeDefined();
      expect(nivelInfoUX.fase.id).toBe('unknown');
      expect(nivelInfoUX.fase.nombre).toBe('Fase no disponible');
      expect(nivelInfoUX.fase.reason).toBe('missing_phase_object');
    });

    it('debe manejar fase_efectiva incompleta con fallback seguro', () => {
      const nivelInfo = {
        nivel_efectivo: 4,
        fase_efectiva: {
          // Sin id ni nombre
        }
      };

      const nivelInfoUX = buildProgressUX(nivelInfo);

      expect(nivelInfoUX).toBeDefined();
      expect(nivelInfoUX.fase.id).toBe('unknown');
      expect(nivelInfoUX.fase.nombre).toBe('Fase no disponible');
    });

    it('debe copiar reason de fase_efectiva si existe', () => {
      const nivelInfo = {
        nivel_efectivo: 8,
        fase_efectiva: {
          id: 'canalizacion',
          nombre: 'Canalización',
          reason: 'test_reason'
        }
      };

      const nivelInfoUX = buildProgressUX(nivelInfo);

      expect(nivelInfoUX.fase.reason).toBe('test_reason');
    });

    it('debe manejar nivel_efectivo 0 con nombre por defecto', () => {
      const nivelInfo = {
        nivel_efectivo: 0,
        fase_efectiva: {
          id: 'sanacion',
          nombre: 'Sanación'
        }
      };

      const nivelInfoUX = buildProgressUX(nivelInfo);

      expect(nivelInfoUX.nivel.actual).toBe(0);
      expect(nivelInfoUX.nivel.nombre).toBe('Nivel'); // Sin número si es 0
    });
  });
});

