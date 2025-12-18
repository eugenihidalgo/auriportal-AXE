// tests/recorridos/recorridos-versioning.test.js
// Tests mínimos críticos para el sistema de versionado de recorridos (DRAFT/PUBLISH)

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RecorridoRepoPg } from '../../src/infra/repos/recorrido-repo-pg.js';
import { RecorridoDraftRepoPg } from '../../src/infra/repos/recorrido-draft-repo-pg.js';
import { RecorridoVersionRepoPg } from '../../src/infra/repos/recorrido-version-repo-pg.js';
import { RecorridoAuditRepoPg } from '../../src/infra/repos/recorrido-audit-repo-pg.js';
import { validateRecorridoDefinition } from '../../src/core/recorridos/validate-recorrido-definition.js';
import { query } from '../../database/pg.js';

// Fixture: RecorridoDefinition válido mínimo
const RECORRIDO_DEFINITION_VALIDO = {
  id: 'test_limpieza_diaria',
  entry_step_id: 'step1',
  steps: {
    step1: {
      screen_template_id: 'blank',
      props: {}
    }
  },
  edges: []
};

describe('Sistema de Versionado de Recorridos', () => {
  let recorridoRepo;
  let draftRepo;
  let versionRepo;
  let auditRepo;
  const testRecorridoId = `test_recorrido_${Date.now()}`;

  beforeEach(() => {
    recorridoRepo = new RecorridoRepoPg();
    draftRepo = new RecorridoDraftRepoPg();
    versionRepo = new RecorridoVersionRepoPg();
    auditRepo = new RecorridoAuditRepoPg();
  });

  afterEach(async () => {
    // Limpiar datos de test
    try {
      await query('DELETE FROM recorrido_audit_log WHERE recorrido_id = $1', [testRecorridoId]);
      await query('DELETE FROM recorrido_versions WHERE recorrido_id = $1', [testRecorridoId]);
      await query('DELETE FROM recorrido_drafts WHERE recorrido_id = $1', [testRecorridoId]);
      await query('DELETE FROM recorridos WHERE id = $1', [testRecorridoId]);
    } catch (error) {
      // Ignorar errores de limpieza
    }
  });

  describe('Crear Recorrido', () => {
    it('debe crear un recorrido con draft válido mínimo', async () => {
      // Crear recorrido
      const recorrido = await recorridoRepo.createRecorrido({
        id: testRecorridoId,
        name: 'Test Limpieza Diaria'
      });

      expect(recorrido).toBeDefined();
      expect(recorrido.id).toBe(testRecorridoId);
      expect(recorrido.name).toBe('Test Limpieza Diaria');
      expect(recorrido.status).toBe('draft');

      // Crear draft inicial
      const draft = await draftRepo.createDraft(
        testRecorridoId,
        RECORRIDO_DEFINITION_VALIDO,
        'test_admin'
      );

      expect(draft).toBeDefined();
      expect(draft.recorrido_id).toBe(testRecorridoId);
      expect(draft.definition_json).toBeDefined();
      expect(draft.definition_json.id).toBe(testRecorridoId);

      // Actualizar recorrido con current_draft_id
      await recorridoRepo.updateRecorridoMeta(testRecorridoId, {
        current_draft_id: draft.draft_id
      });

      // Verificar que el draft se puede obtener
      const currentDraft = await draftRepo.getCurrentDraft(testRecorridoId);
      expect(currentDraft).toBeDefined();
      expect(currentDraft.draft_id).toBe(draft.draft_id);
    });
  });

  describe('Validar Draft', () => {
    it('debe validar un draft válido y devolver valid=true', async () => {
      // Crear recorrido y draft
      await recorridoRepo.createRecorrido({
        id: testRecorridoId,
        name: 'Test'
      });

      const draft = await draftRepo.createDraft(
        testRecorridoId,
        RECORRIDO_DEFINITION_VALIDO,
        'test_admin'
      );

      // Validar draft
      const validation = validateRecorridoDefinition(draft.definition_json, { isPublish: false });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      // Puede tener warnings, pero no errores
    });
  });

  describe('Publicar Versión', () => {
    it('debe bloquear publicación si el draft es inválido', async () => {
      // Crear recorrido
      await recorridoRepo.createRecorrido({
        id: testRecorridoId,
        name: 'Test'
      });

      // Crear draft inválido (sin entry_step_id)
      const draftInvalido = {
        id: testRecorridoId,
        steps: { step1: { screen_template_id: 'blank', props: {} } },
        edges: []
      };

      const draft = await draftRepo.createDraft(
        testRecorridoId,
        draftInvalido,
        'test_admin'
      );

      // Validar con isPublish:true (debe bloquear)
      const validation = validateRecorridoDefinition(draft.definition_json, { isPublish: true });

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('debe crear versión 1 y guardarla inmutable', async () => {
      // Crear recorrido
      await recorridoRepo.createRecorrido({
        id: testRecorridoId,
        name: 'Test'
      });

      // Crear draft válido
      const draft = await draftRepo.createDraft(
        testRecorridoId,
        RECORRIDO_DEFINITION_VALIDO,
        'test_admin'
      );

      // Validar que es válido
      const validation = validateRecorridoDefinition(draft.definition_json, { isPublish: true });
      expect(validation.valid).toBe(true);

      // Publicar versión 1
      const version = await versionRepo.createVersion(
        testRecorridoId,
        1,
        draft.definition_json,
        'Primera versión',
        'test_admin'
      );

      expect(version).toBeDefined();
      expect(version.recorrido_id).toBe(testRecorridoId);
      expect(version.version).toBe(1);
      expect(version.status).toBe('published');
      expect(version.definition_json).toBeDefined();
      expect(version.definition_json.id).toBe(testRecorridoId);

      // Verificar que la versión se puede obtener
      const retrievedVersion = await versionRepo.getVersion(testRecorridoId, 1);
      expect(retrievedVersion).toBeDefined();
      expect(retrievedVersion.version).toBe(1);
    });

    it('debe incrementar version correctamente', async () => {
      // Crear recorrido
      await recorridoRepo.createRecorrido({
        id: testRecorridoId,
        name: 'Test'
      });

      // Publicar versión 1
      const version1 = await versionRepo.createVersion(
        testRecorridoId,
        1,
        RECORRIDO_DEFINITION_VALIDO,
        'Versión 1',
        'test_admin'
      );

      expect(version1.version).toBe(1);

      // Publicar versión 2
      const definitionV2 = {
        ...RECORRIDO_DEFINITION_VALIDO,
        steps: {
          ...RECORRIDO_DEFINITION_VALIDO.steps,
          step2: {
            screen_template_id: 'blank',
            props: {}
          }
        }
      };

      const version2 = await versionRepo.createVersion(
        testRecorridoId,
        2,
        definitionV2,
        'Versión 2',
        'test_admin'
      );

      expect(version2.version).toBe(2);

      // Verificar que getLatestVersion devuelve la versión 2
      const latest = await versionRepo.getLatestVersion(testRecorridoId);
      expect(latest).toBeDefined();
      expect(latest.version).toBe(2);
    });
  });

  describe('Export/Import', () => {
    it('no debe romper published al importar', async () => {
      // Crear recorrido y publicar versión
      await recorridoRepo.createRecorrido({
        id: testRecorridoId,
        name: 'Test'
      });

      const version = await versionRepo.createVersion(
        testRecorridoId,
        1,
        RECORRIDO_DEFINITION_VALIDO,
        'Versión publicada',
        'test_admin'
      );

      // Actualizar recorrido con versión publicada
      await recorridoRepo.updateRecorridoMeta(testRecorridoId, {
        current_published_version: 1,
        status: 'published'
      });

      // Crear nuevo draft (simulando import)
      const draftImportado = await draftRepo.createDraft(
        testRecorridoId,
        {
          ...RECORRIDO_DEFINITION_VALIDO,
          steps: {
            ...RECORRIDO_DEFINITION_VALIDO.steps,
            step_importado: {
              screen_template_id: 'blank',
              props: {}
            }
          }
        },
        'test_admin'
      );

      // Verificar que la versión publicada sigue intacta
      const publishedVersion = await versionRepo.getVersion(testRecorridoId, 1);
      expect(publishedVersion).toBeDefined();
      expect(publishedVersion.version).toBe(1);
      expect(publishedVersion.definition_json.steps).not.toHaveProperty('step_importado');
      
      // El draft importado debe tener el nuevo step
      expect(draftImportado.definition_json.steps).toHaveProperty('step_importado');
    });
  });

  describe('Auditoría', () => {
    it('debe registrar eventos de auditoría', async () => {
      // Crear recorrido
      await recorridoRepo.createRecorrido({
        id: testRecorridoId,
        name: 'Test'
      });

      // Registrar evento de auditoría
      const log = await auditRepo.append(
        testRecorridoId,
        null,
        'create_recorrido',
        { name: 'Test' },
        'test_admin'
      );

      expect(log).toBeDefined();
      expect(log.recorrido_id).toBe(testRecorridoId);
      expect(log.action).toBe('create_recorrido');

      // Listar logs
      const logs = await auditRepo.listByRecorrido(testRecorridoId, 10);
      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('create_recorrido');
    });
  });
});




