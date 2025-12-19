// tests/config/niveles-energeticos.schema.test.js
// Tests para el schema y validador de niveles energéticos

import { describe, it, expect } from '@jest/globals';
import { 
  validateAndNormalizeNivelesEnergeticos, 
  resolveFaseFromConfig 
} from '../../src/core/config/niveles-energeticos.schema.js';

describe('niveles-energeticos.schema', () => {
  describe('validateAndNormalizeNivelesEnergeticos', () => {
    it('debe validar una configuración válida simple', () => {
      const config = [
        { fase: 'sanación', nivel_min: 1, nivel_max: 6, descripcion: 'Fase inicial' },
        { fase: 'canalización', nivel_min: 10, nivel_max: 15, descripcion: 'Fase avanzada' }
      ];
      
      const result = validateAndNormalizeNivelesEnergeticos(config);
      
      expect(result.ok).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.length).toBe(2);
      expect(result.value[0].fase).toBe('sanación');
      expect(result.value[0].nivel_min).toBe(1);
      expect(result.value[0].nivel_max).toBe(6);
    });

    it('debe rechazar config que no es un array', () => {
      const result = validateAndNormalizeNivelesEnergeticos(null);
      
      expect(result.ok).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('array');
    });

    it('debe rechazar array vacío', () => {
      const result = validateAndNormalizeNivelesEnergeticos([]);
      
      expect(result.ok).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors[0]).toContain('al menos una fase');
    });

    it('debe rechazar fase sin nombre', () => {
      const config = [
        { fase: '', nivel_min: 1, nivel_max: 6 }
      ];
      
      const result = validateAndNormalizeNivelesEnergeticos(config);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('fase') && e.includes('obligatorio'))).toBe(true);
    });

    it('debe rechazar nivel_min inválido', () => {
      const config = [
        { fase: 'sanación', nivel_min: -1, nivel_max: 6 }
      ];
      
      const result = validateAndNormalizeNivelesEnergeticos(config);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('nivel_min'))).toBe(true);
    });

    it('debe rechazar cuando nivel_max < nivel_min', () => {
      const config = [
        { fase: 'sanación', nivel_min: 10, nivel_max: 5 }
      ];
      
      const result = validateAndNormalizeNivelesEnergeticos(config);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('nivel_max') && e.includes('>='))).toBe(true);
    });

    it('debe detectar solapamientos de rangos', () => {
      const config = [
        { fase: 'sanación', nivel_min: 1, nivel_max: 10 },
        { fase: 'canalización', nivel_min: 5, nivel_max: 15 }
      ];
      
      const result = validateAndNormalizeNivelesEnergeticos(config);
      
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('Solapamiento'))).toBe(true);
    });

    it('debe normalizar tipos (strings a números)', () => {
      const config = [
        { fase: 'sanación', nivel_min: '1', nivel_max: '6', descripcion: 'Test' }
      ];
      
      const result = validateAndNormalizeNivelesEnergeticos(config);
      
      expect(result.ok).toBe(true);
      expect(result.value[0].nivel_min).toBe(1);
      expect(result.value[0].nivel_max).toBe(6);
      expect(typeof result.value[0].nivel_min).toBe('number');
      expect(typeof result.value[0].nivel_max).toBe('number');
    });

    it('debe permitir fases catch-all (null-null)', () => {
      const config = [
        { fase: 'creación', nivel_min: null, nivel_max: null }
      ];
      
      const result = validateAndNormalizeNivelesEnergeticos(config);
      
      expect(result.ok).toBe(true);
      expect(result.value[0].nivel_min).toBe(null);
      expect(result.value[0].nivel_max).toBe(null);
    });

    it('debe ordenar fases por nivel_min', () => {
      const config = [
        { fase: 'canalización', nivel_min: 10, nivel_max: 15 },
        { fase: 'sanación', nivel_min: 1, nivel_max: 9 }
      ];
      
      const result = validateAndNormalizeNivelesEnergeticos(config);
      
      expect(result.ok).toBe(true);
      expect(result.value[0].fase).toBe('sanación');
      expect(result.value[1].fase).toBe('canalización');
    });
  });

  describe('resolveFaseFromConfig', () => {
    const configValida = [
      { fase: 'sanación', nivel_min: 1, nivel_max: 6, descripcion: 'Fase inicial' },
      { fase: 'canalización', nivel_min: 10, nivel_max: 15, descripcion: 'Fase avanzada' },
      { fase: 'creación', nivel_min: null, nivel_max: null, descripcion: 'Catch-all' }
    ];

    it('debe resolver fase correcta para nivel en rango', () => {
      const result = resolveFaseFromConfig(configValida, 5);
      
      expect(result.id).toBe('sanación');
      expect(result.nombre).toBe('sanación');
      expect(result.descripcion).toBe('Fase inicial');
    });

    it('debe resolver fase catch-all cuando nivel no está en ningún rango', () => {
      const result = resolveFaseFromConfig(configValida, 7);
      
      expect(result.id).toBe('creación');
      expect(result.nombre).toBe('creación');
    });

    it('debe retornar fase unknown cuando config está vacía', () => {
      const result = resolveFaseFromConfig([], 5);
      
      expect(result.id).toBe('unknown');
      expect(result.nombre).toBe('Fase no disponible');
      expect(result.reason).toBe('config_empty');
    });

    it('debe retornar fase unknown cuando nivel no tiene cobertura', () => {
      const configSinCatchAll = [
        { fase: 'sanación', nivel_min: 1, nivel_max: 6 }
      ];
      
      const result = resolveFaseFromConfig(configSinCatchAll, 10);
      
      expect(result.id).toBe('unknown');
      expect(result.reason).toBe('nivel_10_sin_cobertura');
    });

    it('debe normalizar IDs de fase (lowercase, sin espacios)', () => {
      const config = [
        { fase: 'Sanación Avanzada', nivel_min: 1, nivel_max: 6 }
      ];
      
      const result = resolveFaseFromConfig(config, 3);
      
      expect(result.id).toBe('sanación_avanzada');
      expect(result.nombre).toBe('Sanación Avanzada');
    });
  });
});












