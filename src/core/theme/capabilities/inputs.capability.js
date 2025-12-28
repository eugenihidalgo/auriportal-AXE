/**
 * Inputs Capability
 * Estilos para campos de entrada
 */

export default {
  capability_key: 'inputs',
  version: '1.0.0',
  category: 'inputs',
  name: 'Inputs de Formulario',
  description: 'Estilos para campos de entrada de texto',
  tokens: [
    {
      key: '--ap-input-bg',
      type: 'color',
      default: 'var(--ap-bg-surface, #ffffff)',
      description: 'Fondo de inputs',
      aliases: ['--input-bg']
    },
    {
      key: '--ap-input-border',
      type: 'color',
      default: 'var(--ap-border-subtle, #e0e0e0)',
      description: 'Borde de inputs',
      aliases: ['--input-border']
    },
    {
      key: '--ap-input-text',
      type: 'color',
      default: 'var(--ap-text-primary, #333)',
      description: 'Color de texto de inputs',
      aliases: ['--input-text']
    },
    {
      key: '--ap-input-placeholder',
      type: 'color',
      default: 'var(--ap-text-muted, #888)',
      description: 'Color de placeholder de inputs',
      aliases: ['--input-placeholder']
    },
    {
      key: '--ap-input-focus-border',
      type: 'color',
      default: 'var(--ap-accent-primary, #007bff)',
      description: 'Borde de input en focus',
      aliases: ['--input-focus-border']
    },
    {
      key: '--ap-input-padding',
      type: 'spacing',
      default: '8px 12px',
      description: 'Padding de inputs',
      aliases: ['--input-padding']
    },
    {
      key: '--ap-input-radius',
      type: 'size',
      default: '4px',
      description: 'Radio de borde de inputs',
      aliases: ['--input-radius']
    }
  ],
  preview: null
};

