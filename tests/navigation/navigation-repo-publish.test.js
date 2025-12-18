// tests/navigation/navigation-repo-publish.test.js
// Tests mínimos para el repositorio de navegación (publish/checksum/version)
//
// NOTA: Estos tests requieren una base de datos PostgreSQL disponible
// Si no hay base de datos, los tests se saltan automáticamente

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { NavigationRepoPg } from '../../src/infra/repos/navigation-repo-pg.js';
import { query, getPool } from '../../database/pg.js';
import { generateChecksum, createMinimalNavigation } from '../../src/core/navigation/navigation-definition-v1.js';

// Fixture: NavigationDefinition válida
const VALID_NAVIGATION = {
  navigation_id: 'test-nav-repo',
  name: 'Test Navigation Repo',
  entry_node_id: 'root',
  nodes: {
    root: { id: 'root', kind: 'section', label: 'Root', order: 0 },
    item1: { id: 'item1', kind: 'item', label: 'Item 1', order: 1, target: { type: 'screen', ref: '/test' } },
  },
  edges: [{ from: 'root', to: 'item1' }],
};

describe('NavigationRepoPg - Publish Flow', () => {
  let repo;
  const testNavigationId = `test_nav_repo_${Date.now()}`;

  beforeAll(async () => {
    // Verificar que la base de datos está disponible y las tablas existen
    try {
      await query('SELECT 1 FROM navigation_definitions LIMIT 1');
    } catch (error) {
      // Si las tablas no existen, saltar los tests
      console.warn('⚠️  Tablas de navegación no encontradas. Ejecute la migración v5.5.0 primero.');
      console.warn('   Saltando tests de repositorio...');
    }
  });

  beforeEach(() => {
    repo = new NavigationRepoPg();
  });

  afterEach(async () => {
    // Limpiar datos de test
    try {
      await query('DELETE FROM navigation_audit_log WHERE navigation_id = $1', [testNavigationId]);
      await query('DELETE FROM navigation_versions WHERE navigation_id = $1', [testNavigationId]);
      await query('DELETE FROM navigation_drafts WHERE navigation_id = $1', [testNavigationId]);
      await query('DELETE FROM navigation_definitions WHERE navigation_id = $1', [testNavigationId]);
    } catch (error) {
      // Ignorar errores de limpieza si las tablas no existen
    }
  });

  describe('ensureNavigation', () => {
    it('debe crear una navegación si no existe', async () => {
      const navigation = await repo.ensureNavigation(testNavigationId, {
        name: 'Test Navigation',
        description: 'Test description',
      });

      expect(navigation).toBeDefined();
      expect(navigation.navigation_id).toBe(testNavigationId);
      expect(navigation.name).toBe('Test Navigation');
      expect(navigation.activo).toBe(true);
    });

    it('debe retornar la existente si ya existe', async () => {
      // Crear primera vez
      const first = await repo.ensureNavigation(testNavigationId, { name: 'First' });
      
      // Intentar crear de nuevo
      const second = await repo.ensureNavigation(testNavigationId, { name: 'Second' });

      expect(second.id).toBe(first.id);
      expect(second.name).toBe('First'); // Mantiene el nombre original
    });
  });

  describe('Draft operations', () => {
    beforeEach(async () => {
      await repo.ensureNavigation(testNavigationId, { name: 'Test' });
    });

    it('debe crear y obtener un draft', async () => {
      const definition = { ...VALID_NAVIGATION, navigation_id: testNavigationId };
      
      const draft = await repo.upsertDraft(testNavigationId, definition, 'test_admin');

      expect(draft).toBeDefined();
      expect(draft.navigation_id).toBe(testNavigationId);
      expect(draft.draft_json).toBeDefined();
      expect(draft.draft_json.navigation_id).toBe(testNavigationId);

      const retrieved = await repo.getDraft(testNavigationId);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(draft.id);
    });

    it('debe actualizar draft existente', async () => {
      const definition = { ...VALID_NAVIGATION, navigation_id: testNavigationId };
      
      // Crear draft
      const first = await repo.upsertDraft(testNavigationId, definition, 'admin1');
      
      // Actualizar
      const updated = await repo.upsertDraft(testNavigationId, {
        ...definition,
        name: 'Updated Name',
      }, 'admin2');

      expect(updated.id).toBe(first.id);
      expect(updated.draft_json.name).toBe('Updated Name');
      expect(updated.updated_by).toBe('admin2');
    });
  });

  describe('Publish flow', () => {
    beforeEach(async () => {
      await repo.ensureNavigation(testNavigationId, { name: 'Test' });
      const definition = { ...VALID_NAVIGATION, navigation_id: testNavigationId };
      await repo.upsertDraft(testNavigationId, definition, 'test_admin');
    });

    it('debe publicar versión 1 con checksum', async () => {
      const version = await repo.publish(testNavigationId, 'test_admin');

      expect(version).toBeDefined();
      expect(version.version).toBe(1);
      expect(version.status).toBe('published');
      expect(version.checksum).toBeDefined();
      expect(version.checksum.length).toBe(64); // SHA256 hex
      expect(version.definition_json).toBeDefined();
    });

    it('debe incrementar versión correctamente', async () => {
      // Publicar versión 1
      const v1 = await repo.publish(testNavigationId, 'admin1');
      expect(v1.version).toBe(1);

      // Actualizar draft
      const definition = { ...VALID_NAVIGATION, navigation_id: testNavigationId, name: 'V2' };
      await repo.upsertDraft(testNavigationId, definition, 'admin2');

      // Publicar versión 2
      const v2 = await repo.publish(testNavigationId, 'admin2');
      expect(v2.version).toBe(2);

      // Verificar getLatest
      const latest = await repo.getPublishedLatest(testNavigationId);
      expect(latest.version).toBe(2);
    });

    it('debe generar checksums diferentes para definiciones diferentes', async () => {
      // Publicar versión 1
      const v1 = await repo.publish(testNavigationId, 'admin1');

      // Actualizar draft con contenido diferente
      const definition = {
        ...VALID_NAVIGATION,
        navigation_id: testNavigationId,
        name: 'Different Name',
        nodes: {
          ...VALID_NAVIGATION.nodes,
          item2: { id: 'item2', kind: 'item', label: 'Item 2', order: 2, target: { type: 'screen', ref: '/new' } },
        },
        edges: [
          ...VALID_NAVIGATION.edges,
          { from: 'root', to: 'item2' },
        ],
      };
      await repo.upsertDraft(testNavigationId, definition, 'admin2');

      // Publicar versión 2
      const v2 = await repo.publish(testNavigationId, 'admin2');

      expect(v1.checksum).not.toBe(v2.checksum);
    });

    it('debe bloquear publicación si el draft es inválido', async () => {
      // Crear draft inválido (sin entry_node_id válido)
      const invalidDef = {
        navigation_id: testNavigationId,
        name: 'Invalid',
        entry_node_id: 'nonexistent',
        nodes: { root: { id: 'root', kind: 'section', label: 'Root', order: 0 } },
        edges: [],
      };
      await repo.upsertDraft(testNavigationId, invalidDef, 'admin');

      await expect(repo.publish(testNavigationId, 'admin')).rejects.toThrow('Validación fallida');
    });

    it('debe fallar si no hay draft', async () => {
      // Crear navegación sin draft
      const newNavId = `${testNavigationId}_nodraft`;
      await repo.ensureNavigation(newNavId, { name: 'No Draft' });

      await expect(repo.publish(newNavId, 'admin')).rejects.toThrow('No hay draft');

      // Limpieza
      await query('DELETE FROM navigation_definitions WHERE navigation_id = $1', [newNavId]);
    });
  });

  describe('Export/Import', () => {
    beforeEach(async () => {
      await repo.ensureNavigation(testNavigationId, { name: 'Export Test' });
      const definition = { ...VALID_NAVIGATION, navigation_id: testNavigationId };
      await repo.upsertDraft(testNavigationId, definition, 'test_admin');
      await repo.publish(testNavigationId, 'test_admin');
    });

    it('debe exportar versión publicada', async () => {
      const exported = await repo.exportPublished(testNavigationId);

      expect(exported).toBeDefined();
      expect(exported._export_version).toBe('1.0');
      expect(exported.navigation.navigation_id).toBe(testNavigationId);
      expect(exported.version).toBe(1);
      expect(exported.checksum).toBeDefined();
      expect(exported.definition).toBeDefined();
    });

    it('debe importar como draft sin afectar published', async () => {
      // Obtener versión publicada original
      const originalPublished = await repo.getPublishedLatest(testNavigationId);
      const originalChecksum = originalPublished.checksum;

      // Exportar
      const exported = await repo.exportPublished(testNavigationId);

      // Modificar y reimportar
      exported.definition.name = 'Imported Version';
      const importedDraft = await repo.importAsDraft(testNavigationId, exported, 'importer');

      // Verificar que el draft se actualizó
      const draft = await repo.getDraft(testNavigationId);
      expect(draft.draft_json.name).toBe('Imported Version');

      // Verificar que published sigue igual
      const stillPublished = await repo.getPublishedLatest(testNavigationId);
      expect(stillPublished.checksum).toBe(originalChecksum);
    });
  });

  describe('Audit log', () => {
    beforeEach(async () => {
      await repo.ensureNavigation(testNavigationId, { name: 'Audit Test' });
    });

    it('debe registrar acciones en audit log', async () => {
      // Crear draft
      const definition = { ...VALID_NAVIGATION, navigation_id: testNavigationId };
      await repo.upsertDraft(testNavigationId, definition, 'admin1');
      await repo.appendAuditLog(testNavigationId, 'update_draft', { test: true }, 'admin1');

      // Publicar
      await repo.publish(testNavigationId, 'admin2');

      // Obtener logs
      const logs = await repo.getAuditLogs(testNavigationId, 10);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(l => l.action === 'publish')).toBe(true);
      expect(logs.some(l => l.action === 'update_draft')).toBe(true);
    });

    it('debe ordenar logs por fecha descendente', async () => {
      await repo.appendAuditLog(testNavigationId, 'validate', { first: true }, 'admin');
      await repo.appendAuditLog(testNavigationId, 'validate', { second: true }, 'admin');

      const logs = await repo.getAuditLogs(testNavigationId, 10);

      // El segundo debe estar primero (más reciente)
      expect(logs[0].payload.second).toBe(true);
      expect(logs[1].payload.first).toBe(true);
    });
  });

  describe('Checksum generation', () => {
    it('debe generar checksum determinista', async () => {
      const definition = { ...VALID_NAVIGATION };

      const checksum1 = await generateChecksum(definition);
      const checksum2 = await generateChecksum(definition);

      expect(checksum1).toBe(checksum2);
      expect(checksum1.length).toBe(64); // SHA256 hex
    });

    it('debe generar checksums diferentes para definiciones diferentes', async () => {
      const def1 = { ...VALID_NAVIGATION };
      const def2 = { ...VALID_NAVIGATION, name: 'Different' };

      const checksum1 = await generateChecksum(def1);
      const checksum2 = await generateChecksum(def2);

      expect(checksum1).not.toBe(checksum2);
    });
  });
});




