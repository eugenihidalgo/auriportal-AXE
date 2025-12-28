/**
 * Buttons Capability
 * Estilos para botones
 */

export default {
  capability_key: 'buttons',
  version: '1.0.0',
  category: 'inputs',
  name: 'Botones',
  description: 'Estilos para botones primarios y secundarios',
  tokens: [
    {
      key: '--ap-btn-primary-bg',
      type: 'color',
      default: 'var(--ap-accent-primary, #007bff)',
      description: 'Fondo de botón primario',
      aliases: ['--btn-primary-bg']
    },
    {
      key: '--ap-btn-primary-text',
      type: 'color',
      default: '#ffffff',
      description: 'Texto de botón primario',
      aliases: ['--btn-primary-text']
    },
    {
      key: '--ap-btn-secondary-bg',
      type: 'color',
      default: 'var(--ap-accent-secondary, #6c757d)',
      description: 'Fondo de botón secundario',
      aliases: ['--btn-secondary-bg']
    },
    {
      key: '--ap-btn-secondary-text',
      type: 'color',
      default: '#ffffff',
      description: 'Texto de botón secundario',
      aliases: ['--btn-secondary-text']
    },
    {
      key: '--ap-btn-padding',
      type: 'spacing',
      default: '10px 20px',
      description: 'Padding de botones',
      aliases: ['--btn-padding']
    },
    {
      key: '--ap-btn-radius',
      type: 'size',
      default: '6px',
      description: 'Radio de borde de botones',
      aliases: ['--btn-radius']
    }
  ],
  preview: null
};

