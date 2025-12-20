// tests/resolver-v1.test.js
// Tests mínimos críticos para Resolver v1

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { validateResolverDefinition, resolvePackage } from '../src/services/pde-resolver-service.js';
import { getDefaultPdeResolversRepo } from '../src/infra/repos/pde-resolvers-repo-pg.js';
import { initPostgreSQL } from '../database/pg.js';

describe('Resolver v1 - Tests Mínimos Críticos', () => {
  beforeAll(async () => {
    // Inicializar PostgreSQL
    initPostgreSQL();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('validateResolverDefinition', () => {
    it('debe validar un ResolverDefinition válido', () => {
      const definition = {
        resolver_key: 'test-resolver',
        label: 'Test Resolver',
        policy: {
          mode: 'per_source',
          global: {
            seed: 'stable',
            ordering: 'canonical',
            default_max_items: null
          },
          rules: []
        }
      };

      const result = validateResolverDefinition(definition);
      expect(result.ok).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('debe rechazar un ResolverDefinition sin resolver_key', () => {
      const definition = {
        label: 'Test Resolver',
        policy: {}
      };

      const result = validateResolverDefinition(definition);
      expect(result.ok).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('debe validar reglas con matching por enum', () => {
      const definition = {
        resolver_key: 'test-resolver',
        label: 'Test Resolver',
        policy: {
          mode: 'per_source',
          global: {},
          rules: [
            {
              when: {
                context: {
                  tipo_limpieza: ['rapida', 'basica']
                }
              },
              apply: {
                sources: {
                  transmutaciones_energeticas: {
                    max_items: 5
                  }
                }
              }
            }
          ]
        }
      };

      const result = validateResolverDefinition(definition);
      expect(result.ok).toBe(true);
    });

    it('debe validar reglas con rango de nivel', () => {
      const definition = {
        resolver_key: 'test-resolver',
        label: 'Test Resolver',
        policy: {
          mode: 'per_source',
          global: {},
          rules: [
            {
              when: {
                context: {
                  nivel_efectivo_min: 1,
                  nivel_efectivo_max: 7
                }
              },
              apply: {
                sources: {
                  transmutaciones_energeticas: {
                    max_items: 10
                  }
                }
              }
            }
          ]
        }
      };

      const result = validateResolverDefinition(definition);
      expect(result.ok).toBe(true);
    });
  });

  describe('resolvePackage', () => {
    it('debe resolver un package con regla que hace match por enum', () => {
      const packageDefinition = {
        package_key: 'test-package',
        sources: [
          {
            source_key: 'transmutaciones_energeticas'
          }
        ]
      };

      const resolverDefinition = {
        resolver_key: 'test-resolver',
        policy: {
          mode: 'per_source',
          global: {
            ordering: 'canonical'
          },
          rules: [
            {
              when: {
                context: {
                  tipo_limpieza: ['rapida']
                }
              },
              apply: {
                sources: {
                  transmutaciones_energeticas: {
                    max_items: 5
                  }
                }
              }
            }
          ]
        }
      };

      const effectiveContext = {
        tipo_limpieza: 'rapida',
        nivel_efectivo: 3
      };

      const catalogsSnapshot = {
        transmutaciones_energeticas: [
          { id: 1, label: 'Item 1' },
          { id: 2, label: 'Item 2' },
          { id: 3, label: 'Item 3' },
          { id: 4, label: 'Item 4' },
          { id: 5, label: 'Item 5' },
          { id: 6, label: 'Item 6' }
        ]
      };

      const result = resolvePackage({
        packageDefinition,
        resolverDefinition,
        effectiveContext,
        catalogsSnapshot
      });

      expect(result.ok).toBe(true);
      expect(result.resolved_sources).toHaveLength(1);
      expect(result.resolved_sources[0].items).toHaveLength(5); // max_items aplicado
      expect(result.resolved_sources[0].meta.selected).toBe(5);
      expect(result.resolved_sources[0].meta.total).toBe(6);
    });

    it('debe resolver un package con regla que hace match por nivel', () => {
      const packageDefinition = {
        package_key: 'test-package',
        sources: [
          {
            source_key: 'transmutaciones_energeticas'
          }
        ]
      };

      const resolverDefinition = {
        resolver_key: 'test-resolver',
        policy: {
          mode: 'per_source',
          global: {
            ordering: 'canonical'
          },
          rules: [
            {
              when: {
                context: {
                  nivel_efectivo_min: 1,
                  nivel_efectivo_max: 5
                }
              },
              apply: {
                sources: {
                  transmutaciones_energeticas: {
                    max_items: 3
                  }
                }
              }
            }
          ]
        }
      };

      const effectiveContext = {
        nivel_efectivo: 3
      };

      const catalogsSnapshot = {
        transmutaciones_energeticas: [
          { id: 1, label: 'Item 1' },
          { id: 2, label: 'Item 2' },
          { id: 3, label: 'Item 3' },
          { id: 4, label: 'Item 4' }
        ]
      };

      const result = resolvePackage({
        packageDefinition,
        resolverDefinition,
        effectiveContext,
        catalogsSnapshot
      });

      expect(result.ok).toBe(true);
      expect(result.resolved_sources[0].items).toHaveLength(3); // max_items aplicado
    });

    it('debe usar fallback global.default_max_items si no hay regla match', () => {
      const packageDefinition = {
        package_key: 'test-package',
        sources: [
          {
            source_key: 'transmutaciones_energeticas'
          }
        ]
      };

      const resolverDefinition = {
        resolver_key: 'test-resolver',
        policy: {
          mode: 'per_source',
          global: {
            ordering: 'canonical',
            default_max_items: 2
          },
          rules: [
            {
              when: {
                context: {
                  tipo_limpieza: ['otro']
                }
              },
              apply: {
                sources: {
                  transmutaciones_energeticas: {
                    max_items: 10
                  }
                }
              }
            }
          ]
        }
      };

      const effectiveContext = {
        tipo_limpieza: 'rapida', // No hace match con la regla
        nivel_efectivo: 3
      };

      const catalogsSnapshot = {
        transmutaciones_energeticas: [
          { id: 1, label: 'Item 1' },
          { id: 2, label: 'Item 2' },
          { id: 3, label: 'Item 3' },
          { id: 4, label: 'Item 4' }
        ]
      };

      const result = resolvePackage({
        packageDefinition,
        resolverDefinition,
        effectiveContext,
        catalogsSnapshot
      });

      expect(result.ok).toBe(true);
      expect(result.resolved_sources[0].items).toHaveLength(2); // default_max_items aplicado
    });

    it('debe devolver todos los items si no hay max_items definido', () => {
      const packageDefinition = {
        package_key: 'test-package',
        sources: [
          {
            source_key: 'transmutaciones_energeticas'
          }
        ]
      };

      const resolverDefinition = {
        resolver_key: 'test-resolver',
        policy: {
          mode: 'per_source',
          global: {
            ordering: 'canonical'
          },
          rules: []
        }
      };

      const effectiveContext = {
        nivel_efectivo: 3
      };

      const catalogsSnapshot = {
        transmutaciones_energeticas: [
          { id: 1, label: 'Item 1' },
          { id: 2, label: 'Item 2' },
          { id: 3, label: 'Item 3' }
        ]
      };

      const result = resolvePackage({
        packageDefinition,
        resolverDefinition,
        effectiveContext,
        catalogsSnapshot
      });

      expect(result.ok).toBe(true);
      expect(result.resolved_sources[0].items).toHaveLength(3); // Todos los items
    });

    it('debe generar UI hints correctamente', () => {
      const packageDefinition = {
        package_key: 'test-package',
        sources: [
          {
            source_key: 'transmutaciones_energeticas'
          }
        ]
      };

      const resolverDefinition = {
        resolver_key: 'test-resolver',
        policy: {
          mode: 'per_source',
          global: {},
          rules: [
            {
              when: {
                context: {
                  tipo_limpieza: ['rapida']
                }
              },
              apply: {
                sources: {
                  transmutaciones_energeticas: {
                    max_items: 5,
                    widget_hint: 'checklist'
                  }
                }
              }
            }
          ]
        }
      };

      const effectiveContext = {
        tipo_limpieza: 'rapida'
      };

      const catalogsSnapshot = {
        transmutaciones_energeticas: []
      };

      const result = resolvePackage({
        packageDefinition,
        resolverDefinition,
        effectiveContext,
        catalogsSnapshot
      });

      expect(result.ok).toBe(true);
      expect(result.ui_hints.widgets).toHaveLength(1);
      expect(result.ui_hints.widgets[0].widget).toBe('checklist');
      expect(result.ui_hints.widgets[0].source_key).toBe('transmutaciones_energeticas');
    });
  });

  describe('Repositorio - Operaciones básicas', () => {
    it('debe listar resolvers', async () => {
      const repo = getDefaultPdeResolversRepo();
      const resolvers = await repo.list({ includeDeleted: false });
      
      expect(Array.isArray(resolvers)).toBe(true);
    });

    it('debe crear un resolver draft', async () => {
      const repo = getDefaultPdeResolversRepo();
      
      const resolverData = {
        resolver_key: `test-resolver-${Date.now()}`,
        label: 'Test Resolver',
        description: 'Test description',
        definition: {
          resolver_key: `test-resolver-${Date.now()}`,
          label: 'Test Resolver',
          policy: {
            mode: 'per_source',
            global: {
              seed: 'stable',
              ordering: 'canonical'
            },
            rules: []
          }
        },
        status: 'draft',
        version: 1
      };

      const resolver = await repo.create(resolverData);
      
      expect(resolver).toBeDefined();
      expect(resolver.resolver_key).toBe(resolverData.resolver_key);
      expect(resolver.status).toBe('draft');
      expect(resolver.definition).toBeDefined();
      
      // Limpiar
      await repo.softDelete(resolver.id);
    });
  });
});

