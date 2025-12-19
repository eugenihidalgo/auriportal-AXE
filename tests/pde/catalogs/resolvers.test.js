// tests/pde/catalogs/resolvers.test.js
// Tests básicos para resolvers de catálogos PDE v1
//
// NOTA: Estos tests verifican que los resolvers:
// 1. Devuelven bundles con estructura correcta
// 2. Aplican filtros de nivel
// 3. Fail-open devuelve bundles vacíos (no errores)

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock del servicio de preparaciones
jest.unstable_mockModule('../../../src/services/preparaciones-practica.js', () => ({
  obtenerPreparacionesPorNivel: jest.fn()
}));

// Mock del servicio de técnicas post-práctica
jest.unstable_mockModule('../../../src/services/tecnicas-post-practica.js', () => ({
  obtenerTecnicasPostPracticaPorNivel: jest.fn()
}));

// Mock del servicio de protecciones
jest.unstable_mockModule('../../../src/services/protecciones-energeticas.js', () => ({
  listarProtecciones: jest.fn()
}));

// Mock del servicio de decretos
jest.unstable_mockModule('../../../src/services/decretos-service.js', () => ({
  listarDecretos: jest.fn(),
  obtenerDecreto: jest.fn()
}));

// Mock del logger
jest.unstable_mockModule('../../../src/core/observability/logger.js', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn()
}));

describe('Preparations Resolver', () => {
  let resolvePreparationBundle;
  let EMPTY_PREPARATION_BUNDLE;
  let mockObtenerPreparaciones;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const preparacionesMock = await import('../../../src/services/preparaciones-practica.js');
    mockObtenerPreparaciones = preparacionesMock.obtenerPreparacionesPorNivel;
    
    const resolver = await import('../../../src/core/pde/catalogs/preparations-resolver.js');
    resolvePreparationBundle = resolver.resolvePreparationBundle;
    EMPTY_PREPARATION_BUNDLE = resolver.EMPTY_PREPARATION_BUNDLE;
  });

  it('should return bundle with correct structure', async () => {
    mockObtenerPreparaciones.mockResolvedValue([
      { id: 1, nombre: 'Test', descripcion: 'Desc', nivel: 1, activo: true }
    ]);

    const ctx = { nivelInfo: { nivel: 3 } };
    const bundle = await resolvePreparationBundle(ctx, {});

    expect(bundle).toHaveProperty('catalog_id', 'preparations');
    expect(bundle).toHaveProperty('version', '1.0.0');
    expect(bundle).toHaveProperty('items');
    expect(bundle).toHaveProperty('meta');
    expect(Array.isArray(bundle.items)).toBe(true);
  });

  it('should filter items by student level', async () => {
    mockObtenerPreparaciones.mockResolvedValue([
      { id: 1, nombre: 'Nivel 1', nivel: 1 },
      { id: 2, nombre: 'Nivel 2', nivel: 2 },
      { id: 3, nombre: 'Nivel 5', nivel: 5 }
    ]);

    const ctx = { nivelInfo: { nivel: 2 } };
    const bundle = await resolvePreparationBundle(ctx, {});

    // Solo debería tener 2 items (nivel <= 2)
    expect(bundle.items.length).toBe(2);
    expect(bundle.items.map(i => i.nivel)).toEqual([1, 2]);
  });

  it('should return empty bundle on missing context (fail-open)', async () => {
    const bundle = await resolvePreparationBundle(null, {});

    expect(bundle.items).toEqual([]);
    expect(bundle.meta.reason).toBe('missing_student_context');
  });

  it('should return empty bundle on service error (fail-open)', async () => {
    mockObtenerPreparaciones.mockRejectedValue(new Error('DB Error'));

    const ctx = { nivelInfo: { nivel: 1 } };
    const bundle = await resolvePreparationBundle(ctx, {});

    expect(bundle.items).toEqual([]);
    expect(bundle.meta.reason).toBe('error');
  });
});

describe('Protections Resolver', () => {
  let resolveProtectionBundle;
  let mockListarProtecciones;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const proteccionesMock = await import('../../../src/services/protecciones-energeticas.js');
    mockListarProtecciones = proteccionesMock.listarProtecciones;
    
    const resolver = await import('../../../src/core/pde/catalogs/protections-resolver.js');
    resolveProtectionBundle = resolver.resolveProtectionBundle;
  });

  it('should return bundle with correct structure', async () => {
    mockListarProtecciones.mockResolvedValue([
      { id: 1, key: 'test_key', name: 'Test', status: 'active' }
    ]);

    const bundle = await resolveProtectionBundle(null, {});

    expect(bundle).toHaveProperty('catalog_id', 'protections');
    expect(bundle).toHaveProperty('version', '1.0.0');
    expect(bundle).toHaveProperty('items');
    expect(Array.isArray(bundle.items)).toBe(true);
  });

  it('should filter by recommended moment', async () => {
    mockListarProtecciones.mockResolvedValue([
      { id: 1, key: 'pre', name: 'Pre', recommended_moment: 'pre-practica' },
      { id: 2, key: 'trans', name: 'Trans', recommended_moment: 'transversal' },
      { id: 3, key: 'post', name: 'Post', recommended_moment: 'post-practica' }
    ]);

    const bundle = await resolveProtectionBundle(null, { moment: 'pre-practica' });

    // Debería tener pre-practica + transversal
    expect(bundle.items.length).toBe(2);
    expect(bundle.items.map(i => i.key)).toContain('pre');
    expect(bundle.items.map(i => i.key)).toContain('trans');
  });

  it('should return empty bundle on service error (fail-open)', async () => {
    mockListarProtecciones.mockRejectedValue(new Error('DB Error'));

    const bundle = await resolveProtectionBundle(null, {});

    expect(bundle.items).toEqual([]);
    expect(bundle.meta.reason).toBe('error');
  });
});

describe('Decrees Resolver', () => {
  let resolveDecreeBundle;
  let mockListarDecretos;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const decretosMock = await import('../../../src/services/decretos-service.js');
    mockListarDecretos = decretosMock.listarDecretos;
    
    const resolver = await import('../../../src/core/pde/catalogs/decrees-resolver.js');
    resolveDecreeBundle = resolver.resolveDecreeBundle;
  });

  it('should return bundle with correct structure', async () => {
    mockListarDecretos.mockResolvedValue([
      { id: 1, nombre: 'Test', contenido_html: '<p>Test</p>', nivel_minimo: 1, activo: true }
    ]);

    const ctx = { nivelInfo: { nivel: 3 } };
    const bundle = await resolveDecreeBundle(ctx, {});

    expect(bundle).toHaveProperty('catalog_id', 'decrees');
    expect(bundle).toHaveProperty('version', '1.0.0');
    expect(bundle).toHaveProperty('items');
    expect(Array.isArray(bundle.items)).toBe(true);
  });

  it('should filter items by nivel_minimo', async () => {
    mockListarDecretos.mockResolvedValue([
      { id: 1, nombre: 'Nivel 1', nivel_minimo: 1, activo: true },
      { id: 2, nombre: 'Nivel 3', nivel_minimo: 3, activo: true },
      { id: 3, nombre: 'Nivel 5', nivel_minimo: 5, activo: true }
    ]);

    const ctx = { nivelInfo: { nivel: 3 } };
    const bundle = await resolveDecreeBundle(ctx, {});

    // Solo debería tener 2 items (nivel_minimo <= 3)
    expect(bundle.items.length).toBe(2);
  });

  it('should include contenido_html by default', async () => {
    mockListarDecretos.mockResolvedValue([
      { id: 1, nombre: 'Test', contenido_html: '<p>Contenido</p>', nivel_minimo: 1, activo: true }
    ]);

    const ctx = { nivelInfo: { nivel: 1 } };
    const bundle = await resolveDecreeBundle(ctx, { include_content: true });

    expect(bundle.items[0]).toHaveProperty('contenido_html');
    expect(bundle.items[0].contenido_html).toBe('<p>Contenido</p>');
  });
});

describe('Bundle Structure Consistency', () => {
  it('all bundles should have consistent meta structure', async () => {
    const { EMPTY_PREPARATION_BUNDLE } = await import('../../../src/core/pde/catalogs/preparations-resolver.js');
    const { EMPTY_POST_PRACTICE_BUNDLE } = await import('../../../src/core/pde/catalogs/post-practices-resolver.js');
    const { EMPTY_PROTECTION_BUNDLE } = await import('../../../src/core/pde/catalogs/protections-resolver.js');
    const { EMPTY_DECREE_BUNDLE } = await import('../../../src/core/pde/catalogs/decrees-resolver.js');

    const emptyBundles = [
      EMPTY_PREPARATION_BUNDLE,
      EMPTY_POST_PRACTICE_BUNDLE,
      EMPTY_PROTECTION_BUNDLE,
      EMPTY_DECREE_BUNDLE
    ];

    for (const bundle of emptyBundles) {
      expect(bundle).toHaveProperty('catalog_id');
      expect(bundle).toHaveProperty('version');
      expect(bundle).toHaveProperty('items');
      expect(bundle).toHaveProperty('meta');
      expect(bundle.meta).toHaveProperty('resolved_at');
      expect(bundle.meta).toHaveProperty('reason');
      expect(Array.isArray(bundle.items)).toBe(true);
    }
  });
});






