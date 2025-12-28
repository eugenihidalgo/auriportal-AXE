/**
 * Base UI Capability
 * Fundamentos visuales: colores base, tipografía, espacios
 */

export default {
  capability_key: 'base-ui',
  version: '1.0.0',
  category: 'base-ui',
  name: 'Base UI',
  description: 'Fundamentos visuales: colores base, tipografía, espacios',
  tokens: [
    {
      key: '--ap-bg-main',
      type: 'color',
      default: '#faf7f2',
      description: 'Color de fondo principal',
      aliases: ['--bg-main']
    },
    {
      key: '--ap-bg-surface',
      type: 'color',
      default: '#ffffff',
      description: 'Color de fondo de superficies (paneles, cards)',
      aliases: ['--bg-surface']
    },
    {
      key: '--ap-text-primary',
      type: 'color',
      default: '#333333',
      description: 'Color de texto principal',
      aliases: ['--text-primary']
    },
    {
      key: '--ap-text-secondary',
      type: 'color',
      default: '#666666',
      description: 'Color de texto secundario',
      aliases: ['--text-secondary']
    },
    {
      key: '--ap-text-muted',
      type: 'color',
      default: '#888888',
      description: 'Color de texto atenuado',
      aliases: ['--text-muted']
    },
    {
      key: '--ap-border-subtle',
      type: 'color',
      default: '#e0e0e0',
      description: 'Color de borde sutil',
      aliases: ['--border-subtle']
    },
    {
      key: '--ap-radius-md',
      type: 'size',
      default: '8px',
      description: 'Radio de borde medio',
      aliases: ['--radius-md']
    },
    {
      key: '--ap-radius-sm',
      type: 'size',
      default: '4px',
      description: 'Radio de borde pequeño',
      aliases: ['--radius-sm']
    }
  ],
  preview: null
};

