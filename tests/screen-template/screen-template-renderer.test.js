// tests/screen-template/screen-template-renderer.test.js
// Tests para Screen Template Renderer v1
//
// SPRINT AXE v0.5 - Screen Templates v1

import { describe, it, expect, jest } from '@jest/globals';

// Mock de repositorios
jest.mock('../../src/infra/repos/screen-template-version-repo-pg.js', () => ({
  getDefaultScreenTemplateVersionRepo: jest.fn(() => ({
    getLatestVersion: jest.fn()
  }))
}));

// Mock de responses
jest.mock('../../src/core/responses.js', () => ({
  applyTheme: jest.fn((html) => html) // No modifica HTML en tests
}));

import { renderScreenTemplate, renderScreenTemplatePreview } from '../../src/core/screen-template/screen-template-renderer.js';
import { getDefaultScreenTemplateVersionRepo } from '../../src/infra/repos/screen-template-version-repo-pg.js';

describe('Screen Template Renderer', () => {
  describe('renderScreenTemplate', () => {
    it('debe renderizar template válido correctamente', async () => {
      const versionRepo = getDefaultScreenTemplateVersionRepo();
      versionRepo.getLatestVersion.mockResolvedValue({
        definition_json: {
          id: 'test-template',
          name: 'Test',
          template_type: 'custom',
          schema: { type: 'object', properties: {} },
          html_template: '<html><body><h1>{{title}}</h1></body></html>'
        }
      });

      const html = await renderScreenTemplate('test-template', { title: 'Hello' });
      expect(html).toContain('Hello');
      expect(html).toContain('<h1>');
    });

    it('debe usar fallback si template no existe (fail-open)', async () => {
      const versionRepo = getDefaultScreenTemplateVersionRepo();
      versionRepo.getLatestVersion.mockResolvedValue(null);

      const html = await renderScreenTemplate('non-existent', {});
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Pantalla');
    });

    it('debe usar fallback si template no tiene html_template (fail-open)', async () => {
      const versionRepo = getDefaultScreenTemplateVersionRepo();
      versionRepo.getLatestVersion.mockResolvedValue({
        definition_json: {
          id: 'test',
          name: 'Test',
          template_type: 'custom',
          schema: { type: 'object', properties: {} }
          // Sin html_template
        }
      });

      const html = await renderScreenTemplate('test', {});
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('debe manejar errores sin fallar (fail-open)', async () => {
      const versionRepo = getDefaultScreenTemplateVersionRepo();
      versionRepo.getLatestVersion.mockRejectedValue(new Error('DB Error'));

      // No debe lanzar excepción
      const html = await renderScreenTemplate('test', {});
      expect(html).toContain('<!DOCTYPE html>');
    });
  });

  describe('renderScreenTemplatePreview', () => {
    it('debe renderizar preview con PreviewContext', async () => {
      const versionRepo = getDefaultScreenTemplateVersionRepo();
      versionRepo.getLatestVersion.mockResolvedValue({
        definition_json: {
          id: 'test',
          name: 'Test',
          template_type: 'custom',
          schema: { type: 'object', properties: {} },
          html_template: '<html><body><p>{{title}}</p></body></html>'
        }
      });

      const previewContext = {
        student: {
          nivel: '3',
          nombre: 'Test User'
        },
        preview_mode: true
      };

      const html = await renderScreenTemplatePreview('test', { title: 'Preview' }, previewContext);
      expect(html).toContain('Preview');
    });
  });
});




