// tests/energy/transmutations-validator.test.js
// Tests unitarios para el validador del catálogo de transmutaciones

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { 
  validateTransmutationsCatalog, 
  EMPTY_CATALOG, 
  isValidSlug 
} from '../../src/core/energy/transmutations/catalog-validator.js';

describe('catalog-validator', () => {
  describe('isValidSlug', () => {
    it('acepta slugs válidos con formato correcto', () => {
      expect(isValidSlug('miedo-valor')).toBe(true);
      expect(isValidSlug('ansiedad-serenidad')).toBe(true);
      expect(isValidSlug('simple')).toBe(true);
      expect(isValidSlug('a1-b2-c3')).toBe(true);
    });

    it('rechaza slugs con mayúsculas', () => {
      expect(isValidSlug('Miedo-Valor')).toBe(false);
      expect(isValidSlug('UPPERCASE')).toBe(false);
    });

    it('rechaza slugs con caracteres especiales', () => {
      expect(isValidSlug('miedo_valor')).toBe(false); // underscore
      expect(isValidSlug('miedo.valor')).toBe(false); // punto
      expect(isValidSlug('miedo valor')).toBe(false); // espacio
      expect(isValidSlug('miedo@valor')).toBe(false); // arroba
    });

    it('rechaza slugs con guiones al inicio o final', () => {
      expect(isValidSlug('-miedo')).toBe(false);
      expect(isValidSlug('valor-')).toBe(false);
      expect(isValidSlug('-miedo-valor-')).toBe(false);
    });

    it('rechaza slugs vacíos o nulos', () => {
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug(null)).toBe(false);
      expect(isValidSlug(undefined)).toBe(false);
    });
  });

  describe('validateTransmutationsCatalog', () => {
    // Catálogo mínimo válido para tests
    const createValidCatalog = (overrides = {}) => ({
      catalog_id: 'energy_transmutations',
      version: '1.0.0',
      status: 'published',
      modes: [
        {
          mode_id: 'basica',
          label: 'Limpieza Básica',
          max_transmutations: 10,
          selection_strategy: 'ordered',
          filters: { respect_level_cap: true }
        }
      ],
      transmutations: [
        {
          transmutation_id: 'trans_001',
          slug: 'miedo-valor',
          name: 'Miedo → Valor',
          description: 'Transforma el miedo en valor',
          min_level: 1,
          weight: 100,
          category: 'emocional',
          is_active: true
        }
      ],
      techniques: [
        {
          technique_id: 'tech_001',
          slug: 'respiracion-transmutadora',
          name: 'Respiración Transmutadora',
          description: 'Técnica de respiración',
          min_level: 1,
          category: 'respiracion',
          is_active: true
        }
      ],
      ...overrides
    });

    it('valida un catálogo completo correctamente', () => {
      const catalog = createValidCatalog();
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(catalog);
      expect(result.errors).toBeUndefined();
    });

    it('rechaza catálogo sin catalog_id', () => {
      const catalog = createValidCatalog();
      delete catalog.catalog_id;
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('catalog_id es requerido y debe ser string');
    });

    it('rechaza catálogo sin version', () => {
      const catalog = createValidCatalog();
      delete catalog.version;
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('version es requerido y debe ser string');
    });

    it('advierte si status no es published', () => {
      const catalog = createValidCatalog({ status: 'draft' });
      const result = validateTransmutationsCatalog(catalog);
      
      // Debe ser válido pero con warning
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Catálogo con status 'draft' (no es 'published')");
    });

    it('rechaza catálogo sin modos', () => {
      const catalog = createValidCatalog({ modes: [] });
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('modes debe tener al menos un modo');
    });

    it('rechaza modos con mode_id duplicados', () => {
      const catalog = createValidCatalog({
        modes: [
          { mode_id: 'basica', label: 'Básica 1', max_transmutations: 10, selection_strategy: 'ordered' },
          { mode_id: 'basica', label: 'Básica 2', max_transmutations: 20, selection_strategy: 'ordered' }
        ]
      });
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("ID duplicado 'basica'"))).toBe(true);
    });

    it('rechaza transmutaciones con slug duplicado', () => {
      const catalog = createValidCatalog({
        transmutations: [
          { transmutation_id: 'trans_001', slug: 'miedo-valor', name: 'Trans 1', min_level: 1, is_active: true },
          { transmutation_id: 'trans_002', slug: 'miedo-valor', name: 'Trans 2', min_level: 1, is_active: true }
        ]
      });
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("slug duplicado 'miedo-valor'"))).toBe(true);
    });

    it('rechaza transmutación con slug inválido', () => {
      const catalog = createValidCatalog({
        transmutations: [
          { transmutation_id: 'trans_001', slug: 'Miedo_Valor', name: 'Trans 1', min_level: 1, is_active: true }
        ]
      });
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("no es válido"))).toBe(true);
    });

    it('rechaza min_level fuera de rango', () => {
      const catalog = createValidCatalog({
        transmutations: [
          { transmutation_id: 'trans_001', slug: 'test-trans', name: 'Trans', min_level: 0, is_active: true }
        ]
      });
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('min_level debe estar entre'))).toBe(true);
    });

    it('rechaza max_transmutations fuera de rango', () => {
      const catalog = createValidCatalog({
        modes: [
          { mode_id: 'huge', label: 'Huge', max_transmutations: 150, selection_strategy: 'ordered' }
        ]
      });
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('max_transmutations debe estar entre'))).toBe(true);
    });

    it('rechaza selection_strategy inválida', () => {
      const catalog = createValidCatalog({
        modes: [
          { mode_id: 'test', label: 'Test', max_transmutations: 10, selection_strategy: 'invalid_strategy' }
        ]
      });
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("selection_strategy 'invalid_strategy' no es válida"))).toBe(true);
    });

    it('rechaza si catalog es null o no es objeto', () => {
      expect(validateTransmutationsCatalog(null).valid).toBe(false);
      expect(validateTransmutationsCatalog(undefined).valid).toBe(false);
      expect(validateTransmutationsCatalog('string').valid).toBe(false);
      expect(validateTransmutationsCatalog(123).valid).toBe(false);
    });

    it('rechaza transmutación sin is_active boolean', () => {
      const catalog = createValidCatalog({
        transmutations: [
          { transmutation_id: 'trans_001', slug: 'test', name: 'Test', min_level: 1, is_active: 'true' }
        ]
      });
      
      const result = validateTransmutationsCatalog(catalog);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('is_active es requerido y debe ser boolean'))).toBe(true);
    });
  });

  describe('EMPTY_CATALOG', () => {
    it('tiene estructura válida para fallback', () => {
      expect(EMPTY_CATALOG.catalog_id).toBe('energy_transmutations');
      expect(EMPTY_CATALOG.status).toBe('empty');
      expect(Array.isArray(EMPTY_CATALOG.modes)).toBe(true);
      expect(Array.isArray(EMPTY_CATALOG.transmutations)).toBe(true);
      expect(Array.isArray(EMPTY_CATALOG.techniques)).toBe(true);
      expect(EMPTY_CATALOG.metadata.reason).toBe('fallback_empty_catalog');
    });
  });
});




